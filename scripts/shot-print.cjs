const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/metal-shot'; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173';
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=gl', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${BASE}/physics.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  let m = p.locator('[data-testid="module-metal-print"]');
  if (!(await m.count())) { await p.locator('[data-testid="branch-manufactura"]').click(); await p.waitForTimeout(400); m = p.locator('[data-testid="module-metal-print"]'); }
  if (!(await m.count())) { console.log('NO_MODULE'); await b.close(); return; }
  await m.click();
  await p.waitForFunction(() => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'), { timeout: 15000 });
  await p.waitForTimeout(9000);
  const t = await p.evaluate(() => document.body.innerText);
  const g = t.match(/gotas=\s*([\d/]+)/); const w = t.match(/débil=\s*([\d.]+%)/);
  console.log('HUD gotas=' + (g ? g[1] : '?') + '  debil=' + (w ? w[1] : '?'));
  await p.screenshot({ path: `${OUT}/metal-print.png`, timeout: 30000 });
  console.log('SHOT_OK');
  if (errs.length) console.log('ERR:', errs.slice(0, 6).join(' | '));
  await b.close();
})();
