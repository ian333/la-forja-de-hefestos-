/**
 * ══════════════════════════════════════════════════════════════════════
 *  gpu/stencil — Kernel local para PDEs de reacción-difusión
 * ══════════════════════════════════════════════════════════════════════
 *
 * Muchas ecuaciones de la física cuentan la historia de un campo continuo
 * que evoluciona localmente: cada punto mira a sus vecinos inmediatos,
 * aplica un operador lineal (típicamente el Laplaciano) y suma un término
 * no lineal "de reacción" dependiente del valor local.
 *
 *   ∂u/∂t = D ∇²u + R(u)
 *
 * Esta plantilla genera fragment shaders para esa forma, con:
 *
 *   · 1 a 4 campos escalares acoplados (guardados en RGBA de una textura)
 *   · Laplaciano 5-point o 9-point isotrópico
 *   · Frontera periódica, Dirichlet (fixed) o Neumann (free/no-flux)
 *   · Término de reacción inyectable como snippet GLSL
 *
 * Sistemas que caen directo en esta plantilla:
 *
 *   | Ecuación                        | Campos         | R(u)                           |
 *   |--------------------------------|----------------|--------------------------------|
 *   | Difusión / calor               | T              | 0                              |
 *   | Onda 2D (via par {u, ∂u/∂t})   | u, v           | {v, c²∇²u}                     |
 *   | Schrödinger TD (split spatial) | ψ_re, ψ_im     | {-V·ψ_im, V·ψ_re} + ∇² vía i·ℏ |
 *   | Gray-Scott (morfogénesis)      | u, v           | reacción autocatalítica        |
 *   | FitzHugh-Nagumo (neurona)      | V, W           | excitabilidad                  |
 *   | Fisher-KPP (invasión)          | u              | u(1-u)                         |
 *   | Brusselator                    | X, Y           | oscilaciones bio               |
 *   | Hodgkin-Huxley (axón)          | V, m, h, n     | corrientes iónicas             |
 *   | Keller-Segel (quimiotaxis)     | ρ, c           | agregación                     |
 *
 * Ref:
 *   · Murray, "Mathematical Biology", Vol. 2 (2003), §2 — RD estándar.
 *   · Turing 1952, "The Chemical Basis of Morphogenesis", Philos. Trans. B 237:37.
 *   · Taflove & Hagness 2005, "Computational Electrodynamics: FDTD" — waves.
 *   · Griffiths, "Introduction to QM", §11 — Schrödinger TD.
 *   · Pearson 1993, "Complex Patterns in a Simple System", Science 261:189 (Gray-Scott).
 */

import type { ComputeKernel, UniformMap } from './kernel-core';

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════

export type BoundaryType = 'periodic' | 'dirichlet' | 'neumann';

/** Stencil del operador Laplaciano. */
export type LaplacianKind = '5p' | '9p-iso';

/** Reacción: snippet GLSL que computa vec4 R(u) donde u=(u.x, u.y, u.z, u.w). */
export interface ReactionTerm {
  /** Declaraciones de uniforms que usa el snippet. */
  header: string;
  /** Snippet. Acceso a `u` (vec4 lectura local), `R` (vec4 salida, ya en 0), `lap` (vec4 ∇²u por componente). */
  body: string;
  /** Uniforms iniciales. */
  uniforms: UniformMap;
}

export interface StencilKernelOptions {
  /** Resolución del grid (lado, cuadrado). */
  RES: number;
  /** Tamaño físico del dominio (L_x = L_y), para calcular dx. */
  L: number;
  /** Difusividades de cada componente (vec4). Default (1,1,1,1). */
  diffusivity?: [number, number, number, number];
  /** Stencil. Default '5p'. */
  laplacian?: LaplacianKind;
  /** Frontera. Default 'periodic'. */
  boundary?: BoundaryType;
  /** Valor para Dirichlet (si aplica). */
  dirichletValue?: [number, number, number, number];
  /** Término no-lineal de reacción. Default 0. */
  reaction?: ReactionTerm;
  /** Paso temporal inicial. */
  dt?: number;
  /** Nombre de la textura de este campo en el shader (default "textureField"). */
  fieldTextureName?: string;
}

// ═══════════════════════════════════════════════════════════════
// Reacciones pre-fabricadas
// ═══════════════════════════════════════════════════════════════

/** Sin reacción — difusión pura (ecuación del calor). */
export const R_NONE: ReactionTerm = {
  header: '',
  body: /* glsl */ `R = vec4(0.0);`,
  uniforms: {},
};

/**
 * Gray-Scott: ∂u/∂t = Du∇²u - u·v² + F(1-u); ∂v/∂t = Dv∇²v + u·v² - (F+k)v
 * Feed F, kill k. Dominio canónico Pearson: F∈[0.01, 0.08], k∈[0.045, 0.07].
 *
 * Campo: u.x = u, u.y = v. u.z, u.w no usados.
 */
export const R_GRAY_SCOTT: ReactionTerm = {
  header: /* glsl */ `
    uniform float gsF;
    uniform float gsK;
  `,
  body: /* glsl */ `
    {
      float u_ = u.x;
      float v_ = u.y;
      float uvv = u_ * v_ * v_;
      R = vec4(-uvv + gsF * (1.0 - u_),
                uvv - (gsF + gsK) * v_,
                0.0, 0.0);
    }
  `,
  uniforms: {
    gsF: { value: 0.04 },
    gsK: { value: 0.06 },
  },
};

/**
 * FitzHugh-Nagumo simplificado (Murray §12):
 *   ∂V/∂t = D∇²V + V − V³/3 − W + I_ext
 *   ∂W/∂t = ε(V + a − bW)
 *
 * Modelo de neurona excitable. V = potencial, W = recuperación.
 * Campo: u.x = V, u.y = W.
 */
export const R_FITZHUGH_NAGUMO: ReactionTerm = {
  header: /* glsl */ `
    uniform float fhnEps;
    uniform float fhnA;
    uniform float fhnB;
    uniform float fhnIext;
  `,
  body: /* glsl */ `
    {
      float V_ = u.x;
      float W_ = u.y;
      R = vec4(V_ - V_*V_*V_/3.0 - W_ + fhnIext,
               fhnEps * (V_ + fhnA - fhnB * W_),
               0.0, 0.0);
    }
  `,
  uniforms: {
    fhnEps:  { value: 0.08 },
    fhnA:    { value: 0.7 },
    fhnB:    { value: 0.8 },
    fhnIext: { value: 0.0 },
  },
};

/**
 * Fisher-KPP (invasión logística): ∂u/∂t = D∇²u + r·u(1-u/K).
 * Frente de onda que invade con velocidad c = 2√(rD).
 * Campo: u.x.
 */
export const R_FISHER_KPP: ReactionTerm = {
  header: /* glsl */ `
    uniform float fkR;
    uniform float fkK;
  `,
  body: /* glsl */ `
    {
      float u_ = u.x;
      R = vec4(fkR * u_ * (1.0 - u_ / fkK), 0.0, 0.0, 0.0);
    }
  `,
  uniforms: {
    fkR: { value: 1 },
    fkK: { value: 1 },
  },
};

// ═══════════════════════════════════════════════════════════════
// Builder
// ═══════════════════════════════════════════════════════════════

/**
 * Construye el fragment shader para un paso FTCS (forward-time, central-space):
 *
 *   u_{n+1} = u_n + dt · (D · ∇²u_n + R(u_n))
 *
 * Estable si D·dt/dx² ≤ 1/4 en 2D (Courant-Friedrichs-Lewy). La plantilla no
 * impone este check — es responsabilidad del llamador.
 *
 * Para ecuaciones de segundo orden en el tiempo (ondas), usar dos campos
 * acoplados {u, v} con v = ∂u/∂t y reacción = {v, c²∇²u}.
 */
export function buildStencilKernel(opts: StencilKernelOptions): ComputeKernel {
  const RES = opts.RES;
  const fieldName = opts.fieldTextureName ?? 'textureField';
  const lapKind = opts.laplacian ?? '5p';
  const boundary = opts.boundary ?? 'periodic';
  const reaction = opts.reaction ?? R_NONE;
  const diff = opts.diffusivity ?? [1, 1, 1, 1];
  const dx = opts.L / RES;
  const idx2 = 1 / (dx * dx);

  const lapSnippet = lapKind === '5p'
    ? /* glsl */ `
      vec4 sampleLap(vec2 uv, vec2 invRes) {
        vec4 c_  = readBC(uv);
        vec4 lx = readBC(uv + vec2(-invRes.x, 0.0));
        vec4 rx = readBC(uv + vec2( invRes.x, 0.0));
        vec4 dy = readBC(uv + vec2(0.0, -invRes.y));
        vec4 uy = readBC(uv + vec2(0.0,  invRes.y));
        return lx + rx + dy + uy - 4.0 * c_;
      }`
    : /* glsl */ `
      vec4 sampleLap(vec2 uv, vec2 invRes) {
        vec4 c_  = readBC(uv);
        vec4 lx = readBC(uv + vec2(-invRes.x, 0.0));
        vec4 rx = readBC(uv + vec2( invRes.x, 0.0));
        vec4 dy = readBC(uv + vec2(0.0, -invRes.y));
        vec4 uy = readBC(uv + vec2(0.0,  invRes.y));
        vec4 ll = readBC(uv + vec2(-invRes.x, -invRes.y));
        vec4 lu = readBC(uv + vec2(-invRes.x,  invRes.y));
        vec4 rd = readBC(uv + vec2( invRes.x, -invRes.y));
        vec4 ru = readBC(uv + vec2( invRes.x,  invRes.y));
        return (4.0*(lx + rx + dy + uy) + (ll + lu + rd + ru) - 20.0*c_) / 6.0;
      }`;

  // Función de lectura con condiciones de contorno
  const readBC =
    boundary === 'periodic'
      ? /* glsl */ `
        vec4 readBC(vec2 uv) {
          uv = fract(uv);   // wrap [0,1)
          return texture2D(${fieldName}, uv);
        }`
      : boundary === 'dirichlet'
      ? /* glsl */ `
        uniform vec4 dirichletValue;
        vec4 readBC(vec2 uv) {
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return dirichletValue;
          return texture2D(${fieldName}, uv);
        }`
      : /* glsl */ `
        // Neumann / no-flux: reflejar (u_{-1} = u_0)
        vec4 readBC(vec2 uv) {
          uv = clamp(uv, vec2(0.0), vec2(1.0));
          return texture2D(${fieldName}, uv);
        }`;

  const fragmentShader = /* glsl */ `
    precision highp float;
    uniform float dt;
    uniform vec4 diffusivity;
    uniform vec2 invRes;
    uniform float idx2;   // 1/dx²
    ${reaction.header}

    ${readBC}

    ${lapSnippet}

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      vec4 u = texture2D(${fieldName}, uv);
      vec4 lap = sampleLap(uv, invRes) * idx2;
      vec4 R;
      ${reaction.body}
      vec4 uNew = u + dt * (diffusivity * lap + R);
      gl_FragColor = uNew;
    }
  `;

  const uniforms: UniformMap = {
    dt:          { value: opts.dt ?? 0.01 },
    diffusivity: { value: diff },
    invRes:      { value: [1 / RES, 1 / RES] },
    idx2:        { value: idx2 },
    ...(boundary === 'dirichlet'
      ? { dirichletValue: { value: opts.dirichletValue ?? [0, 0, 0, 0] } }
      : {}),
    ...reaction.uniforms,
  };

  return { fragmentShader, uniforms };
}

// ═══════════════════════════════════════════════════════════════
// Referencia CPU — misma matemática que el shader
// ═══════════════════════════════════════════════════════════════

export interface StencilCpuOptions {
  RES: number;
  L: number;
  diffusivity?: [number, number, number, number];
  laplacian?: LaplacianKind;
  boundary?: BoundaryType;
  dirichletValue?: [number, number, number, number];
  /** Reacción CPU: out (length 4) ← f(u_local [4], x, y). Default: out=0. */
  reaction?: (out: Float32Array, u: Float32Array, x: number, y: number) => void;
  dt?: number;
}

/**
 * Un step FTCS 2D con 4 campos. Trabaja sobre `field` (length 4·RES²) y
 * escribe en `next` (length 4·RES²). No hace swap — el llamador decide.
 */
export function stencilStepCpu(
  field: Float32Array,
  next: Float32Array,
  opts: StencilCpuOptions,
): void {
  const { RES, L } = opts;
  const diff = opts.diffusivity ?? [1, 1, 1, 1];
  const kind = opts.laplacian ?? '5p';
  const bnd  = opts.boundary ?? 'periodic';
  const dir  = opts.dirichletValue ?? [0, 0, 0, 0];
  const dt   = opts.dt ?? 0.01;
  const dx   = L / RES;
  const idx2 = 1 / (dx * dx);
  const reaction = opts.reaction;

  const get = (i: number, j: number, c: number) => {
    if (bnd === 'periodic') {
      i = ((i % RES) + RES) % RES;
      j = ((j % RES) + RES) % RES;
    } else if (bnd === 'dirichlet') {
      if (i < 0 || i >= RES || j < 0 || j >= RES) return dir[c];
    } else {
      // neumann: clamp (reflejo de una celda)
      if (i < 0) i = 0; else if (i >= RES) i = RES - 1;
      if (j < 0) j = 0; else if (j >= RES) j = RES - 1;
    }
    return field[(j * RES + i) * 4 + c];
  };

  const tmpU = new Float32Array(4);
  const tmpR = new Float32Array(4);
  const tmpLap = new Float32Array(4);

  for (let j = 0; j < RES; j++) {
    for (let i = 0; i < RES; i++) {
      const idx = (j * RES + i) * 4;
      for (let c = 0; c < 4; c++) {
        const center = get(i, j, c);
        const L_ = get(i - 1, j, c);
        const R_ = get(i + 1, j, c);
        const D_ = get(i, j - 1, c);
        const U_ = get(i, j + 1, c);
        let lap: number;
        if (kind === '5p') {
          lap = (L_ + R_ + D_ + U_ - 4 * center) * idx2;
        } else {
          const LD = get(i - 1, j - 1, c);
          const LU = get(i - 1, j + 1, c);
          const RD = get(i + 1, j - 1, c);
          const RU = get(i + 1, j + 1, c);
          lap = ((4 * (L_ + R_ + D_ + U_) + (LD + LU + RD + RU) - 20 * center) / 6) * idx2;
        }
        tmpU[c] = center;
        tmpLap[c] = lap;
      }
      tmpR.fill(0);
      if (reaction) {
        const x = -L/2 + (i + 0.5) * dx;
        const y = -L/2 + (j + 0.5) * dx;
        reaction(tmpR, tmpU, x, y);
      }
      for (let c = 0; c < 4; c++) {
        next[idx + c] = tmpU[c] + dt * (diff[c] * tmpLap[c] + tmpR[c]);
      }
    }
  }
}

/** Norma L² de un campo (diferencia u - v en particular). */
export function stencilNormL2(field: Float32Array, component = 0): number {
  let s = 0;
  const N = field.length / 4;
  for (let i = 0; i < N; i++) {
    const v = field[i * 4 + component];
    s += v * v;
  }
  return Math.sqrt(s / N);
}
