/**
 * La Forja — verifica el PATRÓN (Fusion-style) con VOLUMEN EXACTO del kernel:
 *   · lineal   3× (dx grande → instancias disjuntas) → vol = 3 × base
 *   · circular count 2 a 90° de una caja 40×20 → unión = 1.5 × base (geom. exacta)
 *   · espejo   sobre caja con barreno descentrado → la copia rellena el hueco →
 *              vol → caja llena (ratio ≈ 1.067), prueba que el espejo añade material
 * Más: el nodo del árbol y el panel de modos existen. Corre en iangpu (:5002).
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/pattern.png';

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

    // patrón — addOp lo deja ACTIVO, así que el panel de modos sale de inmediato
    await ev(() => window.__forgeBrep.addOp('pattern'));
    await page.waitForTimeout(350);
    const patId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'pattern').id);
    const nodePresent = await page.locator('[data-testid="feat-pattern"]').count();
    const panelModes = await page.evaluate(() =>
      ['pat-linear', 'pat-circular', 'pat-mirror'].filter(id => document.querySelector(`[data-testid="${id}"]`)).length);

    // ratio = vol(patrón) / vol(base) midiendo con suprimir/reactivar el patrón
    const ratioFor = async (patch) => {
      await ev(({ id, p }) => window.__forgeBrep.updateOp(id, p), { id: patId, p: patch });
      await page.waitForTimeout(550);
      const patVol = await vol();
      await ev((id) => window.__forgeBrep.toggleSuppressOp(id), patId); await page.waitForTimeout(550);
      const baseV = await vol();
      await ev((id) => window.__forgeBrep.toggleSuppressOp(id), patId); await page.waitForTimeout(450);
      return patVol / baseV;
    };

    const rLinear = await ratioFor({ mode: 'linear', count: 3, dx: 60, dy: 0 });
    const rCircular = await ratioFor({ mode: 'circular', count: 2, angleSpan: 90, axis: 'z' });

    // espejo necesita base ASIMÉTRICA → barreno descentrado ANTES del patrón
    await ev(() => window.__forgeBrep.addOp('hole'));
    await page.waitForTimeout(300);
    const holeId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'hole').id);
    await ev(({ id }) => window.__forgeBrep.updateOp(id, { x: 12, y: 0, diameter: 8, through: true }), { id: holeId });
    await page.waitForTimeout(350);
    await ev((id) => window.__forgeBrep.moveOp(id, -1), holeId); // [extrude, hole, pattern]
    await page.waitForTimeout(450);
    const rMirror = await ratioFor({ mode: 'mirror', plane: 'yz' });
    await page.screenshot({ path: SHOT, timeout: 30000 });

    out.boxVol = +boxVol.toFixed(1); out.rLinear = +rLinear.toFixed(3); out.rCircular = +rCircular.toFixed(3); out.rMirror = +rMirror.toFixed(3);
    out.checks = {
      caja_base: Math.abs(boxVol - 9600) < 50,
      lineal_3x: rLinear > 2.9 && rLinear < 3.1,
      circular_1p5x: rCircular > 1.4 && rCircular < 1.6,
      espejo_rellena: rMirror > 1.04 && rMirror < 1.10,
      nodo_en_arbol: nodePresent === 1,
      panel_3_modos: panelModes === 3,
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('PATTERN=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
