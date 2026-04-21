/**
 * Mecánica clásica — ecuaciones lagrangianas analíticas para sistemas
 * canónicos. Integrador RK4 y energías para verificación.
 *
 * Incluye:
 *   - Péndulo doble (caos lagrangiano)
 *   - Oscilador armónico simple y amortiguado-forzado
 *   - Péndulo simple (grande-amplitud; no linealizado)
 */

// ─── Péndulo doble ──────────────────────────────────────────────────────
//
// Coordenadas: θ₁, θ₂ (ángulos desde la vertical, 0 = abajo, + = antihorario).
// Parámetros: m₁, m₂, L₁, L₂, g.
//
// Ecuaciones de Lagrange resueltas para θ̈₁, θ̈₂ (ver Taylor, Classical
// Mechanics §11.4 o Goldstein §1.3):
//
//   num1 = -g(2m1+m2)sinθ1 - m2 g sin(θ1-2θ2) - 2sin(θ1-θ2) m2 (ω2² L2 + ω1² L1 cos(θ1-θ2))
//   den1 = L1 (2m1 + m2 - m2 cos(2θ1-2θ2))
//   θ̈₁ = num1 / den1
//
//   num2 = 2 sin(θ1-θ2) (ω1² L1 (m1+m2) + g(m1+m2) cosθ1 + ω2² L2 m2 cos(θ1-θ2))
//   den2 = L2 (2m1 + m2 - m2 cos(2θ1-2θ2))
//   θ̈₂ = num2 / den2

export interface DoublePendulumParams {
  m1: number; m2: number;     // kg
  L1: number; L2: number;     // m
  g: number;                  // m/s² (default 9.81)
}

export interface DoublePendulumState {
  t: number;
  th1: number; th2: number;   // rad
  w1: number;  w2: number;    // rad/s (omega)
}

export function dpDerivatives(s: DoublePendulumState, p: DoublePendulumParams): {
  th1Dot: number; th2Dot: number; w1Dot: number; w2Dot: number;
} {
  const { m1, m2, L1, L2, g } = p;
  const { th1, th2, w1, w2 } = s;
  const d = th1 - th2;
  const sd  = Math.sin(d), cd = Math.cos(d);
  const s1  = Math.sin(th1), s2 = Math.sin(th2);
  const s12_2 = Math.sin(th1 - 2*th2);
  const denCommon = 2*m1 + m2 - m2 * Math.cos(2*th1 - 2*th2);

  const num1 = -g*(2*m1 + m2)*s1
             - m2*g*s12_2
             - 2*sd*m2*(w2*w2*L2 + w1*w1*L1*cd);
  const num2 = 2*sd*( w1*w1*L1*(m1 + m2)
                    + g*(m1 + m2)*Math.cos(th1)
                    + w2*w2*L2*m2*cd );

  return {
    th1Dot: w1,
    th2Dot: w2,
    w1Dot: num1 / (L1 * denCommon),
    w2Dot: num2 / (L2 * denCommon),
  };
}

/** RK4 step for double pendulum. */
export function dpStep(state: DoublePendulumState, p: DoublePendulumParams, dt: number): DoublePendulumState {
  const k1 = dpDerivatives(state, p);
  const s2: DoublePendulumState = {
    t: state.t + dt/2,
    th1: state.th1 + dt/2 * k1.th1Dot,
    th2: state.th2 + dt/2 * k1.th2Dot,
    w1:  state.w1  + dt/2 * k1.w1Dot,
    w2:  state.w2  + dt/2 * k1.w2Dot,
  };
  const k2 = dpDerivatives(s2, p);
  const s3: DoublePendulumState = {
    t: state.t + dt/2,
    th1: state.th1 + dt/2 * k2.th1Dot,
    th2: state.th2 + dt/2 * k2.th2Dot,
    w1:  state.w1  + dt/2 * k2.w1Dot,
    w2:  state.w2  + dt/2 * k2.w2Dot,
  };
  const k3 = dpDerivatives(s3, p);
  const s4: DoublePendulumState = {
    t: state.t + dt,
    th1: state.th1 + dt * k3.th1Dot,
    th2: state.th2 + dt * k3.th2Dot,
    w1:  state.w1  + dt * k3.w1Dot,
    w2:  state.w2  + dt * k3.w2Dot,
  };
  const k4 = dpDerivatives(s4, p);
  return {
    t: state.t + dt,
    th1: state.th1 + dt * (k1.th1Dot + 2*k2.th1Dot + 2*k3.th1Dot + k4.th1Dot) / 6,
    th2: state.th2 + dt * (k1.th2Dot + 2*k2.th2Dot + 2*k3.th2Dot + k4.th2Dot) / 6,
    w1:  state.w1  + dt * (k1.w1Dot  + 2*k2.w1Dot  + 2*k3.w1Dot  + k4.w1Dot ) / 6,
    w2:  state.w2  + dt * (k1.w2Dot  + 2*k2.w2Dot  + 2*k3.w2Dot  + k4.w2Dot ) / 6,
  };
}

/** Total mechanical energy (kinetic + potential). */
export function dpEnergy(s: DoublePendulumState, p: DoublePendulumParams): number {
  const { m1, m2, L1, L2, g } = p;
  const { th1, th2, w1, w2 } = s;
  // Positions
  const y1 = -L1 * Math.cos(th1);
  const y2 = y1 - L2 * Math.cos(th2);
  // Kinetic: T = ½ m1 (L1 ω1)² + ½ m2 [(L1 ω1)² + (L2 ω2)² + 2 L1 L2 ω1 ω2 cos(θ1-θ2)]
  const T = 0.5*m1*(L1*w1)*(L1*w1)
          + 0.5*m2*((L1*w1)*(L1*w1) + (L2*w2)*(L2*w2) + 2*L1*L2*w1*w2*Math.cos(th1 - th2));
  const U = m1*g*y1 + m2*g*y2;
  return T + U;
}

/** Cartesian positions of the two bobs (for rendering). */
export function dpPositions(s: DoublePendulumState, p: DoublePendulumParams): {
  x1: number; y1: number; x2: number; y2: number;
} {
  const x1 = p.L1 * Math.sin(s.th1);
  const y1 = -p.L1 * Math.cos(s.th1);
  const x2 = x1 + p.L2 * Math.sin(s.th2);
  const y2 = y1 - p.L2 * Math.cos(s.th2);
  return { x1, y1, x2, y2 };
}

// ─── Oscilador armónico simple (para el toolkit) ─────────────────────────

export interface SHOState { x: number; v: number; t: number; }
export interface SHOParams { m: number; k: number; b?: number; F0?: number; omega?: number; }

/** RK4 for m ẍ + b ẋ + k x = F0 cos(Ω t). */
export function shoStep(s: SHOState, p: SHOParams, dt: number): SHOState {
  const b = p.b ?? 0, F0 = p.F0 ?? 0, Om = p.omega ?? 0;
  const f = (x: number, v: number, t: number) => (-p.k * x - b * v + F0 * Math.cos(Om * t)) / p.m;
  const k1v = f(s.x, s.v, s.t),              k1x = s.v;
  const k2v = f(s.x + dt/2 * k1x, s.v + dt/2 * k1v, s.t + dt/2), k2x = s.v + dt/2 * k1v;
  const k3v = f(s.x + dt/2 * k2x, s.v + dt/2 * k2v, s.t + dt/2), k3x = s.v + dt/2 * k2v;
  const k4v = f(s.x + dt   * k3x, s.v + dt   * k3v, s.t + dt  ), k4x = s.v + dt   * k3v;
  return {
    t: s.t + dt,
    x: s.x + dt * (k1x + 2*k2x + 2*k3x + k4x) / 6,
    v: s.v + dt * (k1v + 2*k2v + 2*k3v + k4v) / 6,
  };
}
