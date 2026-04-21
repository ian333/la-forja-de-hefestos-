/**
 * ⚒️ La Forja — Mechanical Clock (Peldaño 6 — the capstone)
 * =============================================================================
 * A full mechanical clock is the compound assembly of five earlier peldaños:
 * the seconds pendulum drives the escapement (Peldaño 5), the escape wheel
 * drives a *train* of compound spur-gear pairs (Peldaño 1), each pair providing
 * a reduction r = Z_pinion / Z_wheel < 1, and each reduction's *product* brings
 * the escape wheel's angular velocity down to three hand velocities:
 *
 *     ω_seconds  =  2π / 60      rad s⁻¹        (1 rev / minute)
 *     ω_minute   =  2π / 3600    rad s⁻¹        (1 rev / hour)
 *     ω_hour     =  2π / 43200   rad s⁻¹        (1 rev / 12 h)
 *
 * The escapement (N = 30 teeth, T = 2 s seconds pendulum) delivers
 *
 *     ω_escape   =  4π / (N · T) = 2π / 30   rad s⁻¹     (1 rev / 30 s).
 *
 * The gear-train ratios must therefore collapse to
 *
 *     ω_seconds / ω_escape  =  1 / 2
 *     ω_minute  / ω_seconds =  1 / 60
 *     ω_hour    / ω_minute  =  1 / 12
 *
 * whose product is  1 / (2 · 60 · 12) = 1 / 1440  —  and indeed
 * ω_hour / ω_escape = (2π/43200) / (2π/30) = 30/43200 = 1/1440.  ✓
 *
 * That equality is the capstone invariant of the forge: a closed-form chain of
 * ratios that, fed by a 2-second pendulum, will put every clock hand in the
 * position a human reads as the **wall-clock time**.
 *
 * Peldaño 6 exposes:
 *   • `computeClockGeometry(p)`    — period, ω's, compound ratio, is-real-time
 *   • `computeClockKinematics(p)`  — unwrapped angles + decoded HH:MM:SS
 *   • `buildClock(p)`              — SDF scene: dial, hands, pendulum
 *
 * All functions are pure synchronous closed forms. Scrub `time` and watch the
 * three hands sweep at physically correct rates.
 */

import {
  makeBox,
  makeCylinder,
  makeModule,
  makeOp,
  type SdfModule,
  type SdfOperation,
  type SdfNode,
} from '../sdf-engine';
import { makeRevoluteJoint, type Joint } from '../joints';
import {
  ESCAPEMENT_DEFAULTS,
  escapementGeometry,
  escapementKinematics,
  type EscapementDerived,
  type EscapementKinematics,
} from './escapement';

// ─────────────────────────────────────────────────────────────
// Params
// ─────────────────────────────────────────────────────────────

export interface ClockParams {
  /** Escape wheel teeth count. Graham's classic seconds-wheel is 30. */
  teethCount: number;
  /** Pendulum length L (m).  L = g / π² ⇒ T = 2 s (seconds pendulum). */
  pendulumLength: number;
  /** g (m/s²). Earth = 9.80665. */
  gravity: number;
  /** Pendulum amplitude A (rad). Real clocks: 0.05 rad ≈ 2.9°. */
  amplitude: number;

  /** ω_seconds / ω_escape. 0.5 when N = 30 and T = 2 s. */
  escapeToSecondsRatio: number;
  /** ω_minute / ω_seconds.  1 / 60. */
  secondsToMinuteRatio: number;
  /** ω_hour / ω_minute.  1 / 12. */
  minuteToHourRatio: number;

  /** Dial radius. */
  dialRadius: number;
  /** Hour hand length. */
  hourHandLength: number;
  /** Minute hand length. */
  minuteHandLength: number;
  /** Seconds hand length. */
  secondsHandLength: number;
  /** Axial thickness of the dial. */
  dialThickness: number;
  /** Hand thickness (axial). */
  handThickness: number;

  /** Simulated elapsed time (s). t = 0 maps to 12:00:00. */
  time: number;
}

/**
 * Tune pendulum length L so that the amplitude-corrected period T equals
 * `targetPeriod` exactly. That's what a watchmaker does on a real bob: poise
 * the adjustment nut until the clock keeps time.
 *   T  = T₀ · (1 + A²/16 + 11 A⁴/3072)
 *   T₀ = 2π·√(L/g)
 *   ⇒ L = g · (T / (2π · k(A)))² ,    k(A) = 1 + A²/16 + 11 A⁴/3072
 */
export function tunePendulumLength(targetPeriod: number, gravity: number, amplitude: number): number {
  const A = amplitude;
  const k = 1 + (A * A) / 16 + (11 * A * A * A * A) / 3072;
  const T0 = targetPeriod / k;
  return gravity * (T0 / (2 * Math.PI)) ** 2;
}

export const CLOCK_DEFAULTS: ClockParams = {
  teethCount: 30,
  // Auto-tuned: T = exactly 2.000 s at A = 0.05, g = 9.80665 ⇒ L ≈ 0.99297 m.
  pendulumLength: tunePendulumLength(2.0, 9.80665, 0.05),
  gravity: 9.80665,
  amplitude: 0.05,
  escapeToSecondsRatio: 0.5,
  secondsToMinuteRatio: 1 / 60,
  minuteToHourRatio: 1 / 12,
  dialRadius: 1.6,
  hourHandLength: 0.9,
  minuteHandLength: 1.3,
  secondsHandLength: 1.45,
  dialThickness: 0.08,
  handThickness: 0.04,
  time: 0,
};

// ─────────────────────────────────────────────────────────────
// Geometry — ratios, ω's, compound chain
// ─────────────────────────────────────────────────────────────

export interface ClockGeometry {
  /** Pendulum period T (amplitude-corrected). */
  period: number;
  /** Escape wheel angular velocity ω_e = 4π/(N T). */
  escapeAngularVelocity: number;
  /** Seconds hand ω_s = escapeToSecondsRatio · ω_e. */
  secondsAngularVelocity: number;
  /** Minute hand ω_m = secondsToMinuteRatio · ω_s. */
  minuteAngularVelocity: number;
  /** Hour hand ω_h = minuteToHourRatio · ω_m. */
  hourAngularVelocity: number;
  /** Product ω_h / ω_e  =  escapeToSeconds · secondsToMinute · minuteToHour. */
  compoundRatio: number;
  /** Seconds per 2π rev of the seconds hand. True real-time clock ⇒ 60. */
  secondsPerSecondsRev: number;
  /** Seconds per rev of the minute hand.  True real-time ⇒ 3600. */
  secondsPerMinuteRev: number;
  /** Seconds per rev of the hour hand.  True real-time ⇒ 43200 (= 12 h). */
  secondsPerHourRev: number;
  /** True when the train delivers real-time ω's (60 / 3600 / 43200). */
  isRealTime: boolean;
  /** Escapement-scope derived values. */
  escapement: EscapementDerived;
}

const REALTIME_TOL = 1e-6;

export function clockGeometry(p: ClockParams): ClockGeometry {
  if (p.escapeToSecondsRatio <= 0) {
    throw new Error(`Clock escapeToSecondsRatio must be > 0 (got ${p.escapeToSecondsRatio})`);
  }
  if (p.secondsToMinuteRatio <= 0) {
    throw new Error(`Clock secondsToMinuteRatio must be > 0 (got ${p.secondsToMinuteRatio})`);
  }
  if (p.minuteToHourRatio <= 0) {
    throw new Error(`Clock minuteToHourRatio must be > 0 (got ${p.minuteToHourRatio})`);
  }
  const esc = escapementGeometry({
    ...ESCAPEMENT_DEFAULTS,
    teethCount: p.teethCount,
    pendulumLength: p.pendulumLength,
    gravity: p.gravity,
    amplitude: p.amplitude,
    time: p.time,
  });

  const omegaE = esc.escapeAngularVelocity;
  const omegaS = omegaE * p.escapeToSecondsRatio;
  const omegaM = omegaS * p.secondsToMinuteRatio;
  const omegaH = omegaM * p.minuteToHourRatio;

  const secondsPerSecondsRev = (2 * Math.PI) / omegaS;
  const secondsPerMinuteRev = (2 * Math.PI) / omegaM;
  const secondsPerHourRev = (2 * Math.PI) / omegaH;

  const isRealTime =
    Math.abs(secondsPerSecondsRev - 60) < REALTIME_TOL &&
    Math.abs(secondsPerMinuteRev - 3600) < REALTIME_TOL &&
    Math.abs(secondsPerHourRev - 43200) < REALTIME_TOL;

  const compoundRatio =
    p.escapeToSecondsRatio * p.secondsToMinuteRatio * p.minuteToHourRatio;

  return {
    period: esc.period,
    escapeAngularVelocity: omegaE,
    secondsAngularVelocity: omegaS,
    minuteAngularVelocity: omegaM,
    hourAngularVelocity: omegaH,
    compoundRatio,
    secondsPerSecondsRev,
    secondsPerMinuteRev,
    secondsPerHourRev,
    isRealTime,
    escapement: esc,
  };
}

// ─────────────────────────────────────────────────────────────
// Kinematics — angles + decoded HH:MM:SS
// ─────────────────────────────────────────────────────────────

export interface ClockKinematics {
  /** Unwrapped seconds-hand angle ω_s · t. */
  secondsAngle: number;
  /** Unwrapped minute-hand angle ω_m · t. */
  minuteAngle: number;
  /** Unwrapped hour-hand angle ω_h · t. */
  hourAngle: number;
  /** Displayed seconds-hand angle, 0 ≤ θ < 2π, 12 o'clock = 0. */
  secondsDisplay: number;
  /** Displayed minute-hand angle. */
  minuteDisplay: number;
  /** Displayed hour-hand angle. */
  hourDisplay: number;
  /** Decoded hours, 0..11  (from hour hand). */
  displayedHours: number;
  /** Decoded minutes, 0..59 (from minute hand). */
  displayedMinutes: number;
  /** Decoded seconds, 0..59 (from seconds hand — fractional). */
  displayedSeconds: number;
  /** Escapement kinematic values, for composition. */
  escapement: EscapementKinematics;
}

/**
 * Fractional turns, snapped to 0 when the elapsed time is (within ULP) an
 * integer multiple of the hand's period. This avoids 59-vs-0-minute flicker
 * caused by tiny accumulated float error in the period itself.
 */
function fractionalTurn(time: number, secondsPerRev: number): number {
  const revs = time / secondsPerRev;
  const nearInt = Math.round(revs);
  if (Math.abs(revs - nearInt) < 1e-9) return 0;
  return revs - Math.floor(revs);
}

function wrappedFromPeriod(time: number, secondsPerRev: number): number {
  return 2 * Math.PI * fractionalTurn(time, secondsPerRev);
}

export function clockKinematics(p: ClockParams): ClockKinematics {
  const g = clockGeometry(p);
  const t = p.time;
  const secondsAngle = g.secondsAngularVelocity * t;
  const minuteAngle = g.minuteAngularVelocity * t;
  const hourAngle = g.hourAngularVelocity * t;

  const secondsDisplay = wrappedFromPeriod(t, g.secondsPerSecondsRev);
  const minuteDisplay = wrappedFromPeriod(t, g.secondsPerMinuteRev);
  const hourDisplay = wrappedFromPeriod(t, g.secondsPerHourRev);

  // Decode HH:MM:SS from the *fractional-turn* of each hand — equivalent to
  // reading the angle back to time, but computed without the 2π round-trip
  // that accumulates ULP errors at integer turn counts (t = 3600, 7200, …).
  const secondsFrac = fractionalTurn(t, g.secondsPerSecondsRev);
  const minuteFrac = fractionalTurn(t, g.secondsPerMinuteRev);
  const hourFrac = fractionalTurn(t, g.secondsPerHourRev);
  const displayedSeconds = secondsFrac * 60;
  // Add a small ULP-tolerance before flooring so that exact-integer positions
  // (t = 3600 ⇒ hour count = 1.0 which float may give as 0.9999…) read correctly.
  const displayedMinutes = Math.floor(minuteFrac * 60 + 1e-9) % 60;
  const displayedHours = Math.floor(hourFrac * 12 + 1e-9) % 12;

  return {
    secondsAngle,
    minuteAngle,
    hourAngle,
    secondsDisplay,
    minuteDisplay,
    hourDisplay,
    displayedHours,
    displayedMinutes,
    displayedSeconds,
    escapement: escapementKinematics({
      ...ESCAPEMENT_DEFAULTS,
      teethCount: p.teethCount,
      pendulumLength: p.pendulumLength,
      gravity: p.gravity,
      amplitude: p.amplitude,
      time: t,
    }),
  };
}

/** Given elapsed seconds, format HH:MM:SS (12-hour face, SS to 2 decimals). */
export function formatClockTime(k: ClockKinematics): string {
  const hh = String(k.displayedHours).padStart(2, '0');
  const mm = String(k.displayedMinutes).padStart(2, '0');
  const ss = k.displayedSeconds.toFixed(2).padStart(5, '0');
  return `${hh}:${mm}:${ss}`;
}

// ─────────────────────────────────────────────────────────────
// Scene build — dial + 3 hands, all concentric on +Z axis
// ─────────────────────────────────────────────────────────────

export interface ClockBuild {
  dial: SdfModule;
  hourHand: SdfModule;
  minuteHand: SdfModule;
  secondsHand: SdfModule;
  joints: Joint[];
  rootOp: SdfOperation;
  geometry: ClockGeometry;
  kinematics: ClockKinematics;
  params: ClockParams;
}

/** A thin hand: a box of (length × 2·halfWidth × thickness) whose base lives
 *  at the world origin and whose tip points at angle `rotation` clockwise from
 *  12 o'clock (12 = +Y).
 *
 *  Why the midpoint is computed here and not by just setting `box.rotation`:
 *  the SDF engine applies rotation *around the primitive's position* — i.e.
 *  its own center — so rotating a box positioned at `[0, length/2, 0]` just
 *  spins it in place; it never pivots around the clock hub. To make the hand
 *  swing around the origin we must translate the box to the **midpoint of the
 *  post-rotation hand**: (½ L sin θ, ½ L cos θ, 0) with θ = rotation. */
function makeHand(
  length: number,
  halfWidth: number,
  thickness: number,
  rotation: number,
  label: string,
): SdfNode {
  const cx = (length / 2) * Math.sin(rotation);
  const cy = (length / 2) * Math.cos(rotation);
  const box = makeBox([cx, cy, 0], [halfWidth * 2, length, thickness]);
  box.rotation = [0, 0, -rotation];
  box.label = label;
  return box;
}

export function buildClock(params: ClockParams = CLOCK_DEFAULTS): ClockBuild {
  const g = clockGeometry(params);
  const k = clockKinematics(params);

  // Dial: a shallow cylinder plus 12 hour-mark blocks at the 12/3/6/9 etc. angles.
  const dialCyl = makeCylinder([0, 0, -params.dialThickness / 2], params.dialRadius, params.dialThickness);
  dialCyl.rotation = [Math.PI / 2, 0, 0];
  dialCyl.label = 'Dial — plate';

  const dialChildren: SdfNode[] = [dialCyl];
  const tickLen = params.dialRadius * 0.08;
  const tickHalfW = params.dialRadius * 0.012;
  const tickRadius = params.dialRadius * 0.92;
  for (let h = 0; h < 12; h++) {
    const angle = (2 * Math.PI * h) / 12;
    const cx = tickRadius * Math.sin(angle);
    const cy = tickRadius * Math.cos(angle);
    const tick = makeBox([cx, cy, 0], [tickHalfW * 2, tickLen, params.handThickness]);
    tick.rotation = [0, 0, -angle];
    tick.label = `Tick ${h === 0 ? 12 : h}`;
    dialChildren.push(tick);
  }

  const dialUnion = makeOp('union', dialChildren);
  dialUnion.label = 'Dial — union';
  const dial = makeModule('Dial');
  dial.children = [dialUnion];

  const hourHandNode = makeHand(
    params.hourHandLength,
    params.dialRadius * 0.06,
    params.handThickness,
    k.hourDisplay,
    'Hour hand',
  );
  const hourUnion = makeOp('union', [hourHandNode]);
  hourUnion.label = 'Hour hand — union';
  const hourHand = makeModule('Hour hand');
  hourHand.children = [hourUnion];

  const minuteHandNode = makeHand(
    params.minuteHandLength,
    params.dialRadius * 0.04,
    params.handThickness,
    k.minuteDisplay,
    'Minute hand',
  );
  const minuteUnion = makeOp('union', [minuteHandNode]);
  minuteUnion.label = 'Minute hand — union';
  const minuteHand = makeModule('Minute hand');
  minuteHand.children = [minuteUnion];

  const secondsHandNode = makeHand(
    params.secondsHandLength,
    params.dialRadius * 0.018,
    params.handThickness,
    k.secondsDisplay,
    'Seconds hand',
  );
  const secondsUnion = makeOp('union', [secondsHandNode]);
  secondsUnion.label = 'Seconds hand — union';
  const secondsHand = makeModule('Seconds hand');
  secondsHand.children = [secondsUnion];

  const joints: Joint[] = [
    makeRevoluteJoint('ground', hourHand.id, [0, 0, 0], [0, 0, 1], {
      drive: -k.hourDisplay,
      label: 'Hour hand revolute',
    }),
    makeRevoluteJoint('ground', minuteHand.id, [0, 0, 0], [0, 0, 1], {
      drive: -k.minuteDisplay,
      label: 'Minute hand revolute',
    }),
    makeRevoluteJoint('ground', secondsHand.id, [0, 0, 0], [0, 0, 1], {
      drive: -k.secondsDisplay,
      label: 'Seconds hand revolute',
    }),
  ];

  const children: SdfNode[] = [dial, hourHand, minuteHand, secondsHand];
  const rootOp = makeOp('union', children);
  rootOp.label = 'Mechanical clock';

  return {
    dial,
    hourHand,
    minuteHand,
    secondsHand,
    joints,
    rootOp,
    geometry: g,
    kinematics: k,
    params,
  };
}

export function buildClockScene(params?: ClockParams): SdfOperation {
  return buildClock(params).rootOp;
}
