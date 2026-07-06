/**
 * Verificación del motor LÁSER (libro Cimo caps 11-13) — node puro:
 *   cd /home/ian/Orkesta/la-forja && npx tsx scripts/cam-laser-check.ts
 * Caso libro: placa 120×80 con 2 barrenos ⌀20, hoja 1000×500, kerf 0.4, feed 3800.
 * Invariantes: interiores ANTES del exterior, pierce con pausa por lazo, kerf hacia
 * AFUERA en el exterior y hacia ADENTRO en huecos, nesting cabe sin traslape.
 */
import { offsetLoop, nestParts, laserGcode } from '../src/forja/cam/laser';
import type { XY, LaserPart, LaserTool } from '../src/forja/cam/laser';

const rect = (w: number, h: number): XY[] => [
  { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]; // CCW
const circle = (cx: number, cy: number, r: number, n = 36): XY[] =>
  Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos(2 * Math.PI * i / n), y: cy + r * Math.sin(2 * Math.PI * i / n) }));

const part: LaserPart = { outline: rect(120, 80), holes: [circle(30, 40, 10), circle(90, 40, 10)] };
const tool: LaserTool = { kerf: 0.4, feed: 3800, cutPower: 80, piercePower: 100, pierceMs: 300 };

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};

// 1) kerf: exterior crece +0.2, hueco encoge −0.2 (el barreno queda ⌀20 tras el corte)
const outer = offsetLoop(part.outline, 0.2);
check('kerf exterior hacia AFUERA', Math.min(...outer.map(p => p.x)) < -0.19 && Math.max(...outer.map(p => p.x)) > 120.19,
  `x∈[${Math.min(...outer.map(p => p.x)).toFixed(2)}, ${Math.max(...outer.map(p => p.x)).toFixed(2)}]`);
const hole = offsetLoop(circle(30, 40, 10), -0.2);
const rHole = hole.map(p => Math.hypot(p.x - 30, p.y - 40));
check('kerf del hueco hacia ADENTRO (r≈9.8)', Math.abs(Math.max(...rHole) - 9.8) < 0.05, `r=${Math.max(...rHole).toFixed(2)}`);

// 2) nesting: ¿cuántas caben en 1000×500 con gap 8? cols=7 (128/…), rows=5 → 35
const places = nestParts(part, { w: 1000, h: 500 }, 35, 8);
check('nesting: 35 piezas caben en la hoja', places.length === 35, `${places.length}`);
// sin traslape: separación mínima entre orígenes ≥ bbox+gap en alguna dirección
let overlap = 0;
for (let i = 0; i < places.length; i++)
  for (let j = i + 1; j < places.length; j++) {
    const ddx = Math.abs(places[i].dx - places[j].dx), ddy = Math.abs(places[i].dy - places[j].dy);
    if (ddx < 128 - 1e-9 && ddy < 88 - 1e-9) overlap++;
  }
check('nesting: cero traslapes', overlap === 0, overlap ? `${overlap} pares` : '');
// dentro de la hoja
check('nesting: todo dentro de la hoja', places.every(pl => pl.dx >= 0 && pl.dy >= 0 && pl.dx + 120 <= 1000 && pl.dy + 80 <= 500));

// 3) G-code de 2 piezas
const g = laserGcode(part, places.slice(0, 2), tool, 'PLACA 2X');
const lines = g.trim().split('\n');
// interiores primero: en cada pieza, los dos M5 de huecos ANTES del M5 del exterior;
// el patrón por pieza = 3 lazos: pierce×3; el TERCER lazo debe ser el exterior (llega a x<0 con dx sumado)
const pieces = g.split('(pieza ').slice(1);
check('G-code: 2 piezas', pieces.length === 2);
let orderOk = true;
for (const pc of pieces) {
  const loops = pc.split('M3 S100').slice(1); // cada lazo arranca con pierce
  if (loops.length !== 3) { orderOk = false; break; }
  // el EXTERIOR es el único lazo cuyo recorrido X abarca todo el ancho de la pieza
  // (≈120+kerf); debe ser el ÚLTIMO. Los huecos (⌀20) tienen spans chicos.
  const spanX = (lp: string) => {
    const xs = [...lp.matchAll(/G1 X(-?[\d.]+)/g)].map(mm => parseFloat(mm[1]));
    return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  };
  const spans = loops.map(spanX);
  if (!(spans[2] > 100 && spans[0] < 30 && spans[1] < 30)) orderOk = false;
}
check('G-code: interiores ANTES del exterior (en ambas piezas)', orderOk);
check('G-code: pierce con pausa G4 P0.30', (g.match(/G4 P0\.30 \(pierce\)/g) ?? []).length === 6, `${(g.match(/G4/g) ?? []).length} pierces`);
check('G-code: feed 3800', g.includes('F3800'));
check('G-code: M5 al cerrar cada lazo', (g.match(/^M5$/gm) ?? []).length === 6);
check('G-code: M30 final', lines[lines.length - 1] === 'M30');

console.log(`\nlíneas gcode=${lines.length} · nesting=${places.length}`);
if (fails) { console.error(`\n${fails} CHECKS FALLARON`); process.exit(1); }
console.log('\nLASER_CHECK_OK');
