/**
 * Chalkboard — panel lateral de la Masterclass.
 *
 * Renderiza líneas de un guión-pizarrón con apariencia de gis sobre tablero
 * verde. Las líneas aparecen en cascada (fade-in escalonado) cuando cambia
 * la escena, como si Matilda las fuera escribiendo.
 *
 * Formato del board[]:
 *   - "# título"          → encabezado pequeño (gold, small caps)
 *   - "$ ... $" (línea)   → fórmula entera LaTeX (KaTeX)
 *   - "texto $math$ tex"  → prosa con math inline (KaTeX por segmento)
 *   - "· item"            → bullet list item
 *   - ""                  → separador vertical
 *   - cualquier otra      → texto a mano alzada (Caveat, blanco hueso)
 */

import { useEffect, useState } from 'react';
import katex from 'katex';

interface ChalkboardProps {
  lines: string[];
  /** Key que cambia entre escenas → fuerza re-mount + reanima */
  scenarioKey: string;
  /** Duración del audio (segundos) para distribuir las apariciones */
  audioDurationSec?: number;
  /** Título de la sección (opcional) */
  sceneTitle?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parse a line into alternating prose / math segments using `$...$` as inline
 * math delimiters. Single-`$` legacy syntax (line starts with `$ ` and has no
 * closing `$`) is handled — the rest of the line is treated as math.
 */
function renderMixedHtml(line: string): string {
  // Legacy whole-line math: "$ ..." or "$ ... $"
  if (line.startsWith('$') && line.indexOf('$', 1) === -1) {
    const math = line.slice(1).trim();
    return katexHtml(math);
  }

  // Split into [prose, math, prose, math, ...] segments
  let html = '';
  let buf = '';
  let inMath = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '$') {
      if (inMath) {
        html += katexHtml(buf.trim());
      } else if (buf) {
        html += `<span class="chalk-prose-inline">${escapeHtml(buf)}</span>`;
      }
      buf = '';
      inMath = !inMath;
    } else {
      buf += c;
    }
  }
  if (buf) {
    if (inMath) {
      // Unclosed `$...` — treat as math anyway (legacy support)
      html += katexHtml(buf.trim());
    } else {
      html += `<span class="chalk-prose-inline">${escapeHtml(buf)}</span>`;
    }
  }
  return html;
}

function katexHtml(math: string): string {
  if (!math) return '';
  try {
    return katex.renderToString(math, {
      throwOnError: false,
      errorColor: '#F5F0E8',
      displayMode: false,
      output: 'html',
      trust: false,
    });
  } catch {
    return `<span style="color:#F5F0E8;opacity:.6">${escapeHtml(math)}</span>`;
  }
}

export default function Chalkboard({ lines, scenarioKey, audioDurationSec, sceneTitle }: ChalkboardProps) {
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => { setAnimKey(k => k + 1); }, [scenarioKey]);

  const reveals = useRevealSchedule(lines, audioDurationSec);

  return (
    <div className="relative w-full p-2.5">
      {/* Wooden frame */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: 'linear-gradient(135deg, #5d3a1f 0%, #3d2412 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 2px 4px rgba(255,255,255,0.08)',
        }}
      />
      {/* Board */}
      <div
        className="relative w-full rounded-md overflow-hidden px-5 py-4"
        style={{
          background: `
            radial-gradient(ellipse at top left, rgba(255,255,255,0.05), transparent 60%),
            radial-gradient(ellipse at bottom right, rgba(255,255,255,0.03), transparent 60%),
            linear-gradient(135deg, #103024 0%, #08180F 100%)
          `,
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6), inset 0 0 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* Subtle chalk dust */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 0.5px, transparent 0)',
            backgroundSize: '7px 7px',
          }}
        />
        {/* Eraser smudges */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            background:
              'radial-gradient(ellipse 200px 50px at 60% 30%, rgba(255,255,255,0.06), transparent 70%),' +
              'radial-gradient(ellipse 180px 40px at 30% 70%, rgba(255,255,255,0.05), transparent 70%)',
          }}
        />

        {/* Section title (optional) */}
        {sceneTitle && (
          <div
            className="relative text-[10px] uppercase tracking-[0.32em] mb-2 pb-1.5"
            style={{
              color: '#FDB813',
              borderBottom: '1px dashed rgba(253, 184, 19, 0.25)',
              fontFamily: '"JetBrains Mono", monospace',
              textShadow: '0 0 4px rgba(253, 184, 19, 0.3)',
            }}
          >
            {sceneTitle}
          </div>
        )}

        {/* Content */}
        <div key={animKey} className="relative flex flex-col gap-[3px] chalk-katex">
          {lines.length === 0 ? (
            <div className="text-center text-[#FFFFFF]/20 text-[16px] italic py-6"
                 style={{ fontFamily: '"Caveat", cursive' }}>
              · · ·
            </div>
          ) : (
            lines.map((line, i) => (
              <ChalkLine key={`${animKey}-${i}`} line={line} delayMs={reveals[i]} />
            ))
          )}
        </div>

        {/* Chalk + eraser tray */}
        <div className="mt-3 flex items-center gap-2 px-2 py-1 rounded-b-sm"
             style={{ borderTop: '1px solid rgba(0,0,0,0.4)' }}>
          <div className="h-1 w-5 rounded-full bg-[#E8E2D5]" />
          <div className="h-1 w-3 rounded-full bg-[#F472B6]/80" />
          <div className="h-1 w-3 rounded-full bg-[#FDB813]/80" />
          <div className="ml-auto h-1.5 w-6 rounded-sm bg-[#1E293B]" />
        </div>
      </div>
    </div>
  );
}

function ChalkLine({ line, delayMs }: { line: string; delayMs: number }) {
  const isBlank = line.trim() === '';
  if (isBlank) return <div className="h-1" />;

  // Heading: "# Texto"
  if (line.startsWith('# ')) {
    const txt = line.slice(2).trim();
    return (
      <div
        className="text-[10px] uppercase tracking-[0.25em] mt-2 mb-0.5"
        style={{
          color: '#FDB813',
          fontFamily: '"JetBrains Mono", monospace',
          animation: `chalkIn 0.65s cubic-bezier(.22,.61,.36,1) ${delayMs}ms both`,
          textShadow: '0 0 4px rgba(253, 184, 19, 0.25)',
        }}
      >
        {txt}
      </div>
    );
  }

  // Bullet: "· item"
  if (line.startsWith('· ') || line.startsWith('- ')) {
    const txt = line.slice(2).trim();
    return (
      <div
        className="flex items-baseline gap-2"
        style={{
          fontFamily: '"Caveat", cursive',
          fontSize: '18px',
          lineHeight: 1.15,
          color: '#F5F0E8',
          textShadow: '0 0 5px rgba(255,255,255,0.10)',
          animation: `chalkIn 0.65s cubic-bezier(.22,.61,.36,1) ${delayMs}ms both`,
        }}
      >
        <span style={{ color: '#FDC74A' }}>·</span>
        <span
          className="chalk-katex flex-1"
          dangerouslySetInnerHTML={{ __html: renderMixedHtml(txt) }}
        />
      </div>
    );
  }

  // Math-heavy line (starts with `$ ` legacy convention, single-formula display)
  const isPureMath = line.startsWith('$') && (
    line.indexOf('$', 1) === -1 ||
    /^\$[^$]*\$\s*$/.test(line.trim())
  );

  if (isPureMath) {
    let math = line.slice(1).trim();
    if (math.endsWith('$')) math = math.slice(0, -1).trim();
    return (
      <div
        className="leading-tight my-0.5"
        style={{
          fontSize: '18px',
          animation: `chalkIn 0.65s cubic-bezier(.22,.61,.36,1) ${delayMs}ms both`,
        }}
        dangerouslySetInnerHTML={{ __html: katexHtml(math) }}
      />
    );
  }

  // Mixed prose + inline math (or pure prose)
  const hasMath = line.includes('$');
  const rot = ((line.length * 37) % 5 - 2) * 0.15;

  if (hasMath) {
    return (
      <div
        className="chalk-mixed leading-snug"
        style={{
          fontFamily: '"Caveat", "Patrick Hand", cursive',
          fontSize: '19px',
          color: '#F5F0E8',
          textShadow: '0 0 5px rgba(255,255,255,0.10)',
          letterSpacing: '0.3px',
          animation: `chalkIn 0.65s cubic-bezier(.22,.61,.36,1) ${delayMs}ms both`,
        }}
        dangerouslySetInnerHTML={{ __html: renderMixedHtml(line) }}
      />
    );
  }

  // Pure prose
  return (
    <div
      style={{
        fontFamily: '"Caveat", "Patrick Hand", cursive',
        fontSize: '20px',
        lineHeight: 1.12,
        color: '#F5F0E8',
        textShadow: '0 0 5px rgba(255,255,255,0.12), 0 1px 0 rgba(0,0,0,0.4)',
        transform: `rotate(${rot}deg)`,
        animation: `chalkIn 0.65s cubic-bezier(.22,.61,.36,1) ${delayMs}ms both`,
        letterSpacing: '0.4px',
      }}
    >
      {line}
    </div>
  );
}

function useRevealSchedule(lines: string[], audioDurationSec?: number): number[] {
  const totalAudioMs = audioDurationSec ? audioDurationSec * 1000 : null;
  const startMs = totalAudioMs ? Math.max(200, totalAudioMs * 0.03) : 200;
  // Aim for all lines to be visible by ~55% of the audio so the alumno can
  // read the full board while Matilda is still talking, not at the very end.
  const endMs = totalAudioMs ? totalAudioMs * 0.55 : 200 + lines.length * 180;

  const contentIdx: number[] = [];
  lines.forEach((l, i) => { if (l.trim() !== '') contentIdx.push(i); });
  const N = contentIdx.length;

  const result = new Array(lines.length).fill(startMs);
  if (N === 0) return result;
  if (N === 1) {
    result[contentIdx[0]] = startMs;
    return result;
  }

  const span = Math.max(0, endMs - startMs);
  const step = span / (N - 1);
  contentIdx.forEach((lineIdx, k) => {
    result[lineIdx] = Math.round(startMs + k * step);
  });
  return result;
}
