/**
 * ══════════════════════════════════════════════════════════════════════
 *  quantum/orbitals — Orbitales hidrogenoides rigurosos
 * ══════════════════════════════════════════════════════════════════════
 *
 * Esto NO es un modelo de Bohr. Es la solución exacta de la ecuación de
 * Schrödinger para un átomo de un electrón con núcleo de carga Z:
 *
 *     ψ_nlm(r, θ, φ) = R_nl(r) · Y_lm(θ, φ)
 *
 * donde:
 *     R_nl   = función radial (polinomios asociados de Laguerre)
 *     Y_lm   = armónico esférico (polinomios asociados de Legendre)
 *
 * La densidad de probabilidad |ψ|² es lo que VEMOS como "nube" del
 * electrón. Lo que las pelotitas de los libros ocultan durante un siglo
 * es precisamente esta realidad: el electrón no está "en una órbita",
 * está EN TODOS LADOS con distinta probabilidad.
 *
 * Unidades: longitud en bohrs (a₀ = 0.529 Å). Ajustar con Z si hace falta.
 *
 * Ref [Q1] Griffiths, D.J. "Introduction to Quantum Mechanics", 3rd ed.,
 *          Cambridge UP, 2018. Capítulo 4.
 * Ref [Q2] Levine, I.N. "Quantum Chemistry", 7th ed., Pearson, 2014.
 * Ref [Q3] Pauling, L. & Wilson, E.B. "Introduction to Quantum Mechanics
 *          with Applications to Chemistry", Dover, 1985 — las formas
 *          analíticas canónicas de los orbitales reales (no complejos).
 */

// ═══════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════

/** Radio de Bohr [m] */
export const A0 = 5.29177210903e-11;
/** Radio de Bohr [Å] — conveniente para química */
export const A0_ANGSTROM = 0.529177210903;

// ═══════════════════════════════════════════════════════════════
// ORBITALES REALES HIDROGENOIDES (con Z)
// ═══════════════════════════════════════════════════════════════
//
// Las formas "reales" de los orbitales p y d vienen de combinar los
// m_l = ±1 (y ±2) en senos/cosenos. Son equivalentes energéticamente
// pero tienen orientación cartesiana clara (px, py, pz, etc.).
//
// Todas las wavefunctions aquí retornan ψ (real) en unidades tales que
// |ψ|² tiene dimensiones de 1/volumen en bohr³. Multiplicar por 1/a₀³ si
// se necesita densidad en volumen físico.

/** ψ_{1s}(r, Z) */
export function psi_1s(r: number, Z = 1): number {
  const zr = Z * r;
  return (1 / Math.sqrt(Math.PI)) * Math.pow(Z, 1.5) * Math.exp(-zr);
}

/** ψ_{2s}(r, Z) */
export function psi_2s(r: number, Z = 1): number {
  const zr = Z * r;
  return (
    (1 / (4 * Math.sqrt(2 * Math.PI))) *
    Math.pow(Z, 1.5) *
    (2 - zr) *
    Math.exp(-zr / 2)
  );
}

/** ψ_{2p_z}(r, θ, Z) — orbital p orientado al eje z */
export function psi_2pz(r: number, theta: number, Z = 1): number {
  const zr = Z * r;
  return (
    (1 / (4 * Math.sqrt(2 * Math.PI))) *
    Math.pow(Z, 1.5) *
    zr *
    Math.exp(-zr / 2) *
    Math.cos(theta)
  );
}

/** ψ_{2p_x}(r, θ, φ, Z) */
export function psi_2px(r: number, theta: number, phi: number, Z = 1): number {
  const zr = Z * r;
  return (
    (1 / (4 * Math.sqrt(2 * Math.PI))) *
    Math.pow(Z, 1.5) *
    zr *
    Math.exp(-zr / 2) *
    Math.sin(theta) *
    Math.cos(phi)
  );
}

/** ψ_{2p_y}(r, θ, φ, Z) */
export function psi_2py(r: number, theta: number, phi: number, Z = 1): number {
  const zr = Z * r;
  return (
    (1 / (4 * Math.sqrt(2 * Math.PI))) *
    Math.pow(Z, 1.5) *
    zr *
    Math.exp(-zr / 2) *
    Math.sin(theta) *
    Math.sin(phi)
  );
}

/** ψ_{3s}(r, Z) */
export function psi_3s(r: number, Z = 1): number {
  const zr = Z * r;
  return (
    (1 / (81 * Math.sqrt(3 * Math.PI))) *
    Math.pow(Z, 1.5) *
    (27 - 18 * zr + 2 * zr * zr) *
    Math.exp(-zr / 3)
  );
}

/** ψ_{3p_z}(r, θ, Z) */
export function psi_3pz(r: number, theta: number, Z = 1): number {
  const zr = Z * r;
  return (
    (Math.sqrt(2) / (81 * Math.sqrt(Math.PI))) *
    Math.pow(Z, 1.5) *
    (6 - zr) *
    zr *
    Math.exp(-zr / 3) *
    Math.cos(theta)
  );
}

/** ψ_{3p_x}(r, θ, φ, Z) */
export function psi_3px(r: number, theta: number, phi: number, Z = 1): number {
  const zr = Z * r;
  return (
    (Math.sqrt(2) / (81 * Math.sqrt(Math.PI))) *
    Math.pow(Z, 1.5) *
    (6 - zr) *
    zr *
    Math.exp(-zr / 3) *
    Math.sin(theta) * Math.cos(phi)
  );
}

/** ψ_{3p_y}(r, θ, φ, Z) */
export function psi_3py(r: number, theta: number, phi: number, Z = 1): number {
  const zr = Z * r;
  return (
    (Math.sqrt(2) / (81 * Math.sqrt(Math.PI))) *
    Math.pow(Z, 1.5) *
    (6 - zr) *
    zr *
    Math.exp(-zr / 3) *
    Math.sin(theta) * Math.sin(phi)
  );
}

/** ψ_{3d_{z²}}(r, θ, Z) */
export function psi_3dz2(r: number, theta: number, Z = 1): number {
  const zr = Z * r;
  const c = 3 * Math.cos(theta) * Math.cos(theta) - 1;
  return (
    (1 / (81 * Math.sqrt(6 * Math.PI))) *
    Math.pow(Z, 1.5) *
    zr *
    zr *
    Math.exp(-zr / 3) *
    c
  );
}

/** ψ_{3d_{xy}}(r, θ, φ, Z) */
export function psi_3dxy(r: number, theta: number, phi: number, Z = 1): number {
  const zr = Z * r;
  const st = Math.sin(theta);
  return (
    (1 / (81 * Math.sqrt(2 * Math.PI))) *
    Math.pow(Z, 1.5) *
    zr *
    zr *
    Math.exp(-zr / 3) *
    st * st *
    Math.sin(2 * phi)
  );
}

/** ψ_{3d_{xz}}(r, θ, φ, Z) */
export function psi_3dxz(r: number, theta: number, phi: number, Z = 1): number {
  const zr = Z * r;
  return (
    (Math.sqrt(2) / (81 * Math.sqrt(Math.PI))) *
    Math.pow(Z, 1.5) *
    zr *
    zr *
    Math.exp(-zr / 3) *
    Math.sin(theta) *
    Math.cos(theta) *
    Math.cos(phi)
  );
}

/** ψ_{3d_{x²-y²}}(r, θ, φ, Z) */
export function psi_3dx2y2(r: number, theta: number, phi: number, Z = 1): number {
  const zr = Z * r;
  const st = Math.sin(theta);
  return (
    (1 / (81 * 2 * Math.sqrt(Math.PI))) *
    Math.pow(Z, 1.5) *
    zr *
    zr *
    Math.exp(-zr / 3) *
    st * st *
    Math.cos(2 * phi)
  );
}

// ═══════════════════════════════════════════════════════════════
// CATÁLOGO
// ═══════════════════════════════════════════════════════════════

export type OrbitalKey =
  | '1s' | '2s' | '2px' | '2py' | '2pz'
  | '3s' | '3px' | '3py' | '3pz' | '3dz2' | '3dxy' | '3dxz' | '3dx2y2';

export interface Orbital {
  key: OrbitalKey;
  name: string;
  n: number;
  l: number;
  /** Evaluación de ψ en (x, y, z) bohrs, con Z configurable */
  psi: (x: number, y: number, z: number, Z: number) => number;
  /** Extensión espacial aproximada [bohr] — dónde muestrear */
  extent: number;
  description: string;
}

function cart2sph(x: number, y: number, z: number): [number, number, number] {
  const r = Math.sqrt(x * x + y * y + z * z);
  const theta = r > 1e-12 ? Math.acos(z / r) : 0;
  const phi = Math.atan2(y, x);
  return [r, theta, phi];
}

export const ORBITALS: Record<OrbitalKey, Orbital> = {
  '1s': {
    key: '1s', name: '1s', n: 1, l: 0, extent: 4,
    description: 'Esférico, sin nodos. El estado base del átomo de hidrógeno.',
    psi: (x, y, z, Z) => {
      const [r] = cart2sph(x, y, z);
      return psi_1s(r, Z);
    },
  },
  '2s': {
    key: '2s', name: '2s', n: 2, l: 0, extent: 14,
    description: 'Esférico con nodo radial en r = 2/Z bohrs.',
    psi: (x, y, z, Z) => {
      const [r] = cart2sph(x, y, z);
      return psi_2s(r, Z);
    },
  },
  '2pz': {
    key: '2pz', name: '2p_z', n: 2, l: 1, extent: 14,
    description: 'Dos lóbulos alineados al eje z con nodo en el plano xy.',
    psi: (x, y, z, Z) => {
      const [r, theta] = cart2sph(x, y, z);
      return psi_2pz(r, theta, Z);
    },
  },
  '2px': {
    key: '2px', name: '2p_x', n: 2, l: 1, extent: 14,
    description: 'Dos lóbulos al eje x con nodo en el plano yz.',
    psi: (x, y, z, Z) => {
      const [r, theta, phi] = cart2sph(x, y, z);
      return psi_2px(r, theta, phi, Z);
    },
  },
  '2py': {
    key: '2py', name: '2p_y', n: 2, l: 1, extent: 14,
    description: 'Dos lóbulos al eje y con nodo en el plano xz.',
    psi: (x, y, z, Z) => {
      const [r, theta, phi] = cart2sph(x, y, z);
      return psi_2py(r, theta, phi, Z);
    },
  },
  '3s': {
    key: '3s', name: '3s', n: 3, l: 0, extent: 30,
    description: 'Esférico con dos nodos radiales.',
    psi: (x, y, z, Z) => {
      const [r] = cart2sph(x, y, z);
      return psi_3s(r, Z);
    },
  },
  '3px': {
    key: '3px', name: '3p_x', n: 3, l: 1, extent: 30,
    description: 'Dos lóbulos al eje x con nodo radial en 3p.',
    psi: (x, y, z, Z) => {
      const [r, theta, phi] = cart2sph(x, y, z);
      return psi_3px(r, theta, phi, Z);
    },
  },
  '3py': {
    key: '3py', name: '3p_y', n: 3, l: 1, extent: 30,
    description: 'Dos lóbulos al eje y con nodo radial en 3p.',
    psi: (x, y, z, Z) => {
      const [r, theta, phi] = cart2sph(x, y, z);
      return psi_3py(r, theta, phi, Z);
    },
  },
  '3pz': {
    key: '3pz', name: '3p_z', n: 3, l: 1, extent: 30,
    description: 'Dos lóbulos al eje z con un nodo radial adicional.',
    psi: (x, y, z, Z) => {
      const [r, theta] = cart2sph(x, y, z);
      return psi_3pz(r, theta, Z);
    },
  },
  '3dz2': {
    key: '3dz2', name: '3d_{z²}', n: 3, l: 2, extent: 30,
    description: 'Lóbulo z con anillo "torus" en el plano xy (dz²).',
    psi: (x, y, z, Z) => {
      const [r, theta] = cart2sph(x, y, z);
      return psi_3dz2(r, theta, Z);
    },
  },
  '3dxy': {
    key: '3dxy', name: '3d_{xy}', n: 3, l: 2, extent: 30,
    description: 'Cuatro lóbulos entre los ejes x e y.',
    psi: (x, y, z, Z) => {
      const [r, theta, phi] = cart2sph(x, y, z);
      return psi_3dxy(r, theta, phi, Z);
    },
  },
  '3dxz': {
    key: '3dxz', name: '3d_{xz}', n: 3, l: 2, extent: 30,
    description: 'Cuatro lóbulos en el plano xz.',
    psi: (x, y, z, Z) => {
      const [r, theta, phi] = cart2sph(x, y, z);
      return psi_3dxz(r, theta, phi, Z);
    },
  },
  '3dx2y2': {
    key: '3dx2y2', name: '3d_{x²-y²}', n: 3, l: 2, extent: 30,
    description: 'Cuatro lóbulos en los ejes x e y (importante en complejos d⁸).',
    psi: (x, y, z, Z) => {
      const [r, theta, phi] = cart2sph(x, y, z);
      return psi_3dx2y2(r, theta, phi, Z);
    },
  },
};

// ═══════════════════════════════════════════════════════════════
// MUESTREO: generar N puntos distribuidos según |ψ|²
// ═══════════════════════════════════════════════════════════════

export interface SamplePoint {
  x: number;
  y: number;
  z: number;
  /** signo de ψ (+1 o −1) — útil para colorear lóbulos de signo opuesto */
  sign: 1 | -1;
  /** |ψ|² normalizado al máximo encontrado en el muestreo */
  density: number;
}

/**
 * Rejection sampling de un orbital: genera puntos dentro de un cubo
 * [-L, L]³ y los acepta con probabilidad |ψ|²/max(|ψ|²).
 *
 * Es un algoritmo clásico — sacrifica eficiencia por correctitud
 * probabilística. Para n=3 puede necesitar ~10^6 intentos para ~10⁴
 * aceptaciones si la región densa es pequeña.
 */
export function sampleOrbital(
  orbital: Orbital,
  nPoints: number,
  Z = 1,
  seed = 42,
): SamplePoint[] {
  const L = orbital.extent / Z;
  const maxAttempts = nPoints * 200;
  const out: SamplePoint[] = [];

  // Normalización: encontrar max |ψ|² muestreando aleatoriamente
  let psiMax2 = 0;
  const rng = mulberry32(seed);
  for (let i = 0; i < 5000; i++) {
    const x = (rng() * 2 - 1) * L;
    const y = (rng() * 2 - 1) * L;
    const z = (rng() * 2 - 1) * L;
    const p = orbital.psi(x, y, z, Z);
    if (p * p > psiMax2) psiMax2 = p * p;
  }
  if (psiMax2 === 0) return out;

  let attempts = 0;
  while (out.length < nPoints && attempts < maxAttempts) {
    const x = (rng() * 2 - 1) * L;
    const y = (rng() * 2 - 1) * L;
    const z = (rng() * 2 - 1) * L;
    const psi = orbital.psi(x, y, z, Z);
    const prob = (psi * psi) / psiMax2;
    // Si encontramos un punto con prob > 1 (max inicial subestimado),
    // actualizamos psiMax2 — costo: puntos previos tienen densidad
    // potencialmente sesgada, pero el muestreo sigue siendo válido
    // (es una muestra de |ψ|² con normalización consistente).
    if (prob > 1) psiMax2 = psi * psi;
    const probCapped = Math.min(1, prob);
    if (rng() < probCapped) {
      out.push({
        x, y, z,
        sign: psi >= 0 ? 1 : -1,
        density: probCapped,
      });
    }
    attempts++;
  }
  return out;
}

/** PRNG determinístico Mulberry32 para muestreos reproducibles. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════
// ENERGÍA DEL ORBITAL (hidrogenoide exacta)
// ═══════════════════════════════════════════════════════════════

/**
 * Energía en Hartrees para orbital con número cuántico principal n.
 *     E_n = -Z² / (2n²) Ha
 *
 * 1 Hartree = 27.2114 eV = 4.3597·10⁻¹⁸ J.
 */
export function orbitalEnergy(n: number, Z = 1): number {
  return -(Z * Z) / (2 * n * n);
}

export const HARTREE_TO_EV = 27.211386245988;
