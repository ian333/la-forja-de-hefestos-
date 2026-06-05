const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1220, height: 820 }, deviceScaleFactor: 1.5 });
  await p.goto('file:///home/ian/Orkesta/la-forja/forja-shots/cojinete/continuo.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const h = await p.evaluate(() => document.body.scrollHeight);
  await p.setViewportSize({ width: 1220, height: Math.ceil(h) + 8 });
  await p.screenshot({ path: '/home/ian/Orkesta/la-forja/forja-shots/cojinete/continuo.png', fullPage: false });
  await b.close(); console.log('PNG ok');
})();
