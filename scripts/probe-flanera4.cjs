/** probe-flanera4.cjs — INSPECCIÓN de la flanera 4 cavidades + red de canales:
 *  ángulos ISO/FRE/SUP, colada AISLADA, secuencia de flujo, árbol. DPR2 para crops. */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/fl4';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl', '--disable-software-rasterizer', '--window-size=1920,1080'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const shot = async (n) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${n}.png`, timeout: 40000 }); };
  try {
    await p.goto('http://localhost:5179/forja-brep.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction(() => { const bt = document.querySelector('[data-testid="btn-flanera"]'); return !!bt && !bt.disabled; }, null, { timeout: 240000 });
    await p.click('[data-testid="btn-flanera"]');
    await p.waitForFunction('window.__forgeBrep.moldGeom().length > 8', null, { timeout: 420000 });
    await p.waitForTimeout(2500);
    const roles = await p.evaluate(() => window.__forgeBrep.moldGeom().map(g => g.role + ':' + (g.name || '').slice(0, 30)).join(' | '));
    console.log('PARTES:', roles.slice(0, 600));
    // 1) vistas generales
    await p.click('text=ISO').catch(() => {}); await shot('01-iso');
    await p.click('text=SUP').catch(() => {}); await shot('02-sup');
    await p.click('text=FRE').catch(() => {}); await shot('03-fre');
    // 2) LA COLADA AISLADA (la red desnuda) — vista superior es la que enseña
    await p.evaluate(() => window.__forgeBrep.moldIsolate?.('colada'));
    await p.click('text=SUP').catch(() => {}); await shot('04-colada-sup');
    await p.click('text=ISO').catch(() => {}); await shot('05-colada-iso');
    // 3) colada + piezas (a dónde llega)
    await p.evaluate(() => { const f = window.__forgeBrep; f.moldIsolate?.('colada'); });
    await p.evaluate(() => { const f = window.__forgeBrep; if (f.moldShow) { f.moldShow('pieza'); } });
    await shot('06-colada-piezas');
    // 4) flujo: mostrar todo + 💧, cuadros de la secuencia
    await p.evaluate(() => window.__forgeBrep.moldShowAll?.());
    await p.click('[data-testid="mold-flow-toggle"]', { force: true }).catch(() => {});
    for (let i = 0; i < 6; i++) { await p.waitForTimeout(750); await p.screenshot({ path: `${OUT}/07-flow-${i}.png`, timeout: 40000 }); }
    // 5) térmica nueva 🌡 (30 s simulados en el motor F2b)
    await p.click('[data-testid="mold-flow-toggle"]', { force: true }).catch(() => {});
    await p.click('[data-testid="mold-sim-toggle"]', { force: true }).catch(() => {});
    await p.waitForTimeout(9000); await shot('08-termica');
    const boundary = await p.evaluate(() => (document.body.innerText.match(/ReferenceError[^\n]*|falló al renderizar/) || [])[0] ?? '');
    if (boundary) errs.push('BOUNDARY: ' + boundary);
    console.log(errs.length ? `ERRORES: ${errs.slice(0, 4).join(' || ')}` : 'OK 0 errores');
  } catch (e) { console.log('FATAL', String(e).slice(0, 260)); process.exitCode = 1; }
  finally { await b.close(); }
})();
