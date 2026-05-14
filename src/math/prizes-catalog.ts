/**
 * Catálogo de los grandes premios matemáticos:
 *   - Medalla Fields (1936-2022, cada 4 años, menores de 40)
 *   - Premio Abel (2003-2024, anual)
 *
 * No hay Nobel de Matemáticas. La Medalla Fields y el Premio Abel son
 * los equivalentes — la Fields es la "joven" (es elegida cada 4 años,
 * solo para menores de 40, en el Congreso Internacional de Matemáticos),
 * y el Abel es la "trayectoria" (anual, sin tope de edad, otorgado por
 * la Academia Noruega).
 *
 * `status: 'live'` significa que la masterclass ya está producida y enlaza
 * a `/masterclass.html?id=<classId>`. `status: 'pending'` aparece como card
 * en gris en el portal.
 */

export type MathPrizeStatus = 'live' | 'pending';
export type MathPrizeKind = 'fields' | 'abel';

export interface MathLaureate {
  /** Slug. Usado como id de masterclass cuando esté live. */
  id: string;
  /** Año del premio. */
  year: number;
  /** Premio: Fields o Abel. */
  prize: MathPrizeKind;
  /** Lista de premiados. */
  laureates: string[];
  /** Bloque temático. */
  block: MathBlock;
  /** Título corto de la lección. */
  title: string;
  /** Cita oficial del comité (parafraseada al español). */
  subtitle: string;
  /** Por qué importa entender esto. */
  impact: string;
  /** Estado de producción. */
  status: MathPrizeStatus;
  /** Si status === 'live', el classId del masterclass. */
  classId?: string;
}

export type MathBlock =
  | 'algebra-numeros'
  | 'geometria-algebraica'
  | 'topologia-geometria'
  | 'analisis-pde'
  | 'probabilidad-dinamica'
  | 'combinatoria'
  | 'grupos-representaciones'
  | 'logica-fundamentos'
  | 'fisica-matematica'
  | 'aplicada-computacion';

export interface MathBlockMeta {
  id: MathBlock;
  name: string;
  description: string;
  color: string;
  colorBg: string;
  colorEmissive: string;
  order: number;
}

export const MATH_BLOCKS: MathBlockMeta[] = [
  {
    id: 'algebra-numeros',
    name: 'Álgebra y teoría de números',
    description: 'Primos, factorizaciones, conjeturas milenarias. De Fermat a Andrew Wiles.',
    color: '#FDB813',
    colorBg: '#2A1A03',
    colorEmissive: '#B45309',
    order: 1,
  },
  {
    id: 'geometria-algebraica',
    name: 'Geometría algebraica',
    description: 'La síntesis de álgebra y geometría. Grothendieck, esquemas, motivos.',
    color: '#A78BFA',
    colorBg: '#1E1338',
    colorEmissive: '#6D28D9',
    order: 2,
  },
  {
    id: 'topologia-geometria',
    name: 'Topología y geometría',
    description: 'La forma de los espacios. Variedades, fibrados, invariantes topológicos.',
    color: '#F472B6',
    colorBg: '#2A0E22',
    colorEmissive: '#BE185D',
    order: 3,
  },
  {
    id: 'analisis-pde',
    name: 'Análisis y EDPs',
    description: 'Funciones, integrales, ecuaciones diferenciales parciales. El motor de la física matemática.',
    color: '#60A5FA',
    colorBg: '#0B2138',
    colorEmissive: '#1E40AF',
    order: 4,
  },
  {
    id: 'probabilidad-dinamica',
    name: 'Probabilidad y sistemas dinámicos',
    description: 'Caminatas aleatorias, ergodicidad, caos, percolación.',
    color: '#22D3EE',
    colorBg: '#082831',
    colorEmissive: '#0E7490',
    order: 5,
  },
  {
    id: 'combinatoria',
    name: 'Combinatoria y grafos',
    description: 'Estructuras discretas, teoría aditiva, conteo, optimización extremal.',
    color: '#34D399',
    colorBg: '#062E20',
    colorEmissive: '#047857',
    order: 6,
  },
  {
    id: 'grupos-representaciones',
    name: 'Grupos y representaciones',
    description: 'Simetrías abstractas. Teoría de Lie, grupos finitos, programa de Langlands.',
    color: '#FB923C',
    colorBg: '#2A1407',
    colorEmissive: '#C2410C',
    order: 7,
  },
  {
    id: 'logica-fundamentos',
    name: 'Lógica y fundamentos',
    description: 'Conjuntos, modelos, computabilidad. Las raíces de las matemáticas mismas.',
    color: '#94A3B8',
    colorBg: '#1A2030',
    colorEmissive: '#475569',
    order: 8,
  },
  {
    id: 'fisica-matematica',
    name: 'Física matemática',
    description: 'Cuerdas, gauge theory, mecánica estadística. Donde la física devuelve teoremas.',
    color: '#D946EF',
    colorBg: '#2A0F30',
    colorEmissive: '#A21CAF',
    order: 9,
  },
  {
    id: 'aplicada-computacion',
    name: 'Aplicada y computación',
    description: 'Optimización, criptografía, complejidad, algoritmos exactos.',
    color: '#E2E8F0',
    colorBg: '#1A1F2A',
    colorEmissive: '#64748B',
    order: 10,
  },
];

/**
 * El catálogo. Verificado contra mathunion.org (Fields) y abelprize.no (Abel).
 * Las frases de "impact" son redacción nuestra, pensadas para el alumno
 * latinoamericano. La fila de "subtitle" parafrasea la cita oficial.
 */
export const MATH_CATALOG: MathLaureate[] = [
  // ═══════════════════════ MEDALLA FIELDS ═══════════════════════

  // 1936 — primera edición
  {
    id: 'fields-1936-ahlfors',
    year: 1936,
    prize: 'fields',
    laureates: ['Lars Ahlfors'],
    block: 'analisis-pde',
    title: 'La primera Medalla Fields',
    subtitle: 'Por trabajos en análisis complejo, especialmente recubrimientos de superficies de Riemann.',
    impact: 'Una de las dos primeras medallas, junto con Douglas. Finlandés, refugiado en Harvard durante la Segunda Guerra. Fundador del análisis geométrico complejo.',
    status: 'pending',
  },
  {
    id: 'fields-1936-douglas',
    year: 1936,
    prize: 'fields',
    laureates: ['Jesse Douglas'],
    block: 'analisis-pde',
    title: 'El problema de Plateau resuelto',
    subtitle: 'Por su solución del problema de Plateau: encontrar superficies mínimas con frontera dada.',
    impact: 'El problema de las películas de jabón. Dado un alambre cualquiera, ¿qué superficie de área mínima lo cubre? Douglas lo resolvió para cualquier curva.',
    status: 'pending',
  },

  // 1950
  {
    id: 'fields-1950-schwartz',
    year: 1950,
    prize: 'fields',
    laureates: ['Laurent Schwartz'],
    block: 'analisis-pde',
    title: 'La teoría de distribuciones',
    subtitle: 'Por desarrollar la teoría de distribuciones, una generalización del cálculo a funciones discontinuas.',
    impact: 'Inventó el marco matemático que da sentido a la delta de Dirac, que los físicos usaban "ilegalmente". Hoy es base de toda EDP moderna.',
    status: 'pending',
  },
  {
    id: 'fields-1950-selberg',
    year: 1950,
    prize: 'fields',
    laureates: ['Atle Selberg'],
    block: 'algebra-numeros',
    title: 'Demostración elemental del teorema de los primos',
    subtitle: 'Por su trabajo sobre la distribución de los números primos, en particular su demostración elemental del teorema de los números primos.',
    impact: 'Demostró sin análisis complejo lo que Hadamard y de la Vallée Poussin habían demostrado con él. Junto con Erdős — historia legendaria.',
    status: 'pending',
  },

  // 1954
  {
    id: 'fields-1954-kodaira',
    year: 1954,
    prize: 'fields',
    laureates: ['Kunihiko Kodaira'],
    block: 'geometria-algebraica',
    title: 'Variedades complejas y teoría de Hodge',
    subtitle: 'Por contribuciones a la teoría de variedades algebraicas y complejas, incluyendo la teoría de armónicos.',
    impact: 'Primer Fields japonés. Su teorema de inmersión y su clasificación de superficies son pilares de la geometría algebraica.',
    status: 'pending',
  },
  {
    id: 'fields-1954-serre',
    year: 1954,
    prize: 'fields',
    laureates: ['Jean-Pierre Serre'],
    block: 'geometria-algebraica',
    title: 'Cohomología, fibrados y el Fields más joven',
    subtitle: 'Por su trabajo en topología algebraica y geometría algebraica.',
    impact: 'Ganó a los 27 — sigue siendo el Fields más joven de la historia. Ganó después Abel (2003) y Wolf. El matemático vivo más influyente.',
    status: 'pending',
  },

  // 1958
  {
    id: 'fields-1958-roth',
    year: 1958,
    prize: 'fields',
    laureates: ['Klaus Roth'],
    block: 'algebra-numeros',
    title: 'Aproximación de números algebraicos',
    subtitle: 'Por demostrar que los números algebraicos no se pueden aproximar por racionales demasiado bien (teorema de Thue-Siegel-Roth).',
    impact: 'Cerró un problema de 50 años. La irracionalidad cuantitativa es delicadísima — y Roth lo resolvió de un golpe.',
    status: 'pending',
  },
  {
    id: 'fields-1958-thom',
    year: 1958,
    prize: 'fields',
    laureates: ['René Thom'],
    block: 'topologia-geometria',
    title: 'Cobordismos y teoría de catástrofes',
    subtitle: 'Por su trabajo en cobordismos, que reorganizó la topología algebraica.',
    impact: 'Después popularizó la "teoría de catástrofes" — clasificación de discontinuidades. Filósofo de la matemática además.',
    status: 'pending',
  },

  // 1962
  {
    id: 'fields-1962-hormander',
    year: 1962,
    prize: 'fields',
    laureates: ['Lars Hörmander'],
    block: 'analisis-pde',
    title: 'Operadores diferenciales parciales lineales',
    subtitle: 'Por su trabajo sobre operadores diferenciales parciales, especialmente la teoría de existencia y unicidad.',
    impact: 'Su tratado de 4 tomos sobre EDPs lineales es la biblia. Inventó los operadores integrales de Fourier.',
    status: 'pending',
  },
  {
    id: 'fields-1962-milnor',
    year: 1962,
    prize: 'fields',
    laureates: ['John Milnor'],
    block: 'topologia-geometria',
    title: 'Esferas exóticas en 7 dimensiones',
    subtitle: 'Por demostrar la existencia de variedades diferenciables homeomorfas pero no difeomorfas a la 7-esfera estándar.',
    impact: 'Demostró que hay 28 maneras "diferentes" de ponerle cálculo a la esfera de 7 dimensiones. La topología diferencial nació aquí. Después Abel 2011.',
    status: 'pending',
  },

  // 1966
  {
    id: 'fields-1966-atiyah',
    year: 1966,
    prize: 'fields',
    laureates: ['Michael Atiyah'],
    block: 'topologia-geometria',
    title: 'El teorema del índice Atiyah-Singer',
    subtitle: 'Por su trabajo en K-teoría, conjuntamente con la prueba del teorema del índice con Singer.',
    impact: 'Conecta análisis (operadores), topología (índice) y geometría. Fue puente entre matemáticas y física teórica. Abel 2004.',
    status: 'pending',
  },
  {
    id: 'fields-1966-cohen',
    year: 1966,
    prize: 'fields',
    laureates: ['Paul Cohen'],
    block: 'logica-fundamentos',
    title: 'La hipótesis del continuo es independiente',
    subtitle: 'Por demostrar la independencia del axioma de elección y de la hipótesis del continuo de la teoría de conjuntos ZF.',
    impact: 'Inventó el "forcing". Demostró que algunas preguntas matemáticas no tienen respuesta — ni sí ni no. Gödel se quitó el sombrero.',
    status: 'pending',
  },
  {
    id: 'fields-1966-grothendieck',
    year: 1966,
    prize: 'fields',
    laureates: ['Alexander Grothendieck'],
    block: 'geometria-algebraica',
    title: 'Esquemas: la refundación de la geometría algebraica',
    subtitle: 'Por construir nuevos métodos en geometría algebraica.',
    impact: 'Reescribió la geometría algebraica desde los cimientos. Los 10.000 páginas de EGA + SGA. Se retiró al campo en los 90, anti-establishment.',
    status: 'pending',
  },
  {
    id: 'fields-1966-smale',
    year: 1966,
    prize: 'fields',
    laureates: ['Stephen Smale'],
    block: 'topologia-geometria',
    title: 'La conjetura de Poincaré en dimensiones altas',
    subtitle: 'Por demostrar la conjetura de Poincaré en dimensiones mayores o iguales a 5.',
    impact: 'Esferas son esferas — pero solo cuando son altas. La dimensión 4 esperó a Freedman, la 3 a Perelman. También activista anti-Vietnam.',
    status: 'pending',
  },

  // 1970
  {
    id: 'fields-1970-baker',
    year: 1970,
    prize: 'fields',
    laureates: ['Alan Baker'],
    block: 'algebra-numeros',
    title: 'Formas lineales en logaritmos',
    subtitle: 'Por su trabajo sobre la trascendencia de combinaciones lineales de logaritmos de números algebraicos.',
    impact: 'Generalizó el séptimo problema de Hilbert. Aplicado a ecuaciones diofantinas — encontrar todas las soluciones enteras.',
    status: 'pending',
  },
  {
    id: 'fields-1970-hironaka',
    year: 1970,
    prize: 'fields',
    laureates: ['Heisuke Hironaka'],
    block: 'geometria-algebraica',
    title: 'Resolución de singularidades',
    subtitle: 'Por demostrar la resolución de singularidades en cualquier dimensión en característica cero.',
    impact: 'Cualquier variedad algebraica complicada se puede "suavizar" con una sucesión finita de transformaciones. Trabajo épico de 200 páginas.',
    status: 'pending',
  },
  {
    id: 'fields-1970-novikov',
    year: 1970,
    prize: 'fields',
    laureates: ['Sergei Novikov'],
    block: 'topologia-geometria',
    title: 'Cobordismos y teorema de finitud',
    subtitle: 'Por su trabajo en topología diferencial y algebraica.',
    impact: 'Soviético no autorizado a recoger el premio. Después rompió con la URSS por presión del KGB sobre sus colegas. Físico-matemático genial.',
    status: 'pending',
  },
  {
    id: 'fields-1970-thompson',
    year: 1970,
    prize: 'fields',
    laureates: ['John Thompson'],
    block: 'grupos-representaciones',
    title: 'Grupos finitos simples no abelianos',
    subtitle: 'Por su trabajo en la clasificación de grupos finitos simples.',
    impact: 'Junto con Walter Feit demostró el teorema de orden impar — todo grupo finito simple no-abeliano tiene orden par. Abel 2008.',
    status: 'pending',
  },

  // 1974
  {
    id: 'fields-1974-bombieri',
    year: 1974,
    prize: 'fields',
    laureates: ['Enrico Bombieri'],
    block: 'algebra-numeros',
    title: 'La criba grande y números primos',
    subtitle: 'Por trabajo en distribución de números primos y aproximación diofantina.',
    impact: 'El teorema de Bombieri-Vinogradov sobre primos en progresiones aritméticas — base de Yitang Zhang y la brecha primaria acotada.',
    status: 'pending',
  },
  {
    id: 'fields-1974-mumford',
    year: 1974,
    prize: 'fields',
    laureates: ['David Mumford'],
    block: 'geometria-algebraica',
    title: 'Espacios de moduli de variedades algebraicas',
    subtitle: 'Por contribuciones a la geometría algebraica, especialmente teoría de invariantes y moduli.',
    impact: 'GIT — Geometric Invariant Theory — para clasificar variedades. Después se fue a visión computacional aplicada. Matemático Renacentista.',
    status: 'pending',
  },

  // 1978
  {
    id: 'fields-1978-deligne',
    year: 1978,
    prize: 'fields',
    laureates: ['Pierre Deligne'],
    block: 'geometria-algebraica',
    title: 'Las conjeturas de Weil resueltas',
    subtitle: 'Por demostrar las tres conjeturas de Weil sobre funciones zeta de variedades sobre cuerpos finitos.',
    impact: 'Las conjeturas de Weil habían motivado todo el programa Grothendieck. Deligne las cerró a los 29 años. Abel 2013.',
    status: 'pending',
  },
  {
    id: 'fields-1978-fefferman',
    year: 1978,
    prize: 'fields',
    laureates: ['Charles Fefferman'],
    block: 'analisis-pde',
    title: 'Análisis armónico y dualidad H¹-BMO',
    subtitle: 'Por contribuciones al análisis armónico.',
    impact: 'A los 22 años era profesor titular en Chicago — el más joven en EE.UU. Hoy trabaja en plegamiento de proteínas con su tía.',
    status: 'pending',
  },
  {
    id: 'fields-1978-margulis',
    year: 1978,
    prize: 'fields',
    laureates: ['Grigory Margulis'],
    block: 'grupos-representaciones',
    title: 'Rigidez de retículos y dinámica en espacios homogéneos',
    subtitle: 'Por trabajo en teoría de retículos en grupos de Lie semisimples.',
    impact: 'Soviet no autorizado a viajar a Helsinki a recoger su Fields. Después Abel 2020 — uno de los dobles Fields-Abel.',
    status: 'pending',
  },
  {
    id: 'fields-1978-quillen',
    year: 1978,
    prize: 'fields',
    laureates: ['Daniel Quillen'],
    block: 'topologia-geometria',
    title: 'K-teoría algebraica superior',
    subtitle: 'Por trabajo fundamental en K-teoría algebraica.',
    impact: 'Definió la K-teoría algebraica como functor — abriendo la puerta a relacionarla con cohomología motivica. Trabajo notoriamente difícil.',
    status: 'pending',
  },

  // 1982
  {
    id: 'fields-1982-connes',
    year: 1982,
    prize: 'fields',
    laureates: ['Alain Connes'],
    block: 'fisica-matematica',
    title: 'Geometría no conmutativa',
    subtitle: 'Por contribuciones a la teoría de álgebras de operadores y la clasificación de factores tipo III.',
    impact: 'Inventó la geometría no conmutativa — donde xy ≠ yx pero sigue habiendo "espacio". Aplicado a modelo estándar y cuántica.',
    status: 'pending',
  },
  {
    id: 'fields-1982-thurston',
    year: 1982,
    prize: 'fields',
    laureates: ['William Thurston'],
    block: 'topologia-geometria',
    title: 'La conjetura de geometrización',
    subtitle: 'Por su trabajo en variedades de dimensión 3 y la conjetura de geometrización.',
    impact: 'Conjeturó que toda 3-variedad se descompone en 8 geometrías canónicas. Demostrarlo dio el Fields a Perelman 24 años después.',
    status: 'pending',
  },
  {
    id: 'fields-1982-yau',
    year: 1982,
    prize: 'fields',
    laureates: ['Shing-Tung Yau'],
    block: 'analisis-pde',
    title: 'La conjetura de Calabi',
    subtitle: 'Por trabajo en EDPs, geometría diferencial y la conjetura de Calabi.',
    impact: 'Las variedades de Calabi-Yau son la base de la teoría de cuerdas. Su tesis cambió la geometría compleja y la física teórica.',
    status: 'pending',
  },

  // 1986
  {
    id: 'fields-1986-donaldson',
    year: 1986,
    prize: 'fields',
    laureates: ['Simon Donaldson'],
    block: 'topologia-geometria',
    title: 'Estructuras exóticas en dimensión 4',
    subtitle: 'Por trabajo en topología de 4-variedades usando ecuaciones de la teoría gauge.',
    impact: 'Demostró que ℝ⁴ tiene infinitas estructuras diferenciables distintas — único entre todos los ℝⁿ. Usó instantones de la física.',
    status: 'pending',
  },
  {
    id: 'fields-1986-faltings',
    year: 1986,
    prize: 'fields',
    laureates: ['Gerd Faltings'],
    block: 'algebra-numeros',
    title: 'La conjetura de Mordell demostrada',
    subtitle: 'Por demostrar la conjetura de Mordell: curvas algebraicas de género ≥ 2 sobre los racionales tienen sólo un número finito de puntos racionales.',
    impact: 'Implicó casos del Último Teorema de Fermat antes de Wiles. Conexión profunda entre álgebra y geometría aritmética.',
    status: 'pending',
  },
  {
    id: 'fields-1986-freedman',
    year: 1986,
    prize: 'fields',
    laureates: ['Michael Freedman'],
    block: 'topologia-geometria',
    title: 'Poincaré en dimensión 4',
    subtitle: 'Por demostrar la conjetura de Poincaré topológica en dimensión 4.',
    impact: 'Cerró el caso 4 topológico — Smale ya tenía dim≥5, Perelman cerraría dim 3. Después se fue a Microsoft a investigar cómputo cuántico.',
    status: 'pending',
  },

  // 1990
  {
    id: 'fields-1990-drinfeld',
    year: 1990,
    prize: 'fields',
    laureates: ['Vladimir Drinfeld'],
    block: 'grupos-representaciones',
    title: 'Grupos cuánticos y módulos de Drinfeld',
    subtitle: 'Por trabajo en geometría algebraica, teoría de números y física matemática.',
    impact: 'Inventó los grupos cuánticos — simetrías "deformadas" con un parámetro h. Centrales en la teoría matemática de la integrabilidad.',
    status: 'pending',
  },
  {
    id: 'fields-1990-jones',
    year: 1990,
    prize: 'fields',
    laureates: ['Vaughan Jones'],
    block: 'topologia-geometria',
    title: 'El polinomio de Jones de los nudos',
    subtitle: 'Por descubrir un nuevo invariante de nudos en álgebras de von Neumann.',
    impact: 'Distinguió por primera vez nudos quirales — espejos no equivalentes. Inesperado: salió de álgebras de operadores, no de topología.',
    status: 'pending',
  },
  {
    id: 'fields-1990-mori',
    year: 1990,
    prize: 'fields',
    laureates: ['Shigefumi Mori'],
    block: 'geometria-algebraica',
    title: 'El programa de modelos mínimos',
    subtitle: 'Por trabajo en geometría birracional de 3-variedades algebraicas.',
    impact: 'Extendió la clasificación de superficies de Enriques-Kodaira a dim 3. Las "extracciones" y "flips" de Mori son hoy estándar.',
    status: 'pending',
  },
  {
    id: 'fields-1990-witten',
    year: 1990,
    prize: 'fields',
    laureates: ['Edward Witten'],
    block: 'fisica-matematica',
    title: 'Un físico ganando Fields',
    subtitle: 'Por contribuciones que conectan teoría cuántica de campos con geometría diferencial.',
    impact: 'Único físico con Medalla Fields. Demostró que la física teórica produce teoremas matemáticos profundos. Cuerdas, branas, dualidades.',
    status: 'pending',
  },

  // 1994
  {
    id: 'fields-1994-bourgain',
    year: 1994,
    prize: 'fields',
    laureates: ['Jean Bourgain'],
    block: 'analisis-pde',
    title: 'Análisis armónico y ergódico',
    subtitle: 'Por contribuciones notables al análisis y la teoría ergódica.',
    impact: 'El analista más prolífico de su generación — cientos de papers en docenas de áreas. Resolvió problemas de teoría aditiva, EDPs dispersivas, geometría convexa.',
    status: 'pending',
  },
  {
    id: 'fields-1994-lions',
    year: 1994,
    prize: 'fields',
    laureates: ['Pierre-Louis Lions'],
    block: 'analisis-pde',
    title: 'Soluciones de viscosidad de EDPs no lineales',
    subtitle: 'Por trabajo en ecuaciones diferenciales parciales no lineales.',
    impact: 'Inventó las "soluciones de viscosidad" — un concepto débil que permitió tratar Hamilton-Jacobi y ecuaciones de control. Hijo de un Fields (Lions Sr).',
    status: 'pending',
  },
  {
    id: 'fields-1994-yoccoz',
    year: 1994,
    prize: 'fields',
    laureates: ['Jean-Christophe Yoccoz'],
    block: 'probabilidad-dinamica',
    title: 'Sistemas dinámicos en dimensión baja',
    subtitle: 'Por trabajo en sistemas dinámicos, particularmente las "rompecabezas de Yoccoz" sobre el conjunto de Mandelbrot.',
    impact: 'Sus "puzzles" cuadricularon el plano de Mandelbrot y permitieron demostrar local-conectividad en muchos puntos. Murió joven en 2016.',
    status: 'pending',
  },
  {
    id: 'fields-1994-zelmanov',
    year: 1994,
    prize: 'fields',
    laureates: ['Efim Zelmanov'],
    block: 'grupos-representaciones',
    title: 'El problema restringido de Burnside resuelto',
    subtitle: 'Por la solución del problema restringido de Burnside.',
    impact: 'Cualquier grupo periódico finitamente generado con exponente acotado es finito. Llevaba 90 años abierto.',
    status: 'pending',
  },

  // 1998
  {
    id: 'fields-1998-borcherds',
    year: 1998,
    prize: 'fields',
    laureates: ['Richard Borcherds'],
    block: 'fisica-matematica',
    title: 'Monstrous moonshine',
    subtitle: 'Por demostrar la conjetura de monstrous moonshine que relaciona el grupo monstruo con formas modulares.',
    impact: 'Conectó el grupo simple más grande (8 × 10⁵³ elementos) con teoría de cuerdas y formas modulares. El "monstrous moonshine" — destellos del monstruo.',
    status: 'pending',
  },
  {
    id: 'fields-1998-gowers',
    year: 1998,
    prize: 'fields',
    laureates: ['Timothy Gowers'],
    block: 'combinatoria',
    title: 'Análisis de Fourier en combinatoria',
    subtitle: 'Por trabajo en análisis funcional y combinatoria, particularmente en una prueba alternativa del teorema de Szemerédi.',
    impact: 'Su prueba combinatoria del teorema de Szemerédi sobre progresiones aritméticas inauguró el análisis aditivo moderno. Blogger prolífico de matemática.',
    status: 'pending',
  },
  {
    id: 'fields-1998-kontsevich',
    year: 1998,
    prize: 'fields',
    laureates: ['Maxim Kontsevich'],
    block: 'fisica-matematica',
    title: 'Cuantización por deformación e invariantes de Witten',
    subtitle: 'Por trabajo en geometría algebraica, topología y física matemática.',
    impact: 'Demostró la conjetura de Witten sobre números de intersección en espacios de moduli. Una de las mentes geometrico-físicas más profundas vivas.',
    status: 'pending',
  },
  {
    id: 'fields-1998-mcmullen',
    year: 1998,
    prize: 'fields',
    laureates: ['Curtis McMullen'],
    block: 'probabilidad-dinamica',
    title: 'Renormalización en sistemas dinámicos complejos',
    subtitle: 'Por trabajo en dinámica compleja, geometría hiperbólica y teoría de iteración.',
    impact: 'Demostró rigidez en familias polinomiales — el conjunto de Mandelbrot es localmente conexo en muchos puntos. Geómetra-dinamicista.',
    status: 'pending',
  },

  // 2002
  {
    id: 'fields-2002-lafforgue',
    year: 2002,
    prize: 'fields',
    laureates: ['Laurent Lafforgue'],
    block: 'grupos-representaciones',
    title: 'Langlands para cuerpos de funciones',
    subtitle: 'Por demostrar la correspondencia de Langlands para GL_n sobre cuerpos de funciones.',
    impact: 'Programa de Langlands: el "Gran Plan Unificado" de la matemática. Lafforgue cerró el caso GL_n para cuerpos de funciones — paso enorme.',
    status: 'pending',
  },
  {
    id: 'fields-2002-voevodsky',
    year: 2002,
    prize: 'fields',
    laureates: ['Vladimir Voevodsky'],
    block: 'geometria-algebraica',
    title: 'Cohomología motívica',
    subtitle: 'Por desarrollar nuevas teorías de cohomología para variedades algebraicas.',
    impact: 'Construyó los "motivos" que Grothendieck había soñado. Después se fue a fundamentos univalentes — pruebas formales por ordenador.',
    status: 'pending',
  },

  // 2006
  {
    id: 'fields-2006-okounkov',
    year: 2006,
    prize: 'fields',
    laureates: ['Andrei Okounkov'],
    block: 'probabilidad-dinamica',
    title: 'Probabilidad, geometría algebraica y representaciones',
    subtitle: 'Por sus contribuciones que unen probabilidad, teoría de representaciones y geometría algebraica.',
    impact: 'Cristales aleatorios, particiones, formas de Young — todo en un solo lenguaje. Conexiones inesperadas entre áreas dispares.',
    status: 'pending',
  },
  {
    id: 'fields-2006-perelman',
    year: 2006,
    prize: 'fields',
    laureates: ['Grigori Perelman'],
    block: 'topologia-geometria',
    title: 'Poincaré demostrada — y el Fields rechazado',
    subtitle: 'Por sus contribuciones a la geometría y sus ideas revolucionarias sobre la estructura analítica y geométrica del flujo de Ricci.',
    impact: 'Demostró la conjetura de Poincaré (1904). Rechazó el Fields y el millón del Clay. Vive solo con su madre en San Petersburgo — leyenda viva.',
    status: 'pending',
  },
  {
    id: 'fields-2006-tao',
    year: 2006,
    prize: 'fields',
    laureates: ['Terence Tao'],
    block: 'combinatoria',
    title: 'Primos en progresión aritmética y EDPs',
    subtitle: 'Por contribuciones a EDPs, combinatoria, análisis armónico y teoría aditiva de números.',
    impact: 'Con Ben Green: hay progresiones aritméticas arbitrariamente largas en los primos. El matemático vivo más conocido del mundo. Blogger prolífico.',
    status: 'pending',
  },
  {
    id: 'fields-2006-werner',
    year: 2006,
    prize: 'fields',
    laureates: ['Wendelin Werner'],
    block: 'probabilidad-dinamica',
    title: 'Procesos SLE en probabilidad conforme',
    subtitle: 'Por contribuciones al desarrollo de la teoría de la evolución estocástica de Loewner (SLE).',
    impact: 'Primer probabilista en ganar Fields. SLE explica los fractales que aparecen en límites de percolación crítica. Belleza pura.',
    status: 'pending',
  },

  // 2010
  {
    id: 'fields-2010-lindenstrauss',
    year: 2010,
    prize: 'fields',
    laureates: ['Elon Lindenstrauss'],
    block: 'probabilidad-dinamica',
    title: 'Teoría ergódica y rigidez aritmética',
    subtitle: 'Por resultados sobre rigidez de medidas en teoría ergódica y sus aplicaciones a teoría de números.',
    impact: 'Aplicó teoría ergódica a conjeturas de Littlewood en aproximación diofantina. Primer israelí en ganar Fields.',
    status: 'pending',
  },
  {
    id: 'fields-2010-ngo',
    year: 2010,
    prize: 'fields',
    laureates: ['Ngô Bảo Châu'],
    block: 'grupos-representaciones',
    title: 'El lema fundamental de Langlands',
    subtitle: 'Por demostrar el lema fundamental en la teoría de formas automorfas mediante la introducción de nuevos métodos geométricos.',
    impact: 'Pieza clave del programa Langlands, abierta 30 años. Primer vietnamita en ganar Fields. Lo recogió descalzo, según la tradición.',
    status: 'pending',
  },
  {
    id: 'fields-2010-smirnov',
    year: 2010,
    prize: 'fields',
    laureates: ['Stanislav Smirnov'],
    block: 'probabilidad-dinamica',
    title: 'Invariancia conforme en mecánica estadística',
    subtitle: 'Por la demostración de la invariancia conforme de la percolación y del modelo de Ising plano.',
    impact: 'Demostró rigurosamente lo que los físicos suponían: a temperatura crítica, el modelo de Ising es invariante conforme.',
    status: 'pending',
  },
  {
    id: 'fields-2010-villani',
    year: 2010,
    prize: 'fields',
    laureates: ['Cédric Villani'],
    block: 'analisis-pde',
    title: 'Transporte óptimo y amortiguamiento de Landau',
    subtitle: 'Por sus pruebas del amortiguamiento de Landau no lineal y convergencia al equilibrio para la ecuación de Boltzmann.',
    impact: 'El "Lady Gaga de la matemática" — corbata floja, telaraña al pecho. Después diputado en Francia. Comunicador genial.',
    status: 'pending',
  },

  // 2014
  {
    id: 'fields-2014-avila',
    year: 2014,
    prize: 'fields',
    laureates: ['Artur Avila'],
    block: 'probabilidad-dinamica',
    title: 'Sistemas dinámicos cuasi-periódicos',
    subtitle: 'Por contribuciones profundas a la teoría de sistemas dinámicos.',
    impact: 'Primer Fields latinoamericano. Brasileño. Demostró rigidez en operadores cuasi-periódicos y aplicaciones unidimensionales del intervalo.',
    status: 'pending',
  },
  {
    id: 'fields-2014-bhargava',
    year: 2014,
    prize: 'fields',
    laureates: ['Manjul Bhargava'],
    block: 'algebra-numeros',
    title: 'La extensión moderna de Gauss',
    subtitle: 'Por desarrollar nuevos métodos en geometría de números y aplicarlos para contar anillos de orden pequeño y curvas elípticas.',
    impact: 'A los 28 generalizó la composición de Gauss usando un cubo de Rubik. Belleza visual en teoría de números. Canadiense-indio.',
    status: 'pending',
  },
  {
    id: 'fields-2014-hairer',
    year: 2014,
    prize: 'fields',
    laureates: ['Martin Hairer'],
    block: 'analisis-pde',
    title: 'Estructuras de regularidad para EDPs estocásticas',
    subtitle: 'Por contribuciones a la teoría de ecuaciones diferenciales parciales estocásticas.',
    impact: 'Inventó las "estructuras de regularidad" — un cálculo nuevo para EDPs con ruido tan irregular que la teoría clásica falla.',
    status: 'pending',
  },
  {
    id: 'fields-2014-mirzakhani',
    year: 2014,
    prize: 'fields',
    laureates: ['Maryam Mirzakhani'],
    block: 'topologia-geometria',
    title: 'La primera mujer Medalla Fields',
    subtitle: 'Por contribuciones notables a la dinámica y geometría de superficies de Riemann y sus espacios de moduli.',
    impact: 'Primera mujer Fields. Iraní. Demostró fórmulas de conteo para geodésicas en superficies hiperbólicas. Murió de cáncer en 2017, a los 40.',
    status: 'pending',
  },

  // 2018
  {
    id: 'fields-2018-birkar',
    year: 2018,
    prize: 'fields',
    laureates: ['Caucher Birkar'],
    block: 'geometria-algebraica',
    title: 'Variedades de Fano y modelos mínimos',
    subtitle: 'Por contribuciones al programa de modelos mínimos y a la teoría de variedades de Fano.',
    impact: 'Refugiado kurdo de la guerra Irán-Iraq. Le robaron el Fields literalmente — la medalla — en Río el día de la ceremonia.',
    status: 'pending',
  },
  {
    id: 'fields-2018-figalli',
    year: 2018,
    prize: 'fields',
    laureates: ['Alessio Figalli'],
    block: 'analisis-pde',
    title: 'Transporte óptimo, regularidad y problemas isoperimétricos',
    subtitle: 'Por contribuciones a la teoría del transporte óptimo y su aplicación a EDPs, geometría métrica y probabilidad.',
    impact: 'Italiano. Continúa la línea Villani pero con resultados de regularidad fina. Aplicaciones a meteorología y geometría.',
    status: 'pending',
  },
  {
    id: 'fields-2018-scholze',
    year: 2018,
    prize: 'fields',
    laureates: ['Peter Scholze'],
    block: 'geometria-algebraica',
    title: 'Espacios perfectoides',
    subtitle: 'Por transformar la geometría algebraica aritmética en cuerpos locales mediante la introducción de espacios perfectoides.',
    impact: 'A los 24 ya era profesor en Bonn. Construyó un puente entre característica 0 y característica p — un campo entero nuevo.',
    status: 'pending',
  },
  {
    id: 'fields-2018-venkatesh',
    year: 2018,
    prize: 'fields',
    laureates: ['Akshay Venkatesh'],
    block: 'grupos-representaciones',
    title: 'Síntesis de teoría de números y dinámica',
    subtitle: 'Por unificar elegantemente teoría analítica de números, teoría ergódica y formas automorfas.',
    impact: 'Australiano. Conecta áreas que tradicionalmente no se hablaban — formas automorfas con dinámica homogénea. Profundo.',
    status: 'pending',
  },

  // 2022
  {
    id: 'fields-2022-duminilcopin',
    year: 2022,
    prize: 'fields',
    laureates: ['Hugo Duminil-Copin'],
    block: 'probabilidad-dinamica',
    title: 'Transiciones de fase en mecánica estadística',
    subtitle: 'Por resolver problemas de larga data en mecánica estadística probabilística.',
    impact: 'Demostró rigurosamente transiciones de fase agudas en percolación y modelo Potts. Estudiante de Werner. Físico-probabilista de elite.',
    status: 'pending',
  },
  {
    id: 'fields-2022-huh',
    year: 2022,
    prize: 'fields',
    laureates: ['June Huh'],
    block: 'combinatoria',
    title: 'Combinatoria con geometría algebraica',
    subtitle: 'Por aportar ideas de la teoría de Hodge a combinatoria, demostrando varias conjeturas de larga data.',
    impact: 'Estaba en una banda de poesía a los 24, decidió hacer doctorado tarde. Coreano. Demostró Heron-Rota-Welsh y muchas conjeturas combinatorias.',
    status: 'pending',
  },
  {
    id: 'fields-2022-maynard',
    year: 2022,
    prize: 'fields',
    laureates: ['James Maynard'],
    block: 'algebra-numeros',
    title: 'Brechas pequeñas entre primos',
    subtitle: 'Por contribuciones a la teoría analítica de números, especialmente brechas entre números primos.',
    impact: 'Continuó la revolución de Yitang Zhang — demostró que hay infinitos pares de primos a distancia ≤ 246. Brecha primaria acotada.',
    status: 'pending',
  },
  {
    id: 'fields-2022-viazovska',
    year: 2022,
    prize: 'fields',
    laureates: ['Maryna Viazovska'],
    block: 'algebra-numeros',
    title: 'El empacado óptimo en dimensión 8 y 24',
    subtitle: 'Por demostrar que el retículo E8 es el empaquetamiento de esferas más denso en dimensión 8.',
    impact: 'Ucraniana, segunda mujer Fields. Solución elegante usando formas modulares. También dim 24 con el retículo Leech.',
    status: 'pending',
  },

  // ═══════════════════════ PREMIO ABEL ═══════════════════════

  {
    id: 'abel-2003-serre',
    year: 2003,
    prize: 'abel',
    laureates: ['Jean-Pierre Serre'],
    block: 'geometria-algebraica',
    title: 'El primer Premio Abel',
    subtitle: 'Por dar forma moderna a partes de la topología, geometría algebraica y teoría de números.',
    impact: 'Fields a los 27, Abel a los 76. Sigue activo en los 90s. La carrera más larga y profunda de la matemática del siglo XX.',
    status: 'pending',
  },
  {
    id: 'abel-2004-atiyah-singer',
    year: 2004,
    prize: 'abel',
    laureates: ['Michael Atiyah', 'Isadore Singer'],
    block: 'topologia-geometria',
    title: 'El teorema del índice — premiado dos veces',
    subtitle: 'Por su descubrimiento y demostración del teorema del índice, conectando topología, geometría y análisis.',
    impact: 'Atiyah ya tenía Fields. Singer no. El teorema unifica EDPs e invariantes topológicos — base de la teoría gauge en física.',
    status: 'pending',
  },
  {
    id: 'abel-2005-lax',
    year: 2005,
    prize: 'abel',
    laureates: ['Peter Lax'],
    block: 'analisis-pde',
    title: 'EDPs, ondas de choque y análisis aplicado',
    subtitle: 'Por sus contribuciones innovadoras a la teoría y aplicación de ecuaciones diferenciales parciales y al cómputo de sus soluciones.',
    impact: 'Pares de Lax para sistemas integrables, esquemas de Lax-Wendroff para ondas de choque. Sobreviviente del Holocausto.',
    status: 'pending',
  },
  {
    id: 'abel-2006-carleson',
    year: 2006,
    prize: 'abel',
    laureates: ['Lennart Carleson'],
    block: 'analisis-pde',
    title: 'Convergencia de series de Fourier',
    subtitle: 'Por sus contribuciones profundas y seminales al análisis armónico y la teoría de sistemas dinámicos suaves.',
    impact: 'Demostró que las series de Fourier de funciones L² convergen casi en todas partes — un problema de 60 años. Sueco, técnico de élite.',
    status: 'pending',
  },
  {
    id: 'abel-2007-varadhan',
    year: 2007,
    prize: 'abel',
    laureates: ['S.R. Srinivasa Varadhan'],
    block: 'probabilidad-dinamica',
    title: 'Grandes desviaciones',
    subtitle: 'Por su contribución fundamental a la teoría de probabilidad y, en particular, por crear una teoría unificada de las grandes desviaciones.',
    impact: 'Cuantifica cuán "improbable" es lo improbable — eventos raros con precisión asintótica. Indio, profesor en Courant.',
    status: 'pending',
  },
  {
    id: 'abel-2008-thompson-tits',
    year: 2008,
    prize: 'abel',
    laureates: ['John Thompson', 'Jacques Tits'],
    block: 'grupos-representaciones',
    title: 'Grupos finitos simples y edificios',
    subtitle: 'Por sus logros profundos en álgebra y, en particular, por dar forma a la teoría moderna de grupos.',
    impact: 'Thompson ya tenía Fields. Tits inventó los "edificios" — complejos geométricos asociados a grupos. Pieza clave del programa Bruhat-Tits.',
    status: 'pending',
  },
  {
    id: 'abel-2009-gromov',
    year: 2009,
    prize: 'abel',
    laureates: ['Mikhail Gromov'],
    block: 'topologia-geometria',
    title: 'Geometría revolucionaria',
    subtitle: 'Por sus contribuciones revolucionarias a la geometría.',
    impact: 'Inventó la geometría geométrica de grupos, los pseudo-holomórfica, h-principle. Ruso emigrado a Francia. Imaginación geométrica única.',
    status: 'pending',
  },
  {
    id: 'abel-2010-tate',
    year: 2010,
    prize: 'abel',
    laureates: ['John Tate'],
    block: 'algebra-numeros',
    title: 'Teoría algebraica de números moderna',
    subtitle: 'Por su vasto y duradero impacto en la teoría de los números.',
    impact: 'Su tesis (Tate "thesis") reformuló la teoría de los números usando análisis armónico adélico. Maestro de generaciones.',
    status: 'pending',
  },
  {
    id: 'abel-2011-milnor',
    year: 2011,
    prize: 'abel',
    laureates: ['John Milnor'],
    block: 'topologia-geometria',
    title: 'Topología en todas sus formas',
    subtitle: 'Por descubrimientos pioneros en topología, geometría y álgebra.',
    impact: 'Fields a los 31, Abel a los 80. Sus libros — Morse Theory, Topology from Differentiable Viewpoint — son lectura iniciática.',
    status: 'pending',
  },
  {
    id: 'abel-2012-szemeredi',
    year: 2012,
    prize: 'abel',
    laureates: ['Endre Szemerédi'],
    block: 'combinatoria',
    title: 'El teorema de Szemerédi',
    subtitle: 'Por sus contribuciones fundamentales a la matemática discreta y la teoría de la computación.',
    impact: 'Conjuntos densos de enteros contienen progresiones aritméticas arbitrariamente largas. La piedra angular de la teoría aditiva moderna.',
    status: 'pending',
  },
  {
    id: 'abel-2013-deligne',
    year: 2013,
    prize: 'abel',
    laureates: ['Pierre Deligne'],
    block: 'geometria-algebraica',
    title: 'La geometría algebraica de Deligne',
    subtitle: 'Por contribuciones seminales a la geometría algebraica y por su impacto transformador en teoría de números, teoría de representaciones y campos relacionados.',
    impact: 'Fields 1978 + Abel 2013. Demostró Weil, Hodge mixto, monodromía de Riemann-Hilbert. Estudiante predilecto de Grothendieck.',
    status: 'pending',
  },
  {
    id: 'abel-2014-sinai',
    year: 2014,
    prize: 'abel',
    laureates: ['Yakov Sinai'],
    block: 'probabilidad-dinamica',
    title: 'Sistemas dinámicos, teoría ergódica y física matemática',
    subtitle: 'Por sus contribuciones fundamentales a sistemas dinámicos, teoría ergódica y física matemática.',
    impact: 'Inventó la entropía de Kolmogorov-Sinai, los billares de Sinai, conexión rigurosa entre mecánica estadística y ergodicidad.',
    status: 'pending',
  },
  {
    id: 'abel-2015-nash-nirenberg',
    year: 2015,
    prize: 'abel',
    laureates: ['John Nash', 'Louis Nirenberg'],
    block: 'analisis-pde',
    title: 'EDPs no lineales y geometría',
    subtitle: 'Por contribuciones notables y seminales a la teoría de ecuaciones diferenciales parciales no lineales.',
    impact: 'Nash ya tenía Nobel de Economía. Murió en accidente días después de recibir el Abel. Nirenberg: la otra mitad del teorema De Giorgi-Nash-Moser.',
    status: 'pending',
  },
  {
    id: 'abel-2016-wiles',
    year: 2016,
    prize: 'abel',
    laureates: ['Andrew Wiles'],
    block: 'algebra-numeros',
    title: 'El Último Teorema de Fermat demostrado',
    subtitle: 'Por su asombrosa demostración del Último Teorema de Fermat mediante la conjetura de modularidad para curvas elípticas semiestables.',
    impact: '350 años abierto. Wiles trabajó 7 años en secreto en el ático. El error encontrado, corregido con Taylor un año después. Final triunfal.',
    status: 'pending',
  },
  {
    id: 'abel-2017-meyer',
    year: 2017,
    prize: 'abel',
    laureates: ['Yves Meyer'],
    block: 'analisis-pde',
    title: 'Wavelets — análisis a múltiples escalas',
    subtitle: 'Por su papel central en el desarrollo de la teoría matemática de las wavelets.',
    impact: 'Junto a Daubechies y Mallat construyeron la matemática de las wavelets. JPEG2000, FBI fingerprint compression, detección de ondas gravitacionales LIGO.',
    status: 'pending',
  },
  {
    id: 'abel-2018-langlands',
    year: 2018,
    prize: 'abel',
    laureates: ['Robert Langlands'],
    block: 'grupos-representaciones',
    title: 'El programa de Langlands',
    subtitle: 'Por su programa visionario que conecta teoría de representaciones con teoría de números.',
    impact: 'En 1967 escribió a André Weil una carta de 17 páginas describiendo conexiones que la mayor parte aún no se han demostrado. El "Gran Plan Unificado".',
    status: 'pending',
  },
  {
    id: 'abel-2019-uhlenbeck',
    year: 2019,
    prize: 'abel',
    laureates: ['Karen Uhlenbeck'],
    block: 'analisis-pde',
    title: 'La primera mujer Premio Abel',
    subtitle: 'Por sus logros pioneros en EDPs geométricas, teoría gauge y sistemas integrables.',
    impact: 'Primera mujer Abel. Pionera del análisis geométrico — instantones de Yang-Mills, aplicaciones armónicas. Generación entera la siguió.',
    status: 'pending',
  },
  {
    id: 'abel-2020-furstenberg-margulis',
    year: 2020,
    prize: 'abel',
    laureates: ['Hillel Furstenberg', 'Grigory Margulis'],
    block: 'probabilidad-dinamica',
    title: 'Teoría ergódica en teoría de números y grupos',
    subtitle: 'Por su uso pionero de métodos probabilísticos y dinámicos en teoría de grupos, teoría de números y combinatoria.',
    impact: 'Furstenberg dio prueba ergódica de Szemerédi. Margulis aplicó dinámica a Oppenheim. La fusión ergodicidad-aritmética nació con ellos.',
    status: 'pending',
  },
  {
    id: 'abel-2021-lovasz-wigderson',
    year: 2021,
    prize: 'abel',
    laureates: ['László Lovász', 'Avi Wigderson'],
    block: 'aplicada-computacion',
    title: 'Teoría de la computación y matemática discreta',
    subtitle: 'Por sus contribuciones fundamentales a las ciencias de la computación teóricas y matemática discreta, y su papel principal en su transformación en campos centrales.',
    impact: 'Lovász: LLL — algoritmo de reducción de bases reticulares, central en criptografía post-cuántica. Wigderson: pseudoaleatoriedad y complejidad.',
    status: 'pending',
  },
  {
    id: 'abel-2022-sullivan',
    year: 2022,
    prize: 'abel',
    laureates: ['Dennis Sullivan'],
    block: 'topologia-geometria',
    title: 'Topología y sistemas dinámicos',
    subtitle: 'Por sus contribuciones revolucionarias a la topología en su sentido más amplio, y en particular sus aspectos algebraicos, geométricos y dinámicos.',
    impact: 'Topología racional, modelos minimales de Sullivan, geometría hiperbólica conmensurabilidad. El topólogo más versátil viviente.',
    status: 'pending',
  },
  {
    id: 'abel-2023-caffarelli',
    year: 2023,
    prize: 'abel',
    laureates: ['Luis Caffarelli'],
    block: 'analisis-pde',
    title: 'Regularidad en EDPs no lineales',
    subtitle: 'Por sus contribuciones seminales a la teoría de regularidad para ecuaciones diferenciales parciales no lineales, incluyendo problemas con frontera libre y la ecuación de Monge-Ampère.',
    impact: 'Argentino, primer latinoamericano Abel. Frontera libre, Stefan, transporte óptimo. La regularidad parcial Navier-Stokes lleva su nombre.',
    status: 'pending',
  },
  {
    id: 'abel-2024-talagrand',
    year: 2024,
    prize: 'abel',
    laureates: ['Michel Talagrand'],
    block: 'probabilidad-dinamica',
    title: 'Concentración de medida y procesos estocásticos',
    subtitle: 'Por contribuciones innovadoras a la teoría de la probabilidad y al análisis funcional, con aplicaciones excepcionales en física matemática y estadística.',
    impact: 'Sus desigualdades de concentración son herramienta diaria de probabilistas, machine learning y vidrios de espín. Demostró conjeturas de Parisi.',
    status: 'pending',
  },
];

/**
 * Cuenta cuántos están en cada estado.
 */
export function getMathPrizesStats() {
  const total = MATH_CATALOG.length;
  const live = MATH_CATALOG.filter(n => n.status === 'live').length;
  const pending = total - live;
  const fields = MATH_CATALOG.filter(n => n.prize === 'fields').length;
  const abel = MATH_CATALOG.filter(n => n.prize === 'abel').length;
  return { total, live, pending, fields, abel };
}

/**
 * Agrupa por bloque temático.
 */
export function getMathCatalogByBlock(): Array<{ block: MathBlockMeta; entries: MathLaureate[] }> {
  const ordered = [...MATH_BLOCKS].sort((a, b) => a.order - b.order);
  return ordered.map(block => ({
    block,
    entries: MATH_CATALOG
      .filter(n => n.block === block.id)
      .sort((a, b) => a.year - b.year),
  }));
}

/**
 * Filtra por tipo de premio.
 */
export function getMathCatalogByPrize(prize: MathPrizeKind | 'todos'): MathLaureate[] {
  if (prize === 'todos') return [...MATH_CATALOG].sort((a, b) => a.year - b.year);
  return MATH_CATALOG.filter(n => n.prize === prize).sort((a, b) => a.year - b.year);
}
