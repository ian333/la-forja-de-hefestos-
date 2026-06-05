/**
 * BRAZO — el robot de 3 eslabones con juntas CICLOIDALES (hembra gira, discos fijos = config B).
 * Pruebas de tamaño radial+axial y de CARGA → el nº óptimo de discos y la longitud del cicloidal.
 * Puro, testeable. mm, kg, N·m, MPa. Modelo de orden de magnitud, calibrable con el print real.
 */
const G = 9.81;
const PLA_RHO = 1.24e-6;   // kg/mm³
const SIGMA_PLA = 50;      // MPa tensil

// ── Viga (eslabón) como tubo de PLA ──
export function beamMass(lengthMm: number, odMm = 35, wallMm = 3): number {
  const a = Math.PI * ((odMm / 2) ** 2 - (odMm / 2 - wallMm) ** 2); // mm²
  return +(a * lengthMm * PLA_RHO).toFixed(4); // kg
}

// ── Cinemática: alcance + workspace ──
export interface ArmSpec { links: number[]; payloadKg: number; odMm?: number; wallMm?: number; }
export function armKinematics(links: number[]) {
  const reach = links.reduce((a, b) => a + b, 0);
  return { reach_m: +(reach / 1000).toFixed(3), reach_mm: reach, dof: 3, workspace: 'esférico (base-yaw + hombro-pitch + codo)' };
}

// ── CARGA: torque por junta (peor caso: brazo horizontal extendido, gravedad) ──
export function jointTorques(spec: ArmSpec) {
  const { links, payloadKg } = spec; const od = spec.odMm ?? 35, wall = spec.wallMm ?? 3;
  const m = links.map((l) => beamMass(l, od, wall));
  const tau: number[] = [];
  for (let i = 0; i < links.length; i++) {
    let t = 0, dist = 0;
    for (let j = i; j < links.length; j++) { t += m[j] * G * (dist + links[j] / 2); dist += links[j]; } // N·mm
    t += payloadKg * G * dist;                                  // carga útil en la punta
    tau.push(+(t / 1000).toFixed(2));                           // N·mm → N·m
  }
  return { masses_kg: m, armMass_kg: +m.reduce((a, b) => a + b, 0).toFixed(3), jointTorque_Nm: tau, shoulder_Nm: tau[0] };
}

// ── CAPACIDAD del cicloidal vs (N discos, t espesor, R radio) ──
// T_cap ≈ κ·N·t·R²·σ_adm   (N axial lineal, R² radial cuadrático, t = ancho axial del disco)
export function cycloidalCapacity(p: { N: number; t: number; R: number; SF?: number; kappa?: number }): number {
  const sigma = SIGMA_PLA / (p.SF ?? 1);   // σ admisible
  const kappa = p.kappa ?? 0.04;           // factor de geometría (calibrable con el print)
  return +((kappa * p.N * p.t * p.R * p.R * sigma) / 1000).toFixed(2); // N·m
}
/** Barrido radial × axial: la capacidad sobre una malla de (R, N). */
export function capacitySweep(opts: { Rs: number[]; Ns: number[]; t: number; SF?: number }) {
  return opts.Ns.map((N) => ({ N, byR: opts.Rs.map((R) => ({ R, T: cycloidalCapacity({ N, t: opts.t, R, SF: opts.SF }) })) }));
}

// ── Dimensionar una junta: dado el torque requerido, hallar (N, R, t) ──
// Preferencia del usuario: pesado al AXIAL (más discos) por robustez/reparto, dentro del envolvente.
export interface SizeInput { torqueReq_Nm: number; SF?: number; Rmax: number; t?: number; kappa?: number; Lmax_disc?: number; gap?: number; }
export function sizeJoint(inp: SizeInput) {
  const SF = inp.SF ?? 2.5;                  // robusto
  const t = inp.t ?? 6;                      // espesor de disco
  const gap = inp.gap ?? 0.8;
  const Treq = inp.torqueReq_Nm * SF;        // con factor de seguridad
  // R lo más grande que da el envolvente (radial es cuadrático, eficiente); luego N para el resto.
  const R = inp.Rmax;
  const perDisc = cycloidalCapacity({ N: 1, t, R, SF: 1, kappa: inp.kappa });  // capacidad de 1 disco
  let N = Math.max(2, Math.ceil(Treq / perDisc));   // mínimo 2-3 discos por balance
  // límite axial: la pila no debe pasar Lmax (eje largo = flojo). Si N·(t+gap) > Lmax, sube R o avisa.
  const Lstack = N * t + (N - 1) * gap;
  const Lmax = inp.Lmax_disc ?? 60;
  return {
    R, t, N, gap, SF,
    stackLength_mm: +Lstack.toFixed(1),
    capacity_Nm: cycloidalCapacity({ N, t, R, SF: 1, kappa: inp.kappa }),
    margin: +(cycloidalCapacity({ N, t, R, SF: 1, kappa: inp.kappa }) / inp.torqueReq_Nm).toFixed(2),
    axialOK: Lstack <= Lmax,
    note: Lstack <= Lmax
      ? `R=${R}mm + ${N} discos (pila ${Lstack.toFixed(0)}mm) → ${cycloidalCapacity({ N, t, R, SF: 1, kappa: inp.kappa })} N·m (×${(cycloidalCapacity({ N, t, R, SF: 1, kappa: inp.kappa }) / inp.torqueReq_Nm).toFixed(1)} del req)`
      : `pila ${Lstack.toFixed(0)}mm > ${Lmax}mm → eje muy largo; sube R (radial, R²) en vez de más discos`,
  };
}

// ── Dimensionar TODO el brazo: cada junta a su torque ──
export function sizeArm(spec: ArmSpec, Rmax: number[], opts?: { SF?: number; t?: number; kappa?: number }) {
  const tq = jointTorques(spec);
  const joints = tq.jointTorque_Nm.map((T, i) => ({
    joint: ['hombro', 'codo', 'muñeca'][i] ?? `j${i}`,
    torqueReq_Nm: T,
    ...sizeJoint({ torqueReq_Nm: T, SF: opts?.SF, Rmax: Rmax[i], t: opts?.t, kappa: opts?.kappa }),
  }));
  return { kinematics: armKinematics(spec.links), ...tq, joints };
}
