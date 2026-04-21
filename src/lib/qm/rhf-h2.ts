/**
 * Restricted Hartree-Fock for H₂ on the STO-3G basis — 2 electrons, 2 basis
 * functions, closed shell. Self-consistent field solved via Löwdin
 * orthogonalization of the Roothaan equations. Pure TypeScript, no linear
 * algebra dependencies — 2×2 matrices handled analytically.
 *
 * What this file does (and doesn't):
 *   It solves the electronic Schrödinger equation for H₂ in the Born-Oppenheimer
 *   approximation at a single internuclear distance R. Repeat for many R to
 *   build the potential energy curve E(R). From the curvature at R_eq you get
 *   the force constant k — which is the bridge to classical MD force fields.
 *
 * Canonical numbers from STO-3G H₂ (cited in Szabo-Ostlund §3.5):
 *   R_eq ≈ 1.346 bohr  (experiment: 1.401 bohr = 0.741 Å)
 *   E(R_eq) ≈ -1.117 Hartree  (experiment: -1.174 Hartree)
 *   ν̃_vib ≈ 4260 cm⁻¹ (experiment: 4401 cm⁻¹)
 *
 * Refs:
 *   Szabo A. & Ostlund N.S., Modern Quantum Chemistry, Dover 1996, §3.5.2.
 *   Roothaan C.C.J., Rev. Mod. Phys. 23:69 (1951).
 *   Hehre W.J., Stewart R.F., Pople J.A., J. Chem. Phys. 51:2657 (1969).
 */

import { H_1S, type ContractedS } from './sto3g';
import {
  dist2, normS, overlapPrim, kineticPrim, nuclearPrim, eriPrim, type Vec3,
} from './gaussians';

export interface HFResult {
  R: number;                 // bond distance (bohr)
  energy: number;            // total energy (Hartree) = E_elec + V_nn
  eElec: number;             // electronic energy
  vNN: number;               // nuclear-nuclear repulsion
  orbitalEnergies: [number, number]; // [ε_bonding, ε_antibonding]
  coeffs: [[number, number], [number, number]]; // C[μ][i]
  density: [[number, number], [number, number]]; // P_μν
  overlap: number;           // S_12
  iterations: number;
  converged: boolean;
  kineticContrib: number;    // Tr[P·T]
  neContrib: number;         // Tr[P·V_ne]
  eeContrib: number;         // (E_elec - T - V_ne)
}

// ---------------- Contraction helpers ----------------

function contract2(
  μBF: ContractedS, A: Vec3, νBF: ContractedS, B: Vec3,
  prim: (α: number, β: number) => number,
): number {
  let s = 0;
  for (let i = 0; i < μBF.alphas.length; i++) {
    const di = μBF.coeffs[i] * normS(μBF.alphas[i]);
    for (let j = 0; j < νBF.alphas.length; j++) {
      const dj = νBF.coeffs[j] * normS(νBF.alphas[j]);
      s += di * dj * prim(μBF.alphas[i], νBF.alphas[j]);
    }
  }
  return s;
}

function contract4(
  μ: ContractedS, A: Vec3, ν: ContractedS, B: Vec3,
  λ: ContractedS, C: Vec3, σ: ContractedS, D: Vec3,
): number {
  let s = 0;
  for (let i = 0; i < μ.alphas.length; i++) {
    const di = μ.coeffs[i] * normS(μ.alphas[i]);
    for (let j = 0; j < ν.alphas.length; j++) {
      const dj = ν.coeffs[j] * normS(ν.alphas[j]);
      for (let k = 0; k < λ.alphas.length; k++) {
        const dk = λ.coeffs[k] * normS(λ.alphas[k]);
        for (let l = 0; l < σ.alphas.length; l++) {
          const dl = σ.coeffs[l] * normS(σ.alphas[l]);
          s += di * dj * dk * dl * eriPrim(μ.alphas[i], A, ν.alphas[j], B, λ.alphas[k], C, σ.alphas[l], D);
        }
      }
    }
  }
  return s;
}

// ---------------- Tiny 2×2 linear algebra ----------------

type M2 = [[number, number], [number, number]];

function eigSym2(M: M2): { λ: [number, number]; V: M2 } {
  const a = M[0][0], b = M[0][1], d = M[1][1];
  const tr = a + d;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - (a * d - b * b)));
  const λ1 = tr / 2 - disc;
  const λ2 = tr / 2 + disc;
  if (Math.abs(b) < 1e-14) {
    if (a <= d) return { λ: [a, d], V: [[1, 0], [0, 1]] };
    return { λ: [d, a], V: [[0, 1], [1, 0]] };
  }
  let v1: [number, number] = [λ1 - d, b];
  let v2: [number, number] = [λ2 - d, b];
  const n1 = Math.hypot(v1[0], v1[1]);
  const n2 = Math.hypot(v2[0], v2[1]);
  v1 = [v1[0] / n1, v1[1] / n1];
  v2 = [v2[0] / n2, v2[1] / n2];
  return { λ: [λ1, λ2], V: [[v1[0], v2[0]], [v1[1], v2[1]]] };
}

function mul2(A: M2, B: M2): M2 {
  return [
    [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
    [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]],
  ];
}

function transpose2(A: M2): M2 {
  return [[A[0][0], A[1][0]], [A[0][1], A[1][1]]];
}

/** Solve F C = S C ε with S positive-definite (Löwdin symmetric orthogonalization). */
function solveGenEig2(F: M2, S: M2): { eps: [number, number]; C: M2 } {
  const { λ: sλ, V: Sv } = eigSym2(S);
  const D = [[1 / Math.sqrt(sλ[0]), 0], [0, 1 / Math.sqrt(sλ[1])]] as M2;
  const X = mul2(mul2(Sv, D), transpose2(Sv)); // S^{-1/2}
  const Fp = mul2(mul2(transpose2(X), F), X);
  const { λ: fλ, V: Cp } = eigSym2(Fp);
  const C = mul2(X, Cp);
  return { eps: [fλ[0], fλ[1]], C };
}

// ---------------- Main SCF ----------------

export function rhfH2(R: number, opts?: { maxIter?: number; tol?: number }): HFResult {
  const A: Vec3 = [-R / 2, 0, 0];
  const B: Vec3 = [R / 2, 0, 0];
  const Z_A = 1, Z_B = 1;
  const centers: [ContractedS, Vec3][] = [[H_1S, A], [H_1S, B]];

  // One-electron matrices
  const S: M2 = [[0, 0], [0, 0]];
  const T: M2 = [[0, 0], [0, 0]];
  const V: M2 = [[0, 0], [0, 0]];
  for (let μ = 0; μ < 2; μ++) for (let ν = 0; ν < 2; ν++) {
    const [bμ, Rμ] = centers[μ];
    const [bν, Rν] = centers[ν];
    S[μ][ν] = contract2(bμ, Rμ, bν, Rν, (α, β) => overlapPrim(α, Rμ, β, Rν));
    T[μ][ν] = contract2(bμ, Rμ, bν, Rν, (α, β) => kineticPrim(α, Rμ, β, Rν));
    V[μ][ν] =
      Z_A * contract2(bμ, Rμ, bν, Rν, (α, β) => nuclearPrim(α, Rμ, β, Rν, A)) +
      Z_B * contract2(bμ, Rμ, bν, Rν, (α, β) => nuclearPrim(α, Rμ, β, Rν, B));
  }

  // Two-electron integrals
  const ERI: number[][][][] = [
    [[[0, 0], [0, 0]], [[0, 0], [0, 0]]],
    [[[0, 0], [0, 0]], [[0, 0], [0, 0]]],
  ];
  for (let μ = 0; μ < 2; μ++) for (let ν = 0; ν < 2; ν++) for (let λ = 0; λ < 2; λ++) for (let σ = 0; σ < 2; σ++) {
    const [bμ, Rμ] = centers[μ];
    const [bν, Rν] = centers[ν];
    const [bλ, Rλ] = centers[λ];
    const [bσ, Rσ] = centers[σ];
    ERI[μ][ν][λ][σ] = contract4(bμ, Rμ, bν, Rν, bλ, Rλ, bσ, Rσ);
  }

  // Core Hamiltonian
  const H: M2 = [[T[0][0] + V[0][0], T[0][1] + V[0][1]], [T[1][0] + V[1][0], T[1][1] + V[1][1]]];

  // SCF loop from P=0
  let P: M2 = [[0, 0], [0, 0]];
  let F: M2 = [[H[0][0], H[0][1]], [H[1][0], H[1][1]]];
  let C: M2 = [[1, 0], [0, 1]];
  let eps: [number, number] = [0, 0];
  let eOld = 0;
  let converged = false;
  let iter = 0;
  const maxIter = opts?.maxIter ?? 60;
  const tol = opts?.tol ?? 1e-10;

  for (iter = 1; iter <= maxIter; iter++) {
    // G_μν = Σ_λσ P_λσ [(μν|λσ) - ½(μλ|νσ)]
    const G: M2 = [[0, 0], [0, 0]];
    for (let μ = 0; μ < 2; μ++) for (let ν = 0; ν < 2; ν++) {
      let g = 0;
      for (let λ = 0; λ < 2; λ++) for (let σ = 0; σ < 2; σ++) {
        g += P[λ][σ] * (ERI[μ][ν][λ][σ] - 0.5 * ERI[μ][λ][ν][σ]);
      }
      G[μ][ν] = g;
    }
    F = [[H[0][0] + G[0][0], H[0][1] + G[0][1]], [H[1][0] + G[1][0], H[1][1] + G[1][1]]];

    const sol = solveGenEig2(F, S);
    eps = sol.eps;
    C = sol.C;

    // Occupied = lowest ε (first column). Density matrix for RHF (2 in lowest MO).
    const Pnew: M2 = [
      [2 * C[0][0] * C[0][0], 2 * C[0][0] * C[1][0]],
      [2 * C[1][0] * C[0][0], 2 * C[1][0] * C[1][0]],
    ];
    let e = 0;
    for (let μ = 0; μ < 2; μ++) for (let ν = 0; ν < 2; ν++) {
      e += 0.5 * Pnew[μ][ν] * (H[μ][ν] + F[μ][ν]);
    }
    if (Math.abs(e - eOld) < tol && iter > 1) { P = Pnew; eOld = e; converged = true; break; }
    P = Pnew;
    eOld = e;
  }

  // Energy contributions after convergence
  let kE = 0, vNE = 0;
  for (let μ = 0; μ < 2; μ++) for (let ν = 0; ν < 2; ν++) {
    kE += P[μ][ν] * T[μ][ν];
    vNE += P[μ][ν] * V[μ][ν];
  }
  const vNN = (Z_A * Z_B) / R;
  const eeContrib = eOld - kE - vNE;

  return {
    R, energy: eOld + vNN, eElec: eOld, vNN,
    orbitalEnergies: eps, coeffs: C, density: P,
    overlap: S[0][1], iterations: iter, converged,
    kineticContrib: kE, neContrib: vNE, eeContrib,
  };
}

// ---------------- Potential energy curve & derived quantities ----------------

export interface PESPoint { R: number; E: number; }

export function computePES(
  Rmin = 0.5, Rmax = 4.5, steps = 80,
): PESPoint[] {
  const out: PESPoint[] = [];
  for (let i = 0; i < steps; i++) {
    const R = Rmin + (Rmax - Rmin) * i / (steps - 1);
    const r = rhfH2(R);
    out.push({ R, E: r.energy });
  }
  return out;
}

export interface BondFit {
  Req: number;        // bohr
  Emin: number;       // Hartree
  kHartreeBohr2: number; // d²E/dR² at R_eq
  kNperM: number;
  kKcalMolA2: number;
  omegaRadPerS: number;
  nuTildeCm1: number; // vibrational wavenumber
  DeHartree: number;  // dissociation: E(R→∞) - E_min, from 2× isolated H (-0.466581 Ha total)
}

/** Fit parabola around the minimum to extract R_eq and k. */
export function fitBond(pes: PESPoint[]): BondFit {
  let iMin = 0;
  for (let i = 1; i < pes.length; i++) if (pes[i].E < pes[iMin].E) iMin = i;
  // Guard against endpoint minima (unphysical for H₂ in this range).
  const lo = Math.max(1, iMin - 1);
  const hi = Math.min(pes.length - 2, iMin + 1);
  const x0 = pes[lo].R, x1 = pes[lo + 1].R, x2 = pes[hi].R;
  const y0 = pes[lo].E, y1 = pes[lo + 1].E, y2 = pes[hi].E;
  // Lagrange parabola → vertex
  const denom = (x0 - x1) * (x0 - x2) * (x1 - x2);
  const aQ = (x2 * (y1 - y0) + x1 * (y0 - y2) + x0 * (y2 - y1)) / denom;
  const bQ = (x2 * x2 * (y0 - y1) + x1 * x1 * (y2 - y0) + x0 * x0 * (y1 - y2)) / denom;
  const cQ = (x1 * x2 * (x1 - x2) * y0 + x2 * x0 * (x2 - x0) * y1 + x0 * x1 * (x0 - x1) * y2) / denom;
  const Req = -bQ / (2 * aQ);
  const Emin = aQ * Req * Req + bQ * Req + cQ;
  const kAU = 2 * aQ; // d²E/dR² in Hartree/bohr²

  // Unit conversions
  const HARTREE_J = 4.3597447222071e-18;
  const BOHR_M = 5.29177210903e-11;
  const N_A = 6.02214076e23;
  const CAL_TO_J = 4184;
  const AMU_KG = 1.66053906660e-27;
  const C_CM_S = 2.99792458e10;
  // H₂ reduced mass: m_H · m_H / (2 m_H) = m_H / 2
  const m_H = 1.00782503207; // amu (¹H)
  const mu_kg = (m_H / 2) * AMU_KG;

  const kSI = kAU * HARTREE_J / (BOHR_M * BOHR_M);                       // N/m
  const kKcal = kSI * N_A / CAL_TO_J * (1e-10) * (1e-10);                // kcal/(mol·Å²)
  const omega = Math.sqrt(Math.max(0, kSI) / mu_kg);                     // rad/s
  const nuTilde = omega / (2 * Math.PI * C_CM_S);                        // cm⁻¹

  // Dissociation reference: 2 × isolated H atom energy in STO-3G.
  // For a single H with 1 electron on one 1s, HF energy = ⟨T⟩ + ⟨V_ne⟩ = -1/2 ⟨V_ne⟩ … but
  // in STO-3G (finite basis) the isolated H energy is  -0.466581 Ha. Use that constant.
  const ISOLATED_H_STO3G = -0.466581;
  const DeHartree = 2 * ISOLATED_H_STO3G - Emin;

  return { Req, Emin, kHartreeBohr2: kAU, kNperM: kSI, kKcalMolA2: kKcal, omegaRadPerS: omega, nuTildeCm1: nuTilde, DeHartree };
}

// ---------------- Wavefunction evaluator ----------------

export function moDensity(result: HFResult, r: Vec3): number {
  const R = result.R;
  const A: Vec3 = [-R / 2, 0, 0];
  const B: Vec3 = [R / 2, 0, 0];
  const phi = (center: Vec3) => {
    let v = 0;
    for (let i = 0; i < H_1S.alphas.length; i++) {
      const α = H_1S.alphas[i];
      const d = H_1S.coeffs[i] * normS(α);
      v += d * Math.exp(-α * dist2(r, center));
    }
    return v;
  };
  const φA = phi(A), φB = phi(B);
  // Bonding MO (lowest ε = column 0 of C)
  const c = result.coeffs;
  const ψ = c[0][0] * φA + c[1][0] * φB;
  return 2 * ψ * ψ; // 2 electrons in the bonding MO
}
