#!/usr/bin/env node
/**
 * qa-molecule-tab.cjs — valida la pestaña Molécula EN AISLAMIENTO (sin pasar por
 * Sandbox, que satura el contexto GPU). Carga lab.html, va a Molécula, recorre
 * varias moléculas/cadenas/catálogo/ADN y screenshotea cada una. Reporta si alguna
 * sale NEGRA (frame casi-uniforme = render muerto).
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const W = 1366, H = 900;
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist-video', '.qa-mol');
const BASE = process.env.BASE_URL || 'http://localhost:5012';
const errs = [];
const log = (...a) => console.log(...a);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--hide-scrollbars', `--window-size=${W},${H}`] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true })).newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text().replace(/\s+/g, ' ').slice(0, 200)); });
  page.on('pageerror', e => errs.push('pageerror: ' + (e.message || '').replace(/\s+/g, ' ').slice(0, 200)));

  // ¿la captura es "negra"? (cuenta bytes del jpeg: <12KB = casi-uniforme)
  const shotBlack = async (n) => {
    await page.waitForTimeout(900);
    const p = path.join(OUT, n + '.jpg');
    await page.screenshot({ path: p, type: 'jpeg', quality: 88 });
    const sz = fs.statSync(p).size;
    const black = sz < 12000;
    log(`  ${black ? '✗ NEGRO' : '✓'} ${n} (${(sz / 1024).toFixed(0)} KB)`);
    if (black) errs.push(`FRAME NEGRO: ${n} (${sz} bytes)`);
    return !black;
  };

  log('cargando ' + BASE + '/lab.html');
  await page.goto(`${BASE}/lab.html`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // → pestaña Molécula
  await page.locator('button:has-text("Molécula")').first().click({ force: true });
  await page.waitForTimeout(2500);
  await shotBlack('00-molecula-h2o');

  // recorrer una de cada sección (formulas tal como aparecen en los botones)
  const targets = ['CO₂', 'NH₃', 'CH₄', 'C₆H₁₄', 'C₈H₁₈', 'caroteno', 'cadena π', 'C2H5OH', 'C8H18', 'CH3COOH', 'doble hélice', 'TTAGGG'];
  for (const f of targets) {
    try {
      const el = page.locator(`button:has-text("${f}")`).first();
      if (await el.count()) {
        await el.click({ force: true, timeout: 3500 });
        await shotBlack('mol-' + f.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12));
      } else log('  · (no botón) ' + f);
    } catch (e) { errs.push(`click ${f}: ${e.message.slice(0, 80)}`); }
  }

  await browser.close();
  log('\n══════ RESULTADO (' + new Set(errs).size + ' problemas) ══════');
  if (errs.length === 0) log('  ✓ TODAS las moléculas renderizaron (ninguna negra, sin errores)');
  [...new Set(errs)].forEach(e => log('  ✗ ' + e));
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
