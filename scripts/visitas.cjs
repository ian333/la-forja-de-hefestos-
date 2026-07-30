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
const pag = (u) => String(u || '').replace('https://university.gaiaprime.com.mx', '').split('#')[0] || '/';

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
  console.log('   fecha             ip                min   recorrido');
  for (const ev of vivas.sort((a, b) => a[0].t - b[0].t)) {
    ev.sort((a, b) => a.t - b.t);
    const min = ((ev[ev.length - 1].t - ev[0].t) / 60000).toFixed(1);
    const ruta = [...new Set(ev.filter((r) => r.type === 'pageview').map((r) => pag(r.url)))].slice(0, 4);
    console.log(`   ${fecha(ev[0].t)}  ${String(ev[0].ip).slice(0, 16).padEnd(17)} ${min.padStart(5)}  ${ruta.join(' → ').slice(0, 78)}`);
  }
} else {
  console.log('\n  ⚠ CERO visitantes reales en la ventana.');
}

// ERRORES que vio la gente (lo que rompe una visita y nunca nos enteramos)
const errs = enVentana.filter((r) => !esNuestro(r) && !esBot(r) && /error|unhandled/i.test(r.type || ''));
if (errs.length) {
  console.log(`\n  ⚠ ERRORES vistos por visitantes reales: ${errs.length}`);
  for (const e of errs.slice(-6)) console.log(`   ${fecha(e.t)} ${pag(e.url)} — ${JSON.stringify(e.data).slice(0, 110)}`);
}
console.log('');
