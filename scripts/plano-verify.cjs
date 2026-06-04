/**
 * La Forja — verifica el MOTOR DE PLANOS en la UI: del sólido (caja 40×20×12)
 * genera el plano de taller (3 vistas, líneas ocultas, cotas, cajetín) y permite
 * descargar el SVG. Corre en iangpu (:5002).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/plano.png';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, acceptDownloads: true });
  const isBenign = (s) => /WebGL context|WebGL2?RenderingContext|THREE.WebGLRenderer/i.test(s);
  const errs = []; page.on('pageerror', e => { const s = String(e).slice(0, 200); if (!isBenign(s)) errs.push(s); });
  const out = { errs: [] };
  try {
    const ready = async () => page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 15000 });
    const ev = async (fn, arg) => { await ready(); return page.evaluate(fn, arg); };
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await ready(); await page.waitForTimeout(700);

    await ev(() => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: 40, height: 20 })));
    await page.waitForTimeout(400);
    const exId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'extrude').id);
    await ev(({ id }) => window.__forgeBrep.updateOp(id, { depth: 12 }), { id: exId });
    await page.waitForTimeout(450);
    // un barreno pasante → la PLANTA muestra un círculo, el ALZADO líneas ocultas
    await ev(() => window.__forgeBrep.addOp('hole'));
    await page.waitForTimeout(300);
    const holeId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'hole').id);
    await ev(({ id }) => window.__forgeBrep.updateOp(id, { x: 8, y: 0, diameter: 10, through: true }), { id: holeId });
    await page.waitForTimeout(500);

    await page.click('[data-testid="btn-plano"]');
    await page.waitForTimeout(500);
    const overlay = await page.locator('[data-testid="plano-overlay"]').isVisible();
    const svg = await ev(() => window.__forgeBrep.planoSvg || '');
    await page.screenshot({ path: SHOT, timeout: 30000 });

    // descargar SVG
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
      page.click('[data-testid="btn-plano-download"]'),
    ]);
    let dlName = null, dlBytes = 0;
    if (dl) { dlName = dl.suggestedFilename(); const p = '/tmp/forja-plano-test.svg'; await dl.saveAs(p); dlBytes = fs.statSync(p).size; }

    out.svgLen = svg.length; out.dlName = dlName; out.dlBytes = dlBytes;
    out.checks = {
      overlay_abre: overlay === true,
      tres_vistas: svg.includes('>ALZADO<') && svg.includes('>PLANTA<') && svg.includes('>LATERAL<'),
      lineas_visibles_y_ocultas: svg.includes('data-line="visible"') && svg.includes('data-line="hidden"'),
      cajetin: svg.includes('data-testid="title-block"') && svg.includes('La Forja · GAIA'),
      cota_ancho_40: svg.includes('>40.0<'),
      descarga_svg: dlName === 'forja-plano.svg' && dlBytes > 400,
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('PLANO=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
