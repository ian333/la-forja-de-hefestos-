/**
 * RECONSTRUCCIÓN VF-2 · pieza 1 — la MESA a medida real (Haas VF-2):
 *   mesa 914×356 mm (36"×14"), espesor 80, con 3 ranuras longitudinales (groove
 *   16 mm, prof 20) — representación v1 (sin el rebaje en T, falta sweep-cut).
 * Construye en La Forja vía el hook, mide, y saca el PLANO de taller. Screenshots
 * del 3D y del plano. Corre en iangpu (:5002).
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots';

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
    const ready = async () => page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 20000 });
    const ev = async (fn, arg) => { await ready(); return page.evaluate(fn, arg); };
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await ready(); await page.waitForTimeout(700);

    // mesa 914×356×80 (medidas reales VF-2)
    await ev(() => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: 914, height: 356 })));
    await page.waitForTimeout(400);
    const exId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'extrude').id);
    await ev(({ id }) => window.__forgeBrep.updateOp(id, { depth: 80 }), { id: exId });
    await page.waitForTimeout(500);

    // 3 ranuras longitudinales (a lo largo de X), groove 16 mm, prof 20
    for (const yslot of [-110, 0, 110]) {
      await ev(() => window.__forgeBrep.addOp('pocket'));
      await page.waitForTimeout(250);
      const pid = await ev(() => { const l = window.__forgeBrep.opsList.filter(o => o.type === 'pocket'); return l[l.length - 1].id; });
      await ev(({ id, y }) => window.__forgeBrep.updateOp(id, { profile: 'rect', x: 0, y, w: 940, h: 16, through: false, depth: 20 }), { id: pid, y: yslot });
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(500);

    const inv = await ev(() => window.__forgeBrep.invariants);
    out.vol_mm3 = inv && +inv.vol_kernel.toFixed(0);
    out.faces = inv && inv.n_faces; out.edges = inv && inv.n_edges;

    // screenshot del 3D (puede salir negro si no pega el GPU)
    await page.screenshot({ path: `${DIR}/vf2-table-3d.png`, timeout: 30000 });

    // PLANO de taller
    await page.click('[data-testid="btn-plano"]');
    await page.waitForTimeout(700);
    const svg = await ev(() => window.__forgeBrep.planoSvg || '');
    out.svgLen = svg.length;
    out.planoOk = svg.includes('>PLANTA<') && svg.includes('data-line="hidden"');
    await page.screenshot({ path: `${DIR}/vf2-table-plano.png`, timeout: 30000 });

    out.pass = out.vol_mm3 > 24e6 && out.planoOk && errs.length === 0;
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('VF2_TABLE=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
