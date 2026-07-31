/**
 * CONTRATOS DE SUBSISTEMA — los criterios de aceptación DEL CLIENTE
 * =================================================================
 * Kazmer cierra cada capítulo con una lista de "qué debe cumplir este subsistema
 * antes de congelarlo". Ese es el checklist que él corre a mano y que nosotros
 * nunca implementamos: nuestros gates prueban las ECUACIONES módulo por módulo
 * (y pasan), pero nadie preguntaba si el molde ENSAMBLADO cumple el contrato.
 *
 * Un contrato NO recalcula la física: LEE lo que la Máquina produjo y lo enfrenta
 * contra el límite del libro. Por eso caza una clase de bug que ningún test de
 * módulo ve — el dato que se calcula bien en su casa y llega mal (o no llega) al
 * paquete.
 *
 * LOS CINCO ESTADOS (el diseño importa):
 *   CUMPLE / ADVIERTE / VIOLA  → la Máquina dio el dato y se juzgó.
 *   SIN-CABLEAR → EXISTE módulo verificado que lo calcula, pero el paquete no lo
 *                 trae. El contrato lo calcula aquí para reportar el número y
 *                 deja la deuda anotada. Es el estado más valioso: es el mapa de
 *                 lo que hay que conectar.
 *   SIN-MÓDULO  → nadie lo calcula todavía. Hueco real, dicho en voz alta.
 * Un criterio SIN-CABLEAR o SIN-MÓDULO NUNCA cuenta como aprobado. Un contrato
 * que aprueba en silencio lo que no midió miente igual que un cálculo malo.
 */
import type { MoldPackage } from './moldmachine';
import { designSprueFeed, estPartVolumeCc, FEED_MATERIALS, STANDARD_RUNNER_DIAMM, steelSafeDiaMm } from './feed';
import { ventDesign, VENT_TABLE_MM } from './venting';

export type ContratoEstado = 'CUMPLE' | 'ADVIERTE' | 'VIOLA' | 'SIN-CABLEAR' | 'SIN-MÓDULO';

export interface Criterio {
  /** id estable para gate y UI */
  id: string;
  subsistema: string;
  /** § del libro que EXIGE este criterio */
  cita: string;
  /** el criterio en palabras del cliente */
  criterio: string;
  estado: ContratoEstado;
  /** el número medido y su límite, cuando los hay */
  medido?: number;
  limite?: number;
  unidad?: string;
  /** la frase con los números — lo que se lee en pantalla */
  detalle: string;
  /** para SIN-CABLEAR: qué función ya produce el dato y quién debería consumirlo */
  deuda?: string;
}

export interface ContratoSubsistema {
  subsistema: string;
  criterios: Criterio[];
  cumple: number; advierte: number; viola: number; sinCablear: number; sinModulo: number;
  /** el subsistema se congela SOLO si nada viola y nada quedó sin medir */
  congelable: boolean;
}

export interface ContratoReporte {
  subsistemas: ContratoSubsistema[];
  total: { criterios: number; cumple: number; advierte: number; viola: number; sinCablear: number; sinModulo: number };
  /** % de criterios del cliente que la Máquina CUMPLE hoy (los no medidos cuentan como no cumplidos) */
  score: number;
  lineas: string[];
}

const ok = (c: Omit<Criterio, 'estado'>): Criterio => ({ ...c, estado: 'CUMPLE' });
const warn = (c: Omit<Criterio, 'estado'>): Criterio => ({ ...c, estado: 'ADVIERTE' });
const bad = (c: Omit<Criterio, 'estado'>): Criterio => ({ ...c, estado: 'VIOLA' });

/** Juzga un número contra su límite superior (menor = mejor). */
function juzgaMax(c: Omit<Criterio, 'estado'>, margenAdv = 0.9): Criterio {
  const { medido, limite } = c;
  if (medido == null || limite == null) return { ...c, estado: 'SIN-MÓDULO' };
  if (medido > limite) return bad(c);
  if (medido > limite * margenAdv) return warn(c);
  return ok(c);
}

const num = (v: number, d = 1) => Number.isFinite(v) ? v.toFixed(d) : '—';

/**
 * CONTRATO DEL SISTEMA DE ALIMENTACIÓN — §6.4 "the three goals"
 * Los tres números duros que el cliente exige antes de congelar el feed:
 *   ΔP ≤ min(50 % de la presión de cavidad, 50 MPa)   §6.2.2
 *   V  ≤ 30 % del volumen de cavidades (colada fría)  §6.2.3
 *   NO extender el tiempo de ciclo                    §6.4.7
 * Más los chequeos de flujo (γ̇, Re) y las reglas de catálogo/steel-safe.
 */
export function contratoAlimentacion(pkg: MoldPackage): ContratoSubsistema {
  const S = 'alimentación';
  const C: Criterio[] = [];
  const arch = pkg.recomendacion.arch;
  const frio = arch !== 'hot-runner';
  const nCav = pkg.recomendacion.nCav;
  const fillMPa = pkg.diseno.fillMPa;

  // El paquete NO trae diseño de feed: solo la ETIQUETA de arquitectura y un volumen
  // de runner por proporción (partCc × 0.25). designSprueFeed() sí lo resuelve y está
  // gateado — lo corremos aquí para dar el número y dejar la deuda anotada.
  const plastic = (pkg.spec.plastic ?? 'PP').toUpperCase();
  const mat = FEED_MATERIALS[plastic] ? plastic : 'PP';
  const cav = {
    shape: pkg.spec.cavityShape, widthMm: pkg.spec.Wmm, lenMm: pkg.spec.Lmm,
    depthMm: pkg.spec.Hmm, wallMm: pkg.spec.wallMm,
  };
  const partCc = estPartVolumeCc(cav);
  // El sprue va de la cara de la boquilla al plano de partición = clamp + placa A.
  // SESGO DECLARADO (§3.3.1.3: los estimados conservadores se etiquetan, no se
  // esconden): la Máquina no expone el espesor del clamp en el paquete, así que se
  // asume 25.4 mm (1 in, el estándar de las bases) y se dice en el reporte.
  const CLAMP_ASUMIDO_MM = 25.4;
  const sprueLenMm = pkg.base.plateAmm + CLAMP_ASUMIDO_MM;
  const feed = designSprueFeed({
    material: mat, partVolumeCc: partCc, partWallMm: pkg.spec.wallMm, sprueLenMm,
  });
  const DEUDA_FEED = 'designSprueFeed()/optimizeFeedSystem() en feed.ts ya lo resuelven y están gateados; moldMachine no los llama — cablear a DiseñoFisico.alimentacion';

  // ── 1) ΔP del feed ≤ min(50 % de la cavidad, 50 MPa) — §6.2.2 ──
  const limDP = Math.min(0.5 * fillMPa, 50);
  C.push({
    ...juzgaMax({
      id: 'feed-dp', subsistema: S, cita: '§6.2.2 / §6.4',
      criterio: 'ΔP del sistema de alimentación ≤ min(50 % de la presión de cavidad, 50 MPa)',
      medido: feed.dPMPa, limite: limDP, unidad: 'MPa',
      detalle: `ΔP sprue ${num(feed.dPMPa)} MPa vs límite ${num(limDP)} MPa (50 % de ${num(fillMPa)} MPa de cavidad, tope 50) · sprue L=${num(sprueLenMm)} mm = placa A ${num(pkg.base.plateAmm)} + clamp ${CLAMP_ASUMIDO_MM} ASUMIDO`,
    }),
    estado: feed.dPMPa > limDP ? 'VIOLA' : 'SIN-CABLEAR',
    deuda: DEUDA_FEED,
  });

  // ── 2) Volumen del feed ≤ 30 % de las cavidades (frío) — §6.2.3 ──
  const vCavCc = partCc * nCav;
  const pctReal = (feed.volCc / vCavCc) * 100;
  const limPct = frio ? 30 : 100;
  C.push({
    ...juzgaMax({
      id: 'feed-volumen', subsistema: S, cita: '§6.2.3',
      criterio: frio
        ? 'volumen de colada ≤ 30 % del volumen de cavidades (límite de regrind)'
        : 'colada caliente: el material se renueva cada ciclo (n_turns ≈ 1)',
      medido: pctReal, limite: limPct, unidad: '%',
      detalle: `colada ${num(feed.volCc)} cc vs ${num(vCavCc)} cc de cavidades (${nCav} cav) = ${num(pctReal)} % · límite ${limPct} %`,
    }),
    estado: pctReal > limPct ? 'VIOLA' : 'SIN-CABLEAR',
    deuda: `${DEUDA_FEED}. OJO: moldmachine.ts:269 usa runnerVolumeCc = partCc × 0.25 (proporción FABRICADA, no del libro)`,
  });

  // ── 3) El feed NO extiende el ciclo — §6.4.7 ──
  C.push({
    id: 'feed-ciclo', subsistema: S, cita: '§6.4.7',
    criterio: 'el tiempo de enfriamiento de la colada no debe exceder al de la cavidad',
    medido: feed.tcSprueS, limite: feed.tcPartS, unidad: 's',
    estado: feed.tcSprueS > feed.tcPartS * 1.25 ? 'VIOLA' : (feed.tcSprueS > feed.tcPartS ? 'ADVIERTE' : 'SIN-CABLEAR'),
    detalle: `t_c colada ${num(feed.tcSprueS)} s vs t_c pieza ${num(feed.tcPartS)} s — ${feed.tcSprueS > feed.tcPartS ? 'la colada DOMINA el ciclo: reducir ⌀ (steel-safe)' : 'la pieza manda el ciclo ✓'}`,
    deuda: DEUDA_FEED,
  });

  // ── 4) γ̇ dentro del máximo del material — §7.1.4 / Tabla 7.2 ──
  const shearMax = FEED_MATERIALS[mat].shearMax;
  C.push({
    ...juzgaMax({
      id: 'feed-shear', subsistema: S, cita: '§7.1.4 · Tabla 7.2',
      criterio: 'velocidad de corte en la sección más angosta ≤ máximo del material',
      medido: feed.shear, limite: shearMax, unidad: '1/s',
      detalle: `γ̇ ${Math.round(feed.shear).toLocaleString()} 1/s vs máx ${shearMax.toLocaleString()} 1/s (${mat}, Apéndice A)`,
    }),
    estado: feed.shear > shearMax ? 'VIOLA' : 'SIN-CABLEAR',
    deuda: DEUDA_FEED,
  });

  // ── 5) Flujo laminar — §6.4.3 ──
  C.push({
    id: 'feed-reynolds', subsistema: S, cita: '§6.4.3',
    criterio: 'Re < 2300 (flujo laminar, condición de Hagen-Poiseuille)',
    medido: feed.re, limite: 2300, unidad: '',
    estado: feed.re > 2300 ? 'VIOLA' : 'SIN-CABLEAR',
    detalle: `Re ${feed.re.toExponential(1)} · límite 2300`,
    deuda: DEUDA_FEED,
  });

  // ── 6) Diámetros a catálogo y redondeados HACIA ABAJO (steel-safe) — §6.5.4 / §6.5.5 ──
  const dBase = feed.rBaseMm * 2;
  const dSafe = steelSafeDiaMm(dBase);
  C.push({
    id: 'feed-steel-safe', subsistema: S, cita: '§6.5.4 / §6.5.5',
    criterio: 'diámetros de colada a talla de catálogo, redondeados HACIA ABAJO (se puede abrir en el tryout, no cerrar)',
    medido: dBase, limite: dSafe, unidad: 'mm',
    estado: 'SIN-CABLEAR',
    detalle: `⌀ calculado ${num(dBase, 2)} mm → especificar ${num(dSafe, 2)} mm (catálogo ${STANDARD_RUNNER_DIAMM.join('/')}) — redondear hacia ARRIBA condena el molde a desperdiciar material toda su vida`,
    deuda: 'steelSafeDiaMm() existe en feed.ts; nadie la aplica al construir la geometría de la colada',
  });

  // ── 7) El orificio de la boquilla ROMPE la monotonía — §6.3.1 ──
  C.push({
    id: 'feed-boquilla', subsistema: S, cita: '§6.3.1',
    criterio: 'orificio de la boquilla < entrada del sprue (si se invierte, el sprue se queda en la mitad A)',
    medido: feed.rTopMm * 2, unidad: 'mm',
    estado: 'SIN-MÓDULO',
    detalle: `entrada del sprue ⌀ ${num(feed.rTopMm * 2, 2)} mm — la Máquina no conoce el orificio de la boquilla de la máquina de inyección: no se puede verificar`,
    deuda: 'MachineSelection debería exponer nozzleOrificeMm y el contrato compararlo',
  });

  return resumir(S, C);
}

/**
 * CONTRATO DEL VENTEO — cap 8
 * El cliente es explícito: el venteo se posterga, pero la IGNORANCIA no se
 * perdona (§8.4). El entregable tiene DOS listas: los venteos maquinados y la
 * capacidad reservada para los que se añadirán tras el tryout (§8.1).
 */
export function contratoVenteo(pkg: MoldPackage): ContratoSubsistema {
  const S = 'venteo';
  const C: Criterio[] = [];
  const plastic = (pkg.spec.plastic ?? 'PP').toUpperCase();
  const mat = FEED_MATERIALS[plastic] ? plastic : 'PP';

  // El aire desplazado ≈ el volumen inyectado (§8.2.1). V̇ del llenado:
  const partCc = estPartVolumeCc({
    shape: pkg.spec.cavityShape, widthMm: pkg.spec.Wmm, lenMm: pkg.spec.Lmm,
    depthMm: pkg.spec.Hmm, wallMm: pkg.spec.wallMm,
  });
  const tFillS = 1;                                   // convención de los ejemplos del libro
  const VdotAir = (partCc * 1e-6) / tFillS;           // m³/s — TODO el flujo local (§8.2.3: NO se divide)
  const v = ventDesign({ VdotAirM3s: VdotAir, lM: 0.01, wM: 0.01, lFlashM: 0.2e-3 });

  // ── 1) h_min ≤ h ≤ h_max, y el que manda es el MÁXIMO (rebaba) — §8.2.3 ──
  C.push({
    id: 'vent-espesor', subsistema: S, cita: '§8.2.3',
    criterio: 'espesor del venteo entre el mínimo (deja salir el aire) y el máximo (no rebaba); manda el máximo',
    medido: v.hSpecMm, limite: v.hMaxMm, unidad: 'mm',
    estado: v.feasible ? 'SIN-CABLEAR' : 'VIOLA',
    detalle: `h ∈ [${num(v.hMinMm, 3)}, ${num(v.hMaxMm, 3)}] mm → especificar ${num(v.hSpecMm, 3)} mm ${v.feasible ? '' : '⚠ ventana imposible: se necesitan MÁS venteos y más anchos'}`,
    deuda: 'ventDesign() existe en venting.ts y está gateado; moldMachine NO importa venting.ts — el molde se entrega sin venteo especificado',
  });

  // ── 2) Cada venteo se dimensiona para TODO el flujo local — §8.2.3 ──
  C.push({
    id: 'vent-flujo-completo', subsistema: S, cita: '§8.2.3',
    criterio: 'cada venteo se dimensiona para TODO el flujo local, NUNCA para el flujo dividido entre venteos',
    medido: VdotAir * 1e6, unidad: 'cc/s',
    estado: 'SIN-CABLEAR',
    detalle: `V̇ de aire ${num(VdotAir * 1e6)} cc/s aplicado íntegro a cada venteo (dividirlo entre N NO es conservador: no se sabe dónde cae el final de llenado)`,
    deuda: 'regla implementada en este contrato; falta que el diseñador de venteos la respete cuando exista',
  });

  // ── 3) Práctica del libro: 0.02 mm en partición (steel-safe) — §8.3.1 ──
  const tabla = mat === 'PP' ? VENT_TABLE_MM.lowViscosity : VENT_TABLE_MM.medViscosity;
  C.push({
    id: 'vent-practica', subsistema: S, cita: '§8.3.1',
    criterio: 'venteos en el plano de partición: usarlos con moderación y arrancar en ~0.02 mm; abrir en el tryout si falta',
    medido: 0.02, limite: v.hMaxMm, unidad: 'mm',
    estado: 'SIN-CABLEAR',
    detalle: `práctica 0.02 mm (el cálculo pide ${num(v.hMinMm, 3)} mm mínimo) · Tabla 8.1 para ${tabla.materials}: Glanvill ${tabla.glanvill} / Rosato ${tabla.rosato} / Menges ${tabla.menges} mm — más presión y resina más fluida ⇒ venteo más delgado`,
    deuda: 'VENT_TABLE_MM existe; nadie la consulta al construir el molde',
  });

  // ── 4) Venteo por holgura de expulsores: 0.065 mm A PROPÓSITO — §8.3.2 ──
  C.push({
    id: 'vent-expulsores', subsistema: S, cita: '§8.3.2',
    criterio: 'la holgura del expulsor (0.13 mm diametral → 0.065 mm de venteo) ventea y se autolimpia; es más gruesa que el venteo recomendado a propósito',
    medido: 0.065, unidad: 'mm',
    estado: 'SIN-MÓDULO',
    detalle: 'nadie verifica que la holgura de los pines expulsores esté especificada como venteo (canal hasta 3 mm de la cavidad + cono de guía para el armado)',
    deuda: 'mold-ejection-auto.ts define pines pero no su holgura de venteo ni el canal escalonado',
  });

  // ── 5) Ubicaciones: final de flujo, convergencias, bolsas muertas — §8.2.2 ──
  C.push({
    id: 'vent-ubicaciones', subsistema: S, cita: '§8.2.2',
    criterio: 'venteo en cada final de flujo, en cada convergencia de frentes (knit-line) y en cada bolsa muerta',
    estado: 'SIN-MÓDULO',
    detalle: 'la Máquina no enumera ubicaciones candidatas de venteo (el libro saca ~36 en el bezel y maquina 8)',
    deuda: 'flowlen-mesh/dfm-mesh ya calculan el frente de llenado y las regiones — de ahí salen los candidatos; falta el enumerador + la lista de RESERVADOS',
  });

  // ── 6) Los canales de alivio no chocan con el agua — §8.3.2 ──
  C.push({
    id: 'vent-vs-agua', subsistema: S, cita: '§8.3.2',
    criterio: 'los canales de alivio del venteo no deben cruzar líneas de enfriamiento (el venteo cede el paso al agua)',
    estado: 'SIN-MÓDULO',
    detalle: 'no hay venteos en la geometría, así que el auditor de colisiones no puede verificarlo',
    deuda: 'cuando existan venteos: agregarlos a coordAudit como cuerpos con rango XYZ',
  });

  return resumir(S, C);
}

/**
 * CONTRATO DEL ENFRIAMIENTO — §9.2 (el proceso de 7 pasos) + §9.1.6 (usabilidad)
 * Este es el subsistema que SÍ está cableado: `diseno.enfriamiento.lineas` trae el
 * CoolingLineDesign resuelto. Aquí el contrato juzga datos REALES del paquete —
 * es la prueba de que un contrato no es un mapa de deuda, es un juez.
 */
export function contratoEnfriamiento(pkg: MoldPackage): ContratoSubsistema {
  const S = 'enfriamiento';
  const C: Criterio[] = [];
  const L = pkg.diseno.enfriamiento.lineas;
  const D = L.plug?.diaMm ?? 0;

  // ── 1) Diámetro dentro de la ventana [Dmin, Dmax] — §9.2.4 ──
  C.push({
    id: 'agua-diametro', subsistema: S, cita: '§9.2.4',
    criterio: 'diámetro de línea entre el mínimo (caída de presión) y el máximo (turbulencia)',
    medido: D, unidad: 'mm',
    estado: !L.plug ? 'VIOLA' : (D >= L.dMinMm && D <= L.dMaxMm ? 'CUMPLE' : 'VIOLA'),
    detalle: L.plug
      ? `⌀ ${num(D, 2)} mm ∈ [${num(L.dMinMm, 2)}, ${num(L.dMaxMm, 2)}] mm — plug ${L.plug.dme}`
      : `sin plug de catálogo que caiga en [${num(L.dMinMm, 2)}, ${num(L.dMaxMm, 2)}] mm`,
  });

  // ── 2) El diámetro es de CATÁLOGO (plugs DME), no un óptimo continuo — §9.2.4 ──
  C.push({
    id: 'agua-catalogo', subsistema: S, cita: '§9.2.4 · Tabla 9.2',
    criterio: 'el diámetro debe ser una talla estándar de plug, compatible con el estándar del taller',
    estado: L.plug ? 'CUMPLE' : 'VIOLA',
    detalle: L.plug ? `plug DME ${L.plug.dme} ⌀ ${num(L.plug.diaMm, 2)} mm` : 'ninguna talla de catálogo satisface la ventana',
  });

  // ── 3) Flujo TURBULENTO: Re > 4000 — §9.2.4 ──
  C.push({
    id: 'agua-turbulento', subsistema: S, cita: '§9.2.4',
    criterio: 'Re > 4000 (el flujo laminar no transfiere calor: el agua se estratifica)',
    medido: L.reAtPlug, limite: 4000, unidad: '',
    estado: L.turbulento ? 'CUMPLE' : 'VIOLA',
    detalle: `Re ${Math.round(L.reAtPlug).toLocaleString()} · límite 4000 — ${L.turbulento ? 'turbulento ✓' : 'LAMINAR: el agua no está enfriando'}`,
  });

  // ── 4) Profundidad 2D < H < 5D — §9.2.5 ──
  C.push({
    id: 'agua-profundidad', subsistema: S, cita: '§9.2.5',
    criterio: 'profundidad de la línea entre 2 y 5 diámetros (estructural abajo, térmico arriba)',
    medido: D ? L.depthMm / D : undefined, limite: 5, unidad: '×⌀',
    estado: !D ? 'SIN-MÓDULO' : (L.depthMm >= 2 * D && L.depthMm <= 5 * D ? 'CUMPLE' : 'VIOLA'),
    detalle: D
      ? `H ${num(L.depthMm)} mm = ${num(L.depthMm / D, 2)}×⌀ · ventana [2, 5]×⌀ = [${num(2 * D)}, ${num(5 * D)}] mm`
      : 'sin diámetro no se puede juzgar la profundidad',
  });

  // ── 5) Paso H < W < 2H — §9.2.6 ──
  C.push({
    id: 'agua-paso', subsistema: S, cita: '§9.2.6',
    criterio: 'paso entre líneas entre 1 y 2 veces la profundidad (más allá, la variación de flujo de calor se dispara)',
    medido: L.depthMm ? L.pitchMm / L.depthMm : undefined, limite: 2, unidad: '×H',
    estado: !L.depthMm ? 'SIN-MÓDULO'
      : (L.pitchMm >= L.depthMm && L.pitchMm <= 2 * L.depthMm ? 'CUMPLE' : 'VIOLA'),
    detalle: `paso ${num(L.pitchMm)} mm = ${num(L.pitchMm / (L.depthMm || 1), 2)}×H · ventana [1, 2]×H = [${num(L.depthMm)}, ${num(2 * L.depthMm)}] mm`
      + ' — OJO §9.2.6: un material más conductivo NO autoriza paso más ancho (empeora la uniformidad)',
  });

  // ── 6) El controlador comercial existe y alcanza — §9.2.3 ──
  C.push({
    id: 'agua-controlador', subsistema: S, cita: '§9.2.3 · Tabla 9.1',
    criterio: 'el caudal total debe caber en un controlador comercial real',
    medido: L.totalFlowM3s * 1e3, unidad: 'L/s',
    estado: L.controller ? 'CUMPLE' : 'VIOLA',
    detalle: L.controller
      ? `${L.controller} · ${num(L.flowGPM, 1)} GPM por línea, ${L.nLines} líneas`
      : `ningún controlador de catálogo entrega ${num(L.totalFlowM3s * 1e3, 2)} L/s — se necesitan varios`,
  });

  // ── 7) Usabilidad de taller: ≤2 conexiones por mitad — §9.1.6 ──
  C.push({
    id: 'agua-conexiones', subsistema: S, cita: '§9.1.6',
    criterio: 'máximo 2 conexiones externas por mitad de molde (una entrada, una salida); si hay más, etiquetadas in/out',
    medido: L.nLines, limite: 2, unidad: 'líneas',
    estado: 'SIN-MÓDULO',
    detalle: `${L.nLines} líneas diseñadas, pero la Máquina no modela el MANIFOLD INTERNO (§9.3.1, "very little added cost while delivering both increased performance and ease of use") que las reduciría a 2 conexiones`,
    deuda: 'falta el ruteo de manifold interno + tapones: hoy cada línea es una conexión externa',
  });

  // ── 8) Claro ≥ ½⌀ contra cualquier otro componente — §9.2.7 ──
  C.push({
    id: 'agua-claro', subsistema: S, cita: '§9.2.7',
    criterio: 'al menos medio diámetro de claro entre la línea y CUALQUIER otro componente (estructura + fugas por corrosión)',
    limite: D / 2, unidad: 'mm',
    estado: 'SIN-CABLEAR',
    detalle: `claro exigido ${num(D / 2, 2)} mm contra cavidad, insertos, expulsores, return pins, guías, bushing del sprue y tornillos`,
    deuda: 'coordAudit() en mold-coords.ts ya mide holguras agua↔barreno sobre la geometría; el contrato debe recibir el molde ENSAMBLADO (parts) para juzgarlo aquí — hoy mold-audit-test reporta holguras NEGATIVAS (bezel −2.7 mm) que este criterio debería reflejar',
  });

  // ── 9) t_c: el enfriamiento cumple el ciclo prometido — §9.2.1 ──
  const cicloS = pkg.diseno.enfriamiento.cicloS;
  C.push({
    id: 'agua-ciclo', subsistema: S, cita: '§9.2.1',
    criterio: 'el tiempo de enfriamiento se calcula sobre la sección MÁS GRUESA con criterio de línea central (conservador)',
    medido: cicloS, unidad: 's',
    estado: Number.isFinite(cicloS) && cicloS > 0 ? 'CUMPLE' : 'VIOLA',
    detalle: `ciclo ${num(cicloS)} s · regla de dedo del libro 2·h² = ${num(2 * pkg.spec.wallMm ** 2)} s para pared ${num(pkg.spec.wallMm, 1)} mm`
      + ' — el real será MAYOR: resistencia térmica de contacto + requisitos de calidad (nota 1 §9.2.1)',
  });

  return resumir(S, C);
}

function resumir(subsistema: string, criterios: Criterio[]): ContratoSubsistema {
  const n = (e: ContratoEstado) => criterios.filter((c) => c.estado === e).length;
  const viola = n('VIOLA'), sinCablear = n('SIN-CABLEAR'), sinModulo = n('SIN-MÓDULO');
  return {
    subsistema, criterios,
    cumple: n('CUMPLE'), advierte: n('ADVIERTE'), viola, sinCablear, sinModulo,
    congelable: viola === 0 && sinCablear === 0 && sinModulo === 0,
  };
}

const ICON: Record<ContratoEstado, string> = {
  'CUMPLE': '✓', 'ADVIERTE': '⚠', 'VIOLA': '✗', 'SIN-CABLEAR': '🔌', 'SIN-MÓDULO': '∅',
};

/** Corre TODOS los contratos disponibles sobre un paquete y arma el reporte. */
export function contratos(pkg: MoldPackage): ContratoReporte {
  const subsistemas = [contratoAlimentacion(pkg), contratoVenteo(pkg), contratoEnfriamiento(pkg)];
  const t = { criterios: 0, cumple: 0, advierte: 0, viola: 0, sinCablear: 0, sinModulo: 0 };
  for (const s of subsistemas) {
    t.criterios += s.criterios.length; t.cumple += s.cumple; t.advierte += s.advierte;
    t.viola += s.viola; t.sinCablear += s.sinCablear; t.sinModulo += s.sinModulo;
  }
  const score = t.criterios ? Math.round((t.cumple / t.criterios) * 100) : 0;

  const lineas: string[] = [
    '═══ CONTRATOS DE SUBSISTEMA — criterios de aceptación de Kazmer ═══',
    `pieza: ${pkg.spec.name} · ${pkg.recomendacion.arch} × ${pkg.recomendacion.nCav} cav`,
    '',
  ];
  for (const s of subsistemas) {
    lineas.push(`── ${s.subsistema.toUpperCase()} — ${s.congelable ? 'CONGELABLE ✓' : 'NO congelable'} (${s.cumple}✓ ${s.advierte}⚠ ${s.viola}✗ ${s.sinCablear}🔌 ${s.sinModulo}∅)`);
    for (const c of s.criterios) {
      lineas.push(`  ${ICON[c.estado]} [${c.cita}] ${c.criterio}`);
      lineas.push(`      ${c.detalle}`);
      if (c.deuda) lineas.push(`      ↳ deuda: ${c.deuda}`);
    }
    lineas.push('');
  }
  lineas.push(`SCORE contra el cliente: ${score}/100 (${t.cumple}/${t.criterios} criterios cumplidos)`);
  lineas.push(`🔌 ${t.sinCablear} calculables HOY pero no cableados · ∅ ${t.sinModulo} sin módulo · ✗ ${t.viola} violados`);
  return { subsistemas, total: t, score, lineas };
}
