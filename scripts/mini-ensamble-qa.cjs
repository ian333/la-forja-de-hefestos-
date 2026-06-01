#!/usr/bin/env node
/**
 * mini-ensamble-qa.cjs — QA de la pieza mini-ensamble-chasis-4-ruedas.
 * Corre EN iangpu (GPU ANGLE). Abre /cad.html, espera el ray-march,
 * 2 screenshots desde angulos distintos, lee status bar (nodos/cm3/fps),
 * exporta STL via boton 'STL' capturando el download.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/carro';
const SLUG = 'mini-ensamble-chasis-4-ruedas';
const URL = process.env.CAD_URL || 'http://localhost:5002/cad.html';
fs.mkdirSync(OUT, { recursive: true });

const orbit = async (page, dx, dy) => {
  const c = await page.$('canvas');
  if (!c) throw new Error('sin canvas');
  const box = await c.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(2500); // dejar re-marchar
};

const zoom = async (page, deltaY, times = 1) => {
  const c = await page.$('canvas');
  if (!c) throw new Error('sin canvas');
  const box = await c.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(2200);
};

const readStatus = async (page) => page.evaluate(() => {
  const t = document.body.innerText || '';
  const m = (re) => { const x = t.match(re); return x ? x[1] : null; };
  return { nodos: m(/(\d+)\s*nodos/), cm3: m(/([\d.]+)\s*cm³/), fps: m(/(\d+)\s*FPS/) };
});

(async () => {
  const errs = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('[pageerror] ' + String(e.message).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console.error] ' + m.text().slice(0, 300)); });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForTimeout(8000); // ray-march settle

  const canvasInfo = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    let webgl = false;
    try { const gl = c && (c.getContext('webgl2') || c.getContext('webgl')); webgl = !!gl; } catch (e) {}
    return { hasCanvas: !!c, w: c ? c.width : 0, h: c ? c.height : 0, webgl };
  });

  const status1 = await readStatus(page);

  // El ensamble mide ~48u (batalla) — alejar la camara para encuadrarlo todo.
  await zoom(page, 300, 14);

  // Shot 1 — vista 3/4 superior
  await orbit(page, 180, 90);
  const shot1 = path.join(OUT, `${SLUG}-1.png`);
  await page.screenshot({ path: shot1 });

  // Shot 2 — angulo distinto (orbit fuerte hacia el otro lado + arriba)
  await orbit(page, -420, -180);
  const shot2 = path.join(OUT, `${SLUG}-2.png`);
  await page.screenshot({ path: shot2 });

  const status2 = await readStatus(page);

  // ── Export STL via boton 'STL' + waitForEvent download ──
  let stlPath = null, stlBytes = null, stlErr = null;
  try {
    const stlBtn = page.locator('button:has-text("STL")').first();
    // downloadSTL corre marching-cubes (res 192 -> ~7M evals) SINCRONO en el
    // hilo principal: congela el event loop varios segundos. Por eso click()
    // normal time-outea (espera estabilidad post-click). Usamos dispatchEvent
    // (dispara el onClick de React sin esperar actionability) y aguardamos el
    // download con timeout largo (el a.click() del blob se dispara AL terminar
    // el marching-cubes).
    const downloadPromise = page.waitForEvent('download', { timeout: 180000 });
    await stlBtn.dispatchEvent('click');
    const download = await downloadPromise;
    stlPath = path.join(OUT, `${SLUG}.stl`);
    await download.saveAs(stlPath);
    stlBytes = fs.statSync(stlPath).size;
  } catch (e) {
    stlErr = String(e.message || e).slice(0, 300);
  }

  console.log('QA_RESULT=' + JSON.stringify({
    canvasInfo, status1, status2,
    shot1, shot2,
    stlPath, stlBytes, stlErr,
    errs,
  }));
  await browser.close();
})().catch(e => { console.error('FATAL ' + (e.message || e)); process.exit(1); });
