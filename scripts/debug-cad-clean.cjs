#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/debug-pages';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });
  // Fresh isolated context — empty storage, empty cache
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  const events = [];
  page.on('pageerror', e => events.push(`[pageerror] ${e.message}`));
  page.on('console', m => {
    const t = m.type();
    if (t === 'error' || t === 'warning' || t === 'log') {
      const text = m.text();
      if (text.length < 300) events.push(`[${t}] ${text}`);
    }
  });

  // Disable BroadcastChannel before navigation so we can see what fresh mount looks like
  await ctx.addInitScript(() => {
    // @ts-ignore
    window.BroadcastChannel = undefined;
  });

  await page.goto('http://localhost:5001/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4500);

  // What's the actual scene state?
  const sceneInfo = await page.evaluate(() => {
    const win = window;
    const lastRun = win.__forjaLastRun;
    const localKeys = Object.keys(localStorage);
    return {
      lastRun,
      localStorage: localKeys.map(k => ({ k, v: localStorage.getItem(k).slice(0, 200) })),
      body: document.body.innerText.slice(0, 500),
    };
  });

  console.log('=== last run ===');
  console.log(JSON.stringify(sceneInfo.lastRun, null, 2));
  console.log('\n=== localStorage ===');
  for (const e of sceneInfo.localStorage) console.log(`  ${e.k}: ${e.v}`);
  console.log('\n=== events ===');
  for (const e of events.slice(0, 40)) console.log(e);

  await page.screenshot({ path: path.join(OUT, 'cad-clean.png'), fullPage: false });

  await browser.close();
})();
