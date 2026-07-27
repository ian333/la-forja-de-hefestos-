/**
 * kazmer-canales-test.cjs — LOS EJEMPLOS RESUELTOS del libro (caps 6+7) como
 * suite ejecutable. Si el código reproduce los números de Kazmer, los CANALES
 * están bien; si no, están rotos y este script lo dice con cifras.
 * Constantes DEL LIBRO: ABS k=17,000 Pa·sⁿ, n=0.35, α=8.69e-8 m²/s.
 * Uso:  node --import tsx scripts/kazmer-canales-test.cjs
 */
const { reynolds, shearRateRunner, pressureDropRunner, feedVolume, minRunnerRadius, optimizeFeedSystem, runnerCoolingTimeS, steelSafeDiaMm } = require('../src/forja/mold/feed.ts');
const { shearRateStrip, shearRateCyl, gateRadiusForShear, gateDropStripPL, gateDropCylNewt, gateFreezeStripS, gateFreezeCylS } = require('../src/forja/mold/gating.ts');

const ABS = { k: 17000, n: 0.35 };            // el libro usa estos en TODOS los ejemplos
const ALPHA = 8.69e-8;                        // difusividad ABS (p.149/p.203)
let pass = 0, fail = 0;
const T = (name, got, want, tolPct = 3) => {
  const err = Math.abs(got - want) / Math.abs(want) * 100;
  const ok = err <= tolPct;
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${got.toPrecision(4)} (libro: ${want}) ${ok ? '' : `— ERROR ${err.toFixed(1)}%`}`);
};

console.log('═══ CAP 6 · FEED SYSTEM (hot runner del bezel, p.139-140) ═══');
T('ΔP sprue L=90 R=6 @125cc/s [MPa]', pressureDropRunner(ABS, { name: 's', L: 0.09, R: 0.006, Vdot: 125e-6 }) / 1e6, 5.9);
T('ΔP manifold L=118 R=5 @62.5 [MPa]', pressureDropRunner(ABS, { name: 'm', L: 0.118, R: 0.005, Vdot: 62.5e-6 }) / 1e6, 8.8);
T('ΔP nozzle L=108 R=3.5 @62.5 [MPa]', pressureDropRunner(ABS, { name: 'n', L: 0.108, R: 0.0035, Vdot: 62.5e-6 }) / 1e6, 16.7);

console.log('═══ Optimización Eq 6.8/6.9 (30 MPa asignado por longitud, p.143-144) ═══');
const opt = optimizeFeedSystem(ABS, [
  { name: 'sprue', L: 0.09, Vdot: 125e-6 },
  { name: 'manifold', L: 0.118, Vdot: 62.5e-6 },
  { name: 'nozzle', L: 0.108, Vdot: 62.5e-6 },
], 30e6);
T('R sprue [mm]', opt[0].R * 1000, 5.0);
T('R manifold [mm]', opt[1].R * 1000, 4.4);
T('R nozzle [mm]', opt[2].R * 1000, 4.4);

console.log('═══ Balanceo artificial cup/lid (p.146-147) ═══');
T('R runner→cup (ΔP30 @44cc/s L=38) [mm]', minRunnerRadius(ABS, 0.038, 44e-6, 30e6) * 1000, 1.5);
T('R runner→lid (ΔP31.4 @19cc/s) [mm]', minRunnerRadius(ABS, 0.038, 19e-6, 31.4e6) * 1000, 1.26);
T('R sprue frío (ΔP20 @63cc/s L=76) [mm]', minRunnerRadius(ABS, 0.076, 63e-6, 20e6) * 1000, 2.7);

console.log('═══ Volumen + regrind (p.148) ═══');
const volCc = feedVolume([
  { name: 'sprue', L: 0.076, R: 0.0027, Vdot: 0 },
  { name: 'r-cup', L: 0.038, R: 0.0015, Vdot: 0 },
  { name: 'r-lid', L: 0.038, R: 0.00126, Vdot: 0 },
]) * 1e6;
T('V colada fría [cc]', volCc, 2.16, 5);
T('% regrind vs 63cc de piezas', volCc / 63 * 100, 3.5, 6);

console.log('═══ Re + t_c del runner ═══');
const re = reynolds(1000, 50e-6, 100, 0.01);
T('Re típico (≈0.06, laminar TOTAL)', re, 0.0637, 5);
T('t_c runner ⌀4.76 ABS [s] (p.203, coef 1.60 Eq 9.6)', runnerCoolingTimeS(ALPHA, 0.00476, 239, 60, 97.6), 22.9);
console.log('  (errata documentada: Tabla 6.2 imprime 0.692 y el sprue de p.149 da 26.7 — no reproduce ni consigo mismo)');

console.log('═══ CAP 7 · GATES (p.177-181) ═══');
T('γ̇ edge gate W=6 h=0.75 @62.5cc/s [1/s]', shearRateStrip(62.5e-6, 0.006, 0.00075), 111000);
T('γ̇ pin ⌀1.5 @44cc/s [1/s]', shearRateCyl(44e-6, 0.00075), 132000);
T('R gate para γ̇max=50k @44cc/s [mm]', gateRadiusForShear(44e-6, 50000) * 1000, 1.03);
T('ΔP fan gate strip PL [MPa]', gateDropStripPL(ABS, 0.01, 0.01, 0.0035, 62.5e-6) / 1e6, 1.9);
T('ΔP pin Newton μ=5.4 [MPa]', gateDropCylNewt(5.4, 0.001, 0.00075, 44e-6) / 1e6, 1.9);
T('freeze pin ⌀2 (Tabla 7.4 cyl) [s]', gateFreezeCylS(ALPHA, 0.002, 240, 60, 132), 1.1);
T('freeze estructura strip = Eq 9.5 con T_eject (p.203) [s]', gateFreezeStripS(ALPHA, 0.003, 239, 60, 97.6) /
  Math.log((8 / Math.PI ** 2) * (239 - 60) / (97.6 - 60)) * Math.log((4 / Math.PI) * (239 - 60) / (97.6 - 60)), 18.9);
console.log('  (errata documentada: los strip pack-times impresos 1.5s/24s dan 0.76s/12.1s con la fórmula de su propia Tabla 7.4)');

console.log('═══ Steel safe (§6.5.5) ═══');
T('4.6mm → estándar hacia abajo', steelSafeDiaMm(4.6), 4.5);
T('5.4mm → 5', steelSafeDiaMm(5.4), 5);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} pasan · ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
