const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 240)); });
  await page.goto('http://localhost:5001/math.html', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: '/tmp/math-home.png', fullPage: false });
  // Also test clicking on a complex module via sidebar to mirror real user flow
  const found = await page.evaluate(() => {
    const branches = Array.from(document.querySelectorAll('button, [role="button"]'));
    const complex = branches.find(b => b.textContent.includes('Análisis complejo'));
    if (complex) { complex.click(); return true; }
    return false;
  });
  await page.waitForTimeout(800);
  const found2 = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button, [role="button"]'));
    const m = all.find(b => b.textContent.includes('Mapas conformes'));
    if (m) { m.click(); return true; }
    return false;
  });
  console.log('clickedBranch=', found, ' clickedModule=', found2);
  await page.waitForTimeout(4500);
  await page.screenshot({ path: '/tmp/math-conformal-via-sidebar.png' });
  await b.close();
})();
