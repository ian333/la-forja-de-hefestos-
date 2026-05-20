/**
 * AtomModel — wrapper para cargar cualquier .glb / .gltf y aplicar el
 * atom-style canónico de la masterclass library (edges + emissive + halo).
 *
 * Resuelve el problema de "la otra IA pierde el día modelando un limón":
 * descargas un GLB de Quaternius/Kenney, lo committeas en
 * /public/models/library/..., y lo usas igual que los shapes propios:
 *
 *   <AtomModel src="/models/library/food/lemon.glb"
 *              color="#FDB813" glow={1.5} mode="atom" scale={1.2} />
 *
 * Internamente:
 *   1. useGLTF carga el GLB (drei lo cachea).
 *   2. Clonamos la escena cargada (evita mutar el cache compartido).
 *   3. Por cada Mesh: aplicamos el material correspondiente al mode.
 *   4. En atom mode, agregamos overlay EdgesGeometry + sprite halo.
 *
 * IMPORTANTE: para que `useGLTF.preload` funcione, los GLBs deben servirse
 * estáticamente. Vite lo hace automáticamente para todo lo de /public/.
 */

import { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { ShapeMode } from '../shapes/_BaseShape';

export interface AtomModelProps {
  /** Ruta al .glb / .gltf. Servido desde /public/. */
  src: string;
  /** Tint global aplicado a todos los materiales. Default amarillo cálido. */
  color?: string;
  /** Multiplicador global de brillo. Default 1. */
  glow?: number;
  /** Render mode. Default 'atom'. */
  mode?: ShapeMode;
  /** Escala uniforme o por eje. */
  scale?: number | [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Umbral en grados para EdgesGeometry. Más bajo = más líneas. Default 22. */
  edgeThreshold?: number;
  /** Si false, omite halo sprite en atom mode. Default true. */
  halo?: boolean;
  /**
   * Si > 0, normaliza el modelo cargado para que su bounding box máximo
   * sea exactamente `fitTo` unidades. Soluciona el problema de packs
   * con escalas inconsistentes (Kenney buildings = 50 units,
   * frutas = 0.5 units). Default 2.0. Set 0 para deshabilitar.
   */
  fitTo?: number;
}

// ─────────────────────────────────────────────────────────────
// Halo sprite cache (shared con _BaseShape pero local para evitar import circular)

const haloTextureCache = new Map<string, THREE.CanvasTexture>();

function getHaloTexture(color: string): THREE.CanvasTexture {
  const cached = haloTextureCache.get(color);
  if (cached) return cached;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, color);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  haloTextureCache.set(color, tex);
  return tex;
}

// ─────────────────────────────────────────────────────────────
// Material factories — uno por mode. Comparten color/glow.

function materialForMode(mode: ShapeMode, color: string, glow: number): THREE.Material {
  if (mode === 'solid') {
    return new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.25 * glow,
      roughness: 0.45, metalness: 0.35,
    });
  }
  if (mode === 'wireframe') {
    return new THREE.MeshBasicMaterial({
      color, wireframe: true, transparent: true, opacity: 0.85 * glow, toneMapped: false,
    });
  }
  // atom mode (fill): emissive translúcido, edges van separados encima
  return new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.55 * glow,
    roughness: 0.5, metalness: 0.30,
    transparent: true, opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

// ─────────────────────────────────────────────────────────────

export default function AtomModel({
  src,
  color = '#FDB813',
  glow = 1.0,
  mode = 'atom',
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  edgeThreshold = 22,
  halo = true,
  fitTo = 2.0,
}: AtomModelProps) {
  const gltf = useGLTF(src);
  const groupRef = useRef<THREE.Group>(null);

  // Clonamos la escena para no mutar el cache compartido de drei.
  // Recolectamos las geometrías Y el centro de bbox global. Importante:
  // el offset de centering se aplica a TODO (primitive + edges) via un
  // grupo wrapper, no sólo al clone — si no, los edges quedan desfasados
  // del fill y se ve "doble" (fill centrado vs edges en posición original).
  const { sceneClone, geometries, boundingRadius, normalizeScale, centerOffset } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const geos: THREE.BufferGeometry[] = [];
    let maxRadius = 1;

    clone.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if ((mesh as THREE.Mesh).isMesh && mesh.geometry) {
        mesh.material = materialForMode(mode, color, glow);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingSphere();
        if (mesh.geometry.boundingSphere) {
          maxRadius = Math.max(maxRadius, mesh.geometry.boundingSphere.radius);
        }
        geos.push(mesh.geometry);
      }
    });

    if (mode === 'edges') {
      clone.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if ((mesh as THREE.Mesh).isMesh) mesh.visible = false;
      });
    }

    // Calcular bbox global y derivar normScale + centerOffset
    let normScale = 1;
    const offset = new THREE.Vector3(0, 0, 0);
    if (fitTo > 0) {
      clone.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(clone);
      const size = new THREE.Vector3();
      box.getSize(size);
      const longest = Math.max(size.x, size.y, size.z);
      if (longest > 0.001) normScale = fitTo / longest;
      box.getCenter(offset);
      offset.negate();
    }

    return {
      sceneClone: clone,
      geometries: geos,
      boundingRadius: maxRadius,
      normalizeScale: normScale,
      centerOffset: offset.toArray() as [number, number, number],
    };
  }, [gltf.scene, mode, color, glow, fitTo]);

  // EdgesGeometry overlay para atom/edges modes — una por geometría
  const edgeGeometries = useMemo(() => {
    if (mode !== 'atom' && mode !== 'edges') return [];
    return geometries.map(g => new THREE.EdgesGeometry(g, edgeThreshold));
  }, [geometries, mode, edgeThreshold]);

  // Cleanup al desmontar — drei NO libera materiales clonados
  useEffect(() => {
    return () => {
      sceneClone.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if ((mesh as THREE.Mesh).isMesh && mesh.material) {
          const mat = mesh.material as THREE.Material;
          mat.dispose();
        }
      });
      edgeGeometries.forEach(g => g.dispose());
    };
  }, [sceneClone, edgeGeometries]);

  const haloTex = halo && mode === 'atom' ? getHaloTexture(color) : null;

  // Aplicamos normalizeScale al scale del usuario (componente puede aún ajustar).
  const finalScale: [number, number, number] =
    typeof scale === 'number'
      ? [scale * normalizeScale, scale * normalizeScale, scale * normalizeScale]
      : [scale[0] * normalizeScale, scale[1] * normalizeScale, scale[2] * normalizeScale];

  // Halo size: post-normalización, todos los modelos tienen bbox ~fitTo, así que
  // un halo de fitTo*1.1 funciona universalmente.
  const haloSize = fitTo > 0 ? fitTo * 1.1 : boundingRadius * 2.2;

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={finalScale}>
      {/* Halo sprite — en el origen del grupo escalado, después del centering */}
      {haloTex && (
        <sprite scale={[haloSize, haloSize, 1]}>
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

      {/* Grupo interno con centerOffset — wrappea primitive + edges para
          que coincidan. Antes el clone se centraba pero los edges quedaban
          en coordenadas originales → se veía "doble" (fill + edges separados). */}
      <group position={centerOffset}>
        <primitive object={sceneClone} />
        {edgeGeometries.map((edgeGeo, i) => (
          <lineSegments key={i} geometry={edgeGeo}>
            <lineBasicMaterial
              color={color}
              transparent
              opacity={0.92 * glow}
              toneMapped={false}
            />
          </lineSegments>
        ))}
      </group>
    </group>
  );
}

/**
 * Preload helper — invocar en boot/route-change para warming up del cache
 * de drei. Evita el "popping in" al primer mount de un AtomModel nuevo.
 *
 * Uso:
 *   AtomModel.preload('/models/library/food/lemon.glb');
 *   AtomModel.preload('/models/library/buildings/factory.glb');
 */
AtomModel.preload = (src: string) => useGLTF.preload(src);
