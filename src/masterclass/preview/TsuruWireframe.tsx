/**
 * TsuruWireframe — silueta lateral del Nissan Tsuru/Versa como wireframe
 * dorado emisivo. Sin texturas, sin marca explícita, todo luz.
 *
 * La silueta se construye desde un Shape 2D del perfil lateral, extruido
 * en Z para dar el ancho del coche. EdgesGeometry saca solo los bordes
 * "duros" que forman la línea reconocible del 3-volume sedan mexicano:
 *
 *      ┌──────┐
 *     /        \
 *   _/          \____
 *  | hood  cabin trunk |
 *   ◯           ◯       ← ruedas wireframe
 *
 * El componente acepta `glowIntensity` para pulsar el material desde fuera
 * (e.g., un parent useFrame puede aumentarlo en momentos clave).
 */

import { useMemo, useRef, forwardRef } from 'react';
import * as THREE from 'three';

interface TsuruWireframeProps {
  /** Color del wireframe. Default dorado cálido. */
  color?: string;
  /** Intensidad del fill emisivo interior (0-1). Default 0.10. */
  fillIntensity?: number;
  /** Si true, agrega faros pulsando suavemente. Default true. */
  withHeadlights?: boolean;
  /** Multiplicador de glow para todo el modelo (parent puede animarlo). */
  glowIntensity?: number;
  /** Escala global del modelo. Default 1. */
  scale?: number;
}

const TsuruWireframe = forwardRef<THREE.Group, TsuruWireframeProps>(function TsuruWireframe(
  { color = '#FFB81C', fillIntensity = 0.10, withHeadlights = true, glowIntensity = 1, scale = 1 },
  ref,
) {
  // ─────────────────────────────────────────────────────────────
  // Perfil lateral del Tsuru/Versa — coordenadas en metros (X→largo, Y→alto)
  // Origen en (0,0) = esquina inferior frontal del bumper.

  const profile = useMemo(() => {
    const s = new THREE.Shape();
    // Frente: bumper bajo
    s.moveTo(0.00, 0.32);
    // Subimos al hood
    s.lineTo(0.20, 0.55);
    // Hood horizontal (ligera pendiente hacia atrás)
    s.lineTo(1.40, 0.72);
    // Subida al windshield (pendiente fuerte)
    s.lineTo(1.92, 1.34);
    // Techo de la cabina (plano)
    s.lineTo(3.12, 1.34);
    // Rear window (pendiente similar al windshield)
    s.lineTo(3.58, 0.88);
    // Top del trunk (plano)
    s.lineTo(4.36, 0.88);
    // Bajada al rear bumper
    s.lineTo(4.40, 0.50);
    // Rear bumper bajo
    s.lineTo(4.20, 0.32);
    // Regreso al frente (chassis bajo)
    s.lineTo(0.00, 0.32);
    return s;
  }, []);

  const bodyGeo = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(profile, {
      depth: 1.60,
      bevelEnabled: false,
      curveSegments: 4,
    });
    // Centrar el carro: shift X por -2.20, Y por -0.85, Z por -0.80
    geo.translate(-2.20, -0.85, -0.80);
    return geo;
  }, [profile]);

  // Edges con threshold alto para evitar líneas internas del Extrude.
  // Threshold = 1 grado captura todos los bordes; más alto = solo bordes "duros".
  const bodyEdges = useMemo(() => new THREE.EdgesGeometry(bodyGeo, 15), [bodyGeo]);

  // ─────────────────────────────────────────────────────────────
  // Líneas interiores: separación de puertas (no salen del Extrude porque
  // son cortes verticales sobre la superficie lateral)

  const doorLines = useMemo(() => {
    // Línea entre hood/cabina (pillar A) y entre cabina/trunk (pillar C).
    // Coordenadas relativas al sistema centrado.
    const positions: number[] = [];
    // Pillar A: x ≈ 1.92, y de 0.49 a 0.49 (centrado), z=±0.80 (ambos lados)
    // Mejor: línea vertical en el costado izquierdo y derecho.
    const pillarAX = 1.92 - 2.20;  // -0.28
    const pillarCX = 3.58 - 2.20;  // 1.38

    for (const z of [-0.80, 0.80]) {
      // Pillar A: del techo al chassis bajo
      positions.push(pillarAX, 1.34 - 0.85, z,  pillarAX, 0.32 - 0.85, z);
      // Pillar C: del techo al chassis bajo
      positions.push(pillarCX, 1.34 - 0.85, z,  pillarCX, 0.32 - 0.85, z);
      // Línea media de puerta (visualmente ayuda)
      const middleX = (pillarAX + pillarCX) / 2;
      positions.push(middleX, 0.95 - 0.85, z,  middleX, 0.32 - 0.85, z);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Ruedas — wireframe de cilindros
  // Posición: rueda frontal centrada en x ≈ 0.85, rueda trasera en x ≈ 3.55

  const wheelEdges = useMemo(() => new THREE.EdgesGeometry(
    new THREE.CylinderGeometry(0.32, 0.32, 0.22, 18, 1),
    1,
  ), []);

  const wheelPositions: Array<[number, number, number]> = [
    [0.85 - 2.20, 0.30 - 0.85, 0.80 + 0.02],   // front-right
    [0.85 - 2.20, 0.30 - 0.85, -0.80 - 0.02],  // front-left
    [3.55 - 2.20, 0.30 - 0.85, 0.80 + 0.02],   // rear-right
    [3.55 - 2.20, 0.30 - 0.85, -0.80 - 0.02],  // rear-left
  ];

  // ─────────────────────────────────────────────────────────────
  // Faros — pequeñas esferas emisivas al frente del hood

  const headlightPositions: Array<[number, number, number]> = [
    [0.20 - 2.20, 0.52 - 0.85, 0.66],
    [0.20 - 2.20, 0.52 - 0.85, -0.66],
  ];

  // ─────────────────────────────────────────────────────────────
  // Refs para pulse opcional via parent

  const lineMatRef = useRef<THREE.LineBasicMaterial>(null);
  const fillMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // Aplicar glow desde parent
  if (lineMatRef.current) lineMatRef.current.opacity = Math.min(1, 0.92 * glowIntensity);
  if (fillMatRef.current) fillMatRef.current.emissiveIntensity = fillIntensity * glowIntensity;

  return (
    <group ref={ref} scale={scale}>
      {/* Body wireframe — líneas principales */}
      <lineSegments geometry={bodyEdges}>
        <lineBasicMaterial
          ref={lineMatRef}
          color={color}
          transparent
          opacity={0.92 * glowIntensity}
          toneMapped={false}
        />
      </lineSegments>

      {/* Body fill — sutil, da volumen sin tapar el wireframe */}
      <mesh geometry={bodyGeo}>
        <meshStandardMaterial
          ref={fillMatRef}
          color={color}
          emissive={color}
          emissiveIntensity={fillIntensity * glowIntensity}
          roughness={0.4}
          metalness={0.55}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Pillar lines (puertas) */}
      <lineSegments geometry={doorLines}>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0.55 * glowIntensity}
          toneMapped={false}
        />
      </lineSegments>

      {/* Ruedas wireframe */}
      {wheelPositions.map((pos, i) => (
        <group key={i} position={pos} rotation={[Math.PI / 2, 0, 0]}>
          <lineSegments geometry={wheelEdges}>
            <lineBasicMaterial
              color={color}
              transparent
              opacity={0.85 * glowIntensity}
              toneMapped={false}
            />
          </lineSegments>
        </group>
      ))}

      {/* Faros */}
      {withHeadlights && headlightPositions.map((pos, i) => (
        <mesh key={`hl-${i}`} position={pos}>
          <sphereGeometry args={[0.08, 14, 10]} />
          <meshStandardMaterial
            color="#FFF6D0"
            emissive="#FFF6D0"
            emissiveIntensity={3.0 * glowIntensity}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Underglow sutil — anclamiento al "piso" */}
      <mesh position={[0, -0.85 - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.2, 2.4]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.04 * glowIntensity}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
});

export default TsuruWireframe;
