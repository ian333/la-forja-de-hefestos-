/**
 * La Forja — verifica el GENERADOR de la CAJA cicloidal multi-disco en 1 pieza:
 * construye el compound (N discos fasados + eje hueco + base-anillo), escala con
 * los discos, y el análisis de SUPERVIVENCIA (¿resiste el torque?) en la UI.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/caja-cicloidal.png';

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
    const survText = async () => page.locator('[data-testid="gb-survives"]').innerText().catch(() => '');
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ready(); await page.waitForTimeout(700);

    // generar la caja (5 discos por defecto)
    await ev(() => window.__forgeBrep.applyGearbox());
    await page.waitForTimeout(1500);
    const vol5 = await vol();
    const ratioTxt = await page.locator('[data-testid="gb-ratio"]').innerText().catch(() => '');

    // SOBREVIVE: Nylon, 50 N·m, 5 discos
    await ev(() => { window.__forgeBrep.setPrintMaterial('Nylon'); window.__forgeBrep.setGbTorque(50); });
    await page.waitForTimeout(400);
    const survNylon = await survText();
    await page.screenshot({ path: SHOT, timeout: 30000 });

    // SE ROMPE: PLA, 150 N·m, 2 discos (eje en flexión/torsión sobre el límite)
    await ev(() => { window.__forgeBrep.setPrintMaterial('PLA'); window.__forgeBrep.setGbTorque(150); window.__forgeBrep.updateGearbox({ discs: 2 }); });
    await page.waitForTimeout(1200);
    const breakPLA = await survText();

    // escala con discos: 8 > 5
    await ev(() => window.__forgeBrep.updateGearbox({ discs: 8 }));
    await page.waitForTimeout(1500);
    const vol8 = await vol();

    out.vol5 = Math.round(vol5); out.vol8 = Math.round(vol8); out.ratioTxt = ratioTxt.replace(/\s+/g, ' ').trim();
    out.survNylon = survNylon.slice(0, 30); out.breakPLA = breakPLA.slice(0, 40);
    out.checks = {
      caja_construye: vol5 > 50000,
      escala_con_discos: vol8 > vol5,
      reduccion_ui: /10\s*:\s*1/.test(ratioTxt),
      sobrevive_nylon: /SOBREVIVE/i.test(survNylon),
      se_rompe_pla_carga_alta: /ROMPE/i.test(breakPLA),
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 500); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('GEARBOX_BUILD=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
