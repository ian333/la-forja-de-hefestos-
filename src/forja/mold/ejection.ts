/**
 * SISTEMA DE EXPULSIÓN — Kazmer cap 11 "Ejection System Design"
 * ==============================================================
 * Fuerza de expulsión por contracción térmica (Eq 11.7), área efectiva de
 * piezas con costillas (Eq 11.8), y DIMENSIONADO de pines: área de empuje
 * contra fatiga del acero (Eq 11.10) y perímetro contra cortante en el
 * plástico (Eq 11.12 — normalmente GOBIERNA). Ejemplos verificados: cup
 * 1,800 N y laptop bezel 4,700 N / 20 pines ⌀2.23 mm (p.267-272).
 */

export interface EjectionMaterial {
  /** Módulo elástico del plástico (Pa). ABS: 2.28e9. */
  E: number;
  /** Coef. de expansión térmica CTE (1/°C). ABS: 8.83e-5. */
  cte: number;
  /** Temperatura de solidificación (°C). ABS: 132. */
  tSolid: number;
  /** Temperatura de expulsión (°C). ABS: 97. */
  tEject: number;
  /** Fricción pieza-core. Acero liso: 0.5. */
  mu: number;
  /** Esfuerzo de cedencia del plástico (Pa). ABS: 44e6. */
  sigmaYield: number;
}
export const ABS_EJECT: EjectionMaterial = { E: 2.28e9, cte: 8.83e-5, tSolid: 132, tEject: 97, mu: 0.5, sigmaYield: 44e6 };

/** Eq (11.7): F_eject = μ·cos(draft)·E·CTE·(T_solid−T_eject)·A_eff  (N). */
export function ejectionForce(m: EjectionMaterial, draftDeg: number, aEffM2: number): number {
  return m.mu * Math.cos((draftDeg * Math.PI) / 180) * m.E * m.cte * (m.tSolid - m.tEject) * aEffM2;
}

/** Eq (11.8): área efectiva de pieza con paredes y costillas (m²). */
export function effectiveArea(o: {
  h: number; L: number; W: number;
  nWalls?: number; hWall?: number; nRibs?: number; tRib?: number; hRib?: number;
}): number {
  return o.h * (2 * o.L + 2 * o.W)
    + (o.nWalls ?? 0) * o.h * (o.hWall ?? 0)
    + (o.nRibs ?? 0) * (o.tRib ?? 0) * (o.hRib ?? 0);
}

/**
 * Dimensionado de pines (Eq 11.10 + 11.12): devuelve el diámetro mínimo por
 * COMPRESIÓN (fatiga del acero) y por CORTANTE en el plástico (gobierna), para
 * `nPins` pines iguales.
 */
export function ejectorPinSizing(
  m: EjectionMaterial, fEjectN: number, nPins: number, wallM: number, sigmaFatiguePa = 450e6,
): { dMinCompressionMm: number; dMinShearMm: number; dMinMm: number; pushAreaMm2: number; perimeterM: number } {
  const aReq = fEjectN / sigmaFatiguePa;                          // Eq 11.10 (m²)
  const dComp = Math.sqrt((4 * aReq) / nPins / Math.PI);          // por pin
  const perim = (2 * fEjectN) / (m.sigmaYield * wallM);           // Eq 11.12 (m)
  const dShear = perim / nPins / Math.PI;
  return {
    dMinCompressionMm: dComp * 1000, dMinShearMm: dShear * 1000,
    dMinMm: Math.max(dComp, dShear) * 1000,
    pushAreaMm2: aReq * 1e6, perimeterM: perim,
  };
}
