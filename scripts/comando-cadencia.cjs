#!/usr/bin/env node
/**
 * comando-cadencia.cjs — genera la CADENCIA DE SUBIDA (calendario sugerido)
 * a partir del catálogo de piezas + lo que la data dijo que jala.
 *
 * Lógica (embudo): el ESPECTÁCULO (astro/átomos/moléculas) es el gancho diario que
 * construye audiencia; la ECONOMÍA es a donde se gradúa. 1 Short/día a las 3 redes
 * cortas, rotando familias, ~6 espectáculo + 1 economía por semana. Arranca con los
 * ganadores probados (agujero negro, cadenas de moléculas, reel de Romer).
 *
 * Sale public/comando/cadencia.json: { slots:[ {dia, familia, pieceId, titulo,
 *   plataformas[], gancho} ], pauta }. La página la muestra como vista "Cadencia"
 *   (día relativo a la fecha de inicio que el usuario fija).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/comando/catalogo.json'), 'utf8'));

const SHORTS = ['TikTok', 'Instagram', 'YouTube'];
// rotación semanal (7 días): espectáculo de gancho + economía de misión
const TEMPLATE = ['astro', 'atomo', 'molecula', 'adn', 'astro', 'atomo', 'economia'];
const DIAS = 56;          // 8 semanas de pista

// piezas por familia (cortas/verticales primero)
const byFam = {};
for (const p of cat.pieces) {
  const tieneVertical = p.formatos['9:16'] || p.formatos['video'];
  (byFam[p.familia] ||= []).push({ ...p, _v: !!tieneVertical });
}
// ordenar: ganadores probados primero (por nombre/tema conocido), luego el resto
const WINNERS = ['agujero', 'tde', 'pulsar', 'C16', 'hexadeca', 'oro', 'oxigeno', 'romer', 'brca1', 'telomero'];
const score = (p) => { const t = (p.titulo + ' ' + p.tema).toLowerCase(); return WINNERS.findIndex(w => t.includes(w)); };
for (const f in byFam) byFam[f].sort((a, b) => { const sa = score(a), sb = score(b); return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb); });

// para "economia" en Shorts usamos lo corto (reel); las clases largas van aparte
const famDaily = { astro: 'astro', atomo: 'atomo', molecula: 'molecula', adn: 'adn', economia: 'clase' };
const cursor = {};
function nextPiece(fam) {
  const key = famDaily[fam] || fam;
  const list = (byFam[key] || []).filter(p => p._v);
  if (!list.length) return null;
  const i = (cursor[key] || 0) % list.length; cursor[key] = (cursor[key] || 0) + 1;
  return list[i];
}

const slots = [];
for (let d = 1; d <= DIAS; d++) {
  const fam = TEMPLATE[(d - 1) % TEMPLATE.length];
  const p = nextPiece(fam) || nextPiece('atomo');
  if (!p) continue;
  slots.push({ dia: d, familia: fam, pieceId: p.id, titulo: p.titulo, plataformas: SHORTS, gancho: fam !== 'economia' });
}

// clases largas a YouTube — 1 por semana (la misión, profundidad)
const clases = (byFam['clase'] || []).filter(p => p.formatos['16:9']);
const semanal = clases.map((p, i) => ({ semana: i + 1, pieceId: p.id, titulo: p.titulo, plataforma: 'YouTube (clase completa)' }));

const pauta = '1 Short/día a TikTok+Instagram+YouTube (mismo vertical). Rotación: espectáculo de gancho (astro/átomo/molécula/ADN) + 1 economía/semana. 1 clase larga a YouTube por semana, con CTA a la clase. A/B el título entre plataformas.';

fs.writeFileSync(path.join(ROOT, 'public/comando/cadencia.json'), JSON.stringify({ slots, semanal, pauta, generatedAt: process.env.STAMP || '' }));
console.log(`✓ cadencia.json — ${slots.length} días de Shorts + ${semanal.length} clases semanales`);
console.log('  primeros 7 días: ' + slots.slice(0, 7).map(s => `${s.familia}:${s.titulo.slice(0, 18)}`).join(' | '));
