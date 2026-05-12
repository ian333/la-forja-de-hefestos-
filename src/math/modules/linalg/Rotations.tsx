/**
 * Rotaciones SO(3) y cuaterniones — la misma rotación, dos parametrizaciones.
 *
 * Euler (yaw/pitch/roll): 3 ángulos. Intuitivo. SUFRE de GIMBAL LOCK cuando
 * pitch = ±90°: yaw y roll se vuelven la misma rotación, perdés un grado
 * de libertad.
 *
 * Cuaternión (w, x, y, z): 4 componentes con norma 1. NO sufre gimbal lock.
 * Es la cobertura doble de SO(3) — cada rotación tiene EXACTAMENTE dos
 * cuaterniones (q y -q).
 *
 * Slerp (spherical linear interpolation): interpolación suave entre dos
 * orientaciones. Es lo que usa todo motor de animación 3D moderno.
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

interface RotState {
  yaw: number;
  pitch: number;
  roll: number;
  mode: 'euler' | 'axis-angle';
  showAxes: boolean;
}

const LESSON: Lesson<RotState> = {
  hook: {
    title: 'En 3D, las rotaciones son MÁS difíciles que en 2D.',
    body: `En el plano, una rotación es UN número: el ángulo. Sumás ángulos, conmutativo. Fácil.

En 3D... no. Las rotaciones no conmutan (gira primero X 90° después Y 90°, vs Y 90° después X 90° — terminás en lugares distintos). Y necesitás 3 números para describirlas.

La parametrización "obvia" (yaw/pitch/roll) tiene un problema llamado GIMBAL LOCK: en ciertas configuraciones, perdés un grado de libertad. Si pitch = 90°, yaw y roll se confunden.

Hamilton (1843) inventó los CUATERNIONES para resolverlo. Hoy todo videojuego, dron y satélite los usa.

Esta clase te muestra ambos sistemas y dónde Euler FALLA.`,
  },

  steps: [
    {
      title: 'Sin rotación — los ejes XYZ',
      duration: 4500,
      body: `Empezamos con yaw=0, pitch=0, roll=0. La caja está orientada con los ejes mundo.

Las 3 flechas (roja=X, verde=Y, azul=Z) son los ejes LOCALES del objeto. En este momento coinciden con los ejes del mundo.

Esa es la convención: tu modelo tiene su propio "norte" — el eje Z apunta hacia adelante, X hacia la derecha, Y hacia arriba. Cuando rotás el objeto, esos ejes locales rotan con él.`,
      keyframes: [
        { at: 0, state: { yaw: 0, pitch: 0, roll: 0, mode: 'euler', showAxes: true } },
        { at: 1, state: { yaw: 0, pitch: 0, roll: 0, mode: 'euler', showAxes: true } },
      ],
    },
    {
      title: 'Yaw — rotar alrededor del eje vertical',
      duration: 5500,
      body: `Yaw es la rotación alrededor del eje Y (vertical mundial). Como cuando un avión apunta la nariz a la izquierda/derecha.

Voy de yaw=0 a yaw=π/2 (90°). Mirá: la caja gira en el plano horizontal. El eje X local (rojo) gira de "derecha" a "atrás".

Esta es la rotación más "natural" para nosotros — caminamos sobre la Tierra y giramos así. Por eso es la PRIMERA en orden de Euler.`,
      formula: 'R_y(yaw) = rotación alrededor de Y',
      keyframes: [
        { at: 0, state: { yaw: 0, pitch: 0, roll: 0, mode: 'euler', showAxes: true } },
        { at: 1, state: { yaw: Math.PI / 2, pitch: 0, roll: 0, mode: 'euler', showAxes: true } },
      ],
    },
    {
      title: 'Pitch — inclinar adelante/atrás',
      duration: 5500,
      body: `Pitch es la rotación alrededor del eje X local (después de yaw). Como cuando un avión sube/baja la nariz.

Voy a pitch=π/4 (45°) manteniendo yaw=π/2. Ahora la caja está rotada Y luego inclinada.

Notá que el ORDEN importa. Pitch en el frame local cambia según yaw. Es lo que se llama "rotaciones intrínsecas".`,
      formula: 'R = R_yaw · R_pitch · R_roll (orden YXZ)',
      keyframes: [
        { at: 0, state: { yaw: Math.PI / 2, pitch: 0, roll: 0, mode: 'euler', showAxes: true } },
        { at: 1, state: { yaw: Math.PI / 2, pitch: Math.PI / 4, roll: 0, mode: 'euler', showAxes: true } },
      ],
    },
    {
      title: 'GIMBAL LOCK — pitch = 90°',
      duration: 7000,
      body: `Ahora pitch = 90° (apuntando hacia arriba). Y luego intento variar yaw y roll.

¡MIRÁ! Yaw y Roll producen ESENCIALMENTE LA MISMA rotación. La caja gira alrededor de su propio eje vertical para AMBOS. Perdimos un grado de libertad — esto se llama GIMBAL LOCK.

Es un problema REAL. En la misión Apolo 11, los astronautas tenían que evitar configuraciones donde los giroscopios IMU sufrían gimbal lock — perdían su referencia inercial. Hubo procedimientos de emergencia para "destrabar" el sistema.

En videojuegos y animación, gimbal lock causa saltos visibles al interpolar rotaciones. Por eso TODO sistema serio usa cuaterniones.`,
      formula: 'Gimbal lock: pitch = ±π/2  ⇒  yaw y roll degenerados',
      keyframes: [
        { at: 0,    state: { yaw: 0,             pitch: Math.PI / 2, roll: 0, mode: 'euler', showAxes: true } },
        { at: 0.5,  state: { yaw: Math.PI,       pitch: Math.PI / 2, roll: 0, mode: 'euler', showAxes: true } },
        { at: 1,    state: { yaw: Math.PI,       pitch: Math.PI / 2, roll: Math.PI, mode: 'euler', showAxes: true } },
      ],
    },
    {
      title: 'Cuaternión — eje-ángulo, sin gimbal lock',
      duration: 6500,
      body: `Cambio a parametrización por EJE + ÁNGULO. Visualmente: especificás UN eje (cualquiera) y UN ángulo. La rotación es UNA rotación alrededor de ese eje.

Un cuaternión q = (cos(θ/2), sin(θ/2)·n̂) con n̂ = eje unitario.

Esta parametrización NUNCA sufre gimbal lock. Cualquier orientación = un eje único + un ángulo único (excepto identidad). 3 grados de libertad codificados en 4 números (la restricción |q|=1 los reduce a 3).

Mirá: voy de identidad a una rotación arbitraria. La rotación es UNA — suave, sin saltos, sin singularidades.`,
      formula: 'q = (cos(θ/2), sin(θ/2)·n̂)\n|q| = 1, q y -q son la misma rotación',
      keyframes: [
        { at: 0, state: { yaw: 0,             pitch: 0,            roll: 0,            mode: 'axis-angle', showAxes: true } },
        { at: 1, state: { yaw: Math.PI / 3,   pitch: Math.PI / 4,  roll: Math.PI / 6,  mode: 'axis-angle', showAxes: true } },
      ],
    },
  ],

  connect: {
    body: `SO(3) (grupo de rotaciones de ℝ³) es uno de los grupos de Lie más importantes:

• Mecánica clásica: orientación de cuerpos rígidos
• Cuántica: matrices de Pauli generan SU(2), cobertura doble de SO(3)
• Espines de partículas: spin-1/2 vive en SU(2), spin-1 en SO(3)
• Robótica: parametrización de poses de end-effectors
• Aeroespacial: actitud de satélites (cuaterniones evitan singularidades)
• Animación 3D: Slerp entre cuaterniones para movimiento suave
• Computer vision: estimación de pose desde puntos

Cuaterniones son la herramienta DE FACTO para rotaciones 3D. Los inventó Hamilton el 16 de octubre de 1843 caminando por un puente en Dublín — escribió la fórmula i² = j² = k² = ijk = -1 con su cuchillo en la piedra.`,
    links: [
      { label: 'Matrix 3D — toda la transformación', href: '#matrix-3d' },
      { label: 'Eigenvectores — el eje de rotación', href: '#eigen-3d' },
      { label: 'PCA — orientación de los datos', href: '#pca' },
    ],
  },
};

function applyRotation(yaw: number, pitch: number, roll: number): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
  return m;
}

export default function Rotations() {
  const { audience } = useAudience();
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [mode, setMode] = useState<'euler' | 'axis-angle'>('euler');
  const [showAxes, setShowAxes] = useState(true);

  const matrix = useMemo(() => applyRotation(yaw, pitch, roll), [yaw, pitch, roll]);

  // Compute quaternion + axis-angle representation for display
  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromRotationMatrix(matrix);
    return q;
  }, [matrix]);

  const axisAngle = useMemo(() => {
    const angle = 2 * Math.acos(Math.max(-1, Math.min(1, quat.w)));
    const s = Math.sqrt(Math.max(0, 1 - quat.w * quat.w));
    const axis = s < 1e-6
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(quat.x / s, quat.y / s, quat.z / s);
    return { axis, angle };
  }, [quat]);

  // Detect gimbal lock
  const inGimbalLock = Math.abs(Math.abs(pitch) - Math.PI / 2) < 0.05;

  // Box corners + axes vectors transformed
  const corners: [number, number, number][] = [
    [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
    [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],
  ];
  const tmp = new THREE.Vector3();
  const transformedCorners = corners.map(p => {
    tmp.set(p[0] * 0.8, p[1] * 0.5, p[2] * 0.8);
    tmp.applyMatrix4(matrix);
    return [tmp.x, tmp.y, tmp.z] as [number, number, number];
  });
  const edges: [number, number][] = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ];

  // Local axes
  const xAxis = new THREE.Vector3(1.3, 0, 0).applyMatrix4(matrix);
  const yAxis = new THREE.Vector3(0, 1.3, 0).applyMatrix4(matrix);
  const zAxis = new THREE.Vector3(0, 0, 1.3).applyMatrix4(matrix);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={5} bloomIntensity={0.55} bloomThreshold={0.55}>
          {/* World reference axes (dim) */}
          <Line points={[[-2, 0, 0], [2, 0, 0]]} color="#1E293B" lineWidth={0.5} />
          <Line points={[[0, -2, 0], [0, 2, 0]]} color="#1E293B" lineWidth={0.5} />
          <Line points={[[0, 0, -2], [0, 0, 2]]} color="#1E293B" lineWidth={0.5} />

          {/* Box edges */}
          {edges.map(([a, b], i) => (
            <Line
              key={i}
              points={[transformedCorners[a], transformedCorners[b]]}
              color="#4FC3F7"
              lineWidth={2}
            />
          ))}

          {/* Filled faces hint with translucent box */}
          <mesh>
            <boxGeometry args={[1.6, 1.0, 1.6]} />
            <meshStandardMaterial
              color="#4FC3F7"
              transparent
              opacity={0.18}
              metalness={0.2}
              roughness={0.7}
            />
            <primitive
              object={(() => {
                const m = new THREE.Object3D();
                m.matrixAutoUpdate = false;
                m.matrix = matrix;
                return m;
              })()}
              attach="userData"
            />
          </mesh>

          {/* Local axes */}
          {showAxes && (
            <>
              <Line points={[[0, 0, 0], [xAxis.x, xAxis.y, xAxis.z]]} color="#F472B6" lineWidth={3} />
              <mesh position={[xAxis.x, xAxis.y, xAxis.z]}>
                <coneGeometry args={[0.08, 0.18, 12]} />
                <meshStandardMaterial color="#F472B6" emissive="#F472B6" emissiveIntensity={1} />
              </mesh>

              <Line points={[[0, 0, 0], [yAxis.x, yAxis.y, yAxis.z]]} color="#34D399" lineWidth={3} />
              <mesh position={[yAxis.x, yAxis.y, yAxis.z]}>
                <coneGeometry args={[0.08, 0.18, 12]} />
                <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={1} />
              </mesh>

              <Line points={[[0, 0, 0], [zAxis.x, zAxis.y, zAxis.z]]} color="#FDB813" lineWidth={3} />
              <mesh position={[zAxis.x, zAxis.y, zAxis.z]}>
                <coneGeometry args={[0.08, 0.18, 12]} />
                <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={1} />
              </mesh>
            </>
          )}

          {/* Axis-angle: show the rotation axis */}
          {mode === 'axis-angle' && axisAngle.angle > 1e-4 && (
            <>
              <Line
                points={[
                  [-axisAngle.axis.x * 2, -axisAngle.axis.y * 2, -axisAngle.axis.z * 2],
                  [axisAngle.axis.x * 2, axisAngle.axis.y * 2, axisAngle.axis.z * 2],
                ]}
                color="#A78BFA"
                lineWidth={2}
                transparent
                opacity={0.7}
              />
              <mesh position={[axisAngle.axis.x * 1.8, axisAngle.axis.y * 1.8, axisAngle.axis.z * 1.8]}>
                <sphereGeometry args={[0.05, 16, 16]} />
                <meshStandardMaterial color="#A78BFA" emissive="#A78BFA" emissiveIntensity={1.2} />
              </mesh>
            </>
          )}
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#4FC3F7]">▢</span> caja</div>
          <div><span className="text-[#F472B6]">→</span> eje X local</div>
          <div><span className="text-[#34D399]">→</span> eje Y local</div>
          <div><span className="text-[#FDB813]">→</span> eje Z local</div>
          {mode === 'axis-angle' && <div><span className="text-[#A78BFA]">━</span> eje de rotación</div>}
          {inGimbalLock && <div className="text-[#EF5350] mt-1">⚠ GIMBAL LOCK</div>}
        </div>
      </div>

      <LessonPanel<RotState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.yaw !== undefined) setYaw(patch.yaw);
          if (patch.pitch !== undefined) setPitch(patch.pitch);
          if (patch.roll !== undefined) setRoll(patch.roll);
          if (patch.mode !== undefined) setMode(patch.mode);
          if (patch.showAxes !== undefined) setShowAxes(patch.showAxes);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Parametrización</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => setMode('euler')}
                  className={`text-[11px] px-2 py-1.5 rounded border ${
                    mode === 'euler' ? 'bg-[#7E57C2]/20 border-[#7E57C2]/60 text-white' : 'border-[#1E293B] text-[#94A3B8]'
                  }`}>Euler (YXZ)</button>
                <button onClick={() => setMode('axis-angle')}
                  className={`text-[11px] px-2 py-1.5 rounded border ${
                    mode === 'axis-angle' ? 'bg-[#7E57C2]/20 border-[#7E57C2]/60 text-white' : 'border-[#1E293B] text-[#94A3B8]'
                  }`}>Eje-ángulo</button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-[#94A3B8]">
                yaw (Y mundial) = <span className="text-[#34D399] font-mono">{(yaw * 180 / Math.PI).toFixed(1)}°</span>
                <input type="range" min={-Math.PI} max={Math.PI} step={0.01}
                  value={yaw}
                  onChange={e => setYaw(parseFloat(e.target.value))}
                  className="w-full accent-[#34D399]" />
              </label>
              <label className={`block text-[11px] mt-2 ${inGimbalLock ? 'text-[#EF5350]' : 'text-[#94A3B8]'}`}>
                pitch (X local) = <span className="text-[#F472B6] font-mono">{(pitch * 180 / Math.PI).toFixed(1)}°</span>
                {inGimbalLock && <span className="text-[10px] ml-2">¡gimbal lock!</span>}
                <input type="range" min={-Math.PI / 2 + 0.01} max={Math.PI / 2 - 0.01} step={0.01}
                  value={pitch}
                  onChange={e => setPitch(parseFloat(e.target.value))}
                  className="w-full accent-[#F472B6]" />
              </label>
              <label className="block text-[11px] text-[#94A3B8] mt-2">
                roll (Z local) = <span className="text-[#FDB813] font-mono">{(roll * 180 / Math.PI).toFixed(1)}°</span>
                <input type="range" min={-Math.PI} max={Math.PI} step={0.01}
                  value={roll}
                  onChange={e => setRoll(parseFloat(e.target.value))}
                  className="w-full accent-[#FDB813]" />
              </label>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1 text-[11px] font-mono">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">Cuaternión q</div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">w</span><span className="text-white">{quat.w.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">x</span><span className="text-white">{quat.x.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">y</span><span className="text-white">{quat.y.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">z</span><span className="text-white">{quat.z.toFixed(4)}</span></div>
              <div className="flex justify-between border-t border-[#1E293B] pt-1 mt-1">
                <span className="text-[#94A3B8]">|q|</span>
                <span className="text-[#34D399]">{Math.sqrt(quat.w**2 + quat.x**2 + quat.y**2 + quat.z**2).toFixed(4)}</span>
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1 text-[11px] font-mono">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">Eje + ángulo</div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">ángulo</span>
                <span className="text-white">{(axisAngle.angle * 180 / Math.PI).toFixed(2)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">eje</span>
                <span className="text-[#A78BFA]">({axisAngle.axis.x.toFixed(2)}, {axisAngle.axis.y.toFixed(2)}, {axisAngle.axis.z.toFixed(2)})</span>
              </div>
            </div>

            <button onClick={() => { setYaw(0); setPitch(0); setRoll(0); }}
              className="w-full text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#7E57C2]/40 hover:text-white">
              ↺ resetear a identidad
            </button>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Convención YXZ (Tait-Bryan). Gimbal lock cuando |pitch| → π/2. Cuaternión = cobertura doble S³ → SO(3).
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
