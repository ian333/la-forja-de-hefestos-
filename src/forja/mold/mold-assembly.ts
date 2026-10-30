/**
 * PLANO DE ENSAMBLE DEL MOLDE — cada pieza calculada es una pieza mecánica.
 * ==============================================================================
 * Toma las dimensiones RESUELTAS por los módulos (placas por deflexión, core por
 * §12.3, líneas de agua por §9.2, expulsores por §11.3) y arma la SECCIÓN de
 * ensamble + la LISTA DE MATERIALES (BOM) del molde completo, cada componente
 * trazable a su análisis. Usa el motor de planos (renderAssemblySection) con
 * cajetín ISO 7200. PURO: node-testeable (SVG string).
 */

import { renderAssemblySection, type StackComp, type AssemblyDrawing, type DatosCajetin } from './mold-drawings';

/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * LOS NOMBRES DE LA NORMA (orden K · EL MOLDE EN STEP Y CON NOMBRE ISO, 2026-10-30)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Un nombre por componente, el MISMO en la BOM de la lámina de ensamble y en el STEP del molde. El término inglés es el
 * de ISO 12165:2019 «Tools for moulding — Components of compression and injection moulds and diecasting dies — List of
 * equivalent terms and symbols» (2.ª ed., confirmada 2025), leído en su muestra pública (iTeh, págs. 1–9: Tablas 1–4);
 * `clave` = «T<tabla>·<clave>» de esa norma. La norma ISO del componente es la que la PROPIA tabla de ISO 12165 cita en
 * su columna «Relevant ISO reference» o — buje guía con brida y botadores, cuya referencia no se lee en la muestra — la
 * norma cuyo TÍTULO nombra ese componente; cada número se verificó vigente en el catálogo de iso.org / SCC (URLs en el
 * CIERRE de la orden K). El español es traducción nuestra del término (ISO 12165 no trae español).
 * Lo que la muestra pública NO alcanza (la Tabla 5, expulsión, y los insertos) lleva `fuente: 'Kazmer'` — el término
 * inglés del libro — o el título de la norma ISO del componente (botadores: ISO 6751 / ISO 8694). NUNCA un número de
 * norma inventado: si no está aquí verificado, va sin norma.
 * DESIGNACIÓN: ninguna norma de componente se compró, así que su tabla de medidas y el formato exacto de su designación
 * no se verificaron. La BOM dice «tipo ISO nnnn» (el componente es del tipo que esa norma cubre) y la medida va en la
 * denominación; que esa medida exista en la tabla de la norma o en el catálogo del proveedor lo confirma el taller —
 * regla de Hefestos. Sin números de parte de catálogo (el proveedor de la base no se sabe todavía).
 */
export interface TerminoISO {
  /** denominación en español (traducción nuestra del término de la norma) */
  es: string;
  /** término inglés: de ISO 12165:2019 (fuente 'ISO 12165'), del título de la norma del componente ('ISO <n>') o de Kazmer */
  en: string;
  fuente: 'ISO 12165' | 'ISO 6751' | 'ISO 8694' | 'Kazmer' | '—';
  /** «T1·5» = ISO 12165:2019, Tabla 1, clave 5 (la de la figura de la norma) */
  clave?: string;
  /** la norma ISO del componente (la que cita la columna de referencias de ISO 12165, o la del título) */
  norma?: string;
}
export const TERMINOS_ISO = {
  sujecion:      { es: 'Placa de sujeción', en: 'clamping plate, overhanging without centring recess', fuente: 'ISO 12165', clave: 'T1·2', norma: 'ISO 6753-2' },
  placaA:        { es: 'Placa de molde, lado fijo (placa A)', en: 'cavity plate, fixed half', fuente: 'ISO 12165', clave: 'T1·5', norma: 'ISO 6753-2' },
  placaB:        { es: 'Placa de molde, lado móvil (placa B)', en: 'cavity plate, moving half', fuente: 'ISO 12165', clave: 'T1·6', norma: 'ISO 6753-2' },
  soporte:       { es: 'Placa intermedia (de soporte)', en: 'intermediate plate', fuente: 'ISO 12165', clave: 'T1·7', norma: 'ISO 6753-2' },
  retenedora:    { es: 'Placa retenedora de expulsión', en: 'ejector retainer plate', fuente: 'ISO 12165', clave: 'T1·8', norma: 'ISO 6753-2' },
  expulsora:     { es: 'Placa base de expulsión', en: 'ejector base plate', fuente: 'ISO 12165', clave: 'T1·9', norma: 'ISO 6753-2' },
  riel:          { es: 'Regla del housing (riel)', en: 'riser', fuente: 'ISO 12165', clave: 'T1·10', norma: 'ISO 6753-2' },
  poste:         { es: 'Poste guía', en: 'guide pillar, shouldered', fuente: 'ISO 12165', clave: 'T2·18', norma: 'ISO 8017' },
  buje:          { es: 'Buje guía con brida', en: 'guide bush, headed', fuente: 'ISO 12165', clave: 'T2·22', norma: 'ISO 8018' },
  pilar:         { es: 'Pilar de soporte', en: 'support pillar', fuente: 'ISO 12165', clave: 'T2·29', norma: 'ISO 10073' },
  interlock:     { es: 'Elemento de centrado redondo (interlock)', en: 'locating element, round', fuente: 'ISO 12165', clave: 'T2·31', norma: 'ISO 8406' },
  anillo:        { es: 'Anillo de centrado, lado fijo', en: 'locating ring, fixed half', fuente: 'ISO 12165', clave: 'T2·34', norma: 'ISO 10907-1' },
  tornillo:      { es: 'Tornillo de cabeza cilíndrica', en: 'hexagon socket head cap screw', fuente: 'ISO 12165', clave: 'T2·35', norma: 'ISO 4762' },
  bujeBebedero:  { es: 'Buje del bebedero', en: 'sprue bush', fuente: 'ISO 12165', clave: 'T3·37', norma: 'ISO 10072' },
  tapon:         { es: 'Tapón con hexágono interior', en: 'hexagon socket pipe plug', fuente: 'ISO 12165', clave: 'T4·72' },
  botadorEsc:    { es: 'Botador escalonado', en: 'shouldered ejector pin', fuente: 'ISO 8694', norma: 'ISO 8694' },
  botador:       { es: 'Botador con cabeza cilíndrica', en: 'ejector pin with cylindrical head', fuente: 'ISO 6751', norma: 'ISO 6751' },
  retorno:       { es: 'Pin de retorno', en: 'return pin', fuente: 'Kazmer' },
  insertoCav:    { es: 'Inserto de cavidad', en: 'cavity insert', fuente: 'Kazmer' },
  insertoNuc:    { es: 'Inserto de núcleo (macho)', en: 'core insert', fuente: 'Kazmer' },
  oring:         { es: 'Anillo de sello (O-ring)', en: 'O-ring', fuente: 'Kazmer' },
  baffle:        { es: 'Lámina del baffle', en: 'baffle', fuente: 'Kazmer' },
  lineasAgua:    { es: 'Líneas de agua (barrenos)', en: 'cooling lines', fuente: 'Kazmer' },
  pieza:         { es: 'Pieza moldeada (referencia, plástico)', en: 'moulded part', fuente: '—' },
  colada:        { es: 'Colada fría (referencia, plástico)', en: 'sprue, cold runner', fuente: 'Kazmer' },
} as const satisfies Record<string, TerminoISO>;
export type ClaveTermino = keyof typeof TERMINOS_ISO;
/** «Placa de sujeción (clamping plate, …)» — el renglón de un nombre para el STEP y los rótulos de una sola línea. */
export const nombreISO = (k: ClaveTermino, detalle = ''): string => {
  const t: TerminoISO = TERMINOS_ISO[k];
  return `${t.es}${detalle ? ` ${detalle}` : ''} (${t.en})`;
};
/** «tipo ISO 4762» si la norma del componente está verificada; '' si no hay. (Tipo, no designación: ver arriba.) */
export const normaTipo = (k: ClaveTermino): string => { const t: TerminoISO = TERMINOS_ISO[k]; return t.norma ? `tipo ${t.norma}` : ''; };
/** el renglón ISO de la BOM: denominación (+ medida), término inglés (con † si no es de una norma) y norma del tipo */
export const renglonISO = (k: ClaveTermino, detalle = ''): { es: string; en: string; norma: string } => {
  const t: TerminoISO = TERMINOS_ISO[k];
  return { es: `${t.es}${detalle ? ` ${detalle}` : ''}`, en: `${t.en}${t.fuente === 'Kazmer' || t.fuente === '—' ? ' †' : ''}`, norma: normaTipo(k) };
};
/** Las notas de la BOM que dicen de dónde salen los nombres (van al pie de la tabla, con las del análisis). */
export const NOTAS_BOM_ISO = [
  'Denominación según ISO 12165:2019; entre paréntesis, el término de la norma',
  '(el español es traducción nuestra) · † término de Kazmer, fuera de la norma',
  '«tipo ISO n»: del tipo que cubre esa norma; sin designación: su tabla de',
  'medidas no se verificó — confirmar con el proveedor (regla de Hefestos)',
];

export interface MoldAssemblySpec {
  name: string; code?: string;
  /** resina de la PIEZA (clave de PLASTICS). La necesita el campo térmico para saber si
   *  corre con datos suyos o prestados — y decirlo. Sin ella se asumía ABS en silencio. */
  plastic?: string;
  /** UN VEREDICTO (orden H, 2026-10-29): el bebedero que CORTA la E5 (colada.ts). Con él, el barreno de las láminas sale de
   *  ESTE ⌀ y no de un tercer diseño del sprue (`sprueDesignFromCavity` con el largo del stack de la lámina). */
  bebedero?: { diaTopMm: number; diaBaseMm: number; largoMm: number };
  /** UN VEREDICTO (orden H): el agua que BARRENA la E6 (profundidad de cada familia y el paso REAL de la serpentina B). Con
   *  él la hoja de análisis juzga el acero y no el H/W de diseño del circuito (la E6 sube la línea B y conserva el paso). */
  aguaE6?: { profundidades: Array<{ que: string; hMm: number }>; pasoMm: number; pasoDe: number };
  widthMm: number;                                  // ancho de la base (X en la sección)
  /** FONDO real de la base (Y). Viene de `selectMoldBase` (§4.3) — la base estándar es
   *  RECTANGULAR (p.ej. 296×396) y su segundo lado es un DATO, no una proporción.
   *  Antes `plateDepth` lo fabricaba como widthMm×0.78 y el lmm elegido por el libro se
   *  TIRABA: el embudo salía con base 296×396 y la geometría lo metía en 296×231 → el
   *  inserto de 260 iba al lado corto y dejaba 18 mm de pared → los barrenos rompían el
   *  asiento. Opcional por compatibilidad: los specs a mano caen al 0.78 de siempre. */
  depthMm?: number;
  plates: { bottomClamp: number; ejectorHousing: number; support: number; B: number; A: number; topClamp: number };
  supportPillars?: number;
  /** EL CAJETÍN ISO 7200 (orden K): lo que el cajetín sabe de afuera (propietario legal, el día en que se generó, la pieza).
   *  Lo que no venga se queda con su línea vacía. */
  cajetin?: DatosCajetin;
  // bolsa de cavidad. widthMm = ⌀ (redonda) o extensión X en planta (caja);
  // lenMm = extensión Y en planta (caja); depthMm = profundidad de la bolsa (Z).
  // frameMm/ribs: si la pieza es un MARCO (bezel) — rim de ancho frameMm con `ribs`
  // costillas transversales; los expulsores van en el rim + costillas (no en la ventana).
  /** volMm3 = volumen REAL del sólido cuando se conoce (lo trae la Máquina). El
   *  estimador de cascarón `estPartVolumeCc` se pasa ~27 % en la flanera, y de
   *  ese volumen sale la masa del disparo (Eq 9.10) ⇒ la potencia de agua. */
  cavity: { widthMm: number; depthMm: number; shape?: 'round' | 'rect'; lenMm?: number; wallMm?: number; frameMm?: number; ribs?: number; volMm3?: number };
  /** LÍNEAS DE AGUA. `diaMm`/`plug` NO son una entrada que compita con el motor: son EL ⌀ QUE
   *  `coolingCircuitDesign` ELIGIÓ (lo escribe `packageToAssemblySpec`) — la fuente única del
   *  circuito, para que el BOM, el ensamble, la lámina y el 3D digan el MISMO número
   *  (orden 2026-09-10 EL AGUA DICE DOS COSAS). `tcS`/`runnerVolCc` son lo que el circuito
   *  necesita saber del DISPARO y que el spec no traía: sin ellos la lámina calculaba su t_c
   *  con la pared sola (Eq 9.5) mientras el 3D usaba el máximo §9.2.1 con la colada. */
  cooling: {
    diaMm: number; plug?: string; insetMm: number;
    /** t_c que MANDA (§9.2.1: el máximo sobre todas las secciones, colada incluida), s */
    tcS?: number;
    /** volumen de la colada fría (cc) — Eq 9.10 la suma al disparo */
    runnerVolCc?: number;
  };
  ejectors: {
    type: 'pin' | 'blade' | 'sleeve' | 'stripper'; diaMm: number; count: number;
    /** §11.2.5 Fig 11.11: posiciones POR AGARRE (relativas al centro de la huella,
     *  mm) — de gripEjectorLayout. Sin ellas, el colocador cae a la rejilla. */
    positions?: Array<{ x: number; y: number }>;
    /** LA TABLA DE EYECTORES (orden LOS BOTADORES CON NOMBRE, 2026-09-22 · §11.2.6 · R37): un renglón
     *  por pin, en el MISMO orden que `positions` — su id de GAIA y SU largo (asiento de la cabeza →
     *  su piso real). La BOM, la lámina de la retenedora y el 3D leen ESTA lista, no un «8× ⌀4.763». */
    tabla?: Array<{ id: string; largoMm: number; puntaDiaMm?: number; puntaMm?: number }>;
    /** keyed (§11.2.6) cuando los largos difieren: plano en la cabeza a `planoAlEjeMm` del eje */
    llave?: { planoAlEjeMm: number };
  };
  core: { diaMm?: number; widthMm?: number; material: string };   // ⌀ (cup) o ancho de bloque (marco/bezel)
  cavityMetal: string; baseSteel?: string;
  machine?: string; clampTons?: number;
  // MOVIMIENTO lateral (§11.3.6-8): undercut que exige corredera/core-pull.
  sideAction?: { aProjMm2: number; pMeltMPa: number; strokeMm: number; note?: string; hydraulic?: boolean };
  // ALIMENTACIÓN (§6-7): colada fría (bebedero+canales) vs CALIENTE (manifold+drops).
  feed?: 'cold-2placas' | 'cold-3placas' | 'hot-runner';
  nCav?: number;                                    // nº de cavidades (drops del hot runner)
}

/** Construye la SECCIÓN de ensamble (plano medio) apilando las placas y colocando
 *  core, cavidad, pieza, líneas de agua y expulsores en sus cotas resueltas. */
export function buildMoldStack(s: MoldAssemblySpec): { comps: StackComp[]; partings: Array<{ z: number; label: string }> } {
  const W = s.widthMm, hw = W / 2;
  const p = s.plates;
  // cotas Z (de abajo hacia arriba)
  const z = { bc0: 0, bc1: p.bottomClamp };
  const eh0 = z.bc1, eh1 = eh0 + p.ejectorHousing;
  const su0 = eh1, su1 = su0 + p.support;
  const b0 = su1, b1 = b0 + p.B;
  const a0 = b1, a1 = a0 + p.A;
  const tc0 = a1, tc1 = tc0 + p.topClamp;
  const parting = b1;                                // partición A|B
  const rail = Math.min(35, W * 0.16);               // ancho de riel del housing

  const comps: StackComp[] = [];
  let id = 1;
  const full = (name: string, z0: number, z1: number, material: string): StackComp =>
    ({ id: id++, name, qty: 1, material, rects: [{ x0: -hw, z0, x1: hw, z1 }] });

  // CON NOMBRE ISO (orden K): `name` es el rótulo de la sección (lo leen las pruebas y el globo); `bom` es el renglón de la
  // lista de materiales con el término de ISO 12165 (mismas claves que el STEP: molde-step.ts).
  const conISO = (c: StackComp, k: ClaveTermino, detalle = ''): StackComp => ({ ...c, bom: renglonISO(k, detalle) });
  comps.push(conISO(full('Placa de sujeción inferior', z.bc0, z.bc1, s.baseSteel ?? '1730 (C45)'), 'sujecion', 'inferior'));
  // housing del expulsor: 2 rieles + paquete expulsor flotante en medio
  comps.push(conISO({ id: id++, name: 'Rieles (spacer)', qty: 2, material: s.baseSteel ?? '1730',
    rects: [{ x0: -hw, z0: eh0, x1: -hw + rail, z1: eh1 }, { x0: hw - rail, z0: eh0, x1: hw, z1: eh1 }] }, 'riel'));
  comps.push({ id: id++, name: 'Placa expulsora + retenedora', qty: 1, material: s.baseSteel ?? '1730',
    rects: [{ x0: -hw + rail + 4, z0: eh0 + 4, x1: hw - rail - 4, z1: eh0 + p.ejectorHousing * 0.55 }],
    bom: { es: 'Placa base de expulsión + retenedora (1 + 1)', en: `${TERMINOS_ISO.expulsora.en} · ${TERMINOS_ISO.retenedora.en}`, norma: normaTipo('expulsora') } });
  comps.push(conISO(full('Placa de soporte', su0, su1, s.baseSteel ?? '1730'), 'soporte'));
  comps.push(conISO(full('Placa B (núcleo)', b0, b1, s.cavityMetal), 'placaB'));
  comps.push(conISO(full('Placa A (cavidad)', a0, a1, s.cavityMetal), 'placaA'));
  comps.push(conISO(full('Placa de sujeción superior', tc0, tc1, s.baseSteel ?? '1730'), 'sujecion', 'superior'));

  // REJILLA de cavidades — la sección corta la FILA MEDIA; muestra nCav impresiones
  // (misma lógica que cavityGrid pero centrada en x=0 para evitar import circular).
  const nCav = Math.max(1, s.nCav ?? 1);
  const gnx = Math.max(1, Math.round(Math.sqrt(nCav)));
  const cvw = s.cavity.widthMm / 2;                       // media huella X
  const pitchX = s.cavity.widthMm + Math.max(18, Math.round(s.cavity.widthMm * 0.35));
  const rowXs: number[] = [];
  for (let c = 0; c < gnx; c++) rowXs.push(Math.round(-((gnx - 1) * pitchX) / 2 + c * pitchX));
  const coreName = s.core.widthMm ? 'Inserto de núcleo (marco)' : 'Inserto de núcleo (core)';
  comps.push({ id: id++, name: coreName, qty: nCav, material: s.core.material, bom: renglonISO('insertoNuc'),
    rects: rowXs.map((x) => ({ x0: x - cvw, z0: su1, x1: x + cvw, z1: parting })) });
  comps.push({ id: id++, name: 'PIEZA moldeada (plástico)', qty: nCav, material: s.plastic ?? 'ABS', solid: true, bom: renglonISO('pieza'),
    rects: rowXs.map((x) => ({ x0: x - cvw, z0: parting, x1: x + cvw, z1: parting + s.cavity.depthMm })) });

  // líneas de enfriamiento — DETRÁS de la superficie moldeante (§9.2.5: ~3·⌀), NO
  // dentro de la pieza: las de la CAVIDAD van en A sobre el fondo de la bolsa; las
  // del NÚCLEO en B bajo la partición. Así nunca cruzan el plástico.
  const behind = Math.max(10, Math.round(2.5 * s.cooling.diaMm));
  const zCav = Math.min(parting + s.cavity.depthMm + behind, a0 + p.A * 0.7);   // en placa A, detrás de la cavidad
  const zCore = Math.max(parting - behind, su1 + p.B * 0.3);                    // en placa B, detrás del núcleo
  // (orden K) sin número de parte de catálogo en la BOM: el tapón va por su nombre de la norma, no por el de un proveedor
  const water: StackComp = { id: id++, name: `Líneas de agua ${s.cooling.plug ?? ''}`.trim(), qty: 4, material: `barrenos ⌀${s.cooling.diaMm}`,
    bom: { es: `${TERMINOS_ISO.lineasAgua.es} ⌀${s.cooling.diaMm} + tapones`, en: `${TERMINOS_ISO.lineasAgua.en} † · ${TERMINOS_ISO.tapon.en}`, norma: '' }, rects: [], circles: [
    { x: -s.cooling.insetMm, z: zCav, dia: s.cooling.diaMm, note: '⌀' + s.cooling.diaMm },
    { x: s.cooling.insetMm, z: zCav, dia: s.cooling.diaMm },
    { x: -s.cooling.insetMm, z: zCore, dia: s.cooling.diaMm },
    { x: s.cooling.insetMm, z: zCore, dia: s.cooling.diaMm },
  ] };
  comps.push(water);

  // expulsores (suben del paquete expulsor a la partición) — bajo CADA cavidad
  const er = s.ejectors.diaMm / 2;
  const exRects = rowXs.flatMap((x) => [x - cvw * 0.5, x + cvw * 0.5].map((ex) => ({ x0: ex - er, z0: eh0 + p.ejectorHousing * 0.55, x1: ex + er, z1: parting })));
  // el botador ESCALONADO (punta guiada + cuerpo, R52) es el de ISO 8694; el recto con cabeza, el de ISO 6751 (títulos de esas normas)
  const punta = s.ejectors.tabla?.[0]?.puntaDiaMm;
  const escalonado = punta != null && Math.abs(punta - s.ejectors.diaMm) > 1e-6;
  comps.push({ id: id++, name: `Expulsor (${s.ejectors.type}) ⌀${s.ejectors.diaMm}`, qty: s.ejectors.count, material: '1.2842 templado', rects: exRects,
    bom: s.ejectors.type !== 'pin' ? undefined : escalonado ? renglonISO('botadorEsc', `⌀${punta}/${s.ejectors.diaMm}`) : renglonISO('botador', `⌀${s.ejectors.diaMm}`) });

  // ALIMENTACIÓN (§6-7): colada CALIENTE (manifold + drops rojos) o FRÍA (bebedero).
  const feed = s.feed ?? 'cold-2placas';
  const nc = Math.max(1, s.nCav ?? 1);
  if (feed === 'hot-runner') {
    const zMan0 = tc0 + p.topClamp * 0.2, zMan1 = zMan0 + 14, dropW = 12;
    const dropXs = rowXs;                                  // un drop ALINEADO con cada cavidad de la fila
    const span = rowXs.length > 1 ? rowXs[rowXs.length - 1] - rowXs[0] : 0;
    const manW = Math.min(W * 0.85, span + s.cavity.widthMm + 60);
    comps.push({ id: id++, name: 'Manifold (colada caliente)', qty: 1, material: 'H13 · zonas calef.', tint: '#f3c0b2',
      rects: [{ x0: -manW / 2, z0: zMan0, x1: manW / 2, z1: zMan1 }] });
    comps.push({ id: id++, name: `Boquillas calientes (${nc} drops)`, qty: nc, material: 'H13 · termopar/zona', tint: '#efa48d',
      rects: dropXs.map((x) => ({ x0: x - dropW / 2, z0: parting, x1: x + dropW / 2, z1: zMan0 })) });
  } else {
    // bebedero (sprue) frío al centro, del nozzle a la pieza
    comps.push({ id: id++, name: 'Bebedero (sprue) frío', qty: 1, material: '1.2311', tint: '#e8e2d2', bom: renglonISO('bujeBebedero'),
      rects: [{ x0: -5, z0: parting + s.cavity.depthMm, x1: 5, z1: tc1 - 3 }] });
  }

  // MOVIMIENTO lateral (§11.3.6-8): corredera + talón + perno inclinado (angle pin)
  // en el costado +X, a la altura de la pieza. El perno (fijo al lado A) cama la
  // corredera hacia AFUERA al abrir el molde: por eso su punta baja hacia +X.
  if (s.sideAction) {
    const cvw2 = s.cavity.widthMm / 2, depth = s.cavity.depthMm;
    const slideLen = Math.min(Math.max(28, (hw - cvw2) * 0.5), 60);
    const sx0 = cvw2, sx1 = cvw2 + slideLen, sz0 = parting, sz1 = parting + depth + 4;
    const phi = (20 * Math.PI) / 180, tan = Math.tan(phi);
    const zBot = parting + 4, zTop = tc0 + p.topClamp * 0.7;
    const xBot = cvw2 + slideLen * 0.6, xTop = xBot - (zTop - zBot) * tan;   // arriba más adentro, punta afuera
    comps.push({ id: id++, name: 'Corredera (slide)', qty: 1, material: '1.2312 templado', tint: '#d7e6f7',
      rects: [{ x0: sx0, z0: sz0, x1: sx1, z1: sz1 }],
      lines: [{ x0: xTop, z0: zTop, x1: xBot, z1: zBot, widthMm: 12, note: 'angle pin 20°' }] });
    comps.push({ id: id++, name: 'Talón + gib (heel block)', qty: 1, material: '1.2312 templado', tint: '#e9eff7',
      rects: [{ x0: cvw2 + slideLen * 0.35, z0: sz1, x1: Math.min(sx1 + 10, hw), z1: a1 }] });
  }

  const partings = [{ z: parting, label: 'LÍNEA DE PARTICIÓN A|B' }];
  return { comps, partings };
}

/** Genera el PLANO de ensamble (SVG A3, sección + BOM + notas de análisis). */
export function moldAssemblyDrawing(s: MoldAssemblySpec, extra?: { piezas?: Array<{ nombre: string; cant: number; material: string; en?: string; norma?: string }> }): AssemblyDrawing {
  const { comps, partings } = buildMoldStack(s);
  const notes = [
    `Molde de inyección · base ${s.widthMm} mm · máquina ${s.machine ?? '—'}${s.clampTons ? ` (${s.clampTons.toFixed(0)} t)` : ''}`,
    `Placa de soporte ${s.plates.support} mm${s.supportPillars ? ` + ${s.supportPillars} pilares` : ''} (deflexión < venteo, §12.1)`,
    // (orden K) sin número de parte de catálogo: el agua por su ⌀
    `Núcleo ${s.core.widthMm ? `${s.core.widthMm}mm (marco)` : `⌀${s.core.diaMm}`} ${s.core.material} (hoop/deflexión §12.3) · agua ⌀${s.cooling.diaMm} (§9.2)`,
    `Expulsión ${s.ejectors.count}× ${s.ejectors.type} ⌀${s.ejectors.diaMm} (§11.3)`,
  ];
  // LOS BOTADORES CON NOMBRE (2026-09-22): con la tabla de eyectores la BOM deja de decir «8× ⌀4.763»
  // (ocho pines «iguales» que NO lo son) y lista CADA pin con su id de GAIA y su largo — el renglón que el
  // taller corta y graba. §11.2.6: "key and label each ejector pin"; R37: la tabla de eyectores es entregable.
  const tabla = s.ejectors.tabla;
  const extraBom: string[][] = [];
  if (tabla?.length) {
    const ex = comps.find((c) => /^Expulsor/.test(c.name));
    const base = ex ? ex.id : 0;
    tabla.forEach((f, k) => extraBom.push([`${base}.${k + 1}`, `${f.id} · L ${f.largoMm}`, '1',
      `${f.puntaDiaMm != null ? `⌀${f.puntaDiaMm}/` : '⌀'}${s.ejectors.diaMm}${s.ejectors.llave ? ' · LLAVE' : ''}`]));
    const ls = tabla.map((f) => f.largoMm);
    // dos renglones cortos: la nota se corta en el borde de la hoja A3 (medido en la 1557BGY)
    notes.push(`Tabla de eyectores §11.2.6: ${tabla.length} pines con id · largo ${Math.min(...ls)}–${Math.max(...ls)} mm`);
    notes.push(s.ejectors.llave ? `LLAVE: plano a ${s.ejectors.llave.planoAlEjeMm} mm del eje (regla de Hefestos) · id en cabeza y retenedora` : 'id grabado en la cabeza y junto a su barreno en la retenedora');
  }
  // PIEZAS FUERA DEL PLANO DE CORTE (orden J, 2026-10-29): los pilares de soporte, los postes y los bujes guía viven en el
  // acero (y el 3D los arma) pero la sección A-A no los corta, así que la BOM no los traía — un taller compraría la base sin
  // los 3 pilares que la orden B puso bajo la cavidad. Quien llama (`moldDrawingSet`) los manda con las MISMAS fuentes que el
  // sólido (posiciones colocadas, ⌀ de `guiaNominalMm`/`guideGeom`); aquí solo se numeran a continuación de los componentes.
  (extra?.piezas ?? []).forEach((p, k) => extraBom.push(p.en || p.norma ? [String(comps.length + k + 1), p.nombre, String(p.cant), p.material, p.en ?? '', p.norma ?? '']
    : [String(comps.length + k + 1), p.nombre, String(p.cant), p.material]));
  notes.push(...NOTAS_BOM_ISO);
  return renderAssemblySection(comps, {
    code: s.code ?? 'MLD-001', name: s.name, extra: 'ENSAMBLE · MOLDE DE INYECCIÓN',
    notes, partings, sectionLabel: 'SECCIÓN A-A (plano medio)',
    extraBom: extraBom.length ? extraBom : undefined,
    cajetin: s.cajetin,
  });
}
