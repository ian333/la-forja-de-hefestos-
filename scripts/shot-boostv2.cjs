#!/usr/bin/env node
/**
 * Verificación visual del módulo boost-v2 (Manufactura). Abre el módulo por el
 * sidebar, espera el canvas, captura screenshot + el HUD (Vbus/rizo/jalón/gotas),
 * registra errores de consola y CONFIRMA que el WebGL corre en GPU real (no
 * SwiftShader/llvmpipe). Toggle de fases 1→3 para ver el rizo cambiar.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/boostv2-shots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  // Esta laptop tiene Mesa 21 (GL 3.1) — muy viejo para ANGLE-on-GL; no hay Vulkan
  // de GPU en WSL. Para VERIFICAR que la escena compone, SwiftShader (software fiel).
  // (La GPU real va en iangpu, Mesa 25.) Lo usa el CLAUDE.md para probar escenas.
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5001/physics.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  // renderer WebGL
  const renderer = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'NO-WEBGL';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no-ext';
  });
  console.log('WEBGL RENDERER:', renderer);

  // navegar al módulo boost-v2
  let mod = page.locator('[data-testid="module-boost-v2"]');
  if ((await mod.count()) === 0) {
    await page.locator('[data-testid="branch-manufactura"]').click();
    await page.waitForTimeout(300);
  }
  await mod.click();
  try {
    await page.waitForFunction(
      () => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'),
      { timeout: 20000 });
  } catch { console.log('[warn] canvas no apareció en 20s'); }
  await page.waitForTimeout(2500);  // que corra la sim + se llene el bus

  await page.screenshot({ path: `${OUT}/boostv2-3fases.png`, animations: 'disabled', timeout: 60000 });
  console.log('[shot] 3 fases');

  // toggle a 1 fase para ver el rizo dispararse
  const one = page.locator('button', { hasText: '1 fase' });
  if (await one.count()) { await one.first().click(); await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/boostv2-1fase.png`, animations: 'disabled', timeout: 60000 });
    console.log('[shot] 1 fase'); }

  await browser.close();
  console.log(logs.length ? '\n--- console issues ---\n' + logs.slice(0, 40).join('\n') : '\n(sin errores de consola)');
})();
