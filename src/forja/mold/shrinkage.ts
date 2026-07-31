/**
 * CONTRACCIÓN Y pvT — Kazmer cap 10 "Shrinkage and Warpage"
 * ==========================================================
 * Ecuación de Tait de DOBLE DOMINIO (Eq 10.2-10.6): volumen específico
 * v(T,P) del polímero en estado sólido y fundido → contracción volumétrica
 * del ciclo (Eq 10.10-10.11) → contracción LINEAL isotrópica (Eq 10.13).
 * Verificado contra el ejemplo del bezel ABS (p.239-241): s = 0.31%.
 * ESTE es el "scale factor" REAL del molde (no un número inventado).
 */

export interface TaitCoeffs {
  /** Transición: T_t(P) = b5 + b6·P  (K, K/Pa). */
  b5: number; b6: number;
  /** Fundido: v0 = b1m + b2m·(T−b5); B = b3m·exp(−b4m·(T−b5)). */
  b1m: number; b2m: number; b3m: number; b4m: number;
  /** Sólido: idem con coeficientes s. */
  b1s: number; b2s: number; b3s: number; b4s: number;
  /** Semicristalinos (Eq 10.6); amorfos = 0. */
  b7?: number; b8?: number; b9?: number;
}

/** ABS Cycolac MG47 (Apéndice A / ejemplo p.239-240). Amorfo: vT=0. */
export const ABS_TAIT: TaitCoeffs = {
  b5: 370.6, b6: 2.3e-7,
  b1m: 9.83e-4, b2m: 6.51e-7, b3m: 1.33e8, b4m: 4.38e-3,
  b1s: 9.83e-4, b2s: 3.47e-7, b3s: 2.16e8, b4s: 4.14e-3,
};

const C = 0.0894;  // constante universal de Tait

/** Eq (10.2): temperatura de transición a la presión P. */
export const transitionT = (c: TaitCoeffs, pPa: number): number => c.b5 + c.b6 * pPa;

/** Eq (10.5): volumen específico v(T,P) en m³/kg (T en K, P en Pa). */
export function specificVolume(c: TaitCoeffs, tK: number, pPa: number): number {
  const melt = tK > transitionT(c, pPa);
  const v0 = (melt ? c.b1m : c.b1s) + (melt ? c.b2m : c.b2s) * (tK - c.b5);
  const B = (melt ? c.b3m : c.b3s) * Math.exp(-(melt ? c.b4m : c.b4s) * (tK - c.b5));
  const vT = (!melt && c.b7) ? c.b7 * Math.exp(c.b8! * (tK - transitionT(c, pPa)) - c.b9! * pPa) : 0;
  return v0 * (1 - C * Math.log(1 + pPa / B)) + vT;
}

/**
 * Contracción del CICLO (Eq 10.10-10.13): del estado de empaque (T_no_flow,
 * P_pack) al de uso (T_room, 0). Devuelve r_v y la contracción lineal s.
 */
export function shrinkage(
  c: TaitCoeffs,
  opts: { tNoFlowK: number; pPackPa: number; tUseK?: number },
): { vPack: number; vUse: number; rv: number; linear: number; moldScale: number } {
  const vPack = specificVolume(c, opts.tNoFlowK, opts.pPackPa);
  const vUse = specificVolume(c, opts.tUseK ?? 293, 0);
  const rv = vUse / vPack;
  const linear = 1 - Math.cbrt(rv);                 // Eq 10.13
  return { vPack, vUse, rv, linear, moldScale: 1 / (1 - linear) };
}

/**
 * LA RECOMENDACIÓN DE CONTRACCIÓN COMO PROCESO — §10.1.6 + §10.1.7
 * =================================================================
 * El libro NO entrega un número: entrega un RANGO y una recomendación de proceso.
 * El límite INFERIOR sale de empacar largo y fuerte; el SUPERIOR de empacar corto
 * y flojo, con el fundido más caliente. Literales de §10.1.6:
 *   "A practical upper limit for the packing pressure may be the greater of 120 %
 *    of the injection pressure or 100 MPa"
 *   "a low packing pressure (equal to the lesser of 40 % of the injection pressure
 *    or 30 MPa) and a high melt temperature (equal, perhaps, to the temperature
 *    half-way between the no-flow temperature and the melt temperature)"
 *
 * Y trae la ALARMA CONTRAINTUITIVA (§10.1.6): una contracción ≤ 0 no es precisión,
 * es sobre-empaque — sin contracción positiva la pieza no se despega de la cavidad
 * ni sale de costillas y bosses. Un optimizador que la minimice diseña un molde
 * que no expulsa.
 */
export function shrinkageRecommendation(o: {
  tait: TaitCoeffs; fillMPa: number; tNoFlowC: number; tMeltC: number; tUseC?: number;
}): {
  nominalPct: number; lowPct: number; highPct: number; spanPct: number;
  moldScale: number; positiva: boolean; anchoExcesivo: boolean; notas: string[];
} {
  const K = (c: number) => c + 273.15;
  const tUseK = K(o.tUseC ?? 20);
  // nominal: el pack típico del libro = 80 % de la presión de llenado (§10.1.2)
  const pNom = 0.8 * o.fillMPa * 1e6;
  const nominal = shrinkage(o.tait, { tNoFlowK: K(o.tNoFlowC), pPackPa: pNom, tUseK });
  // límite INFERIOR de contracción: pack alto y largo
  const pHigh = Math.max(1.2 * o.fillMPa, 100) * 1e6;
  const low = shrinkage(o.tait, { tNoFlowK: K(o.tNoFlowC), pPackPa: pHigh, tUseK });
  // límite SUPERIOR: pack bajo y fundido a medio camino entre no-flow y melt
  const pLow = Math.min(0.4 * o.fillMPa, 30) * 1e6;
  const tHot = (o.tNoFlowC + o.tMeltC) / 2;
  const high = shrinkage(o.tait, { tNoFlowK: K(tHot), pPackPa: pLow, tUseK });

  const lowPct = low.linear * 100, highPct = high.linear * 100, nomPct = nominal.linear * 100;
  const spanPct = highPct - lowPct;
  const notas: string[] = [];
  const positiva = lowPct > 0;
  if (!positiva) {
    notas.push('⚠ §10.1.6 contracción ≤ 0 en el límite inferior: SOBRE-EMPAQUE. La pieza no se despegará de la cavidad ni saldrá de costillas/bosses — no es precisión, es un molde que no expulsa');
  }
  // El libro llama la atención cuando el rango es muy ancho (su ejemplo: 0.3 → 1.9 %)
  const anchoExcesivo = spanPct > 3 * Math.max(nomPct, 0.05);
  if (anchoExcesivo) {
    notas.push(`§10.1.6 el rango es ancho (${lowPct.toFixed(2)}–${highPct.toFixed(2)} %): recomendar al moldeador PACK EXTENDIDO con presiones altas`);
  }
  notas.push('§10.1.7 este análisis NO decide solo: verifica al proveedor, al molde previo y a la simulación. El número final lleva RESPONSABLE');
  return {
    nominalPct: nomPct, lowPct, highPct, spanPct,
    moldScale: nominal.moldScale, positiva, anchoExcesivo, notas,
  };
}
