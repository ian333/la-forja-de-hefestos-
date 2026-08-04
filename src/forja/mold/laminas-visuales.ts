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

/**
 * LÁMINA §9.2.7 — LA SECCIÓN DEL AGUA (la tríada Fig 9.9 → 9.10 → 9.11).
 * El libro corta el molde PERPENDICULAR a los canales para verlos como círculos
 * y juzga TRES cosas de un vistazo:
 *   Fig 9.9  "Infeasible initial cooling line layout" — alguna línea CRUZA un
 *            componente crítico. Inviable.
 *   Fig 9.10 "Feasible but poor cooling line layout" — nada choca, pero el agua
 *            quedó LEJOS de la cavidad: "will reduce the rate of heat transfer
 *            and necessitate longer cycle times". LA LECCIÓN: no chocar ≠ estar
 *            bien. Y el núcleo hondo enfriado solo por la base.
 *   Fig 9.11 el gradiente que eso produce.
 * Se dibuja con los datos del circuito REAL (coolingCircuit) y de la cavidad.
 */
export function laminaAgua(o: {
  nombre: string;
  /** fondo de la placa (mm) y su ancho en la sección */
  depthMm: number;
  /** placas: z de la partición y espesores */
  zPart: number; tA: number; tB: number;
  /** las impresiones que corta esta sección (rango en Y de CADA una) — el molde
   *  es multi-cavidad: medir contra una sola daba "136 mm de la impresión"
   *  cuando el canal estaba junto a OTRA cavidad (lo cazó esta misma lámina). */
  impresiones: Array<{ y0: number; y1: number }>;
  cavDepthMm: number;
  /** hacia dónde CRECE la impresión desde la partición. En el vaso el macho SUBE
   *  hacia A (por eso la placa A mide 96 mm y la B solo 36): dibujarla hacia
   *  abajo la sacaba de la placa y medía contra el plano equivocado. */
  ladoImpresion: 'A' | 'B';
  /** canales: su Y y su Z (ya resueltos por el circuito) */
  canales: Array<{ y: number; z: number; lado: 'A' | 'B' }>;
  diaMm: number;
  /** holgura mínima MEDIDA agua↔cualquier barreno (de coordAudit) */
  holguraMinMm?: number;
}): Lamina {
  const W = 1000, H = 560, PAD = 62, TOP = 100, BOT = 62;
  const yMin = -10, yMax = o.depthMm + 10;
  const zMin = o.zPart - o.tB - 12, zMax = o.zPart + o.tA + 12;
  const k = Math.min((W - 2 * PAD) / (yMax - yMin), (H - TOP - BOT) / (zMax - zMin));
  const px = (y: number) => PAD + (y - yMin) * k;
  const pz = (z: number) => (H - BOT) - (z - zMin) * k;     // Z hacia ARRIBA

  const claroMin = o.diaMm / 2;
  // el RECTÁNGULO que ocupa cada impresión en la sección: crece desde la
  // partición hacia el lado que lo aloja (en el vaso, hacia A — el macho SUBE)
  const izq = o.ladoImpresion === 'A' ? o.zPart : o.zPart - o.cavDepthMm;
  const der = o.ladoImpresion === 'A' ? o.zPart + o.cavDepthMm : o.zPart;
  // distancia del canal a la superficie de la impresión MÁS CERCANA: punto ↔
  // RECTÁNGULO (no a un plano). Midiendo contra un plano, una línea al costado
  // de una impresión honda salía "lejos" cuando la está abrazando.
  const dCav = (c: { y: number; z: number }) => {
    let best = Infinity;
    for (const im of o.impresiones) {
      const dy = c.y < im.y0 ? im.y0 - c.y : c.y > im.y1 ? c.y - im.y1 : 0;
      const dz = c.z < izq ? izq - c.z : c.z > der ? c.z - der : 0;
      best = Math.min(best, Math.hypot(dy, dz));
    }
    return best - o.diaMm / 2;
  };
  const dists = o.canales.map(dCav);
  const peorLejos = dists.length ? Math.max(...dists) : 0;
  const nLejos = dists.filter((d) => d > 5 * o.diaMm).length;      // >5⌀ del molde: "far from the mold cavity"

  const placas = `
   <rect x="${px(yMin)}" y="${pz(o.zPart + o.tA)}" width="${(yMax - yMin) * k}" height="${o.tA * k}" fill="#1b2534" stroke="#2c3a50"/>
   <rect x="${px(yMin)}" y="${pz(o.zPart)}" width="${(yMax - yMin) * k}" height="${o.tB * k}" fill="#1b2534" stroke="#2c3a50"/>
   <line x1="${px(yMin)}" y1="${pz(o.zPart)}" x2="${px(yMax)}" y2="${pz(o.zPart)}" stroke="#c9a227" stroke-width="1.4" stroke-dasharray="8 4"/>
   <text class="lblSm" x="${px(yMax) - 96}" y="${pz(o.zPart) - 6}">partición</text>`;
  // las impresiones: huecos bajo la partición — lo que hay que enfriar
  const cav = o.impresiones.map((im, i) =>
    `<rect x="${px(im.y0)}" y="${pz(der)}" width="${(im.y1 - im.y0) * k}" height="${o.cavDepthMm * k}" fill="#3a2a12" stroke="#c9a227" stroke-width="1.2"/>`
    + (i === 0 ? `<text class="lblSm" x="${px(im.y0) + 4}" y="${pz(der) - 6}">impresión (prof ${o.cavDepthMm.toFixed(0)} mm, lado ${o.ladoImpresion})</text>` : '')).join('');

  const canales = o.canales.map((c, i) => {
    const d = dists[i];
    const col = d > 5 * o.diaMm ? '#ff5c5c' : d > 3 * o.diaMm ? '#ffb347' : '#59d98c';
    return `<circle cx="${px(c.y)}" cy="${pz(c.z)}" r="${Math.max(3, (o.diaMm / 2) * k)}" fill="none" stroke="${col}" stroke-width="2"/>`
      + `<circle cx="${px(c.y)}" cy="${pz(c.z)}" r="${Math.max(1.5, (o.diaMm / 2) * k * 0.35)}" fill="${col}"/>`;
  }).join('');

  const choca = o.holguraMinMm != null && o.holguraMinMm < claroMin;
  const ver = choca
    ? { txt: `✗ INVIABLE (Fig 9.9): línea a ${o.holguraMinMm!.toFixed(2)} mm de un componente < ½⌀ = ${claroMin.toFixed(2)} mm §9.2.7`, cls: 'mal', sub: 'el libro: "many of the cooling lines intersect critical mold features"' }
    : nLejos > 0
      ? { txt: `⚠ FACTIBLE PERO POBRE (Fig 9.10): ${nLejos} de ${o.canales.length} líneas a >5⌀ de toda impresión`, cls: 'warn', sub: '"will reduce the rate of heat transfer and necessitate longer cycle times" — no chocar NO es estar bien' }
      : { txt: `✓ sin choques §9.2.7 y el agua ABRAZA las impresiones — ni Fig 9.9 ni Fig 9.10`, cls: 'ok', sub: `las ${o.canales.length} líneas dentro de 5⌀ de una impresión` };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">SECCIÓN DEL AGUA · perpendicular a los canales</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§9.2.7 · Fig 9.9 (inviable: choca) → Fig 9.10 (factible pero POBRE: lejos) → Fig 9.11 (el gradiente)</text>
<text class="lblSm" x="${PAD}" y="90">verde ≤3⌀ de la impresión · ámbar 3-5⌀ · rojo >5⌀ — "no chocar" NO es "estar bien"</text>
${placas}${cav}${canales}
<text class="${ver.cls}" style="font:700 13.5px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 44}">${ESC(ver.txt)}</text>
<text class="lblSm" x="${PAD}" y="${H - 28}">${ESC(ver.sub)}</text>
<text class="lblSm" x="${PAD}" y="${H - 12}">${o.canales.length} canales ⌀${o.diaMm.toFixed(2)} · ${o.impresiones.length} impresión(es) · holgura a barrenos ${o.holguraMinMm?.toFixed(2) ?? '—'} mm (exigida ${claroMin.toFixed(2)}) · el más lejano: ${peorLejos.toFixed(1)} mm = ${(peorLejos / o.diaMm).toFixed(1)}⌀</text>
</svg>`;

  return {
    id: 'agua', titulo: `Sección del agua — ${o.nombre}`, cita: '§9.2.7 · Fig 9.9 → 9.10 → 9.11',
    queMirar: '¿alguna línea cruza un componente (Fig 9.9 inviable)? ¿los círculos ABRAZAN la impresión o quedan lejos en el acero (Fig 9.10: factible pero pobre — ciclo largo)? ¿el núcleo es hondo y solo se enfría por la base?',
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
