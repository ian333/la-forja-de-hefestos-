/**
 * Relatividad General — órbita relativista en un campo de Schwarzschild.
 *
 * Método de Binet relativista: trabajamos con u(φ) = 1/r. La ecuación es
 *
 *     d²u/dφ² + u = GM/h² + (3GM/c²) u²
 *
 * donde h = L/m es el momento angular específico. El término 3GM u²/c² es
 * la corrección post-Newtoniana — integrable a mano en GR de Schwarzschild
 * en el plano ecuatorial, sin resolver geodésicas completas.
 *
 * Esta es la ecuación que Einstein usó para predecir los 43"/siglo de
 * precesión del perihelio de Mercurio (1915).
 *
 * Referencias:
 *   - Weinberg, Gravitation and Cosmology (1972), §8.6
 *   - Misner–Thorne–Wheeler, Gravitation (1973), §25.5
 */

import { G, c, YEAR } from './constants';

export interface RelativisticOrbitParams {
  M: number;           // masa central (kg)
  a: number;           // semi-eje mayor inicial (m)
  e: number;           // excentricidad inicial (0..<1)
  c_eff?: number;      // velocidad de la luz efectiva (para exagerar el efecto en pedagogía)
}

export interface OrbitPoint {
  r: number;           // m
  phi: number;         // rad
  x: number; y: number;
  t?: number;          // tiempo transcurrido en esa φ (opcional, integrado aparte)
}

/**
 * Integra un número `nOrbits` de órbitas (en φ) para el problema de
 * Schwarzschild. Devuelve el camino (r, φ) y la precesión medida por órbita.
 *
 * dphi es el paso angular de integración.
 */
export function integrateSchwarzschild(
  params: RelativisticOrbitParams,
  nOrbits: number = 1,
  dphi: number = 1e-3,
  useGR: boolean = true,
): {
  path: OrbitPoint[];
  perihelionAnglesRad: number[];   // φ de cada perihelio detectado
  precessionPerOrbitRad: number;   // promedio sobre órbitas medidas
  h: number;
} {
  const { M, a, e } = params;
  const cc = params.c_eff ?? c;
  const mu = G * M;
  // Momento angular específico desde a,e:
  //   rp = a(1-e), vp = sqrt(mu*(1+e)/(a*(1-e)))  → h = rp*vp
  const rp = a * (1 - e);
  const vp = Math.sqrt(mu * (1 + e) / rp);
  const h  = rp * vp;
  const GMh2 = mu / (h * h);
  const kGR  = useGR ? 3 * mu / (cc * cc) : 0;

  // Estado inicial en periapsis: u0 = 1/rp, du/dφ = 0.
  // Damos un paso fuera del arranque para que du pueda cruzar 0
  // limpiamente desde el lado positivo (apoapsis) → negativo (periapsis)
  // y la detección no se confunda con el arranque.
  let u = 1 / rp;
  let du = 0;
  let phi = 0;

  // Paso RK4 para d²u/dφ²
  const ddot = (u: number) => -u + GMh2 + kGR * u * u;

  const path: OrbitPoint[] = [{ r: 1/u, phi: 0, x: 1/u, y: 0 }];
  const perihelia: number[] = [0];
  let prevDu = du;
  let prevPhi = phi;

  const maxPhi = nOrbits * 2 * Math.PI * 1.05 + 0.5;

  while (phi < maxPhi) {
    const h1u = du;
    const k1  = ddot(u);
    const h2u = du + 0.5 * dphi * k1;
    const k2  = ddot(u + 0.5 * dphi * h1u);
    const h3u = du + 0.5 * dphi * k2;
    const k3  = ddot(u + 0.5 * dphi * h2u);
    const h4u = du + dphi * k3;
    const k4  = ddot(u + dphi * h3u);
    u  += dphi * (h1u + 2 * h2u + 2 * h3u + h4u) / 6;
    du += dphi * (k1  + 2 * k2  + 2 * k3  + k4 ) / 6;
    phi += dphi;

    // Detect periapsis: du was ≥0 al final del paso previo, ahora <0 →
    // u cruzó un máximo local. Interpolación lineal para phi_peak con
    // resolución sub-paso (necesario para la precesión de ~1e-7 rad).
    if (prevDu > 0 && du <= 0 && phi > 0.1) {
      const frac = prevDu / (prevDu - du);     // 0..1
      const phiPeak = prevPhi + dphi * frac;
      perihelia.push(phiPeak);
    }
    prevDu = du;
    prevPhi = phi;

    const r = 1 / u;
    path.push({ r, phi, x: r * Math.cos(phi), y: r * Math.sin(phi) });
    if (perihelia.length >= nOrbits + 1) break;
  }

  // Precession per orbit: Δφ between consecutive periapses minus 2π
  let meanDphi = 0;
  let count = 0;
  for (let i = 1; i < perihelia.length; i++) {
    meanDphi += (perihelia[i] - perihelia[i-1]) - 2 * Math.PI;
    count++;
  }
  const precessionPerOrbitRad = count > 0 ? meanDphi / count : 0;

  return { path, perihelionAnglesRad: perihelia, precessionPerOrbitRad, h };
}

/** Radianes → arcosegundos. */
export const RAD_TO_ARCSEC = 180 / Math.PI * 3600;

/**
 * Precesión esperada analíticamente en GR débil:
 *   Δφ_GR = 6π G M / (c² a (1 - e²))   rad/órbita
 */
export function analyticPrecession(M: number, a: number, e: number, c_eff = c): number {
  return 6 * Math.PI * G * M / (c_eff * c_eff * a * (1 - e * e));
}

/** Período orbital newtoniano (s): T = 2π √(a³/μ). */
export function orbitalPeriod(M: number, a: number): number {
  return 2 * Math.PI * Math.sqrt(a*a*a / (G * M));
}

// ─── Black-hole visuals (no simulación, solo geometría) ──────────────────

/** Radio de Schwarzschild r_s = 2GM/c². */
export function schwarzschildRadius(M: number): number {
  return 2 * G * M / (c * c);
}

/** Radio de la ISCO (última órbita circular estable) en Schwarzschild: r = 3 r_s. */
export function iscoRadius(M: number): number {
  return 3 * schwarzschildRadius(M);
}

/** Radio de la esfera de fotones: r = 1.5 r_s. */
export function photonSphereRadius(M: number): number {
  return 1.5 * schwarzschildRadius(M);
}
