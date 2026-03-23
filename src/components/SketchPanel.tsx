/**
 * ⚒️ La Forja — Sketch Panel
 * ============================
 * 2D drawing panel for sketch-first workflow.
 * SVG canvas with rectangle and circle tools.
 * Snap to grid (0.25 units). Draw → set extrude distance → create solid.
 */

import React, { useState, useRef, useCallback } from 'react';
import type { SketchShape, SketchRect, SketchCircle, SketchPlane } from '@/lib/sketch-engine';
import { PLANE_LABELS, PLANE_COLORS, PLANE_AXES } from '@/lib/sketch-engine';

type SketchTool = 'rect' | 'circle';

interface SketchPanelProps {
  plane: SketchPlane;
  onFinish: (shapes: SketchShape[], extrudeDistance: number) => void;
  onCancel: () => void;
}

let _sketchId = 0;
function sketchUid() { return `sk${++_sketchId}`; }

function snap(v: number, gridSize = 0.25): number {
  return Math.round(v / gridSize) * gridSize;
}

export default function SketchPanel({ plane, onFinish, onCancel }: SketchPanelProps) {
  const [tool, setTool] = useState<SketchTool>('rect');
  const [shapes, setShapes] = useState<SketchShape[]>([]);
  const [drawing, setDrawing] = useState<{ startX: number; startY: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [extrudeDistance, setExtrudeDistance] = useState(1);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const VB = 6; // viewBox: -3 to 3
  const GRID = 0.5;

  const screenToSVG = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = VB / rect.width;
    const scaleY = VB / rect.height;
    return {
      x: snap((e.clientX - rect.left) * scaleX - VB / 2),
      y: snap(VB / 2 - (e.clientY - rect.top) * scaleY),
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pt = screenToSVG(e);
    setDrawing({ startX: pt.x, startY: pt.y });
  }, [screenToSVG]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setCursor(screenToSVG(e));
  }, [screenToSVG]);

  const handleMouseUp = useCallback(() => {
    if (!drawing) return;
    if (tool === 'rect') {
      const w = Math.abs(cursor.x - drawing.startX);
      const h = Math.abs(cursor.y - drawing.startY);
      if (w > 0.05 && h > 0.05) {
        const cx = (drawing.startX + cursor.x) / 2;
        const cy = (drawing.startY + cursor.y) / 2;
        setShapes(prev => [...prev, { kind: 'rect', id: sketchUid(), cx, cy, width: w, height: h } as SketchRect]);
      }
    } else {
      const dx = cursor.x - drawing.startX;
      const dy = cursor.y - drawing.startY;
      const r = snap(Math.sqrt(dx * dx + dy * dy));
      if (r > 0.05) {
        setShapes(prev => [...prev, { kind: 'circle', id: sketchUid(), cx: drawing.startX, cy: drawing.startY, radius: r } as SketchCircle]);
      }
    }
    setDrawing(null);
  }, [drawing, tool, cursor]);

  const deleteShape = (id: string) => {
    setShapes(prev => prev.filter(s => s.id !== id));
    if (selectedShapeId === id) setSelectedShapeId(null);
  };

  // ── Preview shape while drawing ──
  const previewShape = drawing ? (() => {
    if (tool === 'rect') {
      const left = Math.min(drawing.startX, cursor.x);
      const top = Math.max(drawing.startY, cursor.y);
      const w = Math.abs(cursor.x - drawing.startX);
      const h = Math.abs(cursor.y - drawing.startY);
      return <rect x={left} y={-top} width={w} height={h}
        fill="#c9a84c" fillOpacity={0.12} stroke="#c9a84c" strokeWidth={0.02} strokeDasharray="0.05 0.05" />;
    } else {
      const r = Math.sqrt((cursor.x - drawing.startX) ** 2 + (cursor.y - drawing.startY) ** 2);
      return <circle cx={drawing.startX} cy={-drawing.startY} r={r}
        fill="#c9a84c" fillOpacity={0.12} stroke="#c9a84c" strokeWidth={0.02} strokeDasharray="0.05 0.05" />;
    }
  })() : null;

  const [axisH, axisV] = PLANE_AXES[plane];

  // ── Grid lines ──
  const gridLines: React.ReactElement[] = [];
  const steps = Math.floor(VB / GRID) + 1;
  for (let i = 0; i < steps; i++) {
    const v = -VB / 2 + i * GRID;
    gridLines.push(
      <line key={`gv${i}`} x1={v} y1={-VB / 2} x2={v} y2={VB / 2} stroke="rgba(255,255,255,0.05)" strokeWidth={0.008} />,
      <line key={`gh${i}`} x1={-VB / 2} y1={v} x2={VB / 2} y2={v} stroke="rgba(255,255,255,0.05)" strokeWidth={0.008} />,
    );
  }

  return (
    <aside className="w-80 flex flex-col shrink-0 z-10 animate-slideUp" style={{ background: 'rgba(8,9,13,0.80)', borderLeft: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
      {/* Header */}
      <div className="px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: PLANE_COLORS[plane] }} />
          <h2 className="text-[12px] font-semibold text-[#f0ece4]">Sketch — {PLANE_LABELS[plane]}</h2>
        </div>
        <p className="text-[10px] text-[#4a4035] mt-1">Dibuja perfiles 2D, luego extruye para crear sólidos</p>
      </div>

      {/* Tools */}
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {(['rect', 'circle'] as const).map(t => (
          <button key={t} onClick={() => setTool(t)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] transition-all ${
              tool === t ? 'bg-[#c9a84c]/10 text-[#c9a84c] ring-1 ring-[#c9a84c]/20' : 'text-[#6b6050] hover:text-[#f0ece4] hover:bg-white/[0.03]'
            }`}>
            {t === 'rect' ? '■ Rectángulo' : '● Círculo'}
          </button>
        ))}
      </div>

      {/* SVG Canvas */}
      <div className="flex-1 px-2 py-2 min-h-0">
        <div className="w-full h-full rounded-xl overflow-hidden relative" style={{ background: 'rgba(8,9,13,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <svg
            ref={svgRef}
            viewBox={`${-VB / 2} ${-VB / 2} ${VB} ${VB}`}
            className="w-full h-full cursor-crosshair select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setDrawing(null)}
          >
            {/* Grid */}
            {gridLines}

            {/* Axes */}
            <line x1={-VB / 2} y1={0} x2={VB / 2} y2={0} stroke="#e53e3e" strokeWidth={0.018} opacity={0.5} />
            <line x1={0} y1={-VB / 2} x2={0} y2={VB / 2} stroke="#38a169" strokeWidth={0.018} opacity={0.5} />
            <text x={VB / 2 - 0.25} y={0.18} fill="#e53e3e" fontSize={0.18} opacity={0.7} fontFamily="Inter">{axisH}</text>
            <text x={0.08} y={-VB / 2 + 0.25} fill="#38a169" fontSize={0.18} opacity={0.7} fontFamily="Inter">{axisV}</text>

            {/* Origin dot */}
            <circle cx={0} cy={0} r={0.04} fill="#c9a84c" opacity={0.8} />

            {/* Completed shapes */}
            {shapes.map(s => {
              const isSel = s.id === selectedShapeId;
              const sc = isSel ? '#e2c97e' : '#c9a84c';
              if (s.kind === 'rect') {
                const r = s as SketchRect;
                return (
                  <g key={s.id} onClick={(e) => { e.stopPropagation(); setSelectedShapeId(s.id); }} className="cursor-pointer">
                    <rect x={r.cx - r.width / 2} y={-(r.cy + r.height / 2)} width={r.width} height={r.height}
                      fill="#c9a84c" fillOpacity={0.06} stroke={sc} strokeWidth={isSel ? 0.03 : 0.02} />
                    {/* Dimension labels */}
                    <text x={r.cx} y={-(r.cy + r.height / 2) - 0.06} textAnchor="middle" fill="#888" fontSize={0.13} fontFamily="JetBrains Mono">
                      {r.width.toFixed(2)}
                    </text>
                    <text x={r.cx + r.width / 2 + 0.06} y={-r.cy + 0.05} textAnchor="start" fill="#888" fontSize={0.13} fontFamily="JetBrains Mono">
                      {r.height.toFixed(2)}
                    </text>
                  </g>
                );
              } else {
                const c = s as SketchCircle;
                return (
                  <g key={s.id} onClick={(e) => { e.stopPropagation(); setSelectedShapeId(s.id); }} className="cursor-pointer">
                    <circle cx={c.cx} cy={-c.cy} r={c.radius}
                      fill="#c9a84c" fillOpacity={0.06} stroke={sc} strokeWidth={isSel ? 0.03 : 0.02} />
                    {/* Radius label */}
                    <line x1={c.cx} y1={-c.cy} x2={c.cx + c.radius} y2={-c.cy} stroke="#666" strokeWidth={0.008} strokeDasharray="0.03 0.03" />
                    <text x={c.cx + c.radius / 2} y={-c.cy - 0.06} textAnchor="middle" fill="#888" fontSize={0.13} fontFamily="JetBrains Mono">
                      R{c.radius.toFixed(2)}
                    </text>
                  </g>
                );
              }
            })}

            {/* Drawing preview */}
            {previewShape}

            {/* Cursor indicator while drawing */}
            {drawing && (
              <g opacity={0.35}>
                <line x1={cursor.x - 0.12} y1={-cursor.y} x2={cursor.x + 0.12} y2={-cursor.y} stroke="#fff" strokeWidth={0.01} />
                <line x1={cursor.x} y1={-cursor.y - 0.12} x2={cursor.x} y2={-cursor.y + 0.12} stroke="#fff" strokeWidth={0.01} />
              </g>
            )}
          </svg>

          {/* Corner hints */}
          <div className="absolute bottom-1.5 left-2 text-[9px] text-[#4a4035] pointer-events-none">
            Clic y arrastra para dibujar · Snap: {GRID}
          </div>
          <div className="absolute top-1.5 right-2 text-[9px] text-[#4a4035] pointer-events-none font-mono">
            {cursor.x.toFixed(2)}, {cursor.y.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Shapes list */}
      {shapes.length > 0 && (
        <div className="px-4 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-[9px] text-[#4a4035] uppercase tracking-wider mb-1 font-medium">Perfiles ({shapes.length})</div>
          <div className="space-y-0.5 max-h-24 overflow-y-auto">
            {shapes.map(s => (
              <div key={s.id}
                className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg cursor-pointer transition-all ${
                  s.id === selectedShapeId ? 'bg-[#c9a84c]/10 text-[#c9a84c]' : 'text-[#8a7e6b] hover:bg-white/[0.03]'
                }`}
                onClick={() => setSelectedShapeId(s.id)}>
                <span className="text-[11px]">{s.kind === 'rect' ? '■' : '●'}</span>
                <span className="flex-1 font-mono text-[9px]">
                  {s.kind === 'rect'
                    ? `Rect ${(s as SketchRect).width.toFixed(2)} × ${(s as SketchRect).height.toFixed(2)}`
                    : `Círculo R${(s as SketchCircle).radius.toFixed(2)}`}
                </span>
                <button onClick={(e) => { e.stopPropagation(); deleteShape(s.id); }}
                  className="text-[#4a4035] hover:text-red-400 text-[10px] transition-all">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extrude Controls */}
      <div className="px-4 py-3 space-y-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="text-[10px] text-[#4a4035] uppercase tracking-wider flex items-center gap-1.5 font-medium">
          <span className="text-[#c9a84c]">▤</span> Extrusión
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#6b6050] w-14 shrink-0">Distancia</span>
          <input type="range" min={0.1} max={5} step={0.05} value={extrudeDistance}
            onChange={e => setExtrudeDistance(parseFloat(e.target.value))}
            className="flex-1 h-1 appearance-none bg-white/[0.06] rounded-full cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#c9a84c]
              [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(201,168,76,0.3)]" />
          <input type="number" min={0.1} max={10} step={0.05} value={extrudeDistance}
            onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setExtrudeDistance(v); }}
            className="w-14 rounded-lg px-2 py-1 text-right
              font-mono text-[11px] text-[#f0ece4] outline-none
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{ background: 'rgba(8,9,13,0.5)', border: '1px solid rgba(255,255,255,0.06)' }} />
          <span className="text-[10px] text-[#4a4035]">mm</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex gap-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-[12px] text-[#8a7e6b] hover:text-[#f0ece4] transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          Cancelar
        </button>
        <button
          onClick={() => shapes.length > 0 && onFinish(shapes, extrudeDistance)}
          disabled={shapes.length === 0}
          className="flex-1 py-2 rounded-lg text-[12px] font-medium bg-[#c9a84c] text-white hover:bg-[#3d8aee]
            transition-all disabled:opacity-25 disabled:cursor-not-allowed" style={{ boxShadow: '0 0 16px rgba(201,168,76,0.2)' }}>
          ▤ Extruir → Crear
        </button>
      </div>
    </aside>
  );
}
