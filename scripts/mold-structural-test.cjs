// TEST Kazmer cap 12 — ejemplos del molde bezel (p.307-311).
(async () => {
  const path = require('path');
  const st = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'structural.ts'));
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const F = 200 * st.TON_N;
  const checks = {};
  // p.307: σ=17 MPa, δ=0.03 mm (0.381×0.302, L=403)
  const c1 = st.plateCompression(F, 0.381 * 0.302, 0.403);
  console.log('compresión: σ', (c1.sigmaPa / 1e6).toFixed(1), 'MPa (17) · δ', (c1.deflectionM * 1000).toFixed(3), 'mm (0.03)');
  checks.sigma17 = ok(c1.sigmaPa / 1e6, 17, 0.2);
  checks.d003 = ok(c1.deflectionM * 1000, 0.034, 0.005);
  // p.308: A retainer = 0.069 → 28.5 MPa → δ(12mm) = 0.002
  const A2 = 0.381 * 0.302 - 0.248 * 0.168 - 4 * (Math.PI * 0.032 ** 2 / 4 + Math.PI * 0.020 ** 2 / 4);
  const c2 = st.plateCompression(F, A2, 0.012);
  console.log('retainer: A', A2.toFixed(3), '(0.069) · σ', (c2.sigmaPa / 1e6).toFixed(1), '(28.5) · δ', (c2.deflectionM * 1000).toFixed(4), '(0.002)');
  checks.a069 = ok(A2, 0.069, 0.001);
  checks.sigma285 = ok(c2.sigmaPa / 1e6, 28.5, 0.3);
  // p.310: A_shear = 0.090 → τ = 21.8 MPa
  const As = st.shearArea(0.248, 0.168, 0.12 - 0.012);
  const tau = st.shearStress(F, As);
  console.log('shear: A', As.toFixed(3), '(0.090) · τ', (tau / 1e6).toFixed(1), 'MPa (21.8)');
  checks.ashear = ok(As, 0.090, 0.001);
  checks.tau = ok(tau / 1e6, 21.8, 0.3);
  // p.311: I = 3.6e-5, δ_bending = 0.056 mm
  const b = st.plateBending(F, 0.2159, 0.248, 0.120);
  console.log('bending: I', b.inertiaM4.toExponential(2), '(3.6e-5) · δ', (b.deflectionM * 1000).toFixed(3), 'mm (0.056)');
  checks.inertia = ok(b.inertiaM4, 3.6e-5, 0.05e-5);
  checks.dbend = ok(b.deflectionM * 1000, 0.056, 0.003);
  // el reporte marca FLASH (0.056 > 0.02) como discute el libro (12.1.2)
  const rep = st.structuralReport({ clampTons: 200, moldWM: 0.381, moldDM: 0.302, stackLM: 0.403,
    cavWM: 0.248, cavLM: 0.168, hEffShearM: 0.108, bendSpanM: 0.2159, bendWM: 0.248, bendHM: 0.120 });
  console.log(rep.rows.join(' | '));
  checks.flash = rep.flashRisk === true;
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
