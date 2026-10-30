/**
 * TAMAÑO DE MÁQUINA — selección de inyectora comercial (Kazmer §4.3.3 + cap 5 +
 * cap 11). El capstone del sistema: consume las salidas del LLENADO (fuerza de
 * cierre, presión de inyección) y de la EXPULSIÓN (fuerza de expulsión) y resuelve
 * la máquina MÍNIMA de catálogo que aguanta las CUATRO restricciones acopladas:
 *
 *   1. CIERRE (Eq 5.29): F_clamp = P_cavidad · A_proyectada · SF   → tonelaje
 *   2. SHOT (§4.3.3): V_shot = V_pieza·n + V_colada, entre 25-50 % del barril
 *      (bajo → residencia larga/degradación; alto → fundido no homogéneo)
 *   3. PRESIÓN DE INYECCIÓN: la máquina debe entregar la P de llenado · SF
 *   4. EXPULSIÓN (cap 11): la máquina provee ~2 % del clamp como fuerza de
 *      expulsión; debe superar la F_eject del vector de expulsión
 *
 * Verificado contra el libro: cup → clamp 400 kN (≈41 t) / F_eject 1.8 kN;
 * bezel → clamp 1400 kN (≈143 t) / F_eject 4.7 kN (≈0.5 % del clamp, p.269).
 * PURO: node-testeable.
 */

import { clampMetricTons } from './filling';
import { daylightNeededMm } from './threeplate';

export const TON_METRIC_N = 9806.65;      // 1 tonelada métrica (el libro, cap 4/5)

export interface InjectionMachine {
  name: string;
  clampTons: number;                       // fuerza de cierre (t métricas)
  shotCc: number;                          // capacidad máx de shot (cc, GPPS-equiv)
  maxInjPressureMPa: number;               // presión de inyección máx en boquilla
  /** tasa de plastificación (g/s, GPPS). OPCIONAL: el catálogo FCS no la publica y hoy ninguna
   *  restricción de §4.3.3 la usa; una máquina real sin el dato lo deja `undefined`, no lo inventa. */
  plasticizeGs?: number;
  tieHmm: number; tieVmm: number;          // luz entre columnas
  minDaylightMm: number; maxDaylightMm: number;
  ejectionForceKN: number;                 // fuerza de expulsión provista (~2 % clamp)
  /** §6.3.1: orificio de boquilla (mm). 4.0 mm típico para nozzles estándar. */
  nozzleOrificeMm?: number;
  /** §6.3.1: radio de la punta de la boquilla (mm) — «the nozzle of the molding machine mates with the radius of the
   *  sprue bushing». Solo lo trae una máquina de la ficha de la planta (orden 2026-10-29-g); el libro no da número. */
  nozzleRadiusMm?: number;
  /** la máquina viene de la ficha de la planta (no del catálogo de referencia ni del taller) */
  dePlanta?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * LA FICHA DE TU PLANTA (orden 2026-10-29-g · LOS DATOS DE TU PLANTA)
 * ═══════════════════════════════════════════════════════════════════════════════
 * ian (2026-10-24): «descarga y configura todos sus datos». La planta que compra moldes captura UNA vez sus tarifas por
 * centro, sus inyectoras (lo que §4.3.3 pide medir: tonelaje, luz entre columnas, daylight mínimo y máximo de la Fig 4.24,
 * disparo) con su boquilla (§6.3.1: radio y orificio) y su resina. Vive en SU navegador (localStorage) y en un archivo que
 * ella descarga y sube; nada de esto viaja a nuestro servidor. Lo que no captura queda SIN DATO y la pantalla lo dice —
 * aquí no hay un solo número de relleno.
 */
export interface InyectoraDeLaPlanta {
  nombre: string;
  /** fuerza de cierre (t métricas) */
  tonelajeT?: number;
  /** luz entre columnas, horizontal × vertical (mm) — §4.3.3 «easily measurable on an available molding machine» */
  barrasHmm?: number; barrasVmm?: number;
  /** Fig 4.24: el molde más DELGADO que cierra (A) y el más ALTO que cabe con la platina abierta (B), en mm */
  daylightMinMm?: number; daylightMaxMm?: number;
  /** capacidad de disparo (cm³) */
  disparoCc?: number;
  /** §6.3.1: la punta de la boquilla — radio y orificio (mm) */
  boquillaRadioMm?: number; boquillaOrificioMm?: number;
  /** opcionales: presión máxima de inyección (MPa) y fuerza de expulsión (kN) — sin ellas esos dos criterios no se juzgan */
  presionMaxMPa?: number; expulsionKN?: number;
}
/** tarifas por centro de trabajo (MXN por hora facturada) */
export interface TarifasDeLaPlanta { fresadoMXNh?: number; edmMXNh?: number; bancoMXNh?: number; ingenieriaMXNh?: number }
export interface FichaDeLaPlanta {
  formato: 'la-forja/planta'; version: 1;
  nombre?: string;
  tarifas: TarifasDeLaPlanta;
  inyectoras: InyectoraDeLaPlanta[];
  /** §4.3.3: «the maximum mold width, INCLUDING cooling plugs, hot runner connectors, etc.» — cuánto sobresalen TUS conectores
   *  de agua por cada lado del molde (mm). Sin el dato, la luz entre columnas se juzga con la base sola y se dice. */
  conectoresMm?: number;
  /** la resina que más corres (clave de la ficha de Kazmer, Apéndice A) — la que el intake propone para una pieza nueva */
  resina?: string;
}
/** la ficha vacía: sin tarifas, sin inyectoras (la app funciona como hoy y lo dice) */
export const FICHA_PLANTA_VACIA: FichaDeLaPlanta = { formato: 'la-forja/planta', version: 1, tarifas: {}, inyectoras: [] };

const finito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
/** ¿La ficha trae algo que cambie el cálculo? (tarifas o inyectoras) */
export function plantaConDatos(p?: FichaDeLaPlanta | null): boolean {
  return !!p && (Object.values(p.tarifas ?? {}).some((v) => finito(v) && v > 0) || (p.inyectoras ?? []).length > 0);
}
/** Lee y VALIDA un archivo de planta (lo que suba el usuario o lo que haya en localStorage). Números ≤ 0 o no numéricos se
 *  descartan (quedan sin dato) — nunca se rellenan. Devuelve null si no es un archivo de planta. */
export function leeFichaDeLaPlanta(x: unknown): FichaDeLaPlanta | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (o.formato !== 'la-forja/planta') return null;
  const pos = (v: unknown) => (finito(v) && v > 0 ? v : undefined);
  const t = (o.tarifas ?? {}) as Record<string, unknown>;
  const tarifas: TarifasDeLaPlanta = {
    fresadoMXNh: pos(t.fresadoMXNh), edmMXNh: pos(t.edmMXNh), bancoMXNh: pos(t.bancoMXNh), ingenieriaMXNh: pos(t.ingenieriaMXNh),
  };
  const inyectoras: InyectoraDeLaPlanta[] = (Array.isArray(o.inyectoras) ? o.inyectoras : []).flatMap((r) => {
    if (!r || typeof r !== 'object') return [];
    const i = r as Record<string, unknown>;
    const nombre = typeof i.nombre === 'string' && i.nombre.trim() ? i.nombre.trim().slice(0, 60) : '';
    if (!nombre) return [];
    return [{
      nombre, tonelajeT: pos(i.tonelajeT), barrasHmm: pos(i.barrasHmm), barrasVmm: pos(i.barrasVmm),
      daylightMinMm: pos(i.daylightMinMm), daylightMaxMm: pos(i.daylightMaxMm), disparoCc: pos(i.disparoCc),
      boquillaRadioMm: pos(i.boquillaRadioMm), boquillaOrificioMm: pos(i.boquillaOrificioMm),
      presionMaxMPa: pos(i.presionMaxMPa), expulsionKN: pos(i.expulsionKN),
    }];
  });
  return {
    formato: 'la-forja/planta', version: 1,
    nombre: typeof o.nombre === 'string' ? o.nombre.slice(0, 80) : undefined,
    tarifas, inyectoras, conectoresMm: pos(o.conectoresMm),
    resina: typeof o.resina === 'string' && o.resina.trim() ? o.resina.trim().slice(0, 40) : undefined,
  };
}
/** Una inyectora de la ficha como máquina del motor. Lo que falta va como NaN: `juzgarMaquina` lo dice «sin dato» (los
 *  criterios DUROS — tonelaje, columnas, daylight máximo, disparo — sin dato NO pasan; presión y expulsión se avisan). */
export function maquinaDeLaPlanta(i: InyectoraDeLaPlanta): InjectionMachine {
  const v = (x?: number) => (finito(x) ? x : NaN);
  return {
    name: `${i.nombre} (tu planta)`, dePlanta: true,
    clampTons: v(i.tonelajeT), shotCc: v(i.disparoCc), maxInjPressureMPa: v(i.presionMaxMPa),
    tieHmm: v(i.barrasHmm), tieVmm: v(i.barrasVmm), minDaylightMm: v(i.daylightMinMm), maxDaylightMm: v(i.daylightMaxMm),
    ejectionForceKN: v(i.expulsionKN), nozzleOrificeMm: finito(i.boquillaOrificioMm) ? i.boquillaOrificioMm : undefined,
    nozzleRadiusMm: finito(i.boquillaRadioMm) ? i.boquillaRadioMm : undefined,
  };
}
/** La inyectora del taller como renglón de la ficha (para el botón «usar la del taller»): solo lo que su catálogo publica. */
export function inyectoraDelTaller(): InyectoraDeLaPlanta {
  const m = MAQUINA_DEL_TALLER;
  return { nombre: m.name.replace(/ \(taller\)$/, ''), tonelajeT: m.clampTons, barrasHmm: m.tieHmm, barrasVmm: m.tieVmm,
    daylightMinMm: m.minDaylightMm, daylightMaxMm: m.maxDaylightMm, disparoCc: m.shotCc, presionMaxMPa: m.maxInjPressureMPa, expulsionKN: m.ejectionForceKN };
}

/**
 * Catálogo de inyectoras comerciales (clase 50-500 t + la HM320 del libro). Cifras
 * representativas de máquinas hidráulicas de tornillo típicas LATAM; la expulsión
 * ≈ 2 % del clamp (survey del libro §11.2.2).
 */
export const INJECTION_MACHINES: InjectionMachine[] = [
  // nozzleOrificeMm: puntas de boquilla en tallas COMERCIALES (1/8"=3.2, 5/32"=4.0,
  // 3/16"=4.8, 1/4"=6.4), representativas por clase de tonelaje como el resto de la
  // fila. Son INTERCAMBIABLES en máquina: si §6.3.1 reprueba (boquilla ≥ sprue), la
  // salida práctica es especificar una punta menor, no rediseñar el molde.
  { name: 'IM-50',  clampTons: 50,  shotCc: 63,   maxInjPressureMPa: 210, plasticizeGs: 12, tieHmm: 310, tieVmm: 310, minDaylightMm: 150, maxDaylightMm: 420, ejectionForceKN: 9.8, nozzleOrificeMm: 3.2 },
  { name: 'IM-90',  clampTons: 90,  shotCc: 130,  maxInjPressureMPa: 210, plasticizeGs: 20, tieHmm: 360, tieVmm: 360, minDaylightMm: 180, maxDaylightMm: 500, ejectionForceKN: 17.7, nozzleOrificeMm: 4.0 },
  { name: 'IM-150', clampTons: 150, shotCc: 280,  maxInjPressureMPa: 200, plasticizeGs: 33, tieHmm: 460, tieVmm: 460, minDaylightMm: 220, maxDaylightMm: 600, ejectionForceKN: 29.4, nozzleOrificeMm: 4.0 },
  { name: 'IM-250', clampTons: 250, shotCc: 510,  maxInjPressureMPa: 200, plasticizeGs: 52, tieHmm: 570, tieVmm: 570, minDaylightMm: 280, maxDaylightMm: 720, ejectionForceKN: 49.0, nozzleOrificeMm: 4.8 },
  { name: 'Battenfeld HM320 (libro)', clampTons: 326, shotCc: 490, maxInjPressureMPa: 200, plasticizeGs: 60, tieHmm: 800, tieVmm: 630, minDaylightMm: 350, maxDaylightMm: 800, ejectionForceKN: 64, nozzleOrificeMm: 4.8 },
  { name: 'IM-350', clampTons: 350, shotCc: 900,  maxInjPressureMPa: 190, plasticizeGs: 70, tieHmm: 660, tieVmm: 660, minDaylightMm: 320, maxDaylightMm: 820, ejectionForceKN: 68.6, nozzleOrificeMm: 4.8 },
  { name: 'IM-500', clampTons: 500, shotCc: 1400, maxInjPressureMPa: 180, plasticizeGs: 95, tieHmm: 810, tieVmm: 810, minDaylightMm: 380, maxDaylightMm: 950, ejectionForceKN: 98.1, nozzleOrificeMm: 6.4 },
];

/**
 * LA INYECTORA DEL TALLER (ian, 2026-09-08: «todos los datos de la forja serán ahora con datos de
 * este bebé»): FCS HT-150SV, 2022, sin placa de datos legible. CADA cifra sale del catálogo oficial
 * FCS "Servo Power-Saving Injection Molding Machine (HT Series)" 2022 (pp. 9–12, columna HT-150,
 * distribuido por Mitchell Industries) CRUZADO con la brochure "HT-SV Series" 2016 (p. 10, columna
 * HT-150SV, IMM Technical). Coinciden en clamp, tornillos, shot, molde, platina y expulsión; difieren
 * en tie bars (462 vs 460), velocidad y motor — se anota. Tabla completa, fuentes con hash y lo que
 * está SIN DATO en `docs/MAQUINA-DEL-TALLER.md`. Lo que el catálogo no trae NO se rellena.
 */
export const MAQUINA_DEL_TALLER: InjectionMachine = {
  name: 'FCS HT-150SV (taller)',
  clampTons: 150,                 // 閉模力 150 tonf (= 1 471 kN)
  shotCc: 304,                    // tornillo B ⌀44 mm: 304 cm³ · A ⌀40: 251 · C ⌀50: 393 — CONFIRMAR cuál trae
  maxInjPressureMPa: 178.7,       // 1 822 kgf/cm² (B) · A 2 205 · C 1 411 (catálogo 2022; tipo II en 2016)
  tieHmm: 462, tieVmm: 462,       // 大柱內距 462×462 (2022) · la brochure 2016 dice 460×460
  minDaylightMm: 130,             // 模厚 130~550 mm
  maxDaylightMm: 1010,            // 550 + carrera de cierre 460 = 1 010 mm de molde ABIERTO
  ejectionForceKN: 39.2,          // 頂出力 4.0 tonf · carrera 110 mm
  // plasticizeGs: SIN DATO (el catálogo publica tasa de inyección, no de plastificación)
  // nozzleOrificeMm: SIN DATO — medir la punta instalada (§6.3.1 la juzga si existe)
};

export interface MachineRequirements {
  clampNeedTons: number;                   // Eq 5.29 · SF
  shotNeedCc: number;                      // V_pieza·n + V_colada
  injPressureNeedMPa: number;              // P_llenado · SF
  ejectionNeedKN: number;                  // del vector de expulsión
  clampKN: number; ejectPctOfClamp: number;
}

/** RESUELVE los cuatro requerimientos físicos que la máquina debe satisfacer. */
export function machineRequirements(o: {
  projectedAreaM2: number; cavityPressureMPa: number;   // cierre (Eq 5.29)
  partVolumeCc: number; nCav: number; runnerVolumeCc?: number;  // shot
  fillPressureMPa: number;                              // presión de inyección
  ejectionForceN: number;                               // del vector (cap 11)
  clampSF?: number; pressureSF?: number;
}): MachineRequirements {
  const clampSF = o.clampSF ?? 1.1;                      // 10 % de margen (§4.3.3)
  const pSF = o.pressureSF ?? 1.15;
  const clampNeedTons = clampMetricTons(o.cavityPressureMPa * 1e6, o.projectedAreaM2) * clampSF;
  const clampKN = clampNeedTons * TON_METRIC_N / 1000;
  const shotNeedCc = o.partVolumeCc * o.nCav + (o.runnerVolumeCc ?? 0);
  const ejectKN = o.ejectionForceN / 1000;
  return {
    clampNeedTons, shotNeedCc,
    injPressureNeedMPa: o.fillPressureMPa * pSF,
    ejectionNeedKN: ejectKN, clampKN,
    ejectPctOfClamp: 100 * ejectKN / clampKN,
  };
}

export interface MachineSelection {
  machine: InjectionMachine | null;
  ok: boolean;
  governs: 'cierre' | 'shot' | 'presión' | 'expulsión' | 'ajuste' | null;
  shotPct: number;                         // % del barril usado
  clampUtilPct: number;                    // % del clamp usado
  checks: { cierre: boolean; shotVentana: boolean; presion: boolean; expulsion: boolean; ajuste: boolean };
  issues: string[];
  /** LA CARRERA, EN NÚMEROS (§6.3.2) — para pintarla en pantalla y en el plano.
   *  Mientras esto no se veía, el punto ciego del daylight vivió sin que nadie lo notara. */
  apertura: { strokeMm: number; stackMm: number; needMm: number; holguraMm: number };
  /** LA MÁQUINA DEL TALLER, siempre juzgada (2026-09-08): si `ok`, `machine` ES ella; si no, `issues`
   *  dice POR QUÉ la pieza no cabe en la que está en el piso (y `machine` es lo que pediría el mercado).
   *  `null` solo cuando se pide explícitamente sin taller (ejercicios del libro). */
  taller: { machine: InjectionMachine; ok: boolean; issues: string[] } | null;
  /** LAS INYECTORAS DE TU PLANTA (orden 2026-10-29-g): cada una juzgada con lo que falla y lo que solo avisa. `null` cuando
   *  la ficha no trae inyectoras (entonces manda el taller y el catálogo de referencia, como antes). */
  planta?: Array<{ nombre: string; pasa: boolean; fallas: string[]; avisos: string[] }> | null;
}

/** Juzga UNA máquina: las cuatro restricciones de §4.3.3 + el ajuste (columnas y daylight del molde
 *  ABIERTO, §6.3.2). Devuelve qué pasa, y en palabras QUÉ falla y QUÉ solo advierte. */
function juzgarMaquina(
  m: InjectionMachine, req: MachineRequirements,
  mold: { wmm: number; lmm: number; stackMm: number; openStrokeMm: number }, needMm: number,
  /** solo para las máquinas de la ficha de la planta (orden 2026-10-29-g): cuánto sobresalen los conectores del agua */
  plugs?: { conectoresMm?: number },
) {
  // SIN DATO (orden 2026-10-29-g): una inyectora de la ficha puede no traer un número. Los criterios DUROS de §4.3.3
  // (tonelaje, columnas, daylight máximo, disparo) sin dato NO pasan — no se aprueba lo que no se midió; presión y
  // expulsión sin dato se AVISAN y no se juzgan. Las máquinas del taller y del catálogo traen todo: nada cambia para ellas.
  const sd = (x: number) => !Number.isFinite(x);
  const sinDato: string[] = [];
  const cierre = !sd(m.clampTons) && m.clampTons >= req.clampNeedTons;
  const shotPct = 100 * req.shotNeedCc / m.shotCc;
  // ventana IDEAL 25-50 % (§4.3.3); pero <25 % es solo advertencia de residencia,
  // no fallo. El gate DURO es que el barril alcance el shot con cojín (≤85 %).
  const shotFits = shotPct <= 85;
  const shotVentana = shotPct >= 25 && shotPct <= 50;
  const presion = sd(m.maxInjPressureMPa) || m.maxInjPressureMPa >= req.injPressureNeedMPa;
  const expulsion = sd(m.ejectionForceKN) || m.ejectionForceKN >= req.ejectionNeedKN;
  // ajuste DURO: cabe entre columnas y el daylight traga el molde ABIERTO
  // (stack + carrera, §6.3.2) — NO el cerrado. Estar por debajo del daylight
  // mínimo es solo advertencia (se agregan risers), no fallo.
  const baseMedida = Number.isFinite(mold.wmm) && Number.isFinite(mold.lmm);
  // §4.3.3 «the maximum mold width, INCLUDING cooling plugs, hot runner connectors, etc.»: con la ficha de la planta se suman
  // sus conectores por los DOS lados y en las DOS direcciones (no sabemos por qué cara salen: regla de Hefestos, del lado seguro).
  const extra = plugs && Number.isFinite(plugs.conectoresMm) ? 2 * (plugs.conectoresMm as number) : 0;
  const anchoW = mold.wmm + extra, anchoL = mold.lmm + extra;
  const columnas = anchoW <= m.tieHmm && anchoL <= m.tieVmm;   // NaN → false: sin base medida (o sin luz medida) no cabe (y se dice)
  const daylight = needMm <= m.maxDaylightMm;
  const ajuste = columnas && daylight;
  const fallas: string[] = [];
  if (sd(m.clampTons)) fallas.push('tonelaje: sin dato — captúralo en tu planta');
  else if (!cierre) fallas.push(`clamp ${req.clampNeedTons.toFixed(0)} t > ${m.clampTons} t`);
  if (sd(m.shotCc)) fallas.push('disparo: sin dato — captura los cm³ de tu unidad de inyección');
  else if (!shotFits) fallas.push(`shot ${shotPct.toFixed(0)} % > 85 % del barril (${m.shotCc} cc)`);
  if (!presion) fallas.push(`presión ${req.injPressureNeedMPa.toFixed(0)} MPa > ${m.maxInjPressureMPa} MPa`);
  if (!expulsion) fallas.push(`expulsión ${req.ejectionNeedKN.toFixed(1)} kN > ${m.ejectionForceKN} kN`);
  const conPlugs = extra > 0 ? ` (+ ${(extra / 2).toFixed(0)} mm de conectores por lado = ${anchoW.toFixed(0)}×${anchoL.toFixed(0)}, §4.3.3)` : '';
  if (!baseMedida) fallas.push('columnas sin juzgar: no hay base estándar medida (molde CUSTOM §4.3.4)');
  else if (sd(m.tieHmm) || sd(m.tieVmm)) fallas.push('columnas: sin dato — mide la luz entre barras de tu máquina (§4.3.3)');
  else if (!columnas) fallas.push(`base ${mold.wmm.toFixed(0)}×${mold.lmm.toFixed(0)} mm${conPlugs} no pasa entre columnas ${m.tieHmm}×${m.tieVmm}`);
  if (sd(m.maxDaylightMm)) fallas.push('daylight máximo: sin dato — captura el molde más alto que abre tu máquina (Fig 4.24, cota B)');
  else if (!daylight) fallas.push(`molde abierto ${needMm.toFixed(0)} mm > daylight ${m.maxDaylightMm} mm (§6.3.2)`);
  const avisos: string[] = [];
  if (sd(m.maxInjPressureMPa)) sinDato.push(`presión de inyección: tu máquina no la declara — no se juzga (pide ${req.injPressureNeedMPa.toFixed(0)} MPa)`);
  if (sd(m.ejectionForceKN)) sinDato.push(`fuerza de expulsión: tu máquina no la declara — no se juzga (pide ${req.ejectionNeedKN.toFixed(1)} kN)`);
  if (sd(m.minDaylightMm)) sinDato.push(`daylight mínimo: sin dato — no sé si tu máquina cierra un molde de ${mold.stackMm.toFixed(0)} mm (Fig 4.24, cota A)`);
  if (plugs && extra === 0) sinDato.push('columnas juzgadas con la base sola: §4.3.3 pide contar los conectores del agua — captura cuánto sobresalen los tuyos');
  if (!sd(m.shotCc) && shotPct < 25) avisos.push(`shot ${shotPct.toFixed(0)}% < 25%: barril grande para la pieza → subir cavidades o máquina más chica`);
  if (mold.stackMm < m.minDaylightMm) avisos.push(`stack ${mold.stackMm.toFixed(0)} < daylight mín ${m.minDaylightMm}: agregar risers`);
  avisos.push(...sinDato);
  return { pasa: cierre && shotFits && presion && expulsion && ajuste, cierre, shotPct, shotVentana, presion, expulsion, ajuste, fallas, avisos };
}

/**
 * Selecciona la inyectora. PRIMERO la del taller (2026-09-08): si la pieza cabe en la FCS HT-150SV
 * que está en el piso, ESA es la máquina — aunque el mercado tenga una más chica. Si no cabe, se dice
 * POR QUÉ (clamp, shot, presión, expulsión, columnas, daylight) y se busca la MÍNIMA del mercado
 * (menor tonelaje) que satisface las cuatro restricciones + el ajuste. Reporta QUÉ restricción manda
 * el tamaño (para saber si conviene rediseñar: menos cavidades, colada fría, etc).
 */
export function selectInjectionMachine(
  req: MachineRequirements,
  /** `openStrokeMm` = carrera de apertura — **la manda `carreraDeApertura` (threeplate.ts)**,
   *  la MISMA función que mueve el 3D y dibuja la lámina L5: 2.5 × altura de pieza (§6.3.2)
   *  MÁS el bebedero que sale con ella (el mismo § pide que la carrera alcance para *"the
   *  removal of the feed system"*). Con `moldOpeningStrokeMm` pelado el daylight se juzgaba
   *  con una carrera que no saca la colada — en las 4 piezas del plan de inspección el
   *  bebedero medía 58-87 mm, más que la pieza entera.
   *  OBLIGATORIO: sin él el daylight se juzgaba con el molde CERRADO y aprobaba
   *  máquinas que no lo pueden abrir (barrido: 25 casos, hasta 92 mm de faltante). */
  mold: { wmm: number; lmm: number; stackMm: number; openStrokeMm: number },
  catalog: InjectionMachine[] = INJECTION_MACHINES,
  /** la máquina del taller; `null` = ejercicio de libro, solo mercado. */
  taller: InjectionMachine | null = MAQUINA_DEL_TALLER,
  /** LAS INYECTORAS DE TU PLANTA (orden 2026-10-29-g): si la ficha trae inyectoras, se elige SOLO entre ellas (ni el taller
   *  ni el catálogo de referencia entran) y los conectores del agua cuentan en la luz entre columnas (§4.3.3). */
  planta?: { inyectoras: InyectoraDeLaPlanta[]; conectoresMm?: number } | null,
): MachineSelection {
  // el daylight tiene que tragar el molde ABIERTO (Tabla 6.1: 264 + 75 = 339).
  const needMm = daylightNeededMm(mold.stackMm, mold.openStrokeMm);
  if (planta && planta.inyectoras.length) return seleccionEnLaPlanta(req, mold, needMm, planta);
  const sorted = [...catalog].sort((a, b) => a.clampTons - b.clampTons);
  const arma = (m: InjectionMachine, ev: ReturnType<typeof juzgarMaquina>, ok: boolean, governs: MachineSelection['governs'], issues: string[], t: MachineSelection['taller']): MachineSelection => ({
    machine: m, ok, governs,
    shotPct: +ev.shotPct.toFixed(1), clampUtilPct: +(100 * req.clampNeedTons / m.clampTons).toFixed(1),
    checks: { cierre: ev.cierre, shotVentana: ev.shotVentana, presion: ev.presion, expulsion: ev.expulsion, ajuste: ev.ajuste }, issues,
    apertura: {
      strokeMm: mold.openStrokeMm, stackMm: mold.stackMm, needMm,
      holguraMm: +(m.maxDaylightMm - needMm).toFixed(1),
    },
    taller: t,
  });

  // 1) LA DEL TALLER: si cabe, es ella. Sus avisos (shot chico, risers) son avisos, no vetos.
  const evT = taller ? juzgarMaquina(taller, req, mold, needMm) : null;
  const tallerInfo: MachineSelection['taller'] = taller && evT ? { machine: taller, ok: evT.pasa, issues: evT.pasa ? evT.avisos : evT.fallas } : null;
  if (taller && evT && evT.pasa) return arma(taller, evT, true, 'cierre', evT.avisos, tallerInfo);
  const noCabe = taller && evT ? `no cabe en la ${taller.name}: ${evT.fallas.join(' · ')}` : null;

  // 2) EL MERCADO: la mínima que cumple
  for (const m of sorted) {
    const ev = juzgarMaquina(m, req, mold, needMm);
    if (ev.pasa) return arma(m, ev, true, 'cierre', [...(noCabe ? [`${noCabe} → en el mercado: ${m.name}`] : []), ...ev.avisos], tallerInfo);
  }

  // 3) ninguna calza: reportar la más grande y QUÉ falló (para diagnosticar el rediseño)
  const big = sorted[sorted.length - 1];
  const shotPct = 100 * req.shotNeedCc / big.shotCc;
  const checks = {
    cierre: big.clampTons >= req.clampNeedTons,
    shotVentana: shotPct >= 25 && shotPct <= 50,
    presion: big.maxInjPressureMPa >= req.injPressureNeedMPa,
    expulsion: big.ejectionForceKN >= req.ejectionNeedKN,
    // el ajuste es columnas + daylight del molde ABIERTO (antes: `big.wmm ? false : …`
    // — campo inexistente en InjectionMachine, siempre caía al else y NUNCA miró el daylight).
    ajuste: big.tieHmm >= mold.wmm && big.tieVmm >= mold.lmm && needMm <= big.maxDaylightMm,
  };
  const issues: string[] = noCabe ? [noCabe] : [];
  // ⚠ EL FALLO DE COLUMNAS ERA MUDO (2026-08-07). `ajuste` son DOS cosas —caber entre
  // columnas y abrir dentro del daylight— y solo la segunda se reportaba. Medido con un
  // vaso ⌀90×100: base 696×996 mm contra columnas de 810×810 de la máquina más grande ⇒
  // `governs: 'ajuste'`, `ok: false`… y el único issue listado era "shot 9 % < 25 %".
  // Quien leyera el veredicto concluía que el problema era el barril.
  // `selectMoldBase` marca "no hay base estándar" con wmm/lmm = NaN (§4.3.4). Sin base
  // medida no se puede juzgar el ajuste: se dice ESO, no "no pasa entre columnas".
  const baseMedida = Number.isFinite(mold.wmm) && Number.isFinite(mold.lmm);
  if (!baseMedida) issues.push(`columnas: SIN JUZGAR — no hay base estándar para este envolvente, el molde es CUSTOM (§4.3.4) y no hay huella que comparar contra las tie bars`);
  else if (!(big.tieHmm >= mold.wmm && big.tieVmm >= mold.lmm)) issues.push(`columnas: base ${mold.wmm.toFixed(0)}×${mold.lmm.toFixed(0)} mm no pasa entre las tie bars de ${big.tieHmm}×${big.tieVmm} mm de la ${big.name} (§4.3.3) → girar 90°, menos cavidades o base custom`);
  if (needMm > big.maxDaylightMm) issues.push(`daylight: stack ${mold.stackMm.toFixed(0)} + carrera ${mold.openStrokeMm.toFixed(0)} = ${needMm.toFixed(0)} mm > ${big.maxDaylightMm} mm de la ${big.name}: el molde CIERRA pero no ABRE (§6.3.2) → molde más compacto o pieza menos honda`);
  if (!checks.cierre) issues.push(`clamp requerido ${req.clampNeedTons.toFixed(0)} t > ${big.clampTons} t (máquina más grande): dividir en 2 moldes o menos cavidades`);
  if (shotPct < 25) issues.push(`shot ${shotPct.toFixed(0)}% < 25%: barril muy grande → residencia larga`);
  if (shotPct > 50) issues.push(`shot ${shotPct.toFixed(0)}% > 50% del barril máximo: fundido no homogéneo`);
  if (!checks.presion) issues.push(`presión ${req.injPressureNeedMPa.toFixed(0)} MPa > ${big.maxInjPressureMPa}: pared más gruesa o material más fluido`);
  if (!checks.expulsion) issues.push(`expulsión ${req.ejectionNeedKN.toFixed(1)} kN > ${big.ejectionForceKN} kN provista`);
  const governs = !checks.cierre ? 'cierre' : shotPct > 50 ? 'shot' : !checks.presion ? 'presión' : !checks.expulsion ? 'expulsión' : 'ajuste';
  return {
    machine: big, ok: false, governs,
    shotPct: +shotPct.toFixed(1), clampUtilPct: +(100 * req.clampNeedTons / big.clampTons).toFixed(1),
    checks, issues,
    apertura: {
      strokeMm: mold.openStrokeMm, stackMm: mold.stackMm, needMm,
      holguraMm: +(big.maxDaylightMm - needMm).toFixed(1),
    },
    taller: tallerInfo,
  };
}

/**
 * LA SELECCIÓN EN TU PLANTA (orden 2026-10-29-g) — §4.3.3 contra CADA inyectora de la ficha: cierre, disparo, columnas con
 * los conectores del agua, daylight del molde abierto (§6.3.2) y, si los declaraste, presión y expulsión. Gana la MÁS CHICA
 * que pasa (§4.3.3: «if the molding machine provides too much tonnage to a very undersized mold, however, the mold may be
 * damaged») — la misma regla que el mercado de referencia. Si ninguna pasa, `ok: false` y `issues` dice, máquina por máquina,
 * QUÉ criterio falla; `machine` queda en la más grande para que la hoja tenga contra qué dibujar.
 */
function seleccionEnLaPlanta(
  req: MachineRequirements, mold: { wmm: number; lmm: number; stackMm: number; openStrokeMm: number }, needMm: number,
  planta: { inyectoras: InyectoraDeLaPlanta[]; conectoresMm?: number },
): MachineSelection {
  const ton = (m: InjectionMachine) => (Number.isFinite(m.clampTons) ? m.clampTons : Infinity);
  const juicios = planta.inyectoras.map(maquinaDeLaPlanta).sort((a, b) => ton(a) - ton(b))
    .map((m) => ({ m, ev: juzgarMaquina(m, req, mold, needMm, { conectoresMm: planta.conectoresMm }) }));
  const lista = juicios.map(({ m, ev }) => ({ nombre: m.name, pasa: ev.pasa, fallas: ev.fallas, avisos: ev.avisos }));
  const gana = juicios.find((j) => j.ev.pasa);
  const grande = juicios.reduce((a, b) => ((Number.isFinite(b.m.clampTons) ? b.m.clampTons : -1) > (Number.isFinite(a.m.clampTons) ? a.m.clampTons : -1) ? b : a));
  const { m, ev } = gana ?? grande;
  const issues = gana
    ? ev.avisos
    : [`ninguna de tus inyectoras admite este molde (§4.3.3): ${juicios.map(({ m: q, ev: e }) => `${q.name}: ${e.fallas.join(' · ')}`).join(' — ')}`];
  const governs: MachineSelection['governs'] = gana ? 'cierre'
    : !ev.cierre ? 'cierre' : !(ev.shotPct <= 85) ? 'shot' : !ev.presion ? 'presión' : !ev.expulsion ? 'expulsión' : 'ajuste';
  return {
    machine: m, ok: !!gana, governs,
    shotPct: +ev.shotPct.toFixed(1), clampUtilPct: +(100 * req.clampNeedTons / m.clampTons).toFixed(1),
    checks: { cierre: ev.cierre, shotVentana: ev.shotVentana, presion: ev.presion, expulsion: ev.expulsion, ajuste: ev.ajuste },
    issues,
    apertura: { strokeMm: mold.openStrokeMm, stackMm: mold.stackMm, needMm, holguraMm: +(m.maxDaylightMm - needMm).toFixed(1) },
    taller: null,
    planta: lista,
  };
}
