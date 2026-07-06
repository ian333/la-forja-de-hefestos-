/**
 * MOTOR DE PLANOS — sólido 3D (malla + aristas B-Rep) → plano de taller 2D.
 *
 * Genera tres vistas ortográficas (ALZADO, PLANTA, LATERAL) en tercer ángulo,
 * con LÍNEAS VISIBLES (sólidas) y OCULTAS (punteadas) separadas por un cálculo
 * de oclusión REAL (raycast Möller–Trumbore de cada segmento de arista contra
 * la malla, hacia el ojo). Proyección ortográfica EXACTA (las cotas son las
 * dimensiones reales del modelo, independientes de la escala de dibujo). Cotas
 * generales por vista + cajetín. Salida SVG lista para imprimir/exportar.
 *
 * Es PURO (no usa el kernel WASM): recibe posiciones+índices de la malla y las
 * polilíneas 3D de las aristas (EdgeGeom.polyline). Así se testea en node.
 */

type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export interface DrawingInput {
  positions: Float32Array | number[];     // malla: 3·N
  indices: Uint32Array | number[];        // 3 por triángulo
  edges: Array<{ polyline: Array<[number, number, number]>; kind?: string }>;
}
export interface DrawingMeta {
  name?: string; material?: string; massG?: number; date?: string; units?: string;
}
export interface ViewReport {
  key: string; label: string;
  wmm: number; hmm: number;          // tamaño real proyectado (mm)
  nVisible: number; nHidden: number; // nº de segmentos
  visibleLen: number;                // longitud total de líneas visibles (mm)
  circles: Array<{ cu: number; cv: number; dia: number }>; // agujeros/cilindros (Ø real)
}
export interface DrawingResult {
  svg: string;
  views: ViewReport[];
  scale: string;                     // "1:N" o "N:1"
  bbox: { w: number; h: number; d: number }; // X, Z, Y reales del modelo
}

interface ViewDef { key: string; label: string; u: V3; v: V3; eye: V3; }
// Tercer ángulo: ALZADO al centro, PLANTA arriba (comparte X), LATERAL a la
// derecha (comparte Z). u = eje horizontal de pantalla, v = vertical (arriba),
// eye = dirección del objeto hacia el ojo (para la oclusión).
const VIEWS: ViewDef[] = [
  { key: 'front', label: 'ALZADO', u: [1, 0, 0], v: [0, 0, 1], eye: [0, -1, 0] },
  { key: 'top', label: 'PLANTA', u: [1, 0, 0], v: [0, 1, 0], eye: [0, 0, 1] },
  { key: 'right', label: 'LATERAL', u: [0, 1, 0], v: [0, 0, 1], eye: [1, 0, 0] },
];

interface Seg { u1: number; v1: number; u2: number; v2: number; hidden: boolean; }

/** ¿El punto M está OCULTO en esta vista? Raycast desde M hacia el ojo (−nada:
 *  dir = eye) y busca un triángulo que lo tape (t > eps). Möller–Trumbore. */
function occluded(M: V3, eye: V3, pos: ArrayLike<number>, idx: ArrayLike<number>, eps: number): boolean {
  // origen empujado hacia el ojo para no chocar con las caras que comparten la arista
  const o: V3 = [M[0] + eye[0] * eps, M[1] + eye[1] * eps, M[2] + eye[2] * eps];
  const nTri = idx.length / 3;
  for (let t = 0; t < nTri; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
    // p = dir × e2
    const px = eye[1] * e2z - eye[2] * e2y, py = eye[2] * e2x - eye[0] * e2z, pz = eye[0] * e2y - eye[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-9) continue;          // paralelo
    const inv = 1 / det;
    const tx = o[0] - pos[a], ty = o[1] - pos[a + 1], tz = o[2] - pos[a + 2];
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < -1e-6 || u > 1 + 1e-6) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (eye[0] * qx + eye[1] * qy + eye[2] * qz) * inv;
    if (v < -1e-6 || u + v > 1 + 1e-6) continue;
    const tHit = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (tHit > eps) return true;                  // hay una cara delante → oculto
  }
  return false;
}

// ── Detección de círculos (agujeros / cilindros) en una vista ────────
export interface Circle2D { cu: number; cv: number; r: number }

/** Ajuste algebraico de círculo (Kåsa) sobre puntos 2D. Devuelve centro+radio
 *  y el residual RMS (qué tan bien encajan en un círculo). */
function fitCircle(pts: Array<[number, number]>): { cx: number; cy: number; r: number; residual: number } | null {
  const n = pts.length;
  if (n < 6) return null;
  let Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0, Sxz = 0, Syz = 0, Sz = 0;
  for (const [x, y] of pts) {
    const z = x * x + y * y;
    Sx += x; Sy += y; Sxx += x * x; Syy += y * y; Sxy += x * y;
    Sxz += x * z; Syz += y * z; Sz += z;
  }
  // Sistema normal 3×3 para [A=2a, B=2b, C=r²−a²−b²]:
  const sol = solve3([[Sxx, Sxy, Sx], [Sxy, Syy, Sy], [Sx, Sy, n]], [Sxz, Syz, Sz]);
  if (!sol) return null;
  const a = sol[0] / 2, b = sol[1] / 2;
  const r2 = sol[2] + a * a + b * b;
  if (r2 <= 0) return null;
  const r = Math.sqrt(r2);
  let acc = 0;
  for (const [x, y] of pts) { const d = Math.hypot(x - a, y - b) - r; acc += d * d; }
  return { cx: a, cy: b, r, residual: Math.sqrt(acc / n) };
}

function solve3(M: number[][], v: number[]): number[] | null {
  const A = M.map((row, i) => [...row, v[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) return null;
    [A[col], A[piv]] = [A[piv], A[col]];
    const d = A[col][col];
    for (let c = col; c < 4; c++) A[col][c] /= d;
    for (let r = 0; r < 3; r++) { if (r === col) continue; const f = A[r][col]; for (let c = col; c < 4; c++) A[r][c] -= f * A[col][c]; }
  }
  return [A[0][3], A[1][3], A[2][3]];
}

/** Máximo hueco angular entre puntos consecutivos alrededor del centro (rad).
 *  Un círculo COMPLETO (rim de agujero) tiene huecos chicos; un arco/filete no. */
function maxAngularGap(pts: Array<[number, number]>, cx: number, cy: number): number {
  const ang = pts.map(([x, y]) => Math.atan2(y - cy, x - cx)).sort((a, b) => a - b);
  let gap = 0;
  for (let i = 1; i < ang.length; i++) gap = Math.max(gap, ang[i] - ang[i - 1]);
  return Math.max(gap, ang[0] + 2 * Math.PI - ang[ang.length - 1]); // wrap-around
}

/** Detecta círculos COMPLETOS (agujero/cilindro de frente) en una vista,
 *  deduplicando rims concéntricos (arriba/abajo proyectan igual). */
function detectCircles(edges: DrawingInput['edges'], u: V3, v: V3, diag: number): Circle2D[] {
  const found: Circle2D[] = [];
  for (const e of edges) {
    if (e.polyline.length < 6) continue;
    const pts = e.polyline.map((p) => [dot(p, u), dot(p, v)] as [number, number]);
    const fit = fitCircle(pts);
    if (!fit) continue;
    if (fit.r < diag * 0.01) continue;                                 // ruido
    if (fit.residual > fit.r * 0.03) continue;                         // no es círculo
    if (maxAngularGap(pts, fit.cx, fit.cy) > Math.PI * 0.5) continue;  // arco, no círculo completo
    const dup = found.find((c) => Math.hypot(c.cu - fit.cx, c.cv - fit.cy) < diag * 0.02 && Math.abs(c.r - fit.r) < diag * 0.02);
    if (!dup) found.push({ cu: fit.cx, cv: fit.cy, r: fit.r });
  }
  return found;
}

export function generateDrawing(input: DrawingInput, meta: DrawingMeta = {}): DrawingResult {
  const pos = input.positions, idx = input.indices;
  // bbox real del modelo
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    minX = Math.min(minX, pos[i]); maxX = Math.max(maxX, pos[i]);
    minY = Math.min(minY, pos[i + 1]); maxY = Math.max(maxY, pos[i + 1]);
    minZ = Math.min(minZ, pos[i + 2]); maxZ = Math.max(maxZ, pos[i + 2]);
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const eps = diag * 2e-3;

  // proyecta cada vista
  const perView = VIEWS.map((view) => {
    const segs: Seg[] = [];
    let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
    let nVis = 0, nHid = 0, visLen = 0;
    for (const e of input.edges) {
      const pl = e.polyline;
      for (let k = 0; k + 1 < pl.length; k++) {
        const p1 = pl[k], p2 = pl[k + 1];
        const u1 = dot(p1, view.u), v1 = dot(p1, view.v);
        const u2 = dot(p2, view.u), v2 = dot(p2, view.v);
        if (Math.hypot(u2 - u1, v2 - v1) < diag * 1e-4) continue; // degenerado (arista de profundidad)
        const M: V3 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
        const hidden = occluded(M, view.eye, pos, idx, eps);
        segs.push({ u1, v1, u2, v2, hidden });
        if (hidden) nHid++; else { nVis++; visLen += Math.hypot(u2 - u1, v2 - v1); }
        umin = Math.min(umin, u1, u2); umax = Math.max(umax, u1, u2);
        vmin = Math.min(vmin, v1, v2); vmax = Math.max(vmax, v1, v2);
      }
    }
    const circles = detectCircles(input.edges, view.u, view.v, diag);
    return { view, segs, umin, umax, vmin, vmax, nVis, nHid, visLen, circles };
  });

  const front = perView[0], top = perView[1], right = perView[2];
  const gap = diag * 0.5;
  // offsets en "espacio de hoja" (mm, v hacia arriba), 3er ángulo
  const off: Record<string, { du: number; dv: number }> = {
    front: { du: 0, dv: 0 },
    top: { du: 0, dv: (front.vmax + gap) - top.vmin },     // PLANTA arriba, comparte X
    right: { du: (front.umax + gap) - right.umin, dv: 0 }, // LATERAL a la derecha, comparte Z
  };

  // bbox combinada de la hoja
  let sxmin = Infinity, sxmax = -Infinity, symin = Infinity, symax = -Infinity;
  for (const pv of perView) {
    const o = off[pv.view.key];
    sxmin = Math.min(sxmin, pv.umin + o.du); sxmax = Math.max(sxmax, pv.umax + o.du);
    symin = Math.min(symin, pv.vmin + o.dv); symax = Math.max(symax, pv.vmax + o.dv);
  }

  const rendered = renderSVG(perView, off, { sxmin, sxmax, symin, symax },
    { w: maxX - minX, h: maxZ - minZ, d: maxY - minY }, meta);

  return {
    svg: rendered.svg,
    views: perView.map((pv) => ({
      key: pv.view.key, label: pv.view.label,
      wmm: +(pv.umax - pv.umin).toFixed(3), hmm: +(pv.vmax - pv.vmin).toFixed(3),
      nVisible: pv.nVis, nHidden: pv.nHid, visibleLen: +pv.visLen.toFixed(3),
      circles: pv.circles.map((c) => ({ cu: +c.cu.toFixed(3), cv: +c.cv.toFixed(3), dia: +(2 * c.r).toFixed(3) })),
    })),
    scale: rendered.scale,
    bbox: { w: +(maxX - minX).toFixed(3), h: +(maxZ - minZ).toFixed(3), d: +(maxY - minY).toFixed(3) },
  };
}

// ── Render SVG (hoja A-landscape, marco, vistas, cotas generales, cajetín) ──
type PerView = ReturnType<typeof generateDrawing> extends never ? never : {
  view: ViewDef; segs: Seg[]; umin: number; umax: number; vmin: number; vmax: number;
  nVis: number; nHid: number; visLen: number; circles: Circle2D[];
};

function niceScale(s: number): { ratio: number; label: string } {
  // s = unidades de hoja por mm real (máximo que CABE). Elige una escala "bonita"
  // que NO se pase de s: si s≥1 el mayor N:1 ≤ s; si s<1 el menor 1:N que cabe.
  if (s >= 1) {
    const opts = [1, 2, 5, 10, 20, 50, 100];
    let n = 1; for (const x of opts) if (x <= s) n = x;
    return { ratio: n, label: `${n}:1` };
  }
  const inv = 1 / s;
  const n = [1, 2, 2.5, 4, 5, 10, 20, 50, 100, 200, 500].find((x) => x >= inv) ?? Math.ceil(inv);
  return { ratio: 1 / n, label: `1:${n % 1 === 0 ? n : n.toFixed(1)}` };
}

function renderSVG(
  perView: PerView[], off: Record<string, { du: number; dv: number }>,
  sheet: { sxmin: number; sxmax: number; symin: number; symax: number },
  dims: { w: number; h: number; d: number }, meta: DrawingMeta,
): { svg: string; scale: string } {
  const PW = 297, PH = 210, M = 12;                 // hoja A4 apaisada (mm), margen
  const TB_W = 90, TB_H = 32;                        // cajetín
  const drawW = sheet.sxmax - sheet.sxmin || 1, drawH = sheet.symax - sheet.symin || 1;
  // área útil para las vistas (deja sitio para cotas + cajetín)
  const availW = PW - 2 * M - 22, availH = PH - 2 * M - TB_H - 22;
  const sFit = Math.min(availW / drawW, availH / drawH);
  const { ratio, label: scaleLabel } = niceScale(sFit);
  const s = ratio;                                   // mm-hoja por mm-real efectiva
  // centra el dibujo escalado en el área útil
  const ox = M + 14 + (availW - drawW * s) / 2 - sheet.sxmin * s;
  const oy = M + 8 + (availH - drawH * s) / 2;
  // model (u,v arriba) → hoja (x derecha, y abajo): X = ox + u*s ; Y = oy + (symax - v)*s
  const X = (u: number) => ox + u * s;
  const Y = (v: number) => oy + (sheet.symax - v) * s;

  const parts: string[] = [];

  // cota acotada (línea + 2 flechas + texto). Reutilizable por vistas/agujeros.
  const dim = (x1: number, y1: number, x2: number, y2: number, txt: string, horiz: boolean) => {
    const a = 1.4;
    if (horiz) {
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1a5fb4" stroke-width="0.3"/>`);
      parts.push(`<path d="M ${x1} ${y1} l ${a} ${-a / 1.6} l 0 ${a * 1.25} z" fill="#1a5fb4"/>`);
      parts.push(`<path d="M ${x2} ${y2} l ${-a} ${-a / 1.6} l 0 ${a * 1.25} z" fill="#1a5fb4"/>`);
      parts.push(`<text x="${(x1 + x2) / 2}" y="${y1 - 1.2}" font-size="3" fill="#1a5fb4" text-anchor="middle">${txt}</text>`);
    } else {
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1a5fb4" stroke-width="0.3"/>`);
      parts.push(`<path d="M ${x1} ${y1} l ${-a / 1.6} ${a} l ${a * 1.25} 0 z" fill="#1a5fb4"/>`);
      parts.push(`<path d="M ${x2} ${y2} l ${-a / 1.6} ${-a} l ${a * 1.25} 0 z" fill="#1a5fb4"/>`);
      parts.push(`<text x="${x1 - 1.5}" y="${(y1 + y2) / 2}" font-size="3" fill="#1a5fb4" text-anchor="middle" transform="rotate(-90 ${x1 - 1.5} ${(y1 + y2) / 2})">${txt}</text>`);
    }
  };
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}" font-family="Arial, sans-serif">`);
  parts.push(`<rect x="0" y="0" width="${PW}" height="${PH}" fill="#ffffff"/>`);
  // marco
  parts.push(`<rect x="${M / 2}" y="${M / 2}" width="${PW - M}" height="${PH - M}" fill="none" stroke="#111" stroke-width="0.6"/>`);

  // ── vistas ──
  for (const pv of perView) {
    const o = off[pv.view.key];
    const px = (u: number) => X(u + o.du), py = (v: number) => Y(v + o.dv);
    const vis: string[] = [], hid: string[] = [];
    for (const sg of pv.segs) {
      const d = `M ${px(sg.u1).toFixed(2)} ${py(sg.v1).toFixed(2)} L ${px(sg.u2).toFixed(2)} ${py(sg.v2).toFixed(2)}`;
      (sg.hidden ? hid : vis).push(d);
    }
    if (hid.length) parts.push(`<path d="${hid.join(' ')}" fill="none" stroke="#8a8a8a" stroke-width="0.3" stroke-dasharray="1.2 1" data-view="${pv.view.key}" data-line="hidden"/>`);
    if (vis.length) parts.push(`<path d="${vis.join(' ')}" fill="none" stroke="#111" stroke-width="0.55" stroke-linecap="round" data-view="${pv.view.key}" data-line="visible"/>`);
    // agujeros / cilindros vistos de frente: eje en cruz (dash-dot) + cota Ø.
    // La marca de centro localiza el agujero (drafting estándar) y la hoja a 45°
    // saca el Ø real afuera del círculo. Esto faltaba (el barreno iba pelón).
    for (const c of pv.circles) {
      const ccx = px(c.cu), ccy = py(c.cv), rr = c.r * s;
      const ext = rr * 1.25 + 1.6;
      parts.push(`<path d="M ${(ccx - ext).toFixed(2)} ${ccy.toFixed(2)} L ${(ccx + ext).toFixed(2)} ${ccy.toFixed(2)} M ${ccx.toFixed(2)} ${(ccy - ext).toFixed(2)} L ${ccx.toFixed(2)} ${(ccy + ext).toFixed(2)}" fill="none" stroke="#1a5fb4" stroke-width="0.22" stroke-dasharray="2 0.7 0.45 0.7" data-line="center"/>`);
      const dx = Math.SQRT1_2, dy = -Math.SQRT1_2;          // hoja a 45° hacia arriba-derecha
      const ex = ccx + dx * (rr + 6), ey = ccy + dy * (rr + 6);
      parts.push(`<line x1="${(ccx + dx * rr).toFixed(2)}" y1="${(ccy + dy * rr).toFixed(2)}" x2="${ex.toFixed(2)}" y2="${ey.toFixed(2)}" stroke="#1a5fb4" stroke-width="0.3"/>`);
      parts.push(`<text x="${(ex + 0.6).toFixed(2)}" y="${(ey - 0.4).toFixed(2)}" font-size="3" fill="#1a5fb4" data-dim="diameter">⌀${(2 * c.r).toFixed(1)}</text>`);
      // posición AUTO del agujero desde el datum (esquina inf-izq de la vista).
      // Auto-acotar TODO el plano es MEJOR que Fusion (ahí la posición va a mano).
      // Solo con un agujero (varios necesitan reparto inteligente → se omite).
      if (pv.circles.length === 1) {
        const po = 6;
        const yTop = Y(pv.vmax + o.dv) - po;
        dim(X(pv.umin + o.du), yTop, ccx, yTop, (c.cu - pv.umin).toFixed(1), true);
        const xLeft = X(pv.umin + o.du) - po;
        dim(xLeft, Y(pv.vmin + o.dv), xLeft, ccy, (c.cv - pv.vmin).toFixed(1), false);
      }
    }

    // etiqueta de la vista
    const lx = X((pv.umin + pv.umax) / 2 + o.du), ly = Y(pv.vmin + o.dv) + 6;
    parts.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="3.2" fill="#444" text-anchor="middle">${pv.view.label}</text>`);
  }

  // ── cotas generales del ALZADO (ancho abajo, alto a la izquierda) ──
  const fv = perView[0], fo = off['front'];
  const fbX1 = X(fv.umin + fo.du), fbX2 = X(fv.umax + fo.du);
  const fbY = Y(fv.vmin + fo.dv) + 9;
  dim(fbX1, fbY, fbX2, fbY, dims.w.toFixed(1), true);
  const flY1 = Y(fv.vmin + fo.dv), flY2 = Y(fv.vmax + fo.dv);
  const flX = X(fv.umin + fo.du) - 7;
  dim(flX, flY1, flX, flY2, dims.h.toFixed(1), false);

  // ── cajetín ──
  const tbx = PW - M / 2 - TB_W, tby = PH - M / 2 - TB_H;
  parts.push(`<g data-testid="title-block" font-size="2.7" fill="#111">`);
  parts.push(`<rect x="${tbx}" y="${tby}" width="${TB_W}" height="${TB_H}" fill="#fff" stroke="#111" stroke-width="0.5"/>`);
  parts.push(`<line x1="${tbx}" y1="${tby + 11}" x2="${tbx + TB_W}" y2="${tby + 11}" stroke="#111" stroke-width="0.3"/>`);
  parts.push(`<line x1="${tbx}" y1="${tby + 21}" x2="${tbx + TB_W}" y2="${tby + 21}" stroke="#111" stroke-width="0.3"/>`);
  parts.push(`<line x1="${tbx + TB_W * 0.55}" y1="${tby + 11}" x2="${tbx + TB_W * 0.55}" y2="${tby + TB_H}" stroke="#111" stroke-width="0.3"/>`);
  const name = (meta.name ?? 'Pieza').slice(0, 26);
  parts.push(`<text x="${tbx + 3}" y="${tby + 7.5}" font-size="4" font-weight="bold">${esc(name)}</text>`);
  const row = (x: number, y: number, k: string, v: string) =>
    `<text x="${x}" y="${y}" font-size="2.3" fill="#666">${k}</text><text x="${x}" y="${y + 4}" font-weight="bold">${esc(v)}</text>`;
  parts.push(row(tbx + 3, tby + 16, 'MATERIAL', meta.material ?? '—'));
  parts.push(row(tbx + 3, tby + 26, 'MASA', meta.massG != null ? `${meta.massG.toFixed(1)} g` : '—'));
  parts.push(row(tbx + TB_W * 0.55 + 3, tby + 16, 'ESCALA', scaleLabel));
  parts.push(row(tbx + TB_W * 0.55 + 3, tby + 26, 'UNID · 3er áng', meta.units ?? 'mm'));
  parts.push(`<text x="${tbx + TB_W - 2}" y="${tby + 7.5}" font-size="2.6" fill="#b8860b" text-anchor="end">La Forja · GAIA</text>`);
  parts.push(`</g>`);
  parts.push(`</svg>`);
  return { svg: parts.join(''), scale: scaleLabel };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
