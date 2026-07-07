#!/usr/bin/env node
/**
 * Captura GPU del CORTE DEL MOLDE (MoldSectionReveal) — abre el Studio, entra a
 * SIMULACIÓN, lanza el corte y saca stills a lo largo del barrido para VER que se
 * ve rudo (acero real seccionándose), no una figura hueca. Corre en iangpu con el
 * vite DEV vivo en :5001.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || '/tmp/forja-section-shots';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
           '--disable-software-rasterizer', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`[err] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  // el Studio CAD bootea el wasm OCCT: espera a que aparezca la barra de workspaces
  await page.waitForSelector('[data-testid="tab-simulacion"]', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const renderer = await page.evaluate(() => {
    try { const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); } catch (e) { return 'n/a'; }
  });
  console.log('RENDERER:', renderer);

  // → workspace SIMULACIÓN (tab o API expuesta) → lanzar EL CORTE
  const tab = page.locator('[data-testid="tab-simulacion"]');
  if (await tab.count()) await tab.click();
  else await page.evaluate(() => window.__forja?.setWorkspace?.('simulacion'));
  await page.waitForTimeout(800);
  const btns = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid^="btn-"]')).map((b) => b.getAttribute('data-testid')));
  console.log('BOTONES:', btns.join(', '));
  // click por JS directo (evita intercepción por paneles superpuestos)
  await page.evaluate(() => document.querySelector('[data-testid="btn-section-reveal"]').click());
  const mounted = await page.waitForFunction(() => !!window.__cutRenderAt && !!document.querySelector('canvas'), { timeout: 20000 }).then(() => true).catch(() => false);
  console.log('MONTÓ:', mounted, '· canvases:', await page.evaluate(() => document.querySelectorAll('canvas').length));
  await page.screenshot({ path: `${OUT}/cut-estado.png`, timeout: 30000 }).catch(() => {});
  if (mounted) {
    await page.waitForTimeout(1800);
    for (const t of [0.2, 1.0, 1.8, 2.6, 3.2, 4.5]) {
      await page.evaluate((tt) => window.__cutRenderAt(tt), t);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/cut-t${String(t).replace('.', '_')}.png`, timeout: 30000 });
      console.log('OK  t=', t);
    }
  }
  if (logs.length) { console.log('--- console errors ---'); console.log(logs.slice(0, 14).join('\n')); }
  await ctx.close();
  await browser.close();
})().catch((e) => { console.log('FATAL', String(e).slice(0, 300)); process.exit(1); });
