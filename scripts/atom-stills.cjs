#!/usr/bin/env node
/**
 * atom-stills.cjs — stills deterministas de cinematic-atom.html en tiempos dados.
 * El reloj es window.__cinematicAtom.renderAt(t) (PURO en t). GPU real via ANGLE.
 *
 *   Z=8 TIMES=0,0.3,0.6,1,1.3,3,10 W=1280 H=720 \
 *   BASE_URL=http://localhost:5174 NAME=o2 node scripts/atom-stills.cjs
 * Salida: atom-<NAME>-t<tt>.png en cwd.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');

const W = parseInt(process.env.W || '1280', 10), H = parseInt(process.env.H || '720', 10);
const Z = process.env.Z || '8';
const NAME = process.env.NAME || `z${Z}`;
const TIMES = (process.env.TIMES || '0,0.3,0.6,1,1.3,3,10').split(',').map(Number);
const BASE = process.env.BASE_URL || 'http://localhost:5174';
const MINBYTES = Math.max(8000, Math.floor(W * H / 80));   // frame vivo >> esto

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
      '--use-gl=angle', '--disable-software-rasterizer',
      '--hide-scrollbars', `--window-size=${W},${H}`],
  });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', e => console.log(`  page err: ${e.message.slice(0, 160)}`));
  const TV = process.env.TV || '0';
  await page.goto(`${BASE}/cinematic-atom.html?z=${Z}&tv=${TV}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.ready === true, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);

  for (const tt of TIMES) {
    const f = `atom-${NAME}-t${String(tt).replace('.', '_')}.png`;
    await page.evaluate((t) => window.__cinematicAtom.renderAt(t), tt);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    await page.waitForTimeout(300);
    await page.screenshot({ path: f, type: 'png', timeout: 30000 });
    const sz = fs.statSync(f).size;
    console.log(`${sz >= MINBYTES ? '✓' : '✗ VACÍO'} ${f} (${sz}b)`);
  }
  await browser.close();
})();
