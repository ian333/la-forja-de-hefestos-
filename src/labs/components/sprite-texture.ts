/**
 * Textura compartida de partícula con kernel gaussiano radial.
 *
 * Convierte los puntos cuadrados default de THREE.PointsMaterial en
 * blobs suaves con halo. Un solo canvas generado una sola vez y
 * reusado en todos los visualizadores (MoleculeOrbitalView,
 * MultiElectronAtomView, AtomView). Barato en memoria, alto en impacto
 * visual.
 */

import * as THREE from 'three';

let cached: THREE.Texture | null = null;

/**
 * Devuelve una textura 128×128 con gradiente radial blanco semi-gaussiano.
 * Para usar en additive blending: el color viene del vertex, la textura
 * define la forma y el falloff.
 */
export function getParticleTexture(): THREE.Texture {
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context no disponible');

  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  // Kernel cuasi-gaussiano: núcleo muy brillante, halo que se desvanece
  grad.addColorStop(0.00, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.12, 'rgba(255,255,255,0.88)');
  grad.addColorStop(0.30, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.16)');
  grad.addColorStop(0.80, 'rgba(255,255,255,0.04)');
  grad.addColorStop(1.00, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  cached = new THREE.CanvasTexture(canvas);
  cached.minFilter = THREE.LinearFilter;
  cached.magFilter = THREE.LinearFilter;
  cached.needsUpdate = true;
  return cached;
}
