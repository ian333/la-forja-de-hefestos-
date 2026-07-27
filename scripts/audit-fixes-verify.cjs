/**
 * Verificación VISUAL de los fixes de la auditoría (TOP-10).
 * Captura los estados que arreglé para revisarlos a ojo:
 *   A initial        → contraste AA, sin pastillas de debug, layout.
 *   B sketch-poly    → toolbar del croquis lleno → Cancelar/Terminar FIJOS a la derecha (#4).
 *   C curso-split    → overlay MOLD TOOLS ACOTADO (max-height) sin tapar el sólido (#2).
 *   D curso-collapsed→ overlay PLEGADO con el botón ▾ (#2).
 * GPU real (ANGLE D3D12). No toca el kernel: maneja la UI por clics.
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:4173/forja-brep.html';
const OUT = process.env.OUT || '/tmp/audit-fixes';
const fs = require('fs');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
           '--use-gl=angle', '--use-angle=gl', '--disable-software-rasterizer',
           '--hide-scrollbars', '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + String(e).slice(0, 160)));
  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png`, timeout: 30000 });
  const out = { url: URL, shots: [], errors: [], renderer: null };

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    // el doc inicial está VACÍO (sin sólido por defecto) → .ready no aplica; el
    // curso construye su propia geometría. Espera a que el KERNEL + canvas estén.
    await page.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.curso && document.querySelector("canvas"))', { timeout: 120000 });
    await page.waitForTimeout(2500);
    out.renderer = await page.evaluate(() => {
      const c = document.querySelector('canvas'); if (!c) return 'no-canvas';
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      const e = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'no-ext';
    });

    // A — inicial
    await shot('A_initial'); out.shots.push('A_initial');

    // B — croquis con herramienta de parámetros (toolbar lleno)
    await page.click('[data-testid="btn-sketch"]');
    await page.waitForSelector('[data-testid="sketch-chooser"]', { timeout: 8000 });
    await page.click('[data-testid="chooser-plane-xy"]');
    await page.waitForSelector('[data-testid="sketch-editor"]', { timeout: 8000 });
    await page.click('[data-testid="sk-tool-poly"]').catch(() => {});
    await page.waitForTimeout(600);
    await shot('B_sketch_poly'); out.shots.push('B_sketch_poly');
    // ¿Cancelar/Terminar visibles dentro del viewport?
    out.sketchActions = await page.evaluate(() => {
      const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { right: Math.round(b.right), vis: b.right <= window.innerWidth + 1 && b.width > 0 }; };
      return { cancel: r('[data-testid="sk-cancel"]'), finish: r('[data-testid="sk-finish"]'), vw: window.innerWidth };
    });
    // salir del croquis
    await page.click('[data-testid="sk-cancel"]').catch(() => {});
    await page.waitForTimeout(400);

    // C — curso mold hasta split (overlay MOLD TOOLS)
    const clickWait = async (tid, stageAtLeast) => {
      await page.click(`[data-testid="${tid}"]`);
      await page.waitForFunction(
        `window.__forgeBrep && window.__forgeBrep.curso && window.__forgeBrep.curso.stage >= ${stageAtLeast}`,
        { timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(900);
    };
    await clickWait('btn-curso-pieza', 1);
    await clickWait('btn-curso-escala', 2);
    await clickWait('btn-curso-layout', 3);
    await clickWait('btn-curso-parting', 4);
    await clickWait('btn-curso-split', 5);
    await page.waitForTimeout(1200);
    await shot('C_curso_split'); out.shots.push('C_curso_split');
    // medir el alto del overlay (debe estar acotado, no un muro)
    out.overlay = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="curso-report"]');
      if (!el) return null; const b = el.getBoundingClientRect();
      return { h: Math.round(b.height), w: Math.round(b.width), left: Math.round(b.left), top: Math.round(b.top) };
    });

    // D — plegar el overlay
    await page.click('[data-testid="curso-report"] button').catch(() => {});
    await page.waitForTimeout(500);
    await shot('D_curso_collapsed'); out.shots.push('D_curso_collapsed');
    out.overlayCollapsed = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="curso-report"]');
      if (!el) return null; const b = el.getBoundingClientRect();
      return { h: Math.round(b.height) };
    });

    out.errors = errors.slice(0, 20);
  } catch (e) {
    out.fatal = String(e).slice(0, 300); out.errors = errors.slice(0, 20);
  } finally {
    fs.writeFileSync(`${OUT}/result.json`, JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
  }
})();
