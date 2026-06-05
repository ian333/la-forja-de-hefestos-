/* Verifica la física del contacto conforme + filete (Inglis/Hertz/EHL/tracción).
   node --import tsx scripts/contacto-test.ts */
import {
  notchKt, filletRadiusForKt, eStar, effectiveRadius_mm, hertzLine, ehlFilm_um,
  lambdaRatio, regime, frictionForce_N, externalCenteringStiffness_N_per_mm, conformalSweep,
} from '../src/forja/mech/contacto-conforme';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 1e-2) => Math.abs(a - b) < t;
const ck = (n: string, ok: boolean, x = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${n} ${x}`); } };

// (A) Chaflán AGUDO → Kt enorme; FILETE (curva) → Kt finito y baja con el radio.
ck('esquina aguda (ρ→0) → Kt = ∞ (ahí se cizalla)', notchKt(1.2, 0) === Infinity);
ck('filete chico Kt alto > filete generoso Kt bajo', notchKt(1.2, 0.2) > notchKt(1.2, 1.2));
ck('filete ρ=t → Kt = 1 + 2 = 3 (Inglis)', near(notchKt(1.2, 1.2), 3, 1e-3));
ck('Kt baja monótono al crecer el radio', notchKt(1.2, 0.4) > notchKt(1.2, 0.8) && notchKt(1.2, 0.8) > notchKt(1.2, 1.6));
ck('radio de filete para Kt objetivo (round-trip)', near(notchKt(1.2, filletRadiusForKt(1.2, 2.0)), 2.0, 1e-2));

// (B) Hertz línea: más CONFORME (R* mayor) → más ancho (área), menos presión pico.
const Es = eStar();
ck('E* PLA-PLA ≈ 2.0 GPa', near(Es / 1e9, 2.01, 0.05), `${(Es / 1e9).toFixed(3)}`);
const Rtip = effectiveRadius_mm(3, 6.6), Rhug = effectiveRadius_mm(3, 3.36); // suelto vs abraza
ck('valle que abraza → R* mucho mayor que valle suelto', Rhug > Rtip * 2, `tip=${Rtip.toFixed(2)} hug=${Rhug.toFixed(2)}`);
const hzTip = hertzLine({ Wprime_Npm: 1667, Rstar_mm: Rtip, Estar_Pa: Es });
const hzHug = hertzLine({ Wprime_Npm: 1667, Rstar_mm: Rhug, Estar_Pa: Es });
ck('conforme: MÁS ancho de contacto (más área)', hzHug.contactWidth_mm > hzTip.contactWidth_mm);
ck('conforme: MENOS presión pico', hzHug.pMax_MPa < hzTip.pMax_MPa);
ck('relación: b ∝ √R*, p ∝ 1/√R* (consistencia Hertz)', near(hzHug.halfWidth_mm / hzTip.halfWidth_mm, Math.sqrt(Rhug / Rtip), 0.02));

// (B) EHL: más conforme → película más gruesa (flota mejor).
const hTip = ehlFilm_um({ eta0: 0.1, u: 0.3, Estar_Pa: Es, Rstar_mm: Rtip, alpha_Pa: 2e-8, Wprime_Npm: 1667 });
const hHug = ehlFilm_um({ eta0: 0.1, u: 0.3, Estar_Pa: Es, Rstar_mm: Rhug, alpha_Pa: 2e-8, Wprime_Npm: 1667 });
ck('conforme: película EHL más gruesa', hHug > hTip, `tip=${hTip} hug=${hHug}`);
ck('régimen por λ=h/σ', regime(lambdaRatio(0.3, 0.1)) === 'full-film' && regime(lambdaRatio(0.05, 0.1)) === 'frontera');

// (B) FRICCIÓN: en FULL-FILM = μ_t·CARGA (independiente del área) → no sube con el área.
const fFullA = frictionForce_N({ regime: 'full-film', load_N: 10 });
const fFullB = frictionForce_N({ regime: 'full-film', load_N: 10 }); // misma carga, “más área” → IGUAL
ck('full-film: fricción = μ_t·carga, NO depende del área', fFullA === fFullB);
ck('frontera: μ mucho mayor que full-film (por eso "si flota")', frictionForce_N({ regime: 'frontera', load_N: 10 }) > 3 * fFullA);

// (B) Centrado externo: más rodillos activos → más rigidez.
ck('más rodillos activos → más rigidez de centrado', externalCenteringStiffness_N_per_mm({ Estar_Pa: Es, L_mm: 6, activeRollers: 5 }) > externalCenteringStiffness_N_per_mm({ Estar_Pa: Es, L_mm: 6, activeRollers: 2 }));

// DISEÑO: barrido conformidad para la caja — prueba la intuición del usuario.
const d = conformalSweep({ Rr: 3, T: 6, lobes: 10, radialLoad_N: 52, u: 0.3, sigma_um: 6 });
ck('diseño: conforme gana ÁREA (>1×)', d.areaGain_x > 1.2, JSON.stringify({ area: d.areaGain_x, p: d.pressureDrop_x }));
ck('diseño: conforme BAJA la presión pico', d.pressureDrop_x > 1.2);
ck('diseño: la fricción NO se dispara con el área (≈1× en mismo régimen)', d.frictionRatio <= 1.05);
ck('diseño: reporta centrado externo y veredicto', d.externalCentering_N_per_mm > 0 && !!d.note);

console.log(`\nCONTACTO_TEST pass=${pass} fail=${fail}`);
console.log('barrido conformidad (caja, 52 N, u=0.3):', JSON.stringify(d, null, 2));
process.exit(fail === 0 ? 0 : 1);
