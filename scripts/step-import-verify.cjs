/**
 * La Forja — verifica IMPORTAR STEP (puente con step.parts y fuentes open).
 * Round-trip EXACTO: caja 50×30×20 → su STEP (exportSTEP) → importStepText →
 * el sólido importado tiene el MISMO volumen. Además: persiste en la biblioteca
 * (el texto STEP se guarda) y se restaura al cargar. Corre contra build en vivo.
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
    const vol = async () => { await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.invariants', { timeout: 50000 }); return page.evaluate(() => window.__forgeBrep.invariants.vol_kernel); };
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(); await page.waitForTimeout(700);

    // caja 50×30×20 = 30000
    await ev(() => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: 50, height: 30 })));
    await page.waitForTimeout(350);
    const exId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'extrude').id);
    await ev(({ id }) => window.__forgeBrep.updateOp(id, { depth: 20 }), { id: exId });
    await page.waitForTimeout(450);
    const boxVol = await vol();
    const stepLen = await ev(() => (window.__forgeBrep.stepText || '').length);

    // round-trip: el STEP del sólido actual → importarlo
    await ev(() => window.__forgeBrep.importStepText(window.__forgeBrep.stepText, 'Caja STEP'));
    await page.waitForTimeout(700);
    const impVol = await vol();
    const impFlag = await ev(() => window.__forgeBrep.importedStep);
    const tagVisible = await page.locator('[data-testid="imported-tag"]').isVisible().catch(() => false);

    // persistencia: guardar → nueva → cargar (el STEP debe volver)
    await ev(() => window.__forgeBrep.setDocName('STEP Test'));
    await page.waitForTimeout(200);
    await ev(() => window.__forgeBrep.saveToLibrary());
    await page.waitForTimeout(250);
    await ev(() => window.__forgeBrep.newDoc());
    await page.waitForTimeout(450);
    const newFlag = await ev(() => window.__forgeBrep.importedStep);
    await ev(() => window.__forgeBrep.loadFromLibrary('STEP Test'));
    await page.waitForTimeout(700);
    const loadedVol = await vol();
    const loadedFlag = await ev(() => window.__forgeBrep.importedStep);

    const near = (a, b) => Math.abs(a - b) < 1;
    out.boxVol = +boxVol.toFixed(1); out.impVol = +impVol.toFixed(1); out.loadedVol = +loadedVol.toFixed(1); out.stepLen = stepLen;
    out.checks = {
      step_text_disponible: stepLen > 200,
      importa_roundtrip_exacto: near(impVol, boxVol) && impFlag === true && tagVisible === true,
      nueva_limpia_step: newFlag === false,
      persiste_en_biblioteca: near(loadedVol, boxVol) && loadedFlag === true,
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('STEP_IMPORT=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
