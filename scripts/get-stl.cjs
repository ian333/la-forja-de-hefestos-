/**
 * Verifica el build VIVO + genera el STL de la caja para imprimir. Corre contra
 * university (producción). Confirma que el código nuevo está arriba (cuerpos 'soportes').
 */
const { chromium } = require('playwright');
const URL = 'https://university.gaiaprime.com.mx/forja-brep.html';
const OUT = '/home/ian/Orkesta/la-forja/forja-shots/caja-cicloidal.stl';
(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'] });
  const ctx = await b.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const out = {};
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
    await page.waitForTimeout(700);
    await page.evaluate(() => window.__forgeBrep.applyGearbox());
    await page.waitForFunction('window.__forgeBrep.gbBodies && window.__forgeBrep.gbBodies.length>0', { timeout: 40000 });
    await page.waitForTimeout(1500);
    const bodies = await page.evaluate(() => window.__forgeBrep.gbBodies.map(x => x.key));
    out.bodies = bodies;
    out.codigoNuevoVivo = bodies.includes('soportes');
    const inv = await page.evaluate(() => window.__forgeBrep.invariants);
    out.vol_mm3 = Math.round(inv.vol_kernel); out.masa_g = +inv.mass_g.toFixed(1); out.euler = inv.euler;
    // exportar STL (descarga del blob)
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.evaluate(() => window.__forgeBrep.exportSTL()),
    ]);
    await dl.saveAs(OUT);
    out.stl = OUT;
  } catch (e) { out.fatal = String(e && e.stack || e).slice(0, 400); }
  finally { await b.close().catch(() => {}); }
  console.log('STL=' + JSON.stringify(out, null, 2));
  process.exit(out.stl ? 0 : 2);
})();
