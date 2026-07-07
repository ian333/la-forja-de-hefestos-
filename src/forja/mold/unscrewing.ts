/**
 * MOLDES DE NÚCLEO MÓVIL — roscas internas, tubos, undercuts internos.
 * Kazmer §13.9.2 (collapsible cores) + §13.9.3 (rotating cores). LITERAL.
 * ======================================================================
 * La pregunta del cliente: "¿se automatiza para tubos y roscas?" — SÍ. Dos vías:
 *
 *  · COLLAPSIBLE CORE (§13.9.2): núcleo de 8 segmentos que COLAPSA hacia adentro
 *    (~6 % del ⌀) para liberar roscas/undercuts internos. Comercial ⌀13-90 mm.
 *    Simple (assembly estándar) pero deja WITNESS LINES donde se juntan segmentos.
 *
 *  · ROTATING CORE / UNSCREWING (§13.9.3): el núcleo GIRA para DESENROSCAR la
 *    pieza (tapas roscadas, tubos). Superficie interna limpia. Dos mecanismos:
 *      - hélice gruesa: rotaciones = carrera / paso_hélice (paso grueso: baja
 *        torque/desgaste pero alarga el stack); N vueltas = L_rosca / paso_rosca.
 *      - engranes planetarios: rack→piñón→sun→planetas→núcleos; desacopla la
 *        actuación de la rotación (programable), sin el stack de la hélice.
 *    OJO: la pieza necesita features ANTI-ROTACIÓN (undercut/gate) o gira con
 *    el núcleo y no desenrosca.
 * PURO: node-testeable. Física de fricción reusa la contracción del cap 11.
 */
import { ABS_EJECT, type EjectionMaterial } from './ejection';

export interface ThreadSpec {
  innerDiaMm: number;                    // ⌀ nominal de la rosca interna
  pitchMm: number;                       // paso de la rosca de la PIEZA
  threadLenMm: number;                   // longitud axial roscada
  wallMm: number;                        // pared de la pieza sobre el núcleo
}

/** Vueltas para desenroscar por completo (Eq geométrica: L/paso). */
export function unscrewTurns(t: ThreadSpec): number {
  return t.threadLenMm / t.pitchMm;
}

/** Torque de desenrosque (N·m): la pieza se contrae y agarra el núcleo; el par
 *  vence la fricción tangencial en el radio de paso. Reusa la contracción del
 *  cap 11 (ΔT·CTE·E) como presión de contacto sobre la cara roscada. */
export function unscrewTorque(t: ThreadSpec, m: EjectionMaterial = ABS_EJECT): { torqueNm: number; contactPMPa: number; normalN: number } {
  const dT = m.tSolid - m.tEject;                          // enfriamiento tras expulsión
  const strain = m.cte * dT;                               // deformación de contracción
  const pContact = strain * m.E;                           // presión de contacto (Pa) sobre el núcleo
  const rM = (t.innerDiaMm / 2) / 1000;
  const areaM2 = Math.PI * (t.innerDiaMm / 1000) * (t.threadLenMm / 1000); // cilindro de contacto
  const normalN = pContact * areaM2;
  const torqueNm = m.mu * normalN * rM;                    // T = μ·N·r
  return { torqueNm, contactPMPa: pContact / 1e6, normalN };
}

/** §13.9.3 hélice gruesa: la placa actuada recorre `strokeMm` y por la hélice
 *  hace girar el núcleo N vueltas. Paso de hélice = carrera / vueltas; el ángulo
 *  debe ser GRUESO (grande) para bajar torque/desgaste. */
export function helixDrive(t: ThreadSpec, strokeMm: number, helixDiaMm = 40): {
  turns: number; helixPitchMm: number; helixAngleDeg: number; grueso: boolean; nota: string;
} {
  const turns = unscrewTurns(t);
  const helixPitchMm = strokeMm / turns;                  // avance axial por vuelta de la hélice
  const helixAngleDeg = Math.atan2(helixPitchMm, Math.PI * helixDiaMm) * 180 / Math.PI;
  const grueso = helixAngleDeg >= 12;                     // "coarsely threaded" — hélice de paso grande
  return {
    turns, helixPitchMm, helixAngleDeg, grueso,
    nota: grueso
      ? 'hélice GRUESA ✓ (paso grande = bajo torque/desgaste, §13.9.3)'
      : 'hélice fina → torque y desgaste ALTOS: alargar la carrera o usar engranes planetarios (§13.9.3)',
  };
}

/** §13.9.2 collapsible core: ¿el ⌀ está en rango comercial y basta el colapso 6 %? */
export function collapsibleCoreCheck(t: ThreadSpec, undercutDepthMm?: number): {
  aplica: boolean; collapseMm: number; nota: string;
} {
  const d = t.innerDiaMm;
  const collapseMm = 0.06 * d;                            // ~6 % del ⌀ (libro)
  const enRango = d >= 13 && d <= 90;                     // comercial 13-90 mm
  const undercut = undercutDepthMm ?? t.pitchMm * 0.6;    // profundidad de rosca ≈ 0.6·paso
  const aplica = enRango && collapseMm >= undercut;
  return {
    aplica, collapseMm,
    nota: !enRango ? `⌀${d} fuera del rango comercial 13-90 mm → núcleo a medida`
      : aplica ? `colapso ${collapseMm.toFixed(1)} mm ≥ rosca ${undercut.toFixed(1)} mm ✓ (assembly estándar)`
        : `colapso ${collapseMm.toFixed(1)} mm < rosca ${undercut.toFixed(1)} mm → insuficiente, usar núcleo ROTATIVO`,
  };
}

export type UnscrewMethod = 'collapsible' | 'rotating-helix' | 'rotating-planetary' | 'ninguno';

/** DECISOR §13.9: collapsible (simple, con witness) vs rotating (limpio, complejo). */
export function chooseInternalCoreMethod(o: {
  thread: ThreadSpec; nCavities: number; interiorLimpio: boolean; strokeMm?: number;
}): { method: UnscrewMethod; turns: number; torqueNm: number; report: string[] } {
  const R: string[] = [];
  const turns = unscrewTurns(o.thread);
  const tq = unscrewTorque(o.thread);
  const col = collapsibleCoreCheck(o.thread);
  const helix = helixDrive(o.thread, o.strokeMm ?? Math.max(60, turns * 12));
  R.push(`rosca ⌀${o.thread.innerDiaMm} paso ${o.thread.pitchMm} × ${o.thread.threadLenMm} mm → ${turns.toFixed(1)} vueltas · torque ${tq.torqueNm.toFixed(1)} N·m/núcleo`);

  let method: UnscrewMethod = 'ninguno';
  if (col.aplica && !o.interiorLimpio) {
    method = 'collapsible';
    R.push(`→ COLLAPSIBLE CORE (§13.9.2): ${col.nota}. Barato, pero deja witness lines internas.`);
  } else {
    // rotativo: hélice para pocas cavidades, planetario para muchas
    if (o.nCavities <= 8 && helix.grueso) {
      method = 'rotating-helix';
      R.push(`→ ROTATING CORE por HÉLICE (§13.9.3): ${helix.turns.toFixed(1)} vueltas · paso hélice ${helix.helixPitchMm.toFixed(1)} mm · ${helix.nota}`);
    } else {
      method = 'rotating-planetary';
      R.push(`→ ROTATING CORE por ENGRANES PLANETARIOS (§13.9.3): ${o.nCavities} cavidades — sun+planetas desacoplan actuación/rotación sin stack de hélice (como el molde de 64 tapas roscadas del libro)`);
    }
    R.push(`  ⚠ la PIEZA necesita feature ANTI-ROTACIÓN (undercut/gate) o gira con el núcleo y no desenrosca`);
    if (!col.aplica) R.push(`  (collapsible descartado: ${col.nota})`);
  }
  return { method, turns, torqueNm: tq.torqueNm, report: R };
}
