/**
 * ⚒️ La Forja — Camera Transitions (Vuelo de Cámara)
 * ====================================================
 * Smooth animated camera transitions like Fusion 360's "fly to face".
 *
 * Works WITH the existing OrbitControls — temporarily overrides the
 * camera position and target with a smooth LERP, then releases back
 * to OrbitControls when the transition completes.
 *
 * Standard views: Front, Back, Top, Bottom, Left, Right, Isometric
 * Custom flyTo: position + target with configurable duration
 */

import { useRef, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Standard View Presets ──

export type StandardView = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right' | 'iso' | 'iso-back';

const DIST = 10;  // Default distance from origin

const VIEW_PRESETS: Record<StandardView, { position: [number, number, number]; target: [number, number, number] }> = {
  front:    { position: [0,  1,  DIST], target: [0, 1, 0] },
  back:     { position: [0,  1, -DIST], target: [0, 1, 0] },
  top:      { position: [0, DIST, 0.01], target: [0, 0, 0] },
  bottom:   { position: [0, -DIST, 0.01], target: [0, 0, 0] },
  left:     { position: [-DIST, 1, 0],  target: [0, 1, 0] },
  right:    { position: [ DIST, 1, 0],  target: [0, 1, 0] },
  iso:      { position: [6, 5, 8],      target: [0, 0.5, 0] },
  'iso-back': { position: [-6, 5, -8],  target: [0, 0.5, 0] },
};

// ── Easing Functions ──

/** Smooth ease-in-out (cubic) */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Camera Transition State ──

interface TransitionState {
  active: boolean;
  startTime: number;
  duration: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromFov: number;
  toFov: number;
}

// ── Hook: useFlyTo ──

/**
 * Returns a `flyTo` function that smoothly animates the camera.
 * Reads the current OrbitControls from `useThree().controls`.
 *
 * Usage:
 * ```tsx
 * const flyTo = useFlyTo();
 * flyTo('front');                           // Fly to standard view
 * flyTo([3, 5, 7], [0, 0, 0]);             // Custom position + target
 * flyTo('iso', 0.5);                        // Fly with custom duration (seconds)
 * ```
 */
export function useFlyTo() {
  const { camera, controls } = useThree();
  const transition = useRef<TransitionState>({
    active: false,
    startTime: 0,
    duration: 0.8,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    fromFov: 45,
    toFov: 45,
  });

  const flyTo = useCallback((
    viewOrPos: StandardView | [number, number, number],
    targetOrDuration?: [number, number, number] | number,
    maybeDuration?: number,
  ) => {
    const ctrl = controls as OrbitControlsImpl | null;
    let toPos: THREE.Vector3;
    let toTarget: THREE.Vector3;
    let duration = 0.8;

    if (typeof viewOrPos === 'string') {
      // Standard view preset
      const preset = VIEW_PRESETS[viewOrPos];
      if (!preset) return;
      toPos = new THREE.Vector3(...preset.position);
      toTarget = new THREE.Vector3(...preset.target);
      if (typeof targetOrDuration === 'number') duration = targetOrDuration;
    } else {
      // Custom [x,y,z] position
      toPos = new THREE.Vector3(...viewOrPos);
      toTarget = Array.isArray(targetOrDuration)
        ? new THREE.Vector3(...targetOrDuration)
        : ctrl?.target.clone() ?? new THREE.Vector3(0, 0, 0);
      if (typeof maybeDuration === 'number') duration = maybeDuration;
      else if (typeof targetOrDuration === 'number') duration = targetOrDuration;
    }

    // Disable damping during transition
    if (ctrl) ctrl.enabled = false;

    const t = transition.current;
    t.active = true;
    t.startTime = performance.now();
    t.duration = duration * 1000; // ms
    t.fromPos.copy(camera.position);
    t.toPos.copy(toPos);
    t.fromTarget.copy(ctrl?.target ?? new THREE.Vector3(0, 0, 0));
    t.toTarget.copy(toTarget);
    t.fromFov = (camera as THREE.PerspectiveCamera).fov ?? 45;
    t.toFov = 45;
  }, [camera, controls]);

  // Animate every frame
  useFrame(() => {
    const t = transition.current;
    if (!t.active) return;

    const elapsed = performance.now() - t.startTime;
    const progress = Math.min(elapsed / t.duration, 1);
    const eased = easeInOutCubic(progress);

    // Interpolate position, target, and FOV
    camera.position.lerpVectors(t.fromPos, t.toPos, eased);

    const ctrl = controls as OrbitControlsImpl | null;
    if (ctrl) {
      ctrl.target.lerpVectors(t.fromTarget, t.toTarget, eased);
    }

    // Restore FOV (fixes stuck pseudo-ortho from SketchModeController)
    if (camera instanceof THREE.PerspectiveCamera && t.fromFov !== t.toFov) {
      camera.fov = THREE.MathUtils.lerp(t.fromFov, t.toFov, eased);
    }
    camera.updateProjectionMatrix();

    // Complete
    if (progress >= 1) {
      t.active = false;
      if (ctrl) {
        ctrl.enabled = true;
        ctrl.update();
      }
    }
  });

  return flyTo;
}

// ── Component: ViewTransitionController ──

interface ViewTransitionControllerProps {
  /**
   * When this changes to a non-null value, triggers a fly-to animation.
   * Set to null after triggering to allow re-triggers of the same view.
   */
  targetView: StandardView | null;
  /** Called when transition completes */
  onComplete?: () => void;
  /** Transition duration in seconds */
  duration?: number;
}

/**
 * R3F component that listens for view changes and triggers smooth
 * camera transitions. Place inside <Canvas>.
 */
export default function ViewTransitionController({
  targetView,
  onComplete,
  duration = 0.8,
}: ViewTransitionControllerProps) {
  const flyTo = useFlyTo();
  const lastView = useRef<string | null>(null);

  useEffect(() => {
    if (targetView && targetView !== lastView.current) {
      lastView.current = targetView;
      flyTo(targetView, duration);
      // Notify completion after duration
      if (onComplete) {
        setTimeout(onComplete, duration * 1000 + 50);
      }
    }
  }, [targetView, flyTo, duration, onComplete]);

  return null;
}

// ── Export view presets for UI ──

export const STANDARD_VIEWS: { key: StandardView; label: string; icon: string; shortcut?: string }[] = [
  { key: 'front',    label: 'Frontal',     icon: '◻', shortcut: 'Num1' },
  { key: 'back',     label: 'Trasera',     icon: '◻', shortcut: 'Ctrl+1' },
  { key: 'top',      label: 'Superior',    icon: '◴', shortcut: 'Num7' },
  { key: 'bottom',   label: 'Inferior',    icon: '◵', shortcut: 'Ctrl+7' },
  { key: 'left',     label: 'Izquierda',   icon: '◧', shortcut: 'Num3' },
  { key: 'right',    label: 'Derecha',     icon: '◨', shortcut: 'Ctrl+3' },
  { key: 'iso',      label: 'Isométrica',  icon: '◇', shortcut: 'Num0' },
  { key: 'iso-back', label: 'Iso Trasera', icon: '◈' },
];
