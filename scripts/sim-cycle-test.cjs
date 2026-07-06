// TEST del motor del ciclo — contra los números YA validados (cup Kazmer).
(async () => {
  const path = require('path');
  const eng = await import(path.resolve(__dirname, '..', 'src', 'forja', 'sim', 'cycle-engine.ts'));
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};
  const sim = eng.createCycleSim({
    flowLenM: 0.1, wallM: 0.003, vMeanMs: 0.35, projAreaM2: Math.PI * 0.03 * 0.03,
    clampTons: 45, bendSpanM: 0.16, bendWM: 0.2, bendHM: 0.1, tCoolS: 18.91,
  });
  let maxP = 0, maxF = 0, sawFlashFalse = true, phases = new Set(), st;
  for (let i = 0; i < 2600; i++) {
    st = sim.step(0.01);
    phases.add(st.phase);
    if (st.pressureMPa > maxP) maxP = st.pressureMPa;
    if (st.openForceTons > maxF) maxF = st.openForceTons;
    if (st.flash) sawFlashFalse = false;
  }
  console.log('fases:', [...phases].join(','));
  console.log('P máx:', maxP.toFixed(1), 'MPa · F apertura máx:', maxF.toFixed(1), 'ton · margen clamp:', (45 - maxF).toFixed(1));
  checks.fases = phases.size === 8;
  checks.p = maxP > 5 && maxP < 120;                       // orden de magnitud físico
  checks.margen = maxF < 45;                               // el clamp aguanta (sin flash)
  checks.noflash = sawFlashFalse;
  // térmico: tras un ciclo, el acero cerca de la cavidad se calentó pero <90°C (effusividad)
  const st2 = sim.step(0.01);
  console.log('acero máx:', st2.steelMaxC.toFixed(1), '°C · T̄ plástico:', st2.meltTempC.toFixed(0), '· agua out:', st2.waterOutC.toFixed(1));
  checks.effusividad = st2.steelMaxC < 95;
  checks.aguaCaliente = st2.waterOutC >= 60;
  // textura de la sección viva
  const tex = sim.thermalTexture();
  checks.textura = tex.data.length === tex.w * tex.h * 4;
  // ESTABILIDAD con dt de browser (30fps → dt 0.033 > dtTherm): el FDM no debe divergir
  const simB = eng.createCycleSim({
    flowLenM: 0.1, wallM: 0.003, vMeanMs: 0.35, projAreaM2: Math.PI * 0.03 * 0.03,
    clampTons: 45, bendSpanM: 0.16, bendWM: 0.2, bendHM: 0.1, tCoolS: 18.91,
  });
  let sB;
  for (let i = 0; i < 780; i++) sB = simB.step(1 / 30);            // un ciclo completo a 30fps
  console.log('estabilidad 30fps → acero máx:', sB.steelMaxC.toFixed(1), '°C · T̄ plástico:', sB.meltTempC.toFixed(0));
  checks.estable30fps = Number.isFinite(sB.steelMaxC) && sB.steelMaxC < 120 && sB.meltTempC >= 0 && sB.meltTempC < 300;

  // clamp INSUFICIENTE → FLASH detectado (la verificación del simulador)
  const sim2 = eng.createCycleSim({
    flowLenM: 0.2, wallM: 0.0015, vMeanMs: 0.8, projAreaM2: 9724e-6,
    clampTons: 20, bendSpanM: 0.2159, bendWM: 0.248, bendHM: 0.06, tCoolS: 4.7,  // placa DELGADA 60mm
  });
  let flash2 = false;
  for (let i = 0; i < 800; i++) { const s2 = sim2.step(0.01); if (s2.flash) flash2 = true; }
  console.log('caso placa delgada → FLASH detectado:', flash2);
  checks.flashDetect = flash2;
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
