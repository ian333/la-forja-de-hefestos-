// Verifica el motor generativo: la optimización topológica produce un voladizo
// con forma orgánica (truss), y la voxelización da vóxeles variables.
import { optimizeTopology, planDeposition } from '../src/lib/physics/genDeposit.ts';

const t0 = Date.now();
const s = optimizeTopology(40, 20, 0.42, 3, 1.6, 30);
const dt = Date.now() - t0;
console.log('PACKED:' + Array.from(s.rho).map(v => Math.round(Math.min(1, Math.max(0, v)) * 9)).join(''));

let out = '';
for (let y = 0; y < s.ny; y++) {
  let row = '';
  for (let x = 0; x < s.nx; x++) {
    const v = s.rho[y * s.nx + x];
    row += v > 0.75 ? '#' : v > 0.5 ? '+' : v > 0.2 ? '.' : ' ';
  }
  out += row + '\n';
}
console.log(`SIMP ${s.nx}x${s.ny} en ${dt} ms (voladizo: izq empotrado, carga der-medio):`);
console.log(out);

let vol = 0; for (let i = 0; i < s.rho.length; i++) vol += s.rho[i] >= 0.5 ? 1 : 0;
const vA = planDeposition(s, true), vF = planDeposition(s, false);
const big = vA.filter(v => !v.edge).length, edge = vA.filter(v => v.edge).length;
console.log(`celdas sólidas=${vol} · vóxeles ADAPTATIVO=${vA.length} (bulto ${big} + borde ${edge}) · FIJO-FINO=${vF.length}`);
console.log(vA.length < vF.length ? 'OK — adaptativo usa menos vóxeles (bulto grueso)' : 'REVISAR');
