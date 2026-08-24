/**
 * VALIDACIÓN CONTRA MOLDE REAL — EL RECIBO
 * ============================================================================
 * ian: "debemos cumplir y superar los estándares de la industria". La industria
 * no valida contra un LIBRO (las fórmulas de Kazmer): valida contra REALIDAD
 * INSTRUMENTADA. Este arnés saca nuestra validación real —enterrada como 4
 * checks dentro del gate de 192— a un RECIBO de primera clase: predicho vs
 * MEDIDO, con el error cuantificado y la fuente citada.
 *
 * VERDAD AJENA (la única, real): US11230635 Tabla 6 — espiral de flujo de ABS
 * Terluran medida a 3 temperaturas: 238°C→552 · 249°C→635 · 260°C→730 mm.
 * La espiral de flujo ES el test de moldeabilidad estándar de la industria.
 * Nuestro solver (modelo térmico N2: piel erf × Cross-WLF × power-law) la corre
 * desde PRIMEROS PRINCIPIOS — no está ajustado a esos números.
 *
 * Uso:  node --import tsx scripts/validacion-industria.cjs
 */
const path = require('path');

const R = (n, d = 1) => Number(n).toFixed(d);
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

(async () => {
  const ed = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'estudio-molde-datos.ts'));

  const TEMPS = [238, 249, 260];
  const MED = ed.ESPIRAL_PATENTE_MM;   // { 238:552, 249:635, 260:730 } — real, citado

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  RECIBO · VALIDACIÓN CONTRA MOLDE REAL (no contra el libro)           ║');
  console.log('║  Espiral de flujo · ABS · fuente: US11230635 Tabla 6 (medido)        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // ── correr el solver (modelo térmico completo) en las 3 isotermas ──
  const run = {};
  for (const T of TEMPS) {
    process.stdout.write(`  · corriendo ${T}°C (modelo térmico N2)… `);
    run[T] = ed.espiralN2Corrida(T);
    console.log(`L=${R(run[T].Lmm, 0)} mm · pMax=${R(run[T].r.pMaxMPa, 1)} MPa · t=${R(run[T].r.tFillS, 2)} s`);
  }

  // ── 1 · OBSERVABLE VALIDADO: longitud de flujo (predicho vs MEDIDO) ──
  console.log('\n── 1 · LONGITUD DE FLUJO — predicho vs MEDIDO (el test de la industria)');
  console.log(`  ${pad('T (°C)', 8)}${padL('medido', 10)}${padL('predicho', 12)}${padL('error', 10)}`);
  for (const T of TEMPS) {
    const e = MED[T], s = run[T].Lmm, d = (100 * (s - e) / e);
    console.log(`  ${pad(T, 8)}${padL(e + ' mm', 10)}${padL(R(s, 0) + ' mm', 12)}${padL((d >= 0 ? '+' : '') + R(d, 1) + ' %', 10)}`);
  }

  // ── 2 · LA FÍSICA FINA (tests SIN el sesgo de grado/presión) ──
  // El offset absoluto es sesgo DECLARADO (grado GP22NR del paper vs MG47
  // nuestro + intensificación 10:1 nominal). La física del modelo se juzga
  // donde esas incógnitas SE CANCELAN: los cocientes y la pendiente.
  console.log('\n── 2 · LA FÍSICA FINA — donde el grado y la presión se CANCELAN');
  const rSim = { 249: run[249].Lmm / run[238].Lmm, 260: run[260].Lmm / run[238].Lmm };
  const rMed = { 249: MED[249] / MED[238], 260: MED[260] / MED[238] };
  const cocOk = Math.abs(rSim[249] - rMed[249]) / rMed[249] <= 0.05 && Math.abs(rSim[260] - rMed[260]) / rMed[260] <= 0.05;
  console.log(`  cociente L(249)/L(238): sim ${R(rSim[249], 3)} vs medido ${R(rMed[249], 3)}  →  ${cocOk ? 'dentro de ±5 %' : 'FUERA'}`);
  console.log(`  cociente L(260)/L(238): sim ${R(rSim[260], 3)} vs medido ${R(rMed[260], 3)}`);
  const mSim = (run[260].Lmm - run[238].Lmm) / (260 - 238), mMed = (MED[260] - MED[238]) / (260 - 238);
  const penOk = Math.abs(mSim - mMed) / mMed <= 0.15;
  console.log(`  pendiente dL/dT:        sim ${R(mSim, 1)} mm/°C vs medido ${R(mMed, 1)} mm/°C  →  ${penOk ? 'dentro de ±15 %' : 'FUERA'}`);
  const mono = run[238].Lmm < run[249].Lmm && run[249].Lmm < run[260].Lmm;
  console.log(`  monotonía L crece con T: ${mono ? 'SÍ' : 'NO'}`);

  // ── 3 · EL SESGO SISTEMÁTICO, DECLARADO (no escondido) ──
  const sesgo = TEMPS.map((T) => 100 * (run[T].Lmm - MED[T]) / MED[T]);
  const sesgoMed = sesgo.reduce((a, b) => a + b, 0) / sesgo.length;
  console.log('\n── 3 · SESGO SISTEMÁTICO (declarado, no escondido)');
  console.log(`  offset medio: ${(sesgoMed >= 0 ? '+' : '') + R(sesgoMed, 1)} %  ·  causa: grado GP22NR (paper) vs MG47 (nuestro) + intensificación 10:1 nominal`);
  console.log(`  → por eso la física se juzga por COCIENTES/PENDIENTE (§2), no por el valor absoluto.`);

  // ── 4 · OBSERVABLES QUE PREDECIMOS (aún sin juez externo medido) ──
  console.log('\n── 4 · PREDICCIONES sin juez medido independiente (honesto)');
  for (const T of TEMPS) console.log(`  ${T}°C  ·  presión de inyección ${R(run[T].r.pMaxMPa, 1)} MPa  ·  llenado ${R(run[T].r.tFillS, 2)} s  ·  congela canal ${R(run[T].tcCanalS, 1)} s`);
  console.log('  NOTA: la traza de presión medida independiente sigue pendiente — el paper MDPI');
  console.log('        PMC8512013 publica GRÁFICAS, no tablas, y sin T_melt: no es número duro.');

  // ── VEREDICTO ── la física fina (sin sesgo) es la vara honesta
  const pass = cocOk && penOk && mono;
  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log(`  ${pass ? '✅' : '❌'} RECIBO ${pass ? 'FIRMADO' : 'REPROBADO'} — la física del solver reproduce la curva`);
  console.log(`     flujo-vs-temperatura MEDIDA (cocientes ±5 %, pendiente ±15 %), con el`);
  console.log(`     offset absoluto declarado. Contra realidad, no contra el libro.`);
  console.log('──────────────────────────────────────────────────────────────────────\n');
  console.log(`VERIFY_RESULT=${JSON.stringify({ pass, cocientesOk: cocOk, pendienteOk: penOk, monotonia: mono, offsetMedioPct: +R(sesgoMed, 1), Lsim: TEMPS.map((T) => run[T].Lmm), Lmed: TEMPS.map((T) => MED[T]) })}`);
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 500)); process.exit(1); });
