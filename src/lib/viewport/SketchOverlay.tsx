/**
 * ⚒️ La Forja — Sketch Overlay (Batched)
 * =========================================
 * Three.js R3F component that renders fitted sketch entities
 * (Lines + Arcs) as 3D line geometry overlaid on the imported mesh.
 *
 * PERFORMANCE: All entities are batched into 3 draw calls total
 * (one per color: lines=white, arcs=purple, circles=gold).
 * This handles 10K+ entities at 60fps.
 */

import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { FittedSlice, SketchEntity, SketchArc } from '../sketch-fitting';
import type { SliceAxis } from '../cross-section';

// ═══════════════════════════════════════════════════════════════
// Colors by entity type
// ═══════════════════════════════════════════════════════════════

const CIRCLE_COLOR = new THREE.Color('#c9a84c'); // gold for full circles
const ARC_COLOR    = new THREE.Color('#c084fc');  // purple for arcs
const LINE_COLOR   = new THREE.Color('#f0ece4');  // light for lines

// ═══════════════════════════════════════════════════════════════
// 2D → 3D mapping
// ═══════════════════════════════════════════════════════════════

interface PlaneBasis {
  origin: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
}

/** Legacy fallback (only correct for Z axis) */
function to3DLegacy(px: number, py: number, axis: SliceAxis, value: number): [number, number, number] {
  switch (axis) {
    case 'X': return [value, px, py];
    case 'Y': return [px, value, py];
    case 'Z': return [px, py, value];
  }
}

/** Correct mapping using real plane basis from GPU render */
function to3DBasis(px: number, py: number, b: PlaneBasis): [number, number, number] {
  return [
    b.origin.x + px * b.u.x + py * b.v.x,
    b.origin.y + px * b.u.y + py * b.v.y,
    b.origin.z + px * b.u.z + py * b.v.z,
  ];
}

function mapPt(
  px: number, py: number,
  axis: SliceAxis, value: number,
  basis?: PlaneBasis,
): [number, number, number] {
  return basis ? to3DBasis(px, py, basis) : to3DLegacy(px, py, axis, value);
}

// ═══════════════════════════════════════════════════════════════
// Collect line-segment pairs into flat arrays (for THREE.LineSegments)
// ═══════════════════════════════════════════════════════════════

const ARC_SEGMENTS = 48;

/**
 * Push segment pairs for one entity into the target array.
 * Uses LineSegments format: every consecutive pair of vertices = one segment.
 */
function pushEntity(
  entity: SketchEntity,
  target: number[],
  axis: SliceAxis,
  value: number,
  basis?: PlaneBasis,
) {
  if (entity.type === 'line') {
    const a = mapPt(entity.start.x, entity.start.y, axis, value, basis);
    const b = mapPt(entity.end.x, entity.end.y, axis, value, basis);
    target.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    return;
  }

  // Arc or full circle
  const arc = entity as SketchArc;
  let sweep = arc.endAngle - arc.startAngle;
  if (arc.isFullCircle) {
    sweep = Math.PI * 2;
  } else {
    while (sweep > 2 * Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -2 * Math.PI) sweep += 2 * Math.PI;
  }

  const segments = Math.max(8, Math.ceil(Math.abs(sweep) / (2 * Math.PI) * ARC_SEGMENTS));
  let prev: [number, number, number] | null = null;

  for (let i = 0; i <= segments; i++) {
    const angle = arc.startAngle + sweep * (i / segments);
    const px = arc.center.x + arc.radius * Math.cos(angle);
    const py = arc.center.y + arc.radius * Math.sin(angle);
    const pt = mapPt(px, py, axis, value, basis);
    if (prev) {
      target.push(prev[0], prev[1], prev[2], pt[0], pt[1], pt[2]);
    }
    prev = pt;
  }
}

// ═══════════════════════════════════════════════════════════════
// Batched LineSegments component — one draw call each
// ═══════════════════════════════════════════════════════════════

function BatchedLines({ positions, color, opacity }: {
  positions: Float32Array;
  color: THREE.Color;
  opacity: number;
}) {
  const geo = useMemo(() => {
    if (positions.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useEffect(() => {
    return () => { geo?.dispose(); };
  }, [geo]);

  if (!geo) return null;

  return (
    <lineSegments frustumCulled={false} renderOrder={999} geometry={geo}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthTest={false}
      />
    </lineSegments>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Overlay Component
// ═══════════════════════════════════════════════════════════════

export interface SketchOverlayProps {
  slices: FittedSlice[];
  /** Show only a specific axis (null = show all) */
  filterAxis?: SliceAxis | null;
  /** Show only a single slice by index (null = show all) */
  selectedSlice?: number | null;
  /** Opacity multiplier 0-1 */
  opacity?: number;
  visible?: boolean;
}

/**
 * Renders all fitted sketch entities as 3D line overlays.
 *
 * BATCHED: merges ALL visible entities into 3 Float32Arrays
 * (line/arc/circle) for minimal GPU draw calls — smooth at 25K+ entities.
 */
export default function SketchOverlay({
  slices,
  filterAxis,
  selectedSlice,
  opacity = 0.85,
  visible = true,
}: SketchOverlayProps) {
  // Filter slices by axis and/or selection
  const filtered = useMemo(() => {
    let result = slices;
    if (filterAxis) result = result.filter(s => s.axis === filterAxis);
    if (selectedSlice != null) result = [result[selectedSlice]].filter(Boolean);
    return result;
  }, [slices, filterAxis, selectedSlice]);

  // Build 3 batched position arrays (one per color)
  const { lineArr, arcArr, circleArr } = useMemo(() => {
    const linePos: number[] = [];
    const arcPos: number[] = [];
    const circlePos: number[] = [];

    for (const slice of filtered) {
      let basis: PlaneBasis | undefined;
      if (slice.uAxis && slice.vAxis && slice.planeOrigin) {
        basis = {
          origin: new THREE.Vector3(...slice.planeOrigin),
          u: new THREE.Vector3(...slice.uAxis),
          v: new THREE.Vector3(...slice.vAxis),
        };
      }

      for (const contour of slice.contours) {
        for (const entity of contour.entities) {
          const target =
            entity.type === 'line' ? linePos
            : (entity as SketchArc).isFullCircle ? circlePos
            : arcPos;
          pushEntity(entity, target, slice.axis, slice.value, basis);
        }
      }
    }

    return {
      lineArr: new Float32Array(linePos),
      arcArr: new Float32Array(arcPos),
      circleArr: new Float32Array(circlePos),
    };
  }, [filtered]);

  if (!visible || filtered.length === 0) return null;

  return (
    <group name="sketch-overlay">
      <BatchedLines positions={lineArr}   color={LINE_COLOR}   opacity={opacity} />
      <BatchedLines positions={arcArr}    color={ARC_COLOR}    opacity={opacity} />
      <BatchedLines positions={circleArr} color={CIRCLE_COLOR} opacity={opacity} />
    </group>
  );
}
