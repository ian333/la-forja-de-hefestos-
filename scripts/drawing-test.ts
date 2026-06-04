/* Test del MOTOR DE PLANOS (drawing.ts) sobre una caja 40×20×12 sintética.
 * Corre: node --import tsx scripts/drawing-test.ts */
import { generateDrawing } from '../src/forja/brep/drawing';

// caja (0,0,0)→(40,20,12): X=ancho=40, Y=prof=20, Z=alto=12
const V: Array<[number, number, number]> = [
  [0, 0, 0], [40, 0, 0], [40, 20, 0], [0, 20, 0],
  [0, 0, 12], [40, 0, 12], [40, 20, 12], [0, 20, 12],
];
const tri = (a: number, b: number, c: number) => [a, b, c];
const idx: number[] = [
  ...tri(0, 1, 2), ...tri(0, 2, 3),   // z=0
  ...tri(4, 5, 6), ...tri(4, 6, 7),   // z=12
  ...tri(0, 1, 5), ...tri(0, 5, 4),   // y=0
  ...tri(3, 2, 6), ...tri(3, 6, 7),   // y=20
  ...tri(0, 3, 7), ...tri(0, 7, 4),   // x=0
  ...tri(1, 2, 6), ...tri(1, 6, 5),   // x=40
];
const positions: number[] = [];
for (const v of V) positions.push(v[0], v[1], v[2]);
const E = (a: number, b: number) => ({ polyline: [V[a], V[b]] as Array<[number, number, number]> });
const edges = [
  E(0, 1), E(1, 2), E(2, 3), E(3, 0),   // base z=0
  E(4, 5), E(5, 6), E(6, 7), E(7, 4),   // top z=12
  E(0, 4), E(1, 5), E(2, 6), E(3, 7),   // verticales
];

const d = generateDrawing({ positions, indices: idx, edges }, { name: 'Caja test', material: 'Aluminio', massG: 124.7 });

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 0.05) => Math.abs(a - b) < t;
function ck(name: string, ok: boolean, extra = '') { if (ok) pass++; else { fail++; console.log(`✗ ${name} ${extra}`); } }

ck('bbox w', near(d.bbox.w, 40), JSON.stringify(d.bbox));
ck('bbox h', near(d.bbox.h, 12));
ck('bbox d', near(d.bbox.d, 20));

const byKey = Object.fromEntries(d.views.map((v) => [v.key, v]));
const f = byKey.front, t = byKey.top, r = byKey.right;
ck('ALZADO 40×12', near(f.wmm, 40) && near(f.hmm, 12), JSON.stringify(f));
ck('PLANTA 40×20', near(t.wmm, 40) && near(t.hmm, 20), JSON.stringify(t));
ck('LATERAL 20×12', near(r.wmm, 20) && near(r.hmm, 12), JSON.stringify(r));

// HLR: cada vista ve el rectángulo frontal (4 visibles) y oculta el de atrás (4)
ck('ALZADO visibles=4', f.nVisible === 4, `nVis=${f.nVisible}`);
ck('ALZADO ocultas=4', f.nHidden === 4, `nHid=${f.nHidden}`);
ck('ALZADO perímetro visible 104', near(f.visibleLen, 104, 0.5), `len=${f.visibleLen}`);
ck('PLANTA visibles=4', t.nVisible === 4, `nVis=${t.nVisible}`);
ck('PLANTA perímetro visible 120', near(t.visibleLen, 120, 0.5), `len=${t.visibleLen}`);
ck('LATERAL visibles=4', r.nVisible === 4, `nVis=${r.nVisible}`);
ck('LATERAL perímetro visible 64', near(r.visibleLen, 64, 0.5), `len=${r.visibleLen}`);

// SVG bien formado + contenido clave
ck('SVG abre/cierra', d.svg.startsWith('<svg') && d.svg.trimEnd().endsWith('</svg>'));
ck('SVG tiene cajetín', d.svg.includes('data-testid="title-block"'));
ck('SVG líneas visibles', d.svg.includes('data-line="visible"'));
ck('SVG líneas ocultas', d.svg.includes('data-line="hidden"'));
ck('SVG etiqueta ALZADO', d.svg.includes('>ALZADO<'));
ck('SVG cota ancho 40.0', d.svg.includes('>40.0<'));
ck('SVG nombre pieza', d.svg.includes('Caja test'));
ck('SVG escala', d.scale.includes(':') && d.svg.includes('ESCALA'));

console.log(`DRAWING_TEST pass=${pass} fail=${fail} · escala=${d.scale}`);
console.log('views:', JSON.stringify(d.views));
process.exit(fail === 0 ? 0 : 1);
