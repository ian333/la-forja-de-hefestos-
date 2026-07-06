// Graba la animación del ciclo (three.js) con Playwright + GPU real.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=gl', '--window-size=1600,900'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: '/tmp/mold-cycle/rec', size: { width: 1600, height: 900 } } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 150)));
  await page.goto('http://localhost:8877/mold-cycle.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__ready === true', { timeout: 30000 });
  await page.waitForTimeout(31000);            // ~3 ciclos completos
  await ctx.close(); await browser.close();
  console.log('REC_OK');
})().catch((e) => { console.log('FATAL', String(e).slice(0, 200)); process.exit(1); });
