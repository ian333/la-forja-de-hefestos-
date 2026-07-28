/** EL CAMPO CON LA FORMA (cycle-averaged, k variable): ¿se ve la flanera? */
const { createThermalSim } = require('../src/forja/mold/mold-thermal-fdm.ts');
const { solveSteadyMoldField } = require('../src/forja/mold/thermal-steady.ts');
const { heatToExtractW } = require('../src/forja/mold/thermal-resistance.ts');
const { packageToAssemblySpec } = require('../src/forja/mold/mold-plano-set.ts');
const { moldMachine } = require('../src/forja/mold/moldmachine.ts');
const pkg = moldMachine({ name: 'Flanera', Lmm: 80, Wmm: 80, Hmm: 40, cavityShape: 'round', surfaceMm2: 15080, volumeMm3: 14266, wallMm: 1.2, annualVolume: 500000, plastic: 'PP', finish: 'SPI B-3' });
const v4 = pkg.variantes.find(v => v.arch === 'cold-2placas' && v.nCav === 4);
if (v4) pkg.recomendacion = { arch: 'cold-2placas', nCav: 4, porQue: [] };
const spec = packageToAssemblySpec(pkg);
const sim = createThermalSim(spec, { coolantC: 60 });
const plastic = sim.plasticVoxels();
let nP = 0; for (const v of plastic) if (v) nP++;
console.log(`grid ${sim.nx}×${sim.ny}×${sim.nz} (${(sim.nx*sim.ny*sim.nz/1000).toFixed(0)}k celdas) · celda ${sim.dx}mm`);
console.log(`PLÁSTICO voxelizado: ${nP} celdas = ${(nP * sim.dx ** 3 / 1000).toFixed(1)} cc (4 flaneras ≈ ${(4 * 14.27).toFixed(1)} cc de pared, más el hueco interior)`);
const Q = heatToExtractW({ nCav: 4, volCcPerCav: 14.27, rhoMeltKgM3: 781, cpJkgC: 2100, tMeltC: 220, tEjectC: 80, cycleS: 30 });
console.log(`Q̇ (Eq 9.10) = ${Q.toFixed(0)} W`);
const t0 = Date.now();
const f = solveSteadyMoldField({
  nx: sim.nx, ny: sim.ny, nz: sim.nz, dxMm: sim.dx, x0: sim.x0, y0: sim.y0, z0: sim.z0,
  plastic, cool: sim.cool, tCoolantC: 60, qTotalW: Q, lineDiaM: 0.00953, maxIters: 800, tolC: 1e-4,
});
console.log(`SOLVER: ${f.iters} iteraciones · residual ${f.residualC} °C · ${((Date.now()-t0)/1000).toFixed(1)} s`);
console.log(`CAMPO: ${f.minC} – ${f.maxC} °C`);
console.log(`SUPERFICIE MOLDEANTE (acero que toca el vaso): ${f.surfMinC} – ${f.surfMaxC} °C · media ${f.surfMeanC}`);
let fail = 0;
const T = (n, ok, w) => { console.log(`${ok ? '✓' : '✗'} ${n}${ok ? '' : ' — ' + w}`); if (!ok) fail++; };
T('el plástico tiene VOLUMEN en el grid (la forma existe)', nP > 100, `solo ${nP} celdas`);
T('el solver converge (CG)', f.residualC < 0.5, `residual ${f.residualC}`);
T('gradiente REAL en la superficie moldeante (la forma se nota)', (f.surfMaxC - f.surfMinC) > 1, `Δ=${(f.surfMaxC - f.surfMinC).toFixed(2)}`);
T('el plástico está MÁS CALIENTE que el acero (es aislante)', f.maxC > f.surfMeanC + 5, `max ${f.maxC} vs superficie ${f.surfMeanC}`);
T('rápido (<15 s para el estudio)', (Date.now()-t0) < 15000, `${((Date.now()-t0)/1000).toFixed(1)} s`);
console.log(fail === 0 ? '\n✅ el campo tiene la forma de la pieza' : `\n❌ ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
