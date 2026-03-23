/**
 * ⚒️ La Forja — Section Plane (Corte Transversal)
 * =================================================
 * Interactive clip plane for sectioning SDF and imported meshes.
 *
 * How it works:
 * - A translucent plane is shown in the viewport at the section position
 * - The SDF fragment shader discards pixels on one side (via uClipPlane uniform)
 * - Imported Three.js meshes use material.clippingPlanes
 * - The plane normal + distance are driven from a Zustand store slice
 *
 * Section plane equation: dot(point, normal) + distance = 0
 * Everything with dot(p, n) + d > 0 is clipped away.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

// ── Types ──

export type SectionAxis = 'X' | 'Y' | 'Z';

export interface SectionState {
  enabled: boolean;
  axis: SectionAxis;
  distance: number;   // offset along the axis
  flip: boolean;      // flip which side is clipped
}

export const DEFAULT_SECTION: SectionState = {
  enabled: false,
  axis: 'Y',
  distance: 0.5,
  flip: false,
};

// ── Axis → normal vector ──

const AXIS_NORMALS: Record<SectionAxis, THREE.Vector3> = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
};

const AXIS_COLORS: Record<SectionAxis, string> = {
  X: '#f87171',  // red
  Y: '#4ade80',  // green
  Z: '#60a5fa',  // blue
};

// ── Utility: create THREE.Plane from section state ──

export function sectionToThreePlane(section: SectionState): THREE.Plane {
  const normal = AXIS_NORMALS[section.axis].clone();
  if (section.flip) normal.negate();
  return new THREE.Plane(normal, -section.distance * (section.flip ? -1 : 1));
}

/** Returns [nx, ny, nz, d] for the GLSL uniform vec4 uClipPlane */
export function sectionToVec4(section: SectionState): [number, number, number, number] {
  const n = AXIS_NORMALS[section.axis].clone();
  if (section.flip) n.negate();
  return [n.x, n.y, n.z, -section.distance * (section.flip ? -1 : 1)];
}

// ── Visual Indicator Component ──

interface SectionPlaneVisualProps {
  section: SectionState;
}

/**
 * Renders an infinite-feeling translucent plane + axis-colored wireframe
 * at the current section position. Lives inside the R3F Canvas.
 */
export default function SectionPlaneVisual({ section }: SectionPlaneVisualProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const color = AXIS_COLORS[section.axis];
  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  // Rotation: align plane perpendicular to the axis
  const rotation = useMemo((): [number, number, number] => {
    switch (section.axis) {
      case 'X': return [0, 0, Math.PI / 2];       // plane faces X
      case 'Y': return [0, 0, 0];                   // plane faces Y (default)
      case 'Z': return [Math.PI / 2, 0, 0];         // plane faces Z
    }
  }, [section.axis]);

  // Position along axis
  const position = useMemo((): [number, number, number] => {
    switch (section.axis) {
      case 'X': return [section.distance, 0, 0];
      case 'Y': return [0, section.distance, 0];
      case 'Z': return [0, 0, section.distance];
    }
  }, [section.axis, section.distance]);

  return (
    <group position={position} rotation={rotation}>
      {/* Translucent fill */}
      <mesh ref={meshRef} renderOrder={998}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial
          color={threeColor}
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Wireframe border ring */}
      <mesh renderOrder={998}>
        <ringGeometry args={[0, 3, 64]} />
        <meshBasicMaterial
          color={threeColor}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Center cross lines for visual reference */}
      <group>
        <primitive
          object={new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(-50, 0, 0),
              new THREE.Vector3(50, 0, 0),
            ]),
            new THREE.LineBasicMaterial({ color: threeColor, transparent: true, opacity: 0.08 }),
          )}
          renderOrder={998}
        />
        <primitive
          object={new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(0, 0, -50),
              new THREE.Vector3(0, 0, 50),
            ]),
            new THREE.LineBasicMaterial({ color: threeColor, transparent: true, opacity: 0.08 }),
          )}
          renderOrder={998}
        />
      </group>

      {/* Axis label */}
      <Html center distanceFactor={10} style={{ pointerEvents: 'none' }} position={[0, 0, 3.5]}>
        <div
          className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold select-none"
          style={{
            background: 'rgba(8,9,13,0.85)',
            color,
            border: `1px solid ${color}30`,
            backdropFilter: 'blur(8px)',
          }}
        >
          ✂ {section.axis} = {section.distance.toFixed(2)}
        </div>
      </Html>
    </group>
  );
}

// ── Mesh Clipper — applies clipping planes to imported meshes ──

interface MeshClipperProps {
  section: SectionState;
}

/**
 * Traverses all scene meshes and sets their material.clippingPlanes
 * when section is enabled. Restores them when disabled.
 */
export function MeshClipper({ section }: MeshClipperProps) {
  const { scene, gl } = useThree();

  useEffect(() => {
    gl.localClippingEnabled = section.enabled;
  }, [section.enabled, gl]);

  useFrame(() => {
    if (!section.enabled) return;
    const plane = sectionToThreePlane(section);
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.Material;
        // Don't clip the section plane itself or the fullscreen ray march quad
        if (mat.userData.__forgeNoClip) return;
        if (!mat.clippingPlanes || mat.clippingPlanes.length === 0) {
          mat.clippingPlanes = [plane];
        } else {
          mat.clippingPlanes[0].copy(plane);
        }
        mat.clipShadows = true;
        mat.needsUpdate = true;
      }
    });
  });

  return null;
}
