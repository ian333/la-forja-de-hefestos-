/**
 * ESFÉRICO — el "tambor": lóbulos ESFÉRICOS (curvos en 2 direcciones) + hembra = negativo
 * cóncavo con gap de aceite. La visión del usuario, con su física y su LÍMITE honesto.
 *
 *  · Contacto esférico (Hertz puntual) reparte MÁS que el cilíndrico/barril (Hertz línea):
 *    curvo en 2 direcciones → parche elíptico/circular → menos presión, más carga, sin cortante.
 *  · La hembra cóncava (socket) que ABRAZA el lóbulo esférico = conformidad 2D → R* enorme.
 *  · AUTOCENTRADO en V: el socket esférico centra el disco en radial Y axial (geométrico).
 *  · LÍMITE honesto: el socket NO puede ser el negativo EXACTO (R_socket=R_lóbulo) o el lóbulo
 *    se TRABA (no puede orbitar). El GAP del aceite es la holgura que permite el giro → la
 *    conformidad tiene techo: R_socket = R_lóbulo + δ, con δ ≥ gap. Hay un δ óptimo.
 *  · Menos discos: a más área por disco, menos discos para la misma carga.
 *
 * Tribología real: Hertz puntual, conformidad, Stribeck. SI internamente; APIs mm/N/MPa.
 */

const E_PLA = 3.5e9, NU_PLA = 0.36;
export function eStar(E1 = E_PLA, nu1 = NU_PLA, E2 = E_PLA, nu2 = NU_PLA): number {
  return 1 / ((1 - nu1 * nu1) / E1 + (1 - nu2 * nu2) / E2);
}

// ───────────────────────────────────────────────────────────────────────────
// 1) Contacto ESFÉRICO (Hertz puntual): bola Rlobe en socket cóncavo Rsocket
// ───────────────────────────────────────────────────────────────────────────
/** Radio EFECTIVO de la conformidad esférica: 1/R* = 1/Rlobe − 1/Rsocket (socket cóncavo).
 *  Socket que abraza (Rsocket→Rlobe⁺) → R*→∞ (mucha área). */
export function effRadiusSphere(Rlobe_mm: number, Rsocket_mm: number): number {
  if (Rsocket_mm <= Rlobe_mm) return Infinity;
  return 1 / (1 / Rlobe_mm - 1 / Rsocket_mm);
}
/** Contacto Hertz PUNTUAL (esfera-esfera/socket): radio del parche y presión pico. */
export function hertzSphere(p: { F_N: number; Rstar_mm: number; Estar_Pa: number }): { contactRadius_mm: number; area_mm2: number; pMax_MPa: number } {
  const Rstar = p.Rstar_mm / 1000;
  const a = Math.cbrt((3 * p.F_N * Rstar) / (4 * p.Estar_Pa)); // m
  const area = Math.PI * a * a;
  const pMax = (3 * p.F_N) / (2 * Math.PI * a * a);
  return { contactRadius_mm: +(a * 1000).toFixed(4), area_mm2: +(area * 1e6).toFixed(4), pMax_MPa: +(pMax / 1e6).toFixed(3) };
}
/** Contacto Hertz de LÍNEA (el barril cilíndrico, para comparar): semiancho y presión. */
export function hertzLine(p: { Wprime_Npm: number; Rstar_mm: number; Estar_Pa: number }): { halfWidth_mm: number; pMax_MPa: number } {
  const Rstar = p.Rstar_mm / 1000;
  const b = Math.sqrt((4 * p.Wprime_Npm * Rstar) / (Math.PI * p.Estar_Pa));
  const pMax = Math.sqrt((p.Wprime_Npm * p.Estar_Pa) / (Math.PI * Rstar));
  return { halfWidth_mm: +(b * 1000).toFixed(4), pMax_MPa: +(pMax / 1e6).toFixed(3) };
}

// ───────────────────────────────────────────────────────────────────────────
// 2) El LÍMITE: la hembra no puede ser el negativo EXACTO (se traba)
// ───────────────────────────────────────────────────────────────────────────
/**
 * La conformidad útil tiene techo: el socket debe exceder al lóbulo por δ = R_socket − R_lobe
 * ≥ gap de aceite, para que el lóbulo pueda ORBITAR (entrar/salir del socket) sin trabarse.
 * δ→0 ⇒ R*→∞ pero TRABA. Devuelve el R_socket más conforme que aún gira, y avisa si traba.
 */
export function lockLimit(Rlobe_mm: number, oilGap_mm: number, orbitE_mm: number): { minDelta_mm: number; RsocketMin_mm: number; locksIfExact: boolean } {
  // holgura mínima = gap de aceite + una fracción de la órbita (el lóbulo se desplaza al orbitar)
  const minDelta = oilGap_mm + 0.15 * orbitE_mm;
  return { minDelta_mm: +minDelta.toFixed(4), RsocketMin_mm: +(Rlobe_mm + minDelta).toFixed(4), locksIfExact: true };
}
/** Conformidad C = Rlobe/Rsocket ∈ (0,1). 1 = negativo exacto (traba). El útil < 1. */
export function conformity(Rlobe_mm: number, Rsocket_mm: number): number {
  return +(Rlobe_mm / Rsocket_mm).toFixed(4);
}

// ───────────────────────────────────────────────────────────────────────────
// 3) AUTOCENTRADO en V/esférico — radial Y axial (geométrico)
// ───────────────────────────────────────────────────────────────────────────
/**
 * Rigidez de centrado del socket esférico: si el disco deriva δ, el lóbulo sube por la pared
 * cóncava y la componente normal lo regresa. k ≈ k_contacto·(δ/a) geométrico. Cota: el socket
 * esférico centra en 2 ejes (radial+axial), a diferencia del rodillo cilíndrico (solo radial).
 */
export function vCentering(p: { F_N: number; Rstar_mm: number; Estar_Pa: number }): { stiffness_N_per_mm: number; axes: number } {
  const hz = hertzSphere(p);
  // rigidez normal de Hertz puntual: dF/dδ = 2·a·E* ; lateral ≈ fracción geométrica
  const a = hz.contactRadius_mm / 1000;
  const kNormal = 2 * a * p.Estar_Pa;          // N/m
  const kLateral = kNormal * 0.5;              // ~mitad por geometría del socket
  return { stiffness_N_per_mm: +(kLateral / 1000).toFixed(2), axes: 2 };
}

// ───────────────────────────────────────────────────────────────────────────
// 4) MENOS DISCOS: a más área por disco, menos discos para la misma carga
// ───────────────────────────────────────────────────────────────────────────
/** Discos necesarios para una carga, dado el contacto por lóbulo y los lóbulos activos. */
export function discsForLoad(p: { totalLoad_N: number; pMaxAllow_MPa: number; areaPerContact_mm2: number; activeLobes: number }): number {
  const perDisc = p.pMaxAllow_MPa * p.areaPerContact_mm2 * p.activeLobes * 0.5; // ~p_prom·área·contactos
  return Math.max(1, Math.ceil(p.totalLoad_N / Math.max(1e-6, perDisc)));
}

// ───────────────────────────────────────────────────────────────────────────
// 5) DISEÑO esférico para la caja — barre la conformidad hasta el techo (lock)
// ───────────────────────────────────────────────────────────────────────────
export interface SphereInput {
  Rr: number; T: number; lobes: number; E: number; gap: number; radialLoad_N: number; activeLobes?: number;
}
export function sphereSweep(inp: SphereInput) {
  const Es = eStar();
  const active = inp.activeLobes ?? Math.max(1, Math.round(inp.lobes / 2));
  const F = inp.radialLoad_N / active;                       // por contacto
  const Rlobe = inp.Rr;                                       // radio esférico del lóbulo ~ Rr
  // techo de conformidad por el lock
  const lim = lockLimit(Rlobe, inp.gap, inp.E);
  const Rsock_tight = lim.RsocketMin_mm;                      // lo más conforme que aún gira
  const Rsock_loose = Rlobe * 2.5;                            // un socket flojo (poco conforme)
  const evalAt = (Rsock: number) => {
    const Rstar = effRadiusSphere(Rlobe, Rsock);
    const hz = hertzSphere({ F_N: F, Rstar_mm: Rstar, Estar_Pa: Es });
    return { Rsocket_mm: +Rsock.toFixed(3), conformity: conformity(Rlobe, Rsock), Rstar_mm: +Rstar.toFixed(3), ...hz };
  };
  const tight = evalAt(Rsock_tight), loose = evalAt(Rsock_loose);
  // comparación contra el barril (línea) a la misma carga repartida en L=T
  const line = hertzLine({ Wprime_Npm: (F) / (inp.T / 1000), Rstar_mm: effRadiusSphere(Rlobe, Rsock_tight), Estar_Pa: Es });
  const vc = vCentering({ F_N: F, Rstar_mm: effRadiusSphere(Rlobe, Rsock_tight), Estar_Pa: Es });
  const discs = discsForLoad({ totalLoad_N: inp.radialLoad_N, pMaxAllow_MPa: 25, areaPerContact_mm2: tight.area_mm2, activeLobes: active });
  return {
    Estar_GPa: +(Es / 1e9).toFixed(3), loadPerContact_N: +F.toFixed(3), activeLobes: active,
    lockLimit: lim,
    conformeTight: tight, conformeLoose: loose,
    areaGain_vs_loose_x: +(tight.area_mm2 / Math.max(1e-9, loose.area_mm2)).toFixed(2),
    pressureDrop_vs_loose_x: +(loose.pMax_MPa / Math.max(1e-9, tight.pMax_MPa)).toFixed(2),
    vCentering: vc,            // centra en 2 ejes (radial+axial), vs 1 del cilindro
    discsNeeded: discs,        // menos discos a más conformidad
    note: `socket más conforme que gira: R=${Rsock_tight} (δ=${lim.minDelta_mm}mm = gap+órbita). Negativo EXACTO trabaría. Esférico centra en 2 ejes; ~${discs} disco(s) bastan.`,
  };
}
