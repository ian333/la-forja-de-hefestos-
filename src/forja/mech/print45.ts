/**
 * PRINT45 — explorar imprimir el gimbal a 45°: ¿una sola pieza? ¿perdemos precisión?
 * La física del stair-stepping (escalonado de capas) + el auto-soporte + el tamaño.
 * Puro, testeable. mm, grados.
 */

// ── Escalonado: la rugosidad de una cara depende de su ÁNGULO con la cama ──
/** Cusp (desviación pico-valle perpendicular a la cara) de una cara a `angFromHoriz` grados
 *  de la horizontal, con capa h.  Vertical(90°)→0 (lisa). Horizontal-inclinada→peor. */
export function cuspHeight(angFromHorizDeg: number, layerH: number): number {
  const a = (angFromHorizDeg * Math.PI) / 180;
  return +(layerH * Math.cos(a)).toFixed(4);   // 90°→0, 45°→0.707h, →0° crece
}
/** Rugosidad del LÓBULO según cuánto inclines el gimbal del vertical. Vertical(tilt 0)→pared
 *  del lóbulo vertical→lisa. tilt 45°→0.707h. tilt 90°(acostado)→h (lo peor). */
export function lobeRoughnessAtTilt(printTiltDeg: number, layerH: number): number {
  return +(layerH * Math.sin((printTiltDeg * Math.PI) / 180)).toFixed(4);
}
/** Precisión relativa: rugosidad del lóbulo / holgura de malla (qué fracción del gap). */
export function precisionFraction(roughness: number, meshGap: number): number {
  return +(roughness / meshGap).toFixed(3);
}

// ── Auto-soporte: ¿a qué inclinación AMBOS cicloidales imprimen sin voladizo malo? ──
/** La PEOR cara (su ángulo desde la horizontal) del gimbal a una inclinación T. cic.1 (eje a T
 *  del vertical) tiene su peor cara a (90−T); cic.2 (eje a 90−T) la tiene a T. El peor de ambos
 *  = min(90−T, T). <45° = voladizo que falla. El balance (ambos iguales) es a T=45 → 45°. */
export function worstOverhangDeg(printTiltDeg: number): number {
  return +Math.min(90 - printTiltDeg, printTiltDeg).toFixed(1);
}
export function selfSupports(printTiltDeg: number, critDeg = 45): boolean {
  return worstOverhangDeg(printTiltDeg) >= critDeg - 0.5;  // ambas caras ≥ ~45° (solo cerca de 45°)
}

// ── Comparar las 3 estrategias ──
export interface PrintStrategy { name: string; pieces: number; lobeRoughness_mm: number; precisionPct: number; bothSelfSupport: boolean; note: string; }
export function compareStrategies(layerH = 0.2, meshGap = 0.7): PrintStrategy[] {
  const upright = lobeRoughnessAtTilt(0, layerH);     // cic.1 vertical
  const uprightC2 = lobeRoughnessAtTilt(90, layerH);  // cic.2 acostado (lo peor)
  const at45 = lobeRoughnessAtTilt(45, layerH);
  return [
    { name: '2 módulos vertical + snap', pieces: 2, lobeRoughness_mm: upright, precisionPct: +(precisionFraction(upright, meshGap) * 100).toFixed(1),
      bothSelfSupport: true, note: `cada módulo vertical → lóbulo LISO (${upright}mm); pero 2 piezas + ensamble` },
    { name: '1 pieza a 45°', pieces: 1, lobeRoughness_mm: at45, precisionPct: +(precisionFraction(at45, meshGap) * 100).toFixed(1),
      bothSelfSupport: selfSupports(45), note: `1 sola pieza; AMBOS lóbulos a ${at45}mm (${(precisionFraction(at45, meshGap) * 100).toFixed(0)}% del gap) — moderado` },
    { name: '1 pieza vertical (cic.2 acostado)', pieces: 1, lobeRoughness_mm: uprightC2, precisionPct: +(precisionFraction(uprightC2, meshGap) * 100).toFixed(1),
      bothSelfSupport: false, note: `cic.2 acostado → lóbulo ${uprightC2}mm + voladizos 90° → FALLA sin soportes` },
  ];
}

// ── El tamaño: a 45° el gimbal se compacta (los 2 cicloidales se anidan en diagonal) ──
/** Estimación: la altura del gimbal vertical (poste largo) vs anidado a 45°. */
export function envelopeReduction(p: { cyc1H: number; postH: number; cyc2H: number }): { upright_mm: number; at45_mm: number; reductionPct: number } {
  const upright = p.cyc1H + p.postH + p.cyc2H;
  const at45 = (p.cyc1H + p.cyc2H) * Math.cos(Math.PI / 4) + p.postH * 0.6; // anidados en diagonal
  return { upright_mm: +upright.toFixed(1), at45_mm: +at45.toFixed(1), reductionPct: +(100 * (1 - at45 / upright)).toFixed(1) };
}
