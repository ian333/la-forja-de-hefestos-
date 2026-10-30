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
