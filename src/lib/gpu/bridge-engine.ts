/**
 * ══════════════════════════════════════════════════════════════════════
 *  gpu/bridge-engine — Runtime del puente átomo → campo continuo
 * ══════════════════════════════════════════════════════════════════════
 *
 * No usa `GPUComputationRenderer` porque el bridge es one-shot (no
 * ping-pong): cada paso lee las texturas atómicas actuales y ESCRIBE
 * dos render-targets (fluido, térmico). Más barato y más sencillo.
 *
 * Salida:
 *   fluidTarget   — RGBA32F (RES × RES²): ρ, ρu_x, ρu_y, ρu_z
 *   thermalTarget — RGBA32F (RES × RES²): T, c₀, c₁, c₂
 *
 * Donde RES = blobsPerSide. El grid 3D se aplana a 2D (bx en X, by+RES·bz en Y).
 *
 * Consumo downstream:
 *   · Un renderer 3D puede leer fluidTarget.texture para pintar voxels.
 *   · El siguiente nivel de la escalera (stencil.ts) usa estas texturas
 *     como estado inicial. El puente cierra la escalera.
 */

import * as THREE from 'three';
import { buildBridgeKernel, FLUID_AGG, THERMAL_AGG, SPECIES_AGG, type Aggregator } from './bridge';

export interface BridgeEngineConfig {
  /** Átomos por lado de textura (AxA total atoms). */
  atomsPerSide: number;
  /** Blobs por lado del grid 3D (B³ blobs total). */
  blobsPerSide: number;
  /** Caja cúbica del sistema atómico (también el dominio del blob). */
  boxSize: number;
  /** Si `true`, calcula T en la pass térmica (default true). */
  computeTemperature?: boolean;
  /** Si `true`, calcula species counts (default true). */
  computeSpecies?: boolean;
  /** PBC al emparejar átomo ↔ blob (default true). */
  periodic?: boolean;
}

export class BridgeEngine {
  private renderer: THREE.WebGLRenderer;
  private config: BridgeEngineConfig;

  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private quad: THREE.Mesh;

  /** Fluid: (ρ, ρu_x, ρu_y, ρu_z). */
  private fluidMaterial: THREE.ShaderMaterial;
  private fluidTargetA: THREE.WebGLRenderTarget;

  /** Thermal: (T en .x — 0 si computeTemperature=false). */
  private thermalMaterial: THREE.ShaderMaterial | null = null;
  private thermalTargetA: THREE.WebGLRenderTarget | null = null;

  /** Species counts: (c₀, c₁, c₂, c₃). */
  private speciesMaterial: THREE.ShaderMaterial | null = null;
  private speciesTargetA: THREE.WebGLRenderTarget | null = null;

  /** Buffer reutilizable para readback. */
  private readBuf: Float32Array;

  constructor(renderer: THREE.WebGLRenderer, config: BridgeEngineConfig) {
    this.renderer = renderer;
    this.config = { ...config };
    const B = config.blobsPerSide;
    const outWidth = B;
    const outHeight = B * B;
    this.readBuf = new Float32Array(outWidth * outHeight * 4);

    // Fullscreen quad + cámara ortográfica. Reutilizable para cualquier kernel.
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.scene.add(this.quad);

    // Render target options: RGBA32F, nearest, clamp
    const rtOpts = {
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      stencilBuffer: false,
      depthBuffer: false,
    };

    // ─── Fluid kernel ──────────────────────────────────────────
    const fluidKernel = buildBridgeKernel({
      atomsPerSide: config.atomsPerSide,
      blobsPerSide: config.blobsPerSide,
      boxSize: config.boxSize,
      aggregator: FLUID_AGG,
      periodic: config.periodic ?? true,
    });
    this.fluidMaterial = this.makeMaterial(fluidKernel, outWidth, outHeight);
    this.fluidTargetA = new THREE.WebGLRenderTarget(outWidth, outHeight, rtOpts);

    // ─── Thermal kernel (pass 2, necesita fluidTexture) ────────
    if (config.computeTemperature ?? true) {
      const thermalKernel = buildBridgeKernel({
        atomsPerSide: config.atomsPerSide,
        blobsPerSide: config.blobsPerSide,
        boxSize: config.boxSize,
        aggregator: THERMAL_AGG,
        periodic: config.periodic ?? true,
      });
      this.thermalMaterial = this.makeMaterial(thermalKernel, outWidth, outHeight);
      this.thermalTargetA  = new THREE.WebGLRenderTarget(outWidth, outHeight, rtOpts);
    }

    // ─── Species kernel ────────────────────────────────────────
    if (config.computeSpecies ?? true) {
      const speciesKernel = buildBridgeKernel({
        atomsPerSide: config.atomsPerSide,
        blobsPerSide: config.blobsPerSide,
        boxSize: config.boxSize,
        aggregator: SPECIES_AGG,
        periodic: config.periodic ?? true,
      });
      this.speciesMaterial = this.makeMaterial(speciesKernel, outWidth, outHeight);
      this.speciesTargetA  = new THREE.WebGLRenderTarget(outWidth, outHeight, rtOpts);
    }
  }

  private makeMaterial(
    kernel: { fragmentShader: string; uniforms: Record<string, { value: unknown }> },
    outWidth: number, outHeight: number,
  ): THREE.ShaderMaterial {
    // Inyecta `resolution` uniform como espera el shader (convención de ForgeCompute)
    const uniforms: Record<string, { value: unknown }> = {
      resolution: { value: new THREE.Vector2(outWidth, outHeight) },
      texturePosition: { value: null },
      textureVelocity: { value: null },
      ...kernel.uniforms,
    };
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        void main() { gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: kernel.fragmentShader,
      glslVersion: null,  // GLSL 1.0
    });
  }

  // ─── API pública ─────────────────────────────────────────────

  /**
   * Avanza el bridge un paso: lee pos/vel atómicos y escribe los campos.
   */
  compute(positionTexture: THREE.Texture, velocityTexture: THREE.Texture): void {
    const prev = this.renderer.getRenderTarget();

    // Pass 1: fluid
    this.fluidMaterial.uniforms.texturePosition.value = positionTexture;
    this.fluidMaterial.uniforms.textureVelocity.value = velocityTexture;
    this.quad.material = this.fluidMaterial;
    this.renderer.setRenderTarget(this.fluidTargetA);
    this.renderer.render(this.scene, this.camera);

    // Pass 2: thermal (si activo)
    if (this.thermalMaterial && this.thermalTargetA) {
      this.thermalMaterial.uniforms.texturePosition.value = positionTexture;
      this.thermalMaterial.uniforms.textureVelocity.value = velocityTexture;
      this.thermalMaterial.uniforms.textureFluid.value = this.fluidTargetA.texture;
      this.quad.material = this.thermalMaterial;
      this.renderer.setRenderTarget(this.thermalTargetA);
      this.renderer.render(this.scene, this.camera);
    }

    // Pass species (si activo)
    if (this.speciesMaterial && this.speciesTargetA) {
      this.speciesMaterial.uniforms.texturePosition.value = positionTexture;
      this.speciesMaterial.uniforms.textureVelocity.value = velocityTexture;
      this.quad.material = this.speciesMaterial;
      this.renderer.setRenderTarget(this.speciesTargetA);
      this.renderer.render(this.scene, this.camera);
    }

    this.renderer.setRenderTarget(prev);
  }

  // ─── Texturas accesibles para shaders de render ──────────────

  get fluidTexture(): THREE.Texture {
    return this.fluidTargetA.texture;
  }
  get thermalTexture(): THREE.Texture | null {
    return this.thermalTargetA?.texture ?? null;
  }
  get speciesTexture(): THREE.Texture | null {
    return this.speciesTargetA?.texture ?? null;
  }

  get blobsPerSide(): number { return this.config.blobsPerSide; }
  get boxSize(): number      { return this.config.boxSize; }

  // ─── Readback a CPU (para UI/stats) ──────────────────────────

  /** Devuelve (ρ, ρu_x, ρu_y, ρu_z) aplanado. Sync ~1-3 ms. */
  readFluid(): Float32Array {
    const B = this.config.blobsPerSide;
    this.renderer.readRenderTargetPixels(this.fluidTargetA, 0, 0, B, B * B, this.readBuf);
    return this.readBuf;
  }

  /**
   * Lee la textura térmica (T en .x). Sync ~1-3 ms.
   * Retorna el MISMO buffer que readFluid — si llamas ambos, copia antes
   * del segundo.
   */
  readThermal(): Float32Array | null {
    if (!this.thermalTargetA) return null;
    const B = this.config.blobsPerSide;
    this.renderer.readRenderTargetPixels(this.thermalTargetA, 0, 0, B, B * B, this.readBuf);
    return this.readBuf;
  }

  /**
   * Extrae una sub-rebanada Z del campo fluid/thermal como array 2D RES×RES.
   * `which` selecciona qué cargar primero; la segunda llamada aplasta la
   * primera (mismo buffer). Usar solo una a la vez o copiar.
   */
  readZSlice(which: 'fluid' | 'thermal', z: number, component = 0): Float32Array {
    const B = this.config.blobsPerSide;
    const data = which === 'fluid' ? this.readFluid() : this.readThermal();
    if (!data) throw new Error('thermal target deshabilitado');
    const slice = new Float32Array(B * B);
    for (let j = 0; j < B; j++) {
      for (let i = 0; i < B; i++) {
        const idx = i + B * (j + B * z);
        slice[j * B + i] = data[idx * 4 + component];
      }
    }
    return slice;
  }

  /** Max/min/mean de ρ — útil para calibrar la visualización. */
  densityStats(): { min: number; max: number; mean: number } {
    const data = this.readFluid();
    const N = this.config.blobsPerSide ** 3;
    let mn = Infinity, mx = -Infinity, sum = 0;
    for (let i = 0; i < N; i++) {
      const r = data[i * 4];
      if (r < mn) mn = r;
      if (r > mx) mx = r;
      sum += r;
    }
    return { min: mn, max: mx, mean: sum / N };
  }

  dispose(): void {
    this.fluidMaterial.dispose();
    this.fluidTargetA.dispose();
    this.thermalMaterial?.dispose();
    this.thermalTargetA?.dispose();
    this.speciesMaterial?.dispose();
    this.speciesTargetA?.dispose();
    this.quad.geometry.dispose();
  }
}
