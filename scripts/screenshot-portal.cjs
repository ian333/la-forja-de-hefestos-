#!/usr/bin/env node
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5001/escuela.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/escuela-portal.png', fullPage: true });
  console.log('shot');
  await browser.close();
})();
