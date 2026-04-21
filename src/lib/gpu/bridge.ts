/**
 * ══════════════════════════════════════════════════════════════════════
 *  gpu/bridge — Coarse-graining atómico → campos continuos
 * ══════════════════════════════════════════════════════════════════════
 *
 * Cada celda (blob) de un grid grueso recibe las propiedades promedio
 * de los átomos que caen dentro:
 *
 *   ρ(x)   = (1/V) Σᵢ mᵢ              densidad de masa
 *   p(x)   = (1/V) Σᵢ mᵢ·vᵢ           densidad de momento
 *   u(x)   = p/ρ                       velocidad del "fluido"
 *   T(x)   = (1/3N_blob) Σᵢ mᵢ(vᵢ-u)² temperatura local (equipartición)
 *   cₛ(x)  = N_s^V / V                 concentración por especie
 *
 * Ref: Irving & Kirkwood 1950, J. Chem. Phys. 18:817 (stress tensor).
 *      Español & Serrano 1997, JCP 107:2716 (coarse-graining formal).
 *
 * El blob grid es 3D pero se guarda como textura 2D: (Bx) × (By·Bz).
 * Cada "fila" de textura cubre una capa-Z. Simple, cabe en GLSL 1.0.
 *
 * En CPU usamos arrays 3D (i + RES*(j + RES*k)). En ambos casos la función
 * de acumulación es idéntica — el test CPU↔GPU cierra el círculo.
 *
 * Filosofía: MISMA abstracción que `pairwise.ForceLaw` y `stencil.ReactionTerm`.
 * Agregadores pluggables: el `density` aggregator guarda ρ, el `momentum`
 * guarda p, el `kinetic-energy` guarda KE térmica, etc. Mezclas los que
 * necesites en un solo kernel (4 floats por texel → hasta 4 escalares).
 */

import type { ComputeKernel, UniformMap } from './kernel-core';

// ═══════════════════════════════════════════════════════════════
// Aggregators — qué sumar por cada átomo dentro del blob
// ═══════════════════════════════════════════════════════════════

/**
 * Un agregador es un snippet GLSL que ejecuta **por átomo dentro del blob**
 * y acumula en una `vec4 acc`. Variables disponibles:
 *   · `pos` (vec4: x,y,z,species), `vel` (vec4: vx,vy,vz,mass)
 *   · `u`   (vec3: velocidad media pre-calculada, válido en pass 2)
 *   · `V`   (float: volumen del blob)
 *
 * El `normalize` corre una vez al final, sobre `acc`, para dividir por V,
 * por masa, etc.
 */
export interface Aggregator {
  /** Uniforms que usa el snippet. */
  header: string;
  /** Snippet a insertar dentro del loop por átomo dentro del blob. */
  accumulate: string;
  /** Snippet de normalización — ejecuta tras el loop. Muta `acc`. */
  normalize: string;
  /** Si necesita `u = p/ρ` (temperatura, stress) — activa pass-2. */
  needsFluidVelocity: boolean;
  uniforms: UniformMap;
}

/** ρ en .x, momentum density en .yzw. Primer paso, más usado. */
export const FLUID_AGG: Aggregator = {
  header: '',
  accumulate: /* glsl */ `
    acc.x   += vel.w;                 // masa
    acc.yzw += vel.w * vel.xyz;       // p = m·v
  `,
  normalize: /* glsl */ `acc /= V;`,
  needsFluidVelocity: false,
  uniforms: {},
};

/**
 * Temperatura local (pass 2). Guarda (3·k_B·T·ρ) en .x — la división por ρ
 * ocurre CPU-side al leer (más numéricamente estable cuando ρ→0).
 *
 * Equipartición: ⟨½m(v-u)²⟩_V = (3/2)·k_B·T → guardamos Σ m(v-u)².
 */
export const THERMAL_AGG: Aggregator = {
  header: '',
  accumulate: /* glsl */ `
    vec3 vrel = vel.xyz - u;
    acc.x += vel.w * dot(vrel, vrel);
  `,
  normalize: /* glsl */ `acc.x /= (3.0 * V);`,
  needsFluidVelocity: true,
  uniforms: {},
};

/**
 * Conteo por especie (hasta 4). .x = species 0, .y = species 1, etc.
 * Normalizado a concentración (número por unidad de volumen).
 */
export const SPECIES_AGG: Aggregator = {
  header: '',
  accumulate: /* glsl */ `
    int sp = int(pos.w + 0.5);
    if      (sp == 0) acc.x += 1.0;
    else if (sp == 1) acc.y += 1.0;
    else if (sp == 2) acc.z += 1.0;
    else              acc.w += 1.0;
  `,
  normalize: /* glsl */ `acc /= V;`,
  needsFluidVelocity: false,
  uniforms: {},
};

// ═══════════════════════════════════════════════════════════════
// GPU builder
// ═══════════════════════════════════════════════════════════════

export interface BridgeKernelOptions {
  /** Átomos por lado de textura (total = atomsPerSide²). */
  atomsPerSide: number;
  /** Blobs por lado del grid 3D (total = blobsPerSide³). Debe ser pequeño (≤ 32). */
  blobsPerSide: number;
  /** Arista de la caja cúbica del sistema atómico (también el dominio blob). */
  boxSize: number;
  /** Aggregator a usar. Default FLUID_AGG. */
  aggregator?: Aggregator;
  /** Aplicar PBC al emparejar átomo con blob (true por default). */
  periodic?: boolean;
  /** Nombres de las texturas atómicas. */
  positionTextureName?: string;
  velocityTextureName?: string;
  /**
   * Si el aggregator necesita u (pass 2), se debe proveer la textura de
   * densidad+momento ya calculada en pass 1.
   */
  fluidTextureName?: string;
}

/**
 * Construye un fragment shader que escribe un blob del grid grueso.
 * El grid 3D de blobs se aplana en 2D: textura de tamaño
 *   width  = blobsPerSide
 *   height = blobsPerSide × blobsPerSide
 * Fragmento (x, y) → blob (bx=x, by=y%RES, bz=y/RES).
 */
export function buildBridgeKernel(opts: BridgeKernelOptions): ComputeKernel {
  const A = opts.atomsPerSide;
  const B = opts.blobsPerSide;
  const agg = opts.aggregator ?? FLUID_AGG;
  const usePBC = opts.periodic ?? true;
  const posName = opts.positionTextureName ?? 'texturePosition';
  const velName = opts.velocityTextureName ?? 'textureVelocity';
  const fluidName = opts.fluidTextureName ?? 'textureFluid';

  const fragmentShader = /* glsl */ `
    precision highp float;
    uniform float boxSize;
    uniform float halfBox;
    uniform float cellSize;   // boxSize / B
    uniform float V;          // cellSize^3
    ${agg.needsFluidVelocity ? `uniform sampler2D ${fluidName};` : ''}
    ${agg.header}

    const int A_SIDE = ${A};
    const int B_SIDE = ${B};
    const float B_F  = ${B.toFixed(1)};

    void main() {
      // Decodificar blob 3D desde fragment 2D
      int fx = int(gl_FragCoord.x);
      int fy = int(gl_FragCoord.y);
      int bx = fx;
      int by = fy - (fy / B_SIDE) * B_SIDE;   // fy % B
      int bz = fy / B_SIDE;
      vec3 cellCenter = vec3(-halfBox) + (vec3(float(bx), float(by), float(bz)) + 0.5) * cellSize;
      vec3 half = vec3(cellSize * 0.5);

      ${agg.needsFluidVelocity ? /* glsl */ `
      // Pass 2: leer u previamente calculado (ρ en .x, p en .yzw)
      vec2 blobUV = gl_FragCoord.xy / vec2(B_F, B_F * B_F);
      vec4 fluid = texture2D(${fluidName}, blobUV);
      vec3 u = fluid.x > 1e-8 ? fluid.yzw / fluid.x : vec3(0.0);
      ` : ''}

      vec4 acc = vec4(0.0);

      for (int ay = 0; ay < A_SIDE; ay++) {
        for (int ax = 0; ax < A_SIDE; ax++) {
          vec2 atomUV = (vec2(float(ax), float(ay)) + 0.5) / vec2(float(A_SIDE));
          vec4 pos = texture2D(${posName}, atomUV);
          vec4 vel = texture2D(${velName}, atomUV);

          vec3 d = pos.xyz - cellCenter;
          ${usePBC ? `d -= boxSize * floor(d / boxSize + 0.5);` : ''}
          if (any(greaterThanEqual(abs(d), half))) continue;

          ${agg.accumulate}
        }
      }

      ${agg.normalize}
      gl_FragColor = acc;
    }
  `;

  const uniforms: UniformMap = {
    boxSize:  { value: opts.boxSize },
    halfBox:  { value: opts.boxSize / 2 },
    cellSize: { value: opts.boxSize / B },
    V:        { value: Math.pow(opts.boxSize / B, 3) },
    ...agg.uniforms,
  };
  if (agg.needsFluidVelocity) {
    uniforms[fluidName] = { value: null };  // runtime setea
  }

  return { fragmentShader, uniforms };
}

// ═══════════════════════════════════════════════════════════════
// CPU reference — source of truth para tests
// ═══════════════════════════════════════════════════════════════

export interface BridgeField {
  /** Lado del grid de blobs. */
  RES: number;
  /** Arista de la caja. */
  L: number;
  /** Volumen de un blob. */
  V: number;
  /** ρ(ix,iy,iz) en flat index i + RES*(j + RES*k). */
  rho: Float32Array;
  /** px, py, pz en 3 arrays separados (evita cache-miss vs interleaved). */
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  /** Temperatura local. Requiere pass 2 si se quiere; cero por default. */
  T: Float32Array;
  /** Conteo atómico crudo por blob (útil para edge cases). */
  count: Int32Array;
  /** Concentración por especie (máximo 4). */
  species: Float32Array[];
}

export function createBridgeField(RES: number, L: number, numSpecies = 4): BridgeField {
  const N = RES * RES * RES;
  const V = Math.pow(L / RES, 3);
  return {
    RES, L, V,
    rho: new Float32Array(N),
    px:  new Float32Array(N),
    py:  new Float32Array(N),
    pz:  new Float32Array(N),
    T:   new Float32Array(N),
    count: new Int32Array(N),
    species: Array.from({ length: numSpecies }, () => new Float32Array(N)),
  };
}

export interface BridgeCpuOptions {
  /** Arista caja. */
  boxSize: number;
  /** PBC (default true). */
  periodic?: boolean;
  /** Pass 2: si `true`, calcula T local usando u = p/ρ ya calculado. */
  computeTemperature?: boolean;
}

/**
 * Un paso de bridge: lee pos/vel atómicos, escribe campos en `field`.
 * Los campos se ZEROan primero — idempotente si llamas dos veces.
 */
export function bridgeStepCpu(
  atomicPos: Float32Array,   // length 4·N
  atomicVel: Float32Array,
  N: number,
  field: BridgeField,
  opts: BridgeCpuOptions,
): void {
  const { RES, L, V } = field;
  const cell = L / RES;
  const half = L / 2;
  const usePBC = opts.periodic ?? true;
  const numSp = field.species.length;

  // Zero
  field.rho.fill(0);
  field.px.fill(0);
  field.py.fill(0);
  field.pz.fill(0);
  field.T.fill(0);
  field.count.fill(0);
  for (let s = 0; s < numSp; s++) field.species[s].fill(0);

  // Pass 1: ρ, p, conteos, species
  for (let i = 0; i < N; i++) {
    let x = atomicPos[i*4    ];
    let y = atomicPos[i*4 + 1];
    let z = atomicPos[i*4 + 2];
    const sp = Math.round(atomicPos[i*4 + 3]);
    const vx = atomicVel[i*4    ];
    const vy = atomicVel[i*4 + 1];
    const vz = atomicVel[i*4 + 2];
    const m  = atomicVel[i*4 + 3];

    if (usePBC) {
      x -= opts.boxSize * Math.floor(x / opts.boxSize + 0.5);
      y -= opts.boxSize * Math.floor(y / opts.boxSize + 0.5);
      z -= opts.boxSize * Math.floor(z / opts.boxSize + 0.5);
    }

    // Mapear a blob
    const bx = Math.floor((x + half) / cell);
    const by = Math.floor((y + half) / cell);
    const bz = Math.floor((z + half) / cell);
    if (bx < 0 || bx >= RES || by < 0 || by >= RES || bz < 0 || bz >= RES) continue;

    const idx = bx + RES * (by + RES * bz);
    field.rho[idx] += m;
    field.px[idx]  += m * vx;
    field.py[idx]  += m * vy;
    field.pz[idx]  += m * vz;
    field.count[idx] += 1;
    if (sp >= 0 && sp < numSp) field.species[sp][idx] += 1;
  }

  // Normalizar ρ y p por V (concentración por volumen)
  const Ntotal = field.rho.length;
  for (let i = 0; i < Ntotal; i++) {
    field.rho[i] /= V;
    field.px[i]  /= V;
    field.py[i]  /= V;
    field.pz[i]  /= V;
    for (let s = 0; s < numSp; s++) field.species[s][i] /= V;
  }

  // Pass 2: T local (requiere u pre-calculado)
  if (opts.computeTemperature) {
    // u = p/ρ por blob
    const u = new Float32Array(Ntotal * 3);
    for (let i = 0; i < Ntotal; i++) {
      const r = field.rho[i];
      if (r > 1e-10) {
        u[i*3    ] = field.px[i] / r;
        u[i*3 + 1] = field.py[i] / r;
        u[i*3 + 2] = field.pz[i] / r;
      }
    }
    // Acumular Σ m(v - u)² por blob
    const thermalSum = new Float32Array(Ntotal);
    for (let i = 0; i < N; i++) {
      let x = atomicPos[i*4];
      let y = atomicPos[i*4 + 1];
      let z = atomicPos[i*4 + 2];
      const vx = atomicVel[i*4], vy = atomicVel[i*4 + 1], vz = atomicVel[i*4 + 2];
      const m  = atomicVel[i*4 + 3];
      if (usePBC) {
        x -= opts.boxSize * Math.floor(x / opts.boxSize + 0.5);
        y -= opts.boxSize * Math.floor(y / opts.boxSize + 0.5);
        z -= opts.boxSize * Math.floor(z / opts.boxSize + 0.5);
      }
      const bx = Math.floor((x + half) / cell);
      const by = Math.floor((y + half) / cell);
      const bz = Math.floor((z + half) / cell);
      if (bx < 0 || bx >= RES || by < 0 || by >= RES || bz < 0 || bz >= RES) continue;
      const idx = bx + RES * (by + RES * bz);
      const dvx = vx - u[idx*3    ];
      const dvy = vy - u[idx*3 + 1];
      const dvz = vz - u[idx*3 + 2];
      thermalSum[idx] += m * (dvx*dvx + dvy*dvy + dvz*dvz);
    }
    // T = (1/3·N_blob·k_B) · Σ m(v-u)². En unidades reducidas k_B=1.
    for (let i = 0; i < Ntotal; i++) {
      const n = field.count[i];
      field.T[i] = n > 0 ? thermalSum[i] / (3 * n) : 0;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Observables globales — útiles para tests de conservación
// ═══════════════════════════════════════════════════════════════

/** Masa total en los campos (debe coincidir con Σᵢ mᵢ del sistema atómico). */
export function totalMass(field: BridgeField): number {
  let m = 0;
  for (let i = 0; i < field.rho.length; i++) m += field.rho[i] * field.V;
  return m;
}

/** Momento total (debe ≈ 0 si CoM drift removido). */
export function totalMomentum(field: BridgeField): [number, number, number] {
  let px = 0, py = 0, pz = 0;
  for (let i = 0; i < field.px.length; i++) {
    px += field.px[i] * field.V;
    py += field.py[i] * field.V;
    pz += field.pz[i] * field.V;
  }
  return [px, py, pz];
}

/** Temperatura promedio pesada por átomo (no por volumen). */
export function meanTemperature(field: BridgeField): number {
  let w = 0, T = 0;
  for (let i = 0; i < field.T.length; i++) {
    const n = field.count[i];
    if (n > 0) { T += field.T[i] * n; w += n; }
  }
  return w > 0 ? T / w : 0;
}

/** Filtro exponencial en tiempo: campo' = (1-α)·campo + α·nuevo. */
export function timeAverage(
  field: BridgeField, fresh: BridgeField, alpha: number,
): void {
  const N = field.rho.length;
  for (let i = 0; i < N; i++) {
    field.rho[i] = (1 - alpha) * field.rho[i] + alpha * fresh.rho[i];
    field.px[i]  = (1 - alpha) * field.px[i]  + alpha * fresh.px[i];
    field.py[i]  = (1 - alpha) * field.py[i]  + alpha * fresh.py[i];
    field.pz[i]  = (1 - alpha) * field.pz[i]  + alpha * fresh.pz[i];
    field.T[i]   = (1 - alpha) * field.T[i]   + alpha * fresh.T[i];
    for (let s = 0; s < field.species.length; s++) {
      field.species[s][i] = (1 - alpha) * field.species[s][i] + alpha * fresh.species[s][i];
    }
  }
}
