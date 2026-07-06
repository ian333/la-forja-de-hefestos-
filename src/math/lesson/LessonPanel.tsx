/**
 * LessonPanel — el shell pedagógico animado.
 *
 *   A) HOOK         — gancho narrativo
 *   B) PASOS        — cada paso tiene KEYFRAMES que animan el simulador
 *                     y PÁRRAFOS que se iluminan en sincro con la animación
 *   C) SANDBOX      — controles crudos
 *   D) CONEXIÓN     — próximos pasos
 *
 * La idea pedagógica clave:
 *   El texto NO se lee primero y luego el usuario hace clic. En vez de eso,
 *   al entrar a un paso la animación corre sola — el punto sube por la
 *   superficie, el plano tangente gira, la flecha del gradiente aparece —
 *   y los párrafos del texto se iluminan EN SINCRONÍA con cada frame.
 *
 * Es exactamente lo que hace Grant Sanderson (3Blue1Brown): la cámara
 * acompaña al argumento. Acá la cámara es la escena 3D, y el "argumento"
 * va apareciendo en la columna de la derecha.
 */

import { useState, useEffect, useRef, type ReactNode } from 'react';

// ── Keyframe types ────────────────────────────────────────────────────

export interface Keyframe<S> {
  /** 0 = inicio del paso, 1 = fin. Los valores entre keyframes se interpolan. */
  at: number;
  state: Partial<S>;
}

export interface LessonStep<S> {
  title: string;
  /**
   * Cuerpo del paso. Separá párrafos con doble salto de línea (\n\n).
   * Cada párrafo se ilumina en su "ventana de tiempo" durante la animación.
   */
  body: string;
  /** Fórmula opcional debajo del cuerpo. */
  formula?: string;
  /** Duración total de la animación del paso (ms). Default 4000. */
  duration?: number;
  /**
   * Lista de keyframes. Si solo das uno, es un snap. Si das varios, se
   * interpolan (numbers via easeInOutCubic, strings via snap).
   */
  keyframes?: Keyframe<S>[];
  /** Atajo: si no hay keyframes, aplicar este estado al entrar. */
  targetState?: Partial<S>;
}

export interface Lesson<S> {
  hook: { title: string; body: string };
  steps: LessonStep<S>[];
  connect: { body: string; links?: Array<{ label: string; href: string }> };
}

interface LessonPanelProps<S> {
  lesson: Lesson<S>;
  onApplyState: (patch: Partial<S>) => void;
  sandbox: ReactNode;
  /**
   * Contenido del TERCER tab '∑ Pasos' (los pasos del solver). OPCIONAL: si el
   * modulo no lo pasa, el tab no aparece — retrocompatible con los modulos que
   * no mapean al resolvedor simbolico.
   */
  stepsContent?: ReactNode;
}

// ── Easing ────────────────────────────────────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Interpolation across keyframes ────────────────────────────────────

function interpolate<S>(
  keyframes: Keyframe<S>[],
  t: number,
): Partial<S> {
  if (keyframes.length === 0) return {};
  if (keyframes.length === 1) return keyframes[0].state;

  // Find the surrounding keyframes
  let prevIdx = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (t >= keyframes[i].at && t <= keyframes[i + 1].at) {
      prevIdx = i;
      break;
    }
    if (t > keyframes[i + 1].at) prevIdx = i + 1;
  }
  const prev = keyframes[prevIdx];
  const next = keyframes[Math.min(prevIdx + 1, keyframes.length - 1)];

  if (prev === next) return prev.state;

  const span = next.at - prev.at;
  const localRaw = span > 1e-6 ? (t - prev.at) / span : 0;
  const local = easeInOutCubic(Math.max(0, Math.min(1, localRaw)));

  // Merge: take all keys from prev/next state
  const keys = new Set<string>([
    ...Object.keys(prev.state as object),
    ...Object.keys(next.state as object),
  ]);
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const pv = (prev.state as Record<string, unknown>)[k];
    const nv = (next.state as Record<string, unknown>)[k];
    const a = pv === undefined ? nv : pv;
    const b = nv === undefined ? pv : nv;
    if (typeof a === 'number' && typeof b === 'number') {
      out[k] = a + (b - a) * local;
    } else {
      // Categorical: snap at half-time
      out[k] = local < 0.5 ? a : b;
    }
  }
  return out as Partial<S>;
}

// ── Component ─────────────────────────────────────────────────────────

export default function LessonPanel<S>({ lesson, onApplyState, sandbox, stepsContent }: LessonPanelProps<S>) {
  const [page, setPage] = useState<number>(-1);  // -1 hook, 0..N-1 step, N connect
  const [mode, setMode] = useState<'lesson' | 'sandbox' | 'steps'>('lesson');
  const hasSteps = stepsContent != null;
  const [progress, setProgress] = useState(0);   // 0..1 within current step
  const [replayKey, setReplayKey] = useState(0); // bump to replay animation

  const total = lesson.steps.length;
  const inStep = page >= 0 && page < total;
  const atHook = page === -1;
  const atEnd = page === total;

  // Animation driver: rAF loop while in a step
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (mode !== 'lesson' || !inStep) return;
    const step = lesson.steps[page];
    const duration = step.duration ?? 4000;
    const kfs = step.keyframes ?? (step.targetState ? [{ at: 1, state: step.targetState }] : []);

    if (kfs.length === 0) { setProgress(1); return; }

    // Apply initial state
    onApplyState(interpolate(kfs, 0));

    if (kfs.length === 1) {
      onApplyState(kfs[0].state);
      setProgress(1);
      return;
    }

    const t0 = performance.now();
    const tick = () => {
      const elapsed = performance.now() - t0;
      const t = Math.min(1, elapsed / duration);
      setProgress(t);
      onApplyState(interpolate(kfs, t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, mode, replayKey]);

  const next = () => {
    setPage(p => {
      const np = Math.min(p + 1, total);
      // Fin de la clase guiada (llega a "Conexión"): señal de progreso. El shell
      // del lab (PhysicsLab/MathLab) sabe QUÉ módulo es y registra la lección.
      if (np === total && p !== total && total > 0) {
        window.dispatchEvent(new CustomEvent('gaia:lesson-complete'));
      }
      return np;
    });
    setProgress(0);
  };
  const prev = () => { setPage(p => Math.max(p - 1, -1)); setProgress(0); };
  const replay = () => { setReplayKey(k => k + 1); setProgress(0); };

  return (
    <aside className="rounded-lg border border-[#1E293B] bg-[#0B0F17] flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-[#1E293B] shrink-0">
        <TabButton active={mode === 'lesson'} onClick={() => setMode('lesson')}>📖 Clase</TabButton>
        <TabButton active={mode === 'sandbox'} onClick={() => setMode('sandbox')}>🎛 Sandbox</TabButton>
        {hasSteps && (
          <TabButton active={mode === 'steps'} onClick={() => setMode('steps')}>∑ Pasos</TabButton>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {mode === 'sandbox' ? (
          <div className="space-y-3">{sandbox}</div>
        ) : mode === 'steps' ? (
          <div className="space-y-3">{stepsContent}</div>
        ) : (
          <div className="space-y-3">
            {atHook && <HookView hook={lesson.hook} />}
            {inStep && (
              <StepView
                step={lesson.steps[page]}
                index={page + 1}
                total={total}
                progress={progress}
              />
            )}
            {atEnd && <ConnectView connect={lesson.connect} />}
          </div>
        )}
      </div>

      {/* Progress bar (only while animating a step) */}
      {mode === 'lesson' && inStep && (
        <div className="h-0.5 bg-[#1E293B] shrink-0">
          <div
            className="h-full bg-[#FDB813] transition-[width] duration-75"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* Footer nav */}
      {mode === 'lesson' && (
        <div className="border-t border-[#1E293B] p-3 flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={prev}
            disabled={atHook}
            className="text-[11px] px-2.5 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#4FC3F7]/30 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← anterior
          </button>
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-mono text-[#64748B]">
              {atHook ? 'gancho' : atEnd ? 'conexión' : `paso ${page + 1} / ${total}`}
            </div>
            {inStep && (
              <button
                onClick={replay}
                title="repetir animación"
                className="text-[10px] px-1.5 py-0.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#FDB813]/30 hover:text-[#FDB813]"
              >
                ↻
              </button>
            )}
          </div>
          <button
            onClick={next}
            disabled={atEnd}
            className="text-[11px] px-2.5 py-1.5 rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {atHook ? 'empezar →' : atEnd ? 'fin' : 'siguiente →'}
          </button>
        </div>
      )}
    </aside>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-[12px] px-3 py-2.5 transition border-b-2 ${
        active
          ? 'border-[#FDB813] text-white bg-[#FDB813]/5'
          : 'border-transparent text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/30'
      }`}
    >
      {children}
    </button>
  );
}

function HookView({ hook }: { hook: Lesson<unknown>['hook'] }) {
  return (
    <div className="space-y-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#FDB813]">Gancho</div>
      <h2 className="text-[15px] font-semibold text-white leading-snug">{hook.title}</h2>
      <p className="text-[12px] text-[#CBD5E1] leading-relaxed whitespace-pre-line">{hook.body}</p>
    </div>
  );
}

/**
 * Renders a step's body as paragraphs that highlight in sync with progress.
 * Body must be split with double newlines between paragraphs.
 */
function StepView({
  step, index, total, progress,
}: {
  step: LessonStep<unknown>;
  index: number;
  total: number;
  progress: number;
}) {
  // Split into paragraphs (separated by blank line) — empty strings filtered
  const paragraphs = step.body.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
  const N = Math.max(1, paragraphs.length);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#FDB813]">Paso {index}/{total}</span>
      </div>
      <h3 className="text-[14px] font-semibold text-white leading-snug">{step.title}</h3>

      <div className="space-y-2">
        {paragraphs.map((p, i) => {
          // Each paragraph gets a window of size 1/N. Active when progress
          // is within ±20% of its center. Past paragraphs stay dim-bright,
          // future paragraphs are faded.
          const center = (i + 0.5) / N;
          const dist = progress - center;
          const isPast = dist > 0.1;
          const isCurrent = Math.abs(dist) <= 0.5 / N + 0.15;
          const isFuture = dist < -0.1 && !isCurrent;
          const opacity =
            isCurrent ? 1 :
            isPast ? 0.7 :
            isFuture ? 0.3 : 0.7;
          const highlight = isCurrent ? 'text-white' : isPast ? 'text-[#CBD5E1]' : 'text-[#475569]';
          return (
            <p
              key={i}
              className={`text-[12px] leading-relaxed whitespace-pre-line transition-opacity duration-300 ${highlight}`}
              style={{ opacity }}
            >
              {p}
            </p>
          );
        })}
      </div>

      {step.formula && (
        <pre className="text-[11px] font-mono text-[#FDB813] bg-[#05060A] border border-[#1E293B] rounded px-2.5 py-2 whitespace-pre-wrap leading-relaxed">
          {step.formula}
        </pre>
      )}
    </div>
  );
}

function ConnectView({ connect }: { connect: Lesson<unknown>['connect'] }) {
  return (
    <div className="space-y-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#34D399]">Conexión</div>
      <h3 className="text-[14px] font-semibold text-white leading-snug">¿Y ahora qué?</h3>
      <p className="text-[12px] text-[#CBD5E1] leading-relaxed whitespace-pre-line">{connect.body}</p>
      {connect.links && connect.links.length > 0 && (
        <div className="space-y-1 mt-3">
          {connect.links.map((l, i) => (
            <a
              key={i}
              href={l.href}
              className="block text-[11px] px-2.5 py-1.5 rounded border border-[#1E293B] hover:border-[#34D399]/50 text-[#34D399] hover:text-white transition"
            >
              → {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
