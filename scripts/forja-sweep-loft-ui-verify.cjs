/**
 * La Forja — Verificación de UI: LOFT y SWEEP por CLICS reales.
 * =============================================================
 * Las features nuevas se prueban como las usa el humano: clic en el botón de la
 * barra, leer los invariantes que expone window.__forgeBrep. No llama al kernel
 * directo (eso lo cubre occt-sweep-loft-test.cjs con analítico exacto).
 *
 *   LOFT  · clic btn-loft  → op 'loft' en el árbol, sólido válido (Euler=2, V>0)
 *   SWEEP · clic btn-sweep → op 'sweep', sólido válido; prueba codo/recta/hélice
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
           '--use-gl=angle', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + String(e).slice(0, 160)));

  const out = { url: URL, steps: {}, checks: {}, errors: [] };
  const inv = () => page.evaluate('window.__forgeBrep.invariants');
  const ready = async () => {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
  };
  const waitOp = (op) => page.waitForFunction(
    `window.__forgeBrep.invariants && window.__forgeBrep.invariants.ops.includes('${op}') && !window.__forgeBrep.invariants.error`,
    { timeout: 20000 });

  try {
    // ── LOFT ──
    await ready();
    await page.click('[data-testid="btn-loft"]');
    await waitOp('loft');
    await page.waitForTimeout(800);
    const loft = await inv();
    out.steps.loft = { vol: loft.vol_kernel, euler: loft.euler, faces: loft.n_faces, ops: loft.ops, err: loft.error || null };

    // ── SWEEP · codo (default) ──
    await ready();
    await page.click('[data-testid="btn-sweep"]');
    await waitOp('sweep');
    await page.waitForTimeout(800);
    const sweepArc = await inv();
    out.steps.sweep_arc = { vol: sweepArc.vol_kernel, euler: sweepArc.euler, faces: sweepArc.n_faces, err: sweepArc.error || null };

    // ── SWEEP · recta (clic en el segmento "Recta") ──
    await page.click('[data-testid="sweep-line"]');
    await page.waitForTimeout(1000);
    const sweepLine = await inv();
    out.steps.sweep_line = { vol: sweepLine.vol_kernel, euler: sweepLine.euler, err: sweepLine.error || null };

    // ── SWEEP · hélice (resorte) ──
    await page.click('[data-testid="sweep-helix"]');
    await page.waitForTimeout(1400);
    const sweepHelix = await inv();
    out.steps.sweep_helix = { vol: sweepHelix.vol_kernel, euler: sweepHelix.euler, faces: sweepHelix.n_faces, err: sweepHelix.error || null };

    out.checks = {
      loft_solid_valid: loft.euler === 2 && loft.vol_kernel > 100 && !loft.error,
      loft_op_present: loft.ops.includes('loft'),
      sweep_arc_valid: sweepArc.vol_kernel > 100 && Number.isFinite(sweepArc.euler) && !sweepArc.error,
      sweep_line_valid: sweepLine.vol_kernel > 100 && sweepLine.euler === 2 && !sweepLine.error,
      sweep_helix_valid: sweepHelix.vol_kernel > 100 && Number.isFinite(sweepHelix.euler) && !sweepHelix.error,
      // El resorte auto-dimensionado NO debe quedar igual al barrido recto: eso
      // probaría que la hélice no reconstruyó (resultado obsoleto silencioso).
      sweep_helix_rebuilt: Math.abs(sweepHelix.vol_kernel - sweepLine.vol_kernel) > sweepLine.vol_kernel * 0.5,
      no_fatal_errors: errors.filter((e) => /Cannot read|undefined is not|TypeError/.test(e)).length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
    out.errors = errors.slice(0, 6);
  } catch (e) {
    out.pass = false;
    out.fatal = String((e && e.stack) || e).slice(0, 400);
    out.errors = errors.slice(0, 6);
  } finally {
    await browser.close();
  }
  console.log('SWEEP_LOFT_UI=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
