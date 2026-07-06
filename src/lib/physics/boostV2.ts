/**
 * boostV2 — motor de la IMPRESORA DE METAL v2, con el BOM REAL del pedido AG
 * (2026-06-09): IRF640N (Rds 0.15Ω) + MUR1560G (Vf 1.05V) + shunt de fase
 * RA-.1E (0.1Ω) + bobinas de aire a mano + banco 3×2200µF/200V + fuente 24V/14.6A.
 *
 * EL CUADRO COMPLETO (río → bombas → presa → válvula → gota):
 *  · 3 BOMBAS: boost DCM interleaved 120° — cucharadas de ½LI² (~0.7mJ) cien mil
 *    veces por segundo. Rampa RL real: Ipk = (Vin/R_on)(1−e^(−t_on/τ)), τ=L/R_on.
 *  · PRESA: el banco Cbus guarda ½CV² ≈ 47J a 120V — aguanta el gotazo TIESO
 *    (el v1 colapsaba 42→12V; ese era el bug mortal).
 *  · VÁLVULA: choke de 50µH en la descarga. Sin él, el corto líquido (Rj→1Ω)
 *    sube a 80A/µs y mata el IRF640 (72A) antes de la 1ª lectura del ADC (2µs).
 *    Con él: 2.4A/µs → control por BANDA DE HISTÉRESIS 40–60A (~30kHz).
 *  · GOTA: ciclo CONTACTO (Holm ~15.6Ω, 920W) → FUNDE (Edrop>E_MELT, Rj colapsa
 *    a ~1.2Ω líquido) → PINCHA (corriente atrapada en la banda, ∝i² desprende)
 *    → ARCO (decae por Df) → repite.
 *  · EL MURO DE HOLM CAE: funde ⟺ V²/Rj > P_LOSS(34W medidos) → a 120V funde
 *    hasta Rj=424Ω (v1 a 51V: 76Ω — el contacto de 15-18Ω quedaba en el filo).
 *
 * Todo número, PURO, determinista (gemelo de scripts/v2-sim-final.py).
 */

export const MU0 = 4 * Math.PI * 1e-7;

/** Umbral de fusión medido en el v1 [W] (pérdida por conducción de la junta). */
export const P_LOSS = 34;
/** Entalpía de fusión de la gota Ø0.92mm de acero [J] (3.2mg × 1135 kJ/kg). */
export const E_MELT = 3.6;
/** Tiempo en banda para que el pinch ∝i² desprenda [s]. */
export const T_PINCH = 1.5e-3;
/** Corriente pulsada máxima del IRF640N [A] — la línea roja. */
export const I_FET_MAX = 72;

export type DropPhase = 'contacto' | 'funde' | 'pincha' | 'arco';

export interface BV2Params {
  Vin: number;        // fuente [V]
  Iinmax: number;     // límite de la fuente [A]
  L: number;          // bobina boost (aire, a mano) [H]
  fsw: number;        // switcheo del boost [Hz]
  duty: number;       // D máximo (perilla)
  nph: number;        // fases activas 1..3
  Cbus: number;       // presa [F]
  Vtarget: number;    // bus objetivo [V]
  // pérdidas reales (BOM)
  Rds: number;        // IRF640N on [Ω]
  Rsh: number;        // shunt de fase RA-.1E [Ω] (solo conduce en ON)
  Rcoil: number;      // DCR+skin de la bobina de aire [Ω]
  Vf: number;         // MUR1560G [V]
  // descarga (válvula + gota)
  discharge: boolean;
  Lc: number;         // choke de descarga (bobina #4) [H]
  RdsD: number;       // Qd on [Ω]
  Rholm: number;      // R de contacto de Holm [Ω] — el muro (perilla 5..500)
  Rliq: number;       // R del puente líquido [Ω]
  Ilo: number;        // banda de histéresis: prende [A]
  Ihi: number;        // banda: apaga [A]
}

export interface BV2State {
  t: number;
  Vbus: number;
  phi: number;        // fase del reloj de switcheo [0..1)
  iL: number[];       // corriente instantánea por bobina (display)
  iin: number;        // suma instantánea (display)
  Icharge: number;    // media que carga el bus [A]
  Pin: number;        // potencia de entrada [W]
  Pout: number;       // potencia al bus [W]
  eta: number;        // eficiencia del boost
  Iin_avg: number;
  dutyEff: number;
  sourceSag: number;  // el jalón [0..1]
  ripple: number;     // rizo de entrada [%]
  // descarga
  idisch: number;     // corriente del choke [A]
  qdOn: boolean;      // estado del chopper
  Rj: number;         // R de la junta ahora [Ω]
  dphase: DropPhase;
  Edrop: number;      // calor acumulado en la gota [J]
  pinchT: number;     // tiempo en banda [s]
  arcT: number;
  heat: number;       // 0..1 para el glow
  drops: number;
  Pj: number;         // potencia instantánea en la junta [W]
}

export const BV2_DEFAULTS: BV2Params = {
  Vin: 24, Iinmax: 14.6, L: 10e-6, fsw: 100e3, duty: 0.55, nph: 3,
  Cbus: 6600e-6, Vtarget: 120,
  Rds: 0.15, Rsh: 0.10, Rcoil: 0.036, Vf: 1.05,
  discharge: true, Lc: 50e-6, RdsD: 0.15,
  Rholm: 15.6, Rliq: 1.2, Ilo: 40, Ihi: 60,
};

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

/** R total del camino de carga (FET + shunt + bobina). */
export const ronOf = (p: BV2Params) => p.Rds + p.Rsh + p.Rcoil;

/** Pico ideal (triángulo sin pérdidas) — referencia. */
export function ipk(p: BV2Params, dutyEff = p.duty): number {
  return p.Vin * dutyEff / (p.L * p.fsw);
}

/** Pico REAL con rampa RL: Ipk = (Vin/R)(1−e^(−t_on/τ)). Siempre < ideal. */
export function ipkReal(p: BV2Params, dutyEff = p.duty): number {
  const Ron = ronOf(p), tau = p.L / Ron, tOn = dutyEff / p.fsw;
  return (p.Vin / Ron) * (1 - Math.exp(-tOn / tau));
}

/** Fracción de bajada D2 (con el Vf real del MUR1560 si se pasa). */
export function d2(p: BV2Params, Vbus: number, dutyEff = p.duty, vf = 0): number {
  const dv = Math.max(Vbus + vf - p.Vin, 1);
  return ipkReal(p, dutyEff) * p.L * p.fsw / dv;
}

/** Corriente instantánea de la fase k (triángulo para el scope). */
export function iPhaseAt(phi: number, p: BV2Params, Vbus: number, k: number, dutyEff = p.duty): number {
  const off = k / Math.max(p.nph, 1);
  let ph = (phi + off) % 1; if (ph < 0) ph += 1;
  const D = dutyEff, DD = d2(p, Vbus, dutyEff, p.Vf), Ip = ipkReal(p, dutyEff);
  if (ph < D) return Ip * ph / Math.max(D, 1e-6);
  if (ph < D + DD) return Ip * (1 - (ph - D) / Math.max(DD, 1e-6));
  return 0;
}

/** Suma instantánea de entrada. */
export function iInputAt(phi: number, p: BV2Params, Vbus: number, dutyEff = p.duty): number {
  let s = 0;
  for (let k = 0; k < p.nph; k++) s += iPhaseAt(phi, p, Vbus, k, dutyEff);
  return s;
}

/** Rizo pico-a-pico de entrada [%]. */
export function inputRipplePct(p: BV2Params, Vbus: number, dutyEff = p.duty): number {
  let mn = Infinity, mx = -Infinity, sum = 0;
  const N = 240;
  for (let i = 0; i < N; i++) {
    const v = iInputAt(i / N, p, Vbus, dutyEff);
    if (v < mn) mn = v; if (v > mx) mx = v; sum += v;
  }
  const mean = sum / N;
  return mean > 1e-6 ? (mx - mn) / mean * 100 : 0;
}

export function iinAvgPhase(p: BV2Params, Vbus: number, dutyEff = p.duty): number {
  return 0.5 * ipkReal(p, dutyEff) * (dutyEff + d2(p, Vbus, dutyEff, p.Vf));
}
export function ioutAvgPhase(p: BV2Params, Vbus: number, dutyEff = p.duty): number {
  return 0.5 * ipkReal(p, dutyEff) * d2(p, Vbus, dutyEff, p.Vf);
}

/** Pérdidas por fase [W]: FET, shunt, bobina, diodo. */
export function lossesPhase(p: BV2Params, Vbus: number, dutyEff = p.duty) {
  const Ip = ipkReal(p, dutyEff), D = dutyEff, DD = d2(p, Vbus, dutyEff, p.Vf);
  const i2on = Ip * Ip * D / 3;
  return {
    fet: i2on * p.Rds,
    sh: i2on * p.Rsh,
    coil: Ip * Ip * (D + DD) / 3 * p.Rcoil,
    diode: p.Vf * ioutAvgPhase(p, Vbus, dutyEff),
  };
}

/** Estrés de la fuente (el jalón): dip ∝ rizo × carga. */
export function sourceStress(p: BV2Params, Vbus: number, dutyEff = p.duty): number {
  const ripple = inputRipplePct(p, Vbus, dutyEff);
  const Iavg = p.nph * iinAvgPhase(p, Vbus, dutyEff);
  return clamp((ripple / 100) * (Iavg / p.Iinmax) * 0.6, 0, 1);
}

/** ¿Este contacto FUNDE a este voltaje? El muro de Holm: V²/R > P_LOSS. */
export function melts(Vbus: number, Rj: number): boolean {
  return Vbus * Vbus / Rj > P_LOSS;
}
/** R máxima de contacto que aún funde a Vbus (el tamaño del muro derribado). */
export function rMaxMelt(Vbus: number): number { return Vbus * Vbus / P_LOSS; }

/** di/dt al cerrar Qd sobre un corto (lo que la válvula domestica) [A/s]. */
export function faultDiDt(Vbus: number, Lc: number): number { return Vbus / Lc; }

/** Energía ½Li² de las bobinas. */
export function coilEnergy(iL: number[], L: number): number {
  return iL.reduce((e, i) => e + 0.5 * L * i * i, 0);
}

/** Vueltas de bobina de aire (solenoide ideal — la receta real usa Wheeler +~15%). */
export function airTurns(L: number, dia = 0.03, len = 0.04): number {
  const A = Math.PI * (dia / 2) ** 2;
  return Math.sqrt(L * len / (MU0 * A));
}

export function bv2Reset(p: BV2Params = BV2_DEFAULTS): BV2State {
  return {
    t: 0, Vbus: p.Vin, phi: 0,
    iL: [0, 0, 0], iin: 0, Icharge: 0, Pin: 0, Pout: 0, eta: 0, Iin_avg: 0,
    dutyEff: p.duty, sourceSag: 0, ripple: 0,
    idisch: 0, qdOn: false, Rj: p.Rholm, dphase: 'contacto',
    Edrop: 0, pinchT: 0, arcT: 0, heat: 0, drops: 0, Pj: 0,
  };
}

const SUB_DT = 2e-6;          // paso fino de la descarga (la 1ª lectura del ADC)
const TAU_LIQ = 0.3e-3;       // colapso del puente al fundir [s]
const T_ARC = 1.5e-3;         // pausa de arco/re-contacto [s]

/**
 * Avanza dt segundos de SIM. El boost (medias por ciclo) carga la presa; la
 * descarga corre en sub-pasos de 2µs (el choke + la banda + la junta). Si se
 * pasa `trace`, se le hace push de idisch cada sub-paso (para el scope).
 */
export function bv2Step(s: BV2State, p: BV2Params, dt: number, trace?: number[]): BV2State {
  // ── lazo de tensión del boost ──
  const err = p.Vtarget - s.Vbus;
  const dutyEff = clamp(p.duty * clamp(err / (0.04 * p.Vtarget), 0, 1), 0, p.duty);

  // ── reloj del scope ──
  let phi = (s.phi + dt * p.fsw) % 1; if (!isFinite(phi)) phi = 0;
  const iL: number[] = [];
  for (let k = 0; k < 3; k++) iL.push(k < p.nph ? iPhaseAt(phi, p, s.Vbus, k, dutyEff) : 0);
  const iin = iL.reduce((a, b) => a + b, 0);

  // ── boost: medias + pérdidas + eficiencia ──
  const Icharge = p.nph * ioutAvgPhase(p, s.Vbus, dutyEff);
  const Iin_avg = p.nph * iinAvgPhase(p, s.Vbus, dutyEff);
  const Pin = p.Vin * Iin_avg;
  const Pout = s.Vbus * Icharge;
  const lo = lossesPhase(p, s.Vbus, dutyEff);
  const Ploss3 = p.nph * (lo.fet + lo.sh + lo.coil + lo.diode);
  const eta = Pout > 1 ? Pout / (Pout + Ploss3) : 0;
  const sourceSag = sourceStress(p, s.Vbus, dutyEff);

  // ── descarga: sub-pasos finos (choke + banda + ciclo de gota) ──
  let { idisch, qdOn, Rj, dphase, Edrop, pinchT, arcT, drops, heat } = s;
  let Vbus = s.Vbus;
  let Pj = 0;
  const nsub = Math.max(1, Math.round(dt / SUB_DT));
  const h = dt / nsub;

  // integración EXACTA del tramo RL (incondicionalmente estable a cualquier Rj):
  // di/dt=(V−iR)/Lc ⇒ i(t+h) = i_inf + (i−i_inf)·e^(−h·R/Lc), i_inf=V/R
  const stepRL = (i: number, V: number, R: number) => {
    const inf = V / R;
    return inf + (i - inf) * Math.exp(-h * R / p.Lc);
  };

  for (let k = 0; k < nsub; k++) {
    // carga de la presa (continua a esta escala)
    Vbus += (Icharge / p.Cbus) * h;

    if (!p.discharge) {
      // descarga apagada: el choke se vacía por Df
      qdOn = false;
      idisch = Math.max(0, stepRL(idisch, -p.Vf, Math.max(Rj, 0.5)));
      if (trace) trace.push(idisch);
      continue;
    }

    switch (dphase) {
      case 'contacto': {
        // muro de Holm: Qd cerrado, la corriente se asienta en Vbus/(Rholm+RdsD)
        qdOn = true; Rj = p.Rholm;
        idisch = Math.max(0, stepRL(idisch, Vbus, Rj + p.RdsD));
        Pj = idisch * idisch * Rj;
        Edrop += Math.max(0, Pj - P_LOSS) * h;          // solo el EXCESO funde
        if (Edrop >= E_MELT) dphase = 'funde';
        break;
      }
      case 'funde': {
        // el puente se vuelve líquido: Rj colapsa → la banda atrapa la corriente
        Rj += (p.Rliq - Rj) * (h / TAU_LIQ);
        if (idisch >= p.Ihi) qdOn = false;
        else if (idisch <= p.Ilo) qdOn = true;
        idisch = Math.max(0, qdOn
          ? stepRL(idisch, Vbus, Rj + p.RdsD)
          : stepRL(idisch, -p.Vf, Math.max(Rj, 0.2)));  // freewheel por Df: SIGUE calentando
        Pj = idisch * idisch * Rj;
        Edrop += Pj * h;
        if (Rj <= p.Rliq * 1.06) { dphase = 'pincha'; pinchT = 0; }
        break;
      }
      case 'pincha': {
        // corriente atrapada en la banda; el pinch ∝i² estrangula el puente
        if (idisch >= p.Ihi) qdOn = false;
        else if (idisch <= p.Ilo) qdOn = true;
        idisch = Math.max(0, qdOn
          ? stepRL(idisch, Vbus, Rj + p.RdsD)
          : stepRL(idisch, -p.Vf, Math.max(Rj, 0.2)));
        Pj = idisch * idisch * Rj;
        pinchT += h;
        if (pinchT >= T_PINCH) {                        // ¡GOTA!
          drops++; Edrop = 0; dphase = 'arco'; arcT = 0; qdOn = false; heat = 1;
        }
        break;
      }
      case 'arco': {
        // se desprendió: el choke se vacía por Df; re-contacto SOLO cuando la
        // presa recargó (el gate que el firmware real necesita: gotas espaciadas)
        qdOn = false;
        idisch = Math.max(0, stepRL(idisch, -p.Vf, 20)); // V_arc~20V
        Pj = 0; arcT += h;
        if (arcT >= T_ARC && idisch < 0.5 && Vbus >= 0.93 * p.Vtarget) {
          dphase = 'contacto'; Rj = p.Rholm;
        }
        break;
      }
    }

    // la presa SOLO se vacía cuando Qd conduce (el freewheel circula sin tocarla)
    if (qdOn) Vbus -= (idisch / p.Cbus) * h;
    if (trace) trace.push(idisch);
  }

  Vbus = Math.max(p.Vin, Vbus);
  heat = Math.max(0, heat - dt * 60) + (dphase === 'funde' || dphase === 'pincha' ? Math.min(Edrop / E_MELT, 1) * 0.02 : 0);
  heat = clamp(heat, 0, 1);

  return {
    t: s.t + dt, Vbus, phi, iL, iin, Icharge, Pin, Pout, eta, Iin_avg, dutyEff,
    sourceSag, ripple: inputRipplePct(p, s.Vbus, dutyEff),
    idisch, qdOn, Rj, dphase, Edrop, pinchT, arcT, heat, drops, Pj,
  };
}
