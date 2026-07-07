// TEST del TAMAÑO DE MÁQUINA (Kazmer §4.3.3 + cap 5 + cap 11) — reproduce el
// cup (400 kN) y el bezel (1400 kN) del libro y verifica la selección. Puro.
(async () => {
  const path = require('path');
  const ms = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'machinesizing.ts'));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const checks = {};

  // ── BEZEL: A_proy 0.24×0.16 = 0.0384 m², P_cav 36.46 MPa → clamp 1400 kN (libro p.269) ──
  const bez = ms.machineRequirements({
    projectedAreaM2: 0.0384, cavityPressureMPa: 36.46,
    partVolumeCc: 200, nCav: 1, runnerVolumeCc: 15,
    fillPressureMPa: 100, ejectionForceN: 4700, clampSF: 1.0,   // SF=1 para comparar con el libro
  });
  console.log('BEZEL:', JSON.stringify({ clampKN: bez.clampKN.toFixed(0), tons: bez.clampNeedTons.toFixed(1), ejectKN: bez.ejectionNeedKN, ejectPct: bez.ejectPctOfClamp.toFixed(2) }));
  checks.bezClamp1400 = near(bez.clampKN, 1400, 15);            // = 1400 kN del libro
  checks.bezTons143 = near(bez.clampNeedTons, 142.8, 1);        // ≈ 143 t métricas
  checks.bezEjectPct = bez.ejectPctOfClamp > 0.2 && bez.ejectPctOfClamp < 0.6;  // "orden de 0.5%" (libro)

  // ── CUP: A_proy 0.008 m², P_cav 50 MPa → clamp 400 kN (libro p.269) ──
  const cup = ms.machineRequirements({
    projectedAreaM2: 0.008, cavityPressureMPa: 50,
    partVolumeCc: 25, nCav: 1, fillPressureMPa: 80, ejectionForceN: 1800, clampSF: 1.0,
  });
  console.log('CUP:', JSON.stringify({ clampKN: cup.clampKN.toFixed(0), tons: cup.clampNeedTons.toFixed(1), ejectPct: cup.ejectPctOfClamp.toFixed(2) }));
  checks.cupClamp400 = near(cup.clampKN, 400, 6);               // = 400 kN del libro
  checks.cupTons41 = near(cup.clampNeedTons, 40.8, 0.5);

  // ── SELECCIÓN bezel (con SF 1.1 → ~157 t): IM-150 no da clamp → IM-250 ──
  const bezReq = ms.machineRequirements({
    projectedAreaM2: 0.0384, cavityPressureMPa: 36.46,
    partVolumeCc: 200, nCav: 1, runnerVolumeCc: 15, fillPressureMPa: 100, ejectionForceN: 4700,
  });
  const bezSel = ms.selectInjectionMachine(bezReq, { wmm: 300, lmm: 300, stackMm: 400 });
  console.log('SEL bezel:', JSON.stringify({ maq: bezSel.machine?.name, ok: bezSel.ok, shot: bezSel.shotPct, clampUtil: bezSel.clampUtilPct }));
  checks.bezPicksIM250 = bezSel.ok && bezSel.machine.name === 'IM-250';
  checks.bezShotVentana = bezSel.shotPct >= 25 && bezSel.shotPct <= 50;   // §4.3.3
  checks.bezSaltaIM150 = bezReq.clampNeedTons > 150;           // IM-150 (150t) no alcanza el clamp

  // ── SELECCIÓN cup (~45 t): la MÍNIMA IM-50 la aguanta ──
  const cupReq = ms.machineRequirements({
    projectedAreaM2: 0.008, cavityPressureMPa: 50, partVolumeCc: 25, nCav: 1, fillPressureMPa: 80, ejectionForceN: 1800,
  });
  const cupSel = ms.selectInjectionMachine(cupReq, { wmm: 196, lmm: 196, stackMm: 250 });
  console.log('SEL cup:', JSON.stringify({ maq: cupSel.machine?.name, ok: cupSel.ok, shot: cupSel.shotPct, clampUtil: cupSel.clampUtilPct }));
  checks.cupPicksIM50 = cupSel.ok && cupSel.machine.name === 'IM-50';
  checks.cupExpulsionOk = cupSel.checks.expulsion === true;    // 9.8 kN provista >> 1.8 kN

  // ── DIAGNÓSTICO: pieza gigantesca (clamp > 500 t) → ninguna calza, avisa dividir ──
  const huge = ms.machineRequirements({
    projectedAreaM2: 0.05, cavityPressureMPa: 120, partVolumeCc: 300, nCav: 4, fillPressureMPa: 150, ejectionForceN: 20000,
  });
  const hugeSel = ms.selectInjectionMachine(huge, { wmm: 500, lmm: 500, stackMm: 500 });
  console.log('SEL gigante:', JSON.stringify({ ok: hugeSel.ok, gob: hugeSel.governs, issue: hugeSel.issues[0]?.slice(0, 50) }));
  checks.hugeNoFit = hugeSel.ok === false && hugeSel.governs === 'cierre';
  checks.hugeAvisa = hugeSel.issues.some((i) => i.includes('2 moldes') || i.includes('clamp'));

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
