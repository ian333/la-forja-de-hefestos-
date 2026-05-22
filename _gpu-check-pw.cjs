const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage();
  await page.goto('data:text/html,<canvas id=c></canvas>');
  const info = await page.evaluate(() => {
    const c = document.getElementById('c');
    const g = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!g) return { error: 'NO WEBGL' };
    const e = g.getExtension('WEBGL_debug_renderer_info');
    return { renderer: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER) };
  });
  console.log(JSON.stringify(info));
  await browser.close();
})();
