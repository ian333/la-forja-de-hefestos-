// Prueba PURA del motor (sin UI): corre la ODE real y cuenta gotas desprendidas
// en resonancia vs fuera de tono. Verifica que el numero, no el dibujo, manda.
import { mdReset, mdStep } from '../src/lib/physics/metalDrop.ts';

function run(track: boolean, fdrive: number) {
  const p = { Rop: 0.15, I0: 55, Iac: 10, fdrive, track,
              vf: 2.5e-3, gamma: 1.5, mu: 6e-3, dWire: 0.8e-3, Lth: 1e-3 };
  let s = mdReset(p);
  const dt = 3e-5;
  let qmax = 0, Tmax = 0;
  for (let i = 0; i < 1_000_000; i++) { s = mdStep(s, p, dt).s; if (s.q > qmax) qmax = s.q; if (s.T > Tmax) Tmax = s.T; }
  return { drops: s.drops, qmax, Tmax: s.T, simSec: 1_000_000 * dt };
}

const r = run(true, 700);     // resonancia (auto-track)
const d = run(false, 1150);   // fuera de tono
console.log(`sim ${r.simSec.toFixed(2)} s c/u`);
console.log(`RESONANTE (track): gotas=${r.drops}  T=${r.Tmax.toFixed(0)}C  qmax=${r.qmax.toFixed(2)}`);
console.log(`DETUNE (1150 Hz) : gotas=${d.drops}  T=${d.Tmax.toFixed(0)}C  qmax=${d.qmax.toFixed(2)}`);
console.log(r.drops > 0 && r.drops > d.drops
  ? `VERIFY_OK: resonancia desprende (${r.drops}) >> detune (${d.drops})`
  : `VERIFY_FAIL`);
