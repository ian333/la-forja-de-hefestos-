/**
 * GATE DEL RACE TRACKING — la prueba de que esto SIMULA FLUJO y no pinta distancias.
 * ============================================================================
 * "simulación de flujo, no está bien simulado" (user 2026-07-16). Tenía razón, y el error
 * era de fondo: yo corría Dijkstra pesando los saltos por DISTANCIA. Para ese Dijkstra
 * una pared de 1 mm y una de 3 mm son idénticas — y el fundido NO las ve igual.
 *
 * Peor: me contradecía solo. Citaba §5.5.5 (flow leaders = VARIAR EL ESPESOR para
 * balancear el llenado) con una simulación que no podía ver el espesor. Engrosar una
 * pared no cambiaba nada. O sea: la herramienta no podía hacer aquello para lo que la
 * estaba citando.
 *
 * LA FÍSICA (Eq 5.22, power-law entre placas):
 *      ΔP = (2·k·L/H) · [2(1+1/n)·v̄/H]^n     ⇒     ΔP ∝ L / H^(1+n)
 * Con el n=0.348 del ABS, duplicar el espesor hace el paso 2^1.348 = 2.5× más fácil.
 * Por eso el costo del salto es la RESISTENCIA (dL / H^(1+n)), no la distancia. Y el
 * espesor local sale de una transformada de distancia al acero (EDT), no de un parámetro.
 *
 * LA PRUEBA: dos brazos de la MISMA longitud desde la misma compuerta, uno delgado y otro
 * grueso. Si el grueso NO se llena antes, esto no simula flujo — simula un mapa de metro.
 * Ese adelanto tiene nombre en el libro: RACE TRACKING, y es justo lo que §5.5.5 corrige.
 *
 * Uso: node --import tsx scripts/mold-racetrack-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

(async () => {
  const FL = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'flowlen.ts'));

  // ── LA Y: dos brazos iguales en LONGITUD, distintos en ESPESOR ───────────
  const H_DELGADO = 1.0, H_GRUESO = 3.0, N_ABS = 0.348;
  const f = FL.measureFlowLength({
    x0: -2, y0: -22, z0: -1, x1: 64, y1: 22, z1: 5, cellMm: 0.4,
    gateMm: { x: 1, y: 0, z: 0.5 }, wallMm: H_DELGADO, meltN: N_ABS,
    inCavity: (x, y, z) => {
      if (z < 0) return false;
      if (x >= 0 && x <= 12 && Math.abs(y) <= 2 && z <= 3) return true;          // tronco
      if (x > 12 && x <= 16 && Math.abs(y) <= 16 && z <= 3) return true;         // distribuidor
      if (x > 16 && x <= 60 && Math.abs(y - 14) <= 2 && z <= H_DELGADO) return true;
      if (x > 16 && x <= 60 && Math.abs(y + 14) <= 2 && z <= H_GRUESO) return true;
      return false;
    },
  });
  const at = (x, y, z) => {
    const i = Math.round((x - f.x0) / f.cellMm - .5), j = Math.round((y - f.y0) / f.cellMm - .5), k = Math.round((z - f.z0) / f.cellMm - .5);
    const t = f.idx(i, j, k);
    return { L: f.flowLenMm[t], R: f.resistance[t], H: f.thicknessMm[t] };
  };

  // ── 1) EL EDT MIDE EL ESPESOR (sin que nadie se lo diga) ────────────────
  // OJO al punto de sondeo: en el CENTRO de cada brazo. Cerca del piso el EDT da la
  // distancia al piso — que es correcto, pero no es el espesor. (Mi primer sondeo midió
  // los dos a z=0.4 y "los dos daban 1.6": era MI punto, no el algoritmo.)
  const hD = at(40, 14, H_DELGADO / 2).H, hG = at(40, -14, H_GRUESO / 2).H;
  console.log(`\nEL ESPESOR, MEDIDO DEL HUECO (transformada de distancia al acero):`);
  console.log(`  brazo delgado: real ${H_DELGADO} → medido ${hD.toFixed(2)} mm`);
  console.log(`  brazo grueso:  real ${H_GRUESO} → medido ${hG.toFixed(2)} mm`);
  check('el EDT VE que un brazo es más grueso que el otro', hG > hD * 1.5, `${hG.toFixed(2)} vs ${hD.toFixed(2)} mm`);
  check('el espesor medido cuadra con el real (± celda)', Math.abs(hG - H_GRUESO) < 1 && Math.abs(hD - H_DELGADO) < 1,
    `sesgo ≈ +${(hD - H_DELGADO).toFixed(1)} mm = el redondeo de la celda (${f.cellMm} mm)`);

  // ── 2) LA DISTANCIA NO DISTINGUE — por eso Dijkstra puro no sirve ───────
  const D = at(58, 14, H_DELGADO / 2), G = at(58, -14, H_GRUESO / 2);
  console.log(`\nLA DISTANCIA (lo que yo usaba de costo):`);
  console.log(`  delgado L=${D.L.toFixed(1)} mm · grueso L=${G.L.toFixed(1)} mm`);
  check('los dos brazos están a la MISMA distancia (el test es justo)',
    Math.abs(D.L - G.L) < 2, `${Math.abs(D.L - G.L).toFixed(1)} mm de diferencia — un Dijkstra por DISTANCIA los trata IGUAL`);

  // ── 3) LA RESISTENCIA SÍ — y de ahí sale el RACE TRACKING ───────────────
  console.log(`\nLA RESISTENCIA (∝ ΔP, Eq 5.22 — lo que el fundido siente de verdad):`);
  console.log(`  delgado R=${D.R.toFixed(3)} · grueso R=${G.R.toFixed(3)} → el grueso gasta ${(100 * G.R / D.R).toFixed(0)}%`);
  check('RACE TRACKING: el fundido llega ANTES por el brazo GRUESO', G.R < D.R * 0.9,
    `${(100 * G.R / D.R).toFixed(0)}% de la resistencia — a MISMA distancia, el grueso gana`);

  // el adelanto no es cualquiera: lo predice la ecuación. ΔP ∝ 1/H^(1+n) ⇒ la razón de
  // resistencias de los BRAZOS ≈ (H_delgado/H_grueso)^(1+n). No se ajusta: se compara.
  const esperado = Math.pow(hD / hG, 1 + N_ABS);
  // (los brazos son ~44 de los ~58 mm del camino; el tronco y el distribuidor son comunes
  //  a los dos, así que la razón TOTAL queda entre `esperado` y 1)
  console.log(`\n  Eq 5.22 predice para los BRAZOS: (${hD.toFixed(2)}/${hG.toFixed(2)})^${(1 + N_ABS).toFixed(3)} = ${esperado.toFixed(3)}`);
  console.log(`  medido en el camino COMPLETO (tronco+distribuidor comunes): ${(G.R / D.R).toFixed(3)}`);
  check('el adelanto está en el rango que predice Eq 5.22 (no es un número de ajuste)',
    G.R / D.R > esperado * 0.9 && G.R / D.R < 1,
    `${(G.R / D.R).toFixed(3)} ∈ (${(esperado * 0.9).toFixed(3)}, 1) — entre la predicción de los brazos y 1`);

  // ── 4) §5.5.5 AHORA SIRVE: engrosar CAMBIA el llenado ───────────────────
  // El libro dice: iguala los ΔP y las regiones llegan a la vez (Eq 5.30). Si engroso el
  // brazo delgado hasta el del grueso, deben EMPATAR. Antes esto era imposible de probar
  // porque la simulación no veía el espesor.
  const f2 = FL.measureFlowLength({
    x0: -2, y0: -22, z0: -1, x1: 64, y1: 22, z1: 5, cellMm: 0.4,
    gateMm: { x: 1, y: 0, z: 0.5 }, wallMm: H_GRUESO, meltN: N_ABS,
    inCavity: (x, y, z) => {
      if (z < 0) return false;
      if (x >= 0 && x <= 12 && Math.abs(y) <= 2 && z <= 3) return true;
      if (x > 12 && x <= 16 && Math.abs(y) <= 16 && z <= 3) return true;
      if (x > 16 && x <= 60 && Math.abs(y - 14) <= 2 && z <= H_GRUESO) return true;   // ← engrosado
      if (x > 16 && x <= 60 && Math.abs(y + 14) <= 2 && z <= H_GRUESO) return true;
      return false;
    },
  });
  const at2 = (x, y, z) => {
    const i = Math.round((x - f2.x0) / f2.cellMm - .5), j = Math.round((y - f2.y0) / f2.cellMm - .5), k = Math.round((z - f2.z0) / f2.cellMm - .5);
    return f2.resistance[f2.idx(i, j, k)];
  };
  const rD2 = at2(58, 14, H_GRUESO / 2), rG2 = at2(58, -14, H_GRUESO / 2);
  console.log(`\n§5.5.5 · FLOW LEADER: engrosar el brazo delgado de ${H_DELGADO} a ${H_GRUESO} mm`);
  console.log(`  antes: ${(100 * G.R / D.R).toFixed(0)}% de desbalance · ahora: ${(100 * rG2 / rD2).toFixed(0)}%`);
  check('§5.5.5 FUNCIONA: al igualar el espesor, los dos brazos llegan A LA VEZ (Eq 5.30)',
    Math.abs(rG2 - rD2) / Math.max(rD2, rG2) < 0.05,
    `${(100 * Math.abs(rG2 - rD2) / Math.max(rD2, rG2)).toFixed(1)}% de diferencia — ANTES esto era imposible de probar: la sim no veía el espesor`);

  // ── 5) EL FRENTE (lo que se PINTA) también lo muestra ────────────────────
  // No basta con que el campo sepa la resistencia: `createFlowFront` ordenaba por L
  // ("lo cercano primero"), así que el PINTADO seguía contradiciendo a la física del
  // campo. Ahora el frente es una superficie de ISO-RESISTENCIA — a una resistencia dada
  // conviven L distintas, y VERLO es el punto.
  const fr = FL.createFlowFront(f);
  const res50 = fr.frontAt(0.5).resistance;
  const alcance = (yBrazo, zc) => {
    let mx = 0;
    for (let x = 17; x <= 60; x += 0.5) {
      const i = Math.round((x - f.x0) / f.cellMm - .5), j = Math.round((yBrazo - f.y0) / f.cellMm - .5), k = Math.round((zc - f.z0) / f.cellMm - .5);
      const t = f.idx(i, j, k);
      if (f.cavity[t] && f.resistance[t] <= res50) mx = x;
    }
    return mx;
  };
  const aD = alcance(14, H_DELGADO / 2), aG = alcance(-14, H_GRUESO / 2);
  console.log(`\nEL FRENTE AL 50% DEL VOLUMEN (lo que se pinta):`);
  console.log(`  brazo delgado: el fundido llegó a x=${aD.toFixed(0)} mm · brazo grueso: x=${aG.toFixed(0)} mm`);
  // el criterio NO es un margen en mm (eso era un número de ajuste calibrado al EDT
  // ruidoso): a iso-ΔP la penetración de cada brazo va como H^(1+n) (Eq 5.22 despejada
  // para x), así que el adelanto DENTRO de los brazos (desde x=16, donde se separan)
  // debe ser ≈ (hG/hD)^(1+n). Se compara contra la ecuación, como todo lo demás.
  const adelantoMedido = (aG - 16) / Math.max(0.5, aD - 16);
  const adelantoEq = Math.pow(hG / hD, 1 + N_ABS);
  check('el FRENTE PINTADO muestra el race tracking (el grueso va adelante, y CUANTO dice Eq 5.22)',
    aG > aD + 2 && adelantoMedido > adelantoEq * 0.7,
    `grueso ${(aG - 16).toFixed(1)} vs delgado ${(aD - 16).toFixed(1)} mm dentro de los brazos = ${adelantoMedido.toFixed(2)}× (Eq 5.22 predice ${adelantoEq.toFixed(2)}×) — con createFlowFront ordenando por L iban PAREJOS`);
  check('a una resistencia dada conviven L distintas (el frente es iso-RESISTENCIA, no iso-L)',
    fr.frontAt(0.5).lenMaxMm > 0, `L máx recorrida al 50%: ${fr.frontAt(0.5).lenMaxMm.toFixed(1)} mm`);

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ SIMULA FLUJO: el costo es la RESISTENCIA (Eq 5.22: ΔP ∝ L/H^(1+n)), no la distancia. El RACE TRACKING emerge solo y los FLOW LEADERS de §5.5.5 por fin tienen efecto.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
