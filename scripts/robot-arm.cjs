/**
 * GENERADOR DE BRAZO ROBÓTICO (diseño generativo de mecanismo) en La Forja.
 * Parte 1: genera cada ESLABÓN como pieza imprimible (barra + 2 barrenos de
 *   junta) y lo GUARDA en la biblioteca (regenerable, listo para imprimir/STL).
 * Parte 2: posa el brazo (cinemática directa) como ensamble — eslabones girados
 *   (rz) + pernos de junta — y saca su PLANO. Screenshots del brazo y de un eslabón.
 * Cinemática verificada aparte en armgen.ts (19/19). Corre contra build en vivo.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots';

const W = 24, T = 6, BORE = 5;            // ancho, espesor, ⌀ junta (mm)
const SEGS = [120, 90, 60];               // longitudes de eslabón (mm)
const POSE = [40, -70, 50];               // ángulos relativos de junta (grados)
const D2R = Math.PI / 180;

// cinemática directa (posiciones de junta) — inline (canónica en armgen.ts)
function fk() {
  const P = [{ x: 0, y: 0 }]; const phi = [];
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < SEGS.length; i++) {
    a += POSE[i] * D2R; phi.push(a);
    x += SEGS[i] * Math.cos(a); y += SEGS[i] * Math.sin(a);
    P.push({ x, y });
  }
  return { P, phiDeg: phi.map(r => r / D2R) };
}
const link1Vol = (SEGS[0] + W) * W * T - 2 * (Math.PI * (BORE / 2) ** 2 * T);
const armVolExp = 60 * 60 * 20 + SEGS.reduce((s, L) => s + L * W * T, 0) + 4 * (Math.PI * 9 * 30);

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

    // ── PARTE 1: generar cada eslabón imprimible + guardarlo ──
    let linkVol = 0;
    for (let i = 0; i < SEGS.length; i++) {
      await ev(() => window.__forgeBrep.newDoc()); await page.waitForTimeout(350);
      await ev((n) => window.__forgeBrep.setDocName(n), `Eslabón ${i + 1}`);
      await ev(({ L }) => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: L + 24, height: 24 })), { L: SEGS[i] });
      await page.waitForTimeout(350);
      const exId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'extrude').id);
      await ev(({ id }) => window.__forgeBrep.updateOp(id, { depth: 6 }), { id: exId });
      await page.waitForTimeout(300);
      for (const sx of [-SEGS[i] / 2, SEGS[i] / 2]) {
        await ev(() => window.__forgeBrep.addOp('hole')); await page.waitForTimeout(200);
        const hid = await ev(() => { const l = window.__forgeBrep.opsList.filter(o => o.type === 'hole'); return l[l.length - 1].id; });
        await ev(({ id, x }) => window.__forgeBrep.updateOp(id, { x, y: 0, diameter: 5, through: true }), { id: hid, x: sx });
        await page.waitForTimeout(300);
      }
      if (i === 0) {
        linkVol = await vol();
        await page.click('[data-testid="btn-plano"]'); await page.waitForTimeout(700);
        await page.screenshot({ path: `${DIR}/robot-link-plano.png`, timeout: 30000 });
        await page.click('[data-testid="btn-plano-close"]'); await page.waitForTimeout(300);
      }
      await ev(() => window.__forgeBrep.saveToLibrary()); await page.waitForTimeout(250);
    }
    const lib = await ev(() => window.__forgeBrep.libNames);

    // ── PARTE 2: posar el brazo (cinemática) como ensamble ──
    await ev(() => window.__forgeBrep.newDoc()); await page.waitForTimeout(350);
    await ev(() => window.__forgeBrep.setDocName('Brazo robótico 3R'));
    await ev(() => window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: 60, height: 60 })));
    await page.waitForTimeout(300);
    const bId = await ev(() => window.__forgeBrep.opsList.find(o => o.type === 'extrude').id);
    await ev(({ id }) => window.__forgeBrep.updateOp(id, { depth: 20 }), { id: bId });
    await page.waitForTimeout(400);
    const { P, phiDeg } = fk();
    for (let i = 0; i < SEGS.length; i++) {
      const mid = { x: (P[i].x + P[i + 1].x) / 2, y: (P[i].y + P[i + 1].y) / 2 };
      await ev(() => window.__forgeBrep.addComponent('box')); await page.waitForTimeout(180);
      const cid = await ev(() => { const l = window.__forgeBrep.components; return l[l.length - 1].id; });
      await ev(({ id, c }) => window.__forgeBrep.updateComponent(id, c), { id: cid, c: { w: SEGS[i], d: W, h: T, x: mid.x, y: mid.y, z: 23 + i * 7, rz: phiDeg[i] } });
      await page.waitForTimeout(220);
    }
    for (let i = 0; i < P.length; i++) {   // pernos de junta
      await ev(() => window.__forgeBrep.addComponent('cyl')); await page.waitForTimeout(160);
      const cid = await ev(() => { const l = window.__forgeBrep.components; return l[l.length - 1].id; });
      await ev(({ id, p }) => window.__forgeBrep.updateComponent(id, { r: 3, h: 30, x: p.x, y: p.y, z: 20 }), { id: cid, p: P[i] });
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);
    const nComp = await ev(() => window.__forgeBrep.components.length);
    const armVol = await vol();
    await page.screenshot({ path: `${DIR}/robot-arm-3d.png`, timeout: 30000 });
    await page.click('[data-testid="btn-plano"]'); await page.waitForTimeout(800);
    const planoOk = await ev(() => { const s = window.__forgeBrep.planoSvg || ''; return s.includes('>ALZADO<') && s.includes('>PLANTA<'); });
    await page.screenshot({ path: `${DIR}/robot-arm-plano.png`, timeout: 30000 });

    const near = (a, b, t = 5) => Math.abs(a - b) < t;
    out.linkVol = +linkVol.toFixed(1); out.armVol = +armVol.toFixed(1); out.armVolExp = +armVolExp.toFixed(1); out.nComp = nComp; out.lib = lib;
    out.checks = {
      eslabon_imprimible: near(linkVol, link1Vol, 1),
      tres_eslabones_en_biblioteca: ['Eslabón 1', 'Eslabón 2', 'Eslabón 3'].every(n => lib.includes(n)),
      brazo_ensambla_girado: nComp === 7 && near(armVol, armVolExp, 5),
      plano_del_brazo: planoOk === true,
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('ROBOT_ARM=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
