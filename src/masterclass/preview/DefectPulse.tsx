/**
 * DefectPulse — punto pulsante con halo + label flotante.
 *
 * Usado en Escena 03 para marcar los 3 defectos del motor:
 *   - rojo: fuga de aceite
 *   - naranja: choque previo
 *   - morado: odómetro alterado
 *
 * Imperative API:
 *   ref.current.setOpacity(0..1)   → fade-in/out completo
 *   ref.current.setHaloPhase(t)    → controla la fase del halo expansivo
 */

import { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface DefectPulseHandle {
  setOpacity(o: number): void;
}

interface DefectPulseProps {
  /** Color principal. */
  color: string;
  /** Texto de la etiqueta. */
  label: string;
  /** Posición world del punto. */
  position?: [number, number, number];
  /** Offset world de la etiqueta respecto al punto. */
  labelOffset?: [number, number, number];
  /** Tamaño base del punto. Default 0.06. */
  size?: number;
}

function makeLabelTexture(text: string, color: string): THREE.CanvasTexture {
  const W = 768;
  const H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = color;
  ctx.font = '700 64px "JetBrains Mono", "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillText(text, 24, H / 2);
  ctx.shadowBlur = 4;
  ctx.fillText(text, 24, H / 2);
  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
}

const DefectPulse = forwardRef<DefectPulseHandle, DefectPulseProps>(
  function DefectPulse({
    color,
    label,
    position = [0, 0, 0],
    labelOffset = [0.5, 0.3, 0],
    size = 0.06,
  }, ref) {
    const groupRef = useRef<THREE.Group>(null);
    const pointMatRef = useRef<THREE.MeshBasicMaterial>(null);
    const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
    const labelMatRef = useRef<THREE.MeshBasicMaterial>(null);
    const lineMatRef = useRef<THREE.LineBasicMaterial>(null);

    const pointRef = useRef<THREE.Mesh>(null);
    const haloRef = useRef<THREE.Mesh>(null);

    const opacityRef = useRef(0);

    const labelTexture = useMemo(() => makeLabelTexture(label, color), [label, color]);
    useEffect(() => () => { labelTexture.dispose(); }, [labelTexture]);

    // Geometría de la línea conectora (point → label)
    const lineGeo = useMemo(() => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([
        0, 0, 0,
        labelOffset[0], labelOffset[1], labelOffset[2],
      ], 3));
      return g;
    }, [labelOffset]);

    useImperativeHandle(ref, () => ({
      setOpacity(o: number) {
        opacityRef.current = o;
        if (pointMatRef.current) pointMatRef.current.opacity = o;
        if (haloMatRef.current) haloMatRef.current.opacity = o * 0.3;
        if (labelMatRef.current) labelMatRef.current.opacity = o * 0.95;
        if (lineMatRef.current) lineMatRef.current.opacity = o * 0.55;
      },
    }), []);

    useFrame(({ clock }) => {
      const t = clock.elapsedTime;
      const o = opacityRef.current;
      if (o <= 0) return;
      // Pulse point scale
      if (pointRef.current) {
        const pulse = 1 + 0.15 * Math.sin(t * 4);
        pointRef.current.scale.setScalar(pulse);
      }
      // Halo expansive ring
      if (haloRef.current && haloMatRef.current) {
        const haloPhase = (t * 0.6) % 1; // 0..1 looping
        const haloScale = 1 + haloPhase * 3.5;
        haloRef.current.scale.setScalar(haloScale);
        haloMatRef.current.opacity = o * 0.35 * (1 - haloPhase);
      }
    });

    return (
      <group ref={groupRef} position={position}>
        {/* Punto principal (pulsante) */}
        <mesh ref={pointRef}>
          <sphereGeometry args={[size, 18, 12]} />
          <meshBasicMaterial
            ref={pointMatRef}
            color={color}
            transparent
            opacity={0}
            toneMapped={false}
          />
        </mesh>

        {/* Halo expansivo */}
        <mesh ref={haloRef}>
          <sphereGeometry args={[size * 1.6, 14, 10]} />
          <meshBasicMaterial
            ref={haloMatRef}
            color={color}
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>

        {/* Línea conectora */}
        <lineSegments geometry={lineGeo}>
          <lineBasicMaterial
            ref={lineMatRef}
            color={color}
            transparent
            opacity={0}
            toneMapped={false}
          />
        </lineSegments>

        {/* Etiqueta flotante */}
        <mesh position={[labelOffset[0] + 0.6, labelOffset[1], labelOffset[2]]}>
          <planeGeometry args={[1.2, 0.2]} />
          <meshBasicMaterial
            ref={labelMatRef}
            map={labelTexture}
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  },
);

export default DefectPulse;
