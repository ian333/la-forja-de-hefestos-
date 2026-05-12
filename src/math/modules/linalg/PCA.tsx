/**
 * PCA — Análisis de componentes principales.
 *
 * Tomás datos 3D, computás la matriz de covarianza Σ = (Xᵀ X)/N, y
 * encontrás sus eigenvectores. Los eigenvectores SON las direcciones
 * de máxima varianza (componentes principales). Los eigenvalores son
 * cuánta varianza explica cada uno.
 *
 * Útil para: reducción de dimensionalidad, compresión, detección
 * de patrones, regresión robusta, eigenfaces.
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

interface PcaState {
  preset: string;
  showEllipsoid: boolean;
  showAxes: boolean;
  showProjection: boolean;
}

type Mat3 = [number, number, number, number, number, number, number, number, number];

// Generate correlated Gaussian point cloud
function makeCloud(preset: string, N = 500): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  // Box-Muller for normal samples
  const randn = () => {
    const u1 = Math.random(), u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  let stretch: [number, number, number];
  let rotateBy: number;
  let rotateAxis: 'x' | 'y' | 'z';

  switch (preset) {
    case 'isotropic':
      stretch = [1, 1, 1]; rotateBy = 0; rotateAxis = 'z'; break;
    case 'pancake':
      stretch = [2.5, 2.5, 0.3]; rotateBy = 0.5; rotateAxis = 'x'; break;
    case 'cigar':
      stretch = [3, 0.4, 0.4]; rotateBy = 0.8; rotateAxis = 'y'; break;
    case 'tilted':
      stretch = [2.5, 1.5, 0.6]; rotateBy = Math.PI / 4; rotateAxis = 'z'; break;
    case 'line':
      stretch = [3, 0.05, 0.05]; rotateBy = Math.PI / 3; rotateAxis = 'y'; break;
    default:
      stretch = [1.5, 0.8, 0.5]; rotateBy = 0; rotateAxis = 'z';
  }

  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3(
      randn() * stretch[0],
      randn() * stretch[1],
      randn() * stretch[2],
    );
    if (rotateBy !== 0) {
      const m = new THREE.Matrix4();
      if (rotateAxis === 'x') m.makeRotationX(rotateBy);
      else if (rotateAxis === 'y') m.makeRotationY(rotateBy);
      else m.makeRotationZ(rotateBy);
      v.applyMatrix4(m);
    }
    pts.push(v);
  }
  return pts;
}

// Compute covariance + eigenvectors (Jacobi, exact for symmetric)
function pca(points: THREE.Vector3[]) {
  const N = points.length;
  // Center the data
  const mean = new THREE.Vector3();
  for (const p of points) mean.add(p);
  mean.divideScalar(N);

  // Covariance matrix (symmetric 3×3)
  let cxx = 0, cyy = 0, czz = 0, cxy = 0, cxz = 0, cyz = 0;
  for (const p of points) {
    const dx = p.x - mean.x, dy = p.y - mean.y, dz = p.z - mean.z;
    cxx += dx * dx; cyy += dy * dy; czz += dz * dz;
    cxy += dx * dy; cxz += dx * dz; cyz += dy * dz;
  }
  cxx /= N; cyy /= N; czz /= N; cxy /= N; cxz /= N; cyz /= N;
  const cov: Mat3 = [cxx, cxy, cxz, cxy, cyy, cyz, cxz, cyz, czz];

  // Jacobi eigen-decomposition (3×3 symmetric)
  const eigs = jacobiEigen3(cov);

  // Sort by eigenvalue descending
  const idx = [0, 1, 2].sort((a, b) => eigs.vals[b] - eigs.vals[a]);
  const vals = idx.map(i => eigs.vals[i]);
  const vecs = idx.map(i => eigs.vecs[i]);

  return { mean, cov, vals, vecs };
}

function jacobiEigen3(A: Mat3): { vals: number[]; vecs: THREE.Vector3[] } {
  // Copy A into a workable form
  let a: number[][] = [
    [A[0], A[1], A[2]],
    [A[3], A[4], A[5]],
    [A[6], A[7], A[8]],
  ];
  const v: number[][] = [[1,0,0],[0,1,0],[0,0,1]];
  for (let iter = 0; iter < 50; iter++) {
    // Find largest off-diagonal element
    let p = 0, q = 1, maxVal = Math.abs(a[0][1]);
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        if (Math.abs(a[i][j]) > maxVal) {
          maxVal = Math.abs(a[i][j]);
          p = i; q = j;
        }
      }
    }
    if (maxVal < 1e-12) break;

    const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
    const t = theta >= 0
      ? 1 / (theta + Math.sqrt(1 + theta * theta))
      : 1 / (theta - Math.sqrt(1 + theta * theta));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;

    // Update a
    const newA = a.map(row => row.slice());
    newA[p][p] = a[p][p] - t * a[p][q];
    newA[q][q] = a[q][q] + t * a[p][q];
    newA[p][q] = newA[q][p] = 0;
    for (let i = 0; i < 3; i++) {
      if (i !== p && i !== q) {
        newA[i][p] = newA[p][i] = c * a[i][p] - s * a[i][q];
        newA[i][q] = newA[q][i] = c * a[i][q] + s * a[i][p];
      }
    }
    a = newA;

    // Update v
    for (let i = 0; i < 3; i++) {
      const vip = v[i][p], viq = v[i][q];
      v[i][p] = c * vip - s * viq;
      v[i][q] = s * vip + c * viq;
    }
  }
  return {
    vals: [a[0][0], a[1][1], a[2][2]],
    vecs: [
      new THREE.Vector3(v[0][0], v[1][0], v[2][0]),
      new THREE.Vector3(v[0][1], v[1][1], v[2][1]),
      new THREE.Vector3(v[0][2], v[1][2], v[2][2]),
    ],
  };
}

const PRESETS = [
  { id: 'isotropic', label: 'Isotrópica (esfera)', note: 'σ uniforme → 3 eigenvalores iguales, sin dirección preferente.' },
  { id: 'pancake',   label: 'Pancake (2D)',        note: 'Aplastada en una dimensión → 2 eigenvalores grandes, 1 chico.' },
  { id: 'cigar',     label: 'Cigarro (1D)',        note: 'Alargada en una dimensión → 1 eigenvalor grande domina.' },
  { id: 'tilted',    label: 'Inclinada',           note: 'Ejes principales NO alineados con XYZ — rotados ~45°.' },
  { id: 'line',      label: 'Casi línea',          note: 'Casi unidimensional → 1 PC explica >99% varianza.' },
];

const PC_COLORS = ['#F472B6', '#34D399', '#FDB813'];

const LESSON: Lesson<PcaState> = {
  hook: {
    title: '¿Cuál es la dirección "principal" en una nube de puntos?',
    body: `Tenés mil puntos en 3D. Forman una nube alargada, inclinada. ¿Cuál es su dirección dominante? ¿En qué eje varían más?

Esa es la pregunta del PCA — Análisis de Componentes Principales. Su respuesta usa álgebra lineal: computás la matriz de COVARIANZA Σ de los datos, y sus EIGENVECTORES son las direcciones principales. Los eigenvalores son cuánta varianza captura cada uno.

Es el método más usado para reducir dimensionalidad. Si tu data 1000-dimensional tiene "estructura efectivamente 5D", PCA te dice cuál es esa estructura.

Karl Pearson (1901), Harold Hotelling (1933), y todo el mundo en machine learning hoy lo usan.`,
  },

  steps: [
    {
      title: 'Nube isotrópica — sin dirección preferente',
      duration: 5500,
      body: `Empezamos con datos GENERADOS ISOTRÓPICOS — varianza igual en todas direcciones.

Mirá: los 3 eigenvalores son casi iguales (~1, 1, 1). La nube se parece a una esfera difusa.

PC1, PC2, PC3 son CUALQUIER base ortonormal — no hay dirección preferente. Cuando los datos son isotrópicos, PCA no te da información útil.

Es el caso "trivial". El interesante es cuando los datos NO son isotrópicos.`,
      formula: 'Σ ≈ σ² · I  ⇒  todos los eigenvalores iguales',
      keyframes: [
        { at: 0, state: { preset: 'isotropic', showEllipsoid: true, showAxes: true, showProjection: false } },
        { at: 1, state: { preset: 'isotropic', showEllipsoid: true, showAxes: true, showProjection: false } },
      ],
    },
    {
      title: 'Pancake — aplastada en una dimensión',
      duration: 6000,
      body: `Ahora datos PANCAKE: 2D extendido + 1D casi colapsado.

Mirá: 2 eigenvalores GRANDES (las direcciones del plano) + 1 CHICO (la dirección normal).

PCA te dice: "tus datos son ESENCIALMENTE 2D". Podés descartar la 3ra dimensión y casi no perdés información.

Esto es lo que pasa con muchos datos reales: vivís en alta dimensión, pero la estructura efectiva es BAJA. PCA captura esa estructura.`,
      formula: 'pancake: λ₁ ≈ λ₂ ≫ λ₃',
      keyframes: [
        { at: 0, state: { preset: 'pancake', showEllipsoid: true, showAxes: true, showProjection: false } },
        { at: 1, state: { preset: 'pancake', showEllipsoid: true, showAxes: true, showProjection: false } },
      ],
    },
    {
      title: 'Cigarro — 1D dominante',
      duration: 6000,
      body: `Datos CIGARRO: 1D alargada + 2D apenas dispersa.

Un eigenvalor DOMINA (λ₁ grande). Los otros dos son chicos y casi iguales.

PC1 captura ~90% de la varianza. Tu data 3D se puede colapsar a UNA dimensión sin perder casi nada.

Esto pasa en finanzas (un componente del mercado mueve todo), genética (el componente principal de variación genética suele ser geografía), neurociencia (un modo dominante en la actividad cortical).`,
      formula: 'cigarro: λ₁ ≫ λ₂, λ₃',
      keyframes: [
        { at: 0, state: { preset: 'cigar', showEllipsoid: true, showAxes: true, showProjection: false } },
        { at: 1, state: { preset: 'cigar', showEllipsoid: true, showAxes: true, showProjection: false } },
      ],
    },
    {
      title: 'Inclinada — ejes principales NO alineados con XYZ',
      duration: 6500,
      body: `Ahora los datos están INCLINADOS — su dirección dominante NO coincide con X, Y o Z.

Mirá los ejes coloreados: PC1 apunta en una dirección DIAGONAL.

PCA encuentra esa dirección AUTOMÁTICAMENTE. No depende del sistema de coordenadas con el que mediste — encuentra los ejes NATURALES de los datos.

Esto es por qué PCA es tan útil para "rotar a coordenadas naturales": el problema se simplifica cuando elegís la base correcta.`,
      keyframes: [
        { at: 0, state: { preset: 'tilted', showEllipsoid: true, showAxes: true, showProjection: false } },
        { at: 1, state: { preset: 'tilted', showEllipsoid: true, showAxes: true, showProjection: false } },
      ],
    },
    {
      title: 'Cuasi-línea — reducción dramática',
      duration: 6000,
      body: `Caso extremo: datos casi sobre una RECTA. λ₁ >> λ₂, λ₃.

PC1 explica >99% de la varianza. Esto significa que tus datos 3D están EFECTIVAMENTE en 1D.

En aplicaciones reales: si tu data tiene esta estructura, podés guardar SOLO la proyección sobre PC1 — guardar UN número por punto en vez de 3. Eso es compresión.

PCA es la base de:
• Eigenfaces (reconocimiento facial — Turk & Pentland 1991)
• MNIST compression
• Análisis de expresión génica (microarrays)
• Componentes de movimiento humano (PCA de mocap)
• Métodos de regresión robusta (PCR, PLS)`,
      formula: 'varianza explicada por k PCs = (λ₁+...+λₖ) / (λ₁+...+λₙ)',
      keyframes: [
        { at: 0, state: { preset: 'line', showEllipsoid: true, showAxes: true, showProjection: false } },
        { at: 1, state: { preset: 'line', showEllipsoid: true, showAxes: true, showProjection: false } },
      ],
    },
  ],

  connect: {
    body: `PCA es el método más usado de "Unsupervised Learning":

• Compresión de imágenes (transformada de Karhunen-Loève = PCA discreto)
• Eigenfaces, eigenvoices, eigengaits — patrones de variación humana
• Genética poblacional: PC1 suele ser latitud, PC2 longitud (los humanos se "mezclaron" geográficamente)
• Quimioinformática: descriptores moleculares en pocas dimensiones
• Pre-procesamiento de ML antes de regresión/clasificación
• Detección de anomalías (puntos lejos del subespacio principal)

Su generalización es la SVD (Singular Value Decomposition), que descompone CUALQUIER matriz (no solo simétricas). SVD es la "Navaja Suiza" del álgebra lineal numérica.

Si entendiste PCA, ya entendiste por qué la covarianza es importante en TODO de estadística.`,
    links: [
      { label: 'Eigenvectores — el motor matemático del PCA', href: '#eigen-3d' },
      { label: 'Matrix 3D — covarianza es una matriz simétrica', href: '#matrix-3d' },
      { label: 'Rotaciones — los PCs son una rotación de XYZ', href: '#rotations' },
    ],
  },
};

export default function PCA() {
  const { audience } = useAudience();
  const [preset, setPreset] = useState('tilted');
  const [showEllipsoid, setShowEllipsoid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showProjection, setShowProjection] = useState(false);
  const [seed, setSeed] = useState(0);

  const cloud = useMemo(() => makeCloud(preset, 500), [preset, seed]);
  const { mean, vals, vecs } = useMemo(() => pca(cloud), [cloud]);

  const totalVar = vals[0] + vals[1] + vals[2];
  const varPct = vals.map(v => totalVar > 0 ? (v / totalVar) * 100 : 0);

  // Ellipsoid mesh: sphere stretched by sqrt(eigenvalues) and rotated by eigenvectors
  const ellipsoidScale: [number, number, number] = [
    Math.sqrt(Math.max(0.001, vals[0])),
    Math.sqrt(Math.max(0.001, vals[1])),
    Math.sqrt(Math.max(0.001, vals[2])),
  ];
  const ellipsoidMatrix = useMemo(() => {
    const m = new THREE.Matrix4();
    const basis = new THREE.Matrix4().makeBasis(vecs[0], vecs[1], vecs[2]);
    m.copy(basis);
    m.setPosition(mean.x, mean.y, mean.z);
    return m;
  }, [vecs, mean]);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={6} bloomIntensity={0.55} bloomThreshold={0.55}>
          {/* Reference axes */}
          <Line points={[[-3, 0, 0], [3, 0, 0]]} color="#1E293B" lineWidth={0.5} />
          <Line points={[[0, -3, 0], [0, 3, 0]]} color="#1E293B" lineWidth={0.5} />
          <Line points={[[0, 0, -3], [0, 0, 3]]} color="#1E293B" lineWidth={0.5} />

          {/* Point cloud */}
          {cloud.map((p, i) => (
            <mesh key={i} position={[p.x, p.y, p.z]}>
              <sphereGeometry args={[0.03, 6, 6]} />
              <meshStandardMaterial color="#4FC3F7" emissive="#1E40AF" emissiveIntensity={0.5} />
            </mesh>
          ))}

          {/* Covariance ellipsoid */}
          {showEllipsoid && (
            <mesh
              position={[mean.x, mean.y, mean.z]}
              scale={ellipsoidScale}
              quaternion={(() => {
                const q = new THREE.Quaternion();
                q.setFromRotationMatrix(ellipsoidMatrix);
                return q;
              })()}
            >
              <sphereGeometry args={[1, 32, 24]} />
              <meshStandardMaterial
                color="#A78BFA"
                transparent
                opacity={0.18}
                metalness={0.2}
                roughness={0.6}
              />
            </mesh>
          )}

          {/* Principal axes */}
          {showAxes && vecs.map((v, i) => {
            const len = Math.sqrt(Math.max(0.001, vals[i])) * 2.2;
            const endP = new THREE.Vector3(v.x, v.y, v.z).multiplyScalar(len).add(mean);
            const startP = new THREE.Vector3(v.x, v.y, v.z).multiplyScalar(-len).add(mean);
            return (
              <group key={i}>
                <Line
                  points={[[startP.x, startP.y, startP.z], [endP.x, endP.y, endP.z]]}
                  color={PC_COLORS[i]}
                  lineWidth={3}
                />
                <mesh position={[endP.x, endP.y, endP.z]}>
                  <coneGeometry args={[0.08, 0.18, 12]} />
                  <meshStandardMaterial color={PC_COLORS[i]} emissive={PC_COLORS[i]} emissiveIntensity={1} />
                </mesh>
              </group>
            );
          })}

          {/* Center */}
          <mesh position={[mean.x, mean.y, mean.z]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.2} />
          </mesh>
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#4FC3F7]">●</span> N = {cloud.length} puntos</div>
          <div><span className="text-[#FFFFFF]">●</span> centroide</div>
          {showAxes && (
            <>
              <div><span className="text-[#F472B6]">━</span> PC1 ({varPct[0].toFixed(1)}%)</div>
              <div><span className="text-[#34D399]">━</span> PC2 ({varPct[1].toFixed(1)}%)</div>
              <div><span className="text-[#FDB813]">━</span> PC3 ({varPct[2].toFixed(1)}%)</div>
            </>
          )}
          {showEllipsoid && <div><span className="text-[#A78BFA]">○</span> elipsoide 1σ</div>}
        </div>
      </div>

      <LessonPanel<PcaState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.preset !== undefined) setPreset(patch.preset);
          if (patch.showEllipsoid !== undefined) setShowEllipsoid(patch.showEllipsoid);
          if (patch.showAxes !== undefined) setShowAxes(patch.showAxes);
          if (patch.showProjection !== undefined) setShowProjection(patch.showProjection);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Distribución</div>
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    className={`text-left text-[11px] px-2 py-1.5 rounded border transition ${
                      preset === p.id
                        ? 'bg-[#7E57C2]/15 border-[#7E57C2]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#7E57C2]/30'
                    }`}
                  >
                    <div className="font-semibold">{p.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{p.note}</div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setSeed(s => s + 1)}
              className="w-full text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#7E57C2]/40 hover:text-white">
              ↻ regenerar nube
            </button>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Visualización</div>
              <label className="flex items-center gap-2 text-[11px] text-[#CBD5E1] py-0.5">
                <input type="checkbox" checked={showAxes} onChange={e => setShowAxes(e.target.checked)} className="accent-[#7E57C2]" />
                ejes principales
              </label>
              <label className="flex items-center gap-2 text-[11px] text-[#CBD5E1] py-0.5">
                <input type="checkbox" checked={showEllipsoid} onChange={e => setShowEllipsoid(e.target.checked)} className="accent-[#A78BFA]" />
                elipsoide de covarianza
              </label>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Componentes principales</div>
              {vals.map((v, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span style={{ color: PC_COLORS[i] }}>PC{i + 1}</span>
                    <span className="text-white">{varPct[i].toFixed(1)}%</span>
                    <span className="text-[#94A3B8]">λ = {v.toFixed(3)}</span>
                  </div>
                  <div className="h-1 bg-[#1E293B] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${varPct[i]}%`, background: PC_COLORS[i] }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[#1E293B] pt-3 text-[10px] font-mono text-[#94A3B8] space-y-0.5">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">Eigenvectores</div>
              {vecs.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <span style={{ color: PC_COLORS[i] }}>v{i + 1}</span>
                  <span>({v.x.toFixed(2)}, {v.y.toFixed(2)}, {v.z.toFixed(2)})</span>
                </div>
              ))}
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Σ = (1/N) Σᵢ (xᵢ − μ)(xᵢ − μ)ᵀ. Jacobi exacto para 3×3 simétrico.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
