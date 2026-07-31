/**
 * ANÁLISIS POR COORDENADAS 3D — "todo lo que existe dentro del molde tiene
 * coordenadas, y como EXISTE en 3D lo razonamos numéricamente" (user 2026-07-14).
 * El libro da las fórmulas (carga, §12.4) pero no coloca en el espacio; nosotros SÍ.
 *
 * Enumera CADA feature (barreno por placa, pin, poste guía, segmento de agua,
 * boquilla/bebedero, KO, canal de mecanismo) como PRIMITIVA con coordenadas exactas
 * y caza:
 *   · tornillos que CRUZAN la partición (el molde ABRE ahí → lo clavarían cerrado)
 *   · barrenos colineales de tipos incompatibles (KO vs colada en el mismo eje)
 *   · barreno ∩ agua / pin / poste (interferencia 3D real)
 *   · reparto de carga de la tornillería (§12.4: F_total / N ≤ capacidad del SHCS)
 */
import type { MoldAssemblySpec } from './mold-assembly';
import { plateStackZ } from './mold-plano-set';
import { insertDims } from './mold-drawing-set';
import { plateDepth, plateDefs, standardHoles, coolingCircuit, moldBoltSizing } from './mold-drawing-set';
import { fastenerPlan, boltCapacityKN } from './mold-fasteners';
import { planInterlocks } from './mold-interlocks';
import { resolveThread } from './mold-threads';

export type FeatKind = 'tornillo' | 'pilar-guia' | 'expulsor' | 'boquilla' | 'ko' | 'retorno' | 'otro';
export interface VFeature { x: number; y: number; dia: number; zLo: number; zHi: number; plate: string; type: string; kind: FeatKind }
export interface CoordFinding { sev: 'CRÍTICO' | 'ADVERTENCIA' | 'INFO'; check: string; detail: string }

function kindOf(type: string): FeatKind {
  if (/tornillo/.test(type)) return 'tornillo';
  if (/pilar/.test(type)) return 'pilar-guia';
  if (/expulsor|pasaje|cabeza/.test(type)) return 'expulsor';
  if (/boquilla|bebedero|compuerta/.test(type)) return 'boquilla';
  if (/KO/.test(type)) return 'ko';
  if (/retorno/.test(type)) return 'retorno';
  return 'otro';
}

/** todos los barrenos verticales con su rango z real (según la placa que los aloja). */
export function enumerateVFeatures(s: MoldAssemblySpec): VFeature[] {
  const z = plateStackZ(s);
  const defs = plateDefs(s), thick = (r: string) => defs.find((d) => d.role === r)?.thick ?? 20;
  const out: VFeature[] = [];
  for (const p of defs) {
    const zLo = z[p.role] ?? 0, zHi = zLo + thick(p.role);
    for (const h of standardHoles(s, p.role))
      out.push({ x: h.x, y: h.y, dia: h.dia, zLo, zHi, plate: p.role, type: h.type, kind: kindOf(h.type) });
  }
  return out;
}

const zOverlap = (a: VFeature, b: VFeature) => a.zLo < b.zHi - 0.2 && b.zLo < a.zHi - 0.2;
const dist = (a: VFeature, b: VFeature) => Math.hypot(a.x - b.x, a.y - b.y);

/** análisis completo por coordenadas → findings + evidencia. */
export function coordAudit(s: MoldAssemblySpec): { findings: CoordFinding[]; features: VFeature[]; screws: { cavityHalf: number; coreHalf: number; perScrewKN: number; capKN: number } } {
  const F: CoordFinding[] = [];
  const feats = enumerateVFeatures(s);
  const z = plateStackZ(s);
  const zPart = z.A;   // línea de partición (tope de B = base de A)

  // ── 1) TORNILLO QUE CRUZA LA PARTICIÓN: el molde abre en zPart; un tornillo cuyo
  //    rango z contiene la partición pinaría las dos mitades juntas. CRÍTICO. ──
  for (const f of feats) {
    if (f.kind !== 'tornillo') continue;
    if (f.zLo < zPart - 0.5 && f.zHi > zPart + 0.5) {
      F.push({ sev: 'CRÍTICO', check: 'tornillo-cruza-particion',
        detail: `tornillo @(${f.x},${f.y}) en placa ${f.plate} abarca z[${f.zLo}..${f.zHi}] cruzando la partición ${zPart} — clavaría las mitades A/B` });
    }
  }
  // el mismo eje XY con barrenos de tornillo en placas de AMBOS lados (bore continuo)
  {
    const byAxis: Record<string, VFeature[]> = {};
    for (const f of feats.filter((f) => f.kind === 'tornillo'))
      (byAxis[`${Math.round(f.x)},${Math.round(f.y)}`] ||= []).push(f);
    for (const k in byAxis) {
      const g = byAxis[k];
      const below = g.some((f) => f.zHi <= zPart + 0.5), above = g.some((f) => f.zLo >= zPart - 0.5);
      if (below && above) F.push({ sev: 'CRÍTICO', check: 'tornillo-bore-continuo',
        detail: `eje (${g[0].x},${g[0].y}): barrenos de tornillo a AMBOS lados de la partición (${g.map((f) => f.plate).join(',')}) — un solo perno atravesaría el molde entero` });
    }
  }

  // ── 2) COLINEAL INCOMPATIBLE: KO (vástago de máquina, empuja hacia arriba) en el
  //    MISMO eje que la boquilla/colada (baja el fundido) → el vástago embiste la colada. ──
  for (const ko of feats.filter((f) => f.kind === 'ko'))
    for (const bq of feats.filter((f) => f.kind === 'boquilla'))
      if (dist(ko, bq) < ko.dia / 2 + bq.dia / 2 + 3)
        F.push({ sev: 'CRÍTICO', check: 'ko-colineal-colada',
          detail: `KO @(${ko.x},${ko.y}) y ${bq.type} @(${bq.x},${bq.y}) comparten eje (d=${dist(ko, bq).toFixed(1)} mm) — el vástago expulsor embestiría la colada` });

  // ── 3) BARRENO ∩ AGUA: cada segmento de agua (cilindro horizontal) vs cada barreno
  //    (cilindro vertical) — distancia 3D real. El agua vive en A/B a su z. ──
  {
    const D = plateDepth(s);
    const cc = coolingCircuit(s, D);
    const tA = plateDefs(s).find((d) => d.role === 'A')?.thick ?? 40;
    const tB = plateDefs(s).find((d) => d.role === 'B')?.thick ?? 40;
    const zLines: Array<{ z: number; plate: 'A' | 'B' }> = [{ z: zPart - Math.min(tB - cc.diaMm / 2 - 1, cc.zBehindMm), plate: 'B' }];
    if (cc.zAboveMm != null) zLines.push({ z: zPart + Math.min(cc.zAboveMm, tA - cc.diaMm / 2 - 1), plate: 'A' });
    let worst = 1e9, wi = '';
    for (const L of zLines) for (const g of cc.segs) {
      const horiz = g.y0 === g.y1;
      for (const f of feats) {
        if (f.zLo > L.z || f.zHi < L.z) continue;   // el barreno no llega a ese plano z
        // distancia del centro del barreno al segmento (en XY) − radios
        const vx = g.x1 - g.x0, vy = g.y1 - g.y0, len2 = vx * vx + vy * vy || 1;
        const tt = Math.max(0, Math.min(1, ((f.x - g.x0) * vx + (f.y - g.y0) * vy) / len2));
        const d = Math.hypot(f.x - (g.x0 + tt * vx), f.y - (g.y0 + tt * vy)) - cc.diaMm / 2 - f.dia / 2;
        if (d < worst) { worst = d; wi = `${f.type}@(${f.x},${f.y},${f.plate}) vs canal ${horiz ? 'y=' + g.y0 : 'x=' + g.x0}`; }
      }
    }
    // §9.2.7 LITERAL: "the mold design should provide AT LEAST HALF A COOLING
    // DIAMETER between the surface of the cooling line and the surface of any other
    // mold component. This requirement maintains the structural integrity of the
    // mold while also minimizing cooling leaks during mold operation due to
    // corrosion." El umbral es ½⌀ y ESCALA con el diámetro — antes eran 2 mm fijos
    // (crítico) y 4.5 mm (advertencia), números sin fuente que con ⌀15.9 quedaban
    // 4× más flojos que el libro: el auditor daba ámbar donde el libro dice rojo.
    const claroMin = cc.diaMm / 2;
    if (worst < claroMin) {
      F.push({ sev: 'CRÍTICO', check: 'agua-choca-barreno',
        detail: `holgura ${worst.toFixed(1)} mm < ½⌀ = ${claroMin.toFixed(1)} mm exigido §9.2.7 (${wi})` });
    } else if (worst < claroMin * 1.5) {
      F.push({ sev: 'ADVERTENCIA', check: 'agua-cerca-barreno',
        detail: `holgura ${worst.toFixed(1)} mm apenas sobre el ½⌀ = ${claroMin.toFixed(1)} mm §9.2.7 (${wi})` });
    }
  }

  // ── 3b) BARRENO ∩ ASIENTO DEL INSERTO (cazado 2026-07-15 con las COTAS 3D en
  //    pantalla: la placa mide 381, la bolsa 332 → 24.5 mm de pared; el tornillo va
  //    en x=23 con broca ⌀8.5 → ocupa hasta 27.25 y la bolsa empieza en 24.5).
  //    `standardHoles` e `insertDims` se calculan POR SEPARADO y nadie los confronta:
  //    el barreno se come el asiento y el inserto ya no apoya. 12/12 barrenos del
  //    bezel lo hacían con el auditor en verde. El OJO no lo ve; los NÚMEROS sí. ──
  {
    const ins = insertDims(s);
    const D2 = plateDepth(s);
    const seats: Array<{ role: string; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }> = [];
    const tA2 = plateDefs(s).find((d) => d.role === 'A')?.thick ?? 40;
    const tB2 = plateDefs(s).find((d) => d.role === 'B')?.thick ?? 40;
    if (ins.ifx > 0 && ins.Hc > 0) seats.push({ role: 'A', x0: s.widthMm / 2 - ins.ifx / 2, x1: s.widthMm / 2 + ins.ifx / 2,
      y0: D2 / 2 - ins.ify / 2, y1: D2 / 2 + ins.ify / 2, z0: z.A, z1: z.A + ins.Hc });
    if (ins.ifx > 0 && ins.Hk > 0) seats.push({ role: 'B', x0: s.widthMm / 2 - ins.ifx / 2, x1: s.widthMm / 2 + ins.ifx / 2,
      y0: D2 / 2 - ins.ify / 2, y1: D2 / 2 + ins.ify / 2, z0: z.B + tB2 - ins.Hk, z1: z.B + tB2 });
    void tA2;
    for (const st of seats) for (const f of feats) {
      if (f.kind !== 'tornillo') continue;
      const r = f.dia / 2;
      const zOver = f.zLo < st.z1 - 0.01 && st.z0 < f.zHi - 0.01;
      if (!zOver) continue;
      if (f.x + r > st.x0 && f.x - r < st.x1 && f.y + r > st.y0 && f.y - r < st.y1) {
        const pen = Math.min(f.x + r - st.x0, st.x1 - (f.x - r), f.y + r - st.y0, st.y1 - (f.y - r));
        F.push({ sev: 'CRÍTICO', check: 'tornillo-invade-asiento-inserto',
          detail: `tornillo ⌀${f.dia} @(${f.x},${f.y}) en ${f.plate} invade ${pen.toFixed(1)} mm el asiento del inserto ${st.role} (x[${st.x0.toFixed(0)}..${st.x1.toFixed(0)}] z[${st.z0.toFixed(0)}..${st.z1.toFixed(0)}]) — el inserto perdería apoyo` });
      }
    }
  }

  // ── 3c) INTERLOCKS §12.2.5 (el AUTOCENTRADO): viven EN el plano de partición y
  //    cruzan de B a A a propósito — son lo ÚNICO que debe cruzar. Se auditan igual
  //    que todo: que aguanten (Eq 12.18 vs 300 MPa del S7), que vayan inclinados ≥5°
  //    (§4.1.3: a 0° la fuerza de cierre los TRABA) y que no se encimen con la
  //    tornillería (ya pasó: −14.2 mm contra el perno de (191,274)). ──
  try {
    const il = planInterlocks(s);
    if (il.tauMPa > il.limitMPa)
      F.push({ sev: 'CRÍTICO', check: 'interlock-excede-cortante',
        detail: `interlock ${il.desig}: τ ${il.tauMPa} > ${il.limitMPa} MPa (S7) — sube el ⌀ (Eq 12.18)` });
    if (il.angleDeg < 5)
      F.push({ sev: 'CRÍTICO', check: 'interlock-sin-inclinacion',
        detail: `interlock a ${il.angleDeg}° — §4.1.3 pide ≥5° o la fuerza de cierre lo traba y deforma el molde` });
    for (const q of il.positions) for (const f of feats) {
      if (f.kind !== 'tornillo') continue;
      const gap = Math.hypot(q.x - f.x, q.y - f.y) - (il.diaMm ?? 19) / 2 - f.dia / 2;
      if (gap < 2)
        F.push({ sev: 'CRÍTICO', check: 'interlock-choca-tornillo',
          detail: `interlock ${il.desig} @(${q.x},${q.y}) a ${gap.toFixed(1)} mm del tornillo @(${f.x},${f.y}) en ${f.plate} — se enciman` });
    }
  } catch { /* si no hay datos de inserto/cavidad, el interlock no aplica */ }

  // ── 4) CARGA DE MANEJO §12.4 Fig 12.33: el peor caso es el molde colgado de UN
  //    tornillo (n_g=10 de choque de grúa) → esa fuerza NO se reparte entre N; el
  //    tornillo debe aguantarla SOLO. (Antes aquí se dividía entre N y el auditor
  //    daba verde con pernos sub-diseñados — el mismo patrón de la cuerda falsa.)
  //    Capacidad y Ø salen de mold-fasteners: UNA sola fuente de verdad, no una
  //    aproximación local del área de esfuerzo.
  const bolt = moldBoltSizing(s);
  const plan = fastenerPlan(s, { half: 'cavity' });
  const cavityHalf = feats.filter((f) => f.kind === 'tornillo' && f.zLo >= zPart - 0.5).length;
  const coreHalf = feats.filter((f) => f.kind === 'tornillo' && f.zHi <= zPart + 0.5).length;
  const capKN = boltCapacityKN(resolveThread(plan.majorMm));
  const perScrewKN = bolt.forceN / 1000;                 // por tornillo, SIN dividir
  if (cavityHalf < 4 || coreHalf < 4)
    F.push({ sev: 'ADVERTENCIA', check: 'reparto-carga-pocos-tornillos',
      detail: `mitad cavidad ${cavityHalf} · mitad núcleo ${coreHalf} tornillos — <4 por mitad no reparte la carga a las esquinas (§12.4)` });
  if (perScrewKN > capKN)
    F.push({ sev: 'CRÍTICO', check: 'reparto-carga-excedido',
      detail: `${perScrewKN.toFixed(1)} kN sobre UN tornillo > ${capKN.toFixed(1)} kN de capacidad ${plan.desig} — sube el ⌀ (agregar tornillos NO ayuda: Fig 12.33 el molde cuelga de uno solo)` });

  F.sort((a, b) => (a.sev === 'CRÍTICO' ? 0 : 1) - (b.sev === 'CRÍTICO' ? 0 : 1));
  return { findings: F, features: feats, screws: { cavityHalf, coreHalf, perScrewKN: +perScrewKN.toFixed(1), capKN: +capKN.toFixed(1) } };
}
