import { daylightNeededMm } from './threeplate';

/**
 * MOLD BASE ESTÁNDAR + MATERIALES — Kazmer cap 4 §4.2-4.4 + Apéndice B (LITERAL).
 * ================================================================================
 *  · sizeInserts (§4.2): altura = pieza + 3×⌀agua por lado (redondeada al
 *    incremento de placa de 10 mm); cheek lateral = max(3×⌀agua, PROFUNDIDAD de
 *    la cavidad) — "a safe guideline is that the thickness of the side wall …
 *    should equal the depth of the mold cavity".
 *  · selectMoldBase (§4.3): layout en rejilla con aspecto ≤ 2:1, reserva
 *    perimetral para pilares/retornos (≥ ½⌀ de cada componente vecino), base
 *    estándar de 196 a 996 mm por lado (el libro: "widely available from
 *    200 mm up to 1000 mm on a side"), placas A/B a incrementos de 10 mm.
 *  · checkMachine (§4.3.3): tie bars, daylight mín/máx, shot 25-50 % del barril
 *    (HM320: ideal 120-250 cc de 490 cc), clamp suficiente sin aplastar.
 *  · MOLD_METALS (Apéndice B): los 11 metales con los NÚMEROS EXACTOS del libro
 *    (fatiga a 1e6 ciclos FS=1, dureza Brinell, k, cp, α, costos, maquinado)
 *    + equivalencias DIN/W-Nr para proveedores internacionales.
 * PURO: node-testeable, sin kernel.
 */

// ── Apéndice B: metales de molde (números del libro) ─────────────────
export interface MoldMetal {
  key: string; din: string; kind: 'acero' | 'no-ferroso';
  desc: string;
  costKg: number; costM3: number;
  ultimateMPa: number; modulusMPa: number; yieldMPa: number;
  fatigueLimitMPa: number;                 // S-N a 1e6 ciclos, FS=1 (nota B.4)
  brinell: number;
  volMachineM3h: number; areaMachineM2h: number;
  cteUmMC: number; kWmC: number; cpJkgC: number; rhoKgM3: number; alphaM2s: number;
}
const M = (key: string, din: string, kind: MoldMetal['kind'], desc: string, v: number[]): MoldMetal => ({
  key, din, kind, desc,
  costKg: v[0], costM3: v[1], ultimateMPa: v[2], modulusMPa: v[3], yieldMPa: v[4],
  fatigueLimitMPa: v[5], brinell: v[6], volMachineM3h: v[7], areaMachineM2h: v[8],
  cteUmMC: v[9], kWmC: v[10], cpJkgC: v[11], rhoKgM3: v[12], alphaM2s: v[13],
});
export const MOLD_METALS: MoldMetal[] = [
  M('1045', '1.1191 (C45)', 'acero', 'Acero al carbono de alta resistencia; barato, pobre en corrosión/desgaste',
    [7.9, 62300, 752, 207000, 647, 291, 225, 0.0021, 0.053, 12.2, 49.8, 515, 7850, 1.23e-5]),
  M('4140', '1.7225 (42CrMo4)', 'acero', 'Aleado al cromo: buena fatiga, abrasión e impacto',
    [24.0, 188400, 778, 200000, 669, 412, 259, 0.0012, 0.03, 12.2, 42.7, 523, 7850, 1.04e-5]),
  M('P20', '1.2311 / 1.2738', 'acero', 'EL acero de moldes: balance de fatiga, abrasión e impacto (pre-templado)',
    [15.1, 118200, 965, 205000, 830, 456, 300, 0.001, 0.024, 12.8, 32, 500, 7820, 8.18e-6]),
  M('A6', '~1.2725', 'acero', 'Templable a MUY duro; gran resistencia al desgaste y vida a fatiga',
    [40.2, 322600, 2380, 203000, 2100, 834, 650, 0.0007, 0.018, 11.8, 27, 460, 8030, 7.31e-6]),
  M('D2', '1.2379', 'acero', 'Alto carbono/cromo para desgaste y abrasión (resinas cargadas)',
    [21.4, 164000, 2200, 210000, 1929, 755, 685, 0.0007, 0.017, 11.8, 21, 460, 7670, 5.95e-6]),
  M('H13', '1.2344', 'acero', 'Muy aleado y duro; excelente en temperatura y desgaste (corazones/coladas calientes)',
    [32.2, 251000, 1990, 210000, 1650, 760, 528, 0.0002, 0.004, 11.5, 24.3, 460, 7800, 6.77e-6]),
  M('S7', '1.2357', 'acero', 'Tenacidad excelente y alta resistencia; menor resistencia al desgaste',
    [19.0, 148400, 1620, 207000, 1380, 528, 369, 0.001, 0.025, 12.1, 29, 460, 7810, 8.07e-6]),
  M('SS420', '1.2083', 'acero', 'Inoxidable: pulido espejo y resistencia a corrosión (PVC, ópticas, sala limpia)',
    [29.7, 231400, 655, 207000, 345, 190, 195, 0.0013, 0.032, 10.8, 24.9, 460, 7800, 6.94e-6]),
  M('Al 7075-T6', '3.4365', 'no-ferroso', 'Aluminio grado aeronáutico: alta resistencia y anticorrosión (prototipos/bajo volumen)',
    [34.9, 98000, 565, 71000, 421, 149, 150, 0.0091, 0.225, 24, 130, 960, 2808, 4.82e-5]),
  M('Al QC-7', '—', 'no-ferroso', 'Aluminio PARA moldes: más resistencia, dureza y conductividad',
    [29.8, 83400, 579, 72400, 545, 166, 167, 0.0091, 0.225, 24, 142, 864, 2799, 5.87e-5]),
  M('Cu 940', 'CuNi2SiCr (~2.0855)', 'no-ferroso', 'Cobre sin berilio: alta resistencia y conductividad térmica (insertos calientes)',
    [43.2, 375400, 689, 120000, 517, 290, 210, 0.0014, 0.034, 18, 259, 420, 8689, 7.1e-5]),
  // Nota: densidades no-ferrosas derivadas de las columnas del propio libro
  // (costM3 ÷ costKg); cp/α del Cu 940 estimados (fila ilegible en el PDF).
];
export const metalByKey = (k: string) => MOLD_METALS.find((m) => m.key === k)!;

/** Selector §4.4: prioridades → metal recomendado con las RAZONES del libro. */
export function selectMetal(req: {
  produccionAnual?: number;              // ciclos/año esperados
  resinaAbrasiva?: boolean;              // vidrio/mineral (desgaste)
  resinaCorrosiva?: boolean;             // PVC/FR (corrosión)
  pulidoEspejo?: boolean;                // SPI A1-A2
  prioridadTermica?: boolean;            // ciclo corto manda
  prototipo?: boolean;
}): { metal: MoldMetal; porQue: string[] } {
  const why: string[] = [];
  if (req.prototipo) {
    why.push('Prototipo/bajo volumen: aluminio maquinable 9× más rápido que P20 (Apéndice B) y ciclo más corto (α 5.9e-5 vs 8.2e-6).');
    return { metal: metalByKey('Al QC-7'), porQue: why };
  }
  if (req.resinaCorrosiva || req.pulidoEspejo) {
    why.push('Corrosión/pulido espejo mandan: SS420 — "excellent polishability and corrosion resistance" (Apéndice B.3).');
    if ((req.produccionAnual ?? 0) > 1e6) why.push('OJO: fatiga de SS420 = 190 MPa (la MENOR de los aceros) — verificar esfuerzos cap 12.');
    return { metal: metalByKey('SS420'), porQue: why };
  }
  if (req.resinaAbrasiva) {
    why.push('Resina cargada (abrasión): D2 alto carbono/cromo — desgaste con dureza 685 HB y fatiga 755 MPa.');
    why.push('Maquinado 1.4× más lento que P20 y requiere temple: costo de cavidad sube (cap 3).');
    return { metal: metalByKey('D2'), porQue: why };
  }
  if (req.prioridadTermica) {
    why.push('El ciclo manda: Cu 940 con k=259 W/m°C (8× P20) para insertos/corazones calientes; fatiga 290 MPa limita presiones.');
    return { metal: metalByKey('Cu 940'), porQue: why };
  }
  why.push('Caso general: P20 pre-templado — "the most common due to its favorable combination of properties" (§4.4), fatiga 456 MPa, 300 HB sin tratamiento posterior.');
  if ((req.produccionAnual ?? 0) > 2e6) why.push('>2M ciclos/año: considerar H13 templado (fatiga 760 MPa, mejor desgaste) aceptando maquinado 5× más lento.');
  return { metal: metalByKey('P20'), porQue: why };
}

// ── §4.2: dimensionado de insertos ───────────────────────────────────
export interface InsertSizing {
  coolingDiaMm: number;
  extraHmm: number; cheekMm: number;
  driver: 'estructural' | 'refrigeración';
  insertLmm: number; insertWmm: number;
  insertHcavityMm: number; insertHcoreMm: number;   // redondeadas a placa de 10 mm
}
/** ⌀ de línea de agua por tamaño de molde (§4.2.1: 4.76 mm chicos → 15.88 mm grandes). */
export function coolingLineDia(partMaxMm: number): number {
  if (partMaxMm < 100) return 4.76;      // 3/16"
  if (partMaxMm < 200) return 6.35;      // 1/4"
  if (partMaxMm < 350) return 7.94;      // 5/16"
  if (partMaxMm < 500) return 9.53;      // 3/8"
  if (partMaxMm < 700) return 11.11;     // 7/16"
  return 15.88;                          // 5/8"
}
export function sizeInserts(part: { Lmm: number; Wmm: number; depthMm: number }): InsertSizing {
  const dia = coolingLineDia(Math.max(part.Lmm, part.Wmm));
  const cool = 3 * dia;                                  // §4.2.1/§4.2.2: 3⌀ por lado
  const cheek = Math.max(cool, part.depthMm);            // §4.2.2: cheek = profundidad si es honda
  const driver = part.depthMm > cool ? 'estructural' : 'refrigeración';
  const round10 = (x: number) => Math.ceil(x / 10) * 10; // placas A/B en pasos de 10 mm (§4.2.1)
  return {
    coolingDiaMm: dia, extraHmm: cool, cheekMm: cheek, driver,
    insertLmm: part.Lmm + 2 * cheek, insertWmm: part.Wmm + 2 * cheek,
    insertHcavityMm: round10(part.depthMm + cool),
    insertHcoreMm: round10(cool + part.depthMm * 0),     // core: 3⌀ bajo la partición (el macho va aparte)
  };
}

// ── §4.3: base estándar ──────────────────────────────────────────────
/** Catálogo métrico estilo HASCO/DME (el libro: estándar de 200 a 1000 mm/lado). */
export const STANDARD_BASES: Array<{ wmm: number; lmm: number }> = [];
{
  const sizes = [196, 246, 296, 346, 396, 446, 496, 596, 696, 796, 996];
  for (let i = 0; i < sizes.length; i++)
    for (let j = i; j < Math.min(i + 3, sizes.length); j++)
      STANDARD_BASES.push({ wmm: sizes[i], lmm: sizes[j] });
}
/** §4.4.4: las bases solo vienen en estos aceros (no en aceros de inserto tipo A6/D2/H13). */
export const BASE_MATERIALS = ['1045', '4140', 'P20'] as const;
export type BaseMaterial = typeof BASE_MATERIALS[number];
export interface BaseSelection {
  base: { wmm: number; lmm: number };
  envelope: { wmm: number; lmm: number }; aspect: number;
  reserveMm: number; leaderPinDia: number;
  plateAmm: number; plateBmm: number;
  /** acero de la base (§4.4.4: 1045/4140/P20 — catálogo distinto al del inserto). */
  baseMaterial: BaseMaterial;
  ok: boolean; warnings: string[];
}
export function selectMoldBase(
  ins: InsertSizing, layout: { nx: number; ny: number; runnerGapMm?: number },
): BaseSelection {
  const gap = layout.runnerGapMm ?? 30;                   // pasillo entre cavidades (runner+agua)
  const envW = layout.nx * ins.insertWmm + (layout.nx - 1) * gap;
  const envL = layout.ny * ins.insertLmm + (layout.ny - 1) * gap;
  const aspect = Math.max(envW, envL) / Math.min(envW, envL);
  const warnings: string[] = [];
  if (aspect > 2) warnings.push(`aspecto ${aspect.toFixed(2)}:1 > 2:1 (§4.3.1) — reacomodar la rejilla`);
  // reserva perimetral: pilares guía + retornos; holgura ≥ ½⌀ de cada componente (§4.3.2)
  const pin = Math.min(50, Math.max(16, Math.round(Math.max(envW, envL) / 12)));
  const reserve = pin * 2;                                // ⌀ del pilar + ½⌀ de holgura por lado (redondeado)
  const need = { w: envW + 2 * reserve, l: envL + 2 * reserve };
  const base = STANDARD_BASES
    .flatMap((b) => [b, { wmm: b.lmm, lmm: b.wmm }])
    .filter((b) => b.wmm >= need.w && b.lmm >= need.l)
    .sort((a, b2) => a.wmm * a.lmm - b2.wmm * b2.lmm)[0];
  if (!base) warnings.push('no hay base estándar ≤ 996 mm: molde CUSTOM (§4.3.4)');
  return {
    base: base ?? { wmm: NaN, lmm: NaN },
    envelope: { wmm: +envW.toFixed(1), lmm: +envL.toFixed(1) }, aspect: +aspect.toFixed(2),
    reserveMm: reserve, leaderPinDia: pin,
    plateAmm: ins.insertHcavityMm, plateBmm: Math.max(ins.insertHcoreMm, 30),
    baseMaterial: 'P20' as BaseMaterial,
    ok: !!base && aspect <= 2, warnings,
  };
}

// ── §4.3.3: compatibilidad con la máquina ────────────────────────────
export interface Machine {
  name: string; tieHmm: number; tieVmm: number;
  minDaylightMm: number; maxDaylightMm: number;
  maxShotCc: number; clampTons: number;                   // métricas
}
/** La máquina del LIBRO (Fig 4.23-4.24) + típicas LATAM chicas. */
export const MACHINES: Machine[] = [
  { name: 'Battenfeld HM320 (libro)', tieHmm: 800, tieVmm: 630, minDaylightMm: 350, maxDaylightMm: 800, maxShotCc: 490, clampTons: 326 },
  { name: 'genérica 60 t', tieHmm: 360, tieVmm: 360, minDaylightMm: 150, maxDaylightMm: 420, maxShotCc: 96, clampTons: 60 },
  { name: 'genérica 120 t', tieHmm: 470, tieVmm: 470, minDaylightMm: 200, maxDaylightMm: 550, maxShotCc: 210, clampTons: 120 },
];
export interface MachineCheck {
  ok: boolean; fits: boolean; issues: string[];
  shotPct: number;                                        // % del barril
}
export function checkMachine(
  /** `openStrokeMm` = carrera de apertura (§6.3.2, `moldOpeningStrokeMm(altura de pieza)`). */
  mold: { wmm: number; lmm: number; stackMm: number; shotCc: number; clampNeedTons: number; openStrokeMm: number },
  mc: Machine,
): MachineCheck {
  const issues: string[] = [];
  const fits = mold.wmm <= mc.tieHmm && mold.lmm <= mc.tieVmm;
  if (!fits) issues.push(`no pasa entre tie bars (${mc.tieHmm}×${mc.tieVmm})`);
  if (mold.stackMm < mc.minDaylightMm) issues.push(`stack ${mold.stackMm} < daylight mín ${mc.minDaylightMm}: el clamp no cierra`);
  // "no cabe abierto" se juzgaba con el molde CERRADO: el mensaje decía ABIERTO y medía
  // el stack pelón. Abierto = stack + carrera (Tabla 6.1: 264 + 75 = 339).
  // Sin carrera NO se puede juzgar: falla CERRADO (no aprobar a ciegas).
  if (!Number.isFinite(mold.openStrokeMm)) {
    issues.push('carrera de apertura no calculada: no se puede juzgar el daylight (§6.3.2) → pasar openStrokeMm = 2.5 × altura de pieza');
  } else {
    const need = daylightNeededMm(mold.stackMm, mold.openStrokeMm);
    if (need > mc.maxDaylightMm) issues.push(`stack ${mold.stackMm} + carrera ${mold.openStrokeMm} = ${need} > daylight máx ${mc.maxDaylightMm}: CIERRA pero no ABRE (§6.3.2)`);
  }
  const shotPct = 100 * mold.shotCc / mc.maxShotCc;
  if (shotPct < 25) issues.push(`shot ${shotPct.toFixed(0)}% del barril < 25%: residencia larga → degradación (§4.3.3)`);
  if (shotPct > 50) issues.push(`shot ${shotPct.toFixed(0)}% del barril > 50%: homogeneidad del fundido en riesgo (§4.3.3)`);
  if (mold.clampNeedTons > mc.clampTons) issues.push(`clamp requerido ${mold.clampNeedTons.toFixed(0)} t > ${mc.clampTons} t: FLASH`);
  if (mold.clampNeedTons < mc.clampTons / 10) issues.push(`molde muy chico para ${mc.clampTons} t: riesgo de aplastarlo (§4.3.3)`);
  return { ok: fits && issues.length === 0, fits, issues, shotPct: +shotPct.toFixed(1) };
}
