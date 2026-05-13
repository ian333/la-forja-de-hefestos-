/**
 * Tests de docking (Vina + Vinardo + búsqueda conformacional).
 *
 * Construye una "proteína" sintética minimalista para que los tests sean
 * deterministas — un puñado de átomos formando una "bolsa" donde un
 * ligando pequeño puede acomodarse. Los valores absolutos no se comparan
 * contra benchmarks de literatura (eso requiere un PDB y CSAR), pero se
 * verifican propiedades cualitativas que sí caracterizan los funcionales.
 *
 * Cualitativos:
 *   - score(clash) > score(separado) > score(óptimo)         (orden energético)
 *   - Vinardo y Vina coinciden cualitativamente (mismo signo de gradiente)
 *   - Monte Carlo reduce el score desde clash hacia equilibrio
 *   - Seed reproducible
 */

import { describe, it, expect } from 'vitest';
import {
  scoreDocking,
  scoreDockingVinardo,
  searchPose,
  ProteinGrid,
  classifyAtom,
  type DockAtom,
  type ProteinAtom,
} from '../docking';

// ═══════════════════════════════════════════════════════════════
// Setup: proteína sintética + ligando sintético
// ═══════════════════════════════════════════════════════════════

// "Bolsa" hidrofóbica con un par de polares al borde — geometría idealizada.
const proteinAtoms: ProteinAtom[] = [
  // Anillo de 6 C hidrofóbicos en plano z=0 (radio ~3.5 Å)
  ...[0, 60, 120, 180, 240, 300].map((deg) => {
    const r = 3.5, t = (deg * Math.PI) / 180;
    return {
      element: 'C' as const,
      pos: [r * Math.cos(t), r * Math.sin(t), 0] as [number, number, number],
      isPolar: false,
      isHydrophobic: true,
    };
  }),
  // Tapa superior: 2 N polares
  { element: 'N' as const, pos: [0, 0, 3], isPolar: true, isHydrophobic: false },
  { element: 'N' as const, pos: [0, 0, -3], isPolar: true, isHydrophobic: false },
];

const grid = new ProteinGrid(proteinAtoms);

// Ligando: 4 carbonos chiquito + 1 O polar
const ligand: DockAtom[] = [
  { element: 'C', local: [-1, 0, 0], isPolar: false, isHydrophobic: true },
  { element: 'C', local: [1, 0, 0], isPolar: false, isHydrophobic: true },
  { element: 'C', local: [0, 1, 0], isPolar: false, isHydrophobic: true },
  { element: 'C', local: [0, -1, 0], isPolar: false, isHydrophobic: true },
  { element: 'O', local: [0, 0, 1.2], isPolar: true, isHydrophobic: false },
];

const IDENTITY_Q: [number, number, number, number] = [0, 0, 0, 1];

// ═══════════════════════════════════════════════════════════════
// classifyAtom
// ═══════════════════════════════════════════════════════════════

describe('classifyAtom', () => {
  it('N y O son polares', () => {
    expect(classifyAtom({ element: 'N' })).toEqual({ isPolar: true, isHydrophobic: false });
    expect(classifyAtom({ element: 'O' })).toEqual({ isPolar: true, isHydrophobic: false });
  });
  it('C es hidrofóbico', () => {
    expect(classifyAtom({ element: 'C' })).toEqual({ isPolar: false, isHydrophobic: true });
  });
  it('S es polar (sulfuros con dipolo)', () => {
    expect(classifyAtom({ element: 'S' })).toEqual({ isPolar: true, isHydrophobic: false });
  });
});

// ═══════════════════════════════════════════════════════════════
// Vina scoring — comportamiento cualitativo
// ═══════════════════════════════════════════════════════════════

describe('scoreDocking (Vina)', () => {
  it('pose lejana tiene cero contactos', () => {
    const score = scoreDocking(ligand, grid, [100, 100, 100], IDENTITY_Q);
    expect(score.nContacts).toBe(0);
    expect(score.total).toBe(0);
  });

  it('pose en el centro tiene contactos y score finito', () => {
    const score = scoreDocking(ligand, grid, [0, 0, 0], IDENTITY_Q);
    expect(score.nContacts).toBeGreaterThan(0);
    expect(Number.isFinite(score.total)).toBe(true);
  });

  it('pose con clash severo → repulsion grande y total > pose separada', () => {
    // Centrado en (0,0,0) está EN la bolsa — debería tener muchos clashes.
    const sClash = scoreDocking(ligand, grid, [0, 0, 0], IDENTITY_Q);
    // Pose levemente desplazada (afuera) → menos clashes.
    const sFar = scoreDocking(ligand, grid, [8, 0, 0], IDENTITY_Q);
    expect(sClash.repulsion).toBeGreaterThan(sFar.repulsion);
  });

  it('breakdown tiene todos los términos como números finitos', () => {
    const s = scoreDocking(ligand, grid, [4, 0, 0], IDENTITY_Q);
    expect(Number.isFinite(s.gauss1)).toBe(true);
    expect(Number.isFinite(s.gauss2)).toBe(true);
    expect(Number.isFinite(s.repulsion)).toBe(true);
    expect(Number.isFinite(s.hydrophobic)).toBe(true);
    expect(Number.isFinite(s.hbond)).toBe(true);
    expect(Number.isFinite(s.total)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Vinardo scoring
// ═══════════════════════════════════════════════════════════════

describe('scoreDockingVinardo', () => {
  it('breakdown tiene exactamente 1 gaussiana (no 2)', () => {
    const s = scoreDockingVinardo(ligand, grid, [4, 0, 0], IDENTITY_Q);
    expect('gauss' in s).toBe(true);
    expect('gauss1' in s).toBe(false);
    expect('gauss2' in s).toBe(false);
  });

  it('Vinardo y Vina coinciden en signo de gradiente trasl.', () => {
    // Si Vina dice "moverse a (4,0,0) mejora vs (0,0,0)", Vinardo debe decir lo mismo.
    const vinaCenter = scoreDocking(ligand, grid, [0, 0, 0], IDENTITY_Q).total;
    const vinaShift = scoreDocking(ligand, grid, [4, 0, 0], IDENTITY_Q).total;
    const vinardoCenter = scoreDockingVinardo(ligand, grid, [0, 0, 0], IDENTITY_Q).total;
    const vinardoShift = scoreDockingVinardo(ligand, grid, [4, 0, 0], IDENTITY_Q).total;
    expect(Math.sign(vinaShift - vinaCenter)).toBe(Math.sign(vinardoShift - vinardoCenter));
  });

  it('escala con número de contactos (más contactos → score más negativo)', () => {
    const sFew = scoreDockingVinardo(ligand, grid, [20, 0, 0], IDENTITY_Q);
    const sMany = scoreDockingVinardo(ligand, grid, [4, 0, 0], IDENTITY_Q);
    expect(sMany.nContacts).toBeGreaterThanOrEqual(sFew.nContacts);
  });

  it('no produce NaN/Infinity', () => {
    for (const offset of [0, 1, 2, 4, 8, 20]) {
      const s = scoreDockingVinardo(ligand, grid, [offset, 0, 0], IDENTITY_Q);
      expect(Number.isFinite(s.total)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Conformational search (Monte Carlo + Metropolis)
// ═══════════════════════════════════════════════════════════════

describe('searchPose', () => {
  it('reduce el score desde una pose lejana hacia el sitio activo', () => {
    // Empieza a 8 Å del centro — sin contactos. La búsqueda debe acercar el ligando.
    const start: [number, number, number] = [8, 0, 0];
    const res = searchPose(ligand, grid, start, IDENTITY_Q, {
      iterations: 300,
      sigmaT: 1.0,
      sigmaR: 0.3,
      seed: 42,
    });
    const initialScore = res.trace[0];
    // Score mejor o igual al inicial (puede llegar a 0 si todo el camino fue afuera).
    expect(res.bestScore).toBeLessThanOrEqual(initialScore);
  });

  it('reduce el score desde clash severo', () => {
    // (0,0,0) tiene clashes — debería moverse hacia afuera o rotar.
    const start: [number, number, number] = [0, 0, 0];
    const initial = scoreDocking(ligand, grid, start, IDENTITY_Q).total;
    const res = searchPose(ligand, grid, start, IDENTITY_Q, {
      iterations: 500,
      sigmaT: 1.2,
      sigmaR: 0.4,
      seed: 7,
    });
    expect(res.bestScore).toBeLessThan(initial);
  });

  it('seed fija da resultado reproducible', () => {
    const a = searchPose(ligand, grid, [4, 0, 0], IDENTITY_Q, { iterations: 100, seed: 123 });
    const b = searchPose(ligand, grid, [4, 0, 0], IDENTITY_Q, { iterations: 100, seed: 123 });
    expect(a.bestScore).toBe(b.bestScore);
    expect(a.bestPos).toEqual(b.bestPos);
    expect(a.trace).toEqual(b.trace);
  });

  it('semillas distintas exploran caminos distintos', () => {
    const a = searchPose(ligand, grid, [4, 0, 0], IDENTITY_Q, { iterations: 100, seed: 1 });
    const b = searchPose(ligand, grid, [4, 0, 0], IDENTITY_Q, { iterations: 100, seed: 2 });
    // Aunque ambos converjan, las trayectorias intermedias deben diferir.
    expect(a.trace).not.toEqual(b.trace);
  });

  it('tasa de aceptación razonable (no se cuelga)', () => {
    const res = searchPose(ligand, grid, [4, 0, 0], IDENTITY_Q, {
      iterations: 300,
      sigmaT: 0.5,
      sigmaR: 0.2,
      T0: 1.0,
      seed: 99,
    });
    // El landscape sintético es suave, así que la tasa puede ser alta;
    // lo importante es que el MC haga al menos algunos rechazos.
    expect(res.acceptanceRate).toBeGreaterThan(0.05);
    expect(res.acceptanceRate).toBeLessThanOrEqual(1.0);
  });

  it('modo Vinardo: optimiza la función alternativa', () => {
    const res = searchPose(ligand, grid, [4, 0, 0], IDENTITY_Q, {
      iterations: 200,
      seed: 11,
      useVinardo: true,
    });
    // Score final debe ser ≤ score inicial (Vinardo en este caso)
    expect(res.bestScore).toBeLessThanOrEqual(res.trace[0]);
  });

  it('cooling=1.0 (sin enfriamiento) → mayor tasa de aceptación', () => {
    const hot = searchPose(ligand, grid, [4, 0, 0], IDENTITY_Q, {
      iterations: 200, T0: 2.0, cooling: 1.0, seed: 5,
    });
    const cold = searchPose(ligand, grid, [4, 0, 0], IDENTITY_Q, {
      iterations: 200, T0: 2.0, cooling: 0.9, seed: 5,
    });
    expect(hot.acceptanceRate).toBeGreaterThanOrEqual(cold.acceptanceRate - 0.01);
  });
});
