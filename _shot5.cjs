const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-gpu-rasterization'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });
  await page.evaluateOnNewDocument(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl2') return null;
      return orig.call(this, type, ...args);
    };
  });
  page.on('pageerror', e => console.error('PAGEERR:', e.message.slice(0, 200)));
  page.on('console', m => {
    if (m.type() === 'error') console.log('error:', m.text().slice(0, 200));
  });
  await page.goto('http://localhost:5001/masterclass.html?id=econ-18-duflo&render=1&deterministic=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__renderClockReady === true, { timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  // Inspect GL
  const info = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas');
    return Array.from(canvases).map(c => {
      const g = c.getContext('webgl');
      if (!g) return { ctx: 'none' };
      const e = g.getExtension('WEBGL_debug_renderer_info');
      return { ctx: 'webgl', r: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'no_ext' };
    });
  });
  console.log('Canvas info:', JSON.stringify(info, null, 2));
  for (const [name, t] of [['p0', 7], ['p2', 42], ['p3', 60], ['p5', 95]]) {
    await page.evaluate((tt) => window.renderAt(tt), t);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await new Promise(r => setTimeout(r, 250));
    await page.screenshot({ path: `/tmp/duflo-v5-${name}.png`, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    console.log(`${name} ok`);
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
