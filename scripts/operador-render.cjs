const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1320, height: 1400 }, deviceScaleFactor: 1.4 });
  await p.goto('file:///home/ian/Orkesta/la-forja/forja-shots/operador/operador.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/home/ian/Orkesta/la-forja/forja-shots/operador/operador.png', fullPage: true });
  await b.close(); console.log('PNG ok');
})();
