/* Test del simulador de impresion K1 + despegue. node --import tsx scripts/printsim-test.ts */
import {
  K1, coolingTau, weldWindow, fusionGapMin, willFuse, detachForce, maxDetachArea,
  discFootprint, simulatePrint,
} from '../src/forja/mech/printsim';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 0.05) => Math.abs(a - b) < t;
const ck = (name: string, ok: boolean, extra = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${name} ${extra}`); } };

// K1 real
ck('K1 build 220x220x250', K1.build.x === 220 && K1.build.z === 250);
ck('K1 50N de extrusion', K1.extrusionForceN === 50);

// enfriamiento: ventilador acorta la ventana soldable
ck('ventana soldable con ventilador < sin ventilador', weldWindow(K1.fanOn_h) < weldWindow(K1.fanOff_h), `${weldWindow(K1.fanOn_h)} vs ${weldWindow(K1.fanOff_h)}`);
ck('tau enfriamiento ON < OFF', coolingTau(K1.fanOn_h) < coolingTau(K1.fanOff_h));

// hueco minimo: con ventilador ~0.3mm, sin ventilador mayor
ck('g_min con ventilador ≈ 0.30mm', near(fusionGapMin(K1.fanOn_h), 0.30, 0.01), `${fusionGapMin(K1.fanOn_h)}`);
ck('g_min sin ventilador > con ventilador', fusionGapMin(K1.fanOff_h) > fusionGapMin(K1.fanOn_h), `${fusionGapMin(K1.fanOff_h)}`);

// EL PUNTO: gap 0.6 con ventilador NO funde; sin ventilador SI funde
ck('gap 0.6 + ventilador ON → NO funde (despegable)', !willFuse(0.6, true));
ck('gap 0.6 + ventilador OFF → SE FUNDE (ladrillo)', willFuse(0.6, false));

// area de despegue
ck('despegar union: F = A·τ', near(detachForce(10, 8), 80) && near(detachForce(10, 28), 280));
ck('area maxima despegable con 526N (union fria 8MPa) ≈ 65.75mm²', near(maxDetachArea(526, 8), 65.75, 0.1));

// la cara del disco es ENORME → si funde es imposible despegar
const fp = discFootprint(40, 16, 1.5);
ck('cara del disco ~3500-4000mm²', fp > 3000 && fp < 4500, `${fp}`);
ck('si funde toda la cara: fuerza ≫ disponible (imposible)', detachForce(fp, 8) > 526 * 20, `${detachForce(fp, 8)}`);

// simulacion completa: caja 0.6mm, ventilador ON, primer giro 526N
const sim = simulatePrint({ gap: 0.6, R: 40, shaftD: 16, E: 1.5, lobes: 10, fanOn: true, detachForceN: 526 });
ck('K1 ventilador ON, gap 0.6 → SEPARADO y DESPEGABLE', sim.printsDetachable && !sim.fuses, sim.verdict);
const simOff = simulatePrint({ gap: 0.6, R: 40, shaftD: 16, E: 1.5, lobes: 10, fanOn: false, detachForceN: 526 });
ck('K1 ventilador OFF, gap 0.6 → SE FUNDE (ladrillo)', simOff.fuses && !simOff.printsDetachable, simOff.verdict);
ck('ventana de area de soporte existe (piso < techo)', sim.minSupportAreaMm2 < sim.maxSupportAreaMm2, `${sim.minSupportAreaMm2}..${sim.maxSupportAreaMm2}`);

console.log(`PRINTSIM_TEST pass=${pass} fail=${fail}`);
console.log('sim K1 caja 0.6mm ventilador ON:', JSON.stringify(sim, null, 2));
process.exit(fail === 0 ? 0 : 1);
