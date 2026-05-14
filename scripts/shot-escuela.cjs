const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1080 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.goto('http://localhost:5001/escuela.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/escuela-top.png' });

  // Scroll to pillars
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('h2')).find(h => h.textContent?.includes('Matemáticas'));
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/tmp/escuela-pilares.png' });
  console.log('errs:', errs.length);
  if (errs.length) console.log(errs.slice(0, 3).join('\n'));
  await browser.close();
})();
