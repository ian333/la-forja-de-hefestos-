// TEST tipos de expulsor (Kazmer §11.3.2-5) — blade del bezel 93mm + undercut de
// la tapa 1200N/1.7MPa, ejemplos del libro al decimal. Puro.
(async () => {
  const path = require('path');
  const et = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'ejectortypes.ts'));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const checks = {};

  // ── §11.3.2 BLADE (p.281): bezel 4700N/20 blades = 235N; W=6, H=1, E=200GPa → L_máx 93mm ──
  const Lmax = et.bladeMaxLengthMm(235, 6, 1, 200e9);
  console.log('blade L_máx:', Lmax.toFixed(1), 'mm (libro 93)');
  checks.blade93 = near(Lmax, 93, 1);
  const bl = et.checkEjectorBlade({ fEjectN: 4700, nBlades: 20, widthMm: 6, thickMm: 1, actualLenMm: 93.8, ePa: 200e9 });
  console.log('blade check:', JSON.stringify({ fPer: bl.fPerBladeN, max: bl.maxLenMm, ok: bl.ok }));
  checks.bladeMarginal = bl.fPerBladeN === 235 && bl.ok === false;   // 93.8 > 93.2 → marginal, avisa

  // ── §11.3.5 UNDERCUT tapa (p.286): δ=1mm, L=77mm → ε 1.3%; A_eff 80mm², μ0.5, φ0 → F 1200N; τ 1.7MPa ──
  const ABS = { E: 2.3e9, cte: 8.83e-5, tSolid: 132, tEject: 97, mu: 0.5, sigmaYield: 44e6, rho: 1050 };
  const eps = et.undercutStrain(1, 77);
  console.log('undercut ε:', (eps * 100).toFixed(1), '% (libro 1.3)');
  checks.strain13 = near(eps * 100, 1.3, 0.05);
  const f = et.undercutEjectForceN(ABS, { deltaMm: 1, lMm: 77, aEffM2: 80e-6, draftDeg: 0 });
  console.log('undercut F:', f.toFixed(0), 'N (libro 1200)');
  checks.force1200 = near(f, 1200, 15);
  const tau = et.undercutShearMPa(f, 77, 3);
  console.log('undercut τ:', tau.toFixed(2), 'MPa (libro 1.7)');
  checks.shear17 = near(tau, 1.7, 0.1);

  const chk = et.checkUndercut(ABS, { deltaMm: 1, lMm: 77, aEffM2: 80e-6, phiMm: 77, hMm: 3, draftDeg: 0 });
  console.log('undercut check:', JSON.stringify({ εpct: chk.strainPct, ok: chk.ok, τ: chk.shearMPa }));
  checks.undercutOk = chk.ok === true && chk.shearOk === true;       // 1.3%<2% y 1.7<22 → elástico OK
  // undercut GRANDE (δ=3mm/L=30mm → 10% > 2%) → NO elástico, avisa slide/collapsible
  const big = et.checkUndercut(ABS, { deltaMm: 3, lMm: 30, aEffM2: 80e-6, phiMm: 77, hMm: 3 });
  checks.undercutBigNo = big.strainOk === false && big.nota.includes('collapsible');

  // ── selector de tipo de expulsor por geometría ──
  checks.selRib = et.chooseEjectorType({ rib: true }).type === 'blade';
  checks.selBoss = et.chooseEjectorType({ boss: true }).type === 'sleeve';
  checks.selPeri = et.chooseEjectorType({ fullPerimeter: true }).type === 'stripper';
  checks.selFlat = et.chooseEjectorType({}).type === 'pin';

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
