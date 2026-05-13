/**
 * ══════════════════════════════════════════════════════════════════════
 * ⚗️  ChemLab — Catálogo de Reacciones Precargadas
 * ══════════════════════════════════════════════════════════════════════
 *
 * Parámetros cinéticos extraídos de literatura académica. Cuando los
 * datos experimentales usan un mecanismo complejo (p.ej. combustión de H₂
 * involucra ~8 radicales), usamos una aproximación de un paso global
 * marcada claramente como "global/aparente".
 *
 * FUENTES:
 *   [R1] NIST Chemical Kinetics Database (kinetics.nist.gov)
 *   [R2] Daniels, F. & Johnston, E.H. "The thermal decomposition of gaseous
 *        nitrogen pentoxide", J.A.C.S. 43, 53 (1921) — clásico de libro.
 *   [R3] Atkins & de Paula, "Physical Chemistry", 11th ed., Tabla 17.3
 *   [R4] Laidler, K.J. "Chemical Kinetics", 3rd ed., Harper & Row, 1987.
 *   [R5] Westbrook, C.K. & Dryer, F.L. "Simplified Reaction Mechanisms for
 *        the Oxidation of Hydrocarbon Fuels in Flames", Combust. Sci. Tech.
 *        27, 31-43 (1981). Mecanismo global de combustión de alcanos.
 *   [R6] NIST WebBook (webbook.nist.gov) — entalpías de formación estándar.
 *   [R7] CRC Handbook of Chemistry and Physics, 102nd ed., 2021. Sección 5
 *        (potenciales electroquímicos estándar) y sección 9 (entalpías).
 *   [R8] Ingold, C.K. "Structure and Mechanism in Organic Chemistry", 2nd
 *        ed., Cornell Univ. Press, 1969. Mecanismo SN2 fundacional.
 *   [R9] Smith, M.B. & March, J. "March's Advanced Organic Chemistry", 7th
 *        ed., Wiley, 2013. Cap. 10 (sustitución alifática), Cap. 16
 *        (esterificación de Fischer).
 *  [R10] Bordwell, F.G. pKa Database (chem.wisc.edu/areas/reich/pkatable/).
 */

import type { ReactionStep } from './kinetics';

export interface Preset {
  id: string;
  name: string;
  description: string;
  category: 'combustion' | 'acid-base' | 'decomposition' | 'synthesis' | 'redox';
  steps: ReactionStep[];
  /** Concentraciones iniciales sugeridas [mol/L] */
  initial: Record<string, number>;
  /** Temperatura inicial sugerida [K] */
  T: number;
  /** Rango de temperatura razonable para sliders [K] */
  Trange: [number, number];
  /** Duración sugerida de simulación [s] */
  duration: number;
  /** Paso temporal sugerido [s] */
  dt: number;
  /** Notas didácticas */
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════
// R1 — Descomposición de N₂O₅  (EJEMPLO CANÓNICO DE PRIMER ORDEN)
// ═══════════════════════════════════════════════════════════════
// 2 N₂O₅ → 4 NO₂ + O₂
// Daniels & Johnston 1921 — el experimento clásico que estableció el
// primer orden. k = 4.1×10¹³ exp(-103000/RT) s⁻¹
// Ref [R2], [R1]
export const R_N2O5_DECOMP: Preset = {
  id: 'n2o5-decomp',
  name: 'Descomposición de N₂O₅',
  description: 'Ejemplo canónico de reacción de primer orden (Daniels & Johnston, 1921).',
  category: 'decomposition',
  steps: [
    {
      name: '2 N₂O₅ → 4 NO₂ + O₂',
      reactants: [{ species: 'N2O5', nu: 2, order: 1 }], // orden 1 (no 2) — empírico
      products:  [{ species: 'NO2', nu: 4 }, { species: 'O2', nu: 1 }],
      A: 4.1e13,    // s⁻¹
      Ea: 103000,   // J/mol (24.7 kcal/mol)
      deltaH: 110000,
    },
  ],
  initial: { N2O5: 1.0, NO2: 0, O2: 0 },
  T: 338,                 // 65°C, temperatura del experimento original
  Trange: [300, 400],
  duration: 1800,         // 30 min
  dt: 2,
  notes:
    'A 65°C la vida media es ~10 min. Sube a 85°C y mira cómo cae a <1 min. ' +
    'La ley de velocidad es d[N₂O₅]/dt = -k[N₂O₅] a pesar del 2 estequiométrico — ' +
    'el orden no tiene que coincidir con la estequiometría en reacciones globales.',
};

// ═══════════════════════════════════════════════════════════════
// R2 — Síntesis de amoníaco (Haber-Bosch simplificado)
// ═══════════════════════════════════════════════════════════════
// N₂ + 3 H₂ ⇌ 2 NH₃
// Reacción reversible. Parámetros globales aproximados para demo.
// Ref [R3] Atkins §17.6
export const R_HABER: Preset = {
  id: 'haber',
  name: 'Proceso Haber-Bosch',
  description: 'Síntesis reversible del amoníaco — pilar de la agricultura moderna.',
  category: 'synthesis',
  steps: [
    {
      name: 'N₂ + 3 H₂ ⇌ 2 NH₃',
      reactants: [
        { species: 'N2', nu: 1, order: 1 },
        { species: 'H2', nu: 3, order: 3 },   // orden cinético: N2·H2³
      ],
      products: [{ species: 'NH3', nu: 2, order: 2 }],
      // Parámetros ajustados para dinámica visible en ~3000 s simulados:
      A: 1.0e6,
      Ea: 150000,                              // Ea aparente con catalizador Fe₃O₄
      reversible: true,
      A_rev: 4.0e11,
      Ea_rev: 242000,                          // Ea_rev = Ea + |ΔH|
      deltaH: -92000,                          // exotérmica
    },
  ],
  initial: { N2: 1.0, H2: 3.0, NH3: 0 },
  T: 723,                                      // 450°C condiciones industriales
  Trange: [500, 900],
  duration: 3000,
  dt: 1,
  notes:
    'Haber ganó el Nobel 1918. Alta T acelera pero reduce equilibrio (exotérmica); ' +
    'alta P favorece productos (Le Chatelier). El catalizador Fe₃O₄ baja Ea de ~230 a ~150 kJ/mol.',
};

// ═══════════════════════════════════════════════════════════════
// R3 — Neutralización ácido fuerte + base fuerte
// ═══════════════════════════════════════════════════════════════
// HCl + NaOH → NaCl + H₂O
// Reacción iónica prácticamente instantánea — k enorme.
// Ref [R4] Laidler §9
export const R_NEUTRALIZATION: Preset = {
  id: 'neutralization',
  name: 'Neutralización HCl + NaOH',
  description: 'Ácido fuerte + base fuerte — reacción rápida (escalada para visualización).',
  category: 'acid-base',
  steps: [
    {
      name: 'HCl + NaOH → NaCl + H₂O',
      reactants: [
        { species: 'HCl',  nu: 1, order: 1 },
        { species: 'NaOH', nu: 1, order: 1 },
      ],
      products: [
        { species: 'NaCl', nu: 1 },
        { species: 'H2O',  nu: 1 },
      ],
      // Parámetros ESCALADOS para visualización: la reacción real es casi
      // instantánea (kf ≈ 10¹¹ M⁻¹s⁻¹, difusión-limitada); aquí usamos A y Ea
      // que dan dinámica observable en ~10 s, preservando forma exponencial.
      A: 1.0e3,
      Ea: 15000,
      deltaH: -57100,
    },
  ],
  initial: { HCl: 1.0, NaOH: 1.0, NaCl: 0, H2O: 0 },
  T: 298,
  Trange: [273, 373],
  duration: 10,
  dt: 0.01,
  notes:
    'ΔH = -57.1 kJ/mol (entalpía estándar de neutralización para ácido/base fuerte ' +
    'en solución acuosa). Nota didáctica: kf real es ~10¹¹ M⁻¹s⁻¹ (limitado por ' +
    'difusión); aquí escalamos para que la cinética sea visible.',
};

// ═══════════════════════════════════════════════════════════════
// R4 — Descomposición catalítica de H₂O₂
// ═══════════════════════════════════════════════════════════════
// 2 H₂O₂ → 2 H₂O + O₂
// Sin catalizador es lenta; con MnO₂ o catalasa es muy rápida.
// Ref [R1] NIST
export const R_H2O2_DECOMP: Preset = {
  id: 'h2o2-decomp',
  name: 'Descomposición de H₂O₂',
  description: 'Peróxido → agua + oxígeno. Demo clásica con catalizador.',
  category: 'decomposition',
  steps: [
    {
      name: '2 H₂O₂ → 2 H₂O + O₂',
      reactants: [{ species: 'H2O2', nu: 2, order: 1 }],
      products:  [{ species: 'H2O',  nu: 2 }, { species: 'O2', nu: 1 }],
      // Valores experimentales sin catalizador: k(298 K) ≈ 10⁻⁷ s⁻¹, Ea ≈ 75 kJ/mol
      // → A = k·exp(Ea/RT) ≈ 1.6·10⁶ s⁻¹
      A: 1.6e6,
      Ea: 75000,
      deltaH: -98200,
    },
  ],
  initial: { H2O2: 1.0, H2O: 0, O2: 0 },
  T: 320,                                      // un poco por encima de 298 para ver algo
  Trange: [273, 373],
  duration: 600,
  dt: 1,
  notes:
    'Con catalasa la Ea baja a ~23 kJ/mol → velocidad ×10⁹. La biología ' +
    'usa enzimas para bajar Ea sin cambiar el equilibrio. A 25°C sin catalizador ' +
    'la vida media es de años; prueba subir T o (virtualmente) bajar Ea.',
};

// ═══════════════════════════════════════════════════════════════
// R5 — Combustión de hidrógeno (aproximación global)
// ═══════════════════════════════════════════════════════════════
// 2 H₂ + O₂ → 2 H₂O
// El mecanismo real tiene ~20 radicales; aquí una aproximación global
// útil para visualizar la explosividad de la reacción.
// Ref [R1]
export const R_H2_COMBUSTION: Preset = {
  id: 'h2-combustion',
  name: 'Combustión de H₂',
  description: 'Reacción altamente exotérmica (cohetes Apollo, pila de combustible).',
  category: 'combustion',
  steps: [
    {
      name: '2 H₂ + O₂ → 2 H₂O (global aparente)',
      reactants: [
        { species: 'H2', nu: 2, order: 1 },
        { species: 'O2', nu: 1, order: 1 },
      ],
      products: [{ species: 'H2O', nu: 2 }],
      A: 5.5e13,
      Ea: 230000,           // energía de activación global
      deltaH: -483000,      // fuertemente exotérmica
    },
  ],
  initial: { H2: 2.0, O2: 1.0, H2O: 0 },
  T: 900,
  Trange: [600, 1500],
  duration: 0.01,
  dt: 0.00002,
  notes:
    'A 900 K la reacción es lenta pero arranca; sobre 1000 K es explosiva. ' +
    'El mecanismo real tiene radicales H·, OH·, HO₂· — este modelo de un paso ' +
    'simplifica pero captura la dependencia exponencial con T (Arrhenius).',
};

// ═══════════════════════════════════════════════════════════════
// R6 — Combustión de metano (Westbrook & Dryer global)
// ═══════════════════════════════════════════════════════════════
// CH₄ + 2 O₂ → CO₂ + 2 H₂O
//
// Entalpía estándar de combustión:
//   ΔH°c(CH₄, g, H₂O g) = -802.3 kJ/mol  [R6 NIST WebBook]
//   ΔH°c(CH₄, g, H₂O l) = -890.4 kJ/mol
// Usamos -802.3 kJ/mol (productos en fase gas, consistente con simulación
// a alta temperatura donde el agua existe como vapor).
//
// Mecanismo aparente Westbrook-Dryer:
//   r = A · [CH₄]^a · [O₂]^b · exp(-Ea/RT)
//   con A ≈ 1.3·10⁸ cm³/(mol·s), Ea ≈ 202 kJ/mol, a = -0.3, b = 1.3.
// Aquí simplificamos a orden 1·1 para la integración RK4 (preservamos Ea y
// la dependencia exponencial con T; el exponente fraccionario se reserva
// para módulos más avanzados).
// Ref [R5] Westbrook & Dryer 1981, [R6] NIST WebBook.
export const R_CH4_COMBUSTION: Preset = {
  id: 'ch4-combustion',
  name: 'Combustión de CH₄ (gas natural)',
  description: 'Oxidación completa del metano — base del gas natural y combustibles fósiles.',
  category: 'combustion',
  steps: [
    {
      name: 'CH₄ + 2 O₂ → CO₂ + 2 H₂O (global aparente)',
      reactants: [
        { species: 'CH4', nu: 1, order: 1 },
        { species: 'O2',  nu: 2, order: 1 },
      ],
      products: [
        { species: 'CO2', nu: 1 },
        { species: 'H2O', nu: 2 },
      ],
      A: 1.3e8,           // factor preexponencial Westbrook-Dryer (escalado)
      Ea: 202000,         // 202 kJ/mol [R5]
      deltaH: -802300,    // J/mol (productos gas) [R6 NIST WebBook]
    },
  ],
  initial: { CH4: 1.0, O2: 2.0, CO2: 0, H2O: 0 },
  T: 1200,
  Trange: [900, 2000],
  duration: 0.5,
  dt: 0.001,
  notes:
    'A 1200 K la reacción tarda décimas de segundo. La combustión completa libera ' +
    '−802 kJ/mol (vapor) o −890 kJ/mol (líquido); la diferencia es el calor latente ' +
    'de condensación del H₂O. El mecanismo real involucra >25 especies (radicales ' +
    'CH₃·, OH·, HO₂·); este modelo de un paso es una aproximación global aparente.',
};

// ═══════════════════════════════════════════════════════════════
// R7 — Redox Fe + CuSO₄ (desplazamiento simple)
// ═══════════════════════════════════════════════════════════════
// Fe(s) + CuSO₄(aq) → FeSO₄(aq) + Cu(s)
// Iónica neta: Fe(s) + Cu²⁺ → Fe²⁺ + Cu(s)
//
// Potenciales estándar [R7 CRC]:
//   E°(Cu²⁺/Cu)  = +0.342 V
//   E°(Fe²⁺/Fe)  = -0.447 V
//   E°(cell)     = +0.789 V
// ΔG° = -nFE° = -2 · 96485 · 0.789 = -152.3 kJ/mol → K_eq enorme (~10²⁶).
// Reacción prácticamente irreversible a temperatura ambiente.
//
// ΔH° (de entalpías de formación, R7 CRC sección 9):
//   ΔH°f(FeSO₄·aq) ≈ -998.3 kJ/mol
//   ΔH°f(CuSO₄·aq) ≈ -844.5 kJ/mol
//   Fe(s) y Cu(s) tienen ΔH°f = 0 por definición.
//   ΔH° = -998.3 - (-844.5) = -153.8 kJ/mol → exotérmica.
//
// Cinética: lenta sin pulir la superficie metálica; Ea aparente ≈ 50 kJ/mol
// (control por transferencia de masa más que por activación electrónica).
export const R_FE_CU_REDOX: Preset = {
  id: 'fe-cu-redox',
  name: 'Redox Fe + CuSO₄',
  description: 'Desplazamiento simple — el hierro reduce al cobre (II). Demo clásica de electroquímica.',
  category: 'redox',
  steps: [
    {
      name: 'Fe + CuSO₄ → FeSO₄ + Cu',
      reactants: [
        { species: 'Fe',    nu: 1, order: 1 },
        { species: 'CuSO4', nu: 1, order: 1 },
      ],
      products: [
        { species: 'FeSO4', nu: 1 },
        { species: 'Cu',    nu: 1 },
      ],
      A: 5.0e6,           // M⁻¹ s⁻¹ (control por superficie)
      Ea: 50000,          // 50 kJ/mol (aparente)
      deltaH: -153800,    // J/mol [R7]
    },
  ],
  initial: { Fe: 1.0, CuSO4: 1.0, FeSO4: 0, Cu: 0 },
  T: 298,
  Trange: [273, 373],
  duration: 600,
  dt: 0.5,
  notes:
    'E°(cell) = +0.789 V → ΔG° = -nFE° = -152 kJ/mol (n=2 electrones). ' +
    'K_eq ≈ exp(152300/(8.314·298)) ≈ 10²⁶ → prácticamente irreversible. ' +
    'El cobre metálico se deposita en la superficie del hierro; la solución azul ' +
    '(Cu²⁺) se decolora a verde pálido (Fe²⁺).',
};

// ═══════════════════════════════════════════════════════════════
// R8 — Sustitución nucleofílica bimolecular (SN2)
// ═══════════════════════════════════════════════════════════════
// CH₃Br + NaOH → CH₃OH + NaBr
// Iónica neta: CH₃Br + OH⁻ → CH₃OH + Br⁻
//
// Cinética experimental [R8 Ingold, R4 Laidler §9.4]:
//   k(298 K) ≈ 2.4·10⁻⁴ M⁻¹s⁻¹ (en agua)
//   Ea ≈ 92 kJ/mol  → A = k · exp(Ea/RT) ≈ 3.5·10¹² M⁻¹s⁻¹
//   Orden 2 (1 en CH₃Br, 1 en OH⁻) → confirmó el mecanismo bimolecular Walden.
//
// Termodinámica:
//   ΔH° ≈ -75 kJ/mol (de entalpías de formación, productos más estables).
//
// El SN2 invierte la configuración en el carbono (inversión de Walden) —
// punto histórico fundamental en estereoquímica.
export const R_SN2: Preset = {
  id: 'sn2-ch3br',
  name: 'SN2: CH₃Br + OH⁻',
  description: 'Sustitución nucleofílica bimolecular (Ingold) — paradigma del mecanismo SN2.',
  category: 'synthesis',
  steps: [
    {
      name: 'CH₃Br + NaOH → CH₃OH + NaBr',
      reactants: [
        { species: 'CH3Br', nu: 1, order: 1 },
        { species: 'NaOH',  nu: 1, order: 1 },
      ],
      products: [
        { species: 'CH3OH', nu: 1 },
        { species: 'NaBr',  nu: 1 },
      ],
      A: 3.5e12,          // M⁻¹ s⁻¹ [R4 Laidler]
      Ea: 92000,          // 92 kJ/mol [R8 Ingold]
      deltaH: -75000,
    },
  ],
  initial: { CH3Br: 1.0, NaOH: 1.0, CH3OH: 0, NaBr: 0 },
  T: 333,                                      // 60°C — temperatura típica
  Trange: [298, 373],
  duration: 3600,                              // 1 hora
  dt: 5,
  notes:
    'k(60°C) ≈ 5·10⁻³ M⁻¹s⁻¹; vida media a 1 M inicial ≈ 3.3 min. ' +
    'Mecanismo: el OH⁻ ataca al C por el lado opuesto al Br⁻ → estado de transición ' +
    'pentacoordinado → inversión de Walden. Orden 2 confirma bimolecularidad. ' +
    'Sustratos primarios (como CH₃Br) prefieren SN2; los terciarios prefieren SN1.',
};

// ═══════════════════════════════════════════════════════════════
// R9 — Esterificación de Fischer (reversible, equilibrio ~4)
// ═══════════════════════════════════════════════════════════════
// CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O  (acetato de etilo)
//
// Termodinámica [R9 March 16-64]:
//   K_eq(298 K) ≈ 4   (medido por Berthelot & Saint-Gilles, 1862 — pionero)
//   ΔG° = -RT ln K = -8.314·298·ln(4) = -3.43 kJ/mol  (cuasi-equilibrado)
//   ΔH° ≈ -2 kJ/mol  (casi termoneutra; el equilibrio depende fuertemente de la
//                     entropía y de la actividad del agua → Le Chatelier).
//
// Cinética [R4 Laidler §9.6, sin catalizador ácido]:
//   Ea_fwd ≈ 75 kJ/mol, A_fwd ≈ 4·10⁸ M⁻¹s⁻¹
//   Ea_rev ≈ 77 kJ/mol (Ea_rev = Ea_fwd - ΔH ≈ 75 + 2)
//   A_rev = A_fwd / K_eq → A_rev ≈ 10⁸ M⁻¹s⁻¹  (orden de magnitud)
//
// Catalizador típico: H₂SO₄ baja Ea a ~40 kJ/mol (no incluido aquí — modelo
// neutro).
export const R_FISCHER_ESTER: Preset = {
  id: 'fischer-ester',
  name: 'Esterificación de Fischer',
  description: 'Ácido acético + etanol ⇌ acetato de etilo + agua. Equilibrio cuasi-neutro K≈4.',
  category: 'synthesis',
  steps: [
    {
      name: 'CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O',
      reactants: [
        { species: 'CH3COOH', nu: 1, order: 1 },
        { species: 'C2H5OH',  nu: 1, order: 1 },
      ],
      products: [
        { species: 'CH3COOC2H5', nu: 1, order: 1 },
        { species: 'H2O',        nu: 1, order: 1 },
      ],
      A: 4.0e8,           // M⁻¹ s⁻¹
      Ea: 75000,          // 75 kJ/mol [R4]
      reversible: true,
      A_rev: 1.0e8,       // ajustado para K_eq ≈ 4
      Ea_rev: 77000,
      deltaH: -2000,      // casi termoneutra
    },
  ],
  initial: { CH3COOH: 1.0, C2H5OH: 1.0, CH3COOC2H5: 0, H2O: 0 },
  T: 373,                                      // reflujo en etanol/H₂O
  Trange: [298, 423],
  duration: 36000,                             // 10 h
  dt: 30,
  notes:
    'Reacción descubierta por Emil Fischer (1895, Nobel 1902). El equilibrio K≈4 ' +
    'significa que partiendo de 1:1, se convierte ~67% — para mejorar el rendimiento ' +
    'se usa exceso de alcohol o se destila el agua (principio de Le Chatelier). ' +
    'Con H₂SO₄ catalítico la cinética acelera ×1000 pero el equilibrio NO cambia ' +
    '(un catalizador no altera ΔG°).',
};

// ═══════════════════════════════════════════════════════════════
// LISTA COMPLETA
// ═══════════════════════════════════════════════════════════════

export const PRESETS: Preset[] = [
  R_N2O5_DECOMP,
  R_HABER,
  R_NEUTRALIZATION,
  R_H2O2_DECOMP,
  R_H2_COMBUSTION,
  R_CH4_COMBUSTION,
  R_FE_CU_REDOX,
  R_SN2,
  R_FISCHER_ESTER,
];

export function getPreset(id: string): Preset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}
