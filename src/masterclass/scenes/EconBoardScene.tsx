/**
 * EconBoardScene — pizarrón GIGANTE protagonista.
 *
 * Cuando la narrativa es histórica / cualitativa (no hay objeto matemático
 * que se mueva), esta escena toma el centro de la pantalla con el pizarrón
 * grande y se prescinde del panel lateral. Las líneas del board se animan
 * en cascada con KaTeX renderizado, igual que el Chalkboard normal.
 *
 * Esta escena es phase-aware: el `phase` es scene.id (ej. "04-paper",
 * "08-ford"). El pizarrón se reanima cada vez que cambia el phase porque
 * el Player ya pasa scenarioKey = scene.id al Chalkboard. Aquí solo nos
 * encargamos del fondo y la composición espacial.
 *
 * En el Player, cuando la escena es "econ-board", el panel lateral del
 * Chalkboard NO se renderiza (es responsabilidad del Player decidirlo).
 * Para que esta escena no requiera cambios en Player, exponemos el board
 * vía contexto del DOM: leemos los `lines` del scene actual por prop
 * normal.
 */

import { useEffect } from 'react';
import Chalkboard from '../Chalkboard';

interface EconBoardSceneProps {
  /** scene.id, used by Chalkboard to re-trigger reveal animation */
  phase: string;
  /** lines to draw on the board */
  lines: string[];
  /** audio duration so reveal animation paces with narration */
  audioDurationSec?: number;
}

export default function EconBoardScene({ phase, lines, audioDurationSec }: EconBoardSceneProps) {
  // Soft pulsing accent in the background to add subtle life
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.getPropertyValue('--econ-board-pulse');
    el.style.setProperty('--econ-board-pulse', '1');
    return () => {
      el.style.setProperty('--econ-board-pulse', prev);
    };
  }, []);

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #14111A 0%, #03050A 80%)' }}
    >
      {/* Ambient blobs — subtle motion */}
      <div
        className="absolute w-[55%] h-[60%] rounded-full pointer-events-none opacity-25 blur-[110px]"
        style={{
          top: '-15%',
          right: '-10%',
          background: 'radial-gradient(circle, #FDB813 0%, transparent 70%)',
          animation: 'econBoardPulse1 12s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[50%] h-[55%] rounded-full pointer-events-none opacity-22 blur-[110px]"
        style={{
          bottom: '-15%',
          left: '-10%',
          background: 'radial-gradient(circle, #F472B6 0%, transparent 70%)',
          animation: 'econBoardPulse2 14s ease-in-out infinite',
        }}
      />

      {/* Subtle dust */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #CBD5E1 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Center stage: the chalkboard, BIG */}
      <div className="absolute inset-0 flex items-center justify-center px-12">
        <div
          className="relative w-full"
          style={{
            maxWidth: '880px',
            // Reserve space for the subtitle (bottom) and the title bar (top)
            maxHeight: 'calc(100vh - 240px)',
          }}
        >
          {/* The chalkboard component renders the board in cascade — we let it
              govern its own height via padding inside. */}
          <Chalkboard
            lines={lines}
            scenarioKey={phase}
            audioDurationSec={audioDurationSec}
          />
        </div>
      </div>

      {/* Inline animation keyframes (kept local so EconBoardScene is portable) */}
      <style>{`
        @keyframes econBoardPulse1 {
          0%, 100% { opacity: 0.20; transform: translate(0, 0); }
          50%      { opacity: 0.30; transform: translate(20px, 15px); }
        }
        @keyframes econBoardPulse2 {
          0%, 100% { opacity: 0.18; transform: translate(0, 0); }
          50%      { opacity: 0.26; transform: translate(-15px, -10px); }
        }
      `}</style>
    </div>
  );
}
