/** Captura UNA toma de una página (lab). Ligero: 1 navegador, GPU real. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5001/printinplace.html';
const OUT = process.env.OUT || '/tmp/lab-shot.png';
const WAIT = +(process.env.WAIT || 4000);
(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + String(e).slice(0, 200)));
  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(WAIT);
  await p.screenshot({ path: OUT });
  console.log('shot', OUT, '· errors:', errs.length ? JSON.stringify(errs.slice(0, 4)) : 'none');
  await b.close();
})();
