/**
 * cine/ — el estándar cinematográfico de las masterclass GAIA.
 *
 * Basado en Gargantua + Limones. Toda masterclass se arma con estos bloques,
 * para que TODAS se sientan igual de inmersivas y aplastantes:
 *
 *   <CineStage mood="urban_night" duration={42} chapter="Krugman · 2008">
 *     <CineCamera keys={[...]} />
 *     <CineModel src="/models/library/buildings/factory.glb" at={1} ... />
 *     <CineText text="..." at={4} hold={5} position={[0,6,-6]} />
 *   </CineStage>
 *
 * Ver docs/masterclass-estandar.md para la guía de autoría.
 */

export { default as CineStage } from './CineStage';
export type { CineStageProps } from './CineStage';
export { default as CineCamera } from './CineCamera';
export type { CineCamKey } from './CineCamera';
export { default as CineText } from './CineText';
export { default as CineModel } from './CineModel';
export { useCineTime } from './useCineTime';
