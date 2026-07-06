/**
 * dropCannon — oscilador multi-modo de gota + trayectoria.
 *
 * Auto-pinch (J x B SIN bobina): la corriente I(t) por la gota genera su propio
 * campo. I(t) lleva DOS frecuencias:
 *   f₂ -> modo l=2 (elipsoide, PINCHA)
 *   f₃ -> modo l=3 (pera, APUNTA)
 * La trayectoria sale de Fourier puro: circulo=1 tono, cuadrado=impares.
 *
 * Rayleigh-Lamb: omega_l^2 = l(l-1)(l+2) gamma / (rho a^3)
 * Valores del lab 2026-06-06: a=0.125mm, E=2J, R_contacto=7.6 ohm.
 */

const GAM = 1.5, RHO = 7000, MU_V = 6e-3, PI = Math.PI, ICRIT = 194;

export const P2 = (c: number) => (3 * c * c - 1) / 2;
export const P3 = (c: number) => (5 * c * c * c - 3 * c) / 2;

export const flRL = (l: number, a: number) =>
  Math.sqrt(l * (l - 1) * (l + 2) * GAM / (RHO * a * a * a)) / (2 * PI);

export const QlRL = (l: number, a: number) => {
  const w = 2 * PI * flRL(l, a);
  const nu = MU_V / RHO;
  return w * a * a / (10 * nu);
};

export type Pattern = 'circle' | 'square' | 'line' | 'paths3' | 'fill' | 'wall';

export interface CParams {
  a: number; I0: number; A2: number; A3: number;
  track2: boolean; track3: boolean;
  f2d: number; f3d: number;
  pattern: Pattern;
  nPer: number; patR: number; nLayers: number;
}

export interface CState {
  t: number;
  q2: number; q2d: number; ph2: number;
  q3: number; q3d: number; ph3: number;
  f2: number; f3: number; Q2: number; Q3: number;
  I: number; aim: number;
  nDrops: number; flash: number;
}

export interface DepDrop { x: number; y: number; z: number; t: number }

export const LAYER_H = 0.42;   // altura de capa (unidades de escena)

export const CANNON_DEFAULTS: CParams = {
  a: 0.125e-3, I0: 55, A2: 10, A3: 6,
  track2: true, track3: true, f2d: 4700, f3d: 9100,
  pattern: 'paths3', nPer: 16, patR: 2.5, nLayers: 5,
};

export function cReset(p: CParams): CState {
  return {
    t: 0, q2: 0, q2d: 0, ph2: 0, q3: 0, q3d: 0, ph3: 0,
    f2: flRL(2, p.a), f3: flRL(3, p.a),
    Q2: QlRL(2, p.a), Q3: QlRL(3, p.a),
    I: p.I0, aim: 0, nDrops: 0, flash: 0,
  };
}

export function cStep(s: CState, p: CParams, dt: number): { s: CState; drop: DepDrop | null } {
  const f2n = flRL(2, p.a), f3n = flRL(3, p.a);
  const Q2 = Math.max(QlRL(2, p.a), 1), Q3 = Math.max(QlRL(3, p.a), 1);
  const w2 = 2 * PI * f2n, w3 = 2 * PI * f3n;
  const g2 = w2 / Q2, g3 = w3 / Q3;
  const wd2 = 2 * PI * (p.track2 ? f2n : p.f2d);
  const wd3 = 2 * PI * (p.track3 ? f3n : p.f3d);
  const AL = 0.35;

  const Iof = (p2: number, p3: number) => p.I0 + p.A2 * Math.cos(p2) + p.A3 * Math.cos(p3);

  const p20 = s.ph2, p30 = s.ph3;
  const p2h = p20 + wd2 * dt / 2, p3h = p30 + wd3 * dt / 2;
  const p21 = p20 + wd2 * dt, p31 = p30 + wd3 * dt;

  const u0 = Iof(p20, p30) / ICRIT;
  const uh = Iof(p2h, p3h) / ICRIT;
  const u1 = Iof(p21, p31) / ICRIT;
  const F2 = [w2 * w2 * u0 * u0, w2 * w2 * uh * uh, w2 * w2 * u1 * u1];
  const F3 = [w3 * w3 * u0 * u0 * AL, w3 * w3 * uh * uh * AL, w3 * w3 * u1 * u1 * AL];

  let q2 = s.q2, v2 = s.q2d;
  { const k1q = v2,                       k1v = F2[0] - g2 * v2 - w2 * w2 * q2;
    const k2q = v2 + dt / 2 * k1v,        k2v = F2[1] - g2 * (v2 + dt / 2 * k1v) - w2 * w2 * (q2 + dt / 2 * k1q);
    const k3q = v2 + dt / 2 * k2v,        k3v = F2[1] - g2 * (v2 + dt / 2 * k2v) - w2 * w2 * (q2 + dt / 2 * k2q);
    const k4q = v2 + dt * k3v,            k4v = F2[2] - g2 * (v2 + dt * k3v) - w2 * w2 * (q2 + dt * k3q);
    q2 += dt / 6 * (k1q + 2 * k2q + 2 * k3q + k4q);
    v2 += dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v); }

  let q3 = s.q3, v3 = s.q3d;
  { const k1q = v3,                       k1v = F3[0] - g3 * v3 - w3 * w3 * q3;
    const k2q = v3 + dt / 2 * k1v,        k2v = F3[1] - g3 * (v3 + dt / 2 * k1v) - w3 * w3 * (q3 + dt / 2 * k1q);
    const k3q = v3 + dt / 2 * k2v,        k3v = F3[1] - g3 * (v3 + dt / 2 * k2v) - w3 * w3 * (q3 + dt / 2 * k2q);
    const k4q = v3 + dt * k3v,            k4v = F3[2] - g3 * (v3 + dt * k3v) - w3 * w3 * (q3 + dt * k3q);
    q3 += dt / 6 * (k1q + 2 * k2q + 2 * k3q + k4q);
    v3 += dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v); }

  let nDrops = s.nDrops, flash = Math.max(0, s.flash - dt * 60);
  let drop: DepDrop | null = null, aim = s.aim;

  if (q2 >= 1) {
    if (nDrops < patTotal(p.pattern, p)) {
      const pos = patPos3D(p.pattern, nDrops, p);
      aim = Math.atan2(pos.z, pos.x);
      drop = { x: pos.x, y: pos.y, z: pos.z, t: s.t + dt };
      nDrops++; flash = 1;
    }
    q2 = 0; v2 = 0; q3 = 0; v3 = 0;   // pieza completa -> resetea sin depositar
  }

  return {
    s: { t: s.t + dt, q2, q2d: v2, ph2: p21, q3, q3d: v3, ph3: p31,
         f2: f2n, f3: f3n, Q2, Q3, I: Iof(p20, p30), aim, nDrops, flash },
    drop,
  };
}

/** Gotas por CAPA segun el patron. */
export function patLayer(pat: Pattern, p: CParams): number {
  const n = Math.max(p.nPer, 2);
  if (pat === 'paths3') return 3 * n;
  if (pat === 'fill')   return n * n;
  if (pat === 'wall')   return 4 * (n - 1);
  return n;   // circle, square, line (planos)
}

/** Total de gotas de la pieza (capas × por-capa). Planos = 1 capa. */
export function patTotal(pat: Pattern, p: CParams): number {
  const planar = pat === 'circle' || pat === 'square' || pat === 'line';
  return patLayer(pat, p) * (planar ? 1 : Math.max(p.nLayers, 1));
}

/** Posicion 3D de la gota #idx del toolpath. {x,y,z} en unidades de escena. */
export function patPos3D(pat: Pattern, idx: number, p: CParams): { x: number; y: number; z: number } {
  const n = Math.max(p.nPer, 2), R = p.patR;
  const per = patLayer(pat, p);
  const layer = Math.floor(idx / per);
  const k = idx % per;
  const y = layer * LAYER_H;

  if (pat === 'paths3') {
    const path = Math.floor(k / n);           // 0,1,2
    let col = k % n;
    if (path % 2 === 1) col = n - 1 - col;     // serpentina = camino continuo
    return { x: -R + 2 * R * col / (n - 1), y, z: (path - 1) * R * 0.55 };
  }
  if (pat === 'fill') {
    const row = Math.floor(k / n);
    let col = k % n;
    if (row % 2 === 1) col = n - 1 - col;      // raster serpenteado
    return { x: -R + 2 * R * col / (n - 1), y, z: -R + 2 * R * row / (n - 1) };
  }
  if (pat === 'wall') {
    const side = Math.floor(k / (n - 1));
    const f = (k % (n - 1)) / (n - 1);
    if (side === 0) return { x: -R + 2 * R * f, y, z: -R };
    if (side === 1) return { x: R,             y, z: -R + 2 * R * f };
    if (side === 2) return { x: R - 2 * R * f, y, z: R };
    return            { x: -R,             y, z: R - 2 * R * f };
  }
  // planos (y=0)
  const t = k / n;
  if (pat === 'square') { const s = sqPos(t, R); return { x: s.x, y: 0, z: s.z }; }
  if (pat === 'line')   return { x: R * (2 * t - 1), y: 0, z: 0 };
  return { x: R * Math.cos(2 * PI * t), y: 0, z: R * Math.sin(2 * PI * t) };
}

function sqPos(t: number, R: number) {
  const s = t * 4;
  if (s < 1) return { x:  R,                z: R * (-1 + 2 * s) };
  if (s < 2) return { x:  R * (1 - 2 * (s - 1)), z:  R };
  if (s < 3) return { x: -R,                z: R * (1 - 2 * (s - 2)) };
  return            { x:  R * (-1 + 2 * (s - 3)), z: -R };
}
