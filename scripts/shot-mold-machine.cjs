const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=gl','--window-size=1920,1080'] });
  const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,160)));
  await page.goto(process.env.URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="tab-simulacion"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="tab-simulacion"]').click(); await page.waitForTimeout(500);
  const col = await page.evaluate(`(document.querySelector('[data-testid="sim-panel"]')||{className:''}).className.includes('collapsed')`);
  if (col) { await page.locator('[data-testid="collapse-sim"]').click(); await page.waitForTimeout(400); }
  await page.waitForSelector('[data-testid="btn-mold-machine"]', { state: 'attached', timeout: 20000 });
  await page.locator('[data-testid="btn-mold-machine"]').click();
  await page.waitForSelector('[data-testid="mold-machine-view"]', { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/tmp/mm-shot.png' });
  const total1 = await page.locator('[data-testid="mm-total"]').textContent();
  await page.locator('[data-testid="mm-preset-Carcasa auto"]').click(); await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/mm-shot2.png' });
  const total2 = await page.locator('[data-testid="mm-total"]').textContent();
  await b.close();
  console.log('SHOT_OK bezel=', total1, '· carcasa=', total2, '· errors:', errs.length, errs.slice(0,2));
})().catch(e => { console.log('FATAL', String(e).slice(0,200)); process.exit(1); });
