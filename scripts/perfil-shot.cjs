/**
 * perfil-shot.cjs — QA visual del PerfilPortal (átomo vivo) con GPU real.
 *
 *   En iangpu:  DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *               node scripts/perfil-shot.cjs
 *   Vars: URL (default http://localhost:5173/perfil.html?demo=27), OUT (default /tmp/perfil-shots)
 *
 * Captura hero + secciones scrolleadas + reporta el renderer GL y errores de consola.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const URL_ = process.env.URL || 'http://localhost:5173/perfil.html?demo=27';
const OUT = process.env.OUT || '/tmp/perfil-shots';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: false, // + --headless=new = GPU real (receta canónica iangpu)
    args: [
      '--headless=new', '--use-angle=gl', '--enable-gpu',
      '--ignore-gpu-blocklist', '--disable-software-rasterizer',
      '--window-size=1500,1000',
    ],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`); });

  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000); // bundle ψ² + primeros frames + escalera autocentrada

  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2') || c.getContext('webgl');
    if (!g) return 'NO WEBGL';
    const ext = g.getExtension('WEBGL_debug_renderer_info');
    return ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no debug info';
  });
  console.log('GL renderer:', gl);

  await page.screenshot({ path: `${OUT}/1-hero.png`, timeout: 30000 });
  for (const [name, y] of [['2-escalera', 0.95], ['3-sigue-pilares', 1.9], ['4-insignias-plan', 3.0]]) {
    await page.evaluate((f) => window.scrollTo(0, window.innerHeight * f), y);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 30000 });
  }
  // segundo look del hero tras ~20s de vida (la nube ya respiró)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/5-hero-vivo.png`, timeout: 30000 });

  console.log('errors:', errors.length ? errors.slice(0, 12) : 'ninguno');
  await browser.close();
  console.log('OK →', OUT);
})();
