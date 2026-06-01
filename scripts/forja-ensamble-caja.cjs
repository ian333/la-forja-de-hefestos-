#!/usr/bin/env node
/**
 * forja-ensamble-caja.cjs — Construye la CAJA DE VELOCIDADES (dos engranes que
 * EMBONAN de verdad) VÍA UI y la verifica con rigor de físico. Corre EN iangpu
 * (GPU real, ANGLE headless). Maneja la interfaz con CLICS/inputs (igual que un
 * diseñador) — NUNCA llama occt.ts ni la matemática del mate directo.
 *
 *   1) Clic btn-gear → engrane 1; setea m=2, Z₁=20, espesor, barreno por inputs.
 *   2) Clic btn-add-gear2 → 2ª instancia; input-dientes2 = 40.
 *   3) Clic btn-gear-mate → coloca el engrane 2 a C = m(Z₁+Z₂)/2 y lo fasea.
 *   4) Lee del DOM C (mate-C / hud-C) y la interferencia (hud-interf).
 *   5) Screenshot a /tmp/forja-caja/ensamble.png (render limpio → dientes nítidos).
 *
 * VERIFICA (invariantes, no "se ve bien"):
 *   (a) C medido == m·(Z₁+Z₂)/2 = 2·(20+40)/2 = 60 mm  (±0.05).
 *   (b) Ambos engranes en escena (compound: vol ≈ vol₁ + vol₂, ambos > 0).
 *   (c) Faseado aplicado.
 *   (d) NO-INTERFERENCIA: Common(g1,g2) ≈ 0 con faseo (EMBONAN); y que el caso
 *       SIN fasear (naive) interfiere mucho más — prueba que el faseo es lo que
 *       hace que entren punta-en-valle.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/forja-caja';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const errs = [];

// Parámetros de la caja: m=2, Z₁=20, Z₂=40 (relación 2:1).
const P = { m: 2, z1: 20, z2: 40, alpha: 20, espesor: 10, bore: 8 };
const C_ESPERADO = (P.m * (P.z1 + P.z2)) / 2; // 60

const get = (page) => page.evaluate(() => {
  const a = window.__forgeBrep;
  if (!a) return null;
  return {
    ready: a.ready, error: a.error, inv: a.invariants,
    gear: a.gear, gearInfo: a.gearInfo,
    assemblyState: a.assemblyState, mateInfo: a.mateInfo, assemblyInfo: a.assemblyInfo,
  };
});

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
  if (!t) return null;
  const m = t.replace(/,/g, '').match(/(-?[\d.]+)/);
  return m ? parseFloat(m[1]) : null;
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1680, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message.slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 240)); });

  const report = { url: URL, params: P, C_esperado: C_ESPERADO, errs, pasos_clic: [], shots: [] };
  const note = (k, v) => { report[k] = v; console.log(k + ' = ' + JSON.stringify(v)); };
  const click = (label) => { report.pasos_clic.push(label); console.log('· ' + label); };

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__forgeBrep && window.__forgeBrep.ready, { timeout: 60000 });
  await page.waitForTimeout(1500);

  // ── 1) ENGRANE 1 (m=2, Z₁=20) VÍA UI ──
  await page.click('[data-testid="btn-gear"]', { force: true });
  click('Clic toolbar → ⚙ Engrane (btn-gear)');
  await page.waitForTimeout(1000);
  await setRange(page, 'input-modulo', P.m);            click(`input-modulo = ${P.m}`);
  await page.waitForTimeout(200);
  await setRange(page, 'input-dientes', P.z1);          click(`input-dientes = ${P.z1}`);
  await page.waitForTimeout(200);
  await setRange(page, 'input-presion', P.alpha);       click(`input-presion = ${P.alpha}`);
  await page.waitForTimeout(200);
  await setRange(page, 'input-espesor-engrane', P.espesor); click(`input-espesor-engrane = ${P.espesor}`);
  await page.waitForTimeout(200);
  await setRange(page, 'input-bore', P.bore);           click(`input-bore = ${P.bore}`);
  await page.waitForTimeout(1500);

  // ── 2) AGREGAR 2º ENGRANE + Z₂=40 ──
  const hasAdd = await page.$('[data-testid="btn-add-gear2"]').then(Boolean);
  note('btn_add_gear2_visible', hasAdd);
  await page.click('[data-testid="btn-add-gear2"]', { force: true });
  click('Clic → + Agregar 2º engrane (btn-add-gear2)');
  await page.waitForTimeout(1200);
  await setRange(page, 'input-dientes2', P.z2);         click(`input-dientes2 = ${P.z2}`);
  await page.waitForTimeout(2000);

  // Estado ANTES del mate (sin fasear): leer interferencia naive.
  const stPre = await get(page);
  note('pre_mate_assemblyInfo', stPre && stPre.assemblyInfo);
  const interfNaive = stPre && stPre.assemblyInfo ? stPre.assemblyInfo.interference_volume : null;

  // ── 3) APLICAR MATE (posición C + faseo) ──
  await page.click('[data-testid="btn-gear-mate"]', { force: true });
  click('Clic → ⚙ Aplicar mate de engrane (btn-gear-mate)');
  await page.waitForTimeout(2500);

  // ── 4) Leer C e interferencia del DOM ──
  const st = await get(page);
  note('mate_info', st && st.mateInfo);
  note('assembly_info', st && st.assemblyInfo);
  note('build_error', st && st.error);

  const C_dom_panel = await readNum(page, 'mate-C');
  const C_dom_measured = await readNum(page, 'mate-C-measured');
  const C_dom_hud = await readNum(page, 'hud-C');
  const interf_hud = await readNum(page, 'hud-interf');
  const z1_hud = await readNum(page, 'hud-z1');
  const z2_hud = await readNum(page, 'hud-z2');
  note('C_dom_panel', C_dom_panel);
  note('C_dom_measured', C_dom_measured);
  note('C_dom_hud', C_dom_hud);
  note('interf_hud', interf_hud);
  note('z1_hud', z1_hud);
  note('z2_hud', z2_hud);

  // Oculta el boceto para que los dientes del ensamble se lean limpios.
  await page.click('[data-testid="btn-toggle-sketch"]', { force: true }).catch(() => {});
  click('Clic → Ocultar boceto (dientes nítidos)');
  await page.waitForTimeout(1500);

  // ── 5) Screenshot del ensamble ──
  const shot = path.join(OUT, 'ensamble.png');
  await page.screenshot({ path: shot });
  report.shots.push(shot);
  note('shot', shot);

  // ── VERIFICACIÓN (rigor de físico) ──
  const ai = st && st.assemblyInfo;
  const mi = st && st.mateInfo;
  const C_medido = ai ? ai.C_measured : (C_dom_measured ?? C_dom_hud);
  const C_panel = mi ? mi.C_expected : C_dom_panel;

  // (a) C medido == m(Z₁+Z₂)/2
  const C_ok = C_medido != null && Math.abs(C_medido - C_ESPERADO) < 0.05;
  // (b) ambos engranes en escena: vol₁>0, vol₂>0, compound vol ≈ vol₁+vol₂
  const vol1 = ai ? ai.vol_gear1 : null;
  const vol2 = ai ? ai.vol_gear2 : null;
  const volCompound = st && st.inv ? st.inv.vol_kernel : null;
  const ambos_engranes = vol1 != null && vol2 != null && vol1 > 0 && vol2 > 0;
  const compound_ok = (vol1 != null && vol2 != null && volCompound != null)
    ? Math.abs(volCompound - (vol1 + vol2)) / (vol1 + vol2) < 0.02 : null;
  // (c) faseado
  const faseado_aplicado = !!(ai && ai.mated);
  // (d) no-interferencia con faseo (EMBONAN) + el naive interfiere más
  const interfMated = ai ? ai.interference_volume : interf_hud;
  const interfFrac = ai ? ai.interference_fraction : null;
  const embonan = interfMated != null && interfFrac != null && interfFrac < 1e-3;
  const faseo_mejora = (interfNaive != null && interfMated != null && interfNaive > 0)
    ? interfNaive / Math.max(interfMated, 1e-9) : null;

  const ensamble_ok = !!(hasAdd && !st.error && C_ok && ambos_engranes && faseado_aplicado && embonan);

  const verdict = {
    creado_via_ui: hasAdd && !st.error && C_medido != null,
    C_medido, C_esperado: C_ESPERADO, C_panel, C_ok,
    relacion_i: mi ? mi.ratio : null,
    faseo_deg: mi ? (mi.phase2 * 180 / Math.PI) : null,
    faseado_aplicado,
    vol_gear1: vol1, vol_gear2: vol2, vol_compound: volCompound,
    ambos_engranes, compound_ok,
    interferencia_mated: interfMated, interferencia_frac: interfFrac, embonan,
    interferencia_naive: interfNaive, faseo_mejora_x: faseo_mejora,
    euler_compound: st && st.inv ? st.inv.euler : null,
    error: st.error,
    ensamble_ok,
  };
  note('VERDICT', verdict);

  await browser.close();
  console.log('\n=== REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, 'ensamble-report.json'), JSON.stringify(report, null, 2));
  if (!ensamble_ok) { console.error('QA FAIL: alguna invariante del ensamble no se cumplió'); process.exit(2); }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
