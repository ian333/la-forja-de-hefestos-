#!/usr/bin/env node
/**
 * sandman-shot.cjs — stills de verificación del test Sandman (GPU real, iangpu).
 * Captura N tiempos de cinematic-sandman.html ANTES de invertir en el clip.
 *
 * Uso (iangpu, vite dev):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   BASE_URL=http://localhost:5210 TS="0,0.5,1.5,2.6,3.6,4.8,5.8,7.0,8.2,9.5" \
 *   OUT_DIR=forja-shots/sandman node scripts/sandman-shot.cjs
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const W = 1080, H = 1920;
const BASE = process.env.BASE_URL || 'http://localhost:5210';
const TS = (process.env.TS || '0,0.5,1.5,2.6,3.6,4.8,5.8,7.0,8.2,9.5').split(',').map(Number);
const OUT_DIR = process.env.OUT_DIR || path.join(ROOT, 'forja-shots', 'sandman');
const PAGE = `${BASE}/cinematic-sandman.html`;

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const gpuArgs = ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
    '--enable-webgl', '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`];
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable', args: gpuArgs });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
  await page.goto(PAGE, { waitUntil: 'networkidle', timeout: 60000 });
  // probe GL: GPU real o SwiftShader (no adivinar — memoria de render negro)
  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2');
    if (!g) return 'NO-WEBGL2';
    const ext = g.getExtension('WEBGL_debug_renderer_info');
    return ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'sin debug info';
  });
  console.log('GL:', gl);
  await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(700);
  const settle = () => page.evaluate(() => new Promise(r =>
    requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  for (const t of TS) {
    await page.evaluate((tt) => window.__cinematicAtom.renderAt(tt), t);
    await settle();
    const fp = path.join(OUT_DIR, `t${t.toFixed(1).replace('.', '_')}.png`);
    await page.screenshot({ path: fp, timeout: 30000 });
    console.log('✓', fp);
  }
  await ctx.close();
  await browser.close();
})();
