#!/usr/bin/env node
/**
 * ig-calidad-entregada.cjs — mide lo que Instagram ENTREGA de verdad, no lo que dice la API.
 *
 * POR QUÉ EXISTE: el campo `media_url` de la Graph API está capado a 720p por diseño (el carril
 * de 1080p vive en video_dash_manifest), así que medirlo NO prueba lo que ve la gente. El 2026-08-27
 * medí 720x1280 en TODOS los posts y saqué la conclusión equivocada de que Instagram aplasta todo
 * por igual. La única medición honesta es abrir el reel en un navegador y leer el <video>.
 *
 * Es el canon 0.1 aplicado a Instagram: MIDE LO QUE SE ENTREGA, no lo que tienes en disco.
 *
 *   node scripts/ig-calidad-entregada.cjs <url-del-reel> [más urls...]
 *   PERFIL=/ruta/al/perfil  node scripts/ig-calidad-entregada.cjs ...   # sesión persistente
 *
 * La primera corrida abre el navegador VISIBLE para que inicies sesión a mano una sola vez; el
 * perfil queda guardado y las siguientes corridas ya no lo piden.
 */
const { chromium } = require('playwright');
const os = require('os'), path = require('path');

const PERFIL = process.env.PERFIL || path.join(os.homedir(), '.config', 'gaia-pub', 'ig-perfil');
const ARGS = process.argv.slice(2);
const URLS = ARGS.filter(a => a.startsWith('http'));
const CUENTA = (ARGS.find(a => a.startsWith('@')) || '').slice(1);   // @gaiaprime_mx → mide los N más recientes
const CUANTOS = Number(process.env.N || 4);
if (!URLS.length && !CUENTA) {
  console.error('uso: node scripts/ig-calidad-entregada.cjs <url-del-reel> [...]  |  @cuenta  (N=4 por omisión)');
  process.exit(1);
}

(async () => {
  // El Chromium que trae playwright suele desfasarse de la versión que el paquete espera; el
  // Chrome del sistema siempre está ahí. CHROME=/ruta para forzar otro.
  const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
  const ctx = await chromium.launchPersistentContext(PERFIL, {
    headless: false,                       // headful: Instagram trata peor a los headless
    executablePath: require('fs').existsSync(CHROME) ? CHROME : undefined,
    // El carril que Instagram entrega depende del TAMAÑO DEL REPRODUCTOR en píxeles físicos.
    // En escritorio el player es chico y baja a 540p o 360p; un teléfono a 3x de densidad pide
    // el carril alto. Como el 95% de nuestra audiencia es Instagram in-app a 390 px, MOVIL=1 es
    // la medición que representa al público real.
    ...(process.env.MOVIL === '1'
      ? { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' }
      : { viewport: { width: 1280, height: 900 } }),
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // Espía los segmentos de video que el reproductor descarga de verdad: ahí está el carril real.
  const bytesPorRepr = new Map();
  page.on('response', async r => {
    const u = r.url();
    if (!/\.(mp4|m4s)/.test(u) && !/video/.test(r.request().resourceType())) return;
    const len = Number(r.headers()['content-length'] || 0);
    if (!len) return;
    const m = u.match(/\/o1\/v\/[^/]*\/([^/?]+)/) || u.match(/([0-9]{3,4}x[0-9]{3,4})/);
    const clave = m ? m[1].slice(0, 40) : new URL(u).pathname.split('/').pop().slice(0, 40);
    bytesPorRepr.set(clave, (bytesPorRepr.get(clave) || 0) + len);
  });

  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  if (await page.locator('input[name="username"]').count()) {
    console.log('\n▶ INICIA SESIÓN A MANO en la ventana que se abrió. Cuando veas tu feed, regresa aquí.');
    await page.waitForSelector('input[name="username"]', { state: 'detached', timeout: 300000 });
    console.log('✓ sesión iniciada, el perfil queda guardado en ' + PERFIL);
  }

  if (CUENTA) {
    await page.goto(`https://www.instagram.com/${CUENTA}/reels/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const enc = await page.evaluate(() => [...document.querySelectorAll('a[href*="/reel/"]')].map(a => a.href));
    const nuevos = [...new Set(enc)].slice(0, CUANTOS);
    console.log(`▶ ${nuevos.length} reels de @${CUENTA} (del más reciente hacia atrás)`);
    URLS.push(...nuevos);
  }

  for (const url of URLS) {
    bytesPorRepr.clear();
    console.log(`\n══ ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('video', { timeout: 30000 });
      // Dejarlo reproducir para que pida varios segmentos y se vea a qué carril sube.
      await page.evaluate(() => { const v = document.querySelector('video'); if (v) { v.muted = true; v.play().catch(() => {}); } });
      await page.waitForTimeout(12000);
      const info = await page.evaluate(() => {
        const v = document.querySelector('video');
        if (!v) return null;
        const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : {};
        // webkitVideoDecodedByteCount = bytes de VIDEO realmente decodificados. Es la única
        // medida honesta del bitrate entregado: contar respuestas de red mezcla precarga,
        // reintentos y descargas progresivas, y da números imposibles (medido: 98 Mbps).
        // OJO: el decodificador va ADELANTADO respecto a la reproducción, así que dividir los
        // bytes entre currentTime infla el bitrate (medido: daba 37 Mbps a 1080p, imposible).
        // Hay que dividir entre lo realmente BUFEREADO.
        const buf = v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0;
        return { w: v.videoWidth, h: v.videoHeight, dur: v.duration, t: v.currentTime, buf,
                 bytes: v.webkitVideoDecodedByteCount || null,
                 cuadros: q.totalVideoFrames || null, caidos: q.droppedVideoFrames || null };
      });
      if (!info) { console.log('   ✗ no se encontró <video>'); continue; }
      const mbps = info.bytes && info.buf ? (info.bytes * 8 / info.buf / 1e6) : null;
      console.log(`   ENTREGADO: ${info.w}x${info.h}` +
                  (mbps ? ` @ ${mbps.toFixed(2)} Mbps` : '') +
                  ` · bufereados ${info.buf?.toFixed(1)} de ${info.dur?.toFixed(1)} s` +
                  ` · cuadros ${info.cuadros} (caídos ${info.caidos})`);
    } catch (e) {
      console.log(`   ✗ ${e.message.split('\n')[0]}`);
    }
  }
  console.log('\n(la ventana se cierra en 5 s)');
  await page.waitForTimeout(5000);
  await ctx.close();
})();
