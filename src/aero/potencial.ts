/**
 * ✈️ La Forja AERO — FLUJO POTENCIAL DE JOUKOWSKI (el corazón matemático)
 * =======================================================================
 * Módulo PURO compartido por el laboratorio (physics.html#fluids/aero) y el
 * cine (AeroClase). Nada de React aquí: funciones deterministas en sus args.
 *
 * FÍSICA REAL (Anderson caps. 3-4; Kuethe & Chow 5ª ed.):
 *
 *   Transformación de Joukowski:  z = ζ + a²/ζ
 *     mapea el círculo |ζ| = a a una placa plana de cuerda 4a en el plano z.
 *     Preserva ∇²φ = 0 → el flujo mapeado sigue siendo potencial exacto.
 *
 *   Potencial complejo del cilindro con circulación Γ:
 *     w(ζ) = U·(ζ·e^{-iα} + a²·e^{iα}/ζ) + iΓ·ln(ζ)/(2π)
 *     dw/dζ = U·(e^{-iα} − a²·e^{iα}/ζ²) + iΓ/(2π·ζ)
 *     u − iv = (dw/dζ)/(dz/dζ),   dz/dζ = 1 − a²/ζ²
 *
 *   Condición de Kutta: en el borde de salida (ζ = a) el jacobiano se anula;
 *     la velocidad solo es finita si Γ = 4π·U·a·sin(α). La naturaleza ELIGE
 *     esa circulación — de ahí sale toda la sustentación.
 *
 *   Kutta-Joukowski:  L' = ρ·U·Γ  [N/m]   →   Cl = Γ/(2·U·a) = 2π·sin(α)
 *     (cuerda c = 4a → Cl = ρUΓ / (½ρU²·4a) = Γ/(2Ua))
 *
 *   Bernoulli:  Cp = 1 − |u/U|²   (incompresible, estacionario)
 *
 * El parámetro `gamma` es sobrescribible a propósito: el cine necesita mostrar
 * el flujo FALSO con Γ=0 (el aire doblando el borde de salida a velocidad
 * absurda) para que se ENTIENDA por qué Kutta. No es invención: es la otra
 * solución matemática, etiquetada como tal.
 */

export const JOUKOWSKI_A = 0.52; // radio del círculo [m] — cuerda de la placa = 4a ≈ 2.08
export const U_INF = 1.0;        // velocidad de flujo libre [m/s]
export const RHO_0 = 1.225;      // kg/m³ (ISA nivel del mar — ver atmosfera.ts)

/** Circulación de Kutta: la ÚNICA Γ que deja el borde de salida limpio. */
export function kuttaGamma(alpha: number, U: number = U_INF, a: number = JOUKOWSKI_A): number {
  return 4 * Math.PI * U * a * Math.sin(alpha);
}

/** Cl de thin-airfoil, derivado de Kutta-Joukowski con cuerda 4a. */
export function liftCoefficient(alpha: number): number {
  return 2 * Math.PI * Math.sin(alpha);
}

/** Sustentación por unidad de envergadura L' = ρ·U·Γ [N/m]. */
export function liftPerSpan(alpha: number, U: number = U_INF, rho: number = RHO_0): number {
  return rho * U * kuttaGamma(alpha, U);
}

/**
 * Inversa de Joukowski z → ζ (rama exterior |ζ| > a):
 * ζ² − z·ζ + a² = 0  →  ζ = (z ± √(z²−4a²))/2
 */
export function joukowskiInverse(zx: number, zy: number, a: number = JOUKOWSKI_A): [number, number] {
  const a2 = a * a;
  const re2 = zx * zx - zy * zy - 4 * a2;
  const im2 = 2 * zx * zy;
  const r2 = Math.sqrt(re2 * re2 + im2 * im2);
  const ang2 = Math.atan2(im2, re2);
  const sqRe = Math.sqrt(r2) * Math.cos(ang2 / 2);
  const sqIm = Math.sqrt(r2) * Math.sin(ang2 / 2);
  let zetaRe = (zx + sqRe) / 2;
  let zetaIm = (zy + sqIm) / 2;
  if (zetaRe * zetaRe + zetaIm * zetaIm < a2) {
    zetaRe = (zx - sqRe) / 2;
    zetaIm = (zy - sqIm) / 2;
  }
  return [zetaRe, zetaIm];
}

export interface FlowOpts {
  /** Circulación explícita [m²/s]. Si se omite → Kutta (la física real). */
  gamma?: number;
  U?: number;
  a?: number;
}

/**
 * Velocidad (u, v) del flujo potencial en el punto físico (px, py) para el
 * ángulo de ataque alpha [rad]. Determinista y pura. Dentro del cuerpo → (0,0).
 */
export function flowVelocity(px: number, py: number, alpha: number, opts?: FlowOpts): [number, number] {
  const U = opts?.U ?? U_INF;
  const a = opts?.a ?? JOUKOWSKI_A;
  const a2 = a * a;
  const Gamma = opts?.gamma ?? kuttaGamma(alpha, U, a);

  const [zetaRe, zetaIm] = joukowskiInverse(px, py, a);
  const mod2 = zetaRe * zetaRe + zetaIm * zetaIm;
  if (mod2 < a2 * 0.81) return [0, 0]; // dentro del cuerpo

  const cosA = Math.cos(alpha), sinA = Math.sin(alpha);
  const zeta2Re = zetaRe * zetaRe - zetaIm * zetaIm;
  const zeta2Im = 2 * zetaRe * zetaIm;
  const zeta2mod2 = zeta2Re * zeta2Re + zeta2Im * zeta2Im;
  const a2_z2Re =  a2 * zeta2Re / zeta2mod2;
  const a2_z2Im = -a2 * zeta2Im / zeta2mod2;

  const term1Re = U * cosA;
  const term1Im = -U * sinA;
  const ea_iRe = cosA * a2_z2Re - sinA * a2_z2Im;
  const ea_iIm = cosA * a2_z2Im + sinA * a2_z2Re;
  let dwRe = term1Re - U * ea_iRe;
  let dwIm = term1Im - U * ea_iIm;
  // iΓ/(2πζ) = Γ·(ζ_im + i·ζ_re)/(2π|ζ|²) — OJO: parte real POSITIVA.
  // (El lab original tenía −Γ·ζ_im aquí: eso es iΓ/(2πζ̄), no holomorfo →
  //  circulación neta CERO y flujo rápido por DEBAJO. Cazado por el test
  //  ∮u·dl y la sonda del 2026-07-13. En ζ_im=0 ambas coinciden: por eso
  //  la condición de Kutta en el borde "se veía bien" y el bug sobrevivía.)
  const twoPiMod2 = 2 * Math.PI * mod2;
  dwRe += Gamma * zetaIm / twoPiMod2;
  dwIm += Gamma * zetaRe / twoPiMod2;

  const dzRe = 1 - a2_z2Re;
  const dzIm =   - a2_z2Im;
  const dzMod2 = dzRe * dzRe + dzIm * dzIm;
  if (dzMod2 < 1e-10) return [U * cosA, -U * sinA]; // singularidad del mapa (borde)

  const uRe = (dwRe * dzRe + dwIm * dzIm) / dzMod2;
  const uIm = (dwIm * dzRe - dwRe * dzIm) / dzMod2;
  return [uRe, -uIm]; // w = u − iv → conjugar
}

/** Coeficiente de presión por Bernoulli: Cp = 1 − |u/U|². */
export function cpValue(ux: number, uy: number, U: number = U_INF): number {
  return 1 - (ux * ux + uy * uy) / (U * U);
}

export interface StreamPoint { x: number; y: number; cp: number }

/**
 * Línea de corriente por RK4 (paso de arco constante ds) desde (x0, y0).
 * Determinista: mismos args → misma polilínea.
 */
export function integrateStreamline(
  x0: number, y0: number, alpha: number, nSteps: number, ds: number, opts?: FlowOpts,
): StreamPoint[] {
  const pts: StreamPoint[] = [];
  let x = x0, y = y0;
  for (let i = 0; i < nSteps; i++) {
    const [u1, v1] = flowVelocity(x, y, alpha, opts);
    const mag1 = Math.hypot(u1, v1);
    if (mag1 < 1e-6) break;
    const k1x = u1 / mag1, k1y = v1 / mag1;
    const [u2, v2] = flowVelocity(x + 0.5 * ds * k1x, y + 0.5 * ds * k1y, alpha, opts);
    const mag2 = Math.hypot(u2, v2);
    const k2x = mag2 > 1e-6 ? u2 / mag2 : k1x;
    const k2y = mag2 > 1e-6 ? v2 / mag2 : k1y;
    const [u3, v3] = flowVelocity(x + 0.5 * ds * k2x, y + 0.5 * ds * k2y, alpha, opts);
    const mag3 = Math.hypot(u3, v3);
    const k3x = mag3 > 1e-6 ? u3 / mag3 : k2x;
    const k3y = mag3 > 1e-6 ? v3 / mag3 : k2y;
    const [u4, v4] = flowVelocity(x + ds * k3x, y + ds * k3y, alpha, opts);
    const mag4 = Math.hypot(u4, v4);
    const k4x = mag4 > 1e-6 ? u4 / mag4 : k3x;
    const k4y = mag4 > 1e-6 ? v4 / mag4 : k3y;
    x += (ds / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    y += (ds / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    const [ux, uy] = flowVelocity(x, y, alpha, opts);
    pts.push({ x, y, cp: cpValue(ux, uy, opts?.U ?? U_INF) });
    if (Math.abs(x) > 4 || Math.abs(y) > 3) break;
  }
  return pts;
}

/**
 * Trayectoria de una PARCELA de aire (línea de tiempo, no de arco): integra
 * dx/dt = u con RK4 a dt fijo y devuelve posiciones con su tiempo de vuelo.
 * Es la prueba visual del mito: la parcela de arriba NO se reencuentra con la
 * de abajo — llega ANTES.
 */
export function integrateParcel(
  x0: number, y0: number, alpha: number, nSteps: number, dt: number, opts?: FlowOpts,
): { x: number; y: number; t: number }[] {
  const pts: { x: number; y: number; t: number }[] = [];
  let x = x0, y = y0;
  for (let i = 0; i < nSteps; i++) {
    const [u1, v1] = flowVelocity(x, y, alpha, opts);
    const [u2, v2] = flowVelocity(x + 0.5 * dt * u1, y + 0.5 * dt * v1, alpha, opts);
    const [u3, v3] = flowVelocity(x + 0.5 * dt * u2, y + 0.5 * dt * v2, alpha, opts);
    const [u4, v4] = flowVelocity(x + dt * u3, y + dt * v3, alpha, opts);
    x += (dt / 6) * (u1 + 2 * u2 + 2 * u3 + u4);
    y += (dt / 6) * (v1 + 2 * v2 + 2 * v3 + v4);
    pts.push({ x, y, t: (i + 1) * dt });
    if (Math.abs(x) > 4 || Math.abs(y) > 3) break;
  }
  return pts;
}

/**
 * ∮ u·dl sobre un círculo de radio r centrado en el cuerpo — por el teorema de
 * Stokes debe dar EXACTAMENTE Γ (el vórtice ligado). Es el verificador global
 * del campo: si la implementación tuviera un error, esta integral lo delata.
 */
export function circulationIntegral(alpha: number, r: number, n: number, opts?: FlowOpts): number {
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * 2 * Math.PI;
    const px = r * Math.cos(th), py = r * Math.sin(th);
    const [u, v] = flowVelocity(px, py, alpha, opts);
    // dl = r·dθ·(-sinθ, cosθ)
    const dth = (2 * Math.PI) / n;
    acc += (u * (-Math.sin(th)) + v * Math.cos(th)) * r * dth;
  }
  return acc;
}

/**
 * Semilla en coords de PANTALLA → coords del CAMPO. El campo tiene el
 * freestream subiendo a +α (término U·e^{−iα}); la escena rota el marco −α
 * para que el viento se vea horizontal y el ala nariz-arriba. Una parcela que
 * debe ENTRAR por la izquierda de la pantalla en (sx, sy) se siembra en el
 * campo en R(+α)·(sx, sy).
 */
export function seedField(sx: number, sy: number, alpha: number): [number, number] {
  const c = Math.cos(alpha), s = Math.sin(alpha);
  return [sx * c - sy * s, sx * s + sy * c];
}

/** Perfil NACA 00xx simétrico (contorno cerrado, cosine spacing). */
export function nacaProfile(thickness: number, nPoints: number): { x: number; y: number }[] {
  const t = thickness;
  const pts: { x: number; y: number }[] = [];
  const yt = (xc: number) => 5 * t * (
    0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc * xc
    + 0.2843 * xc ** 3 - 0.1015 * xc ** 4
  );
  for (let i = 0; i <= nPoints; i++) {
    const xc = 0.5 * (1 - Math.cos(Math.PI * (i / nPoints)));
    pts.push({ x: xc, y: yt(xc) });
  }
  for (let i = nPoints; i >= 0; i--) {
    const xc = 0.5 * (1 - Math.cos(Math.PI * (i / nPoints)));
    pts.push({ x: xc, y: -yt(xc) });
  }
  return pts;
}

/** Cp → RGB: azul (presión alta) → blanco → rojo (succión). */
export function cpToColor(cpVal: number): [number, number, number] {
  const t = Math.max(-1, Math.min(1, cpVal / 1.5));
  if (t >= 0) return [t, t, 1.0];
  return [1.0, 1.0 + t, 1.0 + t];
}
