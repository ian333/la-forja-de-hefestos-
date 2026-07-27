/**
 * GATE DEL TUPPER REDONDO + TAPA (PP) — "el cuadrado es trampa, haz un tupper circular
 * mi chavo" (user 2026-07-15). Tenía razón: el prisma ESCONDE la maquinaria (bolsa recta,
 * inserto cuadrado, expulsores en rejilla). El círculo la obliga a ser de verdad, y la
 * TAPA obliga a lo que ninguna pieza suelta pide: dos piezas que EMBONAN.
 *
 * Construye las DOS en el kernel REAL (no las describe: las hace) y las manda al JUEZ
 * (nuestro propio DFM). Si nuestra pieza, diseñada CON las reglas del libro, no pasa
 * nuestro propio DFM, o el diseño o el juez están mal. Es la prueba cruzada que ningún
 * STL bajado da: los de impresión vienen sin salida (~83%) y los de KiCad son
 * aproximaciones visuales (~91%).
 *
 * Uso: node --import tsx scripts/tupper-test.cjs
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
  const occtFactory = require(cjsGlue);
  const oc = await occtFactory({ wasmBinary: readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const TL = await import(path.join(ROOT, 'src', 'forja', 'mold', 'timeline.ts'));
  const TP = await import(path.join(ROOT, 'src', 'forja', 'mold', 'parts', 'tupper.ts'));
  const DA = await import(path.join(ROOT, 'src', 'forja', 'mold', 'draw-axis.ts'));
  const MM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'moldmachine.ts'));
  const P = TP.TUPPER_DEFAULT;

  // ── 1) EL MATERIAL (la corrección más aburrida y la más importante) ───────
  console.log(`\n─── MATERIAL ───`);
  check('un tupper de COMIDA es PP, no ABS', P.resin === 'PP',
    `${P.resin} — grado alimenticio/microondas, y $1.50/kg vs $2.16 del ABS`);

  // ── 2) LA SALIDA, CON SU FILA DECLARADA ──────────────────────────────────
  const d = TP.draftForFinish(P.resin, P.finish);
  console.log(`salida ${d.deg}° · fila: ${d.row}`);
  check('la salida ≥ el mínimo §2.3.6 (0.5°)', d.deg >= 0.5, `${d.deg}°`);
  check('DECLARA que la Tabla 2.14 no trae fila de PP (no inventa un ángulo)',
    /no trae fila de PP/.test(d.row), d.row);

  // ── 3) EL VASO: CONSTRUIDO Y MEDIDO ──────────────────────────────────────
  const c = TP.tupperRecipe();
  console.log(`\n─── ${c.name} ───`);
  for (const f of c.timeline) console.log(`  ${f.id.padEnd(9)} ${f.label.padEnd(30)} ${f.why.slice(0, 62)}`);
  check('flujo humano: croquis CÍRCULO → extruir → salida → vaciar',
    c.timeline.map((f) => f.type).join(',') === 'sketch-circle,extrude,draft,shell', c.timeline.map((f) => f.type).join('→'));
  const r = TL.rebuild(K, oc, c.timeline);
  for (const s of r.steps) console.log(`   ${s.ok ? '✓' : '✗'} ${s.label.padEnd(30)} ${String(s.ms).padStart(5)}ms ${s.error ?? ''}`);
  check('el vaso SE CONSTRUYE', !!r.shape, r.measure ? `bbox ${r.measure.bbox.join(' × ')} mm` : (r.measureError ?? 'sin sólido'));
  check('todos los pasos ok', r.steps.every((s) => s.ok), r.steps.filter((s) => !s.ok).map((s) => `${s.label}: ${s.error}`).join(' | ') || 'ok');
  if (!r.shape) { console.log('\n❌ sin sólido — no se puede juzgar'); process.exit(1); }

  // la BOCA conserva su ⌀: el neutro va ARRIBA. Con el neutro en z=0 la boca CRECE
  // 2·h·tan(θ) — el bug que cazó la cota en la versión rectangular ("boca 162.98 vs 160").
  check('la BOCA conserva su ⌀ (plano neutro arriba)',
    Math.abs(r.measure.bbox[0] - P.diaMm) < 1.5 && Math.abs(r.measure.bbox[1] - P.diaMm) < 1.5,
    `⌀ ${r.measure.bbox[0]} × ${r.measure.bbox[1]} vs ${P.diaMm} de croquis`);
  check('el alto cuadra', Math.abs(r.measure.bbox[2] - P.heightMm) < 1.5, `${r.measure.bbox[2]} vs ${P.heightMm}`);
  const vol = r.measure.volumeMm3, macizo = Math.PI * (P.diaMm / 2) ** 2 * P.heightMm;
  console.log(`  volumen ${Math.round(vol).toLocaleString()} mm³ vs macizo ${Math.round(macizo).toLocaleString()} → ${(100 * vol / macizo).toFixed(1)}%`);
  check('está VACIADO (cascarón, no ladrillo)', vol / macizo < 0.35, `${(100 * vol / macizo).toFixed(1)}% del macizo`);

  // ── 4) LA TAPA ───────────────────────────────────────────────────────────
  const lc = TP.lidRecipe();
  console.log(`\n─── ${lc.name} ───`);
  for (const f of lc.timeline) console.log(`  ${f.id.padEnd(9)} ${f.label.padEnd(30)} ${f.why.slice(0, 62)}`);
  const rl = TL.rebuild(K, oc, lc.timeline);
  for (const s of rl.steps) console.log(`   ${s.ok ? '✓' : '✗'} ${s.label.padEnd(30)} ${String(s.ms).padStart(5)}ms ${s.error ?? ''}`);
  check('la tapa SE CONSTRUYE', !!rl.shape, rl.measure ? `bbox ${rl.measure.bbox.join(' × ')} mm` : (rl.measureError ?? 'sin sólido'));
  check('todos los pasos de la tapa ok', rl.steps.every((s) => s.ok), rl.steps.filter((s) => !s.ok).map((s) => `${s.label}: ${s.error}`).join(' | ') || 'ok');
  if (rl.measure) check('la tapa es CASCARÓN (se vacía por abajo)',
    rl.measure.volumeMm3 / (Math.PI * (rl.measure.bbox[0] / 2) ** 2 * rl.measure.bbox[2]) < 0.5,
    `${(100 * rl.measure.volumeMm3 / (Math.PI * (rl.measure.bbox[0] / 2) ** 2 * rl.measure.bbox[2])).toFixed(1)}% del macizo`);

  // ── 5) EMBONAN: UNA COTA, DOS PIEZAS ─────────────────────────────────────
  const inner = TP.lidInnerDiaMm();
  console.log(`\n─── AJUSTE TAPA ↔ BOCA ───`);
  console.log(`  boca ⌀${P.diaMm} → falda interior ⌀${inner} · holgura ${TP.lidFitMm()} mm por lado`);
  check('la falda ABRAZA la boca (ni aprieta ni baila)', inner > P.diaMm && inner - P.diaMm < 1,
    `${(inner - P.diaMm).toFixed(2)} mm de juego total`);
  check('la holgura sale de UNA fuente (lidFitMm), no de dos copias',
    Math.abs(inner - (P.diaMm + 2 * TP.lidFitMm())) < 1e-9, 'la tapa NACE de la cota del vaso');

  // ── 6) EL JUEZ: nuestro propio DFM ───────────────────────────────────────
  const m = K.tessellate(oc, r.shape, 0.25, 0.25);
  const idx = m.indices ?? new Uint32Array(m.positions.length / 3).map((_, i) => i);
  const dfm = DA.pickDrawAxis({ positions: m.positions, indices: idx }, { wallMm: P.wallMm }).dfm;
  console.log(`\n─── VEREDICTO DEL DFM (nuestro propio juez) ───`);
  console.log(`  moldeable: ${dfm.moldable}`);
  for (const v of dfm.verdicts) console.log(`   ${v.ok ? '✓' : '⚠'} ${v.param}: ${v.valor} [${v.ref}]`);
  check('el DFM lo declara MOLDEABLE (dos placas)', dfm.moldable === 'si', dfm.moldable);
  console.log(`  sin-draft: ${dfm.draft.pctBelowMin.toFixed(1)}%  ← los STL de impresión daban ~83%, los de KiCad ~91%`);
  check('DISEÑADO CON SALIDA: poca cara bajo el mínimo', dfm.draft.pctBelowMin < 25,
    `${dfm.draft.pctBelowMin.toFixed(1)}% (vs 83% de los STL bajados)`);
  check('sin undercuts (sale de dos placas)', dfm.undercut.volumeMm3 < 500, `${dfm.undercut.volumeMm3} mm³`);

  // ── 7) LA MÁQUINA le hace molde a LAS DOS ────────────────────────────────
  for (const [nom, spec] of [['VASO', TP.tupperMachineSpec()], ['TAPA', TP.lidMachineSpec()]]) {
    const pkg = MM.moldMachine(spec);
    // OJO: el veredicto vive en `pkg.veredicto`, NO en `pkg.recomendacion`. Mirar un campo
    // inexistente daba `undefined` → "✗ no viable" con la Máquina PERFECTA. Un check que
    // lee mal miente igual que uno que calcula mal.
    const v = pkg.veredicto, s = pkg.diseno.maquina.seleccion;
    console.log(`\n─── LA MÁQUINA · ${nom} ───`);
    console.log(`  ${pkg.recomendacion.arch} × ${pkg.recomendacion.nCav} cav · base ${pkg.base.base.wmm}×${pkg.base.base.lmm} · ${s.machine?.name}`);
    console.log(`  carrera §6.3.2 ${s.apertura.strokeMm} mm · daylight ${s.apertura.needMm}/${s.machine?.maxDaylightMm} · holgura ${s.apertura.holguraMm} mm`);
    console.log(`  ${v.viable ? '✓ VIABLE' : '✗ no viable'} · molde $${Math.round(v.precioMoldeUSD).toLocaleString()} · $${v.costoPiezaUSD.toFixed(3)}/pza · ${v.entregaSemanas} sem`);
    if (v.banderas?.length) for (const b of v.banderas) console.log(`   ⚑ ${b}`);
    check(`[${nom}] la Máquina le hace molde VIABLE`, !!v.viable, `$${Math.round(v.precioMoldeUSD).toLocaleString()}`);
    check(`[${nom}] la máquina elegida PUEDE abrirlo (§6.3.2)`, s.apertura.holguraMm >= 0, `holgura ${s.apertura.holguraMm} mm`);
  }

  writeFileSync('/tmp/tupper.json', JSON.stringify({ vaso: c, tapa: lc, measure: r.measure, lid: rl.measure }, null, 2));
  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ TUPPER REDONDO + TAPA en PP: las dos se construyen en el kernel, EMBONAN por una sola cota, y la Máquina las cotiza');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 500)); process.exit(1); });
