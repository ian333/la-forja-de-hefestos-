/**
 * La Forja — AI-Driven Scene DSL
 * ================================
 * Declarative scripting API that lets Claude (and humans) compose the scene
 * as code. Edit `src/forja/scene.ts`; the runner hydrates `useForgeStore`
 * and Vite HMR re-renders on save.
 *
 * Design:
 *   - Pure data: helpers return `SdfNode`s, no store mutation.
 *   - Short names mirror Fusion/SolidWorks verbs: `box`, `cylinder`, `subtract`.
 *   - Variables: `forja.variable('width', 50)` returns a number AND registers
 *     the variable so it shows up in the Variables panel.
 *   - Units: positions/sizes are in scene units (~meters). 1 = 1m; 0.01 = 1cm.
 *
 * Example:
 *   export default defineScene((f) => {
 *     const w = f.variable('width', 0.8);
 *     const h = f.variable('height', 0.4);
 *     const body = f.box({ size: [w, h, 0.2], at: [0, h/2, 0], name: 'Body' });
 *     const hole = f.cylinder({ r: 0.05, h: 0.3, at: [0, h/2, 0] });
 *     f.add(f.subtract(body, hole));
 *   });
 */

import {
  type SdfNode,
  type SdfPrimitive,
  type SdfOperation,
  type SdfModule,
  makeSphere,
  makeBox,
  makeCylinder,
  makeTorus,
  makeCone,
  makeCapsule,
  makePolygonExtrusion,
  makeOp,
  makeModule,
} from '@/lib/sdf-engine';
import {
  type Joint,
  makeRigidJoint,
  makeRevoluteJoint,
  makeSliderJoint,
} from '@/lib/joints';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type Vec3 = [number, number, number];

export interface BoxOpts {
  /** Center position (world). Default [0, size.y/2, 0] (sitting on ground). */
  at?: Vec3;
  /** Euler rotation XYZ in radians. */
  rot?: Vec3;
  /** Size as [w, h, d] or uniform scalar. */
  size?: Vec3 | number;
  /** Width (X). Overrides size[0]. */
  w?: number;
  /** Height (Y). Overrides size[1]. */
  h?: number;
  /** Depth (Z). Overrides size[2]. */
  d?: number;
  /** Label shown in outliner. */
  name?: string;
}

export interface CylinderOpts {
  at?: Vec3;
  rot?: Vec3;
  /** Radius. */
  r?: number;
  /** Full height. */
  h?: number;
  name?: string;
}

export interface SphereOpts {
  at?: Vec3;
  r?: number;
  name?: string;
}

export interface ConeOpts {
  at?: Vec3;
  rot?: Vec3;
  r?: number;
  h?: number;
  name?: string;
}

export interface TorusOpts {
  at?: Vec3;
  rot?: Vec3;
  /** Major radius (center ring). */
  R?: number;
  /** Minor radius (tube). */
  r?: number;
  name?: string;
}

export interface ExtrudeOpts {
  at?: Vec3;
  rot?: Vec3;
  name?: string;
}

export interface VariableOpts {
  unit?: 'mm' | 'cm' | 'm' | 'in' | 'deg' | 'rad' | 'none';
  group?: string;
  description?: string;
  min?: number;
  max?: number;
}

export interface ScriptVariable {
  name: string;
  expression: string;
  resolvedValue: number;
  opts: VariableOpts;
}

export interface ScriptResult {
  /** Top-level children added via `forja.add(...)`. */
  rootChildren: SdfNode[];
  /** Variables declared via `forja.variable(...)`. */
  variables: ScriptVariable[];
  /** Joints declared via `forja.joint.*(...)`. */
  joints: Joint[];
  /** Optional: replace entire scene (when user calls `forja.setRoot(...)`). */
  rootOverride: SdfOperation | null;
}

// ═══════════════════════════════════════════════════════════════
// Builder
// ═══════════════════════════════════════════════════════════════

export class ForjaContext {
  private _root: SdfNode[] = [];
  private _vars: ScriptVariable[] = [];
  private _joints: Joint[] = [];
  private _rootOverride: SdfOperation | null = null;

  /** Wipe the scene (implicit — the runner starts fresh every run). */
  clear(): void {
    this._root.length = 0;
    this._vars.length = 0;
    this._joints.length = 0;
    this._rootOverride = null;
  }

  /**
   * Declare a named variable. Returns the resolved numeric value so you can
   * use it inline: `f.box({ w: f.variable('w', 0.5) })`.
   */
  variable(name: string, expression: string | number, opts: VariableOpts = {}): number {
    const expr = typeof expression === 'number' ? String(expression) : expression;
    const resolved = typeof expression === 'number' ? expression : Number(expression);
    const v: ScriptVariable = {
      name,
      expression: expr,
      resolvedValue: Number.isFinite(resolved) ? resolved : 0,
      opts,
    };
    this._vars.push(v);
    return v.resolvedValue;
  }

  // ── Primitives ────────────────────────────────────────────────

  box(opts: BoxOpts = {}): SdfPrimitive {
    const size = this._resolveSize(opts.size, [1, 1, 1]);
    const w = opts.w ?? size[0];
    const h = opts.h ?? size[1];
    const d = opts.d ?? size[2];
    const at = opts.at ?? [0, h / 2, 0];
    const node = makeBox(at, [w, h, d]);
    if (opts.rot) node.rotation = opts.rot;
    if (opts.name) node.label = opts.name;
    return node;
  }

  cylinder(opts: CylinderOpts = {}): SdfPrimitive {
    const r = opts.r ?? 0.5;
    const h = opts.h ?? 1;
    const at = opts.at ?? [0, h / 2, 0];
    // params.height is FULL height; the GLSL compiler halves it internally.
    const node = makeCylinder(at, r, h);
    if (opts.rot) node.rotation = opts.rot;
    if (opts.name) node.label = opts.name;
    return node;
  }

  sphere(opts: SphereOpts = {}): SdfPrimitive {
    const r = opts.r ?? 0.5;
    const at = opts.at ?? [0, r, 0];
    const node = makeSphere(at, r);
    if (opts.name) node.label = opts.name;
    return node;
  }

  cone(opts: ConeOpts = {}): SdfPrimitive {
    const r = opts.r ?? 0.5;
    const h = opts.h ?? 1;
    const at = opts.at ?? [0, 0, 0];
    const node = makeCone(at, r, h);
    if (opts.rot) node.rotation = opts.rot;
    if (opts.name) node.label = opts.name;
    return node;
  }

  torus(opts: TorusOpts = {}): SdfPrimitive {
    const R = opts.R ?? 1;
    const r = opts.r ?? 0.25;
    const at = opts.at ?? [0, r, 0];
    const node = makeTorus(at, R, r);
    if (opts.rot) node.rotation = opts.rot;
    if (opts.name) node.label = opts.name;
    return node;
  }

  capsule(from: Vec3, to: Vec3, radius = 0.05, opts: { name?: string } = {}): SdfPrimitive {
    const node = makeCapsule(from, to, radius);
    if (opts.name) node.label = opts.name;
    return node;
  }

  /**
   * Extrude a 2D polygon profile along Z. `verts` are [x,y] pairs in the
   * local plane; `height` is the extrusion length. Use `rot` to orient.
   */
  extrude(verts: Array<[number, number]>, height: number, opts: ExtrudeOpts = {}): SdfPrimitive {
    const at = opts.at ?? [0, 0, 0];
    const rot = opts.rot ?? [0, 0, 0];
    const node = makePolygonExtrusion(verts, height, at, rot, opts.name ?? 'Perfil');
    return node;
  }

  // ── Boolean Operations ────────────────────────────────────────

  union(...children: SdfNode[]): SdfOperation {
    return makeOp('union', children);
  }

  subtract(base: SdfNode, ...tools: SdfNode[]): SdfOperation {
    return makeOp('subtract', [base, ...tools]);
  }

  intersect(...children: SdfNode[]): SdfOperation {
    return makeOp('intersect', children);
  }

  /** Smooth (blended) union. `k` controls the fillet radius at the join. */
  smooth(k: number, ...children: SdfNode[]): SdfOperation {
    const op = makeOp('smoothUnion', children);
    op.smoothness = k;
    return op;
  }

  // ── Grouping (named container, like a Fusion Component) ───────

  group(name: string, ...children: SdfNode[]): SdfModule {
    const mod = makeModule(name);
    mod.children = children;
    return mod;
  }

  // ── Joints (assembly kinematics) ─────────────────────────────
  /**
   * Join two components. v1 supports rigid (fixed), revolute (hinge), and
   * slider (linear). Both `a` and `b` must be `f.group(...)` modules.
   *
   *   const hinge = f.joint.revolute(tapa, base, {
   *     origin: [0, 0.3, 0],  // anchor point in world coords
   *     axis:   [1, 0, 0],    // rotation axis (unit vector)
   *     limits: { min: 0, max: Math.PI / 2 },  // 0 → 90°
   *     drive:  Math.PI / 4,                   // open at 45°
   *   });
   */
  joint = {
    rigid: (a: SdfModule, b: SdfModule, opts: { origin?: Vec3; label?: string } = {}): Joint => {
      const j = makeRigidJoint(a.id, b.id, opts.origin ?? [0, 0, 0], opts.label ?? `${a.label}↔${b.label}`);
      this._joints.push(j);
      return j;
    },
    revolute: (a: SdfModule, b: SdfModule, opts: {
      origin: Vec3; axis: Vec3;
      limits?: { min: number; max: number };
      drive?: number;
      label?: string;
    }): Joint => {
      const j = makeRevoluteJoint(a.id, b.id, opts.origin, opts.axis, {
        limits: opts.limits,
        drive: opts.drive,
        label: opts.label ?? `Bisagra ${a.label}↔${b.label}`,
      });
      this._joints.push(j);
      return j;
    },
    slider: (a: SdfModule, b: SdfModule, opts: {
      origin: Vec3; axis: Vec3;
      limits?: { min: number; max: number };
      drive?: number;
      label?: string;
    }): Joint => {
      const j = makeSliderJoint(a.id, b.id, opts.origin, opts.axis, {
        limits: opts.limits,
        drive: opts.drive,
        label: opts.label ?? `Corredera ${a.label}↔${b.label}`,
      });
      this._joints.push(j);
      return j;
    },
  };

  // ── Scene assembly ────────────────────────────────────────────

  /** Add nodes at the root of the scene. */
  add(...nodes: SdfNode[]): void {
    this._root.push(...nodes);
  }

  /** Replace the entire root operation (advanced). */
  setRoot(op: SdfOperation): void {
    this._rootOverride = op;
  }

  /** @internal — consumed by the runner. */
  _build(): ScriptResult {
    return {
      rootChildren: [...this._root],
      variables: [...this._vars],
      joints: [...this._joints],
      rootOverride: this._rootOverride,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private _resolveSize(size: Vec3 | number | undefined, fallback: Vec3): Vec3 {
    if (size == null) return fallback;
    if (typeof size === 'number') return [size, size, size];
    return size;
  }
}

// ═══════════════════════════════════════════════════════════════
// defineScene — the entry point the script file exports
// ═══════════════════════════════════════════════════════════════

export type SceneBuilder = (forja: ForjaContext) => void | Promise<void>;

export interface SceneDefinition {
  __forjaScene: true;
  builder: SceneBuilder;
}

export function defineScene(builder: SceneBuilder): SceneDefinition {
  return { __forjaScene: true, builder };
}

export function isSceneDefinition(x: unknown): x is SceneDefinition {
  return !!x && typeof x === 'object' && (x as SceneDefinition).__forjaScene === true;
}
