#!/usr/bin/env node
/**
 * forja-system-shots.cjs — Captura el SISTEMA La Forja para crítica de diseño.
 * Corre EN iangpu (GPU real, ANGLE headless). Maneja la UI con clics.
 *
 * Sale:
 *   /tmp/forja-system/sistema-cad-gearbox.png   (Part Studio: caja de velocidades embonada)
 *   /tmp/forja-system/sistema-cad-engrane.png   (Part Studio: un engrane de involuta)
 *   /tmp/forja-system/sistema-escuela.png
 *   /tmp/forja-system/sistema-solver.png
 *   /tmp/forja-system/sistema-reporte.png
 *   /tmp/forja-system/sistema-lab.png           (physics lab)
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/forja-system';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:5002';
const VIEW = { width: 1680, height: 1000 };

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });
  page._errs = errs;
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist',
           '--enable-gpu', '--disable-software-rasterizer'],
  });
  const report = { base: BASE, shots: [] };
  const shot = (page, name) => page.screenshot({ path: path.join(OUT, name), timeout: 30000 })
    .then(() => { report.shots.push(name); console.log('  shot', name); });

  // ───────────────────────── CAD Part Studio ─────────────────────────
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + '/forja-brep.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => window.__forgeBrep && window.__forgeBrep.ready, { timeout: 60000 });
    await page.waitForTimeout(2500);

    // (A) CAJA DE VELOCIDADES: sketch=gear → gear → add gear2 → mate.
    await page.click('[data-testid="feat-sketch"]').catch(()=>{}); await page.waitForTimeout(400);
    await page.click('[data-testid="seg-gear"]').catch(()=>{}); await page.waitForTimeout(500);
    await page.click('[data-testid="btn-gear"]').catch(()=>{}); await page.waitForTimeout(1800);
    // un solo engrane primero → screenshot del engrane
    await page.click('[data-testid="btn-toggle-sketch"]').catch(()=>{}); await page.waitForTimeout(1200);
    await shot(page, 'sistema-cad-engrane.png');

    // segundo engrane + mate → caja de velocidades embonada
    await page.click('[data-testid="btn-add-gear2"]').catch(()=>{}); await page.waitForTimeout(1500);
    await page.click('[data-testid="btn-gear-mate"]').catch(()=>{}); await page.waitForTimeout(1800);
    // activa flechas/carcasa si existen para la 'caja' completa
    await page.click('[data-testid="chk-shafts"]').catch(()=>{}); await page.waitForTimeout(800);
    await page.click('[data-testid="chk-housing"]').catch(()=>{}); await page.waitForTimeout(1500);
    await shot(page, 'sistema-cad-gearbox.png');

    const asm = await page.textContent('[data-testid="disp-embonan"]').catch(()=>null);
    report.cad = { errs: page._errs.slice(0,5), embonan: asm };
    await ctx.close();
  }

  // ───────────────────────── Escuela ─────────────────────────
  for (const [route, name, key] of [
    ['/escuela.html', 'sistema-escuela.png', 'escuela'],
    ['/solver.html',  'sistema-solver.png',  'solver'],
    ['/reporte.html', 'sistema-reporte.png', 'reporte'],
  ]) {
    const { ctx, page } = await newPage(browser);
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    } catch { await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{}); }
    await page.waitForTimeout(3500);
    await shot(page, name);
    report[key] = { errs: page._errs.slice(0,5) };
    await ctx.close();
  }

  // ───────────────────────── Physics Lab ─────────────────────────
  {
    const { ctx, page } = await newPage(browser);
    // un modulo concreto vía hash para que renderice un lab 3D
    await page.goto(BASE + '/physics.html#/mech/double-pendulum', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{});
    await page.waitForTimeout(5000);
    await shot(page, 'sistema-lab.png');
    report.lab = { errs: page._errs.slice(0,5) };
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== REPORT ===\n' + JSON.stringify(report, null, 2));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
