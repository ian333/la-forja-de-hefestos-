/* Playwright test for Math Lab solver+report wiring (runs on iangpu, GPU). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/mathlab-wire';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const errors = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  const report = { steps: [] };

  await page.goto('http://localhost:5002/math.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Select the MATRIX module (Matrix3D) from the sidebar.
  let clickedMatrix = false;
  try {
    const link = page.getByText('Matriz 3×3 como transformación', { exact: false }).first();
    await link.click({ timeout: 8000 });
    clickedMatrix = true;
  } catch (e) {
    // Fallback: hash route
    await page.goto('http://localhost:5002/math.html#linalg/matrix-3d', { waitUntil: 'networkidle' });
    clickedMatrix = 'via-hash';
  }
  report.clickedMatrix = clickedMatrix;

  // Wait for R3F to spin up.
  await page.waitForTimeout(7000);

  // Is there a canvas?
  const canvasCount = await page.locator('canvas').count();
  report.canvasCount = canvasCount;

  // Is there a "Pasos" (∑) tab? Click it so KaTeX steps render alongside the viz.
  let pasosTabFound = false;
  try {
    const pasosTab = page.getByRole('button', { name: /Pasos/ }).first();
    if (await pasosTab.count()) {
      await pasosTab.click({ timeout: 4000 });
      pasosTabFound = true;
      await page.waitForTimeout(1500);
    }
  } catch (e) { report.pasosTabErr = String(e).slice(0, 200); }
  report.pasosTabFound = pasosTabFound;

  // Detect KaTeX rendering in the steps panel.
  const katexCount = await page.locator('.katex').count();
  report.katexCount = katexCount;

  // Text presence of step-ish content.
  const bodyText = await page.locator('body').innerText();
  report.hasDetText = /det\(?A\)?/i.test(bodyText);
  report.hasPasoText = /paso/i.test(bodyText);

  // Export button present?
  let exportBtnFound = false;
  const exportBtn = page.getByRole('button', { name: /Exportar PDF/i }).first();
  if (await exportBtn.count()) exportBtnFound = true;
  report.exportBtnFound = exportBtnFound;

  // Screenshot of the lab with viz + steps visible.
  await page.screenshot({ path: path.join(OUT, 'lab.png'), fullPage: false });

  // Trigger the export flow: open modal, then Descargar PDF -> capture download.
  let pdfSaved = false, pdfErr = null;
  try {
    await exportBtn.click({ timeout: 5000 });
    await page.waitForTimeout(800);
    // Modal screenshot
    await page.screenshot({ path: path.join(OUT, 'modal.png'), fullPage: false });
    const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
    const descargar = page.getByRole('button', { name: /Descargar PDF/i }).first();
    await descargar.click({ timeout: 5000 });
    const download = await downloadPromise;
    const dest = path.join(OUT, 'reporte.pdf');
    await download.saveAs(dest);
    pdfSaved = fs.existsSync(dest) && fs.statSync(dest).size > 0;
    report.pdfSize = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
  } catch (e) {
    pdfErr = String(e).slice(0, 300);
  }
  report.pdfSaved = pdfSaved;
  report.pdfErr = pdfErr;
  report.errors = errors.slice(0, 20);

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
