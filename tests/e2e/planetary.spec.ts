/**
 * ⚒️ Planetary gear train — End-to-End (Playwright, real mouse)
 * ================================================================
 * Proves the Willis law through the UI:
 *   1. Omnibar → "Planetary gear train" opens the panel.
 *   2. All three invariants start green and STAY green as we scrub.
 *   3. Defaults (S=20, P=16, N=4) ⇒ R=52, carrier arm = 0.9,
 *      train value e = −S/R = −0.3846, speed ratio (ring fixed, sun input)
 *      = S/(S+R) = 20/72 = 0.2778.
 *   4. Scrubbing θ_sun to π places the carrier at 20·π/72 rad ≈ 50° while the
 *      ring stays at 0°.
 *   5. Right-click → Mode → Carrier fixed switches to reverse mode:
 *      output becomes ring and speed ratio becomes −S/R ≈ −0.3846.
 *   6. Right-click → Preset → 18/12/3 rebuilds the train with R = 42 teeth.
 */

import { test, expect, type Page } from '@playwright/test';

async function openPlanetaryPanel(page: Page) {
  const input = page.locator('input[placeholder*="Buscar"]').first();
  const panel = page.getByTestId('planetary-panel');

  // End-to-end retry: sometimes the first Vite HMR heartbeat on a cold page
  // fires while the main thread is tied up by the initial SwiftShader compile,
  // which force-reloads the page and wipes any React state we just set. Doing
  // the full Ctrl+K → fill → Enter cycle under retry is the only reliable way.
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Control+K');
      if (await input.isVisible({ timeout: 1500 }).catch(() => false)) break;
    }
    if (!(await input.isVisible().catch(() => false))) continue;
    await input.fill('planetary');
    const option = page.getByText('Planetary gear train (Willis)');
    if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) continue;
    // Click the option directly — avoids any Enter-vs-selectedIdx mismatch
    // and is more robust against the omnibar losing focus during shader compile.
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

test.describe('Planetary panel — Willis kinematics', () => {
  test.setTimeout(8 * 60 * 1000);

  test('mounts, invariants green, defaults match textbook values', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openPlanetaryPanel(page);

    // ── Invariants on mount ──
    await expect(page.getByTestId('inv-coaxial')).toContainText('✓');
    await expect(page.getByTestId('inv-willis')).toContainText('✓');
    await expect(page.getByTestId('inv-assembly')).toContainText('✓');

    // Defaults: S=20, P=16 ⇒ R = 52. trainValue = −20/52 = −0.3846…
    await expect(page.getByTestId('geom-ringteeth')).toContainText('R = 52');
    await expect(page.getByTestId('geom-train')).toContainText('-0.3846');
    // Ring fixed + sun input ⇒ output = carrier, speed ratio = 20/72 = 0.2778.
    await expect(page.getByTestId('geom-output')).toContainText('carrier');
    await expect(page.getByTestId('geom-ratio')).toContainText('0.2778');
    // (R+S) mod N = 72 mod 4 = 0.
    await expect(page.getByTestId('geom-assembly')).toContainText('mod N = 0');

    // At drive = 0 all three angles are 0.
    await expect(page.getByTestId('kin-sun')).toContainText(/^θ_sun = 0\.00°/);
    await expect(page.getByTestId('kin-ring')).toContainText(/^θ_ring = 0\.00°/);
    await expect(page.getByTestId('kin-carrier')).toContainText(/^θ_carrier = 0\.00°/);

    // Scrub sun to π (180°); ring fixed so θ_ring stays 0, θ_carrier = 20·180/72
    // = 50°. Planet self-rotation = 0 − (π − 0)·(20/16) = −1.25π ≈ −225°, which
    // after the panel's non-wrapping conversion displays as -225.00°.
    await setSliderValue(page, 'drive', Math.PI);
    await expect(page.getByTestId('kin-sun')).toContainText(/^θ_sun = 180\.00°/);
    await expect(page.getByTestId('kin-ring')).toContainText(/^θ_ring = 0\.00°/);
    await expect(page.getByTestId('kin-carrier')).toContainText(/^θ_carrier = 50\.00°/);

    // Invariants still green.
    await expect(page.getByTestId('inv-coaxial')).toContainText('✓');
    await expect(page.getByTestId('inv-willis')).toContainText('✓');
    await expect(page.getByTestId('inv-assembly')).toContainText('✓');

    expect(
      consoleErrors.filter((e) => !/WebGL|GPU|getContext|ERR_NETWORK_CHANGED/i.test(e)),
    ).toEqual([]);
  });

  test('right-click → Mode → Carrier fixed switches to reverse mode', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openPlanetaryPanel(page);

    // Baseline: output is the carrier (ring fixed, sun in).
    await expect(page.getByTestId('geom-output')).toContainText('carrier');

    const panel = page.getByTestId('planetary-panel');
    const box = await panel.boundingBox();
    if (!box) throw new Error('panel boundingBox missing');
    await page.mouse.click(box.x + 30, box.y + 16, { button: 'right' });

    await page.getByRole('button', { name: '⚙ Mode' }).click();
    // Marking-menu items sit on a z:9999 overlay that tangles Playwright's
    // actionability check. Force the click.
    await page.getByRole('button', { name: '⊙ Carrier fixed' }).click({ force: true });

    // Carrier fixed + sun input ⇒ output = ring, ratio = −S/R = −0.3846.
    await expect(page.getByTestId('geom-output')).toContainText('ring');
    await expect(page.getByTestId('geom-ratio')).toContainText('-0.3846');

    // Willis still green.
    await expect(page.getByTestId('inv-willis')).toContainText('✓');
  });

  test('right-click → Preset → 18/12/3 rebuilds the train', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openPlanetaryPanel(page);

    // Baseline R = 52.
    await expect(page.getByTestId('geom-ringteeth')).toContainText('R = 52');

    const panel = page.getByTestId('planetary-panel');
    const box = await panel.boundingBox();
    if (!box) throw new Error('panel boundingBox missing');
    await page.mouse.click(box.x + 30, box.y + 16, { button: 'right' });

    await page.getByRole('button', { name: '① Preset' }).click();
    await page.getByRole('button', { name: '③ 18 / 12 · 3' }).click({ force: true });

    // 18 + 2·12 = 42 ring teeth. Train value −18/42 = −0.4286.
    await expect(page.getByTestId('geom-ringteeth')).toContainText('R = 42');
    await expect(page.getByTestId('geom-train')).toContainText('-0.4286');
    // (42+18) mod 3 = 0.
    await expect(page.getByTestId('geom-assembly')).toContainText('mod N = 0');

    // All invariants green.
    await expect(page.getByTestId('inv-coaxial')).toContainText('✓');
    await expect(page.getByTestId('inv-willis')).toContainText('✓');
    await expect(page.getByTestId('inv-assembly')).toContainText('✓');
  });
});
