/* Test del generador de impresión: unión (honesta) + toolpath. node --import tsx scripts/generador-test.ts */
import { unionAcrossGap, frangibleForce, areaForForce, discLayerToolpath } from '../src/forja/mech/generador-impresion';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 0.05) => Math.abs(a - b) < t;
const ck = (n: string, ok: boolean, x = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${n} ${x}`); } };

// UNIÓN: hueco vs g_min (la física de printsim)
ck('hueco 0.6 con ventilador → LIBRE (no funde, gira)', unionAcrossGap(0.6, true).type === 'libre');
ck('hueco 0.2 con ventilador → FUNDIDO (rígido)', unionAcrossGap(0.2, true).type === 'fundido');
ck('hueco 0.6 SIN ventilador → FUNDIDO (ladrillo)', unionAcrossGap(0.6, false).type === 'fundido', JSON.stringify(unionAcrossGap(0.6, false)));

// FRANGIBILIDAD por área (no por temperatura): F = τ·A
ck('cuello 0.35² = 0.12mm² rompe a ~3.4 N', near(frangibleForce(0.35 * 0.35), 3.43, 0.1), `${frangibleForce(0.1225)}`);
ck('área para 125 N (presupuesto motor) ≈ 4.46 mm²', near(areaForForce(125), 4.46, 0.05));

// RUTA: toolpath de una capa del disco
const tp = discLayerToolpath({ lobes: 10, R: 40, Rr: 3, E: 1.5, shaftD: 16, outPinD: 6, outPins: 6 });
const types = new Set(tp.segs.map((s) => s.type));
ck('toolpath tiene perímetro + barreno + relleno + viaje', types.has('perimetro') && types.has('barreno') && types.has('relleno') && types.has('viaje'));
ck('hay material extruido (perímetro lento, relleno rápido)', tp.extrudeLen > 200);
ck('perímetro a 200 mm/s, relleno a 350 mm/s (calidad vs throughput)',
  tp.segs.some((s) => s.type === 'perimetro' && s.speed === 200) && tp.segs.some((s) => s.type === 'relleno' && s.speed === 350));
ck('estima tiempo de capa > 0', tp.estSec > 0);

console.log(`GENERADOR_TEST pass=${pass} fail=${fail}`);
console.log('toolpath capa:', JSON.stringify({ segs: tp.segs.length, extrudeLen: tp.extrudeLen, travelLen: tp.travelLen, estSec: tp.estSec }));
console.log('unión 0.6 ON:', JSON.stringify(unionAcrossGap(0.6, true)), '| 0.6 OFF:', JSON.stringify(unionAcrossGap(0.6, false)));
process.exit(fail === 0 ? 0 : 1);
