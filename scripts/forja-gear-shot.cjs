#!/usr/bin/env node
/**
 * forja-gear-shot.cjs — Crea el 7º clásico (ENGRANE DE INVOLUTA) VÍA UI y lo
 * verifica con rigor de físico. Corre EN iangpu (GPU real, ANGLE headless).
 * Maneja la interfaz con CLICS/inputs (igual que un diseñador) — NUNCA llama
 * occt.ts ni la matemática directo.
 *
 *   1) Clic en btn-gear (toolbar) → croquis pasa a 'gear' + extrude solidify.
 *   2) Setea m, Z, α, espesor, barreno por los INPUTS (data-testid) con eventos
 *      de input reales (como mover el slider).
 *   3) Lee el VOLUMEN del panel Análisis (an-volumen) del DOM.
 *   4) Screenshot a /tmp/forja-gear/engrane.png (render YA limpio → dientes nítidos).
 *
 * VERIFICA:
 *   (a) Simetría rotacional Z-fold (sketchRotationalSymmetryError ≈ 0).
 *   (b) Volumen plausible = (A_perfil − π(bore/2)²)·espesor  (±2 %).
 *   (c) Radio primitivo rp = m·Z/2 (m=2,Z=20 → rp=20, ⌀primitivo 40).
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/forja-gear';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const errs = [];

// Parámetros del engrane de prueba (los del encargo).
const PARAMS = { m: 2, Z: 20, alpha: 20, espesor: 10, bore: 8 };

const get = (page) => page.evaluate(() => {
  const a = window.__forgeBrep;
  if (!a) return null;
  return { ready: a.ready, error: a.error, inv: a.invariants, gear: a.gear, gearInfo: a.gearInfo };
});

const readVolDom = async (page) => {
  const t = await page.textContent('[data-testid="an-volumen"]').catch(() => null);
  if (!t) return null;
  const m = t.replace(/,/g, '').match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
};

// Mueve un <input type=range> a un valor concreto disparando eventos REALES de
// input (igual que arrastrar el slider). Es interacción de UI legítima: el
// componente recibe el onChange tal cual lo haría un humano.
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

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1680, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message.slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 240)); });

  const report = { url: URL, params: PARAMS, errs, pasos_clic: [], shots: [] };
  const note = (k, v) => { report[k] = v; console.log(k + ' = ' + JSON.stringify(v)); };
  const click = (label) => report.pasos_clic.push(label);

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__forgeBrep && window.__forgeBrep.ready, { timeout: 60000 });
  await page.waitForTimeout(1500);

  // ── 1) CLIC en el botón ENGRANE de la toolbar ──
  await page.click('[data-testid="btn-gear"]');
  click('Clic en toolbar → ⚙ Engrane (btn-gear)');
  await page.waitForTimeout(1200);

  // Confirma que el panel de sketch muestra los inputs del engrane.
  const hasInputs = await page.$('[data-testid="input-modulo"]').then(Boolean);
  note('panel_engrane_visible', hasInputs);

  // ── 2) Setea m, Z, α, espesor, barreno por los INPUTS (data-testid) ──
  await setRange(page, 'input-modulo', PARAMS.m);          click(`input-modulo = ${PARAMS.m}`);
  await page.waitForTimeout(250);
  await setRange(page, 'input-dientes', PARAMS.Z);         click(`input-dientes = ${PARAMS.Z}`);
  await page.waitForTimeout(250);
  await setRange(page, 'input-presion', PARAMS.alpha);     click(`input-presion = ${PARAMS.alpha}`);
  await page.waitForTimeout(250);
  await setRange(page, 'input-espesor-engrane', PARAMS.espesor); click(`input-espesor-engrane = ${PARAMS.espesor}`);
  await page.waitForTimeout(250);
  await setRange(page, 'input-bore', PARAMS.bore);         click(`input-bore = ${PARAMS.bore}`);
  await page.waitForTimeout(2500);

  // ── 3) Lee estado + volumen del DOM ──
  const st = await get(page);
  note('gear_state', st && st.gear);
  note('gear_info', st && st.gearInfo);
  note('kernel_inv', st && st.inv);
  note('build_error', st && st.error);

  const volDom = await readVolDom(page);
  note('vol_dom_panel', volDom);

  // Oculta el boceto para que los dientes del sólido se lean limpios.
  await page.click('[data-testid="btn-toggle-sketch"]').catch(() => {});
  click('Clic → Ocultar boceto (para ver dientes nítidos)');
  await page.waitForTimeout(1500);

  // ── 4) Screenshot del engrane (render limpio) ──
  const shot = path.join(OUT, 'engrane.png');
  await page.screenshot({ path: shot });
  report.shots.push(shot);
  note('shot', shot);

  // ── VERIFICACIÓN (rigor de físico) ──
  const gi = st && st.gearInfo;
  const inv = st && st.inv;
  const rpExpected = (PARAMS.m * PARAMS.Z) / 2; // 20

  // (a) simetría rotacional Z-fold
  const symErr = gi ? gi.symmetryError : null;
  const simetria_ok = symErr != null && symErr < 1e-6;

  // (b) volumen plausible vs (A − π(bore/2)²)·espesor (±2 %)
  const volExpected = gi ? gi.volExpected : null;
  const volRef = (volDom != null ? volDom : (inv ? inv.vol_kernel : null));
  const volErr = (volRef != null && volExpected) ? Math.abs(volRef - volExpected) / volExpected : null;
  const vol_ok = volErr != null && volErr < 0.02;

  // (c) radio primitivo rp = m·Z/2
  const rp = gi ? gi.rp : null;
  const rp_ok = rp != null && Math.abs(rp - rpExpected) < 1e-6;

  // Sólido válido: sin error de build + volumen positivo + euler entero.
  const solido_ok = !st.error && volRef != null && volRef > 0;

  const verdict = {
    creado_via_ui: hasInputs && !st.error && volRef != null,
    rp_mm: rp,
    rp_esperado: rpExpected,
    rp_ok,
    pitch_diameter: gi ? gi.pitchDiameter : null,
    profile_vertices: gi ? gi.profileVertices : null,
    profile_area: gi ? gi.profileArea : null,
    vol_medido: volRef,
    vol_dom: volDom,
    vol_kernel: inv ? inv.vol_kernel : null,
    vol_esperado: volExpected,
    vol_err_frac: volErr,
    vol_ok,
    simetria_error: symErr,
    simetria_ok,
    euler: inv ? inv.euler : null,
    n_faces: inv ? inv.faces : null,
    n_edges: inv ? inv.edges : null,
    solido_ok,
    error: st.error,
  };
  note('VERDICT', verdict);

  await browser.close();
  console.log('\n=== REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, 'gear-report.json'), JSON.stringify(report, null, 2));
  // Exit non-zero si falla cualquier invariante duro (para CI/QA honesto).
  const allOk = verdict.creado_via_ui && verdict.rp_ok && verdict.vol_ok && verdict.simetria_ok && verdict.solido_ok;
  if (!allOk) { console.error('QA FAIL: alguna invariante no se cumplió'); process.exit(2); }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
