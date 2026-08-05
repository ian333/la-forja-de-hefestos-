/**
 * GATE DE L11 — SUPERFICIE DE PARTICIÓN COLOREADA POR ÁNGULO (§4.1.3 · §4.1.2 · §4.1.4)
 *
 * El libro da UN número (5°) y ninguna fórmula. Así que nada se verifica "contra el
 * libro": todo se verifica contra GEOMETRÍA ANALÍTICA — invariantes que existirían
 * aunque este módulo no existiera.
 *
 *  A1  PLANO PERPENDICULAR a la apertura ⇒ 90.000000° en TODOS los parches.
 *  A2  PLANO INCLINADO exactamente 5.000° ⇒ 5.000000° y NO cuenta bajo el umbral
 *      ("at LEAST five degrees": el 5.0 exacto PASA). Área = A·B analítica.
 *  A3  PLANO INCLINADO 4.900° ⇒ 100 % del área bajo el umbral (el 4.9 REPRUEBA).
 *  A4  CONO de semiángulo α respecto al eje de apertura ⇒ el mismo ángulo en TODA su
 *      superficie. Para la malla facetada el valor EXACTO es atan(tan α · cos(π/n)) —
 *      se compara contra esa fórmula cerrada (<1e-9°) y contra α al refinar (<1e-4°).
 *  A5  CONSERVACIÓN: Σ área por banda + área sin clasificar = área total.
 *  A6  INVARIANCIA DE ROTACIÓN: girar pieza y apertura juntas no mueve ningún número.
 *  A7  FALDA REGLADA de una línea de partición ELÍPTICA (cilindro de corte inclinado):
 *      el ángulo al pie de cada segmento vale atan(cos(Δ/2)/(k·|sin φ|)) EXACTO.
 *  A8  k = tan(85°) ⇒ mínimo al pie = 5.000° ⇒ 0 % de la línea bajo el umbral.
 *  A9  k = tan(85.1°) ⇒ mínimo al pie = 4.900° ⇒ >0 % bajo el umbral.
 *  A10 % DE ÁREA bajo 5° = integral cerrada sobre la superficie reglada exacta,
 *      y converge al subdividir la falda.
 *  A11 la métrica AL PIE no depende del ancho de falda ni de los anillos; la de ÁREA
 *      SÍ depende (por eso se declara y por eso se reportan las dos).
 *  B*  el par del libro con visibilidad (L21) para V4.6, y los SIN CABLEAR.
 *  C*  el par Fig 4.9 → Fig 4.10 (bezel crudo con escalón vs. modificado con rampa).
 *
 * Uso: node --import tsx scripts/mold-particion-angulo-test.cjs
 */
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };
const RAD = 180 / Math.PI;
const D2R = Math.PI / 180;

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES ANALÍTICOS
// ─────────────────────────────────────────────────────────────────────────────

/** volumen con signo (divergencia): >0 ⇒ malla cerrada con normales SALIENTES */
function volumen(m) {
  const P = m.positions, I = m.indices; let v6 = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v6 += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1])
        - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c])
        + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  return v6 / 6;
}

/**
 * Rectángulo A×B PLANO cuyo plano forma EXACTAMENTE `deg` con la dirección +Z.
 * n = (0, −cos t, sin t) ⇒ asin(|n·ẑ|) = t. El plano lo generan ê_x y (0, sin t, cos t).
 */
function planoInclinado(deg, A, B) {
  const t = deg * D2R, s = Math.sin(t), c = Math.cos(t);
  const P = [], I = [];
  const pt = (a, b) => { const k = P.length / 3; P.push(a, b * s, b * c); return k; };
  const p0 = pt(0, 0), p1 = pt(A, 0), p2 = pt(A, B), p3 = pt(0, B);
  I.push(p0, p1, p2, p0, p2, p3);
  return { positions: Float64Array.from(P), indices: Uint32Array.from(I) };
}

/** superficie LATERAL de un cono: ápice en (0,0,h), base radio R en z=0. tan α = R/h. */
function conoLateral(alphaDeg, R, n) {
  const h = R / Math.tan(alphaDeg * D2R);
  const P = [], I = [];
  const ap = 0; P.push(0, 0, h);
  for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; P.push(R * Math.cos(a), R * Math.sin(a), 0); }
  for (let i = 0; i < n; i++) I.push(ap, 1 + i, 1 + ((i + 1) % n));
  return { positions: Float64Array.from(P), indices: Uint32Array.from(I) };
}

/**
 * CILINDRO DE CORTE INCLINADO: radio R, tapa en z=H, fondo = el PLANO EXACTO z = k·x
 * (el abanico desde el origen cae íntegro en ese plano). Su línea de partición es la
 * elipse (R cosφ, R sinφ, kR cosφ) — el caso con fórmula cerrada de A7-A10.
 */
function cilindroCorteInclinado(R, k, H, n) {
  const P = [], I = [];
  const c0 = P.length / 3; P.push(0, 0, 0);                       // centro del fondo (en z = k·0 = 0)
  const bot = [], top = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI, x = R * Math.cos(a), y = R * Math.sin(a);
    bot.push(P.length / 3); P.push(x, y, k * x);
    top.push(P.length / 3); P.push(x, y, H);
  }
  const cT = P.length / 3; P.push(0, 0, H);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    I.push(c0, bot[j], bot[i]);                                   // fondo, normal −Z
    I.push(bot[i], bot[j], top[j], bot[i], top[j], top[i]);       // pared, n_z = 0 exacto
    I.push(cT, top[i], top[j]);                                   // tapa, normal +Z
  }
  return { positions: Float64Array.from(P), indices: Uint32Array.from(I) };
}

/**
 * VASO DE BORDE ONDULADO: la línea de partición "follows the profile of the features on
 * the side walls" (§4.1.2) sin escalones — NO plana pero sin trabe. Pendiente local
 * m·A/R ⇒ ángulo mínimo analítico atan(R/(m·A)).
 */
function vasoOndulado(R, A, m, H, n) {
  const P = [], I = [];
  const c0 = P.length / 3; P.push(0, 0, 0);
  const bot = [], top = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    bot.push(P.length / 3); P.push(R * Math.cos(a), R * Math.sin(a), A * Math.sin(m * a));
    top.push(P.length / 3); P.push(R * Math.cos(a), R * Math.sin(a), H);
  }
  const cT = P.length / 3; P.push(0, 0, H);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    I.push(c0, bot[j], bot[i]);
    I.push(bot[i], bot[j], top[j], bot[i], top[j], top[i]);
    I.push(cT, top[i], top[j]);
  }
  return { positions: Float64Array.from(P), indices: Uint32Array.from(I) };
}

/** TAZA del libro (§4.1.2 Fig 4.6 · §7.1.3 Fig 7.1) — idéntica al fixture de L21. */
function taza(o) {
  const { rExt, rInt, h, baseT, rimR, rimZ, rimT, n } = o;
  const P = [], I = [];
  const ring = (r, z) => { const b = P.length / 3; for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; P.push(r * Math.cos(a), r * Math.sin(a), z); } return b; };
  const pt = (x, y, z) => { const b = P.length / 3; P.push(x, y, z); return b; };
  const each = (f) => { for (let i = 0; i < n; i++) f(i, (i + 1) % n); };
  const cilExt = (r, zA, zB) => { const A = ring(r, zA), B = ring(r, zB); each((i, j) => I.push(A + i, A + j, B + j, A + i, B + j, B + i)); };
  const cilInt = (r, zA, zB) => { const A = ring(r, zA), B = ring(r, zB); each((i, j) => I.push(A + i, B + i, B + j, A + i, B + j, A + j)); };
  const anilloUp = (rIn, rOut, z) => { const N = ring(rIn, z), O = ring(rOut, z); each((i, j) => I.push(N + i, O + i, O + j, N + i, O + j, N + j)); };
  const anilloDn = (rIn, rOut, z) => { const N = ring(rIn, z), O = ring(rOut, z); each((i, j) => I.push(N + i, N + j, O + j, N + i, O + j, O + i)); };
  const discoUp = (r, z) => { const A = ring(r, z), C = pt(0, 0, z); each((i, j) => I.push(C, A + i, A + j)); };
  const discoDn = (r, z) => { const A = ring(r, z), C = pt(0, 0, z); each((i, j) => I.push(C, A + j, A + i)); };
  discoDn(rExt, 0); cilExt(rExt, 0, rimZ); anilloDn(rExt, rimR, rimZ);
  cilExt(rimR, rimZ, rimZ + rimT); anilloUp(rExt, rimR, rimZ + rimT); cilExt(rExt, rimZ + rimT, h);
  anilloUp(rInt, rExt, h); cilInt(rInt, baseT, h); discoUp(rInt, baseT);
  return { positions: Float64Array.from(P), indices: Uint32Array.from(I) };
}

/** BARRIL: r(z) = R0 + A·sin(π z/H). Su silueta cae A MEDIA PARED — superficie que el
 *  usuario VE. Es el control negativo de V4.6. */
function barril(R0, A, H, n, nz) {
  const P = [], I = [];
  const rings = [];
  for (let j = 0; j <= nz; j++) {
    const z = (j / nz) * H, r = R0 + A * Math.sin(Math.PI * z / H);
    const b = P.length / 3;
    for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; P.push(r * Math.cos(a), r * Math.sin(a), z); }
    rings.push(b);
  }
  const cB = P.length / 3; P.push(0, 0, 0);
  const cT = P.length / 3; P.push(0, 0, H);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    I.push(cB, rings[0] + j, rings[0] + i);
    I.push(cT, rings[nz] + i, rings[nz] + j);
    for (let q = 0; q < nz; q++) {
      const A0 = rings[q], B0 = rings[q + 1];
      I.push(A0 + i, A0 + j, B0 + j, A0 + i, B0 + j, B0 + i);
    }
  }
  return { positions: Float64Array.from(P), indices: Uint32Array.from(I) };
}

/**
 * BEZEL SINTÉTICO (§4.1.2 Fig 4.7): bandeja rectangular cuya línea de partición
 * "follows the profile of the features on the side walls" — dos lados a z=0 y dos a
 * z=10, con la transición sobre la pared lateral. `rampaMm` es el largo de esa
 * transición: 0.4 mm = el escalón CRUDO de Fig 4.9 · 25 mm = la rampa de Fig 4.10.
 */
function bezel(L, W, H, niveles, rampaMm, ds) {
  const esquinas = [[0, 0], [L, 0], [L, W], [0, W]];
  const rim = [];
  for (let e = 0; e < 4; e++) {
    const a = esquinas[e], b = esquinas[(e + 1) % 4];
    const Le = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const zPrev = niveles[(e + 3) % 4], zAqui = niveles[e];
    const svals = [];
    for (let s = 0; s < Le - 1e-9; s += ds) svals.push(s);
    if (rampaMm > 0 && rampaMm < Le) svals.push(rampaMm);
    svals.sort((p, q) => p - q);
    for (let i = 0; i < svals.length; i++) {
      if (i > 0 && svals[i] - svals[i - 1] < 1e-6) continue;
      const s = svals[i], u = s / Le;
      const z = rampaMm > 0 && s < rampaMm ? zPrev + (zAqui - zPrev) * (s / rampaMm) : zAqui;
      rim.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, z]);
    }
  }
  const n = rim.length;
  const P = [], I = [];
  let zc = 0; for (const p of rim) zc += p[2]; zc /= n;
  const cB = P.length / 3; P.push(L / 2, W / 2, zc);
  const cT = P.length / 3; P.push(L / 2, W / 2, H);
  const bot = [], top = [];
  for (const p of rim) { bot.push(P.length / 3); P.push(p[0], p[1], p[2]); top.push(P.length / 3); P.push(p[0], p[1], H); }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    I.push(cB, bot[j], bot[i]);                                   // fondo: n_z<0 por winding
    I.push(bot[i], bot[j], top[j], bot[i], top[j], top[i]);       // pared: n_z = 0 exacto
    I.push(cT, top[i], top[j]);                                   // tapa: n_z>0
  }
  return { malla: { positions: Float64Array.from(P), indices: Uint32Array.from(I) }, rim };
}

/** rota una malla por una matriz 3×3 (filas) */
function rotar(m, M) {
  const P = m.positions, out = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    out[i] = M[0][0] * x + M[0][1] * y + M[0][2] * z;
    out[i + 1] = M[1][0] * x + M[1][1] * y + M[1][2] * z;
    out[i + 2] = M[2][0] * x + M[2][1] * y + M[2][2] * z;
  }
  return { positions: out, indices: m.indices };
}
function rotEje(eje, ang) {
  const l = Math.hypot(...eje), [x, y, z] = eje.map((v) => v / l);
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

/** integral cerrada sobre la superficie reglada exacta S(φ,t) = ((R+t)cosφ,(R+t)sinφ,kR cosφ) */
function fraccionAreaBajo(R, k, w, umbralDeg, nPhi, nT) {
  let tot = 0, bajo = 0;
  const dphi = 2 * Math.PI / nPhi, dt = w / nT;
  for (let i = 0; i < nPhi; i++) {
    const s = Math.abs(Math.sin((i + 0.5) * dphi));
    const kk = k * R * s;
    for (let j = 0; j < nT; j++) {
      const rr = R + (j + 0.5) * dt;
      const dA = Math.sqrt(kk * kk + rr * rr) * dphi * dt;
      tot += dA;
      if (Math.atan2(rr, kk) * RAD < umbralDeg) bajo += dA;
    }
  }
  return bajo / tot;
}

// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', 'mold', p);
  const M = await import(R('lamina-particion-angulo.ts'));
  const V = await import(R('visibilidad.ts'));
  const UM = M.UMBRAL_INTERLOCK_DEG;

  console.log(`\n── LA COTA DEL LIBRO ────────────────────────────────────────────────`);
  check('el umbral del módulo es el 5° LITERAL de §4.1.3', UM === 5, `UMBRAL_INTERLOCK_DEG = ${UM}`);
  check('la escala es FIJA y su primer corte es el 5° (no percentiles)',
    M.CORTES_DEG[0] === 5 && M.CORTES_DEG.length === 4,
    `cortes = [${M.CORTES_DEG.join(', ')}]° — solo el 5 es criterio; el resto es lectura declarada`);

  console.log(`\n── A1-A3 · PLANOS DE ÁNGULO EXACTO ──────────────────────────────────`);
  const perp = M.analizarParticionAngulo({ nombre: 'plano ⊥ apertura', superficie: planoInclinado(90, 40, 25) });
  let ePerp = 0; for (const d of perp.degTri) ePerp = Math.max(ePerp, Math.abs(d - 90));
  check('A1 plano PERPENDICULAR a la apertura ⇒ 90° en todos los parches',
    ePerp < 1e-9 && perp.pctBajoUmbral === 0,
    `error máx ${ePerp.toExponential(2)}° · ${perp.pctBajoUmbral.toFixed(6)} % bajo 5° · área ${perp.areaTotalMm2.toFixed(6)} vs 1000 analítica`);
  check('A1b área analítica del rectángulo 40×25 = 1000 mm²',
    Math.abs(perp.areaTotalMm2 - 1000) < 1e-3, `medida ${perp.areaTotalMm2.toFixed(6)} mm²`);

  const p50 = M.analizarParticionAngulo({ nombre: 'plano a 5.000°', superficie: planoInclinado(5.0, 40, 25) });
  let e50 = 0; for (const d of p50.degTri) e50 = Math.max(e50, Math.abs(d - 5));
  check('A2 plano a 5.000° EXACTOS ⇒ 5.000000° y NO cuenta bajo el umbral ("at LEAST five degrees")',
    e50 < 1e-9 && p50.areaBajoUmbralMm2 === 0 && p50.veredictos[0].estado === 'CUMPLE',
    `error máx ${e50.toExponential(2)}° · área bajo 5° = ${p50.areaBajoUmbralMm2} mm² · V4.5 ${p50.veredictos[0].estado}`);

  const pCasi = M.analizarParticionAngulo({ nombre: 'plano a 4.999999°', superficie: planoInclinado(5 - 1e-6, 40, 25) });
  check('A2b el epsilon del umbral es de REDONDEO, no un margen: 5° − 1e-6° SIGUE reprobando',
    pCasi.veredictos[0].estado === 'VIOLA' && Math.abs(pCasi.pctBajoUmbral - 100) < 1e-9 && M.EPS_ANG_DEG === 1e-9,
    `parche a ${(5 - 1e-6).toFixed(6)}° → ${pCasi.pctBajoUmbral.toFixed(2)} % bajo el umbral · EPS_ANG_DEG = ${M.EPS_ANG_DEG}° (el ruido medido de la doble precisión es 2.7e-15°)`);

  const p49 = M.analizarParticionAngulo({ nombre: 'plano a 4.900°', superficie: planoInclinado(4.9, 40, 25) });
  let e49 = 0; for (const d of p49.degTri) e49 = Math.max(e49, Math.abs(d - 4.9));
  check('A3 plano a 4.900° ⇒ 100 % del área bajo el umbral y V4.5 VIOLA (el 4.9 REPRUEBA)',
    e49 < 1e-9 && Math.abs(p49.pctBajoUmbral - 100) < 1e-9 && p49.veredictos[0].estado === 'VIOLA',
    `error máx ${e49.toExponential(2)}° · ${p49.pctBajoUmbral.toFixed(4)} % bajo 5° · V4.5 ${p49.veredictos[0].estado}`);

  console.log(`\n── A4 · CONO DE SEMIÁNGULO CONOCIDO ─────────────────────────────────`);
  // Para una malla FACETADA el valor exacto NO es α sino atan(tan α · cos(π/n)): la
  // faceta es la cuerda, no la superficie. Se verifican las TRES cosas:
  //  (i)  cada faceta = esa fórmula cerrada,
  //  (ii) la desviación contra el α ideal es EXACTAMENTE la que predice la fórmula,
  //  (iii) al duplicar n esa desviación se divide por 4 (convergencia de 2º orden).
  const desv = {};
  for (const al of [5, 15, 45]) {
    for (const n of [720, 1440]) {
      const co = M.analizarParticionAngulo({ nombre: `cono ${al}°`, superficie: conoLateral(al, 10, n) });
      const exacto = Math.atan(Math.tan(al * D2R) * Math.cos(Math.PI / n)) * RAD;
      let eF = 0, eI = 0;
      for (const d of co.degTri) { eF = Math.max(eF, Math.abs(d - exacto)); eI = Math.max(eI, Math.abs(d - al)); }
      desv[`${al}_${n}`] = eI;
      check(`A4 cono α=${al}° (n=${n}): cada faceta = atan(tan α·cos(π/n)) EXACTO`,
        eF < 1e-9 && Math.abs(eI - (al - exacto)) < 1e-9,
        `err vs faceta ${eF.toExponential(2)}° · desviación vs α ideal ${eI.toExponential(3)}° = la predicha ${(al - exacto).toExponential(3)}°`);
    }
    const rat = desv[`${al}_720`] / desv[`${al}_1440`];
    // la razón teórica NO es exactamente 4 (hay términos de orden superior): se compara
    // contra la que predice la propia fórmula cerrada, no contra un 4 redondeado
    const pred = (al - Math.atan(Math.tan(al * D2R) * Math.cos(Math.PI / 720)) * RAD)
      / (al - Math.atan(Math.tan(al * D2R) * Math.cos(Math.PI / 1440)) * RAD);
    check(`A4b cono α=${al}°: al duplicar n la desviación cae como 1/n² (2º orden)`,
      Math.abs(rat - pred) < 1e-6, `medida ${rat.toFixed(6)} · predicha por la fórmula ${pred.toFixed(6)} (≈4)`);
  }

  console.log(`\n── A5 · CONSERVACIÓN DE ÁREA ────────────────────────────────────────`);
  {
    const co = M.analizarParticionAngulo({ nombre: 'cono 15°', superficie: conoLateral(15, 10, 360) });
    const s = co.areaPorBandaMm2.reduce((a, b) => a + b, 0) + co.areaSinClasificarMm2;
    const rel = Math.abs(s - co.areaTotalMm2) / co.areaTotalMm2;
    check('A5 Σ área por banda + sin clasificar = área total',
      rel < 1e-9, `Σ=${s.toFixed(9)} total=${co.areaTotalMm2.toFixed(9)} mm² → error relativo ${rel.toExponential(2)}`);
  }

  console.log(`\n── A7-A11 · FALDA REGLADA CON LÍNEA DE PARTICIÓN ELÍPTICA ───────────`);
  const NEL = 720, REL = 10;
  const dPhi = 2 * Math.PI / NEL;
  /** ángulo EXACTO al pie del segmento i de la elipse: atan(cos(Δ/2)/(k·|sin φ_medio|)) */
  const pieExacto = (k, i) => {
    const phim = (i + 0.5) * dPhi;
    return Math.atan2(Math.cos(dPhi / 2), k * Math.abs(Math.sin(phim))) * RAD;
  };
  {
    const k = Math.tan(86.5 * D2R);
    const cil = cilindroCorteInclinado(REL, k, 180, NEL);
    const volTeo = (NEL / 2) * REL * REL * Math.sin(2 * Math.PI / NEL) * 180;
    check('A0 fixture: el cilindro de corte inclinado es sólido cerrado con normales SALIENTES',
      Math.abs(volumen(cil) - volTeo) / volTeo < 1e-4,
      `V=${volumen(cil).toFixed(1)} vs teórico ${volTeo.toFixed(1)} mm³`);
    const r = M.analizarParticionAngulo({ nombre: 'cilindro corte 86.5°', pieza: cil, faldaMm: 2, faldaAnillos: 40 });
    check('A7a el trazado de la silueta da UN lazo cerrado con los N puntos de la malla',
      r.loops.length === 1 && r.loops[0].pts.length === NEL && r.loops[0].esExterior,
      `${r.loops.length} lazo(s), ${r.loops[0] ? r.loops[0].pts.length : 0} pts (esperados ${NEL})`);
    // el lazo puede empezar en cualquier φ y correr en cualquier sentido: se compara el
    // MULTICONJUNTO de ángulos contra la fórmula cerrada, ordenado
    const got = Array.from(r.linea.degSeg).sort((a, b) => a - b);
    const exp = Array.from({ length: NEL }, (_, i) => pieExacto(k, i)).sort((a, b) => a - b);
    let eSeg = 0; for (let i = 0; i < NEL; i++) eSeg = Math.max(eSeg, Math.abs(got[i] - exp[i]));
    check('A7b ángulo AL PIE de cada segmento = atan(cos(Δ/2)/(k·|sin φ|)) — fórmula cerrada',
      eSeg < 1e-5, `error máximo sobre ${NEL} segmentos: ${eSeg.toExponential(2)}°`);
    check('A7c mínimo al pie = 90° − atan(k) = 3.500° (el corte a 86.5° del eje)',
      Math.abs(r.linea.minDeg - 3.5) < 2e-5, `medido ${r.linea.minDeg.toFixed(6)}° vs 3.500000°`);

    // A10 · el % de ÁREA contra la integral cerrada de la superficie reglada
    const teo = fraccionAreaBajo(REL, k, 2, UM, 7200, 400) * 100;
    const errRel = Math.abs(r.pctBajoUmbral - teo) / teo * 100;
    check('A10 % de área bajo 5° = integral cerrada sobre la superficie reglada exacta',
      errRel < 1.5, `módulo ${r.pctBajoUmbral.toFixed(4)} % vs integral ${teo.toFixed(4)} % → error relativo ${errRel.toFixed(3)} %`);
    const conv = [5, 20, 80].map((na) =>
      M.analizarParticionAngulo({ nombre: 'conv', pieza: cil, faldaMm: 2, faldaAnillos: na }).pctBajoUmbral);
    const e1 = Math.abs(conv[0] - teo), e2 = Math.abs(conv[1] - teo), e3 = Math.abs(conv[2] - teo);
    check('A10b converge al subdividir la falda (5 → 20 → 80 anillos)',
      e3 < e2 && e2 < e1, `|err| ${e1.toFixed(4)} → ${e2.toFixed(4)} → ${e3.toFixed(4)} puntos porcentuales`);

    // A11 · qué depende del ancho y qué no
    const ancho2 = M.analizarParticionAngulo({ nombre: 'w2', pieza: cil, faldaMm: 2, faldaAnillos: 40 });
    const ancho30 = M.analizarParticionAngulo({ nombre: 'w30', pieza: cil, faldaMm: 30, faldaAnillos: 40 });
    const anillos1 = M.analizarParticionAngulo({ nombre: 'a1', pieza: cil, faldaMm: 2, faldaAnillos: 1 });
    const dPie = Math.max(Math.abs(ancho2.linea.minDeg - ancho30.linea.minDeg),
      Math.abs(ancho2.linea.minDeg - anillos1.linea.minDeg),
      Math.abs(ancho2.linea.pctBajoUmbral - ancho30.linea.pctBajoUmbral));
    check('A11a la métrica AL PIE de la línea NO depende del ancho de falda ni de los anillos',
      dPie < 1e-9, `Δ máx = ${dPie.toExponential(2)} (falda 2 vs 30 mm · 1 vs 40 anillos)`);
    check('A11b la métrica de ÁREA SÍ depende del ancho — por eso se declara y se reportan las dos',
      Math.abs(ancho2.pctBajoUmbral - ancho30.pctBajoUmbral) > 1,
      `falda 2 mm → ${ancho2.pctBajoUmbral.toFixed(2)} % · falda 30 mm → ${ancho30.pctBajoUmbral.toFixed(2)} % del área bajo 5°`);
  }
  {
    const k85 = Math.tan(85 * D2R);
    const r85 = M.analizarParticionAngulo({ nombre: 'corte 85.0°', pieza: cilindroCorteInclinado(REL, k85, 130, NEL), faldaMm: 2, faldaAnillos: 20 });
    check('A8 corte a 85.0° ⇒ mínimo al pie 5.000° y 0 % de la línea bajo el umbral (el 5.0 PASA)',
      Math.abs(r85.linea.minDeg - 5) < 2e-5 && r85.linea.longBajoUmbralMm === 0,
      `mín ${r85.linea.minDeg.toFixed(6)}° · ${r85.linea.pctBajoUmbral.toFixed(6)} % de la longitud bajo 5°`);
    const k851 = Math.tan(85.1 * D2R);
    const r851 = M.analizarParticionAngulo({ nombre: 'corte 85.1°', pieza: cilindroCorteInclinado(REL, k851, 130, NEL), faldaMm: 2, faldaAnillos: 20 });
    check('A9 corte a 85.1° ⇒ mínimo al pie 4.900° y >0 % bajo el umbral (el 4.9 REPRUEBA)',
      Math.abs(r851.linea.minDeg - 4.9) < 2e-5 && r851.linea.longBajoUmbralMm > 0,
      `mín ${r851.linea.minDeg.toFixed(6)}° · ${r851.linea.pctBajoUmbral.toFixed(4)} % de la longitud bajo 5°`);
  }

  console.log(`\n── A6 · INVARIANCIA DE ROTACIÓN ─────────────────────────────────────`);
  {
    const bz = bezel(120, 80, 26, [0, 10, 0, 10], 0.4, 3).malla;
    const base = M.analizarParticionAngulo({ nombre: 'bezel', pieza: bz, weldMm: 0.05 });
    const casos = [
      ['giro exacto de 90° sobre X', rotEje([1, 0, 0], Math.PI / 2), 1e-6],
      ['giro general (37° sobre [1,2,3])', rotEje([1, 2, 3], 37 * D2R), 2e-3],
    ];
    for (const [et, Mt, tol] of casos) {
      const ap = [Mt[0][2], Mt[1][2], Mt[2][2]];             // M·ẑ
      const rr = M.analizarParticionAngulo({ nombre: 'bezel rot', pieza: rotar(bz, Mt), apertura: ap, weldMm: 0.05 });
      const dA = Math.abs(rr.pctBajoUmbral - base.pctBajoUmbral);
      const dM = Math.abs(rr.minDeg - base.minDeg);
      const dP = Math.abs(rr.planaridad.desviacionMm - base.planaridad.desviacionMm);
      const dL = Math.abs(rr.linea.minDeg - base.linea.minDeg);
      check(`A6 ${et}: girar pieza y apertura juntas no mueve ningún número`,
        dA < tol && dM < tol && dP < tol && dL < tol && rr.loops.length === base.loops.length,
        `Δ%área ${dA.toExponential(2)} · Δmín ${dM.toExponential(2)}° · Δpie ${dL.toExponential(2)}° · ΔΔz ${dP.toExponential(2)} mm · lazos ${rr.loops.length}/${base.loops.length}`);
    }
  }

  console.log(`\n── B · V4.4 y V4.6 CON LA PIEZA DEL LIBRO ───────────────────────────`);
  const GEO = { rExt: 20, rInt: 18, h: 60, baseT: 2, rimR: 24, rimZ: 52, rimT: 3, n: 96 };
  const cup = taza(GEO);
  const volTeoCup = Math.PI * (GEO.rExt ** 2 * GEO.h + (GEO.rimR ** 2 - GEO.rExt ** 2) * GEO.rimT - GEO.rInt ** 2 * (GEO.h - GEO.baseT));
  check('B0 fixture: la taza es sólida cerrada con normales SALIENTES (volumen analítico)',
    volumen(cup) > 0 && Math.abs(volumen(cup) - volTeoCup) / volTeoCup < 0.005,
    `V=${volumen(cup).toFixed(1)} vs teórico ${volTeoCup.toFixed(1)} mm³`);

  const visCup = V.clasificarVisibilidad(cup, { res: 768 });
  const rCup = M.analizarParticionAngulo({ nombre: 'taza del libro — vistas SUPUESTAS', pieza: cup, visibilidad: visCup, faldaMm: 18 });
  const extCup = rCup.loops.find((L) => L.esExterior);
  const rMax = Math.max(...extCup.pts.map((p) => Math.hypot(p[0], p[1])));
  check('B1 la silueta de la taza cae en el FONDO DEL REBORDE (§4.1.2: "at the bottom of the rim")',
    rCup.loops.length === 3 && Math.abs(rMax - GEO.rimR) < 1e-3 && Math.abs(extCup.zMin - GEO.rimZ) < 1e-3,
    `${rCup.loops.length} lazos · exterior r=${rMax.toFixed(3)} (rimR ${GEO.rimR}) z=${extCup.zMin.toFixed(3)} (rimZ ${GEO.rimZ})`);
  check('B1b V4.4: línea PLANA (Δz = 0) ⇒ V4.5 sin nada bajo 5° (una partición plana no traba)',
    rCup.planaridad.plana && rCup.planaridad.desviacionMm < 1e-6 && rCup.pctBajoUmbral === 0 && rCup.veredictos[0].estado === 'CUMPLE',
    `Δz=${rCup.planaridad.desviacionMm.toExponential(2)} mm · ${rCup.pctBajoUmbral.toFixed(4)} % bajo 5° · mín ${rCup.minDeg.toFixed(3)}°`);
  const v46cup = rCup.veredictos.find((v) => v.id === 'V4.6');
  check('B2 V4.6 con las vistas SUPUESTAS: la línea corre por la SILUETA (frontera visible/oculta)',
    v46cup.estado === 'MEDIDO' && rCup.shutoff.longVisibleMm === 0 && rCup.shutoff.longOcultaMm === 0 && rCup.shutoff.longFronteraMm > 0,
    `${rCup.shutoff.longFronteraMm.toFixed(1)} mm frontera · ${rCup.shutoff.longOcultaMm.toFixed(1)} oculta · ${rCup.shutoff.longVisibleMm.toFixed(1)} visible · zona libre ${rCup.shutoff.areaOcultaPiezaMm2.toFixed(0)} mm²`);

  // el caso del bezel del libro: el cliente declara que solo se ve la cara frontal
  const visFrente = V.clasificarVisibilidad(cup, { res: 768, vistas: [{ nombre: 'frente-usuario', dir: [0, 0, -1] }] });
  const rFrente = M.analizarParticionAngulo({ nombre: 'taza montada — UNA vista declarada', pieza: cup, visibilidad: visFrente, faldaMm: 18 });
  const v46f = rFrente.veredictos.find((v) => v.id === 'V4.6');
  check('B3 V4.6 con UNA vista DECLARADA (§4.1.4 "the entire shelf is hidden from view") ⇒ shut-off LIBRE',
    v46f.estado === 'CUMPLE' && rFrente.shutoff.longVisibleMm === 0 && rFrente.shutoff.longOcultaMm > 0 && rFrente.shutoff.vistasDeclaradas,
    `${rFrente.shutoff.longOcultaMm.toFixed(1)} mm de línea OCULTA · vistas declaradas=${rFrente.shutoff.vistasDeclaradas}`);

  const bar = barril(15, 6, 40, 96, 24);
  check('B4a fixture: el barril es sólido cerrado con normales SALIENTES', volumen(bar) > 0, `V=${volumen(bar).toFixed(1)} mm³`);
  const visBar = V.clasificarVisibilidad(bar, { res: 768 });
  const rBar = M.analizarParticionAngulo({ nombre: 'barril — silueta a media pared', pieza: bar, visibilidad: visBar, faldaMm: 18 });
  const v46b = rBar.veredictos.find((v) => v.id === 'V4.6');
  check('B4 V4.6 control negativo: silueta A MEDIA PARED ⇒ la línea cruza superficie VISIBLE ⇒ VIOLA',
    v46b.estado === 'VIOLA' && rBar.shutoff.longVisibleMm > 0,
    `${rBar.shutoff.longVisibleMm.toFixed(1)} mm de línea sobre superficie que el usuario ve (ecuador z=${rBar.loops.find((L) => L.esExterior).zMin.toFixed(2)})`);

  const rSin = M.analizarParticionAngulo({ nombre: 'taza sin L21', pieza: cup, faldaMm: 18 });
  const v46s = rSin.veredictos.find((v) => v.id === 'V4.6');
  check('B5 sin la clasificación de L21, V4.6 dice SIN CABLEAR y NO pinta zona libre',
    v46s.estado === 'SIN CABLEAR' && !rSin.shutoff.cableado && rSin.shutoff.longOcultaMm === 0
    && rSin.loops.every((L) => Array.from(L.estadoVert).every((e) => e === -1)),
    `estado=${v46s.estado} · oculta=${rSin.shutoff.longOcultaMm} mm · todos los vértices sin clasificar`);

  const rMal = M.analizarParticionAngulo({ nombre: 'visibilidad de OTRA malla', pieza: cup, visibilidad: visBar, faldaMm: 18 });
  const v46m = rMal.veredictos.find((v) => v.id === 'V4.6');
  check('B6 si la visibilidad viene de OTRA malla se detecta y V4.6 cae a SIN CABLEAR (no cuela verde)',
    v46m.estado === 'SIN CABLEAR' && rMal.avisos.some((a) => a.includes('NO son la misma malla')),
    `estado=${v46m.estado} · aviso: ${(rMal.avisos.find((a) => a.includes('misma malla')) || '—').slice(0, 68)}`);

  console.log(`\n── C · EL PAR DEL LIBRO: Fig 4.9 (crudo) → Fig 4.10 (modificado) ────`);
  const bzCrudo = bezel(120, 80, 26, [0, 10, 0, 10], 0.4, 3);
  const bzMod = bezel(120, 80, 26, [0, 10, 0, 10], 25, 3);
  check('C0 fixtures: ambos bezels son sólidos cerrados con normales SALIENTES',
    volumen(bzCrudo.malla) > 0 && volumen(bzMod.malla) > 0,
    `crudo ${volumen(bzCrudo.malla).toFixed(0)} mm³ · modificado ${volumen(bzMod.malla).toFixed(0)} mm³`);
  const visCrudo = V.clasificarVisibilidad(bzCrudo.malla, { res: 640 });
  const rCrudo = M.analizarParticionAngulo({ nombre: 'bezel CRUDO — escalón vertical (Fig 4.9)', pieza: bzCrudo.malla, visibilidad: visCrudo, weldMm: 0.05 });
  const rMod = M.analizarParticionAngulo({ nombre: 'bezel MODIFICADO — rampa con draft (Fig 4.10)', pieza: bzMod.malla, visibilidad: V.clasificarVisibilidad(bzMod.malla, { res: 640 }), weldMm: 0.05 });
  const escalonTeo = Math.atan2(0.4, 10) * RAD;
  check('C1 bezel CRUDO: V4.4 mide la NO planaridad exacta (10 mm de escalón)',
    Math.abs(rCrudo.planaridad.desviacionMm - 10) < 1e-3 && !rCrudo.planaridad.plana,
    `Δz = ${rCrudo.planaridad.desviacionMm.toFixed(4)} mm → ${rCrudo.planaridad.plana ? 'PLANA' : 'NO PLANA (escalonada)'}`);
  check('C2 bezel CRUDO: el escalón da atan(0.4/10) EXACTO y V4.5 VIOLA',
    Math.abs(rCrudo.linea.minDeg - escalonTeo) < 1e-6 && rCrudo.veredictos[0].estado === 'VIOLA' && rCrudo.areaBajoUmbralMm2 > 0,
    `mín al pie ${rCrudo.linea.minDeg.toFixed(6)}° vs analítico ${escalonTeo.toFixed(6)}° · ${rCrudo.pctBajoUmbral.toFixed(3)} % del área en rojo`);
  // el área de la falda del bezel se descompone EN CERRADO: 4 tiras de escalón +
  // tiras rectas + 4 juntas de esquina (polígono de `pasos` sectores de radio w)
  {
    const w = 30, pasos = Math.ceil(90 / 12);
    const aEscalon = 4 * w * Math.hypot(0.4, 10);
    const aRecta = w * (2 * (120 + 80) - 4 * 0.4);
    const aJunta = 4 * 0.5 * w * w * pasos * Math.sin((Math.PI / 2) / pasos);
    const aTot = aEscalon + aRecta + aJunta;
    const eA = Math.abs(rCrudo.areaTotalMm2 - aTot) / aTot;
    const eR = Math.abs(rCrudo.areaBajoUmbralMm2 - aEscalon) / aEscalon;
    check('C2b el área de la falda y el área ROJA salen exactas de la descomposición cerrada',
      eA < 1e-9 && eR < 1e-9,
      `total ${rCrudo.areaTotalMm2.toFixed(3)} vs ${aTot.toFixed(3)} mm² (err ${eA.toExponential(2)}) · roja ${rCrudo.areaBajoUmbralMm2.toFixed(3)} vs 4·30·hypot(0.4,10)=${aEscalon.toFixed(3)} mm² (err ${eR.toExponential(2)})`);
  }
  const rampaTeo = Math.atan2(25, 10) * RAD;
  check('C3 bezel MODIFICADO (rampa 25 mm): 0 % bajo 5° y V4.5 CUMPLE — la progresión 4.9 → 4.10',
    rMod.areaBajoUmbralMm2 === 0 && rMod.veredictos[0].estado === 'CUMPLE' && Math.abs(rMod.linea.minDeg - rampaTeo) < 1e-6,
    `mín al pie ${rMod.linea.minDeg.toFixed(4)}° vs analítico atan(25/10)=${rampaTeo.toFixed(4)}° · ${rMod.pctBajoUmbral.toFixed(4)} % bajo 5°`);
  check('C4 misma pieza, misma desviación de línea: lo único que cambia es el DRAFT del escalón',
    Math.abs(rMod.planaridad.desviacionMm - 10) < 1e-3 && rCrudo.pctBajoUmbral > rMod.pctBajoUmbral,
    `crudo ${rCrudo.pctBajoUmbral.toFixed(3)} % vs modificado ${rMod.pctBajoUmbral.toFixed(3)} % del área bajo 5° (Δz igual: ${rMod.planaridad.desviacionMm.toFixed(3)} mm)`);

  const onda = vasoOndulado(28, 10, 6, 46, 180);
  const rOnda = M.analizarParticionAngulo({
    nombre: 'vaso de borde ondulado — línea NO plana que SÍ cumple (§4.1.2 Fig 4.7)',
    pieza: onda, visibilidad: V.clasificarVisibilidad(onda, { res: 640 }), faldaMm: 16, faldaAnillos: 6,
  });
  // fórmula CERRADA del polígono (no el límite continuo): con z = A·sin(mφ) sobre un plan
  // circular, |n_z| = R·sinΔ y dz = 2A·sin(mΔ/2)·cos(m·φ_medio)
  {
    const Ro = 28, Ao = 10, mo = 6, no = 180, Do = 2 * Math.PI / no;
    const cerr = Array.from({ length: no }, (_, i) =>
      Math.atan2(Ro * Math.sin(Do), Math.abs(2 * Ao * Math.sin(mo * Do / 2) * Math.cos(mo * (i + 0.5) * Do))) * RAD);
    const got = Array.from(rOnda.linea.degSeg).sort((a, b) => a - b);
    const exp = cerr.slice().sort((a, b) => a - b);
    let eO = 0; for (let i = 0; i < no; i++) eO = Math.max(eO, Math.abs(got[i] - exp[i]));
    const contin = Math.atan2(Ro, mo * Ao) * RAD;
    check('C5 borde ONDULADO: cada segmento = la fórmula cerrada del polígono, y tiende a atan(R/(m·A))',
      eO < 1e-9 && Math.abs(rOnda.linea.minDeg - contin) < 0.2,
      `err vs fórmula cerrada ${eO.toExponential(2)}° · mín ${rOnda.linea.minDeg.toFixed(3)}° vs límite continuo atan(28/60)=${contin.toFixed(3)}°`);
    check('C5b la línea NO es plana y aun así V4.5 CUMPLE — la no planaridad por sí sola no traba',
      rOnda.veredictos[0].estado === 'CUMPLE' && !rOnda.planaridad.plana
      && Math.abs(rOnda.planaridad.desviacionMm - 2 * Ao * Math.cos(Math.PI / no * mo * 0)) < 0.2,
      `Δz ${rOnda.planaridad.desviacionMm.toFixed(3)} mm (2A = ${2 * Ao}) · V4.5 ${rOnda.veredictos[0].estado} · V4.4 ${rOnda.veredictos[1].estado}`);
  }

  console.log(`\n── D · LA LÁMINA ────────────────────────────────────────────────────`);
  const outDir = path.resolve(__dirname, '..', '_laminas');
  fs.mkdirSync(outDir, { recursive: true });
  const laminas = [
    ['L11-bezel-crudo', rCrudo], ['L11-bezel-modificado', rMod],
    ['L11-taza', rCup], ['L11-taza-una-vista', rFrente],
    ['L11-sin-L21', rSin],
    // línea NO plana pero SUAVE: cumple sin trabar (el caso que Fig 4.10 persigue)
    ['L11-borde-ondulado', rOnda],
    // la OTRA rama de la API: la superficie la entrega el motor y no hay lazo ⇒ V4.4 y
    // V4.6 quedan SIN CABLEAR y el perfil z(s) lo dice en pantalla
    ['L11-superficie-motor', M.analizarParticionAngulo({
      nombre: 'superficie ENTREGADA por el motor (cono de prueba a 4°)',
      superficie: conoLateral(4, 40, 180),
    })],
  ];
  let svgOK = true, bytes = 0, peorKB = 0;
  for (const [id, res] of laminas) {
    const lam = M.laminaParticionAngulo(res);
    fs.writeFileSync(path.join(outDir, `${id}.svg`), lam.svg);
    bytes += lam.svg.length; peorKB = Math.max(peorKB, lam.svg.length / 1024);
    const abre = (lam.svg.match(/<svg /g) || []).length, cierra = (lam.svg.match(/<\/svg>/g) || []).length;
    if (abre !== 1 || cierra !== 1 || lam.id !== 'particion-angulo' || !/NaN|undefined/.test('x') === false) svgOK = false;
    if (/NaN|undefined/.test(lam.svg)) { svgOK = false; console.log(`   (${id} trae NaN/undefined en el SVG)`); }
  }
  check(`D1 las ${laminas.length} láminas salen como SVG bien formado, sin NaN ni undefined, y ninguna pasa de 1 MB`,
    svgOK && peorKB < 700, `${laminas.length} SVG · ${(bytes / 1024).toFixed(0)} KB en total · la más pesada ${peorKB.toFixed(0)} KB`);
  const rMotor = M.analizarParticionAngulo({ nombre: 'motor', superficie: conoLateral(4, 40, 180) });
  check('D5 rama MOTOR: sin pieza, V4.5 se mide y V4.4/V4.6 quedan SIN CABLEAR (no se inventan)',
    rMotor.origen === 'motor' && rMotor.veredictos[0].estado === 'VIOLA'
    && rMotor.veredictos[1].estado === 'SIN CABLEAR' && rMotor.veredictos[2].estado === 'SIN CABLEAR'
    && rMotor.linea === null && M.laminaParticionAngulo(rMotor).svg.includes('no hay línea de partición trazada'),
    `origen=${rMotor.origen} · V4.5=${rMotor.veredictos[0].estado} (${rMotor.pctBajoUmbral.toFixed(1)} % bajo 5°) · V4.4=${rMotor.veredictos[1].estado} · V4.6=${rMotor.veredictos[2].estado}`);

  const lamC = M.laminaParticionAngulo(rCrudo);
  check('D2 la lámina lleva la CITA LITERAL del libro y el corte de 5° en pantalla',
    lamC.svg.includes('inclined at least five degrees relative to the mold opening direction')
    && lamC.svg.includes('&lt;5°') && lamC.cita.includes('§4.1.3'),
    `cita = ${lamC.cita}`);
  const recortados = laminas.filter(([, res]) => M.laminaParticionAngulo(res).svg.includes('…')).map(([i]) => i);
  check('D1b ningún texto de la lámina se sale del cuadro (se recorta con "…" y aquí no debe haber ninguno)',
    recortados.length === 0, recortados.length ? `recortan: ${recortados.join(', ')}` : `las ${laminas.length} láminas caben en 1000 px de ancho`);

  const lamS = M.laminaParticionAngulo(rSin);
  check('D3 sin L21 la lámina DICE "SIN CABLEAR" y no presume zona libre',
    lamS.svg.includes('SIN CABLEAR') && lamS.svg.includes('L21 NO conectada'),
    'V4.6 sale con ○ y el pie declara que L21 no está conectada');
  check('D4 la lámina DECLARA la derivación de la superficie (silueta + ancho de falda)',
    lamC.svg.includes('DERIVADA') && rCrudo.origen === 'derivada-silueta' && rCrudo.supuestos.length >= 2,
    `origen=${rCrudo.origen} · ${rCrudo.supuestos.length} supuestos declarados`);

  console.log(`\n  láminas en _laminas/: ${laminas.map(([i]) => i + '.svg').join(' · ')}`);
  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({
    pass: fails === 0, fails,
    umbralDeg: UM,
    errPlanoPerpDeg: +ePerp.toExponential(3),
    errPlano5Deg: +e50.toExponential(3),
    errPlano49Deg: +e49.toExponential(3),
    bezelCrudoPctBajo5: +rCrudo.pctBajoUmbral.toFixed(4),
    bezelCrudoMinPieDeg: +rCrudo.linea.minDeg.toFixed(6),
    bezelModPctBajo5: +rMod.pctBajoUmbral.toFixed(4),
    tazaDesviacionMm: +rCrudo.planaridad.desviacionMm.toFixed(4),
    v46_tazaSupuesta: v46cup.estado, v46_tazaDeclarada: v46f.estado,
    v46_barril: v46b.estado, v46_sinL21: v46s.estado,
  }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 1200)); process.exit(1); });
