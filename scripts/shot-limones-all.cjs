#!/usr/bin/env node
/**
 * Captures every scene of econ-01-limones for cinematic audit.
 * Output: _shots-phases/limones-XX-<id>.png
 */
const { chromium } = require('playwright');
const fs = require('fs');

const PORT = 5183;
const ID = 'econ-01-limones';

(async () => {
  const manifest = JSON.parse(
    require('child_process').execSync(`curl -s http://localhost:${PORT}/audio/masterclass/${ID}/manifest.json`).toString()
  );

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  for (let i = 0; i < manifest.scenes.length; i++) {
    const scene = manifest.scenes[i];
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
    const page = await ctx.newPage();

    const errors = [];
    page.on('pageerror', e => errors.push(`PAGE: ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().substring(0, 200)}`);
    });

    try {
      await page.goto(`http://localhost:${PORT}/masterclass.html?id=${ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1800);

      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => /Empezar/i.test(b.textContent || ''));
        if (btn) btn.click();
      });
      await page.waitForTimeout(600);
      await page.evaluate(() => document.querySelectorAll('audio').forEach(a => { a.muted = true; }));

      await page.evaluate(s => {
        const btns = Array.from(document.querySelectorAll('button[title]'));
        const t = btns.find(b => b.getAttribute('title') === s);
        if (t) t.click();
      }, scene.id);

      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => /pausar/i.test(b.textContent || ''));
        if (btn) btn.click();
        document.querySelectorAll('audio').forEach(a => a.pause());
      });
      await page.waitForTimeout(3000);

      const num = String(i + 1).padStart(2, '0');
      const out = `_shots-phases/limones-${num}-${scene.id}.png`;
      await page.screenshot({ path: out, fullPage: false });
      console.log(`✓ ${out}  (scene=${scene.scene})`);
      if (errors.length) {
        console.log(`  ⚠ ${errors.length} error(s)`);
        errors.slice(0, 2).forEach(e => console.log(`    ${e.substring(0, 150)}`));
      }
    } catch (e) {
      console.log(`✗ ${scene.id}: ${e.message}`);
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
  console.log('\nDone.');
})();
