/**
 * CAM · CORTE LÁSER — libro Cimo caps 11-13.
 *
 * El libro: nesting de N piezas en hoja (cap 12: 1000×500×3), y la operación de
 * corte (cap 13): fibra 4kW sobre acero 3mm → kerf 0.4mm, feed 3800 mm/min,
 * potencia de corte vs de PERFORADO (pierce, con pausa), lead-in corto. Regla
 * dura del oficio: los contornos INTERIORES se cortan ANTES que el exterior
 * (si liberas la pieza primero, se mueve y los interiores salen chuecos).
 *
 * Kerf: el rayo tiene ancho — el centro del corte se compensa MEDIO kerf hacia
 * AFUERA en el contorno exterior y hacia ADENTRO en los interiores (offset por
 * normales de vértice — exacto en polígonos convexos, honesto en el resto).
 * Motor PURO: testeable en node.
 */

export interface XY { x: number; y: number }

export interface LaserPart {
  outline: XY[];      // contorno exterior (CCW)
  holes?: XY[][];     // contornos interiores
}

export interface LaserTool {
  kerf: number;       // ancho del corte (0.4)
  feed: number;       // mm/min (3800)
  cutPower: number;   // % o S (80)
  piercePower: number;// % o S (100)
  pierceMs: number;   // pausa de perforado (300)
}

export interface LaserPlacement { dx: number; dy: number }

/** Offset simple por normales de vértice (+ = hacia afuera de un lazo CCW). */
export function offsetLoop(loop: XY[], d: number): XY[] {
  const n = loop.length;
  const out: XY[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = loop[(i - 1 + n) % n], p1 = loop[i], p2 = loop[(i + 1) % n];
    const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x) - Math.PI / 2; // normal derecha de cada arista (CCW → afuera)
    const a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x) - Math.PI / 2;
    let nx = Math.cos(a1) + Math.cos(a2), ny = Math.sin(a1) + Math.sin(a2);
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    // corrección de esquina (miter suave): d / cos(θ/2) acotado a 2d
    const half = Math.max(0.5, Math.abs(Math.cos((a2 - a1) / 2)));
    const k = Math.min(2 * Math.abs(d), Math.abs(d) / half) * Math.sign(d);
    out.push({ x: p1.x + nx * k, y: p1.y + ny * k });
  }
  return out;
}

/** NESTING (cap 12): rejilla honesta en la hoja — filas/columnas por bbox + gap. */
export function nestParts(
  part: LaserPart, sheet: { w: number; h: number }, count: number, gap = 8,
): LaserPlacement[] {
  const xs = part.outline.map(p => p.x), ys = part.outline.map(p => p.y);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const cols = Math.max(1, Math.floor((sheet.w - gap) / (w + gap)));
  const rows = Math.max(1, Math.floor((sheet.h - gap) / (h + gap)));
  const out: LaserPlacement[] = [];
  for (let r = 0; r < rows && out.length < count; r++)
    for (let c = 0; c < cols && out.length < count; c++)
      out.push({ dx: gap + c * (w + gap) - x0, dy: gap + r * (h + gap) - y0 });
  return out; // si count > rows·cols, devuelve las que CABEN (el caller reporta)
}

/** G-code de láser: por pieza — interiores primero, pierce con pausa, M3/M5 por lazo. */
export function laserGcode(
  part: LaserPart, placements: LaserPlacement[], tool: LaserTool, opName = 'LASER',
): string {
  const f3 = (v: number) => v.toFixed(3).replace(/\.?0+$/, '') || '0';
  const L: string[] = [
    `(La Forja CAM - ${opName})`,
    'G21 (mm)', 'G90 (absoluto)',
    `(kerf ${tool.kerf} · feed ${tool.feed} mm/min · fibra: corte S${tool.cutPower} / pierce S${tool.piercePower})`,
  ];
  const k2 = tool.kerf / 2;
  const outer = offsetLoop(part.outline, +k2);           // el corte LIBRA la pieza por fuera
  const holes = (part.holes ?? []).map(hh => offsetLoop(hh, -k2)); // interiores: el rayo por dentro del hueco... hacia el CENTRO del hueco = -normal del lazo
  for (let pi = 0; pi < placements.length; pi++) {
    const { dx, dy } = placements[pi];
    L.push(`(pieza ${pi + 1})`);
    const cutLoop = (loop: XY[]) => {
      const s = loop[0];
      L.push(`G0 X${f3(s.x + dx)} Y${f3(s.y + dy)}`);
      L.push(`M3 S${tool.piercePower}`, `G4 P${(tool.pierceMs / 1000).toFixed(2)} (pierce)`, `M3 S${tool.cutPower}`);
      for (let i = 1; i <= loop.length; i++) {
        const q = loop[i % loop.length];
        L.push(`G1 X${f3(q.x + dx)} Y${f3(q.y + dy)} F${tool.feed}`);
      }
      L.push('M5');
    };
    for (const hh of holes) cutLoop(hh);   // INTERIORES PRIMERO (regla del libro)
    cutLoop(outer);                        // el exterior libera la pieza AL FINAL
  }
  L.push('M30');
  return L.join('\n') + '\n';
}
