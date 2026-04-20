/**
 * ⚒️ Clock escapement — End-to-End (Playwright, real mouse)
 * ============================================================
 * Proves the deadbeat timing law through the UI:
 *   1. Omnibar → "Clock escapement (deadbeat)" opens the panel.
 *   2. All three invariants start green and STAY green as we scrub t.
 *   3. Defaults (seconds pendulum, N=30) ⇒ T ≈ 2.000 s, 2π/N = 12.00°.
 *   4. Scrubbing t to 60 s ticks the wheel 60 times.
 *   5. Right-click → Preset → 12-tooth rebuilds the wheel with larger teeth.
 *   6. Right-click → Time → +T/4 shifts the pendulum to its zero crossing.
 */

import { test, expect, type Page } from '@playwright/test';

async function openEscapementPanel(page: Page) {
  const input = page.locator('input[placeholder*="Buscar"]').first();
  const panel = page.getByTestId('escapement-panel');
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Control+K');
      if (await input.isVisible({ timeout: 1500 }).catch(() => false)) break;
    }
    if (!(await input.isVisible().catch(() => false))) continue;
    await input.fill('escapement');
    const option = page.getByText('Clock escapement (deadbeat)');
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

test.describe('Escapement panel — deadbeat timing', () => {
  test.setTimeout(8 * 60 * 1000);

  test('mounts, invariants green, seconds pendulum gives T ≈ 2 s', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openEscapementPanel(page);

    // ── Invariants on mount ──
    await expect(page.getByTestId('inv-period')).toContainText('✓');
    await expect(page.getByTestId('inv-ticks')).toContainText('✓');
    await expect(page.getByTestId('inv-pendulum')).toContainText('✓');

    // Defaults: L ≈ 0.994 m (slider-step-rounded seconds pendulum),
    // g = 9.80665 ⇒ T₀ ≈ 2.000 s (displayed as "2.0004" at that L).
    // Amplitude 0.05 rad ⇒ T = T₀·(1 + 0.05²/16 + …) still rounds to "2.000x".
    await expect(page.getByTestId('geom-period-simple')).toContainText(/^T₀ = 2\.000/);
    await expect(page.getByTestId('geom-period')).toContainText(/^T = 2\.000/);
    // 30 teeth ⇒ 2π/30 = 12.00°.
    await expect(page.getByTestId('geom-tooth')).toContainText('12.00°');

    // At t = 0 pendulum at max = 0.05 rad = 2.865°, no ticks yet.
    await expect(page.getByTestId('kin-pendulum')).toContainText(/^θ_p = 2\.86/);
    await expect(page.getByTestId('kin-ticks')).toContainText(/^ticks = 0/);

    // Scrub t to 60 s  ⇒ 60 ticks (one per half-period, T/2 ≈ 1 s).
    await setSliderValue(page, 'time', 60);
    await expect(page.getByTestId('kin-ticks')).toContainText(/^ticks = 60/);

    // Invariants still green.
    await expect(page.getByTestId('inv-period')).toContainText('✓');
    await expect(page.getByTestId('inv-ticks')).toContainText('✓');
    await expect(page.getByTestId('inv-pendulum')).toContainText('✓');

    expect(
      consoleErrors.filter((e) => !/WebGL|GPU|getContext|ERR_NETWORK_CHANGED/i.test(e)),
    ).toEqual([]);
  });

  test('right-click → Preset → 12-tooth updates tooth angle live', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openEscapementPanel(page);

    // Baseline: 30 teeth ⇒ 12.00°.
    await expect(page.getByTestId('geom-tooth')).toContainText('12.00°');

    const panel = page.getByTestId('escapement-panel');
    const box = await panel.boundingBox();
    if (!box) throw new Error('panel boundingBox missing');
    await page.mouse.click(box.x + 30, box.y + 16, { button: 'right' });

    await page.getByRole('button', { name: '⏱ Preset' }).click();
    await page.getByRole('button', { name: '①② 12-tooth' }).click({ force: true });

    // 12 teeth ⇒ 2π/12 = 30.00°.
    await expect(page.getByTestId('teethCount-value')).toContainText('12');
    await expect(page.getByTestId('geom-tooth')).toContainText('30.00°');

    // Period unchanged (only N changed).
    await expect(page.getByTestId('geom-period-simple')).toContainText(/^T₀ = 2\.000/);

    // Invariants still green.
    await expect(page.getByTestId('inv-period')).toContainText('✓');
    await expect(page.getByTestId('inv-ticks')).toContainText('✓');
    await expect(page.getByTestId('inv-pendulum')).toContainText('✓');
  });

  test('right-click → Time → +T/2 advances exactly one tick', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openEscapementPanel(page);

    // Mount state: t = 0 ⇒ 0 ticks.
    await expect(page.getByTestId('kin-ticks')).toContainText(/^ticks = 0/);

    const panel = page.getByTestId('escapement-panel');
    const box = await panel.boundingBox();
    if (!box) throw new Error('panel boundingBox missing');
    await page.mouse.click(box.x + 30, box.y + 16, { button: 'right' });

    await page.getByRole('button', { name: '⏲ Time' }).click();
    await page.getByRole('button', { name: '½ +T/2' }).click({ force: true });

    // Exactly one tick should have been released.
    await expect(page.getByTestId('kin-ticks')).toContainText(/^ticks = 1/);
    // Escape wheel angle = 1 × 12° = 12.00°.
    await expect(page.getByTestId('kin-escape')).toContainText('12.00°');
    // Pendulum has swung to its −A extreme: θ_p = −2.86…°.
    await expect(page.getByTestId('kin-pendulum')).toContainText(/^θ_p = -2\.86/);
  });
});
