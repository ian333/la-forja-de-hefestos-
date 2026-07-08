/**
 * VISTA ISOMÉTRICA LISA + COMPOSITOR DE 4 VISTAS.
 * ==============================================================================
 * El kernel es B-Rep: NO mostrar la malla triangulada. Este módulo proyecta la
 * triangulación (tessellate) en iso con SOMBREADO SUAVE (normales promediadas por
 * vértice, sin líneas de triángulo) y superpone las ARISTAS REALES del B-Rep
 * (enumerateEdgesGeom) con ocultación por raycast → se ve como un sólido liso con
 * aristas nítidas, no una malla. Y `partSheet4View` compone las 3 vistas
 * ortográficas (HLR de drawing.ts) + el iso en UNA lámina A3. PURO.
 */

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** ¿el punto M está oculto mirando hacia `eye` (dir)? Möller–Trumbore. */
function occluded(M: V3, eye: V3, pos: ArrayLike<number>, idx: ArrayLike<number>, eps: number): boolean {
  const o: V3 = [M[0] + eye[0] * eps, M[1] + eye[1] * eps, M[2] + eye[2] * eps];
  const nTri = idx.length / 3;
  for (let t = 0; t < nTri; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
    const px = eye[1] * e2z - eye[2] * e2y, py = eye[2] * e2x - eye[0] * e2z, pz = eye[0] * e2y - eye[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-9) continue;
    const inv = 1 / det;
    const tx = o[0] - pos[a], ty = o[1] - pos[a + 1], tz = o[2] - pos[a + 2];
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < -1e-6 || u > 1 + 1e-6) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (eye[0] * qx + eye[1] * qy + eye[2] * qz) * inv;
    if (v < -1e-6 || u + v > 1 + 1e-6) continue;
    const tHit = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (tHit > eps) return true;
  }
  return false;
}

export interface IsoMeta { name?: string; code?: string; material?: string; units?: string }
export interface Edge3 { polyline: Array<[number, number, number]>; kind?: string }

export interface IsoStyle { color?: [number, number, number]; opacity?: number; edgeColor?: string }

/** Contenido `<g>` del iso LISO (sin marco): superficie sombreada suave + aristas
 *  reales visibles. Encajado en la caja {x,y,w,h}. `style` da COLOR de material y
 *  OPACIDAD (translúcido para ver adentro, como el ghost de SolidWorks). */
export function isoGroup(
  positions: ArrayLike<number>, indices: ArrayLike<number>, normals: ArrayLike<number>,
  edges: Edge3[], box: { x: number; y: number; w: number; h: number }, style: IsoStyle = {},
): string {
  const base = style.color ?? [176, 186, 200];     // gris-acero default
  const op = style.opacity ?? 1;
  const edgeCol = style.edgeColor ?? '#0e1216';
  const view = norm([1, 1, 0.85]);                 // dir objeto→ojo
  const right = norm(cross([0, 0, 1], view));
  const up = norm(cross(view, right));
  const light = norm([0.35, 0.42, 0.84]);
  const eyeDir = view;                              // hacia el ojo (para oclusión)

  // bbox del modelo (para eps de oclusión)
  let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    mnx = Math.min(mnx, positions[i]); mxx = Math.max(mxx, positions[i]);
    mny = Math.min(mny, positions[i + 1]); mxy = Math.max(mxy, positions[i + 1]);
    mnz = Math.min(mnz, positions[i + 2]); mxz = Math.max(mxz, positions[i + 2]);
  }
  const diag = Math.hypot(mxx - mnx, mxy - mny, mxz - mnz) || 1;
  const eps = diag * 2.5e-3;

  const nTri = (indices.length / 3) | 0;
  const tris: Array<{ pu: number[]; pv: number[]; depth: number; shade: number }> = [];
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let t = 0; t < nTri; t++) {
    const ia = indices[t * 3], ib = indices[t * 3 + 1], ic = indices[t * 3 + 2];
    const A: V3 = [positions[ia * 3], positions[ia * 3 + 1], positions[ia * 3 + 2]];
    const B: V3 = [positions[ib * 3], positions[ib * 3 + 1], positions[ib * 3 + 2]];
    const C: V3 = [positions[ic * 3], positions[ic * 3 + 1], positions[ic * 3 + 2]];
    const fn = norm(cross(sub(B, A), sub(C, A)));
    if (dot(fn, view) <= 0) continue;              // back-face cull
    // SOMBREADO SUAVE: normal promediada de los 3 vértices (nada de facetas duras)
    const na: V3 = normals && normals.length ? norm([
      normals[ia * 3] + normals[ib * 3] + normals[ic * 3],
      normals[ia * 3 + 1] + normals[ib * 3 + 1] + normals[ic * 3 + 1],
      normals[ia * 3 + 2] + normals[ib * 3 + 2] + normals[ic * 3 + 2],
    ]) : fn;
    const pu = [dot(A, right), dot(B, right), dot(C, right)];
    const pv = [dot(A, up), dot(B, up), dot(C, up)];
    for (let i = 0; i < 3; i++) { u0 = Math.min(u0, pu[i]); u1 = Math.max(u1, pu[i]); v0 = Math.min(v0, pv[i]); v1 = Math.max(v1, pv[i]); }
    tris.push({ pu, pv, depth: (dot(A, view) + dot(B, view) + dot(C, view)) / 3, shade: 0.42 + 0.55 * Math.max(0, dot(na, light)) });
  }
  tris.sort((a, b) => a.depth - b.depth);          // painter's

  const w = u1 - u0 || 1, h = v1 - v0 || 1;
  const s = Math.min(box.w / w, box.h / h) * 0.86;
  const ox = box.x + (box.w - w * s) / 2, oy = box.y + (box.h - h * s) / 2;
  const X = (u: number) => ox + (u - u0) * s;
  const Y = (v: number) => oy + (v1 - v) * s;

  // SUPERFICIE sombreada — grupo con `opacity` de GRUPO (funde fill Y stroke a la
  // vez): así el cuerpo translúcido es VIDRIO UNIFORME, sin la telaraña de aristas
  // de triángulo que deja `fill-opacity` (que NO afecta al trazo). El hairline
  // del mismo color sella las costuras entre triángulos (nada de malla).
  const p: string[] = [];
  p.push(`<g${op < 1 ? ` opacity="${op}"` : ''}>`);
  for (const tr of tris) {
    const sh = 0.28 + tr.shade * 0.85;             // realza el rango tonal sobre el color base
    const r = Math.min(255, Math.round(base[0] * sh)), g = Math.min(255, Math.round(base[1] * sh)), b = Math.min(255, Math.round(base[2] * sh));
    const col = `rgb(${r},${g},${b})`;
    p.push(`<path d="M${X(tr.pu[0]).toFixed(2)},${Y(tr.pv[0]).toFixed(2)}L${X(tr.pu[1]).toFixed(2)},${Y(tr.pv[1]).toFixed(2)}L${X(tr.pu[2]).toFixed(2)},${Y(tr.pv[2]).toFixed(2)}Z" fill="${col}" stroke="${col}" stroke-width="0.25" stroke-linejoin="round"/>`);
  }
  p.push('</g>');
  // ARISTAS REALES del B-Rep en su PROPIO grupo, SIEMPRE opacas y nítidas (aunque
  // el cuerpo sea translúcido). Cuerpo opaco → solo visibles (oclusión). Cuerpo
  // translúcido → todas (el alambre interior se lee a través del vidrio = ghost).
  p.push('<g>');
  for (const e of edges ?? []) {
    const pl = e.polyline;
    for (let k = 0; k + 1 < pl.length; k++) {
      const p1 = pl[k], p2 = pl[k + 1];
      const M: V3 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
      const occ = occluded(M, eyeDir, positions, indices, eps);
      if (op >= 1 && occ) continue;                 // opaco: HLR (oculta las de atrás)
      const hidden = occ;                            // translúcido: internas más tenues (se leen por el vidrio)
      p.push(`<line x1="${X(dot(p1, right)).toFixed(2)}" y1="${Y(dot(p1, up)).toFixed(2)}" x2="${X(dot(p2, right)).toFixed(2)}" y2="${Y(dot(p2, up)).toFixed(2)}" stroke="${edgeCol}" stroke-width="${hidden ? 0.22 : 0.34}" stroke-linecap="round" stroke-opacity="${hidden ? 0.45 : 1}"/>`);
    }
  }
  p.push('</g>');
  return p.join('');
}

const A3 = { W: 420, H: 297, M: 10 };
function sheetFrame(title: string, sub: string): string[] {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${A3.W}mm" height="${A3.H}mm" viewBox="0 0 ${A3.W} ${A3.H}" font-family="Arial, sans-serif">`,
    `<rect width="${A3.W}" height="${A3.H}" fill="#fff"/><rect x="${A3.M / 2}" y="${A3.M / 2}" width="${A3.W - A3.M}" height="${A3.H - A3.M}" fill="none" stroke="#111" stroke-width="0.7"/>`,
    `<text x="${A3.M + 4}" y="${A3.M + 8}" font-size="4.4" font-weight="bold">${title}</text>`,
    `<text x="${A3.M + 4}" y="${A3.M + 14}" font-size="2.8" fill="#555">${sub}</text>`,
  ];
}

/** Lámina A3 SOLO isométrico (liso). */
export function isoView(positions: ArrayLike<number>, indices: ArrayLike<number>, normals: ArrayLike<number>, edges: Edge3[], meta: IsoMeta = {}, style: IsoStyle = {}): string {
  const p = sheetFrame('VISTA ISOMÉTRICA', `${meta.code ?? ''} · ${meta.name ?? 'Pieza'} · ${meta.material ?? ''}`);
  p.push(isoGroup(positions, indices, normals, edges, { x: A3.M + 10, y: A3.M + 18, w: A3.W - 2 * A3.M - 20, h: A3.H - 2 * A3.M - 30 }, style));
  p.push('</svg>');
  return p.join('');
}

const escSvg = (s: string) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/** Compone las 3 vistas ortográficas (SVG de generateDrawing, A4) + el ISO en UNA
 *  lámina A3 (4 vistas). `threeSvg` se anida escalado a la izquierda; el iso a la
 *  derecha-arriba. `style` da color/opacidad al isométrico (material real).
 *  `legend` = despiece de barrenos (para que cada uno tenga PROPÓSITO). */
export function partSheet4View(threeSvg: string, iso: { positions: ArrayLike<number>; indices: ArrayLike<number>; normals: ArrayLike<number>; edges: Edge3[] }, meta: IsoMeta = {}, style: IsoStyle = {}, legend: string[] = []): string {
  const p = sheetFrame(`PIEZA · ${meta.name ?? ''}`, `4 vistas (3er ángulo + isométrico) · ${meta.material ?? ''} · ${meta.units ?? 'mm'} · La Forja · GAIA`);
  // 3 vistas ortográficas (A4 297×210) anidadas a la IZQUIERDA
  const nested = threeSvg.replace(/^<svg /, `<svg x="${A3.M + 2}" y="${A3.M + 20}" width="248" height="${A3.H - 2 * A3.M - 26}" preserveAspectRatio="xMidYMid meet" `);
  p.push(nested);
  // ISOMÉTRICO a la DERECHA (sombreado con color de material)
  p.push(`<line x1="256" y1="${A3.M + 20}" x2="256" y2="${A3.H - A3.M - 6}" stroke="#ccc" stroke-width="0.3"/>`);
  p.push(`<text x="335" y="${A3.M + 26}" font-size="3.4" fill="#444" text-anchor="middle">ISOMÉTRICO${style.opacity != null && style.opacity < 1 ? ' · translúcido' : ''}</text>`);
  const isoH = (A3.H - 2 * A3.M - 40) - (legend.length ? legend.length * 4.2 + 16 : 0);
  p.push(isoGroup(iso.positions, iso.indices, iso.normals, iso.edges, { x: 262, y: A3.M + 30, w: 150, h: isoH }, style));
  // DESPIECE DE BARRENOS (leyenda de propósito) bajo el iso
  if (legend.length) {
    const ly = A3.M + 30 + isoH + 4, boxH = legend.length * 4.2 + 8.5;
    p.push(`<rect x="262" y="${ly}" width="150" height="${boxH.toFixed(1)}" fill="#f6f8fb" stroke="#9aa7bb" stroke-width="0.3" rx="1.5"/>`);
    p.push(`<text x="266" y="${ly + 5.5}" font-size="3.1" font-weight="bold" fill="#2a3746">DESPIECE DE BARRENOS · propósito</text>`);
    legend.forEach((l, i) => p.push(`<text x="267" y="${ly + 10.5 + i * 4.2}" font-size="2.75" fill="#3a4a56">· ${escSvg(l)}</text>`));
  }
  p.push('</svg>');
  return p.join('');
}
