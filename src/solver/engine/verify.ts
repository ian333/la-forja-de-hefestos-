// verify.ts — Verificador ejecutable del motor.
// Corre asserts de TODOS los casos canonicos y emite una linea final:
//   VERIFY_RESULT={"total":N,"passed":N,"failed":N,"fails":[...]}
// Sale con codigo 1 si algo falla.
//
// Ejecucion (aislada, sin build local):
//   esbuild verify.ts --bundle --platform=node --format=esm > /tmp/verify.mjs
//   node /tmp/verify.mjs

import { Fraction } from './fraction';
import { solveGaussJordan, matFromNumbers, vecFromNumbers } from './linear';
import { determinant } from './determinant';
import { derivative, integral, parse, evaluate } from './calculus';

interface Fail {
  name: string;
  detail: string;
}

const fails: Fail[] = [];
let total = 0;
let passed = 0;

function check(name: string, cond: boolean, detail = ''): void {
  total++;
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    fails.push({ name, detail });
    console.log(`  FAIL ${name}  ${detail}`);
  }
}

// Compara dos expresiones (resultado vs esperado) por evaluacion numerica en
// puntos fijos. Robusto al formato simbolico exacto.
const PROBE_POINTS = [0.3, 1.7, 2.5];
function exprEquals(gotSrc: string, expectedSrc: string, variable = 'x'): { ok: boolean; detail: string } {
  let g, e;
  try {
    g = parse(gotSrc, variable);
    e = parse(expectedSrc, variable);
  } catch (err) {
    return { ok: false, detail: `parse error: ${(err as Error).message}` };
  }
  for (const x of PROBE_POINTS) {
    const gv = evaluate(g, x);
    const ev = evaluate(e, x);
    if (!Number.isFinite(gv) || !Number.isFinite(ev)) continue;
    if (Math.abs(gv - ev) > 1e-9) {
      return {
        ok: false,
        detail: `en x=${x}: got=${gv} expected=${ev} (got="${gotSrc}")`,
      };
    }
  }
  return { ok: true, detail: '' };
}

// ===========================================================================
console.log('--- Fraction (sanidad de la aritmetica exacta) ---');
{
  const a = new Fraction(1n, 3n);
  const b = new Fraction(1n, 6n);
  check('1/3 + 1/6 = 1/2', a.add(b).equals(new Fraction(1n, 2n)), a.add(b).toString());
  check('2/4 reduce a 1/2', new Fraction(2n, 4n).equals(new Fraction(1n, 2n)));
  check('1/3 * 3 = 1', a.mul(3).equals(Fraction.one()));
  check('(1/2)/(1/4) = 2', new Fraction(1n, 2n).div(new Fraction(1n, 4n)).equals(Fraction.from(2)));
  check('-2/3 toLatex', new Fraction(-2n, 3n).toLatex() === '-\\frac{2}{3}', new Fraction(-2n, 3n).toLatex());
}

// ===========================================================================
console.log('--- Gauss-Jordan ---');
{
  // A=[[2,1,-1],[-3,-1,2],[-2,1,2]], b=[8,-11,-3] => x=2,y=3,z=-1
  const A = matFromNumbers([
    [2, 1, -1],
    [-3, -1, 2],
    [-2, 1, 2],
  ]);
  const b = vecFromNumbers([8, -11, -3]);
  const r = solveGaussJordan(A, b);
  check('tipo = unica', r.tipo === 'unica', r.tipo);
  const sol = r.solucion!;
  check('x = 2', sol && sol[0].equals(Fraction.from(2)), sol ? sol[0].toString() : 'null');
  check('y = 3', sol && sol[1].equals(Fraction.from(3)), sol ? sol[1].toString() : 'null');
  check('z = -1', sol && sol[2].equals(Fraction.from(-1)), sol ? sol[2].toString() : 'null');
  check('genera pasos', r.pasos.length > 0, `pasos=${r.pasos.length}`);
}
{
  // Sistema con infinitas soluciones: x + y = 1; 2x + 2y = 2
  const A = matFromNumbers([
    [1, 1],
    [2, 2],
  ]);
  const b = vecFromNumbers([1, 2]);
  const r = solveGaussJordan(A, b);
  check('infinitas soluciones detectadas', r.tipo === 'infinitas', r.tipo);
}
{
  // Sistema inconsistente: x + y = 1; x + y = 2
  const A = matFromNumbers([
    [1, 1],
    [1, 1],
  ]);
  const b = vecFromNumbers([1, 2]);
  const r = solveGaussJordan(A, b);
  check('sin solucion detectada', r.tipo === 'sin-solucion', r.tipo);
}

// ===========================================================================
console.log('--- Determinante ---');
{
  const A = matFromNumbers([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 10],
  ]);
  const r = determinant(A);
  check('det([[1,2,3],[4,5,6],[7,8,10]]) = -3', r.valor.equals(Fraction.from(-3)), r.valor.toString());
}
{
  const A = matFromNumbers([
    [6, 1, 1],
    [4, -2, 5],
    [2, 8, 7],
  ]);
  const r = determinant(A);
  check('det([[6,1,1],[4,-2,5],[2,8,7]]) = -306', r.valor.equals(Fraction.from(-306)), r.valor.toString());
}
{
  // Identidad 2x2 -> 1
  const A = matFromNumbers([
    [1, 0],
    [0, 1],
  ]);
  check('det(I2) = 1', determinant(A).valor.equals(Fraction.one()));
}
{
  // Singular -> 0
  const A = matFromNumbers([
    [1, 2],
    [2, 4],
  ]);
  check('det singular = 0', determinant(A).valor.isZero());
}

// ===========================================================================
console.log('--- Derivada ---');
{
  const r = derivative('x^3');
  check('d/dx(x^3) soportado', r.soportado === true, r.nota ?? '');
  if (r.soportado) {
    const cmp = exprEquals(stripLatex(r), '3*x^2');
    check('d/dx(x^3) = 3x^2', cmp.ok, cmp.detail);
  }
}
{
  const r = derivative('x^2 + 3x + 1');
  if (r.soportado) {
    const cmp = exprEquals(stripLatex(r), '2*x + 3');
    check('d/dx(x^2+3x+1) = 2x+3', cmp.ok, cmp.detail);
  } else check('d/dx(x^2+3x+1)', false, r.nota ?? '');
}
{
  const r = derivative('sin(x)');
  if (r.soportado) {
    const cmp = exprEquals(stripLatex(r), 'cos(x)');
    check('d/dx(sin(x)) = cos(x)', cmp.ok, cmp.detail);
  } else check('d/dx(sin(x))', false, r.nota ?? '');
}
{
  const r = derivative('x*sin(x)');
  if (r.soportado) {
    const cmp = exprEquals(stripLatex(r), 'sin(x) + x*cos(x)');
    check('d/dx(x sin(x)) = sin(x)+x cos(x)', cmp.ok, cmp.detail);
  } else check('d/dx(x sin(x))', false, r.nota ?? '');
}
{
  const r = derivative('exp(2x)');
  if (r.soportado) {
    const cmp = exprEquals(stripLatex(r), '2*exp(2x)');
    check('d/dx(e^{2x}) = 2 e^{2x} (cadena)', cmp.ok, cmp.detail);
  } else check('d/dx(exp(2x))', false, r.nota ?? '');
}

// ===========================================================================
console.log('--- Integral ---');
{
  const r = integral('x^2');
  if (r.soportado) {
    const cmp = exprEquals(stripIntegral(r), 'x^3/3');
    check('∫ x^2 = x^3/3 (+C)', cmp.ok, cmp.detail);
  } else check('∫ x^2', false, r.nota ?? '');
}
{
  const r = integral('2x + 3');
  if (r.soportado) {
    const cmp = exprEquals(stripIntegral(r), 'x^2 + 3x');
    check('∫ (2x+3) = x^2+3x (+C)', cmp.ok, cmp.detail);
  } else check('∫ (2x+3)', false, r.nota ?? '');
}
{
  const r = integral('cos(x)');
  if (r.soportado) {
    const cmp = exprEquals(stripIntegral(r), 'sin(x)');
    check('∫ cos(x) = sin(x) (+C)', cmp.ok, cmp.detail);
  } else check('∫ cos(x)', false, r.nota ?? '');
}
{
  // Sustitucion lineal: ∫ cos(2x) = sin(2x)/2
  const r = integral('cos(2x)');
  if (r.soportado) {
    const cmp = exprEquals(stripIntegral(r), 'sin(2x)/2');
    check('∫ cos(2x) = sin(2x)/2 (subst lineal)', cmp.ok, cmp.detail);
  } else check('∫ cos(2x)', false, r.nota ?? '');
}
{
  // Caso honesto NO soportado: producto de dos funciones de x.
  const r = integral('x*sin(x)');
  check('∫ x sin(x) honestamente no soportado', r.soportado === false, `soportado=${r.soportado}`);
}

// ===========================================================================
// Para comparar, necesitamos el AST resultado, no su LaTeX. Reusamos el campo
// `resultado` (Node) -> texto plano via toText reparseando. Pero exprEquals
// recibe texto: usamos un puente que vuelve a serializar el Node a texto.
function stripLatex(r: { resultado?: any }): string {
  return nodeToTextSafe(r.resultado);
}
function stripIntegral(r: { resultado?: any }): string {
  // El resultado de integral ya excluye "+ C" en r.resultado (Node).
  return nodeToTextSafe(r.resultado);
}

// Serializa un Node a texto parseable por nuestro parser (sin perder semantica).
function nodeToTextSafe(n: any): string {
  if (!n) return '0';
  switch (n.type) {
    case 'num':
      return `(${n.value})`;
    case 'var':
      return n.name;
    case 'neg':
      return `(-(${nodeToTextSafe(n.arg)}))`;
    case 'add':
      return `(${nodeToTextSafe(n.left)} + ${nodeToTextSafe(n.right)})`;
    case 'sub':
      return `(${nodeToTextSafe(n.left)} - (${nodeToTextSafe(n.right)}))`;
    case 'mul':
      return `((${nodeToTextSafe(n.left)})*(${nodeToTextSafe(n.right)}))`;
    case 'div':
      return `((${nodeToTextSafe(n.left)})/(${nodeToTextSafe(n.right)}))`;
    case 'pow':
      return `((${nodeToTextSafe(n.base)})^(${nodeToTextSafe(n.exp)}))`;
    case 'func':
      return `${n.name}(${nodeToTextSafe(n.arg)})`;
    default:
      return '0';
  }
}

// ===========================================================================
const failed = total - passed;
console.log('');
console.log(`VERIFY_RESULT=${JSON.stringify({ total, passed, failed, fails })}`);
(globalThis as { process?: { exit(code: number): void } }).process?.exit(failed > 0 ? 1 : 0);
