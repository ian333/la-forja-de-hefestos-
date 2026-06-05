/* Verifica el cojinete CONTINUO (curva de aceite, Ocvirk/Petroff/Stribeck).
   node --import tsx scripts/cojinete-continuo-test.ts */
import {
  filmCurve, minFilm_mm, maxFilm_mm, filmFourier, loadOcvirk_N, eccentricityForLoad,
  petroffFriction, sommerfeld, lambdaRatio, regime, optimalClearanceMaxFilm, maxLoadForFullFilm,
  designContinuousBearing,
} from '../src/forja/mech/cojinete-continuo';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 1e-3) => Math.abs(a - b) < t;
const ck = (n: string, ok: boolean, x = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${n} ${x}`); } };

// (1) La CURVA continua h(θ)=c(1+ε cosθ): nunca toca si ε<1, mínimo en θ=π, máximo en θ=0.
const fc = filmCurve(0.3, 0.5, 360);
ck('curva: h_min en θ=π = c(1−ε)', near(minFilm_mm(0.3, 0.5), 0.15) && near(fc[180].h_mm, 0.15, 2e-3));
ck('curva: h_max en θ=0 = c(1+ε)', near(maxFilm_mm(0.3, 0.5), 0.45) && near(fc[0].h_mm, 0.45));
ck('curva: NO toca metal si ε<1 (h_min>0)', minFilm_mm(0.3, 0.99) > 0 && minFilm_mm(0.3, 1) === 0);

// (2) Operador 𝔄: la curva es SOLO DC (holgura) + k=1 (centrado). Plano (ε=0) → sin k1.
const four = filmFourier(0.3, 0.5);
ck('cara-𝔦: DC = holgura c', near(four.dc, 0.3));
ck('cara-𝔦: k1 = c·ε/2 (la onda de centrado)', near(four.k1, 0.3 * 0.5 / 2));
ck('plano (ε=0) → k1=0 (sin modo de centrado)', filmFourier(0.3, 0).k1 === 0);

// (3) CARGA (Ocvirk): crece con ε; al subir la carga, ε→1 y h_min→0 (límite por CARGA).
const base = { muPaS: 0.1, rpm: 600, R_mm: 9.5, L_mm: 6, c_mm: 0.3 };
ck('Ocvirk monótona: W(ε=0.8) > W(ε=0.4) > W(ε=0.1)',
  loadOcvirk_N({ ...base, eps: 0.8 }) > loadOcvirk_N({ ...base, eps: 0.4 }) && loadOcvirk_N({ ...base, eps: 0.4 }) > loadOcvirk_N({ ...base, eps: 0.1 }));
const Wbig = loadOcvirk_N({ ...base, eps: 0.5 });
const epsBack = eccentricityForLoad({ ...base, W_N: Wbig });
ck('invertir carga→ε es consistente (round-trip)', near(epsBack, 0.5, 2e-3), `eps=${epsBack}`);
ck('más carga → más excentricidad (h_min baja)', eccentricityForLoad({ ...base, W_N: Wbig * 4 }) > epsBack);

// (4) FRICCIÓN Petroff: diminuta, y BAJA al subir la holgura aprieta (∝1/c)... y la carga sube f baja
const f1 = petroffFriction({ ...base, W_N: 50 });
ck('coef. de fricción Petroff es pequeño (full-film ~<0.05)', f1 < 0.05 && f1 > 0, `f=${f1}`);
ck('número de Sommerfeld > 0', sommerfeld({ ...base, W_N: 50 }) > 0);

// (5) Régimen Stribeck λ=h_min/σ: full-film ⇔ λ≥3 (fricción nula, sin desgaste).
ck('λ=3 frontera entre mixto y full-film', regime(lambdaRatio(0.09, 0.03)) === 'full-film' && regime(2.9) === 'mixto' && regime(0.9) === 'frontera');
// existe una holgura ÓPTIMA que MAXIMIZA la película (h_min NO es monótona en c).
const optLight = optimalClearanceMaxFilm({ muPaS: 0.3, rpm: 1500, R_mm: 9.5, L_mm: 6, W_N: 4, sigma_mm: 0.015 });
ck('holgura óptima maximiza h_min (existe un máximo interior)', optLight.c_mm > 0.02 && optLight.c_mm < 1.5 && optLight.hMin_mm > 0, JSON.stringify(optLight));
ck('a carga BAJA + liso + rápido → full-film ALCANZABLE (λ≥3)', optLight.fullFilmReachable, JSON.stringify(optLight));
// a carga DURA (5 N·m → 52 N) con barreno de impresión → full-film NO alcanzable (honesto).
const optHard = optimalClearanceMaxFilm({ muPaS: 0.1, rpm: 600, R_mm: 9.5, L_mm: 6, W_N: 52, sigma_mm: 0.03 });
ck('a carga DURA + rugoso → full-film NO alcanzable (frontera, honesto)', !optHard.fullFilmReachable, JSON.stringify(optHard));
// presupuesto de carga full-film: "solo la carga rompe" cuantificado.
const budget = maxLoadForFullFilm({ muPaS: 0.3, rpm: 1500, R_mm: 9.5, L_mm: 6, c_mm: optLight.c_mm, sigma_mm: 0.015 });
ck('hay un presupuesto de carga full-film > 0', budget > 0, `budget=${budget}`);
ck('barreno demasiado holgado vs rugosidad → full-film imposible (0)', maxLoadForFullFilm({ muPaS: 0.3, rpm: 1200, R_mm: 9.5, L_mm: 6, c_mm: 0.05, sigma_mm: 0.02 }) === 0);

// (6) DISEÑO: 5 N·m a 600 rpm = FRONTERA (honesto, no flota); par bajo + viscoso = full-film.
const dHard = designContinuousBearing({ shaftD: 16, E: 1.5, T: 6, rpmIn: 600, outputTorqueNm: 5, lobes: 10 });
ck('diseño DURO (5 N·m): honesto, NO full-film (frontera/mixto)', !dHard.fullFilmAtEval && dHard.regime !== 'full-film');
ck('diseño: el centrado vive en k1 (>0) aunque no flote', dHard.fourier.k1 > 0);
ck('diseño: fricción Petroff diminuta', dHard.frictionCoeff < 0.1);
const dSoft = designContinuousBearing({ shaftD: 16, E: 1.5, T: 6, rpmIn: 1500, outputTorqueNm: 0.4, lobes: 10, muPaS: 0.3, sigma_mm: 0.015, c_mm: 0.12 });
ck('diseño SUAVE (0.4 N·m, 1500 rpm, viscoso, liso, apretado) → full-film', dSoft.fullFilmAtEval && dSoft.regime === 'full-film', JSON.stringify({ reg: dSoft.regime, lam: dSoft.lambda, f: dSoft.frictionCoeff }));
ck('diseño: reporta presupuesto de carga full-film', dSoft.fullFilmLoadBudget_N > 0);

console.log(`\nCOJINETE_CONTINUO_TEST pass=${pass} fail=${fail}`);
console.log('diseño DURO (5 N·m, 600 rpm) → frontera:', JSON.stringify(dHard, null, 2));
console.log('\ndiseño SUAVE (0.4 N·m, 1500 rpm, viscoso) → full-film:', JSON.stringify(dSoft, null, 2));
process.exit(fail === 0 ? 0 : 1);
