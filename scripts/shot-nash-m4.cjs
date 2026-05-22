#!/usr/bin/env node
/**
 * Captura screenshots de NashMedicinaOstrom en momentos clave.
 *
 * NOTA: NO usamos `animations:'disabled'` aquí — la escena depende de
 * requestAnimationFrame (useFrame de R3F) para aplicar el estado inicial
 * vía timeRef. Sin rAF, los elementos con visible={false} inicial quedan
 * invisibles para siempre.
 */
const { chromium } = require('playwright');

const PORT = 5001;
const TIMESTAMPS = [2.0, 8.0, 14.0, 20.0, 26.0];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'],
  });

  for (const t of TIMESTAMPS) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text().substring(0, 140));
    });
    try {
      const url = `http://localhost:${PORT}/preview-escena.html?scene=nash-m4&aspect=16x9&t=${t}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
      await page.waitForFunction(() => typeof window.__sceneTime === 'number', { timeout: 45000 });
      await page.waitForTimeout(3000); // estabilizar después del primer frame
      const tStr = String(t).padStart(4, '0').replace('.', '_');
      const out = `_shots-phases/nash-m4-t${tStr}.png`;
      await page.screenshot({ path: out, fullPage: false, timeout: 60000, caret: 'hide' });
      const st = await page.evaluate(() => window.__sceneTime);
      console.log(`✓ t=${t}s sceneTime=${st?.toFixed(2)} → ${out}${errors.length ? ` (${errors.filter(e => !e.includes('colormap') && !e.includes('texture-')).length} non-cosmetic err)` : ''}`);
    } catch (e) {
      console.log(`✗ t=${t}: ${e.message.substring(0, 200)}`);
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
})();
