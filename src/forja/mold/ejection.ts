/**
 * SISTEMA DE EXPULSIÓN — Kazmer cap 11 "Ejection System Design"
 * ==============================================================
 * NO un escalar de prepa: el VECTOR completo de expulsión (Fig 11.5). Dado que
 * controlamos TODAS las variables (E, CTE, ΔT, μ, draft, masa, gravedad REAL,
 * orientación de la máquina), resolvemos el balance de Newton sobre la pieza al
 * ser desmoldada:
 *
 *   σ = E·CTE·(Tsolid−Teject)                          esfuerzo residual  (11.5)
 *   F_normal  = σ·A_eff        (radial, aprieta el core)                  (11.6)
 *   F_friction= μ·F_normal     (se opone al deslizamiento)
 *   F_stick   = μ·cos(φ)·F_normal   = la "fuerza de expulsión" del libro  (11.7)
 *   W = m·g    con g = 9.81 (TIERRA, no Marte 3.71)   ← peso real, vectorial
 *   F_eject   = F_stick + W·(−ĝ·n̂) + μ·W_perp        balance sobre el eje n̂
 *
 * y la CINEMÁTICA resultante (a = (F_máquina − F_eject)/m) que da el empuje
 * RECTO a lo largo del eje de expulsión — no un bamboleo de resorte.
 *
 * Ejemplos del libro verificados: cup 1,800 N (peso desprec. → reduce al
 * escalar 11.7) y laptop bezel 4,700 N / 20 pines ⌀2.23 mm (p.267-272).
 * Pandeo de Euler del pin (11.2.4: "compressive stress can cause buckling in
 * long, slender members"). PURO: node-testeable.
 */

export interface EjectionMaterial {
  /** Módulo elástico del plástico (Pa). ABS: 2.28e9. */
  E: number;
  /** Coef. de expansión térmica CTE (1/°C). ABS: 8.83e-5. */
  cte: number;
  /** Temperatura de solidificación (°C). ABS: 132. */
  tSolid: number;
  /** Temperatura de expulsión (°C). ABS: 97. */
  tEject: number;
  /** Fricción pieza-core. Acero liso: 0.5. */
  mu: number;
  /** Esfuerzo de cedencia del plástico (Pa). ABS: 44e6. */
  sigmaYield: number;
  /** Densidad del plástico (kg/m³) — para el peso real de la pieza. ABS: 1050. */
  rho?: number;
}
export const ABS_EJECT: EjectionMaterial = { E: 2.28e9, cte: 8.83e-5, tSolid: 132, tEject: 97, mu: 0.5, sigmaYield: 44e6, rho: 1050 };

/** Gravedad REAL por cuerpo (m/s²). El default de La Forja es Tierra — NUNCA Marte. */
export const GRAVITY = { tierra: 9.81, marte: 3.71, luna: 1.62, jupiter: 24.79 } as const;

/** Esfuerzo residual de contracción térmica σ = E·CTE·ΔT  (Pa, Eq 11.5). */
export function residualStress(m: EjectionMaterial): number {
  return m.E * m.cte * (m.tSolid - m.tEject);
}

/** Eq (11.7): fuerza de expulsión escalar (sticking térmico) = μ·cos(draft)·σ·A_eff  (N). */
export function ejectionForce(m: EjectionMaterial, draftDeg: number, aEffM2: number): number {
  return m.mu * Math.cos((draftDeg * Math.PI) / 180) * residualStress(m) * aEffM2;
}

const norm3 = (v: [number, number, number]): [number, number, number] => {
  const L = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / L, v[1] / L, v[2] / L];
};
const dot3 = (a: [number, number, number], b: [number, number, number]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export interface EjectionVector {
  sigmaPa: number;           // esfuerzo residual (11.5)
  fNormalN: number;          // radial, aprieta el core (11.6)
  fFrictionN: number;        // μ·F_normal
  fStickN: number;           // sticking térmico axial (11.7) — la "fuerza" del libro
  weightN: number;           // m·g con g REAL
  weightAxialN: number;      // componente del peso sobre el eje n̂ (+ opone / − ayuda)
  guideFrictionN: number;    // μ·W_perp (peso que aprieta el core cuando no es vertical)
  fEjectN: number;           // NETO que el actuador debe vencer = stick + peso_axial + guía
  massKg: number;            // masa de la pieza (ρ·V)
  dir: [number, number, number];      // eje de expulsión n̂ (empuje de los pines)
  gravityDir: [number, number, number];
  gUsed: number;             // g aplicada (9.81 Tierra por defecto)
  notas: string[];
}

/**
 * VECTOR de expulsión completo (Fig 11.5) — el balance de fuerzas sobre la pieza
 * al ser desmoldada, con peso real y orientación de máquina. Se reduce al
 * escalar 11.7 cuando el peso es despreciable (cup/bezel del libro).
 */
export function ejectionVector(m: EjectionMaterial, o: {
  aEffM2: number;                        // área efectiva (Eq 11.8)
  draftDeg: number;
  massKg?: number;                       // masa de la pieza …
  volM3?: number;                        // … o volumen (usa ρ del material)
  ejectAxis?: [number, number, number];  // eje de empuje de los pines (default arriba [0,1,0])
  gravityDir?: [number, number, number]; // dirección de la gravedad (default abajo [0,-1,0])
  g?: number;                            // magnitud de g (default 9.81 Tierra)
}): EjectionVector {
  const notas: string[] = [];
  const g = o.g ?? GRAVITY.tierra;
  const n = norm3(o.ejectAxis ?? [0, 1, 0]);          // eje de expulsión
  const gd = norm3(o.gravityDir ?? [0, -1, 0]);       // hacia dónde jala la gravedad
  const sigma = residualStress(m);                    // 11.5
  const fNormal = sigma * o.aEffM2;                   // 11.6
  const fFriction = m.mu * fNormal;
  const fStick = m.mu * Math.cos((o.draftDeg * Math.PI) / 180) * fNormal; // 11.7

  const massKg = o.massKg ?? (o.volM3 != null ? o.volM3 * (m.rho ?? 1050) : 0);
  if (o.massKg == null && o.volM3 == null) notas.push('sin masa: se ignora el peso (como el cup del libro)');
  const W = massKg * g;
  const gn = dot3(gd, n);                              // proyección gravedad·eje ∈ [-1,1]
  const weightAxial = -W * gn;                         // + si la gravedad OPONE el empuje
  const weightPerp = W * Math.sqrt(Math.max(0, 1 - gn * gn)); // aprieta el core lateralmente
  const guideFriction = m.mu * weightPerp;             // fricción extra por el peso lateral
  if (weightAxial < -fStick) notas.push('la gravedad EXCEDE el sticking: la pieza cae sola (eyección por gravedad)');

  const fEject = fStick + weightAxial + guideFriction;
  return {
    sigmaPa: sigma, fNormalN: fNormal, fFrictionN: fFriction, fStickN: fStick,
    weightN: W, weightAxialN: weightAxial, guideFrictionN: guideFriction,
    fEjectN: Math.max(0, fEject), massKg, dir: n, gravityDir: gd, gUsed: g, notas,
  };
}

/**
 * CINEMÁTICA de la expulsión — el expulsor de una máquina real es CONTROLADO por
 * VELOCIDAD (servo/hidráulico, programado a ~20-200 mm/s) con una fuerza MÁXIMA
 * disponible (~2% del tonelaje de clamp). NO es un empuje libre que dispara la
 * pieza: la placa expulsora se mueve a `ejectVelMs` a lo largo de la carrera.
 *
 *  · libera:  F_máquina_máx ≥ F_eject  → los pines vencen el sticking
 *  · sf:      margen de fuerza (se busca ≥ 1.5)
 *  · el empuje es RECTO a lo largo del eje n̂ a velocidad constante ejectVelMs;
 *    x(t) = ejectVelMs·t hasta cubrir la carrera → tiempo = carrera / velocidad.
 * Esto define el movimiento REAL para la animación (traslación pura, no resorte).
 */
export function ejectionKinematics(o: {
  fMachineMaxN: number; fEjectN: number; ejectVelMs?: number; strokeM: number;
}): { libera: boolean; sf: number; vMs: number; timeS: number; breakForceN: number } {
  const v = o.ejectVelMs ?? 0.05;                       // 50 mm/s típico
  const libera = o.fMachineMaxN >= o.fEjectN && o.fEjectN >= 0;
  const sf = o.fEjectN > 0 ? o.fMachineMaxN / o.fEjectN : Infinity;
  return {
    libera, sf, vMs: v,
    timeS: v > 0 ? o.strokeM / v : Infinity,             // carrera a velocidad controlada
    breakForceN: o.fEjectN,                              // la fuerza a vencer al arrancar
  };
}

/**
 * Pandeo de Euler del pin de expulsión (§11.2.4: "compressive stress can cause
 * buckling in long, slender members"). Carga crítica de columna:
 *   F_crit = π²·E_acero·I / (K·L)² ,  I = π·D⁴/64  (sección circular).
 * K=2: empotrado-libre (el caso conservador de un pin voladizo). Devuelve el
 * factor de seguridad contra la carga axial por pin.
 */
export function pinBuckling(o: {
  diaMm: number; freeLenMm: number; fPerPinN: number; eSteelPa?: number; K?: number;
}): { fCritN: number; sf: number; ok: boolean } {
  const E = o.eSteelPa ?? 205e9, K = o.K ?? 2;
  const D = o.diaMm / 1000, L = o.freeLenMm / 1000;
  const I = (Math.PI * Math.pow(D, 4)) / 64;
  const fCrit = (Math.PI * Math.PI * E * I) / Math.pow(K * L, 2);
  const sf = o.fPerPinN > 0 ? fCrit / o.fPerPinN : Infinity;
  return { fCritN: fCrit, sf, ok: sf >= 2 };   // SF ≥ 2 recomendado para pines esbeltos
}

/** Eq (11.8): área efectiva de pieza con paredes y costillas (m²). */
export function effectiveArea(o: {
  h: number; L: number; W: number;
  nWalls?: number; hWall?: number; nRibs?: number; tRib?: number; hRib?: number;
}): number {
  return o.h * (2 * o.L + 2 * o.W)
    + (o.nWalls ?? 0) * o.h * (o.hWall ?? 0)
    + (o.nRibs ?? 0) * (o.tRib ?? 0) * (o.hRib ?? 0);
}

/**
 * Dimensionado de pines (Eq 11.10 + 11.12): devuelve el diámetro mínimo por
 * COMPRESIÓN (fatiga del acero) y por CORTANTE en el plástico (gobierna), para
 * `nPins` pines iguales.
 */
export function ejectorPinSizing(
  m: EjectionMaterial, fEjectN: number, nPins: number, wallM: number, sigmaFatiguePa = 450e6,
): { dMinCompressionMm: number; dMinShearMm: number; dMinMm: number; pushAreaMm2: number; perimeterM: number } {
  const aReq = fEjectN / sigmaFatiguePa;                          // Eq 11.10 (m²)
  const dComp = Math.sqrt((4 * aReq) / nPins / Math.PI);          // por pin
  const perim = (2 * fEjectN) / (m.sigmaYield * wallM);           // Eq 11.12 (m)
  const dShear = perim / nPins / Math.PI;
  return {
    dMinCompressionMm: dComp * 1000, dMinShearMm: dShear * 1000,
    dMinMm: Math.max(dComp, dShear) * 1000,
    pushAreaMm2: aReq * 1e6, perimeterM: perim,
  };
}
