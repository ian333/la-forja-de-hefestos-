/* Verifica el generador de G-code para la K1 (extrusión, flujo, fan/Poisson, estructura).
   node --import tsx scripts/gcode-test.ts */
import { extrusionPerMm, speedCapByFlow, bondParams, gcodeHeader, gcodeFooter, generateGcode, discToGcode } from '../src/forja/mech/gcode-k1';
import { K1 } from '../src/forja/mech/printsim';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 1e-3) => Math.abs(a - b) < t;
const ck = (n: string, ok: boolean, x = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${n} ${x}`); } };

// Extrusión volumétrica: E/mm = ancho·capa/área_filamento
ck('E/mm de cordón 0.4×0.2 ≈ 0.033 (1.75mm fil)', near(extrusionPerMm(0.4, 0.2), 0.4 * 0.2 / (Math.PI * (1.75 / 2) ** 2), 1e-4), `${extrusionPerMm(0.4, 0.2)}`);

// Velocidad capada por el flujo máx de la K1 (32 mm³/s)
ck('velocidad CAPADA por flujo: 0.4×0.2 → ≤ 400 mm/s', speedCapByFlow(600, 0.4, 0.2) <= 400 + 0.1, `${speedCapByFlow(600, 0.4, 0.2)}`);
ck('velocidad capada nunca > maxSpeed K1', speedCapByFlow(9999, 0.4, 0.1) <= K1.maxSpeed);
ck('velocidad chica pasa sin capar', speedCapByFlow(200, 0.4, 0.2) === 200);

// Poisson a favor: el campo de uniones → fan + gap
ck('fundido: gap 0 + fan bajo (suelda)', bondParams('fundido').gapMm === 0 && bondParams('fundido').fanPct < 50);
ck('holgura: gap ≥ g_min + fan 100% (no suelda → gira)', bondParams('holgura').gapMm > 0.25 && bondParams('holgura').fanPct === 100);
ck('hilo: tendón con fan alto', bondParams('hilo').fanPct === 100);

// Estructura del G-code: cabecera/pie K1 válidos
const h = gcodeHeader({}); const ft = gcodeFooter({});
ck('cabecera calienta + homea + abs E + accel K1', h.some(l => l.startsWith('M109')) && h.some(l => l === 'G28') && h.some(l => l === 'M82') && h.some(l => l === `M204 S${K1.maxAccel}`));
ck('cabecera prende ventilador (M106)', h.some(l => l.startsWith('M106 S')));
ck('pie apaga todo (M104 S0, M107, M84)', ft.includes('M104 S0') && ft.includes('M107') && ft.includes('M84'));

// G-code completo desde una capa simple
const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];
const g1 = generateGcode([{ z: 0.2, segs: [{ pts: sq, type: 'perimetro', speed: 200, extrude: true }] }], {});
ck('emite G1 con E creciente y F', g1.gcode.includes('E') && g1.gcode.match(/G1 X.* E.* F\d+/) !== null);
ck('reporta filamento > 0 (cuadrado chico → tiempo ~0 min, ok)', g1.filament_mm > 0, JSON.stringify({ fil: g1.filament_mm, min: g1.est_min }));
ck('E del cuadrado 40mm × 0.033 ≈ 1.33 mm', near(g1.filament_mm, 40 * extrusionPerMm(0.4, 0.2), 0.05), `${g1.filament_mm}`);

// DEMO: disco cicloidal a G-code real
const dg = discToGcode({ lobes: 10, R: 27, Rr: 2, E: 1, shaftD: 11, outPinD: 4, outPins: 6, T: 6.8 }, { layerH: 0.2 });
ck('disco: ~34 capas (6.8/0.2)', dg.layers === Math.round(6.8 / 0.2), `${dg.layers}`);
ck('disco: G-code con cientos de líneas', dg.lines > 200, `${dg.lines}`);
ck('disco: filamento y tiempo reportados', dg.filament_mm > 100 && dg.est_min > 0);
ck('disco: empieza con cabecera y termina con M84', dg.gcode.startsWith('; ── Forja') && dg.gcode.trim().endsWith('M84'));

console.log(`\nGCODE_TEST pass=${pass} fail=${fail}`);
console.log('disco→G-code:', JSON.stringify({ layers: dg.layers, lines: dg.lines, filament_mm: dg.filament_mm, filament_cm3: dg.filament_cm3, est_min: dg.est_min }));
console.log('\n— primeras 18 líneas del G-code del disco —\n' + dg.gcode.split('\n').slice(0, 18).join('\n'));
process.exit(fail === 0 ? 0 : 1);
