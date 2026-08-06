/**
 * ARNÉS DE "EL CICLO" — abre la pantalla REAL y MANEJA EL RELOJ.
 * ============================================================================
 * El gate no es "compila": es *se puede usar y dice la verdad*. Este arnés
 * BARRE el tiempo por las 5 fases (clic en el tramo real de la línea de tiempo),
 * ARRASTRA el slider de segundos, REPRODUCE a velocidad real y a cámara lenta,
 * ORBITA la cámara de verdad, y guarda un PNG por fase para que un humano (o un
 * agente con ojos) los abra y JUZGUE:
 *   ¿la vista 3D cambió de verdad entre fases?
 *   ¿el texto explica algo o solo repite el número?
 *   ¿la curva de enfriamiento cruza T_eject donde debe?
 *
 * Y MIDE lo que no se supone:
 *   · la suma de las fases = el ciclo total (a 1e-6 s);
 *   · el tiempo es monótono (sin huecos ni tramos de duración 0);
 *   · la T del centro BAJA monótona durante todo el enfriamiento — barriendo el
 *     slider DE VERDAD, no leyendo el arreglo precalculado;
 *   · la imagen del visor CAMBIA entre fases (md5 del recorte del visor).
 *
 * Corre en iangpu (GPU real vía ANGLE/D3D12). Vite DEV, no preview: la pantalla
 * lee los STL del banco por `/test-parts/...` y dev sirve la raíz del repo.
 *
 * ⚠ GOTCHA YA PAGADO DOS VECES: el vite de :5178 corre con VITE_NO_WATCH=1 y
 * SIGUE SIRVIENDO EL MÓDULO VIEJO con HTTP 200 después de un scp. Levanta tu
 * propio dev en un puerto libre y confirma con
 *   curl .../src/forja/mold/EstudioCiclo.tsx | grep estudio-ciclo-view
 * que te está sirviendo TU código.
 *
 * Uso (en iangpu, repo en /home/ian/Orkesta/la-forja):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   URL=http://localhost:5193/ciclo.html node /home/ian/Orkesta/la-forja/scripts/ciclo-ss.cjs
 *
 * Variables: URL · SHOTDIR · W · H
 */
const { chromium } = require('playwright');
const fs = require('fs');
const crypto = require('crypto');

const URL = process.env.URL || 'http://localhost:5193/ciclo.html';
const DIR = process.env.SHOTDIR || '/home/ian/Orkesta/la-forja/forja-shots/ciclo';
const W = Number(process.env.W || 1680), H = Number(process.env.H || 1020);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex').slice(0, 12);

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

  const benigno = (s) => /WebGL context|WebGL2?RenderingContext|THREE\.WebGLRenderer|Download the React DevTools/i.test(s);
  const errs = [], warns = [], ignorados = [], fallidas = [];
  page.on('pageerror', (e) => { const s = String(e).slice(0, 260); if (!benigno(s)) errs.push(s); });
  page.on('console', (m) => {
    const url = (m.location() && m.location().url) || '';
    const s = `${m.type()}: ${m.text()}`.slice(0, 260) + (url ? ` @ ${url.slice(-40)}` : '');
    if (/favicon\.ico/.test(url)) { ignorados.push(s); return; }
    if (m.type() === 'error' && !benigno(s)) errs.push(s);
    else if (m.type() === 'warning' && !benigno(s)) warns.push(s);
  });
  page.on('response', (r) => { if (r.status() >= 400) fallidas.push(`${r.status()} ${r.url().slice(0, 120)}`); });

  const out = { url: URL, checks: {}, fases: {}, errs, warns, ignorados, fallidas, shots: [] };

  const estado = () => page.evaluate(() => window.__estudioCiclo || null);

  /** Recorte del VISOR (sin panel ni línea de tiempo): así el md5 mide la escena 3D. */
  const cajaVisor = async () => page.$eval('[data-testid="ec-visor"]', (e) => {
    const b = e.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
  });

  const disparo = async (nombre, clip) => {
    const p = `${DIR}/${nombre}.png`;
    const buf = await page.screenshot({ path: p, timeout: 30000, ...(clip ? { clip } : {}) });
    out.shots.push(p);
    return { path: p, hash: md5(buf) };
  };

  /** Mueve el slider DE VERDAD (input controlado de React: setter nativo + evento). */
  const mover = async (segundos) => {
    await page.$eval('[data-testid="ec-slider"]', (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, segundos);
  };

  /** Espera a que la vista 3D de la fase esté CONSTRUIDA (cada una publica lo suyo). */
  const esperarVista = async (vista, ms = 120000) => {
    const t0 = Date.now();
    for (;;) {
      const ok = await page.evaluate((v) => {
        const w = window.__vista3d || {};
        if (v === 'llenado') return !!(w.llenado && w.llenado.listo);
        if (v === 'apertura') return !!(w.apertura && w.apertura.listo);
        if (v === 'agua') return !!(w.agua && Array.isArray(w.agua.circuitos));
        if (v === 'alabeo') return !!(w.alabeo && w.alabeo.meta);
        if (v === 'corte') return !!window.__vista3dCorte;
        return true;
      }, vista).catch(() => false);
      if (ok) return true;
      if (Date.now() - t0 > ms) return false;
      await sleep(500);
    }
  };

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="estudio-ciclo-view"]', { timeout: 45000 });
    // GOTCHA de la casa: NO esperar un ".ready" — se espera la API + el canvas.
    await page.waitForFunction('!!window.__estudioCiclo && !!document.querySelector("canvas")', null, { timeout: 90000 });
    await page.waitForFunction('window.__estudioCiclo && window.__estudioCiclo.listo === true', null, { timeout: 120000 });
    await sleep(1500);

    // ── ¿GPU REAL o SwiftShader? ──
    out.gpu = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
      if (!gl) return 'sin contexto';
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'sin extensión';
    });
    out.checks.gpu_real = !/SwiftShader|llvmpipe|software/i.test(String(out.gpu));

    const s0 = await estado();
    out.ciclo = {
      pieza: s0.pieza, cicloS: s0.cicloS, cicloCosteoS: s0.cicloCosteoS,
      paredMm: s0.paredMm, tEnfriamientoTotalS: s0.tEnfriamientoTotalS,
      tCruceS: s0.tCruceS, tEjectC: s0.tEjectC, materialProxy: s0.materialProxy,
      fases: s0.fases,
    };
    out.hallazgos = s0.hallazgos;
    out.avisos = s0.avisos;

    // ── EL RELOJ ESTÁ EN SEGUNDOS REALES, no en 0..1 ──
    const slider = await page.$eval('[data-testid="ec-slider"]', (e) => ({ min: e.min, max: e.max, step: e.step }));
    out.slider = slider;
    out.checks.slider_en_segundos = Math.abs(Number(slider.max) - s0.cicloS) < 1e-3 && Number(slider.max) > 1.5;

    // ── INVARIANTES que la pantalla mide sola ──
    out.invariantes = s0.invariantes;
    out.checks.invariantes_pasan = s0.invariantesOk === true;

    // ── INVARIANTE 1 (medido AQUÍ): Σ fases = ciclo ──
    const suma = s0.fases.reduce((a, f) => a + f.durS, 0);
    out.sumaFases = { suma: +suma.toFixed(6), ciclo: s0.cicloS, delta: +Math.abs(suma - s0.cicloS).toFixed(9) };
    out.checks.suma_fases_es_el_ciclo = Math.abs(suma - s0.cicloS) < 1e-3;

    // ── INVARIANTE 2 (medido AQUÍ): el tiempo es monótono y sin huecos ──
    let mono = Math.abs(s0.fases[0].t0S) < 1e-6;
    for (let i = 0; i < s0.fases.length; i++) {
      if (!(s0.fases[i].durS > 0)) mono = false;
      if (i > 0 && Math.abs(s0.fases[i].t0S - s0.fases[i - 1].t1S) > 1e-6) mono = false;
    }
    out.checks.tiempo_monotono = mono && s0.fases.length === 5;

    // ── LAS 5 FASES: clic en el tramo REAL, esperar la vista, capturar ──
    const IDS = ['inyeccion', 'empaque', 'enfriamiento', 'apertura', 'expulsion'];
    const visor = await cajaVisor();
    const hashes = {};
    for (let i = 0; i < IDS.length; i++) {
      const id = IDS[i];
      // clic por DOM: el montaje de una vista pesada bloquea el hilo y `page.click`
      // se queda esperando "scheduled navigations" aunque la acción ya ocurrió.
      await page.$eval(`[data-testid="ec-fase-${id}"]`, (el) => el.click());
      await sleep(400);
      const s1 = await estado();
      const vistaOk = await esperarVista(s1.vista);
      await sleep(1400);
      const s = await estado();

      const cap = await disparo(`fase-${i + 1}-${id}`, visor);
      hashes[id] = cap.hash;
      // captura de PANTALLA COMPLETA de una fase (para juzgar panel + curva + línea)
      if (id === 'enfriamiento' || id === 'inyeccion') await disparo(`pantalla-${id}`);

      out.fases[id] = {
        tS: s.tS, faseLeida: s.fase, vista: s.vista, vistaConstruida: vistaOk,
        tVista: s.tVista, fracApertura: s.fracApertura, fracAperturaMedida: s.fracAperturaMedida,
        tempCentroC: s.tempCentroC,
        hash: cap.hash,
        // ¿el texto EXPLICA o solo repite el número? Se guarda entero para juzgarlo.
        titulo: s.cristiano ? s.cristiano.titulo : null,
        pasa: s.cristiano ? s.cristiano.pasa : null,
        porque: s.cristiano ? s.cristiano.porque : null,
        mal: s.cristiano ? s.cristiano.mal : null,
        lectura: s.lectura ? s.lectura.valor : null,
      };
      // la fase que reporta la pantalla TIENE que ser la que se pidió
      out.fases[id].fase_correcta = s.fase === id;
    }
    out.hashes = hashes;
    out.checks.cada_fase_es_la_pedida = IDS.every((k) => out.fases[k].fase_correcta);
    out.checks.todas_las_vistas_construyen = IDS.every((k) => out.fases[k].vistaConstruida);
    // ¿LA VISTA 3D CAMBIÓ DE VERDAD? md5 del recorte del visor, 5 fases distintas
    const distintos = new Set(Object.values(hashes)).size;
    out.imagenesDistintas = distintos;
    out.checks.la_vista_cambia_entre_fases = distintos === IDS.length;
    // el texto no puede ser el mismo en las 5 fases
    out.checks.el_texto_cambia_entre_fases = new Set(IDS.map((k) => out.fases[k].titulo)).size === IDS.length;
    out.checks.el_texto_explica = IDS.every((k) => (out.fases[k].porque || '').length > 60);

    // ── INVARIANTE 3 (medido AQUÍ, barriendo el slider DE VERDAD):
    //    la T del centro BAJA monótona durante todo el enfriamiento ──
    //    ⚠ el slider tiene step 0.01: el navegador CUAJA el valor al escalón más
    //    cercano. Pedir exactamente `tCruce` caía 0.003 s DESPUÉS del cruce y la
    //    pantalla devolvía `null` (correcto: fuera del molde la ecuación no sigue).
    //    Por eso cada muestra se piso-redondea al escalón y la última se queda
    //    JUSTO por debajo del cruce.
    const paso = Number(slider.step) || 0.01;
    const alEscalon = (t) => Math.floor((t + 1e-9) / paso) * paso;
    const tIny = s0.fases[0].t1S, tCruce = s0.tCruceS;
    const tFinBarrido = alEscalon(tCruce - paso / 2);
    const muestras = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const t = alEscalon(tIny + ((tFinBarrido - tIny) * i) / N);
      await mover(+t.toFixed(4));
      await sleep(45);
      const s = await estado();
      muestras.push({ tS: s.tS, T: s.tempCentroC });
    }
    let baja = true, peorSubida = 0;
    for (let i = 1; i < muestras.length; i++) {
      const a = muestras[i - 1].T, b = muestras[i].T;
      if (a == null || b == null) continue;
      if (b > a + 1e-9) { baja = false; peorSubida = Math.max(peorSubida, b - a); }
    }
    out.curvaBarrida = {
      n: muestras.length,
      T0: muestras[0].T, Tfin: muestras[muestras.length - 1].T,
      peorSubida: +peorSubida.toFixed(6),
      muestras: muestras.filter((_, i) => i % 8 === 0),
    };
    out.checks.temp_baja_monotona = baja && muestras[0].T != null
      && muestras[0].T > s0.tEjectC + 50;          // arranca CALIENTE, no en el limbo del truncamiento
    // ── ¿la curva CRUZA T_eject donde debe? (al terminar el enfriamiento) ──
    //    la última muestra cae ≤ 1 escalón antes del cruce; con la pendiente del
    //    final (≈14 °C/s en la carcasa) eso son ~0.2 °C: la tolerancia de 1 °C mide
    //    el cruce, no el redondeo.
    const Tfin = muestras[muestras.length - 1].T;
    out.cruce = { tCruceS: tCruce, tUltimaMuestraS: muestras[muestras.length - 1].tS, T_en_el_cruce: Tfin, T_eject: s0.tEjectC };
    out.checks.curva_cruza_en_teject = Tfin != null && Math.abs(Tfin - s0.tEjectC) < 1.0;

    // fuera de la ventana la ecuación NO se extrapola: tiene que decir "sin dato"
    await mover(+(s0.cicloS - 0.01).toFixed(3));
    await sleep(200);
    const sFuera = await estado();
    out.checks.no_extrapola_fuera_del_molde = sFuera.tempCentroC === null;

    // ── REPRODUCIR A VELOCIDAD REAL: el reloj tiene que avanzar en SEGUNDOS ──
    await mover(0);
    await sleep(150);
    await page.$eval('[data-testid="ec-play"]', (el) => el.click());
    const a0 = Date.now(); const e0 = await estado();
    await sleep(2000);
    const e1 = await estado(); const a1 = Date.now();
    const dReloj = e1.tS - e0.tS, dPared = (a1 - a0) / 1000;
    out.reproduccion = { dReloj: +dReloj.toFixed(3), dPared: +dPared.toFixed(3), razon: +(dReloj / dPared).toFixed(3) };
    // 1× = tiempo real. Se admite ±25 % por el costo de render de la escena.
    out.checks.play_es_tiempo_real = dReloj > 0 && Math.abs(dReloj / dPared - 1) < 0.25;
    await disparo('reproduciendo');

    // ── CÁMARA LENTA: el reloj avanza MUCHO más despacio ──
    await page.$eval('[data-testid="ec-play"]', (el) => el.click());     // pausa
    await mover(0);
    await page.$eval('[data-testid="ec-lenta"]', (el) => el.click());
    const b0 = Date.now(); const f0 = await estado();
    await sleep(2000);
    const f1 = await estado(); const b1 = Date.now();
    const rLenta = (f1.tS - f0.tS) / ((b1 - b0) / 1000);
    out.lenta = { razon: +rLenta.toFixed(3) };
    out.checks.camara_lenta_es_mas_lenta = rLenta > 0 && rLenta < 0.45;
    await page.$eval('[data-testid="ec-lenta"]', (el) => el.click());     // pausa

    // ── ORBITAR DE VERDAD: arrastre sobre el visor y la cámara TIENE que moverse ──
    await mover(+(s0.fases[3].t0S + s0.fases[3].durS * 0.6).toFixed(3));   // en apertura
    await sleep(800);
    const antes = (await estado()).camDir;
    await page.mouse.move(visor.x + visor.width * 0.5, visor.y + visor.height * 0.55);
    await page.mouse.down();
    for (let i = 1; i <= 14; i++) {
      await page.mouse.move(visor.x + visor.width * 0.5 + i * 17, visor.y + visor.height * 0.55 - i * 6);
      await sleep(28);
    }
    await page.mouse.up();
    await sleep(900);
    const despues = (await estado()).camDir;
    const cos = antes[0] * despues[0] + antes[1] * despues[1] + antes[2] * despues[2];
    out.orbita = { antes, despues, gradosGirados: +(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI).toFixed(1) };
    out.checks.orbita_mueve_camara = out.orbita.gradosGirados > 8;
    await disparo('orbitada');

    // ── VISTAS DE APOYO: corte y alabeo (los otros dos estudios importados) ──
    for (const v of ['corte', 'alabeo']) {
      await page.$eval(`[data-testid="ec-apoyo-${v}"]`, (el) => el.click());
      await sleep(600);
      const ok = await esperarVista(v);
      await sleep(1400);
      const s = await estado();
      out[`apoyo_${v}`] = { ok, vista: s.vista };
      await disparo(`apoyo-${v}`, visor);
    }
    await page.$eval('[data-testid="ec-apoyo-auto"]', (el) => el.click());
    await sleep(400);
    out.checks.apoyo_monta_corte_y_alabeo = !!(out.apoyo_corte && out.apoyo_corte.ok && out.apoyo_alabeo && out.apoyo_alabeo.ok);

    // ── VIVO: cambiar de PIEZA rearma la línea de tiempo y la vista vuelve a montar.
    //    (regresión: al vaciar la lista de vistas montadas sin volver a meter la
    //    activa, el visor se quedaba en NEGRO si la fase no cambiaba.) ──
    await page.$eval('[data-testid="ec-pieza-tapa"]', (el) => el.click());
    await sleep(2500);
    await page.waitForFunction('window.__estudioCiclo && window.__estudioCiclo.listo === true', null, { timeout: 120000 });
    const sTapa0 = await estado();
    await esperarVista(sTapa0.vista);
    await sleep(1600);
    const sTapa = await estado();
    out.piezaNueva = {
      pieza: sTapa.pieza, cicloS: sTapa.cicloS, paredMm: sTapa.paredMm,
      montadas: sTapa.montadas, vista: sTapa.vista,
      fases: sTapa.fases.map((f) => `${f.id} ${f.durS}s`),
    };
    const capTapa = await disparo('pieza-tapa', visor);
    out.checks.cambiar_de_pieza_rearma = !!sTapa && sTapa.pieza !== 'carcasa RPi4'
      && sTapa.cicloS > 0 && sTapa.cicloS !== s0.cicloS
      && (sTapa.montadas || []).includes(sTapa.vista)
      && capTapa.hash !== hashes.inyeccion;      // el visor NO se quedó en negro/igual
    await page.$eval('[data-testid="ec-pieza-rpi4"]', (el) => el.click());
    await sleep(2500);
    await page.waitForFunction('window.__estudioCiclo && window.__estudioCiclo.listo === true', null, { timeout: 120000 });

    // ── LO QUE NO ES DEL LIBRO VA DECLARADO ──
    const reparto = await page.$eval('[data-testid="ec-reparto"]', (e) => (e.textContent || '').replace(/\s+/g, ' '));
    out.repartoTxt = reparto.slice(0, 400);
    out.checks.declara_lo_que_no_es_del_libro = /REPARTO DEL REPO/.test(reparto) && /DEL LIBRO/.test(reparto);
    const avisos = await page.$eval('[data-testid="ec-avisos"]', (e) => (e.textContent || '').replace(/\s+/g, ' ')).catch(() => '');
    out.checks.avisos_presentes = /factory\.ts:103/.test(avisos);

    out.checks.sin_errores_de_pagina = errs.length === 0;
    out.checks.sin_recursos_404 = !fallidas.some((f) => /test-parts|\.tsx|\.ts\b/.test(f));
  } catch (e) {
    out.fatal = String((e && e.stack) || e).slice(0, 900);
    try { await disparo('FATAL'); } catch { /* el navegador pudo morir */ }
  } finally {
    await browser.close();
  }

  const pass = !out.fatal && Object.values(out.checks).every(Boolean);
  fs.writeFileSync(`${DIR}/reporte.json`, JSON.stringify({ pass, ...out }, null, 1));
  console.log(JSON.stringify({ pass, checks: out.checks, ciclo: out.ciclo, fatal: out.fatal || null, errs: out.errs.slice(0, 6) }, null, 1));
  process.exit(pass ? 0 : 1);
})();
