/**
 * shot.cjs — RENDER + INSPECCIÓN rápida para auto-revisión (deja de afirmar sin ver).
 * Uso: URL=<url> TESTID=<btn a clickear> VIEW=<iso|sup|fre> OUT=<dir> node scripts/shot.cjs
 * Captura la vista + corre el detector de colisiones y lista TODAS (sin descartar nada).
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
const TESTID = process.env.TESTID || '';
const VIEW = process.env.VIEW || 'iso';
const OUT = process.env.OUT || '/tmp/shot';
const fs = require('fs');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--disable-software-rasterizer','--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0,140)));
  const out = {};
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.moldSolidCollisions)', { timeout: 120000 });
    await p.waitForTimeout(1200);
    if (TESTID) { await p.click(`[data-testid="${TESTID}"]`).catch(()=>{}); await p.waitForFunction('window.__forgeBrep.moldGeom().length > 8', { timeout: 60000 }).catch(()=>{}); await p.waitForTimeout(3000); }
    await p.click(`text=${VIEW.toUpperCase()}`).catch(()=>{}); await p.waitForTimeout(1000);
    const ISOLATE = process.env.ISOLATE || '';
    if (ISOLATE) { await p.evaluate((r) => window.__forgeBrep.moldIsolate(r), ISOLATE).catch(()=>{}); await p.waitForTimeout(1500); }
    await p.screenshot({ path: `${OUT}/shot.png`, timeout: 120000 });
    // colisiones HONESTAS: TODAS, con % de penetración (samples dentro / total)
    const col = await p.evaluate(() => window.__forgeBrep.moldSolidCollisions(4));
    out.nParts = await p.evaluate(() => window.__forgeBrep.moldGeom().length);
    if (process.env.DUMP) out.geom = await p.evaluate(() => window.__forgeBrep.moldGeom().map(g => ({ role: g.role, z: [g.min[2], g.max[2]], x: [g.min[0], g.max[0]] })));
    out.fitMm = col.fitMm; out.volFitMm3 = col.volFitMm3;
    out.nCollisions = col.nCollisions;
    out.collisions = col.collisions.map(c => ({ pair: `${c.a} ↔ ${c.b}`, volMm3: c.volMm3, penMm: c.penMm }));
    out.nPressfit = col.nPressfit;
    out.pressfits = (col.pressfits||[]).map(c => ({ pair: `${c.a} ↔ ${c.b}`, volMm3: c.volMm3, penMm: c.penMm }));
    console.log(JSON.stringify(out, null, 2));
  } catch (e) { console.log(JSON.stringify({ fatal: String(e).slice(0,300) }, null, 2)); }
  finally { await b.close(); }
})();
