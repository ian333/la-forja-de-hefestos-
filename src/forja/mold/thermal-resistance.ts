/**
 * RED DE RESISTENCIAS TÉRMICAS — el estudio POR PLACA resuelto ANALÍTICAMENTE
 * (Kazmer §9.2-9.3). El FDM 3D difunde con α uniforme: no puede ver que el
 * NÚCLEO está rodeado de plástico (aislante) y que su único camino al agua es
 * por su propio cuerpo. Esa asimetría es geometría pura ⇒ sale de fórmulas.
 *
 * Física (todo cerrado, todo derivable):
 *   conducción en placa:      R = H / (k·A)                    [K/W]
 *   conducción cilíndrica:    R = ln(r₂/r₁) / (2π·k·L)         (núcleo/inserto)
 *   convección al agua:       R = 1 / (h_c·A)                  (Eq 9.7)
 *   serie:  R = ΣRᵢ      ·    paralelo: 1/R = Σ1/Rᵢ
 *   régimen:  T_superficie = T_agua + Q̇ · R_total
 *
 * Y como el ingeniero no quiere UN número sino saber QUÉ MOVER, cada
 * resistencia trae su DERIVADA analítica de sensibilidad:
 *   ∂T/∂H = Q̇/(k·A)                  (mover la línea de agua)
 *   ∂T/∂D = −Q̇/(h_c·π·L·D²)·… etc.   (agrandar el barreno)
 *   ∂T/∂h_c = −Q̇/(h_c²·A)            (subir el caudal → h_c, Eq 9.9)
 * Con la derivada se sabe cuántos °C por mm — eso es diseño, no adivinanza.
 */

export interface RNode { name: string; R: number; ref: string }

/** R de conducción en PLACA (1D): H/(k·A). */
export const rPlate = (Hm: number, k: number, Am2: number): number => Hm / (k * Am2);
/** R de conducción CILÍNDRICA radial: ln(r₂/r₁)/(2π·k·L). */
export const rCyl = (r1: number, r2: number, k: number, Lm: number): number =>
  Math.log(r2 / r1) / (2 * Math.PI * k * Lm);
/** R de CONVECCIÓN al refrigerante: 1/(h_c·A) — Eq 9.7. */
export const rConv = (hC: number, Am2: number): number => 1 / (hC * Am2);
/** Eq 9.9 (Dittus-Boelter simplificado del libro): h_c ∝ Re^0.8 · k_w/D. */
export function hCoolant(reynolds: number, kWater = 0.6, dM = 0.01): number {
  return 0.023 * Math.pow(Math.max(1, reynolds), 0.8) * Math.pow(5.4, 0.4) * kWater / dM;
}

export const rSeries = (...R: number[]): number => R.reduce((a, b) => a + b, 0);
export const rParallel = (...R: number[]): number => 1 / R.reduce((a, b) => a + 1 / b, 0);

export interface SideStudy {
  side: 'cavidad' | 'núcleo';
  /** calor a extraer por este lado (W) */
  QW: number;
  chain: RNode[];
  Rtotal: number;
  /** T de la cara moldeante en régimen (°C) */
  TsurfC: number;
  /** derivadas: °C por mm de profundidad de línea, y por 1000 W/m²°C de h_c */
  dT_dH_CperMm: number;
  dT_dhC_Cper1000: number;
  notas: string[];
}

/**
 * ESTUDIO ANALÍTICO DE UN LADO del molde.
 *  · cavidad = placa: el calor cruza H mm de acero hasta la línea (Eq 9.21)
 *  · núcleo  = cilindro: el calor entra por el perímetro del vaso y sale
 *    RADIALMENTE hacia el barreno/baffle interno (§9.3.5.2). Si no hay línea
 *    interna, el camino es AXIAL por el cuerpo del macho: R mucho mayor —
 *    de ahí que el núcleo siempre corra más caliente (§9.3.6).
 */
export function sideThermalStudy(o: {
  side: 'cavidad' | 'núcleo';
  /** calor por ciclo por unidad de área moldeante (W/m²) y área (m²) */
  fluxWm2: number; areaM2: number;
  tCoolantC: number; kSteel: number; hC: number;
  /** placa: profundidad de la línea desde la cara (m) */
  depthM?: number;
  /** núcleo: radio exterior/interior (m) y altura (m); sin r_int ⇒ camino axial */
  rOuterM?: number; rInnerM?: number; heightM?: number;
  /** área mojada de la línea de agua bajo esa cara (m²) */
  wettedM2: number;
}): SideStudy {
  const QW = o.fluxWm2 * o.areaM2;
  const chain: RNode[] = [];
  const notas: string[] = [];
  let rCond: number;
  if (o.side === 'cavidad') {
    const H = o.depthM ?? 0.02;
    rCond = rPlate(H, o.kSteel, o.areaM2);
    chain.push({ name: `conducción placa H=${(H * 1000).toFixed(0)} mm`, R: rCond, ref: 'R=H/(k·A) · Eq 9.21' });
  } else if (o.rInnerM && o.rOuterM && o.heightM) {
    rCond = rCyl(o.rInnerM, o.rOuterM, o.kSteel, o.heightM);
    chain.push({ name: `conducción radial ⌀${(2 * o.rOuterM * 1000).toFixed(0)}→⌀${(2 * o.rInnerM * 1000).toFixed(0)}`, R: rCond, ref: 'R=ln(r₂/r₁)/(2πkL) · §9.3.5.2 baffle' });
    notas.push('núcleo CON línea interna (baffle/bubbler): el calor sale radial');
  } else {
    // sin línea interna: el calor recorre el macho hasta su base (camino axial)
    const L = o.heightM ?? 0.04;
    const A = Math.PI * Math.pow(o.rOuterM ?? 0.04, 2);
    rCond = rPlate(L, o.kSteel, A);
    chain.push({ name: `conducción AXIAL por el macho L=${(L * 1000).toFixed(0)} mm`, R: rCond, ref: 'R=L/(k·A) — sin línea interna §9.3.6' });
    notas.push('⚠ núcleo SIN línea interna: todo el calor viaja por el cuerpo del macho ⇒ R alta y cara caliente (§9.3.5.2 pide baffle)');
  }
  const rC = rConv(o.hC, o.wettedM2);
  chain.push({ name: 'convección al agua', R: rC, ref: 'R=1/(h_c·A) · Eq 9.7' });
  const Rtotal = rSeries(...chain.map((c) => c.R));
  const TsurfC = o.tCoolantC + QW * Rtotal;
  // DERIVADAS analíticas (lo que el ingeniero mueve):
  const dT_dH = o.side === 'cavidad' ? QW / (o.kSteel * o.areaM2) : 0;   // °C/m
  const dT_dhC = -QW / (o.hC * o.hC * o.wettedM2);                        // °C por (W/m²°C)
  return {
    side: o.side, QW: +QW.toFixed(1), chain, Rtotal: +Rtotal.toFixed(5),
    TsurfC: +TsurfC.toFixed(2),
    dT_dH_CperMm: +(dT_dH / 1000).toFixed(3),
    dT_dhC_Cper1000: +(dT_dhC * 1000).toFixed(3),
    notas,
  };
}

/**
 * CALOR A EXTRAER por ciclo — Eq (9.10): NO se mide del campo, se DERIVA del
 * balance de energía del polímero:
 *     Q̇ = n_cav · V · ρ · cp · (T_melt − T_eject) / t_ciclo      [W]
 * (multiplicar el flujo local del FDM por el área moldeante total DUPLICA el
 *  conteo: ese flujo ya es por unidad de área de UNA cara.)
 */
export function heatToExtractW(o: {
  nCav: number; volCcPerCav: number; rhoMeltKgM3: number; cpJkgC: number;
  tMeltC: number; tEjectC: number; cycleS: number;
}): number {
  const mKg = o.nCav * o.volCcPerCav * 1e-6 * o.rhoMeltKgM3;
  return (mKg * o.cpJkgC * (o.tMeltC - o.tEjectC)) / o.cycleS;
}

/**
 * EL ESTUDIO DEL MOLDE REAL: las áreas y profundidades salen de la GEOMETRÍA
 * (huella de cavidad, rejilla, circuito de agua), no de constantes. Devuelve
 * los dos lados + el veredicto contra el libro.
 */
export function moldThermalResistanceStudy(o: {
  nCav: number;
  /** huella de UNA impresión (mm) y profundidad del vaso (mm) */
  fxMm: number; fyMm: number; depthMm: number; round?: boolean;
  /** CALOR TOTAL a extraer (W) — de Eq 9.10 (heatToExtractW), no del campo */
  qTotalW: number;
  /** circuito: ⌀ de línea (mm), profundidad bajo la cara (mm), largo total (mm) */
  lineDiaMm: number; lineDepthMm: number; lineLenMm: number;
  tCoolantC: number; kSteel: number; hC: number;
  /** ¿el núcleo lleva baffle/bubbler? (§9.3.5.2) */
  coreBaffle?: boolean;
}) {
  const mm2 = (v: number) => v / 1e6;
  // área moldeante de UNA cavidad: fondo + pared lateral (el vaso real)
  const rOut = (o.round ? o.fxMm / 2 : Math.max(o.fxMm, o.fyMm) / 2) / 1000;
  const areaFondo = o.round ? Math.PI * (o.fxMm / 2) ** 2 : o.fxMm * o.fyMm;
  const areaPared = o.round ? Math.PI * o.fxMm * o.depthMm : 2 * (o.fxMm + o.fyMm) * o.depthMm;
  const areaCavM2 = mm2((areaFondo + areaPared) * o.nCav);
  // área mojada del circuito: π·D·L (repartida entre los dos lados del molde)
  const wetTotal = mm2(Math.PI * o.lineDiaMm * o.lineLenMm);
  // el calor se REPARTE entre las dos caras a prorrata de su área moldeante
  // (fondo+pared): cada lado ve la mitad del área ⇒ la mitad del calor.
  const fluxWm2 = (o.qTotalW / 2) / (areaCavM2 / 2);      // W/m² por cara
  const areaLado = areaCavM2 / 2;
  const cav = sideThermalStudy({
    side: 'cavidad', fluxWm2, areaM2: areaLado, tCoolantC: o.tCoolantC,
    kSteel: o.kSteel, hC: o.hC, depthM: o.lineDepthMm / 1000, wettedM2: wetTotal / 2,
  });
  const core = sideThermalStudy({
    side: 'núcleo', fluxWm2, areaM2: areaLado, tCoolantC: o.tCoolantC,
    kSteel: o.kSteel, hC: o.hC, rOuterM: rOut,
    rInnerM: o.coreBaffle ? Math.max(0.004, rOut * 0.3) : undefined,
    heightM: o.depthMm / 1000, wettedM2: (wetTotal / 2) * (o.coreBaffle ? 1 : 0.5),
  });
  const dT = +(core.TsurfC - cav.TsurfC).toFixed(1);
  const rows = [
    { k: 'cara de CAVIDAD', v: `${cav.TsurfC} °C`, ref: `ΣR ${cav.Rtotal.toFixed(4)} K/W = placa ${(cav.chain[0].R * 1e3).toFixed(1)} + convección ${(cav.chain[1].R * 1e3).toFixed(1)} [mK/W] · Eq 9.21+9.7` },
    { k: 'cara de NÚCLEO', v: `${core.TsurfC} °C`, ref: `${o.coreBaffle ? 'con baffle §9.3.5.2 (radial)' : 'SIN línea interna: camino axial por el macho'} · ΣR ${core.Rtotal.toFixed(4)} K/W` },
    { k: 'Δ núcleo − cavidad', v: `${dT >= 0 ? '+' : ''}${dT} °C`, ref: '§9.3.6: el núcleo lo rodea el plástico ⇒ SIEMPRE más caliente. El FDM de α uniforme NO lo ve: es geometría, sale de R.', warn: Math.abs(dT) > 20 },
    { k: '∂T/∂H de la placa', v: `${cav.dT_dH_CperMm} °C/mm`, ref: 'derivada de R=H/(kA): cuánto sube la cara por cada mm que alejes la línea' },
    { k: '∂T/∂h_c', v: `${cav.dT_dhC_Cper1000} °C por +1000 W/m²°C`, ref: 'derivada de R=1/(h_c·A): lo que gana subir el caudal (Eq 9.9 Re^0.8)' },
  ];
  return { cav, core, dT, rows, areaCavM2: +areaCavM2.toFixed(5), wettedM2: +wetTotal.toFixed(5) };
}
