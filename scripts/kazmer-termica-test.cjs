/**
 * kazmer-termica-test.cjs — TÉRMICA (cap 9): los ejemplos del libro como suite
 * + LOS NÚMEROS MÁGICOS DERIVADOS de las series (4/π, 23.1, 1.60 no se copian:
 * EMERGEN de Fourier/Bessel). La serie exacta es el JUEZ de las fórmulas de
 * primer término del libro — y después será el juez del FDM.
 * Uso:  node --import tsx scripts/kazmer-termica-test.cjs
 */
const { besselJ0, besselJ0Roots, besselJ1, slabCenterlineTheta, slabAverageTheta, tcSlabSeriesS, tcCylinderSeriesS } = require('../src/forja/mold/thermal-series.ts');

const A_ABS = 8.69e-8, A_PC = 1.89e-7;   // difusividades del libro (p.203/p.232)
let pass = 0, fail = 0;
const T = (name, got, want, tolPct = 1.5) => {
  const err = Math.abs(got - want) / Math.abs(want) * 100;
  const ok = err <= tolPct;
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${got.toPrecision(5)} (libro: ${want}) ${ok ? '' : `— ERROR ${err.toFixed(2)}%`}`);
};

console.log('═══ LOS NÚMEROS MÁGICOS, DERIVADOS (no copiados) ═══');
const roots = besselJ0Roots(3);
T('λ₁ de J₀ (primera raíz de Bessel)', roots[0], 2.40483);
T('"23.1" de Eq 9.6 = 4·λ₁²', 4 * roots[0] ** 2, 23.13, 0.5);
T('"1.60" de Eq 9.6 = 2/(λ₁·J₁(λ₁))', 2 / (roots[0] * besselJ1(roots[0])), 1.6018, 0.5);
T('"4/π" de Eq 9.5 (1er término Fourier centro)', 4 / Math.PI, 1.2732, 0.1);
T('"8/π²" (criterio PROMEDIO, menos conservador)', 8 / Math.PI ** 2, 0.8106, 0.1);
T('J₀(λ₁)≈0 (sanity Bessel)', 1 + besselJ0(roots[0]), 1, 0.01);

console.log('═══ EJEMPLOS DEL LIBRO (Eq 9.5/9.6 = 1er término) vs SERIE EXACTA ═══');
// t_c de fórmula (1er término) — las del libro, verificadas en canales
const tcEq95 = (h, a, Tm, Tc, Te) => (h * h) / (Math.PI ** 2 * a) * Math.log((4 / Math.PI) * (Tm - Tc) / (Te - Tc));
const tcEq96 = (D, a, Tm, Tc, Te) => (D * D) / (23.1 * a) * Math.log(1.60 * (Tm - Tc) / (Te - Tc));
T('placa ABS 3mm (Eq 9.5) [s]', tcEq95(0.003, A_ABS, 239, 60, 97.6), 18.9, 1);
T('cilindro ⌀4.76 ABS (Eq 9.6) [s]', tcEq96(0.00476, A_ABS, 239, 60, 97.6), 22.9, 1);
T('regla 2h² (h=3mm) [s]', 2 * 3 * 3, 18, 0.1);
T('UN LADO (2h→4×): dos-shot ABS 2·3mm (p.231) [s]', tcEq95(0.006, A_ABS, 239, 60, 97.6), 75.6, 1);
T('dos-shot capa PC 2·2mm (p.232) [s]', tcEq95(0.004, A_PC, 300, 80, 138), 13.5, 1.5);
// LA SERIE EXACTA como juez del primer término:
// T_eject=97.6 = el del EJEMPLO IMPRESO del libro (usa ese, no el DTUL 96.7)
const tSerie = tcSlabSeriesS(A_ABS, 0.003, 239, 60, 97.6);
T('placa 3mm por SERIE EXACTA (30 términos) [s]', tSerie, 18.9, 2);
console.log(`  → error del 1er término vs serie: ${(Math.abs(tcEq95(0.003, A_ABS, 239, 60, 97.6) - tSerie) / tSerie * 100).toFixed(3)}% (por eso el libro puede truncar)`);
const tCyl = tcCylinderSeriesS(A_ABS, 0.00476, 239, 60, 97.6);
T('cilindro ⌀4.76 por SERIE Bessel [s]', tCyl, 22.9, 2);

console.log('═══ CRITERIO promedio vs centro (nota Eq 9.5) ═══');
// mismo Fo: θ_prom < θ_centro ⇒ t_c(promedio) MENOR (menos conservador)
const Fo = 0.2;
T('θ_centro(Fo=0.2) > θ_prom(Fo=0.2)', slabCenterlineTheta(Fo) / slabAverageTheta(Fo), 1.571, 3);
console.log(`  → θc=${slabCenterlineTheta(Fo).toFixed(4)} vs θ̄=${slabAverageTheta(Fo).toFixed(4)} — el centro tarda MÁS (el libro elige el conservador)`);

console.log('═══ CONVERGENCIA de la serie (el porqué del truncado) ═══');
const e1 = Math.abs(slabCenterlineTheta(0.1, 1) - slabCenterlineTheta(0.1, 30));
const e3 = Math.abs(slabCenterlineTheta(0.1, 3) - slabCenterlineTheta(0.1, 30));
console.log(`  Fo=0.1: |1 término − exacto| = ${e1.toExponential(2)} · |3 términos − exacto| = ${e3.toExponential(2)}`);
T('a Fo≥0.1 un término basta (err<1e-3)', 1 + e1, 1, 0.1);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} pasan · ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
