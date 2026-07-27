/**
 * GATE de la LÍNEA DE TIEMPO — "el historial debería permitirte explorar" (user).
 * No basta con que exista la receta: hay que probar que el lazo CIERRA.
 *   1. la receta se EVALÚA → sólido con las medidas del spec (cotas cuadran)
 *   2. EDITAR una cota → el sólido CAMBIA acorde (no es decoración)
 *   3. SUPRIMIR un paso → el sólido pierde esa operación (explorar sin borrar)
 *   4. una cota IMPOSIBLE → el paso se marca ✗ pero la reconstrucción SOBREVIVE
 *   5. determinismo: misma receta ⇒ mismas medidas
 *   6. cada paso trae su PORQUÉ (cita del libro)
 * Uso: node --import tsx scripts/mold-timeline-test.cjs
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync } = require('fs');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

// ── glue de OCCT para node (mismo patrón que mold-parts-test) ────────────────
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}

const bezel = {
  name: 'Bezel', code: 'MLD-BEZEL', widthMm: 381,
  plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
  cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5, frameMm: 20, ribs: 7 },
  cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 }, ejectors: { type: 'pin', diaMm: 3, count: 20 },
  core: { widthMm: 240, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
  clampTons: 200, feed: 'hot-runner', nCav: 1,
};

(async () => {
  // OJO: hay que pasar `wasmBinary` YA LEÍDO — con solo locateFile el glue intenta
  // parsear la ruta como URL y truena ("Failed to parse URL from ...wasm").
  const occtFactory = require(cjsGlue);
  const oc = await occtFactory({ wasmBinary: readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const TL = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'timeline.ts'));
  const RC = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-recipe.ts'));
  const DS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawing-set.ts'));

  // ── 1) LA RECETA EXISTE Y ES LEGIBLE ──────────────────────────────────────
  const comps = RC.moldRecipe(bezel);
  console.log(`receta: ${comps.length} componentes`);
  for (const c of comps) {
    console.log(`\n── ${c.name} (${c.material}) · ${c.timeline.length} pasos ──`);
    for (const f of c.timeline) console.log(`   ${f.id.padEnd(14)} ${f.label}`);
  }
  check('la receta trae ≥2 componentes', comps.length >= 2, `${comps.map((c) => c.role).join(', ')}`);
  const A = comps.find((c) => c.role === 'A');
  check('la placa A tiene historia real (≥3 pasos)', A.timeline.length >= 3, `${A.timeline.length} pasos`);
  check('CADA paso dice POR QUÉ (cita del libro)', A.timeline.every((f) => f.why && f.why.length > 15), 'todos con cita');
  check('el primer paso es un CROQUIS (flujo humano)', A.timeline[0].type.startsWith('sketch'), A.timeline[0].type);

  // ── 2) SE EVALÚA Y LAS COTAS CUADRAN ──────────────────────────────────────
  const t0 = Date.now();
  const r = TL.rebuild(K, oc, A.timeline);
  console.log(`\nrebuild placa A: ${Date.now() - t0} ms · ${r.steps.filter((s) => s.ok).length}/${r.steps.length} pasos ok`);
  for (const s of r.steps) console.log(`   ${s.ok ? '✓' : '✗'} ${s.label.padEnd(48)} ${s.ms}ms ${s.error ?? ''}`);
  check('la receta produce SÓLIDO', !!r.shape, r.measure ? `bbox ${r.measure.bbox.join('×')}` : 'sin medida');
  check('todos los pasos evalúan ok', r.steps.every((s) => s.ok), `${r.steps.filter((s) => !s.ok).map((s) => s.label + ':' + s.error).join(' | ') || 'ok'}`);

  // LAS MEDIDAS CUADRAN con el spec (esto es "verificar que todas cuadren")
  const D = DS.plateDepth(bezel);
  const wantW = bezel.widthMm, wantD = D, wantT = bezel.plates.A;
  console.log(`\nmedidas: bbox ${r.measure.bbox.join(' × ')} mm  vs  spec ${wantW} × ${wantD} × ${wantT}`);
  check('ancho cuadra con el spec', Math.abs(r.measure.bbox[0] - wantW) < 1, `${r.measure.bbox[0]} ≈ ${wantW}`);
  check('fondo cuadra con el spec', Math.abs(r.measure.bbox[1] - wantD) < 1, `${r.measure.bbox[1]} ≈ ${wantD}`);
  check('ESPESOR cuadra con el spec', Math.abs(r.measure.bbox[2] - wantT) < 1, `${r.measure.bbox[2]} ≈ ${wantT}`);
  const zA = (await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-plano-set.ts'))).plateStackZ(bezel).A;
  check('la placa se sitúa en su Z del apilado', Math.abs(r.measure.min[2] - zA) < 1, `z=${r.measure.min[2]} ≈ ${zA}`);

  // ── 3) EDITAR CAMBIA EL SÓLIDO (el lazo del usuario) ──────────────────────
  const edited = TL.editFeature(A.timeline, 'ex-espesor', { distance: 90 });
  const r2 = TL.rebuild(K, oc, edited);
  console.log(`\nEDITO espesor 56 → 90: bbox ${r2.measure.bbox.join(' × ')}`);
  check('EDITAR la cota CAMBIA el sólido', Math.abs(r2.measure.bbox[2] - 90) < 1, `espesor ${r2.measure.bbox[2]} = 90`);
  check('la receta original NO se mutó (inmutable)', A.timeline.find((f) => f.id === 'ex-espesor').params.distance === wantT, `sigue en ${wantT}`);

  // ── 4) SUPRIMIR un paso (explorar sin borrar) ─────────────────────────────
  const noPocket = TL.suppressFeature(A.timeline, 'bolsa-inserto');
  const r3 = TL.rebuild(K, oc, noPocket);
  const volFull = r.measure.volumeMm3, volNoPocket = r3.measure.volumeMm3;
  console.log(`\nSUPRIMO la bolsa del inserto: volumen ${volFull} → ${volNoPocket} mm³`);
  check('SUPRIMIR la bolsa deja MÁS material', volNoPocket > volFull, `${volNoPocket} > ${volFull}`);

  // ── 5) COTA IMPOSIBLE: se marca ✗ pero la reconstrucción SOBREVIVE ────────
  const bad = TL.editFeature(A.timeline, 'ex-espesor', { distance: 0 });
  const r4 = TL.rebuild(K, oc, bad);
  const failed = r4.steps.filter((s) => !s.ok);
  console.log(`\nCOTA IMPOSIBLE (espesor 0): ${failed.length} paso(s) marcados ✗`);
  for (const s of failed) console.log(`   ✗ ${s.label} → "${s.error}"`);
  check('una cota imposible NO tumba el rebuild (se puede explorar)', Array.isArray(r4.steps) && r4.steps.length === A.timeline.length, `${r4.steps.length} pasos reportados`);
  const exStep = r4.steps.find((s) => s.id === 'ex-espesor');
  check('el paso malo se marca ✗', !exStep.ok, exStep.error ?? '');
  // el mensaje debe ser HUMANO, no un volcado del kernel ("memory access out of bounds")
  check('el error se explica en español, no en jerga de kernel',
    /debe ser|debe estar/.test(exStep.error ?? '') && !/memory|out of bounds|Standard_/.test(exStep.error ?? ''),
    `"${exStep.error}"`);
  const otras = TL.editFeature(A.timeline, 'br-tornillos', { dia: -5 });
  const r5 = TL.rebuild(K, oc, otras);
  check('un Ø negativo también se ataja antes del kernel',
    !r5.steps.find((s) => s.id === 'br-tornillos').ok, r5.steps.find((s) => s.id === 'br-tornillos').error ?? '');

  // ── 6) SE PUEDE VOLVER de una cota mala (lo que de verdad es "explorar") ───
  // Si tras un edit imposible el CAD queda tostado, explorar es una trampa.
  const rBack = TL.rebuild(K, oc, A.timeline);
  console.log(`\nVUELVO a la receta buena tras la mala: ${rBack.measure ? 'bbox ' + rBack.measure.bbox.join(' × ') : 'SIN MEDIDA — ' + rBack.measureError}`);
  check('tras una cota mala se puede VOLVER (rebuild sano)', !!rBack.measure, rBack.measureError ?? 'medida ok');
  check('y da el MISMO sólido que antes (determinista)',
    !!rBack.measure && JSON.stringify(rBack.measure.bbox) === JSON.stringify(r.measure.bbox),
    rBack.measure ? `${rBack.measure.bbox.join('×')} = ${r.measure.bbox.join('×')}` : 'no medible');

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ LÍNEA DE TIEMPO: la receta se evalúa, las cotas cuadran, EDITAR cambia el sólido y explorar no lo rompe');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 500)); process.exit(1); });
