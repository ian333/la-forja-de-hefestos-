/**
 * Operador 𝔄 — API pública.
 *
 * Uso típico (definir modos físicos):
 *
 *   import { caraBessel, caraI_Theta, caraI_Z, modo, alfvenOmega, kPerpBessel,
 *            evalModoDominante, actualizarModosEnTiempo } from '@/operador';
 *
 *   const R = 1.4, L = 110, vA = 0.42;
 *   const modos = [
 *     modo({
 *       amp: 0.75,
 *       R:     caraBessel({ m: 1, k: kPerpBessel(1, 1, R), R_max: 15 }),
 *       Theta: caraI_Theta({ m: 1 }),
 *       Z:     caraI_Z({ kZ: 0.08, omega: alfvenOmega(vA, 0.08, kPerpBessel(1, 1, R)), LENGTH: L }),
 *     }),
 *     // ... otros 5 modos
 *   ];
 *
 *   // En useFrame:
 *   actualizarModosEnTiempo(modos, time);
 *   const { idx, abs } = evalModoDominante(modos, r, theta, z);
 *
 * Patrón: identificar las simetrías que conmutan → elegir cara por canal
 * (Bessel para r con frontera, i_θ para azimut, i_z para axial+temporal)
 * → componer en producto tensor → evaluar en O(1).
 *
 * Documentación matemática: papers/operador_ian/lab/PROCESO_CARAS.md
 */

export {
  // Caras concretas
  caraBessel,
  caraI_Theta,
  caraI_Z,

  // Composición
  modo,
  evalCampo,
  evalModoDominante,
  actualizarModosEnTiempo,

  // Helpers físicos
  alfvenOmega,
  kPerpBessel,
  J_ZEROS,

  // Auditoría
  auditarParseval,
} from './caras';

export type { Cara, CaraTemporal, Modo } from './caras';
