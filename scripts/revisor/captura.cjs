#!/usr/bin/env node
/**
 * EL REVISOR · LA CAPTURA (orden 2026-10-24-e-el-revisor)
 * ============================================================================
 * ian (2026-10-24): «quién firma: quiero que haya una IA con Fable revisando». Antes de que un expediente salga a una planta,
 * un revisor (subagente Fable, lo lanza la skill `revisor-forja` desde la laptop) lo juzga con `scripts/revisor/RUBRICA.md`.
 * Esta captura es su materia prima: corre EL CAMINO de 9 pasos sobre el STEP del cliente en la app REAL (build de producción
 * servido en iangpu) y deja un PAQUETE con lo que el cliente vería y lo que la máquina midió.
 *
 * CÓMO MANEJA LA APP: NO hay otro manejador. Se genera un `actions.json` y se corre `scripts/forja-drive.cjs` (el mismo motor
 * que usa `camino-runner.cjs`, «mismo motor, cero copia»). Cada gesto de forja-drive deja una captura: con viewport 1536×864 y
 * DPR 2.5 salen a 3840×2160 (4K real, la regla de las capturas de ian). Los gestos son los de `filma-camino.cjs` (los testids,
 * el orden y las esperas que ya se pagaron), en TIEMPO REAL (aquí no se filma a 60 fps: el arranque del molde en tiempo real
 * esquiva la carrera de la E2 con la pieza maciza) y con el mismo SEGURO: si la E7 no trae pines, el molde no es de esta pieza
 * y la captura NO vale (rc 3).
 *
 * EL BUZÓN: un `eval` de forja-drive solo deja 300 caracteres en meta.json. Para sacar de la página los textos que el cliente
 * ve, los números de `__forgeBrep` y el expediente descargado, esta captura abre un servidor HTTP en 127.0.0.1 y los `eval`
 * le hacen POST. El expediente es el Blob EXACTO que el botón «Descargar (HTML)» le entrega al usuario (se intercepta en
 * `URL.createObjectURL`, el botón se aprieta de verdad). Medido: la página (localhost:4199) y el buzón (127.0.0.1) están en el
 * mismo espacio de red (loopback): Chrome no pide permiso. Contra una URL que NO sea localhost el buzón puede quedar bloqueado
 * (Local Network Access): la captura lo detecta (paquete incompleto) y sale rc 4.
 *
 * EL FOLIO = sesión · commit · SHA-256 del STEP (00-PLAN.md, acuerdo 6 del debate). sesión = el sid de la pestaña
 * (`sessionStorage.__forja_sid`, el mismo de la telemetría); commit = `--commit` o el `temis-deploy.json` servido, que se
 * declara NO VERIFICADO si es más viejo que el build (medido 2026-10-24: dist-dev3 trae un temis-deploy.json del 26-ago, 6f70032).
 *
 * LA IMAGEN-CONTROL (00-PLAN, QA: «agentes que VEN, siempre con una imagen-control que, si la aprueban, tira la corrida»):
 * entre las tres vistas del molde (s06-molde-a/b/c) una es la app con el lienzo 3D apagado (el defecto «frame negro» que la
 * app real ya tuvo). Cuál es se sortea en cada corrida y se guarda FUERA del paquete (`<raiz>/_control/<folio>.json`):
 * el revisor no lo sabe. Si la aprueba, la skill tira la revisión.
 *
 * uso (iangpu, receta GPU, dentro del turno de GPU):
 *   flock /home/ian/el-plan/gpu.lock env DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *     NODE_PATH=/home/ian/Orkesta/la-forja/node_modules URL=http://localhost:4199/forja-brep.html \
 *     node scripts/revisor/captura.cjs "<pieza.stp>" [--intake '<json>'] [--commit <sha>] [--raiz /home/ian/el-plan/revisiones]
 *   node scripts/revisor/captura.cjs --procesa <paquete>     (re-hace numeros/textos/hallazgos SIN GPU, sobre lo ya capturado)
 *   node scripts/revisor/captura.cjs --seco                  (sin GPU: arma los gestos, compila cada eval, prueba el detector)
 * salida: la última línea es `PAQUETE <ruta>`; rc 0 = completo · 3 = molde de otra pieza · 4 = paquete incompleto · 1 = falla.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const URL_APP = process.env.URL || 'http://localhost:4199/forja-brep.html';
const RAIZ = arg('--raiz') || '/home/ian/el-plan/revisiones';
const T0 = Date.now();
const ts = () => ((Date.now() - T0) / 1000).toFixed(1).padStart(6) + ' s';
const log = (...a) => console.log(ts(), ...a);

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// LO QUE SE BUSCA EN EL TEXTO (los apagones del debate: 00-PLAN.md «Semana 1 · Apagones» y juez A §4). El revisor juzga;
// este detector solo señala DÓNDE aparece cada cosa para que el revisor lo confirme con el still. Cada patrón lleva su
// PAR DE CONTROL abajo (una frase que debe pegar y una que no): si el detector falla su propio control, la captura no sale.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// OJO (medido en la corrida 1, 2026-10-24): el texto visible junta los tokens de un renglón con DOS espacios («70  /100»,
// «de  134  s»): los patrones usan \s* y no \s?. Con \s? el detector no vio ni el 70/100 del dictamen ni el 134 s del paso 3.
const APAGONES = [
  { id: 'usd', que: 'cifra en dólares (USD / «EE.UU.»): la planta paga en pesos (hallazgo 6, moldmachine.ts:185)',
    re: /\bUSD\b|US\$|EE\.?\s*UU\.?|\bUS dollars?\b/g, pega: 'Cotización: $49,344 USD', noPega: 'Costo de referencia: MXN 182,000 con tu tarifa' },
  // (corrida 1: el expediente dice «EL DINERO $18,924» sin moneda; por dentro es USD a 100/h, moldmachine.ts:185 — una planta
  // lo lee en pesos. Una cifra con $ y sin MXN/USD al lado es el mismo apagón disfrazado.)
  { id: 'dinero-sin-moneda', que: 'cifra con «$» sin decir la moneda ni la tarifa (por dentro es USD a 100/h: hallazgo 6)',
    re: /\$\s*\d[\d,]*(?:\.\d+)?(?![\d,]|\.\d)(?!\s*(?:MXN|USD|M\.?N\.?|pesos|d[oó]lares))/g, pega: 'EL DINERO (cap 3)  $18,924  el molde', noPega: 'costo de referencia: $182,000 MXN con tu tarifa de MXN 650/h' },
  { id: 'cotizacion', que: '«cotización» donde el debate pide «costo de referencia, no cotización» (juez A D3, juez B D8)',
    re: /cotizaci[oó]n/gi, pega: 'COTIZACIÓN DE MOLDE', noPega: 'costo de referencia con tu tarifa' },
  { id: 'puntos-debiles', que: '«puntos débiles» absoluto (son 915 pares agua×barreno, hallazgo 12)',
    re: /puntos?\s+d[eé]biles/gi, pega: '0 PUNTOS DÉBILES', noPega: '0 choques en 915 pares agua contra barreno' },
  { id: 'cien-de-cien', que: 'puntaje «100/100» o «70/100» (el DFM solo mira la pared nominal; el juez A retira el puntaje)',
    re: /\b\d{1,3}\s*\/\s*100\b/g, pega: 'contratos  70  /100', noPega: '6 por resolver · 12 de panzazo' },
  { id: 'pp-literal', que: '«PP» rotulado sobre una pieza que corre en ABS (hallazgo 5, useMoldStudio.ts:561)',
    re: /(?<![A-Za-z])PP(?![A-Za-z])/g, pega: 'material: PP', noPega: 'material: ABS (proxy)' },
  { id: 'cincuenta-de-cincuenta', que: '«50 de 50 tocan» (50 rayos no ven postes de ⌀8, juez A D9)',
    // (el revisor Fable lo cazó en la corrida 3: la tarjeta dice «50 de 50 · puntos tocan»; el patrón pedía «tocan» pegado)
    re: /\b(\d+)\s+de\s+\1\s+(?:puntos\s+)?toca/gi, pega: '50 de 50  puntos tocan', noPega: '48 de 50 puntos tocan' },
  { id: 'cajetin-iso2768', que: 'cajetín con ISO 2768-mK que el motor no derivó (hallazgo 10, mold-drawings.ts:103)',
    re: /ISO\s*2768/gi, pega: 'ISO 2768-mK', noPega: 'tolerancia general: la fija el fabricante' },
  { id: 'cajetin-ra', que: 'cajetín con «Ra 0.8» sin cálculo (mold-drawings.ts:102)',
    re: /\bRa\s*0[.,]8\b/g, pega: 'Ra 0.8 cavidad', noPega: 'acabado: lo fija el fabricante' },
  { id: 'cajetin-dibujo', que: '«DIBUJÓ: La Forja CAD» donde ISO 7200 pide una persona (abogado)',
    re: /DIBUJ[ÓO]\s*:?\s*La Forja/gi, pega: 'DIBUJÓ: La Forja CAD', noPega: 'GENERÓ: La Forja (software) · REVISÓ: ____' },
  { id: 'ciclo-134', que: '134 s como ciclo (Eq 9.5 de placa sobre un poste: con Eq 9.6 son 65 s, hallazgo 3)',
    // (el control lo cazó 2026-10-24: «65–136 s» es el TECHO de la ventana honesta, no el 134 como número único)
    re: /(?<![–\-]\s*)\b13[3-6](?:[.,]\d)?\s*s\b/g, pega: 'de  134  s · tiempo', noPega: 'poste 65–136 s · pared 21.7 s' },
  { id: 'clamp-2-3', que: 'tonelaje de llenado sin el piso de 50 MPa («2.3 % de 150 t», hallazgo 1)',
    re: /\b2[.,]3\s*%/g, pega: 'clamp 2.3 % de 150 t', noPega: '36 t · 24 % de 150 t' },
  { id: 'simulacion', que: 'palabras que no se ganaron con un acta: CFD, FEA, «simulación de llenado» (acuerdo 4)',
    re: /\bCFD\b|\bFEA\b|simulaci[oó]n de llenado/gi, pega: 'flujo de agua por CFD', noPega: 'agua por fórmula, no es análisis de fluidos' },
  { id: 'ingles', que: 'rótulos en inglés (WARPAGE TOPOLOGIA, STEEL SAFE) en la vista del cliente (brief §2)',
    re: /\bWARPAGE\b|\bSTEEL\s?SAFE\b/gi, pega: 'STEEL SAFE', noPega: 'a prueba de acero' },
];
/** el detector se prueba a sí mismo: cada patrón pega en su frase sucia y NO en la limpia */
function controlDelDetector() {
  return APAGONES.map((p) => {
    const a = (p.pega.match(new RegExp(p.re.source, p.re.flags)) || []).length > 0;
    const b = (p.noPega.match(new RegExp(p.re.source, p.re.flags)) || []).length === 0;
    return { id: p.id, pegaEnLoSucio: a, callaEnLoLimpio: b, ok: a && b };
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// LO QUE CORRE DENTRO DE LA PÁGINA (se antepone a cada `eval`: si la página se recargara, cada gesto se trae lo suyo)
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const AYUDAS = (BUZON) => `
const BUZON = ${JSON.stringify(BUZON)};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (id) => document.querySelector('[data-testid="' + id + '"]');
const clic = (id) => { const b = q(id); if (b) b.click(); return !!b; };   // clic ÚNICO por eval (el reintento de tclick APAGA un interruptor)
const hasta = async (fn, ms, cada = 250) => { const t0 = performance.now(); for (;;) { let v = null; try { v = fn(); } catch (e) {} if (v) return { ok: true, ms: Math.round(performance.now() - t0), v }; if (performance.now() - t0 > ms) return { ok: false, ms: Math.round(performance.now() - t0) }; await dormir(cada); } };
const manda = async (nombre, x) => { const body = typeof x === 'string' ? x : JSON.stringify(x); const r = await fetch(BUZON + '/' + encodeURIComponent(nombre), { method: 'POST', body }); return r.ok ? body.length : -1; };
/** LO QUE EL CLIENTE VE: cada nodo de texto con opacidad efectiva ≥ 0.05 (el MODO CAMINO esconde con opacidad 0, no con
 *  display:none: innerText traería la cinta y los paneles escondidos), con caja dentro del cuadro. Renglones por su y. */
const textoVisible = () => {
  const W = innerWidth, H = innerHeight, op = new Map();
  const opac = (el) => { if (!el || el.nodeType !== 1) return 1; if (op.has(el)) return op.get(el); const cs = getComputedStyle(el);
    const o = (cs.display === 'none' || cs.visibility === 'hidden') ? 0 : (+cs.opacity) * opac(el.parentElement); op.set(el, o); return o; };
  const tok = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    const s = t.textContent.replace(/\\s+/g, ' ').trim(); if (!s) continue;
    const el = t.parentElement; if (!el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
    const o = opac(el); if (o < 0.05) continue;
    const r = document.createRange(); r.selectNodeContents(t); const b = r.getBoundingClientRect();
    if (b.width < 1 || b.height < 1 || b.right < 0 || b.bottom < 0 || b.left > W || b.top > H) continue;
    tok.push({ s, x: Math.round(b.left), y: Math.round(b.top), o: +o.toFixed(2) });
  }
  tok.sort((a, b) => (Math.abs(a.y - b.y) > 5 ? a.y - b.y : a.x - b.x));
  const renglones = []; let y = -1e9;
  for (const k of tok) { if (Math.abs(k.y - y) > 5) { renglones.push([]); y = k.y; } renglones[renglones.length - 1].push(k.s); }
  return renglones.map((r) => r.join('  ')).join('\\n');
};
const molde = () => { const m = q('molde-de-la-pieza'); return m ? Object.assign({}, m.dataset) : null; };
const resumenGeom = () => { const G = window.__forgeBrep.moldGeom(); const roles = {}; for (const g of G) { const k = g.role.replace(/-\\d+$/, '-*'); roles[k] = (roles[k] || 0) + 1; }
  return { partes: G.length, roles, cuerpos: G.map((g) => ({ role: g.role, min: g.min.map((v) => +v.toFixed(2)), max: g.max.map((v) => +v.toFixed(2)) })) }; };
const datos = async (paso, extra) => manda('paso-' + paso + '.json', { paso, t: Math.round(performance.now()), texto: textoVisible(), molde: molde(), extra: extra || null });
`;
/** una acción `eval` de forja-drive: el cuerpo es async y devuelve una línea corta (lo que queda en meta.json) */
const ev = (BUZON, cuerpo, extra = {}) => ({ type: 'eval', js: `(async () => { ${AYUDAS(BUZON)}\n${cuerpo}\n})()`, settle: 300, ...extra });

/** EL CAMINO, gesto por gesto. `still` = el nombre del cuadro que se queda en el paquete (la captura que forja-drive toma
 *  DESPUÉS de ese gesto); `lee` = qué debe mirar el revisor en él. El orden y las esperas son los de filma-camino.cjs. */
function elCamino(BUZON, STEP, controlEn) {
  const A = [];
  const E = (cuerpo, extra) => A.push(ev(BUZON, cuerpo, extra));
  // 1 · ABRES LA FORJA — se apartan el cursor y la barra de pistas de forja-drive (son del video-tutorial, no de la app:
  // con el cursor al centro la barra pintaba «lienzo-vacio» en todos los cuadros); se anota el GPU y la sesión
  E(`for (const id of ['__cur', '__curring', '__hint']) { const e = document.getElementById(id); if (e) e.remove(); }
     const api = await hasta(() => window.__forgeBrep && Object.keys(window.__forgeBrep).length > 50, 180000);
     const g = document.createElement('canvas').getContext('webgl2'); const x = g && g.getExtension('WEBGL_debug_renderer_info');
     const gpu = x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : '?';
     let sid = 'nosid'; try { sid = sessionStorage.getItem('__forja_sid') || 'nosid'; } catch (e) {}
     await dormir(1500);
     await manda('arranque.json', { gpu, sid, url: location.href, ua: navigator.userAgent, viewport: [innerWidth, innerHeight, devicePixelRatio], api: api.ok });
     return 'sid=' + sid + ' gpu=' + gpu.slice(0, 90);`, { still: 's01-abres-la-forja', lee: 'el lienzo limpio' });
  // 2 · TU PIEZA — el drop de forja-drive (DataTransfer construido DENTRO de la página: x4 lo pagó)
  A.push({ type: 'drop', file: STEP, settle: 0 });
  E(`const r = await hasta(() => q('el-parte-foco'), 240000);
     await dormir(2500); const aviso = q('aviso-entrada-ok') ? (q('aviso-entrada-ok').closest('[data-testid]') || {}).textContent : null; clic('aviso-entrada-ok');
     await dormir(3200);   // la cortina del paso (2.3 s) se va antes de la captura
     const inv = window.__forgeBrep.invariants;
     await datos('02', { cargaMs: r.ms, aviso, invariantes: inv ? { vol: inv.vol_kernel, caras: inv.n_faces } : null, encuadre: window.__forgeBrep.encuadre ? window.__forgeBrep.encuadre() : null });
     return 'pieza ' + (r.ok ? 'en ' + r.ms + ' ms' : 'NO APARECIÓ');`, { still: 's02-tu-pieza', lee: 'la pieza con sus cotas; ¿la matrícula/puerta dice si se puede?' });
  // 3 · EL ENFRIAMIENTO
  E(`clic('parte-lente-enfriamiento');
     const r = await hasta(() => q('escala-enfriamiento'), 180000);
     await dormir(4000);
     await datos('03', { esperaMs: r.ms, reloj: window.__forgeBrep.enfriamiento ? window.__forgeBrep.enfriamiento.estado() : null });
     return 'enfriamiento ' + (r.ok ? r.ms + ' ms' : 'SIN ESCALA');`, { still: 's03-el-enfriamiento', lee: 'el campo y la ficha: ¿qué tiempo da y dice con qué fórmula?' });
  // 4 · EL DICTAMEN (tecla D, gesto real de teclado)
  A.push({ type: 'key', key: 'd', settle: 1500 });
  E(`const r = await hasta(() => q('lamina-dictamen'), 20000); await dormir(1500);
     const l = q('lamina-dictamen');
     await datos('04', { completo: l ? l.innerText : null, tinte: l ? l.dataset.tinte : null });
     return 'dictamen ' + (r.ok ? 'ok' : 'NO SALIÓ');`, { still: 's04-el-dictamen', lee: 'qué viola, qué cambiar; ¿hay puntaje /100?' });
  // las filas ✗ se despliegan (clic en cada `rp-h-*`) para leer su NÚMERO (ej. CLARO §9.2.7 contra el 3.49 de la inspección);
  // el still de arriba es el dictamen como el cliente lo ve primero (plegado). MEDIDO (corrida 2): es un ACORDEÓN — abrir una
  // fila cierra la anterior — así que se lee el detalle DESPUÉS de cada clic, fila por fila.
  E(`const filas = [...document.querySelectorAll('[data-testid^="rp-h-"]')].filter((f) => /^\\s*✗/.test(f.textContent));
     const det = [];
     for (const f of filas) { f.click(); await dormir(450); const l = q('lamina-dictamen'); const t = l ? l.innerText : '';
       // la fila en innerText es «✗ / DP / §6.2.2 / §6.4 / ▾» (textContent las pega: «DP§6.2.2»); su detalle va tras su ▾
       const [, nombre = '?', sec = ''] = f.innerText.split('\\n').map((x) => x.trim()).filter(Boolean);
       const k0 = t.indexOf(nombre + '\\n' + sec), k = k0 >= 0 ? t.indexOf('▾', k0) : -1;
       det.push({ fila: f.dataset.testid, nombre: nombre + ' ' + sec, detalle: k >= 0 ? t.slice(k + 1, k + 900).split(/\\n(?:[✗⚠✓]\\n|[A-ZÁÉÍÓÚÑ ]+ · \\d+|▾ los 69)/)[0].trim() : null }); }
     await manda('dictamen-desplegado.json', { filas: det });
     return filas.length + ' filas ✗ leídas';`);
  A.push({ type: 'key', key: 'Escape', settle: 600 });
  // 5 · LA PARTICIÓN
  E(`clic('parte-lente-particion'); const r = await hasta(() => q('linea-particion'), 15000); await dormir(3000);
     await datos('05'); return 'partición ' + (r.ok ? 'ok' : 'SIN LÍNEA');`, { still: 's05-la-particion', lee: 'la línea de partición sobre la pieza' });
  // 6 · EL MOLDE — se arma solo; se espera la E8 con portamoldes. El seguro de pines se juzga después (rc 3).
  E(`const t0 = performance.now(); clic('parte-lente-molde');
     const e3 = await hasta(() => { const m = molde(); return m && +m.estacion >= 3 && m.pared; }, 300000, 500);
     const pm = await hasta(() => { const m = molde(); return m && m.portamoldes === '1'; }, 900000, 1000);
     await dormir(4000);
     const F = window.__forgeBrep; let foco = null;
     // el escaneo del Foco (foco-molde.ts ResultadoFoco): hallazgos con su medido/límite, el par MÁS JUSTO aunque cumpla y la cobertura
     try { const f = F.focoMolde(); foco = { cilindros: f.cilindros.length, pares: f.pares, ms: f.ms,
       masJusto: f.masJusto ? { acero: f.masJusto.acero, limite: f.masJusto.limite, a: f.masJusto.nombreA, b: f.masJusto.nombreB } : null,
       hallazgos: f.hallazgos.map((h) => ({ sev: h.sev, tipo: h.tipo, titulo: h.titulo, frase: h.frase, medido: h.medido, limite: h.limite, regla: h.regla, a: h.a.nombre, b: h.b.nombre, lugares: h.lugares.length })) }; } catch (e) { foco = 'ERR ' + e; }
     await datos('06', { e3Ms: e3.ms, armadoMs: Math.round(performance.now() - t0), portamoldes: pm.ok, telemetria: F.telemetria, soporte: F.moldSupport ? F.moldSupport() : null, geom: resumenGeom(), foco, apertura: { clamp: F.animZ('clamp'), ejector: F.animZ('ejector') } });
     return 'molde ' + (pm.ok ? 'E8 + portamoldes en ' + Math.round((performance.now() - t0) / 1000) + ' s' : 'NO TERMINÓ') + ' · pines ' + ((molde() || {}).pinesIds || '(ninguno)').split(' ').length;`,
  { still: 's06-molde-trabaja', lee: 'el molde entero trabajando (ciclo animado)' });
  // las tres vistas del molde: cerrado, abierto/expulsando y la IMAGEN-CONTROL (lienzo 3D apagado), en orden sorteado
  const vistas = {
    cerrado: `window.__forgeBrep.inspeccion.estado(0, 0); await dormir(1800); return 'cerrado';`,
    // la apertura y la expulsión REALES de la pose abierta (la misma lectura que usa la inspección: animZ del clamp y de la expulsora)
    abierto: `window.__forgeBrep.inspeccion.estado(1, 1); await dormir(1800); const F = window.__forgeBrep;
      await manda('vista-abierta.json', { clamp: F.animZ('clamp'), ejector: F.animZ('ejector'), pieza: F.animZ('pieza') }); return 'abierto · clamp ' + F.animZ('clamp');`,
    control: `window.__forgeBrep.inspeccion.estado(0, 0); for (const c of document.querySelectorAll('canvas')) c.style.visibility = 'hidden'; await dormir(900); return 'control';`,
  };
  const restaura = `for (const c of document.querySelectorAll('canvas')) c.style.visibility = '';`;
  controlEn.forEach((tipo, k) => E(`${restaura}\n${vistas[tipo]}`, { still: `s06-molde-${'abc'[k]}`, lee: 'una vista del molde', vista: tipo }));
  // 7 · LA INSPECCIÓN. MEDIDO (corrida 1, 2026-10-24): la inspección LEE la apertura con animZ('clamp') 450 ms después de pedir
  // estado(1,0) (ForgeBRepStudio ~L5440); si en esa ventana forja-drive está tomando una captura 4K, no hay cuadro, la lectura
  // sale 0 y el punto 4 dice «abre 0.0 mm ✗ NO CUMPLE» con el molde abierto en pantalla. Por eso: (a) el Foco (07b) se filma
  // ANTES, con su tecla Q (el gesto del runner del camino), y (b) la inspección se espera ENTERA dentro de un solo eval, sin
  // capturas, hasta que existen sus 4 puntos.
  E(`${restaura} window.__forgeBrep.inspeccion.estado(null); await dormir(800); return 'listo para el Foco';`);
  A.push({ type: 'key', key: 'q', settle: 600 });
  E(`const r = await hasta(() => q('foco-molde'), 15000); await dormir(5200);
     await datos('07-foco'); return 'foco ' + (r.ok ? 'ok' : 'NO SALIÓ');`, { still: 's07-el-foco', lee: 'el veredicto del escaneo y su ALCANCE (¿dice qué revisó y qué no?)' });
  E(`window.__forgeBrep.focoMoldeCerrar(); await dormir(900); clic('parte-lente-inspeccion');
     const r = await hasta(() => { const R = window.__forgeBrep.recorrido(); return R && R.length >= 4; }, 45000);
     await dormir(600); return 'inspección ' + (r.ok ? 'con sus 4 puntos en ' + r.ms + ' ms' : 'SIN RECORRIDO');`);
  for (let i = 0; i < 4; i++) {
    E(`const r = await hasta(() => { const R = window.__forgeBrep.recorrido(); return R && R.length > ${i}; }, 25000);
       if (!r.ok) { await datos('07-punto-${i + 1}', { sinPunto: true }); return 'sin punto ${i + 1}'; }
       window.__forgeBrep.inspeccionPunto(${i}); await dormir(${i === 3 ? 6500 : 3200});
       const R = window.__forgeBrep.recorrido();
       // los puntos del recorrido (inspeccion-recorrido.ts PuntoRecorrido): pregunta, número, límite, veredicto, frase, regla, cotas
       let rj = null; try { rj = R.map((p) => ({ id: p.id, pregunta: p.pregunta, numero: p.numero, limite: p.limite, veredicto: p.veredicto, frase: p.frase, regla: p.regla, cotas: (p.cotas || []).map((c) => ({ etiqueta: c.etiqueta, ok: c.ok })) })); } catch (e) { rj = 'ERR ' + e; }
       await datos('07-punto-${i + 1}', ${i === 0 ? '{ recorrido: rj }' : 'null'});
       return 'punto ${i + 1}: ' + ((R[${i}] || {}).id || '?');`, { still: `s07-punto-${i + 1}`, lee: `el punto ${i + 1} del recorrido: su corte, su cota y su número` });
  }
  // 8 · LOS PLANOS — la lámina 0 (ensamble + BOM) y la hoja de análisis; después el texto de TODAS las láminas
  E(`clic('parte-lente-planos');
     const r = await hasta(() => { const p = q('planos-del-molde'); return p && +p.dataset.paginas >= 3; }, 240000, 500);
     await dormir(1200); clic('planos-del-molde-pagina-0'); await dormir(2500);
     await datos('08-ensamble', { esperaMs: r.ms, paginas: (q('planos-del-molde') || { dataset: {} }).dataset.paginas });
     return 'planos ' + (r.ok ? r.ms + ' ms' : 'NO SALIERON');`, { still: 's08-lamina-ensamble', lee: 'la lámina del ensamble: cajetín, BOM, escala, marca de BORRADOR' });
  // el CAJETÍN de la lámina 0 queda abajo del cuadro (medido, corrida 2): se baja el scroll de la hoja para que el revisor lo
  // VEA (renglón A4 de la rúbrica: ISO 2768-mK, Ra 0.8, «DIBUJÓ: La Forja CAD»)
  const desliza = (abajo) => `const s0 = q('planos-del-molde-svg'); let n = 0; for (let e = s0; e && e !== document.body; e = e.parentElement) { if (e.scrollHeight > e.clientHeight + 4) { e.scrollTop = ${abajo ? 'e.scrollHeight' : '0'}; n++; } }`;
  E(`${desliza(true)} await dormir(1500); return 'cajetín: ' + n + ' contenedores deslizados';`, { still: 's08-lamina-cajetin', lee: 'el cajetín de la lámina del ensamble: ¿quién dibujó/revisó/aprobó?, tolerancias, acabados, escala, BORRADOR' });
  E(`${desliza(false)} const bs = [...document.querySelectorAll('[data-testid^="planos-del-molde-pagina-"]')];
     const b = bs.find((x) => /an[aá]lisis/i.test(x.textContent)) || bs[1]; if (b) b.click(); await dormir(2500);
     await datos('08-analisis', { pagina: b ? b.textContent : null, nombres: bs.map((x) => x.textContent) });
     return 'hoja: ' + (b ? b.textContent : '?');`, { still: 's08-hoja-de-analisis', lee: 'la hoja de análisis: tonelaje, máquina, ciclo, costo' });
  E(`const bs = [...document.querySelectorAll('[data-testid^="planos-del-molde-pagina-"]')]; const L = [];
     for (let i = 0; i < bs.length; i++) { bs[i].click(); await dormir(450); const s = q('planos-del-molde-svg'); L.push({ i, nombre: bs[i].textContent, texto: s ? [...s.querySelectorAll('text')].map((t) => t.textContent.trim()).filter(Boolean).join('\\n') : '' }); }
     await manda('laminas.json', L); clic('btn-planos-molde-close'); await dormir(900);
     return L.length + ' láminas leídas';`);
  // 9 · EL EXPEDIENTE — el panel y el archivo que el cliente se lleva (el Blob del botón, interceptado)
  E(`clic('parte-lente-expediente'); const r = await hasta(() => q('expediente-de-la-pieza'), 60000); await dormir(3200);
     const x = q('expediente-de-la-pieza');
     await datos('09', { esperaMs: r.ms, dataset: x ? Object.assign({}, x.dataset) : null });
     return 'expediente ' + (r.ok ? 'ok' : 'NO SALIÓ');`, { still: 's09-el-expediente', lee: 'el panel del expediente: ¿BORRADOR?, ¿firmas?, ¿palomitas verdes junto a pendientes?' });
  E(`const orig = URL.createObjectURL; let blob = null, nombre = null;
     URL.createObjectURL = (b) => { blob = b; return orig.call(URL, b); };
     const oc = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { nombre = this.download; return oc.call(this); };
     clic('btn-expediente-descargar'); await dormir(800);
     URL.createObjectURL = orig; HTMLAnchorElement.prototype.click = oc;
     if (!blob) return 'SIN DESCARGA';
     const html = await blob.text(); await manda('expediente.html', html); await manda('expediente-nombre.txt', nombre || '');
     return 'expediente ' + html.length + ' bytes · ' + nombre;`);
  return A;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// PROCESAR (sin GPU): de lo que llegó al buzón → textos/, numeros.json, hallazgos-texto.json, indice.json
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const leeJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
/** HTML → texto legible (para que el revisor lo lea con Read sin 1 MB de SVG): fuera estilos, scripts y atributos */
function htmlATexto(html) {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d|section|table|text|tspan|title)>/gi, '\n').replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}
function procesa(DIR) {
  const B = path.join(DIR, 'buzon');
  const pasos = fs.existsSync(B) ? fs.readdirSync(B).filter((f) => /^paso-.*\.json$/.test(f)).sort() : [];
  fs.mkdirSync(path.join(DIR, 'textos'), { recursive: true });
  const fuentes = {};   // nombre → texto (lo que el detector y el revisor leen)
  for (const f of pasos) {
    const d = leeJSON(path.join(B, f)); if (!d) continue;
    const nombre = f.replace(/^paso-|\.json$/g, '');
    let t = `# PASO ${nombre} · lo que el cliente VE en pantalla (texto con opacidad > 0, dentro del cuadro)\n\n${d.texto || ''}\n`;
    if (d.extra && d.extra.completo) t += `\n\n# EL DICTAMEN COMPLETO (la lámina entera, también lo que queda abajo del cuadro)\n\n${d.extra.completo}\n`;
    fs.writeFileSync(path.join(DIR, 'textos', `${nombre}.txt`), t);
    fuentes[`pantalla ${nombre}`] = t;
  }
  const L = leeJSON(path.join(B, 'laminas.json')) || [];
  if (L.length) {
    fs.writeFileSync(path.join(DIR, 'textos', 'laminas.txt'), L.map((l) => `# LÁMINA ${l.i} · ${l.nombre}\n${l.texto}\n`).join('\n'));
    for (const l of L) fuentes[`lámina ${l.i} (${l.nombre})`] = l.texto;
  }
  const exp = path.join(B, 'expediente.html');
  if (fs.existsSync(exp)) {
    const html = fs.readFileSync(exp, 'utf8');
    fs.copyFileSync(exp, path.join(DIR, 'expediente.html'));
    const txt = htmlATexto(html);
    fs.writeFileSync(path.join(DIR, 'textos', 'expediente.txt'), `# EL EXPEDIENTE DESCARGADO (${html.length} bytes de HTML → texto)\n\n${txt}\n`);
    fuentes['expediente descargado'] = txt;
  }
  // el detector de apagones: dónde aparece cada uno (con 60 caracteres de contexto). Señala; NO juzga.
  const control = controlDelDetector();
  const hallazgos = APAGONES.map((p) => {
    const donde = [];
    for (const [fuente, texto] of Object.entries(fuentes)) {
      const re = new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : p.re.flags + 'g');
      let m; let n = 0; const ej = [];
      while ((m = re.exec(texto))) { n++; if (ej.length < 3) ej.push(texto.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60).replace(/\s+/g, ' ')); }
      if (n) donde.push({ fuente, veces: n, ejemplos: ej });
    }
    return { id: p.id, que: p.que, apariciones: donde.reduce((a, d) => a + d.veces, 0), donde };
  });
  fs.writeFileSync(path.join(DIR, 'hallazgos-texto.json'), JSON.stringify({ nota: 'Detector mecánico de los apagones del debate (00-PLAN.md). Señala DÓNDE aparece cada patrón; el revisor confirma con el still y decide ◆/◇/✓ con la RUBRICA.', controlDelDetector: control, hallazgos }, null, 1));
  // los números
  const numeros = numerosDe(DIR);
  fs.writeFileSync(path.join(DIR, 'numeros.json'), JSON.stringify(numeros, null, 1));
  return { pasos: pasos.length, laminas: L.length, expediente: fs.existsSync(exp), controlOk: control.every((c) => c.ok), hallazgos };
}

/** LOS NÚMEROS (los que la orden D llama dorados: mismos nombres de campo que su orden) + dónde aparece cada uno en pantalla.
 *  Cada número dice de dónde salió: `api` (leído de __forgeBrep / dataset del molde) o `texto` (leído del rótulo que el
 *  cliente ve). Lo que no se pudo leer queda null con su razón: no se inventa. */
function numerosDe(DIR) {
  const B = path.join(DIR, 'buzon');
  const P = (n) => leeJSON(path.join(B, `paso-${n}.json`)) || {};
  const p06 = P('06'), e06 = p06.extra || {}, m06 = p06.molde || {};
  const rec = ((P('07-punto-1').extra || {}).recorrido) || [];
  const tx = (n) => (P(n).texto || '');
  const num = (s) => (s == null ? null : +String(s).replace(',', '.'));
  const primero = (re, s) => { const m = (s || '').match(re); return m ? m : null; };
  const pines = (m06.pinesIds || '').split(/\s+/).filter(Boolean).map((x) => { const [id, l] = x.split(':'); return { id, largoMm: num(l) }; });
  const roles = (e06.geom && e06.geom.roles) || {};
  const tramosAgua = Object.entries(roles).filter(([k]) => /^agua-/.test(k)).reduce((a, [, v]) => a + v, 0);
  const foco = typeof e06.foco === 'object' && e06.foco ? e06.foco : null;
  // la holgura agua↔barreno más justa de TODO el molde (aunque cumpla): `masJusto` del escaneo; si no viene, el menor medido
  const holguras = foco ? [foco.masJusto && foco.masJusto.acero, ...foco.hallazgos.map((h) => h.medido)].map(num).filter(Number.isFinite) : [];
  const n = {
    folio: leeJSON(path.join(DIR, 'folio.json')),
    pieza: { paredMm: num(m06.pared), cargaMs: (P('02').extra || {}).cargaMs ?? null, invariantes: (P('02').extra || {}).invariantes ?? null },
    molde: {
      estacion: num(m06.estacion), portamoldes: m06.portamoldes === '1', partes: num(m06.partes), armadoS: e06.armadoMs ? +(e06.armadoMs / 1000).toFixed(1) : null,
      pines: { n: pines.length, fuente: 'api: dataset pinesIds (E7 por agarre §11.2.5)', tabla: pines },
      tramosAgua: { n: tramosAgua, fuente: 'api: roles agua-* de moldGeom()' },
      soporte: e06.soporte ? { pilares: e06.soporte.supportPillars, soporteMm: e06.soporte.supportMm, anchoMm: e06.soporte.widthMm, fuente: 'api: moldSupport()' } : null,
      carrera: { libreMm: num(m06.carreraLibre), pedidaMm: num(m06.carreraPedida), fuente: 'api: dataset del molde (E8)' },
      foco: foco ? { cilindros: foco.cilindros, pares: foco.pares, fallas: foco.hallazgos.filter((h) => h.sev === 'falla').length, dePanzazo: foco.hallazgos.filter((h) => h.sev !== 'falla').length,
        holguraMinMm: holguras.length ? +Math.min(...holguras).toFixed(2) : null, masJusto: foco.masJusto, hallazgos: foco.hallazgos, fuente: 'api: focoMolde()' } : null,
      telemetria: e06.telemetria || null,
    },
    recorrido: Array.isArray(rec) ? rec : [],
    rotulos: {
      // del texto VISIBLE de cada paso (lo que el cliente lee). Patrones medidos sobre la corrida 2026-10-24 de la 1594C Box.
      enfriamiento_s: (tx('03').match(/\b\d+(?:[.,]\d+)?\s?s\b/g) || []).slice(0, 12),
      dictamen_puntaje: (primero(/\b(\d{1,3})\s*\/\s*100\b/, tx('04')) || [])[1] ?? null,   // \s*: «70  /100» (el revisor vio el null)
      expediente_panel: tx('09').split('\n').filter((l) => /DICTAMEN|DECISIONES|COTIZACI|PLANOS|pendiente|BORRADOR|firma/i.test(l)).slice(0, 12),
    },
  };
  // DÓNDE aparece cada número clave (ayuda para la COHERENCIA entre pasos de la rúbrica): se busca el número con 2 y 1
  // decimales en el texto visible de cada paso, en las láminas y en el expediente.
  const fuentes = {};
  for (const f of fs.existsSync(path.join(DIR, 'textos')) ? fs.readdirSync(path.join(DIR, 'textos')) : []) fuentes[f.replace(/\.txt$/, '')] = fs.readFileSync(path.join(DIR, 'textos', f), 'utf8');
  const desp = leeJSON(path.join(B, 'dictamen-desplegado.json'));
  if (desp && Array.isArray(desp.filas)) {
    // (corrida 3: el detalle de DP se traía la fila siguiente de su misma sección; se corta en la siguiente marca ✗/⚠/✓)
    fuentes['04-desplegado'] = desp.filas.map((f) => `## ${f.nombre}\n${(f.detalle || '(sin detalle)').split(/\n[✗⚠✓]\n/)[0].trim()}`).join('\n\n');
    fs.writeFileSync(path.join(DIR, 'textos', '04-dictamen-filas.txt'), `# EL DICTAMEN · el detalle de cada fila ✗ (desplegada una por una; el cliente las ve plegadas en s04)\n\n${fuentes['04-desplegado']}\n`);
  }
  const abierta = leeJSON(path.join(B, 'vista-abierta.json'));
  // LOS DORADOS DEL TEXTO: lo que la app ESCRIBE (hoja, expediente, láminas). Cada uno guarda la frase exacta de donde salió;
  // los patrones se midieron sobre la corrida 1 (2026-10-24, 1594C Box). Si un rótulo cambia de forma, el campo sale null
  // con «no encontrado» (no se inventa): el revisor lo lee del still.
  const de = (fuente, re, f) => { const t = fuentes[fuente]; const m = t && t.match(re); return m ? { ...f(m), frase: m[0].replace(/\s+/g, ' ').trim(), fuente: `texto: ${fuente}` } : { valor: null, fuente: `texto: ${fuente}`, nota: 'no encontrado' }; };
  n.dorados = {
    clamp: de('08-analisis', /clamp\s*([\d.]+)\s*%\s*de\s*([\d.]+)\s*t/, (m) => ({ pct: +m[1], maquinaT: +m[2] })),
    tonelajeDictamen: de('expediente', /presi[oó]n de cavidad\s*([\d.]+)\s*MPa\s*→\s*([\d.]+)\s*t/, (m) => ({ pCavidadMPa: +m[1], t: +m[2] })),
    fuerzaExpulsion: de('expediente', /F_eject\s*([\d.]+)\s*N\s*=\s*([\d.]+)\s*%\s*del cierre\s*\(([\d.]+)\s*t\)/, (m) => ({ N: +m[1], pctCierre: +m[2], cierreT: +m[3] })),
    soporte: de('expediente', /Placa de soporte\s*([\d.]+)\s*mm\s*\+\s*(\d+)\s*pilares/, (m) => ({ soporteMm: +m[1], pilares: +m[2] })),
    flecha: de('expediente', /con\s*(\d+)\s*pilares y\s*([\d.]+)\s*mm de deflexi[oó]n/, (m) => ({ pilares: +m[1], mm: +m[2] })),
    enfriamientoPantalla: de('03', /de\s+([\d.]+)\s+s[\s\S]*?([\d.]+)\s+s la mitad\s+([\d.]+)\s+s abre/, (m) => ({ abreS: +m[3], mitadS: +m[2], relojTotalS: +m[1] })),
    enfriamientoExpediente: de('expediente', /t_c\s*=\s*([\d.]+)\s*s\s*\(Eq\s*([\d.]+)\)/, (m) => ({ s: +m[1], eq: m[2] })),
    coladaVsPieza: de('expediente', /t_c colada\s*([\d.]+)\s*s vs t_c pieza\s*([\d.]+)\s*s/, (m) => ({ coladaS: +m[1], piezaS: +m[2] })),
    costoMolde: de('expediente', /EL DINERO[\s\S]{0,40}?\$\s*([\d,]+)/, (m) => ({ cifra: +m[1].replace(/,/g, ''), moneda: 'NO DICHA (por dentro USD a 100/h, moldmachine.ts:185)' })),
    costoMoldeDictamen: de('expediente', /cold-2placas\s*×\s*1\s*cav\s*—\s*molde\s*\$([\d,]+)/, (m) => ({ cifra: +m[1].replace(/,/g, '') })),
    cavidadesDictamen: de('04', /×\s*(\d+)\s*cav/, (m) => ({ n: +m[1] })),
    cavidadesHoja: de('08-analisis', /cold-\w+\s*×\s*(\d+)/, (m) => ({ n: +m[1] })),
    guiaExpediente: de('expediente', /pilares\s*⌀\s*(\d+)/, (m) => ({ mm: +m[1] })),
    guiaLaminas: de('laminas', /pilar gu[ií]a[^\n⌀]*⌀\s*(\d+)/, (m) => ({ mm: +m[1] })),
    claroDictamen: de('04-desplegado', /## CLARO[^\n]*\n[\s\S]{0,600}?(\d+(?:\.\d+)?)\s*mm/, (m) => ({ mm: +m[1] })),
    aperturaPunto4: de('07-punto-4', /abre\s+([\d.]+)\s+mm/, (m) => ({ mm: +m[1] })),
  };
  n.molde.aperturaVista = abierta ? { clampMm: abierta.clamp, expulsoraMm: abierta.ejector, fuente: 'api: animZ en la pose abierta (estado 1,1)' } : null;
  n.molde.tramosAgua.n = ((e06.geom && e06.geom.cuerpos) || []).filter((c) => /^agua-[AB]-/.test(c.role)).length || tramosAgua;
  n.molde.tramosAgua.fuente = 'api: roles agua-A-* y agua-B-* de moldGeom() (sin tapones, o-rings ni la lámina del baffle)';
  // con su UNIDAD: un «3» suelto pega en todo (corrida 1: «3 t» aparecía «en» 8 fuentes); «3 t» no
  const busca = (v, u) => { if (!Number.isFinite(v)) return []; const fs2 = new Set([v.toFixed(2), v.toFixed(1), String(v)]); return Object.entries(fuentes).filter(([, t]) => [...fs2].some((s) => new RegExp(`(?<![\\d.])${s.replace('.', '[.,]')}(?![\\d])\\s*${u}(?![A-Za-z])`).test(t))).map(([k]) => k); };
  n.dondeAparece = {
    holguraMinMm: { valor: n.molde.foco ? n.molde.foco.holguraMinMm : null, en: busca(n.molde.foco ? n.molde.foco.holguraMinMm : NaN, 'mm') },
    carreraLibreMm: { valor: n.molde.carrera.libreMm, en: busca(n.molde.carrera.libreMm, 'mm') },
    carreraPedidaMm: { valor: n.molde.carrera.pedidaMm, en: busca(n.molde.carrera.pedidaMm, 'mm') },
    paredMm: { valor: n.pieza.paredMm, en: busca(n.pieza.paredMm, 'mm') },
    tcAbreS: { valor: n.dorados.enfriamientoPantalla.abreS ?? null, en: busca(n.dorados.enfriamientoPantalla.abreS, 's') },
    tcExpedienteS: { valor: n.dorados.enfriamientoExpediente.s ?? null, en: busca(n.dorados.enfriamientoExpediente.s, 's') },
    clampT: { valor: n.dorados.tonelajeDictamen.t ?? null, en: busca(n.dorados.tonelajeDictamen.t, 't') },
  };
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// CORRER
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function corre() {
  const STEP = argv.find((a) => !a.startsWith('--') && /\.(stp|step)$/i.test(a));
  if (!STEP || !fs.existsSync(STEP)) { console.error('uso: URL=<app> node scripts/revisor/captura.cjs <pieza.stp> [--intake json] [--commit sha] [--raiz dir]'); process.exit(2); }
  const ctrl = controlDelDetector();
  if (!ctrl.every((c) => c.ok)) { console.error('EL DETECTOR FALLA SU PROPIO CONTROL:', JSON.stringify(ctrl.filter((c) => !c.ok))); process.exit(1); }
  const sha = crypto.createHash('sha256').update(fs.readFileSync(STEP)).digest('hex');
  let intake = null; try { intake = arg('--intake') ? JSON.parse(arg('--intake')) : null; } catch (e) { console.error('--intake no es JSON:', e.message); process.exit(2); }
  const host = new URL(URL_APP).hostname;
  if (!/^(localhost|127\.0\.0\.1)$/.test(host)) log(`AVISO: ${host} no es localhost — el buzón (127.0.0.1) puede quedar bloqueado por Local Network Access`);

  // EL COMMIT: --commit manda; si no, temis-deploy.json servido, que se declara NO VERIFICADO si es más viejo que el build
  const base = URL_APP.replace(/\/[^/]*$/, '');
  let commit = { sha: arg('--commit') || null, fuente: arg('--commit') ? 'argumento --commit' : null, verificado: !!arg('--commit'), nota: null };
  let buildFecha = null;
  try { const r = await fetch(URL_APP, { method: 'HEAD' }); buildFecha = r.headers.get('last-modified'); } catch (e) {}
  if (!commit.sha) {
    try {
      const j = await (await fetch(base + '/temis-deploy.json')).json();
      commit = { sha: (j.commit || '').slice(0, 7) || null, fuente: 'temis-deploy.json servido', verificado: true, nota: `temis-deploy.json: ${j.fecha} · host ${j.host}` };
      // la fecha de temis-deploy.json viene sin zona: se toma como CDMX (−06:00) y se compara con el Last-Modified del build
      const tTemis = Date.parse(String(j.fecha).replace(' ', 'T') + ':00-06:00'), tBuild = buildFecha ? Date.parse(buildFecha) : NaN;
      if (Number.isFinite(tTemis) && Number.isFinite(tBuild) && tBuild - tTemis > 3600e3) {
        commit.verificado = false;
        commit.nota += ` · MÁS VIEJO que el build servido (${buildFecha}): el commit del build NO se sabe`;
      }
    } catch (e) { commit = { sha: null, fuente: 'ninguna', verificado: false, nota: 'sin --commit y sin temis-deploy.json legible' }; }
  }
  log(`STEP ${path.basename(STEP)} · sha256 ${sha.slice(0, 12)} · commit ${commit.sha || '?'} (${commit.verificado ? 'verificado' : 'NO VERIFICADO'}) · ${URL_APP}`);

  const DIR = path.join(RAIZ, `_en-curso-${Date.now()}`);
  fs.mkdirSync(path.join(DIR, 'buzon'), { recursive: true });
  // EL BUZÓN
  const servidor = http.createServer((req, res) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Private-Network': 'true' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    if (req.method !== 'POST') { res.writeHead(405, cors); res.end(); return; }
    const nombre = path.basename(decodeURIComponent(req.url.slice(1))).replace(/[^\w.\-]/g, '_');
    const partes = []; req.on('data', (c) => partes.push(c));
    req.on('end', () => { fs.writeFileSync(path.join(DIR, 'buzon', nombre), Buffer.concat(partes)); res.writeHead(200, cors); res.end('ok'); });
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const BUZON = `http://127.0.0.1:${servidor.address().port}`;
  // la IMAGEN-CONTROL: su lugar entre las tres vistas del molde se sortea EN CADA CORRIDA (con el SHA, la misma pieza revisada dos
  // veces la tenía en el mismo lugar) y se guarda fuera del paquete
  const orden = [['cerrado', 'abierto', 'control'], ['cerrado', 'control', 'abierto'], ['control', 'cerrado', 'abierto'], ['abierto', 'cerrado', 'control'], ['abierto', 'control', 'cerrado'], ['control', 'abierto', 'cerrado']][crypto.randomInt(6)];
  const acciones = elCamino(BUZON, path.resolve(STEP), orden);
  fs.mkdirSync(path.join(DIR, 'drive'), { recursive: true });
  fs.writeFileSync(path.join(DIR, 'drive', 'actions.json'), JSON.stringify(acciones, null, 1));
  log(`${acciones.length} gestos → forja-drive · buzón ${BUZON} · ${DIR}`);

  // EL MOTOR: forja-drive.cjs, como lo corre camino-runner.cjs (sin turntable), a 1536×864 × DPR 2.5 = 3840×2160
  const rc = await new Promise((resolve) => {
    const hijo = spawn(process.execPath, [path.join(__dirname, '..', 'forja-drive.cjs'), path.join(DIR, 'drive', 'actions.json'), path.join(DIR, 'drive')], {
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, URL: URL_APP, TURNTABLE: '0', W: '1536', H: '864', DPR: '2.5' } });
    hijo.stdout.on('data', (d) => String(d).split('\n').filter(Boolean).forEach((l) => log('  drive ·', l.slice(0, 220))));
    hijo.stderr.on('data', (d) => String(d).split('\n').filter(Boolean).forEach((l) => log('  drive ! ', l.slice(0, 220))));
    const tope = setTimeout(() => { log('TOPE de 25 min: se detiene forja-drive'); hijo.kill('SIGTERM'); }, 25 * 60 * 1000);
    hijo.on('exit', (c) => { clearTimeout(tope); resolve(c); });
  });
  servidor.close();
  const meta = leeJSON(path.join(DIR, 'drive', 'meta.json')) || {};
  log(`forja-drive salió rc=${rc} · ${(meta.steps || []).length} capturas · errores: ${(meta.errors || []).length}${meta.fatal ? ' · FATAL ' + meta.fatal.slice(0, 160) : ''}`);

  // LOS STILLS: la captura que forja-drive tomó DESPUÉS de cada gesto con `still` → JPEG 4K (q 2: ~1–2 MB) en stills/
  fs.mkdirSync(path.join(DIR, 'stills'), { recursive: true });
  const indice = [];
  const archivos = fs.readdirSync(path.join(DIR, 'drive'));
  acciones.forEach((a, k) => {
    if (!a.still) return;
    const png = archivos.find((f) => f.startsWith(`step_${String(k + 1).padStart(2, '0')}_`) && f.endsWith('.png'));
    const jpg = path.join(DIR, 'stills', `${a.still}.jpg`);
    if (png) { try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(DIR, 'drive', png), '-q:v', '2', jpg]); } catch (e) { log('ffmpeg', png, String(e).slice(0, 120)); } }
    indice.push({ still: `stills/${a.still}.jpg`, existe: fs.existsSync(jpg), lee: a.lee, gesto: k + 1 });
  });
  // solo se quedan los stills (cada PNG 4K pesa ~6 MB; iangpu tiene el C: al 94 %)
  for (const f of fs.readdirSync(path.join(DIR, 'drive'))) if (f.endsWith('.png')) fs.unlinkSync(path.join(DIR, 'drive', f));

  // EL FOLIO
  const arr = leeJSON(path.join(DIR, 'buzon', 'arranque.json')) || {};
  const sid = (arr.sid || 'nosid').replace(/[^\w-]/g, '');
  const folio = { folio: `${sid} · ${commit.sha || 'commit?'} · ${sha.slice(0, 12)}`, sesion: sid, commit, buildServido: buildFecha, step: { nombre: path.basename(STEP), sha256: sha, bytes: fs.statSync(STEP).size },
    url: URL_APP, gpu: arr.gpu || '?', viewport: arr.viewport || null, fecha: new Date().toISOString(), maquina: require('os').hostname(), intakeDeclarado: intake,
    intakeNota: 'Hoy el camino no tiene entrada de material, volumen ni máquina (solo existe en la E1 del curso): lo declarado se GUARDA y el revisor lo compara contra lo que la app usó.' };
  fs.writeFileSync(path.join(DIR, 'folio.json'), JSON.stringify(folio, null, 1));
  if (intake) fs.writeFileSync(path.join(DIR, 'intake.json'), JSON.stringify(intake, null, 1));
  const pr = procesa(DIR);
  fs.writeFileSync(path.join(DIR, 'indice.json'), JSON.stringify({ folio: folio.folio, stills: indice, textos: fs.readdirSync(path.join(DIR, 'textos')).map((f) => `textos/${f}`),
    gestos: (meta.steps || []).filter((s) => /^eval\[/.test(s)), errores: meta.errors || [], fatal: meta.fatal || null }, null, 1));

  // EL SEGURO DE PINES (filma-camino.cjs): sin pines por agarre en la E7 el molde no es de esta pieza
  const nums = leeJSON(path.join(DIR, 'numeros.json')) || { molde: { pines: { n: 0 } } };
  const faltan = indice.filter((s) => !s.existe).map((s) => s.still);
  let estado = 'completo', salida = 0;
  if (!nums.molde.pines.n) { estado = 'MOLDE_SOSPECHOSO: la E7 no trae pines por agarre — el molde no es de esta pieza; se repite la captura'; salida = 3; }
  else if (faltan.length || !pr.expediente || pr.pasos < 10 || !pr.controlOk) { estado = `INCOMPLETO: faltan stills [${faltan.join(', ')}] · pasos ${pr.pasos} · expediente ${pr.expediente} · control del detector ${pr.controlOk}`; salida = 4; }

  // el lugar de la imagen-control va FUERA del paquete: el revisor no debe saberlo
  // la fecha del folio en CDMX (toISOString daba el día siguiente en la noche: la corrida del 24 salió «2026-10-25»)
  const nombreFolio = `${new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' })}-${path.basename(STEP).replace(/\.[^.]+$/, '').replace(/[^\w]+/g, '-')}-${sha.slice(0, 12)}-${sid}`;
  fs.mkdirSync(path.join(RAIZ, '_control'), { recursive: true });
  const k = orden.indexOf('control');
  fs.writeFileSync(path.join(RAIZ, '_control', `${nombreFolio}.json`), JSON.stringify({ folio: folio.folio, imagenControl: `stills/s06-molde-${'abc'[k]}.jpg`, defecto: 'el lienzo 3D apagado (visibility:hidden en los <canvas>): la tarjeta dice «ESTACIÓN 8 DE 8 · EL PORTAMOLDES · el molde ENTERO» y no hay molde en pantalla', vistas: orden.map((v, i) => ({ still: `stills/s06-molde-${'abc'[i]}.jpg`, vista: v })) }, null, 1));
  const FINAL = path.join(RAIZ, salida === 0 ? nombreFolio : `_invalido-${nombreFolio}`);
  if (fs.existsSync(FINAL)) fs.rmSync(FINAL, { recursive: true, force: true });
  fs.renameSync(DIR, FINAL);
  fs.writeFileSync(path.join(FINAL, 'ESTADO.txt'), `${estado}\n`);
  log(`${estado} · ${indice.filter((s) => s.existe).length}/${indice.length} stills · ${pr.pasos} pasos · ${pr.laminas} láminas · expediente ${pr.expediente} · ${((Date.now() - T0) / 60000).toFixed(1)} min`);
  for (const h of pr.hallazgos) if (h.apariciones) log(`  señal · ${h.id} × ${h.apariciones} (${h.donde.map((d) => d.fuente).join('; ').slice(0, 140)})`);
  console.log(`FOLIO ${folio.folio}`);
  console.log(`PAQUETE ${FINAL}`);
  process.exit(salida);
}

if (argv[0] === '--seco') {
  // EN SECO (sin GPU, sin app): arma los gestos y comprueba que cada `eval` compile y que el detector pase su control
  const A = elCamino('http://127.0.0.1:1', '/x/pieza.stp', ['cerrado', 'abierto', 'control']);
  const malos = A.filter((a) => a.type === 'eval').map((a, k) => { try { new Function(`return ${a.js}`); return null; } catch (e) { return `eval ${k}: ${e.message}`; } }).filter(Boolean);
  const ctrl = controlDelDetector();
  console.log(JSON.stringify({ gestos: A.length, stills: A.filter((a) => a.still).map((a) => a.still), evalsQueNoCompilan: malos, detector: ctrl.every((c) => c.ok) ? 'control OK' : ctrl.filter((c) => !c.ok) }, null, 1));
  process.exit(malos.length || !ctrl.every((c) => c.ok) ? 1 : 0);
} else if (argv[0] === '--procesa') {
  const DIR = path.resolve(argv[1]);
  const pr = procesa(DIR);
  console.log(JSON.stringify({ pasos: pr.pasos, laminas: pr.laminas, expediente: pr.expediente, controlDelDetector: pr.controlOk, senales: pr.hallazgos.filter((h) => h.apariciones).map((h) => `${h.id}×${h.apariciones}`) }));
} else corre().catch((e) => { console.error('FATAL', e); process.exit(1); });
