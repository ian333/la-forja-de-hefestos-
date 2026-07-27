/**
 * TORNILLERÍA POR CARGA — "el agarre depende de la LONGITUD DE ENGRANE, no de la
 * punta; la fuerza escala con d²; pocos grandes vs muchos chicos es un trade-off"
 * (user 2026-07-14). Física de Shigley cap. 8 + FED-STD-H28 (longitud de engrane).
 *
 *   · Área de esfuerzo At = (π/4)·((d2+d3)/2)²                (∝ d²)
 *   · Carga de prueba Fp = At · Sp  (clase 12.9 → Sp≈970 MPa)  → capacidad del tornillo
 *   · LONGITUD DE ENGRANE (FED-STD-H28) para que el hilo NO se barra antes de que el
 *     perno rompa a tensión:
 *       Le = 2·At / (π·Kn·[1/(2n) + 0.57735·(Es − Kn)])
 *     (n=1/P hilos/mm, Es=Ø primitivo externo, Kn=Ø menor interno). Steel-steel ≈ 0.9d.
 *     Si el material del barreno es más BLANDO, Le crece por la razón de resistencias.
 *   · OPTIMIZACIÓN: elegir (Ø, N) que reparta F_total con N≥4 y Le que quepa en la
 *     placa, MINIMIZANDO N (fácil de armar). Devuelve alternativas (varias formas).
 */
import type { MoldAssemblySpec } from './mold-assembly';
import { plateDefs, plateDepth, moldBoltSizing, standardHoles } from './mold-drawing-set';
import { resolveThread, threadDims, type ThreadSpec } from './mold-threads';

const SP_129 = 970;          // MPa, carga de prueba clase 12.9
const SY_129 = 1100;         // MPa, fluencia clase 12.9
// fluencia aprox del acero del barreno (P20 templado ~1000; base 1.1730 ~430)
const PLATE_SY: Record<string, number> = { P20: 1000, '1.1730': 430, '1.2311': 900, default: 500 };

export function plateYieldMPa(spec: MoldAssemblySpec): number {
  const s = (spec.baseSteel ?? '').replace(/[^0-9.A-Z]/gi, '');
  for (const k in PLATE_SY) if (s.includes(k)) return PLATE_SY[k];
  return PLATE_SY.default;
}
const plateYield = plateYieldMPa;

/** capacidad a tensión (carga de prueba) de un tornillo, en kN. */
export function boltCapacityKN(t: ThreadSpec): number {
  return (t.stressAreaMm2 * SP_129) / 1000;   // At[mm²]·Sp[MPa] = N → /1000 = kN
}

/** LONGITUD DE ENGRANE mínima (mm) — FED-STD-H28: el hilo externo rompe a tensión
 *  ANTES de barrer el interno. Ajustada por la razón de resistencias si la placa
 *  es más blanda que el perno (J = A_shear_ext / A_shear_int · Sy_bolt/Sy_plate). */
export function engagementLengthMm(t: ThreadSpec, plateSyMPa: number): number {
  const { d2, d1 } = threadDims(t.major, t.pitch);
  const n = 1 / t.pitch, Es = d2, Kn = d1;
  const AtShear = Math.PI * Kn * (1 / (2 * n) + 0.57735 * (Es - Kn));   // por mm de engrane
  let Le = (2 * t.stressAreaMm2) / AtShear;                             // balanceado steel-steel
  // material más blando → más engrane (razón J de resistencias, Shigley 8-24).
  // Tope 3.0·d: más allá NO se rosca directo, se usa inserto (helicoil) — el acero
  // duro (Sy~1000) da J≈1, el temple base (430) J≈2.6, el aluminio (200) satura en 3.
  const J = Math.min(3.0, Math.max(1, SY_129 / plateSyMPa));
  Le *= J;
  return +Math.max(0.7 * t.major, Le).toFixed(1);   // piso práctico 0.7·d
}

/** un candidato del ESTUDIO: por qué entra o por qué se descarta. */
export interface FastenerCandidate {
  desig: string; count: number; capacityKN: number; utilPct: number;
  engagementMm: number; fits: boolean; chosen: boolean; why: string;
}

export interface FastenerPlan {
  desig: string; /** Ø nominal elegido (mm) — la GEOMETRÍA se construye con éste */ majorMm: number;
  count: number; perBoltKN: number; capacityKN: number; utilPct: number;
  engagementMm: number; availableMm: number; engagementOK: boolean;
  torqueNm: number; tapDrillMm: number; stressAreaMm2: number;
  totalKN: number; plateSyMPa: number;
  /** criterio con el que se eligió (para el panel en vivo) */
  criterion: string;
  /** TODOS los candidatos evaluados — el estudio es la ELECCIÓN, no solo el ganador */
  candidates: FastenerCandidate[];
  alternatives: Array<{ desig: string; count: number; utilPct: number; engagementMm: number; note: string }>;
}

/** PLAN de tornillería por MITAD (cavidad / núcleo). load = fuerza total a repartir
 *  (peor caso de izaje §12.4 por defecto). Elige el Ø+N que reparte con N≥4 y engrane
 *  que cabe, minimizando N; lista alternativas (pocos grandes vs muchos chicos). */
export function fastenerPlan(spec: MoldAssemblySpec, o?: { half?: 'cavity' | 'core'; loadKN?: number }): FastenerPlan {
  const defs = plateDefs(spec), thick = (r: string) => defs.find((d) => d.role === r)?.thick ?? 20;
  const plateSy = plateYield(spec);
  // ⚠ §12.4 Fig 12.33: la fuerza del peor caso es la que ve UN SOLO tornillo — el molde
  // colgado de uno con n_g=10 de choque de grúa. NO se divide entre N: en ESE escenario
  // los demás tornillos no acompañan, y repartirla sub-diseña el perno (bug real: daba
  // 4×M10 de 56 kN para una carga de 100 kN → se rompe). El REPARTO aplica al caso de
  // SUJECIÓN de placas, no al de IZAJE. El n_g=10 ya es el factor de seguridad del libro,
  // así que tampoco se le encima otro ×2.
  const F = o?.loadKN ?? moldBoltSizing(spec).forceN / 1000;
  // placa donde ROSCA (la última de la mitad): cavidad enrosca en A, núcleo en B
  const avail = o?.half === 'core' ? thick('B') : thick('A');
  // cuántos se COLOCAN de verdad en esa mitad (redundancia/sujeción) — dato, no divisor
  const N = standardHoles(spec, o?.half === 'core' ? 'bottom' : 'clamp').filter((h) => /tornillo/.test(h.type)).length || 4;
  const SIZES = [6, 8, 10, 12, 16, 20, 24];
  const cands = SIZES.map((d) => {
    const t = resolveThread(d);
    const cap = boltCapacityKN(t);
    const Le = engagementLengthMm(t, plateSy);
    return { d, t, cap, Le, holds: cap >= F, fits: Le <= avail - 3, util: (F / cap) * 100 };
  });
  // ELEGIDO: el más CHICO que aguanta la carga ÉL SOLO y cuyo engrane CABE en la placa
  const ok = cands.filter((c) => c.holds && c.fits);
  const pick = ok.length ? ok[0] : cands[cands.length - 1];
  const t = pick.t;
  // par de apriete T = K·F_pre·d (K=0.2 seco), pretensión 0.75·Fp
  const Fpre = 0.75 * t.stressAreaMm2 * SP_129;        // N
  const torque = (0.2 * Fpre * t.major) / 1000;        // N·m
  const alternatives = cands.filter((c) => c.d !== pick.d && c.holds && c.fits)
    .slice(0, 3).map((c) => ({ desig: c.t.desig, count: N, utilPct: +c.util.toFixed(0), engagementMm: c.Le,
      note: c.d > pick.d ? 'aguanta, pero sobra acero' : 'más chico' }));
  // el ESTUDIO: cada candidato con su razón (esto es lo que se ve en vivo)
  const candidates: FastenerCandidate[] = cands.map((c) => ({
    desig: c.t.desig, count: N, capacityKN: +c.cap.toFixed(1), utilPct: +c.util.toFixed(0),
    engagementMm: c.Le, fits: c.holds && c.fits, chosen: c.d === pick.d,
    why: c.d === pick.d ? `ELEGIDO: el más chico que aguanta los ${F.toFixed(1)} kN ÉL SOLO (${c.util.toFixed(0)}% de su capacidad)`
      : !c.holds ? `✗ SE ROMPE: aguanta ${c.cap.toFixed(1)} kN y la carga es ${F.toFixed(1)} kN`
      : !c.fits ? `descartado: engrane ${c.Le} mm > placa ${avail} mm`
      : `aguanta, pero sobra acero (${c.util.toFixed(0)}% de su capacidad)`,
  }));
  return {
    desig: t.desig, majorMm: t.major, count: N, perBoltKN: +F.toFixed(1), capacityKN: +pick.cap.toFixed(1),
    utilPct: +pick.util.toFixed(0), engagementMm: pick.Le, availableMm: avail,
    engagementOK: pick.fits && pick.holds,
    torqueNm: +torque.toFixed(0), tapDrillMm: t.tapDrillMm, stressAreaMm2: t.stressAreaMm2,
    totalKN: +F.toFixed(1), plateSyMPa: plateSy, candidates, alternatives,
    criterion: `§12.4 Fig 12.33: el molde colgado de UN tornillo con n_g=10 de choque de grúa → ese tornillo ve los ${F.toFixed(1)} kN SOLO (no se reparten). Gana el más chico que los aguanta y cuyo engrane cabe. Se colocan ${N} por redundancia y sujeción.`,
  };
}
