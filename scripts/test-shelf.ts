import { optimizeTopology } from '../src/lib/physics/genDeposit.ts';
const NX = 40, NY = 20;
const t0 = Date.now();
const s = optimizeTopology(NX, NY, 0.40, 3, 1.6, 30, 'shelf');
console.log(`REPISA optimizada ${NX}x${NY} en ${Date.now() - t0} ms (pared izq + carga ↓ arriba):`);
let out = '';
for (let y = 0; y < s.ny; y++) { let r = ''; for (let x = 0; x < s.nx; x++) { const v = s.rho[y * s.nx + x]; r += v > 0.75 ? '#' : v > 0.5 ? '+' : v > 0.2 ? '.' : ' '; } out += r + '\n'; }
console.log(out);
console.log('PACKED:' + Array.from(s.rho).map(v => Math.round(Math.min(1, Math.max(0, v)) * 9)).join(''));
