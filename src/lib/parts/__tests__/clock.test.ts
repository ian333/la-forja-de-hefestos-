/**
 * ⚒️ Mechanical Clock — compound-gear-train invariants
 * =====================================================
 *   1. Defaults: seconds pendulum + N=30 + (0.5, 1/60, 1/12) ⇒ real-time clock.
 *   2. ω_seconds = 2π/60 rad/s, ω_minute = 2π/3600, ω_hour = 2π/43200.
 *   3. Compound ratio product = (1/2)·(1/60)·(1/12) = 1/1440 = ω_hour/ω_escape.
 *   4. isRealTime flag tracks the three ω equalities.
 *   5. Changing any ratio breaks isRealTime.
 *   6. After t = 60 s, seconds hand sweeps exactly 2π; minute sweeps 2π/60; hour sweeps 2π/720.
 *   7. Displayed time at t = 0 is 12:00:00.
 *   8. Displayed time at t = 3723.45 s is 01:02:03.45  (1 h, 2 min, 3.45 s).
 *   9. Displayed time at t = 12·3600 = 43200 s wraps to 12:00:00 again.
 *  10. Hand angles mod 2π always in [0, 2π).
 *  11. Scene produces dial + 3 hands + 3 joints at drives matching kinematics.
 *  12. Non-real-time train (e.g. escapeToSeconds = 1.0) decodes to a valid but
 *      differently-scaled "clock time" that is self-consistent.
 *  13. Escapement kinematics are composed correctly (ticks scale with time).
 *  14. Infeasible params (ratio ≤ 0) throw.
 */

import { describe, it, expect } from 'vitest';
import {
  CLOCK_DEFAULTS,
  buildClock,
  clockGeometry,
  clockKinematics,
  formatClockTime,
  type ClockParams,
} from '../clock';

function withParams(patch: Partial<ClockParams> = {}): ClockParams {
  return { ...CLOCK_DEFAULTS, ...patch };
}

describe('Clock — geometry: compound ratios and real-time check', () => {
  it('defaults produce a real-time clock (60s / 3600s / 43200s per rev)', () => {
    const g = clockGeometry(CLOCK_DEFAULTS);
    expect(g.secondsPerSecondsRev).toBeCloseTo(60, 3);
    expect(g.secondsPerMinuteRev).toBeCloseTo(3600, 1);
    expect(g.secondsPerHourRev).toBeCloseTo(43200, 0);
    expect(g.isRealTime).toBe(true);
  });

  it('ω_seconds = 2π/60, ω_minute = 2π/3600, ω_hour = 2π/43200', () => {
    const g = clockGeometry(CLOCK_DEFAULTS);
    expect(g.secondsAngularVelocity).toBeCloseTo((2 * Math.PI) / 60, 6);
    expect(g.minuteAngularVelocity).toBeCloseTo((2 * Math.PI) / 3600, 8);
    expect(g.hourAngularVelocity).toBeCloseTo((2 * Math.PI) / 43200, 9);
  });

  it('compound ratio product = 1/1440 = ω_hour/ω_escape', () => {
    const g = clockGeometry(CLOCK_DEFAULTS);
    expect(g.compoundRatio).toBeCloseTo(1 / (2 * 60 * 12), 12);
    expect(g.hourAngularVelocity / g.escapeAngularVelocity).toBeCloseTo(g.compoundRatio, 10);
  });

  it('changing escapeToSecondsRatio to 1.0 breaks real-time', () => {
    const p = withParams({ escapeToSecondsRatio: 1.0 });
    const g = clockGeometry(p);
    expect(g.isRealTime).toBe(false);
  });

  it('changing secondsToMinuteRatio to 1/30 breaks real-time', () => {
    const p = withParams({ secondsToMinuteRatio: 1 / 30 });
    const g = clockGeometry(p);
    expect(g.isRealTime).toBe(false);
  });

  it('changing minuteToHourRatio to 1/24 breaks real-time', () => {
    const p = withParams({ minuteToHourRatio: 1 / 24 });
    const g = clockGeometry(p);
    expect(g.isRealTime).toBe(false);
  });

  it('period T ≈ 2.000 s for the defaults (seconds pendulum)', () => {
    const g = clockGeometry(CLOCK_DEFAULTS);
    expect(g.period).toBeGreaterThan(1.99);
    expect(g.period).toBeLessThan(2.01);
  });

  it('rejects non-positive gear ratios', () => {
    expect(() => clockGeometry(withParams({ escapeToSecondsRatio: 0 }))).toThrow();
    expect(() => clockGeometry(withParams({ secondsToMinuteRatio: -0.01 }))).toThrow();
    expect(() => clockGeometry(withParams({ minuteToHourRatio: 0 }))).toThrow();
  });
});

describe('Clock — kinematics: hand sweep laws', () => {
  it('at t = 0 all hands at 0 rad (12 o\'clock)', () => {
    const k = clockKinematics(CLOCK_DEFAULTS);
    expect(k.secondsAngle).toBe(0);
    expect(k.minuteAngle).toBe(0);
    expect(k.hourAngle).toBe(0);
    expect(k.secondsDisplay).toBe(0);
    expect(k.minuteDisplay).toBe(0);
    expect(k.hourDisplay).toBe(0);
  });

  it('at t = 60 s: seconds = 2π, minute = 2π/60, hour = 2π/720', () => {
    const p = withParams({ time: 60 });
    const k = clockKinematics(p);
    expect(k.secondsAngle).toBeCloseTo(2 * Math.PI, 10);
    expect(k.minuteAngle).toBeCloseTo((2 * Math.PI) / 60, 10);
    expect(k.hourAngle).toBeCloseTo((2 * Math.PI) / 720, 10);
  });

  it('displayed angles wrap into [0, 2π)', () => {
    const samples = [60, 120, 600, 3600, 7200, 50_000];
    for (const t of samples) {
      const k = clockKinematics(withParams({ time: t }));
      expect(k.secondsDisplay).toBeGreaterThanOrEqual(0);
      expect(k.secondsDisplay).toBeLessThan(2 * Math.PI);
      expect(k.minuteDisplay).toBeGreaterThanOrEqual(0);
      expect(k.minuteDisplay).toBeLessThan(2 * Math.PI);
      expect(k.hourDisplay).toBeGreaterThanOrEqual(0);
      expect(k.hourDisplay).toBeLessThan(2 * Math.PI);
    }
  });

  it('at t = 43200 s (12 h) hands have wrapped back to 12:00:00', () => {
    const k = clockKinematics(withParams({ time: 43200 }));
    expect(k.secondsDisplay).toBeCloseTo(0, 6);
    expect(k.minuteDisplay).toBeCloseTo(0, 6);
    expect(k.hourDisplay).toBeCloseTo(0, 6);
  });
});

describe('Clock — decoded HH:MM:SS', () => {
  it('t = 0 ⇒ 12:00:00', () => {
    const k = clockKinematics(CLOCK_DEFAULTS);
    expect(k.displayedHours).toBe(0);
    expect(k.displayedMinutes).toBe(0);
    expect(k.displayedSeconds).toBeCloseTo(0, 6);
    expect(formatClockTime(k)).toBe('00:00:00.00');
  });

  it('t = 3723.45 s (1 h 2 min 3.45 s) decodes correctly', () => {
    const k = clockKinematics(withParams({ time: 3723.45 }));
    expect(k.displayedHours).toBe(1);
    expect(k.displayedMinutes).toBe(2);
    // Seconds hand wraps every 60 s — at 3723.45 s it shows 3.45 s past the minute.
    expect(k.displayedSeconds).toBeCloseTo(3.45, 4);
  });

  it('t = 75 s ⇒ 00:01:15', () => {
    const k = clockKinematics(withParams({ time: 75 }));
    expect(k.displayedHours).toBe(0);
    expect(k.displayedMinutes).toBe(1);
    expect(k.displayedSeconds).toBeCloseTo(15, 6);
  });

  it('t = 7322 s (2 h 2 min 2 s) decodes correctly', () => {
    const k = clockKinematics(withParams({ time: 7322 }));
    expect(k.displayedHours).toBe(2);
    expect(k.displayedMinutes).toBe(2);
    expect(k.displayedSeconds).toBeCloseTo(2, 5);
  });

  it('t = 43199.9 s (just before 12:00 wrap) ⇒ 11:59:59.9', () => {
    const k = clockKinematics(withParams({ time: 43199.9 }));
    expect(k.displayedHours).toBe(11);
    expect(k.displayedMinutes).toBe(59);
    expect(k.displayedSeconds).toBeCloseTo(59.9, 4);
  });

  it('formatClockTime pads correctly', () => {
    const k = clockKinematics(withParams({ time: 3723.45 }));
    expect(formatClockTime(k)).toBe('01:02:03.45');
  });

  it('round-trip: encode t → decode → matches elapsed time mod 43200', () => {
    const times = [0.1, 37, 500, 3600, 7200, 30_000, 43_000];
    for (const t of times) {
      const k = clockKinematics(withParams({ time: t }));
      const decoded =
        k.displayedHours * 3600 + k.displayedMinutes * 60 + k.displayedSeconds;
      expect(decoded).toBeCloseTo(t % 43200, 3);
    }
  });
});

describe('Clock — composition with escapement', () => {
  it('escapement kinematics composed — ticks scale as 2·t/T', () => {
    const T = clockGeometry(CLOCK_DEFAULTS).period;
    const samples = [T / 4, T / 2, T, 5 * T, 20 * T];
    for (const t of samples) {
      const k = clockKinematics(withParams({ time: t }));
      // Tick count should be approximately floor(2·t/T + 0.5).
      const expected = Math.floor((2 * t) / T + 0.5);
      expect(k.escapement.ticksReleased).toBe(expected);
    }
  });

  it('escape wheel ω matches 4π/(N·T)', () => {
    const g = clockGeometry(CLOCK_DEFAULTS);
    const expected = (4 * Math.PI) / (CLOCK_DEFAULTS.teethCount * g.period);
    expect(g.escapeAngularVelocity).toBeCloseTo(expected, 10);
  });
});

describe('Clock — scene build', () => {
  it('produces dial + 3 hand modules + 3 revolute joints', () => {
    const build = buildClock(CLOCK_DEFAULTS);
    expect(build.dial.label).toBe('Dial');
    expect(build.hourHand.label).toBe('Hour hand');
    expect(build.minuteHand.label).toBe('Minute hand');
    expect(build.secondsHand.label).toBe('Seconds hand');
    expect(build.joints.length).toBe(3);
    expect(build.rootOp.children.length).toBe(4);
  });

  it('joint drives equal the negated displayed angle (clockwise sweep)', () => {
    const p = withParams({ time: 1234.5 });
    const build = buildClock(p);
    const k = clockKinematics(p);
    const drives = Object.fromEntries(
      build.joints.map((j) => [j.label, (j as { drive?: number }).drive]),
    );
    expect(drives['Hour hand revolute']).toBeCloseTo(-k.hourDisplay, 12);
    expect(drives['Minute hand revolute']).toBeCloseTo(-k.minuteDisplay, 12);
    expect(drives['Seconds hand revolute']).toBeCloseTo(-k.secondsDisplay, 12);
  });

  it('standalone geometry/kinematics match the scene build', () => {
    const p = withParams({ time: 900 });
    const build = buildClock(p);
    const g = clockGeometry(p);
    const k = clockKinematics(p);
    expect(build.geometry.secondsAngularVelocity).toBeCloseTo(
      g.secondsAngularVelocity,
      12,
    );
    expect(build.kinematics.hourDisplay).toBeCloseTo(k.hourDisplay, 12);
  });
});

describe('Clock — non-real-time trains', () => {
  it('fast clock: escapeToSeconds = 1 ⇒ seconds hand rev every 30 s (2× faster)', () => {
    const p = withParams({ escapeToSecondsRatio: 1.0 });
    const g = clockGeometry(p);
    expect(g.secondsPerSecondsRev).toBeCloseTo(30, 3);
    expect(g.isRealTime).toBe(false);
    // Decoded "seconds" advance 2× faster: at t = 30 s the seconds hand has
    // completed one rev so the decoder reports ~0 s (mod 30).
    const k = clockKinematics({ ...p, time: 30 });
    expect(k.displayedSeconds).toBeCloseTo(0, 3);
  });

  it('slow minute hand: secondsToMinute = 1/30 ⇒ minute rev every 30 min', () => {
    const p = withParams({ secondsToMinuteRatio: 1 / 30 });
    const g = clockGeometry(p);
    expect(g.secondsPerMinuteRev).toBeCloseTo(1800, 1);
  });
});
