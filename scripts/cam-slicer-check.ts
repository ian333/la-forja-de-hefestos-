/**
 * Verificación del SLICER FDM (libro Cimo caps 14-17) — node puro:
 *   cd /home/ian/Orkesta/la-forja && npx tsx scripts/cam-slicer-check.ts
 * Pieza sintética: caja 20×20×10 con TÚNEL cuadrado 8×8 pasante (huecos de verdad).
 * Invariantes: nº de capas = altura/0.2, cada capa 2 lazos CERRADOS (exterior+túnel),
 * el infill NUNCA invade el túnel (paridad even-odd), E>0 monotónico, 1ª capa lenta,
 * temperaturas PLA del libro, ventilador desde capa 2.
 */
import { slicePart } from '../src/forja/cam/slicer';
import type { PrintParams } from '../src/forja/cam/slicer';

// caja con túnel: 4 paredes laterales ext + 4 int + tapas arriba/abajo (anillo de 8 quads)
function boxWithTunnel(): { positions: number[]; indices: number[] } {
  const P: number[] = [], I: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    const base = P.length / 3;
    P.push(...a, ...b, ...c, ...d);
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const zs = [0, 10];
  // paredes exteriores (x0,y0)-(20,20)
  quad([0, 0, 0], [20, 0, 0], [20, 0, 10], [0, 0, 10]);
  quad([20, 0, 0], [20, 20, 0], [20, 20, 10], [20, 0, 10]);
  quad([20, 20, 0], [0, 20, 0], [0, 20, 10], [20, 20, 10]);
  quad([0, 20, 0], [0, 0, 0], [0, 0, 10], [0, 20, 10]);
  // túnel interior (6,6)-(14,14)
  quad([6, 6, 0], [14, 6, 0], [14, 6, 10], [6, 6, 10]);
  quad([14, 6, 0], [14, 14, 0], [14, 14, 10], [14, 6, 10]);
  quad([14, 14, 0], [6, 14, 0], [6, 14, 10], [14, 14, 10]);
  quad([6, 14, 0], [6, 6, 0], [6, 6, 10], [6, 14, 10]);
  // tapas (anillo): 4 trapezoides arriba y abajo
  for (const z of zs) {
    quad([0, 0, z], [20, 0, z], [14, 6, z], [6, 6, z]);
    quad([20, 0, z], [20, 20, z], [14, 14, z], [14, 6, z]);
    quad([20, 20, z], [0, 20, z], [6, 14, z], [14, 14, z]);
    quad([0, 20, z], [0, 0, z], [6, 6, z], [6, 14, z]);
  }
  return { positions: P, indices: I };
}

const params: PrintParams = {
  layerH: 0.2, lineW: 0.4, infillPct: 30, nozzleTemp: 210, bedTemp: 60,
  feedPrint: 3600, feedFirst: 1200, filamentD: 1.75,
};
const { gcode, layers } = slicePart(boxWithTunnel(), params);

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};

check('capas = 10mm / 0.2 = 50', layers.length === 50, `${layers.length}`);
check('cada capa: 2 lazos (exterior + túnel)', layers.every(l => l.loops.length === 2),
  `capa 0: ${layers[0].loops.length} lazos`);
// lazos cerrados y con área razonable (shoelace): ext ≈ 400, túnel ≈ 64
const area = (lp: { x: number; y: number }[]) => {
  let a2 = 0;
  for (let i = 0; i < lp.length; i++) { const p = lp[i], q = lp[(i + 1) % lp.length]; a2 += p.x * q.y - q.x * p.y; }
  return Math.abs(a2 / 2);
};
const a0 = layers[10].loops.map(area).sort((x, y) => y - x);
check('áreas de lazos ≈ 400 y 64', Math.abs(a0[0] - 400) < 2 && Math.abs(a0[1] - 64) < 2,
  a0.map(v => v.toFixed(1)).join(', '));
// el infill NUNCA invade el túnel: punto medio de cada línea fuera de (6..14)²
let invade = 0;
for (const ly of layers)
  for (const [s, e] of ly.infill) {
    const mx = (s.x + e.x) / 2, my = (s.y + e.y) / 2;
    if (mx > 6.2 && mx < 13.8 && my > 6.2 && my < 13.8) invade++;
  }
check('infill RESPETA el túnel (even-odd)', invade === 0, invade ? `${invade} líneas adentro` : '');
check('hay infill', layers.every(l => l.infill.length >= 2), `capa10: ${layers[10].infill.length} líneas`);
// G-code
const lines = gcode.trim().split('\n');
check('temps PLA 210/60 + espera', gcode.includes('M104 S210') && gcode.includes('M190 S60') && gcode.includes('M109 S210'));
check('1ª capa LENTA (F1200) y resto F3600', /capa 1 [\s\S]*?F1200/.test(gcode) && gcode.includes('F3600'));
check('ventilador desde capa 2', gcode.indexOf('M106 S255') > gcode.indexOf('(capa 2 ') && gcode.includes('M106 S255'));
const eVals = [...gcode.matchAll(/E([\d.]+)/g)].map(m => parseFloat(m[1]));
check('extrusión E siempre positiva (M83)', eVals.length > 100 && eVals.every(v => v > 0), `${eVals.length} extrusiones`);
check('cierre M104 S0 / M84', gcode.includes('M104 S0') && gcode.includes('M84'));
const eTotal = parseFloat((gcode.match(/E total ([\d.]+)/) ?? ['', '0'])[1]);
check('E total plausible (>100mm filamento)', eTotal > 100, `${eTotal}mm`);

console.log(`\ncapas=${layers.length} · líneas gcode=${lines.length} · filamento=${eTotal}mm`);
if (fails) { console.error(`\n${fails} CHECKS FALLARON`); process.exit(1); }
console.log('\nSLICER_CHECK_OK');
