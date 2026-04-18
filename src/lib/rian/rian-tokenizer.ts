/**
 * Tokenize La Forja's SDF scene into the short, bucketed symbol stream RIAN
 * learns over.
 *
 * Design:
 *   - Every primitive becomes a small field-ordered token sequence:
 *       type -> size tokens -> position tokens -> rotation tokens (if non-zero)
 *   - Continuous dimensions are snapped to a fixed log-ish bucket list so the
 *     vocabulary stays small (~200 tokens) and generalization across sizes
 *     is free.
 *   - Operations add a single op token and an op_end marker. Modules are
 *     flattened — the label is intentionally dropped to keep vocab bounded.
 */

import type { SdfNode, SdfPrimitive, SdfOperation } from '@/lib/sdf-engine';
import { isPrimitive, isContainer } from '@/lib/sdf-engine';

const SIZE_BUCKETS = [1, 2, 5, 10, 20, 40, 80, 160, 320];
const POS_BUCKETS  = [0, 2, 5, 10, 20, 50, 100, 200];
const ROT_DEG_BUCKETS = [0, 15, 30, 45, 60, 90, 120, 135, 150, 180];

function nearest(v: number, buckets: number[]): number {
  let best = buckets[0], bd = Math.abs(v - best);
  for (let i = 1; i < buckets.length; i++) {
    const d = Math.abs(v - buckets[i]);
    if (d < bd) { best = buckets[i]; bd = d; }
  }
  return best;
}

function sizeTok(prefix: string, v: number): string {
  return `${prefix}${nearest(Math.abs(v), SIZE_BUCKETS)}`;
}

function posTok(axis: 'x' | 'y' | 'z', v: number): string {
  const b = nearest(Math.abs(v), POS_BUCKETS);
  if (b === 0) return `${axis}0`;
  return v < 0 ? `${axis}n${b}` : `${axis}p${b}`;
}

function rotTok(axis: 'rx' | 'ry' | 'rz', rad: number): string {
  let deg = ((rad * 180) / Math.PI) % 360;
  if (deg > 180) deg -= 360;
  if (deg < -180) deg += 360;
  const b = nearest(Math.abs(deg), ROT_DEG_BUCKETS);
  if (b === 0) return `${axis}0`;
  return deg < 0 ? `${axis}n${b}` : `${axis}p${b}`;
}

/** Tokenize one primitive. The field order per type is stable. */
export function tokenizePrimitive(p: SdfPrimitive): string[] {
  const out: string[] = [p.type];
  const P = p.params ?? {};
  switch (p.type) {
    case 'box':
      out.push(sizeTok('w', P.w ?? 1), sizeTok('h', P.h ?? 1), sizeTok('d', P.d ?? 1));
      break;
    case 'sphere':
      out.push(sizeTok('r', P.r ?? 1));
      break;
    case 'cylinder':
      out.push(sizeTok('r', P.r ?? 1), sizeTok('h', P.h ?? 1));
      break;
    case 'torus':
      out.push(sizeTok('R', P.R ?? 1), sizeTok('r', P.r ?? 0.3));
      break;
    case 'cone':
      out.push(sizeTok('r', P.r ?? 1), sizeTok('h', P.h ?? 1));
      break;
    case 'capsule':
      out.push(sizeTok('r', P.r ?? 0.5), sizeTok('h', P.h ?? 1));
      break;
    case 'polygon':
      out.push(sizeTok('d', P.depth ?? 1));
      break;
  }
  const [x, y, z] = p.position;
  out.push(posTok('x', x), posTok('y', y), posTok('z', z));
  const [rx, ry, rz] = p.rotation;
  if (rx || ry || rz) out.push(rotTok('rx', rx), rotTok('ry', ry), rotTok('rz', rz));
  return out;
}

export function tokenizeOperation(op: SdfOperation): string[] {
  const t = op.type === 'smoothUnion' ? 'smooth_union' : op.type;
  return [t];
}

/**
 * DFS-flatten the whole scene tree into a token stream. Operations wrap their
 * children with `<op>` ... `op_end`. Modules are passed through as plain
 * union-like containers (no label token).
 */
export function tokenizeScene(root: SdfNode): string[] {
  const out: string[] = [];
  const walk = (n: SdfNode) => {
    if (isPrimitive(n)) {
      out.push(...tokenizePrimitive(n));
      return;
    }
    if (n.kind === 'module') {
      for (const c of n.children) walk(c);
      return;
    }
    out.push(...tokenizeOperation(n));
    for (const c of n.children) walk(c);
    out.push('op_end');
  };
  walk(root);
  return out;
}

/**
 * Trim a long trace to the last N tokens — useful for ask() prefix, where we
 * only want recent context.
 */
export function tailTokens(trace: string[], n: number): string[] {
  return trace.length <= n ? trace.slice() : trace.slice(trace.length - n);
}
