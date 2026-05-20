/**
 * PersonSilhouette — silueta humana plana sobre billboard.
 *
 * Implementada como un Shape 2D de un humanoide simple, dibujado en un canvas
 * y aplicado como textura a un plano vertical. Da la sensación de "persona
 * en sombra" sin necesidad de modelo 3D real ni assets externos.
 *
 * El plano usa transparent + alphaTest para que las áreas vacías del SVG no
 * tapen el fondo. La silueta misma es muy oscura con un sutil borde dorado
 * emisivo — apenas perceptible pero la hace "respirar" en la luz nocturna.
 */

import { useMemo, forwardRef } from 'react';
import * as THREE from 'three';

interface PersonSilhouetteProps {
  /** Color del cuerpo. Default casi negro. */
  color?: string;
  /** Color del borde emisivo sutil. Default dorado tenue. */
  rimColor?: string;
  /** Intensidad del rim glow. Default 0.18. */
  rimIntensity?: number;
  /** Escala global. Default 1 (≈1.7m de alto). */
  scale?: number;
}

function makeSilhouetteCanvas(color: string, rimColor: string): HTMLCanvasElement {
  const W = 256;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);

  // ─── Body shape (silueta humanoide) ──────────────────────
  ctx.fillStyle = color;

  // Cabeza (circle)
  ctx.beginPath();
  ctx.arc(W / 2, 75, 38, 0, Math.PI * 2);
  ctx.fill();

  // Cuello
  ctx.fillRect(W / 2 - 11, 110, 22, 28);

  // Torso (trapezoidal — hombros más anchos que cintura)
  ctx.beginPath();
  ctx.moveTo(W / 2 - 60, 138);   // hombro izq
  ctx.lineTo(W / 2 + 60, 138);   // hombro der
  ctx.lineTo(W / 2 + 50, 282);   // cintura der
  ctx.lineTo(W / 2 - 50, 282);   // cintura izq
  ctx.closePath();
  ctx.fill();

  // Brazos (un poco caídos a los lados, no totalmente verticales)
  // Brazo izquierdo
  ctx.beginPath();
  ctx.moveTo(W / 2 - 56, 142);
  ctx.lineTo(W / 2 - 80, 268);
  ctx.lineTo(W / 2 - 60, 272);
  ctx.lineTo(W / 2 - 38, 150);
  ctx.closePath();
  ctx.fill();
  // Brazo derecho
  ctx.beginPath();
  ctx.moveTo(W / 2 + 56, 142);
  ctx.lineTo(W / 2 + 80, 268);
  ctx.lineTo(W / 2 + 60, 272);
  ctx.lineTo(W / 2 + 38, 150);
  ctx.closePath();
  ctx.fill();

  // Manos (puntos pequeños)
  ctx.beginPath();
  ctx.arc(W / 2 - 70, 280, 10, 0, Math.PI * 2);
  ctx.arc(W / 2 + 70, 280, 10, 0, Math.PI * 2);
  ctx.fill();

  // Piernas (un poco separadas, no juntas)
  // Pierna izquierda
  ctx.beginPath();
  ctx.moveTo(W / 2 - 44, 282);
  ctx.lineTo(W / 2 - 50, 460);
  ctx.lineTo(W / 2 - 18, 462);
  ctx.lineTo(W / 2 - 6, 285);
  ctx.closePath();
  ctx.fill();
  // Pierna derecha
  ctx.beginPath();
  ctx.moveTo(W / 2 + 44, 282);
  ctx.lineTo(W / 2 + 50, 460);
  ctx.lineTo(W / 2 + 18, 462);
  ctx.lineTo(W / 2 + 6, 285);
  ctx.closePath();
  ctx.fill();

  // Pies (rectángulos chatos)
  ctx.fillRect(W / 2 - 56, 458, 40, 14);
  ctx.fillRect(W / 2 + 16, 458, 40, 14);

  // ─── Rim glow (borde dorado tenue) ───────────────────────
  // Dibujado encima del cuerpo con stroke + filter blur en canvas API:
  ctx.shadowColor = rimColor;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rimColor;

  // Re-dibuja los contornos con stroke para el glow
  ctx.beginPath();
  ctx.arc(W / 2, 75, 38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  return canvas;
}

const PersonSilhouette = forwardRef<THREE.Group, PersonSilhouetteProps>(
  function PersonSilhouette({
    color = '#0A0810',
    rimColor = '#FFB81C',
    rimIntensity: _rim = 0.18,
    scale = 1,
  }, ref) {
    const texture = useMemo(() => {
      const canvas = makeSilhouetteCanvas(color, rimColor);
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
      return tex;
    }, [color, rimColor]);

    return (
      <group ref={ref} scale={scale}>
        {/* La silueta misma. El plano mide 0.85m × 1.70m (proporción humana). */}
        <mesh position={[0, 0.85, 0]}>
          <planeGeometry args={[0.85, 1.70]} />
          <meshBasicMaterial
            map={texture}
            transparent
            alphaTest={0.5}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Sombra al piso bajo la silueta */}
        <mesh position={[0, -0.94, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.35, 16]} />
          <meshBasicMaterial
            color="#000000"
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }
);

export default PersonSilhouette;
