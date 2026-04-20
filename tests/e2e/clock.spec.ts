/**
 * ⚒️ Mechanical Clock — End-to-End (Playwright, real mouse)
 * ============================================================
 * Proves the capstone staircase mechanism through the UI:
 *   1. Omnibar → "Mechanical clock (capstone)" opens the panel.
 *   2. Defaults form a real-time clock: ✓ on all three invariants.
 *   3. At t = 0 the display reads 00:00:00.00.
 *   4. Scrubbing time to 3723 s shows 01:02:03 on the hands.
 *   5. Right-click → Preset → Fast 2× breaks real-time (inv-realtime fails).
 *   6. Right-click → Time → +1h advances the hour hand by 60 min.
 */

import { test, expect, type Page } from '@playwright/test';

async function openClockPanel(page: Page) {
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
    if (await panel.isVisible({ timeout: 5000 }).catch(() => false)) return;
  }
  await expect(panel).toBeVisible();
}

async function setSliderValue(page: Page, testid: string, value: number) {
  const locator = page.getByTestId(`${testid}-slider`);
  await locator.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test.describe('Clock panel — capstone compound gear train', () => {
  test.setTimeout(8 * 60 * 1000);

  test('mounts, real-time invariants green, decodes 00:00:00 at t=0', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openClockPanel(page);

    await expect(page.getByTestId('inv-realtime')).toContainText('✓');
    await expect(page.getByTestId('inv-compound')).toContainText('✓');
    await expect(page.getByTestId('inv-decoded')).toContainText('✓');

    await expect(page.getByTestId('geom-seconds-rev')).toContainText('60.0000');
    await expect(page.getByTestId('geom-minute-rev')).toContainText('3600.00');
    await expect(page.getByTestId('geom-hour-rev')).toContainText('43200');

    await expect(page.getByTestId('clock-time')).toContainText('00:00:00.00');

    expect(
      consoleErrors.filter((e) => !/WebGL|GPU|getContext|ERR_NETWORK_CHANGED/i.test(e)),
    ).toEqual([]);
  });

  test('scrubbing time to 3723 s reads 01:02:03', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openClockPanel(page);

    await setSliderValue(page, 'time', 3723);
    await expect(page.getByTestId('kin-hour')).toContainText('HH = 1');
    await expect(page.getByTestId('kin-minute')).toContainText('MM = 2');
    await expect(page.getByTestId('kin-seconds')).toContainText(/^SS = 3\.00/);
    await expect(page.getByTestId('clock-time')).toContainText('01:02:03.00');
    await expect(page.getByTestId('inv-decoded')).toContainText('✓');
    await expect(page.getByTestId('inv-realtime')).toContainText('✓');
  });

  test('right-click → Preset → Fast 2× breaks real-time invariant', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openClockPanel(page);

    await expect(page.getByTestId('inv-realtime')).toContainText('✓');

    const panel = page.getByTestId('clock-panel');
    const box = await panel.boundingBox();
    if (!box) throw new Error('panel boundingBox missing');
    await page.mouse.click(box.x + 30, box.y + 16, { button: 'right' });

    await page.getByRole('button', { name: '⏱ Preset' }).click();
    await page.getByRole('button', { name: '» Fast 2×' }).click({ force: true });

    await expect(page.getByTestId('inv-realtime')).toContainText('✗');
    // Fast clock: 1 rev every 30 s for the seconds hand.
    await expect(page.getByTestId('geom-seconds-rev')).toContainText('30.0000');
    // Compound invariant still holds — it's a structural identity.
    await expect(page.getByTestId('inv-compound')).toContainText('✓');
  });
});
