#!/usr/bin/env node
/**
 * nodo-chasis-qa.cjs — QA de la pieza 'nodo-chasis-6vias' en el CAD F-Rep.
 * Corre EN iangpu (GPU real, ANGLE). Abre /cad.html, espera el ray-march,
 * 2 screenshots desde angulos distintos (orbit), lee status bar, exporta STL.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/carro';
fs.mkdirSync(OUT, { recursive: true });
const SLUG = 'nodo-chasis-6vias';
const URL = process.env.CAD_URL || 'http://localhost:5002/cad.html';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1680, height: 1000 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message.slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (t.length < 400) errs.push('[console.error] ' + t); } });

  const result = { slug: SLUG, rendered: false, stl_path: null, stl_bytes: null, shots: [], status: null, errs: [] };

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000); // dar tiempo al ray-march

  const readStatus = async () => page.evaluate(() => {
    const t = document.body.innerText || '';
    const m = (re) => { const x = t.match(re); return x ? x[1] : null; };
    return { nodos: m(/(\d+)\s*nodos/), cm3: m(/([\d.]+)\s*cm³/), fps: m(/(\d+)\s*FPS/) };
  });

  // Screenshot #1 — vista por defecto
  const s1 = path.join(OUT, `${SLUG}-1.png`);
  await page.screenshot({ path: s1 });
  result.shots.push(s1);

  // Orbitar la camara para un angulo distinto
  const c = await page.$('canvas');
  if (c) {
    const box = await c.boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 260, cy + 120, { steps: 18 });
    await page.mouse.up();
    await page.waitForTimeout(3500);
  }

  // Screenshot #2 — angulo orbitado
  const s2 = path.join(OUT, `${SLUG}-2.png`);
  await page.screenshot({ path: s2 });
  result.shots.push(s2);

  result.status = await readStatus();
  result.rendered = !!(result.status && result.status.nodos && Number(result.status.nodos) > 0);

  // Exportar STL: dispatch del click via DOM (el main thread esta saturado a
  // ~4-6 FPS por el ray-march; el click 'actionable' de Playwright se cuelga).
  try {
    const downloadP = page.waitForEvent('download', { timeout: 60000 });
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => (x.innerText || '').trim() === 'STL');
      if (!b) return false;
      b.click();
      return true;
    });
    result.stlClicked = clicked;
    const download = await downloadP;
    const dest = path.join(OUT, `${SLUG}.stl`);
    await download.saveAs(dest);
    const st = fs.statSync(dest);
    result.stl_path = dest;
    result.stl_bytes = st.size;
  } catch (e) {
    result.stlError = String(e.message || e).slice(0, 300);
  }

  result.errs = errs.slice(0, 40);
  console.log('QA_RESULT=' + JSON.stringify(result));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message || e); process.exit(1); });
