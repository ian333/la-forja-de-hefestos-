const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-angle=gl', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('PAGEERR:', e.message));
  page.on('console', m => {
    if (m.type() === 'error') console.log('error', m.text().slice(0, 200));
  });
  await page.goto('http://localhost:5001/masterclass.html?id=econ-18-duflo&render=1&deterministic=1', { waitUntil: 'domcontentloaded' });
  console.log('navigated');
  // Wait longer for clock ready
  try {
    await page.waitForFunction(() => window.__renderClockReady === true, { timeout: 30000 });
    console.log('clock ready');
  } catch (e) {
    console.log('clock NOT ready:', e.message);
    const state = await page.evaluate(() => ({
      hasRenderAt: typeof window.renderAt,
      renderClockReady: window.__renderClockReady,
      renderStatus: window.__renderStatus,
    }));
    console.log('STATE:', JSON.stringify(state, null, 2));
    await browser.close(); return;
  }
  // Avanzar al phase 0 (pregunta) midpoint
  await page.evaluate(() => window.renderAt(7));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: '/tmp/duflo-render-p0.png', clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  console.log('phase 0 captured');
  await page.evaluate(() => window.renderAt(37));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: '/tmp/duflo-render-p2.png', clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  console.log('phase 2 captured');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
