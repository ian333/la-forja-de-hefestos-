#!/usr/bin/env node
/*
 * grab-physics.cjs — stills de los módulos INTERACTIVOS del lab de física.
 * Los módulos son interactivos (no renderAt(t)). El router del lab (useHashRoute)
 * reacciona a EVENTOS hashchange, no al hash inicial: por eso cargamos
 * physics.html UNA vez y luego SETEAMOS window.location.hash por módulo (dispara
 * hashchange nativo), dejamos correr la simulación y capturamos. Corre en iangpu
 * con la RTX (env GALLIUM_DRIVER=d3d12 + --use-angle=gl).
 *
 * Uso:
 *   node scripts/grab-physics.cjs --base http://localhost:4173 \
 *     --ids double-pendulum,schwarzschild,fields,ideal-gas,molecule-gpu,double-helix --settle 3000
 */
const { chromium } = require('playwright');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

(async () => {
  const base = arg('--base', 'http://localhost:4173');
  const ids = arg('--ids', '').split(',').map((s) => s.trim()).filter(Boolean);
  const settle = parseInt(arg('--settle', '3000'), 10);
  const W = parseInt(arg('--w', '1600'), 10);
  const H = parseInt(arg('--h', '900'), 10);
  const sup = parseInt(arg('--super', '1'), 10);
  const chrome = arg('--chrome', '/usr/bin/google-chrome-stable');
  if (!ids.length) { console.error('falta --ids'); process.exit(1); }

  const browser = await chromium.launch({
    headless: false, // + --headless=new = GPU real
    executablePath: chrome,
    args: [
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

  // Cargar el lab UNA vez.
  await page.goto(`${base}/physics.html`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas');
    return c && c.width > 100 && c.height > 100;
  }, { timeout: 30000 });

  // GL real (1 vez).
  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2'); if (!g) return 'NULL';
    const e = g.getExtension('WEBGL_debug_renderer_info');
    return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'masked';
  });
  console.log('[gl]', String(gl).slice(0, 60));

  for (const id of ids) {
    try {
      // Forzar el switch de módulo: limpiar hash y volver a setearlo dispara
      // hashchange aunque el id sea el mismo del estado previo.
      await page.evaluate((mid) => {
        window.location.hash = '';
        window.location.hash = mid;
      }, id);
      // Esperar a que el módulo nuevo monte su canvas (suspense + lazy import).
      await page.waitForTimeout(1200);
      await page.waitForFunction(() => {
        const c = document.querySelector('canvas');
        return c && c.width > 100 && c.height > 100;
      }, { timeout: 20000 });
      await page.waitForTimeout(settle);   // dejar evolucionar la simulación
      const f = `phys_${id}.png`;
      await page.screenshot({ path: f, type: 'png', animations: 'disabled', timeout: 0 });
      console.log(`[ok] ${id}`);
    } catch (e) {
      console.error(`[fail] ${id}: ${e.message.split('\n')[0].slice(0, 90)}`);
    }
  }
  await browser.close();
  console.log('[grab-physics] listo:', ids.length, 'módulos');
})().catch((e) => { console.error(e); process.exit(1); });
