/**
 * ⚒️ Blueprint Panel — Extracción de Planos
 * Canvas-based 2D cross-section visualization with pan/zoom
 * Reads viz-data JSON from public/viz-data/
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface VizIndex {
  slug: string;
  fileName: string;
  diagonal: number;
  revolution: boolean;
  featureCount: number;
  rawEntities: number;
  features: Record<string, number>;
  base: string | null;
}

interface VizEntity {
  type: 'line' | 'arc' | 'circle';
  start?: [number, number];
  end?: [number, number];
  center?: [number, number];
  radius?: number;
  startAngle?: number;
  endAngle?: number;
}

interface VizProfile {
  type: string;
  isHole: boolean;
  area: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  centroid: { x: number; y: number };
  planeLabel: string;
  normal: number[];
  offset: number;
  radius?: number;
  rectWidth?: number;
  rectHeight?: number;
  cornerRadius?: number;
  entities: VizEntity[];
}

interface VizSlice {
  label: string;
  normal: number[];
  offset: number;
  contours: { points: [number, number][]; area: number }[];
}

interface VizFeature {
  type: string;
  label: string;
  params?: Record<string, any>;
  confidence?: number;
  normal?: number[];
  centroid?: { x: number; y: number };
  depth?: number;
  sliceCount?: number;
  count?: number;
  children?: { type: string; label: string; params?: Record<string, any>; centroid?: { x: number; y: number } }[];
}

interface VizData {
  fileName: string;
  boundingBox: { min: number[]; max: number[] };
  diagonal: number;
  revolution: { axisLabel: string; score: number } | null;
  directions: { label: string; normal: number[]; areaPct: number; offsetRange: number[]; isAxis: boolean }[];
  slices: VizSlice[];
  profiles: VizProfile[];
  features: VizFeature[];
  base: { type: string; label: string; area: number; normal: number[] } | null;
}

const GOLD = '#c9a84c';
const TEXT = '#f0ece4';
const DIM = '#4a4035';
const BG = '#0d0f14';
const PANEL_BG = 'rgba(24,28,38,0.97)';

const TYPE_COLORS: Record<string, string> = {
  circle: '#60a5fa',
  hole: '#f87171',
  slot: '#facc15',
  rect_pocket: '#4ade80',
  fillet_pocket: '#4ade80',
  polygon_pocket: '#c084fc',
  fillet_rect: '#4ade80',
  boss: '#60a5fa',
  freeform_pocket: '#6b7280',
  freeform_boss: '#6b7280',
  keyhole: '#f472b6',
};

const FEATURE_ICONS: Record<string, string> = {
  hole: '⊙',
  slot: '⊂⊃',
  rect_pocket: '▭',
  fillet_pocket: '▭',
  polygon_pocket: '△',
  boss: '▣',
  base_body: '█',
  revolution: '◎',
  pattern_circular: '⊙×',
  pattern_linear: '→×',
  freeform_pocket: '~',
  freeform_boss: '~',
  keyhole: '⊙⊂',
};

interface BlueprintPanelProps {
  onClose: () => void;
}

export default function BlueprintPanel({ onClose }: BlueprintPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [index, setIndex] = useState<VizIndex[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [vizData, setVizData] = useState<VizData | null>(null);
  const [selectedSlice, setSelectedSlice] = useState(0);
  const [showFeatures, setShowFeatures] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  // Force re-render counter for canvas
  const [drawTick, setDrawTick] = useState(0);

  // Pan/zoom state
  const transformRef = useRef({ ox: 0, oy: 0, scale: 1 });
  const dragRef = useRef<{ startX: number; startY: number; startOx: number; startOy: number } | null>(null);

  // Load index
  useEffect(() => {
    console.log('[BlueprintPanel] Fetching index...');
    fetch('/viz-data/index.json')
      .then(r => {
        console.log('[BlueprintPanel] Index response:', r.status);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: VizIndex[]) => {
        console.log('[BlueprintPanel] Index loaded:', data.length, 'models');
        setIndex(data);
        if (data.length > 0) setSelectedSlug(data[0].slug);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[BlueprintPanel] Index fetch failed:', err);
        setError(`No se encontró el índice de planos. Ejecuta la extracción primero.`);
        setLoading(false);
      });
  }, []);

  // Load selected model data
  useEffect(() => {
    if (!selectedSlug) return;
    console.log('[BlueprintPanel] Loading model:', selectedSlug);
    setVizData(null);
    fetch(`/viz-data/${encodeURIComponent(selectedSlug)}.json`)
      .then(r => {
        console.log('[BlueprintPanel] Model response:', r.status);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: VizData) => {
        console.log('[BlueprintPanel] Model loaded:', data.fileName, '| slices:', data.slices?.length, '| profiles:', data.profiles?.length);
        setVizData(data);
        setSelectedSlice(0);
        transformRef.current = { ox: 0, oy: 0, scale: 1 };
        // Trigger a canvas redraw after data loads
        setTimeout(() => setDrawTick(t => t + 1), 50);
      })
      .catch((err) => { console.error('[BlueprintPanel] Model fetch failed:', err); setVizData(null); });
  }, [selectedSlug]);

  // ── Canvas rendering ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !vizData) { console.log('[BlueprintPanel] draw() skip — canvas:', !!canvas, 'vizData:', !!vizData); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { console.log('[BlueprintPanel] draw() — no ctx'); return; }

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    console.log('[BlueprintPanel] draw() — rect:', rect.width, 'x', rect.height, '| slice:', selectedSlice);
    if (rect.width === 0 || rect.height === 0) return; // not mounted yet
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width;
    const H = rect.height;

    // Clear
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Get current slice
    const slice = vizData.slices[selectedSlice];
    if (!slice || slice.contours.length === 0) {
      ctx.fillStyle = DIM;
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sin contornos en este corte', W / 2, H / 2);
      return;
    }

    // Compute bounding box of all contour points
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of slice.contours) {
      for (const [x, y] of c.points) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    const dataW = maxX - minX || 1;
    const dataH = maxY - minY || 1;
    const centX = (minX + maxX) / 2;
    const centY = (minY + maxY) / 2;
    const baseScale = Math.min((W - 80) / dataW, (H - 80) / dataH);
    const { ox, oy, scale } = transformRef.current;
    const totalScale = baseScale * scale;

    const toScreen = (x: number, y: number): [number, number] => [
      W / 2 + (x - centX) * totalScale + ox,
      H / 2 - (y - centY) * totalScale + oy,
    ];

    // Grid
    ctx.strokeStyle = 'rgba(201,168,76,0.06)';
    ctx.lineWidth = 0.5;
    const gridStep = Math.pow(10, Math.floor(Math.log10(Math.max(dataW, dataH) / 4)));
    for (let gx = Math.floor(minX / gridStep) * gridStep; gx <= maxX + gridStep; gx += gridStep) {
      const [sx] = toScreen(gx, 0);
      if (sx >= 0 && sx <= W) { ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke(); }
    }
    for (let gy = Math.floor(minY / gridStep) * gridStep; gy <= maxY + gridStep; gy += gridStep) {
      const [, sy] = toScreen(0, gy);
      if (sy >= 0 && sy <= H) { ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke(); }
    }

    // Draw contours (raw polygon)
    for (const c of slice.contours) {
      if (c.points.length < 2) continue;
      ctx.strokeStyle = 'rgba(201,168,76,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const [x0, y0] = toScreen(c.points[0][0], c.points[0][1]);
      ctx.moveTo(x0, y0);
      for (let i = 1; i < c.points.length; i++) {
        const [x, y] = toScreen(c.points[i][0], c.points[i][1]);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(201,168,76,0.03)';
      ctx.fill();
    }

    // Draw fitted entities (profiles for this slice)
    const sliceProfiles = vizData.profiles.filter(p => p.planeLabel === slice.label);
    for (const prof of sliceProfiles) {
      const color = TYPE_COLORS[prof.type] || GOLD;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';

      for (const ent of prof.entities) {
        if (ent.type === 'line' && ent.start && ent.end) {
          const [x1, y1] = toScreen(ent.start[0], ent.start[1]);
          const [x2, y2] = toScreen(ent.end[0], ent.end[1]);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Dimension: line length
          if (showDimensions) {
            const len = Math.sqrt((ent.end[0] - ent.start[0]) ** 2 + (ent.end[1] - ent.start[1]) ** 2);
            if (len > dataW * 0.05) { // Only show for significant lines
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              ctx.fillStyle = 'rgba(240,236,228,0.7)';
              ctx.font = '9px JetBrains Mono, monospace';
              ctx.textAlign = 'center';
              ctx.fillText(`${len.toFixed(2)}`, mx, my - 6);
            }
          }
        } else if (ent.type === 'circle' && ent.center && ent.radius) {
          const [cx2, cy2] = toScreen(ent.center[0], ent.center[1]);
          const r = ent.radius * totalScale;
          ctx.beginPath();
          ctx.arc(cx2, cy2, Math.max(r, 2), 0, Math.PI * 2);
          ctx.stroke();

          // Center crosshair
          ctx.strokeStyle = 'rgba(201,168,76,0.3)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(cx2 - 4, cy2); ctx.lineTo(cx2 + 4, cy2);
          ctx.moveTo(cx2, cy2 - 4); ctx.lineTo(cx2, cy2 + 4);
          ctx.stroke();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;

          // Dimension label
          if (showDimensions) {
            const diam = (ent.radius * 2).toFixed(2);
            ctx.fillStyle = color;
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`ø${diam}`, cx2, cy2 - r - 8);
          }
        } else if (ent.type === 'arc' && ent.center && ent.radius != null && ent.startAngle != null && ent.endAngle != null) {
          const [cx2, cy2] = toScreen(ent.center[0], ent.center[1]);
          const r = ent.radius * totalScale;
          ctx.beginPath();
          ctx.arc(cx2, cy2, Math.max(r, 2), -ent.endAngle, -ent.startAngle);
          ctx.stroke();
        }
      }

      // Profile dimension labels (rect width × height)
      if (showDimensions && prof.rectWidth && prof.rectHeight) {
        const [px, py] = toScreen(prof.centroid.x, prof.centroid.y);
        ctx.fillStyle = 'rgba(240,236,228,0.6)';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${prof.rectWidth.toFixed(1)}×${prof.rectHeight.toFixed(1)}`, px, py - 6);
      }
    }

    // Info overlay (top-left)
    const pad = 14;
    ctx.fillStyle = 'rgba(8,9,13,0.7)';
    ctx.fillRect(0, 0, 300, 78);
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(vizData.fileName, pad, 22);
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillStyle = TEXT;
    ctx.fillText(`Corte ${selectedSlice + 1}/${vizData.slices.length}: ${slice.label}`, pad, 40);
    ctx.fillStyle = DIM;
    ctx.fillText(`n=[${slice.normal.map(v => v.toFixed(2)).join(',')}]  d=${slice.offset.toFixed(3)}`, pad, 56);
    const numC = slice.contours.length;
    const numP = sliceProfiles.length;
    ctx.fillText(`${numC} contorno${numC !== 1 ? 's' : ''} · ${numP} perfil${numP !== 1 ? 'es' : ''}`, pad, 72);
  }, [vizData, selectedSlice, showDimensions, drawTick]);

  // Redraw when data/slice changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => { requestAnimationFrame(draw); });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  // Mouse handlers for pan/zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    transformRef.current.scale = Math.max(0.1, Math.min(50, transformRef.current.scale * factor));
    requestAnimationFrame(draw);
  }, [draw]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOx: transformRef.current.ox,
      startOy: transformRef.current.oy,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    transformRef.current.ox = dragRef.current.startOx + (e.clientX - dragRef.current.startX);
    transformRef.current.oy = dragRef.current.startOy + (e.clientY - dragRef.current.startY);
    requestAnimationFrame(draw);
  }, [draw]);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  // Prev/Next slice
  const prevSlice = useCallback(() => {
    if (!vizData) return;
    setSelectedSlice(s => (s > 0 ? s - 1 : vizData.slices.length - 1));
    transformRef.current = { ox: 0, oy: 0, scale: 1 };
  }, [vizData]);

  const nextSlice = useCallback(() => {
    if (!vizData) return;
    setSelectedSlice(s => (s < vizData.slices.length - 1 ? s + 1 : 0));
    transformRef.current = { ox: 0, oy: 0, scale: 1 };
  }, [vizData]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') prevSlice();
      if (e.key === 'ArrowRight' || e.key === 'd') nextSlice();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevSlice, nextSlice, onClose]);

  // ── Render ──
  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,9,13,0.92)', backdropFilter: 'blur(12px)' }}>
        <div style={{ color: GOLD, fontSize: 14 }} className="animate-pulse">⚒️ Cargando planos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,9,13,0.92)', backdropFilter: 'blur(12px)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#f87171', fontSize: 14, marginBottom: 12 }}>{error}</div>
          <button onClick={onClose} style={{ color: DIM, fontSize: 11, padding: '4px 12px', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}>Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', background: 'rgba(8,9,13,0.95)', backdropFilter: 'blur(16px)' }}>
      {/* LEFT SIDEBAR — Model list + Features */}
      <div style={{ width: 288, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(201,168,76,0.12)', background: PANEL_BG, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📐</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: '0.06em' }}>EXTRACCIÓN DE PLANOS</span>
          </div>
          <button onClick={onClose}
            style={{ fontSize: 14, color: DIM, padding: '2px 6px', borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = DIM)}>
            ✕
          </button>
        </div>

        {/* Model selector */}
        <div style={{ padding: 8, borderBottom: '1px solid rgba(201,168,76,0.08)', maxHeight: 180, overflowY: 'auto' }}>
          <div style={{ fontSize: 9, color: '#8a7e6b', padding: '0 4px', marginBottom: 4, letterSpacing: '0.06em' }}>MODELOS ({index?.length})</div>
          {index?.map(m => (
            <button
              key={m.slug}
              onClick={() => setSelectedSlug(m.slug)}
              style={{
                width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 8, fontSize: 10, border: 'none', cursor: 'pointer', display: 'block', marginBottom: 2,
                background: m.slug === selectedSlug ? 'rgba(201,168,76,0.1)' : 'transparent',
                color: m.slug === selectedSlug ? GOLD : '#8a7e6b',
              }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.fileName}</div>
              <div style={{ fontSize: 9, opacity: 0.6 }}>
                {m.revolution ? '◎ Rev' : '▬ Prismático'} · {m.featureCount ?? 0} features · ø{(m.diagonal ?? 0).toFixed(0)}mm
              </div>
            </button>
          ))}
        </div>

        {/* Slice navigator */}
        {vizData && (
          <div style={{ padding: 8, borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
            <div style={{ fontSize: 9, color: '#8a7e6b', padding: '0 4px', marginBottom: 4, letterSpacing: '0.06em' }}>CORTES ({vizData.slices.length})</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px' }}>
              <button onClick={prevSlice} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 13, color: GOLD, background: 'transparent', border: 'none', cursor: 'pointer' }}>◀</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: TEXT, fontWeight: 600 }}>{vizData.slices[selectedSlice]?.label}</div>
                <div style={{ fontSize: 8, color: DIM }}>{selectedSlice + 1} / {vizData.slices.length}</div>
              </div>
              <button onClick={nextSlice} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 13, color: GOLD, background: 'transparent', border: 'none', cursor: 'pointer' }}>▶</button>
            </div>
            {/* Slice list */}
            <div style={{ marginTop: 4, maxHeight: 100, overflowY: 'auto' }}>
              {vizData.slices.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedSlice(i); transformRef.current = { ox: 0, oy: 0, scale: 1 }; setDrawTick(t => t + 1); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '2px 8px', borderRadius: 4, fontSize: 9, border: 'none', cursor: 'pointer', display: 'block',
                    background: i === selectedSlice ? 'rgba(201,168,76,0.1)' : 'transparent',
                    color: i === selectedSlice ? GOLD : DIM,
                  }}>
                  {s.label} <span style={{ opacity: 0.5 }}>({s.contours.length}c)</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Features list */}
        {vizData && showFeatures && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            <div style={{ fontSize: 9, color: '#8a7e6b', padding: '0 4px', marginBottom: 4, letterSpacing: '0.06em' }}>
              FEATURES ({vizData.features.length}{vizData.base ? ' + base' : ''})
            </div>
            {vizData.base && (
              <div style={{ padding: '4px 8px', borderRadius: 8, fontSize: 10, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.1)', marginBottom: 4, color: TEXT }}>
                <span style={{ color: '#60a5fa' }}>█</span> {vizData.base.label}
              </div>
            )}
            {vizData.features.map((f, i) => {
              const icon = FEATURE_ICONS[f.type] || '?';
              const isPattern = f.type.startsWith('pattern_');
              return (
                <div key={i} style={{ padding: '4px 8px', borderRadius: 8, fontSize: 10, color: TEXT }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: isPattern ? '#c084fc' : GOLD }}>{icon}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.label}</span>
                    {f.confidence != null && (
                      <span style={{ fontSize: 8, color: f.confidence > 0.7 ? '#4ade80' : '#facc15', flexShrink: 0 }}>
                        {(f.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  {isPattern && f.count && (
                    <div style={{ fontSize: 8, color: 'rgba(192,132,252,0.6)', paddingLeft: 20 }}>×{f.count} instancias</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom controls */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(201,168,76,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#8a7e6b', cursor: 'pointer' }}>
            <input type="checkbox" checked={showFeatures} onChange={e => setShowFeatures(e.target.checked)} style={{ width: 12, height: 12, accentColor: GOLD }} />
            Features
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#8a7e6b', cursor: 'pointer' }}>
            <input type="checkbox" checked={showDimensions} onChange={e => setShowDimensions(e.target.checked)} style={{ width: 12, height: 12, accentColor: GOLD }} />
            Cotas
          </label>
        </div>

        {/* Stats */}
        {vizData && (
          <div style={{ padding: '6px 12px', borderTop: '1px solid rgba(201,168,76,0.08)', fontSize: 9, color: DIM }}>
            {vizData.revolution && <span style={{ color: '#c084fc' }}>◎ Rev {vizData.revolution.axisLabel}-axis ({(vizData.revolution.score * 100).toFixed(0)}%) · </span>}
            ø{(vizData.diagonal ?? 0).toFixed(1)}mm · {vizData.directions?.length ?? 0} dirs · {vizData.profiles?.length ?? 0} perfiles
          </div>
        )}
      </div>

      {/* CENTER — Canvas viewport */}
      <div style={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Loading state for model data */}
        {!vizData && selectedSlug && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: GOLD, fontSize: 13 }} className="animate-pulse">Cargando modelo...</div>
          </div>
        )}

        {/* Keyboard hint */}
        <div style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 9, color: DIM, pointerEvents: 'none' }}>
          ← → navegar cortes · scroll zoom · arrastrar pan · ESC cerrar
        </div>
      </div>
    </div>
  );
}
