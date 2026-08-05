/**
 * GATE L9 — NÚCLEO ESBELTO Y SU DISPOSITIVO DE ENFRIAMIENTO
 * ============================================================================
 * Verifica dos cosas DISTINTAS, y no las confunde:
 *
 *  (A) LA FÍSICA, contra soluciones ANALÍTICAS cerradas — no contra Kazmer.
 *      Reproducir un número del libro sólo prueba que copiamos su fórmula.
 *      Un solver se acepta como se acepta un código de CFD: contra invariantes.
 *        I1  CONDUCCIÓN 1D AXIAL ⇒ perfil LINEAL EXACTO (error de redondeo).
 *        I2  CILINDRO RADIAL     ⇒ perfil LOGARÍTMICO EXACTO, y el ΔT calza con
 *            R = ln(r₂/r₁)/(2πkL) de thermal-resistance.rCyl.
 *        I3  CONSERVACIÓN        ⇒ lo que entra por el plástico sale por el agua.
 *        I4  PIN CONDUCTIVO      ⇒ su resistencia contra la solución cerrada:
 *            (a) todo el calor por la punta:   R = L/(k·A)   [= rPlate]
 *            (b) flujo lateral repartido:      R = L/(2k·A)  (solución 2D exacta
 *                T = (2q''/kR)(Lz − z²/2) + q''r²/(2kR), verificada aparte).
 *        I5  LINEALIDAD          ⇒ duplicar Q̇ duplica (T − T_agua) exactamente.
 *        I6  CONVERGENCIA        ⇒ refinar la malla no cambia el veredicto.
 *        I7  EL 4× DE §9.3.6     ⇒ contra la SERIE DE FOURIER completa por
 *            bisección (autosemejanza de la difusión), no contra Eq 9.5 de un
 *            término ni contra el libro. Y el argumento del espejo ("two layers
 *            on top of each other") contra un transitorio 1D explícito.
 *
 *  (B) LO LITERAL DEL LIBRO — la Tabla 9.3, sus cotas y sus ejemplos, con la
 *      fuente de los rangos (slendercore.ts) cruzada contra los literales de
 *      lamina-nucleo-enfriamiento.ts: si alguien mueve un número en una de las
 *      dos, esto cae.
 *
 *  (C) LA LÁMINA — el par bueno/malo del capítulo (núcleo profundo con agua
 *      SÓLO en la base, Fig 9.11, vs el mismo núcleo con baffle) y que lo no
 *      medido salga "SIN CABLEAR" y no en verde.
 *
 * Uso: node --import tsx scripts/mold-nucleo-enfriamiento-test.cjs
 */
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };
const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', 'mold', p);

(async () => {
  const L9 = await import(R('lamina-nucleo-enfriamiento.ts'));
  const TR = await import(R('thermal-resistance.ts'));
  const SC = await import(R('slendercore.ts'));
  const CL = await import(R('cooling.ts'));
  const res = {};

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n══ A · LA FÍSICA CONTRA SOLUCIONES ANALÍTICAS ══');
  // ══════════════════════════════════════════════════════════════════════

  // ── I1 · CONDUCCIÓN 1D AXIAL: el permanente da un perfil LINEAL EXACTO ──
  // Anillo aislado radialmente; entra q'' por la tapa de arriba y sale la misma
  // potencia por la de abajo. Neumann puro ⇒ se deflacta la constante y se
  // compara la FORMA contra la recta exacta de pendiente q''/k.
  {
    const nr = 9, nz = 40, r0 = 0.005, r1 = 0.015, Lz = 0.05, k = 32, qpp = 4.0e4;
    const m = L9.mallaAxi({ nr, nz, r0, r1, z0: 0, z1: Lz });
    const N = nr * nz;
    const kA = new Float64Array(N).fill(k), qIn = new Float64Array(N);
    const rg = new Float64Array(N), rt = new Float64Array(N);
    for (let i = 0; i < nr; i++) {
      qIn[(nz - 1) * nr + i] = +qpp * m.areaZ[i];      // entra por arriba
      qIn[0 * nr + i] = -qpp * m.areaZ[i];             // sale por abajo
    }
    const s = L9.resolverAxi({ m: m, k: kA, qIn, robinG: rg, robinT: rt });
    const pend = qpp / k;                              // dT/dz exacta (°C/m)
    // recta exacta con media cero sobre las MISMAS celdas
    let mu = 0; for (let j = 0; j < nz; j++) mu += pend * m.zc[j] * nr; mu /= N;
    let errMax = 0, amp = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
      const ex = pend * m.zc[j] - mu;
      errMax = Math.max(errMax, Math.abs(s.T[j * nr + i] - ex));
      amp = Math.max(amp, Math.abs(ex));
    }
    // y de paso: sin gradiente radial impuesto, el flujo radial debe ser CERO
    let qrMax = 0; for (let n = 0; n < N; n++) qrMax = Math.max(qrMax, Math.abs(s.qr[n]));
    res.i1ErrRel = errMax / amp;
    check('I1 conducción 1D axial: el perfil es LINEAL con error de REDONDEO',
      errMax / amp < 1e-12,
      `err máx ${errMax.toExponential(2)} °C sobre ${amp.toFixed(2)} °C = ${(errMax / amp).toExponential(2)} rel · pendiente ${pend.toFixed(3)} °C/m`);
    check('I1b sin gradiente radial impuesto, el flujo radial es CERO (el operador no fuga)',
      qrMax < 1e-6, `|q_r| máx ${qrMax.toExponential(2)} W/m²`);
  }

  // ── I2 · CILINDRO RADIAL: perfil LOGARÍTMICO EXACTO + rCyl ──────────────
  // Corona aislada arriba/abajo; entra Q por la superficie exterior y sale por
  // la interior. T(r) = Q/(2πkL)·ln r + C. Y el ΔT entre los centros extremos
  // debe ser EXACTAMENTE Q·rCyl(r_a, r_b, k, L).
  {
    const nr = 60, nz = 6, r0 = 0.004, r1 = 0.030, Lz = 0.02, k = 32, Q = 900;
    const m = L9.mallaAxi({ nr, nz, r0, r1, z0: 0, z1: Lz });
    const N = nr * nz;
    const kA = new Float64Array(N).fill(k), qIn = new Float64Array(N);
    const rg = new Float64Array(N), rt = new Float64Array(N);
    for (let j = 0; j < nz; j++) { qIn[j * nr + (nr - 1)] = +Q / nz; qIn[j * nr + 0] = -Q / nz; }
    const s = L9.resolverAxi({ m, k: kA, qIn, robinG: rg, robinT: rt });
    const c0 = Q / (2 * Math.PI * k * Lz);
    let mu = 0; for (let i = 0; i < nr; i++) mu += c0 * Math.log(m.rc[i]) * nz; mu /= N;
    let errMax = 0, amp = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
      const ex = c0 * Math.log(m.rc[i]) - mu;
      errMax = Math.max(errMax, Math.abs(s.T[j * nr + i] - ex));
      amp = Math.max(amp, Math.abs(ex));
    }
    const dTmed = s.T[0 * nr + (nr - 1)] - s.T[0 * nr + 0];
    const dTteo = Q * TR.rCyl(m.rc[0], m.rc[nr - 1], k, Lz);
    res.i2ErrRel = errMax / amp;
    res.i2dTErr = Math.abs(dTmed - dTteo) / dTteo;
    check('I2 cilindro con flujo radial: el perfil es LOGARÍTMICO con error de REDONDEO',
      errMax / amp < 1e-12,
      `err máx ${errMax.toExponential(2)} °C sobre ${amp.toFixed(2)} °C = ${(errMax / amp).toExponential(2)} rel`);
    check('I2b el ΔT medido = Q·ln(r₂/r₁)/(2πkL) — la MISMA rCyl de thermal-resistance.ts',
      Math.abs(dTmed - dTteo) / dTteo < 1e-12,
      `medido ${dTmed.toFixed(6)} vs cerrado ${dTteo.toFixed(6)} °C → error ${(Math.abs(dTmed - dTteo) / dTteo).toExponential(2)}`);
  }

  // ── I4 · PIN CONDUCTIVO CONTRA SU SOLUCIÓN CERRADA ──────────────────────
  // (a) todo el calor entra por la PUNTA y sale por la base: R = L/(k·A).
  {
    const nr = 12, nz = 60, Rp = 0.002, Lz = 0.04, k = 259, Q = 20;   // Cu 940
    const A = Math.PI * Rp * Rp;
    const m = L9.mallaAxi({ nr, nz, r0: 0, r1: Rp, z0: 0, z1: Lz });
    const N = nr * nz;
    const kA = new Float64Array(N).fill(k), qIn = new Float64Array(N);
    const rg = new Float64Array(N), rt = new Float64Array(N);
    for (let i = 0; i < nr; i++) { qIn[(nz - 1) * nr + i] = Q * m.areaZ[i] / A; qIn[i] = -Q * m.areaZ[i] / A; }
    const s = L9.resolverAxi({ m, k: kA, qIn, robinG: rg, robinT: rt });
    // extrapolar de centros a caras: ΔT(0→L) = pendiente·L
    const pend = (s.T[(nz - 1) * nr] - s.T[0]) / (m.zc[nz - 1] - m.zc[0]);
    const dTmed = pend * Lz;
    const dTteo = Q * TR.rPlate(Lz, k, A);
    res.i4aErr = Math.abs(dTmed - dTteo) / dTteo;
    check('I4a pin: todo el calor por la punta ⇒ R = L/(k·A) exacto (= rPlate)',
      res.i4aErr < 1e-12,
      `ΔT medido ${dTmed.toFixed(8)} vs cerrado ${dTteo.toFixed(8)} °C → error ${res.i4aErr.toExponential(2)} · R=${TR.rPlate(Lz, k, A).toFixed(4)} K/W`);
  }
  // (b) el pin REAL de Fig 9.26: el calor entra REPARTIDO por la superficie
  //     lateral y sale por la base. Solución 2D exacta (Laplace):
  //        T(r,z) = C + (2q''/(kR))·(Lz − z²/2) + q''·r²/(2kR)
  //     ⇒ el ΔT de medias por sección entre z=L y z=0 es Q·L/(2kA), con Q=q''·2πRL.
  {
    const nr = 14, nz = 70, Rp = 0.002, Lz = 0.04, k = 259, qpp = 3.0e4;
    const A = Math.PI * Rp * Rp, P = 2 * Math.PI * Rp, Q = qpp * P * Lz;
    const m = L9.mallaAxi({ nr, nz, r0: 0, r1: Rp, z0: 0, z1: Lz });
    const N = nr * nz;
    const kA = new Float64Array(N).fill(k), qIn = new Float64Array(N);
    const rg = new Float64Array(N), rt = new Float64Array(N);
    for (let j = 0; j < nz; j++) qIn[j * nr + (nr - 1)] += qpp * 2 * Math.PI * Rp * m.dz;   // entra lateral
    for (let i = 0; i < nr; i++) qIn[i] -= (Q / A) * m.areaZ[i];                             // sale por la base
    const s = L9.resolverAxi({ m, k: kA, qIn, robinG: rg, robinT: rt });
    const media = (j) => { let a = 0, w = 0; for (let i = 0; i < nr; i++) { a += s.T[j * nr + i] * m.areaZ[i]; w += m.areaZ[i]; } return a / w; };
    const dTmed = media(nz - 1) - media(0);
    // exacto entre los CENTROS de las filas extremas (z = L−dz/2 y z = dz/2)
    const Acoef = 2 * qpp / (k * Rp);
    const zt = Lz - m.dz / 2, zb = m.dz / 2;
    const dTteo = Acoef * ((Lz * zt - zt * zt / 2) - (Lz * zb - zb * zb / 2));
    const dTfin = Q * Lz / (2 * k * A);        // la forma cerrada 1D de aleta (sin corrección de celda)
    res.i4bErr = Math.abs(dTmed - dTteo) / Math.abs(dTteo);
    check('I4b pin con flujo lateral repartido: ΔT calza con la solución 2D CERRADA',
      res.i4bErr < 1e-11,
      `medido ${dTmed.toFixed(8)} vs exacto ${dTteo.toFixed(8)} °C → error ${res.i4bErr.toExponential(2)} · forma cerrada L/(2kA) da ${dTfin.toFixed(6)} °C`);
    // y la resistencia efectiva contra L/(2kA)
    const rEfMed = dTmed / Q, rEfTeo = Lz / (2 * k * A);
    check('I4b2 la resistencia efectiva del pin ≈ L/(2·k·A) (el calor recorre media longitud en promedio)',
      Math.abs(rEfMed - rEfTeo) / rEfTeo < 0.02,
      `R_ef ${rEfMed.toFixed(5)} vs L/(2kA) ${rEfTeo.toFixed(5)} K/W → ${(100 * Math.abs(rEfMed - rEfTeo) / rEfTeo).toFixed(2)} % (la diferencia es la media celda del extremo)`);
  }

  // ── I7 · EL 4× DE §9.3.6, CONTRA LA SERIE DE FOURIER COMPLETA ───────────
  // NO se verifica contra Eq 9.5 (un término) ni contra el libro: se busca por
  // bisección el instante en que el CENTRO llega a T_eject con la serie completa
  // (200 términos) para espesor h y para 2h. La autosemejanza de la difusión
  // (t ∝ h²) obliga a que la razón sea 4 EXACTO.
  {
    const mat = CL.ABS_KAZMER;
    const tPara = (hMm) => {
      const h = hMm / 1000;
      let lo = 1e-6, hi = 1e5;
      for (let it = 0; it < 200; it++) {
        const mid = 0.5 * (lo + hi);
        if (CL.centerlineTemperature(h, mid, mat, 200) > mat.tEject) lo = mid; else hi = mid;
      }
      return 0.5 * (lo + hi);
    };
    const t1 = tPara(2.5), t2 = tPara(5.0);
    res.factor4 = t2 / t1;
    check('I7 §9.3.6: el enfriamiento por UN lado (2h) cuesta 4.000× — serie de Fourier, no el libro',
      Math.abs(t2 / t1 - 4) < 1e-9,
      `h=2.5 mm → ${t1.toFixed(4)} s · 2h=5.0 mm → ${t2.toFixed(4)} s · razón ${(t2 / t1).toFixed(10)}`);
    // y la Eq 9.5 del módulo debe dar el mismo 4 (es la misma física, un término)
    const t = L9.tiempoUnSoloLado(2.5, mat);
    check('I7b tiempoUnSoloLado() sustituye 2h en Eq 9.5 y el 4 SALE (no está hardcodeado)',
      Math.abs(t.factor - 4) < 1e-12,
      `${t.dosLadosS.toFixed(3)} s → ${t.unLadoS.toFixed(3)} s = ${t.factor.toFixed(12)}×`);
  }
  // ── I7c · EL ARGUMENTO DEL ESPEJO, verificado con un transitorio 1D ─────
  // Literal: "the temperature distribution is symmetric across the centerline so
  // there is no associated heat flux". Se resuelve una placa de 2h con las dos
  // caras frías y una de h con UNA cara fría y la otra ADIABÁTICA: los perfiles
  // deben coincidir celda a celda en todo tiempo.
  {
    const alpha = 8.69e-8, n = 120, h = 0.0025, T0 = 239, Ts = 60;
    // placa 2h, Dirichlet en ambos extremos, malla de 2n celdas
    const dx = h / n, dt = 0.2 * dx * dx / alpha;
    const A = new Float64Array(2 * n).fill(T0);
    const B = new Float64Array(n).fill(T0);          // placa h, adiabática en x=0
    const paso = (u, dirIzq) => {
      const v = Float64Array.from(u);
      for (let i = 0; i < u.length; i++) {
        const izq = i === 0 ? (dirIzq ? 2 * Ts - u[0] : u[0]) : u[i - 1];     // fantasma
        const der = i === u.length - 1 ? 2 * Ts - u[u.length - 1] : u[i + 1];
        v[i] = u[i] + alpha * dt / (dx * dx) * (izq - 2 * u[i] + der);
      }
      return v;
    };
    let a = A, b = B, tt = 0, errMax = 0, fluxMax = 0;
    for (let s = 0; s < 4000; s++) {
      a = paso(a, true); b = paso(b, false); tt += dt;
      for (let i = 0; i < n; i++) errMax = Math.max(errMax, Math.abs(a[n + i] - b[i]));
      fluxMax = Math.max(fluxMax, Math.abs(a[n] - a[n - 1]));    // salto en el plano central
    }
    res.espejoErr = errMax;
    check('I7c el espejo de §9.3.6: media placa de 2h ≡ placa de h con una cara adiabática',
      errMax < 1e-9,
      `err máx ${errMax.toExponential(2)} °C tras ${tt.toFixed(2)} s · salto en el plano central ${fluxMax.toExponential(2)} °C (flujo nulo por simetría)`);
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n══ B · LO LITERAL: TABLA 9.3 (§9.3.5) ══');
  // ══════════════════════════════════════════════════════════════════════

  // las dos fuentes de la tabla deben describir lo mismo
  {
    const esperado = {
      inserto: ['> 50 mm', '> 25 mm', 'Very high'],
      baffle: ['12–75 mm', '6–25 mm', 'Very high'],
      bubbler: ['6–30 mm', '3–12 mm', 'High'],
      'heat-pipe': ['5–20 mm', '3–12 mm', 'Medium'],
      'pin-conductivo': ['< 5 mm', 'N/A', 'Low'],
    };
    let ok = L9.TABLA_9_3.length === 5 && SC.SLENDER_COOLING.length === 5;
    const det = [];
    for (const f of L9.TABLA_9_3) {
      const e = esperado[f.method], r = L9.rangoDe(f.method);
      const litOk = f.coreLiteral === e[0] && f.holeLiteral === e[1] && f.rateLiteral === e[2];
      // los números de slendercore.ts deben decir lo mismo que el literal
      const nums = { inserto: [50, 1e9, 25, 1e9], baffle: [12, 75, 6, 25], bubbler: [6, 30, 3, 12], 'heat-pipe': [5, 20, 3, 12], 'pin-conductivo': [0, 5, 0, 0] }[f.method];
      const numOk = r.coreMinMm === nums[0] && r.coreMaxMm === nums[1] && r.holeMinMm === nums[2] && r.holeMaxMm === nums[3];
      if (!litOk || !numOk) { ok = false; det.push(`${f.method}${litOk ? '' : ' LIT'}${numOk ? '' : ' NUM'}`); }
    }
    check('B1 Tabla 9.3 LITERAL y los rangos de slendercore.ts describen la MISMA tabla',
      ok, ok ? '5 filas · literales y números cruzados' : `discrepan: ${det.join(', ')}`);
  }

  // barrido: la elección siempre es admisible y es la de mayor preferencia literal
  {
    let malAdmisible = 0, malPreferencia = 0, sinFila = [];
    for (let d = 0.5; d <= 120; d += 0.1) {
      const dd = +d.toFixed(1);
      const s = L9.seleccionTabla93({ coreDiaMm: dd });
      if (!s.fila) { sinFila.push(dd); continue; }
      if (!L9.filaAdmiteCore(s.method, dd)) malAdmisible++;
      const iSel = L9.PREFERENCIA_LITERAL.indexOf(s.method);
      for (const c of s.candidatos) if (L9.PREFERENCIA_LITERAL.indexOf(c.method) < iSel) malPreferencia++;
    }
    res.sinFila = sinFila.length;
    check('B2 barrido Ø 0.5–120 mm: la fila elegida SIEMPRE admite el Ø y es la de mayor preferencia literal',
      malAdmisible === 0 && malPreferencia === 0,
      `${malAdmisible} inadmisibles · ${malPreferencia} mal desempatadas · ${sinFila.length} Ø sin fila (huecos reales de la Tabla 9.3)`);
    // el hueco REAL de la tabla: no hay fila para 75 < Ø ≤ ... ni ninguna otra? se declara
    check('B2b los Ø sin fila se DECLARAN fuera de la Tabla 9.3 (no se les inventa dispositivo)',
      sinFila.every((d) => L9.seleccionTabla93({ coreDiaMm: d }).fueraDeTabla === true),
      sinFila.length ? `Ø sin fila: ${sinFila[0]}…${sinFila[sinFila.length - 1]} mm` : 'la tabla cubre todo el barrido');
  }

  // los ejemplos LITERALES del libro
  {
    const cup = L9.seleccionTabla93({ coreDiaMm: 60, holeDiaMm: 12 });     // Fig 9.21
    check('B3 Fig 9.21 LITERAL: baffle de 12 mm en núcleo de 60 mm ⇒ fila Baffle y cumple la tabla',
      cup.method === 'baffle' && cup.cumpleCore && cup.cumpleHole === true && cup.cumpleCotaExtra === true,
      `${cup.method} · core ${cup.cumpleCore} · hole ${cup.cumpleHole} · cota 6.35 ${cup.cumpleCotaExtra}`);
    const chico = L9.seleccionTabla93({ coreDiaMm: 20, holeDiaMm: 6.2 });
    check('B3b §9.3.5.2 "diameter greater than 6.35 mm (1/4 inch)": un baffle de 6.2 mm SE RECHAZA',
      chico.method === 'baffle' && chico.cumpleHole === true && chico.cumpleCotaExtra === false,
      `hole en rango de tabla (6–25) = ${chico.cumpleHole} pero cota 6.35 = ${chico.cumpleCotaExtra} ⇒ ${chico.mensajes.find((m) => m.includes('6.35')) ? 'bajar a bubbler' : '—'}`);
    const casos = [[90, 'inserto'], [60, 'baffle'], [20, 'baffle'], [8, 'bubbler'], [5.5, 'heat-pipe'], [4, 'pin-conductivo']];
    const malos = casos.filter(([d, m]) => L9.seleccionTabla93({ coreDiaMm: d }).method !== m);
    check('B4 los cinco dispositivos salen por Ø según la Tabla 9.3',
      malos.length === 0, malos.length ? `fallan ${JSON.stringify(malos)}` : casos.map(([d, m]) => `Ø${d}→${m}`).join(' · '));
    // y coincide con el motor que ya existía
    const desacuerdo = [];
    for (let d = 1; d <= 100; d += 0.5) {
      const a = L9.seleccionTabla93({ coreDiaMm: d }).method;
      const b = SC.chooseSlenderCoreCooling(d, d * 4).method;
      if (a && a !== b) desacuerdo.push(d);
    }
    check('B5 la selección literal coincide con chooseSlenderCoreCooling() de slendercore.ts',
      desacuerdo.length === 0, desacuerdo.length ? `discrepan en Ø ${desacuerdo.slice(0, 8).join(', ')} mm` : 'acuerdo en todo el barrido 1–100 mm');
    // el pin no tiene barreno: la columna dice N/A y así se reporta
    const pin = L9.seleccionTabla93({ coreDiaMm: 3 });
    check('B6 "Conductive pin · Hole diameter N/A": no se le inventa un barreno',
      pin.method === 'pin-conductivo' && pin.cumpleHole === 'N/A' && L9.rangoDe('pin-conductivo').holeMaxMm === 0,
      `cumpleHole=${pin.cumpleHole}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n══ C · EL CAMPO DEL NÚCLEO: RADIAL vs AXIAL (V9.18) ══');
  // ══════════════════════════════════════════════════════════════════════

  // Q̇ del disparo por el balance del polímero (Eq 9.10) — no un número inventado
  const qCup = TR.heatToExtractW({
    nCav: 1, volCcPerCav: Math.PI * 30 * 30 * 58 / 1000 - Math.PI * 27.5 * 27.5 * 55.5 / 1000,
    rhoMeltKgM3: 940, cpJkgC: 1900, tMeltC: 239, tEjectC: 97.6, cycleS: 30,
  });
  const BASE = {
    coreHeightMm: 58, paredPlasticoMm: 2.5, aceroCavidadMm: 14,
    kCoreWmK: 32, kPlasticoWmK: 0.19, kCavidadWmK: 32,
    hCoolant: 3000, tCoolantC: 60, qTotalW: qCup,
  };
  // (1) el MALO del capítulo: núcleo profundo, agua SÓLO en la base (Fig 9.11)
  const malo = L9.campoNucleo({ ...BASE, coreDiaMm: 60, boreDiaMm: 0, baseEnfriada: true });
  // (2) el BUENO: el mismo núcleo con el baffle de 12 mm de la Fig 9.21
  const bueno = L9.campoNucleo({ ...BASE, coreDiaMm: 60, boreDiaMm: 12, baseEnfriada: false });
  // (3) el pin conductivo esbelto de §9.3.5.5 (Cu 940, L/Ø = 10)
  const pin = L9.campoNucleo({
    ...BASE, coreDiaMm: 4, coreHeightMm: 40, boreDiaMm: 0, baseEnfriada: true,
    kCoreWmK: 259, aceroCavidadMm: 10, qTotalW: qCup * 0.02,
  });

  check('I3 CONSERVACIÓN: lo que entra por el plástico sale por el agua (los 3 casos)',
    [malo, bueno, pin].every((c) => c.sol.errBalanceRel < 1e-9),
    [malo, bueno, pin].map((c) => c.sol.errBalanceRel.toExponential(1)).join(' · ') + ' de error relativo');
  res.balance = Math.max(malo.sol.errBalanceRel, bueno.sol.errBalanceRel, pin.sol.errBalanceRel);

  // I5 · LINEALIDAD: duplicar Q̇ duplica el salto sobre el agua, exacto
  {
    const doble = L9.campoNucleo({ ...BASE, coreDiaMm: 60, boreDiaMm: 12, baseEnfriada: false, qTotalW: qCup * 2 });
    let errMax = 0;
    for (let n = 0; n < bueno.sol.T.length; n++) {
      const a = 2 * (bueno.sol.T[n] - BASE.tCoolantC), b = doble.sol.T[n] - BASE.tCoolantC;
      errMax = Math.max(errMax, Math.abs(a - b) / Math.max(1e-9, Math.abs(a)));
    }
    res.linealidad = errMax;
    check('I5 LINEALIDAD: 2·Q̇ ⇒ 2·(T − T_agua) celda a celda',
      errMax < 1e-8, `error relativo máx ${errMax.toExponential(2)}`);
  }

  // I6 · CONVERGENCIA: refinar la malla no cambia el veredicto
  {
    const fino = L9.campoNucleo({ ...BASE, coreDiaMm: 60, boreDiaMm: 12, baseEnfriada: false, nr: 168, nz: 264 });
    const dFrac = Math.abs(fino.fracNucleo - bueno.fracNucleo);
    const dGrad = Math.abs(fino.dTBasePuntaC - bueno.dTBasePuntaC);
    res.convFrac = dFrac; res.convGrad = dGrad;
    check('I6 CONVERGENCIA: duplicar la malla no mueve el reparto ni el gradiente',
      dFrac < 0.02 && dGrad < 0.5 && fino.dominante === bueno.dominante,
      `Δfracción ${dFrac.toExponential(2)} · ΔΔT ${dGrad.toFixed(3)} °C · dominante ${bueno.dominante}→${fino.dominante}`);
  }

  // V9.18 · el contraste que pide la ficha
  console.log(`\n  núcleo Ø60 SIN barreno (Fig 9.11): |q_r| ${(malo.qrMedio / 1e3).toFixed(1)} · |q_z| ${(malo.qzMedio / 1e3).toFixed(1)} kW/m² → ${malo.dominante} · ΔT base→punta ${malo.dTBasePuntaC.toFixed(2)} °C · el núcleo se lleva ${(100 * malo.fracNucleo).toFixed(1)} %`);
  console.log(`  núcleo Ø60 con BAFFLE Ø12 (Fig 9.21): |q_r| ${(bueno.qrMedio / 1e3).toFixed(1)} · |q_z| ${(bueno.qzMedio / 1e3).toFixed(1)} kW/m² → ${bueno.dominante} · ΔT base→punta ${bueno.dTBasePuntaC.toFixed(2)} °C · el núcleo se lleva ${(100 * bueno.fracNucleo).toFixed(1)} %`);
  console.log(`  pin conductivo Cu Ø4 L/Ø=10 (§9.3.5.5): |q_r| ${(pin.qrMedio / 1e3).toFixed(1)} · |q_z| ${(pin.qzMedio / 1e3).toFixed(1)} kW/m² → ${pin.dominante} · el pin se lleva ${(100 * pin.fracNucleo).toFixed(1)} %`);

  check('V9.18 con BAFFLE el flujo dentro del núcleo es RADIAL (sale por el barreno)',
    bueno.dominante === 'radial' && bueno.qrMedio > bueno.qzMedio,
    `|q_r|/|q_z| = ${(bueno.qrMedio / bueno.qzMedio).toFixed(2)}`);
  check('V9.18 sin barreno, el mismo núcleo manda el calor AXIAL hacia el agua de la base',
    malo.dominante === 'axial' && malo.qzMedio > malo.qrMedio,
    `|q_z|/|q_r| = ${(malo.qzMedio / malo.qrMedio).toFixed(2)} — "heat transfer around the centerline of the pin towards the coolant at its base"`);
  check('V9.8/§9.2.7 el par bueno/malo: el baffle BAJA el ΔT base→punta del núcleo',
    Math.abs(bueno.dTBasePuntaC) < Math.abs(malo.dTBasePuntaC),
    `sin barreno ${malo.dTBasePuntaC.toFixed(2)} °C → con baffle ${bueno.dTBasePuntaC.toFixed(2)} °C (el libro reprueba su ejemplo a 6 °C)`);
  check('V9.3 el baffle también empareja las flechas sobre la superficie del núcleo (CV menor)',
    bueno.supCV < malo.supCV,
    `CV sin barreno ${malo.supCV.toFixed(3)} → con baffle ${bueno.supCV.toFixed(3)} — Kazmer juzga "qué tan parejas se ven las flechas"`);
  check('§9.3.5.5 el pin esbelto AÍSLA: se lleva una fracción marginal del calor',
    pin.fracNucleo < 0.15,
    `el pin extrae ${(100 * pin.fracNucleo).toFixed(1)} % y la cavidad ${(100 * pin.fracCavidad).toFixed(1)} % ⇒ "act primarily as insulators", flujo de UN solo lado (§9.3.6)`);
  res.fracBaffle = +bueno.fracNucleo.toFixed(4);
  res.fracPin = +pin.fracNucleo.toFixed(4);
  res.dTMalo = +malo.dTBasePuntaC.toFixed(2);
  res.dTBueno = +bueno.dTBasePuntaC.toFixed(2);

  // la forma cerrada explica el aislamiento SIN resolver el campo
  {
    const rp = L9.resistenciasNucleo({ coreDiaMm: 4, boreDiaMm: 0, alturaMm: 40, kWmK: 259 });
    const rb = L9.resistenciasNucleo({ coreDiaMm: 60, boreDiaMm: 12, alturaMm: 58, kWmK: 32 });
    check('la forma cerrada lo anticipa: R_axial del pin ≫ R_radial del núcleo con baffle',
      rp.axialKW > 50 * rb.radialKW,
      `pin R_ax ${rp.axialKW.toFixed(2)} K/W (L/Ø ${rp.ld}) vs baffle R_rad ${rb.radialKW.toFixed(4)} K/W → ${(rp.axialKW / rb.radialKW).toFixed(0)}×`);
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n══ D · LA LÁMINA ══');
  // ══════════════════════════════════════════════════════════════════════
  const outDir = path.resolve(__dirname, '..', '_laminas');
  fs.mkdirSync(outDir, { recursive: true });
  const mat = CL.ABS_KAZMER;

  const lamBueno = L9.laminaNucleoEnfriamiento({
    nombre: 'cup del libro — núcleo Ø60 × 58 mm con baffle Ø12 (Fig 9.21)',
    coreDiaMm: 60, coreHeightMm: 58, boreDiaMm: 12, paredPlasticoMm: 2.5, aceroCavidadMm: 14,
    campo: bueno, material: mat, estructura: { meltPressureMPa: 60, metalKey: 'P20' },
  });
  const lamMalo = L9.laminaNucleoEnfriamiento({
    nombre: 'MALO — núcleo Ø60 × 58 mm SIN barreno, agua sólo en la base (Fig 9.11)',
    coreDiaMm: 60, coreHeightMm: 58, boreDiaMm: 0, paredPlasticoMm: 2.5, aceroCavidadMm: 14,
    campo: malo, material: mat, estructura: { meltPressureMPa: 60, metalKey: 'P20' },
  });
  const lamPin = L9.laminaNucleoEnfriamiento({
    nombre: 'pin conductivo Cu 940 Ø4 × 40 mm (§9.3.5.5 — "act primarily as insulators")',
    coreDiaMm: 4, coreHeightMm: 40, boreDiaMm: 0, paredPlasticoMm: 1.5, aceroCavidadMm: 10,
    kNucleoWmK: 259, campo: pin, material: mat, estructura: { meltPressureMPa: 60, metalKey: 'P20' },
  });
  const lamSin = L9.laminaNucleoEnfriamiento({
    nombre: 'sin motor térmico ni presión — debe declararse SIN CABLEAR',
    coreDiaMm: 20, coreHeightMm: 120, paredPlasticoMm: 2, aceroCavidadMm: 10,
  });
  for (const [id, l] of [['bueno', lamBueno], ['malo', lamMalo], ['pin', lamPin], ['sincablear', lamSin]]) {
    fs.writeFileSync(path.join(outDir, `L9-${id}.svg`), l.svg);
  }

  check('D1 la lámina ACOTA el Ø del núcleo y el Ø del barreno',
    lamBueno.svg.includes('Ø 60.0') && lamBueno.svg.includes('Ø 12.0') && lamBueno.svg.includes('H 58'),
    'cotas Ø 60.0 · Ø 12.0 · H 58 presentes en el SVG');
  check('D2 la lámina imprime la Tabla 9.3 completa con la fila elegida marcada',
    ['Cooling insert', 'Baffle', 'Bubbler', 'Heat pipe', 'Conductive pin'].every((s) => lamBueno.svg.includes(s))
    && lamBueno.svg.includes('▶ Baffle') && lamBueno.svg.includes('§9.3.5.2'),
    '5 filas + "▶ Baffle" + §9.3.5.2');
  check('D3 la lámina dibuja glifos de flujo de calor (V9.3) y los distingue radial/axial (V9.18)',
    (lamBueno.svg.match(/#6db3f2/g) || []).length > 10 && lamBueno.svg.includes('RADIAL'),
    `${(lamBueno.svg.match(/#6db3f2/g) || []).length} trazos azules (radial) · ${(lamMalo.svg.match(/#ffb347/g) || []).length} ámbar (axial) en el MALO`);
  check('D4 el pin sin barreno NO dibuja cota de barreno y sí el agua detrás del pin (§9.3.5.5)',
    !lamPin.svg.includes('Ø 0.0') && lamPin.svg.includes('agua DETRÁS del pin'),
    'sin Ø de barreno inventado');
  // D5 · lo NO medido no cuenta como cumplido. El criterio fino: ningún texto en
  // VERDE puede decir "SIN CABLEAR", cada declaración va en ámbar, y el veredicto
  // final no puede ser verde si falta un bloque. (Lo que SÍ se midió — la Tabla
  // 9.3 — sí tiene derecho a su verde: por eso no se exige "cero verdes".)
  {
    const verdes = [...lamSin.svg.matchAll(/class="ok"[^>]*>([^<]*)</g)].map((m) => m[1]);
    const declaraciones = [...lamSin.svg.matchAll(/<text[^>]*class="(\w+)"[^>]*>([^<]*SIN CABLEAR[^<]*)</g)]
      .filter((m) => !m[2].startsWith('sin motor'));
    const enWarn = declaraciones.filter((m) => m[1] === 'warn');
    const veredicto = /<text class="(\w+)"[^>]*>[^<]*campo SIN CABLEAR/.exec(lamSin.svg);
    check('D5 lo NO medido sale "SIN CABLEAR" en ámbar, nunca en verde, y tumba el veredicto',
      verdes.every((v) => !v.includes('SIN CABLEAR')) && enWarn.length >= 3
      && veredicto && veredicto[1] !== 'ok',
      `${declaraciones.length} declaraciones (${enWarn.length} en ámbar) · veredicto class="${veredicto ? veredicto[1] : '—'}" · verdes: ${verdes.length} (${verdes.map((v) => v.slice(0, 28)).join(' | ') || 'ninguno'})`);
  }
  // D4b · LO QUE LA TABLA PIDE ≠ LO QUE ESTÁ DIBUJADO. Un núcleo Ø60 MACIZO no
  // "lleva baffle" porque la Tabla 9.3 diga que le tocaría uno. Lo cazó el ojo
  // en el PNG: el MALO se titulaba "Baffle" y remataba con un ✓ verde.
  check('D4b el núcleo macizo se declara SIN DISPOSITIVO y NO se apunta el ✓ de la Tabla 9.3',
    lamMalo.svg.includes('SIN DISPOSITIVO') && lamMalo.svg.includes('el núcleo va MACIZO')
    && !/class="ok"[^>]*>✓ dispositivo correcto/.test(lamMalo.svg)
    && /✗ SIN DISPOSITIVO — la Tabla 9.3 pide Baffle/.test(lamMalo.svg)
    && lamBueno.svg.includes('▶ Baffle') && lamMalo.svg.includes('✗ Baffle'),
    'el MALO marca la fila Baffle en ROJO con ✗; sólo el BUENO se la apunta en verde');

  check('D6 V12.14 §12.2.7: la lámina imprime el supuesto conservador (el inserto NO sostiene)',
    lamBueno.svg.includes('provides no support') && lamBueno.svg.includes('§12.2.7'),
    'literal "assuming that the cooling insert provides no support"');
  check('D7 §9.3.6: la lámina imprime el 4× calculado, no citado',
    /= 4\.000×/.test(lamBueno.svg), (lamBueno.svg.match(/= [0-9.]+×/) || ['—'])[0]);
  check('D8 la EXTENSIÓN del Ø de barreno propuesto va DECLARADA en la lámina',
    lamBueno.svg.includes('EXTENSIÓN DECLARADA'), 'el libro da rangos y un ejemplo, no una fórmula');

  console.log(`\n  láminas en _laminas/L9-bueno.svg · L9-malo.svg · L9-pin.svg · L9-sincablear.svg`);
  console.log(`  Q̇ del cup por Eq 9.10 = ${qCup.toFixed(1)} W · malla ${bueno.sol.m.nr}×${bueno.sol.m.nz} · ${bueno.sol.iters} iteraciones CG`);

  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: fails === 0, fails, ...res }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 1200)); process.exit(1); });
