/* Test del motor de expresiones (expr.ts). Corre: node --import tsx scripts/expr-test.ts */
import { evalExpr, resolveParams } from '../src/forja/brep/expr';

let pass = 0, fail = 0;
const approx = (a: number, b: number) => Math.abs(a - b) < 1e-9;
function eq(name: string, got: unknown, want: unknown) {
  const ok = typeof want === 'number' && typeof got === 'number' ? approx(got, want) : got === want;
  if (ok) { pass++; } else { fail++; console.log(`✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
}

// aritmética + precedencia
eq('2+3*4', evalExpr('2+3*4'), 14);
eq('(2+3)*4', evalExpr('(2+3)*4'), 20);
eq('pow right-assoc 2^3^2', evalExpr('2^3^2'), 512);
eq('unary -2^2', evalExpr('-2^2'), -4);
eq('2^-2', evalExpr('2^-2'), 0.25);
eq('div', evalExpr('10/4'), 2.5);
eq('paren nest', evalExpr('((1+2)*(3+4))'), 21);
// funciones + constantes
eq('sqrt(16)', evalExpr('sqrt(16)'), 4);
eq('max', evalExpr('max(3,7,2)'), 7);
eq('min', evalExpr('min(3,7,2)'), 2);
eq('abs(-5)', evalExpr('abs(-5)'), 5);
eq('pi', evalExpr('pi'), Math.PI);
eq('sin(rad(90))', evalExpr('sin(rad(90))'), 1);
eq('round(3.6)', evalExpr('round(3.6)'), 4);
// scope (referencias a parámetros)
eq('width/2', evalExpr('width/2', { width: 40 }), 20);
eq('a*b+c', evalExpr('a*b+c', { a: 2, b: 3, c: 1 }), 7);

// errores
let threw = false;
try { evalExpr('foo+1'); } catch { threw = true; }
eq('unknown id throws', threw, true);
threw = false;
try { evalExpr('2+'); } catch { threw = true; }
eq('syntax throws', threw, true);

// resolveParams: cadena de dependencias + errores
const r = resolveParams([
  { id: 'a', name: 'ancho', expr: '40' },
  { id: 'b', name: 'alto', expr: 'ancho/2' },
  { id: 'c', name: 'espesor', expr: 'min(alto, 15)' },
  { id: 'd', name: 'malo', expr: 'noexiste*2' },
  { id: 'e', name: 'ancho', expr: '99' }, // duplicado
  { id: 'f', name: '2x', expr: '1' },     // nombre inválido
]);
eq('resolve ancho', r.scope.ancho, 40);
eq('resolve alto (dep)', r.scope.alto, 20);
eq('resolve espesor (func+dep)', r.scope.espesor, 15);
eq('value by id', r.values.b, 20);
eq('error malo', r.errors.d?.includes('desconocido'), true);
eq('error duplicado', r.errors.e, 'nombre duplicado');
eq('error nombre inválido', r.errors.f, 'nombre inválido');
eq('malo NOT in scope', 'malo' in r.scope, false);

console.log(`EXPR_TEST pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
