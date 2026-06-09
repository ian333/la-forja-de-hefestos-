/**
 * presets.tsx — circuitos educativos para el simulador.
 *
 * Cada preset junta: la topología (Circuit del motor MNA), su esquemático SVG
 * dibujado a mano sobre una grilla de 60 px, los sliders que editan valores
 * reales de componente, qué sondea el osciloscopio, y la lección guiada.
 *
 * El estado de la lección S = los parámetros de los sliders, así los keyframes
 * de la lección ANIMAN los componentes (sube R y mira cómo cambia la curva).
 */
import type { ReactNode } from 'react';
import type { Circuit, Wave } from '@/lib/circuitos/spice';
import type { Lesson } from '@/math/lesson/LessonPanel';
import { Resistor, Capacitor, Inductor, Source, Diode, Ground, Wire, NodeProbe } from './symbols';

export type Params = Record<string, number>;

export interface Slider {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Convierte el valor del slider → valor SI del componente (ej. kΩ→Ω). */
  toSI: (x: number) => number;
  /** Formatea para mostrar (ej. "4.7 kΩ"). */
  fmt: (x: number) => string;
}

export interface Probe {
  label: string;
  color: string;
  node?: number;      // voltaje de nodo
  current?: string;   // corriente de elemento por id
}

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  mode: 'dc' | 'transient';
  build: (p: Params) => Circuit;
  defaults: Params;
  sliders: Slider[];
  probes: Probe[];
  /** Ventana de transitorio. */
  sim?: { dt: number; tStop: number };
  Schematic: (props: { v: number[]; params: Params }) => ReactNode;
  lesson: Lesson<Params>;
}

// helpers de formato
const kohm = (x: number) => `${x >= 1 ? x.toFixed(x < 10 ? 1 : 0) : (x * 1000).toFixed(0) + ' '}${x >= 1 ? ' kΩ' : 'Ω'}`;
const uf = (x: number) => `${x} µF`;
const mh = (x: number) => `${x} mH`;
const hz = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(1)} kHz` : `${x.toFixed(0)} Hz`);

// ════════════════════════════════════════════════════════════════════════
// 1) DIVISOR DE VOLTAJE (DC) — la Ley de Ohm hecha visible
// ════════════════════════════════════════════════════════════════════════

const divider: Preset = {
  id: 'divider',
  name: 'Divisor de voltaje',
  blurb: 'Dos resistencias parten el voltaje. La base de todo: sensores, referencias, polarización.',
  mode: 'dc',
  defaults: { Vin: 10, R1: 1, R2: 1 },
  sliders: [
    { key: 'Vin', label: 'Fuente', min: 1, max: 24, step: 0.5, toSI: (x) => x, fmt: (x) => `${x} V` },
    { key: 'R1', label: 'R1', min: 0.1, max: 10, step: 0.1, toSI: (x) => x * 1000, fmt: kohm },
    { key: 'R2', label: 'R2', min: 0.1, max: 10, step: 0.1, toSI: (x) => x * 1000, fmt: kohm },
  ],
  build: (p) => ({
    nodeCount: 2,
    elements: [
      { kind: 'V', id: 'V1', a: 1, b: 0, value: p.Vin },
      { kind: 'R', id: 'R1', a: 1, b: 2, value: p.R1 * 1000 },
      { kind: 'R', id: 'R2', a: 2, b: 0, value: p.R2 * 1000 },
    ],
  }),
  probes: [{ label: 'V salida (nodo 2)', color: '#d4b050', node: 2 }],
  Schematic: ({ v, params }) => (
    <>
      <Source x={60} y={90} horizontal={false} label="V1" value={`${params.Vin}V`} />
      <Wire points="60,90 60,60 180,60" />
      <Wire points="60,150 60,180 180,180" />
      <Resistor x={180} y={60} horizontal={false} label="R1" value={kohm(params.R1)} />
      <Resistor x={180} y={120} horizontal={false} label="R2" value={kohm(params.R2)} />
      <Ground x={120} y={180} />
      <NodeProbe x={180} y={60} v={v[1] ?? 0} name="" />
      <NodeProbe x={180} y={120} v={v[2] ?? 0} name="" />
    </>
  ),
  lesson: {
    hook: {
      title: 'El voltaje se reparte en proporción a la resistencia.',
      body: 'Por dos resistencias en serie pasa la MISMA corriente (Kirchhoff). Entonces cada una se queda con una tajada del voltaje proporcional a su valor. Eso es un divisor.',
    },
    steps: [
      {
        title: 'Mitad y mitad',
        body: 'Con R1 = R2, el punto medio queda exactamente a la mitad del voltaje.\n\nLa corriente es V/(R1+R2); el voltaje en R2 es esa corriente por R2.',
        formula: 'V_out = V_in · R2 / (R1 + R2)',
        keyframes: [{ at: 0, state: { R1: 1, R2: 1 } }],
      },
      {
        title: 'Sube R2',
        body: 'Si R2 crece, se queda con MÁS voltaje. El divisor se inclina hacia la resistencia grande.',
        duration: 5000,
        keyframes: [
          { at: 0, state: { R1: 1, R2: 1 } },
          { at: 1, state: { R1: 1, R2: 9 } },
        ],
      },
      {
        title: 'Sensores: por qué importa',
        body: 'Un sensor (LDR, termistor) ES una resistencia que cambia. Ponlo de R2 y el voltaje de salida te DICE cuánta luz o calor hay. Así mide tu placa.',
        keyframes: [{ at: 0, state: { R1: 2, R2: 4 } }],
      },
    ],
    connect: {
      body: 'En la NOVA OMNI el sensado de junta usa un divisor 47k/10k para meter un voltaje grande al ADC de 3.3 V. Mismo principio.',
    },
  },
};

// ════════════════════════════════════════════════════════════════════════
// 2) FILTRO RC PASA-BAJOS — el tiempo entra en escena
// ════════════════════════════════════════════════════════════════════════

const rcLowpass: Preset = {
  id: 'rc-lowpass',
  name: 'Filtro RC pasa-bajos',
  blurb: 'El capacitor no puede cambiar de golpe → suaviza. Frecuencia de corte f_c = 1/(2πRC).',
  mode: 'transient',
  defaults: { R: 1, C: 1, freq: 200, amp: 5 },
  sliders: [
    { key: 'R', label: 'R', min: 0.1, max: 10, step: 0.1, toSI: (x) => x * 1000, fmt: kohm },
    { key: 'C', label: 'C', min: 0.1, max: 10, step: 0.1, toSI: (x) => x * 1e-6, fmt: uf },
    { key: 'freq', label: 'Frecuencia', min: 20, max: 2000, step: 10, toSI: (x) => x, fmt: hz },
    { key: 'amp', label: 'Amplitud', min: 1, max: 10, step: 0.5, toSI: (x) => x, fmt: (x) => `${x} V` },
  ],
  build: (p) => {
    const wave: Wave = { type: 'sine', amp: p.amp, freq: p.freq };
    return {
      nodeCount: 2,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 0, wave },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: p.R * 1000 },
        { kind: 'C', id: 'C1', a: 2, b: 0, value: p.C * 1e-6 },
      ],
    };
  },
  sim: { dt: 2e-6, tStop: 0.02 },
  probes: [
    { label: 'Entrada', color: '#60a5fa', node: 1 },
    { label: 'Salida (filtrada)', color: '#d4b050', node: 2 },
  ],
  Schematic: ({ v, params }) => (
    <>
      <Source x={60} y={90} horizontal={false} ac label="V1" value={hz(params.freq)} />
      <Wire points="60,90 60,60 120,60" />
      <Resistor x={120} y={60} label="R" value={kohm(params.R)} />
      <Wire points="180,60 240,60" />
      <Capacitor x={240} y={60} horizontal={false} label="C" value={uf(params.C)} />
      <Wire points="240,120 240,180 60,180 60,150" />
      <Ground x={150} y={180} />
      <NodeProbe x={120} y={60} v={v[1] ?? 0} name="in" />
      <NodeProbe x={240} y={60} v={v[2] ?? 0} name="out" />
    </>
  ),
  lesson: {
    hook: {
      title: 'Un capacitor es un balde: tarda en llenarse.',
      body: 'El capacitor se opone a los cambios bruscos de voltaje. Si la señal sube y baja MÁS rápido de lo que el balde alcanza a llenarse, la salida apenas se mueve: filtraste lo rápido.',
    },
    steps: [
      {
        title: 'Lento pasa',
        body: 'A baja frecuencia el capacitor tiene tiempo de seguir la entrada. La salida copia casi igual.',
        keyframes: [{ at: 0, state: { freq: 60 } }],
      },
      {
        title: 'Rápido se aplasta',
        body: 'Sube la frecuencia: la salida se queda chica y atrasada. Eso es filtrar.',
        duration: 5000,
        keyframes: [
          { at: 0, state: { freq: 60 } },
          { at: 1, state: { freq: 1500 } },
        ],
      },
      {
        title: 'La frecuencia de corte',
        body: 'El punto donde la salida cae a 0.707 de la entrada es f_c = 1/(2πRC). Arriba de ahí, se atenúa.',
        formula: 'f_c = 1 / (2π·R·C)',
        keyframes: [{ at: 0, state: { R: 1.6, C: 1, freq: 100 } }],
      },
    ],
    connect: {
      body: 'Todo ADC tiene un RC antialiasing al frente. Todo botón se "debounce" con un RC. Lo vas a usar siempre.',
    },
  },
};

// ════════════════════════════════════════════════════════════════════════
// 3) RESONANCIA RLC — el circuito que "suena"
// ════════════════════════════════════════════════════════════════════════

const rlc: Preset = {
  id: 'rlc',
  name: 'Resonancia RLC',
  blurb: 'L y C se intercambian energía → oscilan. R amortigua. f₀ = 1/(2π√(LC)).',
  mode: 'transient',
  defaults: { R: 0.05, L: 1, C: 1, freq: 80 },
  sliders: [
    { key: 'R', label: 'R (amortigua)', min: 0.01, max: 2, step: 0.01, toSI: (x) => x * 1000, fmt: kohm },
    { key: 'L', label: 'L', min: 0.1, max: 5, step: 0.1, toSI: (x) => x * 1e-3, fmt: mh },
    { key: 'C', label: 'C', min: 0.1, max: 5, step: 0.1, toSI: (x) => x * 1e-6, fmt: uf },
    { key: 'freq', label: 'Pulso', min: 20, max: 400, step: 10, toSI: (x) => x, fmt: hz },
  ],
  build: (p) => {
    const wave: Wave = { type: 'pulse', lo: 0, hi: 5, period: 1 / p.freq, duty: 0.5 };
    return {
      nodeCount: 3,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 0, wave },
        { kind: 'R', id: 'R1', a: 1, b: 2, value: p.R * 1000 },
        { kind: 'L', id: 'L1', a: 2, b: 3, value: p.L * 1e-3 },
        { kind: 'C', id: 'C1', a: 3, b: 0, value: p.C * 1e-6 },
      ],
    };
  },
  sim: { dt: 1e-6, tStop: 0.03 },
  probes: [
    { label: 'Pulso de entrada', color: '#60a5fa', node: 1 },
    { label: 'V en el capacitor', color: '#d4b050', node: 3 },
  ],
  Schematic: ({ v, params }) => (
    <>
      <Source x={60} y={90} horizontal={false} label="V1" value="pulso" />
      <Wire points="60,90 60,60 120,60" />
      <Resistor x={120} y={60} label="R" value={kohm(params.R)} />
      <Inductor x={180} y={60} label="L" value={mh(params.L)} />
      <Wire points="240,60 300,60" />
      <Capacitor x={300} y={60} horizontal={false} label="C" value={uf(params.C)} />
      <Wire points="300,120 300,180 60,180 60,150" />
      <Ground x={180} y={180} />
      <NodeProbe x={120} y={60} v={v[1] ?? 0} name="in" />
      <NodeProbe x={300} y={60} v={v[3] ?? 0} name="C" />
    </>
  ),
  lesson: {
    hook: {
      title: 'Un inductor y un capacitor juntos forman un péndulo eléctrico.',
      body: 'El capacitor guarda energía en su campo eléctrico; el inductor en su campo magnético. Se la pasan de uno a otro y oscilan. La resistencia es la fricción que los frena.',
    },
    steps: [
      {
        title: 'Casi sin fricción → repica',
        body: 'Con R chica, un golpe (el flanco del pulso) hace que el voltaje del capacitor OSCILE y tarde en calmarse. Eso es subamortiguado.',
        keyframes: [{ at: 0, state: { R: 0.05 } }],
      },
      {
        title: 'Sube R → se calma',
        body: 'Más resistencia = más fricción. Las oscilaciones se mueren rápido. Mucha R y ni oscila (sobreamortiguado).',
        duration: 5000,
        keyframes: [
          { at: 0, state: { R: 0.05 } },
          { at: 1, state: { R: 1.5 } },
        ],
      },
      {
        title: 'La nota del circuito',
        body: 'La frecuencia natural depende solo de L y C. Cambia L o C y cambia el tono. Así sintoniza un radio.',
        formula: 'f₀ = 1 / (2π·√(L·C))',
        keyframes: [{ at: 0, state: { R: 0.05, L: 2, C: 1 } }],
      },
    ],
    connect: {
      body: 'El boost trifásico de la impresora de metal es esto mismo: bobinas de aire intercambiando energía con caps. Resonar bien = fundir; resonar mal = jalón.',
    },
  },
};

// ════════════════════════════════════════════════════════════════════════
// 4) RECTIFICADOR DE MEDIA ONDA — de AC a DC
// ════════════════════════════════════════════════════════════════════════

const rectifier: Preset = {
  id: 'rectifier',
  name: 'Rectificador + filtro',
  blurb: 'El diodo deja pasar la corriente en un solo sentido. Con un capacitor → fuente de DC.',
  mode: 'transient',
  defaults: { amp: 9, freq: 200, C: 4.7, R: 2 },
  sliders: [
    { key: 'amp', label: 'AC entrada', min: 2, max: 12, step: 0.5, toSI: (x) => x, fmt: (x) => `${x} V` },
    { key: 'freq', label: 'Frecuencia', min: 50, max: 600, step: 10, toSI: (x) => x, fmt: hz },
    { key: 'C', label: 'C filtro', min: 0.1, max: 22, step: 0.1, toSI: (x) => x * 1e-6, fmt: uf },
    { key: 'R', label: 'R carga', min: 0.2, max: 10, step: 0.1, toSI: (x) => x * 1000, fmt: kohm },
  ],
  build: (p) => {
    const wave: Wave = { type: 'sine', amp: p.amp, freq: p.freq };
    return {
      nodeCount: 2,
      elements: [
        { kind: 'V', id: 'V1', a: 1, b: 0, value: 0, wave },
        { kind: 'D', id: 'D1', a: 1, b: 2 },
        { kind: 'C', id: 'C1', a: 2, b: 0, value: p.C * 1e-6 },
        { kind: 'R', id: 'R1', a: 2, b: 0, value: p.R * 1000 },
      ],
    };
  },
  sim: { dt: 2e-6, tStop: 0.03 },
  probes: [
    { label: 'AC entrada', color: '#60a5fa', node: 1 },
    { label: 'DC salida', color: '#4ade80', node: 2 },
  ],
  Schematic: ({ v, params }) => (
    <>
      <Source x={60} y={90} horizontal={false} ac label="V1" value={`${params.amp}V~`} />
      <Wire points="60,90 60,60 120,60" />
      <Diode x={120} y={60} label="D1" value="" />
      <Wire points="180,60 320,60" />
      <Capacitor x={230} y={60} horizontal={false} label="C" value={uf(params.C)} />
      <Resistor x={320} y={60} horizontal={false} label="R" value={kohm(params.R)} />
      <Wire points="230,120 230,180 60,180 60,150" />
      <Wire points="320,120 320,180 230,180" />
      <Ground x={150} y={180} />
      <NodeProbe x={120} y={60} v={v[1] ?? 0} name="in" />
      <NodeProbe x={320} y={60} v={v[2] ?? 0} name="dc" />
    </>
  ),
  lesson: {
    hook: {
      title: 'Un diodo es una válvula de un solo sentido para la corriente.',
      body: 'Deja pasar cuando el ánodo está más positivo que el cátodo (~0.7 V de peaje) y bloquea al revés. Con eso conviertes la AC que sube y baja en algo que solo empuja para un lado.',
    },
    steps: [
      {
        title: 'Media onda',
        body: 'Sin capacitor, el diodo recorta los semiciclos negativos. Queda DC pulsante: solo las jorobas de arriba.',
        keyframes: [{ at: 0, state: { C: 0.1 } }],
      },
      {
        title: 'El capacitor alisa',
        body: 'Pon un capacitor en paralelo: se carga en el pico y entrega su carga en los valles. La salida se vuelve casi plana.',
        duration: 5000,
        keyframes: [
          { at: 0, state: { C: 0.1 } },
          { at: 1, state: { C: 15 } },
        ],
      },
      {
        title: 'Rizo vs carga',
        body: 'Si la carga R pide mucha corriente, el cap se descarga más entre picos → más rizo. Más C o menos carga = más limpio.',
        keyframes: [{ at: 0, state: { C: 8, R: 1 } }],
      },
    ],
    connect: {
      body: 'Toda fuente de pared hace esto: transformador → rectificador → filtro → regulador. La NOVA lo cierra con un buck TPS5430 que baja a 5 V y 3.3 V limpios.',
    },
  },
};

export const PRESETS: Preset[] = [divider, rcLowpass, rlc, rectifier];
