/**
 * Gaussian-primitive integrals for s-type orbitals (ℓ=0).
 *
 * All formulas are closed-form for unnormalized s-type primitives
 *     g(r; α, A) = exp(-α |r-A|²)
 * and come from the standard Gaussian integral identities used in every
 * quantum chemistry code:
 *
 *   Szabo & Ostlund, "Modern Quantum Chemistry" (Dover 1996), App. A
 *   Boys S.F., Proc. Roy. Soc. A 200:542 (1950)
 *
 * Gaussian product theorem: gᵅ(r-A) · gᵝ(r-B) = K_AB gᵖ(r-P)
 *   with p = α+β,  P = (αA+βB)/p,  K_AB = exp(-αβ/p |A-B|²)
 *
 * Units throughout: atomic units (Hartree, Bohr).
 */

export type Vec3 = [number, number, number];

export function dist2(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

export function weightedMid(α: number, A: Vec3, β: number, B: Vec3): Vec3 {
  const p = α + β;
  return [(α * A[0] + β * B[0]) / p, (α * A[1] + β * B[1]) / p, (α * A[2] + β * B[2]) / p];
}

/**
 * Boys function F₀(t) = ∫₀¹ exp(-t u²) du = (√π / (2√t)) erf(√t).
 * For t → 0, F₀ → 1 - t/3 + t²/10 - ... (Taylor). For ℓ=0 integrals only F₀ is needed.
 */
export function boysF0(t: number): number {
  if (t < 1e-8) return 1 - t / 3 + (t * t) / 10;
  const s = Math.sqrt(t);
  return 0.5 * Math.sqrt(Math.PI) / s * erf(s);
}

/** Abramowitz & Stegun 7.1.26 approximation to erf(x). Max error ~1.5e-7. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const poly = ((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592;
  return sign * (1 - poly * t * Math.exp(-ax * ax));
}

/** Normalization for an s-type primitive: N = (2α/π)^(3/4). */
export function normS(α: number): number {
  return Math.pow(2 * α / Math.PI, 0.75);
}

// -------------------- Primitive integrals (unnormalized s-Gaussians) --------------------

/** ⟨gᵅ_A | gᵝ_B⟩. */
export function overlapPrim(α: number, A: Vec3, β: number, B: Vec3): number {
  const p = α + β;
  const K = Math.exp((-α * β / p) * dist2(A, B));
  return K * Math.pow(Math.PI / p, 1.5);
}

/** ⟨gᵅ_A | -½∇² | gᵝ_B⟩. */
export function kineticPrim(α: number, A: Vec3, β: number, B: Vec3): number {
  const p = α + β;
  const μ = (α * β) / p;
  const ab2 = dist2(A, B);
  const K = Math.exp(-μ * ab2);
  return μ * (3 - 2 * μ * ab2) * K * Math.pow(Math.PI / p, 1.5);
}

/** ⟨gᵅ_A | -1/|r-C| | gᵝ_B⟩. Multiply by Z_C externally. */
export function nuclearPrim(α: number, A: Vec3, β: number, B: Vec3, C: Vec3): number {
  const p = α + β;
  const P = weightedMid(α, A, β, B);
  const K = Math.exp((-α * β / p) * dist2(A, B));
  const t = p * dist2(P, C);
  return (-2 * Math.PI / p) * K * boysF0(t);
}

/**
 * Two-electron repulsion integral (AB|CD) =
 *     ∫∫ gᵅ_A(1) gᵝ_B(1) · 1/r₁₂ · gᵞ_C(2) gᵟ_D(2) d³r₁ d³r₂
 */
export function eriPrim(
  α: number, A: Vec3, β: number, B: Vec3,
  γ: number, C: Vec3, δ: number, D: Vec3,
): number {
  const p = α + β;
  const q = γ + δ;
  const P = weightedMid(α, A, β, B);
  const Q = weightedMid(γ, C, δ, D);
  const K_AB = Math.exp((-α * β / p) * dist2(A, B));
  const K_CD = Math.exp((-γ * δ / q) * dist2(C, D));
  const ρ = (p * q) / (p + q);
  const t = ρ * dist2(P, Q);
  return (2 * Math.pow(Math.PI, 2.5)) / (p * q * Math.sqrt(p + q)) * K_AB * K_CD * boysF0(t);
}
