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

/**
 * LÁMINA §5.5.4 + §8.2.2 — LAS ISÓCRONAS DEL FRENTE (Fig 5.17 / 5.20).
 * ============================================================================
 * La vista de mayor rendimiento del libro: de ella salen el race-tracking, las
 * líneas de soldadura, las TRAMPAS DE GAS y todas las ubicaciones de venteo del
 * cap. 8. El libro pinta el lay-flat con los arcos del frente y busca DÓNDE SE
 * CIERRAN — y distingue dos casos que nosotros no distinguíamos:
 *
 *   · cierre en un BORDE de la huella → el venteo lo alcanza en la partición.
 *   · cierre en el INTERIOR → TRAMPA DE GAS. §5.5.4 literal: "especially
 *     problematic since it is difficult to vent. As such, the trapped air will
 *     likely combust, causing a burn mark to appear at this location."
 *
 * ESCALA DE COLOR FIJA (regla transversal del libro): bandas de 10 % de llenado.
 * Kazmer juzga CONTANDO contornos; auto-escalar destruiría el criterio.
 */
export interface FrenteLamina {
  nx: number; ny: number; sx: number; sy: number; x0: number; y0: number;
  /** fracción de llenado con que llega el frente a cada columna (NaN = sin material) */
  llegada: Float32Array;
  /** true si la columna tiene material */
  solido: Uint8Array;
}
export function laminaFrente(f: FrenteLamina, o: {
  nombre: string;
  venteos: Array<{ x: number; y: number; tipo: string; fracLlenado: number; interior?: boolean }>;
  /** §5.5.4: la regla directa del race-tracking */
  LperimetroMm?: number; LcenterlineMm?: number;
  profMm?: number; anchoMm?: number;
}): Lamina {
  const W = 1000, H = 700, PAD = 62, TOP = 100, BOT = 78;
  const anchoMm = f.nx * f.sx, altoMm = f.ny * f.sy;
  const k = Math.min((W - 2 * PAD) / anchoMm, (H - TOP - BOT) / altoMm);
  const px = (x: number) => PAD + (x - f.x0) * k;
  const py = (y: number) => TOP + (y - f.y0) * k;

  // ESCALA FIJA: 10 bandas de 10 % — de frío (primero) a caliente (último)
  const BANDA = ['#12324a', '#154b60', '#1a6a6a', '#2c8a5e', '#68a544', '#a8b234', '#d8a52c', '#e8802a', '#e35434', '#d12f3f'];
  const celdas: string[] = [];
  for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) {
    const t = j * f.nx + i;
    if (!f.solido[t]) continue;
    const v = f.llegada[t];
    const col = Number.isFinite(v) ? BANDA[Math.max(0, Math.min(9, Math.floor(v * 10)))] : '#2a3648';
    celdas.push(`<rect x="${px(f.x0 + i * f.sx).toFixed(1)}" y="${py(f.y0 + j * f.sy).toFixed(1)}" width="${(f.sx * k + 0.6).toFixed(1)}" height="${(f.sy * k + 0.6).toFixed(1)}" fill="${col}"/>`);
  }

  const trampas = o.venteos.filter((v) => v.interior);
  const marcas = o.venteos.map((v) => {
    const cx = px(v.x), cy = py(v.y);
    const col = v.interior ? '#ff5c5c' : '#59d98c';
    return v.interior
      ? `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9" fill="none" stroke="${col}" stroke-width="2.4"/>`
        + `<line x1="${(cx - 5).toFixed(1)}" y1="${(cy - 5).toFixed(1)}" x2="${(cx + 5).toFixed(1)}" y2="${(cy + 5).toFixed(1)}" stroke="${col}" stroke-width="2.4"/>`
        + `<line x1="${(cx + 5).toFixed(1)}" y1="${(cy - 5).toFixed(1)}" x2="${(cx - 5).toFixed(1)}" y2="${(cy + 5).toFixed(1)}" stroke="${col}" stroke-width="2.4"/>`
      : `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="none" stroke="${col}" stroke-width="2.2"/>`
        + `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2" fill="${col}"/>`;
  }).join('');

  // §5.5.4: race-tracking por la regla directa del libro
  const raceL = o.LperimetroMm != null && o.LcenterlineMm != null && o.LperimetroMm < o.LcenterlineMm;
  const raceProf = o.profMm != null && o.anchoMm != null && o.profMm > o.anchoMm / 2;
  const ver = trampas.length > 0
    ? { txt: `✗ ${trampas.length} TRAMPA(S) DE GAS: el frente cierra en el INTERIOR, donde el venteo no llega`, cls: 'mal',
        sub: '§5.5.4: "difficult to vent. As such, the trapped air will likely combust, causing a burn mark"' }
    : raceL || raceProf
      ? { txt: `⚠ RACE-TRACKING probable (§5.5.4) — todos los cierres son venteables, pero el frente corre por el perímetro`, cls: 'warn',
          sub: raceProf ? `prof ${o.profMm} mm > ½ del ancho ${o.anchoMm} mm — el caso exacto del libro (60 vs 100 mm)` : `L_perímetro ${o.LperimetroMm} < L_centerline ${o.LcenterlineMm} mm` }
      : { txt: `✓ los ${o.venteos.length} cierres del frente caen en BORDES — venteables en la partición`, cls: 'ok',
          sub: 'sin trampas de gas: ningún frente se cierra en el interior de una superficie' };

  const leyenda = BANDA.map((c, i) =>
    `<rect x="${PAD + i * 26}" y="${H - 40}" width="26" height="9" fill="${c}"/>`
    + (i % 3 === 0 ? `<text class="lblSm" x="${PAD + i * 26}" y="${H - 44}">${i * 10}%</text>` : '')).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">ISÓCRONAS DEL FRENTE · planta</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§5.5.4 · Fig 5.17 (race-tracking, weld line y GAS TRAP) · §8.2.2 (de aquí salen los venteos)</text>
<text class="lblSm" x="${PAD}" y="90">bandas FIJAS de 10 % de llenado (el libro cuenta contornos: auto-escalar destruye el criterio) · ✕ rojo = trampa de gas · ○ verde = cierre venteable</text>
${celdas.join('')}${marcas}
${leyenda}
<text class="${ver.cls}" style="font:700 13.5px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 22}">${ESC(ver.txt)}</text>
<text class="lblSm" x="${PAD}" y="${H - 8}">${ESC(ver.sub)}</text>
</svg>`;

  return {
    id: 'frente', titulo: `Isócronas del frente — ${o.nombre}`, cita: '§5.5.4 · Fig 5.17 · §8.2.2',
    queMirar: '¿dónde SE CIERRA el frente? Un cierre en el borde se ventea en la partición (○ verde); uno en el INTERIOR es trampa de gas (✕ rojo) y quema la pieza. ¿el color corre por el perímetro antes que por el centro (race-tracking)?',
    svg,
  };
}

/**
 * LÁMINA §10.3.1 — LA PIEZA ALABEADA CON SU CAUSA AL LADO (Fig 10.14 / 10.15).
 * El libro dibuja la CADENA CAUSAL: circuito desigual → gradiente térmico → la
 * pieza curvada con su radio acotado. Y son DOS FORMAS distintas: curvatura
 * (a través del espesor) y pandeo (a través del área). Se dibuja la sección con
 * la deformación EXAGERADA y el número real acotado — el libro compara el
 * alabeo contra la contracción total, y ahí está su argumento: 2 °C de
 * diferencia dan MÁS alabeo que toda la contracción de la pieza.
 */
export function laminaAlabeo(o: {
  nombre: string; halfWidthMm: number; wallMm: number;
  espesor: { sCorePct: number; sCavityPct: number; radiusMm: number; deltaMm: number; contraccionTotalMm: number; superaContraccion: boolean };
  area: { sCenterPct: number; sEdgePct: number; deltaS: number; umbral: number; pandea: boolean; deltaMm: number; aplica: boolean; nota: string; advertencia: string };
  dtC: number;
}): Lamina {
  const W = 1000, H = 640, PAD = 62;
  const mid = W / 2, half = (mid - PAD) - 30;
  const dib = (cx: number, delta: number, modo: 'curva' | 'pandeo', y: number) => {
    const k = half / o.halfWidthMm;
    const EXA = delta > 0 ? Math.min(46 / delta, 60) : 1;   // exageración visible, DECLARADA
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const u = -1 + (2 * i) / 40;                          // −1 … 1 (centro→bordes)
      const dy = modo === 'curva'
        ? delta * EXA * (u * u)                             // curvatura: los bordes suben
        : delta * EXA * (1 - u * u);                        // pandeo: el centro sale
      pts.push(`${(cx + u * half).toFixed(1)},${(y - dy).toFixed(1)}`);
    }
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="#c9a227" stroke-width="3"/>`
      + `<line x1="${cx - half}" y1="${y}" x2="${cx + half}" y2="${y}" stroke="#3a4a60" stroke-width="1" stroke-dasharray="5 4"/>`
      + `<text class="lblSm" x="${cx - half}" y="${y + 18}">plano nominal · deformación ×${EXA.toFixed(0)}</text>`;
  };
  const eSup = o.espesor.superaContraccion;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">ALABEO · las DOS formas del libro</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§10.3.1 · Fig 10.14 (a través del ESPESOR = curvatura) · Fig 10.15 (a través del ÁREA = pandeo)</text>

<text class="lbl" style="font:700 13px 'JetBrains Mono',monospace" x="${PAD}" y="120">1 · A TRAVÉS DEL ESPESOR (Ec. 10.17-10.18)</text>
<text class="lblSm" x="${PAD}" y="138">causa: el núcleo ${o.dtC.toFixed(1)} °C más caliente que la cavidad ⇒ contrae más de ese lado</text>
<text class="lblSm" x="${PAD}" y="153">s_core ${o.espesor.sCorePct}% vs s_cav ${o.espesor.sCavityPct}% · R = 2h/Δs = ${o.espesor.radiusMm} mm</text>
${dib(mid, o.espesor.deltaMm, 'curva', 250)}
<text class="${eSup ? 'mal' : 'warn'}" style="font:700 14px 'JetBrains Mono',monospace" x="${PAD}" y="292">δ = ${o.espesor.deltaMm} mm fuera de plano${eSup ? ` — MÁS que toda la contracción de la pieza (${o.espesor.contraccionTotalMm} mm)` : ''}</text>
<text class="lblSm" x="${PAD}" y="309">${eSup ? 'ese es el argumento del libro para exigir un circuito de agua PAREJO: bastan 2 °C' : `contracción total de borde a borde ${o.espesor.contraccionTotalMm} mm`}</text>

<text class="lbl" style="font:700 13px 'JetBrains Mono',monospace" x="${PAD}" y="368">2 · A TRAVÉS DEL ÁREA — PANDEO (Ec. 10.19-10.20)</text>
<text class="lblSm" x="${PAD}" y="386">causa: compuerta central ⇒ el empaque cae del centro al borde ⇒ el borde contrae más</text>
<text class="lblSm" x="${PAD}" y="401">s_centro ${o.area.sCenterPct}% vs s_borde ${o.area.sEdgePct}% · Δs ${o.area.deltaS.toFixed(5)} ${o.area.deltaS > o.area.umbral ? '>' : '≤'} 0.44·(h/W)² = ${o.area.umbral.toFixed(5)}</text>
${o.area.pandea ? dib(mid, o.area.deltaMm, 'pandeo', 500) : `<text class="ok" style="font:700 14px 'JetBrains Mono',monospace" x="${PAD}" y="470">✓ NO pandea</text>`}
<text class="${o.area.pandea ? 'mal' : 'ok'}" style="font:700 14px 'JetBrains Mono',monospace" x="${PAD}" y="${o.area.pandea ? 545 : 492}">${o.area.pandea ? `δ = ${o.area.deltaMm} mm de pandeo` : 'sin pandeo'}</text>
<text class="lblSm" x="${PAD}" y="${o.area.pandea ? 562 : 509}">${ESC(o.area.nota.slice(0, 118))}</text>
${o.area.pandea ? `<text class="warn" style="font:700 11px 'JetBrains Mono',monospace" x="${PAD}" y="580">⚠ ${ESC(o.area.advertencia.slice(0, 132))}</text>` : ''}
<text class="lblSm" x="${PAD}" y="${H - 14}">las dos formas son INDEPENDIENTES y se suman: h ${o.wallMm} mm · semiancho ${o.halfWidthMm} mm · Ec. 10.17-10.20 verificadas contra los ejemplos del libro (1.6 y 6.6 mm)</text>
</svg>`;
  return {
    id: 'alabeo', titulo: `Alabeo — ${o.nombre}`, cita: '§10.3.1 · Fig 10.14 y 10.15',
    queMirar: '¿la pieza se CURVA (gradiente a través del espesor: el circuito de agua no es parejo) o PANDEA (gradiente a través del área: la compuerta no empaca el borde)? ¿el alabeo supera a la contracción total — la alarma del libro?',
    svg,
  };
}

/**
 * LÁMINA §12.1.2 — DEFLEXIÓN DEL MOLDE CONTRA EL ESPESOR DEL VENTEO (Fig 12.6).
 * El umbral ABSOLUTO más raro del libro: la separación de las mitades bajo carga
 * se compara contra el venteo (~0.02 mm). Si la supera, "a significant amount of
 * flashing is expected. The mold design must be improved to reduce this
 * deflection." Se dibuja la placa deformada (exagerada) con las dos cotas.
 */
export function laminaDeflexion(o: {
  nombre: string; deflexionMm: number; venteoMm: number;
  spanMm: number; placaMm: number; nPilares: number; gobierna: string;
}): Lamina {
  const W = 1000, H = 520, PAD = 62;
  const half = (W / 2 - PAD) - 20, mid = W / 2, yBase = 300;
  const EXA = o.deflexionMm > 0 ? Math.min(70 / o.deflexionMm, 400) : 1;
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const u = -1 + (2 * i) / 48;
    pts.push(`${(mid + u * half).toFixed(1)},${(yBase + o.deflexionMm * EXA * (1 - u * u)).toFixed(1)}`);
  }
  const flash = o.deflexionMm > o.venteoMm;
  const pilares = Array.from({ length: o.nPilares }, (_, i) => {
    const u = o.nPilares === 1 ? 0 : -1 + (2 * i) / (o.nPilares - 1);
    const x = mid + u * half * 0.82;
    return `<line x1="${x.toFixed(1)}" y1="${yBase + 6}" x2="${x.toFixed(1)}" y2="${yBase + 74}" stroke="#5a6b82" stroke-width="7"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">DEFLEXIÓN DEL MOLDE vs ESPESOR DEL VENTEO</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§12.1.2 · Fig 12.6 — el umbral ABSOLUTO: si la separación supera el venteo, hay rebaba</text>
<text class="lblSm" x="${PAD}" y="92">la placa se dibuja deformada ×${EXA.toFixed(0)} · gris = pilares de soporte</text>
<line x1="${mid - half}" y1="${yBase}" x2="${mid + half}" y2="${yBase}" stroke="#3a4a60" stroke-width="1" stroke-dasharray="5 4"/>
<polyline points="${pts.join(' ')}" fill="none" stroke="${flash ? '#ff5c5c' : '#59d98c'}" stroke-width="3.5"/>
${pilares}
<line x1="${mid}" y1="${yBase}" x2="${mid}" y2="${(yBase + o.deflexionMm * EXA).toFixed(1)}" stroke="#c9a227" stroke-width="1.6"/>
<text class="cita" x="${mid + 10}" y="${(yBase + o.deflexionMm * EXA / 2).toFixed(1)}">δ ${o.deflexionMm.toFixed(4)} mm</text>
<text class="${flash ? 'mal' : 'ok'}" style="font:700 14px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 60}">${flash ? `✗ FLASH GARANTIZADO: δ ${o.deflexionMm.toFixed(4)} > venteo ${o.venteoMm.toFixed(3)} mm` : `✓ δ ${o.deflexionMm.toFixed(4)} mm < venteo ${o.venteoMm.toFixed(3)} mm — las mitades cierran más fino que el vent`}</text>
<text class="lblSm" x="${PAD}" y="${H - 42}">${flash ? '"a significant amount of flashing is expected. The mold design must be improved to reduce this deflection."' : 'el criterio de §12.1.2 se cumple con margen de ' + (o.venteoMm / Math.max(1e-9, o.deflexionMm)).toFixed(1) + '×'}</text>
<text class="lblSm" x="${PAD}" y="${H - 22}">claro ${o.spanMm.toFixed(0)} mm · placa ${o.placaMm} mm · ${o.nPilares} pilares · gobierna ${ESC(o.gobierna)} — §12.1.3: cambiar de acero NO ayuda (todos ≈200 GPa), solo la geometría</text>
</svg>`;
  return {
    id: 'deflexion', titulo: `Deflexión vs venteo — ${o.nombre}`, cita: '§12.1.2 · Fig 12.6',
    queMirar: '¿la curva de la placa deformada abre las mitades MÁS que el espesor del venteo? Ese es el único umbral absoluto del libro: por encima, hay rebaba garantizada.',
    svg,
  };
}

/**
 * LÁMINA §2.3.1 — MAPA DE ESPESOR DE PARED (Fig 2.2).
 * El PRIMER gate del libro: todo lo demás (llenado, contracción, ciclo) hereda
 * de aquí. Escala FIJA en múltiplos de la pared nominal para poder comparar
 * piezas entre sí — auto-escalar haría ver uniforme a una pieza pésima.
 */
export function laminaEspesor(m: {
  nx: number; ny: number; sx: number; sy: number; x0: number; y0: number; thick: Float32Array;
}, o: { nombre: string; nominalMm: number; p95Mm: number; ratio: number }): Lamina {
  const W = 1000, H = 700, PAD = 62, TOP = 100, BOT = 74;
  const k = Math.min((W - 2 * PAD) / (m.nx * m.sx), (H - TOP - BOT) / (m.ny * m.sy));
  // ESCALA FIJA en múltiplos del nominal: ≤0.5 · 0.75 · 1 · 1.5 · 2 · >2
  const BANDA = ['#2b5f8f', '#3f8fa8', '#59d98c', '#a8b234', '#e8a02a', '#d12f3f'];
  const banda = (t: number) => t <= 0.5 ? 0 : t <= 0.85 ? 1 : t <= 1.15 ? 2 : t <= 1.5 ? 3 : t <= 2 ? 4 : 5;
  const celdas: string[] = [];
  let nGrueso = 0, nTotal = 0;
  for (let j = 0; j < m.ny; j++) for (let i = 0; i < m.nx; i++) {
    const t = m.thick[j * m.nx + i];
    if (!Number.isFinite(t) || t <= 0) continue;
    nTotal++;
    const r = t / o.nominalMm;
    if (r > 1.5) nGrueso++;
    celdas.push(`<rect x="${(PAD + i * m.sx * k).toFixed(1)}" y="${(TOP + j * m.sy * k).toFixed(1)}" width="${(m.sx * k + 0.6).toFixed(1)}" height="${(m.sy * k + 0.6).toFixed(1)}" fill="${BANDA[banda(r)]}"/>`);
  }
  const pctGrueso = nTotal ? (nGrueso / nTotal) * 100 : 0;
  const mal = o.ratio > 2;
  const leyenda = ['≤0.5×', '0.85×', '1×', '1.5×', '2×', '>2×'].map((lb, i) =>
    `<rect x="${PAD + i * 62}" y="${H - 42}" width="62" height="10" fill="${BANDA[i]}"/><text class="lblSm" x="${PAD + i * 62}" y="${H - 46}">${lb}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">MAPA DE ESPESOR DE PARED · planta</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§2.3.1 · Fig 2.2 — el PRIMER gate del libro: llenado, contracción y ciclo heredan de aquí</text>
<text class="lblSm" x="${PAD}" y="92">escala FIJA en múltiplos del nominal ${o.nominalMm} mm (auto-escalar haría ver uniforme a una pieza pésima)</text>
${celdas.join('')}${leyenda}
<text class="${mal ? 'mal' : 'ok'}" style="font:700 13.5px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 22}">${mal ? `✗ p95 ${o.p95Mm} mm = ${o.ratio}× el nominal — "internal voids may be formed"` : `✓ p95 ${o.p95Mm} mm = ${o.ratio}× el nominal (límite 2×)`}</text>
<text class="lblSm" x="${PAD}" y="${H - 8}">${pctGrueso.toFixed(1)} % de la huella por encima de 1.5× · las zonas ámbar/rojas son las que dan rechupe y alargan el ciclo (§2.3.1)</text>
</svg>`;
  return {
    id: 'espesor', titulo: `Mapa de espesor — ${o.nombre}`, cita: '§2.3.1 · Fig 2.2',
    queMirar: '¿la pieza es de un color parejo o hay islas ámbar/rojas? Cada isla gruesa es rechupe, vacío interno y ciclo largo. Las transiciones deben ser graduales, no escalones.',
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
