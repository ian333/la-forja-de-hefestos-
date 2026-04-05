/**
 * ⚒️ La Forja — Sketch Mode Controller (Fusion 360-style)
 * =========================================================
 * Orchestrates the full "enter sketch plane" experience:
 *
 *  1. Camera SLERP flight to face the selected plane
 *  2. Switch PerspectiveCamera → OrthographicCamera  
 *  3. Auto-zoom to fit the sketch bounding box (80% viewport fill)
 *  4. Ghost the model (fade to 15% opacity)
 *  5. ESC / deselect → reverse everything smoothly
 *
 * Lives inside the R3F <Canvas> as a null-rendering component.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FittedSlice } from '../sketch-fitting';

// ── Easing ──
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── Types ──
interface SketchModeState {
  active: boolean;
  phase: 'idle' | 'entering' | 'ortho' | 'exiting';
  startTime: number;
  duration: number;           // ms

  // Camera flight
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  toQuat: THREE.Quaternion;
  fromUp: THREE.Vector3;
  toUp: THREE.Vector3;

  // For restoring on exit
  savedPos: THREE.Vector3;
  savedTarget: THREE.Vector3;
  savedFov: number;

  // Ortho zoom
  orthoSize: number;

  // Ghosting
  originalMaterials: Map<THREE.Mesh, { opacity: number; transparent: boolean }>;
}

export interface SketchModeControllerProps {
  slice: FittedSlice | null;
  /** Ref to the group containing imported meshes, for ghosting */
  meshGroupRef?: { current: THREE.Group | null };
}

export default function SketchModeController({ slice, meshGroupRef }: SketchModeControllerProps) {
  const { camera, controls, size } = useThree();
  const state = useRef<SketchModeState>({
    active: false,
    phase: 'idle',
    startTime: 0,
    duration: 500,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    fromQuat: new THREE.Quaternion(),
    toQuat: new THREE.Quaternion(),
    fromUp: new THREE.Vector3(0, 1, 0),
    toUp: new THREE.Vector3(0, 1, 0),
    savedPos: new THREE.Vector3(6, 5, 8),
    savedTarget: new THREE.Vector3(0, 0, 0),
    savedFov: 45,
    orthoSize: 10,
    originalMaterials: new Map(),
  });

  const prevSlice = useRef<FittedSlice | null>(null);

  // ── Compute sketch bounding box in world space ──
  const computeSketchBounds = useCallback((s: FittedSlice): { center: THREE.Vector3; extentU: number; extentV: number } => {
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    for (const contour of s.contours) {
      for (const pt of contour.originalPoints) {
        minU = Math.min(minU, pt.x);
        maxU = Math.max(maxU, pt.x);
        minV = Math.min(minV, pt.y);
        maxV = Math.max(maxV, pt.y);
      }
    }

    // Fallback if empty
    if (!isFinite(minU)) { minU = -5; maxU = 5; minV = -5; maxV = 5; }

    const origin = new THREE.Vector3(...(s.planeOrigin ?? [0, 0, 0]));
    const u = new THREE.Vector3(...(s.uAxis ?? [1, 0, 0]));
    const v = new THREE.Vector3(...(s.vAxis ?? [0, 1, 0]));

    const centerU = (minU + maxU) / 2;
    const centerV = (minV + maxV) / 2;
    const center = origin.clone()
      .addScaledVector(u, centerU)
      .addScaledVector(v, centerV);

    return {
      center,
      extentU: (maxU - minU) * 0.5,
      extentV: (maxV - minV) * 0.5,
    };
  }, []);

  // ── Ghost model (set all meshes to low opacity) ──
  const ghostModel = useCallback((opacity: number) => {
    const group = meshGroupRef?.current;
    if (!group) return;

    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        const mat = obj.material;
        const s = state.current;

        // Save originals on first ghost
        if (opacity < 1 && !s.originalMaterials.has(obj)) {
          s.originalMaterials.set(obj, {
            opacity: mat.opacity,
            transparent: mat.transparent,
          });
        }

        mat.transparent = true;
        mat.opacity = opacity;
        mat.depthWrite = opacity > 0.5;
        mat.needsUpdate = true;
      }
    });
  }, [meshGroupRef]);

  // ── Restore model materials ──
  const restoreModel = useCallback(() => {
    const s = state.current;
    s.originalMaterials.forEach((orig, mesh) => {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.opacity = orig.opacity;
        mesh.material.transparent = orig.transparent;
        mesh.material.depthWrite = true;
        mesh.material.needsUpdate = true;
      }
    });
    s.originalMaterials.clear();
  }, []);

  // ── Choose a sensible "up" direction for the plane ──
  const computeUp = useCallback((normal: THREE.Vector3): THREE.Vector3 => {
    // Pick the world axis least parallel to the normal as "up"
    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);

    let worldUp: THREE.Vector3;
    if (absY >= absX && absY >= absZ) {
      // Normal is mostly Y → use Z as up
      worldUp = new THREE.Vector3(0, 0, normal.y > 0 ? 1 : -1);
    } else {
      // Normal is mostly X or Z → use Y as up
      worldUp = new THREE.Vector3(0, 1, 0);
    }

    // Ensure orthogonal to normal:  up = normalize(worldUp - dot(worldUp, normal) * normal)
    const dot = worldUp.dot(normal);
    worldUp.addScaledVector(normal, -dot).normalize();
    return worldUp;
  }, []);

  // ── ENTER sketch mode ──
  useEffect(() => {
    if (slice === prevSlice.current) return;
    const wasActive = prevSlice.current != null;
    prevSlice.current = slice;

    const ctrl = controls as OrbitControlsImpl | null;
    const s = state.current;

    if (slice && slice.uAxis && slice.vAxis && slice.planeOrigin) {
      // ── ENTERING sketch mode ──
      const origin = new THREE.Vector3(...slice.planeOrigin);
      const u = new THREE.Vector3(...slice.uAxis);
      const v = new THREE.Vector3(...slice.vAxis);
      const normal = new THREE.Vector3().crossVectors(u, v).normalize();

      // Compute bounds for auto-zoom
      const bounds = computeSketchBounds(slice);
      const padding = 1.25; // 25% padding around sketch
      const maxExtent = Math.max(bounds.extentU, bounds.extentV, 1) * 2 * padding;

      // For ortho: the "size" is half the visible height
      const aspect = size.width / size.height;
      s.orthoSize = maxExtent / 2;
      if (aspect < 1) s.orthoSize /= aspect;

      // Camera distance — far enough to see the whole model in perspective too
      const camDist = Math.max(maxExtent * 1.2, 5);

      // Save current camera state for return trip
      if (!wasActive) {
        s.savedPos.copy(camera.position);
        s.savedTarget.copy(ctrl?.target ?? new THREE.Vector3(0, 0, 0));
        if (camera instanceof THREE.PerspectiveCamera) {
          s.savedFov = camera.fov;
        }
      }

      // Target position & look
      s.fromPos.copy(camera.position);
      s.toPos.copy(bounds.center).addScaledVector(normal, camDist);
      s.fromTarget.copy(ctrl?.target ?? new THREE.Vector3(0, 0, 0));
      s.toTarget.copy(bounds.center);

      // Compute "up" for the target orientation
      s.toUp.copy(computeUp(normal));
      s.fromUp.copy(camera.up);

      // Quaternion slerp: compute target quaternion
      const tmpCam = new THREE.PerspectiveCamera();
      tmpCam.position.copy(s.toPos);
      tmpCam.up.copy(s.toUp);
      tmpCam.lookAt(bounds.center);
      tmpCam.updateMatrixWorld();
      s.fromQuat.copy(camera.quaternion);
      s.toQuat.copy(tmpCam.quaternion);

      // Disable orbit during flight
      if (ctrl) ctrl.enabled = false;

      s.phase = 'entering';
      s.startTime = performance.now();
      s.duration = 500;
      s.active = true;

      // Start ghosting
      ghostModel(0.15);

    } else if (!slice && wasActive) {
      // ── EXITING sketch mode ──
      if (ctrl) ctrl.enabled = false;

      s.fromPos.copy(camera.position);
      s.toPos.copy(s.savedPos);
      s.fromTarget.copy(ctrl?.target ?? new THREE.Vector3(0, 0, 0));
      s.toTarget.copy(s.savedTarget);
      s.fromQuat.copy(camera.quaternion);

      // Compute target quaternion for saved position
      const tmpCam = new THREE.PerspectiveCamera();
      tmpCam.position.copy(s.savedPos);
      tmpCam.up.set(0, 1, 0);
      tmpCam.lookAt(s.savedTarget);
      tmpCam.updateMatrixWorld();
      s.toQuat.copy(tmpCam.quaternion);
      s.fromUp.copy(camera.up);
      s.toUp.set(0, 1, 0);

      s.phase = 'exiting';
      s.startTime = performance.now();
      s.duration = 400;
      s.active = true;

      // Restore model
      restoreModel();
    }
  }, [slice, camera, controls, size, computeSketchBounds, computeUp, ghostModel, restoreModel]);

  // ── Per-frame animation ──
  useFrame(() => {
    const s = state.current;
    if (!s.active) return;

    const elapsed = performance.now() - s.startTime;
    const progress = Math.min(elapsed / s.duration, 1);
    const t = easeOutCubic(progress);
    const ctrl = controls as OrbitControlsImpl | null;

    if (s.phase === 'entering') {
      // Slerp quaternion for smooth rotation
      camera.quaternion.slerpQuaternions(s.fromQuat, s.toQuat, t);
      camera.position.lerpVectors(s.fromPos, s.toPos, t);
      camera.up.lerpVectors(s.fromUp, s.toUp, t).normalize();

      if (ctrl) {
        ctrl.target.lerpVectors(s.fromTarget, s.toTarget, t);
      }

      // Gradually narrow FOV for pseudo-ortho effect during flight
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = THREE.MathUtils.lerp(s.savedFov, 1, t * t); // fov→1 = near-ortho
        camera.updateProjectionMatrix();
      }

      if (progress >= 1) {
        // Snap to true orthographic-like narrow FOV
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = 1; // extremely narrow = effectively orthographic
          // Reposition camera far away with tiny FOV to match ortho size
          const normal = new THREE.Vector3().subVectors(s.toPos, s.toTarget).normalize();
          const orthoEquivDist = (s.orthoSize * 2) / (2 * Math.tan(THREE.MathUtils.degToRad(1) / 2));
          camera.position.copy(s.toTarget).addScaledVector(normal, orthoEquivDist);
          camera.updateProjectionMatrix();
        }
        s.phase = 'ortho';
        s.active = false;

        if (ctrl) {
          ctrl.enabled = true;
          ctrl.enableRotate = false; // Lock rotation in sketch mode — pan/zoom only
          ctrl.update();
        }
      }
    } else if (s.phase === 'exiting') {
      camera.quaternion.slerpQuaternions(s.fromQuat, s.toQuat, t);
      camera.position.lerpVectors(s.fromPos, s.toPos, t);
      camera.up.lerpVectors(s.fromUp, s.toUp, t).normalize();

      if (ctrl) {
        ctrl.target.lerpVectors(s.fromTarget, s.toTarget, t);
      }

      // Restore FOV
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = THREE.MathUtils.lerp(1, s.savedFov, t);
        camera.updateProjectionMatrix();
      }

      if (progress >= 1) {
        s.phase = 'idle';
        s.active = false;

        if (ctrl) {
          ctrl.enabled = true;
          ctrl.enableRotate = true;
          ctrl.update();
        }
      }
    }
  });

  return null;
}
