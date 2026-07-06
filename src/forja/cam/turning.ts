/**
 * CAM · TORNEADO — libro Cimo caps 2/4/5.
 *
 * Convención de torno (cap 2): Z = eje de rotación, X = radial; el G-code
 * programa X EN DIÁMETRO (estándar de torno). El frente de la pieza es Z=0 y
 * el material crece hacia -Z... aquí usamos Z creciendo hacia el chuck (atrás):
 * el careado ataca la cara Z=zFront, el perfil corre de frente hacia atrás.
 *
 * Operaciones del libro:
 *  · Careado (cap 4): desbaste ×N (ap 1.02, f 0.491 mm/rev, vc 356) + acabado
 *    (ap 0.96, f 0.265, vc 415) con VELOCIDAD DE SUPERFICIE CONSTANTE (G96 +
 *    tope G50 — a menor X el husillo acelera).
 *  · Turning Profile Roughing (cap 5): pasadas longitudinales bajando el radio
 *    por ap; cada pasada tornea desde el frente hasta CHOCAR con el perfil
 *    (+stock to leave) y retrae. El clásico G71 expandido honesto.
 *  · Turning Profile Finishing: UNA pasada siguiendo el contorno exacto.
 *  · Turning Groove: ranura por penetraciones (plunge) con ancho de inserto.
 *  · Taladrado en el eje (cap 5): pecks G83 por el centro (X0).
 *  · Tronzado (part-off): penetración final hasta el centro.
 *
 * El PERFIL r(z) se extrae de la MALLA de la pieza revolucionada (radio máximo
 * por rebanada de z) — funciona para cualquier sólido de revolución del kernel.
 * Motor PURO: testeable en node.
 */

export interface TurnPt { z: number; r: number }        // perfil: radio en función de z
export interface TurnStock { radius: number; zFront: number; zBack: number }
export interface TurnTool {
  noseR: number;      // radio de nariz del inserto
  feedRough: number;  // mm/rev
  feedFinish: number; // mm/rev
  vcRough: number;    // m/min (G96)
  vcFinish: number;   // m/min
  maxRpm: number;     // tope G50
}

export interface LatheMove {
  kind: 'rapid' | 'cut';
  from: [number, number]; // [x=RADIO, z]
  to: [number, number];
  feed?: number;          // mm/rev (G95)
}

const f3 = (n: number) => n.toFixed(3).replace(/\.?0+$/, '') || '0';

/** r(z) del perfil por interpolación (perfil ordenado por z creciente). */
export function profileR(profile: TurnPt[], z: number): number {
  if (!profile.length) return 0;
  if (z <= profile[0].z) return profile[0].r;
  for (let i = 1; i < profile.length; i++) {
    if (z <= profile[i].z) {
      const a = profile[i - 1], b = profile[i];
      const t = (z - a.z) / Math.max(1e-9, b.z - a.z);
      return a.r + t * (b.r - a.r);
    }
  }
  return profile[profile.length - 1].r;
}

/** Detecta el EJE de revolución de la malla: el de mayor esbeltez (largo/radio). */
export function detectAxis(mesh: { positions: Float32Array | number[] }): 'x' | 'y' | 'z' {
  const P = mesh.positions;
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const v = P[i + k] as number;
      if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
    }
  let best: 'x' | 'y' | 'z' = 'z', bestScore = -Infinity;
  (['x', 'y', 'z'] as const).forEach((ax, k) => {
    const ext = mx[k] - mn[k];
    const rad = Math.max(...[0, 1, 2].filter(j => j !== k).map(j => (mx[j] - mn[j]) / 2));
    const score = ext / Math.max(1e-9, rad);
    if (score > bestScore) { bestScore = score; best = ax; }
  });
  return best;
}

/** Extrae el perfil r(z) de una malla de revolución: radio máx por rebanada. */
export function profileFromMesh(
  mesh: { positions: Float32Array | number[] },
  axis: 'x' | 'y' | 'z' = 'z', slices = 120,
): TurnPt[] {
  const P = mesh.positions;
  let z0 = Infinity, z1 = -Infinity;
  const zi = axis === 'z' ? 2 : axis === 'y' ? 1 : 0;
  const xi = axis === 'x' ? 1 : 0, yi = axis === 'z' ? 1 : 2;
  for (let i = 0; i < P.length; i += 3) {
    const z = P[i + zi] as number;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const R = new Float64Array(slices).fill(0);
  for (let i = 0; i < P.length; i += 3) {
    const z = P[i + zi] as number;
    const r = Math.hypot(P[i + xi] as number, P[i + yi] as number);
    let k = Math.min(slices - 1, Math.max(0, Math.floor(((z - z0) / Math.max(1e-9, z1 - z0)) * slices)));
    if (r > R[k]) R[k] = r;
  }
  // rellenar rebanadas vacías con el vecino (caras planas largas casi no aportan vértices)
  for (let k = 1; k < slices; k++) if (R[k] === 0) R[k] = R[k - 1];
  for (let k = slices - 2; k >= 0; k--) if (R[k] === 0) R[k] = R[k + 1];
  const pts: TurnPt[] = [];
  for (let k = 0; k < slices; k++) pts.push({ z: z0 + ((k + 0.5) / slices) * (z1 - z0), r: R[k] });
  return pts;
}

/** CAREADO (cap 4): N pasadas de desbaste + 1 de acabado sobre la cara frontal. */
export function turnFacing(
  stock: TurnStock, tool: TurnTool,
  p: { roughPasses: number; roughAp: number; finishAp: number; clear: number },
): LatheMove[] {
  const M: LatheMove[] = [];
  const xSafe = stock.radius + p.clear;
  let zFace = stock.zFront;
  const face = (z: number, feed: number) => {
    M.push({ kind: 'rapid', from: [xSafe, zFace + p.clear], to: [xSafe, z] });
    M.push({ kind: 'cut', from: [xSafe, z], to: [-tool.noseR, z], feed }); // pasa el centro por el radio de nariz
    M.push({ kind: 'rapid', from: [-tool.noseR, z], to: [-tool.noseR, z + p.clear] });
    M.push({ kind: 'rapid', from: [-tool.noseR, z + p.clear], to: [xSafe, z + p.clear] });
  };
  for (let i = 0; i < p.roughPasses; i++) { zFace -= p.roughAp; face(zFace, tool.feedRough); }
  zFace -= p.finishAp; face(zFace, tool.feedFinish);
  return M;
}

/** DESBASTE DE PERFIL (cap 5): pasadas longitudinales, radio bajando por ap. */
export function turnProfileRough(
  profile: TurnPt[], stock: TurnStock, tool: TurnTool,
  p: { ap: number; stockToLeave: number; clear: number; zStart: number; zEnd: number },
): LatheMove[] {
  const M: LatheMove[] = [];
  const xSafe = stock.radius + p.clear;
  for (let x = stock.radius - p.ap; ; x -= p.ap) {
    const rMin = Math.min(...profile.filter(q => q.z >= p.zStart && q.z <= p.zEnd).map(q => q.r));
    const xPass = Math.max(x, rMin + p.stockToLeave);
    // hasta dónde puede correr esta pasada: primer z donde el perfil (+stock) sube sobre xPass
    let zStop = p.zEnd;
    for (let z = p.zStart; z <= p.zEnd; z += 0.25) {
      if (profileR(profile, z) + p.stockToLeave > xPass + 1e-9) { zStop = z - 0.25; break; }
    }
    if (zStop <= p.zStart + 1e-9) break; // ya no hay tramo torneables a este radio
    M.push({ kind: 'rapid', from: [xSafe, p.zStart - p.clear], to: [xPass, p.zStart - p.clear] });
    M.push({ kind: 'cut', from: [xPass, p.zStart - p.clear], to: [xPass, zStop], feed: tool.feedRough });
    M.push({ kind: 'rapid', from: [xPass, zStop], to: [xSafe, zStop] });
    M.push({ kind: 'rapid', from: [xSafe, zStop], to: [xSafe, p.zStart - p.clear] });
    if (xPass <= rMin + p.stockToLeave + 1e-9) break; // llegamos al piso del perfil
  }
  return M;
}

/** ACABADO DE PERFIL (cap 5): una pasada siguiendo el contorno exacto. */
export function turnProfileFinish(
  profile: TurnPt[], stock: TurnStock, tool: TurnTool,
  p: { clear: number; zStart: number; zEnd: number },
): LatheMove[] {
  const M: LatheMove[] = [];
  const pts = profile.filter(q => q.z >= p.zStart && q.z <= p.zEnd);
  if (!pts.length) return M;
  const xSafe = stock.radius + p.clear;
  M.push({ kind: 'rapid', from: [xSafe, p.zStart - p.clear], to: [pts[0].r, p.zStart - p.clear] });
  let prev: [number, number] = [pts[0].r, p.zStart - p.clear];
  for (const q of pts) {
    M.push({ kind: 'cut', from: prev, to: [q.r, q.z], feed: tool.feedFinish });
    prev = [q.r, q.z];
  }
  M.push({ kind: 'rapid', from: prev, to: [xSafe, prev[1]] });
  return M;
}

/** RANURA (cap 5): penetraciones con inserto de ancho w hasta rInner. */
export function turnGroove(
  groove: { z0: number; z1: number; rOuter: number; rInner: number }, tool: TurnTool,
  p: { insertW: number; clear: number },
): LatheMove[] {
  const M: LatheMove[] = [];
  const xSafe = groove.rOuter + p.clear;
  const nP = Math.max(1, Math.ceil((groove.z1 - groove.z0) / p.insertW));
  for (let i = 0; i < nP; i++) {
    const z = Math.min(groove.z1 - p.insertW / 2, groove.z0 + p.insertW / 2 + i * p.insertW);
    M.push({ kind: 'rapid', from: [xSafe, z], to: [groove.rOuter + 0.5, z] });
    M.push({ kind: 'cut', from: [groove.rOuter + 0.5, z], to: [groove.rInner, z], feed: tool.feedFinish * 0.6 });
    M.push({ kind: 'rapid', from: [groove.rInner, z], to: [xSafe, z] });
  }
  return M;
}

/** TRONZADO (part-off): penetración final hasta pasado el centro. */
export function turnPartOff(
  stock: TurnStock, tool: TurnTool, p: { z: number; clear: number },
): LatheMove[] {
  const xSafe = stock.radius + p.clear;
  return [
    { kind: 'rapid', from: [xSafe, p.z + p.clear], to: [xSafe, p.z] },
    { kind: 'cut', from: [xSafe, p.z], to: [-tool.noseR, p.z], feed: tool.feedFinish * 0.5 },
    { kind: 'rapid', from: [-tool.noseR, p.z], to: [xSafe, p.z] },
  ];
}

/** Post de TORNO: G96 (vel. superficie constante) + G50 tope + G95 (mm/rev), X EN DIÁMETRO. */
export function toLatheGcode(moves: LatheMove[], tool: TurnTool, opName: string, vc: number): string {
  const L: string[] = [
    `(La Forja CAM - TORNO - ${opName})`,
    'G21 (mm)', 'G18 (plano XZ del torno)', 'G95 (avance por revolucion)',
    `G50 S${Math.round(tool.maxRpm)} (tope de husillo)`,
    `G96 S${Math.round(vc)} M3 (velocidad de superficie constante m/min)`,
  ];
  let lastFeed = -1;
  for (const m of moves) {
    const X = f3(m.to[0] * 2); // DIÁMETRO
    const Z = f3(m.to[1]);
    if (m.kind === 'rapid') L.push(`G0 X${X} Z${Z}`);
    else {
      const fw = m.feed !== undefined && m.feed !== lastFeed ? ` F${m.feed}` : '';
      if (m.feed !== undefined) lastFeed = m.feed;
      L.push(`G1 X${X} Z${Z}${fw}`);
    }
  }
  L.push('G97 (cancela CSS)', 'M5', 'M30');
  return L.join('\n') + '\n';
}
