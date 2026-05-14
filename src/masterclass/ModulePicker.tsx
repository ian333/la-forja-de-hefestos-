/**
 * ModulePicker — pantalla final de la Masterclass.
 *
 * Aparece cuando termina el audio de la última escena. Muestra un grid
 * de módulos del Math Lab para que el alumno elija dónde seguir.
 *
 * Cada tarjeta linkea a /math.html#<branchId>/<moduleId> (hash routing
 * inter-pilar que ya tenemos en `src/physics/useHashRoute.ts`).
 */

import { useEffect, useState } from 'react';

interface ModuleCard {
  branchId: string;
  moduleId: string;
  branch: string;
  name: string;
  blurb: string;
  accent: string;
  glyph: string;
  /** Optional override: which lab page hosts this module. Defaults to /math.html. */
  labUrl?: string;
}

const MODULES_BY_CLASS: Record<string, ModuleCard[]> = {
  // Primera clase — análisis complejo
  i: [
    { branchId: 'complex', moduleId: 'mobius', branch: 'Análisis complejo', name: 'Möbius · esfera de Riemann',
      blurb: 'Lo que viste, ahora con todos los controles. Cambia a, b, c, d y observa el plano transformarse.',
      accent: '#F472B6', glyph: 'ℂ' },
    { branchId: 'complex', moduleId: 'roots', branch: 'Análisis complejo', name: 'Fractales de Newton',
      blurb: 'Mismo método de Newton-Raphson. Cinco polinomios distintos, cinco fractales.',
      accent: '#F472B6', glyph: 'ℂ' },
    { branchId: 'complex', moduleId: 'conformal', branch: 'Análisis complejo', name: 'Mapas conformes',
      blurb: 'Joukowski airfoil con ángulo de ataque editable + disco de Poincaré.',
      accent: '#F472B6', glyph: 'ℂ' },
    { branchId: 'linalg', moduleId: 'eigen-3d', branch: 'Álgebra lineal', name: 'Eigenvectores en 3D',
      blurb: 'Strang lección 21. Direcciones invariantes de una matriz 3×3. ¿i también está acá? Sí.',
      accent: '#7E57C2', glyph: 'Λ' },
    { branchId: 'calc', moduleId: 'tangent-plane', branch: 'Cálculo', name: 'Plano tangente y gradiente',
      blurb: 'Mueve un punto sobre una superficie. El plano lo persigue. Spivak cap. 14.',
      accent: '#4FC3F7', glyph: '∫' },
    { branchId: 'diffeq', moduleId: 'phase-portrait', branch: 'Ecuaciones diferenciales', name: 'Retrato de fases 2D',
      blurb: 'Lotka-Volterra, van der Pol, péndulo no-lineal. Suelta una hojita y mira el río.',
      accent: '#FDB813', glyph: 'Ψ' },
  ],

  // Economía — Los limones (Akerlof 2001)
  'econ-01-limones': [
    { branchId: 'info', moduleId: 'lemons', branch: 'Mercados e información', name: 'Mercado de limones · simulador',
      blurb: 'Lo que viste, ahora con sliders. Cambia el % de cherries, el sobreprecio y la valuación. Mira el unraveling.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'spence-signaling', branch: 'Mercados e información', name: 'Señalización de Spence',
      blurb: 'La escalera de educación como signal. Equilibrios pooling vs separating. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'screening', branch: 'Mercados e información', name: 'Screening de Rothschild-Stiglitz',
      blurb: 'Cómo separar tipos de riesgo con menús de contratos. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'coase-firm', branch: 'Mercados e información', name: 'Make-vs-Buy (Coase)',
      blurb: 'Tamaño óptimo de la empresa: costos de transacción vs coordinación. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'auctions', branch: 'Juegos y mecanismos', name: 'Subastas: Vickrey, English, Dutch',
      blurb: 'Las subastas son la solución institucional al problema de los limones. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'development', moduleId: 'rct', branch: 'Pobreza y desarrollo', name: 'RCTs (Duflo / PROSPERA)',
      blurb: 'Cómo medir si una política realmente funciona — con tratamiento y control. Próximamente.',
      accent: '#EF4444', glyph: '◆', labUrl: '/econ-lab.html' },
  ],

  // Economía — Spence 1973: la señalización
  'econ-03-spence': [
    { branchId: 'info', moduleId: 'spence-signaling', branch: 'Mercados e información', name: 'Escalera de Spence · simulador',
      blurb: 'Mueve los costos por tipo y la diferencia salarial. Encuentra el rango de s* donde el equilibrio se separa. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'lemons', branch: 'Mercados e información', name: 'Mercado de limones (Akerlof)',
      blurb: 'El problema que Spence resolvió: cuando el comprador no distingue, el bueno necesita una señal.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'screening', branch: 'Mercados e información', name: 'Screening (Stiglitz)',
      blurb: 'La cara opuesta: el no informado diseña menús de contratos para que los otros se delaten solos. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'principal-agent', branch: 'Mercados e información', name: 'Principal-Agent (Holmström)',
      blurb: 'Dentro de la empresa: cómo pagarle al empleado cuyo esfuerzo no observas. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'labor', moduleId: 'mincer', branch: 'Capital humano', name: 'Ecuación de Mincer',
      blurb: 'log(salario) en función de educación y experiencia. La evidencia empírica de que la educación sí paga. Próximamente.',
      accent: '#22D3EE', glyph: '⚒', labUrl: '/econ-lab.html' },
    { branchId: 'labor', moduleId: 'did', branch: 'Capital humano', name: 'DiD (Card)',
      blurb: 'Cómo aislamos el efecto causal de un año extra de educación con experimentos naturales. Próximamente.',
      accent: '#22D3EE', glyph: '⚒', labUrl: '/econ-lab.html' },
  ],

  // Economía — Nash 1994: equilibrio
  'econ-06-nash': [
    { branchId: 'games', moduleId: 'nash-2x2', branch: 'Juegos y mecanismos', name: 'Equilibrio Nash 2×2 · simulador',
      blurb: 'Mueve la matriz de pagos y mira los equilibrios puros y mixtos en vivo. Presets: prisionero, halcón-paloma. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'prisoners-iterated', branch: 'Juegos y mecanismos', name: 'Dilema iterado',
      blurb: 'Pool de estrategias (TFT, Pavlov, Grim) compitiendo evolutivamente. ¿Cuál sobrevive? Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'schelling-segregation', branch: 'Juegos y mecanismos', name: 'Segregación de Schelling',
      blurb: 'Preferencias individuales débiles producen segregación extrema. Grid 2D editable. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'mechanism-design', branch: 'Juegos y mecanismos', name: 'Mechanism Design',
      blurb: 'Diseña reglas que llevan al equilibrio que quieres. Subastas, votación, asignación. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'two-sided-markets', branch: 'Mercados e información', name: 'Plataformas (Tirole)',
      blurb: 'Las plataformas son juegos de coordinación entre dos lados. Nash en la práctica. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'acemoglu-institutions', branch: 'Macro y crecimiento', name: 'Instituciones',
      blurb: 'Por qué Latinoamérica se atora en equilibrios malos. Acemoglu lo formaliza. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
  ],

  // Economía — Tirole 2014: mercados de dos lados
  'econ-05-tirole': [
    { branchId: 'info', moduleId: 'two-sided-markets', branch: 'Mercados e información', name: 'Mercados de 2 lados · simulador',
      blurb: 'Mueve los precios a cada lado y observa cómo network effects deciden quién gana. Visa, Uber, App Store. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'coase-firm', branch: 'Mercados e información', name: 'Make-vs-Buy (Coase)',
      blurb: 'Las plataformas son híbridos entre mercado y empresa. Coase es la base de qué se internaliza.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'principal-agent', branch: 'Mercados e información', name: 'Principal-Agent (Holmström)',
      blurb: 'Las plataformas también tienen el problema agente: contratan repartidores sin verlos. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'auctions', branch: 'Juegos y mecanismos', name: 'Subastas de espectro (Milgrom)',
      blurb: 'Tirole diseñó subastas de telecomunicaciones — Milgrom las perfeccionó. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'finance', moduleId: 'bank-run', branch: 'Finanzas y riesgo', name: 'Banca (Diamond-Dybvig)',
      blurb: 'Tirole también trabajó en regulación de bancos. El paper clásico de Diamond-Dybvig. Próximamente.',
      accent: '#FDB813', glyph: '$', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'acemoglu-institutions', branch: 'Macro y crecimiento', name: 'Instituciones (Acemoglu)',
      blurb: 'Las plataformas son nuevas instituciones que estructuran el mercado. Acemoglu generaliza. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
  ],

  // Economía — Hart & Holmström 2016: contratos incompletos
  'econ-04-hart-holmstrom': [
    { branchId: 'info', moduleId: 'principal-agent', branch: 'Mercados e información', name: 'Principal-Agent · simulador',
      blurb: 'Mueve aversión al riesgo, ruido y productividad. Encuentra b* óptimo. Compara CEO vs cajera. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'coase-firm', branch: 'Mercados e información', name: 'Make-vs-Buy (Coase)',
      blurb: 'El paso anterior: por qué hay empresas. Hart y Holmström explican qué pasa adentro.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'spence-signaling', branch: 'Mercados e información', name: 'Señalización (Spence)',
      blurb: 'La asimetría afuera de la empresa. Adentro Holmström muestra otra: el esfuerzo no observable. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'two-sided-markets', branch: 'Mercados e información', name: 'Mercados de 2 lados (Tirole)',
      blurb: 'Cuando una empresa coordina dos lados — Visa, App Store, Uber — los contratos se hacen aún más complejos. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'mechanism-design', branch: 'Juegos y mecanismos', name: 'Mechanism Design',
      blurb: 'Hart-Holmström explican el contrato. Mechanism design generaliza: ¿cómo diseñas reglas óptimas? Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'acemoglu-institutions', branch: 'Macro y crecimiento', name: 'Instituciones (Acemoglu)',
      blurb: 'Si las empresas son contratos incompletos, los países también. Acemoglu generaliza al nivel nacional. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
  ],

  // Economía — Solow 1987: el modelo de crecimiento
  'econ-07-solow': [
    { branchId: 'macro', moduleId: 'solow-diagram', branch: 'Macro y crecimiento', name: 'Diagrama de Solow · simulador',
      blurb: 'Mueve s, δ, y la productividad A. Mira cómo cambia k* y la trayectoria hacia el estado estacionario. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'acemoglu-institutions', branch: 'Macro y crecimiento', name: 'Instituciones (Acemoglu)',
      blurb: 'Solow te dice que la tecnología importa. Acemoglu te dice por qué unos países pueden innovar. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'romer-ideas', branch: 'Macro y crecimiento', name: 'Romer · ideas endógenas',
      blurb: 'Romer convirtió la A exógena de Solow en una variable que depende de I+D. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'lucas-expectations', branch: 'Macro y crecimiento', name: 'Lucas · expectativas racionales',
      blurb: 'Si la gente prevé las acciones del gobierno, las políticas pierden efecto. La revolución macro. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'money', moduleId: 'friedman-monetary', branch: 'Dinero e inflación', name: 'Friedman · monetarismo',
      blurb: 'Cómo el dinero determina la inflación. MV=PY y la regla del k%. Próximamente.',
      accent: '#FB923C', glyph: '$', labUrl: '/econ-lab.html' },
    { branchId: 'development', moduleId: 'rct', branch: 'Pobreza y desarrollo', name: 'RCTs (Duflo)',
      blurb: 'Lo opuesto a la macro de Solow: medir qué políticas funcionan a nivel hogar. Próximamente.',
      accent: '#EF4444', glyph: '◆', labUrl: '/econ-lab.html' },
  ],

  // Economía — Kahneman & Smith 2002: sesgos y experimentos
  'econ-08-kahneman': [
    { branchId: 'behavior', moduleId: 'prospect-theory', branch: 'Comportamiento', name: 'Prospect Theory · simulador',
      blurb: 'Mueve λ (aversión a la pérdida) y α (curvatura). Encuentra qué apuestas aceptas y cuáles rechazas. Próximamente.',
      accent: '#D946EF', glyph: '◑', labUrl: '/econ-lab.html' },
    { branchId: 'behavior', moduleId: 'nudges', branch: 'Comportamiento', name: 'Nudges (Thaler)',
      blurb: 'Diseña defaults y opciones que empujan sin obligar. Donación de órganos, ahorro, salud. Próximamente.',
      accent: '#D946EF', glyph: '◑', labUrl: '/econ-lab.html' },
    { branchId: 'behavior', moduleId: 'experimental-market', branch: 'Comportamiento', name: 'Doble subasta (Vernon Smith)',
      blurb: 'Mete agentes con sesgos a un mercado. Mira cómo el precio converge al equilibrio competitivo. Próximamente.',
      accent: '#D946EF', glyph: '◑', labUrl: '/econ-lab.html' },
    { branchId: 'behavior', moduleId: 'bounded-rationality', branch: 'Comportamiento', name: 'Racionalidad acotada (Simon)',
      blurb: 'Simon ganó el Nobel 1978 por mostrar que no maximizamos: solo "satisface". El primer disparo. Próximamente.',
      accent: '#D946EF', glyph: '◑', labUrl: '/econ-lab.html' },
    { branchId: 'finance', moduleId: 'shiller-bubbles', branch: 'Finanzas y riesgo', name: 'Burbujas (Shiller)',
      blurb: 'Los mercados se vuelven locos porque la gente se vuelve loca. Shiller Nobel 2013. Próximamente.',
      accent: '#FDB813', glyph: '$', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'principal-agent', branch: 'Mercados e información', name: 'Principal-Agent',
      blurb: 'Cuando el agente tiene sesgos, ¿cómo diseñas el contrato? Holmström + Kahneman juntos. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
  ],

  // Economía — Acemoglu, Johnson, Robinson 2024: instituciones
  'econ-09-acemoglu': [
    { branchId: 'macro', moduleId: 'acemoglu-institutions', branch: 'Macro y crecimiento', name: 'Instituciones · simulador',
      blurb: 'Mueve los parámetros institucionales y mira cómo evoluciona la economía. Trayectorias inclusivas vs extractivas. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'solow-diagram', branch: 'Macro y crecimiento', name: 'Modelo de Solow',
      blurb: 'Solow te dice que la tecnología importa. Acemoglu te dice qué instituciones permiten que florezca. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'romer-ideas', branch: 'Macro y crecimiento', name: 'Romer · ideas',
      blurb: 'Las ideas son el motor del crecimiento. Pero solo florecen donde las instituciones lo permiten. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'mechanism-design', branch: 'Juegos y mecanismos', name: 'Mechanism Design',
      blurb: 'Si las instituciones son reglas, ¿cómo diseñas las óptimas? Maskin-Myerson llevan a Acemoglu. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'development', moduleId: 'rct', branch: 'Pobreza y desarrollo', name: 'RCTs (Duflo)',
      blurb: 'Acemoglu a nivel macro. Duflo al nivel micro: experimentos para ver qué reformas funcionan. Próximamente.',
      accent: '#EF4444', glyph: '◆', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'coase-firm', branch: 'Mercados e información', name: 'Empresas (Coase)',
      blurb: 'Las empresas son instituciones a pequeña escala. Acemoglu generaliza al nivel nacional.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
  ],

  // Economía — Friedman 1976: monetarismo
  'econ-10-friedman': [
    { branchId: 'money', moduleId: 'friedman-monetary', branch: 'Dinero e inflación', name: 'Cantidad de dinero · simulador',
      blurb: 'Mueve M, V, Y. Observa cómo se ajustan precios. Compara regla del k% vs discreción. Próximamente.',
      accent: '#FB923C', glyph: '$', labUrl: '/econ-lab.html' },
    { branchId: 'money', moduleId: 'phillips-curve', branch: 'Dinero e inflación', name: 'Curva de Phillips',
      blurb: 'Corto plazo vs largo plazo. Expectativas adaptativas. Cómo se desplaza la curva. Próximamente.',
      accent: '#FB923C', glyph: '$', labUrl: '/econ-lab.html' },
    { branchId: 'money', moduleId: 'mundell-otca', branch: 'Dinero e inflación', name: 'Zonas monetarias (Mundell)',
      blurb: 'Cuándo dos países deberían compartir moneda. La teoría del euro y por qué Argentina cae. Próximamente.',
      accent: '#FB923C', glyph: '$', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'lucas-expectations', branch: 'Macro y crecimiento', name: 'Expectativas racionales (Lucas)',
      blurb: 'Friedman dijo: expectativas adaptativas. Lucas fue más allá: racionales. Cambia el juego. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'kydland-prescott', branch: 'Macro y crecimiento', name: 'Consistencia temporal',
      blurb: 'Por qué Banxico es autónomo: para no caer en la tentación de imprimir antes de elecciones. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'finance', moduleId: 'bank-run', branch: 'Finanzas y riesgo', name: 'Crisis bancarias (Bernanke)',
      blurb: 'Bernanke heredó a Friedman: estudió la Gran Depresión y dirigió la Fed en 2008. Próximamente.',
      accent: '#FDB813', glyph: '$', labUrl: '/econ-lab.html' },
  ],

  // Economía — Roth & Shapley 2012: matching
  'econ-11-roth-shapley': [
    { branchId: 'games', moduleId: 'matching-deferred', branch: 'Juegos y mecanismos', name: 'Aceptación diferida · simulador',
      blurb: 'Pon listas de preferencias y mira al algoritmo de Gale-Shapley llegar al matching estable. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'kidney-exchange', branch: 'Juegos y mecanismos', name: 'Intercambio de riñones',
      blurb: 'Pares incompatibles. Cadenas de intercambio. Cómo se diseñan los matches que salvan vidas. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'school-choice', branch: 'Juegos y mecanismos', name: 'School choice (Boston)',
      blurb: 'Compara el mecanismo viejo manipulable con el nuevo strategy-proof. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'nash-2x2', branch: 'Juegos y mecanismos', name: 'Equilibrio Nash 2×2',
      blurb: 'Roth construye sobre Nash: del equilibrio al diseño. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'mechanism-design', branch: 'Juegos y mecanismos', name: 'Mechanism Design',
      blurb: 'La generalización: diseña reglas que llevan al equilibrio que quieres. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'auctions', branch: 'Juegos y mecanismos', name: 'Subastas',
      blurb: 'Cuando sí hay precio. Vickrey, English, Dutch. Milgrom y Wilson Nobel 2020. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
  ],

  // Economía — Sen 1998: capabilities
  'econ-12-sen': [
    { branchId: 'development', moduleId: 'capabilities', branch: 'Pobreza y desarrollo', name: 'Capabilities · simulador',
      blurb: 'Mueve ingreso, salud y educación. Compara dos personas con el mismo PIB y distintas capabilities. Próximamente.',
      accent: '#EF4444', glyph: '◆', labUrl: '/econ-lab.html' },
    { branchId: 'development', moduleId: 'idh', branch: 'Pobreza y desarrollo', name: 'IDH · multidimensional',
      blurb: 'Compara países con mismo PIB pero distinto desarrollo humano. ¿Por qué Costa Rica supera a EE.UU. en algunos índices? Próximamente.',
      accent: '#EF4444', glyph: '◆', labUrl: '/econ-lab.html' },
    { branchId: 'development', moduleId: 'rct', branch: 'Pobreza y desarrollo', name: 'RCTs (Duflo)',
      blurb: 'Sen filosofía. Duflo experimentos. Las dos caras de la economía del desarrollo. Próximamente.',
      accent: '#EF4444', glyph: '◆', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'acemoglu-institutions', branch: 'Macro y crecimiento', name: 'Instituciones (Acemoglu)',
      blurb: 'Sen dice: las instituciones importan solo si expanden libertad. Acemoglu las modela. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'labor', moduleId: 'goldin-gender', branch: 'Capital humano', name: 'Brecha de género (Goldin)',
      blurb: 'Sen identificó las "mujeres desaparecidas". Goldin explica cómo el mercado laboral sigue discriminando. Próximamente.',
      accent: '#22D3EE', glyph: '⚒', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'solow-diagram', branch: 'Macro y crecimiento', name: 'Solow · crecimiento',
      blurb: 'Solow mide PIB. Sen lo cuestiona. Las dos visiones de qué es progreso. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
  ],

  // Economía — Markowitz, Miller, Sharpe 1990: portafolios
  'econ-13-markowitz-sharpe': [
    { branchId: 'finance', moduleId: 'portfolio-frontier', branch: 'Finanzas y riesgo', name: 'Frontera eficiente · simulador',
      blurb: 'Mueve los pesos entre Cetes, bonos y acciones. Encuentra la frontera. Calcula el Sharpe ratio. Próximamente.',
      accent: '#FDB813', glyph: '$', labUrl: '/econ-lab.html' },
    { branchId: 'finance', moduleId: 'capm-beta', branch: 'Finanzas y riesgo', name: 'CAPM · beta',
      blurb: 'Calcula la beta de una acción contra el mercado. ¿Qué predice el rendimiento esperado? Próximamente.',
      accent: '#FDB813', glyph: '$', labUrl: '/econ-lab.html' },
    { branchId: 'finance', moduleId: 'black-scholes', branch: 'Finanzas y riesgo', name: 'Black-Scholes · opciones',
      blurb: 'La ecuación que mueve trillones al día. Calcula el valor de una call/put. Nobel 1997. Próximamente.',
      accent: '#FDB813', glyph: '$', labUrl: '/econ-lab.html' },
    { branchId: 'finance', moduleId: 'shiller-bubbles', branch: 'Finanzas y riesgo', name: 'Burbujas (Shiller)',
      blurb: 'Markowitz asume mercados eficientes. Shiller muestra que se vuelven locos. Compara las dos visiones. Próximamente.',
      accent: '#FDB813', glyph: '$', labUrl: '/econ-lab.html' },
    { branchId: 'finance', moduleId: 'bank-run', branch: 'Finanzas y riesgo', name: 'Corridas bancarias (Diamond-Dybvig)',
      blurb: 'El otro lado de las finanzas: cuando todo el portafolio colapsa por pánico. Bernanke Nobel 2022. Próximamente.',
      accent: '#FDB813', glyph: '$', labUrl: '/econ-lab.html' },
    { branchId: 'behavior', moduleId: 'prospect-theory', branch: 'Comportamiento', name: 'Sesgos del inversionista (Kahneman)',
      blurb: 'Markowitz dice cómo deberías invertir. Kahneman explica por qué no lo haces. Próximamente.',
      accent: '#D946EF', glyph: '◑', labUrl: '/econ-lab.html' },
  ],

  // Economía — Thaler 2017: nudges
  'econ-14-thaler': [
    { branchId: 'behavior', moduleId: 'nudges', branch: 'Comportamiento', name: 'Nudges · simulador',
      blurb: 'Diseña defaults para donación de órganos, ahorro, alimentación. Mira cómo cambia el comportamiento. Próximamente.',
      accent: '#D946EF', glyph: '◑', labUrl: '/econ-lab.html' },
    { branchId: 'behavior', moduleId: 'save-more-tomorrow', branch: 'Comportamiento', name: 'Save More Tomorrow',
      blurb: 'El programa SMarT de Thaler. Mueve % del aumento que se ahorra. Mira el efecto sobre tasa de ahorro. Próximamente.',
      accent: '#D946EF', glyph: '◑', labUrl: '/econ-lab.html' },
    { branchId: 'behavior', moduleId: 'prospect-theory', branch: 'Comportamiento', name: 'Prospect Theory (Kahneman)',
      blurb: 'La base teórica de los nudges: aversión a la pérdida, ponderación de probabilidades. Próximamente.',
      accent: '#D946EF', glyph: '◑', labUrl: '/econ-lab.html' },
    { branchId: 'behavior', moduleId: 'bounded-rationality', branch: 'Comportamiento', name: 'Racionalidad acotada (Simon)',
      blurb: 'El padre fundador del campo. Por qué no maximizamos: solo "satisfacemos". Próximamente.',
      accent: '#D946EF', glyph: '◑', labUrl: '/econ-lab.html' },
    { branchId: 'development', moduleId: 'rct', branch: 'Pobreza y desarrollo', name: 'RCTs (Duflo)',
      blurb: 'Cómo medimos si un nudge realmente funciona en el campo. Tratamiento vs control. Próximamente.',
      accent: '#EF4444', glyph: '◆', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'principal-agent', branch: 'Mercados e información', name: 'Principal-Agent',
      blurb: 'Si el agente tiene sesgos, ¿cómo diseñas el contrato? Holmström + Thaler juntos. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
  ],

  // Economía — Ostrom & Williamson 2009: comunes y gobernanza
  'econ-15-ostrom': [
    { branchId: 'development', moduleId: 'commons-abm', branch: 'Pobreza y desarrollo', name: 'Tragedia de los comunes · ABM',
      blurb: 'La simulación que viste, ahora con sliders. Cambia # de pastores, tasa de regeneración, nivel de cooperación. Próximamente.',
      accent: '#EF4444', glyph: '◆', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'coase-firm', branch: 'Mercados e información', name: 'Make-vs-Buy (Coase)',
      blurb: 'Coase preguntó: ¿por qué empresas? Williamson respondió: costos de transacción. Ostrom: ni Estado ni mercado.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'acemoglu-institutions', branch: 'Macro y crecimiento', name: 'Instituciones (Acemoglu)',
      blurb: 'Ostrom estudió instituciones a escala local. Acemoglu a escala nacional. Mismo principio. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'prisoners-iterated', branch: 'Juegos y mecanismos', name: 'Dilema iterado',
      blurb: 'La base teórica de la cooperación: TFT, Pavlov, Grim. Cuándo emerge la cooperación. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'development', moduleId: 'capabilities', branch: 'Pobreza y desarrollo', name: 'Capabilities (Sen)',
      blurb: 'Sen dice: el desarrollo es expansión de libertades. Ostrom muestra cómo se construyen colectivamente. Próximamente.',
      accent: '#EF4444', glyph: '◆', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'matching-deferred', branch: 'Juegos y mecanismos', name: 'Matching (Roth-Shapley)',
      blurb: 'Otra forma de gobernanza sin precio. Asignar recursos por reglas, no por mercado. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
  ],

  // Economía — Lucas 1995: expectativas racionales
  'econ-16-lucas': [
    { branchId: 'macro', moduleId: 'phillips-expectations', branch: 'Macro y crecimiento', name: 'Phillips dinámica · simulador',
      blurb: 'La simulación que viste con sliders. Compara régimen adaptativo (Friedman) vs racional (Lucas). Aplica shocks. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'money', moduleId: 'friedman-monetary', branch: 'Dinero e inflación', name: 'Monetarismo (Friedman)',
      blurb: 'El precursor: expectativas adaptativas. Próximamente.',
      accent: '#FB923C', glyph: '$', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'kydland-prescott', branch: 'Macro y crecimiento', name: 'Time consistency',
      blurb: 'Discípulos de Lucas: por qué Banxico es autónomo. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'rbc', branch: 'Macro y crecimiento', name: 'Real Business Cycles',
      blurb: 'La macro extrema: el dinero no importa, solo shocks reales. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'behavior', moduleId: 'bounded-rationality', branch: 'Comportamiento', name: 'Racionalidad acotada',
      blurb: 'La crítica directa a Lucas: los humanos no son racionales. Próximamente.',
      accent: '#D946EF', glyph: '◑', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'solow-diagram', branch: 'Macro y crecimiento', name: 'Solow · crecimiento',
      blurb: 'El otro pilar de la macro moderna. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
  ],

  // Economía — Mirrlees & Vickrey 1996: incentivos
  'econ-17-mirrlees-vickrey': [
    { branchId: 'games', moduleId: 'vickrey-auction', branch: 'Juegos y mecanismos', name: 'Subasta Vickrey · simulador',
      blurb: 'La subasta que viste con sliders de # postores y distribuciones. Compara con primera-precio e inglesa. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'mechanism-design', branch: 'Juegos y mecanismos', name: 'Mechanism Design (VCG)',
      blurb: 'La generalización de Vickrey: Maskin y Myerson Nobel 2007. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'matching-deferred', branch: 'Juegos y mecanismos', name: 'Matching (Roth-Shapley)',
      blurb: 'Otra rama de mechanism design: asignar sin precio. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
    { branchId: 'public', moduleId: 'optimal-tax', branch: 'Política pública', name: 'Impuestos óptimos (Mirrlees)',
      blurb: 'Mueve la curva de tasas marginales. Mira recaudación vs eficiencia. Próximamente.',
      accent: '#94A3B8', glyph: '¶', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'principal-agent', branch: 'Mercados e información', name: 'Principal-Agent',
      blurb: 'La otra cara: contratos bajo info asimétrica. Holmström Nobel 2016. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'screening', branch: 'Mercados e información', name: 'Screening (Stiglitz)',
      blurb: 'Otro mecanismo para extraer información privada. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
  ],

  // Economía — Coase 1991: ¿por qué existen las empresas?
  'econ-02-coase': [
    { branchId: 'info', moduleId: 'coase-firm', branch: 'Mercados e información', name: 'Make-vs-Buy · simulador',
      blurb: 'Decide tamaño óptimo: sliders de costos de mercado y de coordinación. Encuentra el cruce donde se equilibran. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'lemons', branch: 'Mercados e información', name: 'Mercado de limones',
      blurb: 'La clase anterior: información asimétrica mata mercados. Coase muestra qué hacemos cuando los mercados fallan.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'principal-agent', branch: 'Mercados e información', name: 'Principal-Agent (Holmström)',
      blurb: 'Dentro de la empresa hay otra asimetría: el empleado conoce su esfuerzo, el jefe no. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'info', moduleId: 'two-sided-markets', branch: 'Mercados e información', name: 'Mercados de 2 lados (Tirole)',
      blurb: 'Cuando una empresa coordina dos lados — Visa, App Store, Uber — los costos de transacción se transforman. Próximamente.',
      accent: '#F472B6', glyph: '◐', labUrl: '/econ-lab.html' },
    { branchId: 'macro', moduleId: 'acemoglu-institutions', branch: 'Macro y crecimiento', name: 'Instituciones (Acemoglu)',
      blurb: 'Las empresas son instituciones. Acemoglu generaliza: las instituciones determinan la prosperidad. Próximamente.',
      accent: '#34D399', glyph: '∮', labUrl: '/econ-lab.html' },
    { branchId: 'games', moduleId: 'mechanism-design', branch: 'Juegos y mecanismos', name: 'Mechanism Design',
      blurb: 'Cómo diseñar las reglas internas de una empresa para que los empleados digan la verdad. Próximamente.',
      accent: '#A78BFA', glyph: '⛀', labUrl: '/econ-lab.html' },
  ],

  // Clase de álgebra lineal — "El esqueleto escondido"
  'linalg-el-esqueleto-escondido': [
    { branchId: 'linalg', moduleId: 'matrix-3d', branch: 'Álgebra lineal', name: 'Matriz 3×3 como transformación',
      blurb: 'Cubo unitario → A·cubo. Siete presets canónicos animados. Las columnas de A son donde aterrizan los ejes.',
      accent: '#7E57C2', glyph: 'Λ' },
    { branchId: 'linalg', moduleId: 'eigen-3d', branch: 'Álgebra lineal', name: 'Eigenvectores en 3D',
      blurb: 'Strang lección 21. Las direcciones que A no rota — solo estira. Polinomio característico cerrado.',
      accent: '#7E57C2', glyph: 'Λ' },
    { branchId: 'linalg', moduleId: 'rotations', branch: 'Álgebra lineal', name: 'Rotaciones SO(3) y cuaterniones',
      blurb: 'Euler vs cuaterniones. Lleva pitch a 90° y mira el gimbal lock con tus propios ojos.',
      accent: '#7E57C2', glyph: 'Λ' },
    { branchId: 'linalg', moduleId: 'pca', branch: 'Álgebra lineal', name: 'PCA · ejes principales',
      blurb: 'Cinco distribuciones: esfera, pancake, cigarro, inclinada, casi-línea. Eigenvectores de la covarianza.',
      accent: '#7E57C2', glyph: 'Λ' },
    { branchId: 'complex', moduleId: 'mobius', branch: 'Análisis complejo', name: 'Möbius · esfera de Riemann',
      blurb: 'La rotación más limpia de todas vive en la esfera de Riemann — comparte estructura con SO(3).',
      accent: '#F472B6', glyph: 'ℂ' },
    { branchId: 'calc', moduleId: 'vector-fields', branch: 'Cálculo', name: 'Campos vectoriales',
      blurb: 'El siguiente paso: cuando cada punto del espacio tiene su propia matriz infinitesimal.',
      accent: '#4FC3F7', glyph: '∫' },
  ],

  // Masterclass de agujeros negros
  'blackhole': [
    { branchId: 'astro', moduleId: 'blackhole', branch: 'Astrofísica', name: 'Agujero negro · simulador completo',
      blurb: 'El sim que viste, ahora con sliders de masa y espín. Cygnus X-1, Sgr A*, M87*, Gargantua, TON 618 — y modo Personalizado.',
      accent: '#FDB813', glyph: '⬤', labUrl: '/physics.html' },
    { branchId: 'astro', moduleId: 'schwarzschild', branch: 'Astrofísica', name: 'Precesión del perihelio',
      blurb: 'Mercurio rompió a Newton — Einstein lo arregló con 43″/siglo. Mismo Schwarzschild que rige los BHs.',
      accent: '#FDB813', glyph: '⬤', labUrl: '/physics.html' },
    { branchId: 'astro', moduleId: 'solar-system', branch: 'Astrofísica', name: 'Sistema Solar (N-body)',
      blurb: 'Donde Newton aún funciona. JPL real, Verlet simpléctico. Mira la diferencia con la GR.',
      accent: '#FDB813', glyph: '⬤', labUrl: '/physics.html' },
    { branchId: 'em', moduleId: 'fields', branch: 'Electromagnetismo', name: 'Campos EM (Maxwell + Lorentz)',
      blurb: 'La otra fuerza fundamental. Cargas, corrientes, ciclotrón — todo lo que pasa fuera de la gravedad.',
      accent: '#E27B58', glyph: '⚡', labUrl: '/physics.html' },
    { branchId: 'quantum', moduleId: 'gaia-atom', branch: 'Cuántica', name: 'Átomo multielectrón ψ²',
      blurb: 'La cuántica que Hawking usó para derivar la temperatura del horizonte. Tabla periódica + nubes electrónicas reales.',
      accent: '#7E57C2', glyph: 'ψ', labUrl: '/lab.html' },
    { branchId: 'mech', moduleId: 'double-pendulum', branch: 'Mecánica clásica', name: 'Péndulo doble (caos)',
      blurb: 'Antes de la GR: caos determinista del Lagrangiano. ΔE/E < 10⁻¹².',
      accent: '#4FC3F7', glyph: '⚙', labUrl: '/physics.html' },
  ],

  // Clase de cálculo — "Lo infinitamente pequeño"
  'calc-lo-infinitamente-pequeno': [
    { branchId: 'calc', moduleId: 'derivative-1d', branch: 'Cálculo', name: 'Derivada como recta tangente',
      blurb: 'Mueve el slider h y mira cómo la secante rosa se vuelve la tangente dorada. Seis funciones canónicas.',
      accent: '#4FC3F7', glyph: '∫' },
    { branchId: 'calc', moduleId: 'integral-area', branch: 'Cálculo', name: 'Integral como área (Riemann)',
      blurb: 'Sumas izquierda, derecha, media, trapezoidal. Convergencia visible al subir N.',
      accent: '#4FC3F7', glyph: '∫' },
    { branchId: 'calc', moduleId: 'series', branch: 'Cálculo', name: 'Series de Taylor',
      blurb: 'Cinco funciones. Mira el polinomio dorado perseguir a la curva rosa con cada término extra.',
      accent: '#4FC3F7', glyph: '∫' },
    { branchId: 'calc', moduleId: 'tangent-plane', branch: 'Cálculo', name: 'Plano tangente y gradiente',
      blurb: 'Sube a dos variables. La superficie y el plano que la roza, con el gradiente apuntando cuesta arriba.',
      accent: '#4FC3F7', glyph: '∫' },
    { branchId: 'calc', moduleId: 'vector-fields', branch: 'Cálculo', name: 'Campos vectoriales y divergencia',
      blurb: 'Ocho presets canónicos: fuente, vórtice, silla, Coulomb 2D, dipolo, Helmholtz. Click para soltar partícula.',
      accent: '#4FC3F7', glyph: '∫' },
    { branchId: 'diffeq', moduleId: 'phase-portrait', branch: 'Ecuaciones diferenciales', name: 'Retrato de fases 2D',
      blurb: 'El siguiente paso natural: ecuaciones diferenciales con campos vectoriales. Suelta una hojita.',
      accent: '#FDB813', glyph: 'Ψ' },
  ],
};

const SUBTITLE_BY_CLASS: Record<string, string> = {
  i: 'Cada uno es un simulador 3D-real con clase guiada. Toca uno y empieza.',
  'calc-lo-infinitamente-pequeno': 'Cada simulación que viste tiene su propio laboratorio interactivo. Elige uno y juega.',
  'linalg-el-esqueleto-escondido': 'Las cuatro simulaciones de álgebra lineal te esperan. Encuentra el esqueleto tú mismo.',
  'econ-01-limones': 'Akerlof te dio la idea. Ahora muévele tú a los parámetros y mira qué pasa.',
  'econ-02-coase': 'Coase explicó por qué hay empresas. Sigue con el lab y luego con las otras instituciones.',
  'econ-03-spence': 'Spence te mostró cómo se manda una señal creíble. Pruébalo tú mismo en el lab.',
  'econ-04-hart-holmstrom': 'Adentro de la empresa: Hart y Holmström. El contrato siempre es incompleto. Sigue con los labs.',
  'econ-05-tirole': 'Tirole te mostró las plataformas. Ahora juega con los precios cruzados y network effects.',
  'econ-06-nash': 'Nash te dio la herramienta. Ahora arma tus propios juegos y encuentra equilibrios.',
  'econ-07-solow': 'Solow te dio el diagrama. Mueve s y δ, mira el estado estacionario, encuentra la regla de oro.',
  'econ-08-kahneman': 'Kahneman te mostró tus sesgos. Ahora juega con la función de valor y diseña nudges.',
  'econ-09-acemoglu': 'Acemoglu te explicó por qué Nogales no es Nogales. Sigue con los simuladores de instituciones.',
  'econ-10-friedman': 'Friedman te mostró el dinero. Mueve M, V, Y. Compara reglas vs discreción.',
  'econ-11-roth-shapley': 'Roth y Shapley diseñaron mercados sin precio. Arma tus listas de preferencias y mira al algoritmo encontrar el matching estable.',
  'econ-12-sen': 'Sen redefinió la pobreza. Mueve capabilities, no ingreso. Mira cómo cambia tu medida de desarrollo.',
  'econ-13-markowitz-sharpe': 'Markowitz le puso ecuaciones al riesgo. Mueve los pesos, encuentra la frontera, calcula el Sharpe ratio.',
  'econ-14-thaler': 'Thaler diseña defaults que cambian decisiones. Juega con donaciones, ahorro, alimentación. Sin obligar a nadie.',
  'econ-15-ostrom': 'Ostrom mostró que la tragedia no es inevitable. Mueve los parámetros de cooperación y mira cómo cambia el destino del común.',
  'econ-16-lucas': 'Lucas te enseñó: lo que la gente espera ES parte de lo que pasa. Compara regímenes, aplica shocks, mide la diferencia.',
  'econ-17-mirrlees-vickrey': 'Vickrey diseñó la subasta donde mentir no paga. Pon postores con sus valores y mira el equilibrio emerger.',
  'blackhole': 'Ahora prende uno tú. Cambia la masa: estelar, supermasivo, ultramasivo. Mueve el espín. Mira qué cambia.',
};

interface ModulePickerProps {
  visible: boolean;
  classId?: string;
}

export default function ModulePicker({ visible, classId = 'i' }: ModulePickerProps) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setShown(true), 350);
      return () => clearTimeout(t);
    } else {
      setShown(false);
    }
  }, [visible]);

  if (!visible) return null;

  const modules = MODULES_BY_CLASS[classId] ?? MODULES_BY_CLASS.i;
  const subtitle = SUBTITLE_BY_CLASS[classId] ?? SUBTITLE_BY_CLASS.i;

  return (
    <div
      className="absolute inset-0 z-50 transition-opacity duration-700"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(11,15,23,0.97) 0%, rgba(5,6,10,0.99) 70%)',
        opacity: shown ? 1 : 0,
      }}
    >
      <div className="relative h-full flex flex-col items-center justify-center px-8 py-12 overflow-y-auto">
        {/* Heading */}
        <div className="text-center mb-10">
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#FDB813] mb-3"
               style={{ transitionDelay: '200ms', transition: 'all 0.8s', opacity: shown ? 1 : 0, transform: shown ? 'translateY(0)' : 'translateY(20px)' }}>
            Y ahora…
          </div>
          <h2 className="text-[44px] md:text-[56px] font-extrabold leading-[0.95] tracking-tight text-white mb-3"
              style={{ transitionDelay: '400ms', transition: 'all 0.9s', opacity: shown ? 1 : 0, transform: shown ? 'translateY(0)' : 'translateY(24px)' }}>
            Elige tu módulo.
          </h2>
          <p className="text-[15px] text-[#94A3B8] max-w-xl"
             style={{ transitionDelay: '600ms', transition: 'all 1s', opacity: shown ? 1 : 0 }}>
            {subtitle}
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl w-full">
          {modules.map((m, i) => (
            <a
              key={`${m.branchId}/${m.moduleId}`}
              href={`${m.labUrl ?? '/math.html'}#${m.branchId}/${m.moduleId}`}
              className="group relative block rounded-xl border bg-[#0B0F17]/80 backdrop-blur p-5 hover:bg-[#0B0F17] transition-all hover:scale-[1.03]"
              style={{
                borderColor: m.accent + '40',
                transitionDelay: shown ? `${800 + i * 80}ms` : '0ms',
                transition: 'opacity 0.7s, transform 0.7s, background-color 0.2s, border-color 0.2s',
                opacity: shown ? 1 : 0,
                transform: shown ? 'translateY(0)' : 'translateY(28px)',
              }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-11 h-11 rounded-lg border flex items-center justify-center text-[22px] font-bold shrink-0"
                  style={{ borderColor: m.accent + '60', color: m.accent }}
                >
                  {m.glyph}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.15em] font-mono" style={{ color: m.accent }}>
                    {m.branch}
                  </div>
                  <h3 className="text-[16px] font-semibold text-white leading-tight mt-0.5">{m.name}</h3>
                </div>
              </div>
              <p className="text-[12px] text-[#CBD5E1] leading-relaxed">{m.blurb}</p>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#64748B]">Empezar</span>
                <span style={{ color: m.accent }} className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </a>
          ))}
        </div>

        {/* Footer escape */}
        <div className="mt-10 flex items-center gap-6 text-[11px] font-mono text-[#64748B]"
             style={{ transitionDelay: '1400ms', transition: 'opacity 0.6s', opacity: shown ? 1 : 0 }}>
          <a href="/escuela.html" className="hover:text-white">← volver al portal</a>
          <span>·</span>
          <a href="/math.html" className="hover:text-[#4FC3F7]">explorar todo Math Lab →</a>
        </div>
      </div>
    </div>
  );
}
