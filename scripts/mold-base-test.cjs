// TEST del mold base estándar (Kazmer cap 4 §4.2-4.4 + Apéndice B) — puro.
(async () => {
  const path = require('path');
  const mb = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldbase.ts'));
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};

  // ── Apéndice B transcrito FIEL: α ≈ k/(ρ·cp) debe cerrar para CADA metal ──
  // (si un número está mal copiado del libro, esta identidad lo delata)
  let alphaOK = true;
  for (const m of mb.MOLD_METALS) {
    if (m.key === 'Cu 940') continue;                      // cp estimado (fila ilegible del PDF)
    const alpha = m.kWmC / (m.rhoKgM3 * m.cpJkgC);
    if (Math.abs(alpha - m.alphaM2s) / m.alphaM2s > 0.06) { alphaOK = false; console.log('α inconsistente:', m.key, alpha, 'vs', m.alphaM2s); }
  }
  checks.apendiceB_consistente = alphaOK;
  const p20 = mb.metalByKey('P20');
  checks.p20_exacto = p20.fatigueLimitMPa === 456 && p20.kWmC === 32 && p20.brinell === 300 && p20.costKg === 15.1;
  checks.din_p20 = p20.din.includes('1.2311');

  // ── §4.2: el LIBRO dice — cup manda ESTRUCTURA, bezel manda REFRIGERACIÓN ──
  const cup = mb.sizeInserts({ Lmm: 60, Wmm: 60, depthMm: 70 });
  const bezel = mb.sizeInserts({ Lmm: 240, Wmm: 160, depthMm: 10 });
  console.log('cup:', cup.driver, 'cheek', cup.cheekMm, '· bezel:', bezel.driver, 'cheek', bezel.cheekMm.toFixed(1));
  checks.cup_estructural = cup.driver === 'estructural' && cup.cheekMm === 70;
  checks.bezel_refrigeracion = bezel.driver === 'refrigeración' && ok(bezel.cheekMm, 3 * 7.94, 0.01);
  checks.altura_redonda10 = cup.insertHcavityMm % 10 === 0 && cup.insertHcavityMm >= 70 + 3 * cup.coolingDiaMm;

  // ── §4.3: base estándar para el vaso ×4 (rejilla 2×2 — el 2×1 da aspecto
  //     2.15:1 y la regla §4.3.1 lo marca, correctamente) ──
  const sel = mb.selectMoldBase(cup, { nx: 2, ny: 2 });
  console.log('base vaso×4:', sel.base.wmm, '×', sel.base.lmm, '· envelope', sel.envelope.wmm, '×', sel.envelope.lmm, '· reserva', sel.reserveMm);
  const dosxuno = mb.selectMoldBase(cup, { nx: 2, ny: 1 });
  checks.aspecto_2x1_marcado = dosxuno.warnings.some((w) => w.includes('2:1'));
  checks.base_ok = sel.ok && sel.base.wmm >= sel.envelope.wmm + 2 * sel.reserveMm;
  checks.base_estandar = mb.STANDARD_BASES.some((b) => (b.wmm === sel.base.wmm && b.lmm === sel.base.lmm) || (b.wmm === sel.base.lmm && b.lmm === sel.base.wmm));
  // aspecto >2:1 detectado (línea de 8 cavidades = mal diseño §4.3.1)
  const linea = mb.selectMoldBase(cup, { nx: 8, ny: 1 });
  checks.aspecto_detecta = linea.warnings.some((w) => w.includes('2:1'));

  // ── §4.3.3: HM320 del libro (tie 800×630, daylight 350-800, 490 cc, 326 t) ──
  const hm = mb.MACHINES[0];
  checks.hm320_fiel = hm.tieHmm === 800 && hm.tieVmm === 630 && hm.minDaylightMm === 350 && hm.maxDaylightMm === 800 && hm.maxShotCc === 490 && hm.clampTons === 326;
  const okCase = mb.checkMachine({ wmm: 500, lmm: 400, stackMm: 450, shotCc: 180, clampNeedTons: 200 }, hm);
  checks.maquina_ok = okCase.ok && okCase.shotPct > 25 && okCase.shotPct < 51;
  const bad1 = mb.checkMachine({ wmm: 900, lmm: 400, stackMm: 450, shotCc: 180, clampNeedTons: 200 }, hm);
  checks.detecta_tiebar = !bad1.fits;
  const bad2 = mb.checkMachine({ wmm: 500, lmm: 400, stackMm: 300, shotCc: 60, clampNeedTons: 400 }, hm);
  checks.detecta_daylight_shot_clamp = bad2.issues.length >= 3;

  // ── §4.4: selector de acero con las razones del libro ──
  checks.default_p20 = mb.selectMetal({}).metal.key === 'P20';
  checks.corrosivo_ss420 = mb.selectMetal({ resinaCorrosiva: true }).metal.key === 'SS420';
  checks.abrasivo_d2 = mb.selectMetal({ resinaAbrasiva: true }).metal.key === 'D2';
  checks.termico_cobre = mb.selectMetal({ prioridadTermica: true }).metal.key === 'Cu 940';
  checks.proto_aluminio = mb.selectMetal({ prototipo: true }).metal.key === 'Al QC-7';

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
