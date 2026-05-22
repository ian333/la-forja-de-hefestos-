const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://localhost:9222/devtools/browser/efdf48d4-334f-4589-a7cc-12552b85c1f1',
    defaultViewport: null,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });
  page.on('pageerror', e => console.error('ERR:', e.message.slice(0, 200)));
  page.on('console', m => {
    if (m.type() === 'error') console.log('error:', m.text().slice(0, 200));
  });
  await page.goto('http://localhost:5001/masterclass.html?id=econ-18-duflo&render=1&deterministic=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__renderClockReady === true, { timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  const info = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas');
    return Array.from(canvases).map(c => {
      const g = c.getContext('webgl2') || c.getContext('webgl');
      if (!g) return { ctx: 'none' };
      const e = g.getExtension('WEBGL_debug_renderer_info');
      return { renderer: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'no_ext', webgl2: !!c.getContext('webgl2') };
    });
  });
  console.log('Canvas:', JSON.stringify(info));
  for (const [name, t] of [['p0', 7], ['p2', 42], ['p3', 60], ['p5', 95]]) {
    await page.evaluate((tt) => window.renderAt(tt), t);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await new Promise(r => setTimeout(r, 250));
    await page.screenshot({ path: `/tmp/duflo-edge-${name}.png`, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    console.log(name);
  }
  await browser.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
