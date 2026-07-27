/**
 * probe-panels.cjs — verificación de los PANELES del molde extraídos:
 * carga flanera y PRENDE cada toggle del árbol (🌡 sim, 🩻 xray, 📐 cotas,
 * 💧 llenado, ⏱ t_c, 🏗 FEA, ▶ apertura) cazando pageerrors. La lección
 * moldSim: un toggle apagado esconde un ReferenceError — hay que CLICKEAR.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5179/forja-brep.html';
const OUT = process.env.OUT || '/tmp/probe-panels';
const fs = require('fs');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl', '--disable-software-rasterizer', '--window-size=1920,1080'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.moldSolidCollisions)', { timeout: 180000 });
    // waitForFunction (no waitForSelector): sobrevive re-montajes del botón y
    // al optimize-reload de vite dev tras un restart. 240s: box compartido con renderq.
    await p.waitForFunction(() => { const b = document.querySelector('[data-testid="btn-flanera"]'); return !!b && !b.disabled; }, { timeout: 240000 });
    await p.click('[data-testid="btn-flanera"]');
    await p.waitForFunction('window.__forgeBrep.moldGeom().length > 8', { timeout: 300000 });
    await p.waitForTimeout(2500);
    const head = await p.locator('[data-testid="mold-visible-count"]').textContent().catch(() => 'NO-TREE');
    console.log('árbol visible:', head);
    const toggles = ['mold-open-toggle', 'mold-sim-toggle', 'mold-fea-run', 'mold-flow-toggle',
      'mold-tc-toggle', 'mold-xray-toggle', 'mold-cotas-toggle'];   // cotas AL FINAL: su re-render inestabiliza clicks (bug aparte)
    for (const t of toggles) {
      const pre = errs.length;
      await p.click(`[data-testid="${t}"]`, { force: true, timeout: 8000 }).catch(e => console.log(`  ${t}: NO CLICKEABLE ${String(e).slice(0, 60)}`));
      await p.waitForTimeout(t === 'mold-sim-toggle' || t === 'mold-fea-run' ? 4000 : 1200);
      console.log(`  ${t}: ${errs.length > pre ? '💥 ' + errs.slice(pre).join(' | ') : 'ok'}`);
    }
    // reportes que deben existir con los toggles prendidos
    for (const r of ['mold-tc-report', 'mold-sim-report', 'curso-report']) {
      const n = await p.locator(`[data-testid="${r}"]`).count();
      console.log(`  ${r}: ${n > 0 ? 'presente' : '(ausente)'}`);
    }
    await p.screenshot({ path: `${OUT}/panels-on.png`, timeout: 30000 });
    console.log(errs.length === 0 ? 'VEREDICTO=OK sin pageerrors' : `VEREDICTO=ERRORES ${errs.length}: ${errs.join(' || ')}`);
    process.exitCode = errs.length === 0 ? 0 : 1;
  } catch (e) { console.log('FATAL', String(e).slice(0, 250)); process.exitCode = 1; }
  finally { await b.close(); }
})();
