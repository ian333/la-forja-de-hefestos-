/**
 * La Forja — verifica el CORTE / BOLSILLO con VOLUMEN EXACTO del kernel.
 * Caja 40×20×12 = 9600 mm³. El corte resta:
 *   · rect pasante 12×8  → 12·8·12 = 1152 mm³
 *   · rect ciego 12×8 ×5 →   12·8·5 =  480 mm³
 *   · círculo pasante ⌀8 → π·4²·12 ≈ 603.19 mm³
 * Corre en iangpu (:5002).
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/pocket.png';

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
    const ready = async () => page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 15000 });
    const ev = async (fn, arg) => { await ready(); return page.evaluate(fn, arg); };
    const vol = async () => {
      await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.invariants', { timeout: 15000 });
      return page.evaluate(() => window.__forgeBrep.invariants.vol_kernel);
    };
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await ready(); await page.waitForTimeout(700);

    // caja base 40×20×12
    await ev(() => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: 40, height: 20 })));
    await page.waitForTimeout(400);
    const exId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'extrude').id);
    await ev(({ id }) => window.__forgeBrep.updateOp(id, { depth: 12 }), { id: exId });
    await page.waitForTimeout(450);
    const boxVol = await vol();

    // corte — addOp lo deja activo → el panel sale de inmediato
    await ev(() => window.__forgeBrep.addOp('pocket'));
    await page.waitForTimeout(350);
    const pkId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'pocket').id);
    const nodePresent = await page.locator('[data-testid="feat-pocket"]').count();
    const panelOpts = await page.evaluate(() =>
      ['pocket-rect', 'pocket-circle', 'input-pocket-x'].filter(id => document.querySelector(`[data-testid="${id}"]`)).length);

    const removedBy = async (patch) => {
      await ev(({ id, p }) => window.__forgeBrep.updateOp(id, p), { id: pkId, p: patch });
      await page.waitForTimeout(550);
      const v = await vol();
      return boxVol - v;
    };

    const rectThrough = await removedBy({ profile: 'rect', x: 0, y: 0, w: 12, h: 8, through: true });
    const rectBlind = await removedBy({ profile: 'rect', x: 0, y: 0, w: 12, h: 8, through: false, depth: 5 });
    const circThrough = await removedBy({ profile: 'circle', x: 0, y: 0, diameter: 8, through: true });
    await page.screenshot({ path: SHOT, timeout: 30000 });

    const near = (a, b) => Math.abs(a - b) < Math.max(1, b * 0.01);
    out.boxVol = +boxVol.toFixed(1); out.rectThrough = +rectThrough.toFixed(1);
    out.rectBlind = +rectBlind.toFixed(1); out.circThrough = +circThrough.toFixed(1);
    out.checks = {
      caja_base: near(boxVol, 9600),
      rect_pasante_1152: near(rectThrough, 1152),
      rect_ciego_480: near(rectBlind, 480),
      circulo_pasante_603: near(circThrough, Math.PI * 16 * 12),
      nodo_en_arbol: nodePresent === 1,
      panel_corte: panelOpts === 3,
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('POCKET=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
