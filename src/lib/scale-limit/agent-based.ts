/**
 * ══════════════════════════════════════════════════════════════════════
 *  scale-limit/agent-based — Nivel 2 → 3: ABM vs PDE
 * ══════════════════════════════════════════════════════════════════════
 *
 * Cada célula es un agente con posición en [0, L]. Por paso:
 *   · Random walk (difusión): Δx ~ N(0, √(2D·dt))
 *   · División local: rate r·(1 − ρ_local / K) si positivo
 *   · Muerte (opcional): rate δ
 *
 * El límite continuo es Fisher-KPP:
 *
 *   ∂u/∂t = D ∂²u/∂x² + r·u·(1 − u/K)
 *
 * con velocidad de onda invasora c = 2√(rD). Cuando N es pequeño, la onda
 * del ABM va más lenta por "pulled wave correction" de Brunet-Derrida:
 *
 *   c_ABM ≈ c_PDE − π²·D / (2·(ln N)²)
 *
 * La convergencia del ABM hacia el PDE es LENTA (∝ 1/(ln N)²), no 1/√N.
 * Este es un ejemplo de que no toda escala obedece la raíz — la estructura
 * del problema importa.
 *
 * Referencias:
 *   · Fisher 1937, Ann. Eugenics 7:355 — ecuación de KPP.
 *   · Brunet & Derrida 1997, Phys. Rev. E 56:2597 — corrección por N finito.
 *   · Durrett 1988, "Lecture Notes on Particle Systems" §4.
 *   · Murray, "Mathematical Biology" Vol. 1 §13.
 */

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════

export interface ABMParams {
  /** Tamaño del dominio [0, L] con bordes periódicos. */
  L: number;
  /** Coef difusión (D en units de L²/t). */
  D: number;
  /** Rate de proliferación (r en units de 1/t). */
  r: number;
  /** Capacidad de carga, en células por unidad de longitud. */
  K: number;
  /** Rate de muerte espontánea (default 0). */
  delta?: number;
  /** Ventana para evaluar densidad local (fracción de L). */
  localBin?: number;
  /** Paso temporal. */
  dt: number;
}

export interface ABMState {
  /** Posiciones de las células vivas, length = N. */
  positions: Float32Array;
  /** Contador vivo. Usable solo los primeros N elementos de positions. */
  N: number;
  /** Tiempo acumulado. */
  t: number;
  /** Evento contador (útil para stats). */
  events: number;
}

// ═══════════════════════════════════════════════════════════════
// Population 1D
// ═══════════════════════════════════════════════════════════════

/**
 * Crea una población con capacidad máxima `maxN`. Reserva arrays.
 */
export function createPopulation(maxN: number): ABMState {
  return {
    positions: new Float32Array(maxN),
    N: 0, t: 0, events: 0,
  };
}

/** Añade una célula en posición x. Crece N. */
export function addCell(state: ABMState, x: number, L: number): void {
  if (state.N >= state.positions.length) return;   // capacidad
  let xx = x - L * Math.floor(x / L);
  if (xx < 0) xx += L;
  state.positions[state.N] = xx;
  state.N++;
}

/** Remueve célula índice i (swap-with-last para O(1)). */
function removeCell(state: ABMState, i: number): void {
  state.N--;
  if (i !== state.N) state.positions[i] = state.positions[state.N];
}

/**
 * Densidad local en la posición x usando ventana `localBin`·L.
 * Retorna células por unidad de longitud en esa ventana.
 */
export function localDensity(state: ABMState, x: number, L: number, localBin: number): number {
  const w = localBin * L;
  const half = w / 2;
  let count = 0;
  for (let j = 0; j < state.N; j++) {
    let dx = state.positions[j] - x;
    dx -= L * Math.floor(dx / L + 0.5);
    if (Math.abs(dx) < half) count++;
  }
  return count / w;
}

/** Gaussiano N(0,1) via Box-Muller. */
function gaussN01(): number {
  const u1 = Math.max(1e-12, Math.random());
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Un paso ABM:
 *   1. Cada célula difunde: x ← x + N(0, √(2D·dt)), wrap periódico.
 *   2. Cada célula divide con prob r·(1 − ρ_local/K)·dt si positivo.
 *   3. Cada célula muere con prob δ·dt.
 *
 * Semi-explícito: las decisiones se toman a estado actual, se aplican al
 * final del paso (para no sesgar por orden de iteración).
 */
export function abmStep(state: ABMState, params: ABMParams): void {
  const { L, D, r, K, dt } = params;
  const delta = params.delta ?? 0;
  const localBin = params.localBin ?? 0.05;
  const sigma = Math.sqrt(2 * D * dt);

  // Paso 1: difusión
  for (let i = 0; i < state.N; i++) {
    let x = state.positions[i] + gaussN01() * sigma;
    x -= L * Math.floor(x / L);
    if (x < 0) x += L;
    state.positions[i] = x;
  }

  // Paso 2+3: birth & death. Guardamos decisiones en dos arrays.
  const toBirth: number[] = [];
  const toDie: number[] = [];
  for (let i = 0; i < state.N; i++) {
    const x = state.positions[i];
    const rho = localDensity(state, x, L, localBin);
    const pBirth = r * Math.max(0, 1 - rho / K) * dt;
    if (Math.random() < pBirth) toBirth.push(i);
    if (delta > 0 && Math.random() < delta * dt) toDie.push(i);
  }
  // Aplicar nacimientos (la nueva célula aparece junto al padre con pequeño jitter)
  for (const i of toBirth) {
    if (state.N >= state.positions.length) break;
    const x = state.positions[i] + gaussN01() * sigma * 0.3;
    addCell(state, x, L);
    state.events++;
  }
  // Aplicar muertes — iterar descendente para que los swaps no corrompan índices
  toDie.sort((a, b) => b - a);
  for (const i of toDie) removeCell(state, i);
  state.events += toDie.length;

  state.t += dt;
}

/**
 * Histograma de densidad en `nBins` celdas uniformes.
 * Retorna células por unidad de longitud por bin.
 */
export function densityProfile(state: ABMState, L: number, nBins: number): Float32Array {
  const dens = new Float32Array(nBins);
  const dx = L / nBins;
  for (let j = 0; j < state.N; j++) {
    const b = Math.min(nBins - 1, Math.floor(state.positions[j] / dx));
    dens[b]++;
  }
  for (let b = 0; b < nBins; b++) dens[b] /= dx;
  return dens;
}

/**
 * Posición del frente derecho de una onda que se propaga hacia +x.
 * Arranca en `startBin` (la región ya invadida) e incrementa hasta
 * encontrar el primer bin donde dens < threshold·K — ese es el frente.
 *
 * Si nunca baja de threshold antes del final del dominio, retorna L
 * (la onda llegó al borde o el dominio está saturado).
 *
 * Usar `startBin` para ignorar la parte de la onda que wrap-around por
 * frontera periódica desde el otro lado.
 */
export function waveFrontPosition(
  dens: Float32Array, L: number, K: number, threshold = 0.5, startBin = 0,
): number {
  const tgt = threshold * K;
  const nBins = dens.length;
  const dx = L / nBins;
  // Si el bin de arranque ya no está lleno, escanear hacia la izquierda
  // hasta encontrar región llena (robustez ante ondas lentas).
  let b = Math.max(0, Math.min(nBins - 1, startBin));
  if (dens[b] < tgt) {
    // Buscar hacia la izquierda el primer bin lleno
    let left = b - 1;
    while (left >= 0 && dens[left] < tgt) left--;
    if (left < 0) return 0;   // nada lleno
    b = left;
  }
  // Avanzar hacia la derecha hasta el primer bin vacío
  for (; b < nBins; b++) {
    if (dens[b] < tgt) return (b + 0.5) * dx;
  }
  return L;
}

// ═══════════════════════════════════════════════════════════════
// Fisher-KPP 1D (FTCS) — la PDE de referencia
// ═══════════════════════════════════════════════════════════════

export interface FisherKppState {
  u: Float32Array;
  next: Float32Array;
  nBins: number;
  L: number;
  t: number;
}

export function createFisherKpp(nBins: number, L: number): FisherKppState {
  return {
    u: new Float32Array(nBins),
    next: new Float32Array(nBins),
    nBins, L, t: 0,
  };
}

/**
 * Paso FTCS 1D con condiciones periódicas:
 *   u_i^{n+1} = u_i^n + dt·(D·(u_{i-1} − 2u_i + u_{i+1})/dx² + r·u_i·(1 − u_i/K))
 *
 * Estable si D·dt/dx² ≤ 1/2.
 */
export function fisherKppStep(
  state: FisherKppState, D: number, r: number, K: number, dt: number,
): void {
  const { u, next, nBins, L } = state;
  const dx = L / nBins;
  const lam = D * dt / (dx * dx);
  for (let i = 0; i < nBins; i++) {
    const lm = u[(i - 1 + nBins) % nBins];
    const rp = u[(i + 1) % nBins];
    const c  = u[i];
    const lap = lm - 2 * c + rp;
    const reaction = r * c * (1 - c / K);
    next[i] = c + lam * lap + dt * reaction;
    if (next[i] < 0) next[i] = 0;
  }
  // swap
  state.u = state.next;
  state.next = u;
  state.t += dt;
}

/** Velocidad analítica de la onda Fisher-KPP: c = 2·√(r·D). */
export function fisherKppWaveSpeed(D: number, r: number): number {
  return 2 * Math.sqrt(D * r);
}

/**
 * Corrección de Brunet-Derrida 1997 — velocidad del frente ABM con N
 * células cuando el frente está "pulled":
 *
 *   c_N ≈ c_∞ − π²·D / (2·(ln N)²)
 *
 * Efecto: ABM es MÁS LENTO que la PDE en un factor logarítmico.
 */
export function brunetDerridaCorrection(N: number, D: number): number {
  const lnN = Math.log(Math.max(2, N));
  return -Math.PI * Math.PI * D / (2 * lnN * lnN);
}
