/**
 * La Forja — verifica GUARDAR / CARGAR (biblioteca de piezas).
 * Construye una pieza (caja+barreno+componente), la GUARDA, hace NUEVA (resetea),
 * y la CARGA de vuelta → el estado completo se restaura (volumen, nombre,
 * componentes). Más: round-trip serializeDoc→loadDoc. Corre contra build en vivo.
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

    // construir pieza: caja 50×30×20 + barreno ⌀10 + 1 componente
    await ev(() => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: 50, height: 30 })));
    await page.waitForTimeout(350);
    const exId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'extrude').id);
    await ev(({ id }) => window.__forgeBrep.updateOp(id, { depth: 20 }), { id: exId });
    await page.waitForTimeout(350);
    await ev(() => window.__forgeBrep.addOp('hole'));
    await page.waitForTimeout(250);
    const holeId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'hole').id);
    await ev(({ id }) => window.__forgeBrep.updateOp(id, { x: 0, y: 0, diameter: 10, through: true }), { id: holeId });
    await page.waitForTimeout(350);
    await ev(() => window.__forgeBrep.addComponent('box'));
    await page.waitForTimeout(250);
    const cid = await ev(() => window.__forgeBrep.components[0].id);
    await ev(({ id }) => window.__forgeBrep.updateComponent(id, { w: 40, d: 40, h: 40, x: 100, y: 0, z: 20 }), { id: cid });
    await page.waitForTimeout(450);
    await ev(() => window.__forgeBrep.setDocName('Pieza Test'));
    await page.waitForTimeout(150);
    const volSaved = await vol();

    // GUARDAR
    await ev(() => window.__forgeBrep.saveToLibrary());
    await page.waitForTimeout(200);
    const libAfterSave = await ev(() => window.__forgeBrep.libNames);

    // NUEVA (resetea)
    await ev(() => window.__forgeBrep.newDoc());
    await page.waitForTimeout(500);
    const volNew = await vol();
    const nameNew = await ev(() => window.__forgeBrep.docName);
    const compsNew = await ev(() => window.__forgeBrep.components.length);

    // CARGAR de la biblioteca
    await ev(() => window.__forgeBrep.loadFromLibrary('Pieza Test'));
    await page.waitForTimeout(600);
    const volLoaded = await vol();
    const nameLoaded = await ev(() => window.__forgeBrep.docName);
    const compsLoaded = await ev(() => window.__forgeBrep.components.length);
    const hasHole = await ev(() => window.__forgeBrep.opsList.some(o => o.type === 'hole'));

    // ROUND-TRIP serialize→load
    const rt = await ev(() => { const d = window.__forgeBrep.serializeDoc(); window.__forgeBrep.loadDoc(JSON.parse(JSON.stringify(d))); return true; });
    await page.waitForTimeout(500);
    const volRT = await vol();

    const near = (a, b) => Math.abs(a - b) < 1;
    out.volSaved = +volSaved.toFixed(1); out.volNew = +volNew.toFixed(1); out.volLoaded = +volLoaded.toFixed(1); out.volRT = +volRT.toFixed(1);
    out.checks = {
      guarda_en_biblioteca: libAfterSave.includes('Pieza Test'),
      nueva_resetea: Math.abs(volNew - 40 * 24 * 12) < 1 && nameNew === 'Pieza nueva' && compsNew === 0,
      carga_restaura: near(volLoaded, volSaved) && nameLoaded === 'Pieza Test' && compsLoaded === 1 && hasHole === true,
      roundtrip_serializa: rt === true && near(volRT, volSaved),
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('SAVELOAD=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
