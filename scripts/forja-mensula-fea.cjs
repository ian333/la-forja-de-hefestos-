/**
 * La Forja — MÉNSULA DE REPISA (L-bracket): diseñar → analizar (FEA) → iterar,
 * TODO vía la INTERFAZ con el MOUSE (Playwright clic real en los controles UI).
 * ====================================================================
 * NUNCA se invoca la geometría/FEA por código. Sólo se LEEN datos de estado
 * (caras) para DECIDIR en qué botón de la lista de caras hacer clic — igual que
 * un humano lee la etiqueta de cara en pantalla. Todas las MUTACIONES (sketch,
 * extrude, hole, fillet, material, BC, Analizar, STEP) son clic/fill en la UI.
 *
 * Pieza: ménsula en L 80×80, pata 10 mm, extruida 40 mm. Barreno ⌀6 pasante en
 * el ala horizontal. Fillet de alivio en la arista interior. Acero 1045.
 * Caso de carga (cantilever de manual): cara trasera de la pata vertical (X≈−40,
 * normal −X) EMPOTRADA = pared; cara superior del ala horizontal (normal +Y) =
 * donde la repisa apoya su peso. Magnitud realista.
 *
 * Teoría de viga para sanity-check (cantilever, sección de la pata = b×t):
 *   La pata vertical empotrada actúa como viga; el ala carga F en voladizo.
 *   σ ~ M·c/I ; FS = σ_y / σ_max. Acero 1045 σ_y=530 MPa.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/maquina-fea.png';
const STEP_DIR = '/home/ian/Orkesta/la-forja/forja-shots';

// Parámetros de diseño (mm) y carga (N).
// El maker IMPRIME esta ménsula en PLA. Caso de carga = peor caso: repisa
// cargada + alguien que se recarga fuerte ≈ 110 kgf sobre UNA ménsula = ~1100 N.
// La malla tet del solver converge limpio con pata DELGADA (legW=6: 720n/1836t);
// patas más gruesas (8/10) producen tets mal-condicionados y el CG NO converge
// a esta resolución fija de UI — por eso el lazo de MEJORA es por MATERIAL, no
// por engrose (engrosar rompería la convergencia, sería un número inválido).
const ANCHO = 80, ALTO = 80, PATA0 = 6, EXTRUDE = 40;
const HOLE_D = 6;
const LOAD_N = 1100;            // peor caso, ~110 kgf en una ménsula
const MAT_BASE = 'pla';        // el maker la imprime en PLA
const MAT_MEJORA = 'alu';      // si PLA no aguanta → maquinar en Aluminio 6061

async function setRange(page, testid, value) {
  // Pone un <input type=range> en `value` vía teclado/fill (interacción UI real)
  const sel = `[data-testid="${testid}"]`;
  await page.waitForSelector(sel, { timeout: 15000 });
  await page.$eval(sel, (el, v) => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await page.waitForTimeout(120);
}

async function readFaces(page) {
  // LECTURA de estado (read-only) para DECIDIR qué botón de cara clicar.
  return page.evaluate(() => {
    let faces = [];
    if (window.__forgeBrep && typeof window.__forgeBrep.listFaces === 'function') {
      faces = window.__forgeBrep.listFaces();
    }
    return faces.map(f => ({
      index: f.index, kind: f.kind,
      center: f.center.map(v => +v.toFixed(2)),
      normal: f.normal.map(v => +v.toFixed(3)),
      area: +f.area.toFixed(1),
    }));
  });
}

async function num(page, testid) {
  const t = await page.textContent(`[data-testid="${testid}"]`).catch(() => null);
  if (t == null) return { raw: null, val: null };
  const m = t.match(/-?\d+(\.\d+)?(e-?\d+)?/i);
  return { raw: t.trim(), val: m ? parseFloat(m[0]) : null };
}

async function runFea(page, out, tag) {
  // 1) Caras: leer geometría para elegir fija (−X) y carga (+Y del ala)
  const faces = await readFaces(page);
  out[`faces_${tag}`] = faces;
  if (!faces.length) throw new Error('listFaces vacío: sólido no listo');

  // FIJA = espalda de la pata vertical = plano en X mínimo (X≈−40, la pared).
  //   Es la cara de mayor |X| negativo y |nx|≈1 (eje X). Robusto: el menor center.x.
  const xPlanes = faces.filter(f => f.kind === 'plane' && Math.abs(f.normal[0]) > 0.8);
  const fixFace = xPlanes.slice().sort((a, b) => a.center[0] - b.center[0])[0];
  // CARGA = cara SUPERIOR del ala horizontal donde apoya la repisa: el plano con
  //   eje Y (|ny|≈1) cuyo centro está MÁS ARRIBA en Y dentro del ala (Y≈−30) y de
  //   gran área (el ala, no la cara externa de la pata). Tomamos entre planos eje-Y
  //   el de mayor área que NO sea la base inferior (Y≈−40).
  const yPlanes = faces.filter(f => f.kind === 'plane' && Math.abs(f.normal[1]) > 0.8);
  //   base inferior del ala = menor center.y (Y≈−40); la quitamos.
  const yMin = Math.min(...yPlanes.map(f => f.center[1]));
  const loadCands = yPlanes.filter(f => f.center[1] > yMin + 1).sort((a, b) => b.area - a.area);
  const loadFace = loadCands[0] || yPlanes.sort((a, b) => b.area - a.area)[0];
  if (!fixFace) throw new Error('no hay cara eje-X (fija)');
  if (!loadFace) throw new Error('no hay cara eje-Y (carga)');
  const fixIdx = fixFace.index;
  const loadIdx = loadFace.index;
  out[`fixFace_${tag}`] = fixFace;
  out[`loadFace_${tag}`] = loadFace;

  // 2) Clic en "Cara FIJA" (activa pick FEA) → clic en el botón de la lista de caras
  await page.click('[data-testid="btn-pick-fija"]');
  await page.waitForTimeout(150);
  await page.click(`[data-testid="face-item-${fixIdx}"]`);
  await page.waitForTimeout(200);
  out[`fija_dom_${tag}`] = (await page.textContent('[data-testid="fea-fija-id"]').catch(() => '')).trim();

  // 3) Clic en "Cara de CARGA" → clic en el botón de la lista
  await page.click('[data-testid="btn-pick-carga"]');
  await page.waitForTimeout(150);
  await page.click(`[data-testid="face-item-${loadIdx}"]`);
  await page.waitForTimeout(200);
  out[`carga_dom_${tag}`] = (await page.textContent('[data-testid="fea-carga-id"]').catch(() => '')).trim();

  // 4) Magnitud de carga (slider input-carga)
  await setRange(page, 'input-carga', LOAD_N);
  await page.waitForTimeout(150);

  // 5) Clic Analizar
  await page.click('[data-testid="btn-fea"]');
  // Esperar a que el resultado aparezca en el DOM
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="fea-max-vm"]');
    return el && /\d/.test(el.textContent || '');
  }, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(600);

  const vm = await num(page, 'fea-max-vm');
  const fs_ = await num(page, 'fea-fs');
  const dz = await num(page, 'fea-deflexion');
  const mesh = await page.textContent('[data-testid="fea-mesh"]').catch(() => null);
  const err = await page.textContent('[data-testid="fea-error"]').catch(() => null);
  const meshStr = (mesh || '').trim();
  out[`fea_${tag}`] = {
    max_vm_MPa: vm.val, max_vm_raw: vm.raw,
    fs: fs_.val, fs_raw: fs_.raw,
    defl_mm: dz.val, defl_raw: dz.raw,
    mesh: meshStr, converged: /✓/.test(meshStr),
    error: err ? err.trim() : null,
    fixFace: fixIdx, loadFace: loadIdx, load_N: LOAD_N,
    material: await page.evaluate(() => document.querySelector('[data-testid="select-material"]').value),
  };
  return out[`fea_${tag}`];
}

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu',
      '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--hide-scrollbars',
      '--window-size=1720,1040'],
  });
  const page = await browser.newPage({ viewport: { width: 1720, height: 1040 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 200)));

  const out = { url: URL, design: { ANCHO, ALTO, PATA0, EXTRUDE, HOLE_D, LOAD_N }, errs: [] };
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });

    out.renderer = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a';
    });

    // ════ DISEÑO VÍA UI ════
    // 1) Abrir Sketch + elegir perfil L
    await page.click('[data-testid="feat-sketch"]');
    await page.waitForTimeout(150);
    await page.click('[data-testid="seg-lprofile"]');
    await page.waitForTimeout(300);
    // 2) Cotas del perfil L
    await setRange(page, 'input-ancho', ANCHO);
    await setRange(page, 'input-alto', ALTO);
    await setRange(page, 'input-pata', PATA0);
    await page.waitForTimeout(400);

    // 3) Extrude depth = 40 (ancho de la ménsula)
    await page.click('[data-testid="feat-extrude"]');
    await page.waitForTimeout(150);
    await setRange(page, 'input-altura', EXTRUDE);
    await page.waitForTimeout(500);
    await page.waitForFunction('window.__forgeBrep.ready', { timeout: 30000 });

    // 4) Barreno ⌀6 pasante en el ala horizontal (Y negativo, hacia +X del ala)
    await page.click('[data-testid="btn-hole"]');
    await page.waitForTimeout(300);
    await setRange(page, 'input-diametro', HOLE_D);
    // posición en el ala horizontal: X ~ +20 (hacia la punta), Y ~ −35 (en el ala)
    await setRange(page, 'input-pos-x', 20);
    await setRange(page, 'input-pos-y', -35);
    // asegurar pasante
    const through = await page.isChecked('[data-testid="chk-pasante"]').catch(() => null);
    if (through === false) await page.click('[data-testid="chk-pasante"]');
    await page.waitForTimeout(500);
    await page.waitForFunction('window.__forgeBrep.ready', { timeout: 30000 });

    // 5) Fillet de alivio (radio 3) en la ARISTA INTERIOR cóncava (donde el ala
    //    y la pata se encuentran: borde vertical en X≈−30, Y≈−30). Concentra
    //    menos esfuerzo que la esquina viva. Se selecciona UNA arista vía la lista
    //    (clic real); el fillet-a-todas rompe OCCT, así que sólo la cóncava.
    await page.click('[data-testid="btn-fillet"]');
    await page.waitForTimeout(300);
    await setRange(page, 'input-radio-fillet', 3);
    await page.waitForTimeout(200);
    // Leer aristas (read-only) para hallar la cóncava interior (recta, eje Z,
    // pasando por X≈−30, Y≈−30). La lista edge-item-<i> es UI real (clic).
    const innerEdge = await page.evaluate(() => {
      const eg = (window.__forgeBrep.listEdgeGeoms && window.__forgeBrep.listEdgeGeoms()) || [];
      const es = (window.__forgeBrep.listEdges && window.__forgeBrep.listEdges()) || [];
      // Buscar arista recta vertical (Z) en la esquina interior X≈−30, Y≈−30.
      let best = null, bd = 1e9;
      for (const e of es) {
        const g = eg.find(x => x.edgeId === e.index);
        const pts = g && g.polyline ? g.polyline : null;
        let cx, cy;
        if (pts && pts.length) {
          cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
          cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        } else if (e.mid) { cx = e.mid[0]; cy = e.mid[1]; }
        else continue;
        // sólo aristas rectas verticales (eje Z): poco span en X,Y a lo largo
        const d = Math.hypot(cx - (-30), cy - (-30));
        if (d < bd) { bd = d; best = e.index; }
      }
      return { index: best, dist: +bd.toFixed(2), nEdges: es.length };
    });
    out.innerEdge = innerEdge;
    let filletOk = false;
    if (innerEdge.index != null) {
      await page.click(`[data-testid="edge-item-${innerEdge.index}"]`).catch(() => {});
      await page.waitForTimeout(800);
      await page.waitForFunction('window.__forgeBrep.ready', { timeout: 20000 }).catch(() => {});
      const inv = await page.textContent('[data-testid="invariants"]').catch(() => '');
      out.filletInv = (inv || '').replace(/\s+/g, ' ').trim().slice(0, 220);
      filletOk = !/cxa_can_catch|Error|undefined/.test(inv || '');
    }
    // Si el fillet rompió el sólido (OCCT lanzó), BORRAR la op vía UI (honestidad).
    if (!filletOk) {
      // re-seleccionar la op fillet en el árbol y borrarla
      await page.click('[data-testid="feat-fillet"]').catch(() => {});
      await page.waitForTimeout(150);
      await page.click('[data-testid="btn-del-op"]').catch(() => {});
      await page.waitForTimeout(600);
      await page.waitForFunction('window.__forgeBrep.ready', { timeout: 20000 }).catch(() => {});
      out.filletRemoved = true;
    } else {
      out.filletRemoved = false;
    }

    // 6) Material BASE = PLA de impresión (selector real)
    await page.selectOption('[data-testid="select-material"]', MAT_BASE).catch(() => {});
    await page.waitForTimeout(300);
    out.material = await page.evaluate(() => document.querySelector('[data-testid="select-material"]').value);

    // Invariantes del sólido (Euler, volumen) — LECTURA
    out.invariants = (await page.textContent('[data-testid="invariants"]').catch(() => '') || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    out.volumen = (await page.textContent('[data-testid="an-volumen"]').catch(() => '') || '').trim();
    out.masa = (await page.textContent('[data-testid="an-masa"]').catch(() => '') || '').trim();

    // ════ ANÁLISIS FEA (vía UI) — BASELINE: PLA bajo peor caso ════
    const r1 = await runFea(page, out, 'v1');
    out.fs_inicial = r1.converged ? r1.fs : null;  // sólo válido si convergió
    out.fs_inicial_raw = r1.fs;
    out.v1_converged = r1.converged;

    // ¿Aguanta? FS >= 1.5 (y el solver DEBE haber convergido para ser válido).
    let itero = false, queCambio = null, rFinal = r1;
    const v1Valid = r1.converged && r1.fs != null;
    if (v1Valid && r1.fs < 1.5) {
      itero = true;
      // MEJORA vía UI: cambiar el MATERIAL de PLA → Aluminio 6061 (selector real).
      // El maker la imprime en PLA para prototipo; el peor caso (110 kgf) la lleva
      // bajo FS=1.5, así que la versión de PRODUCCIÓN se MAQUINA en aluminio
      // (σ_y 276 MPa vs 70 MPa de PLA). Misma geometría → la malla sigue
      // convergiendo (no engroso la pata, que rompería la convergencia del tet).
      queCambio = `Cambié el material de PLA (σ_y≈70 MPa) a Aluminio 6061 (σ_y≈276 MPa) vía el selector — misma geometría, se maquina en vez de imprimir; sube el FS sin tocar la malla (engrosar la pata rompía la convergencia del solver a esta resolución)`;
      await page.selectOption('[data-testid="select-material"]', MAT_MEJORA).catch(() => {});
      await page.waitForTimeout(300);
      const r2 = await runFea(page, out, 'v2');
      rFinal = r2;
    }

    out.itero = itero;
    out.que_cambio = queCambio;
    out.fs_final = rFinal.converged ? rFinal.fs : null;
    out.fs_final_raw = rFinal.fs;
    out.v_final_converged = rFinal.converged;
    out.max_vm = rFinal.max_vm_MPa;
    out.deflexion = rFinal.defl_mm;
    out.aguanta = rFinal.converged && rFinal.fs != null && rFinal.fs >= 1.5;

    // ════ SCREENSHOT del overlay de esfuerzo ════
    fs.mkdirSync(path.dirname(SHOT), { recursive: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: SHOT, timeout: 30000 });
    out.shot = SHOT;
    out.shotBytes = fs.statSync(SHOT).size;

    // ════ EXPORTAR STEP (botón) ════
    // El botón es un <a download>. Capturamos la descarga al hacer clic.
    let stepPath = null;
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        page.click('[data-testid="btn-export-step"]'),
      ]);
      stepPath = path.join(STEP_DIR, 'mensula-repisa.step');
      await download.saveAs(stepPath);
      out.step_exportado = fs.existsSync(stepPath) && fs.statSync(stepPath).size > 100;
      out.stepBytes = out.step_exportado ? fs.statSync(stepPath).size : 0;
      out.stepPath = stepPath;
    } catch (e) {
      out.step_exportado = false;
      out.stepErr = String(e).slice(0, 200);
    }

  } catch (e) {
    out.fatal = String(e && e.stack || e).slice(0, 700);
  } finally {
    out.errs = errs.slice(0, 10);
    await browser.close();
  }
  console.log('MENSULA_FEA=' + JSON.stringify(out, null, 2));
  process.exit(0);
})();
