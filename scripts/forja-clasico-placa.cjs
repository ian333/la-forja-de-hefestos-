#!/usr/bin/env node
/**
 * forja-clasico-placa.cjs — Crea la pieza clásica "Placa con barreno pasante"
 * ENTERAMENTE VÍA LA INTERFAZ (clics reales en data-testid), nada de occt.ts.
 *
 * Operaciones (todas por clic):
 *   1. sketch:rectángulo  -> seg-rect + cotas (input-ancho / input-alto)  [smart-dimension]
 *   2. extrude:boss-base   -> input-altura (op de extrude que ya existe en el grafo)
 *   3. sketch:círculo en cara superior + extrude-cut through-all -> btn-hole
 *      + input-diametro + input-pos-x/y + chk-pasante (through all)
 *
 * Tras cada paso leemos del DOM las invariantes (Euler V−E+F, volumen) y el
 * panel de Análisis (masa/volumen/COM). Screenshot final 9:16.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const W = 1080, H = 1920;
const BASE = process.env.BASE_URL || 'http://localhost:5002';
const PAGE = 'forja-brep.html';
const OUT_DIR = '/tmp/forja-clasicos';
const OUT = path.join(OUT_DIR, 'Placa-con-barreno-pasante-plate-with-a-hole-.png');

// Cotas objetivo de la placa (mm)
const TARGET = { ancho: 60, alto: 40, altura: 8, diametro: 12, posx: 0, posy: 0 };

const log = (...a) => console.log(...a);

// Mueve un <input type=range> a un valor exacto disparando eventos de React.
async function setRange(page, testid, value) {
  const sel = `[data-testid="${testid}"]`;
  await page.waitForSelector(sel, { timeout: 10000 });
  await page.evaluate(({ sel, value }) => {
    const el = document.querySelector(sel);
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, String(value));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { sel, value });
}

// Espera a que el kernel + primer build estén listos.
async function waitReady(page) {
  await page.waitForFunction(() => {
    const a = window.__forgeBrep;
    return a && a.ready === true && a.invariants;
  }, null, { timeout: 60000 });
}

// Espera a que las invariantes se estabilicen tras una mutación.
async function readInv(page) {
  // Re-build es async (requestAnimationFrame); damos 2 frames + margen.
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  await page.waitForTimeout(250);
  // Lectura DESDE EL DOM (los testids visibles), no desde el hook.
  return await page.evaluate(() => {
    const txt = (id) => {
      const e = document.querySelector(`[data-testid="${id}"]`);
      return e ? e.textContent.trim() : null;
    };
    const inv = document.querySelector('[data-testid="invariants"]');
    return {
      dom: {
        invariants_text: inv ? inv.textContent.replace(/\s+/g, ' ').trim() : null,
        an_volumen: txt('an-volumen'),
        an_area: txt('an-area'),
        an_masa: txt('an-masa'),
        an_com: txt('an-com'),
        an_inercia: txt('an-inercia'),
        kernel_status: txt('kernel-status'),
      },
      // cross-check numérico desde el hook (mismo estado, solo para validar números)
      hook: window.__forgeBrep ? window.__forgeBrep.invariants : null,
      error: window.__forgeBrep ? window.__forgeBrep.error : null,
    };
  });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const consoleErrors = [];
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
      '--use-gl=angle', '--hide-scrollbars', `--window-size=${W},${H}`],
  });
  const page = await (await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true,
  })).newPage();
  page.on('console', m => { if (m.type() === 'error') { consoleErrors.push(m.text().slice(0, 300)); log('  [console.error]', m.text().slice(0, 200)); } });
  page.on('pageerror', e => { consoleErrors.push('PAGEERROR ' + String(e.message).slice(0, 300)); });

  const steps = [];
  const record = (clic, inv) => { steps.push({ clic, inv }); };

  log('→ goto', `${BASE}/${PAGE}`);
  await page.goto(`${BASE}/${PAGE}`, { waitUntil: 'networkidle', timeout: 60000 });
  await waitReady(page);
  log('✓ kernel OCCT listo + primer build');

  // ── PASO 1: SKETCH RECTÁNGULO (clic en el feature Sketch, luego seg-rect) ──
  await page.click('[data-testid="feat-sketch"]');
  await page.waitForSelector('[data-testid="seg-rect"]', { timeout: 10000 });
  await page.click('[data-testid="seg-rect"]');
  let inv = await readInv(page);
  record('clic feat-sketch + clic seg-rect (perfil rectángulo en plano XY)', inv.dom);
  log('  [1] sketch rect:', inv.dom.invariants_text);

  // ── PASO 2: SMART-DIMENSION del rectángulo (cotas ancho/alto vía inputs) ──
  await setRange(page, 'input-ancho', TARGET.ancho);
  await setRange(page, 'input-alto', TARGET.alto);
  inv = await readInv(page);
  record(`set input-ancho=${TARGET.ancho}mm, input-alto=${TARGET.alto}mm (smart-dimension)`, inv.dom);
  log('  [2] cotas placa:', inv.dom.invariants_text);

  // ── PASO 3: EXTRUDE BOSS/BASE (clic en el feature Extrude, set altura) ──
  await page.click('[data-testid="feat-extrude"]');
  await page.waitForSelector('[data-testid="input-altura"]', { timeout: 10000 });
  await setRange(page, 'input-altura', TARGET.altura);
  inv = await readInv(page);
  record(`clic feat-extrude + set input-altura=${TARGET.altura}mm (boss/base => sólido placa)`, inv.dom);
  log('  [3] extrude placa:', inv.dom.invariants_text, '| masa', inv.dom.an_masa);
  const afterExtrude = inv;

  // ── PASO 4: HOLE = sketch círculo en cara sup + extrude-cut through-all ──
  await page.click('[data-testid="btn-hole"]');
  await page.waitForSelector('[data-testid="input-diametro"]', { timeout: 10000 });
  await setRange(page, 'input-diametro', TARGET.diametro);
  await setRange(page, 'input-pos-x', TARGET.posx);
  await setRange(page, 'input-pos-y', TARGET.posy);
  // Asegurar PASANTE (through all). El default ya es true; lo verificamos por estado.
  const pasanteOn = await page.isChecked('[data-testid="chk-pasante"]');
  if (!pasanteOn) await page.click('[data-testid="chk-pasante"]');
  inv = await readInv(page);
  record(`clic btn-hole + input-diametro=${TARGET.diametro}mm + pos(${TARGET.posx},${TARGET.posy}) + chk-pasante=ON (extrude-cut through-all)`, inv.dom);
  log('  [4] barreno pasante:', inv.dom.invariants_text, '| masa', inv.dom.an_masa, '| COM', inv.dom.an_com);
  const afterHole = inv;

  // ── VERIFICACIÓN de invariantes ──
  const hk = afterHole.hook;
  const ex = afterExtrude.hook;
  const checks = {
    error: afterHole.error,
    ops: hk ? hk.ops : null,
    euler: hk ? hk.euler : null,
    V: hk ? hk.vertices : null, E: hk ? hk.edges : null, F: hk ? hk.faces : null,
    vol_after_extrude: ex ? ex.vol_kernel : null,
    vol_after_hole: hk ? hk.vol_kernel : null,
    mass_g: hk ? hk.mass_g : null,
    com: hk ? hk.com : null,
  };
  // Volumen esperado: placa 60*40*8 = 19200 ; hueco = pi*r^2*h = pi*6^2*8 = 904.78
  const volPlaca = TARGET.ancho * TARGET.alto * TARGET.altura;
  const volHueco = Math.PI * (TARGET.diametro / 2) ** 2 * TARGET.altura;
  checks.vol_expected_placa = volPlaca;
  checks.vol_expected_hole = +(volPlaca - volHueco).toFixed(2);
  checks.vol_drop_ok = ex && hk ? (ex.vol_kernel > hk.vol_kernel) : false;
  // Euler de un sólido con un agujero pasante (toro topológico, género 1) NO es 2.
  // V−E+F = 2−2g => g=1 => Euler=0. Verificamos plausibilidad (placa: euler 2).
  checks.euler_placa = ex ? ex.euler : null;
  checks.vol_match = hk ? Math.abs(hk.vol_kernel - checks.vol_expected_hole) < 5 : false;

  log('\n=== VERIFICACIÓN ===');
  log(JSON.stringify(checks, null, 2));

  // ── SCREENSHOT FINAL (con chrome visible: se ve análisis + invariantes) ──
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT, type: 'png', animations: 'disabled' });
  log('\n✓ screenshot', OUT);

  const result = {
    steps,
    checks,
    final_dom: afterHole.dom,
    consoleErrors,
    shot: OUT,
  };
  fs.writeFileSync('/tmp/forja-clasicos/placa-result.json', JSON.stringify(result, null, 2));
  log('\n=== RESULT JSON ===');
  log(JSON.stringify(result, null, 2));

  await browser.close();
})().catch(e => { console.error('FATAL', e.stack || e.message); process.exit(1); });
