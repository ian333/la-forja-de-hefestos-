// TEST Kazmer cap 7 — ejemplos bezel/cup (p.177-179).
(async () => {
  const path = require('path');
  const g = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'gating.ts'));
  const ABS = { k: 17000, n: 0.35, kappa: 0.19, tMelt: 239, tWall: 60 };
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};
  // p.177: edge gate 6×0.75mm @62.5cc/s → 111,000 1/s
  const s1 = g.shearRateStrip(62.5e-6, 0.006, 0.00075);
  console.log('edge:', Math.round(s1).toLocaleString(), '(libro 111,000)');
  checks.edge = ok(s1, 111111, 500);
  // p.177: pin-point ⌀1.5 @44cc/s → 132,000 1/s
  const s2 = g.shearRateCyl(44e-6, 0.00075);
  console.log('pin-point:', Math.round(s2).toLocaleString(), '(libro 132,000)');
  checks.pin = ok(s2, 132700, 1500);
  // p.178: R para 50,000 1/s → 1.03 mm
  const r = g.gateRadiusForShear(44e-6, 50000) * 1000;
  console.log('R(50k):', r.toFixed(2), 'mm (libro 1.03)');
  checks.radius = ok(r, 1.03, 0.01);
  // p.179: fan gate aprox 10×3.5×10mm @62.5 → 1.9 MPa (power law)
  const dp1 = g.gateDropStripPL(ABS, 0.01, 0.01, 0.0035, 62.5e-6) / 1e6;
  console.log('fan ΔP:', dp1.toFixed(1), 'MPa (libro 1.9)');
  checks.fan = ok(dp1, 1.9, 0.1);
  // p.179: pin-point Newtonian μ=5.4, L=1mm, R=0.75 → 1.9 MPa; μ=11.2 R=1 → 1.3
  const dp2 = g.gateDropCylNewt(5.4, 0.001, 0.00075, 44e-6) / 1e6;
  const dp3 = g.gateDropCylNewt(11.2, 0.001, 0.001, 44e-6) / 1e6;
  console.log('pin ΔP:', dp2.toFixed(1), '(1.9) ·', dp3.toFixed(1), '(1.3)');
  checks.dp2 = ok(dp2, 1.9, 0.1); checks.dp3 = ok(dp3, 1.3, 0.1);
  // diseño: edge 0.75 con 62.5cc/s excede 50k → ⚠; tabla: tunnel=automatic
  const d = g.gateDesign({ type: 'edge', wallMm: 0.75, VdotM3s: 62.5e-6, shearMaxS: 50000, widthMm: 6 });
  console.log(d.report);
  checks.warn = d.ok === false;
  checks.table = g.GATE_TABLE['tunnel'].degating === 'automatic' && g.GATE_TABLE['fan'].flow === 'linear';
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
