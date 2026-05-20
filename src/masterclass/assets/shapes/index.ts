/**
 * Masterclass shape library — barrel export.
 *
 * Estos componentes son perfiles extruidos / lathes hechos a mano con
 * THREE.js puro, sin assets externos. Todos comparten la API de _BaseShape:
 *
 *   <Lemon scale={1.2} glow={1.5} color="#FDB813" mode="atom" />
 *
 * `mode` toggles entre 'solid' | 'wireframe' | 'edges' | 'atom' (default).
 *
 * Cuando un shape no alcanza (e.g. modelo complejo: riñón anatómico, motor
 * detallado), recurrir a AtomModel + GLB en ../gltf/.
 */

export { default as BaseShape } from './_BaseShape';
export type { BaseShapeProps, ShapeMode } from './_BaseShape';

export { default as Lemon } from './Lemon';
export { default as Apple } from './Apple';
export { default as Cherry } from './Cherry';
export { default as Bill } from './Bill';
export { default as Coin } from './Coin';
