// calculus.ts — Parser propio (tokenizer -> AST), derivada e integral simbolicas
// para expresiones de UNA variable. Cero dependencias externas.
//
// Soporta: + - * / ^, parentesis, variable x, constantes numericas,
// y funciones: sin cos tan exp ln sqrt.
//
// Cuando algo no esta soportado, devolvemos { soportado:false, nota } de forma
// HONESTA (no inventamos resultados).

import type { Paso } from './types';

// ===========================================================================
// AST
// ===========================================================================

export type Node =
  | { type: 'num'; value: number }
  | { type: 'var'; name: string }
  | { type: 'neg'; arg: Node }
  | { type: 'add'; left: Node; right: Node }
  | { type: 'sub'; left: Node; right: Node }
  | { type: 'mul'; left: Node; right: Node }
  | { type: 'div'; left: Node; right: Node }
  | { type: 'pow'; base: Node; exp: Node }
  | { type: 'func'; name: FuncName; arg: Node };

export type FuncName = 'sin' | 'cos' | 'tan' | 'exp' | 'ln' | 'sqrt';
const FUNCS = new Set<string>(['sin', 'cos', 'tan', 'exp', 'ln', 'sqrt']);

// ===========================================================================
// Tokenizer
// ===========================================================================

type Tok =
  | { k: 'num'; v: number }
  | { k: 'id'; v: string }
  | { k: 'op'; v: string }
  | { k: 'lp' }
  | { k: 'rp' };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const s = src;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i++;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) j++;
      const numStr = s.slice(i, j);
      const v = parseFloat(numStr);
      if (!Number.isFinite(v)) throw new Error(`numero invalido: ${numStr}`);
      toks.push({ k: 'num', v });
      i = j;
      continue;
    }
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      let j = i;
      while (j < s.length && ((s[j] >= 'a' && s[j] <= 'z') || (s[j] >= 'A' && s[j] <= 'Z'))) j++;
      toks.push({ k: 'id', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '(') {
      toks.push({ k: 'lp' });
      i++;
      continue;
    }
    if (ch === ')') {
      toks.push({ k: 'rp' });
      i++;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      toks.push({ k: 'op', v: ch });
      i++;
      continue;
    }
    throw new Error(`caracter inesperado: '${ch}'`);
  }
  return toks;
}

// ===========================================================================
// Parser (descenso recursivo con precedencia)
//   expr   := term (('+'|'-') term)*
//   term   := factor (('*'|'/') factor)*     + multiplicacion implicita
//   factor := unary ('^' factor)?            (^ asociativo a la derecha)
//   unary  := ('-' unary) | atom
//   atom   := num | var | func '(' expr ')' | '(' expr ')'
// ===========================================================================

class Parser {
  private toks: Tok[];
  private pos = 0;
  private varName: string;

  constructor(toks: Tok[], varName: string) {
    this.toks = toks;
    this.varName = varName;
  }

  private peek(): Tok | undefined {
    return this.toks[this.pos];
  }

  private next(): Tok | undefined {
    return this.toks[this.pos++];
  }

  parse(): Node {
    const node = this.parseExpr();
    if (this.pos !== this.toks.length) {
      throw new Error('tokens sobrantes al final de la expresion');
    }
    return node;
  }

  private parseExpr(): Node {
    let left = this.parseTerm();
    for (;;) {
      const t = this.peek();
      if (t && t.k === 'op' && (t.v === '+' || t.v === '-')) {
        this.next();
        const right = this.parseTerm();
        left = t.v === '+' ? { type: 'add', left, right } : { type: 'sub', left, right };
      } else break;
    }
    return left;
  }

  private parseTerm(): Node {
    let left = this.parseFactor();
    for (;;) {
      const t = this.peek();
      if (t && t.k === 'op' && (t.v === '*' || t.v === '/')) {
        this.next();
        const right = this.parseFactor();
        left = t.v === '*' ? { type: 'mul', left, right } : { type: 'div', left, right };
      } else if (t && (t.k === 'num' || t.k === 'id' || t.k === 'lp')) {
        // Multiplicacion implicita: 2x, x sin(x), (x+1)(x-1)
        const right = this.parseFactor();
        left = { type: 'mul', left, right };
      } else break;
    }
    return left;
  }

  private parseFactor(): Node {
    const base = this.parseUnary();
    const t = this.peek();
    if (t && t.k === 'op' && t.v === '^') {
      this.next();
      const exp = this.parseFactor(); // asociativo a la derecha
      return { type: 'pow', base, exp };
    }
    return base;
  }

  private parseUnary(): Node {
    const t = this.peek();
    if (t && t.k === 'op' && t.v === '-') {
      this.next();
      return { type: 'neg', arg: this.parseUnary() };
    }
    if (t && t.k === 'op' && t.v === '+') {
      this.next();
      return this.parseUnary();
    }
    return this.parseAtom();
  }

  private parseAtom(): Node {
    const t = this.next();
    if (!t) throw new Error('expresion incompleta');
    if (t.k === 'num') return { type: 'num', value: t.v };
    if (t.k === 'lp') {
      const e = this.parseExpr();
      const close = this.next();
      if (!close || close.k !== 'rp') throw new Error("falta ')'");
      return e;
    }
    if (t.k === 'id') {
      const name = t.v;
      if (FUNCS.has(name)) {
        const open = this.next();
        if (!open || open.k !== 'lp') throw new Error(`se esperaba '(' tras ${name}`);
        const arg = this.parseExpr();
        const close = this.next();
        if (!close || close.k !== 'rp') throw new Error(`falta ')' tras ${name}`);
        return { type: 'func', name: name as FuncName, arg };
      }
      if (name === this.varName) return { type: 'var', name };
      if (name === 'e') return { type: 'num', value: Math.E };
      if (name === 'pi') return { type: 'num', value: Math.PI };
      // Variable distinta de la de derivacion -> la tratamos como constante? No:
      // mantenemos honestidad, solo aceptamos la variable declarada.
      throw new Error(`identificador no soportado: '${name}'`);
    }
    throw new Error('token inesperado en atomo');
  }
}

export function parse(src: string, varName = 'x'): Node {
  const toks = tokenize(src);
  if (toks.length === 0) throw new Error('expresion vacia');
  return new Parser(toks, varName).parse();
}

// ===========================================================================
// Constructores + simplificacion algebraica
// ===========================================================================

const num = (v: number): Node => ({ type: 'num', value: v });
const ZERO = num(0);
const ONE = num(1);

function isNum(n: Node, v?: number): boolean {
  return n.type === 'num' && (v === undefined || n.value === v);
}

function isConst(n: Node): boolean {
  // No contiene la variable -> constante.
  switch (n.type) {
    case 'num':
      return true;
    case 'var':
      return false;
    case 'neg':
      return isConst(n.arg);
    case 'func':
      return isConst(n.arg);
    case 'add':
    case 'sub':
    case 'mul':
    case 'div':
      return isConst((n as any).left) && isConst((n as any).right);
    case 'pow':
      return isConst(n.base) && isConst(n.exp);
  }
}

function add(a: Node, b: Node): Node {
  if (isNum(a, 0)) return b;
  if (isNum(b, 0)) return a;
  if (a.type === 'num' && b.type === 'num') return num(a.value + b.value);
  return { type: 'add', left: a, right: b };
}
function sub(a: Node, b: Node): Node {
  if (isNum(b, 0)) return a;
  if (a.type === 'num' && b.type === 'num') return num(a.value - b.value);
  if (isNum(a, 0)) return neg(b);
  return { type: 'sub', left: a, right: b };
}
function mul(a: Node, b: Node): Node {
  if (isNum(a, 0) || isNum(b, 0)) return ZERO;
  if (isNum(a, 1)) return b;
  if (isNum(b, 1)) return a;
  if (a.type === 'num' && b.type === 'num') return num(a.value * b.value);
  return { type: 'mul', left: a, right: b };
}
function div(a: Node, b: Node): Node {
  if (isNum(a, 0)) return ZERO;
  if (isNum(b, 1)) return a;
  if (a.type === 'num' && b.type === 'num' && b.value !== 0) return num(a.value / b.value);
  return { type: 'div', left: a, right: b };
}
function pow(a: Node, b: Node): Node {
  if (isNum(b, 0)) return ONE;
  if (isNum(b, 1)) return a;
  if (isNum(a, 1)) return ONE;
  if (a.type === 'num' && b.type === 'num') return num(Math.pow(a.value, b.value));
  return { type: 'pow', base: a, exp: b };
}
function neg(a: Node): Node {
  if (a.type === 'num') return num(-a.value);
  if (a.type === 'neg') return a.arg;
  return { type: 'neg', arg: a };
}
function fn(name: FuncName, arg: Node): Node {
  return { type: 'func', name, arg };
}

// Simplifica recursivamente reconstruyendo con los smart-constructors.
export function simplify(n: Node): Node {
  switch (n.type) {
    case 'num':
    case 'var':
      return n;
    case 'neg':
      return neg(simplify(n.arg));
    case 'add':
      return add(simplify(n.left), simplify(n.right));
    case 'sub':
      return sub(simplify(n.left), simplify(n.right));
    case 'mul':
      return mul(simplify(n.left), simplify(n.right));
    case 'div':
      return div(simplify(n.left), simplify(n.right));
    case 'pow':
      return pow(simplify(n.base), simplify(n.exp));
    case 'func':
      return fn(n.name, simplify(n.arg));
  }
}

// ===========================================================================
// Evaluacion numerica (para el verificador: comparar resultado vs esperado)
// ===========================================================================

export function evaluate(n: Node, x: number): number {
  switch (n.type) {
    case 'num':
      return n.value;
    case 'var':
      return x;
    case 'neg':
      return -evaluate(n.arg, x);
    case 'add':
      return evaluate(n.left, x) + evaluate(n.right, x);
    case 'sub':
      return evaluate(n.left, x) - evaluate(n.right, x);
    case 'mul':
      return evaluate(n.left, x) * evaluate(n.right, x);
    case 'div':
      return evaluate(n.left, x) / evaluate(n.right, x);
    case 'pow':
      return Math.pow(evaluate(n.base, x), evaluate(n.exp, x));
    case 'func': {
      const a = evaluate(n.arg, x);
      switch (n.name) {
        case 'sin':
          return Math.sin(a);
        case 'cos':
          return Math.cos(a);
        case 'tan':
          return Math.tan(a);
        case 'exp':
          return Math.exp(a);
        case 'ln':
          return Math.log(a);
        case 'sqrt':
          return Math.sqrt(a);
      }
    }
  }
}

// ===========================================================================
// LaTeX
// ===========================================================================

function fmtNum(v: number): string {
  if (Number.isInteger(v)) return v.toString();
  // Mantener exacto el double sin decimales basura.
  return String(v);
}

// Precedencia para parentesis: add/sub=1, mul/div=2, neg=2, pow=3, atom=4.
function prec(n: Node): number {
  switch (n.type) {
    case 'add':
    case 'sub':
      return 1;
    case 'mul':
    case 'div':
      return 2;
    case 'neg':
      return 2;
    case 'pow':
      return 3;
    default:
      return 4;
  }
}

export function toLatex(n: Node): string {
  switch (n.type) {
    case 'num':
      return fmtNum(n.value);
    case 'var':
      return n.name;
    case 'neg':
      return `-${wrap(n.arg, 2)}`;
    case 'add':
      return `${toLatex(n.left)} + ${toLatex(n.right)}`;
    case 'sub':
      return `${toLatex(n.left)} - ${wrap(n.right, 2)}`;
    case 'mul': {
      const l = wrap(n.left, 2);
      const r = wrap(n.right, 2);
      return `${l} \\cdot ${r}`;
    }
    case 'div':
      return `\\frac{${toLatex(n.left)}}{${toLatex(n.right)}}`;
    case 'pow':
      return `${wrap(n.base, 4)}^{${toLatex(n.exp)}}`;
    case 'func': {
      const fname =
        n.name === 'ln'
          ? '\\ln'
          : n.name === 'exp'
            ? 'e^'
            : n.name === 'sqrt'
              ? '\\sqrt'
              : `\\${n.name}`;
      if (n.name === 'sqrt') return `\\sqrt{${toLatex(n.arg)}}`;
      if (n.name === 'exp') return `e^{${toLatex(n.arg)}}`;
      return `${fname}\\left(${toLatex(n.arg)}\\right)`;
    }
  }
}

function wrap(n: Node, minPrec: number): string {
  const s = toLatex(n);
  if (prec(n) < minPrec) return `\\left(${s}\\right)`;
  return s;
}

// Forma legible en texto plano (entrada/AST debug).
export function toText(n: Node): string {
  switch (n.type) {
    case 'num':
      return fmtNum(n.value);
    case 'var':
      return n.name;
    case 'neg':
      return `-(${toText(n.arg)})`;
    case 'add':
      return `${toText(n.left)} + ${toText(n.right)}`;
    case 'sub':
      return `${toText(n.left)} - (${toText(n.right)})`;
    case 'mul':
      return `(${toText(n.left)})*(${toText(n.right)})`;
    case 'div':
      return `(${toText(n.left)})/(${toText(n.right)})`;
    case 'pow':
      return `(${toText(n.base)})^(${toText(n.exp)})`;
    case 'func':
      return `${n.name}(${toText(n.arg)})`;
  }
}

// ===========================================================================
// DERIVADA
// ===========================================================================

export interface ResultadoCalculo {
  soportado: boolean;
  resultado?: Node;
  resultadoLatex?: string;
  entradaLatex: string;
  pasos: Paso[];
  nota?: string;
}

// Derivada bruta (sin simplificar) — la simplificacion va aparte.
function diff(n: Node): Node {
  switch (n.type) {
    case 'num':
      return ZERO;
    case 'var':
      return ONE;
    case 'neg':
      return neg(diff(n.arg));
    case 'add':
      return add(diff(n.left), diff(n.right));
    case 'sub':
      return sub(diff(n.left), diff(n.right));
    case 'mul':
      // (u v)' = u' v + u v'
      return add(mul(diff(n.left), n.right), mul(n.left, diff(n.right)));
    case 'div':
      // (u/v)' = (u' v - u v') / v^2
      return div(
        sub(mul(diff(n.left), n.right), mul(n.left, diff(n.right))),
        pow(n.right, num(2)),
      );
    case 'pow':
      return diffPow(n);
    case 'func':
      return diffFunc(n);
  }
}

function diffPow(n: { type: 'pow'; base: Node; exp: Node }): Node {
  const { base, exp } = n;
  const baseConst = isConst(base);
  const expConst = isConst(exp);
  if (expConst && !baseConst) {
    // Regla de la potencia + cadena: (u^c)' = c u^(c-1) u'
    const newExp = exp.type === 'num' ? num(exp.value - 1) : sub(exp, ONE);
    return mul(mul(exp, pow(base, newExp)), diff(base));
  }
  if (baseConst && !expConst) {
    // (a^u)' = a^u ln(a) u'
    return mul(mul(pow(base, exp), fn('ln', base)), diff(exp));
  }
  if (baseConst && expConst) {
    return ZERO;
  }
  // Caso general u^v = exp(v ln u): (u^v)' = u^v (v' ln u + v u'/u)
  const lnu = fn('ln', base);
  const term1 = mul(diff(exp), lnu);
  const term2 = div(mul(exp, diff(base)), base);
  return mul(pow(base, exp), add(term1, term2));
}

function diffFunc(n: { type: 'func'; name: FuncName; arg: Node }): Node {
  const u = n.arg;
  const du = diff(u);
  let outer: Node;
  switch (n.name) {
    case 'sin':
      outer = fn('cos', u);
      break;
    case 'cos':
      outer = neg(fn('sin', u));
      break;
    case 'tan':
      // sec^2(u) = 1/cos^2(u)
      outer = div(ONE, pow(fn('cos', u), num(2)));
      break;
    case 'exp':
      outer = fn('exp', u);
      break;
    case 'ln':
      outer = div(ONE, u);
      break;
    case 'sqrt':
      // d/du sqrt(u) = 1/(2 sqrt(u))
      outer = div(ONE, mul(num(2), fn('sqrt', u)));
      break;
  }
  return mul(outer, du);
}

export function derivative(exprSrc: string, varName = 'x'): ResultadoCalculo {
  let ast: Node;
  try {
    ast = parse(exprSrc, varName);
  } catch (e) {
    return {
      soportado: false,
      entradaLatex: exprSrc,
      pasos: [],
      nota: `No pude leer la expresion: ${(e as Error).message}`,
    };
  }

  const pasos: Paso[] = [];
  const entradaLatex = toLatex(simplify(ast));
  pasos.push({
    titulo: 'Expresion a derivar',
    operacion: `d/d${varName}`,
    matrizLatex: `\\frac{d}{d${varName}}\\left(${entradaLatex}\\right)`,
    nota: 'Aplicamos las reglas de derivacion sobre el arbol de la expresion.',
  });

  const ruleNote = describeRule(ast);
  if (ruleNote) {
    pasos.push({
      titulo: 'Regla aplicada',
      operacion: ruleNote.op,
      matrizLatex: ruleNote.latex,
      nota: ruleNote.nota,
    });
  }

  const raw = diff(ast);
  const simplified = simplify(raw);
  const resultadoLatex = toLatex(simplified);

  pasos.push({
    titulo: 'Resultado simplificado',
    operacion: 'simplificar',
    matrizLatex: `\\frac{d}{d${varName}}\\left(${entradaLatex}\\right) = ${resultadoLatex}`,
    nota: 'Reducimos terminos triviales (·1, +0, etc.).',
  });

  return {
    soportado: true,
    resultado: simplified,
    resultadoLatex,
    entradaLatex,
    pasos,
  };
}

// Texto explicativo de la regla dominante (para el primer paso pedagogico).
function describeRule(n: Node): { op: string; latex: string; nota: string } | null {
  switch (n.type) {
    case 'add':
    case 'sub':
      return {
        op: 'Regla de la suma',
        latex: "(u \\pm v)' = u' \\pm v'",
        nota: 'Derivamos cada termino por separado.',
      };
    case 'mul':
      return {
        op: 'Regla del producto',
        latex: "(u \\cdot v)' = u' v + u v'",
        nota: 'Derivada del primero por el segundo, mas el primero por la derivada del segundo.',
      };
    case 'div':
      return {
        op: 'Regla del cociente',
        latex: "\\left(\\frac{u}{v}\\right)' = \\frac{u' v - u v'}{v^2}",
        nota: 'Numerador cruzado sobre el denominador al cuadrado.',
      };
    case 'pow':
      return {
        op: 'Regla de la potencia (+ cadena)',
        latex: "(u^{c})' = c\\, u^{c-1} \\cdot u'",
        nota: 'Baja el exponente, resta uno y multiplica por la derivada interna.',
      };
    case 'func':
      return {
        op: 'Regla de la cadena',
        latex: "(f(u))' = f'(u) \\cdot u'",
        nota: 'Derivada externa evaluada en lo de adentro, por la derivada de lo de adentro.',
      };
    default:
      return null;
  }
}

// ===========================================================================
// INTEGRAL  (indefinida; siempre "+ C")
// ===========================================================================

// Integra n respecto a x. Devuelve el AST de la primitiva, o null si no soportado.
function integ(n: Node, varName: string): Node | null {
  switch (n.type) {
    case 'num':
      // ∫ c dx = c x
      return mul(n, { type: 'var', name: varName });

    case 'var':
      // ∫ x dx = x^2/2
      return div(pow(n, num(2)), num(2));

    case 'neg': {
      const inner = integ(n.arg, varName);
      return inner ? neg(inner) : null;
    }

    case 'add': {
      const a = integ(n.left, varName);
      const b = integ(n.right, varName);
      return a && b ? add(a, b) : null;
    }
    case 'sub': {
      const a = integ(n.left, varName);
      const b = integ(n.right, varName);
      return a && b ? sub(a, b) : null;
    }

    case 'mul': {
      // Linealidad: constante por funcion.
      if (isConst(n.left)) {
        const inner = integ(n.right, varName);
        return inner ? mul(n.left, inner) : null;
      }
      if (isConst(n.right)) {
        const inner = integ(n.left, varName);
        return inner ? mul(n.right, inner) : null;
      }
      return null; // producto de dos funciones de x: no soportado (sin por-partes)
    }

    case 'div': {
      // c / f  ->  c * ∫ 1/f ; o  f / c -> (1/c) ∫ f
      if (isConst(n.right)) {
        const inner = integ(n.left, varName);
        return inner ? div(inner, n.right) : null;
      }
      // ∫ 1/x dx = ln|x|  (caso clasico)
      if (isNum(n.left, 1) && n.right.type === 'var') {
        return fn('ln', n.right);
      }
      // ∫ c/x dx = c ln|x|
      if (isConst(n.left) && n.right.type === 'var') {
        return mul(n.left, fn('ln', n.right));
      }
      return null;
    }

    case 'pow':
      return integPow(n, varName);

    case 'func':
      return integFunc(n, varName);
  }
}

function integPow(n: { type: 'pow'; base: Node; exp: Node }, varName: string): Node | null {
  const { base, exp } = n;
  // ∫ x^k dx = x^(k+1)/(k+1) para k != -1, con base = la variable.
  if (base.type === 'var' && base.name === varName && exp.type === 'num') {
    if (exp.value === -1) return fn('ln', base); // ∫ x^-1 = ln|x|
    const k1 = exp.value + 1;
    return div(pow(base, num(k1)), num(k1));
  }
  // ∫ (a x + b)^k dx = (a x + b)^(k+1) / (a (k+1))  — sustitucion lineal.
  const lin = linearArg(base, varName);
  if (lin && exp.type === 'num' && exp.value !== -1) {
    const k1 = exp.value + 1;
    return div(pow(base, num(k1)), mul(num(k1), lin.a));
  }
  return null;
}

function integFunc(n: { type: 'func'; name: FuncName; arg: Node }, varName: string): Node | null {
  const u = n.arg;
  // Caso simple: argumento = la variable.
  const isVar = u.type === 'var' && u.name === varName;
  // Caso lineal: argumento = a x + b -> dividir por a.
  const lin = isVar ? { a: ONE } : linearArg(u, varName);
  if (!lin) return null;
  const a = lin.a;

  let prim: Node | null = null;
  switch (n.name) {
    case 'sin':
      prim = neg(fn('cos', u)); // ∫ sin = -cos
      break;
    case 'cos':
      prim = fn('sin', u); // ∫ cos = sin
      break;
    case 'exp':
      prim = fn('exp', u); // ∫ e^u = e^u (/a)
      break;
    default:
      // tan, ln, sqrt no estan en la tabla basica de integrales aqui.
      return null;
  }
  return div(prim, a);
}

// Si n es de la forma a*x + b (lineal en la variable), devuelve {a, b} como Node.
// Se usa para sustitucion lineal en integrales.
function linearArg(n: Node, varName: string): { a: Node; b: Node } | null {
  // Evaluamos el polinomio simbolico de grado <= 1.
  const lin = asLinear(n, varName);
  if (!lin) return null;
  if (isNum(lin.a, 0)) return null; // no depende de x
  return lin;
}

// Devuelve {a, b} tal que n == a*x + b, o null si no es lineal en x.
function asLinear(n: Node, v: string): { a: Node; b: Node } | null {
  switch (n.type) {
    case 'num':
      return { a: ZERO, b: n };
    case 'var':
      return n.name === v ? { a: ONE, b: ZERO } : null;
    case 'neg': {
      const inner = asLinear(n.arg, v);
      return inner ? { a: neg(inner.a), b: neg(inner.b) } : null;
    }
    case 'add': {
      const l = asLinear(n.left, v);
      const r = asLinear(n.right, v);
      return l && r ? { a: add(l.a, r.a), b: add(l.b, r.b) } : null;
    }
    case 'sub': {
      const l = asLinear(n.left, v);
      const r = asLinear(n.right, v);
      return l && r ? { a: sub(l.a, r.a), b: sub(l.b, r.b) } : null;
    }
    case 'mul': {
      const l = asLinear(n.left, v);
      const r = asLinear(n.right, v);
      if (!l || !r) return null;
      // (a1 x + b1)(a2 x + b2) es lineal solo si uno de los dos es constante.
      if (isNum(l.a, 0)) {
        // left constante = b1
        return { a: mul(l.b, r.a), b: mul(l.b, r.b) };
      }
      if (isNum(r.a, 0)) {
        return { a: mul(r.b, l.a), b: mul(r.b, l.b) };
      }
      return null; // producto con termino cuadratico
    }
    case 'div': {
      const l = asLinear(n.left, v);
      if (!l) return null;
      if (isConst(n.right)) {
        return { a: div(l.a, n.right), b: div(l.b, n.right) };
      }
      return null;
    }
    default:
      return null;
  }
}

export function integral(exprSrc: string, varName = 'x'): ResultadoCalculo {
  let ast: Node;
  try {
    ast = parse(exprSrc, varName);
  } catch (e) {
    return {
      soportado: false,
      entradaLatex: exprSrc,
      pasos: [],
      nota: `No pude leer la expresion: ${(e as Error).message}`,
    };
  }

  const pasos: Paso[] = [];
  const entradaLatex = toLatex(simplify(ast));
  pasos.push({
    titulo: 'Integral indefinida',
    operacion: `∫ ... d${varName}`,
    matrizLatex: `\\int ${entradaLatex}\\, d${varName}`,
    nota: 'Usamos linealidad y la tabla basica de integrales.',
  });

  const raw = integ(ast, varName);
  if (raw === null) {
    return {
      soportado: false,
      entradaLatex,
      pasos,
      nota:
        'Esta integral no esta soportada por el motor (requiere por-partes, fracciones parciales u otra tecnica). No la inventamos.',
    };
  }

  const simplified = simplify(raw);
  const resultadoLatex = `${toLatex(simplified)} + C`;

  pasos.push({
    titulo: 'Primitiva',
    operacion: 'antiderivada + C',
    matrizLatex: `\\int ${entradaLatex}\\, d${varName} = ${resultadoLatex}`,
    nota: 'Toda integral indefinida lleva la constante de integracion C.',
  });

  return {
    soportado: true,
    resultado: simplified,
    resultadoLatex,
    entradaLatex,
    pasos,
  };
}
