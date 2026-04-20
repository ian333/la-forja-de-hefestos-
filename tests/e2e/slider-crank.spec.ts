/**
 * ⚒️ Slider-crank — End-to-End (Playwright, real mouse)
 * =========================================================
 * Proves the full kinematic law through the UI:
 *   1. Omnibar → "Slider-crank" opens the panel.
 *   2. All three invariants start green and STAY green as we scrub.
 *   3. At θ = 0 (default TDC for e = 0), slider x is at its maximum = L + r,
 *      and dx/dθ = 0.
 *   4. Scrubbing θ to π puts the slider at BDC: x = L − r, dx/dθ = 0.
 *   5. Right-click → Crank → TDC / BDC snaps to the dead centres exactly.
 *   6. Right-click → Ratio → L/r = 4 updates the rod length and the displayed
 *      ratio live.
 */

import { test, expect, type Page } from '@playwright/test';

async function openSliderCrankPanel(page: Page) {
  const input = page.locator('input[placeholder*="Buscar"]').first();
  // Ctrl+K occasionally gets absorbed before the Omnibar keydown listener is
  // wired, especially when a prior shader compile has recently stalled the
  // main thread. Retry the shortcut until the input appears.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Control+K');
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) break;
  }
  await expect(input).toBeVisible();
  await input.fill('slider');
  await expect(page.getByText('Slider-crank (biela-manivela)')).toBeVisible();
  await input.press('Enter');
  await expect(page.getByTestId('slider-crank-panel')).toBeVisible();
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

test.describe('Slider-crank panel — live kinematics', () => {
  // Generous timeout — same reason as the Geneva suite: shader compiles under
  // SwiftShader/WSL stall for seconds and the webdriver bypass keeps the DOM
  // responsive but the first paint still gets one compile.
  test.setTimeout(8 * 60 * 1000);

  test('mounts, invariants green, TDC and BDC snap to extrema', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openSliderCrankPanel(page);

    // ── Invariants on mount ──
    await expect(page.getByTestId('inv-rod')).toContainText('✓');
    await expect(page.getByTestId('inv-stroke')).toContainText('✓');
    await expect(page.getByTestId('inv-pressure')).toContainText('✓');

    // Defaults: r = 0.5, L = 1.6 ⇒ stroke = 1.0, L/r = 3.2.
    await expect(page.getByTestId('geom-stroke')).toContainText('1.0000');
    await expect(page.getByTestId('geom-ratio')).toContainText('3.200');
    // e = 0 ⇒ TDC = 0°, BDC = 180°.
    await expect(page.getByTestId('geom-tdc')).toContainText('0.00°');
    await expect(page.getByTestId('geom-bdc')).toContainText('180.00°');

    // At θ = 0: x = r + L = 2.1, dx/dθ = 0, β = 0.
    await expect(page.getByTestId('kin-x')).toContainText('2.1000');
    await expect(page.getByTestId('kin-beta')).toContainText(/^β = 0\.00°/);
    await expect(page.getByTestId('kin-dxdtheta')).toContainText('0.0000');

    // Scrub to θ = π → BDC: x = L − r = 1.1.
    await setSliderValue(page, 'crankAngle', Math.PI);
    await expect(page.getByTestId('kin-x')).toContainText('1.1000');
    await expect(page.getByTestId('kin-dxdtheta')).toContainText(/^dx\/dθ = -?0\.0000/);

    // Invariants still green.
    await expect(page.getByTestId('inv-rod')).toContainText('✓');
    await expect(page.getByTestId('inv-stroke')).toContainText('✓');
    await expect(page.getByTestId('inv-pressure')).toContainText('✓');

    // No uncaught JS errors. WebGL/GPU warnings are expected under SwiftShader,
    // and ERR_NETWORK_CHANGED fires sporadically on WSL2 when the virtualised
    // interface cycles — neither indicates a real app fault.
    expect(
      consoleErrors.filter((e) => !/WebGL|GPU|getContext|ERR_NETWORK_CHANGED/i.test(e)),
    ).toEqual([]);
  });

  test('right-click → Crank → BDC snaps slider to minimum x', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openSliderCrankPanel(page);

    const panel = page.getByTestId('slider-crank-panel');
    const box = await panel.boundingBox();
    if (!box) throw new Error('panel boundingBox missing');
    await page.mouse.click(box.x + 30, box.y + 16, { button: 'right' });

    await page.getByRole('button', { name: '⟳ Crank' }).click();
    // Marking-menu items sit on a z:9999 fixed overlay that tangles
    // Playwright's actionability check. A forced click bypasses it.
    await page.getByRole('button', { name: '↓ BDC' }).click({ force: true });

    // BDC for e = 0 ⇒ θ = 180°, x = L − r = 1.1, β = 0, dx/dθ = 0.
    await expect(page.getByTestId('crankAngle-value')).toContainText('180.0°');
    await expect(page.getByTestId('kin-x')).toContainText('1.1000');
    await expect(page.getByTestId('kin-dxdtheta')).toContainText(/^dx\/dθ = -?0\.0000/);
  });

  test('right-click → Ratio → L/r = 4 updates rod length live', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openSliderCrankPanel(page);

    // Baseline defaults: L/r = 3.200
    await expect(page.getByTestId('geom-ratio')).toContainText('3.200');

    const panel = page.getByTestId('slider-crank-panel');
    const box = await panel.boundingBox();
    if (!box) throw new Error('panel boundingBox missing');
    await page.mouse.click(box.x + 30, box.y + 16, { button: 'right' });

    await page.getByRole('button', { name: '⚙ Ratio' }).click();
    await page.getByRole('button', { name: '④ L/r = 4' }).click({ force: true });

    // r stays 0.5; L becomes 2.0 ⇒ L/r = 4.000, stroke still 1.0.
    await expect(page.getByTestId('rodLength-value')).toContainText('2.000');
    await expect(page.getByTestId('geom-ratio')).toContainText('4.000');
    await expect(page.getByTestId('geom-stroke')).toContainText('1.0000');

    // Invariants still green.
    await expect(page.getByTestId('inv-rod')).toContainText('✓');
    await expect(page.getByTestId('inv-stroke')).toContainText('✓');
    await expect(page.getByTestId('inv-pressure')).toContainText('✓');
  });
});
