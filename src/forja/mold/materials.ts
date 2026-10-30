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

/* ═══════════════════════════════════════════════════════════════════════════════
 * LA FICHA DE TU RESINA (orden 2026-10-29-g · LOS DATOS DE TU PLANTA)
 * ═══════════════════════════════════════════════════════════════════════════════
 * Hasta hoy la pieza decía «ABS · PP · PS · PC · POM · PA6» en el intake y el motor tenía DOS plásticos: todo lo que no
 * fuera ABS se volvía PP (`plastic === 'ABS' ? 'ABS' : 'PP'`, moldmachine.ts) y PS o PA6 tronaban el costo por pieza
 * (`PLASTICS[p.plastic]` no los tenía). Hallazgo 5 del debate: «un solo plástico disfrazado de seis».
 *
 * La regla: una resina se CALCULA solo si trae su ficha COMPLETA del libro — Kazmer, Apéndice A «Plastic Material
 * Properties» (p.390-393, «Source: Moldflow (Waltham, MA). Used with permission»). Son 16 resinas; cada número de abajo es
 * el de la tabla, sacado del PDF con un script (pdftotext → columnas) y no tecleado: p.390/391 traen costo, módulo,
 * cedencia, DTUL, no-flujo, rangos de fundido y de refrigerante, densidades, cp, k, α, CTE y contracción; p.392/393 la
 * contracción paralela/perpendicular, γ̇ máx, la power-law, Cross-WLF y los 13 coeficientes de Tait. Una resina que no
 * está aquí NO se convierte en otra: `fichaResina` devuelve null y el motor dice «sin ficha: no se calcula».
 * OJO costo: «Approximate cost ($/kg)» es USD del libro, no tu precio de compra: no se convierte a pesos.
 */
export interface FichaResina {
  clave: string; nombre: string; comercial: string; proveedor: string; paginas: string;
  costoUSDkg: number; moduloMPa: number; cedenciaMPa: number; deformCedenciaPct: number; dtulC: number; noFlujoC: number;
  fundidoMinC: number; fundidoMaxC: number; refrigeranteMinC: number; refrigeranteMaxC: number;
  rho20KgM3: number; rhoFundidoKgM3: number; cpJkgC: number; kWmC: number; alphaM2s: number; cte1C: number;
  contraccionMinPct: number; contraccionMaxPct: number; contraccionParalelaPct: number; contraccionPerpendicularPct: number;
  corteMaxS: number; fundidoMedioC: number; powerK: number; powerN: number; eta0PaS: number;
  wlf: { n: number; tauStarPa: number; D1: number; D2K: number; D3KPerPa: number; A1: number; A2K: number };
  tait: { b1m: number; b2m: number; b3m: number; b4m: number; b1s: number; b2s: number; b3s: number; b4s: number;
    b5: number; b6: number; b7: number; b8: number; b9: number };
}

/** Kazmer Apéndice A (p.390-393), LITERAL — las 16 columnas de la tabla. La clave es la que viaja en `spec.plastic`. */
export const RESINAS_KAZMER: Record<string, FichaResina> = {
  'ABS': { clave: 'ABS', nombre: 'ABS', comercial: 'Cycolac MG47', proveedor: 'GE Plastics', paginas: 'p.390 y p.392',
    costoUSDkg: 2.16, moduloMPa: 2280, cedenciaMPa: 44, deformCedenciaPct: 2, dtulC: 96.7, noFlujoC: 132,
    fundidoMinC: 218, fundidoMaxC: 260, refrigeranteMinC: 49, refrigeranteMaxC: 71,
    rho20KgM3: 1044, rhoFundidoKgM3: 930, cpJkgC: 2340, kWmC: 0.19, alphaM2s: 8.73e-8, cte1C: 8.82e-5,
    contraccionMinPct: 0.4, contraccionMaxPct: 0.8, contraccionParalelaPct: 0.6, contraccionPerpendicularPct: 0.6,
    corteMaxS: 50000, fundidoMedioC: 239, powerK: 17100, powerN: 0.348, eta0PaS: 2210,
    wlf: { n: 0.247, tauStarPa: 99700, D1: 1.93e13, D2K: 373.15, D3KPerPa: 0, A1: 31.4, A2K: 51.6 },
    tait: { b1m: 0.000983, b2m: 6.51e-7, b3m: 1.35e8, b4m: 0.00438, b1s: 0.000983, b2s: 3.47e-7, b3s: 1.7e8, b4s: 0.00421,
      b5: 370.6, b6: 2.3e-7, b7: 0, b8: 0, b9: 0 } },
  'POM': { clave: 'POM', nombre: 'Acetal (POM)', comercial: 'Delrin 500', proveedor: 'DuPont', paginas: 'p.390 y p.392',
    costoUSDkg: 2.65, moduloMPa: 2800, cedenciaMPa: 50, deformCedenciaPct: 12, dtulC: 160, noFlujoC: 175,
    fundidoMinC: 180, fundidoMaxC: 230, refrigeranteMinC: 50, refrigeranteMaxC: 105,
    rho20KgM3: 1435, rhoFundidoKgM3: 1149, cpJkgC: 2020, kWmC: 0.23, alphaM2s: 9.91e-8, cte1C: 0.0001,
    contraccionMinPct: 1.4, contraccionMaxPct: 2.6, contraccionParalelaPct: 2.1, contraccionPerpendicularPct: 1.5,
    corteMaxS: 40000, fundidoMedioC: 205, powerK: 6240, powerN: 0.538, eta0PaS: 745,
    wlf: { n: 0.122, tauStarPa: 443000, D1: 1.2e11, D2K: 263.15, D3KPerPa: 0, A1: 24.1, A2K: 51.6 },
    tait: { b1m: 0.000849, b2m: 4.21e-7, b3m: 1.33e8, b4m: 0.00337, b1s: 0.000733, b2s: 2.41e-7, b3s: 3.59e8, b4s: 0.00275,
      b5: 448.15, b6: 2e-8, b7: 0.000116, b8: 0.124, b9: 4.65e-9 } },
  'PA6': { clave: 'PA6', nombre: 'PA6 (nylon 6)', comercial: 'Capron 8202', proveedor: 'BASF', paginas: 'p.390 y p.392',
    costoUSDkg: 4.02, moduloMPa: 970, cedenciaMPa: 36, deformCedenciaPct: 16, dtulC: 160, noFlujoC: 216,
    fundidoMinC: 230, fundidoMaxC: 300, refrigeranteMinC: 70, refrigeranteMaxC: 110,
    rho20KgM3: 1153, rhoFundidoKgM3: 971, cpJkgC: 2630, kWmC: 0.28, alphaM2s: 1.1e-7, cte1C: 7.8e-5,
    contraccionMinPct: 0.2, contraccionMaxPct: 1.7, contraccionParalelaPct: 0.9, contraccionPerpendicularPct: 0.9,
    corteMaxS: 100000, fundidoMedioC: 265, powerK: 14900, powerN: 0.314, eta0PaS: 134,
    wlf: { n: 0.191, tauStarPa: 254000, D1: 1.43e8, D2K: 323.15, D3KPerPa: 0, A1: 18.025, A2K: 51.6 },
    tait: { b1m: 0.00101, b2m: 5.05e-7, b3m: 1.78e8, b4m: 0.00509, b1s: 0.000941, b2s: 3.83e-7, b3s: 2.47e8, b4s: 0.00367,
      b5: 489.16, b6: 6.05e-8, b7: 6.5e-5, b8: 0.052, b9: 4.73e-9 } },
  'PA66': { clave: 'PA66', nombre: 'PA66 (nylon 6/6)', comercial: 'Leona 1402', proveedor: 'Asahi', paginas: 'p.390 y p.392',
    costoUSDkg: 4.3, moduloMPa: 1200, cedenciaMPa: 67, deformCedenciaPct: 35, dtulC: 240, noFlujoC: 263,
    fundidoMinC: 260, fundidoMaxC: 300, refrigeranteMinC: 40, refrigeranteMaxC: 80,
    rho20KgM3: 1151, rhoFundidoKgM3: 964, cpJkgC: 1670, kWmC: 0.19, alphaM2s: 1.18e-7, cte1C: 8e-5,
    contraccionMinPct: 0.8, contraccionMaxPct: 1.6, contraccionParalelaPct: 0.9, contraccionPerpendicularPct: 0.9,
    corteMaxS: 60000, fundidoMedioC: 280, powerK: 1510, powerN: 0.68, eta0PaS: 25600,
    wlf: { n: 0.679, tauStarPa: 3.81, D1: 7.16e19, D2K: 323.15, D3KPerPa: 0, A1: 44.24, A2K: 51.6 },
    tait: { b1m: 0.00103, b2m: 6.94e-7, b3m: 1.37e8, b4m: 0.00351, b1s: 0.00098, b2s: 4.66e-7, b3s: 1.68e8, b4s: 0.00316,
      b5: 535.66, b6: 6.24e-8, b7: 4.57e-5, b8: 0.113, b9: 7.96e-9 } },
  'PA66-GF33': { clave: 'PA66-GF33', nombre: 'PA66 + 33 % fibra de vidrio', comercial: 'Leona 14G33', proveedor: 'Asahi', paginas: 'p.390 y p.392',
    costoUSDkg: 5.92, moduloMPa: 4400, cedenciaMPa: 132, deformCedenciaPct: 3, dtulC: 250, noFlujoC: 254,
    fundidoMinC: 275, fundidoMaxC: 300, refrigeranteMinC: 60, refrigeranteMaxC: 120,
    rho20KgM3: 1426, rhoFundidoKgM3: 1210, cpJkgC: 3100, kWmC: 0.31, alphaM2s: 8.26e-8, cte1C: 5.6e-5,
    contraccionMinPct: 0.3, contraccionMaxPct: 1, contraccionParalelaPct: 0.4, contraccionPerpendicularPct: 0.9,
    corteMaxS: 60000, fundidoMedioC: 288, powerK: 10800, powerN: 0.434, eta0PaS: 807,
    wlf: { n: 0.4, tauStarPa: 119000, D1: 1.08e18, D2K: 323.15, D3KPerPa: 0, A1: 43.215, A2K: 51.6 },
    tait: { b1m: 0.000812, b2m: 4.14e-7, b3m: 1.65e8, b4m: 0.00377, b1s: 0.000758, b2s: 2.49e-7, b3s: 2.98e8, b4s: 0.00257,
      b5: 527.15, b6: 6.4e-8, b7: 5.41e-5, b8: 0.0332, b9: 4.71e-9 } },
  'PC': { clave: 'PC', nombre: 'PC (policarbonato)', comercial: 'Lexan 121', proveedor: 'GE Plastics', paginas: 'p.390 y p.392',
    costoUSDkg: 4.26, moduloMPa: 900, cedenciaMPa: 62, deformCedenciaPct: 7, dtulC: 138, noFlujoC: 143,
    fundidoMinC: 280, fundidoMaxC: 305, refrigeranteMinC: 70, refrigeranteMaxC: 95,
    rho20KgM3: 1192, rhoFundidoKgM3: 1052, cpJkgC: 1260, kWmC: 0.25, alphaM2s: 1.89e-7, cte1C: 6.8e-5,
    contraccionMinPct: 0.4, contraccionMaxPct: 0.8, contraccionParalelaPct: 0.6, contraccionPerpendicularPct: 0.6,
    corteMaxS: 40000, fundidoMedioC: 293, powerK: 447000, powerN: 0.213, eta0PaS: 94400,
    wlf: { n: 0.211, tauStarPa: 697000, D1: 5.06e12, D2K: 417.15, D3KPerPa: 0, A1: 31.41, A2K: 51.6 },
    tait: { b1m: 0.000866, b2m: 5.67e-7, b3m: 1.69e8, b4m: 0.00423, b1s: 0.000865, b2s: 2.16e-7, b3s: 2.58e8, b4s: 0.00302,
      b5: 416.23, b6: 3.34e-7, b7: 0, b8: 0, b9: 0 } },
  'PE-LD': { clave: 'PE-LD', nombre: 'PE de baja densidad', comercial: 'Lupolen 1800H', proveedor: 'Basell', paginas: 'p.391 y p.393',
    costoUSDkg: 1.99, moduloMPa: 110, cedenciaMPa: 9, deformCedenciaPct: 15, dtulC: 41, noFlujoC: 106,
    fundidoMinC: 205, fundidoMaxC: 245, refrigeranteMinC: 20, refrigeranteMaxC: 60,
    rho20KgM3: 894, rhoFundidoKgM3: 750, cpJkgC: 3180, kWmC: 0.23, alphaM2s: 9.64e-8, cte1C: 0.00023,
    contraccionMinPct: 1.4, contraccionMaxPct: 3, contraccionParalelaPct: 1.6, contraccionPerpendicularPct: 1.6,
    corteMaxS: 40000, fundidoMedioC: 225, powerK: 20600, powerN: 0.292, eta0PaS: 15500,
    wlf: { n: 0.291, tauStarPa: 23500, D1: 2.64e19, D2K: 233.15, D3KPerPa: 0, A1: 44.335, A2K: 51.6 },
    tait: { b1m: 0.00123, b2m: 8.78e-7, b3m: 1.05e8, b4m: 0.00412, b1s: 0.00117, b2s: 6.6e-7, b3s: 1.71e8, b4s: 0.00242,
      b5: 379, b6: 2.39e-7, b7: 5.44e-5, b8: 0.0737, b9: 2.28e-8 } },
  'PE-HD': { clave: 'PE-HD', nombre: 'PE de alta densidad', comercial: 'Alathon 5370', proveedor: 'Equistar', paginas: 'p.391 y p.393',
    costoUSDkg: 1.72, moduloMPa: 400, cedenciaMPa: 28, deformCedenciaPct: 7, dtulC: 72, noFlujoC: 142,
    fundidoMinC: 230, fundidoMaxC: 260, refrigeranteMinC: 18, refrigeranteMaxC: 30,
    rho20KgM3: 952, rhoFundidoKgM3: 724, cpJkgC: 2890, kWmC: 0.33, alphaM2s: 1.58e-7, cte1C: 0.00015,
    contraccionMinPct: 1.2, contraccionMaxPct: 2.6, contraccionParalelaPct: 1.6, contraccionPerpendicularPct: 1.6,
    corteMaxS: 40000, fundidoMedioC: 245, powerK: 16500, powerN: 0.378, eta0PaS: 1460,
    wlf: { n: 0.36, tauStarPa: 88500, D1: 3.75e17, D2K: 153.15, D3KPerPa: 0, A1: 38.78, A2K: 51.6 },
    tait: { b1m: 0.00127, b2m: 1.03e-6, b3m: 9.26e7, b4m: 0.00494, b1s: 0.00108, b2s: 2.08e-7, b3s: 3.32e8, b4s: 2.46e-6,
      b5: 414.5, b6: 2.39e-7, b7: 0.000187, b8: 0.0516, b9: 1.02e-8 } },
  'PET': { clave: 'PET', nombre: 'PET', comercial: 'Eastapak 9921', proveedor: 'Eastman', paginas: 'p.391 y p.393',
    costoUSDkg: 1.99, moduloMPa: 1400, cedenciaMPa: 55, deformCedenciaPct: 4, dtulC: 68, noFlujoC: 74,
    fundidoMinC: 270, fundidoMaxC: 300, refrigeranteMinC: 16, refrigeranteMaxC: 40,
    rho20KgM3: 1336, rhoFundidoKgM3: 1160, cpJkgC: 1980, kWmC: 0.23, alphaM2s: 1e-7, cte1C: 7.5e-5,
    contraccionMinPct: 0.5, contraccionMaxPct: 1, contraccionParalelaPct: 0.6, contraccionPerpendicularPct: 0.6,
    corteMaxS: 50000, fundidoMedioC: 285, powerK: 698900, powerN: 0.101, eta0PaS: 136000,
    wlf: { n: 0.1, tauStarPa: 846000, D1: 1.26e16, D2K: 351, D3KPerPa: 0, A1: 39.12, A2K: 51.6 },
    tait: { b1m: 0.000754, b2m: 5.104e-7, b3m: 2.46e8, b4m: 0.0038, b1s: 0.000753, b2s: 1e-7, b3s: 3.77e8, b4s: 0.000587,
      b5: 346.88, b6: 1.75e-7, b7: 0, b8: 0, b9: 0 } },
  'PMMA': { clave: 'PMMA', nombre: 'PMMA (acrílico)', comercial: 'Plexiglas V052', proveedor: 'Atohaas', paginas: 'p.391 y p.393',
    costoUSDkg: 2.43, moduloMPa: 2740, cedenciaMPa: 70, deformCedenciaPct: 2, dtulC: 98, noFlujoC: 215,
    fundidoMinC: 220, fundidoMaxC: 260, refrigeranteMinC: 50, refrigeranteMaxC: 90,
    rho20KgM3: 1186, rhoFundidoKgM3: 1067, cpJkgC: 2093, kWmC: 0.157, alphaM2s: 7.03e-8, cte1C: 7e-5,
    contraccionMinPct: 0.2, contraccionMaxPct: 0.6, contraccionParalelaPct: 0.4, contraccionPerpendicularPct: 0.4,
    corteMaxS: 40000, fundidoMedioC: 240, powerK: 70500, powerN: 0.237, eta0PaS: 133000,
    wlf: { n: 0.237, tauStarPa: 58100, D1: 3.99e20, D2K: 377.15, D3KPerPa: 0, A1: 51.858, A2K: 51.6 },
    tait: { b1m: 0.000861, b2m: 6e-7, b3m: 2.07e8, b4m: 0.00545, b1s: 0.000862, b2s: 1e-7, b3s: 2.77e8, b4s: 0.00423,
      b5: 386.15, b6: 2e-7, b7: 0, b8: 0, b9: 0 } },
  'PP': { clave: 'PP', nombre: 'PP (polipropileno)', comercial: 'Inspire 702', proveedor: 'Dow', paginas: 'p.391 y p.393',
    costoUSDkg: 1.43, moduloMPa: 1740, cedenciaMPa: 21, deformCedenciaPct: 6, dtulC: 80, noFlujoC: 176,
    fundidoMinC: 200, fundidoMaxC: 240, refrigeranteMinC: 20, refrigeranteMaxC: 50,
    rho20KgM3: 929, rhoFundidoKgM3: 781, cpJkgC: 2890, kWmC: 0.184, alphaM2s: 8.15e-8, cte1C: 9.5e-5,
    contraccionMinPct: 1.2, contraccionMaxPct: 2.2, contraccionParalelaPct: 1.5, contraccionPerpendicularPct: 1.5,
    corteMaxS: 100000, fundidoMedioC: 220, powerK: 5300, powerN: 0.378, eta0PaS: 9070,
    wlf: { n: 0.377, tauStarPa: 3900, D1: 1.99e14, D2K: 263.15, D3KPerPa: 0, A1: 30.02, A2K: 51.6 },
    tait: { b1m: 0.00124, b2m: 8.72e-7, b3m: 8.05e7, b4m: 0.00493, b1s: 0.00117, b2s: 6.14e-7, b3s: 1.1e8, b4s: 0.00512,
      b5: 449.15, b6: 6.25e-8, b7: 7.44e-5, b8: 0.102, b9: 8.67e-9 } },
  'PP-GF30': { clave: 'PP-GF30', nombre: 'PP + 30 % fibra de vidrio', comercial: 'Nepol GB303HP', proveedor: 'Borealis', paginas: 'p.391 y p.393',
    costoUSDkg: 1.97, moduloMPa: 7400, cedenciaMPa: 150, deformCedenciaPct: 2, dtulC: 160, noFlujoC: 170,
    fundidoMinC: 220, fundidoMaxC: 280, refrigeranteMinC: 20, refrigeranteMaxC: 60,
    rho20KgM3: 1127, rhoFundidoKgM3: 927, cpJkgC: 1969, kWmC: 0.13, alphaM2s: 7.12e-8, cte1C: 4.4e-5,
    contraccionMinPct: 0.4, contraccionMaxPct: 0.9, contraccionParalelaPct: 0.5, contraccionPerpendicularPct: 0.8,
    corteMaxS: 80000, fundidoMedioC: 250, powerK: 9520, powerN: 0.332, eta0PaS: 3300,
    wlf: { n: 0.329, tauStarPa: 16900, D1: 1.19e15, D2K: 263.15, D3KPerPa: 0, A1: 33.317, A2K: 51.6 },
    tait: { b1m: 0.00102, b2m: 7.209e-7, b3m: 8.69e7, b4m: 0.00545, b1s: 0.000933, b2s: 3.1e-7, b3s: 1.5e8, b4s: 0.00593,
      b5: 443.15, b6: 6.9e-8, b7: 8.15e-5, b8: 0.142, b9: 1.18e-8 } },
  'PS': { clave: 'PS', nombre: 'PS (poliestireno)', comercial: 'Styron 478', proveedor: 'Dow', paginas: 'p.391 y p.393',
    costoUSDkg: 1.9, moduloMPa: 2110, cedenciaMPa: 23, deformCedenciaPct: 1.4, dtulC: 87, noFlujoC: 121,
    fundidoMinC: 180, fundidoMaxC: 220, refrigeranteMinC: 40, refrigeranteMaxC: 60,
    rho20KgM3: 1036, rhoFundidoKgM3: 958, cpJkgC: 1820, kWmC: 0.133, alphaM2s: 7.63e-8, cte1C: 9e-5,
    contraccionMinPct: 0.3, contraccionMaxPct: 0.7, contraccionParalelaPct: 0.5, contraccionPerpendicularPct: 0.5,
    corteMaxS: 40000, fundidoMedioC: 200, powerK: 78700, powerN: 0.346, eta0PaS: 3.71e6,
    wlf: { n: 0.346, tauStarPa: 10300, D1: 1e12, D2K: 373.15, D3KPerPa: 0, A1: 25.29, A2K: 51.6 },
    tait: { b1m: 0.000997, b2m: 5.98e-7, b3m: 1.56e8, b4m: 0.00458, b1s: 0.000994, b2s: 2.96e-7, b3s: 1.92e8, b4s: 0.00496,
      b5: 394.25, b6: 8.1e-8, b7: 0, b8: 0, b9: 0 } },
  'PS-GF30': { clave: 'PS-GF30', nombre: 'PS sindiotáctico + 30 % fibra de vidrio', comercial: 'Questra WA212', proveedor: 'Dow', paginas: 'p.391 y p.393',
    costoUSDkg: 2.8, moduloMPa: 7600, cedenciaMPa: 92, deformCedenciaPct: 1.2, dtulC: 240, noFlujoC: 248,
    fundidoMinC: 290, fundidoMaxC: 330, refrigeranteMinC: 50, refrigeranteMaxC: 80,
    rho20KgM3: 1265, rhoFundidoKgM3: 1101, cpJkgC: 2400, kWmC: 0.25, alphaM2s: 9.46e-8, cte1C: 3e-5,
    contraccionMinPct: 0.1, contraccionMaxPct: 1.1, contraccionParalelaPct: 0.2, contraccionPerpendicularPct: 0.7,
    corteMaxS: 80000, fundidoMedioC: 310, powerK: 11300, powerN: 0.36, eta0PaS: 9320,
    wlf: { n: 0.358, tauStarPa: 13000, D1: 2.2e15, D2K: 373.15, D3KPerPa: 0, A1: 34.19, A2K: 51.6 },
    tait: { b1m: 0.000878, b2m: 4.98e-7, b3m: 7.29e7, b4m: 0.00194, b1s: 0.000817, b2s: 1.18e-7, b3s: 2.09e8, b4s: 0.0001,
      b5: 521, b6: 2.9e-7, b7: 6.14e-5, b8: 0.019, b9: 1.22e-8 } },
  'PVC-R': { clave: 'PVC-R', nombre: 'PVC rígido', comercial: 'Geon M3000', proveedor: 'PolyOne', paginas: 'p.391 y p.393',
    costoUSDkg: 1.54, moduloMPa: 3200, cedenciaMPa: 51, deformCedenciaPct: 1.6, dtulC: 73, noFlujoC: 77,
    fundidoMinC: 190, fundidoMaxC: 220, refrigeranteMinC: 20, refrigeranteMaxC: 40,
    rho20KgM3: 1350, rhoFundidoKgM3: 1230, cpJkgC: 1630, kWmC: 0.185, alphaM2s: 9.23e-8, cte1C: 7.5e-5,
    contraccionMinPct: 0.2, contraccionMaxPct: 0.6, contraccionParalelaPct: 0.4, contraccionPerpendicularPct: 0.4,
    corteMaxS: 32000, fundidoMedioC: 205, powerK: 832000, powerN: 0.306, eta0PaS: 1.23e8,
    wlf: { n: 0.306, tauStarPa: 92000, D1: 1.02e19, D2K: 353.15, D3KPerPa: 0, A1: 49.42, A2K: 51.6 },
    tait: { b1m: 0.000751, b2m: 4.95e-7, b3m: 2.19e8, b4m: 0.00505, b1s: 0.000751, b2s: 2.32e-7, b3s: 2.67e8, b4s: 0.00496,
      b5: 350.15, b6: 1.33e-7, b7: 0, b8: 0, b9: 0 } },
  'PVC-F': { clave: 'PVC-F', nombre: 'PVC flexible', comercial: 'Geon C9000', proveedor: 'PolyOne', paginas: 'p.391 y p.393',
    costoUSDkg: 1.85, moduloMPa: 570, cedenciaMPa: 9, deformCedenciaPct: 350, dtulC: 55, noFlujoC: 130,
    fundidoMinC: 170, fundidoMaxC: 210, refrigeranteMinC: 40, refrigeranteMaxC: 60,
    rho20KgM3: 1198, rhoFundidoKgM3: 1056, cpJkgC: 1580, kWmC: 0.22, alphaM2s: 1.32e-7, cte1C: 0.00024,
    contraccionMinPct: 1, contraccionMaxPct: 3, contraccionParalelaPct: 1.7, contraccionPerpendicularPct: 1.7,
    corteMaxS: 32000, fundidoMedioC: 190, powerK: 44100, powerN: 0.291, eta0PaS: 209000,
    wlf: { n: 0.291, tauStarPa: 23300, D1: 2.42e13, D2K: 360.15, D3KPerPa: 0, A1: 33.79, A2K: 51.6 },
    tait: { b1m: 0.000902, b2m: 7.72e-7, b3m: 1.15e8, b4m: 0.00536, b1s: 0.000901, b2s: 6.28e-7, b3s: 1.15e8, b4s: 0.00503,
      b5: 403.15, b6: 6.56e-8, b7: 0, b8: 0, b9: 0 } },
};

/** La resina por defecto cuando nadie la declara: la del taller y la del cubo (ABS Cycolac MG47, la del libro). Se ve en el
 *  intake y se cambia ahí; no es un «PP por defecto» escondido. */
export const RESINA_POR_DEFECTO = 'ABS';

/** alias que la gente escribe (el intake viejo decía POM; «acetal», «nylon 6»…) → la clave de la tabla */
const ALIAS_RESINA: Record<string, string> = { ACETAL: 'POM', DELRIN: 'POM', NYLON6: 'PA6', 'NYLON 6': 'PA6', 'PA 6': 'PA6', 'PA 66': 'PA66', PEAD: 'PE-HD', PEBD: 'PE-LD', HDPE: 'PE-HD', LDPE: 'PE-LD' };

/** La ficha del libro de una resina, o null si el libro no la trae (no hay sustituto: «sin ficha: no se calcula»). */
export function fichaResina(clave?: string | null): FichaResina | null {
  if (!clave) return null;
  const k = clave.trim().toUpperCase();
  const f = RESINAS_KAZMER[k] ?? RESINAS_KAZMER[ALIAS_RESINA[k] ?? ''] ?? null;
  return f && fichaCompleta(f) ? f : null;
}

/** ¿Trae TODOS los números? (la tabla del libro los trae; un archivo de planta podría no) */
export function fichaCompleta(f: FichaResina): boolean {
  const nums = [f.costoUSDkg, f.moduloMPa, f.cedenciaMPa, f.dtulC, f.noFlujoC, f.fundidoMinC, f.fundidoMaxC, f.refrigeranteMinC, f.refrigeranteMaxC,
    f.rho20KgM3, f.rhoFundidoKgM3, f.cpJkgC, f.kWmC, f.alphaM2s, f.cte1C, f.contraccionMinPct, f.contraccionMaxPct, f.corteMaxS, f.fundidoMedioC,
    f.powerK, f.powerN, ...Object.values(f.wlf), ...Object.values(f.tait)];
  return nums.every((x) => typeof x === 'number' && Number.isFinite(x));
}

/** El error que corta el cálculo cuando la resina no trae ficha — con la frase que va a pantalla. */
export class ResinaSinFicha extends Error {
  readonly resina: string;
  constructor(resina: string) {
    super(`${resina || '(sin nombre)'}: sin ficha en el libro (Kazmer Apéndice A, p.390-393) — no se calcula: ni contracción, ni presión, ni máquina, ni costo`);
    this.name = 'ResinaSinFicha'; this.resina = resina;
  }
}

/** La ficha o el error: para el motor (que no debe calcular con otra resina en silencio). */
export function fichaResinaOError(clave?: string | null): FichaResina {
  const f = fichaResina(clave);
  if (!f) throw new ResinaSinFicha(String(clave ?? ''));
  return f;
}
