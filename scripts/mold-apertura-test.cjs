/**
 * GATE DE LA APERTURA (la carrera del molde) — Kazmer §6.3.2 + Tabla 6.1.
 *
 * "el movimiento debe de tener cota pues se está calculando cuánto se abrirá, no?" (user)
 * La respuesta era NO. Había DOS agujeros, los dos por el mismo motivo — el número no
 * estaba en pantalla, así que nadie lo auditó:
 *   1. la animación abría `OPEN = 80` mm FIJO (inventado). Para el tupper (60 mm de
 *      fondo → 150 mm de carrera) mostraba el 53 % del recorrido.
 *   2. el selector de máquina comparaba `stack <= maxDaylight`: el molde CERRADO. Pero
 *      el daylight tiene que tragar el molde ABIERTO (Tabla 6.1: 264 + 75 = 339).
 *      Barrido: 25 casos aprobados que la máquina NO puede abrir (hasta 92 mm de falta).
 *
 * La prueba que manda: REPRODUCIR el ancla del libro AL NÚMERO.
 * Uso: node --import tsx scripts/mold-apertura-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

(async () => {
  const TP = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'threeplate.ts'));
  const MS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'machinesizing.ts'));
  const MM = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldmachine.ts'));

  // ── 1) EL ANCLA DEL LIBRO, AL NÚMERO (Tabla 6.1) ─────────────────────────
  console.log('\nANCLA DEL LIBRO (Tabla 6.1):');
  console.log(`  2 placas: stack 264 + apertura 75 = daylight 339`);
  check('daylight = stack + carrera (2 placas del libro)', TP.daylightNeededMm(264, 75) === 339, `${TP.daylightNeededMm(264, 75)}`);
  check('daylight = stack + carrera (3 placas del libro)', TP.daylightNeededMm(308, 250) === 558, `${TP.daylightNeededMm(308, 250)}`);
  // la carrera del libro (75) sale de una pieza de 30 mm: 2.5 × 30 = 75
  check('la carrera del libro = 2.5 × altura de pieza', TP.moldOpeningStrokeMm(30) === 75, `2.5 × 30 = ${TP.moldOpeningStrokeMm(30)} (el libro: 75)`);
  check('§6.3.2 el factor está en el rango 2-3 del libro', TP.OPEN_FACTOR >= 2 && TP.OPEN_FACTOR <= 3, `${TP.OPEN_FACTOR}`);

  // ── 2) LA CARRERA SIGUE A LA PIEZA (no es un número fijo) ─────────────────
  console.log('\nLA CARRERA SIGUE A LA PIEZA (antes: 80 mm fijo para todas):');
  for (const h of [10, 30, 60, 120]) console.log(`  pieza ${String(h).padStart(3)} mm → carrera ${TP.moldOpeningStrokeMm(h)} mm`);
  check('pieza más honda ⇒ más carrera', TP.moldOpeningStrokeMm(120) > TP.moldOpeningStrokeMm(60), `120mm→${TP.moldOpeningStrokeMm(120)} > 60mm→${TP.moldOpeningStrokeMm(60)}`);
  check('el tupper (60 mm) NO abre 80 (el valor inventado)', TP.moldOpeningStrokeMm(60) === 150, `${TP.moldOpeningStrokeMm(60)} mm — el 80 fijo era el 53 %`);

  // ── 3) EL DAYLIGHT JUZGA EL MOLDE ABIERTO ────────────────────────────────
  // molde que CIERRA de sobra pero NO abre: stack 380 en una IM-50 (daylight 420)
  // con una pieza de 60 (carrera 150) → necesita 530 > 420.
  const req = MS.machineRequirements({
    projectedAreaM2: 0.01, cavityPressureMPa: 30, partVolumeCc: 50, nCav: 1,
    fillPressureMPa: 80, ejectionForceN: 500,
  });
  const cierra = MS.selectInjectionMachine(req, { wmm: 200, lmm: 200, stackMm: 380, openStrokeMm: 0 });
  const abre = MS.selectInjectionMachine(req, { wmm: 200, lmm: 200, stackMm: 380, openStrokeMm: 150 });
  console.log(`\nMISMO MOLDE (stack 380), DISTINTA CARRERA:`);
  console.log(`  carrera 0   → ${cierra.machine?.name} (daylight ${cierra.machine?.maxDaylightMm}) · necesita ${cierra.apertura.needMm}`);
  console.log(`  carrera 150 → ${abre.machine?.name} (daylight ${abre.machine?.maxDaylightMm}) · necesita ${abre.apertura.needMm}`);
  check('la carrera CAMBIA la máquina elegida (antes era invisible)', cierra.machine?.name !== abre.machine?.name,
    `${cierra.machine?.name} → ${abre.machine?.name}`);
  check('la máquina elegida SÍ puede abrir el molde', abre.apertura.needMm <= (abre.machine?.maxDaylightMm ?? 0),
    `${abre.apertura.needMm} <= ${abre.machine?.maxDaylightMm} · holgura ${abre.apertura.holguraMm} mm`);
  check('la holgura se REPORTA (número en pantalla, no fe)', Number.isFinite(abre.apertura.holguraMm), `${abre.apertura.holguraMm} mm`);

  // ── 4) EL BARRIDO: cero aprobados que no puedan abrir ─────────────────────
  // Este es EL check. Antes del fix: 25 casos. Si alguien vuelve a juzgar el daylight
  // con el molde cerrado, esto truena.
  const mk = (L, W, H) => ({
    name: `${L}x${W}x${H}`, Lmm: L, Wmm: W, Hmm: H,
    surfaceMm2: 2 * (L * W) + 2 * (L * H) + 2 * (W * H),
    volumeMm3: (L * W * H) - ((L - 4) * (W - 4) * (H - 2)),
    wallMm: 2, annualVolume: 250000, plastic: 'ABS', finish: 'SPI B-3',
  });
  const malos = [];
  for (let H = 40; H <= 200; H += 20) for (const [L, W] of [[160, 110], [90, 60], [200, 150]]) {
    let pkg; try { pkg = MM.moldMachine(mk(L, W, H)); } catch { continue; }
    const sel = pkg.diseno.maquina.seleccion;
    if (!sel.ok || !sel.machine) continue;
    if (sel.apertura.needMm > sel.machine.maxDaylightMm)
      malos.push(`${L}x${W}x${H} en ${sel.machine.name}: necesita ${sel.apertura.needMm} > ${sel.machine.maxDaylightMm}`);
  }
  console.log(`\nBARRIDO (${8 * 3} moldes): aprobados que NO pueden abrir = ${malos.length}`);
  for (const m of malos.slice(0, 5)) console.log(`   ❌ ${m}`);
  check('NINGUNA máquina aprobada es incapaz de abrir el molde', malos.length === 0, `${malos.length} casos (antes del fix: 25)`);

  // ── 5) UNA SOLA FUENTE (el pecado de esta sesión, 3 veces) ───────────────
  // La animación, el layout de 3 placas y el selector deben leer la MISMA función.
  // Si alguien teclea otro 2.5 por su lado, diverge en silencio — como la hembra del
  // interlock (2.4 mm), el asiento del inserto (20 mm) y el fondo de placa (0.78).
  const lay = TP.threePlateLayout({ partHeightMm: 60, clampTons: 100 });
  check('threePlateLayout usa moldOpeningStrokeMm (no su propio 2.5)',
    lay.openABMm === TP.moldOpeningStrokeMm(60), `layout ${lay.openABMm} = función ${TP.moldOpeningStrokeMm(60)}`);
  check('threePlateLayout usa daylightNeededMm (no su propia suma)',
    lay.daylightMm === TP.daylightNeededMm(lay.stackMm, lay.openTotalMm), `${lay.daylightMm}`);
  const pkg = MM.moldMachine(mk(160, 110, 60));
  check('moldMachine usa la MISMA carrera que la animación',
    pkg.diseno.maquina.seleccion.apertura.strokeMm === TP.moldOpeningStrokeMm(60),
    `estudio ${pkg.diseno.maquina.seleccion.apertura.strokeMm} = función ${TP.moldOpeningStrokeMm(60)}`);
  const src = require('fs').readFileSync(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'ForgeBRepStudio.tsx'), 'utf8');
  check('la animación NO tiene la carrera hardcodeada', !/const OPEN = \d+;/.test(src),
    'OPEN sale de moldOpeningStrokeMm(altura de la pieza)');
  check('la animación importa la fuente única', /moldOpeningStrokeMm/.test(src), "importa de '../mold/threeplate'");

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ APERTURA: ancla del libro EXACTA (264+75=339 · 2.5×30=75) + el daylight juzga el molde ABIERTO + UNA sola fuente');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
