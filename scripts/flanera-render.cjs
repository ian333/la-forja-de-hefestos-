/** flanera-render.cjs — construye el vaso por el botón y lo captura (GPU real). */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
const OUT = process.env.OUT || '/tmp/flanera';
const fs = require('fs');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--disable-software-rasterizer','--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0,160)));
  const out = { errs: [] };
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forja && window.__forja.run)', { timeout: 120000 });
    await p.waitForFunction(() => { try { window.__forja.run('part.flanera', {}); return true; } catch (e) { return !String(e).includes('requiere OCCT'); } }, { timeout: 90000 });
    // verificación NUMÉRICA por el bus (antes de ver): vol ~18 cc, desmoldeo ~5.7°
    out.bus = await p.evaluate(() => { const r = window.__forja.run('part.flanera', {}); return { volMm3: Math.round(r.volMm3), draftDeg: +r.draftDeg.toFixed(2), report: r.report }; });
    // construir por el BOTÓN real de la UI y capturar
    await p.click('[data-testid="btn-flanera"]');
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${OUT}/flanera.png`, timeout: 30000 });
    // intento de encuadre + vista ISO para un mejor ángulo
    await p.click('text=Encuadrar').catch(() => {});
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/flanera_fit.png`, timeout: 30000 });
    out.errs = errs.slice(0,8);
    console.log(JSON.stringify(out, null, 2));
  } catch (e) { console.log(JSON.stringify({ fatal: String(e).slice(0,300), errs: errs.slice(0,8) }, null, 2)); }
  finally { await b.close(); }
})();
