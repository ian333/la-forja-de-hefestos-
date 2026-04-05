/**
 * ⚒️ La Forja — Three.js Viewport
 * =================================
 * React-Three-Fiber canvas with GPU ray-marched SDF rendering
 * + imported CAD mesh rendering (STEP/IGES/BREP).
 * Pixel-perfect surfaces — no triangulation artifacts.
 * Keeps Fusion-style orbit, GizmoHelper, infinite grid, and construction planes.
 */

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewcube, Grid } from '@react-three/drei';
import * as THREE from 'three';
import RayMarchMesh from './RayMarchMesh';
import { useForgeStore } from './useForgeStore';
import { useThemeStore, selectViewport, selectStep } from './useThemeStore';
import type { SketchPlane, SketchShape } from './sketch-engine';
import SketchInViewport, { type SketchTool } from './SketchInViewport';
import {
  ForgeEnvironment,
  SectionPlaneVisual,
  MeshClipper,
  ViewTransitionController,
  SketchOverlay,
  SketchModeController,
  type StandardView,
} from './viewport';
import type { FittedSlice } from './sketch-fitting';
import type { SliceAxis } from './cross-section';
import type { ReconstructionResult } from './sketch-reconstruct';

// ── Infinite Grid with XYZ Axes ──

function ForgeGrid() {
  const vp = useThemeStore(selectViewport);
  return (
    <>
      <Grid
        args={[200, 200]}
        cellSize={1}
        cellThickness={0.15}
        cellColor={vp.gridCellColor}
        sectionSize={5}
        sectionThickness={0.3}
        sectionColor={vp.gridSectionColor}
        fadeDistance={40}
        fadeStrength={3}
        infiniteGrid
      />
      {/* X axis – subtle red */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-200, 0, 0, 200, 0, 0]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#f87171" transparent opacity={vp.axisOpacity} />
      </line>
      {/* Y axis – subtle green */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, 0, 0, 200, 0]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#4ade80" transparent opacity={vp.axisOpacity} />
      </line>
      {/* Z axis – subtle blue */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, -200, 0, 0, 200]), 3]}
            count={2}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={vp.gizmoHover} transparent opacity={vp.axisOpacity + 0.03} />
      </line>
    </>
  );
}

// ── Sketch Plane Overlay — plano matemático infinito en 3D ──

const SKETCH_PLANE_CFG: Record<SketchPlane, {
  rotation: [number, number, number];
  color: string;
  axisLabel: string;
}> = {
  XY: { rotation: [0,           0, 0], color: '#4299e1', axisLabel: 'XY' },
  XZ: { rotation: [-Math.PI/2,  0, 0], color: '#ed8936', axisLabel: 'XZ' },
  YZ: { rotation: [0, 0, Math.PI/2],   color: '#c9a84c', axisLabel: 'YZ' },
};

function SketchPlaneOverlay({ plane }: { plane: SketchPlane }) {
  const cfg = SKETCH_PLANE_CFG[plane];
  const [r, g, b] = new THREE.Color(cfg.color).toArray();
  return (
    <group rotation={new THREE.Euler(...cfg.rotation)}>
      {/* Fine grid — líneas del sketch */}
      <Grid
        args={[200, 200]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor={cfg.color}
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor={cfg.color}
        fadeDistance={80}
        fadeStrength={1.5}
        infiniteGrid
      />
      {/* Plano semitransparente */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial
          color={cfg.color}
          transparent
          opacity={0.03}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
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

// ── Camera Sync (exposes camera to store for CPU ray march) ──

function CameraSync() {
  const { camera } = useThree();
  const setCameraRef = useForgeStore(s => s.setCameraRef);
  useEffect(() => {
    setCameraRef(camera as THREE.PerspectiveCamera);
  }, [camera, setCameraRef]);
  return null;
}

// ── Renderer Sync (exposes WebGL renderer to store for GPU cross-section) ──

function RendererSync() {
  const { gl } = useThree();
  const setRendererRef = useForgeStore(s => s.setRendererRef);
  useEffect(() => {
    setRendererRef(gl);
  }, [gl, setRendererRef]);
  return null;
}

// ── Imported CAD Meshes (STEP/IGES/BREP) ──

// Shared ref so SketchModeController can ghost the imported meshes
export const importedMeshGroupRef = { current: null as THREE.Group | null };

function ImportedMeshes() {
  const importedModels = useForgeStore(s => s.importedModels);
  const themeStep = useThemeStore(selectStep);
  const groupRef = useRef<THREE.Group>(null!);

  // Sync Three.js groups into the scene
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // Clear previous children
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    // Add all imported model groups
    for (const model of importedModels) {
      if (model.threeGroup) {
        group.add(model.threeGroup);
      }
    }

    return () => {
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
    };
  }, [importedModels]);

  // Update STEP materials when theme changes (skip user-overridden meshes)
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        // Skip meshes the user has manually styled via the material panel
        if (obj.userData._userMaterial) return;
        const mat = obj.material;
        mat.metalness = themeStep.metalness;
        mat.roughness = themeStep.roughness;
        mat.envMapIntensity = themeStep.envMapIntensity;
        mat.needsUpdate = true;
      }
    });
  }, [themeStep, importedModels]);

  // Sync the shared ref for SketchModeController ghosting
  useEffect(() => {
    importedMeshGroupRef.current = groupRef.current;
    return () => { importedMeshGroupRef.current = null; };
  });

  if (importedModels.length === 0) return null;

  return <group ref={groupRef} />;
}

// ── Scene Lighting (active when imported meshes exist) ──

function SceneLighting() {
  const importedModels = useForgeStore(s => s.importedModels);
  if (importedModels.length === 0) return null;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={1.2} castShadow />
      <directionalLight position={[-5, 8, -5]} intensity={0.4} />
      <directionalLight position={[0, -3, 8]} intensity={0.2} />
    </>
  );
}

// ── Reconstructed 3D Mesh (from sketch extrusion) ──

function ReconstructedMesh({ reconstruction }: { reconstruction: ReconstructionResult | null }) {
  const groupRef = useRef<THREE.Group>(null!);

  useEffect(() => {
    const parent = groupRef.current;
    if (!parent) return;
    
    // Clear previous
    while (parent.children.length > 0) {
      parent.remove(parent.children[0]);
    }

    if (reconstruction?.group) {
      parent.add(reconstruction.group);
    }

    return () => {
      while (parent.children.length > 0) {
        parent.remove(parent.children[0]);
      }
    };
  }, [reconstruction]);

  return <group ref={groupRef} />;
}

// ── Main Viewport Component ──

export interface ForgeViewportProps {
  onFps?: (fps: number) => void;
  className?: string;
  sketchPlane?: SketchPlane | null;
  sketchTool?: SketchTool | null;
  sketchShapes?: SketchShape[];
  onSketchShapeAdd?: (shape: SketchShape) => void;
  onSketchDrawingChange?: (active: boolean) => void;
  onSketchCursorMove?: (x: number, y: number) => void;
  /** Trigger a camera fly-to animation to a standard view */
  targetView?: StandardView | null;
  /** Called when camera transition completes */
  onViewTransitionComplete?: () => void;
  /** Fitted sketch slices to render as overlays */
  fittedSlices?: FittedSlice[];
  /** Filter sketch overlay by axis */
  sketchFilterAxis?: SliceAxis | null;
  /** Index of the selected/focused slice (null = show all) */
  selectedSliceIndex?: number | null;
  /** 3D reconstruction result to render */
  reconstruction?: ReconstructionResult | null;
}

export default function ForgeViewport({
  onFps, className, sketchPlane,
  sketchTool, sketchShapes, onSketchShapeAdd,
  onSketchDrawingChange, onSketchCursorMove,
  targetView, onViewTransitionComplete,
  fittedSlices, sketchFilterAxis, selectedSliceIndex, reconstruction,
}: ForgeViewportProps) {
  const isSketch = !!sketchPlane;
  const section = useForgeStore(s => s.section);
  const themeVp = useThemeStore(selectViewport);
  return (
    <div className={className ?? 'w-full h-full'} style={{ cursor: isSketch ? 'crosshair' : undefined }}>
      <Canvas
        camera={{ position: [6, 5, 8], fov: 45, near: 0.01, far: 500 }}
        gl={{ antialias: true }}
      >
        {/* ── Environment Map (HDR reflections for imported meshes) ── */}
        <ForgeEnvironment />

        {/* GPU Ray-Marched SDF — pixel-perfect surfaces */}
        <RayMarchMesh />

        {/* Imported CAD meshes (STEP/IGES/BREP) with lighting */}
        <SceneLighting />
        <ImportedMeshes />

        {/* Grid & Axes */}
        <ForgeGrid />
        {sketchPlane && <SketchPlaneOverlay plane={sketchPlane} />}

        {/* In-viewport sketch drawing */}
        {sketchPlane && sketchTool && onSketchShapeAdd && (
          <SketchInViewport
            plane={sketchPlane}
            tool={sketchTool}
            shapes={sketchShapes ?? []}
            onShapeAdd={onSketchShapeAdd}
            onDrawingChange={onSketchDrawingChange ?? (() => {})}
            onCursorMove={onSketchCursorMove}
          />
        )}

        {/* Controls — in sketch mode: left=draw, right=orbit, middle=pan */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.12}
          minDistance={0.5}
          maxDistance={200}
          mouseButtons={{
            LEFT: isSketch ? (undefined as unknown as THREE.MOUSE) : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: isSketch ? THREE.MOUSE.ROTATE : (undefined as unknown as THREE.MOUSE),
          }}
        />

        {/* Gizmo cube (Fusion-style) */}
        <GizmoHelper alignment="top-right" margin={[72, 72]}>
          <GizmoViewcube
            color={themeVp.gizmoBg}
            textColor={themeVp.gizmoText}
            hoverColor={themeVp.gizmoHover}
            strokeColor={themeVp.gizmoStroke}
            opacity={0.85}
          />
        </GizmoHelper>

        {/* ── Sketch Overlay (fitted Lines + Arcs from CT-Scan) ── */}
        {fittedSlices && fittedSlices.length > 0 && (
          <SketchOverlay
            slices={fittedSlices}
            filterAxis={sketchFilterAxis ?? null}
            selectedSlice={selectedSliceIndex ?? null}
          />
        )}

        {/* ── Sketch Mode Controller (Fusion 360-style camera flight + ghosting) ── */}
        <SketchModeController
          slice={fittedSlices && selectedSliceIndex != null ? fittedSlices[selectedSliceIndex] ?? null : null}
          meshGroupRef={importedMeshGroupRef}
        />

        {/* ── Section Plane (clip visualization) ── */}
        {section.enabled && <SectionPlaneVisual section={section} />}
        <MeshClipper section={section} />

        {/* ── 3D Reconstruction (extruded profiles) ── */}
        <ReconstructedMesh reconstruction={reconstruction ?? null} />

        {/* ── Camera Transitions (smooth fly-to) ── */}
        <ViewTransitionController
          targetView={targetView ?? null}
          onComplete={onViewTransitionComplete}
        />

        {/* Helpers */}
        <CameraSync />
        <RendererSync />
        <FpsCounter onFps={onFps} />
      </Canvas>
    </div>
  );
}
