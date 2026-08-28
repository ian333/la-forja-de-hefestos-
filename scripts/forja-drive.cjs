/**
 * La Forja — ARNÉS DE MANEJO HONESTO (drive-by-sight).
 * =====================================================================
 * El problema que resuelve: La Forja es un CAD que se maneja con MOUSE
 * continuo (clic/arrastre/flechas). Un test que llama al kernel por API
 * NO prueba el FLUJO — solo que el motor existe. Este arnés deja que el
 * operador (humano o agente con visión) MANEJE la UI real: ejecuta GESTOS
 * REALES a coordenadas que se deciden MIRANDO screenshots, y devuelve un
 * screenshot por gesto. Cero llamada de construcción al kernel.
 *
 * El `mirror_invariants` en meta.json es SOLO espejo de cross-check
 * (¿lo que veo coincide con el estado?), JAMÁS el volante.
 *
 * USO (probado 2026-06-27, en iangpu con el vite dev VIVO en :5001):
 *   # 1) levantar el dev server (en iangpu, GPU real):
 *   #    cd /home/ian/Orkesta/la-forja && npm run dev   # sirve :5001
 *   # 2) manejar:
 *   NODE_PATH=/home/ian/Orkesta/la-forja/node_modules \
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   URL=http://localhost:5001/forja-brep.html \
 *   node scripts/forja-drive.cjs <actions.json> <outDir>
 *
 * actions.json = lista ordenada de gestos. Coordenadas en el espacio del
 * viewport 1600x1000 (deviceScaleFactor 1 → 1px json = 1px screenshot):
 *   {"type":"click","x":224,"y":52}            clic real
 *   {"type":"dblclick","x":..,"y":..}
 *   {"type":"drag","from":[x,y],"to":[x,y],"steps":14}   arrastre real
 *   {"type":"move","x":..,"y":..}
 *   {"type":"key","key":"Escape"}              tecla
 *   {"type":"type","text":"40"}                escribir
 *   (cualquiera acepta "settle": ms de espera tras el gesto antes del shot)
 *
 * Salida: outDir/step_00_initial.png, step_01_<type>.png, ... + meta.json.
 *
 * GESTO QUE TRAICIONA EL INSTINTO (hallazgo): el círculo del sketcher NO
 * es de arrastrar — es clic-centro → clic-radio. Un "drag" deja un punto
 * suelto. Por eso los gestos van explícitos, no asumidos.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');            // ruta del archivo a subir (acción 'upload')
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';
const ACTIONS = process.argv[2] || '/tmp/forja-drive/actions.json';
const OUT = process.argv[3] || '/tmp/forja-drive/out';
const W = 1600, H = 1000;
fs.mkdirSync(OUT, { recursive: true });
const actions = fs.existsSync(ACTIONS) ? JSON.parse(fs.readFileSync(ACTIONS, 'utf8')) : [];

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
           '--use-gl=angle', '--use-angle=gl', '--disable-software-rasterizer',
           '--hide-scrollbars', `--window-size=${W},${H}`],
  });
  // REC=<dir> graba TODA la sesión a video (webm) → videotutorial automático de
  // La Forja ejecutando el tutorial. Sin REC, comportamiento idéntico al anterior.
  const REC = process.env.REC || '';
  const context = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1,
    ...(REC ? { recordVideo: { dir: REC, size: { width: W, height: H } } } : {}),
  });
  const recT0 = Date.now();            // marca de inicio de grabación (para recortar el lead-in muerto)
  const page = await context.newPage();
  const errors = [];
  // Los 404 de recursos son ruido conocido y LLENABAN el buffer de errores, tapando los
  // errores REALES (PAGEERR de React que resetea el doc). Se filtran.
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/404 \(Not Found\)/.test(t)) errors.push(t.slice(0, 220)); });
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + String(e).slice(0, 220)));
  const log = [];
  const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 30000 }); log.push(name); };

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try { await page.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready', { timeout: 45000 }); log.push('kernel_ready'); }
    catch (e) { log.push('kernel_NOT_ready'); }
    await page.waitForTimeout(1800);

    // ── CURSOR VISIBLE (para que SE VEA EL MOUSE en los videos): una flecha SVG que
    //    sigue los eventos reales de mousemove + un pulso ámbar en cada clic. Va pegado
    //    al body con z-index máximo, así aparece encima del editor de croquis. ──
    await page.evaluate(() => {
      if (document.getElementById('__cur')) return;
      const c = document.createElement('div');
      c.id = '__cur';
      c.style.cssText = 'position:fixed;left:-60px;top:-60px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6));';
      c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3,2 L3,19 L8,14.5 L11.5,22 L14.6,20.5 L11,13.4 L18,13.4 Z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      document.body.appendChild(c);
      const r = document.createElement('div');
      r.id = '__curring';
      r.style.cssText = 'position:fixed;left:-60px;top:-60px;width:30px;height:30px;margin:-15px 0 0 -15px;border:3px solid #ffcc33;border-radius:50%;z-index:2147483646;pointer-events:none;opacity:0;';
      document.body.appendChild(r);
      let x = 0, y = 0;
      addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; c.style.left = x + 'px'; c.style.top = y + 'px'; }, true);
      addEventListener('mousedown', () => { r.style.transition = 'none'; r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.opacity = '1'; r.style.transform = 'scale(.4)'; requestAnimationFrame(() => { r.style.transition = 'opacity .45s ease-out, transform .45s ease-out'; r.style.opacity = '0'; r.style.transform = 'scale(1.5)'; }); }, true);
      // HINT BAR estilo FL Studio / DaVinci: muestra el NOMBRE (title/aria-label/testid)
      // del elemento bajo el cursor → el video se explica solo. pointer-events:none, así
      // elementFromPoint ve SIEMPRE lo que hay detrás (el botón real), nunca este overlay.
      const hint = document.createElement('div');
      hint.id = '__hint';
      hint.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483645;pointer-events:none;max-width:82vw;padding:8px 16px;border-radius:9px;background:rgba(10,14,19,.88);border:1px solid #33404f;color:#ffcc33;font:600 15px/1.2 Inter,system-ui,sans-serif;letter-spacing:.2px;box-shadow:0 6px 18px rgba(0,0,0,.55);opacity:0;transition:opacity .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      document.body.appendChild(hint);
      const nameOf = (el) => {
        for (let n = el, i = 0; n && i < 6; n = n.parentElement, i++) {
          const t = n.getAttribute && (n.getAttribute('title') || n.getAttribute('aria-label'));
          if (t && t.trim()) return t.trim();
        }
        for (let n = el, i = 0; n && i < 6; n = n.parentElement, i++) {
          const d = n.getAttribute && n.getAttribute('data-testid');
          if (d) return d;
        }
        const tx = (el.textContent || '').replace(/\s+/g, ' ').trim();
        return tx && tx.length <= 44 ? tx : '';
      };
      addEventListener('mousemove', (e) => {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const nm = el ? nameOf(el) : '';
        if (nm) { hint.textContent = nm; hint.style.opacity = '1'; } else { hint.style.opacity = '0'; }
      }, true);
    });
    const glide = async (x, y) => { try { await page.mouse.move(x, y, { steps: 18 }); } catch (e) {} };
    const glideEl = async (testid) => {
      const loc = page.locator(`[data-testid="${testid}"]`);
      try { const bb = await loc.boundingBox({ timeout: 4000 }); if (bb) await glide(bb.x + bb.width / 2, bb.y + bb.height / 2); } catch (e) {}
      return loc;
    };
    await page.mouse.move(W / 2, H / 2, { steps: 4 });   // trae el cursor al centro
    await shot('step_00_initial');

    const leadMs = Date.now() - recT0;   // ms desde inicio de grabación hasta la 1ª acción (carga + kernel)
    let i = 0;
    for (const a of actions) {
      i++;
      const tag = `step_${String(i).padStart(2, '0')}_${a.type}`;
      try {
        if (a.type === 'click') { await glide(a.x, a.y); await page.mouse.click(a.x, a.y); }
        else if (a.type === 'dblclick') { await glide(a.x, a.y); await page.mouse.dblclick(a.x, a.y); }
        else if (a.type === 'move') await glide(a.x, a.y);
        else if (a.type === 'drag') {
          await glide(a.from[0], a.from[1]); await page.mouse.down();
          await page.mouse.move(a.to[0], a.to[1], { steps: a.steps || 20 }); await page.mouse.up();
        }
        else if (a.type === 'key') await page.keyboard.press(a.key);
        else if (a.type === 'type') await page.keyboard.type(String(a.text));
        // Acciones por data-testid (robustas, sin depender de pixeles) — para reproducir
        // tutoriales llenos de campos numéricos: 'fill' teclea en un input; 'tclick' hace clic.
        // El cursor GLIDE al elemento antes, para que se vea en el video.
        else if (a.type === 'fill') { const loc = await glideEl(a.testid); await loc.fill(String(a.text), { timeout: 8000 }); }
        else if (a.type === 'tclick') { const loc = await glideEl(a.testid); await loc.click({ timeout: 8000 }); }
        // SUBIR UN ARCHIVO REAL a un <input type="file"> (orden 2026-08-28-cargador-mi-pieza).
        // El input del cargador vive oculto (display:none) dentro de su <label>, así que NO se
        // le puede dar clic: setInputFiles lo alimenta directo, que es lo que hace el navegador
        // cuando el humano suelta el archivo. `file` es ruta absoluta o relativa al repo.
        else if (a.type === 'upload') {
          const abs = path.isAbsolute(a.file) ? a.file : path.resolve(__dirname, '..', a.file);
          if (!fs.existsSync(abs)) throw new Error(`upload: no existe ${abs}`);
          await page.locator(`[data-testid="${a.testid}"]`).setInputFiles(abs, { timeout: 15000 });
        }
        // Selección/cota PROGRAMÁTICA por nombre de método del hook (fiable, sin pixeles).
        // Ej: {type:'hook',fn:'pick',args:['line',0]} o {fn:'dimAngle',args:[0,1]}.
        else if (a.type === 'hook') {
          await page.evaluate(({ fn, args }) => {
            const se = window.__sketchEditor; if (se && typeof se[fn] === 'function') se[fn](...(args || []));
          }, { fn: a.fn, args: a.args });
        }
        // PROBE: lee los invariantes del kernel A MITAD del drive (vol/COM/euler) y los
        // deja en el log — para cachar EN QUÉ paso se corrompe la geometría (el vol de
        // un corte no puede SUBIR; un COM fuera del material = pieza movida).
        else if (a.type === 'probe') {
          const inv = await page.evaluate('window.__forgeBrep && window.__forgeBrep.invariants');
          const p = inv ? { vol: inv.vol_kernel, com: inv.com, euler: inv.euler, faces: inv.n_faces } : null;
          // Detector de REMOUNT/RELOAD: la marca vive en window; si desapareció,
          // la página recargó o la app remontó (doc reseteado a default) a mitad
          // del drive — el killer silencioso del stool y del tut1-f2.
          const mark = await page.evaluate('window.__driveMark === 1 ? "ok" : (window.__driveMark = 1, "RESET")');
          const line = `probe[${a.label || i}]: ${JSON.stringify(p)} mark=${mark}`;
          log.push(line); console.log(line);
          if (mark === 'RESET' && i > 3) errors.push(`REMOUNT_DETECTADO en probe ${a.label || i}`);
        }
        // Vuelca el PERFIL extraído del croquis abierto (diagnóstico: qué le va a
        // llegar al kernel tras sk-finish — puntos duplicados/orden/cierre).
        else if (a.type === 'sketchdump') {
          const prof = await page.evaluate('window.__sketchEditor && window.__sketchEditor.profile && JSON.stringify(window.__sketchEditor.profile())');
          const line = `sketchdump[${a.label || i}]: ${prof ? prof.slice(0, 1200) : 'NULL'}`;
          log.push(line); console.log(line);
        }
        // Importa un STEP como pieza principal (ver el molde de Kazmer en el Studio).
        else if (a.type === 'loadstep') {
          const txt = fs.readFileSync(a.path, 'utf8');
          await page.evaluate((t) => { window.__forgeBrep && window.__forgeBrep.importStepText && window.__forgeBrep.importStepText(t, 'kazmer'); }, txt);
          log.push(`loadstep: ${a.path}`); console.log(`loadstep: ${a.path}`);
        }
        // SAVE/LOAD del documento a archivo — parte drives LARGOS en segmentos
        // (el flaky de la VM mata drives >~100 gestos en puntos aleatorios):
        // drive A termina con savedoc; drive B abre con loaddoc y continúa.
        else if (a.type === 'savedoc') {
          const doc = await page.evaluate('window.__forgeBrep && window.__forgeBrep.serializeDoc && window.__forgeBrep.serializeDoc()');
          fs.writeFileSync(a.path, JSON.stringify(doc));
          const line = `savedoc: ${a.path} (${doc ? 'ok' : 'NULL'})`;
          log.push(line); console.log(line);
        }
        else if (a.type === 'loaddoc') {
          const doc = JSON.parse(fs.readFileSync(a.path, 'utf8'));
          await page.evaluate((d) => { window.__forgeBrep && window.__forgeBrep.loadDoc && window.__forgeBrep.loadDoc(d); }, doc);
          log.push(`loaddoc: ${a.path}`); console.log(`loaddoc: ${a.path}`);
        }
        // Llama un método del API principal window.__forgeBrep (ej. sketchOnTopFace / sketchOnFace).
        else if (a.type === 'main') {
          await page.evaluate(({ fn, args }) => {
            const f = window.__forgeBrep; if (f && typeof f[fn] === 'function') f[fn](...(args || []));
          }, { fn: a.fn, args: a.args });
        }
        else if (a.type === 'clickmm') {
          // Clic REAL en una posición del lienzo (dibujar a ojo, como el mouse humano):
          // el arnés proyecta (x,y) del croquis a pixel; NO se teclea ninguna coordenada.
          const pos = await page.evaluate(({ x, y }) => {
            const se = window.__sketchEditor; if (!se) return null;
            const px = se.toPx(x, y); const r = se.svgRect();
            return { x: r.left + px.px, y: r.top + px.py };
          }, { x: a.x, y: a.y });
          if (pos) { await glide(pos.x, pos.y); await page.mouse.click(pos.x, pos.y); }
        }
        else if (a.type === 'clickpt' || a.type === 'clickline' || a.type === 'clickarc' || a.type === 'clickcircle') {
          const pos = await page.evaluate(({ kind, idx }) => {
            const se = window.__sketchEditor; if (!se) return null;
            const pts = se.points(); let mx, my;
            if (kind === 'clickpt') { const p = pts[idx]; if (!p) return null; mx = p.x; my = p.y; }
            else if (kind === 'clickline') { const l = se.lines()[idx]; if (!l) return null; const pa = pts[l.a], pb = pts[l.b]; mx = (pa.x + pb.x) / 2; my = (pa.y + pb.y) / 2; }
            else if (kind === 'clickarc') { const ar = se.arcs()[idx]; if (!ar) return null; mx = ar.mx; my = ar.my; }  // clic en la CURVA del arco
            else { const c = se.circles()[idx]; if (!c) return null; const cp = pts[c.c]; mx = cp.x + c.r; my = cp.y; }   // clic en la curva del círculo
            const px = se.toPx(mx, my); const r = se.svgRect();
            return { x: r.left + px.px, y: r.top + px.py };
          }, { kind: a.type, idx: a.i });
          if (pos) { await glide(pos.x, pos.y); await page.mouse.click(pos.x, pos.y); }
        }
      } catch (ge) {
        // RETRY x1: con rebuilds pesados (revolve/fuse WASM) el main thread se bloquea
        // >8s y el clic expira aunque el botón exista. Un humano simplemente re-clickea.
        if (a.type === 'tclick' || a.type === 'fill') {
          try {
            await page.waitForTimeout(6000);
            const loc = page.locator(`[data-testid="${a.testid}"]`);
            if (a.type === 'tclick') await loc.click({ timeout: 15000 });
            else await loc.fill(String(a.text), { timeout: 15000 });
            errors.push(`RETRY_OK_${tag}`);
          } catch (ge2) {
            errors.push(`GESTURE_${tag}: ${String(ge2).slice(0, 120)}`);
            // ABORT: si un botón no respondió ni con retry, los gestos siguientes caerían
            // en la UI equivocada (clicks al viewport 3D = caos). Fallar claro y rápido.
            errors.push(`ABORTED_AT_${tag}`);
            break;
          }
        } else errors.push(`GESTURE_${tag}: ${String(ge).slice(0, 120)}`);
      }
      await page.waitForTimeout(a.settle ?? 800);
      await shot(tag);
    }

    // ── TURNTABLE: capturar VARIOS ÁNGULOS (un solo encuadre esconde la geometría).
    //    Orbita la cámara arrastrando en lienzo VACÍO (azimut) + una vista cenital.
    //    Desactivar con env TURNTABLE=0. ──
    if (process.env.TURNTABLE !== '0') {
      // ENCUADRAR la pieza COMPLETA (la cámara usa el bbox REAL): salta a vista iso que
      // la abarca. Reemplaza el hack del scroll para piezas grandes (paredes/rueda).
      try { await page.evaluate(() => { const f = window.__forgeBrep; if (f && f.setView) f.setView('iso'); }); await page.waitForTimeout(600); } catch (e) {}
      // ZOOM-OUT extra opcional (env TZOOM) si aún quieres alejar más.
      const TZOOM = parseInt(process.env.TZOOM || '0', 10);
      if (TZOOM) {
        await page.mouse.move(W / 2, H / 2);
        for (let z = 0; z < TZOOM; z++) { await page.mouse.wheel(0, 260); await page.waitForTimeout(90); }
        await page.waitForTimeout(300);
      }
      const orbit = async (fx, fy, tx, ty) => {
        await page.mouse.move(fx, fy); await page.mouse.down();
        await page.mouse.move(tx, ty, { steps: 20 }); await page.mouse.up();
        await page.waitForTimeout(400);
      };
      await shot('view_00_iso');
      for (let k = 1; k <= 3; k++) { await orbit(1180, 660, 720, 660); await shot(`view_${String(k).padStart(2, '0')}_az`); }
      await orbit(880, 720, 880, 360); await shot('view_04_top');
    }

    let inv = null;
    try { inv = await page.evaluate('window.__forgeBrep && window.__forgeBrep.invariants'); } catch (e) {}
    let sketchState = null;
    try {
      sketchState = await page.evaluate(() => {
        const se = window.__sketchEditor; if (!se) return null;
        return { dof: se.dof, status: se.status, nLines: se.nLines, nCircles: se.nCircles, nPoints: se.nPoints };
      });
    } catch (e) {}
    if (sketchState) inv = { ...(inv || {}), sketch: sketchState };
    fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify({ url: URL, viewport: { w: W, h: H }, leadMs, steps: log, mirror_invariants: inv, errors: errors.slice(0, 14) }, null, 2));
    console.log('DRIVE_OK steps=' + log.length);
  } catch (e) {
    fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify({ fatal: String((e && e.stack) || e).slice(0, 600), steps: log, errors: errors.slice(0, 14) }, null, 2));
    console.log('DRIVE_FAIL ' + String(e).slice(0, 200));
  } finally {
    // Cerrar la página y el CONTEXTO vacía (flush) el archivo de video al disco.
    try { const v = page.video(); await page.close(); await context.close();
      if (v) { const vp = await v.path(); fs.writeFileSync(`${OUT}/video-path.txt`, vp); console.log('VIDEO ' + vp); } }
    catch (e) { console.log('VIDEO_ERR ' + String(e).slice(0, 120)); }
    await browser.close();
  }
})();
