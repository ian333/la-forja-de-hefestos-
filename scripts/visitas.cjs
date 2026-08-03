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
 */
const { execFileSync } = require('child_process');

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

const raw = execFileSync('ssh', [ATLAS, `cat ${LOG}`], { maxBuffer: 256 * 1024 * 1024 }).toString();
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
console.log('');
