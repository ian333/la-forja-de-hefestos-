#!/usr/bin/env node
/**
 * Tour visual del Physics Lab — captura un set representativo de modulos LIVE
 * desde el preview ya servido (puerto 4173) para ver donde encaja el simulador
 * de deposicion metalica. Basado en scripts/physics-screenshots.cjs.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/forja-sim-shots';
fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || 4173;

const MODULES = [
  { name: '1-pendulo',     branchId: 'mech',  moduleId: 'double-pendulum' },
  { name: '2-solar',       branchId: 'astro', moduleId: 'solar-system' },
  { name: '3-blackhole',   branchId: 'astro', moduleId: 'blackhole' },
  { name: '4-em-fields',   branchId: 'em',    moduleId: 'fields' },
  { name: '5-gas-ideal',   branchId: 'thermo',moduleId: 'ideal-gas' },
  { name: '6-molecula',    branchId: 'matter',moduleId: 'molecule-gpu' },
  { name: '7-proteina',    branchId: 'bio',   moduleId: 'protein-viewer' },
  { name: '8-adn',         branchId: 'bio',   moduleId: 'double-helix' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist',
           '--no-sandbox', '--use-angle=gl'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(`[err] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto(`http://localhost:${PORT}/physics.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // renderer real?
  const renderer = await page.evaluate(() => {
    try { const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); } catch(e){ return 'n/a'; }
  });
  console.log('RENDERER:', renderer);

  for (const t of MODULES) {
    try {
      let moduleSel = page.locator(`[data-testid="module-${t.moduleId}"]`);
      if ((await moduleSel.count()) === 0) {
        await page.locator(`[data-testid="branch-${t.branchId}"]`).click();
        await page.waitForTimeout(300);
        moduleSel = page.locator(`[data-testid="module-${t.moduleId}"]`);
      }
      await moduleSel.click();
      await page.waitForFunction(
        () => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'),
        { timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT}/${t.name}.png`, timeout: 30000 });
      console.log(`OK  ${t.name}`);
    } catch (e) {
      console.log(`WARN ${t.name}: ${String(e).slice(0,80)}`);
    }
  }
  if (logs.length) { console.log('--- console errors ---'); console.log(logs.slice(0,10).join('\n')); }
  await ctx.close();
  await browser.close();
})();
