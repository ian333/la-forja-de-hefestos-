/**
 * REDUCTOR CICLOIDAL generativo (engrane de lóbulos) — el corazón de un brazo
 * barato impreso: un disco de N lóbulos rueda dentro de un anillo de N+1 pernos
 * movido por un excéntrico; por cada vuelta del motor, el disco gira 1/N hacia
 * atrás ⇒ reducción N:1, IMPRESA. "Solo se le conecta el motor."
 *
 * Geometría REAL: el perfil del disco es la curva equidistante (a Rr) de la
 * hipocicloide que define el rodado disco↔pernos. Puro (sin WASM) → testeable.
 *
 * Parámetros: lobes (lóbulos del disco), R (radio del círculo de pernos),
 * Rr (radio del perno/rodillo), E (excentricidad). pernos = lobes+1; ratio=lobes.
 */
export interface Pt2 { x: number; y: number; }
export interface CycloidalParams {
  lobes: number;     // nº de lóbulos del disco (= reducción)
  R: number;         // radio del círculo de pernos (mm)
  Rr: number;        // radio del perno/rodillo (mm)
  E: number;         // excentricidad (mm)
  segments?: number; // muestreo del perfil
}
export interface CycloidalDisc {
  profile: Pt2[];       // perfil del disco (polígono CCW, no cerrado al final)
  lobes: number;
  pins: number;         // pernos del anillo = lobes+1
  ratio: number;        // reducción N:1 (= lobes)
  pinCircleR: number;   // R
  pinR: number;         // Rr
  maxR: number; minR: number; // radios extremos del perfil
  eccentricity: number;
  /** ¿la excentricidad es válida (lóbulos no se traslapan)? E < R/(2·pins). */
  valid: boolean;
}

/** Perfil del disco cicloidal. N = pernos = lobes+1.
 *  ψ(t) = atan2( sin((1−N)t), R/(E·N) − cos((1−N)t) )
 *  x = R·cos t − Rr·cos(t+ψ) − E·cos(N·t)
 *  y = −R·sin t + Rr·sin(t+ψ) + E·sin(N·t)
 */
export function cycloidalDisc(p: CycloidalParams): CycloidalDisc {
  const { lobes, R, Rr, E } = p;
  const N = lobes + 1;                 // pernos
  const segs = Math.max(120, p.segments ?? 360);
  const profile: Pt2[] = [];
  let maxR = -Infinity, minR = Infinity;
  for (let i = 0; i < segs; i++) {     // t en [0, 2π) — NO duplicar el cierre
    const t = (2 * Math.PI * i) / segs;
    const psi = Math.atan2(Math.sin((1 - N) * t), (R / (E * N)) - Math.cos((1 - N) * t));
    const x = R * Math.cos(t) - Rr * Math.cos(t + psi) - E * Math.cos(N * t);
    const y = -R * Math.sin(t) + Rr * Math.sin(t + psi) + E * Math.sin(N * t);
    profile.push({ x, y });
    const r = Math.hypot(x, y);
    maxR = Math.max(maxR, r); minR = Math.min(minR, r);
  }
  // CCW garantizado (área firmada > 0); si salió CW, invertir.
  if (signedArea(profile) < 0) profile.reverse();
  return {
    profile, lobes, pins: N, ratio: lobes, pinCircleR: R, pinR: Rr,
    maxR, minR, eccentricity: E, valid: E < R / (2 * N),
  };
}

/** Posiciones de los N pernos del anillo (círculo de radio R). */
export function pinPositions(R: number, pins: number): Pt2[] {
  return Array.from({ length: pins }, (_, i) => {
    const a = (2 * Math.PI * i) / pins;
    return { x: R * Math.cos(a), y: R * Math.sin(a) };
  });
}

/** Anillo de M barrenos de salida en el disco, radio Rout. Cada barreno es
 *  MAYOR que el perno de salida por 2·E (acomoda el bamboleo del excéntrico):
 *  Dhole = Dpin_salida + 2·E. Devuelve centros + diámetro del barreno. */
export function outputHoles(Rout: number, count: number, outPinD: number, E: number): { centers: Pt2[]; holeD: number } {
  const centers = Array.from({ length: count }, (_, i) => {
    const a = (2 * Math.PI * i) / count;
    return { x: Rout * Math.cos(a), y: Rout * Math.sin(a) };
  });
  return { centers, holeD: outPinD + 2 * E };
}

/** Cuenta lóbulos = máximos locales del radio del perfil (debe ser = lobes). */
export function countLobes(profile: Pt2[]): number {
  const r = profile.map((p) => Math.hypot(p.x, p.y));
  const n = r.length; let count = 0;
  for (let i = 0; i < n; i++) {
    const a = r[(i - 1 + n) % n], b = r[i], c = r[(i + 1) % n];
    if (b > a && b >= c) count++;
  }
  return count;
}

function signedArea(poly: Pt2[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}
