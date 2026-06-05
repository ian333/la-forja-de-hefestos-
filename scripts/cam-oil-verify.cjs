/**
 * Verifica en GPU real (iangpu :5002) la caja con: (a) NO árbol de soportes en los
 * cuerpos, (b) los CANALES DE ACEITE axiales en la leva (eje aislado, orbita cercana),
 * (c) el journal disco↔leva en SECCIÓN. Honesto: para VER la figura nueva.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = process.env.DIR || '/home/ian/Orkesta/la-forja/forja-shots/cojinete-3d';

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
  const wait = (ms) => page.waitForTimeout(ms);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
    await wait(700);
    await ev(() => window.__forgeBrep.applyGearbox());
    await page.waitForFunction('window.__forgeBrep.gbBodies && window.__forgeBrep.gbBodies.length > 0', { timeout: 60000 });
    await wait(1800);
    out.bodies = (await ev(() => window.__forgeBrep.gbBodies)).map(b => b.key);
    out.hasSoportes = out.bodies.includes('soportes');
    out.clearance = await ev(() => window.__forgeBrep.gbMeshClearance ? window.__forgeBrep.gbMeshClearance(0) : null);

    // 01 contexto (hembra oculta por defecto → discos + eje)
    await ev(() => window.__forgeBrep.orbitTo(35, 22, 130)); await wait(700);
    await shot('01-contexto');

    // 02 AISLAR el eje → ver la leva con los CANALES de aceite (3 ángulos cercanos)
    await ev(() => window.__forgeBrep.isolateGbBody('eje')); await wait(900);
    out.visIsolated = await ev(() => window.__forgeBrep.gbVisibleCount);
    await ev(() => window.__forgeBrep.orbitTo(30, 14, 54)); await wait(700); await shot('02-eje-canales-a');
    await ev(() => window.__forgeBrep.orbitTo(90, 3, 50)); await wait(700); await shot('03-eje-canales-lado');
    await ev(() => window.__forgeBrep.orbitTo(0, 68, 56)); await wait(700); await shot('04-eje-canales-top');

    // 05 SECCIÓN del journal disco↔leva (eje + disco-1 visibles, corte en Y)
    await ev(() => window.__forgeBrep.showAllGbBodies()); await wait(300);
    await ev(() => { const a = window.__forgeBrep; a.toggleGbBody('hembra'); a.toggleGbBody('salida'); for (let i = 2; i <= 5; i++) a.toggleGbBody('disco-' + i); }); await wait(600);
    await ev(() => window.__forgeBrep.setSection(true, 'y', 0)); await wait(800);
    out.sectionPlane = await ev(() => window.__forgeBrep.sectionPlane);
    await ev(() => window.__forgeBrep.orbitTo(0, 8, 60)); await wait(700); await shot('05-seccion-journal');
    await ev(() => window.__forgeBrep.orbitTo(40, 18, 70)); await wait(700); await shot('06-seccion-iso');

    // 07 EXPORTA el STL (re-export con la geometría nueva)
    try { await ev(() => window.__forgeBrep.exportSTL()); await wait(1200); out.exported = true; } catch (e) { out.exportErr = String(e).slice(0, 120); }

    out.errs = errs.slice(0, 8);
  } catch (e) { out.fatal = String(e && e.stack || e).slice(0, 600); }
  finally { await browser.close().catch(() => {}); }
  fs.writeFileSync(`${DIR}/data.json`, JSON.stringify(out, null, 2));
  console.log('CAMOIL=' + JSON.stringify({ bodies: out.bodies, hasSoportes: out.hasSoportes, clearance: out.clearance, visIsolated: out.visIsolated, sectionPlane: out.sectionPlane, exported: out.exported, errs: out.errs, fatal: out.fatal }, null, 2));
  process.exit(0);
})();
