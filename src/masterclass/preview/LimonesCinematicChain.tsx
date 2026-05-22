/**
 * LimonesCinematicChain — encadena las 7 escenas Limones nuevas en una clase
 * continua. Reemplaza la masterclass vieja `econ-01-limones` cuando el Player
 * detecta ese id.
 *
 * Diseño:
 *   - Renderiza UNA escena a la vez (montaje/desmontaje secuencial).
 *   - Detecta el `<audio>` element interno de cada escena por DOM query.
 *   - Cuando el audio termina, avanza a la siguiente escena (idx + 1).
 *   - El primer click del user en la escena 1 desbloquea audio context;
 *     las escenas 2-7 reciben click programático automático.
 *   - Al terminar la 7, queda en pantalla con overlay "fin del capítulo".
 *
 * NO modifica las escenas individuales — el chain es 100% external.
 */

import { useEffect, useRef, useState } from 'react';
import LimonesEscena01 from './LimonesEscena01';
import LimonesEscena02 from './LimonesEscena02';
import LimonesEscena03 from './LimonesEscena03';
import LimonesEscena04 from './LimonesEscena04';
import LimonesEscena05 from './LimonesEscena05';
import LimonesEscena06 from './LimonesEscena06';
import LimonesEscena07 from './LimonesEscena07';
import LimonesEscena08 from './LimonesEscena08';
import LimonesEscena09 from './LimonesEscena09';
import LimonesEscena10 from './LimonesEscena10';
import LimonesEscena11 from './LimonesEscena11';
import LimonesEscena12 from './LimonesEscena12';
import LimonesEscena13 from './LimonesEscena13';
import LimonesEscena14 from './LimonesEscena14';
import LimonesEscena15 from './LimonesEscena15';
import LimonesEscena16 from './LimonesEscena16';
import LimonesEscena17 from './LimonesEscena17';
import LimonesEscena18 from './LimonesEscena18';
import LimonesEscena19 from './LimonesEscena19';
import LimonesEscena20 from './LimonesEscena20';
import LimonesEscena21 from './LimonesEscena21';
import LimonesEscena22 from './LimonesEscena22';
import LimonesEscena23 from './LimonesEscena23';
import LimonesEscena24 from './LimonesEscena24';
import LimonesEscena25 from './LimonesEscena25';

const SCENES = [
  { Comp: LimonesEscena01, label: 'Hook' },
  { Comp: LimonesEscena02, label: 'Misconception' },
  { Comp: LimonesEscena03, label: 'Reveal interno' },
  { Comp: LimonesEscena04, label: '100 carros' },
  { Comp: LimonesEscena05, label: 'Asimétrica' },
  { Comp: LimonesEscena06, label: 'La matemática' },
  { Comp: LimonesEscena07, label: 'Los cherries huyen' },
  { Comp: LimonesEscena08, label: 'El nuevo promedio cae' },
  { Comp: LimonesEscena09, label: 'El colapso' },
  { Comp: LimonesEscena10, label: '¿hay solución?' },
  { Comp: LimonesEscena11, label: 'Berkeley · 1970' },
  { Comp: LimonesEscena12, label: 'El bucle' },
  { Comp: LimonesEscena13, label: 'Paper rechazado' },
  { Comp: LimonesEscena14, label: 'Nobel 2001' },
  { Comp: LimonesEscena15, label: 'Señalizar' },
  { Comp: LimonesEscena16, label: 'No es solo carros' },
  { Comp: LimonesEscena17, label: 'Seguros médicos' },
  { Comp: LimonesEscena18, label: 'El crédito' },
  { Comp: LimonesEscena19, label: 'Subprime · 2008' },
  { Comp: LimonesEscena20, label: '¿qué mercado?' },
  { Comp: LimonesEscena21, label: 'Tu vida ya cambió' },
  { Comp: LimonesEscena22, label: 'La señal' },
  { Comp: LimonesEscena23, label: 'Cómo no ser limón' },
  { Comp: LimonesEscena24, label: 'Economía de info' },
  { Comp: LimonesEscena25, label: 'Fin · 56 más' },
];

export default function LimonesCinematicChain() {
  const [idx, setIdx] = useState(0);
  const [finished, setFinished] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detectar el <audio> de la escena montada y hookear el "ended" para avanzar.
  useEffect(() => {
    if (finished) return;
    const container = containerRef.current;
    if (!container) return;

    let advanced = false;
    let pollHandle: number | null = null;
    let audioElForCleanup: HTMLAudioElement | null = null;

    const advance = () => {
      if (advanced) return;
      advanced = true;
      // Pausar el audio antes de unmount para que no quede orphan reproduciendo
      if (audioElForCleanup) {
        try { audioElForCleanup.pause(); } catch {}
      }
      setTimeout(() => {
        setIdx(prev => {
          const next = prev + 1;
          if (next >= SCENES.length) {
            setFinished(true);
            return prev;
          }
          return next;
        });
      }, 700);
    };

    const attach = () => {
      const audio = container.querySelector('audio') as HTMLAudioElement | null;
      if (!audio) return false;
      audioElForCleanup = audio;
      audio.addEventListener('ended', advance);
      return true;
    };

    // Poll hasta encontrar el audio element (puede tardar 1-2 frames)
    const poll = () => {
      if (attach()) return;
      pollHandle = window.setTimeout(poll, 80);
    };
    poll();

    return () => {
      if (pollHandle != null) clearTimeout(pollHandle);
      if (audioElForCleanup) {
        audioElForCleanup.removeEventListener('ended', advance);
      }
    };
  }, [idx, finished]);

  // Auto-click del play button — TODAS las escenas (incluida la primera).
  // En escenas 2-25 el play button queda OCULTO via CSS desde el primer frame
  // (ver <style> abajo), así que el user nunca lo ve parpadear. El click
  // programático ocurre rápido (50ms) y desbloquea el state interno de la escena.
  // En escena 1 sí queda visible — necesita el user gesture para autoplay.
  useEffect(() => {
    if (finished) return;
    const container = containerRef.current;
    if (!container) return;
    let cancel = false;
    let fallbackListener: ((e: Event) => void) | null = null;

    const clickPlay = () => {
      const btn = container.querySelector('button[class*="backdrop-blur"]') as HTMLButtonElement | null;
      if (!btn) return false;
      btn.click();
      return true;
    };

    const tryClick = (attempts = 0) => {
      if (cancel || attempts > 40) return;
      if (!clickPlay()) {
        setTimeout(() => tryClick(attempts + 1), 50);
      }
    };

    // Intento inmediato. Escena 1 espera un poco más para que el browser
    // tenga el audio listo; escenas 2+ disparan casi instantáneo.
    setTimeout(() => { if (!cancel) tryClick(); }, idx === 0 ? 120 : 40);

    // Red de respaldo: si después de 1s el audio sigue pausado en escena 1,
    // enganchar listener global de click/keydown para reintentar al primer
    // user gesture de la página.
    if (idx === 0) {
      setTimeout(() => {
        if (cancel) return;
        const audio = container.querySelector('audio') as HTMLAudioElement | null;
        if (audio && audio.paused) {
          fallbackListener = () => {
            const btn = container.querySelector('button[class*="backdrop-blur"]') as HTMLButtonElement | null;
            if (btn) btn.click();
          };
          window.addEventListener('click', fallbackListener, { once: true, capture: true });
          window.addEventListener('keydown', fallbackListener, { once: true, capture: true });
        }
      }, 1000);
    }

    return () => {
      cancel = true;
      if (fallbackListener) {
        window.removeEventListener('click', fallbackListener, { capture: true } as any);
        window.removeEventListener('keydown', fallbackListener, { capture: true } as any);
      }
    };
  }, [idx, finished]);

  // ─── Navegación manual: teclado + handlers ──────────────────
  const goTo = (target: number) => {
    if (target < 0 || target >= SCENES.length) return;
    setFinished(false);
    setIdx(target);
  };
  const goPrev = () => goTo(idx - 1);
  const goNext = () => {
    if (idx >= SCENES.length - 1) {
      setFinished(true);
    } else {
      goTo(idx + 1);
    }
  };

  // Teclas ← → para anterior/siguiente
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, finished]);

  if (finished) {
    return (
      <div
        className="relative w-screen h-screen overflow-hidden flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at 50% 35%, #0a0d1a 0%, #020108 80%)' }}
      >
        <div className="text-center pointer-events-none">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#FFE5A0]/60 font-mono mb-6">
            Akerlof · Los Limones · 7/7
          </div>
          <div className="text-[44px] font-mono text-[#FFE5A0] mb-3" style={{ textShadow: '0 0 20px rgba(255, 229, 160, 0.5)' }}>
            fin del capítulo
          </div>
          <div className="text-[12px] text-[#A89580]/70 font-mono mb-10">
            el resto de la clase está en construcción
          </div>
          <button
            onClick={() => { setIdx(0); setFinished(false); }}
            className="text-[11px] uppercase tracking-[0.3em] text-[#FFE5A0] border border-[#FFE5A0]/40 px-6 py-2 rounded-full hover:bg-[#FFE5A0]/10 transition-colors pointer-events-auto font-mono"
          >
            volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const { Comp } = SCENES[idx];

  return (
    <div ref={containerRef} className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Ocultar el play button overlay en escenas 2-25 — el click es
          programático y el botón nunca debe verse parpadear */}
      {idx > 0 && (
        <style>{`
          .scene-host button[class*="backdrop-blur"] {
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `}</style>
      )}
      <div className="scene-host w-full h-full">
        <Comp key={idx} forceAspect="auto" />
      </div>

      {/* Botón anterior */}
      <button
        onClick={goPrev}
        disabled={idx === 0}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full border border-[#FFE5A0]/30 bg-black/30 backdrop-blur-sm text-[#FFE5A0] text-xl flex items-center justify-center hover:bg-[#FFE5A0]/10 hover:border-[#FFE5A0]/60 disabled:opacity-15 disabled:cursor-not-allowed transition-all font-mono"
        aria-label="escena anterior"
        style={{ pointerEvents: 'auto' }}
      >
        ←
      </button>

      {/* Botón siguiente */}
      <button
        onClick={goNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full border border-[#FFE5A0]/30 bg-black/30 backdrop-blur-sm text-[#FFE5A0] text-xl flex items-center justify-center hover:bg-[#FFE5A0]/10 hover:border-[#FFE5A0]/60 transition-all font-mono"
        aria-label="escena siguiente"
        style={{ pointerEvents: 'auto' }}
      >
        →
      </button>

      <ProgressDots current={idx} total={SCENES.length} onJump={goTo} />
    </div>
  );
}

function ProgressDots({ current, total, onJump }: {
  current: number;
  total: number;
  onJump: (idx: number) => void;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-40">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onJump(i)}
          className="rounded-full transition-all hover:scale-125"
          aria-label={`ir a escena ${i + 1}`}
          style={{
            width: i === current ? 22 : 6,
            height: 6,
            backgroundColor: '#FFE5A0',
            opacity: i === current ? 0.95 : i < current ? 0.55 : 0.20,
            boxShadow: i === current ? '0 0 8px rgba(255, 229, 160, 0.6)' : 'none',
            padding: 0,
            border: 'none',
            cursor: 'pointer',
          }}
        />
      ))}
    </div>
  );
}
