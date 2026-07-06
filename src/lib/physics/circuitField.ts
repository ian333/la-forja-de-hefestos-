/**
 * circuitField — motor del LATIGAZO (corto-circuito controlado) para el módulo
 * de campo magnético. Da i(t), V, R, fase, gotas. El componente calcula el
 * campo B por Biot-Savart (B = i·B_unit, B_unit precomputado de la geometría).
 * Puro / numérico (mismo modelo que scripts/latigazo-corto-controlado.py).
 */
const G = 1.5, MU0 = 4 * Math.PI * 1e-7, RHOL = 1.2e-6, RHO = 7000, CP = 600, TLIQ = 1520;
const D = 0.8e-3, RW = D / 2, AW = Math.PI * RW * RW, LB = 0.5e-3, MB = RHO * AW * LB;
const RFIX = 10e-3, VARC = 18, RCONTACT = 20e-3, KRATE = 0.35, KSURF = 0.08, RMIN = 0.05e-3;
const icrit = (r: number) => Math.sqrt(8 * Math.PI * Math.PI * r * G / MU0);

export interface CFParams { Vsrc: number; L: number; control: boolean; Rcut: number; }
export interface CFState {
  t: number; i: number; phase: 'corto' | 'cuello' | 'arco';
  r: number; T: number; E: number; drops: number; arct: number; V: number; R: number;
}
export const CF_DEFAULTS: CFParams = { Vsrc: 22, L: 50e-6, control: true, Rcut: 2e-3 };
export const MU0_CONST = MU0, RW_CONST = RW;

export function cfReset(): CFState {
  return { t: 0, i: 60, phase: 'corto', r: RW, T: 600, E: 0, drops: 0, arct: 0, V: 0, R: RCONTACT };
}

export function cfStep(s: CFState, p: CFParams, dt: number): CFState {
  if (s.phase === 'corto' || s.phase === 'cuello') {
    const liq = s.phase === 'cuello';
    const Rb = liq ? RHOL * LB / (Math.PI * s.r * s.r) : RCONTACT;
    const cut = p.control && liq && (Rb > p.Rcut);
    if (cut) s.i += (-VARC - s.i * RFIX) / p.L * dt;
    else s.i += (p.Vsrc - s.i * (RFIX + Rb)) / p.L * dt;
    if (s.i < 0) s.i = 0;
    s.V = s.i * Rb; s.R = Rb; s.E += s.V * s.i * dt;
    if (!liq) {
      s.T += s.i * s.i * Rb / (MB * CP) * dt;
      if (s.T >= TLIQ) { s.phase = 'cuello'; s.r = RW; }
    } else {
      const ic = icrit(s.r);
      const dr = (s.i > ic ? KRATE * (1 - (ic / Math.max(s.i, 1)) ** 2) : 0) + KSURF;
      s.r -= dr * dt;
      if (s.r <= RMIN) { s.drops++; s.phase = 'arco'; s.arct = 0; s.E = 0; }
    }
  } else {
    s.i += (-VARC - s.i * RFIX) / p.L * dt; if (s.i < 0) s.i = 0;
    s.V = VARC; s.R = Infinity; s.arct += dt;
    if (s.arct > 1.2e-3) { s.phase = 'corto'; s.r = RW; s.T = 600; s.E = 0; }
  }
  s.t += dt;
  return s;
}

/** Energía en el campo magnético del choque: ½ L i². [J] */
export function fieldEnergy(i: number, L: number) { return 0.5 * L * i * i; }
/** B en la superficie del alambre por la corriente: μ0 i/(2π rw). [T] */
export function bSurface(i: number) { return MU0 * i / (2 * Math.PI * RW); }
