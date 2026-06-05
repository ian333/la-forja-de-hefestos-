/* Verifica el simulador de ensamble/choques. node --import tsx scripts/ensamble-test.ts */
import { meshClearanceDecentered, worstMeshOverDirections, runoutOneBearing, runoutTwoBearings, runoutCone, assemblyCheck } from '../src/forja/mech/ensamble';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 0.05) => Math.abs(a - b) < t;
const ck = (n: string, ok: boolean, x = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${n} ${x}`); } };
const GB = { lobes: 10, R: 27, Rr: 2, E: 1, gap: 0.8, discs: 3 };

// Sin decentrado: la malla libra (el gap con SF que ya pusimos).
ck('centrado (δ=0): malla POSITIVA (libra)', worstMeshOverDirections(GB, 0).worst > 0 && !worstMeshOverDirections(GB, 0).collides);
// Decentrado grande → CHOCA (negativo).
ck('decentrado 1.5mm → malla negativa (CHOCA)', worstMeshOverDirections(GB, 1.5).collides);
ck('más decentrado = peor malla', worstMeshOverDirections(GB, 1.5).worst < worstMeshOverDirections(GB, 0.5).worst);

// Runout: 1 apoyo amplifica; 2 apoyos/cono no.
ck('1 apoyo (c=0.4, h=30, ℓ=8) → runout ≈ 3.4mm', near(runoutOneBearing(0.4, 30, 8), 3.4, 0.05), `${runoutOneBearing(0.4, 30, 8)}`);
ck('2 apoyos → runout = c (no amplifica)', runoutTwoBearings(0.4) === 0.4);
ck('cono → runout ~0 (solo película µm)', runoutCone() < 0.02);
ck('1 apoyo >> 2 apoyos >> cono', runoutOneBearing(0.4, 30, 8) > runoutTwoBearings(0.4) && runoutTwoBearings(0.4) > runoutCone());

// El chequeo de ensamble: 1 apoyo CHOCA, cono LIBRA.
const a = assemblyCheck({ ...GB, shaftClearance: 0.4, topDiscHeight: 30, baseBearingLen: 8 });
ck('ensamble: 1 apoyo CHOCA (runout 3.4 → malla negativa)', a.mesh.oneBearing.collides, JSON.stringify(a.mesh.oneBearing));
ck('ensamble: cono LIBRA (runout ~0 → malla positiva)', !a.mesh.cone.collides);
ck('ensamble: el cono ARREGLA el choque del 1 apoyo', a.mesh.oneBearing.collides && !a.mesh.cone.collides);

console.log(`\nENSAMBLE_TEST pass=${pass} fail=${fail}`);
console.log('chequeo de ensamble:', JSON.stringify(a, null, 1));
process.exit(fail === 0 ? 0 : 1);
