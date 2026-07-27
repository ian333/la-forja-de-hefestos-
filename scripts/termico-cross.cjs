/**
 * ¿MIENTE EL TÉRMICO? — método del user (2026-07-15): "el análisis térmico estaba mal,
 * pero acá lo puedes calcular A MANO porque controlas todo y luego compararlo con lo
 * que ya hay... PARTE DE QUE ESTÁ MAL".
 *
 * Ese método es el que ha cazado TODO esta sesión (el M16-vs-M10, el asiento del
 * inserto, el 0.78 del fondo de placa). Aquí se aplica al térmico: no se le cree a la
 * simulación FDM — se calcula la MISMA física por un camino INDEPENDIENTE (la solución
 * analítica del libro, Eq 9.5) y se confrontan. Si divergen, uno de los dos miente y
 * hay que averiguar cuál (no promediarlos).
 *
 *   Eq 9.5 (Kazmer):  t_c = (h²/(π²·α)) · ln[ (4/π) · (T_melt − T_mold)/(T_eject − T_mold) ]
 *
 * Uso: node --import tsx scripts/termico-cross.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

const ROOT = path.resolve(__dirname, '..');

(async () => {
  const CO = await import(path.join(ROOT, 'src', 'forja', 'mold', 'cooling.ts'));

  console.log('\n═══ 1. ¿El t_c del libro se reproduce? (los 3 ejemplos resueltos) ═══');
  // Los ejemplos del libro: placa/barra con sus tiempos EXACTOS (ya gateados en
  // mold-cooling, pero aquí se re-verifican como ancla del cruce)
  // firma REAL: coolingTimePlate(h_METROS, material). El ABS del libro trae su propio
  // T_eject=97.6 (el texto dice 96.7 pero los CÁLCULOS del libro usan 97.6).
  const M = CO.ABS_KAZMER;
  const tc = (mm) => CO.coolingTimePlate(mm / 1000, M);
  for (const e of [{ nm: 'placa 2mm ABS', h: 2, esperado: 8.4 }, { nm: 'placa 3mm ABS', h: 3, esperado: 18.9 }]) {
    const t = tc(e.h);
    const ok = Math.abs(t - e.esperado) < 0.15;
    console.log(` ${ok ? '✓' : '❌'} ${e.nm}: t_c = ${t.toFixed(1)} s   (libro: ${e.esperado} s)`);
    if (!ok) fails++;
  }

  console.log('\n═══ 2. LA LEY: t_c ∝ h² — el cruce que no depende de constantes ═══');
  // Esta es la prueba MÁS fuerte porque NO depende de α, T_melt ni T_eject: sea cual
  // sea la constante, DUPLICAR la pared debe CUADRUPLICAR el tiempo. Si el módulo no
  // cumple esto, su física está rota sin importar qué tan bonito sea el número.
  const a = tc(2), b = tc(4);
  const ratio = b / a;
  console.log(`  pared 2 → ${Number(a).toFixed(2)} s · pared 4 → ${Number(b).toFixed(2)} s · razón ${ratio.toFixed(2)}× (debe ser 4.00)`);
  check('t_c ∝ h² EXACTO (independiente de constantes)', Math.abs(ratio - 4) < 0.02, `${ratio.toFixed(3)}×`);

  const c6 = tc(6);
  console.log(`  pared 6 → ${Number(c6).toFixed(2)} s · vs pared 2 → razón ${(c6 / a).toFixed(2)}× (debe ser 9.00)`);
  check('t_c ∝ h² también a 3× (razón 9)', Math.abs(c6 / a - 9) < 0.05, `${(c6 / a).toFixed(3)}×`);

  console.log('\n═══ 3. EL CRUCE: simulación FDM vs analítica del libro ═══');
  // El FDM 3D y la Eq 9.5 son DOS CAMINOS INDEPENDIENTES a la misma física. Si el FDM
  // está bien, su cuasi-estacionario debe caer en el rango que el libro predice.
  const TH = await import(path.join(ROOT, 'src', 'forja', 'mold', 'mold-thermal-fdm.ts'));
  const bezel = {
    name: 'Bezel', code: 'X', widthMm: 381,
    plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
    cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5, frameMm: 20, ribs: 7 },
    cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 }, ejectors: { type: 'pin', diaMm: 3, count: 20 },
    core: { widthMm: 240, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
    clampTons: 200, feed: 'hot-runner', nCav: 1,
  };
  const sim = TH.createThermalSim(bezel, {});
  let tMax = -1e9, tMin = 1e9;
  for (let i = 0; i < 40; i++) sim.step(1.0);           // 40 s simulados
  const F = sim.field ? sim.field() : sim.T ?? null;
  if (F && F.length) { for (let i = 0; i < F.length; i++) { if (F[i] > tMax) tMax = F[i]; if (F[i] < tMin) tMin = F[i]; } }
  console.log(`  FDM tras 40 s: T ∈ [${tMin.toFixed(1)} .. ${tMax.toFixed(1)}] °C`);
  // Fig 9.7 del libro: el acero del molde oscila ~60→93 °C en operación
  const enRango = tMax > 60 && tMax < 140;
  check('el FDM cae en el rango físico del libro (Fig 9.7: 60-93 °C, tope 140)', enRango, `pico ${tMax.toFixed(1)} °C`);
  check('el agua NO se calienta al rojo (mínimo cerca del refrigerante)', tMin > 20 && tMin < 90, `mín ${tMin.toFixed(1)} °C`);

  console.log(`\n  NOTA HONESTA: esto verifica que el FDM es FÍSICAMENTE PLAUSIBLE y que la ley`);
  console.log(`  t_c ∝ h² es exacta. NO prueba que el campo 3D completo sea correcto punto`);
  console.log(`  por punto — para eso haría falta un caso con solución cerrada en 3D.`);

  console.log(fails ? `\n❌ ${fails} fallaron — el térmico MIENTE en algo` : '\n✓ TÉRMICO CRUZADO: la ley h² es exacta y el FDM cae en el rango del libro');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
