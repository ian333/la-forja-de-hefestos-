/* Verifica la física del autocentrado hidrodinámico de la jaula (Reynolds 1D).
   node --import tsx scripts/cojinete-test.ts */
import {
  wedgePressureBar, wedgeLoadCoeff, wedgeLoadCoeffNumeric, optimumWedgeRatio,
  wedgePressureProfile, landLoadN, selfCenter, centeringStiffness_N_per_mm,
  squeezeFilmN, wedgeFromClearance, wedgeRampDeg, landSelfSupports, designCageWedge,
} from '../src/forja/mech/cojinete-jaula';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 1e-3) => Math.abs(a - b) < t;
const ck = (n: string, ok: boolean, x = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${n} ${x}`); } };

// (1) La LECCIÓN: película PLANA (n=1) → CERO presión y CERO carga (sin centrado).
ck('plano n=1 → presión 0 en todo H', wedgePressureBar(1, 1) === 0 && wedgePressureBar(1, 0.5) === 0);
ck('plano n=1 → carga 0 (Couette puro, no centra)', wedgeLoadCoeff(1) === 0);

// (2) La CUÑA: presión 0 en los extremos, positiva (joroba) en medio, pico en H*=2n/(n+1).
const n = 2.2;
const prof = wedgePressureProfile(n, 200);
ck('cuña: p=0 en la entrada (ξ=0)', near(prof[0].Pbar, 0));
ck('cuña: p=0 en la salida (ξ=1)', near(prof[prof.length - 1].Pbar, 0));
ck('cuña: presión POSITIVA en medio (joroba)', prof[100].Pbar > 0);
const Hpeak = 2 * n / (n + 1); // 1.375
let imax = 0; for (let i = 1; i < prof.length; i++) if (prof[i].Pbar > prof[imax].Pbar) imax = i;
ck('pico en el espesor medio ARMÓNICO H*=2n/(n+1)', near(prof[imax].H, Hpeak, 0.02), `Hpeak=${prof[imax].H.toFixed(3)} vs ${Hpeak.toFixed(3)}`);

// (3) Carga cerrada ≡ numérica (cruce de la fórmula contra la integral del perfil).
for (const nn of [1.5, 2.0, 2.2, 3.0]) ck(`W̄ cerrada ≡ numérica (n=${nn})`, near(wedgeLoadCoeff(nn), wedgeLoadCoeffNumeric(nn), 1e-4), `${wedgeLoadCoeff(nn).toFixed(5)} vs ${wedgeLoadCoeffNumeric(nn).toFixed(5)}`);

// (4) La cuña ÓPTIMA del patín fijo: n* ≈ 2.19, coeff ≈ 0.0267 (resultado clásico).
const opt = optimumWedgeRatio();
ck('razón de cuña óptima n* ≈ 2.19', near(opt.n, 2.189, 0.01), `n*=${opt.n}`);
ck('coeficiente de carga máx ≈ 0.0267', near(opt.coeff, 0.0267, 5e-4), `c=${opt.coeff}`);

// (5) AUTOCENTRADO: la fuerza es RESTAURADORA (>0) y la rigidez positiva (estable).
const op = { muPaS: 0.1, U_mps: 0.1, B_mm: 3, L_mm: 6, h2_mm: 0.27, n: 2.2 };
const sc = selfCenter(op, 0.05);
ck('deriva hacia el rodillo → carga que CIERRA > carga que ABRE (restaura)', sc.closingLoad_N > sc.openingLoad_N && sc.F_N > 0, JSON.stringify(sc));
ck('rigidez de centrado k > 0 (estable)', centeringStiffness_N_per_mm(op) > 0);
// crece ~1/h²: cerrar el hueco a la mitad ~cuadruplica la carga del land
const wide = landLoadN({ ...op, h2_mm: 0.27 }), tight = landLoadN({ ...op, h2_mm: 0.135 });
ck('carga ~1/h²: media holgura ≈ 4× carga', near(tight / wide, 4, 0.15), `ratio=${(tight / wide).toFixed(2)}`);

// (6) Squeeze-film: resiste el acercamiento como 1/h³ (amortiguador anti-impacto).
const sqFar = squeezeFilmN({ muPaS: 0.1, V_mps: 0.01, B_mm: 3, L_mm: 6, h_mm: 0.27 });
const sqNear = squeezeFilmN({ muPaS: 0.1, V_mps: 0.01, B_mm: 3, L_mm: 6, h_mm: 0.135 });
ck('squeeze ~1/h³: media holgura ≈ 8× fuerza', near(sqNear / sqFar, 8, 0.4), `ratio=${(sqNear / sqFar).toFixed(2)}`);

// (7) Holgura impresa → cuña que SÍ imprime (garganta ≥ g_min de fusión).
const wf = wedgeFromClearance(0.6, opt.n, 0.3);
ck('0.6 con n* → garganta h₂≈0.274 (boca 0.6)', near(wf.h2_mm, 0.6 / opt.n, 1e-3) && near(wf.h1_mm, 0.6), JSON.stringify(wf));
ck('garganta 0.274 ≥ g_min 0.30? margen NEGATIVO chico → avisa', wf.throatMargin_mm < 0);
const wf2 = wedgeFromClearance(0.7, opt.n, 0.3);
ck('subir holgura a 0.7 → garganta 0.32 ≥ 0.30 → imprimible', wf2.printable && wf2.h2_mm >= 0.3, JSON.stringify(wf2));
ck('rampa hidrodinámica es POCO profunda (pocos grados)', wedgeRampDeg(0.6, 0.274, 3) < 10);
ck('land en Z a 45° SÍ auto-soporta', landSelfSupports(45) && !landSelfSupports(30));

// (8) DISEÑO completo para nuestra caja (R40, 10 lóbulos, gap 0.6, 600 rpm).
const d = designCageWedge({ R: 40, Rr: 3, lobes: 10, E: 1.5, T: 6, gap: 0.7, rpmIn: 600 });
ck('diseño: usa la cuña óptima ≈2.19', near(d.wedgeRatio, 2.189, 0.01));
ck('diseño: centra de forma ESTABLE (k>0)', d.centersStably && d.centeringStiffness_N_per_mm > 0);
ck('diseño: 11 lands (lóbulos+1)', d.rollers === 11);
ck('diseño: la rampa se auto-soporta en impresión', d.selfSupports);

console.log(`\nCOJINETE_TEST pass=${pass} fail=${fail}`);
console.log('óptimo:', JSON.stringify(opt));
console.log('diseño caja (gap 0.7, 600 rpm):', JSON.stringify(d, null, 2));
process.exit(fail === 0 ? 0 : 1);
