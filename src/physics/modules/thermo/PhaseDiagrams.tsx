/**
 * Diagramas de Fase — termodinámica real en 3D.
 *
 * FÍSICA REAL:
 *   · Superfice PVT de van der Waals: (P + a/V²)(V − b) = RT
 *   · Isotermas de van der Waals en el plano P-V (curvas reales, Maxwell
 *     construction para la coexistencia líquido-gas).
 *   · Clapeyron/Clausius-Clapeyron: dP/dT = L/(T·Δv) = L·P/(RT²) para vapor ideal.
 *   · Punto crítico exacto: Tc = 8a/(27Rb), Pc = a/(27b²), Vc = 3b.
 *   · Triple point en la curva de sublimación (ajustado a H₂O o CO₂ según preset).
 *
 * Visualización: superficie P-V-T mallada, líneas de fase emisivas, punto crítico
 * glowing, cámara orbitante. La escena CONTEMPLA — el LessonPanel informa.
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ─── Tipos de estado de la lección ──────────────────────────────────────────

interface PhaseState {
  substance: string;
  view: string;   // 'pvt' | 'pt' | 'pv'
  isoT: number;   // temperatura de la isoterma activa (K, normalizada 0-1)
}

// ─── Propiedades de sustancias (van der Waals reales) ───────────────────────

interface Substance {
  name: string;
  /** a en Pa·m⁶/mol² */
  a: number;
  /** b en m³/mol */
  b: number;
  /** Calor latente de vaporización en J/mol (en Tb normal) */
  L: number;
  /** Triple point T en K */
  Tt: number;
  /** Triple point P en Pa */
  Pt: number;
  /** Color base */
  color: string;
  /** Color emisivo */
  emissive: string;
}

const R = 8.314; // J/(mol·K)

const SUBSTANCES: Record<string, Substance> = {
  co2: {
    name: 'CO₂',
    a: 0.3658,
    b: 42.9e-6,
    L: 25200,
    Tt: 216.6,
    Pt: 5.18e5,
    color: '#4FC3F7',
    emissive: '#0EA5E9',
  },
  h2o: {
    name: 'H₂O',
    a: 0.5537,
    b: 30.5e-6,
    L: 40700,
    Tt: 273.16,
    Pt: 611.7,
    color: '#A78BFA',
    emissive: '#7C3AED',
  },
  n2: {
    name: 'N₂',
    a: 0.1370,
    b: 38.7e-6,
    L: 5570,
    Tt: 63.2,
    Pt: 1.25e4,
    color: '#34D399',
    emissive: '#059669',
  },
};

// ─── Funciones de física ─────────────────────────────────────────────────────

function criticalPoint(s: Substance) {
  const Tc = (8 * s.a) / (27 * R * s.b);
  const Pc = s.a / (27 * s.b * s.b);
  const Vc = 3 * s.b;
  return { Tc, Pc, Vc };
}

/** Presión de van der Waals P(V,T) — V en m³/mol, T en K, P en Pa */
function vdwP(V: number, T: number, s: Substance): number {
  if (V <= s.b) return Infinity;
  return (R * T) / (V - s.b) - s.a / (V * V);
}

/**
 * Clausius-Clapeyron integrada (vapor ideal): ln(P/Pt) = -(L/R)*(1/T - 1/Tt).
 * Válida en la curva de vaporización.
 */
function saturationP(T: number, s: Substance, Tc: number): number {
  if (T < s.Tt || T > Tc) return NaN;
  return s.Pt * Math.exp(-(s.L / R) * (1 / T - 1 / s.Tt));
}

/**
 * Construcción de Maxwell: encuentro el plateau de presión Psat tal que
 * la integral de V dP entre los dos volúmenes de coexistencia sea cero.
 * Para esto, dado T < Tc, encontramos los tres ceros de dP/dV = 0 y
 * buscamos Psat via bisección.
 */
function maxwellPsat(T: number, s: Substance): { Psat: number; Vliq: number; Vgas: number } | null {
  const { Tc, Vc } = criticalPoint(s);
  if (T >= Tc) return null;

  // Rango de búsqueda en V (en unidades de b)
  const Vmin = s.b * 1.001;
  const Vmax = s.b * 2000;
  const N = 800;

  // Sample presiones a lo largo de la isoterma
  const Vs: number[] = [];
  const Ps: number[] = [];
  for (let i = 0; i <= N; i++) {
    // Escala logarítmica para capturar bien el mínimo
    const t = i / N;
    const V = Vmin * Math.pow(Vmax / Vmin, t);
    const P = vdwP(V, T, s);
    if (isFinite(P)) { Vs.push(V); Ps.push(P); }
  }
  if (Vs.length < 10) return null;

  // Buscar máximo y mínimo locales (signos de dP/dV cambio)
  // dP/dV = -RT/(V-b)² + 2a/V³ = 0 → cúbica en V
  // Punto crítico en Vc = 3b. Para T < Tc hay tres raíces.
  const dPdV = (V: number) => -R * T / ((V - s.b) ** 2) + 2 * s.a / (V ** 3);

  // Encontrar los dos extremos locales via bisección entre Vmin y Vc*4
  let Vpeak: number | null = null;
  let Vtrough: number | null = null;

  // Buscar en [b, Vc]: dP/dV pasa de + a - (máximo local)
  for (let i = 0; i < Vs.length - 1; i++) {
    const d1 = dPdV(Vs[i]);
    const d2 = dPdV(Vs[i + 1]);
    if (d1 > 0 && d2 < 0 && Vpeak === null) {
      // Bisección para el máximo local (Vliq-side)
      let lo = Vs[i], hi = Vs[i + 1];
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        dPdV(mid) > 0 ? (lo = mid) : (hi = mid);
      }
      Vpeak = (lo + hi) / 2;
    }
    if (d1 < 0 && d2 > 0 && Vpeak !== null && Vtrough === null) {
      // Mínimo local (gas-side)
      let lo = Vs[i], hi = Vs[i + 1];
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        dPdV(mid) < 0 ? (lo = mid) : (hi = mid);
      }
      Vtrough = (lo + hi) / 2;
    }
  }

  if (!Vpeak || !Vtrough) return null;

  const Ppeak = vdwP(Vpeak, T, s);
  const Ptrough = vdwP(Vtrough, T, s);
  if (!isFinite(Ppeak) || !isFinite(Ptrough)) return null;

  // Bisección en Psat ∈ [Ptrough, Ppeak] tal que ∫(Vliq→Vgas) V dP = 0
  // equivalente a ∫ P dV de Vliq a Vgas = Psat*(Vgas - Vliq)
  const integralDiff = (Psat: number): number => {
    // Encontrar Vliq (raíz de P=Psat en la rama líquida, V < Vpeak)
    // Encontrar Vgas (raíz de P=Psat en la rama gas, V > Vtrough)
    const findRoot = (vlo: number, vhi: number): number => {
      let lo = vlo, hi = vhi;
      for (let k = 0; k < 50; k++) {
        const mid = (lo + hi) / 2;
        (vdwP(mid, T, s) - Psat) * (vdwP(lo, T, s) - Psat) < 0 ? (hi = mid) : (lo = mid);
      }
      return (lo + hi) / 2;
    };
    const Vl = findRoot(s.b * 1.001, Vpeak);
    const Vg = findRoot(Vtrough, Vc * 20);
    // ∫Vl→Vg P dV via trapecio
    const nInt = 200;
    let integral = 0;
    let prevV = Vl;
    let prevP = vdwP(Vl, T, s);
    for (let i = 1; i <= nInt; i++) {
      const curV = Vl + (Vg - Vl) * (i / nInt);
      const curP = vdwP(curV, T, s);
      integral += (prevP + curP) * 0.5 * (curV - prevV);
      prevV = curV;
      prevP = curP;
    }
    return integral - Psat * (Vg - Vl);
  };

  // Bisección para Psat
  let lo = Ptrough, hi = Ppeak;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    integralDiff(mid) * integralDiff(lo) < 0 ? (hi = mid) : (lo = mid);
  }
  const Psat = (lo + hi) / 2;

  // Calcular Vliq y Vgas definitivos
  const findRoot2 = (vlo: number, vhi: number): number => {
    let lo2 = vlo, hi2 = vhi;
    for (let k = 0; k < 50; k++) {
      const mid = (lo2 + hi2) / 2;
      (vdwP(mid, T, s) - Psat) * (vdwP(lo2, T, s) - Psat) < 0 ? (hi2 = mid) : (lo2 = mid);
    }
    return (lo2 + hi2) / 2;
  };

  let Vliq: number, Vgas: number;
  try {
    Vliq = findRoot2(s.b * 1.001, Vpeak!);
    Vgas = findRoot2(Vtrough!, Vc * 20);
  } catch {
    return null;
  }

  return { Psat, Vliq, Vgas };
}

// ─── LECCIÓN ────────────────────────────────────────────────────────────────

const LESSON: Lesson<PhaseState> = {
  hook: {
    title: 'El agua no hierve siempre a 100 °C. El punto crítico lo cambia todo.',
    body: `Sube una montaña. A 3 000 m, el agua hierve a 90 °C — el aire raro reduce la presión, y la curva de vaporización la arrastra hacia abajo.

Ahora ve al fondo del mar. A 400 atm el agua sigue líquida a 300 °C. Presión enorme → curva de vaporización por encima.

¿Qué pasa si subes la presión Y la temperatura al mismo tiempo hasta llegar al punto crítico? La distinción entre líquido y gas DESAPARECE. Hay UNA SOLA fase: fluido supercrítico.

La ecuación de van der Waals explica todo esto con dos constantes (a, b) que capturan las fuerzas intermoleculares y el volumen molecular. Es una de las fórmulas más elegantes de la física.`,
  },

  steps: [
    {
      title: 'Superficie P-V-T — el atlas completo de la materia',
      duration: 6000,
      body: `La superficie P-V-T de van der Waals vive en tres dimensiones: presión P, volumen molar V, temperatura T.

Cada curva horizontal (T=constante) es una ISOTERMA. Para T > Tc son suaves y monótonas — una sola fase. Para T < Tc tienen un máximo y un mínimo: la región de "bucle" de van der Waals.

El bucle NO existe en la naturaleza — ahí la sustancia hace la COEXISTENCIA líquido-gas. Maxwell descubrió que la presión de saturación Psat es la que iguala las áreas encerradas por el bucle (construcción de Maxwell).

El punto crítico (Tc, Pc, Vc) es la cima donde los dos extremos del bucle convergen: en ese punto la densidad del líquido y el gas se igualan.`,
      formula: '(P + a/V²)(V − b) = RT\nTc = 8a/(27Rb)  Pc = a/(27b²)  Vc = 3b',
      keyframes: [
        { at: 0, state: { view: 'pvt', substance: 'co2' } },
        { at: 1, state: { view: 'pvt', substance: 'co2' } },
      ],
    },
    {
      title: 'Clausius-Clapeyron — por qué la curva de vapor tiene esa pendiente',
      duration: 6000,
      body: `En el diagrama P-T, la curva de vaporización tiene una pendiente bien definida. ¿Por qué?

La condición de equilibrio termodinámico entre dos fases es dG = 0, lo que conduce a la ecuación de Clapeyron EXACTA: dP/dT = ΔS/ΔV = L/(T·Δv).

Para la curva de vaporización, si el vapor se comporta como gas ideal (Δv ≈ RT/P), esto se convierte en Clausius-Clapeyron: d(ln P)/dT = L/(RT²).

Integrada: ln(P/P₀) = -(L/R)·(1/T − 1/T₀). Con un solo calor latente L y un punto de referencia, predice la presión de vapor en todo el rango de temperatura.`,
      formula: 'dP/dT = L/(T·Δv)  [Clapeyron exacto]\n→ ln(P/P₀) = −(L/R)(1/T − 1/T₀)  [Clausius-Clapeyron]',
      keyframes: [
        { at: 0, state: { view: 'pt', substance: 'h2o' } },
        { at: 1, state: { view: 'pt', substance: 'h2o' } },
      ],
    },
    {
      title: 'Construcción de Maxwell — encontrando la presión de saturación real',
      duration: 6500,
      body: `La isoterma de van der Waals para T < Tc tiene una región donde dP/dV > 0 — físicamente inestable (comprime y sube la presión, imposible en equilibrio).

Maxwell (1875) demostró que la presión de saturación Psat es la que hace que las DOS áreas encerradas por el bucle sean iguales: ∫Vliq→Vgas P dV = Psat·(Vgas − Vliq).

Esto es equivalente a imponer μliq = μgas (mismo potencial químico, condición de equilibrio de fases).

El plateau horizontal en Psat reemplaza al bucle inestable — es el "truco" que conecta van der Waals con la coexistencia real.`,
      formula: '∫(Vliq → Vgas) P dV = Psat·(Vgas − Vliq)\n[áreas iguales → μliq = μgas]',
      keyframes: [
        { at: 0, state: { view: 'pv', substance: 'co2', isoT: 0.7 } },
        { at: 1, state: { view: 'pv', substance: 'co2', isoT: 0.85 } },
      ],
    },
    {
      title: 'Punto crítico — donde el líquido y el gas se vuelven uno',
      duration: 6000,
      body: `En el punto crítico (Tc, Pc, Vc), las fases líquida y gaseosa son INDISTINGUIBLES. La densidad de ambas converge, el calor latente cae a cero, y las fluctuaciones de densidad divergen (luz dispersada: opalescencia crítica).

Para CO₂: Tc = 304 K, Pc = 7.4 MPa. Por encima del punto crítico existe el fluido supercrítico — disuelve grasa como líquido pero fluye como gas. Lo usas en el café descafeinado industrial.

Para H₂O: Tc = 647 K, Pc = 22.1 MPa. Los reactores nucleares a veces operan cerca de ahí.

El exponente crítico β (densidad → (Tc−T)^β) es universal — no depende de la sustancia sino de la dimensionalidad.`,
      formula: 'Tc = 8a/(27Rb),  Pc = a/(27b²),  Vc = 3b\nρliq − ρgas ~ (Tc − T)^β,  β ≈ 0.326',
      keyframes: [
        { at: 0, state: { view: 'pvt', substance: 'n2', isoT: 0.95 } },
        { at: 1, state: { view: 'pvt', substance: 'co2', isoT: 0.98 } },
      ],
    },
  ],

  connect: {
    body: `Los diagramas de fase son el lenguaje universal de la materia condensada.

La ecuación de estado de van der Waals (1873) le valió a Johannes van der Waals el Nobel de Física 1910. Fue la primera ecuación que explicó el punto crítico y la condensación desde primeros principios.

Hoy usamos ecuaciones más refinadas (Peng-Robinson, SAFT) pero la estructura es la misma: dos constantes fenomenológicas captando atracción (a) y exclusión de volumen (b).

El formalismo se extiende a:
• Transiciones de fase de segundo orden (ferromagnetismo, superconductividad)
• Diagramas de fase cuánticos (helio-3 a mK)
• Fluidos supercríticos en extracción industrial
• Condiciones extremas en interiores estelares`,
    links: [
      { label: 'Gas ideal con LJ — interacciones moleculares', href: '#ideal-gas-gpu' },
      { label: 'Termodinámica estadística — entropía y Boltzmann', href: '#statistical-mech' },
    ],
  },
};

// ─── Geometría de la superficie PVT ─────────────────────────────────────────

function buildPVTSurface(s: Substance, NV: number, NT: number): {
  geometry: THREE.BufferGeometry;
  lineGeom: THREE.BufferGeometry;
} {
  const { Tc, Pc, Vc } = criticalPoint(s);

  // Rangos de T y V para la malla
  const Tmin = s.Tt * 0.85;
  const Tmax = Tc * 1.35;
  const Vmin = s.b * 1.15;
  const Vmax = s.b * 150;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Para normalizar a la caja de visualización [0,4]³
  const scaleT = (T: number) => ((T - Tmin) / (Tmax - Tmin)) * 4 - 2;
  const scaleV = (V: number) => (Math.log(V / Vmin) / Math.log(Vmax / Vmin)) * 4 - 2;
  const scaleP = (P: number) => {
    const Pmax = Pc * 3.5;
    const Pmin = -Pc * 0.1;
    return Math.max(-2, Math.min(2, ((P - Pmin) / (Pmax - Pmin)) * 4 - 2));
  };

  for (let ti = 0; ti <= NT; ti++) {
    const t = ti / NT;
    const T = Tmin + (Tmax - Tmin) * t;
    for (let vi = 0; vi <= NV; vi++) {
      const vt = vi / NV;
      const V = Vmin * Math.pow(Vmax / Vmin, vt);
      const P = vdwP(V, T, s);

      const x = scaleV(V);
      const y = isFinite(P) ? scaleP(P) : -2;
      const z = scaleT(T);

      positions.push(x, y, z);

      // Color por región: caliente=naranja, frío=azul, supercrítico=púrpura
      const tNorm = (T - Tmin) / (Tmax - Tmin);
      const supercrit = T > Tc ? 1 : 0;
      const r = 0.2 + tNorm * 0.5 + supercrit * 0.3;
      const g = 0.3 + (1 - tNorm) * 0.2;
      const b = 0.8 - tNorm * 0.5 + supercrit * 0.2;
      colors.push(r, g, b);
    }
  }

  // Triángulos de la malla
  for (let ti = 0; ti < NT; ti++) {
    for (let vi = 0; vi < NV; vi++) {
      const a = ti * (NV + 1) + vi;
      const b2 = ti * (NV + 1) + vi + 1;
      const c = (ti + 1) * (NV + 1) + vi;
      const d = (ti + 1) * (NV + 1) + vi + 1;
      indices.push(a, b2, c, b2, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Líneas de cuadrícula (isotermas visibles)
  const linePositions: number[] = [];
  const nIsolines = 10;
  for (let ti = 0; ti <= nIsolines; ti++) {
    const T = Tmin + (Tmax - Tmin) * (ti / nIsolines);
    let prevX: number | null = null;
    let prevY: number | null = null;
    let prevZ: number | null = null;
    for (let vi = 0; vi <= NV * 2; vi++) {
      const vt = vi / (NV * 2);
      const V = Vmin * Math.pow(Vmax / Vmin, vt);
      const P = vdwP(V, T, s);
      const x = scaleV(V);
      const y = isFinite(P) ? scaleP(P) : -2;
      const z = scaleT(T);
      if (prevX !== null) {
        linePositions.push(prevX!, prevY!, prevZ!, x, y, z);
      }
      prevX = x; prevY = y; prevZ = z;
    }
  }
  const lineGeom = new THREE.BufferGeometry();
  lineGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));

  return { geometry, lineGeom };
}

/** Construye la curva de coexistencia en el plano P-T (Clausius-Clapeyron integrada) */
function buildPhaseLines(s: Substance): THREE.BufferGeometry {
  const { Tc, Pc } = criticalPoint(s);
  const Tmin = s.Tt;
  const Tmax = Tc;

  const pts: number[] = [];
  const N = 200;

  const scaleT = (T: number) => ((T - s.Tt * 0.5) / (Tc * 1.4 - s.Tt * 0.5)) * 4 - 2;
  const scaleP = (P: number) => {
    const Pmax = Pc * 1.3;
    return Math.max(-2, Math.min(2, (Math.log(P + 1) / Math.log(Pmax + 1)) * 4 - 2));
  };

  for (let i = 0; i < N - 1; i++) {
    const T1 = Tmin + (Tmax - Tmin) * (i / N);
    const T2 = Tmin + (Tmax - Tmin) * ((i + 1) / N);
    const P1 = saturationP(T1, s, Tc);
    const P2 = saturationP(T2, s, Tc);
    if (isFinite(P1) && isFinite(P2)) {
      pts.push(scaleT(T1), scaleP(P1), 0, scaleT(T2), scaleP(P2), 0);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  return g;
}

/** Construcción isoterma P-V con Maxwell */
function buildIsotherm(T: number, s: Substance): {
  vdwGeom: THREE.BufferGeometry;
  maxwellGeom: THREE.BufferGeometry | null;
  Psat: number | null;
} {
  const { Tc, Pc } = criticalPoint(s);
  const Vmin = s.b * 1.05;
  const Vmax = s.b * 200;
  const N = 600;

  const scaleV = (V: number) => (Math.log(V / Vmin) / Math.log(Vmax / Vmin)) * 4 - 2;
  const scaleP = (P: number) => {
    const Pmax = Pc * 2.5;
    return Math.max(-2.5, Math.min(2.5, (P / Pmax) * 3 - 1.5));
  };

  const pts: number[] = [];
  for (let i = 0; i <= N; i++) {
    const V = Vmin * Math.pow(Vmax / Vmin, i / N);
    const P = vdwP(V, T, s);
    if (isFinite(P)) {
      pts.push(scaleV(V), scaleP(P), 0);
    }
  }
  const vdwGeom = new THREE.BufferGeometry();
  vdwGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));

  if (T >= Tc) return { vdwGeom, maxwellGeom: null, Psat: null };

  const mw = maxwellPsat(T, s);
  if (!mw) return { vdwGeom, maxwellGeom: null, Psat: null };

  const { Psat, Vliq, Vgas } = mw;
  const mxPts = [
    scaleV(Vliq), scaleP(Psat), 0,
    scaleV(Vgas), scaleP(Psat), 0,
  ];
  const maxwellGeom = new THREE.BufferGeometry();
  maxwellGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mxPts), 3));

  return { vdwGeom, maxwellGeom, Psat };
}

// ─── Ejes del diagrama ──────────────────────────────────────────────────────

/** Construye un THREE.Line y lo devuelve para usar con <primitive> */
function makeAxis(pts: number[], color: string): THREE.Line {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color, toneMapped: false }));
}

function AxisLines() {
  const axV = useMemo(() => makeAxis([-2.2, -2, -2,  2.4, -2, -2], '#4FC3F7'), []);
  const axP = useMemo(() => makeAxis([-2.2, -2, -2, -2.2, 2.4, -2], '#F472B6'), []);
  const axT = useMemo(() => makeAxis([-2.2, -2, -2, -2.2, -2, 2.4], '#FDB813'), []);
  return (
    <group>
      <primitive object={axV} />
      <primitive object={axP} />
      <primitive object={axT} />
      <Html position={[2.65, -2.1, -2]} style={{ pointerEvents: 'none' }}>
        <span style={{ color: '#4FC3F7', fontSize: '11px', fontFamily: 'monospace' }}>V</span>
      </Html>
      <Html position={[-2.3, 2.65, -2]} style={{ pointerEvents: 'none' }}>
        <span style={{ color: '#F472B6', fontSize: '11px', fontFamily: 'monospace' }}>P</span>
      </Html>
      <Html position={[-2.3, -2.1, 2.65]} style={{ pointerEvents: 'none' }}>
        <span style={{ color: '#FDB813', fontSize: '11px', fontFamily: 'monospace' }}>T</span>
      </Html>
    </group>
  );
}

// ─── Escena 3D ──────────────────────────────────────────────────────────────

function PVTScene({
  substanceName, view, isoT,
}: {
  substanceName: string;
  view: string;
  isoT: number;
}) {
  const substance = SUBSTANCES[substanceName] ?? SUBSTANCES.co2;
  const { Tc, Pc, Vc } = criticalPoint(substance);

  // Superficie PVT
  const { geometry: pvtGeom, lineGeom: isoLineGeom } = useMemo(
    () => buildPVTSurface(substance, 60, 40),
    [substanceName],
  );

  // Curva de fase P-T (THREE.Line pre-construido para evitar <line> SVG ambiguity)
  const phaseLine = useMemo(() => {
    const geom = buildPhaseLines(substance);
    return new THREE.Line(geom, new THREE.LineBasicMaterial({ color: substance.emissive, toneMapped: false }));
  }, [substanceName]);

  // Isoterma activa
  const T_iso = substance.Tt * 0.9 + (Tc * 1.2 - substance.Tt * 0.9) * isoT;
  const { vdwGeom, maxwellGeom } = useMemo(
    () => buildIsotherm(T_iso, substance),
    [T_iso, substanceName],
  );

  // THREE.Line objetos para la isoterma (evitar <line> SVG)
  const vdwLine = useMemo(
    () => new THREE.Line(vdwGeom, new THREE.LineBasicMaterial({ color: substance.color, toneMapped: false })),
    [vdwGeom, substanceName],
  );
  const maxwellLine = useMemo(
    () => maxwellGeom
      ? new THREE.Line(maxwellGeom, new THREE.LineBasicMaterial({ color: '#FDB813', toneMapped: false, linewidth: 2 }))
      : null,
    [maxwellGeom, substanceName, T_iso],
  );

  // Punto crítico — posición en la malla PVT
  const critPos = useMemo(() => {
    const Tmin = substance.Tt * 0.85;
    const Tmax = Tc * 1.35;
    const Vmin = substance.b * 1.15;
    const Vmax = substance.b * 150;
    const x = (Math.log(Vc / Vmin) / Math.log(Vmax / Vmin)) * 4 - 2;
    const y = ((Pc - (-Pc * 0.1)) / (Pc * 3.5 - (-Pc * 0.1))) * 4 - 2;
    const z = ((Tc - Tmin) / (Tmax - Tmin)) * 4 - 2;
    return new THREE.Vector3(x, y, z);
  }, [substanceName]);

  // Pulsación del punto crítico
  const critRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 0.08 + 0.04 * Math.sin(t * 3.5);
    if (critRef.current) critRef.current.scale.setScalar(1 + pulse);
    if (glowRef.current) glowRef.current.scale.setScalar(1 + pulse * 2.5);
  });

  const showPVT = view === 'pvt';
  const showPT = view === 'pt';
  const showPV = view === 'pv';

  return (
    <>
      {/* Superficie P-V-T (sólo en vista pvt) */}
      {showPVT && (
        <group>
          <mesh geometry={pvtGeom}>
            <meshStandardMaterial
              vertexColors
              side={THREE.DoubleSide}
              transparent
              opacity={0.55}
              wireframe={false}
              emissiveIntensity={0}
              metalness={0.1}
              roughness={0.7}
            />
          </mesh>
          <lineSegments geometry={isoLineGeom}>
            <lineBasicMaterial
              color={substance.color}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </lineSegments>
        </group>
      )}

      {/* Curva de fase P-T */}
      {showPT && (
        <group>
          <primitive object={phaseLine} />
          {/* Punto triple */}
          <mesh position={[-1.9, -1.6, 0]}>
            <sphereGeometry args={[0.06, 20, 20]} />
            <meshStandardMaterial
              color="#FDB813"
              emissive="#FDB813"
              emissiveIntensity={2.5}
              toneMapped={false}
            />
          </mesh>
          <Html position={[-1.7, -1.4, 0]} center style={{ pointerEvents: 'none' }}>
            <div style={{ color: '#FDB813', fontSize: '10px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
              punto triple
            </div>
          </Html>
        </group>
      )}

      {/* Isoterma P-V con Maxwell */}
      {showPV && (
        <group>
          {/* Curva van der Waals completa */}
          <primitive object={vdwLine} />
          {/* Plateau de Maxwell */}
          {maxwellLine && <primitive object={maxwellLine} />}
          <Html position={[0, 0.15, 0]} center style={{ pointerEvents: 'none' }}>
            <div style={{ color: '#FDB813', fontSize: '10px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
              T = {T_iso.toFixed(1)} K
            </div>
          </Html>
        </group>
      )}

      {/* Punto crítico — siempre visible */}
      {showPVT && (
        <>
          <mesh ref={glowRef} position={critPos}>
            <sphereGeometry args={[0.10, 24, 24]} />
            <meshStandardMaterial
              color={substance.color}
              emissive={substance.emissive}
              emissiveIntensity={1.2}
              transparent
              opacity={0.25}
              toneMapped={false}
            />
          </mesh>
          <mesh ref={critRef} position={critPos}>
            <sphereGeometry args={[0.05, 24, 24]} />
            <meshStandardMaterial
              color="#FFFFFF"
              emissive="#FFFFFF"
              emissiveIntensity={3.0}
              toneMapped={false}
            />
          </mesh>
          <Html position={critPos.clone().add(new THREE.Vector3(0.18, 0.18, 0))} style={{ pointerEvents: 'none' }}>
            <div style={{ color: '#FFFFFF', fontSize: '10px', fontFamily: 'monospace', whiteSpace: 'nowrap', opacity: 0.85 }}>
              Tc={Tc.toFixed(0)}K  Pc={( Pc / 1e5).toFixed(1)} bar
            </div>
          </Html>
        </>
      )}

      {/* Ejes del diagrama PVT */}
      {showPVT && <AxisLines />}

      {/* Iluminación adicional en el punto crítico */}
      {showPVT && (
        <pointLight
          position={critPos}
          color={substance.color}
          intensity={1.2}
          distance={4}
        />
      )}
    </>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function PhaseDiagrams() {
  const { audience } = useAudience();
  const [substance, setSubstance] = useState<string>('co2');
  const [view, setView] = useState<'pvt' | 'pt' | 'pv'>('pvt');
  const [isoT, setIsoT] = useState(0.78);

  const sub = SUBSTANCES[substance];
  const { Tc, Pc } = criticalPoint(sub);

  // Temperatura de isoterma activa
  const T_iso = sub.Tt * 0.9 + (Tc * 1.2 - sub.Tt * 0.9) * isoT;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage
          cameraDistance={7}
          autoRotate={view === 'pvt'}
          bloomIntensity={0.7}
          bloomThreshold={0.15}
        >
          <PVTScene
            substanceName={substance}
            view={view}
            isoT={isoT}
          />
        </Stage>

        {/* HUD: lectura del punto crítico */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div className="text-[10px] uppercase tracking-widest text-[#64748B] mb-1">{sub.name}</div>
          <div><span className="text-[#64748B]">Tc&nbsp;</span>= {Tc.toFixed(1)} K</div>
          <div><span className="text-[#64748B]">Pc&nbsp;</span>= {(Pc / 1e5).toFixed(2)} bar</div>
          {view === 'pv' && (
            <div><span className="text-[#64748B]">T&nbsp;&nbsp;</span>= {T_iso.toFixed(1)} K
              {T_iso < Tc
                ? <span className="text-[#FDB813]"> &lt; Tc</span>
                : <span className="text-[#34D399]"> &gt; Tc</span>}
            </div>
          )}
        </div>

        {/* Selector de vista */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-2 py-1.5">
          {(['pvt', 'pt', 'pv'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[11px] font-mono px-2.5 py-1 rounded transition ${
                view === v
                  ? 'bg-[#4FC3F7]/20 border border-[#4FC3F7]/50 text-[#4FC3F7]'
                  : 'text-[#64748B] hover:text-white border border-transparent'
              }`}
            >
              {v === 'pvt' ? 'P-V-T 3D' : v === 'pt' ? 'P-T fase' : 'P-V isoterma'}
            </button>
          ))}
        </div>
      </div>

      <LessonPanel<PhaseState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.substance !== undefined) setSubstance(patch.substance);
          if (patch.view !== undefined) setView(patch.view as 'pvt' | 'pt' | 'pv');
          if (patch.isoT !== undefined) setIsoT(patch.isoT);
        }}
        sandbox={
          <>
            <Section title="Sustancia">
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(SUBSTANCES).map(([key, s]) => (
                  <button
                    key={key}
                    onClick={() => setSubstance(key)}
                    className={`px-2 py-2 rounded border text-[11px] font-mono transition ${
                      substance === key
                        ? 'border-[#4FC3F7]/50 bg-[#4FC3F7]/10 text-[#4FC3F7]'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Vista">
              <div className="flex flex-col gap-1.5">
                {([['pvt', 'Superficie P-V-T'], ['pt', 'Diagrama P-T (fases)'], ['pv', 'Isoterma P-V']] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`text-left px-3 py-1.5 rounded border text-[11px] transition ${
                      view === v
                        ? 'border-[#FDB813]/50 bg-[#FDB813]/10 text-[#FDB813]'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Section>

            {view === 'pv' && (
              <Section title="Temperatura de la isoterma">
                <Slider
                  label="T / Tc"
                  v={isoT}
                  min={0.3}
                  max={1.15}
                  step={0.005}
                  on={v => setIsoT(v)}
                  display={`${T_iso.toFixed(1)} K (${(isoT).toFixed(2)} · Tc)`}
                />
                <div className="mt-2 text-[10px] text-[#64748B]">
                  {T_iso < Tc ? 'Región bifásica — Maxwell activo' : 'Supercrítico — una sola fase'}
                </div>
              </Section>
            )}

            {audience !== 'child' && (
              <Section title="Constantes van der Waals">
                <Row label="a" value={`${sub.a.toFixed(4)} Pa·m⁶/mol²`} />
                <Row label="b" value={`${(sub.b * 1e6).toFixed(2)} cm³/mol`} />
                <Row label="L" value={`${(sub.L / 1000).toFixed(2)} kJ/mol`} />
                <Row label="Tt" value={`${sub.Tt.toFixed(2)} K`} />
                <Row label="Pt" value={`${(sub.Pt / 1e5).toFixed(4)} bar`} />
              </Section>
            )}

            {audience !== 'child' && (
              <Section title="Punto crítico calculado">
                <Row label="Tc" value={`${Tc.toFixed(2)} K`} />
                <Row label="Pc" value={`${(Pc / 1e5).toFixed(3)} bar`} />
                <Row label="Vc" value={`${(3 * sub.b * 1e6).toFixed(2)} cm³/mol`} />
              </Section>
            )}

            <Section title="Ecuación de van der Waals">
              <pre className="text-[10px] font-mono text-[#FDB813] leading-relaxed whitespace-pre-wrap">
                {'(P + a/V²)(V − b) = RT\n\na = atracciones moleculares\nb = volumen excluido'}
              </pre>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className={highlight ? 'text-[#F87171]' : 'text-white'}>{value}</span>
    </div>
  );
}

function Slider({
  label, v, min, max, step, on, display,
}: {
  label: string; v: number; min: number; max: number; step: number; on: (v: number) => void; display?: string;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{display ?? v.toFixed(3)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={e => on(Number(e.target.value))}
        className="w-full mt-1"
      />
    </div>
  );
}
