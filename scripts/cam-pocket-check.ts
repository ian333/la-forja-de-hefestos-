/**
 * Verificación del motor CAM de ranura circular (libro Cimo cap 9) — node puro:
 *   cd /home/ian/Orkesta/la-forja && npx tsx scripts/cam-pocket-check.ts
 * Caso del libro: ranura ⌀80×10mm, fresa ⌀40, a_e=13.33 (⌀/3), S7878, F7090, climb.
 * Invariantes: cobertura total del disco, pared EXACTA, cero gouge, arcos CW (G2),
 * engrane radial ≤ a_e, Z de corte constante, cadena continua, G-code bien formado.
 */
import { toGcode, toolpathStats, arcSweep } from '../src/forja/cam/facing';
import { generateCircularPocketToolpath } from '../src/forja/cam/pocket';

const pocket = { cx: 0, cy: 0, radius: 40, zTop: 42, zBottom: 32 }; // ⌀80×10 (libro)
const tool = { diameter: 40, rpm: 7878, feed: 7090, plunge: 800 };
const p = { optimalLoad: 13.33, safeZ: 10 };

const segs = generateCircularPocketToolpath(pocket, tool, p);
const g = toGcode(segs, tool, 'RANURA CIRCULAR');
const st = toolpathStats(segs, tool);
const r = tool.diameter / 2;

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};

const arcs = segs.filter(s => s.arc);
const rings = [...new Set(arcs.map(s => Math.hypot(s.from[0] - s.arc!.cx, s.from[1] - s.arc!.cy).toFixed(3)))].map(Number).sort((a, b) => a - b);
console.log(`anillos r: ${rings.join(', ')}  (rMax teórico = ${pocket.radius - r})`);

// 1) Pared EXACTA: el anillo mayor cae en R − r_fresa
check('pared exacta', Math.abs(rings[rings.length - 1] - (pocket.radius - r)) < 1e-9, `r_final=${rings[rings.length - 1]}`);

// 2) Cero gouge: ningún punto de corte más allá de R − r
const maxReach = Math.max(...segs.filter(s => s.kind === 'cut').flatMap(s => [
  Math.hypot(s.from[0] - pocket.cx, s.from[1] - pocket.cy),
  Math.hypot(s.to[0] - pocket.cx, s.to[1] - pocket.cy)]),
  ...rings);
check('cero gouge', maxReach <= pocket.radius - r + 1e-9, `alcance máx=${maxReach.toFixed(3)}`);

// 3) Cobertura: todo punto del disco (muestreo radial) a ≤ r de algún anillo o del centro (plunge)
let uncovered = 0;
for (let rho = 0; rho <= pocket.radius - 0.05; rho += 0.25) {
  const near = rho <= r || rings.some(rk => Math.abs(rk - rho) <= r + 1e-9);
  if (!near) uncovered++;
}
check('cobertura total del disco', uncovered === 0, uncovered ? `${uncovered} radios sin cubrir` : 'plunge ⌀fresa + anillos cubren todo');

// 4) Engrane radial ≤ a_e entre anillos consecutivos (y del disco del plunge al 1er anillo)
let stepOk = rings[0] <= p.optimalLoad + 1e-9;
for (let i = 1; i < rings.length; i++) if (rings[i] - rings[i - 1] > p.optimalLoad + 1e-9) stepOk = false;
check('engrane radial ≤ a_e', stepOk, `pasos: ${rings.map((rk, i) => (i ? rk - rings[i - 1] : rk).toFixed(2)).join(', ')}`);

// 5) CLIMB: TODOS los arcos CW (pared interna, M3 → material a la izquierda del avance)
check('climb (arcos CW)', arcs.every(s => s.arc!.cw), `${arcs.length} arcos`);

// 6) Anillos completos: los arcos de cada radio suman 2π
const byRing = new Map<string, number>();
for (const s of arcs) {
  const k = Math.hypot(s.from[0] - s.arc!.cx, s.from[1] - s.arc!.cy).toFixed(3);
  byRing.set(k, (byRing.get(k) ?? 0) + arcSweep(s));
}
check('anillos completos (2π)', [...byRing.values()].every(a => Math.abs(a - 2 * Math.PI) < 1e-6));

// 7) Z constante en corte + pasada axial única a zBottom (decisión del libro)
check('Z de corte = fondo', segs.filter(s => s.kind === 'cut').every(s => s.from[2] === pocket.zBottom && s.to[2] === pocket.zBottom));

// 8) Cadena continua
let broken = 0;
for (let i = 1; i < segs.length; i++)
  if (Math.hypot(segs[i].from[0] - segs[i - 1].to[0], segs[i].from[1] - segs[i - 1].to[1], segs[i].from[2] - segs[i - 1].to[2]) > 1e-9) broken++;
check('cadena continua', broken === 0);

// 9) G-code: G2 presentes, CERO G3, feeds y RPM del libro
const lines = g.trim().split('\n');
check('G-code: arcos G2 y cero G3', g.includes('G2 ') && !g.includes('G3 '));
check('G-code: M3 S7878', lines[4] === 'M3 S7878');
check('G-code: F7090 y F800', g.includes('F7090') && g.includes('F800'));
check('G-code: cierre M5/M30', lines[lines.length - 2] === 'M5' && lines[lines.length - 1] === 'M30');

console.log(`\ncutLen=${st.cutLen.toFixed(0)}mm  tiempo=${st.timeMin.toFixed(2)}min  segs=${segs.length}`);
console.log('\n--- G-code ---\n' + lines.join('\n'));

if (fails) { console.error(`\n${fails} CHECKS FALLARON`); process.exit(1); }
console.log('\nPOCKET_CHECK_OK');
