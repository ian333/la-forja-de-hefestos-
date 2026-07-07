/**
 * VISTA ISOMÉTRICA — proyección iso sombreada de una malla del kernel (painter's).
 * ==============================================================================
 * Complementa el HLR de 3 vistas (drawing.ts): toma la triangulación de un sólido
 * (tessellate) y la proyecta desde una esquina (dirección iso), ordena por
 * profundidad y rellena cada cara con un gris = normal·luz. Lámina A3 con cajetín.
 * PURO: node-testeable (SVG string).
 */

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export interface IsoMeta { name?: string; code?: string; material?: string; units?: string }

/** Genera la lámina isométrica (A3) sombreada de la malla. */
export function isoView(
  positions: ArrayLike<number>, indices: ArrayLike<number>, meta: IsoMeta = {},
): string {
  // base de pantalla iso: mirar desde la esquina +X+Y+arriba
  const view = norm([1, 1, 0.85]);                 // dir objeto→ojo
  const right = norm(cross([0, 0, 1], view));      // eje horizontal de pantalla
  const up = norm(cross(view, right));             // eje vertical de pantalla
  const light = norm([0.35, 0.45, 0.82]);

  const nTri = (indices.length / 3) | 0;
  const tris: Array<{ pts: Array<[number, number]>; depth: number; shade: number }> = [];
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let t = 0; t < nTri; t++) {
    const ia = indices[t * 3] * 3, ib = indices[t * 3 + 1] * 3, ic = indices[t * 3 + 2] * 3;
    const A: V3 = [positions[ia], positions[ia + 1], positions[ia + 2]];
    const B: V3 = [positions[ib], positions[ib + 1], positions[ib + 2]];
    const C: V3 = [positions[ic], positions[ic + 1], positions[ic + 2]];
    const n = norm(cross(sub(B, A), sub(C, A)));
    const facing = dot(n, view);
    if (facing <= 0) continue;                     // back-face culling
    const p2 = [A, B, C].map((P) => [dot(P, right), dot(P, up)] as [number, number]);
    for (const [pu, pv] of p2) { u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); }
    const depth = (dot(A, view) + dot(B, view) + dot(C, view)) / 3;
    const shade = 0.32 + 0.62 * Math.max(0, dot(n, light));
    tris.push({ pts: p2, depth, shade });
  }
  tris.sort((a, b) => a.depth - b.depth);          // painter's: lejos primero

  // encuadre en la hoja
  const PW = 420, PH = 297, M = 10;
  const availW = PW - 2 * M - 20, availH = PH - 2 * M - 30;
  const w = u1 - u0 || 1, h = v1 - v0 || 1;
  const s = Math.min(availW / w, availH / h) * 0.9;
  const ox = M + 10 + (availW - w * s) / 2, oy = M + 12 + (availH - h * s) / 2;
  const X = (u: number) => ox + (u - u0) * s;
  const Y = (v: number) => oy + (v1 - v) * s;       // v hacia arriba

  const p: string[] = [];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}" font-family="Arial, sans-serif">`);
  p.push(`<rect width="${PW}" height="${PH}" fill="#fff"/><rect x="${M / 2}" y="${M / 2}" width="${PW - M}" height="${PH - M}" fill="none" stroke="#111" stroke-width="0.7"/>`);
  p.push(`<text x="${M + 4}" y="${M + 8}" font-size="4.4" font-weight="bold">VISTA ISOMÉTRICA</text>`);
  for (const tr of tris) {
    const g = Math.round(tr.shade * 210 + 20);
    const d = `M${tr.pts.map((q) => `${X(q[0]).toFixed(2)},${Y(q[1]).toFixed(2)}`).join('L')}Z`;
    p.push(`<path d="${d}" fill="rgb(${g},${g},${Math.min(255, g + 8)})" stroke="#2a3340" stroke-width="0.12" stroke-linejoin="round"/>`);
  }
  // cajetín mínimo
  const bw = 150, bh = 24, bx = PW - M / 2 - bw, by = PH - M / 2 - bh;
  p.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#fff" stroke="#111" stroke-width="0.5"/>`);
  p.push(`<text x="${bx + 3}" y="${by + 6}" font-size="4" font-weight="bold">${(meta.code ?? '') + ' · ' + (meta.name ?? 'Pieza')}</text>`);
  p.push(`<text x="${bx + 3}" y="${by + 12}" font-size="2.6" fill="#555">ISOMÉTRICO · ${meta.material ?? ''}</text>`);
  p.push(`<text x="${bx + 3}" y="${by + 18}" font-size="2.6" fill="#555">${meta.units ?? 'mm'} · La Forja · GAIA</text>`);
  p.push(`</svg>`);
  return p.join('');
}
