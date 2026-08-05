#!/usr/bin/env node
/**
 * telemetria-limpia.cjs — SEPARA a los usuarios de nosotros.
 *
 * Probamos en producción, así que nuestras sesiones caen en el mismo events.jsonl que las
 * de la gente. Sin separarlas, el tablero miente — y mintió: con el tráfico sucio el
 * Comando decía 1731 sesiones, mediana 1.5s y 277 entradas al laboratorio CAD con 11.6
 * clicks cada una. Parecía que el CAD enganchaba. Eran 270 sesiones NUESTRAS de escritorio.
 * Limpio: 1399 sesiones, mediana 0.9s, 12 entradas al CAD. La conclusión iba al revés.
 *
 * NO borra nada: el crudo se queda intacto y aquí solo se ETIQUETA. Un dato descartado por
 * error se puede recuperar; uno borrado, no.
 *
 * Uso:
 *   node scripts/telemetria-limpia.cjs <events.jsonl>          informe legible
 *   node scripts/telemetria-limpia.cjs <events.jsonl> --json   para otros scripts
 *   require('./telemetria-limpia.cjs').clasificar(evento) -> {limpio, motivo}
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'telemetria-ignorar.json'), 'utf8'));
const NUESTRAS = CFG.ips.map(x => x.prefijo);
const BOTS = CFG.bots.map(x => x.prefijo);

// UA de automatización: nuestros propios arneses (Playwright/headless) y crawlers declarados.
const UA_ROBOT = /bot|crawl|spider|slurp|HeadlessChrome|Playwright|Puppeteer|curl|wget|python-requests/i;
// Navegador DENTRO de una app (Instagram, TikTok, Facebook). El 97% del tráfico real vive aquí.
const UA_INAPP = /Instagram|FBAV|FBAN|FB_IAB|TikTok|Line\/|; wv\)/i;
const UA_MOVIL = /Android|iPhone|iPad|Mobile/i;
const empieza = (s, lista) => lista.some(p => (s || '').startsWith(p));

/** ¿Este evento es de un usuario de verdad? Devuelve el motivo cuando no lo es. */
function clasificar(e) {
  const ip = e.ip || '', ua = e.ua || '';
  // 1. Marca explícita del cliente (?dev=1 → localStorage). Es la más confiable porque
  //    sobrevive a cambios de IP; las demás reglas son el respaldo para el histórico.
  if (e.dev === true || (e.data && e.data.dev === true)) return { limpio: false, motivo: 'nosotros:marcado' };
  if (empieza(ip, NUESTRAS)) return { limpio: false, motivo: 'nosotros:ip' };
  if (empieza(ip, BOTS)) return { limpio: false, motivo: 'bot:ip' };
  if (UA_ROBOT.test(ua)) return { limpio: false, motivo: 'bot:ua' };
  // 2. LAN y loopback: pruebas locales que salieron por un túnel.
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fd7a:)/.test(ip)) return { limpio: false, motivo: 'nosotros:lan' };
  return { limpio: true, motivo: 'real' };
}

/** Agrupa eventos en sesiones y las clasifica (una sesión es sucia si CUALQUIER evento suyo lo es). */
function sesiones(eventos) {
  const S = new Map();
  for (const e of eventos) {
    const sid = e.sid;
    if (!sid) continue;
    if (!S.has(sid)) S.set(sid, { sid, ip: '', ua: '', pv: [], clicks: 0, t0: null, t1: null, motivo: 'real' });
    const s = S.get(sid);
    if (e.ip) s.ip = e.ip;
    if (e.ua) s.ua = e.ua;
    if (typeof e.t === 'number') { s.t0 = s.t0 === null ? e.t : Math.min(s.t0, e.t); s.t1 = s.t1 === null ? e.t : Math.max(s.t1, e.t); }
    if (e.type === 'pageview') s.pv.push((e.url || '').split('?')[0].replace(/^https?:\/\/[^/]+/, '') || '/');
    if (e.type === 'click') s.clicks++;
    const c = clasificar(e);
    if (!c.limpio && s.motivo === 'real') s.motivo = c.motivo;
  }
  return [...S.values()];
}

/** IPs que HUELEN a máquina de pruebas nueva. No se descartan: se reportan. */
function sospechosas(ses) {
  const U = CFG.umbral_sospecha, por = new Map();
  for (const s of ses) {
    if (s.motivo !== 'real') continue;
    const k = s.ip;
    if (!por.has(k)) por.set(k, { n: 0, escritorio: 0 });
    const p = por.get(k); p.n++;
    if (!UA_MOVIL.test(s.ua)) p.escritorio++;
  }
  return [...por.entries()]
    .filter(([, p]) => p.n >= U.sesiones_minimas && p.escritorio / p.n >= U.fraccion_escritorio)
    .map(([ip, p]) => ({ ip, sesiones: p.n, escritorio: p.escritorio }))
    .sort((a, b) => b.sesiones - a.sesiones);
}

/** Métricas del embudo sobre las sesiones LIMPIAS. */
function embudo(ses) {
  const L = ses.filter(s => s.motivo === 'real');
  const n = L.length || 1;
  const dur = L.filter(s => s.t0 !== null).map(s => (s.t1 - s.t0) / 1000).sort((a, b) => a - b);
  const pct = p => dur.length ? dur[Math.min(dur.length - 1, Math.floor(dur.length * p / 100))] : 0;
  const unaPagina = L.filter(s => new Set(s.pv).size <= 1).length;
  const entradas = {};
  for (const s of L) if (s.pv[0]) entradas[s.pv[0]] = (entradas[s.pv[0]] || 0) + 1;
  return {
    sesiones: L.length,
    descartadas: ses.length - L.length,
    c1_segunda_pagina: +(((L.length - unaPagina) / n) * 100).toFixed(2),
    mediana_s: +pct(50).toFixed(1),
    p75_s: +pct(75).toFixed(1),
    p90_s: +pct(90).toFixed(1),
    rebote_3s_pct: +((dur.filter(d => d <= 3).length / n) * 100).toFixed(1),
    movil_pct: +((L.filter(s => UA_MOVIL.test(s.ua)).length / n) * 100).toFixed(1),
    inapp_pct: +((L.filter(s => UA_INAPP.test(s.ua)).length / n) * 100).toFixed(1),
    clicks_por_sesion: +(L.reduce((a, s) => a + s.clicks, 0) / n).toFixed(2),
    entradas: Object.fromEntries(Object.entries(entradas).sort((a, b) => b[1] - a[1]).slice(0, 8)),
  };
}

// ═══ LA FRONTERA ═══════════════════════════════════════════════════════════════════════
// El 2026-08-05 a las 12:43:32 (hora local) se publicó el arreglo que llevó el montaje de
// React de 31.4 s a 1.1 s. TODO lo medido ANTES viene de un sitio que tardaba medio minuto
// en funcionar, con una mediana de sesión de 0.9 s: nadie lo había visto trabajar, así que
// ese c1 de 1.65% no mide el sitio — mide la espera.
//
// Sin esta frontera, en una semana los números serán una MEZCLA de los dos sitios y el
// antes/después se vuelve irrecuperable. No se borra nada: se PARTE.
const FRONTERA_PERF = 1785955412000;   // ms epoch · react en su propio chunk, en producción

function analizar(texto, desde = null) {
  const eventos = [];
  for (const l of texto.split('\n')) { if (!l.trim()) continue; try { eventos.push(JSON.parse(l)); } catch { /* línea rota */ } }
  const todas = sesiones(eventos);
  const ses = desde ? todas.filter(s => (s.t1 ?? 0) >= desde) : todas;
  const motivos = {};
  for (const s of ses) motivos[s.motivo] = (motivos[s.motivo] || 0) + 1;
  const antes = todas.filter(s => (s.t1 ?? 0) < FRONTERA_PERF);
  const despues = todas.filter(s => (s.t1 ?? 0) >= FRONTERA_PERF);
  return {
    eventos: eventos.length, motivos, embudo: embudo(ses), sospechosas: sospechosas(ses),
    // El antes/después del arreglo de rendimiento, cada uno por su lado. `despues` es el
    // único que mide el sitio ACTUAL; `antes` se queda de referencia histórica.
    perf: { frontera: FRONTERA_PERF, antes: embudo(antes), despues: embudo(despues) },
  };
}

module.exports = { clasificar, sesiones, embudo, sospechosas, analizar };

if (require.main === module) {
  const f = process.argv[2];
  if (!f) { console.error('uso: telemetria-limpia.cjs <events.jsonl> [--json]'); process.exit(2); }
  const r = analizar(fs.readFileSync(f, 'utf8'));
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  const E = r.embudo;
  console.log(`\n═══ TELEMETRÍA LIMPIA · ${r.eventos} eventos ═══`);
  console.log('sesiones por origen:');
  for (const [k, v] of Object.entries(r.motivos).sort((a, b) => b[1] - a[1])) console.log(`   ${String(v).padStart(5)}  ${k}`);
  console.log(`\nEMBUDO (${E.sesiones} sesiones reales · ${E.descartadas} descartadas)`);
  console.log(`   c1 (llegan a una 2a página) .. ${E.c1_segunda_pagina} %`);
  console.log(`   mediana de sesión ............ ${E.mediana_s}s   (p75 ${E.p75_s}s · p90 ${E.p90_s}s)`);
  console.log(`   se van en ≤3 s ............... ${E.rebote_3s_pct} %`);
  console.log(`   móvil ${E.movil_pct} % · dentro de app ${E.inapp_pct} % · clicks/sesión ${E.clicks_por_sesion}`);
  console.log('   entradas:');
  for (const [u, n] of Object.entries(E.entradas)) console.log(`      ${String(n).padStart(5)}  ${u}`);
  const P = r.perf;
  if (P && P.despues.sesiones > 0) {
    console.log(`\nANTES vs DESPUÉS del arreglo de rendimiento (frontera 2026-08-05 12:43)`);
    const fila = (n, e) => `   ${n.padEnd(9)} ${String(e.sesiones).padStart(5)} ses · c1 ${String(e.c1_segunda_pagina).padStart(5)}% · mediana ${String(e.mediana_s).padStart(5)}s · rebote≤3s ${String(e.rebote_3s_pct).padStart(5)}%`;
    console.log(fila('ANTES', P.antes));
    console.log(fila('DESPUÉS', P.despues));
    if (P.despues.sesiones < 300) console.log(`   ⚠ solo ${P.despues.sesiones} sesiones después — todavía NO concluyas nada (hacen falta ~950 por rama)`);
  }
  if (r.sospechosas.length) {
    console.log('\n⚠ IPs que HUELEN a máquina de pruebas (no se descartaron; revisar y, si son nuestras,');
    console.log('  agregarlas a config/telemetria-ignorar.json):');
    for (const s of r.sospechosas) console.log(`   ${String(s.sesiones).padStart(4)} sesiones · ${s.escritorio} de escritorio · ${s.ip}`);
  }
  console.log();
}
