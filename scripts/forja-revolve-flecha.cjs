#!/usr/bin/env node
/**
 * forja-revolve-flecha.cjs — FLECHA POR REVOLUCIÓN, enteramente VIA UI (clics).
 * Corre EN iangpu (GPU real, ANGLE headless). NUNCA llama occt.ts por código:
 * solo maneja la interfaz con clics de Playwright, igual que un diseñador.
 *
 * Pasos (rigor incremental):
 *   A) CILINDRO por revolve — perfil escalonado de 1 escalón (r×L) a un lado del
 *      eje Y + Revolve 360°. Verifica vol = π·r²·L (±1%).
 *   B) FLECHA escalonada — perfil de 3 escalones (r=[10,15,10], L=[20,30,20]) a
 *      un lado del eje Y + Revolve 360°. Verifica vol = Σ π·r_i²·L_i (±1%).
 *
 * Todo el perfil escalonado se arma con la herramienta de CROQUIS POLIGONAL nueva
 * (seg-revprofile + preset-cilindro/preset-flecha + step-r/step-l), construida
 * para esta tarea — sigue siendo UI.
 *
 *   node scripts/forja-revolve-flecha.cjs   (URL=http://localhost:5002/forja-brep.html)
 * Screenshots: /tmp/forja-revolve/cilindro-revolve.png y /tmp/forja-revolve/flecha.png
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/forja-revolve';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const errs = [];

const get = (page) => page.evaluate(() => {
  const a = window.__forgeBrep;
  if (!a) return null;
  return {
    ready: a.ready,
    error: a.error,
    steps: a.steps,
    inv: a.invariants,
  };
});

// Lee el volumen del PANEL DE ANÁLISIS (DOM), no del kernel directo.
const readVolDom = async (page) => {
  const t = await page.textContent('[data-testid="an-volumen"]').catch(() => null);
  if (!t) return null;
  const m = t.replace(/[, ]/g, (c) => (c === ',' ? '' : c)).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
};
const readErrorDom = async (page) => {
  // El panel de invariantes muestra "Error: ..." si la última op falló.
  const t = await page.textContent('[data-testid="invariants"]').catch(() => '');
  return /error/i.test(t || '') ? (t || '').slice(0, 160) : null;
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1680, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  const report = { url: URL, pasos_clic: [], steps: [], errs };
  const clic = (s) => { report.pasos_clic.push(s); console.log('CLIC · ' + s); };
  const note = (k, v) => { report.steps.push({ [k]: v }); console.log(k + ' = ' + JSON.stringify(v)); };

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForFunction(() => window.__forgeBrep && window.__forgeBrep.ready, { timeout: 60000 });
  await page.waitForTimeout(1500);
  note('after_load', (await get(page)).inv && { euler: (await get(page)).inv.euler });

  // ─────────────────────────────────────────────────────────────────
  // A) CILINDRO POR REVOLVE
  // ─────────────────────────────────────────────────────────────────
  // 1) Abre el sketch y cambia a perfil ESCALONADO (croquis poligonal nuevo).
  await page.click('[data-testid="feat-sketch"]'); clic('feat-sketch (abrir croquis)');
  await page.waitForTimeout(400);
  await page.click('[data-testid="seg-revprofile"]'); clic('seg-revprofile (perfil escalonado)');
  await page.waitForTimeout(400);
  // 2) Preset CILINDRO = 1 escalón r=14, L=40.
  await page.click('[data-testid="preset-cilindro"]'); clic('preset-cilindro (r=14,L=40)');
  await page.waitForTimeout(600);
  const stA = await get(page);
  note('steps_cilindro', stA.steps);

  // 3) Agrega REVOLVE y elige EJE GLOBAL Y (el perfil está a x≥0, de un lado de Y).
  //    El revolve tiene PRIORIDAD como sólido base sobre el extrude inicial, así
  //    que NO hace falta borrar nada: el grafo nunca queda vacío.
  await page.click('[data-testid="btn-revolve"]'); clic('btn-revolve (agregar revolución)');
  await page.waitForTimeout(800);
  await page.click('[data-testid="axis-y"]'); clic('axis-y (eje global Y)');
  await page.waitForTimeout(1500);

  // 5) Lee volumen del DOM + validez.
  let volDom = await readVolDom(page);
  let errDom = await readErrorDom(page);
  const rC = 14, LC = 40;
  const volEspCil = Math.PI * rC * rC * LC;
  const okCil = volDom != null && Math.abs(volDom - volEspCil) / volEspCil < 0.01 && !errDom;
  note('cilindro', { vol_dom: volDom, vol_esperado: volEspCil, err_dom: errDom, ok: okCil });
  await page.screenshot({ path: path.join(OUT, 'cilindro-revolve.png') });
  note('shot_cilindro', path.join(OUT, 'cilindro-revolve.png'));
  const cilindro = {
    creado_via_ui: true,
    vol_medido: volDom,
    vol_esperado: +volEspCil.toFixed(2),
    ok: okCil,
  };

  // ─────────────────────────────────────────────────────────────────
  // B) FLECHA ESCALONADA (3 escalones)
  // ─────────────────────────────────────────────────────────────────
  // Reusa la misma op de revolve; solo cambia el PERFIL del croquis a 3 escalones.
  await page.click('[data-testid="feat-sketch"]'); clic('feat-sketch (volver al croquis)');
  await page.waitForTimeout(400);
  await page.click('[data-testid="preset-flecha"]'); clic('preset-flecha (r=[10,15,10] L=[20,30,20])');
  await page.waitForTimeout(1500);
  const stB = await get(page);
  note('steps_flecha', stB.steps);

  // El revolve sigue presente con eje Y; el perfil cambió → flecha de 3 escalones.
  volDom = await readVolDom(page);
  errDom = await readErrorDom(page);
  const escalones = [{ r: 10, L: 20 }, { r: 15, L: 30 }, { r: 10, L: 20 }];
  const volEspFle = escalones.reduce((a, s) => a + Math.PI * s.r * s.r * s.L, 0);
  const okFle = volDom != null && Math.abs(volDom - volEspFle) / volEspFle < 0.01 && !errDom;
  note('flecha', { vol_dom: volDom, vol_esperado: volEspFle, err_dom: errDom, ok: okFle });
  await page.screenshot({ path: path.join(OUT, 'flecha.png') });
  note('shot_flecha', path.join(OUT, 'flecha.png'));
  const flecha = {
    creada_via_ui: true,
    vol_medido: volDom,
    vol_esperado: +volEspFle.toFixed(2),
    ok: okFle,
    escalones,
  };

  fs.writeFileSync(path.join(OUT, 'revolve-flecha-report.json'),
    JSON.stringify({ ...report, cilindro, flecha }, null, 2));
  console.log('\nDONE · errs=' + errs.length);
  console.log('REVOLVE_RESULT=' + JSON.stringify({ cilindro, flecha, errs: errs.length }));
  await browser.close();
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 600)); process.exit(1); });
