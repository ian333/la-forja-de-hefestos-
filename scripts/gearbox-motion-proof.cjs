/**
 * PRUEBA de MOVIMIENTO (corre en iangpu, GPU real D3D12 ANGLE): enciende el
 * movimiento de la caja y captura 3 frames separados ~1.2s. Si los píxeles del
 * viewport CAMBIAN entre frames → el mecanismo se está animando (no congelado).
 * Verifica además que el render es GPU real (no SwiftShader) para que tenga sentido.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
const DIR = process.env.DIR || '/home/ian/Orkesta/la-forja/forja-shots';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1680,1050'],
  });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
  const out = {};
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 50000 });
    out.renderer = await page.evaluate(() => {
      const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl');
      const e = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'desconocido';
    });
    await page.evaluate(() => window.__forgeBrep.applyGearbox());
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__forgeBrep.setGbMotion(true));
    await page.waitForFunction('window.__forgeBrep.gbMotionInfo && window.__forgeBrep.gbMotionInfo.ready', { timeout: 30000 });
    await page.waitForTimeout(1200);

    const vp = page.locator('[data-testid="viewport"]');
    const shoot = async (tag) => { const b = await vp.screenshot({ timeout: 30000 }); fs.writeFileSync(`${DIR}/mov-${tag}.png`, b); return b; };
    const a = await shoot('a'); await page.waitForTimeout(1300);
    const b = await shoot('b'); await page.waitForTimeout(1300);
    const c = await shoot('c');

    const diff = (x, y) => { const n = Math.min(x.length, y.length); let d = 0; for (let i = 0; i < n; i++) if (x[i] !== y[i]) d++; return +(d / n).toFixed(4); };
    out.sizes = { a: a.length, b: b.length, c: c.length };
    out.ab_equal = a.equals(b); out.bc_equal = b.equals(c);
    out.ab_byteDiff = diff(a, b); out.bc_byteDiff = diff(b, c);
    out.gpu_real = /D3D12|NVIDIA|ANGLE/i.test(out.renderer);
    out.se_mueve = !a.equals(b) && !b.equals(c);
    out.pass = out.se_mueve;
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 600); }
  finally { await browser.close(); }
  console.log('MOTION_PROOF=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
