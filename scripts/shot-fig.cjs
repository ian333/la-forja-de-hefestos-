#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs'); const OUT = '/tmp/fig-shot'; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 4173}`;
const num = (t, re) => { const m = t.match(re); return m ? parseFloat(m[1]) : NaN; };
(async () => {
  const b = await chromium.launch({ headless: false, args: ['--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const logs = [];
  p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); }); p.on('pageerror', e => logs.push('PAGEERR ' + e.message));
  await p.goto(`${BASE}/physics.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  let m = p.locator('[data-testid="module-generative-deposit"]');
  if (!(await m.count())) { await p.locator('[data-testid="branch-manufactura"]').click(); await p.waitForTimeout(400); m = p.locator('[data-testid="module-generative-deposit"]'); }
  await m.click();
  await p.waitForFunction(() => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'), { timeout: 15000 });
  console.log('RENDERER:', await p.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; }));
  await p.getByRole('button', { name: /Sandbox/ }).click().catch(() => {}); await p.waitForTimeout(300);
  for (const fig of ['giroide', 'diamante', 'lattice']) {
    await p.locator(`[data-testid="fig-${fig}"]`).click().catch(() => {});
    await p.waitForTimeout(6000);   // deja depositar
    const t = await p.evaluate(() => document.body.innerText);
    console.log(`${fig}: avance=${num(t, /avance=\s*(\d+)%/)}% voxeles_total=${(t.match(/\((\d+)\/(\d+)\)/) || [])[2]}`);
    await p.screenshot({ path: `${OUT}/${fig}.png`, timeout: 30000 });
  }
  if (logs.length) { console.log('--- errors ---'); console.log(logs.slice(0, 8).join('\n')); }
  await ctx.close(); await b.close();
})();
