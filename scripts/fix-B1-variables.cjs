#!/usr/bin/env node
// B1-variables QA driver. Runs on iangpu against :5002.
// Tests: a=2, b="a/2" -> b chip shows 1 (numeric, not ERR); edit a=4 -> b=2;
//        primitive auto-vars (box_*) not ERR.
'use strict';
const { chromium } = require('playwright');
const OUT = process.env.SHOT || '/tmp/fix-B1-variables.png';
const URL = process.env.CAD_URL || 'http://localhost:5002/cad.html';

// Read all variable chips from the variable bar. Each chip is a <button> with
// spans: [name] [=] [value] [unit?]. We parse name + displayed value text.
function readChipsFn() {
  // The variable bar is the row that starts with a lone "$" span and holds the
  // "+ Variable" button. Find buttons whose first child span is the gold name.
  const buttons = Array.from(document.querySelectorAll('button'));
  const out = [];
  for (const b of buttons) {
    const spans = b.querySelectorAll('span');
    if (spans.length < 3) continue;
    // chip layout: span(name) span(=) span(value) [span(unit)]
    const eq = Array.from(spans).find(s => s.textContent.trim() === '=');
    if (!eq) continue;
    const name = spans[0].textContent.trim();
    // value span is the one right after '='
    const all = Array.from(spans);
    const eqIdx = all.indexOf(eq);
    const valSpan = all[eqIdx + 1];
    if (!valSpan) continue;
    const value = valSpan.textContent.trim();
    const isErr = b.className.includes('text-red') || value === 'ERR';
    out.push({ name, value, isErr });
  }
  return out;
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  const log = [];

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6500);

  // Helper: add a variable through the real "+ Variable" UI.
  async function addVar(name, expr) {
    const btn = page.getByRole('button', { name: '+ Variable' });
    await btn.click();
    await page.waitForTimeout(300);
    const nameInput = page.locator('input[placeholder="nombre"]');
    const exprInput = page.locator('input[placeholder="expresión"]');
    await nameInput.fill(name);
    await exprInput.fill(expr);
    await exprInput.press('Enter');
    await page.waitForTimeout(500);
  }

  try {
    // ── Step 1: a = 2 ──
    await addVar('a', '2');
    // ── Step 2: b = a/2 ──
    await addVar('b', 'a/2');
    await page.waitForTimeout(400);

    let chips = await page.evaluate(readChipsFn);
    log.push('AFTER a=2,b=a/2: ' + JSON.stringify(chips));
    const aChip = chips.find(c => c.name === 'a');
    const bChip = chips.find(c => c.name === 'b');

    // ── Step 3: add a box primitive → auto vars must not be ERR ──
    // Use the keyboard shortcut '1' = addPrimitive('box'). First blur any input
    // focus by clicking the canvas/viewport area, then press '1'.
    let boxAdded = false;
    try {
      const canvas = page.locator('canvas').first();
      if (await canvas.count() > 0) {
        await canvas.click({ position: { x: 400, y: 300 }, timeout: 2000 }).catch(() => {});
      } else {
        await page.mouse.click(700, 350).catch(() => {});
      }
      await page.waitForTimeout(200);
      await page.keyboard.press('1');
      boxAdded = true;
    } catch (_) {}
    await page.waitForTimeout(1100);

    chips = await page.evaluate(readChipsFn);
    log.push('AFTER box add (boxAdded=' + boxAdded + '): ' + JSON.stringify(chips));
    const autoVars = chips.filter(c => /_(ancho|alto|prof|radio|altura|Rmayor|Rmenor)$/.test(c.name));
    const autoErr = autoVars.filter(c => c.isErr || c.value === 'ERR');

    // ── Step 4: edit a = 4 → b should become 2 ──
    // Click the 'a' chip to edit, replace expression with 4, Enter.
    // Re-locate the 'a' chip button.
    const aBtn = page.locator('button', { hasText: 'a' }).filter({ hasText: '=' });
    // More precise: find the button whose first span text === 'a'
    const aHandle = await page.evaluateHandle(() => {
      const bs = Array.from(document.querySelectorAll('button'));
      return bs.find(b => {
        const s = b.querySelectorAll('span');
        return s.length >= 3 && s[0].textContent.trim() === 'a'
          && Array.from(s).some(x => x.textContent.trim() === '=');
      }) || null;
    });
    let editOk = false;
    if (aHandle) {
      const el = aHandle.asElement();
      if (el) {
        await el.click();
        await page.waitForTimeout(300);
        // An input.b-b border-gold appears inside the chip.
        const chipInput = page.locator('input.border-gold, input.border-b').first();
        if (await chipInput.count() > 0) {
          await chipInput.fill('4');
          await chipInput.press('Enter');
          editOk = true;
        } else {
          // fallback: select-all + type
          await page.keyboard.press('Control+A');
          await page.keyboard.type('4');
          await page.keyboard.press('Enter');
          editOk = true;
        }
      }
    }
    await page.waitForTimeout(700);

    chips = await page.evaluate(readChipsFn);
    log.push('AFTER edit a=4 (editOk=' + editOk + '): ' + JSON.stringify(chips));
    const aChip2 = chips.find(c => c.name === 'a');
    const bChip2 = chips.find(c => c.name === 'b');

    await page.screenshot({ path: OUT });

    const result = {
      errs,
      log,
      step1_2: { a: aChip || null, b: bChip || null },
      autoVars: autoVars.map(c => ({ name: c.name, value: c.value, isErr: c.isErr })),
      autoErrCount: autoErr.length,
      afterEdit: { a: aChip2 || null, b: bChip2 || null },
      asserts: {
        b_equals_1: bChip && bChip.value === '1' && !bChip.isErr,
        b_equals_2_after_edit: bChip2 && bChip2.value === '2' && !bChip2.isErr,
        a_equals_4_after_edit: aChip2 && aChip2.value === '4',
        no_auto_err: autoErr.length === 0 && autoVars.length > 0,
      },
    };
    console.log('B1_RESULT=' + JSON.stringify(result));
  } catch (e) {
    await page.screenshot({ path: OUT }).catch(() => {});
    console.log('B1_RESULT=' + JSON.stringify({ errs, log, fatal: e.message }));
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
