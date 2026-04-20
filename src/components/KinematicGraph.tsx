/**
 * Kinematic Graph — 2D visualization of the assembly's joint structure.
 * Right-side panel: components as nodes, joints as edges. Click an edge
 * to select that joint (opens the scrubber).
 *
 * Layout: simple force-directed relaxation run once per joint-graph change.
 * No drag-to-rearrange yet — comes with the next polish pass.
 */

import { useMemo, useState } from 'react';
import { useForgeStore } from '@/lib/useForgeStore';
import { collectModules } from '@/lib/joint-transforms';
import type { Joint } from '@/lib/joints';
import type { SdfModule } from '@/lib/sdf-engine';

interface NodePos {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
}

const W = 280;
const H = 240;

function layoutNodes(modules: SdfModule[], joints: Joint[]): NodePos[] {
  const n = modules.length;
  if (n === 0) return [];

  // Start: circle layout
  const nodes: NodePos[] = modules.map((m, i) => {
    const a = (i / n) * Math.PI * 2;
    return {
      id: m.id,
      label: m.label,
      color: m.color,
      x: W / 2 + Math.cos(a) * (W * 0.35),
      y: H / 2 + Math.sin(a) * (H * 0.35),
    };
  });

  // 50 iterations of a tiny force-directed relaxation
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  for (let iter = 0; iter < 50; iter++) {
    // Repulsion (O(n²) — fine for small assemblies)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d2 = dx * dx + dy * dy + 1;
        const f = 800 / d2;
        const fx = (dx / Math.sqrt(d2)) * f;
        const fy = (dy / Math.sqrt(d2)) * f;
        nodes[i].x += fx; nodes[i].y += fy;
        nodes[j].x -= fx; nodes[j].y -= fy;
      }
    }
    // Attraction along joint edges
    for (const e of joints) {
      const a = idx.get(e.a); const b = idx.get(e.b);
      if (a == null || b == null) continue;
      const dx = nodes[a].x - nodes[b].x;
      const dy = nodes[a].y - nodes[b].y;
      const d = Math.sqrt(dx * dx + dy * dy) + 1;
      const f = (d - 70) * 0.05;
      nodes[a].x -= (dx / d) * f; nodes[a].y -= (dy / d) * f;
      nodes[b].x += (dx / d) * f; nodes[b].y += (dy / d) * f;
    }
    // Clamp to viewport
    for (const nd of nodes) {
      nd.x = Math.max(24, Math.min(W - 24, nd.x));
      nd.y = Math.max(20, Math.min(H - 20, nd.y));
    }
  }

  return nodes;
}

const JOINT_COLOR: Record<Joint['type'], string> = {
  rigid: 'var(--c-text-3)',
  revolute: 'var(--c-gold)',
  slider: 'var(--c-blue)',
};

const JOINT_STROKE: Record<Joint['type'], string> = {
  rigid: '4 3',
  revolute: 'none',
  slider: '1 3',
};

export default function KinematicGraph() {
  const scene = useForgeStore(s => s.scene);
  const joints = useForgeStore(s => s.joints);
  const selectedJointId = useForgeStore(s => s.selectedJointId);
  const setSelectedJoint = useForgeStore(s => s.setSelectedJoint);
  const setSelectedId = useForgeStore(s => s.setSelectedId);
  const colliding = useForgeStore(s => s.collidingModuleIds);
  const [open, setOpen] = useState(true);

  const modules = useMemo(() => collectModules(scene), [scene]);
  const nodes = useMemo(() => layoutNodes(modules, joints), [modules, joints]);
  const nodeById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  if (modules.length === 0 && joints.length === 0) return null;

  return (
    <div
      className="absolute top-40 right-3 z-20 rounded-md forge-glass"
      style={{
        border: '1px solid var(--c-border)',
        background: 'var(--panel-glass)',
        width: open ? W + 16 : 120,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wider hover:bg-accent/30"
        style={{ color: 'var(--c-gold)' }}
      >
        <span>Grafo ({modules.length}n · {joints.length}e)</span>
        <span className="opacity-60">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block mx-2 mb-2">
          {/* Edges */}
          {joints.map(j => {
            const a = nodeById.get(j.a); const b = nodeById.get(j.b);
            if (!a || !b) return null;
            const selected = j.id === selectedJointId;
            return (
              <g key={j.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedJoint(j.id)}>
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={JOINT_COLOR[j.type]}
                  strokeWidth={selected ? 2.5 : 1.5}
                  strokeDasharray={JOINT_STROKE[j.type]}
                  opacity={selected ? 1 : 0.75}
                />
                <circle
                  cx={(a.x + b.x) / 2}
                  cy={(a.y + b.y) / 2}
                  r={selected ? 5 : 3.5}
                  fill={JOINT_COLOR[j.type]}
                  stroke="var(--c-base)"
                  strokeWidth={1}
                />
                <title>{j.type} · {j.label}</title>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const isColliding = colliding.has(n.id);
            return (
              <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(n.id)}>
                {isColliding && (
                  <circle cx={n.x} cy={n.y} r={14}
                    fill="none" stroke="var(--c-red)" strokeWidth={2}
                    opacity={0.7} style={{ animation: 'pulse 1.2s ease-in-out infinite' }} />
                )}
                <circle cx={n.x} cy={n.y} r={10}
                  fill={isColliding ? 'var(--c-red)' : n.color}
                  stroke="var(--c-base)" strokeWidth={2} />
                <text
                  x={n.x} y={n.y + 22}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isColliding ? 'var(--c-red)' : 'var(--c-text-2)'}
                  style={{ fontFamily: 'var(--font-sans)', pointerEvents: 'none' }}
                >
                  {n.label.length > 16 ? n.label.slice(0, 15) + '…' : n.label}
                </text>
              </g>
            );
          })}

          {/* Legend */}
          <g transform={`translate(8, ${H - 8})`} fontSize={8} fill="var(--c-text-3)">
            <line x1={0} y1={-2} x2={16} y2={-2} stroke={JOINT_COLOR.rigid} strokeDasharray={JOINT_STROKE.rigid} strokeWidth={1.5} />
            <text x={20} y={0}>rígido</text>
            <line x1={58} y1={-2} x2={74} y2={-2} stroke={JOINT_COLOR.revolute} strokeWidth={1.5} />
            <text x={78} y={0}>bisagra</text>
            <line x1={120} y1={-2} x2={136} y2={-2} stroke={JOINT_COLOR.slider} strokeDasharray={JOINT_STROKE.slider} strokeWidth={1.5} />
            <text x={140} y={0}>slider</text>
          </g>
        </svg>
      )}
    </div>
  );
}
