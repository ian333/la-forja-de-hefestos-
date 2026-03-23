/**
 * GAIA Forge — Variable System
 * ==============================
 * Every dimension is a named variable. Variables can be expressions
 * that reference other variables. The dependency graph resolves in
 * topological order. Circular references are detected and flagged.
 *
 * This is the CORE of GAIA Forge. Geometry is an expression of variables.
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type GaiaUnit =
  | 'mm' | 'cm' | 'm' | 'in' | 'ft'
  | 'deg' | 'rad'
  | 'mm2' | 'cm2' | 'm2'
  | 'mm3' | 'cm3' | 'm3'
  | 'g' | 'kg' | 'lb'
  | 'Pa' | 'MPa' | 'GPa' | 'psi'
  | 'N' | 'kN'
  | 'K' | '°C' | '°F'
  | 'none';

export interface GaiaVariable {
  id: string;
  name: string;
  group: string;
  unit: GaiaUnit;
  expression: string;        // "12" or "width * 0.4 + 2"
  resolvedValue: number;     // computed result
  description: string;
  min?: number;
  max?: number;
  locked: boolean;
  source: 'user' | 'auto' | 'simulation' | 'standard';
  // SDF link: which primitive param this variable drives
  linkedPrimId?: string;
  linkedParamKey?: string;
}

// ═══════════════════════════════════════════════════════════════
// Expression Evaluator — Recursive Descent Parser
// ═══════════════════════════════════════════════════════════════

type TT = 'NUM' | 'ID' | '+' | '-' | '*' | '/' | '^' | '%' | '(' | ')' | ',' | 'EOF';

interface Tok { type: TT; val: string; pos: number; }

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }

    // Numbers: 123, 1.5, .5, 1e3, 1.5e-2
    if (/[0-9.]/.test(src[i])) {
      const s = i;
      let n = '';
      while (i < src.length && /[0-9.]/.test(src[i])) n += src[i++];
      if (i < src.length && /[eE]/.test(src[i])) {
        n += src[i++];
        if (i < src.length && /[+\-]/.test(src[i])) n += src[i++];
        while (i < src.length && /[0-9]/.test(src[i])) n += src[i++];
      }
      out.push({ type: 'NUM', val: n, pos: s });
      continue;
    }

    // Identifiers: abc, _x, $width, material.shrinkage
    if (/[a-zA-Z_$]/.test(src[i])) {
      const s = i;
      let id = '';
      while (i < src.length && /[a-zA-Z0-9_.$]/.test(src[i])) id += src[i++];
      out.push({ type: 'ID', val: id, pos: s });
      continue;
    }

    const map: Record<string, TT> = {
      '+': '+', '-': '-', '*': '*', '/': '/', '^': '^', '%': '%',
      '(': '(', ')': ')', ',': ',',
    };
    if (map[src[i]]) {
      out.push({ type: map[src[i]], val: src[i], pos: i });
      i++;
      continue;
    }
    throw new Error(`Carácter inesperado '${src[i]}' en posición ${i}`);
  }
  out.push({ type: 'EOF', val: '', pos: i });
  return out;
}

// Constants available in expressions
const CONSTS: Record<string, number> = {
  PI: Math.PI, E: Math.E, TAU: Math.PI * 2, G: 9.81,
};

// Built-in functions
const FNS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sqrt: Math.sqrt, abs: Math.abs,
  min: Math.min, max: Math.max,
  round: Math.round, ceil: Math.ceil, floor: Math.floor,
  log: Math.log, log10: Math.log10, exp: Math.exp, pow: Math.pow,
  clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
  lerp: (a, b, t) => a + (b - a) * t,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  if: (c, t, f) => c !== 0 ? t : f,
  deg2rad: (d) => d * Math.PI / 180,
  rad2deg: (r) => r * 180 / Math.PI,
};

class Parser {
  private t: Tok[];
  private p = 0;
  readonly refs = new Set<string>();

  constructor(tokens: Tok[], private vars: ReadonlyMap<string, number>) {
    this.t = tokens;
  }

  private peek(): Tok { return this.t[this.p]; }
  private eat(): Tok { return this.t[this.p++]; }
  private expect(type: TT): Tok {
    const tk = this.eat();
    if (tk.type !== type) throw new Error(`Esperado '${type}', encontrado '${tk.val}'`);
    return tk;
  }

  parse(): number {
    const r = this.expr();
    if (this.peek().type !== 'EOF') throw new Error(`Token inesperado '${this.peek().val}'`);
    return r;
  }

  private expr(): number {
    let l = this.term();
    while (this.peek().type === '+' || this.peek().type === '-') {
      const op = this.eat().type;
      const r = this.term();
      l = op === '+' ? l + r : l - r;
    }
    return l;
  }

  private term(): number {
    let l = this.unary();
    while (this.peek().type === '*' || this.peek().type === '/' || this.peek().type === '%') {
      const op = this.eat().type;
      const r = this.unary();
      if (op === '*') l *= r;
      else if (op === '/') l = r === 0 ? NaN : l / r;
      else l %= r;
    }
    return l;
  }

  private unary(): number {
    if (this.peek().type === '-') { this.eat(); return -this.power(); }
    if (this.peek().type === '+') { this.eat(); }
    return this.power();
  }

  private power(): number {
    const base = this.call();
    if (this.peek().type === '^') { this.eat(); return Math.pow(base, this.unary()); }
    return base;
  }

  private call(): number {
    if (this.peek().type === 'ID') {
      const name = this.peek().val;
      if (this.t[this.p + 1]?.type === '(' && FNS[name]) {
        this.eat(); this.eat(); // id + (
        const args: number[] = [];
        if (this.peek().type !== ')') {
          args.push(this.expr());
          while (this.peek().type === ',') { this.eat(); args.push(this.expr()); }
        }
        this.expect(')');
        return FNS[name](...args);
      }
    }
    return this.primary();
  }

  private primary(): number {
    const tk = this.peek();
    if (tk.type === 'NUM') { this.eat(); return parseFloat(tk.val); }
    if (tk.type === 'ID') {
      this.eat();
      if (CONSTS[tk.val] !== undefined) return CONSTS[tk.val];
      this.refs.add(tk.val);
      const v = this.vars.get(tk.val);
      if (v !== undefined) return v;
      throw new Error(`Variable desconocida '${tk.val}'`);
    }
    if (tk.type === '(') {
      this.eat();
      const val = this.expr();
      this.expect(')');
      return val;
    }
    throw new Error(`Token inesperado '${tk.val}'`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════

export interface EvalResult {
  value: number;
  error: string | null;
  references: string[];
}

export function evaluateExpression(
  expression: string,
  variables: ReadonlyMap<string, number>,
): EvalResult {
  try {
    const trimmed = expression.trim();
    if (!trimmed) return { value: 0, error: 'Expresión vacía', references: [] };
    const tokens = tokenize(trimmed);
    const parser = new Parser(tokens, variables);
    const value = parser.parse();
    return {
      value: isFinite(value) ? value : NaN,
      error: isFinite(value) ? null : 'Resultado no finito',
      references: [...parser.refs],
    };
  } catch (e) {
    return { value: NaN, error: (e as Error).message, references: [] };
  }
}

// ═══════════════════════════════════════════════════════════════
// Dependency Graph & Resolution
// ═══════════════════════════════════════════════════════════════

export function resolveVariables(variables: GaiaVariable[]): GaiaVariable[] {
  // Build name → id map
  const nameToId = new Map(variables.map(v => [v.name, v.id]));

  // Detect references for each variable (with dummy values for detection pass)
  const dummyMap = new Map(variables.map(v => [v.name, 0]));
  const deps = new Map<string, Set<string>>(); // id → set of ids it depends on

  for (const v of variables) {
    const { references } = evaluateExpression(v.expression, dummyMap);
    const depIds = new Set<string>();
    for (const ref of references) {
      const rid = nameToId.get(ref);
      if (rid && rid !== v.id) depIds.add(rid);
    }
    deps.set(v.id, depIds);
  }

  // Topological sort (Kahn's algorithm)
  const inDeg = new Map(variables.map(v => [v.id, 0]));
  const out = new Map(variables.map(v => [v.id, new Set<string>()]));

  for (const [id, depSet] of deps) {
    inDeg.set(id, depSet.size);
    for (const dep of depSet) out.get(dep)?.add(id);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDeg) if (deg === 0) queue.push(id);

  const order: string[] = [];
  while (queue.length > 0) {
    const n = queue.shift()!;
    order.push(n);
    for (const next of out.get(n) ?? []) {
      const nd = (inDeg.get(next) ?? 1) - 1;
      inDeg.set(next, nd);
      if (nd === 0) queue.push(next);
    }
  }

  // Resolve in order
  const resolved = new Map<string, number>();
  const result = variables.map(v => ({ ...v })); // copy
  const byId = new Map(result.map(v => [v.id, v]));

  for (const id of order) {
    const v = byId.get(id)!;
    const r = evaluateExpression(v.expression, resolved);
    v.resolvedValue = r.error ? NaN : r.value;
    resolved.set(v.name, v.resolvedValue);
  }

  // Flag circular variables as NaN
  for (const v of result) {
    if (!order.includes(v.id)) v.resolvedValue = NaN;
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Factory & Naming
// ═══════════════════════════════════════════════════════════════

let _vid = 0;

export function createVariable(
  name: string,
  expression: string,
  opts?: Partial<Omit<GaiaVariable, 'id' | 'name' | 'expression' | 'resolvedValue'>>,
): GaiaVariable {
  return {
    id: `gv${++_vid}`,
    name,
    expression,
    resolvedValue: NaN,
    group: opts?.group ?? 'General',
    unit: opts?.unit ?? 'mm',
    description: opts?.description ?? '',
    locked: opts?.locked ?? false,
    source: opts?.source ?? 'user',
    min: opts?.min,
    max: opts?.max,
    linkedPrimId: opts?.linkedPrimId,
    linkedParamKey: opts?.linkedParamKey,
  };
}

// Human-friendly param names per primitive type
export const PARAM_LABELS: Record<string, Record<string, { varSuffix: string; label: string; unit: GaiaUnit }>> = {
  sphere: {
    radius: { varSuffix: 'radio', label: 'Radio', unit: 'mm' },
  },
  box: {
    sizeX: { varSuffix: 'ancho', label: 'Ancho (X)', unit: 'mm' },
    sizeY: { varSuffix: 'alto', label: 'Alto (Y)', unit: 'mm' },
    sizeZ: { varSuffix: 'prof', label: 'Prof. (Z)', unit: 'mm' },
  },
  cylinder: {
    radius: { varSuffix: 'radio', label: 'Radio', unit: 'mm' },
    height: { varSuffix: 'altura', label: 'Altura', unit: 'mm' },
  },
  torus: {
    majorRadius: { varSuffix: 'Rmayor', label: 'R Mayor', unit: 'mm' },
    minorRadius: { varSuffix: 'Rmenor', label: 'R Menor', unit: 'mm' },
  },
  cone: {
    radius: { varSuffix: 'radio', label: 'Radio', unit: 'mm' },
    height: { varSuffix: 'altura', label: 'Altura', unit: 'mm' },
  },
};

/**
 * Generate variables for a primitive's params.
 * Returns the new variables to add.
 */
export function autoCreateVariablesForPrimitive(
  primType: string,
  primId: string,
  params: Record<string, number>,
  existingCount: number,
): GaiaVariable[] {
  const meta = PARAM_LABELS[primType];
  if (!meta) return []; // capsule etc. — skip for now

  const prefix = `${primType}${existingCount + 1}`;
  const vars: GaiaVariable[] = [];

  for (const [key, value] of Object.entries(params)) {
    const info = meta[key];
    if (!info) continue;
    vars.push(createVariable(
      `${prefix}_${info.varSuffix}`,
      String(value),
      {
        group: 'Dimensiones',
        unit: info.unit,
        description: `${info.label} de ${prefix}`,
        source: 'auto',
        linkedPrimId: primId,
        linkedParamKey: key,
      },
    ));
  }

  return vars;
}
