/**
 * La Forja — CAJA VACIADA (shelled box) ENTERAMENTE VIA UI (Playwright en iangpu).
 * ============================================================================
 * Directriz dura: la pieza se crea POR CLIC, nunca llamando occt.ts por código.
 * Pasos (todos UI):
 *   1. Sketch: perfil RECT, Ancho=60, Alto=40 (sliders data-testid).
 *   2. Extrude: Altura=20 → caja sólida 60x40x20 (vol esperado 48000 mm³).
 *   3. Selecciona la CARA SUPERIOR (face-list determinista: face-item-<topIdx>,
 *      etiquetada "superior"; y además se demuestra el picking por viewport).
 *   4. Shell: btn-shell, Espesor=2, cara superior = cara abierta → caja hueca.
 * Lee del DOM tras cada paso: invariantes (Euler) y panel de Análisis (vol/masa/COM).
 * Screenshot final → /tmp/forja-shell/caja-vaciada.png
 *
 * Verificación del vaciado:
 *   cavidad = (60-4)x(40-4)x(20-2) = 56x36x18 = 36288
 *   vol_shell = 48000 - 36288 = 11712 mm³ (±2%)
 *   COM sube en Z respecto al centro (piso del fondo).
 */
const fs = require('fs');
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = '/tmp/forja-shell/caja-vaciada.png';
fs.mkdirSync('/tmp/forja-shell', { recursive: true });

// Setear un <input type=range> como lo haría un humano arrastrando el slider:
// fija value + dispara 'input' (React escucha onChange = input event).
async function setRange(page, testid, target) {
  await page.waitForSelector(`[data-testid="${testid}"]`, { timeout: 10000 });
  await page.$eval(
    `[data-testid="${testid}"]`,
    (el, val) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, String(val));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    target,
  );
}

(async () => {
  const browser = await chromium.launch({
    headless: true, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
           '--use-gl=angle', '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + String(e).slice(0, 200)));

  const out = { url: URL, pasos_clic: [], steps: {}, errors: [] };
  const inv = () => page.evaluate('window.__forgeBrep.invariants');
  const get = (k) => page.evaluate(`window.__forgeBrep.${k}`);
  const log = (s) => { out.pasos_clic.push(s); };
  // El rebuild es async (requestAnimationFrame); no hay flag 'building' en el
  // hook, así que esperamos a que haya result fresco y damos margen al recompute.
  const settle = async (ms = 2500) => {
    await page.waitForFunction(
      'window.__forgeBrep && window.__forgeBrep.ready', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(ms);
  };
  // Lee el panel de Análisis del DOM (texto visible, no del kernel).
  const readAnalysis = async () => {
    const grab = async (tid) =>
      (await page.textContent(`[data-testid="${tid}"]`).catch(() => null));
    return {
      volumen: await grab('an-volumen'),
      area: await grab('an-area'),
      masa: await grab('an-masa'),
      com: await grab('an-com'),
      inercia: await grab('an-inercia'),
    };
  };

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });
    await settle();

    // ── PASO 1: SKETCH rectángulo 60x40 ──
    await page.click('[data-testid="feat-sketch"]');
    log('Clic en "Sketch 1" (feat-sketch) para editar el perfil.');
    await page.click('[data-testid="seg-rect"]');
    log('Clic en segmento "Rect" (seg-rect): perfil rectangular.');
    await setRange(page, 'input-ancho', 60);
    log('Slider "Ancho" (input-ancho) → 60 mm.');
    await setRange(page, 'input-alto', 40);
    log('Slider "Alto" (input-alto) → 40 mm.');
    await settle();

    // ── PASO 2: EXTRUDE altura 20 ──
    await page.click('[data-testid="feat-extrude"]');
    log('Clic en "Extrude 1" (feat-extrude) para editar la altura.');
    await setRange(page, 'input-altura', 20);
    log('Slider "Altura" (input-altura) → 20 mm → caja sólida 60×40×20.');
    await settle();

    const base = await inv();
    out.steps.base = {
      euler: base.euler, vol: base.vol_kernel, n_faces: base.n_faces,
      ops: base.ops, com: base.com,
    };
    out.steps.base_analysis = await readAnalysis();

    // ── Caras del sólido: localizar la SUPERIOR (plano normal +Z, mayor z) ──
    const faces = await page.evaluate('window.__forgeBrep.listFaces()');
    let topIdx = -1, tz = -1e9;
    for (const f of faces) {
      if (f.kind === 'plane' && f.normal[2] > 0.7 && f.center[2] > tz) { tz = f.center[2]; topIdx = f.index; }
    }
    out.steps.faces = faces.map((f) => ({ i: f.index, kind: f.kind, z: +f.center[2].toFixed(1), nz: +f.normal[2].toFixed(2) }));
    out.steps.topIdx = topIdx;
    if (topIdx < 0) throw new Error('No se encontró cara superior (plano +Z) en la caja');

    // ── PASO 3a: SELECCIÓN POR VIEWPORT (raycast real, clic en el canvas) ──
    // Demostramos que el clic-en-cara funciona end-to-end ANTES de cablear shell.
    await page.click('[data-testid="btn-pick-face-global"]');
    log('Clic en "Activar picking en viewport" (btn-pick-face-global).');
    const canvas = await page.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 8000 });
    const box = await canvas.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2 - box.height * 0.10; // un poco arriba → tapa
    await page.mouse.click(cx, cy);
    log(`Clic en el viewport (canvas, ~centro-arriba) → raycast a una cara.`);
    await page.waitForFunction('window.__forgeBrep.selectedFaceId !== null', { timeout: 8000 }).catch(() => {});
    const vpFace = await get('selectedFaceId');
    const vpFaceObj = faces.find((f) => f.index === vpFace);
    out.steps.pick_by_viewport = {
      clicked_at: { cx: +cx.toFixed(0), cy: +cy.toFixed(0) },
      selectedFaceId: vpFace,
      face_kind: vpFaceObj?.kind ?? null,
      face_is_top: vpFace === topIdx,
      is_valid_face: vpFace != null && vpFace >= 0 && vpFace < base.n_faces,
    };

    // ── PASO 4: SHELL espesor 2 con la CARA SUPERIOR como cara abierta ──
    // Abrimos la op Shell PRIMERO (queda activa), así el clic en la cara superior
    // la agrega a la lista de caras abiertas del shell (togglePickFace).
    await page.click('[data-testid="btn-shell"]');
    log('Clic en "Shell" (btn-shell) → nueva feature de vaciado (activa).');
    await page.waitForSelector('[data-testid="input-espesor"]', { timeout: 10000 });
    await setRange(page, 'input-espesor', 2);
    log('Slider "Espesor de pared" (input-espesor) → 2 mm.');
    // Tras añadir la op cambió la topología; los índices de cara pueden re-mapear.
    await settle();
    const faces2 = await page.evaluate('window.__forgeBrep.listFaces()');
    let topIdx2 = -1, tz2 = -1e9;
    for (const f of faces2) {
      if (f.kind === 'plane' && f.normal[2] > 0.7 && f.center[2] > tz2) { tz2 = f.center[2]; topIdx2 = f.index; }
    }
    out.steps.topIdx2 = topIdx2;
    if (topIdx2 < 0) throw new Error('No se encontró cara superior tras añadir Shell');

    // SELECCIÓN DETERMINISTA por lista: clic en face-item-<topIdx2> (cara abierta).
    await page.waitForSelector(`[data-testid="face-item-${topIdx2}"]`, { timeout: 10000 });
    await page.click(`[data-testid="face-item-${topIdx2}"]`);
    log(`Clic en la entrada de cara superior (face-item-${topIdx2}, etiq. "superior") → cara abierta del shell.`);
    // Esperamos a que el shell se aplique (op 'shell' en invariantes) y recompute.
    await page.waitForFunction(
      `window.__forgeBrep.invariants && window.__forgeBrep.invariants.ops.includes('shell')`,
      { timeout: 20000 });
    await settle(2500);

    const shell = await inv();
    const shellErr = await get('error');
    out.steps.shell = {
      euler: shell.euler, vol: shell.vol_kernel, n_faces: shell.n_faces,
      ops: shell.ops, com: shell.com, error: shellErr,
      selectedFaceId: await get('selectedFaceId'),
      open_face_count: await page.textContent('[data-testid="count-faces-sel"]').catch(() => null),
    };
    out.steps.shell_analysis = await readAnalysis();

    // Screenshot final.
    await page.screenshot({ path: SHOT });
    out.shot = SHOT;

    // ── CHECKS del vaciado ──
    const VOL_ESP = 11712;
    const volMed = shell.vol_kernel;
    const volErr = Math.abs(volMed - VOL_ESP) / VOL_ESP;
    const comBaseZ = base.com ? base.com[2] : 10;
    const comShellZ = shell.com ? shell.com[2] : null;
    out.checks = {
      base_vol_48000: Math.abs(base.vol_kernel - 48000) / 48000 < 0.02,
      shell_valid_solid: shell.euler === 2 && !shellErr,
      shell_op_applied: Array.isArray(shell.ops) && shell.ops.includes('shell'),
      vol_dropped: volMed < base.vol_kernel - 1,
      vol_within_2pct: volErr <= 0.02,
      com_rose_in_z: comShellZ != null && comShellZ < comBaseZ - 0.1,
      open_face_selected: out.steps.shell.open_face_count && parseInt(out.steps.shell.open_face_count, 10) >= 1,
      viewport_pick_valid: out.steps.pick_by_viewport.is_valid_face === true,
      analysis_visible: !!(out.steps.shell_analysis.volumen && out.steps.shell_analysis.masa && out.steps.shell_analysis.com),
      no_fatal_errors: errors.filter((e) => /Cannot read|undefined is not|TypeError/.test(e)).length === 0,
    };
    out.summary = {
      vol_medido: +volMed.toFixed(2),
      vol_esperado: VOL_ESP,
      vol_err_pct: +(volErr * 100).toFixed(2),
      com_base_z: +comBaseZ.toFixed(2),
      com_shell_z: comShellZ != null ? +comShellZ.toFixed(2) : null,
      euler_shell: shell.euler,
    };
    out.pass = Object.values(out.checks).every(Boolean);
    out.errors = errors.slice(0, 8);
  } catch (e) {
    out.pass = false;
    out.fatal = String(e && e.stack || e).slice(0, 600);
    out.errors = errors.slice(0, 8);
    try { await page.screenshot({ path: SHOT }); out.shot = SHOT; } catch {}
  } finally {
    await browser.close();
  }
  console.log('SHELL_BOX=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
