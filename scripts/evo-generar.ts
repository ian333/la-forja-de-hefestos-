/*
 * evo-generar.ts — CORRE el generador de mecanismos (GA por matemáticas) y
 * escupe el diseño cicloidal ÓPTIMO: imprimible en 1 pieza, AUTOCENTRADO (cono),
 * con el GAP correcto (anti-fusión), que aguanta el par. La matemática resuelve.
 *   npx esbuild scripts/evo-generar.ts --bundle --platform=node --format=cjs --outfile=/tmp/evo.cjs && node /tmp/evo.cjs
 */
import { evolve, verifyChampion, evaluate, TODAYS_FAILED, DEFAULT_PROBLEM } from '../src/forja/mech/evolucion';

const r = evolve(DEFAULT_PROBLEM, { seed: 7, pop: 160, gens: 240 });
const g = r.best, m = r.bestEval.metrics;
const v = verifyChampion(g);
const fail = evaluate(TODAYS_FAILED);

console.log('═══ GENERADOR DE MECANISMOS — diseño cicloidal óptimo ═══\n');
console.log('PROBLEMA:', JSON.stringify(DEFAULT_PROBLEM));
console.log('\n── GENOMA generado (la pieza) ──');
console.log(`  reducción N:1      = ${g.lobes}:1   (${g.lobes} lóbulos, ${g.lobes + 1} rodillos)`);
console.log(`  radio pernos R     = ${g.R.toFixed(1)} mm`);
console.log(`  discos apilados N  = ${g.N}  · espesor t = ${g.t.toFixed(1)} mm`);
console.log(`  excentricidad E    = ${(g.Efac * (g.R / (2 * (g.lobes + 1)))).toFixed(3)} mm (${(g.Efac * 100).toFixed(0)}% del límite)`);
console.log(`  GAP del modelo     = ${g.gap.toFixed(2)} mm   ← imprimible`);
console.log(`  CONO autocentrado  = ${g.coneDeg.toFixed(1)}°  ${g.coneDeg >= 8 ? '✓ AUTOCENTRA' : '✗ voladizo'}`);
console.log(`  eje ⌀              = ${(g.R * g.shaftFac * 2).toFixed(1)} mm · costillas: ${g.ribs ? 'sí' : 'no'}`);
console.log(`  impresión tilt     = ${g.tiltDeg.toFixed(0)}°  ${g.tiltDeg < 20 ? '(vertical, liso)' : g.tiltDeg > 40 ? '(1 pieza a 45°)' : ''}`);

console.log('\n── LA MATEMÁTICA (por qué imprime y funciona) ──');
console.log(`  capacidad T_cap    = ${m.Tcap_Nm.toFixed(2)} N·m  → margen ×${m.torqueMargin.toFixed(2)} sobre ${DEFAULT_PROBLEM.torqueTarget_Nm} N·m  ${m.torqueMargin >= 1 ? '✓ aguanta' : '✗'}`);
console.log(`  runout del eje     = ${m.runout_mm.toFixed(3)} mm  (cono ${m.hasCone ? 'SÍ → ~0' : 'NO → cabecea'})`);
console.log(`  gap efectivo       = ${(g.gap - 0.24).toFixed(3)} mm  · margen anti-choque = ${m.bindMargin_mm.toFixed(3)} mm  ${m.binds ? '✗ SE TRABA' : '✓ libra'}`);
console.log(`  fusión SF          = ${m.fusionSF.toFixed(2)}  ${m.fuses ? '✗ se funde' : '✓ no se funde'} (objetivo ≥ ${DEFAULT_PROBLEM.fusionTargetSF})`);
console.log(`  película λ         = ${m.lambda.toFixed(2)} (${m.regime}) · η = ${(m.efficiency * 100).toFixed(1)}%`);
console.log(`  masa               = ${m.mass_g.toFixed(0)} g · altura = ${m.stackH_mm.toFixed(1)} mm · ⌀ext = ${(m.Router_mm * 2).toFixed(0)} mm`);
console.log(`  FACTIBLE           = ${r.bestEval.feasible ? '✓ SÍ (0 penalizaciones)' : '✗ no'}  · fitness = ${r.bestEval.fitness}`);

console.log('\n── VERIFICACIÓN HONESTA (malla real, no proxy) ──');
console.log(`  peor holgura malla = ${v.realWorstMesh_mm.toFixed(3)} mm  ${v.collides ? '✗ CHOCA' : '✓ NO choca'} · proxy concuerda: ${v.proxyAgrees ? 'sí' : 'no'}`);

console.log('\n── CONTRASTE: el diseño que FALLÓ (sin cono, gap que funde) ──');
console.log(`  factible=${fail.feasible} · binds=${fail.metrics.binds} · fuses=${fail.metrics.fuses} · runout=${fail.metrics.runout_mm}mm (vs ${m.runout_mm}mm del generado)`);
console.log(`\n  convergencia: gen0 best=${r.history[0].best} → gen${r.history.length - 1} best=${r.history[r.history.length - 1].best} · factibles=${(r.history[r.history.length - 1].feasibleFrac * 100).toFixed(0)}%`);

// salida JSON para construir la geometría
console.log('\nCHAMPION_JSON=' + JSON.stringify({ genome: g, metrics: m, verify: v }));
