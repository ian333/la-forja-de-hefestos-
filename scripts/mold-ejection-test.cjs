// TEST Kazmer cap 11 — cup 1,800 N; bezel 4,700 N y pines (p.267-272).
(async () => {
  const path = require('path');
  const ej = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'ejection.ts'));
  const { ABS_EJECT } = ej;
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};
  // cup (p.267): A=526mm², draft 1° → ≈1,800 N
  const fCup = ej.ejectionForce(ABS_EJECT, 1, 526e-6);
  console.log('F cup:', fCup.toFixed(0), 'N (libro ~1800)');
  checks.cup = ok(fCup, 1800, 60);
  // bezel (p.268): A_eff Eq 11.8 = 1.3e-3 m² → ≈4,700 N
  const aEff = ej.effectiveArea({ h: 0.0015, L: 0.24, W: 0.16, nWalls: 4, hWall: 0.01, nRibs: 7, tRib: 0.001, hRib: 0.01 });
  console.log('A_eff:', (aEff * 1e6).toFixed(0), 'mm² (libro 1300)');
  checks.aeff = ok(aEff, 1.33e-3, 0.005e-3);  // la suma exacta da 1.33e-3; el libro redondea a 1.3
  const fBez = ej.ejectionForce(ABS_EJECT, 1, aEff);
  console.log('F bezel:', fBez.toFixed(0), 'N (libro ~4700)');
  checks.bezel = ok(fBez, 4700, 150);
  // pines (p.270-271): 20 pines → compresión D≥0.8mm, cortante D≥2.23mm (gobierna)
  const pins = ej.ejectorPinSizing(ABS_EJECT, 4700, 20, 0.0015);
  console.log('pines: comp', pins.dMinCompressionMm.toFixed(2), '(0.8) | shear', pins.dMinShearMm.toFixed(2), '(2.23) | área', pins.pushAreaMm2.toFixed(1), 'mm² (10.4)');
  checks.dComp = ok(pins.dMinCompressionMm, 0.8, 0.05);
  checks.dShear = ok(pins.dMinShearMm, 2.23, 0.06);
  checks.area = ok(pins.pushAreaMm2, 10.4, 0.3);
  checks.governa = ok(pins.dMinMm, pins.dMinShearMm, 1e-9);
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
