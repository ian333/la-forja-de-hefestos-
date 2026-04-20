/**
 * ══════════════════════════════════════════════════════════════════════
 *  quantum/gpu-md — Motor de Dinámica Molecular masivo en GPU
 * ══════════════════════════════════════════════════════════════════════
 *
 * Mantiene el estado de miles-decenas de miles de partículas en texturas
 * RGBA32F y avanza la simulación con ping-pong de fragment shaders
 * (GPUComputationRenderer de Three.js).
 *
 * Configuración típica:
 *   res=64  → 4 096   partículas · ~3 ms/step · 60 fps cómodo
 *   res=96  → 9 216   partículas · ~10 ms/step · 60 fps justo
 *   res=128 → 16 384  partículas · ~20 ms/step · 30 fps OK
 *
 * Textura de posiciones: vec4(x, y, z, speciesId)
 * Textura de velocidades: vec4(vx, vy, vz, mass)
 *
 * Interfaz:
 *   const engine = new GPUMDEngine(renderer, config);
 *   engine.seed(...);     // colocar N partículas con dist Maxwell-Boltzmann
 *   engine.step();        // un paso de integración
 *   engine.stats();       // lee temperatura/energía de vuelta a CPU
 *   engine.positionTexture  // para pasar al renderer
 *
 * Ref: Allen & Tildesley §4 (Verlet + PBC), Berendsen 1984 (thermostat).
 */

import * as THREE from 'three';
import {
  GPUComputationRenderer,
  type Variable,
} from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import {
  POSITION_SHADER, VELOCITY_SHADER,
} from '@/labs/components/gpu-md-shaders';

// ═══════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════

export interface GPUSpeciesDef {
  /** Diámetro LJ (unidades reducidas σ=1 por default para A) */
  sigma: number;
  /** Profundidad del pozo LJ */
  epsilon: number;
  /** Masa */
  mass: number;
}

export interface GPUMDConfig {
  /** Raíz cuadrada del número de partículas. res² = N */
  resolution: number;
  /** Tamaño de la caja cúbica periódica */
  boxSize: number;
  /** Paso temporal (unidades reducidas) */
  dt: number;
  /** Temperatura inicial (unidades reducidas ε/k_B) */
  initialTemperature: number;
  /** Temperatura objetivo del termostato (0 = NVE, >0 = NVT) */
  targetTemperature: number;
  /** Tau del termostato Berendsen (0 = off) */
  thermostatTau: number;
  /** Escala global para intensidad de LJ (experimental) */
  epsilonScale: number;
  /** Definiciones de hasta 4 especies */
  species: GPUSpeciesDef[];
  /** Fracciones iniciales de cada especie (suman 1) */
  speciesFractions: number[];
}

export interface GPUMDStats {
  /** Temperatura instantánea (reducida) */
  temperature: number;
  /** Energía cinética total */
  kineticEnergy: number;
  /** Nº de partículas */
  N: number;
  /** Velocidad promedio */
  meanSpeed: number;
  /** Velocidad máxima */
  maxSpeed: number;
  /** Conteo por especie */
  speciesCounts: number[];
}

// ═══════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════

export class GPUMDEngine {
  private renderer: THREE.WebGLRenderer;
  private gpuCompute!: GPUComputationRenderer;
  private positionVariable!: Variable;
  private velocityVariable!: Variable;
  private config: GPUMDConfig;

  /** Buffer auxiliar para leer de vuelta posiciones a CPU (estadísticas) */
  private readBuf: Float32Array;

  /** Contador de steps ejecutados */
  public steps: number = 0;

  constructor(renderer: THREE.WebGLRenderer, config: GPUMDConfig) {
    this.renderer = renderer;
    this.config = { ...config };
    this.readBuf = new Float32Array(config.resolution * config.resolution * 4);
    this.initialize();
  }

  // ─── Inicialización ──────────────────────────────────────────

  private initialize(): void {
    const res = this.config.resolution;

    if (!this.renderer.capabilities.isWebGL2 && !this.renderer.extensions.get('OES_texture_float')) {
      console.warn('GPU MD: float textures no soportadas. La simulación puede fallar.');
    }

    this.gpuCompute = new GPUComputationRenderer(res, res, this.renderer);

    // Texturas iniciales
    const posTex = this.gpuCompute.createTexture();
    const velTex = this.gpuCompute.createTexture();
    this.seedTextures(posTex, velTex);

    // Variables compute con shaders
    this.positionVariable = this.gpuCompute.addVariable(
      'texturePosition',
      POSITION_SHADER(res),
      posTex,
    );
    this.velocityVariable = this.gpuCompute.addVariable(
      'textureVelocity',
      VELOCITY_SHADER(res),
      velTex,
    );

    // Dependencias — ambos shaders necesitan leer position y velocity
    this.gpuCompute.setVariableDependencies(this.positionVariable, [
      this.positionVariable, this.velocityVariable,
    ]);
    this.gpuCompute.setVariableDependencies(this.velocityVariable, [
      this.positionVariable, this.velocityVariable,
    ]);

    // Uniforms
    const posUni = this.positionVariable.material.uniforms;
    posUni.dt      = { value: this.config.dt };
    posUni.boxSize = { value: this.config.boxSize };

    const velUni = this.velocityVariable.material.uniforms;
    velUni.dt              = { value: this.config.dt };
    velUni.boxSize         = { value: this.config.boxSize };
    velUni.targetTemp      = { value: this.config.targetTemperature };
    velUni.thermoTau       = { value: this.config.thermostatTau };
    velUni.epsilonScale    = { value: this.config.epsilonScale };
    velUni.speciesSigma    = { value: this.makeSpeciesVec(s => s.sigma) };
    velUni.speciesEpsilon  = { value: this.makeSpeciesVec(s => s.epsilon) };
    velUni.speciesMass     = { value: this.makeSpeciesVec(s => s.mass) };

    const err = this.gpuCompute.init();
    if (err !== null) {
      throw new Error(`GPU MD init: ${err}`);
    }
  }

  /** Rellena posiciones (grid + jitter) y velocidades (Maxwell-Boltzmann). */
  private seedTextures(posTex: THREE.DataTexture, velTex: THREE.DataTexture): void {
    const res = this.config.resolution;
    const N = res * res;
    const posData = posTex.image.data as Float32Array;
    const velData = velTex.image.data as Float32Array;

    // Colocación en grid 3D con jitter
    const sideCount = Math.ceil(Math.cbrt(N));
    const spacing = this.config.boxSize / sideCount;
    const halfBox = this.config.boxSize / 2;

    // Determinar especie por partícula según fractions
    const speciesIds = this.assignSpecies(N);

    let vxMean = 0, vyMean = 0, vzMean = 0;

    for (let i = 0; i < N; i++) {
      const gi = Math.floor(i / (sideCount * sideCount));
      const gj = Math.floor((i / sideCount) % sideCount);
      const gk = i % sideCount;
      const jit = spacing * 0.15;
      const x = -halfBox + (gk + 0.5) * spacing + (Math.random() - 0.5) * jit;
      const y = -halfBox + (gj + 0.5) * spacing + (Math.random() - 0.5) * jit;
      const z = -halfBox + (gi + 0.5) * spacing + (Math.random() - 0.5) * jit;
      const species = speciesIds[i];

      posData[i * 4 + 0] = x;
      posData[i * 4 + 1] = y;
      posData[i * 4 + 2] = z;
      posData[i * 4 + 3] = species;

      // Velocidad Maxwell-Boltzmann: N(0, sqrt(kT/m)) por componente
      const mass = this.config.species[species]?.mass ?? 1.0;
      const sigmaV = Math.sqrt(this.config.initialTemperature / mass);
      const vx = gaussian() * sigmaV;
      const vy = gaussian() * sigmaV;
      const vz = gaussian() * sigmaV;
      velData[i * 4 + 0] = vx;
      velData[i * 4 + 1] = vy;
      velData[i * 4 + 2] = vz;
      velData[i * 4 + 3] = mass;
      vxMean += vx; vyMean += vy; vzMean += vz;
    }

    // Remover drift del centro de masa
    vxMean /= N; vyMean /= N; vzMean /= N;
    for (let i = 0; i < N; i++) {
      velData[i * 4 + 0] -= vxMean;
      velData[i * 4 + 1] -= vyMean;
      velData[i * 4 + 2] -= vzMean;
    }

    posTex.needsUpdate = true;
    velTex.needsUpdate = true;
  }

  private assignSpecies(N: number): number[] {
    const fractions = this.config.speciesFractions;
    const out: number[] = new Array(N);
    // Acumulador determinístico por fracción
    const counts: number[] = fractions.map((f, i) =>
      i === fractions.length - 1
        ? N - fractions.slice(0, -1).reduce((s, fr) => s + Math.round(fr * N), 0)
        : Math.round(f * N),
    );
    let idx = 0;
    for (let s = 0; s < counts.length; s++) {
      for (let k = 0; k < counts[s]; k++) {
        out[idx++] = s;
      }
    }
    // Shuffle Fisher-Yates para mezclar espacialmente
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  private makeSpeciesVec(pick: (s: GPUSpeciesDef) => number): THREE.Vector4 {
    const s = this.config.species;
    const def: GPUSpeciesDef = { sigma: 1, epsilon: 1, mass: 1 };
    return new THREE.Vector4(
      pick(s[0] ?? def),
      pick(s[1] ?? def),
      pick(s[2] ?? def),
      pick(s[3] ?? def),
    );
  }

  // ─── API pública ─────────────────────────────────────────────

  /** Avanza un paso de integración */
  public step(): void {
    this.gpuCompute.compute();
    this.steps++;
  }

  /** Textura con posiciones actuales (para pasar al renderer) */
  public get positionTexture(): THREE.Texture {
    return this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
  }

  public get velocityTexture(): THREE.Texture {
    return this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture;
  }

  public get N(): number {
    return this.config.resolution * this.config.resolution;
  }

  public get boxSize(): number {
    return this.config.boxSize;
  }

  /** Actualiza temperatura objetivo (NVT via Berendsen) */
  public setTargetTemperature(T: number): void {
    this.velocityVariable.material.uniforms.targetTemp.value = T;
    this.config.targetTemperature = T;
  }

  public setThermostatTau(tau: number): void {
    this.velocityVariable.material.uniforms.thermoTau.value = tau;
    this.config.thermostatTau = tau;
  }

  public setEpsilonScale(scale: number): void {
    this.velocityVariable.material.uniforms.epsilonScale.value = scale;
    this.config.epsilonScale = scale;
  }

  public setDt(dt: number): void {
    this.positionVariable.material.uniforms.dt.value = dt;
    this.velocityVariable.material.uniforms.dt.value = dt;
    this.config.dt = dt;
  }

  /** Reinicia posiciones y velocidades con nueva temperatura.
   *  Re-inicializa por completo el engine para garantizar estado limpio. */
  public reset(initialT?: number): void {
    if (initialT !== undefined) this.config.initialTemperature = initialT;
    this.gpuCompute.dispose();
    this.initialize();
    this.steps = 0;
  }

  /**
   * Lee velocidades de vuelta a CPU para cómputo de estadísticas.
   * Costo: sync GPU→CPU, ~1-5ms. Llamar cada N frames, no cada frame.
   */
  public stats(): GPUMDStats {
    const res = this.config.resolution;
    const target = this.gpuCompute.getCurrentRenderTarget(this.velocityVariable);
    this.renderer.readRenderTargetPixels(target, 0, 0, res, res, this.readBuf);

    const N = res * res;
    let ke = 0;
    let speedSum = 0;
    let speedMax = 0;
    for (let i = 0; i < N; i++) {
      const vx = this.readBuf[i * 4 + 0];
      const vy = this.readBuf[i * 4 + 1];
      const vz = this.readBuf[i * 4 + 2];
      const m  = this.readBuf[i * 4 + 3];
      const v2 = vx * vx + vy * vy + vz * vz;
      const sp = Math.sqrt(v2);
      ke += 0.5 * m * v2;
      speedSum += sp;
      if (sp > speedMax) speedMax = sp;
    }

    // Equipartición 3D: <KE> = (3/2)·N·k_B·T → T = (2/3) KE/N en unidades reducidas
    const temperature = (2 * ke) / (3 * N);

    // Species counts — leer textura de posiciones
    const posTarget = this.gpuCompute.getCurrentRenderTarget(this.positionVariable);
    this.renderer.readRenderTargetPixels(posTarget, 0, 0, res, res, this.readBuf);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < N; i++) {
      const s = Math.round(this.readBuf[i * 4 + 3]);
      if (s >= 0 && s < 4) counts[s]++;
    }

    return {
      temperature,
      kineticEnergy: ke,
      N,
      meanSpeed: speedSum / N,
      maxSpeed: speedMax,
      speciesCounts: counts,
    };
  }

  public dispose(): void {
    this.gpuCompute.dispose();
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/** Gaussiana N(0,1) por Box-Muller */
function gaussian(): number {
  const u1 = Math.max(1e-12, Math.random());
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
