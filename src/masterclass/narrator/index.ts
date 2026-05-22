/**
 * Registry de configs de NarratorOverlay.
 *
 *  Las masterclasses bajo el paradigma "BH cinema" NO usan callouts —
 *  la imagen sola + la narración bastan. Este registry queda vacío por
 *  ahora; el componente sigue disponible si en el futuro alguna lección
 *  específica lo necesita.
 */

import type { NarratorConfig } from './types';

export const NARRATOR_REGISTRY: Record<string, NarratorConfig> = {};

export { default as NarratorOverlay } from './NarratorOverlay';
export type { Callout, NarratorConfig, SceneNarratorConfig } from './types';
