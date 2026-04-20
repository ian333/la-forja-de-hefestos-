/**
 * ⚒️ Gear Pair — End-to-End (Playwright)
 * ========================================
 * Drives a real Chromium instance through the whole user flow:
 *   1. Boot the app.
 *   2. Open omnibar (Ctrl+K).
 *   3. Type "engrane" and press Enter → triggers `part-gear-pair` action.
 *   4. Wait for `[data-testid="gear-pair-panel"]`.
 *   5. Assert the three invariant rows are green (start with ✓).
 *   6. Change Z₁ via the slider and assert value + invariants re-render.
 *   7. Scrub the drive angle and assert θ₂ changes.
 *
 * This is the human-equivalent verification the invariant unit tests
 * cannot provide: the panel actually mounts, sliders actually fire
 * onChange, the store actually updates, and the scene re-renders.
 */
import { test, expect, type Page } from '@playwright/test';

async function openGearPairPanel(page: Page) {
  // Omnibar needs focus on the window — use keyboard shortcut.
  await page.keyboard.press('Control+K');
  const input = page.locator('input[placeholder*="Buscar"]').first();
  await expect(input).toBeVisible();
  await input.fill('engrane');
  // Wait for the gear-pair result to appear in the list, then Enter.
  await expect(page.getByText('Par de engranes')).toBeVisible();
  await input.press('Enter');
  await expect(page.getByTestId('gear-pair-panel')).toBeVisible();
}

async function setSliderValue(page: Page, testid: string, value: number) {
  // range inputs: programmatic set + dispatch 'input' and 'change' events
  // mirrors what React sees from a real user drag.
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

test.describe('Gear pair panel — live parametric edit', () => {
  test('mounts from omnibar, invariants green, slider drives re-render', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    await page.goto('/');
    // Canvas must be present — proves the viewport mounted.
    await expect(page.locator('canvas').first()).toBeVisible();

    await openGearPairPanel(page);

    // ── Invariants are live and green on mount ──
    const panel = page.getByTestId('gear-pair-panel');
    await expect(page.getByTestId('inv-ratio')).toContainText('✓');
    await expect(page.getByTestId('inv-center')).toContainText('✓');
    await expect(page.getByTestId('inv-contact')).toContainText('✓');

    // ── Read initial teeth1, bump it, verify the DOM reacts ──
    const teeth1Value = page.getByTestId('teeth1-value');
    const initial = (await teeth1Value.innerText()).trim();
    expect(initial).toBe('20');

    await setSliderValue(page, 'teeth1', 30);
    await expect(teeth1Value).toHaveText('30');

    // Ratio should now be 30/40 = 0.75000; center distance 35.
    await expect(page.getByTestId('inv-ratio')).toContainText('0.75000');
    await expect(page.getByTestId('inv-center')).toContainText('35');

    // ── Drive angle sweeps → θ₂ must change ──
    const theta2Row = page.getByTestId('inv-theta2');
    const theta2Before = await theta2Row.innerText();
    await setSliderValue(page, 'drive', 1.5);
    await expect(theta2Row).not.toHaveText(theta2Before);

    // ── Invariants still green after edits ──
    await expect(page.getByTestId('inv-ratio')).toContainText('✓');
    await expect(page.getByTestId('inv-center')).toContainText('✓');
    await expect(page.getByTestId('inv-contact')).toContainText('✓');
    void panel;

    // ── No uncaught JS errors during the whole flow ──
    expect(consoleErrors.filter((e) => !/WebGL|GPU|getContext/i.test(e))).toEqual([]);
  });

  test('module + pressure angle edits keep invariants valid', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openGearPairPanel(page);

    await setSliderValue(page, 'module', 2.5);
    await expect(page.getByTestId('module-value')).toHaveText('2.500');

    await setSliderValue(page, 'pressureAngle', (25 * Math.PI) / 180);
    await expect(page.getByTestId('pressureAngle-value')).toContainText('25');

    await expect(page.getByTestId('inv-ratio')).toContainText('✓');
    await expect(page.getByTestId('inv-center')).toContainText('✓');
    await expect(page.getByTestId('inv-contact')).toContainText('✓');
  });
});

// ─────────────────────────────────────────────────────────────
// Mouse-parity flow: right-click → marking menu → drill → click
// ─────────────────────────────────────────────────────────────
test.describe('Gear pair — marking menu (mouse parity)', () => {
  test('right-click opens radial menu; drill into Chaflán applies fillet', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openGearPairPanel(page);

    // Baseline: fillet is 0.000.
    await expect(page.getByTestId('filletRadius-value')).toHaveText('0.000');

    // Real right-click on the panel header area.
    const panel = page.getByTestId('gear-pair-panel');
    const box = await panel.boundingBox();
    if (!box) throw new Error('panel boundingBox missing');
    await page.mouse.click(box.x + 30, box.y + 16, { button: 'right' });

    // Radial hub mounts → "Chaflán" section button visible.
    await expect(page.getByText('Chaflán')).toBeVisible();
    // Click the category → drills into sub-items.
    await page.getByText('Chaflán').click();
    // Sub-item "Tip 0.2·m" now visible in the drilled menu.
    await expect(page.getByText('Tip 0.2·m')).toBeVisible();
    await page.getByText('Tip 0.2·m').click();

    // module=1.0 and coef=0.2 ⇒ filletRadius = 0.2.
    await expect(page.getByTestId('filletRadius-value')).toHaveText('0.200');

    // Invariants must still be green — fillet is purely cosmetic.
    await expect(page.getByTestId('inv-ratio')).toContainText('✓');
    await expect(page.getByTestId('inv-contact')).toContainText('✓');
  });

  test('material selection & weight optimizer: click buttons, assert live', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openGearPairPanel(page);

    // Read default sigma_y (acero 1045 → ~530 MPa).
    await expect(page.getByTestId('mech-sigmay')).toContainText('Acero');

    // Click the Ti-6Al-4V material button (real click, not state poke).
    await page.getByTestId('material-titanio_ti6al4v').click();
    await expect(page.getByTestId('mech-sigmay')).toContainText(/Ti|titanio/i);

    // Back to steel for optimizer baseline.
    await page.getByTestId('material-acero_1045').click();

    // Baseline has zero lightening.
    await expect(page.getByTestId('lighteningHoles-value')).toHaveText('0');
    await expect(page.getByTestId('mech-savings')).toContainText('0.0%');

    // Click "Optimizar peso" → real button click.
    await page.getByTestId('optimize-weight').click();

    // Optimizer should have found N ≥ 3 holes with some savings.
    const holesTxt = await page.getByTestId('lighteningHoles-value').innerText();
    expect(Number(holesTxt.trim())).toBeGreaterThanOrEqual(3);
    const savingsTxt = await page.getByTestId('mech-savings').innerText();
    const savingsPct = Number(savingsTxt.match(/([\d.]+)%/)?.[1] ?? '0');
    expect(savingsPct).toBeGreaterThan(0);

    // Safety factor must still be green after lightening.
    await expect(page.getByTestId('mech-sf')).toContainText('✓');
  });

  test('right-click Peso → Reset zeroes lightening holes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas').first()).toBeVisible();
    await openGearPairPanel(page);

    // Seed a non-zero lightening via the optimizer button.
    await page.getByTestId('optimize-weight').click();
    const seeded = Number(
      (await page.getByTestId('lighteningHoles-value').innerText()).trim(),
    );
    expect(seeded).toBeGreaterThanOrEqual(3);

    // Right-click → marking menu → Peso → Reset.
    const panel = page.getByTestId('gear-pair-panel');
    const box = await panel.boundingBox();
    if (!box) throw new Error('panel boundingBox missing');
    await page.mouse.click(box.x + 30, box.y + 16, { button: 'right' });

    await page.getByText('Peso', { exact: true }).click();
    await page.getByText('Reset', { exact: true }).click();

    await expect(page.getByTestId('lighteningHoles-value')).toHaveText('0');
    await expect(page.getByTestId('mech-savings')).toContainText('0.0%');
  });
});
