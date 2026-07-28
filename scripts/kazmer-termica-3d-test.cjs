/**
 * kazmer-termica-3d-test.cjs — F2b: el FDM 3D DEL MOLDE contra el libro.
 * La prueba reina: con el plástico REAL acoplado (ya no depósito instantáneo),
 * la línea central del plástico debe cruzar T_eject en ~t_c de Eq 9.5.
 * Uso:  node --import tsx scripts/kazmer-termica-3d-test.cjs
 */
const { createThermalSim } = require('../src/forja/mold/mold-thermal-fdm.ts');
const { packageToAssemblySpec } = require('../src/forja/mold/mold-plano-set.ts');
const { moldMachine } = require('../src/forja/mold/moldmachine.ts');

let pass = 0, fail = 0;
const T = (name, got, want, tolPct = 10) => {
  const err = Math.abs(got - want) / Math.abs(want) * 100;
  const ok = err <= tolPct;
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${got.toPrecision(4)} (esperado: ${want}) ${ok ? '' : `— ERROR ${err.toFixed(1)}%`}`);
};

// pieza ABS de pared 3mm (la del ejemplo §9.1 del libro)
const spec = packageToAssemblySpec(moldMachine({
  name: 'placa-test', Lmm: 120, Wmm: 90, Hmm: 30, wallMm: 3,
  surfaceMm2: 2 * (120 * 90 + 120 * 30 + 90 * 30), volumeMm3: 120 * 90 * 3,
  annualVolume: 500000, plastic: 'ABS', cavityShape: 'rect',
}));
const sim = createThermalSim(spec, { coolantC: 60 });
console.log(`dominio ${sim.nx}×${sim.ny}×${sim.nz} · celda ${sim.dx}mm · material: ${sim.material.resina} (proxy=${sim.material.esProxy})`);

// arranque: inyección en t=0 (el step la dispara)
let tCross = -1, spike02 = -1e9;
for (let i = 0; i < 300; i++) {
  sim.step(0.1);
  if (sim.timeS <= 0.25 && sim.maxC > spike02) spike02 = sim.maxC;
  if (tCross < 0 && sim.plasticCenterMaxC() <= 97.6) tCross = sim.timeS;
  if (sim.timeS > 29) break;
}
console.log('═══ LA PRUEBA REINA: t_c del FDM 3D vs Eq 9.5 del libro ═══');
T('centro del plástico cruza 97.6 °C en [s] (libro: 18.9)', tCross, 18.9, 20);
console.log('═══ EL DEPÓSITO INSTANTÁNEO, MUERTO ═══');
T('T máx del acero en t≤0.25 s [°C] (antes: brinco +37° en 0 s; contacto real ≈ 69.7)', spike02, 69.7, 25);
console.log('═══ SANIDAD ═══');
T('acero jamás supera T_melt', sim.maxC < 239 ? 1 : 0, 1, 0);
T('plástico enfría monótono (centro a 29 s < 97.6)', sim.plasticCenterMaxC() < 97.6 ? 1 : 0, 1, 0);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} pasan · ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
