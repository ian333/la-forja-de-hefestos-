/**
 * Género de superficies — la característica de Euler como invariante topológico.
 *
 *   χ = V − E + F
 *
 * Para CUALQUIER triangulación de una superficie orientable cerrada, vértices
 * menos aristas más caras da SIEMPRE el mismo número, sin importar cuán fina
 * sea la malla ni cómo la deformes. Ese número solo depende del GÉNERO g
 * (cantidad de "asas"/agujeros):
 *
 *   χ = 2 − 2g
 *
 *   esfera        g = 0  →  χ = 2
 *   toro          g = 1  →  χ = 0
 *   doble toro    g = 2  →  χ = −2
 *
 * Acá NO se hardcodea χ. Se construye una malla real de cada superficie y se
 * cuentan V, E, F directamente de ESA triangulación:
 *   - V = vértices distintos usados,
 *   - E = aristas no-dirigidas únicas (deduplicadas),
 *   - F = número de triángulos.
 * El conteo es combinatorio (entero) sobre la misma malla que se dibuja, así
 * que χ = V − E + F sale exacto e independiente de la resolución y de la
 * deformación. El doble toro se construye como SUMA CONEXA de dos toros
 * (quitar una cara a cada uno y pegar los bordes), que es genuinamente g = 2.
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

const ACCENT = '#22D3EE'; // acento topología (cian)
const TWO_PI = Math.PI * 2;

interface GenusState {
  surfaceId: string;
  deform: number; // 0..1 cantidad de deformación (la χ NO cambia)
  res: number;    // resolución base de la malla
}

// ── Resultado de construir una superficie: malla 3D real + conteo exacto ──

interface BuiltSurface {
  geometry: THREE.BufferGeometry;
  V: number;
  E: number;
  F: number;
  chi: number;
}

/**
 * Cuenta V, E, F EXACTOS de una lista de triángulos (índices de vértice ya
 * deduplicados). E = aristas no-dirigidas únicas; F = #triángulos; V = vértices
 * realmente usados. Es la misma malla que se renderiza, así que el HUD describe
 * literalmente lo que ves.
 */
function countTriangulation(tris: number[][]): { V: number; E: number; F: number; chi: number } {
  const F = tris.length;
  const edges = new Set<string>();
  const used = new Set<number>();
  const key = (x: number, y: number) => (x < y ? `${x}_${y}` : `${y}_${x}`);
  for (const [a, b, c] of tris) {
    edges.add(key(a, b));
    edges.add(key(b, c));
    edges.add(key(c, a));
    used.add(a); used.add(b); used.add(c);
  }
  const V = used.size;
  const E = edges.size;
  return { V, E, F, chi: V - E + F };
}

// Construye una BufferGeometry desde posiciones + índices de triángulo.
function geometryFrom(positions: number[], tris: number[][]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(tris.flat());
  geo.computeVertexNormals();
  return geo;
}

// ── Esfera (UV) — polos como un único vértice (fans), interior con wrap ────
//
// nv anillos de latitud: polo norte (1 vtx) + (nv−1) anillos interiores de nu
// vértices + polo sur (1 vtx). Tapas = triángulos; medio = quads → 2 tri c/u.

function buildSphere(nu: number, nv: number, deform: number): BuiltSurface {
  const positions: number[] = [];
  const R = 1.6;
  const sample = (lon: number, lat: number) => {
    const r = R * (1 + 0.18 * deform * Math.sin(4 * lat) * Math.cos(3 * lon));
    const sinLat = Math.sin(lat);
    positions.push(
      r * sinLat * Math.cos(lon),
      r * Math.cos(lat),
      r * sinLat * Math.sin(lon),
    );
  };

  // polo norte = índice 0, polo sur = índice 1
  sample(0, 0);            // norte (lat 0)
  sample(0, Math.PI);      // sur   (lat π)
  let next = 2;
  const ring: number[][] = []; // ring[j-1][i], j = 1..nv-1
  for (let j = 1; j <= nv - 1; j++) {
    const lat = (j / nv) * Math.PI;
    const row: number[] = [];
    for (let i = 0; i < nu; i++) {
      const lon = (i / nu) * TWO_PI;
      sample(lon, lat);
      row.push(next++);
    }
    ring.push(row);
  }

  const tris: number[][] = [];
  const NORTH = 0, SOUTH = 1;
  const r1 = ring[0];
  for (let i = 0; i < nu; i++) tris.push([NORTH, r1[i], r1[(i + 1) % nu]]);
  for (let j = 1; j <= nv - 2; j++) {
    const a = ring[j - 1], b = ring[j];
    for (let i = 0; i < nu; i++) {
      const i1 = (i + 1) % nu;
      tris.push([a[i], a[i1], b[i1]]);
      tris.push([a[i], b[i1], b[i]]);
    }
  }
  const rL = ring[nv - 2];
  for (let i = 0; i < nu; i++) tris.push([SOUTH, rL[(i + 1) % nu], rL[i]]);

  const { V, E, F, chi } = countTriangulation(tris);
  return { geometry: geometryFrom(positions, tris), V, E, F, chi };
}

// ── Toro — wrap en ambas direcciones ──────────────────────────────────────

function buildTorus(nu: number, nv: number, deform: number): BuiltSurface {
  const positions: number[] = [];
  const R = 1.55, r0 = 0.62;
  const id = (i: number, j: number) => (i % nu) * nv + (j % nv);
  for (let i = 0; i < nu; i++) {
    const a = (i / nu) * TWO_PI; // alrededor del agujero
    for (let j = 0; j < nv; j++) {
      const b = (j / nv) * TWO_PI; // alrededor del tubo
      const rr = r0 * (1 + 0.28 * deform * Math.sin(3 * a));
      const ringR = R + rr * Math.cos(b);
      positions.push(ringR * Math.cos(a), rr * Math.sin(b), ringR * Math.sin(a));
    }
  }
  const tris: number[][] = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
      tris.push([a, b, c]);
      tris.push([a, c, d]);
    }
  }
  const { V, E, F, chi } = countTriangulation(tris);
  return { geometry: geometryFrom(positions, tris), V, E, F, chi };
}

// ── Doble toro — SUMA CONEXA de dos toros ─────────────────────────────────
//
// Construimos dos toros (genus 1 cada uno, χ = 0), les quitamos UNA cara
// (un quad = 2 triángulos) a cada uno, y pegamos los dos bordes resultantes
// con una banda tubular. Conexa: χ = χ₁ + χ₂ − 2 = 0 + 0 − 2 = −2  ⇒ g = 2.

function buildDoubleTorus(nu: number, nv: number, deform: number): BuiltSurface {
  const positions: number[] = [];
  const R = 1.05, r0 = 0.5;

  // Toro 1 desplazado a −X, toro 2 a +X; el agujero a quitar mira hacia el otro.
  const emitTorus = (cx: number, sign: number, offset: number) => {
    const id = (i: number, j: number) => offset + (i % nu) * nv + (j % nv);
    for (let i = 0; i < nu; i++) {
      const a = (i / nu) * TWO_PI;
      for (let j = 0; j < nv; j++) {
        const b = (j / nv) * TWO_PI;
        const rr = r0 * (1 + 0.22 * deform * Math.sin(5 * a));
        const ringR = R + rr * Math.cos(b);
        // toro en plano XY, eje del agujero = Z; desplazado en X
        positions.push(cx + sign * ringR * Math.cos(a), ringR * Math.sin(a), rr * Math.sin(b));
      }
    }
    return id;
  };

  const gap = 1.35;
  const id1 = emitTorus(-gap, 1, 0);
  const id2 = emitTorus(gap, -1, nu * nv);

  // Cara (quad) a quitar en cada toro: la celda (i0, j0). La elegimos en el
  // borde interno que mira al otro toro (i0 cerca de a=0 / a=π por el signo).
  const i0a = 0, j0 = 0;
  const i0b = 0, j0b = 0;

  const quad = (id: (i: number, j: number) => number, i0: number, jj: number) =>
    [id(i0, jj), id(i0 + 1, jj), id(i0 + 1, jj + 1), id(i0, jj + 1)] as const;

  const tris: number[][] = [];
  const emitQuads = (
    id: (i: number, j: number) => number,
    skipI: number,
    skipJ: number,
  ) => {
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        if (i === skipI && j === skipJ) continue; // dejar el agujero
        const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
        tris.push([a, b, c]);
        tris.push([a, c, d]);
      }
    }
  };
  emitQuads(id1, i0a, j0);
  emitQuads(id2, i0b, j0b);

  // Bordes de los dos agujeros (ciclos de 4 vértices) y banda que los une.
  const q1 = quad(id1, i0a, j0);   // [a,b,c,d]
  const q2 = quad(id2, i0b, j0b);
  for (let k = 0; k < 4; k++) {
    const a = q1[k], b = q1[(k + 1) % 4];
    const c = q2[k], d = q2[(k + 1) % 4];
    tris.push([a, b, d]);
    tris.push([a, d, c]);
  }

  const { V, E, F, chi } = countTriangulation(tris);
  return { geometry: geometryFrom(positions, tris), V, E, F, chi };
}

// ── Catálogo de superficies ───────────────────────────────────────────────

interface SurfaceDef {
  id: string;
  label: string;
  genus: number;
  blurb: string;
  build: (nu: number, nv: number, deform: number) => BuiltSurface;
}

const SURFACES: SurfaceDef[] = [
  {
    id: 'sphere',
    label: 'Esfera  (g = 0)',
    genus: 0,
    blurb: 'Sin agujeros. La superficie cerrada más simple. χ = 2.',
    build: buildSphere,
  },
  {
    id: 'torus',
    label: 'Toro  (g = 1)',
    genus: 1,
    blurb: 'Un agujero (una rosca). El asa baja χ en 2: χ = 0.',
    build: buildTorus,
  },
  {
    id: 'double-torus',
    label: 'Doble toro  (g = 2)',
    genus: 2,
    blurb: 'Dos agujeros (suma conexa de dos toros). χ = 2 − 2·2 = −2.',
    build: buildDoubleTorus,
  },
];

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
        { at: 0, state: { surfaceId: 'sphere', deform: 0, res: 22 } },
        { at: 1, state: { surfaceId: 'sphere', deform: 0, res: 22 } },
      ],
    },
    {
      title: 'Deformar no cambia la topología',
      duration: 5500,
      body: `Misma esfera, pero ahora la ABOLLAMOS con el slider de deformación: ondas que entran y salen de la superficie.

Mira el HUD: por más que la superficie se retuerza, χ sigue siendo 2. Mientras no rompas ni pegues — solo estires y dobles — la topología es la misma.

Eso es lo que significa "invariante bajo deformación" (homeomorfismo). Una taza y una dona son lo mismo para la topología porque ambas tienen exactamente un agujero. La esfera abollada y la esfera perfecta también: χ = 2 las dos.

La geometría (distancias, ángulos, curvatura) cambia. La topología (χ, el género) no.`,
      formula: 'deformación continua  ⇒  χ invariante\nesfera abollada ≅ esfera ⇒ χ = 2',
      keyframes: [
        { at: 0, state: { surfaceId: 'sphere', deform: 0, res: 26 } },
        { at: 1, state: { surfaceId: 'sphere', deform: 1, res: 26 } },
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
        { at: 0, state: { surfaceId: 'torus', deform: 0, res: 26 } },
        { at: 1, state: { surfaceId: 'torus', deform: 0.6, res: 26 } },
      ],
    },
    {
      title: 'El doble toro — dos asas, χ = −2',
      duration: 6000,
      body: `Subimos a género g = 2: el doble toro. Lo armamos como SUMA CONEXA de dos toros: a cada toro le quitamos una cara y pegamos los bordes con un tubo.

Quitar y pegar de ese modo resta exactamente 2 a la suma de las características: χ = χ₁ + χ₂ − 2 = 0 + 0 − 2.

Cuenta en el HUD: V − E + F = −2. Dos agujeros, dos veces el peaje. Por eso χ = 2 − 4 = −2.

La fórmula general queda comprobada con tres mallas distintas. Cualquier superficie orientable cerrada cae en esta escalera.`,
      formula: 'doble toro:  V − E + F = −2\nχ = χ₁ + χ₂ − 2 = 0 + 0 − 2\ng = 2  ⇒  χ = 2 − 2·2 = −2',
      keyframes: [
        { at: 0, state: { surfaceId: 'double-torus', deform: 0, res: 30 } },
        { at: 1, state: { surfaceId: 'double-torus', deform: 0.7, res: 30 } },
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
        { at: 0, state: { surfaceId: 'double-torus', deform: 0.3, res: 30 } },
        { at: 1, state: { surfaceId: 'double-torus', deform: 0.3, res: 30 } },
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
      { label: 'Plano tangente — curvatura y Gauss-Bonnet', href: '#tangent-plane' },
      { label: 'PCA — los grafos planares y la fórmula de Euler', href: '#pca' },
    ],
  },
};

// ── Componente ─────────────────────────────────────────────────────────

export default function Genus() {
  const { audience } = useAudience();
  const [surfaceId, setSurfaceId] = useState('sphere');
  const [deform, setDeform] = useState(0);
  const [res, setRes] = useState(22);

  const surf = useMemo(() => SURFACES.find(s => s.id === surfaceId)!, [surfaceId]);

  // nu (a lo largo / longitud) y nv (tubo / latitud): nv menor pero ≥ 6.
  const nu = Math.max(6, Math.round(res));
  const nv = Math.max(6, Math.round(res * 0.55));

  const built = useMemo(
    () => surf.build(nu, nv, deform),
    [surf, nu, nv, deform],
  );

  // Aristas (wireframe) para que se vean V/E/F sobre la superficie.
  const wireframe = useMemo(() => new THREE.WireframeGeometry(built.geometry), [built.geometry]);

  const expectedChi = 2 - 2 * surf.genus;
  const matches = built.chi === expectedChi;

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={6} bloomIntensity={0.6} bloomThreshold={0.5} bgColor="#05060A" autoRotate captureMode>
          <CanvasCapture />

          {/* Superficie 3D real — cuerpo emisivo para que el bloom la encienda */}
          <mesh geometry={built.geometry}>
            <meshStandardMaterial
              color={ACCENT}
              emissive={ACCENT}
              emissiveIntensity={0.35}
              metalness={0.25}
              roughness={0.35}
              side={THREE.DoubleSide}
              transparent
              opacity={0.92}
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
          <div className="flex justify-between gap-6"><span className="text-[#94A3B8]">V (vértices)</span><span className="text-white">{built.V.toLocaleString('es-MX')}</span></div>
          <div className="flex justify-between gap-6"><span className="text-[#94A3B8]">E (aristas)</span><span className="text-white">{built.E.toLocaleString('es-MX')}</span></div>
          <div className="flex justify-between gap-6"><span className="text-[#94A3B8]">F (caras)</span><span className="text-white">{built.F.toLocaleString('es-MX')}</span></div>
          <div className="border-t border-[#1E293B] my-1.5" />
          <div className="flex justify-between gap-6">
            <span style={{ color: ACCENT }}>χ = V − E + F</span>
            <span className="text-white font-bold">{built.chi}</span>
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
          if (patch.res !== undefined) setRes(patch.res);
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
                type="range" min={8} max={48} step={1}
                value={res}
                onChange={e => setRes(parseInt(e.target.value, 10))}
                className="w-full accent-[#22D3EE]"
              />
              <div className="text-[10px] text-[#64748B] leading-snug">
                V, E, F cambian todos al refinar… pero χ se queda fijo.
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Conteo combinatorio</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {([['V', built.V], ['E', built.E], ['F', built.F]] as const).map(([k, val]) => (
                  <div key={k} className="rounded border border-[#1E293B] py-1.5">
                    <div className="text-[10px] text-[#64748B]">{k}</div>
                    <div className="text-[12px] font-mono text-white">{val.toLocaleString('es-MX')}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[12px] font-mono pt-1">
                <span style={{ color: ACCENT }}>χ = V − E + F</span>
                <span className="text-white font-bold">{built.chi}</span>
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
                V, E, F se cuentan de la MISMA malla que se dibuja (E = aristas no-dirigidas únicas,
                F = #triángulos). χ = V − E + F sale entero, exacto e independiente de la resolución.
                Doble toro = suma conexa: χ = χ₁ + χ₂ − 2. Género: g = (2 − χ)/2.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
