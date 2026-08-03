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
import type { MoldPackage } from './moldmachine';
import type { ContratoReporte, EnsambleMedido } from './mold-contratos';

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
    opciones: factibles.map((v) => `${v.arch} × ${v.nCav} cav — molde $${Math.round(v.moldUSD).toLocaleString('en-US')} · pieza $${v.partUSD.toFixed(4)}`),
    eleccion: `${gano.arch} × ${gano.nCav} cav (recomendación por costo total; "the customer can be given more than one design")`,
    responsable: null, fecha: null,
    notas: pkg.spec.cavPref != null ? `el cliente IMPUSO ${pkg.spec.cavPref} cavidades (§2.2.2)` : undefined,
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
