/**
 * Verificación del motor CAM de taladrado (libro Cimo cap 9/5) — node puro:
 *   cd /home/ian/Orkesta/la-forja && npx tsx scripts/cam-drill-check.ts
 * Caso del libro: 8 barrenos ⌀6.8 (pilotos M8) pasantes en placa de 42mm, círculo R50.
 * Invariantes: ciclo peck correcto (q=3⌀, retracción total a R, re-entrada con holgura),
 * punta 118° libra la cara inferior (0.3⌀), cada barreno visitado UNA vez, ruta
 * vecino-más-cercano no cruza el centro de ida y vuelta, XY exactos, G-code sano.
 */
import { toGcode } from '../src/forja/cam/facing';
import { generateDrillingToolpath } from '../src/forja/cam/drill';
import type { DrillHole } from '../src/forja/cam/drill';

const D = 6.8, R = 50, Z1 = 42;
const holes: DrillHole[] = Array.from({ length: 8 }, (_, i) => ({
  x: +(R * Math.cos(i * Math.PI / 4)).toFixed(4), y: +(R * Math.sin(i * Math.PI / 4)).toFixed(4),
  zTop: Z1, zBottom: 0, through: true,
}));
const rpm = Math.round(100000 / (Math.PI * D));
const tool = { diameter: D, rpm, feed: Math.round(rpm * 0.15), plunge: Math.round(rpm * 0.15) };
const p = { peckDepth: 3 * D, safeZ: 10, rPlane: 3, reentryGap: 0.5 };
const segs = generateDrillingToolpath(holes, tool, p);
const g = toGcode(segs, tool, 'TALADRADO 8x D6.8');

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};

const zEnd = 0 - 0.3 * D, zR = Z1 + p.rPlane;

// 1) Cada barreno alcanza el fondo (punta libra la cara inferior) UNA sola vez
const finals = segs.filter(s => s.kind === 'plunge' && Math.abs(s.to[2] - zEnd) < 1e-9);
check('8 barrenos al fondo (punta −0.3⌀)', finals.length === 8, `${finals.length} llegadas a z=${zEnd.toFixed(2)}`);
const visited = new Set(finals.map(s => `${s.to[0].toFixed(3)},${s.to[1].toFixed(3)}`));
check('cada barreno UNA vez', visited.size === 8);
check('XY exactos de los 8', holes.every(h => visited.has(`${h.x.toFixed(3)},${h.y.toFixed(3)}`)));

// 2) Pecks: q=20.4 → profundidad total 45+3.04... pecks por barreno = ceil((zR−zEnd)/q ajustado)
const plungesPerHole = segs.filter(s => s.kind === 'plunge').length / 8;
check('picadas por barreno ≥ 3 (barreno profundo 6.6×⌀)', plungesPerHole >= 3, `${plungesPerHole} plunges/barreno`);

// 3) Retracción TOTAL a plano R entre picadas (G83) + re-entrada con holgura
let g83ok = true;
for (let i = 0; i < segs.length - 2; i++) {
  const a = segs[i], b = segs[i + 1], c = segs[i + 2];
  if (a.kind === 'plunge' && a.to[2] > zEnd + 1e-9) { // picada intermedia
    if (!(b.kind === 'rapid' && Math.abs(b.to[2] - zR) < 1e-9)) { g83ok = false; break; }
    if (!(c.kind === 'rapid' && Math.abs(c.to[2] - (a.to[2] + p.reentryGap)) < 1e-9)) { g83ok = false; break; }
  }
}
check('ciclo G83 (retracción total + re-entrada +0.5)', g83ok);

// 4) Nunca cortar en XY: todo movimiento con ΔXY es rapid a zSafe
const zSafe = Z1 + p.safeZ;
const xyMoves = segs.filter(s => Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]) > 1e-9);
check('traslados XY solo en rápido a zSafe', xyMoves.every(s => s.kind === 'rapid' && Math.abs(s.from[2] - zSafe) < 1e-9 && Math.abs(s.to[2] - zSafe) < 1e-9));

// 5) Ruta vecino-más-cercano: longitud de traslado ≤ ir en orden de índice (peor caso)
const travel = xyMoves.reduce((acc, s) => acc + Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]), 0);
const ringStep = 2 * R * Math.sin(Math.PI / 8); // lado del octágono
check('ruta corta (perímetro del octágono)', Math.abs(travel - 7 * ringStep) < 1, `traslado=${travel.toFixed(1)} vs 7·lado=${(7 * ringStep).toFixed(1)}`);

// 6) G-code sano
const lines = g.trim().split('\n');
check(`G-code: M3 S${rpm}`, lines[4] === `M3 S${rpm}`);
check('G-code: cierre M5/M30', lines[lines.length - 2] === 'M5' && lines[lines.length - 1] === 'M30');
check(`G-code: feed de picada F${tool.plunge}`, g.includes(`F${tool.plunge}`));

console.log(`\nsegs=${segs.length}  líneas gcode=${lines.length}  S${rpm} f0.15mm/rev q${(3 * D).toFixed(1)}`);
console.log('\n--- primeras 14 líneas ---\n' + lines.slice(0, 14).join('\n'));

if (fails) { console.error(`\n${fails} CHECKS FALLARON`); process.exit(1); }
console.log('\nDRILL_CHECK_OK');
