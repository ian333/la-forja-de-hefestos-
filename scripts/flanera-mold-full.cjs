/** flanera-mold-full.cjs — arma el MOLDE COMPLETO de la flanera (botón) y lo captura. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
const OUT = process.env.OUT || '/tmp/flanera-mold-full';
const fs = require('fs');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--disable-software-rasterizer','--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0,160)));
  p.on('console', m => { if (m.type()==='error') errs.push('C:'+m.text().slice(0,140)); });
  const out = {};
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.moldGeom)', { timeout: 120000 });
    await p.waitForTimeout(1200);
    await p.click('[data-testid="btn-flanera"]');
    // el molde completo tarda en armarse (~3s); espera a las partes
    await p.waitForFunction('window.__forgeBrep.moldGeom().length > 8', { timeout: 60000 }).catch(()=>{});
    await p.waitForTimeout(3000);
    const geom = await p.evaluate(() => window.__forgeBrep.moldGeom());
    out.nParts = geom.length;
    out.roles = geom.map(g => g.role);
    await p.screenshot({ path: `${OUT}/flanera_mold.png`, timeout: 30000 });
    // corre el detector de colisiones sobre el molde de la flanera
    out.collisions = await p.evaluate(() => { try { return window.__forgeBrep.moldSolidCollisions(6); } catch(e){ return {err:String(e).slice(0,100)}; } });
    out.errs = errs.slice(0,10);
    console.log(JSON.stringify({ nParts: out.nParts, roles: out.roles, nCollisions: out.collisions?.nCollisions, collisions: out.collisions?.collisions, errs: out.errs }, null, 2));
  } catch (e) { console.log(JSON.stringify({ fatal: String(e).slice(0,300), errs: errs.slice(0,10) }, null, 2)); }
  finally { await b.close(); }
})();
