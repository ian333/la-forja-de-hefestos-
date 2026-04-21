#!/usr/bin/env node
/**
 * Generic per-preset visual audit. Runs one module, clicks through each preset,
 * screenshots the canvas viewport after a fixed settle time.
 *
 *   node scripts/screenshots-presets.cjs <module-slug>
 *
 * where <module-slug> ∈ { pendulum, solar, schwarzschild, em-fields }.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const TARGETS = {
  pendulum: {
    branchId: 'mech',
    moduleId: 'double-pendulum',
    presets: ['classic', 'small-angle', 'heavy-outer', 'long-inner'],
    settleMs: 3500,
  },
  solar: {
    branchId: 'astro',
    moduleId: 'solar-system',
    presets: ['sun-earth', 'sun-earth-moon', 'inner', 'full', 'binary', 'figure-8'],
    settleMs: 5000,
  },
  schwarzschild: {
    branchId: 'astro',
    moduleId: 'schwarzschild',
    presets: ['mercury', 'mercury-exagerado', 'sirius', 'close-bh'],
    settleMs: 4000,
  },
  'em-fields': {
    branchId: 'em',
    moduleId: 'fields',
    presets: ['dipole', 'capacitor', 'wire', 'cyclotron'],
    settleMs: 3500,
  },
  'double-helix': {
    branchId: 'bio',
    moduleId: 'double-helix',
    presets: ['synthetic', 'telomere', 'tata', 'brca1'],
    settleMs: 2500,
  },
  'protein-viewer': {
    branchId: 'bio',
    moduleId: 'protein-viewer',
    presets: ['ubiquitin', 'crambin', 'hemoglobin', 'hiv-protease'],
    settleMs: 5000, // PDB download + parse + render
  },
  docking: {
    branchId: 'bio',
    moduleId: 'docking',
    // Docking has no preset buttons — it's a single interactive scene. Capture
    // one shot after load + settle.
    presets: [],
    settleMs: 5000,
  },
  'central-dogma': {
    branchId: 'bio',
    moduleId: 'central-dogma',
    presets: ['synth', 'insulin-b', 'tp53-r175', 'brca1'],
    settleMs: 9000,
  },
  scales: {
    branchId: 'bio',
    moduleId: 'scales',
    presets: ['cell', 'nucleus', 'chromosome', 'chromatin', 'nucleosome', 'helix', 'basepair'],
    settleMs: 2500,
  },
  'atom-to-bond': {
    branchId: 'bio',
    moduleId: 'atom-to-bond',
    presets: ['equilibrium', 'compressed', 'stretched', 'dissociated'],
    settleMs: 2500,
  },
};

const slug = process.argv[2];
if (!slug || !TARGETS[slug]) {
  console.error(`usage: node scripts/screenshots-presets.cjs <${Object.keys(TARGETS).join('|')}>`);
  process.exit(1);
}
const target = TARGETS[slug];
const OUT = `/tmp/physics-screenshots/${slug}`;
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5001/physics.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Open module
  if ((await page.locator(`[data-testid="module-${target.moduleId}"]`).count()) === 0) {
    await page.locator(`[data-testid="branch-${target.branchId}"]`).click();
    await page.waitForTimeout(200);
  }
  await page.locator(`[data-testid="module-${target.moduleId}"]`).click();
  await page.waitForFunction(
    () => !document.body.innerText.includes('compilando') && !!document.querySelector('canvas'),
    { timeout: 15000 },
  );

  if (target.presets.length === 0) {
    // No presets — it's a single interactive scene. Just let it settle and shoot.
    await page.waitForTimeout(target.settleMs);
    const shot = path.join(OUT, `default.png`);
    await page.screenshot({ path: shot, clip: { x: 280, y: 62, width: 1178, height: 1038 }, animations: 'disabled', timeout: 60000 });
    console.log(`[shot] ${slug}/default`);
  } else {
    for (const pid of target.presets) {
      const btn = page.locator(`[data-testid="preset-${pid}"]`);
      if ((await btn.count()) === 0) {
        console.log(`[miss] preset-${pid} not found`);
        continue;
      }
      // Heavy scenes (large PDBs, instanced meshes, active useFrame loops) can
      // keep the render loop busy enough that Playwright's button-stability /
      // scroll-into-view checks never resolve. Dispatch a synthetic click via
      // the DOM to sidestep actionability entirely.
      await page.evaluate((id) => {
        const el = document.querySelector(`[data-testid="preset-${id}"]`);
        if (el) (el).click();
      }, pid);
      await page.waitForTimeout(target.settleMs);
      const shot = path.join(OUT, `${pid}.png`);
      await page.screenshot({ path: shot, clip: { x: 280, y: 62, width: 1178, height: 1038 }, animations: 'disabled', timeout: 60000 });
      console.log(`[shot] ${slug}/${pid}`);
    }
  }

  await browser.close();
  if (logs.length) {
    console.log('\n--- console issues ---');
    for (const l of logs.slice(0, 40)) console.log(l);
  } else {
    console.log('\n(no console issues)');
  }
})();
