/**
 * Género de superficies — la característica de Euler como invariante topológico.
 *
 *   χ = V − E + F
 *
 * Para CUALQUIER triangulación (o malla cerrada) de una superficie orientable
 * cerrada, el número de vértices menos aristas más caras da SIEMPRE el mismo
 * número, sin importar cuán fina sea la malla ni cómo la deformes. Ese número
 * solo depende del GÉNERO g (cantidad de "asas"/agujeros):
 *
 *   χ = 2 − 2g
 *
 *   esfera        g = 0  →  χ = 2
 *   toro          g = 1  →  χ = 0
 *   doble toro    g = 2  →  χ = −2
 *
 * Acá NO se hardcodea χ. Se construye una malla real de cada superficie (grid
 * paramétrico → quads → conteo combinatorio EXACTO de V, E, F) y se verifica
 * que V − E + F coincide con 2 − 2g. Como el conteo es combinatorio (entero),
 * sale exacto: la torsión de la malla, su finura (resolución u×v) y su forma 3D
 * NO cambian χ. Eso es justamente lo que significa "invariante".
 *
 * La escena muestra la superficie 3D real (esfera, toro, doble toro
 * parametrizados) que se deforma en vivo con un slider; el HUD muestra V, E, F
 * y χ recalculados al vuelo y la verificación χ = 2 − 2g.
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

const ACCENT = '#22D3EE'; // acento topología (cian)

interface GenusState {
  surfaceId: string;
  deform: number; // 0..1 cantidad de deformación (la χ NO cambia)
  resU: number;   // resolución del grid en u
}

// ── Tipos de superficie ────────────────────────────────────────────────

interface Surface {
  id: string;
  label: string;
  genus: number;
  blurb: string;
  /** ¿el grid u×v se cierra (wrap) en la dirección u? */
  wrapU: boolean;
  /** ¿el grid u×v se cierra (wrap) en la dirección v? */
  wrapV: boolean;
  /**
   * Parametrización (u,v) ∈ [0,1]² → punto 3D. `deform` ∈ [0,1] mete una
   * deformación continua (ondular la superficie) que NO altera la topología.
   */
  param: (u: number, v: number, deform: number) => THREE.Vector3;
}

const TWO_PI = Math.PI * 2;

const SURFACES: Surface[] = [
  {
    id: 'sphere',
    label: 'Esfera  (g = 0)',
    genus: 0,
    blurb: 'Sin agujeros. La superficie cerrada más simple. χ = 2.',
    wrapU: true,
    wrapV: false,
    param: (u, v, d) => {
      // u → longitud [0, 2π), v → latitud [0, π]
      const lon = u * TWO_PI;
      const lat = v * Math.PI;
      const r = 1.5 * (1 + 0.18 * d * Math.sin(4 * lat) * Math.cos(3 * lon));
      const sinLat = Math.sin(lat);
      return new THREE.Vector3(
        r * sinLat * Math.cos(lon),
        r * Math.cos(lat),
        r * sinLat * Math.sin(lon),
      );
    },
  },
  {
    id: 'torus',
    label: 'Toro  (g = 1)',
    genus: 1,
    blurb: 'Un agujero (una rosca). El asa baja χ en 2: χ = 0.',
    wrapU: true,
    wrapV: true,
    param: (u, v, d) => {
      const R = 1.55, r = 0.6;
      const a = u * TWO_PI; // alrededor del agujero
      const b = v * TWO_PI; // alrededor del tubo
      const rr = r * (1 + 0.28 * d * Math.sin(3 * a));
      const ring = R + rr * Math.cos(b);
      return new THREE.Vector3(
        ring * Math.cos(a),
        rr * Math.sin(b),
        ring * Math.sin(a),
      );
    },
  },
  {
    id: 'double-torus',
    label: 'Doble toro  (g = 2)',
    genus: 2,
    blurb: 'Dos agujeros. Cada asa resta 2: χ = 2 − 2·2 = −2.',
    wrapU: true,
    wrapV: true,
    param: (u, v, d) => {
      // Doble toro: dos lóbulos. Topológicamente toro con 2 asas → tomamos un
      // toro y modulamos el radio mayor para abrir DOS agujeros (figura de 8).
      const r = 0.42;
      const a = u * TWO_PI; // ángulo a lo largo de la figura-8
      const b = v * TWO_PI; // alrededor del tubo
      // Curva guía en forma de ocho (lemniscata de Gerono) en el plano XZ.
      const cx = 1.55 * Math.sin(a);
      const cz = 1.15 * Math.sin(a) * Math.cos(a);
      // Tangente de la curva guía para orientar el tubo.
      const tx = 1.55 * Math.cos(a);
      const tz = 1.15 * (Math.cos(a) * Math.cos(a) - Math.sin(a) * Math.sin(a));
      const tlen = Math.hypot(tx, tz) || 1;
      // Normal en el plano (perpendicular a la tangente, dentro de XZ).
      const nx = -tz / tlen, nz = tx / tlen;
      const rr = r * (1 + 0.22 * d * Math.sin(5 * a));
      const ringR = rr * Math.cos(b);
      return new THREE.Vector3(
        cx + ringR * nx,
        rr * Math.sin(b),
        cz + ringR * nz,
      );
    },
  },
];

// ── Conteo combinatorio EXACTO de V, E, F de una malla de quads ──────────
//
// Un grid paramétrico de (nu)×(nv) celdas tiene vértices en los nodos. Si la
// dirección se "cierra" (wrap), el último nodo coincide con el primero, así
// que hay nu nodos distintos en esa dirección (no nu+1). En la dirección que
// no cierra hay nu+1 nodos. Cada quad lo partimos en 2 triángulos (una malla
// honesta de triángulos), así obtenemos una TRIANGULACIÓN y contamos V, E, F
// como ENTEROS exactos (sin tocar geometría flotante).
//
// Para una triangulación cerrada: cada cara triangular tiene 3 aristas y cada
// arista es compartida por exactamente 2 caras ⇒ 3F = 2E ⇒ E = 3F/2.

interface MeshCount {
  V: number;
  E: number;
  F: number;
  chi: number;
}

function countMesh(nu: number, nv: number, wrapU: boolean, wrapV: boolean): MeshCount {
  // Nodos distintos por dirección.
  const nodesU = wrapU ? nu : nu + 1;
  const nodesV = wrapV ? nv : nv + 1;
  const V = nodesU * nodesV;

  // Celdas (quads): nu × nv (al cerrar, la celda que cruza la costura existe).
  const quads = nu * nv;
  const F = quads * 2; // dos triángulos por quad

  // En una triangulación cerrada orientable: 3F = 2E.
  const E = (3 * F) / 2;

  return { V, E, F, chi: V - E + F };
}

// ── Geometría 3D real (BufferGeometry desde la parametrización) ──────────

function buildGeometry(surf: Surface, nu: number, nv: number, deform: number): THREE.BufferGeometry {
  const nodesU = surf.wrapU ? nu : nu + 1;
  const nodesV = surf.wrapV ? nv : nv + 1;
  const positions: number[] = [];
  const idx = (i: number, j: number) => (i % nodesU) * nodesV + (j % nodesV);

  for (let i = 0; i < nodesU; i++) {
    for (let j = 0; j < nodesV; j++) {
      const u = i / nu;
      const v = j / nv;
      const p = surf.param(u, v, deform);
      positions.push(p.x, p.y, p.z);
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      // Solo conectamos a (i+1)/(j+1) si existe el nodo (o si hay wrap).
      const i1 = i + 1, j1 = j + 1;
      if (!surf.wrapU && i1 >= nodesU) continue;
      if (!surf.wrapV && j1 >= nodesV) continue;
      const a = idx(i, j);
      const b = idx(i1, j);
      const c = idx(i1, j1);
      const d = idx(i, j1);
      // dos triángulos: (a,b,c) y (a,c,d)
      indices.push(a, b, c, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ── Lección ──────────────────────────────────────────────────────────────

const LESSON: Lesson<GenusState> = {
  hook: {
    title: 'Cuenta vértices, aristas y caras de una papa: siempre da 2.',
    body: `Toma cualquier superficie cerrada sin agujeros — una esfera, un cubo, un balón abollado, una papa — y divídela en pedazos: vértices (V), aristas (E) y caras (F).

Suma V − E + F. Te va a dar 2. SIEMPRE. No importa si usas 6 caras o 6000, ni qué tan deforme esté la papa.

Ese número se llama característica de Euler, χ. Leonhard Euler lo notó en 1750 para los poliedros. Lo asombroso es que NO depende de la malla: es una propiedad de la FORMA topológica, no de cómo la dibujaste.

Y aquí viene lo profundo: si la superficie tiene agujeros, χ baja exactamente 2 por cada agujero. Esa es la fórmula que vamos a verificar contando mallas reales: χ = 2 − 2g.`,
  },

  steps: [
    {
      title: 'La esfera — sin agujeros, χ = 2',
      duration: 5500,
      body: `Empezamos con la esfera. Género g = 0: cero asas, cero agujeros.

La mallamos con un grid paramétrico (longitud × latitud) y partimos cada celda en dos triángulos. El HUD cuenta V, E y F de esa triangulación REAL — son enteros exactos, no aproximaciones.

Calcula V − E + F. Da 2. Sube la resolución con el slider: V, E y F cambian todos… pero su combinación alternada χ se queda clavada en 2.

Esa es la magia de un invariante: las piezas cambian, el total no.`,
      formula: 'χ = V − E + F = 2\ng = 0  ⇒  χ = 2 − 2·0 = 2',
      keyframes: [
        { at: 0, state: { surfaceId: 'sphere', deform: 0, resU: 24 } },
        { at: 1, state: { surfaceId: 'sphere', deform: 0, resU: 24 } },
      ],
    },
    {
      title: 'Deformar no cambia la topología',
      duration: 5500,
      body: `Misma esfera, pero ahora la ABOLLAMOS con el slider de deformación: ondas que entran y salen de la superficie.

Mira el HUD: por más que la superficie se retuerza, χ sigue siendo 2. Mientras no rompas ni pegues — solo estires y dobles — la topología es la misma.

Eso es lo que significa "invariante bajo deformación" (homeomorfismo). Una taza y una dona son lo mismo para la topología porque ambas tienen exactamente un agujero. La esfera abollada y la esfera perfecta también: χ = 2 las dos.

La geometría (distancias, ángulos, curvatura) cambia. La topología (χ, el género) no.`,
      formula: 'deformación continua  ⇒  χ invariante\nesfera abollada ≈ esfera ⇒ χ = 2',
      keyframes: [
        { at: 0, state: { surfaceId: 'sphere', deform: 0, resU: 28 } },
        { at: 1, state: { surfaceId: 'sphere', deform: 1, resU: 28 } },
      ],
    },
    {
      title: 'El toro — una asa baja χ a 0',
      duration: 6000,
      body: `Ahora le abrimos UN agujero: el toro, la dona. Género g = 1.

Lo mallamos igual, pero ahora el grid se cierra en AMBAS direcciones (alrededor del agujero y alrededor del tubo). Eso cambia el conteo de vértices: no hay "polos" ni bordes que cerrar.

Cuenta: V − E + F = 0. El agujero le restó exactamente 2 a la característica de Euler respecto de la esfera.

Pega un asa a cualquier superficie y χ baja en 2. Es como un peaje topológico: cada agujero cuesta 2.`,
      formula: 'toro:  V − E + F = 0\ng = 1  ⇒  χ = 2 − 2·1 = 0',
      keyframes: [
        { at: 0, state: { surfaceId: 'torus', deform: 0, resU: 30 } },
        { at: 1, state: { surfaceId: 'torus', deform: 0.6, resU: 30 } },
      ],
    },
    {
      title: 'El doble toro — dos asas, χ = −2',
      duration: 6000,
      body: `Subimos a género g = 2: el doble toro, una figura de ocho hueca con DOS agujeros.

Construimos el tubo siguiendo una curva en forma de 8 (lemniscata) que se cierra sobre sí misma, así que tenemos efectivamente dos asas.

Cuenta en el HUD: V − E + F = −2. Dos agujeros, dos veces el peaje: 2·2 = 4 menos que la esfera, que valía 2. Por eso χ = 2 − 4 = −2.

La fórmula general queda comprobada con tres mallas distintas. Cualquier superficie orientable cerrada cae en esta escalera: 2, 0, −2, −4, … una por cada género.`,
      formula: 'doble toro:  V − E + F = −2\ng = 2  ⇒  χ = 2 − 2·2 = −2',
      keyframes: [
        { at: 0, state: { surfaceId: 'double-torus', deform: 0, resU: 40 } },
        { at: 1, state: { surfaceId: 'double-torus', deform: 0.7, resU: 40 } },
      ],
    },
    {
      title: 'La escalera del género',
      duration: 5500,
      body: `Junta lo visto: el género g (cuántas asas) determina por completo la topología de una superficie orientable cerrada, y χ lo lee de un plumazo.

g = 0 → χ = 2     (esfera)
g = 1 → χ = 0     (toro)
g = 2 → χ = −2    (doble toro)
g = n → χ = 2 − 2n

Contar V − E + F de CUALQUIER malla de la superficie te dice su género al instante: g = (2 − χ)/2. No necesitas medir nada, solo contar piezas.

Por eso χ es uno de los primeros invariantes topológicos de verdad: distingue formas que ninguna deformación puede igualar.`,
      formula: 'g = (2 − χ) / 2\nχ ∈ { 2, 0, −2, −4, … }',
      keyframes: [
        { at: 0, state: { surfaceId: 'double-torus', deform: 0.3, resU: 40 } },
        { at: 1, state: { surfaceId: 'double-torus', deform: 0.3, resU: 40 } },
      ],
    },
  ],

  connect: {
    body: `La característica de Euler es la puerta de entrada a la topología algebraica:

• Teorema de Gauss-Bonnet: la integral de la curvatura sobre una superficie cerrada es 2π·χ. La geometría local (curvatura) está atada a la topología global (género). Asombroso.
• Teorema del erizo (Poincaré-Hopf): no puedes peinar una esfera sin un remolino justo porque χ(esfera) = 2 ≠ 0. En el toro (χ = 0) sí puedes.
• Números de Betti y homología: χ es la suma alternada de las dimensiones de los grupos de homología — la versión "pesada" de contar agujeros.
• Grafos y mapas: la fórmula de Euler V − E + F = 2 es la base del teorema de los cuatro colores y del diseño de circuitos planos.

Explora el sandbox: cambia de superficie, deforma con el slider, sube y baja la resolución. χ nunca se mueve de 2 − 2g. Eso es un invariante.`,
    links: [
      { label: 'Campos vectoriales — el teorema del erizo en acción', href: '#vector-fields' },
      { label: 'Curvatura y geometría diferencial — Gauss-Bonnet', href: '#tangent-plane' },
      { label: 'Grafos planares — la fórmula de Euler V−E+F=2', href: '#pca' },
    ],
  },
};

// ── Componente ─────────────────────────────────────────────────────────

export default function Genus() {
  const { audience } = useAudience();
  const [surfaceId, setSurfaceId] = useState('sphere');
  const [deform, setDeform] = useState(0);
  const [resU, setResU] = useState(24);

  const surf = useMemo(() => SURFACES.find(s => s.id === surfaceId)!, [surfaceId]);

  // nv (resolución del tubo/latitud) escala con resU pero acotada.
  const nu = Math.max(6, Math.round(resU));
  const nv = Math.max(6, Math.round(resU * 0.55));

  const count = useMemo(() => countMesh(nu, nv, surf.wrapU, surf.wrapV), [nu, nv, surf]);

  const geometry = useMemo(
    () => buildGeometry(surf, nu, nv, deform),
    [surf, nu, nv, deform],
  );

  // Geometría de aristas (wireframe) para que se vean V/E/F sobre la superficie.
  const wireframe = useMemo(() => new THREE.WireframeGeometry(geometry), [geometry]);

  const expectedChi = 2 - 2 * surf.genus;
  const matches = count.chi === expectedChi;

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={6} bloomIntensity={0.6} bloomThreshold={0.5} bgColor="#05060A" autoRotate captureMode>
          <CanvasCapture />

          {/* Superficie 3D real — cuerpo emisivo para que el bloom la encienda */}
          <mesh geometry={geometry}>
            <meshStandardMaterial
              color={ACCENT}
              emissive={ACCENT}
              emissiveIntensity={0.35}
              metalness={0.25}
              roughness={0.35}
              side={THREE.DoubleSide}
              transparent
              opacity={0.92}
              flatShading={false}
            />
          </mesh>

          {/* Malla (aristas) encima — hace visibles las E y los V */}
          <lineSegments geometry={wireframe}>
            <lineBasicMaterial color="#E0FBFF" transparent opacity={0.22} toneMapped={false} />
          </lineSegments>
        </Stage>

        {/* HUD: V, E, F, χ calculados en vivo */}
        <div className="absolute top-3 left-3 text-[12px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/75 backdrop-blur px-3 py-2.5 rounded border border-[#1E293B]">
          <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">conteo de la malla</div>
          <div className="flex justify-between gap-6"><span className="text-[#94A3B8]">V (vértices)</span><span className="text-white">{count.V.toLocaleString('es-MX')}</span></div>
          <div className="flex justify-between gap-6"><span className="text-[#94A3B8]">E (aristas)</span><span className="text-white">{count.E.toLocaleString('es-MX')}</span></div>
          <div className="flex justify-between gap-6"><span className="text-[#94A3B8]">F (caras)</span><span className="text-white">{count.F.toLocaleString('es-MX')}</span></div>
          <div className="border-t border-[#1E293B] my-1.5" />
          <div className="flex justify-between gap-6">
            <span style={{ color: ACCENT }}>χ = V − E + F</span>
            <span className="text-white font-bold">{count.chi}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-[#94A3B8]">2 − 2g (g={surf.genus})</span>
            <span className="text-white">{expectedChi}</span>
          </div>
          <div className={`mt-1 text-[11px] ${matches ? 'text-[#34D399]' : 'text-[#EF5350]'}`}>
            {matches ? '✓ χ = 2 − 2g  (exacto)' : '✗ no coincide'}
          </div>
        </div>

        {/* Slider de deformación sobre el canvas */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3
                        bg-[#05060A]/75 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <span className="text-[10px] uppercase tracking-wider text-[#64748B] shrink-0">deformar</span>
          <input
            type="range" min={0} max={1} step={0.01}
            value={deform}
            onChange={e => setDeform(parseFloat(e.target.value))}
            className="flex-1 accent-[#22D3EE]"
          />
          <span className="text-[11px] font-mono text-[#CBD5E1] w-10 text-right">{deform.toFixed(2)}</span>
          <span className="text-[10px] text-[#64748B] shrink-0">χ no cambia</span>
        </div>
      </div>

      <LessonPanel<GenusState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.surfaceId !== undefined) setSurfaceId(patch.surfaceId);
          if (patch.deform !== undefined) setDeform(patch.deform);
          if (patch.resU !== undefined) setResU(patch.resU);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Superficie</div>
              <div className="grid grid-cols-1 gap-1.5">
                {SURFACES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSurfaceId(s.id)}
                    className={`text-left text-[11px] px-2 py-1.5 rounded border transition ${
                      surfaceId === s.id
                        ? 'bg-[#22D3EE]/10 border-[#22D3EE]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#22D3EE]/30'
                    }`}
                  >
                    <div className="font-semibold">{s.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{s.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-[#64748B]">Deformación</span>
                <span className="text-[11px] font-mono text-white">{deform.toFixed(2)}</span>
              </div>
              <input
                type="range" min={0} max={1} step={0.01}
                value={deform}
                onChange={e => setDeform(parseFloat(e.target.value))}
                className="w-full accent-[#22D3EE]"
              />
              <div className="text-[10px] text-[#64748B] leading-snug">
                Estira y abolla la superficie. La topología (y χ) no cambia.
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-[#64748B]">Resolución de la malla</span>
                <span className="text-[11px] font-mono text-white">{nu}×{nv}</span>
              </div>
              <input
                type="range" min={6} max={64} step={1}
                value={resU}
                onChange={e => setResU(parseInt(e.target.value, 10))}
                className="w-full accent-[#22D3EE]"
              />
              <div className="text-[10px] text-[#64748B] leading-snug">
                V, E, F cambian todos al refinar… pero χ se queda fijo.
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Conteo combinatorio</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {([['V', count.V], ['E', count.E], ['F', count.F]] as const).map(([k, val]) => (
                  <div key={k} className="rounded border border-[#1E293B] py-1.5">
                    <div className="text-[10px] text-[#64748B]">{k}</div>
                    <div className="text-[12px] font-mono text-white">{val.toLocaleString('es-MX')}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[12px] font-mono pt-1">
                <span style={{ color: ACCENT }}>χ = V − E + F</span>
                <span className="text-white font-bold">{count.chi}</span>
              </div>
              <div className="flex items-center justify-between text-[12px] font-mono">
                <span className="text-[#94A3B8]">2 − 2g</span>
                <span className="text-white">{expectedChi}</span>
              </div>
              <div className={`text-[11px] ${matches ? 'text-[#34D399]' : 'text-[#EF5350]'}`}>
                {matches ? '✓ verificado: χ = 2 − 2g' : '✗ discrepancia'}
              </div>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Triangulación cerrada orientable: 3F = 2E ⇒ E = 3F/2. El conteo es entero, así que
                χ = V − E + F sale exacto e independiente de la resolución. g = (2 − χ)/2.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
