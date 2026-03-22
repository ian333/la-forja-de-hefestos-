/**
 * ══════════════════════════════════════════════════════════════════════
 * ⚒️  LA FORJA DE HEFESTOS — Biblioteca de Fórmulas de Ingeniería
 * ══════════════════════════════════════════════════════════════════════
 *
 * Motor matemático puro para simulaciones de ingeniería.
 * Cada fórmula incluye referencia bibliográfica.
 *
 * REFERENCIAS PRINCIPALES:
 * ────────────────────────
 * [1] Timoshenko, S.P. & Goodier, J.N. "Theory of Elasticity", 3rd ed., McGraw-Hill, 1970.
 * [2] Zienkiewicz, O.C. & Taylor, R.L. "The Finite Element Method", 7th ed., Butterworth-Heinemann, 2013.
 * [3] Bathe, K.J. "Finite Element Procedures", 2nd ed., K.J. Bathe, 2014.
 * [4] Cook, R.D. et al. "Concepts and Applications of Finite Element Analysis", 4th ed., Wiley, 2001.
 * [5] Logan, D.L. "A First Course in the Finite Element Method", 6th ed., Cengage, 2016.
 * [6] Incropera, F.P. et al. "Fundamentals of Heat and Mass Transfer", 7th ed., Wiley, 2011.
 * [7] Cengel, Y.A. & Cimbala, J.M. "Fluid Mechanics: Fundamentals and Applications", 4th ed., McGraw-Hill, 2017.
 * [8] Shigley, J.E. & Mischke, C.R. "Mechanical Engineering Design", 10th ed., McGraw-Hill, 2014.
 * [9] Roark, R.J. & Young, W.C. "Formulas for Stress and Strain", 8th ed., McGraw-Hill, 2012.
 * [10] Beer, F.P. et al. "Mechanics of Materials", 7th ed., McGraw-Hill, 2014.
 * [11] Hughes, T.J.R. "The Finite Element Method: Linear Static and Dynamic", Dover, 2000.
 * [12] Reddy, J.N. "An Introduction to the Finite Element Method", 4th ed., McGraw-Hill, 2019.
 * [13] Euler, L. "Methodus inveniendi lineas curvas...", 1744.
 * [14] von Mises, R. "Mechanik der festen Körper im plastisch-deformablen Zustand", 1913.
 * [15] Navier, C.L.M.H. "Mémoire sur les lois du mouvement des fluides", 1822.
 * [16] Fourier, J.B.J. "Théorie analytique de la chaleur", 1822.
 * [17] Cauchy, A.L. "Recherches sur l'équilibre et le mouvement intérieur des corps solides", 1822.
 * [18] Hooke, R. "De Potentia Restitutiva", 1678.
 */

// ═══════════════════════════════════════════════════════════════
// 1. PROPIEDADES DE MATERIALES — Base de datos
// ═══════════════════════════════════════════════════════════════
// Ref [8] Shigley cap.2, [10] Beer Apéndice B

export interface MaterialProperties {
  name: string;
  /** Módulo de Young E [Pa] — Ref [18] Hooke */
  youngsModulus: number;
  /** Relación de Poisson ν [adimensional] — Ref [1] Timoshenko §2 */
  poissonsRatio: number;
  /** Densidad ρ [kg/m³] */
  density: number;
  /** Esfuerzo de fluencia σ_y [Pa] — Ref [8] Shigley §2.4 */
  yieldStrength: number;
  /** Esfuerzo último σ_u [Pa] */
  ultimateStrength: number;
  /** Conductividad térmica k [W/(m·K)] — Ref [6] Incropera Tabla A.1 */
  thermalConductivity: number;
  /** Calor específico c_p [J/(kg·K)] — Ref [6] Incropera */
  specificHeat: number;
  /** Coeficiente de expansión térmica α [1/K] — Ref [1] Timoshenko §14 */
  thermalExpansion: number;
  /** Módulo de corte G [Pa] — G = E / (2(1+ν)) — Ref [1] Timoshenko §6 */
  shearModulus: number;
  /** Color para visualización (hex) */
  color: string;
}

/** Calcula módulo de corte: G = E / (2(1+ν)) — Ref [1] Timoshenko Ec. 6.3 */
function shearMod(E: number, nu: number): number {
  return E / (2 * (1 + nu));
}

export const MATERIAL_DATABASE: Record<string, MaterialProperties> = {
  // ─── Aceros ───
  'acero_1020': {
    name: 'Acero AISI 1020 (Bajo carbono)',
    youngsModulus: 207e9, poissonsRatio: 0.29, density: 7870,
    yieldStrength: 350e6, ultimateStrength: 420e6,
    thermalConductivity: 51.9, specificHeat: 486, thermalExpansion: 11.7e-6,
    shearModulus: shearMod(207e9, 0.29), color: '#8C8C8C',
  },
  'acero_1045': {
    name: 'Acero AISI 1045 (Medio carbono)',
    youngsModulus: 207e9, poissonsRatio: 0.29, density: 7870,
    yieldStrength: 530e6, ultimateStrength: 625e6,
    thermalConductivity: 49.8, specificHeat: 486, thermalExpansion: 11.7e-6,
    shearModulus: shearMod(207e9, 0.29), color: '#7A7A7A',
  },
  'acero_4340': {
    name: 'Acero AISI 4340 (Alta resistencia)',
    youngsModulus: 205e9, poissonsRatio: 0.29, density: 7850,
    yieldStrength: 862e6, ultimateStrength: 1282e6,
    thermalConductivity: 44.5, specificHeat: 475, thermalExpansion: 12.3e-6,
    shearModulus: shearMod(205e9, 0.29), color: '#6B6B6B',
  },
  'acero_304': {
    name: 'Acero Inoxidable AISI 304',
    youngsModulus: 193e9, poissonsRatio: 0.29, density: 8000,
    yieldStrength: 215e6, ultimateStrength: 505e6,
    thermalConductivity: 16.2, specificHeat: 500, thermalExpansion: 17.3e-6,
    shearModulus: shearMod(193e9, 0.29), color: '#B0B0B0',
  },
  'acero_316': {
    name: 'Acero Inoxidable AISI 316',
    youngsModulus: 193e9, poissonsRatio: 0.30, density: 8000,
    yieldStrength: 205e6, ultimateStrength: 515e6,
    thermalConductivity: 16.3, specificHeat: 500, thermalExpansion: 15.9e-6,
    shearModulus: shearMod(193e9, 0.30), color: '#A8A8A8',
  },

  // ─── Aluminios ───
  'aluminio_6061': {
    name: 'Aluminio 6061-T6',
    youngsModulus: 68.9e9, poissonsRatio: 0.33, density: 2700,
    yieldStrength: 276e6, ultimateStrength: 310e6,
    thermalConductivity: 167, specificHeat: 896, thermalExpansion: 23.6e-6,
    shearModulus: shearMod(68.9e9, 0.33), color: '#C0C8D0',
  },
  'aluminio_7075': {
    name: 'Aluminio 7075-T6',
    youngsModulus: 71.7e9, poissonsRatio: 0.33, density: 2810,
    yieldStrength: 503e6, ultimateStrength: 572e6,
    thermalConductivity: 130, specificHeat: 960, thermalExpansion: 23.4e-6,
    shearModulus: shearMod(71.7e9, 0.33), color: '#B8C0C8',
  },
  'aluminio_2024': {
    name: 'Aluminio 2024-T4',
    youngsModulus: 73.1e9, poissonsRatio: 0.33, density: 2780,
    yieldStrength: 324e6, ultimateStrength: 469e6,
    thermalConductivity: 121, specificHeat: 875, thermalExpansion: 22.9e-6,
    shearModulus: shearMod(73.1e9, 0.33), color: '#B5BDC5',
  },

  // ─── Cobre ───
  'cobre_c11000': {
    name: 'Cobre Electrolítico C11000',
    youngsModulus: 117e9, poissonsRatio: 0.34, density: 8940,
    yieldStrength: 69e6, ultimateStrength: 220e6,
    thermalConductivity: 388, specificHeat: 385, thermalExpansion: 16.6e-6,
    shearModulus: shearMod(117e9, 0.34), color: '#B87333',
  },

  // ─── Titanio ───
  'titanio_ti6al4v': {
    name: 'Titanio Ti-6Al-4V (Grado 5)',
    youngsModulus: 114e9, poissonsRatio: 0.34, density: 4430,
    yieldStrength: 880e6, ultimateStrength: 950e6,
    thermalConductivity: 6.7, specificHeat: 526, thermalExpansion: 8.6e-6,
    shearModulus: shearMod(114e9, 0.34), color: '#8B8682',
  },

  // ─── Fundición ───
  'hierro_gris': {
    name: 'Hierro Fundido Gris (Clase 30)',
    youngsModulus: 100e9, poissonsRatio: 0.26, density: 7200,
    yieldStrength: 210e6, ultimateStrength: 210e6,
    thermalConductivity: 46.0, specificHeat: 544, thermalExpansion: 10.8e-6,
    shearModulus: shearMod(100e9, 0.26), color: '#616161',
  },

  // ─── Plásticos de ingeniería ───
  'nylon_66': {
    name: 'Nylon 6/6',
    youngsModulus: 3.0e9, poissonsRatio: 0.39, density: 1140,
    yieldStrength: 70e6, ultimateStrength: 85e6,
    thermalConductivity: 0.25, specificHeat: 1670, thermalExpansion: 80e-6,
    shearModulus: shearMod(3.0e9, 0.39), color: '#F5F0E0',
  },
  'abs': {
    name: 'ABS (Acrilonitrilo butadieno estireno)',
    youngsModulus: 2.3e9, poissonsRatio: 0.35, density: 1050,
    yieldStrength: 43e6, ultimateStrength: 43e6,
    thermalConductivity: 0.17, specificHeat: 1386, thermalExpansion: 73.8e-6,
    shearModulus: shearMod(2.3e9, 0.35), color: '#E8E0D0',
  },
  'pla': {
    name: 'PLA (Ácido poliláctico)',
    youngsModulus: 3.5e9, poissonsRatio: 0.36, density: 1240,
    yieldStrength: 60e6, ultimateStrength: 65e6,
    thermalConductivity: 0.13, specificHeat: 1800, thermalExpansion: 68e-6,
    shearModulus: shearMod(3.5e9, 0.36), color: '#E0E8D0',
  },
  'petg': {
    name: 'PETG',
    youngsModulus: 2.1e9, poissonsRatio: 0.37, density: 1270,
    yieldStrength: 50e6, ultimateStrength: 53e6,
    thermalConductivity: 0.29, specificHeat: 1200, thermalExpansion: 60e-6,
    shearModulus: shearMod(2.1e9, 0.37), color: '#D8E0E8',
  },

  // ─── Madera ───
  'madera_pino': {
    name: 'Pino (Pinus, paralelo a fibra)',
    youngsModulus: 12e9, poissonsRatio: 0.30, density: 500,
    yieldStrength: 40e6, ultimateStrength: 78e6,
    thermalConductivity: 0.12, specificHeat: 2300, thermalExpansion: 3.5e-6,
    shearModulus: shearMod(12e9, 0.30), color: '#C4A882',
  },

  // ─── Concreto ───
  'concreto_fc250': {
    name: 'Concreto f\'c=250 kg/cm²',
    youngsModulus: 25e9, poissonsRatio: 0.20, density: 2400,
    yieldStrength: 25e6, ultimateStrength: 25e6,
    thermalConductivity: 1.0, specificHeat: 880, thermalExpansion: 10e-6,
    shearModulus: shearMod(25e9, 0.20), color: '#9E9E9E',
  },
};

// ═══════════════════════════════════════════════════════════════
// 2. MECÁNICA DE SÓLIDOS — Elasticidad Lineal
// ═══════════════════════════════════════════════════════════════
// Ref [1] Timoshenko cap.1-6, [17] Cauchy, [18] Hooke

/**
 * Tensor de esfuerzos de Cauchy (3×3 simétrico) → 6 componentes Voigt
 * σ = [σ_xx, σ_yy, σ_zz, τ_xy, τ_yz, τ_xz]
 * Ref [17] Cauchy, [1] Timoshenko §3
 */
export type StressTensor = [number, number, number, number, number, number];

/**
 * Tensor de deformaciones (3×3 simétrico) → 6 componentes Voigt
 * ε = [ε_xx, ε_yy, ε_zz, γ_xy, γ_yz, γ_xz]
 * Ref [1] Timoshenko §2
 */
export type StrainTensor = [number, number, number, number, number, number];

/**
 * Ley de Hooke generalizada: σ = D · ε
 * Matriz constitutiva elástica D (6×6) para material isotrópico.
 *
 * D = (E/((1+ν)(1-2ν))) × 
 * | 1-ν   ν     ν     0           0           0          |
 * | ν     1-ν   ν     0           0           0          |
 * | ν     ν     1-ν   0           0           0          |
 * | 0     0     0     (1-2ν)/2    0           0          |
 * | 0     0     0     0           (1-2ν)/2    0          |
 * | 0     0     0     0           0           (1-2ν)/2   |
 *
 * Ref [1] Timoshenko Ec. 6.5, [18] Hooke, [2] Zienkiewicz cap.4
 */
export function elasticityMatrix3D(E: number, nu: number): number[][] {
  const c = E / ((1 + nu) * (1 - 2 * nu));
  const d1 = c * (1 - nu);
  const d2 = c * nu;
  const d3 = c * (1 - 2 * nu) / 2;
  return [
    [d1, d2, d2,  0,  0,  0],
    [d2, d1, d2,  0,  0,  0],
    [d2, d2, d1,  0,  0,  0],
    [ 0,  0,  0, d3,  0,  0],
    [ 0,  0,  0,  0, d3,  0],
    [ 0,  0,  0,  0,  0, d3],
  ];
}

/**
 * Esfuerzo plano (2D) — Matriz constitutiva D (3×3)
 * Para elementos de placa/membrana.
 *
 * D = (E/(1-ν²)) ×
 * | 1   ν   0         |
 * | ν   1   0         |
 * | 0   0   (1-ν)/2   |
 *
 * Ref [2] Zienkiewicz §4.3, [5] Logan §6.4
 */
export function planeStressMatrix(E: number, nu: number): number[][] {
  const c = E / (1 - nu * nu);
  return [
    [c,       c * nu,  0              ],
    [c * nu,  c,       0              ],
    [0,       0,       c * (1 - nu) / 2],
  ];
}

/**
 * Deformación plana (2D) — Matriz constitutiva D (3×3)
 *
 * D = (E(1-ν)/((1+ν)(1-2ν))) ×
 * | 1         ν/(1-ν)     0               |
 * | ν/(1-ν)   1           0               |
 * | 0         0           (1-2ν)/(2(1-ν)) |
 *
 * Ref [2] Zienkiewicz §4.4, [5] Logan §6.5
 */
export function planeStrainMatrix(E: number, nu: number): number[][] {
  const c = E * (1 - nu) / ((1 + nu) * (1 - 2 * nu));
  const r = nu / (1 - nu);
  const s = (1 - 2 * nu) / (2 * (1 - nu));
  return [
    [c,     c * r,  0    ],
    [c * r, c,      0    ],
    [0,     0,      c * s],
  ];
}

/**
 * Esfuerzo de Von Mises: σ_vm = √(½[(σ₁-σ₂)²+(σ₂-σ₃)²+(σ₃-σ₁)²+6(τ_xy²+τ_yz²+τ_xz²)])
 * Criterio de fluencia para materiales dúctiles.
 * Ref [14] von Mises 1913, [8] Shigley §5.4
 */
export function vonMisesStress(s: StressTensor): number {
  const [sx, sy, sz, txy, tyz, txz] = s;
  return Math.sqrt(
    0.5 * ((sx - sy) ** 2 + (sy - sz) ** 2 + (sz - sx) ** 2 +
           6 * (txy ** 2 + tyz ** 2 + txz ** 2))
  );
}

/**
 * Esfuerzos principales σ₁, σ₂, σ₃ (eigenvalues del tensor de esfuerzos)
 * Resuelve la ecuación cúbica: σ³ - I₁σ² + I₂σ - I₃ = 0
 * Usando invariantes del tensor.
 * Ref [1] Timoshenko §7, [10] Beer §7.5
 */
export function principalStresses(s: StressTensor): [number, number, number] {
  const [sx, sy, sz, txy, tyz, txz] = s;

  // Invariantes del tensor — Ref [1] Timoshenko Ec. 7.2
  const I1 = sx + sy + sz;
  const I2 = sx * sy + sy * sz + sz * sx - txy ** 2 - tyz ** 2 - txz ** 2;
  const I3 = sx * sy * sz + 2 * txy * tyz * txz -
             sx * tyz ** 2 - sy * txz ** 2 - sz * txy ** 2;

  // Solución analítica de la ecuación cúbica — método trigonométrico
  const p = I1 * I1 / 3 - I2;
  const q = 2 * I1 ** 3 / 27 - I1 * I2 / 3 + I3;

  if (p < 1e-20) return [I1 / 3, I1 / 3, I1 / 3]; // Estado hidrostático

  const sqrtP = Math.sqrt(p / 3);
  const arg = Math.max(-1, Math.min(1, -q / (2 * sqrtP ** 3)));
  const phi = Math.acos(arg) / 3;

  const s1 = I1 / 3 + 2 * sqrtP * Math.cos(phi);
  const s2 = I1 / 3 + 2 * sqrtP * Math.cos(phi - 2 * Math.PI / 3);
  const s3 = I1 / 3 + 2 * sqrtP * Math.cos(phi - 4 * Math.PI / 3);

  // Ordenar: σ₁ ≥ σ₂ ≥ σ₃
  const sorted = [s1, s2, s3].sort((a, b) => b - a) as [number, number, number];
  return sorted;
}

/**
 * Esfuerzo cortante máximo: τ_max = (σ₁ - σ₃) / 2
 * Criterio de Tresca.
 * Ref [10] Beer §7.6, [8] Shigley §5.3
 */
export function maxShearStress(s: StressTensor): number {
  const [s1, , s3] = principalStresses(s);
  return (s1 - s3) / 2;
}

/**
 * Factor de seguridad (Von Mises): n = σ_y / σ_vm
 * Ref [8] Shigley §5.4
 */
export function safetyFactorVonMises(s: StressTensor, yieldStrength: number): number {
  const vm = vonMisesStress(s);
  return vm > 0 ? yieldStrength / vm : Infinity;
}

/**
 * Presión hidrostática: σ_h = (σ_xx + σ_yy + σ_zz) / 3
 * Ref [1] Timoshenko §7
 */
export function hydrostaticStress(s: StressTensor): number {
  return (s[0] + s[1] + s[2]) / 3;
}

// ═══════════════════════════════════════════════════════════════
// 3. MÉTODO DE ELEMENTOS FINITOS — Elementos Fundamentales
// ═══════════════════════════════════════════════════════════════
// Ref [2] Zienkiewicz, [3] Bathe, [4] Cook, [5] Logan, [11] Hughes, [12] Reddy

/**
 * Elemento truss/barra 2-nodos en 3D (6 DOF)
 * Rigidez local: k = (EA/L) × [1, -1; -1, 1]
 * Transformación a coordenadas globales vía cosenos directores.
 *
 * Ref [5] Logan §3.3, [4] Cook §2.3
 *
 * @param E - Módulo de Young [Pa]
 * @param A - Área de sección transversal [m²]
 * @param L - Longitud del elemento [m]
 * @param cx,cy,cz - Cosenos directores (dirección del elemento)
 * @returns Matriz de rigidez global 6×6
 */
export function trussStiffness3D(
  E: number, A: number, L: number,
  cx: number, cy: number, cz: number
): number[][] {
  const k = (E * A) / L;
  const cc = [
    [cx * cx, cx * cy, cx * cz],
    [cy * cx, cy * cy, cy * cz],
    [cz * cx, cz * cy, cz * cz],
  ];

  const K: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const val = k * cc[i][j];
      K[i][j] = val;
      K[i][j + 3] = -val;
      K[i + 3][j] = -val;
      K[i + 3][j + 3] = val;
    }
  }
  return K;
}

/**
 * Elemento viga Euler-Bernoulli 2D (4 DOF: v₁, θ₁, v₂, θ₂)
 * Flexión transversal sin considerar deformación por corte.
 *
 * Ke = (EI/L³) ×
 * | 12    6L    -12   6L   |
 * | 6L    4L²   -6L   2L²  |
 * | -12   -6L   12    -6L  |
 * | 6L    2L²   -6L   4L²  |
 *
 * Ref [13] Euler 1744, [5] Logan §4.1, [11] Hughes §4.3
 *
 * @param E - Módulo de Young [Pa]
 * @param I - Momento de inercia [m⁴]
 * @param L - Longitud [m]
 */
export function beamStiffnessEulerBernoulli(E: number, I: number, L: number): number[][] {
  const c = (E * I) / (L * L * L);
  const L2 = L * L;
  return [
    [12 * c,    6 * L * c,    -12 * c,    6 * L * c  ],
    [6 * L * c, 4 * L2 * c,   -6 * L * c, 2 * L2 * c ],
    [-12 * c,   -6 * L * c,   12 * c,     -6 * L * c ],
    [6 * L * c, 2 * L2 * c,   -6 * L * c, 4 * L2 * c ],
  ];
}

/**
 * Elemento viga Timoshenko 2D (incluye deformación por corte)
 * Factor φ = 12EI / (κAGL²)
 *
 * Ref [3] Bathe §5.4, [11] Hughes §4.5
 *
 * @param E - Módulo de Young [Pa]
 * @param G - Módulo de corte [Pa]
 * @param I - Momento de inercia [m⁴]
 * @param A - Área de sección [m²]
 * @param L - Longitud [m]
 * @param kappa - Factor de corrección de corte (5/6 para rectangular, 0.9 para circular)
 */
export function beamStiffnessTimoshenko(
  E: number, G: number, I: number, A: number, L: number, kappa: number = 5 / 6
): number[][] {
  const phi = (12 * E * I) / (kappa * A * G * L * L);
  const c = (E * I) / (L * L * L * (1 + phi));
  const L2 = L * L;
  return [
    [12 * c,            6 * L * c,            -12 * c,            6 * L * c         ],
    [6 * L * c,         (4 + phi) * L2 * c,   -6 * L * c,        (2 - phi) * L2 * c],
    [-12 * c,           -6 * L * c,           12 * c,             -6 * L * c        ],
    [6 * L * c,         (2 - phi) * L2 * c,   -6 * L * c,        (4 + phi) * L2 * c],
  ];
}

/**
 * Elemento triangular CST (Constant Strain Triangle) — Esfuerzo plano
 * 3 nodos, 6 DOF (u₁,v₁, u₂,v₂, u₃,v₃)
 *
 * B = (1/2A) × [y₂-y₃, 0, y₃-y₁, 0, y₁-y₂, 0;
 *               0, x₃-x₂, 0, x₁-x₃, 0, x₂-x₁;
 *               x₃-x₂, y₂-y₃, x₁-x₃, y₃-y₁, x₂-x₁, y₁-y₂]
 *
 * K = t·A·Bᵀ·D·B
 *
 * Ref [2] Zienkiewicz §6.2, [5] Logan §6.2, [4] Cook §3.4
 *
 * @param nodes - 3 vértices [[x,y], [x,y], [x,y]]
 * @param D - Matriz constitutiva 3×3
 * @param thickness - Espesor [m]
 * @returns Ke (6×6) y B (3×6)
 */
export function cstElement(
  nodes: [[number, number], [number, number], [number, number]],
  D: number[][],
  thickness: number = 1
): { K: number[][]; B: number[][] } {
  const [[x1, y1], [x2, y2], [x3, y3]] = nodes;

  // Área del triángulo: A = ½|x₁(y₂-y₃) + x₂(y₃-y₁) + x₃(y₁-y₂)|
  const A2 = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
  const area = Math.abs(A2) / 2;

  // Matriz B de deformación-desplazamiento
  const B = [
    [(y2 - y3) / A2, 0,              (y3 - y1) / A2, 0,              (y1 - y2) / A2, 0             ],
    [0,              (x3 - x2) / A2, 0,              (x1 - x3) / A2, 0,              (x2 - x1) / A2],
    [(x3 - x2) / A2, (y2 - y3) / A2, (x1 - x3) / A2, (y3 - y1) / A2, (x2 - x1) / A2, (y1 - y2) / A2],
  ];

  // K = t·A·Bᵀ·D·B
  const K = matMul(matMul(transpose(B), D), B).map(row => row.map(v => v * thickness * area));

  return { K, B };
}

/**
 * Elemento tetraédrico lineal 3D (4 nodos, 12 DOF)
 * Funciones de forma lineales: N_i = (a_i + b_i·x + c_i·y + d_i·z) / (6V)
 *
 * V = (1/6)|det[x₂-x₁, y₂-y₁, z₂-z₁; x₃-x₁, y₃-y₁, z₃-y₁; x₄-x₁, y₄-y₁, z₄-z₁]|
 *
 * Ref [2] Zienkiewicz §8.3, [3] Bathe §5.6, [12] Reddy §10.3
 *
 * @param nodes - 4 vértices [[x,y,z], ...]
 * @param D - Matriz constitutiva 6×6
 * @returns Ke 12×12
 */
export function tet4Element(
  nodes: [[number, number, number], [number, number, number],
          [number, number, number], [number, number, number]],
  D: number[][]
): { K: number[][]; B: number[][]; volume: number } {
  const [n1, n2, n3, n4] = nodes;

  // Jacobiano: vectores de arista desde nodo 1
  const dx = [
    [n2[0] - n1[0], n3[0] - n1[0], n4[0] - n1[0]],
    [n2[1] - n1[1], n3[1] - n1[1], n4[1] - n1[1]],
    [n2[2] - n1[2], n3[2] - n1[2], n4[2] - n1[2]],
  ];

  // Determinante del Jacobiano = 6V
  const detJ = dx[0][0] * (dx[1][1] * dx[2][2] - dx[1][2] * dx[2][1])
             - dx[0][1] * (dx[1][0] * dx[2][2] - dx[1][2] * dx[2][0])
             + dx[0][2] * (dx[1][0] * dx[2][1] - dx[1][1] * dx[2][0]);

  const volume = Math.abs(detJ) / 6;
  const sign = detJ > 0 ? 1 : -1;

  // Inversa del Jacobiano × 6V (para evitar divisiones)
  const invJ = [
    [sign * (dx[1][1] * dx[2][2] - dx[1][2] * dx[2][1]),
     sign * (dx[0][2] * dx[2][1] - dx[0][1] * dx[2][2]),
     sign * (dx[0][1] * dx[1][2] - dx[0][2] * dx[1][1])],
    [sign * (dx[1][2] * dx[2][0] - dx[1][0] * dx[2][2]),
     sign * (dx[0][0] * dx[2][2] - dx[0][2] * dx[2][0]),
     sign * (dx[0][2] * dx[1][0] - dx[0][0] * dx[1][2])],
    [sign * (dx[1][0] * dx[2][1] - dx[1][1] * dx[2][0]),
     sign * (dx[0][1] * dx[2][0] - dx[0][0] * dx[2][1]),
     sign * (dx[0][0] * dx[1][1] - dx[0][1] * dx[1][0])],
  ];

  const dJ = Math.abs(detJ);

  // Derivadas de funciones de forma: ∂N_i/∂x_j
  // N1 = 1 - ξ - η - ζ, N2 = ξ, N3 = η, N4 = ζ
  const dN = [
    [-invJ[0][0] - invJ[1][0] - invJ[2][0], invJ[0][0], invJ[1][0], invJ[2][0]],
    [-invJ[0][1] - invJ[1][1] - invJ[2][1], invJ[0][1], invJ[1][1], invJ[2][1]],
    [-invJ[0][2] - invJ[1][2] - invJ[2][2], invJ[0][2], invJ[1][2], invJ[2][2]],
  ];

  // Normalizar derivadas: dividir por detJ
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) {
      dN[i][j] /= dJ;
    }
  }

  // Matriz B (6×12)
  const B: number[][] = Array.from({ length: 6 }, () => new Array(12).fill(0));
  for (let n = 0; n < 4; n++) {
    const col = n * 3;
    B[0][col]     = dN[0][n];                         // ε_xx = ∂u/∂x
    B[1][col + 1] = dN[1][n];                         // ε_yy = ∂v/∂y
    B[2][col + 2] = dN[2][n];                         // ε_zz = ∂w/∂z
    B[3][col]     = dN[1][n]; B[3][col + 1] = dN[0][n]; // γ_xy
    B[4][col + 1] = dN[2][n]; B[4][col + 2] = dN[1][n]; // γ_yz
    B[5][col]     = dN[2][n]; B[5][col + 2] = dN[0][n]; // γ_xz
  }

  // K = V · Bᵀ · D · B  (integración exacta para Tet4: 1 punto de Gauss en centroide)
  const BtD = matMul(transpose(B), D);
  const K = matMul(BtD, B).map(row => row.map(v => v * volume));

  return { K, B, volume };
}

// ═══════════════════════════════════════════════════════════════
// 4. TRANSFERENCIA DE CALOR
// ═══════════════════════════════════════════════════════════════
// Ref [6] Incropera, [16] Fourier

/**
 * Ley de Fourier de conducción de calor: q = -k·∇T
 * Flujo de calor [W/m²] = conductividad × gradiente de temperatura.
 * Ref [16] Fourier 1822, [6] Incropera §2.1
 */
export function fourierConduction(k: number, dTdx: number): number {
  return -k * dTdx;
}

/**
 * Ley de enfriamiento de Newton: q = h·(T_s - T_∞)
 * Convección superficial.
 * Ref [6] Incropera §1.2
 *
 * @param h - Coeficiente de convección [W/(m²·K)]
 * @param Ts - Temperatura de superficie [K]
 * @param Tinf - Temperatura del fluido [K]
 */
export function newtonConvection(h: number, Ts: number, Tinf: number): number {
  return h * (Ts - Tinf);
}

/**
 * Ley de Stefan-Boltzmann: q = εσ(T_s⁴ - T_∞⁴)
 * Radiación de cuerpo gris.
 * Ref [6] Incropera §1.2.3
 *
 * @param emissivity - Emisividad ε (0-1)
 * @param Ts - Temperatura superficie [K]
 * @param Tsurr - Temperatura entorno [K]
 */
export const STEFAN_BOLTZMANN = 5.670374419e-8; // σ [W/(m²·K⁴)]

export function radiationHeat(emissivity: number, Ts: number, Tsurr: number): number {
  return emissivity * STEFAN_BOLTZMANN * (Ts ** 4 - Tsurr ** 4);
}

/**
 * Resistencia térmica en serie para pared plana multicapa:
 * R_total = Σ(L_i / (k_i · A))
 * Ref [6] Incropera §3.1
 *
 * @param layers - Array de { thickness: m, conductivity: W/(m·K) }
 * @param area - Área de sección [m²]
 */
export function thermalResistanceSeries(
  layers: { thickness: number; conductivity: number }[],
  area: number
): number {
  return layers.reduce((sum, l) => sum + l.thickness / (l.conductivity * area), 0);
}

/**
 * Resistencia térmica por convección: R_conv = 1 / (h·A)
 * Ref [6] Incropera §3.1
 */
export function convectionResistance(h: number, area: number): number {
  return 1 / (h * area);
}

/**
 * Aleta rectangular — eficiencia y transferencia de calor
 * η_f = tanh(mL) / (mL), donde m = √(hP/(kA_c))
 * Ref [6] Incropera §3.6
 *
 * @param h - Coeficiente de convección [W/(m²·K)]
 * @param k - Conductividad del material de aleta [W/(m·K)]
 * @param L - Longitud de aleta [m]
 * @param t - Espesor de aleta [m]
 * @param w - Ancho de aleta [m]
 */
export function finEfficiency(h: number, k: number, L: number, t: number, w: number) {
  const Ac = t * w;      // Área de sección transversal
  const P = 2 * (t + w); // Perímetro
  const m = Math.sqrt(h * P / (k * Ac));
  const mL = m * L;
  const eta = mL > 0 ? Math.tanh(mL) / mL : 1;
  const Afin = P * L;
  const qMax = h * Afin;

  return { efficiency: eta, m, heatTransfer: eta * qMax };
}

/**
 * Elemento de conducción térmica — Tetraedro lineal 3D
 * Ke_thermal = k · V · Bᵀ·B  (análogo a rigidez pero para T en vez de u)
 *
 * Ecuación: ∇·(k∇T) + Q = ρc_p ∂T/∂t
 * Estado estacionario sin generación: ∇·(k∇T) = 0 → K·T = f
 *
 * Ref [6] Incropera cap.4, [2] Zienkiewicz §18.2
 *
 * @param nodes - 4 vértices del tetraedro
 * @param k - Conductividad térmica [W/(m·K)]
 * @returns Ke (4×4) y volume
 */
export function thermalTet4(
  nodes: [[number, number, number], [number, number, number],
          [number, number, number], [number, number, number]],
  k: number
): { K: number[][]; volume: number } {
  const [n1, n2, n3, n4] = nodes;

  const dx = [
    [n2[0] - n1[0], n3[0] - n1[0], n4[0] - n1[0]],
    [n2[1] - n1[1], n3[1] - n1[1], n4[1] - n1[1]],
    [n2[2] - n1[2], n3[2] - n1[2], n4[2] - n1[2]],
  ];

  const detJ = dx[0][0] * (dx[1][1] * dx[2][2] - dx[1][2] * dx[2][1])
             - dx[0][1] * (dx[1][0] * dx[2][2] - dx[1][2] * dx[2][0])
             + dx[0][2] * (dx[1][0] * dx[2][1] - dx[1][1] * dx[2][0]);

  const volume = Math.abs(detJ) / 6;
  const sign = detJ > 0 ? 1 : -1;

  const invJ = [
    [sign * (dx[1][1] * dx[2][2] - dx[1][2] * dx[2][1]),
     sign * (dx[0][2] * dx[2][1] - dx[0][1] * dx[2][2]),
     sign * (dx[0][1] * dx[1][2] - dx[0][2] * dx[1][1])],
    [sign * (dx[1][2] * dx[2][0] - dx[1][0] * dx[2][2]),
     sign * (dx[0][0] * dx[2][2] - dx[0][2] * dx[2][0]),
     sign * (dx[0][2] * dx[1][0] - dx[0][0] * dx[1][2])],
    [sign * (dx[1][0] * dx[2][1] - dx[1][1] * dx[2][0]),
     sign * (dx[0][1] * dx[2][0] - dx[0][0] * dx[2][1]),
     sign * (dx[0][0] * dx[1][1] - dx[0][1] * dx[1][0])],
  ];

  const dJ = Math.abs(detJ);

  // Gradientes de funciones de forma (3×4)
  const dN = [
    [(-invJ[0][0] - invJ[1][0] - invJ[2][0]) / dJ, invJ[0][0] / dJ, invJ[1][0] / dJ, invJ[2][0] / dJ],
    [(-invJ[0][1] - invJ[1][1] - invJ[2][1]) / dJ, invJ[0][1] / dJ, invJ[1][1] / dJ, invJ[2][1] / dJ],
    [(-invJ[0][2] - invJ[1][2] - invJ[2][2]) / dJ, invJ[0][2] / dJ, invJ[1][2] / dJ, invJ[2][2] / dJ],
  ];

  // K = k · V · dNᵀ · dN
  const K: number[][] = Array.from({ length: 4 }, () => new Array(4).fill(0));
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let d = 0; d < 3; d++) {
        sum += dN[d][i] * dN[d][j];
      }
      K[i][j] = k * volume * sum;
    }
  }

  return { K, volume };
}

/**
 * Matriz de capacitancia térmica (masa) para Tet4
 * C = ρ·c_p·V/20 × [2,1,1,1; 1,2,1,1; 1,1,2,1; 1,1,1,2]
 *
 * Ref [2] Zienkiewicz §18.3, [6] Incropera cap.5
 */
export function thermalCapacitanceTet4(
  volume: number, density: number, specificHeat: number
): number[][] {
  const c = (density * specificHeat * volume) / 20;
  return [
    [2 * c, c,     c,     c    ],
    [c,     2 * c, c,     c    ],
    [c,     c,     2 * c, c    ],
    [c,     c,     c,     2 * c],
  ];
}

// ═══════════════════════════════════════════════════════════════
// 5. MECÁNICA DE FLUIDOS (Simplificada para CFD básico)
// ═══════════════════════════════════════════════════════════════
// Ref [7] Cengel, [15] Navier

/**
 * Ecuación de Bernoulli: p₁/ρ + V₁²/2 + gz₁ = p₂/ρ + V₂²/2 + gz₂
 * Flujo incompresible, no viscoso, estacionario.
 * Ref [7] Cengel §5.4
 *
 * @param p1 - Presión en punto 1 [Pa]
 * @param v1 - Velocidad en punto 1 [m/s]
 * @param z1 - Elevación punto 1 [m]
 * @param p2_or_null - Presión en punto 2 (null para calcular)
 * @param v2 - Velocidad en punto 2 [m/s]
 * @param z2 - Elevación punto 2 [m]
 * @param rho - Densidad del fluido [kg/m³]
 * @param g - Gravedad [m/s²]
 */
export function bernoulli(
  p1: number, v1: number, z1: number,
  v2: number, z2: number,
  rho: number = 1000, g: number = 9.81
): number {
  // Calcula p2
  return p1 + rho * (v1 * v1 - v2 * v2) / 2 + rho * g * (z1 - z2);
}

/**
 * Número de Reynolds: Re = ρVD/μ = VD/ν
 * Caracteriza flujo laminar (Re < 2300) vs turbulento (Re > 4000).
 * Ref [7] Cengel §8.1
 */
export function reynoldsNumber(
  velocity: number, diameter: number, kinematicViscosity: number
): number {
  return (velocity * diameter) / kinematicViscosity;
}

/**
 * Pérdida por fricción en tubería (Darcy-Weisbach):
 * h_f = f · (L/D) · (V²/2g)
 * Ref [7] Cengel §8.5
 *
 * @param f - Factor de fricción de Darcy
 * @param L - Longitud de tubería [m]
 * @param D - Diámetro [m]
 * @param V - Velocidad media [m/s]
 * @param g - Gravedad [m/s²]
 */
export function darcyWeisbachLoss(
  f: number, L: number, D: number, V: number, g: number = 9.81
): number {
  return f * (L / D) * (V * V) / (2 * g);
}

/**
 * Factor de fricción — ecuación de Colebrook-White (implícita, resuelta iterativamente):
 * 1/√f = -2·log₁₀(ε/(3.7D) + 2.51/(Re·√f))
 *
 * Aproximación de Swamee-Jain (explícita, error < 1%):
 * f = 0.25 / [log₁₀(ε/(3.7D) + 5.74/Re⁰·⁹)]²
 *
 * Ref [7] Cengel §8.5
 */
export function frictionFactorSwameeJain(
  Re: number, epsilon: number, D: number
): number {
  if (Re < 2300) return 64 / Re; // Laminar — Hagen-Poiseuille
  const logArg = epsilon / (3.7 * D) + 5.74 / (Re ** 0.9);
  const logVal = Math.log10(logArg);
  return 0.25 / (logVal * logVal);
}

/**
 * Coeficiente de convección para flujo interno en tubo (correlación Dittus-Boelter):
 * Nu = 0.023 · Re^0.8 · Pr^n  (n=0.4 calentamiento, n=0.3 enfriamiento)
 * h = Nu · k / D
 *
 * Válida para: Re > 10000, 0.6 < Pr < 160, L/D > 10
 * Ref [6] Incropera §8.5
 */
export function dittusBoelter(
  Re: number, Pr: number, k: number, D: number, heating: boolean = true
): number {
  const n = heating ? 0.4 : 0.3;
  const Nu = 0.023 * Re ** 0.8 * Pr ** n;
  return Nu * k / D;
}

// ═══════════════════════════════════════════════════════════════
// 6. VIBRACIONES Y DINÁMICA MODAL
// ═══════════════════════════════════════════════════════════════
// Ref [3] Bathe cap.9-12, [8] Shigley cap.17

/**
 * Frecuencia natural de sistema 1-DOF: ω_n = √(k/m), f_n = ω_n / (2π)
 * Ref [8] Shigley §17.1
 */
export function naturalFrequency(k: number, m: number): { omega: number; freq: number } {
  const omega = Math.sqrt(k / m);
  return { omega, freq: omega / (2 * Math.PI) };
}

/**
 * Respuesta de sistema amortiguado 1-DOF
 * ζ = c / (2√(km)) — razón de amortiguamiento
 * ω_d = ω_n √(1-ζ²) — frecuencia amortiguada
 *
 * Ref [3] Bathe §9.2, [8] Shigley §17.2
 */
export function dampedFrequency(
  k: number, m: number, c: number
): { zeta: number; omegaN: number; omegaD: number; freqD: number } {
  const omegaN = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  const omegaD = omegaN * Math.sqrt(Math.max(0, 1 - zeta * zeta));
  return { zeta, omegaN, omegaD, freqD: omegaD / (2 * Math.PI) };
}

/**
 * Frecuencia natural de viga simplemente apoyada (modo n):
 * f_n = (n²π²/(2L²)) · √(EI/(ρA))
 *
 * Ref [3] Bathe §11.3, [9] Roark Tabla 16.1
 */
export function beamNaturalFrequency(
  n: number, L: number, E: number, I: number, rho: number, A: number
): number {
  return (n * n * Math.PI * Math.PI / (2 * L * L)) * Math.sqrt(E * I / (rho * A));
}

/**
 * Frecuencia de pandeo crítica de Euler:
 * P_cr = (n²π²EI) / (Le²)
 *
 * Le = L·C, donde C depende de condiciones de apoyo:
 *   - Empotrado-libre: C = 2.0
 *   - Articulado-articulado: C = 1.0
 *   - Empotrado-articulado: C = 0.7
 *   - Empotrado-empotrado: C = 0.5
 *
 * Ref [13] Euler 1744, [10] Beer §10.2, [8] Shigley §4.10
 */
export function eulerBucklingLoad(
  E: number, I: number, L: number,
  endCondition: 'fixed-free' | 'pinned-pinned' | 'fixed-pinned' | 'fixed-fixed' = 'pinned-pinned'
): number {
  const Cmap: Record<string, number> = {
    'fixed-free': 2.0,
    'pinned-pinned': 1.0,
    'fixed-pinned': 0.7,
    'fixed-fixed': 0.5,
  };
  const Le = L * Cmap[endCondition];
  return (Math.PI * Math.PI * E * I) / (Le * Le);
}

// ═══════════════════════════════════════════════════════════════
// 7. DISEÑO MECÁNICO — Fórmulas de Shigley/Roark
// ═══════════════════════════════════════════════════════════════
// Ref [8] Shigley, [9] Roark

/**
 * Concentración de esfuerzos: σ_max = K_t · σ_nom
 * Ref [8] Shigley §3.6, [9] Roark cap.17
 */
export function stressConcentration(Kt: number, nominalStress: number): number {
  return Kt * nominalStress;
}

/**
 * Factor K_t para placa con agujero central bajo tensión:
 * K_t ≈ 3.0 - 3.13(d/w) + 3.66(d/w)² - 1.53(d/w)³  (para d/w ≤ 0.6)
 * Ref [9] Roark Tabla 17.1, [8] Shigley Fig. A-12
 */
export function ktPlateWithHole(d: number, w: number): number {
  const r = d / w;
  return 3.0 - 3.13 * r + 3.66 * r * r - 1.53 * r * r * r;
}

/**
 * Esfuerzo en cilindro de pared gruesa (ecuaciones de Lamé):
 * σ_r = (p_i·r_i² - p_o·r_o²)/(r_o²-r_i²) - (p_i-p_o)·r_i²·r_o²/((r_o²-r_i²)·r²)
 * σ_θ = (p_i·r_i² - p_o·r_o²)/(r_o²-r_i²) + (p_i-p_o)·r_i²·r_o²/((r_o²-r_i²)·r²)
 *
 * Ref [9] Roark §13.1, [10] Beer §7.9
 */
export function lameThickCylinder(
  ri: number, ro: number, pi: number, po: number, r: number
): { sigmaR: number; sigmaTheta: number } {
  const ri2 = ri * ri, ro2 = ro * ro, r2 = r * r;
  const denom = ro2 - ri2;
  const A = (pi * ri2 - po * ro2) / denom;
  const B = (pi - po) * ri2 * ro2 / denom;

  return {
    sigmaR: A - B / r2,
    sigmaTheta: A + B / r2,
  };
}

/**
 * Deflexión máxima de viga simplemente apoyada con carga puntual central:
 * δ_max = PL³ / (48EI)
 * Ref [9] Roark Tabla 8.1, [10] Beer §9.3
 */
export function beamDeflectionCenterLoad(P: number, L: number, E: number, I: number): number {
  return (P * L * L * L) / (48 * E * I);
}

/**
 * Deflexión máxima de viga en voladizo con carga puntual en extremo:
 * δ_max = PL³ / (3EI)
 * Ref [9] Roark Tabla 8.1
 */
export function cantileverDeflection(P: number, L: number, E: number, I: number): number {
  return (P * L * L * L) / (3 * E * I);
}

/**
 * Momento de inercia — secciones comunes
 * Ref [10] Beer Apéndice C
 */
export const momentOfInertia = {
  /** Rectángulo: I = bh³/12 */
  rectangle: (b: number, h: number) => (b * h * h * h) / 12,
  /** Círculo: I = πd⁴/64 */
  circle: (d: number) => (Math.PI * d ** 4) / 64,
  /** Tubo circular: I = π(D⁴-d⁴)/64 */
  hollowCircle: (D: number, d: number) => (Math.PI * (D ** 4 - d ** 4)) / 64,
  /** I-beam: I = (B·H³ - b·h³)/12  (B=ancho total, H=alto total, b=ancho alma, h=alto entre alas) */
  iBeam: (B: number, H: number, b: number, h: number) => (B * H ** 3 - b * h ** 3) / 12,
  /** C-channel: aproximación */
  cChannel: (B: number, H: number, tw: number, tf: number) =>
    (B * H ** 3 - (B - tw) * (H - 2 * tf) ** 3) / 12,
};

/**
 * Área de sección transversal — secciones comunes
 */
export const crossSectionArea = {
  rectangle: (b: number, h: number) => b * h,
  circle: (d: number) => (Math.PI * d * d) / 4,
  hollowCircle: (D: number, d: number) => (Math.PI * (D * D - d * d)) / 4,
  iBeam: (B: number, H: number, tw: number, tf: number) => 2 * B * tf + (H - 2 * tf) * tw,
};

/**
 * Fatiga — Diagrama S-N (Basquin):
 * S = a · N^b
 * Para acero: Se' ≈ 0.5·Su (Si Su ≤ 1400 MPa)
 *
 * Ref [8] Shigley §6.7
 */
export function basquinSN(Su: number, Nf: number): number {
  const Se = 0.5 * Su; // Límite de resistencia a la fatiga
  if (Nf >= 1e6) return Se;
  const f = 0.9; // Factor de corrección
  const a = (f * Su) ** 2 / Se;
  const b = -Math.log10(f * Su / Se) / 3;
  return a * Nf ** b;
}

/**
 * Criterio de Goodman modificado (fatiga con esfuerzo medio):
 * σ_a/Se + σ_m/Su = 1/n
 * n = 1 / (σ_a/Se + σ_m/Su)
 *
 * Ref [8] Shigley §6.12
 */
export function goodmanFatigueSafety(
  sigmaA: number, sigmaM: number, Se: number, Su: number
): number {
  const sum = sigmaA / Se + sigmaM / Su;
  return sum > 0 ? 1 / sum : Infinity;
}

// ═══════════════════════════════════════════════════════════════
// 8. ESFUERZOS TÉRMICOS
// ═══════════════════════════════════════════════════════════════
// Ref [1] Timoshenko §14, [6] Incropera cap.2

/**
 * Esfuerzo térmico en barra restringida: σ = -E·α·ΔT
 * Ref [1] Timoshenko §14
 */
export function thermalStressConstrained(E: number, alpha: number, deltaT: number): number {
  return -E * alpha * deltaT;
}

/**
 * Deformación térmica libre: ε = α·ΔT, δ = α·ΔT·L
 * Ref [1] Timoshenko §14
 */
export function thermalExpansionFree(alpha: number, deltaT: number, L: number) {
  return { strain: alpha * deltaT, elongation: alpha * deltaT * L };
}

// ═══════════════════════════════════════════════════════════════
// 9. SOLVER DE SISTEMA LINEAL — Para FEM: K·u = f
// ═══════════════════════════════════════════════════════════════
// Ref [3] Bathe §8, [11] Hughes §3

/**
 * Resuelve K·u = f por eliminación gaussiana con pivoteo parcial.
 * Para sistemas densos pequeños-medianos.
 *
 * Para sistemas grandes (>1000 DOF) en producción se usaría
 * gradiente conjugado precondicionado (PCG, Ref [3] Bathe §8.5)
 *
 * @param K - Matriz de rigidez (n×n)
 * @param f - Vector de fuerzas (n)
 * @returns u - Vector de desplazamientos (n)
 */
export function solveLinearSystem(K: number[][], f: number[]): number[] {
  const n = f.length;

  // Copiar para no mutar originales
  const A = K.map(row => [...row]);
  const b = [...f];

  // Eliminación gaussiana con pivoteo parcial
  for (let col = 0; col < n; col++) {
    // Pivoteo parcial
    let maxVal = Math.abs(A[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > maxVal) {
        maxVal = Math.abs(A[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-14) {
      throw new Error(`Matriz singular o mal condicionada (pivote ${col} ≈ 0)`);
    }

    // Intercambiar filas si es necesario
    if (maxRow !== col) {
      [A[col], A[maxRow]] = [A[maxRow], A[col]];
      [b[col], b[maxRow]] = [b[maxRow], b[col]];
    }

    // Eliminación
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      for (let j = col; j < n; j++) {
        A[row][j] -= factor * A[col][j];
      }
      b[row] -= factor * b[col];
    }
  }

  // Sustitución hacia atrás
  const u = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= A[i][j] * u[j];
    }
    u[i] = sum / A[i][i];
  }

  return u;
}

/**
 * Gradiente Conjugado Precondicionado (Jacobi) — Para matrices sparse grandes
 * Resuelve K·u = f iterativamente.
 *
 * Ref [3] Bathe §8.5, [11] Hughes §3.4
 *
 * @param K - Matriz (n×n)
 * @param f - Vector RHS (n)
 * @param tol - Tolerancia de convergencia
 * @param maxIter - Iteraciones máximas
 */
export function conjugateGradient(
  K: number[][], f: number[], tol: number = 1e-8, maxIter: number = 5000
): { u: number[]; iterations: number; residual: number } {
  const n = f.length;
  const u = new Array(n).fill(0);

  // Precondicionador Jacobi: M = diag(K)
  const Minv = K.map((row, i) => 1 / Math.max(Math.abs(row[i]), 1e-20));

  // r = f - K·u (u=0 → r = f)
  const r = [...f];
  // z = M⁻¹·r
  const z = r.map((ri, i) => ri * Minv[i]);
  const p = [...z];

  let rz = dot(r, z);

  for (let iter = 0; iter < maxIter; iter++) {
    // α = rᵀz / pᵀKp
    const Kp = matVecMul(K, p);
    const pKp = dot(p, Kp);

    if (Math.abs(pKp) < 1e-20) break;

    const alpha = rz / pKp;

    // u = u + α·p
    for (let i = 0; i < n; i++) u[i] += alpha * p[i];
    // r = r - α·K·p
    for (let i = 0; i < n; i++) r[i] -= alpha * Kp[i];

    const residualNorm = Math.sqrt(dot(r, r));
    if (residualNorm < tol) {
      return { u, iterations: iter + 1, residual: residualNorm };
    }

    // z = M⁻¹·r
    for (let i = 0; i < n; i++) z[i] = r[i] * Minv[i];

    const rzNew = dot(r, z);
    const beta = rzNew / rz;
    rz = rzNew;

    // p = z + β·p
    for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i];
  }

  return { u, iterations: maxIter, residual: Math.sqrt(dot(r, r)) };
}

// ═══════════════════════════════════════════════════════════════
// 10. MALLADO — Generador de malla tetraédrica
// ═══════════════════════════════════════════════════════════════
// Ref [2] Zienkiewicz cap.14 (Mesh generation), Delaunay 1934

export interface TetrahedralMesh {
  /** Coordenadas de nodos: [x₁,y₁,z₁, x₂,y₂,z₂, ...] */
  nodes: Float64Array;
  /** Conectividad de tetraedros: [n₁,n₂,n₃,n₄, ...] (índices basados en 0) */
  elements: Uint32Array;
  /** Nodos en la superficie (para condiciones de contorno) */
  surfaceNodes: Set<number>;
  nodeCount: number;
  elementCount: number;
}

/**
 * Genera malla tetraédrica estructurada a partir de un bounding box.
 * Subdivide el espacio en cubos, y cada cubo en 5 tetraedros.
 * Método simple pero robusto para prototipos de FEA.
 *
 * En producción se reemplazaría con Delaunay 3D o avanzado
 * (TetGen, CGAL, etc.)
 *
 * Ref [2] Zienkiewicz §14.2 (Structured mesh generation)
 *
 * @param min - Esquina mínima [x,y,z]
 * @param max - Esquina máxima [x,y,z]
 * @param divisions - Número de divisiones por eje [nx, ny, nz]
 */
export function generateStructuredTetMesh(
  min: [number, number, number],
  max: [number, number, number],
  divisions: [number, number, number]
): TetrahedralMesh {
  const [nx, ny, nz] = divisions;
  const dx = (max[0] - min[0]) / nx;
  const dy = (max[1] - min[1]) / ny;
  const dz = (max[2] - min[2]) / nz;

  const numNodes = (nx + 1) * (ny + 1) * (nz + 1);
  const numElements = nx * ny * nz * 5;

  const nodes = new Float64Array(numNodes * 3);
  const elements = new Uint32Array(numElements * 4);
  const surfaceNodes = new Set<number>();

  // Generar nodos
  let nodeIdx = 0;
  for (let iz = 0; iz <= nz; iz++) {
    for (let iy = 0; iy <= ny; iy++) {
      for (let ix = 0; ix <= nx; ix++) {
        const n = nodeIdx * 3;
        nodes[n]     = min[0] + ix * dx;
        nodes[n + 1] = min[1] + iy * dy;
        nodes[n + 2] = min[2] + iz * dz;

        // Marcar nodos de superficie (bordes del bounding box)
        if (ix === 0 || ix === nx || iy === 0 || iy === ny || iz === 0 || iz === nz) {
          surfaceNodes.add(nodeIdx);
        }
        nodeIdx++;
      }
    }
  }

  // Función para obtener índice de nodo a partir de coordenadas de grid
  const nodeIndex = (ix: number, iy: number, iz: number) =>
    iz * (ny + 1) * (nx + 1) + iy * (nx + 1) + ix;

  // Generar tetraedros — 5 tets por hexaedro
  let elemIdx = 0;
  for (let iz = 0; iz < nz; iz++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        // 8 esquinas del hexaedro
        const n0 = nodeIndex(ix, iy, iz);
        const n1 = nodeIndex(ix + 1, iy, iz);
        const n2 = nodeIndex(ix + 1, iy + 1, iz);
        const n3 = nodeIndex(ix, iy + 1, iz);
        const n4 = nodeIndex(ix, iy, iz + 1);
        const n5 = nodeIndex(ix + 1, iy, iz + 1);
        const n6 = nodeIndex(ix + 1, iy + 1, iz + 1);
        const n7 = nodeIndex(ix, iy + 1, iz + 1);

        // 5 tetraedros por hexaedro (partición tipo Kuhn)
        const tets = [
          [n0, n1, n3, n4],
          [n1, n2, n3, n6],
          [n1, n4, n5, n6],
          [n3, n4, n6, n7],
          [n1, n3, n4, n6],
        ];

        for (const tet of tets) {
          const e = elemIdx * 4;
          elements[e]     = tet[0];
          elements[e + 1] = tet[1];
          elements[e + 2] = tet[2];
          elements[e + 3] = tet[3];
          elemIdx++;
        }
      }
    }
  }

  return { nodes, elements, surfaceNodes, nodeCount: numNodes, elementCount: numElements };
}

// ═══════════════════════════════════════════════════════════════
// 11. GEOMETRÍAS DE SECCIÓN (para vigas y columnas)
// ═══════════════════════════════════════════════════════════════
// Ref [10] Beer Apéndice C, [8] Shigley Apéndice A

export interface SectionProperties {
  area: number;            // A [m²]
  Ixx: number;             // Momento de inercia [m⁴]
  Iyy: number;
  Sx: number;              // Módulo de sección [m³] — S = I/c
  Sy: number;
  rx: number;              // Radio de giro [m] — r = √(I/A)
  ry: number;
  J: number;               // Momento polar de inercia [m⁴]
}

export function rectangleSection(b: number, h: number): SectionProperties {
  const A = b * h;
  const Ixx = (b * h ** 3) / 12;
  const Iyy = (h * b ** 3) / 12;
  return {
    area: A, Ixx, Iyy,
    Sx: Ixx / (h / 2), Sy: Iyy / (b / 2),
    rx: Math.sqrt(Ixx / A), ry: Math.sqrt(Iyy / A),
    J: (b * h * (b * b + h * h)) / 12,
  };
}

export function circularSection(d: number): SectionProperties {
  const A = (Math.PI * d * d) / 4;
  const I = (Math.PI * d ** 4) / 64;
  return {
    area: A, Ixx: I, Iyy: I,
    Sx: I / (d / 2), Sy: I / (d / 2),
    rx: d / 4, ry: d / 4,
    J: (Math.PI * d ** 4) / 32,
  };
}

export function hollowCircularSection(D: number, d: number): SectionProperties {
  const A = (Math.PI * (D * D - d * d)) / 4;
  const I = (Math.PI * (D ** 4 - d ** 4)) / 64;
  return {
    area: A, Ixx: I, Iyy: I,
    Sx: I / (D / 2), Sy: I / (D / 2),
    rx: Math.sqrt(I / A), ry: Math.sqrt(I / A),
    J: (Math.PI * (D ** 4 - d ** 4)) / 32,
  };
}

export function iBeamSection(
  B: number, H: number, tw: number, tf: number
): SectionProperties {
  const A = 2 * B * tf + (H - 2 * tf) * tw;
  const Ixx = (B * H ** 3 - (B - tw) * (H - 2 * tf) ** 3) / 12;
  const Iyy = (2 * tf * B ** 3 + (H - 2 * tf) * tw ** 3) / 12;
  return {
    area: A, Ixx, Iyy,
    Sx: Ixx / (H / 2), Sy: Iyy / (B / 2),
    rx: Math.sqrt(Ixx / A), ry: Math.sqrt(Iyy / A),
    J: (2 * B * tf ** 3 + (H - 2 * tf) * tw ** 3) / 3, // Aproximación sección abierta
  };
}

// ═══════════════════════════════════════════════════════════════
// 12. UNIDADES Y CONSTANTES FÍSICAS
// ═══════════════════════════════════════════════════════════════

export const CONSTANTS = {
  /** Aceleración gravitacional estándar [m/s²] */
  g: 9.80665,
  /** Constante de Boltzmann [J/K] */
  kB: 1.380649e-23,
  /** Constante de Stefan-Boltzmann [W/(m²·K⁴)] */
  sigma: 5.670374419e-8,
  /** Constante universal de gases [J/(mol·K)] */
  R: 8.314462618,
  /** Número de Avogadro [1/mol] */
  NA: 6.02214076e23,
  /** Presión atmosférica estándar [Pa] */
  atm: 101325,
  /** Temperatura estándar [K] (25°C) */
  T_std: 298.15,
  /** Densidad agua a 20°C [kg/m³] */
  rho_water: 998.2,
  /** Viscosidad cinemática agua a 20°C [m²/s] */
  nu_water: 1.004e-6,
  /** Densidad aire a STP [kg/m³] */
  rho_air: 1.225,
  /** Viscosidad cinemática aire a 20°C [m²/s] */
  nu_air: 1.516e-5,
} as const;

/** Conversión de unidades comunes */
export const UNITS = {
  mm_to_m: 1e-3,
  m_to_mm: 1e3,
  cm_to_m: 1e-2,
  in_to_m: 0.0254,
  ft_to_m: 0.3048,
  psi_to_Pa: 6894.757,
  Pa_to_psi: 1 / 6894.757,
  ksi_to_Pa: 6894757,
  MPa_to_Pa: 1e6,
  GPa_to_Pa: 1e9,
  bar_to_Pa: 1e5,
  degC_to_K: (c: number) => c + 273.15,
  K_to_degC: (k: number) => k - 273.15,
  degF_to_K: (f: number) => (f - 32) * 5 / 9 + 273.15,
  RPM_to_rads: (rpm: number) => rpm * 2 * Math.PI / 60,
  hp_to_W: 745.7,
  kW_to_hp: 1 / 0.7457,
  lbf_to_N: 4.44822,
  N_to_lbf: 1 / 4.44822,
  kg_to_lb: 2.20462,
} as const;

// ═══════════════════════════════════════════════════════════════
// Utilidades de álgebra lineal (para los módulos FEM)
// ═══════════════════════════════════════════════════════════════

/** Producto punto de dos vectores */
function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Producto matriz-vector */
function matVecMul(A: number[][], x: number[]): number[] {
  return A.map(row => dot(row, x));
}

/** Producto de matrices A × B */
function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = B[0].length;
  const inner = B.length;
  const C: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < inner; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

/** Transpuesta de matriz */
function transpose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0].length;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}
