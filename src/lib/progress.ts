/**
 * progress.ts — el motor de progreso del alumno.
 *
 *   FILOSOFÍA: tu nivel ES la tabla periódica. Cada lección completada = un
 *   electrón colocado en el orden de llenado real (Madelung). 27 lecciones →
 *   eres Cobalto (Z=27, 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁷). Subir de nivel =
 *   transmutarte al siguiente elemento. Nada de "XP" inventado: física real.
 *
 *   El catálogo v1 suma 102 lecciones — terminar TODA la universidad te vuelve
 *   el elemento 102: NOBELIO. La universidad de los Nobel te gradúa Nobelio.
 *
 * Sin React: solo tipos + localStorage. El backend (university-api) podrá
 * sincronizar este mismo shape cuando el plan Estudiante guarde en la nube.
 */

import { elementByZ, type Element } from '@/lib/chem/quantum/periodic-table';

const STORE_KEY = 'gaia_progress_v1';

// ── Catálogo de pilares ──────────────────────────────────────────────
// v1: totales curados a mano (espejo del copy de EscuelaPortal). Cuando los
// registries de labs/masterclass expongan un conteo estable, se deriva de ahí.
export type PillarKey = 'math' | 'physics' | 'quimica' | 'economia' | 'masterclass';

export interface Pillar {
  key: PillarKey;
  name: string;
  glyph: string;
  accent: string;
  href: string;
  tagline: string;
  total: number;
}

export const PILLARS: Pillar[] = [
  { key: 'math',        name: 'Matemáticas', glyph: 'Σ', accent: '#4FC3F7', href: '/math.html',     tagline: 'No se memorizan, se ven.',        total: 22 },
  { key: 'physics',     name: 'Física',      glyph: 'Φ', accent: '#7E57C2', href: '/physics.html',  tagline: 'No es una clase — vé y toca.',    total: 10 },
  { key: 'quimica',     name: 'Química',     glyph: '⚗', accent: '#F472B6', href: '/lab.html',      tagline: 'Desde la cuántica, no la receta.', total: 7 },
  { key: 'economia',    name: 'Economía',    glyph: '₿', accent: '#34D399', href: '/economia.html', tagline: 'Sin gurús — puros Nobel.',        total: 57 },
  { key: 'masterclass', name: 'Masterclass', glyph: '▶', accent: '#A78BFA', href: '/',              tagline: 'Narradas por Matilda, en 3D-real.', total: 6 },
];

export const TOTAL_LESSONS = PILLARS.reduce((s, p) => s + p.total, 0); // = 102 → Nobelio

// ── Estado persistido ────────────────────────────────────────────────
export interface Progress {
  v: 1;
  /** ids de lecciones completadas por pilar (id libre por módulo, p.ej. 'econ:akerlof') */
  lessons: Record<PillarKey, string[]>;
  /** reportes PDF generados */
  reports: number;
  /** racha: días consecutivos con actividad */
  streak: { days: number; lastISO: string };
  /** primera actividad (para "miembro desde" del recorrido) */
  sinceISO: string;
}

function emptyProgress(): Progress {
  const today = new Date().toISOString().slice(0, 10);
  return {
    v: 1,
    lessons: { math: [], physics: [], quimica: [], economia: [], masterclass: [] },
    reports: 0,
    streak: { days: 0, lastISO: today },
    sinceISO: today,
  };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw) as Progress;
    if (p?.v !== 1 || !p.lessons) return emptyProgress();
    return p;
  } catch {
    return emptyProgress();
  }
}

function save(p: Progress) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch { /* modo incógnito */ }
}

// ── Mutaciones (los labs llaman esto al terminar una lección) ────────
/** Marca una lección como completada. Idempotente. Devuelve el estado nuevo. */
export function completeLesson(pillar: PillarKey, lessonId: string): Progress {
  const p = loadProgress();
  if (!p.lessons[pillar].includes(lessonId)) p.lessons[pillar].push(lessonId);
  touchStreak(p);
  save(p);
  return p;
}

export function addReport(): Progress {
  const p = loadProgress();
  p.reports += 1;
  touchStreak(p);
  save(p);
  return p;
}

/** Actividad de hoy → mantiene o extiende la racha. */
function touchStreak(p: Progress) {
  const today = new Date().toISOString().slice(0, 10);
  const last = p.streak.lastISO;
  if (last === today) {
    // Primera actividad de la vida: la racha nace en 1 (no en 0).
    if (p.streak.days === 0) p.streak.days = 1;
    return;
  }
  const dLast = new Date(last + 'T12:00:00Z').getTime();
  const dToday = new Date(today + 'T12:00:00Z').getTime();
  const gap = Math.round((dToday - dLast) / 86_400_000);
  p.streak = { days: gap === 1 ? p.streak.days + 1 : 1, lastISO: today };
}

// ── Lecturas derivadas ───────────────────────────────────────────────
export function lessonsDone(p: Progress): number {
  return (Object.values(p.lessons) as string[][]).reduce((s, a) => s + a.length, 0);
}

export function pillarDone(p: Progress, key: PillarKey): number {
  return p.lessons[key].length;
}

/** Tu elemento actual: Z = max(1, lecciones). Naces Hidrógeno; te gradúas Nobelio. */
export function elementNow(p: Progress): Element {
  return elementByZ(Math.min(118, Math.max(1, lessonsDone(p))))!;
}

/** El siguiente elemento (null si ya llegaste al tope del catálogo). */
export function elementNext(p: Progress): Element | null {
  const z = Math.min(118, Math.max(1, lessonsDone(p)));
  return z >= 118 ? null : elementByZ(z + 1)!;
}

// ── Insignias (se GANAN — derivadas, nunca almacenadas) ──────────────
export interface Badge {
  id: string;
  glyph: string;
  accent: string;
  name: string;
  /** estado legible: "Desbloqueada" o qué falta */
  status: string;
  unlocked: boolean;
}

export function badges(p: Progress): Badge[] {
  const done = lessonsDone(p);
  const touched = PILLARS.filter((pl) => pillarDone(p, pl.key) > 0).length;
  const fullPillar = PILLARS.find((pl) => pillarDone(p, pl.key) >= pl.total);
  const mc = pillarDone(p, 'masterclass');
  return [
    { id: 'first-lab',    glyph: 'ψ', accent: '#4FC3F7', name: 'Primer laboratorio',  unlocked: done >= 1,          status: done >= 1 ? 'Desbloqueada' : 'Completa 1 lección' },
    { id: 'first-report', glyph: '∮', accent: '#F472B6', name: 'Primer reporte PDF',  unlocked: p.reports >= 1,     status: p.reports >= 1 ? 'Desbloqueada' : 'Genera un reporte' },
    { id: 'streak-5',     glyph: '⚡', accent: '#FDB813', name: 'Racha de 5 días',     unlocked: p.streak.days >= 5, status: p.streak.days >= 5 ? 'Desbloqueada' : `Van ${p.streak.days} de 5` },
    { id: 'explorer',     glyph: '✦', accent: '#34D399', name: 'Cinco pilares tocados', unlocked: touched >= 5,     status: touched >= 5 ? 'Desbloqueada' : `Van ${touched} de 5` },
    { id: 'pillar-full',  glyph: 'Ω', accent: '#7E57C2', name: 'Domina un pilar',     unlocked: !!fullPillar,       status: fullPillar ? `${fullPillar.name} al 100%` : 'Completa un pilar' },
    { id: 'mc-6',         glyph: '𝕄', accent: '#A78BFA', name: 'Todas las masterclass', unlocked: mc >= 6,          status: mc >= 6 ? 'Desbloqueada' : `Van ${mc} de 6` },
    { id: 'noble',        glyph: '☢', accent: '#FB7185', name: 'Gas noble',           unlocked: [2, 10, 18, 36, 54, 86].includes(Math.max(1, done)), status: 'Cae exacto en He·Ne·Ar·Kr·Xe·Rn' },
    { id: 'nobelio',      glyph: '💎', accent: '#FDB813', name: 'Nobelio (Z=102)',     unlocked: done >= TOTAL_LESSONS, status: done >= TOTAL_LESSONS ? 'LA UNIVERSIDAD ES TUYA' : `${done} / ${TOTAL_LESSONS} lecciones` },
  ];
}

// ── Demo (?demo=N) — sembrar un recorrido realista para diseño/QA ────
/** Reparte N lecciones entre pilares proporcional a su tamaño (determinista). */
export function demoProgress(n: number): Progress {
  const p = emptyProgress();
  const total = Math.min(TOTAL_LESSONS, Math.max(0, Math.floor(n)));
  // proporcional con residuo mayor — determinista, sin Math.random
  const quotas = PILLARS.map((pl) => (total * pl.total) / TOTAL_LESSONS);
  const base = quotas.map(Math.floor);
  let left = total - base.reduce((s, x) => s + x, 0);
  const order = quotas
    .map((q, i) => ({ i, frac: q - Math.floor(q) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) { if (left <= 0) break; base[i] += 1; left -= 1; }
  PILLARS.forEach((pl, i) => {
    const k = Math.min(pl.total, base[i]);
    p.lessons[pl.key] = Array.from({ length: k }, (_, j) => `${pl.key}:demo-${j + 1}`);
  });
  p.reports = Math.min(3, Math.floor(total / 9));
  p.streak = { days: Math.min(5, Math.max(1, Math.floor(total / 5))), lastISO: p.streak.lastISO };
  return p;
}

/** Progreso efectivo de la página: ?demo=N manda (para diseño/QA), si no, el real. */
export function effectiveProgress(): Progress {
  try {
    const q = new URLSearchParams(window.location.search).get('demo');
    if (q != null) return demoProgress(parseInt(q, 10) || 0);
  } catch { /* SSR/tests */ }
  return loadProgress();
}
