#!/usr/bin/env node
/**
 * forja-realista-shot.cjs — Verifica el RENDER METAL REAL del Part Studio.
 * Corre EN iangpu (GPU RTX real, ANGLE D3D12). Maneja la UI con clics/inputs.
 *
 *   A) Engrane de involuta (m=2, Z=20), material aluminio (default).
 *   B) Cambia el selector a LATÓN → debe verse DORADO (el selector por fin
 *      cambia el render, no solo la masa).
 *   C) Caja de velocidades: 2º engrane + mate + flechas + carcasa (acero).
 *
 * Screenshots a /home/ian/Orkesta/la-forja/forja-shots/ para juicio con VISIÓN.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/home/ian/Orkesta/la-forja/forja-shots';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const errs = [];

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
    args: [
      '--use-angle=gl', '--use-gl=angle', '--enable-gpu', '--enable-webgl',
      '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--no-sandbox',
    ],
  });
  const page = await (await browser.newContext({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 })).newPage();
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message.slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 240)); });

  const report = { url: URL, errs, shots: [], steps: [] };
  const note = (k, v) => { report[k] = v; console.log(k + ' = ' + JSON.stringify(v)); };

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__forgeBrep && window.__forgeBrep.ready, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const renderer = await page.evaluate(() => {
    try {
      const c = document.querySelector('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    } catch (e) { return 'unknown'; }
  });
  note('renderer', renderer);

  // ── 1) ENGRANE (aluminio) ──
  await page.click('[data-testid="btn-gear"]');
  report.steps.push('btn-gear');
  await page.waitForTimeout(1000);
  await setRange(page, 'input-modulo', 2);
  await setRange(page, 'input-dientes', 20);
  await setRange(page, 'input-presion', 20);
  await setRange(page, 'input-espesor-engrane', 10);
  await setRange(page, 'input-bore', 8);
  await page.waitForTimeout(2200);

  // ── 2) ENGRANE solo: ocultar boceto → dientes nítidos ──
  await page.click('[data-testid="btn-toggle-sketch"]', { noWaitAfter: true }).catch(() => {});
  await page.waitForTimeout(1600);

  let shot = path.join(OUT, 'realista-engrane.png');
  await page.screenshot({ path: shot });
  report.shots.push(shot); note('shot_engrane', shot);
  await page.screenshot({ path: path.join(OUT, 'crop-engrane.png'), clip: { x: 560, y: 230, width: 620, height: 560 } });
  report.shots.push(path.join(OUT, 'crop-engrane.png'));

  // ── 3) LATÓN ──
  await page.selectOption('[data-testid="select-material"]', 'brass');
  report.steps.push('select-material=brass');
  await page.waitForTimeout(1600);
  shot = path.join(OUT, 'realista-laton.png');
  await page.screenshot({ path: shot });
  report.shots.push(shot); note('shot_laton', shot);
  await page.screenshot({ path: path.join(OUT, 'crop-laton.png'), clip: { x: 560, y: 230, width: 620, height: 560 } });
  report.shots.push(path.join(OUT, 'crop-laton.png'));

  // ── 4) CAJA DE VELOCIDADES (acero) — vía API determinista __forgeBrep ──
  // (las funciones addGear2/setTeeth2/applyGearMate/setShafts/setHousing están
  // expuestas en window.__forgeBrep — mismo efecto que los clics, sin fragilidad
  // de estado de panel; es interacción legítima del documento.)
  await page.selectOption('[data-testid="select-material"]', 'steel');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const a = window.__forgeBrep;
    a.addGear2();
    a.setTeeth2(40);
    a.applyGearMate();
  });
  report.steps.push('api:addGear2+teeth2=40+mate');
  await page.waitForTimeout(1800);
  await page.evaluate(() => { window.__forgeBrep.setShafts(true); });
  report.steps.push('api:setShafts(true)');
  await page.waitForTimeout(1600);
  await page.evaluate(() => { window.__forgeBrep.setHousing(true); });
  report.steps.push('api:setHousing(true)');
  await page.waitForTimeout(2600);
  note('assembly_state', await page.evaluate(() => window.__forgeBrep?.assemblyState));

  shot = path.join(OUT, 'realista-caja.png');
  await page.screenshot({ path: shot });
  report.shots.push(shot); note('shot_caja', shot);
  await page.screenshot({ path: path.join(OUT, 'crop-caja.png'), clip: { x: 470, y: 250, width: 780, height: 560 } });
  report.shots.push(path.join(OUT, 'crop-caja.png'));

  note('errs_count', errs.length);
  note('errs', errs.slice(0, 8));
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'realista-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== DONE ===\n' + report.shots.join('\n'));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
