#!/usr/bin/env node
'use strict';
const { chromium } = require('playwright');
const URL = process.env.CAD_URL || 'http://localhost:5002/cad.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 240)));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 240)); });
  p.on('framenavigated', f => { if (f === p.mainFrame()) errs.push('NAV ' + f.url()); });
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  const probe = await p.evaluate(() => {
    const f = window.__forge;
    return {
      hasForge: !!f,
      type: typeof f,
      hasGetState: !!(f && f.getState),
      keys: f ? Object.keys(f).slice(0, 12) : null,
      stateKeys: (f && f.getState) ? Object.keys(f.getState()).slice(0, 30) : null,
    };
  });
  console.log('PROBE=' + JSON.stringify(probe));
  console.log('ERRS=' + JSON.stringify(errs.slice(0, 15)));
  await b.close();
})().catch(e => { console.error('FATAL', e.stack || e.message); process.exit(1); });
