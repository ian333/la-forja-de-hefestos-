/**
 * ⚒️ La Forja — Tornillería: tablas dimensionales DIN / ISO (dato REAL)
 * =====================================================================
 * Catálogo "Weston" estilo McMaster→SolidWorks: cada pieza es geometría
 * paramétrica EXACTA derivada de su norma, no una foto. Estas tablas son
 * la fuente de verdad. Todo en MILÍMETROS.
 *
 * Normas usadas (rosca métrica gruesa ISO 261/262):
 *   - Tornillo cabeza hexagonal ........ DIN 933 / ISO 4017
 *   - Tornillo Allen (socket cap) ...... DIN 912 / ISO 4762
 *   - Tuerca hexagonal ................. DIN 934 / ISO 4032
 *   - Rondana plana .................... DIN 125-A / ISO 7089
 *   - Rondana de presión (grower) ...... DIN 127-B
 *
 * Donde DIN 933 (viejo) y ISO 4017 difieren en el ancho de llave (s) para
 * M10/M12, usamos ISO 4017 (s=17, s=19) por ser el estándar vigente. Se
 * anota en cada caso. NO inventar valores: si una medida no la tenemos con
 * confianza, no se incluye (ver SPRING_WASHER, que llega a M16).
 */

export type MetricSize =
  | 'M3' | 'M4' | 'M5' | 'M6' | 'M8' | 'M10' | 'M12' | 'M16' | 'M20' | 'M24';

/** Orden canónico de medidas (de menor a mayor). */
export const SIZES: MetricSize[] = [
  'M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16', 'M20', 'M24',
];

// ─────────────────────────────────────────────────────────────────────
// Rosca métrica gruesa — diámetro nominal mayor (d) y paso (mm)
// ─────────────────────────────────────────────────────────────────────
export interface Thread {
  /** Diámetro nominal mayor (mm) — el "M". */
  d: number;
  /** Paso de la rosca gruesa (mm). */
  pitch: number;
}

export const THREAD: Record<MetricSize, Thread> = {
  M3:  { d: 3,  pitch: 0.5 },
  M4:  { d: 4,  pitch: 0.7 },
  M5:  { d: 5,  pitch: 0.8 },
  M6:  { d: 6,  pitch: 1.0 },
  M8:  { d: 8,  pitch: 1.25 },
  M10: { d: 10, pitch: 1.5 },
  M12: { d: 12, pitch: 1.75 },
  M16: { d: 16, pitch: 2.0 },
  M20: { d: 20, pitch: 2.5 },
  M24: { d: 24, pitch: 3.0 },
};

// ─────────────────────────────────────────────────────────────────────
// Cabeza hexagonal — DIN 933 / ISO 4017
//   s = ancho entre caras (llave), k = altura de cabeza  (mm)
// ─────────────────────────────────────────────────────────────────────
export interface HexHead {
  /** Ancho entre caras / llave (mm). */
  s: number;
  /** Altura de la cabeza (mm). */
  k: number;
}

export const HEX_HEAD: Record<MetricSize, HexHead> = {
  M3:  { s: 5.5, k: 2.0 },
  M4:  { s: 7,   k: 2.8 },
  M5:  { s: 8,   k: 3.5 },
  M6:  { s: 10,  k: 4.0 },
  M8:  { s: 13,  k: 5.3 },
  M10: { s: 17,  k: 6.4 },  // ISO 4017 (DIN 933 viejo: s=16)
  M12: { s: 19,  k: 7.5 },  // ISO 4017 (DIN 933 viejo: s=18)
  M16: { s: 24,  k: 10.0 },
  M20: { s: 30,  k: 12.5 },
  M24: { s: 36,  k: 15.0 },
};

// ─────────────────────────────────────────────────────────────────────
// Tornillo Allen / socket cap — DIN 912 / ISO 4762
//   dk = Ø cabeza, k = altura cabeza, sw = entre-caras del hexágono interior
// ─────────────────────────────────────────────────────────────────────
export interface SocketCap {
  /** Diámetro de la cabeza cilíndrica (mm). */
  dk: number;
  /** Altura de la cabeza (≈ d) (mm). */
  k: number;
  /** Ancho entre caras del hexágono interior / llave Allen (mm). */
  sw: number;
}

export const SOCKET_CAP: Record<MetricSize, SocketCap> = {
  M3:  { dk: 5.5,  k: 3.0,  sw: 2.5 },
  M4:  { dk: 7.0,  k: 4.0,  sw: 3.0 },
  M5:  { dk: 8.5,  k: 5.0,  sw: 4.0 },
  M6:  { dk: 10.0, k: 6.0,  sw: 5.0 },
  M8:  { dk: 13.0, k: 8.0,  sw: 6.0 },
  M10: { dk: 16.0, k: 10.0, sw: 8.0 },
  M12: { dk: 18.0, k: 12.0, sw: 10.0 },
  M16: { dk: 24.0, k: 16.0, sw: 14.0 },
  M20: { dk: 30.0, k: 20.0, sw: 17.0 },
  M24: { dk: 36.0, k: 24.0, sw: 19.0 },
};

// ─────────────────────────────────────────────────────────────────────
// Tuerca hexagonal — DIN 934 / ISO 4032
//   s = ancho entre caras, m = altura/espesor  (mm)
// ─────────────────────────────────────────────────────────────────────
export interface HexNut {
  /** Ancho entre caras / llave (mm). */
  s: number;
  /** Altura (espesor) de la tuerca (mm). */
  m: number;
}

export const HEX_NUT: Record<MetricSize, HexNut> = {
  M3:  { s: 5.5, m: 2.4 },
  M4:  { s: 7,   m: 3.2 },
  M5:  { s: 8,   m: 4.7 },
  M6:  { s: 10,  m: 5.2 },
  M8:  { s: 13,  m: 6.8 },
  M10: { s: 17,  m: 8.4 },
  M12: { s: 19,  m: 10.8 },
  M16: { s: 24,  m: 14.8 },
  M20: { s: 30,  m: 18.0 },
  M24: { s: 36,  m: 21.5 },
};

// ─────────────────────────────────────────────────────────────────────
// Rondana plana — DIN 125-A / ISO 7089
//   d1 = Ø interior, d2 = Ø exterior, h = espesor  (mm)
// ─────────────────────────────────────────────────────────────────────
export interface Washer {
  /** Diámetro interior / barreno (mm). */
  d1: number;
  /** Diámetro exterior (mm). */
  d2: number;
  /** Espesor (mm). */
  h: number;
}

export const FLAT_WASHER: Record<MetricSize, Washer> = {
  M3:  { d1: 3.2,  d2: 7,   h: 0.5 },
  M4:  { d1: 4.3,  d2: 9,   h: 0.8 },
  M5:  { d1: 5.3,  d2: 10,  h: 1.0 },
  M6:  { d1: 6.4,  d2: 12,  h: 1.6 },
  M8:  { d1: 8.4,  d2: 16,  h: 1.6 },
  M10: { d1: 10.5, d2: 20,  h: 2.0 },
  M12: { d1: 13,   d2: 24,  h: 2.5 },
  M16: { d1: 17,   d2: 30,  h: 3.0 },
  M20: { d1: 21,   d2: 37,  h: 3.0 },
  M24: { d1: 25,   d2: 44,  h: 4.0 },
};

// ─────────────────────────────────────────────────────────────────────
// Rondana de presión (grower) — DIN 127-B
//   d1 = Ø interior, d2 = Ø exterior, s = sección/espesor  (mm)
// Solo M3..M16 con confianza dimensional. El "split" helicoidal se modela
// como anillo plano por ahora (geometría simplificada, dato dimensional real).
// ─────────────────────────────────────────────────────────────────────
export interface SpringWasher {
  d1: number;
  d2: number;
  /** Sección cuadrada nominal / espesor (mm). */
  s: number;
}

export const SPRING_WASHER: Partial<Record<MetricSize, SpringWasher>> = {
  M3:  { d1: 3.1,  d2: 6.2,  s: 0.8 },
  M4:  { d1: 4.1,  d2: 7.6,  s: 0.9 },
  M5:  { d1: 5.1,  d2: 9.2,  s: 1.2 },
  M6:  { d1: 6.1,  d2: 11.8, s: 1.6 },
  M8:  { d1: 8.2,  d2: 14.8, s: 2.0 },
  M10: { d1: 10.2, d2: 18.1, s: 2.2 },
  M12: { d1: 12.2, d2: 21.1, s: 2.5 },
  M16: { d1: 16.2, d2: 27.4, s: 3.5 },
};

// ─────────────────────────────────────────────────────────────────────
// Largos comerciales (rango por medida) — serie preferente ISO 888
// ─────────────────────────────────────────────────────────────────────
export const PREFERRED_LENGTHS: number[] = [
  6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90,
  100, 110, 120, 130, 140, 150, 160, 180, 200,
];

export interface LengthRange { min: number; max: number; }

/** Rango de largo comercial habitual por medida (mm). */
export const BOLT_LENGTHS: Record<MetricSize, LengthRange> = {
  M3:  { min: 6,  max: 30 },
  M4:  { min: 8,  max: 40 },
  M5:  { min: 8,  max: 50 },
  M6:  { min: 8,  max: 60 },
  M8:  { min: 10, max: 80 },
  M10: { min: 16, max: 100 },
  M12: { min: 20, max: 120 },
  M16: { min: 25, max: 150 },
  M20: { min: 30, max: 200 },
  M24: { min: 40, max: 200 },
};

/** Largos comerciales disponibles para una medida (intersección con la serie). */
export function availableLengths(size: MetricSize): number[] {
  const { min, max } = BOLT_LENGTHS[size];
  return PREFERRED_LENGTHS.filter((l) => l >= min && l <= max);
}

// ─────────────────────────────────────────────────────────────────────
// Geometría auxiliar
// ─────────────────────────────────────────────────────────────────────
/**
 * Vértices de un hexágono regular dado su ancho ENTRE CARAS `s` (mm).
 * Hexágono regular: apotema a = s/2, circunradio R = a/cos(30°) = s/√3.
 * Devuelve 6 puntos [x,y] en sentido antihorario.
 */
export function hexagonVerts(acrossFlats: number): [number, number][] {
  const R = acrossFlats / Math.sqrt(3);
  return Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    return [R * Math.cos(a), R * Math.sin(a)] as [number, number];
  });
}

/** Circunradio (centro→vértice) de un hexágono con ancho entre caras `s`. */
export function hexCircumradius(acrossFlats: number): number {
  return acrossFlats / Math.sqrt(3);
}
