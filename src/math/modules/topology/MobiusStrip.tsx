/**
 * Banda de Möbius — una superficie con UN solo lado y UN solo borde.
 *
 * La banda se genera con la parametrización EXACTA (no hay nada inventado):
 *
 *   x(u,v) = (1 + (v/2)·cos(u/2)) · cos(u)
 *   y(u,v) = (1 + (v/2)·cos(u/2)) · sin(u)
 *   z(u,v) = (v/2) · sin(u/2)
 *
 *   con  u ∈ [0, 2π)   (vuelta alrededor del anillo)
 *        v ∈ [−1, 1]   (ancho de la banda, v=0 es la línea central)
 *
 * El factor cos(u/2), sin(u/2) es la clave: el "ancho" gira MEDIA vuelta
 * (π) mientras u da una vuelta completa (2π). Por eso, al cerrar el anillo
 * (u=2π ≡ u=0) el borde superior queda pegado al inferior — un solo borde,
 * un solo lado.
 *
 * NO-ORIENTABILIDAD (lo que demostramos en vivo):
 *
 *   La normal unitaria de la superficie es N = (∂P/∂u × ∂P/∂v) / |·|.
 *   Calculamos ∂P/∂u y ∂P/∂v ANALÍTICAMENTE (derivadas exactas de la
 *   parametrización) y construimos N en cada punto. Un "viajero" recorre la
 *   línea central u: 0 → 2π cargando esa normal. Al volver al punto de
 *   partida, la normal apunta EXACTAMENTE al lado opuesto: N(2π) = −N(0).
 *   No existe una elección continua y global de "arriba" — eso es ser
 *   no-orientable.
 *
 * Comparación: un cilindro recto (mismo radio, sin la torsión cos(u/2)) SÍ
 * es orientable; su viajero regresa con la normal idéntica. Lo mostramos
 * lado a lado para que la diferencia salte a la vista.
 *
 * Corte longitudinal: cortar la banda por su línea central (v=0) NO la parte
 * en dos. Da UNA sola banda más larga, con dos torsiones (orientable). Lo
 * insinuamos resaltando la línea de corte v=0.
 */

import { useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

const ACCENT = '#34D399';      // topología (verde)
const TRAVELER = '#FDB813';    // viajero / normal (ámbar)
const FLIP = '#F472B6';        // normal invertida (rosa)
const EDGE = '#4FC3F7';        // borde único (azul)

// ── Parametrización exacta + derivadas analíticas ──────────────────────

interface SurfaceState {
  twist: number;        // 0 = cilindro orientable, 1 = banda de Möbius
  showStrip: boolean;
  showEdge: boolean;
  showCut: boolean;
  travelerT: number;    // 0..1, posición del viajero a lo largo del anillo
}

/**
 * Posición de la superficie en (u, v).
 *
 * `twist` interpola entre un cilindro (twist=0, sin giro del ancho) y la
 * banda de Möbius (twist=1, el ancho gira u/2). Cuando twist=0 el factor
 * angular del ancho es 0 y el segundo eje del marco queda fijo ⇒ cilindro
 * orientable. Cuando twist=1 recuperamos la Möbius canónica.
 */
function surfacePoint(u: number, v: number, twist: number): THREE.Vector3 {
  const a = (twist * u) / 2;            // ángulo de la media-torsión
  const r = 1 + (v / 2) * Math.cos(a);
  return new THREE.Vector3(
    r * Math.cos(u),
    r * Math.sin(u),
    (v / 2) * Math.sin(a),
  );
}

/** ∂P/∂u analítica. */
function dPdu(u: number, v: number, twist: number): THREE.Vector3 {
  const a = (twist * u) / 2;
  const da = twist / 2;                 // da/du
  const c = Math.cos(a), s = Math.sin(a);
  const r = 1 + (v / 2) * c;
  const dr = -(v / 2) * s * da;         // dr/du
  return new THREE.Vector3(
    dr * Math.cos(u) - r * Math.sin(u),
    dr * Math.sin(u) + r * Math.cos(u),
    (v / 2) * c * da,
  );
}

/** ∂P/∂v analítica. */
function dPdv(u: number, _v: number, twist: number): THREE.Vector3 {
  const a = (twist * u) / 2;
  const c = Math.cos(a), s = Math.sin(a);
  return new THREE.Vector3(
    (c / 2) * Math.cos(u),
    (c / 2) * Math.sin(u),
    s / 2,
  );
}

/** Normal unitaria N = (∂P/∂u × ∂P/∂v) normalizado. Exacta. */
function surfaceNormal(u: number, v: number, twist: number): THREE.Vector3 {
  const n = new THREE.Vector3().crossVectors(dPdu(u, v, twist), dPdv(u, v, twist));
  const len = n.length();
  if (len < 1e-9) return new THREE.Vector3(0, 0, 1);
  return n.divideScalar(len);
}

// ── BufferGeometry desde la parametrización ────────────────────────────

const NU = 200;   // muestras a lo largo del anillo
const NV = 24;    // muestras a lo ancho

function buildSurfaceGeometry(twist: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= NU; i++) {
    const u = (i / NU) * 2 * Math.PI;
    for (let j = 0; j <= NV; j++) {
      const v = -1 + (2 * j) / NV;
      const p = surfacePoint(u, v, twist);
      const n = surfaceNormal(u, v, twist);
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
      uvs.push(i / NU, j / NV);
    }
  }

  const stride = NV + 1;
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const a = i * stride + j;
      const b = a + stride;
      const c = a + 1;
      const d = b + 1;
      indices.push(a, b, c, c, b, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/** Curva del borde único: recorre v=+1 con u: 0→2π y v=−1 con u: 2π→4π.
 *  En la Möbius ambos tramos son EL MISMO borde topológico (se conectan). */
function buildEdgePoints(twist: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const steps = 400;
  for (let i = 0; i <= steps; i++) {
    // u recorre 0..4π; v cambia de signo a mitad de camino.
    const u = (i / steps) * 4 * Math.PI;
    const v = u <= 2 * Math.PI ? 1 : -1;
    const uu = u % (2 * Math.PI);
    const p = surfacePoint(uu, v, twist);
    pts.push([p.x, p.y, p.z]);
  }
  return pts;
}

/** Línea de corte longitudinal v=0 (la línea central del anillo). */
function buildCutPoints(twist: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const steps = 240;
  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) * 2 * Math.PI;
    const p = surfacePoint(u, 0, twist);
    pts.push([p.x, p.y, p.z]);
  }
  return pts;
}

// ── Lección ─────────────────────────────────────────────────────────────

const LESSON: Lesson<SurfaceState> = {
  hook: {
    title: 'Una superficie con UN solo lado y UN solo borde.',
    body: `Toma una tira de papel, dale media vuelta a un extremo y pega las puntas. Acabas de construir una banda de Möbius (Listing y Möbius, 1858).

Tiene algo imposible para nuestra intuición: si pintas su "lado de arriba" sin levantar el pincel, terminas pintándola ENTERA. No hay un "lado de abajo". Tiene UNA sola cara. Y su orilla es UNA sola curva cerrada.

La matemática que lo gobierna es la parametrización exacta:

x = (1 + (v/2)·cos(u/2))·cos u
y = (1 + (v/2)·cos(u/2))·sin u
z = (v/2)·sin(u/2)

El secreto está en el u/2: el ancho de la tira gira MEDIA vuelta mientras tú das una vuelta completa. Esa media torsión rompe la orientabilidad. Vamos a verlo, no a creerlo.`,
  },

  steps: [
    {
      title: 'La parametrización dibuja la banda',
      duration: 5500,
      body: `Construyo la malla evaluando la fórmula en una rejilla: u de 0 a 2π recorre el anillo, v de −1 a 1 recorre el ancho.

Cada vértice (u, v) cae exactamente donde la fórmula dice. Las normales NO las inventa el motor: las calculo con la derivada analítica N = (∂P/∂u × ∂P/∂v) normalizada.

Mira cómo la tira no se cierra plana como un anillo: al volver a u=2π, el borde de arriba se encuentra con el de abajo. Esa es la media torsión que mete el cos(u/2).`,
      formula: 'x = (1 + (v/2)cos(u/2)) cos u\ny = (1 + (v/2)cos(u/2)) sin u\nz = (v/2) sin(u/2)\nu∈[0,2π], v∈[−1,1]',
      keyframes: [
        { at: 0, state: { twist: 1, showStrip: true, showEdge: false, showCut: false, travelerT: 0 } },
        { at: 1, state: { twist: 1, showStrip: true, showEdge: false, showCut: false, travelerT: 0 } },
      ],
    },
    {
      title: 'Un solo borde',
      duration: 6000,
      body: `Resalto la orilla en azul. Empiezo en v=+1 y recorro u de 0 a 2π… pero al cerrar el anillo no vuelvo al punto inicial: caigo en v=−1.

Tengo que seguir OTRA vuelta (u de 0 a 2π otra vez, ahora en v=−1) para regresar al arranque. Total: u recorre 4π, no 2π.

Conclusión topológica: lo que parece "dos orillas" (arriba y abajo) es UNA sola curva cerrada. La banda de Möbius tiene un único borde. Si lo recortas con tijeras siguiendo el filo, nunca se separa en dos.`,
      formula: 'borde:  v = +1, u:0→2π  ⟶  v = −1, u:0→2π\nuna sola curva cerrada (u total = 4π)',
      keyframes: [
        { at: 0, state: { twist: 1, showStrip: true, showEdge: true, showCut: false, travelerT: 0 } },
        { at: 1, state: { twist: 1, showStrip: true, showEdge: true, showCut: false, travelerT: 0 } },
      ],
    },
    {
      title: 'El viajero: la normal se INVIERTE',
      duration: 6500,
      body: `Aquí está la prueba dura de la no-orientabilidad. Suelto un viajero en la línea central (v=0) que carga la normal de la superficie, calculada con la fórmula exacta en cada paso.

Recorre el anillo entero: u de 0 a 2π. Observa la flecha ámbar. Cuando vuelve al MISMO punto de partida, la flecha apunta hacia el lado CONTRARIO: N(2π) = −N(0). La pinto de rosa para que se note.

No es un error numérico ni un truco de cámara: es exacto. No puedes elegir un "arriba" global y consistente. Eso es, literalmente, ser no-orientable. En un plano, una esfera o un toro esto JAMÁS pasa.`,
      formula: 'N(u) = (∂P/∂u × ∂P/∂v)/|·|  evaluada en v=0\nN(2π) = − N(0)   ⟹  no-orientable',
      keyframes: [
        { at: 0, state: { twist: 1, showStrip: true, showEdge: false, showCut: false, travelerT: 0 } },
        { at: 1, state: { twist: 1, showStrip: true, showEdge: false, showCut: false, travelerT: 1 } },
      ],
    },
    {
      title: 'Compárala con un cilindro orientable',
      duration: 6000,
      body: `Para entender por qué la Möbius es especial, le QUITO la torsión: bajo el parámetro twist de 1 a 0. El ancho deja de girar y la superficie se vuelve un cilindro recto.

Repite el viaje: ahora el viajero da la vuelta y la normal regresa IDÉNTICA, N(2π) = +N(0). El cilindro SÍ es orientable: tiene dos lados (dentro y fuera) y dos bordes separados.

Sube el twist de nuevo a 1 y la inversión reaparece. La media torsión —ese único cos(u/2)— es exactamente la frontera entre orientable y no-orientable.`,
      formula: 'twist=0 (cilindro):  N(2π) = +N(0)   orientable\ntwist=1 (Möbius):    N(2π) = −N(0)   no-orientable',
      keyframes: [
        { at: 0, state: { twist: 1, showStrip: true, showEdge: false, showCut: false, travelerT: 0 } },
        { at: 1, state: { twist: 0, showStrip: true, showEdge: false, showCut: false, travelerT: 1 } },
      ],
    },
    {
      title: 'El corte longitudinal que no la parte',
      duration: 6000,
      body: `Marco en verde la línea central v=0 — el corte longitudinal. La intuición grita "se va a partir en dos anillos". No pasa.

Como la banda tiene un solo lado, cortar por el centro deja UNA sola tira, el doble de larga, con DOS torsiones completas… y esa sí es orientable. (Si en cambio cortas a un tercio del ancho, salen dos bandas enlazadas.)

Es el experimento de papel más famoso de la topología: la tijera revela que "lado" y "borde" no son lo que la geometría euclidiana te enseñó. La forma manda sobre la distancia.`,
      formula: 'corte en v=0  ⟶  1 banda de longitud doble, 2 torsiones (orientable)\ncorte en v=±1/3 ⟶ 2 bandas enlazadas',
      keyframes: [
        { at: 0, state: { twist: 1, showStrip: true, showEdge: false, showCut: true, travelerT: 0 } },
        { at: 1, state: { twist: 1, showStrip: true, showEdge: false, showCut: true, travelerT: 0 } },
      ],
    },
  ],

  connect: {
    body: `La banda de Möbius es la puerta de entrada a la topología de superficies:

• Orientabilidad: es el primer invariante que separa superficies. Esfera y toro son orientables; Möbius y botella de Klein, no.
• Botella de Klein: pega DOS bandas de Möbius por su único borde. No cabe en 3D sin atravesarse a sí misma; vive cómoda en 4D.
• Característica de Euler y género: V − E + F clasifica TODAS las superficies cerradas (teorema de clasificación). La no-orientabilidad añade el plano proyectivo ℝP² y sus sumas conexas.
• Fibrados: la banda de Möbius es el ejemplo mínimo de fibrado NO trivial sobre el círculo — el germen de toda la teoría de haces (física: monopolos, fases de Berry).
• Aplicaciones reales: cintas transportadoras Möbius (se desgastan parejo), resistencias sin inductancia, modelos de moléculas y de espacios de fase no orientables.

Si entendiste que aquí "arriba" no existe globalmente, ya pensaste como topólogo: la forma importa, la medida no.`,
    links: [
      { label: 'Género de superficies — V−E+F', href: '#genus' },
      { label: 'Geodésicas en superficies curvas', href: '#geodesics' },
      { label: 'Nudos — invariantes elementales', href: '#knots' },
    ],
  },
};

// ── Viajero animado (vive DENTRO del Canvas: puede usar useFrame) ───────

interface TravelerProps {
  twist: number;
  travelerT: number;
  autoRun: boolean;
  /** Avanza el parámetro del viajero (driver del auto-run vive aquí dentro). */
  onAdvance: (dt: number) => void;
}

function Traveler({ twist, travelerT, autoRun, onAdvance }: TravelerProps) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const arrowRef = useRef<THREE.Group>(null);
  // Color de la flecha en estado: ámbar (normal original) → rosa (invertida).
  const [flipped, setFlipped] = useState(false);
  const stemRef = useRef<THREE.MeshStandardMaterial>(null);
  const tipRef = useRef<THREE.MeshStandardMaterial>(null);

  // Vectores reutilizables (sin alocar por frame).
  const tmpQuat = useRef(new THREE.Quaternion()).current;
  const upAxis = useRef(new THREE.Vector3(0, 1, 0)).current;

  useFrame((_, delta) => {
    if (autoRun) onAdvance(delta);

    const u = travelerT * 2 * Math.PI;
    const p = surfacePoint(u, 0, twist);
    const n = surfaceNormal(u, 0, twist);

    // ¿Cuánto se invirtió la normal respecto al arranque? cos del ángulo
    // con N(0). Para twist=1 va de +1 (igual) a −1 (opuesta) en u:0→2π.
    const n0 = surfaceNormal(0, 0, twist);
    const dot = THREE.MathUtils.clamp(n.dot(n0), -1, 1);
    const isFlipped = dot < 0; // normal apuntando al lado contrario
    if (isFlipped !== flipped) setFlipped(isFlipped);

    // Tinte continuo: ámbar→rosa según el ángulo (sin esperar al setState).
    const t = (1 - dot) / 2;
    const col = new THREE.Color(TRAVELER).lerp(new THREE.Color(FLIP), t);
    if (stemRef.current) { stemRef.current.color.copy(col); stemRef.current.emissive.copy(col); }
    if (tipRef.current) { tipRef.current.color.copy(col); tipRef.current.emissive.copy(col); }

    if (bodyRef.current) {
      bodyRef.current.position.set(p.x, p.y, p.z);
    }
    if (arrowRef.current) {
      arrowRef.current.position.set(p.x, p.y, p.z);
      // Orientar la flecha (eje +Y por defecto) hacia la normal n.
      tmpQuat.setFromUnitVectors(upAxis, n);
      arrowRef.current.quaternion.copy(tmpQuat);
    }
  });

  return (
    <group>
      <mesh ref={bodyRef}>
        <sphereGeometry args={[0.07, 20, 20]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <group ref={arrowRef}>
        {/* tallo de la normal */}
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.44, 12]} />
          <meshStandardMaterial ref={stemRef} color={TRAVELER} emissive={TRAVELER} emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
        {/* punta */}
        <mesh position={[0, 0.5, 0]}>
          <coneGeometry args={[0.06, 0.16, 14]} />
          <meshStandardMaterial ref={tipRef} color={TRAVELER} emissive={TRAVELER} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// ── Componente principal ─────────────────────────────────────────────────

export default function MobiusStrip() {
  const { audience } = useAudience();
  const [twist, setTwist] = useState(1);
  const [showStrip, setShowStrip] = useState(true);
  const [showEdge, setShowEdge] = useState(false);
  const [showCut, setShowCut] = useState(false);
  const [travelerT, setTravelerT] = useState(0);
  const [autoRun, setAutoRun] = useState(false);

  // Geometría: depende SOLO de la torsión (recalcula en vivo al mover twist).
  const geometry = useMemo(() => buildSurfaceGeometry(twist), [twist]);
  const edgePoints = useMemo(() => buildEdgePoints(twist), [twist]);
  const cutPoints = useMemo(() => buildCutPoints(twist), [twist]);

  // Diagnóstico EXACTO de orientabilidad: N(2π)·N(0).
  const orientCos = useMemo(() => {
    const n0 = surfaceNormal(0, 0, twist);
    const n1 = surfaceNormal(2 * Math.PI, 0, twist);
    return THREE.MathUtils.clamp(n0.dot(n1), -1, 1);
  }, [twist]);
  const isOrientable = orientCos > 0.5;

  // Auto-run del viajero (driver simple con rAF vía useFrame en un hijo "tick").
  useFrame((_, delta) => {
    if (!autoRun) return;
    setTravelerT((t) => (t + delta * 0.18) % 1);
  });

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={4.2} autoRotate bloomIntensity={0.6} bloomThreshold={0.5} bgColor="#05060A" captureMode>
          <CanvasCapture />

          {/* Superficie (Möbius / cilindro según twist) */}
          {showStrip && (
            <mesh geometry={geometry}>
              <meshStandardMaterial
                color={ACCENT}
                emissive={ACCENT}
                emissiveIntensity={0.35}
                metalness={0.25}
                roughness={0.45}
                side={THREE.DoubleSide}
                transparent
                opacity={0.92}
              />
            </mesh>
          )}

          {/* Wireframe sutil para leer la forma */}
          {showStrip && (
            <mesh geometry={geometry}>
              <meshBasicMaterial color="#0B3D2E" wireframe transparent opacity={0.22} />
            </mesh>
          )}

          {/* Borde único */}
          {showEdge && (
            <Line points={edgePoints} color={EDGE} lineWidth={3} />
          )}

          {/* Corte longitudinal v=0 */}
          {showCut && (
            <Line points={cutPoints} color="#FBCFE8" lineWidth={2.5} dashed dashSize={0.12} gapSize={0.08} />
          )}

          {/* Viajero con normal (demostración de no-orientabilidad) */}
          <Traveler twist={twist} travelerT={travelerT} />
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span style={{ color: ACCENT }}>▰</span> superficie {twist > 0.5 ? '(Möbius)' : '(cilindro)'}</div>
          <div><span style={{ color: TRAVELER }}>↑</span> viajero + normal</div>
          {showEdge && <div><span style={{ color: EDGE }}>━</span> borde único (u:0→4π)</div>}
          {showCut && <div><span style={{ color: '#FBCFE8' }}>┄</span> corte v=0</div>}
          <div className="mt-1" style={{ color: isOrientable ? EDGE : FLIP }}>
            N(2π)·N(0) = {orientCos.toFixed(2)} → {isOrientable ? 'orientable' : 'NO-orientable'}
          </div>
        </div>
      </div>

      <LessonPanel<SurfaceState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.twist !== undefined) setTwist(patch.twist);
          if (patch.showStrip !== undefined) setShowStrip(patch.showStrip);
          if (patch.showEdge !== undefined) setShowEdge(patch.showEdge);
          if (patch.showCut !== undefined) setShowCut(patch.showCut);
          if (patch.travelerT !== undefined) setTravelerT(patch.travelerT);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">
                Media torsión (twist)
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={twist}
                onChange={(e) => setTwist(parseFloat(e.target.value))}
                className="w-full accent-[#34D399]"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#64748B] mt-0.5">
                <span>0 · cilindro</span>
                <span className="text-white">{twist.toFixed(2)}</span>
                <span>1 · Möbius</span>
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">
                Viajero a lo largo del anillo (u)
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={travelerT}
                onChange={(e) => { setAutoRun(false); setTravelerT(parseFloat(e.target.value)); }}
                className="w-full accent-[#FDB813]"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#64748B] mt-0.5">
                <span>u = 0</span>
                <span className="text-white">u = {(travelerT * 360).toFixed(0)}°</span>
                <span>u = 2π</span>
              </div>
              <button
                onClick={() => setAutoRun((r) => !r)}
                className={`mt-2 w-full text-[11px] px-2 py-1.5 rounded border transition ${
                  autoRun
                    ? 'bg-[#FDB813]/10 border-[#FDB813]/40 text-[#FDB813]'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#FDB813]/30 hover:text-white'
                }`}
              >
                {autoRun ? '⏸ pausar viajero' : '▶ animar viajero'}
              </button>
            </div>

            <div className="border-t border-[#1E293B] pt-3">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Visualización</div>
              <label className="flex items-center gap-2 text-[11px] text-[#CBD5E1] py-0.5">
                <input type="checkbox" checked={showStrip} onChange={(e) => setShowStrip(e.target.checked)} className="accent-[#34D399]" />
                superficie
              </label>
              <label className="flex items-center gap-2 text-[11px] text-[#CBD5E1] py-0.5">
                <input type="checkbox" checked={showEdge} onChange={(e) => setShowEdge(e.target.checked)} className="accent-[#4FC3F7]" />
                borde único
              </label>
              <label className="flex items-center gap-2 text-[11px] text-[#CBD5E1] py-0.5">
                <input type="checkbox" checked={showCut} onChange={(e) => setShowCut(e.target.checked)} className="accent-[#F472B6]" />
                corte longitudinal (v=0)
              </label>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">Diagnóstico de orientabilidad</div>
              <div className="text-[11px] font-mono text-[#CBD5E1]">
                N(2π) · N(0) = <span className="text-white">{orientCos.toFixed(3)}</span>
              </div>
              <div className="text-[11px] font-mono" style={{ color: isOrientable ? EDGE : FLIP }}>
                {isOrientable ? '+1 → orientable (la normal vuelve igual)' : '−1 → NO-orientable (la normal se invierte)'}
              </div>
              <div className="h-1.5 bg-[#1E293B] rounded-full overflow-hidden mt-1">
                {/* mapea cos∈[−1,1] a [0,100]% */}
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${((orientCos + 1) / 2) * 100}%`,
                    background: isOrientable ? EDGE : FLIP,
                  }}
                />
              </div>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Normal exacta N = (∂P/∂u × ∂P/∂v)/|·| con derivadas analíticas. La no-orientabilidad es N(2π)=−N(0), no un artefacto de malla.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
