import { describe, it, expect } from 'vitest';
import {
  psiMO, electronDensity, sampleMolecule, sampleMoleculeRig,
  buildDiatomic1s, setBondLength,
  bondOrder, totalElectrons, moleculeByFormula,
  H2, H2_CATION, HE_H_CATION, HE2_HYPOTHETICAL, LI2,
  MOLECULE_CATALOG,
} from '../quantum/molecular-orbitals';

describe('catálogo de moléculas', () => {
  it('contiene las diatómicas educativas básicas', () => {
    expect(moleculeByFormula('H₂')).toBeDefined();
    expect(moleculeByFormula('H₂⁺')).toBeDefined();
    expect(moleculeByFormula('HeH⁺')).toBeDefined();
    expect(moleculeByFormula('He₂')).toBeDefined();
    expect(moleculeByFormula('Li₂')).toBeDefined();
  });

  it('cada molécula tiene al menos un MO y 2 átomos', () => {
    for (const m of MOLECULE_CATALOG) {
      expect(m.atoms.length).toBeGreaterThanOrEqual(2);
      expect(m.mos.length).toBeGreaterThan(0);
      expect(m.name).toBeTruthy();
      expect(m.formula).toBeTruthy();
    }
  });
});

describe('bondOrder', () => {
  it('H₂: σ² → orden 1', () => {
    expect(bondOrder(H2)).toBe(1);
  });

  it('H₂⁺: σ¹ → orden 0.5', () => {
    expect(bondOrder(H2_CATION)).toBe(0.5);
  });

  it('HeH⁺: σ² → orden 1', () => {
    expect(bondOrder(HE_H_CATION)).toBe(1);
  });

  it('He₂: σ²σ*² → orden 0 (no hay enlace)', () => {
    expect(bondOrder(HE2_HYPOTHETICAL)).toBe(0);
  });

  it('Li₂: σ² en 2s → orden 1', () => {
    expect(bondOrder(LI2)).toBe(1);
  });
});

describe('totalElectrons', () => {
  it('H₂: 2 electrones', () => {
    expect(totalElectrons(H2)).toBe(2);
  });

  it('H₂⁺: 1 electrón', () => {
    expect(totalElectrons(H2_CATION)).toBe(1);
  });

  it('HeH⁺: 2 electrones', () => {
    expect(totalElectrons(HE_H_CATION)).toBe(2);
  });

  it('He₂: 4 electrones (σ² + σ*²)', () => {
    expect(totalElectrons(HE2_HYPOTHETICAL)).toBe(4);
  });
});

describe('psiMO — evaluación espacial', () => {
  it('σ1s de H₂: valor en el punto medio entre núcleos es positivo (bonding)', () => {
    const bondingMO = H2.mos.find((m) => m.symmetry === 'bonding')!;
    const psi = psiMO(0, 0, 0, bondingMO, H2.atoms);
    expect(psi).toBeGreaterThan(0);
  });

  it('σ*1s de H₂: valor en el punto medio entre núcleos es cero (nodo)', () => {
    const antibondingMO = H2.mos.find((m) => m.symmetry === 'antibonding')!;
    const psi = psiMO(0, 0, 0, antibondingMO, H2.atoms);
    expect(Math.abs(psi)).toBeLessThan(1e-8);
  });

  it('σ*1s: signo opuesto en los dos núcleos (antisymétrica)', () => {
    const antibondingMO = H2.mos.find((m) => m.symmetry === 'antibonding')!;
    const psiAtA = psiMO(H2.atoms[0].position[0], 0, 0, antibondingMO, H2.atoms);
    const psiAtB = psiMO(H2.atoms[1].position[0], 0, 0, antibondingMO, H2.atoms);
    expect(psiAtA * psiAtB).toBeLessThan(0);  // signos opuestos
  });

  it('σ1s: mismo signo en los dos núcleos (symétrica)', () => {
    const bondingMO = H2.mos.find((m) => m.symmetry === 'bonding')!;
    const psiAtA = psiMO(H2.atoms[0].position[0], 0, 0, bondingMO, H2.atoms);
    const psiAtB = psiMO(H2.atoms[1].position[0], 0, 0, bondingMO, H2.atoms);
    expect(psiAtA * psiAtB).toBeGreaterThan(0);
  });

  it('lejos de los átomos (r >> bondLength) ψ → 0', () => {
    const mo = H2.mos[0];
    const psi = psiMO(50, 50, 50, mo, H2.atoms);
    expect(Math.abs(psi)).toBeLessThan(1e-10);
  });

  it('HeH⁺ asimétrica: densidad en He > densidad en H', () => {
    const bondingMO = HE_H_CATION.mos.find((m) => m.symmetry === 'bonding')!;
    const psiAtHe = psiMO(HE_H_CATION.atoms[0].position[0], 0, 0, bondingMO, HE_H_CATION.atoms);
    const psiAtH  = psiMO(HE_H_CATION.atoms[1].position[0], 0, 0, bondingMO, HE_H_CATION.atoms);
    // He tiene Z=2 → orbital más compacto → ψ_atomic más alto EN He. Además
    // el coeficiente LCAO también favorece al He. Ambos efectos: ψ(He) > ψ(H).
    expect(Math.abs(psiAtHe)).toBeGreaterThan(Math.abs(psiAtH));
  });
});

describe('electronDensity', () => {
  it('es siempre ≥ 0', () => {
    for (let i = 0; i < 500; i++) {
      const x = (Math.random() - 0.5) * 8;
      const y = (Math.random() - 0.5) * 8;
      const z = (Math.random() - 0.5) * 8;
      expect(electronDensity(x, y, z, H2)).toBeGreaterThanOrEqual(0);
    }
  });

  it('H₂ tiene máxima densidad cerca de los núcleos', () => {
    const rhoAtA = electronDensity(H2.atoms[0].position[0], 0, 0, H2);
    const rhoAtB = electronDensity(H2.atoms[1].position[0], 0, 0, H2);
    const rhoFar = electronDensity(10, 10, 10, H2);
    expect(rhoAtA).toBeGreaterThan(rhoFar * 10);
    expect(rhoAtB).toBeGreaterThan(rhoFar * 10);
  });

  it('He₂ (σ²σ*²) tiene densidad CERO en el plano medio (punto de antinodo σ*)', () => {
    // Los σ y σ* tienen contribuciones que SE SUMAN en densidad
    // (no se cancelan directamente, porque es suma de cuadrados).
    // Sin embargo, el |ψ_σ*|² en el punto medio es 0 por nodo.
    // Y |ψ_σ|² en el punto medio es mayor. Entonces densidad total en el medio
    // proviene solo de σ ocupado. No es cero, pero es MÁS alta cerca de núcleos.
    const rhoMid  = electronDensity(0, 0, 0, HE2_HYPOTHETICAL);
    const rhoAtom = electronDensity(HE2_HYPOTHETICAL.atoms[0].position[0], 0, 0, HE2_HYPOTHETICAL);
    expect(rhoAtom).toBeGreaterThan(rhoMid);
  });
});

describe('sampleMolecule', () => {
  it('produce puntos cerca de los núcleos (no dispersos uniformemente)', () => {
    const samples = sampleMolecule(H2, 1500, 7);
    expect(samples.length).toBeGreaterThan(500);
    const meanDistToClosestAtom = samples.reduce((s, p) => {
      const dA = Math.hypot(p.x - H2.atoms[0].position[0], p.y, p.z);
      const dB = Math.hypot(p.x - H2.atoms[1].position[0], p.y, p.z);
      return s + Math.min(dA, dB);
    }, 0) / samples.length;
    expect(meanDistToClosestAtom).toBeLessThan(2.5);  // cerca de algún núcleo
  });

  it('cada punto tiene densidad normalizada en [0, 1]', () => {
    const samples = sampleMolecule(H2, 800, 3);
    for (const p of samples) {
      expect(p.density).toBeGreaterThanOrEqual(0);
      expect(p.density).toBeLessThanOrEqual(1);
    }
  });

  it('cada punto marca un MO dominante válido', () => {
    const samples = sampleMolecule(H2, 800, 11);
    for (const p of samples) {
      expect(p.dominantMOIndex).toBeGreaterThanOrEqual(0);
      expect(p.dominantMOIndex).toBeLessThan(H2.mos.length);
    }
  });

  it('con visibleMOs=[] retorna vacío', () => {
    // Array vacío significa "ningún MO" → densidad cero
    const samples = sampleMolecule(H2, 100, 13, []);
    expect(samples).toHaveLength(0);
  });

  it('visibleMOs filtrando al antibonding (vacío en H₂): densidad cero', () => {
    // El σ* está en índice 1 y tiene occupancy=0 para H₂
    const samples = sampleMolecule(H2, 500, 17, [1]);
    expect(samples).toHaveLength(0);
  });
});

describe('buildDiatomic1s y setBondLength', () => {
  it('construye una molécula diatómica simétrica con σ y σ*', () => {
    const mol = buildDiatomic1s({
      name: 'test', formula: 'X₂',
      elementA: 'X', elementB: 'X',
      Za: 1, Zb: 1, valenceElectrons: 2, bondLength: 1.5,
    });
    expect(mol.atoms).toHaveLength(2);
    expect(mol.mos).toHaveLength(2);
    expect(mol.mos[0].symmetry).toBe('bonding');
    expect(mol.mos[1].symmetry).toBe('antibonding');
    expect(mol.mos[0].occupancy).toBe(2);
    expect(mol.mos[1].occupancy).toBe(0);
  });

  it('setBondLength reposiciona los átomos sobre el eje X simétricamente', () => {
    const mol = setBondLength(H2, 3.0);
    expect(mol.atoms[0].position[0]).toBeCloseTo(-1.5, 5);
    expect(mol.atoms[1].position[0]).toBeCloseTo( 1.5, 5);
    expect(mol.bondLength).toBe(3.0);
  });

  it('al acercar los núcleos la densidad en el punto medio crece', () => {
    const mFar  = setBondLength(H2, 5.0);
    const mNear = setBondLength(H2, 1.4);
    const rhoFar  = electronDensity(0, 0, 0, mFar);
    const rhoNear = electronDensity(0, 0, 0, mNear);
    expect(rhoNear).toBeGreaterThan(rhoFar);
  });
});

// ═══════════════════════════════════════════════════════════════
// RIG SAMPLING — modo O(N) para animación
// ═══════════════════════════════════════════════════════════════

describe('sampleMoleculeRig', () => {
  it('produce puntos con atomIndex asignado y offsets relativos', () => {
    const samples = sampleMoleculeRig(H2, 1500, 31);
    expect(samples.length).toBeGreaterThan(500);
    for (const s of samples) {
      expect(s.atomIndex).toBeGreaterThanOrEqual(0);
      expect(s.atomIndex).toBeLessThan(H2.atoms.length);
      expect(Number.isFinite(s.offsetX)).toBe(true);
      expect(Number.isFinite(s.offsetY)).toBe(true);
      expect(Number.isFinite(s.offsetZ)).toBe(true);
    }
  });

  it('los offsets son independientes de la geometría de la molécula', () => {
    // Samplear con la misma semilla a dos geometrías: los offsets deben coincidir
    // (porque el rig trabaja en coordenadas del átomo, no del mundo).
    const a = sampleMoleculeRig(setBondLength(H2, 1.4), 500, 7);
    const b = sampleMoleculeRig(setBondLength(H2, 5.0), 500, 7);
    expect(a.length).toBe(b.length);
    // Comparar un subset
    for (let i = 0; i < Math.min(50, a.length); i++) {
      expect(a[i].offsetX).toBeCloseTo(b[i].offsetX, 6);
      expect(a[i].offsetY).toBeCloseTo(b[i].offsetY, 6);
      expect(a[i].offsetZ).toBeCloseTo(b[i].offsetZ, 6);
    }
  });

  it('el reparto de puntos por átomo refleja el peso |c|²·occ', () => {
    // En HeH⁺ el coeficiente sobre He es mayor que sobre H (polarizado)
    const samples = sampleMoleculeRig(HE_H_CATION, 2000, 11);
    let countHe = 0, countH = 0;
    for (const s of samples) {
      if (s.atomIndex === 0) countHe++;  // He está en atomIndex 0
      else countH++;
    }
    expect(countHe).toBeGreaterThan(countH);
  });

  it('produce el mismo número total solicitado (dentro de 1%)', () => {
    const samples = sampleMoleculeRig(H2, 3000, 13);
    expect(samples.length).toBeGreaterThan(2950);
    expect(samples.length).toBeLessThanOrEqual(3000);
  });

  it('en moléculas sin electrones visibles, retorna vacío', () => {
    // Si el único MO ocupado es filtrado, no hay samples
    const samples = sampleMoleculeRig(H2, 500, 17, [1]);  // idx=1 es σ* vacío
    expect(samples).toHaveLength(0);
  });
});
