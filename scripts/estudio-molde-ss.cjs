/**
 * ARNÉS DE "EL MOLDE" — abre la pantalla REAL y la MANEJA.
 * ============================================================================
 * El gate no es "compila": es *se puede usar*. Este arnés abre EL MOLDE con GPU
 * real y lo maneja como lo manejaría un moldero: BARRE el despiece, PRENDE y
 * APAGA cada subsistema (y pide "solo el agua" dentro del bloque transparente),
 * CAMBIA de modo (ARMADO · DESPIECE · CORTE · ABRIENDO), ORBITA arrastrando el
 * mouse, hace CLIC DE SONDA sobre varios componentes y cambia la pieza (que aquí
 * es apenas un parámetro). Guarda un PNG por estado para que un agente con OJOS
 * los abra y juzgue.
 *
 * LOS INVARIANTES NO SE SUPONEN, SE LEEN: la pantalla los mide sobre la geometría
 * (Σ espesores = stack, las placas se tocan en despiece 0, nada fuera del bloque,
 * masa = Σ vol×ρ, el despiece no traslapa) y los publica en
 * `window.__estudioMolde.invariantes`. Aquí se vuelven checks DUROS.
 *
 * Corre en iangpu (GPU real vía ANGLE/D3D12). Vite DEV, no preview: la pantalla
 * lee los STL del banco por `/test-parts/...` y dev sirve la raíz del repo.
 *
 * Uso (en iangpu, con el repo en /home/ian/Orkesta/la-forja):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   URL=http://localhost:5195/molde.html \
 *   node /home/ian/Orkesta/la-forja/scripts/estudio-molde-ss.cjs
 *
 * Variables: URL · SHOTDIR · W · H
 */
const { chromium } = require('playwright');
const fs = require('fs');

const URL = process.env.URL || 'http://localhost:5195/molde.html';
const DIR = process.env.SHOTDIR || '/home/ian/Orkesta/la-forja/forja-shots/estudio-molde';
const W = Number(process.env.W || 1760), H = Number(process.env.H || 1040);

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

  const out = { url: URL, checks: {}, estados: {}, errs, warns, ignorados, fallidas, shots: [], notas: [] };
  const disparo = async (n) => { const p = `${DIR}/${n}.png`; await page.screenshot({ path: p, timeout: 30000 }); out.shots.push(p); return p; };

  const estado = () => page.evaluate(() => {
    const v = window.__estudioMolde;
    if (!v) return null;
    return JSON.parse(JSON.stringify({
      listo: v.listo, error: v.error, cargando: v.cargando, pieza: v.pieza,
      modo: v.modo, despiece: v.despiece, tCorte: v.tCorte, tApertura: v.tApertura, rayosX: v.rayosX,
      subsistemas: v.subsistemas, numeros: v.numeros, placas: v.placas, piezas: v.piezas,
      conteos: v.conteos, invariantes: v.invariantes, bloque: v.bloque, cajaDespiece: v.cajaDespiece,
      cajaObjetivo: v.cajaObjetivo, zPartMm: v.zPartMm, origen: v.origen, supuesto: v.supuesto,
      avisos: v.avisos, extensiones: v.extensiones, ms: v.ms, lectura: v.lectura,
    }));
  });

  /** mueve un slider de React (setter nativo + evento input: si no, React lo ignora) */
  const ponerRango = async (testid, v) => {
    await page.$eval(`[data-testid="${testid}"]`, (el, x) => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(el, String(x));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);
    await sleep(600);
  };
  const clic = async (testid, esperar = 700) => { await page.click(`[data-testid="${testid}"]`); await sleep(esperar); };

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('[data-testid="estudio-molde-view"]', { timeout: 45000 });
    await page.waitForFunction('!!document.querySelector("canvas") && !!window.__estudioMolde', null, { timeout: 60000 });
    await page.waitForFunction('window.__estudioMolde && window.__estudioMolde.listo === true', null, { timeout: 120000 });
    await sleep(1800);

    out.gpu = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
      if (!gl) return 'sin contexto';
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'sin extensión';
    });
    out.checks.gpu_real = !/SwiftShader|llvmpipe|software/i.test(String(out.gpu));

    const s0 = await estado();
    out.molde = {
      origen: s0.origen, supuesto: s0.supuesto, ms: s0.ms, zPartMm: s0.zPartMm,
      numeros: s0.numeros, bloque: s0.bloque, cajaDespiece: s0.cajaDespiece,
      placas: s0.placas, conteos: s0.conteos, avisos: s0.avisos, extensiones: s0.extensiones,
      piezas: (s0.piezas || []).map((q) => `${q.id}|${q.nombre}|z ${q.z0}..${q.z1}|${q.volCc}cc|${q.masaKg}kg|rango ${q.rango}|dz ${q.dzPleno}`),
    };
    out.checks.molde_armado = !!s0.bloque && (s0.piezas || []).length >= 10;
    out.checks.sin_error_de_montaje = !s0.error;

    /* ── INVARIANTES: la pantalla los mide, aquí se vuelven gate ── */
    out.invariantes = s0.invariantes;
    for (const i of s0.invariantes || []) out.checks[`inv_${i.id}`] = i.ok !== false;
    out.invariantesReprobados = (s0.invariantes || []).filter((i) => i.ok === false).map((i) => `${i.id}: ${i.medido}`);

    /* ── EL ORDEN DEL STACK (que las placas estén en su sitio, no "en algún sitio") ── */
    const cadena = (s0.placas || []).filter((p) => !p.flotante);
    const esperado = ['p-bottom', 'p-riel', 'p-support', 'p-B', 'p-A', 'p-clamp'];
    out.stack = cadena.map((p) => `${p.id} [${p.z0}..${p.z1}] ${p.espesor}mm ${p.materialNombre} ${p.masaKg}kg`);
    out.checks.stack_en_orden = JSON.stringify(cadena.map((p) => p.id)) === JSON.stringify(esperado);
    out.checks.stack_suma_espesores =
      Math.abs(cadena.reduce((a, p) => a + p.espesor, 0) - (s0.numeros ? s0.numeros.stackMm : -1)) < 1e-6;

    /* ── LOS NÚMEROS existen y son creíbles ── */
    const n = s0.numeros || {};
    out.checks.numeros_bloque = n.Lmm > 50 && n.Wmm > 50 && n.Hmm > 50;
    out.checks.numeros_masa = n.masaAceroKg > 5 && n.masaAceroKg <= n.masaBloqueKg;
    out.checks.numeros_costo = typeof n.costoMoldeUSD === 'number' && n.costoMoldeUSD > 0;
    out.checks.numeros_aceros_por_placa = Array.isArray(n.aceros) && n.aceros.length >= 8 && n.aceros.every((a) => !!a.nombre);
    out.checks.numeros_arquitectura = !!n.arquitectura;
    // 5 desde 2026-08-07: se agregó `base` (§4.3.4). El catálogo de bases se juzga
    // APARTE de las columnas porque cuando no hay base estándar el molde es CUSTOM y
    // las tie bars quedan SIN MEDIR — antes eso salía como VIOLA "base NaN×NaN".
    out.checks.semaforos_los_cinco =
      Array.isArray(n.semaforos) && n.semaforos.length === 5 &&
      ['base', 'tiebars', 'daylight', 'shot', 'tonelaje'].every((id) => n.semaforos.some((s) => s.id === id));
    out.checks.semaforos_con_porque = (n.semaforos || []).every((s) => s.porque && s.seccion && s.medido);
    out.semaforos = (n.semaforos || []).map((s) => `${s.estado} · ${s.id} · ${s.medido} vs ${s.limite}`);

    await disparo('01-armado');

    /* ── SONDA sobre el molde armado ── */
    const bb = await page.$eval('[data-testid="em-visor"]', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    out.sondas = [];
    for (const [fx, fy] of [[0.52, 0.34], [0.52, 0.50], [0.52, 0.63], [0.44, 0.55], [0.62, 0.46]]) {
      await page.mouse.click(bb.x + bb.w * fx, bb.y + bb.h * fy);
      await sleep(300);
      const s = await estado();
      out.sondas.push({ punto: [fx, fy], lectura: s.lectura ? { titulo: s.lectura.titulo, valor: s.lectura.valor, cotas: s.lectura.cotas.length } : null });
    }
    out.componentesSondeados = [...new Set(out.sondas.filter((s) => s.lectura).map((s) => s.lectura.titulo))];
    out.checks.sonda_devuelve_componentes = out.componentesSondeados.length >= 2;
    out.checks.sonda_trae_cotas = out.sondas.some((s) => s.lectura && s.lectura.cotas >= 6);
    await disparo('02-armado-sondeado');

    /* ── ORBITAR: la sonda NO puede dispararse al girar ── */
    const antes = JSON.stringify((await estado()).lectura);
    await page.mouse.move(bb.x + bb.w * 0.5, bb.y + bb.h * 0.5);
    await page.mouse.down();
    for (let i = 1; i <= 16; i++) { await page.mouse.move(bb.x + bb.w * 0.5 + i * 20, bb.y + bb.h * 0.5 - i * 4); await sleep(26); }
    await page.mouse.up();
    await sleep(900);
    out.checks.orbitar_no_sondea = JSON.stringify((await estado()).lectura) === antes;
    await disparo('03-armado-orbitado');

    /* ── DESPIECE: barrido completo ── */
    await clic('em-modo-despiece', 1100);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      await ponerRango('em-despiece', t);
      const s = await estado();
      out.estados[`despiece-${String(t).replace('.', '')}`] = {
        t: s.despiece,
        z: (s.piezas || []).filter((q) => q.rol === 'placa').map((q) => `${q.id}:${(q.z0 + q.dzPleno * s.despiece).toFixed(1)}`),
      };
      await disparo(`04-despiece-${String(t).replace('.', '')}`);
    }
    const sD1 = await estado();
    out.checks.despiece_mueve = Math.abs(sD1.despiece - 1) < 1e-6
      && JSON.stringify(out.estados['despiece-0'].z) !== JSON.stringify(out.estados['despiece-1'].z);
    // el despiece a 0 tiene que devolver EXACTAMENTE el molde armado
    await ponerRango('em-despiece', 0);
    const sD0 = await estado();
    out.checks.despiece_cero_es_el_armado =
      JSON.stringify((sD0.piezas || []).map((q) => q.z0)) === JSON.stringify((s0.piezas || []).map((q) => q.z0));

    /* ── SUBSISTEMAS: apagar y prender cada uno ── */
    await ponerRango('em-despiece', 0.55);
    out.subsistemas = {};
    const subs = ['placas', 'insertos', 'moldeo', 'agua', 'colada', 'expulsores', 'tornillos'];
    for (const id of subs) {
      await clic(`em-sub-${id}`, 520);
      const apagado = await estado();
      await clic(`em-sub-${id}`, 520);
      const prendido = await estado();
      out.subsistemas[id] = {
        apagado: apagado.subsistemas, prendido: prendido.subsistemas,
        conteo: (prendido.conteos || []).find((c) => c.id === id) || null,
      };
      out.checks[`sub_${id}_apaga_y_prende`] =
        !apagado.subsistemas.includes(id) && prendido.subsistemas.includes(id);
    }
    out.checks.conteos_no_vacios = (sD1.conteos || []).filter((c) => c.n > 0).length >= 5;
    await disparo('05-despiece-subsistemas');

    /* ── "SOLO EL AGUA" dentro del bloque transparente ── */
    await ponerRango('em-despiece', 0);
    await clic('em-solo-agua', 900);
    const sAgua = await estado();
    out.checks.solo_agua = sAgua.subsistemas.length === 1 && sAgua.subsistemas[0] === 'agua';
    await disparo('06-solo-agua');
    // …y el agua DENTRO del acero: rayos X con las placas prendidas
    await clic('em-todos', 700);
    await clic('em-rayosx', 900);
    const sRx = await estado();
    out.checks.rayos_x = sRx.rayosX === true && sRx.subsistemas.length === 7;
    await disparo('07-rayosx-agua-dentro-del-acero');
    await clic('em-sub-moldeo', 500);
    await clic('em-sub-tornillos', 500);
    await disparo('08-rayosx-solo-tripas');
    await clic('em-todos', 800);

    /* ── SOLO EL PAQUETE EXPULSOR ── */
    await clic('em-solo-expulsores', 900);
    await disparo('09-solo-expulsores');
    await clic('em-todos', 700);

    /* ── MODO CORTE (vista3d-corte importada) ── */
    await clic('em-modo-corte', 2600);
    await ponerRango('em-corte', 0.5);
    await sleep(1400);
    const sC = await estado();
    const telCorte = await page.evaluate(() => {
      const v = window.__vista3dCorte;
      return v ? { listo: v.listo, cortadas: v.cortadas, areaMm2: v.areaMm2, tapasFallidas: v.tapasFallidas, cMm: v.cMm } : null;
    });
    out.corte = { modo: sC.modo, tel: telCorte };
    out.checks.modo_corte_vivo = !!telCorte && telCorte.listo === true && telCorte.cortadas >= 5;
    await disparo('10-corte');

    /* ── MODO ABRIENDO (vista3d-apertura importada) ── */
    await clic('em-modo-abriendo', 3200);
    await ponerRango('em-apertura', 0.55);
    await sleep(2200);
    const telAp = await page.evaluate(() => {
      const v = window.__vista3d && window.__vista3d.apertura;
      return v ? { listo: v.listo, fase: v.fase, tMm: v.tMm, recorridoMm: v.recorridoMm, nSolidos: v.nSolidos, choques: (v.choquesAhora || []).length } : null;
    });
    out.apertura = telAp;
    out.checks.modo_abriendo_vivo = !!telAp && telAp.listo === true && telAp.nSolidos > 5;
    await disparo('11-abriendo');
    await ponerRango('em-apertura', 1);
    await sleep(1600);
    await disparo('12-abriendo-pleno');

    /* ── de vuelta al molde y CAMBIO DE PIEZA (la pieza es un parámetro) ── */
    await clic('em-modo-armado', 1200);
    await clic('em-pieza-tapa', 4200);
    await page.waitForFunction('window.__estudioMolde && window.__estudioMolde.listo === true', null, { timeout: 90000 });
    await sleep(1600);
    const sTapa = await estado();
    out.estados['pieza-tapa'] = {
      pieza: sTapa.pieza.nombre, numeros: sTapa.numeros, ms: sTapa.ms,
      invReprobados: (sTapa.invariantes || []).filter((i) => i.ok === false).map((i) => i.id),
    };
    out.checks.cambia_de_pieza =
      sTapa.pieza.id === 'tapa' && !!sTapa.numeros &&
      (sTapa.numeros.Hmm !== n.Hmm || sTapa.numeros.Lmm !== n.Lmm || sTapa.numeros.nCav !== n.nCav);
    out.checks.invariantes_tambien_en_otra_pieza = (sTapa.invariantes || []).every((i) => i.ok !== false);
    await disparo('13-otra-pieza-tapa');

    await clic('em-modo-despiece', 1200);
    await ponerRango('em-despiece', 0.8);
    await disparo('14-otra-pieza-despiece');

    /* ── y de regreso a la pieza de referencia ── */
    await clic('em-modo-armado', 900);
    await clic('em-pieza-rpi4', 4200);
    await page.waitForFunction('window.__estudioMolde && window.__estudioMolde.listo === true', null, { timeout: 90000 });
    await sleep(1400);
    await disparo('15-final-armado');
  } catch (e) {
    out.fatal = String(e).slice(0, 500);
  }

  out.checks.sin_errores_de_consola = errs.length === 0;
  const duros = Object.entries(out.checks).filter(([, v]) => v === false).map(([k]) => k);
  out.reprobados = duros;
  out.veredicto = duros.length === 0 && !out.fatal ? 'PASA' : 'FALLA';

  fs.writeFileSync(`${DIR}/reporte.json`, JSON.stringify(out, null, 2));

  const md = [
    '# EL MOLDE — capturas para juzgar A OJO',
    '',
    `URL: ${URL} · GPU: ${out.gpu}`,
    `veredicto numérico: **${out.veredicto}**${duros.length ? ` · reprobados: ${duros.join(', ')}` : ''}`,
    '',
    'LA PREGUNTA DE FONDO (la corrección del operador): ¿se ve UN MOLDE, o piezas flotando?',
    '',
    'Qué buscar en CADA imagen:',
    '1. ¿es UNA herramienta (un bloque de acero apilado) o son cajas sueltas en el aire?',
    '2. ¿las placas están en el orden del stack (sujeción · housing · soporte · B · A · sujeción)?',
    '3. en despiece: ¿se separan limpio, con sus nombres legibles y sin encimarse?',
    '4. con rayos X: ¿el circuito de AGUA se ve DENTRO del acero (no flotando afuera)?',
    '5. ¿LOS NÚMEROS del panel están y son creíbles (bloque, masa, aceros, costo, 4 semáforos)?',
    '6. ¿la pieza quedó DEGRADADA a parámetro (renglón chico abajo), no de protagonista?',
    '',
    ...out.shots.map((p) => `## ${p.split('/').pop().replace('.png', '')}\n![](${p})`),
  ].join('\n');
  fs.writeFileSync(`${DIR}/OJO.md`, md);

  console.log(JSON.stringify({
    veredicto: out.veredicto, reprobados: duros, gpu: out.gpu, fatal: out.fatal || null,
    ms: out.molde && out.molde.ms, invariantesReprobados: out.invariantesReprobados,
    stack: out.stack, semaforos: out.semaforos,
    errs: errs.slice(0, 8), shots: out.shots.length,
  }, null, 2));
  await browser.close();
  process.exit(out.veredicto === 'PASA' ? 0 : 1);
})();
