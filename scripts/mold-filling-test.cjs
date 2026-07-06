// TEST Kazmer cap 5 — ejemplos resueltos del laptop bezel (p.105-111).
(async () => {
  const path = require('path');
  const f = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'filling.ts'));
  const { ABS_MG47 } = f;
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};
  // Eq 5.24 (p.105): v=0.5 m/s, H=1.5mm → γ̇ = 2000 1/s
  checks.shear2000 = ok(f.shearRateNewtonian(0.5, 0.0015), 2000, 1);
  // Eq 5.25 (p.105): μ=120 Pa·s → v̄ = 0.69 m/s
  checks.v069 = ok(f.recommendedVelocity(ABS_MG47, 120), 0.69, 0.01);
  // convergencia del libro: → ~0.82 m/s
  const vConv = f.convergeVelocity(ABS_MG47, 0.0015);
  console.log('v convergida:', vConv.toFixed(3), '(libro 0.82)');
  checks.vConv = ok(vConv, 0.82, 0.03);
  // Eq 5.22 (p.108): k=17070, n=0.348, L=0.2, H=0.0015, v=0.82 → 83.2 MPa
  const dp = f.pressureDropSegment(ABS_MG47, 0.2, 0.0015, 0.82);
  console.log('ΔP:', (dp / 1e6).toFixed(1), 'MPa (libro 83.2)');
  checks.dp832 = ok(dp / 1e6, 83.2, 0.5);
  // Eq 5.27/5.28 (p.110): 50 MPa × 0.2 × 0.012 = 120 kN = 12.2 mTon; 75 → 18.3 mTon
  checks.clamp122 = ok(f.clampMetricTons(50e6, 0.2 * 0.012), 12.2, 0.1);
  checks.clamp183 = ok(f.clampMetricTons(75e6, 0.2 * 0.012), 18.3, 0.1);
  // p.111: bezel 100 MPa × 9724 mm² = 972 kN = 99 mTon
  const t99 = f.clampMetricTons(100e6, 9724e-6);
  console.log('bezel clamp:', t99.toFixed(1), 'ton (libro 99)');
  checks.clamp99 = ok(t99, 99, 1);
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
