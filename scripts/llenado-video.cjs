/**
 * EL VIDEO DEL LLENADO — el fundido entrando por la colada, en 4K.
 * ============================================================================
 * ian: "para esto necesito un video, y tú también júzgalo — el video mostrará si
 * hay un fluido correcto". Un frente que avanza mal se ve EN MOVIMIENTO, no en una
 * foto: por eso esto no entrega stills, entrega la película + su JUICIO.
 *
 * Maneja el CAD real (GPU vía ANGLE/D3D12), avanza el instante del frente por la
 * API `__forgeBrep.llenadoT(t)` y captura un frame por paso. De cada frame LEE el
 * avance medido (`llenadoStats`) para poder juzgar el fluido con números sacados
 * de la corrida, no de la intención.
 *
 * Receta 4K canónica de CLAUDE.md: super=1, screenshot con timeout FINITO, un
 * contexto por lote, NVENC hevc 10-bit.
 *
 * Uso (iangpu):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   NODE_PATH=/home/ian/Orkesta/la-forja/node_modules node scripts/llenado-video.cjs
 */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');

const W = Number(process.env.W || 3840), H = Number(process.env.H || 2160);
const N = Number(process.env.FRAMES || 150);          // pasos del frente
const HOLD = Number(process.env.HOLD || 20);          // frames quietos al final
const DIR = process.env.DIR || '/home/ian/Orkesta/la-forja/forja-shots/llenado-video';
const OUT = process.env.OUT || (process.env.E12 === '1' ? '/mnt/e/forja-videos/dado-acta-4k.mp4'
  : process.env.E11 === '1' ? '/mnt/e/forja-videos/dado-estructura-4k.mp4'
  : process.env.CICLO === '1' ? '/mnt/e/forja-videos/dado-ciclo-completo-4k.mp4'
  : process.env.N2 === '1' ? '/mnt/e/forja-videos/espiral-termica-4k.mp4'
  : process.env.E10 === '1' ? '/mnt/e/forja-videos/dado-expulsion-4k.mp4'
  : process.env.E9 === '1' ? '/mnt/e/forja-videos/dado-contraccion-4k.mp4'
  : process.env.E8 === '1' ? '/mnt/e/forja-videos/dado-enfriamiento-4k.mp4'
  : process.env.E7 === '1' ? '/mnt/e/forja-videos/dado-venteo-4k.mp4'
  : process.env.E6 === '1' ? '/mnt/e/forja-videos/dado-empaque-4k.mp4' : '/mnt/e/forja-videos/dado-llenado-4k.mp4');
const URL = process.env.URL || 'http://127.0.0.1:5178/forja-brep.html';

(async () => {
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.mkdirSync(DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu',
      '--ignore-gpu-blocklist', '--disable-software-rasterizer', `--window-size=${W},${H}`],
  });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));

  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const gpu = await p.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'sin webgl2';
  });
  console.log('GPU:', gpu);
  if (/SwiftShader|llvmpipe/i.test(gpu)) { console.log('FATAL: GPU de software — el 4K no sale'); process.exit(1); }

  // caminar el ciclo hasta la estación 4 — o directo a LA PROBETA (PROBETA=1)
  const clic = async (id) => { await p.waitForSelector(`[data-testid="${id}"]`, { state: 'attached', timeout: 300000 }); await p.$eval(`[data-testid="${id}"]`, (e) => e.click()); };
  if (process.env.PLAY === '1') process.env.E10 = '1';   // el PLAY necesita molde armado + campo de llenado
  if (process.env.E12 === '1') process.env.E11 = '1';
  if (process.env.E11 === '1') process.env.CICLO = '1';
  if (process.env.CICLO === '1') process.env.E10 = '1';
  if (process.env.PROBETA === '1') {
    await p.waitForSelector('[data-testid="btn-probeta"]:not([disabled])', { timeout: 240000 });
    await p.click('[data-testid="btn-probeta"]');
  } else if (process.env.ESPIRAL === '1') {
    // LA COLA DE PUERCO: el solve tarda ~10 s tras el click — el waitForFunction de
    // abajo espera a que el llenadoStats exista, así que solo hay que clickear
    await p.waitForSelector('[data-testid="btn-espiral"]:not([disabled])', { timeout: 240000 });
    await p.click('[data-testid="btn-espiral"]');
  } else if (process.env.N2 === '1') {
    // N2 TÉRMICO: el clic computa LAS 3 ISOTERMAS síncronas (~2 min de hilo
    // bloqueado). p.click esperaría la respuesta del evento y moriría a los 30 s
    // — se AGENDA el click y se regresa de inmediato; llenadoStats marca el final.
    await p.waitForSelector('[data-testid="btn-espiral-n2"]:not([disabled])', { timeout: 240000 });
    await p.$eval('[data-testid="btn-espiral-n2"]', (e) => { setTimeout(() => e.click(), 30); });
  } else {
    await p.waitForSelector('[data-testid="btn-dado"]:not([disabled])', { timeout: 240000 });
    await p.click('[data-testid="btn-dado"]');
    await clic('btn-ciclo-e2');
    await clic('btn-ciclo-e3');
    await clic('btn-ciclo-e4');
    // E5 (cap 6): la colada COMPLETA visible mientras la cavidad se llena — sin ella el
    // fundido aparecía de la nada. Opcional para no romper la corrida de la E4 sola.
    if (process.env.E5 === '1' || process.env.E6 === '1' || process.env.E7 === '1' || process.env.E8 === '1' || process.env.E9 === '1' || process.env.E10 === '1') { await p.waitForTimeout(2500); await clic('btn-ciclo-e5'); }
    // E6 (cap 7): el EMPAQUE — la E5 tarda ~15 s en armar su campo; esperar a que
    // el botón e6 exista (vive en el panel de la E5) y clickear
    if (process.env.E6 === '1' || process.env.E7 === '1' || process.env.E8 === '1' || process.env.E9 === '1' || process.env.E10 === '1') { await p.waitForTimeout(16000); await clic('btn-ciclo-e6'); }
    // E7 (cap 8): el VENTEO — la E6 es instantánea; el botón e7 vive en su panel
    if (process.env.E7 === '1' || process.env.E8 === '1' || process.env.E9 === '1' || process.env.E10 === '1') { await p.waitForTimeout(2500); await clic('btn-ciclo-e7'); }
    // E8 (cap 9): el AGUA — el botón e8 vive en el panel de la E7
    if (process.env.E8 === '1' || process.env.E9 === '1' || process.env.E10 === '1') { await p.waitForTimeout(2500); await clic('btn-ciclo-e8'); }
    // E9 (cap 10): la CONTRACCIÓN — 3 splitMold en el click (~8 s); el botón vive en CicloE8
    if (process.env.E9 === '1' || process.env.E10 === '1') { await p.waitForTimeout(2500); await p.$eval('[data-testid="btn-ciclo-e9"]', (e) => { setTimeout(() => e.click(), 30); }); await p.waitForTimeout(12000); }
    // E10 (cap 11): los pines — instantánea; el botón vive en CicloE9
    if (process.env.E10 === '1') { await p.waitForTimeout(2500); await clic('btn-ciclo-e10'); }
    // E11 (cap 12): la estructura — instantánea; el botón vive en CicloE10
    if (process.env.E11 === '1') { await p.waitForTimeout(2000); await clic('btn-ciclo-e11'); }
    // E12 (§13.10): EL ACTA — instantánea; el botón vive en CicloE11
    if (process.env.E12 === '1') { await p.waitForTimeout(2000); await clic('btn-ciclo-e12'); }
  }
  await p.waitForFunction(() => !!(window.__forgeBrep && window.__forgeBrep.llenadoStats && window.__forgeBrep.llenadoStats()), null, { timeout: 300000 });
  await p.waitForTimeout(2500);
  // MOLDE=1 (orden el-dado-con-su-molde): la vista "molde de vidrio" de las
  // referencias — el acero PRESENTE (no fantasma) y el líquido visible adentro.
  if (process.env.MOLDE === '1') {
    const vista = await p.evaluate(() => window.__forgeBrep.moldVista({
      cavidad: 0.34, nucleo: 0.34, particion: 0.10,
      'placa-a-ghost': 0.26, 'placa-b-ghost': 0.26, colada: 0.22,
    }, false));
    console.log('moldVista roles:', (vista && vista.roles || []).join(','));
    await p.waitForTimeout(600);
  }
  // ── ENCUADRE (FILOSOFIA-CINE: ocupar la pantalla). Con la pieza COLOCADA dentro de la
  // base 196×196×248 la cámara inicial —que nace mirando al ORIGEN y nunca recibe una
  // vista— dejaba el molde arrinconado y la pieza CHICA: el juez de píxeles REPROBÓ
  // (0.12·0.11·0.07 vs umbral 0.10). `orbitTo` vuela alrededor del viewTarget, que ya
  // cae al bbox del MOLDE visible. ORBIT="az,el,r" (grados, grados, mm).
  // target EXPLÍCITO en CAD: el centro de la pieza colocada (98, 98, ~127) — el bbox
  // global arrastraba la mira y la pieza salía cortada en la esquina (visto en el still).
  // PROBETA: placa 60×20×2 en el origen — cámara CERCA (se tiene que VER mojar la pared)
  const orbDef = process.env.PROBETA === '1' ? '35,28,95,30,10,1'
    : process.env.ESPIRAL === '1' || process.env.N2 === '1' ? '24,44,330,85,85,0'
    : '38,20,200,98,98,127';
  const orb = (process.env.ORBIT || orbDef).split(',').map(Number);
  await p.evaluate(([az, el, r, tx, ty, tz]) => window.__forgeBrep.orbitTo(az, el, r, tx, ty, tz), orb);
  await p.waitForTimeout(1400);                        // el vuelo dura ~850 ms + margen

  // ── EL ACTA EN EL CUADRO (E12) ──────────────────────────────────────────────
  // La sonda 720p me enseñó el defecto con los ojos: el acta vivía en el registro
  // del curso — 11 px, gris sobre gris y CORTADO por el panel de abajo. Un acta
  // que no se lee no cobra. Ahora se rotula en la escena (mismo mecanismo de la
  // E11) y AQUÍ se mide que de verdad esté visible, no solo montada en el DOM.
  let actaEnPantalla = null;
  if (process.env.E12 === '1') {
    actaEnPantalla = await p.evaluate(() => {
      const nodos = Array.from(document.querySelectorAll('[data-testid^="cota-nucleo-e12-"]'));
      return nodos.map((n) => {
        const r = n.getBoundingClientRect();
        const st = getComputedStyle(n);
        return {
          id: n.getAttribute('data-testid'),
          texto: (n.textContent || '').trim(),
          visible: st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0,
          px: parseFloat(st.fontSize) || 0,
          dentro: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
        };
      });
    });
    console.log('ACTA en pantalla:', JSON.stringify(actaEnPantalla));
  }
  // ── PLAY=1 · EL CICLO SE ANIMA EN PROD (orden 2026-08-21) ────────────────────
  // No renderiza video: comprueba que el PRODUCTO anima solo. Aquí el arnés NO
  // maneja nada — clickea el botón y mira el reloj de pared. Si esto pasa, un
  // visitante de university.gaiaprime.com.mx ve la máquina trabajar sin consola.
  if (process.env.PLAY === '1') {
    const leer = () => p.evaluate(() => ({
      zCav: window.__forgeBrep.animZ('cavidad'),
      zPin: window.__forgeBrep.animZ('pin-punta-0'),
      zPza: window.__forgeBrep.animZ('pieza'),
      pct: (window.__forgeBrep.llenadoStats() || {}).pct ?? null,
      manual: !!(document.querySelector('[data-testid="ciclo-play-prog"]')),
    }));
    const juicio = [];
    const chk2 = (n, ok, d) => { juicio.push({ n, ok, d }); console.log(`  ${ok ? '✔' : '✘'} ${n} — ${d}`); };

    // CONTROL NEGATIVO: sin tocar el botón, 2.5 s de reloj y NADA se mueve.
    await p.evaluate(() => window.__forgeBrep.llenadoT(0));
    const q0 = await leer(); await p.waitForTimeout(2500); const q1 = await leer();
    const quieto = Math.abs((q1.zCav ?? 0) - (q0.zCav ?? 0)) < 0.5
      && Math.abs((q1.pct ?? 0) - (q0.pct ?? 0)) < 0.5;
    chk2('CONTROL NEGATIVO: sin pulsar, la escena está QUIETA (no hay residuo del arnés)',
      quieto, `Δz ${((q1.zCav ?? 0) - (q0.zCav ?? 0)).toFixed(2)} mm · Δllenado ${((q1.pct ?? 0) - (q0.pct ?? 0)).toFixed(2)} %`);

    await clic('btn-ciclo-play');
    // muestrear un ciclo entero (12 s) contra el reloj de pared, sin manejar nada
    const traza = [];
    for (let i = 0; i < 48; i++) { await p.waitForTimeout(350); traza.push(await leer()); }
    const maxPct = Math.max(...traza.map((t) => t.pct ?? 0));
    const minPct = Math.min(...traza.map((t) => t.pct ?? 0));
    const maxCav = Math.max(...traza.map((t) => t.zCav ?? 0));
    const maxPin = Math.max(...traza.map((t) => t.zPin ?? 0));
    const parEjecta = traza.filter((t) => (t.zPin ?? 0) > 40);
    chk2('EL LLENADO corre SOLO (nadie maneja llenadoT)', minPct < 10 && maxPct > 95,
      `llenado ${minPct.toFixed(1)} % → ${maxPct.toFixed(1)} % en 13 s de reloj`);
    chk2('ABRE SOLO su carrera del estudio (§6.3.2)', maxCav > 90, `animZ(cavidad) máx = ${maxCav.toFixed(1)} mm`);
    chk2('EXPULSA SOLO y la pieza viaja con los pines (cap 11)',
      maxPin > 46 && parEjecta.length > 0 && parEjecta.every((t) => Math.abs((t.zPza ?? 0) - (t.zPin ?? 0)) < 1),
      `animZ(pin) máx = ${maxPin.toFixed(1)} mm · ${parEjecta.length} muestras con la pieza pegada al pin`);
    chk2('el ACTO se rotula en la UI (el usuario sabe qué está viendo)', traza.some((t) => t.manual),
      'barra de progreso + rótulo del acto presentes durante el ciclo');
    // ES UN CICLO, NO UNA RAMPA: después de abrir del todo, tiene que VOLVER a cerrar
    // por sí solo. La primera versión saltaba de pieza-expulsada a molde-cerrado en un
    // frame; en este proyecto el molde no es un pipeline, son ciclos.
    const iAbierto = traza.findIndex((t) => (t.zCav ?? 0) > 90);
    const cierraSolo = iAbierto >= 0 && traza.slice(iAbierto + 1).some((t) => (t.zCav ?? 99) < 10);
    chk2('ES UN CICLO: retrae y CIERRA solo (no una rampa que se rebobina)', cierraSolo,
      iAbierto < 0 ? 'nunca abrió' : `abre en la muestra ${iAbierto} y vuelve a cerrar sin que nadie lo toque`);

    // PARAR debe SOLTAR el molde (si no, queda secuestrado en la última pose)
    await clic('btn-ciclo-play');
    await p.waitForTimeout(400);
    const libre = await p.evaluate(() => {
      window.__moldOpen(0, 0);                      // si el manual quedó tomado, esto no manda
      return new Promise((r) => setTimeout(() => r(window.__forgeBrep.animZ('cavidad')), 400));
    });
    chk2('al PARAR, el molde queda LIBRE (control manual soltado)', Math.abs(libre ?? 99) < 1,
      `animZ(cavidad) tras soltar y mandar 0 = ${(libre ?? -1).toFixed(2)} mm`);

    const ok = juicio.every((j) => j.ok);
    console.log(`\n${ok ? '✅' : '❌'} PLAY EN PROD ${ok ? 'APROBADO' : 'REPROBADO'} — ${juicio.filter((j) => j.ok).length}/${juicio.length}`);
    console.log(`VERIFY_RESULT={"pass":${ok},"checks":${juicio.length}}`);
    await browser.close();
    process.exit(ok ? 0 : 1);
  }

  // ── captura: el frente avanza de 0 a 1 — o EL CICLO COMPLETO (E10b) ──
  // CICLO=1: 3 actos — llenar (0..55 %), abrir (62..82 %), expulsar (84..100 %).
  // ian: "nunca los veo funcionando" — la máquina TRABAJANDO, por fin.
  const CICLO = process.env.CICLO === '1';
  const suave = (x) => x * x * (3 - 2 * x);
  const medidas = [];
  for (let i = 0; i < N + HOLD; i++) {
    const t = Math.min(1, i / (N - 1));
    let st;
    if (CICLO) {
      const fill = Math.min(1, t / 0.55);
      const open = t < 0.62 ? 0 : suave(Math.min(1, (t - 0.62) / 0.20));
      const eject = t < 0.84 ? 0 : suave(Math.min(1, (t - 0.84) / 0.16));
      st = await p.evaluate(([ff, oo, ee]) => {
        window.__forgeBrep.llenadoT(ff);
        window.__moldOpen(oo, ee);
        return { ...window.__forgeBrep.llenadoStats(), zCav: window.__forgeBrep.animZ('cavidad'), zPin: window.__forgeBrep.animZ('pin-punta-0'), zPza: window.__forgeBrep.animZ('pieza') };
      }, [fill, open, eject]);
    } else {
      st = await p.evaluate((tt) => { window.__forgeBrep.llenadoT(tt); return window.__forgeBrep.llenadoStats(); }, t);
    }
    await p.waitForTimeout(35);
    await p.screenshot({ path: `${DIR}/f${String(i).padStart(4, '0')}.png`, timeout: 30000 });
    medidas.push({ i, t: +t.toFixed(4), pct: st ? st.pct : null, llenosPieza: st ? st.llenosPieza : null, llenosColada: st ? st.llenosColada : null, totalColada: st ? st.totalColada : null, zCav: st ? st.zCav : null, zPin: st ? st.zPin : null, zPza: st ? st.zPza : null });
    if (i % 25 === 0) console.log(`  frame ${i}/${N + HOLD} · t=${t.toFixed(2)} · llenado ${st ? st.pct : '?'}%`);
  }
  await browser.close();

  // ── EL JUICIO, con números sacados de los FRAMES ──
  console.log('\n── JUICIO DEL FLUIDO (medido de la corrida, no de la intención)');
  // ceil, no floor: el primer frame con fill=1 es ceil(0.55·(N−1)) — con floor
  // el acto cerraba UN frame antes del lleno (pct 98.98, cazado por el juez)
  const llenado = CICLO ? medidas.slice(0, Math.ceil(0.55 * (N - 1)) + 1) : medidas.slice(0, N);
  let retrocesos = 0, maxSalto = 0;
  for (let i = 1; i < llenado.length; i++) {
    const d = llenado[i].pct - llenado[i - 1].pct;
    if (d < -0.01) retrocesos++;
    if (d > maxSalto) maxSalto = d;
  }
  const p0 = llenado[0].pct, pFin = llenado[llenado.length - 1].pct;
  const jui = [];
  const chk = (n, ok, det) => { jui.push({ n, ok, det }); console.log(`  ${ok ? '✔' : '✘'} ${n} — ${det}`); };
  chk('el frente NUNCA retrocede (monótono)', retrocesos === 0, `${retrocesos} retrocesos en ${llenado.length} frames`);
  chk('arranca casi vacío', p0 < 15, `${p0}% en el primer frame`);
  chk('termina lleno', pFin > 99.5, `${pFin}%`);
  chk('sin saltos bruscos (nada se llena de golpe)', maxSalto < 12, `salto máximo ${maxSalto.toFixed(2)}% entre frames`);
  // el llenado debe repartirse a lo largo del tiempo, no concentrarse
  const cuartos = [0.25, 0.5, 0.75].map((q) => llenado[Math.floor(q * (llenado.length - 1))].pct);
  chk('el avance se reparte en el tiempo', cuartos.every((c, k) => c > [5, 20, 45][k]), `25% → ${cuartos[0]}% · 50% → ${cuartos[1]}% · 75% → ${cuartos[2]}%`);
  chk('sin errores de página', errs.length === 0, errs.length ? errs[0] : 'consola limpia');
  // UNA TUBERÍA (solo aplica con E5=1, campo conjunto): el primer frame que moja la
  // PIEZA debe tener la COLADA ya ≥95 % llena — si el plástico "nace" en la pieza sin
  // haber bajado por el bebedero, REPRUEBA. (ian: "el llenado lleva al sprue".)
  const conMask = llenado.some((m) => (m.totalColada ?? 0) > 0);
  if (conMask) {
    const primeraPieza = llenado.find((m) => (m.llenosPieza ?? 0) > 0);
    chk('el fundido ENTRA por la colada ANTES de tocar la pieza (una tubería)',
      !primeraPieza || (primeraPieza.llenosColada / primeraPieza.totalColada) >= 0.95,
      primeraPieza ? `primer frame con pieza mojada: colada al ${(100 * primeraPieza.llenosColada / primeraPieza.totalColada).toFixed(1)} %` : 'la pieza nunca mojó');
  }
  // ⚠ EL CHECK QUE FALTABA: el DOM puede decir que avanza mientras la IMAGEN está
  // congelada. Pasó: 170 frames 4K, 0 píxeles de cambio, y este juez lo APROBÓ porque
  // solo miraba números. Un video que no cambia no es un video.
  // Sin dependencias nuevas: ffmpeg mide la diferencia entre dos PNG con `blend=difference`
  // y `signalstats` devuelve la media del resultado. 0 = frames idénticos.
  const difMedia = (a, b) => {
    try {
      const out = execSync(`ffmpeg -loglevel info -i ${DIR}/f${String(a).padStart(4, '0')}.png -i ${DIR}/f${String(b).padStart(4, '0')}.png ` +
        `-filter_complex "[0][1]blend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1`,
        { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      const m = out.match(/YAVG=([0-9.]+)/);
      return m ? parseFloat(m[1]) : -1;
    } catch { return -1; }
  };
  const tercios = [[0, Math.floor(N / 3)], [Math.floor(N / 3), Math.floor(2 * N / 3)], [Math.floor(2 * N / 3), N - 1]];
  const difs = tercios.map(([a, b]) => difMedia(a, b));
  const peor = Math.min(...difs);
  // umbral 0.10: con el frente REUSANDO AlarmCloud el tercio que menos cambia mide
  // ~0.15 y el que más ~0.55; congelado da 0.00 EXACTO. El 0.5 que puse a ojo reprobaba
  // un video que SÍ se mueve — un umbral inventado también es un juez mentiroso.
  chk('LA IMAGEN CAMBIA de verdad (no solo el DOM)', peor > 0.10,
    `diferencia media por tercio: ${difs.map((d) => d.toFixed(2)).join(' · ')} (0 = frames idénticos)`);
  if (CICLO) {
    const fin = medidas[medidas.length - 1];
    chk('ACTO 2 · EL MOLDE ABRE (el lado A sube su carrera completa)',
      fin.zCav != null && fin.zCav > 90, `animZ(cavidad) final = ${fin.zCav?.toFixed(1)} mm (carrera 100 §6.3.2)`);
    chk('ACTO 3 · LOS PINES EXPULSAN (y la pieza viaja con ellos)',
      fin.zPin != null && fin.zPin > 40 && Math.abs((fin.zPza ?? 0) - fin.zPin) < 1,
      `animZ(pin) = ${fin.zPin?.toFixed(1)} mm · pieza = ${fin.zPza?.toFixed(1)} mm (viajan JUNTOS, carrera 48 cap 11)`);
  }
  if (actaEnPantalla) {
    const vis = actaEnPantalla.filter((a) => a.visible && a.dentro);
    chk('EL ACTA SE LEE EN EL CUADRO (§13.10 rotulada, no gris sobre gris)',
      vis.length === 3 && vis.every((a) => a.px >= 11 && a.texto.length > 30),
      `${vis.length}/3 etiquetas visibles y dentro del cuadro · ${vis.map((a) => a.px + 'px').join(' · ')}`);
    chk('EL ACTA dice FIRMADO y trae LOS DOS números de la arquitectura',
      actaEnPantalla.some((a) => /FIRMADO/.test(a.texto))
      && actaEnPantalla.some((a) => /ARQUITECTURA/.test(a.texto) && /\$\d/.test(a.texto)),
      actaEnPantalla.map((a) => a.texto.slice(0, 64)).join(' | '));
  }
  const veredicto = jui.every((j) => j.ok);

  // ── encode NVENC 4K 10-bit ──
  fs.mkdirSync(require('path').dirname(OUT), { recursive: true });
  execSync(`ffmpeg -y -framerate 30 -i ${DIR}/f%04d.png -c:v hevc_nvenc -preset p5 -rc vbr -cq 22 -b:v 0 -pix_fmt yuv420p10le -movflags +faststart "${OUT}"`, { stdio: 'inherit' });
  const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
  console.log(`\n${veredicto ? '✅' : '❌'} VIDEO ${veredicto ? 'APROBADO' : 'REPROBADO'} → ${OUT} (${mb} MB, ${W}×${H}, ${medidas.length} frames)`);
  console.log(`VERIFY_RESULT={"pass":${veredicto},"frames":${medidas.length},"retrocesos":${retrocesos},"final":${pFin}}`);
  process.exit(veredicto ? 0 : 1);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 500)); process.exit(1); });
