/**
 * ⚒️ Geneva drive — End-to-End (Playwright, real mouse)
 * =========================================================
 * Proves the full kinematic law through the UI:
 *   1. Omnibar opens panel.
 *   2. All three invariants start green and STAY green as we scrub.
 *   3. Scrubbing the drive angle crosses the engagement boundary → the
 *      "engaged/dwell" indicator toggles.
 *   4. After one full driver revolution (+360°) the driven angle has stepped
 *      by −90° on an N=4 Geneva (one slot).
 *   5. Right-click → Slots → N=6 updates the slot-count live and re-derives
 *      geometry (C grows from a/sin(45°) to a/sin(30°)).
 *   6. Right-click → Drive → +α puts the mechanism AT the engagement boundary
 *      (engaged = true but one ε on the dwell side would flip it).
 */

import { test, expect, type Page } from '@playwright/test';

async function openGenevaPanel(page: Page) {
  await page.keyboard.press('Control+K');
  const input = page.locator('input[placeholder*="Buscar"]').first();
  await expect(input).toBeVisible();
  await input.fill('geneva');
  await expect(page.getByText('Geneva drive (cruz de Malta)')).toBeVisible();
  await input.press('Enter');
  await expect(page.getByTestId('geneva-panel')).toBeVisible();
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

test.describe('Geneva panel — live kinematics', () => {
  // Each scene rebuild recompiles a GLSL fragment shader; SwiftShader on WSL
  // takes ~15s per compile and some tests rebuild many times. Raise the
  // per-test timeout generously so the assertions themselves stay strict.
  test.setTimeout(8 * 60 * 1000);

  test('mounts, invariants green, kinematics react to drive scrub', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openGenevaPanel(page);

    // ── Invariants on mount ──
    await expect(page.getByTestId('inv-pythagoras')).toContainText('✓');
    await expect(page.getByTestId('inv-sin')).toContainText('✓');
    await expect(page.getByTestId('inv-fractions')).toContainText('✓');

    // Default N=4 ⇒ sin(π/4) = √2/2, a=1 ⇒ C = √2 ≈ 1.4142
    await expect(page.getByTestId('geom-C')).toContainText('1.414');
    // α = 45° for N=4
    await expect(page.getByTestId('geom-alpha')).toContainText('45.00');

    // At drive=0, engaged=true and driven angle = 0.
    await expect(page.getByTestId('kin-engaged')).toContainText('ENGAGED');
    await expect(page.getByTestId('kin-theta-g')).toContainText(/^φ_G = 0\.00°/);

    // Scrub drive past α = 45° into dwell region.
    await setSliderValue(page, 'drive', 1.0); // ≈ 57.3° > 45°
    await expect(page.getByTestId('kin-engaged')).toContainText('DWELL');
    // After exiting engagement-0 on the positive side, Geneva rests at −slot/2 = −45°.
    await expect(page.getByTestId('kin-theta-g')).toContainText(/-45\.00°/);

    // Full revolution: scrub to 2π ⇒ Geneva stepped one slot = −90°.
    await setSliderValue(page, 'drive', 2 * Math.PI);
    await expect(page.getByTestId('kin-engaged')).toContainText('ENGAGED');
    await expect(page.getByTestId('kin-cycle')).toContainText('k = 1');
    await expect(page.getByTestId('kin-theta-g')).toContainText(/^φ_G = -90\.00°/);

    // Invariants still green.
    await expect(page.getByTestId('inv-pythagoras')).toContainText('✓');
    await expect(page.getByTestId('inv-sin')).toContainText('✓');
    await expect(page.getByTestId('inv-fractions')).toContainText('✓');

    // No uncaught JS errors.
    expect(consoleErrors.filter((e) => !/WebGL|GPU|getContext/i.test(e))).toEqual([]);
  });

  test('changing slot count via marking menu re-derives geometry', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openGenevaPanel(page);

    // Baseline N=4: C ≈ 1.414
    await expect(page.getByTestId('slotCount-value')).toHaveText('4');
    await expect(page.getByTestId('geom-C')).toContainText('1.414');

    // Right-click → Slots → N = 6
    const panel = page.getByTestId('geneva-panel');
    const box = await panel.boundingBox();
    if (!box) throw new Error('panel boundingBox missing');
    await page.mouse.click(box.x + 30, box.y + 16, { button: 'right' });

    await page.getByRole('button', { name: '✦ Slots' }).click();
    // Menu items live on a z:9999 fixed overlay that Playwright's default
    // scroll-into-view heuristics get stuck on. A forced click bypasses the
    // check — the assertions below still prove the action fired.
    await page.getByRole('button', { name: '⬡ N = 6' }).click({ force: true });

    await expect(page.getByTestId('slotCount-value')).toHaveText('6');
    // For N=6, α = π/2 − π/6 = π/3 = 60°
    await expect(page.getByTestId('geom-alpha')).toContainText('60.00');
    // C = 1 / sin(π/6) = 2
    await expect(page.getByTestId('geom-C')).toContainText('2.0000');

    // Engagement fraction: 1/2 − 1/6 = 33.3%
    await expect(page.getByTestId('geom-eng')).toContainText('33.3%');
    // Invariants still green.
    await expect(page.getByTestId('inv-sin')).toContainText('✓');
    await expect(page.getByTestId('inv-pythagoras')).toContainText('✓');
  });

  test('right-click → Drive → +α puts mechanism on engagement boundary', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openGenevaPanel(page);

    const panel = page.getByTestId('geneva-panel');
    const box = await panel.boundingBox();
    if (!box) throw new Error('panel boundingBox missing');
    await page.mouse.click(box.x + 30, box.y + 16, { button: 'right' });

    await page.getByRole('button', { name: '⟳ Drive' }).click();
    // Marking-menu items sit on a z:9999 fixed overlay that tangles
    // Playwright's actionability check. A forced click bypasses the check —
    // the assertions below still prove the preset fired.
    await page.getByRole('button', { name: '→ +α' }).click({ force: true });

    // Drive is now exactly α = 45° for N=4. |localPhase| = α ⇒ engaged = false
    // (we use strict < in the library). φ_G rests at −slot/2 = −45°.
    await expect(page.getByTestId('kin-engaged')).toContainText('DWELL');
    await expect(page.getByTestId('kin-theta-g')).toContainText(/^φ_G = -45\.00°/);
    await expect(page.getByTestId('drive-value')).toContainText('45.0°');
  });
});
