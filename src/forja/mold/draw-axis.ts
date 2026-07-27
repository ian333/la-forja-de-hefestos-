/**
 * ELECCIÓN DE LA DIRECCIÓN DE APERTURA — la Máquina piensa como moldista:
 * prueba los 3 ejes de la pieza como dirección de apertura (±Z del molde) y se
 * queda con el MEJOR por score lexicográfico:
 *   1. sin cavidades selladas (NO moldeable) ·
 *   2. mínimo VOLUMEN de undercut (menos mecanismos §11.3) ·
 *   3. mínimo % de área lateral sin draft (§2.3.6 — un embudo abre por su eje
 *      de revolución: TODO es draft; acostado, sus paredes quedan verticales).
 * La regla vieja ("eje menor = profundidad") acostaba embudos y vasos.
 * Cada candidato es una ROTACIÓN propia (quiralidad intacta) con min en 0.
 */
import { dfmFromMesh, type DfmMeshReport } from './dfm-mesh';

export interface OrientedMesh {
  positions: Float32Array; indices: Uint32Array;
  /** qué eje ORIGINAL quedó como apertura (z) y descripción humana */
  zAxis: 0 | 1 | 2; label: string;
}

/** construye la malla con el eje `zAxis` original como Z, mayor de los restantes
 *  como X, quiralidad corregida (det=+1) y esquina mínima en el origen. */
export function orientMesh(mesh: { positions: Float32Array; indices: Uint32Array }, zAxis: 0 | 1 | 2): OrientedMesh {
  const P = mesh.positions;
  const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = P[i + k];
    if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
  }
  const rest = [0, 1, 2].filter((a) => a !== zAxis) as [number, number];
  const ext = (a: number) => mx[a] - mn[a];
  const xAxis = ext(rest[0]) >= ext(rest[1]) ? rest[0] : rest[1];
  const yAxis = xAxis === rest[0] ? rest[1] : rest[0];
  const order = [xAxis, yAxis, zAxis];
  // quiralidad: permutación impropia espejea la pieza → negar Y (rotación propia)
  const perm = [0, 1, 2].map((r) => [0, 1, 2].map((c) => (order[r] === c ? 1 : 0)));
  const det = perm[0][0] * (perm[1][1] * perm[2][2] - perm[1][2] * perm[2][1])
    - perm[0][1] * (perm[1][0] * perm[2][2] - perm[1][2] * perm[2][0])
    + perm[0][2] * (perm[1][0] * perm[2][1] - perm[1][1] * perm[2][0]);
  const sy = det < 0 ? -1 : 1;
  const y0 = sy > 0 ? mn[yAxis] : -mx[yAxis];
  const out = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    out[i] = P[i + xAxis] - mn[xAxis];
    out[i + 1] = sy * P[i + yAxis] - y0;
    out[i + 2] = P[i + zAxis] - mn[zAxis];
  }
  const names = ['L', 'W', 'H'];
  return { positions: out, indices: mesh.indices, zAxis, label: `apertura ∥ eje ${names[zAxis]} original (${ext(zAxis).toFixed(0)} mm)` };
}

export interface DrawAxisChoice {
  oriented: OrientedMesh;
  dfm: DfmMeshReport;
  candidates: Array<{ zAxis: number; label: string; enclosed: boolean; underVol: number; draftPct: number }>;
}

/** prueba los 3 ejes y elige (sellado ✗ → menos undercut → menos sin-draft). */
export function pickDrawAxis(mesh: { positions: Float32Array; indices: Uint32Array }, o?: { wallMm?: number }): DrawAxisChoice {
  let best: { om: OrientedMesh; dfm: DfmMeshReport } | null = null;
  const candidates: DrawAxisChoice['candidates'] = [];
  for (const z of [0, 1, 2] as const) {
    const om = orientMesh(mesh, z);
    const dfm = dfmFromMesh(om, { wallMm: o?.wallMm });
    candidates.push({
      zAxis: z, label: om.label,
      enclosed: dfm.undercut.enclosedVoids,
      underVol: dfm.undercut.volumeMm3,
      draftPct: dfm.draft.pctBelowMin,
    });
    if (!best) { best = { om, dfm }; continue; }
    const a = dfm, b = best.dfm;
    const better = (Number(a.undercut.enclosedVoids) - Number(b.undercut.enclosedVoids))
      || (a.undercut.volumeMm3 - b.undercut.volumeMm3)
      || (a.draft.pctBelowMin - b.draft.pctBelowMin);
    if (better < 0) best = { om, dfm };
  }
  return { oriented: best!.om, dfm: best!.dfm, candidates };
}
