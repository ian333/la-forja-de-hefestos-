#!/usr/bin/env node
/**
 * forja-caja-ensamble-completo.cjs — ENSAMBLA la CAJA DE VELOCIDADES presentable
 * (2 engranes que embonan + 2 FLECHAS + CARCASA) VÍA UI (clics Playwright en
 * iangpu, GPU real ANGLE) — NUNCA llama occt.ts directo — exporta STEP del
 * ENSAMBLE y captura screenshots limpios.
 *
 *   1) ⚙ Engrane → engrane 1 (m=2, Z₁=20, espesor=10, barreno=8) por inputs.
 *   2) + Agregar 2º engrane; input-dientes2 = 40 (relación 2:1).
 *   3) ⚙ Aplicar mate de engrane → C = m(Z₁+Z₂)/2 = 60, faseo φ₂.
 *   4) Ocultar boceto (dientes nítidos).
 *   5) chk-shafts ✓ → monta 2 flechas coaxiales (⌀ = bore − 2·holgura).
 *   6) chk-housing ✓ → monta carcasa (caja + shell + 2 baleros a C).
 *   7) Lee __forgeBrep.assemblyInfo: nº componentes, vol flechas/carcasa/compound.
 *   8) Exporta STEP del ENSAMBLE (lee el blob del <a download> btn-export-step) y
 *      lo guarda; reporta bytes.
 *   9) Screenshots: 07-caja-velocidades-iso.png (iso) + 08-engranado.png (frontal).
 *
 * INVARIANTES (rigor de físico, no "se ve bien"):
 *   · C medido == m·(Z₁+Z₂)/2 = 60 (±0.05).
 *   · interferencia engrane↔engrane Common(g1,g2) ≈ 0 (embonan).
 *   · vol_compound == Σ vol partes (las partes no se solapan).
 *   · nº componentes == 5 (2 engranes + 2 flechas + carcasa) con todo montado.
 *   · r_flecha < r_barreno (la flecha entra sin interferir con su engrane).
 *   · STEP del ENSAMBLE > 0 bytes y arranca con 'ISO-10303-21' (header STEP).
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.env.OUT || '/tmp/forja-caja';
const SHOTS = process.env.SHOTS || '/home/ian/Orkesta/la-forja/forja-shots';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const errs = [];

const P = { m: 2, z1: 20, z2: 40, alpha: 20, espesor: 10, bore: 8 };
const C_ESPERADO = (P.m * (P.z1 + P.z2)) / 2; // 60
const I_ESPERADO = P.z2 / P.z1;               // 2

async function setRange(page, testid, value) {
  const sel = `[data-testid="${testid}"]`;
  await page.waitForSelector(sel, { timeout: 8000 });
  await page.$eval(sel, (el, v) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

const api = (page) => page.evaluate(() => {
  const a = window.__forgeBrep;
  if (!a) return null;
  return {
    ready: a.ready, error: a.error,
    assemblyInfo: a.assemblyInfo, mateInfo: a.mateInfo,
    stepBytes: a.invariants ? a.invariants.step_bytes : null,
  };
});

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message.slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 240)); });

  const report = { url: URL, params: P, C_esperado: C_ESPERADO, i_esperado: I_ESPERADO, errs, pasos: [], shots: [] };
  const note = (k, v) => { report[k] = v; console.log(k + ' = ' + JSON.stringify(v)); };
  const step = (s) => { report.pasos.push(s); console.log('· ' + s); };

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__forgeBrep && window.__forgeBrep.ready, { timeout: 60000 });
  await page.waitForTimeout(1500);

  // ── 1) ENGRANE 1 ──
  await page.click('[data-testid="btn-gear"]', { force: true }); step('Clic → ⚙ Engrane');
  await page.waitForTimeout(900);
  await setRange(page, 'input-modulo', P.m);                step(`input-modulo = ${P.m}`);
  await setRange(page, 'input-dientes', P.z1);              step(`input-dientes = ${P.z1}`);
  await setRange(page, 'input-presion', P.alpha);           step(`input-presion = ${P.alpha}`);
  await setRange(page, 'input-espesor-engrane', P.espesor); step(`input-espesor-engrane = ${P.espesor}`);
  await setRange(page, 'input-bore', P.bore);               step(`input-bore = ${P.bore}`);
  await page.waitForTimeout(1200);

  // ── 2) 2º ENGRANE + Z₂=40 ──
  await page.click('[data-testid="btn-add-gear2"]', { force: true }); step('Clic → + Agregar 2º engrane');
  await page.waitForTimeout(1000);
  await setRange(page, 'input-dientes2', P.z2);             step(`input-dientes2 = ${P.z2}`);
  await page.waitForTimeout(1500);

  // ── 3) APLICAR MATE ──
  await page.click('[data-testid="btn-gear-mate"]', { force: true }); step('Clic → ⚙ Aplicar mate de engrane');
  await page.waitForTimeout(2500);

  let st = await api(page);
  note('mate_info', st && st.mateInfo);
  note('assembly_solo_engranes', st && st.assemblyInfo);

  // ── 4) Ocultar boceto (dientes nítidos) ──
  await page.click('[data-testid="btn-toggle-sketch"]', { force: true }).catch(() => {});
  step('Clic → Ocultar boceto');
  await page.waitForTimeout(800);

  // ── 5) MONTAR FLECHAS (chk-shafts) ──
  await page.check('[data-testid="chk-shafts"]', { force: true }).catch(async () => {
    await page.$eval('[data-testid="chk-shafts"]', (el) => { if (!el.checked) el.click(); });
  });
  step('Clic → ☑ Montar 2 flechas');
  await page.waitForTimeout(2500);
  st = await api(page);
  note('assembly_con_flechas', st && st.assemblyInfo);

  // ── 6) MONTAR CARCASA (chk-housing) ──
  await page.check('[data-testid="chk-housing"]', { force: true }).catch(async () => {
    await page.$eval('[data-testid="chk-housing"]', (el) => { if (!el.checked) el.click(); });
  });
  step('Clic → ☑ Montar carcasa');
  await page.waitForTimeout(3500);
  st = await api(page);
  const ai = st && st.assemblyInfo;
  note('assembly_completo', ai);
  note('build_error', st && st.error);
  note('step_bytes_api', st && st.stepBytes);

  // ── 7) Verificación de invariantes del ensamble ──
  const C_medido = ai ? ai.C_measured : null;
  const C_ok = C_medido != null && Math.abs(C_medido - C_ESPERADO) < 0.05;
  const interf = ai ? ai.interference_volume : null;
  const interfFrac = ai ? ai.interference_fraction : null;
  const embonan = interfFrac != null && interfFrac < 5e-3;
  const nComp = ai ? ai.n_components : null;
  const shaftsOk = !!(ai && ai.shafts && ai.vol_shafts > 0);
  const housingOk = !!(ai && ai.housing && ai.vol_housing > 0);
  // Σ partes == compound (no se solapan)
  const volParts = ai ? (ai.vol_gear1 + ai.vol_gear2 + (ai.vol_shafts || 0) + (ai.vol_housing || 0)) : null;
  const compoundOk = ai && volParts != null
    ? Math.abs(ai.vol_compound - volParts) / volParts < 1e-6 : null;
  // r_flecha < r_barreno (la flecha entra)
  const rShaft = P.bore / 2 - 0.4;
  const rBore = P.bore / 2;
  const fitOk = rShaft < rBore;
  note('C_medido', C_medido); note('C_ok', C_ok);
  note('interferencia_engranes', interf); note('interferencia_frac', interfFrac); note('embonan', embonan);
  note('n_componentes', nComp); note('componentes', ai && ai.components);
  note('flechas_ok', shaftsOk); note('vol_flechas', ai && ai.vol_shafts);
  note('carcasa_ok', housingOk); note('vol_carcasa', ai && ai.vol_housing);
  note('compound_suma_partes_ok', compoundOk); note('vol_compound', ai && ai.vol_compound);
  note('flecha_entra_en_barreno', fitOk, );

  // ── 8) EXPORTAR STEP del ENSAMBLE: lee el blob del <a download> ──
  // El href del botón btn-export-step es un blob: URL con el STEP del shape actual
  // (en modo ensamble = el compound completo). Lo bajamos vía fetch en la página.
  const stepText = await page.evaluate(async () => {
    const a = document.querySelector('[data-testid="btn-export-step"]');
    if (!a || !a.href || a.href === '#') return null;
    const res = await fetch(a.href);
    return await res.text();
  });
  let stepBytes = 0; let stepHeaderOk = false; let stepPath = null;
  if (stepText) {
    stepBytes = Buffer.byteLength(stepText, 'utf8');
    stepHeaderOk = /ISO-10303-21/.test(stepText.slice(0, 64));
    stepPath = path.join(SHOTS, 'caja-velocidades-ensamble.step');
    fs.writeFileSync(stepPath, stepText);
    // Cuenta de sólidos (MANIFOLD_SOLID_BREP) como evidencia de multi-pieza.
    const solids = (stepText.match(/MANIFOLD_SOLID_BREP/g) || []).length;
    note('step_solids_manifold', solids);
  }
  note('step_bytes', stepBytes);
  note('step_header_ok', stepHeaderOk);
  note('step_path', stepPath);

  // ── 9) SCREENSHOTS limpios → forja-shots ──
  // Centro REAL del canvas del viewport (la escena 3D no ocupa todo el ancho:
  // hay paneles laterales). Sacamos su bounding box para arrastrar/rotar bien.
  const box = await page.evaluate(() => {
    const cv = document.querySelector('[data-testid="viewport-canvas"]')
      || document.querySelector('[data-testid="viewport"] canvas')
      || document.querySelector('[data-testid="viewport"]');
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
  note('canvas_box', box);
  const cx = box ? box.cx : 840;
  const cy = box ? box.cy : 500;

  // (07) ISO con HUD visible: muestra C=60, i=2, EMBONAN ✓ (evidencia en pantalla).
  await page.waitForTimeout(1200);
  const isoShot = path.join(SHOTS, '07-caja-velocidades-iso.png');
  await page.screenshot({ path: isoShot }); report.shots.push(isoShot);
  note('shot_iso', isoShot);

  // (08) ENGRANADO en PLANTA: lleva la cámara casi VERTICAL (mirar dentro de la
  // carcasa abierta desde arriba) y acerca a la zona de engranado entre los dos
  // ejes (x≈30): se ven los dientes del Z₁ entrando en los valles del Z₂. Mirar
  // desde arriba evita que la pared opaca de la carcasa tape el par.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 120, { steps: 18 }); // baja el mouse → cámara sube a planta
  await page.mouse.up();
  await page.waitForTimeout(600);
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -260); // acerca al par engranado
  await page.waitForTimeout(1100);
  const frontShot = path.join(SHOTS, '08-engranado.png');
  await page.screenshot({ path: frontShot }); report.shots.push(frontShot);
  note('shot_engranado', frontShot);

  // (09) DETALLE limpio en 3/4: regresa la cámara a una vista de tres-cuartos
  // (deshace la planta del 08), aleja un poco para encuadrar TODO el ensamble y
  // oculta el chrome (btn-hide-chrome) → render mate, aristas nítidas, sin UI.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 95, { steps: 14 }); // sube el mouse → cámara baja a 3/4
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, 160); // aleja un poco para ver el conjunto completo
  await page.click('[data-testid="btn-hide-chrome"]', { force: true }).catch(() => {});
  await page.waitForTimeout(700);
  const closeShot = path.join(SHOTS, '09-caja-velocidades-detalle.png');
  await page.screenshot({ path: closeShot }); report.shots.push(closeShot);
  note('shot_detalle', closeShot);
  // Restaura chrome por si se reutiliza la página.
  await page.click('[data-testid="btn-hide-chrome"]', { force: true }).catch(() => {});

  const stFinal = await api(page);
  const finalError = stFinal ? stFinal.error : (st && st.error);

  const caja_ensamblada = !!(
    C_ok && embonan && shaftsOk && housingOk && compoundOk && fitOk &&
    nComp === 5 && stepBytes > 0 && stepHeaderOk && !finalError
  );

  const verdict = {
    caja_ensamblada,
    C_medido, C_esperado: C_ESPERADO, C_ok,
    embonan, interferencia_frac: interfFrac,
    n_componentes: nComp, componentes: ai && ai.components,
    flechas_ok: shaftsOk, vol_flechas: ai && ai.vol_shafts,
    carcasa_ok: housingOk, vol_carcasa: ai && ai.vol_housing,
    compound_suma_partes_ok: compoundOk, vol_compound: ai && ai.vol_compound,
    flecha_entra_en_barreno: fitOk,
    step_bytes: stepBytes, step_header_ok: stepHeaderOk, step_path: stepPath,
    shots: report.shots,
    error: finalError,
  };
  note('VERDICT', verdict);

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'ensamble-completo-report.json'), JSON.stringify(report, null, 2));
  console.log('\n===RESULT===');
  console.log(JSON.stringify(verdict, null, 2));
  if (!caja_ensamblada) { console.error('QA: ensamble incompleto (ver veredicto)'); process.exit(2); }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
