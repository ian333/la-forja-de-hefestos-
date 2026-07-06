/**
 * Verificación del post de ROSCADO G84 (libro Cimo cap 9) — node puro:
 *   cd /home/ian/Orkesta/la-forja && npx tsx scripts/cam-tap-check.ts
 * Invariantes: F = paso × S (sincronía rígida), Z = tope − 20 (Bottom Height del
 * libro), G84 modal (1 con words + 7 solo XY), G98 antes / G80 después, M8 derivado.
 */
import { generateTappingGcode, threadName } from '../src/forja/cam/tap';
import type { DrillHole } from '../src/forja/cam/drill';

const R = 50, ZT = 42;
const holes: DrillHole[] = Array.from({ length: 8 }, (_, i) => ({
  x: +(R * Math.cos(i * Math.PI / 4)).toFixed(4), y: +(R * Math.sin(i * Math.PI / 4)).toFixed(4),
  zTop: ZT, zBottom: 0, through: true,
}));
const tap = { pilotD: 6.8, pitch: 1.25, rpm: 500 };
const g = generateTappingGcode(holes, tap, { threadLen: 20, rPlane: 3, safeZ: 10 });
const lines = g.trim().split('\n');

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};

check('designación M8x1.25 derivada del piloto', threadName(tap) === 'M8x1.25', threadName(tap));
const g84 = lines.filter(l => l.startsWith('G84'));
const modal = lines.filter(l => /^X-?[\d.]+ Y-?[\d.]+$/.test(l));
check('UN G84 con words completos', g84.length === 1, g84[0]);
check('7 repeticiones modales (solo XY)', modal.length === 7);
check('F = paso × S = 625', g84[0]?.includes('F625'));
check('Z de rosca = tope − 20 = 22', g84[0]?.includes('Z22'));
check('plano R = tope + 3 = 45', g84[0]?.includes('R45'));
check('G98 antes del ciclo', lines.some((l, i) => l.startsWith('G98') && lines[i + 1]?.startsWith('G84')));
check('G80 cancela el ciclo', lines.some(l => l.startsWith('G80')));
check('husillo M3 S500', lines.includes('M3 S500'));
check('cierre M5/M30', lines[lines.length - 2] === 'M5' && lines[lines.length - 1] === 'M30');

console.log('\n--- G-code completo ---\n' + g);
if (fails) { console.error(`${fails} CHECKS FALLARON`); process.exit(1); }
console.log('TAP_CHECK_OK');
