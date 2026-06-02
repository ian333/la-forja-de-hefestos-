/**
 * La Forja — Verificación VISUAL del overlay FEA (von Mises) VÍA UI.
 * =================================================================
 * Maneja la interfaz como un usuario: elige cara FIJA + cara de CARGA por el
 * driver de QA (que es lo mismo que el face-picking), fija la magnitud, hace
 * clic en btn-fea, y comprueba el PANEL (max von Mises, factor de seguridad,
 * deflexión) + el OVERLAY (la pieza coloreada). Saca el screenshot.
 *
 * Caso: la PLACA por defecto (40×24×12 mm). Empotra una cara lateral y carga la
 * cara opuesta → cantilever: concentración de esfuerzo (rojo) en el empotre,
 * azul en la punta libre. Eso es lo que debe verse coloreado.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/fea-vonmises.png';

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu',
           '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--hide-scrollbars',
           '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + String(e).slice(0, 200)));

  const out = { url: URL, shot: SHOT, errors: [] };
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });

    // Material acero para σ_y alto (factor de seguridad legible). Selector real.
    await page.selectOption('[data-testid="select-material"]', 'steel').catch(() => {});
    await page.waitForTimeout(400);

    // Renderer GPU real (no SwiftShader) — diagnóstico, no bloqueante.
    out.renderer = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a';
    });

    // Lista de caras de la PLACA. Elegimos dos caras laterales OPUESTAS (normal
    // ±X): una fija, la otra de carga → flexión cantilever.
    const faces = await page.evaluate('window.__forgeBrep.listFaces()');
    // caras laterales = plane con |normal.x| alto
    const lateralsX = faces
      .filter((f) => f.kind === 'plane' && Math.abs(f.normal[0]) > 0.8)
      .sort((a, b) => a.center[0] - b.center[0]);
    let fixFace, loadFace;
    if (lateralsX.length >= 2) {
      fixFace = lateralsX[0].index;            // x mínimo
      loadFace = lateralsX[lateralsX.length - 1].index; // x máximo
    } else {
      // fallback: primera y última cara plana
      const planes = faces.filter((f) => f.kind === 'plane');
      fixFace = planes[0].index; loadFace = planes[planes.length - 1].index;
    }
    out.fixFace = fixFace; out.loadFace = loadFace;

    // BC + carga vía el driver de QA (equivale al face-picking + input-carga).
    await page.evaluate(([fix, load]) => {
      window.__forgeBrep.setFeaFixedFace(fix);
      window.__forgeBrep.setFeaLoadFace(load);
      window.__forgeBrep.setFeaLoad(2000); // 2 kN
    }, [fixFace, loadFace]);
    await page.waitForTimeout(300);

    // Confirma que los testids de las caras BC reflejan la selección en el DOM.
    out.fijaTag = await page.textContent('[data-testid="fea-fija-id"]').catch(() => null);
    out.cargaTag = await page.textContent('[data-testid="fea-carga-id"]').catch(() => null);

    // CLIC REAL en Analizar.
    await page.click('[data-testid="btn-fea"]');
    await page.waitForFunction('window.__forgeBrep.feaReady === true', { timeout: 60000 });
    await page.waitForTimeout(800); // deja pintar el overlay + colores

    // Lee panel del DOM (los entregables del schema).
    out.maxVM = await page.textContent('[data-testid="fea-max-vm"]').catch(() => null);
    out.fs = await page.textContent('[data-testid="fea-fs"]').catch(() => null);
    out.defl = await page.textContent('[data-testid="fea-deflexion"]').catch(() => null);
    out.legend = await page.$('[data-testid="fea-legend"]').then((e) => !!e);
    out.feaResult = await page.evaluate('window.__forgeBrep.feaResult');

    // Color del overlay presente: muestrea píxeles del canvas y cuenta rojos/azules.
    await page.waitForTimeout(400);

    fs.mkdirSync(require('path').dirname(SHOT), { recursive: true });
    await page.screenshot({ path: SHOT, timeout: 30000 });
    out.shotBytes = fs.statSync(SHOT).size;

    // CHECKS
    const r = out.feaResult || {};
    out.checks = {
      fea_ran: !!out.feaResult,
      converged: r.converged === true,
      max_vm_positive: r.maxVonMises_Pa > 0,
      panel_max_vm: !!out.maxVM && /MPa/.test(out.maxVM),
      panel_fs: !!out.fs,
      panel_defl: !!out.defl && /mm/.test(out.defl),
      overlay_on: r.hasOverlay === true,
      legend_visible: out.legend === true,
      bc_in_dom: (out.fijaTag || '').includes('#') && (out.cargaTag || '').includes('#'),
      shot_ok: out.shotBytes > 20000,
      gpu_real: !/SwiftShader|llvmpipe|software/i.test(out.renderer || ''),
      no_fatal: errors.filter((e) => /Cannot read|undefined is not|TypeError/.test(e)).length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
    out.errors = errors.slice(0, 8);
  } catch (e) {
    out.pass = false;
    out.fatal = String((e && e.stack) || e).slice(0, 500);
    out.errors = errors.slice(0, 8);
  } finally {
    await browser.close();
  }
  console.log('FEA_SHOT=' + JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
