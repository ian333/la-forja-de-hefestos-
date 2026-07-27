/** probe-canales.cjs — VER la colada: flanera + 💧 flow ON + cuadros del ciclo
 *  de llenado (sprue ámbar revelándose → pieza pintándose) + números del árbol. */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || '/tmp/canales';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl', '--disable-software-rasterizer', '--window-size=1920,1080'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  try {
    await p.goto(process.env.URL || 'http://localhost:5179/forja-brep.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction(() => { const bt = document.querySelector('[data-testid="btn-flanera"]'); return !!bt && !bt.disabled; }, null, { timeout: 240000 });
    await p.click('[data-testid="btn-flanera"]');
    await p.waitForFunction('window.__forgeBrep.moldGeom().length > 8', { timeout: 300000 });
    await p.waitForTimeout(2500);
    // aislar lo que importa: A translúcida + colada + pieza (ocultar clamp para ver el sprue)
    await p.evaluate(() => { const f = window.__forgeBrep; ['clamp', 'anillo', 'platina-fija', 'platina-movil'].forEach(r => f.moldHide?.(r)); });
    await p.click('text=FRE').catch(() => {});
    await p.waitForTimeout(800);
    await p.click('[data-testid="mold-flow-toggle"]', { force: true });
    for (let i = 0; i < 8; i++) {
      await p.waitForTimeout(650);
      await p.screenshot({ path: `${OUT}/flow-${i}.png`, timeout: 30000 });
    }
    // los números del sprue en el árbol (expandir colada)
    await p.click('[data-testid="mold-expand-colada"]', { force: true }).catch(() => {});
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/arbol-colada.png`, timeout: 30000 });
    const info = await p.evaluate(() => window.__forgeBrep.moldGeom().find(g => g.role === 'colada')?.name ?? 'SIN COLADA');
    console.log('colada:', info);
    console.log(errs.length ? `ERRORES: ${errs.join(' | ')}` : 'OK 0 errores');
  } catch (e) { console.log('FATAL', String(e).slice(0, 250)); process.exitCode = 1; }
  finally { await b.close(); }
})();
