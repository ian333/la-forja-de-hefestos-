/**
 * GATE DEL LLENADO — "revisa la animación porque no es real y no veo cómo pasa por los
 * canales" (user 2026-07-15). Tenía razón en las dos.
 *
 * LO QUE ESTABA MAL (cycle-engine.ts:119):
 *     else if (ph === 'inyeccion') fillFrac = u;      // u = fracción de TIEMPO
 * O sea: "lo llenado = el tiempo que pasó". Una regla de tres, no física. Y el frente
 * arrancaba DENTRO de la cavidad: el bebedero y el canal no se llenaban nunca.
 *
 * LA LEY QUE SE PRUEBA (conservación de volumen a caudal Q constante — la inyectora
 * llena a velocidad controlada):
 *     V = Q·t   →  el FRENTE sale de invertir el volumen SEGÚN LA FORMA
 *       tira con gate lateral:  V = w·h·L   → L ∝ t      LINEAL
 *       disco con gate central: V = π·r²·h  → r ∝ √t     DESACELERA
 * `fillFrac = u` era lineal SIEMPRE: correcto por casualidad para el rectángulo, falso
 * para el vaso redondo. El cuadrado tapaba el error; el círculo lo destapó.
 *
 * Uso: node --import tsx scripts/mold-llenado-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

(async () => {
  const CE = await import(path.resolve(__dirname, '..', 'src', 'forja', 'sim', 'cycle-engine.ts'));

  const base = {
    flowLenM: 0.07, wallM: 1.2e-3, vMeanMs: 0.35,
    projAreaM2: Math.PI * 0.07 * 0.07, clampTons: 150,
    bendSpanM: 0.3, bendWM: 0.3, bendHM: 0.086, tCoolS: 12,
    feed: { volumeM3: 6e-6, lenM: 0.09, diaM: 6e-3 },     // bebedero+canal reales
  };
  const disco = (g) => ({ ...base, grid: { ...g, fillMode: 'center' } });
  const tira = (g) => ({ ...base, grid: { ...g, fillMode: 'edge' } });
  const G = { nx: 220, ny: 120, hM: 1e-3, cavX0: 40, cavX1: 180, cavY0: 58, cavY1: 61, channels: [] };

  // corre la fase de inyección muestreando el frente
  const muestrear = (params) => {
    const sim = CE.createCycleSim(params);
    const tFill = sim.params.phases.find((x) => x[0] === 'inyeccion')[1];
    const tCierre = sim.params.phases.find((x) => x[0] === 'cierre')[1];
    const out = [];
    const N = 400, dt = (tCierre + tFill) / N;
    for (let i = 0; i <= N; i++) {
      const s = sim.step(dt);
      if (s.phase === 'inyeccion') out.push({ t: s.t - tCierre, fill: s.fillFrac, feed: s.feedFrac, P: s.pressureMPa });
    }
    return { tFill, muestras: out };
  };

  // ── 1) EL PLÁSTICO PASA POR LOS CANALES ANTES DE LA CAVIDAD ──────────────
  const d = muestrear(disco(G));
  const primeras = d.muestras.filter((m) => m.feed < 1);
  console.log(`\nALIMENTADOR (bebedero → canal → compuerta):`);
  console.log(`  muestras con el alimentador llenándose: ${primeras.length}`);
  if (primeras.length) console.log(`  mientras se llena, la cavidad está en: ${[...new Set(primeras.map((m) => m.fill))].join(', ')}`);
  check('el alimentador SE LLENA (el plástico se ve pasar por los canales)', primeras.length > 0,
    `${primeras.length} muestras con feedFrac < 1`);
  check('la cavidad NO empieza hasta que el alimentador está lleno',
    primeras.every((m) => m.fill === 0), 'fillFrac = 0 mientras el fundido corre por el canal');
  check('el alimentador llega a lleno (feedFrac → 1)', d.muestras.some((m) => m.feed >= 1), 'sí');

  // ── 2) LA LEY DEL DISCO: r ∝ √t (EL FRENTE DESACELERA) ───────────────────
  // Prueba decisiva: a la MITAD del tiempo de cavidad, un disco va al 71% del RADIO
  // (√0.5), no al 50%. Y (r/R)² debe ser el tiempo: el volumen sí es lineal.
  const cav = d.muestras.filter((m) => m.feed >= 1 && m.fill > 0 && m.fill < 1);
  console.log(`\nDISCO (gate central) — el frente contra el tiempo:`);
  for (const f of [0.25, 0.5, 0.75]) {
    const t0 = cav[0].t, t1 = cav[cav.length - 1].t;
    const obj = t0 + f * (t1 - t0);
    const m = cav.reduce((a, b) => (Math.abs(b.t - obj) < Math.abs(a.t - obj) ? b : a));
    const uc = (m.t - t0) / (t1 - t0);
    console.log(`  t=${(100 * f).toFixed(0)}% → frente ${(100 * m.fill).toFixed(1)}% del radio · volumen (r/R)² = ${(100 * m.fill * m.fill).toFixed(1)}%`);
  }
  const mitad = cav.reduce((a, b) => {
    const t0 = cav[0].t, t1 = cav[cav.length - 1].t, mid = t0 + 0.5 * (t1 - t0);
    return Math.abs(b.t - mid) < Math.abs(a.t - mid) ? b : a;
  });
  check('a MEDIO tiempo el disco va al ~71% del radio (√0.5), NO al 50%',
    Math.abs(mitad.fill - Math.SQRT1_2) < 0.06, `${(100 * mitad.fill).toFixed(1)}% (√0.5 = 70.7%)`);
  // el VOLUMEN sí es lineal en t — esa es la conservación
  const errVol = cav.map((m) => {
    const t0 = cav[0].t, t1 = cav[cav.length - 1].t;
    return Math.abs(m.fill * m.fill - (m.t - t0) / (t1 - t0));
  }).reduce((a, b) => Math.max(a, b), 0);
  check('el VOLUMEN del disco SÍ crece lineal con t (V = Q·t: conservación)', errVol < 0.06,
    `error máx (r/R)² vs t: ${errVol.toFixed(3)}`);

  // ── 3) LA TIRA SIGUE SIENDO LINEAL (no rompimos el caso rectangular) ─────
  const s = muestrear(tira(G));
  const cavS = s.muestras.filter((m) => m.feed >= 1 && m.fill > 0 && m.fill < 1);
  const errLin = cavS.map((m) => {
    const t0 = cavS[0].t, t1 = cavS[cavS.length - 1].t;
    return Math.abs(m.fill - (m.t - t0) / (t1 - t0));
  }).reduce((a, b) => Math.max(a, b), 0);
  console.log(`\nTIRA (gate lateral): el frente SÍ es lineal (V = w·h·L)`);
  check('la tira sigue lineal (el caso rectangular no se rompió)', errLin < 0.06, `error máx: ${errLin.toFixed(3)}`);

  // ── 4) DISCO ≠ TIRA (si dieran igual, la forma no estaría entrando) ──────
  const dMid = mitad.fill, sMid = cavS.reduce((a, b) => {
    const t0 = cavS[0].t, t1 = cavS[cavS.length - 1].t, mid = t0 + 0.5 * (t1 - t0);
    return Math.abs(b.t - mid) < Math.abs(a.t - mid) ? b : a;
  }).fill;
  check('la FORMA cambia el llenado (disco ≠ tira: antes eran idénticos)',
    Math.abs(dMid - sMid) > 0.15, `a medio tiempo: disco ${(100 * dMid).toFixed(0)}% vs tira ${(100 * sMid).toFixed(0)}%`);

  // ── 5) LA PRESIÓN PAGA EL ALIMENTADOR (cap 6) + LA CAVIDAD (cap 5) ───────
  const sinFeed = muestrear({ ...disco(G), feed: undefined });
  const pConFeed = d.muestras[d.muestras.length - 1].P, pSinFeed = sinFeed.muestras[sinFeed.muestras.length - 1].P;
  console.log(`\nPRESIÓN en la compuerta al final del llenado:`);
  console.log(`  con alimentador ${pConFeed.toFixed(1)} MPa · sin alimentador ${pSinFeed.toFixed(1)} MPa`);
  check('el alimentador CUESTA presión (antes salía gratis)', pConFeed > pSinFeed,
    `+${(pConFeed - pSinFeed).toFixed(1)} MPa del bebedero+canal`);

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ LLENADO: el frente sale de CONSERVACIÓN DE VOLUMEN (disco √t, tira lineal), el plástico PASA por los canales antes de la cavidad, y el alimentador paga su presión');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
