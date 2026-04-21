/**
 * STO-3G basis set: each atomic orbital is a contraction of 3 s-type Gaussian
 * primitives fit to a Slater 1s orbital.
 *
 *     φ(r) = Σᵢ dᵢ · N(αᵢ) · exp(-αᵢ |r-A|²)
 *
 * The αᵢ and dᵢ come from a least-squares fit of 3 Gaussians to e^(-ζr) with
 * ζ=1 ("STO-1G"); to use this for an atom with effective ζ, the exponents are
 * scaled by ζ². The values below are for ζ=1.24 (hydrogen) — i.e. already
 * scaled. The coefficients dᵢ assume normalized primitives, so the contracted
 * function is itself normalized (to ~1e-3).
 *
 * Source: Hehre, Stewart & Pople, J. Chem. Phys. 51:2657 (1969), Table I.
 */

export interface ContractedS {
  /** Primitive exponents αᵢ (bohr⁻²). */
  alphas: number[];
  /** Contraction coefficients dᵢ (for normalized primitives). */
  coeffs: number[];
}

/** Hydrogen 1s in STO-3G (ζ=1.24). */
export const H_1S: ContractedS = {
  alphas: [3.42525091, 0.62391373, 0.16885540],
  coeffs: [0.15432897, 0.53532814, 0.44463454],
};
