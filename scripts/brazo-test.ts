/* Verifica el motor del brazo (cinemática, carga, capacidad, óptimo). node --import tsx scripts/brazo-test.ts */
import { beamMass, armKinematics, jointTorques, cycloidalCapacity, capacitySweep, sizeJoint, sizeArm } from '../src/forja/mech/brazo';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 0.05) => Math.abs(a - b) < t;
const ck = (n: string, ok: boolean, x = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${n} ${x}`); } };

// Cinemática: 3 eslabones que suman ≥1.20 m.
const LINKS = [450, 400, 350]; // mm → 1.20 m
ck('alcance estirado = 1.20 m', near(armKinematics(LINKS).reach_m, 1.2, 1e-3));
ck('workspace esférico, 3 DOF', armKinematics(LINKS).dof === 3 && armKinematics(LINKS).workspace.includes('esférico'));

// Carga: el hombro carga MÁS que el codo que la muñeca.
const tq = jointTorques({ links: LINKS, payloadKg: 0.5 });
ck('torque hombro > codo > muñeca', tq.jointTorque_Nm[0] > tq.jointTorque_Nm[1] && tq.jointTorque_Nm[1] > tq.jointTorque_Nm[2], JSON.stringify(tq.jointTorque_Nm));
ck('masa del brazo razonable (0.3–3 kg PLA)', tq.armMass_kg > 0.3 && tq.armMass_kg < 3, `${tq.armMass_kg}`);
ck('torque del hombro en rango (varios N·m)', tq.shoulder_Nm > 1 && tq.shoulder_Nm < 50, `${tq.shoulder_Nm}`);

// Capacidad: AXIAL lineal (∝N), RADIAL cuadrático (∝R²) — la prueba que pidió el user.
ck('doblar N (discos) → DOBLE capacidad (axial lineal)', near(cycloidalCapacity({ N: 6, t: 6, R: 30 }) / cycloidalCapacity({ N: 3, t: 6, R: 30 }), 2, 0.01));
ck('doblar R → CUÁDRUPLE capacidad (radial cuadrático)', near(cycloidalCapacity({ N: 3, t: 6, R: 60 }) / cycloidalCapacity({ N: 3, t: 6, R: 30 }), 4, 0.01));
ck('más ancho t → más capacidad (lineal)', cycloidalCapacity({ N: 3, t: 12, R: 30 }) > cycloidalCapacity({ N: 3, t: 6, R: 30 }));

// Barrido radial × axial.
const sw = capacitySweep({ Rs: [20, 30, 40], Ns: [2, 3, 4, 5], t: 6 });
ck('barrido: malla R×N llena', sw.length === 4 && sw[0].byR.length === 3 && sw[3].byR[2].T > sw[0].byR[0].T);

// Dimensionar el hombro: hallar N para su torque, robusto.
const sj = sizeJoint({ torqueReq_Nm: tq.shoulder_Nm, Rmax: 35, SF: 2.5, t: 6 });
ck('dimensiona el hombro: N≥2, margen ≥ SF', sj.N >= 2 && sj.margin >= 2.5 - 0.3, JSON.stringify({ N: sj.N, R: sj.R, margin: sj.margin }));
ck('avisa si la pila axial se hace muy larga', typeof sj.axialOK === 'boolean');

// Dimensionar TODO el brazo.
const arm = sizeArm({ links: LINKS, payloadKg: 0.5 }, [40, 32, 26], { SF: 2.5, t: 6 });
ck('brazo: 3 juntas dimensionadas (hombro/codo/muñeca)', arm.joints.length === 3 && arm.joints[0].joint === 'hombro');
ck('el hombro recibe MÁS discos o más R que la muñeca', arm.joints[0].N * arm.joints[0].R ** 2 >= arm.joints[2].N * arm.joints[2].R ** 2);

console.log(`\nBRAZO_TEST pass=${pass} fail=${fail}`);
console.log('brazo 3 eslabones (1.20m, 0.5kg payload):', JSON.stringify(arm, null, 1));
process.exit(fail === 0 ? 0 : 1);
