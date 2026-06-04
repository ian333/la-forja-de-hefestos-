/* Test del módulo DFM (dfm.ts). node --import tsx scripts/dfm-test.ts */
import { clearance, holeCompensation, compensateHole, classifyOverhangs, printabilityReport, teardrop, PRINT_PROFILES, type PrintProfile } from '../src/forja/mech/dfm';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 1e-6) => Math.abs(a - b) < t;
const ck = (name: string, ok: boolean, extra = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${name} ${extra}`); } };

const pla: PrintProfile = PRINT_PROFILES.media;                       // PLA 0.4/0.2 bed 256
const petg: PrintProfile = { ...pla, material: 'PETG' };

// HOLGURA print-in-place
ck('holgura PLA = 0.30', near(clearance(pla), 0.30), `${clearance(pla)}`);
ck('holgura PETG = 0.42', near(clearance(petg), 0.42), `${clearance(petg)}`);
// COMPENSACIÓN de barreno
ck('compensación = 0.16', near(holeCompensation(pla), 0.16), `${holeCompensation(pla)}`);
ck('barreno ⌀10 → 10.16', near(compensateHole(10, pla), 10.16));

// caja 40×20×12 corner en origen (Z arriba)
const V = [[0, 0, 0], [40, 0, 0], [40, 20, 0], [0, 20, 0], [0, 0, 12], [40, 0, 12], [40, 20, 12], [0, 20, 12]];
const tri = (a: number, b: number, c: number) => [a, b, c];
const boxIdx = [
  ...tri(0, 2, 1), ...tri(0, 3, 2),   // z=0 (abajo, normal −Z)
  ...tri(4, 5, 6), ...tri(4, 6, 7),   // z=12 (arriba, normal +Z)
  ...tri(0, 1, 5), ...tri(0, 5, 4),   // y=0
  ...tri(3, 2, 6), ...tri(3, 6, 7),   // y=20
  ...tri(0, 3, 7), ...tri(0, 7, 4),   // x=0
  ...tri(1, 2, 6), ...tri(1, 6, 5),   // x=40
];
const boxPos: number[] = []; for (const v of V) boxPos.push(v[0], v[1], v[2]);
const box = { positions: boxPos, indices: boxIdx };

// la caja NO necesita soporte (paredes verticales, techo arriba, piso en el plato)
const rep = printabilityReport(box, pla);
ck('caja: 0 soporte', rep.triSupport === 0, JSON.stringify({ ok: rep.triOK, warn: rep.triWarn, sup: rep.triSupport }));
ck('caja: cabe en 256', rep.fits === true);
ck('caja: bbox 40×20×12', rep.bbox.w === 40 && rep.bbox.d === 20 && rep.bbox.h === 12);
ck('caja: overhang 0%', rep.overhangPct === 0);
ck('caja: holgura+comp en reporte', rep.clearance === 0.30 && rep.holeComp === 0.16);

// caja de 300mm NO cabe
const big = { positions: boxPos.map((x) => x * 8), indices: boxIdx };   // 320×160×96
ck('caja grande (320) no cabe', printabilityReport(big, pla).fits === false);

// PLACA elevada mirando ABAJO (a z=20, sobre una base en z=0) → SOPORTE
const plate = {
  positions: [0, 0, 0,  /*base, fija minZ=0*/  0, 0, 20, 0, 10, 20, 10, 0, 20],
  indices: [1, 2, 3],   // triángulo con normal −Z (mira abajo), elevado
};
const pc = classifyOverhangs(plate, pla);
ck('placa elevada abajo → SUPPORT (2)', pc.cls[0] === 2, `cls=${pc.cls[0]}`);

// triángulo a ~53° de voladizo (nz=−0.8) → WARN
const warnMesh = {
  positions: [0, 0, 0,  /*base minZ=0*/  0, 0, 20, 0, 10, 20, 8, 0, 14],
  indices: [1, 2, 3],
};
ck('voladizo 53° → WARN (1)', classifyOverhangs(warnMesh, pla).cls[0] === 1, `cls=${classifyOverhangs(warnMesh, pla).cls[0]}`);

// teardrop: pico arriba a r·√2
const td = teardrop(0, 0, 5, 32);
const top = td[td.length - 1];
ck('teardrop pico en r·√2', near(top.y, 5 * Math.SQRT2, 1e-9) && near(top.x, 0));
ck('teardrop cerrado (>segments)', td.length > 32);

console.log(`DFM_TEST pass=${pass} fail=${fail}`);
console.log('reporte caja:', JSON.stringify(rep));
process.exit(fail === 0 ? 0 : 1);
