/**
 * CarLot100 — un lote de 100 carros wireframe abstraídos.
 *
 * Cada "carro" es una composición simple de body + cabin (dos boxes wireframe
 * en InstancedMesh) — suficiente para que el ojo reconozca "lote de carros"
 * sin pagar el costo de 100 Tsurus detallados.
 *
 * El componente expone un `setPovMix(t: number)` donde:
 *   t = 0 → POV vendedor (revela cherries verdes y lemons rojos)
 *   t = 1 → POV comprador (todos gris uniforme — el ojo del comprador no distingue)
 *
 * Imperative API evita re-renders por frame.
 */

import { useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import * as THREE from 'three';

export interface CarLot100Handle {
  setPovMix(t: number): void;
}

interface CarLot100Props {
  /** Espaciado X (carros uno tras otro, a lo largo). */
  spacingX?: number;
  /** Espaciado Z (filas separadas). */
  spacingZ?: number;
  /** % de cherries (buenos). El resto son lemons. Default 0.60. */
  cherryRatio?: number;
  /** Seed determinístico para qué carros son cherry/lemon. */
  seed?: number;
}

const GRID_COLS = 10;
const GRID_ROWS = 10;
const TOTAL = GRID_COLS * GRID_ROWS;

const CHERRY_COLOR = new THREE.Color('#34D399');
const LEMON_COLOR = new THREE.Color('#FF5040');
// Gris azulado frío: cuando el comprador no sabe, los carros pierden identidad
// y se vuelven una masa homogénea. Contraste térmico con verde/rojo cálidos.
const NEUTRAL_COLOR = new THREE.Color('#6B7585');

function pseudoRandom(seed: number, index: number): number {
  const x = Math.sin((seed * 12.9898) + (index * 78.233)) * 43758.5453;
  return x - Math.floor(x);
}

const CarLot100 = forwardRef<CarLot100Handle, CarLot100Props>(
  function CarLot100({ spacingX = 1.8, spacingZ = 2.6, cherryRatio = 0.60, seed = 7 }, ref) {
    // ─── Determinar qué carros son cherry / lemon (determinístico) ──
    const carIsLemon = useMemo(() => {
      const arr: boolean[] = [];
      for (let i = 0; i < TOTAL; i++) {
        arr.push(pseudoRandom(seed, i) > cherryRatio);
      }
      return arr;
    }, [seed, cherryRatio]);

    // ─── Refs ───────────────────────────────────────────────
    const bodyMeshRef = useRef<THREE.InstancedMesh>(null);
    const cabinMeshRef = useRef<THREE.InstancedMesh>(null);
    const povMixRef = useRef(0);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const tmpColor = useMemo(() => new THREE.Color(), []);
    const trueColors = useMemo(() => {
      // Pre-compute "true" color per instance (cherry/lemon)
      return carIsLemon.map(isLemon => isLemon ? LEMON_COLOR.clone() : CHERRY_COLOR.clone());
    }, [carIsLemon]);

    useImperativeHandle(ref, () => ({
      setPovMix(t: number) {
        povMixRef.current = Math.max(0, Math.min(1, t));
        applyColors();
      },
    }), []);

    // ─── Apply colors based on povMix ───────────────────────
    const applyColors = () => {
      const body = bodyMeshRef.current;
      const cabin = cabinMeshRef.current;
      if (!body || !cabin) return;
      const mix = povMixRef.current;
      for (let i = 0; i < TOTAL; i++) {
        const trueColor = trueColors[i];
        // mix 0 = trueColor; mix 1 = neutral
        tmpColor.copy(trueColor).lerp(NEUTRAL_COLOR, mix);
        body.setColorAt(i, tmpColor);
        cabin.setColorAt(i, tmpColor);
      }
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      if (cabin.instanceColor) cabin.instanceColor.needsUpdate = true;
    };

    // ─── Initial setup: positions + initial colors ──────────
    useEffect(() => {
      const body = bodyMeshRef.current;
      const cabin = cabinMeshRef.current;
      if (!body || !cabin) return;

      const offsetX = -(GRID_COLS - 1) * spacingX / 2;
      const offsetZ = -(GRID_ROWS - 1) * spacingZ / 2;

      for (let i = 0; i < TOTAL; i++) {
        const col = i % GRID_COLS;
        const row = Math.floor(i / GRID_COLS);
        const x = offsetX + col * spacingX;
        const z = offsetZ + row * spacingZ;

        // Slight randomization to feel less perfect
        const jitterX = (pseudoRandom(seed + 1000, i) - 0.5) * 0.15;
        const jitterZ = (pseudoRandom(seed + 2000, i) - 0.5) * 0.15;
        const jitterRot = (pseudoRandom(seed + 3000, i) - 0.5) * 0.20;

        // Body: chassis bajo (1.2 × 0.32 × 0.55)
        dummy.position.set(x + jitterX, 0, z + jitterZ);
        dummy.rotation.set(0, jitterRot, 0);
        dummy.scale.set(1.2, 0.32, 0.55);
        dummy.updateMatrix();
        body.setMatrixAt(i, dummy.matrix);

        // Cabin: encima del body (0.7 × 0.28 × 0.50), ligeramente hacia atrás
        dummy.position.set(x + jitterX - 0.15, 0.30, z + jitterZ);
        dummy.rotation.set(0, jitterRot, 0);
        dummy.scale.set(0.70, 0.28, 0.50);
        dummy.updateMatrix();
        cabin.setMatrixAt(i, dummy.matrix);
      }
      body.instanceMatrix.needsUpdate = true;
      cabin.instanceMatrix.needsUpdate = true;
      applyColors();
    }, [seed, spacingX, spacingZ, dummy]);

    return (
      <group>
        {/* Body instances */}
        <instancedMesh ref={bodyMeshRef} args={[undefined, undefined, TOTAL]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            wireframe
            transparent
            opacity={0.85}
            toneMapped={false}
          />
        </instancedMesh>
        {/* Cabin instances */}
        <instancedMesh ref={cabinMeshRef} args={[undefined, undefined, TOTAL]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            wireframe
            transparent
            opacity={0.85}
            toneMapped={false}
          />
        </instancedMesh>
      </group>
    );
  },
);

export default CarLot100;
