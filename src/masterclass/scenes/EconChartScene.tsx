/**
 * EconChartScene — el plot matemático protagonista.
 *
 * Cuando una escena de economía representa una RELACIÓN matemática (curvas
 * de costo, fronteras eficientes, Phillips curve, Solow steady state, etc.)
 * la representación correcta NO es una metáfora 3D sino un plot animado.
 *
 * Esta escena es phase-aware: cada `phase` (scene.id) declara qué curvas
 * dibujar, qué anotaciones aparecer cuándo, y qué punto se mueve. El SVG
 * se traza en tiempo real con `pathLength` + `strokeDasharray` animado.
 *
 * Cada masterclass registra sus phases acá abajo. Es un solo archivo y
 * cada nueva clase agrega su entrada al CHART_CONFIGS.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos

interface CurveSpec {
  /** Función de la curva sobre el dominio dado */
  fn: (x: number) => number;
  /** Color principal */
  color: string;
  /** Glow / shadow color (usualmente igual al color con alpha) */
  glow?: string;
  /** Ancho de línea */
  width?: number;
  /** Etiqueta para la leyenda */
  label: string;
  /** Cuándo aparece (segundos desde inicio de la escena) */
  appearAt: number;
  /** Si es dashed */
  dashed?: boolean;
}

interface Annotation {
  /** Texto / LaTeX (rodeado por $...$ se renderiza como KaTeX) */
  text: string;
  /** Posición en coordenadas del plot (x del dominio, y del rango) */
  at: [number, number];
  /** Cuándo aparece */
  appearAt: number;
  /** Color del texto */
  color?: string;
  /** Anchor: 'left', 'right', 'center' (default center) */
  anchor?: 'left' | 'right' | 'center';
  /** Si dibujar línea desde el punto a la etiqueta */
  withMarker?: boolean;
}

interface MovingPoint {
  /** Función paramétrica para la posición */
  fn: (t: number) => [number, number];
  /** Color */
  color: string;
  /** Cuándo aparece */
  appearAt: number;
  /** Velocidad del recorrido (1 = un loop por scene-length) */
  speed?: number;
}

interface ChartConfig {
  /** Dominio en x (eje horizontal) */
  xDomain: [number, number];
  /** Rango en y (eje vertical) */
  yDomain: [number, number];
  /** Labels de ejes */
  xLabel?: string;
  yLabel?: string;
  /** Tipo de ticks (auto detecta números base) */
  xTicks?: number[];
  yTicks?: number[];
  /** Curvas a dibujar */
  curves: CurveSpec[];
  /** Anotaciones LaTeX/texto */
  annotations?: Annotation[];
  /** Puntos móviles */
  points?: MovingPoint[];
  /** Título arriba del plot */
  title?: string;
  /** Subtítulo abajo del título */
  subtitle?: string;
  /** Color de acento para frames */
  accent?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de configs por phase
//
// Cada nueva masterclass añade sus entradas aquí. La estructura es:
//   CHART_CONFIGS[`<class-id>:<scene-id>`] = config

const CHART_CONFIGS: Record<string, ChartConfig> = {
  // ───── Coase 1991 ─────
  // Decision: make-vs-buy expressed as 2 curves crossing
  'econ-02-coase:06-decision': {
    title: 'Make vs Buy',
    subtitle: '¿Lo haces adentro o lo compras afuera?',
    accent: '#F472B6',
    xDomain: [0, 10],
    yDomain: [0, 5],
    xLabel: 'tamaño de la actividad',
    yLabel: 'costo',
    xTicks: [0, 2, 4, 6, 8, 10],
    yTicks: [0, 1, 2, 3, 4],
    curves: [
      {
        fn: (x) => 0.5 + 0.32 * x,   // cost of doing it inside grows linearly
        color: '#F472B6',
        label: 'C_adentro (coordinar)',
        appearAt: 1.0,
        width: 2.4,
      },
      {
        fn: (x) => 4.2 - 0.32 * x,   // cost of buying it outside decreases
        color: '#60A5FA',
        label: 'C_afuera (transactar)',
        appearAt: 2.5,
        width: 2.4,
      },
    ],
    annotations: [
      { text: 'cruza: $C_{adentro}=C_{afuera}$',
        at: [5.78, 2.35], appearAt: 5.5, color: '#FDB813', anchor: 'left', withMarker: true },
      { text: 'menor → elige',
        at: [2.5, 1.05], appearAt: 7.5, color: '#F472B6', anchor: 'center' },
      { text: 'menor → elige',
        at: [8, 1.65], appearAt: 9.0, color: '#60A5FA', anchor: 'center' },
    ],
  },

  // Optimal firm size: classic U-curve with minimum
  'econ-02-coase:07-tamano-optimo': {
    title: 'Tamaño óptimo de la empresa',
    subtitle: 'donde la suma de costos es mínima',
    accent: '#34D399',
    xDomain: [0, 10],
    yDomain: [0, 8],
    xLabel: 'tamaño de la empresa',
    yLabel: 'costo total',
    xTicks: [0, 2, 4, 6, 8, 10],
    yTicks: [0, 2, 4, 6, 8],
    curves: [
      {
        fn: (x) => Math.max(0.2, 4.5 - 0.5 * x),  // cost of market decreases as firm grows
        color: '#60A5FA',
        label: 'C_mercado',
        appearAt: 0.8,
        width: 2.0,
        dashed: true,
      },
      {
        fn: (x) => 0.5 + 0.13 * Math.pow(x, 1.55),  // cost of coordination grows super-linearly
        color: '#F472B6',
        label: 'C_coord',
        appearAt: 2.0,
        width: 2.0,
        dashed: true,
      },
      {
        fn: (x) => Math.max(0.2, 4.5 - 0.5 * x) + 0.5 + 0.13 * Math.pow(x, 1.55),
        color: '#FDB813',
        label: 'C_total = C_mercado + C_coord',
        appearAt: 4.0,
        width: 2.8,
      },
    ],
    annotations: [
      { text: '$x^*$ óptimo', at: [4.7, 4.7], appearAt: 7.0, color: '#34D399', anchor: 'center', withMarker: true },
      { text: 'pequeña → compra todo', at: [1, 0.8], appearAt: 9, color: '#60A5FA', anchor: 'left' },
      { text: 'grande → burocracia', at: [9, 5.5], appearAt: 11, color: '#F472B6', anchor: 'right' },
    ],
  },

  // ───── Akerlof (placeholder for refactor) ─────
  'econ-01-limones:05-distribucion': {
    title: 'Distribución de calidad',
    subtitle: 'el comprador valora cherry en \\$20k, lemon en \\$5k',
    accent: '#F472B6',
    xDomain: [0, 1],
    yDomain: [0, 25],
    xLabel: 'calidad q',
    yLabel: 'valor (\\$ miles)',
    xTicks: [0, 0.25, 0.5, 0.75, 1],
    yTicks: [0, 5, 10, 15, 20, 25],
    curves: [
      {
        fn: (q) => 5 + 15 * q,        // valor del dueño v(q)
        color: '#F472B6',
        label: 'v(q) — dueño',
        appearAt: 1.0,
        width: 2.4,
      },
      {
        fn: () => 12.5,               // E[v(q)] = promedio si q uniforme
        color: '#FDB813',
        label: 'E[v(q)] = \\$12.5k',
        appearAt: 4.0,
        width: 2.0,
        dashed: true,
      },
    ],
    annotations: [
      { text: 'cherry $\\to$ \\$20k', at: [1, 20], appearAt: 2, color: '#10B981', anchor: 'right' },
      { text: 'lemon $\\to$ \\$5k', at: [0, 5], appearAt: 2.5, color: '#FDB813', anchor: 'left' },
      { text: 'precio justo del comprador', at: [0.5, 12.5], appearAt: 5.5, color: '#FDB813', anchor: 'center', withMarker: true },
    ],
  },

  // ───── Spence 1973 — señalización ─────
  // 05-pooling: el sueldo promedio si el empleador no distingue
  'econ-03-spence:05-pooling': {
    title: 'Equilibrio pooling',
    subtitle: 'sin distinción, el empleador paga el promedio',
    accent: '#FDB813',
    xDomain: [0, 1],
    yDomain: [0, 50],
    xLabel: 'fracción de tipo alto en la población',
    yLabel: 'salario ofrecido (\\$ miles)',
    xTicks: [0, 0.25, 0.5, 0.75, 1],
    yTicks: [0, 10, 20, 30, 40, 50],
    curves: [
      {
        fn: (p) => 10 + 30 * p,         // E[valor] = 10·(1-p) + 40·p
        color: '#FDB813',
        label: 'sueldo pooling = E[valor]',
        appearAt: 0.8,
        width: 2.6,
      },
      {
        fn: () => 40,                    // salario que merecería el alto
        color: '#34D399',
        label: 'valor del alto = \\$40k',
        appearAt: 2.5,
        width: 1.6,
        dashed: true,
      },
      {
        fn: () => 10,                    // salario que merecería el bajo
        color: '#EF4444',
        label: 'valor del bajo = \\$10k',
        appearAt: 3.5,
        width: 1.6,
        dashed: true,
      },
    ],
    annotations: [
      { text: 'mitad y mitad $\\to$ \\$25k',
        at: [0.5, 25], appearAt: 5.5, color: '#FDB813', anchor: 'center', withMarker: true },
      { text: 'alto pierde \\$15k', at: [0.5, 38], appearAt: 7, color: '#34D399', anchor: 'center' },
      { text: 'bajo gana \\$15k', at: [0.5, 13], appearAt: 8.5, color: '#EF4444', anchor: 'center' },
    ],
  },

  // 07-costos: dos curvas de costo de educación según tipo
  'econ-03-spence:07-costos': {
    title: 'Costo de educarse · por tipo',
    subtitle: 'al alto le es más fácil — single-crossing property',
    accent: '#A78BFA',
    xDomain: [0, 10],
    yDomain: [0, 40],
    xLabel: 'años de educación s',
    yLabel: 'costo personal (\\$ miles)',
    xTicks: [0, 2, 4, 6, 8, 10],
    yTicks: [0, 10, 20, 30, 40],
    curves: [
      {
        fn: (s) => 1.6 * s,              // c_A(s) — alto, pendiente baja
        color: '#34D399',
        label: '$c_A(s)$ — alto',
        appearAt: 1.0,
        width: 2.6,
      },
      {
        fn: (s) => 3.6 * s,              // c_B(s) — bajo, pendiente alta
        color: '#EF4444',
        label: '$c_B(s)$ — bajo',
        appearAt: 3.0,
        width: 2.6,
      },
    ],
    annotations: [
      { text: '$\\text{slope}_B > \\text{slope}_A$',
        at: [8, 28.8], appearAt: 5.5, color: '#A78BFA', anchor: 'right', withMarker: true },
      { text: 'al alto le cuesta menos',
        at: [9, 14.4], appearAt: 7, color: '#34D399', anchor: 'right' },
    ],
  },

  // 08-equilibrio: el equilibrio separating
  'econ-03-spence:08-equilibrio': {
    title: 'Equilibrio separating',
    subtitle: 'el alto estudia $s^*$, el bajo no — y ahora se distinguen',
    accent: '#34D399',
    xDomain: [0, 10],
    yDomain: [0, 45],
    xLabel: 'años de educación s',
    yLabel: '\\$ miles',
    xTicks: [0, 2, 4, 6, 8, 10],
    yTicks: [0, 10, 20, 30, 40],
    curves: [
      {
        fn: (s) => 1.6 * s,              // c_A(s)
        color: '#34D399',
        label: '$c_A(s)$ — alto',
        appearAt: 0.8,
        width: 2.4,
      },
      {
        fn: (s) => 3.6 * s,              // c_B(s)
        color: '#EF4444',
        label: '$c_B(s)$ — bajo',
        appearAt: 1.6,
        width: 2.4,
      },
      {
        fn: () => 30,                    // ganancia salarial Δw = 40 - 10 = 30
        color: '#FDB813',
        label: '$\\Delta w = \\$30$k',
        appearAt: 3.5,
        width: 2.0,
        dashed: true,
      },
    ],
    annotations: [
      { text: '$s^*$ entre las curvas $\\to$ separa',
        at: [8.33, 30], appearAt: 6.5, color: '#FDB813', anchor: 'right', withMarker: true },
      { text: 'alto: $c_A(s^*) < \\Delta w$',
        at: [8, 13], appearAt: 8.5, color: '#34D399', anchor: 'right' },
      { text: 'bajo: $c_B(s^*) > \\Delta w$',
        at: [8, 36], appearAt: 10, color: '#EF4444', anchor: 'right' },
    ],
  },

  // ───── Hart & Holmström 2016 — contratos incompletos ─────
  // 04-tradeoff: utilidad del trabajador en función de b (fracción de comisión)
  'econ-04-hart-holmstrom:04-tradeoff': {
    title: 'Riesgo vs incentivos',
    subtitle: 'el sueldo es $w=a+b\\cdot y$ — más $b$, más incentivo pero más riesgo',
    accent: '#FDB813',
    xDomain: [0, 1],
    yDomain: [0, 5],
    xLabel: 'fracción variable b',
    yLabel: 'utilidad',
    xTicks: [0, 0.25, 0.5, 0.75, 1],
    yTicks: [0, 1, 2, 3, 4, 5],
    curves: [
      {
        // Utilidad por incentivo: monótonamente creciente con b
        fn: (b) => 3.2 * b,
        color: '#34D399',
        label: 'esfuerzo (sube con b)',
        appearAt: 0.8,
        width: 2.4,
        dashed: true,
      },
      {
        // Costo de riesgo: crece con b² (varianza)
        fn: (b) => 3.6 * b * b,
        color: '#EF4444',
        label: 'costo del riesgo (sube con b²)',
        appearAt: 2.4,
        width: 2.4,
        dashed: true,
      },
      {
        // Utilidad neta: diferencia, tiene un máximo en b* = 0.44
        fn: (b) => 3.2 * b - 3.6 * b * b,
        color: '#FDB813',
        label: 'utilidad neta',
        appearAt: 4.5,
        width: 2.8,
      },
    ],
    annotations: [
      { text: '$b^*$ óptimo $\\approx 0.44$',
        at: [0.44, 0.71], appearAt: 7.5, color: '#FDB813', anchor: 'right', withMarker: true },
      { text: 'todo fijo $\\to$ sin esfuerzo',
        at: [0, 0], appearAt: 9, color: '#94A3B8', anchor: 'left' },
      { text: 'todo variable $\\to$ riesgo total',
        at: [1, -0.4], appearAt: 10.5, color: '#94A3B8', anchor: 'right' },
    ],
  },

  // 05-formula: b* como función del ruido del output (σ²)
  'econ-04-hart-holmstrom:05-formula': {
    title: 'La fórmula óptima',
    subtitle: '$b^* = 1 / (1 + r\\sigma^2/k)$ — más ruido, menos comisión',
    accent: '#34D399',
    xDomain: [0, 5],
    yDomain: [0, 1],
    xLabel: 'ruido del resultado σ²',
    yLabel: 'fracción óptima b*',
    xTicks: [0, 1, 2, 3, 4, 5],
    yTicks: [0, 0.25, 0.5, 0.75, 1],
    curves: [
      {
        // b* = 1/(1 + 0.5·σ²) — empleado relativamente productivo
        fn: (s) => 1 / (1 + 0.5 * s),
        color: '#34D399',
        label: 'CEO · $k$ alto, $r$ bajo',
        appearAt: 0.8,
        width: 2.4,
      },
      {
        // b* = 1/(1 + 2·σ²) — empleado averso al riesgo
        fn: (s) => 1 / (1 + 2 * s),
        color: '#EF4444',
        label: 'cajera · $k$ bajo, $r$ alto',
        appearAt: 2.8,
        width: 2.4,
      },
    ],
    annotations: [
      { text: 'sin ruido: $b^*=1$ (todo comisión)',
        at: [0, 1], appearAt: 5.5, color: '#34D399', anchor: 'left', withMarker: true },
      { text: 'mucho ruido: $b^*\\to 0$',
        at: [5, 0.05], appearAt: 7.5, color: '#EF4444', anchor: 'right' },
    ],
  },

  // ───── Tirole 2014 — mercados de dos lados ─────
  // 05-cruzadas: utilidad de cada lado crece con tamaño del otro
  'econ-05-tirole:05-cruzadas': {
    title: 'Externalidad cruzada',
    subtitle: 'la utilidad de cada lado crece con el tamaño del otro',
    accent: '#F472B6',
    xDomain: [0, 100],
    yDomain: [0, 50],
    xLabel: 'tamaño del otro lado',
    yLabel: 'utilidad personal',
    xTicks: [0, 20, 40, 60, 80, 100],
    yTicks: [0, 10, 20, 30, 40, 50],
    curves: [
      {
        // Utilidad del pasajero crece con conductores (con saturación)
        fn: (n) => 40 * (1 - Math.exp(-n / 30)),
        color: '#34D399',
        label: 'pasajero · más conductores $\\to$ menos espera',
        appearAt: 1.0,
        width: 2.6,
      },
      {
        // Utilidad del conductor crece con pasajeros
        fn: (n) => 35 * (1 - Math.exp(-n / 40)),
        color: '#A78BFA',
        label: 'conductor · más pasajeros $\\to$ más viajes',
        appearAt: 3.0,
        width: 2.6,
      },
    ],
    annotations: [
      { text: 'sin el otro lado $\\to$ nada',
        at: [0, 0], appearAt: 6, color: '#94A3B8', anchor: 'left' },
      { text: 'masa crítica $\\Rightarrow$ valor explota',
        at: [40, 31], appearAt: 8, color: '#FDB813', anchor: 'right', withMarker: true },
    ],
  },

  // 06-precio-asimetrico: pricing óptimo asimétrico
  'econ-05-tirole:06-precio-asimetrico': {
    title: 'Pricing óptimo · 2 lados',
    subtitle: 'al lado sensible se le subsidia, al insensible se le cobra',
    accent: '#FDB813',
    xDomain: [0, 1],
    yDomain: [-3, 6],
    xLabel: 'fracción del costo total al lado A',
    yLabel: 'precio (\\$)',
    xTicks: [0, 0.25, 0.5, 0.75, 1],
    yTicks: [-3, 0, 3, 6],
    curves: [
      {
        // Precio al lado A — crece linealmente
        fn: (frac) => -2 + frac * 7,
        color: '#34D399',
        label: '$p_A$ · usuarios',
        appearAt: 1.0,
        width: 2.4,
      },
      {
        // Precio al lado B — decrece (lo opuesto)
        fn: (frac) => 5 - frac * 7,
        color: '#EF4444',
        label: '$p_B$ · comercios/desarrolladores',
        appearAt: 2.6,
        width: 2.4,
      },
      {
        // Precio combinado (constante = costo total)
        fn: () => 3,
        color: '#FDB813',
        label: 'costo total cubierto',
        appearAt: 4.5,
        width: 1.8,
        dashed: true,
      },
    ],
    annotations: [
      { text: 'Visa óptimo: $p_A=0$, $p_B=2\\%$',
        at: [0.28, 0], appearAt: 7, color: '#FDB813', anchor: 'left', withMarker: true },
      { text: 'subsidio al sensible',
        at: [0, -2], appearAt: 8.5, color: '#34D399', anchor: 'left' },
    ],
  },

  // 09-network-effects: utilidad vs tamaño total (tipping point)
  'econ-05-tirole:09-network-effects': {
    title: 'Network effects · tipping point',
    subtitle: 'curva creciente $\\to$ winner-take-all',
    accent: '#A78BFA',
    xDomain: [0, 100],
    yDomain: [0, 100],
    xLabel: 'tamaño de la plataforma (% del mercado)',
    yLabel: 'valor por usuario',
    xTicks: [0, 20, 40, 60, 80, 100],
    yTicks: [0, 25, 50, 75, 100],
    curves: [
      {
        // Mercado tradicional: plano (escala normal, sin network effects)
        fn: () => 35,
        color: '#94A3B8',
        label: 'mercado normal · sin network effects',
        appearAt: 0.8,
        width: 1.6,
        dashed: true,
      },
      {
        // Mercado con network effects: sube cuadráticamente
        fn: (n) => Math.min(100, 0.01 * n * n),
        color: '#A78BFA',
        label: '2 lados · network effects',
        appearAt: 2.5,
        width: 2.8,
      },
    ],
    annotations: [
      { text: 'tipping point $\\approx 50\\%$',
        at: [50, 25], appearAt: 6, color: '#FDB813', anchor: 'center', withMarker: true },
      { text: 'líder se queda con todo',
        at: [90, 81], appearAt: 8, color: '#A78BFA', anchor: 'right' },
    ],
  },

  // ───── Solow 1987 — crecimiento ─────
  // 05-diagrama: Solow diagram — sf(k) and δk crossing at steady state k*
  'econ-07-solow:05-diagrama': {
    title: 'Diagrama de Solow',
    subtitle: 'inversión $s\\cdot f(k)$ vs depreciación $\\delta k$',
    accent: '#34D399',
    xDomain: [0, 10],
    yDomain: [0, 4],
    xLabel: 'capital por trabajador k',
    yLabel: 'inversión / depreciación',
    xTicks: [0, 2, 4, 6, 8, 10],
    yTicks: [0, 1, 2, 3, 4],
    curves: [
      {
        fn: (k) => 1.2 * Math.pow(k, 0.33),
        color: '#60A5FA',
        label: '$f(k) = k^{1/3}$ — producción',
        appearAt: 0.8,
        width: 2.0,
        dashed: true,
      },
      {
        fn: (k) => 0.35 * 1.2 * Math.pow(k, 0.33),
        color: '#FDB813',
        label: '$s \\cdot f(k)$ — inversión ($s=0.35$)',
        appearAt: 2.0,
        width: 2.8,
      },
      {
        fn: (k) => 0.08 * k,
        color: '#EF4444',
        label: '$\\delta k$ — depreciación ($\\delta=0.08$)',
        appearAt: 4.0,
        width: 2.4,
      },
    ],
    annotations: [
      { text: '$k^*$ estado estacionario',
        at: [5.25, 0.42], appearAt: 7.0, color: '#34D399', anchor: 'center', withMarker: true },
      { text: '$k < k^*$: crece',
        at: [2, 0.22], appearAt: 9.0, color: '#FDB813', anchor: 'left' },
      { text: '$k > k^*$: decrece',
        at: [8.5, 0.68], appearAt: 10.5, color: '#EF4444', anchor: 'right' },
    ],
  },

  // 10-convergencia-datos: conditional convergence — growth vs initial GDP
  'econ-07-solow:10-convergencia-datos': {
    title: 'Convergencia condicional',
    subtitle: 'países pobres crecen más rápido (si condiciones son similares)',
    accent: '#34D399',
    xDomain: [0, 40],
    yDomain: [0, 8],
    xLabel: 'PIB per cápita inicial (\\$ miles)',
    yLabel: 'tasa de crecimiento (\\% anual)',
    xTicks: [0, 10, 20, 30, 40],
    yTicks: [0, 2, 4, 6, 8],
    curves: [
      {
        fn: (y0) => Math.max(0.5, 7 - 0.18 * y0),
        color: '#34D399',
        label: 'convergencia OECD',
        appearAt: 1.0,
        width: 2.6,
      },
      {
        fn: (y0) => Math.max(0.3, 4.5 - 0.06 * y0 + 0.002 * Math.sin(y0 * 0.8) * 3),
        color: '#94A3B8',
        label: 'todos los países (dispersión)',
        appearAt: 3.5,
        width: 1.6,
        dashed: true,
      },
    ],
    annotations: [
      { text: 'Japón, Alemania $\\to$ catch-up',
        at: [5, 6.1], appearAt: 6.0, color: '#34D399', anchor: 'left', withMarker: true },
      { text: 'EE.UU. $\\to$ lento pero rico',
        at: [35, 2], appearAt: 8.0, color: '#60A5FA', anchor: 'right', withMarker: true },
      { text: 'algunos pobres $\\to$ no convergen',
        at: [8, 2], appearAt: 10.0, color: '#94A3B8', anchor: 'center' },
    ],
  },

  // ───── Kahneman 2002 — prospect theory ─────
  // 06-prospect: S-shaped value function
  'econ-08-kahneman:06-prospect': {
    title: 'Función de valor · Prospect Theory',
    subtitle: 'ganancias cóncavas, pérdidas convexas y más empinadas ($\\lambda \\approx 2.25$)',
    accent: '#D946EF',
    xDomain: [-5, 5],
    yDomain: [-6, 4],
    xLabel: 'resultado x',
    yLabel: 'valor percibido v(x)',
    xTicks: [-4, -2, 0, 2, 4],
    yTicks: [-6, -4, -2, 0, 2, 4],
    curves: [
      {
        fn: (x) => x >= 0 ? Math.pow(x, 0.88) : -2.25 * Math.pow(-x, 0.88),
        color: '#D946EF',
        label: '$v(x)$ — prospect theory',
        appearAt: 1.0,
        width: 2.8,
      },
      {
        fn: (x) => x,
        color: '#475569',
        label: 'referencia lineal (racional)',
        appearAt: 0.5,
        width: 1.2,
        dashed: true,
      },
    ],
    annotations: [
      { text: 'ganancias: cóncava',
        at: [3.5, 2.8], appearAt: 4.5, color: '#34D399', anchor: 'right' },
      { text: 'pérdidas: convexa y $\\times 2.25$',
        at: [-3.5, -5.2], appearAt: 6.5, color: '#EF4444', anchor: 'left' },
      { text: 'punto de referencia',
        at: [0, 0], appearAt: 3.0, color: '#FDB813', anchor: 'left', withMarker: true },
    ],
  },

  // 07-probabilidades: probability weighting function
  'econ-08-kahneman:07-probabilidades': {
    title: 'Ponderación de probabilidades',
    subtitle: '$\\pi(p)$: sobrevaloras lo raro, subvaloras lo seguro',
    accent: '#D946EF',
    xDomain: [0, 1],
    yDomain: [0, 1],
    xLabel: 'probabilidad real p',
    yLabel: 'peso decisional π(p)',
    xTicks: [0, 0.25, 0.5, 0.75, 1],
    yTicks: [0, 0.25, 0.5, 0.75, 1],
    curves: [
      {
        fn: (p) => p,
        color: '#475569',
        label: '$\\pi = p$ (racional)',
        appearAt: 0.5,
        width: 1.2,
        dashed: true,
      },
      {
        fn: (p) => {
          if (p <= 0) return 0;
          if (p >= 1) return 1;
          const g = 0.61;
          return Math.pow(p, g) / Math.pow(Math.pow(p, g) + Math.pow(1 - p, g), 1 / g);
        },
        color: '#D946EF',
        label: '$\\pi(p)$ — Kahneman-Tversky',
        appearAt: 1.5,
        width: 2.8,
      },
    ],
    annotations: [
      { text: 'sobrevalora lo raro',
        at: [0.08, 0.18], appearAt: 4.5, color: '#FDB813', anchor: 'left', withMarker: true },
      { text: 'subvalora lo seguro',
        at: [0.85, 0.72], appearAt: 6.5, color: '#EF4444', anchor: 'right', withMarker: true },
      { text: 'certeza: $\\pi(1)=1$',
        at: [1, 1], appearAt: 8.0, color: '#34D399', anchor: 'right' },
    ],
  },

  // ───── Acemoglu 2024 — instituciones ─────
  // 06-instrumento: settler mortality vs GDP (conceptual relationship)
  'econ-09-acemoglu:06-instrumento': {
    title: 'Mortalidad colonial → PIB actual',
    subtitle: 'la tasa de muerte de los colonizadores predice la riqueza de hoy',
    accent: '#34D399',
    xDomain: [0, 500],
    yDomain: [0, 40],
    xLabel: 'mortalidad de colonos (por 1000/año)',
    yLabel: 'PIB per cápita actual (\\$ miles)',
    xTicks: [0, 100, 200, 300, 400, 500],
    yTicks: [0, 10, 20, 30, 40],
    curves: [
      {
        fn: (m) => Math.max(1, 38 * Math.exp(-0.008 * m)),
        color: '#34D399',
        label: 'relación estimada (AJR 2001)',
        appearAt: 1.5,
        width: 2.8,
      },
    ],
    annotations: [
      { text: 'EE.UU., Australia $\\to$ baja mortalidad',
        at: [20, 36], appearAt: 4.5, color: '#60A5FA', anchor: 'left', withMarker: true },
      { text: 'Nigeria, Congo $\\to$ alta mortalidad',
        at: [400, 2.5], appearAt: 7.0, color: '#EF4444', anchor: 'right', withMarker: true },
      { text: 'México $\\to$ intermedio',
        at: [150, 12], appearAt: 9.0, color: '#FDB813', anchor: 'center', withMarker: true },
    ],
  },

  // ───── Friedman 1976 — monetarismo ─────
  // 05-phillips: short-run Phillips curve
  'econ-10-friedman:05-phillips': {
    title: 'Curva de Phillips · corto plazo',
    subtitle: 'relación negativa entre inflación y desempleo',
    accent: '#FB923C',
    xDomain: [0, 12],
    yDomain: [0, 12],
    xLabel: 'tasa de desempleo (\\%)',
    yLabel: 'tasa de inflación (\\%)',
    xTicks: [0, 2, 4, 6, 8, 10, 12],
    yTicks: [0, 2, 4, 6, 8, 10, 12],
    curves: [
      {
        fn: (u) => Math.max(0.5, 10 - 1.2 * u + 0.04 * u * u),
        color: '#FB923C',
        label: 'Phillips corto plazo ($\\pi^e = 2\\%$)',
        appearAt: 1.0,
        width: 2.8,
      },
    ],
    annotations: [
      { text: 'bajo desempleo $\\to$ alta inflación',
        at: [2, 8], appearAt: 4.0, color: '#EF4444', anchor: 'left', withMarker: true },
      { text: 'alto desempleo $\\to$ baja inflación',
        at: [9, 1.5], appearAt: 6.0, color: '#34D399', anchor: 'right', withMarker: true },
      { text: 'keynesianos: elige tu punto',
        at: [5, 5], appearAt: 8.0, color: '#FDB813', anchor: 'center' },
    ],
  },

  // 07-largo-plazo: long-run vertical Phillips + shifted short-run curves
  'econ-10-friedman:07-largo-plazo': {
    title: 'Phillips · largo plazo',
    subtitle: 'vertical en $u^*$ — más dinero solo da más inflación',
    accent: '#FB923C',
    xDomain: [0, 12],
    yDomain: [0, 14],
    xLabel: 'tasa de desempleo (\\%)',
    yLabel: 'tasa de inflación (\\%)',
    xTicks: [0, 2, 4, 6, 8, 10, 12],
    yTicks: [0, 2, 4, 6, 8, 10, 12, 14],
    curves: [
      {
        fn: (u) => Math.max(0, 8 - 1.1 * u + 0.035 * u * u),
        color: '#94A3B8',
        label: 'CP baja ($\\pi^e = 2\\%$)',
        appearAt: 0.8,
        width: 1.6,
        dashed: true,
      },
      {
        fn: (u) => Math.max(0, 12 - 1.1 * u + 0.035 * u * u),
        color: '#94A3B8',
        label: 'CP alta ($\\pi^e = 6\\%$)',
        appearAt: 2.5,
        width: 1.6,
        dashed: true,
      },
      {
        fn: (u) => Math.max(0, 16 - 1.1 * u + 0.035 * u * u),
        color: '#94A3B8',
        label: 'CP más alta ($\\pi^e = 10\\%$)',
        appearAt: 4.0,
        width: 1.6,
        dashed: true,
      },
      {
        fn: () => -999,
        color: '#FB923C',
        label: 'largo plazo: vertical en $u^*$',
        appearAt: 99,
        width: 0,
      },
    ],
    annotations: [
      { text: '$u^* \\approx 5\\%$ — tasa natural',
        at: [5, 13], appearAt: 6.0, color: '#FB923C', anchor: 'center', withMarker: true },
      { text: '$\\uparrow M \\to$ solo sube $\\pi$',
        at: [5, 9], appearAt: 8.0, color: '#EF4444', anchor: 'center' },
      { text: '$u$ siempre vuelve a $u^*$',
        at: [5, 4], appearAt: 10.0, color: '#34D399', anchor: 'center' },
    ],
    points: [
      {
        fn: (t) => [5, 0.5 + 12 * Math.min(1, t)],
        color: '#FB923C',
        appearAt: 5.5,
        speed: 0.15,
      },
    ],
  },

  // ───── Markowitz & Sharpe 1990 — portafolios ─────
  // 05-frontera: la frontera eficiente de Markowitz
  'econ-13-markowitz-sharpe:05-frontera': {
    title: 'Frontera eficiente',
    subtitle: 'el máximo rendimiento alcanzable para cada nivel de riesgo',
    accent: '#FDB813',
    xDomain: [0, 0.4],
    yDomain: [0, 0.25],
    xLabel: 'riesgo σ (desv. estándar)',
    yLabel: 'rendimiento esperado μ',
    xTicks: [0, 0.1, 0.2, 0.3, 0.4],
    yTicks: [0, 0.05, 0.1, 0.15, 0.2, 0.25],
    curves: [
      {
        fn: (sigma) => 0.06 + 0.35 * Math.sqrt(Math.max(0, sigma * sigma - 0.0064)),
        color: '#FDB813',
        label: 'frontera eficiente',
        appearAt: 1.0,
        width: 2.8,
      },
      {
        fn: (sigma) => Math.max(0, 0.06 - 0.18 * Math.sqrt(Math.max(0, sigma * sigma - 0.0064))),
        color: '#475569',
        label: 'portafolios dominados',
        appearAt: 3.5,
        width: 1.6,
        dashed: true,
      },
    ],
    annotations: [
      { text: 'mínima varianza',
        at: [0.08, 0.06], appearAt: 5.5, color: '#34D399', anchor: 'left', withMarker: true },
      { text: 'Cetes (~bono)',
        at: [0.02, 0.04], appearAt: 7.0, color: '#60A5FA', anchor: 'left', withMarker: true },
      { text: 'IPC · acciones MX',
        at: [0.25, 0.155], appearAt: 8.5, color: '#F472B6', anchor: 'right', withMarker: true },
      { text: 'todo en una sola acción',
        at: [0.38, 0.16], appearAt: 10.5, color: '#EF4444', anchor: 'right', withMarker: true },
    ],
  },

  // 08-sharpe-ratio: la pendiente de la línea desde rf
  'econ-13-markowitz-sharpe:08-sharpe-ratio': {
    title: 'Sharpe Ratio · la pendiente desde $r_f$',
    subtitle: 'mayor pendiente = mejor rendimiento por unidad de riesgo',
    accent: '#34D399',
    xDomain: [0, 0.4],
    yDomain: [0, 0.25],
    xLabel: 'riesgo σ',
    yLabel: 'rendimiento esperado μ',
    xTicks: [0, 0.1, 0.2, 0.3, 0.4],
    yTicks: [0, 0.05, 0.1, 0.15, 0.2, 0.25],
    curves: [
      {
        fn: (sigma) => 0.03 + 0.6 * sigma,
        color: '#34D399',
        label: 'Fondo A · Sharpe = 0.6 (bueno)',
        appearAt: 1.5,
        width: 2.4,
      },
      {
        fn: (sigma) => 0.03 + 0.25 * sigma,
        color: '#EF4444',
        label: 'Fondo B · Sharpe = 0.25 (pobre)',
        appearAt: 3.5,
        width: 2.4,
      },
    ],
    annotations: [
      { text: '$r_f = 3\\%$ (Cetes)',
        at: [0, 0.03], appearAt: 0.5, color: '#94A3B8', anchor: 'left', withMarker: true },
      { text: 'Fondo A: $12\\%$ a $15\\%$ de riesgo',
        at: [0.15, 0.12], appearAt: 5.0, color: '#34D399', anchor: 'right', withMarker: true },
      { text: 'Fondo B: $8\\%$ a $20\\%$ de riesgo',
        at: [0.2, 0.08], appearAt: 7.0, color: '#EF4444', anchor: 'right', withMarker: true },
      { text: 'pendiente = Sharpe ratio',
        at: [0.3, 0.21], appearAt: 9.0, color: '#FDB813', anchor: 'right' },
    ],
  },

  // ───── Nash 1994 — equilibrio ─────
  // 09-mejores-resp: curvas de mejor respuesta cruzándose en el equilibrio Nash
  // Ejemplo: penalty kicks. p = prob portero salta izquierda. q = prob delantero patea izq.
  // El delantero quiere desviarse del portero. β_delantero(p) tiene pendiente positiva.
  // El portero quiere ir donde patea. β_portero(q) tiene pendiente positiva.
  // Para que crucen en Nash, las pendientes son opuestas en (p, q).
  'econ-06-nash:09-mejores-resp': {
    title: 'Curvas de mejor respuesta',
    subtitle: 'el cruce es el equilibrio de Nash',
    accent: '#FDB813',
    xDomain: [0, 1],
    yDomain: [0, 1],
    xLabel: 'probabilidad del rival p',
    yLabel: 'mi mejor respuesta q*',
    xTicks: [0, 0.25, 0.5, 0.75, 1],
    yTicks: [0, 0.25, 0.5, 0.75, 1],
    curves: [
      {
        // Jugador A: si rival juega p=0, A juega q=0; si p=1, A juega q=1.
        // En equilibrio mixto, esta es la curva del A.
        fn: (p) => p < 0.4 ? 0 : p > 0.6 ? 1 : (p - 0.4) * 5,
        color: '#34D399',
        label: '$\\beta_A$ — mejor respuesta jugador A',
        appearAt: 1.0,
        width: 2.4,
      },
      {
        // Jugador B: invertida — converge al mismo punto del equilibrio
        fn: (p) => p < 0.4 ? 1 : p > 0.6 ? 0 : 1 - (p - 0.4) * 5,
        color: '#F472B6',
        label: '$\\beta_B$ — mejor respuesta jugador B',
        appearAt: 2.8,
        width: 2.4,
      },
    ],
    annotations: [
      { text: 'cruce $\\to$ equilibrio Nash',
        at: [0.5, 0.5], appearAt: 5.5, color: '#FDB813', anchor: 'center', withMarker: true },
      { text: 'A juega p si B juega q',
        at: [0.85, 1], appearAt: 7.5, color: '#34D399', anchor: 'right' },
      { text: 'B juega q si A juega p',
        at: [0.85, 0], appearAt: 9, color: '#F472B6', anchor: 'right' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderText(text: string, color: string = '#E2E8F0'): string {
  // Replace $...$ with KaTeX HTML
  let out = '';
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('$', i);
    if (start === -1) {
      out += `<span style="color:${color}">${escapeHtml(text.slice(i))}</span>`;
      break;
    }
    if (start > i) {
      out += `<span style="color:${color}">${escapeHtml(text.slice(i, start))}</span>`;
    }
    const end = text.indexOf('$', start + 1);
    if (end === -1) {
      out += `<span style="color:${color}">${escapeHtml(text.slice(start))}</span>`;
      break;
    }
    const math = text.slice(start + 1, end);
    try {
      out += katex.renderToString(math, { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      out += escapeHtml(math);
    }
    i = end + 1;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente

interface SceneProps {
  /** scene.id (ej. '06-decision') */
  phase: string;
  /** classId of the masterclass (ej. 'econ-02-coase') — passed by Player */
  classId: string;
}

export default function EconChartScene({ phase, classId }: SceneProps) {
  const config = CHART_CONFIGS[`${classId}:${phase}`];
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    let raf: number;
    const tick = () => {
      setElapsed((Date.now() - startRef.current) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, classId]);

  if (!config) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#475569] text-[12px] font-mono"
           style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #03050A 85%)' }}>
        no chart config for {classId}:{phase}
      </div>
    );
  }

  // SVG dimensions
  const W = 1100;
  const H = 620;
  const m = { top: 70, right: 60, bottom: 80, left: 80 };
  const w = W - m.left - m.right;
  const h = H - m.top - m.bottom;

  const xScale = (x: number) =>
    m.left + ((x - config.xDomain[0]) / (config.xDomain[1] - config.xDomain[0])) * w;
  const yScale = (y: number) =>
    m.top + h - ((y - config.yDomain[0]) / (config.yDomain[1] - config.yDomain[0])) * h;

  const N = 120;
  const samples = useMemo(() => {
    return Array.from({ length: N }, (_, i) => {
      const x = config.xDomain[0] + (config.xDomain[1] - config.xDomain[0]) * (i / (N - 1));
      return x;
    });
  }, [config.xDomain[0], config.xDomain[1]]);

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #14111A 0%, #03050A 80%)' }}
    >
      {/* Ambient glows */}
      <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-20 blur-[100px] pointer-events-none"
           style={{ background: `radial-gradient(circle, ${config.accent ?? '#FDB813'} 0%, transparent 70%)` }} />

      <div className="absolute inset-0 flex items-center justify-center px-6 pt-10 pb-32">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full max-w-[1200px]"
        >
          {/* Title + subtitle */}
          {config.title && (
            <text x={m.left} y={36} fill={config.accent ?? '#FDB813'}
                  fontSize="14" fontFamily="'JetBrains Mono', monospace"
                  letterSpacing="0.25em">
              {config.title.toUpperCase()}
            </text>
          )}
          {config.subtitle && (
            <text x={m.left} y={56} fill="#94A3B8" fontSize="13" fontFamily="'Inter', sans-serif">
              {config.subtitle.replace(/\\\$/g, '$')}
            </text>
          )}

          {/* Grid */}
          {(config.xTicks ?? []).map(x => (
            <line key={`gx-${x}`} x1={xScale(x)} x2={xScale(x)} y1={m.top} y2={m.top + h}
                  stroke="#1E293B" strokeDasharray="2 4" />
          ))}
          {(config.yTicks ?? []).map(y => (
            <line key={`gy-${y}`} x1={m.left} x2={m.left + w} y1={yScale(y)} y2={yScale(y)}
                  stroke="#1E293B" strokeDasharray="2 4" />
          ))}

          {/* Axes */}
          <line x1={m.left} x2={m.left + w} y1={m.top + h} y2={m.top + h} stroke="#475569" strokeWidth="1.5" />
          <line x1={m.left} x2={m.left} y1={m.top} y2={m.top + h} stroke="#475569" strokeWidth="1.5" />

          {/* Tick labels */}
          {(config.xTicks ?? []).map(x => (
            <text key={`xl-${x}`} x={xScale(x)} y={m.top + h + 20} fill="#64748B"
                  fontSize="11" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
              {x}
            </text>
          ))}
          {(config.yTicks ?? []).map(y => (
            <text key={`yl-${y}`} x={m.left - 12} y={yScale(y) + 4} fill="#64748B"
                  fontSize="11" fontFamily="'JetBrains Mono', monospace" textAnchor="end">
              {y}
            </text>
          ))}

          {/* Axis labels */}
          {config.xLabel && (
            <text x={m.left + w / 2} y={H - 30} fill="#94A3B8" fontSize="12"
                  fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
              {config.xLabel} →
            </text>
          )}
          {config.yLabel && (
            <text x={28} y={m.top + h / 2} fill="#94A3B8" fontSize="12"
                  fontFamily="'JetBrains Mono', monospace" textAnchor="middle"
                  transform={`rotate(-90 28 ${m.top + h / 2})`}>
              ↑ {config.yLabel}
            </text>
          )}

          {/* Curves with reveal animation */}
          {config.curves.map((curve, ci) => {
            const t0 = curve.appearAt;
            const drawDuration = 1.8;
            const progress = Math.max(0, Math.min(1, (elapsed - t0) / drawDuration));
            if (progress <= 0) return null;
            const points = samples
              .slice(0, Math.ceil(N * progress))
              .map(x => `${xScale(x).toFixed(2)},${yScale(curve.fn(x)).toFixed(2)}`)
              .join(' ');
            return (
              <g key={ci}>
                {/* Soft underglow */}
                <polyline
                  points={points}
                  fill="none"
                  stroke={curve.glow ?? curve.color}
                  strokeWidth={(curve.width ?? 2) + 4}
                  strokeOpacity={0.18}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={points}
                  fill="none"
                  stroke={curve.color}
                  strokeWidth={curve.width ?? 2}
                  strokeOpacity={1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={curve.dashed ? '6 5' : undefined}
                />
              </g>
            );
          })}

          {/* Annotations — appear with marker dot */}
          {(config.annotations ?? []).map((ann, ai) => {
            const opacity = Math.max(0, Math.min(1, (elapsed - ann.appearAt) / 0.6));
            if (opacity <= 0) return null;
            const ax = xScale(ann.at[0]);
            const ay = yScale(ann.at[1]);
            const color = ann.color ?? '#FDB813';
            // Compute label offset based on anchor
            let dx = 12, dy = -10, textAnchor: 'start' | 'middle' | 'end' = 'start';
            if (ann.anchor === 'right') { dx = -12; textAnchor = 'end'; }
            if (ann.anchor === 'center') { dx = 0; dy = -16; textAnchor = 'middle'; }
            return (
              <g key={ai} opacity={opacity}>
                {ann.withMarker && (
                  <>
                    <circle cx={ax} cy={ay} r={9}  fill={color} opacity={0.18} />
                    <circle cx={ax} cy={ay} r={5}  fill={color} />
                  </>
                )}
                <foreignObject x={ax + dx - 130} y={ay + dy - 24} width="260" height="36">
                  <div
                    style={{
                      textAlign: textAnchor === 'middle' ? 'center' : textAnchor === 'end' ? 'right' : 'left',
                      paddingLeft: textAnchor === 'start' ? '130px' : 0,
                      paddingRight: textAnchor === 'end' ? '130px' : 0,
                      fontFamily: '"Inter", sans-serif',
                      fontSize: '13px',
                      lineHeight: '1.3',
                      whiteSpace: 'nowrap',
                    }}
                    dangerouslySetInnerHTML={{ __html: renderText(ann.text, color) }}
                  />
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend bottom-left */}
      <div className="absolute bottom-44 left-12 space-y-1.5 text-[11px] font-mono pointer-events-none">
        {config.curves.map((c, i) => {
          const opacity = Math.max(0, Math.min(1, (elapsed - c.appearAt) / 0.8));
          if (opacity <= 0.05) return null;
          return (
            <div key={i} className="flex items-center gap-2" style={{ opacity }}>
              <span
                className="inline-block w-4 h-0.5"
                style={{
                  background: c.color,
                  boxShadow: `0 0 8px ${c.color}`,
                  borderTop: c.dashed ? `1.5px dashed ${c.color}` : undefined,
                  height: c.dashed ? 0 : 2,
                }}
              />
              <span className="text-[#CBD5E1]"
                    dangerouslySetInnerHTML={{ __html: renderText(c.label, '#CBD5E1') }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
