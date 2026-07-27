/**
 * CRUCE DE LOS DOS CAMINOS AL FLUJO — el gate que decide si alguno miente.
 * ============================================================================
 * La longitud de flujo (§5.5.5) se calcula por DOS rutas independientes:
 *   · VÓXEL     (`flowlen.ts`)          — rejilla 3D del hueco A/B. General, lento.
 *   · SUPERFICIE(`flowlen-surface.ts`)  — Dijkstra sobre la malla. Rápido, vive en el CAD.
 *
 * Si las dos miden la MISMA pieza y dan L distinta, una está mal. Ese es el punto: dos
 * caminos a la misma física es la prueba más fuerte que hay — no depende de que yo tenga
 * razón, depende de que coincidan.
 *
 * (Así se cazó el bug del rayo +Z: el vóxel daba 33 cc contra 50.5 del kernel. Sin un
 * segundo camino, "se veía bien".)
 *
 * Uso: node --import tsx scripts/mold-flow-cross.cjs
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync } = require('fs');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

const ROOT = path.resolve(__dirname, '..');
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}

(async () => {
  const oc = await require(cjsGlue)({ wasmBinary: readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const TL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'timeline.ts'));
  const TP = await import(path.join(ROOT, 'src', 'forja', 'mold', 'parts', 'tupper.ts'));
  const FL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen.ts'));
  const FM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-mesh.ts'));
  const FS = await import(path.join(ROOT, 'src', 'forja', 'mold', 'flowlen-surface.ts'));

  const P = TP.TUPPER_DEFAULT;
  const r = TL.rebuild(K, oc, TP.tupperRecipe().timeline);
  const mesh = K.tessellate(oc, r.shape, 0.4, 0.4);
  const q = FM.solidFromMesh(mesh);
  const gate = FM.defaultGate(q);
  console.log(`\nPIEZA: vaso ⌀${P.diaMm}×${P.heightMm} pared ${P.wallMm} · ${mesh.indices.length / 3} triángulos`);
  console.log(`GATE: (${gate.x.toFixed(1)}, ${gate.y.toFixed(1)}, ${gate.z.toFixed(2)}) — el fondo, no el aire`);
  check('el gate cae en el FONDO de la pieza (z pequeño), no en el aire de en medio',
    gate.z < P.wallMm + 0.5, `z = ${gate.z.toFixed(2)} (pared ${P.wallMm})`);

  // ── CAMINO 1: SUPERFICIE (el que vive en el CAD) ─────────────────────────
  const t1 = Date.now();
  const sf = FS.surfaceFlowLength(mesh, gate, P.wallMm);   // wallMm = empareja las caras opuestas
  const msSup = Date.now() - t1;
  console.log(`\nSUPERFICIE (dual domain): L máx ${sf.maxFlowLenMm} mm · ${sf.nVertices} vértices · ${msSup} ms`);
  check('la superficie corre en TIEMPO REAL (< 250 ms: vive en el CAD)', msSup < 250, `${msSup} ms`);
  check('la malla queda CONECTADA (los vértices se soldaron)', sf.unreachable === 0,
    `${sf.unreachable} vértices sin camino — si fuera >0, el grafo estaría en islas`);

  // ── CAMINO 2: VÓXEL (el análisis a fondo) ────────────────────────────────
  const cell = Math.min(0.8, P.wallMm * 0.6);
  const t2 = Date.now();
  const field = FL.measureFlowLength({
    x0: q.bbox.x0 - 1, y0: q.bbox.y0 - 1, z0: q.bbox.z0 - 1,
    x1: q.bbox.x1 + 1, y1: q.bbox.y1 + 1, z1: q.bbox.z1 + 1,
    cellMm: cell, gateMm: gate, inCavity: (x, y, z) => q.inside(x, y, z),
    wallMm: P.wallMm, expectVolumeMm3: r.measure?.volumeMm3,
  });
  const msVox = Date.now() - t2;
  console.log(`VÓXEL: L máx ${field.maxFlowLenMm} mm · ${(field.volumeMm3 / 1000).toFixed(2)} cc · celda ${cell} mm · ${msVox} ms`);
  for (const w of field.warnings) console.log(`  ⚠ ${w}`);
  check('el vóxel NO trae avisos (el volumen cuadra con el kernel)', field.warnings.length === 0,
    field.warnings[0] ?? `kernel ${(r.measure.volumeMm3 / 1000).toFixed(2)} cc vs vóxel ${(field.volumeMm3 / 1000).toFixed(2)} cc`);
  console.log(`  el vóxel es ${(msVox / Math.max(1, msSup)).toFixed(0)}× más lento → por eso el CAD usa la superficie`);

  // ── EL CRUCE: ¿coinciden? ────────────────────────────────────────────────
  const err = Math.abs(sf.maxFlowLenMm - field.maxFlowLenMm) / field.maxFlowLenMm;
  console.log(`\n─── EL CRUCE ───`);
  console.log(`  superficie ${sf.maxFlowLenMm} mm  vs  vóxel ${field.maxFlowLenMm} mm  →  ${(100 * err).toFixed(1)}% de diferencia`);
  // ⚠ HALLAZGO ABIERTO (2026-07-16): la superficie sobreestima ~85 %. NO es que el cruce
  // esté mal calibrado — es que Dijkstra sobre aristas ZIGZAGUEA cuando la malla es gruesa
  // (la del kernel: arista media 32.8 mm, máxima 135). El vóxel da 137.95 ≈ radio 70 +
  // alto 65 = 135 ⇒ EL VÓXEL TIENE RAZÓN. Bajar el umbral a 0.9 para "pasar" sería mentir:
  // el gate queda en 0.15 (el objetivo real) y ESTA nota dice por qué está rojo.
  // Arreglo pendiente: que el CAD lea del vóxel (celda 2 mm ≈ 200 ms) o afinar la malla
  // (`tessellate` ignora deflexión y ángulo: 380 triángulos SIEMPRE — bug aparte).
  check('DOS CAMINOS INDEPENDIENTES dan la MISMA L (si divergen, uno miente)', err < 0.15,
    `${(100 * err).toFixed(1)}% — superficie ${sf.maxFlowLenMm} · vóxel ${field.maxFlowLenMm}. ` +
    `EL VÓXEL MANDA (≈ radio+alto). La superficie zigzaguea por malla gruesa (arista ~33 mm): ` +
    `sirve para VER el orden de llegada, no para los mm`);

  // ── LA GEOMETRÍA MANDA: L ≈ radio + alto (no es coincidencia, es el recorrido) ──
  const esperado = P.diaMm / 2 + P.heightMm;
  console.log(`\n  el recorrido más largo de un vaso = radio (${P.diaMm / 2}) + alto (${P.heightMm}) = ${esperado} mm`);
  check('el VÓXEL da L ≈ radio + alto (el recorrido REAL del fundido)',
    Math.abs(field.maxFlowLenMm - esperado) / esperado < 0.15,
    `vóxel ${field.maxFlowLenMm} vs ${esperado} mm — ESTE es el camino que mide bien`);
  check('[ABIERTO] la superficie también ≈ radio + alto', Math.abs(sf.maxFlowLenMm - esperado) / esperado < 0.15,
    `superficie ${sf.maxFlowLenMm} vs ${esperado} mm — pendiente: leer del vóxel o afinar malla`);

  // ── EL PINTADO: colores por vértice, con el frente a media altura ────────
  const col = FS.paintFlowColors(sf, sf.maxFlowLenMm * 0.5);
  let llenos = 0, vacios = 0;
  for (let v = 0; v < sf.nVertices; v++) {
    // gris apagado [0.14,0.17,0.24] = vacío
    if (Math.abs(col[v * 3] - 0.14) < 1e-3 && Math.abs(col[v * 3 + 2] - 0.24) < 1e-3) vacios++; else llenos++;
  }
  console.log(`\n  al 50% del recorrido: ${llenos} vértices llenos · ${vacios} vacíos`);
  check('el pintado DISTINGUE lleno de vacío (el frente se ve)', llenos > 0 && vacios > 0,
    `${llenos} / ${vacios}`);

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ FLUJO: dos caminos independientes (vóxel + superficie) dan la MISMA longitud de flujo, y ≈ radio + alto. La superficie corre en tiempo real ⇒ vive en el CAD.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
