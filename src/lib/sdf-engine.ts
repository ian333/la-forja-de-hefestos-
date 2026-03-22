/**
 * ⚒️ La Forja de Hefestos — SDF Kernel & GLSL Compiler
 * =====================================================
 * Pure-math F-Rep engine. Defines a CSG scene graph in TypeScript
 * and compiles it to GLSL for real-time ray marching on the GPU.
 *
 * Every shape is a math function f(x,y,z).
 * f < 0 = inside material, f = 0 = surface, f > 0 = air.
 * Booleans are trivial: union = min, intersect = max, subtract = max(a, -b).
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface SdfPrimitive {
  id: string;
  kind: 'primitive';
  type: 'sphere' | 'box' | 'cylinder' | 'torus' | 'cone' | 'capsule';
  label: string;
  position: [number, number, number];
  rotation: [number, number, number]; // Euler XYZ in radians
  params: Record<string, number>;
}

export interface SdfOperation {
  id: string;
  kind: 'operation';
  type: 'union' | 'subtract' | 'intersect' | 'smoothUnion';
  label: string;
  smoothness: number;
  children: SdfNode[];
}

export type SdfNode = SdfPrimitive | SdfOperation;

export function isPrimitive(n: SdfNode): n is SdfPrimitive {
  return n.kind === 'primitive';
}

// ═══════════════════════════════════════════════════════════════
// GLSL Standard Library (SDF primitives + boolean ops)
// ═══════════════════════════════════════════════════════════════

export const GLSL_LIB = `
// ── SDF Primitives (Inigo Quilez) ──
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdCylinder(vec3 p, float r, float h) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdCone(vec3 p, float r, float h) {
  h = max(h, 0.001);
  vec2 q = h * vec2(r / h, -1.0);
  vec2 w = vec2(length(p.xz), p.y - h);
  vec2 a = w - q * clamp(dot(w, q) / dot(q, q), 0.0, 1.0);
  vec2 b = w - q * vec2(clamp(w.x / q.x, 0.0, 1.0), 1.0);
  float k = sign(q.y);
  float d = min(dot(a, a), dot(b, b));
  float s = max(k * (w.x * q.y - w.y * q.x), k * (w.y - q.y));
  return sqrt(d) * sign(s);
}

// ── Rotation Matrices ──
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1,0,0, 0,c,s, 0,-s,c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c,s,0, -s,c,0, 0,0,1); }

// ── Capsule (line segment with radius) ──
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// ── Boolean Operations ──
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtract(float d1, float d2) { return max(d1, -d2); }
float opIntersect(float d1, float d2) { return max(d1, d2); }
float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}
`;

// ═══════════════════════════════════════════════════════════════
// GLSL Compiler — walks CSG tree → generates map() function
// ═══════════════════════════════════════════════════════════════

let _varIdx = 0;

function glf(n: number): string {
  return n.toFixed(5);
}

function glVec3(v: [number, number, number]): string {
  return `vec3(${glf(v[0])}, ${glf(v[1])}, ${glf(v[2])})`;
}

function compileNodeGlsl(node: SdfNode): { code: string; varName: string } {
  if (isPrimitive(node)) {
    const v = `d${_varIdx++}`;
    const p = node.params;
    const pos = glVec3(node.position);
    const rot = node.rotation || [0, 0, 0];
    const hasRot = rot[0] !== 0 || rot[1] !== 0 || rot[2] !== 0;
    let expr: string;

    // Capsule is special — endpoints are absolute, no position/rotation transform
    if (node.type === 'capsule') {
      const a = `vec3(${glf(p.ax ?? 0)}, ${glf(p.ay ?? 0)}, ${glf(p.az ?? 0)})`;
      const b = `vec3(${glf(p.bx ?? 0)}, ${glf(p.by ?? 1)}, ${glf(p.bz ?? 0)})`;
      expr = `sdCapsule(p, ${a}, ${b}, ${glf(p.radius ?? 0.05)})`;
      return { code: `  float ${v} = ${expr};\n`, varName: v };
    }

    // For standard primitives, build transformed point
    const qVar = hasRot ? `q${_varIdx}` : null;
    let preamble = '';
    let pt: string;
    if (hasRot) {
      preamble = `  vec3 ${qVar} = rotZ(${glf(rot[2])}) * rotY(${glf(rot[1])}) * rotX(${glf(rot[0])}) * (p - ${pos});\n`;
      pt = qVar!;
    } else {
      pt = `p - ${pos}`;
    }

    switch (node.type) {
      case 'sphere':
        expr = `sdSphere(${pt}, ${glf(p.radius ?? 1)})`;
        break;
      case 'box':
        expr = `sdBox(${pt}, vec3(${glf((p.sizeX ?? 1) * 0.5)}, ${glf((p.sizeY ?? 1) * 0.5)}, ${glf((p.sizeZ ?? 1) * 0.5)}))`;
        break;
      case 'cylinder':
        expr = `sdCylinder(${pt}, ${glf(p.radius ?? 0.5)}, ${glf((p.height ?? 1) * 0.5)})`;
        break;
      case 'torus':
        expr = `sdTorus(${pt}, vec2(${glf(p.majorRadius ?? 1)}, ${glf(p.minorRadius ?? 0.25)}))`;
        break;
      case 'cone':
        expr = `sdCone(${pt}, ${glf(p.radius ?? 0.5)}, ${glf(Math.max(p.height ?? 1, 0.001))})`;
        break;
      default:
        expr = '1000.0';
    }

    return { code: `${preamble}  float ${v} = ${expr};\n`, varName: v };
  }

  // Operation node
  const op = node as SdfOperation;
  if (op.children.length === 0) {
    return { code: '', varName: '1000.0' };
  }
  if (op.children.length === 1) {
    return compileNodeGlsl(op.children[0]);
  }

  const compiled = op.children.map(c => compileNodeGlsl(c));
  let code = compiled.map(c => c.code).join('');

  let result = compiled[0].varName;
  for (let i = 1; i < compiled.length; i++) {
    const v = `d${_varIdx++}`;
    const b = compiled[i].varName;

    switch (op.type) {
      case 'union':
        code += `  float ${v} = opUnion(${result}, ${b});\n`;
        break;
      case 'subtract':
        code += `  float ${v} = opSubtract(${result}, ${b});\n`;
        break;
      case 'intersect':
        code += `  float ${v} = opIntersect(${result}, ${b});\n`;
        break;
      case 'smoothUnion':
        code += `  float ${v} = opSmoothUnion(${result}, ${b}, ${glf(op.smoothness)});\n`;
        break;
    }

    result = v;
  }

  return { code, varName: result };
}

export function compileScene(root: SdfNode): string {
  _varIdx = 0;
  if (!isPrimitive(root) && (root as SdfOperation).children.length === 0) {
    return `float map(vec3 p) {\n  return 1000.0;\n}`;
  }
  const { code, varName } = compileNodeGlsl(root);
  return `float map(vec3 p) {\n${code}  return ${varName};\n}`;
}

// ═══════════════════════════════════════════════════════════════
// Scene Graph Helpers
// ═══════════════════════════════════════════════════════════════

let _nodeId = 0;
function uid(): string { return `fn${++_nodeId}`; }

// ── Factories ──

export function makeSphere(pos: [number, number, number] = [0, 1, 0], radius = 1): SdfPrimitive {
  return { id: uid(), kind: 'primitive', type: 'sphere', label: 'Esfera', position: pos, rotation: [0, 0, 0], params: { radius } };
}

export function makeBox(pos: [number, number, number] = [0, 0.5, 0], size: [number, number, number] = [1, 1, 1]): SdfPrimitive {
  return { id: uid(), kind: 'primitive', type: 'box', label: 'Caja', position: pos, rotation: [0, 0, 0], params: { sizeX: size[0], sizeY: size[1], sizeZ: size[2] } };
}

export function makeCylinder(pos: [number, number, number] = [0, 0.5, 0], radius = 0.5, height = 1): SdfPrimitive {
  return { id: uid(), kind: 'primitive', type: 'cylinder', label: 'Cilindro', position: pos, rotation: [0, 0, 0], params: { radius, height } };
}

export function makeTorus(pos: [number, number, number] = [0, 0.5, 0], majorRadius = 1, minorRadius = 0.25): SdfPrimitive {
  return { id: uid(), kind: 'primitive', type: 'torus', label: 'Toroide', position: pos, rotation: [0, 0, 0], params: { majorRadius, minorRadius } };
}

export function makeCone(pos: [number, number, number] = [0, 0, 0], radius = 0.5, height = 1): SdfPrimitive {
  return { id: uid(), kind: 'primitive', type: 'cone', label: 'Cono', position: pos, rotation: [0, 0, 0], params: { radius, height } };
}

export function makeCapsule(a: [number, number, number], b: [number, number, number], radius = 0.02): SdfPrimitive {
  return { id: uid(), kind: 'primitive', type: 'capsule', label: 'Tubo', position: [0, 0, 0], rotation: [0, 0, 0], params: { ax: a[0], ay: a[1], az: a[2], bx: b[0], by: b[1], bz: b[2], radius } };
}

export function makeRotatedTorus(pos: [number, number, number], rot: [number, number, number], majorRadius = 1, minorRadius = 0.25): SdfPrimitive {
  return { id: uid(), kind: 'primitive', type: 'torus', label: 'Rueda', position: pos, rotation: rot, params: { majorRadius, minorRadius } };
}

export function makeOp(type: SdfOperation['type'], children: SdfNode[], smoothness = 0.25): SdfOperation {
  const labels: Record<string, string> = { union: 'Unión', subtract: 'Resta', intersect: 'Intersección', smoothUnion: 'Unión Suave' };
  return { id: uid(), kind: 'operation', type, label: labels[type] || type, smoothness, children };
}

// ── Default scene: mechanical part (dome + plate with hole + ring) ──

export function createDefaultScene(): SdfOperation {
  return createBicycleScene();
}

// ── Bicycle demo scene ──

function makeChainRun(
  ax: number, ay: number, bx: number, by: number,
  segments: number, r: number
): SdfPrimitive[] {
  const links: SdfPrimitive[] = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    links.push(makeSphere([x, y, 0], r));
  }
  return links;
}

function makeSprocket(pos: [number, number, number], r: number, teeth: number): SdfNode[] {
  const nodes: SdfNode[] = [
    makeRotatedTorus(pos, [Math.PI / 2, 0, 0], r, 0.006),
  ];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const tx = pos[0] + Math.cos(a) * r;
    const ty = pos[1] + Math.sin(a) * r;
    nodes.push(makeSphere([tx, ty, pos[2]], 0.008));
  }
  return nodes;
}

export function createBicycleScene(): SdfOperation {
  const HP = Math.PI / 2; // 90° — stands torus upright
  const TR = 0.015;  // tube radius
  const WR = 0.32;   // wheel major radius
  const WT = 0.02;   // wheel tire thickness

  // Key points (world-space)
  const rearAxle: [number, number, number] = [-0.55, 0.35, 0];
  const frontAxle: [number, number, number] = [0.55, 0.35, 0];
  const bb: [number, number, number] = [-0.08, 0.35, 0];   // bottom bracket
  const seatTop: [number, number, number] = [-0.20, 0.82, 0];
  const htTop: [number, number, number] = [0.38, 0.74, 0];  // head tube top
  const htBot: [number, number, number] = [0.42, 0.50, 0];  // head tube bottom

  // Sprocket positions & sizes
  const frontSprocketR = 0.06;
  const rearSprocketR = 0.04;

  return makeOp('union', [
    // ── Wheels ──
    makeRotatedTorus(rearAxle, [HP, 0, 0], WR, WT),
    makeRotatedTorus(frontAxle, [HP, 0, 0], WR, WT),

    // ── Spokes (4 per wheel) ──
    ...[0, 90, 45, 135].flatMap(deg => {
      const a = deg * Math.PI / 180;
      const dy = Math.sin(a) * (WR - 0.02);
      const dx = Math.cos(a) * (WR - 0.02);
      return [
        makeCapsule([rearAxle[0], rearAxle[1] - dy, rearAxle[2] - dx],
                    [rearAxle[0], rearAxle[1] + dy, rearAxle[2] + dx], 0.003),
        makeCapsule([frontAxle[0], frontAxle[1] - dy, frontAxle[2] - dx],
                    [frontAxle[0], frontAxle[1] + dy, frontAxle[2] + dx], 0.003),
      ];
    }),

    // ── Hubs ──
    makeSphere(rearAxle, 0.018),
    makeSphere(frontAxle, 0.018),

    // ── Frame tubes ──
    makeCapsule(bb, seatTop, TR),                      // seat tube
    makeCapsule(bb, htBot, TR),                        // down tube
    makeCapsule(seatTop, htTop, TR),                   // top tube
    makeCapsule(htBot, htTop, TR * 1.3),               // head tube
    makeCapsule(rearAxle, bb, TR),                     // chain stay
    makeCapsule(rearAxle, [-0.18, 0.72, 0], TR * 0.9),// seat stay
    makeCapsule(htBot, frontAxle, TR),                 // fork

    // ── Handlebars ──
    makeCapsule(htTop, [0.34, 0.80, 0], TR),           // stem
    makeCapsule([0.32, 0.82, -0.18], [0.32, 0.82, 0.18], TR), // bar

    // ── Seat ──
    makeBox([-0.20, 0.85, 0], [0.14, 0.028, 0.08]),

    // ── Crank + pedals ──
    makeCapsule([-0.08, 0.35, -0.08], [-0.08, 0.35, 0.08], TR * 1.2),
    makeSphere([-0.08, 0.35, -0.09], 0.025),
    makeSphere([-0.08, 0.35, 0.09], 0.025),

    // ── Drivetrain: sprockets ──
    ...makeSprocket(bb, frontSprocketR, 16),
    ...makeSprocket(rearAxle, rearSprocketR, 10),

    // ── Chain (top run + bottom run) ──
    ...makeChainRun(bb[0] + frontSprocketR, bb[1], rearAxle[0] - rearSprocketR, rearAxle[1], 18, 0.005),  // top
    ...makeChainRun(bb[0] + frontSprocketR, bb[1] - 0.012, rearAxle[0] - rearSprocketR, rearAxle[1] - 0.012, 18, 0.005), // bottom
  ]);
}

// ── Tree queries ──

export function findNode(root: SdfNode, id: string): SdfNode | null {
  if (root.id === id) return root;
  if (!isPrimitive(root)) {
    for (const child of (root as SdfOperation).children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

export function findParent(root: SdfNode, childId: string): SdfOperation | null {
  if (!isPrimitive(root)) {
    const op = root as SdfOperation;
    for (const child of op.children) {
      if (child.id === childId) return op;
      const found = findParent(child, childId);
      if (found) return found;
    }
  }
  return null;
}

// ── Immutable tree updates ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateNodeInTree(root: SdfNode, id: string, updates: any): SdfNode {
  if (root.id === id) {
    if (isPrimitive(root)) {
      return { ...root, ...updates, params: { ...root.params, ...(updates.params ?? {}) }, rotation: updates.rotation ?? root.rotation };
    }
    return { ...(root as SdfOperation), ...updates };
  }
  if (!isPrimitive(root)) {
    const op = root as SdfOperation;
    return { ...op, children: op.children.map(c => updateNodeInTree(c, id, updates)) };
  }
  return root;
}

export function addChildToNode(root: SdfNode, parentId: string, child: SdfNode): SdfNode {
  if (root.id === parentId && !isPrimitive(root)) {
    const op = root as SdfOperation;
    return { ...op, children: [...op.children, child] };
  }
  if (!isPrimitive(root)) {
    const op = root as SdfOperation;
    return { ...op, children: op.children.map(c => addChildToNode(c, parentId, child)) };
  }
  return root;
}

export function removeNodeFromTree(root: SdfNode, id: string): SdfNode | null {
  if (root.id === id) return null;
  if (!isPrimitive(root)) {
    const op = root as SdfOperation;
    const filtered = op.children
      .map(c => removeNodeFromTree(c, id))
      .filter(Boolean) as SdfNode[];
    return { ...op, children: filtered };
  }
  return root;
}
