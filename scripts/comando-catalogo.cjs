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

SPECIAL['mol-h2o el anillo'] = {
  codigo: 'moleculas/_code/mol-h2o-el-anillo-capsula.tar.gz',
  titulo: 'TRES gotas de agua hacen un anillo — y juntas jalan 12% más fuerte que en pareja',
  descripcion: `Esto no es una animación: son TRES moléculas de agua resueltas con física cuántica (ab initio), nueve átomos, acercándose de verdad. 💧 Cada punto que parpadea es un electrón —no vive en un lugar fijo, es una nube de probabilidad—. Y esas líneas azules son el campo eléctrico REAL, calculado línea por línea desde el potencial de la molécula: no es una rayita dibujada. Mira lo que pasa cuando se juntan: cada una le presta un hidrógeno a la vecina, nace un puente, y el anillo SE CIERRA. Ahí está lo raro: los tres puentes juntos jalan más fuerte que dos solas — casi doce por ciento más. Eso se llama cooperatividad, y es la razón de que el agua se comporte como se comporta. Y míralo de canto: el anillo NO es plano. Son tres, número impar, no caben todas igual y una queda al revés… y aun torcida aguanta más. Por esto el agua se pega a sí misma, por esto sube por las plantas y por esto el hielo flota. Nada está inventado: la nube de deformación (Δρ) y el campo salen del cálculo.\n\n🎓 GAIA University.`,
  hashtags: ['#agua', '#química', '#cuántica', '#enlacedehidrógeno', '#campoeléctrico', '#ciencia', '#física', '#aprendeentiktok', '#4k', '#satisfying', '#gaia'],
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
  } else if (fam === 'ideas') {
    // serie "La economía son ideas": biblioteca ideas/<tema>/<archivo>.mp4
    familia = 'idea';
    tema = (v.serie.split('/')[1]) || v.name.replace(/\.mp4$/, '');
    id = 'idea-' + tema; titulo = tema;
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
