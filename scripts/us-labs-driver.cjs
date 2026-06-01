#!/usr/bin/env node
/**
 * us-labs-driver.cjs — 10 user stories E2E del flujo "VER → AUTOLLENAR → IMPRIMIR"
 * en los Labs de GAIA (Física, Química/GAIA Lab, Generador de reporte PDF).
 *
 * La visión del fundador: el alumno NO construye nada — solo (1) VE la simulación
 * correcta, (2) sus datos (cajetín del reporte + datos medidos) se RELLENAN solos,
 * (3) IMPRIME / exporta el PDF. Este driver PRUEBA esa experiencia por lab y, sobre
 * todo, busca dentro de cada módulo un affordance de reporte/PDF/imprimir/exportar.
 *
 * Corre EN iangpu (Playwright + GPU ANGLE). Para CADA story:
 *   - context nuevo → goto(BASE+url, domcontentloaded)
 *   - espera ~6s a que monte el R3F / la UI
 *   - ejecuta los pasos de la story (slider, tabs, cargar ejemplo, exportar…)
 *   - busca affordances de reporte ("reporte","imprimir","PDF","exportar","generar")
 *   - SIEMPRE screenshot a /tmp/us-labs/shots/<id>.png (try/catch por story)
 *   - guarda error + lista de affordances encontradas + console errors
 * Al final escribe /tmp/us-labs/report.json: [{id, ok, err, affordances, ...}].
 *
 * Modela el estilo de scripts/us-academico-driver.cjs.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5002';
const OUT = '/tmp/us-labs';
const SHOTS = path.join(OUT, 'shots');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];

// Palabras que delatan un affordance de "reporte / imprimir / exportar".
const REPORT_WORDS = ['reporte', 'imprimir', 'pdf', 'exportar', 'generar', 'descargar', 'informe'];

// ── helpers ──────────────────────────────────────────────────────────────────
async function waitFor(fn, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await fn()) return true; } catch {}
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error('timeout esperando condición');
}

/**
 * Recorre TODOS los clickables de la página (button, a, [role=button], input[type=button/submit])
 * y devuelve los textos visibles que mencionan una palabra de reporte/PDF/imprimir.
 * Es la pieza central: si esto vuelve vacío, NO hay integración sim→reporte en el módulo.
 */
async function scanReportAffordances(page) {
  return await page.evaluate((words) => {
    const out = [];
    const sels = ['button', 'a', '[role="button"]', 'input[type="button"]', 'input[type="submit"]'];
    const nodes = new Set();
    for (const s of sels) document.querySelectorAll(s).forEach((n) => nodes.add(n));
    for (const n of nodes) {
      const txt = ((n.innerText || n.value || n.getAttribute('aria-label') || n.title || '') + '').trim();
      const low = txt.toLowerCase();
      if (!txt) continue;
      if (!words.some((w) => low.includes(w))) continue;
      // ¿visible?
      const r = n.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== 'hidden' && getComputedStyle(n).display !== 'none';
      out.push({ tag: n.tagName.toLowerCase(), text: txt.slice(0, 60), href: n.getAttribute('href') || null, visible });
    }
    // dedupe por (tag+text)
    const seen = new Set();
    return out.filter((o) => { const k = o.tag + '|' + o.text; if (seen.has(k)) return false; seen.add(k); return true; });
  }, REPORT_WORDS);
}

/** Lista corta de TODOS los botones/links visibles (para diagnóstico de qué SÍ hay). */
async function listClickables(page, max = 30) {
  return await page.evaluate((MAX) => {
    const out = [];
    document.querySelectorAll('button, a, [role="button"]').forEach((n) => {
      const txt = ((n.innerText || n.getAttribute('aria-label') || '') + '').trim();
      if (!txt) return;
      const r = n.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      out.push(txt.replace(/\s+/g, ' ').slice(0, 40));
    });
    return Array.from(new Set(out)).slice(0, MAX);
  }, max);
}

async function canvasCount(page) { return await page.locator('canvas').count(); }

/** Mueve el primer <input type=range> visible (slider de T) si existe; devuelve true si lo hizo. */
async function nudgeSlider(page) {
  const slider = page.locator('input[type="range"]').first();
  if ((await slider.count()) === 0) return false;
  try {
    await slider.focus();
    // sube y baja para forzar gas→sólido y de vuelta
    for (let i = 0; i < 12; i++) { await page.keyboard.press('ArrowRight'); }
    await page.waitForTimeout(1500);
    for (let i = 0; i < 12; i++) { await page.keyboard.press('ArrowLeft'); }
    await page.waitForTimeout(1000);
    return true;
  } catch { return false; }
}

/**
 * Ejecuta una story aislada. `fn(page)` corre los pasos específicos.
 * Pase lo que pase: screenshot + escaneo de affordances + registro.
 */
async function story(browser, id, url, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + (e.message || String(e)).slice(0, 200)));

  let ok = true, err = null;
  let affordances = [], clickables = [], canvases = 0, sliderMoved = false, extras = {};
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // esperar a que monte el R3F / la UI
    await page.waitForTimeout(6000);
    const r = (await fn(page)) || {};
    extras = r.extras || {};
    sliderMoved = r.sliderMoved || sliderMoved;
    // escaneo SIEMPRE, tras ejecutar los pasos (algunos affordances aparecen al interactuar)
    canvases = await canvasCount(page);
    affordances = await scanReportAffordances(page);
    clickables = await listClickables(page);
  } catch (e) {
    ok = false;
    err = String((e && e.message) || e).slice(0, 300);
    // aún así intentamos escanear lo que haya
    try { canvases = await canvasCount(page); } catch {}
    try { affordances = await scanReportAffordances(page); } catch {}
    try { clickables = await listClickables(page); } catch {}
  }
  // SIEMPRE screenshot, incluso si falló.
  try {
    await page.screenshot({ path: path.join(SHOTS, `${id}.png`), fullPage: false, timeout: 30000 });
  } catch (e) {
    if (!err) err = 'screenshot falló: ' + String((e && e.message) || e).slice(0, 120);
  }
  const hasReport = affordances.some((a) => a.visible);
  results.push({ id, ok, err, url, canvases, sliderMoved, hasReportAffordance: hasReport, affordances, clickables, consoleErrors: consoleErrors.slice(0, 8), extras });
  console.log(`  ${ok ? 'OK ' : 'XX '} ${id}  canvas=${canvases} report=${hasReport ? 'SÍ' : 'no'}${err ? '  («' + err + '»)' : ''}${consoleErrors.length ? '  [errs:' + consoleErrors.length + ']' : ''}`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox', '--ignore-gpu-blocklist'],
  });

  // ── US01 — Gas ideal: ver la nube reaccionar a T + buscar reporte ──────────
  await story(browser, 'US01', '/physics.html#thermo/ideal-gas', async (page) => {
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 });
    const sliderMoved = await nudgeSlider(page);
    await page.waitForTimeout(1500);
    return { sliderMoved };
  });

  // ── US02 — Generador de reporte (Caída libre ejemplo): cargar + exportar ────
  await story(browser, 'US02', '/reporte.html', async (page) => {
    const extras = {};
    // Cargar ejemplo
    const cargar = page.getByRole('button', { name: /Cargar ejemplo/i }).first();
    if ((await cargar.count()) > 0) { await cargar.click(); extras.cargarEjemplo = true; await page.waitForTimeout(1200); }
    else extras.cargarEjemplo = false;
    // Intentar capturar la descarga del PDF
    let downloadName = null;
    const exportar = page.getByRole('button', { name: /Exportar PDF/i }).first();
    if ((await exportar.count()) > 0) {
      const dlPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
      await exportar.click();
      const dl = await dlPromise;
      if (dl) downloadName = dl.suggestedFilename();
      extras.exportarPDF = true;
      extras.downloadName = downloadName;
      await page.waitForTimeout(800);
    } else extras.exportarPDF = false;
    return { extras };
  });

  // ── US03 — Péndulo doble: ver el caos + buscar reporte de energía ──────────
  await story(browser, 'US03', '/physics.html#mech/double-pendulum', async (page) => {
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(6000); // dejar correr el caos
    return {};
  });

  // ── US04 — Campos EM (Coulomb/Biot-Savart): ver la sonda + buscar reporte ──
  await story(browser, 'US04', '/physics.html#em/fields', async (page) => {
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 });
    const sliderMoved = await nudgeSlider(page);
    await page.waitForTimeout(2000);
    return { sliderMoved };
  });

  // ── US05 — Schwarzschild: precesión del perihelio + buscar reporte ─────────
  await story(browser, 'US05', '/physics.html#astro/schwarzschild', async (page) => {
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(6000);
    return {};
  });

  // ── US06 — GAIA Lab tab Átomo: nube ψ² + buscar reporte ────────────────────
  await story(browser, 'US06', '/lab.html', async (page) => {
    const extras = {};
    // arranca en tab Átomo (Carbono). Confirmamos botón ψ Átomo.
    const atomTab = page.getByRole('button', { name: /Átomo/i }).first();
    if ((await atomTab.count()) > 0) { await atomTab.click(); extras.atomTab = true; }
    await page.waitForTimeout(1500);
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 });
    // tocar otro elemento en la tabla periódica (ej. Oxígeno) si existe el dock
    const oxy = page.getByText(/^O$/).first();
    if ((await oxy.count()) > 0) { try { await oxy.click({ timeout: 2000 }); extras.toqueElemento = true; } catch {} }
    await page.waitForTimeout(3000);
    return { extras };
  });

  // ── US07 — GAIA Lab tab Enlace: Morse/MOs + buscar reporte ─────────────────
  await story(browser, 'US07', '/lab.html', async (page) => {
    const extras = {};
    const bondTab = page.getByRole('button', { name: /Enlace/i }).first();
    if ((await bondTab.count()) > 0) { await bondTab.click(); extras.bondTab = true; }
    else extras.bondTab = false;
    await page.waitForTimeout(2000);
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    // mover el slider de distancia r si existe
    const sliderMoved = await nudgeSlider(page);
    await page.waitForTimeout(2000);
    return { sliderMoved, extras };
  });

  // ── US08 — Moléculas diatómicas GPU: subir T hasta romper enlaces ──────────
  await story(browser, 'US08', '/physics.html#chem/molecule-gpu', async (page) => {
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 });
    const sliderMoved = await nudgeSlider(page);
    await page.waitForTimeout(2000);
    return { sliderMoved };
  });

  // ── US09 — Multi-escala átomos↔continuum: ver el coarse-graining ───────────
  await story(browser, 'US09', '/physics.html#chem/multi-scale', async (page) => {
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(5000);
    return {};
  });

  // ── US10 — Límite de escala σ_T/⟨T⟩ vs N: la gráfica log-log ───────────────
  await story(browser, 'US10', '/physics.html#chem/scale-limit', async (page) => {
    // este módulo produce gráfica+tabla; puede tardar (corre varias sims)
    await page.waitForTimeout(8000);
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    return {};
  });

  await browser.close();

  const ranOK = results.filter((r) => r.ok).length;
  const withReport = results.filter((r) => r.hasReportAffordance).length;
  fs.writeFileSync(
    path.join(OUT, 'report.json'),
    JSON.stringify(
      { when: new Date().toISOString(), base: BASE, total: results.length, ranOK, withReportAffordance: withReport,
        results: results.map((r) => ({ id: r.id, ok: r.ok, err: r.err, url: r.url, canvases: r.canvases, sliderMoved: r.sliderMoved, hasReportAffordance: r.hasReportAffordance, affordances: r.affordances, clickables: r.clickables, consoleErrors: r.consoleErrors, extras: r.extras })) },
      null, 2,
    ),
  );
  console.log(`\n══ ${ranOK}/${results.length} stories corrieron sin throw · ${withReport}/${results.length} con affordance de reporte en el módulo ══`);
  // El driver "corrió bien" si pudo ejecutar todas las stories (no es un pass/fail de la US).
  process.exit(0);
})().catch((e) => {
  console.error('DRIVER FATAL:', (e && e.message) || e);
  try { fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ fatal: String((e && e.message) || e), results }, null, 2)); } catch {}
  process.exit(2);
});
