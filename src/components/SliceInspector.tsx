/**
 * ⚒️ Slice Inspector — Debug Visualizer for Contour Fitting
 * Shows raw marching-squares points vs fitted entities (lines, arcs, circles)
 * in a 2D canvas overlay. Click-driven from SweepPanel or manual depth control.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import type { SketchEntity, SketchArc, FittedSlice, FittedContour } from '@/lib/sketch-fitting';

export interface SliceInspectorProps {
  /** The fitted slice to inspect */
  slice: FittedSlice;
  /** All slices (for navigation) */
  allSlices: FittedSlice[];
  /** Current slice index */
  sliceIndex: number;
  /** Close callback */
  onClose: () => void;
  /** Navigate to a specific slice */
  onNavigate: (index: number) => void;
}

// Colors
const COL_POINTS = '#22c55e';   // green for raw points
const COL_LINE   = '#f0ece4';   // white for fitted lines
const COL_ARC    = '#c084fc';   // purple for fitted arcs
const COL_CIRCLE = '#c9a84c';   // gold for full circles
const COL_CENTER = '#ef4444';   // red for arc centers
const COL_GRID   = '#1e2538';
const COL_BG     = '#0d1117';

function dist2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export default function SliceInspector({ slice, allSlices, sliceIndex, onClose, onNavigate }: SliceInspectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showPoints, setShowPoints] = useState(true);
  const [showEntities, setShowEntities] = useState(true);
  const [showCenters, setShowCenters] = useState(false);
  const [selectedContour, setSelectedContour] = useState<number>(-1); // -1 = all

  const contours = slice.contours;
  const label = `${slice.axis} @${slice.value.toFixed(2)}`;
  const onPrev = sliceIndex > 0 ? () => onNavigate(sliceIndex - 1) : undefined;
  const onNext = sliceIndex < allSlices.length - 1 ? () => onNavigate(sliceIndex + 1) : undefined;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const pad = 40;

    // Compute bounding box of all points
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const c of contours) {
      for (const p of c.originalPoints) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
      }
    }
    if (!isFinite(xMin)) return;

    const dw = xMax - xMin || 1;
    const dh = yMax - yMin || 1;
    const aspect = dw / dh;
    const drawW = W - pad * 2;
    const drawH = H - pad * 2;
    let scale: number, offX: number, offY: number;
    if (aspect > drawW / drawH) {
      scale = drawW / dw;
      offX = pad;
      offY = pad + (drawH - dh * scale) / 2;
    } else {
      scale = drawH / dh;
      offX = pad + (drawW - dw * scale) / 2;
      offY = pad;
    }

    const tx = (x: number) => offX + (x - xMin) * scale;
    const ty = (y: number) => H - (offY + (y - yMin) * scale); // flip Y

    // Clear
    ctx.fillStyle = COL_BG;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = COL_GRID;
    ctx.lineWidth = 0.5;
    const gridStep = Math.pow(10, Math.floor(Math.log10(dw / 5)));
    for (let gx = Math.ceil(xMin / gridStep) * gridStep; gx <= xMax; gx += gridStep) {
      const px = tx(gx);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    }
    for (let gy = Math.ceil(yMin / gridStep) * gridStep; gy <= yMax; gy += gridStep) {
      const py = ty(gy);
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
    }

    // Filter contours
    const visible = selectedContour === -1
      ? contours
      : contours[selectedContour] ? [contours[selectedContour]] : contours;

    // ── Draw raw points ──
    if (showPoints) {
      for (const c of visible) {
        ctx.fillStyle = COL_POINTS;
        const r = Math.max(1, Math.min(3, 400 / c.originalPoints.length));
        for (const p of c.originalPoints) {
          ctx.beginPath();
          ctx.arc(tx(p.x), ty(p.y), r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Connect with thin line
        if (c.originalPoints.length > 1) {
          ctx.strokeStyle = `${COL_POINTS}40`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(tx(c.originalPoints[0].x), ty(c.originalPoints[0].y));
          for (let i = 1; i < c.originalPoints.length; i++) {
            ctx.lineTo(tx(c.originalPoints[i].x), ty(c.originalPoints[i].y));
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
    }

    // ── Draw fitted entities ──
    if (showEntities) {
      for (const c of visible) {
        for (const ent of c.entities) {
          if (ent.type === 'line') {
            ctx.strokeStyle = COL_LINE;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tx(ent.start.x), ty(ent.start.y));
            ctx.lineTo(tx(ent.end.x), ty(ent.end.y));
            ctx.stroke();

            // Endpoint dots
            ctx.fillStyle = COL_LINE;
            ctx.beginPath(); ctx.arc(tx(ent.start.x), ty(ent.start.y), 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(tx(ent.end.x), ty(ent.end.y), 3, 0, Math.PI * 2); ctx.fill();
          } else {
            // Arc
            const arc = ent as SketchArc;
            const isCircle = arc.isFullCircle;
            ctx.strokeStyle = isCircle ? COL_CIRCLE : COL_ARC;
            ctx.lineWidth = isCircle ? 2.5 : 2;

            const cxPx = tx(arc.center.x);
            const cyPx = ty(arc.center.y);
            const rPx = arc.radius * scale;

            ctx.beginPath();
            if (isCircle) {
              ctx.arc(cxPx, cyPx, rPx, 0, Math.PI * 2);
            } else {
              // Canvas arc is CW from positive X; our angles may be in any direction
              // We need to handle the Y-flip: canvas Y increases downward
              const sa = -arc.startAngle; // flip Y
              const ea = -arc.endAngle;
              const counterclockwise = arc.endAngle > arc.startAngle;
              ctx.arc(cxPx, cyPx, rPx, sa, ea, counterclockwise);
            }
            ctx.stroke();

            // Endpoint dots
            ctx.fillStyle = isCircle ? COL_CIRCLE : COL_ARC;
            ctx.beginPath(); ctx.arc(tx(arc.start.x), ty(arc.start.y), 3, 0, Math.PI * 2); ctx.fill();
            if (!isCircle) {
              ctx.beginPath(); ctx.arc(tx(arc.end.x), ty(arc.end.y), 3, 0, Math.PI * 2); ctx.fill();
            }

            // Center cross
            if (showCenters) {
              ctx.strokeStyle = COL_CENTER;
              ctx.lineWidth = 1;
              const cs = 5;
              ctx.beginPath(); ctx.moveTo(cxPx - cs, cyPx); ctx.lineTo(cxPx + cs, cyPx); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(cxPx, cyPx - cs); ctx.lineTo(cxPx, cyPx + cs); ctx.stroke();
            }
          }
        }
      }
    }

    // ── Stats ──
    ctx.fillStyle = '#a0947e';
    ctx.font = '12px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    const totalPts = contours.reduce((s, c) => s + c.originalPoints.length, 0);
    const totalEnts = contours.reduce((s, c) => s + c.entities.length, 0);
    const lines = contours.reduce((s, c) => s + c.entities.filter(e => e.type === 'line').length, 0);
    const arcs = contours.reduce((s, c) => s + c.entities.filter(e => e.type === 'arc' && !(e as SketchArc).isFullCircle).length, 0);
    const circles = contours.reduce((s, c) => s + c.entities.filter(e => e.type === 'arc' && (e as SketchArc).isFullCircle).length, 0);
    const avgErr = contours.length > 0 ? contours.reduce((s, c) => s + c.error.avgError, 0) / contours.length : 0;

    ctx.fillText(`${totalPts} pts → ${totalEnts} ent (${lines}L ${arcs}A ${circles}C)  err=${avgErr.toFixed(4)}`, 8, H - 8);

    if (label) {
      ctx.textAlign = 'right';
      ctx.fillText(label, W - 8, H - 8);
    }

    // Scale bar
    ctx.textAlign = 'left';
    const barWorld = gridStep;
    const barPx = barWorld * scale;
    ctx.strokeStyle = '#6a5e4e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W - pad - barPx, pad - 12); ctx.lineTo(W - pad, pad - 12); ctx.stroke();
    ctx.fillStyle = '#6a5e4e';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${barWorld}`, W - pad - barPx / 2, pad - 16);

  }, [contours, showPoints, showEntities, showCenters, selectedContour, label]);

  useEffect(() => { draw(); }, [draw]);

  // Entity count summary per contour
  const contourSummary = contours.map((c, i) => {
    const l = c.entities.filter(e => e.type === 'line').length;
    const a = c.entities.filter(e => e.type === 'arc' && !(e as SketchArc).isFullCircle).length;
    const ci = c.entities.filter(e => e.type === 'arc' && (e as SketchArc).isFullCircle).length;
    return { i, pts: c.originalPoints.length, l, a, ci, err: c.error.maxError };
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center">
      <div className="bg-base border border-border rounded-lg shadow-2xl flex flex-col max-w-[90vw] max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
          <h3 className="text-sm font-semibold text-text-1">🔬 Slice Inspector</h3>
          {label && <span className="text-[11px] text-text-3 font-mono">{label}</span>}
          <div className="ml-auto flex items-center gap-2">
            {onPrev && <button onClick={onPrev} className="text-text-3 hover:text-text-1 px-2 text-sm">◀</button>}
            {onNext && <button onClick={onNext} className="text-text-3 hover:text-text-1 px-2 text-sm">▶</button>}
            <button onClick={onClose} className="text-text-3 hover:text-text-1 px-2 text-lg">✕</button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border-sub text-[11px]">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showPoints} onChange={e => setShowPoints(e.target.checked)} className="accent-green" />
            <span style={{ color: COL_POINTS }}>Puntos</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showEntities} onChange={e => setShowEntities(e.target.checked)} className="accent-orange" />
            <span className="text-text-2">Entidades</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showCenters} onChange={e => setShowCenters(e.target.checked)} className="accent-red" />
            <span style={{ color: COL_CENTER }}>Centros</span>
          </label>
          <span className="text-text-3">│</span>
          <button
            onClick={() => setSelectedContour(-1)}
            className={`px-1.5 py-0.5 rounded ${selectedContour === -1 ? 'bg-gold/20 text-gold' : 'text-text-3 hover:text-text-2'}`}
          >
            Todos ({contours.length})
          </button>
          {contours.length <= 8 && contours.map((_, i) => (
            <button
              key={i}
              onClick={() => setSelectedContour(i)}
              className={`px-1.5 py-0.5 rounded font-mono ${selectedContour === i ? 'bg-gold/20 text-gold' : 'text-text-3 hover:text-text-2'}`}
            >
              C{i}
            </button>
          ))}
        </div>

        {/* Canvas + Entity sidebar */}
        <div className="flex">
          <canvas
            ref={canvasRef}
            width={900}
            height={700}
            className="cursor-crosshair"
            style={{ width: '900px', height: '700px' }}
          />

          {/* Entity detail sidebar */}
          <div className="w-[260px] border-l border-border-sub overflow-y-auto max-h-[700px]">
            <div className="px-3 py-2 border-b border-border-sub">
              <span className="text-[10px] text-text-3 uppercase tracking-widest font-semibold">Entidades</span>
            </div>
            {(selectedContour === -1 ? contours : contours[selectedContour] ? [contours[selectedContour]] : []).map((c, ci) => (
              <div key={ci}>
                {contours.length > 1 && selectedContour === -1 && (
                  <div className="px-3 py-1 bg-surface-up/30 text-[9px] text-text-3 font-mono border-b border-border-sub">
                    Contour {ci} — {c.originalPoints.length} pts
                  </div>
                )}
                {c.entities.map((ent, ei) => {
                  const isArc = ent.type === 'arc';
                  const arc = isArc ? ent as SketchArc : null;
                  const isCircle = arc?.isFullCircle;
                  const color = isCircle ? COL_CIRCLE : isArc ? COL_ARC : COL_LINE;
                  const sweepDeg = arc ? (Math.abs(arc.endAngle - arc.startAngle) * 180 / Math.PI) : 0;

                  return (
                    <div
                      key={`${ci}-${ei}`}
                      className="px-3 py-1.5 border-b border-border-sub/50 text-[9px] font-mono hover:bg-surface-up/50 transition-colors cursor-default"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                        <span className="text-text-2 font-semibold">
                          {isCircle ? 'Circle' : isArc ? 'Arc' : 'Line'}
                        </span>
                        <span className="text-text-3 ml-auto">#{ei}</span>
                      </div>
                      {ent.type === 'line' ? (
                        <div className="text-text-3 mt-0.5 pl-3.5 space-y-0.5">
                          <div>S: ({ent.start.x.toFixed(3)}, {ent.start.y.toFixed(3)})</div>
                          <div>E: ({ent.end.x.toFixed(3)}, {ent.end.y.toFixed(3)})</div>
                          <div>L: {dist2d(ent.start, ent.end).toFixed(4)}</div>
                        </div>
                      ) : arc && (
                        <div className="text-text-3 mt-0.5 pl-3.5 space-y-0.5">
                          <div>C: ({arc.center.x.toFixed(3)}, {arc.center.y.toFixed(3)})</div>
                          <div>R: {arc.radius.toFixed(4)}</div>
                          {!isCircle && <div>Sweep: {sweepDeg.toFixed(1)}°</div>}
                          {!isCircle && (
                            <>
                              <div>S: ({arc.start.x.toFixed(3)}, {arc.start.y.toFixed(3)})</div>
                              <div>E: ({arc.end.x.toFixed(3)}, {arc.end.y.toFixed(3)})</div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Contour table */}
        {contours.length > 1 && (
          <div className="px-4 py-2 border-t border-border-sub max-h-[120px] overflow-y-auto">
            <table className="w-full text-[10px] font-mono text-text-3">
              <thead>
                <tr className="text-text-2">
                  <th className="text-left w-8">#</th>
                  <th className="text-right w-12">Pts</th>
                  <th className="text-right w-10">L</th>
                  <th className="text-right w-10">A</th>
                  <th className="text-right w-10">⊙</th>
                  <th className="text-right w-16">Error</th>
                </tr>
              </thead>
              <tbody>
                {contourSummary.map(cs => (
                  <tr
                    key={cs.i}
                    onClick={() => setSelectedContour(cs.i === selectedContour ? -1 : cs.i)}
                    className={`cursor-pointer hover:bg-surface-up ${selectedContour === cs.i ? 'text-gold' : ''}`}
                  >
                    <td>C{cs.i}</td>
                    <td className="text-right">{cs.pts}</td>
                    <td className="text-right">{cs.l}</td>
                    <td className="text-right">{cs.a}</td>
                    <td className="text-right">{cs.ci}</td>
                    <td className="text-right">{cs.err.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
