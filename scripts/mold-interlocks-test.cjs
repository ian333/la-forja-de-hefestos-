/**
 * GATE de INTERLOCKS (el AUTOCENTRADO) — Kazmer §12.2.5 + §4.1.3.
 * La prueba que manda: REPRODUCIR el ejemplo resuelto del libro AL NÚMERO.
 *   "F = ½·40 MPa·19.05 mm·50 mm = 19,050 N"
 *   "τ = 19,050 N / (π(0.019 m)²/4) = 67 MPa"  → < 300 (S7) ⇒ suficiente
 * Si nuestra fórmula no da ESO, está mal — sin discusión.
 * Uso: node --import tsx scripts/mold-interlocks-test.cjs
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
  clampTons: 200, feed: 'hot-runner', nCav: 1,
};

(async () => {
  const IL = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-interlocks.ts'));

  // ── 1) EL EJEMPLO DEL LIBRO, AL NÚMERO (vaso: 40 MPa · ⌀19.05 · H50) ──────
  const d = 19.05, A = Math.PI * d * d / 4;
  const r = IL.interlockShear(40, d, 50, A);
  console.log(`\nEJEMPLO DEL LIBRO (vaso, §12.2.5):`);
  console.log(`  F = ½·40·19.05·50 = ${r.fLateralN} N          (el libro: 19,050 N)`);
  console.log(`  τ = F/A = ${r.tauMPa} MPa                       (el libro: 67 MPa)`);
  check('F_lateral = 19,050 N EXACTO (libro)', r.fLateralN === 19050, `${r.fLateralN} N`);
  check('τ = 67 MPa (libro)', Math.abs(r.tauMPa - 67) < 0.6, `${r.tauMPa} MPa`);
  check('el libro lo declara suficiente (τ < 300 S7)', r.tauMPa < IL.TAU_LIMIT_S7_MPA, `${r.tauMPa} < ${IL.TAU_LIMIT_S7_MPA}`);
  // la mitad NO es cosmética: si no se tomara la mitad, τ sería el doble
  const rFull = IL.interlockShear(80, d, 50, A);
  check('la estimación toma la MITAD de la fuerza (conservadora)', Math.abs(rFull.tauMPa - 2 * r.tauMPa) < 0.5,
    `al doble de presión, τ dobla: ${rFull.tauMPa}`);

  // ── 2) EL PLAN sobre el bezel ─────────────────────────────────────────────
  const p = IL.planInterlocks(bezel);
  console.log(`\nPLAN (bezel · P=${p.pMeltMPa} MPa · H_cav=${p.hCavityMm}):`);
  console.log(`  ELEGIDO ${p.desig} · área ${p.areaMm2} mm² · F ${p.fLateralN} N · τ ${p.tauMPa}/${p.limitMPa} MPa · ${p.ok ? 'OK' : 'NO'}`);
  console.log(`  candidatos:`);
  for (const c of p.candidates) console.log(`    ${c.ok ? '·' : '✗'} ${c.desig.padEnd(8)} τ=${String(c.tauMPa).padStart(6)}  ${c.why}`);
  console.log(`  posiciones (plano de partición): ${p.positions.map((q) => `(${q.x},${q.y})`).join(' ')}`);
  console.log(`  macho: placa ${p.male.plate} PASANTE ${p.male.depthMm}mm · hembra: placa ${p.female.plate} ciega ${p.female.depthMm}mm`);
  for (const w of p.why) console.log(`   · ${w}`);

  check('el plan AGUANTA (τ < 300 S7)', p.ok && p.tauMPa < 300, `τ ${p.tauMPa} MPa`);
  check('4 interlocks (uno por costado)', p.positions.length === 4, `${p.positions.length}`);
  check('§12.2.5 macho PASANTE en B', p.male.plate === 'B' && p.male.through === true, `B pasante ${p.male.depthMm}mm`);
  check('§12.2.5 hembra CIEGA en A', p.female.plate === 'A' && p.female.through === false, `A ciega ${p.female.depthMm}mm`);
  check('§4.1.3 inclinados ≥5°', p.angleDeg >= IL.MIN_ANGLE_DEG, `${p.angleDeg}°`);
  check('elige el MÁS GRANDE que aguanta y cabe (§12.2.5)', (() => {
    const ok = p.candidates.filter((c) => c.ok);
    return !ok.length || p.desig.includes(ok[ok.length - 1].desig);
  })(), `${p.desig} de [${p.candidates.filter((c) => c.ok).map((c) => c.desig).join(',')}]`);
  check('cada candidato dice POR QUÉ', p.candidates.every((c) => c.why.length > 10), 'todos con razón');
  check('promete el beneficio del libro (rigidez ×2)', /rigidez|deflexi/i.test(p.benefit), p.benefit.slice(0, 46));

  // ── 3) los interlocks NO deben chocar con los tornillos (la lección del asiento) ──
  const DS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawing-set.ts'));
  const tor = [...DS.standardHoles(bezel, 'clamp'), ...DS.standardHoles(bezel, 'bottom')].filter((h) => /tornillo/.test(h.type));
  let worst = 1e9, wi = '';
  for (const q of p.positions) for (const t of tor) {
    const gap = Math.hypot(q.x - t.x, q.y - t.y) - p.diaMm / 2 - t.dia / 2;
    if (gap < worst) { worst = gap; wi = `interlock(${q.x},${q.y}) vs tornillo(${t.x},${t.y})`; }
  }
  console.log(`\n  holgura mínima interlock↔tornillo: ${worst.toFixed(1)} mm (${wi})`);
  check('el interlock NO choca con la tornillería', worst > 2, `${worst.toFixed(1)} mm`);

  // ── 4) EL MACHO Y LA HEMBRA DEBEN EMBONAR (una sola fuente, no dos copias) ────
  // Casi repito el pecado de la sesión: la hembra en standardHoles copiaba la regla de
  // §4.2.2 y divergió 2.4 mm del macho al instante. Sin este check nadie se entera
  // hasta el taller — cuando el interlock no entra.
  // FUENTE ÚNICA: macho y hembra salen del MISMO `planInterlocks`, así que embonan por
  // CONSTRUCCIÓN. Este check verifica que nadie vuelva a duplicar la colocación: si
  // alguien recalcula la hembra por su lado, `planInterlocks` deja de mandar y esto cae.
  const p2 = IL.planInterlocks(bezel);
  const mismas = JSON.stringify(p.positions) === JSON.stringify(p2.positions);
  check('planInterlocks es DETERMINISTA (misma entrada ⇒ mismas posiciones)', mismas, `${p.positions.length} posiciones`);
  check('NADIE MÁS coloca la hembra (standardHoles no la duplica)',
    DS.standardHoles(bezel, 'A').filter((h) => /interlock/.test(h.type)).length === 0,
    'la coloca solo planInterlocks → macho y hembra embonan por construcción');

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ INTERLOCKS: ejemplo del libro EXACTO (19,050 N · 67 MPa) + macho y hembra EMBONAN + no chocan');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
