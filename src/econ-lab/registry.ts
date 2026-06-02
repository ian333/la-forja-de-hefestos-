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
 *
 * Los componentes `live` reutilizan los labs por-premio de `@/economia/labs/`
 * (los mismos que monta `premio.html?id=`), aquí organizados por TEMA en vez
 * de por año/premio. Un lab, dos puertas de entrada.
 */

import { lazy } from 'react';
import type { LabBranch } from './types';

// Módulo nativo del EconLab.
const MarketForLemons = lazy(() => import('./modules/info/MarketForLemons'));

// Labs por-premio reutilizados (viven en @/economia/labs/, también en premio.html).
const SpenceLab          = lazy(() => import('@/economia/labs/SpenceLab'));
const CoaseLab           = lazy(() => import('@/economia/labs/CoaseLab'));
const HartHolmstromLab   = lazy(() => import('@/economia/labs/HartHolmstromLab'));
const TiroleLab          = lazy(() => import('@/economia/labs/TiroleLab'));
const NashLab            = lazy(() => import('@/economia/labs/NashLab'));
const SchellingCiudad    = lazy(() => import('@/economia/labs/SchellingCiudad'));
const MilgromWilsonLab   = lazy(() => import('@/economia/labs/MilgromWilsonLab'));
const RothShapleyLab     = lazy(() => import('@/economia/labs/RothShapleyLab'));
const MechanismDesignLab = lazy(() => import('@/economia/labs/MechanismDesignLab'));
const SolowLab           = lazy(() => import('@/economia/labs/SolowLab'));
const PhelpsLab          = lazy(() => import('@/economia/labs/PhelpsLab'));
const AcemogluLab        = lazy(() => import('@/economia/labs/AcemogluLab'));
const MarkowitzSharpeLab = lazy(() => import('@/economia/labs/MarkowitzSharpeLab'));
const MertonScholesLab   = lazy(() => import('@/economia/labs/MertonScholesLab'));
const BankRunLab         = lazy(() => import('@/economia/labs/BernankeDiamondDybvigLab'));
const FamaShillerLab     = lazy(() => import('@/economia/labs/FamaHansenShillerLab'));
const MundellLab         = lazy(() => import('@/economia/labs/MundellLab'));
const FriedmanLab        = lazy(() => import('@/economia/labs/FriedmanLab'));
const DeatonLab          = lazy(() => import('@/economia/labs/DeatonLab'));
const DufloLab           = lazy(() => import('@/economia/labs/DufloBanerjeeKremerLab'));
const SenLab             = lazy(() => import('@/economia/labs/SenLab'));
const KahnemanLab        = lazy(() => import('@/economia/labs/KahnemanLab'));
const ThalerLab          = lazy(() => import('@/economia/labs/ThalerLab'));
const SimonLab           = lazy(() => import('@/economia/labs/SimonLab'));
const BeckerLab          = lazy(() => import('@/economia/labs/BeckerLab'));
const CardLab            = lazy(() => import('@/economia/labs/CardAngristImbensLab'));
const GoldinLab          = lazy(() => import('@/economia/labs/GoldinLab'));
const SearchMatchingLab  = lazy(() => import('@/economia/labs/DiamondMortensenPissaridesLab'));
const FrischLab          = lazy(() => import('@/economia/labs/CaballitoFrisch'));
const EngleGrangerLab    = lazy(() => import('@/economia/labs/EngleGrangerLab'));

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
        status: 'live',
        blurb: 'La educación como señal costosa. Equilibrios pooling vs separating.',
        childHint: 'El título no prueba que sabes — prueba que aguantaste lo que otros no.',
        researcherHint: 'Dos tipos con costo de educación distinto; e* tal que solo el tipo alto señaliza.',
        component: SpenceLab,
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
        status: 'live',
        blurb: 'Tamaño óptimo de la empresa: costos de transacción vs costos de coordinación.',
        childHint: 'Tu jefe existe porque negociar en el mercado cuesta. Si ese costo fuera 0, no habría empresas.',
        researcherHint: 'Umbral n* = F/(τ−m): make-vs-buy + teorema de Coase con costo de transacción variable.',
        component: CoaseLab,
      },
      {
        id: 'principal-agent',
        name: 'Principal-Agent (Holmström)',
        status: 'live',
        blurb: 'Diseñar el contrato óptimo cuando el agente puede esconder esfuerzo.',
        childHint: 'Pagar puro sueldo fijo = nadie se esfuerza; pura comisión = le cargas todo el riesgo.',
        researcherHint: 'β* = 1/(1+ρcσ²): trade-off seguro vs incentivo (Holmström-Milgrom).',
        component: HartHolmstromLab,
      },
      {
        id: 'two-sided-markets',
        name: 'Mercados de dos lados (Tirole)',
        status: 'live',
        blurb: 'Visa, App Store, Uber: por qué un lado subsidia al otro.',
        childHint: 'Uber no le cobra lo mismo al conductor que al pasajero — y a veces uno paga negativo.',
        researcherHint: 'Externalidades de red cruzadas + punto fijo; precio óptimo por lado puede ser negativo.',
        component: TiroleLab,
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
        status: 'live',
        blurb: 'Matriz de pagos editable. Estrategias dominantes, equilibrios mixtos, mejor respuesta.',
        childHint: 'Cambia los pagos y mira dónde ninguno de los dos quiere cambiar su jugada solo.',
        researcherHint: 'Equilibrios puros + mixto por indiferencia; presets Prisionero/Halcón-Paloma/Stag-Hunt.',
        component: NashLab,
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
        status: 'live',
        blurb: 'Cómo preferencias individuales débiles producen segregación extrema.',
        childHint: 'Aunque cada quien acepte ser minoría leve, la ciudad termina totalmente separada.',
        researcherHint: 'Grid con umbral de tolerancia individual; segregación agregada emergente.',
        component: SchellingCiudad,
      },
      {
        id: 'auctions',
        name: 'Subastas (Milgrom-Wilson)',
        status: 'live',
        blurb: 'Cuatro formatos, mismo objeto. Revenue equivalence, shading, winner curse.',
        childHint: 'En la subasta de segundo precio te conviene decir la verdad; en la de primer precio, mentir tantito.',
        researcherHint: 'Bidders IID; shading b=v(N−1)/N en 1er precio; verdad dominante en Vickrey.',
        component: MilgromWilsonLab,
      },
      {
        id: 'matching-gale-shapley',
        name: 'Matching Gale-Shapley',
        status: 'live',
        blurb: 'Estudiantes ↔ escuelas, médicos ↔ hospitales. El algoritmo que Roth llevó a la práctica.',
        childHint: 'Todos proponen, los rechazados vuelven a intentar, y nadie queda con ganas de cambiar.',
        researcherHint: 'Deferred acceptance: estabilidad + a prueba de estrategia para el lado que propone.',
        component: RothShapleyLab,
      },
      {
        id: 'mechanism-design',
        name: 'Mechanism design playground',
        status: 'live',
        blurb: 'Diseña la regla. Los participantes mienten. ¿Qué regla los hace decir la verdad?',
        childHint: 'Cambia las reglas del juego hasta que a todos les convenga ser honestos.',
        researcherHint: 'VCG + compatibilidad de incentivos; el principio de revelación en acción.',
        component: MechanismDesignLab,
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
        status: 'live',
        blurb: 'Sliders: tasa de ahorro, depreciación, crecimiento poblacional, tecnología. Ver el steady state.',
        childHint: 'Más fábricas ayudan… hasta que el desgaste se come lo nuevo y te estancas.',
        researcherHint: 'Cobb-Douglas; k* donde s·f(k)=(δ+n)k; golden rule de ahorro.',
        component: SolowLab,
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
        name: 'Curva de Phillips (Phelps)',
        status: 'live',
        blurb: 'Inflación vs desempleo. Phelps: a largo plazo no existe el trade-off.',
        childHint: 'Imprimir dinero baja el desempleo… solo hasta que todos esperan la inflación.',
        researcherHint: 'Phillips ampliada por expectativas; tasa natural; stagflación visible.',
        component: PhelpsLab,
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
        status: 'live',
        blurb: 'Nogales-Nogales, las dos Coreas, herencia colonial. Inclusivo vs extractivo.',
        childHint: 'Misma gente, mismo clima, una línea en el mapa — y un lado es 5 veces más rico.',
        researcherHint: 'Instituciones inclusivas vs extractivas; instrumento settler mortality (AJR).',
        component: AcemogluLab,
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
        status: 'live',
        blurb: 'Activos con retornos y covarianzas. Frontera de varianza mínima + capital market line.',
        childHint: 'No pongas todos los huevos en una canasta: mezclar baja el riesgo sin bajar el premio.',
        researcherHint: 'Frontera media-varianza + portafolio tangente; diversificación por covarianza.',
        component: MarkowitzSharpeLab,
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
        name: 'Black-Scholes-Merton',
        status: 'live',
        blurb: 'Pricing de opciones. Sliders: strike, tiempo, volatilidad, tasa libre de riesgo.',
        childHint: 'El precio justo de una apuesta sobre el futuro, sin adivinar a dónde va el mercado.',
        researcherHint: 'Fórmula B-S + las griegas; árbol binomial converge a la solución cerrada.',
        component: MertonScholesLab,
      },
      {
        id: 'bank-run',
        name: 'Corrida bancaria (Diamond-Dybvig)',
        status: 'live',
        blurb: 'Dos equilibrios: nadie corre, todos corren. Cómo el seguro de depósitos los elimina.',
        childHint: 'El banco es sano… hasta que todos creen que todos van a sacar su dinero.',
        researcherHint: 'Dos equilibrios de Nash; el seguro de depósitos elimina el malo.',
        component: BankRunLab,
      },
      {
        id: 'shiller-bubbles',
        name: 'Eficiencia y burbujas (Fama-Shiller)',
        status: 'live',
        blurb: 'Precio vs dividendos descontados. Mercados eficientes vs exuberancia irracional.',
        childHint: '¿El precio refleja todo lo conocido… o a veces es pura euforia?',
        researcherHint: 'Random walk de Fama vs exceso de volatilidad de Shiller; CAPE histórico.',
        component: FamaShillerLab,
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
        status: 'live',
        blurb: 'Tipo de cambio fijo, libre flujo de capital, política monetaria autónoma — elige dos.',
        childHint: 'No puedes tener las tres a la vez: algo tienes que soltar.',
        researcherHint: 'Trilema de Mundell-Fleming; ejemplos currency board / control de capital / free float.',
        component: MundellLab,
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
        name: 'Hiperinflación (Friedman)',
        status: 'live',
        blurb: 'Por qué imprimir dinero sin freno colapsa la moneda. Cagan.',
        childHint: 'Cuando el gobierno imprime para pagar, los precios corren más rápido que tú.',
        researcherHint: 'Teoría cuantitativa + demanda de dinero de Cagan; punto de ignición del déficit.',
        component: FriedmanLab,
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
        name: 'Desigualdad y consumo (Deaton)',
        status: 'live',
        blurb: 'Cómo medir desigualdad y consumo. Gini, curva de Lorenz, datos reales.',
        childHint: 'Dos países con el mismo ingreso promedio pueden ser mundos distintos según cómo se reparte.',
        researcherHint: 'Curva de Lorenz + coeficiente de Gini; consumo vs ingreso (Deaton).',
        component: DeatonLab,
      },
      {
        id: 'rct',
        name: 'RCT: tratamiento vs control (Duflo)',
        status: 'live',
        blurb: 'El método experimental aplicado a pobreza. PROGRESA México como caso real.',
        childHint: 'Para saber si una ayuda sirve, la das al azar a unos y a otros no, y comparas.',
        researcherHint: 'Aleatorización + diferencia de medias; p-value e intervalo de confianza.',
        component: DufloLab,
      },
      {
        id: 'capabilities-sen',
        name: 'Capabilities (Sen)',
        status: 'live',
        blurb: 'IDH y más allá. Por qué medir solo ingreso miente.',
        childHint: 'Ser rico no es tener dinero, es poder elegir la vida que quieres.',
        researcherHint: 'Enfoque de capacidades; IDH multidimensional vs PIB per cápita.',
        component: SenLab,
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
        status: 'live',
        blurb: 'La función de valor. Loss aversion. Por qué $100 perdidos duelen más que $100 ganados.',
        childHint: 'Perder mil pesos duele más de lo que alegra ganarlos. Tu cerebro no es una calculadora.',
        researcherHint: 'Función de valor en S + ponderación de probabilidad; comparar con utilidad esperada.',
        component: KahnemanLab,
      },
      {
        id: 'nudges',
        name: 'Nudges (Thaler)',
        status: 'live',
        blurb: 'Default sí donas / default no donas. Cómo el menú cambia el comportamiento.',
        childHint: 'Cambia cuál es la opción “por defecto” y cambias lo que hace la mayoría.',
        researcherHint: 'Arquitectura de elección; opt-in vs opt-out en pensiones y donación de órganos.',
        component: ThalerLab,
      },
      {
        id: 'bounded-rationality',
        name: 'Racionalidad acotada (Simon)',
        status: 'live',
        blurb: 'Satisficing vs optimizing. El alumno se vuelve un agente con tiempo finito de cálculo.',
        childHint: 'No buscas LO mejor: buscas algo suficientemente bueno y ya. Eso es ser humano.',
        researcherHint: 'Satisficing con costo de búsqueda; comparar contra el óptimo global.',
        component: SimonLab,
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
        name: 'Capital humano (Becker)',
        status: 'live',
        blurb: 'log(salario) = α + β·educación + γ·experiencia. El retorno de estudiar un año más.',
        childHint: 'Estudiar es invertir en ti: cada año de escuela paga un porcentaje extra de por vida.',
        researcherHint: 'Ecuación de Mincer; retorno marginal de la educación.',
        component: BeckerLab,
      },
      {
        id: 'did',
        name: 'Differences-in-Differences (Card)',
        status: 'live',
        blurb: 'El experimento natural. Card y el salario mínimo en New Jersey.',
        childHint: 'Compara antes-y-después de dos grupos para aislar el efecto de una política.',
        researcherHint: 'DiD + test de tendencias paralelas (Card-Krueger).',
        component: CardLab,
      },
      {
        id: 'gender-gap-decomp',
        name: 'Brecha de género (Goldin)',
        status: 'live',
        blurb: 'Cuánto es educación, ocupación, hijos. La brecha residual.',
        childHint: 'Gran parte de la brecha salarial aparece justo cuando llega el primer hijo.',
        researcherHint: 'Descomposición Oaxaca-Blinder; penalización por maternidad.',
        component: GoldinLab,
      },
      {
        id: 'search-matching',
        name: 'Search & matching (Mortensen-Pissarides)',
        status: 'live',
        blurb: 'Cómo coexisten vacantes y desempleo. La curva de Beveridge.',
        childHint: 'Hay vacantes Y hay desempleados al mismo tiempo: encontrarse cuesta tiempo.',
        researcherHint: 'Función de emparejamiento + curva de Beveridge; fricción de búsqueda.',
        component: SearchMatchingLab,
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
        name: 'Regresión lineal (Frisch-Tinbergen)',
        status: 'live',
        blurb: 'La recta que mejor pasa por los datos. R², residuos, intervalos.',
        childHint: 'Una línea que aprende la tendencia de una nube de puntos.',
        researcherHint: 'Mínimos cuadrados; los padres de la econometría (Frisch-Tinbergen).',
        component: FrischLab,
      },
      {
        id: 'time-series',
        name: 'Series de tiempo (Engle-Granger)',
        status: 'live',
        blurb: 'Volatilidad que se agrupa, series que caminan juntas. ARCH/GARCH, cointegración.',
        childHint: 'Después de un susto, la bolsa sigue nerviosa un rato: la volatilidad se contagia.',
        researcherHint: 'ARCH/GARCH (Engle) + cointegración (Granger); σ²ₜ = ω + α·ε²ₜ₋₁ + β·σ²ₜ₋₁.',
        component: EngleGrangerLab,
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
