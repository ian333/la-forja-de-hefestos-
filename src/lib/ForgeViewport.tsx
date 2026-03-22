/**
 * ⚒️ La Forja — Three.js Viewport
 * =================================
 * React-Three-Fiber canvas that renders the Marching Cubes mesh
 * with Fusion-style orbit, GizmoHelper, infinite grid, and PBR lighting.
 */

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewcube, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useForgeStore, type MeshData } from './useForgeStore';

// ── SDF Mesh ──

function SdfMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const mesh = useForgeStore((s) => s.mesh);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (!mesh || mesh.triCount === 0) return geo;

    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    const indices: number[] = [];
    for (let i = 0; i < mesh.triCount * 3; i++) indices.push(i);
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }, [mesh]);

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#b0b0b0"
        metalness={0.15}
        roughness={0.55}
        side={THREE.DoubleSide}
        flatShading={false}
      />
    </mesh>
  );
}

// ── Infinite Grid with XYZ Axes ──

function ForgeGrid() {
  return (
    <>
      <Grid
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#555"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#888"
        fadeDistance={60}
        fadeStrength={1}
        infiniteGrid
      />
      {/* X axis – Red */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-50, 0, 0, 50, 0, 0]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#e53e3e" linewidth={2} />
      </line>
      {/* Y axis – Green */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, 0, 0, 50, 0]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#38a169" linewidth={2} />
      </line>
      {/* Z axis – Blue */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, -50, 0, 0, 50]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#3182ce" linewidth={2} />
      </line>
    </>
  );
}

// ── LOD Controller ──
// Switch quality: draft while orbiting, medium on release, high after idle 1.5s

function LodController() {
  const requestMesh = useForgeStore((s) => s.requestMesh);
  const meshQuality = useForgeStore((s) => s.meshQuality);
  const { controls } = useThree();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!controls) return;
    const ctrl = controls as unknown as { addEventListener: Function; removeEventListener: Function };

    const onStart = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      // Only re-mesh to draft if we're already at a higher quality
      if (meshQuality !== 'draft') requestMesh('draft');
    };

    const onEnd = () => {
      requestMesh('medium');
      idleTimer.current = setTimeout(() => requestMesh('high'), 1500);
    };

    ctrl.addEventListener('start', onStart);
    ctrl.addEventListener('end', onEnd);
    return () => {
      ctrl.removeEventListener('start', onStart);
      ctrl.removeEventListener('end', onEnd);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [controls, requestMesh, meshQuality]);

  return null;
}

// ── FPS Counter ──

interface FpsCounterProps {
  onFps?: (fps: number) => void;
}

function FpsCounter({ onFps }: FpsCounterProps) {
  const frames = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame(() => {
    frames.current++;
    const now = performance.now();
    if (now - lastTime.current >= 1000) {
      onFps?.(frames.current);
      frames.current = 0;
      lastTime.current = now;
    }
  });

  return null;
}

// ── Main Viewport Component ──

export interface ForgeViewportProps {
  onFps?: (fps: number) => void;
  className?: string;
}

export default function ForgeViewport({ onFps, className }: ForgeViewportProps) {
  return (
    <div className={className ?? 'w-full h-full'}>
      <Canvas
        shadows
        camera={{ position: [6, 5, 8], fov: 45, near: 0.01, far: 500 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[8, 12, 6]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <directionalLight position={[-4, 6, -4]} intensity={0.4} />

        {/* HDRI env for reflections */}
        <Environment preset="city" background={false} />

        {/* Scene */}
        <SdfMesh />
        <ForgeGrid />

        {/* Controls */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.12}
          minDistance={0.5}
          maxDistance={200}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
        />

        {/* Gizmo cube (Fusion-style) */}
        <GizmoHelper alignment="top-right" margin={[72, 72]}>
          <GizmoViewcube
            color="#505050"
            textColor="#fff"
            hoverColor="#0696D7"
            strokeColor="#333"
          />
        </GizmoHelper>

        {/* Helpers */}
        <LodController />
        <FpsCounter onFps={onFps} />
      </Canvas>
    </div>
  );
}
