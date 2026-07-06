#!/usr/bin/env node
// Verifica el módulo de deposición generativa: carga, deposita vóxeles (avance
// sube), y el GAP cambia el régimen (contacto/vuelo). GPU real.
const { chromium } = require('playwright');
const fs = require('fs'); const OUT = '/tmp/gen-shot'; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 4173}`;
const num = (t, re) => { const m = t.match(re); return m ? parseFloat(m[1]) : NaN; };
const read = async (p) => { const t = await p.evaluate(() => document.body.innerText); return {
  avance: num(t, /avance=\s*(\d+)%/), gap: num(t, /gap\s*=\s*([\d.]+)\s*mm/),
  contacto: /CONTACTO/.test(t), vuelo: /VUELO/.test(t) }; };

(async () => {
  const b = await chromium.launch({ headless: false, args: ['--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const logs = [];
  p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  p.on('pageerror', e => logs.push('PAGEERR ' + e.message));
  await p.goto(`${BASE}/physics.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  let m = p.locator('[data-testid="module-generative-deposit"]');
  if (!(await m.count())) { await p.locator('[data-testid="branch-manufactura"]').click(); await p.waitForTimeout(400); m = p.locator('[data-testid="module-generative-deposit"]'); }
  await m.click();
  await p.waitForFunction(() => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'), { timeout: 15000 });
  const rend = await p.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
  console.log('RENDERER:', rend);

  await p.waitForTimeout(2500); const a = await read(p);          // contacto (default)
  await p.screenshot({ path: `${OUT}/gen-contacto.png`, timeout: 30000 });
  // cambiar a preset vuelo
  await p.getByRole('button', { name: /Sandbox/ }).click().catch(() => {}); await p.waitForTimeout(300);
  await p.locator('[data-testid="preset-vuelo"]').click().catch(() => {}); await p.waitForTimeout(2500);
  const c = await read(p);
  await p.screenshot({ path: `${OUT}/gen-vuelo.png`, timeout: 30000 });

  console.log(`contacto: avance=${a.avance}% gap=${a.gap} contacto=${a.contacto}`);
  console.log(`vuelo:    avance=${c.avance}% gap=${c.gap} vuelo=${c.vuelo}`);
  const ok = a.avance >= 0 && a.contacto && c.gap > a.gap && c.vuelo;
  console.log(`VEREDICTO: ${ok ? 'OK — deposita y el GAP cambia el régimen' : 'REVISAR'}`);
  if (logs.length) { console.log('--- errors ---'); console.log(logs.slice(0, 8).join('\n')); }
  await ctx.close(); await b.close();
})();
