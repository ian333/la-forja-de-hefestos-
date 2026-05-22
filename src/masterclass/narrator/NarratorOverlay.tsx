/**
 * NarratorOverlay — capa CSS sobre el Canvas R3F.
 *
 *  Lee audio.currentTime cada frame y renderiza callouts (flechas, big-numbers,
 *  spotlights, pulses, labels) cuya ventana [atSec, untilSec] contiene el tiempo
 *  actual. Cada callout fade-in/fade-out con fadeMs.
 *
 *  Es el "puntero del maestro" — apunta a lo que importa cuando Matilda lo dice.
 *
 *  Uso desde Player.tsx:
 *    <div className="relative">
 *      <SceneSwitch ... />
 *      <NarratorOverlay config={sceneConfig} audioRef={audioRef} />
 *    </div>
 */

import { useEffect, useRef, useState } from 'react';
import type {
  Callout, SceneNarratorConfig,
  ArrowCallout, BigCallout, SpotlightCallout, PulseCallout, LabelCallout,
  ArrowDir,
} from './types';

interface Props {
  config: SceneNarratorConfig | undefined;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

function activeOpacity(c: Callout, t: number): number {
  if (t < c.atSec) return 0;
  const end = c.untilSec ?? c.atSec + 4;
  if (t >= end) return 0;
  const fade = (c.fadeMs ?? 350) / 1000;
  const since = t - c.atSec;
  if (since < fade) return since / fade;
  const tillEnd = end - t;
  if (tillEnd < fade) return tillEnd / fade;
  return 1;
}

export default function NarratorOverlay({ config, audioRef }: Props) {
  const [tick, setTick] = useState(0);
  const tRef = useRef(0);

  // ler audio.currentTime cada frame
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const audio = audioRef.current;
      if (audio) tRef.current = audio.currentTime;
      setTick(x => x + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [audioRef]);

  if (!config || !config.callouts || config.callouts.length === 0) return null;
  const t = tRef.current;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
      {config.callouts.map((c, i) => {
        const op = activeOpacity(c, t);
        if (op <= 0) return null;
        switch (c.type) {
          case 'arrow':     return <ArrowEl key={i} c={c} op={op} t={t} />;
          case 'big':       return <BigEl key={i} c={c} op={op} t={t} />;
          case 'spotlight': return <SpotlightEl key={i} c={c} op={op} />;
          case 'pulse':     return <PulseEl key={i} c={c} op={op} t={t} />;
          case 'label':     return <LabelEl key={i} c={c} op={op} />;
        }
      })}
    </div>
  );
}

// ─── Arrow ────────────────────────────────────────────────────────────────
function ArrowEl({ c, op, t }: { c: ArrowCallout; op: number; t: number }) {
  const color = c.color ?? '#FDB813';
  // ángulo desde tail hacia tip (apunta DESDE dir HACIA at)
  const angleDeg = directionToTailAngle(c.dir);   // ángulo en que está la cola
  // la flecha completa: posicionada en `at`, rotada para apuntar saliendo de su cola
  const arrowAngle = (angleDeg + 180) % 360;
  // pulso ligero
  const bob = Math.sin(t * 4 + c.atSec) * 2;     // ±2px
  return (
    <div
      className="absolute"
      style={{
        left: c.at.x,
        top: c.at.y,
        opacity: op,
        transform: 'translate(-50%, -50%)',
        transition: 'opacity 80ms linear',
      }}
    >
      {/* línea de la flecha + cabeza */}
      <div
        style={{
          position: 'absolute',
          width: 90,
          height: 2,
          background: color,
          borderRadius: 1,
          left: -45,
          top: -1 + bob,
          transform: `rotate(${arrowAngle}deg)`,
          transformOrigin: '50% 50%',
          boxShadow: `0 0 8px ${color}cc`,
        }}
      />
      {/* punta — un triángulo CSS rotado */}
      <div
        style={{
          position: 'absolute',
          left: -8,
          top: -8 + bob,
          width: 16,
          height: 16,
          borderLeft: `9px solid transparent`,
          borderRight: `9px solid transparent`,
          borderBottom: `14px solid ${color}`,
          transform: `rotate(${arrowAngle - 90}deg)`,
          filter: `drop-shadow(0 0 4px ${color})`,
        }}
      />
      {/* etiqueta de texto, posicionada en el extremo opuesto a la punta */}
      <div
        style={{
          position: 'absolute',
          ...labelOffsetForDir(c.dir, 70),
          color: color,
          fontSize: 13,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontWeight: 600,
          textShadow: '0 1px 4px rgba(0,0,0,0.85)',
          whiteSpace: 'nowrap',
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.55)',
          border: `1px solid ${color}66`,
          borderRadius: 4,
          backdropFilter: 'blur(2px)',
        }}
      >
        {c.text}
      </div>
    </div>
  );
}

function directionToTailAngle(dir: ArrowDir): number {
  // dirección "donde está la COLA" (la punta queda en `at`)
  switch (dir) {
    case 'up':         return 90;
    case 'down':       return 270;
    case 'left':       return 0;
    case 'right':      return 180;
    case 'up-left':    return 45;
    case 'up-right':   return 135;
    case 'down-left':  return 315;
    case 'down-right': return 225;
  }
}

function labelOffsetForDir(dir: ArrowDir, distance: number): React.CSSProperties {
  // donde poner la etiqueta: cerca de la cola
  const map: Record<ArrowDir, [number, number]> = {
    'up':          [0, -distance],
    'down':        [0,  distance],
    'left':        [-distance, 0],
    'right':       [ distance, 0],
    'up-left':     [-distance * 0.7, -distance * 0.7],
    'up-right':    [ distance * 0.7, -distance * 0.7],
    'down-left':   [-distance * 0.7,  distance * 0.7],
    'down-right':  [ distance * 0.7,  distance * 0.7],
  };
  const [dx, dy] = map[dir];
  // anchor center
  return {
    left: dx,
    top: dy,
    transform: 'translate(-50%, -50%)',
  };
}

// ─── Big (número / frase grande) ─────────────────────────────────────────
function BigEl({ c, op, t }: { c: BigCallout; op: number; t: number }) {
  const color = c.color ?? '#FFFFFF';
  // pop-in scale animation
  const since = t - c.atSec;
  const popScale = since < 0.3 ? 0.5 + (since / 0.3) * 0.5 : 1.0;
  const at = c.at ?? { x: '50%', y: '50%' };
  return (
    <div
      className="absolute"
      style={{
        left: at.x,
        top: at.y,
        transform: `translate(-50%, -50%) scale(${popScale})`,
        opacity: op,
        textAlign: 'center',
        transition: 'opacity 100ms linear',
      }}
    >
      <div
        style={{
          color,
          fontSize: 56,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontWeight: 800,
          letterSpacing: '0.02em',
          textShadow: `0 0 24px ${color}aa, 0 0 6px rgba(0,0,0,0.95)`,
          lineHeight: 1.05,
          padding: '12px 24px',
          background: 'rgba(0,0,0,0.45)',
          borderRadius: 12,
          border: `1.5px solid ${color}66`,
          backdropFilter: 'blur(4px)',
        }}
      >
        {c.text}
      </div>
      {c.subtext && (
        <div
          style={{
            color: '#94A3B8',
            fontSize: 14,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            marginTop: 8,
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          }}
        >
          {c.subtext}
        </div>
      )}
    </div>
  );
}

// ─── Spotlight (oscurece todo excepto un círculo) ─────────────────────────
function SpotlightEl({ c, op }: { c: SpotlightCallout; op: number }) {
  const radius = c.radiusPct ?? 22;
  const darken = c.darken ?? 0.65;
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(circle at ${c.center.x} ${c.center.y}, transparent 0%, transparent ${radius}%, rgba(0,0,0,${darken * op}) ${radius + 18}%)`,
        transition: 'opacity 200ms linear',
      }}
    />
  );
}

// ─── Pulse (anillo expansivo) ─────────────────────────────────────────────
function PulseEl({ c, op, t }: { c: PulseCallout; op: number; t: number }) {
  const color = c.color ?? '#22D3EE';
  const maxR = c.maxRadiusPct ?? 12;
  // varios anillos desfasados
  const since = t - c.atSec;
  const ringT = (since % 1.0);    // 1 seg de ciclo por anillo
  const r = ringT * maxR;
  const ringOpacity = (1 - ringT) * op;
  return (
    <div className="absolute" style={{ left: c.at.x, top: c.at.y, transform: 'translate(-50%, -50%)' }}>
      <div
        style={{
          width: `${r}vmin`,
          height: `${r}vmin`,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          opacity: ringOpacity,
          boxShadow: `0 0 16px ${color}aa, inset 0 0 12px ${color}55`,
        }}
      />
    </div>
  );
}

// ─── Label (texto pequeño con anchor) ─────────────────────────────────────
function LabelEl({ c, op }: { c: LabelCallout; op: number }) {
  const color = c.color ?? '#94A3B8';
  const sizes = { sm: 11, md: 13, lg: 16 };
  const fontSize = sizes[c.size ?? 'md'];
  return (
    <div
      className="absolute"
      style={{
        left: c.at.x,
        top: c.at.y,
        transform: 'translate(-50%, -50%)',
        opacity: op,
        color,
        fontSize,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        whiteSpace: 'nowrap',
        padding: '4px 9px',
        background: 'rgba(0,0,0,0.55)',
        border: `1px solid ${color}55`,
        borderRadius: 4,
        backdropFilter: 'blur(2px)',
        textShadow: '0 1px 3px rgba(0,0,0,0.7)',
        transition: 'opacity 120ms linear',
      }}
    >
      {c.text}
    </div>
  );
}
