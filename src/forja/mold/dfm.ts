/**
 * DFM CHECKER — Design for Injection Molding (Kazmer cap 2 §2.3, LITERAL).
 * ========================================================================
 * Revisa el diseño de la PIEZA antes de diseñar el molde, con las reglas
 * numéricas del libro:
 *  §2.3.1 pared UNIFORME (gruesa+delgada = distorsión/voids; flujo delgado→
 *         grueso con transición seca = jetting).
 *  §2.3.2 costillas: base ≤ 70 % de la pared (sin carga → sink/void), altura
 *         típica 4×pared, espaciado 10×pared, draft 2° típico en costillas.
 *  §2.3.3 bosses: espesor de boss/costilla/gusset = 70 % de la pared.
 *  §2.3.4 esquinas: filete EXTERNO ≥ 150 % de la pared, INTERNO ≥ 50 %
 *         (espesor constante al doblar); chaflán interno ≥ 50 % de la pared.
 *  §2.3.6 draft: mínimo 0.5°, típico 1-2°; +1° por cada 20 µm de rugosidad/
 *         textura; Tabla 2.14 EXACTA como ancla por acabado.
 *  §2.3.7 undercuts: ventana lateral, overhang, boss horizontal, snap →
 *         interfieren la expulsión (slide/core pull §11.3 o rediseño).
 * PURO: node-testeable. La geometría se DECLARA (o viene de draftAnalysis).
 */

export interface DFMWall { label: string; thicknessMm: number; transition?: 'seca' | 'gradual'; flujoDesdeDelgado?: boolean }
export interface DFMRib { label: string; baseMm: number; heightMm: number; spacingMm?: number; draftDeg?: number }
export interface DFMBoss { label: string; wallMm: number; gussetMm?: number }
export interface DFMCorner { label: string; kind: 'externo' | 'interno'; radiusMm?: number; chamferMm?: number }
export interface DFMUndercut { label: string; kind: 'ventana' | 'overhang' | 'boss-horizontal' | 'snap' }
export interface DFMPart {
  nominalWallMm: number;
  material?: { resin?: string; cargado?: boolean };       // vidrio/mineral
  surface?: { finish?: string; roughnessUm?: number };
  draftDeg?: number;                                      // aplicado (p.ej. de draftAnalysis)
  walls?: DFMWall[]; ribs?: DFMRib[]; bosses?: DFMBoss[];
  corners?: DFMCorner[]; undercuts?: DFMUndercut[];
}
export interface DFMFinding { ref: string; severity: 'error' | 'warn' | 'ok'; msg: string }
export interface DFMReport { findings: DFMFinding[]; errors: number; warns: number; score: number; resumen: string[] }

/** Tabla 2.14 del libro, EXACTA (acabado → rugosidad → draft recomendado). */
export const DRAFT_TABLE_214 = [
  { finish: 'Clase A-1', resin: 'Acrílico', roughnessUm: 0.01, draftDeg: 0.5 },
  { finish: 'Clase B-3', resin: 'ABS', roughnessUm: 12, draftDeg: 1.5 },
  { finish: 'Textura arena', resin: 'PC 20% vidrio', roughnessUm: 12, draftDeg: 2 },
  { finish: 'Textura piel', resin: 'PVC suave', roughnessUm: 125, draftDeg: 4 },
  { finish: 'Textura piel', resin: 'ABS', roughnessUm: 125, draftDeg: 7.5 },
];

/** Draft recomendado por acabado: regla del libro (mín 0.5°, +1° por 20 µm),
 *  acotada por abajo con las anclas de la Tabla 2.14. */
export function draftForFinish(roughnessUm: number): number {
  const regla = 0.5 + roughnessUm / 20;
  // ancla de la Tabla 2.14: si hay filas con ESTA rugosidad, el MENOR draft de
  // ellas (el acabado exacto puede pedir más — p.ej. piel/ABS 7.5°); si no,
  // el mayor draft de las filas más lisas.
  const exactas = DRAFT_TABLE_214.filter((r) => Math.abs(r.roughnessUm - roughnessUm) < 1e-9);
  const menores = DRAFT_TABLE_214.filter((r) => r.roughnessUm < roughnessUm);
  const ancla = exactas.length
    ? Math.min(...exactas.map((r) => r.draftDeg))
    : menores.reduce((m, r) => Math.max(m, r.draftDeg), 0.5);
  return Math.max(regla, ancla);
}

export function checkDFM(p: DFMPart): DFMReport {
  const F: DFMFinding[] = [];
  const t = p.nominalWallMm;
  const add = (ref: string, severity: DFMFinding['severity'], msg: string) => F.push({ ref, severity, msg });

  // §2.3.1 — pared uniforme
  const walls = p.walls ?? [];
  if (walls.length) {
    const ths = walls.map((w) => w.thicknessMm);
    const ratio = Math.max(...ths) / Math.min(...ths);
    if (ratio > 1.5) add('§2.3.1', 'error', `pared no uniforme (${Math.min(...ths)}→${Math.max(...ths)} mm, ratio ${ratio.toFixed(2)}): enfriamiento diferencial → distorsión/voids; usa pared delgada + costillas`);
    else if (ratio > 1.15) add('§2.3.1', 'warn', `variación de pared ${((ratio - 1) * 100).toFixed(0)} %: contracción diferencial — transiciones graduales`);
    else add('§2.3.1', 'ok', 'pared uniforme');
    for (const w of walls) {
      if (w.flujoDesdeDelgado && (w.transition ?? 'seca') === 'seca')
        add('§2.3.1', 'error', `${w.label}: flujo delgado→grueso con transición SECA → jetting y mal acabado; invierte el flujo o gradúa la transición`);
    }
  }

  // §2.3.2 — costillas
  for (const r of p.ribs ?? []) {
    const frac = r.baseMm / t;
    if (frac > 0.7 && !p.material?.cargado)
      add('§2.3.2', 'error', `${r.label}: base ${r.baseMm} mm = ${(frac * 100).toFixed(0)} % de la pared > 70 % (resina sin carga) → sink/void en la cara opuesta`);
    else if (frac > 0.7)
      add('§2.3.2', 'warn', `${r.label}: base ${(frac * 100).toFixed(0)} % > 70 % — tolerable SOLO por la carga de la resina (baja contracción)`);
    else add('§2.3.2', 'ok', `${r.label}: base ${(frac * 100).toFixed(0)} % ≤ 70 % ✓`);
    if (r.heightMm > 4 * t + 1e-9)
      add('§2.3.2', 'warn', `${r.label}: altura ${r.heightMm} mm > 4×pared (${4 * t}) — el diseño típico del libro usa 4×; más alta exige draft y expulsión cuidadosos`);
    if (r.spacingMm != null && r.spacingMm < 10 * t)
      add('§2.3.2', 'warn', `${r.label}: espaciado ${r.spacingMm} mm < 10×pared (${10 * t}) — el patrón eficiente del libro usa 10×`);
    if (r.draftDeg != null && r.draftDeg < 0.5)
      add('§2.3.6', 'error', `${r.label}: draft ${r.draftDeg}° < 0.5° mínimo — se pega al expulsar (típico en costillas: 2°)`);
  }

  // §2.3.3 — bosses
  for (const b of p.bosses ?? []) {
    const frac = b.wallMm / t;
    if (frac > 0.7) add('§2.3.3', 'error', `${b.label}: pared del boss ${(frac * 100).toFixed(0)} % > 70 % de la nominal → ciclo largo y marcas`);
    else add('§2.3.3', 'ok', `${b.label}: boss al ${(frac * 100).toFixed(0)} % ✓ (gusset ${b.gussetMm ?? '—'} mm)`);
    if (b.gussetMm != null && b.gussetMm / t > 0.7)
      add('§2.3.3', 'warn', `${b.label}: gusset ${(100 * b.gussetMm / t).toFixed(0)} % > 70 %`);
  }

  // §2.3.4 — esquinas
  for (const c of p.corners ?? []) {
    if (c.radiusMm != null) {
      const need = c.kind === 'externo' ? 1.5 * t : 0.5 * t;
      if (c.radiusMm < need - 1e-9)
        add('§2.3.4', c.radiusMm === 0 ? 'error' : 'warn', `${c.label}: filete ${c.kind} R${c.radiusMm} < ${need} mm (${c.kind === 'externo' ? '150' : '50'} % de la pared) → concentración de esfuerzo y warpage`);
      else add('§2.3.4', 'ok', `${c.label}: R${c.radiusMm} ✓`);
    } else if (c.chamferMm != null) {
      if (c.kind === 'interno' && c.chamferMm < 0.5 * t - 1e-9)
        add('§2.3.4', 'warn', `${c.label}: chaflán interno ${c.chamferMm} < 0.5×pared (${0.5 * t})`);
      else add('§2.3.4', 'ok', `${c.label}: chaflán ${c.chamferMm} ✓`);
    } else {
      add('§2.3.4', 'error', `${c.label}: esquina VIVA (sin filete ni chaflán) → esfuerzo, maquinado difícil, warpage por calor atrapado`);
    }
  }

  // §2.3.6 — draft global vs acabado
  const rough = p.surface?.roughnessUm;
  if (p.draftDeg != null) {
    const rec = rough != null ? draftForFinish(rough) : 1;
    if (p.draftDeg < 0.5) add('§2.3.6', 'error', `draft ${p.draftDeg}° < 0.5° mínimo del libro`);
    else if (p.draftDeg < rec) add('§2.3.6', 'warn', `draft ${p.draftDeg}° < ${rec.toFixed(1)}° recomendado para rugosidad ${rough} µm (+1°/20 µm, Tabla 2.14)`);
    else add('§2.3.6', 'ok', `draft ${p.draftDeg}° ≥ ${rec.toFixed(1)}° recomendado ✓`);
  }

  // §2.3.7 — undercuts
  for (const u of p.undercuts ?? []) {
    add('§2.3.7', 'warn', `${u.label}: undercut tipo ${u.kind} — interfiere la expulsión: slide/core pull (§11.3.6-7) o rediseño (el diseñador suele no verlo)`);
  }

  const errors = F.filter((f) => f.severity === 'error').length;
  const warns = F.filter((f) => f.severity === 'warn').length;
  const score = Math.max(0, 100 - 15 * errors - 5 * warns);
  const resumen = [
    `DFM ${score}/100 · ${errors} errores · ${warns} avisos (Kazmer §2.3)`,
    ...F.filter((f) => f.severity !== 'ok').map((f) => `${f.severity === 'error' ? '✗' : '⚠'} ${f.ref} ${f.msg}`),
  ];
  return { findings: F, errors, warns, score, resumen };
}
