const { chromium } = require('playwright');
(async () => {
  const W = 1540, H = 860;
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist', `--window-size=${W},${H}`] });
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://localhost:5012/lab.html', { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(2500);
  // navegar a un elemento ALTO-Z: clic en la celda "Dy" (Z=66) de la tabla
  try {
    const dy = p.locator('button').filter({ hasText: /^Dy/ }).first();
    if (await dy.count()) { await dy.click({ force: true }); await p.waitForTimeout(800); console.log('clic Dy ok'); }
    else console.log('no encontré Dy');
  } catch (e) { console.log('Dy click err', e.message.slice(0, 80)); }
  // activar Cinematic
  await p.locator('button:has-text("Cinematic")').first().click({ force: true });
  await p.waitForTimeout(3500);
  await p.screenshot({ path: '/tmp/atom-hiz.jpg', type: 'jpeg', quality: 82 });
  await b.close();
  console.log('ok → /tmp/atom-hiz.jpg');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
