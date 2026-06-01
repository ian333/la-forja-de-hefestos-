#!/usr/bin/env node
/**
 * cad-exercise-driver.cjs — Pone el CAD F-Rep a CHAMBEAR de verdad.
 * Corre EN iangpu. Hace operaciones reales (primitivas, orbitar, menús,
 * command palette, STL, undo/redo) y LEE el status bar (nodos/cm³) para
 * detectar si cada operación produjo geometría. Screenshot + errores por paso.
 *
 *   CAD_URL=http://localhost:5001/cad.html node /abs/.../cad-exercise-driver.cjs
 * Salida: /tmp/cad-exercise/ (shots/*.png + log.json)
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/cad-exercise';
const SHOTS = path.join(OUT, 'shots');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const URL = process.env.CAD_URL || 'http://localhost:5001/cad.html';

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
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (t.length < 400) buf.push('[err] ' + t); } });
  const drain = () => { const e = buf.slice(); buf.length = 0; allErrors.push(...e); return e; };

  const status = () => page.evaluate(() => {
    const t = document.body.innerText || '';
    const m = (re) => { const x = t.match(re); return x ? x[1] : null; };
    return { nodos: m(/(\d+)\s*nodos/), vars: m(/(\d+)\s*vars/), cm3: m(/([\d.]+)\s*cm³/), fps: m(/(\d+)\s*FPS/) };
  });
  const shot = async (n) => {
    const f = `shots/${n.replace(/[^a-z0-9]+/gi, '_').slice(0, 46)}.png`;
    try { await page.screenshot({ path: path.join(OUT, f) }); } catch (e) { return null; }
    return f;
  };
  const step = async (label, action) => {
    const before = await status();
    let actionError = null;
    try { if (action) await action(); } catch (e) { actionError = String(e.message || e).slice(0, 200); }
    await page.waitForTimeout(1500);
    const after = await status();
    const f = await shot(label);
    const consoleErrors = drain();
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    steps.push({ label, before, after, changed, actionError, consoleErrors, shot: f });
    console.log(`  · ${label}  nodos:${before.nodos}->${after.nodos} cm³:${before.cm3}->${after.cm3}${actionError ? ' [ACT-ERR]' : ''}${consoleErrors.length ? ' [' + consoleErrors.length + 'err]' : ''}`);
  };
  const center = async () => { const c = await page.$('canvas'); const b = await c.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

  // ── Carga ──
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  await step('00-load', null);

  // ── Focus al viewport y agregar primitivas (la pista dice "1-5 primitivas") ──
  try { await page.locator('canvas').click({ position: { x: 50, y: 50 }, timeout: 3000 }); } catch (e) {}
  for (const k of ['1', '2', '3', '4', '5']) {
    await step(`key-${k}-add-primitiva`, async () => { await page.keyboard.press(k); });
  }

  // ── Cámara: orbitar y zoom para VER la geometría ──
  await step('orbit-drag', async () => {
    const c = await center(); await page.mouse.move(c.x, c.y); await page.mouse.down();
    await page.mouse.move(c.x + 230, c.y + 90, { steps: 16 }); await page.mouse.up();
  });
  await step('zoom-in', async () => { const c = await center(); await page.mouse.move(c.x, c.y); await page.mouse.wheel(0, -500); });

  // ── Recorrer cada menú superior (abre paneles/herramientas) ──
  for (const menu of ['SKETCH', 'SOLID', 'SURFACE', 'METAL', 'CONSTRUCT', 'INSPECT', 'INSERT', 'ASSEMBLE']) {
    await step(`menu-${menu}`, async () => {
      await page.getByText(menu, { exact: true }).first().click({ timeout: 3000 });
    });
  }

  // ── Command palette (⌘K / Ctrl+K): probar comandos de CAD ──
  for (const cmd of ['box', 'extrude', 'revolve', 'union', 'subtract', 'fillet']) {
    await step(`palette-${cmd}`, async () => {
      await page.keyboard.press('Control+k'); await page.waitForTimeout(400);
      await page.keyboard.type(cmd, { delay: 25 }); await page.waitForTimeout(700);
    });
    try { await page.keyboard.press('Escape'); } catch (e) {}
    await page.waitForTimeout(200);
  }

  // ── Exportar STL ──
  await step('export-STL', async () => { await page.getByText('STL', { exact: false }).first().click({ timeout: 3000 }); });
  try { await page.keyboard.press('Escape'); } catch (e) {}

  // ── Undo / Redo ──
  await step('undo', async () => { await page.keyboard.press('Control+z'); });
  await step('redo', async () => { await page.keyboard.press('Control+y'); });

  fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify({
    url: URL, when: new Date().toISOString(), totalConsoleErrors: allErrors.length, allErrors, steps,
  }, null, 2));
  console.log(`\nDONE · ${steps.length} pasos · ${allErrors.length} errores · salida ${OUT}`);
  await browser.close();
})().catch(e => { console.error('DRIVER FATAL:', e.message || e); process.exit(1); });
