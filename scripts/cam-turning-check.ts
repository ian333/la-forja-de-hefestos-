/**
 * Verificación del motor de TORNEADO (libro Cimo caps 2/4/5) — node puro:
 *   cd /home/ian/Orkesta/la-forja && npx tsx scripts/cam-turning-check.ts
 * Caso libro: barra ⌀45, careado CoroPlus cap 4 (2×ap1.02 f0.491 vc356 + acabado
 * ap0.96 f0.265 vc415), flecha escalonada ⌀42→pendiente→⌀30, ranura circlip,
 * tronzado. Invariantes: cero gouge del desbaste, acabado SIGUE el perfil,
 * X en DIÁMETRO, G96/G50/G95, careado cruza el centro.
 */
import {
  profileR, turnFacing, turnProfileRough, turnProfileFinish, turnGroove, turnPartOff, toLatheGcode,
} from '../src/forja/cam/turning';
import type { TurnPt, TurnStock, TurnTool } from '../src/forja/cam/turning';

const stock: TurnStock = { radius: 22.5, zFront: 0, zBack: 80 };
const tool: TurnTool = { noseR: 0.8, feedRough: 0.491, feedFinish: 0.265, vcRough: 356, vcFinish: 415, maxRpm: 4000 };
// perfil de la flecha (z crece hacia el chuck; el ⌀ CHICO va al FRENTE — así se
// tornea de verdad: lo hondo se alcanza desde la punta libre): ⌀30 → pendiente → ⌀42
const profile: TurnPt[] = [
  { z: 0, r: 15 }, { z: 35, r: 15 }, { z: 40, r: 21 }, { z: 70, r: 21 }, { z: 80, r: 22.5 },
];

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};

// ── CAREADO (cap 4) ──
const face = turnFacing(stock, tool, { roughPasses: 2, roughAp: 1.02, finishAp: 0.96, clear: 2 });
const faceCuts = face.filter(m => m.kind === 'cut');
check('careado: 2 desbastes + 1 acabado', faceCuts.length === 3);
check('careado: cara final a z=-3.0', Math.abs(faceCuts[2].to[1] - (-3.0)) < 1e-9, `z=${faceCuts[2].to[1]}`);
check('careado: cruza el centro (−noseR)', faceCuts.every(m => m.to[0] <= -tool.noseR + 1e-9));
check('careado: feeds del libro (0.491/0.265)', faceCuts[0].feed === 0.491 && faceCuts[2].feed === 0.265);

// ── DESBASTE DE PERFIL (cap 5) ──
const rough = turnProfileRough(profile, stock, tool, { ap: 2, stockToLeave: 0.5, clear: 2, zStart: 0, zEnd: 72 });
const rCuts = rough.filter(m => m.kind === 'cut');
check('desbaste: hay pasadas', rCuts.length >= 3, `${rCuts.length} pasadas`);
// cero gouge: a lo largo de cada pasada longitudinal, x ≥ perfil(z)+stock−ε
let gouge = 0;
for (const m of rCuts) {
  for (let t = 0; t <= 1; t += 0.05) {
    const z = m.from[1] + t * (m.to[1] - m.from[1]);
    if (m.to[0] < profileR(profile, z) + 0.5 - 1e-6) { gouge++; break; }
  }
}
check('desbaste: CERO gouge (respeta perfil + stock 0.5)', gouge === 0, gouge ? `${gouge} pasadas gougean` : '');
const lastPass = rCuts[rCuts.length - 1];
check('desbaste: llega al piso (r15+0.5)', Math.abs(lastPass.to[0] - 15.5) < 2 + 1e-9, `x_final=${lastPass.to[0]}`);

// ── ACABADO ──
const fin = turnProfileFinish(profile, stock, tool, { clear: 2, zStart: 0, zEnd: 72 });
const fCuts = fin.filter(m => m.kind === 'cut');
const follows = fCuts.every(m => Math.abs(m.to[0] - profileR(profile, m.to[1])) < 1e-6 || m.to[1] < 0);
check('acabado: SIGUE el perfil exacto', follows, `${fCuts.length} tramos`);
check('acabado: feed fino 0.265', fCuts.every(m => m.feed === 0.265));

// ── RANURA circlip ──
const gr = turnGroove({ z0: 20, z1: 24, rOuter: 21, rInner: 19 }, tool, { insertW: 2, clear: 2 });
const gCuts = gr.filter(m => m.kind === 'cut');
check('ranura: 2 penetraciones (4mm / inserto 2)', gCuts.length === 2);
check('ranura: fondo exacto r19', gCuts.every(m => Math.abs(m.to[0] - 19) < 1e-9));

// ── TRONZADO ──
const po = turnPartOff(stock, tool, { z: 72, clear: 2 });
check('tronzado: cruza el centro', po.some(m => m.kind === 'cut' && m.to[0] <= -tool.noseR + 1e-9));

// ── G-CODE ──
const g = toLatheGcode([...face, ...rough, ...fin], tool, 'FLECHA', tool.vcRough);
const lines = g.trim().split('\n');
check('G-code: G96 CSS + G50 tope + G95 mm/rev', g.includes('G96 S356 M3') && g.includes('G50 S4000') && g.includes('G95'));
check('G-code: G18 plano de torno', g.includes('G18'));
check('G-code: X en DIÁMETRO (acabado ⌀30)', g.includes('X30 '));
check('G-code: cierre G97/M5/M30', lines[lines.length - 3] === 'G97 (cancela CSS)' && lines[lines.length - 1] === 'M30');

console.log(`\ncareado=${face.length} desbaste=${rough.length} acabado=${fin.length} movs`);
console.log('--- primeras líneas ---\n' + lines.slice(0, 10).join('\n'));
if (fails) { console.error(`\n${fails} CHECKS FALLARON`); process.exit(1); }
console.log('\nTURNING_CHECK_OK');
