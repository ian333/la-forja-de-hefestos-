/**
 * Eigenvectores 3D — Strang, Lecture 21.
 *
 *   A v = λ v
 *
 * "Las direcciones que la matriz NO rota." Editas A (3×3), ves cómo se
 * transforma una nube de puntos del cubo unitario, y los eigenvectores
 * aparecen como ejes invariantes coloreados.
 *
 * Para matrices simétricas usamos el método de Jacobi (siempre converge
 * a eigenvalores reales). Para no-simétricas usamos la solución cerrada
 * del polinomio característico — si las raíces son complejas, se muestran
 * las reales y el panel anuncia "par complejo".
 *
 * El "click" pedagógico: ver al cubo deformarse pero los ejes de los
 * eigenvectores quedarse quietos. det(A) = λ₁·λ₂·λ₃ = factor de volumen.
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

interface EigenState {
  preset: string;
  animProgress: number;
}

const LESSON: Lesson<EigenState> = {
  hook: {
    title: '¿Hay direcciones en el espacio que una matriz NO ROTA?',
    body: `Una matriz 3×3 transforma vectores. Toma un vector v, lo multiplica, y te devuelve otro vector. Generalmente lo gira, lo estira, o ambos.

PERO: para casi cualquier matriz, existen 3 direcciones especiales donde NO HAY ROTACIÓN. La matriz solo las ESTIRA (o las encoge). Esos vectores se llaman eigenvectores, y los factores de estiramiento son los eigenvalores.

Strang lo enseña en su Lecture 21 de MIT diciendo: "encuentra los ejes de la transformación". Esos ejes son la clave para entender lo que la matriz HACE realmente.

Esta clase te muestra esas direcciones invariantes en distintas matrices.`,
  },

  steps: [
    {
      title: 'Matriz diagonal — los ejes XYZ ya son eigenvectores',
      duration: 6000,
      body: `Empezamos simple: M = diag(2, 0.5, -1).

Una matriz diagonal estira CADA EJE por su valor de la diagonal. El eje X se estira por 2, el Y se encoge por 0.5, el Z se invierte por -1.

Mirá la animación: el cubo de puntos se deforma — alargado en X, aplastado en Y, espejado en Z.

Los eigenvectores son TRIVIALMENTE los 3 ejes: (1,0,0), (0,1,0), (0,0,1). Los eigenvalores son 2, 0.5, -1.

Esa es la forma más "limpia" que puede tener una matriz. Diagonalizar = encontrar la base donde tu matriz se ve así.`,
      formula: 'M = diag(2, 0.5, -1)\nλ = 2, 0.5, -1  con eigenvectores en X, Y, Z',
      keyframes: [
        { at: 0, state: { preset: 'diag', animProgress: 0 } },
        { at: 1, state: { preset: 'diag', animProgress: 1 } },
      ],
    },
    {
      title: 'Matriz simétrica — eigenvectores ORTOGONALES',
      duration: 6000,
      body: `Cambio a la matriz simétrica: M[i][j] = M[j][i]. Ejemplo: [[3,1,1],[1,2,1],[1,1,2]].

Algo profundo pasa: cuando una matriz es simétrica, sus 3 eigenvectores son MUTUAMENTE PERPENDICULARES. Esto es el TEOREMA ESPECTRAL.

Mirá los 3 ejes coloreados (rosa, verde, dorado): se encuentran en ángulos rectos.

Esto es por qué la simetría es tan importante en física. Tensores de inercia, matrices de covarianza, hessianas — todos simétricos. Sus eigenvectores definen "ejes principales" naturales.`,
      formula: "M simétrica  ⇒  eigenvectores ⊥ entre sí\n(teorema espectral)",
      keyframes: [
        { at: 0, state: { preset: 'sym', animProgress: 0 } },
        { at: 1, state: { preset: 'sym', animProgress: 1 } },
      ],
    },
    {
      title: 'Cizalla — UN solo eigenvector',
      duration: 5500,
      body: `Cambio a M = [[1,1,0],[0,1,0],[0,0,1]]. Esto es una CIZALLA: empuja X+= Y.

Aquí pasa algo raro: solo HAY UN eigenvector (la dirección X), aunque hay 3 eigenvalores iguales (todos = 1).

Esto se llama defectividad. La matriz no se puede diagonalizar — no hay base de eigenvectores.

En física: oscilaciones críticamente amortiguadas, modos resonantes. La cizalla es el ejemplo canónico de matriz "casi" diagonalizable pero no.`,
      formula: 'cizalla: λ = 1, 1, 1  pero solo 1 eigenvector real',
      keyframes: [
        { at: 0, state: { preset: 'shear', animProgress: 0 } },
        { at: 1, state: { preset: 'shear', animProgress: 1 } },
      ],
    },
    {
      title: 'Rotación pura — eigenvalores COMPLEJOS',
      duration: 5500,
      body: `Cambio a una rotación de 45° alrededor del eje Z.

En 3D, una rotación tiene UN solo eigenvector real: el eje de rotación. Los otros dos eigenvalores son COMPLEJOS (cos θ ± i sin θ).

Por eso el panel solo muestra UNO de los 3 eigenvalores reales: el del eje Z.

Pero la rotación es 100% real — no tiene nada imaginario en sí misma. Los complejos aparecen como herramienta de cálculo: en 2D, multiplicar por e^(iθ) ES rotar por θ. Los eigenvalores complejos son la huella matemática de la rotación.`,
      formula: 'rotación 45° Z\nλ = 1 (eje Z),  e^(±iπ/4) (rotación)',
      keyframes: [
        { at: 0, state: { preset: 'rotation', animProgress: 0 } },
        { at: 1, state: { preset: 'rotation', animProgress: 1 } },
      ],
    },
    {
      title: 'Matriz singular — det = 0',
      duration: 5500,
      body: `Última: M = [[1,2,3],[2,4,6],[3,6,9]]. Cada fila es múltiplo de (1,2,3).

det(M) = 0. La matriz APLASTA todo el espacio a una sola dimensión.

Mirá los puntos: el cubo se proyecta a una recta. Volumen → 0.

Uno de los eigenvalores es 0 (la dirección que se "muere"), y el otro es la magnitud del aplastamiento.

Las matrices singulares aparecen siempre que hay dependencia lineal: datos correlacionados (PCA), sistemas subdeterminados, rangos deficientes en regresión.`,
      formula: 'det(M) = 0  ⇒  un λ = 0  ⇒  M no es invertible',
      keyframes: [
        { at: 0, state: { preset: 'singular', animProgress: 0 } },
        { at: 1, state: { preset: 'singular', animProgress: 1 } },
      ],
    },
  ],

  connect: {
    body: `Los eigenvalores y eigenvectores son LA herramienta más usada en matemáticas aplicadas:

• PCA (análisis de componentes principales): los eigenvectores de la matriz de covarianza son los ejes naturales de tus datos
• PageRank de Google: el eigenvector dominante de la matriz de hipervínculos te dice la importancia de cada página
• Mecánica cuántica: los eigenvalores del Hamiltoniano SON los niveles de energía permitidos
• Vibraciones modales en ingeniería estructural: los modos propios de un puente son sus eigenvectores
• Compresión de imágenes (SVD): es la versión "rectangular" de la descomposición espectral

Si entendiste esto, ya entendiste el núcleo del álgebra lineal aplicada.`,
    links: [
      { label: 'Plano tangente — gradiente como dirección', href: '#tangent-plane' },
      { label: 'Möbius — transformaciones del plano complejo', href: '#mobius' },
      { label: 'Phase Portrait — eigenvalores deciden estabilidad', href: '#phase-portrait' },
    ],
  },
};

type Mat3 = [number, number, number, number, number, number, number, number, number];

// ── Numerical eigenvalues + eigenvectors for a 3×3 matrix ──────────────
// Closed-form via characteristic polynomial det(A − λI) = 0.

function trace(A: Mat3) { return A[0] + A[4] + A[8]; }
function det3(A: Mat3) {
  return (
    A[0] * (A[4] * A[8] - A[5] * A[7]) -
    A[1] * (A[3] * A[8] - A[5] * A[6]) +
    A[2] * (A[3] * A[7] - A[4] * A[6])
  );
}
function isSymmetric(A: Mat3, eps = 1e-9) {
  return Math.abs(A[1] - A[3]) < eps && Math.abs(A[2] - A[6]) < eps && Math.abs(A[5] - A[7]) < eps;
}

// Real cubic solver via trigonometric/Cardano method, for the characteristic
// polynomial λ³ − c2 λ² + c1 λ − c0 = 0 with real coefficients.
function solveCubic(c2: number, c1: number, c0: number): number[] {
  // depress: λ = t + c2/3 → t³ + p t + q = 0
  const a = -c2;
  const b = c1;
  const c = -c0;
  const p = b - a * a / 3;
  const q = (2 * a * a * a) / 27 - (a * b) / 3 + c;
  const D = q * q / 4 + p * p * p / 27;
  const offset = -a / 3;
  if (D > 1e-12) {
    // One real root
    const s = Math.sqrt(D);
    const u = Math.cbrt(-q / 2 + s);
    const v = Math.cbrt(-q / 2 - s);
    return [u + v + offset];
  }
  // Three real roots — trigonometric form
  const r = Math.sqrt(-p * p * p / 27);
  const cosPhi = Math.max(-1, Math.min(1, -q / (2 * r)));
  const phi = Math.acos(cosPhi);
  const mag = 2 * Math.cbrt(r);
  return [
    mag * Math.cos(phi / 3) + offset,
    mag * Math.cos((phi + 2 * Math.PI) / 3) + offset,
    mag * Math.cos((phi + 4 * Math.PI) / 3) + offset,
  ];
}

// Solve (A − λI) v = 0 for v, given an eigenvalue λ. Returns a unit vector.
function eigvecForLambda(A: Mat3, lam: number): [number, number, number] | null {
  const M: Mat3 = [
    A[0] - lam, A[1], A[2],
    A[3], A[4] - lam, A[5],
    A[6], A[7], A[8] - lam,
  ];
  // Take cross product of two rows of M to find vector orthogonal to both
  // → that's in the null space of M (assuming rank 2).
  const rows: [number, number, number][] = [
    [M[0], M[1], M[2]],
    [M[3], M[4], M[5]],
    [M[6], M[7], M[8]],
  ];
  let best: [number, number, number] | null = null;
  let bestLen = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      const r1 = rows[i], r2 = rows[j];
      const v: [number, number, number] = [
        r1[1] * r2[2] - r1[2] * r2[1],
        r1[2] * r2[0] - r1[0] * r2[2],
        r1[0] * r2[1] - r1[1] * r2[0],
      ];
      const L = Math.hypot(v[0], v[1], v[2]);
      if (L > bestLen) { bestLen = L; best = v; }
    }
  }
  if (!best || bestLen < 1e-8) return null;
  return [best[0] / bestLen, best[1] / bestLen, best[2] / bestLen];
}

interface Eig {
  values: number[];                          // 1 or 3 real eigenvalues
  vectors: ([number, number, number] | null)[];
  complex: boolean;                          // true if char poly has complex roots
}

function eigen(A: Mat3): Eig {
  const tr = trace(A);
  // c2 = tr(A), c1 = (tr² − tr(A²))/2, c0 = det(A)
  const A2: Mat3 = [
    A[0] * A[0] + A[1] * A[3] + A[2] * A[6],
    A[0] * A[1] + A[1] * A[4] + A[2] * A[7],
    A[0] * A[2] + A[1] * A[5] + A[2] * A[8],
    A[3] * A[0] + A[4] * A[3] + A[5] * A[6],
    A[3] * A[1] + A[4] * A[4] + A[5] * A[7],
    A[3] * A[2] + A[4] * A[5] + A[5] * A[8],
    A[6] * A[0] + A[7] * A[3] + A[8] * A[6],
    A[6] * A[1] + A[7] * A[4] + A[8] * A[7],
    A[6] * A[2] + A[7] * A[5] + A[8] * A[8],
  ];
  const c1 = (tr * tr - trace(A2)) / 2;
  const c0 = det3(A);
  const lams = solveCubic(tr, c1, c0);
  const complex = lams.length === 1;
  return {
    values: lams,
    vectors: lams.map(l => eigvecForLambda(A, l)),
    complex,
  };
}

function applyMat3(A: Mat3, v: THREE.Vector3, out: THREE.Vector3) {
  const x = v.x, y = v.y, z = v.z;
  out.set(
    A[0] * x + A[1] * y + A[2] * z,
    A[3] * x + A[4] * y + A[5] * z,
    A[6] * x + A[7] * y + A[8] * z,
  );
}

// ── Cloud of points (cube of integer-grid points) ─────────────────────

const N_PER_AXIS = 9;
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

// ── Presets ───────────────────────────────────────────────────────────

const PRESETS: { id: string; label: string; M: Mat3 }[] = [
  { id: 'diag',     label: 'Diagonal (3 ejes)',    M: [2, 0, 0,  0, 0.5, 0,  0, 0, -1] },
  { id: 'sym',      label: 'Simétrica',            M: [3, 1, 1,  1, 2, 1,  1, 1, 2] },
  { id: 'shear',    label: 'Cizalla',              M: [1, 1, 0,  0, 1, 0,  0, 0, 1] },
  { id: 'rotation', label: 'Rotación 45° Z',       M: [Math.cos(Math.PI / 4), -Math.sin(Math.PI / 4), 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4), 0, 0, 0, 1] },
  { id: 'reflect',  label: 'Reflexión XY',         M: [1, 0, 0,  0, 1, 0,  0, 0, -1] },
  { id: 'singular', label: 'Singular (det=0)',     M: [1, 2, 3,  2, 4, 6,  3, 6, 9] },
];

// ── Component ─────────────────────────────────────────────────────────

const EIG_COLORS = ['#F472B6', '#34D399', '#FDB813']; // rose, green, gold

export default function EigenVectors3D() {
  const { audience } = useAudience();
  const [preset, setPreset] = useState('sym');
  const [M, setM] = useState<Mat3>(PRESETS[1].M);
  const [animProgress, setAnimProgress] = useState(1);   // 0 = identity, 1 = full A
  const [animPlaying, setAnimPlaying] = useState(false);

  const cloud = useMemo(() => buildCloud(), []);
  const eig = useMemo(() => eigen(M), [M]);
  const detA = useMemo(() => det3(M), [M]);

  function loadPreset(id: string) {
    const p = PRESETS.find(p => p.id === id);
    if (!p) return;
    setPreset(id);
    setM([...p.M] as Mat3);
  }
  function update(idx: number, val: number) {
    const next = [...M] as Mat3;
    next[idx] = val;
    setM(next);
    setPreset('custom');
  }

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      {/* 3D Stage */}
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={5} bloomIntensity={0.6} bloomThreshold={0.5}>
          <AxesScene />
          <PointCloud points={cloud} M={M} progress={animProgress} animPlaying={animPlaying} setAnimProgress={setAnimProgress} />
          <CubeOutline M={M} progress={animProgress} />
          {eig.vectors.map((v, i) => v && (
            <EigenAxis
              key={i}
              direction={v}
              lambda={eig.values[i]}
              color={EIG_COLORS[i % 3]}
              animProgress={animProgress}
            />
          ))}
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#94A3B8]">━</span> cubo original (gris)</div>
          <div><span className="text-[#4FC3F7]">━</span> A · cubo (azul)</div>
          {eig.vectors.map((v, i) => v && (
            <div key={i} style={{ color: EIG_COLORS[i % 3] }}>
              <span>↔</span> eigenvector λ = {eig.values[i].toFixed(3)}
            </div>
          ))}
        </div>
      </div>

      <LessonPanel<EigenState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.preset !== undefined) loadPreset(patch.preset);
          if (patch.animProgress !== undefined) setAnimProgress(patch.animProgress);
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
                    onChange={e => update(i, parseFloat(e.target.value) || 0)}
                    className="bg-[#05060A] border border-[#1E293B] rounded px-1.5 py-1 text-[11px] font-mono text-white focus:border-[#7E57C2] focus:outline-none"
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Animación</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAnimPlaying(p => !p)}
                  className="px-2 py-1 rounded border border-[#1E293B] text-[11px] text-white hover:border-[#7E57C2]/50"
                >
                  {animPlaying ? '⏸ pausa' : '▶ play'}
                </button>
                <input
                  type="range" min={0} max={1} step={0.005}
                  value={animProgress}
                  onChange={e => { setAnimProgress(parseFloat(e.target.value)); setAnimPlaying(false); }}
                  className="flex-1 accent-[#7E57C2]"
                />
                <span className="text-[10px] font-mono text-[#94A3B8] w-8">{animProgress.toFixed(2)}</span>
              </div>
              <div className="text-[10px] text-[#64748B] mt-1">t=0 identidad → t=1 aplicación de A</div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1 text-[12px] font-mono">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">det(A)</span>
                <span className={detA < 0 ? 'text-[#F472B6]' : 'text-white'}>{detA.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">tr(A)</span>
                <span className="text-white">{trace(M).toFixed(4)}</span>
              </div>
              {isSymmetric(M) && (
                <div className="text-[10px] text-[#34D399]">✓ A simétrica → eigenvectores ortogonales</div>
              )}
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Eigenvalores</div>
              {eig.complex && (
                <div className="text-[10px] text-[#FDB813]">· 1 real, 2 complejos (no se muestran)</div>
              )}
              {eig.values.map((lam, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                  <span style={{ color: EIG_COLORS[i % 3] }}>λ{i + 1}</span>
                  <span className="text-white flex-1">= {lam.toFixed(4)}</span>
                  {eig.vectors[i] && (
                    <span className="text-[#94A3B8]">
                      v=({eig.vectors[i]!.map(x => x.toFixed(2)).join(', ')})
                    </span>
                  )}
                </div>
              ))}
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Polinomio característico cerrado + cross-product de filas. Anim interpola identidad → A.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function AxesScene() {
  return (
    <>
      <Line points={[[-2, 0, 0], [2, 0, 0]]} color="#334155" lineWidth={1} />
      <Line points={[[0, -2, 0], [0, 2, 0]]} color="#334155" lineWidth={1} />
      <Line points={[[0, 0, -2], [0, 0, 2]]} color="#334155" lineWidth={1} />
    </>
  );
}

function PointCloud({
  points, M, progress, animPlaying, setAnimProgress,
}: {
  points: THREE.Vector3[];
  M: Mat3;
  progress: number;
  animPlaying: boolean;
  setAnimProgress: (v: number) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const tmpV = useRef(new THREE.Vector3());
  const tmpT = useRef(new THREE.Vector3());
  const tmpQ = useRef(new THREE.Quaternion());
  const tmpS = useRef(new THREE.Vector3(0.06, 0.06, 0.06));
  const tmpMat = useRef(new THREE.Matrix4());

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = progress;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      applyMat3(M, p, tmpV.current);
      tmpT.current.lerpVectors(p, tmpV.current, t);
      tmpMat.current.compose(tmpT.current, tmpQ.current, tmpS.current);
      mesh.setMatrixAt(i, tmpMat.current);
    }
    mesh.instanceMatrix.needsUpdate = true;

    if (animPlaying) {
      const next = (progress + 0.01) % 2;
      const tri = next < 1 ? next : 2 - next; // triangle wave 0..1..0
      setAnimProgress(tri);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, points.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color="#4FC3F7"
        emissive="#1E40AF"
        emissiveIntensity={0.4}
        roughness={0.4}
      />
    </instancedMesh>
  );
}

function CubeOutline({ M, progress }: { M: Mat3; progress: number }) {
  const lines = useMemo(() => {
    // 12 edges of unit cube
    const v: [number, number, number][] = [
      [-1, -1, -1], [+1, -1, -1], [+1, +1, -1], [-1, +1, -1],
      [-1, -1, +1], [+1, -1, +1], [+1, +1, +1], [-1, +1, +1],
    ];
    const edges: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    return { v, edges };
  }, []);

  // Compute transformed corners (lerped by progress)
  const tmpV = new THREE.Vector3();
  const tmpA = new THREE.Vector3();
  const corners: [number, number, number][] = lines.v.map(p => {
    tmpV.set(p[0], p[1], p[2]);
    applyMat3(M, tmpV, tmpA);
    return [
      tmpV.x + (tmpA.x - tmpV.x) * progress,
      tmpV.y + (tmpA.y - tmpV.y) * progress,
      tmpV.z + (tmpA.z - tmpV.z) * progress,
    ];
  });

  return (
    <>
      {/* Original (gray, full opacity when progress→0) */}
      {lines.edges.map(([a, b], i) => (
        <Line
          key={`o${i}`}
          points={[lines.v[a], lines.v[b]]}
          color="#475569"
          lineWidth={1}
          transparent
          opacity={Math.max(0.15, 1 - progress * 0.85)}
        />
      ))}
      {/* Transformed cube */}
      {lines.edges.map(([a, b], i) => (
        <Line
          key={`t${i}`}
          points={[corners[a], corners[b]]}
          color="#4FC3F7"
          lineWidth={1.5}
        />
      ))}
    </>
  );
}

function EigenAxis({
  direction, lambda, color, animProgress,
}: {
  direction: [number, number, number];
  lambda: number;
  color: string;
  animProgress: number;
}) {
  // Show as a double-ended arrow along the eigenvector. Length is scaled
  // by |λ| so visually larger λ = longer axis.
  const len = Math.min(3, 1 + Math.abs(lambda) * 0.4);
  const d = direction;
  const tip: [number, number, number] = [d[0] * len, d[1] * len, d[2] * len];
  const back: [number, number, number] = [-d[0] * len, -d[1] * len, -d[2] * len];
  // Lerp opacity in with animation so eigenvectors fade in
  const opacity = 0.25 + 0.75 * animProgress;
  const labelPos: [number, number, number] = [d[0] * (len + 0.35), d[1] * (len + 0.35), d[2] * (len + 0.35)];

  return (
    <>
      <Line points={[back, tip]} color={color} lineWidth={3} transparent opacity={opacity} />
      <mesh position={tip}>
        <coneGeometry args={[0.1, 0.25, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>
      {/* Tip marker — visual cue at the eigenvector tip (label rendered via DOM overlay) */}
      <mesh position={labelPos}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
    </>
  );
}
