/**
 * ThoughtBubble — caja de texto flotante (imperative API).
 *
 * El padre obtiene refs al group + material + halo y los anima vía useFrame
 * SIN provocar re-renders de React. Eso evita el bottleneck de re-renderear
 * cada frame.
 */

import { useMemo, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';

export interface ThoughtBubbleHandle {
  setOpacity(o: number): void;
  setScale(s: number): void;
  setHighlightOpacity(o: number): void;
}

interface ThoughtBubbleProps {
  text: string;
  textColor?: string;
  borderColor?: string;
  bgColor?: string;
  width?: number;
  height?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;  // initial scale only
}

function makeBubbleTexture(text: string, textColor: string, borderColor: string, bgColor: string): THREE.CanvasTexture {
  const W = 1024;
  const H = 320;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = bgColor;
  const pad = 18;
  const radius = 22;
  ctx.beginPath();
  ctx.moveTo(pad + radius, pad);
  ctx.lineTo(W - pad - radius, pad);
  ctx.quadraticCurveTo(W - pad, pad, W - pad, pad + radius);
  ctx.lineTo(W - pad, H - pad - radius);
  ctx.quadraticCurveTo(W - pad, H - pad, W - pad - radius, H - pad);
  ctx.lineTo(pad + radius, H - pad);
  ctx.quadraticCurveTo(pad, H - pad, pad, H - pad - radius);
  ctx.lineTo(pad, pad + radius);
  ctx.quadraticCurveTo(pad, pad, pad + radius, pad);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = borderColor;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 3;
  ctx.strokeStyle = borderColor;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = textColor;
  const fontSize = text.length > 16 ? 78 : 92;
  ctx.font = '700 ' + fontSize + 'px "JetBrains Mono", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = textColor;
  ctx.shadowBlur = 18;
  ctx.fillText(text, W / 2, H / 2);
  ctx.shadowBlur = 4;
  ctx.fillText(text, W / 2, H / 2);
  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

const ThoughtBubble = forwardRef<ThoughtBubbleHandle, ThoughtBubbleProps>(function ThoughtBubble({
  text,
  textColor = '#FFE5A0',
  borderColor = '#FFB81C',
  bgColor = 'rgba(8, 6, 14, 0.88)',
  width = 1.8,
  height = 0.55,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}, ref) {
  const texture = useMemo(
    () => makeBubbleTexture(text, textColor, borderColor, bgColor),
    [text, textColor, borderColor, bgColor],
  );
  useEffect(() => () => { texture.dispose(); }, [texture]);

  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useImperativeHandle(ref, () => ({
    setOpacity(o: number) {
      if (matRef.current) matRef.current.opacity = o;
    },
    setScale(s: number) {
      if (groupRef.current) groupRef.current.scale.setScalar(s);
    },
    setHighlightOpacity(o: number) {
      if (haloMatRef.current) haloMatRef.current.opacity = o;
    },
  }), []);

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Halo background (controlled via haloMatRef) */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width * 1.20, height * 1.5]} />
        <meshBasicMaterial
          ref={haloMatRef}
          map={texture}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      {/* Main bubble */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          ref={matRef}
          map={texture}
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

export default ThoughtBubble;
