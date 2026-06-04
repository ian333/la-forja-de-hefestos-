/**
 * Motor de expresiones para PARÁMETROS de La Forja (el "Change Parameters" de
 * Fusion). Evalúa aritmética con referencias a parámetros nombrados —SIN `eval`—
 * por descenso recursivo: + − × ÷, potencia ^ (asociativa por la derecha),
 * unario −, paréntesis, funciones (sqrt, sin, cos, tan, abs, min, max, floor,
 * ceil, round, deg, rad) y constantes (pi, e, tau). Lanza Error en sintaxis o
 * identificador desconocido — el llamador lo reporta como cota inválida.
 *
 * Ángulos en RADIANES (sin/cos/tan); `deg(x)`=x·180/π, `rad(x)`=x·π/180.
 */

const BUILTIN_CONSTS: Record<string, number> = {
  pi: Math.PI, e: Math.E, tau: 2 * Math.PI,
};
const FUNCS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  min: Math.min, max: Math.max,
  deg: (x) => (x * 180) / Math.PI, rad: (x) => (x * Math.PI) / 180,
};

type Tok =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: 'lp' } | { t: 'rp' } | { t: 'comma' };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const s = src;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if ((c >= '0' && c <= '9') || (c === '.' && s[i + 1] >= '0' && s[i + 1] <= '9')) {
      let j = i + 1;
      while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) j++;
      const num = Number(s.slice(i, j));
      if (!Number.isFinite(num)) throw new Error(`número inválido: ${s.slice(i, j)}`);
      toks.push({ t: 'num', v: num }); i = j; continue;
    }
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      toks.push({ t: 'id', v: s.slice(i, j) }); i = j; continue;
    }
    if ('+-*/^'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { toks.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rp' }); i++; continue; }
    if (c === ',') { toks.push({ t: 'comma' }); i++; continue; }
    throw new Error(`carácter inesperado: '${c}'`);
  }
  return toks;
}

/** Evalúa `src` con los nombres de `scope` (y constantes pi/e/tau). */
export function evalExpr(src: string, scope: Record<string, number> = {}): number {
  const toks = tokenize(src);
  let pos = 0;
  const peek = (): Tok | undefined => toks[pos];
  const next = (): Tok => toks[pos++];

  function parseExpression(): number { return parseAdditive(); }
  function parseAdditive(): number {
    let v = parseMultiplicative();
    for (let p = peek(); p && p.t === 'op' && (p.v === '+' || p.v === '-'); p = peek()) {
      next(); const r = parseMultiplicative(); v = p.v === '+' ? v + r : v - r;
    }
    return v;
  }
  function parseMultiplicative(): number {
    let v = parseUnary();
    for (let p = peek(); p && p.t === 'op' && (p.v === '*' || p.v === '/'); p = peek()) {
      next(); const r = parseUnary(); v = p.v === '*' ? v * r : v / r;
    }
    return v;
  }
  function parseUnary(): number {
    const p = peek();
    if (p && p.t === 'op' && p.v === '-') { next(); return -parseUnary(); }
    if (p && p.t === 'op' && p.v === '+') { next(); return parseUnary(); }
    return parsePower();
  }
  function parsePower(): number {
    const base = parsePrimary();
    const p = peek();
    if (p && p.t === 'op' && p.v === '^') { next(); const exp = parseUnary(); return Math.pow(base, exp); }
    return base;
  }
  function parsePrimary(): number {
    const p = peek();
    if (!p) throw new Error('expresión incompleta');
    if (p.t === 'num') { next(); return p.v; }
    if (p.t === 'lp') { next(); const v = parseExpression(); const r = next(); if (!r || r.t !== 'rp') throw new Error('falta )'); return v; }
    if (p.t === 'id') {
      next();
      if (peek()?.t === 'lp') { // llamada a función
        next();
        const args: number[] = [];
        if (peek()?.t !== 'rp') {
          args.push(parseExpression());
          while (peek()?.t === 'comma') { next(); args.push(parseExpression()); }
        }
        const close = next(); if (!close || close.t !== 'rp') throw new Error('falta ) en función');
        const fn = FUNCS[p.v];
        if (!fn) throw new Error(`función desconocida: ${p.v}`);
        return fn(...args);
      }
      if (p.v in scope) return scope[p.v];
      if (p.v in BUILTIN_CONSTS) return BUILTIN_CONSTS[p.v];
      throw new Error(`parámetro desconocido: ${p.v}`);
    }
    throw new Error(`token inesperado`);
  }

  const result = parseExpression();
  if (pos < toks.length) throw new Error('expresión mal formada');
  if (!Number.isFinite(result)) throw new Error('resultado no finito');
  return result;
}

export interface Param { id: string; name: string; expr: string; }
export interface ResolvedParams {
  scope: Record<string, number>;       // nombre → valor (los que resolvieron)
  values: Record<string, number>;      // id del param → valor
  errors: Record<string, string>;      // id del param → mensaje de error
}

const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Resuelve una lista ORDENADA de parámetros: cada uno puede referenciar a los
 * ANTERIORES (y a constantes/funciones). Devuelve el scope acumulado + valor y
 * error por id. Nombre inválido o duplicado, o expresión que falla → error y el
 * parámetro NO entra al scope (los siguientes que dependan de él fallarán claro).
 */
export function resolveParams(params: Param[]): ResolvedParams {
  const scope: Record<string, number> = {};
  const values: Record<string, number> = {};
  const errors: Record<string, string> = {};
  const seen = new Set<string>();
  for (const p of params) {
    const name = p.name.trim();
    if (!NAME_RE.test(name)) { errors[p.id] = 'nombre inválido'; continue; }
    if (seen.has(name)) { errors[p.id] = 'nombre duplicado'; continue; }
    seen.add(name);
    try {
      const v = evalExpr(p.expr, scope);
      scope[name] = v; values[p.id] = v;
    } catch (e) {
      errors[p.id] = (e as Error)?.message ?? 'error';
    }
  }
  return { scope, values, errors };
}

/** Evalúa una cota ligada: devuelve el número, o null si la expresión falla. */
export function tryEval(expr: string, scope: Record<string, number>): number | null {
  try { return evalExpr(expr, scope); } catch { return null; }
}
