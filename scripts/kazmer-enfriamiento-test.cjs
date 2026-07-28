/**
 * kazmer-enfriamiento-test.cjs — EL PROCESO DE DISEÑO DEL ENFRIAMIENTO (§9.2)
 * ===========================================================================
 * Primero REPRODUCE el ejemplo resuelto del libro (molde familia cup/lid,
 * p. 206-213) número por número. Sólo después se le cree a la flanera.
 *   npx tsx scripts/kazmer-enfriamiento-test.cjs
 */
const C = require('../src/forja/mold/cooling-design.ts');
const { moldMachine } = require('../src/forja/mold/moldmachine.ts');
const P = require('../src/forja/mold/mold-plano-set.ts');
const D = require('../src/forja/mold/mold-drawing-set.ts');

let fail = 0;
const T = (n, got, want, tolPct = 2) => {
  const ok = Math.abs(got - want) / Math.abs(want) * 100 <= tolPct;
  console.log(`${ok ? '✓' : '✗'} ${n}: ${typeof got === 'number' ? +got.toPrecision(5) : got}  (libro ${want})`);
  if (!ok) fail++;
};

console.log('═══ EL EJEMPLO DEL LIBRO: molde familia cup/lid, ABS (p.206-213) ═══');
const agua = C.AGUA;
// §9.2.2 — Eq 9.10: "The mass of the two moldings totals 62.6 g"
const qShot = C.heatPerShotJ(0.0626, 2340, 239, 96.7);
T('Eq 9.10  Q_moldings', qShot, 20900, 1);
// Eq 9.11 — "designed for a cooling time of 20 s"
const qCool = qShot / 20;
T('Eq 9.11  Q̇_cooling', qCool, 1050, 1);
// Eq 9.12 — "4 cooling lines (2 lines per side)"
const qLine = qCool / 4;
T('Eq 9.12  Q̇_line', qLine, 260, 1);
// Eq 9.13 — ΔT permitido 1 °C
const vDot = qLine / (agua.rhoKgM3 * agua.cpJkgC * 1);
T('Eq 9.13  V̇_line', vDot, 6.2e-5, 1);
T('         V̇_total (4 líneas)', vDot * 4, 2.5e-4, 2);
// Eq 9.15 — "a maximum diameter of 20 mm"
T('Eq 9.15  D_max', C.dMaxTurbulentM(agua, vDot) * 1000, 20, 2);
// Eq 9.17 — L=0.6 m (las DOS líneas de 302 mm en SERIE), ΔP = 100 kPa
T('Eq 9.17  D_min', C.dMinPressureM(agua, 0.6, vDot, 100e3) * 1000, 3.7, 2);
// §9.2.4 — el ⌀ elegido de la Tabla 9.2
const dSel = C.PLUGS_DME.find((p) => p.diaMm === 6.35);
T('Tabla 9.2 ⌀ elegido', dSel.diaMm, 6.35, 0.1);
console.log(`   plug ${dSel.plug} (NPT ${dSel.npt}) — "a reasonable cooling line diameter is 6.35 mm"`);
// Eq 9.14 — con ese ⌀, ¿turbulento?
const re = C.reynoldsLine(agua, vDot, 0.00635);
console.log(`${re > 4000 ? '✓' : '✗'} Eq 9.14  Re = ${re.toFixed(0)} > 4000 (turbulento)`);
if (re <= 4000) fail++;
// §9.2.5 — "the depth will be set to four cooling line diameters" → 25.4 mm
T('Eq 9.22  H = 4D', 4 * 6.35, 25.4, 0.1);
T('Fig 9.4  SCF a H=4D', C.stressConcentration(4), 2.6, 0.1);
T('Eq 9.19  P_melt máx', C.maxMeltPressureMPa(456, 2.6), 175, 1);
// Eq 9.21 — "P20 k=32 suggests a maximum cooling line depth of 32 mm"
T('Eq 9.21  H_max térmica (P20)', C.hLineMaxM(32) * 1000, 32, 0.1);
T('Fig 9.4  SCF a H=1D', C.stressConcentration(1), 3.3, 0.1);
// §9.2.5 — el molde de ALUMINIO: 166 MPa / 3.3 = 50 MPa
T('Eq 9.19  aluminio a H=1D', C.maxMeltPressureMPa(166, 3.3), 50, 1);
// Tabla 9.1 — el VacTherm alcanza para el cup/lid
const ok1 = C.CONTROLADORES[0].flowM3s >= vDot * 4;
console.log(`${ok1 ? '✓' : '✗'} Tabla 9.1  un solo VacTherm basta (${(vDot * 4).toExponential(2)} ≤ 1e-3 m³/s)`);
if (!ok1) fail++;

console.log('\n═══ EL PROCESO COMPLETO (lazo cerrado) SOBRE EL CUP/LID ═══');
// mismo caso, pero dejando que el módulo DERIVE n_lines del paso y la banda.
// Volumen equivalente a los 62.6 g de ABS a 1044 kg/m³ (Apéndice A, ρ a 20 °C).
const cup = C.coolingDesign({
  nCav: 1, partVolCc: 62.6 / 1.044, thickestMm: 3,
  rhoRTKgM3: 1044, cpJkgC: 2340, alphaM2s: 8.73e-8,
  tMeltC: 239, tEjectC: 96.7, tCoolantC: 60,
  kMoldWmC: 32, sigmaEnduranceMPa: 456,
  bandMm: 150, lineLenMm: 302, linesInSeries: 2, sides: 2,
  tcS: 20, forceDiaMm: 6.35,
});
for (const r of cup.rows) console.log(`   ${r.k.padEnd(12)} ${r.v}   [${r.ref}]`);
T('cup/lid: Q̇ del proceso', cup.qCoolingW, 1050, 2);

console.log('\n═══ LA FLANERA: 4 CAVIDADES, PP — LO QUE PIDE EL LIBRO ═══');
// geometría REAL del molde ya armado (no números a mano)
const pkg = moldMachine({ name: 'Flanera', Lmm: 80, Wmm: 80, Hmm: 40, cavityShape: 'round',
  surfaceMm2: 15080, volumeMm3: 14266, wallMm: 1.2, annualVolume: 500000, plastic: 'PP', finish: 'SPI B-3' });
pkg.recomendacion = { arch: 'cold-2placas', nCav: 4, porQue: [] };
const s = P.packageToAssemblySpec(pkg);
const cells = D.cavityGrid(s, s.depthMm);
const ys = cells.map((c) => c.cy), rim = s.cavity.widthMm / 2;
const banda = (Math.max(...ys) + rim) - (Math.min(...ys) - rim);
const circ = D.coolingCircuit(s, s.depthMm);
const lineLen = Math.max(...circ.segs.map((g) => Math.hypot(g.x1 - g.x0, g.y1 - g.y0)));
console.log(`   molde ${s.widthMm}×${s.depthMm} · ${cells.length} cav · banda a cubrir ${banda} mm`);
console.log(`   circuito ACTUAL: ${circ.segs.length} línea(s) de ${lineLen.toFixed(0)} mm · ⌀${circ.diaMm} · H ${s.cooling.insetMm} mm`);

const flan = C.coolingDesign({
  nCav: 4, partVolCc: 14.27, runnerVolCc: 3.08, thickestMm: 1.5,
  rhoRTKgM3: 929, cpJkgC: 2890, alphaM2s: 8.15e-8,     // Apéndice A · PP Inspire 702
  tMeltC: 220, tEjectC: 80, tCoolantC: 40,
  kMoldWmC: 32, sigmaEnduranceMPa: 456,
  bandMm: banda, lineLenMm: lineLen, linesInSeries: 2, sides: 2,
  forceDiaMm: circ.diaMm,
});
console.log(`   (lazo cerrado en ${flan.iters} iteración(es))`);
for (const r of flan.rows) console.log(`   ${r.k.padEnd(12)} ${r.v}   [${r.ref}]`);

console.log('\n─── contra el cálculo A MANO ───');
T('t_c a mano', flan.tcS, 4.88, 1);
T('Q disparo a mano', flan.qShotJ, 22604, 1);
T('Q̇ a mano', flan.qCoolingW, 4632, 1);
// H: 4D = 38.1 mm lo RECORTA Eq 9.21 a k/1000 = 32 mm (el hallazgo del estudio)
T('H recortado por Eq 9.21', flan.hLineMm, 32, 0.5);
T('paso a mano (2H)', flan.wLineMm, 64, 0.5);
T('líneas a mano', flan.nLines, 6, 0.1);
T('Q̇/línea a mano', flan.qLineW, 771.8, 1);
T('V̇/línea a mano', flan.vDotLineM3s, 1.8376e-4, 1);
T('Re a mano', flan.reynolds, 24551, 1);
T('ΔP a mano', flan.dPKPa, 3.39, 3);
T('D_min a mano', flan.dMinMm, 4.85, 2);
T('V̇ total a mano', flan.vDotTotalGPM, 17.5, 2);

console.log('\n─── VEREDICTO SOBRE EL MOLDE COMO ESTÁ ───');
const actual = C.coolingDesign({
  nCav: 4, partVolCc: 14.27, runnerVolCc: 3.08, thickestMm: 1.5,
  rhoRTKgM3: 929, cpJkgC: 2890, alphaM2s: 8.15e-8,
  tMeltC: 220, tEjectC: 80, tCoolantC: 40,
  kMoldWmC: 32, sigmaEnduranceMPa: 456,
  bandMm: banda, lineLenMm: lineLen, linesInSeries: 1, sides: 1,
  forceDiaMm: circ.diaMm, forceLinesPerSide: circ.segs.length,   // el circuito REAL
});
console.log(`   con ${circ.segs.length} línea de ${lineLen.toFixed(0)} mm: ${actual.vDotLineGPM.toFixed(1)} GPM en UNA línea`);
console.log(`   el VacTherm entrega 15 GPM TOTALES (Tabla 9.1) → imposible`);
const hActual = s.cooling.insetMm;
const viola921 = hActual > C.hLineMaxM(32) * 1000;
console.log(`   H actual ${hActual} mm vs Eq 9.21 (k/1000 = 32 mm): ${viola921 ? '✗ VIOLA' : '✓ ok'}`);
for (const f of actual.fallas) console.log(`   ✗ ${f}`);

console.log(`\n${fail === 0 ? '✅ TODO CUADRA' : `❌ ${fail} FALLAS`} — ${fail === 0 ? 'el módulo reproduce el libro y el cálculo a mano' : 'revisar'}`);
process.exit(fail === 0 ? 0 : 1);
