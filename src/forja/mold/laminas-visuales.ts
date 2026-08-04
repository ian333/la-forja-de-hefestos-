/**
 * LÁMINAS VISUALES — las figuras del libro, dibujadas con NUESTROS datos.
 * ============================================================================
 * El libro de Kazmer tiene 283 figuras y enseña COMPARANDO: Fig 11.10 "ejector
 * pin located away from sides of core" (MALO: "a significant moment and
 * deflection will be applied before the molding is stripped off the core") vs
 * Fig 11.11 "ejector pins located near core side walls" (BUENO). El criterio no
 * es un número: se MIRA la planta del núcleo y se ve si los pines están donde
 * agarra la pieza.
 *
 * Nuestro juez era 100 % numérico — y ya sabemos qué pasa con los jueces sin
 * ojos ("el transistor inventado sacó el mejor score"). Estas láminas cierran
 * esa mitad: se dibujan de los MISMOS datos que juzgan los contratos, y se
 * pueden mirar — por un humano, por un agente con ojos, o medir por píxeles.
 *
 * PURO (devuelve SVG como string) → node-testeable y renderizable a PNG.
 */
import type { GripLayout } from './eject-layout';

const ESC = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface Lamina {
  id: string;
  titulo: string;
  /** § y figura del libro que esta lámina reproduce */
  cita: string;
  /** qué debe mirar quien juzgue (el criterio del libro, en corto) */
  queMirar: string;
  svg: string;
}

const CSS = `
  .bg{fill:#0b0f16}
  .tit{fill:#e9eef5;font:700 20px 'JetBrains Mono',monospace}
  .sub{fill:#8fa3bd;font:400 13px 'JetBrains Mono',monospace}
  .cita{fill:#c9a227;font:700 13px 'JetBrains Mono',monospace}
  .lbl{fill:#c3d0e0;font:400 12px 'JetBrains Mono',monospace}
  .lblSm{fill:#8fa3bd;font:400 10.5px 'JetBrains Mono',monospace}
  .ok{fill:#59d98c} .mal{fill:#ff5c5c} .warn{fill:#ffb347}
`;

/**
 * LÁMINA §11.2.5 — LA PLANTA DEL NÚCLEO CON LOS EXPULSORES (Fig 11.10 vs 11.11).
 * Se dibuja: la huella de la pieza (gris), dónde ABRAZA el núcleo (ámbar: paredes
 * y costillas — ahí nace la fuerza de expulsión), cada pin con su barreno, y el
 * anillo punteado del acero exigido (1⌀ §11.2.5). A ojo se juzga lo que el libro
 * juzga: ¿los pines están JUNTO al agarre (Fig 11.11) o tirados al centro
 * (Fig 11.10)? ¿algún anillo pisa la pared?
 */
export function laminaExpulsores(g: GripLayout, o: {
  pinDiaMm: number; nombre: string;
  /** posiciones REALMENTE usadas si no son las de `g` (p.ej. la rejilla) */
  posiciones?: Array<{ x: number; y: number }>;
  modo?: 'agarre' | 'rejilla' | 'plana-uniforme';
}): Lamina {
  const grid = g.grid;
  const pos = o.posiciones ?? g.positions;
  const W = 1000, H = 760, PAD = 62, TOP = 96;
  if (!grid) {
    return { id: 'expulsores', titulo: `Expulsores · ${o.nombre}`, cita: '§11.2.5 · Fig 11.10-11.11',
      queMirar: 'sin raster no hay lámina', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/><text class="sub" x="${PAD}" y="${TOP}">sin raster (pieza sin malla)</text></svg>` };
  }
  const anchoMm = grid.nx * grid.sx, altoMm = grid.ny * grid.sy;
  const k = Math.min((W - 2 * PAD) / anchoMm, (H - TOP - PAD) / altoMm);
  const px = (xmm: number) => PAD + (xmm - grid.x0) * k;
  const py = (ymm: number) => TOP + (ymm - grid.y0) * k;

  const celdas: string[] = [];
  for (let j = 0; j < grid.ny; j++) for (let i = 0; i < grid.nx; i++) {
    const t = j * grid.nx + i;
    if (!grid.push[t] && !grid.wall[t]) continue;
    const x = px(grid.x0 + i * grid.sx), y = py(grid.y0 + j * grid.sy);
    const w = grid.sx * k + 0.6, h = grid.sy * k + 0.6;
    // ÁMBAR = la pieza abraza el núcleo ahí (pared/costilla): de ahí sale la
    // fuerza de expulsión §11.2.5. GRIS = material que se puede empujar.
    const fill = grid.wall[t] ? '#c9a22755' : '#2a3648';
    celdas.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}"/>`);
  }

  // distancia de cada pin a la pared más cercana (para anotar el juicio)
  const wallPts: Array<[number, number]> = [];
  for (let j = 0; j < grid.ny; j++) for (let i = 0; i < grid.nx; i++)
    if (grid.wall[j * grid.nx + i]) wallPts.push([grid.x0 + (i + 0.5) * grid.sx, grid.y0 + (j + 0.5) * grid.sy]);
  const dPared = (p: { x: number; y: number }) => {
    let d = Infinity;
    for (const [wx, wy] of wallPts) d = Math.min(d, Math.hypot(p.x - wx, p.y - wy));
    return d;
  };

  /** el punto de agarre más cercano (para DIBUJAR el brazo de palanca que se juzga) */
  const paredCercana = (p: { x: number; y: number }) => {
    let d = Infinity, mejor: [number, number] | null = null;
    for (const w of wallPts) { const dd = Math.hypot(p.x - w[0], p.y - w[1]); if (dd < d) { d = dd; mejor = w; } }
    return { d, pt: mejor };
  };
  // LA BANDA del colocador (§11.2.5 Fig 11.11): "cerca" es [keepOut, keepOut+6]
  // — el mismo rango con el que gripEjectorLayout elige, más una celda de raster
  // de tolerancia. Antes el umbral era keepOut+8 inventado: aprobaba en VERDE
  // una rejilla con los pines tirados en el centro (lo cazó esta misma lámina).
  const tol = Math.max(grid.sx, grid.sy);
  const limite = g.keepOutMm + 6 + tol;

  const pines: string[] = [];
  let peor = 0, nLejos = 0;
  for (const p of pos) {
    const { d, pt } = paredCercana(p);
    const lejos = d > limite;
    if (lejos) nLejos++;
    peor = Math.max(peor, d);
    const cx = px(p.x), cy = py(p.y);
    const rBar = Math.max(3, (o.pinDiaMm / 2) * k);
    const col = lejos ? '#ff5c5c' : '#59d98c';
    // EL BRAZO DE PALANCA, dibujado: la línea al agarre más cercano es
    // exactamente lo que §11.2.5 penaliza ("a significant moment and deflection
    // will be applied before the molding is stripped off the core").
    if (pt) pines.push(`<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${px(pt[0]).toFixed(1)}" y2="${py(pt[1]).toFixed(1)}" stroke="${col}" stroke-width="${lejos ? 2 : 1}" opacity="${lejos ? 0.9 : 0.5}" ${lejos ? '' : 'stroke-dasharray="3 3"'}/>`);
    pines.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(g.keepOutMm * k).toFixed(1)}" fill="none" stroke="${col}" stroke-width="0.8" stroke-dasharray="3 4" opacity="0.28"/>`
      + `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rBar.toFixed(1)}" fill="${col}"/>`);
  }

  const modo = o.modo ?? 'agarre';
  const veredicto = modo === 'plana-uniforme'
    ? { txt: 'pieza plana: el agarre ES uniforme — la rejilla no es antipatrón aquí', cls: 'ok' }
    : nLejos > 0
      ? { txt: `✗ ${nLejos} de ${pos.length} pines LEJOS del agarre (>${limite.toFixed(0)} mm) — Fig 11.10: "a significant moment and deflection will be applied"`, cls: 'mal' }
      : { txt: `✓ los ${pos.length} pines JUNTO al agarre (≤${limite.toFixed(0)} mm) — Fig 11.11`, cls: 'ok' };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style>
<rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">PLANTA DEL NÚCLEO · EXPULSORES</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§11.2.5 · Fig 11.10 (lejos del agarre = MAL) vs Fig 11.11 (junto a las paredes = BIEN)</text>
<text class="lblSm" x="${PAD}" y="90">ámbar = la pieza ABRAZA el núcleo (paredes, costillas, bosses) · gris = material empujable · la LÍNEA es el brazo de palanca al agarre</text>
${celdas.join('')}
${pines.join('')}
<text class="${veredicto.cls}" style="font:700 14px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 34}">${ESC(veredicto.txt)}</text>
<text class="lblSm" x="${PAD}" y="${H - 16}">${pos.length} pines ⌀${o.pinDiaMm} mm · acero exigido ${g.keepOutMm.toFixed(1)} mm del centro al muro · el más lejano del agarre: ${peor === 0 ? '—' : peor.toFixed(1) + ' mm'} · modo ${modo}</text>
</svg>`;

  return {
    id: 'expulsores', titulo: `Planta del núcleo · expulsores — ${o.nombre}`,
    cita: '§11.2.5 · Fig 11.10 vs Fig 11.11',
    queMirar: '¿los pines están JUNTO a las zonas ámbar (donde la pieza abraza el núcleo) o tirados en el gris del centro? ¿algún anillo punteado pisa una zona ámbar (acero insuficiente)?',
    svg,
  };
}

/** Envuelve láminas en una hoja HTML imprimible/capturable (una por página). */
export function laminasToHTML(ls: Lamina[], titulo: string): string {
  return `<!doctype html><meta charset="utf-8"><title>${ESC(titulo)}</title>
<style>body{margin:0;background:#0b0f16;font-family:'JetBrains Mono',monospace}
 .l{padding:18px 20px;border-bottom:1px solid #1c2634}
 .cap{color:#8fa3bd;font-size:12px;margin:8px 0 0;max-width:1000px;line-height:1.5}
 .cap b{color:#c9a227}</style>
<body>${ls.map((l) => `<div class="l" data-lamina="${ESC(l.id)}">${l.svg}
 <p class="cap"><b>QUÉ MIRAR [${ESC(l.cita)}]:</b> ${ESC(l.queMirar)}</p></div>`).join('')}</body>`;
}
