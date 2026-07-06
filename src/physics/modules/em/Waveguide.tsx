/**
 * Guía de onda rectangular — modos TE/TM.
 *
 * Física real: solución analítica de las ecuaciones de Maxwell en un conductor
 * perfecto rectangular (a × b). Para modo TE_mn:
 *
 *   E_y(x,y,t) = E₀ · sin(mπx/a) · cos(nπy/b) · cos(ωt − βz)
 *   E_x(x,y,t) = −E₀ · cos(mπx/a) · sin(nπy/b) · cos(ωt − βz)
 *   Ez = 0
 *
 * Para modo TM_mn:
 *   E_z(x,y,t) = E₀ · sin(mπx/a) · sin(nπy/b) · cos(ωt − βz)
 *
 * Frecuencia de corte: f_c = (c/2) · √((m/a)² + (n/b)²)
 * Constante de propagación: β = (2π/λ) · √(1 − (f_c/f)²)
 *
 * Visualización: volumen de vectores campo E en 3D. Vectores emisivos
 * coloreados por magnitud (azul→cian→blanco). La guía es una caja
 * wireframe metálica. El campo oscila a medida que la onda viaja en +z.
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface WGState {
  modeType: 'TE' | 'TM';
  m: number;
  n: number;
  freq: number; // GHz
}

// ─── Constantes físicas ──────────────────────────────────────────────────────

const C_LIGHT = 3e8; // m/s
const A = 0.072;     // ancho a (m) — guía WR-90 estándar (banda X: 8–12 GHz)
const B = 0.034;     // alto b (m)
// Escala visual: mapear [0,A]×[0,B]×[0,L_GUIDE] → escena 3D
const SCALE = 14.0 / A;    // unidades de escena por metro
const AV = A * SCALE;       // = 14 unidades
const BV = B * SCALE;       // ≈ 6.6 unidades
const LV = 20.0;            // longitud visual de la guía en escena

// Grid de flechas: NX × NY × NZ puntos de muestreo
const NX = 10;
const NY = 5;
const NZ = 12;
const N_ARROWS = NX * NY * NZ;

// ─── LESSON ─────────────────────────────────────────────────────────────────

const LESSON: Lesson<WGState> = {
  hook: {
    title: 'Una guía de onda: la autópista de microondas.',
    body: `Las guías de onda rectangulares son el tubo que lleva las microondas en radares, hornos, telescopios de radio y aceleradores de partículas.

Pero no cualquier frecuencia entra — la guía actúa como filtro pasa-altas. Cada modo TE_mn o TM_mn tiene su propia frecuencia mínima de corte, y debajo de ella la onda NO se propaga: decae exponencialmente.

Esto emerge de las ecuaciones de Maxwell con condiciones de frontera en las paredes metálicas perfectas. Las soluciones son productos de funciones trigonométricas — no invenciones: son la física del conductor.

Selecciona el modo y la frecuencia en el sandbox. Observa cómo el campo vectorial 3D cambia de topología con cada (m, n).`,
  },

  steps: [
    {
      title: 'Frecuencia de corte — cuándo entra la onda',
      duration: 6000,
      body: `La guía WR-90 tiene dimensiones a = 72 mm × b = 34 mm. Su modo dominante es TE₁₀.

Frecuencia de corte: f_c = (c/2)√((m/a)² + (n/b)²).

Para TE₁₀: f_c = c/(2a) = 3×10⁸/(2×0.072) ≈ 2.08 GHz. Para frecuencias > 2.08 GHz, el modo se propaga. Debajo: evanescente — β imaginario, campo que decae en z.

La banda X (8–12 GHz) está muy por encima del corte del TE₁₀, por eso los radares militares usan WR-90.`,
      formula: 'f_c = (c/2) √((m/a)² + (n/b)²)\nβ  = (2π/λ) √(1 − (f_c/f)²)',
      keyframes: [
        { at: 0, state: { modeType: 'TE', m: 1, n: 0, freq: 10 } },
        { at: 1, state: { modeType: 'TE', m: 1, n: 0, freq: 10 } },
      ],
    },
    {
      title: 'Modo TE₁₀ — el modo dominante',
      duration: 6000,
      body: `TE₁₀ tiene exactamente una variación en x y cero en y. El campo eléctrico es puramente transversal, polarizado en y.

E_y(x,z,t) = E₀ · sin(πx/a) · cos(ωt − βz)

Mirá: el campo es máximo en el centro de la guía (x = a/2) y se anula en las paredes metálicas (x = 0, x = a), cumpliendo la condición de frontera E_tangencial = 0 en el conductor perfecto.

Esta topología simple lo hace el modo más fácil de excitar — basta una sonda en el centro de la pared ancha.`,
      formula: 'E_y = E₀ sin(πx/a) cos(ωt − βz)\nH_x = −(β/ωμ₀) E_y',
      keyframes: [
        { at: 0, state: { modeType: 'TE', m: 1, n: 0, freq: 10 } },
        { at: 1, state: { modeType: 'TE', m: 1, n: 0, freq: 10 } },
      ],
    },
    {
      title: 'Modo TE₂₁ — nodos de campo internos',
      duration: 6000,
      body: `Al subir a m=2, n=1, el campo tiene DOS variaciones en x y UNA en y. Aparecen nodos internos — regiones donde E = 0 dentro de la guía, no solo en las paredes.

f_c(TE₂₁) = (c/2)√((2/a)² + (1/b)²) ≈ 9.5 GHz para WR-90.

Ese modo compite con el dominante en banda X alta. Los diseñadores de guías evitan frecuencias donde dos modos coexisten — las interferencias crean patrones complicados y pérdida de señal.

Nota la topología: el campo se "curva" para cumplir E_tan = 0 en TODAS las cuatro paredes simultáneamente.`,
      formula: 'f_c(mn) = (c/2)√((m/a)² + (n/b)²)\nTE₂₁: f_c ≈ 9.5 GHz (WR-90)',
      keyframes: [
        { at: 0, state: { modeType: 'TE', m: 2, n: 1, freq: 10 } },
        { at: 1, state: { modeType: 'TE', m: 2, n: 1, freq: 10 } },
      ],
    },
    {
      title: 'Modo TM₁₁ — campo eléctrico longitudinal',
      duration: 6000,
      body: `En modos TM, el campo magnético es puramente transversal y el eléctrico tiene componente E_z.

TM₁₁ (el modo TM de menor orden, pues TM₁₀ y TM₀₁ no existen — la condición E_z = 0 en las paredes los elimina) tiene f_c ≈ 6.1 GHz.

E_z(x,y,z,t) = E₀ · sin(πx/a) · sin(πy/b) · cos(ωt − βz)

El campo transversal se deriva de E_z. Mirá: E_z es MÁXIMO en el centro y cero en las cuatro paredes — topología completamente distinta a TE.

Los modos TM son esenciales en cavidades resonantes de aceleradores de partículas (los protones se aceleran por E_z).`,
      formula: 'E_z = E₀ sin(mπx/a) sin(nπy/b) cos(ωt−βz)\nTM₁₁: f_c = (c/2)√(1/a²+1/b²)',
      keyframes: [
        { at: 0, state: { modeType: 'TM', m: 1, n: 1, freq: 10 } },
        { at: 1, state: { modeType: 'TM', m: 1, n: 1, freq: 10 } },
      ],
    },
  ],

  connect: {
    body: `Las guías de onda son el corazón oculto de toda la tecnología de microondas moderna:

• Radares militares (banda X, WR-90) — detectan aviones y misiles
• Aceleradores de partículas (CERN: cavidades TM₀₁₀, modo de aceleración puro)
• Hornos de microondas (¿por qué 2.45 GHz? Es la banda ISM, no resonancia del agua — eso es un mito)
• Radioastronomía (receptores de antena parabólica, guías criogénicas a 4 K)
• Comunicaciones de alta potencia (enlaces de microondas punto a punto)

El formalismo es idéntico en fibra óptica (guías dieléctricas) — modos TE y TM existen allí también. La diferencia es que las paredes son dieléctricas, no conductores perfectos.`,
    links: [
      { label: 'EMWaves — ondas planas en el espacio libre', href: '#em-waves' },
      { label: 'Fields — campos de Coulomb y Biot-Savart', href: '#fields' },
      { label: 'Schwarzschild — ondas en espacio curvo', href: '#schwarzschild' },
    ],
  },
};

// ─── Física: campo E del modo ────────────────────────────────────────────────

/**
 * Calcula el vector campo E normalizado en punto (xi, yi, zi) ∈ [0,1]³
 * en el instante de fase `phase` = ωt − βz_center.
 * xi, yi, zi son coordenadas normalizadas en [0,1].
 * Devuelve [Ex, Ey, Ez] sin normalizar (en unidades relativas).
 */
function fieldAt(
  modeType: 'TE' | 'TM',
  m: number,
  n: number,
  xi: number,  // 0..1 en x
  yi: number,  // 0..1 en y
  zi: number,  // 0..1 en z (posición en la guía)
  phase: number, // ωt
): [number, number, number] {
  // Coordenadas físicas normalizadas
  const mx = Math.PI * m * xi;
  const ny = Math.PI * n * yi;

  // Número de onda de corte kc²
  const kca = Math.PI * m / A;
  const kcb = Math.PI * n / B;
  const kc2 = kca * kca + kcb * kcb;

  // Fase de propagación en z (β * L * zi + fase temporal)
  // Usamos un β normalizado visual — la física del β real se muestra en el HUD
  const betaZ = 2.0 * Math.PI * zi - phase;

  if (modeType === 'TE') {
    // Modo TE_mn: Ez = 0
    // Para TE_mn (n>0 o m>0):
    // E_y = (mπ/a) / kc² · cos(mπx/a) · sin(nπy/b) · [propagating factor]   (si n>0)
    // E_x = −(nπ/b) / kc² · sin(mπx/a) · cos(nπy/b) · [prop]
    // Caso especial TE_m0 (n=0): E_x = 0; E_y = sin(mπx/a)
    let ex = 0, ey = 0;
    if (n === 0) {
      // TE_m0: solo E_y, sin variación en y
      ey = Math.sin(mx) * Math.cos(betaZ);
    } else if (m === 0) {
      // TE_0n: solo E_x, sin variación en x
      ex = Math.sin(ny) * Math.cos(betaZ);
    } else {
      // TE_mn general
      ex = -(kcb / kc2) * Math.sin(mx) * Math.cos(ny) * Math.cos(betaZ);
      ey =  (kca / kc2) * Math.cos(mx) * Math.sin(ny) * Math.cos(betaZ);
    }
    return [ex, ey, 0];
  } else {
    // Modo TM_mn: Hz = 0
    // E_z = E₀ · sin(mπx/a) · sin(nπy/b) · cos(βz − ωt)
    // E_x = −β/kc² · ∂Ez/∂x = −(β·mπ/a)/kc² · cos(mπx/a) · sin(nπy/b) · sin(...)
    // E_y = −β/kc² · ∂Ez/∂y = −(β·nπ/b)/kc² · sin(mπx/a) · cos(nπy/b) · sin(...)
    // Usamos β normalizado = 1 para la visualización
    const ez = Math.sin(mx) * Math.sin(ny) * Math.cos(betaZ);
    const ex = -(kca / kc2) * Math.cos(mx) * Math.sin(ny) * Math.sin(betaZ);
    const ey = -(kcb / kc2) * Math.sin(mx) * Math.cos(ny) * Math.sin(betaZ);
    return [ex, ey, ez];
  }
}

// ─── Componente 3D (SUB-componente dentro de Stage/Canvas) ───────────────────

interface FieldVizProps {
  modeType: 'TE' | 'TM';
  m: number;
  n: number;
  freq: number;
  fc: number;   // frecuencia de corte (GHz)
  propagating: boolean;
}

function FieldViz({ modeType, m, n, propagating }: FieldVizProps) {
  // Geometría de flechas: instanced cylinders (cuerpo) + cones (punta)
  // Cada flecha = 1 instancia de cylinder + 1 de cone
  const shaftRef = useRef<THREE.InstancedMesh>(null);
  const headRef  = useRef<THREE.InstancedMesh>(null);
  const phaseRef = useRef(0);

  // Colores por magnitud en formato HSL: azul(0)→cian→blanco(1)
  const colorsArr = useMemo(() => new Float32Array(N_ARROWS * 3), []);

  // Posiciones de muestra (en coordenadas de escena)
  const samplePos = useMemo(() => {
    const pos: Array<[number, number, number, number, number, number]> = [];
    for (let iz = 0; iz < NZ; iz++) {
      for (let iy = 0; iy < NY; iy++) {
        for (let ix = 0; ix < NX; ix++) {
          // xi,yi en (0,1) exclusivo — evitar paredes donde E = 0
          const xi = (ix + 0.5) / NX;
          const yi = (iy + 0.5) / NY;
          const zi = (iz + 0.5) / NZ;
          // Posición en escena
          const sx = xi * AV - AV / 2;
          const sy = yi * BV - BV / 2;
          const sz = zi * LV - LV / 2;
          pos.push([xi, yi, zi, sx, sy, sz]);
        }
      }
    }
    return pos;
  }, []);

  const _dummy = useMemo(() => new THREE.Object3D(), []);
  const _color = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    if (!shaftRef.current || !headRef.current) return;

    phaseRef.current += delta * 3.0; // velocidad de oscilación

    // Factor de decaimiento para modo evanescente
    const decay = propagating ? 1.0 : 0.25;

    let maxMag = 0;
    const vectors: Array<[number, number, number]> = [];

    // Primera pasada: calcular todos los vectores y encontrar el máximo
    for (let i = 0; i < samplePos.length; i++) {
      const [xi, yi, zi] = samplePos[i];
      // Para evanescente: decaer en z
      const evFactor = propagating ? 1 : Math.exp(-3 * samplePos[i][2]);
      const [ex, ey, ez] = fieldAt(modeType, m, n, xi, yi, zi, phaseRef.current);
      const vx = ex * evFactor * decay;
      const vy = ey * evFactor * decay;
      const vz = ez * evFactor * decay;
      vectors.push([vx, vy, vz]);
      const mag = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (mag > maxMag) maxMag = mag;
    }

    const invMax = maxMag > 1e-9 ? 1 / maxMag : 1;
    const arrowScale = 1.2; // longitud máxima de flecha en escena

    for (let i = 0; i < samplePos.length; i++) {
      const [, , , sx, sy, sz] = samplePos[i];
      const [vx, vy, vz] = vectors[i];
      const mag = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const normMag = mag * invMax; // 0..1

      if (mag < 1e-9) {
        // Esconder flecha con scale 0
        _dummy.position.set(sx, sy, sz);
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        shaftRef.current.setMatrixAt(i, _dummy.matrix);
        headRef.current.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      const dir = new THREE.Vector3(vx, vy, vz).normalize();
      const len = normMag * arrowScale;
      const shaftLen = len * 0.7;
      const headLen  = len * 0.3;

      // Shaft: un cilindro a lo largo de dir, comenzando en (sx,sy,sz)
      const shaftMid = new THREE.Vector3(sx, sy, sz).addScaledVector(dir, shaftLen * 0.5);
      _dummy.position.copy(shaftMid);
      // Rotar el cilindro (por default +y) hacia dir
      const up = new THREE.Vector3(0, 1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
      _dummy.quaternion.copy(q);
      _dummy.scale.set(1, shaftLen, 1);
      _dummy.updateMatrix();
      shaftRef.current.setMatrixAt(i, _dummy.matrix);

      // Head: cono al final del shaft
      const headTip = new THREE.Vector3(sx, sy, sz).addScaledVector(dir, shaftLen + headLen * 0.5);
      _dummy.position.copy(headTip);
      _dummy.quaternion.copy(q);
      _dummy.scale.set(normMag, headLen, normMag);
      _dummy.updateMatrix();
      headRef.current.setMatrixAt(i, _dummy.matrix);

      // Color: azul(cold)→cian→blanco(hot) según normMag
      // hue: 240 (azul) → 180 (cian) → 0 (rojo/blanco en HDR)
      const hue = (1 - normMag) * 0.65; // 0.65=azul, 0=rojo
      const sat = 1 - normMag * 0.4;
      const lit = 0.4 + normMag * 0.6;
      _color.setHSL(hue, sat, lit);
      colorsArr[i * 3 + 0] = _color.r;
      colorsArr[i * 3 + 1] = _color.g;
      colorsArr[i * 3 + 2] = _color.b;
      shaftRef.current.setColorAt(i, _color);
      headRef.current.setColorAt(i, _color);
    }

    shaftRef.current.instanceMatrix.needsUpdate = true;
    headRef.current.instanceMatrix.needsUpdate = true;
    if (shaftRef.current.instanceColor) shaftRef.current.instanceColor.needsUpdate = true;
    if (headRef.current.instanceColor)  headRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <>
      {/* Shaft cilíndrico — radio pequeño */}
      <instancedMesh ref={shaftRef} args={[undefined, undefined, N_ARROWS]} frustumCulled={false}>
        <cylinderGeometry args={[0.04, 0.04, 1, 6]} />
        <meshStandardMaterial
          vertexColors
          emissiveIntensity={1.4}
          toneMapped={false}
          metalness={0.1}
          roughness={0.5}
        />
      </instancedMesh>

      {/* Head cónico */}
      <instancedMesh ref={headRef} args={[undefined, undefined, N_ARROWS]} frustumCulled={false}>
        <coneGeometry args={[0.14, 1, 6]} />
        <meshStandardMaterial
          vertexColors
          emissiveIntensity={1.6}
          toneMapped={false}
          metalness={0.1}
          roughness={0.4}
        />
      </instancedMesh>

      {/* La guía: caja wireframe metálica */}
      <WaveguideBox />

      {/* Etiquetas de dimensiones */}
      <Html position={[AV / 2 + 1.5, 0, 0]} center>
        <div className="text-[10px] font-mono text-[#94A3B8] whitespace-nowrap">a = 72 mm</div>
      </Html>
      <Html position={[0, BV / 2 + 1.2, -LV / 2]} center>
        <div className="text-[10px] font-mono text-[#94A3B8] whitespace-nowrap">b = 34 mm</div>
      </Html>
    </>
  );
}

// Caja wireframe de la guía — paredes conductoras
function WaveguideBox() {
  const geo = useMemo(() => new THREE.BoxGeometry(AV, BV, LV), []);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  return (
    <>
      {/* Wireframe de los bordes */}
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color="#4FC3F7" transparent opacity={0.5} />
      </lineSegments>
      {/* Planos semitransparentes para las 4 paredes conductoras (no tapa/fondo) */}
      {/* Pared izquierda x=0 */}
      <mesh position={[-AV / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[LV, BV]} />
        <meshStandardMaterial color="#1E3A5F" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Pared derecha x=a */}
      <mesh position={[AV / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[LV, BV]} />
        <meshStandardMaterial color="#1E3A5F" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Pared inferior y=0 */}
      <mesh position={[0, -BV / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[AV, LV]} />
        <meshStandardMaterial color="#1E3A5F" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Pared superior y=b */}
      <mesh position={[0, BV / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[AV, LV]} />
        <meshStandardMaterial color="#1E3A5F" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function Waveguide() {
  const { audience } = useAudience();

  const [modeType, setModeType] = useState<'TE' | 'TM'>('TE');
  const [m, setM] = useState(1);
  const [n, setN] = useState(0);
  const [freq, setFreq] = useState(10); // GHz

  // Física de corte
  const fc = useMemo(() => {
    const km = m / A;
    const kn = n / B;
    return (C_LIGHT / 2) * Math.sqrt(km * km + kn * kn) / 1e9; // GHz
  }, [m, n]);

  // Validar modo TM (TM_m0, TM_0n no existen — Ez = 0 en paredes exige m,n ≥ 1)
  const validMode = modeType === 'TE' ? true : (m >= 1 && n >= 1);
  const propagating = freq > fc && validMode;

  // β real (m⁻¹)
  const beta = useMemo(() => {
    if (!propagating) return 0;
    const lam = C_LIGHT / (freq * 1e9);
    return (2 * Math.PI / lam) * Math.sqrt(1 - (fc / freq) ** 2);
  }, [freq, fc, propagating]);

  // Velocidad de fase vp = ω/β
  const vPhase = useMemo(() => {
    if (beta < 1) return Infinity;
    return 2 * Math.PI * freq * 1e9 / beta / C_LIGHT; // en unidades de c
  }, [freq, beta]);

  // LessonPanel state handler
  const handleApplyState = (patch: Partial<WGState>) => {
    if (patch.modeType !== undefined) setModeType(patch.modeType);
    if (patch.m       !== undefined) setM(patch.m);
    if (patch.n       !== undefined) setN(patch.n);
    if (patch.freq    !== undefined) setFreq(patch.freq);
  };

  // Modo label
  const modeName = `${modeType}${m}${n}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={22} autoRotate bloomIntensity={0.9} bloomThreshold={0.1}>
          <FieldViz
            modeType={modeType}
            m={m}
            n={n}
            freq={freq}
            fc={fc}
            propagating={propagating}
          />
        </Stage>

        {/* HUD superior izquierda — estado físico */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div>
            <span className="text-[#64748B]">modo  </span>
            <span className="text-[#FDB813] font-bold">{modeName}</span>
            {!validMode && <span className="ml-2 text-[#F87171]">[inválido]</span>}
          </div>
          <div>
            <span className="text-[#64748B]">f_c   </span>
            <span className={propagating ? 'text-[#34D399]' : 'text-[#F87171]'}>
              {fc.toFixed(2)} GHz
            </span>
          </div>
          <div>
            <span className="text-[#64748B]">f     </span>
            <span>{freq.toFixed(1)} GHz</span>
            <span className="ml-2 text-[10px]">
              {propagating ? '✓ propagante' : '✗ evanescente'}
            </span>
          </div>
          {propagating && (
            <>
              <div>
                <span className="text-[#64748B]">β     </span>
                {beta.toFixed(1)} rad/m
              </div>
              <div>
                <span className="text-[#64748B]">v_p   </span>
                {isFinite(vPhase) ? `${vPhase.toFixed(2)} c` : '∞'}
              </div>
            </>
          )}
        </div>

        {/* Leyenda de color */}
        <div className="absolute bottom-5 right-4 flex flex-col items-end gap-1">
          <div className="text-[9px] font-mono text-[#64748B]">|E|</div>
          <div
            className="w-4 h-24 rounded"
            style={{
              background: 'linear-gradient(to bottom, #FFFFFF, #4FC3F7, #1E40AF)',
            }}
          />
          <div className="text-[9px] font-mono text-[#64748B]">0</div>
        </div>
      </div>

      {/* Panel de lección */}
      <LessonPanel<WGState>
        lesson={LESSON}
        onApplyState={handleApplyState}
        sandbox={
          <>
            <Section title="Tipo de modo">
              <div className="flex gap-2">
                {(['TE', 'TM'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      setModeType(t);
                      // TM requiere m,n ≥ 1
                      if (t === 'TM') { setM(m < 1 ? 1 : m); setN(n < 1 ? 1 : n); }
                    }}
                    className={`flex-1 py-2 rounded-md border text-[12px] font-bold transition ${
                      modeType === t
                        ? 'bg-gradient-to-br from-[#1E40AF]/40 to-[#0EA5E9]/20 border-[#4FC3F7]/50 text-[#4FC3F7]'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {modeType === 'TM' && (
                <div className="mt-2 text-[10px] text-[#94A3B8]">
                  TM requiere m ≥ 1 y n ≥ 1 (TM_m0 y TM_0n no existen).
                </div>
              )}
            </Section>

            <Section title={`Índices m, n — Modo ${modeName}`}>
              <SliderInt
                label="m"
                v={m}
                min={modeType === 'TM' ? 1 : 0}
                max={4}
                on={setM}
              />
              <SliderInt
                label="n"
                v={n}
                min={modeType === 'TM' ? 1 : 0}
                max={3}
                on={setN}
              />
              {!validMode && (
                <div className="text-[10px] text-[#F87171] mt-1">
                  Modo TM₀ₙ / TMₘ₀ no existe — selecciona m,n ≥ 1.
                </div>
              )}
            </Section>

            <Section title="Frecuencia de operación">
              <div className="flex items-baseline justify-between text-[11px] font-mono mb-1">
                <span className="text-[#64748B]">f</span>
                <span className="text-white">{freq.toFixed(1)} GHz</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={30}
                step={0.1}
                value={freq}
                onChange={e => setFreq(Number(e.target.value))}
                className="w-full"
              />
              <div className="mt-2 space-y-0.5">
                <Row
                  label="f_c"
                  value={`${fc.toFixed(2)} GHz`}
                  highlight={!propagating}
                />
                <Row
                  label="f/f_c"
                  value={validMode ? (freq / fc).toFixed(2) : '—'}
                  highlight={validMode && freq / fc < 1}
                />
                <Row
                  label="β"
                  value={propagating ? `${beta.toFixed(1)} rad/m` : 'evanescente'}
                  highlight={!propagating}
                />
              </div>
            </Section>

            {audience !== 'child' && (
              <Section title="Modos rápidos (WR-90)">
                <div className="grid grid-cols-1 gap-1">
                  {[
                    { label: 'TE₁₀ (dominante)', mt: 'TE' as const, m: 1, n: 0, f: 10 },
                    { label: 'TE₂₀',              mt: 'TE' as const, m: 2, n: 0, f: 10 },
                    { label: 'TE₁₁',              mt: 'TE' as const, m: 1, n: 1, f: 10 },
                    { label: 'TE₂₁',              mt: 'TE' as const, m: 2, n: 1, f: 10 },
                    { label: 'TM₁₁',              mt: 'TM' as const, m: 1, n: 1, f: 10 },
                    { label: 'TM₂₁',              mt: 'TM' as const, m: 2, n: 1, f: 10 },
                  ].map(p => (
                    <button
                      key={p.label}
                      onClick={() => { setModeType(p.mt); setM(p.m); setN(p.n); setFreq(p.f); }}
                      className={`text-left px-3 py-1.5 rounded border text-[11px] transition ${
                        modeType === p.mt && m === p.m && n === p.n
                          ? 'bg-[#1E40AF]/20 border-[#4FC3F7]/40 text-white'
                          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                      }`}
                    >
                      {p.label}
                      <span className="ml-2 text-[10px] text-[#64748B]">
                        {((C_LIGHT / 2) * Math.sqrt((p.m / A) ** 2 + (p.n / B) ** 2) / 1e9).toFixed(1)} GHz
                      </span>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Fórmula">
                <div className="text-[10px] font-mono text-[#CBD5E1] leading-relaxed space-y-1">
                  <div className="text-[#FDB813]">f_c = (c/2) √((m/a)²+(n/b)²)</div>
                  <div>β = (2π/λ) √(1−(f_c/f)²)</div>
                  <div className="text-[#64748B] mt-1">a=72mm  b=34mm (WR-90)</div>
                </div>
              </Section>
            )}
          </>
        }
      />
    </div>
  );
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className={highlight ? 'text-[#F87171]' : 'text-white'}>{value}</span>
    </div>
  );
}

function SliderInt({ label, v, min, max, on }: {
  label: string; v: number; min: number; max: number; on: (v: number) => void;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono mb-1">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={v}
        onChange={e => on(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
