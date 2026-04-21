/**
 * ══════════════════════════════════════════════════════════════════════
 *  fisher-kpp-fit — Fit Bayesian de (D, r) a datos de cierre de herida
 * ══════════════════════════════════════════════════════════════════════
 *
 * Para los datos publicados de Heber-Katz 2004 (área restante vs días),
 * preguntamos: ¿qué valores de (D, r) son consistentes con esos puntos
 * dado un modelo Fisher-KPP? La respuesta es la posterior P(D, r | datos).
 *
 * Como solo tenemos 2 parámetros, NO necesitamos MCMC: una rejilla 2D
 * fina (~30×30) sobre (log D, log r) es exhaustiva, exacta y rápida.
 * Para >3 parámetros sí valdría MCMC; aquí grid es honesto y barato.
 *
 *   logLik(D, r) = − Σᵢ (model(tᵢ; D, r) − dataᵢ)² / (2σ²)
 *   logPrior     = log-uniforme en rangos físicos plausibles
 *   logPost      = logLik + logPrior
 *
 * Para acelerar la rejilla: sim 1D radial (eje r ∈ [0, R]) en vez de 2D.
 * 1D conserva la dinámica de cierre con O(80) cells vs O(80²) — ~80×
 * más rápido. La asimetría 2D no aporta a un agujero circular.
 *
 * Ref:
 *   · Bishop, "Pattern Recognition and ML" §1.2 — Bayesian inference.
 *   · Sivia, "Data Analysis: A Bayesian Tutorial" §2 — likelihood + prior.
 *   · Crank, "Mathematics of Diffusion" §6 — radial diffusion analítica.
 */

// ═══════════════════════════════════════════════════════════════
// Simulación radial 1D rápida
// ═══════════════════════════════════════════════════════════════

const RES_RADIAL = 60;       // 60 bins en r ∈ [0, R]
const R_DOMAIN = 2.5;         // mm — radio total del dominio (oreja)
const HOLE_R = 1.0;           // mm — radio inicial del agujero
const DT = 0.02;              // días/step

export interface DataPoint {
  day: number;
  /** Fracción de área restante ∈ [0, 1]. */
  areaFrac: number;
}

/**
 * Fisher-KPP radial: ∂u/∂t = D·∇²_r u + r·u·(1 − u/cap)
 *
 * Laplaciano radial en 1D 2D-symmetric:
 *   ∇²_r u = (1/r)·d/dr (r·du/dr)
 *
 * Discreto: para celda i (radio r_i), usar fórmula de volumen finito:
 *   ∇²_r u ≈ (r_{i+½}·(u_{i+1}−u_i) − r_{i-½}·(u_i−u_{i-1})) / (r_i·dr²)
 *
 * BC: simetría en r=0 (du/dr = 0), no-flux en r=R.
 */
export function simulateClosureRadial(
  D: number, r: number,
  daysOut: readonly number[],
  scarLimit = 1.0,
): DataPoint[] {
  const dr = R_DOMAIN / RES_RADIAL;
  const u = new Float32Array(RES_RADIAL);
  // IC: u=0 dentro del agujero, u=1 fuera
  for (let i = 0; i < RES_RADIAL; i++) {
    const ri = (i + 0.5) * dr;
    u[i] = ri < HOLE_R ? 0 : 1;
  }
  // Máscara herida (para aplicar scarLimit solo donde había agujero)
  const inWound = new Uint8Array(RES_RADIAL);
  // Áreas anulares para integrar área de herida: A_i = π((r_{i+½})² - (r_{i-½})²)
  const annularArea = new Float64Array(RES_RADIAL);
  let totalWoundArea = 0;
  for (let i = 0; i < RES_RADIAL; i++) {
    const ri = (i + 0.5) * dr;
    if (ri < HOLE_R) inWound[i] = 1;
    const rmin = i * dr;
    const rmax = (i + 1) * dr;
    annularArea[i] = Math.PI * (rmax * rmax - rmin * rmin);
    if (inWound[i]) totalWoundArea += annularArea[i];
  }
  // Para B6 con scarLimit, ajustar área a fracción del agujero (no incluye ext)
  const next = new Float32Array(RES_RADIAL);
  const out: DataPoint[] = [];
  let t = 0;
  let dayIdx = 0;
  let curU = u, curNext = next;

  // Snapshot inicial
  while (dayIdx < daysOut.length && daysOut[dayIdx] <= 0) {
    out.push({ day: daysOut[dayIdx], areaFrac: 1.0 });
    dayIdx++;
  }

  const maxDay = daysOut[daysOut.length - 1];
  const nSteps = Math.ceil(maxDay / DT);

  for (let s = 0; s < nSteps; s++) {
    // Step
    for (let i = 0; i < RES_RADIAL; i++) {
      const ri = (i + 0.5) * dr;
      const u_l = i > 0 ? curU[i - 1] : curU[i];          // simetría en r=0
      const u_r = i < RES_RADIAL - 1 ? curU[i + 1] : curU[i];   // no-flux
      const r_minus = i > 0 ? (i) * dr : 0;
      const r_plus  = (i + 1) * dr;
      const flux_r = r_plus * (u_r - curU[i]) / dr;
      const flux_l = i > 0 ? r_minus * (curU[i] - u_l) / dr : 0;
      const lap = (flux_r - flux_l) / (ri * dr);

      let reaction = r * curU[i] * (1 - curU[i] / scarLimit);
      // Si scarLimit < 1 y estamos en zona herida y u >= scarLimit, congelar
      if (inWound[i] && curU[i] >= scarLimit) reaction = Math.min(0, reaction);

      curNext[i] = curU[i] + DT * (D * lap + reaction);
      if (curNext[i] < 0) curNext[i] = 0;
      if (curNext[i] > 1) curNext[i] = 1;
    }
    // swap
    const tmp = curU; curU = curNext; curNext = tmp;
    t += DT;

    // Registrar si pasamos un día objetivo
    while (dayIdx < daysOut.length && daysOut[dayIdx] <= t + 0.5 * DT) {
      let openArea = 0;
      for (let i = 0; i < RES_RADIAL; i++) {
        if (inWound[i] && curU[i] < 0.5) openArea += annularArea[i];
      }
      out.push({ day: daysOut[dayIdx], areaFrac: openArea / totalWoundArea });
      dayIdx++;
    }
  }
  // Rellenar restantes con último valor
  while (dayIdx < daysOut.length) {
    let openArea = 0;
    for (let i = 0; i < RES_RADIAL; i++) {
      if (inWound[i] && curU[i] < 0.5) openArea += annularArea[i];
    }
    out.push({ day: daysOut[dayIdx], areaFrac: openArea / totalWoundArea });
    dayIdx++;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// Likelihood + Prior + Posterior
// ═══════════════════════════════════════════════════════════════

/**
 * Log-likelihood Gaussian: assumes data = model + N(0, σ²) noise por punto.
 * Sigma representa incertidumbre experimental + mismatch del modelo.
 */
export function logLikelihood(
  D: number, r: number,
  data: readonly DataPoint[],
  sigma = 0.05,
  scarLimit = 1.0,
): number {
  const days = data.map(d => d.day);
  const pred = simulateClosureRadial(D, r, days, scarLimit);
  let sumSq = 0;
  for (let i = 0; i < data.length; i++) {
    const dy = pred[i].areaFrac - data[i].areaFrac;
    sumSq += dy * dy;
  }
  return -sumSq / (2 * sigma * sigma) - data.length * Math.log(sigma * Math.sqrt(2 * Math.PI));
}

export interface ParamRange {
  /** Valores en log10. */
  logMin: number;
  logMax: number;
}

/**
 * Log-prior: uniforme en log-espacio dentro de [logMin, logMax],
 * −∞ fuera del rango. Refleja "no sabemos el orden de magnitud".
 */
export function logPrior(D: number, r: number, dRange: ParamRange, rRange: ParamRange): number {
  const lD = Math.log10(D);
  const lR = Math.log10(r);
  if (lD < dRange.logMin || lD > dRange.logMax) return -Infinity;
  if (lR < rRange.logMin || lR > rRange.logMax) return -Infinity;
  return 0;   // uniforme en log
}

// ═══════════════════════════════════════════════════════════════
// Grid posterior
// ═══════════════════════════════════════════════════════════════

export interface GridPosterior {
  /** Valores log10 de D en eje X. */
  logD: Float64Array;
  /** Valores log10 de r en eje Y. */
  logR: Float64Array;
  /** Posterior normalizada (suma = 1). Layout: [iD * nR + iR]. */
  P: Float64Array;
  /** Log-posterior crudo (no normalizado). */
  logP: Float64Array;
  /** MAP (Maximum a Posteriori). */
  mapD: number;
  mapR: number;
  mapLogP: number;
  /** Marginales. */
  margD: Float64Array;   // length nD
  margR: Float64Array;   // length nR
}

/**
 * Calcula la posterior en una rejilla 2D log-uniforme. nD × nR evaluaciones
 * de simulateClosureRadial (cada una ~3-5ms en RES_RADIAL=60).
 */
export function gridPosterior(
  data: readonly DataPoint[],
  dRange: ParamRange, rRange: ParamRange,
  nD: number, nR: number,
  sigma = 0.05, scarLimit = 1.0,
): GridPosterior {
  const logD = new Float64Array(nD);
  const logR = new Float64Array(nR);
  for (let i = 0; i < nD; i++) {
    logD[i] = dRange.logMin + (dRange.logMax - dRange.logMin) * (i + 0.5) / nD;
  }
  for (let j = 0; j < nR; j++) {
    logR[j] = rRange.logMin + (rRange.logMax - rRange.logMin) * (j + 0.5) / nR;
  }
  const logP = new Float64Array(nD * nR);
  let mapLogP = -Infinity;
  let mapD = 0, mapR = 0;
  for (let i = 0; i < nD; i++) {
    const D = Math.pow(10, logD[i]);
    for (let j = 0; j < nR; j++) {
      const r = Math.pow(10, logR[j]);
      const lp = logPrior(D, r, dRange, rRange) + logLikelihood(D, r, data, sigma, scarLimit);
      logP[i * nR + j] = lp;
      if (lp > mapLogP) { mapLogP = lp; mapD = D; mapR = r; }
    }
  }
  // Normalizar: P = exp(logP - max) / Σexp
  const P = new Float64Array(nD * nR);
  let sum = 0;
  for (let k = 0; k < logP.length; k++) {
    P[k] = Math.exp(logP[k] - mapLogP);
    sum += P[k];
  }
  for (let k = 0; k < P.length; k++) P[k] /= sum;
  // Marginales
  const margD = new Float64Array(nD);
  const margR = new Float64Array(nR);
  for (let i = 0; i < nD; i++) {
    let s = 0;
    for (let j = 0; j < nR; j++) s += P[i * nR + j];
    margD[i] = s;
  }
  for (let j = 0; j < nR; j++) {
    let s = 0;
    for (let i = 0; i < nD; i++) s += P[i * nR + j];
    margR[j] = s;
  }
  return { logD, logR, P, logP, mapD, mapR, mapLogP, margD, margR };
}

// ═══════════════════════════════════════════════════════════════
// Sampling y CI
// ═══════════════════════════════════════════════════════════════

/**
 * Muestrea N puntos (D, r) de la posterior discreta. Útil para posterior
 * predictive (correr el modelo con cada muestra → banda de incertidumbre).
 */
export function sampleFromPosterior(
  post: GridPosterior, n: number, rng: () => number = Math.random,
): { D: number; r: number }[] {
  const cdf = new Float64Array(post.P.length);
  let acc = 0;
  for (let k = 0; k < post.P.length; k++) {
    acc += post.P[k];
    cdf[k] = acc;
  }
  const out: { D: number; r: number }[] = [];
  const nR = post.logR.length;
  for (let s = 0; s < n; s++) {
    const u = rng();
    // bisección
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cdf[m] < u) lo = m + 1; else hi = m;
    }
    const i = Math.floor(lo / nR);
    const j = lo % nR;
    const D = Math.pow(10, post.logD[i]);
    const r = Math.pow(10, post.logR[j]);
    out.push({ D, r });
  }
  return out;
}

/**
 * Intervalo de credibilidad (HDI aproximado por percentiles) para un
 * marginal 1D. Devuelve (low, high) tal que el área dentro = `mass`.
 */
export function credibleInterval(
  marg: Float64Array, axis: Float64Array, mass = 0.95,
): { low: number; high: number; median: number } {
  // CDF
  const cdf = new Float64Array(marg.length);
  let acc = 0;
  for (let i = 0; i < marg.length; i++) { acc += marg[i]; cdf[i] = acc; }
  const lowQ = (1 - mass) / 2;
  const highQ = 1 - lowQ;
  const findQ = (q: number) => {
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cdf[m] < q) lo = m + 1; else hi = m;
    }
    return axis[lo];
  };
  return {
    low: findQ(lowQ),
    high: findQ(highQ),
    median: findQ(0.5),
  };
}
