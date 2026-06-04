/**
 * SIMULADOR de impresion print-in-place en la Creality K1 — la fisica que decide si
 * las piezas SE DESPEGAN o quedan fundidas (un ladrillo). Puro (sin WASM), testeable.
 *
 * No es un slicer normal: usamos TODO el sistema de la K1 (sus ventiladores) para
 * controlar la FUSION. La pregunta del usuario: cuanta AREA de contacto puede tener
 * un lobulo y aun asi despegarse. Mucha area => imposible. Aqui esta el numero.
 *
 * Unidades: mm, s, N, MPa(=N/mm2), W/m2K, J, K. Datos reales del PLA y de la K1.
 */

// ── La maquina (specs publicadas de la Creality K1) ─────────────────────────
export const K1 = {
  name: 'Creality K1',
  build: { x: 220, y: 220, z: 250 },      // mm
  maxSpeed: 600,                           // mm/s
  maxAccel: 20000,                         // mm/s2
  hotendMaxC: 300,                         // C
  bedMaxC: 100,                            // C
  maxFlow: 32,                             // mm3/s
  extrusionForceN: 50,                     // N (extrusor directo dual-gear)
  nozzle: 0.4,                             // mm
  // enfriamiento: ventilador de cabezal con ductos + auxiliar de camara 18 W
  fanOn_h: 80,                             // W/m2K (conveccion forzada, ventiladores K1)
  fanOff_h: 10,                            // W/m2K (conveccion natural)
  chamberC: 40,                            // C (camara cerrada, tibia)
} as const;

// ── Propiedades del PLA ─────────────────────────────────────────────────────
const PLA = {
  rho: 1240,        // kg/m3
  cp: 1800,         // J/kgK
  nozzleC: 210,     // C de deposicion
  glassC: 60,       // C (Tg)
  meltC: 170,       // C (debajo de esto ya no SUELDA de verdad, solo toca)
  shearMPa: 28,     // cortante en plano de capa (resistencia del alma a romper)
  coldWeldMPa: 8,   // union print-in-place "fria" (contacto breve) — debil pero NO cero
};

// ── 1) Enfriamiento del cordon (capacitancia concentrada) ───────────────────
/** Constante de tiempo termica de un cordon de diametro d (mm) con conveccion h. */
export function coolingTau(h: number, dMm = K1.nozzle): number {
  const d = dMm / 1000;                        // m
  return +((PLA.rho * PLA.cp * (d / 4)) / h).toFixed(3); // s  (V/A_sup = d/4 cilindro)
}
/** Tiempo que el cordon pasa SOLDABLE (por encima de meltC) desde nozzleC. */
export function weldWindow(h: number, ambientC = K1.chamberC): number {
  const tau = coolingTau(h);
  return +(tau * Math.log((PLA.nozzleC - ambientC) / (PLA.meltC - ambientC))).toFixed(3);
}

// ── 2) Fusion: hueco minimo para que NO se peguen las piezas ────────────────
/**
 * El cordon recien puesto cuelga (sag) hacia la pieza de abajo mientras esta
 * soldable. El sag esta limitado por difusion ~ sqrt(tiempo soldable). Calibrado a
 * la practica: a ventilador ON (ventana ~0.74 s) el print-in-place pega a ~0.3 mm.
 *   g_min = k * sqrt(t_weld),  k tal que g_min(ON)=0.30 mm.
 * Hueco mayor que g_min => NO funde => piezas separadas => DESPEGABLES.
 */
const SAG_K = 0.3 / Math.sqrt(weldWindow(K1.fanOn_h));
export function fusionGapMin(h: number): number {
  return +(SAG_K * Math.sqrt(weldWindow(h))).toFixed(3);
}
export function willFuse(gapMm: number, fanOn: boolean): boolean {
  return gapMm <= fusionGapMin(fanOn ? K1.fanOn_h : K1.fanOff_h);
}

// ── 3) Despegue: fuerza = area de contacto * resistencia de la union ─────────
/** Fuerza para romper una union de area A (mm2). weldMPa: 8 fria, 28 fundida total. */
export function detachForce(areaMm2: number, weldMPa = PLA.coldWeldMPa): number {
  return +(areaMm2 * weldMPa).toFixed(1);
}
/** Area MAXIMA de contacto que una fuerza disponible puede despegar. */
export function maxDetachArea(forceN: number, weldMPa = PLA.coldWeldMPa): number {
  return +(forceN / weldMPa).toFixed(2);
}

// ── 4) El area del lobulo / disco (lo que se pegaria si el hueco falla) ──────
/** Area de la CARA inferior de un disco cicloidal (lo que se fundiria con el de
 *  abajo si no hay hueco/enfriamiento). ~85% del circulo menos el barreno. */
export function discFootprint(R: number, shaftD: number, E: number): number {
  const outer = Math.PI * (R * 0.85) ** 2;
  const bore = Math.PI * (shaftD / 2 + E) ** 2;
  return +(outer - bore).toFixed(1);
}

// ── 5) Simulacion completa: imprime la caja en la K1, decide si despega ──────
export interface SimInput {
  gap: number; R: number; shaftD: number; E: number; lobes: number;
  fanOn: boolean;
  detachForceN: number;   // fuerza del primer giro (motor en el radio de leva) p.ej. 526 N
  holdForceN?: number;    // fuerza a sostener durante impresion (peso del disco + arrastre boquilla)
}
export function simulatePrint(s: SimInput) {
  const gMinOn = fusionGapMin(K1.fanOn_h);
  const gMinOff = fusionGapMin(K1.fanOff_h);
  const fuses = willFuse(s.gap, s.fanOn);
  const footprint = discFootprint(s.R, s.shaftD, s.E);
  // si funde toda la cara: fuerza para despegar (union fria) vs lo disponible
  const fusedDetachN = detachForce(footprint, PLA.coldWeldMPa);
  // si NO funde: solo despegamos los soportes intencionales — area maxima admisible
  const aMaxCold = maxDetachArea(s.detachForceN, PLA.coldWeldMPa);
  const aMaxFull = maxDetachArea(s.detachForceN, PLA.shearMPa);
  const hold = s.holdForceN ?? ((Math.PI * (s.R * 0.85) ** 2 * 6) * 1.24e-3 / 1000 * 9.81); // peso ~
  // ventana de area de soporte: aguanta impresion .. se despega
  const aHold = +(hold / PLA.shearMPa).toFixed(3);
  return {
    machine: K1.name,
    fanOn: s.fanOn,
    weldWindowOn: weldWindow(K1.fanOn_h), weldWindowOff: weldWindow(K1.fanOff_h),
    gapMinFanOn: gMinOn, gapMinFanOff: gMinOff,
    gap: s.gap,
    fuses,                                   // ¿se pegan los discos?
    detachableIfNoFuse: true,
    discFootprintMm2: footprint,
    forceToDetachIfFusedN: fusedDetachN,     // ENORME → por eso NO debe fundir
    detachForceAvailableN: s.detachForceN,
    maxSupportAreaMm2: +Math.min(aMaxCold, aMaxFull).toFixed(2), // techo del area de contacto
    minSupportAreaMm2: aHold,                // piso (sostener durante impresion)
    // VEREDICTO: imprimible y DESPEGABLE si no funde y la ventana de area existe
    printsDetachable: !fuses && aHold < Math.min(aMaxCold, aMaxFull),
    verdict: fuses
      ? 'SE FUNDE — ladrillo (sube el hueco o enciende ventilador)'
      : 'SEPARADO y DESPEGABLE — el primer giro libera',
  };
}
