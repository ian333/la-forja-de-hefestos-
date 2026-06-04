/* Prueba del Operador 𝔄 para mecanismos vs cinemática verificada. node --import tsx scripts/operador-test.ts */
import { dft, idft, circulantEigenvalues, cyclicBalance, cyclicReduction, modeSpectrum, cabs, compileMechanism } from '../src/forja/mech/operador-mecanismos';
import { eccentricBalance } from '../src/forja/mech/gearbox';
import { K1, fusionGapMin } from '../src/forja/mech/printsim';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 1e-6) => Math.abs(a - b) < t;
const ck = (n: string, ok: boolean, x = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${n} ${x}`); } };

// Paso 1+2: la cara-𝔦 (DFT) funciona
const d1 = dft([{ re: 1, im: 0 }, { re: 1, im: 0 }, { re: 1, im: 0 }, { re: 1, im: 0 }]);
ck('DFT de constante → solo DC (4,0,0,0)', near(cabs(d1[0]), 4) && near(cabs(d1[1]), 0) && near(cabs(d1[2]), 0));
const delta = [{ re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }];
ck('DFT de delta → plano (todos |X_k|=1)', dft(delta).every((X) => near(cabs(X), 1)));
// round-trip
const orig = [{ re: 2, im: 1 }, { re: -1, im: 0 }, { re: 0, im: 3 }, { re: 4, im: -2 }, { re: 1, im: 1 }];
const rt = idft(dft(orig));
ck('idft(dft(x)) = x (round-trip)', orig.every((v, i) => near(v.re, rt[i].re) && near(v.im, rt[i].im)));

// circulante → autovalores = DFT de la 1ª fila (Laplaciano cíclico [2,-1,0,-1])
const ev = circulantEigenvalues([2, -1, 0, -1]);
ck('autovalores circulante [2,-1,0,-1] = [0,2,4,2]', near(ev[0].re, 0) && near(ev[1].re, 2) && near(ev[2].re, 4) && near(ev[3].re, 2) && ev.every((e) => near(e.im, 0, 1e-9)));

// Paso 3: BALANCE = DC=0, y CONCUERDA con eccentricBalance (verificado)
for (const N of [1, 2, 3, 5, 10]) {
  const op = cyclicBalance(N), gb = eccentricBalance(N);
  ck(`balance N=${N}: Operador 𝔄 (DC=${op.dc}) ≡ gearbox.eccentricBalance`, op.balanced === gb.balanced, `op=${op.balanced} gb=${gb.balanced}`);
}
ck('N=5 balanceado: DC≈0', cyclicBalance(5).balanced && near(cyclicBalance(5).dc, 0, 1e-9));
ck('N=5: el campo de fases es UNA onda pura (pico en k=1)', cyclicBalance(5).peakMode === 1 && near(cyclicBalance(5).spectrum[1], 1));
ck('N=1 desbalanceado: DC=1', !cyclicBalance(1).balanced && near(cyclicBalance(1).dc, 1));

// Paso 4: RATIO por batido — reproduce config A (10:1) y config B del usuario (11:1)
const A = cyclicReduction(10, 'disc');   // hembra fija, gira la brida
const B = cyclicReduction(10, 'ring');   // brida fija, gira la HEMBRA (el actuador)
ck('config A (hembra fija): 10:1 opuesto', A.ratio === 10 && A.sign === -1, JSON.stringify(A));
ck('config B (brida fija → gira HEMBRA): 11:1 mismo sentido', B.ratio === 11 && B.sign === +1, JSON.stringify(B));
ck('el batido es 1 (diferencia de 1 diente Z_r−Z_c)', A.beat === 1 && B.beat === 1);

// Paso 6: COMPILAR — las 3 preguntas en la cara-𝔦, reproduciendo NUESTRA caja + fallas
const gOn = fusionGapMin(K1.fanOn_h), gOff = fusionGapMin(K1.fanOff_h);   // ~0.30 / ~0.85
const necks30 = Array.from({ length: 30 }, () => 0.35 * 0.35);            // 30 cuellos = 3.67mm²
const base = { lobes: 10, discs: 5, output: 'ring' as const, gapMm: 0.6, neckAreas: necks30, detachBudgetMm2: 4 };
const actuador = compileMechanism({ ...base, gMinFan: gOn });
ck('ACTUADOR compila VÁLIDO: mueve 11:1 + balanceado + imprime + despega', actuador.valido && actuador.mueve.ratio === 11 && actuador.balanceado, JSON.stringify(actuador));
const sinVent = compileMechanism({ ...base, gMinFan: gOff });
ck('SIN ventilador → el hueco FUNDE → no válido (ladrillo)', !sinVent.valido && sinVent.imprime.funde);
const muchaArea = compileMechanism({ ...base, gMinFan: gOn, neckAreas: Array.from({ length: 50 }, () => 0.6 * 0.6) });
ck('MUCHA área (50×0.36=18mm²) → no despega → no válido', !muchaArea.valido && !muchaArea.despega.ok);
const cfgA = compileMechanism({ ...base, gMinFan: gOn, output: 'disc' });
ck('config A (hembra fija) compila 10:1, sentido opuesto', cfgA.mueve.ratio === 10 && cfgA.mueve.dir === 'opuesto');

console.log(`OPERADOR_TEST pass=${pass} fail=${fail}`);
console.log('compilar ACTUADOR:', JSON.stringify(compileMechanism({ ...base, gMinFan: gOn }), null, 2));
console.log('config A:', JSON.stringify(cyclicReduction(10, 'disc')));
console.log('config B (actuador):', JSON.stringify(cyclicReduction(10, 'ring')));
console.log('balance N=5:', JSON.stringify(cyclicBalance(5)));
process.exit(fail === 0 ? 0 : 1);
