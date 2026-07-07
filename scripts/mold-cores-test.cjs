// TEST del análisis de CORES (Kazmer §12.3) — reproduce los 3 ejemplos del cup
// del libro (axial 216 MPa, hoop 240 MPa, deflexión 0.03mm) al decimal. Puro.
(async () => {
  const path = require('path');
  const co = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'cores.ts'));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const checks = {};

  // ── §12.3.1 AXIAL (p.327): P=80, φ_top=63, φ_ext=63, φ_int=50 → 216 MPa ──
  const sAx = co.axialStress(80, 63, 63, 50);
  console.log('axial σ:', sAx.toFixed(1), 'MPa (libro 216)');
  checks.axial216 = near(sAx, 216, 1);
  const eAx = sAx / 205000;                                  // ε = σ/E
  console.log('axial ε:', (eAx * 100).toFixed(2), '% (libro 0.11)');
  checks.strain011 = near(eAx * 100, 0.11, 0.01);
  const dAx = co.axialDeflectionMm(sAx, 58, 205e9);          // δ = ε·H
  console.log('axial δ:', dAx.toFixed(3), 'mm (libro 0.06)');
  checks.deflAx006 = near(dAx, 0.061, 0.005);

  // ── §12.3.2 HOOP (p.328): P=80, φ=60, h=10 → 240 MPa ──
  const sH = co.hoopStress(80, 60, 10);
  console.log('hoop σ:', sH.toFixed(0), 'MPa (libro 240)');
  checks.hoop240 = near(sH, 240, 0.5);
  // QC7: fatiga 166 → φ_int < 31mm ; sobrepresión 200 con yield 545 → 38mm
  const innerFat = co.maxInnerDiameter(60, 80, 166);
  const innerYld = co.maxInnerDiameter(60, 200, 545);
  console.log('Ø_int máx: fatiga', innerFat.toFixed(0), '(31) · sobrepresión', innerYld.toFixed(0), '(38)');
  checks.inner31 = near(innerFat, 31, 0.6);
  checks.inner38 = near(innerYld, 38, 0.6);
  checks.fatigaGobierna = innerFat < innerYld;               // fatiga es lo crítico (libro)
  // guideline P20 @150MPa: h > φ/6
  const hP20 = co.minWallThickness(150, 60, 456);
  checks.guidelineP20 = near(hP20, 60 / 6, 0.6);             // ≈ φ/6 = 10mm

  // ── §12.3.3 DEFLEXIÓN (p.329): φ_ext=60, φ_int=40, H=58, ΔP=40 → I 5.1e-7, δ 0.03 ──
  const I = co.coreInertiaM4(60, 40);
  console.log('I:', I.toExponential(2), 'm⁴ (libro 5.1e-7)');
  checks.inertia = near(I, 5.1e-7, 0.05e-7);
  const dB = co.coreBendingMm({ dPMPa: 40, phiOuterMm: 60, phiInnerMm: 40, heightMm: 58, eSteelPa: 205e9 });
  console.log('δ flexión:', dB.toFixed(3), 'mm (libro 0.03)');
  checks.defl003 = near(dB, 0.032, 0.004);
  // interlock baja a ~10%
  const dBi = co.coreBendingMm({ dPMPa: 40, phiOuterMm: 60, phiInnerMm: 40, heightMm: 58, eSteelPa: 205e9, interlocked: true });
  checks.interlock10 = near(dBi, dB * 0.1, 1e-6);

  // ── RESOLVEDOR completo: cup core en QC7, avisa que fatiga limita el Ø interno ──
  const d = co.designCore({ meltPressureMPa: 80, phiOuterMm: 60, phiInnerMm: 40, heightMm: 58, phiTopMm: 63, metalKey: 'Al QC-7' });
  console.log('DISEÑO cup/QC7:', JSON.stringify({ hoop: d.hoop.sigmaMPa, innerMax: d.innerMaxMm.gobierna, gov: d.innerMaxMm.govBy, axial: d.axial.sigmaMPa, δflex: d.bending.deflMm, ok: d.ok }));
  checks.resolvHoop = near(d.hoop.sigmaMPa, 240, 1);
  checks.resolvInner31 = near(d.innerMaxMm.gobierna, 31, 1) && d.innerMaxMm.govBy === 'fatiga';

  // ── core ESBELTO (L/Ø=10) → avisa interlock ──
  const slim = co.designCore({ meltPressureMPa: 100, phiOuterMm: 20, phiInnerMm: 0, heightMm: 200, metalKey: 'P20' });
  checks.esbeltoAvisa = slim.bending.slenderness >= 5 && slim.notas.some((n) => n.includes('ESBELTO'));

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
