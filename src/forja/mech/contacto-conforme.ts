/**
 * CONTACTO-CONFORME — dos peticiones del usuario, misma física continua:
 *  (A) los CHAFLANES de centrado del retenedor de leva deben ser CURVAS (filetes), no
 *      chaflán recto, para que el esfuerzo sea CONTINUO y no CORTANTE. = bajar el factor
 *      de concentración de esfuerzo Kt (esquina aguda Kt→∞; filete Kt finito).
 *  (B) el exterior de los lóbulos: el contacto lóbulo↔rodillo debe ser CONFORME (el
 *      rodillo abraza el valle) → MÁS ÁREA efectiva, no sólo la punta ("discos, no yoyos").
 *      Clave del usuario: "sin aumentar la fricción, pero si FLOTA vale la pena". Real:
 *      en FULL-FILM la fricción = coef. de tracción × CARGA (independiente del área);
 *      repartir en más área BAJA la presión y ESPESA la película, sin subir la fricción.
 *      Sólo en frontera/mixto el área subiría la fricción → por eso "si flota" es la clave.
 *
 * Tribología real: Inglis (Kt), Hertz línea, Dowson-Higginson (EHL), tracción EHL.
 * SI internamente; APIs en mm/N/MPa/µm. Calibrable con la prueba real del usuario.
 */

// ───────────────────────────────────────────────────────────────────────────
// (A) Chaflán recto → CURVA: el concentrador de esfuerzo (Kt)
// ───────────────────────────────────────────────────────────────────────────
/**
 * Factor de concentración de esfuerzo de una entalla/esquina (Inglis): Kt = 1 + 2·√(t/ρ),
 * t = profundidad del escalón (el lip del collar), ρ = radio de la punta. Esquina AGUDA
 * (ρ→0) → Kt→∞ (ahí se CIZALLA). Filete (ρ=r) → Kt finito; ρ grande → Kt→1 (continuo).
 */
export function notchKt(stepDepth_mm: number, tipRadius_mm: number): number {
  if (tipRadius_mm <= 0) return Infinity;
  return +(1 + 2 * Math.sqrt(stepDepth_mm / tipRadius_mm)).toFixed(3);
}
/** Radio de filete que pone Kt en un objetivo (despeja ρ de la Inglis). */
export function filletRadiusForKt(stepDepth_mm: number, targetKt: number): number {
  if (targetKt <= 1) return Infinity;
  const s = (targetKt - 1) / 2;
  return +(stepDepth_mm / (s * s)).toFixed(4);
}

// ───────────────────────────────────────────────────────────────────────────
// (B) Contacto CONFORME lóbulo↔rodillo — más área, menos presión (Hertz línea)
// ───────────────────────────────────────────────────────────────────────────
const E_PLA = 3.5e9, NU_PLA = 0.36; // PLA: módulo y Poisson
/** Módulo efectivo E* del par (PLA-PLA por defecto). 1/E* = Σ (1−νᵢ²)/Eᵢ. */
export function eStar(E1 = E_PLA, nu1 = NU_PLA, E2 = E_PLA, nu2 = NU_PLA): number {
  return 1 / ((1 - nu1 * nu1) / E1 + (1 - nu2 * nu2) / E2);
}
/**
 * Radio EFECTIVO de la conformidad: rodillo CONVEXO (Rr) en el VALLE CÓNCAVO del lóbulo
 * (Rvalley): 1/R* = 1/Rr − 1/Rvalley. Valle suelto (Rvalley≫Rr) → R*≈Rr (punta, "yoyo").
 * Valle que ABRAZA (Rvalley→Rr⁺) → R*→∞ (conforme, mucha área). Más conformidad = R* mayor.
 */
export function effectiveRadius_mm(Rr_mm: number, Rvalley_mm: number): number {
  if (Rvalley_mm <= Rr_mm) return Infinity;
  return 1 / (1 / Rr_mm - 1 / Rvalley_mm);
}
/** Contacto Hertz de LÍNEA: semiancho b y presión pico. W'=carga por unidad de largo. */
export function hertzLine(p: { Wprime_Npm: number; Rstar_mm: number; Estar_Pa: number }): { halfWidth_mm: number; pMax_MPa: number; contactWidth_mm: number } {
  const Rstar = p.Rstar_mm / 1000;
  const b = Math.sqrt((4 * p.Wprime_Npm * Rstar) / (Math.PI * p.Estar_Pa)); // m
  const pMax = Math.sqrt((p.Wprime_Npm * p.Estar_Pa) / (Math.PI * Rstar));   // Pa
  return { halfWidth_mm: +(b * 1000).toFixed(4), pMax_MPa: +(pMax / 1e6).toFixed(3), contactWidth_mm: +(2 * b * 1000).toFixed(4) };
}

// ───────────────────────────────────────────────────────────────────────────
// (B) ¿FLOTA? Película EHL (Dowson-Higginson, línea) y su régimen
// ───────────────────────────────────────────────────────────────────────────
/**
 * Espesor MÍNIMO de película EHL (Dowson-Higginson, contacto línea):
 *   h_min/R* = 2.65 · U*^0.7 · G*^0.54 · W*^-0.13,
 *   U* = η₀·u/(E*·R*),  G* = α·E*,  W* = W'/(E*·R*).
 * Más conforme (R*↑) → película más gruesa. h_min en µm.
 */
export function ehlFilm_um(p: { eta0: number; u: number; Estar_Pa: number; Rstar_mm: number; alpha_Pa: number; Wprime_Npm: number }): number {
  const Rstar = p.Rstar_mm / 1000;
  const U = (p.eta0 * p.u) / (p.Estar_Pa * Rstar);
  const G = p.alpha_Pa * p.Estar_Pa;
  const W = p.Wprime_Npm / (p.Estar_Pa * Rstar);
  const h = Rstar * 2.65 * Math.pow(U, 0.7) * Math.pow(G, 0.54) * Math.pow(W, -0.13); // m
  return +(h * 1e6).toFixed(4); // µm
}
export type Regime = 'frontera' | 'mixto' | 'full-film';
export function lambdaRatio(hMin_um: number, sigma_um: number): number { return +(hMin_um / sigma_um).toFixed(3); }
export function regime(lambda: number): Regime { return lambda >= 3 ? 'full-film' : lambda >= 1 ? 'mixto' : 'frontera'; }

// ───────────────────────────────────────────────────────────────────────────
// (B) FRICCIÓN vs ÁREA — la clave: en full-film NO sube con el área
// ───────────────────────────────────────────────────────────────────────────
/**
 * Fuerza de fricción del contacto. En FULL-FILM: F = μ_t · W (coef. de tracción × CARGA),
 * INDEPENDIENTE del área → repartir en más área no la sube. En FRONTERA: F = μ_b · W pero
 * el desgaste/área importan; ahí más área SÍ penaliza. Por eso "si flota vale la pena".
 */
export function frictionForce_N(p: { regime: Regime; load_N: number; tractionCoeff?: number; boundaryCoeff?: number }): number {
  const mu = p.regime === 'full-film' ? (p.tractionCoeff ?? 0.04) : (p.boundaryCoeff ?? 0.3);
  return +(mu * p.load_N).toFixed(4);
}

// ───────────────────────────────────────────────────────────────────────────
// (B) Autocentrado EXTERNO: N rodillos = N pads que centran el disco
// ───────────────────────────────────────────────────────────────────────────
/**
 * Rigidez de centrado externo aproximada: si el disco deriva δ hacia un rodillo, ese
 * contacto se aprieta (Hertz: la carga ∝ aprox δ^? ; aquí cota lineal por el resorte de
 * contacto k_c = π·E*·L/4 por contacto, sumado sobre los rodillos ACTIVOS). Devuelve la
 * rigidez radial total — más rodillos conformes activos = disco más centrado.
 */
export function externalCenteringStiffness_N_per_mm(p: { Estar_Pa: number; L_mm: number; activeRollers: number }): number {
  const kc = (Math.PI * p.Estar_Pa * (p.L_mm / 1000)) / 4; // N/m por contacto (resorte Hertz línea)
  return +((kc * p.activeRollers) / 1000).toFixed(2); // N/mm
}

// ───────────────────────────────────────────────────────────────────────────
// DISEÑO: barrido de conformidad para NUESTRA caja — prueba la intuición del usuario
// ───────────────────────────────────────────────────────────────────────────
export interface ConformalInput {
  Rr: number; T: number; lobes: number; radialLoad_N: number; // caja
  eta0?: number; u?: number; alpha?: number; sigma_um?: number; // tribo
  RvalleyTip?: number; RvalleyHug?: number; // valle "yoyo" (suelto) vs "abraza" (conforme)
}
export function conformalSweep(inp: ConformalInput) {
  const Es = eStar();
  const active = Math.max(1, Math.round(inp.lobes / 2)); // ~mitad de los lóbulos en contacto
  const Wp = (inp.radialLoad_N / active) / (inp.T / 1000); // N/m por contacto
  const tribo = { eta0: inp.eta0 ?? 0.1, u: inp.u ?? 0.1, alpha: inp.alpha ?? 2e-8, sigma: inp.sigma_um ?? 8 };
  const tip = inp.RvalleyTip ?? inp.Rr * 2.2;  // valle suelto = casi punta
  const hug = inp.RvalleyHug ?? inp.Rr * 1.12; // valle que abraza = conforme
  const eval1 = (Rvalley: number) => {
    const Rstar = effectiveRadius_mm(inp.Rr, Rvalley);
    const hz = hertzLine({ Wprime_Npm: Wp, Rstar_mm: Rstar, Estar_Pa: Es });
    const h = ehlFilm_um({ eta0: tribo.eta0, u: tribo.u, Estar_Pa: Es, Rstar_mm: Rstar, alpha_Pa: tribo.alpha, Wprime_Npm: Wp });
    const lam = lambdaRatio(h, tribo.sigma); const reg = regime(lam);
    const load = inp.radialLoad_N / active;
    return {
      Rvalley_mm: +Rvalley.toFixed(3), Rstar_mm: +Rstar.toFixed(3),
      contactWidth_mm: hz.contactWidth_mm, pMax_MPa: hz.pMax_MPa,
      hMin_um: h, lambda: lam, regime: reg,
      friction_N: frictionForce_N({ regime: reg, load_N: load }),
    };
  };
  const yoyo = eval1(tip), conforme = eval1(hug);
  return {
    Estar_GPa: +(Es / 1e9).toFixed(3), activeRollers: active, Wprime_Npm: +Wp.toFixed(1),
    yoyo, conforme,
    // veredicto: el conforme da más área y menos presión; la fricción NO sube si flota.
    areaGain_x: +(conforme.contactWidth_mm / yoyo.contactWidth_mm).toFixed(2),
    pressureDrop_x: +(yoyo.pMax_MPa / conforme.pMax_MPa).toFixed(2),
    frictionRatio: +(conforme.friction_N / Math.max(1e-9, yoyo.friction_N)).toFixed(2),
    externalCentering_N_per_mm: externalCenteringStiffness_N_per_mm({ Estar_Pa: Es, L_mm: inp.T, activeRollers: active }),
    note: conforme.regime === yoyo.regime
      ? `conforme: ${(conforme.contactWidth_mm / yoyo.contactWidth_mm).toFixed(1)}× área, ${(yoyo.pMax_MPa / conforme.pMax_MPa).toFixed(1)}× menos presión; fricción ×${(conforme.friction_N / Math.max(1e-9, yoyo.friction_N)).toFixed(2)} (mismo régimen ${conforme.regime}). Vale la pena ${conforme.regime === 'full-film' ? 'y FLOTA' : '(flota sólo si liso+rápido+viscoso)'}.`
      : `conforme sube el régimen a ${conforme.regime}: más área baja la presión y espesa la película.`,
  };
}
