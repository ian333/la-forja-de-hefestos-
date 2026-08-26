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
  'mol-li2 dilitio': {
    codigo: 'moleculas/_code/mol-li2-dilitio-capsula.tar.gz',
    titulo: '¿Por qué se pegan dos metales? El enlace que por fin puedes VER',
    descripcion: `Dos átomos de litio, el metal más ligero que existe — y los dos quieren REGALAR su electrón. Entonces, ¿por qué se pegan? ⚡⚛️ Por primera vez PUEDES VER el campo eléctrico: las líneas de fuerza de cada átomo conectándose en una sola. Sus núcleos se empujan, pero la nube de electrones del centro los jala MÁS fuerte — y caen al fondo del pozo. Es el enlace metal-metal más débil de la química. Luego bajamos hasta el corazón: tres protones. Eso es el litio. Nada está inventado: física cuántica REAL (PySCF), resuelta electrón por electrón.`,
    hashtags: ['#quimica', '#litio', '#fisicacuantica', '#campoelectrico', '#enlacequimico', '#atomos', '#ciencia', '#stem', '#4k'],
  },
};
// ── serie "La economía son ideas" (cápsulas de 30 s; #1 = la imprenta) ──
// LA FORMACIÓN DE UNA GRASA — primera pieza poliatómica con barrido de la serie.
// La clave la genera comando-scan.cjs del NOMBRE DEL ARCHIVO (mol-grasa-butirico.mp4),
// así que tiene que ser exactamente 'mol-grasa butirico' o la pieza sale con título genérico.
SPECIAL['mol-grasa butirico'] = {
  codigo: 'moleculas/_code/mol-grasa-butirico-capsula.tar.gz',
  titulo: 'Esto huele a mantequilla',
  descripcion: `Es ácido butírico: la molécula que hace que la mantequilla huela a mantequilla. Le da su nombre —butyrum— y su olor. 🧈⚛️ Aquí la ves NACER: catorce átomos sueltos, cada uno con su nube de electrones y su propio campo eléctrico, que se juntan hasta que la carga se cae al espacio de en medio. Eso es un enlace.\n\nNada está dibujado. La densidad es un cálculo cuántico real punto por punto, y el enlace EMERGE de ella: la carga en la región de enlace pasa de 0.000 a 0.870 electrones. Trece enlaces, 943 kcal/mol liberadas. Las líneas azules son el campo eléctrico calculado, 420 de ellas, todas cargando el mismo flujo. Hasta el verde del carbono es física: son sus bandas de Swan, el mismo verde del cono de una flama de gas y de las comas de los cometas.\n\nLo único puesto a mano fue juntarlos: es un barrido, no un mecanismo de reacción. Nadie fabrica una grasa así.\n\nEl olor de la mantequilla es esta forma. 🎓 GAIA University.`,
  hashtags: ['#quimica', '#mantequilla', '#fisicacuantica', '#moleculas', '#enlacequimico', '#ciencia', '#stem', '#4k'],
};

SPECIAL['idea-imprenta'] = {
  codigo: 'ideas/_code/idea-01-imprenta-capsula.tar.gz',
  titulo: 'Copiar un libro costaba MESES — esta idea lo hizo casi gratis',
  descripcion: `Esta hoja está por hacer algo imposible: copiarse a sí misma, sin gastarse nunca. 📜 En 1440, la imprenta tiró el costo de copiar un libro casi a CERO — y el saber se derramó sobre el mundo entero: cartas, mapas, remedios, geometrías. Cambió cómo hablamos, y con eso, la economía entera. La página que ves es un incunable REAL tipografiado (EB Garamond, capitular y todo) y las copias nacen por la ley de duplicación 1→2→4→…→2ⁿ. Nada está inventado.\n\nCápsula #1 de LA ECONOMÍA SON IDEAS: las ideas concretas que revolucionaron la economía, una por una. Porque la economía, en el fondo, son ideas. 🎓 GAIA University.`,
  hashtags: ['#economia', '#historia', '#imprenta', '#gutenberg', '#ideas', '#educacion', '#aprendeentiktok', '#4k', '#gaia'],
};

SPECIAL['idea-brujula'] = {
  codigo: 'ideas/_code/idea-02-brujula-capsula.tar.gz',
  titulo: 'Esta piedra apunta SOLA — y le quitó las orillas al mar',
  descripcion: `En medio del océano, sin costa ni estrellas, estabas perdido — salvo que tuvieras esta piedra que apunta. 🧭 La brújula alineó una aguja imantada con la Tierra y los barcos cruzaron océanos que nadie cruzaba: el comercio dejó de tener orillas. Lo que ves es FÍSICA real: el campo dipolar de la aguja (r = L·sin²θ) dibujado en partículas, el torque que la clava al norte (relajación amortiguada de verdad) y una rosa de los vientos grabada con tipografía real. Nada está inventado.\n\nCápsula #2 de LA ECONOMÍA SON IDEAS. Porque la economía, en el fondo, son ideas. 🎓 GAIA University.`,
  hashtags: ['#economia', '#historia', '#brujula', '#navegacion', '#ideas', '#educacion', '#aprendeentiktok', '#4k', '#gaia'],
};

// ── LA TABLA PERIÓDICA AB INITIO · lote 1 (2026-08-11) ────────────────────────
// Los 118 átomos publicados hasta hoy se dibujaban con orbitales HIDROGENOIDES +
// apantallamiento de Slater. Estos NO: son SCF real (def2-TZVP), con la densidad de
// CADA subcapa muestreada en malla 3D, y las bandas se encienden UNA POR UNA.
// Los cinco se eligieron con un criterio verificable: su configuración calculada
// COINCIDE con el estado base experimental (NIST ASD). Mn, Fe y Gd no coinciden
// —Hartree-Fock ordena mal 3d/4s en capa abierta— y por eso NO están en el lote.

SPECIAL['atomo-006'] = {
  codigo: 'atomos/_code/atomo-c-capsula.tar.gz',
  titulo: 'Todo lo que está vivo está hecho de esto',
  descripcion: `Eso naranja del primer segundo es un ORBITAL de verdad: la mancuerna 2p del carbono, la forma exacta donde vive un electrón — calculada, no dibujada. ⚛️\n\nCarbono. Seis electrones, y los recorres orbital por orbital: las esferas 1s y 2s, y luego las dos mancuernas 2p con su NODO en medio — el hueco donde el electrón nunca está, con el núcleo asomando adentro.\n\nY el detalle que lo es todo: sus orbitales p están A MEDIAS. Ni vacíos ni llenos. Esa asimetría es la que le permite agarrarse de otros CUATRO átomos a la vez — y por eso existen las cadenas, el ADN, y tú.\n\nNada está pintado a mano: SCF real (def2-TZVP), la densidad de cada orbital muestreada en 3D. La configuración calculada, 1s² 2s² 2p², es la del estado base experimental.\n\n🎓 GAIA University.`,
  hashtags: ['#carbono', '#quimica', '#orbitales', '#fisicacuantica', '#atomos', '#ciencia', '#stem', '#4k', '#gaia'],
};

SPECIAL['atomo-010'] = {
  codigo: 'atomos/_code/atomo-ne-capsula.tar.gz',
  titulo: 'El átomo que no reacciona con NADA',
  descripcion: `Neón. Diez electrones, ni uno de sobra. 💡 Y por primera vez lo ves orbital por orbital: la esfera 1s, la 2s, y las TRES mancuernas 2p — una por eje, cada una con su nodo y el núcleo brillando en medio.\n\nLas tres mancuernas juntas cierran la última capa. COMPLETA. Nada que dar, nada que aceptar: por eso el neón no forma compuestos con casi nada.\n\nY fíjate en el final: los otros átomos de esta serie encienden ahí su campo magnético. El neón NO enciende nada — con todo apareado, su momento magnético es CERO. El vacío del final es el dato.\n\nSCF real (def2-TZVP), densidad de cada orbital muestreada en 3D. Configuración 1s² 2s² 2p⁶ — la que mide el experimento.\n\n🎓 GAIA University.`,
  hashtags: ['#neon', '#quimica', '#gasesnobles', '#orbitales', '#fisicacuantica', '#atomos', '#stem', '#4k', '#gaia'],
};

SPECIAL['atomo-014'] = {
  codigo: 'atomos/_code/atomo-si-capsula.tar.gz',
  titulo: 'De esto está hecho cada chip que has usado',
  descripcion: `Silicio. Catorce electrones, y los ves orbital por orbital: los de adentro llenos y quietos, y arriba CUATRO electrones a medias — ni sueltos como en un metal, ni atados como en un aislante. 💻\n\nEsa duda es LITERALMENTE lo que lo hace semiconductor. Ni conduce ni aísla: obedece. Por eso se le puede ordenar con un voltaje, y por eso existe todo lo que tiene pantalla.\n\nLas mancuernas p que ves — con su nodo en medio y el núcleo adentro — no son dibujos: son la densidad de cada orbital calculada (SCF real, def2-TZVP) y muestreada en 3D. La configuración, 1s² 2s² 2p⁶ 3s² 3p², es la del estado base experimental.\n\n🎓 GAIA University.`,
  hashtags: ['#silicio', '#semiconductores', '#chips', '#quimica', '#orbitales', '#fisicacuantica', '#stem', '#4k', '#gaia'],
};

SPECIAL['atomo-024'] = {
  codigo: 'atomos/_code/atomo-cr-capsula.tar.gz',
  titulo: 'Este átomo ROMPE la regla que te enseñaron',
  descripcion: `Eso verde que ves en el primer segundo es un ORBITAL de verdad: la forma exacta donde vive un electrón del cromo, calculada — no dibujada. 🧲\n\nCromo. Veinticuatro electrones, quince orbitales, y los recorres UNO POR UNO: las esferas s, las mancuernas p, y los cuatro pétalos de cada orbital d — las formas del libro de química, saliendo de un cálculo cuántico real (SCF, def2-TZVP).\n\nY la trampa que lo hace famoso: la regla de llenado dice que su última capa lleve DOS electrones. Lleva UNO. Cinco electrones se quedan cada uno SOLO en su orbital d — a medio llenar le salió más barato que obedecer. Seis sin pareja: nadie en su fila tiene más, y por eso es tan magnético (el campo que ves al final).\n\nLo mejor: esa excepción NO se la escribimos nosotros. El cálculo cae solo en 3d⁵ 4s¹, que es exactamente el estado base que mide el experimento (NIST). EMERGE.\n\n🎓 GAIA University.`,
  hashtags: ['#cromo', '#quimica', '#orbitales', '#magnetismo', '#fisicacuantica', '#atomos', '#ciencia', '#stem', '#4k', '#gaia'],
};

SPECIAL['atomo-029'] = {
  codigo: 'atomos/_code/atomo-cu-capsula.tar.gz',
  titulo: 'Por esto la corriente llega hasta tu casa',
  descripcion: `Eso verde del primer segundo es un orbital d del cobre: cuatro pétalos, calculados — no dibujados. ⚡\n\nCobre. Veintinueve electrones, y los recorres orbital por orbital: esferas s, mancuernas p, y los CINCO orbitales d — que aquí se llenan COMPLETOS, diez electrones, ni uno libre.\n\nY arriba queda UNO. Uno solo en el 4s. Ese electrón suelto ES la electricidad: salta de átomo en átomo y no se detiene. Un cable es esto, repetido sin fin.\n\nLa trampa: la regla de llenado decía 3d⁹ 4s². El cálculo cae solo en 3d¹⁰ 4s¹ — la MISMA excepción que mide el experimento (NIST). No está puesta a mano: EMERGE.\n\nSCF real (def2-TZVP), densidad de cada orbital muestreada en 3D. 🎓 GAIA University.`,
  hashtags: ['#cobre', '#electricidad', '#quimica', '#orbitales', '#fisicacuantica', '#atomos', '#stem', '#4k', '#gaia'],
};

SPECIAL['idea-transistor'] = {
  codigo: 'ideas/_code/idea-03-transistor-capsula.tar.gz',
  titulo: 'Hay más de estos en tu bolsillo que estrellas en la galaxia',
  descripcion: `Dentro de este cristal hay un río de electrones, congelado, esperando permiso. ⚡ El transistor es la idea más COPIADA de la historia: un cristal de silicio con impurezas exactas donde un voltaje diminuto abre y cierra un río de electrones — un interruptor sin partes móviles. Un sí o un no, millones de veces por segundo. Y como era una idea, se copió sin gastarse: hoy se fabrican más transistores por año que estrellas tiene la Vía Láctea. Lo que ves es FÍSICA real: la red cristalina cúbica-diamante del silicio, el canal que se abre con la compuerta, la duplicación exponencial. Nada está inventado.\n\nCápsula #3 de LA ECONOMÍA SON IDEAS. Porque la economía, en el fondo, son ideas. 🎓 GAIA University.`,
  hashtags: ['#economia', '#historia', '#transistor', '#silicio', '#electronica', '#ideas', '#educacion', '#aprendeentiktok', '#4k', '#gaia'],
};

SPECIAL['mol-silicio dopado'] = {
  codigo: 'moleculas/_code/mol-silicio-dopado-capsula.tar.gz',
  titulo: 'Cambiamos UN átomo del cristal — y nació la electrónica',
  descripcion: `Esto no es un dibujo: es el interior de un cristal de silicio, calculado átomo por átomo con la ecuación de la química cuántica. 💎 Estás viajando a través de él como un rayo X: esas figuras doradas que nacen y mueren son los ENLACES — carga eléctrica real acumulada entre los átomos. Y entonces cambiamos un solo átomo por uno de fósforo: trae un electrón de más, y esa luz que se enciende es la carga que sobra. El electrón libre, solo, sin pareja, regado por el cristal — ESE es el que conduce. Eso es dopar. Y con eso, exactamente con eso, se hace cada chip que has tocado en tu vida. Todo lo que ves salió del cálculo (PySCF, DFT sobre el cristal periódico): densidad de deformación del enlace, la nube del donor y la densidad de espín. Nada está inventado.\n\n🎓 GAIA University.`,
  hashtags: ['#silicio', '#química', '#cuántica', '#chips', '#transistor', '#ciencia', '#física', '#aprendeentiktok', '#4k', '#gaia'],
};

SPECIAL['mol-nacl robo'] = {
  codigo: 'moleculas/_code/mol-nacl-robo-capsula.tar.gz',
  titulo: 'El cloro le roba el electrón al sodio SIN TOCARLO — así nace cada grano de sal',
  descripcion: `Esto no es una animación: es la ecuación de Schrödinger resuelta para un sodio y un cloro acercándose (48 distancias, ab initio). 🧂 AZUL: los electrones del sodio. ORO: lo que el cloro agarra. El robo no ocurre al tocarse — ocurre ANTES, a distancia: el cloro jala el electrón… y ya no lo devuelve. Quedan dos iones que no pueden soltarse, con un jalón eléctrico gigante: dipolo calculado 9.1 debye, medido en el laboratorio 9.0 (1% de error). Las líneas que ves son el campo eléctrico REAL naciendo entre los dos: todas salen del sodio positivo y entran al cloro negativo. Eso, y nada más, es el enlace iónico. Así está hecha la sal de tu cocina: miles de millones de robos que duran para siempre. Nada está inventado.\n\n🎓 GAIA University.`,
  hashtags: ['#sal', '#química', '#cuántica', '#enlaceiónico', '#ciencia', '#física', '#aprendeentiktok', '#4k', '#satisfying', '#gaia'],
};

SPECIAL['mol-co abrazo'] = {
  codigo: 'moleculas/_code/mol-co-abrazo-capsula.tar.gz',
  titulo: 'El enlace más FUERTE de la naturaleza — y por eso mismo te mata',
  descripcion: `Esto no es una animación: es la ecuación de Schrödinger resuelta para un carbono y un oxígeno acercándose (48 distancias, ab initio, base cc-pVTZ). 🔥 Aquí no se forma UN enlace: se forman TRES al mismo tiempo — uno de frente (σ) y dos anillos cruzados (π) que los abrazan. 1072 kJ/mol: nada en la naturaleza aguanta más. Y esa fuerza es exactamente el problema — tu sangre agarra al monóxido de carbono unas 240 veces más fuerte que al oxígeno: se mete en tu hemoglobina, ocupa el lugar del oxígeno, y ya no lo suelta. Lo más raro de todo: un abrazo brutal por dentro que por fuera casi ni se nota — dipolo medido 0.11 debye, prácticamente balanceado (tan sutil que el cálculo simple hasta se equivoca de lado: una paradoja de libro de texto). Todo lo que ves salió del cálculo: densidad de deformación del enlace y distancia de equilibrio verificada, 1.105 Å calculado contra 1.128 Å medido. Nada está inventado.\n\n🎓 GAIA University.`,
  hashtags: ['#monóxidodecarbono', '#química', '#cuántica', '#ciencia', '#física', '#aprendeentiktok', '#4k', '#satisfying', '#datocurioso', '#gaia'],
};

SPECIAL['mol-hf tirano'] = {
  codigo: 'moleculas/_code/mol-hf-tirano-capsula.tar.gz',
  titulo: 'El elemento más hambriento del universo intentó robar un electrón — y NO PUDO',
  descripcion: `Esto no es una animación: es la ecuación de Schrödinger resuelta para un flúor y un hidrógeno acercándose (48 distancias, ab initio, base cc-pVTZ). ⚡ El flúor tiene la electronegatividad MÁXIMA de toda la tabla periódica (3.98) — jala electrones con más fuerza que cualquier otro átomo. Y aun así, no le arranca el electrón al hidrógeno: lo comparte TORCIDO, desigual, jalado hacia su lado. Compáralo con la sal: ahí el cloro sí se robó el electrón entero (carga +0.98 sobre el sodio); aquí el flúor solo consigue jalar un tercio (+0.35 sobre el hidrógeno). Ese jaloneo que nunca se resuelve tiene nombre: enlace covalente polar, y es lo que mantiene pegada el agua, tu ADN y a ti. El jalón se mide: dipolo calculado 1.94 debye contra 1.83 medido en el laboratorio. Todo salió del cálculo — densidad de deformación del enlace, desplazada hacia el flúor. Nada está inventado.\n\n🎓 GAIA University.`,
  hashtags: ['#flúor', '#química', '#cuántica', '#enlacepolar', '#ciencia', '#física', '#aprendeentiktok', '#4k', '#satisfying', '#gaia'],
};

SPECIAL['mol-no mensajero'] = {
  codigo: 'moleculas/_code/mol-no-mensajero-capsula.tar.gz',
  titulo: 'El veneno del escape de los coches que tu cuerpo fabrica a propósito para no matarte',
  descripcion: `Esto no es una animación: es la ecuación de Schrödinger resuelta para un nitrógeno y un oxígeno acercándose (48 distancias, ab initio, base cc-pVTZ). 💠 El óxido nítrico tiene un número IMPAR de electrones de valencia: once. Los enlaces se arman de dos en dos… así que uno se queda SOLO. Esa nube que late es él — un electrón sin pareja. Eso es un radical. Y por ese electrón suelto el enlace ni siquiera llega a triple: se queda en dos y medio. Lo increíble es para qué sirve: tus arterias lo fabrican para decirle al músculo que se relaje — así se te abre la sangre y te baja la presión (le dieron el Nobel de Medicina en 1998). El mismo gas que ensucia una ciudad es el que tu cuerpo usa para mantenerte vivo. Verificado por su geometría: 1.117 Å calculado contra 1.151 medido, y el estado de espín de un radical real. Nada está inventado.\n\n🎓 GAIA University.`,
  hashtags: ['#óxidonítrico', '#química', '#cuántica', '#radical', '#ciencia', '#física', '#biología', '#aprendeentiktok', '#4k', '#gaia'],
};

SPECIAL['mol-hcl acido'] = {
  codigo: 'moleculas/_code/mol-hcl-acido-capsula.tar.gz',
  titulo: 'Tienes un ácido que disuelve metal — ahorita, en tu estómago (y no te disuelve a ti)',
  descripcion: `Esto no es una animación: es la ecuación de Schrödinger resuelta para un hidrógeno y un cloro acercándose (48 distancias, ab initio, base cc-pVTZ). 🧪 El cloro jala el electrón del hidrógeno hacia su lado — pero suave, sin arrancárselo. No es un robo como el de la sal: es solo un jalón, y es el más leve de la familia. Míralo en números: la sal se lleva casi todo el electrón (0.98), el flúor un tercio (0.35), el cloro apenas un sexto (0.17). Ese jaloneo deja un lado positivo y otro negativo — a eso se le llama enlace polar, y por ser polar disuelve casi todo lo que toca: por eso deshace tu comida. ¿Y por qué no te disuelve a ti? Porque tu estómago se forra de moco nuevo más rápido de lo que el ácido lo gasta. Todo salió del cálculo: densidad de deformación del enlace corrida hacia el cloro, y la distancia de equilibrio verificada — 1.268 Å calculado contra 1.275 Å medido (0.5%). Nada está inventado.\n\n🎓 GAIA University.`,
  hashtags: ['#ácido', '#química', '#cuántica', '#estómago', '#ciencia', '#física', '#biología', '#aprendeentiktok', '#4k', '#gaia'],
};

SPECIAL['mol-h2o agua'] = {
  codigo: 'moleculas/_code/mol-h2o-agua-capsula.tar.gz',
  titulo: 'Un ángulo de 104.5° decide que estés vivo — la molécula de agua como nunca la viste',
  descripcion: `Esto no es una animación: es la ecuación de Schrödinger resuelta para una molécula de agua (base cc-pVTZ, ab initio). 💧 Un oxígeno y dos hidrógenos… que NO quedan en línea recta. Se doblan a ciento cuatro grados y medio. ¿Por qué torcida? Míralo: el oxígeno guarda dos pares de electrones sin compartir —esas dos nubes moradas de atrás, las "orejas"— y empujan a los hidrógenos hacia abajo, abriendo el ángulo. Y por estar doblada, un lado queda negativo y el otro positivo: el agua es POLAR. Por eso disuelve casi todo, por eso se pega a sí misma, por eso el hielo flota. Si este ángulo fuera recto, no habría océanos, ni sangre, ni tú — todo cuelga de 104.5°. Todo lo que ves salió del cálculo: la densidad de deformación del enlace, los pares libres, el ángulo medido (104.478°) y el dipolo verificado (2.03 D calculado contra 1.85 medido). Nada está inventado.\n\n🎓 GAIA University.`,
  hashtags: ['#agua', '#química', '#cuántica', '#ciencia', '#física', '#biología', '#aprendeentiktok', '#4k', '#satisfying', '#gaia'],
};

SPECIAL['mol-h2o agua v2'] = {
  codigo: 'moleculas/_code/mol-h2o-agua-v2-capsula.tar.gz',
  titulo: 'Por qué el agua está DOBLADA — y por qué sin esa forma no existirías',
  descripcion: `Esto es una gota de agua por dentro, calculada átomo por átomo con física cuántica (ab initio, base cc-pVTZ). 💧 Un oxígeno y dos hidrógenos que NO quedan en línea recta. ¿Y por qué su nube de electrones no es pareja, sino que se amontona de un lado? Porque el oxígeno esconde dos nubes de electrones que no comparte con nadie —esas moradas de atrás—: viven de un solo lado y para allá jalan toda la carga. Esas mismas nubes empujan a los hidrógenos y doblan la molécula. Y al doblarse, un lado queda positivo y el otro negativo: el agua se vuelve un imán diminuto. Por eso una gota jala a la otra (el más con el menos) y el agua se pega a sí misma — por eso hay gotas, por eso sube por las plantas, por eso el hielo flota. Si fuera recta, todo se cancelaría: no habría mares, ni sangre, ni tú. Nada está inventado: todo salió del cálculo — la nube de deformación del enlace, los pares libres, el ángulo medido de 104.5° y el dipolo verificado (2.03 D calculado contra 1.85 medido). 🎓 GAIA University.`,
  hashtags: ['#agua', '#química', '#cuántica', '#ciencia', '#física', '#biología', '#aprendeentiktok', '#4k', '#satisfying', '#datocurioso', '#gaia'],
};

SPECIAL['mol-h2o el puente'] = {
  codigo: 'moleculas/_code/mol-h2o-el-puente-capsula.tar.gz',
  titulo: 'El puente invisible que mantiene junta cada gota de agua',
  descripcion: `Esto no es una animación: son DOS moléculas de agua resueltas con física cuántica (ab initio), acercándose de verdad. 💧 Cada uno de esos poquitos puntos que parpadean es un electrón —no vive en un lugar fijo, es una nube de probabilidad—. El oxígeno (ese corazón dorado) es tan tragón que jala los electrones y deja un lado negativo y otro positivo: por eso cada molécula es un imán diminuto. Y cuando dos se acercan, el más de una jala al menos de la otra y nace EL PUENTE: el enlace de hidrógeno, esa nube de carga que se enciende entre las dos. No es una rayita: es densidad de electrones real (Δρ) y el campo eléctrico calculado, línea por línea. Ese puente invisible es por qué el agua se pega a sí misma, por qué sube por las plantas, por qué el hielo flota, por qué existen las gotas… y por qué existes tú. Nada está inventado.\n\n🎓 GAIA University.`,
  hashtags: ['#agua', '#química', '#cuántica', '#enlacedehidrógeno', '#ciencia', '#física', '#biología', '#aprendeentiktok', '#4k', '#gaia'],
};

SPECIAL['mol-h2o el sudor'] = {
  codigo: 'moleculas/_code/mol-h2o-el-sudor-capsula.tar.gz',
  titulo: 'Por qué el sudor te enfría (y por qué tiritas al salir de bañarte)',
  descripcion: `Nunca habías visto POR QUÉ el sudor te enfría. Esto no es una animación: son DOS moléculas de agua resueltas con física cuántica (ab initio), y lo que ves es lo que dicen las ecuaciones. 💧 Cada puntito que parpadea es un electrón —una nube de probabilidad, no una bolita—. El oxígeno (el corazón dorado) es codicioso: jala los electrones y deja un lado negativo y otro positivo, como una pila chiquita. Esas cargas encienden el campo eléctrico REAL (las líneas azules, calculadas línea por línea) y cuando dos aguas se acercan, el campo de una jala los electrones de la otra: nace el puente de hidrógeno, esa nube morada que se enciende entre las dos. Y aquí está el truco: para EVAPORARSE, cada molécula tiene que ROMPER ese puente. Romperlo cuesta energía… y esa energía la roba de tu piel. Por eso el sudor te enfría. Por eso tiritas al secarte. Por eso soplarle a la sopa funciona. Nada está inventado: el calor que se lleva cada gota (unos 10 kcal por mol) es exactamente el de los puentes que rompe.\n\n🎓 GAIA Prime. Aprende a ver lo invisible.`,
  hashtags: ['#agua', '#sudor', '#química', '#cuántica', '#enlacedehidrógeno', '#ciencia', '#física', '#calor', '#aprendeentiktok', '#4k', '#gaia'],
};

SPECIAL['mol-h2o el anillo'] = {
  codigo: 'moleculas/_code/mol-h2o-el-anillo-capsula.tar.gz',
  titulo: 'TRES gotas de agua hacen un anillo — y juntas jalan 12% más fuerte que en pareja',
  descripcion: `Esto no es una animación: son TRES moléculas de agua resueltas con física cuántica (ab initio), nueve átomos, acercándose de verdad. 💧 Cada punto que parpadea es un electrón —no vive en un lugar fijo, es una nube de probabilidad—. Y esas líneas azules son el campo eléctrico REAL, calculado línea por línea desde el potencial de la molécula: no es una rayita dibujada. Mira lo que pasa cuando se juntan: cada una le presta un hidrógeno a la vecina, nace un puente, y el anillo SE CIERRA. Ahí está lo raro: los tres puentes juntos jalan más fuerte que dos solas — casi doce por ciento más. Eso se llama cooperatividad, y es la razón de que el agua se comporte como se comporta. Y míralo de canto: el anillo NO es plano. Son tres, número impar, no caben todas igual y una queda al revés… y aun torcida aguanta más. Por esto el agua se pega a sí misma, por esto sube por las plantas y por esto el hielo flota. Nada está inventado: la nube de deformación (Δρ) y el campo salen del cálculo.\n\n🎓 GAIA University.`,
  hashtags: ['#agua', '#química', '#cuántica', '#enlacedehidrógeno', '#campoeléctrico', '#ciencia', '#física', '#aprendeentiktok', '#4k', '#satisfying', '#gaia'],
};

// EL CUARTETO — la pieza que sigue a "El anillo". El copy abre con el REMATE, igual que el
// video (in medias res): primero "cuatro encajan", después por qué tres no podía.
SPECIAL['mol-h2o el cuarteto'] = {
  codigo: 'moleculas/_code/mol-h2o-el-cuarteto-capsula.tar.gz',
  titulo: 'A TRES gotas de agua no les cuadra el anillo. A cuatro sí — y se agarran 28% más fuerte',
  descripcion: `Cuatro moléculas de agua encajan perfectamente. 💧 Arriba, abajo, arriba, abajo — y de canto el anillo por fin es PLANO. Eso no le pasa a cualquier número, y aquí está por qué. En el video anterior viste tres: tres es impar, así que los hidrógenos libres no pueden alternar sin que dos queden del mismo lado, una agua acaba volteada y el anillo queda torcido. Con cuatro, no. Lo bonito es que nadie lo impuso: el optimizador cuántico tenía la misma libertad en los dos casos, y en el trímero DEFORMÓ el anillo —2.888, 2.880, 2.874 ångströms, los tres puentes distintos— mientras que aquí los dejó idénticos hasta la cuarta cifra. La simetría salió del cálculo, no del dibujo. Y juntos jalan más fuerte que por separado: en tres eso valía casi doce por ciento, aquí sube a casi diecinueve, y cada agua aguanta veintiocho por ciento más que en el trío. Se llama cooperatividad. Doce átomos, ab initio: cada punto que parpadea es un electrón —una nube de probabilidad, no una bolita— y las líneas azules son el campo eléctrico REAL, trazado desde el potencial de la molécula. Por esto el agua actúa como una red y no como gotas sueltas. Y esto apenas va en cuatro. Nada está inventado.\n\n🎓 GAIA University.`,
  hashtags: ['#agua', '#química', '#cuántica', '#enlacedehidrógeno', '#campoeléctrico', '#simetría', '#ciencia', '#física', '#aprendeentiktok', '#4k', '#satisfying', '#gaia'],
};

// EL HEXÁGONO — cierra la serie del agua (2 → 3 → 4 → 6). El copy abre con el LAZO CAUSAL
// ABIERTO (cuenta las puntas / cuenta los lados) y lo cierra hasta el final, que es lo que
// sostiene la retención. ⚠ La afirmación del copo va MEDIDA, no adornada: el hielo Ih sí está
// hecho de anillos hexagonales de agua, pero este hexámero NO es un pedazo de hielo, y el
// párrafo lo dice con las dos diferencias (2 puentes vs 4, plano vs silla). En "El puente",
// cuatro comentaristas corrigieron "son 2 átomos" aunque la voz decía moléculas: el público
// cree lo que VE, así que la afirmación tiene que aguantar a un químico.
SPECIAL['mol-h2o el hexamero'] = {
  codigo: 'moleculas/_code/mol-h2o-el-hexamero-capsula.tar.gz',
  titulo: 'Cuenta las puntas de un copo de nieve: seis. Cuenta los lados de esto: seis. No es casualidad',
  descripcion: `Seis moléculas de agua cerrando un anillo. ❄️ No seis átomos: seis MOLÉCULAS, dieciocho átomos en total, y cada vértice que ves es un oxígeno con sus dos hidrógenos. Cada una le presta un hidrógeno a la vecina y recibe uno de la otra, y así se cierra el circuito: seis puentes. El cálculo cuántico los da IDÉNTICOS —2.821 ångströms los seis— y el anillo sale plano. Nadie se lo impuso: el optimizador tenía la misma libertad que en el trímero, donde DEFORMÓ el anillo y dejó los tres puentes distintos. Y juntos jalan más fuerte que por separado: en tres eso valía casi doce por ciento, en cuatro casi diecinueve, aquí llega al veinticinco. Mientras más aguas, más se aprietan — el puente se acorta de 2.881 a 2.841 a 2.821 ångströms a lo largo de la serie, y las dos tendencias salieron del cálculo, no del guion. Ahora la parte que importa: cuando el agua se congela, repite esta misma forma de seis, millones y millones de veces. Esa simetría de seis es la que llega hasta las puntas del copo. Con una honestidad: esto NO es un pedazo de hielo recortado. En el hielo cada agua tiene CUATRO puentes en vez de dos —por eso es una red en tres dimensiones y esto es un anillo— y el hexágono del hielo va plegado en forma de silla. Lo que se repite es el MOTIVO de seis, y ese sí es el mismo. Dieciocho átomos ab initio: cada punto que parpadea es un electrón —una nube de probabilidad, no una bolita— y las líneas azules son el campo eléctrico REAL, trazado desde el potencial de la molécula. Nada está inventado.\n\n🎓 GAIA University.`,
  hashtags: ['#agua', '#copodenieve', '#química', '#cuántica', '#enlacedehidrógeno', '#hielo', '#simetría', '#ciencia', '#física', '#aprendeentiktok', '#4k', '#satisfying', '#gaia'],
};

SPECIAL['fisica-cargas gauss'] = {
  codigo: 'fisica/_code/cargas-gauss-capsula.tar.gz',
  titulo: 'Puedes CONTAR las líneas del campo eléctrico — y siempre te dan la carga de adentro',
  descripcion: `Seis cargas: tres positivas y tres negativas. Trescientas líneas de campo saliendo de ellas… y ninguna, NINGUNA, se escapa al infinito. ⚡ Eso es la ley de Gauss, y aquí no está dibujada: está CONTADA. Cada línea se traza integrando el campo de verdad, y el programa las cuenta cuadro por cuadro. Empezamos por una sola carga —cien líneas que se van al infinito—, le acercamos su opuesta y las cien mueren en el menos. Sumas las seis: trescientas líneas, cero fugas, porque la carga neta es cero. Lo que sale de una superficie cerrada solo depende de lo que hay ADENTRO; lo de afuera no cuenta, aunque esté ahí. Pero esas son bolitas ideales… ¿y la materia de verdad? Al final entra un átomo de hidrógeno REAL: un protón y su electrón, que no es una bolita sino una nube de probabilidad. El átomo completo es neutro, así que sus líneas no mueren en ningún lado: SE APAGAN. A dos angstroms ya casi no queda campo — la nube se comió el noventa y ocho por ciento. La misma ley que contamos con bolitas, ahora en materia real. Nada está inventado.\n\n🎓 GAIA University.`,
  hashtags: ['#física', '#leydegauss', '#campoeléctrico', '#electromagnetismo', '#hidrógeno', '#cuántica', '#ciencia', '#aprendeentiktok', '#4k', '#satisfying', '#gaia'],
};


// EL COPY VIVE EN EL MANIFIESTO (canon 2026-08-26: título+descripción+hashtags se escriben en
// el paso del GUION, no al final). `videos/<id>.json → publicar.copy` manda; SPECIAL queda
// para las piezas viejas sin manifiesto. Así el copy nace ANTES que el video y Comando lo
// muestra en cuanto la pieza aparece en el catálogo, sin tocar este archivo por pieza.
const MANIFIESTO_COPY = (() => {
  const out = {};
  try {
    const dir = path.join(__dirname, '..', 'videos');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'CRONOGRAMA.json')) {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const c = m.publicar && m.publicar.copy;
        if (m.publicar && m.publicar.pieza && c && c.titulo) {
          out[m.publicar.pieza] = { titulo: c.titulo, descripcion: c.descripcion || '', hashtags: c.hashtags || [],
            ...(m.publicar.capsulaRel ? { codigo: m.publicar.capsulaRel } : {}) };
        }
      } catch {}
    }
  } catch {}
  return out;
})();
function copyFor(piece) {
  if (MANIFIESTO_COPY[piece.id]) return MANIFIESTO_COPY[piece.id];
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
  if (f === 'idea') {
    return {
      titulo: `${piece.tema} — la idea que revolucionó la economía`,
      descripcion: `Serie LA ECONOMÍA SON IDEAS: una idea concreta por cápsula, con su física real como espectáculo. Porque la economía, en el fondo, son ideas. 🎓 GAIA University.`,
      hashtags: ['#economia', '#ideas', '#historia', '#educacion', '#aprendeentiktok', '#4k', '#gaia'],
    };
  }
  if (f === 'molecula') return { titulo: `La molécula ${piece.tema}`, descripcion: `${piece.tema}: sus orbitales y modos vibracionales reales en 3D. 🧪`, hashtags: ['#química', '#molécula', '#ciencia', '#3d', '#gaia', '#satisfying'] };
  if (f === 'adn')      return { titulo: `ADN — ${piece.tema}`, descripcion: `Una hebra real de ADN (${piece.tema}) en 4K. La vida, a escala molecular. 🧬`, hashtags: ['#adn', '#biología', '#genética', '#ciencia', '#4k', '#gaia'] };
  if (f === 'astro')    return { titulo: piece.titulo, descripcion: `${piece.titulo} — física relativista real, renderizada en 4K. El universo como nunca lo viste. 🌌`, hashtags: ['#astrofísica', '#espacio', '#universo', '#4k', '#ciencia', '#gaia'] };
  if (f === 'fisica')   return { titulo: piece.titulo, descripcion: `${piece.titulo} — la ley y la simulación que la comprueba, cuadro por cuadro. Nada inventado. ⚡`, hashtags: ['#física', '#ciencia', '#educación', '#4k', '#aprendeentiktok', '#gaia'] };
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
    const z = m ? parseInt(m[1], 10) : 0;
    id = 'atomo-' + (m ? m[1].padStart(3, '0') : v.name.replace('.mp4', ''));
    elementName = EL[z] || (m ? m[2] : v.name.replace('.mp4', ''));
    // TEMA = SÍMBOLO **Y NOMBRE**. El buscador de Comando sólo mira `titulo + tema`
    // (ComandoCenter: `(p.titulo + ' ' + p.tema).includes(busca)`), y con tema='Cr' escribir
    // "cromo" no encontraba NADA — menos aún cuando el título es un gancho que no nombra al
    // elemento ("Este átomo ROMPE la regla que te enseñaron"). Le pasó a Ian el 2026-08-12
    // con una pieza que sí estaba publicada. Vale para los 118.
    tema = m ? `${m[2]} · ${elementName}` : elementName;
    titulo = `Átomo de ${elementName}`;
  } else if (fam === 'moleculas') {
    familia = 'molecula'; tema = v.name.replace(/^mol-|^chain-|^\d{2}-|\.mp4$/g, '').replace(/-/g, ' '); id = 'mol-' + tema; titulo = tema;
  } else if (fam === 'adn') {
    familia = 'adn'; tema = v.name.replace(/-16x9|\.mp4/g, '').replace('dna-', ''); id = 'adn-' + tema; titulo = tema;
  } else if (fam === 'astro') {
    familia = 'astro';
    const sub = (v.serie.split('/')[1]) || 'misc';
    id = 'astro-' + v.name.replace(/\.mp4$|_master|_vertical|_1080x1920|_2160x3840|_FINAL|_PLAY/g, '');
    tema = sub; titulo = ASTRO_SUB[sub] || sub;
  } else if (fam === 'fisica') {
    // FÍSICA: leyes con la simulación como prueba (Gauss = contar las líneas). biblioteca fisica/<archivo>.mp4
    familia = 'fisica'; tema = v.name.replace(/\.mp4$/, '').replace(/-/g, ' '); id = 'fisica-' + tema; titulo = tema;
  } else if (fam === 'ideas') {
    // serie "La economía son ideas": biblioteca ideas/<tema>/<archivo>.mp4
    familia = 'idea';
    tema = (v.serie.split('/')[1]) || v.name.replace(/\.mp4$/, '');
    id = 'idea-' + tema; titulo = tema;
  } else {
    familia = 'otro'; id = 'otro-' + v.name.replace('.mp4', ''); tema = fam; titulo = v.name.replace('.mp4', '');
  }

  pieces[id] ||= { id, familia, tema, titulo, elementName, formatos: {}, _mb: {}, ts: 0 };
  const key = v.fmt === '?' ? 'video' : v.fmt;
  if (!pieces[id].formatos[key] || v.mb > (pieces[id]._mb[key] || 0)) { pieces[id].formatos[key] = v.rel; pieces[id]._mb[key] = v.mb; }
  // La pieza es tan reciente como su archivo MÁS nuevo: re-publicar una versión la sube al
  // tope, que es lo que se quiere (el cromo de orbitales REEMPLAZÓ al hidrogenoide de mayo).
  if ((v.ts || 0) > pieces[id].ts) pieces[id].ts = v.ts || 0;
}

// adjuntar copy
const out = Object.values(pieces).map(p => {
  const c = copyFor(p);
  return { id: p.id, familia: p.familia, tema: p.tema, titulo: c.titulo, descripcion: c.descripcion, hashtags: c.hashtags.filter(Boolean), formatos: p.formatos, ts: p.ts || 0, ...(c.codigo ? { codigo: c.codigo } : {}) };
}).sort((a, b) => a.familia.localeCompare(b.familia) || a.titulo.localeCompare(b.titulo));

fs.writeFileSync(path.join(ROOT, 'public/comando/catalogo.json'), JSON.stringify({ pieces: out, generatedAt: process.env.STAMP || '' }));
const porFam = {};
for (const p of out) porFam[p.familia] = (porFam[p.familia] || 0) + 1;
console.log(`✓ catalogo.json — ${out.length} piezas publicables (de ${prod.videos.length} archivos):`);
console.log('  ' + Object.entries(porFam).map(([f, n]) => `${f}:${n}`).join('  '));
