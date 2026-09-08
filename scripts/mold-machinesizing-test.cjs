// TEST del TAMAÑO DE MÁQUINA (Kazmer §4.3.3 + cap 5 + cap 11) — reproduce el
// cup (400 kN) y el bezel (1400 kN) del libro y verifica la selección. Puro.
// 2026-09-08: LA MÁQUINA DEL TALLER (FCS HT-150SV) se evalúa PRIMERO; los ejercicios del
// libro se corren contra el catálogo de MERCADO (taller = null) para que sigan siendo del libro.
(async () => {
  const path = require('path');
  const ms = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'machinesizing.ts'));
  const tp = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'threeplate.ts'));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const checks = {};
  const MERCADO = ms.INJECTION_MACHINES, SIN_TALLER = null;

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

  // ── SELECCIÓN bezel (con SF 1.1 → ~157 t): IM-150 no da clamp → IM-250 (MERCADO) ──
  const bezReq = ms.machineRequirements({
    projectedAreaM2: 0.0384, cavityPressureMPa: 36.46,
    partVolumeCc: 200, nCav: 1, runnerVolumeCc: 15, fillPressureMPa: 100, ejectionForceN: 4700,
  });
  const bezMold = { wmm: 300, lmm: 300, stackMm: 400, openStrokeMm: 25 };
  const bezSel = ms.selectInjectionMachine(bezReq, bezMold, MERCADO, SIN_TALLER);
  console.log('SEL bezel (mercado):', JSON.stringify({ maq: bezSel.machine?.name, ok: bezSel.ok, shot: bezSel.shotPct, clampUtil: bezSel.clampUtilPct }));
  checks.bezPicksIM250 = bezSel.ok && bezSel.machine.name === 'IM-250';
  checks.bezShotVentana = bezSel.shotPct >= 25 && bezSel.shotPct <= 50;   // §4.3.3
  checks.bezSaltaIM150 = bezReq.clampNeedTons > 150;           // IM-150 (150t) no alcanza el clamp

  // ── SELECCIÓN bezel con LA DEL TALLER: 157 t > 150 t → NO cabe en la HT-150SV, dice por qué, cae al mercado ──
  const bezTaller = ms.selectInjectionMachine(bezReq, bezMold);
  console.log('SEL bezel (taller):', JSON.stringify({ maq: bezTaller.machine?.name, ok: bezTaller.ok, taller: bezTaller.taller, issue0: bezTaller.issues[0] }));
  checks.bezTallerNoCabe = bezTaller.taller && bezTaller.taller.ok === false && bezTaller.taller.machine.name === ms.MAQUINA_DEL_TALLER.name;
  checks.bezTallerDiceClamp = bezTaller.taller && bezTaller.taller.issues.some((i) => /clamp .* t > 150 t/.test(i));
  checks.bezTallerCaeAlMercado = bezTaller.ok && bezTaller.machine.name === 'IM-250' && bezTaller.issues.some((i) => i.includes('no cabe en la FCS HT-150SV (taller)'));

  // ── SELECCIÓN cup (~45 t): la MÍNIMA del MERCADO IM-50 la aguanta ──
  const cupReq = ms.machineRequirements({
    projectedAreaM2: 0.008, cavityPressureMPa: 50, partVolumeCc: 25, nCav: 1, fillPressureMPa: 80, ejectionForceN: 1800,
  });
  const cupMold = { wmm: 196, lmm: 196, stackMm: 250, openStrokeMm: 100 };
  const cupSel = ms.selectInjectionMachine(cupReq, cupMold, MERCADO, SIN_TALLER);
  console.log('SEL cup (mercado):', JSON.stringify({ maq: cupSel.machine?.name, ok: cupSel.ok, shot: cupSel.shotPct, clampUtil: cupSel.clampUtilPct }));
  checks.cupPicksIM50 = cupSel.ok && cupSel.machine.name === 'IM-50';
  checks.cupExpulsionOk = cupSel.checks.expulsion === true;    // 9.8 kN provista >> 1.8 kN

  // ── SELECCIÓN cup con LA DEL TALLER: cabe (45 t < 150 t) → ES la máquina, aunque el shot sea 8 % (aviso, no fallo) ──
  const cupTaller = ms.selectInjectionMachine(cupReq, cupMold);
  console.log('SEL cup (taller):', JSON.stringify({ maq: cupTaller.machine?.name, ok: cupTaller.ok, shot: cupTaller.shotPct, clampUtil: cupTaller.clampUtilPct, issues: cupTaller.issues }));
  checks.cupTallerEsLaFCS = cupTaller.ok && cupTaller.machine.name === ms.MAQUINA_DEL_TALLER.name && cupTaller.taller?.ok === true;
  checks.cupTallerShot8 = near(cupTaller.shotPct, 100 * 25 / 304, 0.2) && cupTaller.issues.some((i) => i.includes('< 25%'));
  checks.cupTallerApertura = cupTaller.apertura.holguraMm === +(1010 - tp.daylightNeededMm(250, 100)).toFixed(1);

  // ── LA MÁQUINA DEL TALLER: cifras = catálogo FCS (docs/MAQUINA-DEL-TALLER.md) ──
  const T = ms.MAQUINA_DEL_TALLER;
  checks.tallerCifras = T.clampTons === 150 && T.shotCc === 304 && near(T.maxInjPressureMPa, 178.7, 0.1) && T.tieHmm === 462 && T.tieVmm === 462
    && T.minDaylightMm === 130 && T.maxDaylightMm === 1010 && near(T.ejectionForceKN, 39.2, 0.1) && T.nozzleOrificeMm === undefined && T.plasticizeGs === undefined;

  // ── DIAGNÓSTICO: pieza gigantesca (clamp > 500 t) → ninguna calza, avisa dividir ──
  const huge = ms.machineRequirements({
    projectedAreaM2: 0.05, cavityPressureMPa: 120, partVolumeCc: 300, nCav: 4, fillPressureMPa: 150, ejectionForceN: 20000,
  });
  const hugeSel = ms.selectInjectionMachine(huge, { wmm: 500, lmm: 500, stackMm: 500, openStrokeMm: 150 });
  console.log('SEL gigante:', JSON.stringify({ ok: hugeSel.ok, gob: hugeSel.governs, issue: hugeSel.issues[0]?.slice(0, 50), taller: hugeSel.taller?.ok }));
  checks.hugeNoFit = hugeSel.ok === false && hugeSel.governs === 'cierre';
  checks.hugeAvisa = hugeSel.issues.some((i) => i.includes('2 moldes') || i.includes('clamp'));
  checks.hugeTallerNo = hugeSel.taller?.ok === false;

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
