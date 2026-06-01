/**
 * useCineTime — reloj compartido de una escena cinematográfica.
 *
 * El CineStage publica un `timeRef` (segundos desde que arrancó la escena,
 * sincronizado al audio si lo hay, o al clock si no) vía contexto DENTRO del
 * Canvas. Los primitivos (CineCamera, CineText, CineModel) lo leen en useFrame.
 *
 * Nota R3F: el contexto se provee y se consume DENTRO del <Canvas> (el
 * reconciler de R3F no hereda contexto de afuera, pero sí dentro de su árbol).
 */

import { createContext, useContext, type MutableRefObject } from 'react';

export const CineTimeContext = createContext<MutableRefObject<number> | null>(null);

export function useCineTime(): MutableRefObject<number> {
  const ref = useContext(CineTimeContext);
  if (!ref) throw new Error('useCineTime() debe usarse dentro de <CineStage>');
  return ref;
}

// Layout: el hub embebe el CineStage (caja 16:9); la página de clase lo pone a
// pantalla completa. Se provee FUERA del Canvas (controla el div contenedor).
export const CineLayoutContext = createContext<{ fill: boolean }>({ fill: false });
export function useCineLayout() {
  return useContext(CineLayoutContext);
}

// Easings compartidos por todos los primitivos.
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
