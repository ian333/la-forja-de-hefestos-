/* Test del reductor cicloidal (cycloidal.ts). node --import tsx scripts/cycloidal-test.ts */
import { cycloidalDisc, pinPositions, outputHoles, countLobes } from '../src/forja/mech/cycloidal';

let pass = 0, fail = 0;
const approx = (a: number, b: number, t = 1e-6) => Math.abs(a - b) < t;
const ck = (name: string, ok: boolean, extra = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${name} ${extra}`); } };

const d = cycloidalDisc({ lobes: 10, R: 40, Rr: 3, E: 1.5, segments: 720 });

// REDUCCIÓN
ck('ratio = lobes (10:1)', d.ratio === 10);
ck('pernos = lobes+1 (11)', d.pins === 11);

// LÓBULOS reales en el perfil
ck('perfil tiene 10 lóbulos', countLobes(d.profile) === 10, `got ${countLobes(d.profile)}`);

// el disco CABE dentro del círculo de pernos
ck('maxR < R (cabe en el anillo)', d.maxR < d.pinCircleR, `maxR=${d.maxR.toFixed(2)} R=${d.pinCircleR}`);
ck('minR > 0', d.minR > 0, `minR=${d.minR.toFixed(2)}`);
ck('lobes varían el radio', d.maxR - d.minR > 1, `Δr=${(d.maxR - d.minR).toFixed(2)}`);

// muestreo correcto (perfil abierto = no duplica cierre)
ck('perfil = segments puntos', d.profile.length === 720);

// excentricidad válida (sin traslape): E < R/(2·pins) = 40/22 = 1.818
ck('E válida', d.valid === true, `E=${d.eccentricity} lim=${(40 / 22).toFixed(3)}`);
const bad = cycloidalDisc({ lobes: 10, R: 20, Rr: 3, E: 3, segments: 360 }); // E grande
ck('E inválida se detecta', bad.valid === false);

// PERNOS del anillo
const pins = pinPositions(40, 11);
ck('11 pernos', pins.length === 11);
ck('pernos en el círculo R=40', pins.every(p => approx(Math.hypot(p.x, p.y), 40, 1e-9)));

// BARRENOS de salida: ⌀ = ⌀perno + 2E (acomoda el excéntrico)
const oh = outputHoles(22, 6, 8, 1.5);
ck('6 barrenos de salida', oh.centers.length === 6);
ck('⌀barreno = ⌀perno + 2E (11)', oh.holeD === 11);

console.log(`CYCLOIDAL_TEST pass=${pass} fail=${fail}`);
console.log('disc:', JSON.stringify({ ratio: d.ratio, pins: d.pins, lobes: countLobes(d.profile), maxR: +d.maxR.toFixed(2), minR: +d.minR.toFixed(2), valid: d.valid }));
process.exit(fail === 0 ? 0 : 1);
