/**
 * ══════════════════════════════════════════════════════════════════════
 *  gpu/pairwise — Kernel O(N²) parametrizado por ley de fuerza
 * ══════════════════════════════════════════════════════════════════════
 *
 * Muchas simulaciones físicas se reducen a: "cada partícula i siente una
 * fuerza ΣⱼFᵢⱼ que depende de la separación rᵢⱼ y de las propiedades de
 * i y j." Las diferencias entre disciplinas son sólo la forma funcional
 * de F(r), no la arquitectura.
 *
 * Este módulo factoriza esa arquitectura:
 *
 *   buildPairwiseKernel({ forceLawGLSL, ... })
 *     → { fragmentShader, uniforms }
 *
 * donde `forceLawGLSL` es un snippet que computa `vec3 F` dada la
 * diferencia `diff`, la distancia al cuadrado `r2`, y las propiedades
 * por especie/átomo de i y j. El kernel se encarga de:
 *
 *   · iterar j ∈ [0, N) con loop de bound constante
 *   · skip-self
 *   · PBC minimum-image (opcional)
 *   · cutoff de corto alcance (opcional)
 *   · summa de fuerzas
 *   · kick de velocidad y drift de posición (Verlet "velocity-form")
 *
 * Leyes soportadas out-of-the-box como snippets pre-fabricados:
 *   · Lennard-Jones 12-6
 *   · Coulomb (carga en canal `.w` de velocidad o posición)
 *   · Gravitación newtoniana
 *   · Morse (enlace covalente anarmónico)
 *
 * El mismo kernel sirve para química (LJ), astronomía (grav), plasma
 * (Coulomb), proteínas (LJ+Coulomb+torsion por bond-list). La bond-list
 * se inyecta como textura adicional en una extensión futura.
 *
 * Ref:
 *   · Allen & Tildesley, "Computer Simulation of Liquids", 2ª ed., 2017
 *     §3 (fuerzas y potenciales), §4 (Verlet).
 *   · Frenkel & Smit, "Understanding Molecular Simulation", 2ª ed., 2002.
 *   · Plimpton 1995, "Fast Parallel Algorithms for Short-Range MD"
 *     (J. Comput. Phys. 117:1) — todo el diseño de LAMMPS cabe en esta
 *     plantilla para nuestro rango de N.
 */

import type { ComputeKernel, UniformMap } from './kernel-core';

// ═══════════════════════════════════════════════════════════════
// Snippets GLSL pre-fabricados de leyes de fuerza
// ═══════════════════════════════════════════════════════════════

/**
 * Leyes de fuerza inyectables. Cada ley computa `vec3 F` dado:
 *
 *   · `diff` — r_i - r_j, ya aplicado PBC si activado
 *   · `r2`   — |diff|²
 *   · `speciesI`, `speciesJ` — ints ∈ [0,4)
 *   · uniforms específicos de la ley (declarados como header)
 *
 * Debe definir también `header` con `uniform` declarations. El kernel
 * las concatena al shader.
 */
export interface ForceLaw {
  /** Uniform declarations prepended al shader. */
  header: string;
  /** Snippet que, dentro del loop, suma a `force` la contribución ij. */
  body: string;
  /** Uniforms iniciales (se copian al kernel). */
  uniforms: UniformMap;
}

/**
 * Lennard-Jones 12-6 multi-especie con Lorentz-Berthelot.
 *   V(r) = 4ε[(σ/r)¹² − (σ/r)⁶], F = −∇V.
 *
 * Canal `.w` de posición es `speciesId` ∈ {0,1,2,3}. Uniforms `vec4`
 * guardan σ, ε por especie. `epsilonScale` permite modular la fuerza
 * globalmente (útil para pedagogía).
 */
export const LJ_FORCE: ForceLaw = {
  header: /* glsl */ `
    uniform vec4 ljSigma;
    uniform vec4 ljEpsilon;
    uniform float epsilonScale;
    uniform float cutoffFactor;   // ej 2.5 (en unidades de sigma)

    float lj_getSp(vec4 p, int s) {
      if (s == 0) return p.x;
      if (s == 1) return p.y;
      if (s == 2) return p.z;
      return p.w;
    }
  `,
  body: /* glsl */ `
    {
      float sI  = lj_getSp(ljSigma,   speciesI);
      float sJ  = lj_getSp(ljSigma,   speciesJ);
      float eI  = lj_getSp(ljEpsilon, speciesI);
      float eJ  = lj_getSp(ljEpsilon, speciesJ);
      float sigma   = 0.5 * (sI + sJ);
      float epsilon = sqrt(eI * eJ) * epsilonScale;
      float rCut    = cutoffFactor * sigma;
      if (r2 > rCut * rCut || r2 < 0.01 * sigma * sigma) continue;
      float s2   = sigma * sigma;
      float ir2  = 1.0 / r2;
      float sr2  = s2 * ir2;
      float sr6  = sr2 * sr2 * sr2;
      float sr12 = sr6 * sr6;
      float Fmag = 24.0 * epsilon * (2.0 * sr12 - sr6) * ir2;
      Fmag = clamp(Fmag, -1e4, 1e4);
      force += Fmag * diff;
    }
  `,
  uniforms: {
    ljSigma:      { value: [1, 1, 1, 1] },
    ljEpsilon:    { value: [1, 1, 1, 1] },
    epsilonScale: { value: 1 },
    cutoffFactor: { value: 2.5 },
  },
};

/**
 * Fuerza gravitacional Newtoniana: F_ij = −G m_i m_j r̂ / r².
 * Masa en canal `.w` de la textura de velocidad.
 *
 * Softening Plummer opcional (ε): r² → r² + ε² para evitar singularidad
 * en close-encounters (Aarseth 2003, §3.3).
 */
export const GRAVITY_FORCE: ForceLaw = {
  header: /* glsl */ `
    uniform float gravG;
    uniform float gravEps;   // softening radius (0 = off)
  `,
  body: /* glsl */ `
    {
      float mJ = velJ.w;
      float soft = gravEps * gravEps;
      float r2s  = r2 + soft;
      float invR = inversesqrt(r2s);
      float invR3 = invR * invR * invR;
      // F sobre i debida a j: -G m_j r̂ / r² → para añadir a "force" antes
      // de multiplicar por mI al final: aquí ya la suma pairwise.
      float Fmag = -gravG * mJ * invR3;
      force += Fmag * diff;
    }
  `,
  uniforms: {
    gravG:   { value: 1 },
    gravEps: { value: 0.02 },
  },
};

/**
 * Fuerza de Coulomb: F_ij = k q_i q_j r̂ / r². Carga en canal `.w`
 * de posición (sustituye al `speciesId` — la plantilla decide).
 *
 * Usamos cutoff simple sin Ewald — adecuado para neutralidad aproximada
 * y sistemas pequeños (N ≤ 16K). Para plasma/electrolitos serios hay
 * que añadir sumas de Ewald, pero eso va en otra plantilla.
 */
export const COULOMB_FORCE: ForceLaw = {
  header: /* glsl */ `
    uniform float coulombK;
    uniform float coulombCut;
  `,
  body: /* glsl */ `
    {
      if (r2 > coulombCut * coulombCut || r2 < 1e-8) continue;
      float qI = posI.w;
      float qJ = posJ.w;
      float invR = inversesqrt(r2);
      float invR3 = invR * invR * invR;
      float Fmag = coulombK * qI * qJ * invR3;
      force += Fmag * diff;
    }
  `,
  uniforms: {
    coulombK:   { value: 1 },
    coulombCut: { value: 10 },
  },
};

/**
 * Potencial de Morse (enlace covalente anarmónico):
 *   V(r) = D [1 - exp(-α(r-rₑ))]²
 *   F = 2 D α [exp(-2α(r-rₑ)) - exp(-α(r-rₑ))] r̂
 *
 * Útil para pares bonded en proteínas/moléculas pequeñas. Aquí se aplica
 * a TODOS los pares; si se quiere solo a pares enlazados, usar la variante
 * con bond-list (no incluida aquí por ahora).
 */
export const MORSE_FORCE: ForceLaw = {
  header: /* glsl */ `
    uniform float morseD;     // depth
    uniform float morseAlpha; // width
    uniform float morseReq;   // equilibrium
  `,
  body: /* glsl */ `
    {
      float r  = sqrt(r2);
      float x  = -morseAlpha * (r - morseReq);
      float e  = exp(x);
      float e2 = e * e;
      float Fmag = 2.0 * morseD * morseAlpha * (e2 - e) / max(r, 1e-6);
      force += Fmag * diff;
    }
  `,
  uniforms: {
    morseD:     { value: 1 },
    morseAlpha: { value: 1.5 },
    morseReq:   { value: 1 },
  },
};

// ═══════════════════════════════════════════════════════════════
// Builder de kernels pairwise
// ═══════════════════════════════════════════════════════════════

export interface PairwiseKernelOptions {
  /** Lado del grid (RES × RES = N partículas). GLSL 1.0 requiere const. */
  RES: number;
  /** Ley(es) de fuerza — se suman sus contribuciones. */
  forces: ForceLaw[];
  /** Activar PBC con esta caja cúbica (undefined = sin PBC). */
  boxSize?: number;
  /**
   * Capar velocidad a este valor (unidades del sim). 0 = sin cap.
   * Útil para estabilidad en arranques calientes.
   */
  speedCap?: number;
  /**
   * Termostato Berendsen. Si `tau > 0` y `targetTemp > 0`, escala velocidades
   * hacia `targetTemp` con constante de relajación `tau` (pasos).
   */
  thermostat?: 'berendsen' | 'off';
  /**
   * Nombre del uniform de la textura de posición en el shader.
   * El engine de Three.js usa convención: el nombre del VariableSpec es
   * el mismo que el sampler. Default: "texturePosition".
   */
  positionTextureName?: string;
  /** Idem para velocidad. Default: "textureVelocity". */
  velocityTextureName?: string;
  /**
   * Bond-list opcional — eleva el kernel a simulación de moléculas:
   *   · Fuerza Morse entre pares enlazados.
   *   · El loop pair-wise SKIPS pares bonded (evita contabilizar dos veces
   *     la interacción corta; Morse ya da la anarmonía cerca de r_eq).
   *
   * La textura de bonds (`textureBonds` por default) es RGBA32F del mismo
   * tamaño que `texturePosition`. Cada texel guarda hasta 2 partners:
   *   bonds.rg = UV del partner 1 (-1 = no bond)
   *   bonds.ba = UV del partner 2 (-1 = no bond)
   *
   * Es estática: se sube una vez como uniform, no ping-pong. El engine
   * se encarga de crearla a partir de una `Int32Array` de índices.
   */
  bonds?: {
    /** Profundidad del pozo Morse (≈ energía de disociación). */
    D: number;
    /** Anchura α — curvatura del pozo = 2Dα². */
    alpha: number;
    /** Distancia de equilibrio. */
    rEq: number;
    /** Nombre del sampler (default "textureBonds"). */
    textureName?: string;
  };
}

/**
 * Construye el shader de VELOCIDAD (kick: v ← v + F·dt/m) para un sistema
 * pairwise. Se acompaña con `buildDriftKernel` para cerrar el Verlet.
 */
export function buildPairwiseVelocityKernel(opts: PairwiseKernelOptions): ComputeKernel {
  const RES = opts.RES;
  const posName = opts.positionTextureName ?? 'texturePosition';
  const velName = opts.velocityTextureName ?? 'textureVelocity';
  const usePBC = opts.boxSize !== undefined;
  const useThermo = (opts.thermostat ?? 'off') === 'berendsen';
  const bondsName = opts.bonds?.textureName ?? 'textureBonds';
  const useBonds = opts.bonds !== undefined;

  const forceHeaders = opts.forces.map(f => f.header).join('\n');
  const forceBodies  = opts.forces.map(f => f.body).join('\n');

  // Snippet: "¿estoy enlazado a la uv uvJ?" — compara contra las 2 uv
  // guardadas en la textura de bonds. Sentinel: componente < 0.
  const isBondedGLSL = useBonds ? /* glsl */ `
    bool isBondedTo(vec2 bonds_rg, vec2 bonds_ba, vec2 uvJ) {
      if (bonds_rg.x >= 0.0 &&
          abs(bonds_rg.x - uvJ.x) < 0.5/RES_F &&
          abs(bonds_rg.y - uvJ.y) < 0.5/RES_F) return true;
      if (bonds_ba.x >= 0.0 &&
          abs(bonds_ba.x - uvJ.x) < 0.5/RES_F &&
          abs(bonds_ba.y - uvJ.y) < 0.5/RES_F) return true;
      return false;
    }
  ` : '';

  // Snippet: fuerza Morse hacia cada bonded partner.
  const bondForceGLSL = useBonds ? /* glsl */ `
    {
      for (int bi = 0; bi < 2; bi++) {
        vec2 partnerUV = (bi == 0) ? bondTex.rg : bondTex.ba;
        if (partnerUV.x < 0.0) continue;
        vec4 posJ = texture2D(${posName}, partnerUV);
        vec3 diff = posI.xyz - posJ.xyz;
        ${usePBC ? `diff -= boxSize * floor(diff / boxSize + 0.5);` : ''}
        float r2 = dot(diff, diff);
        if (r2 < 1e-10) continue;
        float r = sqrt(r2);
        float x = -bondAlpha * (r - bondReq);
        float e = exp(x);
        float Fmag = 2.0 * bondD * bondAlpha * (e*e - e) / max(r, 1e-6);
        // clamp generoso para arranques con enlaces muy estirados
        Fmag = clamp(Fmag, -1e4, 1e4);
        force += Fmag * diff;
      }
    }
  ` : '';

  const fragmentShader = /* glsl */ `
    precision highp float;
    uniform float dt;
    ${usePBC ? `uniform float boxSize;` : ''}
    ${useThermo ? `uniform float targetTemp; uniform float thermoTau;` : ''}
    uniform float speedCap;
    ${useBonds ? `
    uniform sampler2D ${bondsName};
    uniform float bondD;
    uniform float bondAlpha;
    uniform float bondReq;` : ''}
    ${forceHeaders}

    const int RES = ${RES};
    const float RES_F = ${RES.toFixed(1)};

    ${isBondedGLSL}

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      vec4 posI = texture2D(${posName}, uv);
      vec4 velI = texture2D(${velName}, uv);

      int speciesI = int(posI.w + 0.5);
      float massI = velI.w;
      if (massI < 0.01) massI = 1.0;

      vec3 force = vec3(0.0);

      ${useBonds ? `vec4 bondTex = texture2D(${bondsName}, uv);` : ''}

      ${bondForceGLSL}

      for (int y = 0; y < RES; y++) {
        for (int x = 0; x < RES; x++) {
          vec2 uvJ = (vec2(float(x), float(y)) + 0.5) / resolution.xy;
          if (abs(uvJ.x - uv.x) < 0.5/RES_F && abs(uvJ.y - uv.y) < 0.5/RES_F) continue;

          ${useBonds ? `if (isBondedTo(bondTex.rg, bondTex.ba, uvJ)) continue;` : ''}

          vec4 posJ = texture2D(${posName}, uvJ);
          vec4 velJ = texture2D(${velName}, uvJ);
          int speciesJ = int(posJ.w + 0.5);

          vec3 diff = posI.xyz - posJ.xyz;
          ${usePBC ? `diff -= boxSize * floor(diff / boxSize + 0.5);` : ''}
          float r2 = dot(diff, diff);
          if (r2 < 1e-10) continue;

          ${forceBodies}
        }
      }

      vec3 vNew = velI.xyz + (force / massI) * dt;

      ${useThermo ? /* glsl */ `
      // Berendsen: v ← v · λ donde λ = sqrt(1 + (dt/τ)(T_target/T_current - 1))
      // Aproximamos T por partícula con equipartición 3D: <v²> = 3T/m
      if (thermoTau > 0.0 && targetTemp > 0.0) {
        float v2_target = 3.0 * targetTemp / massI;
        float v2_actual = dot(vNew, vNew);
        if (v2_actual > 1e-6) {
          float lambda = sqrt(max(0.0, 1.0 + (dt / thermoTau) * (v2_target / v2_actual - 1.0)));
          lambda = clamp(lambda, 0.5, 2.0);
          vNew *= lambda;
        }
      }
      ` : ''}

      if (speedCap > 0.0) {
        float sp = length(vNew);
        if (sp > speedCap) vNew *= speedCap / sp;
      }

      gl_FragColor = vec4(vNew, massI);
    }
  `;

  const uniforms: UniformMap = {
    dt: { value: 0.005 },
    speedCap: { value: opts.speedCap ?? 0 },
  };
  if (usePBC) uniforms.boxSize = { value: opts.boxSize! };
  if (useThermo) {
    uniforms.targetTemp = { value: 0 };
    uniforms.thermoTau  = { value: 0 };
  }
  if (useBonds) {
    uniforms[bondsName] = { value: null };  // engine lo setea tras crear la textura
    uniforms.bondD      = { value: opts.bonds!.D };
    uniforms.bondAlpha  = { value: opts.bonds!.alpha };
    uniforms.bondReq    = { value: opts.bonds!.rEq };
  }
  // Copiar uniforms de cada ley
  for (const f of opts.forces) {
    for (const k of Object.keys(f.uniforms)) uniforms[k] = f.uniforms[k];
  }

  return { fragmentShader, uniforms };
}

/**
 * Shader de posición (drift): x ← x + v·dt, con PBC wrap si corresponde.
 */
export function buildPairwiseDriftKernel(opts: Pick<PairwiseKernelOptions, 'boxSize' | 'positionTextureName' | 'velocityTextureName'>): ComputeKernel {
  const posName = opts.positionTextureName ?? 'texturePosition';
  const velName = opts.velocityTextureName ?? 'textureVelocity';
  const usePBC = opts.boxSize !== undefined;

  const fragmentShader = /* glsl */ `
    precision highp float;
    uniform float dt;
    ${usePBC ? `uniform float boxSize;` : ''}
    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      vec4 pos = texture2D(${posName}, uv);
      vec4 vel = texture2D(${velName}, uv);
      pos.xyz += vel.xyz * dt;
      ${usePBC ? `pos.xyz -= boxSize * floor(pos.xyz / boxSize + 0.5);` : ''}
      gl_FragColor = pos;
    }
  `;

  const uniforms: UniformMap = { dt: { value: 0.005 } };
  if (usePBC) uniforms.boxSize = { value: opts.boxSize! };
  return { fragmentShader, uniforms };
}

// ═══════════════════════════════════════════════════════════════
// Referencia CPU — para tests y bridge de multi-escala
// ═══════════════════════════════════════════════════════════════
//
// Reproduce en CPU la misma matemática que el shader. Se usa para:
//   · Validar que la suma pairwise cierra energía (tests).
//   · Dar un fallback en dispositivos sin WebGL 2.
//   · Alimentar el `bridge` que promedia estados atómicos para el
//     siguiente nivel de la escala (célula, tejido, etc.).
//
// No depende de Three.js ni de WebGL → testeable en node.
// ═══════════════════════════════════════════════════════════════

/** Layout idéntico a la textura GPU. N×(x,y,z,species) y N×(vx,vy,vz,mass). */
export interface PairwiseCpuState {
  pos: Float32Array;   // length 4N
  vel: Float32Array;   // length 4N
  N: number;
}

/** Firma genérica de una ley de fuerza en CPU. */
export type CpuForceLaw = (
  /** Diferencia r_i - r_j (ya con PBC aplicado). */
  dx: number, dy: number, dz: number,
  /** |r|² */
  r2: number,
  speciesI: number, speciesJ: number,
  posI: Float32Array, iI: number,     // offset en `pos` (i*4)
  posJ: Float32Array, iJ: number,
  velI: Float32Array, velJ: Float32Array,
) => [fx: number, fy: number, fz: number];

/**
 * LJ 12-6 con Lorentz-Berthelot — la misma mezcla que `LJ_FORCE` en GPU.
 * Uniforms como closure; devuelve una `CpuForceLaw`.
 */
export function ljCpu(params: {
  sigma: number[]; epsilon: number[]; epsilonScale?: number; cutoffFactor?: number;
}): CpuForceLaw {
  const scale = params.epsilonScale ?? 1;
  const cutF  = params.cutoffFactor ?? 2.5;
  return (dx, dy, dz, r2, sI, sJ) => {
    const sigI = params.sigma[sI] ?? 1;
    const sigJ = params.sigma[sJ] ?? 1;
    const epsI = params.epsilon[sI] ?? 1;
    const epsJ = params.epsilon[sJ] ?? 1;
    const sigma = 0.5 * (sigI + sigJ);
    const eps = Math.sqrt(epsI * epsJ) * scale;
    const rCut = cutF * sigma;
    if (r2 > rCut*rCut || r2 < 0.01*sigma*sigma) return [0, 0, 0];
    const s2 = sigma*sigma;
    const ir2 = 1 / r2;
    const sr2 = s2 * ir2;
    const sr6 = sr2*sr2*sr2;
    const sr12 = sr6*sr6;
    let F = 24 * eps * (2*sr12 - sr6) * ir2;
    if (F > 1e4) F = 1e4; else if (F < -1e4) F = -1e4;
    return [F*dx, F*dy, F*dz];
  };
}

export function gravityCpu(params: { G: number; eps?: number }): CpuForceLaw {
  const soft = (params.eps ?? 0.02) ** 2;
  return (dx, dy, dz, r2, _sI, _sJ, _posI, _iI, _posJ, _iJ, _velI, velJ) => {
    const iJ = 0;  // velJ is sliced — mass at index 3
    const mJ = velJ[iJ + 3];
    const r2s = r2 + soft;
    const invR = 1 / Math.sqrt(r2s);
    const invR3 = invR * invR * invR;
    const Fmag = -params.G * mJ * invR3;
    return [Fmag*dx, Fmag*dy, Fmag*dz];
  };
}

/**
 * Lista de enlaces CPU — misma semántica que la textura GPU.
 * Para cada partícula i (0..N-1), guarda hasta 2 índices de partners
 * (o -1 si no hay). Tamaño: 2N enteros.
 */
export type BondList = Int32Array;

/** Parámetros Morse para enlaces. */
export interface BondParams {
  D: number; alpha: number; rEq: number;
}

/** Fuerza Morse entre un par enlazado (misma matemática que el shader). */
function morseBondForce(
  diff: [number, number, number],
  r2: number,
  params: BondParams,
): [number, number, number] {
  const r = Math.sqrt(r2);
  if (r < 1e-6) return [0, 0, 0];
  const x = -params.alpha * (r - params.rEq);
  const e = Math.exp(x);
  let F = 2 * params.D * params.alpha * (e*e - e) / r;
  if (F > 1e4) F = 1e4; else if (F < -1e4) F = -1e4;
  return [F*diff[0], F*diff[1], F*diff[2]];
}

/** Energía Morse acumulada (para conservación en tests). */
export function bondPotentialCpu(
  state: PairwiseCpuState,
  bonds: BondList,
  params: BondParams,
  boxSize?: number,
): number {
  const { pos, N } = state;
  let U = 0;
  const seen = new Set<string>();
  for (let i = 0; i < N; i++) {
    for (let p = 0; p < 2; p++) {
      const j = bonds[i*2 + p];
      if (j < 0) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let dx = pos[i*4  ] - pos[j*4  ];
      let dy = pos[i*4+1] - pos[j*4+1];
      let dz = pos[i*4+2] - pos[j*4+2];
      if (boxSize !== undefined) {
        dx -= boxSize * Math.floor(dx / boxSize + 0.5);
        dy -= boxSize * Math.floor(dy / boxSize + 0.5);
        dz -= boxSize * Math.floor(dz / boxSize + 0.5);
      }
      const r = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const x = 1 - Math.exp(-params.alpha * (r - params.rEq));
      U += params.D * x * x;
    }
  }
  return U;
}

/** Paso CPU completo (Velocity-Verlet simplificado: kick-drift por simetría). */
export function pairwiseStepCpu(
  state: PairwiseCpuState,
  laws: CpuForceLaw[],
  dt: number,
  boxSize?: number,
  /** Si se proveen, se usa Morse entre bonded + SKIP-bonded en el loop N². */
  bonds?: { list: BondList; params: BondParams },
): void {
  const { pos, vel, N } = state;
  const forces = new Float32Array(N * 3);

  // Helper: chequear si i está enlazado a j (≤ 2 partners)
  const isBonded = bonds
    ? (i: number, j: number) => bonds.list[i*2] === j || bonds.list[i*2 + 1] === j
    : null;

  for (let i = 0; i < N; i++) {
    const ix = i*4, iv = i*4;
    const speciesI = pos[ix+3] | 0;
    let fx = 0, fy = 0, fz = 0;

    // Bond forces (Morse) — aplican SOLO entre partners de i
    if (bonds) {
      for (let p = 0; p < 2; p++) {
        const j = bonds.list[i*2 + p];
        if (j < 0) continue;
        const jx = j*4;
        let dx = pos[ix] - pos[jx];
        let dy = pos[ix+1] - pos[jx+1];
        let dz = pos[ix+2] - pos[jx+2];
        if (boxSize !== undefined) {
          dx -= boxSize * Math.floor(dx / boxSize + 0.5);
          dy -= boxSize * Math.floor(dy / boxSize + 0.5);
          dz -= boxSize * Math.floor(dz / boxSize + 0.5);
        }
        const r2 = dx*dx + dy*dy + dz*dz;
        if (r2 < 1e-10) continue;
        const [Fx, Fy, Fz] = morseBondForce([dx, dy, dz], r2, bonds.params);
        fx += Fx; fy += Fy; fz += Fz;
      }
    }

    // Non-bond N²: LJ/Coulomb/grav. Si hay bond-list, skip bonded pairs.
    const velISlice = vel.subarray(iv, iv + 4);
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      if (isBonded && isBonded(i, j)) continue;
      const jx = j*4, jv = j*4;
      const speciesJ = pos[jx+3] | 0;
      let dx = pos[ix] - pos[jx];
      let dy = pos[ix+1] - pos[jx+1];
      let dz = pos[ix+2] - pos[jx+2];
      if (boxSize !== undefined) {
        dx -= boxSize * Math.floor(dx / boxSize + 0.5);
        dy -= boxSize * Math.floor(dy / boxSize + 0.5);
        dz -= boxSize * Math.floor(dz / boxSize + 0.5);
      }
      const r2 = dx*dx + dy*dy + dz*dz;
      if (r2 < 1e-10) continue;
      const velJSlice = vel.subarray(jv, jv + 4);
      for (const law of laws) {
        const [Fx, Fy, Fz] = law(dx, dy, dz, r2, speciesI, speciesJ, pos, ix, pos, jx, velISlice, velJSlice);
        fx += Fx; fy += Fy; fz += Fz;
      }
    }
    forces[i*3  ] = fx;
    forces[i*3+1] = fy;
    forces[i*3+2] = fz;
  }

  // Kick + drift
  for (let i = 0; i < N; i++) {
    const ix = i*4, iv = i*4;
    const massI = vel[iv+3] || 1;
    vel[iv  ] += forces[i*3  ] / massI * dt;
    vel[iv+1] += forces[i*3+1] / massI * dt;
    vel[iv+2] += forces[i*3+2] / massI * dt;
    pos[ix  ] += vel[iv  ] * dt;
    pos[ix+1] += vel[iv+1] * dt;
    pos[ix+2] += vel[iv+2] * dt;
    if (boxSize !== undefined) {
      pos[ix  ] -= boxSize * Math.floor(pos[ix  ] / boxSize + 0.5);
      pos[ix+1] -= boxSize * Math.floor(pos[ix+1] / boxSize + 0.5);
      pos[ix+2] -= boxSize * Math.floor(pos[ix+2] / boxSize + 0.5);
    }
  }
}

/** Energía cinética total. <T> · 2 / (3N) = temperatura reducida. */
export function kineticEnergyCpu(state: PairwiseCpuState): number {
  const { vel, N } = state;
  let ke = 0;
  for (let i = 0; i < N; i++) {
    const v = i*4;
    const v2 = vel[v]*vel[v] + vel[v+1]*vel[v+1] + vel[v+2]*vel[v+2];
    const m = vel[v+3] || 1;
    ke += 0.5 * m * v2;
  }
  return ke;
}

/** Energía potencial total por LJ (para conservación E en tests). */
export function ljPotentialCpu(
  state: PairwiseCpuState,
  params: { sigma: number[]; epsilon: number[]; epsilonScale?: number; cutoffFactor?: number },
  boxSize?: number,
): number {
  const { pos, N } = state;
  const scale = params.epsilonScale ?? 1;
  const cutF = params.cutoffFactor ?? 2.5;
  let U = 0;
  for (let i = 0; i < N; i++) {
    const ix = i*4;
    const sI = pos[ix+3] | 0;
    for (let j = i + 1; j < N; j++) {
      const jx = j*4;
      const sJ = pos[jx+3] | 0;
      let dx = pos[ix  ] - pos[jx  ];
      let dy = pos[ix+1] - pos[jx+1];
      let dz = pos[ix+2] - pos[jx+2];
      if (boxSize !== undefined) {
        dx -= boxSize * Math.floor(dx / boxSize + 0.5);
        dy -= boxSize * Math.floor(dy / boxSize + 0.5);
        dz -= boxSize * Math.floor(dz / boxSize + 0.5);
      }
      const r2 = dx*dx + dy*dy + dz*dz;
      const sigma = 0.5 * ((params.sigma[sI] ?? 1) + (params.sigma[sJ] ?? 1));
      const eps = Math.sqrt((params.epsilon[sI] ?? 1) * (params.epsilon[sJ] ?? 1)) * scale;
      const rCut = cutF * sigma;
      if (r2 > rCut*rCut || r2 < 1e-10) continue;
      const sr2 = (sigma*sigma) / r2;
      const sr6 = sr2*sr2*sr2;
      const sr12 = sr6*sr6;
      U += 4 * eps * (sr12 - sr6);
    }
  }
  return U;
}
