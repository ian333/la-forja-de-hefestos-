#!/usr/bin/env node
/**
 * shot-econ.cjs — stills rápidos de las páginas de ECONOMÍA (producción o local)
 * para juzgar el estado visual. GPU real en iangpu.
 *
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 node scripts/shot-econ.cjs
 * Salida: dist-video/.peek/econ-<name>.jpg
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');

const BASE = process.env.BASE_URL || 'https://university.gaiaprime.com.mx';
const W = parseInt(process.env.W || '1920', 10), H = parseInt(process.env.H || '1080', 10);
const OUT = path.join(path.resolve(__dirname, '..'), 'dist-video', '.peek');

// Captura la CLASE CINE: click en play y stills a varios tiempos.
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', `--window-size=${W},${H}`] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  const id = process.env.CLASE || 'econ-2018-romer-nordhaus';
  const times = (process.env.TIMES || '8,25,60,120').split(',').map(Number);
  await page.goto(`${BASE}/clase.html?id=${id}`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(5000);
  // click al centro (botón play)
  await page.mouse.click(W / 2, H / 2);
  console.log('play clicked');
  let elapsed = 0;
  for (const t of times) {
    await page.waitForTimeout((t - elapsed) * 1000);
    elapsed = t;
    const f = path.join(OUT, `clase-${id.slice(0, 12)}-t${t}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 88 });
    console.log(`✓ t=${t}s`);
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
