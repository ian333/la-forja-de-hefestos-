#!/usr/bin/env node
/** repro mínimo: ¿visitar Sandbox una vez mata las demás pestañas? */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const W = 1366, H = 900;
const OUT = path.join(path.resolve(__dirname, '..'), 'dist-video', '.qa-sb');
const BASE = process.env.BASE_URL || 'http://localhost:5012';
const log = (...a) => console.log(...a);
const evs = [];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', `--window-size=${W},${H}`] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true })).newPage();
  page.on('console', m => { const t = m.text(); if (/context|webgl|lost|GL_|too many|CONTEXT_LOST/i.test(t)) evs.push('[console] ' + t.slice(0, 160)); });
  page.on('pageerror', e => evs.push('[pageerror] ' + (e.message || '').slice(0, 160)));
  const shot = async (n) => { await page.waitForTimeout(1200); const p = path.join(OUT, n + '.jpg'); await page.screenshot({ path: p, type: 'jpeg', quality: 85 });
    const sz = fs.statSync(p).size; log(`  ${sz < 12000 ? '✗ NEGRO' : '✓ ok   '} ${n} (${(sz / 1024).toFixed(0)} KB)`); };
  const tab = async (t) => { await page.locator(`button:has-text("${t}")`).first().click({ force: true }); await page.waitForTimeout(1800); };

  await page.goto(`${BASE}/lab.html`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // monitor de contextos vivos (instrumenta WebGL): cuántos contextos crea Chrome
  await page.addInitScript(() => {});

  log('A) carga inicial (Átomo)');           await shot('a-atomo');
  log('B) → Sandbox');     await tab('Sandbox');   await shot('b-sandbox');
  log('C) → Molécula (¿negra tras Sandbox?)'); await tab('Molécula'); await shot('c-molecula-postSB');
  log('D) → Átomo');       await tab('Átomo');     await shot('d-atomo-postSB');
  log('E) → Enlace');      await tab('Enlace');    await shot('e-enlace-postSB');

  await browser.close();
  log('\n── eventos GPU/error (' + new Set(evs).size + ') ──');
  [...new Set(evs)].forEach(e => log('  ' + e));
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
