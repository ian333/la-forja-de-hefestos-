/**
 * La Forja — verifica EJEMPLOS cargables (reductor cicloidal como proyecto) +
 * SECCIÓN (corte por plano para ver caras internas). Corre contra build en vivo.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/seccion-cicloidal.png';

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

    // menú: el ejemplo está listado
    await page.click('[data-testid="btn-options"]'); await page.waitForTimeout(300);
    const exBtn = await page.locator('[data-testid="menu-example"]').count();
    await page.keyboard.press('Escape').catch(() => {});
    await page.click('body', { position: { x: 800, y: 500 } }).catch(() => {});
    await page.waitForTimeout(200);

    // cargar el reductor cicloidal como PROYECTO
    await ev(() => window.__forgeBrep.loadExample(0));
    await page.waitForTimeout(900);
    const name = await ev(() => window.__forgeBrep.docName);
    const nComp = await ev(() => window.__forgeBrep.components.length);
    const v = await vol();

    // SECCIÓN: corte por plano Y, a la mitad → ver adentro
    await ev(() => window.__forgeBrep.setSection(true, 'y', 0));
    await page.waitForTimeout(500);
    const secOn = await ev(() => window.__forgeBrep.sectionOn);
    const secPlanes = await ev(() => window.__forgeBrep.sectionPlaneCount);
    const secBtn = await page.locator('[data-testid="btn-section"]').count();
    const secAxes = await page.evaluate(() => ['sec-axis-x', 'sec-axis-y', 'sec-axis-z'].filter(id => document.querySelector(`[data-testid="${id}"]`)).length);
    await page.screenshot({ path: SHOT, timeout: 30000 });

    out.name = name; out.nComp = nComp; out.vol = Math.round(v);
    out.checks = {
      ejemplo_en_menu: exBtn >= 1,
      proyecto_carga: name === 'Reductor cicloidal 10:1' && nComp === 12 && v > 1000,
      seccion_activa: secOn === true && secPlanes === 1,
      seccion_ui: secBtn === 1 && secAxes === 3,
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('SECTION_EXAMPLE=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
