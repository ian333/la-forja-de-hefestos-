/**
 * ⚒️ La Forja — DISEÑO GENERATIVO (optimización topológica SIMP + OC)
 * ===================================================================
 * Le das un envolvente (sólido) + dónde se fija + dónde se carga, y La Forja
 * QUITA material hasta la forma óptima (mínima flexibilidad a volumen dado). Es
 * lo que Autodesk cobra carísimo (Generative/Fusion Simulation Extension).
 *
 * Implementación LITERAL de top88 (Andreassen et al., "Efficient topology
 * optimization in MATLAB using 88 lines", Struct Multidisc Optim 43:1-16, 2011),
 * sobre la malla REGULAR de voxeles de La Forja: cada VOXEL (= 6 tets) es la
 * variable de densidad x_e. Reusa el solver FEA ya verificado contra el cantilever.
 *
 * SIMP (ec.1):  E_e = E_min + x_e^p (E0 − E_min)
 * Objetivo (2): min c = Uᵀ K U = Σ E_e u_eᵀ k0_e u_e   s.a.  Σx_e/N = volfrac
 * Sensib. (5):  ∂c/∂x_e = −p x_e^{p−1}(E0−E_min) u_eᵀ k0_e u_e   (≤0)
 * OC (3,4):     x_new = clamp(x·√(−dc/(λ dv))), λ por bisección hasta el volumen.
 * Filtro (7-10): evita checkerboard / dependencia de malla.
 */
import { elasticityMatrix3D, tet4Element } from '../../lib/formulas';
import type { OC, Shape } from './occt';
import {
  prepareFeaSession, sparseInit, sparseAdd, sparseCG,
  type FaceBC, type FEAOptions, type VolumeTetMesh,
} from './fea';

const MM_TO_M = 1e-3;

interface DesignCell {
  cx: number; cy: number; cz: number;   // centroide (mm)
  dof: Int32Array;                       // 24 DOFs globales (8 nodos × 3)
  k0: Float64Array;                      // rigidez UNITARIA del voxel 24×24 (E=1), fila-mayor
}

export interface TopOptParams {
  volfrac: number;            // fracción de volumen objetivo (0..1)
  penal?: number;             // penalización SIMP (p=3)
  rmin?: number;              // radio del filtro en VOXELES (≈1.5)
  ft?: 1 | 2;                 // 1 = filtro de sensibilidad, 2 = de densidad
  maxLoops?: number;
  tolChange?: number;
  move?: number;
  resolution?: number;
}

export interface TopOptResult {
  xPhys: Float64Array;        // densidad física por voxel (0..1)
  compliance: number;
  history: { loop: number; c: number; vol: number; change: number }[];
  mesh: VolumeTetMesh;
  cells: DesignCell[];
  nCells: number;
}

/** Optimización topológica pura (como runFEA): envolvente + BC → campo de densidad. */
export function runTopOpt(
  oc: OC, shape: Shape, bc: FaceBC,
  material: FEAOptions['material'], params: TopOptParams,
): TopOptResult {
  const penal = params.penal ?? 3;
  const volfrac = params.volfrac;
  const move = params.move ?? 0.2;
  const ft = params.ft ?? 1;
  const maxLoops = params.maxLoops ?? 120;
  const tolChange = params.tolChange ?? 0.01;

  // ── PRE-PROCESO (reusa la malla + BC del FEA ya verificado) ──
  const session = prepareFeaSession(oc, shape, bc, { material, resolution: params.resolution ?? 16 });
  const mesh = session.mesh;
  const nDOF = session.nDOF;
  const E0 = session.material.youngsModulus;
  const Emin = 1e-9 * E0;
  const Dunit = elasticityMatrix3D(1, session.material.poissonsRatio); // k0 con E=1

  // Voxel = 6 tets consecutivos (así los emite brepToVolumeTetMesh).
  const nCells = Math.floor(mesh.nTets / 6);
  const cells: DesignCell[] = [];
  for (let c = 0; c < nCells; c++) {
    const nodeSet = new Set<number>();
    for (let t = 0; t < 6; t++) {
      const b = (c * 6 + t) * 4;
      nodeSet.add(mesh.tets[b]); nodeSet.add(mesh.tets[b + 1]);
      nodeSet.add(mesh.tets[b + 2]); nodeSet.add(mesh.tets[b + 3]);
    }
    const nodes8 = [...nodeSet];
    if (nodes8.length !== 8) continue; // voxel degenerado (no debería) → saltar
    const local = new Map<number, number>(); nodes8.forEach((n, li) => local.set(n, li));
    const dof = new Int32Array(24);
    let cx = 0, cy = 0, cz = 0;
    for (let a = 0; a < 8; a++) {
      const n = nodes8[a];
      dof[a * 3] = n * 3; dof[a * 3 + 1] = n * 3 + 1; dof[a * 3 + 2] = n * 3 + 2;
      cx += mesh.nodes[n * 3]; cy += mesh.nodes[n * 3 + 1]; cz += mesh.nodes[n * 3 + 2];
    }
    cx /= 8; cy /= 8; cz /= 8;
    // ensambla k0 (24×24, E=1) de los 6 tets
    const k0 = new Float64Array(24 * 24);
    for (let t = 0; t < 6; t++) {
      const b = (c * 6 + t) * 4;
      const tn = [mesh.tets[b], mesh.tets[b + 1], mesh.tets[b + 2], mesh.tets[b + 3]];
      const coords: [
        [number, number, number], [number, number, number],
        [number, number, number], [number, number, number]
      ] = [
        [mesh.nodes[tn[0] * 3] * MM_TO_M, mesh.nodes[tn[0] * 3 + 1] * MM_TO_M, mesh.nodes[tn[0] * 3 + 2] * MM_TO_M],
        [mesh.nodes[tn[1] * 3] * MM_TO_M, mesh.nodes[tn[1] * 3 + 1] * MM_TO_M, mesh.nodes[tn[1] * 3 + 2] * MM_TO_M],
        [mesh.nodes[tn[2] * 3] * MM_TO_M, mesh.nodes[tn[2] * 3 + 1] * MM_TO_M, mesh.nodes[tn[2] * 3 + 2] * MM_TO_M],
        [mesh.nodes[tn[3] * 3] * MM_TO_M, mesh.nodes[tn[3] * 3 + 1] * MM_TO_M, mesh.nodes[tn[3] * 3 + 2] * MM_TO_M],
      ];
      const { K: Ke } = tet4Element(coords, Dunit);
      for (let ri = 0; ri < 4; ri++) for (let rj = 0; rj < 3; rj++) {
        const la = (local.get(tn[ri]) as number) * 3 + rj, li = ri * 3 + rj;
        for (let ci = 0; ci < 4; ci++) for (let cj = 0; cj < 3; cj++) {
          const lb = (local.get(tn[ci]) as number) * 3 + cj, lj = ci * 3 + cj;
          k0[la * 24 + lb] += Ke[li][lj];
        }
      }
    }
    cells.push({ cx, cy, cz, dof, k0 });
  }
  const N = cells.length;

  // ── FILTRO: vecinos dentro de rmin·voxel (ec.8). O(N²) — ok para malla coarse. ──
  const rmm = (params.rmin ?? 1.5) * mesh.voxel;
  const filtIdx: number[][] = new Array(N);
  const filtW: Float64Array[] = new Array(N);
  const filtHs = new Float64Array(N);
  for (let e = 0; e < N; e++) {
    const idx: number[] = [], w: number[] = []; let hs = 0;
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(cells[e].cx - cells[i].cx, cells[e].cy - cells[i].cy, cells[e].cz - cells[i].cz);
      const H = rmm - d;
      if (H > 0) { idx.push(i); w.push(H); hs += H; }
    }
    filtIdx[e] = idx; filtW[e] = new Float64Array(w); filtHs[e] = hs;
  }

  // ── Vector de carga f + DOFs fijos (de la sesión) ──
  const f = new Float64Array(nDOF);
  const force = bc.totalForce ?? [0, 0, 0];
  const ln = session.loadNodes;
  if (ln.length) {
    const per = [force[0] / ln.length, force[1] / ln.length, force[2] / ln.length];
    for (const n of ln) { f[n * 3] += per[0]; f[n * 3 + 1] += per[1]; f[n * 3 + 2] += per[2]; }
  }
  const fixedDOF = session.fixedDOF;

  // ── BUCLE SIMP + OC ──
  const x = new Float64Array(N).fill(volfrac);
  let xPhys = Float64Array.from(x);
  let U: Float64Array | undefined;
  const history: TopOptResult['history'] = [];
  let change = 1, loop = 0, compliance = 0;

  const applyDensityFilter = (src: Float64Array, dst: Float64Array) => {
    for (let e = 0; e < N; e++) {
      let s = 0; const idx = filtIdx[e], w = filtW[e];
      for (let t = 0; t < idx.length; t++) s += w[t] * src[idx[t]];
      dst[e] = s / filtHs[e];
    }
  };

  while (change > tolChange && loop < maxLoops) {
    loop++;
    if (ft === 2) applyDensityFilter(x, xPhys); else xPhys = Float64Array.from(x);

    // FE: K = Σ E_e·k0_e ; Dirichlet ; resolver (warm-start entre iteraciones)
    const K = sparseInit(nDOF);
    for (let e = 0; e < N; e++) {
      const Ee = Emin + Math.pow(xPhys[e], penal) * (E0 - Emin);
      const dof = cells[e].dof, k0 = cells[e].k0;
      for (let a = 0; a < 24; a++) {
        const ga = dof[a];
        for (let b = 0; b < 24; b++) { const v = k0[a * 24 + b]; if (v !== 0) sparseAdd(K, ga, dof[b], Ee * v); }
      }
    }
    for (const d of fixedDOF) {
      const row = K.rows[d];
      for (const [j] of row) { if (j !== d && K.rows[j].has(d)) K.rows[j].delete(d); }
      K.rows[d] = new Map([[d, 1]]);
    }
    const fbc = Float64Array.from(f); for (const d of fixedDOF) fbc[d] = 0;
    const sol = sparseCG(K, fbc, 1e-7, Math.max(2000, 4 * nDOF), U);
    U = sol.u;

    // compliance + sensibilidades
    let c = 0;
    const dc = new Float64Array(N);
    const dv = new Float64Array(N).fill(1);
    for (let e = 0; e < N; e++) {
      const dof = cells[e].dof, k0 = cells[e].k0;
      let ce = 0;
      for (let a = 0; a < 24; a++) {
        let ku = 0; for (let b = 0; b < 24; b++) ku += k0[a * 24 + b] * U[dof[b]];
        ce += U[dof[a]] * ku;
      }
      const Ee = Emin + Math.pow(xPhys[e], penal) * (E0 - Emin);
      c += Ee * ce;
      dc[e] = -penal * Math.pow(xPhys[e], penal - 1) * (E0 - Emin) * ce; // ≤0
    }
    compliance = c;

    // FILTRADO de sensibilidades (ec.7 / 9,10)
    if (ft === 1) {
      const dcn = new Float64Array(N);
      for (let e = 0; e < N; e++) {
        let s = 0; const idx = filtIdx[e], w = filtW[e];
        for (let t = 0; t < idx.length; t++) s += w[t] * x[idx[t]] * dc[idx[t]];
        dcn[e] = s / (Math.max(1e-3, x[e]) * filtHs[e]);
      }
      dc.set(dcn);
    } else {
      const dcn = new Float64Array(N), dvn = new Float64Array(N);
      for (let e = 0; e < N; e++) {
        let sc = 0, sv = 0; const idx = filtIdx[e], w = filtW[e];
        for (let t = 0; t < idx.length; t++) { sc += w[t] * dc[idx[t]] / filtHs[idx[t]]; sv += w[t] * dv[idx[t]] / filtHs[idx[t]]; }
        dcn[e] = sc; dvn[e] = sv;
      }
      dc.set(dcn); dv.set(dvn);
    }

    // OC: bisección de λ hasta cumplir el volumen (ec.3,4)
    let l1 = 0, l2 = 1e9;
    const xnew = new Float64Array(N);
    const xPhysTmp = new Float64Array(N);
    while ((l2 - l1) / (l1 + l2) > 1e-3) {
      const lmid = 0.5 * (l1 + l2);
      for (let e = 0; e < N; e++) {
        const Be = Math.sqrt(Math.max(0, -dc[e] / (dv[e] * lmid)));
        let xe = x[e] * Be;
        xe = Math.max(0, Math.max(x[e] - move, Math.min(1, Math.min(x[e] + move, xe))));
        xnew[e] = xe;
      }
      let vol = 0;
      if (ft === 2) { applyDensityFilter(xnew, xPhysTmp); for (let e = 0; e < N; e++) vol += xPhysTmp[e]; }
      else for (let e = 0; e < N; e++) vol += xnew[e];
      if (vol > volfrac * N) l1 = lmid; else l2 = lmid;
    }

    change = 0;
    for (let e = 0; e < N; e++) { const d = Math.abs(xnew[e] - x[e]); if (d > change) change = d; x[e] = xnew[e]; }
    let volMean = 0;
    if (ft === 2) { applyDensityFilter(x, xPhys); }
    else xPhys = Float64Array.from(x);
    for (let e = 0; e < N; e++) volMean += xPhys[e];
    volMean /= N;
    history.push({ loop, c, vol: volMean, change });
  }

  return { xPhys, compliance, history, mesh, cells, nCells: N };
}
