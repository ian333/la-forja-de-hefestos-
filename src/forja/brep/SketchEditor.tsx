/**
 * ⚒️ La Forja — EDITOR DE CROQUIS 2D INTERACTIVO
 * ===============================================
 * El humano DIBUJA clicando en el plano (línea / rectángulo / círculo), aplica
 * restricciones y cotas, y el croquis se RESUELVE en vivo: pasa de AZUL (sub-
 * restringido, se puede mover) a NEGRO (totalmente definido, clavado) — igual que
 * Fusion. Encima del solver puro (sketch-solver.ts). Al Terminar, el perfil cerrado
 * alimenta el Extrude. Esto reemplaza las "plantillas": ya no eliges una figura,
 * la dibujas.
 *
 * SVG en vez de three.js: un croquis es 2D; SVG es nítido, hit-testeable y fácil de
 * manejar con el mouse (y de verificar con Playwright clicando coordenadas).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { solveSketch, type Sketch, type Constraint, type SolveResult } from './sketch-solver';

const GOLD = '#FDB813';
const SCALE = 6; // px por mm

type Tool = 'select' | 'line' | 'rect' | 'circle' | 'dim' | 'fix';
interface XY { x: number; y: number }
type Sel = { kind: 'point'; i: number } | { kind: 'line'; i: number } | { kind: 'circle'; i: number };

const clone = (s: Sketch): Sketch => ({
  points: s.points.map((p) => ({ ...p })),
  lines: s.lines.map((l) => ({ ...l })),
  circles: s.circles.map((c) => ({ ...c })),
  constraints: s.constraints.map((c) => ({ ...c })),
});

export default function SketchEditor({ onFinish, onCancel }: {
  onFinish: (result: { profile: XY[]; holes: { x: number; y: number; d: number }[] }) => void;
  onCancel: () => void;
}) {
  const [model, setModel] = useState<Sketch>({ points: [], lines: [], circles: [], constraints: [] });
  const [res, setRes] = useState<SolveResult | null>(null);
  const [tool, setTool] = useState<Tool>('rect');
  const [draft, setDraft] = useState<number | null>(null);       // punto inicial de una cadena de líneas
  const [rectC1, setRectC1] = useState<number | null>(null);     // 1ª esquina de un rectángulo
  const [circC, setCircC] = useState<number | null>(null);       // centro de un círculo
  const [sel, setSel] = useState<Sel[]>([]);
  const [dim, setDim] = useState<{ kind: 'dist'; p: number; q: number; sx: number; sy: number; val: string } | { kind: 'rad'; c: number; sx: number; sy: number; val: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const modelRef = useRef<Sketch>(model);                                  // último modelo (para el drag sin closure viejo)
  const dragRef = useRef<{ i: number; moved: boolean } | null>(null);      // punto que se está arrastrando
  const suppressClick = useRef(false);                                     // un drag NO debe disparar el click de selección
  useEffect(() => { modelRef.current = model; }, [model]);

  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setSize({ w: r.width, h: r.height }); });
    ro.observe(el); const r = el.getBoundingClientRect(); setSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);

  const cx = size.w / 2, cy = size.h / 2;
  const toPx = useCallback((x: number, y: number) => ({ px: cx + x * SCALE, py: cy - y * SCALE }), [cx, cy]);
  const toMM = useCallback((px: number, py: number) => ({ x: (px - cx) / SCALE, y: (cy - py) / SCALE }), [cx, cy]);

  // Resuelve el modelo y aplica las posiciones (mueve los puntos para satisfacer
  // las restricciones). Se llama tras cada edición.
  const commit = useCallback((next: Sketch) => {
    const copy = clone(next);
    const r = solveSketch(copy);
    setModel(copy); modelRef.current = copy;
    setRes(r);
  }, []);

  // ── ARRASTRAR PUNTOS (en herramienta Seleccionar) ──────────────────
  // Agarras un vértice y la geometría lo SIGUE: lo fijamos al cursor y resolvemos
  // en vivo, así los demás puntos se mueven para mantener las restricciones (lo que
  // hace que un croquis "esté vivo", como Fusion). El pin es temporal (no persiste).
  const mmFromEvent = useCallback((e: ReactPointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return toMM(e.clientX - r.left, e.clientY - r.top);
  }, [toMM]);
  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (tool !== 'select' || dim) return;
    const i = nearestPoint(modelRef.current, mmFromEvent(e), 12 / SCALE);
    if (i >= 0) { dragRef.current = { i, moved: false }; (e.target as Element).setPointerCapture?.(e.pointerId); }
  }, [tool, dim, mmFromEvent]);
  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const d = dragRef.current; if (!d) return;
    d.moved = true;
    const mm = mmFromEvent(e);
    const next = clone(modelRef.current);
    next.points[d.i].x = mm.x; next.points[d.i].y = mm.y;
    const wasFixed = next.points[d.i].fixed;          // recordar si tenía fix real
    next.points[d.i].fixed = true;                    // pin temporal al cursor
    const r = solveSketch(next);                       // los demás siguen
    next.points[d.i].fixed = wasFixed;                 // quitar el pin temporal
    modelRef.current = next; setModel(next); setRes(r);
  }, [mmFromEvent]);
  const onPointerUp = useCallback(() => {
    // Al soltar: re-resolver SIN el pin temporal para que el DOF mostrado sea el
    // real (durante el arrastre el punto cuenta como fijo → −2 DOF).
    if (dragRef.current?.moved) { suppressClick.current = true; commit(modelRef.current); }
    dragRef.current = null;
  }, [commit]);

  // Snap a un punto existente (umbral en px) o crea uno nuevo. Devuelve el índice.
  const snapOrAdd = useCallback((next: Sketch, mm: XY): number => {
    const thr = 10 / SCALE; // 10 px
    for (let i = 0; i < next.points.length; i++) {
      if (Math.hypot(next.points[i].x - mm.x, next.points[i].y - mm.y) < thr) return i;
    }
    next.points.push({ x: mm.x, y: mm.y });
    return next.points.length - 1;
  }, []);

  const onSvgClick = useCallback((e: ReactMouseEvent) => {
    if (suppressClick.current) { suppressClick.current = false; return; } // venía de un drag
    if (dim) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const mm = toMM(e.clientX - rect.left, e.clientY - rect.top);
    const next = clone(model);

    if (tool === 'line') {
      const i = snapOrAdd(next, mm);
      if (draft == null) { setDraft(i); setModel(next); return; }
      if (i !== draft) next.lines.push({ a: draft, b: i });
      // ¿cerró el lazo? (snap al primer punto de una cadena de ≥3)
      const closed = next.lines.length >= 3 && i === firstChainPoint(next);
      setDraft(closed ? null : i);
      commit(next);
      return;
    }
    if (tool === 'rect') {
      if (rectC1 == null) { const i = snapOrAdd(next, mm); setRectC1(i); setModel(next); return; }
      const c1 = next.points[rectC1];
      const p2 = next.points.push({ x: mm.x, y: c1.y }) - 1;
      const p3 = next.points.push({ x: mm.x, y: mm.y }) - 1;
      const p4 = next.points.push({ x: c1.x, y: mm.y }) - 1;
      const L = next.lines.length;
      next.lines.push({ a: rectC1, b: p2 }, { a: p2, b: p3 }, { a: p3, b: p4 }, { a: p4, b: rectC1 });
      next.constraints.push(
        { t: 'horizontal', a: rectC1, b: p2 }, { t: 'horizontal', a: p4, b: p3 },
        { t: 'vertical', a: rectC1, b: p4 }, { t: 'vertical', a: p2, b: p3 },
      );
      void L;
      setRectC1(null);
      commit(next);
      return;
    }
    if (tool === 'circle') {
      if (circC == null) { const i = snapOrAdd(next, mm); setCircC(i); setModel(next); return; }
      const c = next.points[circC];
      const r = Math.max(1, Math.hypot(mm.x - c.x, mm.y - c.y));
      next.circles.push({ c: circC, r });
      setCircC(null);
      commit(next);
      return;
    }
    if (tool === 'fix') {
      const i = nearestPoint(next, mm, 12 / SCALE);
      if (i >= 0) { next.constraints.push({ t: 'fix', p: i }); commit(next); }
      return;
    }
    if (tool === 'dim') {
      // distancia: 2 puntos. radio: 1 círculo.
      const ci = nearestCircle(next, mm, 10 / SCALE);
      if (ci >= 0) { const c = next.circles[ci]; const cp = toPx(next.points[c.c].x, next.points[c.c].y); setDim({ kind: 'rad', c: ci, sx: cp.px, sy: cp.py, val: c.r.toFixed(1) }); return; }
      const pi = nearestPoint(next, mm, 12 / SCALE);
      if (pi < 0) return;
      const cur = sel.find((s) => s.kind === 'point');
      if (cur && cur.i !== pi) {
        const a = next.points[cur.i], b = next.points[pi];
        const mid = toPx((a.x + b.x) / 2, (a.y + b.y) / 2);
        setDim({ kind: 'dist', p: cur.i, q: pi, sx: mid.px, sy: mid.py, val: Math.hypot(a.x - b.x, a.y - b.y).toFixed(1) });
        setSel([]);
      } else setSel([{ kind: 'point', i: pi }]);
      return;
    }
    if (tool === 'select') {
      const pi = nearestPoint(next, mm, 12 / SCALE);
      const li = pi < 0 ? nearestLine(next, mm, 8 / SCALE) : -1;
      if (pi >= 0) toggleSel({ kind: 'point', i: pi });
      else if (li >= 0) toggleSel({ kind: 'line', i: li });
      else setSel([]);
    }
  }, [model, tool, draft, rectC1, circC, dim, sel, commit, snapOrAdd, toMM, toPx]);

  const toggleSel = (s: Sel) => setSel((cur) => {
    const ix = cur.findIndex((c) => c.kind === s.kind && c.i === s.i);
    return ix >= 0 ? cur.filter((_, k) => k !== ix) : [...cur, s];
  });

  // Aplica una restricción a la selección de líneas.
  const applyLineConstraint = (t: 'parallel' | 'perpendicular' | 'equalLength') => {
    const ls = sel.filter((s) => s.kind === 'line');
    if (ls.length !== 2) return;
    const next = clone(model);
    next.constraints.push({ t, l1: ls[0].i, l2: ls[1].i } as Constraint);
    setSel([]); commit(next);
  };
  const applyHV = (t: 'horizontal' | 'vertical') => {
    const ls = sel.filter((s) => s.kind === 'line');
    const next = clone(model);
    for (const l of ls) { const ln = next.lines[l.i]; next.constraints.push({ t, a: ln.a, b: ln.b }); }
    if (ls.length) { setSel([]); commit(next); }
  };
  const applyCoincident = () => {
    const ps = sel.filter((s) => s.kind === 'point');
    if (ps.length !== 2) return;
    const next = clone(model);
    next.constraints.push({ t: 'coincident', p: ps[0].i, q: ps[1].i });
    setSel([]); commit(next);
  };
  const confirmDim = () => {
    if (!dim) return;
    const v = parseFloat(dim.val);
    if (Number.isFinite(v) && v > 0) {
      const next = clone(model);
      if (dim.kind === 'dist') next.constraints.push({ t: 'distance', p: dim.p, q: dim.q, d: v });
      else next.constraints.push({ t: 'radius', c: dim.c, r: v });
      setDim(null); commit(next);
    } else setDim(null);
  };

  // Perfil cerrado para el extrude: recorre el lazo de líneas; si solo hay un
  // círculo, lo teselamos.
  const finish = () => {
    const r = extractProfileAndHoles(model);
    if (r.profile.length >= 3) onFinish(r);
  };

  // Color según DOF global. En tema OSCURO lo "clavado" va en BLANCO (la tinta
  // natural), no negro: el negro de Fusion es porque su lienzo es blanco. Azul =
  // sub-restringido (se mueve), blanco = totalmente definido, rojo = conflicto.
  const dofColor = !res ? '#5b6b7e' : res.status === 'full' ? '#22c55e' : res.status === 'over' ? '#ef4444' : '#3b82f6';
  const entColor = !res ? '#9fb3c8' : res.status === 'full' ? '#eef2f7' : res.status === 'over' ? '#ef4444' : '#3b82f6';

  // Hook QA para Playwright.
  useEffect(() => {
    (window as unknown as { __sketchEditor?: unknown }).__sketchEditor = {
      get ready() { return true; },
      get dof() { return res?.dof ?? null; },
      get status() { return res?.status ?? null; },
      get nPoints() { return model.points.length; },
      get nLines() { return model.lines.length; },
      get nCircles() { return model.circles.length; },
      points() { return model.points.map((p) => ({ x: p.x, y: p.y, fixed: !!p.fixed })); },
      toPx, // (x,y) -> {px,py} relativo al SVG
      svgRect() { return svgRef.current?.getBoundingClientRect(); },
      profile() { return extractProfileAndHoles(model).profile; },
      holes() { return extractProfileAndHoles(model).holes; },
    };
    return () => { delete (window as unknown as { __sketchEditor?: unknown }).__sketchEditor; };
  }, [model, res, toPx]);

  const grid = useMemo(() => buildGrid(size.w, size.h, cx, cy), [size.w, size.h, cx, cy]);
  const TOOLS: [Tool, string, string][] = [
    ['select', '▣', 'Seleccionar (V)'], ['line', '╱', 'Línea (L)'], ['rect', '▭', 'Rectángulo (R)'],
    ['circle', '◯', 'Círculo (C)'], ['dim', '↔', 'Cota (D)'], ['fix', '⚓', 'Anclar (F)'],
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#0b0f14', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif', color: '#e9eef5' }} data-testid="sketch-editor">
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #1b2430' }}>
        <b style={{ color: GOLD, marginRight: 8 }}>⚒ Croquis</b>
        {TOOLS.map(([t, ic, title]) => (
          <button key={t} data-testid={`sk-tool-${t}`} title={title} onClick={() => { setTool(t); setSel([]); setDraft(null); setRectC1(null); setCircC(null); }}
            style={btn(tool === t)}>{ic}</button>
        ))}
        <span style={{ width: 1, height: 22, background: '#1b2430', margin: '0 6px' }} />
        <button data-testid="sk-con-h" title="Horizontal" onClick={() => applyHV('horizontal')} style={btn(false)}>―</button>
        <button data-testid="sk-con-v" title="Vertical" onClick={() => applyHV('vertical')} style={btn(false)}>│</button>
        <button data-testid="sk-con-perp" title="Perpendicular" onClick={() => applyLineConstraint('perpendicular')} style={btn(false)}>⊥</button>
        <button data-testid="sk-con-par" title="Paralela" onClick={() => applyLineConstraint('parallel')} style={btn(false)}>∥</button>
        <button data-testid="sk-con-eq" title="Igual" onClick={() => applyLineConstraint('equalLength')} style={btn(false)}>≡</button>
        <button data-testid="sk-con-coin" title="Coincidente" onClick={applyCoincident} style={btn(false)}>⊙</button>
        <div style={{ flex: 1 }} />
        <button data-testid="sk-cancel" onClick={onCancel} style={btn(false)}>Cancelar</button>
        <button data-testid="sk-finish" onClick={finish} style={{ ...btn(false), background: GOLD, color: '#1a1206', fontWeight: 700, borderColor: GOLD }}>Terminar ✓</button>
      </div>

      {/* Lienzo SVG */}
      <div style={{ flex: 1, position: 'relative' }}>
        <svg ref={svgRef} onClick={onSvgClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          style={{ width: '100%', height: '100%', display: 'block', cursor: tool === 'select' ? 'grab' : 'crosshair' }}>
          {grid}
          {/* círculos */}
          {model.circles.map((c, i) => { const p = toPx(model.points[c.c].x, model.points[c.c].y); return (
            <circle key={`c${i}`} cx={p.px} cy={p.py} r={c.r * SCALE} fill="none" stroke={entColor} strokeWidth={1.6} />
          ); })}
          {/* líneas */}
          {model.lines.map((l, i) => { const a = toPx(model.points[l.a].x, model.points[l.a].y), b = toPx(model.points[l.b].x, model.points[l.b].y);
            const seld = sel.some((s) => s.kind === 'line' && s.i === i);
            return <line key={`l${i}`} x1={a.px} y1={a.py} x2={b.px} y2={b.py} stroke={seld ? GOLD : entColor} strokeWidth={seld ? 3 : 1.8} />;
          })}
          {/* puntos */}
          {model.points.map((pt, i) => { const p = toPx(pt.x, pt.y); const seld = sel.some((s) => s.kind === 'point' && s.i === i);
            return <circle key={`p${i}`} cx={p.px} cy={p.py} r={seld ? 5 : 3.2} fill={seld ? GOLD : pt.fixed ? '#22c55e' : entColor} stroke="#0b0f14" strokeWidth={1} />;
          })}
        </svg>

        {/* input de cota */}
        {dim && (
          <input data-testid="sk-dim-input" autoFocus value={dim.val}
            onChange={(e) => setDim({ ...dim, val: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmDim(); if (e.key === 'Escape') setDim(null); }}
            onBlur={confirmDim}
            style={{ position: 'absolute', left: dim.sx - 30, top: dim.sy - 14, width: 60, padding: '3px 6px', textAlign: 'center',
              background: '#0b0f14', color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }} />
        )}
      </div>

      {/* Barra de estado: DOF */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderTop: '1px solid #1b2430', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
        <span style={{ width: 11, height: 11, borderRadius: 3, background: dofColor, boxShadow: `0 0 8px ${dofColor}` }} />
        <b data-testid="sk-dof" style={{ color: dofColor }}>
          {!res ? 'Dibuja el croquis' : res.status === 'full' ? 'Totalmente restringido ✓' : res.status === 'over' ? 'Conflicto de restricciones' : `${res.dof} grado${res.dof === 1 ? '' : 's'} de libertad`}
        </b>
        <span style={{ color: '#64748b', marginLeft: 12 }}>{model.points.length} pts · {model.lines.length} líneas · {model.circles.length} círculos</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: '#64748b' }}>azul = se mueve · blanco = clavado (como Fusion)</span>
      </div>
    </div>
  );
}

// ── helpers de estilo / geometría ────────────────────────────────────
function btn(active: boolean): CSSProperties {
  return { minWidth: 34, height: 32, padding: '0 10px', borderRadius: 8, cursor: 'pointer', fontSize: 15,
    background: active ? GOLD : 'rgba(255,255,255,0.04)', color: active ? '#1a1206' : '#cdd6e2',
    border: `1px solid ${active ? GOLD : '#283443'}` };
}
function buildGrid(w: number, h: number, cx: number, cy: number) {
  const lines: ReactElement[] = [];
  const step = 10 * SCALE; // 10 mm
  for (let x = cx % step; x < w; x += step) lines.push(<line key={`gx${x}`} x1={x} y1={0} x2={x} y2={h} stroke="#141c26" strokeWidth={1} />);
  for (let y = cy % step; y < h; y += step) lines.push(<line key={`gy${y}`} x1={0} y1={y} x2={w} y2={y} stroke="#141c26" strokeWidth={1} />);
  lines.push(<line key="ax" x1={0} y1={cy} x2={w} y2={cy} stroke="#2a3a4a" strokeWidth={1.3} />);
  lines.push(<line key="ay" x1={cx} y1={0} x2={cx} y2={h} stroke="#2a3a4a" strokeWidth={1.3} />);
  return lines;
}
function nearestPoint(s: Sketch, mm: XY, thr: number): number {
  let best = -1, bd = thr;
  for (let i = 0; i < s.points.length; i++) { const d = Math.hypot(s.points[i].x - mm.x, s.points[i].y - mm.y); if (d < bd) { bd = d; best = i; } }
  return best;
}
function nearestCircle(s: Sketch, mm: XY, thr: number): number {
  let best = -1, bd = thr;
  for (let i = 0; i < s.circles.length; i++) { const c = s.circles[i]; const cp = s.points[c.c]; const d = Math.abs(Math.hypot(mm.x - cp.x, mm.y - cp.y) - c.r); if (d < bd) { bd = d; best = i; } }
  return best;
}
function nearestLine(s: Sketch, mm: XY, thr: number): number {
  let best = -1, bd = thr;
  for (let i = 0; i < s.lines.length; i++) {
    const a = s.points[s.lines[i].a], b = s.points[s.lines[i].b];
    const d = distToSeg(mm, a, b); if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function distToSeg(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x, dy = b.y - a.y; const l2 = dx * dx + dy * dy || 1e-9;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
function firstChainPoint(s: Sketch): number { return s.lines.length ? s.lines[0].a : -1; }
function tessCircle(cx: number, cy: number, r: number): XY[] {
  const out: XY[] = [];
  for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2; out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  return out;
}
/**
 * Separa el croquis en PERFIL EXTERIOR + BARRENOS. Si hay un lazo de líneas, ese
 * es el exterior y TODO círculo dentro es un barreno (se taladra al extruir). Si
 * solo hay círculos, el primero es el exterior (disco) y los demás son barrenos.
 */
function extractProfileAndHoles(s: Sketch): { profile: XY[]; holes: { x: number; y: number; d: number }[] } {
  let profile: XY[] = [];
  let circlesForHoles = s.circles;
  if (s.lines.length >= 3) {
    const adj = new Map<number, number[]>();
    for (const l of s.lines) { (adj.get(l.a) ?? adj.set(l.a, []).get(l.a)!).push(l.b); (adj.get(l.b) ?? adj.set(l.b, []).get(l.b)!).push(l.a); }
    const start = s.lines[0].a; const loop: number[] = [start]; let prev = -1, cur = start;
    for (let guard = 0; guard < s.points.length + 2; guard++) {
      const nbrs = adj.get(cur) ?? []; const nxt = nbrs.find((n) => n !== prev);
      if (nxt == null || nxt === start) break;
      loop.push(nxt); prev = cur; cur = nxt;
    }
    profile = loop.map((i) => ({ x: s.points[i].x, y: s.points[i].y }));
  } else if (s.circles.length >= 1) {
    const c = s.circles[0]; const cp = s.points[c.c];
    profile = tessCircle(cp.x, cp.y, c.r);
    circlesForHoles = s.circles.slice(1);
  }
  const holes = circlesForHoles.map((c) => ({ x: s.points[c.c].x, y: s.points[c.c].y, d: 2 * c.r }));
  return { profile, holes };
}
