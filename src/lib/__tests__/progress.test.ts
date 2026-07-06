/**
 * progress.test.ts — el motor de progreso (tu perfil es tu átomo).
 * Física del nivel: lecciones = electrones = Z (orden Madelung real).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PILLARS, TOTAL_LESSONS,
  loadProgress, completeLesson, addReport,
  lessonsDone, pillarDone, elementNow, elementNext, badges, demoProgress,
} from '../progress';

// localStorage en memoria (vitest node env no lo trae)
function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
  return store;
}

beforeEach(() => {
  installLocalStorage();
});

describe('catálogo', () => {
  it('suma exactamente 102 lecciones → Nobelio (la universidad de los Nobel)', () => {
    expect(TOTAL_LESSONS).toBe(102);
    expect(PILLARS).toHaveLength(5);
  });
});

describe('completeLesson', () => {
  it('agrega y persiste una lección', () => {
    completeLesson('physics', 'mech/double-pendulum');
    const p = loadProgress();
    expect(pillarDone(p, 'physics')).toBe(1);
    expect(lessonsDone(p)).toBe(1);
  });

  it('es idempotente (repetir la misma lección no infla)', () => {
    completeLesson('economia', 'econ-01-limones');
    completeLesson('economia', 'econ-01-limones');
    completeLesson('economia', 'econ-01-limones');
    expect(pillarDone(loadProgress(), 'economia')).toBe(1);
  });

  it('mantiene la racha en el mismo día', () => {
    completeLesson('math', 'calc/derivative-1d');
    completeLesson('math', 'calc/integral-riemann');
    expect(loadProgress().streak.days).toBe(1);
  });

  it('extiende la racha si la última actividad fue AYER', () => {
    completeLesson('math', 'a');
    const p = loadProgress();
    const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    p.streak = { days: 3, lastISO: ayer };
    localStorage.setItem('gaia_progress_v1', JSON.stringify(p));
    completeLesson('math', 'b');
    expect(loadProgress().streak.days).toBe(4);
  });

  it('reinicia la racha tras un hueco de 2+ días', () => {
    completeLesson('math', 'a');
    const p = loadProgress();
    const hace3 = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    p.streak = { days: 9, lastISO: hace3 };
    localStorage.setItem('gaia_progress_v1', JSON.stringify(p));
    completeLesson('math', 'b');
    expect(loadProgress().streak.days).toBe(1);
  });
});

describe('lecciones → elemento (Madelung)', () => {
  it('0 lecciones → naces Hidrógeno', () => {
    expect(elementNow(loadProgress()).symbol).toBe('H');
  });

  it('27 lecciones → eres Cobalto, y el siguiente es Níquel', () => {
    const p = demoProgress(27);
    expect(lessonsDone(p)).toBe(27);
    expect(elementNow(p).symbol).toBe('Co');
    expect(elementNext(p)?.symbol).toBe('Ni');
  });

  it('102 lecciones (universidad completa) → NOBELIO', () => {
    const p = demoProgress(TOTAL_LESSONS);
    expect(elementNow(p).Z).toBe(102);
    expect(elementNow(p).name.toLowerCase()).toContain('nobelio');
  });
});

describe('demoProgress', () => {
  it('reparte exactamente N, determinista, sin exceder ningún pilar', () => {
    for (const n of [0, 1, 27, 54, 102]) {
      const a = demoProgress(n), b = demoProgress(n);
      expect(lessonsDone(a)).toBe(Math.min(n, TOTAL_LESSONS));
      expect(JSON.stringify(a.lessons)).toBe(JSON.stringify(b.lessons));
      for (const pl of PILLARS) expect(pillarDone(a, pl.key)).toBeLessThanOrEqual(pl.total);
    }
  });
});

describe('insignias', () => {
  it('primer laboratorio se gana con 1 lección', () => {
    const before = badges(loadProgress()).find(b => b.id === 'first-lab')!;
    expect(before.unlocked).toBe(false);
    completeLesson('quimica', 'tab:atom');
    const after = badges(loadProgress()).find(b => b.id === 'first-lab')!;
    expect(after.unlocked).toBe(true);
  });

  it('primer reporte se gana con addReport()', () => {
    addReport();
    const p = loadProgress();
    expect(p.reports).toBe(1);
    expect(badges(p).find(b => b.id === 'first-report')!.unlocked).toBe(true);
  });

  it('gas noble cae exacto en Z ∈ {2,10,18,36,54,86}', () => {
    expect(badges(demoProgress(10)).find(b => b.id === 'noble')!.unlocked).toBe(true);
    expect(badges(demoProgress(11)).find(b => b.id === 'noble')!.unlocked).toBe(false);
  });

  it('Nobelio solo al terminar TODO', () => {
    expect(badges(demoProgress(101)).find(b => b.id === 'nobelio')!.unlocked).toBe(false);
    expect(badges(demoProgress(102)).find(b => b.id === 'nobelio')!.unlocked).toBe(true);
  });
});
