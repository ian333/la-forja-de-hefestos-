/**
 * relaciones.ts — el GRAFO de los 56 Nobel de Economía.
 *
 * Tesis: la economía no son 56 islas. Es un solo cuerpo de conocimiento donde
 * cada idea lleva a otra. Aquí viven:
 *
 *   - RELACIONES: aristas no dirigidas {a, b, por} — por qué dos premios se
 *     tocan. Curado a mano (la coherencia global importa: que A↔B tenga sentido
 *     en ambos sentidos). El grafo está CONECTADO: desde cualquiera llegas a
 *     cualquiera.
 *   - RECORRIDO: un orden narrativo por los 57 nodos — "échatelos de corrido,
 *     una lleva a otra". De cómo medimos → mercados → juegos → conducta → macro
 *     → trabajo → desarrollo → instituciones → dinero → finanzas.
 *
 * Los ids son los del catálogo (nobel-catalog.ts). EconomiaPortal muestra las
 * conexiones de cada premio EN su propia card (chips "↔ conecta con") que saltan
 * a la card del premio conectado, en la misma página.
 */

export interface Relacion {
  a: string;
  b: string;
  /** Por qué se conectan, en una línea. */
  por: string;
}

export const RELACIONES: Relacion[] = [
  // ── Métodos / fundaciones ─────────────────────────────────────────────
  { a: 'econ-1969-frisch-tinbergen', b: 'econ-1989-haavelmo', por: 'Fundaron la econometría; Haavelmo le puso base de probabilidad.' },
  { a: 'econ-1989-haavelmo', b: 'econ-1980-klein', por: 'De la teoría econométrica a los primeros grandes modelos macro.' },
  { a: 'econ-1980-klein', b: 'econ-2011-sargent-sims', por: 'Modelos macro gigantes vs. la crítica y los métodos VAR para medir causa y efecto.' },
  { a: 'econ-2011-sargent-sims', b: 'econ-2003-engle-granger', por: 'Series de tiempo en macro: VAR (Sims) y volatilidad/cointegración (Engle-Granger).' },
  { a: 'econ-1989-haavelmo', b: 'econ-2003-engle-granger', por: 'Probabilidad en econometría → modelar series de tiempo.' },
  { a: 'econ-1969-frisch-tinbergen', b: 'econ-1973-leontief', por: 'La economía como sistema de ecuaciones: ciclos (Frisch) y la red insumo-producto (Leontief).' },
  { a: 'econ-1973-leontief', b: 'econ-1975-kantorovich-koopmans', por: 'Insumo-producto y programación lineal: resolver la economía como un sistema a optimizar.' },
  { a: 'econ-1975-kantorovich-koopmans', b: 'econ-1970-samuelson', por: 'Optimización y matemáticas: convertir la economía en ciencia exacta.' },
  { a: 'econ-1973-leontief', b: 'econ-1984-stone', por: 'El mapa numérico de un país: insumo-producto y cuentas nacionales.' },
  { a: 'econ-1984-stone', b: 'econ-1971-kuznets', por: 'El PIB (Kuznets) y el sistema de cuentas nacionales que usamos hoy (Stone).' },
  { a: 'econ-1969-frisch-tinbergen', b: 'econ-1971-kuznets', por: 'Medir la economía: modelos dinámicos (Frisch) y la invención del PIB (Kuznets).' },

  // ── Mercados que funcionan ────────────────────────────────────────────
  { a: 'econ-1970-samuelson', b: 'econ-1972-hicks-arrow', por: 'Padres de la economía matemática moderna y del equilibrio.' },
  { a: 'econ-1972-hicks-arrow', b: 'econ-1983-debreu', por: 'El equilibrio general formalizado: el modelo Arrow-Debreu.' },
  { a: 'econ-1983-debreu', b: 'econ-1970-samuelson', por: 'La teoría del valor con todo el rigor matemático.' },
  { a: 'econ-1988-allais', b: 'econ-08-kahneman', por: 'La paradoja de Allais rompió la utilidad esperada; Kahneman construyó el reemplazo.' },
  { a: 'econ-1988-allais', b: 'econ-1970-samuelson', por: 'Samuelson construyó la teoría de la decisión; Allais halló su primera grieta.' },
  { a: 'econ-1972-hicks-arrow', b: 'econ-06-nash', por: 'Equilibrio en mercados (Arrow) y equilibrio en juegos (Nash).' },
  { a: 'econ-1972-hicks-arrow', b: 'econ-2007-mechanism-design', por: 'El teorema de imposibilidad de Arrow es la raíz del diseño de mecanismos y la elección social.' },

  // ── Mercados que fallan ───────────────────────────────────────────────
  { a: 'econ-01-limones', b: 'econ-03-spence', por: 'Mismo premio 2001: Akerlof ve el problema (limones), Spence la salida (señales).' },
  { a: 'econ-03-spence', b: 'econ-1992-becker', por: 'El título como señal (Spence) vs. el título como inversión en capital humano (Becker).' },
  { a: 'econ-01-limones', b: 'econ-17-mirrlees-vickrey', por: 'Si no ves la calidad o el esfuerzo, diseñas incentivos para que se revelen.' },
  { a: 'econ-01-limones', b: 'econ-2013-fama-hansen-shiller', por: 'Información: cuando falta (limones) o cuando el precio ya la trae (mercados eficientes).' },
  { a: 'econ-02-coase', b: 'econ-04-hart-holmstrom', por: 'Coase pregunta por qué existe la empresa; Hart y Holmström la responden con contratos.' },
  { a: 'econ-02-coase', b: 'econ-15-ostrom', por: 'Costos de transacción y gobernanza: la empresa (Coase) y los comunes (Ostrom/Williamson).' },
  { a: 'econ-02-coase', b: 'econ-05-tirole', por: 'Estructura de empresa y de mercado: por qué hay jefes y por qué hay plataformas.' },
  { a: 'econ-05-tirole', b: 'econ-1982-stigler', por: 'Regulación y poder de mercado: la captura regulatoria (Stigler) → regular plataformas (Tirole).' },
  { a: 'econ-04-hart-holmstrom', b: 'econ-17-mirrlees-vickrey', por: 'Contratos e incentivos cuando no observas todo.' },
  { a: 'econ-17-mirrlees-vickrey', b: 'econ-2007-mechanism-design', por: 'Subastas e impuestos óptimos: mecanismos bajo información asimétrica.' },
  { a: 'econ-17-mirrlees-vickrey', b: 'econ-2020-milgrom-wilson', por: 'La subasta de Vickrey → los formatos que vendieron el espectro 5G.' },

  // ── Juegos y mecanismos ───────────────────────────────────────────────
  { a: 'econ-06-nash', b: 'econ-2005-aumann-schelling', por: 'Nash define el equilibrio; Schelling lo usa para la guerra fría y los puntos focales.' },
  { a: 'econ-06-nash', b: 'econ-2007-mechanism-design', por: 'Si conoces los equilibrios, diseñas las reglas para obtener el que quieres.' },
  { a: 'econ-2007-mechanism-design', b: 'econ-11-roth-shapley', por: 'Diseñar mercados sin precio (matching) es diseño de mecanismos aplicado.' },
  { a: 'econ-11-roth-shapley', b: 'econ-2020-milgrom-wilson', por: 'Asignar sin precio de mercado: matching (Roth) y subastas (Milgrom).' },
  { a: 'econ-2007-mechanism-design', b: 'econ-2020-milgrom-wilson', por: 'Diseñar las reglas → las subastas que pagan el internet.' },
  { a: 'econ-2005-aumann-schelling', b: 'econ-10-friedman', por: 'Estrategia y credibilidad: la disuasión (Schelling) y la credibilidad monetaria.' },
  { a: 'econ-06-nash', b: 'econ-08-kahneman', por: 'El equilibrio supone jugadores racionales; Kahneman muestra que no lo somos.' },
  { a: 'econ-1982-stigler', b: 'econ-06-nash', por: 'Las reglas del juego: quién las pone (regulación) y cómo se juega (estrategia).' },

  // ── Comportamiento ────────────────────────────────────────────────────
  { a: 'econ-1978-simon', b: 'econ-08-kahneman', por: 'Racionalidad acotada (Simon) es el abuelo de los sesgos (Kahneman).' },
  { a: 'econ-08-kahneman', b: 'econ-14-thaler', por: 'Sesgos (Kahneman) → política conductual y nudges (Thaler).' },
  { a: 'econ-1978-simon', b: 'econ-06-nash', por: '¿Optimizamos de verdad? Simon dice que no; el equilibrio de Nash supone que sí.' },
  { a: 'econ-14-thaler', b: 'econ-2019-duflo-banerjee-kremer', por: 'Conducta y política pública probada con experimentos.' },

  // ── Macro y crecimiento ───────────────────────────────────────────────
  { a: 'econ-07-solow', b: 'econ-2018-romer-nordhaus', por: 'Solow deja el crecimiento como "residuo" tecnológico; Romer endogeniza las ideas.' },
  { a: 'econ-07-solow', b: 'econ-16-lucas', por: 'Crecimiento y ciclos: por qué unos países crecen y cómo reacciona la macro.' },
  { a: 'econ-16-lucas', b: 'econ-10-friedman', por: 'Friedman: la política sorprende a corto plazo; Lucas: si la prevés, deja de funcionar.' },
  { a: 'econ-16-lucas', b: 'econ-2004-kydland-prescott', por: 'Expectativas racionales → consistencia temporal → bancos centrales autónomos.' },
  { a: 'econ-10-friedman', b: 'econ-2006-phelps', por: 'Ambos matan la curva de Phillips de largo plazo: hay una tasa natural de desempleo.' },
  { a: 'econ-2006-phelps', b: 'econ-2010-diamond-mortensen-pissarides', por: 'La tasa natural de desempleo, explicada por fricciones de búsqueda.' },
  { a: 'econ-07-solow', b: 'econ-09-acemoglu', por: 'El crecimiento necesita algo más que capital: tecnología (Solow) e instituciones (Acemoglu).' },
  { a: 'econ-2018-romer-nordhaus', b: 'econ-2019-duflo-banerjee-kremer', por: 'Ideas y clima a gran escala vs. qué funciona, medido con experimentos.' },
  { a: 'econ-2004-kydland-prescott', b: 'econ-2011-sargent-sims', por: 'Macro dinámica: consistencia temporal y la medición empírica de causa-efecto.' },
  { a: 'econ-1970-samuelson', b: 'econ-10-friedman', por: 'El gran debate del siglo XX: síntesis keynesiana (Samuelson) vs. monetarismo (Friedman).' },
  { a: 'econ-1970-samuelson', b: 'econ-07-solow', por: 'MIT, crecimiento y las matemáticas que volvieron ciencia a la macro.' },

  // ── Dinero ────────────────────────────────────────────────────────────
  { a: 'econ-10-friedman', b: 'econ-1999-mundell', por: 'Política monetaria y tipo de cambio: cuándo imprimir y cuándo fijar la moneda.' },
  { a: 'econ-1974-myrdal-hayek', b: 'econ-10-friedman', por: 'El mercado como información (Hayek) y el dinero como su variable clave (Friedman).' },
  { a: 'econ-1974-myrdal-hayek', b: 'econ-1986-buchanan', por: 'Límites del Estado: orden espontáneo (Hayek) y los políticos no son ángeles (Buchanan).' },
  { a: 'econ-1999-mundell', b: 'econ-1981-tobin', por: 'Mercados financieros, dinero y tipo de cambio.' },
  { a: 'econ-1982-stigler', b: 'econ-1986-buchanan', por: 'El Estado capturado: regulación (Stigler) y elección pública (Buchanan).' },

  // ── Finanzas ──────────────────────────────────────────────────────────
  { a: 'econ-13-markowitz-sharpe', b: 'econ-1997-merton-scholes', por: 'Diversificación y CAPM → ponerle precio a los derivados con la misma matemática del riesgo.' },
  { a: 'econ-13-markowitz-sharpe', b: 'econ-1981-tobin', por: 'Portafolios óptimos y la Q de Tobin: cómo decides en qué invertir.' },
  { a: 'econ-1981-tobin', b: 'econ-1985-modigliani', por: 'Ahorro, inversión y mercados financieros.' },
  { a: 'econ-1997-merton-scholes', b: 'econ-2022-bernanke-diamond-dybvig', por: 'Modelos financieros y su fragilidad: pricing vs. corridas bancarias.' },
  { a: 'econ-2013-fama-hansen-shiller', b: 'econ-08-kahneman', por: 'Mercados eficientes (Fama) vs. irracionalidad sistemática (Shiller/Kahneman).' },
  { a: 'econ-2013-fama-hansen-shiller', b: 'econ-13-markowitz-sharpe', por: 'Precios de activos: cómo se forman y si le puedes ganar al mercado.' },
  { a: 'econ-2022-bernanke-diamond-dybvig', b: 'econ-10-friedman', por: 'Crisis: la Fed que la causó (Friedman) y los bancos frágiles por diseño (Bernanke).' },
  { a: 'econ-1985-modigliani', b: 'econ-1997-merton-scholes', por: 'Finanzas: estructura de capital (Modigliani) y valuación de opciones.' },

  // ── Desarrollo y pobreza ──────────────────────────────────────────────
  { a: 'econ-12-sen', b: 'econ-1979-schultz-lewis', por: 'Desarrollo: capital humano y migración (Schultz/Lewis) → capacidades y libertades (Sen).' },
  { a: 'econ-12-sen', b: 'econ-2015-deaton', por: 'Medir la pobreza: el ingreso no basta (Sen) y cómo medir consumo y bienestar (Deaton).' },
  { a: 'econ-2015-deaton', b: 'econ-2019-duflo-banerjee-kremer', por: 'Pobreza: medirla bien (Deaton) y experimentar qué la combate (Duflo).' },
  { a: 'econ-12-sen', b: 'econ-09-acemoglu', por: '¿Por qué hay pobreza? Capacidades (Sen) vs. instituciones (Acemoglu).' },
  { a: 'econ-2019-duflo-banerjee-kremer', b: 'econ-2021-card-angrist-imbens', por: 'Causalidad: RCTs (Duflo) y experimentos naturales (Card/Angrist).' },
  { a: 'econ-12-sen', b: 'econ-1971-kuznets', por: 'Medir un país: el PIB (Kuznets) y por qué no mide el bienestar (Sen).' },

  // ── Capital humano y trabajo ──────────────────────────────────────────
  { a: 'econ-1992-becker', b: 'econ-2000-heckman-mcfadden', por: 'Becker abre la micro del comportamiento; Heckman y McFadden dan los métodos para medirla.' },
  { a: 'econ-1992-becker', b: 'econ-2021-card-angrist-imbens', por: 'Capital humano y salarios: la teoría (Becker) y los datos que la prueban (Card).' },
  { a: 'econ-1992-becker', b: 'econ-2023-goldin', por: 'Familia, trabajo y discriminación (Becker) → por qué las mujeres ganan menos (Goldin).' },
  { a: 'econ-2021-card-angrist-imbens', b: 'econ-2023-goldin', por: 'Economía laboral con datos reales: salario mínimo (Card) y brecha de género (Goldin).' },
  { a: 'econ-2010-diamond-mortensen-pissarides', b: 'econ-2021-card-angrist-imbens', por: 'Mercado laboral: fricciones de búsqueda y su medición empírica.' },
  { a: 'econ-2000-heckman-mcfadden', b: 'econ-2021-card-angrist-imbens', por: 'Microeconometría: sesgo de selección (Heckman) → inferencia causal (Card).' },

  // ── Instituciones / historia / comercio ───────────────────────────────
  { a: 'econ-09-acemoglu', b: 'econ-1993-fogel-north', por: 'Las instituciones explican la riqueza: North las trae a la historia, Acemoglu las mide.' },
  { a: 'econ-1993-fogel-north', b: 'econ-02-coase', por: 'Instituciones y costos de transacción: las reglas que hacen funcionar (o no) a los mercados.' },
  { a: 'econ-1977-ohlin-meade', b: 'econ-2008-krugman', por: 'Comercio: ventaja comparativa clásica (Ohlin) → nueva geografía económica (Krugman).' },
  { a: 'econ-2008-krugman', b: 'econ-09-acemoglu', por: 'Por qué la actividad y la riqueza se concentran donde se concentran.' },
];

/**
 * RECORRIDO — el orden narrativo para echarte los 57 de corrido.
 * Arco: cómo medimos → mercados funcionan → fallan → juegos → conducta →
 * macro → trabajo → desarrollo → instituciones → dinero → finanzas.
 */
export const RECORRIDO: string[] = [
  'econ-1969-frisch-tinbergen',
  'econ-1989-haavelmo',
  'econ-1980-klein',
  'econ-2011-sargent-sims',
  'econ-2003-engle-granger',
  'econ-1973-leontief',
  'econ-1975-kantorovich-koopmans',
  'econ-1984-stone',
  'econ-1971-kuznets',
  'econ-1970-samuelson',
  'econ-1972-hicks-arrow',
  'econ-1983-debreu',
  'econ-1988-allais',
  'econ-01-limones',
  'econ-03-spence',
  'econ-17-mirrlees-vickrey',
  'econ-04-hart-holmstrom',
  'econ-02-coase',
  'econ-15-ostrom',
  'econ-05-tirole',
  'econ-1982-stigler',
  'econ-06-nash',
  'econ-2005-aumann-schelling',
  'econ-2007-mechanism-design',
  'econ-11-roth-shapley',
  'econ-2020-milgrom-wilson',
  'econ-1978-simon',
  'econ-08-kahneman',
  'econ-14-thaler',
  'econ-07-solow',
  'econ-2018-romer-nordhaus',
  'econ-16-lucas',
  'econ-2004-kydland-prescott',
  'econ-2006-phelps',
  'econ-2010-diamond-mortensen-pissarides',
  'econ-1992-becker',
  'econ-2000-heckman-mcfadden',
  'econ-2021-card-angrist-imbens',
  'econ-2023-goldin',
  'econ-12-sen',
  'econ-1979-schultz-lewis',
  'econ-2015-deaton',
  'econ-2019-duflo-banerjee-kremer',
  'econ-09-acemoglu',
  'econ-1993-fogel-north',
  'econ-2008-krugman',
  'econ-1977-ohlin-meade',
  'econ-10-friedman',
  'econ-1974-myrdal-hayek',
  'econ-1999-mundell',
  'econ-1986-buchanan',
  'econ-1981-tobin',
  'econ-1985-modigliani',
  'econ-13-markowitz-sharpe',
  'econ-1997-merton-scholes',
  'econ-2013-fama-hansen-shiller',
  'econ-2022-bernanke-diamond-dybvig',
];

/** Aristas que tocan a un nodo (no dirigidas). */
export function relacionesDe(id: string): Relacion[] {
  return RELACIONES.filter(r => r.a === id || r.b === id);
}

/** El vecino del otro lado de una arista. */
export function otroLado(r: Relacion, id: string): string {
  return r.a === id ? r.b : r.a;
}
