/**
 * CAM · ADAPTIVE CLEARING 3D (desbaste por niveles Z) — libro Cimo cap 10.
 *
 * El libro: "the only two roughing commands are Adaptive Clearing and Pocket
 * Clearing"; el adaptive genera pasadas con carga constante que desbastan el
 * stock NIVEL POR NIVEL respetando la superficie 3D de la pieza. Aquí la
 * semántica exacta se honra así:
 *   1) HEIGHTMAP de la pieza: malla teselada → z_pieza(x,y) por raycast vertical
 *      (punto-en-triángulo 2D + z del plano del triángulo; el máximo gana).
 *   2) Por cada nivel z (de arriba hacia abajo, paso = profundidad de pasada):
 *      filas zigzag (paso = carga óptima a_e) recortadas a los tramos donde el
 *      nivel está EN AIRE SOBRE LA PIEZA (z_pieza + stockToLeave < z ≤ z_stock)
 *      → la fresa nunca toca la superficie final (deja stockToLeave).
 *   3) El radio de la fresa INFLA la pieza (dilatación del heightmap por radio):
 *      el CENTRO de la fresa debe quedar a ≥ r de todo punto más alto que el
 *      nivel — sin gouge en paredes ni en pendientes.
 * Motor PURO (malla → segmentos): testeable en node con una malla sintética.
 */
import type { FacingTool, ToolpathSegment } from './facing';

export interface MeshLike {
  positions: Float32Array | number[];
  indices: Uint32Array | number[];
}

export interface Adaptive3DParams {
  stepdown: number;     // profundidad por nivel (a_p)
  stepover: number;     // paso lateral entre filas (a_e)
  stockToLeave: number; // material que se deja para el acabado (libro: Stock to Leave)
  safeZ: number;        // altura de traslado sobre el stock
  grid: number;         // resolución del heightmap (mm por celda)
}

/** Heightmap por muestreo: z máximo de la pieza en cada celda (−Inf = fuera). */
export function buildHeightmap(mesh: MeshLike, grid: number) {
  const P = mesh.positions, I = mesh.indices;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i];
    if (P[i + 1] < y0) y0 = P[i + 1]; if (P[i + 1] > y1) y1 = P[i + 1];
    if (P[i + 2] < z0) z0 = P[i + 2]; if (P[i + 2] > z1) z1 = P[i + 2];
  }
  const nx = Math.max(2, Math.ceil((x1 - x0) / grid) + 1);
  const ny = Math.max(2, Math.ceil((y1 - y0) / grid) + 1);
  const H = new Float64Array(nx * ny).fill(-Infinity);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ax = P[a], ay = P[a + 1], az = P[a + 2];
    const bx = P[b], by = P[b + 1], bz = P[b + 2];
    const cx = P[c], cy = P[c + 1], cz = P[c + 2];
    const mnx = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / grid));
    const mxx = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) - x0) / grid));
    const mny = Math.max(0, Math.floor((Math.min(ay, by, cy) - y0) / grid));
    const mxy = Math.min(ny - 1, Math.ceil((Math.max(ay, by, cy) - y0) / grid));
    const den = (by - ay) * (cx - ax) - (bx - ax) * (cy - ay);
    if (Math.abs(den) < 1e-12) continue; // triángulo vertical: no aporta altura
    for (let gy = mny; gy <= mxy; gy++) {
      for (let gx = mnx; gx <= mxx; gx++) {
        const px = x0 + gx * grid, py = y0 + gy * grid;
        const w1 = ((py - ay) * (cx - ax) - (px - ax) * (cy - ay)) / den;
        const w2 = ((px - ax) * (by - ay) - (py - ay) * (bx - ax)) / den;
        if (w1 < -1e-9 || w2 < -1e-9 || w1 + w2 > 1 + 1e-9) continue;
        const z = az + w1 * (bz - az) + w2 * (cz - az);
        const k = gy * nx + gx;
        if (z > H[k]) H[k] = z;
      }
    }
  }
  return { H, nx, ny, x0, y0, x1, y1, z0, z1, grid };
}

type Heightmap = ReturnType<typeof buildHeightmap>;

/** Dilatación por radio de fresa: h'(x,y) = máx de h en el disco de radio r. */
export function dilateByTool(hm: Heightmap, toolR: number): Float64Array {
  const { H, nx, ny, grid } = hm;
  const rc = Math.ceil(toolR / grid);
  const disk: Array<[number, number]> = [];
  for (let dy = -rc; dy <= rc; dy++)
    for (let dx = -rc; dx <= rc; dx++)
      if (Math.hypot(dx * grid, dy * grid) <= toolR + 1e-9) disk.push([dx, dy]);
  const D = new Float64Array(nx * ny).fill(-Infinity);
  for (let gy = 0; gy < ny; gy++) {
    for (let gx = 0; gx < nx; gx++) {
      let m = -Infinity;
      for (const [dx, dy] of disk) {
        const X = gx + dx, Y = gy + dy;
        if (X < 0 || X >= nx || Y < 0 || Y >= ny) continue;
        const v = H[Y * nx + X];
        if (v > m) m = v;
      }
      D[gy * nx + gx] = m;
    }
  }
  return D;
}

/** Desbaste 3D por niveles: zigzag recortado donde el nivel va EN AIRE sobre la pieza. */
export function generateAdaptive3DToolpath(
  mesh: MeshLike, tool: FacingTool, p: Adaptive3DParams,
): ToolpathSegment[] {
  const hm = buildHeightmap(mesh, p.grid);
  const D = dilateByTool(hm, tool.diameter / 2 + p.stockToLeave);
  const { nx, ny, x0, y0, grid } = hm;
  const zSafe = hm.z1 + p.safeZ;
  const segs: ToolpathSegment[] = [];
  let cur: [number, number, number] | null = null;
  const go = (x: number, y: number, zCut: number) => {
    // traslado seguro al inicio de un tramo + plunge; los tramos consecutivos cortan
    if (!cur) {
      segs.push({ kind: 'rapid', from: [x, y, zSafe], to: [x, y, zSafe] });
      segs.push({ kind: 'plunge', from: [x, y, zSafe], to: [x, y, zCut] });
    } else {
      segs.push({ kind: 'rapid', from: cur, to: [cur[0], cur[1], zSafe] });
      segs.push({ kind: 'rapid', from: [cur[0], cur[1], zSafe], to: [x, y, zSafe] });
      segs.push({ kind: 'plunge', from: [x, y, zSafe], to: [x, y, zCut] });
    }
    cur = [x, y, zCut];
  };
  const cutTo = (x: number, y: number, zCut: number) => {
    segs.push({ kind: 'cut', from: cur!, to: [x, y, zCut] });
    cur = [x, y, zCut];
  };
  // niveles de arriba (primer corte bajo el tope del stock) hacia abajo
  for (let z = hm.z1 - p.stepdown; z > hm.z0 + 1e-9; z -= p.stepdown) {
    const zCut = Math.max(z, hm.z0 + 1e-9);
    let flip = false;
    for (let gy = 0; gy < ny; gy += Math.max(1, Math.round(p.stepover / grid))) {
      const y = y0 + gy * grid;
      // tramos cortables de la fila: centro de fresa donde la pieza DILATADA queda bajo el nivel
      const runs: Array<[number, number]> = [];
      let s = -1;
      for (let gx = 0; gx <= nx; gx++) {
        const open = gx < nx && D[gy * nx + gx] + p.stockToLeave + 1e-9 < zCut && hm.H[gy * nx + gx] > -Infinity;
        if (open && s < 0) s = gx;
        if (!open && s >= 0) { runs.push([s, gx - 1]); s = -1; }
      }
      if (!runs.length) continue;
      if (flip) runs.reverse();
      for (const [ga, gb] of runs) {
        const xa = x0 + (flip ? gb : ga) * grid, xb = x0 + (flip ? ga : gb) * grid;
        if (Math.abs(xb - xa) < grid * 0.5) continue; // tramo degenerado
        go(xa, y, zCut);
        cutTo(xb, y, zCut);
      }
      flip = !flip;
    }
  }
  if (cur) segs.push({ kind: 'rapid', from: cur, to: [cur[0], cur[1], zSafe] });
  return segs;
}
