#!/usr/bin/env node
// Verifica la MODULACIÓN del tamaño de gota en el módulo "Gota resonante".
// Activa el ordeñado, barre f_disparo y comprueba que d_gota (objetivo Y medida)
// siguen la ley V=A_w·v_f/f → más f_disparo = gota más chica. GPU real.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/milk-shot'; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 4173}`;

const num = (t, re) => { const m = t.match(re); return m ? parseFloat(m[1]) : NaN; };
async function read(page) {
  const t = await page.evaluate(() => document.body.innerText);
  return {
    obj: num(t, /d_obj\s*=\s*([\d.]+)\s*mm/),
    med: num(t, /d_gota\s*=\s*([\d.]+)\s*mm/),
    gotas: num(t, /gotas\s*=\s*(\d+)/),
  };
}
async function setFfire(page, v) {
  const sld = page.locator('div.mb-2', { has: page.locator('span', { hasText: 'f_disparo' }) }).locator('input[type="range"]');
  await sld.evaluate((el, val) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
}
async function waitDrops(page, min, ms = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if ((await read(page)).gotas >= min) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: false,
    args: ['--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('PAGEERR ' + e.message));
  await page.goto(`${BASE}/physics.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  let m = page.locator('[data-testid="module-metal-droplet"]');
  if ((await m.count()) === 0) { await page.locator('[data-testid="branch-manufactura"]').click(); await page.waitForTimeout(400); m = page.locator('[data-testid="module-metal-droplet"]'); }
  await m.click();
  await page.waitForFunction(() => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'), { timeout: 15000 });
  await page.getByRole('button', { name: /Sandbox/ }).click();   // el sandbox está detrás de su tab
  await page.waitForTimeout(400);

  const renderer = await page.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
  console.log('RENDERER:', renderer);

  await page.locator('[data-testid="preset-ordeño"]').click();
  await page.waitForTimeout(500);

  const rows = [];
  for (const f of [200, 600, 1500]) {
    await setFfire(page, f);
    const g0 = (await read(page)).gotas;
    await waitDrops(page, g0 + 3);              // deja que dispare varias a esta f
    await page.waitForTimeout(600);
    const r = await read(page);
    rows.push({ f, ...r });
    await page.screenshot({ path: `${OUT}/milk-${f}.png`, timeout: 30000 });
  }

  console.log('\n  f_disparo | d_obj[mm] | d_medida[mm] | gotas');
  rows.forEach(r => console.log(`    ${String(r.f).padStart(5)}   |   ${r.obj.toFixed(3)}   |    ${r.med.toFixed(3)}    | ${r.gotas}`));
  const mono = rows[0].obj > rows[1].obj && rows[1].obj > rows[2].obj;
  const tracks = rows.every(r => Math.abs(r.med - r.obj) / r.obj < 0.35);
  console.log(`\n  VEREDICTO: d_obj baja con f_disparo=${mono} · medida sigue al objetivo=${tracks}`);
  console.log(`  ${mono && tracks ? 'OK — el tamaño de la gota SE MODULA y sale de los números' : 'REVISAR'}`);
  if (logs.length) { console.log('--- console errors ---'); console.log(logs.slice(0, 8).join('\n')); }
  await ctx.close(); await browser.close();
})();
