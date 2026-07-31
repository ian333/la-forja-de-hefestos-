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
 *                 trae. Se reporta con la deuda anotada (qué función lo produce y
 *                 quién debería consumirla). Es el mapa de lo que falta conectar
 *                 — así se cablearon alimentación y venteo (§6.4 y cap 8).
 *   SIN-MÓDULO  → nadie lo calcula todavía. Hueco real, dicho en voz alta.
 * Un criterio SIN-CABLEAR o SIN-MÓDULO NUNCA cuenta como aprobado. Un contrato
 * que aprueba en silencio lo que no midió miente igual que un cálculo malo.
 */
import type { MoldPackage } from './moldmachine';
import { estPartVolumeCc, FEED_MATERIALS, STANDARD_RUNNER_DIAMM, steelSafeDiaMm } from './feed';
import { VENT_TABLE_MM } from './venting';

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

  // La Máquina YA diseña el feed como lazo (§6.4) — el contrato JUZGA su salida, no
  // la recalcula. Un contrato que recalcula se estaría auditando a sí mismo.
  const feed = pkg.diseno.alimentacion;
  const plastic = (pkg.spec.plastic ?? 'PP').toUpperCase();
  const mat = FEED_MATERIALS[plastic] ? plastic : 'PP';
  const partCc = estPartVolumeCc({
    shape: pkg.spec.cavityShape, widthMm: pkg.spec.Wmm, lenMm: pkg.spec.Lmm,
    depthMm: pkg.spec.Hmm, wallMm: pkg.spec.wallMm,
  });

  // ── 1) ΔP del feed ≤ min(50 % de la cavidad, 50 MPa) — §6.2.2 ──
  const limDP = Math.min(0.5 * fillMPa, 50);
  C.push({
    ...juzgaMax({
      id: 'feed-dp', subsistema: S, cita: '§6.2.2 / §6.4',
      criterio: 'ΔP del sistema de alimentación ≤ min(50 % de la presión de cavidad, 50 MPa)',
      medido: feed.dPMPa, limite: limDP, unidad: 'MPa',
      detalle: `ΔP sprue ${num(feed.dPMPa)} MPa vs límite ${num(limDP)} MPa (50 % de ${num(fillMPa)} MPa de cavidad, tope 50) · ⌀${num(feed.diaBaseMm, 2)} mm, sprue L=${num(feed.sprueLenMm)} mm`,
    }),
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
  });

  // ── 3) El feed NO extiende el ciclo — §6.4.7 ──
  C.push({
    id: 'feed-ciclo', subsistema: S, cita: '§6.4.7',
    criterio: 'el tiempo de enfriamiento de la colada no debe exceder al de la cavidad',
    medido: feed.tcSprueS, limite: feed.tcPartS, unidad: 's',
    estado: feed.tcSprueS > feed.tcPartS * 1.25 ? 'VIOLA' : (feed.tcSprueS > feed.tcPartS ? 'ADVIERTE' : 'CUMPLE'),
    detalle: `t_c colada ${num(feed.tcSprueS)} s vs t_c pieza ${num(feed.tcPartS)} s — ${feed.tcSprueS > feed.tcPartS ? 'la colada DOMINA el ciclo: reducir ⌀ (steel-safe)' : 'la pieza manda el ciclo ✓'} · el lazo §6.4.7 corrió ${feed.iteraciones.length} paso(s)`,
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
  });

  // ── 5) Flujo laminar — §6.4.3 ──
  C.push({
    id: 'feed-reynolds', subsistema: S, cita: '§6.4.3',
    criterio: 'Re < 2300 (flujo laminar, condición de Hagen-Poiseuille)',
    medido: feed.re, limite: 2300, unidad: '',
    estado: feed.re > 2300 ? 'VIOLA' : 'CUMPLE',
    detalle: `Re ${feed.re.toExponential(1)} · límite 2300`,
  });

  // ── 6) Diámetros a catálogo y redondeados HACIA ABAJO (steel-safe) — §6.5.4 / §6.5.5 ──
  const dBase = feed.diaBaseMm;
  const enCatalogo = STANDARD_RUNNER_DIAMM.includes(dBase);
  C.push({
    id: 'feed-steel-safe', subsistema: S, cita: '§6.5.4 / §6.5.5',
    criterio: 'diámetros de colada a talla de catálogo, redondeados HACIA ABAJO (se puede abrir en el tryout, no cerrar)',
    medido: dBase, limite: steelSafeDiaMm(dBase), unidad: 'mm',
    estado: enCatalogo ? 'CUMPLE' : 'ADVIERTE',
    detalle: enCatalogo
      ? `⌀ ${num(dBase, 2)} mm es talla de catálogo (${STANDARD_RUNNER_DIAMM.join('/')}) y el lazo bajó desde ${num(feed.iteraciones[0].diaBaseMm, 2)} mm`
      : `⌀ ${num(dBase, 2)} mm fuera de catálogo — la Máquina lo declara: ${feed.iteraciones[0].accion}`,
  });

  // ── 7) El orificio de la boquilla ROMPE la monotonía — §6.3.1 ──
  C.push({
    id: 'feed-boquilla', subsistema: S, cita: '§6.3.1',
    criterio: 'orificio de la boquilla < entrada del sprue (si se invierte, el sprue se queda en la mitad A)',
    medido: feed.diaTopMm, unidad: 'mm',
    estado: 'SIN-MÓDULO',
    detalle: `entrada del sprue ⌀ ${num(feed.diaTopMm, 2)} mm — la Máquina no conoce el orificio de la boquilla de la inyectora: no se puede verificar`,
    deuda: 'MachineSelection debería exponer nozzleOrificeMm y el contrato compararlo',
  });

  // ── 8) El LAZO del libro: ¿convergió o hay conflicto que arbitrar? — §6.4.7 / §1.2 ──
  C.push({
    id: 'feed-lazo', subsistema: S, cita: '§6.4.7 · §1.2',
    criterio: 'el lazo de diseño del feed converge, o el conflicto se reporta para que lo arbitre el humano',
    estado: feed.conflicto ? 'ADVIERTE' : 'CUMPLE',
    detalle: feed.conflicto
      ? `CONFLICTO ABIERTO — ${feed.conflicto}`
      : `el lazo convergió en ${feed.iteraciones.length} paso(s): ${feed.iteraciones.map((i) => `⌀${num(i.diaBaseMm, 2)}`).join(' → ')}`,
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

  // La Máquina ya diseña el venteo (cap 8) — el contrato juzga su salida.
  const v = pkg.diseno.venteo;
  const partCc = estPartVolumeCc({
    shape: pkg.spec.cavityShape, widthMm: pkg.spec.Wmm, lenMm: pkg.spec.Lmm,
    depthMm: pkg.spec.Hmm, wallMm: pkg.spec.wallMm,
  });
  const VdotAir = (partCc * 1e-6) / 1;                // §8.2.1: el aire ≈ el volumen inyectado

  // ── 1) h_min ≤ h ≤ h_max, y el que manda es el MÁXIMO (rebaba) — §8.2.3 ──
  C.push({
    id: 'vent-espesor', subsistema: S, cita: '§8.2.3',
    criterio: 'espesor del venteo entre el mínimo (deja salir el aire) y el máximo (no rebaba); manda el máximo',
    medido: v.hSpecMm, limite: v.hMaxMm, unidad: 'mm',
    estado: v.feasible ? 'CUMPLE' : 'VIOLA',
    detalle: `h ∈ [${num(v.hMinMm, 3)}, ${num(v.hMaxMm, 3)}] mm → especificar ${num(v.hSpecMm, 3)} mm ${v.feasible ? '(manda el MÁXIMO, no el mínimo §8.2.3)' : '⚠ ventana imposible: se necesitan MÁS venteos y más anchos'}`,
  });

  // ── 2) Cada venteo se dimensiona para TODO el flujo local — §8.2.3 ──
  C.push({
    id: 'vent-flujo-completo', subsistema: S, cita: '§8.2.3',
    criterio: 'cada venteo se dimensiona para TODO el flujo local, NUNCA para el flujo dividido entre venteos',
    medido: VdotAir * 1e6, unidad: 'cc/s',
    estado: 'CUMPLE',
    detalle: `V̇ de aire ${num(VdotAir * 1e6)} cc/s aplicado íntegro a cada venteo (dividirlo entre N NO es conservador: no se sabe dónde cae el final de llenado)`,
  });

  // ── 3) Práctica del libro: 0.02 mm en partición (steel-safe) — §8.3.1 ──
  const tabla = mat === 'PP' ? VENT_TABLE_MM.lowViscosity : VENT_TABLE_MM.medViscosity;
  C.push({
    id: 'vent-practica', subsistema: S, cita: '§8.3.1',
    criterio: 'venteos en el plano de partición: usarlos con moderación y arrancar en ~0.02 mm; abrir en el tryout si falta',
    medido: 0.02, limite: v.hMaxMm, unidad: 'mm',
    estado: 0.02 <= v.hMaxMm ? 'CUMPLE' : 'VIOLA',
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

/**
 * CONTRATO DE LA EXPULSIÓN — cap 11 (§11.1 objetivos + §11.2 el proceso de 6 pasos)
 * El libro es explícito en dos cosas que un optimizador rompe: el análisis YA es
 * conservador (§11.2.2 "without the use of safety factors") y lo que sale del
 * cálculo es un LÍMITE INFERIOR, no un diseño (§11.2.4).
 */
export function contratoExpulsion(pkg: MoldPackage): ContratoSubsistema {
  const S = 'expulsión';
  const C: Criterio[] = [];
  const e = pkg.diseno.expulsion;
  const v = e.vector, pines = e.pines;
  const clampTons = pkg.variantes.find((x) => x.arch === pkg.recomendacion.arch && x.nCav === pkg.recomendacion.nCav)?.clampTons ?? 0;

  // ── 1) F_eject validada contra la capacidad de la máquina — §11.2.2 ──
  // El libro valida por orden de magnitud: la expulsión de la máquina ≈ 2 % del
  // tonelaje de cierre, y sus estimaciones caen ~0.5 %. Fuera de esa banda el
  // número es sospechoso aunque la fórmula esté bien.
  const clampForceN = clampTons * 9806.65;
  const pctClamp = clampForceN > 0 ? (v.fEjectN / clampForceN) * 100 : NaN;
  C.push({
    id: 'eject-fuerza', subsistema: S, cita: '§11.2.2',
    criterio: 'la fuerza de expulsión debe caber en la de la máquina (≈2 % del tonelaje) y caer en el orden del libro (~0.5 %)',
    medido: pctClamp, limite: 2, unidad: '% del clamp',
    estado: !Number.isFinite(pctClamp) ? 'SIN-MÓDULO' : (pctClamp > 2 ? 'VIOLA' : 'CUMPLE'),
    detalle: `F_eject ${num(v.fEjectN, 0)} N = ${num(pctClamp, 2)} % del cierre (${num(clampTons, 0)} t) · la máquina entrega ≈2 % · el libro cae en ~0.5 %`
      + ` — σ residual ${num(v.sigmaPa / 1e6)} MPa, peso ${num(v.weightN)} N`,
  });

  // ── 2) NO aplicar factor de seguridad encima — §11.2.2 ──
  C.push({
    id: 'eject-sin-fs', subsistema: S, cita: '§11.2.2',
    criterio: 'el análisis ya es conservador: NO se le suma factor de seguridad ("without the use of safety factors")',
    estado: 'CUMPLE',
    detalle: 'A_eff es la sección que abraza el núcleo (no el área proyectada) y el análisis va del lado seguro — sumarle un FS sería sobre-diseño §1.2',
  });

  // ── 3) ¿Qué restricción MANDA? — §11.2.3 ──
  // "the design of the ejector system is driven more by the yield stresses exerted
  // on the plastic molding rather than by the compressive stresses on the pin".
  const manda = pines.dMinShearMm >= pines.dMinCompressionMm ? 'cortante en la PIEZA' : 'compresión en el PIN';
  C.push({
    id: 'eject-driver', subsistema: S, cita: '§11.2.3',
    criterio: 'declarar qué restricción gobierna el diámetro (normalmente el cortante en la pieza, no la compresión del pin)',
    medido: pines.dMinMm, unidad: 'mm',
    estado: 'CUMPLE',
    detalle: `manda ${manda}: ⌀ por cortante ${num(pines.dMinShearMm, 2)} mm vs ⌀ por compresión ${num(pines.dMinCompressionMm, 2)} mm → ⌀ ${num(pines.dMinMm, 2)} mm`
      + (manda.includes('PIN') ? ' ⚠ inusual: revisar el largo del pin (§11.3.1 dice que el driver cambia con L)' : ''),
  });

  // ── 4) Es un LÍMITE INFERIOR, no un diseño — §11.2.4 ──
  C.push({
    id: 'eject-limite-inferior', subsistema: S, cita: '§11.2.4',
    criterio: 'el cálculo da el MÍNIMO; el diseñador puede (y suele) añadir pines o subir el ⌀ para uniformar la expulsión',
    estado: 'CUMPLE',
    detalle: `⌀ ${num(pines.dMinMm, 2)} mm es piso, no receta — "The mold designer can always add ejectors or increase the ejector size"`,
  });

  // ── 5) Dónde van los pines: donde la pieza SE PEGA — §11.2.5 ──
  C.push({
    id: 'eject-layout', subsistema: S, cita: '§11.2.5',
    criterio: 'los pines van donde se generan las fuerzas de agarre (costillas, bosses), NO repartidos uniformemente',
    estado: 'SIN-MÓDULO',
    detalle: 'la Máquina coloca pines por rejilla; no existe el mapa de fuerza de agarre que diría dónde se pega la pieza — el libro nombra el layout uniforme como el anti-patrón común',
    deuda: 'dfm-mesh.ts ya mide costillas y espesor local; de ahí sale el mapa de agarre. Falta el colocador que lo consuma',
  });

  // ── 6) Acero mínimo: 1 diámetro de pin entre barreno y cavidad — §11.2.5 ──
  C.push({
    id: 'eject-acero-minimo', subsistema: S, cita: '§11.2.5',
    criterio: 'al menos UN diámetro de pin de acero entre el barreno del expulsor y la superficie de la cavidad',
    limite: pines.dMinMm, unidad: 'mm',
    estado: 'SIN-CABLEAR',
    detalle: `exigido ≥ ${num(pines.dMinMm, 2)} mm de acero — con menos, el barreno se ovala bajo presión, el pin se traba y salen grietas hacia la cavidad`,
    deuda: 'coordAudit() en mold-coords.ts ya enumera barrenos con su XYZ; falta el check contra la pared de la cavidad',
  });

  // ── 7) Pines iguales, y NUNCA casi-iguales — §11.2.6 ──
  C.push({
    id: 'eject-pines-casi-iguales', subsistema: S, cita: '§11.2.6',
    criterio: 'mismo largo y ⌀ siempre que se pueda; JAMÁS dos pines que difieran apenas (el moldeador los intercambia y daña el molde)',
    estado: 'SIN-MÓDULO',
    detalle: 'la Máquina usa un solo ⌀ para todos los pines (cumple por construcción), pero nadie verifica el caso de longitudes casi-iguales cuando el molde tiene pines contorneados',
    deuda: 'cuando existan pines de largo variable: tabla ordenada por (⌀, L) + umbral de similitud (1.0 mm) → hallazgo crítico',
  });

  return resumir(S, C);
}

/**
 * CONTRATO ESTRUCTURAL — cap 12
 * Aquí vive LA comparación cruzada que el libro usa para reprobar un molde
 * (§12.1.2): la deflexión no se juzga contra un número abstracto, se juzga contra
 * el ESPESOR DEL VENTEO. Si las mitades se separan más que el vent, hay flash
 * garantizado — y ninguna de las dos pantallas por separado lo ve.
 */
export function contratoEstructural(pkg: MoldPackage): ContratoSubsistema {
  const S = 'estructural';
  const C: Criterio[] = [];
  const sp = pkg.diseno.placas.soporte;
  const vent = pkg.diseno.venteo;

  // ── 1) ⭐ DEFLEXIÓN vs ESPESOR DEL VENTEO — §12.1.2 ──
  const deflex = sp.deflectionAtPlateMm;
  const hVent = vent.hSpecMm;
  const ratio = hVent > 0 ? deflex / hVent : NaN;
  C.push({
    id: 'estr-deflexion-vs-venteo', subsistema: S, cita: '§12.1.2 · cap 8',
    criterio: 'la separación de las mitades bajo carga debe ser MENOR que el espesor del venteo (si no, flash garantizado)',
    medido: deflex, limite: hVent, unidad: 'mm',
    estado: !Number.isFinite(ratio) ? 'SIN-MÓDULO' : (deflex > hVent ? 'VIOLA' : 'CUMPLE'),
    detalle: `deflexión ${num(deflex, 3)} mm vs venteo ${num(hVent, 3)} mm = ${num(ratio, 1)}× — `
      + (deflex > hVent
        ? `FLASH GARANTIZADO: "The mold design must be improved" §12.1.2. Y la rebaba DESGASTA el plano de partición hasta pedir resuperficiado §8.1.2`
        : `las mitades cierran más fino que el venteo ✓`),
  });

  // ── 2) El criterio de flash del dimensionador coincide con el contrato ──
  C.push({
    id: 'estr-flash-coherente', subsistema: S, cita: '§12.1.2',
    criterio: 'el veredicto de flash del dimensionador de placas debe coincidir con la comparación deflexión↔venteo',
    estado: sp.flashOk === (deflex <= hVent) ? 'CUMPLE' : 'VIOLA',
    detalle: `platesizing dice flashOk=${sp.flashOk} (su propio gap ${num(sp.ventGapMm, 3)} mm) y el contrato mide ${num(deflex, 3)} vs ${num(hVent, 3)} mm`
      + (sp.flashOk === (deflex <= hVent) ? ' — coinciden ✓' : ' — ⚠ DOS VERDADES: uno de los dos miente (el patrón que ya nos mordió 4 veces)'),
  });

  // ── 3) Qué gobierna el espesor de la placa — §12.1.3 / §12.2.2 ──
  C.push({
    id: 'estr-gobierna', subsistema: S, cita: '§12.1.3',
    criterio: 'declarar qué gobierna el espesor (deflexión / enfriamiento / expulsión) — la rigidez va con el CUBO del espesor',
    medido: sp.plateThkMm ?? undefined, unidad: 'mm',
    estado: sp.plateThkMm ? 'CUMPLE' : 'VIOLA',
    detalle: `gobierna ${sp.governs}: requerido ${num(sp.tRequiredMm)} mm → placa comercial ${sp.plateThkMm ?? '—'} mm`
      + ' · OJO §12.1.3: cambiar de acero NO reduce la deflexión (todos ≈200 GPa), solo la geometría',
  });

  // ── 4) Pilares: dónde y cuántos — §12.2.3 ──
  C.push({
    id: 'estr-pilares', subsistema: S, cita: '§12.2.3',
    criterio: 'los pilares van bajo las zonas que generan fuerza; un solo pilar central no sirve y choca con el vástago de expulsión',
    medido: sp.nPillars, unidad: 'pilares',
    estado: sp.nPillars === 1 ? 'ADVIERTE' : 'CUMPLE',
    detalle: sp.nPillars === 1
      ? '1 pilar central: §12.2.3 avisa que "will not greatly reduce the deflection" (la placa dobla por los costados) y que suele chocar con el knock-out central'
      : `${sp.nPillars} pilares · masa acero ${num(sp.steelMassKg)} kg (placa ${num(sp.plateMassKg)} + pilares ${num(sp.pillarMassKg)})`,
  });

  // ── 4b) ⭐ EL MENÚ pilares↔placa: el libro NO dice "mínimo acero" ni "mínimos
  //     pilares" — dice que tras meter pilares se REGRESA a adelgazar la placa
  //     (§12.2.3) y que las alternativas se le presentan al cliente (§3.2.2).
  //     Aquí es donde se resuelve la disputa de la política "mínimo pilares". ──
  const ops = pkg.diseno.placas.soporteOpciones ?? [];
  const validas = ops.filter((o) => o.plateThkMm != null);
  if (validas.length > 1) {
    const porAcero = [...validas].sort((a, b) => a.steelMassKg - b.steelMassKg);
    const masLigera = porAcero[0];
    const ahorroKg = sp.steelMassKg - masLigera.steelMassKg;
    C.push({
      id: 'estr-menu-pilares', subsistema: S, cita: '§12.2.3 · §3.2.2',
      criterio: 'las alternativas pilares↔espesor de placa se presentan como MENÚ con su costo en acero, no se eligen en silencio',
      medido: sp.steelMassKg, limite: masLigera.steelMassKg, unidad: 'kg',
      estado: ahorroKg > 1 ? 'ADVIERTE' : 'CUMPLE',
      detalle: `elegida: ${sp.nPillars} pilares · placa ${sp.plateThkMm} mm · ${num(sp.steelMassKg)} kg. `
        + `La más ligera del menú: ${masLigera.nPillars} pilares · placa ${masLigera.plateThkMm} mm · ${num(masLigera.steelMassKg)} kg`
        + (ahorroKg > 1
          ? ` → ${num(ahorroKg)} kg de acero de diferencia. §12.2.3: "the thickness of the B plate and/or support plate could be slightly reduced" tras meter pilares — la elección es del humano, no del optimizador`
          : ' → la elegida ya es la más ligera'),
    });
  }

  // ── 5) Pre-carga de pilares — §12.2.3 (el truco de artesano) ──
  C.push({
    id: 'estr-precarga', subsistema: S, cita: '§12.2.3',
    criterio: 'los pilares pueden fabricarse MÁS LARGOS por la deflexión calculada para que el molde quede plano bajo carga',
    medido: deflex, unidad: 'mm',
    estado: 'SIN-MÓDULO',
    detalle: sp.nPillars > 0
      ? `con ${sp.nPillars} pilares y ${num(deflex, 3)} mm de deflexión, la pre-carga daría una cota de DOS valores (fabricar L+${num(deflex, 3)} / en operación L) — la deflexión no se elimina, se CANCELA`
      : 'sin pilares no aplica',
    deuda: 'mold-dimensions.ts tendría que soportar cotas de dos valores (fabricado vs en operación) y el plano dibujarlas',
  });

  // ── 6) σ_limit: nunca factor de seguridad CON peor caso — §12.1.1 ──
  C.push({
    id: 'estr-no-apilar-sesgos', subsistema: S, cita: '§12.1.1',
    criterio: 'σ_limit = min(σ_yield/f, σ_endurance) con UN método: prohibido combinar factor de seguridad con escenario de peor caso',
    estado: 'SIN-MÓDULO',
    detalle: 'la Máquina no expone qué método usó para fijar el esfuerzo admisible, así que no se puede verificar que no los esté apilando (= sobre-diseño §1.2)',
    deuda: 'platesizing/structural deben declarar {metodo: "yield/f" | "peor-caso", f, sigmaLimitMPa} y el contrato verificar que no vengan los dos',
  });

  // ── 7) La vida del molde es ENTRADA, no resultado — §12.1.1 ──
  C.push({
    id: 'estr-vida-ciclos', subsistema: S, cita: '§12.1.1',
    criterio: 'el número de ciclos objetivo entra al cálculo estructural (el aluminio NO tiene límite de fatiga: 545/370/170 MPa a 1e3/1e4/1e6)',
    medido: pkg.spec.totalVolume, unidad: 'piezas',
    estado: 'SIN-MÓDULO',
    detalle: `el spec declara ${pkg.spec.totalVolume?.toLocaleString() ?? '—'} piezas de horizonte, pero el dimensionado estructural no lo consume: usa un σ_endurance fijo`,
    deuda: 'moldbase/platesizing deben tomar cyclesTarget y elegir σ_limit de la curva S-N del metal (crítico si se elige aluminio)',
  });

  return resumir(S, C);
}

/**
 * CONTRATO DEL LLENADO — cap 5
 * El criterio que más se malinterpreta del libro entero: §5.1 tiene DOS COLAS.
 * El techo de diseño es 100 MPa aunque la máquina dé ~200 (el margen 2× es a
 * propósito), y una ΔP demasiado BAJA reprueba igual — "very low melt pressures
 * are indicative of a poor molded part design": pared engordada = material y ciclo
 * desperdiciados. Un optimizador que minimiza presión produce lo que el cliente
 * reprueba.
 */
export function contratoLlenado(pkg: MoldPackage): ContratoSubsistema {
  const S = 'llenado';
  const C: Criterio[] = [];
  const fill = pkg.diseno.fillMPa, cav = pkg.diseno.cavityMPa;
  const win = pkg.variantes.find((x) => x.arch === pkg.recomendacion.arch && x.nCav === pkg.recomendacion.nCav);

  // ── 1) Techo de diseño 100 MPa — §5.1 ──
  C.push({
    ...juzgaMax({
      id: 'llenado-techo', subsistema: S, cita: '§5.1',
      criterio: 'ΔP de cavidad ≤ 100 MPa de DISEÑO (la máquina da ~200: el margen 2× cubre el feed system y las varianzas)',
      medido: fill, limite: 100, unidad: 'MPa',
      detalle: `ΔP ${num(fill)} MPa · techo de diseño 100 · capacidad de máquina ~200`,
    }),
  });

  // ── 2) ⭐ La COLA INFERIOR: una ΔP muy baja también reprueba — §5.1 ──
  // El libro no da umbral numérico; el que usamos va DECLARADO como nuestro.
  const PISO_DECLARADO = 20;
  C.push({
    id: 'llenado-cola-baja', subsistema: S, cita: '§5.1',
    criterio: 'una ΔP demasiado BAJA reprueba: delata pared engordada (material y ciclo desperdiciados) — adelgazar y poner costillas §2.3.2',
    medido: fill, limite: PISO_DECLARADO, unidad: 'MPa',
    estado: fill < PISO_DECLARADO ? 'ADVIERTE' : 'CUMPLE',
    detalle: fill < PISO_DECLARADO
      ? `ΔP ${num(fill)} MPa MUY holgada — "indicative of a poor molded part design": revisar si la pared de ${num(pkg.spec.wallMm, 1)} mm está engordada`
      : `ΔP ${num(fill)} MPa por encima del piso ${PISO_DECLARADO} MPa (umbral DECLARADO nuestro: el libro no lo fija en número)`,
  });

  // ── 3) La velocidad recomendada CONVERGIÓ — §5.5.1 ──
  C.push({
    id: 'llenado-convergencia', subsistema: S, cita: '§5.5.1',
    criterio: 'la velocidad sale de un lazo v↔γ̇↔μ que debe converger, y la escalera de iteraciones es auditable',
    estado: 'SIN-CABLEAR',
    detalle: 'convergeVelocity() itera 24 veces a ciegas y devuelve solo el último valor — no se puede verificar que convergió ni mostrar la escalera (el libro la publica: 0.5 → 0.69 → 0.77 → 0.80 → 0.82 m/s)',
    deuda: 'filling.ts:convergeVelocity debe devolver {v, iteraciones[], convergio} en vez de un número suelto',
  });

  // ── 4) Velocidad lineal en la banda del libro — §5.5.1 ──
  C.push({
    id: 'llenado-velocidad', subsistema: S, cita: '§5.5.1',
    criterio: 'la velocidad lineal del fundido cae entre 0.01 y 1 m/s',
    estado: 'SIN-CABLEAR',
    detalle: 'la velocidad convergida no viaja al paquete, así que no se puede contrastar contra la banda 0.01–1 m/s',
    deuda: 'DiseñoFisico debe exponer la velocidad de llenado junto a fillMPa',
  });

  // ── 5) Tonelaje: llenado Y empaque, el mayor manda, con piso de 50 MPa — §5.5.3 ──
  const clampT = win?.clampTons ?? 0;
  C.push({
    id: 'llenado-tonelaje', subsistema: S, cita: '§5.5.3',
    criterio: 'el tonelaje se calcula en llenado Y en empaque (gana el mayor) sobre área PROYECTADA, con piso de 50 MPa de presión de cavidad',
    medido: cav, limite: 50, unidad: 'MPa',
    estado: cav < 50 ? 'ADVIERTE' : 'CUMPLE',
    detalle: `presión de cavidad ${num(cav)} MPa → ${num(clampT, 0)} t. `
      + (cav < 50
        ? `⚠ §5.5.3: "molders will generally use packing pressures in the vicinity of 50 MPa" — el moldeador empacará ahí aunque el análisis diga menos, así que el tonelaje real será mayor`
        : 'por encima del piso de empaque del libro ✓'),
  });

  // ── 6) Área PROYECTADA, con descuento por ventanas — §5.5.3 / §3.4.3 ──
  C.push({
    id: 'llenado-area-proyectada', subsistema: S, cita: '§5.5.3 · §3.4.3',
    criterio: 'el tonelaje va sobre área PROYECTADA, y las ventanas/huecos de la pieza se descuentan (si no, sobreestima)',
    estado: 'SIN-MÓDULO',
    detalle: 'la Máquina usa L×W como área proyectada (el rectángulo envolvente) — el libro advierte que en el bezel con ventana grande "the true required clamp tonnage is likely less"',
    deuda: 'dfm-mesh.ts ya rasteriza la pieza: el área proyectada REAL sale de contar columnas ocupadas, no del bbox',
  });

  return resumir(S, C);
}

/**
 * CONTRATO DE LOS GATES — cap 7
 * El tipo de gate NO es un enum plano: tiene cinco atributos consultables
 * (§7.3.1 Tabla 7.1 + notas), y el quinto —¿se puede AGRANDAR?— no aparece en
 * ningún catálogo comercial, solo en el libro (§7.3.5), porque el acero se quita,
 * no se pone.
 */
export function contratoGates(pkg: MoldPackage): ContratoSubsistema {
  const S = 'gates';
  const C: Criterio[] = [];
  const DEUDA = 'gating.ts:gateDesign() existe y está gateado, pero solo hace 1 de los 5 pasos de §7.3 (tipo→cortante→ΔP→freeze→ajuste) y moldMachine no lo llama';

  C.push({
    id: 'gate-tipo', subsistema: S, cita: '§7.3.1 · Tabla 7.1',
    criterio: 'el tipo de gate se elige por runner (frío/caliente), método de degatado, régimen de corte, tipo de flujo y si se puede AGRANDAR',
    estado: 'SIN-CABLEAR',
    detalle: 'la Máquina elige la ARQUITECTURA de alimentación pero nunca el tipo de gate — no hay gate en el paquete',
    deuda: DEUDA,
  });

  C.push({
    id: 'gate-shear', subsistema: S, cita: '§7.1.4',
    criterio: 'γ̇ en el gate ≤ máximo del material (el apéndice orienta; el proveedor manda y muchas veces se puede más)',
    estado: 'SIN-CABLEAR',
    detalle: 'sin gate diseñado no hay γ̇ que juzgar',
    deuda: DEUDA,
  });

  C.push({
    id: 'gate-dp', subsistema: S, cita: '§7.1.4 · §7.3.3',
    criterio: 'ΔP del gate: ~2 MPa típico · >6 MPa sospechoso · >10 MPa = mal diseñado (muy delgado o muy largo)',
    limite: 10, unidad: 'MPa',
    estado: 'SIN-CABLEAR',
    detalle: 'las tres marcas del libro están listas para usarse en cuanto exista el gate',
    deuda: DEUDA,
  });

  C.push({
    id: 'gate-freeze', subsistema: S, cita: '§7.1.5 · §7.3.4',
    criterio: 'el t_freeze del gate se contrasta contra el t_pack que la pieza necesita; puede REPROBAR un gate que ya pasó corte y presión',
    estado: 'SIN-CABLEAR',
    detalle: 'gateFreezeCylS/StripS existen y están verificadas; nadie las contrasta contra el empaque requerido. §7.1.5: "the dimensions should be adjusted EVEN IF the shear rates and pressure drops were found acceptable"',
    deuda: 'gating.ts tiene las dos funciones de freeze; falta el paso 4 del proceso §7.3.4 que las compara',
  });

  C.push({
    id: 'gate-seccion-delgada', subsistema: S, cita: '§7.3.4',
    criterio: 'no gatear a una sección más delgada que la que debe empacar — y si toca, la conclusión puede ser CAMBIAR EL TIPO DE MOLDE',
    estado: 'SIN-MÓDULO',
    detalle: 'nadie compara el espesor en el punto del gate contra el espesor de la sección a empacar; ese es el salto de dos niveles que dispara "considera 3 placas o cámara caliente"',
    deuda: 'requiere espesor local en el punto del gate (dfm-mesh ya lo tiene) + el lazo que escale la decisión a la arquitectura',
  });

  C.push({
    id: 'gate-degatado', subsistema: S, cita: '§7.1.2 · §7.2.7',
    criterio: 'debe existir una ruta de degatado declarada (manual / automático por apertura / robot) y el acceso físico para ejecutarla',
    estado: 'SIN-MÓDULO',
    detalle: 'para tunnel gate el libro exige 45° al plano, cono incluido ≥20°, ≥3 diámetros fuera del plano Y sucker pins en el runner — sin los sucker pins el degatado automático NO EXISTE aunque la geometría del gate pase',
    deuda: 'el check debe ser del ENSAMBLE (gate + runner + sucker pins), no del gate aislado',
  });

  C.push({
    id: 'gate-steel-safe', subsistema: S, cita: '§7.3.5 · §7.4',
    criterio: 'el gate se especifica deliberadamente CHICO para abrirlo en el tryout, y el tipo se elige entre otras cosas por si se puede agrandar',
    estado: 'SIN-MÓDULO',
    detalle: 'no existe el atributo "agrandable" ni el plan de tryout que diga hasta dónde crece cada gate',
    deuda: 'el atributo agrandable no está en ningún catálogo comercial, solo en el libro — hay que modelarlo nosotros',
  });

  return resumir(S, C);
}

/**
 * CONTRATO DEL LAYOUT — cap 4 (partición, insertos, base, máquina)
 * El cap 4 es una cadena estrictamente ordenada donde cada paso consume grados de
 * libertad del siguiente, y termina en la verificación más física de todas: ¿el
 * molde CABE y trabaja en una inyectora real?
 */
export function contratoLayout(pkg: MoldPackage): ContratoSubsistema {
  const S = 'layout';
  const C: Criterio[] = [];
  const ins = pkg.insertos, base = pkg.base, ms = pkg.diseno.maquina.seleccion;

  // ── 1) Cheek: el MAYOR de 3·⌀agua y la profundidad de cavidad — §4.2.2 ──
  const cheekMin = Math.max(3 * ins.coolingDiaMm, pkg.spec.Hmm);
  C.push({
    id: 'layout-cheek', subsistema: S, cita: '§4.2.2 · §12.2.4',
    criterio: 'el borde del inserto es el MAYOR de: 3 diámetros de línea de agua por lado, o la profundidad de la cavidad',
    medido: ins.cheekMm, limite: cheekMin, unidad: 'mm',
    estado: ins.cheekMm >= cheekMin - 0.5 ? 'CUMPLE' : 'VIOLA',
    detalle: `cheek ${num(ins.cheekMm)} mm vs exigido ${num(cheekMin)} mm = max(3×⌀${num(ins.coolingDiaMm, 2)}=${num(3 * ins.coolingDiaMm)}, prof ${num(pkg.spec.Hmm)}) — manda ${ins.driver}`
      + ' · el libro verifica los DOS casos: el bezel lo gana enfriamiento, el vaso lo gana estructura',
  });

  // ── 2) Aspect ratio del envelope < 2:1 — §4.3.1 ──
  C.push({
    ...juzgaMax({
      id: 'layout-aspect', subsistema: S, cita: '§4.3.1',
      criterio: 'la relación ancho:largo del envelope de cavidades debe mantenerse bajo 2:1',
      medido: base.aspect, limite: 2, unidad: ':1',
      detalle: `aspecto ${num(base.aspect, 2)}:1 · envelope ${num(base.envelope.wmm, 0)}×${num(base.envelope.lmm, 0)} mm → base ${base.base.wmm}×${base.base.lmm} mm`,
    }),
  });

  // ── 3) Base dentro del catálogo comercial 200–1000 mm — §4.3.2 ──
  const bMax = Math.max(base.base.wmm, base.base.lmm);
  C.push({
    id: 'layout-base-catalogo', subsistema: S, cita: '§4.3.2',
    criterio: 'la base debe existir en catálogo: entre 200 y 1000 mm de lado',
    medido: bMax, limite: 1000, unidad: 'mm',
    estado: bMax > 1000 ? 'VIOLA' : (bMax < 200 ? 'ADVIERTE' : 'CUMPLE'),
    detalle: `base ${base.base.wmm}×${base.base.lmm} mm · catálogo 200–1000 mm`
      + (base.warnings.length ? ` · avisos: ${base.warnings.join('; ')}` : ''),
  });

  // ── 4) ⭐ El molde CABE Y TRABAJA en la inyectora — §4.3.3 ──
  // Los DOS extremos fallan: sin daylight mínimo no genera tonelaje, y un tonelaje
  // excesivo sobre un molde subdimensionado lo destruye.
  C.push({
    id: 'layout-maquina', subsistema: S, cita: '§4.3.3',
    criterio: 'el molde cabe entre barras, dentro del daylight, con shot y tonelaje adecuados — y NO groseramente sobrados',
    estado: ms.ok ? 'CUMPLE' : 'VIOLA',
    detalle: ms.machine
      ? `${ms.machine.name}: shot ${num(ms.shotPct, 0)} % del barril, cierre ${num(ms.clampUtilPct, 0)} % · gobierna ${ms.governs ?? '—'}`
        + (ms.issues.length ? ` · ${ms.issues.join('; ')}` : '')
      : `ninguna inyectora del catálogo satisface: ${ms.issues.join('; ')}`,
  });

  // ── 5) La ventana cómoda de disparo es 25–50 % del barril — §4.3.3 ──
  C.push({
    id: 'layout-shot-ventana', subsistema: S, cita: '§4.3.3',
    criterio: 'el disparo debe caer en la ventana cómoda (~25–50 % del máximo), no solo "caber"',
    medido: ms.shotPct, unidad: '%',
    estado: !ms.machine ? 'SIN-MÓDULO'
      : (ms.shotPct >= 25 && ms.shotPct <= 50 ? 'CUMPLE' : 'ADVIERTE'),
    detalle: `disparo ${num(ms.shotPct, 0)} % del barril · ventana cómoda 25–50 % — `
      + (ms.shotPct > 50 ? 'muy lleno: poco margen de empaque'
        : ms.shotPct < 25 ? 'muy vacío: el fundido se degrada residiendo en el barril §4.3.3' : 'en ventana ✓'),
  });

  // ── 6) El ancho contra barras incluye lo que SOBRESALE — §4.3.3 ──
  C.push({
    id: 'layout-ancho-con-plugs', subsistema: S, cita: '§4.3.3',
    criterio: 'el ancho que se compara contra las barras de amarre incluye plugs de agua y conectores, menos holgura de inserción',
    estado: 'SIN-MÓDULO',
    detalle: `se compara la base pelada (${bMax} mm); los plugs DME y los conectores sobresalen y nadie los suma`,
    deuda: 'coolingCircuit ya conoce los plugs; falta sumar su saliente al ancho antes de comparar contra tie bars',
  });

  // ── 7) Dos catálogos de material distintos: inserto ≠ base — §4.4.4 ──
  C.push({
    id: 'layout-material-base', subsistema: S, cita: '§4.4.4',
    criterio: 'el acero del inserto y el de la base son catálogos DISTINTOS (las bases solo vienen en 1045, 4140 o P20)',
    estado: 'SIN-MÓDULO',
    detalle: `se elige un acero (${pkg.metal.metal.name ?? '—'}) para los insertos, pero no se verifica que la BASE exista en ese material`,
    deuda: 'moldbase debe exponer el material de la base por separado y restringirlo a 1045/4140/P20',
  });

  return resumir(S, C);
}

/**
 * CONTRATO DEL COSTO — cap 3
 * Aquí vive la alarma contraintuitiva más importante del libro (§3.4.4): si el
 * molde amortizado DOMINA el costo por pieza, no es señal de calidad — es
 * bandera de SOBREDISEÑO, y hay que generar la alternativa barata y compararla.
 */
export function contratoCosto(pkg: MoldPackage): ContratoSubsistema {
  const S = 'costo';
  const C: Criterio[] = [];
  const cp = pkg.costoPieza;
  const total = cp.partUSD || 1;
  const pctMolde = (cp.moldPerPart / total) * 100;
  const pctMat = (cp.materialPerPart / total) * 100;
  const pctProc = (cp.processPerPart / total) * 100;

  // ── 1) ⭐ La bandera de SOBREDISEÑO — §3.4.4 ──
  C.push({
    id: 'costo-sobrediseno', subsistema: S, cita: '§3.4.4 · §3.5',
    criterio: 'si el molde amortizado domina el costo por pieza, es bandera de SOBREDISEÑO: hay que generar y comparar la alternativa más barata',
    medido: pctMolde, limite: 50, unidad: '%',
    estado: pctMolde > 50 ? 'ADVIERTE' : 'CUMPLE',
    detalle: `costo/pieza $${cp.partUSD.toFixed(4)} = molde ${num(pctMolde, 0)} % · material ${num(pctMat, 0)} % · proceso ${num(pctProc, 0)} %`
      + (pctMolde > 50
        ? ` — "The large cost of the mold relative to the material and processing costs indicates that the mold may have been OVER DESIGNED" §3.4.4`
        : ' — proporción sana ✓'),
  });

  // ── 2) ⭐ El MENÚ de diseños, no un veredicto único — §3.2.2 ──
  const factibles = pkg.variantes.filter((v) => v.factible);
  const ordenadas = [...factibles].sort((a, b) => a.totalUSD - b.totalUSD);
  const ganadora = ordenadas[0], segunda = ordenadas[1];
  C.push({
    id: 'costo-menu', subsistema: S, cita: '§3.2.2 · §3.5',
    criterio: 'el entregable puede ser MÁS DE UN diseño ("the customer can be given more than one design"), con su break-even',
    medido: factibles.length, unidad: 'variantes',
    estado: factibles.length > 1 ? 'CUMPLE' : 'ADVIERTE',
    detalle: `${factibles.length} variantes factibles de ${pkg.variantes.length} evaluadas · gana ${ganadora?.arch} ×${ganadora?.nCav} ($${ganadora?.totalUSD.toFixed(0)})`
      + (segunda ? ` · 2ª ${segunda.arch} ×${segunda.nCav} ($${segunda.totalUSD.toFixed(0)}, +${num(((segunda.totalUSD / (ganadora?.totalUSD || 1)) - 1) * 100, 1)} %)` : ''),
  });

  // ── 3) Los VETOS no económicos pueden tumbar al ganador — §3.2.2 ──
  C.push({
    id: 'costo-vetos', subsistema: S, cita: '§3.2.2',
    criterio: 'factores no económicos pueden vetar al ganador del break-even: cambios de color, capacidad del moldeador, estandarización lean, payback exigido',
    estado: 'SIN-MÓDULO',
    detalle: 'la Máquina elige por costo total y no expone los vetos — el libro dice que el molde "should be designed to MAXIMIZE THE MOLDER\'S CAPABILITY"',
    deuda: 'MachineSpec debe aceptar vetos (cambioColorFrecuente, capacidadMoldeador, paybackMaxMeses) y el optimizador filtrar con ellos',
  });

  // ── 4) El factor de mantenimiento es interpolado a juicio — §3.4.1 ──
  C.push({
    id: 'costo-mantenimiento', subsistema: S, cita: '§3.4.1 · Tabla 3.11',
    criterio: 'el coeficiente de mantenimiento (2 a 20 según abrasividad vs dureza) se interpola a juicio y debe declararse',
    estado: 'SIN-MÓDULO',
    detalle: 'se usa el ×3 del ejemplo del libro sin declarar que es una interpolación de juicio ni de qué caso viene — "the maintenance costs can far exceed the purchase cost"',
    deuda: 'estimatePartCost recibe fMaintenance con default 3; debe viajar al reporte con su justificación (resina abrasiva × dureza del acero)',
  });

  // ── 5) Todo coeficiente es sobreescribible por dato del taller — §3.3 ──
  C.push({
    id: 'costo-datos-taller', subsistema: S, cita: '§3.3 · §3.3.1.3',
    criterio: 'los coeficientes del libro son defaults: la tarifa negociada del taller, si existe, MANDA sobre la tabla',
    estado: 'CUMPLE',
    detalle: `machiningRateUSDh es parámetro del spec (${pkg.spec.machiningRateUSDh ? `$${pkg.spec.machiningRateUSDh}/h del taller` : 'default del libro'}) — el mandato se repite 3 veces en §3.3`,
  });

  // ── 6) Sesgos conservadores declarados — §3.3.1.3 / §3.3.2 ──
  C.push({
    id: 'costo-sesgos', subsistema: S, cita: '§3.3.1.3 · §3.3.2',
    criterio: 'cada estimado conservador va ETIQUETADO: volumen a remover = el inserto entero, eficiencia de maquinado 25 %, layout ceiling(√n)',
    estado: 'SIN-MÓDULO',
    detalle: 'los tres sesgos están implementados con los valores del libro, pero el reporte no los declara — el usuario no puede saber cuánto está inflado',
    deuda: 'CostBreakdown debe traer sesgos[]: {que, direccion, magnitud, cita} y el reporte imprimirlos',
  });

  return resumir(S, C);
}

/**
 * CONTRATO DE CONTRACCIÓN Y ALABEO — cap 10
 * El criterio más contraintuitivo del libro: contracción CERO no es precisión,
 * es una pieza que no se puede expulsar (§10.1.6).
 */
export function contratoContraccion(pkg: MoldPackage): ContratoSubsistema {
  const S = 'contracción';
  const C: Criterio[] = [];
  const DEUDA = 'shrinkage.ts implementa Tait doble dominio y está gateado (bezel 0.31 % exacto); moldMachine no lo llama — cablear a DiseñoFisico.contraccion';

  C.push({
    id: 'contr-positiva', subsistema: S, cita: '§10.1.6',
    criterio: 'la contracción debe ser POSITIVA: se necesita que la pieza se despegue de la cavidad y abrace el núcleo para poder expulsarla',
    estado: 'SIN-CABLEAR',
    detalle: 'contracción ≤ 0 NO es precisión: es sobre-empaque y la pieza no sale de costillas ni bosses. Un optimizador que la minimice diseña un molde que no expulsa',
    deuda: DEUDA,
  });

  C.push({
    id: 'contr-rango', subsistema: S, cita: '§10.1.6 · §10.1.7',
    criterio: 'la recomendación es un RANGO (límite inferior con pack largo/alto, superior con pack corto/bajo), no un número',
    estado: 'SIN-CABLEAR',
    detalle: 'límites del libro: P_max = max(1.2·Pinj, 100 MPa) y P_min = min(0.4·Pinj, 30 MPa) con T=(T_noflow+T_melt)/2 — si el rango sale muy ancho, se recomienda pack extendido al moldeador',
    deuda: DEUDA,
  });

  C.push({
    id: 'contr-responsable', subsistema: S, cita: '§10.1.7',
    criterio: 'el número final de contracción lleva RESPONSABLE asignado; si nadie firma, la salida es "hace falta molde prototipo"',
    estado: 'SIN-MÓDULO',
    detalle: 'no hay campo de responsabilidad: el libro dice que en algunos contratos es del cliente, en otros nadie la acepta y se acuerda un prototipo',
    deuda: 'es un campo del registro de decisiones (§13.10), no un cálculo',
  });

  C.push({
    id: 'contr-steel-safe', subsistema: S, cita: '§10.2.2',
    criterio: 'las DOS escuelas de steel-safe se ofrecen: asimétrico (cavidad −Δ / núcleo +Δ) o valor medio constante — ninguna es el default',
    estado: 'SIN-MÓDULO',
    detalle: 'el asimétrico garantiza retrabajo (el nominal sale fuera de tolerancia a propósito); el valor medio confía en que el moldeador ajuste. El libro no elige: "many mold designers prefer to use a constant but mid-range estimate"',
    deuda: 'decisión de menú (§3.2.2) + su asiento en el registro',
  });

  C.push({
    id: 'contr-warpage-topologia', subsistema: S, cita: '§10.3.1',
    criterio: 'el alabeo lo decide la TOPOLOGÍA: un marco con ventana está desacoplado y no alabea; un área cerrada pandea si (s_borde − s_centro) > 0.44·(h/W)²',
    estado: 'SIN-MÓDULO',
    detalle: 'no existe módulo de alabeo (la brecha de física más grande del libro en nuestro código) — y el criterio ni siquiera es un mapa de contracción, es la topología de la pieza',
    deuda: 'dfm-mesh ya distingue regiones y huecos: de ahí sale la clasificación marco-abierto vs área-cerrada',
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
  const subsistemas = [contratoAlimentacion(pkg), contratoVenteo(pkg), contratoEnfriamiento(pkg),
    contratoExpulsion(pkg), contratoEstructural(pkg),
    contratoLlenado(pkg), contratoGates(pkg)];
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
