#!/usr/bin/env node
/* Diagnóstico de carga del Part Studio (forja-brep): consola, pageerrors,
 * requests fallidos, WebGL renderer, estado de __forgeBrep + screenshot. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=new', '--ignore-gpu-blocklist',
      '--enable-gpu', '--use-angle=gl', '--enable-webgl', '--enable-unsafe-swiftshader',
      '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, bypassCSP: true });
  const page = await ctx.newPage();
  const logs = [], errs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', (r) => errs.push('REQFAIL ' + r.url() + ' :: ' + (r.failure() && r.failure().errorText)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(18000);
  const state = await page.evaluate(() => ({
    hasForge: !!window.__forgeBrep,
    ready: window.__forgeBrep ? window.__forgeBrep.ready : null,
    keys: window.__forgeBrep ? Object.keys(window.__forgeBrep) : null,
    gl: (() => { try { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return 'NO-WEBGL'; const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'no-debug-ext'; } catch (e) { return 'err:' + e.message; } })(),
    body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 240),
  }));
  console.log('=== STATE ===\n' + JSON.stringify(state, null, 1));
  console.log('=== ERRORS (' + errs.length + ') ===\n' + JSON.stringify(errs.slice(0, 14), null, 1));
  console.log('=== CONSOLE (últimos 30) ===\n' + JSON.stringify(logs.slice(-30), null, 1));
  await page.screenshot({ path: '/home/ian/Orkesta/la-forja/forja-shots/_diag-forja.png' });
  await ctx.close(); await browser.close();
})();
