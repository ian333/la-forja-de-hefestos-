/**
 * Conjuntos y operaciones — el diagrama de Venn en 3D, calculado de verdad.
 *
 *   U = universo finito de elementos (enteros 1..N).
 *   A, B, C ⊆ U  son tres subconjuntos REALES (listas de elementos).
 *
 * Todo lo que ves se calcula sobre conjuntos reales con la API nativa Set<number>:
 * unión, intersección, diferencia y complemento NO están hardcodeados — se
 * evalúan elemento por elemento. Cada elemento de U se clasifica por su
 * "membresía" en A, B, C como un bit-mask de 3 bits:
 *
 *   bit 0 → ∈ A ?     bit 1 → ∈ B ?     bit 2 → ∈ C ?
 *
 * Eso da 8 regiones disjuntas (las 7 del Venn + el exterior). Un diagrama de Venn
 * de 3 conjuntos es EXACTAMENTE la partición de U en esas 8 celdas:
 *
 *   000  exterior  (complemento de A∪B∪C)      100  C\(A∪B)
 *   001  A\(B∪C)                                101  (A∩C)\B
 *   010  B\(A∪C)                                110  (B∩C)\A
 *   011  (A∩B)\C                                111  A∩B∩C
 *
 * El usuario elige una operación de conjunto; computamos el conjunto-resultado de
 * verdad y luego marcamos QUÉ celdas de la partición están contenidas en él. Esas
 * celdas se ILUMINAN (emissive intensa → bloom del Stage) y las demás quedan
 * apagadas. Así la identidad "operación de conjunto ≡ región del Venn" se vuelve
 * visible: la lógica booleana de membresía se vuelve geometría.
 *
 * Render: tres discos semitransparentes (esferas achatadas) en el plano,
 * dispuestos como el Venn clásico, con los elementos flotando como puntitos
 * emisivos colocados en el centroide de su celda. Etiquetas vía drei <Html>
 * (NO drei <Text>, que rompe el EffectComposer del Stage).
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

// ── Estado del módulo ──────────────────────────────────────────────────

interface SetsState {
  opId: string;
}

// ── Colores ────────────────────────────────────────────────────────────

const ACCENT = '#94A3B8';        // acento de la rama Fundamentos
const COL_A = '#4FC3F7';         // cian
const COL_B = '#34D399';         // verde
const COL_C = '#FDB813';         // dorado
const COL_RESULT = '#F472B6';    // rosa: lo que ENCIENDE la operación

// ── LESSON ─────────────────────────────────────────────────────────────

const LESSON: Lesson<SetsState> = {
  hook: {
    title: 'Toda operación de conjuntos es, en el fondo, una pregunta de sí o no por cada elemento.',
    body: `Un conjunto es solo una colección de cosas, sin orden y sin repetidos: A = {1, 2, 3}. Con tres conjuntos A, B y C dentro de un universo U, cada elemento de U responde tres preguntas: ¿estoy en A? ¿en B? ¿en C?

Esas tres respuestas (sí/no) forman un código de 3 bits. Y aquí está la idea clave: ese código parte al universo en exactamente 8 celdas disjuntas. Ese es, literalmente, el diagrama de Venn de tres conjuntos — siete pétalos visibles más el exterior.

Cuando pides una operación —unión, intersección, diferencia, complemento— en realidad estás eligiendo CUÁLES de esas 8 celdas te quedas. Nada de fórmulas mágicas: solo prendes o apagas regiones.

En esta clase calculamos los conjuntos de verdad (con la API Set de JavaScript) y encendemos las celdas del Venn que pertenecen al resultado. Verás la lógica booleana convertirse en geometría.`,
  },

  steps: [
    {
      title: 'Unión A ∪ B ∪ C — basta con estar en uno',
      duration: 5500,
      body: `Primera operación: A ∪ B ∪ C. Un elemento pertenece a la unión si está en A, O en B, O en C. Con "uno solo" alcanza.

Mira: se encienden TODAS las celdas con al menos un bit prendido — los siete pétalos. Solo queda apagado el exterior 000.

La unión es el "o" lógico (∨) aplicado a la membresía: x ∈ A∪B ⟺ (x∈A) ∨ (x∈B). Por eso cubre tanto.

En la práctica: si A son los alumnos de Cálculo, B los de Física y C los de Química, la unión es "todos los que llevan al menos una de las tres".`,
      formula: 'A ∪ B = { x ∈ U : x ∈ A ∨ x ∈ B }\nbits encendidos: 001,010,011,100,101,110,111',
      keyframes: [
        { at: 0, state: { opId: 'union' } },
        { at: 1, state: { opId: 'union' } },
      ],
    },
    {
      title: 'Intersección A ∩ B ∩ C — hay que estar en TODOS',
      duration: 5500,
      body: `Ahora A ∩ B ∩ C. Un elemento pertenece a la intersección solo si está en A, Y en B, Y en C. Exigimos las tres a la vez.

Mira: se enciende UNA sola celda, el corazón del Venn — la 111, donde se traslapan los tres discos.

La intersección es el "y" lógico (∧): x ∈ A∩B ⟺ (x∈A) ∧ (x∈B). Es mucho más exigente que la unión, por eso suele ser chica.

Si pruebas A ∩ B (solo dos) en el sandbox, verás que se encienden DOS celdas: la 011 y la 111 — todo lo que está en A y en B sin importar C.`,
      formula: 'A ∩ B = { x ∈ U : x ∈ A ∧ x ∈ B }\nA ∩ B ∩ C → solo el bit 111',
      keyframes: [
        { at: 0, state: { opId: 'inter' } },
        { at: 1, state: { opId: 'inter' } },
      ],
    },
    {
      title: 'Diferencia A \\ B — lo que tengo y tú no',
      duration: 6000,
      body: `La diferencia A \\ B son los elementos que están en A pero NO en B. Le "restas" a A todo lo que comparte con B.

Mira: se encienden las celdas con el bit de A prendido y el de B apagado — la 001 (solo A) y la 101 (A y C, pero no B). El traslape con B se apaga.

Formalmente A \\ B = A ∩ Bᶜ: la diferencia es intersectar A con el complemento de B. "Quitar" es "intersectar con lo de afuera".

Ojo: la diferencia NO es simétrica. A \\ B ≠ B \\ A. Pruébalas las dos en el sandbox y compara las celdas que encienden.`,
      formula: 'A \\ B = { x : x ∈ A ∧ x ∉ B } = A ∩ Bᶜ\nbits: A=1, B=0  → 001, 101',
      keyframes: [
        { at: 0, state: { opId: 'diffAB' } },
        { at: 1, state: { opId: 'diffAB' } },
      ],
    },
    {
      title: 'Complemento Aᶜ — todo lo que NO es A',
      duration: 6000,
      body: `El complemento Aᶜ son los elementos del universo U que NO están en A. Necesita un universo: "no estar en A" solo tiene sentido respecto a algo.

Mira: se apaga A entero (sus bits) y se enciende TODO lo demás, incluido el exterior 000 — porque el exterior tampoco está en A.

El complemento invierte el bit de A: x ∈ Aᶜ ⟺ ¬(x∈A). Es la negación lógica de la membresía.

De aquí salen las leyes de De Morgan, que enlazan complemento, unión e intersección:

(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ      (A ∩ B)ᶜ = Aᶜ ∪ Bᶜ

Negar un "o" lo vuelve "y", y al revés. Es la misma regla que usas al programar condiciones.`,
      formula: 'Aᶜ = U \\ A = { x ∈ U : x ∉ A }\nDe Morgan: (A∪B)ᶜ = Aᶜ ∩ Bᶜ',
      keyframes: [
        { at: 0, state: { opId: 'compA' } },
        { at: 1, state: { opId: 'compA' } },
      ],
    },
    {
      title: 'Diferencia simétrica A △ B — en uno o en otro, pero no en ambos',
      duration: 6000,
      body: `Última: la diferencia simétrica A △ B. Son los elementos que están en A o en B, pero NO en los dos a la vez. Es el "o exclusivo" (XOR) de conjuntos.

Mira: se encienden las celdas donde el bit de A y el bit de B son DISTINTOS — 001, 100, 101, 110 — y se apaga todo donde A y B coinciden (incluida la intersección 011 y 111).

A △ B = (A \\ B) ∪ (B \\ A) = (A ∪ B) \\ (A ∩ B). Es la unión menos el traslape.

Esta operación convierte a los conjuntos en un anillo booleano: △ se comporta como una suma (módulo 2) y ∩ como un producto. Es la base del álgebra de Boole que vive dentro de cada circuito digital.`,
      formula: 'A △ B = (A\\B) ∪ (B\\A) = (A∪B) \\ (A∩B)\nbit_A ≠ bit_B  → XOR',
      keyframes: [
        { at: 0, state: { opId: 'symdiff' } },
        { at: 1, state: { opId: 'symdiff' } },
      ],
    },
  ],

  connect: {
    body: `Acabas de ver que toda el álgebra de conjuntos es lógica booleana sobre la membresía de cada elemento, y que un diagrama de Venn no es un dibujo bonito: es la partición exacta del universo en celdas según ese código de bits.

Esto es el cimiento de casi todo lo demás:

• Lógica proposicional — ∪/∩/ᶜ son exactamente ∨/∧/¬; un Venn es una tabla de verdad dibujada.
• Probabilidad — P(A∪B) = P(A) + P(B) − P(A∩B) es inclusión-exclusión sobre estas mismas celdas.
• Bases de datos — UNION, INTERSECT, EXCEPT de SQL son estas operaciones sobre filas.
• Álgebra de Boole y circuitos — △ y ∩ hacen de los conjuntos un anillo (suma y producto módulo 2).
• Teoría de la medida — generalizar "contar elementos" a "medir tamaño" empieza aquí, con álgebras de conjuntos.

Juega en el sandbox: cambia la operación y observa qué celdas encienden. La lista de elementos por región te confirma que todo se calculó de verdad, elemento por elemento.`,
    links: [
      { label: 'Lógica proposicional — ∪/∩/ᶜ son ∨/∧/¬', href: '#logic' },
      { label: 'Probabilidad — inclusión-exclusión sobre celdas', href: '#monte-carlo' },
      { label: 'Combinatoria — contar elementos por región', href: '#combinatorics' },
    ],
  },
};

// ── Universo y conjuntos REALES ──────────────────────────────────────────
// U = {1..16}. A, B, C son subconjuntos elegidos para que las 7 celdas del Venn
// estén pobladas (ningún pétalo vacío) y el exterior también tenga elementos.

const UNIVERSE: number[] = Array.from({ length: 16 }, (_, i) => i + 1);

const SET_A = new Set<number>([1, 2, 3, 4, 5, 6, 7]);
const SET_B = new Set<number>([4, 5, 6, 7, 8, 9, 10, 11]);
const SET_C = new Set<number>([2, 3, 6, 7, 10, 11, 12, 13, 14]);
// Las 8 celdas quedan pobladas: solo A={1}, solo B={8,9}, solo C={12,13,14},
// A∩B\C={4,5}, A∩C\B={2,3}, B∩C\A={10,11}, A∩B∩C={6,7}, exterior={15,16}.

// ── Operaciones de conjunto REALES (Set nativo) ─────────────────────────

function union(...sets: Set<number>[]): Set<number> {
  const out = new Set<number>();
  for (const s of sets) for (const x of s) out.add(x);
  return out;
}
function intersection(...sets: Set<number>[]): Set<number> {
  if (sets.length === 0) return new Set<number>();
  const out = new Set<number>();
  for (const x of sets[0]) {
    if (sets.every((s) => s.has(x))) out.add(x);
  }
  return out;
}
function difference(a: Set<number>, b: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const x of a) if (!b.has(x)) out.add(x);
  return out;
}
function complement(a: Set<number>, universe: number[]): Set<number> {
  const out = new Set<number>();
  for (const x of universe) if (!a.has(x)) out.add(x);
  return out;
}
function symmetricDifference(a: Set<number>, b: Set<number>): Set<number> {
  return union(difference(a, b), difference(b, a));
}

// ── Catálogo de operaciones ──────────────────────────────────────────────

interface Operation {
  id: string;
  label: string;
  notation: string;
  blurb: string;
  compute: (A: Set<number>, B: Set<number>, C: Set<number>, U: number[]) => Set<number>;
}

const OPERATIONS: Operation[] = [
  {
    id: 'union',
    label: 'Unión total',
    notation: 'A ∪ B ∪ C',
    blurb: 'Estar en al menos uno. Enciende los 7 pétalos.',
    compute: (A, B, C) => union(A, B, C),
  },
  {
    id: 'inter',
    label: 'Intersección total',
    notation: 'A ∩ B ∩ C',
    blurb: 'Estar en los tres. Solo el corazón 111.',
    compute: (A, B, C) => intersection(A, B, C),
  },
  {
    id: 'interAB',
    label: 'Intersección A ∩ B',
    notation: 'A ∩ B',
    blurb: 'En A y en B (con o sin C). Celdas 011 y 111.',
    compute: (A, B) => intersection(A, B),
  },
  {
    id: 'diffAB',
    label: 'Diferencia A \\ B',
    notation: 'A \\ B',
    blurb: 'En A pero no en B = A ∩ Bᶜ.',
    compute: (A, B) => difference(A, B),
  },
  {
    id: 'diffBA',
    label: 'Diferencia B \\ A',
    notation: 'B \\ A',
    blurb: 'En B pero no en A. Distinta de A \\ B.',
    compute: (A, B) => difference(B, A),
  },
  {
    id: 'compA',
    label: 'Complemento Aᶜ',
    notation: 'Aᶜ = U \\ A',
    blurb: 'Todo el universo que no está en A (incluye el exterior).',
    compute: (A, _B, _C, U) => complement(A, U),
  },
  {
    id: 'symdiff',
    label: 'Dif. simétrica A △ B',
    notation: 'A △ B',
    blurb: 'En A o en B, no en ambos (XOR).',
    compute: (A, B) => symmetricDifference(A, B),
  },
  {
    id: 'deMorgan',
    label: 'De Morgan (A∪B)ᶜ',
    notation: '(A ∪ B)ᶜ',
    blurb: 'Ni en A ni en B = Aᶜ ∩ Bᶜ.',
    compute: (A, B, _C, U) => complement(union(A, B), U),
  },
];

// ── Geometría del Venn ───────────────────────────────────────────────────
// Tres discos en disposición triangular clásica. El centroide de cada celda se
// precalcula para colocar ahí los elementos.

const DISC_R = 1.55;        // radio de cada disco
const DISC_DIST = 1.05;     // distancia del centro del Venn a cada centro de disco

// Centros de A (arriba-izq), B (arriba-der), C (abajo) — Venn estándar.
const CENTER_A = new THREE.Vector2(-DISC_DIST * Math.cos(Math.PI / 6), DISC_DIST * Math.sin(Math.PI / 6));
const CENTER_B = new THREE.Vector2(DISC_DIST * Math.cos(Math.PI / 6), DISC_DIST * Math.sin(Math.PI / 6));
const CENTER_C = new THREE.Vector2(0, -DISC_DIST);

// Bitmask: bit0=A, bit1=B, bit2=C.  cell 0..7.
function maskOf(x: number, A: Set<number>, B: Set<number>, C: Set<number>): number {
  return (A.has(x) ? 1 : 0) | (B.has(x) ? 2 : 0) | (C.has(x) ? 4 : 0);
}

// Centroide aproximado de cada celda (en coordenadas del plano del Venn).
function cellCentroid(mask: number): THREE.Vector2 {
  switch (mask) {
    case 0b001: return CENTER_A.clone().add(new THREE.Vector2(-0.85, 0.35));        // solo A
    case 0b010: return CENTER_B.clone().add(new THREE.Vector2(0.85, 0.35));         // solo B
    case 0b100: return CENTER_C.clone().add(new THREE.Vector2(0, -0.85));           // solo C
    case 0b011: return new THREE.Vector2(0, DISC_DIST * Math.sin(Math.PI / 6) + 0.35); // A∩B \ C
    case 0b101: return CENTER_A.clone().lerp(CENTER_C, 0.5).add(new THREE.Vector2(-0.25, 0)); // A∩C \ B
    case 0b110: return CENTER_B.clone().lerp(CENTER_C, 0.5).add(new THREE.Vector2(0.25, 0));  // B∩C \ A
    case 0b111: return new THREE.Vector2(0, -0.05);                                  // A∩B∩C
    default:    return new THREE.Vector2(0, 0);                                      // exterior (lo colocamos aparte)
  }
}

// Disposición de los elementos del exterior, en una banda inferior fuera de los discos.
function exteriorPos(index: number, count: number): THREE.Vector2 {
  const span = 2.4;
  const x = count <= 1 ? 0 : -span / 2 + (span * index) / (count - 1);
  return new THREE.Vector2(x, -2.95);
}

// Anillo de puntos (vértices) para dibujar el contorno de un disco como <Line>.
function circlePoints(center: THREE.Vector2, r: number, segs = 96): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * Math.PI * 2;
    pts.push([center.x + r * Math.cos(t), center.y + r * Math.sin(t), 0]);
  }
  return pts;
}

// Reparte varios elementos de una misma celda alrededor de su centroide.
function spread(base: THREE.Vector2, index: number, count: number): THREE.Vector2 {
  if (count <= 1) return base.clone();
  const ring = 0.34;
  const ang = (index / count) * Math.PI * 2;
  const rad = ring * (0.5 + 0.5 * ((index % 2) === 0 ? 1 : 0.6));
  return base.clone().add(new THREE.Vector2(rad * Math.cos(ang), rad * Math.sin(ang)));
}

// ── Componente ───────────────────────────────────────────────────────────

export default function Sets() {
  const { audience } = useAudience();
  const [opId, setOpId] = useState<string>('union');

  const op = useMemo(() => OPERATIONS.find((o) => o.id === opId) ?? OPERATIONS[0], [opId]);

  // Conjunto-resultado REAL de la operación.
  const result = useMemo(
    () => op.compute(SET_A, SET_B, SET_C, UNIVERSE),
    [op],
  );

  // Clasifica cada elemento de U por su celda (bitmask) y arma la lista por región.
  const cells = useMemo(() => {
    const byMask: Record<number, number[]> = {};
    for (let m = 0; m < 8; m++) byMask[m] = [];
    for (const x of UNIVERSE) byMask[maskOf(x, SET_A, SET_B, SET_C)].push(x);
    return byMask;
  }, []);

  // ¿Qué celdas están ENCENDIDAS? Una celda está iluminada si TODOS sus elementos
  // pertenecen al resultado. Como las celdas son disjuntas y el resultado es unión
  // de celdas completas, basta probar un representante; pero si una celda está
  // vacía, decidimos por su definición de membresía con un "elemento testigo".
  const lit = useMemo(() => {
    const out: Record<number, boolean> = {};
    for (let m = 0; m < 8; m++) {
      const members = cells[m];
      if (members.length > 0) {
        // celda no vacía: encendida si su representante cae en el resultado.
        out[m] = result.has(members[0]);
      } else {
        out[m] = false; // celda vacía → nada que iluminar
      }
    }
    return out;
  }, [cells, result]);

  // Posiciones 3D de cada elemento (en el plano z=0), coloreado por si está en el resultado.
  const placed = useMemo(() => {
    const items: { x: number; pos: THREE.Vector2; mask: number; inResult: boolean }[] = [];
    const extMembers = cells[0];
    for (let m = 0; m < 8; m++) {
      const members = cells[m];
      members.forEach((x, i) => {
        const base = m === 0 ? exteriorPos(extMembers.indexOf(x), extMembers.length) : cellCentroid(m);
        const pos = m === 0 ? base : spread(base, i, members.length);
        items.push({ x, pos, mask: m, inResult: result.has(x) });
      });
    }
    return items;
  }, [cells, result]);

  // Discos: contorno + relleno tenue.
  const discs = useMemo(
    () => [
      { center: CENTER_A, color: COL_A, label: 'A', set: SET_A },
      { center: CENTER_B, color: COL_B, label: 'B', set: SET_B },
      { center: CENTER_C, color: COL_C, label: 'C', set: SET_C },
    ],
    [],
  );

  // Para la tabla de regiones del panel.
  const regionRows = useMemo(() => {
    const NAMES: Record<number, string> = {
      0b000: 'exterior (Uᶜ de A∪B∪C)',
      0b001: 'solo A',
      0b010: 'solo B',
      0b100: 'solo C',
      0b011: 'A∩B \\ C',
      0b101: 'A∩C \\ B',
      0b110: 'B∩C \\ A',
      0b111: 'A∩B∩C',
    };
    const order = [0b111, 0b011, 0b101, 0b110, 0b001, 0b010, 0b100, 0b000];
    return order.map((m) => ({
      mask: m,
      name: NAMES[m],
      members: cells[m],
      lit: lit[m],
    }));
  }, [cells, lit]);

  const resultList = useMemo(() => Array.from(result).sort((a, b) => a - b), [result]);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={8.5} bloomIntensity={0.6} bloomThreshold={0.5} bgColor="#05060A" autoRotate={false} captureMode>
          <CanvasCapture />

          {/* Caja del universo U (marco tenue) */}
          <Line
            points={[
              [-3.4, 3.0, 0],
              [3.4, 3.0, 0],
              [3.4, -3.4, 0],
              [-3.4, -3.4, 0],
              [-3.4, 3.0, 0],
            ]}
            color="#334155"
            lineWidth={1}
            transparent
            opacity={0.55}
          />

          {/* Rellenos de cada celda: discos achatados semitransparentes apilados.
              El "encendido" lo dan los elementos; el disco solo da color de pertenencia. */}
          {discs.map((d, i) => (
            <group key={i}>
              {/* relleno tenue del disco */}
              <mesh position={[d.center.x, d.center.y, -0.02 - i * 0.005]}>
                <circleGeometry args={[DISC_R, 96]} />
                <meshBasicMaterial
                  color={d.color}
                  transparent
                  opacity={0.1}
                  side={THREE.DoubleSide}
                  toneMapped={false}
                  depthWrite={false}
                />
              </mesh>
              {/* contorno emisivo del disco */}
              <Line points={circlePoints(d.center, DISC_R)} color={d.color} lineWidth={2.2} transparent opacity={0.9} />
            </group>
          ))}

          {/* Celdas ILUMINADAS: un halo rosa en el centroide de cada celda encendida.
              Esta es la "región del Venn correspondiente al resultado". */}
          {regionRows
            .filter((r) => r.lit && r.mask !== 0b000)
            .map((r) => {
              const c = cellCentroid(r.mask);
              return (
                <mesh key={`lit-${r.mask}`} position={[c.x, c.y, -0.012]}>
                  <circleGeometry args={[0.52, 48]} />
                  <meshBasicMaterial color={COL_RESULT} transparent opacity={0.28} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
                </mesh>
              );
            })}

          {/* Exterior encendido (complemento) → banda rosa abajo */}
          {lit[0b000] && cells[0].length > 0 && (
            <mesh position={[0, -2.95, -0.012]}>
              <planeGeometry args={[2.9, 0.7]} />
              <meshBasicMaterial color={COL_RESULT} transparent opacity={0.18} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
            </mesh>
          )}

          {/* Elementos del universo: esferas emisivas. Las que están en el resultado
              brillan en ROSA (toneMapped=false → revientan en el bloom); las demás
              quedan apagadas en gris. */}
          {placed.map((it) => {
            const onResult = it.inResult;
            const baseColor = onResult ? COL_RESULT : '#475569';
            return (
              <group key={it.x} position={[it.pos.x, it.pos.y, 0.04]}>
                <mesh>
                  <sphereGeometry args={[onResult ? 0.14 : 0.1, 20, 20]} />
                  <meshStandardMaterial
                    color={baseColor}
                    emissive={baseColor}
                    emissiveIntensity={onResult ? 1.6 : 0.25}
                    toneMapped={false}
                  />
                </mesh>
                <Html center distanceFactor={11} position={[0, 0, 0]} prepend>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 10,
                      fontWeight: 700,
                      color: onResult ? '#0B0F17' : '#CBD5E1',
                      textShadow: onResult ? 'none' : '0 0 5px #000',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    {it.x}
                  </div>
                </Html>
              </group>
            );
          })}

          {/* Etiquetas de los conjuntos A, B, C (HUD 3D — NO drei <Text>) */}
          {discs.map((d, i) => (
            <Html
              key={`lbl-${i}`}
              center
              distanceFactor={11}
              position={[
                d.center.x + (d.label === 'A' ? -DISC_R * 0.78 : d.label === 'B' ? DISC_R * 0.78 : 0),
                d.center.y + (d.label === 'C' ? -DISC_R * 0.85 : DISC_R * 0.78),
                0.05,
              ]}
              prepend
            >
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 18,
                  fontWeight: 800,
                  color: d.color,
                  textShadow: '0 0 8px #000',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {d.label}
              </div>
            </Html>
          ))}

          {/* Etiqueta del universo U */}
          <Html center distanceFactor={11} position={[-3.05, 2.7, 0.05]} prepend>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 14,
                fontWeight: 800,
                color: ACCENT,
                textShadow: '0 0 8px #000',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              U
            </div>
          </Html>
        </Stage>

        {/* HUD: leyenda + operación activa */}
        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span style={{ color: COL_A }}>●</span> A &nbsp; <span style={{ color: COL_B }}>●</span> B &nbsp; <span style={{ color: COL_C }}>●</span> C</div>
          <div><span style={{ color: COL_RESULT }}>●</span> en el resultado</div>
          <div className="text-[#94A3B8] mt-1">
            <span style={{ color: COL_RESULT }}>{op.notation}</span> = {`{`}{resultList.join(', ')}{`}`}
          </div>
          <div className="text-[#64748B]">|resultado| = {result.size} / |U| = {UNIVERSE.length}</div>
        </div>
      </div>

      <LessonPanel<SetsState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.opId !== undefined) setOpId(patch.opId);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Operación</div>
              <div className="grid grid-cols-1 gap-1">
                {OPERATIONS.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setOpId(o.id)}
                    className={`text-left text-[11px] px-2 py-1.5 rounded border transition ${
                      opId === o.id
                        ? 'bg-[#94A3B8]/15 border-[#94A3B8]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8]/40'
                    }`}
                  >
                    <div className="font-semibold flex items-center justify-between">
                      <span>{o.label}</span>
                      <span style={{ color: COL_RESULT }} className="font-mono">{o.notation}</span>
                    </div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{o.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Resultado calculado de verdad */}
            <div className="border-t border-[#1E293B] pt-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Resultado</div>
              <div className="text-[11px] font-mono leading-relaxed">
                <span style={{ color: COL_RESULT }}>{op.notation}</span>
                <span className="text-[#94A3B8]"> = </span>
                <span className="text-white">{`{ ${resultList.join(', ')} }`}</span>
              </div>
              <div className="text-[10px] text-[#64748B]">cardinalidad = {result.size}</div>
            </div>

            {/* Tabla de las 8 regiones (celdas del Venn) */}
            <div className="border-t border-[#1E293B] pt-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">Regiones del Venn (bits A·B·C)</div>
              {regionRows.map((r) => {
                const bits = `${(r.mask & 1) ? 1 : 0}${(r.mask & 2) ? 1 : 0}${(r.mask & 4) ? 1 : 0}`;
                return (
                  <div
                    key={r.mask}
                    className="flex items-center justify-between gap-2 text-[10px] font-mono px-1.5 py-1 rounded"
                    style={{
                      background: r.lit ? 'rgba(244,114,182,0.12)' : 'transparent',
                      border: r.lit ? '1px solid rgba(244,114,182,0.4)' : '1px solid transparent',
                    }}
                  >
                    <span className="text-[#64748B]">{bits}</span>
                    <span className={r.lit ? 'text-white' : 'text-[#64748B]'}>{r.name}</span>
                    <span className={r.lit ? 'text-[#F472B6]' : 'text-[#475569]'}>
                      {r.members.length > 0 ? `{${r.members.join(',')}}` : '∅'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Conjuntos base */}
            <div className="border-t border-[#1E293B] pt-3 text-[10px] font-mono space-y-0.5">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">Conjuntos base · U = {`{1..${UNIVERSE.length}}`}</div>
              <div><span style={{ color: COL_A }}>A</span> = {`{ ${Array.from(SET_A).sort((a, b) => a - b).join(', ')} }`}</div>
              <div><span style={{ color: COL_B }}>B</span> = {`{ ${Array.from(SET_B).sort((a, b) => a - b).join(', ')} }`}</div>
              <div><span style={{ color: COL_C }}>C</span> = {`{ ${Array.from(SET_C).sort((a, b) => a - b).join(', ')} }`}</div>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Cada elemento x∈U se clasifica por el bitmask (x∈A, x∈B, x∈C). El Venn de 3 conjuntos ES la partición de U en esas 2³ celdas; toda operación de conjunto elige un subconjunto de esas celdas. Unión = ∨, intersección = ∧, complemento = ¬ sobre la membresía.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
