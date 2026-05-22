const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });
  page.on('pageerror', e => console.error('ERR:', e.message));
  page.on('console', m => {
    const t = m.text();
    if (t.includes('WebGL') || t.includes('Error') || t.includes('error')) console.log('CONS:', t.slice(0, 200));
  });
  await page.goto('http://localhost:5001/masterclass.html?id=econ-18-duflo&render=1&deterministic=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__renderClockReady === true, { timeout: 30000 });
  // Wait for canvas to mount
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(() => window.renderAt(42));
  await new Promise(r => setTimeout(r, 1500));
  // Check canvas state
  const state = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas');
    return Array.from(canvases).map(c => ({
      w: c.width, h: c.height,
      ctx: c.getContext('webgl2') ? 'webgl2' : c.getContext('webgl') ? 'webgl' : 'none',
    }));
  });
  console.log('Canvases:', JSON.stringify(state));
  await page.screenshot({ path: '/tmp/duflo-debug.png', clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
