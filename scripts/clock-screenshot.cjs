#!/usr/bin/env node
/**
 * Visual verification: capture the clock at four different times so we can
 * SEE the hands rotate — the real test that the scene update plumbing works.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/clock-verification';
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: 't0',     time: 0,     expect: '12:00 (all hands up)' },
  { name: 't15',    time: 15,    expect: 'seconds at 3-o-clock' },
  { name: 't30',    time: 30,    expect: 'seconds at 6-o-clock' },
  { name: 't900',   time: 900,   expect: 'minute at 3-o-clock (15 min)' },
  { name: 't3723',  time: 3723,  expect: '01:02:03' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(`[error] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  const url = process.env.URL || 'http://localhost:5001/';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(1000);

  const input = page.locator('input[placeholder*="Buscar"]').first();
  const panel = page.getByTestId('clock-panel');
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Control+K');
      if (await input.isVisible({ timeout: 1500 }).catch(() => false)) break;
    }
    if (!(await input.isVisible().catch(() => false))) continue;
    await input.fill('mechanical clock');
    const option = page.getByText('Mechanical clock (capstone)');
    if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) continue;
    await option.click();
    if (await panel.isVisible({ timeout: 5000 }).catch(() => false)) break;
  }
  await page.waitForTimeout(1200);

  const setTime = async (t) => {
    const slider = page.getByTestId('time-slider');
    await slider.evaluate((el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, t);
    await page.waitForTimeout(600);
  };

  for (const s of SHOTS) {
    await setTime(s.time);
    await page.screenshot({ path: `${OUT}/clock-${s.name}.png`, fullPage: false });
    const display = await page.getByTestId('clock-time').textContent();
    console.log(`t=${s.time}s → ${display.trim()}   (${s.expect})`);
  }

  if (logs.length) console.log('logs:\n' + logs.slice(0, 8).join('\n'));
  await browser.close();
})();
