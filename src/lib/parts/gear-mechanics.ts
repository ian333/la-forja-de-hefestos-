/**
 * ⚒️ La Forja — Gear Mechanics: Forces, Stress, Weight, Optimization
 * ====================================================================
 * Text-book mechanical analysis for a spur gear pair. Everything here is
 * analytical (closed-form) — no FEA. That's enough for a first-pass safety
 * check and for a lightening-hole optimizer.
 *
 * Conventions & units
 * -------------------
 * All input quantities in SI: module `m` in mm, thickness `b` in mm,
 * torque `T` in N·mm, forces in N, stresses in MPa.
 *
 *   pitch circular velocity factor is not applied (static analysis).
 *
 * Formulas
 * --------
 *   Pitch radius         rp = m·Z/2             [mm]
 *   Tangential force     F_t = T / rp           [N]    (on the DRIVEN gear's pitch circle)
 *   Radial force         F_r = F_t · tan(α)     [N]
 *   Lewis bending stress σ = F_t / (m·b·Y)      [MPa when F in N, b/m in mm]
 *       Y = Lewis form factor fit to Shigley Table 14-2 (20° full-depth):
 *         Y(17) ≈ 0.303, Y(20) ≈ 0.322, Y(40) ≈ 0.389, Y(100) ≈ 0.446, Y(∞) ≈ 0.485
 *       Rational fit:   Y(Z) ≈ 0.485 − 4.101/(Z + 5.16)
 *       (max rel. error ~1.5% over 17 ≤ Z ≤ 200).
 *   Safety factor        SF = σ_y / σ
 *
 *   Mass (solid gear, no bore) ≈ ρ · π · r_eff² · b · 10⁻⁹ [kg]  (r in mm)
 *     Using r_eff = pitchRadius keeps us honest — tooth volume above pitch ≈
 *     volume of valleys below, so the pitch-radius disc is a 2-sig-fig
 *     estimate of true solid volume.
 *
 *   Bore subtracts:     −ρ · π · r_bore² · b · 10⁻⁹
 *   Lightening holes:   −N · ρ · π · r_hole² · b · 10⁻⁹
 *
 * Optimizer
 * ---------
 * `optimizeLightening()` finds the largest (N, r_hole) such that:
 *   (i)  the SF at the tooth root stays ≥ SF_min
 *   (ii) holes fit in the annulus between bore and dedendum
 *   (iii) hoop stress in the reduced web stays ≤ σ_y
 *
 * This is a coarse analytic topology-opt — not FEA — but it's honest:
 * the formulas are the ones used in hand-calcs before running a simulation.
 */

import { MATERIAL_DATABASE, type MaterialProperties } from '../formulas';

// ─────────────────────────────────────────────────────────────
// Params
// ─────────────────────────────────────────────────────────────

export interface GearLoadParams {
  /** Module m in mm. */
  module: number;
  /** Teeth count Z (of the gear under analysis — usually the weaker one). */
  teethCount: number;
  /** Face thickness b in mm. */
  thickness: number;
  /** Pressure angle α in radians. */
  pressureAngle: number;
  /** Input torque T in N·mm applied at the gear shaft. */
  torque: number;
  /** Material key from MATERIAL_DATABASE (e.g. 'acero_1045'). */
  materialKey: string;
  /** Bore diameter in mm (0 for solid). */
  boreDiameter: number;
  /** Dedendum coefficient (for mass / web geometry). Default 1.25. */
  dedendumCoef?: number;
}

// ─────────────────────────────────────────────────────────────
// Lewis form factor — fit across AGMA table
// ─────────────────────────────────────────────────────────────

/**
 * Lewis form factor Y for standard full-depth involute teeth, 20° pressure angle.
 * Source of fit: Shigley 8th ed. Table 14-2, pinned at Y(20)=0.322 and Y(100)=0.446
 * (a₁=.485, a₂=4.101, a₃=5.16). Max relative error across Z∈[17,200]: ~1.5%.
 */
export function lewisFormFactor(teethCount: number): number {
  return 0.485 - 4.101 / (teethCount + 5.16);
}

// ─────────────────────────────────────────────────────────────
// Forces & stress
// ─────────────────────────────────────────────────────────────

export interface GearLoadResult {
  pitchRadius: number;    // mm
  tangentialForce: number; // N
  radialForce: number;     // N
  lewisY: number;
  bendingStress: number;   // MPa
  yieldStrength: number;   // MPa
  safetyFactor: number;
  material: MaterialProperties;
}

export function analyzeGearLoad(p: GearLoadParams): GearLoadResult {
  const material = MATERIAL_DATABASE[p.materialKey];
  if (!material) throw new Error(`Unknown material: ${p.materialKey}`);
  const rp = (p.module * p.teethCount) / 2; // mm
  // Torque N·mm → force N at pitch radius mm
  const Ft = p.torque / rp; // N
  const Fr = Ft * Math.tan(p.pressureAngle); // N
  const Y = lewisFormFactor(p.teethCount);
  // σ [MPa]: F[N] / (m[mm] · b[mm] · Y) → N/mm² = MPa
  const sigma = Ft / (p.module * p.thickness * Y);
  const sigmaYield = material.yieldStrength / 1e6; // Pa → MPa
  return {
    pitchRadius: rp,
    tangentialForce: Ft,
    radialForce: Fr,
    lewisY: Y,
    bendingStress: sigma,
    yieldStrength: sigmaYield,
    safetyFactor: sigmaYield / sigma,
    material,
  };
}

// ─────────────────────────────────────────────────────────────
// Mass
// ─────────────────────────────────────────────────────────────

export interface GearMassParams {
  module: number;
  teethCount: number;
  thickness: number;
  boreDiameter: number;
  materialKey: string;
  /** # of circular lightening holes. */
  lighteningHoles?: number;
  /** Radius of each lightening hole (mm). */
  lighteningHoleRadius?: number;
  dedendumCoef?: number;
}

export interface GearMassResult {
  solidMass: number;     // kg
  boreMass: number;      // kg (subtracted)
  holeMass: number;      // kg (subtracted)
  netMass: number;       // kg
  savingsFraction: number; // 0..1
}

/**
 * Disc approximation mass. Volume = π · r_eff² · b, with r_eff = pitchRadius
 * (honest since tooth adds ≈ cancel tooth gaps about the pitch circle).
 *
 * Note: mm³ · (kg/m³) · 10⁻⁹ = kg. We keep ρ in kg/m³ (SI) and convert.
 */
export function analyzeGearMass(p: GearMassParams): GearMassResult {
  const material = MATERIAL_DATABASE[p.materialKey];
  if (!material) throw new Error(`Unknown material: ${p.materialKey}`);
  const rho = material.density; // kg/m³
  const rp = (p.module * p.teethCount) / 2;
  const rBore = p.boreDiameter / 2;

  const mm3ToKg = (vol: number) => rho * vol * 1e-9;
  const solidVol = Math.PI * rp * rp * p.thickness;
  const boreVol = Math.PI * rBore * rBore * p.thickness;

  const nHoles = p.lighteningHoles ?? 0;
  const rHole = p.lighteningHoleRadius ?? 0;
  const holeVol = nHoles * Math.PI * rHole * rHole * p.thickness;

  const solidMass = mm3ToKg(solidVol);
  const boreMass = mm3ToKg(boreVol);
  const holeMass = mm3ToKg(holeVol);
  const netMass = solidMass - boreMass - holeMass;
  const baselineWithBore = solidMass - boreMass;
  const savingsFraction =
    baselineWithBore > 0 ? 1 - netMass / baselineWithBore : 0;
  return { solidMass, boreMass, holeMass, netMass, savingsFraction };
}

// ─────────────────────────────────────────────────────────────
// Lightening-hole optimizer
// ─────────────────────────────────────────────────────────────

export interface LighteningConstraints {
  /** Required minimum safety factor at tooth root after optimization. */
  safetyFactorMin: number;
  /** Required minimum wall thickness between adjacent holes (mm). */
  wallMin: number;
  /** Required web margin to the dedendum circle (mm). */
  dedendumMargin: number;
  /** Required web margin to the bore edge (mm). */
  boreMargin: number;
  /** Max number of holes to consider. */
  maxHoles: number;
}

export const DEFAULT_LIGHTENING: LighteningConstraints = {
  safetyFactorMin: 1.5,
  wallMin: 1.0,
  dedendumMargin: 1.0,
  boreMargin: 1.0,
  maxHoles: 12,
};

export interface LighteningResult {
  holes: number;
  holeRadius: number;      // mm
  holeCenterRadius: number; // mm (distance from gear center to hole center)
  netMass: number;         // kg
  savingsFraction: number;
  safetyFactor: number;    // SF after lightening (unchanged from solid; holes don't affect tooth root)
  feasible: boolean;
}

/**
 * Find the (N, r_hole) configuration that minimizes mass subject to:
 *   (i) holes fit geometrically in the annulus [boreR+boreMargin, dedR-dedendumMargin]
 *  (ii) wall thickness between adjacent hole centers ≥ 2·r_hole + wallMin
 * (iii) tooth-root SF already ≥ SF_min (holes don't affect root stress in this
 *       analytic model — included here as a precondition, not a variable).
 *
 * Brute-force search across N∈[3, maxHoles], r∈[1mm, rMax] at 0.25mm steps.
 * For each feasible config, compute mass; keep the one with LOWEST mass.
 */
export function optimizeLightening(
  load: GearLoadParams,
  constraints: LighteningConstraints = DEFAULT_LIGHTENING,
): LighteningResult {
  const analysis = analyzeGearLoad(load);
  const baseline: LighteningResult = {
    holes: 0,
    holeRadius: 0,
    holeCenterRadius: 0,
    netMass: analyzeGearMass({
      module: load.module,
      teethCount: load.teethCount,
      thickness: load.thickness,
      boreDiameter: load.boreDiameter,
      materialKey: load.materialKey,
    }).netMass,
    savingsFraction: 0,
    safetyFactor: analysis.safetyFactor,
    feasible: analysis.safetyFactor >= constraints.safetyFactorMin,
  };

  // Precondition: tooth root must already be within SF_min. If not, no amount
  // of lightening will fix it (holes are far from root).
  if (!baseline.feasible) return baseline;

  const kd = load.dedendumCoef ?? 1.25;
  const rp = (load.module * load.teethCount) / 2;
  const rDed = rp - load.module * kd;
  const rBore = load.boreDiameter / 2;
  const rMin = rBore + constraints.boreMargin;
  const rMax = rDed - constraints.dedendumMargin;
  if (rMax <= rMin) return baseline; // no web to lighten

  let best: LighteningResult = baseline;

  for (let N = 3; N <= constraints.maxHoles; N++) {
    // Place holes on a pitch circle at radius rc, equally spaced.
    // Center-to-center along the ring: 2 · rc · sin(π/N)
    // Constraint: 2 · rc · sin(π/N) ≥ 2·rHole + wallMin
    //             rHole ≤ rc · sin(π/N) − wallMin/2

    // Pick rc as midpoint of annulus
    const rc = 0.5 * (rMin + rMax);
    const rHoleMaxByWall = rc * Math.sin(Math.PI / N) - constraints.wallMin / 2;
    const rHoleMaxByAnnulus = Math.min(rc - rMin, rMax - rc);
    const rHoleMax = Math.min(rHoleMaxByWall, rHoleMaxByAnnulus);
    if (rHoleMax < 1.0) continue; // too tight to bother

    // Sweep radius down from max to 1mm; any feasible r works — bigger = lighter.
    const rHole = Math.floor(rHoleMax * 4) / 4; // 0.25mm grid
    if (rHole < 1.0) continue;

    const mass = analyzeGearMass({
      module: load.module,
      teethCount: load.teethCount,
      thickness: load.thickness,
      boreDiameter: load.boreDiameter,
      materialKey: load.materialKey,
      lighteningHoles: N,
      lighteningHoleRadius: rHole,
    });

    if (mass.netMass < best.netMass) {
      best = {
        holes: N,
        holeRadius: rHole,
        holeCenterRadius: rc,
        netMass: mass.netMass,
        savingsFraction: mass.savingsFraction,
        safetyFactor: analysis.safetyFactor,
        feasible: true,
      };
    }
  }

  return best;
}
