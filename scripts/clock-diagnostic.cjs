#!/usr/bin/env node
/**
 * Clock diagnostic — captures every failure mode we can think of:
 *   1. Page on initial load (no panel).
 *   2. Page after the clock panel opens (default, t=0).
 *   3. After scrubbing time to 15s, 900s, 3723s.
 *   4. Console errors + pageerrors for each step.
 *   5. DOM state: scene canvas size, panel presence, what the omnibar shows.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const OUT = '/tmp/clock-diagnostic';
fs.mkdirSync(OUT, { recursive: true });

const URL = process.env.URL || 'http://localhost:5001/';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const logs = [];
  page.on('console', m => {
    const t = m.type();
    if (t === 'error' || t === 'warning') logs.push(`[${t}] ${m.text()}`);
  });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));

  console.log(`→ navigating to ${URL}`);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: `${OUT}/01-initial.png`, fullPage: false });
  console.log('✓ 01-initial.png captured');

  // Inspect DOM — is there a canvas and what size?
  const canvasInfo = await page.evaluate(() => {
    const cs = Array.from(document.querySelectorAll('canvas'));
    return cs.map(c => ({ w: c.width, h: c.height, style: c.getAttribute('style') || '' }));
  });
  console.log('canvases:', JSON.stringify(canvasInfo));

  // Try to open the clock panel via omnibar.
  const input = page.locator('input[placeholder*="Buscar"]').first();
  const panel = page.getByTestId('clock-panel');
  let opened = false;
  for (let attempt = 0; attempt < 5 && !opened; attempt++) {
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Control+K');
      if (await input.isVisible({ timeout: 1500 }).catch(() => false)) break;
    }
    if (!(await input.isVisible().catch(() => false))) {
      console.log(`attempt ${attempt}: omnibar did not open`);
      continue;
    }
    await input.fill('mechanical clock');
    const option = page.getByText('Mechanical clock (capstone)');
    if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`attempt ${attempt}: option not visible`);
      await page.keyboard.press('Escape');
      continue;
    }
    const errorsBefore = logs.length;
    await option.click().catch(e => console.log(`click error: ${e.message}`));
    await page.waitForTimeout(1500);
    console.log(`errors added by click: ${logs.slice(errorsBefore).length}`);
    logs.slice(errorsBefore).forEach(l => console.log(`  ${l}`));
    const panelVisible = await panel.isVisible().catch(() => false);
    console.log(`panel visible after click? ${panelVisible}`);
    if (panelVisible) {
      opened = true;
      break;
    }
  }

  if (!opened) {
    console.log('✗ clock panel NEVER opened');
    await page.screenshot({ path: `${OUT}/02-panel-failed.png`, fullPage: false });
    await browser.close();
    console.log('\nlogs:\n' + logs.join('\n'));
    process.exit(2);
  }

  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/02-panel-open-t0.png`, fullPage: false });
  console.log('✓ 02-panel-open-t0.png');

  // Read the live display + invariants for diagnostics.
  const readPanelState = async () => {
    return page.evaluate(() => {
      const q = (id) => document.querySelector(`[data-testid="${id}"]`);
      const get = (id) => q(id) ? q(id).textContent.trim() : 'MISSING';
      return {
        clockTime: get('clock-time'),
        invRealtime: get('inv-realtime'),
        invCompound: get('inv-compound'),
        invDecoded: get('inv-decoded'),
        geomSecRev: get('geom-seconds-rev'),
        geomMinRev: get('geom-minute-rev'),
        geomHrRev: get('geom-hour-rev'),
        geomPeriod: get('geom-period'),
        kinHour: get('kin-hour'),
        kinMin: get('kin-minute'),
        kinSec: get('kin-seconds'),
      };
    });
  };
  const s0 = await readPanelState();
  console.log('panel @ t=0:', JSON.stringify(s0, null, 2));

  const setTime = async (t) => {
    const slider = page.getByTestId('time-slider');
    await slider.evaluate((el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, t);
    await page.waitForTimeout(800);
  };

  for (const t of [15, 30, 60, 120, 300, 900, 1800, 3723]) {
    await setTime(t);
    const st = await readPanelState();
    await page.screenshot({ path: `${OUT}/03-t${t}.png`, fullPage: false });
    console.log(`t=${t}s: display=${st.clockTime}  inv_real=${st.invRealtime}`);
  }

  if (logs.length) {
    const logPath = `${OUT}/logs.txt`;
    fs.writeFileSync(logPath, logs.join('\n'));
    console.log(`\n✗ ${logs.length} console/page errors — saved to ${logPath}`);
    console.log('first 12:\n' + logs.slice(0, 12).join('\n'));
  } else {
    console.log('\n✓ no console errors');
  }

  await browser.close();
})();
