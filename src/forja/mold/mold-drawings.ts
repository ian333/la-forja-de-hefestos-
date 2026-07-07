/**
 * PLANOS DE MOLDE — paquete de TALLER (Kazmer pieza 1 del checklist 2026-07-06).
 * =============================================================================
 * Lo que un taller necesita para FABRICAR el molde:
 *  · Plano de PLACA: planta con cruces de centro + números de barreno, TABLA DE
 *    BARRENOS (ID, X, Y, ⌀, PROF, TIPO — coordenadas desde el datum esq. inf-izq),
 *    barrenos LATERALES (líneas de agua) en el alzado, cotas generales, cajetín.
 *  · Plano de ENSAMBLE en SECCIÓN: el stack completo cortado por el plano medio,
 *    ACHURADO alternado por componente (convención de taller), GLOBOS numerados
 *    con líneas líder y BOM (ID, DENOMINACIÓN, CANT, MATERIAL/NORMA).
 * Los barrenos vienen del REGISTRO del generador del molde (datos honestos), no
 * de detección sobre el B-Rep. PURO: node-testeable, salida SVG (hoja A3H).
 */

// ── tipos ────────────────────────────────────────────────────────────
export interface PlateHole {
  x: number; y: number;                 // desde el datum (esquina inferior-izquierda de la planta)
  dia: number; depth?: number;          // sin depth = PASANTE
  type: string;                         // 'eyector' | 'pilar' | 'tornillo M10' | 'sprue' | …
  note?: string;
}
export interface SideHole {
  face: 'izq' | 'der' | 'frente' | 'atras';
  z: number;                            // altura sobre la base de la placa
  at: number;                           // posición a lo largo de la cara, desde el datum
  dia: number; depth?: number; type: string;
}
export interface PlateOpening {
  kind: 'circle' | 'rect'; x: number; y: number;
  dia?: number; w?: number; d?: number; note?: string;
}
export interface PlateSpec {
  code: string; name: string; material?: string;
  wmm: number; dmm: number; thickMm: number;
  holes: PlateHole[]; sideHoles?: SideHole[]; openings?: PlateOpening[];
}
export interface PlateDrawing { svg: string; rows: string[][]; nHoles: number; scale: string }

export interface SectionRect { x0: number; z0: number; x1: number; z1: number }
export interface StackComp {
  id: number; name: string; qty: number; material?: string;
  rects: SectionRect[];                 // perfil de la sección (plano medio y=0)
  solid?: boolean;                      // pieza de plástico: relleno sólido, sin achurar
  circles?: Array<{ x: number; z: number; dia: number; note?: string }>; // p.ej. líneas de agua cortadas
}
export interface AssemblyDrawing { svg: string; bom: string[][]; nComps: number; scale: string }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// hoja A3 apaisada
const PW = 420, PH = 297, MARGIN = 10;

function sheetOpen(parts: string[]) {
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}" font-family="Arial, sans-serif">`);
  parts.push(`<rect width="${PW}" height="${PH}" fill="#fff"/>`);
  parts.push(`<rect x="${MARGIN / 2}" y="${MARGIN / 2}" width="${PW - MARGIN}" height="${PH - MARGIN}" fill="none" stroke="#111" stroke-width="0.7"/>`);
}

function titleBlock(parts: string[], code: string, name: string, material: string, scale: string, extra?: string) {
  // Cajetín según ISO 7200 (campos: propietario, nº de documento, título, fechas,
  // responsable, hoja) + tolerancia general ISO 2768-mK + proyección 3er ángulo.
  const W = 150, H = 40, x = PW - MARGIN / 2 - W, y = PH - MARGIN / 2 - H;
  parts.push(`<g data-testid="title-block" font-size="2.6" fill="#111">`);
  parts.push(`<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="#fff" stroke="#111" stroke-width="0.5"/>`);
  // fila superior: código + título + marca
  parts.push(`<line x1="${x}" y1="${y + 12}" x2="${x + W}" y2="${y + 12}" stroke="#111" stroke-width="0.3"/>`);
  parts.push(`<text x="${x + 3}" y="${y + 5.4}" font-size="4.2" font-weight="bold">${esc(code)} · ${esc(name).slice(0, 32)}</text>`);
  parts.push(`<text x="${x + 3}" y="${y + 9.8}" font-size="2.4" fill="#666">${esc(extra ?? 'MOLDE DE INYECCIÓN')}</text>`);
  parts.push(`<text x="${x + W - 2.5}" y="${y + 5.4}" font-size="2.8" fill="#b8860b" text-anchor="end">La Forja · GAIA</text>`);
  // rejilla ISO 7200: material | tolerancias | escala/proyección | firmas
  const c1 = x + W * 0.34, c2 = x + W * 0.62, c3 = x + W * 0.82;
  parts.push(`<line x1="${c1}" y1="${y + 12}" x2="${c1}" y2="${y + H}" stroke="#111" stroke-width="0.3"/>`);
  parts.push(`<line x1="${c2}" y1="${y + 12}" x2="${c2}" y2="${y + H}" stroke="#111" stroke-width="0.3"/>`);
  parts.push(`<line x1="${c3}" y1="${y + 12}" x2="${c3}" y2="${y + H}" stroke="#111" stroke-width="0.3"/>`);
  parts.push(`<line x1="${x}" y1="${y + 26}" x2="${c2}" y2="${y + 26}" stroke="#111" stroke-width="0.25"/>`);
  const cell = (cx: number, cy: number, k: string, v: string, vs = 2.9) =>
    parts.push(`<text x="${cx}" y="${cy}" font-size="2.1" fill="#666">${esc(k)}</text><text x="${cx}" y="${cy + 4.4}" font-size="${vs}" font-weight="bold">${esc(v)}</text>`);
  cell(x + 3, y + 16.5, 'MATERIAL', material.slice(0, 22));
  cell(x + 3, y + 30.5, 'ACABADO', 'Ra 0.8 cavidad · Ra 3.2 resto');
  cell(c1 + 3, y + 16.5, 'TOLERANCIA GENERAL', 'ISO 2768-mK');
  cell(c1 + 3, y + 30.5, 'BARRENOS', 'H7 · roscas 6H');
  cell(c2 + 3, y + 16.5, 'ESCALA', scale);
  cell(c2 + 3, y + 30.5, 'UNIDADES', 'mm');
  cell(c3 + 3, y + 16.5, 'DIBUJÓ', 'La Forja CAD');
  cell(c3 + 3, y + 30.5, 'HOJA', '1/1 · A3');
  // símbolo de PROYECCIÓN DE TERCER ÁNGULO (ISO 128: tronco + vista circular),
  // junto al valor de escala (el símbolo ES la indicación normativa)
  const sx = c2 + 15, sy = y + 19.3;
  parts.push(`<g stroke="#111" stroke-width="0.3" fill="none" data-testid="projection-symbol">`);
  parts.push(`<circle cx="${sx + 3}" cy="${sy}" r="2.4"/><circle cx="${sx + 3}" cy="${sy}" r="1.05"/>`);
  parts.push(`<path d="M ${sx + 7.5} ${sy - 2.4} L ${sx + 13.5} ${sy - 1.3} L ${sx + 13.5} ${sy + 1.3} L ${sx + 7.5} ${sy + 2.4} z"/>`);
  parts.push(`</g>`);
  parts.push(`</g>`);
}

// cota lineal con flechas
function dimLine(parts: string[], x1: number, y1: number, x2: number, y2: number, txt: string, horiz: boolean) {
  const a = 1.5;
  parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1a5fb4" stroke-width="0.3"/>`);
  if (horiz) {
    parts.push(`<path d="M ${x1} ${y1} l ${a} ${-a / 1.6} l 0 ${a * 1.25} z" fill="#1a5fb4"/>`);
    parts.push(`<path d="M ${x2} ${y2} l ${-a} ${-a / 1.6} l 0 ${a * 1.25} z" fill="#1a5fb4"/>`);
    parts.push(`<text x="${(x1 + x2) / 2}" y="${y1 - 1.4}" font-size="3.2" fill="#1a5fb4" text-anchor="middle">${esc(txt)}</text>`);
  } else {
    parts.push(`<path d="M ${x1} ${y1} l ${-a / 1.6} ${a} l ${a * 1.25} 0 z" fill="#1a5fb4"/>`);
    parts.push(`<path d="M ${x2} ${y2} l ${-a / 1.6} ${-a} l ${a * 1.25} 0 z" fill="#1a5fb4"/>`);
    parts.push(`<text x="${x1 - 1.6}" y="${(y1 + y2) / 2}" font-size="3.2" fill="#1a5fb4" text-anchor="middle" transform="rotate(-90 ${x1 - 1.6} ${(y1 + y2) / 2})">${esc(txt)}</text>`);
  }
}

// ── PLANO DE PLACA ───────────────────────────────────────────────────
export function renderPlateDrawing(p: PlateSpec): PlateDrawing {
  const parts: string[] = [];
  sheetOpen(parts);

  // área de la planta (izquierda) — escala bonita que quepa
  const availW = 250, availH = PH - 2 * MARGIN - 60;
  // la hoja debe caber: PLANTA + hueco + LATERAL (espesor) SIN invadir la tabla
  const sFit = Math.min(availW / (p.wmm + p.thickMm + 26), availH / p.dmm);
  const sOpts = [0.25, 0.4, 0.5, 0.75, 1, 1.5, 2];
  let s = sOpts[0];
  for (const o of sOpts) if (o <= sFit) s = o;
  const scaleLabel = s >= 1 ? `${s}:1` : `1:${+(1 / s).toFixed(1)}`;
  const ox = MARGIN + 18, oyTop = MARGIN + 16;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oyTop + (p.dmm - y) * s;         // y del datum hacia ARRIBA

  // contorno de la placa
  parts.push(`<rect x="${X(0)}" y="${Y(p.dmm)}" width="${p.wmm * s}" height="${p.dmm * s}" fill="none" stroke="#111" stroke-width="0.6" data-part="plate-outline"/>`);

  // aberturas (cavidad / hueco del boss)
  for (const o of p.openings ?? []) {
    if (o.kind === 'circle' && o.dia) {
      parts.push(`<circle cx="${X(o.x)}" cy="${Y(o.y)}" r="${(o.dia / 2) * s}" fill="none" stroke="#111" stroke-width="0.55" data-part="opening"/>`);
      parts.push(`<text x="${X(o.x)}" y="${Y(o.y) - (o.dia / 2) * s - 1.5}" font-size="3" fill="#111" text-anchor="middle">⌀${o.dia}${o.note ? ` ${esc(o.note)}` : ''}</text>`);
    } else if (o.kind === 'rect' && o.w && o.d) {
      parts.push(`<rect x="${X(o.x - o.w / 2)}" y="${Y(o.y + o.d / 2)}" width="${o.w * s}" height="${o.d * s}" fill="none" stroke="#111" stroke-width="0.55" data-part="opening"/>`);
    }
  }

  // barrenos: cruz de centro + círculo + número
  const rows: string[][] = [];
  p.holes.forEach((h, i) => {
    const n = i + 1, cx = X(h.x), cy = Y(h.y), r = (h.dia / 2) * s;
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#111" stroke-width="0.45" data-hole="${n}"/>`);
    const e = r + 1.8;
    parts.push(`<path d="M ${cx - e} ${cy} L ${cx + e} ${cy} M ${cx} ${cy - e} L ${cx} ${cy + e}" stroke="#1a5fb4" stroke-width="0.22" stroke-dasharray="2 0.7 0.45 0.7"/>`);
    parts.push(`<text x="${cx + e + 0.8}" y="${cy - 0.8}" font-size="2.9" fill="#b8860b" font-weight="bold" data-holeid="${n}">${n}</text>`);
    rows.push([String(n), h.x.toFixed(2), h.y.toFixed(2), `⌀${h.dia}`, h.depth ? h.depth.toFixed(1) : 'PASANTE', h.type + (h.note ? ` · ${h.note}` : '')]);
  });

  // cotas generales de la planta
  dimLine(parts, X(0), Y(0) + 8, X(p.wmm), Y(0) + 8, p.wmm.toFixed(1), true);
  dimLine(parts, X(0) - 8, Y(0), X(0) - 8, Y(p.dmm), p.dmm.toFixed(1), false);
  parts.push(`<text x="${X(p.wmm / 2)}" y="${Y(p.dmm) - 5}" font-size="3.4" fill="#444" text-anchor="middle">PLANTA · datum esq. inf-izq · espesor ${p.thickMm} mm</text>`);

  // barrenos LATERALES (agua): en la PLANTA se ven como línea dash-dot a lo
  // largo del eje del taladro; en el LATERAL, una línea por altura z (dedupe).
  for (const sh of p.sideHoles ?? []) {
    if (sh.face === 'frente' || sh.face === 'atras') {
      parts.push(`<line x1="${X(sh.at)}" y1="${Y(0)}" x2="${X(sh.at)}" y2="${Y(p.dmm)}" stroke="#1a5fb4" stroke-width="0.28" stroke-dasharray="3 1 0.6 1" data-sidehole="1"/>`);
      parts.push(`<text x="${X(sh.at) + 1}" y="${Y(p.dmm) + 4}" font-size="2.5" fill="#1a5fb4">⌀${sh.dia} ${esc(sh.type)} z=${sh.z}</text>`);
    } else {
      parts.push(`<line x1="${X(0)}" y1="${Y(sh.at)}" x2="${X(p.wmm)}" y2="${Y(sh.at)}" stroke="#1a5fb4" stroke-width="0.28" stroke-dasharray="3 1 0.6 1" data-sidehole="1"/>`);
      parts.push(`<text x="${X(p.wmm) + 1.2}" y="${Y(sh.at) + 1}" font-size="2.5" fill="#1a5fb4">⌀${sh.dia} ${esc(sh.type)} z=${sh.z}</text>`);
    }
  }
  // alzado LATERAL (espesor × fondo) a la derecha de la planta
  const sideW = p.thickMm * s, sideX = X(p.wmm) + 14;
  parts.push(`<rect x="${sideX}" y="${Y(p.dmm)}" width="${sideW}" height="${p.dmm * s}" fill="none" stroke="#111" stroke-width="0.55"/>`);
  parts.push(`<text x="${sideX + sideW / 2}" y="${Y(p.dmm) - 5}" font-size="3.2" fill="#444" text-anchor="middle">LATERAL</text>`);
  const zSeen = new Set<number>();
  for (const sh of p.sideHoles ?? []) {
    if (zSeen.has(sh.z)) continue;
    zSeen.add(sh.z);
    const lx = sideX + sh.z * s;                       // eje horizontal del lateral = espesor
    parts.push(`<line x1="${lx}" y1="${Y(p.dmm)}" x2="${lx}" y2="${Y(0)}" stroke="#1a5fb4" stroke-width="0.28" stroke-dasharray="2 1" data-sidehole-lat="1"/>`);
    parts.push(`<text x="${lx}" y="${Y(0) + 4}" font-size="2.5" fill="#1a5fb4" text-anchor="middle">z=${sh.z}</text>`);
  }

  // ── TABLA DE BARRENOS (derecha) ──
  const tX = 288, tY = MARGIN + 14, colW = [9, 18, 18, 14, 20, 44];
  const tW = colW.reduce((a, b) => a + b, 0);
  const rowH = 5.4;
  parts.push(`<g font-size="2.7" data-testid="hole-table">`);
  parts.push(`<text x="${tX}" y="${tY - 3}" font-size="3.4" font-weight="bold">TABLA DE BARRENOS</text>`);
  const header = ['Nº', 'X', 'Y', '⌀', 'PROF', 'TIPO'];
  const drawRow = (vals: string[], y: number, bold = false) => {
    let cx = tX;
    vals.forEach((v, c) => {
      parts.push(`<text x="${cx + 1.2}" y="${y + 3.8}" ${bold ? 'font-weight="bold"' : ''}>${esc(v)}</text>`);
      cx += colW[c];
    });
  };
  parts.push(`<rect x="${tX}" y="${tY}" width="${tW}" height="${rowH}" fill="#eef2f7" stroke="#111" stroke-width="0.3"/>`);
  drawRow(header, tY, true);
  rows.forEach((r, i) => {
    const y = tY + rowH * (i + 1);
    parts.push(`<rect x="${tX}" y="${y}" width="${tW}" height="${rowH}" fill="none" stroke="#999" stroke-width="0.2"/>`);
    drawRow(r, y);
  });
  parts.push(`</g>`);

  titleBlock(parts, p.code, p.name, p.material ?? 'Acero P20', scaleLabel);
  parts.push(`</svg>`);
  return { svg: parts.join(''), rows, nHoles: p.holes.length, scale: scaleLabel };
}

// ── PLANO DE ENSAMBLE EN SECCIÓN ─────────────────────────────────────
/** Achurado 45° recortado a un rectángulo; sentido alterna por componente. */
function hatchRect(parts: string[], r: { x: number; y: number; w: number; h: number }, flip: boolean, pitch = 2.6) {
  const lines: string[] = [];
  const d = r.w + r.h;
  for (let t = pitch / 2; t < d; t += pitch) {
    // línea a 45°: x + y = t (o x - y = t - h si flip) recortada al rect
    let x1: number, y1: number, x2: number, y2: number;
    if (!flip) {
      x1 = Math.max(0, t - r.h); y1 = Math.min(r.h, t);
      x2 = Math.min(r.w, t); y2 = Math.max(0, t - r.w);
    } else {
      x1 = Math.max(0, t - r.h); y1 = r.h - Math.min(r.h, t);
      x2 = Math.min(r.w, t); y2 = r.h - Math.max(0, t - r.w);
    }
    lines.push(`M ${(r.x + x1).toFixed(2)} ${(r.y + y1).toFixed(2)} L ${(r.x + x2).toFixed(2)} ${(r.y + y2).toFixed(2)}`);
  }
  if (lines.length) parts.push(`<path d="${lines.join(' ')}" stroke="#666" stroke-width="0.18" fill="none" data-hatch="1"/>`);
}

export function renderAssemblySection(
  comps: StackComp[],
  meta: { code: string; name: string; extra?: string; extraBom?: string[][]; notes?: string[]; sectionLabel?: string; partings?: Array<{ z: number; label: string }> },
): AssemblyDrawing {
  const parts: string[] = [];
  sheetOpen(parts);

  // bbox de la sección
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const c of comps) for (const r of c.rects) {
    x0 = Math.min(x0, r.x0); x1 = Math.max(x1, r.x1);
    z0 = Math.min(z0, r.z0); z1 = Math.max(z1, r.z1);
  }
  const availW = 250, availH = PH - 2 * MARGIN - 46;
  const sFit = Math.min(availW / (x1 - x0), availH / (z1 - z0));
  const sOpts = [0.25, 0.4, 0.5, 0.6, 0.75, 1, 1.5, 2];
  let s = sOpts[0];
  for (const o of sOpts) if (o <= sFit) s = o;
  const scaleLabel = s >= 1 ? `${s}:1` : `1:${+(1 / s).toFixed(1)}`;
  const ox = MARGIN + 30, oyTop = MARGIN + 18;
  const X = (x: number) => ox + (x - x0) * s;
  const Y = (z: number) => oyTop + (z1 - z) * s;

  const bom: string[][] = [];
  comps.forEach((c, ci) => {
    for (const r of c.rects) {
      const rx = X(r.x0), ry = Y(r.z1), rw = (r.x1 - r.x0) * s, rh = (r.z1 - r.z0) * s;
      if (c.solid) {
        parts.push(`<rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" fill="#c9531f" stroke="#7a2f0e" stroke-width="0.35" data-comp="${c.id}"/>`);
      } else {
        parts.push(`<rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" fill="none" stroke="#111" stroke-width="0.5" data-comp="${c.id}"/>`);
        hatchRect(parts, { x: rx, y: ry, w: rw, h: rh }, ci % 2 === 1);
      }
    }
    for (const circ of c.circles ?? []) {
      parts.push(`<circle cx="${X(circ.x)}" cy="${Y(circ.z)}" r="${(circ.dia / 2) * s}" fill="#fff" stroke="#1a5fb4" stroke-width="0.4" data-comp-circle="${c.id}"/>`);
      if (circ.note) parts.push(`<text x="${X(circ.x) + circ.dia * s * 0.6 + 1}" y="${Y(circ.z) + 1}" font-size="2.4" fill="#1a5fb4">${esc(circ.note)}</text>`);
    }
    // globo con líder al centro del primer rect (o del primer círculo si no hay rects)
    const r0 = c.rects[0];
    const c0 = c.circles?.[0];
    const gx0 = r0 ? X((r0.x0 + r0.x1) / 2) : X(c0 ? c0.x : (x0 + x1) / 2);
    const gy0 = r0 ? Y((r0.z0 + r0.z1) / 2) : Y(c0 ? c0.z : (z0 + z1) / 2);
    const side = comps.length === 1 ? 1 : (gx0 < X((x0 + x1) / 2) ? -1 : 1);
    const bx = (side < 0 ? X(x0) - 16 : X(x1) + 16) + (ci % 3) * 7 * side;
    const by = gy0;
    parts.push(`<line x1="${gx0.toFixed(1)}" y1="${gy0.toFixed(1)}" x2="${bx}" y2="${by}" stroke="#b8860b" stroke-width="0.25"/>`);
    parts.push(`<circle cx="${bx}" cy="${by}" r="3.4" fill="#fff" stroke="#b8860b" stroke-width="0.5" data-balloon="${c.id}"/>`);
    parts.push(`<text x="${bx}" y="${by + 1.1}" font-size="3.4" font-weight="bold" fill="#b8860b" text-anchor="middle">${c.id}</text>`);
    bom.push([String(c.id), c.name, String(c.qty), c.material ?? '—']);
  });

  // líneas de partición (2 placas: una; 3 placas: A-B y A-X)
  const partings = meta.partings ?? (() => {
    const zP = comps.find((c) => c.name.toLowerCase().includes('cavidad'))?.rects.reduce((m, r) => Math.max(m, r.z1), -Infinity);
    return zP != null && Number.isFinite(zP) ? [{ z: zP, label: 'LÍNEA DE PARTICIÓN' }] : [];
  })();
  for (const pt of partings) {
    parts.push(`<line x1="${X(x0) - 8}" y1="${Y(pt.z)}" x2="${X(x1) + 8}" y2="${Y(pt.z)}" stroke="#c01c28" stroke-width="0.3" stroke-dasharray="4 1.4 1 1.4" data-parting="1"/>`);
    parts.push(`<text x="${X(x0) - 10}" y="${Y(pt.z) + 1}" font-size="2.8" fill="#c01c28" text-anchor="end">${esc(pt.label)}</text>`);
  }

  // cotas generales
  dimLine(parts, X(x0), Y(z0) + 9, X(x1), Y(z0) + 9, (x1 - x0).toFixed(1), true);
  dimLine(parts, X(x0) - 10, Y(z0), X(x0) - 10, Y(z1), (z1 - z0).toFixed(1), false);
  parts.push(`<text x="${X((x0 + x1) / 2)}" y="${oyTop - 6}" font-size="3.6" fill="#444" text-anchor="middle">${esc(meta.sectionLabel ?? 'SECCIÓN A-A · plano medio')}</text>`);

  // ── BOM ──
  const tX = 300, tY = MARGIN + 14, colW = [10, 52, 12, 34];
  const tW = colW.reduce((a, b) => a + b, 0), rowH = 5.6;
  parts.push(`<g font-size="2.7" data-testid="bom-table">`);
  parts.push(`<text x="${tX}" y="${tY - 3}" font-size="3.4" font-weight="bold">LISTA DE MATERIALES (BOM)</text>`);
  const header = ['Nº', 'DENOMINACIÓN', 'CANT', 'MATERIAL/NORMA'];
  const drawRow = (vals: string[], y: number, bold = false) => {
    let cx = tX;
    vals.forEach((v, c) => { parts.push(`<text x="${cx + 1.2}" y="${y + 3.9}" ${bold ? 'font-weight="bold"' : ''}>${esc(v)}</text>`); cx += colW[c]; });
  };
  parts.push(`<rect x="${tX}" y="${tY}" width="${tW}" height="${rowH}" fill="#eef2f7" stroke="#111" stroke-width="0.3"/>`);
  drawRow(header, tY, true);
  // filas extra (piezas fuera del plano de corte: pilares, tornillería — viven
  // en los planos de placa pero DEBEN estar en la BOM del ensamble)
  for (const r of meta.extraBom ?? []) bom.push(r);
  bom.forEach((r, i) => {
    const y = tY + rowH * (i + 1);
    parts.push(`<rect x="${tX}" y="${y}" width="${tW}" height="${rowH}" fill="none" stroke="#999" stroke-width="0.2"/>`);
    drawRow(r, y);
  });
  parts.push(`</g>`);
  (meta.notes ?? []).forEach((n, i) => {
    parts.push(`<text x="${tX}" y="${tY + rowH * (bom.length + 1) + 9 + i * 4.6}" font-size="2.9" fill="#333" data-note="1">· ${esc(n)}</text>`);
  });

  titleBlock(parts, meta.code, meta.name, 'VER BOM', scaleLabel, meta.extra);
  parts.push(`</svg>`);
  return { svg: parts.join(''), bom, nComps: comps.length, scale: scaleLabel };
}
