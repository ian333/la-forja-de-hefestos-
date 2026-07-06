/**
 * Stills de verificación VISUAL de Loft y Sweep en el navegador (GPU real).
 * Carga el Part Studio, aplica la feature por clic y captura el viewport.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';
const OUT = process.env.OUT || '/tmp';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
           '--use-gl=angle', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const ready = async () => {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
  };
  const shot = async (name) => { await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', `${OUT}/${name}.png`); };

  await ready();
  await page.click('[data-testid="btn-loft"]');
  await page.waitForFunction(`window.__forgeBrep.invariants.ops.includes('loft')`, { timeout: 20000 });
  await shot('forja-loft');

  await ready();
  await page.click('[data-testid="btn-sweep"]'); // default = codo (arc)
  await page.waitForFunction(`window.__forgeBrep.invariants.ops.includes('sweep')`, { timeout: 20000 });
  await shot('forja-sweep-codo');

  await page.click('[data-testid="sweep-helix"]');
  await page.waitForTimeout(1600);
  await shot('forja-sweep-helix');

  await browser.close();
})();
