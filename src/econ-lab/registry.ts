/**
 * Registro de ramas y módulos del pilar de Economía (EconLab).
 *
 * Mismo contrato que MathLab/PhysicsLab. Cada módulo nace como `planned`
 * con un roadmap claro; sube a `live` cuando el simulador interactivo está
 * implementado, verificado visualmente y conectado a la(s) masterclass(es)
 * narrada(s) que lo enmarcan.
 *
 * Convención: cada módulo está pensado para ser usado DESPUÉS de la
 * masterclass narrada correspondiente, como sandbox para experimentar con
 * sus parámetros. El alumno mira la clase, entiende la idea, y aquí la
 * pone a prueba con sus propios números.
 *
 * A diferencia de Math/Physics, la mayoría de simuladores de Economía son
 * 2D (sliders + gráficas SVG/Canvas), no R3F 3D. Eso es deliberado y
 * pedagógico: en economía los conceptos viven en plano (oferta/demanda,
 * Phillips curve, frontera eficiente) y no se ganaría nada con 3D forzado.
 */

import { lazy } from 'react';
import type { LabBranch } from './types';

// Live modules (the ones already implemented)
const MarketForLemons = lazy(() => import('./modules/info/MarketForLemons'));

export const BRANCHES: LabBranch[] = [
  // ═══════════════════════ 1 · MERCADOS E INFORMACIÓN ═══════════════════════
  {
    id: 'info',
    name: 'Mercados e información',
    icon: '◐',
    accent: '#F472B6',
    blurb: 'Akerlof, Spence, Stiglitz, Coase, Hart, Holmström — cuando la información no es simétrica.',
    modules: [
      {
        id: 'lemons',
        name: 'Mercado de limones (Akerlof)',
        status: 'live',
        blurb: 'Sliders: % cherries, precio ofrecido, dispersión de calidad. Observa el unraveling en tiempo real.',
        childHint: 'Baja el precio que ofreces y mira cómo los carros buenos se van del mercado, uno por uno.',
        researcherHint: 'Equilibrio de pooling vs separating. Función de oferta por tipo. Welfare loss numérico.',
        component: MarketForLemons,
      },
      {
        id: 'spence-signaling',
        name: 'Señalización de Spence',
        status: 'planned',
        blurb: 'La escalera de educación como costly signal. Equilibrios pooling vs separating.',
        roadmap: [
          '2 tipos de trabajador (alto/bajo) con costo de educación distinto',
          'Slider: salario ofrecido por nivel educativo',
          'Identificar zona donde existe equilibrio separating',
        ],
      },
      {
        id: 'screening',
        name: 'Screening de Rothschild-Stiglitz',
        status: 'planned',
        blurb: 'Seguros con franquicia: cómo separar tipos de riesgo sin observarlos.',
        roadmap: [
          'Menú de contratos (prima, cobertura)',
          'Indifference curves por tipo',
          'Equilibrio Wilson vs Rothschild-Stiglitz',
        ],
      },
      {
        id: 'coase-firm',
        name: 'Make-vs-Buy (Coase)',
        status: 'planned',
        blurb: 'Tamaño óptimo de la empresa: costos de transacción vs costos de coordinación.',
        roadmap: [
          'Sliders: costo de mercado, costo de coordinar internamente',
          'Curva de costo total → tamaño óptimo',
          'Casos clásicos: Ford vertical, Apple horizontal',
        ],
      },
      {
        id: 'principal-agent',
        name: 'Principal-Agent (Holmström)',
        status: 'planned',
        blurb: 'Diseñar el contrato óptimo cuando el agente puede esconder esfuerzo.',
        roadmap: [
          'Sliders: aversión al riesgo, varianza del ruido, productividad',
          'Contrato óptimo: salario fijo + comisión sobre output',
          'Trade-off insurance vs incentivos',
        ],
      },
      {
        id: 'two-sided-markets',
        name: 'Mercados de dos lados (Tirole)',
        status: 'planned',
        blurb: 'Visa, App Store, Uber: por qué un lado subsidia al otro.',
        roadmap: [
          'Slider: precio a cada lado',
          'Network effects cruzados',
          'Equilibrio de adopción + welfare',
        ],
      },
    ],
  },

  // ═══════════════════════ 2 · JUEGOS Y MECANISMOS ═══════════════════════
  {
    id: 'games',
    name: 'Juegos y mecanismos',
    icon: '⛀',
    accent: '#A78BFA',
    blurb: 'Nash, Aumann, Schelling, Hurwicz, Maskin, Myerson, Roth, Shapley, Milgrom, Wilson.',
    modules: [
      {
        id: 'nash-2x2',
        name: 'Equilibrio Nash 2×2',
        status: 'planned',
        blurb: 'Matriz de pagos editable. Estrategias dominantes, equilibrios mixtos, mejor respuesta.',
        roadmap: [
          'Editor de matriz 2×2',
          'Cálculo automático de equilibrios puros + mixtos',
          'Visualización del simplejo de estrategias',
          'Presets: Prisionero, Halcón-Paloma, Stag-Hunt, Battle of Sexes',
        ],
      },
      {
        id: 'prisoners-iterated',
        name: 'Dilema del prisionero iterado',
        status: 'planned',
        blurb: 'Torneo Axelrod: TFT, Always-D, Always-C, Pavlov, Grim. ¿Qué estrategia sobrevive?',
        roadmap: [
          'Pool de estrategias seleccionable',
          'Simulación evolutiva (replicator dynamics)',
          'Niveles de ruido configurable',
        ],
      },
      {
        id: 'schelling-segregation',
        name: 'Segregación de Schelling',
        status: 'planned',
        blurb: 'Cómo preferencias individuales débiles producen segregación extrema.',
        roadmap: [
          'Grid 2D con dos tipos de agente',
          'Slider: tolerancia individual',
          'Métrica de segregación agregada',
        ],
      },
      {
        id: 'auctions',
        name: 'Subastas: English / Dutch / Vickrey / 1st-price',
        status: 'planned',
        blurb: 'Cuatro formatos. Mismo objeto. ¿Cuándo coinciden los ingresos esperados? Revenue Equivalence.',
        roadmap: [
          'N bidders con valuaciones IID',
          'Simulación de cada formato',
          'Histograma de precio final + winner curse',
        ],
      },
      {
        id: 'matching-gale-shapley',
        name: 'Matching Gale-Shapley',
        status: 'planned',
        blurb: 'Estudiantes ↔ escuelas, médicos ↔ hospitales. El algoritmo que Roth llevó a la práctica.',
        roadmap: [
          'Editor de preferencias para ambos lados',
          'Animación del algoritmo paso a paso',
          'Demostración de stability + strategy-proofness',
        ],
      },
      {
        id: 'mechanism-design',
        name: 'Mechanism design playground',
        status: 'planned',
        blurb: 'Diseña la regla. Los participantes mienten. ¿Qué regla los hace decir la verdad?',
        roadmap: [
          'Subastas, votación, asignación pública',
          'VCG mechanism + median voter',
          'Visualizar incentive compatibility',
        ],
      },
    ],
  },

  // ═══════════════════════ 3 · MACRO Y CRECIMIENTO ═══════════════════════
  {
    id: 'macro',
    name: 'Macro y crecimiento',
    icon: '∮',
    accent: '#34D399',
    blurb: 'Solow, Romer, Lucas, Phelps, Acemoglu — por qué los países crecen (o no).',
    modules: [
      {
        id: 'solow',
        name: 'Modelo de Solow',
        status: 'planned',
        blurb: 'Sliders: tasa de ahorro, depreciación, crecimiento poblacional, tecnología. Ver el steady state.',
        roadmap: [
          'Función de producción Cobb-Douglas',
          'Gráfica k(t) en el tiempo',
          'Golden rule de ahorro',
          'Convergencia condicional entre países',
        ],
      },
      {
        id: 'romer-endogenous',
        name: 'Crecimiento endógeno (Romer)',
        status: 'planned',
        blurb: 'Ideas no son rivales. R&D endógeno. Por qué los retornos no decrecen.',
        roadmap: [
          'Sliders: % población en R&D, productividad de ideas',
          'Comparar crecimiento Solow vs Romer',
        ],
      },
      {
        id: 'phillips-curve',
        name: 'Curva de Phillips',
        status: 'planned',
        blurb: 'Inflación vs desempleo. Phelps: a largo plazo no existe.',
        roadmap: [
          'Sliders: shocks de oferta, expectativas',
          'Comparar Phillips estática vs ampliada por expectativas',
          'Stagflación visible',
        ],
      },
      {
        id: 'is-lm-as-ad',
        name: 'IS-LM-AS-AD',
        status: 'planned',
        blurb: 'El modelo macro estándar. Shocks de demanda, oferta, política fiscal, política monetaria.',
        roadmap: [
          '4 cuadrantes acoplados',
          'Botones de shock + animación de ajuste',
        ],
      },
      {
        id: 'acemoglu-institutions',
        name: 'Instituciones y prosperidad (Acemoglu)',
        status: 'planned',
        blurb: 'Datos reales: Nogales-Nogales, las dos Coreas, herencia colonial. Inclusivo vs extractivo.',
        roadmap: [
          'Dataset de instituciones (Polity IV) + PIB per cápita',
          'Scatter plot interactivo con país hover',
          'Diferencia en diferencias por reforma institucional',
        ],
      },
    ],
  },

  // ═══════════════════════ 4 · FINANZAS Y RIESGO ═══════════════════════
  {
    id: 'finance',
    name: 'Finanzas y riesgo',
    icon: '$',
    accent: '#FDB813',
    blurb: 'Markowitz, Sharpe, Black-Scholes, Merton, Diamond-Dybvig.',
    modules: [
      {
        id: 'portfolio-frontier',
        name: 'Frontera eficiente (Markowitz)',
        status: 'planned',
        blurb: '2-3 activos con retornos y covarianzas. Frontera de varianza mínima + capital market line.',
        roadmap: [
          'Sliders: retornos esperados + matriz de covarianza',
          'Frontera dibujada + portafolio tangente',
          'Datos reales SPX/IPC/BOVESPA opcional',
        ],
      },
      {
        id: 'capm',
        name: 'CAPM y beta',
        status: 'planned',
        blurb: 'El factor de mercado. Por qué dos activos con el mismo retorno medio no son iguales.',
        roadmap: [
          'Scatter retorno-beta',
          'Línea de mercado de capitales',
          'Datos de acciones LATAM',
        ],
      },
      {
        id: 'black-scholes',
        name: 'Black-Scholes',
        status: 'planned',
        blurb: 'Pricing de opciones. Sliders: precio strike, tiempo, volatilidad, tasa libre de riesgo.',
        roadmap: [
          'Fórmula + las greeks (delta, gamma, vega, theta)',
          'Árbol binomial converge a B-S',
          'Volatility smile',
        ],
      },
      {
        id: 'bank-run',
        name: 'Corrida bancaria (Diamond-Dybvig)',
        status: 'planned',
        blurb: 'Dos equilibrios: nadie corre, todos corren. Cómo el seguro de depósitos los elimina.',
        roadmap: [
          'Agentes deciden retirar/no en T1, T2',
          'Equilibrio simétrico',
          'Cambio de régimen con seguro',
        ],
      },
      {
        id: 'shiller-bubbles',
        name: 'Burbujas (Shiller)',
        status: 'planned',
        blurb: 'Precio vs dividendos descontados. CAPE ratio histórico. ¿Estamos en una burbuja?',
        roadmap: [
          'Series históricas SPX/IPC desde 1900',
          'CAPE de Shiller calculado',
          'Predicción de retornos a 10 años',
        ],
      },
    ],
  },

  // ═══════════════════════ 5 · DINERO E INFLACIÓN ═══════════════════════
  {
    id: 'money',
    name: 'Dinero e inflación',
    icon: '₿',
    accent: '#FB923C',
    blurb: 'Friedman, Hayek, Mundell. Por qué Banxico es autónomo, por qué el peso flota.',
    modules: [
      {
        id: 'monetary-trilemma',
        name: 'Trilemma monetaria (Mundell)',
        status: 'planned',
        blurb: 'Tipo de cambio fijo, libre flujo de capital, política monetaria autónoma — elige dos.',
        roadmap: [
          'Tres ejes seleccionables',
          'Ejemplos: Argentina 1991 (currency board), China (capital control), USA (free float)',
        ],
      },
      {
        id: 'fisher-equation',
        name: 'Ecuación de Fisher (i = r + π)',
        status: 'planned',
        blurb: 'Tasa nominal, real, inflación esperada. Por qué Banxico sube tasas cuando sube inflación.',
        roadmap: ['Sliders + serie histórica MX', 'Anuncio de inflación + reacción del mercado'],
      },
      {
        id: 'hyperinflation',
        name: 'Hiperinflación',
        status: 'planned',
        blurb: 'Modelo de Cagan. Por qué Argentina, Venezuela, Zimbabwe colapsaron.',
        roadmap: ['Slider: déficit fiscal, demanda de dinero', 'Punto de ignición'],
      },
    ],
  },

  // ═══════════════════════ 6 · POBREZA Y DESARROLLO ═══════════════════════
  {
    id: 'development',
    name: 'Pobreza y desarrollo',
    icon: '◆',
    accent: '#EF4444',
    blurb: 'Sen, Deaton, Banerjee, Duflo, Kremer. Lo que sí funciona contra la pobreza.',
    modules: [
      {
        id: 'gini-lorenz',
        name: 'Gini y curva de Lorenz',
        status: 'planned',
        blurb: 'Cómo medir desigualdad. Datos reales de México, Brasil, Chile vs. EE.UU., Noruega.',
        roadmap: ['Distribución del ingreso editable', 'Curva de Lorenz + Gini', 'Comparador de países'],
      },
      {
        id: 'rct',
        name: 'RCT: tratamiento vs control',
        status: 'planned',
        blurb: 'El método experimental aplicado a pobreza. PROSPERA México como caso real.',
        roadmap: [
          'Sliders: tamaño de muestra, efecto, varianza',
          'P-value y intervalo de confianza',
          'Caso: efecto educativo de PROGRESA',
        ],
      },
      {
        id: 'capabilities-sen',
        name: 'Capabilities (Sen)',
        status: 'planned',
        blurb: 'IDH y más allá. Por qué medir solo ingreso miente.',
        roadmap: ['Comparador multidimensional', 'IDH vs PIB per cápita'],
      },
    ],
  },

  // ═══════════════════════ 7 · COMPORTAMIENTO ═══════════════════════
  {
    id: 'behavior',
    name: 'Comportamiento',
    icon: '⌬',
    accent: '#D946EF',
    blurb: 'Simon, Kahneman, Smith, Thaler. Lo que pasa cuando los humanos no son robots.',
    modules: [
      {
        id: 'prospect-theory',
        name: 'Prospect theory (Kahneman)',
        status: 'planned',
        blurb: 'La función de valor. Loss aversion. Por qué $100 perdidos duelen más que $100 ganados.',
        roadmap: [
          'Función S asimétrica',
          'Probability weighting',
          'Comparar con expected utility',
        ],
      },
      {
        id: 'nudges',
        name: 'Nudges (Thaler)',
        status: 'planned',
        blurb: 'Default sí donas / default no donas. Cómo el menú cambia el comportamiento.',
        roadmap: [
          'Simulación: opt-in vs opt-out en pensiones, donación de órganos',
          'Comparador internacional real',
        ],
      },
      {
        id: 'bounded-rationality',
        name: 'Racionalidad acotada (Simon)',
        status: 'planned',
        blurb: 'Satisficing vs optimizing. El alumno se vuelve un agente con tiempo finito de cálculo.',
        roadmap: ['Decision tree con costo de búsqueda', 'Comparar resultados'],
      },
    ],
  },

  // ═══════════════════════ 8 · CAPITAL HUMANO Y TRABAJO ═══════════════════════
  {
    id: 'labor',
    name: 'Capital humano y trabajo',
    icon: '⚒',
    accent: '#22D3EE',
    blurb: 'Becker, Heckman, Card, Goldin, Mortensen, Pissarides.',
    modules: [
      {
        id: 'mincer',
        name: 'Ecuación de Mincer',
        status: 'planned',
        blurb: 'log(salario) = α + β·educación + γ·experiencia. Estimación con datos reales.',
        roadmap: ['Dataset INEGI/ENIGH', 'Regresión OLS + intervalos', 'Retorno por año extra de escuela'],
      },
      {
        id: 'did',
        name: 'Differences-in-Differences (Card)',
        status: 'planned',
        blurb: 'El experimento natural. Card y el salario mínimo en New Jersey.',
        roadmap: ['Dataset Card-Krueger', 'Visualización DiD', 'Test de paralelismo previo'],
      },
      {
        id: 'gender-gap-decomp',
        name: 'Descomposición de la brecha de género (Goldin)',
        status: 'planned',
        blurb: 'Cuánto es educación, ocupación, hijos. La brecha residual.',
        roadmap: ['Oaxaca-Blinder decomposition', 'Datos reales de mercado laboral mexicano'],
      },
      {
        id: 'search-matching',
        name: 'Search & matching (Mortensen-Pissarides)',
        status: 'planned',
        blurb: 'Cómo coexisten vacantes y desempleo. La curva de Beveridge.',
        roadmap: ['Matching function', 'Slider de costo de búsqueda', 'Curva de Beveridge en vivo'],
      },
    ],
  },

  // ═══════════════════════ 9 · ECONOMETRÍA ═══════════════════════
  {
    id: 'econometrics',
    name: 'Econometría',
    icon: '∑',
    accent: '#94A3B8',
    blurb: 'Frisch, Tinbergen, Engle, Granger, Sims, Card, Angrist, Imbens. Cómo extraer causa de los datos.',
    modules: [
      {
        id: 'ols',
        name: 'Regresión lineal interactiva',
        status: 'planned',
        blurb: 'Mueve puntos, mira cómo cambia la recta. R², residuos, intervalos de confianza.',
        roadmap: ['Drag-and-drop de puntos', 'Comparar OLS vs robust regression'],
      },
      {
        id: 'time-series',
        name: 'AR, MA, ARMA',
        status: 'planned',
        blurb: 'Procesos de Engle-Granger. ACF/PACF interactivos.',
        roadmap: ['Generar serie con parámetros', 'ACF/PACF en tiempo real', 'Estacionariedad'],
      },
      {
        id: 'iv',
        name: 'Variables instrumentales',
        status: 'planned',
        blurb: 'Causalidad cuando hay endogeneidad. Ejemplo: institutions → income con settler mortality.',
        roadmap: ['First stage + reduced form + IV', 'Datos AJR 2001'],
      },
      {
        id: 'rdd',
        name: 'Regression discontinuity (Imbens)',
        status: 'planned',
        blurb: 'Cuando un umbral arbitrario te da un experimento natural.',
        roadmap: ['Visualizar discontinuidad', 'Bandwidth selection', 'McCrary test'],
      },
    ],
  },
];

export function findModule(branchId: string, moduleId: string) {
  const br = BRANCHES.find(b => b.id === branchId);
  const mo = br?.modules.find(m => m.id === moduleId);
  return { branch: br, module: mo };
}
