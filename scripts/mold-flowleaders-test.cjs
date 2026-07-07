// TEST flow leaders (Kazmer §5.5.5) — reproduce el ejemplo del contenedor del
// libro (Fig 5.18): L_central 280, L_paredes 210, nominal 2mm → 1.5mm, v 75%. Puro.
(async () => {
  const path = require('path');
  const fl = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'flowleaders.ts'));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const checks = {};

  // Eq 5.34: H_paredes = 2mm · (210/280) = 1.5mm (misma viscosidad)
  const h = fl.flowLeaderThickness(2, 210, 280, 1);
  console.log('H_paredes:', h.toFixed(2), 'mm (libro 1.5)');
  checks.thick15 = near(h, 1.5, 0.01);
  // Eq 5.35: v_paredes = v_central · 210/280 = 75%
  const vr = fl.flowLeaderVelocityRatio(210, 280);
  console.log('v_paredes:', (vr * 100).toFixed(0), '% (libro 75)');
  checks.vel75 = near(vr, 0.75, 0.005);

  // resolvedor completo del contenedor (Fig 5.18): central 280 (ref) + paredes 210
  const d = fl.designFlowLeaders({ nominalMm: 2, regions: [
    { name: 'centro (280mm)', flowLenMm: 280 }, { name: 'paredes (210mm)', flowLenMm: 210 },
  ] });
  console.log('DISEÑO:', JSON.stringify({ ref: d.refName, regs: d.regions.map((r) => `${r.name.split(' ')[0]}:${r.thicknessMm}mm/${(r.velocityRatio * 100).toFixed(0)}%/${r.role}`) }));
  checks.refEsCentro = d.refName.includes('centro');                      // la más larga manda
  checks.paredesDeflector = d.regions.find((r) => r.name.includes('paredes')).role === 'deflector';  // 1.5<2 → más delgada
  checks.paredes15 = near(d.regions.find((r) => r.name.includes('paredes')).thicknessMm, 1.5, 0.01);
  checks.centroRef = d.regions.find((r) => r.name.includes('centro')).role === 'referencia';

  // región MÁS LARGA que la referencia sería un LEADER (más gruesa) — chequeo del rol
  const d2 = fl.designFlowLeaders({ nominalMm: 2, regions: [
    { name: 'corto', flowLenMm: 150 }, { name: 'largo', flowLenMm: 300 },
  ] });
  checks.cortoDeflector = d2.regions.find((r) => r.name === 'corto').role === 'deflector';  // 150/300 → 1mm

  // variación de espesor grande avisa (§2.3.1)
  const d3 = fl.designFlowLeaders({ nominalMm: 2, regions: [{ name: 'a', flowLenMm: 100 }, { name: 'b', flowLenMm: 300 }] });
  checks.avisaVariacion = d3.maxThicknessVarPct > 25 && d3.notas.length > 0;

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
