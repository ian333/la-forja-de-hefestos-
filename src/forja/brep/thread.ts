// ─────────────────────────────────────────────────────────────────
// ROSCA MODELADA — la cuerda de VERDAD (no cosmética)
// ─────────────────────────────────────────────────────────────────
//
// Cómo lo hacen los grandes (investigado): Fusion/SolidWorks ofrecen rosca
// COSMÉTICA (un "decal", ~0.02 s, para el plano/ensambles) y rosca MODELADA
// (geometría helicoidal real, 0.5-20 s, para impresión/CNC/ver). El modelado
// = método manual de SolidWorks: un PERFIL de rosca barrido por una HÉLICE y
// cortado con Swept-Cut. Aquí replicamos eso con el kernel OCCT.
//
// Perfil ISO 68-1 / ISO 261 (rosca métrica, flanco a 60°):
//   H  = P·√3/2 = 0.8660·P        (triángulo fundamental)
//   h  = 5/8·H  = 0.5413·P        (profundidad del hilo, tras truncar cresta ⅛H y raíz ¼H)
//   d2 = d − 0.6495·P             (diámetro de paso)
//   d1 = d − 1.0825·P             (diámetro menor)
// d = diámetro MAYOR (nominal). Ej.: M8×1.25 → d=8, P=1.25, h=0.677, d1=6.65.
//
// NOTA de barrido: sweepProfileAlong usa MakePipe (marco corregido). Como el
// perfil V es ORIENTADO (a diferencia del círculo de los resortes), verificar
// a ojo que la V apunte SIEMPRE radial-adentro; si tuerce, migrar a
// MakePipeShell con modo Frenet. Ver [[reference_forja_planos_engine]].

import type { OC, Shape, Pt2 } from './occt';
import { makeCylinder, sweepProfileAlong, sweepProfilePipeShell, cut, fuse, volume } from './occt';

export interface ThreadSpec { desig: string; d: number; pitch: number }

/** Tabla métrica de paso GRUESO (ISO 261 coarse): designación → mayor + paso. */
export const METRIC_COARSE: ThreadSpec[] = [
  { desig: 'M3', d: 3, pitch: 0.5 },
  { desig: 'M4', d: 4, pitch: 0.7 },
  { desig: 'M5', d: 5, pitch: 0.8 },
  { desig: 'M6', d: 6, pitch: 1.0 },
  { desig: 'M8', d: 8, pitch: 1.25 },
  { desig: 'M10', d: 10, pitch: 1.5 },
  { desig: 'M12', d: 12, pitch: 1.75 },
  { desig: 'M16', d: 16, pitch: 2.0 },
  { desig: 'M20', d: 20, pitch: 2.5 },
];

/** Designación estándar de una rosca: M<mayor>×<paso>. */
export function threadDesignation(d: number, pitch: number): string {
  return `M${Math.round(d)}×${pitch}`;
}

/** Diámetros derivados del perfil ISO 68-1. */
export function threadDims(d: number, pitch: number) {
  const H = (pitch * Math.sqrt(3)) / 2;
  const h = (5 / 8) * H; // = 0.5413·P
  return { H, h, d2: d - 0.6495 * pitch, d1: d - 1.0825 * pitch };
}

/** La designación cuyo mayor cae más cerca de un diámetro medido (auto-detección
 *  como en Fusion: seleccionas la cara cilíndrica y propone la rosca). */
export function nearestThread(diameterMm: number): ThreadSpec {
  let best = METRIC_COARSE[0];
  for (const s of METRIC_COARSE) {
    if (Math.abs(s.d - diameterMm) < Math.abs(best.d - diameterMm)) best = s;
  }
  return best;
}

// Perfil de CORTE (V a 60°) en el marco del barrido de sweepProfileAlong, donde
// (para una hélice que arranca en (R,0,0)) el eje 2D +y es RADIAL hacia afuera y
// +x es AXIAL. La V apunta a −h (llega al menor); la base sobresale `eps` del
// mayor para romper la superficie con un corte limpio.
function cutProfile(pitch: number): Pt2[] {
  const H = (pitch * Math.sqrt(3)) / 2;
  const h = (5 / 8) * H; // profundidad 0.5413·P
  const eps = 0.12 * pitch; // sobre-corte hacia afuera del mayor
  const half = (h + eps) * Math.tan(Math.PI / 6); // flancos a 30° de la vertical
  return [
    { x: -half, y: eps },
    { x: 0, y: -h },
    { x: half, y: eps },
  ];
}

/** Hélice que arranca en (R,0,0) y sube `pitch` por vuelta a lo largo de +Z. */
function helixPath(radius: number, pitch: number, length: number): Array<[number, number, number]> {
  const turns = Math.max(1, length / pitch);
  const tot = turns * 2 * Math.PI;
  const n = Math.max(48, Math.ceil(turns * 28)); // ~28 seg/vuelta = hilo suave
  const pts: Array<[number, number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = (tot * i) / n;
    pts.push([radius * Math.cos(t), radius * Math.sin(t), (pitch * t) / (2 * Math.PI)]);
  }
  return pts;
}

/**
 * Barra ROSCADA externa = cilindro Ø MAYOR menos un surco helicoidal en V (60°)
 * cortado del cilindro → CRESTAS AFILADAS de rosca real (no la dona redonda).
 * En régimen COARSE (Ø≥12, paso≥3) el MakePipe arma la V bien; en fina cae a
 * barra lisa. length = largo roscado (mm).
 */
export function makeThreadedRod(oc: OC, d: number, pitch: number, length: number): Shape {
  const R = d / 2;
  const rod = makeCylinder(oc, R, length);
  const cylVol = volume(oc, rod);
  // 1) surco en V afilado (mejor pinta): MakePipeShell (Frenet) y si no, MakePipe.
  //    Sólo vale si el corte SÍ quitó material (a veces arma pero no interseca).
  for (const sweep of [sweepProfilePipeShell, sweepProfileAlong] as const) {
    try {
      const cutter = sweep(oc, { kind: 'polygon', pts: cutProfile(pitch) }, helixPath(R, pitch, length));
      const t = cut(oc, rod, cutter);
      if (volume(oc, t) < cylVol * 0.985) return t;   // hilo real
    } catch { /* siguiente método */ }
  }
  // 2) fallback ROBUSTO: cresta helicoidal redondeada unida al núcleo Ø menor.
  //    Menos afilada, pero SIEMPRE arma (perfil círculo = invariante a la orientación).
  try {
    const { d1 } = threadDims(d, pitch);
    const wireR = pitch * 0.42;
    const core = makeCylinder(oc, d1 / 2 + 0.02, length);
    const coil = sweepProfileAlong(oc, { kind: 'circle', center: { x: 0, y: 0 }, radius: wireR }, helixPath(R - wireR, pitch, length));
    const f = fuse(oc, core, coil);
    if (volume(oc, f) < cylVol * 0.99) return f;
  } catch { /* último recurso */ }
  return rod;   // barra lisa (nunca rompe la UI)
}

/**
 * Rosca INTERNA en un barreno: corta el surco helicoidal en la pared del piloto.
 * pilotHole = sólido ya barrenado; el corte va del menor (piloto) hacia el mayor.
 * Para una hembra, la V apunta radial-AFUERA → se invierte el signo del perfil.
 */
export function makeInternalThreadCutter(oc: OC, d: number, pitch: number, length: number): Shape {
  const R = d / 2;
  const prof = cutProfile(pitch).map((p) => ({ x: p.x, y: -p.y })); // V hacia afuera
  return sweepProfileAlong(oc, { kind: 'polygon', pts: prof }, helixPath(R - threadDims(d, pitch).h, pitch, length));
}
