/**
 * GENERADOR de impresión — controla la FIGURA con sus limitaciones: la unión (térmica/
 * Poisson), la VELOCIDAD, y la RUTA (toolpath). Puro, testeable. Orden de magnitud,
 * calibrable con las pruebas reales del usuario en la K1.
 *
 * La UNIÓN es térmica (campo de calor = ec. de Poisson/calor → diagonal en la cara-𝔦).
 * Lo que decide si pega: el tiempo Δt entre depositar las DOS superficies que se tocan,
 * contra la ventana soldable (printsim). Pasadas vecinas: Δt corto → sueldan. Un cuello
 * AISLADO al que el disco de arriba llega una capa después: Δt largo → FRÍO → no suelda
 * (frangible térmico, además de geométrico). La VELOCIDAD fija Δt y la calidad/throughput.
 */
import { cycloidalDisc, pinPositions, type Pt2 } from './cycloidal';
import { fusionGapMin, K1 } from './printsim';

// ── La UNIÓN (térmica = campo de calor/Poisson) — honesto, reusando printsim ──
// Lo que decide si dos superficies se VUELVEN una al imprimir: el HUECO entre ellas
// contra g_min (umbral térmico de fusión, depende del ventilador). Contacto/hueco chico
// → funde (rígido). Hueco ≥ g_min → NO funde (junta libre, gira). El campo de calor
// que fija g_min obedece la ec. de Poisson/calor → diagonal en la cara-𝔦.
export type Union = 'fundido' | 'libre';
export function unionAcrossGap(gapMm: number, fanOn = true): { type: Union; gMin: number; welds: boolean } {
  const gMin = fusionGapMin(fanOn ? K1.fanOn_h : K1.fanOff_h);
  const welds = gapMm < gMin;
  return { type: welds ? 'fundido' : 'libre', gMin: +gMin.toFixed(3), welds };
}
// Frangibilidad por ÁREA (no por temperatura): aunque el cuello SUELDE (arriba de T_g),
// es delgado → rompe a F = τ·A. Cuello = unión fundida pero de área chiquita.
const TAU_PLA = 28; // MPa
export function frangibleForce(areaMm2: number): number { return +(TAU_PLA * areaMm2).toFixed(2); }
export function areaForForce(forceN: number): number { return +(forceN / TAU_PLA).toFixed(3); }

// ── La ruta: toolpath de UNA capa del disco (perímetro + barrenos + relleno) ──
export type SegType = 'perimetro' | 'barreno' | 'relleno' | 'viaje';
export interface Seg { pts: Pt2[]; type: SegType; speed: number; extrude: boolean; }
export interface Toolpath {
  segs: Seg[]; extrudeLen: number; travelLen: number; estSec: number;
}

const len = (pts: Pt2[]) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; };
const circle = (cx: number, cy: number, r: number, n = 48): Pt2[] => Array.from({ length: n + 1 }, (_, i) => ({ x: cx + r * Math.cos(2 * Math.PI * i / n), y: cy + r * Math.sin(2 * Math.PI * i / n) }));

export function discLayerToolpath(p: { lobes: number; R: number; Rr: number; E: number; shaftD: number; outPinD: number; outPins: number; nozzle?: number; fanOn?: boolean }): Toolpath {
  const nz = p.nozzle ?? 0.4;
  const disc = cycloidalDisc({ lobes: p.lobes, R: p.R, Rr: p.Rr, E: p.E, segments: Math.max(120, p.lobes * 12) });
  const segs: Seg[] = [];
  let cur: Pt2 = { x: 0, y: 0 };
  const vPerim = 200, vInfill = 350;            // K1: perímetro lento (calidad), relleno rápido
  const add = (pts: Pt2[], type: SegType, speed: number, extrude: boolean) => {
    if (extrude && pts.length) segs.push({ pts: [cur, pts[0]], type: 'viaje', speed: 600, extrude: false }); // viaje al inicio
    segs.push({ pts, type, speed, extrude });
    cur = pts[pts.length - 1];
  };
  // PERÍMETRO externo (la curva cicloidal) — lento, fundido (es la pared, manda calidad)
  add([...disc.profile, disc.profile[0]], 'perimetro', vPerim, true);
  // BARRENOS: bore central + barrenos de salida (perímetros internos)
  add(circle(0, 0, p.shaftD / 2 + p.E), 'barreno', vPerim, true);
  const outR = p.R * 0.55;
  for (const c of pinPositions(outR, Math.max(3, Math.round(p.outPins)))) add(circle(c.x, c.y, p.outPinD / 2 + p.E), 'barreno', vPerim, true);
  // RELLENO: anillos concéntricos dentro del perfil (rápido), sin invadir el bore
  for (let r = disc.maxR - nz * 3; r > p.shaftD / 2 + p.E + nz * 2; r -= nz * 3) add(circle(0, 0, r), 'relleno', vInfill, true);

  let ext = 0, tra = 0, sec = 0;
  for (const s of segs) { const L = len(s.pts); if (s.extrude) ext += L; else tra += L; sec += L / s.speed; }
  return { segs, extrudeLen: +ext.toFixed(1), travelLen: +tra.toFixed(1), estSec: +sec.toFixed(2) };
}
