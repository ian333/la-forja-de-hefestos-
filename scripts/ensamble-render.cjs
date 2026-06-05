const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 360 }, deviceScaleFactor: 1.6 });
  await p.goto('file:///home/ian/Orkesta/la-forja/forja-shots/ensamble/ensamble.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const h = await p.evaluate(() => document.body.scrollHeight);
  await p.setViewportSize({ width: 1080, height: Math.ceil(h) + 8 });
  await p.screenshot({ path: '/home/ian/Orkesta/la-forja/forja-shots/ensamble/ensamble.png', fullPage: false });
  await b.close(); console.log('PNG ok');
})();
