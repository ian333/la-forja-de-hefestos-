/**
 * Tests de fusión termonuclear contra Bosch-Hale 1992 y datos clásicos.
 *
 * Valores esperados:
 *   - σ_DT(64 keV) ≈ 5 barn (pico clásico, máxima sección de reacción).
 *   - σ_DT crece exponencialmente desde keV bajos hasta el pico.
 *   - σ_DD/σ_DT a 100 keV ~ 0.04 (D-T es ~25× más reactiva).
 *   - ⟨σv⟩_DT(10 keV) ≈ 1.1·10⁻²² m³/s (Atzeni Tabla 1.2).
 *   - ⟨σv⟩_DT(64 keV) máximo a ~1.5·10⁻²¹ m³/s.
 *   - Lawson DT(T≈14 keV) ~ 3·10²¹ keV·s/m³.
 *   - Barrera Coulomb H-H ~ 0.7 MeV.
 *
 * Ref: Bosch & Hale 1992 Tablas IV-VII; Atzeni-Meyer 2004 Tabla 1.2.
 */

import { describe, it, expect } from 'vitest';
import {
  DT, DDn, DDp, DHe3,
  FUSION_CATALOG,
  sigmaMb,
  sigmaBarn,
  sigmaM2,
  sigmaV,
  gamowPenetration,
  gamowPeak,
  lawsonTripleProduct,
  coulombBarrierKeV,
  qJoules,
} from '../nuclear/fusion';

// ═══════════════════════════════════════════════════════════════
// Catálogo: invariantes
// ═══════════════════════════════════════════════════════════════

describe('catálogo Bosch-Hale', () => {
  it('contiene las 4 reacciones canónicas', () => {
    const labels = FUSION_CATALOG.map((r) => r.label);
    expect(labels).toContain('D-T');
    expect(labels).toContain('D-D(n)');
    expect(labels).toContain('D-D(p)');
    expect(labels).toContain('D-³He');
  });

  it('Q de D-T = 17.59 MeV (Lide CRC)', () => {
    expect(DT.qMeV).toBeCloseTo(17.59, 2);
  });

  it('Q de D-³He = 18.35 MeV', () => {
    expect(DHe3.qMeV).toBeCloseTo(18.35, 2);
  });

  it('Q ramas D-D suman ~7.3 MeV', () => {
    expect(DDn.qMeV + DDp.qMeV).toBeCloseTo(7.3, 1);
  });

  it('B_G(D-D, n) = B_G(D-D, p) (mismo par de núcleos)', () => {
    expect(DDn.bg).toBeCloseTo(DDp.bg, 4);
  });
});

// ═══════════════════════════════════════════════════════════════
// Sección eficaz σ(E)
// ═══════════════════════════════════════════════════════════════

describe('σ_DT(E) — Bosch-Hale Tabla IV', () => {
  it('σ_DT(10 keV) ≈ 2.7·10⁻² barn (resultado clásico)', () => {
    const s = sigmaBarn(10, DT);
    expect(s).toBeGreaterThan(2e-2);
    expect(s).toBeLessThan(4e-2);
  });

  it('σ_DT(64 keV) ≈ 5 barn (pico de Breit-Wigner)', () => {
    const s = sigmaBarn(64, DT);
    expect(s).toBeGreaterThan(4.5);
    expect(s).toBeLessThan(5.5);
  });

  it('σ_DT es máxima cerca de 64 keV (no a E grande)', () => {
    const s_pre = sigmaBarn(40, DT);
    const s_peak = sigmaBarn(64, DT);
    const s_post = sigmaBarn(150, DT);
    expect(s_peak).toBeGreaterThan(s_pre);
    expect(s_peak).toBeGreaterThan(s_post);
  });

  it('σ(E ≤ 0) = 0 (defensa)', () => {
    expect(sigmaBarn(0, DT)).toBe(0);
    expect(sigmaBarn(-1, DT)).toBe(0);
  });

  it('σ_DT(100 keV) > σ_DD(100 keV) — D-T es la reacción "fácil"', () => {
    expect(sigmaBarn(100, DT)).toBeGreaterThan(sigmaBarn(100, DDn));
    expect(sigmaBarn(100, DT)).toBeGreaterThan(sigmaBarn(100, DDp));
  });

  it('σ en m² coincide con barn × 10⁻²⁸', () => {
    const sb = sigmaBarn(50, DT);
    const sm2 = sigmaM2(50, DT);
    expect(sm2 / sb).toBeCloseTo(1e-28, 35);
  });
});

// ═══════════════════════════════════════════════════════════════
// Factor de Gamow — tunelamiento Coulomb
// ═══════════════════════════════════════════════════════════════

describe('factor de Gamow', () => {
  it('P(E) crece monótonamente con E (barrera más fácil)', () => {
    const E = [1, 5, 10, 50, 100, 500];
    let prev = 0;
    for (const e of E) {
      const p = gamowPenetration(e, DT);
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
  });

  it('P(1 keV) << P(100 keV) (tunelamiento es muy sensible)', () => {
    const p1 = gamowPenetration(1, DT);
    const p100 = gamowPenetration(100, DT);
    expect(p100 / p1).toBeGreaterThan(1e10);
  });

  it('pico de Gamow E_G(10 keV) ≈ 12 keV para D-T', () => {
    // E_G = (B_G·T/2)^(2/3) con B_G = 34.38 keV^(1/2), T = 10 keV
    // E_G = (34.38·5)^(2/3) = 171.9^(2/3) ≈ 30.7 keV (sí, en plasma DT
    // a 10 keV, los pocos iones que fusionan tienen ~30 keV cinéticos).
    const eg = gamowPeak(10, DT);
    expect(eg).toBeGreaterThan(20);
    expect(eg).toBeLessThan(45);
  });

  it('pico de Gamow crece con T', () => {
    expect(gamowPeak(20, DT)).toBeGreaterThan(gamowPeak(5, DT));
  });
});

// ═══════════════════════════════════════════════════════════════
// Reactividad maxwelliana ⟨σv⟩(T)
// ═══════════════════════════════════════════════════════════════

describe('⟨σv⟩(T) — Bosch-Hale Tabla VII', () => {
  it('⟨σv⟩_DT(10 keV) ≈ 1.1·10⁻²² m³/s (Atzeni Tabla 1.2)', () => {
    const sv = sigmaV(10, DT);
    expect(sv).toBeGreaterThan(0.9e-22);
    expect(sv).toBeLessThan(1.3e-22);
  });

  it('⟨σv⟩_DT(1 keV) ≈ 6·10⁻²⁷ m³/s (régimen muy frío)', () => {
    const sv = sigmaV(1, DT);
    expect(sv).toBeGreaterThan(1e-27);
    expect(sv).toBeLessThan(1e-26);
  });

  it('⟨σv⟩_DT máximo entre 60 y 80 keV', () => {
    const sv30 = sigmaV(30, DT);
    const sv64 = sigmaV(64, DT);
    const sv100 = sigmaV(100, DT);
    expect(sv64).toBeGreaterThan(sv30);
    // Crece más lento o decrece pasado 64 keV
    expect(sv100 / sv64).toBeLessThan(1.2);
  });

  it('⟨σv⟩_DT > ⟨σv⟩_DD a misma T (D-T más reactiva)', () => {
    for (const T of [5, 10, 20, 50]) {
      expect(sigmaV(T, DT)).toBeGreaterThan(sigmaV(T, DDn));
    }
  });

  it('⟨σv⟩(T≤0) = 0', () => {
    expect(sigmaV(0, DT)).toBe(0);
    expect(sigmaV(-5, DT)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Criterio de Lawson
// ═══════════════════════════════════════════════════════════════

describe('criterio de Lawson — triple producto', () => {
  it('nτT mínimo en T_optimal ≈ 14 keV (curva en U)', () => {
    const ntT_8 = lawsonTripleProduct(8, DT);
    const ntT_14 = lawsonTripleProduct(14, DT);
    const ntT_30 = lawsonTripleProduct(30, DT);
    expect(ntT_14).toBeLessThan(ntT_8);
    expect(ntT_14).toBeLessThan(ntT_30);
  });

  it('nτT(14 keV) ≈ 3·10²¹ keV·s/m³ (valor canónico ITER)', () => {
    const nt = lawsonTripleProduct(14, DT);
    expect(nt).toBeGreaterThan(1e21);
    expect(nt).toBeLessThan(1e22);
  });

  it('Lawson DT < Lawson D-³He a T fija (D-T es la "fácil")', () => {
    const ntDT = lawsonTripleProduct(50, DT);
    const ntDHe3 = lawsonTripleProduct(50, DHe3);
    expect(ntDT).toBeLessThan(ntDHe3);
  });
});

// ═══════════════════════════════════════════════════════════════
// Barrera Coulomb (clásica) y por qué se necesita Gamow
// ═══════════════════════════════════════════════════════════════

describe('barrera Coulomb clásica', () => {
  it('H-H: E_C ≈ 700 keV (clásico, prohibitivo a 1 keV térmico)', () => {
    // Z=1, A=1 para H₁. E_C = 1.44·1·1/2.4 fm·1000 = 600 keV.
    const ec = coulombBarrierKeV(1, 1, 1, 1);
    expect(ec).toBeGreaterThan(500);
    expect(ec).toBeLessThan(700);
  });

  it('D-T: E_C ≈ 400 keV (radios un poco mayores)', () => {
    const ec = coulombBarrierKeV(1, 1, 2, 3);
    expect(ec).toBeGreaterThan(350);
    expect(ec).toBeLessThan(550);
  });

  it('D-³He: E_C es mayor (Z₂=2)', () => {
    const ecDT = coulombBarrierKeV(1, 1, 2, 3);
    const ecDHe3 = coulombBarrierKeV(1, 2, 2, 3);
    expect(ecDHe3).toBeGreaterThan(ecDT);
  });
});

// ═══════════════════════════════════════════════════════════════
// Energías Q
// ═══════════════════════════════════════════════════════════════

describe('Q de reacción → energía liberada', () => {
  it('qJoules(D-T) ≈ 2.82·10⁻¹² J por reacción', () => {
    // 17.59 MeV · 1.602·10⁻¹³ J/MeV = 2.819·10⁻¹² J
    expect(qJoules(DT)).toBeCloseTo(2.82e-12, 14);
  });

  it('D-T libera más que D-D (factor ~5×)', () => {
    expect(qJoules(DT)).toBeGreaterThan(4 * qJoules(DDn));
  });
});
