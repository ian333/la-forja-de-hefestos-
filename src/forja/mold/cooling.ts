/**
 * ANÁLISIS DE ENFRIAMIENTO — Kazmer cap 9 "Cooling System Design"
 * ================================================================
 * Fórmulas REALES del libro (ecuaciones numeradas), verificadas contra los
 * ejemplos resueltos del texto (molde familia cup/lid en ABS, p.203-206).
 * Física: conducción transitoria 1D (Eq 9.2), solución en serie (Eq 9.4).
 */

export interface CoolingMaterial {
  /** Difusividad térmica α (m²/s). ABS ≈ 8.69e-8. */
  alpha: number;
  /** Temperatura de masa fundida (°C). */
  tMelt: number;
  /** Temperatura del refrigerante / pared del molde (°C). */
  tCoolant: number;
  /** Temperatura de expulsión (HDT/DTUL, °C). ABS ≈ 96.7. */
  tEject: number;
}

/** ABS del ejemplo del libro (p.203). OJO: el TEXTO dice T_eject=96.7 pero los
 * CÁLCULOS del propio libro usan 97.6 (visible en las ecuaciones del ejemplo) —
 * con 97.6 se reproducen exactos sus 8.4/18.9/22.9 s. */
export const ABS_KAZMER: CoolingMaterial = { alpha: 8.69e-8, tMelt: 239, tCoolant: 60, tEject: 97.6 };

/**
 * Eq (9.5): tiempo mínimo teórico de enfriamiento de una PLACA de espesor h(m):
 * t_c = h²/(π²·α) · ln( 4/π · (T_melt−T_cool)/(T_eject−T_cool) )
 */
export function coolingTimePlate(hMeters: number, m: CoolingMaterial): number {
  const ratio = (m.tMelt - m.tCoolant) / (m.tEject - m.tCoolant);
  return (hMeters * hMeters) / (Math.PI * Math.PI * m.alpha) * Math.log((4 / Math.PI) * ratio);
}

/**
 * Eq (9.6): tiempo de enfriamiento de una BARRA/runner de diámetro D(m):
 * t_c = D²/(23.1·α) · ln( 1.60 · (T_melt−T_cool)/(T_eject−T_cool) )
 */
export function coolingTimeRod(dMeters: number, m: CoolingMaterial): number {
  const ratio = (m.tMelt - m.tCoolant) / (m.tEject - m.tCoolant);
  return (dMeters * dMeters) / (23.1 * m.alpha) * Math.log(1.6 * ratio);
}

/** Eq (9.8): regla de la industria t_c ≈ 2·(h[mm])² segundos. */
export function coolingTimeRuleOfThumb(hMm: number): number {
  return 2 * hMm * hMm;
}

/**
 * Eq (9.4): SIMULACIÓN del enfriamiento — temperatura en el CENTRO de la pared
 * en función del tiempo (serie de conducción transitoria, primeros N términos):
 * T(t) = T_cool + (T_melt−T_cool)·Σ (−1)^m/(2m+1) · exp(−π²(2m+1)²·α·t/h²) · 4/π
 * (el 4/π es el coeficiente de la serie de Fourier del perfil inicial uniforme)
 */
export function centerlineTemperature(hMeters: number, tSeconds: number, m: CoolingMaterial, terms = 6): number {
  let s = 0;
  for (let k = 0; k < terms; k++) {
    const n = 2 * k + 1;
    s += ((k % 2 === 0 ? 1 : -1) / n) * Math.exp((-Math.PI * Math.PI * n * n * m.alpha * tSeconds) / (hMeters * hMeters));
  }
  return m.tCoolant + (m.tMelt - m.tCoolant) * (4 / Math.PI) * s;
}

/** Curva completa T_centro(t) — la "simulación de enfriamiento" 1D para graficar. */
export function coolingCurve(hMeters: number, m: CoolingMaterial, tMax: number, steps = 100): Array<{ t: number; T: number }> {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (tMax * i) / steps;
    return { t, T: i === 0 ? m.tMelt : centerlineTemperature(hMeters, t, m) };
  });
}

/**
 * Eq (9.10): calor total a remover por ciclo: Q = m·Cp·(T_melt − T_eject)  [J]
 * mKg = masa del disparo (piezas + coladas frías), cp en J/(kg·°C).
 */
export function heatToRemove(mKg: number, cpJPerKgC: number, m: CoolingMaterial): number {
  return mKg * cpJPerKgC * (m.tMelt - m.tEject);
}

/**
 * Reporte de enfriamiento de un molde: recorre las SECCIONES de la pieza
 * (espesores de pared) + runners, y devuelve el tiempo que DOMINA el ciclo.
 */
export function coolingReport(
  sections: Array<{ name: string; kind: 'plate' | 'rod'; sizeMm: number }>,
  m: CoolingMaterial,
): { rows: Array<{ name: string; tC: number }>; governing: string; cycleCoolingS: number } {
  const rows = sections.map((s) => ({
    name: s.name,
    tC: s.kind === 'plate' ? coolingTimePlate(s.sizeMm / 1000, m) : coolingTimeRod(s.sizeMm / 1000, m),
  }));
  let gov = rows[0];
  for (const r of rows) if (r.tC > gov.tC) gov = r;
  return { rows, governing: gov.name, cycleCoolingS: gov.tC };
}
