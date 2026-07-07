// TEST enfriamiento de cores esbeltos (Kazmer §9.3.5, Tabla 9.3). Puro.
(async () => {
  const path = require('path');
  const sc = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'slendercore.ts'));
  const checks = {};

  // Tabla 9.3: método por Ø de core
  const cup = sc.chooseSlenderCoreCooling(60, 58);   // core del cup, Fig 9.21 → baffle
  console.log('core 60mm:', JSON.stringify({ m: cup.method, hole: cup.holeDiaMm, axial: cup.needsAxial, LD: cup.slenderness }));
  checks.baffle60 = cup.method === 'baffle';
  checks.holeEnRango = cup.holeDiaMm >= 6 && cup.holeDiaMm <= 25;   // baffle 6-25mm

  checks.insertoGrande = sc.chooseSlenderCoreCooling(90, 200).method === 'inserto';   // >75mm
  checks.baffleMedio = sc.chooseSlenderCoreCooling(20, 120).method === 'baffle';      // 12-75
  checks.bubblerChico = sc.chooseSlenderCoreCooling(8, 60).method === 'bubbler';       // 6-30, <12
  checks.heatpipe = sc.chooseSlenderCoreCooling(5.5, 40).method === 'heat-pipe';       // 5-6
  checks.pinFino = sc.chooseSlenderCoreCooling(4, 30).method === 'pin-conductivo';     // <5

  // core esbelto (L/Ø=10) → necesita canal axial; no esbelto → no
  checks.esbelto = sc.chooseSlenderCoreCooling(15, 150).needsAxial === true;           // L/Ø=10
  const gordo = sc.chooseSlenderCoreCooling(60, 60);
  checks.noEsbelto = gordo.needsAxial === false && gordo.notas.some((n) => n.includes('no es esbelto'));

  // Ø de barreno respeta ⅔·Ø_core (pared por §12.3.2) — para 12mm baffle no rebasa 8mm
  const chico = sc.chooseSlenderCoreCooling(12, 100);
  checks.paredRespetada = chico.holeDiaMm <= (2 / 3) * 12 + 0.01;

  // baffle es estándar (no custom), inserto es custom
  checks.baffleEstandar = cup.option.estandar === true;
  checks.insertoCustom = sc.chooseSlenderCoreCooling(90, 200).option.estandar === false;

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
