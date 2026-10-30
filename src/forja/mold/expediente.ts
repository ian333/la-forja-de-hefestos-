/**
 * EXPEDIENTE — el registro de decisiones del molde (Kazmer §13.10).
 * ============================================================================
 * El libro es explícito: el entregable final NO es solo el molde — es el REGISTRO
 * de decisiones documentado (costos/beneficios/riesgos) firmado por las partes
 * (§13.10). Y varias decisiones el software NO las puede tomar por diseño:
 *
 *   · la escuela de steel-safe (§10.2.2): asimétrico garantiza retrabajo, el
 *     constante confía en el moldeador — "ninguna es el default", elige el humano
 *   · el responsable de la contracción (§10.1.7): si nadie firma, la salida es
 *     "hace falta molde prototipo"
 *   · los vetos no económicos (§3.2.2): pueden tumbar al ganador del break-even
 *   · los conflictos abiertos del lazo de diseño (§6.4.7 vs §6.2.2): "lo arbitra
 *     el humano §1.2"
 *
 * Este módulo DERIVA las decisiones pendientes del paquete (con sus opciones
 * reales, números incluidos) y las registra cuando alguien firma. Junto con el
 * PLAN DE TRYOUT (todo lo que quedó deliberadamente chico para abrirse en
 * pruebas: gates §7.3.5, venteos reservados §8.1, runners a catálogo §6.5.5).
 * PURO → node-testeable. Sin reloj propio: la fecha la pone quien firma.
 */
import { TARIFA_LIBRO_USDH, factorDeMaquinado, type MoldPackage } from './moldmachine';
import type { ContratoReporte, EnsambleMedido } from './mold-contratos';
import { MACHINING_FACTOR } from './moldcost-detailed';
import type { TarifasDeLaPlanta } from './machinesizing';
// EL REPORTE DE ANÁLISIS (orden L, 2026-10-30): lee los criterios del dictamen (② en el acero) y la ficha de la resina
import { motorDeLaResina } from './moldmachine';
import { tituloCorto, type Criterio, type ContratoEstado } from './mold-contratos';
import type { RevisionModelo } from './revisar-modelo';

export interface Decision {
  /** id estable (para registrar/UI) */
  id: string;
  tema: string;
  cita: string;
  /** las opciones REALES (con números del paquete), no categorías abstractas */
  opciones: string[];
  /** null = pendiente de firma */
  eleccion: string | null;
  responsable: string | null;
  fecha: string | null;
  notas?: string;
}

export interface Expediente {
  nombre: string;
  decisiones: Decision[];
  /** el plan de tryout: qué está deliberadamente chico y hacia dónde crece */
  tryout: string[];
  /** cuántas decisiones siguen sin firma (el §13.10 no cierra con pendientes) */
  pendientes: number;
  cerrable: boolean;
}

const num = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');

/**
 * LAS HORAS DEL MODELO DE KAZMER (cap. 3) — LOS APAGONES, 2026-10-24.
 * El expediente enseñaba «molde $49,344 · pieza $0.42» con `machiningRateUSDh ?? 100` («EE.UU. por defecto»,
 * moldmachine.ts) y formato en-US: una planta del Bajío paga otra cosa y el comprador cuelga. Hasta que exista la
 * tarifa del cliente en MXN (orden G, semana 2) se enseñan las HORAS, que no dependen de ninguna tarifa:
 *   maquinado (Eq 3.8-3.12) + acabado (Eq 3.13-3.14) de UN juego de insertos (`estimateMoldCost` → `cost.cavity`),
 *   × n cavidades × el descuento por juegos de la Tabla 3.5 (`cost.discount`) — la misma cuenta que el dinero, antes
 *   de multiplicar por la tarifa. La base comprada (Eq 3.15-3.17) y la customización (Eq 3.18) son precios de
 *   catálogo en USD, no horas: tampoco se escriben.
 */
export function horasDelModelo(v: { nCav: number; cost: { discount: number; cavity: { tMachiningH: number; tFinishH: number } } }): { maquinadoH: number; acabadoH: number } {
  const k = v.nCav * v.cost.discount;
  return { maquinadoH: v.cost.cavity.tMachiningH * k, acabadoH: v.cost.cavity.tFinishH * k };
}
/** El renglón que sustituye al dinero mientras no haya tarifa (lo usan el expediente y la tarjeta del paso 9). */
export const SIN_TARIFA = 'costo de referencia: falta tu tarifa por hora (MXN)';

/* ═══════════════════════════════════════════════════════════════════════════════
 * EL COSTO DE REFERENCIA CON TU TARIFA (orden 2026-10-29-g · LOS DATOS DE TU PLANTA)
 * ═══════════════════════════════════════════════════════════════════════════════
 * Juez B (D8): «muere la cifra de 100 USD/h; regresa como costo de referencia con TU tarifa, MXN, por centro». Las HORAS son
 * las del modelo de Kazmer (cap. 3) para la arquitectura que gana — las mismas de `horasDelModelo` —; la tarifa es la que la
 * planta capturó en su ficha. Cada renglón es horas × tarifa de UN centro:
 *   · maquinado de insertos (Eq 3.8-3.12) → fresado CNC, o electroerosión cuando el factor de la Tabla 3.4 es el de EDM (4);
 *   · acabado de insertos (Eq 3.13-3.14, pulido SPI de la Tabla 3.6) → banco / ajuste;
 *   · ingeniería → el modelo NO separa horas de diseño (§3.3.3 las mete en la customización, Eq 3.18, junto con las compras):
 *     tu tarifa se guarda y el renglón lo dice, no se inventan horas.
 * Lo que NO son horas — el acero de los insertos (Apéndice B), la base (Eq 3.14) y la customización (Eq 3.18) — son compras
 * con precio del libro en USD: con tu tarifa se enseñan en kg y factores y NO se suman a los pesos (no hay tipo de cambio que
 * no sea inventado). Sin ninguna tarifa, el costo sale como hoy: las horas + la REFERENCIA del libro en USD con las tarifas de
 * su ejemplo (100 $/h y 50 $/h, §3.3.1.3 y §3.3.1.5), rotulada «falta tu tarifa».
 */
export interface RenglonCosto {
  centro: 'fresado CNC' | 'electroerosión' | 'banco / ajuste' | 'ingeniería';
  que: string; cita: string;
  horas: number | null; tarifaMXNh: number | null; mxn: number | null;
  nota?: string;
}
export interface CostoDeReferencia {
  arch: string; nCav: number; maquinadoH: number; acabadoH: number;
  /** 'tu-tarifa' = al menos un centro con horas trae tu tarifa · 'referencia-libro' = ninguna tarifa capturada */
  modo: 'tu-tarifa' | 'referencia-libro';
  rotulo: string;
  renglones: RenglonCosto[];
  /** Σ horas × tarifa de los renglones que sí la traen (MXN) */
  totalMXN: number | null;
  /** ¿todos los centros con horas traen tarifa? */
  completo: boolean;
  /** «tu tarifa de fresado CNC» … */
  faltan: string[];
  /** las compras que no son horas (no se suman a los pesos) */
  compras: string[];
  /** la REFERENCIA del libro en USD (Eq 3.2 con 100 $/h y 50 $/h): solo se enseña en modo 'referencia-libro' */
  referenciaUSD: { moldeUSD: number; insertosUSD: number; baseUSD: number; customUSD: number; maquinadoUSDh: number; acabadoUSDh: number };
  planta: string | null;
}
const mxn = (x: number) => `$${Math.round(x).toLocaleString('es-MX')} MXN`;
const usd = (x: number) => `US$ ${Math.round(x).toLocaleString('es-MX')}`;
/** el centro que cobra el MAQUINADO según el factor de la Tabla 3.4 con que el modelo calculó las horas */
const centroMaquinado = (fMaq: number): 'fresado CNC' | 'electroerosión' => (fMaq >= MACHINING_FACTOR.edm ? 'electroerosión' : 'fresado CNC');

/** El costo de referencia de la ganadora: con la tarifa de TU planta (MXN por centro) o, sin ella, la referencia del libro. */
export function costoDeReferencia(pkg: MoldPackage): CostoDeReferencia | null {
  const w = pkg.recomendacion;
  const v = pkg.variantes.find((x) => x.arch === w.arch && x.nCav === w.nCav);
  if (!v) return null;
  const h = horasDelModelo(v);
  const t: TarifasDeLaPlanta = pkg.spec.planta?.tarifas ?? {};
  const fMaq = factorDeMaquinado(pkg.spec);
  const cMaq = centroMaquinado(fMaq);
  const tMaq = cMaq === 'electroerosión' ? t.edmMXNh : t.fresadoMXNh;
  const fila = (centro: RenglonCosto['centro'], que: string, cita: string, horas: number | null, tarifa: number | undefined, nota?: string): RenglonCosto =>
    ({ centro, que, cita, horas, tarifaMXNh: tarifa ?? null, mxn: horas != null && tarifa != null ? horas * tarifa : null, nota });
  const renglones: RenglonCosto[] = [
    fila(cMaq, 'maquinado de insertos', `Eq 3.8-3.12 · f_maq ${fMaq} (Tabla 3.4${fMaq === MACHINING_FACTOR.edm ? ': EDM' : fMaq === MACHINING_FACTOR.fresado ? ': fresado' : ', entre fresado 1 y EDM 4 — regla de Hefestos por la complejidad Eq 3.12'}) · η 25 %`, h.maquinadoH, tMaq),
    fila('banco / ajuste', 'acabado de insertos (pulido)', 'Eq 3.13-3.14 · Tabla 3.6', h.acabadoH, t.bancoMXNh),
    fila('ingeniería', 'diseño del molde', '§3.3.3 · Eq 3.18', null, t.ingenieriaMXNh,
      'el modelo de Kazmer no separa horas de diseño: van dentro de la customización (Eq 3.18) con las compras — no se suman horas inventadas'),
  ];
  const conHoras = renglones.filter((r) => r.horas != null);
  const faltan = conHoras.filter((r) => r.tarifaMXNh == null).map((r) => `tu tarifa de ${r.centro}`);
  const algunaTarifa = conHoras.some((r) => r.tarifaMXNh != null);
  const modo: CostoDeReferencia['modo'] = algunaTarifa ? 'tu-tarifa' : 'referencia-libro';
  const totalMXN = algunaTarifa ? conHoras.reduce((s, r) => s + (r.mxn ?? 0), 0) : null;
  const c = v.cost;
  const kgAcero = c.cavity.volM3 * (pkg.metal.metal.rhoKgM3 ?? NaN) * v.nCav;
  const compras = [
    `acero de los insertos: ${Number.isFinite(kgAcero) ? `${Math.round(kgAcero)} kg de ` : ''}${pkg.metal.metal.key} (Eq 3.5-3.7 · Apéndice B)`,
    `base del molde: ${Math.round(c.moldBase.massKg)} kg de acero (Eq 3.14, Tabla 3.7)`,
    `customización: ${c.customization.sumCavity.toFixed(2)} × insertos + ${c.customization.sumMold.toFixed(2)} × base (Eq 3.18, Tablas 3.7-3.11; incluye la compra de componentes)`,
  ];
  const nombrePlanta = pkg.spec.planta?.nombre?.trim() || null;
  const rotulo = modo === 'tu-tarifa'
    ? `costo de referencia con TU tarifa (MXN)${nombrePlanta ? ` · ${nombrePlanta}` : ''} — no es oferta ni cotización de ningún taller`
    : `referencia del libro (Kazmer §3.3, USD: ${TARIFA_LIBRO_USDH.maquinado} $/h de maquinado y ${TARIFA_LIBRO_USDH.acabado} $/h de acabado del ejemplo; salario del Apéndice D ×3) — falta tu tarifa`;
  return {
    arch: v.arch, nCav: v.nCav, maquinadoH: h.maquinadoH, acabadoH: h.acabadoH, modo, rotulo, renglones,
    totalMXN, completo: algunaTarifa && faltan.length === 0, faltan, compras,
    referenciaUSD: { moldeUSD: c.totalUSD, insertosUSD: c.cavitiesUSD, baseUSD: c.moldBase.USD, customUSD: c.customization.USD,
      maquinadoUSDh: TARIFA_LIBRO_USDH.maquinado, acabadoUSDh: TARIFA_LIBRO_USDH.acabado },
    planta: nombrePlanta,
  };
}

/** Las horas de una variante en pesos con la tarifa de la planta (null si no capturó ninguna de los centros con horas). */
function horasEnPesos(pkg: MoldPackage, h: { maquinadoH: number; acabadoH: number }): number | null {
  const t = pkg.spec.planta?.tarifas ?? {};
  const tMaq = centroMaquinado(factorDeMaquinado(pkg.spec)) === 'electroerosión' ? t.edmMXNh : t.fresadoMXNh;
  if (tMaq == null && t.bancoMXNh == null) return null;
  return h.maquinadoH * (tMaq ?? 0) + h.acabadoH * (t.bancoMXNh ?? 0);
}

/** Una línea para la tarjeta del expediente y la ficha de la planta (lo que se lee de un vistazo). */
export function costoReferenciaLinea(c: CostoDeReferencia): string {
  const horas = Math.round(c.maquinadoH + c.acabadoH);
  if (c.modo === 'referencia-libro') return `${horas} h de insertos (Kazmer cap. 3) · referencia del libro ${usd(c.referenciaUSD.moldeUSD)} (${c.referenciaUSD.maquinadoUSDh} $/h) · falta tu tarifa`;
  const partes = c.renglones.filter((r) => r.horas != null).map((r) => r.mxn != null
    ? `${Math.round(r.horas!)} h ${r.centro} × $${r.tarifaMXNh!.toLocaleString('es-MX')}`
    : `${Math.round(r.horas!)} h ${r.centro} (falta tu tarifa)`);
  return `${mxn(c.totalMXN ?? 0)}${c.completo ? '' : ' (incompleto)'} de horas de taller: ${partes.join(' + ')} · Kazmer cap. 3 · no es cotización`;
}

/** La sección 3 del expediente (HTML imprimible). Dice cuál de los dos costos es. */
export function costoReferenciaHTML(c: CostoDeReferencia | null): string {
  const esc = (t: unknown) => String(t ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] as string));
  if (!c) return `<div class="falta">Sin costo de referencia: el molde (E1) no se armó para esta pieza.</div>`;
  const filas = c.renglones.map((r) => `<tr><td><b>${esc(r.centro)}</b><br><span class="muted">${esc(r.que)}</span></td>` +
    `<td>${r.horas != null ? `<b>${esc(Math.round(r.horas))} h</b>` : '<span class="muted">sin horas en el modelo</span>'}</td>` +
    `<td>${r.tarifaMXNh != null ? esc(mxn(r.tarifaMXNh)) + '/h' : '<span class="muted">falta tu tarifa</span>'}</td>` +
    `<td>${r.mxn != null ? `<b>${esc(mxn(r.mxn))}</b>` : '—'}</td><td class="muted">${esc(r.cita)}${r.nota ? '<br>' + esc(r.nota) : ''}</td></tr>`).join('');
  const tabla = `<table><tr><th>centro</th><th>horas (Kazmer cap. 3)</th><th>tu tarifa</th><th>horas × tarifa</th><th>de dónde</th></tr>${filas}</table>`;
  const cab = `<p><b>${esc(c.rotulo)}.</b> Arquitectura: ${esc(c.arch)} × ${esc(c.nCav)} cav (horas × ${esc(c.nCav)} cavidades × descuento de la Tabla 3.5).</p>`;
  const compras = `<p class="muted">Lo que no son horas y NO se suma: ${c.compras.map(esc).join(' · ')}. Los cotiza tu proveedor.</p>`;
  if (c.modo === 'tu-tarifa') {
    return cab + tabla +
      `<p><b>Total de horas de taller con tu tarifa: ${esc(mxn(c.totalMXN ?? 0))}</b>${c.completo ? '' : ` — <span class="VIOLA">incompleto, falta: ${esc(c.faltan.join(', '))}</span>`}.</p>` +
      compras +
      `<p class="muted">El costo por pieza no va: depende del ciclo, y el ciclo de lo más grueso es una ventana entre la cota de barra (Eq 9.6) y la de placa (Eq 9.5).</p>`;
  }
  const r = c.referenciaUSD;
  return cab + tabla +
    `<p class="falta"><b>Falta tu tarifa.</b> Sin ella el costo es la REFERENCIA del libro en dólares: insertos ${esc(usd(r.insertosUSD))} + base ${esc(usd(r.baseUSD))} + customización ${esc(usd(r.customUSD))} = <b>${esc(usd(r.moldeUSD))}</b> ` +
    `(Eq 3.2, con ${esc(r.maquinadoUSDh)} $/h de maquinado y ${esc(r.acabadoUSDh)} $/h de acabado del ejemplo del bezel, §3.3.1.3 y §3.3.1.5). No es la tarifa de ningún taller de México: captura la tuya en TU PLANTA (paso 2).</p>` +
    `<p class="muted">El costo por pieza tampoco va: depende del ciclo, y el ciclo de lo más grueso es una ventana entre la cota de barra (Eq 9.6) y la de placa (Eq 9.5).</p>`;
}

/** Deriva las decisiones que el libro exige del humano, con opciones del paquete. */
export function decisionesDelPaquete(pkg: MoldPackage, rep?: ContratoReporte, ens?: EnsambleMedido): Expediente {
  const D: Decision[] = [];
  const tryout: string[] = [];
  const spec = pkg.spec;

  // ── 1) Arquitectura y cavidades: el MENÚ, no un veredicto único — §3.2.2 ──
  const factibles = pkg.variantes.filter((v) => v.factible).slice(0, 3);
  const gano = pkg.recomendacion;
  D.push({
    id: 'arquitectura', tema: 'arquitectura y número de cavidades', cita: '§3.2.2 · §3.5',
    // sin dinero (LOS APAGONES): las horas de Kazmer cap. 3 por variante; con la tarifa de TU planta (orden G), sus pesos
    opciones: factibles.map((v) => {
      const h = horasDelModelo(v), $ = horasEnPesos(pkg, h);
      return `${v.arch} × ${v.nCav} cav — insertos: ${Math.round(h.maquinadoH)} h de maquinado + ${Math.round(h.acabadoH)} h de acabado (Kazmer cap. 3)${$ != null ? ` = ${mxn($)} con tu tarifa` : ''}`;
    }),
    eleccion: `${gano.arch} × ${gano.nCav} cav (recomendación por costo total; "the customer can be given more than one design")`,
    responsable: null, fecha: null,
    notas: [pkg.spec.cavPref != null ? `el cliente IMPUSO ${pkg.spec.cavPref} cavidades (§2.2.2)` : '', horasEnPesos(pkg, { maquinadoH: 0, acabadoH: 0 }) == null ? SIN_TARIFA : ''].filter(Boolean).join(' · '),
  });

  // ── 2) Escuela de steel-safe de contracción — §10.2.2 (ninguna es default) ──
  const sh = pkg.diseno.contraccion;
  const scaleLow = 1 / (1 - sh.lowPct / 100), scaleHigh = 1 / (1 - sh.highPct / 100);
  D.push({
    id: 'steel-safe-contraccion', tema: 'escuela de steel-safe para la contracción', cita: '§10.2.2',
    opciones: [
      `ASIMÉTRICO: cavidad ×${scaleLow.toFixed(5)} / núcleo ×${scaleHigh.toFixed(5)} — garantiza retrabajo (el tryout centra)`,
      `CONSTANTE: ambos ×${sh.moldScale.toFixed(5)} (nominal ${num(sh.nominalPct)} %) — confía en que el moldeador ajuste`,
    ],
    eleccion: null, responsable: null, fecha: null,
    notas: '"many mold designers prefer to use a constant but mid-range estimate" — el libro NO elige',
  });

  // ── 3) Responsable de la contracción — §10.1.7 (sin firma ⇒ prototipo) ──
  D.push({
    id: 'responsable-contraccion', tema: 'quién firma el número de contracción', cita: '§10.1.7',
    opciones: ['diseñador del molde', 'moldeador', 'cliente', 'NADIE firma → molde PROTOTIPO primero'],
    eleccion: spec.shrinkageResponsible ?? null,
    responsable: spec.shrinkageResponsible ?? null, fecha: null,
  });

  // ── 4) Vetos no económicos — §3.2.2 ──
  D.push({
    id: 'vetos', tema: 'vetos no económicos sobre el ganador del break-even', cita: '§3.2.2',
    opciones: ['sin vetos (elige el costo)', 'cambio de color frecuente (favorece hot runner / 3 placas)', 'payback máximo en meses', 'capacidad del moldeador'],
    eleccion: spec.vetos
      ? `declarados: ${[spec.vetos.cambioColorFrecuente ? 'cambio de color frecuente' : '', spec.vetos.paybackMaxMeses ? `payback ≤ ${spec.vetos.paybackMaxMeses} m` : '', spec.vetos.nota ?? ''].filter(Boolean).join(' · ') || 'sin vetos'}`
      : null,
    responsable: null, fecha: null,
  });

  // ── 5) Conflictos ABIERTOS del lazo de diseño: los arbitra el humano §1.2 ──
  const feed = pkg.diseno.alimentacion;
  if (feed.conflicto) {
    D.push({
      id: 'conflicto-feed', tema: 'conflicto abierto en la alimentación', cita: '§6.4.7 · §6.2.2 · §1.2',
      opciones: [
        'aceptar el ΔP alto (el runner no necesita la rigidez de la pieza §9.2.1)',
        'bajar ⌀ al catálogo y aceptar que la colada domine el ciclo',
        'rediseñar (otro tipo de alimentación / otra posición de gate)',
      ],
      eleccion: null, responsable: null, fecha: null,
      notas: feed.conflicto,
    });
  }
  const g = pkg.diseno.gate;
  if (g.freezeCorto) {
    D.push({
      id: 'gate-freeze', tema: 'el gate congela antes del empaque necesario', cita: '§7.1.5 · §7.3.5',
      opciones: [
        '(1) subir presión de empaque',
        '(2) engrosar el gate',
        '(3) adelgazar la pieza',
      ],
      eleccion: null, responsable: null, fecha: null,
      notas: `freeze ${num(g.freezeS)} s vs empaque necesario ${num(g.tPackNeededS)} s — remedios EN SU ORDEN §7.3.5`,
    });
  }

  // ── 6) Pilares↔placa: el menú §12.2.3 (la Máquina eligió por §12.1.3) ──
  // UN VEREDICTO (orden H, cambio 4): lo más grueso de la pieza pide más ciclo que el cotizado (§9.2.1, `agua-ciclo` ✗). Kazmer,
  // revisión de la película §2 punto 8: «si los postes son macizos, el ciclo lo fija la pieza (§2.3.1) y hay que avisarle al
  // cliente». No lo decide el software: lo firma quien cotiza, con el cliente.
  const sg = spec.seccionGruesa;
  const aguaCiclo = rep?.subsistemas.flatMap((s) => s.criterios).find((c) => c.id === 'agua-ciclo');
  if (sg && aguaCiclo?.estado === 'VIOLA') {
    D.push({
      id: 'ciclo-grueso', tema: 'el ciclo lo fija lo más grueso de tu pieza', cita: '§9.2.1 · §2.3.1',
      opciones: [
        `cotizar con ${num(sg.tcS, 1)} s (lo que pide lo más grueso: ${sg.forma === 'barra' ? 'poste, barra Eq 9.6' : 'losa, placa Eq 9.5'}) en vez de ${num(pkg.diseno.enfriamiento.cicloS, 1)} s`,
        `aligerar lo grueso (${num(sg.mm, 1)} mm en ${sg.lugares} lugar(es): vaciarlo por dentro, §2.3.1) — lo decide el cliente, es su pieza`,
        `cotizar con ${num(pkg.diseno.enfriamiento.cicloS, 1)} s y medir el ciclo real en el tryout (el riesgo lo asume quien firma)`,
      ],
      eleccion: null, responsable: null, fecha: null,
      notas: aguaCiclo.detalle,
    });
  }

  const sp = pkg.diseno.placas.soporte;
  const ops = (pkg.diseno.placas.soporteOpciones ?? []).filter((o) => o.plateThkMm != null).slice(0, 4);
  if (ops.length > 1) {
    D.push({
      id: 'pilares-placa', tema: 'combinación pilares ↔ espesor de placa de soporte', cita: '§12.2.3 · §12.1.3',
      opciones: ops.map((o) => `${o.nPillars} pilares · placa ${o.plateThkMm} mm · ${num(o.steelMassKg, 1)} kg de acero`),
      eleccion: `${sp.nPillars} pilares · placa ${sp.plateThkMm} mm · ${num(sp.steelMassKg, 1)} kg (auto: mínima masa §12.1.3)`,
      responsable: null, fecha: null,
    });
  }

  // ── EL PLAN DE TRYOUT: lo deliberadamente chico y hacia dónde crece ──
  if (g.agrandable && g.thicknessSteelSafeMm < g.thicknessMm) {
    tryout.push(`GATE ${g.type}: maquinar ${num(g.thicknessSteelSafeMm)} mm y abrir hasta ${num(g.thicknessMm)} mm si hay short shot o γ̇ alto (§7.3.5)`);
  }
  tryout.push(`VENTEO: arrancar en 0.02 mm en partición y abrir hacia h_max ${num(pkg.diseno.venteo.hMaxMm, 3)} mm si hay quemado (§8.3.1)`);
  if (ens?.planVenteo?.reservados.length) {
    tryout.push(`VENTEOS RESERVADOS: ${ens.planVenteo.reservados.length} ubicaciones documentadas, se abren en tryout si aparece quemado (§8.1)`);
  }
  const iter0 = feed.iteraciones[0];
  if (iter0) tryout.push(`COLADA: ⌀ base ${num(feed.diaBaseMm)} mm — solo se ABRE, nunca se cierra (§6.5.5); ${iter0.accion.slice(0, 90)}`);

  const pendientes = D.filter((d) => d.eleccion == null || (d.id === 'responsable-contraccion' && !d.responsable)).length;
  return {
    nombre: spec.name,
    decisiones: D,
    tryout,
    pendientes,
    cerrable: pendientes === 0,
  };
}

/** Registra una firma. Devuelve un expediente NUEVO (puro); rechaza opciones inexistentes. */
export function registrarDecision(exp: Expediente, id: string, eleccion: string, responsable: string, fecha: string): Expediente {
  const d = exp.decisiones.find((x) => x.id === id);
  if (!d) throw new Error(`decisión desconocida: ${id} (hay: ${exp.decisiones.map((x) => x.id).join(', ')})`);
  // la elección debe ser una de las opciones reales (o empezar igual: las opciones traen números largos)
  const valida = d.opciones.some((o) => o === eleccion || o.startsWith(eleccion) || eleccion.startsWith(o.split(' — ')[0].split(' (')[0]));
  if (!valida) throw new Error(`elección "${eleccion}" no está en las opciones de ${id}`);
  const decisiones = exp.decisiones.map((x) => x.id === id ? { ...x, eleccion, responsable, fecha } : x);
  const pendientes = decisiones.filter((x) => x.eleccion == null || (x.id === 'responsable-contraccion' && !x.responsable)).length;
  return { ...exp, decisiones, pendientes, cerrable: pendientes === 0 };
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * EL REPORTE DE ANÁLISIS (orden L, 2026-10-30) — como lo entrega la industria
 * ═══════════════════════════════════════════════════════════════════════════════
 * ian: «nuestro trabajo es darles TODO, no un PDF con medidas, sino videos y análisis de enfriamiento» · «empecemos por
 * entregar los documentos estándar». El análisis del molde se entrega por SECCIONES (resumen, material, proceso, llenado,
 * empaque, enfriamiento, alabeo/contracción, conclusiones): cada una con su imagen, su número de HOY contra su límite y su
 * cita. La Forja ya calculaba todos esos números; aquí sólo se ORDENAN, con tres reglas:
 *   1. UNA VERDAD: cada renglón con veredicto es un criterio del dictamen que juzga el molde (② en el acero, o ① si aún no
 *      hay molde, y se dice). Los renglones de DATO salen de los mismos objetos de los que el ② se re-juzga (la E5, la E6, las
 *      lentes, el paquete) — no se recalcula nada aquí.
 *   2. Nada se inventa: lo que el motor NO calcula (alabeo con mapa, empaque punto a punto, temperatura del acero…) va en
 *      «lo que NO se calculó» de su sección, dicho, no escondido. Lo nuestro sin cita se rotula «regla de Hefestos».
 *   3. La imagen es de la APP (el lienzo de la lente o de la estación); si esa vista no se abrió, la sección dice cuál abrir.
 * PURO → node-testeable: las imágenes las resuelve quien llama (la app guarda el álbum).
 */
export type EstadoRenglon = ContratoEstado | 'DATO';
export interface RenglonReporte {
  /** el nombre corto (el título del criterio, o qué dato es) */
  que: string;
  /** el número de HOY, con su unidad */
  hoy: string;
  /** contra qué se juzga ('—' si es un dato) */
  limite: string;
  estado: EstadoRenglon;
  /** § / Eq / Tabla de Kazmer (o «regla de Hefestos») */
  cita: string;
  /** la frase con los números (el detalle del criterio) */
  nota?: string;
  /** de dónde sale el número */
  fuente: string;
}
export type IdSeccion = 'resumen' | 'material' | 'proceso' | 'llenado' | 'empaque' | 'enfriamiento' | 'alabeo' | 'conclusiones';
export interface SeccionReporte {
  id: IdSeccion; n: number; titulo: string; cita: string;
  /** las imágenes que SÍ hay para esta sección (clave del álbum + qué enseña) */
  vistas: Array<{ clave: string; que: string }>;
  /** si no hay imagen: por qué, y qué abrir para tenerla */
  sinVista: string | null;
  renglones: RenglonReporte[];
  /** lo que el motor NO calcula para esta sección — dicho */
  noCalculado: string[];
}
export interface ReporteDeAnalisis {
  pieza: string;
  /** qué columna del dictamen juzga: el acero (con el molde) o la pieza sola */
  juzga: '② en el acero' | '① tu pieza sola';
  /** «falta el molde…» cuando juzga ① */
  aviso: string | null;
  secciones: SeccionReporte[];
  totales: { viola: number; advierte: number; cumple: number; sinCablear: number; conVista: number; sinVista: number };
}
/** Lo que la app sabe y el dictamen no trae como criterio — de los MISMOS objetos con que se re-juzga el ② (sin recalcular). */
export interface DatosDelReporte {
  /** el volumen con que dimensionaron la E5 y la E6 (EL VOLUMEN CORRECTO, orden L) */
  volumen?: { cc: number; fuente: string; voxE4Cc?: number } | null;
  /** el llenado del FAN de la E5 (desde la boquilla, colada ∪ pieza) */
  fan?: { pMaxMPa: number; tFillS: number; shortShot: boolean; incompleto: boolean } | null;
  lentes?: {
    pared?: { p50: number; max: number; titular: string; ref: string } | null;
    enfriamiento?: { titular: string; ref: string; paredMm: number; paredS: number; gruesoMm: number; forma: 'barra' | 'placa'; tcS: number; barraS: number; placaS: number; lugares: number } | null;
    llenado?: { lMaxMm: number; titular: string; ref: string; inalcanzables: number } | null;
  } | null;
  /** el agua que barrena la E6 (su calor y su circuito) */
  agua?: { masaG: number; qShotKJ: number; qCoolingW: number; tcCircuitoS: number; nLineas: number; diaMm: number; plug: string; nTramos: number;
    hAmm: number; hBmm: number; gpmTermico: number; gpmBombeado: number; manda: string; dMaxMm: number } | null;
  /** las vistas que la app tiene en su álbum (clave → qué enseña) */
  vistas: Record<string, string | undefined>;
}

/** las vistas de la app que alimentan el reporte: qué enseña cada una y qué hay que abrir para tenerla */
export const VISTAS_DEL_REPORTE: Record<string, { que: string; abre: string }> = {
  'molde': { que: 'el molde entero de tu pieza (estación 8, el portamoldes) en su ciclo', abre: 'arma el MOLDE (paso 6)' },
  'lente-pared': { que: 'la lente PARED: el espesor local medido de tu pieza (ámbar = se pasa de 1.25× el nominal, §2.3.1)', abre: 'abre la lente PARED' },
  'lente-enfriamiento': { que: 'la lente ENFRIAMIENTO en modo MAPA: los segundos que tarda cada punto en poder salir del molde (Eq 9.5 por vóxel; el tope del color es la cota de placa)', abre: 'abre la lente ENFRIAMIENTO (paso 3)' },
  'lente-llenado': { que: 'la lente LLENADO: cuánto corre el fundido desde la compuerta (L geodésica, §5.5.5)', abre: 'abre la lente LLENADO' },
  'llenado-e5': { que: 'la estación 5: el llenado del FAN desde la boquilla — bebedero y pieza en UN campo', abre: 'arma el MOLDE (paso 6)' },
  'agua': { que: 'la estación 6: el circuito de agua que se barrena en el acero', abre: 'arma el MOLDE (paso 6)' },
};

const fmtN = (x: number): string => {
  if (!Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  return a >= 1000 ? Math.round(x).toLocaleString('es-MX') : a >= 100 ? x.toFixed(0) : a >= 10 ? x.toFixed(1) : a >= 0.1 ? x.toFixed(2) : a === 0 ? '0' : x.toPrecision(2);
};
const conUnidad = (x: number, u?: string) => (u === '×H' || u === '×⌀' ? `${fmtN(x)}${u}` : u ? `${fmtN(x)} ${u}` : fmtN(x));

/** UN criterio del dictamen como renglón: su número, su límite, su estado y su cita — tal cual, sin recalcular. */
function renglonDeCriterio(c: Criterio | undefined, fuente: string): RenglonReporte | null {
  if (!c) return null;
  return {
    que: tituloCorto(c.id),
    hoy: c.medido != null ? conUnidad(c.medido, c.unidad) : c.estado === 'SIN-CABLEAR' ? 'no se mide' : '—',
    limite: c.limite != null ? conUnidad(c.limite, c.unidad) : '—',
    estado: c.estado, cita: c.cita,
    nota: c.detalle + (c.deuda ? ` · falta: ${c.deuda}` : ''),
    fuente,
  };
}
const dato = (que: string, hoy: string, cita: string, fuente: string, nota?: string, limite = '—'): RenglonReporte =>
  ({ que, hoy, limite, estado: 'DATO', cita, fuente, nota });

/** la decisión del expediente que resuelve cada rojo (si la hay) */
const DECISION_DEL_CRITERIO: Record<string, string> = {
  'feed-dp': 'conflicto-feed', 'feed-ciclo': 'conflicto-feed', 'feed-lazo': 'conflicto-feed',
  'gate-freeze': 'gate-freeze', 'agua-ciclo': 'ciclo-grueso',
};

/**
 * Arma el reporte. `rev` = el dictamen del paso 4 (①); `rj` = el re-juicio con el molde (②) o null. Sin `rev` no hay reporte:
 * cada veredicto sale del dictamen (quien llama dice «abre EL DICTAMEN»).
 */
export function reporteDeAnalisis(rev: RevisionModelo, rj: RevisionModelo | null, datos: DatosDelReporte): ReporteDeAnalisis {
  const R = rj ?? rev;
  const juzga: ReporteDeAnalisis['juzga'] = rj ? '② en el acero' : '① tu pieza sola';
  const fuenteR = rj ? '② el dictamen en el acero' : '① el dictamen de tu pieza sola';
  const criterios = new Map<string, Criterio>(R.contratos.subsistemas.flatMap((s) => s.criterios).map((c) => [c.id, c]));
  const de = (...ids: string[]) => ids.map((id) => renglonDeCriterio(criterios.get(id), fuenteR)).filter((x): x is RenglonReporte => !!x);
  const pkg = R.pkg, spec = R.spec, dz = pkg.diseno;
  const sinMolde = 'falta el molde: arma el MOLDE (paso 6)';
  const vistasDe = (claves: Array<string | [string, string]>): Pick<SeccionReporte, 'vistas' | 'sinVista'> => {
    const hay: Array<{ clave: string; que: string }> = [];
    const faltan: string[] = [];
    for (const k of claves) {
      const [clave, queOtro] = Array.isArray(k) ? k : [k, undefined];
      const v = VISTAS_DEL_REPORTE[clave];
      if (datos.vistas[clave] != null) hay.push({ clave, que: queOtro ?? datos.vistas[clave] ?? v?.que ?? clave });
      else if (v) faltan.push(v.abre);
    }
    return { vistas: hay, sinVista: hay.length ? null : `falta la vista: ${[...new Set(faltan)].join(' o ')} y vuelve a abrir el expediente` };
  };
  const secciones: SeccionReporte[] = [];

  // ── 1 · RESUMEN ──
  {
    const viol = R.contratos.subsistemas.flatMap((s) => s.criterios).filter((c) => c.estado === 'VIOLA');
    const f = R.fila;
    const v = datos.volumen;
    secciones.push({
      id: 'resumen', n: 1, titulo: 'Resumen', cita: '§13 · §13.10',
      ...vistasDe(['molde', 'lente-pared']),
      renglones: [
        dato('tu pieza', `${fmtN(spec.Lmm)} × ${fmtN(spec.Wmm)} × ${fmtN(spec.Hmm)} mm · ${(spec.volumeMm3 / 1000).toFixed(1)} cc · pared ${fmtN(spec.wallMm)} mm · ${spec.plastic}`,
          '§2.1.5', 'tu STEP (el sólido, OCCT) + la lente PARED (la pared nominal)'),
        dato('el molde', `${pkg.recomendacion.arch} × ${pkg.recomendacion.nCav} cav · acero ${pkg.metal.metal.key}`, '§3.2.2 · §3.5', fuenteR),
        { que: 'el veredicto', hoy: `${f.score}/100 · ✗ ${f.viola} · ⚠ ${f.advierte} · ✓ ${f.cumple} · 🔌 ${f.sinCablear}`, limite: '0 ✗',
          estado: f.viola > 0 ? 'VIOLA' : f.advierte > 0 ? 'ADVIERTE' : 'CUMPLE', cita: '§13', fuente: fuenteR,
          nota: viol.length ? `no cumplen: ${viol.map((c) => `${tituloCorto(c.id)} (${c.cita})`).join(' · ')}` : 'ningún criterio viola' },
        ...(rj ? [dato('① sin el molde', `${rev.fila.score}/100 · ✗ ${rev.fila.viola} · ⚠ ${rev.fila.advierte}`, '§13', '① el dictamen de tu pieza sola (paso 4)',
          'la misma pieza juzgada con su diseño numérico, antes de cortar el acero')] : []),
        ...(v ? [dato('el volumen con que se dimensionan la colada y el agua', `${fmtN(v.cc)} cc (${v.fuente})`, '§6.4.6 · Eq 9.10', 'la estación 5 → la estación 6',
          v.voxE4Cc != null && Math.abs(v.voxE4Cc - v.cc) > 0.25 * v.cc
            ? `la rejilla del llenado de la estación 4 trae ${fmtN(v.voxE4Cc)} cc: no se usa (se queda como testigo)` : undefined)] : []),
      ],
      noCalculado: [
        'No es una simulación 3D acoplada de llenado, empaque, enfriamiento y alabeo: cada número es una ecuación del libro de Kazmer sobre la geometría MEDIDA de tu pieza; donde el libro no da número, la sección lo dice.',
        ...(rj ? [] : ['Sin el molde, todo se juzga con el diseño numérico (①): el llenado de la estación 5, el agua de la estación 6 y el bebedero que se corta no existen todavía.']),
      ],
    });
  }

  // ── 2 · MATERIAL ──
  {
    const renglones: RenglonReporte[] = [];
    const noCalc: string[] = ['La resina la declara el intake (o tu planta): no se mide el lote real.'];
    try {
      const m = motorDeLaResina(spec.plastic), f = m.ficha;
      const ap = `Apéndice A ${f.paginas}`;
      renglones.push(
        dato('resina', `${f.nombre} · ${f.comercial} (${f.proveedor})`, ap, 'la ficha del libro'),
        dato('densidad', `${f.rho20KgM3} kg/m³ a 20 °C · ${f.rhoFundidoKgM3} fundido`, ap, 'la ficha del libro', 'la de 20 °C da la masa del disparo (Eq 9.10)'),
        dato('térmicas', `cp ${f.cpJkgC} J/kg·°C · k ${f.kWmC} W/m·°C · α ${f.alphaM2s.toExponential(2)} m²/s`, ap, 'la ficha del libro'),
        dato('temperaturas', `fundido ${f.fundidoMinC}–${f.fundidoMaxC} °C · no-flujo ${f.noFlujoC} °C · expulsión (DTUL) ${f.dtulC} °C · refrigerante ${f.refrigeranteMinC}–${f.refrigeranteMaxC} °C`, ap, 'la ficha del libro'),
        dato('viscosidad', `power-law n ${f.powerN} · k ${fmtN(f.powerK)} Pa·sⁿ · Cross-WLF n ${f.wlf.n} · τ* ${fmtN(f.wlf.tauStarPa)} Pa`, `${ap} · Eq 5.22`, 'la ficha del libro'),
        dato('corte máximo', `${fmtN(f.corteMaxS)} 1/s`, `${ap} · Tabla 7.2`, 'la ficha del libro'),
        dato('contracción del proveedor', `${f.contraccionMinPct}–${f.contraccionMaxPct} %`, ap, 'la ficha del libro', 'la del cálculo (Tait, cap 10) va en ALABEO Y CONTRACCIÓN'),
      );
      if (f.clave === 'ABS') noCalc.push('El ABS conserva los números con que el libro RESUELVE sus ejemplos (power-law del cap 5, Tait de p.240, α y T_eject del cap 9): con ellos se verificó el motor.');
      noCalc.push('El llenado del FAN usa una viscosidad newtoniana EFECTIVA calibrada a la Eq 5.22 en el punto de operación; la ficha Cross-WLF entra por la velocidad (§5.5.1), no punto a punto.');
    } catch (e) {
      renglones.push(dato('resina', String(spec.plastic), 'Apéndice A', 'la ficha del libro', `sin ficha: ${String(e instanceof Error ? e.message : e).slice(0, 120)}`));
    }
    secciones.push({ id: 'material', n: 2, titulo: 'Material', cita: 'Apéndice A (p.390-393)',
      vistas: [], sinVista: 'la ficha del material no tiene lienzo: es la tabla del Apéndice A; su efecto se ve en las lentes PARED y ENFRIAMIENTO',
      renglones, noCalculado: noCalc });
  }

  // ── 3 · PROCESO ──
  {
    const sel = dz.maquina.seleccion, req = dz.maquina.requerimientos;
    let temps = '';
    try { const c = motorDeLaResina(spec.plastic).cooling; temps = `fundido ${fmtN(c.tMelt)} °C · agua ${fmtN(c.tCoolant)} °C · expulsión ${fmtN(c.tEject)} °C`; } catch { temps = '—'; }
    secciones.push({
      id: 'proceso', n: 3, titulo: 'Proceso', cita: '§5.5 · §4.3.3 · §6.3.1',
      ...vistasDe(['molde']),
      renglones: [
        dato('temperaturas del proceso', temps, 'Apéndice A · §9.2.1', 'la ficha de la resina (las que usan las ecuaciones del cap 9)'),
        dato('tiempo de llenado', '1 s', '§6.4.6', 'la convención de los ejemplos del libro', 'V̇ = V / t_llenado: no se optimiza — la presión del llenado es la de ese caudal'),
        dato('presión de llenado', `${fmtN(dz.fillMPa)} MPa`, '§5.5', fuenteR, dz.fillRotulo),
        dato('presión de empaque', `${fmtN(dz.packMPa)} MPa`, '§5.5.3', fuenteR, dz.packFuente === 'declarada' ? 'declarada en el intake' : '«in the vicinity of 50 MPa» (§5.5.3): editable en el intake'),
        dato('tiempo de empaque que pide la pared', `${fmtN(dz.gate.tPackNeededS)} s`, '§7.1.5 · Eq 9.5', fuenteR),
        dato('ciclo cotizado', `${fmtN(dz.enfriamiento.cicloS)} s`, 'Eq 3.23', fuenteR, 'el que usa la cotización (sólo ve la pared); lo más grueso se juzga en ENFRIAMIENTO'),
        dato('la máquina', sel.machine ? `${sel.machine.name} · ${fmtN(sel.machine.clampTons)} t · cierre ${fmtN(sel.clampUtilPct)} % · disparo ${fmtN(sel.shotPct)} % · abre ${sel.apertura.strokeMm.toFixed(1)} mm` : 'ninguna cabe',
          '§4.3.3 · §6.3.1 · Tabla 6.1', fuenteR, `pide ${fmtN(req.clampNeedTons)} t de cierre y ${fmtN(req.shotNeedCc)} cc de disparo`),
        ...de('llenado-tonelaje', 'layout-maquina', 'layout-shot-ventana'),
      ],
      noCalculado: [
        'El perfil del husillo (velocidades por etapa), el cambio a presión (V/P), el sostenimiento y el empaque por etapas: el proceso se juzga con UNA presión de empaque y el tiempo de empaque que pide la pared.',
        'La ventana de proceso (el rango de temperaturas y presiones que da pieza buena) no se barre: hay un punto de operación, no una ventana.',
      ],
    });
  }

  // ── 4 · LLENADO ──
  {
    const fan = datos.fan, ll = datos.lentes?.llenado, pa = datos.lentes?.pared;
    secciones.push({
      id: 'llenado', n: 4, titulo: 'Llenado', cita: 'cap 5 · cap 6 · cap 8',
      ...vistasDe(['lente-llenado', 'llenado-e5']),
      renglones: [
        fan
          ? { que: 'el llenado desde la boquilla (FAN)', hoy: `${fmtN(fan.pMaxMPa)} MPa · llena en ${fmtN(fan.tFillS)} s`, limite: '—',
              estado: fan.shortShot || fan.incompleto ? 'VIOLA' : 'DATO', cita: '§5.5 · Hele-Shaw (FAN)', fuente: 'la estación 5 (colada ∪ pieza en un campo)',
              nota: fan.shortShot ? 'TIRO CORTO: el frente tocó el tope de presión de la máquina' : fan.incompleto ? 'el llenado no terminó' : 'llena completo; es la p_fill con que se re-juzga el ②' }
          : dato('el llenado desde la boquilla (FAN)', 'no existe todavía', '§5.5', 'la estación 5', sinMolde),
        ll
          ? dato('lo más lejos que corre el fundido', `${fmtN(ll.lMaxMm)} mm${pa && pa.p50 > 0 ? ` · L/t ${fmtN(ll.lMaxMm / pa.p50)}:1` : ''}`, '§5.5.5', 'la lente LLENADO',
            ll.inalcanzables > 0 ? `${ll.inalcanzables} punto(s) sin camino a la compuerta: short shot` : ll.titular)
          : dato('lo más lejos que corre el fundido', 'no se abrió', '§5.5.5', 'la lente LLENADO', 'abre la lente LLENADO'),
        ...de('llenado-techo', 'llenado-cola-baja', 'llenado-velocidad', 'llenado-convergencia', 'llenado-area-proyectada',
          'feed-dp', 'feed-shear', 'feed-reynolds', 'feed-volumen', 'feed-boquilla', 'vent-espesor', 'vent-ubicaciones', 'vent-flujo-completo'),
      ],
      noCalculado: [
        'El llenado es isotérmico: el frente no se frena por frío (la capa congelada existe en el banco, «N2 térmico», pero no corre en tu pieza).',
        'Las líneas de soldadura y las trampas de aire no se calculan: la lente marca lo último en llenarse, que es donde caen.',
        'El venteo se dimensiona (espesor §8.2.3) y se enumeran sus lugares, pero sin la anatomía de cada salida (canal de alivio, profundidad, a dónde descarga).',
      ],
    });
  }

  // ── 5 · EMPAQUE ──
  {
    secciones.push({
      id: 'empaque', n: 5, titulo: 'Empaque', cita: 'cap 7 · §5.5.3',
      ...vistasDe([['llenado-e5', 'la estación 5: la colada que se corta — en sprue directo su base ES la compuerta (§7.2.1)']]),
      renglones: [
        dato('presión de empaque', `${fmtN(dz.packMPa)} MPa`, '§5.5.3', fuenteR, dz.packFuente === 'declarada' ? 'declarada en el intake' : 'por defecto (§5.5.3), editable'),
        dato('tiempo de empaque que pide la pared', `${fmtN(dz.gate.tPackNeededS)} s`, '§7.1.5', fuenteR),
        ...de('gate-freeze', 'gate-tipo', 'gate-shear', 'gate-dp', 'gate-steel-safe', 'gate-degatado', 'gate-escala-nivel'),
      ],
      noCalculado: [
        'No hay solver de empaque: la presión en la cavidad durante el empaque no se resuelve punto a punto; la contracción se evalúa a UNA presión (Tait).',
        'El rechupe no se mapea: la compuerta se juzga por su congelamiento (Tabla 7.4) contra el tiempo de empaque que pide la pared.',
      ],
    });
  }

  // ── 6 · ENFRIAMIENTO ──
  {
    const le = datos.lentes?.enfriamiento, a = datos.agua;
    secciones.push({
      id: 'enfriamiento', n: 6, titulo: 'Enfriamiento', cita: 'cap 9',
      ...vistasDe(['lente-enfriamiento', 'agua']),
      renglones: [
        le
          ? dato('cuánto tarda en poder salir', `pared ${fmtN(le.paredMm)} mm: ${fmtN(le.paredS)} s · lo más grueso ${fmtN(le.gruesoMm)} mm${le.lugares > 1 ? ` (${le.lugares} lugares)` : ''}: ${fmtN(le.tcS)} s`,
            le.forma === 'barra' ? 'Eq 9.5 · Eq 9.6' : 'Eq 9.5', 'la lente ENFRIAMIENTO',
            `lo más grueso es ${le.forma === 'barra' ? `un POSTE: barra (Eq 9.6) ${fmtN(le.barraS)} s; la placa (Eq 9.5) ${fmtN(le.placaS)} s es la cota alta` : `una LOSA: placa (Eq 9.5) ${fmtN(le.placaS)} s; la barra ${fmtN(le.barraS)} s es la cota baja`}`)
          : dato('cuánto tarda en poder salir', 'no se abrió', '§9.2.1', 'la lente ENFRIAMIENTO', 'abre la lente ENFRIAMIENTO (paso 3)'),
        a
          ? dato('el calor de cada disparo', `${fmtN(a.masaG)} g → ${fmtN(a.qShotKJ)} kJ → ${fmtN(a.qCoolingW)} W`, 'Eq 9.10 · Eq 9.11', 'la estación 6 (con el volumen de la pieza de la estación 5)',
            `potencia = calor / t_c del circuito (${fmtN(a.tcCircuitoS)} s); la masa es pieza + colada a 20 °C`)
          : dato('el calor de cada disparo', 'no existe todavía', 'Eq 9.10', 'la estación 6', sinMolde),
        a
          ? dato('el circuito', `${a.nLineas} líneas ⌀${a.diaMm} (${a.plug}) · ${a.nTramos} tramos · anillo A a ${fmtN(a.hAmm)} mm · serpentina B a ${fmtN(a.hBmm)} mm`, '§9.2.4–9.2.7', 'la estación 6 (lo que se barrena)')
          : dato('el circuito', 'no existe todavía', '§9.2.4', 'la estación 6', sinMolde),
        a
          ? dato('el caudal', `térmico ${fmtN(a.gpmTermico)} GPM/línea · bombeado ${fmtN(a.gpmBombeado)} GPM/línea`, 'Eq 9.13 · Eq 9.14 · Eq 9.15', 'la estación 6',
            `manda la ${a.manda}: con el caudal térmico el ⌀ máximo turbulento sería ${fmtN(a.dMaxMm)} mm; se bombea para Re 4000 (extensión declarada de la estación 6)`)
          : dato('el caudal', 'no existe todavía', 'Eq 9.13', 'la estación 6', sinMolde),
        ...de('agua-ciclo', 'feed-ciclo', 'agua-paso', 'agua-profundidad', 'agua-diametro', 'agua-turbulento', 'agua-claro', 'agua-controlador', 'agua-conexiones', 'agua-catalogo'),
      ],
      noCalculado: [
        'El mapa es conducción por punto con el acero a la temperatura del agua (Eq 9.5; Eq 9.6 para lo más grueso): el acero NO se simula — la temperatura de placas e insertos y la diferencia núcleo↔cavidad no se resuelven.',
        'El calor por disparo es el balance del libro (Eq 9.10-9.11), no un transitorio ciclo a ciclo; en máquina el ciclo sale mayor (resistencia de contacto: nota 1 §9.2.1).',
      ],
    });
  }

  // ── 7 · ALABEO Y CONTRACCIÓN ──
  {
    const sh = dz.contraccion;
    secciones.push({
      id: 'alabeo', n: 7, titulo: 'Alabeo y contracción', cita: 'cap 10',
      ...vistasDe([['lente-pared', 'la lente PARED: el espesor es la CAUSA de la contracción despareja — no es un mapa de alabeo']]),
      renglones: [
        dato('contracción lineal', `${sh.nominalPct.toFixed(2)} % a ${fmtN(sh.pNominalMPa)} MPa · rango ${sh.lowPct.toFixed(2)} a ${sh.highPct.toFixed(2)} %`, '§10.1.6 · Tait', fuenteR,
          `el molde se escala ×${sh.moldScale.toFixed(5)} · ${sh.pNominalFuente === 'p_pack' ? 'a la presión de empaque' : 'a 0.8·p_fill (§10.1.2)'}`),
        ...de('contr-positiva', 'contr-rango', 'contr-steel-safe', 'contr-responsable', 'contr-warpage-topologia'),
        { que: 'el alabeo de tu pieza', hoy: 'no se calcula', limite: '—', estado: 'SIN-MÓDULO', cita: 'Ec. 10.17-10.20', fuente: 'el motor no lo tiene',
          nota: 'la lámina de alabeo del dictamen enseña la SENSIBILIDAD con el ejemplo del libro (2 °C núcleo↔cavidad), no el número de tu pieza' },
      ],
      noCalculado: [
        'SIN mapa de alabeo: la Ec. 10.19 pide la contracción en el centro y en la orilla de UN disparo (sale del empaque punto a punto, que no existe) y la Ec. 10.17 pide la diferencia de temperatura núcleo↔cavidad (sale de simular el acero, que no existe).',
        'La contracción es UNA cifra isotrópica (Tait a una presión): sin orientación de flujo ni de fibra.',
      ],
    });
  }

  // ── 8 · CONCLUSIONES ──
  {
    const todos = R.contratos.subsistemas.flatMap((s) => s.criterios);
    const decisiones = new Map(R.expediente.decisiones.map((d) => [d.id, d]));
    const rojos = todos.filter((c) => c.estado === 'VIOLA').map((c) => {
      const r = renglonDeCriterio(c, fuenteR)!;
      const d = decisiones.get(DECISION_DEL_CRITERIO[c.id] ?? '');
      return { ...r, nota: d ? `se decide en el expediente: «${d.tema}» (${d.cita}) — ${d.eleccion ?? 'pendiente de firma'}` : 'sin decisión en el expediente: es un ajuste del diseño del molde, no del cliente' };
    });
    const avisos = todos.filter((c) => c.estado === 'ADVIERTE');
    secciones.push({
      id: 'conclusiones', n: 8, titulo: 'Conclusiones', cita: '§13.10 · §1.2',
      vistas: [], sinVista: 'las conclusiones no tienen lienzo: son la lista de lo que hay que decidir, con su número',
      renglones: [
        ...rojos,
        dato('de panzazo o con aviso', `${avisos.length}`, '§13', fuenteR, avisos.map((c) => `${tituloCorto(c.id)} (${c.cita})`).join(' · ') || undefined),
        dato('decisiones por firmar', `${R.expediente.pendientes} de ${R.expediente.decisiones.length}`, '§13.10', fuenteR,
          R.expediente.cerrable ? 'cerrable' : 'el expediente no cierra con pendientes: no se fabrica sin la firma del moldista responsable'),
      ],
      noCalculado: ['El reporte no decide: los rojos con decisión los firma el moldista (§13.10); los que no tienen decisión son ajustes del diseño.'],
    });
  }

  const f = R.fila;
  const conVista = secciones.filter((s) => s.vistas.length).length;
  return {
    pieza: spec.name, juzga,
    aviso: rj ? null : 'falta el molde: este reporte juzga tu pieza sola (①). Arma el MOLDE (paso 6) para juzgar el acero (②) con el llenado de la estación 5 y el agua de la estación 6.',
    secciones,
    totales: { viola: f.viola, advierte: f.advierte, cumple: f.cumple, sinCablear: f.sinCablear, conVista, sinVista: secciones.length - conVista },
  };
}

/** El reporte como HTML imprimible (una sección por página). `img(clave)` devuelve la imagen del álbum (data URL) o nada. */
export function reporteDeAnalisisHTML(r: ReporteDeAnalisis, img: (clave: string) => string | undefined): string {
  const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
  const ico: Record<EstadoRenglon, string> = { 'CUMPLE': '✓', 'ADVIERTE': '⚠', 'VIOLA': '✗', 'SIN-CABLEAR': '🔌', 'SIN-MÓDULO': '∅', 'DATO': '·' };
  const css = `<style>.ra-sec{page-break-before:always;margin-top:18px}.ra-sec h3{font-size:14px;margin:0 0 6px;letter-spacing:.04em}` +
    `.ra-vistas{display:flex;gap:10px;margin:6px 0 10px}.ra-vistas figure{margin:0;flex:1;max-width:50%}.ra-vistas img{width:100%;border-radius:4px;border:1px solid #ccc}` +
    `.ra-vistas figcaption{font-size:10.5px;color:#666;margin-top:2px}.ra-no{background:#f6f6f6;border-left:3px solid #999;padding:6px 10px;font-size:11px;margin-top:8px}` +
    `.ra-t td.n{white-space:nowrap;font-weight:700}.ra-t .nota{color:#555;font-size:10.5px}.DATO{color:#333}.SIN-CABLEAR,.SIN-MÓDULO{color:#2b5ca8;font-weight:700}</style>`;
  const sec = (s: SeccionReporte) => {
    const vistas = s.vistas.map((v) => ({ v, src: img(v.clave) })).filter((x) => x.src);
    const fig = vistas.length
      ? `<div class="ra-vistas">${vistas.map(({ v, src }) => `<figure><img src="${src}" alt="${esc(v.que)}"><figcaption>${esc(v.que)}</figcaption></figure>`).join('')}</div>`
      : `<p class="falta">${esc(s.sinVista ?? 'sin imagen')}</p>`;
    const filas = s.renglones.map((x) => `<tr><td><b>${esc(x.que)}</b>${x.nota ? `<div class="nota">${esc(x.nota)}</div>` : ''}</td>` +
      `<td class="n">${esc(x.hoy)}</td><td class="n">${esc(x.limite)}</td><td class="${esc(x.estado)}">${ico[x.estado]} ${x.estado === 'DATO' ? 'dato' : esc(x.estado)}</td>` +
      `<td>${esc(x.cita)}</td><td class="muted">${esc(x.fuente)}</td></tr>`).join('');
    return `<div class="ra-sec" data-seccion="${s.id}"><h3>${s.n} · ${esc(s.titulo)} <span class="muted">(${esc(s.cita)})</span></h3>${fig}` +
      `<table class="ra-t"><tr><th>qué</th><th>hoy</th><th>límite</th><th>estado</th><th>Kazmer</th><th>de dónde</th></tr>${filas}</table>` +
      `<div class="ra-no"><b>Lo que NO se calculó:</b> ${s.noCalculado.map(esc).join(' ')}</div></div>`;
  };
  const t = r.totales;
  return css + `<h2>Reporte de análisis — ${esc(r.juzga)}</h2>` +
    `<p>${esc(r.pieza)} · ✗ ${t.viola} · ⚠ ${t.advierte} · ✓ ${t.cumple} · 🔌 ${t.sinCablear} · ${t.conVista} de ${r.secciones.length} secciones con imagen de la app. ` +
    `Cada veredicto es un criterio del dictamen (${esc(r.juzga)}); los datos salen de las mismas estaciones con que se re-juzga. Lo nuestro sin cita va rotulado «regla de Hefestos».</p>` +
    (r.aviso ? `<p class="falta">${esc(r.aviso)}</p>` : '') +
    r.secciones.map(sec).join('');
}
