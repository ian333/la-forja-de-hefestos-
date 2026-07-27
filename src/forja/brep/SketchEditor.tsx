/**
 * ⚒️ La Forja — EDITOR DE CROQUIS 2D INTERACTIVO
 * ===============================================
 * El humano DIBUJA clicando en el plano (línea / rectángulo / círculo), aplica
 * restricciones y cotas, y el boceto se RESUELVE en vivo: pasa de AZUL (sub-
 * restringido, se puede mover) a NEGRO (totalmente definido, clavado) — igual que
 * Fusion. Encima del solver puro (sketch-solver.ts). Al Terminar, el perfil cerrado
 * alimenta el Extrude. Esto reemplaza las "plantillas": ya no eliges una figura,
 * la dibujas.
 *
 * SVG en vez de three.js: un boceto es 2D; SVG es nítido, hit-testeable y fácil de
 * manejar con el mouse (y de verificar con Playwright clicando coordenadas).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { solveSketch, type Sketch, type Constraint, type SolveResult } from './sketch-solver';
import { rectilinearInfill } from '../cam/slicer';

const GOLD = '#FDB813';
const SCALE = 6; // px por mm

type Tool = 'select' | 'line' | 'rect' | 'circle' | 'arc' | 'arc3' | 'point' | 'dim' | 'fix' | 'trim' | 'poly' | 'ellipse' | 'copy' | 'sfillet' | 'schamfer' | 'mirror' | 'offset' | 'array' | 'scale' | 'hatch';
interface XY { x: number; y: number }
type Sel = { kind: 'point'; i: number } | { kind: 'line'; i: number } | { kind: 'circle'; i: number } | { kind: 'arc'; i: number };

const clone = (s: Sketch): Sketch => ({
  points: s.points.map((p) => ({ ...p })),
  lines: s.lines.map((l) => ({ ...l })),
  circles: s.circles.map((c) => ({ ...c })),
  arcs: (s.arcs ?? []).map((a) => ({ ...a })),
  ellipses: (s.ellipses ?? []).map((e) => ({ ...e })),
  hatches: (s.hatches ?? []).map((h) => ({ a: { ...h.a }, b: { ...h.b } })),
  constraints: s.constraints.map((c) => ({ ...c })),
});

// Arco centro+2extremos → polilínea teselada (CCW de p0 a p1). Sirve para dibujar
// y (más adelante) para el perfil del extrude. Trabaja en coordenadas de modelo (mm).
function tessArc(cx: number, cy: number, x0: number, y0: number, x1: number, y1: number, n = 32): XY[] {
  const R = Math.hypot(x0 - cx, y0 - cy);
  const a0 = Math.atan2(y0 - cy, x0 - cx);
  let sweep = Math.atan2(y1 - cy, x1 - cx) - a0;
  while (sweep <= 1e-9) sweep += Math.PI * 2;   // siempre CCW, rango (0, 2π]
  const pts: XY[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + sweep * (i / n); pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }); }
  return pts;
}

export default function SketchEditor({ onFinish, onCancel, projScale }: {
  onFinish: (result: { profile: XY[]; holes: { x: number; y: number; d: number }[]; polyHoles: XY[][]; path?: XY[]; circle?: { x: number; y: number; r: number } }) => void;
  onCancel: () => void;
  /** MODO ESCENA (boceto DENTRO del 3D): px por mm de la cámara alineada al plano.
   *  Si viene, el editor se vuelve overlay TRANSPARENTE sobre el viewport vivo, con
   *  escala FIJA calibrada a la proyección 3D (los trazos caen SOBRE el plano real).
   *  Sin él, editor clásico opaco (fallback). */
  projScale?: number;
}) {
  const [model, setModel] = useState<Sketch>({ points: [], lines: [], circles: [], arcs: [], constraints: [] });
  const [res, setRes] = useState<SolveResult | null>(null);
  const [tool, setTool] = useState<Tool>('rect');
  // POLÍGONO (Workbook L5): N lados, inscrito (clic = vértice) o circunscrito (clic = punto medio de lado)
  const [polyC, setPolyC] = useState<number | null>(null);
  const [polyN, setPolyN] = useState(6);
  const [polyMode, setPolyMode] = useState<'ins' | 'cir'>('ins');
  // ELIPSE (Workbook L5): centro → semieje X → semieje Y
  const [ellC, setEllC] = useState<number | null>(null);
  const [ellRx, setEllRx] = useState<number | null>(null);
  // COPY (Workbook L7): entidad origen + clics de destino
  const [copySrc, setCopySrc] = useState<{ kind: 'circle' | 'line'; i: number } | null>(null);
  // FILLET/CHAMFER de boceto (L7): radio/distancia editables
  const [skFilletR, setSkFilletR] = useState(10);
  const [skChamferD, setSkChamferD] = useState(6);
  // MIRROR (L7): entidad + 2 puntos del eje
  const [mirSrc, setMirSrc] = useState<{ kind: 'circle' | 'line'; i: number } | null>(null);
  const [mirP1, setMirP1] = useState<XY | null>(null);
  // OFFSET (Workbook L12): entidad + clic del LADO; distancia editable
  const [offSrc, setOffSrc] = useState<{ kind: 'circle' | 'line'; i: number } | null>(null);
  const [offD, setOffD] = useState(6.35);
  // ARRAY (Workbook L13): ventana de selección + rect(nx,ny,dx,dy) | polar(n, centro)
  const [arrMode, setArrMode] = useState<'rect' | 'polar'>('rect');
  const [arrWin, setArrWin] = useState<XY | null>(null);       // 1ª esquina de la ventana
  const [arrSel, setArrSel] = useState<{ lines: number[]; circles: number[] } | null>(null);
  const [arrNx, setArrNx] = useState(5);
  const [arrNy, setArrNy] = useState(4);
  const [arrDx, setArrDx] = useState(25);
  const [arrDy, setArrDy] = useState(20);
  const [arrN, setArrN] = useState(8);
  // SCALE (Workbook L14): ventana + punto base + factor
  const [sclWin, setSclWin] = useState<XY | null>(null);
  const [sclSel, setSclSel] = useState<{ lines: number[]; circles: number[] } | null>(null);
  const [sclF, setSclF] = useState(1.5);
  // HATCH (Workbook L15): clic adentro de una región cerrada; paso editable
  const [hatchS, setHatchS] = useState(4);
  const [draft, setDraft] = useState<number | null>(null);       // punto inicial de una cadena de líneas
  const [rectC1, setRectC1] = useState<number | null>(null);     // 1ª esquina de un rectángulo
  const [circC, setCircC] = useState<number | null>(null);       // centro de un círculo
  const [arcC, setArcC] = useState<number | null>(null);         // centro del arco en curso
  const [arcStart, setArcStart] = useState<number | null>(null); // 1er extremo del arco en curso
  const [arcCursor, setArcCursor] = useState<XY | null>(null);   // cursor para la previa del arco
  const [lineCursor, setLineCursor] = useState<XY | null>(null); // cursor para la previa de LÍNEA (rubber-band, sigue el mouse)
  const [sel, setSel] = useState<Sel[]>([]);
  const [dim, setDim] = useState<
    | { kind: 'dist'; p: number; q: number; sx: number; sy: number; val: string; axis?: 'h' | 'v' }
    | { kind: 'rad'; c: number; sx: number; sy: number; val: string }
    | { kind: 'diam'; c: number; sx: number; sy: number; val: string }
    | { kind: 'arcrad'; a: number; sx: number; sy: number; val: string }
    | { kind: 'ang'; l1: number; l2: number; sx: number; sy: number; val: string; sign?: number }
    | null
  >(null);
  const [chainStart, setChainStart] = useState<number | null>(null);   // 1er punto de la cadena de líneas EN CURSO (para cerrar el lazo correcto, incl. multi-lazo)
  const [dynA, setDynA] = useState('');                                 // entrada dinámica: X (inicio) o Longitud (cadena)
  const [dynB, setDynB] = useState('');                                 // entrada dinámica: Y (inicio) o Ángulo en ° (cadena)
  const [arc3pts, setArc3pts] = useState<number[]>([]);                 // 3-Point Arc: 3 puntos por los que pasa el arco (como Fusion)
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const modelRef = useRef<Sketch>(model);                                  // último modelo (para el drag sin closure viejo)
  const dragRef = useRef<{ i: number; moved: boolean } | null>(null);      // punto que se está arrastrando
  const shapeDragRef = useRef<{ kind: 'circle' | 'rect'; cx: number; cy: number; moved: boolean } | null>(null); // dibujar círculo/rect ARRASTRANDO (instinto natural)
  const suppressClick = useRef(false);                                     // un drag NO debe disparar el click de selección
  const [dragPreview, setDragPreview] = useState<{ kind: 'circle' | 'rect'; x0: number; y0: number; x1: number; y1: number } | null>(null); // vista previa del arrastre
  useEffect(() => { modelRef.current = model; }, [model]);

  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setSize({ w: r.width, h: r.height }); });
    ro.observe(el); const r = el.getBoundingClientRect(); setSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);

  // MODO ESCENA: el centro del boceto (mm 0,0) debe caer en el CENTRO del viewport
  // 3D (donde la cámara mira el origen del plano), no en el centro del SVG — el
  // toolbar del editor desplaza al SVG unos px hacia abajo y desalinearía el plano.
  const [ctrOff, setCtrOff] = useState({ dx: 0, dy: 0 });
  useEffect(() => {
    if (projScale == null) { setCtrOff({ dx: 0, dy: 0 }); return; }
    const svg = svgRef.current; if (!svg) return;
    const vp = svg.closest('.fb-viewport');
    const sr = svg.getBoundingClientRect();
    const vr = vp ? vp.getBoundingClientRect() : sr;
    setCtrOff({
      dx: (vr.left + vr.width / 2) - (sr.left + sr.width / 2),
      dy: (vr.top + vr.height / 2) - (sr.top + sr.height / 2),
    });
  }, [projScale, size.w, size.h]);
  const cx = size.w / 2 + ctrOff.dx, cy = size.h / 2 + ctrOff.dy;
  // AUTO-ZOOM del boceto: encuadra ±140mm mínimo (o el contenido si es mayor) para que
  // boceto GRANDES (una pared de 120mm) QUEPAN en el lienzo. Antes SCALE=6 fijo → lo
  // grande se salía del lienzo y los clics caían FUERA → figuras torcidas (el bug de las paredes).
  // En MODO ESCENA la escala es FIJA (la de la cámara): si cambiara sola, los trazos
  // se despegarían del plano 3D.
  const scale = useMemo(() => {
    if (projScale != null) return projScale;
    let maxR = 140;
    for (const p of model.points) maxR = Math.max(maxR, Math.abs(p.x), Math.abs(p.y));
    return (Math.min(size.w, size.h) * 0.44) / maxR;
  }, [model.points, size, projScale]);
  const toPx = useCallback((x: number, y: number) => ({ px: cx + x * scale, py: cy - y * scale }), [cx, cy, scale]);
  const toMM = useCallback((px: number, py: number) => ({ x: (px - cx) / scale, y: (cy - py) / scale }), [cx, cy, scale]);

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
  // hace que un boceto "esté vivo", como Fusion). El pin es temporal (no persiste).
  const mmFromEvent = useCallback((e: ReactPointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return toMM(e.clientX - r.left, e.clientY - r.top);
  }, [toMM]);

  // Snap a un punto existente (umbral en px) o crea uno nuevo. Devuelve el índice.
  // (Se declara ANTES de los handlers de puntero: onPointerUp lo usa al cerrar un arrastre.)
  // ── OBJECT SNAP (Workbook L4): candidatos que se ILUMINAN y capturan el clic —
  // punto/extremo (cuadrado), punto medio (triángulo), cuadrante de círculo (rombo),
  // intersección línea-línea (X). Prioridad: punto > medio > cuadrante > intersección.
  type SnapHit = { x: number; y: number; kind: 'punto' | 'medio' | 'cuadrante' | 'intersección' | 'origen' | 'eje' };
  const [snapHint, setSnapHint] = useState<SnapHit | null>(null);
  const computeSnap = useCallback((mm: XY): SnapHit | null => {
    const m = modelRef.current;
    const thr = 12 / scale;
    let best: SnapHit | null = null; let bd = thr;
    const consider = (x: number, y: number, kind: SnapHit['kind'], bias = 1) => {
      const d = Math.hypot(x - mm.x, y - mm.y) * bias;
      if (d < bd) { bd = d; best = { x, y, kind }; }
    };
    // ── GEOMETRÍA CONSTRUCTORA GRATIS (orden del user: "todo plano YA debería
    // tener líneas constructoras; solo dale click al eje y que empiece ahí").
    // El ORIGEN y los DOS EJES son snappeables SIEMPRE, sin dibujarlos. Pegar el
    // trazo al eje x=0 también CURA el revolve (el perfil debe tocar el eje EXACTO;
    // el clic a ojo dejaba ±0.17mm y OCCT tronaba). El origen gana con bias fuerte. ──
    consider(0, 0, 'origen', 0.55);          // origen — el ancla de todo boceto
    consider(mm.x, 0, 'eje', 0.9);           // proyección al eje X (y=0)
    consider(0, mm.y, 'eje', 0.9);           // proyección al eje Y (x=0)
    m.points.forEach((q) => consider(q.x, q.y, 'punto', 0.7));
    m.lines.forEach((l) => {
      const q1 = m.points[l.a], q2 = m.points[l.b];
      consider((q1.x + q2.x) / 2, (q1.y + q2.y) / 2, 'medio', 0.85);
    });
    m.circles.forEach((c) => {
      const cp = m.points[c.c];
      for (const [ddx, ddy] of [[c.r, 0], [-c.r, 0], [0, c.r], [0, -c.r]] as const)
        consider(cp.x + ddx, cp.y + ddy, 'cuadrante');
    });
    for (let i = 0; i < m.lines.length; i++)
      for (let j = i + 1; j < m.lines.length; j++) {
        const a1 = m.points[m.lines[i].a], b1 = m.points[m.lines[i].b];
        const a2 = m.points[m.lines[j].a], b2 = m.points[m.lines[j].b];
        const den = (b1.x - a1.x) * (b2.y - a2.y) - (b1.y - a1.y) * (b2.x - a2.x);
        if (Math.abs(den) < 1e-9) continue;
        const t = ((a2.x - a1.x) * (b2.y - a2.y) - (a2.y - a1.y) * (b2.x - a2.x)) / den;
        const u = ((a2.x - a1.x) * (b1.y - a1.y) - (a2.y - a1.y) * (b1.x - a1.x)) / den;
        if (t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98)
          consider(a1.x + t * (b1.x - a1.x), a1.y + t * (b1.y - a1.y), 'intersección');
      }
    return best;
  }, [scale]);

  // distancia punto→segmento + índice de la línea más cercana (para trim/copy/mirror)
  const nearestLineIdx = useCallback((m: Sketch, mm: XY, tol: number): number => {
    let bi = -1, bd = tol;
    m.lines.forEach((l, i) => {
      const A = m.points[l.a], B = m.points[l.b];
      const dx = B.x - A.x, dy = B.y - A.y;
      const len2 = dx * dx + dy * dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((mm.x - A.x) * dx + (mm.y - A.y) * dy) / len2));
      const d = Math.hypot(A.x + t * dx - mm.x, A.y + t * dy - mm.y);
      if (d < bd) { bd = d; bi = i; }
    });
    return bi;
  }, []);
  const nearestCircleIdx = useCallback((m: Sketch, mm: XY, tol: number): number => {
    let bi = -1, bd = tol;
    m.circles.forEach((c, i) => {
      const cp = m.points[c.c];
      const d = Math.abs(Math.hypot(mm.x - cp.x, mm.y - cp.y) - c.r);
      if (d < bd) { bd = d; bi = i; }
    });
    return bi;
  }, []);

  const snapOrAdd = useCallback((next: Sketch, mm: XY): number => {
    const thr = 10 / scale; // 10 px
    for (let i = 0; i < next.points.length; i++) {
      if (Math.hypot(next.points[i].x - mm.x, next.points[i].y - mm.y) < thr) return i;
    }
    next.points.push({ x: mm.x, y: mm.y });
    return next.points.length - 1;
  }, []);
  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (dim) return;
    // Dibujar por ARRASTRE: círculo (centro→radio) y rectángulo (esquina→esquina),
    // como en cualquier editor. El clic-clic sigue vivo (un tap no arrastra).
    if (tool === 'circle' || tool === 'rect') {
      const mm = mmFromEvent(e);
      shapeDragRef.current = { kind: tool, cx: mm.x, cy: mm.y, moved: false };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (tool !== 'select') return;
    const i = nearestPoint(modelRef.current, mmFromEvent(e), 12 / scale);
    if (i >= 0) { dragRef.current = { i, moved: false }; (e.target as Element).setPointerCapture?.(e.pointerId); }
  }, [tool, dim, mmFromEvent]);
  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    // OBJECT SNAP visual: en herramientas de dibujo, el candidato se ilumina bajo el cursor
    if (tool !== 'select' && tool !== 'trim') setSnapHint(computeSnap(mmFromEvent(e)));
    if (tool === 'arc' && arcStart != null) { setArcCursor(mmFromEvent(e)); return; }  // previa del arco (crece con el mouse)
    if (tool === 'line' && draft != null) { setLineCursor(mmFromEvent(e)); return; }   // RUBBER-BAND: la línea sigue el mouse desde el último punto
    const sd = shapeDragRef.current;
    if (sd) {
      const mm = mmFromEvent(e);
      if (Math.hypot(mm.x - sd.cx, mm.y - sd.cy) > 5 / scale) sd.moved = true;   // umbral: distingue tap de arrastre
      setDragPreview({ kind: sd.kind, x0: sd.cx, y0: sd.cy, x1: mm.x, y1: mm.y });
      return;
    }
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
  }, [mmFromEvent, tool, arcStart, draft, computeSnap]);
  const onPointerUp = useCallback((e?: ReactPointerEvent) => {
    // Cierre del ARRASTRE de dibujo (círculo/rect): si de verdad se arrastró,
    // crea la figura y suprime el clic-clic siguiente; si fue un tap, lo deja
    // pasar para que el clic-centro→clic-radio siga funcionando.
    const sd = shapeDragRef.current;
    if (sd) {
      shapeDragRef.current = null;
      setDragPreview(null);
      if (sd.moved && e) {
        suppressClick.current = true;
        const mm = mmFromEvent(e);
        const next = clone(modelRef.current);
        if (sd.kind === 'circle') {
          const ci = snapOrAdd(next, { x: sd.cx, y: sd.cy });          // centro (snap a origen/punto)
          const cpt = next.points[ci];
          next.circles.push({ c: ci, r: Math.max(1, Math.hypot(mm.x - cpt.x, mm.y - cpt.y)) });
          setCircC(null);
        } else {
          const c1i = snapOrAdd(next, { x: sd.cx, y: sd.cy });         // 1ª esquina
          const c1 = next.points[c1i];
          const p2 = next.points.push({ x: mm.x, y: c1.y }) - 1;
          const p3 = next.points.push({ x: mm.x, y: mm.y }) - 1;
          const p4 = next.points.push({ x: c1.x, y: mm.y }) - 1;
          next.lines.push({ a: c1i, b: p2 }, { a: p2, b: p3 }, { a: p3, b: p4 }, { a: p4, b: c1i });
          next.constraints.push(
            { t: 'horizontal', a: c1i, b: p2 }, { t: 'horizontal', a: p4, b: p3 },
            { t: 'vertical', a: c1i, b: p4 }, { t: 'vertical', a: p2, b: p3 },
          );
          setRectC1(null);
        }
        commit(next);
      }
      return;
    }
    // Arrastre de un PUNTO (modo seleccionar): re-resolver SIN el pin temporal
    // para que el DOF mostrado sea el real (durante el arrastre cuenta como fijo).
    if (dragRef.current?.moved) { suppressClick.current = true; commit(modelRef.current); }
    dragRef.current = null;
  }, [commit, mmFromEvent, snapOrAdd]);

  const onSvgClick = useCallback((e: ReactMouseEvent) => {
    if (suppressClick.current) { suppressClick.current = false; return; } // venía de un drag
    if (dim) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const mmRaw = toMM(e.clientX - rect.left, e.clientY - rect.top);
    // OBJECT SNAP (L4): si hay candidato iluminado, el clic cae EXACTO en él
    const snapHit = tool !== 'select' && tool !== 'trim' ? computeSnap(mmRaw) : null;
    const mm = snapHit ? { x: snapHit.x, y: snapHit.y } : mmRaw;
    const next = clone(model);

    if (tool === 'line') {
      const i = snapOrAdd(next, mm);
      if (draft == null) { setDraft(i); setChainStart(i); setModel(next); return; }
      if (i !== draft) next.lines.push({ a: draft, b: i });
      // ¿cerró ESTA cadena? (volvió al primer punto de la cadena en curso)
      const closed = i === chainStart && next.lines.length >= 3;
      setDraft(closed ? null : i); if (closed) setChainStart(null);
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
    if (tool === 'poly') {
      // POLÍGONO regular de N lados: emite LÍNEAS de verdad (restringibles/acotables).
      // Inscrito: el clic define un VÉRTICE. Circunscrito: el clic es el punto medio
      // de un lado → el radio de vértice crece 1/cos(π/N) y arranca girado π/N.
      if (polyC == null) { const i = snapOrAdd(next, mm); setPolyC(i); setModel(next); return; }
      const c = next.points[polyC];
      const rClick = Math.max(1, Math.hypot(mm.x - c.x, mm.y - c.y));
      const r = polyMode === 'cir' ? rClick / Math.cos(Math.PI / polyN) : rClick;
      const a0 = Math.atan2(mm.y - c.y, mm.x - c.x) + (polyMode === 'cir' ? Math.PI / polyN : 0);
      const idx: number[] = [];
      for (let k = 0; k < polyN; k++) {
        const a = a0 + (2 * Math.PI * k) / polyN;
        idx.push(next.points.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }) - 1);
      }
      for (let k = 0; k < polyN; k++) next.lines.push({ a: idx[k], b: idx[(k + 1) % polyN] });
      setPolyC(null);
      commit(next);
      return;
    }
    if (tool === 'ellipse') {
      // ELIPSE centro → semieje X → semieje Y (flujo del Workbook con Quadrant snap)
      if (ellC == null) { const i = snapOrAdd(next, mm); setEllC(i); setModel(next); return; }
      const c = next.points[ellC];
      if (ellRx == null) { setEllRx(Math.max(1, Math.abs(mm.x - c.x))); setModel(next); return; }
      const ry = Math.max(1, Math.abs(mm.y - c.y));
      next.ellipses = [...(next.ellipses ?? []), { c: ellC, rx: ellRx, ry }];
      setEllC(null); setEllRx(null);
      commit(next);
      return;
    }
    if (tool === 'copy') {
      // COPY (L7): 1er clic elige la entidad (círculo o línea); cada clic siguiente pega
      // una copia con el offset del punto base (centro / punto medio) al clic.
      if (!copySrc) {
        const ci = nearestCircleIdx(next, mm, 10 / scale);
        if (ci >= 0) { setCopySrc({ kind: 'circle', i: ci }); return; }
        const li2 = nearestLineIdx(next, mm, 10 / scale);
        if (li2 >= 0) { setCopySrc({ kind: 'line', i: li2 }); }
        return;
      }
      if (copySrc.kind === 'circle') {
        const c = next.circles[copySrc.i]; if (!c) { setCopySrc(null); return; }
        const ni = next.points.push({ x: mm.x, y: mm.y }) - 1;
        next.circles.push({ c: ni, r: c.r });
      } else {
        const l = next.lines[copySrc.i]; if (!l) { setCopySrc(null); return; }
        const A = next.points[l.a], B = next.points[l.b];
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
        const ai = next.points.push({ x: A.x + mm.x - mx, y: A.y + mm.y - my }) - 1;
        const bi2 = next.points.push({ x: B.x + mm.x - mx, y: B.y + mm.y - my }) - 1;
        next.lines.push({ a: ai, b: bi2 });
      }
      commit(next);
      return;
    }
    if (tool === 'sfillet' || tool === 'schamfer') {
      // FILLET/CHAMFER de boceto (L7): clic en la ESQUINA (punto compartido por 2 líneas).
      const pi = nearestPoint(next, mm, 12 / scale);
      if (pi < 0) return;
      const touching = next.lines.map((l, i) => ({ l, i })).filter(({ l }) => l.a === pi || l.b === pi);
      if (touching.length !== 2) return; // esquina = exactamente 2 líneas
      const P = next.points[pi];
      const other = touching.map(({ l }) => next.points[l.a === pi ? l.b : l.a]);
      const u = other.map((q) => {
        const d = Math.hypot(q.x - P.x, q.y - P.y) || 1e-9;
        return { x: (q.x - P.x) / d, y: (q.y - P.y) / d, len: d };
      });
      const cosT = u[0].x * u[1].x + u[0].y * u[1].y;
      const theta = Math.acos(Math.max(-1, Math.min(1, cosT)));
      if (theta < 0.05 || theta > Math.PI - 0.05) return; // colineales: nada que redondear
      const dist = tool === 'sfillet' ? skFilletR / Math.tan(theta / 2) : skChamferD;
      if (dist >= Math.min(u[0].len, u[1].len)) return;   // no cabe
      const pa = { x: P.x + u[0].x * dist, y: P.y + u[0].y * dist };
      const pb = { x: P.x + u[1].x * dist, y: P.y + u[1].y * dist };
      const ia = next.points.push(pa) - 1;
      const ib = next.points.push(pb) - 1;
      // acortar ambas líneas hasta los puntos de tangencia (la esquina P queda huérfana)
      for (const { l } of touching) { if (l.a === pi) l.a = (l === touching[0].l ? ia : ib); else l.b = (l === touching[0].l ? ia : ib); }
      if (tool === 'schamfer') {
        next.lines.push({ a: ia, b: ib });
      } else {
        // centro del arco por la BISECTRIZ a r/sin(θ/2); arco corto de pa a pb (CCW)
        const bx = u[0].x + u[1].x, by = u[0].y + u[1].y;
        const bl = Math.hypot(bx, by) || 1e-9;
        const cdist = skFilletR / Math.sin(theta / 2);
        const C = { x: P.x + (bx / bl) * cdist, y: P.y + (by / bl) * cdist };
        const ic = next.points.push(C) - 1;
        const cross = (pa.x - C.x) * (pb.y - C.y) - (pa.y - C.y) * (pb.x - C.x);
        next.arcs = [...(next.arcs ?? []), cross > 0 ? { c: ic, p0: ia, p1: ib } : { c: ic, p0: ib, p1: ia }];
      }
      commit(next);
      return;
    }
    if (tool === 'mirror') {
      // MIRROR (L7): clic entidad → clic 2 puntos del eje → copia espejada.
      if (!mirSrc) {
        const ci = nearestCircleIdx(next, mm, 10 / scale);
        if (ci >= 0) { setMirSrc({ kind: 'circle', i: ci }); return; }
        const li3 = nearestLineIdx(next, mm, 10 / scale);
        if (li3 >= 0) setMirSrc({ kind: 'line', i: li3 });
        return;
      }
      if (!mirP1) { setMirP1({ x: mm.x, y: mm.y }); return; }
      const ax = mirP1.x, ay = mirP1.y;
      const dx2 = mm.x - ax, dy2 = mm.y - ay;
      const L2 = dx2 * dx2 + dy2 * dy2 || 1e-9;
      const ref = (q: XY): XY => {
        const t = ((q.x - ax) * dx2 + (q.y - ay) * dy2) / L2;
        const fx = ax + t * dx2, fy = ay + t * dy2;
        return { x: 2 * fx - q.x, y: 2 * fy - q.y };
      };
      if (mirSrc.kind === 'circle') {
        const c = next.circles[mirSrc.i];
        if (c) {
          const q = ref(next.points[c.c]);
          const ni = next.points.push(q) - 1;
          next.circles.push({ c: ni, r: c.r });
        }
      } else {
        const l = next.lines[mirSrc.i];
        if (l) {
          const qa = ref(next.points[l.a]), qb = ref(next.points[l.b]);
          const ai2 = next.points.push(qa) - 1, bi3 = next.points.push(qb) - 1;
          next.lines.push({ a: ai2, b: bi3 });
        }
      }
      setMirSrc(null); setMirP1(null);
      commit(next);
      return;
    }
    if (tool === 'offset') {
      // OFFSET (L12): círculo → concéntrico r±d según el lado del 2º clic;
      // línea → paralela a distancia d del lado clicado.
      if (!offSrc) {
        const ci = nearestCircleIdx(next, mm, 10 / scale);
        if (ci >= 0) { setOffSrc({ kind: 'circle', i: ci }); return; }
        const li4 = nearestLineIdx(next, mm, 10 / scale);
        if (li4 >= 0) setOffSrc({ kind: 'line', i: li4 });
        return;
      }
      if (offSrc.kind === 'circle') {
        const c0 = next.circles[offSrc.i]; if (!c0) { setOffSrc(null); return; }
        const cp = next.points[c0.c];
        const inside = Math.hypot(mm.x - cp.x, mm.y - cp.y) < c0.r;
        const nr = inside ? c0.r - offD : c0.r + offD;
        if (nr > 0.5) next.circles.push({ c: c0.c, r: nr });
      } else {
        const l = next.lines[offSrc.i]; if (!l) { setOffSrc(null); return; }
        const A = next.points[l.a], B = next.points[l.b];
        const dx = B.x - A.x, dy = B.y - A.y;
        const len = Math.hypot(dx, dy) || 1e-9;
        let nx = -dy / len, ny = dx / len;                     // normal izquierda
        const side = (mm.x - A.x) * nx + (mm.y - A.y) * ny;    // lado del clic
        if (side < 0) { nx = -nx; ny = -ny; }
        const ai = next.points.push({ x: A.x + nx * offD, y: A.y + ny * offD }) - 1;
        const bi4 = next.points.push({ x: B.x + nx * offD, y: B.y + ny * offD }) - 1;
        next.lines.push({ a: ai, b: bi4 });
      }
      setOffSrc(null);
      commit(next);
      return;
    }
    if (tool === 'array') {
      // ARRAY (L13): 2 clics = VENTANA (entidades completamente adentro);
      // RECT genera al cerrar la ventana con nx·ny copias desplazadas;
      // POLAR pide un 3er clic (el centro) y rota n copias.
      if (!arrWin) { setArrWin({ x: mm.x, y: mm.y }); return; }
      if (!arrSel) {
        const x0 = Math.min(arrWin.x, mm.x), x1 = Math.max(arrWin.x, mm.x);
        const y0 = Math.min(arrWin.y, mm.y), y1 = Math.max(arrWin.y, mm.y);
        const inW = (q: XY) => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1;
        const selL = next.lines.map((l, i) => ({ l, i })).filter(({ l }) => inW(next.points[l.a]) && inW(next.points[l.b])).map(({ i }) => i);
        const selC = next.circles.map((c0, i) => ({ c0, i })).filter(({ c0 }) => inW(next.points[c0.c])).map(({ i }) => i);
        if (!selL.length && !selC.length) { setArrWin(null); return; }
        if (arrMode === 'polar') { setArrSel({ lines: selL, circles: selC }); return; }
        // RECT: generar de inmediato
        for (let iy = 0; iy < arrNy; iy++) for (let ix = 0; ix < arrNx; ix++) {
          if (ix === 0 && iy === 0) continue;
          const ddx = ix * arrDx, ddy = iy * arrDy;
          for (const li5 of selL) {
            const l = next.lines[li5];
            const A = next.points[l.a], B = next.points[l.b];
            const ai = next.points.push({ x: A.x + ddx, y: A.y + ddy }) - 1;
            const bi5 = next.points.push({ x: B.x + ddx, y: B.y + ddy }) - 1;
            next.lines.push({ a: ai, b: bi5 });
          }
          for (const ci2 of selC) {
            const c0 = next.circles[ci2];
            const cp = next.points[c0.c];
            const ni = next.points.push({ x: cp.x + ddx, y: cp.y + ddy }) - 1;
            next.circles.push({ c: ni, r: c0.r });
          }
        }
        setArrWin(null);
        commit(next);
        return;
      }
      // POLAR: este clic es el CENTRO
      const cx0 = mm.x, cy0 = mm.y;
      for (let k = 1; k < arrN; k++) {
        const th = (2 * Math.PI * k) / arrN;
        const rot = (q: XY): XY => ({
          x: cx0 + (q.x - cx0) * Math.cos(th) - (q.y - cy0) * Math.sin(th),
          y: cy0 + (q.x - cx0) * Math.sin(th) + (q.y - cy0) * Math.cos(th),
        });
        for (const li6 of arrSel.lines) {
          const l = next.lines[li6];
          const qa = rot(next.points[l.a]), qb = rot(next.points[l.b]);
          const ai = next.points.push(qa) - 1, bi6 = next.points.push(qb) - 1;
          next.lines.push({ a: ai, b: bi6 });
        }
        for (const ci3 of arrSel.circles) {
          const c0 = next.circles[ci3];
          const q = rot(next.points[c0.c]);
          const ni = next.points.push(q) - 1;
          next.circles.push({ c: ni, r: c0.r });
        }
      }
      setArrWin(null); setArrSel(null);
      commit(next);
      return;
    }
    if (tool === 'scale') {
      // SCALE (L14): ventana (2 clics) → punto BASE (3er clic) → escala por sclF.
      if (!sclWin) { setSclWin({ x: mm.x, y: mm.y }); return; }
      if (!sclSel) {
        const x0 = Math.min(sclWin.x, mm.x), x1 = Math.max(sclWin.x, mm.x);
        const y0 = Math.min(sclWin.y, mm.y), y1 = Math.max(sclWin.y, mm.y);
        const inW = (q: XY) => q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1;
        const selL = next.lines.map((l, i) => ({ l, i })).filter(({ l }) => inW(next.points[l.a]) && inW(next.points[l.b])).map(({ i }) => i);
        const selC = next.circles.map((c0, i) => ({ c0, i })).filter(({ c0 }) => inW(next.points[c0.c])).map(({ i }) => i);
        if (!selL.length && !selC.length) { setSclWin(null); return; }
        setSclSel({ lines: selL, circles: selC });
        return;
      }
      // punto base: escalar EN SITIO (como AutoCAD)
      const bx = mm.x, by = mm.y;
      const seen = new Set<number>();
      const scalePt = (pi2: number) => {
        if (seen.has(pi2)) return; seen.add(pi2);
        const q = next.points[pi2];
        q.x = bx + (q.x - bx) * sclF; q.y = by + (q.y - by) * sclF;
      };
      for (const li7 of sclSel.lines) { const l = next.lines[li7]; scalePt(l.a); scalePt(l.b); }
      for (const ci4 of sclSel.circles) { const c0 = next.circles[ci4]; scalePt(c0.c); c0.r *= sclF; }
      setSclWin(null); setSclSel(null);
      commit(next);
      return;
    }
    if (tool === 'hatch') {
      // HATCH (L15): clic ADENTRO → frontera (círculo o lazo de líneas que contiene el
      // punto) → líneas a 45° recortadas por PARIDAD (el clip del slicer, reusado).
      let boundary: XY[][] | null = null;
      let bestArea = Infinity;
      for (const c0 of next.circles) {
        const cp = next.points[c0.c];
        if (Math.hypot(mm.x - cp.x, mm.y - cp.y) < c0.r) {
          const area = Math.PI * c0.r * c0.r;
          if (area < bestArea) {
            bestArea = area;
            const N = 48;
            boundary = [Array.from({ length: N }, (_, k) => ({
              x: cp.x + c0.r * Math.cos((2 * Math.PI * k) / N),
              y: cp.y + c0.r * Math.sin((2 * Math.PI * k) / N) }))];
          }
        }
      }
      const loops = findLineLoops(next.lines.filter((l) => !l.constr)).filter((lp) => lp.length >= 3);
      for (const lp of loops) {
        const poly = lp.map((i) => ({ x: next.points[i].x, y: next.points[i].y }));
        let inside = false;                    // punto-en-polígono par-impar
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          if ((poly[i].y > mm.y) !== (poly[j].y > mm.y) &&
              mm.x < ((poly[j].x - poly[i].x) * (mm.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) inside = !inside;
        }
        if (!inside) continue;
        let a2 = 0;
        for (let i = 0; i < poly.length; i++) { const q = poly[i], r = poly[(i + 1) % poly.length]; a2 += q.x * r.y - r.x * q.y; }
        const area = Math.abs(a2 / 2);
        if (area < bestArea) { bestArea = area; boundary = [poly]; }
      }
      if (!boundary) return;
      const segs2 = rectilinearInfill(boundary, 45, hatchS);
      next.hatches = [...(next.hatches ?? []), ...segs2.map(([qa, qb]) => ({ a: qa, b: qb }))];
      commit(next);
      return;
    }
    if (tool === 'arc') {
      // Arco centro→inicio→fin (3 clics). El radio = |centro−inicio|; el extremo final
      // se jala a ese radio por el residual del solver. Barre CCW de inicio a fin.
      if (arcC == null) { const i = snapOrAdd(next, mm); setArcC(i); setModel(next); return; }
      if (arcStart == null) { const i = snapOrAdd(next, mm); setArcStart(i); setModel(next); return; }
      const iEnd = snapOrAdd(next, mm);
      next.arcs = [...(next.arcs ?? []), { c: arcC, p0: arcStart, p1: iEnd }];
      setArcC(null); setArcStart(null); setArcCursor(null);
      commit(next);
      return;
    }
    if (tool === 'trim') {
      // TRIM: clic en el TRAMO a quitar. Caso principal (obround del libro): círculo cortado
      // por 2 líneas tangentes → se vuelve el ARCO del lado que NO clicaste. Aditivo, no rompe nada.
      const tol = 10 / scale;
      let ci = -1, cd = tol;
      next.circles.forEach((c, k) => { const cp = next.points[c.c]; const d = Math.abs(Math.hypot(mm.x - cp.x, mm.y - cp.y) - c.r); if (d < cd) { cd = d; ci = k; } });
      if (ci >= 0) {
        const c = next.circles[ci]; const cp = next.points[c.c];
        const ipts: XY[] = [];
        for (const l of next.lines) { for (const p of lineCircleInts(next.points[l.a], next.points[l.b], cp, c.r)) ipts.push(p); }
        if (ipts.length >= 2) {
          const wa = ipts.map((p) => ({ p, a: Math.atan2(p.y - cp.y, p.x - cp.x) })).sort((u, v) => u.a - v.a);
          const a0 = wa[0], a1 = wa[wa.length - 1];               // 2 intersecciones más separadas
          const clickAng = Math.atan2(mm.y - cp.y, mm.x - cp.x);
          const inSpan = clickAng > a0.a && clickAng < a1.a;       // ¿el clic cae en el arco [a0,a1]?
          const p0i = next.points.push({ x: a0.p.x, y: a0.p.y }) - 1;
          const p1i = next.points.push({ x: a1.p.x, y: a1.p.y }) - 1;
          // mantener el arco COMPLEMENTARIO al que contiene el clic (SkArc barre p0→p1 CCW)
          next.arcs = [...(next.arcs ?? []), inSpan ? { c: c.c, p0: p1i, p1: p0i } : { c: c.c, p0: p0i, p1: p1i }];
          next.circles.splice(ci, 1);
          commit(next);
          return;
        }
      }
      // BREAK de LÍNEA (Workbook L6): partir la línea clicada en sus intersecciones
      // (círculos y otras líneas) y QUITAR el tramo donde cayó el clic.
      const li = nearestLineIdx(next, mm, tol);
      if (li >= 0) {
        const l = next.lines[li];
        const A = next.points[l.a], B = next.points[l.b];
        const dx = B.x - A.x, dy = B.y - A.y;
        const len2 = dx * dx + dy * dy || 1e-9;
        const ts: number[] = [0, 1];
        for (const c of next.circles) {
          const cp = next.points[c.c];
          for (const q of lineCircleInts(A, B, cp, c.r)) ts.push(((q.x - A.x) * dx + (q.y - A.y) * dy) / len2);
        }
        next.lines.forEach((o, oi) => {
          if (oi === li) return;
          const A2 = next.points[o.a], B2 = next.points[o.b];
          const den = dx * (B2.y - A2.y) - dy * (B2.x - A2.x);
          if (Math.abs(den) < 1e-9) return;
          const t = ((A2.x - A.x) * (B2.y - A2.y) - (A2.y - A.y) * (B2.x - A2.x)) / den;
          const u = ((A2.x - A.x) * dy - (A2.y - A.y) * dx) / -den;
          if (t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999) ts.push(t);
        });
        // extremos de ARCOS que caen sobre la línea (círculo ya recortado → sus puntos
        // de tangencia siguen siendo los cortes correctos del break)
        for (const arc of next.arcs ?? []) for (const pidx of [arc.p0, arc.p1]) {
          const q = next.points[pidx]; if (!q) continue;
          const t = ((q.x - A.x) * dx + (q.y - A.y) * dy) / len2;
          if (t <= 0.001 || t >= 0.999) continue;
          const dd = Math.hypot(A.x + t * dx - q.x, A.y + t * dy - q.y);
          if (dd < 0.6) ts.push(t);
        }
        ts.sort((x, y) => x - y);
        const tc = Math.max(0, Math.min(1, ((mm.x - A.x) * dx + (mm.y - A.y) * dy) / len2));
        let t0 = 0, t1 = 1;
        for (let k = 0; k + 1 < ts.length; k++) if (tc >= ts[k] && tc <= ts[k + 1]) { t0 = ts[k]; t1 = ts[k + 1]; break; }
        next.lines.splice(li, 1);
        const mk = (t: number) => t <= 1e-6 ? l.a : t >= 1 - 1e-6 ? l.b
          : next.points.push({ x: A.x + t * dx, y: A.y + t * dy }) - 1;
        if (t0 > 1e-6) next.lines.push({ a: l.a, b: mk(t0) });
        if (t1 < 1 - 1e-6) next.lines.push({ a: mk(t1), b: l.b });
        commit(next);
        return;
      }
      return; // nada que cortar bajo el cursor
    }
    if (tool === 'point') {
      // Punto de referencia / datum suelto (snap a punto existente o crea uno nuevo).
      snapOrAdd(next, mm); commit(next); return;
    }
    if (tool === 'fix') {
      const i = nearestPoint(next, mm, 12 / scale);
      if (i >= 0) { next.constraints.push({ t: 'fix', p: i }); commit(next); }
      return;
    }
    if (tool === 'dim') {
      // Cota contextual como Fusion: círculo→Ø, arco→R (dist centro→extremo),
      // 2 puntos→distancia lineal, 2 líneas→ángulo.
      const ci = nearestCircle(next, mm, 10 / scale);
      if (ci >= 0) { const c = next.circles[ci]; const cp = toPx(next.points[c.c].x, next.points[c.c].y); setDim({ kind: 'diam', c: ci, sx: cp.px, sy: cp.py, val: (2 * c.r).toFixed(1) }); return; }
      const ai = nearestArc(next, mm, 10 / scale);
      if (ai >= 0) { const a = (next.arcs ?? [])[ai]; const cen = next.points[a.c], q = next.points[a.p0]; const mid = toPx((cen.x + q.x) / 2, (cen.y + q.y) / 2); setDim({ kind: 'arcrad', a: ai, sx: mid.px, sy: mid.py, val: Math.hypot(q.x - cen.x, q.y - cen.y).toFixed(1) }); return; }
      const pi = nearestPoint(next, mm, 10 / scale);
      if (pi >= 0) {
        const cur = sel.find((s) => s.kind === 'point');
        if (cur && cur.i !== pi) {
          const a = next.points[cur.i], b = next.points[pi];
          const mid = toPx((a.x + b.x) / 2, (a.y + b.y) / 2);
          setDim({ kind: 'dist', p: cur.i, q: pi, sx: mid.px, sy: mid.py, val: Math.hypot(a.x - b.x, a.y - b.y).toFixed(1) });
          setSel([]);
        } else setSel([{ kind: 'point', i: pi }]);
        return;
      }
      const li = nearestLine(next, mm, 8 / scale);
      if (li >= 0) {
        const cur = sel.find((s) => s.kind === 'line');
        if (cur && cur.i !== li) {
          const A = next.lines[cur.i], B = next.lines[li];
          // ángulo INTERIOR en el vértice compartido (mismo criterio que el solver)
          let sv = -1, o1 = -1, o2 = -1;
          if (A.a === B.a) { sv = A.a; o1 = A.b; o2 = B.b; }
          else if (A.a === B.b) { sv = A.a; o1 = A.b; o2 = B.a; }
          else if (A.b === B.a) { sv = A.b; o1 = A.a; o2 = B.b; }
          else if (A.b === B.b) { sv = A.b; o1 = A.a; o2 = B.a; }
          let ux, uy, vx, vy, cxp, cyp;
          if (sv >= 0) { ux = next.points[o1].x - next.points[sv].x; uy = next.points[o1].y - next.points[sv].y; vx = next.points[o2].x - next.points[sv].x; vy = next.points[o2].y - next.points[sv].y; cxp = next.points[sv].x; cyp = next.points[sv].y; }
          else { ux = next.points[A.b].x - next.points[A.a].x; uy = next.points[A.b].y - next.points[A.a].y; vx = next.points[B.b].x - next.points[B.a].x; vy = next.points[B.b].y - next.points[B.a].y; cxp = (next.points[A.a].x + next.points[B.b].x) / 2; cyp = (next.points[A.a].y + next.points[B.b].y) / 2; }
          const signed = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
          const deg = Math.abs(signed * 180 / Math.PI);
          const mp = toPx(cxp, cyp);
          setDim({ kind: 'ang', l1: cur.i, l2: li, sx: mp.px, sy: mp.py, val: deg.toFixed(1), sign: signed >= 0 ? 1 : -1 });
          setSel([]);
        } else setSel([{ kind: 'line', i: li }]);
        return;
      }
      return;
    }
    if (tool === 'select') {
      const pi = nearestPoint(next, mm, 10 / scale);
      if (pi >= 0) { toggleSel({ kind: 'point', i: pi }); return; }
      const ai = nearestArc(next, mm, 8 / scale);
      if (ai >= 0) { toggleSel({ kind: 'arc', i: ai }); return; }
      const cci = nearestCircle(next, mm, 8 / scale);
      if (cci >= 0) { toggleSel({ kind: 'circle', i: cci }); return; }
      const li = nearestLine(next, mm, 8 / scale);
      if (li >= 0) { toggleSel({ kind: 'line', i: li }); return; }
      setSel([]);
    }
  }, [model, tool, draft, chainStart, rectC1, circC, arcC, arcStart, dim, sel, commit, snapOrAdd, toMM, toPx, computeSnap, copySrc, mirSrc, mirP1, skFilletR, skChamferD, polyC, polyN, polyMode, ellC, ellRx, nearestLineIdx, nearestCircleIdx, offSrc, offD, arrMode, arrWin, arrSel, arrNx, arrNy, arrDx, arrDy, arrN, sclWin, sclSel, sclF, hatchS]);

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
  // Simétrica: 2 puntos + 1 línea (el eje) → los puntos quedan espejo respecto al eje.
  // Con esto un boceto simétrico se define con la MITAD de cotas (como el libro).
  const applySymmetric = () => {
    const ps = sel.filter((s) => s.kind === 'point');
    const ls = sel.filter((s) => s.kind === 'line');
    if (ps.length !== 2 || ls.length !== 1) return;
    const next = clone(model);
    next.constraints.push({ t: 'symmetric', p: ps[0].i, q: ps[1].i, l: ls[0].i });
    setSel([]); commit(next);
  };
  // IGUAL contextual (como Fusion): 2 líneas → misma longitud; 2 arcos → mismo radio;
  // 2 círculos → mismo radio. Así un contorno simétrico se cierra con la mitad de cotas.
  const applyEqual = () => {
    const ls = sel.filter((s) => s.kind === 'line');
    const as = sel.filter((s) => s.kind === 'arc');
    const cs = sel.filter((s) => s.kind === 'circle');
    const next = clone(model);
    if (ls.length === 2) next.constraints.push({ t: 'equalLength', l1: ls[0].i, l2: ls[1].i });
    else if (as.length === 2) next.constraints.push({ t: 'equalArcRadius', a1: as[0].i, a2: as[1].i });
    else if (cs.length === 2) next.constraints.push({ t: 'equalRadius', c1: cs[0].i, c2: cs[1].i });
    else return;
    setSel([]); commit(next);
  };
  // TANGENTE: 1 línea + 1 arco → tangente línea↔arco; 1 línea + 1 círculo → tangente línea↔círculo.
  const applyTangent = () => {
    const ls = sel.filter((s) => s.kind === 'line');
    const as = sel.filter((s) => s.kind === 'arc');
    const cs = sel.filter((s) => s.kind === 'circle');
    if (ls.length !== 1) return;
    const next = clone(model);
    if (as.length === 1) {
      // fija el LADO del trazo: signo de la distancia con signo centro↔recta AHORA,
      // para que la tangente no flipee al otro lado válido durante el solve.
      const l = next.lines[ls[0].i], arc = (next.arcs ?? [])[as[0].i];
      const ux = next.points[l.b].x - next.points[l.a].x, uy = next.points[l.b].y - next.points[l.a].y;
      const len = Math.hypot(ux, uy) || 1e-12; const cen = next.points[arc.c];
      const dist = (ux * (cen.y - next.points[l.a].y) - uy * (cen.x - next.points[l.a].x)) / len;
      next.constraints.push({ t: 'tangentLArc', l: ls[0].i, a: as[0].i, side: dist < 0 ? -1 : 1 });
    }
    else if (cs.length === 1) next.constraints.push({ t: 'tangentLC', l: ls[0].i, c: cs[0].i });
    else return;
    setSel([]); commit(next);
  };
  // Marca/desmarca las líneas seleccionadas como CONSTRUCCIÓN (ejes de referencia:
  // siguen restringiendo el boceto pero NO forman parte del perfil que se extruye).
  const toggleConstruction = () => {
    const ls = sel.filter((s) => s.kind === 'line');
    if (!ls.length) return;
    const next = clone(model);
    for (const l of ls) next.lines[l.i].constr = !next.lines[l.i].constr;
    setSel([]); commit(next);
  };
  const confirmDim = () => {
    if (!dim) return;
    const v = parseFloat(dim.val);
    if (Number.isFinite(v) && v > 0) {
      const next = clone(model);
      if (dim.kind === 'dist') next.constraints.push({ t: dim.axis === 'h' ? 'distX' : dim.axis === 'v' ? 'distY' : 'distance', p: dim.p, q: dim.q, d: v });
      else if (dim.kind === 'rad') next.constraints.push({ t: 'radius', c: dim.c, r: v });
      else if (dim.kind === 'diam') next.constraints.push({ t: 'diameter', c: dim.c, d: v });
      else if (dim.kind === 'arcrad') next.constraints.push({ t: 'arcRadius', a: dim.a, r: v });
      else if (dim.kind === 'ang') next.constraints.push({ t: 'angle', l1: dim.l1, l2: dim.l2, deg: v, sign: dim.sign ?? 1 });
      setDim(null); commit(next);
    } else setDim(null);
  };

  // ── ENTRADA DINÁMICA (numérica) de la herramienta Línea ──────────────
  // Reproduce el "Dynamic Input" de Fusion: en vez de clicar a ojo, TECLEAS
  // medidas exactas (un boceto CAD de 40/15/30/80 mm no se clica a ojo).
  // Sin punto de inicio → X,Y absolutos (default origen 0,0).
  // Con inicio → Longitud + Ángulo (grados desde +X, CCW): el siguiente punto es
  // exacto y la cadena continúa; si cae sobre el inicio de la cadena, cierra el lazo.
  const applyDyn = () => {
    if (tool !== 'line' && tool !== 'arc' && tool !== 'circle' && tool !== 'arc3') return;
    const a = parseFloat(dynA), b = parseFloat(dynB);
    const next = clone(model);
    // 3-POINT ARC (como Fusion): teclea 3 puntos (X,Y) por los que pasa el arco. Al
    // tercero, calcula el circuncentro y crea el arco P1→P3 pasando por P2.
    if (tool === 'arc3') {
      if (!Number.isFinite(a) || !Number.isFinite(b)) { setDynA(''); setDynB(''); return; }
      const i = snapOrAdd(next, { x: a, y: b });
      const pts = [...arc3pts, i];
      if (pts.length < 3) { setArc3pts(pts); setModel(next); modelRef.current = next; setDynA(''); setDynB(''); return; }
      const P = next.points;
      const cc = circumcenter(P[pts[0]], P[pts[1]], P[pts[2]]);
      if (cc) {
        const ci = snapOrAdd(next, cc);
        // dirección: el arco CCW P0→P2 debe pasar por P2mid; si no, invierte extremos.
        const ang = (p: XY) => Math.atan2(p.y - next.points[ci].y, p.x - next.points[ci].x);
        let a0 = ang(P[pts[0]]), am = ang(P[pts[1]]), a2 = ang(P[pts[2]]);
        const norm = (x: number) => { let v = x - a0; while (v < 0) v += Math.PI * 2; return v; };
        const p0i = norm(am) <= norm(a2) ? pts[0] : pts[2];
        const p1i = p0i === pts[0] ? pts[2] : pts[0];
        next.arcs = [...(next.arcs ?? []), { c: ci, p0: p0i, p1: p1i }];
      }
      setArc3pts([]); commit(next); setDynA(''); setDynB(''); return;
    }
    // CÍRCULO por entrada dinámica: centro (X,Y) → luego radio R. Exacto, como Fusion.
    if (tool === 'circle') {
      if (!Number.isFinite(a)) { setDynA(''); setDynB(''); return; }
      if (circC == null) {
        if (!Number.isFinite(b)) { setDynA(''); setDynB(''); return; }
        const i = snapOrAdd(next, { x: a, y: b }); setCircC(i); setModel(next); modelRef.current = next;
      } else { next.circles.push({ c: circC, r: Math.max(0.1, a) }); setCircC(null); commit(next); }
      setDynA(''); setDynB(''); return;
    }
    // ARCO por entrada dinámica (Center Point Arc de Fusion): teclea centro → inicio
    // (define radio) → fin (barre CCW del inicio al fin). Los extremos se snapean a
    // los vértices de líneas existentes, cerrando perfiles mixtos línea+arco.
    if (tool === 'arc') {
      if (!Number.isFinite(a) || !Number.isFinite(b)) { setDynA(''); setDynB(''); return; }
      const i = snapOrAdd(next, { x: a, y: b });
      if (arcC == null) { setArcC(i); setModel(next); modelRef.current = next; }
      else if (arcStart == null) { setArcStart(i); setModel(next); modelRef.current = next; }
      else { next.arcs = [...(next.arcs ?? []), { c: arcC, p0: arcStart, p1: i }]; setArcC(null); setArcStart(null); setArcCursor(null); commit(next); }
      setDynA(''); setDynB(''); return;
    }
    if (draft == null) {
      const x = Number.isFinite(a) ? a : 0, y = Number.isFinite(b) ? b : 0;
      const i = snapOrAdd(next, { x, y });
      setDraft(i); setChainStart(i); setModel(next); modelRef.current = next;
    } else {
      const len = Number.isFinite(a) ? a : 0;
      if (len <= 0) { setDynA(''); setDynB(''); return; }
      const ang = (Number.isFinite(b) ? b : 0) * Math.PI / 180;
      const s = next.points[draft];
      const i = snapOrAdd(next, { x: s.x + len * Math.cos(ang), y: s.y + len * Math.sin(ang) });
      if (i !== draft) {
        next.lines.push({ a: draft, b: i });
        // AUTO-RELACIÓN (como Fusion): si el segmento nace horizontal o vertical, se
        // aplica esa restricción sola → el plano nace casi definido (menos cotas que poner).
        const ex = Math.abs(next.points[i].x - s.x), ey = Math.abs(next.points[i].y - s.y);
        if (ey < 1e-6 && ex > 1e-6) next.constraints.push({ t: 'horizontal', a: draft, b: i });
        else if (ex < 1e-6 && ey > 1e-6) next.constraints.push({ t: 'vertical', a: draft, b: i });
      }
      const closed = i === chainStart && next.lines.length >= 3;
      setDraft(closed ? null : i); if (closed) setChainStart(null);
      commit(next);
    }
    setDynA(''); setDynB('');
  };

  // Perfil cerrado para el extrude: recorre el lazo de líneas; si solo hay un
  // círculo, lo teselamos.
  const finish = () => {
    const r = extractProfileAndHoles(model);
    if (r.profile.length >= 3) { onFinish(r); return; }
    // CROQUIS ABIERTO = PATH (para Sweep, como el "path sketch" de Fusion c6t2):
    // si no hay lazo cerrado pero sí una CADENA de líneas, se entrega como path
    // ordenado desde un extremo (nodo de grado 1). La B-spline del kernel lo suaviza.
    const lines = model.lines.filter((l) => !l.constr);
    if (lines.length >= 1) {
      const deg = new Map<number, number[]>();
      lines.forEach((l, li) => { (deg.get(l.a) ?? deg.set(l.a, []).get(l.a)!).push(li); (deg.get(l.b) ?? deg.set(l.b, []).get(l.b)!).push(li); });
      const start = [...deg.entries()].find(([, ls]) => ls.length === 1)?.[0];
      if (start != null) {
        const path: XY[] = [{ x: model.points[start].x, y: model.points[start].y }];
        let cur = start, prevLine = -1;
        for (let g = 0; g < lines.length + 1; g++) {
          const nextLi = (deg.get(cur) ?? []).find((li) => li !== prevLine);
          if (nextLi == null) break;
          const l = lines[nextLi];
          cur = l.a === cur ? l.b : l.a; prevLine = nextLi;
          path.push({ x: model.points[cur].x, y: model.points[cur].y });
        }
        if (path.length >= 2) onFinish({ ...r, path });
      }
    }
  };

  // Estado GLOBAL (barra de abajo). En tema OSCURO lo "clavado" va BLANCO (la tinta
  // natural), no negro: el negro de Fusion es porque su lienzo es blanco.
  const dofColor = !res ? '#5b6b7e' : res.status === 'full' ? '#22c55e' : res.status === 'over' ? '#ef4444' : '#3b82f6';
  // Color POR-ENTIDAD (DOF del espacio nulo): azul si ESA entidad aún se mueve,
  // blanco si está clavada, rojo en conflicto. Así solo lo suelto se ve azul.
  const colFor = (free: boolean | undefined) =>
    !res ? '#9fb3c8' : res.status === 'over' ? '#ef4444' : free ? '#3b82f6' : '#eef2f7';

  // Hook QA para Playwright.
  useEffect(() => {
    (window as unknown as { __sketchEditor?: unknown }).__sketchEditor = {
      get ready() { return true; },
      get dof() { return res?.dof ?? null; },
      get status() { return res?.status ?? null; },
      free() { return res?.free ?? null; },
      get nPoints() { return model.points.length; },
      get nLines() { return model.lines.length; },
      get nCircles() { return model.circles.length; },
      points() { return model.points.map((p) => ({ x: p.x, y: p.y, fixed: !!p.fixed })); },
      lines() { return model.lines.map((l) => ({ a: l.a, b: l.b })); },
      circles() { return model.circles.map((c) => ({ c: c.c, r: c.r })); },
      // Arcos con el PUNTO MEDIO de la curva (para que el arnés clique la curva y la
      // seleccione/acote): midángulo entre p0→p1 barriendo CCW.
      arcs() {
        return (model.arcs ?? []).map((a) => {
          const c = model.points[a.c], q0 = model.points[a.p0], q1 = model.points[a.p1];
          const r = Math.hypot(q0.x - c.x, q0.y - c.y);
          let a0 = Math.atan2(q0.y - c.y, q0.x - c.x), a1 = Math.atan2(q1.y - c.y, q1.x - c.x);
          if (a1 < a0) a1 += Math.PI * 2;
          const am = (a0 + a1) / 2;
          return { c: a.c, p0: a.p0, p1: a.p1, mx: c.x + r * Math.cos(am), my: c.y + r * Math.sin(am) };
        });
      },
      toPx, // (x,y) -> {px,py} relativo al SVG
      svgRect() { return svgRef.current?.getBoundingClientRect(); },
      profile() { return extractProfileAndHoles(model).profile; },
      holes() { return extractProfileAndHoles(model).holes; },
      // ── SELECCIÓN / COTA PROGRAMÁTICA (para el arnés) ────────────────────────────
      // Selecciona entidades POR ÍNDICE (fiable, sin depender de que el pixel pegue en
      // la entidad correcta) y abre el popup de cota ya apuntado a esas entidades. Es
      // exactamente lo que hace un clic, pero sin la fragilidad del hit-testing ciego.
      pick(kind: 'point' | 'line' | 'arc' | 'circle', i: number) { setSel((s) => [...s, { kind, i } as Sel]); },
      clearPick() { setSel([]); },
      dimDist(p: number, q: number, axis?: 'h' | 'v') { const a = model.points[p], b = model.points[q]; const m = toPx((a.x + b.x) / 2, (a.y + b.y) / 2); setDim({ kind: 'dist', p, q, sx: m.px, sy: m.py, val: Math.hypot(a.x - b.x, a.y - b.y).toFixed(1), axis }); },
      dimArcR(ai: number) { const arc = (model.arcs ?? [])[ai]; const c = model.points[arc.c], q = model.points[arc.p0]; const m = toPx((c.x + q.x) / 2, (c.y + q.y) / 2); setDim({ kind: 'arcrad', a: ai, sx: m.px, sy: m.py, val: Math.hypot(q.x - c.x, q.y - c.y).toFixed(1) }); },
      dimDiam(ci: number) { const c = model.circles[ci]; const cp = toPx(model.points[c.c].x, model.points[c.c].y); setDim({ kind: 'diam', c: ci, sx: cp.px, sy: cp.py, val: (2 * c.r).toFixed(1) }); },
      dimAngle(l1: number, l2: number) {
        const A = model.lines[l1], B = model.lines[l2];
        let sv = -1, o1 = -1, o2 = -1;
        if (A.a === B.a) { sv = A.a; o1 = A.b; o2 = B.b; } else if (A.a === B.b) { sv = A.a; o1 = A.b; o2 = B.a; }
        else if (A.b === B.a) { sv = A.b; o1 = A.a; o2 = B.b; } else if (A.b === B.b) { sv = A.b; o1 = A.a; o2 = B.a; }
        let ux, uy, vx, vy, cx2, cy2;
        if (sv >= 0) { ux = model.points[o1].x - model.points[sv].x; uy = model.points[o1].y - model.points[sv].y; vx = model.points[o2].x - model.points[sv].x; vy = model.points[o2].y - model.points[sv].y; cx2 = model.points[sv].x; cy2 = model.points[sv].y; }
        else { ux = model.points[A.b].x - model.points[A.a].x; uy = model.points[A.b].y - model.points[A.a].y; vx = model.points[B.b].x - model.points[B.a].x; vy = model.points[B.b].y - model.points[B.a].y; cx2 = (model.points[A.a].x + model.points[B.b].x) / 2; cy2 = (model.points[A.a].y + model.points[B.b].y) / 2; }
        const signed = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        const deg = Math.abs(signed * 180 / Math.PI);
        const m = toPx(cx2, cy2); setDim({ kind: 'ang', l1, l2, sx: m.px, sy: m.py, val: deg.toFixed(1), sign: signed >= 0 ? 1 : -1 });
      },
    };
    return () => { delete (window as unknown as { __sketchEditor?: unknown }).__sketchEditor; };
  }, [model, res, toPx]);

  // Cambiar de herramienta LIMPIANDO todo estado de dibujo en curso (un solo lugar,
  // usado por los botones Y por el teclado).
  const selectTool = useCallback((t: Tool) => {
    setTool(t); setSel([]); setDraft(null); setChainStart(null); setDynA(''); setDynB('');
    setRectC1(null); setCircC(null); setArcC(null); setArcStart(null); setArcCursor(null); setLineCursor(null); setArc3pts([]);
    setPolyC(null); setEllC(null); setEllRx(null);
    setCopySrc(null); setMirSrc(null); setMirP1(null);
    setOffSrc(null); setArrWin(null); setArrSel(null);
    setSclWin(null); setSclSel(null);
  }, []);

  // ATAJOS DE TECLADO como Fusion/SolidWorks (la gente que viene de CAD los espera):
  // V=seleccionar L=línea R=rectángulo C=círculo A=arco P=punto D=cota F=anclar
  // X=construcción  Esc=soltar lo que estás dibujando. NO dispara si escribes en un input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { setSel([]); setDraft(null); setChainStart(null); setArcC(null); setArcStart(null); setArcCursor(null); setArc3pts([]); setRectC1(null); setCircC(null); setDim(null); setPolyC(null); setEllC(null); setEllRx(null); setCopySrc(null); setMirSrc(null); setMirP1(null); setOffSrc(null); setArrWin(null); setArrSel(null); setSclWin(null); setSclSel(null); return; }
      const map: Record<string, Tool> = { v: 'select', l: 'line', r: 'rect', c: 'circle', a: 'arc', p: 'point', d: 'dim', f: 'fix', t: 'trim', g: 'poly', e: 'ellipse' };
      if (map[k]) { e.preventDefault(); selectTool(map[k]); }
      else if (k === 'x') { e.preventDefault(); toggleConstruction(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectTool, toggleConstruction]);

  const grid = useMemo(() => buildGrid(size.w, size.h, cx, cy, scale), [size.w, size.h, cx, cy, scale]);
  // Ejes constructores + origen: se dibujan SIEMPRE (también en modo escena, donde
  // la rejilla SVG se suprime porque la pone el plano 3D — pero los ejes snappeables
  // y el ancla del origen DEBEN verse). Orden del user: "todo plano con constructoras".
  const axes = useMemo(() => buildAxes(size.w, size.h, cx, cy), [size.w, size.h, cx, cy]);
  const TOOLS: [Tool, string, string][] = [
    ['select', '▣', 'Seleccionar / mover (V)'], ['line', '╱', 'Línea (L) — clic a clic; cierra en el inicio'], ['rect', '▭', 'Rectángulo (R) — 2 esquinas'],
    ['circle', '◯', 'Círculo (C) — centro y radio'], ['arc', '◠', 'Arco (A) — centro → inicio → fin'], ['arc3', '⌒', '3-Point Arc — 3 puntos por los que pasa'],
    ['poly', '⬡', 'Polígono (G) — N lados, inscrito o circunscrito; centro y radio'],
    ['ellipse', '⬭', 'Elipse (E) — centro → semieje X → semieje Y'],
    ['offset', '≡', 'Offset (L12) — clic entidad y luego el LADO; distancia editable'],
    ['scale', '⤢', 'Escalar (L14) — ventana, luego punto base; factor editable'],
    ['hatch', '▨', 'Achurado (L15) — clic ADENTRO de una región cerrada; paso editable'],
    ['array', '⠿', 'Array (L13) — ventana de selección; rect(nx·ny) o polar(n, centro)'],
    ['copy', '⧉', 'Copiar (Workbook L7) — clic en círculo/línea y luego clics de destino'],
    ['sfillet', '◜', 'Fillet de boceto (L7) — clic en la esquina; radio editable'],
    ['schamfer', '◹', 'Chaflán de boceto (L7) — clic en la esquina; distancia editable'],
    ['mirror', '⋈', 'Espejo (L7) — clic entidad, luego 2 puntos del eje'],
    ['point', '•', 'Punto de referencia (P)'], ['trim', '✂', 'Trim (T) — clic en el tramo a quitar; círculo cortado por líneas → arco'],
  ];
  // etiqueta de grupo y separador (para que el toolbar se lea como el ribbon de Fusion)
  const grpLbl = { fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '1px', color: '#5b6b7e', margin: '0 2px 0 6px', fontWeight: 600 };
  const vsep = { width: 1, height: 22, background: '#1b2430', margin: '0 4px' };

  return (
    // MODO ESCENA (projScale): overlay TRANSPARENTE dentro del viewport — la escena
    // 3D (sólido, piso, rejilla del plano) sigue VIVA debajo; solo un velo radial
    // sutil da foco al boceto. Modo clásico (sin projScale): pantalla opaca legado.
    <div style={{
      position: projScale != null ? 'absolute' : 'fixed', inset: 0, zIndex: 50,
      background: projScale != null
        ? 'radial-gradient(ellipse at 50% 46%, rgba(5,10,17,0.10) 32%, rgba(5,10,17,0.58) 100%)'
        : '#0A101C',
      display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif', color: '#e9eef5',
    }} data-testid="sketch-editor">
      {/* Toolbar (fondo propio: debe leerse aunque el editor sea transparente).
          overflow-x scroll + Cancelar/Terminar en cluster STICKY a la derecha → las
          acciones primarias NUNCA se cortan aunque el tool activo agregue campos. */}
      <div className="sk-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid #1b2430', background: 'rgba(9,14,21,0.94)', flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' }}>
        <b style={{ color: GOLD, marginRight: 6 }}>✏ Boceto</b>
        <span style={grpLbl}>Dibujar</span>
        {TOOLS.map(([t, ic, title]) => (
          <button key={t} data-testid={`sk-tool-${t}`} title={title} onClick={() => selectTool(t)} style={btn(tool === t)}>{ic}</button>
        ))}
        <span style={vsep} />
        <span style={grpLbl}>Acotar</span>
        <button data-testid="sk-tool-dim" title="Cota (D) — clic en línea/arco/círculo, o 2 puntos; teclea el valor" onClick={() => selectTool('dim')} style={btn(tool === 'dim')}>↔</button>
        <div style={{ flex: 1 }} />{/* empuja RESTRINGIR a la derecha para NO chocar con las pastillas de modo del centro */}
        <span style={grpLbl}>Restringir</span>
        <button data-testid="sk-con-h" title="Horizontal — selecciona 1+ líneas" onClick={() => applyHV('horizontal')} style={btn(false)}>―</button>
        <button data-testid="sk-con-v" title="Vertical — selecciona 1+ líneas" onClick={() => applyHV('vertical')} style={btn(false)}>│</button>
        <button data-testid="sk-con-perp" title="Perpendicular — selecciona 2 líneas" onClick={() => applyLineConstraint('perpendicular')} style={btn(false)}>⊥</button>
        <button data-testid="sk-con-par" title="Paralela — selecciona 2 líneas" onClick={() => applyLineConstraint('parallel')} style={btn(false)}>∥</button>
        <button data-testid="sk-con-eq" title="Igual — 2 líneas / 2 arcos / 2 círculos" onClick={applyEqual} style={btn(false)}>≡</button>
        <button data-testid="sk-con-tan" title="Tangente — 1 línea + 1 arco/círculo" onClick={applyTangent} style={btn(false)}>◜</button>
        <button data-testid="sk-con-coin" title="Coincidente — selecciona 2 puntos" onClick={applyCoincident} style={btn(false)}>⊙</button>
        <button data-testid="sk-con-sym" title="Simétrica — 2 puntos + 1 línea de eje" onClick={applySymmetric} style={btn(false)}>⋈</button>
        <button data-testid="sk-tool-fix" title="Anclar punto (F)" onClick={() => selectTool('fix')} style={btn(tool === 'fix')}>⚓</button>
        <button data-testid="sk-con-constr" title="Construcción (X) — eje de referencia; no se extruye" onClick={toggleConstruction} style={btn(false)}>╌</button>
        <span style={vsep} />
        {tool === 'scale' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6, fontSize: 11, color: '#8fa3bd' }}>
            ×<input data-testid="sk-scale-f" type="number" min={0.05} step="any" value={sclF}
              onChange={(ev) => setSclF(Math.max(0.05, parseFloat(ev.target.value) || 1.5))}
              style={{ width: 50, background: '#16202F', border: '1px solid #26313f', color: '#dce7f5', borderRadius: 5, padding: '2px 4px', fontSize: 11 }} />
          </span>
        )}
        {tool === 'hatch' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6, fontSize: 11, color: '#8fa3bd' }}>
            paso<input data-testid="sk-hatch-s" type="number" min={0.5} step="any" value={hatchS}
              onChange={(ev) => setHatchS(Math.max(0.5, parseFloat(ev.target.value) || 4))}
              style={{ width: 50, background: '#16202F', border: '1px solid #26313f', color: '#dce7f5', borderRadius: 5, padding: '2px 4px', fontSize: 11 }} />
          </span>
        )}
        {tool === 'offset' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6, fontSize: 11, color: '#8fa3bd' }}>
            d<input data-testid="sk-offset-d" type="number" min={0.1} step="any" value={offD}
              onChange={(ev) => setOffD(Math.max(0.1, parseFloat(ev.target.value) || 6.35))}
              style={{ width: 54, background: '#16202F', border: '1px solid #26313f', color: '#dce7f5', borderRadius: 5, padding: '2px 4px', fontSize: 11 }} />
          </span>
        )}
        {tool === 'array' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 6, fontSize: 11, color: '#8fa3bd' }}>
            <button data-testid="sk-array-mode" onClick={() => setArrMode((mo) => (mo === 'rect' ? 'polar' : 'rect'))} style={btn(false)}>
              {arrMode === 'rect' ? 'Rectangular' : 'Polar'}</button>
            {arrMode === 'rect' ? (<>
              nx<input data-testid="sk-array-nx" type="number" min={1} value={arrNx} onChange={(ev) => setArrNx(Math.max(1, parseInt(ev.target.value) || 1))} style={{ width: 34, background: '#16202F', border: '1px solid #26313f', color: '#dce7f5', borderRadius: 5, padding: '2px 3px', fontSize: 11 }} />
              ny<input data-testid="sk-array-ny" type="number" min={1} value={arrNy} onChange={(ev) => setArrNy(Math.max(1, parseInt(ev.target.value) || 1))} style={{ width: 34, background: '#16202F', border: '1px solid #26313f', color: '#dce7f5', borderRadius: 5, padding: '2px 3px', fontSize: 11 }} />
              dx<input data-testid="sk-array-dx" type="number" step="any" value={arrDx} onChange={(ev) => setArrDx(parseFloat(ev.target.value) || 0)} style={{ width: 44, background: '#16202F', border: '1px solid #26313f', color: '#dce7f5', borderRadius: 5, padding: '2px 3px', fontSize: 11 }} />
              dy<input data-testid="sk-array-dy" type="number" step="any" value={arrDy} onChange={(ev) => setArrDy(parseFloat(ev.target.value) || 0)} style={{ width: 44, background: '#16202F', border: '1px solid #26313f', color: '#dce7f5', borderRadius: 5, padding: '2px 3px', fontSize: 11 }} />
            </>) : (<>
              n<input data-testid="sk-array-n" type="number" min={2} value={arrN} onChange={(ev) => setArrN(Math.max(2, parseInt(ev.target.value) || 2))} style={{ width: 38, background: '#16202F', border: '1px solid #26313f', color: '#dce7f5', borderRadius: 5, padding: '2px 3px', fontSize: 11 }} />
            </>)}
          </span>
        )}
        {tool === 'sfillet' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6, fontSize: 11, color: '#8fa3bd' }}>
            R<input data-testid="sk-fillet-r" type="number" min={0.5} step="any" value={skFilletR}
              onChange={(ev) => setSkFilletR(Math.max(0.5, parseFloat(ev.target.value) || 10))}
              style={{ width: 52, background: '#16202F', border: '1px solid #26313f', color: '#dce7f5', borderRadius: 5, padding: '2px 4px', fontSize: 11 }} />
          </span>
        )}
        {tool === 'schamfer' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6, fontSize: 11, color: '#8fa3bd' }}>
            d<input data-testid="sk-chamfer-d" type="number" min={0.5} step="any" value={skChamferD}
              onChange={(ev) => setSkChamferD(Math.max(0.5, parseFloat(ev.target.value) || 6))}
              style={{ width: 52, background: '#16202F', border: '1px solid #26313f', color: '#dce7f5', borderRadius: 5, padding: '2px 4px', fontSize: 11 }} />
          </span>
        )}
        {tool === 'poly' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 6, fontSize: 11, color: '#8fa3bd' }}>
            N<input data-testid="sk-poly-n" type="number" min={3} max={24} value={polyN}
              onChange={(ev) => setPolyN(Math.max(3, Math.min(24, parseInt(ev.target.value) || 6)))}
              style={{ width: 40, background: '#16202F', border: '1px solid #26313f', color: '#dce7f5', borderRadius: 5, padding: '2px 4px', fontSize: 11 }} />
            <button data-testid="sk-poly-mode" onClick={() => setPolyMode((mo) => (mo === 'ins' ? 'cir' : 'ins'))} style={btn(false)}
              title="Inscrito: el clic es un VÉRTICE · Circunscrito: el clic es el punto MEDIO de un lado">
              {polyMode === 'ins' ? 'Inscrito' : 'Circunscrito'}</button>
          </span>
        )}
        <div style={{ marginLeft: 'auto', position: 'sticky', right: 0, display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 10, background: 'linear-gradient(90deg, rgba(9,14,21,0) 0%, rgba(9,14,21,0.94) 14%)' }}>
          <button data-testid="sk-cancel" onClick={onCancel} style={btn(false)}>Cancelar</button>
          <button data-testid="sk-finish" onClick={finish} style={{ ...btn(false), background: GOLD, color: '#1a1206', fontWeight: 700, borderColor: GOLD }}>Terminar ✓</button>
        </div>
      </div>

      {/* Lienzo SVG */}
      <div style={{ flex: 1, position: 'relative' }}>
        <svg ref={svgRef} onClick={onSvgClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          style={{ width: '100%', height: '100%', display: 'block', cursor: tool === 'select' ? 'grab' : 'crosshair' }}>
          {/* En modo escena la rejilla la pone el PLANO 3D real (SketchPlane); la
              rejilla SVG duplicada solo ensuciaría. */}
          {projScale == null && grid}
          {axes}
          {/* vista previa del ARRASTRE (círculo/rect punteado ámbar mientras dibujas) */}
          {dragPreview && (() => {
            if (dragPreview.kind === 'circle') {
              const c = toPx(dragPreview.x0, dragPreview.y0);
              const r = Math.hypot(dragPreview.x1 - dragPreview.x0, dragPreview.y1 - dragPreview.y0) * scale;
              return <circle cx={c.px} cy={c.py} r={r} fill="none" stroke={GOLD} strokeWidth={1.4} strokeDasharray="5 4" opacity={0.75} />;
            }
            const a = toPx(dragPreview.x0, dragPreview.y0), b = toPx(dragPreview.x1, dragPreview.y1);
            return <rect x={Math.min(a.px, b.px)} y={Math.min(a.py, b.py)} width={Math.abs(a.px - b.px)} height={Math.abs(a.py - b.py)}
              fill="none" stroke={GOLD} strokeWidth={1.4} strokeDasharray="5 4" opacity={0.75} />;
          })()}
          {/* círculos */}
          {model.circles.map((c, i) => { const p = toPx(model.points[c.c].x, model.points[c.c].y); return (
            <circle key={`c${i}`} cx={p.px} cy={p.py} r={c.r * scale} fill="none" stroke={colFor(res?.free?.circles[i])} strokeWidth={1.6} />
          ); })}
          {/* elipses (Workbook L5): centro + semiejes, fuera del solver */}
          {(model.ellipses ?? []).map((el, i) => {
            const cp = model.points[el.c]; if (!cp) return null;
            const p = toPx(cp.x, cp.y);
            return <ellipse key={`el${i}`} cx={p.px} cy={p.py} rx={el.rx * scale} ry={el.ry * scale}
              fill="none" stroke="#60a5fa" strokeWidth={1.6} />;
          })}
          {/* MARCAS DE CENTRO automáticas (feedback del user: "los círculos deben traer sus
              líneas de construcción solas") — cruz punteada estilo AutoCAD en cada centro */}
          {[...model.circles.map((c) => c.c), ...(model.arcs ?? []).map((c) => c.c), ...(model.ellipses ?? []).map((c) => c.c)]
            .map((ci, k) => {
              const cp = model.points[ci]; if (!cp) return null;
              const p = toPx(cp.x, cp.y); const L = 7;
              return (
                <g key={`cm${k}`} stroke="#5b6b7e" strokeWidth={1} strokeDasharray="3 2.4" opacity={0.8}>
                  <line x1={p.px - L} y1={p.py} x2={p.px + L} y2={p.py} />
                  <line x1={p.px} y1={p.py - L} x2={p.px} y2={p.py + L} />
                </g>
              );
            })}
          {/* ACHURADO (L15): líneas 45° recortadas por paridad */}
          {(model.hatches ?? []).map((h, i) => {
            const pa = toPx(h.a.x, h.a.y), pb = toPx(h.b.x, h.b.y);
            return <line key={`h${i}`} x1={pa.px} y1={pa.py} x2={pb.px} y2={pb.py}
              stroke="#3d5a7a" strokeWidth={0.9} />;
          })}
          {/* OBJECT SNAP iluminado (Workbook L4): cuadrado=punto · triángulo=medio ·
              rombo=cuadrante · X=intersección — verde aurora, captura el clic */}
          {snapHint && (() => {
            const p = toPx(snapHint.x, snapHint.y); const S = 8;
            // origen/eje = ámbar (geometría constructora); el resto = verde aurora.
            const constr = snapHint.kind === 'origen' || snapHint.kind === 'eje';
            const col = constr ? '#FDB813' : '#5DDB8C';
            const glyph = snapHint.kind === 'origen'
              ? <circle cx={p.px} cy={p.py} r={S} fill="none" stroke={col} strokeWidth={2.2} />
              : snapHint.kind === 'eje'
              ? <g stroke={col} strokeWidth={2.2}><line x1={p.px} y1={p.py - S} x2={p.px} y2={p.py + S} /><line x1={p.px - S} y1={p.py} x2={p.px + S} y2={p.py} /></g>
              : snapHint.kind === 'punto'
              ? <rect x={p.px - S} y={p.py - S} width={2 * S} height={2 * S} fill="none" stroke={col} strokeWidth={2.4} />
              : snapHint.kind === 'medio'
                ? <polygon points={`${p.px},${p.py - S} ${p.px + S},${p.py + S} ${p.px - S},${p.py + S}`} fill="none" stroke={col} strokeWidth={1.8} />
                : snapHint.kind === 'cuadrante'
                  ? <polygon points={`${p.px},${p.py - S} ${p.px + S},${p.py} ${p.px},${p.py + S} ${p.px - S},${p.py}`} fill="none" stroke={col} strokeWidth={1.8} />
                  : <g stroke={col} strokeWidth={1.8}><line x1={p.px - S} y1={p.py - S} x2={p.px + S} y2={p.py + S} /><line x1={p.px - S} y1={p.py + S} x2={p.px + S} y2={p.py - S} /></g>;
            return (
              <g pointerEvents="none">
                {glyph}
                <text x={p.px + 10} y={p.py - 10} fontSize={10} fill={col} fontFamily="JetBrains Mono, monospace">{snapHint.kind}</text>
              </g>
            );
          })()}
          {/* arcos (centro+2 extremos, teselados) */}
          {(model.arcs ?? []).map((a, i) => {
            const c = model.points[a.c], q0 = model.points[a.p0], q1 = model.points[a.p1];
            const pts = tessArc(c.x, c.y, q0.x, q0.y, q1.x, q1.y).map((q) => { const pp = toPx(q.x, q.y); return `${pp.px},${pp.py}`; }).join(' ');
            return <polyline key={`a${i}`} points={pts} fill="none" stroke={colFor(res?.free?.points[a.p0] || res?.free?.points[a.p1])} strokeWidth={1.7} />;
          })}
          {/* previa del arco en curso: crece con el mouse del inicio al cursor */}
          {tool === 'arc' && arcC != null && arcStart != null && arcCursor && (() => {
            const c = model.points[arcC], q0 = model.points[arcStart];
            const pts = tessArc(c.x, c.y, q0.x, q0.y, arcCursor.x, arcCursor.y).map((q) => { const pp = toPx(q.x, q.y); return `${pp.px},${pp.py}`; }).join(' ');
            return <polyline points={pts} fill="none" stroke={GOLD} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.8} />;
          })()}
          {/* RUBBER-BAND de la línea en curso: sigue el mouse del último punto al cursor */}
          {tool === 'line' && draft != null && lineCursor && (() => {
            const a = toPx(model.points[draft].x, model.points[draft].y), b = toPx(lineCursor.x, lineCursor.y);
            return <line x1={a.px} y1={a.py} x2={b.px} y2={b.py} stroke={GOLD} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.8} pointerEvents="none" />;
          })()}
          {/* líneas */}
          {model.lines.map((l, i) => { const a = toPx(model.points[l.a].x, model.points[l.a].y), b = toPx(model.points[l.b].x, model.points[l.b].y);
            const seld = sel.some((s) => s.kind === 'line' && s.i === i);
            const free = !!(res?.free?.points[l.a] || res?.free?.points[l.b]);
            return <line key={`l${i}`} x1={a.px} y1={a.py} x2={b.px} y2={b.py}
              stroke={seld ? GOLD : l.constr ? '#6b7a8d' : colFor(free)} strokeWidth={seld ? 3 : l.constr ? 1.2 : 1.8}
              strokeDasharray={l.constr ? '7 5' : undefined} />;
          })}
          {/* RESTRICCIONES: badges (H/V/⊥/∥/=/⊙) que dicen QUÉ sujeta el boceto,
              como Fusion. Antes el solver las aplicaba pero eran invisibles. */}
          <ConstraintBadges model={model} toPx={toPx} />
          {/* COTAS (driving dimensions): el valor numérico sobre la geometría,
              como Fusion. Antes las cotas existían en el modelo pero eran invisibles. */}
          <DimAnnotations model={model} toPx={toPx} scale={scale} />
          {/* puntos */}
          {model.points.map((pt, i) => { const p = toPx(pt.x, pt.y); const seld = sel.some((s) => s.kind === 'point' && s.i === i);
            return <circle key={`p${i}`} cx={p.px} cy={p.py} r={seld ? 5 : 3.2} fill={seld ? GOLD : pt.fixed ? '#22c55e' : colFor(res?.free?.points[i])} stroke="#0b0f14" strokeWidth={1} />;
          })}
        </svg>

        {/* input de cota */}
        {dim && (
          <div style={{ position: 'absolute', left: dim.sx - 30, top: dim.sy - 14, display: 'flex', gap: 3, alignItems: 'center' }}>
            <input data-testid="sk-dim-input" autoFocus value={dim.val}
              onChange={(e) => setDim({ ...dim, val: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmDim(); if (e.key === 'Escape') setDim(null); }}
              style={{ width: 56, padding: '3px 6px', textAlign: 'center',
                background: '#0A101C', color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }} />
            {dim.kind === 'dist' && (<>
              <button data-testid="sk-dim-h" title="Cota horizontal (↔)" onMouseDown={(e) => { e.preventDefault(); if (dim.kind === 'dist') setDim({ ...dim, axis: dim.axis === 'h' ? undefined : 'h' }); }} style={{ ...btn(dim.axis === 'h'), height: 24, minWidth: 22, fontSize: 12 }}>↔</button>
              <button data-testid="sk-dim-v" title="Cota vertical (↕)" onMouseDown={(e) => { e.preventDefault(); if (dim.kind === 'dist') setDim({ ...dim, axis: dim.axis === 'v' ? undefined : 'v' }); }} style={{ ...btn(dim.axis === 'v'), height: 24, minWidth: 22, fontSize: 12 }}>↕</button>
            </>)}
          </div>
        )}

        {/* ENTRADA DINÁMICA (numérica) de la herramienta Línea — medidas exactas, como Fusion.
            Sin inicio: X,Y absolutos (origen por default). Con inicio: Longitud + Ángulo(°). */}
        {(tool === 'line' || tool === 'arc' || tool === 'circle' || tool === 'arc3') && (() => {
          const esc = () => { setDraft(null); setChainStart(null); setArcC(null); setArcStart(null); setCircC(null); setArc3pts([]); setDynA(''); setDynB(''); };
          const [la, lb, hint] = tool === 'arc'
            ? (arcC == null ? ['X', 'Y', 'centro del arco'] : arcStart == null ? ['X', 'Y', 'inicio (define radio)'] : ['X', 'Y', 'fin (barre CCW)'])
            : tool === 'arc3'
            ? ['X', 'Y', `3-Point Arc: punto ${arc3pts.length + 1} de 3`]
            : tool === 'circle'
            ? (circC == null ? ['X', 'Y', 'centro del círculo'] : ['R', '', 'radio'])
            : (draft == null ? ['X', 'Y', 'punto inicial'] : ['L', '∠°', 'longitud + ángulo']);
          return (
            <div data-testid="sk-dyn" style={{ position: 'absolute', left: 12, top: 12, display: 'flex', gap: 6, alignItems: 'center',
              background: 'rgba(11,15,20,0.92)', border: `1px solid ${GOLD}`, borderRadius: 8, padding: '6px 9px' }}>
              <span style={{ color: '#9fb3c8', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{la}</span>
              <input data-testid="sk-dyn-a" value={dynA} placeholder="mm"
                onChange={(e) => setDynA(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyDyn(); } else if (e.key === 'Escape') esc(); }}
                style={dynInStyle} />
              <span style={{ color: '#9fb3c8', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{lb}</span>
              <input data-testid="sk-dyn-b" value={dynB} placeholder="mm"
                onChange={(e) => setDynB(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyDyn(); } else if (e.key === 'Escape') esc(); }}
                style={dynInStyle} />
              <button data-testid="sk-dyn-go" title="Aplicar (Enter)" onClick={applyDyn} style={{ ...btn(false), height: 28, minWidth: 30 }}>↵</button>
              {tool === 'line' && draft != null && <button data-testid="sk-dyn-end" title="Terminar cadena (Esc)" onClick={esc} style={{ ...btn(false), height: 28, minWidth: 30 }}>⊘</button>}
              <span style={{ color: '#64748b', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, marginLeft: 2 }}>{hint}</span>
            </div>
          );
        })()}
      </div>

      {/* Barra de estado: DOF (fondo propio para leerse sobre la escena) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderTop: '1px solid #1b2430', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, background: 'rgba(9,14,21,0.94)' }}>
        <span style={{ width: 11, height: 11, borderRadius: 3, background: dofColor, boxShadow: `0 0 8px ${dofColor}` }} />
        <b data-testid="sk-dof" style={{ color: dofColor }}>
          {!res ? 'Dibuja el plano' : res.status === 'full' ? 'Totalmente restringido ✓' : res.status === 'over' ? 'Conflicto de restricciones' : `${res.dof} grado${res.dof === 1 ? '' : 's'} de libertad`}
        </b>
        <span style={{ color: '#64748b', marginLeft: 12 }}>{model.points.length} pts · {model.lines.length} líneas · {model.circles.length} círculos{(model.ellipses?.length ?? 0) > 0 ? ` · ${model.ellipses!.length} elipses` : ''}</span>
        <span style={{ flex: 1 }} />
        {/* La leyenda de colores vive en el tooltip del chip DOF, no quemada en pantalla */}
        <span style={{ color: '#3d4754', cursor: 'help', fontSize: 12 }}
          title="Colores del boceto: azul = geometría con libertad (se mueve) · blanco = clavada por restricciones/cotas">?</span>
      </div>
    </div>
  );
}

// ── COTAS visibles (driving dimensions) ──────────────────────────────
// Dibuja el valor de cada restricción de cota sobre el boceto: distancia con
// líneas de extensión + flechas + número (alineado a la cota, volteado si queda
// de cabeza), y radio con hoja + "R". Color ámbar para distinguir de la
// geometría (verde=fijo, azul=libre, oro=selección). pointerEvents none: no
// estorban los clics.
const DIM_COLOR = '#f0b35e';
function fmtDim(v: number): string { return Number.isInteger(v) ? String(v) : v.toFixed(1); }
function DimAnnotations({ model, toPx, scale }: { model: Sketch; toPx: (x: number, y: number) => { px: number; py: number }; scale: number }): ReactElement {
  const els: ReactElement[] = [];
  model.constraints.forEach((con, i) => {
    if (con.t === 'distance' || con.t === 'distX' || con.t === 'distY') {
      const a = model.points[con.p], b = model.points[con.q];
      if (!a || !b) return;
      const pa = toPx(a.x, a.y), pb = toPx(b.x, b.y);
      // distX/distY: la cota va ALINEADA al eje (H o V), no punto-a-punto
      if (con.t === 'distX') { pb.py = pa.py; } else if (con.t === 'distY') { pb.px = pa.px; }
      const dx = pb.px - pa.px, dy = pb.py - pa.py; const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;        // dir + perpendicular
      const OFF = 22, ah = 5;
      const A = { x: pa.px + nx * OFF, y: pa.py + ny * OFF };
      const B = { x: pb.px + nx * OFF, y: pb.py + ny * OFF };
      const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      let ang = (Math.atan2(dy, dx) * 180) / Math.PI; if (ang > 90 || ang < -90) ang += 180;
      els.push(
        <g key={`dim${i}`} pointerEvents="none" data-dim="dist">
          <line x1={pa.px + nx * 3} y1={pa.py + ny * 3} x2={A.x + nx * 4} y2={A.y + ny * 4} stroke={DIM_COLOR} strokeWidth={0.6} opacity={0.55} />
          <line x1={pb.px + nx * 3} y1={pb.py + ny * 3} x2={B.x + nx * 4} y2={B.y + ny * 4} stroke={DIM_COLOR} strokeWidth={0.6} opacity={0.55} />
          <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={DIM_COLOR} strokeWidth={1} />
          <path d={`M ${A.x} ${A.y} l ${ux * ah - nx * ah * 0.45} ${uy * ah - ny * ah * 0.45} M ${A.x} ${A.y} l ${ux * ah + nx * ah * 0.45} ${uy * ah + ny * ah * 0.45}`} stroke={DIM_COLOR} strokeWidth={1} />
          <path d={`M ${B.x} ${B.y} l ${-ux * ah - nx * ah * 0.45} ${-uy * ah - ny * ah * 0.45} M ${B.x} ${B.y} l ${-ux * ah + nx * ah * 0.45} ${-uy * ah + ny * ah * 0.45}`} stroke={DIM_COLOR} strokeWidth={1} />
          <text x={M.x} y={M.y - 4} fill={DIM_COLOR} fontSize={12} textAnchor="middle" fontFamily="JetBrains Mono, monospace" transform={`rotate(${ang} ${M.x} ${M.y})`}>{fmtDim(con.d)}</text>
        </g>,
      );
    } else if (con.t === 'radius') {
      const circ = model.circles[con.c]; if (!circ) return;
      const cc = model.points[circ.c]; if (!cc) return;
      const pc = toPx(cc.x, cc.y); const r = circ.r * scale;
      const ux = Math.SQRT1_2, uy = -Math.SQRT1_2;
      const t2 = { x: pc.px + ux * (r + 24), y: pc.py + uy * (r + 24) };
      els.push(
        <g key={`dim${i}`} pointerEvents="none" data-dim="rad">
          <line x1={pc.px + ux * r} y1={pc.py + uy * r} x2={t2.x} y2={t2.y} stroke={DIM_COLOR} strokeWidth={1} />
          <text x={t2.x + 3} y={t2.y - 2} fill={DIM_COLOR} fontSize={12} fontFamily="JetBrains Mono, monospace">R{fmtDim(circ.r)}</text>
        </g>,
      );
    } else if (con.t === 'diameter') {
      const circ = model.circles[con.c]; if (!circ) return;
      const cc = model.points[circ.c]; if (!cc) return;
      const pc = toPx(cc.x, cc.y); const r = circ.r * scale;
      const ux = Math.SQRT1_2, uy = -Math.SQRT1_2;
      const t2 = { x: pc.px + ux * (r + 24), y: pc.py + uy * (r + 24) };
      els.push(
        <g key={`dim${i}`} pointerEvents="none" data-dim="diam">
          <line x1={pc.px - ux * r} y1={pc.py - uy * r} x2={t2.x} y2={t2.y} stroke={DIM_COLOR} strokeWidth={1} />
          <text x={t2.x + 3} y={t2.y - 2} fill={DIM_COLOR} fontSize={12} fontFamily="JetBrains Mono, monospace">Ø{fmtDim(con.d)}</text>
        </g>,
      );
    } else if (con.t === 'arcRadius') {
      const arc = (model.arcs ?? [])[con.a]; if (!arc) return;
      const cc = model.points[arc.c], p0 = model.points[arc.p0], p1 = model.points[arc.p1]; if (!cc || !p0 || !p1) return;
      let a0 = Math.atan2(p0.y - cc.y, p0.x - cc.x), a1 = Math.atan2(p1.y - cc.y, p1.x - cc.x);
      if (a1 < a0) a1 += Math.PI * 2; const am = (a0 + a1) / 2;
      const pm = toPx(cc.x + con.r * Math.cos(am), cc.y + con.r * Math.sin(am)); const pc = toPx(cc.x, cc.y);
      const dx = pm.px - pc.px, dy = pm.py - pc.py; const L = Math.hypot(dx, dy) || 1; const ux = dx / L, uy = dy / L;
      const t2 = { x: pm.px + ux * 20, y: pm.py + uy * 20 };
      els.push(
        <g key={`dim${i}`} pointerEvents="none" data-dim="arcrad">
          <line x1={pm.px} y1={pm.py} x2={t2.x} y2={t2.y} stroke={DIM_COLOR} strokeWidth={1} />
          <text x={t2.x + (ux >= 0 ? 3 : -3)} y={t2.y - 2} fill={DIM_COLOR} fontSize={12} textAnchor={ux >= 0 ? 'start' : 'end'} fontFamily="JetBrains Mono, monospace">R{fmtDim(con.r)}</text>
        </g>,
      );
    }
  });
  return <>{els}</>;
}

// ── BADGES de restricción ────────────────────────────────────────────
// Pequeños glifos que comunican QUÉ restricción sujeta cada entidad (como
// Fusion): ━/┃ horizontal/vertical, ⊥ perpendicular, ∥ paralela, = igual,
// ⊙ coincidente. Color teal para no confundir con cotas (ámbar) ni geometría.
const CON_COLOR = '#4fd1c5';
function ConstraintBadges({ model, toPx }: { model: Sketch; toPx: (x: number, y: number) => { px: number; py: number } }): ReactElement {
  const els: ReactElement[] = [];
  const midOf = (ai: number, bi: number) => {
    const a = model.points[ai], b = model.points[bi];
    const pa = toPx(a.x, a.y), pb = toPx(b.x, b.y);
    return { x: (pa.px + pb.px) / 2, y: (pa.py + pb.py) / 2, dx: pb.px - pa.px, dy: pb.py - pa.py };
  };
  const badge = (key: string, x: number, y: number, g: string) =>
    els.push(<text key={key} x={x} y={y} fill={CON_COLOR} fontSize={9} textAnchor="middle" pointerEvents="none" fontFamily="monospace" opacity={0.85}>{g}</text>);
  model.constraints.forEach((c, i) => {
    if (c.t === 'horizontal' || c.t === 'vertical') {
      const a = model.points[c.a], b = model.points[c.b]; if (!a || !b) return;
      const m = midOf(c.a, c.b); const L = Math.hypot(m.dx, m.dy) || 1;
      badge(`cb${i}`, m.x + (-m.dy / L) * 9, m.y + (m.dx / L) * 9 + 3, c.t === 'horizontal' ? '━' : '┃');
    } else if (c.t === 'perpendicular' || c.t === 'parallel' || c.t === 'equalLength') {
      const l = model.lines[c.l1]; if (!l) return; const m = midOf(l.a, l.b);
      badge(`cb${i}`, m.x, m.y - 6, c.t === 'perpendicular' ? '⊥' : c.t === 'parallel' ? '∥' : '=');
    } else if (c.t === 'coincident') {
      const p = model.points[c.p]; if (!p) return; const pp = toPx(p.x, p.y);
      badge(`cb${i}`, pp.px + 8, pp.py - 6, '⊙');
    }
  });
  return <>{els}</>;
}

// ── helpers de estilo / geometría ────────────────────────────────────
function btn(active: boolean): CSSProperties {
  return { minWidth: 34, height: 32, padding: '0 10px', borderRadius: 8, cursor: 'pointer', fontSize: 15,
    background: active ? GOLD : 'rgba(255,255,255,0.04)', color: active ? '#1a1206' : '#cdd6e2',
    border: `1px solid ${active ? GOLD : '#283443'}` };
}
const dynInStyle: CSSProperties = { width: 54, padding: '3px 6px', textAlign: 'center', background: '#0A101C',
  color: GOLD, border: '1px solid #283443', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 };
function buildGrid(w: number, h: number, cx: number, cy: number, scale: number) {
  const lines: ReactElement[] = [];
  const step = 10 * scale; // 10 mm
  for (let x = cx % step; x < w; x += step) lines.push(<line key={`gx${x}`} x1={x} y1={0} x2={x} y2={h} stroke="#141c26" strokeWidth={1} />);
  for (let y = cy % step; y < h; y += step) lines.push(<line key={`gy${y}`} x1={0} y1={y} x2={w} y2={y} stroke="#141c26" strokeWidth={1} />);
  return lines;
}
// EJES CONSTRUCTORES + ORIGEN — geometría de referencia que TODO plano trae gratis
// (orden del user). Ámbar = convención de construcción; no se extruyen. Snappeables
// (ver computeSnap 'origen'/'eje'): clic en el eje empieza ahí, sin dibujar la línea.
// Se dibujan también en modo escena (sobre el 3D oscuro) → colores vivos.
function buildAxes(w: number, h: number, cx: number, cy: number) {
  const els: ReactElement[] = [];
  els.push(<line key="ax" x1={0} y1={cy} x2={w} y2={cy} stroke="#c79235" strokeWidth={1.6} strokeDasharray="9 6" opacity={0.9} />);
  els.push(<line key="ay" x1={cx} y1={0} x2={cx} y2={h} stroke="#c79235" strokeWidth={1.6} strokeDasharray="9 6" opacity={0.9} />);
  els.push(<text key="lx" x={w - 18} y={cy - 8} fontSize={12} fontWeight={700} fill="#e0a63a" fontFamily="JetBrains Mono, monospace">X</text>);
  els.push(<text key="ly" x={cx + 9} y={16} fontSize={12} fontWeight={700} fill="#e0a63a" fontFamily="JetBrains Mono, monospace">Y</text>);
  els.push(<circle key="o0" cx={cx} cy={cy} r={5.5} fill="none" stroke="#FDB813" strokeWidth={2} />);
  els.push(<circle key="o1" cx={cx} cy={cy} r={1.8} fill="#FDB813" />);
  return els;
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
function nearestArc(s: Sketch, mm: XY, thr: number): number {
  // Distancia a la CURVA del arco ≈ | |mm−centro| − radio |. Sirve para seleccionar/acotar arcos.
  let best = -1, bd = thr;
  const arcs = s.arcs ?? [];
  for (let i = 0; i < arcs.length; i++) {
    const a = arcs[i], c = s.points[a.c], q0 = s.points[a.p0];
    const rad = Math.hypot(q0.x - c.x, q0.y - c.y);
    const d = Math.abs(Math.hypot(mm.x - c.x, mm.y - c.y) - rad);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function distToSeg(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x, dy = b.y - a.y; const l2 = dx * dx + dy * dy || 1e-9;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
// Circuncentro de 3 puntos (para 3-Point Arc). null si son colineales.
function circumcenter(a: XY, b: XY, c: XY): XY | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
}
function tessCircle(cx: number, cy: number, r: number): XY[] {
  const out: XY[] = [];
  for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2; out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  return out;
}
/**
 * Separa el boceto en PERFIL EXTERIOR + BARRENOS. Si hay un lazo de líneas, ese
 * es el exterior y TODO círculo dentro es un barreno (se taladra al extruir). Si
 * solo hay círculos, el primero es el exterior (disco) y los demás son barrenos.
 */
// Intersección recta(A,B)–círculo(centro C, radio r) en la recta INFINITA (para TRIM).
// Devuelve 0/1/2 puntos. Casi-tangente (disc≈0) → 1 punto. Usado por la herramienta Trim.
function lineCircleInts(A: XY, B: XY, C: XY, r: number): XY[] {
  const dx = B.x - A.x, dy = B.y - A.y;
  const fx = A.x - C.x, fy = A.y - C.y;
  const a = dx * dx + dy * dy; if (a < 1e-9) return [];
  const b = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - r * r;
  let disc = b * b - 4 * a * cc;
  if (disc < 0) { if (disc > -1e-4 * a * r * r) disc = 0; else return []; }
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a);
  const out: XY[] = [{ x: A.x + t1 * dx, y: A.y + t1 * dy }];
  if (sq > 1e-4) { const t2 = (-b + sq) / (2 * a); out.push({ x: A.x + t2 * dx, y: A.y + t2 * dy }); }
  return out;
}

function extractProfileAndHoles(s: Sketch): { profile: XY[]; holes: { x: number; y: number; d: number }[]; polyHoles: XY[][]; circle?: { x: number; y: number; r: number } } {
  let profile: XY[] = [];
  let polyHoles: XY[][] = [];
  let circlesForHoles = s.circles;
  let circle: { x: number; y: number; r: number } | undefined;
  const arcs = s.arcs ?? [];
  const realLines = s.lines.filter((l) => !l.constr);  // las de CONSTRUCCIÓN no forman parte del perfil
  // LAZO MIXTO líneas + arcos: camina ARISTAS (no puntos) y tesela cada arco en su
  // orden de recorrido. Esto vuelve EXTRUIBLE cualquier perfil con curvas (media-luna,
  // ranura redondeada, diente, leva...). El arco real barre CCW p0→p1; si lo cruzamos
  // al revés, invertimos la teselación.
  if (arcs.length > 0 && realLines.length + arcs.length >= 2) {
    const edges = [
      ...realLines.map((l) => ({ kind: 'line' as const, a: l.a, b: l.b })),
      ...arcs.map((ar) => ({ kind: 'arc' as const, c: ar.c, a: ar.p0, b: ar.p1 })),
    ];
    const adj = new Map<number, { edge: number; other: number }[]>();
    edges.forEach((e, ei) => {
      (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push({ edge: ei, other: e.b });
      (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push({ edge: ei, other: e.a });
    });
    const startPt = edges[0].a;
    let cur = startPt, prevEdge = -1;
    profile = [{ x: s.points[cur].x, y: s.points[cur].y }];
    for (let guard = 0; guard < edges.length + 2; guard++) {
      const opt = (adj.get(cur) ?? []).find((o) => o.edge !== prevEdge);
      if (!opt) break;
      const e = edges[opt.edge], next = opt.other;
      if (e.kind === 'line') {
        profile.push({ x: s.points[next].x, y: s.points[next].y });
      } else {
        const c = s.points[e.c];
        const real = tessArc(c.x, c.y, s.points[e.a].x, s.points[e.a].y, s.points[e.b].x, s.points[e.b].y);
        const ord = cur === e.a ? real : real.slice().reverse();
        for (let k = 1; k < ord.length; k++) profile.push(ord[k]);
      }
      prevEdge = opt.edge; cur = next;
      if (cur === startPt) break;
    }
    // HIGIENE DEL LAZO MIXTO (bisecado 2026-07-02): el caminador CIERRA empujando el
    // punto inicial otra vez, y la costura del arco snapeado puede duplicar el punto
    // de unión → puntos consecutivos idénticos → arista de longitud ~0 → OCCT crashea
    // el renderer al REVOLUCIONAR (extrude lo toleraba). Dedup + quitar el cierre.
    profile = profile.filter((p, i) => i === 0 || Math.hypot(p.x - profile[i - 1].x, p.y - profile[i - 1].y) > 1e-3);
    while (profile.length > 1 && Math.hypot(profile[0].x - profile[profile.length - 1].x, profile[0].y - profile[profile.length - 1].y) < 1e-3) profile.pop();
  } else if (realLines.length >= 3) {
    // MULTI-LAZO: detecta TODOS los lazos cerrados de líneas. El de MAYOR área es
    // el perfil exterior; los demás son cavidades (huecos poligonales). Así un
    // boceto de doble lazo (contorno + ventana) se vuelve sólido-con-cavidad,
    // como el Tutorial 1 de Fusion (extruir el exterior resta el interior).
    const loops = findLineLoops(realLines).filter((lp) => lp.length >= 3);
    if (loops.length) {
      const areaOf = (lp: number[]) => { let a = 0; for (let i = 0; i < lp.length; i++) { const p = s.points[lp[i]], q = s.points[lp[(i + 1) % lp.length]]; a += p.x * q.y - q.x * p.y; } return Math.abs(a / 2); };
      loops.sort((A, B) => areaOf(B) - areaOf(A));
      profile = loops[0].map((i) => ({ x: s.points[i].x, y: s.points[i].y }));
      polyHoles = loops.slice(1).map((lp) => lp.map((i) => ({ x: s.points[i].x, y: s.points[i].y })));
    }
  } else if ((s.ellipses ?? []).length >= 1 && s.lines.filter((l) => !l.constr).length === 0 && s.circles.length === 0) {
    // ELIPSE SOLA (molde cap 6: muescas Rx/Ry): perfil teselado 48 pts — extruible/cortable.
    const el = s.ellipses![0]; const cp = s.points[el.c];
    profile = Array.from({ length: 48 }, (_, k) => ({
      x: cp.x + el.rx * Math.cos((2 * Math.PI * k) / 48),
      y: cp.y + el.ry * Math.sin((2 * Math.PI * k) / 48) }));
  } else if (s.circles.length >= 1) {
    const c = s.circles[0]; const cp = s.points[c.c];
    profile = tessCircle(cp.x, cp.y, c.r);
    // CÍRCULO EXACTO (fix "el círculo tiene caras"): además del polígono de respaldo,
    // reporta el círculo real para que el kernel haga un CILINDRO (gp_Circ), no un prisma.
    circle = { x: cp.x, y: cp.y, r: c.r };
    circlesForHoles = s.circles.slice(1);
  }
  const holes = circlesForHoles.map((c) => ({ x: s.points[c.c].x, y: s.points[c.c].y, d: 2 * c.r }));
  return { profile, holes, polyHoles, circle };
}

// Encuentra TODOS los lazos cerrados de un conjunto de líneas (cada punto de un
// lazo simple tiene grado 2). Devuelve cada lazo como lista de índices de punto
// (sin repetir el de cierre). Separa perfil exterior de cavidades interiores.
function findLineLoops(lines: { a: number; b: number }[]): number[][] {
  const adj = new Map<number, { e: number; o: number }[]>();
  lines.forEach((l, ei) => {
    (adj.get(l.a) ?? adj.set(l.a, []).get(l.a)!).push({ e: ei, o: l.b });
    (adj.get(l.b) ?? adj.set(l.b, []).get(l.b)!).push({ e: ei, o: l.a });
  });
  const used = new Array(lines.length).fill(false);
  const loops: number[][] = [];
  for (let si = 0; si < lines.length; si++) {
    if (used[si]) continue;
    used[si] = true;
    const start = lines[si].a; let cur = lines[si].b;
    const loop = [start, cur];
    for (let guard = 0; guard < lines.length + 2 && cur !== start; guard++) {
      const nx = (adj.get(cur) ?? []).find((o) => !used[o.e]);
      if (!nx) break;
      used[nx.e] = true; loop.push(nx.o); cur = nx.o;
    }
    if (cur === start && loop.length >= 4) { loop.pop(); loops.push(loop); }
  }
  return loops;
}
