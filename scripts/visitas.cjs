/**
 * visitas.cjs — ¿QUIÉN ENTRÓ? Lee la telemetría de ATLAS y separa lo único que
 * importa: VISITANTES DE VERDAD vs nosotros (operador + sondas headless) vs bots.
 *
 * Sin esto, la pregunta "¿ha entrado gente?" costaba un ssh + un parser a mano
 * cada vez — y la respuesta cruda MIENTE: el 88 % de los pageviews de la Forja
 * son del propio operador y de mis sondas de Playwright.
 *
 *   node scripts/visitas.cjs            # últimos 30 días
 *   node scripts/visitas.cjs --dias 90  # ventana distinta
 *   node scripts/visitas.cjs --todo     # historia completa
 *   node scripts/visitas.cjs --archivo <jsonl>   # lee un log local en vez de ATLAS
 */
const { execFileSync } = require('child_process');
const fs = require('fs');

const ATLAS = process.env.ATLAS || 'ian@100.97.118.117';
const LOG = '/mnt/hdd/forja-telemetry/events.jsonl';
const args = process.argv.slice(2);
const TODO = args.includes('--todo');
const DIAS = TODO ? 1e6 : Number(args[args.indexOf('--dias') + 1]) || 30;

// REDES DEL OPERADOR: casa/oficina de ian + el rango IPv6 de su ISP. iangpu
// (donde corren mis sondas) sale por estas MISMAS IPs, así que la marca de
// headless en el UA es el segundo filtro, no el primero.
const CASA = new Set(['187.190.194.239', '189.217.82.175', '201.165.24.135', '201.165.25.73']);
const esNuestro = (r) => {
  const ip = String(r.ip || '');
  return CASA.has(ip) || ip.startsWith('2806:2f0:') || /Headless/i.test(r.ua || '');
};
const esBot = (r) => {
  const ua = (r.ua || '').toLowerCase(), ip = String(r.ip || '');
  return ip.startsWith('66.249.')                    // Googlebot
    || ip.startsWith('2a03:2880:')                   // Meta/Facebook (previews de IG)
    || ip.startsWith('74.125.')                      // Google fetch
    || /bot|spider|crawl|preview|externalhit|curl|python-requests|node-fetch/.test(ua);
};

// `--archivo` lee un .jsonl local con el MISMO formato. Existe porque la parte
// de estadística (el bloque A/B) no se puede probar contra producción sin
// esperar días de tráfico: con un archivo de eventos sintéticos se comprueba
// que un empate se reporta como empate y una diferencia real como diferencia.
// Un intervalo de confianza mal programado es peor que no tenerlo — se lee
// como rigor.
const ARCHIVO = args.includes('--archivo') ? args[args.indexOf('--archivo') + 1] : null;
const raw = ARCHIVO
  ? fs.readFileSync(ARCHIVO, 'utf8')
  : execFileSync('ssh', [ATLAS, `cat ${LOG}`], { maxBuffer: 256 * 1024 * 1024 }).toString();
const rows = [];
for (const l of raw.split('\n')) {
  if (!l.trim()) continue;
  try { rows.push(JSON.parse(l)); } catch { /* línea corrupta: se salta */ }
}
const corte = Date.now() - DIAS * 864e5;
const enVentana = rows.filter((r) => (r.t || 0) >= corte);
const fecha = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
// La ruta, SIN los parámetros de campaña. Hasta el 2026-08-03 cada evento
// arrastraba el utm_* + fbclid completo (400+ caracteres de Meta), así que
// "QUÉ VIERON" listaba 1000 URLs distintas que en realidad eran la misma "/".
// El cliente ya las manda limpias; esto normaliza también lo histórico.
const TRACKING = /^(utm_[a-z_]+|fbclid|gclid|gbraid|wbraid|msclkid|ttclid|twclid|igshid|mc_eid|mc_cid|_ga|ref_src|ref_url)$/i;
const pag = (u) => {
  let s = String(u || '').replace(/^https?:\/\/[^/]+/, '').split('#')[0];
  const [ruta, qs] = s.split('?');
  if (!qs) return ruta || '/';
  const keep = qs.split('&').filter((kv) => !TRACKING.test(kv.split('=')[0]));
  return (ruta || '/') + (keep.length ? '?' + keep.join('&') : '');
};
// Percentiles sobre una muestra chica: sin interpolación, el valor observado.
const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};
const num = (n, d = 0) => (n === null || n === undefined ? '—' : Number(n).toFixed(d));

const pv = enVentana.filter((r) => r.type === 'pageview');
const nuestros = pv.filter(esNuestro), bots = pv.filter((r) => !esNuestro(r) && esBot(r));
const gente = pv.filter((r) => !esNuestro(r) && !esBot(r));

console.log(`\n═══ VISITAS · últimos ${TODO ? 'TODOS los' : DIAS} días ═══`);
console.log(`  pageviews: ${pv.length}  →  GENTE ${gente.length} · nosotros ${nuestros.length} · bots ${bots.length}`);
console.log(`  visitantes únicos (IP): ${new Set(gente.map((r) => r.ip)).size} · sesiones: ${new Set(gente.map((r) => r.sid)).size}`);

const porPag = new Map();
for (const r of gente) porPag.set(pag(r.url), (porPag.get(pag(r.url)) || 0) + 1);
if (porPag.size) {
  console.log('\n  QUÉ VIERON:');
  for (const [u, n] of [...porPag].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`   ${String(n).padStart(4)}  ${u}`);
}

// SESIONES de gente real, con duración y recorrido (¿pasaron del atrio a una clase?)
const ses = new Map();
for (const r of enVentana) {
  if (esNuestro(r) || esBot(r)) continue;
  if (!ses.has(r.sid)) ses.set(r.sid, []);
  ses.get(r.sid).push(r);
}
const vivas = [...ses.values()].filter((ev) => ev.some((r) => r.type === 'pageview'));
if (vivas.length) {
  console.log('\n  SESIÓN POR SESIÓN (la más reciente al final):');
  console.log('   fecha             ip                 seg   recorrido');
  for (const ev of vivas.sort((a, b) => a[0].t - b[0].t)) {
    ev.sort((a, b) => a.t - b.t);
    // La duración por diferencia de timestamps SUBESTIMA siempre: quien mira 40 s
    // sin tocar nada figuraba como 0 s porque no generaba eventos. El evento
    // `salida` trae el tiempo real con la pestaña al frente; se prefiere.
    const sal = [...ev].reverse().find((r) => r.type === 'salida');
    const seg = sal ? sal.data?.s ?? 0 : (ev[ev.length - 1].t - ev[0].t) / 1000;
    const ruta = [...new Set(ev.filter((r) => r.type === 'pageview').map((r) => pag(r.url)))].slice(0, 4);
    console.log(`   ${fecha(ev[0].t)}  ${String(ev[0].ip).slice(0, 16).padEnd(17)} ${num(seg).padStart(5)}${sal ? '*' : ' '} ${ruta.join(' → ').slice(0, 78)}`);
  }
  console.log('   (* duración medida por el evento `salida`; sin asterisco es estimada por timestamps)');
} else {
  console.log('\n  ⚠ CERO visitantes reales en la ventana.');
}

// ERRORES que vio la gente (lo que rompe una visita y nunca nos enteramos)
const errs = enVentana.filter((r) => !esNuestro(r) && !esBot(r) && /error|unhandled/i.test(r.type || ''));
if (errs.length) {
  console.log(`\n  ⚠ ERRORES vistos por visitantes reales: ${errs.length}`);
  for (const e of errs.slice(-6)) console.log(`   ${fecha(e.t)} ${pag(e.url)} — ${JSON.stringify(e.data).slice(0, 110)}`);
}

// ══════════════════════════════════════════════════════════════════════════
// DE DÓNDE VIENEN — el utm parseado una vez por sesión (evento `origen`).
// ══════════════════════════════════════════════════════════════════════════
const origenes = enVentana.filter((r) => !esNuestro(r) && !esBot(r) && r.type === 'origen');
console.log('\n═══ ORIGEN ═══');
if (!origenes.length) {
  console.log('  sin datos (el evento `origen` se instaló el 2026-08-03; hace falta tráfico nuevo)');
} else {
  const porFuente = new Map(), porCampana = new Map();
  for (const r of origenes) {
    const f = r.data?.fuente ?? '?';
    porFuente.set(f, (porFuente.get(f) || 0) + 1);
    if (r.data?.campana) porCampana.set(r.data.campana, (porCampana.get(r.data.campana) || 0) + 1);
  }
  console.log('  ' + [...porFuente].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(' · '));
  if (porCampana.size) {
    console.log('  campañas:');
    for (const [c, n] of [...porCampana].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`   ${String(n).padStart(4)}  ${c}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// WEB VITALS — la pregunta es si el 65 % que se va antes de 3 s se va porque
// no le interesó o porque LA PÁGINA NO HABÍA PINTADO. Sin esto, adivinanza.
// Umbrales de Google: LCP bueno ≤2.5 s / malo >4 s · INP bueno ≤200 ms /
// malo >500 ms · CLS bueno ≤0.1 / malo >0.25. Se mira el p75, que es el que
// define la experiencia "típica mala".
// ══════════════════════════════════════════════════════════════════════════
const vitals = enVentana.filter((r) => !esNuestro(r) && !esBot(r) && r.type === 'vitals');
console.log('\n═══ WEB VITALS ═══');
if (!vitals.length) {
  console.log('  sin datos (se instaló el 2026-08-03; hace falta tráfico nuevo)');
} else {
  const col = (k) => vitals.map((r) => r.data?.[k]).filter((v) => typeof v === 'number');
  const fila = (nom, k, unidad, d, bueno, malo) => {
    const xs = col(k);
    if (!xs.length) return console.log(`  ${nom.padEnd(22)} sin muestras`);
    const p75 = pct(xs, 0.75);
    const juicio = p75 <= bueno ? '✓ bueno' : p75 > malo ? '✗ MALO' : '~ mejorable';
    console.log(`  ${nom.padEnd(22)} p50 ${num(pct(xs, 0.5), d).padStart(7)}${unidad}  p75 ${num(p75, d).padStart(7)}${unidad}  p90 ${num(pct(xs, 0.9), d).padStart(7)}${unidad}   ${juicio}  (n=${xs.length})`);
  };
  fila('LCP (pinta el héroe)', 'lcp', ' ms', 0, 2500, 4000);
  fila('INP (respuesta)', 'inp', ' ms', 0, 200, 500);
  fila('CLS (salto de layout)', 'cls', '', 3, 0.1, 0.25);
  fila('FCP (1er pixel)', 'fcp', ' ms', 0, 1800, 3000);
  fila('TTFB (servidor)', 'ttfb', ' ms', 0, 800, 1800);
  fila('1ª interacción', 'tpi', ' ms', 0, 5000, 15000);
  const conTpi = vitals.filter((r) => r.data?.toco).length;
  console.log(`  llegaron a TOCAR algo: ${conTpi}/${vitals.length} (${Math.round((conTpi / vitals.length) * 100)}%)`);

  // El LCP por GPU es lo accionable: si el p75 se dispara en Mali-G52/Adreno
  // 610 y no en Apple, el problema es la escena 3D, no la red.
  const gpuPorSid = new Map();
  for (const r of enVentana) if (r.type === 'webgl_probe') gpuPorSid.set(r.sid, r.data?.renderer || '?');
  const porGpu = new Map();
  for (const r of vitals) {
    const g = gpuPorSid.get(r.sid) || '?';
    if (typeof r.data?.lcp !== 'number') continue;
    if (!porGpu.has(g)) porGpu.set(g, []);
    porGpu.get(g).push(r.data.lcp);
  }
  const peores = [...porGpu].filter(([, xs]) => xs.length >= 3).sort((a, b) => pct(b[1], 0.75) - pct(a[1], 0.75)).slice(0, 6);
  if (peores.length) {
    console.log('  LCP p75 por GPU (los peores primero):');
    for (const [g, xs] of peores) console.log(`   ${num(pct(xs, 0.75)).padStart(6)} ms  ${String(g).slice(0, 28).padEnd(29)} n=${xs.length}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// EL LABORATORIO — "de la gente que SÍ se queda, ¿qué toca?"
// Antes esto era imposible: los clics se guardaban como DOM crudo
// ({tag:"BUTTON", cls:"px-3 py-1.5…"}) y eran anónimos. Ahora hay eventos
// con nombre y la medida que decide si el hub sirve: elementos DISTINTOS
// por sesión. Mediana 1 = la tabla no invita a explorar.
// ══════════════════════════════════════════════════════════════════════════
const lab = enVentana.filter((r) => !esNuestro(r) && !esBot(r) && String(r.type || '').startsWith('lab.'));
console.log('\n═══ LABORATORIO ═══');
if (!lab.length) {
  console.log('  sin datos (los eventos con nombre se instalaron el 2026-08-03; hace falta tráfico nuevo)');
} else {
  const porSid = new Map();
  for (const r of lab) {
    if (!porSid.has(r.sid)) porSid.set(r.sid, { el: new Set(), mol: new Set(), tabs: [], orbito: false, audio: 0, bloq: 0 });
    const o = porSid.get(r.sid);
    const t = String(r.type).slice(4);
    if (t === 'elemento') o.el.add(r.data?.Z);
    if (t === 'molecula') o.mol.add(r.data?.key);
    if (t === 'tab') o.tabs.push(r.data?.a);
    if (t === 'orbita') o.orbito = true;
    if (t === 'audio' && r.data?.accion === 'play') o.audio++;
    if (t === 'audio' && r.data?.accion === 'bloqueado') o.bloq++;
  }
  const ses = [...porSid.values()];
  const distintos = ses.map((o) => o.el.size).filter((n) => n > 0).sort((a, b) => a - b);
  console.log(`  sesiones con actividad en el lab: ${ses.length}`);
  if (distintos.length) {
    console.log(`  ELEMENTOS DISTINTOS por sesión: mediana ${pct(distintos, 0.5)} · p75 ${pct(distintos, 0.75)} · máx ${distintos[distintos.length - 1]}`);
    const uno = distintos.filter((n) => n === 1).length;
    console.log(`   · tocaron UNO solo: ${uno}/${distintos.length} (${Math.round((uno / distintos.length) * 100)}%)  ← si esto es alto, el hub no está funcionando`);
    console.log(`   · tocaron 3 o más:  ${distintos.filter((n) => n >= 3).length}/${distintos.length}`);
  }
  const molSes = ses.map((o) => o.mol.size).filter((n) => n > 0);
  if (molSes.length) console.log(`  moléculas distintas por sesión: mediana ${pct(molSes.sort((a, b) => a - b), 0.5)} (en ${molSes.length} sesiones)`);

  const topEl = new Map();
  for (const r of lab.filter((r) => r.type === 'lab.elemento')) {
    const k = `${r.data?.simbolo ?? '?'} (Z=${r.data?.Z})`;
    topEl.set(k, (topEl.get(k) || 0) + 1);
  }
  if (topEl.size) {
    console.log('  ELEMENTOS MÁS TOCADOS:');
    for (const [k, n] of [...topEl].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`   ${String(n).padStart(4)}  ${k}`);
  }
  const topMol = new Map();
  for (const r of lab.filter((r) => r.type === 'lab.molecula')) topMol.set(r.data?.formula ?? r.data?.key, (topMol.get(r.data?.formula ?? r.data?.key) || 0) + 1);
  if (topMol.size) {
    console.log('  MOLÉCULAS MÁS TOCADAS:');
    for (const [k, n] of [...topMol].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`   ${String(n).padStart(4)}  ${k}`);
  }
  const tabs = new Map();
  for (const r of lab.filter((r) => r.type === 'lab.tab')) tabs.set(r.data?.a, (tabs.get(r.data?.a) || 0) + 1);
  if (tabs.size) console.log('  PESTAÑAS a las que cambiaron: ' + [...tabs].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · '));
  const vista = new Map();
  for (const r of lab.filter((r) => r.type === 'lab.vista')) vista.set(r.data?.a, (vista.get(r.data?.a) || 0) + 1);
  if (vista.size) console.log('  VISTA del átomo (cambios): ' + [...vista].map(([k, n]) => `→${k} ${n}`).join(' · '));
  console.log(`  GIRARON la escena con el dedo: ${ses.filter((o) => o.orbito).length}/${ses.length} sesiones`);
  const audio = ses.filter((o) => o.audio > 0).length, bloq = ses.filter((o) => o.bloq > 0).length;
  console.log(`  NARRACIÓN: sonó en ${audio} sesiones · el navegador la BLOQUEÓ en ${bloq}`);
}

// ══════════════════════════════════════════════════════════════════════════
// EMBUDO — llegó → tocó algo → 3+ elementos → cambió de pestaña.
// Cada escalón es una decisión distinta del visitante; el escalón donde se
// desploma es el que hay que arreglar.
// ══════════════════════════════════════════════════════════════════════════
const sesGente = new Map();
for (const r of enVentana) {
  if (esNuestro(r) || esBot(r)) continue;
  if (!sesGente.has(r.sid)) sesGente.set(r.sid, []);
  sesGente.get(r.sid).push(r);
}
const conPv = [...sesGente.values()].filter((ev) => ev.some((r) => r.type === 'pageview'));
if (conPv.length) {
  const llegó = conPv.length;
  const tocó = conPv.filter((ev) => ev.some((r) => r.type === 'click' || String(r.type).includes('.'))).length;
  const entróLab = conPv.filter((ev) => ev.some((r) => pag(r.url) === '/lab.html')).length;
  const tres = conPv.filter((ev) => {
    const s = new Set(ev.filter((r) => r.type === 'lab.elemento').map((r) => r.data?.Z));
    return s.size >= 3;
  }).length;
  const cambióTab = conPv.filter((ev) => ev.some((r) => r.type === 'lab.tab')).length;
  console.log('\n═══ EMBUDO ═══');
  const paso = (nom, n) => console.log(`  ${nom.padEnd(30)} ${String(n).padStart(5)}  ${String(Math.round((n / llegó) * 100)).padStart(3)}%  ${'█'.repeat(Math.max(0, Math.round((n / llegó) * 40)))}`);
  paso('llegó', llegó);
  paso('tocó algo', tocó);
  paso('entró al laboratorio', entróLab);
  paso('tocó 3+ elementos distintos', tres);
  paso('cambió de pestaña', cambióTab);
}

// ══════════════════════════════════════════════════════════════════════════
// PUNTO DE SALIDA — dónde se quedó la gente al irse, y cuánto bajó.
// ══════════════════════════════════════════════════════════════════════════
const salidas = enVentana.filter((r) => !esNuestro(r) && !esBot(r) && r.type === 'salida');
console.log('\n═══ SALIDA ═══');
if (!salidas.length) {
  console.log('  sin datos (se instaló el 2026-08-03; hace falta tráfico nuevo)');
} else {
  const ultima = new Map();   // la ÚLTIMA salida de cada sesión es la definitiva
  for (const r of salidas.sort((a, b) => a.t - b.t)) ultima.set(r.sid, r);
  const fin = [...ultima.values()];
  const porSec = new Map();
  for (const r of fin) porSec.set(r.data?.seccion ?? '(sin sección)', (porSec.get(r.data?.seccion ?? '(sin sección)') || 0) + 1);
  console.log('  SE FUERON ESTANDO EN:');
  for (const [s, n] of [...porSec].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`   ${String(n).padStart(4)}  ${s}`);
  const segs = fin.map((r) => r.data?.s).filter((v) => typeof v === 'number');
  if (segs.length) console.log(`  SEGUNDOS VISIBLES: p25 ${pct(segs, 0.25)} · mediana ${pct(segs, 0.5)} · p75 ${pct(segs, 0.75)} · p90 ${pct(segs, 0.9)}  (n=${segs.length})`);
  const scr = fin.map((r) => r.data?.scroll).filter((v) => typeof v === 'number');
  if (scr.length) console.log(`  SCROLL MÁXIMO: mediana ${pct(scr, 0.5)}% · p75 ${pct(scr, 0.75)}% · llegó al 90 %+: ${scr.filter((v) => v >= 90).length}/${scr.length}`);
  else console.log('  SCROLL: sin muestras (las vistas medidas no scrollean)');
  const inter = fin.map((r) => r.data?.inter ?? 0);
  console.log(`  INTERACCIONES por sesión: mediana ${pct(inter, 0.5)} · sin ninguna: ${inter.filter((v) => v === 0).length}/${inter.length}`);
}

// ── ¿ALGUIEN TERMINA UNA CLASE? ──────────────────────────────────────────
// La pregunta que no se podía contestar: el reproductor no emitía eventos.
// Aquí sale el embudo real — cuántos abren, cuántos le dan a empezar,
// cuántos llegan al final, y EN QUÉ ESCENA se cae la gente.
const clases = enVentana.filter((r) => !esNuestro(r) && !esBot(r) && String(r.type || '').startsWith('masterclass.'));
console.log('\n═══ CLASES ═══');
if (!clases.length) {
  console.log('  sin datos todavía (la medición se instaló el 2026-07-30; hace falta que entre gente)');
} else {
  const porClase = new Map();
  for (const r of clases) {
    const c = r.data?.clase ?? '?';
    if (!porClase.has(c)) porClase.set(c, { inicio: 0, fin: 0, abandono: [], seg: [] });
    const o = porClase.get(c);
    const t = String(r.type).split('.')[1];
    if (t === 'inicio') o.inicio++;
    if (t === 'fin') { o.fin++; o.seg.push(r.data?.s ?? 0); }
    if (t === 'abandono') o.abandono.push({ escena: r.data?.escena ?? 0, de: r.data?.de ?? 0, pct: r.data?.pct ?? 0, s: r.data?.s ?? 0 });
  }
  for (const [c, o] of [...porClase].sort((a, b) => b[1].inicio - a[1].inicio)) {
    const tasa = o.inicio ? Math.round((o.fin / o.inicio) * 100) : 0;
    const medS = o.seg.length ? Math.round(o.seg.reduce((a, b) => a + b, 0) / o.seg.length) : 0;
    console.log(`\n  ${c}: empezaron ${o.inicio} · TERMINARON ${o.fin} (${tasa}%)${medS ? ` · ${Math.floor(medS / 60)}m${medS % 60}s de media` : ''}`);
    if (o.abandono.length) {
      const hist = new Map();
      for (const a of o.abandono) hist.set(a.escena, (hist.get(a.escena) || 0) + 1);
      const peor = [...hist].sort((a, b) => b[1] - a[1]).slice(0, 5);
      console.log(`    se fueron en la escena: ${peor.map(([e, n]) => `${e}${n > 1 ? `(×${n})` : ''}`).join(', ')}  de ${o.abandono[0].de}`);
      const medPct = Math.round(o.abandono.reduce((a, b) => a + b.pct, 0) / o.abandono.length);
      console.log(`    abandono medio al ${medPct}% de la clase`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PRUEBA A/B — la mitad de las sesiones ve una portada y la mitad la otra.
// El reparto lo hace src/lib/ab.ts hasheando el `sid`, y cada sesión anuncia
// su rama UNA vez con el evento `ab` {prueba, variante}. Sin ese evento no
// hay análisis posible: no se sabría qué vio cada quien.
//
// POR QUÉ HAY ESTADÍSTICA AQUÍ Y NO SOLO DOS PORCENTAJES: con ~350 sesiones
// por rama al día, dos ramas IDÉNTICAS se separan sola ±7 puntos de un día
// para otro. Leer eso como "ganó B" y cambiar la portada es perseguir ruido
// —y peor, archivarlo como aprendizaje—. El intervalo de confianza dice
// cuánto de lo que se ve es señal; cuando todavía no alcanza, este reporte lo
// DICE con todas sus letras en vez de coronar a un ganador falso.
//
// Se excluyen las sesiones con `forzado` (?ab=…): son mis sondas de captura.
// ══════════════════════════════════════════════════════════════════════════

// Φ(z) — normal acumulada. Abramowitz & Stegun 7.1.26 (error < 1.5e-7), que
// para decidir a 2 decimales de p sobra. Sin dependencias: este script corre
// con `node` pelón y así debe seguir.
const erf = (x) => {
  const s = x < 0 ? -1 : 1, a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592)
    * t * Math.exp(-a * a);
  return s * y;
};
const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

// Prueba de dos proporciones. El estadístico z usa el error estándar POOLED
// (es la hipótesis nula: las dos ramas salen de la misma proporción) y el
// intervalo de confianza usa el NO-pooled (bajo H0 no estamos: estimamos una
// diferencia real). Mezclarlos es el error clásico que hace que el p-valor y
// el IC se contradigan.
function propTest(xa, na, xb, nb) {
  if (!na || !nb) return null;
  const pa = xa / na, pb = xb / nb, dif = pb - pa;         // + = gana B
  const pool = (xa + xb) / (na + nb);
  const sePool = Math.sqrt(pool * (1 - pool) * (1 / na + 1 / nb));
  const seUnp = Math.sqrt((pa * (1 - pa)) / na + (pb * (1 - pb)) / nb);
  const z = sePool > 0 ? dif / sePool : 0;
  return {
    pa, pb, dif, z,
    p: 2 * (1 - normCdf(Math.abs(z))),
    lo: dif - 1.96 * seUnp, hi: dif + 1.96 * seUnp,
    // Diferencia mínima detectable con el n que YA hay (α=0.05 bilateral,
    // potencia 80 %). Si |dif| < mde, "no significativo" NO quiere decir
    // "no hay efecto": quiere decir que aún no alcanza para verlo.
    mde: 2.80158 * Math.sqrt(pool * (1 - pool) * (1 / na + 1 / nb)),
  };
}
// Sesiones POR RAMA que harían falta para detectar una diferencia de `d`.
const nParaDetectar = (p, d) => (d <= 0 ? Infinity : Math.ceil(2 * p * (1 - p) * ((2.80158 / d) ** 2)));

const evAb = enVentana.filter((r) => !esNuestro(r) && !esBot(r) && r.type === 'ab');
if (!evAb.length) {
  console.log('\n═══ PRUEBA A/B ═══');
  console.log('  sin datos (el evento `ab` se instaló el 2026-08-03; hace falta tráfico nuevo)');
} else {
  // sid → eventos, ya sin operador ni bots (sesGente se armó para el embudo).
  const pruebas = new Map();   // prueba → Map(sid → variante)
  const forzados = new Set();
  for (const r of evAb) if (r.data?.forzado) forzados.add(r.sid);
  for (const r of evAb) {
    if (forzados.has(r.sid)) continue;        // la sesión ENTERA queda fuera
    const p = r.data?.prueba ?? '?', v = r.data?.variante === 'b' ? 'b' : 'a';
    if (!pruebas.has(p)) pruebas.set(p, new Map());
    pruebas.get(p).set(r.sid, v);   // si algo la re-emitiera, gana la última
  }

  // Destino e interacción REAL dependen de la rama: cada portada manda a un
  // lugar distinto, así que "convirtió" significa cosas distintas. Lo que se
  // compara es la PROFUNDIDAD alcanzada, no la URL.
  const DESTINO = {
    a: { ruta: '/lab.html', nombre: 'laboratorio', hizo: (ev) => ev.some((r) => r.type === 'lab.elemento') },
    b: {
      ruta: '/masterclass.html', nombre: 'clase',
      hizo: (ev) => ev.some((r) => r.type === 'masterclass.escena' && (r.data?.i ?? 0) > 2),
    },
  };
  const duracionSes = (ev) => {
    const sal = [...ev].reverse().find((r) => r.type === 'salida');
    if (sal && typeof sal.data?.s === 'number') return sal.data.s;
    return (ev[ev.length - 1].t - ev[0].t) / 1000;
  };

  for (const [nombrePrueba, asignacion] of pruebas) {
    console.log(`\n═══ PRUEBA A/B · ${nombrePrueba} ═══`);
    const ramas = { a: [], b: [] };
    for (const [sid, v] of asignacion) {
      const ev = (sesGente.get(sid) || []).slice().sort((x, y) => x.t - y.t);
      if (!ev.length) continue;
      const d = duracionSes(ev);
      ramas[v].push({
        sid, ev, dur: d,
        paso3: d >= 3,
        llegoDestino: ev.some((r) => r.type === 'pageview' && pag(r.url).startsWith(DESTINO[v].ruta)),
        interactuo: DESTINO[v].hizo(ev),
      });
    }
    const na = ramas.a.length, nb = ramas.b.length, N = na + nb;
    if (!N) { console.log('  el evento `ab` llegó pero sin sesiones asociadas (¿telemetría a medias?)'); continue; }

    const ts = evAb.map((r) => r.t);
    const dias = Math.max((Math.max(...ts) - Math.min(...ts)) / 864e5, 1 / 24);
    console.log(`  viva desde ${fecha(Math.min(...ts))} · ${dias.toFixed(1)} días · ${Math.round(N / dias / 2)} sesiones/día por rama`);
    console.log(`  a = ${DESTINO.a.nombre} (${DESTINO.a.ruta}) · b = ${DESTINO.b.nombre} (${DESTINO.b.ruta})`);
    if (forzados.size) console.log(`  (${forzados.size} sesiones forzadas con ?ab= EXCLUIDAS: son sondas de verificación)`);

    // ── SRM: reparto desbalanceado = asignación rota ────────────────────
    // Un 50/50 real se desvía poco: con N=600 el desbalance típico es ±25.
    // Si el z de la binomial se dispara, el hash o el momento en que se
    // resuelve la variante están mal, y CUALQUIER conclusión de abajo sobra.
    const zSrm = N > 0 ? (na - N / 2) / (0.5 * Math.sqrt(N)) : 0;
    const pSrm = 2 * (1 - normCdf(Math.abs(zSrm)));
    const veredictoSrm = pSrm < 0.001 ? '✗ ROTO' : pSrm < 0.05 ? '~ vigilar' : '✓ ok';
    console.log(`  reparto: a ${na} · b ${nb}  (esperado 50/50 — z=${zSrm.toFixed(2)} p=${pSrm.toFixed(3)} ${veredictoSrm})`);
    if (pSrm < 0.001) {
      console.log('  ⚠⚠ RAMAS DESBALANCEADAS. Eso NO pasa por azar: revisa src/lib/ab.ts');
      console.log('     (¿se resuelve la variante antes del render? ¿el sid existe cuando se hashea?)');
      console.log('     Con la asignación rota, las diferencias de abajo NO son interpretables.');
    }

    // ── Tabla por rama ──────────────────────────────────────────────────
    const medA = pct(ramas.a.map((s) => s.dur).sort((x, y) => x - y), 0.5);
    const medB = pct(ramas.b.map((s) => s.dur).sort((x, y) => x - y), 0.5);
    console.log('');
    console.log('                              RAMA a          RAMA b        Δ (b−a)         IC 95 %            p');
    const fila = (nom, xa, xb, invertir, sinPrueba) => {
      const t = sinPrueba ? null : propTest(xa, na, xb, nb);
      const cA = `${String(xa).padStart(4)} ${String(Math.round((xa / na) * 100)).padStart(3)}%`;
      const cB = `${String(xb).padStart(4)} ${String(Math.round((xb / nb) * 100)).padStart(3)}%`;
      if (!t) return console.log(`  ${nom.padEnd(26)} ${cA}      ${cB}`);
      const pp = (v) => `${v >= 0 ? '+' : '−'}${(Math.abs(v) * 100).toFixed(1)}`;
      // `invertir` = métrica donde MENOS es mejor (el rebote). La flecha
      // apunta a la rama que gana, no al signo del número.
      const gana = t.p < 0.05 ? (invertir ? (t.dif < 0 ? ' ← b' : ' ← a') : (t.dif > 0 ? ' ← b' : ' ← a')) : '';
      console.log(`  ${nom.padEnd(26)} ${cA}      ${cB}   ${pp(t.dif).padStart(6)} pp  [${pp(t.lo).padStart(6)},${pp(t.hi).padStart(6)}]  ${t.p.toFixed(3)}${gana}`);
      return t;
    };

    fila('rebote <3 s', ramas.a.filter((s) => !s.paso3).length, ramas.b.filter((s) => !s.paso3).length, true);
    console.log(`  ${'duración mediana'.padEnd(26)} ${num(medA).padStart(4)} s      ${num(medB).padStart(4)} s`);
    console.log('  EMBUDO (denominador = todas las sesiones de la rama):');
    fila(' llegó', na, nb, false, true);   // 100 % contra 100 %: no hay nada que probar
    fila(' pasó de 3 s', ramas.a.filter((s) => s.paso3).length, ramas.b.filter((s) => s.paso3).length);
    fila(' llegó al destino', ramas.a.filter((s) => s.llegoDestino).length, ramas.b.filter((s) => s.llegoDestino).length);
    const clave = fila(' INTERACTUÓ allí', ramas.a.filter((s) => s.interactuo).length, ramas.b.filter((s) => s.interactuo).length);

    // ── Veredicto sobre la métrica que decide ───────────────────────────
    // "INTERACTUÓ allí" es la única que mide lo que queremos (que la persona
    // haga algo, no que haga clic). Es la que manda; las de arriba explican
    // EN QUÉ ESCALÓN se perdió la diferencia.
    console.log('');
    if (pSrm < 0.001) {
      // Con las ramas desbalanceadas, las dos poblaciones no son comparables:
      // lo que sea que rompió el reparto pudo tirar sesiones de forma sesgada.
      // Dar un veredicto aquí sería el peor resultado posible — un número con
      // pinta de rigor construido sobre datos que ya sabemos que están mal.
      console.log('  ⚖ SIN VEREDICTO: el reparto está roto (ver arriba). Arregla la asignación');
      console.log('     y reinicia la prueba; los datos de esta ventana no sirven.');
    } else if (!clave) {
      console.log('  ⚖ sin muestras suficientes para una prueba.');
    } else if (clave.p < 0.05) {
      const g = clave.dif > 0 ? 'b' : 'a';
      console.log(`  ⚖ VEREDICTO: gana la rama ${g} en "interactuó allí" `
        + `(${(clave.pa * 100).toFixed(1)}% vs ${(clave.pb * 100).toFixed(1)}%, p=${clave.p.toFixed(3)}).`);
      console.log(`     La diferencia real está, con 95 % de confianza, entre ${(clave.lo * 100).toFixed(1)} y ${(clave.hi * 100).toFixed(1)} puntos.`);
    } else {
      const base = (clave.pa + clave.pb) / 2 || 0.01;
      const porRamaDia = Math.max(N / dias / 2, 1);
      const sg = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}`;
      console.log('  ⚖ VEREDICTO: AÚN NO CONCLUYENTE. No hay ganador — y eso NO es lo mismo que un empate.');
      console.log(`     Observado ${sg(clave.dif)} pp, pero el IC 95 % `
        + `[${sg(clave.lo)}, ${sg(clave.hi)}] pp CRUZA EL CERO: con estos datos`);
      console.log('     la portada contraria podría ser la mejor. NO cambies nada por este número.');
      console.log(`     Con ${na}/${nb} sesiones sólo se detectarían diferencias de ${(clave.mde * 100).toFixed(1)} pp o más.`);
      const objetivo = [0.07, 0.05, 0.03];
      console.log('     Para tener potencia sobre una diferencia de:');
      for (const d of objetivo) {
        const n = nParaDetectar(base, d);
        const dd = Math.max(0, (n - Math.min(na, nb)) / porRamaDia);
        console.log(`      ${(d * 100).toFixed(0)} pp → ${n} sesiones por rama (${dd < 0.5 ? 'YA' : `faltan ~${Math.ceil(dd)} días`})`);
      }
      console.log('     Déjala correr. Cortar una prueba temprano es cómo se fabrica un aprendizaje falso.');
    }
  }
}
console.log('');
