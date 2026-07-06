/**
 * metalDrop — SIMULACION (no representacion) de la gota resonante de acero E71T-GS.
 *
 * Integra la ODE REAL del modo l=2 de Rayleigh:
 *     q'' + γ q' + ω₂² q = ω₂² · (I(t)/I_crit)² · fL      (RK4)
 * con  ω₂ = 2π·f₂,  f₂ = √(8γ/ρa³)/2π,  γ_damp = ω₂/Q,  Q = ω₂·τ_visc/2.
 * El forzamiento usa la corriente INSTANTANEA I(t)=I₀+I_ac·cos(φ); el término
 * cruzado 2·I₀·I_ac la bombea en resonancia. Cuando el pico q ≥ 1 -> PINCHA.
 *
 * Termico (lumped, mismo modelo que gota-acoplada-completa.py): I²R contra
 * perdidas (conduccion + asimilar alambre frio); termostato por TCR ~liquidus;
 * fL (fraccion liquida) habilita la oscilacion.
 *
 * Todo sale de NUMEROS. El caller integra muchos sub-pasos por frame y escala
 * el tiempo para el ojo (la frecuencia REAL, 668 Hz, se reporta tal cual).
 */

const GAMMA0 = 1.5, RHO_L = 7000, RHO_S = 7850, CP = 600, LF = 250e3;
const K = 45, T0 = 25, TSOL = 1450, TLIQ = 1520, TSET = 1540;
const ICRIT = 194;
const PI = Math.PI;

export interface MetalDropParams {
  Rop: number; I0: number; Iac: number; fdrive: number; track: boolean;
  vf: number; gamma: number; mu: number; dWire: number; Lth: number;
  milk: boolean; ffire: number;   // ordeñado drop-on-demand: dispara cada 1/ffire
}
export interface MetalDropState {
  t: number; T: number; V: number;
  q: number; qd: number; phase: number;   // estado del oscilador REAL
  drops: number; beadH: number; flash: number;
  f2: number; Q: number; fL: number; I: number;  // diagnosticos (para graficar)
  dLast: number; tFire: number;            // diametro [m] de la ultima gota soltada; prox disparo
}

export const MD_DEFAULTS: MetalDropParams = {
  Rop: 0.15, I0: 55, Iac: 10, fdrive: 700, track: true,
  vf: 2.5e-3, gamma: 1.5, mu: 6e-3, dWire: 0.8e-3, Lth: 1e-3,
  milk: false, ffire: 500,
};

/** Diametro objetivo del ordeñado: V = A_w·v_f/f_disparo → d=(6V/π)^{1/3}. [m] */
export const dTargetMilk = (vf: number, dWire: number, ffire: number) =>
  Math.cbrt(6 * Aw(dWire) * vf / (PI * Math.max(ffire, 1)));

const SEED_A = 0.40e-3;
const Aw = (d: number) => PI / 4 * d * d;
export const aOf = (V: number) => Math.cbrt(3 * V / (4 * PI));
export const f2Of = (a: number, gamma: number) =>
  Math.sqrt(8 * gamma / (RHO_L * a * a * a)) / (2 * PI);
export const Qof = (a: number, mu: number) => {
  const nu = mu / RHO_L, tau = a * a / (5 * nu);
  return Math.sqrt(8 * GAMMA0 / (RHO_L * a * a * a)) * tau / 2;
};
const liquidFrac = (T: number) => Math.max(0, Math.min(1, (T - TSOL) / (TLIQ - TSOL)));

export function mdReset(p: MetalDropParams): MetalDropState {
  const V0 = 4 / 3 * PI * SEED_A ** 3;
  return {
    t: 0, T: T0, V: V0, q: 0, qd: 0, phase: 0,
    drops: 0, beadH: 0, flash: 0,
    f2: f2Of(SEED_A, p.gamma), Q: Qof(SEED_A, p.mu), fL: 0, I: p.I0,
    dLast: 2 * SEED_A, tFire: 1 / Math.max(p.ffire, 1),
  };
}

/** UN paso RK4 de la ODE. dt = segundos de SIMULACION (el caller da muchos por frame). */
export function mdStep(s: MetalDropState, p: MetalDropParams, dt: number): { s: MetalDropState; detached: boolean } {
  const a = aOf(s.V);
  const fL = liquidFrac(s.T);
  const f2 = f2Of(a, p.gamma);
  const Q = Math.max(Qof(a, p.mu), 1);

  // ---- termico (potencia promedio del ripple; el termostato sostiene ~liquidus) ----
  const m = RHO_S * s.V;
  const Ploss = K * Aw(p.dWire) * (s.T - T0) / p.Lth
    + RHO_S * Aw(p.dWire) * p.vf * (CP * (s.T - T0) + LF);
  let I0e = p.I0;
  if (s.T > TSET) {
    const hold = Math.sqrt(Math.max(Ploss / p.Rop - p.Iac * p.Iac / 2, 0));
    I0e = Math.min(p.I0, hold);
  }
  const Pin = (I0e * I0e + p.Iac * p.Iac / 2) * p.Rop;
  const cpeff = CP + (s.T > TSOL && s.T < TLIQ ? LF / (TLIQ - TSOL) : 0);
  let T = s.T + (Pin - Ploss) / (m * cpeff) * dt;
  T = Math.max(T0, Math.min(T, 2860));

  // ---- mecanico: RK4 del oscilador REAL ----
  const fd = p.track ? f2 : p.fdrive;
  const wd = 2 * PI * fd, w2 = 2 * PI * f2, g = w2 / Q, w2sq = w2 * w2;
  // forzamiento con la I0 COMANDADA (la junta la sostiene el boost LC, que el
  // analisis acoplado establecio como requerido); el termostato gobierna T/fL.
  const Iof = (ph: number) => p.I0 + p.Iac * Math.cos(ph);
  const Fof = (ph: number) => { const ii = Iof(ph) / ICRIT; return w2sq * ii * ii * fL; };
  const ph0 = s.phase;
  const F0 = Fof(ph0), Fh = Fof(ph0 + wd * dt / 2), F1 = Fof(ph0 + wd * dt);
  let q = s.q, v = s.qd;
  const k1q = v, k1v = F0 - g * v - w2sq * q;
  const k2q = v + dt / 2 * k1v, k2v = Fh - g * (v + dt / 2 * k1v) - w2sq * (q + dt / 2 * k1q);
  const k3q = v + dt / 2 * k2v, k3v = Fh - g * (v + dt / 2 * k2v) - w2sq * (q + dt / 2 * k2q);
  const k4q = v + dt * k3v, k4v = F1 - g * (v + dt * k3v) - w2sq * (q + dt * k3q);
  q = q + dt / 6 * (k1q + 2 * k2q + 2 * k3q + k4q);
  v = v + dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
  const phase = ph0 + wd * dt;
  const I = Iof(ph0);

  // ---- crecimiento + desprendimiento ----
  let V = s.V + Aw(p.dWire) * p.vf * dt;
  let detached = false, drops = s.drops, beadH = s.beadH, flash = Math.max(0, s.flash - dt * 60);
  let dLast = s.dLast, tFire = s.tFire;
  const tNow = s.t + dt;
  // ORDEÑADO (drop-on-demand): dispara en la cita 1/ffire (el RP2350 fasea el
  // pulso resonante a un pico de q → corte limpio). O antes, si la resonancia ya
  // llevo q a 1. Asi f_disparo + v_f MODULAN el tamaño: V = A_w·v_f/f_disparo.
  const V0SEED = 4 / 3 * PI * SEED_A ** 3;
  const scheduled = p.milk && tNow >= s.tFire;
  if ((q >= 1 || scheduled) && fL > 0.5) {
    const aEj = aOf(Math.max(V - V0SEED, 1e-15));   // gota EYECTADA = lo alimentado desde el último disparo
    detached = true; drops += 1; beadH += 2 * aEj; dLast = 2 * aEj;
    V = V0SEED; q = 0; v = 0; flash = 1;
    tFire = tNow + 1 / Math.max(p.ffire, 1);
  } else if (scheduled) {
    tFire = tNow + 1 / Math.max(p.ffire, 1);   // aun no funde: re-agenda sin disparar
  }

  return {
    s: { t: tNow, T, V, q, qd: v, phase, drops, beadH, flash, f2, Q, fL, I, dLast, tFire },
    detached,
  };
}

/** Amplitud estable del oscilador a frecuencia f (para la GRAFICA de resonancia). */
export function lorentzAmp(f: number, f2: number, Q: number, I0: number, Iac: number): number {
  const w2 = 2 * PI * f2, wd = 2 * PI * f, g = w2 / Q;
  const F = w2 * w2 * (2 * I0 * Iac / (ICRIT * ICRIT));
  return F / Math.sqrt((w2 * w2 - wd * wd) ** 2 + (g * wd) ** 2);
}

export function tempColor(T: number): [number, number, number] {
  if (T < 650) { const u = Math.max(0, (T - 25) / 625); return [0.28 + 0.2 * u, 0.29, 0.32]; }
  const x = (T - 650) / 1500;
  const r = Math.min(1, 0.55 + x * 1.25);
  const gn = Math.min(1, Math.max(0, (x - 0.16) * 1.15));
  const b = Math.min(1, Math.max(0, (x - 0.62) * 1.5));
  return [r, gn, b];
}

export { TLIQ, TSOL, ICRIT };
