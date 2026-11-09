#!/usr/bin/env node
/**
 * FORJA MULTICUERPO — diagnóstico de las limitaciones A1 y A3 (orden 2026-11-04-banco-arco-ensamble).
 * ====================================================================================================
 * A1: «el render se cae con >~6 cuerpos». A3: «el heap del WASM se degrada tras 6–8 builds».
 * Este script NO arregla nada: mide. Sube N componentes (bloques, cilindros delgados como patas de
 * un DIP y, si se pasa STEP=1, un STEP de fabricante como pieza principal) y, por cada N, carga el doc,
 * espera a que el rebuild termine y anota:
 *   ok/error, tiempo del rebuild (ms), triángulos, bytes de STEP exportado, la memoria del WASM
 *   (si la página la expone) y si la página se cayó (pageerror/crash).
 * Después repite el MISMO doc R veces para ver si el heap se degrada (A3).
 *
 *   URL=http://localhost:5302/forja-brep.html DISPLAY=:0 GALLIUM_DRIVER=d3d12 \
 *   MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA node scripts/forja-multicuerpo-diag.cjs [--reps 12] [--step ruta.stp]
 */
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.URL || 'http://localhost:5302/forja-brep.html';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REPS = +arg('--reps', 12);
const STEP = arg('--step', null);
const NS = (arg('--ns', '2,4,6,8,12,16,24,40')).split(',').map(Number);
const GPU_ARGS = ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle',
  '--hide-scrollbars', '--window-size=1600,1000', '--js-flags=--expose-gc'];

function boxes(n) {
  // n bloques de 20×20×10 en fila, sin booleanas (compound), como piezas de un ensamble
  return Array.from({ length: n }, (_, k) => ({ id: `b${k}`, name: `bloque ${k}`, kind: 'box', w: 20, d: 20, h: 10, r: 5,
    x: 30 + (k % 10) * 25, y: Math.floor(k / 10) * 25, z: 0, rz: 0, bool: 'none' }));
}
function pins(n) {
  // n cilindros delgados (patas de DIP): Ø0.6 × 3.5, paso 2.54 — el caso que tumbó A1
  return Array.from({ length: n }, (_, k) => ({ id: `p${k}`, name: `pata ${k}`, kind: 'cyl', w: 1, d: 1, h: 3.5, r: 0.3,
    x: (k % 20) * 2.54, y: Math.floor(k / 20) * 7.62, z: -2, rz: 0, bool: 'none' }));
}

(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable', args: GPU_ARGS });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errores = [];
  let caida = false;
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));
  page.on('crash', () => { caida = true; });
  page.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  // la versión actual abre VACÍA (lobby / «suelta tu pieza»): ready exige un doc construido → newDoc primero
  await page.waitForFunction('!!window.__forgeBrep', undefined, { timeout: 240000, polling: 500 });
  await page.evaluate(() => window.__forgeBrep.newDoc());
  await page.waitForFunction('window.__forgeBrep.ready || !!window.__forgeBrep.error', undefined, { timeout: 240000, polling: 500 });
  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('webgl2');
    const ext = c && c.getExtension('WEBGL_debug_renderer_info');
    return ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'sin webgl';
  });
  console.log('[gl]', gl);
  const raw = await page.evaluate(() => window.__forgeBrep.serializeDoc());
  const base = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const stepText = STEP ? fs.readFileSync(STEP, 'utf8') : null;

  async function carga(doc, etiqueta) {
    const t0 = Date.now();
    const antes = await page.evaluate(() => (window.__forgeBrep.invariants || {}).tris ?? -1);
    errores.length = 0;
    try {
      await page.evaluate((d) => window.__forgeBrep.loadDoc(d), doc);
      // espera: o hay error, o los invariants reflejan el doc nuevo (tris cambia) y el estudio está listo
      await page.waitForFunction((a) => {
        const f = window.__forgeBrep; if (!f) return false;
        if (f.error) return true;
        const inv = f.invariants; return !!(f.ready && inv && inv.tris !== a);
      }, antes, { timeout: 180000, polling: 200 });
    } catch (e) { errores.push('espera: ' + String(e.message || e).slice(0, 120)); }
    const ms = Date.now() - t0;
    const info = caida ? null : await page.evaluate(() => {
      const f = window.__forgeBrep; const inv = f.invariants || {};
      const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null;
      return { error: f.error ? String(f.error).slice(0, 160) : null, tris: inv.tris, step: inv.step_bytes, faces: inv.n_faces, mem };
    }).catch((e) => ({ error: 'evaluate: ' + String(e.message).slice(0, 120) }));
    const ok = !caida && info && !info.error;
    console.log(`${etiqueta.padEnd(26)} ${ok ? 'OK ' : 'MAL'} ${String(ms).padStart(7)} ms  tris ${String(info?.tris ?? '-').padStart(8)}  caras ${String(info?.faces ?? '-').padStart(6)}  step ${String(info?.step ?? '-').padStart(9)} B  JSheap ${info?.mem ?? '-'} MB  ${caida ? 'PÁGINA CAÍDA' : (info?.error || errores[0] || '')}`);
    return ok;
  }

  console.log('\n── A1: cuántos cuerpos aguanta');
  for (const tipo of ['bloques', 'patas']) {
    for (const n of NS) {
      if (caida) break;
      const comps = tipo === 'bloques' ? boxes(n) : pins(n);
      const doc = { ...base, name: `diag ${tipo} ${n}`, components: comps, importedStep: stepText };
      await carga(doc, `${tipo} N=${n}${stepText ? ' +STEP' : ''}`);
    }
  }
  if (!caida) {
    console.log(`\n── A3: el mismo doc ${REPS} veces (¿se degrada?)`);
    const n = 12;
    for (let r = 1; r <= REPS && !caida; r++) {
      const doc = { ...base, name: `diag rep ${r}`, components: boxes(n + (r % 2)), importedStep: stepText };
      await carga(doc, `rebuild ${r} (N=${n + (r % 2)})`);
    }
  }
  console.log(caida ? '\nRESULTADO: la página se CAYÓ' : '\nRESULTADO: la página sobrevivió');
  await browser.close();
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
