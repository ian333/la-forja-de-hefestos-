/* Test del generador de mecanismos (armgen.ts). node --import tsx scripts/armgen-test.ts */
import { grublerMobility, forwardKinematics, reach, workspace, grashof, generateArm, linkRecipe } from '../src/forja/mech/armgen';

let pass = 0, fail = 0;
const approx = (a: number, b: number, t = 1e-9) => Math.abs(a - b) < t;
const ck = (name: string, ok: boolean, extra = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${name} ${extra}`); } };

// MOVILIDAD (Grübler): brazo serial de N juntas → M = N
ck('mobilidad 3R = 3', grublerMobility(4, 3) === 3);
ck('mobilidad 6R = 6', grublerMobility(7, 6) === 6);
ck('cuatro-barras M=1', grublerMobility(4, 4) === 1);   // 3(3)-2(4)=1

// CINEMÁTICA DIRECTA exacta
const D90 = Math.PI / 2;
let fk = forwardKinematics([100, 100], [D90, 0]);
ck('FK [90,0] end=(0,200)', approx(fk.end.x, 0) && approx(fk.end.y, 200), JSON.stringify(fk.end));
fk = forwardKinematics([100, 100], [0, D90]);
ck('FK [0,90] end=(100,100)', approx(fk.end.x, 100) && approx(fk.end.y, 100), JSON.stringify(fk.end));
fk = forwardKinematics([120, 90, 60], [0, 0, 0]);
ck('FK extendido end=(270,0)', approx(fk.end.x, 270) && approx(fk.end.y, 0));
ck('FK juntas count', fk.joints.length === 4);

// ALCANCE + ESPACIO DE TRABAJO
ck('reach 240', reach([100, 80, 60]) === 240);
let ws = workspace([100, 80, 60]);
ck('workspace rMax=240 rMin=0', ws.rMax === 240 && ws.rMin === 0);
ws = workspace([200, 30, 30]);
ck('workspace dominante rMin=140', ws.rMax === 260 && ws.rMin === 140);

// GRASHOF
ck('Grashof manivela-balancín', grashof(2, 2, 2.5, 1).isGrashof === true);
ck('cambio de punto', grashof(1, 2, 3, 4).isGrashof === true && grashof(1, 2, 3, 4).type.includes('cambio'));
ck('no-Grashof triple balancín', grashof(1, 1, 1, 3).isGrashof === false);

// RECETA de eslabón imprimible
const lr = linkRecipe(0, 100, { segLengths: [100], width: 20, thickness: 6, boreD: 5 });
ck('receta bbox L+W', lr.sketch.width === 120 && lr.sketch.height === 20);
ck('receta 2 barrenos en ±L/2', lr.bores.length === 2 && lr.bores[0].x === -50 && lr.bores[1].x === 50);
ck('receta filletR=W/2', lr.filletR === 10);

// BRAZO completo
const arm = generateArm({ segLengths: [120, 90, 60], width: 24, thickness: 6, boreD: 5 }, [0, 0, 0]);
ck('arm 3 eslabones', arm.links.length === 3);
ck('arm mobilidad 3', arm.mobility === 3);
ck('arm reach 270', arm.reach === 270);

console.log(`ARMGEN_TEST pass=${pass} fail=${fail}`);
console.log('arm:', JSON.stringify({ mobility: arm.mobility, reach: arm.reach, ws: arm.workspace, end: arm.fk.end }));
process.exit(fail === 0 ? 0 : 1);
