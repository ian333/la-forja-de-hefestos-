/**
 * Tests del v2 FINAL (BOM real AG): boost DCM con pérdidas RL (IRF640N+shunt+
 * bobina+MUR1560), interleaved anti-jalón, presa (Cbus), VÁLVULA (choke 50µH +
 * banda de histéresis 40-60A) y el ciclo de gota contra el MURO DE HOLM.
 * Números de referencia: scripts/v2-sim-final.py (calculado a mano 2026-06-09).
 */
import { describe, it, expect } from 'vitest';
import {
  BV2_DEFAULTS, bv2Reset, bv2Step,
  ipk, ipkReal, ronOf, d2, iPhaseAt, iInputAt, inputRipplePct,
  iinAvgPhase, ioutAvgPhase, lossesPhase, sourceStress,
  airTurns, coilEnergy, melts, rMaxMelt, faultDiDt,
  P_LOSS, E_MELT, I_FET_MAX,
  type BV2Params,
} from '../boostV2';

const P = BV2_DEFAULTS;

describe('boost DCM — ideal vs REAL (rampa RL con pérdidas)', () => {
  it('ipk ideal = Vin·D/(L·fsw) = 13.2A a D=0.55', () => {
    expect(ipk(P)).toBeCloseTo(13.2, 1);
  });

  it('R del camino de carga = Rds+Rsh+Rcoil ≈ 0.286Ω', () => {
    expect(ronOf(P)).toBeCloseTo(0.286, 2);
  });

  it('ipk REAL ≈ 12.2A — la resistencia recorta el ideal', () => {
    const r = ipkReal(P);
    expect(r).toBeLessThan(ipk(P));
    expect(r).toBeGreaterThan(11.8);
    expect(r).toBeLessThan(12.6);
  });

  it('DCM válido: D + D2 < 1 a 120V', () => {
    expect(P.duty + d2(P, 120, P.duty, P.Vf)).toBeLessThan(1);
  });

  it('3 fases entregan ~270-285W y caben en la fuente (Iin<14.6A)', () => {
    const Pout = 3 * 120 * ioutAvgPhase(P, 120);
    const Iin = 3 * iinAvgPhase(P, 120);
    expect(Pout).toBeGreaterThan(255);
    expect(Pout).toBeLessThan(300);
    expect(Iin).toBeLessThan(P.Iinmax);
  });

  it('eficiencia del boost ~91% (pérdidas FET+shunt+bobina+diodo)', () => {
    const Pout = 3 * 120 * ioutAvgPhase(P, 120);
    const lo = lossesPhase(P, 120);
    const eta = Pout / (Pout + 3 * (lo.fet + lo.sh + lo.coil + lo.diode));
    expect(eta).toBeGreaterThan(0.86);
    expect(eta).toBeLessThan(0.95);
    expect(lo.fet).toBeGreaterThan(lo.sh);     // Rds 0.15 > Rsh 0.10
  });
});

describe('forma de onda + interleaved (el fix del jalón)', () => {
  it('una fase: 0 → ipkReal en phi=D → 0 (DCM)', () => {
    expect(iPhaseAt(0, P, 120, 0)).toBeCloseTo(0, 6);
    expect(iPhaseAt(P.duty, P, 120, 0)).toBeCloseTo(ipkReal(P), 2);
    expect(iPhaseAt(0.95, P, 120, 0)).toBeCloseTo(0, 6);
  });

  it('rizo(3 fases) ≪ rizo(1 fase)', () => {
    const r1 = inputRipplePct({ ...P, nph: 1 }, 120);
    const r3 = inputRipplePct({ ...P, nph: 3 }, 120);
    expect(r1).toBeGreaterThan(150);
    expect(r3).toBeLessThan(r1 * 0.5);
  });

  it('el jalón: 1 fase estresa MÁS la fuente que 3 (es el rizo, no la potencia)', () => {
    expect(sourceStress({ ...P, nph: 1 }, 120, 0.55))
      .toBeGreaterThan(sourceStress({ ...P, nph: 3 }, 120, 0.55));
  });
});

describe('EL MURO DE HOLM — la pregunta central', () => {
  it('a 120V el muro (15.6Ω) recibe ~923W = 27× el umbral de 34W', () => {
    const Pj = 120 * 120 / 15.6;
    expect(Pj).toBeGreaterThan(900);
    expect(Pj / P_LOSS).toBeGreaterThan(25);
    expect(melts(120, 15.6)).toBe(true);
  });

  it('a 120V funde hasta R=424Ω; a 51V (v1) solo hasta 76Ω', () => {
    expect(rMaxMelt(120)).toBeCloseTo(423.5, 0);
    expect(rMaxMelt(51)).toBeCloseTo(76.5, 0);
    expect(melts(120, 400)).toBe(true);   // contacto pésimo: aun así funde
    expect(melts(120, 500)).toBe(false);  // el nuevo límite
    expect(melts(51, 100)).toBe(false);   // por esto el v1 sufría
  });
});

describe('LA VÁLVULA — choke 50µH + banda de histéresis', () => {
  it('sin choke el corto mata al IRF640 antes de la 1ª lectura (2µs)', () => {
    const i_2us_sin = faultDiDt(120, 1.5e-6) * 2e-6;   // solo cableado
    const i_2us_con = faultDiDt(120, P.Lc) * 2e-6;
    expect(i_2us_sin).toBeGreaterThan(I_FET_MAX);       // 160A — muerto
    expect(i_2us_con).toBeLessThan(6);                  // 4.8A — controlable
  });

  it('la banda atrapa la corriente entre Ilo y Ihi (±overshoot de 1 sub-paso)', () => {
    let s = bv2Reset(P);
    s = { ...s, Vbus: 120, dphase: 'funde', Rj: 2.0, idisch: 30, qdOn: true };
    let mx = 0, mnAfterRise = Infinity, rose = false;
    for (let i = 0; i < 100; i++) {
      s = bv2Step(s, P, 50e-6);
      if (s.dphase === 'arco' || s.dphase === 'contacto') break;
      mx = Math.max(mx, s.idisch);
      if (s.idisch >= P.Ihi - 1) rose = true;
      if (rose) mnAfterRise = Math.min(mnAfterRise, s.idisch);
    }
    expect(rose).toBe(true);
    expect(mx).toBeLessThan(P.Ihi + 6);                 // overshoot ≤ di/dt·2µs
    expect(mx).toBeLessThan(I_FET_MAX);                 // nunca cerca del límite
    expect(mnAfterRise).toBeGreaterThan(P.Ilo - 6);
  });
});

describe('ciclo de gota completo (presa + válvula + junta)', () => {
  it('el bus sube hacia Vtarget y el lazo lo sostiene', () => {
    let s = bv2Reset(P);
    const p: BV2Params = { ...P, discharge: false };
    for (let i = 0; i < 30000; i++) s = bv2Step(s, p, 10e-6);   // 0.3s
    expect(s.Vbus).toBeGreaterThan(0.9 * P.Vtarget);
    expect(s.Vbus).toBeLessThanOrEqual(P.Vtarget + 2);
  });

  it('deposita gotas: contacto→funde→pincha→arco→repite', () => {
    let s = bv2Reset(P);
    const seen = new Set<string>();
    for (let i = 0; i < 50000; i++) { s = bv2Step(s, P, 10e-6); seen.add(s.dphase); }  // 0.5s
    expect(s.drops).toBeGreaterThan(0);
    expect(seen.has('contacto')).toBe(true);
    expect(seen.has('funde')).toBe(true);
    expect(seen.has('pincha')).toBe(true);
    expect(seen.has('arco')).toBe(true);
    expect(s.Vbus).toBeGreaterThan(90);                 // la presa aguanta TIESA
  });

  it('con el muro intacto (R=500Ω > 424) NO funde — Edrop no acumula', () => {
    let s = bv2Reset({ ...P, Rholm: 500 });
    const p: BV2Params = { ...P, Rholm: 500 };
    for (let i = 0; i < 30000; i++) s = bv2Step(s, p, 10e-6);   // 0.3s
    expect(s.drops).toBe(0);
    expect(s.dphase).toBe('contacto');
  });

  it('trace: un push de idisch por sub-paso de 2µs', () => {
    let s = bv2Reset(P);
    const tr: number[] = [];
    s = bv2Step(s, P, 20e-6, tr);
    expect(tr.length).toBe(10);
  });
});

describe('bobina de aire (las 4 son tuyas)', () => {
  it('10µH ⇒ ~21 vueltas ideales (receta real Wheeler: 25)', () => {
    expect(airTurns(10e-6)).toBeGreaterThan(18);
    expect(airTurns(10e-6)).toBeLessThan(24);
  });
  it('50µH (choke) ⇒ ~47 ideales (receta real: 2 capas ≈ 48-50)', () => {
    expect(airTurns(50e-6)).toBeGreaterThan(44);
    expect(airTurns(50e-6)).toBeLessThan(51);
  });
  it('energía: la presa (½CV²=47J) es ~66,000 cucharadas de bobina (0.7mJ)', () => {
    const presa = 0.5 * P.Cbus * 120 * 120;
    const cuchara = coilEnergy([ipkReal(P)], P.L);
    expect(presa).toBeGreaterThan(45);
    expect(presa / cuchara).toBeGreaterThan(50000);
  });
});
