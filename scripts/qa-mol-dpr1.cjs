const { chromium } = require('playwright');
(async () => {
  const W = 1827, H = 950;
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist', `--window-size=${W},${H}`] });
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true })).newPage();
  await p.goto('http://localhost:5012/lab.html', { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button:has-text("Molécula")').first().click({ force: true });
  await p.waitForTimeout(2200);
  // clic en CH3OCH3 (lo que el usuario vio reventado)
  try { const m = p.locator('button:has-text("CH3OCH3")').first(); if (await m.count()) { await m.click({ force: true }); await p.waitForTimeout(2500); } } catch {}
  await p.screenshot({ path: '/tmp/mol-dpr1.jpg', type: 'jpeg', quality: 82 });
  await b.close();
  console.log('ok → /tmp/mol-dpr1.jpg');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
