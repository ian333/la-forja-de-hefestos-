#!/usr/bin/env node
/**
 * us-cad-driver.cjs — Driver de USER STORIES para el CAD Hefestos (F-Rep).
 * Corre EN iangpu (GPU real, ANGLE). Recorre las 10 historias de usuario de
 * Diana (US01..US10), una por context limpio, ejecuta sus pasos y SIEMPRE
 * deja screenshot en /tmp/us-cad/shots/<id>.png. Captura console errors y lee
 * el status bar (nodos / cm³ / FPS / vars) cuando aplica.
 *
 *   cd ~/Orkesta/la-forja && node scripts/us-cad-driver.cjs
 *
 * Salida: /tmp/us-cad/shots/*.png  +  /tmp/us-cad/report.json
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:5002';
const URL = `${BASE}/cad.html`;
const OUT = '/tmp/us-cad';
const SHOTS = path.join(OUT, 'shots');
const MOUNT_WAIT = 6500; // ray-march monta con setTimeout(50) + worker 'medium'

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

const report = [];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });

  // ── helpers que reciben page ──
  const readStatus = (page) => page.evaluate(() => {
    const t = document.body.innerText || '';
    const m = (re) => { const x = t.match(re); return x ? x[1] : null; };
    return {
      nodos: m(/(\d+)\s*nodos/),
      vars: m(/(\d+)\s*vars/),
      cm3: m(/([\d.]+)\s*cm³/),
      fps: m(/(\d+)\s*FPS/),
      gpuRayMarch: /GPU Ray March/.test(t),
      hefestos: /HEFESTOS/.test(t) || /Hefestos/.test(t),
    };
  });
  const center = async (page) => {
    const c = await page.$('canvas');
    if (!c) throw new Error('sin canvas');
    const b = await c.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
  };

  // Corre UNA historia en su propio context.
  // body(page, ctx) ejecuta los pasos; puede tirar — se atrapa por historia.
  const story = async (id, body) => {
    const context = await browser.newContext({ viewport: { width: 1680, height: 1000 } });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push('[pageerror] ' + String(e.message || e).slice(0, 280)));
    page.on('console', m => {
      if (m.type() === 'error') { const t = m.text(); if (t && t.length < 400) consoleErrors.push('[console.error] ' + t); }
    });

    let ok = true;
    let err = null;
    let status = null;
    let extra = null;
    try {
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(MOUNT_WAIT);
      extra = await body(page, { readStatus, center });
      status = await readStatus(page);
    } catch (e) {
      ok = false;
      err = String(e && (e.message || e)).slice(0, 300);
      try { status = await readStatus(page); } catch (_) {}
    }
    // SIEMPRE screenshot
    try {
      await page.screenshot({ path: path.join(SHOTS, `${id}.png`) });
    } catch (e) {
      if (!err) err = 'screenshot-failed: ' + String(e.message || e).slice(0, 120);
    }
    const entry = { id, ok, err, status, consoleErrors: consoleErrors.slice(0, 12) };
    if (extra && typeof extra === 'object') entry.notes = extra;
    report.push(entry);
    console.log(`  · ${id} ${ok ? 'OK ' : 'ERR'} nodos:${status ? status.nodos : '?'} cm³:${status ? status.cm3 : '?'} fps:${status ? status.fps : '?'}${consoleErrors.length ? ' [' + consoleErrors.length + ' console-err]' : ''}${err ? ' :: ' + err : ''}`);
    await context.close();
  };

  // ════════════════════════════════════════════════════════════
  // US01 — Abrir Hefestos y ver la pieza de muestra en 3D
  // ════════════════════════════════════════════════════════════
  await story('US01', async (page, h) => {
    const st = await h.readStatus(page);
    const canvas = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      let webgl = false;
      try { const gl = c && (c.getContext('webgl2') || c.getContext('webgl')); webgl = !!gl; } catch (_) {}
      return { hasCanvas: !!c, w: c ? c.width : 0, h: c ? c.height : 0, webgl };
    });
    // ModuleErrorBoundary usaría el acento #FDB813; detectar pantalla gris muerta
    const bodyText = await page.evaluate(() => (document.body.innerText || '').slice(0, 300));
    return { hasCanvas: canvas.hasCanvas, canvasSize: `${canvas.w}x${canvas.h}`, webgl: canvas.webgl,
             gpuRayMarch: st.gpuRayMarch, hefestos: st.hefestos, bodyHasError: /error|Error/.test(bodyText) };
  });

  // ════════════════════════════════════════════════════════════
  // US02 — Buscar la paleta / abrir SOLID > Create
  // ════════════════════════════════════════════════════════════
  await story('US02', async (page) => {
    const labels = await page.evaluate(() => {
      const wanted = ['SKETCH', 'SOLID', 'SURFACE', 'METAL', 'CONSTRUCT', 'INSPECT', 'INSERT', 'ASSEMBLE'];
      const txt = document.body.innerText || '';
      return wanted.filter(w => txt.includes(w));
    });
    // Abrir SOLID
    try { await page.getByText('SOLID', { exact: true }).first().click({ timeout: 4000 }); } catch (_) {}
    await page.waitForTimeout(500);
    // Expandir submenu Create (sub-trigger)
    let createOpened = false;
    try {
      await page.getByText('Create', { exact: false }).first().hover({ timeout: 3000 });
      await page.waitForTimeout(600);
      createOpened = true;
    } catch (_) {}
    // Inspeccionar items disabled vs activos
    const items = await page.evaluate(() => {
      const out = {};
      document.querySelectorAll('[role="menuitem"]').forEach(el => {
        const label = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!label) return;
        const disabled = el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled') || el.getAttribute('data-disabled') !== null;
        out[label] = disabled ? 'disabled' : 'active';
      });
      return out;
    });
    return { menuLabels: labels, createOpened, menuItems: items };
  });

  // ════════════════════════════════════════════════════════════
  // US03 — Orbitar la cámara
  // ════════════════════════════════════════════════════════════
  await story('US03', async (page, h) => {
    const c = await h.center(page);
    // Orbitar 180°-ish con drag
    await page.mouse.move(c.x, c.y); await page.mouse.down();
    await page.mouse.move(c.x + 320, c.y + 40, { steps: 24 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    // Zoom con rueda
    await page.mouse.move(c.x, c.y); await page.mouse.wheel(0, -400);
    await page.waitForTimeout(300);
    // Vistas estándar por teclado: F1 (front) luego F4 (iso) y Home
    await page.keyboard.press('F1'); await page.waitForTimeout(700);
    await page.keyboard.press('F4'); await page.waitForTimeout(700);
    await page.keyboard.press('Home'); await page.waitForTimeout(700);
    return { orbited: true };
  });

  // ════════════════════════════════════════════════════════════
  // US04 — Crear una primitiva (caja) por atajo '1'
  // ════════════════════════════════════════════════════════════
  await story('US04', async (page, h) => {
    const before = await h.readStatus(page);
    // Focus al viewport (fuera de inputs) y crear caja
    try { await page.locator('canvas').click({ position: { x: 60, y: 60 }, timeout: 3000 }); } catch (_) {}
    await page.keyboard.press('1');
    await page.waitForTimeout(2000); // remesh 'medium'
    const after = await h.readStatus(page);
    // Abrir árbol (hover sidebar izquierda) para ver el nodo nuevo
    try {
      await page.mouse.move(24, 500);
      await page.waitForTimeout(600);
    } catch (_) {}
    const nodosUp = (parseInt(after.nodos) || 0) > (parseInt(before.nodos) || 0);
    const varsUp = (parseInt(after.vars) || 0) > (parseInt(before.vars) || 0);
    return { nodosBefore: before.nodos, nodosAfter: after.nodos, nodosUp,
             varsBefore: before.vars, varsAfter: after.vars, varsUp, fpsAfter: after.fps };
  });

  // ════════════════════════════════════════════════════════════
  // US05 — Resta booleana entre caja y cilindro
  // ════════════════════════════════════════════════════════════
  await story('US05', async (page, h) => {
    try { await page.locator('canvas').click({ position: { x: 60, y: 60 }, timeout: 3000 }); } catch (_) {}
    const before = await h.readStatus(page);
    await page.keyboard.press('1'); await page.waitForTimeout(1200); // box
    await page.keyboard.press('3'); await page.waitForTimeout(1200); // cylinder
    const mid = await h.readStatus(page);
    // SOLID > Boolean > Subtract
    let menuPath = false;
    try {
      await page.getByText('SOLID', { exact: true }).first().click({ timeout: 4000 });
      await page.waitForTimeout(400);
      await page.getByText('Boolean', { exact: false }).first().hover({ timeout: 3000 });
      await page.waitForTimeout(500);
      await page.getByText('Subtract', { exact: false }).first().click({ timeout: 3000 });
      menuPath = true;
    } catch (_) {}
    await page.waitForTimeout(1800);
    const after = await h.readStatus(page);
    return { nodosBefore: before.nodos, nodosAfterPrims: mid.nodos, nodosAfterSubtract: after.nodos,
             subtractMenuClicked: menuPath };
  });

  // ════════════════════════════════════════════════════════════
  // US06 — Buscar campo de IA en lenguaje natural (no existe)
  // ════════════════════════════════════════════════════════════
  await story('US06', async (page) => {
    // Buscar botón 'AI' / panel 'Control por IA' montado
    const aiButton = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      const hasAILabel = /Control por IA|copiar contexto para Claude/i.test(txt);
      // botón con label exactamente 'AI'
      const btns = Array.from(document.querySelectorAll('button'));
      const aiBtn = btns.some(b => (b.textContent || '').trim() === 'AI');
      return { hasAILabel, aiBtn };
    });
    // Abrir Omnibar (Ctrl+K) y escribir lenguaje natural
    let omnibarOpened = false;
    let resultsForBrida = null;
    try {
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(500);
      omnibarOpened = await page.evaluate(() => !!document.querySelector('input[placeholder*="Buscar"], input[placeholder*="buscar"]'));
      await page.keyboard.type('brida con 4 barrenos', { delay: 20 });
      await page.waitForTimeout(700);
      resultsForBrida = await page.evaluate(() => {
        // Contar items de resultado del omnibar (heurística: listitems / divs clicables)
        const items = document.querySelectorAll('[role="option"], [data-omni-item], [role="listbox"] *');
        return items.length;
      });
    } catch (_) {}
    try { await page.keyboard.press('Escape'); } catch (_) {}
    return { aiPanelMounted: aiButton.hasAILabel || aiButton.aiBtn, omnibarOpened,
             omnibarResultsForFreeText: resultsForBrida,
             conclusion: 'No NL input box; AIPanel orphaned; Omnibar = keyword search only' };
  });

  // ════════════════════════════════════════════════════════════
  // US07 — Navegar el árbol de escena
  // ════════════════════════════════════════════════════════════
  await story('US07', async (page) => {
    // Hover sidebar izquierda → expandir panel ESCENA
    await page.mouse.move(24, 500);
    await page.waitForTimeout(900);
    const escenaOpen = await page.evaluate(() => (document.body.innerText || '').includes('ESCENA'));
    // Leer los labels de nodos visibles en el árbol
    const treeLabels = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      const wanted = ['Placa', 'Barreno', 'Boss'];
      return wanted.filter(w => txt.includes(w));
    });
    // Clic en 'Placa' para seleccionar y abrir propiedades
    let placaSelected = false;
    try {
      await page.getByText('Placa', { exact: false }).first().click({ timeout: 3000 });
      await page.waitForTimeout(600);
      placaSelected = true;
    } catch (_) {}
    // Pie del panel: 'N piezas', 'X cm³', 'Y kg'
    const footer = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      const piezas = (txt.match(/(\d+)\s*piezas/) || [])[1] || null;
      const kg = (txt.match(/([\d.]+)\s*kg/) || [])[1] || null;
      return { piezas, kg };
    });
    return { escenaOpen, treeLabels, placaSelected, footer };
  });

  // ════════════════════════════════════════════════════════════
  // US08 — Leer status bar (nodos / cm³ / FPS) + juzgar volumen
  // ════════════════════════════════════════════════════════════
  await story('US08', async (page, h) => {
    const st = await h.readStatus(page);
    // Volumen "a mano" de la placa de muestra: box 2×0.4×1.2 = 0.96 (unidades escena ~m)
    // En cm³ reales (si 1 unidad = 1 m): 0.96 m³ = 960000 cm³. El reportado no debe cuadrar.
    const reportedCm3 = parseFloat(st.cm3);
    const plausibleAsMetersToCm3 = 0.96 * 1e6; // 960000 cm³ si fuera metros con barreno sin restar
    return {
      nodos: st.nodos, vars: st.vars, cm3: st.cm3, fps: st.fps,
      reportedCm3,
      handCalcSolidBoxCm3: plausibleAsMetersToCm3,
      note: 'placa 2x0.4x1.2 sin restar barreno; comparar contra reportado para B2',
    };
  });

  // ════════════════════════════════════════════════════════════
  // US09 — Exportar STL
  // ════════════════════════════════════════════════════════════
  await story('US09', async (page) => {
    let downloadStarted = false;
    let downloadName = null;
    let downloadSize = null;
    let clicked = false;
    // Escuchar el evento de descarga
    const dlPromise = page.waitForEvent('download', { timeout: 12000 }).catch(() => null);
    try {
      await page.getByRole('button', { name: /STL/ }).first().click({ timeout: 4000 });
      clicked = true;
    } catch (_) {
      try { await page.getByText('STL', { exact: false }).first().click({ timeout: 3000 }); clicked = true; } catch (__) {}
    }
    const dl = await dlPromise;
    if (dl) {
      downloadStarted = true;
      downloadName = dl.suggestedFilename();
      try {
        const p = await dl.path();
        if (p) downloadSize = fs.statSync(p).size;
      } catch (_) {}
    }
    await page.waitForTimeout(1500);
    return { clicked, downloadStarted, downloadName, downloadSizeBytes: downloadSize };
  });

  // ════════════════════════════════════════════════════════════
  // US10 — Editar una variable paramétrica
  // ════════════════════════════════════════════════════════════
  await story('US10', async (page, h) => {
    try { await page.locator('canvas').click({ position: { x: 60, y: 60 }, timeout: 3000 }); } catch (_) {}
    // Crear una caja para auto-generar variables
    await page.keyboard.press('1');
    await page.waitForTimeout(2000);
    const before = await h.readStatus(page);
    // Estado inicial de los chips de variable (barra '$'): leer si alguno está en ERR
    const chipsBefore = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      const errCount = (txt.match(/ERR/g) || []).length;
      return { errCount };
    });
    // Localizar un chip editable (botón con '=') y editarlo
    let editTried = false;
    let committedValueSeen = null;
    try {
      // Los VarChip son <button> con la forma "name = value". Tomamos el primero que parezca variable.
      const chip = page.locator('button', { hasText: '=' }).first();
      await chip.click({ timeout: 3000 });
      await page.waitForTimeout(300);
      // Ahora hay un <input> dentro del chip; escribir un literal numérico y un Enter
      const input = page.locator('button input').first();
      await input.fill('0.6');
      await page.keyboard.press('Enter');
      editTried = true;
      await page.waitForTimeout(1800);
    } catch (_) {}
    const after = await h.readStatus(page);
    const chipsAfter = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      const errCount = (txt.match(/ERR/g) || []).length;
      // capturar el valor 0.6 visible
      const has06 = /0\.6/.test(txt);
      return { errCount, has06 };
    });
    // Probar también una expresión que referencie otra variable
    let exprErr = null;
    try {
      const chip2 = page.locator('button', { hasText: '=' }).first();
      await chip2.click({ timeout: 3000 });
      await page.waitForTimeout(300);
      const input2 = page.locator('button input').first();
      await input2.fill('sizeX/2');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      exprErr = await page.evaluate(() => (document.body.innerText || '').includes('ERR'));
    } catch (_) {}
    committedValueSeen = chipsAfter.has06;
    return {
      errBeforeCount: chipsBefore.errCount,
      errAfterLiteralCount: chipsAfter.errCount,
      literalEditTried: editTried,
      literalValueVisible: committedValueSeen,
      nodosBefore: before.nodos, nodosAfter: after.nodos,
      exprReferencingVarGivesErr: exprErr,
    };
  });

  // ── Reporte ──
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

  const okN = report.filter(r => r.ok).length;
  console.log('\n════════════════════════════════════════════');
  console.log(`RESUMEN · ${okN}/${report.length} historias sin excepción · salida en ${OUT}`);
  for (const r of report) {
    console.log(` ${r.id}: ${r.ok ? 'OK' : 'ERR'}${r.err ? ' — ' + r.err : ''}${r.consoleErrors && r.consoleErrors.length ? ' [' + r.consoleErrors.length + ' console-err]' : ''}`);
  }
  console.log('════════════════════════════════════════════');

  await browser.close();
})().catch(e => {
  console.error('DRIVER FATAL:', e && (e.message || e));
  try { fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ fatal: String(e && (e.message || e)), report }, null, 2)); } catch (_) {}
  process.exit(1);
});
