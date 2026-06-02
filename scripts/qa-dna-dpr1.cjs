const { chromium } = require('playwright');
(async () => {
  const W = 1827, H = 950;
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist', `--window-size=${W},${H}`] });
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true })).newPage();
  await p.goto('http://localhost:5012/lab.html', { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.locator('button:has-text("Molécula")').first().click({ force: true });
  await p.waitForTimeout(1800);
  // ADN: clic en "promotor" (lo que el usuario vio)
  try { const m = p.locator('button:has-text("promotor")').first(); if (await m.count()) { await m.click({ force: true }); console.log('clic promotor ok'); } } catch (e) { console.log('err', e.message.slice(0,60)); }
  // capturar a varios tiempos del viaje de escala
  for (const t of [2500, 5000, 9000]) {
    await p.waitForTimeout(t === 2500 ? 2500 : 3000);
    await p.screenshot({ path: `/tmp/dna-t${t}.jpg`, type: 'jpeg', quality: 82 });
    console.log('shot', t);
  }
  await b.close();
  console.log('ok');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
