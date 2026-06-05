/**
 * MANO — simulación de la mano de 3 dedos tendón-actuada (print-in-place). Baja las
 * fórmulas de la derivación a física verificable: cinemática + tendón→agarre adaptativo +
 * las limitaciones (codo, tendón, gap, frangibles φ). Puro, testeable. mm, N, rad/°, MPa.
 *
 * Subactuación: 1 tendón / dedo curla los 3 codos; los codos se conforman al objeto
 * (cada uno curla ∝ T·r/k hasta topar). Ver derivación en forja-shots/mano/mano.png.
 */

const DEG = 180 / Math.PI;
const E_PLA = 3500;      // N/mm² (MPa)
const SIGMA_PLA = 50;    // MPa tensil
const EPS_Y = 0.025;     // deformación de fluencia (~)
const TAU_PLA = 28;      // MPa cortante (frangibles)

// ── Cinemática del dedo (cadena planar de codos) ──
export interface FingerPose { tip: { x: number; y: number }; joints: { x: number; y: number }[]; }
export function forwardKinematics(L: number[], thetaRad: number[], base = { x: 0, y: 0 }, phi0 = 0): FingerPose {
  let x = base.x, y = base.y, phi = phi0; const joints = [{ x, y }];
  for (let i = 0; i < L.length; i++) { phi += thetaRad[i] ?? 0; x += L[i] * Math.cos(phi); y += L[i] * Math.sin(phi); joints.push({ x, y }); }
  return { tip: { x, y }, joints };
}

// ── Tendón = músculo: tensión ↔ torque ↔ fuerza de punta ──
/** Torque del tendón en cada codo: τ_i = T·r_i. */
export function tendonTorques(T: number, r: number[]): number[] { return r.map((ri) => +(T * ri).toFixed(4)); }
/** Tensión del tendón para una fuerza de pellizco F en la punta: T = F·L/r (brazo efectivo r). */
export function tendonTension(F_tip: number, fingerLen: number, momentArm: number): number {
  return +((F_tip * fingerLen) / momentArm).toFixed(3);
}
/** Fuerza máxima en la punta para una tensión T (cuando el dedo topa, bloqueado). */
export function gripForce(T: number, momentArm: number, fingerLen: number): number {
  return +((T * momentArm) / fingerLen).toFixed(3);
}

// ── Agarre ADAPTATIVO: los codos curlan ∝ T·r/k hasta el tope (libre o por contacto) ──
export function adaptiveCurl(p: { T: number; r: number[]; k: number[]; thetaMaxRad: number[]; contactRad?: (number | null)[] }): { thetaRad: number[]; thetaDeg: number[]; conformed: boolean[] } {
  const th: number[] = [], conf: boolean[] = [];
  for (let i = 0; i < p.r.length; i++) {
    const free = (p.T * p.r[i]) / p.k[i];                 // curl libre (resorte de la bisagra)
    const limit = p.contactRad?.[i] ?? p.thetaMaxRad[i];   // tope: el objeto o el máx de la bisagra
    const a = Math.min(free, p.thetaMaxRad[i], limit);
    th.push(+a.toFixed(4)); conf.push(a >= limit - 1e-6 && limit < p.thetaMaxRad[i]); // topó el objeto
  }
  return { thetaRad: th, thetaDeg: th.map((a) => +(a * DEG).toFixed(2)), conformed: conf };
}

// ── El CODO: bisagra viva (flexure) vs perno print-in-place ──
/** Bisagra viva: rigidez k_θ = E·I/l y ángulo máx por fluencia. */
export function flexureHinge(p: { w: number; t: number; l: number }): { k_Nmm_per_rad: number; thetaMaxDeg: number } {
  const I = (p.w * p.t ** 3) / 12;                         // mm⁴
  const k = (E_PLA * I) / p.l;                             // N·mm/rad
  const thetaMax = (2 * EPS_Y * p.l) / p.t;                // rad
  return { k_Nmm_per_rad: +k.toFixed(3), thetaMaxDeg: +(thetaMax * DEG).toFixed(2) };
}
/** Sub-flexures para alcanzar un ángulo total sin pasar la fluencia. */
export function flexuresForAngle(totalDeg: number, hinge: { thetaMaxDeg: number }): number {
  return Math.max(1, Math.ceil(totalDeg / hinge.thetaMaxDeg));
}
/** Perno print-in-place: el gap del codo desde la desigualdad maestra (durable, con juego). */
export function pinJointGap(p: { SF?: number; gMin?: number; delta?: number }): { gap: number; playMm: number } {
  const SF = p.SF ?? 1.5, gMin = p.gMin ?? 0.30, delta = p.delta ?? 0.12;
  const gap = +(SF * gMin + 2 * delta).toFixed(3);
  return { gap, playMm: gap };
}

// ── Limitaciones estructurales ──
/** Área mínima del tendón para una tensión T con SF. */
export function tendonArea(T: number, SF = 2): number { return +((SF * T) / SIGMA_PLA).toFixed(3); }
/** Fuerza para romper un frangible de 1 punto (área→0 ⇒ F→0, sin viruta). */
export function frangibleBreak(areaMm2: number): number { return +(TAU_PLA * areaMm2).toFixed(3); }

// ── φ: soportes/anclas dispersos (filotaxis, no chocan) ──
const PHI = (1 + Math.sqrt(5)) / 2, PSI = (2 * Math.PI) / (PHI * PHI);
export function phiSupports(n: number, c = 1): { x: number; y: number; theta: number; r: number }[] {
  return Array.from({ length: n }, (_, k) => { const i = k + 1; const th = i * PSI, r = c * Math.sqrt(i); return { x: +(r * Math.cos(th)).toFixed(3), y: +(r * Math.sin(th)).toFixed(3), theta: +(th % (2 * Math.PI)).toFixed(4), r: +r.toFixed(3) }; });
}
/** Separación mínima entre soportes φ ≈ c (densidad uniforme) → no se fusionan si c ≥ gap. */
export function phiMinSpacing(c: number): number { return +(c * 0.9).toFixed(3); }

// ── DISEÑO completo de la mano (la simulación → veredicto) ──
export interface HandSpec {
  fingers?: number; L: number[];         // largos de falange (mm)
  pinchForceN: number;                   // fuerza de pellizco objetivo en la punta
  momentArm: number;                     // brazo del tendón r (mm)
  curlDeg?: number;                      // curl total deseado por dedo (default 90)
  codo?: 'flexure' | 'perno';
  hinge?: { w: number; t: number; l: number };
}
export function designHand(s: HandSpec) {
  const fingers = s.fingers ?? 3;
  const L = s.L, fingerLen = L.reduce((a, b) => a + b, 0);
  const r = L.map(() => s.momentArm);
  const T = tendonTension(s.pinchForceN, fingerLen, s.momentArm);
  const aTendon = tendonArea(T);
  const grip = gripForce(T, s.momentArm, fingerLen);
  const curl = s.curlDeg ?? 90;
  const codo = s.codo ?? 'perno';
  const hingeP = s.hinge ?? { w: 8, t: 0.6, l: 3 };
  const hinge = flexureHinge(hingeP);
  const nSubFlex = flexuresForAngle(curl, hinge);
  const pin = pinJointGap({});
  const supports = phiSupports(20, pin.gap + 0.5);          // soportes φ, c ≥ gap → no chocan
  return {
    fingers, fingerLen: +fingerLen.toFixed(1), momentArm: s.momentArm,
    tendonTension_N: T, tendonArea_mm2: aTendon, tendonSize_mm: +Math.sqrt(aTendon).toFixed(2),
    gripForce_N: grip,                                       // = pinchForce (consistencia)
    codo, hinge, subFlexuresFor90: nSubFlex, pinGap_mm: pin.gap,
    supportsPhi: supports.length, supportSpacing_mm: phiMinSpacing(pin.gap + 0.5),
    frangible1pt_N: frangibleBreak(0.05),                   // 1 punto ~0.05mm² → casi nada
    note: `1 tendón/dedo (${T} N) curla ${fingers}×${L.length} codos; agarre adaptativo. Codo ${codo} (gap ${pin.gap}mm) o ${nSubFlex} sub-flexures p/${curl}°. Soportes φ no chocan, frangibles de 1 punto (${frangibleBreak(0.05)} N → sin virutas).`,
  };
}
