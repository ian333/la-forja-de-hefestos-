/**
 * INTERLOCKS — el AUTOCENTRADO del molde (user 2026-07-15: "el autocentrado debe ayudar
 * AL ARMADO DEL MOLDE PARA QUE ESTÉ TODO CENTRADO"; su dolor real: "es un PEDO MAQUINAR,
 * ya me chingué como 10 cortadores"). La idea que pidió: si las mitades se BUSCAN SOLAS
 * al cerrar, el error de maquinado se corrige en el armado en vez de exigir precisión
 * imposible en cada barreno.
 *
 * Kazmer §12.2.5 "Interlocks" — LITERAL:
 *  · "Both types of interlocks should be placed on the PARTING PLANE and as CLOSE TO THE
 *     MOLD CAVITIES AS POSSIBLE."
 *  · "the male interlock is fit into a THROUGH HOLE in the B plate... the female interlock
 *     is fit into a BLIND POCKET in the deeper A plate. Both interlocks tightly fit into
 *     the surrounding plates, and are retained in the height direction with SHCS."
 *  · "the RECTANGULAR interlock will provide greater resistance to deflection due to its
 *     larger size... However, ROUND interlocks are available in smaller sizes and are
 *     EASIER TO INSTALL." ← esto último importa: el user odia maquinar.
 *  · "the LARGEST interlock should be used that can be readily incorporated."
 *  · "It is important that the mold designer does not JEOPARDIZE THE STRUCTURAL INTEGRITY
 *     of the side wall by removing excess mold material."
 *  · PAGO CUANTIFICADO: "the use of the interlock effectively DOUBLES THE STIFFNESS of the
 *     side wall, resulting in a HALVING of the amount of the side wall deflection."
 *  · Eq 12.18: τ_interlock = F_lateral / A_interlock  ·  S7 ⇒ límite 300 MPa
 *  · F_lateral (estimación CONSERVADORA del libro): "half of the force will be carried by
 *     the interlock" ⇒ F = ½ · P_melt · ⌀ · H_cavity
 *
 * Kazmer §4.1.3 (superficie de partición):
 *  · "interlocking features on the parting plane should be INCLINED AT LEAST FIVE DEGREES
 *     relative to the mold opening direction" — si van a 0° la fuerza de cierre los TRABA
 *     ("lock together with extreme force") y deforma el molde.
 */
import type { MoldAssemblySpec } from './mold-assembly';
// insertDims viene de mold-drawing-set, NO de mold-plano-set: plano-set importa
// `planInterlocks` de este archivo ⇒ sería un ciclo (y reventaba el bundle por TDZ).
import { plateDefs, plateDepth, standardHoles, insertDims } from './mold-drawing-set';

/** límite de cortante del S7 (acero de herramienta del libro para interlocks). */
export const TAU_LIMIT_S7_MPA = 300;
/** §4.1.3: mínimo 5° respecto a la dirección de apertura. */
export const MIN_ANGLE_DEG = 5;

/** Interlocks REDONDOS comerciales (pulgada — así se compran). El libro usa ⌀19.05 (3/4")
 *  en su ejemplo del vaso. */
export const ROUND_INTERLOCKS_MM = [12.7, 15.875, 19.05, 25.4, 31.75];

export type InterlockKind = 'redondo' | 'rectangular';

/**
 * Eq 12.18 + la estimación conservadora de F_lateral del libro. REPRODUCE el ejemplo
 * resuelto del vaso: 40 MPa · ⌀19.05 · H50 → F = 19,050 N → τ = 67 MPa.
 * `widthMm` = el ANCHO del interlock que "ve" la pared (⌀ si es redondo).
 */
export function interlockShear(pMeltMPa: number, widthMm: number, hCavityMm: number, areaMm2: number) {
  // "half of the force will be carried by the interlock" (estimación conservadora)
  const fLateralN = 0.5 * pMeltMPa * widthMm * hCavityMm;    // MPa·mm² = N
  const tauMPa = fLateralN / areaMm2;                        // N/mm² = MPa
  return { fLateralN: +fLateralN.toFixed(0), tauMPa: +tauMPa.toFixed(1) };
}

const areaRound = (d: number) => (Math.PI * d * d) / 4;

export interface InterlockPlan {
  kind: InterlockKind;
  desig: string;
  diaMm?: number; wMm?: number; hMm?: number;
  areaMm2: number;
  angleDeg: number;
  pMeltMPa: number; hCavityMm: number;
  fLateralN: number; tauMPa: number; limitMPa: number;
  ok: boolean;
  /** cuántos y DÓNDE — plano de partición, lo más cerca de la cavidad que se pueda */
  positions: Array<{ x: number; y: number }>;
  zPartMm: number;
  /** macho: barreno PASANTE en B · hembra: bolsa CIEGA en A (§12.2.5) */
  male: { plate: 'B'; through: true; depthMm: number };
  female: { plate: 'A'; through: false; depthMm: number };
  /** el pago que promete el libro */
  benefit: string;
  candidates: Array<{ desig: string; areaMm2: number; tauMPa: number; ok: boolean; why: string }>;
  why: string[];
}

/**
 * PLAN de interlocks para el molde. Elige el MÁS GRANDE que aguanta y que CABE en la
 * pared disponible sin comerse el acero (§12.2.5: "does not jeopardize the structural
 * integrity of the side wall"), y los coloca en el plano de partición pegados al inserto.
 */
export function planInterlocks(spec: MoldAssemblySpec, o?: { pMeltMPa?: number }): InterlockPlan {
  // TODO lo que ya existe en esas coordenadas: la tornillería de AMBAS mitades. Sin
  // esto el interlock se encima con un perno y nadie se entera hasta el taller.
  const obstacles = [...standardHoles(spec, 'clamp'), ...standardHoles(spec, 'bottom')]
    .filter((h) => /tornillo/.test(h.type)).map((h) => ({ x: h.x, y: h.y, dia: h.dia }));
  const defs = plateDefs(spec), thick = (r: string) => defs.find((d) => d.role === r)?.thick ?? 40;
  const W = spec.widthMm, D = plateDepth(spec);
  const ins = insertDims(spec);
  const hCav = spec.cavity.depthMm;
  const pMelt = o?.pMeltMPa ?? 40;                 // el libro usa 40 MPa en el ejemplo

  // pared disponible entre el inserto y el canto de placa (donde caben los interlocks)
  const rimX = (W - ins.ifx) / 2, rimY = (D - ins.ify) / 2;
  const rim = Math.min(rimX, rimY);

  // candidatos: el MÁS GRANDE que aguanta Y que cabe en la pared (§12.2.5)
  const cands = ROUND_INTERLOCKS_MM.map((d) => {
    const a = areaRound(d);
    const { fLateralN, tauMPa } = interlockShear(pMelt, d, hCav, a);
    // "no jeopardize the structural integrity": dejar al menos ½⌀ de acero a cada lado
    const fits = d * 2 <= rim;
    return { d, a, fLateralN, tauMPa, holds: tauMPa <= TAU_LIMIT_S7_MPA, fits };
  });
  const usable = cands.filter((c) => c.holds && c.fits);
  // el libro: "the LARGEST interlock should be used that can be readily incorporated"
  const pick = usable.length ? usable[usable.length - 1] : cands[0];

  // POSICIONES: plano de partición, a media pared en los 4 costados, lo más cerca del
  // inserto que se pueda (§12.2.5). PERO el centro del costado YA ESTÁ OCUPADO por un
  // tornillo de sujeción (standardHoles pone tornillos en esquinas Y medios de borde):
  // colocarlos "donde se ve bonito" los encimaba −14.2 mm con el perno de (191,274).
  // Es la MISMA lección del asiento del inserto: todo lo que existe en 3D tiene
  // coordenadas, y quien coloca DEBE mirar qué más vive ahí. Aquí el interlock se CORRE
  // a lo largo de su costado hasta librar la tornillería.
  const zPart = 0;   // el llamador lo sitúa; aquí es relativo al plano de partición
  const offX = ins.ifx / 2 + rimX / 2, offY = ins.ify / 2 + rimY / 2;
  const screws = obstacles ?? [];
  /** corre el punto a lo largo del costado (eje `along`) hasta librar los obstáculos. */
  const clear = (p: { x: number; y: number }, along: 'x' | 'y', span: number) => {
    const need = (o: { x: number; y: number; dia: number }) => pick.d / 2 + o.dia / 2 + 3;
    const hits = (q: { x: number; y: number }) => screws.some((o) => Math.hypot(q.x - o.x, q.y - o.y) < need(o));
    if (!hits(p)) return p;
    for (let step = 8; step <= span / 2; step += 6) {
      for (const s of [step, -step]) {
        const q = along === 'x' ? { x: +(p.x + s).toFixed(1), y: p.y } : { x: p.x, y: +(p.y + s).toFixed(1) };
        // sin salirse de la placa ni meterse en el inserto
        const inPlate = q.x > pick.d && q.x < W - pick.d && q.y > pick.d && q.y < D - pick.d;
        if (inPlate && !hits(q)) return q;
      }
    }
    return p;   // no se pudo librar: el gate lo reportará (mejor un fallo visible que uno callado)
  };
  const positions = [
    clear({ x: +(W / 2 - offX).toFixed(1), y: +(D / 2).toFixed(1) }, 'y', D),
    clear({ x: +(W / 2 + offX).toFixed(1), y: +(D / 2).toFixed(1) }, 'y', D),
    clear({ x: +(W / 2).toFixed(1), y: +(D / 2 - offY).toFixed(1) }, 'x', W),
    clear({ x: +(W / 2).toFixed(1), y: +(D / 2 + offY).toFixed(1) }, 'x', W),
  ];

  return {
    kind: 'redondo',
    desig: `⌀${pick.d} S7`,
    diaMm: pick.d, areaMm2: +pick.a.toFixed(1),
    angleDeg: MIN_ANGLE_DEG,
    pMeltMPa: pMelt, hCavityMm: hCav,
    fLateralN: pick.fLateralN, tauMPa: pick.tauMPa, limitMPa: TAU_LIMIT_S7_MPA,
    ok: pick.holds && pick.fits,
    positions, zPartMm: zPart,
    male: { plate: 'B', through: true, depthMm: thick('B') },
    female: { plate: 'A', through: false, depthMm: Math.min(thick('A') - 6, Math.round(pick.d * 1.2)) },
    benefit: 'duplica la rigidez de la pared lateral → la deflexión se parte a la MITAD (§12.2.5)',
    candidates: cands.map((c) => ({
      desig: `⌀${c.d}`, areaMm2: +c.a.toFixed(1), tauMPa: c.tauMPa, ok: c.holds && c.fits,
      why: !c.holds ? `✗ τ ${c.tauMPa} > ${TAU_LIMIT_S7_MPA} MPa (S7 falla)`
        : !c.fits ? `✗ no cabe: necesita ${(c.d * 2).toFixed(1)} mm de pared y hay ${rim.toFixed(1)}`
        : c.d === pick.d ? `ELEGIDO: el más grande que aguanta y cabe (§12.2.5)`
        : `aguanta y cabe, pero hay uno más grande`,
    })),
    why: [
      `§12.2.5: van en el PLANO DE PARTICIÓN y lo más cerca de la cavidad posible → aquí a ${rimX.toFixed(0)}/${rimY.toFixed(0)} mm del inserto`,
      `§12.2.5: MACHO pasante en B (${thick('B')} mm) · HEMBRA en bolsa ciega en A — retenidos con SHCS`,
      `§12.2.5 Eq 12.18: F=½·P·⌀·H = ½·${pMelt}·${pick.d}·${hCav} = ${pick.fLateralN} N → τ=${pick.tauMPa} MPa vs ${TAU_LIMIT_S7_MPA} del S7`,
      `§4.1.3: inclinados ≥${MIN_ANGLE_DEG}° respecto a la apertura — a 0° la fuerza de cierre los TRABA y deforma el molde`,
      `redondos (no rectangulares): "available in smaller sizes and EASIER TO INSTALL" — menos maquinado`,
    ],
  };
}
