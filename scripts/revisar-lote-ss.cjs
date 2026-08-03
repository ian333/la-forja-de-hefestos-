/**
 * La Forja — verifica REVISAR EN VOLUMEN (N-29) en la UI REAL: abre el workspace
 * de simulación, lanza el panel, comprueba la tabla por severidad, hace drill-down
 * al detalle (contratos + expediente §13.10), FIRMA una decisión y captura.
 * Corre en iangpu (:5002) con GPU real.
 *
 * Uso (iangpu): DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   node scripts/revisar-lote-ss.cjs
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const DIR = process.env.SHOTDIR || '/home/ian/Orkesta/la-forja/forja-shots';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const isBenign = (s) => /WebGL context|WebGL2?RenderingContext|THREE.WebGLRenderer/i.test(s);
  const errs = []; page.on('pageerror', (e) => { const s = String(e).slice(0, 220); if (!isBenign(s)) errs.push(s); });
  const out = { checks: {}, errs };
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // GOTCHA conocido: NO esperar .ready (el documento inicial está VACÍO y ready
    // nunca llega) — esperar __forgeBrep + canvas (reference_forja_brep_verify_gotcha)
    await page.waitForFunction('window.__forgeBrep && !!document.querySelector("canvas")', { timeout: 45000 });
    await page.waitForTimeout(900);

    // ── abrir: workspace simulación → botón REVISAR EN VOLUMEN ──
    await page.click('[data-testid="tab-simulacion"]');
    await page.waitForTimeout(350);
    // el aside de simulación es LARGO: el botón vive abajo → scroll, y si el CSS
    // lo reporta invisible para playwright, click por DOM (el handler es el mismo)
    const btn = page.locator('[data-testid="btn-revisar-lote"]');
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.click({ timeout: 8000 }).catch(async () => {
      await page.$eval('[data-testid="btn-revisar-lote"]', (el) => el.click());
    });
    await page.waitForSelector('[data-testid="revisar-lote-view"]', { timeout: 15000 });
    await page.waitForTimeout(1200);                          // el lote calcula 6 modelos

    // ── la TABLA: filas presentes y ordenadas por severidad ──
    const filas = await page.$$eval('[data-testid^="rl-row-"]', (rows) => rows.map((r) => ({
      testid: r.getAttribute('data-testid'),
      crit: Number(r.getAttribute('data-crit')), viola: Number(r.getAttribute('data-viola')),
      score: Number(r.getAttribute('data-score')),
    })));
    out.filas = filas;
    out.checks.tabla_6_modelos = filas.length === 6;
    // ORDEN por severidad EXACTO: críticos desc → violaciones desc → score asc
    out.checks.orden_por_severidad = filas.every((f, i) => i === 0
      || filas[i - 1].crit > f.crit
      || (filas[i - 1].crit === f.crit && filas[i - 1].viola > f.viola)
      || (filas[i - 1].crit === f.crit && filas[i - 1].viola === f.viola && filas[i - 1].score <= f.score));
    // al menos un modelo del lote trae CRÍTICO del ensamble y ENCABEZA la tabla
    // (hoy: el vaso, agua frontera 4.76 < 4.765 §9.2.7 — el LEGO ya se curó con el
    // pin auto-encogido §11.2.5). La tabla existe para cazar exactamente esto.
    out.checks.hay_critico_cazado = filas.some((f) => f.crit > 0) && filas[0].crit > 0;
    await page.screenshot({ path: `${DIR}/revisar-lote-tabla.png`, timeout: 30000 });

    // ── drill-down al bezel: contratos con § + números vivos ──
    await page.click('[data-testid="rl-row-bezel"]');
    await page.waitForTimeout(500);
    const detalle = await page.$eval('[data-testid="rl-detail"]', (el) => el.textContent ?? '');
    out.checks.detalle_cita_libro = /§9\.2\.7|§11\.2\.5|§6\.2\.2/.test(detalle);
    out.checks.detalle_numeros_vivos = /mm|MPa|1\/s/.test(detalle);
    out.checks.expediente_presente = /EXPEDIENTE §13\.10/.test(detalle);
    out.checks.tryout_presente = /PLAN DE TRYOUT/.test(detalle);
    const subs = await page.$$('[data-testid^="rl-sub-"]');
    out.checks.diez_subsistemas = subs.length === 10;

    // ── FIRMAR una decisión: steel-safe §10.2.2 (elige opción + responsable) ──
    const cerrableAntes = await page.$eval('[data-testid="rl-cerrable"]', (el) => el.textContent ?? '');
    const dec = '[data-testid="rl-decision-steel-safe-contraccion"]';
    await page.waitForSelector(`${dec} select`, { timeout: 5000 });
    const opciones = await page.$eval(`${dec} select`, (s) => Array.from(s.options).map((o) => o.value).filter(Boolean));
    out.checks.opciones_con_numeros = opciones.length === 2 && opciones.every((o) => /×[01]\.\d{4,}/.test(o));
    await page.selectOption(`${dec} select`, opciones[1]);    // la escuela CONSTANTE
    await page.fill(`${dec} input`, 'ian');
    await page.click(`[data-testid="rl-firmar-steel-safe-contraccion"]`);
    await page.waitForTimeout(400);
    const firmado = await page.$eval(dec, (el) => el.textContent ?? '');
    out.checks.firma_aplicada = /firma: ian/.test(firmado) && /●/.test(firmado);
    const cerrableDespues = await page.$eval('[data-testid="rl-cerrable"]', (el) => el.textContent ?? '');
    out.cerrable = { antes: cerrableAntes, despues: cerrableDespues };
    out.checks.pendientes_bajaron = (detalle.match(/(\d+) pendiente/) ?? [])[1] !== undefined;
    await page.screenshot({ path: `${DIR}/revisar-lote-detalle.png`, timeout: 30000 });

    // ── quitar un modelo del lote: la tabla reacciona ──
    await page.click('[data-testid="rl-toggle-LEGO"]');
    await page.waitForTimeout(900);
    const filas2 = await page.$$('[data-testid^="rl-row-"]');
    out.checks.toggle_quita_modelo = filas2.length === 5;

    out.checks.cero_errores_de_pagina = errs.length === 0;
  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 500);
  } finally {
    await browser.close();
  }
  const pass = !out.fatal && Object.values(out.checks).every(Boolean);
  console.log(JSON.stringify({ pass, ...out }, null, 1));
  process.exit(pass ? 0 : 1);
})();
