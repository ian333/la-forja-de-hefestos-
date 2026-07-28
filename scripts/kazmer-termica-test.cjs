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

// ═══════════ CAPAS: plástico → acero → agua (LA BASE que estaba mal) ═══════════
const { TM_ABS_MELT, TM_P20, effusivity, contactTemperature, makeLayeredFDM, steadyFluxChain } = require('../src/forja/mold/thermal-layers.ts');
const { tcSlabSeriesS: tcS } = require('../src/forja/mold/thermal-series.ts');
console.log('═══ CAPAS · contacto por EFUSIVIDAD (por qué el acero gana) ═══');
T('b_ABS fundido √(kρCp)', effusivity(TM_ABS_MELT), 643, 1);
T('b_P20', effusivity(TM_P20), 11186, 1);
T('T contacto ABS 239° ↔ P20 60° [°C]', contactTemperature(TM_ABS_MELT, 239, TM_P20, 60), 69.7, 1);
T('α ABS impresa = k/(ρ_FUNDIDO·Cp)', TM_ABS_MELT.k / (TM_ABS_MELT.rho * TM_ABS_MELT.cp) / 8.73e-8, 1, 1);
T('α P20 impresa', TM_P20.k / (TM_P20.rho * TM_P20.cp) / 8.18e-6, 1, 1);

console.log('═══ CAPAS · el FDM multicapa contra sus jueces ═══');
// JUEZ 1 — reducción a 1 capa isoterma: acero "infinitamente conductor" (h_c
// gigante y sin acero) debe reproducir la SERIE EXACTA de la placa.
{
  // h_c=20,000 (Bi=158 ≫ 1 ≈ isotermo al 1%) — h_c=1e9 mataba el dt (2e-8 s)
  const f = makeLayeredFDM([{ mat: TM_ABS_MELT, thickMm: 1.5, cells: 60, T0: 239 }], 20000, 60);
  const t = f.runUntil(() => f.Tcenter <= 97.6, 60);
  T('FDM 1 capa (media pared 1.5mm, Bi≫1) vs serie [s]', t, tcS(8.73e-8, 0.003, 239, 60, 97.6), 2.5);
}
// JUEZ 2 — contacto: a tiempos cortos la interfaz plástico|acero debe estar
// en la T de efusividades (69.7°), NO en el promedio simple (149.5°).
{
  const f = makeLayeredFDM([
    { mat: TM_ABS_MELT, thickMm: 1.5, cells: 90, T0: 239 },
    { mat: TM_P20, thickMm: 10, cells: 90, T0: 60 },
  ], 1000, 60);
  f.runUntil(() => f.t >= 0.02, 1);                      // 20 ms de contacto
  T('interfaz FDM a 20ms vs efusividades [°C]', f.interfaceT(0), 69.7, 4);
  console.log(`  → promedio ingenuo daría 149.5° — la media armónica + capas da lo FÍSICO`);
}
// JUEZ 3 — permanente: fuente fija en el centro → flujo = cadena de resistencias.
{
  const HOLD = 239;
  const f = makeLayeredFDM([
    { mat: TM_ABS_MELT, thickMm: 1.5, cells: 30, T0: HOLD },
    { mat: TM_P20, thickMm: 25, cells: 60, T0: 60 },
  ], 1000, 60);
  for (let i = 0; i < 400000; i++) { f.step(); f.T[0] = HOLD; }   // sostener la fuente
  const qChain = steadyFluxChain(HOLD, 60, [
    { thickMm: 1.5 - (1.5 / 30) / 2, k: TM_ABS_MELT.k },          // del centro de la celda fuente
    { thickMm: 25, k: TM_P20.k },
  ], 1000);
  T('flujo permanente FDM vs cadena ΣR [W/m²]', f.fluxOut, qChain, 2);
}
// LA LECCIÓN DE PLACAS (Eq 9.20-9.21): el acero casi no estorba, el agua manda
{
  const R_acero25 = 0.025 / TM_P20.k, R_conv = 1 / 1000;
  console.log(`  → R acero 25mm = ${(R_acero25 * 1e3).toFixed(2)} vs R convección = ${(R_conv * 1e3).toFixed(2)} m²°C/kW: el AGUA domina (Eq 9.7) — profundidad de línea casi no cambia el flujo (Eq 9.21), cambia la UNIFORMIDAD`);
}
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} pasan · ${fail} fallan (con capas)`);
process.exit(fail === 0 ? 0 : 1);
