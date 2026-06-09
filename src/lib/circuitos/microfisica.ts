/**
 * microfisica.ts — la física REAL que hay debajo del símbolo de circuito.
 *
 * Nada de "cablecitos con puntitos". Aquí están las fórmulas con las que se
 * dibuja lo que de verdad pasa:
 *   - Drude: por qué la corriente se vuelve CALOR (electrones que aceleran en
 *     el campo E y chocan contra la red → entregan energía → fonones).
 *   - Biot-Savart: el CAMPO magnético real de una bobina.
 *   - Band gap → λ → color: por qué un LED tiene SU color (la energía del salto
 *     del electrón sale como un fotón de longitud de onda exacta).
 *
 * Puro y testeable en node. Constantes en SI. Verificado vs fórmula cerrada en
 * __tests__/microfisica.test.ts.
 */

// ── Constantes físicas (SI) ──────────────────────────────────────────────
export const MU0 = 4 * Math.PI * 1e-7;        // permeabilidad del vacío [H/m]
export const E_CHARGE = 1.602176634e-19;      // carga elemental [C]
export const M_E = 9.1093837015e-31;          // masa del electrón [kg]
export const H_PLANCK = 6.62607015e-34;       // constante de Planck [J·s]
export const C_LIGHT = 2.99792458e8;          // velocidad de la luz [m/s]
export const EV = 1.602176634e-19;            // 1 electronvolt [J]

// ════════════════════════════════════════════════════════════════════════
// DRUDE — el modelo de por qué un conductor calienta
// ════════════════════════════════════════════════════════════════════════
//
// Un electrón en un campo E acelera (a = qE/m) pero cada τ segundos choca
// contra un ion de la red y pierde su velocidad ganada. El resultado neto es
// un arrastre LENTO (drift) montado sobre un jiggle térmico furioso:
//
//     v_drift = (qτ/m)·E = μ·E          (μ = movilidad)
//     J = n·q·v_drift = σ·E             (σ = conductividad)
//     σ = n·q²·τ/m
//     p = σ·E²  = J·E                   (densidad de potencia disipada [W/m³])
//
// La clave que el alumno debe SENTIR: la potencia va como E² (o I²R). El doble
// de voltaje no calienta el doble, calienta CUATRO veces.

/** Movilidad μ = qτ/m [m²/(V·s)]. */
export function mobility(tau: number, m = M_E, q = E_CHARGE): number {
  return (q * tau) / m;
}

/** Velocidad de arrastre v_d = μ·E [m/s]. Es diminuta (~mm/s) comparada con el jiggle térmico (~10⁵ m/s). */
export function driftSpeed(E: number, tau: number, m = M_E, q = E_CHARGE): number {
  return mobility(tau, m, q) * E;
}

/** Conductividad σ = n·q²·τ/m [S/m]. */
export function conductivity(n: number, tau: number, m = M_E, q = E_CHARGE): number {
  return (n * q * q * tau) / m;
}

/** Densidad de potencia disipada (calor de Joule) p = σ·E² [W/m³]. */
export function joulePowerDensity(sigma: number, E: number): number {
  return sigma * E * E;
}

// ── RNG seedable (mulberry32) — determinismo para tests y escenas ────────
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Electrón Drude en unidades escaladas de escena (no SI). */
export interface DrudeElectron {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
}

/**
 * Un paso del modelo de Drude (unidades de escena).
 *   - El campo acelera en +x: vx += accel·dt.
 *   - Con probabilidad dt/τ ocurre un choque: el electrón se re-termaliza.
 * Devuelve:
 *   - `work`: trabajo del campo este paso (F·v·dt = accel·vx·dt). Es el calor
 *     de Joule HONESTO — en régimen permanente ⟨work⟩ = accel²·τ ∝ E² (el
 *     jiggle térmico promedia a cero). Úsalo para calentar la red.
 *   - `heat`: energía cinética que el electrón llevaba al chocar (para el
 *     destello visual del impacto).
 */
export function stepDrude(
  e: DrudeElectron,
  accel: number,
  dt: number,
  tau: number,
  vthermal: number,
  rng: () => number,
): { collided: boolean; heat: number; work: number } {
  e.vx += accel * dt;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.z += e.vz * dt;
  const work = accel * e.vx * dt; // trabajo del campo = F·v·dt (calor de Joule)
  if (rng() < dt / tau) {
    const heat = 0.5 * e.vx * e.vx; // energía cinética al impacto (destello)
    // re-termalización: dirección aleatoria con rapidez ~vthermal (media cero en x)
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    e.vx = vthermal * Math.sin(phi) * Math.cos(theta);
    e.vy = vthermal * Math.sin(phi) * Math.sin(theta);
    e.vz = vthermal * Math.cos(phi);
    return { collided: true, heat, work };
  }
  return { collided: false, heat: 0, work };
}

// ════════════════════════════════════════════════════════════════════════
// BIOT-SAVART — el campo magnético real de una bobina
// ════════════════════════════════════════════════════════════════════════

export type Vec3 = [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

/** Genera los segmentos (a→b) de una hélice (solenoide) centrada en el origen, eje +x. */
export function helixSegments(
  turns: number,
  radius: number,
  length: number,
  perTurn = 48,
): Array<{ a: Vec3; b: Vec3 }> {
  const segs: Array<{ a: Vec3; b: Vec3 }> = [];
  const N = Math.max(2, Math.round(turns * perTurn));
  const pt = (i: number): Vec3 => {
    const t = i / N;            // 0..1
    const ang = t * turns * Math.PI * 2;
    const x = (t - 0.5) * length;
    return [x, radius * Math.cos(ang), radius * Math.sin(ang)];
  };
  for (let i = 0; i < N; i++) segs.push({ a: pt(i), b: pt(i + 1) });
  return segs;
}

/**
 * Campo B en un punto por integración de Biot-Savart sobre segmentos de
 * corriente: dB = (μ0/4π) I (dl × r̂)/r². Devuelve el vector B [T] (si I en A
 * y geometría en m). Para visualizar field lines se usa la DIRECCIÓN.
 */
export function biotSavart(point: Vec3, segments: Array<{ a: Vec3; b: Vec3 }>, I: number): Vec3 {
  const k = (MU0 * I) / (4 * Math.PI);
  let bx = 0, by = 0, bz = 0;
  for (const s of segments) {
    const mid: Vec3 = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2];
    const dl = sub(s.b, s.a);
    const r = sub(point, mid);
    const rmag = norm(r);
    if (rmag < 1e-9) continue;
    const dB = cross(dl, r);
    const inv = 1 / (rmag * rmag * rmag);
    bx += dB[0] * inv;
    by += dB[1] * inv;
    bz += dB[2] * inv;
  }
  return [k * bx, k * by, k * bz];
}

/** B en el centro de un solenoide finito sobre el eje [T]. → μ0·n·I cuando L≫R. */
export function solenoidBCenter(nPerLength: number, I: number, length: number, radius: number): number {
  return (MU0 * nPerLength * I) / Math.sqrt(1 + (2 * radius / length) ** 2);
}

/** B en el eje de una espira circular de radio R, a distancia x del centro [T]. */
export function loopBOnAxis(I: number, R: number, x: number): number {
  return (MU0 * I * R * R) / (2 * Math.pow(R * R + x * x, 1.5));
}

// ════════════════════════════════════════════════════════════════════════
// LED — por qué la luz tiene SU color
// ════════════════════════════════════════════════════════════════════════
//
// Cuando un electrón cae a un hueco a través de la unión, suelta exactamente
// la energía del band gap. Esa energía sale como un fotón:
//     E_g = h·c/λ   →   λ = h·c/E_g
// Por eso el color del LED lo fija el MATERIAL (su gap), no el voltaje.

/** Longitud de onda del fotón emitido por un gap de Eg [eV] → λ [nm]. */
export function bandgapToWavelengthNm(EgEv: number): number {
  return (H_PLANCK * C_LIGHT) / (EgEv * EV) * 1e9;
}

/** Voltaje de encendido aproximado del LED ≈ Eg/q (en volts). */
export function ledForwardVoltage(EgEv: number): number {
  return EgEv; // Eg en eV ≈ V_f en volts (qV = Eg)
}

/**
 * Color RGB (0..1) de una longitud de onda visible [nm]. Aproximación estándar
 * (Bruton) del espectro visible 380–780 nm. Fuera del visible → tinte tenue.
 */
export function wavelengthToRGB(nm: number): Vec3 {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / (440 - 380); b = 1; }
  else if (nm < 490) { g = (nm - 440) / (490 - 440); b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / (510 - 490); }
  else if (nm < 580) { r = (nm - 510) / (580 - 510); g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / (645 - 580); }
  else if (nm <= 780) { r = 1; }
  else { r = 0.35; } // infrarrojo: rojo profundo tenue (invisible, lo evocamos)
  if (nm < 380) { b = 0.35; } // ultravioleta: violeta tenue
  // atenuación en los extremos del visible
  let f = 1;
  if (nm >= 380 && nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm > 700 && nm <= 780) f = 0.3 + (0.7 * (780 - nm)) / 80;
  const gamma = 0.8;
  const adj = (c: number): number => (c <= 0 ? 0 : Math.pow(c * f, gamma));
  return [adj(r), adj(g), adj(b)];
}
