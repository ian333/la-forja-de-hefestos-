/**
 * COJINETE-CONTINUO — autocentrado HIDRODINÁMICO CONTINUO del disco sobre su leva.
 * La corrección del usuario (regla): NO es una cuña discreta (patín), es una CURVA
 * CONTINUA. El disco rueda sobre una película de aceite continua a lo largo de TODA
 * su trayectoria (la órbita): en cada punto continuo hay película. Esto es un cojinete
 * journal real (teoría de Sommerfeld/Ocvirk). Puro, testeable.
 *
 * La idea, en las palabras del usuario:
 *  · "son curvas, no hay mejor autocentrado continuo que curvas" → la película
 *      h(θ) = c·(1 + ε·cos θ) es un COSENO: continuo, se autocentra solo. En la cara-𝔦
 *      (operador 𝔄) es puro modo k=1 — el centrado ES el primer armónico de la curva.
 *  · "separada del aceite, sigue su trayectoria" → full-film: el disco NO toca metal,
 *      flota en una película continua mientras orbita.
 *  · "si se autocentra controlamos la fricción, la hacemos nula" → con película completa
 *      la fricción es solo cortante viscoso (Petroff), f ~ 0.001-0.01, y NO hay desgaste.
 *  · "solo la carga puede romper a estos bebés" → en full-film el ÚNICO modo de falla es
 *      que la CARGA suba tanto que ε→1 y h_min=c(1−ε)→0. Ni fricción ni desgaste: la carga.
 *
 * Criterio REAL de cuándo es full-film (tribología): el número λ = h_min/σ (σ = rugosidad
 * combinada de las dos superficies). λ>3 → full-film (fricción nula, sin desgaste). 1<λ<3 →
 * mixto. λ<1 → contacto de asperezas (frontera, desgaste). En FDM σ es grande → honesto:
 * a tolerancia de impresión estamos al borde; la matemática dice cuánto apretar la curva.
 *
 * Unidades: APIs en mm/N/rpm; SI internamente.
 */

// ───────────────────────────────────────────────────────────────────────────
// 1) La CURVA: la película continua h(θ) = c(1 + ε·cos θ)
// ───────────────────────────────────────────────────────────────────────────
/** Película continua alrededor del muñón. θ medido desde la línea de centros (carga). */
export function filmCurve(c_mm: number, eps: number, samples = 120): { theta: number; h_mm: number }[] {
  const out: { theta: number; h_mm: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const theta = (2 * Math.PI * i) / samples;
    out.push({ theta, h_mm: +(c_mm * (1 + eps * Math.cos(theta))).toFixed(5) });
  }
  return out;
}
export function minFilm_mm(c_mm: number, eps: number): number { return +(c_mm * (1 - eps)).toFixed(5); }
export function maxFilm_mm(c_mm: number, eps: number): number { return +(c_mm * (1 + eps)).toFixed(5); }

/**
 * Espectro de la curva en la cara-𝔦 (operador 𝔄): h(θ)=c+c·ε·cos θ → SOLO dos modos:
 * DC (k=0)=c (holgura media) y k=1=c·ε/2 (la onda de centrado). El autocentrado ES el
 * modo k=1. Una pared plana sería solo DC (ε=0) → sin modo de centrado.
 */
export function filmFourier(c_mm: number, eps: number): { dc: number; k1: number } {
  return { dc: +c_mm.toFixed(5), k1: +((c_mm * eps) / 2).toFixed(5) };
}

// ───────────────────────────────────────────────────────────────────────────
// 2) CARGA continua (Ocvirk, cojinete corto) y la excentricidad que la equilibra
// ───────────────────────────────────────────────────────────────────────────
/**
 * Carga que sostiene la película continua (solución de cojinete CORTO, Dubois-Ocvirk):
 *   W = μ·ω·R·L³/(4·c²) · ε/(1−ε²)² · √(π²(1−ε²) + 16ε²).
 * Crece con ε; cuando W sube, ε→1 y h_min→0 (el límite por CARGA).
 */
export function loadOcvirk_N(p: { muPaS: number; rpm: number; R_mm: number; L_mm: number; c_mm: number; eps: number }): number {
  const omega = (2 * Math.PI * p.rpm) / 60;
  const R = p.R_mm / 1000, L = p.L_mm / 1000, c = p.c_mm / 1000, e = p.eps;
  const f = (e / Math.pow(1 - e * e, 2)) * Math.sqrt(Math.PI * Math.PI * (1 - e * e) + 16 * e * e);
  return (p.muPaS * omega * R * Math.pow(L, 3)) / (4 * c * c) * f;
}
/** Excentricidad ε∈(0,1) que equilibra una carga dada (invierte Ocvirk, bisección). */
export function eccentricityForLoad(p: { muPaS: number; rpm: number; R_mm: number; L_mm: number; c_mm: number; W_N: number }): number {
  let lo = 1e-4, hi = 0.99999;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const w = loadOcvirk_N({ ...p, eps: mid });
    if (w < p.W_N) lo = mid; else hi = mid;
  }
  return +((lo + hi) / 2).toFixed(5);
}

// ───────────────────────────────────────────────────────────────────────────
// 3) FRICCIÓN (Petroff) — casi NULA en full-film — y el número de Sommerfeld
// ───────────────────────────────────────────────────────────────────────────
/** Coeficiente de fricción (Petroff, full-film): f = 2π·μ·ω·R²·L / (c·W). Diminuto. */
export function petroffFriction(p: { muPaS: number; rpm: number; R_mm: number; L_mm: number; c_mm: number; W_N: number }): number {
  const omega = (2 * Math.PI * p.rpm) / 60;
  const R = p.R_mm / 1000, L = p.L_mm / 1000, c = p.c_mm / 1000;
  return +((2 * Math.PI * p.muPaS * omega * R * R * L) / (c * Math.max(1e-9, p.W_N))).toFixed(6);
}
/** Número de Sommerfeld S = (μ·N/P)·(R/c)², N=rev/s, P=W/(L·D). Alto S → full-film holgado. */
export function sommerfeld(p: { muPaS: number; rpm: number; R_mm: number; L_mm: number; c_mm: number; W_N: number }): number {
  const N = p.rpm / 60, R = p.R_mm / 1000, L = p.L_mm / 1000, c = p.c_mm / 1000, D = 2 * R;
  const P = p.W_N / (L * D);
  return +((p.muPaS * N / P) * Math.pow(R / c, 2)).toFixed(4);
}

// ───────────────────────────────────────────────────────────────────────────
// 4) Régimen de lubricación (Stribeck λ = h_min/σ): full-film ⇔ fricción nula
// ───────────────────────────────────────────────────────────────────────────
export type Regime = 'frontera' | 'mixto' | 'full-film';
/** λ = h_min/σ. σ = rugosidad COMBINADA √(Ra₁²+Ra₂²). λ>3 → full-film (sin desgaste). */
export function lambdaRatio(hMin_mm: number, sigma_mm: number): number { return +(hMin_mm / sigma_mm).toFixed(3); }
export function regime(lambda: number): Regime { return lambda >= 3 ? 'full-film' : lambda >= 1 ? 'mixto' : 'frontera'; }
/**
 * Holgura ÓPTIMA que MAXIMIZA h_min a una carga dada. Física real: h_min(c)=c(1−ε(c))
 * NO es monótona — apretar la curva sube la capacidad (ε baja) pero c baja; aflojar baja
 * la capacidad (ε→1). Hay un máximo intermedio → la mejor película (la mejor chance de
 * full-film). Reporta si full-film (λ≥3) es ALCANZABLE a esa carga/velocidad.
 */
export function optimalClearanceMaxFilm(p: { muPaS: number; rpm: number; R_mm: number; L_mm: number; W_N: number; sigma_mm: number }): { c_mm: number; eps: number; hMin_mm: number; lambda: number; regime: Regime; fullFilmReachable: boolean } {
  let best = { c_mm: 0, eps: 1, hMin_mm: 0 };
  for (let c = 0.02; c <= 1.5; c += 0.004) {
    const eps = eccentricityForLoad({ ...p, c_mm: c, W_N: p.W_N });
    const hMin = c * (1 - eps);
    if (hMin > best.hMin_mm) best = { c_mm: +c.toFixed(3), eps: +eps.toFixed(4), hMin_mm: +hMin.toFixed(4) };
  }
  const lam = lambdaRatio(best.hMin_mm, p.sigma_mm);
  return { ...best, lambda: lam, regime: regime(lam), fullFilmReachable: lam >= 3 };
}
/**
 * Carga MÁXIMA que la película sostiene en full-film (h_min = 3σ ⇔ λ=3). Por encima
 * de esto la curva entra en mixto y luego frontera. ES el "solo la carga rompe a estos
 * bebés" cuantificado: el presupuesto de carga del cojinete continuo. 0 si c ≤ 3σ.
 */
export function maxLoadForFullFilm(p: { muPaS: number; rpm: number; R_mm: number; L_mm: number; c_mm: number; sigma_mm: number }): number {
  if (p.c_mm <= 3 * p.sigma_mm) return 0;
  const epsStar = 1 - (3 * p.sigma_mm) / p.c_mm;
  return +loadOcvirk_N({ ...p, eps: epsStar }).toFixed(3);
}

// ───────────────────────────────────────────────────────────────────────────
// 5) DISEÑO del cojinete continuo del disco-leva — el veredicto completo
// ───────────────────────────────────────────────────────────────────────────
export interface ContinuousBearingInput {
  shaftD: number; E: number; T: number;  // caja (mm): muñón = leva (shaftD/2+E), ancho = T
  rpmIn: number;                          // rpm de entrada
  outputTorqueNm: number;                 // par de salida (la CARGA radial real del disco)
  lobes: number;                          // reducción (par entrada = Tout/lobes)
  muPaS?: number;                         // aceite (default 0.1)
  sigma_mm?: number;                      // rugosidad combinada (default 0.03 = FDM ~Ra 20µm)
  c_mm?: number;                          // holgura a evaluar (default: la print-in-place 0.3)
}
export function designContinuousBearing(inp: ContinuousBearingInput) {
  const mu = inp.muPaS ?? 0.1, sigma = inp.sigma_mm ?? 0.03;
  const R = inp.shaftD / 2 + inp.E;                          // radio del muñón (leva), mm
  const L = inp.T;
  // CARGA radial sobre el disco: la reacción del engrane. F ≈ par de entrada / radio leva.
  const Tin = inp.outputTorqueNm / inp.lobes;               // N·m
  const W = (Tin * 1000) / R;                               // N (par/brazo)
  const cEval = inp.c_mm ?? 0.3;
  const eps = eccentricityForLoad({ muPaS: mu, rpm: inp.rpmIn, R_mm: R, L_mm: L, c_mm: cEval, W_N: W });
  const hMin = cEval * (1 - eps);
  const lam = lambdaRatio(hMin, sigma);
  const f = petroffFriction({ muPaS: mu, rpm: inp.rpmIn, R_mm: R, L_mm: L, c_mm: cEval, W_N: W });
  const So = sommerfeld({ muPaS: mu, rpm: inp.rpmIn, R_mm: R, L_mm: L, c_mm: cEval, W_N: W });
  const optC = optimalClearanceMaxFilm({ muPaS: mu, rpm: inp.rpmIn, R_mm: R, L_mm: L, W_N: W, sigma_mm: sigma });
  const four = filmFourier(cEval, eps);
  // presupuesto de carga en full-film (λ=3) a la holgura óptima → "solo la carga rompe".
  const fullFilmLoadBudget = maxLoadForFullFilm({ muPaS: mu, rpm: inp.rpmIn, R_mm: R, L_mm: L, c_mm: optC.c_mm, sigma_mm: sigma });
  return {
    journalR_mm: +R.toFixed(3), L_mm: +L.toFixed(3),
    radialLoad_N: +W.toFixed(3),
    clearanceEval_mm: cEval, eps: +eps.toFixed(4),
    hMin_mm: +hMin.toFixed(4), lambda: lam, regime: regime(lam),
    frictionCoeff: f, sommerfeld: So,
    fourier: four,                                          // DC=holgura, k1=onda de centrado
    // recomendación: holgura óptima que MAXIMIZA la película (la mejor chance de full-film)
    optimal: optC,
    fullFilmAtEval: lam >= 3,
    // "solo la carga rompe": en full-film la falla es exceder este presupuesto de carga
    fullFilmLoadBudget_N: fullFilmLoadBudget,
    loadWithinBudget: fullFilmLoadBudget > W,
    note: lam >= 3
      ? `full-film a c=${cEval}: fricción ~${f}, sin desgaste; rompe solo si la carga pasa ${fullFilmLoadBudget} N`
      : `λ=${lam} (${regime(lam)}) a c=${cEval} con ${W.toFixed(1)} N. Full-film ${optC.fullFilmReachable ? 'ALCANZABLE' : 'NO alcanzable'} a esta carga; mejor película a c≈${optC.c_mm} (λ=${optC.lambda}). Para flotar: menos par, más rpm, aceite más viscoso, o barreno más liso (σ↓).`,
  };
}
