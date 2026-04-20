/**
 * ══════════════════════════════════════════════════════════════════════
 *  solar — Geometría solar y flujo actínico
 * ══════════════════════════════════════════════════════════════════════
 *
 * Calcula posición del sol en el cielo y flujo de fotones UV (actínico)
 * que llega al suelo. Base para química atmosférica (fotólisis) y
 * radiación.
 *
 * El flujo actínico es lo que controla las "J values" — constantes de
 * velocidad de reacciones fotoquímicas:
 *     A + hν → productos
 *     d[A]/dt = -J·[A]
 *     J = ∫ σ(λ) · Φ(λ) · F(λ, θ) dλ
 * donde σ es sección de absorción, Φ es yield cuántico, F es flujo actínico.
 *
 * Ref [SO1] Madronich, S. "Photodissociation in the atmosphere: 1. Actinic
 *           flux and the effects of ground reflections and clouds",
 *           J. Geophys. Res. 92, 9740-9752 (1987).
 * Ref [SO2] Reda, I. & Andreas, A. "Solar position algorithm for solar
 *           radiation applications", NREL Report TP-560-34302 (2008).
 * Ref [SO3] Michalsky, J.J. "The Astronomical Almanac's algorithm for
 *           approximate solar position (1950-2050)", Solar Energy 40,
 *           227-235 (1988).
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// ═══════════════════════════════════════════════════════════════
// 1. GEOMETRÍA: posición del sol
// ═══════════════════════════════════════════════════════════════

/**
 * Día juliano continuo desde 2000-01-01 12:00 UT (J2000.0).
 * Incluye fracción decimal del día (hora UT).
 */
export function julianDay(year: number, month: number, day: number, hourUT = 12): number {
  let Y = year, M = month;
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (Y + 4716)) +
    Math.floor(30.6001 * (M + 1)) +
    day + B - 1524.5 +
    hourUT / 24
  );
}

export interface SolarPosition {
  /** Elevación sobre horizonte [rad], positiva si sobre horizonte */
  elevation: number;
  /** Ángulo cenital = π/2 − elevation [rad] */
  zenith: number;
  /** Azimut desde norte, sentido horario [rad] */
  azimuth: number;
  /** Declinación solar [rad] */
  declination: number;
  /** Ángulo horario [rad] */
  hourAngle: number;
}

/**
 * Posición solar aproximada (Michalsky 1988, error <1° en 1950-2050).
 *
 * @param jd         Día juliano (usa julianDay)
 * @param latDeg     Latitud del observador [deg, + norte]
 * @param lonDeg     Longitud del observador [deg, + este]
 */
export function solarPosition(jd: number, latDeg: number, lonDeg: number): SolarPosition {
  const n = jd - 2451545.0;                       // días desde J2000.0
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;   // longitud media
  const g = ((357.528 + 0.9856003 * n) % 360 + 360) % 360;   // anomalía media
  // Longitud eclíptica
  const lambda = L + 1.915 * Math.sin(g * DEG) + 0.020 * Math.sin(2 * g * DEG);
  // Oblicuidad eclíptica
  const eps = 23.439 - 0.0000004 * n;
  // Ascensión recta y declinación
  const sinLam = Math.sin(lambda * DEG);
  const cosLam = Math.cos(lambda * DEG);
  const ra = Math.atan2(Math.cos(eps * DEG) * sinLam, cosLam);
  const dec = Math.asin(Math.sin(eps * DEG) * sinLam);
  // Horas UT desde medianoche UT del día civil.
  //   JD empieza a 12:00 UT, por eso sumamos 0.5 antes de tomar la parte frac.
  //   Así  UT=0  ↔  fraction=0   y   UT=12 ↔ fraction=0.5.
  const UThours = (((jd + 0.5) - Math.floor(jd + 0.5)) * 24);
  // Tiempo sidéreo medio Greenwich — factor 1.00274 convierte hora solar a sidérea
  const gmst = ((6.697375 + 0.0657098242 * n + 1.00273790935 * UThours) % 24 + 24) % 24;
  const lst = ((gmst * 15 + lonDeg) % 360 + 360) % 360; // local sidereal time en grados
  const H = lst * DEG - ra;                              // ángulo horario [rad]
  // Elevación y azimut
  const lat = latDeg * DEG;
  const sinEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const cosAz = (Math.sin(dec) - Math.sin(el) * Math.sin(lat)) / (Math.cos(el) * Math.cos(lat) || 1e-12);
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(H) > 0) az = 2 * Math.PI - az;

  return {
    elevation: el,
    zenith: Math.PI / 2 - el,
    azimuth: az,
    declination: dec,
    hourAngle: H,
  };
}

// ═══════════════════════════════════════════════════════════════
// 2. MASA DE AIRE Y ATENUACIÓN
// ═══════════════════════════════════════════════════════════════

/**
 * Masa óptica relativa (airmass) — cuánto más atmósfera atraviesa un rayo
 * solar vs. uno en el zenith. Aproximación de Kasten & Young 1989, válida
 * hasta zenith = 90°.
 *
 * Ref [SO4] Kasten, F. & Young, A.T. "Revised optical air mass tables and
 *           approximation formula", Appl. Opt. 28, 4735-4738 (1989).
 */
export function airmass(zenithRad: number): number {
  const z = zenithRad * RAD;
  if (z >= 90) return 38;       // clamp razonable cerca del horizonte
  return 1 / (Math.cos(zenithRad) + 0.50572 * Math.pow(96.07995 - z, -1.6364));
}

// ═══════════════════════════════════════════════════════════════
// 3. FLUJO ACTÍNICO (modelo de banda simple)
// ═══════════════════════════════════════════════════════════════

/**
 * Flujo actínico aproximado integrado sobre UV-B+UV-A (280-400 nm).
 * Relación fenomenológica:
 *     F(z) ≈ F₀ · cos(z) · exp(−τ·airmass(z))
 * donde τ ≈ 0.3 es la opacidad UV efectiva en atmósfera limpia.
 *
 * Para química atmosférica se usan J values tabulados; este es el factor
 * de escala geométrico/óptico que modula cada J value con la posición solar.
 *
 * Retorna [fotones/(cm²·s)], o 0 si el sol está bajo el horizonte.
 */
export function actinicFluxUV(zenithRad: number, opacity = 0.3): number {
  if (zenithRad >= Math.PI / 2) return 0;        // noche
  const F0 = 2.5e14;                              // ~ TOA UV flujo fotónico [cm⁻²·s⁻¹]
  return F0 * Math.cos(zenithRad) * Math.exp(-opacity * airmass(zenithRad));
}

// ═══════════════════════════════════════════════════════════════
// 4. FACTOR SOLAR NORMALIZADO (para acoplar a J values tabulados)
// ═══════════════════════════════════════════════════════════════

/**
 * Modulación diurna normalizada ∈ [0, 1]:
 *   1 a mediodía en el ecuador en equinoccio (sol en cenit)
 *   0 en la noche
 *
 * Las J values de MCM/IUPAC se reportan típicamente para condiciones de
 * mediodía claro. Para usarlas a otra hora/posición, multiplicamos por
 * este factor. No es exactamente riguroso (la dependencia espectral
 * cambia con ángulo) pero es suficiente para demos interactivas.
 */
export function solarModulation(zenithRad: number): number {
  if (zenithRad >= Math.PI / 2) return 0;
  const ref = actinicFluxUV(0);                  // sol en cenit
  const cur = actinicFluxUV(zenithRad);
  return Math.min(1, cur / ref);
}

// ═══════════════════════════════════════════════════════════════
// 5. CONVENIENCIA: posición del sol desde fecha local
// ═══════════════════════════════════════════════════════════════

/**
 * Atajo: dada una fecha local (y offset UTC), calcula posición solar.
 * Útil para UI donde el usuario elige "hoy a las 15:00 CDMX".
 *
 * Ejemplo: solarPositionAt(2026, 4, 18, 15, 0, 19.43, -99.13, -6)
 *   → sol a las 3 PM hora de CDMX (UTC-6) en el zócalo.
 */
export function solarPositionAt(
  year: number,
  month: number,
  day: number,
  hourLocal: number,
  minuteLocal: number,
  latDeg: number,
  lonDeg: number,
  utcOffsetHours: number,
): SolarPosition {
  const hourUT = hourLocal + minuteLocal / 60 - utcOffsetHours;
  const jd = julianDay(year, month, day, hourUT);
  return solarPosition(jd, latDeg, lonDeg);
}
