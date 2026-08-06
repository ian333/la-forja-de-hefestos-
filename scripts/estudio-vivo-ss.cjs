/**
 * ARNÉS DE "EL ESTUDIO VIVO" — abre la pantalla REAL y la MANEJA.
 * ============================================================================
 * El gate no es "compila": es *se puede usar*. Este arnés prende CADA capa, ORBITA
 * la cámara de verdad (arrastre con el mouse sobre el canvas), hace CLIC en modo
 * sonda y guarda un screenshot por estado, para que un humano (o un agente con
 * ojos) los abra y JUZGUE: ¿se ve la pieza?, ¿la leyenda trae números?, ¿la sonda
 * devuelve algo creíble?, ¿la barra de verificación dice la verdad?
 *
 * Corre en iangpu (GPU real vía ANGLE/D3D12). Vite DEV, no preview: el panel lee
 * los STL del banco por `/test-parts/...` y dev sirve la raíz del repo.
 *
 * Uso (en iangpu, con el repo en /home/ian/Orkesta/la-forja):
 *   cd /home/ian/Orkesta/la-forja && \
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   URL=http://localhost:5178/estudio-vivo.html node scripts/estudio-vivo-ss.cjs
 *
 * Variables: URL (default :5178/estudio-vivo.html) · SHOTDIR (default forja-shots).
 */
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.URL || 'http://localhost:5178/estudio-vivo.html';
const DIR = process.env.SHOTDIR || '/home/ian/Orkesta/la-forja/forja-shots/estudio-vivo';
const W = Number(process.env.W || 1600), H = Number(process.env.H || 1000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

  // los avisos benignos de three/WebGL no son fallas de la pantalla
  const benigno = (s) => /WebGL context|WebGL2?RenderingContext|THREE\.WebGLRenderer|Download the React DevTools/i.test(s);
  const errs = [], warns = [], ignorados = [];
  page.on('pageerror', (e) => { const s = String(e).slice(0, 260); if (!benigno(s)) errs.push(s); });
  page.on('console', (m) => {
    const url = (m.location() && m.location().url) || '';
    const s = `${m.type()}: ${m.text()}`.slice(0, 260) + (url ? ` @ ${url.slice(-40)}` : '');
    // el favicon.ico NO existe en este repo (ninguna página lo trae) — su 404 no es
    // un defecto de esta pantalla. Se IGNORA pero se DEJA ANOTADO, no se esconde.
    if (/favicon\.ico/.test(url)) { ignorados.push(s); return; }
    if (m.type() === 'error' && !benigno(s)) errs.push(s);
    else if (m.type() === 'warning' && !benigno(s)) warns.push(s);
  });

  const fallidas = [];
  page.on('response', (r) => { if (r.status() >= 400) fallidas.push(`${r.status()} ${r.url().slice(0, 120)}`); });

  const out = { url: URL, checks: {}, capas: {}, errs, warns, ignorados, fallidas, shots: [] };
  const disparo = async (nombre) => {
    const p = `${DIR}/${nombre}.png`;
    await page.screenshot({ path: p, timeout: 30000 });
    out.shots.push(p);
    return p;
  };
  const estado = () => page.evaluate(() => window.__estudioVivo || null);

  /** espera a que la capa activa deje de estar en ⏳ (o falle) */
  const esperarCapa = async (ms = 90000) => {
    const t0 = Date.now();
    for (;;) {
      const s = await estado();
      if (s && s.estado !== 'calculando' && s.estado !== 'sin-malla') return s;
      if (Date.now() - t0 > ms) return s;
      await sleep(400);
    }
  };

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // GOTCHA de la casa (reference_forja_brep_verify_gotcha): NO esperar ".ready".
    // Aquí el equivalente es la API de la pantalla + el canvas montado.
    await page.waitForSelector('[data-testid="estudio-vivo-view"]', { timeout: 45000 });
    await page.waitForFunction('!!window.__estudioVivo && !!document.querySelector("canvas")', null, { timeout: 60000 });
    await page.waitForFunction('window.__estudioVivo && window.__estudioVivo.nTri > 0', null, { timeout: 60000 });
    await sleep(1200);

    // ── ¿es GPU REAL o SwiftShader? (la laptop miente, iangpu no) ──
    out.gpu = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
      if (!gl) return 'sin contexto';
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'sin extensión';
    });
    out.checks.gpu_real = !/SwiftShader|llvmpipe|software/i.test(String(out.gpu));

    const s0 = await estado();
    out.matricula = s0.matricula;
    out.checks.matricula_presente = !!s0.matricula && /chi=/.test(s0.matricula);
    out.checks.coherencia_declarada = s0.coherente === true || s0.coherente === false;
    out.checks.barra_verificacion = await page.$$eval('[data-testid="ev-verificacion"]', (e) => e.length === 1);
    out.checks.fiducial_dibujado = await page.$$eval('[data-testid="ev-fiducial"] svg *', (e) => e.length > 8);

    // ── CADA CAPA: prender, esperar, verificar leyenda + sondear ──
    const CAPAS = ['forma', 'espesor', 'draft', 'visible', 'flujo', 'termico'];
    for (const capa of CAPAS) {
      await page.click(`[data-testid="ev-capa-${capa}"]`);
      await sleep(300);
      const s = await esperarCapa();
      await sleep(700);

      const r = { estado: s ? s.estado : 'nulo', dom: s ? s.dom : null, unidad: s ? s.unidad : null, seccion: s ? s.seccion : null, sinDatoPct: s ? s.sinDatoPct : null };

      // la LEYENDA tiene que existir y traer NÚMEROS (la escala fija sin números no sirve)
      if (capa !== 'forma') {
        const ley = await page.$eval('[data-testid="ev-leyenda"]', (e) => e.textContent || '').catch(() => '');
        r.leyenda_ok = /ESCALA FIJA/.test(ley) && /dominio/.test(ley) && /gris = NO MEDIDO/.test(ley)
          && /RIESGO = el extremo (ROJO|AZUL)/.test(ley);
        r.leyenda_txt = ley.replace(/\s+/g, ' ').slice(0, 190);
      }

      // ── SONDA: clic en el CENTRO del visor (ahí está la pieza tras el encuadre) ──
      const bb = await page.$eval('[data-testid="ev-visor"]', (e) => {
        const b = e.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      });
      await page.mouse.click(bb.x + bb.w * 0.5, bb.y + bb.h * 0.46);
      await sleep(450);
      const s2 = await estado();
      r.lectura = s2 && s2.lectura ? { etiqueta: s2.lectura.etiqueta, valor: s2.lectura.valor, texto: s2.lectura.texto } : null;
      r.sonda_devuelve_algo = !!r.lectura;
      // "creíble" = número finito dentro (o tocando) el dominio fijo de la capa, o
      // un "sin dato" HONESTO. Lo prohibido es un número sin sentido físico.
      if (r.lectura && Number.isFinite(r.lectura.valor) && r.dom) {
        const [a, b] = r.dom, m = (b - a) * 0.5;
        r.sonda_en_rango = r.lectura.valor >= a - m && r.lectura.valor <= b + m;
      } else if (r.lectura) {
        r.sonda_en_rango = /sin dato|x |mm/.test(String(r.lectura.texto));
      }

      if (capa === 'termico') {
        r.resuelveLaPared = s2 ? s2.resuelveLaPared : null;
        const v = await page.$eval('[data-testid="ev-resuelve-pared"]', (e) => (e.textContent || '').replace(/\s+/g, ' ')).catch(() => '');
        r.pared_declarada = /RESUELVE LA PARED/.test(v);
        r.pared_txt = v.slice(0, 220);
      }
      const banda = await page.$eval('[data-testid="ev-banda"]', (e) => (e.textContent || '').replace(/\s+/g, ' ')).catch(() => '');
      r.banda_txt = banda.slice(0, 190);
      r.banda_declarada = banda.length > 5;

      out.capas[capa] = r;
      await disparo(`capa-${capa}`);
    }

    out.checks.todas_las_capas_resuelven = CAPAS.every((c) => out.capas[c].estado === 'lista');
    out.checks.todas_con_leyenda = CAPAS.filter((c) => c !== 'forma').every((c) => out.capas[c].leyenda_ok);
    out.checks.todas_con_banda = CAPAS.every((c) => out.capas[c].banda_declarada);
    out.checks.sonda_en_todas = CAPAS.every((c) => out.capas[c].sonda_devuelve_algo);
    out.checks.sonda_creible = CAPAS.every((c) => out.capas[c].sonda_en_rango !== false);
    out.checks.pared_declarada = !!out.capas.termico.pared_declarada;
    out.checks.pared_es_dato = !!out.capas.termico.resuelveLaPared && typeof out.capas.termico.resuelveLaPared.ok === 'boolean';

    // ── ORBITAR de verdad: arrastre sobre el canvas y la cámara TIENE que moverse ──
    await page.click('[data-testid="ev-capa-espesor"]');
    await sleep(500);
    const bb = await page.$eval('[data-testid="ev-visor"]', (e) => {
      const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    // se SONDEA primero: si no hay lectura previa, comparar null contra null haría
    // pasar el check de "arrastrar no sondea" sin haber probado nada.
    await page.mouse.click(bb.x + bb.w * 0.5, bb.y + bb.h * 0.46);
    await sleep(400);
    const est0 = await estado();
    const antes = est0.camDir;
    const lecturaAntesDelArrastre = JSON.stringify(est0.lectura);
    out.checks.hay_lectura_antes_del_arrastre = !!est0.lectura;
    await page.mouse.move(bb.x + bb.w * 0.5, bb.y + bb.h * 0.5);
    await page.mouse.down();
    for (let i = 1; i <= 14; i++) {
      await page.mouse.move(bb.x + bb.w * 0.5 + i * 17, bb.y + bb.h * 0.5 - i * 6);
      await sleep(28);
    }
    await page.mouse.up();
    await sleep(900);
    const est1 = await estado();
    const despues = est1.camDir;
    const cos = antes[0] * despues[0] + antes[1] * despues[1] + antes[2] * despues[2];
    out.orbita = { antes, despues, gradosGirados: +(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI).toFixed(1) };
    out.checks.orbita_mueve_camara = out.orbita.gradosGirados > 8;
    // y la SONDA no se dispara al arrastrar: si lo hiciera, girar la pieza sería
    // imposible sin dejar una lectura falsa en cada giro. Se mide comparando la
    // lectura de ANTES contra la de DESPUÉS del arrastre.
    out.checks.arrastre_no_sondea = JSON.stringify(est1.lectura) === lecturaAntesDelArrastre;
    await disparo('orbitada');

    // ── ZOOM con la rueda ──
    await page.mouse.move(bb.x + bb.w * 0.5, bb.y + bb.h * 0.5);
    await page.mouse.wheel(0, -420);
    await sleep(700);
    await disparo('acercada');

    // ── VIVO: voltear la pieza recalcula el veredicto de orientación ──
    const draftAntes = await page.evaluate(() => {
      const e = document.querySelector('[data-testid="ev-resumen"]');
      return e ? (e.textContent || '').replace(/\s+/g, ' ') : '';
    });
    await page.click('[data-testid="ev-voltear"]');
    await sleep(1400);
    const draftDespues = await page.evaluate(() => {
      const e = document.querySelector('[data-testid="ev-resumen"]');
      return e ? (e.textContent || '').replace(/\s+/g, ' ') : '';
    });
    out.volteo = { antes: draftAntes.slice(0, 170), despues: draftDespues.slice(0, 170) };
    out.checks.voltear_recalcula = draftAntes !== draftDespues;
    await disparo('volteada');
    await page.click('[data-testid="ev-voltear"]');
    await sleep(900);

    // ── VIVO: cambiar de pieza ── */
    await page.click('[data-testid="ev-pieza-tapa"]');
    await sleep(2200);
    const sTapa = await esperarCapa();
    out.checks.cambia_de_pieza = !!sTapa && sTapa.pieza !== 'carcasa RPi4' && sTapa.nTri > 0;
    out.piezaNueva = sTapa ? { pieza: sTapa.pieza, nTri: sTapa.nTri, matricula: sTapa.matricula, coherente: sTapa.coherente } : null;
    await disparo('pieza-tapa');
    await page.click('[data-testid="ev-pieza-rpi4"]');
    await sleep(1800);

    // ── VIVO: bajar la celda del térmico y volver a preguntar por la pared ──
    await page.click('[data-testid="ev-capa-termico"]');
    await esperarCapa();
    await sleep(400);
    // clic por DOM, NO page.click(): el recálculo bloquea el hilo principal y
    // playwright se queda esperando "scheduled navigations" hasta el timeout aunque
    // la acción ya ocurrió (cazado en la corrida del 2026-08-06).
    await page.$eval('[data-testid="ev-celda-term-4"]', (el) => el.click());
    await sleep(600);
    const sFino = await esperarCapa(240000);
    out.termicoFino = sFino ? sFino.resuelveLaPared : null;
    out.checks.celda_fina_recalcula = !!out.termicoFino && out.termicoFino.celdaMm === 4;
    await disparo('termico-celda4');

    out.checks.sin_errores_de_pagina = errs.length === 0;
    // 404s: un STL que no carga rompería el estudio en silencio
    out.checks.sin_recursos_404 = !fallidas.some((f) => /test-parts|\.tsx|\.ts\b/.test(f));
  } catch (e) {
    out.fatal = String((e && e.stack) || e).slice(0, 700);
    try { await disparo('FATAL'); } catch { /* el navegador pudo morir */ }
  } finally {
    await browser.close();
  }

  const pass = !out.fatal && Object.values(out.checks).every(Boolean);
  fs.writeFileSync(`${DIR}/reporte.json`, JSON.stringify({ pass, ...out }, null, 1));
  console.log(JSON.stringify({ pass, ...out }, null, 1));
  process.exit(pass ? 0 : 1);
})();
