// TEST del costeo DETALLADO (Kazmer §3.3) — reproduce el EJEMPLO del laptop
// bezel del libro al decimal: material $435, maquinado 258h/$25,800,
// acabado 34h/$1,700, base 538kg/$3,700, total ≈ $74,800. Puro.
(async () => {
  const path = require('path');
  const mc = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldcost-detailed.ts'));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const checks = {};

  // ── datos EXACTOS del bezel (Tabla 3.2) ──
  const inp = {
    part: { LpartMm: 240, WpartMm: 160, HpartMm: 10, ApartSurfaceMm2: 45700, VpartMm3: 27500, wallMm: 1.5 },
    metalKey: 'D2', nCavities: 1,
    machiningFactor: mc.MACHINING_FACTOR.edm,        // 4 (costillas por EDM)
    machiningRateUSDh: 100,
    finishAreas: [{ spi: 'SPI B-3', areaMm2: 45700 - 10000 }, { spi: 'SPI A-1', areaMm2: 10000 }],
    finishRateUSDh: 50,
    moldSteel: 'AISI P20',                           // DME #3 = 5.25 $/kg
    custom: {
      feed: ['hot-thermal'],                         // 0.4 / 2.0
      cooling: ['circuito'],                         // 0.15 / 0.4
      ejector: ['mixto'],                            // 0.2 / 0.2
      structural: ['pilares-interlocks', 'escalonada'], // (0.1+0.2)/(0.2+0.0) = 0.3/0.2
      misc: ['sensor-temp', 'sensor-presion'],       // (0.05+0.05)/(0.1+0.1) = 0.1/0.2
    },
  };
  const b = mc.estimateMoldCost(inp);
  console.log(mc.quoteReport(inp, b).join('\n'));

  // ── §3.3.1.2 dimensiones y material (Eq 3.5-3.7) ──
  checks.Lcav = near(b.cavity.LmM, 0.264, 1e-4);     // 0.24 + 0.024 (el libro escribe 0.268, errata)
  checks.Wcav = near(b.cavity.WmM, 0.176, 1e-4);
  checks.Hcav = near(b.cavity.HmM, 0.057, 1e-4);
  checks.volumen = near(b.cavity.volM3, 2.65e-3, 5e-6);
  checks.material = near(b.cavity.materialUSD, 435, 3);

  // ── maquinado (Eq 3.8-3.12) ──
  checks.tVol = near(b.cavity.tVolH, 3.78, 0.02);
  checks.tArea = near(b.cavity.tAreaH, 2.69, 0.02);
  checks.complejidad = near(b.cavity.complexity, 2.5, 0.02);
  checks.tMachining = near(b.cavity.tMachiningH, 258, 1);
  checks.machining = near(b.cavity.machiningUSD, 25800, 60);

  // ── acabado (Eq 3.13-3.14) ──
  checks.tFinish = near(b.cavity.tFinishH, 34, 0.5);
  checks.finishing = near(b.cavity.finishingUSD, 1700, 20);
  checks.setUSD = near(b.cavity.setUSD, 27900, 100);
  checks.cavitiesUSD = near(b.cavitiesUSD, 27900, 100);

  // ── mold base (Eq 3.14-3.17) ──
  checks.moldMass = near(b.moldBase.massKg, 538, 3);
  checks.moldBaseUSD = near(b.moldBase.USD, 3700, 60);

  // ── customización (Eq 3.18) ──
  checks.sumCavity = near(b.customization.sumCavity, 1.15, 1e-9);
  checks.sumMold = near(b.customization.sumMold, 3.0, 1e-9);
  checks.customUSD = near(b.customization.USD, 43200, 200);

  // ── total del molde ──
  checks.total = near(b.totalUSD, 74800, 200);
  console.log('total:', Math.round(b.totalUSD), '(libro $74,800)');

  // ── invariantes de las tablas ──
  checks.descuentos = mc.cavityDiscount(1) === 1 && mc.cavityDiscount(2) === 0.85 &&
    mc.cavityDiscount(4) === 0.72 && mc.cavityDiscount(8) === 0.61 && mc.cavityDiscount(16) === 0.52 && mc.cavityDiscount(32) === 0.52;
  checks.finishRates = mc.FINISH_RATE['SPI B-3'] === 0.0025 && mc.FINISH_RATE['SPI A-1'] === 0.0005 && mc.FINISH_RATE['SPI D-3'] === 0.02;
  checks.steelCoef = mc.MOLD_STEEL_COEF['AISI P20'] === 5.25 && mc.MOLD_STEEL_COEF['SAE 1030'] === 3.55;
  checks.customTables = mc.CUSTOM_FACTORS.feed['hot-valve'][1] === 4.0 && mc.CUSTOM_FACTORS.misc['2-shot'][0] === 2.0 && mc.CUSTOM_FACTORS.ejector['core-pull'][1] === 0.5;

  // ── un MOLDE MÁS BARATO (cold 2-placas, P20, 2 cav) cuesta menos que el bezel hot ──
  const barato = mc.estimateMoldCost({ ...inp, metalKey: 'P20', nCavities: 2, machiningFactor: mc.MACHINING_FACTOR.fresado,
    custom: { feed: ['cold-2placas'], cooling: ['recto-oring'], ejector: ['pines'], structural: ['pilares'], misc: [] } });
  checks.coldMasBarato = barato.totalUSD < b.totalUSD;
  console.log('cold 2-placas P20 ×2:', Math.round(barato.totalUSD), '(< bezel hot ✓)');

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
