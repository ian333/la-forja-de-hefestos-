/** Tira de frames del lab print-in-place EN MOVIMIENTO (1 navegador). Prueba que gira. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';
const MODE = process.env.MODE || 'pip-cicloidal';
const N = +(process.env.N || 6);
const DT = +(process.env.DT || 1000);   // ms entre frames
const OUT = process.env.OUT || '/tmp/pip-strip';
(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.click('[data-testid="area-pip"]').catch((e) => errs.push('area: ' + e.message.slice(0, 50)));
  await p.waitForTimeout(700);
  await p.click(`[data-testid="${MODE}"]`).catch((e) => errs.push('mode: ' + e.message.slice(0, 50)));
  await p.waitForTimeout(1500);
  for (let i = 0; i < N; i++) {
    await p.screenshot({ path: `${OUT}-${i}.png`, timeout: 30000 });
    await p.waitForTimeout(DT);
  }
  console.log('strip', N, 'frames →', OUT, '· errs:', errs.length ? JSON.stringify(errs.slice(0, 3)) : 'none');
  await b.close();
})();
