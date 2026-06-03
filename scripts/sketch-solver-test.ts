/*
 * sketch-solver-test.ts — invariantes del solver de restricciones 2D.
 * Correr (en iangpu, sin RAM-heavy build):
 *   npx esbuild scripts/sketch-solver-test.ts --bundle --platform=node --format=cjs --outfile=/tmp/sst.cjs && node /tmp/sst.cjs
 */
import { solveSketch, type Sketch } from '../src/forja/brep/sketch-solver';

let pass = 0, fail = 0;
const approx = (a: number, b: number, tol = 1e-3) => Math.abs(a - b) <= tol;
function check(name: string, cond: boolean, detail = '') {
  console.log((cond ? '✓' : '✗') + ' ' + name + (detail ? '  ' + detail : ''));
  cond ? pass++ : fail++;
}

// 1) RECTÁNGULO totalmente restringido → DOF 0, esquinas exactas.
{
  const s: Sketch = {
    points: [{ x: 0, y: 0 }, { x: 38, y: 3 }, { x: 42, y: 18 }, { x: 2, y: 21 }],
    lines: [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }, { a: 3, b: 0 }],
    circles: [],
    constraints: [
      { t: 'fix', p: 0 },
      { t: 'horizontal', a: 0, b: 1 }, { t: 'vertical', a: 1, b: 2 },
      { t: 'horizontal', a: 2, b: 3 }, { t: 'vertical', a: 3, b: 0 },
      { t: 'distance', p: 0, q: 1, d: 40 }, { t: 'distance', p: 1, q: 2, d: 20 },
    ],
  };
  const r = solveSketch(s);
  const P = s.points;
  check('rect: converge', r.converged, `res=${r.residual.toExponential(1)}`);
  check('rect: DOF=0 (full)', r.dof === 0 && r.status === 'full', `dof=${r.dof} status=${r.status}`);
  check('rect: p1≈(40,0)', approx(P[1].x, 40) && approx(P[1].y, 0), `(${P[1].x.toFixed(2)},${P[1].y.toFixed(2)})`);
  check('rect: p2≈(40,20)', approx(P[2].x, 40) && approx(P[2].y, 20), `(${P[2].x.toFixed(2)},${P[2].y.toFixed(2)})`);
  check('rect: p3≈(0,20)', approx(P[3].x, 0) && approx(P[3].y, 20), `(${P[3].x.toFixed(2)},${P[3].y.toFixed(2)})`);
}

// 2) RECTÁNGULO sin una cota → DOF 1 (sub-restringido, azul).
{
  const s: Sketch = {
    points: [{ x: 0, y: 0 }, { x: 38, y: 3 }, { x: 42, y: 18 }, { x: 2, y: 21 }],
    lines: [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }, { a: 3, b: 0 }],
    circles: [],
    constraints: [
      { t: 'fix', p: 0 },
      { t: 'horizontal', a: 0, b: 1 }, { t: 'vertical', a: 1, b: 2 },
      { t: 'horizontal', a: 2, b: 3 }, { t: 'vertical', a: 3, b: 0 },
      { t: 'distance', p: 0, q: 1, d: 40 }, // falta la altura
    ],
  };
  const r = solveSketch(s);
  check('rect-sub: DOF=1 (under)', r.dof === 1 && r.status === 'under', `dof=${r.dof} status=${r.status}`);
}

// 3) CÍRCULO con cota de radio → r exacto, DOF 0.
{
  const s: Sketch = { points: [{ x: 5, y: 5, fixed: true }], lines: [], circles: [{ c: 0, r: 3 }], constraints: [{ t: 'radius', c: 0, r: 8 }] };
  const r = solveSketch(s);
  check('círculo: r→8 exacto', approx(s.circles[0].r, 8), `r=${s.circles[0].r.toFixed(3)}`);
  check('círculo: DOF=0', r.dof === 0 && r.status === 'full', `dof=${r.dof}`);
}

// 4) COINCIDENTE → el punto libre cae sobre el fijo.
{
  const s: Sketch = { points: [{ x: 0, y: 0, fixed: true }, { x: 5, y: 7 }], lines: [], circles: [], constraints: [{ t: 'coincident', p: 0, q: 1 }] };
  const r = solveSketch(s);
  check('coincident: p1≈(0,0)', approx(s.points[1].x, 0) && approx(s.points[1].y, 0), `(${s.points[1].x.toFixed(2)},${s.points[1].y.toFixed(2)})`);
  check('coincident: DOF=0', r.dof === 0, `dof=${r.dof}`);
}

// 5) CONFLICTO (dos cotas incompatibles en el mismo par) → status 'over'.
{
  const s: Sketch = { points: [{ x: 0, y: 0, fixed: true }, { x: 10, y: 0 }], lines: [], circles: [], constraints: [{ t: 'distance', p: 0, q: 1, d: 10 }, { t: 'distance', p: 0, q: 1, d: 15 }] };
  const r = solveSketch(s);
  check('conflicto: status=over (no converge)', r.status === 'over' && !r.converged, `res=${r.residual.toFixed(2)} status=${r.status}`);
}

// 6) PERPENDICULAR + cotas → escuadra exacta.
{
  const s: Sketch = {
    points: [{ x: 0, y: 0, fixed: true }, { x: 10, y: 0 }, { x: 9, y: 8 }],
    lines: [{ a: 0, b: 1 }, { a: 1, b: 2 }],
    circles: [],
    constraints: [
      { t: 'horizontal', a: 0, b: 1 }, { t: 'distance', p: 0, q: 1, d: 10 },
      { t: 'perpendicular', l1: 0, l2: 1 }, { t: 'distance', p: 1, q: 2, d: 8 },
    ],
  };
  const r = solveSketch(s);
  check('perp: p1≈(10,0)', approx(s.points[1].x, 10) && approx(s.points[1].y, 0), `(${s.points[1].x.toFixed(2)},${s.points[1].y.toFixed(2)})`);
  check('perp: p2≈(10,8)', approx(s.points[2].x, 10) && approx(s.points[2].y, 8), `(${s.points[2].x.toFixed(2)},${s.points[2].y.toFixed(2)})`);
  check('perp: DOF=0 (full)', r.dof === 0 && r.status === 'full', `dof=${r.dof}`);
}

console.log(`\n[RESULT] ${pass}/${pass + fail} passed`);
process.exit(fail === 0 ? 0 : 1);
