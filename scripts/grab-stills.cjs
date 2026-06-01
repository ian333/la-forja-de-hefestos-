#!/usr/bin/env node
/*
 * grab-stills.cjs — captura STILLS de una escena cinematic en tiempos dados.
 * Para juzgar rapido el "look" sin renderizar un clip completo. Corre en iangpu
 * (GPU real) con playwright + chrome del sistema, igual que render-cinematic.cjs.
 *
 * Uso:
 *   node scripts/grab-stills.cjs --url http://localhost:4173/cinematic-bh.html \
 *     --hook __cinematicBH --w 1920 --h 1080 --super 1 --out bh --t 1,8,16,24,29
 */
const { chromium } = require('playwright');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

(async () => {
  const url = arg('--url');
  if (!url) { console.error('falta --url'); process.exit(1); }
  const hook = arg('--hook', '__cinematic');
  const W = parseInt(arg('--w', '1920'), 10);
  const H = parseInt(arg('--h', '1080'), 10);
  const sup = parseInt(arg('--super', '1'), 10);
  const out = arg('--out', 'still');
  const ts = arg('--t', '0').split(',').map(Number);
  const chrome = arg('--chrome', '/usr/bin/google-chrome-stable');

  const browser = await chromium.launch({
    headless: false, // + --headless=new = GPU real en Linux
    executablePath: chrome,
    args: [
      // RTX real en iangpu: --use-angle=gl fuerza el path OpenGL→D3D12→NVIDIA
      // (requiere env GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA
      // DISPLAY=:0 al lanzar node). Sin esto cae a SwiftShader (CPU, lentísimo).
      // --enable-unsafe-swiftshader queda como red de seguridad.
      '--no-sandbox', '--disable-setuid-sandbox', '--headless=new',
      '--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization',
      '--use-angle=gl', '--enable-webgl', '--enable-unsafe-swiftshader',
      '--hide-scrollbars', `--window-size=${W},${H}`,
    ],
  });
  const page = await (await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: sup, bypassCSP: true,
  })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { const t = m.text(); if (/error|warn|fail/i.test(t)) console.log('[page]', t); });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction((h) => window[h] && window[h].ready === true, hook, { timeout: 120000 });
  // Diagnostico de WebGL real (SwiftShader vs GPU) para no adivinar.
  const glInfo = await page.evaluate(() => {
    try {
      const c = document.createElement('canvas');
      const g = c.getContext('webgl2');
      if (!g) return 'webgl2=NULL';
      const e = g.getExtension('WEBGL_debug_renderer_info');
      return 'renderer=' + (e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'masked');
    } catch (err) { return 'err ' + err.message; }
  });
  console.log('[gl]', glInfo);

  for (const t of ts) {
    await page.evaluate(({ tt, h }) => window[h].renderAt(tt), { tt: t, h: hook });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    await page.waitForTimeout(150);
    const f = `${out}_t${String(t).padStart(2, '0')}.png`;
    await page.screenshot({ path: f, type: 'png', animations: 'disabled', timeout: 0 });
    console.log('[still]', f);
  }
  await browser.close();
  console.log('[grab-stills] listo:', ts.length, 'stills');
})().catch((e) => { console.error(e); process.exit(1); });
