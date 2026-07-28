/** ESTUDIO POR PLACAS (§9.2-9.3): cavidad vs núcleo POR SEPARADO — lo que un
 *  estudio térmico de verdad entrega (no un mapa difuso). */
const { createThermalSim } = require('../src/forja/mold/mold-thermal-fdm.ts');
const { packageToAssemblySpec } = require('../src/forja/mold/mold-plano-set.ts');
const { moldMachine } = require('../src/forja/mold/moldmachine.ts');
const pkg = moldMachine({ name: 'Flanera', Lmm: 80, Wmm: 80, Hmm: 40, cavityShape: 'round', surfaceMm2: 15080, volumeMm3: 14266, wallMm: 1.2, annualVolume: 500000, plastic: 'PP', finish: 'SPI B-3' });
const v4 = pkg.variantes.find(v => v.arch === 'cold-2placas' && v.nCav === 4);
if (v4) pkg.recomendacion = { arch: 'cold-2placas', nCav: 4, porQue: [] };
const sim = createThermalSim(packageToAssemblySpec(pkg), { coolantC: 60 });
sim.warmUp(8);
const st = sim.surfaceStudy();
console.log('═══ ESTUDIO POR PLACA (régimen, t =', sim.timeS.toFixed(0), 's) ═══');
console.log(`CAVIDAD (placa A): ${st.cav.minC}–${st.cav.maxC} °C · media ${st.cav.meanC} · ΔT ${st.cav.dTC} °C (${st.cav.n} celdas de cara moldeante)`);
console.log(`NÚCLEO  (placa B): ${st.core.minC}–${st.core.maxC} °C · media ${st.core.meanC} · ΔT ${st.core.dTC} °C (${st.core.n} celdas)`);
console.log(`Δ entre placas: ${(st.core.meanC - st.cav.meanC).toFixed(2)} °C ${st.core.meanC > st.cav.meanC ? '(el NÚCLEO más caliente — §9.3.6: lo rodea el plástico)' : '(la cavidad más caliente)'}`);
console.log('═══ VELOCIDAD DE CONDUCCIÓN (lo que pediste) ═══');
console.log(`δ = √(α·t_ciclo) = ${st.deltaMm} mm · el acero MÁS ALLÁ de esa profundidad NO siente el ciclo (bulk estable); dentro, oscila cada disparo`);
console.log('═══ FLUJO DE CALOR (la salida que da una herramienta seria) ═══');
console.log(`cara de cavidad: ${(st.fluxCavWm2 / 1000).toFixed(1)} kW/m² · cara de núcleo: ${(st.fluxCoreWm2 / 1000).toFixed(1)} kW/m²`);
console.log('═══ GRADIENTE EN EL ACERO (cara moldeante → línea de agua, Eq 9.21) ═══');
console.log(`lado cavidad: ${st.dTSteelCavC} °C · lado núcleo: ${st.dTSteelCoreC} °C`);
let fail = 0;
const T = (n, ok, why) => { console.log(`${ok ? '✓' : '✗'} ${n}${ok ? '' : ' — ' + why}`); if (!ok) fail++; };
T('las dos caras se miden por separado', st.cav.n > 0 && st.core.n > 0, 'una de las dos quedó vacía');
T('δ del orden de mm (P20, ciclo 30 s)', st.deltaMm > 5 && st.deltaMm < 40, `δ=${st.deltaMm}`);
T('flujo saliente positivo del plástico al acero', st.fluxCavWm2 > 0 && st.fluxCoreWm2 > 0, 'el plástico no está entregando calor');
T('ΔT de superficie bajo control (<15 °C, §9.2.3)', st.cav.dTC < 15 && st.core.dTC < 15, `Δcav=${st.cav.dTC} Δcore=${st.core.dTC}`);
console.log(fail === 0 ? '\n✅ estudio por placas coherente' : `\n❌ ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
