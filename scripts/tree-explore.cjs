/**
 * Explora el ARBOL DE SOPORTES en la caja: lo aisla, lo pone en contexto, y reporta
 * los cuerpos. Corre en iangpu (GPU real) contra el dev server :5002. Honesto: para
 * VER si el arbol funciona o es un desastre.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = process.env.DIR || '/home/ian/Orkesta/la-forja/forja-shots/tree';

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
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
    await page.waitForTimeout(700);
    await ev(() => window.__forgeBrep.applyGearbox());
    await page.waitForFunction('window.__forgeBrep.gbBodies && window.__forgeBrep.gbBodies.length > 0', { timeout: 40000 });
    await page.waitForTimeout(1800);
    out.bodies = await ev(() => window.__forgeBrep.gbBodies);
    out.hasSoportes = !!(out.bodies || []).find(b => b.key === 'soportes');

    // 01 default (hembra oculta → discos de color + arbol verde)
    await shot('01-contexto');
    // 02 AISLAR el arbol → verlo solo
    await ev(() => window.__forgeBrep.isolateGbBody('soportes'));
    await page.waitForTimeout(900);
    out.visIsolated = await ev(() => window.__forgeBrep.gbVisibleCount);
    await shot('02-arbol-aislado');
    // 03 arbol + 1 disco (¿los deditos llegan al borde del disco?)
    await ev(() => window.__forgeBrep.toggleGbBody('disco-1'));
    await page.waitForTimeout(900);
    await shot('03-arbol-y-disco');
    // 04 todo + hembra (ver espinas en la pared)
    await ev(() => window.__forgeBrep.showAllGbBodies());
    await page.waitForTimeout(900);
    await shot('04-todo');

    out.errs = errs.slice(0, 8);
  } catch (e) { out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { await browser.close(); }
  fs.writeFileSync(`${DIR}/data.json`, JSON.stringify(out, null, 2));
  console.log('TREE=' + JSON.stringify({ hasSoportes: out.hasSoportes, bodies: (out.bodies || []).map(b => b.key), visIsolated: out.visIsolated, errs: out.errs, fatal: out.fatal }, null, 2));
  await browser.close().catch(() => {});
  process.exit(0);
})();
