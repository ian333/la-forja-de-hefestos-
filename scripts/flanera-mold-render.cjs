/** flanera-mold-render.cjs — construye CORE+CAVIDAD del vaso y captura. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
const OUT = process.env.OUT || '/tmp/flanera-mold';
const fs = require('fs');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--disable-software-rasterizer','--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0,180)));
  p.on('console', m => { if (m.type()==='error') errs.push('C:'+m.text().slice(0,140)); });
  const out = {};
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && document.querySelector("canvas"))', { timeout: 120000 });
    await p.waitForTimeout(1200);
    await p.click('[data-testid="btn-flanera-mold"]');
    // splitMold hace booleanas → dale tiempo; espera a que el curso llegue a stage 2
    await p.waitForFunction('window.__forgeBrep && window.__forgeBrep.curso && window.__forgeBrep.curso.stage >= 2', { timeout: 60000 }).catch(()=>{});
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${OUT}/mold.png`, timeout: 30000 });
    out.curso = await p.evaluate(() => window.__forgeBrep?.curso ?? null);
    out.errs = errs.slice(0,10);
    console.log(JSON.stringify(out, null, 2));
  } catch (e) { console.log(JSON.stringify({ fatal: String(e).slice(0,300), errs: errs.slice(0,10) }, null, 2)); }
  finally { await b.close(); }
})();
