/**
 * ⚒️ La Forja — Sketch Overlay
 * ==============================
 * Three.js R3F component that renders fitted sketch entities
 * (Lines + Arcs) as 3D line geometry overlaid on the imported mesh.
 *
 * Each fitted slice becomes a set of colored lines positioned in 3D
 * at the correct axis/value.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { FittedSlice, SketchEntity, SketchArc } from '../sketch-fitting';
import type { SliceAxis } from '../cross-section';

// ═══════════════════════════════════════════════════════════════
// Colors by entity type & axis
// ═══════════════════════════════════════════════════════════════

const AXIS_COLORS: Record<SliceAxis, string> = {
  X: '#f87171', // red
  Y: '#4ade80', // green
  Z: '#60a5fa', // blue
};

const CIRCLE_COLOR = '#c9a84c'; // gold for full circles
const ARC_COLOR = '#c084fc';    // purple for arcs
const LINE_COLOR = '#f0ece4';   // light for lines

// ═══════════════════════════════════════════════════════════════
// Convert 2D sketch point → 3D position
// ═══════════════════════════════════════════════════════════════

function to3D(p: { x: number; y: number }, axis: SliceAxis, value: number): THREE.Vector3 {
  switch (axis) {
    case 'X': return new THREE.Vector3(value, p.x, p.y);
    case 'Y': return new THREE.Vector3(p.x, value, p.y);
    case 'Z': return new THREE.Vector3(p.x, p.y, value);
  }
}

// ═══════════════════════════════════════════════════════════════
// Generate line segments for each entity
// ═══════════════════════════════════════════════════════════════

const ARC_SEGMENTS = 48;

function entityToPoints(entity: SketchEntity, axis: SliceAxis, value: number): THREE.Vector3[] {
  if (entity.type === 'line') {
    return [
      to3D(entity.start, axis, value),
      to3D(entity.end, axis, value),
    ];
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
  const pts: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = arc.startAngle + sweep * (i / segments);
    const p2d = {
      x: arc.center.x + arc.radius * Math.cos(angle),
      y: arc.center.y + arc.radius * Math.sin(angle),
    };
    pts.push(to3D(p2d, axis, value));
  }

  return pts;
}

function getEntityColor(entity: SketchEntity): string {
  if (entity.type === 'line') return LINE_COLOR;
  if ((entity as SketchArc).isFullCircle) return CIRCLE_COLOR;
  return ARC_COLOR;
}

// ═══════════════════════════════════════════════════════════════
// R3F Component
// ═══════════════════════════════════════════════════════════════

interface SketchEntityGroupProps {
  entities: SketchEntity[];
  axis: SliceAxis;
  value: number;
}

/** Renders a group of sketch entities for one slice */
function SketchEntityGroup({ entities, axis, value }: SketchEntityGroupProps) {
  const geometries = useMemo(() => {
    const result: { geo: THREE.BufferGeometry; color: string }[] = [];

    for (const entity of entities) {
      const pts = entityToPoints(entity, axis, value);
      if (pts.length < 2) continue;

      const positions = new Float32Array(pts.length * 3);
      for (let i = 0; i < pts.length; i++) {
        positions[i * 3] = pts[i].x;
        positions[i * 3 + 1] = pts[i].y;
        positions[i * 3 + 2] = pts[i].z;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      result.push({ geo, color: getEntityColor(entity) });
    }

    return result;
  }, [entities, axis, value]);

  return (
    <group>
      {geometries.map((g, i) => (
        <line key={i}>
          <primitive object={g.geo} attach="geometry" />
          <lineBasicMaterial
            color={g.color}
            transparent
            opacity={0.85}
            linewidth={1}
            depthTest={false}
          />
        </line>
      ))}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Overlay Component
// ═══════════════════════════════════════════════════════════════

export interface SketchOverlayProps {
  slices: FittedSlice[];
  /** Show only a specific axis (null = show all) */
  filterAxis?: SliceAxis | null;
  /** Opacity multiplier 0-1 */
  opacity?: number;
  visible?: boolean;
}

/**
 * Renders all fitted sketch entities as 3D line overlays.
 * Position each slice's entities at the correct 3D plane.
 */
export default function SketchOverlay({
  slices,
  filterAxis,
  opacity = 0.85,
  visible = true,
}: SketchOverlayProps) {
  if (!visible || slices.length === 0) return null;

  const filtered = filterAxis ? slices.filter(s => s.axis === filterAxis) : slices;

  return (
    <group name="sketch-overlay">
      {filtered.map((slice, si) => (
        <group key={`${slice.axis}-${slice.value}-${si}`}>
          {slice.contours.map((contour, ci) => (
            <SketchEntityGroup
              key={ci}
              entities={contour.entities}
              axis={slice.axis}
              value={slice.value}
            />
          ))}
        </group>
      ))}
    </group>
  );
}
