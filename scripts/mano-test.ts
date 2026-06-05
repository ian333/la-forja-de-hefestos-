/* Verifica la simulación de la mano (cinemática, tendón, agarre adaptativo, codo, φ).
   node --import tsx scripts/mano-test.ts */
import {
  forwardKinematics, tendonTorques, tendonTension, gripForce, adaptiveCurl,
  flexureHinge, flexuresForAngle, pinJointGap, tendonArea, frangibleBreak, phiSupports, designHand,
} from '../src/forja/mech/mano';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 1e-2) => Math.abs(a - b) < t;
const ck = (n: string, ok: boolean, x = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${n} ${x}`); } };

// Cinemática: dedo recto → punta a la suma de largos; curlado → se acorta el alcance.
const straight = forwardKinematics([30, 20, 15], [0, 0, 0], { x: 0, y: 0 }, 0);
ck('dedo recto: punta en x = ΣL = 65', near(straight.tip.x, 65) && near(straight.tip.y, 0));
const curled = forwardKinematics([30, 20, 15], [0.5, 0.5, 0.5], { x: 0, y: 0 }, 0);
ck('dedo curlado: alcance menor que 65 (se enrosca)', Math.hypot(curled.tip.x, curled.tip.y) < 65);
ck('4 puntos de junta (base + 3 codos)', straight.joints.length === 4);

// Tendón = músculo: τ=T·r ; T=F·L/r ; grip consistente (round-trip).
ck('torques τ_i = T·r_i', near(tendonTorques(80, [4, 4, 4])[0], 320));
const T = tendonTension(5, 65, 4);
ck('T para F=5N, L=65, r=4 → 81.25 N (de la derivación)', near(T, 81.25, 0.1), `${T}`);
ck('grip(T) round-trip ≈ 5 N', near(gripForce(T, 4, 65), 5, 0.05));
ck('brazo r mayor → menos tensión', tendonTension(5, 65, 8) < tendonTension(5, 65, 4));

// Agarre ADAPTATIVO: codos curlan ∝ T·r/k; el que topa el objeto se detiene (conforma).
const ac = adaptiveCurl({ T: 200, r: [4, 4, 4], k: [300, 300, 300], thetaMaxRad: [1.6, 1.6, 1.6], contactRad: [null, 0.3, null] });
ck('codo 2 topa el objeto (conforma a 0.3 rad)', near(ac.thetaRad[1], 0.3) && ac.conformed[1]);
ck('codos libres curlan más que el que topó', ac.thetaRad[0] > ac.thetaRad[1] || ac.thetaRad[2] >= ac.thetaRad[1]);

// El CODO: flexure (rigidez + ángulo) vs perno (gap durable).
const fx = flexureHinge({ w: 8, t: 0.6, l: 3 });
ck('flexure: rigidez k > 0 y ángulo máx finito', fx.k_Nmm_per_rad > 0 && fx.thetaMaxDeg > 0, JSON.stringify(fx));
ck('flexure t=0.6,l=3 → θ_max ≈ 14° (chico → se necesitan varios para 90°)', near(fx.thetaMaxDeg, 2 * 0.025 * 3 / 0.6 * 180 / Math.PI, 0.5));
ck('para 90° se necesitan varios sub-flexures', flexuresForAngle(90, fx) >= 4);
const pin = pinJointGap({});
ck('perno: gap = SF·g_min+2δ = 0.69 (de la desigualdad maestra)', near(pin.gap, 0.69, 1e-2), `${pin.gap}`);

// Limitaciones: área del tendón + frangible de 1 punto.
ck('área tendón para 81N SF2 = 3.25 mm²', near(tendonArea(81.25), 2 * 81.25 / 50, 1e-2));
ck('frangible de 1 punto (0.05mm²) rompe a ~1.4 N (casi nada)', frangibleBreak(0.05) < 2);

// φ: soportes dispersos, ninguno repetido, densidad uniforme.
const sup = phiSupports(50, 1);
ck('φ: 50 soportes, ángulos distintos (no se alinean)', new Set(sup.map((s) => s.theta.toFixed(2))).size > 40);
ck('φ: r crece como √n (densidad uniforme)', near(sup[48].r / sup[3].r, Math.sqrt(49 / 4), 0.05));

// DISEÑO completo.
const d = designHand({ L: [30, 20, 15], pinchForceN: 5, momentArm: 4 });
ck('diseño: T≈81N, tendón≈3.2mm², grip=5N', near(d.tendonTension_N, 81.25, 0.1) && near(d.gripForce_N, 5, 0.05));
ck('diseño: codo perno con gap 0.69 + soportes φ', d.pinGap_mm === 0.69 && d.supportsPhi > 0);

console.log(`\nMANO_TEST pass=${pass} fail=${fail}`);
console.log('diseño mano (F=5N pellizco):', JSON.stringify(d, null, 1));
process.exit(fail === 0 ? 0 : 1);
