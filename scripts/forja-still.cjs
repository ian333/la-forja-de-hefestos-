#!/usr/bin/env node
/*
 * forja-still.cjs — STILL rápido de una página de La Forja (Part Studio / Mecanismos)
 * para juzgar el "look" sin hook __cinematic. Corre en iangpu (GPU real).
 *
 * Uso (con env GPU):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   node scripts/forja-still.cjs --url http://localhost:5002/forja-brep.html \
 *     --out forja-shots/tanda1a-brep.png --wait 11000
 */
const { chromium } = require('playwright');
function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }

(async () => {
  const url = arg('--url');
  if (!url) { console.error('falta --url'); process.exit(1); }
  const out = arg('--out', 'forja-shots/forja-still.png');
  const W = parseInt(arg('--w', '1600'), 10);
  const H = parseInt(arg('--h', '1000'), 10);
  const wait = parseInt(arg('--wait', '11000'), 10);
  const clickSel = arg('--click', '');       // testid opcional a clicar antes del shot
  const chrome = arg('--chrome', '/usr/bin/google-chrome-stable');

  const browser = await chromium.launch({
    headless: false, executablePath: chrome,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--headless=new',
      '--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization',
      '--use-angle=gl', '--enable-webgl', '--enable-unsafe-swiftshader',
      '--hide-scrollbars', `--window-size=${W},${H}`,
    ],
  });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { const t = m.text(); if (/error|fail|exception|cannot/i.test(t)) console.log('[page]', t.slice(0, 200)); });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForSelector('canvas', { timeout: 60000 });
  const gl = await page.evaluate(() => {
    try { const c = document.createElement('canvas'); const g = c.getContext('webgl2');
      const e = g.getExtension('WEBGL_debug_renderer_info');
      return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'masked'; } catch (err) { return 'err ' + err.message; }
  });
  console.log('[gl]', gl);
  if (clickSel) {
    try { await page.click(`[data-testid="${clickSel}"]`, { timeout: 8000 }); console.log('[click]', clickSel); }
    catch (e) { console.log('[click-miss]', clickSel, e.message.slice(0, 80)); }
  }
  await page.waitForTimeout(wait);
  await page.screenshot({ path: out, timeout: 30000 });
  console.log('[ok]', out);
  await ctx.close(); await browser.close();
})();
