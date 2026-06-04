/**
 * GENERADOR DE REDUCTOR CICLOIDAL (engrane de lóbulos) en La Forja.
 * Parte 1: el DISCO cicloidal como pieza imprimible (perfil de lóbulos + barreno
 *   central + anillo de barrenos de salida) → biblioteca + su plano.
 * Parte 2: el REDUCTOR ensamblado — disco (offset E, mallando) + anillo de 11
 *   pernos + eje excéntrico → plano del conjunto. Reducción 10:1, print-in-place.
 * Geometría verificada aparte en cycloidal.ts (13/13). Corre contra build en vivo.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots';

const LOBES = 10, R = 40, Rr = 3, E = 1.5, T = 8;     // 10:1
const N = LOBES + 1;                                   // 11 pernos
const SEGS = 150;
const CENTER_BORE = 12, OUT_RING = 22, OUT_COUNT = 4, OUT_PIND = 8;
const OUT_HOLE_D = OUT_PIND + 2 * E;                   // = 11

function discProfile(offsetX) {
  const pts = [];
  for (let i = 0; i < SEGS; i++) {
    const t = (2 * Math.PI * i) / SEGS;
    const psi = Math.atan2(Math.sin((1 - N) * t), (R / (E * N)) - Math.cos((1 - N) * t));
    const x = R * Math.cos(t) - Rr * Math.cos(t + psi) - E * Math.cos(N * t) + offsetX;
    const y = -R * Math.sin(t) + Rr * Math.sin(t + psi) + E * Math.sin(N * t);
    pts.push({ x, y });
  }
  let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; }
  if (s < 0) pts.reverse();
  return pts;
}

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
    const buildDisc = async (offset) => {
      await ev((pts) => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'custom', customProfile: pts })), discProfile(offset));
      await page.waitForTimeout(500);
      const exId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'extrude').id);
      await ev(({ id, t }) => window.__forgeBrep.updateOp(id, { depth: t }), { id: exId, t: T });
      await page.waitForTimeout(500);
      await ev(() => window.__forgeBrep.addOp('hole')); await page.waitForTimeout(200);
      const cb = await ev(() => { const l = window.__forgeBrep.opsList.filter(o => o.type === 'hole'); return l[l.length - 1].id; });
      await ev(({ id, d }) => window.__forgeBrep.updateOp(id, { x: 0, y: 0, diameter: d, through: true }), { id: cb, d: CENTER_BORE });
      await page.waitForTimeout(300);
      for (let k = 0; k < OUT_COUNT; k++) {
        const a = (2 * Math.PI * k) / OUT_COUNT;
        await ev(() => window.__forgeBrep.addOp('hole')); await page.waitForTimeout(150);
        const hid = await ev(() => { const l = window.__forgeBrep.opsList.filter(o => o.type === 'hole'); return l[l.length - 1].id; });
        await ev(({ id, x, y, d }) => window.__forgeBrep.updateOp(id, { x, y, diameter: d, through: true }), { id: hid, x: OUT_RING * Math.cos(a), y: OUT_RING * Math.sin(a), d: OUT_HOLE_D });
        await page.waitForTimeout(220);
      }
    };
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(); await page.waitForTimeout(700);

    // ── PARTE 1: disco imprimible (centrado) ──
    await ev(() => window.__forgeBrep.newDoc()); await page.waitForTimeout(350);
    await ev(() => window.__forgeBrep.setDocName('Disco cicloidal 10a1'));
    await buildDisc(0);
    const discVol = await vol();
    const discLobesPlano = await (async () => { await page.click('[data-testid="btn-plano"]'); await page.waitForTimeout(800); const s = await ev(() => window.__forgeBrep.planoSvg || ''); await page.screenshot({ path: `${DIR}/cycloidal-disc-plano.png`, timeout: 30000 }); await page.click('[data-testid="btn-plano-close"]'); await page.waitForTimeout(300); return s.includes('>PLANTA<'); })();
    await ev(() => window.__forgeBrep.saveToLibrary()); await page.waitForTimeout(250);
    const lib = await ev(() => window.__forgeBrep.libNames);

    // ── PARTE 2: reductor ensamblado (disco offset E + anillo de pernos + eje) ──
    await ev(() => window.__forgeBrep.newDoc()); await page.waitForTimeout(350);
    await ev(() => window.__forgeBrep.setDocName('Reductor cicloidal 10a1'));
    await buildDisc(E);   // offset para mallar
    for (let i = 0; i < N; i++) {        // anillo de pernos
      const a = (2 * Math.PI * i) / N;
      await ev(() => window.__forgeBrep.addComponent('cyl')); await page.waitForTimeout(150);
      const cid = await ev(() => { const l = window.__forgeBrep.components; return l[l.length - 1].id; });
      await ev(({ id, x, y, r, h }) => window.__forgeBrep.updateComponent(id, { r, h, x, y, z: h / 2 }), { id: cid, x: R * Math.cos(a), y: R * Math.sin(a), r: Rr, h: T });
      await page.waitForTimeout(180);
    }
    await ev(() => window.__forgeBrep.addComponent('cyl')); await page.waitForTimeout(150);   // eje excéntrico
    const ecc = await ev(() => { const l = window.__forgeBrep.components; return l[l.length - 1].id; });
    await ev(({ id }) => window.__forgeBrep.updateComponent(id, { r: 5, h: 24, x: 0, y: 0, z: 12 }), { id: ecc });
    await page.waitForTimeout(500);
    const nComp = await ev(() => window.__forgeBrep.components.length);
    const drvVol = await vol();
    await page.screenshot({ path: `${DIR}/cycloidal-3d.png`, timeout: 30000 });
    await page.click('[data-testid="btn-plano"]'); await page.waitForTimeout(800);
    const planoOk = await ev(() => { const s = window.__forgeBrep.planoSvg || ''; return s.includes('>ALZADO<') && s.includes('>PLANTA<'); });
    await page.screenshot({ path: `${DIR}/cycloidal-plano.png`, timeout: 30000 });

    out.discVol = +discVol.toFixed(1); out.drvVol = +drvVol.toFixed(1); out.nComp = nComp; out.ratio = LOBES; out.lib = lib;
    out.checks = {
      disco_ciclo_construye: discVol > 1000,            // el perfil de lóbulos → sólido
      disco_en_biblioteca: lib.includes('Disco cicloidal 10a1'),
      disco_tiene_plano: discLobesPlano === true,
      reductor_ensambla: nComp === N + 1 && drvVol > discVol,   // 11 pernos + eje
      plano_del_reductor: planoOk === true,
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('CYCLOIDAL_GEN=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
