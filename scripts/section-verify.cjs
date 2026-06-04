/**
 * La Forja — verifica la SECCIÓN estilo Fusion: accesible desde la barra (✂ Sección),
 * plano de corte EN MUNDO correcto (el grupo está rotado −90°), y que mover el corte
 * cambia el plano (la flecha lo arrastra; aquí lo movemos por hook). + screenshot GPU.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/seccion.png';

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
  const near = (a, b, t = 0.05) => Math.abs(a - b) < t;
  try {
    const ready = async () => page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 50000 });
    const ev = async (fn, arg) => { await ready(); return page.evaluate(fn, arg); };
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(); await page.waitForTimeout(700);

    // 1) ACCESIBLE: botón en la barra
    const hasBtn = await page.locator('[data-testid="btn-section-tool"]').count();
    await page.locator('[data-testid="btn-section-tool"]').click();
    await page.waitForTimeout(400);
    const onAfterClick = await ev(() => window.__forgeBrep.sectionOn);
    const hudVisible = await page.locator('[data-testid="section-hud"]').isVisible().catch(() => false);

    // 2) plano EN MUNDO correcto por eje (grupo rotado −90°X: modelo z→mundo y, y→−z)
    await ev(() => window.__forgeBrep.setSection(true, 'z', 0));
    await page.waitForTimeout(400);
    const planeZ = await ev(() => window.__forgeBrep.sectionPlane);   // eje z modelo → normal mundo ±Y
    await ev(() => window.__forgeBrep.setSection(true, 'x', 0));
    await page.waitForTimeout(400);
    const planeX = await ev(() => window.__forgeBrep.sectionPlane);   // eje x → normal mundo ±X

    // 3) MOVER el corte cambia la constante del plano (lo que hace la flecha)
    await ev(() => window.__forgeBrep.setSectionOffset(-0.6));
    await page.waitForTimeout(350);
    const c1 = (await ev(() => window.__forgeBrep.sectionPlane)).constant;
    await ev(() => window.__forgeBrep.setSectionOffset(0.6));
    await page.waitForTimeout(350);
    const c2 = (await ev(() => window.__forgeBrep.sectionPlane)).constant;

    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT, timeout: 30000 });

    out.planeZ = planeZ; out.planeX = planeX; out.c1 = c1; out.c2 = c2;
    out.checks = {
      boton_en_barra: hasBtn === 1,
      enciende_con_boton: onAfterClick === true,
      hud_visible: hudVisible === true,
      // eje z modelo → normal mundo en Y (|y|≈1); eje x → normal en X
      eje_z_normal_mundo_Y: Math.abs(planeZ.normal[1]) > 0.9,
      eje_x_normal_mundo_X: Math.abs(planeX.normal[0]) > 0.9,
      mover_corte_cambia_plano: Math.abs(c2 - c1) > 1,   // la flecha SÍ mueve el corte
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 600); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('SECTION=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
