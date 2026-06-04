/**
 * ENSAMBLE + RECONSTRUCCIÓN VF-2 (massing a medidas reales publicadas).
 * Pieza principal = BASE; componentes = columna, mesa, silla, cabezal, husillo.
 * Verifica que el COMPOUND suma EXACTO (vol = Σ partes) y saca el PLANO del
 * conjunto. Screenshots del 3D y del plano. Corre contra el build indicado.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots';

// massing VF-2 (mm). base = pieza principal (rect WxD, extrude H).
const BASE = { w: 1200, d: 1400, h: 600 };
const COMPS = [
  { kind: 'box', w: 900, d: 450, h: 1500, x: 0, y: 475, z: 1350 },  // columna (atrás)
  { kind: 'box', w: 700, d: 450, h: 120, x: 0, y: -150, z: 610 },   // silla
  { kind: 'box', w: 914, d: 356, h: 80, x: 0, y: -150, z: 690 },    // MESA 914×356 (real)
  { kind: 'box', w: 480, d: 420, h: 450, x: 0, y: 250, z: 1450 },   // cabezal
  { kind: 'cyl', r: 55, h: 280, x: 0, y: 80, z: 1080 },             // husillo
];
const volBox = (b) => b.w * b.d * b.h;
const volCyl = (c) => Math.PI * c.r * c.r * c.h;
const EXPECTED = volBox(BASE) + COMPS.reduce((s, c) => s + (c.kind === 'cyl' ? volCyl(c) : volBox(c)), 0);

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const isBenign = (s) => /WebGL context|WebGL2?RenderingContext|THREE.WebGLRenderer/i.test(s);
  const errs = []; page.on('pageerror', e => { const s = String(e).slice(0, 200); if (!isBenign(s)) errs.push(s); });
  const out = { errs: [], expected: Math.round(EXPECTED) };
  try {
    const ready = async () => page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 20000 });
    const ev = async (fn, arg) => { await ready(); return page.evaluate(fn, arg); };
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await ready(); await page.waitForTimeout(700);

    // BASE como pieza principal
    await ev(({ w, d }) => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: w, height: d })), BASE);
    await page.waitForTimeout(400);
    const exId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'extrude').id);
    await ev(({ id, h }) => window.__forgeBrep.updateOp(id, { depth: h }), { id: exId, h: BASE.h });
    await page.waitForTimeout(500);

    // componentes
    for (const c of COMPS) {
      await ev((kind) => window.__forgeBrep.addComponent(kind), c.kind);
      await page.waitForTimeout(200);
      const cid = await ev(() => { const l = window.__forgeBrep.components; return l[l.length - 1].id; });
      await ev(({ id, c }) => window.__forgeBrep.updateComponent(id, c), { id: cid, c });
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(600);

    const nComp = await ev(() => window.__forgeBrep.components.length);
    const inv = await ev(() => window.__forgeBrep.invariants);
    out.vol = inv && Math.round(inv.vol_kernel); out.faces = inv && inv.n_faces;
    await page.screenshot({ path: `${DIR}/vf2-machine-3d.png`, timeout: 30000 });

    // PLANO del conjunto
    await page.click('[data-testid="btn-plano"]');
    await page.waitForTimeout(800);
    const svg = await ev(() => window.__forgeBrep.planoSvg || '');
    out.planoOk = svg.includes('>ALZADO<') && svg.includes('>PLANTA<') && svg.includes('>LATERAL<');
    await page.screenshot({ path: `${DIR}/vf2-machine-plano.png`, timeout: 30000 });

    out.checks = {
      componentes_5: nComp === 5,
      compound_suma_exacto: out.vol != null && Math.abs(out.vol - EXPECTED) < 2000,
      plano_del_conjunto: out.planoOk === true,
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('VF2_MACHINE=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
