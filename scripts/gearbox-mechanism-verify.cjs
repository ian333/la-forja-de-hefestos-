/**
 * La Forja — verifica los DOS arreglos del juicio del usuario sobre la caja cicloidal:
 *
 *  (A) CURVA REAL, no líneas: el disco cicloidal se extruye por B-SPLINE (1 arista
 *      curva) y NO por polígono de N segmentos. Prueba A/B sobre el mismo perfil:
 *      smooth=true (spline) tiene MUCHÍSIMAS menos aristas que smooth=false (polígono),
 *      con el MISMO volumen (≈misma área encerrada) → la curva no es basura.
 *
 *  (B) EL EJE CONECTA con los discos: levas EXCÉNTRICAS (offset E, fasadas) + barrenos
 *      de salida holgados. gearboxGeom asierta camOffset==E (es excéntrica),
 *      discBoreR−camR==gap (ajuste deslizante), outHoleD−outPinD==2E+2gap (órbita),
 *      fases balanceadas. Y la caja construye + sobrevive (portero).
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/caja-mecanismo.png';

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
  const near = (a, b, t = 0.02) => Math.abs(a - b) < t;
  try {
    const ready = async () => page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 50000 });
    const ev = async (fn, arg) => { await ready(); return page.evaluate(fn, arg); };
    const inv = async () => { await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.invariants', { timeout: 50000 }); return page.evaluate(() => window.__forgeBrep.invariants); };
    const survText = async () => page.locator('[data-testid="gb-survives"]').innerText().catch(() => '');
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(); await page.waitForTimeout(700);

    // ── (A) CURVA REAL — A/B sobre el reductor cicloidal de ejemplo (perfil custom) ──
    await ev(() => window.__forgeBrep.loadExample(0));   // ⚙ Reductor cicloidal (smooth:true)
    await page.waitForTimeout(1800);
    const invSpline = await inv();
    await ev(() => window.__forgeBrep.setSketch((s) => ({ ...s, smooth: false })));  // → polígono
    await page.waitForTimeout(1800);
    const invPoly = await inv();
    out.edges_spline = invSpline.edges; out.edges_poly = invPoly.edges;
    out.vol_spline = Math.round(invSpline.vol_kernel); out.vol_poly = Math.round(invPoly.vol_kernel);

    // ── (B) EL EJE CONECTA — geometría del mecanismo + construcción + portero ──
    await ev(() => window.__forgeBrep.applyGearbox());
    await page.waitForTimeout(2000);
    const invGb = await inv();
    const geom = await ev(() => window.__forgeBrep.gearboxGeom);
    const g = await ev(() => window.__forgeBrep.gearbox);
    out.vol_caja = Math.round(invGb.vol_kernel);
    out.geom = geom;
    const ratioTxt = await page.locator('[data-testid="gb-ratio"]').innerText().catch(() => '');

    // SOBREVIVE: Nylon, 50 N·m
    await ev(() => { window.__forgeBrep.setPrintMaterial('Nylon'); window.__forgeBrep.setGbTorque(50); });
    await page.waitForTimeout(500);
    const survNylon = await survText();
    await page.screenshot({ path: SHOT, timeout: 30000 });
    // SE ROMPE: PLA, 150 N·m, 2 discos
    await ev(() => { window.__forgeBrep.setPrintMaterial('PLA'); window.__forgeBrep.setGbTorque(150); window.__forgeBrep.updateGearbox({ discs: 2 }); });
    await page.waitForTimeout(1500);
    const breakPLA = await survText();
    out.survNylon = survNylon.slice(0, 24); out.breakPLA = breakPLA.slice(0, 40);
    out.ratioTxt = ratioTxt.replace(/\s+/g, ' ').trim();

    out.checks = {
      // (A) curva real
      spline_pocas_aristas: invSpline.edges < 60,
      poligono_muchas_aristas: invPoly.edges > 120,
      spline_vs_poligono_4x: invPoly.edges > invSpline.edges * 4,
      mismo_volumen: near(invSpline.vol_kernel, invPoly.vol_kernel, Math.max(50, invPoly.vol_kernel * 0.03)),
      // (B) el eje conecta
      leva_es_excentrica: geom.camOffset === g.E && geom.camOffset > 0,
      disco_cabalga_la_leva: near(geom.discBoreRadius - geom.camRadius, g.gap),
      barreno_salida_holga_orbita: near(geom.outHoleD - geom.outPinD, 2 * g.E + 2 * g.gap),
      eje_balanceado: geom.phases[0] === 0 && near(geom.phases[1], 360 / g.discs, 0.001),
      caja_construye: invGb.vol_kernel > 80000,
      reduccion_ui: /10\s*:\s*1/.test(ratioTxt),
      sobrevive_nylon: /SOBREVIVE/i.test(survNylon),
      se_rompe_pla: /ROMPE/i.test(breakPLA),
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 600); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('GEARBOX_MECH=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
