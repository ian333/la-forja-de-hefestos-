#!/usr/bin/env node
/**
 * shot-clase.cjs — stills de una MASTERCLASS cine (clase.html) en beats dados.
 * El reloj de la clase ES el audio → click play + override determinista __cineT.
 *
 * ROBUSTO: espera __nebulaReady (bin de nebulosa cargado) y, si un frame sale
 * VACÍO (context-lost: archivo tiny por GPU degradada en WSL), reinicia el
 * browser entero y reintenta ese tiempo — igual que render-clase.
 *
 *   ID=econ-2018-romer-nordhaus TIMES=5,40,86,113 W=1080 H=1920 \
 *   BASE_URL=http://localhost:8099 node scripts/shot-clase.cjs
 * Salida: clase-<NAME>-t<tt>.png  (cwd del proceso)
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');

const W = parseInt(process.env.W || '1080', 10), H = parseInt(process.env.H || '1920', 10);
const ID = process.env.ID || 'econ-2018-romer-nordhaus';
const NAME = process.env.NAME || 'romer';
const TIMES = (process.env.TIMES || '5,40,86,113').split(',').map(Number);
const BASE = process.env.BASE_URL || 'http://localhost:8099';
const WAIT = parseInt(process.env.WAIT || '6000', 10);
const MINBYTES = Math.max(120000, Math.floor(W * H / 26));   // frame vivo >> esto; vacío <<

const LAUNCH = () => chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
  args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle',
    '--disable-software-rasterizer', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
    '--hide-scrollbars', `--window-size=${W},${H}`] });

(async () => {
  let browser = await LAUNCH();
  let page = null;
  const fresh = async () => {
    if (page) { await page.context().browser().close().catch(() => {}); }
    browser = await LAUNCH();
    page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
    await page.goto(`${BASE}/clase.html?id=${ID}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(WAIT);
    await page.waitForFunction(() => window.__nebulaReady === true, { timeout: 60000 }).catch(() => {});
    const btn = await page.$('[data-cine-play]');
    if (btn) { await btn.click(); await page.waitForTimeout(1200); }
    await page.evaluate(() => { const a = document.querySelector('audio'); if (a) a.pause(); });
    await page.waitForTimeout(600);
  };
  await (await browser.newContext()).close().catch(() => {});  // descarta el ctx inicial vacío
  await browser.close().catch(() => {});
  await fresh();

  for (const tt of TIMES) {
    const f = `clase-${NAME}-t${String(tt).replace('.', '_')}.png`;
    let ok = false;
    for (let attempt = 0; attempt < 6 && !ok; attempt++) {
      try {
        await page.evaluate((t) => { window.__cineT = t; const a = document.querySelector('audio'); if (a) a.pause(); }, tt);
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
        await page.waitForTimeout(500);
        await page.screenshot({ path: f, type: 'png', timeout: 30000 });
        if (fs.statSync(f).size >= MINBYTES) { ok = true; console.log(`✓ ${f}`); }
        else { console.log(`  ✗ ${f} VACÍO (intento ${attempt + 1}) — browser fresco`); fs.rmSync(f, { force: true }); await fresh(); }
      } catch (e) { console.log(`  ⚠ ${f}: ${e.message.slice(0, 120)} — browser fresco`); await fresh().catch(() => {}); }
    }
    if (!ok) console.log(`✗✗ ${f} no se pudo (6 intentos)`);
  }
  await browser.close().catch(() => {});
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
