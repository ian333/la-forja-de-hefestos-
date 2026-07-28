/**
 * cooling-design.ts — EL PROCESO DE DISEÑO DEL ENFRIAMIENTO (Kazmer §9.2)
 * =======================================================================
 * La cadena COMPLETA del libro, ecuación por ecuación, en el MISMO orden en
 * que él la resuelve — y con el LAZO cerrado que el texto pide explícitamente
 * ("multiple design iterations may be necessary", §9.2.2):
 *
 *   9.2.1  t_c        Eq 9.5   enfriamiento de la sección más gruesa
 *   9.2.2  Q          Eq 9.10  calor del disparo (piezas + colada fría)
 *          Q̇          Eq 9.11  potencia = Q/t_c
 *          Q̇_line     Eq 9.12  Q̇/n_lines
 *   9.2.3  V̇          Eq 9.13  caudal para ΔT_agua permitido (1 °C típico)
 *   9.2.4  Re         Eq 9.14  > 4000 (turbulento)
 *          D_max      Eq 9.15  límite por turbulencia
 *          ΔP         Eq 9.16  caída de presión (agua, flujo de tubería)
 *          D_min      Eq 9.17  límite por caída de presión
 *   9.2.5  H          Eq 9.21  k_molde/1000  ·  Eq 9.22  2D < H < 5D
 *          P_melt     Eq 9.19  σ_endurance / SCF
 *   9.2.6  W          Eq 9.24  H < W < 2H   ·  Eq 9.23  variación de flujo
 *
 * EL LAZO: n_lines NO es dato — sale de W y de la banda que hay que cubrir,
 * y W sale de H, y H sale de D. Por eso `coolingDesign` itera: propone n,
 * recalcula Q̇_line → V̇ → D, re-deriva n, y repite hasta punto fijo. Sin eso
 * el diseñador "asume 4 líneas" y nunca comprueba que quepan.
 *
 * VERIFICADO contra el ejemplo resuelto del libro (molde familia cup/lid,
 * p. 206-213): 20,900 J · 1,050 W · 260 W · 6.2e-5 m³/s · D_max 20 mm ·
 * D_min 3.7 mm · H 25.4 mm · P_melt 175 MPa. Ver kazmer-enfriamiento-test.cjs.
 */

/** Refrigerante (Apéndice C). μ y k del agua a temperatura de molde. */
export interface Coolant { name: string; rhoKgM3: number; cpJkgC: number; muPaS: number; kWmC: number }
export const AGUA: Coolant = { name: 'agua', rhoKgM3: 1000, cpJkgC: 4200, muPaS: 0.001, kWmC: 0.6 };

/**
 * APÉNDICE A — las propiedades TÉRMICAS que pide §9.2, LITERALES del libro
 * (p. 390-393). Nada derivado, nada redondeado: se leyeron de la tabla.
 *   rhoRT   = "Density at 20 °C"       (Eq 9.10 usa ÉSTA, no la del fundido)
 *   cp      = "Specific heat"
 *   alpha   = "Thermal diffusivity"
 *   tMelt   = "Mid-range melt temperature"
 *   tEject  = "DTUL (0.45 MPa, ASTM D648)" — el criterio de expulsión del libro
 *   tCool   = medio del rango "Minimum/Maximum coolant temperature"
 */
export const PLASTICOS_A: Record<string, {
  grado: string; rhoRTKgM3: number; cpJkgC: number; kWmC: number; alphaM2s: number;
  tMeltC: number; tEjectC: number; tCoolC: number; tCoolMinC: number; tCoolMaxC: number;
}> = {
  ABS: { grado: 'Cycolac MG47', rhoRTKgM3: 1044, cpJkgC: 2340, kWmC: 0.19, alphaM2s: 8.73e-8, tMeltC: 239, tEjectC: 96.7, tCoolC: 60, tCoolMinC: 49, tCoolMaxC: 71 },
  PP: { grado: 'Dow Inspire 702', rhoRTKgM3: 929, cpJkgC: 2890, kWmC: 0.184, alphaM2s: 8.15e-8, tMeltC: 220, tEjectC: 80, tCoolC: 35, tCoolMinC: 20, tCoolMaxC: 50 },
  PS: { grado: 'Dow Styron 478', rhoRTKgM3: 1036, cpJkgC: 1820, kWmC: 0.133, alphaM2s: 7.63e-8, tMeltC: 200, tEjectC: 87, tCoolC: 50, tCoolMinC: 40, tCoolMaxC: 60 },
  PC: { grado: 'PC alto impacto', rhoRTKgM3: 1192, cpJkgC: 1260, kWmC: 0.25, alphaM2s: 1.89e-7, tMeltC: 293, tEjectC: 138, tCoolC: 82, tCoolMinC: 70, tCoolMaxC: 95 },
  POM: { grado: 'Acetal', rhoRTKgM3: 1435, cpJkgC: 2020, kWmC: 0.23, alphaM2s: 9.91e-8, tMeltC: 205, tEjectC: 160, tCoolC: 77, tCoolMinC: 50, tCoolMaxC: 105 },
  PA6: { grado: 'Nylon 6', rhoRTKgM3: 1153, cpJkgC: 2630, kWmC: 0.28, alphaM2s: 1.10e-7, tMeltC: 265, tEjectC: 160, tCoolC: 90, tCoolMinC: 70, tCoolMaxC: 110 },
};
/** Acero del molde: k y límite de fatiga (§9.2.5 + §12.2). */
export const ACEROS_MOLDE: Record<string, { kWmC: number; sigmaEnduranceMPa: number }> = {
  P20: { kWmC: 32, sigmaEnduranceMPa: 456 },
  H13: { kWmC: 28.6, sigmaEnduranceMPa: 690 },
  'QC-7': { kWmC: 160, sigmaEnduranceMPa: 166 },     // aluminio (§9.2.5: P_melt cae a 50 MPa a 1D)
};

/** Tabla 9.2 — plugs de enfriamiento comerciales (DME). El ⌀ final DEBE ser uno de éstos. */
export const PLUGS_DME: Array<{ plug: string; npt: string; diaMm: number }> = [
  { plug: 'JP-250', npt: '1/16', diaMm: 4.76 },
  { plug: 'JP-251', npt: '1/8', diaMm: 6.35 },
  { plug: 'JP-352', npt: '1/4', diaMm: 9.53 },
  { plug: 'JP-553', npt: '3/8', diaMm: 11.1 },
  { plug: 'JP-554', npt: '1/2', diaMm: 15.9 },
];

/** Tabla 9.1 — controladores de temperatura de molde. */
export const CONTROLADORES = [
  { name: 'VacTherm (agua)', tMinC: 10, tMaxC: 99, heatKW: 9, coolKW: 14.6, flowM3s: 1e-3, presKPa: 200 },
  { name: 'IMSelect (aceite)', tMinC: 32, tMaxC: 304, heatKW: 16, coolKW: 16, flowM3s: 3e-3, presKPa: 30 },
];

/** Eq (9.5): t_c de una placa de espesor h. */
export function tcPlateS(hM: number, alphaM2s: number, tMeltC: number, tEjectC: number, tCoolC: number): number {
  const r = (tMeltC - tCoolC) / (tEjectC - tCoolC);
  return ((hM * hM) / (Math.PI * Math.PI * alphaM2s)) * Math.log((4 / Math.PI) * r);
}
/** Eq (9.10): Q = m·Cp·(T_melt − T_eject) [J]. */
export const heatPerShotJ = (mKg: number, cpJkgC: number, tMeltC: number, tEjectC: number): number =>
  mKg * cpJkgC * (tMeltC - tEjectC);
/** Eq (9.14): Re = 4·ρ·V̇/(π·μ·D). */
export const reynoldsLine = (c: Coolant, vDotM3s: number, dM: number): number =>
  (4 * c.rhoKgM3 * vDotM3s) / (Math.PI * c.muPaS * dM);
/** Eq (9.15): ⌀ máximo para conservar Re > 4000. */
export const dMaxTurbulentM = (c: Coolant, vDotM3s: number): number =>
  (4 * c.rhoKgM3 * vDotM3s) / (Math.PI * c.muPaS * 4000);
/** Eq (9.16): ΔP = ρ·L·V̇²/(10π·D⁵) [Pa] — agua, flujo de tubería. */
export const dPLinePa = (c: Coolant, lM: number, vDotM3s: number, dM: number): number =>
  (c.rhoKgM3 * lM * vDotM3s * vDotM3s) / (10 * Math.PI * Math.pow(dM, 5));
/** Eq (9.17): ⌀ mínimo para no pasarse del ΔP permitido. */
export const dMinPressureM = (c: Coolant, lM: number, vDotM3s: number, dPPa: number): number =>
  Math.pow((c.rhoKgM3 * lM * vDotM3s * vDotM3s) / (10 * Math.PI * dPPa), 1 / 5);
/** Eq (9.18): Hagen-Poiseuille — ΔP para refrigerante VISCOSO (aceite, glicol: laminar). */
export const dPLineLaminarPa = (c: Coolant, lM: number, vDotM3s: number, dM: number): number =>
  (128 * c.muPaS * lM * vDotM3s) / (Math.PI * Math.pow(dM, 4));
/** Eq (9.20): coeficiente efectivo de CONDUCCIÓN del acero sobre la línea: k/H. */
export const hConduction = (kMoldWmC: number, hLineM: number): number => kMoldWmC / hLineM;
/** Eq (9.21): profundidad máxima para no penalizar el ciclo: H < k_molde/1000. */
export const hLineMaxM = (kMoldWmC: number): number => kMoldWmC / 1000;
/**
 * Eq (9.19) + Fig 9.4: presión de fusión máxima = σ_endurance / SCF.
 * El libro SOLO da dos puntos del SCF (3.3 a H=1D, 2.6 a H=4D) → interpolación
 * lineal DECLARADA como extensión nuestra, extrapolación acotada a [2.6, 3.3].
 */
export function stressConcentration(hOverD: number): number {
  const scf = 3.3 + ((2.6 - 3.3) * (hOverD - 1)) / (4 - 1);
  return Math.min(3.3, Math.max(2.6, scf));
}
export const maxMeltPressureMPa = (sigmaEnduranceMPa: number, scf: number): number => sigmaEnduranceMPa / scf;
/** Eq (9.23) (Menges): variación relativa del flujo de calor entre líneas — proporcional. */
export const heatFluxVariation = (wOverH: number): number => Math.pow(wOverH, 2.8 * Math.log(Math.max(1e-6, wOverH)));

export interface CoolingDesignIn {
  /** disparo */
  nCav: number; partVolCc: number; runnerVolCc?: number;
  /** sección MÁS GRUESA de la pieza (manda el t_c), mm */
  thickestMm: number;
  /** plástico — Apéndice A */
  rhoRTKgM3: number; cpJkgC: number; alphaM2s: number;
  tMeltC: number; tEjectC: number; tCoolantC: number;
  /** molde */
  kMoldWmC: number; sigmaEnduranceMPa: number;
  /** banda (mm) que las líneas deben cubrir: de borde a borde de la huella de cavidades */
  bandMm: number;
  /** largo de UNA línea recta barrenada (mm) */
  lineLenMm: number;
  /** cuántas líneas van en SERIE por circuito (el ΔP se suma) */
  linesInSeries?: number;
  /** lados con agua (cavidad y núcleo = 2) */
  sides?: number;
  /** alza permitida del refrigerante: 1 °C típico, 0.1 para pieza de precisión */
  dTCoolantC?: number;
  /** ΔP permitido (Pa) — el libro usa ½ de la presión del controlador */
  dPAllowPa?: number;
  /** t_c dado (s). Si falta se calcula con Eq 9.5 */
  tcS?: number;
  /** relación W/H buscada: 1 = uniforme (tolerancia cerrada), 2 = commodity */
  wOverH?: number;
  /** H/D buscado dentro de Eq 9.22. Default 4 — el que usa el propio libro en
   *  el ejemplo del cup/lid ("the depth will be set to four cooling line
   *  diameters"). Eq 9.21 lo RECORTA si el acero no lo aguanta. */
  hOverD?: number;
  coolant?: Coolant;
  /** forzar un ⌀ (mm) en vez de elegir de la Tabla 9.2 */
  forceDiaMm?: number;
  /** forzar el nº de líneas POR LADO (para auditar un circuito ya trazado) */
  forceLinesPerSide?: number;
}

export interface CoolingDesignOut {
  tcS: number; massKg: number; qShotJ: number; qCoolingW: number;
  nLines: number; nPerSide: number; qLineW: number;
  vDotLineM3s: number; vDotLineGPM: number; vDotTotalM3s: number; vDotTotalGPM: number;
  diaMm: number; plug: string; dMinMm: number; dMaxMm: number; reynolds: number; dPKPa: number;
  hLineMm: number; hLineMaxMm: number; scf: number; pMeltMaxMPa: number;
  wLineMm: number; wOverH: number;
  controlador: string | null; nControladores: number;
  iters: number;
  rows: Array<{ k: string; v: string; ref: string }>;
  fallas: string[];
}

/**
 * EL PROCESO COMPLETO, con el lazo cerrado.
 * Devuelve además `fallas`: las reglas del libro que el diseño NO cumple —
 * es lo que convierte el estudio en VEREDICTO y no en un reporte bonito.
 */
export function coolingDesign(o: CoolingDesignIn): CoolingDesignOut {
  const c = o.coolant ?? AGUA;
  const dT = o.dTCoolantC ?? 1;
  const dPAllow = o.dPAllowPa ?? 100e3;
  const sides = o.sides ?? 2;
  const inSeries = o.linesInSeries ?? 2;
  const wOverHTarget = o.wOverH ?? 2;
  const fallas: string[] = [];

  // ── 9.2.1 · Eq 9.5 ──────────────────────────────────────────────────────
  const tcS = o.tcS ?? tcPlateS(o.thickestMm / 1000, o.alphaM2s, o.tMeltC, o.tEjectC, o.tCoolantC);

  // ── 9.2.2 · Eq 9.10 + 9.11 ──────────────────────────────────────────────
  const volM3 = (o.nCav * o.partVolCc + (o.runnerVolCc ?? 0)) * 1e-6;
  const massKg = volM3 * o.rhoRTKgM3;
  const qShotJ = heatPerShotJ(massKg, o.cpJkgC, o.tMeltC, o.tEjectC);
  const qCoolingW = qShotJ / tcS;

  // ── 9.2.5 · profundidad: la ventana donde Eq 9.21 y Eq 9.22 COEXISTEN ────
  // (va antes del lazo porque H sólo depende de D y del acero)
  const hMaxTermicaM = hLineMaxM(o.kMoldWmC);
  const hOverD = o.hOverD ?? 4;                      // el libro usa 4D en el cup/lid
  const pickH = (dMm: number) => {
    const loM = (2 * dMm) / 1000, hiEstruct = (5 * dMm) / 1000;
    const hi = Math.min(hiEstruct, hMaxTermicaM);    // Eq 9.21 RECORTA a Eq 9.22
    return Math.max(loM, Math.min(hi, (hOverD * dMm) / 1000));
  };

  // ── EL LAZO: n_lines ⇄ W ⇄ H ⇄ D ────────────────────────────────────────
  let diaMm = o.forceDiaMm ?? PLUGS_DME[2].diaMm;    // arranque: el 3/8" (el más usado)
  let nPerSide = 1, nLines = sides, iters = 0;
  let hLineM = pickH(diaMm), wLineMm = wOverHTarget * hLineM * 1000;
  let qLineW = qCoolingW / nLines, vDotLine = qLineW / (c.rhoKgM3 * c.cpJkgC * dT);
  for (; iters < 20; iters++) {
    hLineM = pickH(diaMm);
    wLineMm = wOverHTarget * hLineM * 1000;                       // Eq 9.24
    // Nº DE LÍNEAS PARA QUE EL PASO NO SE PASE DE W (Eq 9.24). Con floor() se
    // subcuenta: cubrir 188 mm con 3 líneas deja huecos de 94 mm cuando el
    // techo es 64. Los HUECOS son ceil(banda/W) ⇒ las líneas, uno más.
    const nNew = o.forceLinesPerSide ?? Math.max(1, Math.ceil(o.bandMm / wLineMm) + 1);
    const nLinesNew = nNew * sides;
    qLineW = qCoolingW / nLinesNew;
    vDotLine = qLineW / (c.rhoKgM3 * c.cpJkgC * dT);              // Eq 9.13
    // ⌀ admisible con ESE caudal: [D_min (Eq 9.17), D_max (Eq 9.15)]
    const lSerieM = (o.lineLenMm * inSeries) / 1000;
    const dMinM = dMinPressureM(c, lSerieM, vDotLine, dPAllow);
    const dMaxM = dMaxTurbulentM(c, vDotLine);
    let dNew = o.forceDiaMm ?? 0;
    if (!dNew) {
      // Tabla 9.2: el estándar MÁS CHICO que cumpla (menos acero removido,
      // menos concentración de esfuerzo, más velocidad ⇒ más h_c)
      const ok = PLUGS_DME.filter((p) => p.diaMm / 1000 >= dMinM && p.diaMm / 1000 <= dMaxM);
      dNew = ok.length ? ok[0].diaMm : (dMinM * 1000 > PLUGS_DME[PLUGS_DME.length - 1].diaMm
        ? PLUGS_DME[PLUGS_DME.length - 1].diaMm : PLUGS_DME[0].diaMm);
    }
    const cerrado = nLinesNew === nLines && Math.abs(dNew - diaMm) < 1e-9;
    nPerSide = nNew; nLines = nLinesNew; diaMm = dNew;
    if (cerrado) break;
  }

  // ── comprobaciones finales con el diseño convergido ──────────────────────
  const dM = diaMm / 1000;
  const lSerieM = (o.lineLenMm * inSeries) / 1000;
  const re = reynoldsLine(c, vDotLine, dM);
  const dMinMm = dMinPressureM(c, lSerieM, vDotLine, dPAllow) * 1000;
  const dMaxMm = dMaxTurbulentM(c, vDotLine) * 1000;
  const dPKPa = dPLinePa(c, lSerieM, vDotLine, dM) / 1000;
  const hLineMm = hLineM * 1000;
  const scf = stressConcentration(hLineMm / diaMm);
  const pMeltMaxMPa = maxMeltPressureMPa(o.sigmaEnduranceMPa, scf);
  const vDotTotal = vDotLine * nLines;
  const GPM = (m3s: number) => m3s * 15850.3;                    // 1 m³/s = 15850.3 GPM
  // El controlador debe ser del MISMO fluido: un molde de agua a 40 °C no se
  // conecta a un controlador de aceite porque "el caudal alcanza" (Tabla 9.1
  // lista los dos; elegir mal es cambiar el refrigerante sin decirlo).
  const esAceite = c.muPaS > 0.005 || c.name.toLowerCase().includes('aceite');
  const compatibles = CONTROLADORES.filter((k) => k.name.toLowerCase().includes(esAceite ? 'aceite' : 'agua'));
  const base = compatibles[0] ?? CONTROLADORES[0];
  const ctrl = compatibles.find((k) => k.flowM3s >= vDotTotal && k.coolKW * 1000 >= qCoolingW
    && o.tCoolantC >= k.tMinC && o.tCoolantC <= k.tMaxC) ?? null;
  const nCtrl = Math.max(Math.ceil(vDotTotal / base.flowM3s), Math.ceil(qCoolingW / (base.coolKW * 1000)));
  const plug = PLUGS_DME.find((p) => Math.abs(p.diaMm - diaMm) < 0.01)?.plug ?? 'no estándar';

  if (re <= 4000) fallas.push(`Re = ${re.toFixed(0)} ≤ 4000: flujo LAMINAR, el agua no arranca el calor (Eq 9.14)`);
  if (diaMm < dMinMm) fallas.push(`⌀${diaMm} < D_min ${dMinMm.toFixed(2)} mm: se pasa del ΔP permitido (Eq 9.17)`);
  if (diaMm > dMaxMm) fallas.push(`⌀${diaMm} > D_max ${dMaxMm.toFixed(2)} mm: pierde turbulencia (Eq 9.15)`);
  if (hLineMm > hMaxTermicaM * 1000 + 1e-6)
    fallas.push(`H = ${hLineMm.toFixed(1)} mm > k/1000 = ${(hMaxTermicaM * 1000).toFixed(1)} mm: la línea está tan honda que ELLA alarga el ciclo (Eq 9.21)`);
  if (hLineMm < 2 * diaMm - 1e-6)
    fallas.push(`H = ${hLineMm.toFixed(1)} mm < 2D: concentración de esfuerzo, el acero se agrieta desde el barreno (Eq 9.22)`);
  if (!ctrl) fallas.push(`ningún controlador de la Tabla 9.1 solo: hacen falta ${nCtrl} (V̇=${GPM(vDotTotal).toFixed(1)} GPM, Q̇=${(qCoolingW / 1000).toFixed(2)} kW)`);

  const rows = [
    { k: 't_c', v: `${tcS.toFixed(2)} s (sección ${o.thickestMm} mm)`, ref: 'Eq 9.5' },
    { k: 'disparo', v: `${(massKg * 1000).toFixed(1)} g → ${(qShotJ / 1000).toFixed(1)} kJ`, ref: 'Eq 9.10' },
    { k: 'potencia', v: `${qCoolingW.toFixed(0)} W`, ref: 'Eq 9.11' },
    { k: 'líneas', v: `${nLines} (${nPerSide}/lado × ${sides}) → ${qLineW.toFixed(0)} W c/u`, ref: 'Eq 9.12 + 9.24' },
    { k: 'caudal', v: `${vDotLine.toExponential(2)} m³/s = ${GPM(vDotLine).toFixed(2)} GPM/línea (ΔT ${dT} °C)`, ref: 'Eq 9.13' },
    { k: '⌀', v: `${diaMm} mm (${plug}) · ventana ${dMinMm.toFixed(2)}–${dMaxMm.toFixed(1)} mm · Re ${re.toFixed(0)}`, ref: 'Eqs 9.14/9.15/9.17 + Tabla 9.2' },
    { k: 'ΔP', v: `${dPKPa.toFixed(1)} kPa con ${inSeries} en serie (${(lSerieM * 1000).toFixed(0)} mm)`, ref: 'Eq 9.16' },
    { k: 'profundidad', v: `${hLineMm.toFixed(1)} mm = ${(hLineMm / diaMm).toFixed(1)}D · SCF ${scf.toFixed(2)} → P_melt ≤ ${pMeltMaxMPa.toFixed(0)} MPa`, ref: 'Eqs 9.19/9.21/9.22' },
    { k: 'paso', v: `${wLineMm.toFixed(1)} mm = ${(wLineMm / hLineMm).toFixed(1)}·H`, ref: 'Eq 9.24 + Fig 9.5' },
    { k: 'controlador', v: ctrl ? `${ctrl.name} (1)` : `${nCtrl} × ${base.name} · total ${GPM(vDotTotal).toFixed(1)} GPM`, ref: 'Tabla 9.1' },
  ];

  return {
    tcS, massKg, qShotJ, qCoolingW, nLines, nPerSide, qLineW,
    vDotLineM3s: vDotLine, vDotLineGPM: GPM(vDotLine), vDotTotalM3s: vDotTotal, vDotTotalGPM: GPM(vDotTotal),
    diaMm, plug, dMinMm, dMaxMm, reynolds: re, dPKPa,
    hLineMm, hLineMaxMm: hMaxTermicaM * 1000, scf, pMeltMaxMPa,
    wLineMm, wOverH: wLineMm / hLineMm,
    controlador: ctrl?.name ?? null, nControladores: ctrl ? 1 : nCtrl,
    iters, rows, fallas,
  };
}
