/**
 * ARNÉS DE LAS VISTAS 3D DE CAMPO — abre las DOS y las MANEJA de verdad.
 * ============================================================================
 * El gate no es "compila": es *se puede usar y no miente*. Este arnés barre el
 * control `t`, ORBITA con el mouse sobre el canvas, hace CLIC de sonda y guarda
 * un PNG por estado, para que un agente con OJOS los abra y JUZGUE:
 *   · ¿se ve la deformación?, ¿el factor de exageración está IMPRESO?
 *   · ¿las líneas de agua se ven DENTRO del acero transparente o flotando?
 *   · ¿la intersección ROJA aparece donde debe?
 *
 * Y mide DOS invariantes baratos y fuertes, punta a punta por la UI real:
 *   1. con exageración 0 la deformada = la original BIT A BIT;
 *   2. δ escala LINEALMENTE con el factor (duplicar el factor duplica δ).
 *
 * Corre en iangpu (GPU real vía ANGLE/D3D12). Vite DEV, no preview: la página
 * lee los STL del banco por `/test-parts/...` y dev sirve la raíz del repo.
 *
 * Uso (en iangpu, repo en /home/ian/Orkesta/la-forja):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   URL=http://localhost:5178/vista3d-campo.html \
 *   node /home/ian/Orkesta/la-forja/scripts/vista3d-campo-ss.cjs
 *
 * Variables: URL · SHOTDIR · W · H · PIEZA (id del banco).
 */
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.URL || 'http://localhost:5178/vista3d-campo.html';
const DIR = process.env.SHOTDIR || '/home/ian/Orkesta/la-forja/forja-shots/vista3d-campo';
const W = Number(process.env.W || 1600), H = Number(process.env.H || 1000);
const PIEZA = process.env.PIEZA || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

  const benigno = (s) => /WebGL context|WebGL2?RenderingContext|THREE\.WebGLRenderer|Download the React DevTools/i.test(s);
  const errs = [], warns = [], ignorados = [];
  page.on('pageerror', (e) => { const s = String(e).slice(0, 300); if (!benigno(s)) errs.push(s); });
  page.on('console', (m) => {
    const url = (m.location() && m.location().url) || '';
    const s = `${m.type()}: ${m.text()}`.slice(0, 300) + (url ? ` @ ${url.slice(-40)}` : '');
    if (/favicon\.ico/.test(url)) { ignorados.push(s); return; }
    if (m.type() === 'error' && !benigno(s)) errs.push(s);
    else if (m.type() === 'warning' && !benigno(s)) warns.push(s);
  });
  const fallidas = [];
  page.on('response', (r) => { if (r.status() >= 400) fallidas.push(`${r.status()} ${r.url().slice(0, 120)}`); });

  const out = { url: URL, checks: {}, alabeo: {}, agua: {}, errs, warns, ignorados, fallidas, shots: [] };
  const disparo = async (n) => {
    const p = `${DIR}/${n}.png`;
    await page.screenshot({ path: p, timeout: 30000 });
    out.shots.push(p);
    return p;
  };
  const estado = (id) => page.evaluate((k) => (window.__vista3d && window.__vista3d[k]) || null, id);
  const app = () => page.evaluate(() => window.__vista3dApp || null);

  /** mueve el slider de `t` como lo movería un dedo (React escucha `input`) */
  const ponerT = async (v) => {
    await page.$eval('[data-testid="v3d-t"]', (el, val) => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(el, String(val));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);
    await sleep(420);
  };
  const bbVisor = () => page.$eval('[data-testid="v3d-visor"]', (e) => {
    const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height };
  });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="v3d-view"]', { timeout: 45000 });
    await page.waitForFunction('!!window.__vista3dApp', null, { timeout: 60000 });
    await page.waitForFunction('window.__vista3dApp && window.__vista3dApp.nTri > 0', null, { timeout: 90000 });
    await page.waitForFunction('!!document.querySelector("canvas")', null, { timeout: 60000 });
    if (PIEZA) { await page.click(`[data-testid="v3d-pieza-${PIEZA}"]`); await sleep(2500); }
    await sleep(1800);

    out.gpu = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
      if (!gl) return 'sin contexto';
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'sin extensión';
    });
    out.checks.gpu_real = !/SwiftShader|llvmpipe|software/i.test(String(out.gpu));
    out.app = await app();

    /* ══════════════════════════ LA PIEZA SE DEFORMA ══════════════════════ */
    await page.click('[data-testid="v3d-vista-alabeo"]');
    await page.waitForFunction('!!(window.__vista3d && window.__vista3d.alabeo)', null, { timeout: 90000 });
    await sleep(1200);

    const A = out.alabeo;
    // barrido del control, con captura y medición en cada estación
    A.barrido = [];
    for (const v of [0, 0.25, 0.5, 1]) {
      await ponerT(v);
      const s = await estado('alabeo');
      A.barrido.push({ t: v, factor: s.factor, deltaRealMm: s.deltaRealMm, deltaPantallaMm: s.deltaPantallaMm });
      await disparo(`alabeo-t${String(v).replace('.', '')}`);
    }
    const s05 = await estado('alabeo');
    A.modo = s05.modo; A.razonModo = s05.razonModo;
    A.radioKazmerMm = s05.radioKazmerMm; A.radioVerdaderoMm = s05.radioVerdaderoMm;
    A.arco = s05.arco; A.criterioPandeo = s05.criterioPandeo;
    A.dom = s05.dom; A.riesgo = s05.riesgo; A.factorMax = s05.factorMax;
    A.escalaEncaje = s05.escalaEncaje; A.notaEncaje = s05.notaEncaje;
    A.invariantesDelModulo = s05.invariantes;
    A.notas = s05.notas;

    // ── INVARIANTE 1: exageración 0 ⇒ deformada = original BIT A BIT ──
    A.inv_cero_bit_a_bit = !!(s05.invariantes && s05.invariantes.ceroEsIdentico && s05.invariantes.nDiferentes === 0);
    const b0 = A.barrido.find((b) => b.t === 0);
    A.inv_cero_delta_pantalla = !!b0 && b0.deltaPantallaMm === 0 && b0.factor === 0;

    // ── INVARIANTE 2: linealidad medida POR LA UI (t=0.25 vs t=0.5) ──
    const b25 = A.barrido.find((b) => b.t === 0.25), b50 = A.barrido.find((b) => b.t === 0.5);
    const razonUI = b25 && b25.deltaPantallaMm > 0 ? b50.deltaPantallaMm / b25.deltaPantallaMm : NaN;
    A.linealidad_ui = { d25: b25 && b25.deltaPantallaMm, d50: b50 && b50.deltaPantallaMm, razon: +(razonUI || 0).toFixed(5) };
    A.inv_lineal_ui = Math.abs(razonUI - 2) < 1e-3;
    A.inv_lineal_modulo = !!(s05.invariantes && s05.invariantes.linealidad && s05.invariantes.linealidad.ok);
    // ── el arco 3D y el δ del libro son la MISMA cosa ──
    A.inv_arco_coincide = !!(s05.arco && s05.arco.coincide);

    // ── SONDA ──
    await ponerT(0.5);
    let bb = await bbVisor();
    await page.mouse.click(bb.x + bb.w * 0.42, bb.y + bb.h * 0.52);
    await sleep(600);
    A.lectura = (await app()).lectura;
    A.sonda_devuelve_algo = !!A.lectura;
    A.sonda_dice_modo = !!(A.lectura && /MODO DOMINANTE/.test(String(A.lectura.nota || '')));
    A.sonda_dice_mm = !!(A.lectura && /mm/.test(String(A.lectura.valor || '')));
    await disparo('alabeo-sonda');

    // ── ORBITAR de verdad ──
    await page.mouse.move(bb.x + bb.w * 0.5, bb.y + bb.h * 0.5);
    await page.mouse.down();
    for (let i = 1; i <= 14; i++) { await page.mouse.move(bb.x + bb.w * 0.5 + i * 16, bb.y + bb.h * 0.5 - i * 7); await sleep(28); }
    await page.mouse.up();
    await sleep(900);
    await disparo('alabeo-orbitada');
    await page.mouse.move(bb.x + bb.w * 0.5, bb.y + bb.h * 0.5);
    await page.mouse.wheel(0, -380);
    await sleep(700);
    await disparo('alabeo-acercada');

    /* ══════════════════════════ EL CIRCUITO DE AGUA ══════════════════════ */
    await page.click('[data-testid="v3d-vista-agua"]');
    await page.waitForFunction('!!(window.__vista3d && window.__vista3d.agua)', null, { timeout: 120000 });
    await sleep(1800);

    const G = out.agua;
    const g0 = await estado('agua');
    G.error = g0.error || null;
    if (!G.error) {
      G.molde = g0.molde; G.diaMm = g0.diaMm;
      G.claroExigidoMm = g0.claroExigidoMm; G.holguraMinMm = g0.holguraMinMm;
      G.nChoques = g0.nChoques; G.nCriticos = g0.nCriticos; G.choques = g0.choques;
      G.pinContorneado = g0.pinContorneado;
      G.circuitos = g0.circuitos; G.proceso = g0.proceso;
      G.dom = g0.dom; G.riesgo = g0.riesgo;
      G.escalaEncaje = g0.escalaEncaje; G.notaEncaje = g0.notaEncaje;
      G.notas = g0.notas; G.avisos = g0.avisos;

      G.barrido = [];
      for (const v of [0, 0.33, 0.66, 1]) {
        await ponerT(v);
        const s = await estado('agua');
        G.barrido.push({ t: v, estacion: s.estacion });
        await disparo(`agua-t${String(v).replace('.', '')}`);
      }
      // el ΔT acumulado tiene que CRECER de IN a OUT (Fig 9.12) y arrancar en 0
      const dt = G.barrido.map((b) => (b.estacion && b.estacion[0] ? b.estacion[0].dtC : NaN));
      G.dt_por_t = dt;
      G.inv_dt_arranca_en_cero = dt[0] === 0;
      G.inv_dt_monotono = dt.every((v, i) => i === 0 || v >= dt[i - 1] - 1e-9);
      G.inv_dt_llega_al_total = Math.abs(dt[dt.length - 1] - (G.circuitos[0] ? G.circuitos[0].dtTotalC : 0)) < 0.02;
      G.inv_holgura_es_dato = Number.isFinite(G.holguraMinMm);
      G.inv_hay_rojo_si_viola = !(G.holguraMinMm < G.claroExigidoMm) || G.nCriticos > 0;

      // la sonda: se prueban varios puntos del molde (el clic tiene que caer
      // SOBRE el acero; un punto fijo al centro es una apuesta, no una prueba)
      await ponerT(0.5);
      bb = await bbVisor();
      G.sonda_intentos = [];
      for (const [fx, fy] of [[0.5, 0.5], [0.44, 0.46], [0.56, 0.55], [0.5, 0.42]]) {
        await page.mouse.click(bb.x + bb.w * fx, bb.y + bb.h * fy);
        await sleep(500);
        const l = (await app()).lectura;
        G.sonda_intentos.push({ fx, fy, titulo: l && l.titulo });
        if (l && /punto tocado/.test(String(l.titulo || ''))) { G.lectura = l; break; }
        G.lectura = l;
      }
      G.sonda_devuelve_algo = !!G.lectura;
      G.sonda_dice_distancia_y_dt = !!(G.lectura && /línea más cercana/.test(String(G.lectura.valor || '')) && /ΔT acumulado/.test(String(G.lectura.valor || '')));
      await disparo('agua-sonda');

      await page.mouse.move(bb.x + bb.w * 0.5, bb.y + bb.h * 0.5);
      await page.mouse.down();
      for (let i = 1; i <= 16; i++) { await page.mouse.move(bb.x + bb.w * 0.5 + i * 15, bb.y + bb.h * 0.5 - i * 8); await sleep(28); }
      await page.mouse.up();
      await sleep(900);
      await disparo('agua-orbitada');
      await page.mouse.move(bb.x + bb.w * 0.5, bb.y + bb.h * 0.5);
      await page.mouse.wheel(0, -420);
      await sleep(700);
      await disparo('agua-acercada');
    }

    /* ── una pieza distinta: las dos vistas tienen que sobrevivir ── */
    await page.click('[data-testid="v3d-pieza-tapa"]');
    await sleep(3200);
    const gTapa = await estado('agua');
    out.checks.agua_otra_pieza = !!gTapa && !gTapa.error;
    out.piezaTapaAgua = gTapa && !gTapa.error ? { molde: gTapa.molde, diaMm: gTapa.diaMm, nCriticos: gTapa.nCriticos, holguraMinMm: gTapa.holguraMinMm } : gTapa;
    await disparo('agua-tapa');
    await page.click('[data-testid="v3d-vista-alabeo"]');
    await sleep(2200);
    const aTapa = await estado('alabeo');
    out.checks.alabeo_otra_pieza = !!aTapa && Number.isFinite(aTapa.deltaRealMm);
    out.piezaTapaAlabeo = aTapa ? { modo: aTapa.modo, deltaRealMm: aTapa.deltaRealMm, arcoCoincide: aTapa.arco && aTapa.arco.coincide, topologia: aTapa.topologia } : null;
    await disparo('alabeo-tapa');

    /* ── resumen de gate ── */
    out.checks.alabeo_cero_bit_a_bit = !!A.inv_cero_bit_a_bit && !!A.inv_cero_delta_pantalla;
    out.checks.alabeo_lineal = !!A.inv_lineal_ui && !!A.inv_lineal_modulo;
    out.checks.alabeo_arco_es_el_delta_del_libro = !!A.inv_arco_coincide;
    out.checks.alabeo_sonda = !!A.sonda_devuelve_algo && !!A.sonda_dice_modo && !!A.sonda_dice_mm;
    out.checks.agua_arma = !G.error;
    out.checks.agua_dt_acumula = !!G.inv_dt_arranca_en_cero && !!G.inv_dt_monotono && !!G.inv_dt_llega_al_total;
    out.checks.agua_holgura_es_dato = !!G.inv_holgura_es_dato;
    out.checks.agua_sonda = !!G.sonda_devuelve_algo && !!G.sonda_dice_distancia_y_dt;
    out.checks.sin_errores_de_pagina = errs.length === 0;
  } catch (e) {
    out.excepcion = String(e).slice(0, 400);
    try { await disparo('EXCEPCION'); } catch { /* nada */ }
  }

  const j = `${DIR}/reporte.json`;
  fs.writeFileSync(j, JSON.stringify(out, null, 2));
  const fallan = Object.entries(out.checks).filter(([, v]) => v === false).map(([k]) => k);
  console.log(JSON.stringify({ gpu: out.gpu, checks: out.checks, fallan, shots: out.shots.length, errs: errs.slice(0, 6), reporte: j }, null, 2));
  await browser.close();
  process.exit(fallan.length || out.excepcion ? 1 : 0);
})();
