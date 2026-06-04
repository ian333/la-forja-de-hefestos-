/* Test de la caja cicloidal multi-disco (gearbox.ts). node --import tsx scripts/gearbox-test.ts */
import { discPhases, eccentricBalance, shaftTorsionStress, analyzeGearbox, type GearboxDesign } from '../src/forja/mech/gearbox';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 0.05) => Math.abs(a - b) < t;
const ck = (name: string, ok: boolean, extra = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${name} ${extra}`); } };

// FASES y BALANCE — el corazón de "el eje no se rompe"
ck('5 discos fasados a 72°', JSON.stringify(discPhases(5)) === JSON.stringify([0, 72, 144, 216, 288]));
ck('1 disco = DESBALANCEADO (residual 1)', near(eccentricBalance(1).residualFraction, 1) && eccentricBalance(1).balanced === false);
ck('2 discos (180°) = balanceado', eccentricBalance(2).balanced === true);
ck('3 discos balanceado', eccentricBalance(3).balanced === true);
ck('5 discos balanceado → eje en torsión pura', eccentricBalance(5).balanced === true, `res=${eccentricBalance(5).residualFraction}`);
ck('10 discos balanceado', eccentricBalance(10).balanced === true);

// TORSIÓN del eje (módulo polar)
ck('τ eje hueco 16/8 @ 2000 N·mm ≈ 2.65 MPa', near(shaftTorsionStress(2000, 16, 8), 2.65, 0.05), `${shaftTorsionStress(2000, 16, 8).toFixed(2)}`);

// caja base: 10 lóbulos, eje 16/8, anillo R40, 6 pernos de salida ⌀8
const gb: GearboxDesign = { lobes: 10, discs: 5, shaftD: 16, shaftBore: 8, pinCircleR: 40, outPinR: 4, outPinCount: 6 };

// 1 disco, par alto, PLA delgado → SE ROMPE (desbalanceado + pernos sobre-esforzados)
const bad = analyzeGearbox({ ...gb, discs: 1, outPinR: 2 }, { outputTorqueNm: 100, material: 'PLA' });
ck('1 disco PLA carga alta → NO sobrevive', bad.survives === false, JSON.stringify({ bal: bad.balanced, pin: bad.pinOk }));
ck('1 disco → desbalanceado', bad.balanced === false);

// 5 discos Nylon, misma carga alta → SOBREVIVE (balance + reparto + material)
const good = analyzeGearbox(gb, { outputTorqueNm: 100, material: 'Nylon' });
ck('5 discos Nylon carga alta → SOBREVIVE', good.survives === true, JSON.stringify({ shaft: good.shaftStressMPa, pin: good.pinStressMPa, allow: good.allowableShearMPa }));
ck('reparto de carga = nº discos (5×)', good.torqueShareFactor === 5);
ck('ratio = lóbulos (10:1)', good.ratio === 10);
ck('eje en bajo esfuerzo (es la entrada)', good.shaftOk === true && good.shaftStressMPa < good.allowableShearMPa);

// el reparto BAJA el esfuerzo del perno: 5 discos vs 1 disco
const oneDisc = analyzeGearbox({ ...gb, discs: 1 }, { outputTorqueNm: 100, material: 'Nylon' });
ck('5 discos → perno a ~1/5 del esfuerzo de 1 disco', near(good.pinStressMPa * 5, oneDisc.pinStressMPa, 0.5), `${good.pinStressMPa} vs ${oneDisc.pinStressMPa}`);

console.log(`GEARBOX_TEST pass=${pass} fail=${fail}`);
console.log('caja 5-disco Nylon:', JSON.stringify(good));
process.exit(fail === 0 ? 0 : 1);
