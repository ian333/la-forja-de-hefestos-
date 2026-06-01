/**
 * Inducción matemática — el efecto dominó, calculado de verdad.
 *
 * La demostración por inducción tiene DOS piezas:
 *
 *   1) PASO BASE        — probar P(1): que la afirmación vale para n = 1.
 *   2) PASO INDUCTIVO   — probar P(n) ⇒ P(n+1): si vale para un n cualquiera,
 *                          entonces forzosamente vale para el siguiente.
 *
 * Juntas dan el "efecto dominó": el primero cae (base) y cada uno tira al
 * siguiente (paso inductivo) ⇒ caen TODOS. Eso prueba P(n) para todo n ≥ 1.
 *
 * Aquí no se hardcodea ninguna curva. Para cada teorema:
 *   • lhs(n)   evalúa el lado izquierdo SUMANDO término a término (el "trabajo").
 *   • rhs(n)   evalúa la fórmula cerrada candidata.
 *   • Verificamos lhs(n) == rhs(n) numéricamente para el n elegido, y mostramos
 *     EXPLÍCITAMENTE el álgebra del paso inductivo: rhs(n) + (término n+1) = rhs(n+1).
 *
 * Teoremas (presets):
 *   • Σ k        = n(n+1)/2
 *   • Σ k²       = n(n+1)(2n+1)/6
 *   • 2^n > n    (desigualdad, n ≥ 1)
 *
 * Visualización: una fila de dominós 3D. Al "tirar el primer dominó" una onda
 * recorre la fila tumbándolos uno tras otro — la cascada ES la inducción. Cada
 * dominó lleva su índice k; el HUD muestra LHS y RHS coincidiendo en vivo.
 *
 * Etiquetas en escena vía drei <Html> (NO drei <Text>, que rompe el
 * EffectComposer del Stage). Materiales emisivos → el bloom del Stage los hace
 * brillar sobre el fondo oscuro.
 */

import { useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

// ── Colores ──────────────────────────────────────────────────────────────

const ACCENT = '#94A3B8';      // acento de la rama Fundamentos
const COL_BASE = '#34D399';    // verde: el paso base (n = 1)
const COL_FALL = '#F472B6';    // rosa: dominós ya caídos (lo demostrado)
const COL_STAND = '#4FC3F7';   // cian: dominós aún de pie (pendientes)
const COL_FRONT = '#FDB813';   // dorado: el frente de caída (el paso n→n+1)
const COL_LHS = '#FDB813';
const COL_RHS = '#34D399';

// ── Estado del módulo ──────────────────────────────────────────────────────

interface ProofState {
  presetId: string;
  nValue: number;   // n configurable (cuántos dominós / hasta dónde verificar)
  toppled: number;  // 0 = todos de pie; 1 = todos caídos (lo anima el LessonPanel)
}

// ── Teoremas REALES ─────────────────────────────────────────────────────────
// Cada teorema sabe sumar su lado izquierdo término a término (sin fórmula) y
// evaluar su fórmula cerrada candidata. La verificación compara ambos.

interface Theorem {
  id: string;
  label: string;
  statement: string;        // P(n)
  blurb: string;
  /** Lado izquierdo evaluado por DEFINICIÓN (suma/cómputo directo). */
  lhs: (n: number) => number;
  lhsLabel: (n: number) => string;
  /** Lado derecho: la fórmula cerrada candidata. */
  rhs: (n: number) => number;
  rhsLabel: (n: number) => string;
  /** Término que se agrega al pasar de n a n+1 (para el álgebra inductiva). */
  stepTerm: (n: number) => string;
  /** ¿Igualdad (=) o desigualdad (>)? Cambia cómo se verifica. */
  relation: '=' | '>';
  /** Álgebra explícita del paso inductivo P(n) ⇒ P(n+1), como texto. */
  inductiveAlgebra: (n: number) => string[];
}

const THEOREMS: Theorem[] = [
  {
    id: 'sum-k',
    label: 'Suma de los primeros n enteros',
    statement: 'P(n):  1 + 2 + … + n = n(n+1)/2',
    blurb: 'Σ k = n(n+1)/2. La fórmula del joven Gauss.',
    lhs: (n) => { let s = 0; for (let k = 1; k <= n; k++) s += k; return s; },
    lhsLabel: (n) => `1+2+…+${n}`,
    rhs: (n) => (n * (n + 1)) / 2,
    rhsLabel: (n) => `${n}·${n + 1}/2`,
    stepTerm: (n) => `${n + 1}`,
    relation: '=',
    inductiveAlgebra: (n) => [
      `Asumo P(${n}):  Σ_{k=1}^{${n}} k = ${n}·${n + 1}/2`,
      `Sumo el término ${n + 1} a ambos lados:`,
      `Σ_{k=1}^{${n + 1}} k = ${n}·${n + 1}/2 + (${n + 1})`,
      `= (${n + 1})·(${n}/2 + 1) = (${n + 1})·(${n + 2})/2`,
      `= ${n + 1}·${n + 2}/2  =  P(${n + 1}) ✓`,
    ],
  },
  {
    id: 'sum-k2',
    label: 'Suma de los primeros n cuadrados',
    statement: 'P(n):  1² + 2² + … + n² = n(n+1)(2n+1)/6',
    blurb: 'Σ k² = n(n+1)(2n+1)/6.',
    lhs: (n) => { let s = 0; for (let k = 1; k <= n; k++) s += k * k; return s; },
    lhsLabel: (n) => `1²+2²+…+${n}²`,
    rhs: (n) => (n * (n + 1) * (2 * n + 1)) / 6,
    rhsLabel: (n) => `${n}·${n + 1}·${2 * n + 1}/6`,
    stepTerm: (n) => `(${n + 1})²`,
    relation: '=',
    inductiveAlgebra: (n) => [
      `Asumo P(${n}):  Σ k² = ${n}·${n + 1}·${2 * n + 1}/6`,
      `Sumo (${n + 1})² a ambos lados:`,
      `Σ_{k=1}^{${n + 1}} k² = ${n}(${n + 1})(${2 * n + 1})/6 + (${n + 1})²`,
      `Factor común (${n + 1})/6:  (${n + 1})[${n}(${2 * n + 1}) + 6(${n + 1})]/6`,
      `= (${n + 1})(${n + 2})(${2 * n + 3})/6  =  P(${n + 1}) ✓`,
    ],
  },
  {
    id: 'pow2',
    label: 'Crecimiento exponencial 2ⁿ > n',
    statement: 'P(n):  2ⁿ > n   (para todo n ≥ 1)',
    blurb: 'Desigualdad: 2ⁿ supera a n siempre. Inducción con cota.',
    lhs: (n) => Math.pow(2, n),
    lhsLabel: (n) => `2^${n}`,
    rhs: (n) => n,
    rhsLabel: (n) => `${n}`,
    stepTerm: () => `×2`,
    relation: '>',
    inductiveAlgebra: (n) => [
      `Asumo P(${n}):  2^${n} > ${n}`,
      `Multiplico por 2:  2^${n + 1} = 2·2^${n} > 2·${n}`,
      `Y 2·${n} = ${n} + ${n} ≥ ${n} + 1 = ${n + 1}  (pues ${n} ≥ 1)`,
      `⇒ 2^${n + 1} > ${n + 1}  =  P(${n + 1}) ✓`,
    ],
  },
];

// ── Verificación numérica del teorema hasta n ──────────────────────────────
// Comprueba la relación término a término para cada m ≤ n. NO confía en la
// fórmula: la contrasta contra el cómputo directo en cada escalón.

function verifyUpTo(thm: Theorem, n: number): { m: number; ok: boolean }[] {
  const out: { m: number; ok: boolean }[] = [];
  for (let m = 1; m <= n; m++) {
    const L = thm.lhs(m), R = thm.rhs(m);
    const ok = thm.relation === '=' ? Math.abs(L - R) < 1e-9 : L > R;
    out.push({ m, ok });
  }
  return out;
}

// ── Geometría de la fila de dominós ─────────────────────────────────────────

const DOMINO_W = 0.5;    // ancho (eje x, dirección de la fila)
const DOMINO_H = 1.6;    // alto
const DOMINO_T = 0.16;   // grosor
const SPACING = 0.95;    // separación entre centros
const MAX_TILT = Math.PI / 2 * 0.92; // ángulo final al caer (≈ acostado)

// Posición x del dominó k (k = 1..n), centrando la fila.
function dominoX(k: number, n: number): number {
  const span = (n - 1) * SPACING;
  return (k - 1) * SPACING - span / 2;
}

// ── LESSON ───────────────────────────────────────────────────────────────

const LESSON: Lesson<ProofState> = {
  hook: {
    title: 'Probar algo para INFINITOS casos con solo dos pasos: el primer dominó cae y cada uno tira al siguiente.',
    body: `Quieres demostrar que una afirmación P(n) es verdadera para TODO número natural n: n = 1, 2, 3, 4, … hasta el infinito. No puedes verificarlos uno por uno: son infinitos.

La inducción matemática lo logra con solo dos piezas. Primero el PASO BASE: pruebas P(1), que la afirmación vale para n = 1. Después el PASO INDUCTIVO: pruebas que P(n) ⇒ P(n+1), o sea, que si vale para un n cualquiera, forzosamente vale para el siguiente.

Piénsalo como una fila infinita de dominós. El paso base es empujar el primero. El paso inductivo es garantizar que cada dominó, al caer, tira al de adelante. Si tienes las dos cosas, caen TODOS — sin tocarlos uno por uno.

En esta clase tomamos teoremas REALES (la suma de Gauss, la suma de cuadrados, la desigualdad 2ⁿ > n), verificamos los dos pasos con números exactos, y dejamos caer los dominós para ver la cascada que cubre todos los casos a la vez.`,
  },

  steps: [
    {
      title: 'El paso base — empujar el primer dominó: P(1)',
      duration: 5500,
      body: `Empezamos con el teorema de Gauss: 1 + 2 + … + n = n(n+1)/2. Antes de nada, el PASO BASE: ¿vale para n = 1?

Lado izquierdo: la suma de "los primeros 1 enteros" es solo 1. Lado derecho: 1·(1+1)/2 = 1·2/2 = 1. Coinciden. P(1) es verdadero.

Mira el primer dominó iluminado en verde: ese es el caso base, el único que verificamos directamente. Sin él, no hay nada que empiece a caer.

El paso base casi siempre es trivial de revisar. Pero es OBLIGATORIO: sin empujar el primero, la cadena nunca arranca, por muy bien conectada que esté.`,
      formula: 'PASO BASE  P(1):\nizq = 1\nder = 1·(1+1)/2 = 1\n1 = 1  ✓',
      keyframes: [
        { at: 0, state: { presetId: 'sum-k', nValue: 8, toppled: 0 } },
        { at: 1, state: { presetId: 'sum-k', nValue: 8, toppled: 0 } },
      ],
    },
    {
      title: 'El paso inductivo — cada dominó tira al siguiente: P(n) ⇒ P(n+1)',
      duration: 6500,
      body: `Ahora el corazón del método: el PASO INDUCTIVO. No verificamos cada caso; probamos UNA implicación general: si P(n) es cierto, entonces P(n+1) también.

Asumimos P(n): 1+2+…+n = n(n+1)/2 (esto es la "hipótesis inductiva"). Le sumamos el siguiente término, (n+1), a ambos lados:

1+2+…+n+(n+1) = n(n+1)/2 + (n+1) = (n+1)(n/2 + 1) = (n+1)(n+2)/2.

¡Y eso es exactamente la fórmula con n+1 en lugar de n! Probamos P(n+1) usando P(n). Eso es "cada dominó tira al de adelante": no importa CUÁL dominó sea, su caída garantiza la del siguiente.`,
      formula: 'PASO INDUCTIVO  P(n) ⇒ P(n+1):\nΣ_{1}^{n+1} k = n(n+1)/2 + (n+1)\n= (n+1)(n+2)/2 = P(n+1)  ✓',
      keyframes: [
        { at: 0, state: { presetId: 'sum-k', nValue: 8, toppled: 0 } },
        { at: 1, state: { presetId: 'sum-k', nValue: 8, toppled: 0 } },
      ],
    },
    {
      title: 'La cascada — base + paso inductivo = caen TODOS',
      duration: 6500,
      body: `Junta las dos piezas y mira la magia: tiramos el primer dominó (paso base) y la onda recorre la fila entera. Base + paso inductivo = P(n) para todo n ≥ 1.

¿Por qué funciona? P(1) es cierto (base). P(1) ⇒ P(2), entonces P(2). P(2) ⇒ P(3), entonces P(3). Y así, sin fin. Cada caso se apoya en el anterior; el primero se apoya en el suelo.

Los dominós que ya cayeron (rosa) son los casos demostrados; el frente dorado es el paso n→n+1 ocurriendo ahora mismo. Nunca tocamos cada dominó: la regla "uno tira al siguiente" hizo todo el trabajo.

Esto es exactamente lo que separa una conjetura de un teorema: la inducción cierra los infinitos casos con un argumento finito.`,
      formula: 'P(1) ✓   y   ∀n: P(n) ⇒ P(n+1)\n⟹  ∀n ≥ 1:  P(n)  verdadero',
      keyframes: [
        { at: 0, state: { presetId: 'sum-k', nValue: 12, toppled: 0 } },
        { at: 1, state: { presetId: 'sum-k', nValue: 12, toppled: 1 } },
      ],
    },
    {
      title: 'Otro teorema — suma de cuadrados Σ k² = n(n+1)(2n+1)/6',
      duration: 6000,
      body: `El mismo esqueleto sirve para fórmulas más complicadas. Cambiamos al teorema de los cuadrados: 1² + 2² + … + n² = n(n+1)(2n+1)/6.

Paso base: para n = 1, izquierda = 1² = 1; derecha = 1·2·3/6 = 1. Coinciden.

Paso inductivo: asumes P(n) y sumas (n+1)² a ambos lados. Sacas factor común (n+1)/6 y, con un poco de álgebra, aparece (n+1)(n+2)(2n+3)/6 — que es la fórmula con n+1. La estructura es idéntica: solo cambia el álgebra del término que agregas.

Mira la cascada de nuevo. El método no cambió: cambió el teorema. La inducción es una PLANTILLA que rellenas con cualquier afirmación que dependa de n.`,
      formula: 'P(1): 1² = 1·2·3/6 = 1 ✓\nΣ_{1}^{n+1} k² = n(n+1)(2n+1)/6 + (n+1)²\n= (n+1)(n+2)(2n+3)/6  ✓',
      keyframes: [
        { at: 0, state: { presetId: 'sum-k2', nValue: 10, toppled: 0 } },
        { at: 1, state: { presetId: 'sum-k2', nValue: 10, toppled: 1 } },
      ],
    },
    {
      title: 'No solo igualdades — la desigualdad 2ⁿ > n',
      duration: 6000,
      body: `La inducción no es solo para fórmulas de suma. También prueba DESIGUALDADES. Tomamos P(n): 2ⁿ > n para todo n ≥ 1.

Paso base: para n = 1, 2¹ = 2 > 1. ✓

Paso inductivo: asumes 2ⁿ > n. Multiplicas por 2: 2ⁿ⁺¹ = 2·2ⁿ > 2n. Y como n ≥ 1, se cumple 2n = n + n ≥ n + 1. Encadenando: 2ⁿ⁺¹ > 2n ≥ n + 1, así que 2ⁿ⁺¹ > n+1, que es P(n+1).

Aquí el "cada dominó tira al siguiente" usa una cota intermedia (2n ≥ n+1) en vez de una identidad. La idea es la misma: una sola implicación general cubre los infinitos pasos. Por eso 2ⁿ le gana a n para siempre — y, de hecho, lo aplasta.`,
      formula: 'P(1): 2¹ = 2 > 1 ✓\n2^{n+1} = 2·2ⁿ > 2n ≥ n+1\n⇒ 2^{n+1} > n+1  ✓',
      keyframes: [
        { at: 0, state: { presetId: 'pow2', nValue: 10, toppled: 0 } },
        { at: 1, state: { presetId: 'pow2', nValue: 10, toppled: 1 } },
      ],
    },
  ],

  connect: {
    body: `Acabas de ver que la inducción cierra infinitos casos con dos pasos finitos: empujar el primer dominó (base) y garantizar que cada uno tira al siguiente (paso inductivo). La cascada hace el resto.

Esto es el cimiento de muchísima matemática y computación:

• Inducción fuerte — asumes P(1),…,P(n) (no solo P(n)) para probar P(n+1); aparece en la unicidad de la factorización en primos.
• Recursión y algoritmos — demostrar que un algoritmo recursivo es correcto ES una inducción sobre el tamaño de la entrada.
• Definiciones recursivas — el factorial, Fibonacci y los árboles se definen por inducción.
• Inducción estructural — la misma idea sobre estructuras (listas, árboles, fórmulas lógicas), no solo sobre números.
• El principio del buen orden — "todo subconjunto no vacío de ℕ tiene mínimo" es EQUIVALENTE a la inducción; uno se prueba con el otro.

Juega en el sandbox: cambia el teorema y el valor de n, verifica que el lado izquierdo (cómputo directo) y el derecho (fórmula) coinciden en cada escalón, y tira el primer dominó para ver la cascada que prueba todos los casos de golpe.`,
    links: [
      { label: 'Conjuntos — la membresía donde vive el buen orden', href: '#sets' },
      { label: 'Lógica proposicional — la implicación P(n) ⇒ P(n+1)', href: '#logic' },
      { label: 'Combinatoria — fórmulas que se prueban por inducción', href: '#combinatorics' },
    ],
  },
};

// ── Un dominó animado ───────────────────────────────────────────────────────
// Cada dominó se inclina alrededor de su base (pivote en el borde inferior
// delantero) cuando el "frente de caída" lo alcanza. El frente avanza con el
// tiempo desde que arranca la cascada; así la caída se propaga uno tras otro.

function Domino({
  k, n, color, label, value, fallProgress,
}: {
  k: number;
  n: number;
  color: string;
  label: string;
  value: string;
  /** 0 = de pie, 1 = totalmente caído. */
  fallProgress: number;
}) {
  const pivot = useRef<THREE.Group>(null);
  const x = dominoX(k, n);
  const tilt = MAX_TILT * Math.min(1, Math.max(0, fallProgress));
  // Brillo: el frente (en plena caída, 0<p<1) reluce más fuerte.
  const mid = fallProgress > 0.02 && fallProgress < 0.98;
  const emissive = mid ? 1.8 : fallProgress >= 0.98 ? 1.1 : 0.9;

  useFrame(() => {
    if (pivot.current) pivot.current.rotation.z = -tilt;
  });

  return (
    <group position={[x, 0, 0]}>
      {/* Pivote en la base: la pieza se desplaza para girar sobre su borde inferior. */}
      <group ref={pivot} rotation={[0, 0, -tilt]}>
        <mesh position={[0, DOMINO_H / 2, 0]}>
          <boxGeometry args={[DOMINO_W, DOMINO_H, DOMINO_T]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={emissive}
            metalness={0.25}
            roughness={0.45}
            toneMapped={false}
          />
        </mesh>
        {/* Índice del dominó (HUD 3D — NO drei <Text>) */}
        <Html center distanceFactor={12} position={[0, DOMINO_H * 0.78, DOMINO_T / 2 + 0.01]} prepend>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 13,
              fontWeight: 800,
              color: '#0B0F17',
              background: color,
              borderRadius: 4,
              padding: '0px 4px',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {label}
          </div>
        </Html>
        {/* Valor del término (LHS) bajo el índice */}
        <Html center distanceFactor={14} position={[0, DOMINO_H * 0.5, DOMINO_T / 2 + 0.01]} prepend>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 10,
              fontWeight: 700,
              color: '#0B0F17',
              opacity: 0.75,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {value}
          </div>
        </Html>
      </group>
    </group>
  );
}

// ── Driver de la cascada: convierte "toppled" + tiempo en progreso por dominó ─
// toppled (0→1) lo anima el LessonPanel o el botón. Cuando toppled empieza a
// crecer, el frente de caída barre la fila a velocidad fija; cada dominó k cae
// poco después que k-1. Render real con useFrame para que sea suave.

function Cascade({
  n, thm, nValue, toppledTarget,
}: {
  n: number;
  thm: Theorem;
  nValue: number;
  toppledTarget: number;
}) {
  // Reloj de la cascada: avanza mientras toppledTarget > 0; se resetea a 0 cuando vuelve a 0.
  const clock = useRef(0);
  const wasFalling = useRef(false);
  const [, force] = useState(0);

  useFrame((_, dt) => {
    const falling = toppledTarget > 0.001;
    if (falling && !wasFalling.current) {
      clock.current = 0; // arranca la cascada
    }
    wasFalling.current = falling;
    if (falling) {
      clock.current = Math.min(clock.current + dt, n * 0.16 + 1.2);
    } else {
      clock.current = 0;
    }
    // Forzamos re-render para recomputar los progresos (barato: n ≤ ~16).
    force((f) => (f + 1) % 1000000);
  });

  // Progreso de caída de cada dominó k a partir del reloj.
  const STAGGER = 0.16;   // segundos entre dominós consecutivos
  const FALL_DUR = 0.34;  // segundos que tarda un dominó en caer

  const dominoes: { k: number; color: string; label: string; value: string; progress: number }[] = [];
  for (let k = 1; k <= n; k++) {
    const startT = (k - 1) * STAGGER;
    const local = (clock.current - startT) / FALL_DUR;
    const progress = Math.min(1, Math.max(0, local));
    const fallen = progress >= 0.98;
    const front = progress > 0.02 && progress < 0.98;
    const color = k === 1 && progress < 0.02
      ? COL_BASE                  // el primero, aún de pie = caso base resaltado
      : front
        ? COL_FRONT               // el que está cayendo ahora = paso n→n+1
        : fallen
          ? COL_FALL              // ya cayó = caso demostrado
          : COL_STAND;            // de pie = pendiente
    dominoes.push({
      k,
      color,
      label: `${k}`,
      value: thm.id === 'pow2' ? `2^${k}` : thm.id === 'sum-k2' ? `${k}²` : `${k}`,
      progress,
    });
  }

  return (
    <>
      {dominoes.map((d) => (
        <Domino
          key={d.k}
          k={d.k}
          n={nValue}
          color={d.color}
          label={d.label}
          value={d.value}
          fallProgress={d.progress}
        />
      ))}
    </>
  );
}

// ── Componente ───────────────────────────────────────────────────────────

export default function Proof() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<string>('sum-k');
  const [nValue, setNValue] = useState<number>(10);
  const [toppled, setToppled] = useState<number>(0);

  const thm = useMemo(() => THEOREMS.find((t) => t.id === presetId) ?? THEOREMS[0], [presetId]);
  const n = Math.max(2, Math.min(16, Math.round(nValue)));

  // Verificación numérica REAL hasta n (lhs computado vs rhs fórmula).
  const checks = useMemo(() => verifyUpTo(thm, n), [thm, n]);
  const allOk = useMemo(() => checks.every((c) => c.ok), [checks]);

  // Valores en el n elegido (para el HUD): lado izquierdo y derecho.
  const Lval = useMemo(() => thm.lhs(n), [thm, n]);
  const Rval = useMemo(() => thm.rhs(n), [thm, n]);
  const algebra = useMemo(() => thm.inductiveAlgebra(n), [thm, n]);

  const tirar = useCallback(() => {
    setToppled(0);
    // Pequeño tick para reiniciar la cascada y luego dispararla.
    requestAnimationFrame(() => setToppled(1));
  }, []);

  const span = (n - 1) * SPACING;
  const camDist = Math.max(7, span * 1.1 + 3);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage
          cameraDistance={camDist}
          bloomIntensity={0.6}
          bloomThreshold={0.5}
          bgColor="#05060A"
          autoRotate={false}
          captureMode
        >
          <CanvasCapture />

          {/* Suelo: la "base" sobre la que se apoya el caso base. Reja tenue. */}
          <Line
            points={[
              [-span / 2 - 1, 0, DOMINO_T / 2],
              [span / 2 + 1, 0, DOMINO_T / 2],
            ]}
            color="#334155"
            lineWidth={1.5}
            transparent
            opacity={0.7}
          />
          <mesh position={[0, -0.02, -DOMINO_T]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[span + 3, 3.2]} />
            <meshStandardMaterial color="#0B0F17" emissive="#0B0F17" emissiveIntensity={0.1} roughness={0.9} />
          </mesh>

          {/* La fila de dominós que cae en cascada (la inducción). */}
          <Cascade n={n} thm={thm} nValue={n} toppledTarget={toppled} />

          {/* Marca del caso base bajo el primer dominó. */}
          <Html center distanceFactor={16} position={[dominoX(1, n), -0.35, 0]} prepend>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                fontWeight: 800,
                color: COL_BASE,
                textShadow: '0 0 8px #000',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              base · P(1)
            </div>
          </Html>

          {/* Elipsis "… ∞" después del último dominó: la fila sigue al infinito. */}
          <Html center distanceFactor={16} position={[span / 2 + 0.9, DOMINO_H * 0.45, 0]} prepend>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 18,
                fontWeight: 800,
                color: ACCENT,
                textShadow: '0 0 8px #000',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              … ∞
            </div>
          </Html>
        </Stage>

        {/* HUD: teorema, LHS vs RHS en vivo, verificación */}
        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B] max-w-[340px]">
          <div className="text-white font-semibold">{thm.statement}</div>
          <div className="mt-1">
            <span style={{ color: COL_LHS }}>{thm.lhsLabel(n)}</span>
            <span className="text-[#94A3B8]"> {thm.relation} </span>
            <span style={{ color: COL_RHS }}>{thm.rhsLabel(n)}</span>
          </div>
          <div>
            <span style={{ color: COL_LHS }}>izq = {Lval}</span>
            <span className="text-[#94A3B8]"> {thm.relation} </span>
            <span style={{ color: COL_RHS }}>der = {Rval}</span>
            <span className="ml-2" style={{ color: allOk ? COL_BASE : '#EF5350' }}>
              {allOk ? '✓ verificado' : '✗'}
            </span>
          </div>
          <div className="text-[#64748B]">para n = {n} · revisado m = 1..{n}</div>
        </div>

        {/* Botón "tirar el primer dominó" (control HUD sobre el canvas) */}
        <button
          onClick={tirar}
          className="absolute bottom-3 left-3 text-[12px] font-semibold px-3 py-2 rounded
                     border border-[#FDB813]/50 bg-[#FDB813]/15 text-[#FDB813]
                     hover:bg-[#FDB813]/25 transition"
        >
          ▸ tirar el primer dominó
        </button>
        <button
          onClick={() => setToppled(0)}
          className="absolute bottom-3 left-[185px] text-[11px] px-3 py-2 rounded
                     border border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8]/40 hover:text-white transition"
        >
          ↺ levantar
        </button>
      </div>

      <LessonPanel<ProofState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) setPresetId(patch.presetId);
          if (patch.nValue !== undefined) setNValue(patch.nValue);
          if (patch.toppled !== undefined) setToppled(patch.toppled);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Teorema</div>
              <div className="grid grid-cols-1 gap-1">
                {THEOREMS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setPresetId(t.id); setToppled(0); }}
                    className={`text-left text-[11px] px-2 py-1.5 rounded border transition ${
                      presetId === t.id
                        ? 'bg-[#94A3B8]/15 border-[#94A3B8]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8]/40'
                    }`}
                  >
                    <div className="font-semibold">{t.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{t.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* n configurable */}
            <div className="border-t border-[#1E293B] pt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#64748B] uppercase tracking-wider text-[10px]">cantidad de dominós n</span>
                <span className="font-mono text-white">{n}</span>
              </div>
              <input
                type="range"
                min={2}
                max={16}
                step={1}
                value={n}
                onChange={(e) => { setNValue(Number(e.target.value)); setToppled(0); }}
                className="w-full accent-[#94A3B8]"
              />
            </div>

            {/* Botones de la cascada */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={tirar}
                className="text-[11px] px-2 py-1.5 rounded border border-[#FDB813]/50 bg-[#FDB813]/15 text-[#FDB813] hover:bg-[#FDB813]/25 transition font-semibold"
              >
                ▸ tirar dominó
              </button>
              <button
                onClick={() => setToppled(0)}
                className="text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8]/40 hover:text-white transition"
              >
                ↺ levantar
              </button>
            </div>

            {/* Verificación numérica REAL (LHS computado vs RHS fórmula) */}
            <div className="border-t border-[#1E293B] pt-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">
                Verificación término a término
              </div>
              <div className="text-[11px] font-mono leading-relaxed">
                <span style={{ color: COL_LHS }}>{thm.lhsLabel(n)}</span>
                <span className="text-[#94A3B8]"> {thm.relation} </span>
                <span style={{ color: COL_RHS }}>{thm.rhsLabel(n)}</span>
              </div>
              <div className="text-[11px] font-mono">
                <span style={{ color: COL_LHS }}>izq = {Lval}</span>
                <span className="text-[#94A3B8]"> {thm.relation} </span>
                <span style={{ color: COL_RHS }}>der = {Rval}</span>
              </div>
              {/* Casquillos por escalón m = 1..n */}
              <div className="flex flex-wrap gap-1 mt-1">
                {checks.map((c) => (
                  <span
                    key={c.m}
                    title={`P(${c.m}): ${c.ok ? 'verdadero' : 'falso'}`}
                    className="text-[9px] font-mono px-1 py-0.5 rounded"
                    style={{
                      background: c.ok ? 'rgba(52,211,153,0.15)' : 'rgba(239,83,80,0.15)',
                      border: c.ok ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(239,83,80,0.4)',
                      color: c.ok ? COL_BASE : '#EF5350',
                    }}
                  >
                    {c.m}{c.ok ? '✓' : '✗'}
                  </span>
                ))}
              </div>
              <div className="text-[10px]" style={{ color: allOk ? COL_BASE : '#EF5350' }}>
                {allOk ? `✓ P(m) verdadero para todo m = 1..${n}` : `✗ falla en algún m ≤ ${n}`}
              </div>
            </div>

            {/* El álgebra explícita del paso inductivo en el n elegido */}
            <div className="border-t border-[#1E293B] pt-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">
                Paso inductivo P({n}) ⇒ P({n + 1})
              </div>
              <pre className="text-[10px] font-mono text-[#CBD5E1] whitespace-pre-wrap leading-relaxed">
                {algebra.join('\n')}
              </pre>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Inducción = axioma de Peano: si S ⊆ ℕ con 1 ∈ S y (n ∈ S ⇒ n+1 ∈ S), entonces S = ℕ. El "izq" se computa por definición (suma directa); el "der" es la fórmula cerrada candidata. Coincidir en m = 1..n no PRUEBA el caso general — lo prueba el paso inductivo simbólico de arriba.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
