/**
 * COJINETE-JAULA — autocentrado HIDRODINÁMICO del disco cicloidal en la jaula de
 * rodillos. La decisión de diseño con el usuario: la JAULA de los rodillos ES el
 * soporte (estructural y rígido, parte de la hembra — NO un árbol de soportes
 * aparte que se rompe). Y el hueco de holgura, en vez de pared PLANA, lleva una
 * FIGURA ANGULADA (cuña convergente) que, con el aceite, genera presión y CENTRA
 * el disco. Real: ecuación de Reynolds 1D (patín inclinado). Puro, testeable.
 *
 * POR QUÉ ÁNGULO Y NO PLANO (la física que pidió el usuario):
 *   Reynolds 1D:  d/dx(h³ dp/dx) = 6·μ·U·dh/dx.
 *   Película PLANA (dh/dx = 0)  → dp/dx = 0 → presión 0 → CERO centrado (Couette puro).
 *   Cuña CONVERGENTE (dh/dx ≠ 0) → el aceite se arrastra al estrecharse → joroba de
 *   presión → fuerza de sustentación/centrado. El ÁNGULO es lo que crea el centrado.
 *
 * DOBLE FUNCIÓN del ángulo (por eso "nos ayuda"):
 *   (1) ACEITE: la cuña genera la presión de centrado (esto).
 *   (2) IMPRESIÓN: un land plano horizontal es voladizo; un land en rampa ≥45° se
 *       AUTO-SOPORTA → la jaula sale sin soportes de slicer. El mismo ángulo, dos
 *       trabajos.  Ver [[supports]] (voladizo β≥βcrit) y printsim (g_min de fusión).
 *
 * Unidades SI internas (m, Pa·s, m/s, N); las APIs aceptan mm y reportan N, µm, MPa.
 * Órdenes de magnitud honestos; calibrables con la prueba real del usuario en la K1.
 */

// ───────────────────────────────────────────────────────────────────────────
// 1) La CUÑA de Reynolds — patín inclinado (la base de TODO el autocentrado)
// ───────────────────────────────────────────────────────────────────────────
/**
 * Presión ADIMENSIONAL P̄ = p·h₂²/(6·μ·U·B) en función del espesor local
 * normalizado H = h/h₂, para una cuña lineal que va de h₁ (entrada, H=n) a h₂
 * (salida, H=1), con n = h₁/h₂. Cerrada (satisface p=0 en ambos extremos):
 *   P̄(H) = 1/(n−1) · [ (1/H − 1/n) − n/(n+1)·(1/H² − 1/n²) ].
 * Pico en el espesor MEDIO ARMÓNICO  H* = 2n/(n+1) = h_m/h₂.
 */
export function wedgePressureBar(n: number, H: number): number {
  if (n <= 1) return 0; // plano (n=1) → presión 0 SIEMPRE (la lección física)
  return (1 / (n - 1)) * ((1 / H - 1 / n) - (n / (n + 1)) * (1 / (H * H) - 1 / (n * n)));
}
/** Perfil de presión a lo largo de la cuña: ξ∈[0,1] (0=entrada ancha, 1=salida angosta). */
export function wedgePressureProfile(n: number, samples = 60): { xi: number; H: number; Pbar: number }[] {
  const out: { xi: number; H: number; Pbar: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const xi = i / samples;
    const H = n - (n - 1) * xi; // H: n → 1
    out.push({ xi, H, Pbar: wedgePressureBar(n, H) });
  }
  return out;
}

/**
 * Coeficiente ADIMENSIONAL de carga W̄ = ∫₀¹ P̄ dξ (carga por unidad de ancho /
 * (6μU B²/h₂²)). Cerrada:  W̄(n) = [ ln n − 2(n−1)/(n+1) ] / (n−1)².
 * Plano (n→1) → 0. Máximo en n* ≈ 2.19 (la cuña óptima de un patín fijo).
 */
export function wedgeLoadCoeff(n: number): number {
  if (n <= 1) return 0;
  return (Math.log(n) - (2 * (n - 1)) / (n + 1)) / ((n - 1) * (n - 1));
}
/** El mismo W̄ por integración numérica del perfil — para CRUZAR contra la cerrada. */
export function wedgeLoadCoeffNumeric(n: number, samples = 2000): number {
  const prof = wedgePressureProfile(n, samples);
  let s = 0;
  for (let i = 1; i < prof.length; i++) s += ((prof[i].Pbar + prof[i - 1].Pbar) / 2) * (prof[i].xi - prof[i - 1].xi);
  return s;
}
/** Razón de cuña ÓPTIMA n* = h₁/h₂ que maximiza la carga (búsqueda dorada). */
export function optimumWedgeRatio(): { n: number; coeff: number } {
  let lo = 1.2, hi = 4, gr = (Math.sqrt(5) - 1) / 2;
  let c = hi - gr * (hi - lo), d = lo + gr * (hi - lo);
  for (let i = 0; i < 80; i++) {
    if (wedgeLoadCoeff(c) > wedgeLoadCoeff(d)) hi = d; else lo = c;
    c = hi - gr * (hi - lo); d = lo + gr * (hi - lo);
  }
  const n = (lo + hi) / 2;
  return { n: +n.toFixed(4), coeff: +wedgeLoadCoeff(n).toFixed(5) };
}

// ───────────────────────────────────────────────────────────────────────────
// 2) Carga REAL (N) de un land de la jaula, y el AUTOCENTRADO (rigidez)
// ───────────────────────────────────────────────────────────────────────────
export interface LandOp {
  muPaS: number;   // viscosidad dinámica del aceite (Pa·s). Aceite ligero ~0.1.
  U_mps: number;   // velocidad de arrastre del aceite en el contacto (m/s).
  B_mm: number;    // longitud TANGENCIAL del land (la cuña), mm.
  L_mm: number;    // ancho AXIAL del land (≈ espesor del disco T), mm.
  h2_mm: number;   // película MÍNIMA (salida de la cuña), mm.
  n: number;       // razón de cuña h₁/h₂ (≈2.2 óptima).
}
/** Carga hidrodinámica que sostiene UN land: W = 6·μ·U·B²·L/h₂² · W̄(n). */
export function landLoadN(op: LandOp): number {
  const mu = op.muPaS, U = op.U_mps;
  const B = op.B_mm / 1000, L = op.L_mm / 1000, h2 = op.h2_mm / 1000;
  return (6 * mu * U * B * B * L) / (h2 * h2) * wedgeLoadCoeff(op.n);
}
/**
 * AUTOCENTRADO: si el disco deriva una distancia e hacia un rodillo, la película
 * mínima de ESE land se cierra (h₂→h₂−e) y la del opuesto se abre (h₂→h₂+e). La
 * carga sube como 1/h₂² al cerrarse y baja al abrirse → fuerza NETA restauradora.
 * Devuelve la fuerza de centrado (N) para una deriva e (mm) y la RIGIDEZ k≈dF/de
 * en el centro. F>0 ⇒ empuja de regreso (estable). Crece ~1/h² → muerde justo
 * cuando el disco se acerca al metal (protege el contacto).
 */
export function selfCenter(op: LandOp, e_mm: number): { F_N: number; closingLoad_N: number; openingLoad_N: number } {
  const close = landLoadN({ ...op, h2_mm: Math.max(1e-3, op.h2_mm - e_mm) });
  const open = landLoadN({ ...op, h2_mm: op.h2_mm + e_mm });
  return { F_N: +(close - open).toFixed(5), closingLoad_N: +close.toFixed(5), openingLoad_N: +open.toFixed(5) };
}
export function centeringStiffness_N_per_mm(op: LandOp, de_mm = 0.01): number {
  return +(selfCenter(op, de_mm).F_N / de_mm).toFixed(4);
}

/**
 * Película de APRIETE (squeeze-film): aun SIN arrastre, cuando el disco se ACERCA
 * al rodillo a velocidad V el aceite tiene que ser expulsado y resiste como 1/h³
 * (más fuerte que la cuña). Es el amortiguador anti-impacto del contacto.
 *   W_squeeze ≈ μ·V·B³·L / h³   (placa que se aproxima, orden de magnitud).
 */
export function squeezeFilmN(opts: { muPaS: number; V_mps: number; B_mm: number; L_mm: number; h_mm: number }): number {
  const B = opts.B_mm / 1000, L = opts.L_mm / 1000, h = opts.h_mm / 1000;
  return (opts.muPaS * opts.V_mps * B * B * B * L) / (h * h * h);
}

// ───────────────────────────────────────────────────────────────────────────
// 3) De la HOLGURA impresa a la CUÑA (geometría que sí imprime)
// ───────────────────────────────────────────────────────────────────────────
/**
 * El presupuesto de holgura `clearance` (la pared hoy plana) se reparte en la cuña:
 * la boca ANCHA = la holgura (h₁ = clearance), la GARGANTA = h₁/n. Para no fundir en
 * print-in-place la garganta debe seguir ≥ g_min de fusión (~0.30 con ventilador).
 */
export function wedgeFromClearance(clearance_mm: number, n: number, fusionGapMin_mm = 0.3): {
  h1_mm: number; h2_mm: number; n: number; printable: boolean; throatMargin_mm: number;
} {
  const h1 = clearance_mm;
  const h2 = +(h1 / n).toFixed(4);
  return { h1_mm: +h1.toFixed(4), h2_mm: h2, n, printable: h2 >= fusionGapMin_mm, throatMargin_mm: +(h2 - fusionGapMin_mm).toFixed(4) };
}
/** Ángulo de la rampa de la cuña en la dirección de DESLIZAMIENTO (poco profundo). */
export function wedgeRampDeg(h1_mm: number, h2_mm: number, B_mm: number): number {
  return +((Math.atan2(h1_mm - h2_mm, B_mm) * 180) / Math.PI).toFixed(3);
}
/** ¿El land se AUTO-SOPORTA al imprimir? La cara de la rampa en la dirección de
 *  construcción (Z) debe estar a ≥ β_crit de la horizontal. Aquí el land se inclina
 *  `buildTiltDeg` respecto a la cama; se imprime sin soporte si ≥ 45°. */
export function landSelfSupports(buildTiltDeg: number, critDeg = 45): boolean {
  return buildTiltDeg >= critDeg;
}

// ───────────────────────────────────────────────────────────────────────────
// 4) DISEÑO de la cuña de la jaula para NUESTRA caja — el veredicto completo
// ───────────────────────────────────────────────────────────────────────────
export interface CageWedgeInput {
  R: number; Rr: number; lobes: number; E: number; T: number; gap: number; // caja (mm)
  rpmIn: number;        // rpm de entrada (motor)
  muPaS?: number;       // aceite (default 0.1 Pa·s, aceite ligero)
  landTiltDeg?: number; // inclinación del land en Z para auto-soporte (default 45)
  fusionGapMin?: number;// g_min de fusión print-in-place (default 0.30 con ventilador)
}
export function designCageWedge(inp: CageWedgeInput) {
  const mu = inp.muPaS ?? 0.1;
  const opt = optimumWedgeRatio();                                  // n* ≈ 2.19
  const wedge = wedgeFromClearance(inp.gap, opt.n, inp.fusionGapMin ?? 0.3);
  // Land: longitud tangencial ≈ paso de rodillo a rodillo limitado por Rr; ancho axial = T.
  const rollerPitch = (2 * Math.PI * inp.R) / (inp.lobes + 1);      // arco entre rodillos
  const B = Math.min(rollerPitch * 0.5, 6 * inp.Rr);               // land razonable (mm)
  const L = inp.T;
  // Velocidad de arrastre: el contacto lóbulo↔rodillo barre con la órbita. Cota
  // honesta U ≈ ω_in · E (el excéntrico arrastra la película). ω = 2π·rpm/60.
  const omega = (2 * Math.PI * inp.rpmIn) / 60;
  const U = omega * (inp.E / 1000);                                 // m/s
  const op: LandOp = { muPaS: mu, U_mps: U, B_mm: B, L_mm: L, h2_mm: wedge.h2_mm, n: opt.n };
  const loadPerLand = landLoadN(op);
  const k = centeringStiffness_N_per_mm(op);
  const rollers = inp.lobes + 1;
  const ramp = wedgeRampDeg(wedge.h1_mm, wedge.h2_mm, B);
  // peso de un disco (carga que el centrado debe gestionar) — orden de magnitud
  const discMassG = Math.PI * (inp.R * 0.85) ** 2 * inp.T * 1.24e-3;
  const discWeightN = (discMassG / 1000) * 9.81;
  return {
    wedgeRatio: opt.n, wedgeLoadCoeff: opt.coeff,
    h1_mm: wedge.h1_mm, h2_mm: wedge.h2_mm,
    printable: wedge.printable, throatMargin_mm: wedge.throatMargin_mm,
    landB_mm: +B.toFixed(3), landL_mm: +L.toFixed(3),
    rampDeg: ramp,                                  // ángulo hidrodinámico (poco profundo)
    landTiltDeg: inp.landTiltDeg ?? 45,             // ángulo de auto-soporte en Z
    selfSupports: landSelfSupports(inp.landTiltDeg ?? 45),
    U_mps: +U.toFixed(4), omega_rad_s: +omega.toFixed(3),
    loadPerLand_N: +loadPerLand.toFixed(5),
    rollers, totalLoad_N: +(loadPerLand * rollers).toFixed(5),
    centeringStiffness_N_per_mm: k,
    discWeight_N: +discWeightN.toFixed(4),
    // El centrado hidrodinámico no FLOTA el disco a esta escala de holgura, pero la
    // fuerza es restauradora (estable) y crece ~1/h² al cerrarse el hueco → protege.
    floatsDisc: loadPerLand * rollers > discWeightN,
    centersStably: k > 0,
  };
}
