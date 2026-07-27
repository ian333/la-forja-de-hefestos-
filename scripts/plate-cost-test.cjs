/**
 * GATE DEL COSTO POR PLACA — "cada placa individual debe de cotizarse, estoy 100% seguro
 * de que el libro lo pone así" (user 2026-07-16).
 *
 * FUI A VERIFICAR Y EL LIBRO NO LO PONE ASÍ. §3.3.2 · Eq 3.15: `C = $830 + M·κ` — UNA
 * fórmula para todo el mold base, M estadística sobre el bloque. Sin desglose por placa,
 * y no por descuido: el libro asume que el mold base SE COMPRA armado (DME/HASCO). Lo que
 * sí desglosa son los INSERTOS (§3.3.1), que sí los maquina el moldero.
 *
 * Pero el instinto del user apunta a algo real: en LATAM nadie compra un DME armado — se
 * corta acero. Así que el desglose existe como EXTENSIÓN NUESTRA, con un contrato duro:
 *
 *   **LA SUMA DEL DESGLOSE CUADRA CON LA Eq 3.15**
 *
 * Ese es EL check. Si la suma se despegara, tendríamos dos verdades sobre el mismo molde
 * y el ancla del bezel ($3,700 dentro de los $74,800) se rompería — el pecado de toda
 * esta sesión: dos caminos calculando lo mismo distinto.
 *
 * Uso: node --import tsx scripts/plate-cost-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

const bezel = {
  name: 'Bezel', code: 'MLD-BEZEL', widthMm: 381, depthMm: 297,
  plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
  cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5 },
  cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 }, ejectors: { type: 'pin', diaMm: 3, count: 20 },
  core: { widthMm: 240, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
  clampTons: 200, nCav: 1,
};

(async () => {
  const PC = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'plate-cost.ts'));

  // ── 1) EL DESGLOSE ───────────────────────────────────────────────────────
  const b = PC.plateCosts(bezel);
  console.log(`\nBEZEL · base ${bezel.widthMm}×${bezel.depthMm} · stack ${b.massTotalKg} kg\n`);
  console.log('  placa                          espesor   masa      $/kg    acero    setup     TOTAL   %');
  for (const p of b.plates) {
    console.log(`  ${p.name.padEnd(30)} ${String(p.thickMm).padStart(4)} mm ${String(p.massKg).padStart(7)} kg ${String(p.coefUSDkg).padStart(6)} ${String(p.steelUSD.toFixed(0)).padStart(7)} ${String(p.setupUSD.toFixed(0)).padStart(8)} ${String(p.USD.toFixed(0)).padStart(8)} ${String(p.pctOfBase).padStart(5)}%`);
  }
  console.log(`  ${''.padEnd(30)} ${''.padStart(4)}    ${''.padStart(7)}    ${''.padStart(6)} ${''.padStart(7)} ${''.padStart(8)} ${String(b.totalUSD.toFixed(0)).padStart(8)}`);

  // ── 2) EL CONTRATO: la suma cuadra con el LIBRO ──────────────────────────
  console.log(`\n─── EL CONTRATO ───`);
  console.log(`  suma del desglose: $${b.totalUSD.toFixed(2)}`);
  console.log(`  Eq 3.15 (§3.3.2):  $${b.moldBaseEq315USD.toFixed(2)}   ← EL LIBRO MANDA`);
  console.log(`  error: ${b.errorPct}%`);
  check('LA SUMA DEL DESGLOSE CUADRA CON LA Eq 3.15 (el desglose informa, no reinventa)',
    b.errorPct < 0.01, `${b.errorPct}% — si se despegara, habría DOS verdades sobre el mismo molde`);

  // ── 3) CADA PLACA CON SU ACERO REAL ─────────────────────────────────────
  const A = b.plates.find((p) => p.role === 'A'), clamp = b.plates.find((p) => p.role === 'clamp');
  console.log(`\n  placa A: ${A.mat} → $${A.coefUSDkg}/kg   [${A.matNota}]`);
  console.log(`  clamp:   ${clamp.mat} → $${clamp.coefUSDkg}/kg   [${clamp.matNota}]`);
  check('el P20 de la placa A cuesta MÁS que el acero de base del clamp (Tabla 3.7)',
    A.coefUSDkg > clamp.coefUSDkg, `${A.coefUSDkg} > ${clamp.coefUSDkg} $/kg`);
  check('un acero fuera de la Tabla 3.7 lo DECLARA (no inventa el coeficiente)',
    /no está en la tabla del libro/.test(clamp.matNota), clamp.matNota.slice(0, 60));

  // ── 4) LAS 7 PLACAS, NINGUNA GRATIS ─────────────────────────────────────
  check('están las 7 placas del stack', b.plates.length === 7, `${b.plates.length}`);
  check('ninguna placa sale GRATIS', b.plates.every((p) => p.USD > 0), `mínimo $${Math.min(...b.plates.map((p) => p.USD)).toFixed(0)}`);
  const gorda = b.plates.reduce((a, p) => (p.massKg > a.massKg ? p : a));
  check('la placa MÁS PESADA es la que más cuesta (el acero se paga por kg)',
    gorda.USD === Math.max(...b.plates.map((p) => p.USD)),
    `${gorda.name} · ${gorda.massKg} kg · $${gorda.USD.toFixed(0)}`);

  // ── 5) EL ANCLA DEL LIBRO NO SE ROMPE ───────────────────────────────────
  // Si le paso el número EXACTO del bezel del libro, el desglose debe sumar ESE.
  const conLibro = PC.plateCosts(bezel, { moldBaseEq315USD: 3700 });
  console.log(`\n─── CON EL NÚMERO DEL LIBRO ($3,700 del bezel) ───`);
  console.log(`  suma del desglose: $${conLibro.totalUSD.toFixed(2)}`);
  check('con el $3,700 del libro, el desglose suma EXACTAMENTE $3,700',
    Math.abs(conLibro.totalUSD - 3700) < 0.05, `$${conLibro.totalUSD.toFixed(2)} — el ancla del bezel intacta`);

  // ── 6) NO SE INVENTA UNA CITA ───────────────────────────────────────────
  check('DECLARA que el desglose es NUESTRO, no del libro (no fabrica una cita)',
    b.notas.some((n) => /extensión NUESTRA, no del libro/.test(n)), b.notas[0]);
  check('DICE qué hace el libro de verdad (bloque comprado, Eq 3.15)',
    b.notas.some((n) => /un bloque comprado|UN bloque comprado/i.test(n)), b.notas[1]);

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ COSTO POR PLACA: cada placa con su acero y su masa reales · LA SUMA CUADRA CON LA Eq 3.15 del libro · y DECLARA que el desglose es extensión nuestra (el libro cotiza la base como bloque comprado)');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
