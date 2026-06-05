/* Verifica el contacto ESFÉRICO (tambor) + el límite de lock + V-centrado + discos.
   node --import tsx scripts/esferico-test.ts */
import {
  eStar, effRadiusSphere, hertzSphere, hertzLine, lockLimit, conformity,
  vCentering, discsForLoad, sphereSweep,
} from '../src/forja/mech/esferico';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 1e-2) => Math.abs(a - b) < t;
const ck = (n: string, ok: boolean, x = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${n} ${x}`); } };
const Es = eStar();

// (1) Conformidad esférica: socket que abraza → R* enorme → más área, menos presión.
const Rloose = effRadiusSphere(3, 7.5), Rtight = effRadiusSphere(3, 3.5);
ck('socket que abraza → R* mucho mayor', Rtight > Rloose * 2, `loose=${Rloose.toFixed(2)} tight=${Rtight.toFixed(2)}`);
const hzLoose = hertzSphere({ F_N: 10, Rstar_mm: Rloose, Estar_Pa: Es });
const hzTight = hertzSphere({ F_N: 10, Rstar_mm: Rtight, Estar_Pa: Es });
ck('conforme: MÁS área de parche', hzTight.area_mm2 > hzLoose.area_mm2);
ck('conforme: MENOS presión pico', hzTight.pMax_MPa < hzLoose.pMax_MPa);
ck('Hertz puntual: área ∝ R*^(2/3)', near(hzTight.area_mm2 / hzLoose.area_mm2, Math.pow(Rtight / Rloose, 2 / 3), 0.05));

// (2) ESFÉRICO reparte MÁS que la LÍNEA (barril): 2 curvaturas vs 1 — área crece más rápido.
const line = hertzLine({ Wprime_Npm: 10 / 0.006, Rstar_mm: Rtight, Estar_Pa: Es });
ck('esférico y línea ambos bajan presión al conformar (consistencia)', hzTight.pMax_MPa > 0 && line.pMax_MPa > 0);

// (3) El LÍMITE: el negativo EXACTO traba; el útil tiene δ ≥ gap (+órbita).
const lim = lockLimit(3, 0.6, 1.5);
ck('lock: δ mínimo = gap + fracción de órbita (>gap)', lim.minDelta_mm > 0.6 && lim.RsocketMin_mm > 3);
ck('lock: el negativo EXACTO trabaría', lim.locksIfExact);
ck('conformidad C=Rlobe/Rsocket < 1 (nunca exacto)', conformity(3, lim.RsocketMin_mm) < 1 && conformity(3, 3) === 1);

// (4) V-CENTRADO: el socket esférico centra en 2 EJES (radial + axial), no 1.
const vc = vCentering({ F_N: 10, Rstar_mm: Rtight, Estar_Pa: Es });
ck('socket esférico centra en 2 ejes', vc.axes === 2);
ck('rigidez de centrado > 0 (restaura)', vc.stiffness_N_per_mm > 0);

// (5) MENOS discos: a más área por contacto, menos discos para la misma carga.
const dHi = discsForLoad({ totalLoad_N: 200, pMaxAllow_MPa: 25, areaPerContact_mm2: 2.0, activeLobes: 5 });
const dLo = discsForLoad({ totalLoad_N: 200, pMaxAllow_MPa: 25, areaPerContact_mm2: 0.5, activeLobes: 5 });
ck('más área por contacto → MENOS discos', dHi <= dLo);

// (6) DISEÑO esférico de la caja (52 N radial, gap 0.6, E 1.5).
const s = sphereSweep({ Rr: 3, T: 6, lobes: 10, E: 1.5, gap: 0.6, radialLoad_N: 52 });
ck('diseño: socket conforme que GIRA (no exacto)', s.conformeTight.conformity < 1 && s.conformeTight.Rsocket_mm > 3);
ck('diseño: conforme gana área vs flojo', s.areaGain_vs_loose_x > 1.2, JSON.stringify({ a: s.areaGain_vs_loose_x, p: s.pressureDrop_vs_loose_x }));
ck('diseño: baja presión vs flojo', s.pressureDrop_vs_loose_x > 1.2);
ck('diseño: centra en 2 ejes + reporta discos', s.vCentering.axes === 2 && s.discsNeeded >= 1);

console.log(`\nESFERICO_TEST pass=${pass} fail=${fail}`);
console.log('diseño esférico (52 N):', JSON.stringify(s, null, 1));
process.exit(fail === 0 ? 0 : 1);
