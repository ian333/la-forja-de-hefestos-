#!/usr/bin/env node
/**
 * cad-qa-driver.cjs — QA automático del CAD F-Rep, click por click.
 * Corre EN iangpu (GPU real, ANGLE). Abre /cad.html, clickea cada control,
 * dibuja en el viewport, y captura screenshot + errores de consola por paso.
 *
 *   cd ~/Orkesta/la-forja && CAD_URL=http://localhost:5001/cad.html node scripts/cad-qa-driver.cjs
 *
 * Salida en /tmp/cad-qa/ : shots/*.png + log.json
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/cad-qa';
const SHOTS = path.join(OUT, 'shots');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.CAD_URL || 'http://localhost:5001/cad.html';
const MAX_BUTTONS = parseInt(process.env.MAX_BUTTONS || '34');

const steps = [];
const allErrors = [];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 } });
  const page = await ctx.newPage();

  const buf = [];
  page.on('pageerror', e => buf.push('[pageerror] ' + e.message.slice(0, 300)));
  page.on('console', m => {
    if (m.type() === 'error') { const t = m.text(); if (t.length < 400) buf.push('[console.error] ' + t); }
  });
  const drain = () => { const e = buf.slice(); buf.length = 0; allErrors.push(...e); return e; };

  const shot = async (name) => {
    const safe = name.replace(/[^a-z0-9]+/gi, '_').slice(0, 44);
    const f = `shots/${safe}.png`;
    try { await page.screenshot({ path: path.join(OUT, f) }); } catch (e) { return null; }
    return f;
  };
  const step = async (label, action) => {
    let actionError = null;
    try { if (action) await action(); } catch (e) { actionError = String(e.message || e).slice(0, 200); }
    await page.waitForTimeout(1700);
    const f = await shot(label);
    const consoleErrors = drain();
    steps.push({ label, shot: f, actionError, consoleErrors });
    console.log(`  · ${label}${actionError ? ' [ACTION-ERR]' : ''}${consoleErrors.length ? ' [' + consoleErrors.length + ' err]' : ''}`);
  };

  // ── 0) Carga inicial ──
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  await step('00-initial-load', null);

  // ── Sanidad del viewport ──
  const vp = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    let blackish = null;
    try {
      const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
      blackish = !!gl; // si hay contexto WebGL
    } catch (e) {}
    return {
      hasCanvas: !!c, canvasW: c ? c.width : 0, canvasH: c ? c.height : 0,
      webgl: blackish, lastRun: window.__forjaLastRun || null,
      bodyText: (document.body.innerText || '').slice(0, 400),
    };
  });
  steps.push({ label: 'viewport-info', info: vp });
  console.log('  viewport:', JSON.stringify(vp).slice(0, 200));

  // ── Enumerar botones visibles ──
  const buttons = await page.$$eval('button', bs => bs.map((b, i) => ({
    i,
    label: (b.getAttribute('title') || b.getAttribute('aria-label') || b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 38),
    visible: !!(b.offsetParent),
  })).filter(b => b.visible && b.label));
  steps.push({ label: 'buttons-found', count: buttons.length, buttons: buttons.map(b => b.label) });
  console.log(`  ${buttons.length} botones visibles`);

  // ── Clic en cada botón (tope MAX_BUTTONS), screenshot + errores por paso ──
  for (let k = 0; k < Math.min(buttons.length, MAX_BUTTONS); k++) {
    const b = buttons[k];
    await step(`btn-${String(k).padStart(2, '0')}-${b.label}`, async () => {
      const els = await page.$$('button');
      if (els[b.i]) await els[b.i].click({ timeout: 3000 });
    });
  }

  // ── Intentar dibujar en el viewport (sketch): clics en el canvas ──
  await step('draw-canvas-square', async () => {
    const c = await page.$('canvas');
    if (!c) throw new Error('sin canvas');
    const box = await c.boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    for (const [dx, dy] of [[-120, -90], [120, -90], [120, 90], [-120, 90], [-120, -90]]) {
      await page.mouse.click(cx + dx, cy + dy); await page.waitForTimeout(350);
    }
  });
  // arrastrar en el viewport (orbitar la cámara) para ver el modelo en 3D
  await step('orbit-drag', async () => {
    const c = await page.$('canvas'); if (!c) throw new Error('sin canvas');
    const box = await c.boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.mouse.move(cx + 200, cy + 60, { steps: 12 }); await page.mouse.up();
  });

  fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify({
    base: BASE, when: new Date().toISOString(), totalConsoleErrors: allErrors.length,
    allErrors, steps,
  }, null, 2));
  console.log(`\nDONE · ${steps.length} pasos · ${allErrors.length} errores de consola · salida en ${OUT}`);
  await browser.close();
})().catch(e => { console.error('DRIVER FATAL:', e.message || e); process.exit(1); });
