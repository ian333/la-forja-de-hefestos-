/**
 * DEMO — una IA (este script) CONSTRUYE máquinas por la INTERFAZ de La Forja y
 * CALCULA su mecánica (peso, fricción, fuerzas, torque). Sin hardcodear piezas:
 * toda la geometría sale de window.__forgeBrep (igual que la usaría un humano).
 *
 * Correr:  node --import tsx scripts/demo-maquinas.cjs   (tsx para importar dinamica.ts)
 */
const path = require('path');
const { ForjaAgent } = require('./forja-agent.cjs');

const OUT = process.env.OUT || '/tmp/forja-maquinas';
const ALU_DENSITY = 0.0027; // g/mm³ (aluminio) — para estimar masa de cada eslabón

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const dyn = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mech', 'dinamica.ts'));
  const a = await new ForjaAgent().open();
  const report = {};

  // ════════════════ 1) CARRO (rover 4×4) ════════════════
  // Chasis = placa extruida; 4 ruedas = cilindros en las esquinas. TODO por la interfaz.
  await a.newDoc();
  await a.sketch({ kind: 'rect', width: 140, height: 70 });
  await a.updateOpByType('extrude', { depth: 14 });
  await a.material('alu');
  const wheelR = 22, wheelH = 14;
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    await a.addComponent('cyl', { r: wheelR, h: wheelH, x: sx * 55, y: sy * 28, z: -7 });
  }
  await a.view('iso');
  const roverMassKg = await a.massKg();
  await a.shot(`${OUT}/rover.png`);

  // Mecánica del carro (μ=0.7 hule-asfalto, 4 ruedas motrices):
  const veh = dyn.vehicleDynamics({ massKg: roverMassKg, wheels: 4, wheelRadiusM: wheelR / 1000, mu: 0.7, crr: 0.015 });
  report.rover = {
    construido_por: 'interfaz (sketch+extrude chasis, 4 componentes-cilindro = ruedas)',
    masa_kg: +roverMassKg.toFixed(3),
    peso_N: +veh.weightN.toFixed(2),
    carga_por_rueda_N: +veh.perWheelN.toFixed(2),
    traccion_max_N: +veh.tractionMaxN.toFixed(2),
    rodadura_N: +veh.rollingResistN.toFixed(2),
    empuje_neto_N: +veh.netForceN.toFixed(2),
    aceleracion_max_ms2: +veh.maxAccel.toFixed(2),
    pendiente_max_grados: +veh.maxGradeDeg.toFixed(1),
    torque_por_rueda_Nm: +veh.motorTorquePerWheelNm.toFixed(3),
    sube_20deg: veh.canClimbDeg(20), sube_40deg: veh.canClimbDeg(40),
  };

  // ════════════════ 2) ROBOT (brazo 2 eslabones sobre base) ════════════════
  await a.newDoc();
  await a.sketch({ kind: 'rect', width: 40, height: 40 }); // base/pedestal
  await a.updateOpByType('extrude', { depth: 12 });
  await a.material('alu');
  // Eslabón 1 (horizontal, +X) y eslabón 2 (acodado 45°), como cajas posicionadas.
  const L1 = 120, L2 = 90, sec = 20;
  await a.addComponent('box', { w: L1, d: sec, h: sec, x: L1 / 2, y: 0, z: 6, rz: 0 });
  const e2cx = L1 + (L2 / 2) * Math.cos(Math.PI / 4);
  const e2cy = (L2 / 2) * Math.sin(Math.PI / 4);
  await a.addComponent('box', { w: L2, d: sec, h: sec, x: e2cx, y: e2cy, z: 6, rz: 45 });
  await a.view('iso');
  const armMassKg = await a.massKg();
  await a.shot(`${OUT}/robot.png`);

  // Masa de cada eslabón por su geometría × densidad (alu); carga 0.5 kg en la punta.
  const m1 = (L1 * sec * sec) * ALU_DENSITY / 1000; // kg
  const m2 = (L2 * sec * sec) * ALU_DENSITY / 1000;
  const arm = dyn.armStatics({ links: [{ lengthM: L1 / 1000, massKg: m1 }, { lengthM: L2 / 1000, massKg: m2 }], payloadKg: 0.5 });
  report.robot = {
    construido_por: 'interfaz (base sketch+extrude, 2 componentes-caja = eslabones acodados)',
    masa_ensamble_kg: +armMassKg.toFixed(3),
    masa_eslabones_kg: [+m1.toFixed(3), +m2.toFixed(3)],
    alcance_m: +arm.reachM.toFixed(3),
    torque_hombro_Nm: +arm.baseTorqueNm.toFixed(3),
    torque_codo_Nm: +arm.jointTorquesNm[1].toFixed(3),
    torque_solo_carga_Nm: +arm.payloadTorqueNm.toFixed(3),
    nota: 'torque de sostén con el brazo HORIZONTAL (momento máximo). Carga 0.5 kg.',
  };

  report.telemetria = a.telemetry();
  await a.close();
  require('fs').writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nstills → ${OUT}/rover.png , ${OUT}/robot.png`);
})();
