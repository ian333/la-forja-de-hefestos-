/**
 * La Forja — verifica el panel de IMPRIMIBILIDAD (DFM): reporte sobre la malla
 * (¿cabe?, voladizos, holgura/compensación), reactividad al material, detección
 * de "no cabe", y el toggle del mapa de voladizos. Corre contra build en vivo.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const isBenign = (s) => /WebGL context|WebGL2?RenderingContext|THREE.WebGLRenderer/i.test(s);
  const errs = []; page.on('pageerror', e => { const s = String(e).slice(0, 200); if (!isBenign(s)) errs.push(s); });
  const out = { errs: [] };
  try {
    const ready = async () => page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 50000 });
    const ev = async (fn, arg) => { await ready(); return page.evaluate(fn, arg); };
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(); await page.waitForTimeout(700);

    // caja 40×20×12
    await ev(() => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: 40, height: 20 })));
    await page.waitForTimeout(400);
    const exId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'extrude').id);
    await ev(({ id }) => window.__forgeBrep.updateOp(id, { depth: 12 }), { id: exId });
    await page.waitForTimeout(500);

    const repPLA = await ev(() => window.__forgeBrep.printReport);
    const fitsVisible = await page.locator('[data-testid="print-fits"]').isVisible();
    const fitsTxt = await page.locator('[data-testid="print-fits"]').innerText().catch(() => '');
    const hasMat = await page.locator('[data-testid="select-print-mat"]').count();
    const hasBtn = await page.locator('[data-testid="btn-overhangs"]').count();

    // material → cambia la holgura
    await ev(() => window.__forgeBrep.setPrintMaterial('PETG')); await page.waitForTimeout(300);
    const repPETG = await ev(() => window.__forgeBrep.printReport);
    await ev(() => window.__forgeBrep.setPrintMaterial('PLA')); await page.waitForTimeout(200);

    // overlay de voladizos
    await ev(() => window.__forgeBrep.setShowOverhangs(true)); await page.waitForTimeout(400);
    const overlayOn = await ev(() => window.__forgeBrep.showOverhangs);
    await ev(() => window.__forgeBrep.setShowOverhangs(false)); await page.waitForTimeout(200);

    // pieza que NO cabe (400mm)
    await ev(() => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: 400, height: 200 })));
    await page.waitForTimeout(600);
    const repBig = await ev(() => window.__forgeBrep.printReport);

    out.repPLA = repPLA; out.repPETG_clear = repPETG && repPETG.clearance; out.repBig_fits = repBig && repBig.fits;
    out.checks = {
      reporte_caja: repPLA && repPLA.fits === true && repPLA.triSupport === 0 && repPLA.clearance === 0.3 && repPLA.holeComp === 0.16,
      panel_ui: fitsVisible === true && /[Cc]abe/.test(fitsTxt) && hasMat === 1 && hasBtn === 1,
      material_cambia_holgura: repPETG && repPETG.clearance === 0.42,
      overlay_toggle: overlayOn === true,
      no_cabe_detecta: repBig && repBig.fits === false,
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('PRINTABILITY=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
