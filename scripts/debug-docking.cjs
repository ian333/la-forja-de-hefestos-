#!/usr/bin/env node
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5001/physics.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('[data-testid="branch-bio"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-testid="module-docking"]').click();
  await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
  await page.waitForTimeout(6000); // RCSB fetch + scene build

  fs.mkdirSync('/tmp/physics-screenshots/docking', { recursive: true });
  await page.screenshot({ path: '/tmp/physics-screenshots/docking/full.png', animations: 'disabled' });
  console.log('[shot] docking/full');

  // Check INNER sidebar content (the rightmost aside — docking controls)
  const sidebarText = await page.evaluate(() => {
    const asides = document.querySelectorAll('aside');
    if (asides.length === 0) return '(no sidebar)';
    return asides[asides.length - 1].innerText;
  });
  console.log('\n--- sidebar ---');
  console.log(sidebarText);

  console.log('\n--- console errors ---');
  for (const l of logs) if (l.includes('error') || l.includes('Error') || l.includes('pageerror')) console.log(l);

  await browser.close();
})();
