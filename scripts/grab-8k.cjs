#!/usr/bin/env node
/*
 * grab-8k.cjs — STILLS 8K (9:16 = 4320×7680) de una escena cinematic, varios ÁNGULOS.
 * Recta canónica de iangpu: viewport 2160×3840 + deviceScaleFactor 2 → PNG 4320×7680
 * NATIVO (el Canvas dpr=[1.5,2] renderea a 2× → buffer = captura, cero upscale).
 * CONTEXTO FRESCO por ángulo (cada ángulo es otra URL: los params se leen al importar) +
 * timeout FINITO (nunca 0). Settle de N frames para que el WeightedRig se asiente.
 *
 * Uso (iangpu, con env DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA):
 *   node scripts/grab-8k.cjs \
 *     --url http://localhost:4173/cinematic-pulsar.html --hook __cinematicPulsar \
 *     --angles "az=0&phi=12&dist=74&fov=44|az=1.15&phi=-6&dist=66&fov=48|az=-0.7&phi=52&dist=72&fov=40" \
 *     --names "velo|abismo|picado" --t 12 --out PULSAR_8K --super 2
 */
const { chromium } = require('playwright');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

(async () => {
  const url = arg('--url'); if (!url) { console.error('falta --url'); process.exit(1); }
  const hook = arg('--hook', '__cinematicPulsar');
  const W = parseInt(arg('--w', '2160'), 10);
  const H = parseInt(arg('--h', '3840'), 10);
  const sup = parseInt(arg('--super', '2'), 10);          // dsf 2 → 8K nativo
  const out = arg('--out', 'still8k');
  const t = parseFloat(arg('--t', '12'));
  const settle = parseInt(arg('--settle', '50'), 10);     // frames para asentar el rig
  const chrome = arg('--chrome', '/usr/bin/google-chrome-stable');
  const angles = arg('--angles', 'az=0&phi=14&dist=78&fov=42').split('|');
  const names = arg('--names', angles.map((_, i) => `a${i}`).join('|')).split('|');

  const browser = await chromium.launch({
    headless: false, executablePath: chrome,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--headless=new',
      '--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization',
      '--use-angle=gl', '--enable-webgl', '--enable-unsafe-swiftshader',
      '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`,
    ],
  });

  for (let i = 0; i < angles.length; i++) {
    const q = angles[i]; const name = names[i] || `a${i}`;
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: sup, bypassCSP: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('[pageerror]', e.message));
    page.on('console', (m) => { const x = m.text(); if (/error|fail/i.test(x)) console.log('[page]', x.slice(0, 180)); });
    const full = url + (url.includes('?') ? '&' : '?') + q + '&dur=24';
    console.log(`\n[angle ${i}] ${name} → ${full}`);
    await page.goto(full, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForFunction((h) => window[h] && window[h].ready === true, hook, { timeout: 120000 });
    if (i === 0) {
      const gl = await page.evaluate(() => { try { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'masked'; } catch (err) { return 'err ' + err.message; } });
      console.log('[gl]', gl);
    }
    await page.evaluate(({ tt, h }) => window[h].renderAt(tt), { tt: t, h: hook });
    // asentar el WeightedRig: bombear N frames a t fijo
    for (let f = 0; f < settle; f++) {
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    }
    await page.waitForTimeout(250);
    const file = `${out}_${String(i)}_${name}.png`;
    await page.screenshot({ path: file, type: 'png', animations: 'disabled', clip: { x: 0, y: 0, width: W, height: H }, timeout: 120000 });
    console.log('[8K still]', file, `(${W * sup}×${H * sup})`);
    await ctx.close();   // libera VRAM por ángulo
  }
  await browser.close();
  console.log('\n[grab-8k] listo:', angles.length, 'stills 8K');
})().catch((e) => { console.error(e); process.exit(1); });
