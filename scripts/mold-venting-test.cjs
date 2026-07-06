// TEST Kazmer cap 8 — ejemplos p.190-191.
(async () => {
  const path = require('path');
  const v = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'venting.ts'));
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};
  // p.190: 100 cc/s, W=L=10mm, ΔP=0.1 MPa → h_min = 0.06 mm
  const hmin = v.ventMinThickness(100e-6, 0.01, 0.01) * 1000;
  console.log('h_min:', hmin.toFixed(3), 'mm (libro 0.06)');
  checks.hmin = ok(hmin, 0.06, 0.003);
  // p.191: P = 100 MPa/s × 0.003 s = 300,000 Pa; h_max = 0.4·L → L=0.2 → 0.08
  checks.pmelt = ok(v.meltPressureAtVent(100e6, 0.003), 300000, 1);
  const hmax = v.ventMaxThickness(0.2e-3) * 1000;
  console.log('h_max(L=0.2):', hmax.toFixed(3), 'mm (libro 0.08)');
  checks.hmax = ok(hmax, 0.073, 0.003);  // exacto √(120/900)=0.365·L; el libro redondea a '0.4·L'→0.08
  // diseño integrado: factible con h∈[0.06, 0.08], espec 0.06
  const d = v.ventDesign({ VdotAirM3s: 100e-6, lM: 0.01, wM: 0.01, lFlashM: 0.2e-3 });
  console.log(d.report);
  checks.design = d.feasible && ok(d.hSpecMm, 0.06, 0.005);
  checks.table = v.VENT_TABLE_MM.medViscosity.rosato === 0.3;
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
