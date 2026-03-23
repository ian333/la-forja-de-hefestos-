/**
 * ⚒️ La Forja — In-Viewport Sketch Drawing
 * ==========================================
 * Draw sketch shapes directly on the 3D sketch plane inside the R3F Canvas.
 * Uses DOM pointer events + THREE.Raycaster.ray.intersectPlane for precise
 * plane intersection regardless of scene geometry.
 *
 * Features:
 *  - Rectangle & circle tools (click-drag)
 *  - Grid snap (0.25 units)
 *  - Live dimension labels (drei Html)
 *  - Cursor crosshair with snap dot
 *  - Always-visible sketch lines (depthTest=false)
 *  - Camera stays interactive (right=orbit, middle=pan, scroll=zoom)
 */

import { useRef, useState, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SketchPlane, SketchShape, SketchRect, SketchCircle } from './sketch-engine';
import { PLANE_COLORS } from './sketch-engine';

export type SketchTool = 'rect' | 'circle';

interface Props {
  plane: SketchPlane;
  tool: SketchTool;
  shapes: SketchShape[];
  onShapeAdd: (shape: SketchShape) => void;
  onDrawingChange: (active: boolean) => void;
  onCursorMove?: (x: number, y: number) => void;
}

// ── Constants ──
const SNAP = 0.25;
const CSEG = 64;
const E = 0.003; // tiny offset above the plane so lines sit on top of the grid

const snap = (v: number) => Math.round(v / SNAP) * SNAP;

let _uid = 100;
const uid = () => `vsk${++_uid}`;

// ── Coordinate helpers ──

function getPlaneNormal(p: SketchPlane): THREE.Vector3 {
  switch (p) {
    case 'XY': return new THREE.Vector3(0, 0, 1);
    case 'XZ': return new THREE.Vector3(0, 1, 0);
    case 'YZ': return new THREE.Vector3(1, 0, 0);
  }
}

function to2D(v: THREE.Vector3, p: SketchPlane): [number, number] {
  switch (p) {
    case 'XY': return [v.x, v.y];
    case 'XZ': return [v.x, v.z];
    case 'YZ': return [v.y, v.z];
  }
}

function to3D(x: number, y: number, p: SketchPlane): [number, number, number] {
  switch (p) {
    case 'XY': return [x, y, E];
    case 'XZ': return [x, E, y];
    case 'YZ': return [E, x, y];
  }
}

// ── Geometry generators ──

function rectPts(cx: number, cy: number, w: number, h: number, p: SketchPlane): [number, number, number][] {
  const hw = w / 2, hh = h / 2;
  return [
    to3D(cx - hw, cy - hh, p),
    to3D(cx + hw, cy - hh, p),
    to3D(cx + hw, cy + hh, p),
    to3D(cx - hw, cy + hh, p),
    to3D(cx - hw, cy - hh, p), // close loop
  ];
}

function circlePts(cx: number, cy: number, r: number, p: SketchPlane): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= CSEG; i++) {
    const a = (i / CSEG) * Math.PI * 2;
    pts.push(to3D(cx + r * Math.cos(a), cy + r * Math.sin(a), p));
  }
  return pts;
}

// ── Dimension label (Html overlay at 3D position) ──

function Dim({ position, text, color }: { position: [number, number, number]; text: string; color: string }) {
  return (
    <Html position={position} center style={{ pointerEvents: 'none' }}>
      <div style={{
        background: 'rgba(8,9,13,0.88)',
        border: `1px solid ${color}30`,
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace',
        color,
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(8px)',
        userSelect: 'none',
      }}>
        {text}
      </div>
    </Html>
  );
}

// ── Sketch line (native Three.js Line, supports depthTest=false) ──

function SketchLine({ points, color, opacity = 1 }: {
  points: [number, number, number][];
  color: string;
  opacity?: number;
}) {
  const ref = useRef<THREE.Line>(null!);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    return g;
  }, [points]);
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity }),
    [color, opacity],
  );
  return <primitive ref={ref} object={new THREE.Line(geo, mat)} renderOrder={999} />;
}

// ── Main component ──

export default function SketchInViewport({
  plane, tool, shapes, onShapeAdd, onDrawingChange, onCursorMove,
}: Props) {
  const { camera, gl } = useThree();
  const [drawStart, setDrawStart] = useState<[number, number] | null>(null);
  const [cursor, setCursor] = useState<[number, number]>([0, 0]);

  const color = PLANE_COLORS[plane];

  // ── Stable refs for event handler closures ──
  const toolRef = useRef(tool);
  const addRef = useRef(onShapeAdd);
  const drawRef = useRef(onDrawingChange);
  const curRef = useRef(onCursorMove);
  const drawStartRef = useRef<[number, number] | null>(null);
  const cursorRef = useRef<[number, number]>([0, 0]);

  // Keep refs in sync
  useEffect(() => { toolRef.current = tool; });
  useEffect(() => { addRef.current = onShapeAdd; });
  useEffect(() => { drawRef.current = onDrawingChange; });
  useEffect(() => { curRef.current = onCursorMove; });

  // ── DOM pointer events → raycast to sketch plane ──
  useEffect(() => {
    const canvas = gl.domElement;
    const rc = new THREE.Raycaster();
    const p3 = new THREE.Plane(getPlaneNormal(plane), 0);

    const hit = (e: PointerEvent): [number, number] | null => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      rc.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const target = new THREE.Vector3();
      if (!rc.ray.intersectPlane(p3, target)) return null;
      const [x, y] = to2D(target, plane);
      return [snap(x), snap(y)];
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // only left click
      const t = toolRef.current;
      if (t !== 'rect' && t !== 'circle') return;
      const pt = hit(e);
      if (!pt) return;
      drawStartRef.current = pt;
      setDrawStart(pt);
      drawRef.current(true);
    };

    const onMove = (e: PointerEvent) => {
      const pt = hit(e);
      if (!pt) return;
      cursorRef.current = pt;
      setCursor(pt);
      curRef.current?.(pt[0], pt[1]);
    };

    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const ds = drawStartRef.current;
      if (!ds) return;
      const pt = hit(e) ?? cursorRef.current;
      const t = toolRef.current;

      if (t === 'rect') {
        const w = Math.abs(pt[0] - ds[0]);
        const h = Math.abs(pt[1] - ds[1]);
        if (w > 0.05 && h > 0.05) {
          addRef.current({
            kind: 'rect', id: uid(),
            cx: (ds[0] + pt[0]) / 2, cy: (ds[1] + pt[1]) / 2,
            width: w, height: h,
          } as SketchRect);
        }
      } else if (t === 'circle') {
        const r = snap(Math.sqrt((pt[0] - ds[0]) ** 2 + (pt[1] - ds[1]) ** 2));
        if (r > 0.05) {
          addRef.current({
            kind: 'circle', id: uid(),
            cx: ds[0], cy: ds[1], radius: r,
          } as SketchCircle);
        }
      }

      drawStartRef.current = null;
      setDrawStart(null);
      drawRef.current(false);
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [gl, camera, plane]);

  // ── Computed: preview shape while drawing ──
  const preview = useMemo((): [number, number, number][] | null => {
    if (!drawStart) return null;
    const [cx, cy] = cursor;
    if (tool === 'rect') {
      const w = Math.abs(cx - drawStart[0]);
      const h = Math.abs(cy - drawStart[1]);
      if (w < 0.01 && h < 0.01) return null;
      return rectPts((drawStart[0] + cx) / 2, (drawStart[1] + cy) / 2, w, h, plane);
    } else {
      const r = Math.sqrt((cx - drawStart[0]) ** 2 + (cy - drawStart[1]) ** 2);
      if (r < 0.01) return null;
      return circlePts(drawStart[0], drawStart[1], r, plane);
    }
  }, [drawStart, cursor, tool, plane]);

  // ── Computed: preview dimension labels ──
  const prevDims = useMemo(() => {
    if (!drawStart) return [];
    const [cx, cy] = cursor;
    if (tool === 'rect') {
      const w = Math.abs(cx - drawStart[0]);
      const h = Math.abs(cy - drawStart[1]);
      if (w < 0.05 || h < 0.05) return [];
      const mcx = (drawStart[0] + cx) / 2;
      const mcy = (drawStart[1] + cy) / 2;
      return [
        { pos: to3D(mcx, mcy + h / 2 + 0.3, plane), text: w.toFixed(2) },
        { pos: to3D(mcx + w / 2 + 0.4, mcy, plane), text: h.toFixed(2) },
      ];
    } else {
      const r = Math.sqrt((cx - drawStart[0]) ** 2 + (cy - drawStart[1]) ** 2);
      if (r < 0.05) return [];
      return [{ pos: to3D(drawStart[0] + r / 2, drawStart[1] + 0.3, plane), text: `R${r.toFixed(2)}` }];
    }
  }, [drawStart, cursor, tool, plane]);

  // ── Computed: cursor crosshair line points ──
  const cursorLines = useMemo(() => {
    const [x, y] = cursor;
    const s = 0.18;
    return {
      h: [to3D(x - s, y, plane), to3D(x + s, y, plane)],
      v: [to3D(x, y - s, plane), to3D(x, y + s, plane)],
    };
  }, [cursor, plane]);

  // ── Render ──
  return (
    <group>
      {/* ── Cursor crosshair ── */}
      <SketchLine points={cursorLines.h} color={color} opacity={0.6} />
      <SketchLine points={cursorLines.v} color={color} opacity={0.6} />

      {/* Snap dot */}
      <mesh position={to3D(cursor[0], cursor[1], plane)} renderOrder={1000}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>

      {/* ── Completed shapes ── */}
      {shapes.map(s => {
        if (s.kind === 'rect') {
          const r = s as SketchRect;
          return (
            <group key={s.id}>
              <SketchLine points={rectPts(r.cx, r.cy, r.width, r.height, plane)} color={color} />
              <Dim position={to3D(r.cx, r.cy + r.height / 2 + 0.25, plane)} text={r.width.toFixed(2)} color={color} />
              <Dim position={to3D(r.cx + r.width / 2 + 0.3, r.cy, plane)} text={r.height.toFixed(2)} color={color} />
            </group>
          );
        } else {
          const c = s as SketchCircle;
          return (
            <group key={s.id}>
              <SketchLine points={circlePts(c.cx, c.cy, c.radius, plane)} color={color} />
              {/* Radius line (dashed via lower opacity) */}
              <SketchLine points={[to3D(c.cx, c.cy, plane), to3D(c.cx + c.radius, c.cy, plane)]} color={color} opacity={0.4} />
              <Dim position={to3D(c.cx + c.radius / 2, c.cy + 0.25, plane)} text={`R${c.radius.toFixed(2)}`} color={color} />
            </group>
          );
        }
      })}

      {/* ── Drawing preview ── */}
      {preview && <SketchLine points={preview} color={color} opacity={0.5} />}
      {prevDims.map((d, i) => (
        <Dim key={`pd${i}`} position={d.pos} text={d.text} color={color} />
      ))}
    </group>
  );
}
