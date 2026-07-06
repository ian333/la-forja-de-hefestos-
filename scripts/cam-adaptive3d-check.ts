/**
 * Verificación del desbaste 3D por niveles (libro Cimo cap 10) — node puro:
 *   cd /home/ian/Orkesta/la-forja && npx tsx scripts/cam-adaptive3d-check.ts
 * Pieza sintética: caja base 100×100×20 + caja 40×40×20 encima (pirámide escalonada).
 * Invariantes: CERO gouge (todo corte va sobre la pieza dilatada por la fresa + stock),
 * los niveles sobre el escalón LIBRAN la torre con margen ≥ r, niveles descienden por
 * stepdown, todo tramo arranca con posicionamiento seguro (rapid+plunge).
 */
import { buildHeightmap, dilateByTool, generateAdaptive3DToolpath } from '../src/forja/cam/adaptive3d';

function box(cx: number, cy: number, z0: number, z1: number, w: number, d: number, P: number[], I: number[]) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2;
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const base = P.length / 3;
  for (const q of v) P.push(...q);
  const quads = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  for (const [a, b, c, d2] of quads) I.push(base + a, base + b, base + c, base + a, base + c, base + d2);
}

const P: number[] = [], I: number[] = [];
box(0, 0, 0, 20, 100, 100, P, I);  // base
box(0, 0, 20, 40, 40, 40, P, I);   // torre centrada

const tool = { diameter: 10, rpm: 6000, feed: 2000, plunge: 500 };
const p = { stepdown: 5, stepover: 4, stockToLeave: 0.5, safeZ: 8, grid: 1 };
const segs = generateAdaptive3DToolpath({ positions: P, indices: I }, tool, p);

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};

const hm = buildHeightmap({ positions: P, indices: I }, p.grid);
const D = dilateByTool(hm, tool.diameter / 2 + p.stockToLeave);
const dAt = (x: number, y: number) => {
  const gx = Math.min(hm.nx - 1, Math.max(0, Math.round((x - hm.x0) / p.grid)));
  const gy = Math.min(hm.ny - 1, Math.max(0, Math.round((y - hm.y0) / p.grid)));
  return D[gy * hm.nx + gx];
};

// 1) CERO gouge: muestreo de cada corte — el centro va sobre la pieza dilatada
const cuts = segs.filter(s => s.kind === 'cut');
let gouges = 0;
for (const s of cuts) {
  for (let t = 0; t <= 1; t += 0.1) {
    const x = s.from[0] + t * (s.to[0] - s.from[0]);
    const y = s.from[1] + t * (s.to[1] - s.from[1]);
    if (s.from[2] < dAt(x, y) - 1e-6) { gouges++; break; }
  }
}
check('cero gouge (todo corte sobre pieza dilatada)', gouges === 0, gouges ? `${gouges} cortes gougeando` : `${cuts.length} cortes limpios`);

// 2) niveles correctos: z ∈ {35,30,25,20-ish...} descendiendo por 5 desde 40−5
const zs = [...new Set(cuts.map(s => s.from[2]))].sort((a, b) => b - a);
check('niveles descienden por stepdown', zs.every((z, i) => i === 0 || Math.abs(zs[i - 1] - z - p.stepdown) < 1e-6), zs.map(z => z.toFixed(1)).join(','));
check('primer nivel = tope − stepdown', Math.abs(zs[0] - 35) < 1e-6);

// 3) los niveles entre 20 y 40 LIBRAN la torre: ningún corte con |x|<20+r+stock y |y| igual
const rSafe = 20 + tool.diameter / 2 + p.stockToLeave - p.grid; // margen menos 1 celda de tolerancia
let invade = 0;
for (const s of cuts.filter(s => s.from[2] > 20 + 1e-6)) {
  for (let t = 0; t <= 1; t += 0.05) {
    const x = s.from[0] + t * (s.to[0] - s.from[0]);
    const y = s.from[1] + t * (s.to[1] - s.from[1]);
    if (Math.abs(x) < rSafe && Math.abs(y) < rSafe) { invade++; break; }
  }
}
check('la torre se libra con margen ≥ r+stock', invade === 0, invade ? `${invade} invasiones` : 'ningún corte dentro del margen');

// 4) bajo el tope de la base NO hay cortes: el stock = bbox de la pieza → ahí no queda
// aire que desbastar (la base lo llena todo). El "Stock tab" real llega en cap 11.
check('cero cortes bajo el tope de la base (stock=bbox)', zs.every(z => z > 20 + p.stockToLeave - 1e-6), zs.map(z => z.toFixed(1)).join(','));

// 5) todo corte precedido de posicionamiento (rapid/plunge/cut encadenado)
let orphan = 0;
for (let i = 0; i < segs.length; i++) {
  const s = segs[i];
  if (s.kind !== 'cut') continue;
  const prev = segs[i - 1];
  if (!prev || Math.hypot(prev.to[0] - s.from[0], prev.to[1] - s.from[1], prev.to[2] - s.from[2]) > 1e-9) orphan++;
}
check('cadena continua (cero cortes huérfanos)', orphan === 0, orphan ? `${orphan} huérfanos` : '');

console.log(`\nsegs=${segs.length} cortes=${cuts.length} niveles=${zs.length}`);
if (fails) { console.error(`\n${fails} CHECKS FALLARON`); process.exit(1); }
console.log('\nADAPTIVE3D_CHECK_OK');
