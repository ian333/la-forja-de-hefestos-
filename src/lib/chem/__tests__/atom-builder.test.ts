import { describe, it, expect } from 'vitest';
import { elementByZ } from '../quantum/periodic-table';
import {
  populateAtom, sampleAtom, atomExtent, nucleusInfo,
  realOrbitalsOf, subshellLabel, subshellColor,
} from '../quantum/atom-builder';

describe('realOrbitalsOf', () => {
  it('1s → [1s]', () => {
    expect(realOrbitalsOf(1, 0)).toEqual(['1s']);
  });

  it('2p → [2px, 2py, 2pz] — tres orientaciones', () => {
    expect(realOrbitalsOf(2, 1)).toEqual(['2px', '2py', '2pz']);
  });

  it('3d → 4 orbitales específicos (no los 5 puros; aproximación visual)', () => {
    const d = realOrbitalsOf(3, 2);
    expect(d.length).toBeGreaterThanOrEqual(4);
  });
});

describe('populateAtom — regla de Hund', () => {
  it('H (Z=1): 1 electrón en 1s', () => {
    const pop = populateAtom(elementByZ(1)!);
    expect(pop).toHaveLength(1);
    expect(pop[0].orbitalKey).toBe('1s');
    expect(pop[0].electrons).toBe(1);
  });

  it('He (Z=2): 1s con 2 electrones', () => {
    const pop = populateAtom(elementByZ(2)!);
    expect(pop).toHaveLength(1);
    expect(pop[0].electrons).toBe(2);
  });

  it('N (Z=7): 1s² 2s² 2p³ — tres 2p con 1 e⁻ cada uno (Hund)', () => {
    const pop = populateAtom(elementByZ(7)!);
    const p_orbs = pop.filter((o) => o.n === 2 && o.l === 1);
    expect(p_orbs).toHaveLength(3);
    for (const o of p_orbs) {
      expect(o.electrons).toBe(1);  // cada uno con 1 e⁻ paralelo
    }
  });

  it('O (Z=8): 2p⁴ — dos p⁻s con 2 e⁻, uno con 2 e⁻ parejados y dos con 1', () => {
    const pop = populateAtom(elementByZ(8)!);
    const p_orbs = pop.filter((o) => o.n === 2 && o.l === 1);
    expect(p_orbs).toHaveLength(3);
    const pattern = p_orbs.map((o) => o.electrons).sort();
    expect(pattern).toEqual([1, 1, 2]);  // 4 electrones: un par + dos solteros
  });

  it('Ne (Z=10): todos los 2p llenos (2 e⁻ cada uno)', () => {
    const pop = populateAtom(elementByZ(10)!);
    const p_orbs = pop.filter((o) => o.n === 2 && o.l === 1);
    expect(p_orbs).toHaveLength(3);
    for (const o of p_orbs) expect(o.electrons).toBe(2);
  });

  it('la suma de electrones poblados es igual a Z', () => {
    for (const Z of [1, 2, 6, 10, 18, 26, 36, 54]) {
      const pop = populateAtom(elementByZ(Z)!);
      const total = pop.reduce((s, o) => s + o.electrons, 0);
      expect(total).toBe(Z);
    }
  });
});

describe('sampleAtom — muestreo por densidad electrónica', () => {
  it('H produce puntos cercanos al origen', () => {
    const samples = sampleAtom(elementByZ(1)!, 2000, 7);
    expect(samples.length).toBeGreaterThan(1000);
    const meanR = samples.reduce((s, p) => s + Math.hypot(p.x, p.y, p.z), 0) / samples.length;
    expect(meanR).toBeLessThan(3);
  });

  it('Ne con 10 e⁻ produce distribución con más contribución p (lóbulos)', () => {
    const samples = sampleAtom(elementByZ(10)!, 5000, 13);
    // En Ne los 2p tienen 6/10 = 60% de electrones, por lo que la mayoría de puntos serán l=1
    const pCount = samples.filter((p) => p.l === 1).length;
    const sCount = samples.filter((p) => p.l === 0).length;
    expect(pCount).toBeGreaterThan(sCount);
  });

  it('C produce puntos en 2p₂ electrones (Hund: dos orbitales con 1 e⁻ cada uno)', () => {
    const samples = sampleAtom(elementByZ(6)!, 3000, 1);
    const pOrbsUsed = new Set(
      samples.filter((p) => p.l === 1).map((p) => p.orbitalKey),
    );
    // C tiene 2 electrones en 2p → 2 orbitales p con 1 e⁻ cada uno
    expect(pOrbsUsed.size).toBeGreaterThanOrEqual(2);
  });

  it('más Z → nube más compacta para 1s (Z_eff alta)', () => {
    const h = sampleAtom(elementByZ(1)!, 1500, 11);
    const he = sampleAtom(elementByZ(2)!, 1500, 11);
    // El 1s de He tiene Z_eff ≈ 1.7 > 1 → más compacto
    const meanRh = h.reduce((s, p) => s + Math.hypot(p.x, p.y, p.z), 0) / h.length;
    const meanRhe = he.filter((p) => p.n === 1)
      .reduce((s, p, _, arr) => s + Math.hypot(p.x, p.y, p.z) / (arr.length || 1), 0);
    expect(meanRhe).toBeLessThan(meanRh);
  });
});

describe('atomExtent', () => {
  it('crece al subir de 1s a 2s (más lejos alcanza)', () => {
    expect(atomExtent(elementByZ(1)!)).toBeLessThan(atomExtent(elementByZ(3)!));
  });

  it('valor positivo siempre', () => {
    for (const Z of [1, 10, 30, 80]) {
      expect(atomExtent(elementByZ(Z)!)).toBeGreaterThan(0);
    }
  });
});

describe('nucleusInfo', () => {
  it('H: 1 protón, 0 neutrones (isótopo común)', () => {
    const n = nucleusInfo(elementByZ(1)!);
    expect(n.protons).toBe(1);
    expect(n.neutrons).toBe(0);
  });

  it('Fe-56: 26 protones, ~30 neutrones', () => {
    const n = nucleusInfo(elementByZ(26)!);
    expect(n.protons).toBe(26);
    expect(n.neutrons).toBeCloseTo(30, 0);
  });

  it('U-238: 92 protones, ~146 neutrones', () => {
    const n = nucleusInfo(elementByZ(92)!);
    expect(n.protons).toBe(92);
    expect(n.neutrons).toBeGreaterThan(140);
  });
});

describe('subshellLabel', () => {
  it('1s, 2p, 3d, 4f', () => {
    expect(subshellLabel(1, 0)).toBe('1s');
    expect(subshellLabel(2, 1)).toBe('2p');
    expect(subshellLabel(3, 2)).toBe('3d');
    expect(subshellLabel(4, 3)).toBe('4f');
  });
});

describe('subshellColor', () => {
  it('s y p tienen colores diferentes', () => {
    expect(subshellColor(1, 0)).not.toBe(subshellColor(2, 1));
  });

  it('d y f tienen colores distintos', () => {
    expect(subshellColor(3, 2)).not.toBe(subshellColor(4, 3));
  });

  it('todos los colores válidos hex', () => {
    for (const [n, l] of [[1, 0], [2, 1], [3, 2], [4, 3]]) {
      expect(subshellColor(n, l)).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
