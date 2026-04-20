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
// LISTA COMPLETA
// ═══════════════════════════════════════════════════════════════

export const PRESETS: Preset[] = [
  R_N2O5_DECOMP,
  R_HABER,
  R_NEUTRALIZATION,
  R_H2O2_DECOMP,
  R_H2_COMBUSTION,
];

export function getPreset(id: string): Preset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}
