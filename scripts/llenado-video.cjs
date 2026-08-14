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
const OUT = process.env.OUT || '/mnt/e/forja-videos/dado-llenado-4k.mp4';
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
  if (process.env.PROBETA === '1') {
    await p.waitForSelector('[data-testid="btn-probeta"]:not([disabled])', { timeout: 240000 });
    await p.click('[data-testid="btn-probeta"]');
  } else if (process.env.ESPIRAL === '1') {
    // LA COLA DE PUERCO: el solve tarda ~10 s tras el click — el waitForFunction de
    // abajo espera a que el llenadoStats exista, así que solo hay que clickear
    await p.waitForSelector('[data-testid="btn-espiral"]:not([disabled])', { timeout: 240000 });
    await p.click('[data-testid="btn-espiral"]');
  } else {
    await p.waitForSelector('[data-testid="btn-dado"]:not([disabled])', { timeout: 240000 });
    await p.click('[data-testid="btn-dado"]');
    await clic('btn-ciclo-e2');
    await clic('btn-ciclo-e3');
    await clic('btn-ciclo-e4');
    // E5 (cap 6): la colada COMPLETA visible mientras la cavidad se llena — sin ella el
    // fundido aparecía de la nada. Opcional para no romper la corrida de la E4 sola.
    if (process.env.E5 === '1') { await p.waitForTimeout(2500); await clic('btn-ciclo-e5'); }
  }
  await p.waitForFunction(() => !!(window.__forgeBrep && window.__forgeBrep.llenadoStats && window.__forgeBrep.llenadoStats()), null, { timeout: 300000 });
  await p.waitForTimeout(2500);
  // ── ENCUADRE (FILOSOFIA-CINE: ocupar la pantalla). Con la pieza COLOCADA dentro de la
  // base 196×196×248 la cámara inicial —que nace mirando al ORIGEN y nunca recibe una
  // vista— dejaba el molde arrinconado y la pieza CHICA: el juez de píxeles REPROBÓ
  // (0.12·0.11·0.07 vs umbral 0.10). `orbitTo` vuela alrededor del viewTarget, que ya
  // cae al bbox del MOLDE visible. ORBIT="az,el,r" (grados, grados, mm).
  // target EXPLÍCITO en CAD: el centro de la pieza colocada (98, 98, ~127) — el bbox
  // global arrastraba la mira y la pieza salía cortada en la esquina (visto en el still).
  // PROBETA: placa 60×20×2 en el origen — cámara CERCA (se tiene que VER mojar la pared)
  const orbDef = process.env.PROBETA === '1' ? '35,28,95,30,10,1'
    : process.env.ESPIRAL === '1' ? '20,62,300,94,94,2'
    : '38,20,200,98,98,127';
  const orb = (process.env.ORBIT || orbDef).split(',').map(Number);
  await p.evaluate(([az, el, r, tx, ty, tz]) => window.__forgeBrep.orbitTo(az, el, r, tx, ty, tz), orb);
  await p.waitForTimeout(1400);                        // el vuelo dura ~850 ms + margen

  // ── captura: el frente avanza de 0 a 1 ──
  const medidas = [];
  for (let i = 0; i < N + HOLD; i++) {
    const t = Math.min(1, i / (N - 1));
    const st = await p.evaluate((tt) => { window.__forgeBrep.llenadoT(tt); return window.__forgeBrep.llenadoStats(); }, t);
    await p.waitForTimeout(35);
    await p.screenshot({ path: `${DIR}/f${String(i).padStart(4, '0')}.png`, timeout: 30000 });
    medidas.push({ i, t: +t.toFixed(4), pct: st ? st.pct : null, llenosPieza: st ? st.llenosPieza : null, llenosColada: st ? st.llenosColada : null, totalColada: st ? st.totalColada : null });
    if (i % 25 === 0) console.log(`  frame ${i}/${N + HOLD} · t=${t.toFixed(2)} · llenado ${st ? st.pct : '?'}%`);
  }
  await browser.close();

  // ── EL JUICIO, con números sacados de los FRAMES ──
  console.log('\n── JUICIO DEL FLUIDO (medido de la corrida, no de la intención)');
  const llenado = medidas.slice(0, N);
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
  const veredicto = jui.every((j) => j.ok);

  // ── encode NVENC 4K 10-bit ──
  fs.mkdirSync(require('path').dirname(OUT), { recursive: true });
  execSync(`ffmpeg -y -framerate 30 -i ${DIR}/f%04d.png -c:v hevc_nvenc -preset p5 -rc vbr -cq 22 -b:v 0 -pix_fmt yuv420p10le -movflags +faststart "${OUT}"`, { stdio: 'inherit' });
  const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
  console.log(`\n${veredicto ? '✅' : '❌'} VIDEO ${veredicto ? 'APROBADO' : 'REPROBADO'} → ${OUT} (${mb} MB, ${W}×${H}, ${medidas.length} frames)`);
  console.log(`VERIFY_RESULT={"pass":${veredicto},"frames":${medidas.length},"retrocesos":${retrocesos},"final":${pFin}}`);
  process.exit(veredicto ? 0 : 1);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 500)); process.exit(1); });
