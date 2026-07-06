/**
 * Verificación del motor CAM de careado (libro Cimo cap 9) — corre en node puro:
 *   cd /home/ian/Orkesta/la-forja && npx tsx scripts/cam-facing-check.ts
 * Chequea invariantes: cobertura total del stock, fresa libra bordes, Z constante
 * en corte, G-code bien formado (arranque/paro husillo, feeds del libro).
 */
import { generateFacingToolpath, toGcode, toolpathStats } from '../src/forja/cam/facing';

const stock = { x0: 0, y0: 0, x1: 110, y1: 70, zTop: 20 };
const tool = { diameter: 40, rpm: 7850, feed: 7070, plunge: 800 };
const p = { stepover: 27, passExtension: 2, depth: 1.5, safeZ: 10 };

const segs = generateFacingToolpath(stock, tool, p);
const g = toGcode(segs, tool);
const st = toolpathStats(segs, tool);
const r = tool.diameter / 2;

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};

// 1) Pasadas horizontales (cut con Y constante)
const passes = segs.filter(s => s.kind === 'cut' && Math.abs(s.from[1] - s.to[1]) < 1e-9);
const ys = [...new Set(passes.map(s => s.from[1]))].sort((a, b) => a - b);
console.log(`pasadas Y: ${ys.map(y => y.toFixed(1)).join(', ')}`);

// 2) Cobertura: cada franja del stock [y0,y1] queda a ≤ r de alguna línea de pasada
let uncovered = 0;
for (let y = stock.y0; y <= stock.y1; y += 0.5)
  if (!ys.some(cy => Math.abs(cy - y) <= r + 1e-9)) uncovered++;
check('cobertura total del stock', uncovered === 0, uncovered ? `${uncovered} franjas sin cubrir` : 'toda franja a ≤ r de una pasada');

// 3) La fresa LIBRA los bordes en X (arranque/fin fuera del stock)
const xs = passes.flatMap(s => [s.from[0], s.to[0]]);
check('fresa libra borde X-min', Math.min(...xs) <= stock.x0 - r, `xMin=${Math.min(...xs)}`);
check('fresa libra borde X-max', Math.max(...xs) >= stock.x1 + r, `xMax=${Math.max(...xs)}`);

// 4) Todos los cortes a Z = zTop - depth
const zCut = stock.zTop - p.depth;
check('Z de corte constante', segs.filter(s => s.kind === 'cut').every(s => s.from[2] === zCut && s.to[2] === zCut), `z=${zCut}`);

// 5) Continuidad de la cadena (to de un seg = from del siguiente)
let broken = 0;
for (let i = 1; i < segs.length; i++)
  if (Math.hypot(...segs[i].from.map((v, k) => v - segs[i - 1].to[k]) as [number, number, number]) > 1e-9) broken++;
check('cadena continua', broken === 0, broken ? `${broken} saltos` : 'sin saltos');

// 6) G-code bien formado
const lines = g.trim().split('\n');
check('G-code: cabecera G21/G90/G17', lines[1] === 'G21 (mm)' && lines[2] === 'G90 (absoluto)' && lines[3] === 'G17 (plano XY)');
check('G-code: husillo M3 S7850', lines[4] === 'M3 S7850');
check('G-code: cierre M5/M30', lines[lines.length - 2] === 'M5' && lines[lines.length - 1] === 'M30');
check('G-code: feed de corte F7070 presente', g.includes('F7070'));
check('G-code: feed de plunge F800 presente', g.includes('F800'));

console.log(`\ncutLen=${st.cutLen.toFixed(0)}mm  tiempo=${st.timeMin.toFixed(2)}min  segs=${segs.length}  líneas gcode=${lines.length}`);
console.log('\n--- primeras líneas ---\n' + lines.slice(0, 9).join('\n'));
console.log('--- últimas líneas ---\n' + lines.slice(-4).join('\n'));

if (fails) { console.error(`\n${fails} CHECKS FALLARON`); process.exit(1); }
console.log('\nCAM_CHECK_OK');
