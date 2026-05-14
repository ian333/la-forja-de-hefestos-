/**
 * Catálogo de los 56 Premios Nobel de Economía (1969-2024).
 *
 * El "Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel"
 * — el premio del Banco de Suecia, creado en 1968 — premia avances en
 * economía con el mismo rigor formal que el Nobel. Más de 90 personas lo han
 * recibido. Cada entrada aquí es UNA lección potencial del módulo de economía.
 *
 * Los bloques NO son cronológicos: están agrupados por TEMA pedagógico para
 * que un alumno pueda seguir la línea conceptual. Dentro de cada bloque, el
 * orden es cronológico para mostrar la evolución de la idea.
 *
 * `status: 'live'` significa que la masterclass ya está producida y enlaza
 * a `/masterclass.html?id=<classId>`. `status: 'pending'` aparece como card
 * en gris en el portal, próxima a producir.
 */

export type NobelStatus = 'live' | 'pending';

export interface NobelLaureate {
  /** Slug del premio. Usado como id de masterclass cuando esté live. */
  id: string;
  /** Año del premio. */
  year: number;
  /** Lista de premiados (un premio puede tener 1-3 personas). */
  laureates: string[];
  /** Bloque temático. Determina el color y el orden visual. */
  block: NobelBlock;
  /** Título corto de la lección — el "hook". */
  title: string;
  /** Subtítulo: qué premió oficialmente el comité (en español). */
  subtitle: string;
  /** Frase de impacto: qué cambia entender esto. */
  impact: string;
  /** Estado de producción. */
  status: NobelStatus;
  /** Si status === 'live', el classId del masterclass. */
  classId?: string;
}

export type NobelBlock =
  | 'mercados-funcionan'
  | 'mercados-fallan'
  | 'juegos-mecanismos'
  | 'macro-crecimiento'
  | 'finanzas'
  | 'dinero-inflacion'
  | 'desarrollo-pobreza'
  | 'capital-humano'
  | 'behavioral'
  | 'historia-geografia'
  | 'metodos'
  | 'otros';

export interface BlockMeta {
  id: NobelBlock;
  name: string;
  description: string;
  color: string;       // base color hex
  colorBg: string;     // background hex
  colorEmissive: string; // glow hex
  order: number;       // for sorting blocks visually
}

export const BLOCKS: BlockMeta[] = [
  {
    id: 'mercados-funcionan',
    name: 'Cuando los mercados funcionan',
    description: 'Equilibrio general, precios, asignación eficiente. Los pilares neoclásicos.',
    color: '#4FC3F7',
    colorBg: '#0B2138',
    colorEmissive: '#1E40AF',
    order: 1,
  },
  {
    id: 'mercados-fallan',
    name: 'Cuando los mercados fallan',
    description: 'Información asimétrica, externalidades, contratos incompletos, poder de mercado.',
    color: '#F472B6',
    colorBg: '#2A0E22',
    colorEmissive: '#BE185D',
    order: 2,
  },
  {
    id: 'juegos-mecanismos',
    name: 'Juegos y mecanismos',
    description: 'Equilibrios estratégicos, diseño de mecanismos, subastas, matching.',
    color: '#A78BFA',
    colorBg: '#1E1338',
    colorEmissive: '#6D28D9',
    order: 3,
  },
  {
    id: 'macro-crecimiento',
    name: 'Macroeconomía y crecimiento',
    description: 'Por qué unos países son ricos y otros pobres, ciclos económicos, instituciones.',
    color: '#34D399',
    colorBg: '#062E20',
    colorEmissive: '#047857',
    order: 4,
  },
  {
    id: 'finanzas',
    name: 'Finanzas y riesgo',
    description: 'Portafolios, derivados, pricing de activos, crisis bancarias.',
    color: '#FDB813',
    colorBg: '#2A1A03',
    colorEmissive: '#B45309',
    order: 5,
  },
  {
    id: 'dinero-inflacion',
    name: 'Dinero e inflación',
    description: 'Política monetaria, expectativas, zonas monetarias óptimas.',
    color: '#FB923C',
    colorBg: '#2A1407',
    colorEmissive: '#C2410C',
    order: 6,
  },
  {
    id: 'desarrollo-pobreza',
    name: 'Desarrollo y pobreza',
    description: 'Por qué algunos quedan atrás, cómo medirlo, qué políticas sí funcionan.',
    color: '#EF4444',
    colorBg: '#2A0B0B',
    colorEmissive: '#991B1B',
    order: 7,
  },
  {
    id: 'capital-humano',
    name: 'Capital humano y trabajo',
    description: 'Educación, salarios, desempleo, discriminación, género.',
    color: '#22D3EE',
    colorBg: '#082831',
    colorEmissive: '#0E7490',
    order: 8,
  },
  {
    id: 'behavioral',
    name: 'Comportamiento y experimentos',
    description: 'Lo que pasa cuando los humanos no son los robots racionales del modelo.',
    color: '#D946EF',
    colorBg: '#2A0F30',
    colorEmissive: '#A21CAF',
    order: 9,
  },
  {
    id: 'historia-geografia',
    name: 'Historia y geografía',
    description: 'Lecciones de los siglos. Por qué la geografía importa pero no determina.',
    color: '#A16207',
    colorBg: '#251703',
    colorEmissive: '#854D0E',
    order: 10,
  },
  {
    id: 'metodos',
    name: 'Métodos cuantitativos',
    description: 'Econometría, series temporales, causalidad. Las matemáticas para entender datos.',
    color: '#94A3B8',
    colorBg: '#1A2030',
    colorEmissive: '#475569',
    order: 11,
  },
  {
    id: 'otros',
    name: 'Otras contribuciones fundamentales',
    description: 'Public choice, regulación, climate change. Lo que no entra en otra caja.',
    color: '#E2E8F0',
    colorBg: '#1A1F2A',
    colorEmissive: '#64748B',
    order: 12,
  },
];

/**
 * Los 56 premios desde 1969. Cada año desde 1969 está representado.
 *
 * Los datos vienen del comité Nobel (NobelPrize.org). Las frases de impacto
 * y los títulos de lección son redacción nuestra, pensadas para el alumno
 * latinoamericano.
 */
export const NOBEL_CATALOG: NobelLaureate[] = [
  // ═══════════════════════ MERCADOS FUNCIONAN ═══════════════════════
  {
    id: 'econ-1970-samuelson',
    year: 1970,
    laureates: ['Paul Samuelson'],
    block: 'mercados-funcionan',
    title: 'Las matemáticas detrás de la economía',
    subtitle: 'Por desarrollar la teoría económica estática y dinámica con rigor matemático.',
    impact: 'Convirtió la economía en una ciencia donde las predicciones se pueden falsar.',
    status: 'pending',
  },
  {
    id: 'econ-1972-hicks-arrow',
    year: 1972,
    laureates: ['John Hicks', 'Kenneth Arrow'],
    block: 'mercados-funcionan',
    title: 'Equilibrio general',
    subtitle: 'Por aportes pioneros a la teoría del equilibrio económico general y bienestar.',
    impact: '¿Pueden coincidir millones de decisiones independientes? Sí. La demostración formal.',
    status: 'pending',
  },
  {
    id: 'econ-1983-debreu',
    year: 1983,
    laureates: ['Gérard Debreu'],
    block: 'mercados-funcionan',
    title: 'La teoría del valor formalizada',
    subtitle: 'Por incorporar nuevos métodos analíticos a la teoría económica y reformular la teoría del equilibrio general.',
    impact: 'El librito "Theory of Value" — la Biblia matemática del equilibrio.',
    status: 'pending',
  },
  {
    id: 'econ-1988-allais',
    year: 1988,
    laureates: ['Maurice Allais'],
    block: 'mercados-funcionan',
    title: 'La paradoja que rompió el modelo',
    subtitle: 'Por contribuciones pioneras a la teoría de mercados y la utilización eficiente de recursos.',
    impact: 'El experimento que mostró que la gente no maximiza la utilidad esperada.',
    status: 'pending',
  },

  // ═══════════════════════ MERCADOS FALLAN ═══════════════════════
  {
    id: 'econ-01-limones',
    year: 2001,
    laureates: ['George Akerlof', 'Michael Spence', 'Joseph Stiglitz'],
    block: 'mercados-fallan',
    title: 'Los limones, o cómo se mueren los mercados solos',
    subtitle: 'Por sus análisis de mercados con información asimétrica.',
    impact: 'Por qué tu carro nuevo pierde 20% al salir del lote. Por qué Obamacare es obligatorio.',
    status: 'live',
    classId: 'econ-01-limones',
  },
  {
    id: 'econ-02-coase',
    year: 1991,
    laureates: ['Ronald Coase'],
    block: 'mercados-fallan',
    title: '¿Por qué existen las empresas?',
    subtitle: 'Por su descubrimiento de la importancia de los costos de transacción y los derechos de propiedad.',
    impact: 'Si los mercados son tan eficientes, ¿por qué hay jefes? La respuesta cambia tu vida laboral.',
    status: 'live',
    classId: 'econ-02-coase',
  },
  {
    id: 'econ-03-spence',
    year: 2001,
    laureates: ['Michael Spence'],
    block: 'mercados-fallan',
    title: 'La señalización — por qué existe el título universitario',
    subtitle: 'Por su análisis de mercados con información asimétrica (Job Market Signaling, 1973).',
    impact: 'La universidad puede no enseñar nada y aun así servir. La inflación de credenciales explicada.',
    status: 'live',
    classId: 'econ-03-spence',
  },
  {
    id: 'econ-17-mirrlees-vickrey',
    year: 1996,
    laureates: ['James Mirrlees', 'William Vickrey'],
    block: 'mercados-fallan',
    title: 'Cómo diseñar incentivos cuando no ves todo',
    subtitle: 'Por contribuciones fundamentales a la teoría económica de los incentivos bajo información asimétrica.',
    impact: 'Por qué tu impuesto sobre la renta tiene la forma que tiene. Por qué eBay funciona.',
    status: 'live',
    classId: 'econ-17-mirrlees-vickrey',
  },
  {
    id: 'econ-15-ostrom',
    year: 2009,
    laureates: ['Elinor Ostrom', 'Oliver Williamson'],
    block: 'mercados-fallan',
    title: 'La tragedia de los comunes... que no fue tragedia',
    subtitle: 'Por análisis de gobernanza económica: bienes comunes (Ostrom) y costos de transacción (Williamson).',
    impact: 'Ostrom: primera mujer Nobel de economía. Mostró cómo comunidades reales gestionan recursos sin Estado ni mercado.',
    status: 'live',
    classId: 'econ-15-ostrom',
  },
  {
    id: 'econ-05-tirole',
    year: 2014,
    laureates: ['Jean Tirole'],
    block: 'mercados-fallan',
    title: 'Mercados de dos lados — la era de las plataformas',
    subtitle: 'Por su análisis del poder de mercado y la regulación.',
    impact: 'Por qué Visa, App Store y Uber son "mercados de dos lados" y por qué eso lo cambia todo.',
    status: 'live',
    classId: 'econ-05-tirole',
  },
  {
    id: 'econ-04-hart-holmstrom',
    year: 2016,
    laureates: ['Oliver Hart', 'Bengt Holmström'],
    block: 'mercados-fallan',
    title: 'Contratos incompletos',
    subtitle: 'Por sus contribuciones a la teoría de los contratos.',
    impact: 'Quién manda cuando el contrato calla. Por qué los CEOs cobran en acciones.',
    status: 'live',
    classId: 'econ-04-hart-holmstrom',
  },

  // ═══════════════════════ JUEGOS / MECANISMOS ═══════════════════════
  {
    id: 'econ-06-nash',
    year: 1994,
    laureates: ['John Nash', 'John Harsanyi', 'Reinhard Selten'],
    block: 'juegos-mecanismos',
    title: 'El equilibrio de Nash',
    subtitle: 'Por sus análisis pioneros del equilibrio en la teoría de juegos no cooperativos.',
    impact: 'El dilema del prisionero, la disuasión nuclear, las negociaciones de paz. Un solo concepto.',
    status: 'live',
    classId: 'econ-06-nash',
  },
  {
    id: 'econ-2005-aumann-schelling',
    year: 2005,
    laureates: ['Robert Aumann', 'Thomas Schelling'],
    block: 'juegos-mecanismos',
    title: 'Conflicto, cooperación y la lógica de la disuasión',
    subtitle: 'Por mejorar nuestro entendimiento del conflicto y la cooperación mediante teoría de juegos.',
    impact: 'Schelling explicó la guerra fría sin tirar una bala. Aumann formalizó qué es saber que el otro sabe.',
    status: 'pending',
  },
  {
    id: 'econ-2007-mechanism-design',
    year: 2007,
    laureates: ['Leonid Hurwicz', 'Eric Maskin', 'Roger Myerson'],
    block: 'juegos-mecanismos',
    title: 'Diseñando las reglas del juego',
    subtitle: 'Por haber establecido los fundamentos de la teoría del diseño de mecanismos.',
    impact: 'Si los participantes mienten, ¿qué reglas inventas para que digan la verdad? El campo entero.',
    status: 'pending',
  },
  {
    id: 'econ-11-roth-shapley',
    year: 2012,
    laureates: ['Alvin Roth', 'Lloyd Shapley'],
    block: 'juegos-mecanismos',
    title: 'Cuando no hay precio: matching',
    subtitle: 'Por la teoría de asignaciones estables y la práctica del diseño de mercado.',
    impact: 'Cómo asignar riñones, médicos residentes, niños a escuelas, sin que haya dinero de por medio.',
    status: 'live',
    classId: 'econ-11-roth-shapley',
  },
  {
    id: 'econ-2020-milgrom-wilson',
    year: 2020,
    laureates: ['Paul Milgrom', 'Robert Wilson'],
    block: 'juegos-mecanismos',
    title: 'Las subastas que pagan el internet',
    subtitle: 'Por mejoras a la teoría de subastas e invención de nuevos formatos.',
    impact: 'El espectro 5G de tu celular se vendió con un mecanismo que ellos inventaron. Decenas de miles de millones.',
    status: 'pending',
  },

  // ═══════════════════════ MACRO / CRECIMIENTO ═══════════════════════
  {
    id: 'econ-1971-kuznets',
    year: 1971,
    laureates: ['Simon Kuznets'],
    block: 'macro-crecimiento',
    title: 'Cómo medir un país: el PIB y la curva',
    subtitle: 'Por la interpretación empíricamente fundada del crecimiento económico.',
    impact: 'Inventó el PIB. Y advirtió que NO debía usarse como medida de bienestar. Nadie le hizo caso.',
    status: 'pending',
  },
  {
    id: 'econ-07-solow',
    year: 1987,
    laureates: ['Robert Solow'],
    block: 'macro-crecimiento',
    title: 'Crecimiento: el modelo Solow',
    subtitle: 'Por sus contribuciones a la teoría del crecimiento económico.',
    impact: 'Demostró que el capital se queda corto: la verdadera fuente del crecimiento es el conocimiento.',
    status: 'live',
    classId: 'econ-07-solow',
  },
  {
    id: 'econ-16-lucas',
    year: 1995,
    laureates: ['Robert Lucas Jr.'],
    block: 'macro-crecimiento',
    title: 'Expectativas racionales',
    subtitle: 'Por desarrollar y aplicar la hipótesis de expectativas racionales.',
    impact: 'Si la gente prevé las acciones del gobierno, las políticas pierden efecto. La revolución macro.',
    status: 'live',
    classId: 'econ-16-lucas',
  },
  {
    id: 'econ-2004-kydland-prescott',
    year: 2004,
    laureates: ['Finn Kydland', 'Edward Prescott'],
    block: 'macro-crecimiento',
    title: 'Por qué los bancos centrales son autónomos',
    subtitle: 'Por sus contribuciones a la macroeconomía dinámica: consistencia temporal y motores de los ciclos.',
    impact: 'El problema de "consistencia temporal" explica por qué Banxico no le obedece al presidente.',
    status: 'pending',
  },
  {
    id: 'econ-2006-phelps',
    year: 2006,
    laureates: ['Edmund Phelps'],
    block: 'macro-crecimiento',
    title: 'Inflación y desempleo: no es lo que crees',
    subtitle: 'Por su análisis de los compromisos intertemporales en la política macroeconómica.',
    impact: 'La curva de Phillips no existe a largo plazo. Si imprimes dinero, solo hay inflación, no empleo.',
    status: 'pending',
  },
  {
    id: 'econ-2018-romer-nordhaus',
    year: 2018,
    laureates: ['Paul Romer', 'William Nordhaus'],
    block: 'macro-crecimiento',
    title: 'Ideas y clima: las dos fronteras del crecimiento',
    subtitle: 'Romer: por integrar la innovación tecnológica al análisis macroeconómico de largo plazo. Nordhaus: por integrar el cambio climático.',
    impact: 'Romer: las ideas son los nuevos átomos. Nordhaus: ignorar el clima nos costará todo lo demás.',
    status: 'pending',
  },
  {
    id: 'econ-09-acemoglu',
    year: 2024,
    laureates: ['Daron Acemoglu', 'Simon Johnson', 'James Robinson'],
    block: 'macro-crecimiento',
    title: 'Instituciones: por qué las naciones fracasan',
    subtitle: 'Por estudios sobre cómo las instituciones se forman y afectan la prosperidad.',
    impact: 'Nogales (Arizona) vs Nogales (Sonora): misma gente, misma geografía, riqueza opuesta. La respuesta es institucional.',
    status: 'live',
    classId: 'econ-09-acemoglu',
  },

  // ═══════════════════════ FINANZAS ═══════════════════════
  {
    id: 'econ-1981-tobin',
    year: 1981,
    laureates: ['James Tobin'],
    block: 'finanzas',
    title: 'La Q de Tobin y la teoría del portafolio',
    subtitle: 'Por su análisis de los mercados financieros y sus relaciones con las decisiones de gasto.',
    impact: 'Por qué las empresas invierten cuando lo hacen. Y por qué tu portafolio debería ser diversificado.',
    status: 'pending',
  },
  {
    id: 'econ-1985-modigliani',
    year: 1985,
    laureates: ['Franco Modigliani'],
    block: 'finanzas',
    title: 'Por qué ahorramos cuando ahorramos',
    subtitle: 'Por sus análisis pioneros del ahorro y los mercados financieros.',
    impact: 'El "life-cycle hypothesis" explica por qué tu papá ahorra y tú no. Modigliani-Miller explica por qué no importa cómo te financies.',
    status: 'pending',
  },
  {
    id: 'econ-13-markowitz-sharpe',
    year: 1990,
    laureates: ['Harry Markowitz', 'Merton Miller', 'William Sharpe'],
    block: 'finanzas',
    title: 'Cómo construir un portafolio óptimo',
    subtitle: 'Por aportes pioneros a la teoría de las finanzas: portafolios, costo de capital y precios de activos.',
    impact: 'La razón por la cual existe el ETF. Diversificas o pierdes. Sharpe ratio: la métrica universal.',
    status: 'live',
    classId: 'econ-13-markowitz-sharpe',
  },
  {
    id: 'econ-1997-merton-scholes',
    year: 1997,
    laureates: ['Robert Merton', 'Myron Scholes'],
    block: 'finanzas',
    title: 'Black-Scholes y la matemática de los derivados',
    subtitle: 'Por un nuevo método para determinar el valor de los derivados.',
    impact: 'La ecuación que mueve trillones de dólares al día. Y por qué casi quiebra al mundo en 1998.',
    status: 'pending',
  },
  {
    id: 'econ-2013-fama-hansen-shiller',
    year: 2013,
    laureates: ['Eugene Fama', 'Lars Peter Hansen', 'Robert Shiller'],
    block: 'finanzas',
    title: 'Mercados eficientes y burbujas',
    subtitle: 'Por análisis empíricos de los precios de activos.',
    impact: 'Fama: no le ganas al mercado. Shiller: sí, porque los mercados se vuelven locos. Premio compartido entre dos opuestos.',
    status: 'pending',
  },
  {
    id: 'econ-2022-bernanke-diamond-dybvig',
    year: 2022,
    laureates: ['Ben Bernanke', 'Douglas Diamond', 'Philip Dybvig'],
    block: 'finanzas',
    title: 'Corridas bancarias y crisis financieras',
    subtitle: 'Por investigación sobre bancos y crisis financieras.',
    impact: 'Por qué los bancos son frágiles por diseño, y por qué cuando uno cae, todos caen.',
    status: 'pending',
  },

  // ═══════════════════════ DINERO / INFLACIÓN ═══════════════════════
  {
    id: 'econ-1974-myrdal-hayek',
    year: 1974,
    laureates: ['Gunnar Myrdal', 'Friedrich Hayek'],
    block: 'dinero-inflacion',
    title: 'Orden espontáneo vs planificación',
    subtitle: 'Por trabajos pioneros sobre fluctuaciones monetarias y económicas, y análisis institucional.',
    impact: 'Hayek: el mercado es información distribuida que ningún burócrata puede centralizar. Myrdal: pero algunas cosas sí necesitan política pública.',
    status: 'pending',
  },
  {
    id: 'econ-10-friedman',
    year: 1976,
    laureates: ['Milton Friedman'],
    block: 'dinero-inflacion',
    title: 'Monetarismo: la inflación siempre es monetaria',
    subtitle: 'Por sus logros en análisis del consumo, historia monetaria y demostración de la complejidad de la política de estabilización.',
    impact: 'La frase más famosa de la economía: "la inflación siempre y en todo lugar es un fenómeno monetario."',
    status: 'live',
    classId: 'econ-10-friedman',
  },
  {
    id: 'econ-1999-mundell',
    year: 1999,
    laureates: ['Robert Mundell'],
    block: 'dinero-inflacion',
    title: 'Zonas monetarias óptimas: el peso, el euro, el dólar',
    subtitle: 'Por su análisis de la política monetaria y fiscal bajo distintos regímenes cambiarios.',
    impact: 'La razón teórica de por qué existe el euro. Y de por qué Argentina cae cada cierto tiempo en el peso fijo.',
    status: 'pending',
  },

  // ═══════════════════════ DESARROLLO / POBREZA ═══════════════════════
  {
    id: 'econ-1979-schultz-lewis',
    year: 1979,
    laureates: ['Theodore Schultz', 'Arthur Lewis'],
    block: 'desarrollo-pobreza',
    title: 'Por qué los países pobres son pobres',
    subtitle: 'Por su investigación pionera sobre desarrollo económico, especialmente en países en desarrollo.',
    impact: 'Schultz: el capital humano vale más que el físico. Lewis: el modelo dual rural-urbano explica la migración.',
    status: 'pending',
  },
  {
    id: 'econ-12-sen',
    year: 1998,
    laureates: ['Amartya Sen'],
    block: 'desarrollo-pobreza',
    title: 'Pobreza, hambrunas y capabilities',
    subtitle: 'Por sus contribuciones a la economía del bienestar.',
    impact: 'Las hambrunas no son por falta de comida — son por falta de derechos. Cambia cómo medimos pobreza.',
    status: 'live',
    classId: 'econ-12-sen',
  },
  {
    id: 'econ-2015-deaton',
    year: 2015,
    laureates: ['Angus Deaton'],
    block: 'desarrollo-pobreza',
    title: 'Consumo, pobreza y el Gran Escape',
    subtitle: 'Por su análisis del consumo, la pobreza y el bienestar.',
    impact: 'La humanidad escapó de la pobreza en los últimos 250 años. Cómo se midió y qué falta.',
    status: 'pending',
  },
  {
    id: 'econ-2019-duflo-banerjee-kremer',
    year: 2019,
    laureates: ['Esther Duflo', 'Abhijit Banerjee', 'Michael Kremer'],
    block: 'desarrollo-pobreza',
    title: 'RCTs: lo que sí funciona contra la pobreza',
    subtitle: 'Por su enfoque experimental para aliviar la pobreza global.',
    impact: 'Aplicaron el método del laboratorio médico a las políticas sociales. PROSPERA México fue referencia mundial.',
    status: 'pending',
  },

  // ═══════════════════════ CAPITAL HUMANO ═══════════════════════
  {
    id: 'econ-1992-becker',
    year: 1992,
    laureates: ['Gary Becker'],
    block: 'capital-humano',
    title: 'La economía del comportamiento humano',
    subtitle: 'Por haber extendido el dominio del análisis microeconómico a un amplio rango de comportamiento humano.',
    impact: 'Aplicó la economía a la familia, la discriminación, el crimen y la educación. Polémico y fundacional.',
    status: 'pending',
  },
  {
    id: 'econ-2000-heckman-mcfadden',
    year: 2000,
    laureates: ['James Heckman', 'Daniel McFadden'],
    block: 'capital-humano',
    title: 'Microeconometría: estudiando individuos',
    subtitle: 'Por el desarrollo de teoría y métodos para analizar muestras seleccionadas (Heckman) y elecciones discretas (McFadden).',
    impact: 'El "sesgo de selección" — por qué los estudios de salarios mal hechos te mienten siempre.',
    status: 'pending',
  },
  {
    id: 'econ-2010-diamond-mortensen-pissarides',
    year: 2010,
    laureates: ['Peter Diamond', 'Dale Mortensen', 'Christopher Pissarides'],
    block: 'capital-humano',
    title: 'Por qué hay vacantes y desempleados al mismo tiempo',
    subtitle: 'Por su análisis de los mercados con fricciones de búsqueda.',
    impact: 'La razón por la cual el desempleo nunca llega a 0%, incluso en bonanza.',
    status: 'pending',
  },
  {
    id: 'econ-2021-card-angrist-imbens',
    year: 2021,
    laureates: ['David Card', 'Joshua Angrist', 'Guido Imbens'],
    block: 'capital-humano',
    title: 'Experimentos naturales: cómo encontramos causas',
    subtitle: 'Card: contribuciones empíricas a la economía laboral. Angrist, Imbens: contribuciones metodológicas a inferencia causal.',
    impact: 'Card demostró que subir el salario mínimo NO destruye empleo. Lo mostró sin experimento, con un experimento natural.',
    status: 'pending',
  },
  {
    id: 'econ-2023-goldin',
    year: 2023,
    laureates: ['Claudia Goldin'],
    block: 'capital-humano',
    title: 'Por qué las mujeres ganan menos',
    subtitle: 'Por haber promovido nuestro entendimiento del mercado laboral femenino.',
    impact: 'La brecha no es discriminación pura: es la "penalización por maternidad" en trabajos que premian la disponibilidad.',
    status: 'pending',
  },

  // ═══════════════════════ BEHAVIORAL ═══════════════════════
  {
    id: 'econ-1978-simon',
    year: 1978,
    laureates: ['Herbert Simon'],
    block: 'behavioral',
    title: 'Racionalidad acotada',
    subtitle: 'Por su investigación pionera sobre el proceso de toma de decisiones dentro de las organizaciones económicas.',
    impact: 'No somos optimizadores — somos "satisficers". El primer disparo a la racionalidad pura.',
    status: 'pending',
  },
  {
    id: 'econ-08-kahneman',
    year: 2002,
    laureates: ['Daniel Kahneman', 'Vernon Smith'],
    block: 'behavioral',
    title: 'Sesgos y experimentos en el laboratorio',
    subtitle: 'Kahneman: integrar la psicología en la economía. Smith: la economía experimental como herramienta.',
    impact: 'Kahneman: somos sistemáticamente irracionales. Smith: pero los mercados, en agregado, sí convergen al equilibrio.',
    status: 'live',
    classId: 'econ-08-kahneman',
  },
  {
    id: 'econ-14-thaler',
    year: 2017,
    laureates: ['Richard Thaler'],
    block: 'behavioral',
    title: 'Nudges: empujones que cambian decisiones',
    subtitle: 'Por sus contribuciones a la economía del comportamiento.',
    impact: 'Cómo el default de "donar tus órganos sí/no" cambia tasa de donación 80%. Política pública conductual.',
    status: 'live',
    classId: 'econ-14-thaler',
  },

  // ═══════════════════════ HISTORIA / GEOGRAFÍA ═══════════════════════
  {
    id: 'econ-1993-fogel-north',
    year: 1993,
    laureates: ['Robert Fogel', 'Douglass North'],
    block: 'historia-geografia',
    title: 'Cliometría: medir la historia',
    subtitle: 'Por haber renovado la investigación histórica económica al aplicar teoría e historia cuantitativa.',
    impact: 'Fogel: el ferrocarril NO fue tan importante para EE.UU. North: las instituciones lo son TODO.',
    status: 'pending',
  },
  {
    id: 'econ-2008-krugman',
    year: 2008,
    laureates: ['Paul Krugman'],
    block: 'historia-geografia',
    title: 'Geografía económica y comercio',
    subtitle: 'Por su análisis de patrones de comercio y de la localización de la actividad económica.',
    impact: 'Por qué ciudades específicas concentran industrias específicas. Detroit, Silicon Valley, Bangalore.',
    status: 'pending',
  },

  // ═══════════════════════ MÉTODOS ═══════════════════════
  {
    id: 'econ-1969-frisch-tinbergen',
    year: 1969,
    laureates: ['Ragnar Frisch', 'Jan Tinbergen'],
    block: 'metodos',
    title: 'Econometría: la fundación',
    subtitle: 'El primer Nobel de economía. Por desarrollar y aplicar modelos dinámicos al análisis de procesos económicos.',
    impact: 'Inventaron la palabra "econometría". Tinbergen tenía un hermano también Nobel — pero en otra disciplina.',
    status: 'pending',
  },
  {
    id: 'econ-1973-leontief',
    year: 1973,
    laureates: ['Wassily Leontief'],
    block: 'metodos',
    title: 'Input-output: la economía como red',
    subtitle: 'Por el desarrollo del método de input-output y sus aplicaciones a problemas económicos importantes.',
    impact: 'La economía es una red de proveedores. Si quitas el acero, ¿qué deja de existir? La tabla input-output te dice.',
    status: 'pending',
  },
  {
    id: 'econ-1975-kantorovich-koopmans',
    year: 1975,
    laureates: ['Leonid Kantorovich', 'Tjalling Koopmans'],
    block: 'metodos',
    title: 'Programación lineal y asignación óptima',
    subtitle: 'Por sus contribuciones a la teoría de la asignación óptima de recursos.',
    impact: 'Cómo la URSS planificaba con matemáticas, y por qué EE.UU. usa las mismas para Amazon y FedEx.',
    status: 'pending',
  },
  {
    id: 'econ-1980-klein',
    year: 1980,
    laureates: ['Lawrence Klein'],
    block: 'metodos',
    title: 'Modelos macroeconómicos a gran escala',
    subtitle: 'Por la creación de modelos econométricos y su aplicación al análisis de fluctuaciones económicas y políticas económicas.',
    impact: 'Construyó los primeros modelos macroeconométricos a gran escala. Hoy son base de Banxico, BCE, Fed.',
    status: 'pending',
  },
  {
    id: 'econ-1984-stone',
    year: 1984,
    laureates: ['Richard Stone'],
    block: 'metodos',
    title: 'Cuentas nacionales: cómo contamos un país',
    subtitle: 'Por haber hecho contribuciones fundamentales al desarrollo de sistemas de cuentas nacionales.',
    impact: 'La estructura del PIB que usamos hoy en todos los países. Sin él no habría comparabilidad internacional.',
    status: 'pending',
  },
  {
    id: 'econ-1989-haavelmo',
    year: 1989,
    laureates: ['Trygve Haavelmo'],
    block: 'metodos',
    title: 'Probabilidad en econometría',
    subtitle: 'Por su clarificación de los fundamentos probabilísticos de la econometría.',
    impact: 'Antes de él, la econometría era ajustar curvas. Después: modelar incertidumbre como ciencia.',
    status: 'pending',
  },
  {
    id: 'econ-2003-engle-granger',
    year: 2003,
    laureates: ['Robert Engle', 'Clive Granger'],
    block: 'metodos',
    title: 'Series temporales: ARCH y cointegración',
    subtitle: 'Engle: análisis de series temporales con volatilidad cambiante (ARCH). Granger: con tendencias comunes (cointegración).',
    impact: 'ARCH explica por qué los mercados son volátiles a rachas. Cointegración: cuándo dos series "se hablan".',
    status: 'pending',
  },
  {
    id: 'econ-2011-sargent-sims',
    year: 2011,
    laureates: ['Thomas Sargent', 'Christopher Sims'],
    block: 'metodos',
    title: 'Causa y efecto en la macroeconomía',
    subtitle: 'Por su investigación empírica sobre causa y efecto en la macroeconomía.',
    impact: 'Cuando Banxico sube la tasa, ¿qué pasa con la inflación tres meses después? Ellos crearon el método para responder.',
    status: 'pending',
  },

  // ═══════════════════════ OTROS ═══════════════════════
  {
    id: 'econ-1977-ohlin-meade',
    year: 1977,
    laureates: ['Bertil Ohlin', 'James Meade'],
    block: 'otros',
    title: 'Comercio internacional clásico',
    subtitle: 'Por sus contribuciones pioneras a la teoría del comercio internacional y movimientos internacionales de capital.',
    impact: 'Heckscher-Ohlin: cada país exporta lo que tiene en abundancia. Por qué México exporta mano de obra y EE.UU. capital.',
    status: 'pending',
  },
  {
    id: 'econ-1982-stigler',
    year: 1982,
    laureates: ['George Stigler'],
    block: 'otros',
    title: 'Teoría de la regulación',
    subtitle: 'Por sus estudios sobre estructuras industriales, funcionamiento de mercados y causas/efectos de la regulación pública.',
    impact: 'La "captura regulatoria": los regulados terminan controlando a sus reguladores. Por qué la CRE/CFE de tu país no funciona.',
    status: 'pending',
  },
  {
    id: 'econ-1986-buchanan',
    year: 1986,
    laureates: ['James Buchanan'],
    block: 'otros',
    title: 'Public choice: los políticos no son ángeles',
    subtitle: 'Por su desarrollo de las bases contractual y constitucional de la teoría de la toma de decisiones económicas y políticas.',
    impact: 'Aplicó la lógica del mercado al gobierno. Los políticos maximizan votos, no bienestar. Cambia cómo diseñas instituciones.',
    status: 'pending',
  },
];

/**
 * Cuenta cuántos premios están en cada estado.
 */
export function getCatalogStats() {
  const total = NOBEL_CATALOG.length;
  const live = NOBEL_CATALOG.filter(n => n.status === 'live').length;
  const pending = total - live;
  return { total, live, pending };
}

/**
 * Agrupa los premios por bloque, en el orden definido en BLOCKS.
 */
export function getCatalogByBlock(): Array<{ block: BlockMeta; entries: NobelLaureate[] }> {
  const ordered = [...BLOCKS].sort((a, b) => a.order - b.order);
  return ordered.map(block => ({
    block,
    entries: NOBEL_CATALOG
      .filter(n => n.block === block.id)
      .sort((a, b) => a.year - b.year),
  }));
}
