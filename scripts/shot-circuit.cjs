#!/usr/bin/env node
// Verifica el modulo circuit-field: campo B (flechas) + latigazo i(t).
// Muestrea el HUD DOS veces para probar que la corriente PULSA (sale de la sim),
// y captura la escena. GPU real (receta iangpu) para no caer en swiftshader.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/circuit-shot'; fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || 4173;
const BASE = process.env.BASE || `http://localhost:${PORT}`;

async function readHUD(page) {
  const t = await page.evaluate(() => document.body.innerText);
  const g = (re) => { const m = t.match(re); return m ? m[1] : '?'; };
  return {
    i: g(/i\s*=\s*([\d.]+)\s*A/),
    fase: g(/fase\s*=\s*(corto|cuello|arco)/),
    B: g(/B_sup\s*=\s*([\d.]+)\s*mT/),
    E: g(/E_campo\s*=\s*([\d.]+)\s*mJ/),
    gotas: g(/gotas\s*=\s*(\d+)/),
  };
}

(async () => {
  const browser = await chromium.launch({ headless: false,
    args: ['--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
           '--disable-software-rasterizer', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('PAGEERR ' + e.message));
  await page.goto(`${BASE}/physics.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  let m = page.locator('[data-testid="module-circuit-field"]');
  if ((await m.count()) === 0) {
    await page.locator('[data-testid="branch-manufactura"]').click(); await page.waitForTimeout(400);
    m = page.locator('[data-testid="module-circuit-field"]');
  }
  await m.click();
  await page.waitForFunction(() => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'), { timeout: 15000 });

  // GPU real?
  const renderer = await page.evaluate(() => {
    const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  console.log('RENDERER:', renderer);

  // muestrea i(t) varias veces => debe CAMBIAR (latigazo)
  const samples = [];
  for (let k = 0; k < 6; k++) { await page.waitForTimeout(700); samples.push(await readHUD(page)); }
  await page.screenshot({ path: `${OUT}/circuit.png`, timeout: 30000 });

  console.log('--- muestras HUD (i debe variar, gotas debe subir) ---');
  samples.forEach((s, k) => console.log(`  [${k}] i=${s.i}A fase=${s.fase} B=${s.B}mT E=${s.E}mJ gotas=${s.gotas}`));
  const is = samples.map(s => +s.i).filter(x => !isNaN(x));
  const varia = new Set(is).size > 1;
  const fases = new Set(samples.map(s => s.fase));
  console.log(`\nVEREDICTO: i varia=${varia} (${Math.min(...is)}..${Math.max(...is)}A) · fases=${[...fases].join(',')} · gotas final=${samples.at(-1).gotas}`);
  if (logs.length) { console.log('--- console errors ---'); console.log(logs.slice(0, 12).join('\n')); }
  await ctx.close(); await browser.close();
})();
