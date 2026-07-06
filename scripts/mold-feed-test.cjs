// TEST Kazmer cap 6 — hot runner del laptop bezel (p.139-144).
(async () => {
  const path = require('path');
  const feed = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'feed.ts'));
  const ABS = { k: 17000, n: 0.35, kappa: 0.19, tMelt: 239, tWall: 60 };  // el cap 6 usa k=17,000 n=0.35
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};
  const sprue = { name: 'sprue', L: 0.09, R: 0.006, Vdot: 125e-6 };
  const manifold = { name: 'manifold', L: 0.118, R: 0.005, Vdot: 62.5e-6, count: 2 };
  const nozzle = { name: 'nozzle', L: 0.108, R: 0.0035, Vdot: 62.5e-6, count: 2 };
  // p.140: 5.9 + 8.8 + 16.7 = 31.4 MPa
  const dpS = feed.pressureDropRunner(ABS, sprue) / 1e6;
  const dpM = feed.pressureDropRunner(ABS, manifold) / 1e6;
  const dpN = feed.pressureDropRunner(ABS, nozzle) / 1e6;
  console.log('ΔP sprue/manifold/nozzle:', dpS.toFixed(1), dpM.toFixed(1), dpN.toFixed(1), '(libro 5.9/8.8/16.7)');
  checks.sprue = ok(dpS, 5.9, 0.1); checks.manifold = ok(dpM, 8.8, 0.1); checks.nozzle = ok(dpN, 16.7, 0.15);
  const total = feed.feedPressureDrop(ABS, [sprue, manifold, nozzle]) / 1e6;
  checks.total = ok(total, 31.4, 0.3);
  // p.141: volumen = 37 cc (1 sprue + 2 manifold + 2 nozzle)
  const vol = feed.feedVolume([{ ...sprue, count: 1 }, manifold, nozzle]) * 1e6;
  console.log('V feed:', vol.toFixed(1), 'cc (libro 37)');
  checks.vol = ok(vol, 37, 1);
  // p.143-144: optimización a 30 MPa → R sprue 5.0mm, manifold 4.4, nozzle 4.4
  const opt = feed.optimizeFeedSystem(ABS, [
    { name: 'sprue', L: 0.09, Vdot: 125e-6 }, { name: 'manifold', L: 0.118, Vdot: 62.5e-6 },
    { name: 'nozzle', L: 0.108, Vdot: 62.5e-6 }], 30e6);
  const rs = opt.map((o) => (o.R * 1000).toFixed(2));
  console.log('R optimizados:', rs.join('/'), 'mm (libro 5.0/4.4/4.4)');
  checks.optS = ok(opt[0].R * 1000, 5.0, 0.1);
  checks.optM = ok(opt[1].R * 1000, 4.4, 0.1);
  checks.optN = ok(opt[2].R * 1000, 4.4, 0.1);
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
