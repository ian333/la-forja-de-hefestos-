#!/usr/bin/env node
/**
 * Captures screenshots of all 4 new simulation scenes:
 *   - CommonsScene (econ-15 Ostrom)
 *   - MatchingScene (econ-11 Roth-Shapley)
 *   - ExpectationsScene (econ-16 Lucas)
 *   - VickreyScene (econ-17 Mirrlees-Vickrey)
 */
const { chromium } = require('playwright');

const PORT = 5183;
const SHOTS = [
  { id: 'econ-15-ostrom', scenes: ['01-pregunta', '06-ostrom-sim'] },
  { id: 'econ-11-roth-shapley', scenes: ['05-algoritmo'] },
  { id: 'econ-16-lucas', scenes: ['01-pregunta', '06-racionales'] },
  { id: 'econ-17-mirrlees-vickrey', scenes: ['01-pregunta', '05-truth-telling'] },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  for (const { id, scenes } of SHOTS) {
    for (const scene of scenes) {
      const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
      const page = await ctx.newPage();

      const errors = [];
      page.on('pageerror', e => errors.push(`PAGE: ${e.message}`));
      page.on('console', m => {
        if (m.type() === 'error') errors.push(`CONSOLE: ${m.text().substring(0, 200)}`);
      });

      try {
        const url = `http://localhost:${PORT}/masterclass.html?id=${id}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => /Empezar/i.test(b.textContent || ''));
          if (btn) btn.click();
        });
        await page.waitForTimeout(800);
        await page.evaluate(() => {
          document.querySelectorAll('audio').forEach(a => { a.muted = true; });
        });

        await page.evaluate(s => {
          const btns = Array.from(document.querySelectorAll('button[title]'));
          const t = btns.find(b => b.getAttribute('title') === s);
          if (t) t.click();
        }, scene);

        await page.waitForTimeout(500);
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => /pausar/i.test(b.textContent || ''));
          if (btn) btn.click();
          document.querySelectorAll('audio').forEach(a => a.pause());
        });

        await page.waitForTimeout(5500);

        const out = `_shots-phases/${id}-${scene}.png`;
        await page.screenshot({ path: out, fullPage: false });
        console.log(`✓ ${out}`);
        if (errors.length) {
          console.log(`  ⚠ ${errors.length} error(s):`);
          errors.slice(0, 3).forEach(e => console.log(`    ${e.substring(0, 180)}`));
        }
      } catch (e) {
        console.log(`✗ ${id}/${scene}: ${e.message}`);
      } finally {
        await ctx.close();
      }
    }
  }

  await browser.close();
  console.log('\nDone.');
})();
