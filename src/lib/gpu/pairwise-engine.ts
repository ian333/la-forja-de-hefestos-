/**
 * ══════════════════════════════════════════════════════════════════════
 *  gpu/pairwise-engine — Runtime wrapper de Verlet pairwise sobre GPU
 * ══════════════════════════════════════════════════════════════════════
 *
 * Une `kernel-core.ForgeCompute` + `pairwise.buildPairwise*Kernel` en
 * un engine listo para usar: seed Maxwell-Boltzmann, step, estadísticas,
 * update de uniforms en vivo. Es la herramienta que los módulos de la
 * forja llaman cuando necesitan "N partículas en 3D con fuerza pairwise".
 *
 * Misma semántica que el viejo `chem/quantum/gpu-md` pero desacoplado:
 * la física específica (LJ, grav, Coulomb, Morse, combinaciones) se
 * inyecta como `ForceLaw[]`. El engine no sabe qué está integrando —
 * solo sabe que hay posiciones, velocidades, y un kick-drift.
 *
 * Textura de posición: vec4(x, y, z, speciesId)
 * Textura de velocidad: vec4(vx, vy, vz, mass)
 *
 * Esto habilita la escala-ladder:
 *   · Nivel 0 átomos: LJ+Coulomb, 1K-16K partículas.
 *   · Nivel 1 moléculas: Morse + LJ, bond-list (extensión).
 *   · Nivel 2 polímeros/membranas: LJ + harmonic, red de restricciones.
 *   · Nivel 3 células (reacción-difusión): pasa por `stencil.ts`, no aquí.
 */

import * as THREE from 'three';
import { ForgeCompute, gaussianN01 } from './kernel-core';
import {
  buildPairwiseVelocityKernel,
  buildPairwiseDriftKernel,
  type ForceLaw,
  type PairwiseKernelOptions,
} from './pairwise';

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════

export interface SpeciesDef {
  /** Masa de la especie. */
  mass: number;
  /** Fracción inicial (suman 1 para todas las especies). */
  fraction: number;
}

export interface PairwiseEngineConfig {
  /** Raíz cuadrada de N. Debe ser potencia de 2 para GPU eficiente. */
  resolution: 16 | 32 | 48 | 64 | 96 | 128;
  /** Arista de la caja cúbica periódica (unidades del sim). */
  boxSize: number;
  /** Paso de integración. */
  dt: number;
  /** Temperatura inicial para seed Maxwell-Boltzmann. */
  initialTemperature: number;
  /** Hasta 4 especies (más requiere extender shaders). */
  species: SpeciesDef[];
  /** Leyes de fuerza — se suman todas pairwise. */
  forces: ForceLaw[];
  /** Termostato Berendsen. tau=0 ⇒ NVE; tau>0 y targetTemp>0 ⇒ NVT. */
  thermostat?: { targetTemp: number; tau: number };
  /** Speed cap numérico. Default 50 en unidades del sim. */
  speedCap?: number;
  /**
   * Red de enlaces — eleva la simulación a nivel de moléculas.
   * Para cada partícula i, hasta 2 índices de partners (Int32Array, -1 = vacío).
   * Parámetros Morse compartidos por todos los enlaces.
   *
   * Override de posiciones: si se pasa un seed, el engine lo usa (para colocar
   * átomos enlazados cerca de r_eq desde el inicio).
   */
  bonds?: {
    /** length = 2·N. 2 partners max por átomo (extensible a 4 con 2 texturas). */
    partners: Int32Array;
    /** Parámetros Morse. */
    D: number;
    alpha: number;
    rEq: number;
  };
  /** Override opcional del seed de posiciones (útil para colocar moléculas). */
  positionSeed?: (posData: Float32Array, N: number, boxSize: number) => void;
}

export interface PairwiseStats {
  /** Temperatura reducida (2/3·KE/N en unidades ε/k_B). */
  temperature: number;
  /** Energía cinética total. */
  kineticEnergy: number;
  /** Velocidad media. */
  meanSpeed: number;
  /** Velocidad máxima. */
  maxSpeed: number;
  /** Nº de partículas por especie. */
  speciesCounts: number[];
  /** Partículas totales. */
  N: number;
}

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class PairwiseEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private config: PairwiseEngineConfig;
  private compute: ForgeCompute;
  public steps = 0;

  constructor(renderer: THREE.WebGLRenderer, config: PairwiseEngineConfig) {
    this.renderer = renderer;
    this.config = { ...config };
    this.compute = this.build();
  }

  // ─── Inicialización ──────────────────────────────────────────

  private build(): ForgeCompute {
    const res = this.config.resolution;
    const shape = { width: res, height: res };
    const N = res * res;

    const compute = new ForgeCompute(this.renderer, shape);

    // Seed textures
    const posInit = new Float32Array(N * 4);
    const velInit = new Float32Array(N * 4);
    this.seed(posInit, velInit);

    // Kernels
    const velKernel = buildPairwiseVelocityKernel({
      RES: res,
      forces: this.config.forces,
      boxSize: this.config.boxSize,
      speedCap: this.config.speedCap ?? 50,
      thermostat: this.config.thermostat ? 'berendsen' : 'off',
      bonds: this.config.bonds
        ? { D: this.config.bonds.D, alpha: this.config.bonds.alpha, rEq: this.config.bonds.rEq }
        : undefined,
    });
    const posKernel = buildPairwiseDriftKernel({
      boxSize: this.config.boxSize,
    });

    compute.addVariable({
      name: 'texturePosition',
      initial: posInit,
      kernel: posKernel,
      dependsOn: ['textureVelocity'],
    });
    compute.addVariable({
      name: 'textureVelocity',
      initial: velInit,
      kernel: velKernel,
      dependsOn: ['texturePosition'],
    });

    // Setear uniforms dinámicos (los iniciales los pusieron los builders)
    compute.setUniform('texturePosition', 'dt', this.config.dt);
    compute.setUniform('textureVelocity', 'dt', this.config.dt);
    if (this.config.thermostat) {
      compute.setUniform('textureVelocity', 'targetTemp', this.config.thermostat.targetTemp);
      compute.setUniform('textureVelocity', 'thermoTau', this.config.thermostat.tau);
    }

    // Textura estática de bonds — cada texel guarda UVs de hasta 2 partners
    if (this.config.bonds) {
      const bondTex = this.makeBondTexture(this.config.bonds.partners);
      this.bondTexture = bondTex;
      compute.setUniform('textureVelocity', 'textureBonds', bondTex);
    }

    compute.init();
    return compute;
  }

  /** Textura RGBA32F (float) con UV de partners. Sentinel: -1 = no bond. */
  private bondTexture: THREE.DataTexture | null = null;
  private makeBondTexture(partners: Int32Array): THREE.DataTexture {
    const res = this.config.resolution;
    const N = res * res;
    if (partners.length !== 2 * N) {
      throw new Error(`PairwiseEngine: bonds.partners length ${partners.length} != ${2*N}`);
    }
    const data = new Float32Array(N * 4);
    const toUV = (idx: number) => {
      const x = idx % res;
      const y = Math.floor(idx / res);
      return [(x + 0.5) / res, (y + 0.5) / res] as const;
    };
    for (let i = 0; i < N; i++) {
      const p1 = partners[i * 2];
      const p2 = partners[i * 2 + 1];
      if (p1 >= 0) {
        const [u, v] = toUV(p1);
        data[i*4  ] = u; data[i*4+1] = v;
      } else {
        data[i*4] = -1; data[i*4+1] = -1;
      }
      if (p2 >= 0) {
        const [u, v] = toUV(p2);
        data[i*4+2] = u; data[i*4+3] = v;
      } else {
        data[i*4+2] = -1; data[i*4+3] = -1;
      }
    }
    const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  /** Rellena posiciones (grid + jitter) y velocidades MB. */
  private seed(posData: Float32Array, velData: Float32Array): void {
    const res = this.config.resolution;
    const N = res * res;
    const L = this.config.boxSize;
    const T0 = this.config.initialTemperature;

    // Asignación de especies determinística + shuffle
    const speciesIds = assignSpecies(N, this.config.species.map(s => s.fraction));

    // Posiciones: override si lo proveen, si no grid 3D por default
    if (this.config.positionSeed) {
      this.config.positionSeed(posData, N, L);
      // Aún así grabamos species en canal .w si el override no lo hizo
      for (let i = 0; i < N; i++) posData[i*4+3] = speciesIds[i];
    } else {
      const side = Math.ceil(Math.cbrt(N));
      const dx = L / side;
      const halfL = L / 2;
      for (let i = 0; i < N; i++) {
        const a = Math.floor(i / (side * side));
        const b = Math.floor((i / side) % side);
        const c = i % side;
        const jit = dx * 0.15;
        posData[i*4  ] = -halfL + (c + 0.5) * dx + (Math.random() - 0.5) * jit;
        posData[i*4+1] = -halfL + (b + 0.5) * dx + (Math.random() - 0.5) * jit;
        posData[i*4+2] = -halfL + (a + 0.5) * dx + (Math.random() - 0.5) * jit;
        posData[i*4+3] = speciesIds[i];
      }
    }

    // Velocidades Maxwell-Boltzmann
    let vxM = 0, vyM = 0, vzM = 0;
    for (let i = 0; i < N; i++) {
      const mass = this.config.species[speciesIds[i]]?.mass ?? 1;
      const sigmaV = Math.sqrt(T0 / mass);
      const vx = gaussianN01() * sigmaV;
      const vy = gaussianN01() * sigmaV;
      const vz = gaussianN01() * sigmaV;
      velData[i*4  ] = vx;
      velData[i*4+1] = vy;
      velData[i*4+2] = vz;
      velData[i*4+3] = mass;
      vxM += vx; vyM += vy; vzM += vz;
    }
    vxM /= N; vyM /= N; vzM /= N;
    for (let i = 0; i < N; i++) {
      velData[i*4  ] -= vxM;
      velData[i*4+1] -= vyM;
      velData[i*4+2] -= vzM;
    }
  }

  // ─── Step ────────────────────────────────────────────────────

  step(): void {
    this.compute.step();
    this.steps++;
  }

  // ─── Update en vivo ──────────────────────────────────────────

  setDt(dt: number): void {
    this.config.dt = dt;
    this.compute.setUniform('texturePosition', 'dt', dt);
    this.compute.setUniform('textureVelocity', 'dt', dt);
  }
  setTargetTemp(T: number): void {
    if (!this.config.thermostat) return;
    this.config.thermostat.targetTemp = T;
    this.compute.setUniform('textureVelocity', 'targetTemp', T);
  }
  setThermostatTau(tau: number): void {
    if (!this.config.thermostat) return;
    this.config.thermostat.tau = tau;
    this.compute.setUniform('textureVelocity', 'thermoTau', tau);
  }
  /** Actualiza uniform arbitrario en el velocity shader (leyes de fuerza). */
  setForceUniform(name: string, value: PairwiseKernelOptions extends infer _ ? THREE.Vector4 | number | number[] : never): void {
    this.compute.setUniform('textureVelocity', name, value as never);
  }

  // ─── Texturas públicas para renderer ─────────────────────────

  get positionTexture(): THREE.Texture {
    return this.compute.texture('texturePosition');
  }
  get velocityTexture(): THREE.Texture {
    return this.compute.texture('textureVelocity');
  }
  get N(): number {
    return this.compute.N;
  }
  get boxSize(): number {
    return this.config.boxSize;
  }

  // ─── Stats (readback) ────────────────────────────────────────

  /**
   * Lee velocidades a CPU y reduce. Sync GPU→CPU: ~1-3 ms. Llamar cada
   * ≥10 frames, no en cada step.
   */
  stats(): PairwiseStats {
    const velData = this.compute.readback('textureVelocity');
    const N = this.N;
    let ke = 0, sumSp = 0, maxSp = 0;
    for (let i = 0; i < N; i++) {
      const vx = velData[i*4], vy = velData[i*4+1], vz = velData[i*4+2];
      const m  = velData[i*4+3];
      const v2 = vx*vx + vy*vy + vz*vz;
      const sp = Math.sqrt(v2);
      ke += 0.5 * m * v2;
      sumSp += sp;
      if (sp > maxSp) maxSp = sp;
    }
    const posData = this.compute.readback('texturePosition');
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < N; i++) {
      const s = Math.round(posData[i*4+3]);
      if (s >= 0 && s < 4) counts[s]++;
    }
    return {
      temperature: (2 * ke) / (3 * N),
      kineticEnergy: ke,
      meanSpeed: sumSp / N,
      maxSpeed: maxSp,
      speciesCounts: counts,
      N,
    };
  }

  /** Reinicia completamente con posibles cambios de config. */
  reset(patch?: Partial<PairwiseEngineConfig>): void {
    if (patch) Object.assign(this.config, patch);
    this.compute.dispose();
    this.compute = this.build();
    this.steps = 0;
  }

  dispose(): void {
    this.compute.dispose();
    this.bondTexture?.dispose();
    this.bondTexture = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function assignSpecies(N: number, fractions: number[]): number[] {
  const out = new Array<number>(N);
  const counts = fractions.map((f, i) =>
    i === fractions.length - 1
      ? N - fractions.slice(0, -1).reduce((s, fr) => s + Math.round(fr * N), 0)
      : Math.round(f * N),
  );
  let k = 0;
  for (let s = 0; s < counts.length; s++) {
    for (let j = 0; j < counts[s]; j++) out[k++] = s;
  }
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
