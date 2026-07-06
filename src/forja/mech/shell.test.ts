import { describe, it, expect } from 'vitest';
import {
  radiusAt, sampleRing, countLobes, reduction, discTurns,
  orbitClearance, gapRuleOk, shellGrid, Z_SPHERE, tireEnv,
  profileToRadial, pinEnvelope,
  type ShellSpec, type ZBump,
} from './shell';
import { cycloidalDisc, pinPositions } from './cycloidal';

describe('shell — el modelo de la cebolla', () => {
  it('modo 0 (sin lóbulos, sin panza) es un CÍRCULO: radio constante en θ', () => {
    const s: ShellSpec = { R: 20, H: 24 };
    const radii = sampleRing(s, 12, 360);
    const min = Math.min(...radii), max = Math.max(...radii);
    expect(max - min).toBeLessThan(1e-9);
    expect(countLobes(radii)).toBe(0); // un círculo no tiene máximos locales
  });

  it('modo N produce EXACTAMENTE N lóbulos (disco cicloidal)', () => {
    for (const N of [6, 8, 11, 14, 16]) {
      const s: ShellSpec = { R: 22, H: 24, modes: [{ m: N, amp: 3 }] };
      expect(countLobes(sampleRing(s, 12, 1440))).toBe(N);
    }
  });

  it('anillo = modo N+1: un lóbulo más que el disco', () => {
    const N = 11;
    const disco: ShellSpec = { R: 22, H: 24, modes: [{ m: N, amp: 3 }] };
    const anillo: ShellSpec = { R: 26, H: 24, modes: [{ m: N + 1, amp: 3 }] };
    expect(countLobes(sampleRing(disco, 12, 1440))).toBe(N);
    expect(countLobes(sampleRing(anillo, 12, 1440))).toBe(N + 1);
  });

  it('GAP CONSTANTE: dos paredes que comparten panza-z anidan con holgura uniforme', () => {
    // las dos suman LO MISMO (esfera) → el gap entre ellas no cambia en NINGÚN (θ,z)
    const wall = 4, gap = 1.0;
    const z: ZBump = { amp: 5, env: Z_SPHERE };
    const s1: ShellSpec = { R: 10, H: 24, zBumps: [z] };
    const s2: ShellSpec = { R: 10 + wall + gap, H: 24, zBumps: [z] };
    for (let j = 0; j <= 10; j++) {
      const zz = (24 * j) / 10;
      const outer1 = radiusAt(s1, 0.7, zz);            // pared exterior del tubo 1
      const inner2 = radiusAt(s2, 0.7, zz) - wall;     // pared interior del tubo 2
      expect(inner2 - outer1).toBeCloseTo(gap, 9);
    }
  });

  it('REDUCCIÓN emerge: modo N contra modo N+1 → razón N', () => {
    expect(reduction(11, 12)).toBe(11);
    expect(reduction(30, 31)).toBe(30);
    expect(reduction(8, 10)).toBe(4); // 2 lóbulos de diferencia → 8/2
  });

  it('cinemática retrógrada: N vueltas de entrada → −1 vuelta del disco', () => {
    const N = 11;
    expect(discTurns(N, 1)).toBeCloseTo(-1 / 11, 9);
    expect(discTurns(N, N)).toBeCloseTo(-1, 9); // una vuelta completa, al revés
  });

  it('R3 — la regla del gap: g ≥ E + g_weld o el disco se SUELDA', () => {
    expect(gapRuleOk(0.30, 1.5)).toBe(false);          // gap de balero con E grande → choca
    expect(orbitClearance(0.30, 1.5)).toBeLessThan(0); // holgura negativa = absurdo
    expect(gapRuleOk(1.8, 1.5)).toBe(true);            // gap crecido → libra
    expect(orbitClearance(1.8, 1.5)).toBeCloseTo(0.30, 9);
  });

  it('shellGrid: grosor de pared constante (imprimible) y malla cerrada', () => {
    const s: ShellSpec = { R: 22, H: 24, modes: [{ m: 11, amp: 3 }] };
    const g = shellGrid(s, 3.5, 60, 16);
    expect(g.outer.length).toBe(17);     // nz+1 anillos
    expect(g.outer[0].length).toBe(60);  // nTheta por anillo
    for (let j = 0; j <= 16; j++)
      for (let i = 0; i < 60; i++)
        expect(g.outer[j][i] - g.inner[j][i]).toBeCloseTo(3.5, 6); // grosor constante
  });

  it('llantas: 2 toroides → 2 panzas locales en z (eje fijo)', () => {
    const s: ShellSpec = { R: 12, H: 24, zBumps: [{ amp: 2.5, env: tireEnv([8, 16], 2.6) }] };
    // en z=8 y z=16 la panza es máxima; en z=12 (entre llantas) cae
    expect(radiusAt(s, 0, 8)).toBeGreaterThan(radiusAt(s, 0, 12));
    expect(radiusAt(s, 0, 16)).toBeGreaterThan(radiusAt(s, 0, 12));
  });

  it('profileToRadial: un círculo de radio 5 → r(θ)=5 en todo θ', () => {
    const pts = Array.from({ length: 200 }, (_, i) => {
      const t = (2 * Math.PI * i) / 200;
      return { x: 5 * Math.cos(t), y: 5 * Math.sin(t) };
    });
    const r = profileToRadial(pts);
    for (const th of [0, 0.7, 1.9, 3.0, -2.2, Math.PI]) expect(r(th)).toBeCloseTo(5, 4);
  });

  it('profileToRadial: el disco cicloidal tiene N lóbulos como pared de tubo', () => {
    const N = 11;
    const disc = cycloidalDisc({ lobes: N, R: 24, Rr: 3.4, E: 1.5 });
    const r = profileToRadial(disc.profile);
    const radii = Array.from({ length: 1440 }, (_, i) => r((2 * Math.PI * i) / 1440));
    expect(countLobes(radii)).toBe(N);
  });

  it('pinEnvelope: dip a R−Rr en el perno, abierto a baseR entre pernos', () => {
    const pins = pinPositions(40, 12);          // 12 pernos en círculo R=40
    const env = pinEnvelope(pins, 4, 46);
    expect(env(0)).toBeCloseTo(36, 5);          // perno 0 en θ=0 → cara interior R−Rr=36
    expect(env(Math.PI / 12)).toBeCloseTo(46, 5); // a mitad de camino: sin perno → baseR
  });

  it('E INVÁLIDA socava: E ≥ R/(2·pins) → el disco muerde los pernos', () => {
    const N = 11, R = 24, Rr = 3, E = 1.5;       // 1.5 > 24/24 = 1.0 → inválida
    const disc = cycloidalDisc({ lobes: N, R, Rr: Rr + 0.4, E });
    expect(disc.valid).toBe(false);              // el modelo lo SABE
    const pins = pinPositions(R, N + 1);
    let dmin = Infinity;
    for (const p of disc.profile) for (const c of pins) dmin = Math.min(dmin, Math.hypot(p.x - c.x, p.y - c.y));
    expect(dmin).toBeLessThan(Rr);               // muerde el perno (la causa del traslape que vi)
  });

  it('CONJUGADO con E válida: con el disco en su órbita (E,0) clarea cada perno = Rr+gap', () => {
    const N = 11, R = 40, Rr = 4, gap = 0.4, E = 1.0; // E < 40/24 = 1.667 → válida
    const disc = cycloidalDisc({ lobes: N, R, Rr: Rr + gap, E });
    expect(disc.valid).toBe(true);
    const pins = pinPositions(R, N + 1);
    // el perfil está en el marco del DISCO (centro desplazado E). Colocado en su
    // órbita (centro en (E,0)) la holgura mínima a los pernos = Rr+gap, EXACTO.
    let dmin = Infinity;
    for (const p of disc.profile) for (const c of pins) dmin = Math.min(dmin, Math.hypot(p.x + E - c.x, p.y - c.y));
    expect(dmin).toBeCloseTo(Rr + gap, 6);     // 4.4 mm clavado, jamás muerde el perno
  });
});
