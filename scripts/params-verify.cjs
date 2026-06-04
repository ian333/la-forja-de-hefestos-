/**
 * La Forja — verifica PARÁMETROS con ecuaciones (Change Parameters de Fusion).
 * Define ancho=40, alto=ancho/2, espesor=12; liga la caja (width=ancho,
 * height=alto, extrude depth=espesor) → vol = 40·20·12 = 9600. Luego cambia
 * SOLO ancho=60 → alto=30 por la ecuación → vol = 60·30·12 = 21600 (propagación).
 * Más: error de expresión detectado + ƒₓ en la cota. Corre en iangpu (:5002).
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/params.png';

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

    await ev(() => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect' })));
    await ev(() => window.__forgeBrep.setParamsOpen(true));
    await page.waitForTimeout(300);
    const panelVisible = await page.locator('[data-testid="params-panel"]').isVisible();

    // crear 3 parámetros y nombrarlos/ecuarlos
    await ev(() => { window.__forgeBrep.addParam(); window.__forgeBrep.addParam(); window.__forgeBrep.addParam(); });
    await page.waitForTimeout(250);
    const ids = await ev(() => window.__forgeBrep.params.map(p => p.id));
    await ev((id) => window.__forgeBrep.updateParam(id, { name: 'ancho', expr: '40' }), ids[0]);
    await ev((id) => window.__forgeBrep.updateParam(id, { name: 'alto', expr: 'ancho/2' }), ids[1]);
    await ev((id) => window.__forgeBrep.updateParam(id, { name: 'espesor', expr: '12' }), ids[2]);
    await page.waitForTimeout(300);
    const scope = await ev(() => window.__forgeBrep.paramScope);

    // ligar la caja a los parámetros
    const exId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'extrude').id);
    await ev(() => { window.__forgeBrep.setBinding('sketch:width', 'ancho'); window.__forgeBrep.setBinding('sketch:height', 'alto'); });
    await ev((id) => window.__forgeBrep.setBinding(id + ':depth', 'espesor'), exId);
    await page.waitForTimeout(600);
    const volBound = await vol();

    // PROPAGACIÓN: cambiar SOLO ancho → alto se recalcula por la ecuación
    await ev((id) => window.__forgeBrep.updateParam(id, { expr: '60' }), ids[0]);
    await page.waitForTimeout(600);
    const scope2 = await ev(() => window.__forgeBrep.paramScope);
    const volProp = await vol();

    // ƒₓ visible en la cota (activar el sketch para ver el panel del perfil)
    await page.click('[data-testid="feat-sketch"]'); await page.waitForTimeout(250);
    const fxBound = await page.locator('[data-testid="input-ancho-expr"]').count();
    await page.screenshot({ path: SHOT, timeout: 30000 });

    // ERROR de expresión detectado
    await ev((id) => window.__forgeBrep.updateParam(id, { expr: 'noexiste*2' }), ids[2]);
    await page.waitForTimeout(350);
    const errDetected = await ev((id) => !!window.__forgeBrep.paramErrors[id], ids[2]);

    const near = (a, b) => Math.abs(a - b) < 1;
    out.scope = scope; out.scope2 = scope2; out.volBound = +volBound.toFixed(1); out.volProp = +volProp.toFixed(1);
    out.checks = {
      panel_visible: panelVisible === true,
      scope_ecuaciones: near(scope.ancho, 40) && near(scope.alto, 20) && near(scope.espesor, 12),
      vol_parametrico: near(volBound, 9600),
      propaga_ecuacion: near(scope2.ancho, 60) && near(scope2.alto, 30) && near(volProp, 21600),
      fx_en_cota: fxBound === 1,
      error_detectado: errDetected === true,
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('PARAMS=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
