/**
 * EL GATE DEL CICLO DEL DADO — E1 + E2 + E3 con OCC REAL.
 * ============================================================================
 * Nació de que ian frenó la estación 3: "no avanzaremos a menos de que añadas
 * dimensiones — TODAS — y verifiques desde distintas caras". El bug que cazó:
 * el panel declaraba insertos de COMPRA 60/16 y el acero dibujado medía 52/14.
 *
 * Este gate verifica en NÚMEROS, contra el B-Rep de producción (occt.ts +
 * splitMold reales, no mocks):
 *   E1 · el macizo REPROBADO con su t_c (Eq 9.5) y el dado APROBADO
 *   E2 · el desglose económico CUADRA al centavo y la banda A-050 cambia de ganador
 *   E3 · TODAS las medidas declarado≈medido (verificacionE3): compra=tallado,
 *        draft medido de las CARAS, Σ volúmenes = bloque, cuerpos=2
 *
 * Uso: node --import tsx scripts/ciclo-dado-test.cjs
 */
const { readFileSync } = require('fs');
const path = require('path');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const factory = require(path.join(distDir, 'opencascade.wasm.cjs'));
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

let pasan = 0, fallan = 0;
const check = (nombre, ok, detalle = '') => {
  if (ok) { pasan++; console.log(`  ✔ ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { fallan++; console.log(`  ✘ ${nombre}${detalle ? ' — ' + detalle : ''}`); }
};
const cerca = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const ed = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'estudio-molde-datos.ts'));

  // ══ E1 — DFM ══
  console.log('── E1 · DFM de la pieza (cap 2)');
  const e1 = ed.estacion1Dado();
  check('macizo REPROBADO', e1.macizo.veredicto === 'REPROBADO');
  check('t_c del macizo ≈ 88.3 min (Eq 9.5)', cerca(e1.macizo.tcS / 60, 88.3, 0.5), (e1.macizo.tcS / 60).toFixed(1) + ' min');
  check('macizo con ≥2 errores §2.3', e1.macizo.dfm.errors >= 2, String(e1.macizo.dfm.errors));
  check('dado APROBADO sin errores', e1.dado.veredicto === 'APROBADO' && e1.dado.dfm.errors === 0);
  check('t_c del dado ≈ 8.5 s (≈ el 8.4 del libro)', cerca(e1.dado.tcS, 8.5, 0.3), e1.dado.tcS.toFixed(1) + ' s');

  // ══ E2 — ECONOMÍA ══
  console.log('── E2 · Economía (cap 3)');
  const e2 = ed.estacion2Dado();
  const gana = e2.variantes.find((v) => v.ganadora);
  check('gana cold-2placas ×1', gana && gana.arch === 'cold-2placas' && gana.nCav === 1);
  const cuadran = e2.variantes.every((v) => cerca(v.amortPzaUSD + v.restoPzaUSD, v.totalPzaUSD, 0.001));
  check('desglose CUADRA al centavo en todas las filas', cuadran);
  const cambio = e2.banda.findIndex((b, i) => i > 0 && b.nCav !== e2.banda[0].nCav);
  check('A-050: el ganador CAMBIA dentro de la banda', cambio > 0, cambio > 0 ? `en ${e2.banda[cambio].q.toLocaleString()} pzas → ×${e2.banda[cambio].nCav}` : 'nunca cambia');
  check('A-054: proporción sana (<30 %)', e2.proporcion.pct < 30, e2.proporcion.pct + ' %');

  // ══ E3 — ARQUITECTURA con OCC REAL ══
  console.log('── E3 · Arquitectura (cap 4) — midiendo el B-Rep');
  const oc = await factory({ wasmBinary: wasmBin });
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  occt._setActiveOCCT(oc);
  const acero = ed.construirAceroE3(oc, e2.pkg);
  check('insertos = dims de COMPRA (el bug de ian)', acero.compra.Hc === 60 && acero.compra.Hk === 16, `Hc ${acero.compra.Hc} · Hk ${acero.compra.Hk}`);
  const v = ed.verificacionE3(oc, acero);
  for (const m of v.medidas)
    check(`${m.componente} · ${m.cota} [${m.vista}]`, m.ok, `declarado ${m.declarado} vs medido ${m.medido} (±${m.tolMm})`);
  check('VERIFICACIÓN E3 completa', v.ok, v.resumen);

  console.log(`\n${fallan === 0 ? '✅' : '❌'} ciclo del dado: ${pasan} pasan · ${fallan} fallan`);
  console.log(`VERIFY_RESULT={"pass":${fallan === 0},"pasan":${pasan},"fallan":${fallan}}`);
  process.exit(fallan ? 1 : 0);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 600)); process.exit(1); });
