// TEST Kazmer §12.4 — tornillos del molde bezel (p.336-338).
(async () => {
  const path = require('path');
  const f = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'fasteners.ts'));
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};
  // p.336: masa = 7800·0.403·0.381·0.302 = 362 kg
  const m = f.moldMassKg(0.403, 0.381, 0.302);
  console.log('masa molde:', m.toFixed(0), 'kg (libro 362)');
  checks.mass = ok(m, 362, 1);
  // p.337: F = 362·10·9.8·(0.2/0.15) = 47,000 N
  const F = f.worstCaseScrewForce(m, 0.2, 0.15);
  console.log('F screw:', F.toFixed(0), 'N (libro 47,000)');
  checks.force = ok(F, 47000, 400);
  // p.338: D = 8.65 mm → M10
  const sel = f.selectMoldScrew(F);
  console.log(sel.report, '(libro 8.65 → M10)');
  checks.dmin = ok(sel.dMinMm, 8.65, 0.08);
  checks.m10 = sel.din912 === 'M10';
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
