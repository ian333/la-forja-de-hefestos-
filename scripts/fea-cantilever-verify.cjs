/**
 * La Forja — VERIFICACIÓN DE RIGOR del FEA contra TEORÍA DE VIGA, vía UI.
 * =====================================================================
 * Caso canónico: viga cantilever (empotrada-libre) L=100 x b=10 x h=20 mm,
 * Aluminio 6061 (E=68.9 GPa). Cara z=0 EMPOTRADA; carga TRANSVERSAL F=200 N en
 * la cara libre (z=100). Se maneja la UI (driver de QA = mismo path que el
 * face-picking + botón Analizar) y se LEEN del DOM fea-max-vm y fea-deflexion.
 *
 * Analítico:
 *   I = b·h^3/12 = 10·20^3/12 = 6666.67 mm^4
 *   M = F·L = 200·100 = 20000 N·mm ; c = h/2 = 10
 *   σ = M·c/I = 30 MPa
 *   δ = F·L^3/(3·E·I) ; con E=68900 MPa → 0.14512 mm  (E=69000 → 0.14491)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const SHOT = process.env.SHOT || '/home/ian/Orkesta/la-forja/forja-shots/fea-cantilever.png';

const L = 100, b = 10, h = 20;       // mm
const F = 200;                       // N
const E = 68900;                     // MPa (aluminio_6061 = 68.9 GPa)
const I = (b * h ** 3) / 12;         // mm^4 = 6666.67
const M = F * L;                     // N·mm = 20000
const sigmaAnalytic = (M * (h / 2)) / I;            // MPa = 30
const deltaAnalytic = (F * L ** 3) / (3 * E * I);   // mm = 0.14512

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu',
           '--ignore-gpu-blocklist','--disable-software-rasterizer','--hide-scrollbars',
           '--window-size=1600,1000'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,200)); });
  page.on('pageerror', e => errs.push('PAGEERR '+String(e).slice(0,200)));

  const out = { sigmaAnalytic, deltaAnalytic, I, M, errs: [] };
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 60000 });

    out.renderer = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a';
    });

    // ── 1) Sketch rect b×h y extrude depth=L (beam axis = Z) ──
    await page.evaluate(({b,h}) => {
      window.__forgeBrep.setSketch(s => ({ ...s, kind: 'rect', width: b, height: h }));
    }, {b,h});
    await page.waitForTimeout(400);
    // localizar la op extrude y ponerle depth=L
    const exId = await page.evaluate(() => {
      const ops = window.__forgeBrep.opsList || [];
      const ex = ops.find(o => o.type === 'extrude');
      return ex ? ex.id : null;
    });
    out.extrudeId = exId;
    if (exId) {
      await page.evaluate(({id,L}) => window.__forgeBrep.updateOp(id, { depth: L }), {id:exId,L});
    }
    await page.waitForTimeout(600);
    await page.waitForFunction('window.__forgeBrep.ready', { timeout: 30000 });

    // material alu (default) — fijar explícito vía selector real
    await page.selectOption('[data-testid="select-material"]', 'alu').catch(()=>{});
    await page.waitForTimeout(300);
    out.materialSel = await page.evaluate(() => document.querySelector('[data-testid="select-material"]').value);

    // ── 2) caras: cap z≈0 (fija) y cap z≈L (libre/carga) ──
    const faces = await page.evaluate(() => window.__forgeBrep.listFaces());
    out.faces = faces.map(f => ({ index:f.index, kind:f.kind, center:f.center.map(v=>+v.toFixed(2)), normal:f.normal.map(v=>+v.toFixed(3)), area:+f.area.toFixed(1) }));
    // caps = caras cuya normal es ±Z (|nz| alto)
    const caps = faces.filter(f => Math.abs(f.normal[2]) > 0.8).sort((a,b)=>a.center[2]-b.center[2]);
    if (caps.length < 2) throw new Error('No se encontraron 2 caras-cap ±Z (geometría inesperada).');
    const fixFace = caps[0].index;        // z mínimo (≈0)
    const loadFace = caps[caps.length-1].index; // z máximo (≈L)
    out.fixFace = fixFace; out.loadFace = loadFace;
    out.fixCenterZ = +caps[0].center[2].toFixed(2);
    out.loadCenterZ = +caps[caps.length-1].center[2].toFixed(2);

    // ── 3) BC + carga (200 N) ──
    await page.evaluate(({fix,load,F}) => {
      window.__forgeBrep.setFeaFixedFace(fix);
      window.__forgeBrep.setFeaLoadFace(load);
      window.__forgeBrep.setFeaLoad(F);
    }, {fix:fixFace, load:loadFace, F});
    await page.waitForTimeout(300);
    out.fijaTag = await page.textContent('[data-testid="fea-fija-id"]').catch(()=>null);
    out.cargaTag = await page.textContent('[data-testid="fea-carga-id"]').catch(()=>null);
    out.cargaInput = await page.evaluate(() => window.__forgeBrep.feaResult ? null : (window.__forgeBrep && true));

    // ── 4) Analizar con carga TRANSVERSAL (−Y = dirección de h, c=h/2) ──
    // (Mismo solver/DOM que el botón; dir explícita perpendicular al eje Z.)
    await page.evaluate(() => window.__forgeBrep.runFEADir([0, -1, 0]));
    await page.waitForFunction('window.__forgeBrep.feaBusy === false && window.__forgeBrep.feaReady === true', { timeout: 90000 });
    await page.waitForTimeout(800);

    // ── 5) Leer DOM ──
    out.domMaxVM = await page.textContent('[data-testid="fea-max-vm"]').catch(()=>null);
    out.domDefl  = await page.textContent('[data-testid="fea-deflexion"]').catch(()=>null);
    out.domFS    = await page.textContent('[data-testid="fea-fs"]').catch(()=>null);
    out.domMesh  = await page.textContent('[data-testid="fea-mesh"]').catch(()=>null);
    out.feaResult = await page.evaluate(() => window.__forgeBrep.feaResult);

    // parse numéricos del DOM
    const num = (s) => { const m = (s||'').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
    out.sigmaFEA = num(out.domMaxVM);     // MPa
    out.deltaFEA = num(out.domDefl);      // mm
    out.sigmaErrPct = out.sigmaFEA!=null ? +(100*(out.sigmaFEA - sigmaAnalytic)/sigmaAnalytic).toFixed(1) : null;
    out.deltaErrPct = out.deltaFEA!=null ? +(100*(out.deltaFEA - deltaAnalytic)/deltaAnalytic).toFixed(1) : null;

    // ── 6) screenshot ──
    await page.waitForTimeout(400);
    fs.mkdirSync(path.dirname(SHOT), { recursive: true });
    await page.screenshot({ path: SHOT, timeout: 30000 });
    out.shotBytes = fs.statSync(SHOT).size;

    const r = out.feaResult || {};
    out.checks = {
      fea_ran: !!out.feaResult,
      converged: r.converged === true,
      vm_positive_finite: r.maxVonMises_Pa > 0 && Number.isFinite(r.maxVonMises_Pa),
      defl_positive_finite: r.maxDisplacement_mm > 0 && Number.isFinite(r.maxDisplacement_mm),
      sigma_within_band: out.sigmaFEA!=null && out.sigmaFEA > 0.5*sigmaAnalytic && out.sigmaFEA < 2.2*sigmaAnalytic,
      defl_within_band: out.deltaFEA!=null && out.deltaFEA > 0.5*deltaAnalytic && out.deltaFEA < 1.6*deltaAnalytic,
      gpu_real: !/SwiftShader|llvmpipe|software/i.test(out.renderer||''),
      shot_ok: out.shotBytes > 20000,
      no_fatal: errs.filter(e => /Cannot read|undefined is not|TypeError/.test(e)).length === 0,
    };
    out.pass = Object.values(out.checks).every(Boolean);
  } catch (e) {
    out.pass = false;
    out.fatal = String(e && e.stack || e).slice(0,600);
  } finally {
    out.errs = errs.slice(0,8);
    await browser.close();
  }
  console.log('FEA_VERIFY='+JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 2);
})();
