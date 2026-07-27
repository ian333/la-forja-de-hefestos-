/**
 * GATE de TORNILLERÍA POR CARGA (Shigley cap.8 + FED-STD-H28) — el AGARRE depende
 * del ENGRANE, la capacidad ∝ d², pocos grandes vs muchos chicos:
 *   1. capacidad ∝ d² (M6→M12 ≈ ×4)
 *   2. engrane crece con placa MÁS BLANDA (steel vs aluminio)
 *   3. el plan reparte con N≥4 y engrane que CABE en la placa
 *   4. alternativas: pocos grandes vs muchos chicos
 * Uso: node --import tsx scripts/mold-fastener-load-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

const bezel = {
  name: 'Bezel', code: 'MLD-BEZEL', widthMm: 381,
  plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
  cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5, frameMm: 20, ribs: 7 },
  cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 }, ejectors: { type: 'pin', diaMm: 3, count: 20 },
  core: { widthMm: 240, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
  clampTons: 200, feed: 'hot-runner', sideAction: { aProjMm2: 220, pMeltMPa: 200, strokeMm: 12 }, nCav: 1,
};

(async () => {
  const F = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-fasteners.ts'));
  const T = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-threads.ts'));

  const c6 = F.boltCapacityKN(T.resolveThread(6)), c12 = F.boltCapacityKN(T.resolveThread(12));
  console.log(`capacidad: M6 ${c6.toFixed(1)} kN · M12 ${c12.toFixed(1)} kN (×${(c12 / c6).toFixed(1)})`);
  check('capacidad ∝ d² (M6→M12 ×3.5-4.6)', c12 / c6 > 3.5 && c12 / c6 < 4.6, `×${(c12 / c6).toFixed(1)}`);

  const m10 = T.resolveThread(10);
  const leSteel = F.engagementLengthMm(m10, 430), leAlu = F.engagementLengthMm(m10, 200);
  console.log(`engrane M10: acero(Sy430) ${leSteel} · aluminio(Sy200) ${leAlu} mm`);
  check('engrane MÁS largo en material blando', leAlu > leSteel, `${leAlu} > ${leSteel}`);
  check('engrane steel razonable (0.7-1.5·d)', leSteel >= 7 && leSteel <= 15, `${leSteel} mm`);

  const p = F.fastenerPlan(bezel, { half: 'cavity' });
  console.log(`plan: ${p.count}× ${p.desig} · ${p.utilPct}% util · engrane ${p.engagementMm}/${p.availableMm} · par ${p.torqueNm} N·m`);
  check('N ≥ 4 (redundancia/sujeción)', p.count >= 4, `${p.count}`);
  check('utilización < 100%', p.utilPct < 100, `${p.utilPct}%`);

  // ── §12.4 Fig 12.33: la carga NO se reparte — el molde cuelga de UN tornillo ────
  // (bug real: se dividía entre N y salía 4×M10 de 56 kN para 100 kN → se rompe)
  const DS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawing-set.ts'));
  const wc = DS.moldBoltSizing(bezel).forceN / 1000;
  check('la carga del plan es la de UN tornillo (no dividida)', Math.abs(p.perBoltKN - wc) < 0.2, `${p.perBoltKN} kN = peor caso ${wc.toFixed(1)} kN`);
  check('el elegido AGUANTA esa carga él SOLO', p.capacityKN >= p.perBoltKN, `${p.capacityKN} ≥ ${p.perBoltKN} kN`);
  const tooSmall = p.candidates.filter((c) => c.capacityKN < p.perBoltKN);
  check('los que NO aguantan van descartados', tooSmall.every((c) => !c.fits && /SE ROMPE/.test(c.why)), `${tooSmall.length} descartados por romperse`);
  check('el elegido es el MÁS CHICO que aguanta', p.majorMm === Math.min(...p.candidates.filter((c) => c.fits).map((c) => parseFloat(c.desig.slice(1)))), `M${p.majorMm}`);

  // (la coherencia estudio↔geometría se verifica en mold-parts-test, donde el molde se
  //  CONSTRUYE de verdad — compararla aquí contra fastenerPlan sería una tautología)
  check('engrane CABE en placa', p.engagementOK, `${p.engagementMm} ≤ ${p.availableMm}`);
  check('par de apriete > 0', p.torqueNm > 0, `${p.torqueNm} N·m`);
  console.log(`alternativas: ${p.alternatives.map((a) => `${a.count}×${a.desig}`).join(', ')}`);
  check('≥2 alternativas (varias formas)', p.alternatives.length >= 2, `${p.alternatives.length}`);

  // ── el ESTUDIO en vivo: la elección debe estar JUSTIFICADA y no mentir ──────
  const ch = p.candidates.find((c) => c.chosen);
  check('el estudio expone TODOS los candidatos', p.candidates.length >= 5, `${p.candidates.length} evaluados`);
  check('exactamente UN elegido', p.candidates.filter((c) => c.chosen).length === 1, ch.desig);
  check('el elegido CABE', ch.fits, `engrane ${ch.engagementMm} ≤ ${p.availableMm}`);
  check('el elegido tiene N mínimo entre los que caben', ch.count === Math.min(...p.candidates.filter((c) => c.fits).map((c) => c.count)), `N=${ch.count}`);
  // empate en N ⇒ gana la MAYOR utilización (el más chico que hace el trabajo). Si el
  // elegido no fuera el más aprovechado de su grupo, el texto "no sobre-especificar" MENTIRÍA.
  const tie = p.candidates.filter((c) => c.fits && c.count === ch.count);
  check('empatados en N: gana el MÁS aprovechado', ch.utilPct === Math.max(...tie.map((c) => c.utilPct)), `${ch.utilPct}% vs ${tie.map((c) => c.utilPct).join('/')}`);
  check('cada candidato dice POR QUÉ', p.candidates.every((c) => c.why && c.why.length > 8), 'todos con razón');
  check('cada descartado dice si SE ROMPE o si no cabe el engrane',
    p.candidates.filter((c) => !c.fits).every((c) => /SE ROMPE|engrane/.test(c.why)),
    p.candidates.filter((c) => !c.fits).map((c) => c.desig).join(' '));

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ TORNILLERÍA POR CARGA: engrane FED-STD-H28 + optimización tamaño/cantidad');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
