/**
 * ══════════════════════════════════════════════════════════════════════
 *  scale-limit/gillespie — SSA exacto vs ODE mass-action
 * ══════════════════════════════════════════════════════════════════════
 *
 * Nivel 1 → Nivel 2 de la escalera: ¿cuándo una red de reacciones
 * químicas puede tratarse con ODE deterministas (ley de acción de masas)
 * en vez de con el algoritmo estocástico exacto de Gillespie?
 *
 * La respuesta cuantitativa: la fluctuación relativa en el estado
 * estacionario escala como
 *
 *   σ_X / ⟨X⟩  ∝  1 / √⟨X⟩
 *
 * (teorema del límite central para procesos Markov discretos;
 *  para birth-death la distribución es Poisson → σ² = ⟨X⟩).
 *
 * Cuando N_molec por especie ≳ 100, el ruido relativo cae por debajo
 * del 10% y la ODE es una aproximación razonable. Por debajo de
 * ~N=10 la dinámica es dominada por el ruido y SSA es obligatorio.
 *
 * Referencias:
 *   · Gillespie 1976, J. Comput. Phys. 22:403 — algoritmo directo.
 *   · Gillespie 1977, J. Phys. Chem. 81:2340 — conexión con CME.
 *   · Gillespie 2001, J. Chem. Phys. 115:1716 — tau-leaping.
 *   · van Kampen 2007, "Stochastic Processes in Physics and Chemistry" §X.
 *   · Wilkinson 2018, "Stochastic Modelling for Systems Biology" 3rd ed.
 *
 * Esta librería es pura (sin Three.js / WebGL) y testeable en node.
 */

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════

/**
 * Una reacción: lista de reactivos (con multiplicidad), productos, y
 * constante c (en unidades de `molec^(1-m)·t^-1`, donde m es el orden).
 *
 * Ejemplo: A + B → C con rate c₁ ⇒
 *   { reactants: [[0,1], [1,1]], products: [[2,1]], c: c1 }
 * donde los índices son IDs de especies.
 */
export interface Reaction {
  name?: string;
  /** Pairs [specIndex, multiplicity]. */
  reactants: [number, number][];
  products:  [number, number][];
  /** Constante de reacción (en unidades de moleculas vs concentración). */
  c: number;
}

export interface ReactionNetwork {
  speciesNames: string[];
  reactions: Reaction[];
}

// ═══════════════════════════════════════════════════════════════
// Propensity (para SSA)
// ═══════════════════════════════════════════════════════════════

/**
 * Propensity a_j(x) para la reacción j dado el estado x (moléculas).
 * Convención combinatoria exacta: para A + B → ...  a = c·x_A·x_B
 *                                 para 2A → ...     a = c·x_A·(x_A-1)/2
 * De acuerdo a la derivación de Gillespie desde master equation.
 */
export function propensity(reaction: Reaction, state: Int32Array): number {
  let a = reaction.c;
  for (const [i, m] of reaction.reactants) {
    const n = state[i];
    if (n < m) return 0;
    if (m === 1) a *= n;
    else if (m === 2) a *= n * (n - 1) / 2;
    else if (m === 3) a *= n * (n - 1) * (n - 2) / 6;
    else {
      // m ≥ 4: coef binomial general
      let bin = 1;
      for (let k = 0; k < m; k++) bin *= (n - k) / (k + 1);
      a *= bin;
    }
  }
  return Math.max(0, a);
}

// ═══════════════════════════════════════════════════════════════
// SSA Direct Method (Gillespie 1976)
// ═══════════════════════════════════════════════════════════════

export interface SSAResult {
  times: number[];
  /** Snapshots tomados en una rejilla temporal regular de `dtRecord`. */
  samples: Int32Array[];
  /** Eventos totales disparados. */
  totalEvents: number;
}

/**
 * Corre SSA hasta tMax o hasta `maxEvents`. Muestrea el estado en rejilla
 * regular {dtRecord, 2·dtRecord, …} (no guarda todos los eventos — sería
 * inmanejable para redes grandes).
 */
export function ssaRun(
  net: ReactionNetwork,
  state0: Int32Array,
  tMax: number,
  dtRecord: number,
  rng: () => number = Math.random,
  maxEvents = 1e7,
): SSAResult {
  const state = new Int32Array(state0);
  const nReactions = net.reactions.length;
  const nSpecies = state.length;
  const propensities = new Float64Array(nReactions);
  const times: number[] = [];
  const samples: Int32Array[] = [];
  let t = 0;
  let nextRecord = 0;
  let events = 0;

  // Precompute stoichiometry delta vectors
  const deltas: Int32Array[] = net.reactions.map(r => {
    const d = new Int32Array(nSpecies);
    for (const [i, m] of r.reactants) d[i] -= m;
    for (const [i, m] of r.products)  d[i] += m;
    return d;
  });

  while (t < tMax && events < maxEvents) {
    // Record samples mientras t pase los puntos de rejilla
    while (nextRecord <= t && nextRecord <= tMax) {
      times.push(nextRecord);
      samples.push(new Int32Array(state));
      nextRecord += dtRecord;
    }

    // Compute propensities
    let a0 = 0;
    for (let j = 0; j < nReactions; j++) {
      const a = propensity(net.reactions[j], state);
      propensities[j] = a;
      a0 += a;
    }
    if (a0 <= 0) {
      // Sistema "muerto" — no hay más eventos. Avanzar a tMax registrando.
      while (nextRecord <= tMax) {
        times.push(nextRecord);
        samples.push(new Int32Array(state));
        nextRecord += dtRecord;
      }
      break;
    }

    // Direct method: τ ~ Exp(a0), j ~ Cat(a/a0)
    const r1 = Math.max(1e-15, rng());
    const r2 = rng();
    const tau = -Math.log(r1) / a0;
    t += tau;

    let acc = 0;
    const target = r2 * a0;
    let j = 0;
    for (; j < nReactions - 1; j++) {
      acc += propensities[j];
      if (acc >= target) break;
    }
    // Aplicar reacción j
    const d = deltas[j];
    for (let i = 0; i < nSpecies; i++) state[i] += d[i];
    events++;
  }
  // Finalizar registros
  while (nextRecord <= tMax) {
    times.push(nextRecord);
    samples.push(new Int32Array(state));
    nextRecord += dtRecord;
  }
  return { times, samples, totalEvents: events };
}

// ═══════════════════════════════════════════════════════════════
// ODE mass-action (RK4)
// ═══════════════════════════════════════════════════════════════

/**
 * Derivada dconc/dt según acción de masas. Diferencia con SSA:
 *   · Opera sobre CONCENTRACIONES (float), no moléculas discretas.
 *   · Para convertir: conc = moléculas / Ω (vol en unidades consistentes).
 *     Si se trabaja en "moléculas puras" (Ω=1), coincide numéricamente.
 *
 * Las multiplicidades aquí usan exponentes (producto de x^m), NO binomiales
 * — esa es la diferencia formal con la propensity discreta. El factor de
 * corrección Ω→∞ elimina los binomiales hacia potencias.
 */
export function massActionDerivative(
  net: ReactionNetwork, x: Float64Array,
): Float64Array {
  const dx = new Float64Array(x.length);
  for (const r of net.reactions) {
    let rate = r.c;
    for (const [i, m] of r.reactants) {
      rate *= Math.pow(x[i], m);
    }
    for (const [i, m] of r.reactants) dx[i] -= m * rate;
    for (const [i, m] of r.products)  dx[i] += m * rate;
  }
  return dx;
}

/** RK4 para mass action. Paso fijo. */
export function odeStep(
  net: ReactionNetwork, x: Float64Array, dt: number,
): void {
  const n = x.length;
  const k1 = massActionDerivative(net, x);
  const tmp = new Float64Array(n);
  for (let i = 0; i < n; i++) tmp[i] = x[i] + 0.5 * dt * k1[i];
  const k2 = massActionDerivative(net, tmp);
  for (let i = 0; i < n; i++) tmp[i] = x[i] + 0.5 * dt * k2[i];
  const k3 = massActionDerivative(net, tmp);
  for (let i = 0; i < n; i++) tmp[i] = x[i] + dt * k3[i];
  const k4 = massActionDerivative(net, tmp);
  for (let i = 0; i < n; i++) {
    x[i] += dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6;
    if (x[i] < 0) x[i] = 0;
  }
}

export interface ODEResult {
  times: number[];
  samples: Float64Array[];
}

export function odeRun(
  net: ReactionNetwork, x0: Float64Array, tMax: number, dt: number,
): ODEResult {
  const x = new Float64Array(x0);
  const times: number[] = [0];
  const samples: Float64Array[] = [new Float64Array(x)];
  const nSteps = Math.ceil(tMax / dt);
  for (let k = 0; k < nSteps; k++) {
    odeStep(net, x, dt);
    times.push((k + 1) * dt);
    samples.push(new Float64Array(x));
  }
  return { times, samples };
}

// ═══════════════════════════════════════════════════════════════
// Redes canónicas
// ═══════════════════════════════════════════════════════════════

/**
 * Birth-death:
 *   ∅ → X   (c1 = α)
 *   X → ∅   (c2 = β)
 *
 * En steady state: ⟨X⟩ = α/β, Var(X) = α/β (Poisson) ⇒ σ/⟨X⟩ = 1/√⟨X⟩.
 */
export function birthDeath(alpha: number, beta: number): ReactionNetwork {
  return {
    speciesNames: ['X'],
    reactions: [
      { name: 'birth', reactants: [], products: [[0, 1]], c: alpha },
      { name: 'death', reactants: [[0, 1]], products: [], c: beta },
    ],
  };
}

/**
 * Lotka-Volterra estocástico (Wilkinson §6.4):
 *   X → 2X       (c1 = a) prey-growth
 *   X + Y → 2Y   (c2 = b)  predation
 *   Y → ∅        (c3 = d)  predator-death
 */
export function lotkaVolterra(a: number, b: number, d: number): ReactionNetwork {
  return {
    speciesNames: ['prey', 'pred'],
    reactions: [
      { name: 'prey growth',   reactants: [[0, 1]],          products: [[0, 2]], c: a },
      { name: 'predation',     reactants: [[0, 1], [1, 1]],  products: [[1, 2]], c: b },
      { name: 'pred death',    reactants: [[1, 1]],          products: [],        c: d },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// Estadísticas de estado estacionario
// ═══════════════════════════════════════════════════════════════

export interface SteadyStateStats {
  mean: number;
  variance: number;
  rsd: number;
  nSamples: number;
}

/** Calcula media/var de la especie `species` tras burn-in. */
export function steadyStateStats(
  result: SSAResult, species: number, burnIn = 0.3,
): SteadyStateStats {
  const n = result.samples.length;
  const startIdx = Math.floor(n * burnIn);
  let sum = 0, sumSq = 0, count = 0;
  for (let i = startIdx; i < n; i++) {
    const v = result.samples[i][species];
    sum += v;
    sumSq += v * v;
    count++;
  }
  const mean = count > 0 ? sum / count : 0;
  const variance = count > 1 ? (sumSq - sum * mean) / (count - 1) : 0;
  return {
    mean, variance,
    rsd: mean > 0 ? Math.sqrt(Math.abs(variance)) / mean : 0,
    nSamples: count,
  };
}

/**
 * Predicción teórica σ/⟨X⟩ para birth-death steady state:
 *   σ = √(α/β), ⟨X⟩ = α/β ⇒ σ/⟨X⟩ = 1/√⟨X⟩ = √(β/α).
 */
export function birthDeathRSD(alpha: number, beta: number): number {
  const mean = alpha / beta;
  return mean > 0 ? 1 / Math.sqrt(mean) : Infinity;
}
