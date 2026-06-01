#!/usr/bin/env node
/**
 * forja-cad-clean-shot.cjs — Verifica el VIEWPORT LIMPIO de CAD del Part Studio.
 * Corre EN iangpu (GPU real, ANGLE headless). Maneja la UI con clics (igual que
 * un diseñador) — NUNCA llama occt.ts directo.
 *
 *   A) CAJA por defecto (extrude rect)  → aristas crujientes legibles.
 *   B) FLECHA escalonada por revolución → escalones de distinto diámetro nítidos.
 *
 * Screenshots:
 *   /tmp/forja-gear/caja-aristas.png
 *   /tmp/forja-gear/flecha-nitida.png
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/forja-gear';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const errs = [];

const get = (page) => page.evaluate(() => {
  const a = window.__forgeBrep;
  if (!a) return null;
  return { ready: a.ready, error: a.error, steps: a.steps, inv: a.invariants };
});
const readVolDom = async (page) => {
  const t = await page.textContent('[data-testid="an-volumen"]').catch(() => null);
  if (!t) return null;
  const m = t.replace(/,/g, '').match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1680, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message.slice(0, 220)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 220)); });

  const report = { url: URL, errs, shots: [], steps: [] };
  const note = (k, v) => { report.steps.push({ [k]: v }); console.log(k + ' = ' + JSON.stringify(v)); };

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__forgeBrep && window.__forgeBrep.ready, { timeout: 60000 });
  await page.waitForTimeout(2000);

  // ── A) CAJA por defecto (rect → extrude) — para ver ARISTAS CRUJIENTES ──
  const a0 = await get(page);
  note('caja_inv', a0.inv && { euler: a0.inv.euler, vol: a0.inv.vol_kernel, faces: a0.inv.faces, edges: a0.inv.edges });
  // Oculta el boceto para que las aristas del sólido se lean limpias.
  await page.click('[data-testid="btn-toggle-sketch"]').catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'caja-aristas.png') });
  report.shots.push(path.join(OUT, 'caja-aristas.png'));
  note('shot_caja', path.join(OUT, 'caja-aristas.png'));

  // ── B) FLECHA por revolución (3 escalones) — escalones de distinto diámetro ──
  await page.click('[data-testid="feat-sketch"]'); await page.waitForTimeout(400);
  await page.click('[data-testid="seg-revprofile"]'); await page.waitForTimeout(400);
  await page.click('[data-testid="preset-flecha"]'); await page.waitForTimeout(700);
  const stB = await get(page);
  note('steps_flecha', stB.steps);
  await page.click('[data-testid="btn-revolve"]'); await page.waitForTimeout(800);
  await page.click('[data-testid="axis-y"]'); await page.waitForTimeout(1800);

  const volDom = await readVolDom(page);
  const steps = stB.steps || [];
  const volEsp = steps.reduce((a, s) => a + Math.PI * s.r * s.r * s.L, 0);
  const ok = volDom != null && volEsp > 0 && Math.abs(volDom - volEsp) / volEsp < 0.01;
  note('flecha', { vol_dom: volDom, vol_esperado: +volEsp.toFixed(2), ok });

  // Asegura el boceto OCULTO (toggle ya lo apagó arriba; si reapareció, no pasa
  // nada — las aristas del sólido mandan). Screenshot de la flecha nítida.
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, 'flecha-nitida.png') });
  report.shots.push(path.join(OUT, 'flecha-nitida.png'));
  note('shot_flecha', path.join(OUT, 'flecha-nitida.png'));

  const aF = await get(page);
  note('flecha_inv', aF.inv && { euler: aF.inv.euler, vol: aF.inv.vol_kernel, faces: aF.inv.faces, edges: aF.inv.edges });

  await browser.close();
  console.log('\n=== REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, 'cad-clean-report.json'), JSON.stringify(report, null, 2));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
