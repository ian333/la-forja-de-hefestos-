/**
 * webgl-fallback — utilidad para R3F Canvas que intenta WebGL2 primero
 * y cae a WebGL1 si el browser no lo da.
 *
 * Por qué existe: Three.js r163+ por default pide WebGL2 y NO hace fallback.
 * Si el browser/driver no entrega contexto WebGL2 (visto en algunos Chromes
 * con D3D11 ANGLE), Three.js lanza "Error creating WebGL context" y R3F
 * dispara unhandled rejection — Canvas queda en 300x150 y NO renderiza nada.
 *
 * Solución: pasamos a R3F una factory `gl` que toma el canvas, intenta
 * obtener contexto en orden (webgl2 → webgl → experimental-webgl) con los
 * attributes deseados, y construye WebGLRenderer con el context que sí logró.
 *
 * Reporta a telemetría qué versión consiguió, útil para debug.
 *
 * Uso:
 *   <Canvas gl={makeRenderer({ antialias: false, alpha: false })}>
 */

import * as THREE from 'three';

export interface GLAttrs {
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: WebGLPowerPreference;
  preserveDrawingBuffer?: boolean;
  premultipliedAlpha?: boolean;
  depth?: boolean;
  stencil?: boolean;
}

let reportedVersion: string | null = null;

interface R3FGLDefaults {
  canvas: HTMLCanvasElement | OffscreenCanvas;
}

export function makeRenderer(attrs: GLAttrs = {}) {
  return (defaults: R3FGLDefaults) => {
    const canvas = defaults.canvas as HTMLCanvasElement;
    const ctxAttrs: WebGLContextAttributes = {
      antialias: attrs.antialias ?? false,
      alpha: attrs.alpha ?? true,
      powerPreference: attrs.powerPreference ?? 'high-performance',
      preserveDrawingBuffer: attrs.preserveDrawingBuffer ?? false,
      premultipliedAlpha: attrs.premultipliedAlpha ?? true,
      depth: attrs.depth ?? true,
      stencil: attrs.stencil ?? false,
      failIfMajorPerformanceCaveat: false,
    };

    let ctx: WebGL2RenderingContext | WebGLRenderingContext | null = null;
    let version = 'none';

    // WebGL2 primero
    try {
      ctx = canvas.getContext('webgl2', ctxAttrs);
      if (ctx) version = 'webgl2';
    } catch (_) { /* sigue */ }

    // Fallback WebGL1
    if (!ctx) {
      try {
        ctx = canvas.getContext('webgl', ctxAttrs);
        if (ctx) version = 'webgl';
      } catch (_) { /* sigue */ }
    }

    // Last resort
    if (!ctx) {
      try {
        ctx = canvas.getContext('experimental-webgl', ctxAttrs) as WebGLRenderingContext;
        if (ctx) version = 'experimental-webgl';
      } catch (_) { /* sigue */ }
    }

    // Reportar una vez por sesión qué versión usamos
    if (version !== reportedVersion) {
      reportedVersion = version;
      try {
        const tele = (window as { telemetry?: { event: (t: string, d: object) => void } }).telemetry;
        tele?.event('renderer_init', { version, attrs: ctxAttrs });
      } catch (_) { /* ignore */ }
    }

    if (!ctx) {
      // Sin contexto — Three.js lanzará el mismo error pero al menos
      // intentamos. R3F maneja el throw con su error boundary.
      throw new Error('webgl-fallback: no WebGL/WebGL2/experimental-webgl context');
    }

    return new THREE.WebGLRenderer({
      canvas,
      context: ctx,
      antialias: ctxAttrs.antialias,
      alpha: ctxAttrs.alpha,
      powerPreference: ctxAttrs.powerPreference,
      premultipliedAlpha: ctxAttrs.premultipliedAlpha,
      preserveDrawingBuffer: ctxAttrs.preserveDrawingBuffer,
      depth: ctxAttrs.depth,
      stencil: ctxAttrs.stencil,
    });
  };
}
