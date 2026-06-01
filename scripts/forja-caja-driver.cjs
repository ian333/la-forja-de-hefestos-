#!/usr/bin/env node
/**
 * forja-caja-driver.cjs — DRIVER CINEMÁTICO + VERIFICACIÓN RIGUROSA DE EMBONADO
 * de la caja de velocidades (dos engranes que EMBONAN), VÍA UI, en iangpu.
 *
 * Maneja la interfaz con CLICS/inputs (nunca toca occt.ts directo):
 *   1) ⚙ Engrane → engrane 1 (m=2, Z₁=20, espesor, barreno) por inputs.
 *   2) + Agregar 2º engrane; input-dientes2 = 40 (relación 2:1).
 *   3) ⚙ Aplicar mate de engrane → C = m(Z₁+Z₂)/2 = 60, faseo φ₂.
 *   4) DRIVER: mueve input-angulo-entrada (θ) y LEE disp-relacion + θ salida del
 *      DOM en varios ángulos → comprueba que la SALIDA gira a i = Z₂/Z₁ = 2 (la
 *      mitad) y en SENTIDO OPUESTO.
 *   5) EMBONADO: clic btn-verificar-embonado → corre el BARRIDO de Common(g1,g2)
 *      sobre un paso de diente y lee disp-max-interferencia del DOM. El invariante
 *      CLAVE: max(Common) ≈ 0 (< 0.5% del volumen de un diente) ⇒ EMBONAN sin
 *      solaparse (donde el SDF fallaba). Si Common > tolerancia → INTERFIEREN.
 *
 * Screenshots: /tmp/forja-caja/embonado.png (par mallado) + rotacion_*.png.
 * Salida JSON: el último bloque ===RESULT=== es el veredicto honesto.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/forja-caja';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const errs = [];

const P = { m: 2, z1: 20, z2: 40, alpha: 20, espesor: 10, bore: 8 };
const C_ESPERADO = (P.m * (P.z1 + P.z2)) / 2; // 60
const I_ESPERADO = P.z2 / P.z1;               // 2

async function setRange(page, testid, value) {
  const sel = `[data-testid="${testid}"]`;
  await page.waitForSelector(sel, { timeout: 8000 });
  await page.$eval(sel, (el, v) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

const readNum = async (page, testid) => {
  const t = await page.textContent(`[data-testid="${testid}"]`).catch(() => null);
  if (t == null) return null;
  const m = t.replace(/,/g, '').match(/(-?[\d.]+)/);
  return m ? parseFloat(m[1]) : null;
};

const api = (page) => page.evaluate(() => {
  const a = window.__forgeBrep;
  if (!a) return null;
  return { ready: a.ready, error: a.error, assemblyInfo: a.assemblyInfo, mateInfo: a.mateInfo, meshSweep: a.meshSweep };
});

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1680, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message.slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 240)); });

  const report = { url: URL, params: P, C_esperado: C_ESPERADO, i_esperado: I_ESPERADO, errs, pasos: [], shots: [], driver_samples: [] };
  const note = (k, v) => { report[k] = v; console.log(k + ' = ' + JSON.stringify(v)); };
  const step = (s) => { report.pasos.push(s); console.log('· ' + s); };

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__forgeBrep && window.__forgeBrep.ready, { timeout: 60000 });
  await page.waitForTimeout(1500);

  // ── 1) ENGRANE 1 (m=2, Z₁=20) VÍA UI ──
  await page.click('[data-testid="btn-gear"]', { force: true });
  step('Clic toolbar → ⚙ Engrane');
  await page.waitForTimeout(900);
  await setRange(page, 'input-modulo', P.m);             step(`input-modulo = ${P.m}`);
  await setRange(page, 'input-dientes', P.z1);           step(`input-dientes = ${P.z1}`);
  await setRange(page, 'input-presion', P.alpha);        step(`input-presion = ${P.alpha}`);
  await setRange(page, 'input-espesor-engrane', P.espesor); step(`input-espesor-engrane = ${P.espesor}`);
  await setRange(page, 'input-bore', P.bore);            step(`input-bore = ${P.bore}`);
  await page.waitForTimeout(1200);

  // ── 2) 2º ENGRANE + Z₂=40 ──
  await page.click('[data-testid="btn-add-gear2"]', { force: true });
  step('Clic → + Agregar 2º engrane');
  await page.waitForTimeout(1000);
  await setRange(page, 'input-dientes2', P.z2);          step(`input-dientes2 = ${P.z2}`);
  await page.waitForTimeout(1500);

  // ── 3) APLICAR MATE (C + faseo) ──
  await page.click('[data-testid="btn-gear-mate"]', { force: true });
  step('Clic → ⚙ Aplicar mate de engrane');
  await page.waitForTimeout(2500);

  let st = await api(page);
  note('mate_info', st && st.mateInfo);
  note('assembly_info_static', st && st.assemblyInfo);
  const C_medido = st && st.assemblyInfo ? st.assemblyInfo.C_measured : await readNum(page, 'mate-C-measured');
  note('C_medido', C_medido);
  const C_ok = C_medido != null && Math.abs(C_medido - C_ESPERADO) < 0.05;
  note('C_ok', C_ok);

  // Oculta el boceto para que los dientes mallados se lean limpios.
  await page.click('[data-testid="btn-toggle-sketch"]', { force: true }).catch(() => {});
  step('Clic → Ocultar boceto (dientes nítidos)');
  await page.waitForTimeout(1000);

  // ── 4) VERIFICACIÓN RIGUROSA DE EMBONADO (PRIMERO, en θ=0): barrido de Common ──
  // Lo corremos antes que el driver para garantizar el invariante CLAVE aunque
  // los rebuilds del driver sean lentos. DISPARAMOS el clic del botón de UI con
  // dispatchEvent (NO page.click) porque el handler corre el barrido pesado de
  // forma SÍNCRONA en el hilo principal (~decenas de s): page.click esperaría a
  // que la página "se asiente" y haría timeout. dispatchEvent fija-y-olvida; luego
  // sondeamos __forgeBrep.meshSweep hasta que el barrido termina.
  await page.$eval('[data-testid="btn-verificar-embonado"]', (el) => el.click());
  step('Clic (dispatch) → 🔍 Verificar embonado (barrido)');
  // El barrido construye ~10 booleanas Common: espera a que termine.
  await page.waitForFunction(() => {
    const a = window.__forgeBrep;
    return a && a.meshSweep && Number.isFinite(a.meshSweep.maxInterference);
  }, { timeout: 300000, polling: 1000 }).catch((e) => errs.push('[sweep-timeout] ' + e.message.slice(0, 120)));
  await page.waitForTimeout(800);

  const maxInterfDom = await readNum(page, 'disp-max-interferencia');
  st = await api(page);
  const sweep = st && st.meshSweep;
  note('sweep', sweep);
  note('max_interferencia_dom', maxInterfDom);

  // Screenshot principal del par mallado (θ=0, embonado verificado).
  const shot = path.join(OUT, 'embonado.png');
  await page.screenshot({ path: shot });
  report.shots.push(shot);
  note('shot_embonado', shot);

  // ── 5) DRIVER CINEMÁTICO: mueve θ y mide la relación en varios ángulos ──
  // En θ teóricos {30,90,180} la salida debe ir a −θ/2 (i=2, sentido opuesto).
  const driveAngles = [30, 90, 180];
  let driverOk = true;
  let relacionMedida = null;
  for (const deg of driveAngles) {
    await setRange(page, 'input-angulo-entrada', deg);
    await page.waitForTimeout(2000); // deja que el rebuild B-Rep recalcule la pose
    const s = await api(page);
    const outDeg = await readNum(page, 'hud-output');
    const rel = await readNum(page, 'disp-relacion');
    const ai = s && s.assemblyInfo;
    const expectedOut = -deg / I_ESPERADO;
    const sample = {
      theta_in_deg: deg, hud_in: await readNum(page, 'hud-drive'), hud_out: outDeg, disp_relacion: rel,
      out_expected_deg: expectedOut,
      out_ok: outDeg != null && Math.abs(outDeg - expectedOut) < 1.5,
      ratio_measured: ai ? ai.ratio_measured : null,
    };
    report.driver_samples.push(sample);
    console.log('  driver θ=' + deg + '° → salida ' + outDeg + '° (esperado ' + expectedOut.toFixed(1) + '°), i=' + rel);
    if (!sample.out_ok) driverOk = false;
    relacionMedida = rel != null ? rel : (ai ? ai.ratio_measured : relacionMedida);
    if (deg === 90) {
      const rshot = path.join(OUT, 'rotacion_90.png');
      await page.screenshot({ path: rshot }); report.shots.push(rshot);
    }
  }
  note('driver_ok', driverOk);
  note('relacion_medida', relacionMedida);
  const relacionOk = relacionMedida != null && Math.abs(relacionMedida - I_ESPERADO) < 0.02;
  note('relacion_ok', relacionOk);

  const maxInterf = sweep ? sweep.maxInterference : maxInterfDom;
  const toothVol = sweep ? sweep.toothVolume : null;
  const maxFrac = sweep ? sweep.maxInterferenceFraction : null;
  // Tolerancia: < 0.5% del volumen de un diente (contacto línea/punto).
  const interferenciaOk = maxFrac != null && Number.isFinite(maxFrac) && maxFrac < 5e-3;
  note('max_interferencia', maxInterf);
  note('tooth_volume', toothVol);
  note('max_interferencia_fraccion', maxFrac);
  note('interferencia_ok', interferenciaOk);

  // Refresca el estado final (captura cualquier error surgido durante el driver).
  const stFinal = await api(page);
  const finalError = stFinal ? stFinal.error : st.error;

  const embonan = !!(C_ok && relacionOk && driverOk && interferenciaOk && !finalError);

  const verdict = {
    driver_ok: driverOk,
    relacion_medida: relacionMedida,
    relacion_esperada: I_ESPERADO,
    C_medido, C_esperado: C_ESPERADO, C_ok,
    max_interferencia: maxInterf,
    tooth_volume: toothVol,
    max_interferencia_fraccion: maxFrac,
    interferencia_ok: interferenciaOk,
    embonan,
    shots: report.shots,
    error: finalError,
  };
  note('VERDICT', verdict);

  await browser.close();
  console.log('\n===RESULT===');
  console.log(JSON.stringify(verdict, null, 2));
  fs.writeFileSync(path.join(OUT, 'driver-report.json'), JSON.stringify(report, null, 2));
  if (!embonan) { console.error('QA: NO embonan o el driver falló (ver veredicto)'); process.exit(2); }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
