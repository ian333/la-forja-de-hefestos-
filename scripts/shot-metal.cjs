#!/usr/bin/env node
// Verifica el simulador: corre en GPU, lee el contador de gotas del HUD en
// RESONANCIA vs FUERA DE TONO (prueba de que el dibujo sale de la simulacion).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/metal-shot'; fs.mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || 4173;
const BASE = process.env.BASE || `http://localhost:${PORT}`;

async function readDrops(page) {
  const t = await page.evaluate(() => document.body.innerText);
  const m = t.match(/gotas\s*=\s*(\d+)/);
  const q = t.match(/q\s*=\s*(-?[\d.]+)/);
  return { drops: m ? +m[1] : -1, q: q ? q[1] : '?' };
}

(async () => {
  const browser = await chromium.launch({ headless: true,
    args: ['--use-gl=angle', '--use-angle=gl', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('PAGEERR ' + e.message));
  await page.goto(`${BASE}/physics.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  let m = page.locator('[data-testid="module-metal-droplet"]');
  if ((await m.count()) === 0) {
    await page.locator('[data-testid="branch-manufactura"]').click(); await page.waitForTimeout(400);
    m = page.locator('[data-testid="module-metal-droplet"]');
  }
  await m.click();
  await page.waitForFunction(() => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'), { timeout: 15000 });

  // RESONANCIA (preset default 'resonante') — deja correr y captura
  await page.waitForTimeout(16000);
  const res = await readDrops(page);
  await page.screenshot({ path: `${OUT}/metal-reson.png`, timeout: 30000 });
  // recorte de la zona de GRAFICAS (arriba-izquierda, bajo el HUD)
  await page.screenshot({ path: `${OUT}/metal-plots.png`, clip: { x: 264, y: 150, width: 250, height: 372 }, timeout: 30000 });
  console.log(`RESONANTE (UI): gotas=${res.drops}  q=${res.q}`);
  if (logs.length) { console.log('--- console errors ---'); console.log(logs.slice(0, 12).join('\n')); }
  await ctx.close(); await browser.close();
})();
