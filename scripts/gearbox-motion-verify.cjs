/**
 * La Forja — verifica las 2 cosas que pidió el usuario:
 *  (A) UI limpia: paneles secundarios COLAPSADOS por defecto (caras, análisis, FEA).
 *  (B) MOVIMIENTO: la caja se anima con su cinemática real + material PLA (masa
 *      realista, no aluminio). Construcción de piezas + cinemática (ratio=lóbulos).
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/caja-movimiento.png';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1680,1050'],
  });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
  const isBenign = (s) => /WebGL context|WebGL2?RenderingContext|THREE.WebGLRenderer/i.test(s);
  const errs = []; page.on('pageerror', e => { const s = String(e).slice(0, 200); if (!isBenign(s)) errs.push(s); });
  const out = { errs: [] };
  const near = (a, b, t = 0.02) => Math.abs(a - b) < t;
  try {
    const ready = async () => page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 50000 });
    const ev = async (fn, arg) => { await ready(); return page.evaluate(fn, arg); };
    const inv = async () => { await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.invariants', { timeout: 50000 }); return page.evaluate(() => window.__forgeBrep.invariants); };
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(); await page.waitForTimeout(700);

    // ── (A) UI: paneles secundarios colapsados por defecto ──
    const asideState = await page.evaluate(() => {
      const get = (id) => { const a = document.querySelector(`[data-testid="${id}"]`); return a ? /collapsed/.test(a.className) : null; };
      return { faces: get('face-list'), analysis: get('analysis-panel'), sim: get('sim-panel'), features: get('feature-tree'), params: get('op-panel') };
    });
    out.asideState = asideState;

    // ── caja + PLA ──
    await ev(() => window.__forgeBrep.applyGearbox());
    await page.waitForTimeout(1800);
    const invGb = await inv();
    out.vol = Math.round(invGb.vol_kernel); out.mass_g = +invGb.mass_g.toFixed(1);

    // ── (B) MOVIMIENTO: encender, esperar construcción de piezas ──
    await ev(() => window.__forgeBrep.setGbMotion(true));
    await page.waitForFunction('window.__forgeBrep.gbMotionInfo && window.__forgeBrep.gbMotionInfo.ready', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const mi = await ev(() => window.__forgeBrep.gbMotionInfo);
    out.motionInfo = mi;

    // ── cinemática: ratio real (salida = −θ/lóbulos) + órbita del disco ──
    const pose0 = await ev(() => window.__forgeBrep.gbPoseAt(0));
    const pose360 = await ev(() => window.__forgeBrep.gbPoseAt(360));
    out.outAt360 = pose360.outputDeg;            // debe ser −36 (=−360/10)
    out.disc0_at0 = pose0.discCenters[0];         // (E,0) = (1.5,0)
    out.disc0_at360 = pose360.discCenters[0];     // vuelve a (E,0) (periódico 2π)

    await page.waitForTimeout(600);
    await page.screenshot({ path: SHOT, timeout: 30000 });

    out.checks = {
      // (A) UI limpia
      caras_colapsado: asideState.faces === true,
      analisis_colapsado: asideState.analysis === true,
      fea_colapsado: asideState.sim === true,
      arbol_abierto: asideState.features === false,
      params_abierto: asideState.params === false,
      // PLA (masa realista, no aluminio ~544g)
      masa_pla_no_aluminio: invGb.mass_g > 150 && invGb.mass_g < 360,
      // (B) movimiento
      piezas_construidas: mi && mi.ready === true,
      cinco_discos: mi && mi.discCount === 5,
      piezas_con_geometria: mi && mi.verts && mi.verts.housing > 0 && mi.verts.rotor > 0 && mi.verts.disc > 0 && mi.verts.output > 0,
      ratio_real_10: near(pose360.outputDeg, -36, 0.001),
      disco_orbita_E: near(pose0.discCenters[0].x, 1.5) && near(pose0.discCenters[0].y, 0),
      orbita_periodica: near(pose360.discCenters[0].x, 1.5) && near(pose360.discCenters[0].y, 0),
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 600); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('GEARBOX_MOTION=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
