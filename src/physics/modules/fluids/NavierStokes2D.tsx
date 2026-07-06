/**
 * NavierStokes2D — Fluido incompresible de Stam en 3D R3F.
 *
 * Física real implementada:
 *   Ecuaciones de Navier-Stokes incompresibles (Stam 1999 "Stable Fluids"):
 *     ∂u/∂t = −(u·∇)u − ∇p/ρ + ν∇²u + f
 *     ∇·u = 0  (incompresibilidad)
 *
 *   Pipeline de un paso de tiempo:
 *     1. Difusión de velocidad:   u ← (I − ν·dt·∇²)⁻¹ u  → Gauss-Seidel iterativo
 *     2. Proyección (preservar ∇·u=0): resolver ∇²p = ∇·u, luego u ← u − ∇p
 *     3. Advección semi-lagrangiana:  u(x,t+dt) = u(x − u(x,t)·dt, t)  → bilineal
 *     4. Proyección de nuevo (garantizar divergencia cero)
 *   Lo mismo para el campo escalar de densidad/tinta:
 *     ∂ρ/∂t = −(u·∇)ρ + κ∇²ρ
 *
 *   Vorticidad: ω = ∇×u (en 2D, componente z: ω = ∂v/∂x − ∂u/∂y)
 *   Confinamiento de vorticidad (Fedkiw et al.): f_ω = ε·(N×ω)
 *     con N = ∇|ω| / |∇|ω||  (dirección hacia el vórtice)
 *
 * Visualización 3D R3F:
 *   - Plano de fluido como malla de puntos (PointCloud) con Z codificando
 *     la magnitud de velocidad (relieve 3D) — el fluido vive en el espacio.
 *   - Color de cada punto = densidad de tinta (blanco brillante emisivo).
 *   - Contornos de vorticidad como segundo layer aditivo (magenta/cian).
 *   - Cámara a 45° con auto-rotate lento para el efecto de contemplación.
 *
 * Referencias:
 *   · J. Stam, "Stable Fluids", SIGGRAPH 1999.
 *   · R. Fedkiw, J. Stam, H. Jensen, "Visual Simulation of Smoke", SIGGRAPH 2001.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ═══════════════════════════════════════════════════════════════
// Parámetros de la simulación
// ═══════════════════════════════════════════════════════════════

const N = 64;          // Resolución de la malla N×N
const N2 = N * N;
const DX = 1.0 / N;   // Espaciado de celda (dominio unitario)

// Parámetros físicos del fluido
interface FluidParams {
  viscosity: number;   // ν — viscosidad cinemática
  diffusion: number;   // κ — difusividad del tinte
  vortConf:  number;   // ε — fuerza de confinamiento de vorticidad
  dt:        number;   // paso de tiempo
}

const PARAMS_DEFAULT: FluidParams = {
  viscosity: 0.00001,
  diffusion: 0.00001,
  vortConf:  6.0,
  dt:        0.016,
};

// ═══════════════════════════════════════════════════════════════
// Lección pedagógica
// ═══════════════════════════════════════════════════════════════

interface NSState {
  preset: 'smoke' | 'vortex' | 'turbulence' | 'ink';
}

const LESSON: Lesson<NSState> = {
  hook: {
    title: 'El humo que sube. Las ecuaciones más usadas y menos entendidas de la física.',
    body: `Las ecuaciones de Navier-Stokes gobiernan el movimiento de TODO fluido: el aire que respiras, el humo de una vela, las corrientes oceánicas, la sangre en tus venas, los plasmas estelares.

Son ecuaciones de conservación: conservación de masa (∇·u = 0) y de momento (F = ma en un fluido).

Lo fascinante es que siendo deterministas y continuas, generan estructuras de COMPLEJIDAD infinita: vórtices que se enrollan en vórtices más pequeños, filamentos de humo que danzan en espiral, turbulencia que cascadea energía de escalas grandes a pequeñas.

En 1999, Jos Stam publicó un algoritmo que las resuelve de forma ESTABLE en tiempo real. Esta simulación lo implementa exactamente — advección semi-lagrangiana + proyección de presión. Lo que ves es física real, no animación.`,
  },

  steps: [
    {
      title: 'Advección semi-lagrangiana — retrotrazar las partículas',
      duration: 7000,
      body: `El término más difícil de N-S es (u·∇)u — el campo de velocidad SE advecta a sí mismo.

El truco de Stam: en vez de seguir partículas hacia adelante (inestable), las RETROTRAZAMOS hacia atrás. Para actualizar u en x: preguntar ¿de dónde vino una partícula que está en x ahora?

x_src = x − u(x, t) · dt

Interpolar bilinealmente u en x_src y asignar ese valor a x en t+dt. El resultado es INCONDICIONALMENTE ESTABLE — no importa cuán grande sea dt. Es la razón por la que el fluido no explota.

Observa las columnas de humo: ascienden sin disiparse rápido porque la advección es exacta (primer orden en espacio).`,
      formula: 'u(x, t+dt) = u(x − u·dt, t)\n— interpolación bilineal en x_src\n— incondicionalmente estable (CFL cualquiera)',
      keyframes: [
        { at: 0, state: { preset: 'smoke' } },
        { at: 1, state: { preset: 'smoke' } },
      ],
    },
    {
      title: 'Proyección de presión — garantizar ∇·u = 0',
      duration: 7000,
      body: `La incompresibilidad dice que no hay fuentes ni sumideros: ∇·u = 0. Pero después de advectar, el campo de velocidad puede tener divergencia.

La proyección de Helmholtz-Hodge elimina la parte compresible. Se resuelve la ecuación de Poisson:

∇²p = ∇·u    (discretizada con diferencias finitas)

con Gauss-Seidel (20 iteraciones). Luego se corrige:

u ← u − ∇p

El resultado es un campo solenodial (∇·u = 0). Esta es la "presión" que empuja el fluido para que no se compresione — no es presión termodinámica, es un multiplicador de Lagrange para la restricción de incompresibilidad.

Los vórtices de la imagen persisten porque la proyección conserva la circulación (teorema de Kelvin).`,
      formula: '∇²p = ∇·u  →  Gauss-Seidel\nu ← u − ∇p\n∇·u = 0  garantizado (incompresibilidad)',
      keyframes: [
        { at: 0, state: { preset: 'vortex' } },
        { at: 1, state: { preset: 'vortex' } },
      ],
    },
    {
      title: 'Confinamiento de vorticidad — vórtices que no mueren',
      duration: 7000,
      body: `La discretización numérica introduce difusión numérica que MATA los vórtices demasiado rápido. El confinamiento de vorticidad (Fedkiw 2001) los resucita.

La vorticidad en 2D es ω = ∂v/∂x − ∂u/∂y (rotacional escalar). Sus gradientes apuntan hacia los centros de los vórtices.

Fuerza de confinamiento:
  N = ∇|ω| / |∇|ω||   (hacia el vórtice)
  f_vc = ε · (N × ω)   (perpendicular, centripeta)

Con ε = 6, los vórtices se mantienen compactos y espiralados durante muchos pasos. Sin ε, colapsan en pocas iteraciones.

Obsérvalo: los filamentos de humo se enrollan en espirales perfectas porque el confinamiento refuerza la rotación.`,
      formula: 'ω = ∂v/∂x − ∂u/∂y\nN = ∇|ω| / |∇|ω||\nf_vc = ε·(ẑ×N)|ω|  →  u ← u + f_vc·dt',
      keyframes: [
        { at: 0, state: { preset: 'turbulence' } },
        { at: 1, state: { preset: 'turbulence' } },
      ],
    },
    {
      title: 'Cascada de turbulencia — Kolmogorov y el régimen inercial',
      duration: 7000,
      body: `La energía en un fluido turbulento fluye de escalas GRANDES hacia escalas PEQUEÑAS (cascada directa de Richardson). Kolmogorov (1941) demostró que en el rango inercial:

E(k) ∝ k^{-5/3}

donde k es el número de onda (inversamente proporcional al tamaño del vórtice).

En nuestro grid 64×64 se resuelven ~10 décadas de longitud, insuficiente para turbulencia totalmente desarrollada. Pero puedes ver la cascada de vórtices: el forzamiento grande se fragmenta en estructuras más pequeñas, y así sucesivamente hasta la escala de Kolmogorov η = (ν³/ε)^{1/4}.

Por debajo de η, la viscosidad disipa la energía en calor. Esa es la última etapa de la cascada.`,
      formula: 'E(k) ∝ k^{−5/3}  (Kolmogorov 1941)\nRe = UL/ν  (número de Reynolds)\nη = (ν³/ε)^{1/4}  (escala de Kolmogorov)',
      keyframes: [
        { at: 0, state: { preset: 'turbulence' } },
        { at: 0.5, state: { preset: 'ink' } },
        { at: 1, state: { preset: 'ink' } },
      ],
    },
  ],

  connect: {
    body: `Navier-Stokes es el problema no resuelto por excelencia de las matemáticas modernas. El Clay Mathematics Institute ofrece 1 millón de dólares por demostrar (o refutar) que siempre existen soluciones suaves en 3D — el "Problema del Milenio" de N-S.

En 2D está demostrado que las soluciones son suaves para siempre. En 3D, nadie sabe si pueden desarrollar singularidades en tiempo finito.

Aplicaciones prácticas:
• CFD (Computational Fluid Dynamics): diseño aerodinámico de aviones, F1, turbinas.
• Océanos y clima: modelos GCM (General Circulation Models) para predicción de cambio climático.
• Biofluidos: flujo sanguíneo en valvas cardíacas y aneurismas (detección de riesgo).
• VFX: el algoritmo de Stam es la base de todos los simuladores de humo de Hollywood.
• Astrofísica: discos de acreción y jets relativistas se modelan con MHD (Navier-Stokes + Maxwell).

El fluido que ves en esta ventana y el humo del cigarrillo de alguien a 5 km de ti obedecen exactamente las mismas ecuaciones.`,
    links: [
      { label: 'Termodinámica — gas ideal y flujo de calor', href: '#ideal-gas' },
      { label: 'Electrodinámica — MHD y plasmas', href: '#em-waves' },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// Solver de Stam — fluido estable (CPU, TypeScript)
// ═══════════════════════════════════════════════════════════════

/** Índice lineal en la malla (con borde fantasma) */
function IX(x: number, y: number): number {
  const xi = Math.max(0, Math.min(N - 1, x | 0));
  const yi = Math.max(0, Math.min(N - 1, y | 0));
  return xi + yi * N;
}

/** Condiciones de frontera:
 *  b=1 → refleja componente X (u), b=2 → refleja componente Y (v), b=0 → copia */
function setBounds(b: number, x: Float32Array): void {
  for (let i = 1; i < N - 1; i++) {
    x[IX(0,     i)] = b === 1 ? -x[IX(1, i)]     : x[IX(1, i)];
    x[IX(N-1,   i)] = b === 1 ? -x[IX(N-2, i)]   : x[IX(N-2, i)];
    x[IX(i,     0)] = b === 2 ? -x[IX(i, 1)]     : x[IX(i, 1)];
    x[IX(i,   N-1)] = b === 2 ? -x[IX(i, N-2)]   : x[IX(i, N-2)];
  }
  x[IX(0,     0)] = 0.5 * (x[IX(1, 0)]   + x[IX(0, 1)]);
  x[IX(0,   N-1)] = 0.5 * (x[IX(1, N-1)] + x[IX(0, N-2)]);
  x[IX(N-1,   0)] = 0.5 * (x[IX(N-2, 0)] + x[IX(N-1, 1)]);
  x[IX(N-1, N-1)] = 0.5 * (x[IX(N-2, N-1)] + x[IX(N-1, N-2)]);
}

/**
 * Difusión implícita: (I − a·∇²) x = x0
 * Resolvemos con Gauss-Seidel (20 iter).
 * a = dt * diff * (N-2)²
 */
function diffuse(
  b: number,
  x: Float32Array,
  x0: Float32Array,
  diff: number,
  dt: number,
  iter: number,
  tmp: Float32Array,
): void {
  const a = dt * diff * (N - 2) * (N - 2);
  const cRecip = 1.0 / (1.0 + 4.0 * a);
  // copiar x0 → tmp como partida
  for (let k = 0; k < iter; k++) {
    for (let j = 1; j < N - 1; j++) {
      for (let i = 1; i < N - 1; i++) {
        x[IX(i, j)] = (
          x0[IX(i, j)] +
          a * (x[IX(i+1,j)] + x[IX(i-1,j)] + x[IX(i,j+1)] + x[IX(i,j-1)])
        ) * cRecip;
      }
    }
    setBounds(b, x);
  }
  void tmp; // suprimir warning
}

/**
 * Advección semi-lagrangiana de Stam.
 * d: densidad a advectar (output)
 * d0: densidad al tiempo t
 * u, v: campo de velocidad
 */
function advect(
  b: number,
  d: Float32Array,
  d0: Float32Array,
  u: Float32Array,
  v: Float32Array,
  dt: number,
): void {
  const dtx = dt * (N - 2);
  const dty = dt * (N - 2);

  for (let j = 1; j < N - 1; j++) {
    for (let i = 1; i < N - 1; i++) {
      // Retrotrazar la partícula
      let x = i - dtx * u[IX(i, j)];
      let y = j - dty * v[IX(i, j)];

      // Clamp dentro del dominio [0.5, N-1.5]
      if (x < 0.5) x = 0.5;
      if (x > N - 1.5) x = N - 1.5;
      if (y < 0.5) y = 0.5;
      if (y > N - 1.5) y = N - 1.5;

      const i0 = x | 0;
      const i1 = i0 + 1;
      const j0 = y | 0;
      const j1 = j0 + 1;

      const s1 = x - i0;
      const s0 = 1.0 - s1;
      const t1 = y - j0;
      const t0 = 1.0 - t1;

      // Interpolación bilineal
      d[IX(i, j)] =
        s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) +
        s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)]);
    }
  }
  setBounds(b, d);
}

/**
 * Proyección de Helmholtz: elimina la parte compresible de (u, v).
 * Resuelve ∇²p = ∇·u con Gauss-Seidel, luego u ← u − ∇p.
 */
function project(
  u: Float32Array,
  v: Float32Array,
  p: Float32Array,
  div: Float32Array,
  iter: number,
): void {
  const h = 1.0 / (N - 2);

  // Calcular divergencia
  for (let j = 1; j < N - 1; j++) {
    for (let i = 1; i < N - 1; i++) {
      div[IX(i, j)] = -0.5 * h * (
        u[IX(i+1, j)] - u[IX(i-1, j)] +
        v[IX(i, j+1)] - v[IX(i, j-1)]
      );
      p[IX(i, j)] = 0.0;
    }
  }
  setBounds(0, div);
  setBounds(0, p);

  // Gauss-Seidel para ∇²p = div
  for (let k = 0; k < iter; k++) {
    for (let j = 1; j < N - 1; j++) {
      for (let i = 1; i < N - 1; i++) {
        p[IX(i, j)] = (
          div[IX(i, j)] +
          p[IX(i+1,j)] + p[IX(i-1,j)] +
          p[IX(i,j+1)] + p[IX(i,j-1)]
        ) * 0.25;
      }
    }
    setBounds(0, p);
  }

  // Corregir velocidad
  for (let j = 1; j < N - 1; j++) {
    for (let i = 1; i < N - 1; i++) {
      u[IX(i, j)] -= 0.5 * (p[IX(i+1, j)] - p[IX(i-1, j)]) / h;
      v[IX(i, j)] -= 0.5 * (p[IX(i, j+1)] - p[IX(i, j-1)]) / h;
    }
  }
  setBounds(1, u);
  setBounds(2, v);
}

/**
 * Confinamiento de vorticidad (Fedkiw, Stam, Jensen 2001).
 * Calcula ω = ∂v/∂x − ∂u/∂y, luego aplica fuerza centripeta.
 */
function vorticityConfinement(
  u: Float32Array,
  v: Float32Array,
  omega: Float32Array,
  eps: number,
  dt: number,
): void {
  const h = 1.0 / (N - 2);

  // Calcular vorticidad escalar
  for (let j = 1; j < N - 1; j++) {
    for (let i = 1; i < N - 1; i++) {
      omega[IX(i, j)] = 0.5 * (
        (v[IX(i+1, j)] - v[IX(i-1, j)]) -
        (u[IX(i, j+1)] - u[IX(i, j-1)])
      ) / h;
    }
  }

  // Aplicar fuerza de confinamiento
  for (let j = 1; j < N - 1; j++) {
    for (let i = 1; i < N - 1; i++) {
      // Gradiente de |ω|
      const dOmX = (Math.abs(omega[IX(i+1, j)]) - Math.abs(omega[IX(i-1, j)])) * 0.5 / h;
      const dOmY = (Math.abs(omega[IX(i, j+1)]) - Math.abs(omega[IX(i, j-1)])) * 0.5 / h;

      const len = Math.sqrt(dOmX * dOmX + dOmY * dOmY) + 1e-8;
      const nx = dOmX / len;  // N = ∇|ω| normalizado
      const ny = dOmY / len;

      const om = omega[IX(i, j)];
      // f = ε · (N × ω·ẑ) = ε·ω·(ny, -nx, 0) [componente z de N×(ω·ẑ)]
      u[IX(i, j)] += eps * dt * ny * om;
      v[IX(i, j)] -= eps * dt * nx * om;
    }
  }
}

/** Un paso completo de Navier-Stokes */
function fluidStep(s: FluidState, params: FluidParams): void {
  const { dt, viscosity, diffusion, vortConf } = params;
  const { u, v, u0, v0, dens, dens0, p, div, omega } = s;

  // === Velocidad ===
  // 1. Difusión implícita
  diffuse(1, u0, u, viscosity, dt, 20, div);
  diffuse(2, v0, v, viscosity, dt, 20, div);
  // 2. Proyección (antes de advectar)
  project(u0, v0, p, div, 20);
  // 3. Advección semi-lagrangiana
  advect(1, u, u0, u0, v0, dt);
  advect(2, v, v0, u0, v0, dt);
  // 4. Proyección final
  project(u, v, p, div, 20);
  // 5. Confinamiento de vorticidad
  if (vortConf > 0) {
    vorticityConfinement(u, v, omega, vortConf, dt);
    project(u, v, p, div, 10);
  }

  // === Densidad (tinta/humo) ===
  diffuse(0, dens0, dens, diffusion, dt, 20, div);
  advect(0, dens, dens0, u, v, dt);

  // Atenuación suave de densidad (humo se disipa)
  for (let i = 0; i < N2; i++) {
    dens[i] *= 0.998;
  }
}

interface FluidState {
  u: Float32Array;      // velocidad X
  v: Float32Array;      // velocidad Y
  u0: Float32Array;     // velocidad X (buffer anterior/temporal)
  v0: Float32Array;     // velocidad Y (buffer anterior/temporal)
  dens: Float32Array;   // densidad (tinta/humo)
  dens0: Float32Array;  // densidad (buffer)
  p: Float32Array;      // presión
  div: Float32Array;    // divergencia temporal
  omega: Float32Array;  // vorticidad
}

function createFluidState(): FluidState {
  return {
    u:     new Float32Array(N2),
    v:     new Float32Array(N2),
    u0:    new Float32Array(N2),
    v0:    new Float32Array(N2),
    dens:  new Float32Array(N2),
    dens0: new Float32Array(N2),
    p:     new Float32Array(N2),
    div:   new Float32Array(N2),
    omega: new Float32Array(N2),
  };
}

// ═══════════════════════════════════════════════════════════════
// Presets de forzamiento
// ═══════════════════════════════════════════════════════════════

type PresetId = 'smoke' | 'vortex' | 'turbulence' | 'ink';

interface FluidPreset {
  id: PresetId;
  name: string;
  note: string;
  /** Inyecta fuerza y densidad en el estado cada step */
  inject: (s: FluidState, t: number) => void;
}

const PRESETS: FluidPreset[] = [
  {
    id: 'smoke',
    name: 'Columna de humo',
    note: 'Fuente de humo en el centro-inferior. Flujo laminar que se vuelve turbulento.',
    inject(s, t) {
      // Fuente de humo oscilante (simula perturbación térmica)
      const cx = (N / 2 + Math.sin(t * 0.3) * 4) | 0;
      const cy = 4;
      for (let di = -2; di <= 2; di++) {
        for (let dj = 0; dj <= 3; dj++) {
          const idx = IX(cx + di, cy + dj);
          s.dens[idx]  += 0.9;
          s.v[idx]     += 0.8 + Math.sin(t * 1.7 + di * 0.3) * 0.2;
          s.u[idx]     += Math.sin(t * 0.7) * 0.15;
        }
      }
    },
  },
  {
    id: 'vortex',
    name: 'Par de vórtices',
    note: 'Dos vórtices opuestos que se atraen y se enrollan entre sí.',
    inject(s, t) {
      const t4 = t % 4.0;
      if (t4 < 0.1) {
        // Inyectar el par de vórtices cada 4 segundos
        const y = (N / 2) | 0;
        for (let di = -3; di <= 3; di++) {
          // Vórtice izquierdo (sentido antihorario)
          s.u[IX((N / 3) | 0, y + di)] += -0.6 * di * 0.2;
          s.v[IX((N / 3) | 0, y + di)] +=  0.8;
          // Vórtice derecho (horario)
          s.u[IX((2 * N / 3) | 0, y + di)] +=  0.6 * di * 0.2;
          s.v[IX((2 * N / 3) | 0, y + di)] += -0.8;
          s.dens[IX((N / 3) | 0,     y + di)] += 0.6;
          s.dens[IX((2 * N / 3) | 0, y + di)] += 0.6;
        }
      }
      // Fuente pequeña continua para visibilidad
      const cx = (N / 2) | 0;
      const cy = (N / 2) | 0;
      s.dens[IX(cx, cy)] += 0.08;
    },
  },
  {
    id: 'turbulence',
    name: 'Turbulencia',
    note: 'Múltiples fuentes aleatorias → cascada de vórtices (Kolmogorov).',
    inject(s, t) {
      // 6 fuentes distribuidas con forzamiento cuasi-aleatorio determinista
      const sources = [
        { x: 0.2, y: 0.2, phase: 0.0 },
        { x: 0.8, y: 0.2, phase: 1.1 },
        { x: 0.2, y: 0.8, phase: 2.3 },
        { x: 0.8, y: 0.8, phase: 3.5 },
        { x: 0.5, y: 0.1, phase: 0.7 },
        { x: 0.5, y: 0.9, phase: 1.9 },
      ];
      for (const src of sources) {
        const ix = (src.x * N) | 0;
        const iy = (src.y * N) | 0;
        const amp = 0.7;
        const ph  = t * 1.3 + src.phase;
        s.u[IX(ix, iy)] += amp * Math.sin(ph);
        s.v[IX(ix, iy)] += amp * Math.cos(ph * 0.7 + 0.5);
        s.dens[IX(ix, iy)] += 0.4;
      }
    },
  },
  {
    id: 'ink',
    name: 'Tinta en agua',
    note: 'Inyección de tinta desde el borde. Bajo Reynolds → filamentos suaves.',
    inject(s, t) {
      // Flujo base de izquierda a derecha + gota de tinta que cae
      for (let j = 1; j < N - 1; j++) {
        s.u[IX(1, j)] += 0.3;
        s.dens[IX(1, j)] += j > N * 0.3 && j < N * 0.7 ? 0.3 : 0.0;
      }
      // Gota periódica desde arriba
      const dropX = ((N / 2) + Math.sin(t * 0.25) * N * 0.2) | 0;
      s.dens[IX(dropX, 2)] += 0.6;
      s.v[IX(dropX, 2)]    += 0.4;
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// Sub-componente 3D (DENTRO del Canvas — useFrame válido aquí)
// ═══════════════════════════════════════════════════════════════

interface FluidSceneProps {
  fluidRef:  React.MutableRefObject<FluidState>;
  paramsRef: React.MutableRefObject<FluidParams>;
  presetRef: React.MutableRefObject<FluidPreset>;
  running:   boolean;
  onStats:   (maxU: number, maxOmega: number, maxDens: number) => void;
}

const PLANE_SCALE = 6.0;  // Tamaño del plano en unidades world

function makeFluidGeom(posArr: Float32Array, colArr: Float32Array): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  g.setAttribute('color',    new THREE.BufferAttribute(colArr, 3));
  return g;
}

function FluidScene({ fluidRef, paramsRef, presetRef, running, onStats }: FluidSceneProps) {
  // PointCloud: N×N puntos. Posición (x, z) = malla, y = magnitud velocidad
  const frameRef  = useRef(0);
  const simTime   = useRef(0);

  // Inicializar geometrías (imperativo — sin bufferAttribute JSX)
  const posArr  = useRef(new Float32Array(N2 * 3));
  const colArr  = useRef(new Float32Array(N2 * 3));
  const posVArr = useRef(new Float32Array(N2 * 3));
  const colVArr = useRef(new Float32Array(N2 * 3));

  const geomDens = useRef<THREE.BufferGeometry>(makeFluidGeom(posArr.current, colArr.current));
  const geomVort = useRef<THREE.BufferGeometry>(makeFluidGeom(posVArr.current, colVArr.current));

  useFrame((_state, delta) => {
    const s = fluidRef.current;
    const params = paramsRef.current;
    const preset = presetRef.current;

    if (running) {
      simTime.current += delta;
      // Inyectar forzamiento del preset
      preset.inject(s, simTime.current);
      // Avanzar la simulación (1 paso por frame)
      fluidStep(s, params);
      frameRef.current++;
    }

    // Calcular stats
    let maxU = 0, maxOm = 0, maxD = 0;
    for (let i = 0; i < N2; i++) {
      const speed = Math.sqrt(s.u[i] * s.u[i] + s.v[i] * s.v[i]);
      if (speed > maxU) maxU = speed;
      const om = Math.abs(s.omega[i]);
      if (om > maxOm) maxOm = om;
      if (s.dens[i] > maxD) maxD = s.dens[i];
    }
    if (frameRef.current % 6 === 0) onStats(maxU, maxOm, maxD);

    // Actualizar geometría del PointCloud de densidad
    const pos  = posArr.current;
    const col  = colArr.current;
    const posV = posVArr.current;
    const colV = colVArr.current;

    const invN = 1.0 / (N - 1);
    const invMaxD  = maxD  > 1e-6 ? 1.0 / maxD  : 0;
    const invMaxOm = maxOm > 1e-6 ? 1.0 / maxOm : 0;
    const invMaxU  = maxU  > 1e-6 ? 1.0 / maxU  : 0;

    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const idx = i + j * N;
        const px = (i * invN - 0.5) * PLANE_SCALE;
        const pz = (j * invN - 0.5) * PLANE_SCALE;

        const d  = Math.min(s.dens[idx]  * invMaxD,  1.0);
        const om = Math.min(Math.abs(s.omega[idx]) * invMaxOm, 1.0);
        const speed = Math.sqrt(s.u[idx] * s.u[idx] + s.v[idx] * s.v[idx]) * invMaxU;

        // Plano de densidad: Y eleva con velocidad (relieve 3D)
        pos[idx * 3 + 0] = px;
        pos[idx * 3 + 1] = speed * 1.2;   // altura = magnitud de velocidad
        pos[idx * 3 + 2] = pz;

        // Color densidad: blanco → cian brillante (toneMapped=false → bloom)
        col[idx * 3 + 0] = d * 1.0 + (1.0 - d) * 0.05;  // R
        col[idx * 3 + 1] = d * 1.0 + (1.0 - d) * 0.05;  // G
        col[idx * 3 + 2] = d * 1.0 + (1.0 - d) * 0.15;  // B — pequeño tinte frío

        // Plano de vorticidad: ligeramente elevado
        posV[idx * 3 + 0] = px;
        posV[idx * 3 + 1] = speed * 1.2 + 0.05;
        posV[idx * 3 + 2] = pz;

        // Color vorticidad: ω+ = magenta, ω- = cian
        const omRaw = s.omega[idx] * invMaxOm;
        const omPos = Math.max(0, omRaw);
        const omNeg = Math.max(0, -omRaw);
        colV[idx * 3 + 0] = omPos * 1.6;   // R (magenta)
        colV[idx * 3 + 1] = omNeg * 0.3;   // G (apagado)
        colV[idx * 3 + 2] = omNeg * 1.6 + omPos * 0.4;  // B (cian/magenta)
      }
    }

    const gd = geomDens.current;
    if (gd) {
      (gd.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (gd.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
    }
    const gv = geomVort.current;
    if (gv) {
      (gv.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (gv.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <>
      {/* Plano de referencia (grid) */}
      <gridHelper
        args={[PLANE_SCALE, 16, '#0D1B2A', '#0D1B2A']}
        position={[0, -0.02, 0]}
      />

      {/* PointCloud de DENSIDAD — humo/tinta */}
      <points geometry={geomDens.current}>
        <pointsMaterial
          vertexColors
          size={PLANE_SCALE / N * 2.2}
          sizeAttenuation
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      {/* PointCloud de VORTICIDAD — magenta/cian */}
      <points geometry={geomVort.current}>
        <pointsMaterial
          vertexColors
          size={PLANE_SCALE / N * 1.6}
          sizeAttenuation
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════

export default function NavierStokes2D() {
  const { audience } = useAudience();

  const [presetId, setPresetId] = useState<PresetId>('smoke');
  const [running,  setRunning]  = useState(true);
  const [params,   setParams]   = useState<FluidParams>({ ...PARAMS_DEFAULT });

  // Stats del HUD
  const [maxSpeed,  setMaxSpeed]  = useState(0);
  const [maxOmega,  setMaxOmega]  = useState(0);
  const [maxDens,   setMaxDens]   = useState(0);

  // Refs para el sub-componente
  const fluidRef  = useRef<FluidState>(createFluidState());
  const paramsRef = useRef<FluidParams>({ ...PARAMS_DEFAULT });
  const presetRef = useRef<FluidPreset>(PRESETS[0]);

  // Sincronizar params
  useEffect(() => { paramsRef.current = params; }, [params]);

  // Cambiar preset
  useEffect(() => {
    const p = PRESETS.find(p => p.id === presetId)!;
    presetRef.current = p;
  }, [presetId]);

  const resetFluid = useCallback(() => {
    fluidRef.current = createFluidState();
    setMaxSpeed(0);
    setMaxOmega(0);
    setMaxDens(0);
  }, []);

  // Aplicar estado desde la lección
  const handleState = useCallback((patch: Partial<NSState>) => {
    if (patch.preset !== undefined) {
      setPresetId(patch.preset);
      resetFluid();
    }
  }, [resetFluid]);

  const currentPreset = PRESETS.find(p => p.id === presetId)!;

  // Re de Reynolds estimado (U·L/ν, L=1 dominio unitario)
  const Re = params.viscosity > 0
    ? (maxSpeed * DX * N) / params.viscosity
    : Infinity;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage
          cameraDistance={9}
          autoRotate
          bloomIntensity={0.9}
          bloomThreshold={0.08}
          bgColor="#03050A"
        >
          <FluidScene
            fluidRef={fluidRef}
            paramsRef={paramsRef}
            presetRef={presetRef}
            running={running}
            onStats={(u, om, d) => {
              setMaxSpeed(u);
              setMaxOmega(om);
              setMaxDens(d);
            }}
          />
        </Stage>

        {/* HUD de estado */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#030508]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div>
            <span className="text-[#64748B]">Re&nbsp;&nbsp;&nbsp;&nbsp; </span>
            <span className="text-[#FDB813]">{isFinite(Re) ? Re.toFixed(0) : '∞'}</span>
          </div>
          <div>
            <span className="text-[#64748B]">|u|_max </span>
            <span className="text-white">{maxSpeed.toFixed(3)}</span>
          </div>
          <div>
            <span className="text-[#64748B]">|ω|_max </span>
            <span className="text-[#F472B6]">{maxOmega.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[#64748B]">ρ_max&nbsp;&nbsp; </span>
            <span className="text-[#4FC3F7]">{maxDens.toFixed(3)}</span>
          </div>
          <div>
            <span className="text-[#64748B]">N&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span>
            <span className="text-[#94A3B8]">{N}×{N}</span>
          </div>
        </div>

        {/* Leyenda de color */}
        <div className="absolute top-4 right-4 rounded-lg bg-[#030508]/75 backdrop-blur border border-[#1E293B] px-3 py-2 text-[10px] font-mono space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white opacity-80" />
            <span className="text-[#94A3B8]">densidad (ρ)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: '#E879F9' }} />
            <span className="text-[#94A3B8]">ω {'>'} 0 (↺)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: '#22D3EE' }} />
            <span className="text-[#94A3B8]">ω {'<'} 0 (↻)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: '#334155' }} />
            <span className="text-[#94A3B8]">y = |u| (relieve)</span>
          </div>
        </div>

        {/* Controles rápidos */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#030508]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>
            {running ? '❚❚' : '▶'}
          </IconBtn>
          <IconBtn onClick={resetFluid} title="Reiniciar fluido">↺</IconBtn>
          <div className="w-px h-5 bg-[#1E293B]" />
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => { setPresetId(p.id); resetFluid(); }}
              className={`px-2.5 py-1 rounded text-[10px] border transition ${
                presetId === p.id
                  ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
                  : 'border-[#1E293B] text-[#64748B] hover:text-white hover:border-[#334155]'
              }`}
            >
              {p.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <LessonPanel<NSState>
        lesson={LESSON}
        onApplyState={handleState}
        sandbox={
          <>
            <Section title="Preset">
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPresetId(p.id); resetFluid(); }}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      presetId === p.id
                        ? 'bg-gradient-to-br from-[#0E4266]/40 to-[#1B3A4B]/40 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">
                {currentPreset.note}
              </div>
            </Section>

            {audience !== 'child' && (
              <Section title="Parámetros">
                <Slider
                  label="Viscosidad ν"
                  v={params.viscosity}
                  min={0}
                  max={0.0005}
                  step={0.000001}
                  format={v => v.toExponential(1)}
                  on={v => setParams(p => ({ ...p, viscosity: v }))}
                />
                <Slider
                  label="Difusividad κ"
                  v={params.diffusion}
                  min={0}
                  max={0.0005}
                  step={0.000001}
                  format={v => v.toExponential(1)}
                  on={v => setParams(p => ({ ...p, diffusion: v }))}
                />
                <Slider
                  label="Conf. vort. ε"
                  v={params.vortConf}
                  min={0}
                  max={20}
                  step={0.1}
                  on={v => setParams(p => ({ ...p, vortConf: v }))}
                />
              </Section>
            )}

            {audience !== 'child' && (
              <Section title="Observables">
                <Row label="Re"       value={isFinite(Re) ? Re.toFixed(0) : '∞'} />
                <Row label="|u|_max"  value={maxSpeed.toFixed(4)} />
                <Row label="|ω|_max"  value={maxOmega.toFixed(3)} />
                <Row label="ρ_max"    value={maxDens.toFixed(4)} />
                <div className="mt-2 text-[10px] text-[#64748B]">
                  N = {N}×{N} = {N2} celdas<br />
                  Solver: Stam 1999 (semi-lagrangiano)<br />
                  Proyección: Gauss-Seidel 20 iter
                </div>
              </Section>
            )}

            {audience === 'child' && (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>Las partículas <span className="text-white">blancas</span> son humo o tinta moviéndose con el fluido.</p>
                  <p>Las <span className="text-[#E879F9]">magenta</span> y <span className="text-[#22D3EE]">cian</span> muestran vórtices — zonas donde el fluido gira.</p>
                  <p>La altura de cada punto muestra qué tan rápido se mueve el fluido ahí.</p>
                </div>
              </Section>
            )}

            <Section title="Pipeline Stam">
              <div className="text-[10px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">∂u/∂t = −(u·∇)u − ∇p + ν∇²u + f</div>
                <div className="text-[#64748B] mt-1">1. Difusión (Gauss-Seidel)</div>
                <div className="text-[#64748B]">2. Proyección → ∇·u = 0</div>
                <div className="text-[#64748B]">3. Advección semi-lagrangiana</div>
                <div className="text-[#64748B]">4. Proyección final</div>
                <div className="text-[#64748B]">5. Conf. vorticidad (Fedkiw)</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UI helpers (mismo estilo que el resto del Physics Lab)
// ═══════════════════════════════════════════════════════════════

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function Slider({
  label, v, min, max, step, on, format,
}: {
  label: string; v: number; min: number; max: number; step: number;
  on: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{format ? format(v) : v.toFixed(3)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))}
        className="w-full mt-1"
      />
    </div>
  );
}

function IconBtn({
  children, onClick, active, title,
}: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
        active
          ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
