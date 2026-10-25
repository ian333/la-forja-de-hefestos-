/**
 * TIPOS DE EXPULSOR — Kazmer §11.3.2-5 (cada expulsor es una pieza mecánica).
 * ==============================================================================
 * Después del pin (§11.2, ya en ejection.ts), el libro da los otros expulsores,
 * cada uno para una geometría distinta de la pieza:
 *
 *  · BLADE (§11.3.2): pin rectangular BAJO una costilla (empuja donde nace la
 *    fricción). Delgado → puede PANDEAR: I=W·H³/12 [11.17], y la longitud máx
 *    L < √(1.7·E·W·H³/F_blade) [11.19].
 *  · SLEEVE (§11.3.3): cilindro hueco que corre sobre un core pin para expulsar
 *    un BOSS. Sin problema de esfuerzo/pandeo; lo crítico es el stack-up de
 *    tolerancias (concentricidad sleeve/pin/barreno).
 *  · STRIPPER PLATE (§11.3.4): placa que empuja TODO el perímetro → fuerza
 *    uniforme, bajo esfuerzo; reemplaza la placa B y flota (bolt la jala al abrir).
 *  · UNDERCUT elástico (§11.3.5): la pared se deforma para escapar el undercut;
 *    ε=δ/L [11.20] debe ser < deformación a cedencia; F=μ·cos(φ)·E·(δ/L)·A_eff
 *    [11.23]; cortante τ=F/(π·φ·h) < ½·cedencia.
 *
 * Reproduce el libro EXACTO: blade del bezel L_máx 93 mm (235 N/blade); undercut
 * de la tapa ε 1.3%, F 1,200 N, τ 1.7 MPa. PURO: node-testeable.
 */

import { type EjectionMaterial } from './ejection';

export const E_STEEL_PA = 200e9;

// ── §11.3.2 EJECTOR BLADE (pandeo) ────────────────────────────────────
/** Eq (11.17): inercia de la sección rectangular del blade = W·H³/12 (m⁴). W,H en mm. */
export function bladeInertiaM4(wMm: number, hMm: number): number {
  return ((wMm / 1000) * Math.pow(hMm / 1000, 3)) / 12;
}
/** Eq (11.18): carga crítica de pandeo del blade (columna, K=0.7 fijo-guiado). */
export function bladeBucklingForceN(wMm: number, hMm: number, lMm: number, ePa = E_STEEL_PA): number {
  const I = bladeInertiaM4(wMm, hMm);
  return (Math.PI * Math.PI * ePa * I) / Math.pow(0.7 * (lMm / 1000), 2);
}
/** Eq (11.19): longitud MÁXIMA del blade para no pandear con la fuerza por blade (mm). */
export function bladeMaxLengthMm(fBladeN: number, wMm: number, hMm: number, ePa = E_STEEL_PA): number {
  return Math.sqrt((1.7 * ePa * (wMm / 1000) * Math.pow(hMm / 1000, 3)) / fBladeN) * 1000;
}

// ── §11.3.5 UNDERCUT ELÁSTICO ─────────────────────────────────────────
/** Eq (11.20): deformación al escapar el undercut = δ/L (fracción). */
export const undercutStrain = (deltaMm: number, lMm: number): number => deltaMm / lMm;
/** Eq (11.23): fuerza de expulsión del undercut = μ·cos(φ)·E·(δ/L)·A_eff (N). */
export function undercutEjectForceN(m: EjectionMaterial, o: { deltaMm: number; lMm: number; aEffM2: number; draftDeg?: number }): number {
  return m.mu * Math.cos(((o.draftDeg ?? 0) * Math.PI) / 180) * m.E * (o.deltaMm / o.lMm) * o.aEffM2;
}
/** Cortante en el undercut al deslizar = F/(π·φ·h) (MPa). φ,h en mm. */
export function undercutShearMPa(fEjectN: number, phiMm: number, hMm: number): number {
  return fEjectN / (Math.PI * (phiMm / 1000) * (hMm / 1000)) / 1e6;
}

export interface BladeCheck { fPerBladeN: number; maxLenMm: number; bucklingN: number; ok: boolean; nota: string }
/** Dimensiona blades: fuerza por blade + longitud máxima vs la real → veredicto pandeo. */
export function checkEjectorBlade(o: {
  fEjectN: number; nBlades: number; widthMm: number; thickMm: number; actualLenMm: number; ePa?: number;
}): BladeCheck {
  const fPer = o.fEjectN / o.nBlades;
  const maxLen = bladeMaxLengthMm(fPer, o.widthMm, o.thickMm, o.ePa);
  const buck = bladeBucklingForceN(o.widthMm, o.thickMm, o.actualLenMm, o.ePa);
  const ok = o.actualLenMm <= maxLen;
  return {
    fPerBladeN: +fPer.toFixed(0), maxLenMm: +maxLen.toFixed(1), bucklingN: +buck.toFixed(0), ok,
    nota: ok ? 'blade ok contra pandeo'
      : `blade ${o.actualLenMm}mm > máx ${maxLen.toFixed(0)}mm: más blades, más grueso, o push pad (§11.3.2)`,
  };
}

export interface UndercutCheck {
  strainPct: number; strainOk: boolean; sigmaMPa: number;
  fEjectN: number; shearMPa: number; shearOk: boolean; ok: boolean; nota: string;
}
/** Verifica si un undercut se puede expulsar elásticamente (strain < cedencia, τ < ½·cedencia). */
export function checkUndercut(m: EjectionMaterial, o: {
  deltaMm: number; lMm: number; aEffM2: number; phiMm: number; hMm: number;
  strainYieldPct?: number; draftDeg?: number;
}): UndercutCheck {
  const eps = undercutStrain(o.deltaMm, o.lMm);
  const strainYield = o.strainYieldPct ?? 2;          // §11.3.5: guía 2% para la mayoría de plásticos
  const strainOk = eps * 100 < strainYield;
  const sigma = m.E * eps;
  const f = undercutEjectForceN(m, o);
  const tau = undercutShearMPa(f, o.phiMm, o.hMm);
  const shearOk = tau < m.sigmaYield / 1e6 / 2;
  const notas: string[] = [];
  if (!strainOk) notas.push(`ε ${(eps * 100).toFixed(1)}% ≥ ${strainYield}% cedencia: undercut no se estira elástico → slide/collapsible core`);
  if (!shearOk) notas.push(`τ ${tau.toFixed(1)} MPa ≥ ½·cedencia: el stripper deforma la pieza`);
  return {
    strainPct: +(eps * 100).toFixed(2), strainOk, sigmaMPa: +(sigma / 1e6).toFixed(1),
    fEjectN: +f.toFixed(0), shearMPa: +tau.toFixed(2), shearOk, ok: strainOk && shearOk,
    nota: notas.length ? notas.join(' · ') : 'undercut expulsable elásticamente por stripper (§11.3.5)',
  };
}

// ── LA PUERTA (orden C, 2026-10-24): ¿esta contrasalida medida se podría botar ESTIRÁNDOSE? ─────────────────
/** Una región de contrasalida tal como la mide `dfm-mesh` (§2.3.7) sobre la dirección de apertura del paso 5 (+Z). */
export interface RegionContrasalida {
  x0: number; x1: number; y0: number; y1: number; zLo: number; zHi: number;
  dir: [number, number] | null;
}
export interface ContrasalidaDictamen {
  /** penetración medida a lo largo de su dirección de jale (mm) — la misma lectura que `planSideAction` */
  deltaMm: number;
  /** el tramo de pared que tendría que doblarse para soltarla (mm): la altura a la que está el labio */
  lMm: number;
  /** null = cavidad sellada (no ventea a ningún lado): ni una corredera la alcanza */
  check: UndercutCheck | null;
  /** lo que haría falta, en una línea de taller */
  haria: string;
}
/**
 * El juez del libro (`checkUndercut`, §11.3.5 Eq 11.20–11.23) cableado a UNA región medida. La geometría sale de la región:
 *  · δ = cuánto se mete la contrasalida en su dirección de jale (bbox a lo largo de `dir`, como `planSideAction`); con el
 *    raster de ~0.8 mm, una región de una columna mide δ = una celda: la resolución manda y se dice.
 *  · L = zHi (la altura a la que empieza el material de arriba = el tramo de pared que se dobla para soltar el labio).
 *  · A_eff = ancho ⊥ jale × alto del hueco (la cara que roza), como el A_proj de `planSideAction`.
 *  · φ y h: el libro los da para una TAPA REDONDA (el anillo π·φ·h que corta la placa extractora). Para un labio recto el
 *    anillo se vuelve el ancho del labio: φ = ancho/π y h = la pared de la pieza.
 *  Regla de Hefestos, sin cita (L = zHi, φ = ancho/π): el libro solo trae el caso redondo (δ 1 mm sobre L 77 mm, ε 1.3 %).
 * NO decide la puerta (la puerta cierra con cualquier contrasalida significativa: aquí no hay placa extractora ni
 * correderas): dice QUÉ HARÍA FALTA.
 */
export function contrasalidaQueHariaFalta(m: EjectionMaterial, r: RegionContrasalida, paredMm: number): ContrasalidaDictamen {
  if (!r.dir) return { deltaMm: 0, lMm: 0, check: null, haria: 'hueco encerrado por todos lados: no lo alcanza ni una corredera — hay que cambiar la pieza (§2.3.7)' };
  const alongX = Math.abs(r.dir[0]) > Math.abs(r.dir[1]);
  const deltaMm = +(alongX ? r.x1 - r.x0 : r.y1 - r.y0).toFixed(1);
  const ancho = Math.max(0.1, alongX ? r.y1 - r.y0 : r.x1 - r.x0);
  const alto = Math.max(0.1, r.zHi - r.zLo);
  const lMm = +Math.max(1, r.zHi).toFixed(1);
  const check = checkUndercut(m, { deltaMm, lMm, aEffM2: ancho * alto * 1e-6, phiMm: ancho / Math.PI, hMm: Math.max(0.3, paredMm) });
  // el cortante solo se dice si se estira: pasada la cedencia, la fuerza de Eq 11.23 ya no describe nada (medido en la tapa
  // 1594C: ε 6.6 % daba τ 250 MPa — un número que solo hace ruido)
  const haria = check.ok
    ? `podría botarse estirándose con placa extractora: ε ${check.strainPct} % < 2 % (§11.3.5) — aquí no la diseño`
    : !check.strainOk
      ? `no se estira (ε = ${deltaMm}/${lMm} = ${check.strainPct} % ≥ 2 %, §11.3.5): pide corredera o botador inclinado (§11.3.6–7)`
      : `se estiraría (ε ${check.strainPct} % < 2 %) pero la placa extractora la deformaría (τ ${check.shearMPa} MPa ≥ ½ cedencia): pide corredera o botador inclinado (§11.3.6–7)`;
  return { deltaMm, lMm, check, haria };
}

export type EjectorType = 'pin' | 'blade' | 'sleeve' | 'stripper';
/** Decide el tipo de expulsor por la geometría de la pieza (§11.3.1-4). */
export function chooseEjectorType(feat: {
  rib?: boolean; boss?: boolean; fullPerimeter?: boolean; thinWall?: boolean; flatPushArea?: boolean;
}): { type: EjectorType; porQue: string } {
  if (feat.fullPerimeter) return { type: 'stripper', porQue: 'empuje en TODO el perímetro → fuerza uniforme, bajo esfuerzo, poca deformación (§11.3.4)' };
  if (feat.boss) return { type: 'sleeve', porQue: 'boss sobre core pin → sleeve hueco empuja el fondo del boss donde nace la fricción (§11.3.3)' };
  if (feat.rib) return { type: 'blade', porQue: 'costilla → blade rectangular BAJO la costilla, en línea con la fricción (§11.3.2); verificar pandeo' };
  return { type: 'pin', porQue: 'superficie plana rígida → pin redondo estándar (§11.2), el más barato de maquinar' };
}
