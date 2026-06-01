/**
 * Registro de laboratorios interactivos por premio Nobel.
 *
 * Cada entrada mapea el `id` del catálogo a un componente lazy. El hub
 * `/premio.html?id=<id>` (PremioPage) lo monta en la sección "Juega". El
 * portal (EconomiaPortal) usa `hasLab` para marcar qué cards ya son jugables.
 *
 * Mantener esto en sync con `premio-content.ts`: un premio puede tener
 * contenido (paper, taquero) sin lab todavía, o lab sin contenido. El hub
 * renderiza con gracia lo que exista.
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export const PREMIO_LABS: Record<string, LazyExoticComponent<ComponentType<unknown>>> = {
  'econ-1969-frisch-tinbergen': lazy(() => import('./CaballitoFrisch')),
  'econ-1970-samuelson': lazy(() => import('./SamuelsonTazon')),
  'econ-1971-kuznets': lazy(() => import('./KuznetsPIB')),
  'econ-2005-aumann-schelling': lazy(() => import('./SchellingCiudad')),
};

export function hasLab(id: string): boolean {
  return id in PREMIO_LABS;
}
