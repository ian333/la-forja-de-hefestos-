/* Playwright smoke test for the AIPanel mount + console health.
 * Run on iangpu: node scripts/qa-aipanel.cjs  (needs vite on :5002)
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.CAD_URL || 'http://localhost:5002/cad.html';
const OUT = '/tmp/qa-aipanel.png';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1680, height: 1000 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console.error] ' + m.text().slice(0, 200)); });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  // Find the AI toggle button (innerText contains 'AI').
  const aiBtnExists = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim().startsWith('AI'))
  );

  // Click it to expand.
  let panelText = '';
  try {
    const btn = page.locator('button', { hasText: /^AI/ }).first();
    await btn.click({ timeout: 4000 });
    await page.waitForTimeout(1200);
    panelText = await page.evaluate(() => document.body.innerText);
  } catch (e) {
    panelText = 'CLICK_FAILED: ' + String(e.message).slice(0, 120);
  }

  const controlVisible = panelText.includes('Control por IA');
  const varsLineVisible = /Variables \(\d+\)/.test(panelText);

  await page.screenshot({ path: OUT });

  console.log(JSON.stringify({
    aiBtnExists,
    controlVisible,
    varsLineVisible,
    lastRun: await page.evaluate(() => {
      const r = window.__forjaLastRun;
      return r ? { ok: r.ok, summary: (r.summary || '').slice(0, 80), error: (r.error || '').slice(0, 80) } : null;
    }),
    consoleErrors: errors.slice(0, 8),
    screenshot: OUT,
  }, null, 2));

  await browser.close();
  process.exit(errors.length === 0 && aiBtnExists && controlVisible ? 0 : 1);
})();
