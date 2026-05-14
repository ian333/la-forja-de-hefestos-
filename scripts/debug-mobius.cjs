const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message + '\n' + (e.stack || '').slice(0, 400)));
  page.on('console', m => {
    if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 500));
    if (m.type() === 'warning') errs.push('WARN: ' + m.text().slice(0, 200));
  });
  await page.goto('http://localhost:5001/math.html#complex/mobius', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const state = await page.evaluate(() => ({
    canvasCount: document.querySelectorAll('canvas').length,
    canvasSize: Array.from(document.querySelectorAll('canvas')).map(c => `${c.width}x${c.height}`),
    bodyTxt: document.body.innerText.slice(0, 200),
    errorBoundary: !!document.body.innerText.match(/El módulo falló/),
  }));
  console.log('STATE:', JSON.stringify(state, null, 2));
  console.log('\nERRORS (' + errs.length + '):');
  errs.forEach(e => console.log('  ', e));
  await b.close();
})();
