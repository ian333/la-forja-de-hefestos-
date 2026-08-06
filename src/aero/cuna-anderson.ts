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
 * Relación θ-β-M en su forma DIRECTA (Anderson §9.2, ec. 9.23):
 *   tan θ = 2·cot β·(M²sin²β − 1) / (M²(γ + cos 2β) + 2)
 * Dado β devuelve θ. Es la única forma cerrada: el problema inverso (β dado θ)
 * no tiene solución elemental y se resuelve por bisección más abajo.
 */
export function thetaDeBeta(M: number, beta: number, gamma = 1.4): number {
  const num = 2 * (M * M * Math.sin(beta) ** 2 - 1);
  const den = Math.tan(beta) * (M * M * (gamma + Math.cos(2 * beta)) + 2);
  return Math.atan(num / den);
}

/**
 * Deflexión MÁXIMA que un choque oblicuo adherido puede sostener a este Mach,
 * y el β donde ocurre. Es la frontera entre las dos ramas: por debajo de βmax
 * la solución es DÉBIL (la física), por encima FUERTE.
 *
 * θ(β) es unimodal en [μ, 90°] (vale 0 en ambos extremos) → búsqueda ternaria.
 * Referencia: para M=2, θmax ≈ 22.97° en β ≈ 64.7°. Por eso el bracket fijo de
 * 65° que tenía la versión anterior recortaba soluciones válidas.
 */
export function deflexionMaxima(M: number, gamma = 1.4): { thetaMax: number; betaEnMax: number } {
  if (M <= 1) return { thetaMax: 0, betaEnMax: Math.PI / 2 };
  let lo = Math.asin(1 / M), hi = Math.PI / 2;
  for (let i = 0; i < 200; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (thetaDeBeta(M, m1, gamma) < thetaDeBeta(M, m2, gamma)) lo = m1; else hi = m2;
  }
  const betaEnMax = (lo + hi) / 2;
  return { thetaMax: thetaDeBeta(M, betaEnMax, gamma), betaEnMax };
}

export interface ChoqueOblicuo {
  /** ángulo del choque [rad], o null si está DESPRENDIDO */
  beta: number | null;
  /** true cuando θ > θmax: no existe choque adherido, se forma una onda de proa */
  desprendido: boolean;
  /** deflexión máxima sostenible a este Mach [rad] */
  thetaMax: number;
  betaEnMax: number;
}

/**
 * Resuelve el choque oblicuo DECLARANDO si está desprendido en vez de fallar
 * callado. Úsala siempre que θ venga del usuario o de una geometría medida.
 *
 * ⚠️ Por qué existe: la versión anterior biseccionaba en un bracket fijo de 65°
 * y, cuando θ > θmax, devolvía 65° EN SILENCIO — un número plausible y falso.
 * Probado con M=2/θ=30°, M=1.5/θ=20° y M=3/θ=40°: los tres mentían.
 *
 * @param rama 'debil' (la que ocurre en la naturaleza) o 'fuerte'
 */
export function resolverChoqueOblicuo(
  M: number, theta: number, gamma = 1.4, rama: 'debil' | 'fuerte' = 'debil',
): ChoqueOblicuo {
  const { thetaMax, betaEnMax } = deflexionMaxima(M, gamma);
  if (M <= 1 || theta < 0 || theta > thetaMax) {
    return { beta: null, desprendido: true, thetaMax, betaEnMax };
  }
  // θ(β) crece en [μ, βmax] y decrece en [βmax, 90°] → bisección monótona por rama
  const mu = Math.asin(1 / M);
  let lo = rama === 'debil' ? mu : betaEnMax;
  let hi = rama === 'debil' ? betaEnMax : Math.PI / 2;
  const creciente = rama === 'debil';
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const t = thetaDeBeta(M, mid, gamma);
    if ((t < theta) === creciente) lo = mid; else hi = mid;
  }
  return { beta: (lo + hi) / 2, desprendido: false, thetaMax, betaEnMax };
}

/**
 * Ángulo β del choque oblicuo, rama DÉBIL. Para M=2, θ=5° la carta
 * (Anderson Ap. / NACA 1135) da β ≈ 34.3°.
 *
 * ⚠️ LANZA si el choque está desprendido. Es deliberado: antes devolvía 65°
 * sin avisar. Si θ no está bajo tu control, usa `resolverChoqueOblicuo`.
 */
export function betaChoqueOblicuo(M: number, theta: number, gamma = 1.4): number {
  const r = resolverChoqueOblicuo(M, theta, gamma);
  if (r.beta === null) {
    throw new Error(
      `betaChoqueOblicuo: choque DESPRENDIDO — M=${M}, θ=${(theta * 180 / Math.PI).toFixed(2)}° ` +
      `excede θmax=${(r.thetaMax * 180 / Math.PI).toFixed(2)}°. No existe choque oblicuo adherido.`,
    );
  }
  return r.beta;
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
