#!/usr/bin/env node
// Carga el CAD, espera, y toma UN screenshot + lee el status bar. Corre en iangpu.
'use strict';
const { chromium } = require('playwright');
const OUT = process.env.SHOT || '/tmp/cad-shot.png';
const URL = process.env.CAD_URL || 'http://localhost:5001/cad.html';
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForTimeout(6500);
  const st = await p.evaluate(() => {
    const t = document.body.innerText || '';
    const m = (re) => { const x = t.match(re); return x ? x[1] : null; };
    return { nodos: m(/(\d+)\s*nodos/), cm3: m(/([\d.]+)\s*cm³/), fps: m(/(\d+)\s*FPS/) };
  });
  await p.screenshot({ path: OUT });
  console.log('SHOT_RESULT=' + JSON.stringify({ errs, status: st }));
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
