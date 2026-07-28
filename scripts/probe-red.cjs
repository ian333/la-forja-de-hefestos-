/** probe-red.cjs — la RED RAMIFICADA (Fig 6.14) fluyendo: carga repartida. */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/red';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl', '--disable-software-rasterizer', '--window-size=1920,1080'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  try {
    await p.goto('http://localhost:5179/forja-brep.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    const SEL = process.env.BTN || '[data-testid="btn-red-6-14"]';
    await p.waitForFunction((sel) => { const bt = document.querySelector(sel); return !!bt && !bt.disabled; }, SEL, { timeout: 240000 });
    await p.click(SEL);
    await p.waitForFunction('window.__forgeBrep.moldGeom().length >= 1', null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    await p.click('text=ISO').catch(() => {});
    await p.waitForTimeout(600);
    for (let i = 0; i < Number(process.env.N || 10); i++) {
      await p.waitForTimeout(Number(process.env.DT || 320));
      await p.screenshot({ path: `${OUT}/red-${i}.png`, timeout: 30000 });
    }
    console.log('roles:', await p.evaluate(() => window.__forgeBrep.moldGeom().map(g => g.role).join(',')));
    console.log(errs.length ? `ERRORES: ${errs.join(' | ')}` : 'OK 0 errores');
  } catch (e) { console.log('FATAL', String(e).slice(0, 250)); process.exitCode = 1; }
  finally { await b.close(); }
})();
