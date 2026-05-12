/**
 * Matrix 3×3 como transformación — Strang Lecture 1.
 *
 * "Una matriz se determina ENTERAMENTE por DÓNDE manda a los vectores base
 *  i = (1,0,0), j = (0,1,0), k = (0,0,1). Las columnas de A son A·i, A·j, A·k."
 *
 * El cubo unitario se transforma en un paralelepípedo. El det(A) = volumen
 * (con signo, negativo si A invierte orientación).
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

type Mat3 = [number, number, number, number, number, number, number, number, number];

interface MatLessonState {
  preset: string;
  progress: number;
}

const PRESETS: { id: string; label: string; M: Mat3; note: string }[] = [
  { id: 'identity', label: 'Identidad',
    M: [1,0,0, 0,1,0, 0,0,1], note: 'A = I. Nada cambia. det=1.' },
  { id: 'scale', label: 'Escala 2x en X',
    M: [2,0,0, 0,1,0, 0,0,1], note: 'Estira X por 2. det=2.' },
  { id: 'rotate-z', label: 'Rotación 45° Z',
    M: [Math.cos(Math.PI/4),-Math.sin(Math.PI/4),0, Math.sin(Math.PI/4),Math.cos(Math.PI/4),0, 0,0,1],
    note: 'Gira 45° alrededor de Z. Determinante = 1, no cambia volumen.' },
  { id: 'shear', label: 'Cizalla X←Y',
    M: [1,1,0, 0,1,0, 0,0,1], note: 'X += Y. det=1 (preserva volumen).' },
  { id: 'reflect', label: 'Reflexión XY',
    M: [1,0,0, 0,1,0, 0,0,-1], note: 'Z → -Z. det=-1 (invierte orientación).' },
  { id: 'project', label: 'Proyección al plano XY',
    M: [1,0,0, 0,1,0, 0,0,0], note: 'Aplasta Z. rango=2, det=0.' },
  { id: 'collapse', label: 'Colapso a una línea',
    M: [1,2,3, 2,4,6, 3,6,9], note: 'Todo a la diagonal (1,2,3). rango=1.' },
];

function det3(A: Mat3) {
  return (
    A[0] * (A[4] * A[8] - A[5] * A[7]) -
    A[1] * (A[3] * A[8] - A[5] * A[6]) +
    A[2] * (A[3] * A[7] - A[4] * A[6])
  );
}

function applyMat3(A: Mat3, v: THREE.Vector3, out: THREE.Vector3) {
  const x = v.x, y = v.y, z = v.z;
  out.set(
    A[0] * x + A[1] * y + A[2] * z,
    A[3] * x + A[4] * y + A[5] * z,
    A[6] * x + A[7] * y + A[8] * z,
  );
}

const LESSON: Lesson<MatLessonState> = {
  hook: {
    title: 'Una matriz es una FUNCIÓN — pero solo de un tipo: lineal.',
    body: `Una matriz 3×3 toma vectores 3D y los manda a otros vectores 3D. Es una función ℝ³ → ℝ³.

Pero NO cualquier función. Es LINEAL: respeta sumas y escalas. A(u + v) = Au + Av. A(cu) = c·Au.

Esa restricción tan simple tiene una consecuencia ENORME: la matriz queda 100% determinada por donde manda los 3 vectores base (i, j, k). Esas son sus 3 COLUMNAS.

Strang lo enseña en Lecture 1 del MIT: "el secreto del álgebra lineal es mirar las columnas". Esta clase te muestra exactamente eso.`,
  },

  steps: [
    {
      title: 'Identidad — nada cambia',
      duration: 4500,
      body: `A = I (matriz identidad). Sus columnas son (1,0,0), (0,1,0), (0,0,1) — exactamente i, j, k.

El cubo unitario se queda intacto. det(I) = 1.

Es el punto cero de transformaciones — todo lo demás es una "desviación" de la identidad.`,
      formula: 'I = [1 0 0; 0 1 0; 0 0 1]',
      keyframes: [
        { at: 0, state: { preset: 'identity', progress: 0 } },
        { at: 1, state: { preset: 'identity', progress: 1 } },
      ],
    },
    {
      title: 'Escala — estirando un eje',
      duration: 5000,
      body: `A = diag(2, 1, 1). La primera columna ahora es (2, 0, 0) — el vector i se estira a 2 veces su tamaño.

Mirá: el cubo se vuelve un paralelepípedo. Doble de ancho en X. Volumen doble.

det(A) = 2 · 1 · 1 = 2. EL DETERMINANTE ES EL FACTOR DE VOLUMEN. Eso es CIENTO POR CIENTO de lo que significa det(A): cuánto cambia el volumen.`,
      formula: 'A = diag(2,1,1)  ⇒  det = 2 = nuevo_vol / vol_original',
      keyframes: [
        { at: 0, state: { preset: 'scale', progress: 0 } },
        { at: 1, state: { preset: 'scale', progress: 1 } },
      ],
    },
    {
      title: 'Rotación — det = 1 (preserva volumen)',
      duration: 5500,
      body: `Rotación de 45° alrededor del eje Z. Los vectores giran pero NO se estiran.

Columna 1: (cos45°, sin45°, 0). Columna 2: (-sin45°, cos45°, 0). Columna 3: (0, 0, 1).

El cubo gira pero su volumen NO cambia. det(rotación) = 1 SIEMPRE. Esa es la definición de rotación: una transformación lineal con determinante +1 que preserva ángulos.`,
      formula: 'R(θ) preserva ángulos y volumen\ndet(R) = 1, R·Rᵀ = I',
      keyframes: [
        { at: 0, state: { preset: 'rotate-z', progress: 0 } },
        { at: 1, state: { preset: 'rotate-z', progress: 1 } },
      ],
    },
    {
      title: 'Reflexión — det = −1',
      duration: 5000,
      body: `A = diag(1, 1, -1). El eje Z se invierte: arriba ↔ abajo.

Mirá: el cubo se "voltea" en Z. det(A) = -1.

DETERMINANTE NEGATIVO = la transformación INVIERTE orientación (volvió izquierda → derecha, o sentido horario → antihorario). Es como mirar al espejo. No se puede llegar a este resultado con rotaciones puras — necesitás una reflexión.`,
      formula: 'det < 0  ⇒  orientación invertida',
      keyframes: [
        { at: 0, state: { preset: 'reflect', progress: 0 } },
        { at: 1, state: { preset: 'reflect', progress: 1 } },
      ],
    },
    {
      title: 'Proyección — det = 0 (degenerada)',
      duration: 5500,
      body: `A aplasta TODO al plano XY. La tercera columna es (0, 0, 0) — el vector k va al ORIGEN.

Mirá: el cubo 3D se vuelve un cuadrado 2D. PIERDE una dimensión. det(A) = 0.

DETERMINANTE CERO = la matriz NO es invertible. No hay forma de volver atrás: dos puntos distintos pueden mapearse al mismo lugar.

Esto importa: cuando resolvés Ax = b, si det(A) = 0, la solución NO es única (o no existe). Es el corazón de los sistemas lineales mal determinados.`,
      formula: 'det = 0  ⇒  matriz singular  ⇒  no invertible',
      keyframes: [
        { at: 0, state: { preset: 'project', progress: 0 } },
        { at: 1, state: { preset: 'project', progress: 1 } },
      ],
    },
    {
      title: 'Cizalla — la transformación trampa',
      duration: 5000,
      body: `A = [[1,1,0],[0,1,0],[0,0,1]]. Cizalla: X += Y.

El cubo se "inclina" pero su volumen NO cambia. det = 1.

¡Curioso! Cualquier matriz triangular con 1's en la diagonal tiene det=1. Las cizallas son SHEARS — transformaciones que cambian la forma pero NO el volumen, fundamentales en CAD, gráficos, deformaciones elásticas.`,
      formula: 'A = [[1,1,0],[0,1,0],[0,0,1]]  ⇒  det = 1',
      keyframes: [
        { at: 0, state: { preset: 'shear', progress: 0 } },
        { at: 1, state: { preset: 'shear', progress: 1 } },
      ],
    },
  ],

  connect: {
    body: `Las matrices 3×3 son las transformaciones lineales del espacio. Sus usos:

• Gráficos 3D: cada modelo se rota, escala, traslada con matrices (4×4 con homogéneas)
• Robótica: pose de un brazo se compone con matrices SE(3)
• Cristalografía: 230 grupos espaciales son transformaciones de matrices
• Mecánica: tensores de inercia, esfuerzo, deformación — todos son matrices simétricas 3×3
• Cuántica: operadores de spin son matrices 2×2 (Pauli) y 3×3 (rotaciones SU(2))
• Machine learning: cada capa de red neuronal es un Wx + b

El determinante te dice si la transformación es invertible y cómo cambia volumen. La siguiente clase (Eigenvectores) te muestra QUÉ DIRECCIONES preserva.`,
    links: [
      { label: 'Eigenvectores — direcciones invariantes', href: '#eigen-3d' },
      { label: 'Rotaciones SO(3) — el subgrupo de rotaciones', href: '#rotations' },
      { label: 'PCA — eigenvectores de la covarianza', href: '#pca' },
    ],
  },
};

const N_PER_AXIS = 7;
function buildCloud() {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < N_PER_AXIS; i++) {
    for (let j = 0; j < N_PER_AXIS; j++) {
      for (let k = 0; k < N_PER_AXIS; k++) {
        const x = (i / (N_PER_AXIS - 1)) * 2 - 1;
        const y = (j / (N_PER_AXIS - 1)) * 2 - 1;
        const z = (k / (N_PER_AXIS - 1)) * 2 - 1;
        pts.push(new THREE.Vector3(x, y, z));
      }
    }
  }
  return pts;
}

export default function Matrix3D() {
  const { audience } = useAudience();
  const [preset, setPreset] = useState('identity');
  const [M, setM] = useState<Mat3>(PRESETS[0].M);
  const [progress, setProgress] = useState(1);

  const cloud = useMemo(() => buildCloud(), []);
  const detA = useMemo(() => det3(M), [M]);

  function loadPreset(id: string) {
    const p = PRESETS.find(x => x.id === id);
    if (!p) return;
    setPreset(id);
    setM([...p.M] as Mat3);
  }

  // Columns of A — where i, j, k get mapped
  const col1 = new THREE.Vector3(M[0], M[3], M[6]);
  const col2 = new THREE.Vector3(M[1], M[4], M[7]);
  const col3 = new THREE.Vector3(M[2], M[5], M[8]);

  // Original i, j, k (gray) and transformed (colored, lerped)
  const lerpVec = (a: THREE.Vector3, b: THREE.Vector3, t: number) =>
    new THREE.Vector3(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t,
    );
  const iEnd = lerpVec(new THREE.Vector3(1, 0, 0), col1, progress);
  const jEnd = lerpVec(new THREE.Vector3(0, 1, 0), col2, progress);
  const kEnd = lerpVec(new THREE.Vector3(0, 0, 1), col3, progress);

  // Cube edges, transformed
  const tmpV = new THREE.Vector3();
  const tmpA = new THREE.Vector3();
  const corners: [number, number, number][] = [
    [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
    [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],
  ];
  const transformedCorners: [number, number, number][] = corners.map(p => {
    tmpV.set(p[0], p[1], p[2]);
    applyMat3(M, tmpV, tmpA);
    return [
      tmpV.x + (tmpA.x - tmpV.x) * progress,
      tmpV.y + (tmpA.y - tmpV.y) * progress,
      tmpV.z + (tmpA.z - tmpV.z) * progress,
    ];
  });
  const edges: [number, number][] = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ];

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={5.5} bloomIntensity={0.55} bloomThreshold={0.55}>
          {/* Reference axes */}
          <Line points={[[-2, 0, 0], [2, 0, 0]]} color="#334155" lineWidth={1} />
          <Line points={[[0, -2, 0], [0, 2, 0]]} color="#334155" lineWidth={1} />
          <Line points={[[0, 0, -2], [0, 0, 2]]} color="#334155" lineWidth={1} />

          {/* Original cube (gray, fades) */}
          {edges.map(([a, b], i) => (
            <Line
              key={`o${i}`}
              points={[corners[a], corners[b]]}
              color="#475569"
              lineWidth={1}
              transparent
              opacity={Math.max(0.1, 1 - progress * 0.9)}
            />
          ))}

          {/* Transformed cube */}
          {edges.map(([a, b], i) => (
            <Line
              key={`t${i}`}
              points={[transformedCorners[a], transformedCorners[b]]}
              color="#4FC3F7"
              lineWidth={1.5}
            />
          ))}

          {/* Point cloud */}
          {cloud.map((p, i) => {
            tmpV.set(p.x, p.y, p.z);
            applyMat3(M, tmpV, tmpA);
            const px = p.x + (tmpA.x - p.x) * progress;
            const py = p.y + (tmpA.y - p.y) * progress;
            const pz = p.z + (tmpA.z - p.z) * progress;
            return (
              <mesh key={i} position={[px, py, pz]}>
                <sphereGeometry args={[0.025, 6, 6]} />
                <meshStandardMaterial color="#4FC3F7" emissive="#1E40AF" emissiveIntensity={0.4} />
              </mesh>
            );
          })}

          {/* Column vectors of A — where i, j, k land */}
          <Line points={[[0, 0, 0], [iEnd.x, iEnd.y, iEnd.z]]} color="#F472B6" lineWidth={3} />
          <mesh position={[iEnd.x, iEnd.y, iEnd.z]}>
            <coneGeometry args={[0.07, 0.16, 12]} />
            <meshStandardMaterial color="#F472B6" emissive="#F472B6" emissiveIntensity={0.9} />
          </mesh>

          <Line points={[[0, 0, 0], [jEnd.x, jEnd.y, jEnd.z]]} color="#34D399" lineWidth={3} />
          <mesh position={[jEnd.x, jEnd.y, jEnd.z]}>
            <coneGeometry args={[0.07, 0.16, 12]} />
            <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={0.9} />
          </mesh>

          <Line points={[[0, 0, 0], [kEnd.x, kEnd.y, kEnd.z]]} color="#FDB813" lineWidth={3} />
          <mesh position={[kEnd.x, kEnd.y, kEnd.z]}>
            <coneGeometry args={[0.07, 0.16, 12]} />
            <meshStandardMaterial color="#FDB813" emissive="#FDB813" emissiveIntensity={0.9} />
          </mesh>
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#475569]">━</span> cubo original</div>
          <div><span className="text-[#4FC3F7]">━</span> A · cubo</div>
          <div><span className="text-[#F472B6]">→</span> A·i (col 1)</div>
          <div><span className="text-[#34D399]">→</span> A·j (col 2)</div>
          <div><span className="text-[#FDB813]">→</span> A·k (col 3)</div>
        </div>
      </div>

      <LessonPanel<MatLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.preset !== undefined) loadPreset(patch.preset);
          if (patch.progress !== undefined) setProgress(patch.progress);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Preset</div>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => loadPreset(p.id)}
                    className={`text-[11px] px-2 py-1.5 rounded border transition ${
                      preset === p.id
                        ? 'bg-[#7E57C2]/20 border-[#7E57C2]/60 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#7E57C2]/40'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-[#64748B] italic">
                {PRESETS.find(p => p.id === preset)?.note}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Matriz A</div>
              <div className="grid grid-cols-3 gap-1.5">
                {M.map((v, i) => (
                  <input
                    key={i}
                    type="number"
                    step={0.1}
                    value={v}
                    onChange={e => {
                      const n = [...M] as Mat3;
                      n[i] = parseFloat(e.target.value) || 0;
                      setM(n);
                      setPreset('custom');
                    }}
                    className="bg-[#05060A] border border-[#1E293B] rounded px-1.5 py-1 text-[11px] font-mono text-white focus:border-[#7E57C2] focus:outline-none"
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-[#94A3B8]">
                t (animación) = <span className="text-white font-mono">{progress.toFixed(2)}</span>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={progress}
                  onChange={e => setProgress(parseFloat(e.target.value))}
                  className="w-full accent-[#7E57C2]"
                />
              </label>
              <div className="text-[10px] text-[#64748B]">0 = identidad, 1 = A aplicada</div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1 text-[12px] font-mono">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">det(A)</span>
                <span className={detA < 0 ? 'text-[#F472B6]' : detA === 0 ? 'text-[#EF5350]' : 'text-white'}>
                  {detA.toFixed(4)}
                </span>
              </div>
              {detA === 0 && (
                <div className="text-[10px] text-[#EF5350]">⚠ singular — no invertible</div>
              )}
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                <strong className="text-[#CBD5E1]">Las columnas son la transformación.</strong>
                <p className="mt-1">A·i = primera columna, A·j = segunda, A·k = tercera. La matriz queda totalmente determinada por estos 3 vectores.</p>
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
