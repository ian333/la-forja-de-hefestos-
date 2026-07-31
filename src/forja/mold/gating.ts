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

/** ¿El tipo de gate se puede AGRANDAR en el tryout? §7.3.5 — el atributo que no
 *  trae ningún catálogo comercial, solo el libro: el acero se quita, no se pone. */
export const GATE_AGRANDABLE: Record<GateType, boolean> = {
  'sprue': false,          // lo fija el bushing
  'pin-point': true, 'edge': true, 'tab': true, 'flash': true, 'fan': true,
  'tunnel': true,
  'thermal-pin': false, 'thermal-sprue': false, 'valve': false,   // §6.2.3: en caliente, abrir cuesta caro
};

export interface GateIteration { paso: number; que: string; accion: string; }

/**
 * EL GATE COMO PROCESO DE 5 PASOS — §7.3
 * =======================================
 * §7.3.1 tipo → §7.3.2 semilla + cortante → §7.3.3 ΔP → §7.3.4 freeze vs empaque
 * → §7.3.5 ajuste. Dos cosas que un cálculo de una pasada no tiene:
 *
 * 1) §7.1.5 — el t_freeze puede REPROBAR un gate que YA pasó corte y presión:
 *    "the dimensions should be adjusted EVEN IF the shear rates and pressure drops
 *    were found acceptable". Por eso el freeze es un paso propio y no un adorno.
 * 2) §7.3.2/§7.3.4 — el ajuste puede escalar de nivel: ensanchar un edge gate más
 *    allá de cierto punto "would require a change in the gate type to a fan gate",
 *    y gatear a sección delgada obliga a "consider a three-plate or hot runner
 *    mold". El lazo REPORTA ese salto; no lo toma solo.
 *
 * Y el resultado sale STEEL-SAFE (§7.3.5/§7.4): se especifica el gate CHICO a
 * propósito, con su disparador de apertura declarado para el tryout.
 */
export function designGateProcess(o: {
  type: GateType; wallMm: number; wallAtGateMm?: number; VdotM3s: number;
  shearMaxS: number; melt: MeltMaterial; alphaM2s: number;
  tMeltC: number; tCoolC: number; tNoFlowC: number;
  /** empaque que la PIEZA necesita (t_c de la pared) — §7.3.4 lo compara */
  tPackNeededS: number;
  gateLenMm?: number;
}) {
  const iters: GateIteration[] = [];
  const props = GATE_TABLE[o.type];
  const cyl = ['sprue', 'pin-point', 'tunnel', 'thermal-pin', 'thermal-sprue', 'valve'].includes(o.type);
  iters.push({ paso: 1, que: `tipo ${o.type}`, accion: `§7.3.1 runner ${props.runner} · degatado ${props.degating} · flujo ${props.flow} · agrandable ${GATE_AGRANDABLE[o.type] ? 'SÍ' : 'NO'}` });

  // §7.3.2 SEMILLA: gates gruesos = espesor de pared; delgados = la mitad.
  const thin = ['pin-point', 'flash', 'tunnel', 'thermal-pin'].includes(o.type);
  let t = o.wallMm * (thin ? 0.5 : 1);
  let w = 2 * t;                                                   // §7.3.2 ancho inicial
  const L = (o.gateLenMm ?? Math.max(1, t)) / 1000;
  const ev = () => {
    const shear = cyl ? shearRateCyl(o.VdotM3s, t / 2000) : shearRateStrip(o.VdotM3s, w / 1000, t / 1000);
    const dPMPa = (cyl
      ? gateDropCylNewt(o.melt.k, L, t / 2000, o.VdotM3s)
      : gateDropStripPL(o.melt, L, w / 1000, t / 1000, o.VdotM3s)) / 1e6;
    const freezeS = cyl
      ? gateFreezeCylS(o.alphaM2s, t / 1000, o.tMeltC, o.tCoolC, o.tNoFlowC)
      : gateFreezeStripS(o.alphaM2s, t / 1000, o.tMeltC, o.tCoolC, o.tNoFlowC);
    return { shear, dPMPa, freezeS };
  };
  let r = ev();
  iters.push({ paso: 2, que: `semilla t=${t.toFixed(2)} mm${cyl ? '' : ` w=${w.toFixed(2)} mm`}`, accion: `§7.3.2 ${thin ? 'gate delgado: ½ de la pared' : 'gate grueso: espesor de pared'} · γ̇ ${Math.round(r.shear).toLocaleString()} 1/s` });

  // §7.3.5 AJUSTE por cortante: agrandar hasta cumplir γ̇max
  let escalaTipo: string | null = null;
  for (let k = 0; k < 12 && r.shear > o.shearMaxS; k++) {
    if (cyl) t *= 1.15; else w *= 1.25;
    r = ev();
    // §7.3.2: un edge gate demasiado ancho YA ES un fan gate
    if (!cyl && w > 14 && o.type === 'edge') {
      escalaTipo = `§7.3.2 el ancho llegó a ${w.toFixed(1)} mm — "would require a change in the gate type to a FAN GATE"`;
      break;
    }
  }
  if (r.shear <= o.shearMaxS) {
    iters.push({ paso: 3, que: `γ̇ ${Math.round(r.shear).toLocaleString()} 1/s`, accion: `§7.1.4 dentro del máximo (${o.shearMaxS.toLocaleString()}) con t=${t.toFixed(2)}${cyl ? '' : ` w=${w.toFixed(2)}`} mm` });
  }

  // §7.3.3 ΔP: 2 MPa típico · >6 sospechoso · >10 mal diseñado
  const dpVeredicto = r.dPMPa > 10 ? 'MAL DISEÑADO (muy delgado o muy largo)' : r.dPMPa > 6 ? 'sospechoso' : 'típico';
  iters.push({ paso: 4, que: `ΔP ${r.dPMPa.toFixed(2)} MPa`, accion: `§7.3.3 ${dpVeredicto} (marcas del libro: 2 típico / 6 sospechoso / 10 mal diseñado)` });

  // §7.3.4 FREEZE vs EMPAQUE — puede reprobar lo que ya pasó corte y presión
  const freezeCorto = r.freezeS < o.tPackNeededS;
  iters.push({
    paso: 5, que: `freeze ${r.freezeS.toFixed(2)} s vs empaque necesario ${o.tPackNeededS.toFixed(2)} s`,
    accion: freezeCorto
      ? '§7.1.5 el gate CONGELA ANTES de terminar el empaque → contracción volumétrica excesiva. Engrosar el gate, subir presión de empaque, o adelgazar la pieza — AUNQUE γ̇ y ΔP estén bien'
      : '§7.3.4 el gate aguanta el empaque que la pieza necesita ✓ (ojo: la ecuación da el MÍNIMO, ignora la convección del flujo — el real será mayor)',
  });

  // §7.3.4 ¿gateando a sección delgada? → escala a TIPO DE MOLDE
  const wallGate = o.wallAtGateMm ?? o.wallMm;
  const seccionDelgada = wallGate < o.wallMm * 0.9;
  if (seccionDelgada) {
    escalaTipo = (escalaTipo ? escalaTipo + ' · ' : '')
      + `§7.3.4 el gate entra a ${wallGate.toFixed(2)} mm y debe empacar ${o.wallMm.toFixed(2)} mm — "a three-plate mold or hot runner mold should be considered"`;
  }

  // §7.3.5/§7.4 STEEL SAFE: especificar CHICO y abrir en el tryout
  const tSafe = +(t * 0.85).toFixed(2);
  return {
    type: o.type, agrandable: GATE_AGRANDABLE[o.type],
    thicknessMm: +t.toFixed(3), widthMm: cyl ? null : +w.toFixed(2),
    thicknessSteelSafeMm: GATE_AGRANDABLE[o.type] ? tSafe : +t.toFixed(2),
    shear: r.shear, shearMax: o.shearMaxS, dPMPa: r.dPMPa, freezeS: r.freezeS,
    tPackNeededS: o.tPackNeededS, freezeCorto, dpVeredicto,
    escalaTipo, iteraciones: iters,
    ok: r.shear <= o.shearMaxS && r.dPMPa <= 10 && !freezeCorto && !escalaTipo,
  };
}
export type GateProcessDesign = ReturnType<typeof designGateProcess>;
