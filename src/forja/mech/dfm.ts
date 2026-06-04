/**
 * DFM — la física de la impresora 3D (FDM) DENTRO del diseño. Puro (sin WASM),
 * testeable. Calcula la HOLGURA print-in-place, la COMPENSACIÓN de barrenos, y
 * analiza la IMPRIMIBILIDAD (mapa de voladizos sobre la malla, ¿cabe?, soporte).
 *
 * Números anclados en investigación (docs/forja-research/imprimibilidad-*):
 *  · holgura cicloidal óptima ≈ 0.3 mm (estudio 2025), piso ≥ 1 capa, ~1× extrusión.
 *  · PETG/flex +0.1–0.15 sobre PLA. Barrenos FDM salen 0.1–0.3 mm chicos → compensar.
 *  · voladizos: regla de 45° desde la vertical (warn), ≥60° necesita soporte.
 */

export type Material = 'PLA' | 'PETG' | 'ABS' | 'TPU' | 'Nylon';
export interface PrintProfile {
  bedX: number; bedY: number; bedZ: number;   // volumen de impresión (mm)
  margin: number;                              // borde no usable (mm)
  nozzle: number; layerHeight: number;         // boquilla / altura de capa (mm)
  material: Material;
  overhangWarnDeg: number;                     // 45
  overhangErrDeg: number;                      // 60
}
export const PRINT_PROFILES: Record<string, PrintProfile> = {
  ender3: { bedX: 220, bedY: 220, bedZ: 250, margin: 5, nozzle: 0.4, layerHeight: 0.2, material: 'PLA', overhangWarnDeg: 45, overhangErrDeg: 60 },
  media: { bedX: 256, bedY: 256, bedZ: 256, margin: 5, nozzle: 0.4, layerHeight: 0.2, material: 'PLA', overhangWarnDeg: 45, overhangErrDeg: 60 },
  grande: { bedX: 350, bedY: 350, bedZ: 400, margin: 5, nozzle: 0.4, layerHeight: 0.2, material: 'PETG', overhangWarnDeg: 45, overhangErrDeg: 60 },
};
// Material → mm extra de holgura sobre PLA (PETG estringa y puentea el gap).
const MAT_CLEAR: Record<Material, number> = { PLA: 0, PETG: 0.12, ABS: 0.05, TPU: 0.2, Nylon: 0.05 };

/** HOLGURA print-in-place (mm): ~0.75× boquilla (=0.3 con 0.4) + offset de
 *  material, piso ≥ 1 capa. Es lo que deja MOVER + alojar grasa + auto-puentear. */
export function clearance(p: PrintProfile): number {
  const c = 0.75 * p.nozzle + MAT_CLEAR[p.material];
  return Math.round(Math.max(c, p.layerHeight) * 100) / 100;
}
/** COMPENSACIÓN de barreno (mm): los agujeros FDM salen chicos → súmalo al ⌀
 *  del modelo para que el impreso quede a la medida. ~0.4× boquilla. */
export function holeCompensation(p: PrintProfile): number {
  return Math.round(0.4 * p.nozzle * 100) / 100;   // 0.16 con boquilla 0.4
}
export function compensateHole(nominalD: number, p: PrintProfile): number {
  return nominalD + holeCompensation(p);
}

export interface PrintabilityReport {
  bbox: { w: number; d: number; h: number };   // X,Y,Z reales (mm)
  fits: boolean;                                // ¿cabe en el volumen útil?
  triTotal: number; triOK: number; triWarn: number; triSupport: number;
  supportAreaMm2: number;                       // área que cuelga y pide soporte
  supportVolEstMm3: number;                     // soporte estimado (columnas, 15%)
  overhangPct: number;                          // % de área que pide soporte
  clearance: number; holeComp: number;          // recomendados para esta máquina
  minFeatureMm: number;                         // feature mínimo imprimible (~boquilla)
}

interface MeshLike { positions: ArrayLike<number>; indices: ArrayLike<number>; }

/** Clasifica cada triángulo: 0=OK, 1=WARN, 2=SUPPORT. buildZ = +Z.
 *  Excluye la 1ª capa pegada al plato (no es voladizo: la sostiene el lecho). */
export function classifyOverhangs(mesh: MeshLike, p: PrintProfile): { cls: Uint8Array; minZ: number } {
  const pos = mesh.positions, idx = mesh.indices;
  let minZ = Infinity; for (let i = 2; i < pos.length; i += 3) minZ = Math.min(minZ, pos[i]);
  const nTri = idx.length / 3;
  const cls = new Uint8Array(nTri);
  const bedBand = p.layerHeight * 1.5;
  const warn = Math.sin((p.overhangWarnDeg * Math.PI) / 180);   // umbral de −nz
  const err = Math.sin((p.overhangErrDeg * Math.PI) / 180);
  for (let t = 0; t < nTri; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L; void nx; void ny;
    if (nz >= 0) { cls[t] = 0; continue; }                       // mira arriba/lateral → OK
    const maxZ = Math.max(pos[a + 2], pos[b + 2], pos[c + 2]);
    if (maxZ - minZ <= bedBand) { cls[t] = 0; continue; }        // pegado al plato → OK
    const s = -nz;                                                // cuánto "mira abajo" (sin del voladizo)
    cls[t] = s >= err ? 2 : s >= warn ? 1 : 0;
  }
  return { cls, minZ };
}

export function printabilityReport(mesh: MeshLike, p: PrintProfile): PrintabilityReport {
  const pos = mesh.positions, idx = mesh.indices;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    minX = Math.min(minX, pos[i]); maxX = Math.max(maxX, pos[i]);
    minY = Math.min(minY, pos[i + 1]); maxY = Math.max(maxY, pos[i + 1]);
    minZ = Math.min(minZ, pos[i + 2]); maxZ = Math.max(maxZ, pos[i + 2]);
  }
  const w = maxX - minX, d = maxY - minY, h = maxZ - minZ;
  const usableX = p.bedX - 2 * p.margin, usableY = p.bedY - 2 * p.margin;
  // cabe si (w×d) entra en el plato útil en alguna de las 2 orientaciones planas y h ≤ bedZ
  const fits = ((w <= usableX && d <= usableY) || (d <= usableX && w <= usableY)) && h <= p.bedZ;

  const { cls } = classifyOverhangs(mesh, p);
  const nTri = idx.length / 3;
  let triOK = 0, triWarn = 0, triSupport = 0, supportArea = 0, supportVol = 0;
  for (let t = 0; t < nTri; t++) {
    if (cls[t] === 1) triWarn++; else if (cls[t] === 2) triSupport++; else triOK++;
    if (cls[t] === 2) {
      const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      supportArea += area;
      const hTri = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 - minZ;     // altura sobre el plato
      // proyección XY del área × altura × densidad de soporte (~15%)
      const nzAbs = Math.abs((ux * vy - uy * vx)) / (2 * area || 1);
      supportVol += area * nzAbs * hTri * 0.15;
    }
  }
  const sumCls = triWarn + triSupport + triOK;
  return {
    bbox: { w: +w.toFixed(2), d: +d.toFixed(2), h: +h.toFixed(2) },
    fits,
    triTotal: nTri, triOK, triWarn, triSupport,
    supportAreaMm2: +supportArea.toFixed(1),
    supportVolEstMm3: +supportVol.toFixed(1),
    overhangPct: +(100 * triSupport / Math.max(1, sumCls)).toFixed(1),
    clearance: clearance(p), holeComp: holeCompensation(p),
    minFeatureMm: +(p.nozzle).toFixed(2),
  };
}

/** Colores por VÉRTICE para el overlay de voladizos (3 floats/vértice, mismo
 *  orden que positions). Verde OK · ámbar WARN · rojo SUPPORT. */
export function overhangVertexColors(mesh: MeshLike, p: PrintProfile): Float32Array {
  const { cls } = classifyOverhangs(mesh, p);
  const idx = mesh.indices, n = mesh.positions.length / 3;
  const col = new Float32Array(n * 3);
  const C = [[0.24, 0.86, 0.52], [1.0, 0.69, 0.0], [1.0, 0.23, 0.19]]; // OK, WARN, SUPPORT
  for (let t = 0; t < idx.length / 3; t++) {
    const c = C[cls[t]];
    for (let k = 0; k < 3; k++) { const vi = idx[t * 3 + k]; col[vi * 3] = c[0]; col[vi * 3 + 1] = c[1]; col[vi * 3 + 2] = c[2]; }
  }
  return col;
}

/** Perfil de barreno GOTA (teardrop) — círculo con pico a 45° arriba → imprime
 *  sin soporte cuando el eje es horizontal. cx,cy centro; r radio. */
export function teardrop(cx: number, cy: number, r: number, segments = 48): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  // arco inferior (de 225° a −45° pasando por abajo), luego el pico a 45° arriba
  const start = (5 * Math.PI) / 4, end = -Math.PI / 4;          // 225° → −45°
  for (let i = 0; i <= segments; i++) {
    const a = start - ((start - end) * i) / segments;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  pts.push({ x: cx, y: cy + r * Math.SQRT2 });                  // pico (45° de cada lado)
  return pts;
}
