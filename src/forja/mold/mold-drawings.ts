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
  /** rótulo JUNTO al barreno en la planta (p. ej. el id del pin en la retenedora, §11.2.6) */
  tag?: string;
  /** POSICIÓN de un componente que se APOYA en la cara y NO se barrena (p. ej. un pilar de soporte sobre la sujeción
   *  inferior, orden J): se dibuja punteado y la tabla dice «apoyo» en PROF — que nadie lo taladre por error. */
  apoyo?: boolean;
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
/** CIRCUITO de enfriamiento (serpentín) barrenado en una placa: ejes de canal en
 *  planta, puertos IN/OUT, plugs de sellado, y la profundidad detrás de la cavidad. */
export interface CoolingCircuit {
  diaMm: number; zBehindMm: number; note: string;
  /** línea del lado A medida desde la partición: dep + H (Eq 9.22 mide H desde la
   *  SUPERFICIE MOLDEANTE — la impresión sube dep sobre la partición). undefined =
   *  no cabe línea recta sin perforar la impresión (usar baffles §9.2.4). */
  zAboveMm?: number;
  /** advertencia del lado A (H_eff < 2D, o línea imposible). */
  aWarn?: string;
  segs: Array<{ x0: number; y0: number; x1: number; y1: number }>;
  ports: Array<{ x: number; y: number; label: string }>;
  plugs: Array<{ x: number; y: number }>;
  /** el proceso §9.2 que PRODUJO este trazo (t_c, Q̇, V̇, H, W, n_lines, fallas) */
  design?: import('./cooling-design').CoolingDesignOut;
  /** reglas del libro que el trazo NO alcanzó (paso, nº de líneas, controlador).
   *  Vacío = el circuito cumple §9.2 entero. NUNCA se calla un incumplimiento. */
  avisos?: string[];
}
export interface PlateSpec {
  code: string; name: string; material?: string;
  wmm: number; dmm: number; thickMm: number;
  holes: PlateHole[]; sideHoles?: SideHole[]; openings?: PlateOpening[]; cooling?: CoolingCircuit;
  /** el término inglés de ISO 12165 de esta placa (va al título suplementario del cajetín) */
  en?: string;
  cajetin?: DatosCajetin;
}
/** LO QUE EL CAJETÍN SABE DE AFUERA (ISO 7200, orden K): lo que no se sabe NO se llena — va su línea vacía. */
export interface DatosCajetin {
  /** propietario legal del documento (ISO 7200 §5.1.2, obligatorio): la planta que lo libera. Sin dato, la línea vacía. */
  propietario?: string;
  /** el día en que La Forja GENERÓ la lámina (AAAA-MM-DD). NO es la fecha de emisión (§5.1.5: la del día en que se
   *  libera oficialmente): esa la escribe quien aprueba. */
  generado?: string;
  /** la pieza que moldea (va al título suplementario, §5.2.3) */
  pieza?: string;
}
export interface PlateDrawing { svg: string; rows: string[][]; nHoles: number; scale: string }

export interface SectionRect { x0: number; z0: number; x1: number; z1: number }
export interface StackComp {
  id: number; name: string; qty: number; material?: string;
  rects: SectionRect[];                 // perfil de la sección (plano medio y=0)
  solid?: boolean;                      // pieza de plástico: relleno sólido, sin achurar
  tint?: string;                        // relleno de color (p.ej. corredera) en vez de achurado
  circles?: Array<{ x: number; z: number; dia: number; note?: string }>; // p.ej. líneas de agua cortadas
  lines?: Array<{ x0: number; z0: number; x1: number; z1: number; widthMm?: number; note?: string }>; // p.ej. perno inclinado (angle pin)
  /** EL RENGLÓN DE LA BOM CON NOMBRE ISO (orden K): denominación en español del término de ISO 12165 (+ medida), el término
   *  inglés y la norma del componente («tipo ISO nnnn»). Sin él, la BOM usa `name` como siempre. */
  bom?: { es: string; en?: string; norma?: string };
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

/** ancho aproximado de un texto Arial (mm), por clase de carácter: mayúscula 0.68, espacio/puntuación 0.3, lo demás
 *  0.53 del tamaño (+7 % en negrita). MEDIDO en la corrida B (2026-10-30): con un promedio plano de 0.57 el encabezado
 *  «MATERIAL · NORMA» (todo mayúsculas) se salía 0.6 mm de su columna. Solo para ENCOGER un texto que no cabe en su
 *  celda; el juez fino (getBBox) lo corre el arnés en el navegador. */
const anchoArial = (t: string, fs: number, bold = false) => {
  let w = 0;
  for (const ch of t) w += /[A-ZÁÉÍÓÚÑ⌀Ø]/.test(ch) ? 0.68 : /[\s.,:;·'|()[\]/-]/.test(ch) ? 0.3 : 0.53;
  return w * fs * (bold ? 1.07 : 1);
};
/** el tamaño de letra (≤ fs, ≥ min) con el que `t` cabe en `w` mm */
const cabeEn = (t: string, w: number, fs: number, bold = false, min = 1.5) => Math.max(min, Math.min(fs, w / Math.max(1e-6, anchoArial(t, 1, bold))));

/** Marca de «hoja sin numerar»: el cajetín no sabe cuántas láminas trae el juego; quien arma el juego final las numera
 *  con `numerarHojas` (las 4 vistas se intercalan después, en mold-plano-set.ts). */
const HOJA_SIN_NUMERAR = 'data-hoja="sin-numerar">—<';
/** ISO 7200 §5.1.6 + §5.1.7 (hoja y número de hojas): numera el juego TERMINADO, en su orden. Las láminas sin cajetín
 *  (4 vistas, hoja de análisis) cuentan en el total aunque no lleven el número escrito. */
export function numerarHojas<T extends { svg: string }>(pages: T[]): T[] {
  const N = pages.length;
  return pages.map((p, i) => (p.svg.includes(HOJA_SIN_NUMERAR) ? { ...p, svg: p.svg.replace(HOJA_SIN_NUMERAR, `data-hoja="${i + 1}/${N}">${i + 1} / ${N}<`) } : p));
}

/**
 * CAJETÍN SEGÚN ISO 7200:2004 (orden K · EL MOLDE EN STEP Y CON NOMBRE ISO, 2026-10-30).
 * Los campos y su obligación salen de las Tablas 1–3 de la norma (leídas en su adopción idéntica IS 11665:2009, pública):
 *   OBLIGATORIOS (M): propietario legal §5.1.2 · número de identificación §5.1.3 (≤ 16 caracteres) · fecha de emisión §5.1.5 ·
 *   hoja §5.1.6 · título §5.2.2 (25/30 caracteres) · aprobó §5.3.4 · elaboró §5.3.5 · tipo de documento §5.3.6.
 *   OPCIONALES (O) que se usan: revisión §5.1.4 · número de hojas §5.1.7 · idioma §5.1.8 · título suplementario §5.2.3 ·
 *   formato §5.3.11. Escala, símbolo de proyección y tolerancia general NO son campos de ISO 7200 («se presentan fuera del
 *   cajetín, solo cuando se usan», §4): van en una franja propia, rotulada, sobre la rejilla de la norma.
 * SIN INVENTAR VALORES: el propietario, la fecha de EMISIÓN (el día en que se libera, no el día en que se generó), la
 * revisión y las tres firmas van con su línea vacía; «generado por La Forja (software) el AAAA-MM-DD» se dice aparte,
 * chico, porque ELABORÓ es una persona (§5.3.5: «the person who has prepared the document»).
 * LOS APAGONES (2026-10-24) siguen: sin «ISO 2768-mK», sin «Ra 0.8», sin «DIBUJÓ: La Forja CAD»; la tolerancia general la
 * fija el fabricante del molde. Ancho 166 mm (la norma muestra 180 en su §6 para A4: aquí la sección del ensamble llega a
 * x = 246.5 en la carcasa 246 y un cajetín de 180 se le montaba encima).
 */
function titleBlock(parts: string[], code: string, name: string, material: string, scale: string,
  o: { tipo: string; en?: string; datos?: DatosCajetin }) {
  const W = 166, H = 40, x = PW - MARGIN / 2 - W, y = PH - MARGIN / 2 - H;
  const d = o.datos ?? {};
  parts.push(`<g data-testid="title-block" data-norma="ISO 7200:2004" font-size="2.6" fill="#111">`);
  parts.push(`<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="#fff" stroke="#111" stroke-width="0.5"/>`);
  const hl = (yy: number, x0 = x, x1 = x + W) => parts.push(`<line x1="${x0}" y1="${(y + yy).toFixed(2)}" x2="${x1}" y2="${(y + yy).toFixed(2)}" stroke="#111" stroke-width="0.3"/>`);
  const vl = (xx: number, y0: number, y1: number) => parts.push(`<line x1="${(x + xx).toFixed(2)}" y1="${(y + y0).toFixed(2)}" x2="${(x + xx).toFixed(2)}" y2="${(y + y1).toFixed(2)}" stroke="#111" stroke-width="0.3"/>`);
  // celda: rótulo chico arriba (en español, con la cláusula de la norma) y el valor; sin valor, la LÍNEA para escribirlo
  const cell = (x0: number, x1: number, y0: number, y1: number, campo: string, rotulo: string, valor: string | null, o2: { fs?: number; bold?: boolean; abajo?: string } = {}) => {
    const w = x1 - x0 - 2.4, fs = o2.fs ?? 2.5, bold = o2.bold ?? true;
    parts.push(`<g data-iso7200="${campo}">`);
    parts.push(`<text x="${(x + x0 + 1.2).toFixed(2)}" y="${(y + y0 + 2.5).toFixed(2)}" font-size="${cabeEn(rotulo, w, 1.8, false, 1.3).toFixed(2)}" fill="#555">${esc(rotulo)}</text>`);
    if (valor != null && valor !== '') {
      const f = cabeEn(valor, w, fs, bold);
      parts.push(`<text x="${(x + x0 + 1.2).toFixed(2)}" y="${(y + y0 + 2.5 + Math.max(2.6, f + 0.6)).toFixed(2)}" font-size="${f.toFixed(2)}"${bold ? ' font-weight="bold"' : ''}${campo === 'hoja' ? ` ${HOJA_SIN_NUMERAR.split('>')[0]}` : ''}>${esc(valor)}</text>`);
    } else {
      parts.push(`<line x1="${(x + x0 + 1.4).toFixed(2)}" y1="${(y + y1 - (o2.abajo ? 3.2 : 1.6)).toFixed(2)}" x2="${(x + x1 - 1.4).toFixed(2)}" y2="${(y + y1 - (o2.abajo ? 3.2 : 1.6)).toFixed(2)}" stroke="#888" stroke-width="0.2" data-vacio="1"/>`);
    }
    if (o2.abajo) parts.push(`<text x="${(x + x0 + 1.2).toFixed(2)}" y="${(y + y1 - 0.9).toFixed(2)}" font-size="${cabeEn(o2.abajo, w, 1.7, false, 1.2).toFixed(2)}" fill="#666">${esc(o2.abajo)}</text>`);
    parts.push(`</g>`);
  };
  // ── fila 1 (0–9): propietario legal · tipo de documento
  hl(9); vl(100, 0, 9);
  cell(0, 100, 0, 9, 'propietario', 'PROPIETARIO LEGAL (ISO 7200 §5.1.2)', d.propietario ?? null);
  cell(100, W, 0, 9, 'tipo', 'TIPO DE DOCUMENTO (§5.3.6)', o.tipo, { fs: 2.3 });
  // ── fila 2 (9–20): título + suplementario · nº de identificación · revisión · hoja
  hl(20); vl(100, 9, 20); vl(132, 9, 20); vl(146, 9, 20);
  const supl = [o.en, d.pieza].filter(Boolean).join(' · ');
  parts.push(`<g data-iso7200="titulo">`);
  parts.push(`<text x="${(x + 1.2).toFixed(2)}" y="${(y + 11.3).toFixed(2)}" font-size="1.8" fill="#555">TÍTULO (§5.2.2) · TÍTULO SUPLEMENTARIO (§5.2.3)</text>`);
  parts.push(`<text x="${(x + 1.2).toFixed(2)}" y="${(y + 15.4).toFixed(2)}" font-size="${cabeEn(name, 97.6, 3.4, true).toFixed(2)}" font-weight="bold">${esc(name)}</text>`);
  if (supl) parts.push(`<text x="${(x + 1.2).toFixed(2)}" y="${(y + 18.8).toFixed(2)}" font-size="${cabeEn(supl, 97.6, 2.1, false, 1.2).toFixed(2)}" fill="#333">${esc(supl)}</text>`);
  parts.push(`</g>`);
  cell(100, 132, 9, 20, 'identificacion', 'Nº DE IDENTIFICACIÓN §5.1.3', code, { fs: 3.0 });
  cell(132, 146, 9, 20, 'revision', 'REV. §5.1.4', null);
  cell(146, W, 9, 20, 'hoja', 'HOJA (§5.1.6-7)', '—', { fs: 2.8 });
  // ── fila 3 (20–30): fuera de la norma (rotulado): material · escala + proyección · unidades · tolerancia · fecha de emisión
  hl(30); vl(36, 20, 30); vl(72, 20, 30); vl(86, 20, 30); vl(126, 20, 30);
  cell(0, 36, 20, 30, 'material', 'MATERIAL', material.slice(0, 26));
  cell(36, 72, 20, 30, 'escala', 'ESCALA · PROYECCIÓN 3er ÁNG.', scale);
  cell(72, 86, 20, 30, 'unidades', 'UNIDADES', 'mm');
  cell(86, 126, 20, 30, 'tolerancia', 'TOLERANCIA GENERAL', 'la fija el fabricante del molde', { fs: 2.0, bold: false });
  cell(126, W, 20, 30, 'fecha', 'FECHA DE EMISIÓN (§5.1.5)', null, { abajo: d.generado ? `generado el ${d.generado}` : undefined });
  // símbolo de PROYECCIÓN DE TERCER ÁNGULO (tronco + vista circular) junto a la escala — el símbolo ES la indicación
  const sx = x + 36 + 18, sy = y + 26.2;
  parts.push(`<g stroke="#111" stroke-width="0.3" fill="none" data-testid="projection-symbol">`);
  parts.push(`<circle cx="${sx + 3}" cy="${sy}" r="2.4"/><circle cx="${sx + 3}" cy="${sy}" r="1.05"/>`);
  parts.push(`<path d="M ${sx + 7.5} ${sy - 2.4} L ${sx + 13.5} ${sy - 1.3} L ${sx + 13.5} ${sy + 1.3} L ${sx + 7.5} ${sy + 2.4} z"/>`);
  parts.push(`</g>`);
  // ── fila 4 (30–40): elaboró · revisó · aprobó · idioma y formato
  vl(42, 30, H); vl(84, 30, H); vl(126, 30, H);
  cell(0, 42, 30, H, 'elaboro', 'ELABORÓ (§5.3.5)', null, { abajo: 'generado por La Forja (software)' });
  cell(42, 84, 30, H, 'reviso', 'REVISÓ', null);
  cell(84, 126, 30, H, 'aprobo', 'APROBÓ (§5.3.4)', null);
  cell(126, W, 30, H, 'idioma', 'IDIOMA · FORMATO (§5.1.8 · §5.3.11)', 'es · A3', { fs: 2.4 });
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

  // ── CIRCUITO DE ENFRIAMIENTO (serpentín): canales barrenados (línea de agua),
  //    plugs de sellado y puertos IN/OUT. Azul, oculto (dash-dot) porque va DENTRO
  //    de la placa detrás de la cavidad. Es lo que el taller barrena para el agua.
  if (p.cooling) {
    const cc = p.cooling;
    for (const g of cc.segs)
      parts.push(`<line x1="${X(g.x0)}" y1="${Y(g.y0)}" x2="${X(g.x1)}" y2="${Y(g.y1)}" stroke="#1a7fd4" stroke-width="0.5" stroke-dasharray="4 1.3 0.8 1.3" data-cooling="1"/>`);
    for (const pl of cc.plugs)
      parts.push(`<rect x="${X(pl.x) - 1.2}" y="${Y(pl.y) - 1.2}" width="2.4" height="2.4" fill="#1a7fd4" data-plug="1"/>`);
    for (const pt of cc.ports) {
      parts.push(`<circle cx="${X(pt.x)}" cy="${Y(pt.y)}" r="2" fill="#fff" stroke="#0a7a3a" stroke-width="0.7"/>`);
      parts.push(`<text x="${X(pt.x)}" y="${Y(pt.y) - 3}" font-size="3" fill="#0a7a3a" font-weight="bold" text-anchor="middle">${esc(pt.label)}</text>`);
    }
    parts.push(`<text x="${X(0)}" y="${Y(p.dmm) - 1}" font-size="2.7" fill="#1a7fd4">${esc(cc.note)}</text>`);
  }

  // barrenos: cruz de centro + círculo + número
  const rows: string[][] = [];
  const rotulados = new Set<string>();     // un rótulo por UBICACIÓN (pasaje y contrataladro comparten eje)
  const enEje = new Map<string, number>(); // cuántos barrenos van ya en este eje (concéntricos)
  p.holes.forEach((h, i) => {
    const n = i + 1, cx = X(h.x), cy = Y(h.y), r = (h.dia / 2) * s;
    // el número de un barreno CONCÉNTRICO con otro (asiento + contrataladro) sube un renglón: en la misma línea los dos
    // números se montaban (medido, orden J: «5»/«6» en la placa A, «11»/«12» en la retenedora)
    const eje = `${h.x.toFixed(2)},${h.y.toFixed(2)}`, kEje = enEje.get(eje) ?? 0; enEje.set(eje, kEje + 1);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#111" stroke-width="0.45"${h.apoyo ? ' stroke-dasharray="2.2 1.2" data-apoyo="1"' : ''} data-hole="${n}"/>`);
    const e = r + 1.8;
    parts.push(`<path d="M ${cx - e} ${cy} L ${cx + e} ${cy} M ${cx} ${cy - e} L ${cx} ${cy + e}" stroke="#1a5fb4" stroke-width="0.22" stroke-dasharray="2 0.7 0.45 0.7"/>`);
    parts.push(`<text x="${cx + e + 0.8}" y="${cy - 0.8 - kEje * 3.4}" font-size="2.9" fill="#b8860b" font-weight="bold" data-holeid="${n}">${n}</text>`);
    // el rótulo de la UBICACIÓN (§11.2.6: "label each ejector pin and matching location on the ejector retainer plate")
    const ubic = `${h.x.toFixed(2)},${h.y.toFixed(2)}`;
    if (h.tag && !rotulados.has(ubic)) {
      rotulados.add(ubic);
      parts.push(`<text x="${cx + e + 0.8}" y="${cy + 2.6}" font-size="2.2" fill="#8a2be2" data-holetag="${esc(h.tag)}">${esc(h.tag)}</text>`);
    }
    // el id VA PRIMERO en la tabla: la columna TIPO se corta al borde de la hoja y el id es lo que el ajustador busca
    rows.push([String(n), h.x.toFixed(2), h.y.toFixed(2), `⌀${h.dia}`, h.apoyo ? 'apoyo' : h.depth ? h.depth.toFixed(1) : 'PASANTE', (h.tag ? `${h.tag} · ` : '') + h.type + (h.note ? ` · ${h.note}` : '')]);
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
  // en el LATERAL: los canales de agua aparecen como círculos a su PROFUNDIDAD
  if (p.cooling) {
    const zc = Math.max(4, Math.min(p.thickMm - 4, p.thickMm - p.cooling.zBehindMm));
    const lxc = sideX + zc * s;
    for (const g of p.cooling.segs) if (g.y0 === g.y1)   // canal recto (en X) → círculo en el lateral
      parts.push(`<circle cx="${lxc}" cy="${Y(g.y0)}" r="${Math.max(0.6, (p.cooling.diaMm / 2) * s)}" fill="none" stroke="#1a7fd4" stroke-width="0.4"/>`);
    parts.push(`<text x="${lxc}" y="${Y(p.dmm) + 3.5}" font-size="2.4" fill="#1a7fd4" text-anchor="middle">agua ⌀${p.cooling.diaMm}</text>`);
  }
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

  titleBlock(parts, p.code, p.name, p.material ?? 'Acero P20', scaleLabel, { tipo: 'Plano de taller de placa', en: p.en, datos: p.cajetin });
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
  meta: { code: string; name: string; extra?: string; extraBom?: string[][]; notes?: string[]; sectionLabel?: string; partings?: Array<{ z: number; label: string }>; en?: string; cajetin?: DatosCajetin },
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
  const ox = MARGIN + 52, oyTop = MARGIN + 18;   // margen izq amplio: cota de altura + balones no se salen del A3
  const X = (x: number) => ox + (x - x0) * s;
  const Y = (z: number) => oyTop + (z1 - z) * s;

  const bom: string[][] = [];
  comps.forEach((c, ci) => {
    for (const r of c.rects) {
      const rx = X(r.x0), ry = Y(r.z1), rw = (r.x1 - r.x0) * s, rh = (r.z1 - r.z0) * s;
      if (c.solid) {
        parts.push(`<rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" fill="#c9531f" stroke="#7a2f0e" stroke-width="0.35" data-comp="${c.id}"/>`);
      } else if (c.tint) {
        parts.push(`<rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" fill="${c.tint}" stroke="#111" stroke-width="0.5" data-comp="${c.id}"/>`);
        hatchRect(parts, { x: rx, y: ry, w: rw, h: rh }, ci % 2 === 1, 3.2);
      } else {
        parts.push(`<rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" height="${rh.toFixed(2)}" fill="none" stroke="#111" stroke-width="0.5" data-comp="${c.id}"/>`);
        hatchRect(parts, { x: rx, y: ry, w: rw, h: rh }, ci % 2 === 1);
      }
    }
    // pernos inclinados / mecanismos (angle pin): trazo grueso a ⌀ real
    for (const ln of c.lines ?? []) {
      parts.push(`<line x1="${X(ln.x0).toFixed(2)}" y1="${Y(ln.z0).toFixed(2)}" x2="${X(ln.x1).toFixed(2)}" y2="${Y(ln.z1).toFixed(2)}" stroke="#3a4656" stroke-width="${Math.max(0.6, (ln.widthMm ?? 3) * s).toFixed(2)}" stroke-linecap="round" data-comp-line="${c.id}"/>`);
      if (ln.note) parts.push(`<text x="${(X((ln.x0 + ln.x1) / 2) + 2).toFixed(1)}" y="${(Y((ln.z0 + ln.z1) / 2)).toFixed(1)}" font-size="2.4" fill="#3a4656">${esc(ln.note)}</text>`);
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
    const bx = (side < 0 ? X(x0) - 14 : X(x1) + 14) + (ci % 3) * 5 * side;
    const by = gy0;
    parts.push(`<line x1="${gx0.toFixed(1)}" y1="${gy0.toFixed(1)}" x2="${bx}" y2="${by}" stroke="#b8860b" stroke-width="0.25"/>`);
    parts.push(`<circle cx="${bx}" cy="${by}" r="3.4" fill="#fff" stroke="#b8860b" stroke-width="0.5" data-balloon="${c.id}"/>`);
    parts.push(`<text x="${bx}" y="${by + 1.1}" font-size="3.4" font-weight="bold" fill="#b8860b" text-anchor="middle">${c.id}</text>`);
    // [Nº, denominación, cant, material, término inglés, norma] — los dos últimos solo si el componente trae su nombre ISO
    bom.push(c.bom ? [String(c.id), c.bom.es, String(c.qty), c.material ?? '—', c.bom.en ?? '', c.bom.norma ?? ''] : [String(c.id), c.name, String(c.qty), c.material ?? '—']);
  });

  // líneas de partición (2 placas: una; 3 placas: A-B y A-X)
  const partings = meta.partings ?? (() => {
    const zP = comps.find((c) => c.name.toLowerCase().includes('cavidad'))?.rects.reduce((m, r) => Math.max(m, r.z1), -Infinity);
    return zP != null && Number.isFinite(zP) ? [{ z: zP, label: 'LÍNEA DE PARTICIÓN' }] : [];
  })();
  for (const pt of partings) {
    parts.push(`<line x1="${X(x0) - 8}" y1="${Y(pt.z)}" x2="${X(x1) + 8}" y2="${Y(pt.z)}" stroke="#c01c28" stroke-width="0.3" stroke-dasharray="4 1.4 1 1.4" data-parting="1"/>`);
    // etiqueta a la DERECHA de la sección (a la izquierda se salía de la hoja A3)
    parts.push(`<text x="${X(x1) + 10}" y="${Y(pt.z) - 1.5}" font-size="2.6" fill="#c01c28" text-anchor="start">${esc(pt.label)}</text>`);
  }

  // cotas generales
  dimLine(parts, X(x0), Y(z0) + 9, X(x1), Y(z0) + 9, (x1 - x0).toFixed(1), true);
  dimLine(parts, X(x0) - 7, Y(z0), X(x0) - 7, Y(z1), (z1 - z0).toFixed(1), false);
  parts.push(`<text x="${X((x0 + x1) / 2)}" y="${oyTop - 6}" font-size="3.6" fill="#444" text-anchor="middle">${esc(meta.sectionLabel ?? 'SECCIÓN A-A · plano medio')}</text>`);

  // ── BOM ──
  // CON NOMBRE ISO (orden K, 2026-10-30): el renglón de un componente con nombre de la norma lleva DOS líneas — arriba la
  // denominación en español (+ medida), abajo, chico, el término inglés de ISO 12165 y en la columna de material la norma
  // del componente («tipo ISO nnnn»). Los renglones sin nombre ISO (los ids de los botadores, 11.1…) quedan de una línea.
  // Todo se ENCOGE para caber: la tabla, sus notas y el cajetín comparten la columna derecha de la A3 (de y 24 a y 252).
  const tX = 298, tY = MARGIN + 14, colW = [9, 69, 9, 25];
  const tW = colW.reduce((a, b) => a + b, 0);
  // filas extra (piezas fuera del plano de corte: pilares, tornillería — viven
  // en los planos de placa pero DEBEN estar en la BOM del ensamble)
  for (const r of meta.extraBom ?? []) bom.push(r);
  // (orden K) el renglón hijo «11.3» va DEBAJO de su padre 11 y antes del 12 — antes los ids de los botadores quedaban
  // al final, después del bebedero: orden por (padre, hijo)
  const clave = (id: string) => id.split('.').map((x) => (Number.isFinite(+x) ? +x : 0));
  bom.sort((a, b) => { const p = clave(a[0]), q = clave(b[0]); return (p[0] - q[0]) || ((p[1] ?? -1) - (q[1] ?? -1)); });
  const dos = (r: string[]) => !!(r[4] || r[5]);
  const notas = meta.notes ?? [];
  const yMax = PH - MARGIN / 2 - 40 - 2;                          // el cajetín empieza en PH − 5 − 40
  let k = 1.0;                                                    // factor de encogimiento (1 → 0.8)
  const alto = (f: number) => 5.6 * f + bom.reduce((a, r) => a + (dos(r) ? 7.0 : 4.6) * f, 0) + 6 + notas.length * 4.2 * f;
  while (tY + alto(k) > yMax && k > 0.8) k = +(k - 0.02).toFixed(2);
  const headH = 5.6 * k;
  parts.push(`<g font-size="2.7" data-testid="bom-table">`);
  parts.push(`<text x="${tX}" y="${tY - 3}" font-size="3.4" font-weight="bold">LISTA DE MATERIALES (BOM)</text>`);
  parts.push(`<rect x="${tX}" y="${tY}" width="${tW}" height="${headH.toFixed(2)}" fill="#eef2f7" stroke="#111" stroke-width="0.3"/>`);
  const header = ['Nº', 'DENOMINACIÓN · ISO 12165', 'CANT', 'MATERIAL · NORMA'];
  { let cx = tX; header.forEach((h, c) => { parts.push(`<text x="${cx + 1.2}" y="${(tY + 3.9 * k).toFixed(2)}" font-size="${cabeEn(h, colW[c] - 2, 2.5 * k, true).toFixed(2)}" font-weight="bold">${esc(h)}</text>`); cx += colW[c]; }); }
  let y = tY + headH;
  for (const r of bom) {
    const h = (dos(r) ? 7.0 : 4.6) * k;
    parts.push(`<rect x="${tX}" y="${y.toFixed(2)}" width="${tW}" height="${h.toFixed(2)}" fill="none" stroke="#999" stroke-width="0.2"/>`);
    let cx = tX;
    for (let c = 0; c < 4; c++) {
      const v = r[c] ?? '', fs = cabeEn(v, colW[c] - 2.4, (dos(r) ? 2.6 : 2.4) * k);
      parts.push(`<text x="${(cx + 1.2).toFixed(2)}" y="${(y + (dos(r) ? 3.1 : 3.3) * k).toFixed(2)}" font-size="${fs.toFixed(2)}"${dos(r) && c === 1 ? ' font-weight="bold"' : ''}>${esc(v)}</text>`);
      cx += colW[c];
    }
    if (dos(r)) {
      if (r[4]) parts.push(`<text x="${(tX + colW[0] + 1.2).toFixed(2)}" y="${(y + 6.0 * k).toFixed(2)}" font-size="${cabeEn(`(${r[4]})`, colW[1] - 2.4, 1.9 * k, false, 1.2).toFixed(2)}" fill="#444" data-iso12165="1">(${esc(r[4])})</text>`);
      if (r[5]) parts.push(`<text x="${(tX + colW[0] + colW[1] + colW[2] + 1.2).toFixed(2)}" y="${(y + 6.0 * k).toFixed(2)}" font-size="${cabeEn(r[5], colW[3] - 2.4, 1.9 * k, false, 1.2).toFixed(2)}" fill="#1a5fb4" data-norma="1">${esc(r[5])}</text>`);
    }
    y += h;
  }
  parts.push(`</g>`);
  notas.forEach((n, i) => {
    parts.push(`<text x="${tX}" y="${(y + 6 + i * 4.2 * k).toFixed(2)}" font-size="${cabeEn(`· ${n}`, tW + 4, 2.6 * k, false, 1.5).toFixed(2)}" fill="#333" data-note="1">· ${esc(n)}</text>`);
  });

  titleBlock(parts, meta.code, meta.name, 'VER BOM', scaleLabel, { tipo: 'Plano de ensamble con lista de materiales', en: meta.en ?? meta.extra, datos: meta.cajetin });
  parts.push(`</svg>`);
  return { svg: parts.join(''), bom, nComps: comps.length, scale: scaleLabel };
}
