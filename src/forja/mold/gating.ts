/**
 * DISEÑO DE GATES — Kazmer cap 7 "Gating Design"
 * ================================================
 * Los 10 tipos de gate (tabla 7.1) + el proceso §7.3: tasa de corte en el
 * gate (tabla 7.2), caída de presión (tabla 7.3), radio para γ̇ máx, y
 * recomendación de espesor inicial. Verificado contra los ejemplos del
 * bezel/cup: 111,000 1/s, 132,000 1/s, R=1.03mm, ΔP 1.9/1.9/1.3 MPa.
 */
import type { MeltMaterial } from './filling';

export type GateType = 'sprue' | 'pin-point' | 'edge' | 'tab' | 'flash' | 'fan' | 'tunnel' | 'thermal-pin' | 'thermal-sprue' | 'valve';

/** Tabla 7.1: propiedades de cada tipo de gate. */
export const GATE_TABLE: Record<GateType, { runner: 'cold' | 'hot'; degating: 'manual' | 'automatic'; shear: 'low' | 'moderate' | 'high'; flow: 'radial' | 'linear' }> = {
  'sprue':        { runner: 'cold', degating: 'manual',    shear: 'moderate', flow: 'radial' },
  'pin-point':    { runner: 'cold', degating: 'automatic', shear: 'high',     flow: 'radial' },
  'edge':         { runner: 'cold', degating: 'manual',    shear: 'moderate', flow: 'radial' },
  'tab':          { runner: 'cold', degating: 'manual',    shear: 'moderate', flow: 'radial' },
  'flash':        { runner: 'cold', degating: 'manual',    shear: 'moderate', flow: 'linear' },
  'fan':          { runner: 'cold', degating: 'manual',    shear: 'low',      flow: 'linear' },
  'tunnel':       { runner: 'cold', degating: 'automatic', shear: 'high',     flow: 'radial' },
  'thermal-pin':  { runner: 'hot',  degating: 'automatic', shear: 'high',     flow: 'radial' },
  'thermal-sprue':{ runner: 'hot',  degating: 'automatic', shear: 'moderate', flow: 'radial' },
  'valve':        { runner: 'hot',  degating: 'automatic', shear: 'moderate', flow: 'radial' },
};

/** Tabla 7.2 (Newtonian): γ̇ strip = 6V̇/(Wh²); cylinder = 4V̇/(πR³). */
export const shearRateStrip = (VdotM3s: number, wM: number, hM: number): number =>
  (6 * VdotM3s) / (wM * hM * hM);
export const shearRateCyl = (VdotM3s: number, rM: number): number =>
  (4 * VdotM3s) / (Math.PI * rM ** 3);

/** Radio mínimo del gate cilíndrico para no exceder γ̇_max: R = ∛(4V̇/(π·γ̇max)). */
export const gateRadiusForShear = (VdotM3s: number, shearMax: number): number =>
  Math.cbrt((4 * VdotM3s) / (Math.PI * shearMax));

/** Tabla 7.3 power-law strip: ΔP = (2kL/H)·[2(2+1/n)V̇/(WH²)]^n. */
export const gateDropStripPL = (m: MeltMaterial, L: number, W: number, H: number, Vdot: number): number =>
  ((2 * m.k * L) / H) * Math.pow((2 * (2 + 1 / m.n) * Vdot) / (W * H * H), m.n);

/** Tabla 7.3 Newtonian cylinder: ΔP = 8μLV̇/(πR⁴). */
export const gateDropCylNewt = (muPaS: number, L: number, R: number, Vdot: number): number =>
  (8 * muPaS * L * Vdot) / (Math.PI * R ** 4);

/**
 * Tabla 7.4 — TIEMPO DE CONGELAMIENTO del gate (pack time mínimo).
 * strip:    t = h²/(π²·α) · ln( 8/π² · (Tmelt−Tcool)/(Tnoflow−Tcool) )
 * cylinder: t = D²/(23.1·α) · ln( 0.692 · (Tmelt−Tcool)/(Tnoflow−Tcool) )
 * VERIFICADO contra el ejemplo del pin-point ⌀2mm: 1.1 s ✓ (p.181).
 * ⚠ ERRATA del libro: sus ejemplos de STRIP (fan 1.5 s, cup 24 s, p.181) NO
 * reproducen con su propia fórmula (dan 0.76 s y 12.1 s — factor 2). La misma
 * estructura con temperatura de EYECCIÓN (Eq 9.5, p.203) sí reproduce EXACTO
 * (18.9 s) ⇒ la fórmula es el canon; los dos números impresos son errata.
 */
export function gateFreezeStripS(alphaM2s: number, hM: number, tMelt: number, tCool: number, tNoFlow: number): number {
  return (hM * hM) / (Math.PI * Math.PI * alphaM2s) * Math.log((8 / (Math.PI * Math.PI)) * (tMelt - tCool) / (tNoFlow - tCool));
}
export function gateFreezeCylS(alphaM2s: number, dM: number, tMelt: number, tCool: number, tNoFlow: number): number {
  return (dM * dM) / (23.1 * alphaM2s) * Math.log(0.692 * (tMelt - tCool) / (tNoFlow - tCool));
}

/**
 * §7.3.1-7.3.2: diseño del gate — espesor inicial (= pared para gates gruesos;
 * pared/2 para pin-point/tunnel/thermal) + chequeo de corte + veredicto.
 */
export function gateDesign(o: {
  type: GateType; wallMm: number; VdotM3s: number; shearMaxS: number; widthMm?: number;
}): { thicknessMm: number; widthMm: number; shear: number; ok: boolean; report: string } {
  const thin = ['pin-point', 'flash', 'tunnel', 'thermal-pin'].includes(o.type);
  const tMm = o.wallMm * (thin ? 0.5 : 1);
  const wMm = o.widthMm ?? 2 * tMm;
  const isCyl = ['sprue', 'pin-point', 'tunnel', 'thermal-pin', 'thermal-sprue', 'valve'].includes(o.type);
  const shear = isCyl ? shearRateCyl(o.VdotM3s, tMm / 2000) : shearRateStrip(o.VdotM3s, wMm / 1000, tMm / 1000);
  const ok = shear <= o.shearMaxS;
  return {
    thicknessMm: tMm, widthMm: wMm, shear, ok,
    report: `${o.type}: t=${tMm}mm${isCyl ? '' : ` w=${wMm}mm`} · γ̇ ${Math.round(shear).toLocaleString()} 1/s ${ok ? '✓' : `⚠ > máx ${o.shearMaxS.toLocaleString()} — agrandar gate o bajar flujo`}`,
  };
}
