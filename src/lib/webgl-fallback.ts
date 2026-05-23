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

    let ctx: WebGL2RenderingContext | null = null;
    let version = 'none';
    let attemptDetail = '';

    // Three.js r163+ requiere WebGL2 estrictamente. Intentamos varios sets
    // de attributes — algunas combinaciones (típicamente powerPreference)
    // pueden hacer fallar getContext con ciertos drivers/browsers.
    const attempts: Array<[string, WebGLContextAttributes]> = [
      ['full',          ctxAttrs],
      ['no-power',      { ...ctxAttrs, powerPreference: 'default' }],
      ['low-power',     { ...ctxAttrs, powerPreference: 'low-power' }],
      ['minimal',       { failIfMajorPerformanceCaveat: false }],
      ['no-attrs',      {}],
    ];

    for (const [name, attrs] of attempts) {
      try {
        const candidate = canvas.getContext('webgl2', attrs) as WebGL2RenderingContext | null;
        if (candidate) {
          ctx = candidate;
          version = 'webgl2';
          attemptDetail = name;
          break;
        }
      } catch (_) { /* sigue */ }
    }

    // Si WebGL2 falló todo, probamos WebGL1 para diagnóstico — Three.js lo
    // rechazará pero al menos sabemos que ESA GPU sí da WebGL1.
    let webgl1Available = false;
    if (!ctx) {
      try {
        const w1 = canvas.getContext('webgl');
        if (w1) webgl1Available = true;
      } catch (_) { /* ignore */ }
    }

    // Reportar una vez por sesión qué versión usamos
    if (version !== reportedVersion) {
      reportedVersion = version;
      try {
        const tele = (window as { telemetry?: { event: (t: string, d: object) => void } }).telemetry;
        tele?.event('renderer_init', {
          version, attempt: attemptDetail, webgl1_available: webgl1Available,
        });
      } catch (_) { /* ignore */ }
    }

    if (!ctx) {
      // Pintamos un mensaje claro encima del canvas para que el usuario sepa
      // exactamente qué pasa (no se queda en negro silencioso).
      try {
        // Detectar Brave (la causa más común de WebGL2 bloqueado: Shields)
        const nav = navigator as Navigator & { brave?: { isBrave: () => Promise<boolean> } };
        const isBrave = !!nav.brave?.isBrave || /Brave/i.test(navigator.userAgent);

        let msg: string;
        if (webgl1Available && isBrave) {
          msg = 'Brave Shields está bloqueando WebGL2.\n\n' +
            '1. Click el león 🦁 en la barra de URL\n' +
            '2. Desactiva Shields para este sitio\n' +
            '3. Recarga la página\n\n' +
            'Alternativa: brave://settings/shields → Block fingerprinting → Disabled';
        } else if (webgl1Available) {
          msg = 'Tu browser solo da WebGL1. Three.js requiere WebGL2.\n' +
            'Habilita aceleración de hardware en settings y verifica chrome://gpu.';
        } else {
          msg = 'Tu browser no soporta WebGL. Verifica chrome://gpu y la aceleración de hardware.';
        }

        const wrap = canvas.parentElement;
        if (wrap && !wrap.querySelector('.webgl-error-overlay')) {
          const div = document.createElement('div');
          div.className = 'webgl-error-overlay';
          div.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fbbf24;background:#0a0e1a;text-align:center;padding:32px;font-family:ui-monospace,monospace;font-size:14px;line-height:1.7;white-space:pre-line;z-index:100';
          div.textContent = msg;
          wrap.appendChild(div);
        }

        // Reportar a telemetría con detalle del browser
        const tele = (window as { telemetry?: { event: (t: string, d: object) => void } }).telemetry;
        tele?.event('webgl2_blocked', {
          is_brave: isBrave,
          webgl1_available: webgl1Available,
          ua: navigator.userAgent,
        });
      } catch (_) { /* ignore */ }
      throw new Error(`webgl-fallback: WebGL2 unavailable (webgl1=${webgl1Available})`);
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
