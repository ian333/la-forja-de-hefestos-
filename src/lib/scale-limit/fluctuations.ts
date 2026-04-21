/**
 * ══════════════════════════════════════════════════════════════════════
 *  scale-limit/fluctuations — ¿cuándo vale promediar?
 * ══════════════════════════════════════════════════════════════════════
 *
 * Para un gas clásico de N partículas en equilibrio, la dispersión
 * relativa de la temperatura instantánea sigue:
 *
 *   σ_T / ⟨T⟩ = √(2 / (3N))         (equipartición + CLT)
 *
 * Esa es la medida objetiva de "cuánto átomos necesitamos para que un
 * promedio tenga sentido". Si nuestro simulador reproduce esta ley,
 * la infraestructura del bridge está justificada; si no, está mal.
 *
 * Esta librería provee:
 *   · `RunningStats`     — Welford online (mean, var, std estables).
 *   · `analyzeSeries`    — resumen estadístico de una serie.
 *   · `autoCorrelation`  — τ_int para tamaños de muestra efectivos.
 *   · `predictTemperatureRSD` — ley √(2/3N) para comparar.
 *
 * No depende de Three.js ni de WebGL → testeable en node puro.
 *
 * Ref:
 *   · Welford 1962, Technometrics 4:419 — varianza en línea numéricamente
 *     estable.
 *   · Allen & Tildesley, §6.4 — fluctuaciones en ensembles canónicos.
 *   · Lebowitz, Percus & Verlet 1967, Phys. Rev. 153:250 —
 *     fluctuaciones en el límite termodinámico.
 */

// ═══════════════════════════════════════════════════════════════
// Welford running stats
// ═══════════════════════════════════════════════════════════════

/**
 * Media y varianza incrementales. Numéricamente estable incluso para
 * series largas con valores de rango dinámico grande. O(1) per sample.
 */
export class RunningStats {
  private n = 0;
  private mu = 0;
  private M2 = 0;
  private minV = Infinity;
  private maxV = -Infinity;

  push(x: number): void {
    this.n++;
    const delta = x - this.mu;
    this.mu += delta / this.n;
    this.M2 += delta * (x - this.mu);
    if (x < this.minV) this.minV = x;
    if (x > this.maxV) this.maxV = x;
  }

  get count(): number { return this.n; }
  get mean(): number { return this.mu; }
  /** Varianza muestral (n−1). */
  get variance(): number { return this.n > 1 ? this.M2 / (this.n - 1) : 0; }
  /** Desviación estándar. */
  get std(): number { return Math.sqrt(this.variance); }
  /** Desviación relativa σ/μ (RSD). */
  get rsd(): number { return this.mu !== 0 ? this.std / Math.abs(this.mu) : 0; }
  get min(): number { return this.minV; }
  get max(): number { return this.maxV; }

  reset(): void {
    this.n = 0; this.mu = 0; this.M2 = 0;
    this.minV = Infinity; this.maxV = -Infinity;
  }
}

// ═══════════════════════════════════════════════════════════════
// Análisis de series
// ═══════════════════════════════════════════════════════════════

export interface SeriesSummary {
  n: number;
  mean: number;
  std: number;
  rsd: number;
  min: number;
  max: number;
}

export function analyzeSeries(values: number[] | Float64Array): SeriesSummary {
  const rs = new RunningStats();
  for (let i = 0; i < values.length; i++) rs.push(values[i]);
  return {
    n: rs.count, mean: rs.mean, std: rs.std, rsd: rs.rsd,
    min: rs.min, max: rs.max,
  };
}

// ═══════════════════════════════════════════════════════════════
// Auto-correlación (para tamaño efectivo de muestra)
// ═══════════════════════════════════════════════════════════════

/**
 * Auto-correlación normalizada ρ(k) = ⟨(x_t−μ)(x_{t+k}−μ)⟩ / var,
 * para lag k ∈ [0, maxLag].
 *
 * Útil para calcular el tiempo de correlación integral
 *   τ_int = 1 + 2 Σ_{k=1}^{∞} ρ(k)
 * y de ahí N_efec = N / (2 τ_int + 1).
 */
export function autoCorrelation(
  values: number[] | Float64Array, maxLag: number,
): Float64Array {
  const N = values.length;
  const rho = new Float64Array(maxLag + 1);
  if (N < 2) return rho;
  let mu = 0;
  for (let i = 0; i < N; i++) mu += values[i];
  mu /= N;
  let var0 = 0;
  for (let i = 0; i < N; i++) { const d = values[i] - mu; var0 += d * d; }
  var0 /= N;
  if (var0 <= 0) return rho;
  rho[0] = 1;
  for (let k = 1; k <= maxLag; k++) {
    let acc = 0;
    for (let i = 0; i + k < N; i++) {
      acc += (values[i] - mu) * (values[i + k] - mu);
    }
    acc /= (N - k);
    rho[k] = acc / var0;
  }
  return rho;
}

/**
 * Tiempo de correlación integrado τ_int. Se suma hasta el primer cruce
 * de ρ(k) < 0 (ventana automática de Madras-Sokal).
 */
export function integratedAutoCorrTime(
  values: number[] | Float64Array, maxLag = 200,
): number {
  const rho = autoCorrelation(values, Math.min(maxLag, values.length - 1));
  let tau = 1;
  for (let k = 1; k < rho.length; k++) {
    if (rho[k] <= 0) break;
    tau += 2 * rho[k];
  }
  return tau;
}

/** Tamaño de muestra efectivo tras auto-correlación: N_eff = N/(2τ_int−1). */
export function effectiveSampleSize(
  values: number[] | Float64Array, maxLag = 200,
): number {
  const tau = integratedAutoCorrTime(values, maxLag);
  return values.length / Math.max(1, 2 * tau - 1);
}

// ═══════════════════════════════════════════════════════════════
// Predicciones analíticas por escala
// ═══════════════════════════════════════════════════════════════

/**
 * σ_T / ⟨T⟩ = √(2 / (3N)) — fluctuación relativa de temperatura
 * instantánea en un gas de N partículas (3D) en equilibrio térmico.
 *
 * Derivación rápida: T_inst = (2/3N)·KE, KE = ½Σm_i v_i². En equilibrio,
 * cada componente v_i^α es N(0, √(T/m)). var(KE) = (3N/2)T², por tanto
 * var(T_inst) = (2/(3N))·T².
 */
export function predictTemperatureRSD(N: number): number {
  return Math.sqrt(2 / (3 * N));
}

/**
 * Umbrales empíricos del límite continuo para 3D LJ.
 * (Hansen & McDonald §2.4; valores típicos, no absolutos.)
 */
export const SCALE_THRESHOLDS = {
  /** Temperatura fiable al 10% → N mínimo. */
  temperature10pct: 67,
  /** Temperatura fiable al 5% → N mínimo. */
  temperature5pct: 267,
  /** Temperatura fiable al 1% → N mínimo. */
  temperature1pct: 6667,
  /** Presión vía virial — ~10× más lento que T. */
  pressure5pct: 2500,
  /** Coeficientes de transporte (η, κ) — ~100× más lento. */
  transport10pct: 10000,
} as const;

/**
 * Dado N deseado y la error-bar máximo tolerable (rsd), devuelve si
 * alcanza para: temperatura, presión, transporte. Orientativo.
 */
export function scaleLimitCheck(
  N: number, rsdThreshold = 0.05,
): { temperature: boolean; pressure: boolean; transport: boolean } {
  const predT = predictTemperatureRSD(N);
  // Presión: ~3× peor; transporte: ~10× peor. Rule of thumb.
  return {
    temperature: predT <= rsdThreshold,
    pressure:    predT * 3 <= rsdThreshold,
    transport:   predT * 10 <= rsdThreshold,
  };
}
