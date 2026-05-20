/**
 * MotorWireframe — motor de carro estilizado wireframe.
 *
 * Diseño abstracto pero reconocible: bloque del motor (engine block),
 * 4 cilindros encima (pistones), polea/ventilador al frente, una manguera
 * curva. Renderizado en wireframes anaranjados-cobrizos (no mismo color que
 * la carrocería para que se distinga).
 *
 * Tamaño aproximado: 0.85 × 0.45 × 0.55 (largo × alto × ancho).
 * Pensado para encajar DENTRO del hood del TsuruWireframe (escala 1.0).
 */

import { useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';

export interface MotorWireframeHandle {
  setOpacity(o: number): void;
}

interface MotorWireframeProps {
  color?: string;
  scale?: number;
}

const MotorWireframe = forwardRef<MotorWireframeHandle, MotorWireframeProps>(
  function MotorWireframe({ color = '#FF8B40', scale = 1 }, ref) {
    // ─── Engine block (box principal) ──────────────────────
    const blockEdges = useMemo(
      () => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.70, 0.32, 0.45), 1),
      [],
    );

    // ─── 4 cilindros (pistones) ─────────────────────────────
    const cylinderEdges = useMemo(
      () => new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.07, 0.07, 0.20, 16, 1), 1),
      [],
    );
    const cylinderPositions: Array<[number, number, number]> = [
      [-0.24, 0.26, 0],
      [-0.08, 0.26, 0],
      [0.08, 0.26, 0],
      [0.24, 0.26, 0],
    ];

    // ─── Ventilador (cilindro plano al frente) ──────────────
    const fanEdges = useMemo(
      () => new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 24, 1), 1),
      [],
    );

    // ─── Manguera curva (TubeGeometry) ──────────────────────
    const hoseGeo = useMemo(() => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.15, 0.20, 0.22),
        new THREE.Vector3(0.05, 0.30, 0.30),
        new THREE.Vector3(-0.10, 0.34, 0.30),
        new THREE.Vector3(-0.22, 0.30, 0.20),
      ]);
      return new THREE.TubeGeometry(curve, 16, 0.020, 8, false);
    }, []);

    // ─── Refs para opacity control ──────────────────────────
    const groupRef = useRef<THREE.Group>(null);
    const matRefs = useRef<Array<THREE.LineBasicMaterial | THREE.MeshBasicMaterial>>([]);

    useImperativeHandle(ref, () => ({
      setOpacity(o: number) {
        for (const m of matRefs.current) {
          if (m) m.opacity = o;
        }
      },
    }), []);

    const registerMat = (m: THREE.LineBasicMaterial | THREE.MeshBasicMaterial | null) => {
      if (m && !matRefs.current.includes(m)) matRefs.current.push(m);
    };

    return (
      <group ref={groupRef} scale={scale}>
        {/* Engine block */}
        <lineSegments geometry={blockEdges}>
          <lineBasicMaterial
            ref={registerMat}
            color={color}
            transparent
            opacity={0}
            toneMapped={false}
          />
        </lineSegments>

        {/* Cilindros (pistones) */}
        {cylinderPositions.map((pos, i) => (
          <group key={i} position={pos}>
            <lineSegments geometry={cylinderEdges}>
              <lineBasicMaterial
                ref={registerMat}
                color={color}
                transparent
                opacity={0}
                toneMapped={false}
              />
            </lineSegments>
          </group>
        ))}

        {/* Ventilador frontal */}
        <group position={[0, 0.06, 0.30]} rotation={[Math.PI / 2, 0, 0]}>
          <lineSegments geometry={fanEdges}>
            <lineBasicMaterial
              ref={registerMat}
              color={color}
              transparent
              opacity={0}
              toneMapped={false}
            />
          </lineSegments>
          {/* Aspas del ventilador (4 líneas radiales) */}
          {[0, 1, 2, 3].map(i => {
            const angle = (i / 4) * Math.PI * 2;
            const geo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(Math.cos(angle) * 0.14, Math.sin(angle) * 0.14, 0),
            ]);
            return (
              <lineSegments key={i} geometry={geo}>
                <lineBasicMaterial
                  ref={registerMat}
                  color={color}
                  transparent
                  opacity={0}
                  toneMapped={false}
                />
              </lineSegments>
            );
          })}
        </group>

        {/* Manguera */}
        <mesh geometry={hoseGeo}>
          <meshBasicMaterial
            ref={registerMat}
            color={color}
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>

        {/* Fill sutil (volumen interior) */}
        <mesh>
          <boxGeometry args={[0.70, 0.32, 0.45]} />
          <meshBasicMaterial
            ref={registerMat}
            color={color}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    );
  },
);

export default MotorWireframe;
