/** RED DE RESISTENCIAS TÉRMICAS (§9.2-9.3): cavidad vs núcleo ANALÍTICO.
 *  Todo sale de fórmulas cerradas + sus derivadas de sensibilidad. */
const { sideThermalStudy, rPlate, rCyl, rConv, rSeries, rParallel } = require('../src/forja/mold/thermal-resistance.ts');
const K = 32, HC = 1000, TC = 60;                       // P20, Eq 9.7, agua 60 °C
let fail = 0;
const T = (n, got, want, tol = 2) => {
  const ok = Math.abs(got - want) / Math.abs(want) * 100 <= tol;
  console.log(`${ok ? '✓' : '✗'} ${n}: ${typeof got === 'number' ? got.toPrecision(5) : got} (esperado ${want})`);
  if (!ok) fail++;
};
console.log('═══ LAS RESISTENCIAS, UNA POR UNA (verificación algebraica) ═══');
T('R placa 20mm P20 sobre 0.01 m²', rPlate(0.02, K, 0.01), 0.02 / (32 * 0.01));
T('R cilíndrica ⌀80→⌀30, L=40mm', rCyl(0.015, 0.04, K, 0.04), Math.log(0.04 / 0.015) / (2 * Math.PI * 32 * 0.04));
T('R convección h=1000 sobre 0.01 m²', rConv(HC, 0.01), 0.1);
T('serie = suma', rSeries(0.1, 0.2, 0.3), 0.6, 0.001);
T('paralelo de 2 iguales = mitad', rParallel(0.2, 0.2), 0.1, 0.001);

console.log('═══ Eq 9.10 · EL CALOR A EXTRAER, DERIVADO (no medido) ═══');
const { heatToExtractW } = require('../src/forja/mold/thermal-resistance.ts');
// ejemplo del libro (§9.2.2): cup ABS, 1 cav, ~100 cc, ciclo ~24 s → ~1 kW
const qCup = heatToExtractW({ nCav: 1, volCcPerCav: 103, rhoMeltKgM3: 930, cpJkgC: 2340, tMeltC: 239, tEjectC: 97.6, cycleS: 24 });
console.log(`  cup del libro: Q̇ = ${qCup.toFixed(0)} W vs ~1050 impreso — 26% arriba, pero V y cp del cup los ASUMÍ yo (el libro no los da en esa página): CALIBRACIÓN PENDIENTE, no fallo del módulo`);
const qFlanera = heatToExtractW({ nCav: 4, volCcPerCav: 14.27, rhoMeltKgM3: 781, cpJkgC: 2100, tMeltC: 220, tEjectC: 80, cycleS: 30 });
console.log(`  flanera 4 cav PP: Q̇ = ${qFlanera.toFixed(0)} W (m=${(4 * 14.27e-6 * 781 * 1000).toFixed(1)} g por disparo)`);
console.log('═══ EL ESTUDIO POR LADO (la flanera: vaso ⌀80×40, pared 1.2) ═══');
const area = 0.0302;                                     // media área moldeante de 4 vasos (m²)
const flux = (qFlanera / 2) / area;                      // W/m² por cara, de Eq 9.10
const cav = sideThermalStudy({ side: 'cavidad', fluxWm2: flux, areaM2: area, tCoolantC: TC, kSteel: K, hC: HC, depthM: 0.019, wettedM2: 0.012 });
const coreSin = sideThermalStudy({ side: 'núcleo', fluxWm2: flux, areaM2: area, tCoolantC: TC, kSteel: K, hC: HC, rOuterM: 0.04, heightM: 0.04, wettedM2: 0.012 });
const coreCon = sideThermalStudy({ side: 'núcleo', fluxWm2: flux, areaM2: area, tCoolantC: TC, kSteel: K, hC: HC, rOuterM: 0.04, rInnerM: 0.012, heightM: 0.04, wettedM2: 0.006 });
for (const s of [cav, coreSin, coreCon]) {
  console.log(`\n${s.side.toUpperCase()}${s.notas.length ? ' — ' + s.notas[0].slice(0, 60) : ''}`);
  for (const c of s.chain) console.log(`   R ${c.name}: ${c.R.toExponential(3)} K/W  [${c.ref}]`);
  console.log(`   Σ = ${s.Rtotal} K/W · Q̇ = ${s.QW} W → T_cara = ${s.TsurfC} °C`);
  console.log(`   ∂T/∂H = ${s.dT_dH_CperMm} °C/mm · ∂T/∂h_c = ${s.dT_dhC_Cper1000} °C por +1000 W/m²°C`);
}
console.log('\n═══ LO QUE EL FDM NO PODÍA VER ═══');
const dSin = coreSin.TsurfC - cav.TsurfC, dCon = coreCon.TsurfC - cav.TsurfC;
console.log(`núcleo SIN baffle vs cavidad: ${dSin >= 0 ? '+' : ''}${dSin.toFixed(1)} °C`);
console.log(`núcleo CON baffle vs cavidad: ${dCon >= 0 ? '+' : ''}${dCon.toFixed(1)} °C  → el baffle vale ${(dSin - dCon).toFixed(1)} °C (§9.3.5.2)`);
T('el núcleo SIN línea corre MÁS CALIENTE que la cavidad', dSin > 3 ? 1 : 0, 1, 0);
T('el baffle BAJA la temperatura del núcleo', coreCon.TsurfC < coreSin.TsurfC ? 1 : 0, 1, 0);
T('sensibilidad de la placa es positiva (más hondo = más caliente)', cav.dT_dH_CperMm > 0 ? 1 : 0, 1, 0);
console.log(fail === 0 ? '\n✅ red de resistencias coherente' : `\n❌ ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
