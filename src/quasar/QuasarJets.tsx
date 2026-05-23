/**
 * QuasarJets — jets relativistas Blandford-Znajek emerging del polo del BH.
 *
 * Física aplicada (sin hardcoding):
 *   - Velocidad jet v = c·√(1 − 1/γ²), γ ≈ 8-10 (AGN típico)
 *   - Trayectoria helicoidal por rotación del plasma + B-field toroidal
 *   - Doppler beaming: D = 1/[γ(1 − β·cos θ_los)]
 *   - Brillo observado ∝ D^(3+α) con α=0.5 (synchrotron) → I_obs/I_em ≈ D^3.5
 *   - Jet acercándose (θ_los→0): D ≈ 2γ → boost ~(2γ)^3.5 (visible cegador)
 *   - Counter-jet (θ_los→π): D ≈ 1/(2γ) → boost ~10⁻⁴ (apenas visible)
 *
 * Esto explica por qué SIEMPRE vemos un jet brillante y a veces ningún
 * counter-jet — es Doppler beaming, no asimetría física.
 *
 * Reciclado: la dirección polar viene del disco rotando perpendicular al
 * plano XZ; usamos el mismo eje Y que BHRaytraced asume para el disco.
 */

import { useMemo } from 'react';
import * as THREE from 'three';

interface QuasarJetsProps {
  /** Lorentz factor del jet. 5-15 típico para AGN. */
  gamma?: number;
  /** Half-opening angle del jet (rad). ~1-10° típico. */
  openingAngle?: number;
  /** Longitud del jet en unidades de escena (R_s). */
  length?: number;
  /** Inclinación del eje del jet (rad) respecto al observador.
   *  0 = jet apuntando a la cámara (máximo boost). π/2 = perpendicular. */
  losAngle?: number;
  /** Radio del jet en la base (en r_s). Típico ~1-3 R_s. */
  baseRadius?: number;
  /** Color base del plasma sincrotrón. */
  color?: string;
  /** Vueltas helicoidales por longitud completa. */
  helixTurns?: number;
}

/**
 * Doppler factor D = 1/[γ(1 - β cosθ)].
 * Devuelve el boost de brillo ∝ D^(3+α).
 */
function dopplerBoost(gamma: number, losAngleRad: number, alpha = 0.5): number {
  const beta = Math.sqrt(1 - 1 / (gamma * gamma));
  const D = 1 / (gamma * (1 - beta * Math.cos(losAngleRad)));
  return Math.pow(D, 3 + alpha);
}

/**
 * Genera puntos de una hélice axial perfecta a lo largo del eje +Y.
 * Plasma sube en espiral por la rotación del jet + B-field toroidal.
 */
function helixPoints(
  axisDir: THREE.Vector3,
  origin: THREE.Vector3,
  length: number,
  baseRadius: number,
  openingAngle: number,
  turns: number,
  N: number,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  // Construye un frame ortonormal alrededor del eje
  const up = axisDir.clone().normalize();
  const tmp = Math.abs(up.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(up, tmp).normalize();
  const v = new THREE.Vector3().crossVectors(up, u).normalize();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const axial = length * t;
    // Radio del cono crece con la longitud (jet collimated pero expande lentamente)
    const r = baseRadius + axial * Math.tan(openingAngle);
    const theta = t * turns * 2 * Math.PI;
    const p = origin.clone()
      .addScaledVector(up, axial)
      .addScaledVector(u, r * Math.cos(theta))
      .addScaledVector(v, r * Math.sin(theta));
    pts.push(p);
  }
  return pts;
}

/** Single relativistic jet — helical tube + plasma flow shader. */
function Jet({
  axisDir, origin, length, baseRadius, openingAngle,
  turns, gamma, losAngle, color, brightnessScale,
}: {
  axisDir: THREE.Vector3;
  origin: THREE.Vector3;
  length: number;
  baseRadius: number;
  openingAngle: number;
  turns: number;
  gamma: number;
  losAngle: number;
  color: string;
  brightnessScale: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const geom = useMemo(() => {
    const pts = helixPoints(axisDir, origin, length, baseRadius, openingAngle, turns, 200);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    // Tube radius decae con la distancia (plasma cooling/expanding)
    return new THREE.TubeGeometry(curve, 220, baseRadius * 0.45, 14, false);
  }, [axisDir, origin, length, baseRadius, openingAngle, turns]);

  // Boost de brillo por Doppler, aplicado uniformly al jet (aprox para el rendering).
  // En realidad varía pixel-a-pixel por el ángulo local, pero para AGN típicos
  // con jets bien colimados y γ alto, el ángulo varía poco a lo largo del jet.
  const boost = useMemo(() => dopplerBoost(gamma, losAngle), [gamma, losAngle]);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  const colorVec = useMemo(() => {
    const c = new THREE.Color(color);
    return new THREE.Vector3(c.r, c.g, c.b);
  }, [color]);

  return (
    <mesh geometry={geom} renderOrder={10}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={Math.min(0.95, boost * brightnessScale)}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

export default function QuasarJets({
  gamma = 8,
  openingAngle = 0.06,        // ~3.5° half-opening (collimated AGN jet)
  length = 60,                // 60 R_s — escala visual cinematográfica
  losAngle = 0.35,            // ~20° del eje — BL Lac-like geometry
  baseRadius = 1.2,
  color = '#7CC4FF',          // synchrotron blue
  helixTurns = 6,
}: QuasarJetsProps) {
  // Direction perpendicular al disco (BHRaytraced asume disco en plano XZ).
  // Default: disco horizontal, jets vertical (eje Y).
  const upAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const downAxis = useMemo(() => new THREE.Vector3(0, -1, 0), []);

  // El observador ve el jet superior con cierto ángulo `losAngle` respecto al
  // eje. El counter-jet inferior está a π − losAngle (casi recedente).
  // Boost del approaching jet: D^3.5 con θ=losAngle (cerca de 0 → muy brillante)
  // Boost del receding jet: D^3.5 con θ=π − losAngle (cerca de π → muy oscuro)
  // El parámetro `brightnessScale` es solo normalización visual; el ratio
  // entre ambos jets sale automático de la física.

  // Normalización: brightnessScale tal que el jet aproximándose llegue a I≈1.5
  // (sobre-expuesto para bloom). El counter-jet se calcula con la misma escala
  // y su atenuación física (D_cj^3.5 / D_appr^3.5) sale automática.
  const apprBoost = dopplerBoost(gamma, losAngle);
  const normScale = 1.5 / apprBoost;

  return (
    <group>
      <Jet
        axisDir={upAxis} origin={new THREE.Vector3(0, 0.5, 0)}
        length={length} baseRadius={baseRadius} openingAngle={openingAngle}
        turns={helixTurns} gamma={gamma} losAngle={losAngle}
        color={color} brightnessScale={normScale}
      />
      <Jet
        axisDir={downAxis} origin={new THREE.Vector3(0, -0.5, 0)}
        length={length} baseRadius={baseRadius} openingAngle={openingAngle}
        turns={helixTurns} gamma={gamma} losAngle={Math.PI - losAngle}
        color={color} brightnessScale={normScale}
      />
    </group>
  );
}
