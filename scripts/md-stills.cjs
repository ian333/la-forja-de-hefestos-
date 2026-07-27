#!/usr/bin/env node
/**
 * md-stills.cjs — stills de verificación del auto-ensamble del agua (m=wmd).
 * GPU real en iangpu. Captura varios t a lo largo del viaje.
 *   BASE_URL=http://localhost:5178 M=wmd node scripts/md-stills.cjs
 * Salida: _o2_proof/md-stills/wmd-t<t>.png
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');

const W = parseInt(process.env.W || '1080', 10), H = parseInt(process.env.H || '1920', 10);
const M = process.env.M || 'wmd';
const BASE = process.env.BASE_URL || 'http://localhost:5178';
const TIMES = (process.env.TIMES || '0.1,2,4,7,10,13,15.5').split(',').map(parseFloat);
const OUT = path.resolve(__dirname, '..', '_o2_proof', 'md-stills');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle',
           '--use-angle=gl', '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true });
  const page = await ctx.newPage();
  page.on('console', m => { const t = m.text(); if (/error|fail|warn|NaN|undefined is not/i.test(t)) console.log('  [console]', t.slice(0, 200)); });
  page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 300)));
  const url = `${BASE}/cinematic-molecule.html?m=${M}`;
  console.log('goto', url);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  // verifica GPU real (no SwiftShader)
  const gpu = await page.evaluate(() => {
    const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a';
  });
  console.log('GPU:', gpu);
  await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.ready === true, { timeout: 40000 });
  const dur = await page.evaluate(() => window.__cinematicAtom.duration);
  console.log('ready · dur =', dur);
  for (const t of TIMES) {
    await page.evaluate((tt) => window.__cinematicAtom.renderAt(tt), t);
    await page.waitForTimeout(350);
    const f = path.join(OUT, `wmd-t${String(t).replace('.', '_')}.png`);
    await page.screenshot({ path: f, timeout: 30000 });
    console.log('  still', t, '→', f);
  }
  await ctx.close(); await browser.close();
  console.log('MD_STILLS_LISTO');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
