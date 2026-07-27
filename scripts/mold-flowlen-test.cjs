/**
 * GATE DE LA LONGITUD DE FLUJO — "no debe de ser una fórmula de una figura: ¿cómo
 * calcularás el relleno de una carcasa de laptop? ¿o una pistola de agua? SE TIENE QUE
 * CALCULAR CON EL MOLDE A/B" (user 2026-07-16).
 *
 * Tenía razón. Yo estaba escribiendo `tupperFlowPath()` — la fórmula del vaso a mano —
 * y encima mal: πR²·pared es SOLO EL FONDO, me comía el 82 % de la pieza (la pared de
 * 67 mm no existía en el llenado).
 *
 * El libro no razona por figuras: razona por **L = longitud de flujo** (§5.5.5), la
 * distancia que el fundido recorre POR DENTRO del hueco desde la compuerta. Este gate
 * prueba que L se MIDE del hueco A/B y que la MISMA función sirve para cualquier pieza:
 * se le dan tres huecos distintos SIN decirle qué son.
 *
 * La prueba decisiva (#4): una pieza con un OBSTÁCULO. Si el frente lo RODEA, el módulo
 * está midiendo el hueco de verdad; si lo atraviesa, está midiendo distancia en línea
 * recta y no sirve para nada real.
 *
 * Uso: node --import tsx scripts/mold-flowlen-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

(async () => {
  const FL = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'flowlen.ts'));

  // ── 1) EL VASO — hueco de un cilindro con núcleo: FONDO + PARED ──────────
  // NADIE le dice que es un vaso: solo se le da el hueco (dónde hay plástico).
  const R = 30, H = 70, W = 3;
  const vaso = FL.measureFlowLength({
    x0: -R - 2, y0: -R - 2, z0: -1, x1: R + 2, y1: R + 2, z1: H + 1, cellMm: 1.5,
    gateMm: { x: 0, y: 0, z: 0 },                       // compuerta al centro del fondo
    inCavity: (x, y, z) => {
      const r = Math.hypot(x, y);
      if (z < 0 || z > H || r > R) return false;
      if (z <= W) return true;                          // el FONDO (disco macizo de 3 mm)
      return r >= R - W;                                // la PARED (tubo de 3 mm)
    },
  });
  const volReal = Math.PI * R * R * W + 2 * Math.PI * (R - W / 2) * W * (H - W);
  console.log(`\nVASO (⌀60 × 70, pared 3) — el módulo NO sabe que es un vaso:`);
  console.log(`  L máx ${vaso.maxFlowLenMm} mm · volumen ${vaso.volumeMm3} mm³ (real ≈ ${volReal.toFixed(0)})`);
  console.log(`  vóxeles que NO se llenan: ${vaso.unreachable}`);
  // el recorrido más largo es: radio del fondo (30) + subir la pared (67) ≈ 97
  check('mide TODA la pieza, no solo el fondo (el bug que me cachó el user)',
    Math.abs(vaso.volumeMm3 - volReal) / volReal < 0.15,
    `${vaso.volumeMm3} vs ${volReal.toFixed(0)} mm³ — el fondo solo sería ${(Math.PI * R * R * W).toFixed(0)}`);
  check('L máx ≈ radio del fondo + alto de la pared (30 + 67 = 97)',
    Math.abs(vaso.maxFlowLenMm - 97) < 12, `${vaso.maxFlowLenMm} mm`);
  check('TODO el hueco se llena (nada aislado del gate)', vaso.unreachable === 0, `${vaso.unreachable} vóxeles muertos`);

  // ── 2) EL FRENTE EMERGE, no se programa ──────────────────────────────────
  // En el FONDO el frente va radial (desacelera); en la PARED, lineal. Eso sale del
  // histograma de L, sin una sola línea "si es disco entonces √t".
  const ff = FL.createFlowFront(vaso);
  console.log(`\n  el frente contra el volumen llenado:`);
  for (const f of [0.25, 0.5, 0.75, 1.0]) console.log(`    ${(100 * f).toFixed(0).padStart(3)}% del volumen → frente a L = ${ff.frontLenMm(f).toFixed(1)} mm`);
  check('el frente CRECE monótono con el volumen', ff.frontLenMm(0.25) < ff.frontLenMm(0.75), `${ff.frontLenMm(0.25).toFixed(1)} < ${ff.frontLenMm(0.75).toFixed(1)} mm`);
  check('el volumen del frente cuadra con el del campo', Math.abs(ff.volumeMm3 - vaso.volumeMm3) < 1, `${ff.volumeMm3} mm³`);

  // ── 3) LA CARCASA DE LAPTOP — la MISMA función, otra figura ──────────────
  // Placa delgada 240×160×2 con paredes de 10: nadie le escribió su fórmula.
  const carcasa = FL.measureFlowLength({
    x0: -122, y0: -82, z0: -1, x1: 122, y1: 82, z1: 12, cellMm: 2,
    gateMm: { x: 0, y: 0, z: 1 },
    inCavity: (x, y, z) => {
      if (Math.abs(x) > 120 || Math.abs(y) > 80 || z < 0 || z > 10) return false;
      if (z <= 2) return true;                          // la tapa
      return Math.abs(x) >= 118 || Math.abs(y) >= 78;   // las paredes del borde
    },
  });
  console.log(`\nCARCASA DE LAPTOP (240×160, pared 2) — MISMA función:`);
  console.log(`  L máx ${carcasa.maxFlowLenMm} mm · volumen ${carcasa.volumeMm3} mm³ · sin llenar ${carcasa.unreachable}`);
  // el punto más lejano es la esquina: √(120² + 80²) ≈ 144, más subir la pared
  check('la carcasa se resuelve SIN escribirle su fórmula',
    carcasa.maxFlowLenMm > 130 && carcasa.unreachable === 0, `L máx ${carcasa.maxFlowLenMm} mm (esquina ≈ 144)`);
  check('L de la carcasa ≠ L del vaso (la figura SÍ entra, vía el hueco)',
    Math.abs(carcasa.maxFlowLenMm - vaso.maxFlowLenMm) > 20, `${carcasa.maxFlowLenMm} vs ${vaso.maxFlowLenMm} mm`);

  // ── 4) LA PRUEBA DECISIVA: EL FRENTE RODEA EL ACERO ──────────────────────
  // Placa con un POZO en medio (un boss, un agujero: acero macizo). El fundido NO puede
  // atravesarlo — tiene que rodearlo. Si L midiera línea recta, este check truena.
  const conPozo = FL.measureFlowLength({
    x0: -52, y0: -32, z0: -1, x1: 52, y1: 32, z1: 3, cellMm: 1,
    gateMm: { x: -48, y: 0, z: 1 },                     // gate en el borde IZQUIERDO
    inCavity: (x, y, z) => {
      if (Math.abs(x) > 50 || Math.abs(y) > 30 || z < 0 || z > 2) return false;
      // OBSTÁCULO: barra de acero vertical que casi parte la placa (deja pasos arriba/abajo)
      if (Math.abs(x) < 4 && Math.abs(y) < 24) return false;
      return true;
    },
  });
  // el punto (48, 0): en línea recta son 96 mm. Rodeando la barra: hay que subir a y≈±26,
  // cruzar y bajar ⇒ NOTABLEMENTE más.
  const iOf = (x, y, z) => conPozo.idx(
    Math.round((x - conPozo.x0) / conPozo.cellMm - 0.5),
    Math.round((y - conPozo.y0) / conPozo.cellMm - 0.5),
    Math.round((z - conPozo.z0) / conPozo.cellMm - 0.5));
  const lLejos = conPozo.flowLenMm[iOf(48, 0, 1)];
  const recta = 96;
  console.log(`\nPLACA CON OBSTÁCULO (barra de acero en medio) — LA PRUEBA DECISIVA:`);
  console.log(`  gate en x=-48 · punto medido x=+48 (justo detrás de la barra)`);
  console.log(`  distancia en LÍNEA RECTA: ${recta} mm`);
  console.log(`  L medida por el hueco:    ${lLejos.toFixed(1)} mm  (+${(lLejos - recta).toFixed(1)} de rodeo)`);
  check('el frente RODEA el acero (no lo atraviesa): L > línea recta',
    lLejos > recta + 8, `${lLejos.toFixed(1)} > ${recta} mm — el fundido da la vuelta, como en la realidad`);
  check('el hueco tras el obstáculo SÍ se llena (por el rodeo)', Number.isFinite(lLejos), `L = ${lLejos.toFixed(1)} mm`);

  // ── 5) LO QUE NO SE LLENA, SE REPORTA ────────────────────────────────────
  // Un bolsillo AISLADO (sin conexión al gate) es un defecto REAL: el libro lo llama
  // short shot. El módulo debe gritarlo, no llenarlo por arte de magia.
  const aislado = FL.measureFlowLength({
    x0: -52, y0: -32, z0: -1, x1: 52, y1: 32, z1: 3, cellMm: 1,
    gateMm: { x: -48, y: 0, z: 1 },
    inCavity: (x, y, z) => {
      if (z < 0 || z > 2) return false;
      if (x >= -50 && x <= -10 && Math.abs(y) <= 30) return true;   // zona del gate
      if (x >= 10 && x <= 50 && Math.abs(y) <= 30) return true;     // isla SEPARADA
      return false;
    },
  });
  console.log(`\nBOLSILLO AISLADO (sin camino al gate) = short shot:`);
  console.log(`  vóxeles que NO se llenan: ${aislado.unreachable}`);
  check('detecta lo que NUNCA se llena (short shot §5.5)', aislado.unreachable > 100,
    `${aislado.unreachable} vóxeles inalcanzables — el molde NO llena esa isla`);

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ LONGITUD DE FLUJO: se MIDE del hueco A/B (§5.5.5) — vaso, carcasa y placa con obstáculo con la MISMA función, sin una fórmula por figura. El frente RODEA el acero y lo inalcanzable se reporta.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
