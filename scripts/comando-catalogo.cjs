#!/usr/bin/env node
/**
 * comando-catalogo.cjs — MOTOR DE CURACIÓN del Centro de Comando.
 *
 * Convierte el volcado crudo de videos (produccion.json) en PIEZAS PUBLICABLES:
 *   • filtra el ruido (masters hevc, frames, tests, .peek, intermedios _x)
 *   • agrupa los formatos de una misma pieza (9:16 reel + 16:9 youtube)
 *   • elige el render canónico cuando hay duplicados (átomos en varias carpetas)
 *   • PRE-GENERA título + descripción + hashtags por pieza (editable después)
 *
 * Sale public/comando/catalogo.json: { pieces:[ {id,familia,tema,titulo,
 *   formatos{}, descripcion, hashtags[]} ] }. El REGISTRO de subidas (qué se
 *   subió a qué plataforma, ediciones del copy) NO vive aquí — vive en el server
 *   (registro.json), y la página lo fusiona por id.
 *
 *   node scripts/comando-catalogo.cjs   (lee produccion.json, ya generado)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prod = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/comando/produccion.json'), 'utf8'));

// ── reglas de RUIDO (no publicable) ──
const SERIE_JUNK = new Set(['.peek', 'test-coase', 'grailframes', 'p9f', 'v16f', 'v7frames']);
const isJunk = (v) => {
  if (v.master) return true;                                  // hevc/master
  if (SERIE_JUNK.has(v.serie)) return true;                    // peek/tests/frames
  const n = v.name.toLowerCase();
  if (/preview|_card|_neb|_full|_p9|_v16|_r3|_xml|_clip|peek/.test(n)) return true; // intermedios
  if (v.serie === '(raiz)' && n.startsWith('_')) return true;
  return false;
};

// ── átomos: hay 5 carpetas con el mismo elemento; canónico = atoms-vertical ──
const ATOM_CANON = 'atoms-vertical';

// nombres de los 118 elementos en español (índice = Z)
const EL = [null,'Hidrógeno','Helio','Litio','Berilio','Boro','Carbono','Nitrógeno','Oxígeno','Flúor','Neón','Sodio','Magnesio','Aluminio','Silicio','Fósforo','Azufre','Cloro','Argón','Potasio','Calcio','Escandio','Titanio','Vanadio','Cromo','Manganeso','Hierro','Cobalto','Níquel','Cobre','Zinc','Galio','Germanio','Arsénico','Selenio','Bromo','Kriptón','Rubidio','Estroncio','Itrio','Circonio','Niobio','Molibdeno','Tecnecio','Rutenio','Rodio','Paladio','Plata','Cadmio','Indio','Estaño','Antimonio','Telurio','Yodo','Xenón','Cesio','Bario','Lantano','Cerio','Praseodimio','Neodimio','Prometio','Samario','Europio','Gadolinio','Terbio','Disprosio','Holmio','Erbio','Tulio','Iterbio','Lutecio','Hafnio','Tántalo','Wolframio','Renio','Osmio','Iridio','Platino','Oro','Mercurio','Talio','Plomo','Bismuto','Polonio','Astato','Radón','Francio','Radio','Actinio','Torio','Protactinio','Uranio','Neptunio','Plutonio','Americio','Curio','Berkelio','Californio','Einstenio','Fermio','Mendelevio','Nobelio','Lawrencio','Rutherfordio','Dubnio','Seaborgio','Bohrio','Hasio','Meitnerio','Darmstadtio','Roentgenio','Copernicio','Nihonio','Flerovio','Moscovio','Livermorio','Téneso','Oganesón'];

// ── copy pre-generado por familia ──
const H = (...t) => t.filter(Boolean);
// Overrides por pieza (los NARRADOS de la serie de enlaces — copy con la fórmula
// que funcionó en O₂: gancho + qué ves + wtf real + "nada inventado" + identidad)
const SPECIAL = {
  'mol-n2 triple enlace': {
    codigo: 'moleculas/_code/mol-n2-triple-enlace-capsula.tar.gz',
    titulo: 'El candado más fuerte del aire — así nace un triple enlace',
    descripcion: `Nunca habías VIAJADO dentro de una molécula. Dos átomos de nitrógeno se buscan, chocan, y forman TRES enlaces a la vez — σ, π y π, el candado más fuerte de la química. 🔬⚛️ Luego caemos 25,000 veces más adentro, hasta el núcleo: siete protones y siete neutrones que tiemblan hasta en el frío absoluto. Nada está inventado: física cuántica REAL, resuelta átomo por átomo. Es el 78% del aire que respiras — y romper ese candado alimenta a la mitad del planeta.`,
    hashtags: ['#quimica', '#nitrogeno', '#fisicacuantica', '#enlacequimico', '#atomos', '#ciencia', '#stem', '#4k'],
  },
  'mol-o2 doble enlace': {
    codigo: 'moleculas/_code/mol-o2-doble-enlace-capsula.tar.gz',
    titulo: 'El aire que respiras está lleno de imanes invisibles',
    descripcion: `El oxígeno no tiene uno, sino DOS enlaces a la vez — σ y π — y dos electrones sin pareja: por eso el O₂ es un IMÁN de verdad. 🧲⚛️ Esta vez nos clavamos DENTRO: cruzamos su nube de electrones, 25,000 veces más adentro, hasta el corazón — ocho protones y ocho neutrones que tiemblan hasta en el frío absoluto. Y lo demás es casi vacío. Nada está inventado: es la ecuación de Schrödinger resuelta átomo por átomo. Es, exactamente, el aire que respiras ahora mismo.`,
    hashtags: ['#quimica', '#oxigeno', '#fisicacuantica', '#enlacequimico', '#atomos', '#ciencia', '#stem', '#4k'],
  },
  'mol-h2 primer enlace': {
    codigo: 'moleculas/_code/mol-h2-primer-enlace-capsula.tar.gz',
    titulo: 'El primer enlace del universo',
    descripcion: `Antes de las estrellas, el universo ya sabía hacer esto. 🌌 Dos átomos de hidrógeno — el primer elemento, casi todo lo que existe — se encuentran en el vacío y forman el enlace más simple que hay: uno solo, de frente. Luego caemos sesenta mil veces más adentro, hasta su corazón: UN protón. Solo uno. La partícula más vieja del universo, temblando hasta en el frío absoluto. Nada está inventado: es la ecuación de Schrödinger resuelta átomo por átomo. De estos dos átomos nacieron las estrellas — y las estrellas te hicieron a ti.`,
    hashtags: ['#quimica', '#hidrogeno', '#fisicacuantica', '#enlacequimico', '#universo', '#ciencia', '#stem', '#4k'],
  },
  'mol-f2 paradoja': {
    codigo: 'moleculas/_code/mol-f2-paradoja-capsula.tar.gz',
    titulo: 'El elemento más violento tiene el enlace más débil',
    descripcion: `La paradoja del flúor. 🔥 Nada en la química se le resiste — y su secreto es tener el enlace más DÉBIL de todos. Esta vez nos metemos ENTRE los electrones: doce de más, apretados en el mismo pasillo, y las líneas de la fuerza a la vista — cargas iguales que se EMPUJAN sin descanso. El enlace vive aplastado entre dos muros de carga; por eso cualquier chispa lo rompe, y por eso el flúor arde con todo lo que toca. Nada está inventado: física cuántica REAL, resuelta átomo por átomo.`,
    hashtags: ['#quimica', '#fluor', '#fisicacuantica', '#enlacequimico', '#atomos', '#ciencia', '#stem', '#4k'],
  },
  'mol-c2 carbono': {
    codigo: 'moleculas/_code/mol-c2-carbono-capsula.tar.gz',
    titulo: 'El carbono rompe las reglas — un enlace doble sin enlace frontal',
    descripcion: `Este es el átomo que te construye. 💎 Y cuando el carbono se une consigo mismo, hace algo único en la química: NO forma enlace de frente — forma dos anillos puros de carga girando alrededor del eje. Caemos hasta su núcleo (seis protones, seis neutrones), el corazón de cada célula de tu cuerpo. De este enlace nacen las cadenas: el grafito, el diamante, el ADN. Nada está inventado: es la ecuación resuelta. La próxima vez... construimos una cadena.`,
    hashtags: ['#quimica', '#carbono', '#fisicacuantica', '#enlacequimico', '#adn', '#ciencia', '#stem', '#4k'],
  },
};
function copyFor(piece) {
  if (SPECIAL[piece.id]) return SPECIAL[piece.id];
  const f = piece.familia;
  if (f === 'clase') {
    return {
      titulo: piece.titulo,
      descripcion: `${piece.titulo}. La escuela que no tuve de niño, en 4K. Ciencia económica real, explicada para que la entiendas y la uses. 🎓\n\nVe la clase completa en GAIA University.`,
      hashtags: ['#economía', '#nobel', '#educación', '#finanzas', '#gaiaUniversity', '#aprendeentiktok', '#méxico', piece.tema ? '#' + piece.tema : ''],
    };
  }
  if (f === 'atomo') {
    const name = piece.elementName || piece.tema;
    return {
      titulo: `El átomo de ${name}`,
      descripcion: `Así se ve un átomo de ${name} — su espectro real convertido en sonido y luz. Física verdadera, cero adornos. ⚛️`,
      hashtags: ['#química', '#átomo', '#ciencia', '#física', '#tablaperiódica', '#gaia', '#satisfying', '#' + (piece.tema || 'atomo')],
    };
  }
  if (f === 'molecula') return { titulo: `La molécula ${piece.tema}`, descripcion: `${piece.tema}: sus orbitales y modos vibracionales reales en 3D. 🧪`, hashtags: ['#química', '#molécula', '#ciencia', '#3d', '#gaia', '#satisfying'] };
  if (f === 'adn')      return { titulo: `ADN — ${piece.tema}`, descripcion: `Una hebra real de ADN (${piece.tema}) en 4K. La vida, a escala molecular. 🧬`, hashtags: ['#adn', '#biología', '#genética', '#ciencia', '#4k', '#gaia'] };
  if (f === 'astro')    return { titulo: piece.titulo, descripcion: `${piece.titulo} — física relativista real, renderizada en 4K. El universo como nunca lo viste. 🌌`, hashtags: ['#astrofísica', '#espacio', '#universo', '#4k', '#ciencia', '#gaia'] };
  return { titulo: piece.titulo || piece.id, descripcion: '', hashtags: ['#gaia', '#ciencia'] };
}

// ── construir piezas ──
const CLASE_TITULO = {
  'clase-coase': 'Por qué existen las empresas — Coase',
  'clase-romer': 'Cómo crecer sin dinero — Romer',
  'clase-ostrom': 'La tragedia que no fue — Ostrom',
  'clase-krugman': 'Por qué las ciudades existen — Krugman',
  'clase-acemoglu': 'Por qué fracasan las naciones — Acemoglu',
  'clase-reel': 'Romer en 30s — el reel',
};
const ASTRO_TITULO = { 'bh-reels': 'Agujero negro — la joya', 'tde': 'Un agujero negro comiéndose una estrella', 'pulsar': 'Púlsar en su nebulosa', 'showcase': 'Showcase' };

// la biblioteca ya viene LIMPIA (taxonomía): familia = carpeta raíz, tema = subcarpeta.
const ASTRO_SUB = { 'agujero-negro': 'Agujero negro', 'tde': 'Agujero negro comiéndose una estrella', 'pulsar': 'Púlsar', 'quasar': 'Quásar', 'magnetar': 'Magnetar', 'misc': 'Astro' };
const pieces = {};

for (const v of prod.videos) {
  const fam = v.familia;          // economia | atomos | moleculas | adn | astro
  let familia, id, tema, titulo, elementName;

  if (fam === 'economia') {
    familia = 'clase';
    const m = v.serie.match(/clases\/([^/]+)/);
    tema = m ? m[1] : (v.serie.includes('reels') ? 'reel' : 'econ');
    id = 'clase-' + tema; titulo = CLASE_TITULO['clase-' + tema] || tema;
  } else if (fam === 'atomos') {
    familia = 'atomo';
    const m = v.name.match(/(\d{2,3})-([A-Za-z]+)/);
    const z = m ? parseInt(m[1], 10) : 0; tema = m ? m[2] : v.name.replace('.mp4', '');
    id = 'atomo-' + (m ? m[1].padStart(3, '0') : tema); elementName = EL[z] || tema; titulo = `Átomo de ${elementName}`;
  } else if (fam === 'moleculas') {
    familia = 'molecula'; tema = v.name.replace(/^mol-|^chain-|^\d{2}-|\.mp4$/g, '').replace(/-/g, ' '); id = 'mol-' + tema; titulo = tema;
  } else if (fam === 'adn') {
    familia = 'adn'; tema = v.name.replace(/-16x9|\.mp4/g, '').replace('dna-', ''); id = 'adn-' + tema; titulo = tema;
  } else if (fam === 'astro') {
    familia = 'astro';
    const sub = (v.serie.split('/')[1]) || 'misc';
    id = 'astro-' + v.name.replace(/\.mp4$|_master|_vertical|_1080x1920|_2160x3840|_FINAL|_PLAY/g, '');
    tema = sub; titulo = ASTRO_SUB[sub] || sub;
  } else {
    familia = 'otro'; id = 'otro-' + v.name.replace('.mp4', ''); tema = fam; titulo = v.name.replace('.mp4', '');
  }

  pieces[id] ||= { id, familia, tema, titulo, elementName, formatos: {}, _mb: {} };
  const key = v.fmt === '?' ? 'video' : v.fmt;
  if (!pieces[id].formatos[key] || v.mb > (pieces[id]._mb[key] || 0)) { pieces[id].formatos[key] = v.rel; pieces[id]._mb[key] = v.mb; }
}

// adjuntar copy
const out = Object.values(pieces).map(p => {
  const c = copyFor(p);
  return { id: p.id, familia: p.familia, tema: p.tema, titulo: c.titulo, descripcion: c.descripcion, hashtags: c.hashtags.filter(Boolean), formatos: p.formatos, ...(c.codigo ? { codigo: c.codigo } : {}) };
}).sort((a, b) => a.familia.localeCompare(b.familia) || a.titulo.localeCompare(b.titulo));

fs.writeFileSync(path.join(ROOT, 'public/comando/catalogo.json'), JSON.stringify({ pieces: out, generatedAt: process.env.STAMP || '' }));
const porFam = {};
for (const p of out) porFam[p.familia] = (porFam[p.familia] || 0) + 1;
console.log(`✓ catalogo.json — ${out.length} piezas publicables (de ${prod.videos.length} archivos):`);
console.log('  ' + Object.entries(porFam).map(([f, n]) => `${f}:${n}`).join('  '));
