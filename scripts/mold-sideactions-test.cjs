// TEST Kazmer §11.3.6-8 — core pull y slide del bezel (p.289-293).
(async () => {
  const path = require('path');
  const sa = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'sideactions.ts'));
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};
  // p.289: 200 MPa × 220 mm² = 44,000 N
  const F = sa.corePullForce(200e6, 220e-6);
  console.log('F core pull:', F.toFixed(0), 'N (libro 44,000)');
  checks.force = ok(F, 44000, 1);
  // p.291: bore = √(4·44000/(π·10e6)) = 75 mm → estándar 82.55 (3.25")
  const bore = sa.hydraulicBore(44000, 10e6) * 1000;
  console.log('bore:', bore.toFixed(1), 'mm (libro 75) → std', sa.pickStdBore(bore));
  checks.bore = ok(bore, 74.9, 0.5);
  checks.std = sa.pickStdBore(bore) === 82.55;
  // p.293: carrera 12 mm a 20° → contacto 35 mm, total ~60
  const pin = sa.anglePinDesign(12, 20, 25);
  console.log('angle pin: contacto', pin.contactLenMm.toFixed(1), 'mm (libro 35) · total', pin.totalLenMm.toFixed(0), '(~60)');
  checks.pin35 = ok(pin.contactLenMm, 35.1, 0.3);
  checks.pin60 = ok(pin.totalLenMm, 60, 1);
  // decisor: carrera 12 → slide; carrera 40 → core pull
  checks.decide1 = sa.sideActionDesign({ aProjMm2: 220, pMeltMPa: 200, strokeMm: 12 }).type === 'slide';
  const cp = sa.sideActionDesign({ aProjMm2: 220, pMeltMPa: 200, strokeMm: 40 });
  console.log(cp.report.join(' | '));
  checks.decide2 = cp.type === 'core-pull' && cp.stdBoreMm === 82.55;
  // resortes: 100mm libre, ⌀20 → máx 40mm de compresión, soporte si >80
  const sp = sa.springReturnCheck(100, 20, 35);
  checks.spring = sp.ok && sp.needsSupportPin && ok(sp.maxCompressMm, 40, 0.1);
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
