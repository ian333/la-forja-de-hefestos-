// TEST Kazmer cap 10 — ejemplo del bezel ABS (p.239-241).
(async () => {
  const path = require('path');
  const sh = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'shrinkage.ts'));
  const { ABS_TAIT } = sh;
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};
  // p.239: T_t(66 MPa) = 386 K
  const tt = sh.transitionT(ABS_TAIT, 66e6);
  console.log('T_t(66MPa):', tt.toFixed(1), 'K (libro 386)');
  checks.tt = ok(tt, 385.8, 0.5);
  // p.240: v(405K, 66MPa) = 9.65e-4 (v0=1.01e-3, B=1.16e8)
  const vp = sh.specificVolume(ABS_TAIT, 405, 66e6);
  console.log('v(405K,66MPa):', (vp * 1e4).toFixed(3), 'e-4 (libro 9.65)');
  checks.vpack = ok(vp, 9.65e-4, 0.01e-4);
  // p.240: v(293K, 0) = 9.56e-4
  const vu = sh.specificVolume(ABS_TAIT, 293, 0);
  console.log('v(293K,0):', (vu * 1e4).toFixed(3), 'e-4 (libro 9.56)');
  checks.vuse = ok(vu, 9.56e-4, 0.01e-4);
  // p.240-241: r_v = 0.9907, s = 0.31%
  const r = sh.shrinkage(ABS_TAIT, { tNoFlowK: 405, pPackPa: 66e6 });
  console.log('r_v:', r.rv.toFixed(4), '(0.9907) · s:', (r.linear * 100).toFixed(2), '% (0.31) · moldScale:', r.moldScale.toFixed(4));
  checks.rv = ok(r.rv, 0.991, 0.001);  // el libro divide sus valores REDONDEADOS (9.56/9.65=0.9907); full-precision da 0.9913
  checks.s = ok(r.linear * 100, 0.31, 0.03);
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
