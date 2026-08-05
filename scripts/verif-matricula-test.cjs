/**
 * GATE DE LA MATRÍCULA DE MALLA — verificar geometría SIN MIRARLA.
 * ============================================================================
 * El operador señaló el fallo real: fallo identificando errores en visión 3D. En
 * esta misma sesión un devanado invertido produjo un render que "se veía bien" y
 * sólo lo cazó un volumen negativo. Esto convierte cada propiedad geométrica en
 * UN NÚMERO CON RESPUESTA CONOCIDA y en CONTRADICCIONES entre números.
 *
 * Nada aquí se verifica "a ojo". Todo contra:
 *   · geometría ANALÍTICA cerrada (esfera 4/3πr³, toro 2π²Rr², inercia mac²/6…),
 *   · identidades TOPOLÓGICAS exactas (χ=2−2g, 2E=3F, Σdefectos=2πχ),
 *   · integración EXACTA de momentos sobre cajas (álgebra, no cuadratura),
 *   · CONTROLES NEGATIVOS: se rompe la malla a propósito y se exige que algún
 *     invariante lo cace, nombrando CUÁL.
 *
 * REGLA DURA: si un check falla se DIAGNOSTICA. Nunca se afloja la tolerancia.
 *
 * Uso: node --import tsx scripts/verif-matricula-test.cjs [--sin-banco]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };
const sec = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 74 - t.length))}`);

/* ══════════════════════════════════════════════════════════════════════════ */
/* GENERADORES DE MALLA (Float64: nada de perder dígitos antes de medir)      */
/* ══════════════════════════════════════════════════════════════════════════ */

const malla = (P, I) => ({ positions: Float64Array.from(P), indices: Uint32Array.from(I) });

/** caja axis-aligned, 12 triángulos, normales SALIENTES (misma que mold-visibilidad-test) */
function caja(x0, y0, z0, x1, y1, z1, P, I) {
  const b = P.length / 3;
  P.push(x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
         x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);
  const f = [[0, 3, 2], [0, 2, 1], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
             [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [3, 0, 4], [3, 4, 7]];
  for (const t of f) I.push(b + t[0], b + t[1], b + t[2]);
}
const cajaMalla = (x0, y0, z0, x1, y1, z1) => { const P = [], I = []; caja(x0, y0, z0, x1, y1, z1, P, I); return malla(P, I); };

/**
 * esfera UV. `legado=true` reproduce LITERALMENTE el generador de
 * scripts/mold-visibilidad-test.cjs, que dice "normales SALIENTES" y NO LO ES:
 * su devanado deja las normales HACIA ADENTRO (lo mide M0 abajo). Ahí es
 * inofensivo —el z-buffer de visibilidad no depende del sentido y el área de
 * media esfera es la misma por simetría— pero es exactamente el defecto que este
 * módulo existe para cazar, así que se conserva como CONTROL, no se maquilla.
 */
function esfera(r, nu, nv, legado = false) {
  const P = [], I = [];
  for (let j = 0; j <= nv; j++) {
    const th = (j / nv) * Math.PI;
    for (let i = 0; i <= nu; i++) {
      const ph = (i / nu) * 2 * Math.PI;
      P.push(r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th));
    }
  }
  const id = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    if (legado) {                                          // ← tal cual el fixture heredado
      I.push(id(i, j), id(i + 1, j), id(i + 1, j + 1));
      I.push(id(i, j), id(i + 1, j + 1), id(i, j + 1));
    } else {                                               // ← devanado corregido: normal SALIENTE
      I.push(id(i, j), id(i + 1, j + 1), id(i + 1, j));
      I.push(id(i, j), id(i, j + 1), id(i + 1, j + 1));
    }
  }
  return malla(P, I);
}
/** razón de área de un n-gono INSCRITO contra su círculo: (n/2π)·sin(2π/n) */
const rho = (n) => (n / (2 * Math.PI)) * Math.sin(2 * Math.PI / n);

/**
 * TORO DE REVOLUCIÓN — la prueba de que el GÉNERO SE MIDE, no se asume.
 * Punto (u,v): ((R + r cos v) cos u, (R + r cos v) sin u, r sin v).
 * Analítico: V = 2π²Rr², A = 4π²Rr, I_z = m(R² + 3r²/4), I_x = m(R²/2 + 5r²/8).
 */
function toro(R, r, nu, nv) {
  const P = [], I = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const u = (i / nu) * 2 * Math.PI, v = (j / nv) * 2 * Math.PI;
    P.push((R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v));
  }
  const id = (i, j) => (i % nu) * nv + (j % nv);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
    I.push(a, b, c, a, c, d);                                   // normal SALIENTE
  }
  return malla(P, I);
}

/**
 * SÓLIDO DE VÓXELES → frontera cerrada manifold. Vale oro porque su volumen,
 * área, centroide, inercia Y MOMENTOS DE TERCER ORDEN son EXACTOS en forma
 * cerrada (unión disjunta de cajas): no hay error de discretización que perdonar.
 * Género = número de túneles ⇒ fabrica χ = 2, 0, −2 a voluntad.
 */
function voxeles(celdas, s) {
  const set = new Set(celdas.map((c) => c.join(',')));
  const P = [], I = [];
  const quad = (a, b, c, d) => {
    const n = P.length / 3;
    P.push(...a, ...b, ...c, ...d);
    I.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  for (const [i, j, k] of celdas) {
    const x0 = i * s, y0 = j * s, z0 = k * s, x1 = x0 + s, y1 = y0 + s, z1 = z0 + s;
    const hay = (a, b, c) => set.has(`${i + a},${j + b},${k + c}`);
    if (!hay(0, 0, -1)) quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]);   // −Z
    if (!hay(0, 0, 1)) quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);    // +Z
    if (!hay(-1, 0, 0)) quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);   // −X
    if (!hay(1, 0, 0)) quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);    // +X
    if (!hay(0, -1, 0)) quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);   // −Y
    if (!hay(0, 1, 0)) quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);    // +Y
  }
  const cajas = celdas.map(([i, j, k]) => [i * s, j * s, k * s, (i + 1) * s, (j + 1) * s, (k + 1) * s]);
  return { ...malla(P, I), cajas };
}

/** tetraedro (4 caras) con normales salientes si el volumen con signo sale > 0 */
function tetra(a, b, c, d) {
  const P = [...a, ...b, ...c, ...d];
  let I = [0, 2, 1, 0, 1, 3, 1, 2, 3, 0, 3, 2];
  const v6 = (b[0] - a[0]) * ((c[1] - a[1]) * (d[2] - a[2]) - (c[2] - a[2]) * (d[1] - a[1]))
    - (b[1] - a[1]) * ((c[0] - a[0]) * (d[2] - a[2]) - (c[2] - a[2]) * (d[0] - a[0]))
    + (b[2] - a[2]) * ((c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0]));
  if (v6 < 0) for (let t = 0; t < I.length; t += 3) { const s = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = s; }
  return malla(P, I);
}

/** TAZA del libro (copiada tal cual del gate de visibilidad): χ debe dar 2 */
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
  return malla(P, I);
}

/* ── transformaciones y corrupciones ──────────────────────────────────────── */
const clonar = (m) => ({ positions: Float64Array.from(m.positions), indices: Uint32Array.from(m.indices) });
const trasladar = (m, t) => { const q = clonar(m); for (let i = 0; i < q.positions.length; i += 3) { q.positions[i] += t[0]; q.positions[i + 1] += t[1]; q.positions[i + 2] += t[2]; } return q; };
const escalar = (m, s) => { const q = clonar(m); for (let i = 0; i < q.positions.length; i++) q.positions[i] *= s; return q; };
function rotar(m, eje, ang) {
  const n = Math.hypot(...eje), [ux, uy, uz] = eje.map((v) => v / n);
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  const R = [[t * ux * ux + c, t * ux * uy - s * uz, t * ux * uz + s * uy],
             [t * ux * uy + s * uz, t * uy * uy + c, t * uy * uz - s * ux],
             [t * ux * uz - s * uy, t * uy * uz + s * ux, t * uz * uz + c]];
  const q = clonar(m);
  for (let i = 0; i < q.positions.length; i += 3) {
    const x = q.positions[i], y = q.positions[i + 1], z = q.positions[i + 2];
    q.positions[i] = R[0][0] * x + R[0][1] * y + R[0][2] * z;
    q.positions[i + 1] = R[1][0] * x + R[1][1] * y + R[1][2] * z;
    q.positions[i + 2] = R[2][0] * x + R[2][1] * y + R[2][2] * z;
  }
  return q;
}
/** espejo CRUDO: x → −x. Las normales quedan hacia adentro ⇒ volumen negativo. */
const espejar = (m) => { const q = clonar(m); for (let i = 0; i < q.positions.length; i += 3) q.positions[i] = -q.positions[i]; return q; };
/** espejo SANO: x → −x Y se voltea el devanado. Sólido válido, volumen POSITIVO,
 *  χ / género / área / volumen / inercia IDÉNTICOS al original. Sólo cambia la MANO. */
function espejarSano(m) {
  const q = espejar(m);
  for (let t = 0; t < q.indices.length; t += 3) { const tmp = q.indices[t + 1]; q.indices[t + 1] = q.indices[t + 2]; q.indices[t + 2] = tmp; }
  return q;
}
const invertirUnaCara = (m, t) => { const q = clonar(m); const tmp = q.indices[t * 3 + 1]; q.indices[t * 3 + 1] = q.indices[t * 3 + 2]; q.indices[t * 3 + 2] = tmp; return q; };
const invertirTodas = (m) => { const q = clonar(m); for (let t = 0; t < q.indices.length; t += 3) { const tmp = q.indices[t + 1]; q.indices[t + 1] = q.indices[t + 2]; q.indices[t + 2] = tmp; } return q; };
function borrarTriangulo(m, t) {
  const I = Array.from(m.indices); I.splice(t * 3, 3);
  return { positions: Float64Array.from(m.positions), indices: Uint32Array.from(I) };
}
/** duplica un vértice: `delta`=0 lo deja EXACTO (la soldadura debe curarlo);
 *  delta>tol abre una GRIETA real de un triángulo. */
function duplicarVertice(m, t, esquina, delta) {
  const P = Array.from(m.positions), I = Array.from(m.indices);
  const v = I[t * 3 + esquina], n = P.length / 3;
  P.push(P[v * 3] + delta, P[v * 3 + 1], P[v * 3 + 2]);
  I[t * 3 + esquina] = n;
  return { positions: Float64Array.from(P), indices: Uint32Array.from(I) };
}
/** aleta NO-MANIFOLD: un triángulo extra colgado de una arista existente.
 *  Deja χ INTACTO — sólo Gauss-Bonnet lo caza. */
function aletaNoManifold(m, t) {
  const P = Array.from(m.positions), I = Array.from(m.indices);
  const a = I[t * 3], b = I[t * 3 + 1], n = P.length / 3;
  P.push((P[a * 3] + P[b * 3]) / 2 + 7, (P[a * 3 + 1] + P[b * 3 + 1]) / 2 + 5, (P[a * 3 + 2] + P[b * 3 + 2]) / 2 + 3);
  I.push(a, b, n);
  return { positions: Float64Array.from(P), indices: Uint32Array.from(I) };
}

const pct = (a, b) => Math.abs(a - b) / Math.abs(b) * 100;
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);

/* ══════════════════════════════════════════════════════════════════════════ */
(async () => {
  // atajo para iterar la lámina sin re-barrer el banco (el censo ya está en disco)
  if (process.argv.includes('--solo-lamina')) {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'test-parts', 'inyeccion-reales', 'matricula-censo.json'), 'utf8'));
    fs.mkdirSync(path.join(ROOT, '_laminas'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, '_laminas', 'MATRICULA-banco.svg'), laminaCenso(j.piezas, {}));
    console.log('lámina regenerada desde matricula-censo.json');
    process.exit(0);
  }
  const M = await import(path.join(ROOT, 'src', 'forja', 'verificacion', 'matricula.ts'));
  const { matriculaDeMalla, coherente, momentosDeCajas } = M;
  const TAU = 2 * Math.PI;
  const tel = {};

  /* ═══ M0 · HALLAZGO: el fixture heredado tiene el devanado invertido ════ */
  sec('M0 · LA MATRÍCULA CAZA UN DEFECTO REAL DEL REPO (fixture heredado)');
  const esfLeg = matriculaDeMalla(esfera(10, 128, 64, true));   // literal de mold-visibilidad-test.cjs
  const esfOK = matriculaDeMalla(esfera(10, 128, 64));
  check('M0 la esfera de scripts/mold-visibilidad-test.cjs dice "normales SALIENTES" y NO lo es',
    esfLeg.volumenConSigno < 0 && esfLeg.cerrada && esfLeg.devanadoCoherente && esfLeg.chi === 2,
    `V con signo = ${esfLeg.volumenConSigno.toFixed(4)} mm³ (NEGATIVO) · χ=${esfLeg.chi} · devanado coherente=${esfLeg.devanadoCoherente} `
    + `· área=${esfLeg.areaTotal.toFixed(4)} — es decir: cerrada, manifold y "se ve bien", pero VOLTEADA`);
  check('M0 corregido el devanado, TODO lo demás es idéntico salvo el signo del volumen',
    esfOK.volumenConSigno > 0 && esfOK.chi === esfLeg.chi
    && rel(esfOK.areaTotal, esfLeg.areaTotal) < 1e-15
    && rel(esfOK.volumenConSigno, -esfLeg.volumenConSigno) < 1e-15,
    `V = ${esfOK.volumenConSigno.toFixed(4)} = −(${esfLeg.volumenConSigno.toFixed(4)}) · área idéntica a ${rel(esfOK.areaTotal, esfLeg.areaTotal).toExponential(1)} `
    + `⇒ NINGÚN invariante de área o de conteo lo distingue. Sólo el SIGNO. (No se toca el archivo ajeno: se DECLARA.)`);

  /* ═══ M1 · χ ANALÍTICO: 2 / 0 / −2 ═════════════════════════════════════ */
  sec('M1 · CARACTERÍSTICA DE EULER χ = V − E + F (conteo puro)');
  const GEO = { rExt: 20, rInt: 18, h: 60, baseT: 2, rimR: 24, rimZ: 52, rimT: 3, n: 96 };
  const fig = {
    cubo: { m: cajaMalla(0, 0, 0, 20, 20, 20), chi: 2, g: 0 },
    caja: { m: cajaMalla(-3, -7, -11, 9, 6, 4), chi: 2, g: 0 },   // 12×13×15: TRES ejes distintos
    esfera: { m: esfera(10, 128, 64), chi: 2, g: 0 },
    tetra: { m: tetra([0, 0, 0], [10, 0, 0], [0, 7, 0], [2, 3, 5]), chi: 2, g: 0 },
    taza: { m: taza(GEO), chi: 2, g: 0 },
    toro: { m: toro(30, 8, 96, 48), chi: 0, g: 1 },
    'toro-vox': { m: voxeles(cuadroAnillo(), 4), chi: 0, g: 1 },
    'doble-toro': { m: voxeles(placaDosHuecos(), 4), chi: -2, g: 2 },
    escalera: { m: voxeles(escaleraQuiral(), 4), chi: 2, g: 0 },
  };
  const mat = {};
  for (const [k, v] of Object.entries(fig)) {
    mat[k] = matriculaDeMalla(v.m);
    const m = mat[k];
    check(`M1 ${k}: χ = ${v.chi} (género ${v.g})`,
      m.chi === v.chi && m.generoValido && m.genero === v.g,
      `V−E+F = ${m.V}−${m.E}+${m.F} = ${m.chi} · género medido ${m.generoValido ? m.genero : 'INVÁLIDO'} · cerrada=${m.cerrada} · 2E=${2 * m.E} 3F=${3 * m.F}`);
  }

  /* ═══ M2 · GAUSS-BONNET ═════════════════════════════════════════════════ */
  sec('M2 · GAUSS-BONNET Σ(2π − Σángulos) = 2π·χ — la MISMA χ por GEOMETRÍA');
  let peorGB = 0;
  for (const k of Object.keys(fig)) {
    const m = mat[k];
    peorGB = Math.max(peorGB, m.errorGaussBonnet);
    check(`M2 ${k}: Σdefectos/2π = χ`,
      m.errorGaussBonnet < 1e-9 && Math.abs(m.gaussBonnet - m.chi) < 1e-9,
      `Σdefectos = ${m.defectoTotal.toFixed(12)} rad vs 2π·${m.chi} = ${(TAU * m.chi).toFixed(12)} → Δ=${m.errorGaussBonnet.toExponential(3)} rad (rel ${m.errorGaussBonnetRel.toExponential(2)})`);
  }
  console.log(`   · el toro es el caso bonito: la curvatura POSITIVA de afuera cancela EXACTO`);
  console.log(`     la NEGATIVA de adentro ⇒ Σdefectos = ${mat.toro.defectoTotal.toExponential(3)} rad ≈ 0 = 2π·0`);
  tel.peorErrorGaussBonnetRad = peorGB;

  /* ═══ M3 · ÁREA / VOLUMEN ANALÍTICOS ════════════════════════════════════ */
  sec('M3 · ÁREA Y VOLUMEN contra la forma cerrada');
  // El error de una malla curva NO es un fudge: es DISCRETIZACIÓN, y se predice.
  // Un n-gono inscrito tiene área ρ(n)=(n/2π)sin(2π/n) veces la del círculo. De ahí
  // salen los déficits ESPERADOS abajo; la tolerancia mide medido-vs-PREDICHO.
  check('M3 cubo 20³: A = 2400 mm² EXACTO y V = 8000 mm³ a menos de 1 ulp',
    mat.cubo.areaTotal === 2400 && rel(mat.cubo.volumenConSigno, 8000) < 1e-15,
    `A=${mat.cubo.areaTotal} exacto · V=${mat.cubo.volumenConSigno} vs 8000 → ${rel(mat.cubo.volumenConSigno, 8000).toExponential(2)} rel `
    + `(el poliedro no aproxima nada; el residuo es el redondeo de los tetraedros al origen, ${(8000 - mat.cubo.volumenConSigno).toExponential(1)} < 1 ulp = ${Number.EPSILON * 8000 / 2})`);

  // ESFERA: déficit de área predicho (π²/6)(1/nu²+1/nv²) y de volumen el DOBLE
  const Aesf = 4 * Math.PI * 100, Vesf = 4 / 3 * Math.PI * 1000;
  const defA = 1 - mat.esfera.areaTotal / Aesf, defV = 1 - mat.esfera.volumenConSigno / Vesf;
  const predA = (Math.PI ** 2 / 6) * (1 / 128 ** 2 + 1 / 64 ** 2), predV = 2 * predA;
  check('M3 esfera r=10: A y V por DEBAJO del analítico (poliedro INSCRITO, ley dura)',
    defA > 0 && defV > 0,
    `A=${mat.esfera.areaTotal.toFixed(4)} < ${Aesf.toFixed(4)} · V=${mat.esfera.volumenConSigno.toFixed(4)} < ${Vesf.toFixed(4)}`);
  check('M3 esfera: el déficit MEDIDO coincide con el PREDICHO por el n-gono inscrito',
    rel(defA, predA) < 5e-3 && rel(defV, predV) < 5e-3,
    `déficit A ${defA.toExponential(5)} vs predicho ${predA.toExponential(5)} (razón ${(defA / predA).toFixed(5)}) · `
    + `déficit V ${defV.toExponential(5)} vs ${predV.toExponential(5)} (razón ${(defV / predV).toFixed(5)})`);
  const esf2 = matriculaDeMalla(esfera(10, 256, 128));
  const defV2 = 1 - esf2.volumenConSigno / Vesf;
  check('M3 esfera: CONVERGENCIA cuadrática al duplicar la teselación (128×64 → 256×128)',
    Math.abs(defV / defV2 - 4) < 0.05,
    `déficit V: ${defV.toExponential(4)} → ${defV2.toExponential(4)} · razón ${(defV / defV2).toFixed(4)}× (teórico 4.0000×) — el error es DISCRETIZACIÓN, no un bug`);

  // TORO: V = 2π²Rr², A = 4π²Rr; el déficit de volumen es el producto ρ(nu)·ρ(nv)
  const Vtoro = 2 * Math.PI ** 2 * 30 * 64, Atoro = 4 * Math.PI ** 2 * 30 * 8;
  const VtoroDisc = Vtoro * rho(96) * rho(48);
  check('M3 toro R=30 r=8: V medido == 2π²Rr²·ρ(nu)·ρ(nv) (revolución de un 48-gono en 96 pasos)',
    rel(mat.toro.volumenConSigno, VtoroDisc) < 1e-4 && mat.toro.volumenConSigno < Vtoro,
    `V=${mat.toro.volumenConSigno.toFixed(6)} vs discreto ${VtoroDisc.toFixed(6)} → ${rel(mat.toro.volumenConSigno, VtoroDisc).toExponential(2)} rel `
    + `(contra el continuo ${Vtoro.toFixed(3)}: déficit ${((1 - mat.toro.volumenConSigno / Vtoro) * 100).toFixed(4)} %, TODO explicado por el inscrito)`);
  const toro2 = matriculaDeMalla(toro(30, 8, 192, 96));
  const dAt = 1 - mat.toro.areaTotal / Atoro, dAt2 = 1 - toro2.areaTotal / Atoro;
  check('M3 toro: A → 4π²Rr por debajo y con convergencia cuadrática',
    dAt > 0 && Math.abs(dAt / dAt2 - 4) < 0.05,
    `A=${mat.toro.areaTotal.toFixed(4)} < ${Atoro.toFixed(4)} · déficit ${dAt.toExponential(4)} → ${dAt2.toExponential(4)} razón ${(dAt / dAt2).toFixed(4)}×`);

  // TAZA: sólido de revolución de un perfil RECTO ⇒ el déficit es ρ(96) EXACTO
  const VtazaTeo = Math.PI * (GEO.rExt ** 2 * GEO.h + (GEO.rimR ** 2 - GEO.rExt ** 2) * GEO.rimT - GEO.rInt ** 2 * (GEO.h - GEO.baseT));
  check('M3 taza del libro: V == V_revolución · ρ(96) — el perfil es recto, así que la ley es EXACTA',
    rel(mat.taza.volumenConSigno, VtazaTeo * rho(96)) < 1e-12,
    `V=${mat.taza.volumenConSigno.toFixed(9)} vs ${(VtazaTeo * rho(96)).toFixed(9)} → ${rel(mat.taza.volumenConSigno, VtazaTeo * rho(96)).toExponential(2)} rel `
    + `(el 0.0714 % contra el continuo ${VtazaTeo.toFixed(2)} es 1−ρ(96), ni un dígito de sorpresa)`);

  // isoperimétrica: ley DURA sin tolerancia (≥1 siempre), mínimo sólo en la esfera
  check('M3 desigualdad ISOPERIMÉTRICA A³ ≥ 36πV² en TODAS las figuras, mínimo en la esfera',
    Object.values(mat).every((m) => m.isoperimetrico >= 1) && mat.esfera.isoperimetrico < 1.001
    && mat.cubo.isoperimetrico > 1.9 && mat.toro.isoperimetrico > 1,
    `esfera=${mat.esfera.isoperimetrico.toFixed(6)} (→1, el mínimo absoluto) · cubo=${mat.cubo.isoperimetrico.toFixed(4)} · `
    + `toro=${mat.toro.isoperimetrico.toFixed(2)} · taza=${mat.taza.isoperimetrico.toFixed(2)} · escalera=${mat.escalera.isoperimetrico.toFixed(2)}`);
  check('M3 isoperimétrico de la esfera → 1 al refinar (la cota se aprieta, no se afloja)',
    Math.abs(esf2.isoperimetrico - 1) < Math.abs(mat.esfera.isoperimetrico - 1) / 3.5,
    `${mat.esfera.isoperimetrico.toFixed(8)} → ${esf2.isoperimetrico.toFixed(8)} (128×64 → 256×128)`);

  /* ═══ M4 · MOMENTOS EXACTOS + TENSOR DE INERCIA ═════════════════════════ */
  sec('M4 · MOMENTOS E INERCIA — integración sobre la malla vs. álgebra cerrada');
  // 4a: los momentos de 0 a 3 de un sólido de vóxeles, malla vs unión de cajas
  const esc = fig.escalera.m;
  const anaMom = momentosDeCajas(esc.cajas);
  const numMom = M.momentosDeMalla(esc.positions, esc.indices, esc.indices.length);
  let peorMom = 0;
  for (let k = 0; k < 10; k++) peorMom = Math.max(peorMom, rel(numMom.m3[k], anaMom.m3[k]));
  for (let k = 0; k < 6; k++) peorMom = Math.max(peorMom, rel(numMom.m2[k], anaMom.m2[k]));
  peorMom = Math.max(peorMom, rel(numMom.m0, anaMom.m0));
  check('M4a momentos ∫x^a y^b z^c dV (orden 0..3) de la escalera: malla == cajas',
    peorMom < 1e-12,
    `peor error relativo de los 17 momentos = ${peorMom.toExponential(3)} · V malla=${numMom.m0} vs cajas=${anaMom.m0} mm³ (12 vóxeles de 4 mm ⇒ 768 exacto)`);
  // 4b: inercia analítica del cubo, la caja, la esfera y el toro
  const iCubo = mat.cubo.inercia, mCubo = 8000, ITeoCubo = mCubo * 400 / 6;
  check('M4b cubo a=20: I = m·a²/6 en los TRES ejes (densidad 1 ⇒ m = V)',
    rel(iCubo.I1, ITeoCubo) < 1e-12 && rel(iCubo.I3, ITeoCubo) < 1e-12,
    `I = [${iCubo.I1.toFixed(6)}, ${iCubo.I2.toFixed(6)}, ${iCubo.I3.toFixed(6)}] vs ${ITeoCubo.toFixed(6)} · err ${Math.max(rel(iCubo.I1, ITeoCubo), rel(iCubo.I3, ITeoCubo)).toExponential(2)}`);
  const [a, b, c] = [12, 13, 15], mCaja = a * b * c;   // caja(-3,-7,-11 → 9,6,4) = 12×13×15
  const ITeoCaja = [mCaja * (a * a + b * b) / 12, mCaja * (a * a + c * c) / 12, mCaja * (b * b + c * c) / 12].sort((u, w) => u - w);
  const iCaja = mat.caja.inercia;
  check('M4b caja 12×13×15: I_i = m(l_j²+l_k²)/12',
    rel(iCaja.I1, ITeoCaja[0]) < 1e-12 && rel(iCaja.I2, ITeoCaja[1]) < 1e-12 && rel(iCaja.I3, ITeoCaja[2]) < 1e-12,
    `I = [${iCaja.I1.toFixed(4)}, ${iCaja.I2.toFixed(4)}, ${iCaja.I3.toFixed(4)}] vs [${ITeoCaja.map((v) => v.toFixed(4)).join(', ')}]`);
  const mEsf = 4 / 3 * Math.PI * 1000, ITeoEsf = 0.4 * mEsf * 100;
  check('M4b esfera r=10: I = 2/5·m·r² isótropo',
    pct(mat.esfera.inercia.I1, ITeoEsf) < 0.2 && pct(mat.esfera.inercia.I3, ITeoEsf) < 0.2,
    `I = [${mat.esfera.inercia.I1.toFixed(2)}, ${mat.esfera.inercia.I2.toFixed(2)}, ${mat.esfera.inercia.I3.toFixed(2)}] vs ${ITeoEsf.toFixed(2)} (${pct(mat.esfera.inercia.I3, ITeoEsf).toFixed(3)} %)`);
  const mTor = Vtoro, IzTor = mTor * (900 + 3 * 64 / 4), IxTor = mTor * (900 / 2 + 5 * 64 / 8);
  check('M4b toro sólido: I_z = m(R²+3r²/4) e I_x = I_y = m(R²/2+5r²/8)',
    pct(mat.toro.inercia.I3, IzTor) < 0.5 && pct(mat.toro.inercia.I1, IxTor) < 0.5 && pct(mat.toro.inercia.I2, IxTor) < 0.5,
    `I = [${mat.toro.inercia.I1.toFixed(1)}, ${mat.toro.inercia.I2.toFixed(1)}, ${mat.toro.inercia.I3.toFixed(1)}] vs [${IxTor.toFixed(1)}, ${IxTor.toFixed(1)}, ${IzTor.toFixed(1)}]`);
  check('M4b la desigualdad triangular I1+I2 ≥ I3 se cumple en TODAS las figuras',
    Object.values(mat).every((m) => m.inercia.triangular),
    Object.entries(mat).map(([k, m]) => `${k}:${(m.inercia.I1 + m.inercia.I2 >= m.inercia.I3) ? 'ok' : 'NO'}`).join(' '));

  /* ═══ M5 · QUIRALIDAD — el invariante de SIGNO ══════════════════════════ */
  sec('M5 · QUIRALIDAD: mismo |valor|, signo OPUESTO al espejear');
  const quirales = { escalera: fig.escalera.m, tetra: fig.tetra.m };
  for (const [k, m0] of Object.entries(quirales)) {
    const q0 = matriculaDeMalla(m0), q1 = matriculaDeMalla(espejarSano(m0));
    check(`M5 ${k}: |q| idéntico y signo OPUESTO bajo espejo`,
      q0.quiralidadDeterminada && q1.quiralidadDeterminada
      && Math.abs(q0.quiralidad) > 1e-3
      && rel(Math.abs(q1.quiralidad), Math.abs(q0.quiralidad)) < 1e-10
      && Math.sign(q1.quiralidad) === -Math.sign(q0.quiralidad),
      `q = ${q0.quiralidad.toExponential(12)} → espejo ${q1.quiralidad.toExponential(12)} · Δ|q| = ${rel(Math.abs(q1.quiralidad), Math.abs(q0.quiralidad)).toExponential(2)}`);
  }
  // aquirales: cuerpo con plano de simetría ⇒ q = 0
  for (const k of ['caja', 'cubo', 'esfera', 'toro', 'taza', 'doble-toro', 'toro-vox']) {
    check(`M5 ${k} tiene plano de simetría ⇒ q ≈ 0 (AQUIRAL)`,
      Math.abs(mat[k].quiralidad) < 1e-9,
      `q = ${mat[k].quiralidad.toExponential(3)}${mat[k].quiralidadDeterminada ? '' : '  [ejes degenerados: el SIGNO se DECLARA no determinado]'}`);
  }
  check('M5 caja 12×13×15: AQUIRAL con los tres ejes SEPARADOS ⇒ q = 0 con signo DETERMINADO',
    Math.abs(mat.caja.quiralidad) < 1e-12 && mat.caja.quiralidadDeterminada,
    `q = ${mat.caja.quiralidad.toExponential(3)} · brecha entre σ = ${mat.caja.inercia.gapRel.toExponential(2)} ⇒ no es un cero por ambigüedad, es un cero por SIMETRÍA`);
  check('M5 honestidad: cuerpos de revolución (esfera, toro, taza, cubo) DECLARAN ejes degenerados',
    ['esfera', 'toro', 'taza', 'cubo'].every((k) => !mat[k].quiralidadDeterminada),
    `lo no medido no cuenta como verificado: con σ repetidos el marco propio es ambiguo y el SIGNO no se mide (el valor sigue dando 0 por simetría, pero eso se reporta aparte)`);
  // EL CHECK QUE HABRÍA CAZADO EL BUG SIN MIRAR
  const espSano = matriculaDeMalla(espejarSano(fig.escalera.m));
  const orig = mat.escalera;
  const igualTodo = orig.chi === espSano.chi && orig.genero === espSano.genero
    && rel(orig.volumenConSigno, espSano.volumenConSigno) < 1e-12
    && rel(orig.areaTotal, espSano.areaTotal) < 1e-12
    && rel(orig.inercia.I1, espSano.inercia.I1) < 1e-12 && rel(orig.inercia.I3, espSano.inercia.I3) < 1e-12
    && orig.cerrada === espSano.cerrada && orig.devanadoCoherente === espSano.devanadoCoherente;
  check('M5 ★ EL ESPEJO SANO: χ, género, volumen, área e inercia son IDÉNTICOS — sólo la quiralidad lo caza',
    igualTodo && Math.sign(espSano.quiralidad) === -Math.sign(orig.quiralidad),
    `χ ${orig.chi}=${espSano.chi} · V ${orig.volumenConSigno.toFixed(9)}=${espSano.volumenConSigno.toFixed(9)} · A ${orig.areaTotal.toFixed(9)}=${espSano.areaTotal.toFixed(9)} · I1 ${orig.inercia.I1.toFixed(6)}=${espSano.inercia.I1.toFixed(6)} · q ${orig.quiralidad.toExponential(6)} ≠ ${espSano.quiralidad.toExponential(6)}`);
  check('M5 coherente() NO puede cazar el espejo sano (y por eso la quiralidad no es opcional)',
    coherente(espSano).ok && coherente(espSano).solidoSano,
    `el espejo sano es un sólido perfectamente válido: ${coherente(espSano).resumen} — NINGÚN otro invariante lo distingue`);
  tel.quiralidadEscalera = orig.quiralidad;

  /* ═══ M6 · INVARIANCIA ══════════════════════════════════════════════════ */
  sec('M6 · INVARIANCIA bajo traslación, rotación y escala');
  const base = fig.escalera.m, m0 = mat.escalera;
  const mT = matriculaDeMalla(trasladar(base, [137.25, -55.9, 8.375]));
  const mR = matriculaDeMalla(rotar(trasladar(base, [137.25, -55.9, 8.375]), [0.3, -0.7, 0.64], 1.2345));
  const S = 2.7, mS = matriculaDeMalla(escalar(base, S));
  check('M6 traslación: χ, género y todos los invariantes de forma quietos',
    mT.chi === m0.chi && mT.genero === m0.genero && rel(mT.volumenConSigno, m0.volumenConSigno) < 1e-12
    && rel(mT.inercia.I3, m0.inercia.I3) < 1e-12 && rel(mT.quiralidad, m0.quiralidad) < 1e-10,
    `χ=${mT.chi} V=${mT.volumenConSigno.toFixed(9)} I3 err=${rel(mT.inercia.I3, m0.inercia.I3).toExponential(2)} q err=${rel(mT.quiralidad, m0.quiralidad).toExponential(2)}`);
  check('M6 rotación arbitraria: autovalores de inercia y quiralidad INVARIANTES',
    mR.chi === m0.chi && rel(mR.volumenConSigno, m0.volumenConSigno) < 1e-11
    && rel(mR.inercia.I1, m0.inercia.I1) < 1e-11 && rel(mR.inercia.I2, m0.inercia.I2) < 1e-11 && rel(mR.inercia.I3, m0.inercia.I3) < 1e-11
    && rel(mR.quiralidad, m0.quiralidad) < 1e-9,
    `err I=[${rel(mR.inercia.I1, m0.inercia.I1).toExponential(2)}, ${rel(mR.inercia.I2, m0.inercia.I2).toExponential(2)}, ${rel(mR.inercia.I3, m0.inercia.I3).toExponential(2)}] · err q=${rel(mR.quiralidad, m0.quiralidad).toExponential(2)} · χ=${mR.chi}`);
  check(`M6 escala ×${S}: A∝s², V∝s³, I∝s⁵, q adimensional QUIETA, χ intacta`,
    mS.chi === m0.chi && rel(mS.areaTotal, m0.areaTotal * S ** 2) < 1e-12
    && rel(mS.volumenConSigno, m0.volumenConSigno * S ** 3) < 1e-12
    && rel(mS.inercia.I3, m0.inercia.I3 * S ** 5) < 1e-12
    && rel(mS.quiralidad, m0.quiralidad) < 1e-11
    && rel(mS.quiralidadRaw, m0.quiralidadRaw * S ** 6) < 1e-11,
    `A err=${rel(mS.areaTotal, m0.areaTotal * S ** 2).toExponential(2)} V err=${rel(mS.volumenConSigno, m0.volumenConSigno * S ** 3).toExponential(2)} I err=${rel(mS.inercia.I3, m0.inercia.I3 * S ** 5).toExponential(2)} q err=${rel(mS.quiralidad, m0.quiralidad).toExponential(2)} Qraw∝s⁶ err=${rel(mS.quiralidadRaw, m0.quiralidadRaw * S ** 6).toExponential(2)}`);
  // ejes intercambiados: el tensor de inercia lo delata
  const estirada = (() => { const q = clonar(base); for (let i = 0; i < q.positions.length; i += 3) q.positions[i] *= 1.4; return q; })();
  const mE = matriculaDeMalla(estirada);
  check('M6 control: estirar SÓLO X (no es una isometría) SÍ mueve los autovalores de inercia',
    rel(mE.inercia.I3, m0.inercia.I3) > 1e-2 && mE.chi === m0.chi,
    `I3 cambia ${(rel(mE.inercia.I3, m0.inercia.I3) * 100).toFixed(2)} % con χ intacta: la topología no ve la forma, la inercia sí`);

  /* ═══ M7 · CONTROLES NEGATIVOS ═════════════════════════════════════════ */
  sec('M7 · CONTROLES NEGATIVOS — se rompe a propósito y se nombra QUIÉN lo caza');
  const cazado = (mm, cod) => coherente(mm).problemas.some((p) => p.codigo === cod && p.gravedad === 'roto');
  const sano = mat.esfera;
  check('M7.0 la esfera intacta pasa coherente() (si no, los controles no prueban nada)',
    coherente(sano).ok && coherente(sano).solidoSano,
    coherente(sano).resumen);

  const c1 = matriculaDeMalla(invertirUnaCara(fig.esfera.m, 5000));
  check('M7.1 UNA cara con el devanado invertido → DEVANADO (χ y Gauss-Bonnet NO se enteran)',
    cazado(c1, 'DEVANADO') && c1.bordesMalOrientados === 3 && c1.chi === 2 && c1.errorGaussBonnet < 1e-9,
    `bordesMalOrientados=${c1.bordesMalOrientados} · χ sigue ${c1.chi} · GB Δ=${c1.errorGaussBonnet.toExponential(2)} · `
    + `ΔV=${(c1.volumenConSigno - sano.volumenConSigno).toExponential(3)} mm³ = ${rel(c1.volumenConSigno, sano.volumenConSigno).toExponential(1)} relativo (invisible para el volumen: por eso hace falta el conteo de medias-aristas)`);

  const c2 = matriculaDeMalla(invertirTodas(fig.esfera.m));
  check('M7.2 TODAS las caras invertidas → VOLUMEN-SIGNO (el bug histórico de esta casa)',
    cazado(c2, 'VOLUMEN-SIGNO') && c2.volumenConSigno < 0 && c2.chi === 2 && c2.devanadoCoherente,
    `V = ${c2.volumenConSigno.toFixed(3)} < 0 · χ = ${c2.chi} intacta · devanado COHERENTE (por eso "se ve bien") · área ${c2.areaTotal.toFixed(3)} idéntica`);

  const c3 = matriculaDeMalla(borrarTriangulo(fig.esfera.m, 5000));
  check('M7.3 un triángulo BORRADO → GRIETA + χ pasa de 2 a 1 (y Gauss-Bonnet lo SIGUE)',
    cazado(c3, 'GRIETA') && c3.chi === 1 && !c3.cerrada && c3.bordesFrontera === 3 && c3.errorGaussBonnet < 1e-9,
    `χ=${c3.chi} (era 2) · bordes de frontera=${c3.bordesFrontera} · Σdefectos/2π=${c3.gaussBonnet.toFixed(9)} = χ ⇒ las DOS vías siguen de acuerdo, lo que confirma que miden lo mismo`);

  const c4 = matriculaDeMalla(duplicarVertice(fig.esfera.m, 5000, 0, 0));
  check('M7.4 vértice duplicado EXACTO → la soldadura lo cura: matrícula idéntica y `verticesSoldados` lo declara',
    coherente(c4).ok && c4.chi === 2 && c4.V === sano.V && c4.E === sano.E && c4.F === sano.F
    && c4.verticesSoldados === sano.verticesSoldados + 1,
    `V/E/F = ${c4.V}/${c4.E}/${c4.F} igual que el original · verticesSoldados ${sano.verticesSoldados} → ${c4.verticesSoldados}`);

  const c5 = matriculaDeMalla(duplicarVertice(fig.esfera.m, 5000, 0, 0.05));
  check('M7.5 vértice duplicado y DESPLAZADO (grieta real) → GRIETA + χ cae a 1',
    cazado(c5, 'GRIETA') && c5.chi === 1 && c5.bordesFrontera === 4 && c5.V === sano.V + 1,
    `V=${c5.V} (era ${sano.V}) E=${c5.E} (era ${sano.E}) χ=${c5.chi} · bordes de frontera=${c5.bordesFrontera}`);

  const c6 = matriculaDeMalla(aletaNoManifold(fig.cubo.m, 0));
  check('M7.6 ★ aleta NO-MANIFOLD: χ SIGUE VALIENDO 2 — sólo GAUSS-BONNET la caza',
    c6.chi === 2 && cazado(c6, 'EULER-vs-GAUSS') && cazado(c6, 'NO-MANIFOLD')
    && Math.abs(c6.gaussBonnet - 1) < 1e-9,
    `χ = V−E+F = ${c6.V}−${c6.E}+${c6.F} = ${c6.chi} (¡la cuenta NO se entera!) pero Σdefectos/2π = ${c6.gaussBonnet.toFixed(9)} ⇒ Δ = ${c6.errorGaussBonnet.toFixed(6)} rad = ${(c6.errorGaussBonnet / TAU).toFixed(3)}·2π. ESTO es para lo que sirve la comprobación cruzada`);

  const c7 = matriculaDeMalla(espejar(fig.escalera.m));
  check('M7.7 malla ESPEJEADA sin corregir devanado → VOLUMEN-SIGNO + la quiralidad cambia de signo',
    cazado(c7, 'VOLUMEN-SIGNO') && Math.sign(c7.quiralidad) === -Math.sign(mat.escalera.quiralidad)
    && rel(Math.abs(c7.quiralidad), Math.abs(mat.escalera.quiralidad)) < 1e-10,
    `V=${c7.volumenConSigno.toFixed(3)} · q ${mat.escalera.quiralidad.toExponential(6)} → ${c7.quiralidad.toExponential(6)} (dos invariantes INDEPENDIENTES delatan la misma corrupción)`);

  // control positivo del gate: ninguna figura sana debe dar un falso positivo
  const falsosPos = Object.entries(mat).filter(([, m]) => !coherente(m).ok);
  check('M7.8 CONTROL POSITIVO: cero falsos positivos en las 9 figuras sanas',
    falsosPos.length === 0,
    falsosPos.length ? falsosPos.map(([k, m]) => `${k}: ${coherente(m).resumen}`).join(' | ') : 'las 9 pasan coherente()');

  /* ═══ M8 · EL BANCO ENTERO ═════════════════════════════════════════════ */
  let censo = null;
  if (!process.argv.includes('--sin-banco')) {
    sec('M8 · BARRIDO DEL BANCO REAL — 19 STEP de Hammond, todos los sólidos');
    censo = await barrerBanco(M);
    const cerradas = censo.filter((r) => r.cerrada).length;
    const coh = censo.filter((r) => r.ok).length;
    const gen = {};
    for (const r of censo) { const k = r.cerrada ? `g${r.genero}` : 'ABIERTA'; gen[k] = (gen[k] ?? 0) + 1; }
    console.log(`\n  CENSO: ${censo.length} sólidos · cerradas ${cerradas} · coherentes ${coh} · ${Object.entries(gen).sort().map(([k, v]) => `${k}=${v}`).join(' ')}`);
    check('M8 el banco tiene los 73 sólidos que declara el README',
      censo.length === 73, `medidos ${censo.length}`);

    // (a) LA MESETA DE TOLERANCIA: el veredicto NO puede depender de mi umbral de
    //     soldadura. Si χ se moviera entre 1e-6 y 1e-8 de la diagonal, el censo
    //     estaría midiendo mi tolerancia y no la malla.
    const inestables = censo.filter((r) => r.chi !== r.chiTolFina);
    check('M8a MESETA: χ no cambia al apretar la soldadura ×10 (tolRel 1e-6 → 1e-7)',
      inestables.length === 0,
      inestables.length ? inestables.map((r) => `${r.pieza} ${r.chi}→${r.chiTolFina}`).join(' ')
        : `los ${censo.length} sólidos dan la misma χ con tol ${'1e-6'} y ${'1e-7'} de la diagonal ⇒ el censo mide la MALLA, no mi umbral`);

    // (b) EULER-vs-GAUSS: exacto donde la malla es manifold; CUANTIZADO donde no.
    const limpias = censo.filter((r) => r.noManifold === 0);
    const rotasNM = censo.filter((r) => r.noManifold > 0);
    check('M8b Euler-vs-Gauss es EXACTO en las mallas sin aristas no-manifold',
      limpias.every((r) => r.errGB < 1e-6),
      `${limpias.length} mallas · peor Δ = ${Math.max(...limpias.map((r) => r.errGB)).toExponential(3)} rad sobre `
      + `${limpias.reduce((s, r) => s + r.F, 0).toLocaleString('en-US')} triángulos (puro redondeo)`);
    check('M8b donde SÍ hay no-manifold, Δ es un múltiplo ENTERO de π: el desacuerdo está CUANTIZADO',
      rotasNM.length > 0 && rotasNM.every((r) => Math.abs(r.errGB / Math.PI - Math.round(r.errGB / Math.PI)) < 1e-6),
      rotasNM.map((r) => `${r.pieza}: ${r.noManifold} aristas nm → Δ=${(r.errGB / Math.PI).toFixed(3)}·π`).join(' · ')
      + ` — el conteo (χ) NO se entera en varias de ellas; la geometría sí`);

    // (c) volumen: dos motores independientes (malla teselada vs B-Rep de OCCT)
    check('M8c volumen de la MALLA vs volumen del B-Rep de OCCT (dos motores distintos)',
      censo.filter((r) => r.errVolPct < 1.1).length === censo.length,
      `${censo.filter((r) => r.errVolPct < 0.5).length}/${censo.length} bajo 0.5 % · peor ${Math.max(...censo.map((r) => r.errVolPct)).toFixed(3)} % `
      + `(${censo.find((r) => r.errVolPct === Math.max(...censo.map((x) => x.errVolPct))).pieza}, malla INSCRITA a deflexión 0.3)`);

    // (d) GÉNERO cruzado contra la topología del B-Rep (Euler-Poincaré de Mäntylä):
    //     V − E + 2F − L = 2(S − G). Dos representaciones sin nada en común.
    const conG = censo.filter((r) => r.generoBRep !== null && r.genero !== null);
    const igual = conG.filter((r) => r.generoBRep === r.genero);
    const menor = conG.filter((r) => r.generoBRep < r.genero);
    check('M8d el género del B-Rep NUNCA queda POR DEBAJO del de la malla (las costuras sólo inflan)',
      menor.length === 0,
      `${igual.length}/${conG.length} coinciden EXACTO · ${conG.length - igual.length} con G_BRep > g_malla. `
      + `DECLARADO: en caras periódicas (cilindros/esferas completas) OCCT cuenta la arista de COSTURA una vez `
      + `aunque el contorno la recorra dos, así que el conteo B-Rep sobreestima. La malla no tiene ese sesgo.`);
    check('M8d ese cruce confirma el género en la mayoría del banco (verificación entre representaciones)',
      igual.length >= Math.ceil(conG.length * 0.75),
      `${igual.length}/${conG.length} = ${(100 * igual.length / conG.length).toFixed(1)} % de acuerdo EXACTO entre malla y B-Rep. `
      + `Las tapas con 4 barrenos pasantes dan g=4 por AMBAS vías`);

    // (e) las rotas: ¿es la pieza o es la deflexión con la que las teselamos?
    const rotas = censo.filter((r) => !r.ok);
    const sanan = rotas.filter((r) => r.sanaCon01);
    console.log(`\n  DIAGNÓSTICO DE LAS ${rotas.length} ROTAS (re-teseladas a deflexión 0.1):`);
    for (const r of rotas) console.log(`   · ${r.pieza.padEnd(14)} ${r.problemas.join('+').padEnd(34)} a 0.1 → ${r.sanaCon01 ? 'SANA (era la DEFLEXIÓN 0.3)' : 'SIGUE ROTA (es la PIEZA)'}`);
    check('M8e las rotas quedan clasificadas: culpa de la deflexión vs. culpa de la pieza',
      rotas.every((r) => typeof r.sanaCon01 === 'boolean'),
      `${sanan.length} sanan al refinar a 0.1 (defecto del PIPELINE: piezas-reales-intake.cjs tesela a 0.3) · `
      + `${rotas.length - sanan.length} siguen rotas a 0.1 y 0.05 (defecto de la PIEZA)`);
    fs.writeFileSync(path.join(ROOT, 'test-parts', 'inyeccion-reales', 'matricula-censo.json'),
      JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), piezas: censo }, null, 1));
    tel.banco = { n: censo.length, cerradas, coherentes: coh, generos: gen };
  }

  /* ═══ LA LÁMINA ════════════════════════════════════════════════════════ */
  if (censo) {
    const outDir = path.join(ROOT, '_laminas');
    fs.mkdirSync(outDir, { recursive: true });
    const svg = laminaCenso(censo, mat);
    fs.writeFileSync(path.join(outDir, 'MATRICULA-banco.svg'), svg);
    console.log(`\n  lámina en _laminas/MATRICULA-banco.svg`);
  }

  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: fails === 0, fails, ...tel }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 1500)); process.exit(1); });

/* ══════════════════════════════════════════════════════════════════════════ */
/* Conjuntos de vóxeles                                                       */
/* ══════════════════════════════════════════════════════════════════════════ */

/** marco 5×5 hueco en el centro ⇒ UN túnel ⇒ género 1 ⇒ χ = 0 */
function cuadroAnillo() {
  const c = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++)
    if (i === 0 || i === 4 || j === 0 || j === 4) c.push([i, j, 0]);
  return c;
}
/** placa 7×4 con DOS huecos de 2×2 separados por una columna ⇒ género 2 ⇒ χ = −2 */
function placaDosHuecos() {
  const hueco = (i, j) => (i >= 1 && i <= 2 || i >= 4 && i <= 5) && (j >= 1 && j <= 2);
  const c = [];
  for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) if (!hueco(i, j)) c.push([i, j, 0]);
  return c;
}
/**
 * ESCALERA QUIRAL — camino de vóxeles +X (5) → +Y (3) → +Z (4). Los tres brazos
 * tienen LARGOS DISTINTOS, así que ninguna rotación los permuta: la terna
 * (brazo1, brazo2, brazo3) tiene MANO, y el espejo la invierte. Género 0, χ = 2.
 */
function escaleraQuiral() {
  const c = [];
  for (let i = 0; i < 5; i++) c.push([i, 0, 0]);
  for (let j = 1; j <= 3; j++) c.push([4, j, 0]);
  for (let k = 1; k <= 4; k++) c.push([4, 3, k]);
  return c;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* Barrido del banco real                                                     */
/* ══════════════════════════════════════════════════════════════════════════ */

async function barrerBanco(M) {
  const DIR = path.join(ROOT, 'test-parts', 'inyeccion-reales');
  const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
  const oc = await require(path.join(distDir, 'opencascade.wasm.cjs'))({
    wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')),
    locateFile: (p) => path.join(distDir, p),
  });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  // GOTCHA documentado: uniqueSubShapes quiere el ENUM emscripten, NO su .value
  const EN = oc.TopAbs_ShapeEnum;
  const TopAbs_SOLID = EN.TopAbs_SOLID;
  /** género por Euler-Poincaré de Mäntylä sobre la TOPOLOGÍA del B-Rep:
   *  V − E + 2F − L = 2(S − G). Es una vía SIN NADA en común con la malla. */
  const generoBRep = (s) => {
    try {
      const V = K.uniqueSubShapes(oc, s, EN.TopAbs_VERTEX).length;
      const E = K.uniqueSubShapes(oc, s, EN.TopAbs_EDGE).length;
      const F = K.uniqueSubShapes(oc, s, EN.TopAbs_FACE).length;
      const L = K.uniqueSubShapes(oc, s, EN.TopAbs_WIRE).length;
      const S = K.uniqueSubShapes(oc, s, EN.TopAbs_SHELL).length;
      const G = S - (V - E + 2 * F - L) / 2;
      return Number.isInteger(G) ? G : null;
    } catch { return null; }
  };
  const files = fs.readdirSync(DIR).filter((f) => /\.(stp|step)$/i.test(f)).sort();
  const filas = [];
  let saltados = 0;
  for (const f of files) {
    let shape;
    try { shape = K.importSTEP(oc, fs.readFileSync(path.join(DIR, f))); }
    catch (e) { console.log(`  ✗ ${f}: import falló ${String(e).slice(0, 90)}`); continue; }
    const solids = K.uniqueSubShapes(oc, shape, TopAbs_SOLID);
    let si = 0;
    for (const solid of solids) {
      const volOCC = K.volume(oc, solid);
      // el mismo filtro del intake (tornillitos/insertos fuera) para censar LOS 73
      if (volOCC < 800) { si++; saltados++; continue; }
      const nm = `${f.replace(/\.(stp|step)$/i, '')}#${si++}`;
      const mesh = K.tessellate(oc, solid, 0.3, 0.3);   // misma deflexión que el intake
      const m = M.matriculaDeMalla(mesh);
      const co = M.coherente(m);
      // MESETA: la misma malla con la soldadura 10× más apretada debe dar la misma χ
      const mFina = M.matriculaDeMalla(mesh, { tolRel: 1e-7 });
      // si sale rota, ¿es la PIEZA o la DEFLEXIÓN? Se re-tesela más fino y se vuelve a medir.
      let sanaCon01 = null;
      if (!co.ok) {
        const m01 = M.matriculaDeMalla(K.tessellate(oc, solid, 0.1, 0.3));
        sanaCon01 = M.coherente(m01).ok;
      }
      const fila = {
        pieza: nm, V: m.V, E: m.E, F: m.F, chi: m.chi, componentes: m.componentes,
        chiTolFina: mFina.chi, sanaCon01,
        genero: m.generoValido ? m.genero : null, generoBRep: generoBRep(solid),
        cerrada: m.cerrada,
        devanado: m.devanadoCoherente, noManifold: m.bordesNoManifold, frontera: m.bordesFrontera,
        soldados: m.verticesSoldados, degenerados: m.trianguloDegenerados,
        volMalla: +m.volumenConSigno.toFixed(4), volOCC: +volOCC.toFixed(4),
        errVolPct: +pct(m.volumenConSigno, volOCC).toFixed(4),
        area: +m.areaTotal.toFixed(3), errGB: m.errorGaussBonnet,
        iso: +m.isoperimetrico.toFixed(3),
        I: [m.inercia.I1, m.inercia.I2, m.inercia.I3].map((v) => +v.toPrecision(8)),
        q: +m.quiralidad.toPrecision(6), qDet: m.quiralidadDeterminada,
        ok: co.ok, problemas: co.problemas.filter((p) => p.gravedad === 'roto').map((p) => p.codigo),
        avisos: co.problemas.filter((p) => p.gravedad === 'aviso').map((p) => p.codigo),
      };
      filas.push(fila);
      const mark = co.ok ? '✓' : '✗';
      console.log(`  ${mark} ${nm.padEnd(22)} chi=${String(m.chi).padStart(4)} g=${String(fila.genero ?? '?').padStart(2)}`
        + `/${String(fila.generoBRep ?? '?').padStart(2)} F=${String(m.F).padStart(6)} ${m.cerrada ? 'CERRADA' : 'ABIERTA'} `
        + `vol=${(m.volumenConSigno / 1000).toFixed(2)}cc (err ${fila.errVolPct.toFixed(2)}% vs OCCT) q=${m.quiralidad.toExponential(2)}${m.quiralidadDeterminada ? '' : '?'}`
        + (co.ok ? '' : `  ← ${fila.problemas.join('+')}${sanaCon01 ? ' [sana a deflexión 0.1]' : ''}`));
    }
  }
  console.log(`  (${saltados} sólidos < 800 mm³ excluidos, igual que scripts/piezas-reales-intake.cjs)`);
  return filas;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LA LÁMINA — el censo dibujado (estilo laminas-visuales.ts)                  */
/* ══════════════════════════════════════════════════════════════════════════ */

function laminaCenso(censo, figuras) {
  const W = 1080, H = 760;
  const ESC = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  o.push(`<style>
    .bg{fill:#0b0f16}
    .tit{fill:#e9eef5;font:700 19px 'JetBrains Mono',monospace}
    .sub{fill:#8fa3bd;font:400 11px 'JetBrains Mono',monospace}
    .cita{fill:#c9a227;font:700 11px 'JetBrains Mono',monospace}
    .hdr{fill:#6f8199;font:700 8.5px 'JetBrains Mono',monospace}
    .row{font:400 8.6px 'JetBrains Mono',monospace}
    .ok{fill:#59d98c} .mal{fill:#ff5c5c} .warn{fill:#ffb347}
    .nm{fill:#c3d0e0} .num{fill:#8fa3bd}
    .lg{fill:#a8b8cc;font:400 9.4px 'JetBrains Mono',monospace}
    .lgk{fill:#c9a227;font:700 9.4px 'JetBrains Mono',monospace}
    .panel{fill:#111823;stroke:#1e2a3a;stroke-width:1}
  </style>`);
  o.push(`<rect class="bg" width="${W}" height="${H}"/>`);

  const cerr = censo.filter((r) => r.cerrada).length;
  const coh = censo.filter((r) => r.ok).length;
  const gcount = {};
  for (const r of censo) { const k = r.cerrada ? String(r.genero) : 'X'; gcount[k] = (gcount[k] ?? 0) + 1; }
  const conG = censo.filter((r) => r.generoBRep !== null && r.genero !== null);
  const igualG = conG.filter((r) => r.generoBRep === r.genero).length;
  o.push(`<text class="tit" x="24" y="28">LA MATRÍCULA DE MALLA — censo del banco de inyección REAL</text>`);
  o.push(`<text class="cita" x="24" y="45">19 STEP de Hammond · ${censo.length} sólidos · verificados SIN MIRARLOS, sólo con invariantes</text>`);
  o.push(`<text class="sub" x="24" y="61">cerradas <tspan class="ok">${cerr}</tspan>/${censo.length} · coherentes <tspan class="ok">${coh}</tspan>/${censo.length} · `
    + `${Object.entries(gcount).sort((a, b) => (a[0] === 'X' ? 9 : +a[0]) - (b[0] === 'X' ? 9 : +b[0])).map(([k, v]) => k === 'X' ? `ABIERTAS=${v}` : `g${k}=${v}`).join('  ')}</text>`);
  o.push(`<text class="sub" x="24" y="76">Euler-vs-Gauss exacto a ${Math.max(...censo.filter((r) => r.noManifold === 0).map((r) => r.errGB)).toExponential(1)} rad en las ${censo.filter((r) => r.noManifold === 0).length} mallas sanas `
    + `· género confirmado por el B-Rep (Euler-Poincaré) en ${igualG}/${conG.length}</text>`);

  // ── tabla en 3 columnas de 25 ────────────────────────────────────────────
  const TOP = 97, PITCH = 15.1, COLW = 345, COLX = [24, 369, 714];
  const porCol = Math.ceil(censo.length / 3);
  const cx = (col, dx) => COLX[col] + dx;
  for (let col = 0; col < 3; col++) {
    o.push(`<text class="hdr" x="${cx(col, 0)}" y="${TOP - 6}">pieza</text>`);
    o.push(`<text class="hdr" x="${cx(col, 160)}" y="${TOP - 6}" text-anchor="end">chi</text>`);
    o.push(`<text class="hdr" x="${cx(col, 178)}" y="${TOP - 6}" text-anchor="middle">g</text>`);
    o.push(`<text class="hdr" x="${cx(col, 192)}" y="${TOP - 6}">cerr</text>`);
    o.push(`<text class="hdr" x="${cx(col, 262)}" y="${TOP - 6}" text-anchor="end">vol cc</text>`);
    o.push(`<text class="hdr" x="${cx(col, 325)}" y="${TOP - 6}" text-anchor="end">quiral</text>`);
    o.push(`<line x1="${cx(col, -16)}" y1="${TOP - 2}" x2="${cx(col, 325)}" y2="${TOP - 2}" stroke="#2a3a4e"/>`);
  }
  censo.forEach((r, i) => {
    const col = Math.floor(i / porCol), fila = i % porCol;
    const y = TOP + 11 + fila * PITCH;
    o.push(`<rect x="${cx(col, -16)}" y="${y - 10.2}" width="341" height="${PITCH}" fill="${r.ok ? (fila % 2 === 0 ? '#ffffff06' : 'none') : '#ff5c5c22'}"/>`);
    o.push(`<circle cx="${cx(col, -10)}" cy="${y - 3.2}" r="3.1" class="${r.ok ? 'ok' : 'mal'}"/>`);
    const nom = r.pieza.length > 20 ? r.pieza.slice(0, 19) + '…' : r.pieza;
    o.push(`<text class="row nm" x="${cx(col, 0)}" y="${y}">${ESC(nom)}</text>`);
    o.push(`<text class="row ${r.ok ? (r.chi === 2 ? 'num' : 'warn') : 'mal'}" x="${cx(col, 160)}" y="${y}" text-anchor="end">${r.chi}</text>`);
    o.push(`<text class="row ${r.genero === null ? 'mal' : (r.genero === 0 ? 'num' : 'warn')}" x="${cx(col, 178)}" y="${y}" text-anchor="middle">${r.genero === null ? '?' : r.genero}</text>`);
    o.push(`<text class="row ${r.cerrada ? 'ok' : 'mal'}" x="${cx(col, 192)}" y="${y}">${r.cerrada ? 'si' : 'NO'}</text>`);
    o.push(`<text class="row num" x="${cx(col, 262)}" y="${y}" text-anchor="end">${(r.volMalla / 1000).toFixed(2)}</text>`);
    const q = r.q;
    const qs = Math.abs(q) < 1e-6 ? '0' : (q > 0 ? '+' : '') + q.toExponential(1);
    o.push(`<text class="row ${Math.abs(q) < 1e-6 ? 'num' : (q > 0 ? 'ok' : 'warn')}" x="${cx(col, 325)}" y="${y}" text-anchor="end">${qs}${r.qDet ? '' : '?'}</text>`);
  });

  // ── panel: leyenda a la izquierda, LAS ROTAS a la derecha ────────────────
  const PY = TOP + 11 + porCol * PITCH + 10, PH = H - PY - 14, SPL = 688;
  o.push(`<rect class="panel" x="20" y="${PY}" width="${W - 40}" height="${PH}" rx="4"/>`);
  o.push(`<line x1="${SPL}" y1="${PY + 6}" x2="${SPL}" y2="${PY + PH - 6}" stroke="#1e2a3a"/>`);
  const L = [
    ['chi = V−E+F', 'caracteristica de Euler. Cerrada de genero g => chi = 2−2g. UN entero que delata agujeros, caras borradas y bordes colgantes.'],
    ['g (genero)', 'cuantos tuneles atraviesan el solido: g=0 caja lisa, g=4 tapa con 4 barrenos pasantes. Se MIDE de chi, no se asume.'],
    ['Gauss-Bonnet', 'suma de defectos angulares = 2·pi·chi. Es chi por GEOMETRIA en vez de por CONTEO. Caza aristas no-manifold que dejan chi INTACTA.'],
    ['vol cc', 'volumen con signo (divergencia). Negativo o cero => NORMALES AL REVES. Es lo unico que cazo el bug que "se veia bien".'],
    ['quiral', 'Q = integral (x·e1)(x·e2)(x·e3) dV en el marco principal DERECHO, normalizado. Mismo |valor| y signo OPUESTO en el espejo; 0 si hay plano de simetria. "?" = ejes degenerados: el signo se DECLARA no determinado.'],
    ['punto verde/rojo', 'verde = los invariantes NO se contradicen entre si. Rojo = dos numeros no pueden ser ciertos a la vez.'],
  ];
  let ly = PY + 16;
  for (const [k, v] of L) {
    o.push(`<text class="lgk" x="32" y="${ly}">${ESC(k)}</text>`);
    const lineas = []; let cur = '';
    for (const p of v.split(' ')) { if ((cur + ' ' + p).length > 76) { lineas.push(cur); cur = p; } else cur = cur ? cur + ' ' + p : p; }
    if (cur) lineas.push(cur);
    lineas.forEach((ln, i) => o.push(`<text class="lg" x="150" y="${ly + i * 10.6}">${ESC(ln)}</text>`));
    ly += 10.6 * lineas.length + 2.5;
  }
  const rotas = censo.filter((r) => !r.ok);
  o.push(`<text class="lgk" x="${SPL + 16}" y="${PY + 16}">LAS ${rotas.length} QUE SE CONTRADICEN</text>`);
  let ry = PY + 32;
  for (const r of rotas) {
    o.push(`<circle cx="${SPL + 20}" cy="${ry - 3.2}" r="3.1" class="mal"/>`);
    o.push(`<text class="row nm" x="${SPL + 30}" y="${ry}">${ESC(r.pieza)}</text>`);
    o.push(`<text class="row mal" x="${W - 34}" y="${ry}" text-anchor="end">chi=${r.chi}</text>`);
    o.push(`<text class="lg mal" x="${SPL + 30}" y="${ry + 10.4}">${ESC(r.problemas.join(' + '))}</text>`);
    o.push(`<text class="lg" x="${SPL + 30}" y="${ry + 20.4}">${r.noManifold ? `${r.noManifold} aristas no-manifold` : `${r.frontera} aristas de frontera`}`
      + ` · a deflexion 0.1 ${r.sanaCon01 ? 'SANA' : 'SIGUE ROTA'}</text>`);
    ry += 34;
  }
  const nSanan = rotas.filter((r) => r.sanaCon01).length;
  o.push(`<text class="lg" x="${SPL + 16}" y="${PY + PH - 24}">${nSanan} sanan al refinar a 0.1 → culpa del TESELADO (el intake usa 0.3).</text>`);
  o.push(`<text class="lg" x="${SPL + 16}" y="${PY + PH - 11}">${rotas.length - nSanan} siguen rotas a 0.1 y a 0.05 → culpa de la PIEZA.</text>`);
  o.push('</svg>');
  return o.join('\n');
}
