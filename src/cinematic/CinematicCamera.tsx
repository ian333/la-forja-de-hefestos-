// CinematicCamera.tsx — utilidades de cámara con PESO, 100% DETERMINISTAS en t.
//
// Doctrina de cine: la cámara nunca apunta perfecto. Le agregamos micro-temblor
// de baja frecuencia (suma de senos) y una inercia/lag suave para que se sienta
// que hay una mano (o una grúa pesada) sosteniéndola. El objeto puede salirse del
// encuadre: eso da escala y miedo.
//
// REGLA DURA: el render es frame a frame vía window.__cinematic*.renderAt(t).
// Todo aquí es función PURA de t. Cero aleatoriedad en runtime, cero reloj del
// sistema, cero caída al clock de three. Mismo t -> mismos números, siempre.
//
// Encaja con el patrón de CinematicGargantua.tsx: helpers tipo lerp/smooth/
// spherical/cameraAt y un Rig que muta la cámara en useFrame leyendo SOLO el t
// que le pasa la escena (no el clock).

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------

export type Vec3 = [number, number, number];

/** Estado de cámara que produce el programa de una escena en cada instante t. */
export interface CameraState {
  pos: Vec3;
  target: Vec3;
  fov?: number;
}

/** Lo que devuelve addWeight: posición y objetivo ya "pesados". */
export interface WeightedCamera {
  pos: Vec3;
  target: Vec3;
}

/** Una sola componente de temblor: un seno con su frecuencia, amplitud y fase. */
export interface ShakeComponent {
  /** Hz (ciclos por segundo de t). Frecuencias bajas = peso, no nervios. */
  freq: number;
  /** Amplitud en unidades de mundo. Pequeña. */
  amp: number;
  /** Fase en radianes — distinta por eje/componente para que no resuene. */
  phase: number;
}

export interface WeightOptions {
  /**
   * Amplitud global del micro-shake en la POSICIÓN de la cámara (unidades de
   * mundo). Escala todas las componentes posShake. Default 0.06.
   */
  posAmp?: number;
  /**
   * Amplitud global del micro-shake en el TARGET (a dónde mira). Suele ser
   * mayor que posAmp porque un pelín de deriva en el target se lee mucho.
   * Default 0.04.
   */
  targetAmp?: number;
  /**
   * Componentes de seno para el shake de posición. Por defecto 3 senos de
   * baja frecuencia y fases dispares (no múltiplos enteros) para que el patrón
   * no se repita de forma obvia.
   */
  posShake?: ShakeComponent[];
  /** Componentes de seno para el shake del target. */
  targetShake?: ShakeComponent[];
  /**
   * Inercia/lag suave hacia (basePos, lookTarget). 0 = sin lag (la cámara sigue
   * exacto al programa), ~0.85 = mucho arrastre. Es un suavizado determinista:
   * mezcla el estado actual con el objetivo en cada renderAt. Requiere state.
   */
  lag?: number;
  /**
   * Estado mutable para el lag (lo provee el Rig vía useRef). Si no se pasa,
   * el lag se ignora y addWeight queda como función pura sin memoria.
   */
  lagState?: LagState;
  /** dt determinista del frame (1/fps) para el filtrado del lag. Default 1/60. */
  dt?: number;
}

/** Memoria del filtro de inercia. Vive en un useRef del Rig. */
export interface LagState {
  pos: Vec3 | null;
  target: Vec3 | null;
}

// ----------------------------------------------------------------------------
// Helpers de easing — funciones puras, todas en [0,1] -> [0,1] salvo nota.
// ----------------------------------------------------------------------------

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** smoothstep clásico (Hermite C1). Mismo nombre que `smooth` en Gargantua. */
export function smooth(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** smootherstep de Ken Perlin (C2): arranca y frena más suave que smoothstep. */
export function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Cubic ease-in-out: peso al arrancar y al detener, sin la planicie de smooth. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Easing exponencial. k>0 acelera al final (ease-in), k<0 desacelera (ease-out).
 * Normalizado para que f(0)=0 y f(1)=1. Útil para "caer" hacia un horizonte.
 */
export function easeExp(t: number, k = 4): number {
  const x = clamp01(t);
  if (Math.abs(k) < 1e-6) return x; // lineal en el límite
  return (Math.exp(k * x) - 1) / (Math.exp(k) - 1);
}

// ----------------------------------------------------------------------------
// Coordenadas — mismo helper que Gargantua (azimut/elevación/radio).
// ----------------------------------------------------------------------------

/**
 * Posición cartesiana a partir de esféricas. theta = azimut (rad), phi =
 * elevación desde el plano XZ (rad), r = radio. Convención y-up.
 */
export function spherical(theta: number, phi: number, r: number): Vec3 {
  const cp = Math.cos(phi);
  return [r * cp * Math.sin(theta), r * Math.sin(phi), r * cp * Math.cos(theta)];
}

/**
 * cameraAt: posa una cámara dada (vector pos y target) sin shake. Aplica
 * pos/lookAt y, si se da, el fov. Equivalente al cameraAt de Gargantua, en
 * forma de utilidad reutilizable. NO usa clock: todo viene del caller.
 */
export function cameraAt(
  camera: THREE.PerspectiveCamera,
  pos: Vec3,
  target: Vec3,
  fov?: number,
): void {
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(target[0], target[1], target[2]);
  if (fov != null && camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

// ----------------------------------------------------------------------------
// Shake por defecto — 3 senos de baja frecuencia, fases irracionales-ish para
// que no resuenen ni se repita el patrón de forma legible.
// ----------------------------------------------------------------------------

const DEFAULT_POS_SHAKE: ShakeComponent[] = [
  { freq: 0.11, amp: 1.0, phase: 0.0 },
  { freq: 0.19, amp: 0.6, phase: 1.7 },
  { freq: 0.37, amp: 0.3, phase: 4.1 },
];

const DEFAULT_TARGET_SHAKE: ShakeComponent[] = [
  { freq: 0.13, amp: 1.0, phase: 2.3 },
  { freq: 0.23, amp: 0.55, phase: 0.9 },
  { freq: 0.41, amp: 0.28, phase: 5.2 },
];

/**
 * Evalúa una suma de senos en el instante t. Pura en t. Se desfasa por eje con
 * `axisPhase` para que X/Y/Z no tiemblen sincronizados (eso se ve robótico).
 */
function sumSines(comps: ShakeComponent[], t: number, axisPhase: number): number {
  let acc = 0;
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    acc += c.amp * Math.sin(2 * Math.PI * c.freq * t + c.phase + axisPhase);
  }
  return acc;
}

// Desfases por eje (constantes, deterministas) para romper la sincronía.
const AXIS_PHASE: Vec3 = [0.0, 2.094, 4.188]; // 0, 2π/3, 4π/3

// ----------------------------------------------------------------------------
// addWeight — el corazón. Suma micro-shake (pos + target) y lag opcional.
// ----------------------------------------------------------------------------

/**
 * Toma la pose base que produjo el programa de la escena en t y le agrega PESO:
 *  - micro-shake de baja frecuencia en posición y en target (suma de senos),
 *  - opcionalmente inercia/lag suave (necesita opts.lagState + opts.dt).
 *
 * Función PURA de t para el shake. El lag introduce memoria SOLO a través de
 * opts.lagState (un useRef del Rig); como el render avanza t de forma monótona
 * y determinista (t = frame/fps), el resultado sigue siendo 100% reproducible.
 *
 * @param basePos    posición que dictó el programa de la escena en t
 * @param lookTarget objetivo que dictó el programa de la escena en t
 * @param t          tiempo en segundos (el MISMO t del renderAt, no el clock)
 */
export function addWeight(
  basePos: Vec3,
  lookTarget: Vec3,
  t: number,
  opts: WeightOptions = {},
): WeightedCamera {
  const posAmp = opts.posAmp ?? 0.06;
  const targetAmp = opts.targetAmp ?? 0.04;
  const posShake = opts.posShake ?? DEFAULT_POS_SHAKE;
  const targetShake = opts.targetShake ?? DEFAULT_TARGET_SHAKE;

  // 1) Micro-shake, puro en t, desfasado por eje.
  let pos: Vec3 = [
    basePos[0] + posAmp * sumSines(posShake, t, AXIS_PHASE[0]),
    basePos[1] + posAmp * sumSines(posShake, t, AXIS_PHASE[1]),
    basePos[2] + posAmp * sumSines(posShake, t, AXIS_PHASE[2]),
  ];
  let target: Vec3 = [
    lookTarget[0] + targetAmp * sumSines(targetShake, t, AXIS_PHASE[0]),
    lookTarget[1] + targetAmp * sumSines(targetShake, t, AXIS_PHASE[1]),
    lookTarget[2] + targetAmp * sumSines(targetShake, t, AXIS_PHASE[2]),
  ];

  // 2) Inercia/lag opcional. Filtro exponencial determinista: el peso de la
  //    mezcla depende solo de (lag, dt), no del tiempo de pared.
  const lag = opts.lag ?? 0;
  const ls = opts.lagState;
  if (lag > 0 && ls) {
    const dt = opts.dt ?? 1 / 60;
    // alpha en [0,1]: cuánto nos acercamos al objetivo este frame. lag alto =>
    // alpha bajo => más arrastre. Independiente de fps gracias a la exp.
    const alpha = 1 - Math.pow(clamp01(lag), dt * 60);
    if (ls.pos == null || ls.target == null) {
      // Primer frame: sin historia, arrancamos pegados al objetivo.
      ls.pos = [pos[0], pos[1], pos[2]];
      ls.target = [target[0], target[1], target[2]];
    } else {
      ls.pos = lerp3(ls.pos, pos, alpha);
      ls.target = lerp3(ls.target, target, alpha);
    }
    pos = [ls.pos[0], ls.pos[1], ls.pos[2]];
    target = [ls.target[0], ls.target[1], ls.target[2]];
  }

  return { pos, target };
}

// ----------------------------------------------------------------------------
// Hook + Rig — toman un programAt(t) -> CameraState y le suman el peso.
// ----------------------------------------------------------------------------

export interface WeightedCameraOptions extends WeightOptions {
  /**
   * Fuente de tiempo determinista. En render offline la escena pasa el t del
   * renderAt aquí (p.ej. () => window.__cinematicBH.t). Si se omite, el Rig usa
   * state.clock SOLO para preview realtime — NUNCA en render (ahí pasa getT).
   */
  getT?: () => number;
}

/**
 * useWeightedCamera: hook imperativo. Llamarlo dentro de un componente bajo el
 * Canvas. Cada frame lee programAt(t), le suma addWeight y posa la cámara.
 *
 * Determinismo: si pasas opts.getT (el t del renderAt), el resultado es 100%
 * reproducible. El fallback a state.clock es solo para ver la escena en vivo.
 */
export function useWeightedCamera(
  programAt: (t: number) => CameraState,
  opts: WeightedCameraOptions = {},
): void {
  const { camera } = useThree();
  // Estado de lag persistente entre frames (no rompe el determinismo: t avanza
  // monótono y determinista en render).
  const lagState = useRef<LagState>({ pos: null, target: null });

  useFrame((state) => {
    const t = opts.getT ? opts.getT() : state.clock.elapsedTime;
    const prog = programAt(t);
    const { pos, target } = addWeight(prog.pos, prog.target, t, {
      ...opts,
      lagState: lagState.current,
    });
    // CORRECCIÓN DE FOV POR ASPECT RATIO (Hor+): los programAt fueron afinados para
    // 9:16 (aspect ≈ 0.5625). three.js usa FOV VERTICAL, así que en 16:9 (aspect
    // ancho) el mismo FOV vertical mostraría el sujeto gigante. Recalculamos el FOV
    // vertical para PRESERVAR el FOV horizontal que la composición pretendía → el
    // sujeto respira a lo ancho en landscape, sin re-afinar cada beat. Determinista
    // (solo depende del aspect del render y del prog.fov puro en t).
    let fov = prog.fov;
    const cam = camera as THREE.PerspectiveCamera;
    if (fov != null && cam.aspect) {
      const DESIGN_ASPECT = 9 / 16; // los programas se diseñaron para vertical 9:16
      if (Math.abs(cam.aspect - DESIGN_ASPECT) > 0.01) {
        // FOV horizontal que tendría la toma a 9:16, preservado al nuevo aspect.
        const hHalf = Math.atan(Math.tan((fov * Math.PI / 180) / 2) * DESIGN_ASPECT);
        fov = (2 * Math.atan(Math.tan(hHalf) / cam.aspect)) * 180 / Math.PI;
      }
    }
    cameraAt(cam, pos, target, fov);
  });
}

export interface WeightedRigProps extends WeightedCameraOptions {
  /** Programa de cámara de la escena: t -> {pos, fov?, target}. Puro en t. */
  programAt: (t: number) => CameraState;
}

/**
 * WeightedRig: componente declarativo equivalente. Úsalo dentro del <Canvas>:
 *
 *   <WeightedRig programAt={cameraProgram} getT={() => win.__cinematicBH.t}
 *                lag={0.6} posAmp={0.08} targetAmp={0.05} />
 *
 * Donde cameraProgram(t) usa spherical()/lerp3()/easeInOutCubic() etc. para
 * coreografiar la toma, y el Rig le agrega el temblor y la inercia.
 */
export function WeightedRig({ programAt, ...opts }: WeightedRigProps) {
  useWeightedCamera(programAt, opts);
  return null;
}
