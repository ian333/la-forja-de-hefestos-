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

/**
 * LÁMINA §2.3.6 — MAPA DE DRAFT (V2.6/V2.7). Las regiones bajo el mínimo SON
 * los undercuts: contarlas conexas da el número de mecanismos que el molde va a
 * necesitar. Escala FIJA en grados (0 · 0.5 · 1.5 · 3 · 7) — los cortes son los
 * de la Tabla 2.14, no percentiles de la pieza.
 * Cálculo VERIFICADO contra conos de ángulo exacto (0/3/7/15° → error <0.02°).
 */
export function laminaDraft(m: {
  nx: number; ny: number; sx: number; sy: number; x0: number; y0: number;
  deg: Float32Array; minDeg: number; tableDeg: number;
}, o: { nombre: string; pctBajoMin: number; pctBajoTabla: number }): Lamina {
  const W = 1000, H = 700, PAD = 62, TOP = 100, BOT = 74;
  const k = Math.min((W - 2 * PAD) / (m.nx * m.sx), (H - TOP - BOT) / (m.ny * m.sy));
  const CORTES = [0.01, m.minDeg, 1.5, 3, 7];
  const BANDA = ['#d12f3f', '#e8802a', '#e8c62a', '#a8b234', '#59d98c', '#2f8f6a'];
  const banda = (d: number) => { let i = 0; while (i < CORTES.length && d >= CORTES[i]) i++; return i; };
  const celdas: string[] = [];
  let nBajo = 0, nLat = 0;
  for (let j = 0; j < m.ny; j++) for (let i = 0; i < m.nx; i++) {
    const d = m.deg[j * m.nx + i];
    if (!Number.isFinite(d)) continue;
    nLat++; if (d < m.minDeg) nBajo++;
    celdas.push(`<rect x="${(PAD + i * m.sx * k).toFixed(1)}" y="${(TOP + j * m.sy * k).toFixed(1)}" width="${(m.sx * k + 0.6).toFixed(1)}" height="${(m.sy * k + 0.6).toFixed(1)}" fill="${BANDA[banda(d)]}"/>`);
  }
  const mal = o.pctBajoMin >= 5;
  const leyenda = ['0°', `${m.minDeg}°`, '1.5°', '3°', '7°', '+'].map((lb, i) =>
    `<rect x="${PAD + i * 58}" y="${H - 42}" width="58" height="10" fill="${BANDA[i]}"/><text class="lblSm" x="${PAD + i * 58}" y="${H - 46}">${lb}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">MAPA DE DRAFT · planta</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§2.3.6 · Tabla 2.14 — las regiones ROJAS son undercuts: contarlas da el nº de mecanismos §11.3</text>
<text class="lblSm" x="${PAD}" y="92">escala FIJA en grados (cortes de la Tabla 2.14, no percentiles) · cálculo verificado contra conos exactos, error &lt;0.02°</text>
${celdas.join('')}${leyenda}
<text class="${mal ? 'mal' : 'ok'}" style="font:700 13.5px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 22}">${mal ? `✗ ${o.pctBajoMin.toFixed(1)} % del área lateral bajo el mínimo ${m.minDeg}° — se raya al expulsar` : `✓ ${o.pctBajoMin.toFixed(1)} % bajo el mínimo ${m.minDeg}° (límite 5 %)`}</text>
<text class="lblSm" x="${PAD}" y="${H - 8}">${o.pctBajoTabla.toFixed(1)} % bajo el recomendado de tabla ${m.tableDeg}° · ${nBajo} de ${nLat} columnas laterales en rojo</text>
</svg>`;
  return {
    id: 'draft', titulo: `Mapa de draft — ${o.nombre}`, cita: '§2.3.6 · Tabla 2.14',
    queMirar: '¿hay islas ROJAS? Cada una es una cara sin salida: se raya al expulsar, y si además mira hacia abajo es UNDERCUT y pide mecanismo (§11.3). Cuenta las islas conexas: ése es el número de correderas.',
    svg,
  };
}

/**
 * LÁMINA §9.2.7 — MAPA TÉRMICO EN SECCIÓN, ISOTERMAS A 2 °C (Fig 9.11 · V9.8).
 * El libro da la clave de lectura literal: "each contour line represents a 2 °C
 * change in temperature", y JUZGA CONTANDO contornos — "a gradient of 6 °C
 * exists from the base of the core to the top of the core". Por eso la escala
 * es FIJA a 2 °C y las isotermas se dibujan como bandas: contarlas ES el método.
 */
export function laminaTermica(s: {
  nu: number; nv: number; T: Float32Array; minC: number; maxC: number; posMm: number;
}, o: { nombre: string; eje: string; coolantC: number }): Lamina {
  const W = 1000, H = 660, PAD = 62, TOP = 100, BOT = 78;
  const k = Math.min((W - 2 * PAD) / s.nu, (H - TOP - BOT) / s.nv);
  const PASO = 2;                                   // °C por contorno (LITERAL del libro)
  const base = Math.floor(s.minC / PASO) * PASO;
  const nBandas = Math.max(1, Math.ceil((s.maxC - base) / PASO));
  // rampa fría→caliente con banda por cada 2 °C — sin auto-escalar el PASO
  const col = (b: number) => {
    const u = nBandas > 1 ? b / (nBandas - 1) : 0;
    const r = Math.round(30 + 200 * u), g = Math.round(70 + 90 * (1 - Math.abs(u - 0.5) * 2)), bl = Math.round(150 * (1 - u) + 30);
    return `rgb(${r},${g},${bl})`;
  };
  const celdas: string[] = [];
  for (let j = 0; j < s.nv; j++) for (let i = 0; i < s.nu; i++) {
    const t = s.T[j * s.nu + i];
    if (!Number.isFinite(t)) continue;
    const b = Math.max(0, Math.min(nBandas - 1, Math.floor((t - base) / PASO)));
    celdas.push(`<rect x="${(PAD + i * k).toFixed(1)}" y="${(TOP + j * k).toFixed(1)}" width="${(k + 0.6).toFixed(1)}" height="${(k + 0.6).toFixed(1)}" fill="${col(b)}"/>`);
  }
  const dT = s.maxC - s.minC;
  const nContornos = Math.round(dT / PASO);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">CAMPO TÉRMICO · sección (isotermas a 2 °C)</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§9.2.7 · Fig 9.11 — "each contour line represents a 2 °C change in temperature"</text>
<text class="lblSm" x="${PAD}" y="92">escala FIJA a 2 °C por banda: el libro JUZGA CONTANDO contornos, no mirando un degradado · corte ${ESC(o.eje)} @ ${s.posMm.toFixed(1)} mm</text>
${celdas.join('')}
<text class="${dT > 6 ? 'warn' : 'ok'}" style="font:700 13.5px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 40}">${dT > 6 ? `⚠ ${nContornos} contornos = ${dT.toFixed(1)} °C de gradiente en la sección` : `✓ ${nContornos} contornos = ${dT.toFixed(1)} °C — campo parejo`}</text>
<text class="lblSm" x="${PAD}" y="${H - 24}">el libro reprueba su ejemplo con 6 °C de base a punta del núcleo: ${dT > 6 ? 'ESTE campo lo supera' : 'este campo está por debajo'} · remedios §9.3.5: núcleo conductivo, baffle/bubbler o inserto de enfriamiento</text>
<text class="lblSm" x="${PAD}" y="${H - 8}">rango ${s.minC.toFixed(1)} – ${s.maxC.toFixed(1)} °C · agua a ${o.coolantC} °C · ${dT > 6 ? `Δs por espesor ⇒ alabeo (Ec. 10.17): 2 °C ya dan 1.6 mm` : 'gradiente bajo el umbral que dispara alabeo apreciable'}</text>
</svg>`;
  return {
    id: 'termica', titulo: `Campo térmico — ${o.nombre}`, cita: '§9.2.7 · Fig 9.11',
    queMirar: 'CUENTA los contornos entre la parte más caliente y la más fría: cada uno son 2 °C. El libro reprueba un núcleo con 6 °C de base a punta porque ese gradiente produce contracción diferencial — y con Ec. 10.17, 2 °C ya dan 1.6 mm de alabeo.',
    svg,
  };
}

/**
 * LÁMINA §4.3.1 — PLANTA DEL PLANO DE PARTICIÓN (V4.10, Fig 4.17→4.20).
 * La cota DURA del libro: "the width to length ratio of the bounding envelope
 * around all cavities should be kept less than 2 : 1". Y la razón: aspectos
 * altos "require the use of large molds that are significantly under utilized
 * … producing structural loadings across the mold for which molding machine
 * platens may not be designed. Furthermore … requires an unbalanced feed
 * system". Se dibuja la base, las impresiones, la envolvente y la colada.
 */
export function laminaParticion(o: {
  nombre: string; baseW: number; baseL: number;
  celdas: Array<{ cx: number; cy: number }>; fx: number; fy: number; round: boolean;
  envW: number; envL: number; aspect: number;
  canales?: Array<{ x0: number; y0: number; x1: number; y1: number }>;
  sprue?: { x: number; y: number };
}): Lamina {
  const W = 1000, H = 700, PAD = 62, TOP = 100, BOT = 62;
  const k = Math.min((W - 2 * PAD) / o.baseW, (H - TOP - BOT) / o.baseL);
  const px = (x: number) => PAD + x * k, py = (y: number) => TOP + y * k;
  const imp = o.celdas.map((c) => o.round
    ? `<circle cx="${px(c.cx).toFixed(1)}" cy="${py(c.cy).toFixed(1)}" r="${(o.fx / 2 * k).toFixed(1)}" fill="#3a2a12" stroke="#c9a227" stroke-width="1.4"/>`
    : `<rect x="${px(c.cx - o.fx / 2).toFixed(1)}" y="${py(c.cy - o.fy / 2).toFixed(1)}" width="${(o.fx * k).toFixed(1)}" height="${(o.fy * k).toFixed(1)}" fill="#3a2a12" stroke="#c9a227" stroke-width="1.4"/>`).join('');
  // la ENVOLVENTE de todas las cavidades: lo que el criterio 2:1 mide
  const ex0 = Math.min(...o.celdas.map((c) => c.cx)) - o.fx / 2, ex1 = Math.max(...o.celdas.map((c) => c.cx)) + o.fx / 2;
  const ey0 = Math.min(...o.celdas.map((c) => c.cy)) - o.fy / 2, ey1 = Math.max(...o.celdas.map((c) => c.cy)) + o.fy / 2;
  const mal = o.aspect > 2;
  const canales = (o.canales ?? []).map((g) =>
    `<line x1="${px(g.x0).toFixed(1)}" y1="${py(g.y0).toFixed(1)}" x2="${px(g.x1).toFixed(1)}" y2="${py(g.y1).toFixed(1)}" stroke="#6db3f2" stroke-width="2" opacity="0.7"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">PLANTA DEL PLANO DE PARTICIÓN</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§4.3.1 · Fig 4.17 (línea = "simple but poor") → 4.18 (rejilla) → 4.20 (híbrido)</text>
<text class="lblSm" x="${PAD}" y="92">ámbar = impresiones · azul = colada · el rectángulo punteado es la ENVOLVENTE que mide el criterio 2:1</text>
<rect x="${px(0)}" y="${py(0)}" width="${(o.baseW * k).toFixed(1)}" height="${(o.baseL * k).toFixed(1)}" fill="#1b2534" stroke="#2c3a50" stroke-width="1.5"/>
${canales}${imp}
<rect x="${px(ex0).toFixed(1)}" y="${py(ey0).toFixed(1)}" width="${((ex1 - ex0) * k).toFixed(1)}" height="${((ey1 - ey0) * k).toFixed(1)}" fill="none" stroke="${mal ? '#ff5c5c' : '#59d98c'}" stroke-width="1.6" stroke-dasharray="6 4"/>
${o.sprue ? `<circle cx="${px(o.sprue.x).toFixed(1)}" cy="${py(o.sprue.y).toFixed(1)}" r="6" fill="none" stroke="#6db3f2" stroke-width="2.2"/>` : ''}
<text class="${mal ? 'mal' : 'ok'}" style="font:700 13.5px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 32}">${mal ? `✗ aspecto ${o.aspect.toFixed(2)}:1 > 2:1 — "large molds significantly under utilized" y feed DESBALANCEADO` : `✓ aspecto ${o.aspect.toFixed(2)}:1 < 2:1 (§4.3.1)`}</text>
<text class="lblSm" x="${PAD}" y="${H - 14}">base ${o.baseW}×${o.baseL} mm · envolvente ${(ex1 - ex0).toFixed(0)}×${(ey1 - ey0).toFixed(0)} · ${o.celdas.length} impresión(es) · ocupación ${(100 * (ex1 - ex0) * (ey1 - ey0) / (o.baseW * o.baseL)).toFixed(0)} % de la base</text>
</svg>`;
  return { id: 'particion', titulo: `Plano de partición — ${o.nombre}`, cita: '§4.3.1 · Fig 4.17-4.20',
    queMirar: '¿la envolvente punteada de las cavidades cabe en 2:1? Un layout en línea es "simple but poor": molde grande desaprovechado, carga estructural que la platina no espera y feed desbalanceado.',
    svg };
}

/**
 * LÁMINA §12.2 — LA PLACA DE SOPORTE: PILARES vs EXPULSORES vs BARRA KO.
 * Del tipo que más vale según el análisis de las 283 figuras: SUPERPONE dos
 * subsistemas. §12.2.3 avisa que un pilar central "will not greatly reduce the
 * deflection" y que suele CHOCAR con el knock-out; y los pilares tienen que
 * caber entre los expulsores. Ninguno de los dos se ve mirando un subsistema.
 */
export function laminaSoporte(o: {
  nombre: string; baseW: number; baseL: number;
  pilares: Array<{ x: number; y: number; d: number }>;
  expulsores: Array<{ x: number; y: number; d: number }>;
  ko?: { x: number; y: number; d: number };
  /** de dónde salen las posiciones de los PILARES. `platesizing` calcula CUÁNTOS
   *  (por masa de acero §12.1.3) pero nadie calcula DÓNDE — si el llamador los
   *  propone, la lámina lo dice: juzgar una colocación inventada como si fuera
   *  del motor sería exactamente la mentira que estas láminas existen para cazar. */
  pilaresPropuestos?: boolean;
}): Lamina {
  const W = 1000, H = 700, PAD = 62, TOP = 100, BOT = 62;
  const k = Math.min((W - 2 * PAD) / o.baseW, (H - TOP - BOT) / o.baseL);
  const px = (x: number) => PAD + x * k, py = (y: number) => TOP + y * k;
  // choques: pilar↔expulsor y pilar↔KO (superficie contra superficie)
  const choques: string[] = [];
  for (const p of o.pilares) {
    for (const e of o.expulsores) {
      const g = Math.hypot(p.x - e.x, p.y - e.y) - p.d / 2 - e.d / 2;
      if (g < 0) choques.push(`pilar@(${p.x.toFixed(0)},${p.y.toFixed(0)}) ∩ expulsor (${g.toFixed(1)} mm)`);
    }
    if (o.ko) {
      const g = Math.hypot(p.x - o.ko.x, p.y - o.ko.y) - p.d / 2 - o.ko.d / 2;
      if (g < 0) choques.push(`pilar@(${p.x.toFixed(0)},${p.y.toFixed(0)}) ∩ barra KO (${g.toFixed(1)} mm)`);
    }
  }
  const hayChoque = choques.length > 0;
  const cen = o.pilares.length === 1;
  const dib = (a: Array<{ x: number; y: number; d: number }>, fill: string, r?: number) => a.map((p) =>
    `<circle cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="${Math.max(3, (r ?? p.d / 2) * k).toFixed(1)}" fill="${fill}" opacity="0.85"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">PLACA DE SOPORTE · pilares vs expulsores vs barra KO</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§12.2.3 — un pilar central "will not greatly reduce the deflection" y CHOCA con el knock-out</text>
<text class="lblSm" x="${PAD}" y="92">gris = pilares · verde = expulsores · azul = barra KO — la vista existe para ver los CHOQUES entre subsistemas</text>
<rect x="${px(0)}" y="${py(0)}" width="${(o.baseW * k).toFixed(1)}" height="${(o.baseL * k).toFixed(1)}" fill="#1b2534" stroke="#2c3a50" stroke-width="1.5"/>
${dib(o.expulsores, '#59d98c')}
${dib(o.pilares, hayChoque ? '#ff5c5c' : '#8fa3bd')}
${o.ko ? `<circle cx="${px(o.ko.x).toFixed(1)}" cy="${py(o.ko.y).toFixed(1)}" r="${Math.max(5, o.ko.d / 2 * k).toFixed(1)}" fill="none" stroke="#6db3f2" stroke-width="2.4"/>` : ''}
<text class="${hayChoque ? 'mal' : cen ? 'warn' : 'ok'}" style="font:700 13.5px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 32}">${hayChoque ? `✗ ${choques.length} CHOQUE(S): ${ESC(choques[0])}` : cen ? '⚠ UN pilar central: §12.2.3 "will not greatly reduce the deflection" (la placa dobla por los costados)' : `✓ ${o.pilares.length} pilares sin chocar con ${o.expulsores.length} expulsores ni con el KO`}</text>
<text class="lblSm" x="${PAD}" y="${H - 16}">${o.pilares.length} pilares ⌀${o.pilares[0]?.d ?? '—'} · ${o.expulsores.length} expulsores ⌀${o.expulsores[0]?.d.toFixed(1) ?? '—'} · barra KO ${o.ko ? `⌀${o.ko.d}` : 'no declarada'}</text>
${o.pilaresPropuestos ? `<text class="warn" style="font:700 11px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 2}">⚠ las POSICIONES de los pilares son una PROPUESTA de esta lámina: platesizing calcula cuántos (§12.1.3) pero nadie calcula dónde — hueco declarado</text>` : ''}
</svg>`;
  return { id: 'soporte', titulo: `Placa de soporte — ${o.nombre}`, cita: '§12.2.3 · Fig 12.9',
    queMirar: '¿algún pilar pisa un expulsor o la barra del knock-out? Es el choque que ninguna de las dos pantallas por separado ve. Y si hay UN solo pilar central: el libro avisa que casi no sirve.',
    svg };
}

/**
 * LÁMINA §2.3.7 — UNDERCUTS Y SUS DIRECCIONES DE JALE (Fig 2.7 · V2.7).
 * "a window in a side wall, an overhang above the bottom wall, a horizontal
 * boss, and a snap finger" — cada región con dirección lateral es una corredera
 * (§11.3.6); una región SELLADA no la alcanza ningún mecanismo.
 */
export function laminaUndercuts(o: {
  nombre: string; Lmm: number; Wmm: number;
  regiones: Array<{ x0: number; x1: number; y0: number; y1: number; volMm3: number; dir: [number, number] | null }>;
  moldable: string;
}): Lamina {
  const W = 1000, H = 660, PAD = 62, TOP = 100, BOT = 62;
  const k = Math.min((W - 2 * PAD) / o.Lmm, (H - TOP - BOT) / o.Wmm);
  const px = (x: number) => PAD + x * k, py = (y: number) => TOP + y * k;
  const selladas = o.regiones.filter((r) => !r.dir).length;
  const cajas = o.regiones.map((r, i) => {
    const col = r.dir ? '#ffb347' : '#ff5c5c';
    const cx = px((r.x0 + r.x1) / 2), cy = py((r.y0 + r.y1) / 2);
    const flecha = r.dir
      ? `<line x1="${cx}" y1="${cy}" x2="${(cx + r.dir[0] * 42).toFixed(1)}" y2="${(cy + r.dir[1] * 42).toFixed(1)}" stroke="${col}" stroke-width="2.4"/>`
        + `<circle cx="${(cx + r.dir[0] * 42).toFixed(1)}" cy="${(cy + r.dir[1] * 42).toFixed(1)}" r="4" fill="${col}"/>` : '';
    return `<rect x="${px(r.x0).toFixed(1)}" y="${py(r.y0).toFixed(1)}" width="${((r.x1 - r.x0) * k).toFixed(1)}" height="${((r.y1 - r.y0) * k).toFixed(1)}" fill="${col}33" stroke="${col}" stroke-width="1.6"/>${flecha}`
      + `<text class="lblSm" x="${px(r.x0).toFixed(1)}" y="${(py(r.y0) - 4).toFixed(1)}">#${i + 1} ${r.volMm3.toFixed(0)} mm³ ${r.dir ? 'corredera' : 'SELLADA'}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">UNDERCUTS · regiones y DIRECCIÓN DE JALE</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§2.3.7 · Fig 2.7 — cada región con flecha es una CORREDERA (§11.3.6); sin flecha, no la alcanza ningún mecanismo</text>
<text class="lblSm" x="${PAD}" y="92">ámbar = venteable lateralmente · rojo = SELLADA (cavidad interna: no moldeable por inyección)</text>
<rect x="${px(0)}" y="${py(0)}" width="${(o.Lmm * k).toFixed(1)}" height="${(o.Wmm * k).toFixed(1)}" fill="#1b2534" stroke="#2c3a50" stroke-width="1.5"/>
${cajas}
<text class="${selladas ? 'mal' : o.regiones.length ? 'warn' : 'ok'}" style="font:700 13.5px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 32}">${selladas ? `✗ ${selladas} región(es) SELLADA(S) — cavidad interna cerrada, NO moldeable por inyección` : o.regiones.length ? `⚠ ${o.regiones.length} undercut(s) ⇒ ${o.regiones.length} mecanismo(s) §11.3.6 — cada uno sube el costo del molde` : '✓ sin undercuts: sale con dos placas'}</text>
<text class="lblSm" x="${PAD}" y="${H - 14}">veredicto DFM: ${ESC(o.moldable)} · el libro: evitarlos por costo salvo que la función sea vital (§2.3.7)</text>
</svg>`;
  return { id: 'undercuts', titulo: `Undercuts — ${o.nombre}`, cita: '§2.3.7 · Fig 2.7',
    queMirar: 'cuenta las regiones: cada una con flecha es una corredera que hay que pagar. Una región SIN flecha está sellada — ningún mecanismo la alcanza y la pieza no se puede inyectar así.',
    svg };
}

/**
 * LÁMINA §4.3.3 — EL MOLDE CONTRA LA MÁQUINA (V4.13, Fig 4.23/4.24).
 * Los DOS extremos reprueban: "If the mold is smaller than [A], then the
 * molding machine platen can not fully close the mold and build clamp tonnage.
 * If the mold is larger than [B], then the mold will not fit between the two
 * platens." Y la planta contra el patrón de tie bars.
 */
export function laminaMaquina(o: {
  nombre: string; maquina: string;
  moldW: number; moldL: number; tieH: number; tieV: number;
  stackMm: number; aperturaMm: number; minDay: number; maxDay: number;
  shotPct: number; clampPct: number;
}): Lamina {
  const W = 1000, H = 680, PAD = 62, TOP = 104;
  // izquierda: planta contra tie bars · derecha: elevación contra daylight
  const kA = Math.min(370 / Math.max(o.tieH, o.moldW), 300 / Math.max(o.tieV, o.moldL));
  const ox = PAD + 30, oy = TOP + 40;
  const cabeH = o.moldW <= o.tieH, cabeV = o.moldL <= o.tieV;
  const need = o.stackMm + o.aperturaMm;
  const cabeDay = need <= o.maxDay, generaTon = o.stackMm >= o.minDay;
  const kB = 300 / Math.max(o.maxDay, need);
  const bx = W / 2 + 90;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">EL MOLDE CONTRA LA MÁQUINA</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)} · ${ESC(o.maquina)}</text>
<text class="cita" x="${PAD}" y="75">§4.3.3 · Fig 4.23 (tie bars) y 4.24 (daylight) — los DOS extremos reprueban</text>
<text class="lbl" style="font:700 12px 'JetBrains Mono',monospace" x="${ox}" y="${TOP + 16}">1 · PLANTA vs BARRAS DE AMARRE</text>
<rect x="${ox}" y="${oy}" width="${(o.tieH * kA).toFixed(1)}" height="${(o.tieV * kA).toFixed(1)}" fill="none" stroke="#6db3f2" stroke-width="2" stroke-dasharray="7 4"/>
<rect x="${ox}" y="${oy}" width="${(o.moldW * kA).toFixed(1)}" height="${(o.moldL * kA).toFixed(1)}" fill="${cabeH && cabeV ? '#2a4a3a' : '#4a2020'}" stroke="${cabeH && cabeV ? '#59d98c' : '#ff5c5c'}" stroke-width="2"/>
<text class="lblSm" x="${ox}" y="${oy + o.tieV * kA + 16}">molde ${o.moldW}×${o.moldL} · barras ${o.tieH}×${o.tieV} mm</text>
<text class="lbl" style="font:700 12px 'JetBrains Mono',monospace" x="${bx}" y="${TOP + 16}">2 · ALTURA vs DAYLIGHT</text>
<line x1="${bx}" y1="${oy}" x2="${bx + 200}" y2="${oy}" stroke="#6db3f2" stroke-width="2"/>
<line x1="${bx}" y1="${(oy + o.maxDay * kB).toFixed(1)}" x2="${bx + 200}" y2="${(oy + o.maxDay * kB).toFixed(1)}" stroke="#6db3f2" stroke-width="2"/>
<text class="lblSm" x="${bx + 205}" y="${(oy + o.maxDay * kB).toFixed(1)}">máx ${o.maxDay}</text>
<line x1="${bx}" y1="${(oy + o.minDay * kB).toFixed(1)}" x2="${bx + 200}" y2="${(oy + o.minDay * kB).toFixed(1)}" stroke="#8fa3bd" stroke-width="1" stroke-dasharray="5 4"/>
<text class="lblSm" x="${bx + 205}" y="${(oy + o.minDay * kB).toFixed(1)}">mín ${o.minDay}</text>
<rect x="${bx + 40}" y="${oy}" width="120" height="${(o.stackMm * kB).toFixed(1)}" fill="${generaTon ? '#2a4a3a' : '#4a2020'}" stroke="${generaTon ? '#59d98c' : '#ff5c5c'}" stroke-width="2"/>
<text class="lblSm" x="${bx + 46}" y="${(oy + o.stackMm * kB / 2).toFixed(1)}">stack ${o.stackMm}</text>
<rect x="${bx + 40}" y="${(oy + o.stackMm * kB).toFixed(1)}" width="120" height="${(o.aperturaMm * kB).toFixed(1)}" fill="none" stroke="#c9a227" stroke-width="1.6" stroke-dasharray="4 3"/>
<text class="lblSm" x="${bx + 46}" y="${(oy + (o.stackMm + o.aperturaMm / 2) * kB).toFixed(1)}">apertura ${o.aperturaMm}</text>
<text class="${!generaTon || !cabeDay || !cabeH || !cabeV ? 'mal' : 'ok'}" style="font:700 13.5px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 48}">${!cabeH || !cabeV ? '✗ NO CABE entre las barras de amarre' : !generaTon ? `✗ stack ${o.stackMm} < daylight MÍNIMO ${o.minDay} — la platina no cierra y NO genera tonelaje` : !cabeDay ? `✗ stack+apertura ${need} > daylight MÁXIMO ${o.maxDay} — no abre para expulsar` : '✓ cabe entre barras, genera tonelaje y abre lo suficiente'}</text>
<text class="lblSm" x="${PAD}" y="${H - 30}">"If the mold is smaller than A … can not fully close the mold and build clamp tonnage. If larger than B … will not fit between the two platens."</text>
<text class="lblSm" x="${PAD}" y="${H - 12}">disparo ${o.shotPct.toFixed(0)} % del barril (ventana cómoda 25-50 %) · cierre ${o.clampPct.toFixed(0)} % · stack+apertura ${need} mm ∈ [${o.minDay}, ${o.maxDay}]</text>
</svg>`;
  return { id: 'maquina', titulo: `Molde vs máquina — ${o.nombre}`, cita: '§4.3.3 · Fig 4.23-4.24',
    queMirar: '¿el rectángulo del molde cabe dentro del punteado de las barras? ¿el stack llega al daylight MÍNIMO (si no, la platina no genera tonelaje) y stack+apertura no pasa el MÁXIMO (si no, no abre para expulsar)?',
    svg };
}

/**
 * LÁMINA §8.2.3 — DETALLE DEL VENTEO EN SECCIÓN (V8.6 Fig 8.6 · V8.8 Fig 8.8).
 * Dos detalles acotados con las cifras LITERALES del libro:
 *   · en el plano de partición: land delgado (h_vent, L=2 mm) → canal de alivio
 *     de 2 mm → salida ⌀3 mm. Falla = land largo o SIN alivio: el aire no sale.
 *   · alrededor del expulsor: holgura diametral 0.13 mm ⇒ venteo 0.065 mm, canal
 *     hasta 3 mm de la cavidad y taper de guía. "Both of these elements should
 *     be present in a good vent design" — LOS DOS, no uno.
 */
export function laminaVenteo(o: {
  nombre: string; hSpecMm: number; hMinMm: number; hMaxMm: number;
  pinDiaMm: number; holguraPinMm: number;
  tabla: { materials: string; glanvill: number; rosato: number; menges: number };
}): Lamina {
  const W = 1000, H = 700, PAD = 62;
  const LAND_L = 2, CANAL = 2, SALIDA = 3;             // mm, LITERALES §8.2.3
  const kx = 150;                                      // px por mm (detalle ampliado)
  const kh = 900;                                      // los espesores son décimas: escala aparte
  const y0 = 250, x0 = PAD + 40;
  const hPx = Math.max(2, o.hSpecMm * kh);
  const largo = o.hSpecMm > o.hMaxMm;                  // el land no puede pasar el máximo
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">DETALLE DEL VENTEO · sección</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§8.2.3 · Fig 8.6 (plano de partición) y Fig 8.8 (alrededor del expulsor)</text>
<text class="lblSm" x="${PAD}" y="92">espesores a escala ×${kh / kx} respecto al largo: son DÉCIMAS de mm contra milímetros</text>

<text class="lbl" style="font:700 12px 'JetBrains Mono',monospace" x="${PAD}" y="140">1 · EN EL PLANO DE PARTICIÓN (Fig 8.6)</text>
<text class="lblSm" x="${PAD}" y="158">land ${LAND_L} mm → canal de alivio ${CANAL} mm → salida ⌀${SALIDA} mm · el ANCHO se hace alto a propósito "for uncertainty in the last area to fill"</text>
<rect x="${x0 - 90}" y="${y0 - 70}" width="90" height="70" fill="#3a2a12" stroke="#c9a227" stroke-width="1.4"/>
<text class="lblSm" x="${x0 - 86}" y="${y0 - 46}">cavidad</text>
<rect x="${x0 - 90}" y="${y0}" width="${90 + LAND_L * kx + CANAL * kx + 80}" height="60" fill="#1b2534" stroke="#2c3a50"/>
<rect x="${x0}" y="${y0 - hPx}" width="${LAND_L * kx}" height="${hPx}" fill="#59d98c"/>
<rect x="${x0 + LAND_L * kx}" y="${y0 - 40}" width="${CANAL * kx}" height="40" fill="#2a4a5a"/>
<rect x="${x0 + (LAND_L + CANAL) * kx}" y="${y0 - 56}" width="70" height="56" fill="#2a4a5a"/>
<line x1="${x0}" y1="${y0 - hPx - 14}" x2="${x0 + LAND_L * kx}" y2="${y0 - hPx - 14}" stroke="#c9a227" stroke-width="1.2"/>
<text class="cita" x="${x0 + 8}" y="${y0 - hPx - 20}">land ${LAND_L} mm · h = ${o.hSpecMm.toFixed(3)} mm</text>
<text class="lblSm" x="${x0 + LAND_L * kx + 8}" y="${y0 - 46}">alivio ${CANAL} mm</text>
<text class="lblSm" x="${x0 + (LAND_L + CANAL) * kx + 4}" y="${y0 - 62}">salida ⌀${SALIDA}</text>

<text class="lbl" style="font:700 12px 'JetBrains Mono',monospace" x="${PAD}" y="430">2 · ALREDEDOR DEL EXPULSOR (Fig 8.8)</text>
<text class="lblSm" x="${PAD}" y="448">holgura diametral ${o.holguraPinMm} mm ⇒ venteo ${(o.holguraPinMm / 2).toFixed(4)} mm por lado · canal hasta 3 mm de la cavidad + taper de guía</text>
<rect x="${PAD + 40}" y="480" width="300" height="26" fill="#3a2a12" stroke="#c9a227" stroke-width="1.2"/>
<text class="lblSm" x="${PAD + 46}" y="498">superficie de cavidad</text>
<rect x="${PAD + 150}" y="506" width="${o.pinDiaMm * 4}" height="120" fill="#5a6b82"/>
<text class="lblSm" x="${PAD + 150 + o.pinDiaMm * 4 + 8}" y="540">pin ⌀${o.pinDiaMm} mm</text>
<line x1="${PAD + 150 - 4}" y1="506" x2="${PAD + 150 - 4}" y2="${506 + 3 * 12}" stroke="#59d98c" stroke-width="3"/>
<line x1="${PAD + 150 + o.pinDiaMm * 4 + 4}" y1="506" x2="${PAD + 150 + o.pinDiaMm * 4 + 4}" y2="${506 + 3 * 12}" stroke="#59d98c" stroke-width="3"/>
<text class="ok" style="font:700 11px 'JetBrains Mono',monospace" x="${PAD + 40}" y="${506 + 3 * 12 + 16}">canal ajustado los primeros 3 mm ✓</text>
<line x1="${PAD + 150 - 10}" y1="${506 + 3 * 12}" x2="${PAD + 150 - 4}" y2="${506 + 3 * 12 + 30}" stroke="#6db3f2" stroke-width="2.4"/>
<line x1="${PAD + 150 + o.pinDiaMm * 4 + 10}" y1="${506 + 3 * 12}" x2="${PAD + 150 + o.pinDiaMm * 4 + 4}" y2="${506 + 3 * 12 + 30}" stroke="#6db3f2" stroke-width="2.4"/>
<text class="lblSm" style="fill:#6db3f2" x="${PAD + 40}" y="${506 + 3 * 12 + 48}">taper de guía para el armado ✓ — "Both of these elements should be present in a good vent design"</text>

<text class="${largo ? 'mal' : 'ok'}" style="font:700 13px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 32}">${largo ? `✗ h ${o.hSpecMm.toFixed(3)} > h_max ${o.hMaxMm.toFixed(3)} mm — REBABA` : `✓ h ${o.hSpecMm.toFixed(3)} mm ∈ [${o.hMinMm.toFixed(3)}, ${o.hMaxMm.toFixed(3)}] · manda el MÁXIMO (§8.2.3), no el mínimo`}</text>
<text class="lblSm" x="${PAD}" y="${H - 14}">Tabla 8.1 para ${ESC(o.tabla.materials)}: Glanvill ${o.tabla.glanvill} / Rosato ${o.tabla.rosato} / Menges ${o.tabla.menges} mm · práctica del libro en partición: arrancar en 0.02 y abrir en el tryout</text>
</svg>`;
  return { id: 'venteo', titulo: `Detalle de venteo — ${o.nombre}`, cita: '§8.2.3 · Fig 8.6 y 8.8',
    queMirar: '¿están LOS DOS elementos? En la partición: land corto + canal de alivio (sin alivio el aire no sale). En el expulsor: canal ajustado los primeros 3 mm + taper de guía. El libro exige ambos, no uno.',
    svg };
}

/**
 * LÁMINA §10.1 — MAPA DE CONTRACCIÓN SOBRE LA PIEZA (V10.3-10.5).
 * La contracción NO es un número: depende de la presión de empaque LOCAL, y la
 * presión cae del gate hacia el final de llenado. Se pinta s(x,y) evaluando el
 * Tait a la presión que sobrevive en cada punto — de ahí sale directo el Δs que
 * dispara el pandeo (Ec. 10.19) y el sesgo steel-safe de §10.2.2 (cavidad hacia
 * MENOS contracción, núcleo hacia MÁS).
 */
export function laminaContraccion(m: {
  nx: number; ny: number; sx: number; sy: number; x0: number; y0: number;
  sPct: Float32Array;                       // contracción local (%) · NaN sin material
}, o: {
  nombre: string; sNomPct: number; sLowPct: number; sHighPct: number;
  umbralPandeo: number; topologia?: string;
}): Lamina {
  const W = 1000, H = 700, PAD = 62, TOP = 100, BOT = 78;
  const k = Math.min((W - 2 * PAD) / (m.nx * m.sx), (H - TOP - BOT) / (m.ny * m.sy));
  // ESCALA FIJA en el rango que el propio paquete declara [low, high] — no
  // percentiles de la pieza: así dos piezas se comparan entre sí.
  const lo = Math.min(o.sLowPct, o.sNomPct), hi = Math.max(o.sHighPct, o.sNomPct);
  const BANDA = ['#2b5f8f', '#3f8fa8', '#59d98c', '#a8b234', '#e8a02a', '#d12f3f'];
  const celdas: string[] = [];
  let sMin = Infinity, sMax = -Infinity;
  for (let j = 0; j < m.ny; j++) for (let i = 0; i < m.nx; i++) {
    const s = m.sPct[j * m.nx + i];
    if (!Number.isFinite(s)) continue;
    sMin = Math.min(sMin, s); sMax = Math.max(sMax, s);
    const u = hi > lo ? (s - lo) / (hi - lo) : 0;
    const b = Math.max(0, Math.min(5, Math.floor(u * 6)));
    celdas.push(`<rect x="${(PAD + i * m.sx * k).toFixed(1)}" y="${(TOP + j * m.sy * k).toFixed(1)}" width="${(m.sx * k + 0.6).toFixed(1)}" height="${(m.sy * k + 0.6).toFixed(1)}" fill="${BANDA[b]}"/>`);
  }
  const ds = (sMax - sMin) / 100;
  const pandea = ds > o.umbralPandeo && o.topologia !== 'marco';
  const leyenda = BANDA.map((c, i) =>
    `<rect x="${PAD + i * 64}" y="${H - 44}" width="64" height="10" fill="${c}"/>`
    + `<text class="lblSm" x="${PAD + i * 64}" y="${H - 48}">${(lo + (hi - lo) * i / 5).toFixed(2)}%</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="36">MAPA DE CONTRACCIÓN · planta</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="56">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="75">§10.1 · la contracción NO es un número: sigue a la presión de empaque, que CAE del gate al final de llenado</text>
<text class="lblSm" x="${PAD}" y="92">escala FIJA en el rango declarado del paquete [${o.sLowPct.toFixed(2)}, ${o.sHighPct.toFixed(2)}] % — no percentiles, para poder comparar piezas</text>
${celdas.join('')}${leyenda}
<text class="${pandea ? 'mal' : 'ok'}" style="font:700 13px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 24}">${pandea ? `✗ Δs ${ds.toFixed(5)} > umbral ${o.umbralPandeo.toFixed(5)} (Ec. 10.19) — el área cerrada PANDEA` : `✓ Δs ${ds.toFixed(5)} vs umbral de pandeo ${o.umbralPandeo.toFixed(5)}${o.topologia === 'marco' ? ' · MARCO: §10.3.1 no aplica' : ''}`}</text>
<text class="lblSm" x="${PAD}" y="${H - 8}">s ∈ [${sMin.toFixed(3)}, ${sMax.toFixed(3)}] % · nominal ${o.sNomPct.toFixed(2)} % · §10.2.2 steel-safe: cavidad hacia MENOS contracción, núcleo hacia MÁS</text>
</svg>`;
  return { id: 'contraccion', titulo: `Mapa de contracción — ${o.nombre}`, cita: '§10.1 · §10.2.2 · Ec. 10.19',
    queMirar: '¿el color es parejo o hay gradiente del gate al borde? Ese Δs es exactamente lo que dispara el pandeo (Ec. 10.19) — y decide si el steel-safe va asimétrico (cavidad −Δ / núcleo +Δ) o constante.',
    svg };
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

/**
 * LÁMINA L21 §4.1.2 · §7.1.3 · §4.1.4 · §11.2.5 — LA PIEZA COMO LA VE EL USUARIO.
 *
 * El libro no da un número para la estética: da un PREDICADO, y lo usa igual en cuatro
 * capítulos — *"locate gates on NON-VISIBLE SURFACES such as underneath a side wall"*
 * (§7.1.3), *"a better location for the parting line is at the bottom of the rim"*
 * (§4.1.2), *"any location… would be acceptable since the entire shelf is hidden from
 * view"* (§4.1.4). Esta lámina lo dibuja: la pieza RENDERIZADA desde la vista de uso,
 * pintada por visibilidad, con cada marca del proceso encima y su veredicto.
 *
 * Se juzga a ojo exactamente como en Fig 7.1: ¿el punto de la compuerta cae sobre la
 * zona clara (a la vista) o sobre la oscura (escondida)?
 */
export function laminaUsuario(r: {
  /** proyección ya resuelta: polígonos 2D en px con su visibilidad y profundidad */
  caras: Array<{ pts: number[]; vis: number; z: number }>;
  ancho: number; alto: number;
  marcas: Array<{
    nombre: string; tipo: string; estado: 'CUMPLE' | 'ADVIERTE' | 'VIOLA';
    puntos: Array<{ x: number; y: number; visible: boolean }>;
  }>;
  vistaNombre: string;
}, o: {
  nombre: string;
  pctVisible: number;
  areaOcultaMm2: number;
  veredictos: Array<{ nombre: string; cita: string; estado: 'CUMPLE' | 'ADVIERTE' | 'VIOLA'; porque: string }>;
  vistasDeclaradas: boolean;
  nVistas: number;
}): Lamina {
  const W = 1080, H = 760, PAD = 44, TOP = 100, COL = 664;
  // pintado de atrás hacia adelante (algoritmo del pintor) — las caras vienen con su z
  const caras = [...r.caras].sort((a, b) => b.z - a.z);
  const cuerpo = caras.map((c) => {
    // OSCURO = escondido al usuario · CLARO = a la vista. Es la única codificación
    // de la lámina: el libro juzga por "¿se ve o no se ve?", nada más.
    const g = Math.round(26 + 150 * c.vis);
    const b = Math.round(34 + 120 * c.vis);
    const col = `rgb(${Math.round(g * 0.86)},${g},${b})`;
    // el stroke del MISMO color cierra la costura entre triángulos: sin él, el
    // antialias deja una rejilla de líneas claras que se lee como textura inexistente
    return `<polygon points="${c.pts.map((v) => v.toFixed(1)).join(' ')}" fill="${col}" stroke="${col}" stroke-width="0.7"/>`;
  }).join('');

  // envoltura de texto a un ancho fijo de columna (SVG no envuelve solo)
  const envolver = (t: string, n: number) => {
    const out: string[] = []; let ln = '';
    for (const p of t.split(' ')) {
      if ((ln + ' ' + p).trim().length > n) { out.push(ln.trim()); ln = p; } else ln += ' ' + p;
    }
    if (ln.trim()) out.push(ln.trim());
    return out;
  };
  const COLOR = { CUMPLE: '#59d98c', ADVIERTE: '#ffb347', VIOLA: '#ff5c5c' };
  const marcas = r.marcas.map((m) => {
    const c = COLOR[m.estado];
    if (m.puntos.length > 2) {
      // LÍNEA (partición, testigo del stripper): el tramo VISIBLE en rojo y grueso,
      // el escondido punteado y tenue — el ojo va directo a lo que el libro castiga
      const seg: string[] = [];
      for (let i = 1; i < m.puntos.length; i++) {
        const a = m.puntos[i - 1], b = m.puntos[i];
        const asoma = a.visible || b.visible;
        seg.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${asoma ? c : '#7d8ea6'}" stroke-width="${asoma ? 3.2 : 1.4}" ${asoma ? '' : 'stroke-dasharray="3 3"'}/>`);
      }
      return seg.join('');
    }
    // PUNTO (compuerta, expulsor): diana, que es como Fig 7.1 marca el gate
    return m.puntos.map((p) =>
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11" fill="none" stroke="${c}" stroke-width="2.6"/>`
      + `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.4" fill="${c}"/>`).join('');
  }).join('');

  const nViola = o.veredictos.filter((v) => v.estado === 'VIOLA').length;
  const nAdv = o.veredictos.filter((v) => v.estado === 'ADVIERTE').length;
  let yy = TOP + 8;
  const filas = o.veredictos.slice(0, 8).map((v) => {
    const c = COLOR[v.estado];
    const ico = v.estado === 'CUMPLE' ? '✓' : v.estado === 'VIOLA' ? '✗' : '⚠';
    const head = envolver(`${ico} ${v.nombre}`, 40).map((l) => {
      const t = `<text class="lbl" style="fill:${c};font-weight:700" x="${COL}" y="${yy}">${ESC(l)}</text>`;
      yy += 15; return t;
    }).join('');
    const cita = `<text class="cita" style="font-size:10.5px" x="${COL}" y="${yy}">${ESC(v.cita)}</text>`;
    yy += 14;
    const cuerpoTxt = envolver(v.porque, 48).map((l) => {
      const t = `<text class="lblSm" x="${COL}" y="${yy}">${ESC(l)}</text>`; yy += 13; return t;
    }).join('');
    yy += 12;
    return head + cita + cuerpoTxt;
  }).join('');

  const nota = o.vistasDeclaradas
    ? `${o.nVistas} vistas de uso DECLARADAS por el cliente`
    : `${o.nVistas} vistas del supuesto de la taza (§4.1.2/§7.1.3) — EXTENSIÓN DECLARADA, no del libro`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${CSS}</style><rect class="bg" width="${W}" height="${H}"/>
<text class="tit" x="${PAD}" y="34">LA PIEZA COMO LA VE EL USUARIO · vista ${ESC(r.vistaNombre)}</text>
<text class="sub" style="font:700 14px 'JetBrains Mono',monospace;fill:#e9eef5" x="${PAD}" y="54">${ESC(o.nombre)}</text>
<text class="cita" x="${PAD}" y="73">§4.1.2 Fig 4.6 · §7.1.3 Fig 7.1 · §4.1.4 Fig 4.11-4.12 · §11.2.5 Fig 11.12</text>
<text class="lblSm" x="${PAD}" y="90">CLARO = a la vista · OSCURO = escondido · línea ROJA GRUESA = tramo de la marca que asoma</text>
<g transform="translate(${PAD},${TOP})">${cuerpo}${marcas}</g>
${filas}
<text class="lblSm" x="${PAD}" y="${H - 40}">${ESC(nota)} · ${o.pctVisible.toFixed(1)} % del área a la vista · ${o.areaOcultaMm2.toFixed(0)} mm² tapados por la propia pieza</text>
<text class="${nViola ? 'mal' : nAdv ? 'warn' : 'ok'}" style="font:700 13.5px 'JetBrains Mono',monospace" x="${PAD}" y="${H - 20}">${nViola
    ? `✗ ${nViola} marca(s) del proceso caen en superficie VISIBLE — vestigio/línea testigo a la vista`
    : nAdv ? `⚠ sin marcas visibles, pero ${nAdv} pide criterio de experto (§11.3.4)`
      : '✓ ninguna marca del proceso cae en superficie visible'}</text>
</svg>`;
  return {
    id: 'usuario', titulo: `La pieza como la ve el usuario — ${o.nombre}`,
    cita: '§4.1.2 · §7.1.3 · §4.1.4 · §11.2.5',
    queMirar: 'mira SOLO las marcas: ¿alguna cae sobre zona CLARA? Un vestigio de compuerta o una línea de partición sobre superficie visible es el defecto que Kazmer llama "unusable" (§4.1.2). Sobre zona oscura, el libro lo aprueba sin más discusión (§4.1.4).',
    svg,
  };
}
