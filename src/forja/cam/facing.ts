/**
 * CAM · CAREADO (Face milling) — el primer motor CAM de La Forja.
 *
 * Reproduce el flujo del libro "Making Your CAM Journey Easier with Fusion 360"
 * (Cimo, Packt 2023) cap 9: Tool (⌀, rpm, avance) → Geometry (cara superior del
 * stock) → Passes (stepover, extensión de pasada, dirección) → trayectoria →
 * post-proceso → G-code. Motor PURO (sin UI, sin OCCT): testeable en node.
 *
 * Trayectoria: zigzag (ida-vuelta) sobre la cara superior del stock, con la
 * fresa extendida `passExtension` más allá del borde (el libro: "el corte debe
 * extenderse más allá del stock si no estás seguro de sus dimensiones").
 * Stepover = paso radial entre pasadas (el libro lo pide en mm; típico ≤ ⌀·0.9).
 */

export interface FacingStock {
  x0: number; y0: number; x1: number; y1: number; // planta del stock (mm)
  zTop: number;                                    // cara superior a carear
}

export interface FacingTool {
  diameter: number; // ⌀ de la fresa (mm)
  rpm: number;      // velocidad del husillo (S)
  feed: number;     // avance de corte (mm/min, F)
  plunge: number;   // avance de entrada en Z (mm/min)
}

export interface FacingParams {
  stepover: number;      // paso entre pasadas (mm)
  passExtension: number; // extensión más allá del stock por lado (mm)
  depth: number;         // material a remover de la cara (mm)
  safeZ: number;         // altura segura de traslado (mm sobre zTop)
}

export interface ToolpathSegment {
  kind: 'rapid' | 'cut' | 'plunge';
  from: [number, number, number];
  to: [number, number, number];
  /** Arco en el plano XY (G2 si cw, G3 si no); centro absoluto. Sin arc = línea. */
  arc?: { cx: number; cy: number; cw: boolean };
}

/** Barrido angular de un arco (rad, siempre >0) respetando su sentido. */
export function arcSweep(s: ToolpathSegment): number {
  if (!s.arc) return 0;
  const a0 = Math.atan2(s.from[1] - s.arc.cy, s.from[0] - s.arc.cx);
  const a1 = Math.atan2(s.to[1] - s.arc.cy, s.to[0] - s.arc.cx);
  let sw = s.arc.cw ? a0 - a1 : a1 - a0;
  while (sw <= 1e-9) sw += 2 * Math.PI;
  return sw;
}

/** Zigzag de careado: pasadas en X (ida-vuelta), avanzando en Y por stepover. */
export function generateFacingToolpath(
  stock: FacingStock, tool: FacingTool, p: FacingParams,
): ToolpathSegment[] {
  const segs: ToolpathSegment[] = [];
  const r = tool.diameter / 2;
  const xA = stock.x0 - p.passExtension - r;   // arranque extendido (fresa LIBRA el borde)
  const xB = stock.x1 + p.passExtension + r;
  // La primera y última pasada cubren los bordes: el CENTRO de la fresa recorre
  // de y0−(r−stepover)… simplificación robusta: centros desde y0−r+stepover/…
  // Cobertura garantizada: centros en [y0 − r + stepover, y1 + r] con paso stepover,
  // arrancando en y0 − r + stepover·0 … usamos y0 − r + stepover como 1ª línea y
  // seguimos hasta pasar y1 + r (la última pasada SIEMPRE se emite).
  const zCut = stock.zTop - p.depth;
  const zSafe = stock.zTop + p.safeZ;
  const ys: number[] = [];
  for (let y = stock.y0 - r + p.stepover; y < stock.y1 + r; y += p.stepover) ys.push(y);
  if (ys.length === 0 || ys[ys.length - 1] < stock.y1 + r - 1e-9) ys.push(stock.y1 + r);

  // entrada: rápido al inicio, plunge a zCut
  segs.push({ kind: 'rapid', from: [xA, ys[0], zSafe], to: [xA, ys[0], zSafe] });
  segs.push({ kind: 'plunge', from: [xA, ys[0], zSafe], to: [xA, ys[0], zCut] });
  let atB = false; // ¿la fresa está en el extremo B?
  for (let i = 0; i < ys.length; i++) {
    const y = ys[i];
    const xFrom = atB ? xB : xA, xTo = atB ? xA : xB;
    if (i > 0) segs.push({ kind: 'cut', from: [xFrom, ys[i - 1], zCut], to: [xFrom, y, zCut] }); // paso lateral cortando
    segs.push({ kind: 'cut', from: [xFrom, y, zCut], to: [xTo, y, zCut] });                      // pasada
    atB = !atB;
  }
  const xEnd = atB ? xB : xA;
  segs.push({ kind: 'rapid', from: [xEnd, ys[ys.length - 1], zCut], to: [xEnd, ys[ys.length - 1], zSafe] });
  return segs;
}

/** Post-proceso genérico (G-code ISO milimétrico, absoluto). */
export function toGcode(segs: ToolpathSegment[], tool: FacingTool, opName = 'CAREADO'): string {
  const L: string[] = [
    `(La Forja CAM - ${opName})`,
    'G21 (mm)', 'G90 (absoluto)', 'G17 (plano XY)',
    `M3 S${Math.round(tool.rpm)}`,
  ];
  const f = (n: number) => n.toFixed(3).replace(/\.?0+$/, '') || '0';
  let lastFeed = -1;
  for (const s of segs) {
    const [x, y, z] = s.to;
    if (s.kind === 'rapid') L.push(`G0 X${f(x)} Y${f(y)} Z${f(z)}`);
    else {
      const feed = s.kind === 'plunge' ? tool.plunge : tool.feed;
      const fWord = feed !== lastFeed ? ` F${Math.round(feed)}` : '';
      if (s.arc) {
        // I/J incrementales desde el punto de arranque (convención Fanuc/Haas G91.1).
        // Con Δz ≠ 0 la palabra Z convierte el arco en HÉLICE (interpolación helicoidal).
        const I = s.arc.cx - s.from[0], J = s.arc.cy - s.from[1];
        const zW = Math.abs(z - s.from[2]) > 1e-9 ? ` Z${f(z)}` : '';
        L.push(`${s.arc.cw ? 'G2' : 'G3'} X${f(x)} Y${f(y)}${zW} I${f(I)} J${f(J)}${fWord}`);
      } else L.push(`G1 X${f(x)} Y${f(y)} Z${f(z)}${fWord}`);
      lastFeed = feed;
    }
  }
  L.push('M5', 'M30');
  return L.join('\n') + '\n';
}

/** Métricas para el panel (longitud de corte y tiempo estimado, como el libro). */
export function toolpathStats(segs: ToolpathSegment[], tool: FacingTool): { cutLen: number; timeMin: number } {
  let cutLen = 0, timeMin = 0;
  for (const s of segs) {
    const d = s.arc
      ? Math.hypot(Math.hypot(s.from[0] - s.arc.cx, s.from[1] - s.arc.cy) * arcSweep(s), s.to[2] - s.from[2])
      : Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1], s.to[2] - s.from[2]);
    if (s.kind === 'cut') { cutLen += d; timeMin += d / tool.feed; }
    else if (s.kind === 'plunge') timeMin += d / tool.plunge;
    else timeMin += d / 5000; // rápidos ~5 m/min
  }
  return { cutLen, timeMin };
}
