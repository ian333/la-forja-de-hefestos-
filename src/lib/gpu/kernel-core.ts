/**
 * ══════════════════════════════════════════════════════════════════════
 *  gpu/kernel-core — Primitivas y engine para cómputo en GPU
 * ══════════════════════════════════════════════════════════════════════
 *
 * La forja necesita muchas simulaciones físicas, y muchas se reducen a
 * los mismos 4 patrones de cómputo:
 *
 *   1. Pairwise O(N²) — cada partícula lee todas las demás y suma fuerzas.
 *      → LJ, Coulomb, gravitación, Morse, Hooke, dipolo-dipolo.
 *
 *   2. Stencil local — cada celda lee sus vecinos inmediatos.
 *      → calor, onda, Schrödinger (finite-diff), reacción-difusión (Turing,
 *        Gray-Scott), FitzHugh-Nagumo (neuronas), Navier-Stokes incomprensible.
 *
 *   3. Integrador — drift/kick/Verlet/RK4. Estado → estado'.
 *
 *   4. Reducción — suma/max de toda una textura. Observables (T, E, M, <|ψ|²>).
 *
 * Este archivo da las primitivas comunes: layout de texturas, builders
 * de GLSL reutilizables, engine que envuelve `GPUComputationRenderer`
 * con una API más ergonómica, y utilidades de readback.
 *
 * Filosofía: el *kernel* es solo un string GLSL + uniforms. Las capas
 * superiores (`pairwise.ts`, `stencil.ts`) construyen estos strings a
 * partir de plantillas inyectando la física específica como un snippet.
 *
 * Texturas RGBA32F: 4 floats por texel. Interpretación es responsabilidad
 * de cada kernel — p.ej. en MD `pos.xyz + speciesId` o en RD `u,v,0,0`.
 *
 * Ref:
 *   · Three.js `examples/jsm/misc/GPUComputationRenderer`.
 *   · Harris 2005, "Mapping Computational Concepts to GPUs", GPU Gems 2 §31.
 *   · Nguyen (ed.), GPU Gems 3, 2007 — particle systems on GPU.
 */

import * as THREE from 'three';
import {
  GPUComputationRenderer,
  type Variable,
} from 'three/examples/jsm/misc/GPUComputationRenderer.js';

// ═══════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════

/**
 * Forma de un grid de cómputo. Para partículas, `width*height = N`.
 * Para campos 2D, es (nx, ny). Para campos 3D aplanados, la capa `stencil`
 * expone `stencil3d` que factoriza `(nx, ny*nz)` con wrap en slices.
 */
export interface GridShape {
  readonly width: number;
  readonly height: number;
}

export function gridN(g: GridShape): number {
  return g.width * g.height;
}

/** Valores aceptados como uniforms de fragment shader. */
export type UniformValue =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | number[]
  | THREE.Vector2
  | THREE.Vector3
  | THREE.Vector4
  | THREE.Texture
  | THREE.Matrix3
  | THREE.Matrix4
  | null;

export interface UniformMap {
  [name: string]: { value: UniformValue };
}

/**
 * Kernel de cómputo: fragment shader + uniforms + declaración de a qué
 * variables de la textura accede. El engine se encarga del ping-pong.
 */
export interface ComputeKernel {
  /** Fragment shader completo (debe escribir a `gl_FragColor`). */
  fragmentShader: string;
  /** Uniforms a setar al compilar el shader. */
  uniforms: UniformMap;
}

/**
 * Descripción de una "variable" del sistema: una textura RGBA32F que evoluciona
 * paso a paso según un kernel.
 */
export interface VariableSpec {
  /** Nombre usado como `uniform sampler2D <name>` en otros shaders. */
  name: string;
  /** Datos iniciales (length = width*height*4). */
  initial: Float32Array;
  /** Kernel que computa su nuevo valor. */
  kernel: ComputeKernel;
  /** Lista de otras variables cuya textura debe inyectarse como uniform. */
  dependsOn?: readonly string[];
}

// ═══════════════════════════════════════════════════════════════
// GLSL — primitivas reutilizables (strings puras, testables)
// ═══════════════════════════════════════════════════════════════

/**
 * Builders de snippets GLSL. Son strings puras, se componen libremente
 * en las plantillas de `pairwise.ts` y `stencil.ts`.
 */
export const GLSL = {
  /** UV del fragment actual (∈ [0,1)²). */
  selfUV: /* glsl */ `gl_FragCoord.xy / resolution.xy`,

  /** UV del texel (ix, iy) dado el lado del grid `RES`. */
  texelUV: (ix: string, iy: string, RES: number) =>
    /* glsl */ `(vec2(float(${ix}), float(${iy})) + 0.5) / vec2(${RES.toFixed(1)}, ${RES.toFixed(1)})`,

  /**
   * Minimum-image: `diff = r_i - r_j`, wrap a [-L/2, +L/2]³.
   * Aplica caja cúbica periódica (Allen & Tildesley §1.5).
   */
  pbcWrap: (diffVar: string, boxSizeUniform: string) =>
    /* glsl */ `${diffVar} -= ${boxSizeUniform} * floor(${diffVar} / ${boxSizeUniform} + 0.5);`,

  /**
   * Laplaciano 5-point en 2D con frontera periódica, para un campo
   * escalar guardado en componente `.x` de la textura.
   *
   *   ∇²u ≈ (u(i-1,j) + u(i+1,j) + u(i,j-1) + u(i,j+1) - 4u(i,j)) / dx²
   */
  lap5 (texName: string, component: 'x' | 'y' | 'z' | 'w' = 'x') {
    return /* glsl */ `
    float lap5_${component}(vec2 uv, vec2 invRes) {
      float c  = texture2D(${texName}, uv).${component};
      float l  = texture2D(${texName}, uv - vec2(invRes.x, 0.0)).${component};
      float r  = texture2D(${texName}, uv + vec2(invRes.x, 0.0)).${component};
      float d  = texture2D(${texName}, uv - vec2(0.0, invRes.y)).${component};
      float u  = texture2D(${texName}, uv + vec2(0.0, invRes.y)).${component};
      return l + r + d + u - 4.0 * c;
    }`;
  },

  /**
   * Laplaciano 9-point isotrópico (Patra & Karttunen 2006) — error
   * de orden superior en direcciones diagonales. Útil para RD cuando
   * importa que los patrones no sigan la red.
   */
  lap9 (texName: string, component: 'x' | 'y' | 'z' | 'w' = 'x') {
    return /* glsl */ `
    float lap9_${component}(vec2 uv, vec2 invRes) {
      float c  = texture2D(${texName}, uv).${component};
      float l  = texture2D(${texName}, uv + vec2(-invRes.x, 0.0)).${component};
      float r  = texture2D(${texName}, uv + vec2( invRes.x, 0.0)).${component};
      float d  = texture2D(${texName}, uv + vec2(0.0, -invRes.y)).${component};
      float u  = texture2D(${texName}, uv + vec2(0.0,  invRes.y)).${component};
      float ld = texture2D(${texName}, uv + vec2(-invRes.x, -invRes.y)).${component};
      float lu = texture2D(${texName}, uv + vec2(-invRes.x,  invRes.y)).${component};
      float rd = texture2D(${texName}, uv + vec2( invRes.x, -invRes.y)).${component};
      float ru = texture2D(${texName}, uv + vec2( invRes.x,  invRes.y)).${component};
      // 9-point iso: 4·(ortho) + 1·(diag) + center — pesos (1/6, 4/6, -20/6)
      // Aquí damos la forma normalizada estándar:
      return (4.0*(l+r+d+u) + (ld+lu+rd+ru) - 20.0*c) / 6.0;
    }`;
  },

  /**
   * Preamble común: declara resolution y la variable UV actual.
   * Todo kernel debería empezar con esto.
   */
  header: /* glsl */ `
    // kernel-core header
    // `,
} as const;

// ═══════════════════════════════════════════════════════════════
// ENGINE — wrapper sobre GPUComputationRenderer
// ═══════════════════════════════════════════════════════════════

/**
 * Compute engine de la forja. Una instancia = un conjunto de variables
 * que evolucionan acopladas. Un solo `renderer` puede tener muchos engines
 * (p.ej. uno para el MD y otro para el campo térmico que promedia).
 */
export class ForgeCompute {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly shape: GridShape;
  private readonly gpc: GPUComputationRenderer;
  private readonly vars = new Map<string, Variable>();
  private readonly specs = new Map<string, VariableSpec>();
  private initialized = false;
  /** Buffer reutilizable para readback. */
  private readonly readBuf: Float32Array;

  public readonly N: number;

  constructor(renderer: THREE.WebGLRenderer, shape: GridShape) {
    if (shape.width !== shape.height) {
      // GPUComputationRenderer acepta rectangular, pero mantener cuadrado
      // simplifica la escritura de kernels que indexan i ∈ [0, RES).
      // Si aparece un caso necesario, quitar esta restricción.
      throw new Error(`ForgeCompute: shape debe ser cuadrada (${shape.width}×${shape.height})`);
    }
    this.renderer = renderer;
    this.shape = shape;
    this.N = shape.width * shape.height;
    this.gpc = new GPUComputationRenderer(shape.width, shape.height, renderer);
    this.readBuf = new Float32Array(this.N * 4);
  }

  /**
   * Registra una variable. Debe llamarse antes de `init()`.
   * La textura inicial se crea a partir de `spec.initial`.
   */
  addVariable(spec: VariableSpec): void {
    if (this.initialized) throw new Error('ForgeCompute: addVariable tras init()');
    const tex = this.gpc.createTexture();
    const data = tex.image.data as Float32Array;
    if (spec.initial.length !== data.length) {
      throw new Error(
        `ForgeCompute: initial length ${spec.initial.length} != ${data.length} para "${spec.name}"`,
      );
    }
    data.set(spec.initial);
    tex.needsUpdate = true;

    const variable = this.gpc.addVariable(spec.name, spec.kernel.fragmentShader, tex);
    // Copiar uniforms
    for (const k of Object.keys(spec.kernel.uniforms)) {
      variable.material.uniforms[k] = spec.kernel.uniforms[k];
    }
    this.vars.set(spec.name, variable);
    this.specs.set(spec.name, spec);
  }

  /**
   * Finaliza la configuración: setea dependencias y compila shaders.
   * Retorna un error si la compilación GLSL falla.
   */
  init(): void {
    if (this.initialized) return;
    // Setear dependencias
    for (const [name, spec] of this.specs.entries()) {
      const variable = this.vars.get(name)!;
      const deps = (spec.dependsOn ?? [])
        .map(d => {
          const v = this.vars.get(d);
          if (!v) throw new Error(`ForgeCompute: dependencia "${d}" no registrada (de "${name}")`);
          return v;
        });
      // Siempre incluir la propia variable (para leer estado anterior)
      if (!deps.includes(variable)) deps.push(variable);
      this.gpc.setVariableDependencies(variable, deps);
    }
    const err = this.gpc.init();
    if (err !== null) throw new Error(`ForgeCompute.init: ${err}`);
    this.initialized = true;
  }

  /** Un step de cómputo: ejecuta todos los kernels una vez. */
  step(): void {
    if (!this.initialized) throw new Error('ForgeCompute: step() antes de init()');
    this.gpc.compute();
  }

  /** Textura actual de la variable (para renderizar o pasar a otro engine). */
  texture(name: string): THREE.Texture {
    const v = this.vars.get(name);
    if (!v) throw new Error(`ForgeCompute: variable "${name}" no existe`);
    return this.gpc.getCurrentRenderTarget(v).texture;
  }

  /**
   * Update de uniform en vivo. Si el valor es `THREE.Vector*`, se muta
   * in-place; si es escalar, se asigna al `.value` del uniform.
   */
  setUniform(variableName: string, uniformName: string, value: UniformValue): void {
    const v = this.vars.get(variableName);
    if (!v) throw new Error(`ForgeCompute: variable "${variableName}" no existe`);
    const u = v.material.uniforms[uniformName];
    if (!u) throw new Error(`ForgeCompute: uniform "${uniformName}" no declarado en "${variableName}"`);
    u.value = value;
  }

  /**
   * Lee la textura de vuelta a CPU. Cuidado: esto es sync y fuerza un
   * GPU→CPU flush (~1-5 ms). No llamar cada frame.
   *
   * El Float32Array devuelto es reutilizable — una copia interna.
   */
  readback(name: string): Float32Array {
    const v = this.vars.get(name);
    if (!v) throw new Error(`ForgeCompute: variable "${name}" no existe`);
    const target = this.gpc.getCurrentRenderTarget(v) as THREE.WebGLRenderTarget;
    this.renderer.readRenderTargetPixels(target, 0, 0, this.shape.width, this.shape.height, this.readBuf);
    return this.readBuf;
  }

  /**
   * Reducción CPU-side tras readback. Para observables globales
   * (temperatura, energía total, magnetización, ∫|ψ|²dx).
   *
   * Si necesitas reducción puramente GPU (texturas grandes, readback caro),
   * usar `gpuReduce()` en otro archivo — para la mayoría de los módulos
   * de la forja (N ≤ 16K) esto basta.
   */
  reduce<T>(name: string, initial: T, fold: (acc: T, r: number, g: number, b: number, a: number, i: number) => T): T {
    const data = this.readback(name);
    let acc = initial;
    for (let i = 0; i < this.N; i++) {
      acc = fold(acc, data[i * 4 + 0], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3], i);
    }
    return acc;
  }

  dispose(): void {
    this.gpc.dispose();
    this.vars.clear();
    this.specs.clear();
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Box-Muller para seeding Maxwell-Boltzmann (para integradores que
 * necesitan velocidad inicial térmica).
 */
export function gaussianN01(): number {
  const u1 = Math.max(1e-12, Math.random());
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
