/**
 * Render Clock — sistema de tiempo determinista para captura frame-perfect.
 *
 * Problema: el modo Player normal usa wall-clock (audio MP3 + clock R3F),
 * que en captura real-time depende del FPS del browser. En WSL2 con WebGL
 * software (swiftshader), eso es ~12fps real → video con duplicación visible
 * cuando se intenta 60fps en ffmpeg.
 *
 * Solución: en modo `?render=1&deterministic=1`:
 *   - Playwright llama `window.renderAt(t)` por cada frame que quiere
 *   - El Player setea el `idx` correspondiente a ese `t` global
 *   - Las escenas R3F leen `useRenderClock()` y derivan TODA animación
 *     de ese `t` global (no de `clock.elapsedTime` ni `performance.now()`)
 *   - Playwright captura screenshot inmediatamente después
 *   - Cada frame es exacto sin importar la velocidad del browser
 *
 * Convivencia: en modo normal (sin `deterministic=1`), `useRenderClock()`
 * devuelve `{ isDeterministic: false }` y las escenas pueden seguir usando
 * `useFrame(({ clock }))` como siempre. El refactor es opt-in por escena.
 *
 * Pattern probado por marketing/gaia-reveal/ — referencia.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface RenderClockState {
  /** Si true, las escenas deben derivar animación de `t` (no de wall-clock). */
  isDeterministic: boolean;
  /** Tiempo global del video en segundos (acumulado desde frame 0). */
  t: number;
  /** Tiempo dentro de la escena actual (resetea cuando cambia `idx`). */
  tInScene: number;
  /** Índice de la escena actual. */
  sceneIdx: number;
}

const DEFAULT_STATE: RenderClockState = {
  isDeterministic: false,
  t: 0,
  tInScene: 0,
  sceneIdx: 0,
};

export const RenderClockContext = createContext<RenderClockState>(DEFAULT_STATE);

/**
 * Hook para leer el estado del clock determinista.
 *
 * Uso típico en una escena R3F:
 *
 *   ```tsx
 *   function MyAnimatedThing() {
 *     const { isDeterministic, tInScene } = useRenderClock();
 *     const meshRef = useRef<THREE.Mesh>(null);
 *     useFrame(({ clock }) => {
 *       if (!meshRef.current) return;
 *       // Si estamos en render determinista, usar tInScene; si no, clock real.
 *       const t = isDeterministic ? tInScene : clock.elapsedTime;
 *       meshRef.current.position.y = Math.sin(t) * 0.5;
 *     });
 *     return <mesh ref={meshRef}><boxGeometry/><meshBasicMaterial/></mesh>;
 *   }
 *   ```
 *
 * Para reemplazar `performance.now() / 1000` en `useEffect` con interval:
 *
 *   ```tsx
 *   function MyTimedThing() {
 *     const { isDeterministic, tInScene } = useRenderClock();
 *     const [phase, setPhase] = useState(0);
 *
 *     // Modo determinista: deriva phase de tInScene directamente
 *     if (isDeterministic) {
 *       const computedPhase = Math.floor(tInScene / 0.5);
 *       // ... usa computedPhase ...
 *       return <Thing phase={computedPhase} />;
 *     }
 *
 *     // Modo normal: comportamiento original con setInterval
 *     useEffect(() => {
 *       const id = setInterval(() => setPhase(p => p + 1), 500);
 *       return () => clearInterval(id);
 *     }, []);
 *     return <Thing phase={phase} />;
 *   }
 *   ```
 */
export function useRenderClock(): RenderClockState {
  return useContext(RenderClockContext);
}

/**
 * Hook usado por el Player para gestionar el estado del clock y exponerlo
 * a Playwright vía `window.renderAt(t)`.
 *
 * Retorna:
 *   - `state` para pasar al Provider
 *   - `setT(t)` para que el Player avance manualmente si necesita
 */
export function useRenderClockController(opts: {
  enabled: boolean;
  sceneDurations: number[];   // duración acumulada en segundos por escena
  onSceneChange?: (idx: number) => void;
}) {
  const { enabled, sceneDurations, onSceneChange } = opts;
  const [t, setT] = useState(0);

  // Calcular en qué escena estamos para un `t` dado.
  const sceneIdxForT = useCallback((globalT: number) => {
    let acc = 0;
    for (let i = 0; i < sceneDurations.length; i++) {
      acc += sceneDurations[i];
      if (globalT < acc) return { idx: i, tInScene: globalT - (acc - sceneDurations[i]) };
    }
    return {
      idx: sceneDurations.length - 1,
      tInScene: sceneDurations[sceneDurations.length - 1] || 0,
    };
  }, [sceneDurations]);

  const { idx: sceneIdx, tInScene } = sceneIdxForT(t);

  // Expose `window.renderAt(t)` para Playwright cuando enabled.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    (window as any).renderAt = (newT: number) => {
      setT(newT);
    };
    (window as any).__renderClockReady = true;
    return () => {
      delete (window as any).renderAt;
      delete (window as any).__renderClockReady;
    };
  }, [enabled]);

  // Notificar cambios de escena al Player (para mute audio, etc.)
  useEffect(() => {
    if (enabled && onSceneChange) onSceneChange(sceneIdx);
  }, [sceneIdx, enabled, onSceneChange]);

  const state: RenderClockState = {
    isDeterministic: enabled,
    t,
    tInScene,
    sceneIdx,
  };

  return { state, setT };
}
