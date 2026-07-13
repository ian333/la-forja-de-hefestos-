/**
 * ✈️ AERO U1-L1 — LAS DOS MANOS: presión p y cortante τ
 * ======================================================
 * Anderson, Fundamentals of Aerodynamics 6ª ed., EJEMPLO 1.1 (§1.5), LITERAL:
 *
 *   Cuña de semiángulo δ=5° a α=0, M∞=2.0, nivel del mar
 *   (p∞ = 1.01×10⁵ Pa, ρ∞ = 1.23 kg/m³, T∞ = 288 K), cuerda c = 2 m.
 *   Sobre las caras inclinadas: p_u = p_l = 1.31×10⁵ Pa (constante, tras el
 *   choque oblicuo) y τ_w = 431·s^(−0.2). La base va a p∞.
 *
 *   Resultados del libro: D′ = 1.24×10⁴ N/m  (presión 1.052×10⁴ = 85 %,
 *   fricción 0.1873×10⁴ = 15 %), q∞ = 2.847×10⁵ Pa, c_d = 0.022.
 *
 * TODA fuerza aerodinámica es la integral de p y τ sobre la superficie —
 * ecuación (1.8). Aquí se integra NUMÉRICAMENTE por paneles para que el
 * alumno VEA converger la suma al número del libro. Nada está inventado.
 */

export const CUNA_ANDERSON = {
  delta: 5 * Math.PI / 180, // semiángulo de la cuña [rad]
  mach: 2.0,
  pInf: 1.01e5,             // Pa
  rhoInf: 1.23,             // kg/m³
  T: 288,                   // K (nivel del mar estándar)
  c: 2.0,                   // m — cuerda
  pCara: 1.31e5,            // Pa — presión constante sobre las caras inclinadas
  tauK: 431,                // τ_w = tauK · s^tauExp  [Pa], s en m desde el borde
  tauExp: -0.2,
  gamma: 1.4,
  R: 287,
} as const;

export interface CunaResultado {
  /** arrastre por presión [N/m] (caras + base a p∞) */
  Dp: number;
  /** arrastre por fricción [N/m] */
  Df: number;
  /** arrastre total D′ [N/m] */
  D: number;
  /** presión dinámica q∞ [Pa] */
  q: number;
  V: number;
  aSonido: number;
  cd: number;
  /** fracción del arrastre que es presión (el libro: 0.85) */
  fraccionPresion: number;
}

/**
 * Integra p y τ sobre la cuña con n paneles por cara inclinada.
 * Puro y determinista: mismos args → mismo resultado.
 */
/**
 * Ángulo β del choque oblicuo (solución DÉBIL) de la relación θ-β-M:
 *   tan θ = 2·cot β·(M²sin²β − 1) / (M²(γ + cos 2β) + 2)
 * Para M=2, θ=5° la carta (Anderson Ap. / NACA 1135) da β ≈ 34.3°.
 * Bisección entre el ángulo de Mach μ=asin(1/M) y 90°.
 */
export function betaChoqueOblicuo(M: number, theta: number, gamma = 1.4): number {
  const f = (b: number) =>
    Math.tan(theta) - (2 / Math.tan(b)) * (M * M * Math.sin(b) ** 2 - 1) / (M * M * (gamma + Math.cos(2 * b)) + 2);
  let lo = Math.asin(1 / M) + 1e-6; // f(lo) > 0 (θ pedido mayor que 0 desviación)
  let hi = 65 * Math.PI / 180;      // pasado el máximo de la rama débil, f < 0
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function cunaAnderson(n = 200): CunaResultado {
  const { delta, mach, pInf, rhoInf, T, c, pCara, tauK, tauExp, gamma, R } = CUNA_ANDERSON;
  const L = c / Math.cos(delta);        // longitud de cada cara inclinada
  const ds = L / n;

  // PRESIÓN sobre las caras inclinadas: cada panel empuja ⊥ a la cara;
  // su componente de arrastre es p·sin(δ)·ds (por cara, y son dos).
  let DpCaras = 0;
  for (let i = 0; i < n; i++) DpCaras += pCara * Math.sin(delta) * ds;
  DpCaras *= 2;

  // BASE a p∞: altura 2·c·tan(δ), empuja hacia ADELANTE (succión de culata).
  const DpBase = -pInf * (2 * c * Math.tan(delta));

  // CORTANTE τ = 431·s^(−0.2) sobre cada cara (componente cos δ). La
  // singularidad integrable en s=0 se evita evaluando en el CENTRO del panel.
  let Df = 0;
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * ds;
    Df += tauK * Math.pow(s, tauExp) * Math.cos(delta) * ds;
  }
  Df *= 2;

  const aSonido = Math.sqrt(gamma * R * T);
  const V = mach * aSonido;
  const q = 0.5 * rhoInf * V * V;
  const Dp = DpCaras + DpBase;
  const D = Dp + Df;
  return {
    Dp, Df, D, q, V, aSonido,
    cd: D / (q * c * 1.0),
    fraccionPresion: Dp / D,
  };
}
