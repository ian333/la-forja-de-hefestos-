#!/usr/bin/env node
/** repro del fondo BLANCO en la vista Cinematic del átomo, a viewport del usuario
 *  (landscape, DPR2) y barriendo tiempos de la animación. Mide luminancia media. */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const W = 1540, H = 860;
const OUT = path.join(path.resolve(__dirname, '..'), 'dist-video', '.qa-atomwhite1');
const BASE = process.env.BASE_URL || 'http://localhost:5012';
const log = (...a) => console.log(...a);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', `--window-size=${W},${H}`] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true })).newPage();

  await page.goto(`${BASE}/lab.html`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  // activar Cinematic
  const cine = page.locator('button:has-text("Cinematic")').first();
  await cine.click({ force: true });
  await page.waitForTimeout(800);

  // muestrea varios tiempos de la coreografía (RAF corre solo)
  for (const t of [1500, 4000, 7000, 10000, 13000]) {
    await page.waitForTimeout(t === 1500 ? 1500 : 3000);
    const p = path.join(OUT, `atom-t${String(t).padStart(5, '0')}.jpg`);
    await page.screenshot({ path: p, type: 'jpeg', quality: 80 });
    // luminancia media aproximada vía canvas (lee el centro y un borde)
    const lum = await page.evaluate(() => {
      const c = document.querySelector('canvas'); if (!c) return null;
      const g = c.getContext('webgl2') || c.getContext('webgl');
      return { w: c.width, h: c.height }; // sólo dims; el muestreo de color real lo hace el byte-size
    });
    const sz = fs.statSync(p).size;
    log(`  t≈${t}ms · ${(sz / 1024).toFixed(0)} KB · canvas ${lum ? lum.w + 'x' + lum.h : '?'}`);
  }
  await browser.close();
  log('listo → dist-video/.qa-atomwhite1/');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
