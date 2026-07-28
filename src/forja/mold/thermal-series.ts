/**
 * SERIES ANALÍTICAS DE ENFRIAMIENTO — la VERDAD EXACTA contra la que se
 * valida todo lo numérico (Kazmer cap 9 nace de aquí).
 *
 * PLACA (slab espesor h, paredes a T_cool):   θ(x,t) = Σ Fourier senos
 *   línea central: θ_c(t) = Σₖ (4/π)·(−1)ᵏ/(2k+1)·exp(−(2k+1)²π²·Fo)
 *   con Fo = α·t/h². El "4/π" de Eq 9.5 ES el primer término (k=0).
 * CILINDRO (⌀D):  θ_c(t) = Σₖ [2/(λₖ·J₁(λₖ))]·exp(−4λₖ²·Fo_D),  Fo_D = αt/D²
 *   λₖ = raíces de J₀. El "23.1" de Eq 9.6 ES 4·λ₁² = 4·2.4048² = 23.13 y el
 *   "1.60" ES 2/(λ₁·J₁(λ₁)) = 2/(2.4048·0.5191) — los números mágicos del
 *   libro DERIVADOS, no copiados.
 */

/** J₀ y J₁ de Bessel (Abramowitz & Stegun 9.4 — error < 1e-7). */
export function besselJ0(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    // (coeficientes NR bessj0 — la 1a versión traía los de Y₀ y Newton
    //  convergía al 9º cero, 27.49: cero REAL de J₀ pero raíz equivocada)
    const p1 = 57568490574.0 + y * (-13362590354.0 + y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))));
    const p2 = 57568490411.0 + y * (1029532985.0 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y))));
    return p1 / p2;
  }
  const z = 8 / ax, y = z * z, x0 = ax - 0.785398164;
  const p1 = 1 + y * (-0.1098628627e-2 + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
  const p2 = -0.1562499995e-1 + y * (0.1430488765e-3 + y * (-0.6911147651e-5 + y * (0.7621095161e-6 + y * -0.934935152e-7)));
  return Math.sqrt(0.636619772 / ax) * (Math.cos(x0) * p1 - z * Math.sin(x0) * p2);
}
export function besselJ1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const p1 = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.48260 + y * -30.16036606)))));
    const p2 = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return p1 / p2;
  }
  const z = 8 / ax, y = z * z, x0 = ax - 2.356194491;
  const p1 = 1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const p2 = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const r = Math.sqrt(0.636619772 / ax) * (Math.cos(x0) * p1 - z * Math.sin(x0) * p2);
  return x < 0 ? -r : r;
}

/** primeras N raíces de J₀ (Newton desde asintótica λₖ ≈ (k−¼)π). */
export function besselJ0Roots(n: number): number[] {
  const roots: number[] = [];
  for (let k = 1; k <= n; k++) {
    let x = (k - 0.25) * Math.PI;
    for (let i = 0; i < 12; i++) x += besselJ0(x) / besselJ1(x);   // J₀' = −J₁
    roots.push(x);
  }
  return roots;
}

/** θ de LÍNEA CENTRAL de placa (N términos de la serie de Fourier). */
export function slabCenterlineTheta(FoH: number, nTerms = 30): number {
  let s = 0;
  for (let k = 0; k < nTerms; k++) {
    const m = 2 * k + 1;
    s += ((4 / Math.PI) * ((k % 2 === 0 ? 1 : -1) / m)) * Math.exp(-m * m * Math.PI * Math.PI * FoH);
  }
  return s;
}

/** θ PROMEDIO de placa (Eq 9.5 nota: criterio menos conservador, 8/π²). */
export function slabAverageTheta(FoH: number, nTerms = 30): number {
  let s = 0;
  for (let k = 0; k < nTerms; k++) {
    const m = 2 * k + 1;
    s += (8 / (Math.PI * Math.PI)) * (1 / (m * m)) * Math.exp(-m * m * Math.PI * Math.PI * FoH);
  }
  return s;
}

/** θ de EJE de cilindro (serie de Bessel, N términos). */
export function cylinderCenterTheta(FoD: number, nTerms = 20): number {
  const roots = besselJ0Roots(nTerms);
  let s = 0;
  for (const lam of roots) {
    s += (2 / (lam * besselJ1(lam))) * Math.exp(-4 * lam * lam * FoD);
  }
  return s;
}

/** t_c EXACTO por la serie (bisección sobre θ_target) — el juez de Eq 9.5/9.6. */
export function tcSlabSeriesS(alpha: number, hM: number, tMelt: number, tCool: number, tEject: number, nTerms = 30): number {
  const target = (tEject - tCool) / (tMelt - tCool);
  let lo = 1e-4, hi = 10;                                   // Fo
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (slabCenterlineTheta(mid, nTerms) > target) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * hM * hM / alpha;
}
export function tcCylinderSeriesS(alpha: number, dM: number, tMelt: number, tCool: number, tEject: number, nTerms = 20): number {
  const target = (tEject - tCool) / (tMelt - tCool);
  let lo = 1e-4, hi = 10;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (cylinderCenterTheta(mid, nTerms) > target) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * dM * dM / alpha;
}
