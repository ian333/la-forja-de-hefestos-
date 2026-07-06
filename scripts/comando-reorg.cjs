#!/usr/bin/env node
/**
 * comando-reorg.cjs — genera el PLAN para ordenar la biblioteca en una taxonomía
 * limpia. Lee produccion.json (lista cruda) y produce reorg-plan.tsv: una línea
 * "viejo<TAB>nuevo" por archivo (rutas relativas a la raíz de la biblioteca).
 *   viejo = dist-video/<serie>/<archivo>   (como está hoy)
 *   nuevo = <familia>/<tema>/<archivo>      (taxonomía limpia)
 * Masters HEVC → _masters/ · tests/frames/intermedios/duplicados → _archivo/.
 * CERO borrado. Lo aplica apply-reorg.sh en cada nodo (atlas + prime).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prod = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/comando/produccion.json'), 'utf8'));

const ATOM_CANON = 'atoms-vertical';
const ARCHIVO_SERIES = new Set(['.peek', 'test-coase', 'grailframes', 'p9f', 'v16f', 'v7frames']);

function dest(v) {
  const name = v.name;
  // 1) masters HEVC → _masters (preservando familia)
  if (v.master) return `_masters/${v.serie}/${name}`;
  // 2) series basura/intermedias → _archivo
  if (ARCHIVO_SERIES.has(v.serie)) return `_archivo/${v.serie}/${name}`;
  const low = name.toLowerCase();
  if (/preview|_card|_neb|_full|_p9|_v16|_r3|_xml|_clip/.test(low)) return `_archivo/intermedios/${name}`;
  // 3) clases de economía
  if (v.serie.startsWith('clase-')) {
    const tema = v.serie.replace('clase-', '');
    if (tema === 'reel') return `economia/reels/${name}`;
    return `economia/clases/${tema}/${name}`;
  }
  // 4) átomos — solo el canónico; los demás sets → _archivo
  if (/^atoms|^all-118/.test(v.serie)) {
    if (v.serie === ATOM_CANON) return `atomos/${name}`;
    return `_archivo/atomos-${v.serie}/${name}`;
  }
  // 5) moléculas (catalog/molecules/chains)
  if (/molecul|catalog|chains/.test(v.serie)) return `moleculas/${name}`;
  // 6) ADN (dna + dna16)
  if (/^dna/.test(v.serie)) return `adn/${name}`;
  // 7) astro
  if (v.serie === 'bh-reels') return `astro/agujero-negro/${name}`;
  if (v.serie === 'tde') return `astro/tde/${name}`;
  if (v.serie === 'pulsar') return `astro/pulsar/${name}`;
  if (v.serie === 'showcase') return `astro/showcase/${name}`;
  // 8) (raiz) y otros — triage por nombre
  if (/pulsar|puls/.test(low)) return `astro/pulsar/${name}`;
  if (/grail|neb|bh|tde|magnetar|quasar/.test(low)) return `astro/misc/${name}`;
  if (/dna/.test(low)) return `adn/${name}`;
  return `_archivo/raiz/${name}`;
}

const lines = [];
for (const v of prod.videos) {
  const oldRel = `dist-video/${v.rel}`;
  const newRel = dest(v);
  if (oldRel !== newRel) lines.push(`${oldRel}\t${newRel}`);
}
const out = path.join(ROOT, 'public/comando/reorg-plan.tsv');
fs.writeFileSync(out, lines.join('\n') + '\n');

// resumen
const byFam = {};
for (const l of lines) { const f = l.split('\t')[1].split('/')[0]; byFam[f] = (byFam[f] || 0) + 1; }
console.log(`✓ reorg-plan.tsv — ${lines.length} movimientos:`);
console.log('  ' + Object.entries(byFam).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}:${n}`).join('  '));
