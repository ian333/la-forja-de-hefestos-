/**
 * USABILIDAD de la caja en CUERPOS (separados/color/ocultar). Corre en iangpu (GPU
 * real) y captura los escenarios que el usuario pidió: ver todos los cuerpos con
 * color, OCULTAR la hembra para ver adentro, ocultar varios para ver el interior
 * profundo, SECCIÓN, y cambiar color de un cuerpo. Guarda PNGs + datos funcionales.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
const DIR = process.env.DIR || '/home/ian/Orkesta/la-forja/forja-shots/usab';

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1680,1050'],
  });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  const out = { shots: {}, errs: [] };
  const ev = (fn, a) => page.evaluate(fn, a);
  const shot = async (tag) => { const p = `${DIR}/${tag}.png`; await page.screenshot({ path: p, timeout: 30000 }); out.shots[tag] = p; };
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 50000 });
    await page.waitForTimeout(600);
    await ev(() => window.__forgeBrep.applyGearbox());
    await page.waitForFunction('window.__forgeBrep.gbBodies && window.__forgeBrep.gbBodies.length > 0', { timeout: 30000 });
    await page.waitForTimeout(1500);

    out.renderer = await ev(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
    out.bodies = await ev(() => window.__forgeBrep.gbBodies);
    out.visibleAll = await ev(() => window.__forgeBrep.gbVisibleCount);
    // 01: TODOS visibles — la hembra ahora es semitransparente → se ven los cuerpos de color adentro
    await shot('01-todos');

    // 02: OCULTAR la hembra del todo → stack de discos
    await ev(() => window.__forgeBrep.toggleGbBody('hembra'));
    await page.waitForTimeout(900);
    out.visibleNoHembra = await ev(() => window.__forgeBrep.gbVisibleCount);
    await shot('02-sin-hembra');

    // 03: AISLAR un disco (mostrar SOLO ese) — la función nueva tipo Fusion
    await ev(() => window.__forgeBrep.isolateGbBody('disco-3'));
    await page.waitForTimeout(900);
    out.visibleIsolated = await ev(() => window.__forgeBrep.gbVisibleCount);
    await shot('03-aislar');

    // 04: mostrar todos + SECCIÓN vertical por el centro → AHORA debe RECORTAR de verdad
    await ev(() => { window.__forgeBrep.showAllGbBodies(); window.__forgeBrep.setSection(true, 'x', 0); });
    await page.waitForTimeout(1200);
    out.sectionPlane = await ev(() => window.__forgeBrep.sectionPlane);
    await shot('04-seccion');

    // 05: CAMBIAR color de un disco a rosa + AISLARLO → se ve rosa, sin duda
    await ev(() => { window.__forgeBrep.setSection(false); window.__forgeBrep.setGbColor('disco-2', '#ff3a6b'); window.__forgeBrep.isolateGbBody('disco-2'); });
    await page.waitForTimeout(900);
    out.bodiesAfterColor = await ev(() => window.__forgeBrep.gbBodies);
    await shot('05-color');

    out.errs = errs.slice(0, 6);
    out.ok = out.bodies && out.bodies.length >= 5 && out.visibleNoHembra === out.visibleAll - 1 && out.visibleIsolated === 1;
  } catch (e) { out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { await browser.close(); }
  fs.writeFileSync(`${DIR}/data.json`, JSON.stringify(out, null, 2));
  console.log('USAB_CAPTURE=' + JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 2);
})();
