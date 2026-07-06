/**
 * Verificación del motor BORE helicoidal (libro Cimo cap 10) — node puro:
 *   cd /home/ian/Orkesta/la-forja && npx tsx scripts/cam-bore-check.ts
 * Caso del libro: hueco ⌀32 (piloto M36×4) pasante 42mm, fresa ⌀16, hélice 2mm/rev.
 * Invariantes: radio de hélice EXACTO (R−r), Z monótono descendente con paso ≤ pitch/2
 * por semicírculo, vuelta completa FINAL a fondo plano, G2 con palabra Z (hélice),
 * cero gouge, cadena continua. + regresión: pocket con entrada helicoidal cubre igual.
 */
import { toGcode, arcSweep } from '../src/forja/cam/facing';
import { generateBoreToolpath } from '../src/forja/cam/bore';
import { generateCircularPocketToolpath } from '../src/forja/cam/pocket';

const hole = { cx: 0, cy: 0, radius: 16, zTop: 42, zBottom: 0 }; // ⌀32 pasante
const tool = { diameter: 16, rpm: 1989, feed: 1193, plunge: 400 };
const segs = generateBoreToolpath(hole, tool, { pitch: 2, safeZ: 10 });
const g = toGcode(segs, tool, 'BORE D32');

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};

const arcs = segs.filter(s => s.arc);
const rH = hole.radius - tool.diameter / 2; // 8

// 1) TODOS los arcos al radio de hélice exacto
check('radio de hélice = R − r = 8', arcs.every(s =>
  Math.abs(Math.hypot(s.from[0], s.from[1]) - rH) < 1e-9 && Math.abs(Math.hypot(s.to[0], s.to[1]) - rH) < 1e-9));

// 2) Z monótono no creciente en el corte, bajada ≤ pitch/2 por semicírculo
let mono = true, maxDrop = 0;
for (const s of arcs) {
  const dz = s.from[2] - s.to[2];
  if (dz < -1e-9) mono = false;
  maxDrop = Math.max(maxDrop, dz);
}
check('Z monótono descendente', mono);
check('bajada ≤ pitch/2 por semicírculo', maxDrop <= 1 + 1e-9, `máx ${maxDrop.toFixed(2)}`);

// 3) vueltas: 42/2 = 21 vueltas = 42 semicírculos + 2 del fondo plano
check('42 semicírculos de hélice + 2 de fondo', arcs.length === 44, `${arcs.length} arcos`);

// 4) vuelta COMPLETA final a z=0 (fondo plano)
const flat = arcs.filter(s => s.from[2] === 0 && s.to[2] === 0);
check('vuelta completa a fondo plano', flat.length === 2 && Math.abs(flat.reduce((a, s) => a + arcSweep(s), 0) - 2 * Math.PI) < 1e-6);

// 5) climb: todos CW
check('climb (G2)', arcs.every(s => s.arc!.cw));

// 6) cadena continua
let broken = 0;
for (let i = 1; i < segs.length; i++)
  if (Math.hypot(segs[i].from[0] - segs[i - 1].to[0], segs[i].from[1] - segs[i - 1].to[1], segs[i].from[2] - segs[i - 1].to[2]) > 1e-9) broken++;
check('cadena continua', broken === 0);

// 7) G-code: G2 con palabra Z (hélice real) y G2 sin Z en el fondo plano
const lines = g.trim().split('\n');
const g2z = lines.filter(l => l.startsWith('G2 ') && l.includes(' Z'));
const g2flat = lines.filter(l => l.startsWith('G2 ') && !l.includes(' Z')); // ojo: 'G21 (mm)' también empieza con G2
check('G2 helicoidales con Z', g2z.length === 42, `${g2z.length}`);
check('G2 planos del fondo sin Z', g2flat.length === 2, `${g2flat.length}`);

// 8) REGRESIÓN pocket con entrada helicoidal: cobertura intacta + hélice presente
const psegs = generateCircularPocketToolpath({ cx: 0, cy: 0, radius: 40, zTop: 42, zBottom: 32 },
  { diameter: 40, rpm: 7878, feed: 7090, plunge: 800 }, { optimalLoad: 13.33, safeZ: 10, helicalPitch: 2 });
const phelix = psegs.filter(s => s.arc && Math.abs(s.from[2] - s.to[2]) > 1e-9);
const prings = [...new Set(psegs.filter(s => s.arc && s.from[2] === s.to[2]).map(s => Math.hypot(s.from[0] - s.arc!.cx, s.from[1] - s.arc!.cy).toFixed(2)))];
check('pocket: hélice de entrada presente', phelix.length === 10, `${phelix.length} semicírculos (10mm/2·2)`);
check('pocket: anillos intactos (13.33 y 20)', prings.includes('13.33') && prings.includes('20.00'), prings.join(','));
let pbroken = 0;
for (let i = 1; i < psegs.length; i++)
  if (Math.hypot(psegs[i].from[0] - psegs[i - 1].to[0], psegs[i].from[1] - psegs[i - 1].to[1], psegs[i].from[2] - psegs[i - 1].to[2]) > 1e-9) pbroken++;
check('pocket: cadena continua con hélice', pbroken === 0);

console.log('\n--- primeras líneas del BORE ---\n' + lines.slice(0, 10).join('\n'));
if (fails) { console.error(`\n${fails} CHECKS FALLARON`); process.exit(1); }
console.log('\nBORE_CHECK_OK');
