/**
 * La Forja — DINÁMICA de máquinas (física real, NO curvas inventadas).
 * ===================================================================
 * El usuario quiere que la API pueda "calcular fricción, fuerzas, peso" de lo
 * que se construye por la interfaz (un carro, un robot). Este módulo es PURO
 * (testeable en node) y usa fórmulas de manual:
 *
 *   Peso            W = m·g
 *   Fricción/tracción F = μ·N      (Coulomb)
 *   Pendiente máx    tanθ ≤ μ·(motrices/ruedas)   (sin patinar)
 *   Rodadura         F_rr = C_rr·W
 *   Torque de rueda  τ = F·r
 *   Brazo (estático) τ_base = g·Σ(m_i·d_i) + g·m_carga·alcance   (brazo horizontal)
 *
 * Frontera: estática/cuasi-estática (sin inercias rotacionales ni dinámica de
 * contacto). Lo evocativo se etiqueta; aquí todo es derivable a mano.
 */

export const G = 9.81; // m/s²

// ─────────────────────────────────────────────────────────────────
// VEHÍCULO (carro / rover): peso → carga por rueda → tracción → pendiente
// ─────────────────────────────────────────────────────────────────

export interface VehicleSpec {
  /** Masa total (kg). */
  massKg: number;
  /** Nº de ruedas que tocan el suelo. */
  wheels: number;
  /** Nº de ruedas MOTRICES (default = todas). */
  driven?: number;
  /** Radio de rueda (m). */
  wheelRadiusM: number;
  /** Coef. de fricción rueda–suelo (default 0.7, hule sobre asfalto seco). */
  mu?: number;
  /** Coef. de resistencia a la rodadura (default 0.015, neumático sobre duro). */
  crr?: number;
  /** Gravedad (m/s², default 9.81). */
  g?: number;
}

export interface VehicleDynamics {
  weightN: number;               // W = m·g
  perWheelN: number;             // carga normal por rueda (suelo plano, reparto uniforme)
  tractionMaxN: number;          // μ·N_motriz — fuerza máx antes de patinar
  rollingResistN: number;        // C_rr·W
  netForceN: number;             // tracción − rodadura (empuje neto en plano)
  maxAccel: number;              // a = F_neta/m (m/s²)
  maxGradeDeg: number;           // atan(μ·motrices/ruedas) — pendiente máx sin patinar
  motorTorquePerWheelNm: number; // τ = (tracción/motrices)·r por rueda motriz
  /** ¿Puede sostener/subir una pendiente de `deg` grados sin patinar? */
  canClimbDeg: (deg: number) => boolean;
}

export function vehicleDynamics(s: VehicleSpec): VehicleDynamics {
  const g = s.g ?? G;
  const mu = s.mu ?? 0.7;
  const crr = s.crr ?? 0.015;
  const driven = Math.min(s.driven ?? s.wheels, s.wheels);
  const W = s.massKg * g;
  const drivenFrac = s.wheels > 0 ? driven / s.wheels : 0;
  const Ndriven = W * drivenFrac;              // peso sobre ruedas motrices (uniforme)
  const tractionMax = mu * Ndriven;
  const rolling = crr * W;
  const net = tractionMax - rolling;
  const torquePerWheel = driven > 0 ? (tractionMax / driven) * s.wheelRadiusM : 0;
  const maxGradeRad = Math.atan(mu * drivenFrac);
  return {
    weightN: W,
    perWheelN: s.wheels > 0 ? W / s.wheels : 0,
    tractionMaxN: tractionMax,
    rollingResistN: rolling,
    netForceN: net,
    maxAccel: s.massKg > 0 ? net / s.massKg : 0,
    maxGradeDeg: (maxGradeRad * 180) / Math.PI,
    motorTorquePerWheelNm: torquePerWheel,
    // En una pendiente θ: gravedad-along = W·sinθ; tracción = μ·N_motriz·cosθ.
    // Sube si μ·(motrices/ruedas)·cosθ ≥ sinθ ⇒ tanθ ≤ μ·(motrices/ruedas).
    canClimbDeg: (deg: number) => Math.tan((deg * Math.PI) / 180) <= mu * drivenFrac + 1e-12,
  };
}

// ─────────────────────────────────────────────────────────────────
// BRAZO ROBÓTICO (estático): torque de sostén en el hombro, brazo horizontal
// ─────────────────────────────────────────────────────────────────

export interface ArmLink {
  /** Largo del eslabón (m). */
  lengthM: number;
  /** Masa del eslabón (kg). */
  massKg: number;
}

export interface ArmSpec {
  /** Eslabones de la base hacia la punta. */
  links: ArmLink[];
  /** Carga en la punta (kg). */
  payloadKg: number;
  g?: number;
}

export interface ArmStatics {
  reachM: number;                 // alcance = Σ largos
  baseTorqueNm: number;           // torque de sostén en el hombro (brazo horizontal = peor caso)
  payloadTorqueNm: number;        // parte del torque debida SOLO a la carga
  totalMassKg: number;            // masa de eslabones + carga
  /** Torque de sostén en cada junta j (de la base a la punta). */
  jointTorquesNm: number[];
}

/**
 * Torque ESTÁTICO de sostén con el brazo HORIZONTAL extendido (momento máximo).
 * Para la junta j, el torque = g·Σ(masa_i·brazo_de_palanca_i) sobre todo lo que
 * cuelga DISTAL a j (eslabones j..n + carga), con brazo de palanca medido desde j.
 */
export function armStatics(s: ArmSpec): ArmStatics {
  const g = s.g ?? G;
  const n = s.links.length;
  // x de inicio de cada eslabón y de su CG (centro), desde la base.
  const start: number[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) { start.push(acc); acc += s.links[i].lengthM; }
  const reach = acc;
  const cg = s.links.map((l, i) => start[i] + l.lengthM / 2);

  const torqueAboutJoint = (jx: number): number => {
    let t = 0;
    for (let i = 0; i < n; i++) if (cg[i] >= jx - 1e-12) t += s.links[i].massKg * (cg[i] - jx);
    t += s.payloadKg * (reach - jx); // carga en la punta
    return g * t;
  };

  const jointTorques = start.map((jx) => torqueAboutJoint(jx));
  return {
    reachM: reach,
    baseTorqueNm: jointTorques.length ? jointTorques[0] : 0,
    payloadTorqueNm: g * s.payloadKg * reach,
    totalMassKg: s.links.reduce((a, l) => a + l.massKg, 0) + s.payloadKg,
    jointTorquesNm: jointTorques,
  };
}
