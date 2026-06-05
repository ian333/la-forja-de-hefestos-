/* Verifica la transmisión 3D (axial/radial/torque) + el escalado a masa.
   node --import tsx scripts/trompo-test.ts */
import {
  decompose, torque_Nm, torqueRetention, netAxial, symmetricBarrel, contactAreaGain,
  scaleForMass, paramsAtScale, printabilityAtScale, minPrintable, PRINT_FIXED,
} from '../src/forja/mech/trompo';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 1e-3) => Math.abs(a - b) < t;
const ck = (n: string, ok: boolean, x = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${n} ${x}`); } };

// (1) DIENTE PLANO (ψ=0): NO hay fuerza axial. Torque = tangencial×R.
const flat = decompose(100, 20, 0);
ck('plano ψ=0 → axial = 0', flat.axial === 0);
ck('plano: tangencial = F·cos α', near(flat.tangential, 100 * Math.cos(20 * Math.PI / 180)));
ck('torque = tangencial × R', near(torque_Nm(flat.tangential, 40), flat.tangential * 40 / 1000));

// (2) DIENTE CURVO (ψ=15°): aparece AXIAL = F·sin ψ; el torque casi no cambia (cos ψ).
const curved = decompose(100, 20, 15);
ck('curvo ψ=15 → axial = F·sin ψ ≈ 25.9 N', near(curved.axial, 100 * Math.sin(15 * Math.PI / 180), 1e-2));
ck('curvo: el torque sólo baja por cos ψ (≈0.966)', near(torqueRetention(15), 0.9659, 1e-3));
ck('retención de torque a 15° > 96% (no se complica)', torqueRetention(15) > 0.96);

// (3) La CLAVE: barril SIMÉTRICO → axial NETO = 0 (se cancela). Cono simple → no.
const barrel = netAxial(symmetricBarrel(100, 15, 4));
ck('barril simétrico (+ψ,−ψ) → axial neto = 0 (CANCELA)', barrel.balanced && near(barrel.net_N, 0, 1e-4), JSON.stringify(barrel));
ck('barril: SÍ hay carga axial local (no es cero el abs)', barrel.total_abs_N > 0);
const cone = netAxial([{ Fn: 100, tiltDeg: 15 }, { Fn: 100, tiltDeg: 15 }, { Fn: 100, tiltDeg: 15 }]);
ck('cono simple (todos +ψ) → axial neto ≠ 0 (hay que reaccionarlo)', !cone.balanced && cone.net_N > 0);

// (4) Curvar reparte ÁREA (1/cos ψ): más área → menos presión.
ck('área 3D crece con ψ (1/cos ψ)', contactAreaGain(15) > 1 && contactAreaGain(25) > contactAreaGain(15));

// (5) ESCALADO a 100 g: la macro escala ∝ R³; las holguras de impresión NO escalan.
const base = { massG: 320.7, params: { R: 40, T: 6, E: 1.5, Rr: 3, shaftD: 16, shaftBore: 8, lobes: 10, discs: 5 } };
const s100 = scaleForMass(base, 100);
ck('escala para 100 g ≈ 0.684 (cbrt(100/320.7))', near(s100, Math.cbrt(100 / 320.7), 1e-3), `${s100.toFixed(4)}`);
const p100 = paramsAtScale(base.params, s100);
ck('a 100 g: R ≈ 27.3 mm, topología (lóbulos/discos) NO escala', near(p100.R, 40 * s100, 1e-2) && p100.lobes === 10 && p100.discs === 5);
const pr100 = printabilityAtScale(base.params, s100);
ck('100 g es IMPRIMIBLE (features ≥ 2·boquilla)', pr100.printable, JSON.stringify(pr100));
ck('las holguras de impresión NO escalan (gap sigue 0.6)', PRINT_FIXED.gap === 0.6);
ck('la masa estimada a esa escala ≈ 100 g (±20%)', Math.abs(pr100.massG - 100) < 25, `${pr100.massG}`);
const mp = minPrintable(base.params, base);
ck('hay un tamaño MÍNIMO imprimible (holguras fijas dominan)', mp.minScale > 0.2 && mp.minMassG > 0, JSON.stringify(mp));

console.log(`\nTROMPO_TEST pass=${pass} fail=${fail}`);
console.log('plano vs curvo (Fn=100, α=20):', JSON.stringify({ flat, curved }));
console.log('barril simétrico:', JSON.stringify(barrel), '| cono:', JSON.stringify(cone));
console.log('100 g →', JSON.stringify({ scale: s100, params: p100, print: pr100 }, null, 1));
console.log('mínimo imprimible:', JSON.stringify(mp));
process.exit(fail === 0 ? 0 : 1);
