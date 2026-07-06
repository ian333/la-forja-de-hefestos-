// TEST Kazmer cap 9 — contra los EJEMPLOS RESUELTOS del libro (p.203, p.206).
(async () => {
  const path = require('path');
  const cooling = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'cooling.ts'));
  const { ABS_KAZMER } = cooling;
  const approx = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};
  // libro p.203: lid 2mm → 8.4 s · cup 3mm → 18.9 s · runner 0.00476m → 22.9 s
  const lid = cooling.coolingTimePlate(0.002, ABS_KAZMER);
  const cup = cooling.coolingTimePlate(0.003, ABS_KAZMER);
  const run = cooling.coolingTimeRod(0.00476, ABS_KAZMER);
  console.log('lid:', lid.toFixed(2), 's (libro 8.4) | cup:', cup.toFixed(2), '(18.9) | runner:', run.toFixed(2), '(22.9)');
  checks.lid = approx(lid, 8.4, 0.1);
  checks.cup = approx(cup, 18.9, 0.15);
  checks.runner = approx(run, 22.9, 0.2);
  // libro p.206: regla del pulgar 3mm → 18 s; y "compares very well" con ~19.2 s
  checks.rule = cooling.coolingTimeRuleOfThumb(3) === 18;
  // simulación (Eq 9.4): a t=0 el centro está a T_melt; a t_c el centro ≈ T_eject
  const T0 = cooling.centerlineTemperature(0.003, 1e-9, ABS_KAZMER, 60);
  const Tc = cooling.centerlineTemperature(0.003, cup, ABS_KAZMER);
  console.log('sim: T(0)=', T0.toFixed(1), '(→239) | T(t_c)=', Tc.toFixed(1), '(→96.7)');
  checks.sim_inicio = approx(T0, 239, 1.5);
  checks.sim_eyeccion = approx(Tc, 96.7, 1.5);
  // Q por ciclo: disparo de 50 g de ABS (Cp≈2345 J/kg°C libro tabla) → J
  const Q = cooling.heatToRemove(0.05, 2345, ABS_KAZMER);
  console.log('Q(50g):', Q.toFixed(0), 'J');
  checks.q_positivo = Q > 15000 && Q < 18000;
  // reporte del molde familia: gobierna el runner (22.9 > 18.9 > 8.4) como dice el libro
  const rep = cooling.coolingReport([
    { name: 'lid', kind: 'plate', sizeMm: 2 }, { name: 'cup', kind: 'plate', sizeMm: 3 },
    { name: 'runner', kind: 'rod', sizeMm: 4.76 },
  ], ABS_KAZMER);
  console.log('reporte: gobierna', rep.governing, '=', rep.cycleCoolingS.toFixed(1), 's');
  checks.governing = rep.governing === 'runner';
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
