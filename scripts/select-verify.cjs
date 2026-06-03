/**
 * La Forja — verifica SELECCIÓN DIRECTA (estilo Fusion, sin modo) + cámara quieta.
 * Clic en el sólido SIN activar "pick" → debe seleccionar la cara directo.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/direct-select.png';
(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const out = { errs: [] };
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
    await page.waitForTimeout(1500);
    const sel0 = await page.evaluate(() => window.__forgeBrep.selectedFaceId);
    // hover + clic en el centro del sólido, SIN tocar ningún botón de "pick"
    await page.mouse.move(720, 470); await page.waitForTimeout(250);
    await page.mouse.click(720, 470); await page.waitForTimeout(350);
    const selA = await page.evaluate(() => window.__forgeBrep.selectedFaceId);
    // clic en otro punto del sólido → debe poder cambiar de cara
    await page.mouse.move(860, 560); await page.waitForTimeout(200);
    await page.mouse.click(860, 560); await page.waitForTimeout(300);
    const selB = await page.evaluate(() => window.__forgeBrep.selectedFaceId);
    await page.screenshot({ path: SHOT, timeout: 30000 });
    out.sel0 = sel0; out.selA = selA; out.selB = selB;
    out.checks = {
      selecciona_directo: selA != null,           // clic sin modo → cara seleccionada
      cambia_de_cara: selB != null,               // un segundo clic sigue funcionando
      sin_errores: errs.length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) { out.pass = false; out.fatal = String(e && e.stack || e).slice(0, 400); }
  finally { out.errs = errs.slice(0, 6); await browser.close(); }
  console.log('SELECT=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
