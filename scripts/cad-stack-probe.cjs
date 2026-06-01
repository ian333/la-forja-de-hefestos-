#!/usr/bin/env node
// Captura el STACK TRACE exacto del crash de init del CAD. Corre en iangpu.
'use strict';
const { chromium } = require('playwright');
const URL = process.env.CAD_URL || 'http://localhost:5001/cad.html';
(async () => {
  const b = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const out = [];
  p.on('pageerror', e => out.push({ type: 'pageerror', msg: e.message, stack: (e.stack || '').slice(0, 2000) }));
  p.on('console', m => { if (m.type() === 'error') out.push({ type: 'console.error', text: m.text().slice(0, 600) }); });
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => out.push({ type: 'goto-error', msg: String(e).slice(0, 200) }));
  await p.waitForTimeout(4500);
  console.log('===STACK-JSON-START===');
  console.log(JSON.stringify(out, null, 2));
  console.log('===STACK-JSON-END===');
  await b.close();
})().catch(e => { console.error('PROBE FATAL:', e.message || e); process.exit(1); });
