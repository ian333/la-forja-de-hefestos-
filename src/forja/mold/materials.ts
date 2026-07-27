/**
 * materials.ts — PROPIEDADES FÍSICAS de cada material (para simular la realidad).
 * ============================================================================
 * La idea (visión del user): cada componente carga su GEOMETRÍA + su MATERIAL; de
 * ahí sale cómo se DILATA con la temperatura, y sus fits con los vecinos cambian.
 * El molde corre caliente, los mecanismos se calientan por fricción → el acero
 * dilata, las holguras se comen, el aceite/grasa necesita su luz. Sin esto, un
 * diseño en frío se AGARROTA en caliente.
 *
 * CTE = coeficiente de expansión térmica LINEAL [µm/m·°C] = [×10⁻⁶ /°C].
 *   Acero del molde 12.8 (Kazmer §10, "12.8·10⁻⁶ m/m°C"). Plásticos ~5-15× más.
 * Fuentes: Kazmer *Injection Mold Design Engineering*; matweb/ASM para los aceros
 * de herramienta y el bronce (rango 20-200 °C).
 */

export interface MaterialProps {
  name: string;
  cteMicro: number;      // CTE lineal [µm/m·°C] = ×10⁻⁶/°C
  eGPa: number;          // módulo de Young [GPa]
  rhoKgM3: number;       // densidad [kg/m³]
  kind: 'acero' | 'bronce' | 'plastico';
  note: string;
}

export const MATERIALS: Record<string, MaterialProps> = {
  // ── ACEROS de herramienta / base (CTE ~11-13, muy estables) ──
  '1.2311':  { name: 'P20 (1.2311)', cteMicro: 12.8, eGPa: 205, rhoKgM3: 7850, kind: 'acero', note: 'base de cavidad — CTE del libro (Kazmer §10)' },
  'P20':     { name: 'P20 (1.2311)', cteMicro: 12.8, eGPa: 205, rhoKgM3: 7850, kind: 'acero', note: 'alias de 1.2311' },
  '1.2344':  { name: 'H13 (1.2344)', cteMicro: 11.5, eGPa: 210, rhoKgM3: 7800, kind: 'acero', note: 'templado, resinas abrasivas' },
  'H13':     { name: 'H13 (1.2344)', cteMicro: 11.5, eGPa: 210, rhoKgM3: 7800, kind: 'acero', note: 'alias de 1.2344' },
  '1.1730':  { name: '1.1730 (C45)', cteMicro: 11.1, eGPa: 205, rhoKgM3: 7850, kind: 'acero', note: 'placas de sujeción/base' },
  '1.2510':  { name: '1.2510 (O1)', cteMicro: 12.5, eGPa: 205, rhoKgM3: 7800, kind: 'acero', note: 'postes guía rectificados' },
  '1.2842':  { name: '1.2842 (O2)', cteMicro: 12.0, eGPa: 205, rhoKgM3: 7800, kind: 'acero', note: 'pines eyectores nitrurados' },
  'acero':   { name: 'acero molde', cteMicro: 12.8, eGPa: 205, rhoKgM3: 7850, kind: 'acero', note: 'default del libro' },
  // ── BRONCE (bujes guía): dilata más que el acero → el fit poste↔buje cambia ──
  'bronce':  { name: 'bronce SAE 660', cteMicro: 18.0, eGPa: 100, rhoKgM3: 8800, kind: 'bronce', note: 'bujes — CTE 40% mayor que el acero' },
  // ── PLÁSTICOS (CTE 5-15× el acero → contracción y fit al enfriar) ──
  'ABS':     { name: 'ABS', cteMicro: 88,  eGPa: 2.28, rhoKgM3: 1050, kind: 'plastico', note: 'CTE de ejection.ts (8.83e-5)' },
  'PP':      { name: 'PP', cteMicro: 150, eGPa: 1.5,  rhoKgM3: 905,  kind: 'plastico', note: 'flanera — dilata MUCHO (semicristalino)' },
  'PS':      { name: 'PS', cteMicro: 70,  eGPa: 3.2,  rhoKgM3: 1040, kind: 'plastico', note: 'vaso desechable rígido' },
  'PC':      { name: 'PC', cteMicro: 65,  eGPa: 2.4,  rhoKgM3: 1200, kind: 'plastico', note: 'óptico' },
  'POM':     { name: 'POM', cteMicro: 110, eGPa: 3.1,  rhoKgM3: 1410, kind: 'plastico', note: 'engranes' },
  'PA':      { name: 'PA (nylon)', cteMicro: 80, eGPa: 2.0, rhoKgM3: 1140, kind: 'plastico', note: '' },
  'PE':      { name: 'PE', cteMicro: 200, eGPa: 1.0, rhoKgM3: 950, kind: 'plastico', note: 'el que más dilata' },
};

/** Busca el material por clave o alias; default = acero del molde. */
export function material(key?: string): MaterialProps {
  if (!key) return MATERIALS['acero'];
  return MATERIALS[key] ?? MATERIALS[key.toUpperCase()] ?? MATERIALS['acero'];
}

/** CTE [×10⁻⁶/°C] de un material. */
export const cteOf = (key?: string): number => material(key).cteMicro;

/** DILATACIÓN LINEAL: L a temperatura T = L₀·(1 + CTE·ΔT). ΔT en °C desde 20°C ref. */
export function expandMm(dimMm: number, materialKey: string | undefined, deltaTC: number): number {
  return dimMm * (1 + cteOf(materialKey) * 1e-6 * deltaTC);
}

/** Cambio de dimensión ΔL = L₀·CTE·ΔT [mm]. */
export function deltaLenMm(dimMm: number, materialKey: string | undefined, deltaTC: number): number {
  return dimMm * cteOf(materialKey) * 1e-6 * deltaTC;
}
