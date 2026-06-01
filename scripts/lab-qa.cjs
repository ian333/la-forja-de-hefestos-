#!/usr/bin/env node
/**
 * lab-qa.cjs — QA visual del quimilab (GaiaLab): carga lab.html, screenshotea cada
 * estado, hace clic en TODOS los botones (tabs + tabla periódica + nav) y captura
 * errores de consola / requests fallidos. Para buscar bugs antes de montar lo nuevo.
 *
 * Uso (iangpu, vite en :5012):  BASE_URL=http://localhost:5012 DISPLAY=:0 GALLIUM_DRIVER=d3d12 node scripts/lab-qa.cjs
 * Salida: dist-video/.qa/*.jpg + lista de errores en stdout.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');

const W = 1366, H = 900;
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist-video', '.qa');
const BASE = process.env.BASE_URL || 'http://localhost:5012';
const PAGE = process.env.QA_PAGE || 'lab.html';
const errs = [];
const log = (...a) => console.log(...a);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--hide-scrollbars', `--window-size=${W},${H}`] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true })).newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text().replace(/\s+/g, ' ').slice(0, 260)); });
  page.on('pageerror', e => errs.push('pageerror: ' + (e.message || '').replace(/\s+/g, ' ').slice(0, 260)));
  page.on('requestfailed', r => { const u = r.url(); if (!/favicon|\.map$/.test(u)) errs.push('reqfail: …' + u.slice(-64) + ' (' + (r.failure() && r.failure().errorText) + ')'); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon|\.map$/.test(r.url())) errs.push('HTTP ' + r.status() + ': …' + r.url().slice(-72)); });

  const shot = async (n) => { await page.waitForTimeout(1000); await page.screenshot({ path: path.join(OUT, n + '.jpg'), type: 'jpeg', quality: 88 }); log('  ✓ ' + n); };

  log('cargando ' + BASE + '/' + PAGE);
  await page.goto(`${BASE}/${PAGE}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3500);
  await shot('00-inicial');

  // probar el toggle CINEMATIC del átomo (la escena cinematic viva)
  try {
    const cine = page.locator('button:has-text("Cinematic")').first();
    if (await cine.count()) { await cine.click({ force: true }); await page.waitForTimeout(3000); await shot('atom-cinematic'); }
    else errs.push('toggle Cinematic: no encontrado');
  } catch (e) { errs.push('toggle Cinematic: ' + e.message.slice(0, 110)); }

  // enumerar botones visibles
  const btns = await page.$$eval('button', els => els.map(e => (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  log('BOTONES únicos (' + new Set(btns).size + '): ' + JSON.stringify([...new Set(btns)].slice(0, 60)));

  // 1) TABS del header — clic forzado (force) para no atorarse con el canvas WebGL
  const tabs = ['Átomo', 'Molécula', 'Enlace', 'Reacción', 'Sandbox'];
  for (const w of tabs) {
    try {
      const el = page.locator(`button:has-text("${w}")`).first();
      if (await el.count()) { await el.click({ force: true, timeout: 4000 }); await page.waitForTimeout(1800); await shot('tab-' + w.replace(/[^a-zA-Z]/g, '')); }
    } catch (e) { errs.push(`click tab "${w}": ${e.message.slice(0, 110)}`); }
  }

  // 2) en el tab Enlace, probar varias moléculas del selector
  try {
    await page.locator('button:has-text("Enlace")').first().click({ force: true }); await page.waitForTimeout(1200);
    for (const m of ['H₂O', 'C₆H₆', 'CO₂', 'NaCl', 'CH₄']) {
      try { const el = page.locator(`button:has-text("${m}")`).first(); if (await el.count()) { await el.click({ force: true, timeout: 3000 }); await shot('mol-' + m.replace(/[^a-zA-Z0-9]/g, '')); } }
      catch (e) { errs.push(`click molécula ${m}: ${e.message.slice(0, 90)}`); }
    }
    // probar slider Fusionar/Disociar
    for (const b of ['Fusionar', 'Disociar']) {
      try { const el = page.locator(`button:has-text("${b}")`).first(); if (await el.count()) { await el.click({ force: true, timeout: 2500 }); } } catch {}
    }
    await shot('enlace-fusion');
  } catch (e) { errs.push('enlace flow: ' + e.message.slice(0, 100)); }

  // 2.5) tab Molécula — la escena CINEMATIC viva + galería (mol, catálogo, cadena, ADN)
  try {
    await page.locator('button:has-text("Molécula")').first().click({ force: true }); await page.waitForTimeout(2500);
    await shot('molecula-inicial');
    for (const f of ['CO₂', 'C₆H₆', 'C₂H₅OH', 'C₈H₁₈', 'doble hélice']) {
      try {
        const el = page.locator(`button:has-text("${f}")`).first();
        if (await el.count()) { await el.click({ force: true, timeout: 3000 }); await page.waitForTimeout(2200); await shot('molgal-' + f.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)); }
      } catch (e) { errs.push(`galería molécula "${f}": ${e.message.slice(0, 90)}`); }
    }
  } catch (e) { errs.push('molécula flow: ' + e.message.slice(0, 110)); }

  // 3) volver a Átomo y cambiar de elemento con "Siguiente" (evita selector de celda)
  try {
    await page.locator('button:has-text("Átomo")').first().click({ force: true }); await page.waitForTimeout(1000);
    for (let i = 0; i < 4; i++) { try { await page.locator('button:has-text("Siguiente"), button:has-text("→")').first().click({ force: true, timeout: 2000 }); await page.waitForTimeout(500); } catch {} }
    await shot('atom-siguiente');
  } catch (e) { errs.push('nav elemento: ' + e.message.slice(0, 100)); }

  await browser.close();
  log('\n══════ ERRORES / CONSOLA (' + new Set(errs).size + ' únicos) ══════');
  if (errs.length === 0) log('  ✓ (ninguno)');
  [...new Set(errs)].forEach(e => log('  ✗ ' + e));
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
