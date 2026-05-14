/**
 * Shared "car shape" helper for the econ masterclass scenes.
 *
 * A stylized car made of:
 *   - chassis: long thin box
 *   - cabin:   shorter narrower box on top
 *   - 4 wheels: small spheres at corners
 *   - 2 headlights: tiny emissive spheres
 *
 * The chassis material is the highlight knob — change its color/emissive
 * to recolor the whole car.
 */

import { forwardRef } from 'react';
import * as THREE from 'three';

export interface CarColors {
  body: string;
  bodyEmissive: string;
  bodyEmissiveIntensity: number;
  cabin: string;
  wheels: string;
  headlights: string;
}

export const NEUTRAL: CarColors = {
  body: '#64748B',
  bodyEmissive: '#1E293B',
  bodyEmissiveIntensity: 0.18,
  cabin: '#1E293B',
  wheels: '#0B0F17',
  headlights: '#FFFAE5',
};

export const CHERRY: CarColors = {
  body: '#1FAE6E',
  bodyEmissive: '#10B981',
  bodyEmissiveIntensity: 2.4,
  cabin: '#064E3B',
  wheels: '#022C22',
  headlights: '#D1FAE5',
};

export const LEMON: CarColors = {
  body: '#E0A800',
  bodyEmissive: '#FDB813',
  bodyEmissiveIntensity: 2.1,
  cabin: '#7A5400',
  wheels: '#3E2A00',
  headlights: '#FFFAE5',
};

interface CarProps {
  scale?: number;
  colors?: CarColors;
}

/**
 * One stylized car at the local origin, ~0.9 wide, ~0.4 tall.
 * Intended to be wrapped by a <group> for position/rotation.
 */
export const Car = forwardRef<THREE.Group, CarProps>(function Car(
  { scale = 1, colors = NEUTRAL }: CarProps,
  ref,
) {
  return (
    <group ref={ref} scale={scale}>
      {/* Chassis */}
      <mesh position={[0, 0.09, 0]} castShadow>
        <boxGeometry args={[0.9, 0.18, 0.42]} />
        <meshStandardMaterial
          color={colors.body}
          emissive={colors.bodyEmissive}
          emissiveIntensity={colors.bodyEmissiveIntensity}
          roughness={0.45}
          metalness={0.5}
        />
      </mesh>
      {/* Cabin */}
      <mesh position={[-0.04, 0.24, 0]}>
        <boxGeometry args={[0.5, 0.16, 0.36]} />
        <meshStandardMaterial color={colors.cabin} metalness={0.85} roughness={0.18} />
      </mesh>
      {/* Headlights */}
      <mesh position={[0.42, 0.11, 0.14]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial color={colors.headlights} emissive={colors.headlights} emissiveIntensity={2.0} />
      </mesh>
      <mesh position={[0.42, 0.11, -0.14]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial color={colors.headlights} emissive={colors.headlights} emissiveIntensity={2.0} />
      </mesh>
      {/* Wheels */}
      {[
        [0.30, 0.04, 0.21],
        [0.30, 0.04, -0.21],
        [-0.30, 0.04, 0.21],
        [-0.30, 0.04, -0.21],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.075, 14, 14]} />
          <meshStandardMaterial color={colors.wheels} metalness={0.3} roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
});
