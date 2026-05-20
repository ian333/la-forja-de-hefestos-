/**
 * _BaseShape — wrapper canónico para cualquier geometría extruida/procedural
 * de la masterclass library. Aplica el "atom-style": edges nítidas + relleno
 * emisivo + halo opcional. Una sola fuente de verdad para que todos los
 * shapes (Lemon, Apple, Cherry, Bill, …) compartan look & feel.
 *
 * Cuatro modes:
 *   solid     — meshStandardMaterial con emissive bajo (cuando el objeto
 *               debe leerse como volumen sólido pero todavía glowy)
 *   wireframe — wireframe puro sobre la geometría (más denso que edges)
 *   edges     — solo EdgesGeometry, sin fill (el silhouette mínimo)
 *   atom      — DEFAULT canon: edges + fill emisivo translúcido + halo sprite
 *               (matchea el quality bar establecido por Tsuru/Motor)
 *
 * El "halo" en modo atom es un sprite circular detrás del objeto que da el
 * resplandor difuso que el bloom convierte en bloom-bleed. Sin él, el bloom
 * solo encuentra los edges y se ve fino/débil.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export type ShapeMode = 'solid' | 'wireframe' | 'edges' | 'atom';

export interface BaseShapeProps {
  /** Geometría ya construida por el componente hijo (Lemon, Apple, etc). */
  geometry: THREE.BufferGeometry;
  /** Color del objeto. Aplica a fill, edges, halo. Default amarillo cálido. */
  color?: string;
  /** Multiplicador global de brillo (edges opacity, emissive intensity, halo). */
  glow?: number;
  /** Render mode. Default 'atom' (canon style). */
  mode?: ShapeMode;
  /** Escala uniforme (number) o por eje (tuple). */
  scale?: number | [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Umbral en grados para EdgesGeometry. Más bajo = más líneas. Default 18. */
  edgeThreshold?: number;
  /** Si false, omite el halo sprite incluso en atom mode. Default true. */
  halo?: boolean;
  /** Tamaño del halo relativo al bounding box. Default 1.8. */
  haloSize?: number;
}

// ─────────────────────────────────────────────────────────────
// Halo sprite — círculo radial generado en canvas, soft falloff.
// Cacheado por color para no regenerar canvas en cada mount.

const haloTextureCache = new Map<string, THREE.CanvasTexture>();

function getHaloTexture(color: string): THREE.CanvasTexture {
  const cached = haloTextureCache.get(color);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, color);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  haloTextureCache.set(color, tex);
  return tex;
}

// ─────────────────────────────────────────────────────────────

export default function BaseShape({
  geometry,
  color = '#FDB813',
  glow = 1.0,
  mode = 'atom',
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  edgeThreshold = 18,
  halo = true,
  haloSize = 1.8,
}: BaseShapeProps) {
  // EdgesGeometry derivada — re-computa solo si geometry o threshold cambian.
  const edges = useMemo(
    () => new THREE.EdgesGeometry(geometry, edgeThreshold),
    [geometry, edgeThreshold],
  );

  // Bounding sphere para escalar el halo. Cache en ref para evitar re-cálculo.
  const halaRadiusRef = useRef<number>(1);
  useMemo(() => {
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    halaRadiusRef.current = geometry.boundingSphere?.radius ?? 1;
  }, [geometry]);

  const haloTex = useMemo(() => (halo && mode === 'atom' ? getHaloTexture(color) : null), [color, halo, mode]);

  const scaleArr: [number, number, number] =
    typeof scale === 'number' ? [scale, scale, scale] : scale;

  return (
    <group position={position} rotation={rotation} scale={scaleArr}>
      {/* SOLID — meshStandardMaterial sólido con emissive bajo */}
      {mode === 'solid' && (
        <mesh geometry={geometry}>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.25 * glow}
            roughness={0.45}
            metalness={0.35}
          />
        </mesh>
      )}

      {/* WIREFRAME — meshBasicMaterial wireframe puro */}
      {mode === 'wireframe' && (
        <mesh geometry={geometry}>
          <meshBasicMaterial color={color} wireframe transparent opacity={0.85 * glow} toneMapped={false} />
        </mesh>
      )}

      {/* EDGES — solo silhouette */}
      {mode === 'edges' && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={color} transparent opacity={0.92 * glow} toneMapped={false} />
        </lineSegments>
      )}

      {/* ATOM — canon: fill emisivo + edges + halo */}
      {mode === 'atom' && (
        <>
          {/* Halo sprite — detrás del objeto, da el bleed para bloom */}
          {haloTex && (
            <sprite scale={[halaRadiusRef.current * haloSize, halaRadiusRef.current * haloSize, 1]}>
              <spriteMaterial
                map={haloTex}
                color={color}
                transparent
                opacity={0.45 * glow}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </sprite>
          )}

          {/* Fill emisivo translúcido — da volumen sin tapar edges */}
          <mesh geometry={geometry}>
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.55 * glow}
              roughness={0.5}
              metalness={0.30}
              transparent
              opacity={0.22}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* Edges nítidas encima — el silhouette icónico */}
          <lineSegments geometry={edges}>
            <lineBasicMaterial
              color={color}
              transparent
              opacity={0.95 * glow}
              toneMapped={false}
            />
          </lineSegments>
        </>
      )}
    </group>
  );
}
