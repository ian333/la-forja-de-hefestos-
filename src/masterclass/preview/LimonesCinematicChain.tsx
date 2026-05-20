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

const SCENES = [
  { Comp: LimonesEscena01, label: 'Hook' },
  { Comp: LimonesEscena02, label: 'Misconception' },
  { Comp: LimonesEscena03, label: 'Reveal interno' },
  { Comp: LimonesEscena04, label: '100 carros' },
  { Comp: LimonesEscena05, label: 'Asimétrica' },
  { Comp: LimonesEscena06, label: 'La matemática' },
  { Comp: LimonesEscena07, label: 'Los cherries huyen' },
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

  // Auto-click del play button para escenas 2-7 (audio context ya desbloqueado)
  useEffect(() => {
    if (idx === 0 || finished) return;
    const container = containerRef.current;
    if (!container) return;
    let cancel = false;
    const tryClick = () => {
      if (cancel) return;
      const btn = container.querySelector('button[class*="backdrop-blur"]') as HTMLButtonElement | null;
      if (btn) {
        btn.click();
      } else {
        // Si aún no aparece, reintentar
        setTimeout(tryClick, 100);
      }
    };
    setTimeout(tryClick, 300);
    return () => { cancel = true; };
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
      <Comp key={idx} forceAspect="auto" />
      <ProgressDots current={idx} total={SCENES.length} />
    </div>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none z-40">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all"
          style={{
            width: i === current ? 22 : 6,
            height: 6,
            backgroundColor: i <= current ? '#FFE5A0' : '#FFE5A0',
            opacity: i === current ? 0.95 : i < current ? 0.55 : 0.20,
            boxShadow: i === current ? '0 0 8px rgba(255, 229, 160, 0.6)' : 'none',
          }}
        />
      ))}
    </div>
  );
}
