/**
 * Lógica proposicional — conectivos y tablas de verdad.
 *
 * Una FÓRMULA booleana sobre variables p, q, r, s se construye con cinco
 * conectivos:
 *
 *   ¬p        negación      (NOT)
 *   p ∧ q     conjunción    (AND)
 *   p ∨ q     disyunción    (OR)
 *   p → q     implicación   (≡ ¬p ∨ q)
 *   p ↔ q     bicondicional (sii — verdadero cuando p y q coinciden)
 *
 * El significado de una fórmula es su TABLA DE VERDAD: el valor que toma para
 * cada una de las 2ⁿ asignaciones posibles de las n variables. Aquí NO se
 * hardcodea ninguna tabla — cada fórmula se TOKENIZA, se PARSEA a un árbol de
 * sintaxis (recursive-descent con precedencia ¬ > ∧ > ∨ > → > ↔), y luego se
 * EVALÚA exhaustivamente sobre las 2ⁿ filas. La tabla emerge del evaluador.
 *
 * Tres clasificaciones salen gratis de recorrer la columna de salida:
 *   • TAUTOLOGÍA   : verdadera en TODAS las filas (p ∨ ¬p).
 *   • CONTRADICCIÓN: falsa en TODAS las filas (p ∧ ¬p).
 *   • CONTINGENCIA : a veces verdadera, a veces falsa.
 *
 * Render 3D real: cada asignación de las variables es un VÉRTICE de un
 * n-hipercubo. Para n variables hay 2ⁿ vértices = todas las filas de la tabla.
 * Proyectamos el n-cubo a R³ (los 3 primeros bits van a x, y, z; el 4º
 * desplaza una copia entera del cubo) y coloreamos cada vértice por el valor
 * de la fórmula: VERDE emisivo = verdadero, ROJO = falso. Las aristas conectan
 * vértices que difieren en UN solo bit (vecinos de Hamming) — es el esqueleto
 * del cubo lógico.
 */

import { useMemo, useState } from 'react';
import { Line, Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

const ACCENT = '#94A3B8';   // slate = rama fundamentos & lógica
const TRUE_COLOR = '#34D399';
const FALSE_COLOR = '#EF5350';
const EDGE_COLOR = '#334155';

interface LogicState {
  presetId: string;
}

// ── Parser: tokens → AST ────────────────────────────────────────────────
// Conectivos aceptados en notación ASCII (lo que el usuario teclea) y unicode.
//   ¬ ~ !        NOT
//   ∧ & *        AND
//   ∨ | +        OR
//   → -> =>       IMPLIES
//   ↔ <-> <=>     IFF

type Tok =
  | { t: 'var'; name: string }
  | { t: 'op'; op: 'not' | 'and' | 'or' | 'imp' | 'iff' }
  | { t: 'lp' }
  | { t: 'rp' };

type Ast =
  | { k: 'var'; name: string }
  | { k: 'not'; a: Ast }
  | { k: 'and' | 'or' | 'imp' | 'iff'; a: Ast; b: Ast };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const s = src;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    // multi-char operators first
    if (s.startsWith('<->', i) || s.startsWith('<=>', i)) { toks.push({ t: 'op', op: 'iff' }); i += 3; continue; }
    if (s.startsWith('->', i) || s.startsWith('=>', i)) { toks.push({ t: 'op', op: 'imp' }); i += 2; continue; }
    if (c === '↔') { toks.push({ t: 'op', op: 'iff' }); i++; continue; }
    if (c === '→') { toks.push({ t: 'op', op: 'imp' }); i++; continue; }
    if (c === '∧' || c === '&' || c === '*') { toks.push({ t: 'op', op: 'and' }); i++; continue; }
    if (c === '∨' || c === '|' || c === '+') { toks.push({ t: 'op', op: 'or' }); i++; continue; }
    if (c === '¬' || c === '~' || c === '!') { toks.push({ t: 'op', op: 'not' }); i++; continue; }
    if (c === '(') { toks.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rp' }); i++; continue; }
    if (/[a-zA-Z]/.test(c)) { toks.push({ t: 'var', name: c.toLowerCase() }); i++; continue; }
    // skip anything unrecognized
    i++;
  }
  return toks;
}

// Recursive descent. Precedencia (baja→alta): iff < imp < or < and < not < atom.
function parse(toks: Tok[]): Ast | null {
  let pos = 0;
  const peek = (): Tok | undefined => toks[pos];

  function atom(): Ast | null {
    const t = peek();
    if (!t) return null;
    if (t.t === 'lp') {
      pos++;
      const e = iff();
      const c = peek();
      if (c && c.t === 'rp') pos++;
      return e;
    }
    if (t.t === 'var') { pos++; return { k: 'var', name: t.name }; }
    return null;
  }
  function notExpr(): Ast | null {
    const t = peek();
    if (t && t.t === 'op' && t.op === 'not') {
      pos++;
      const a = notExpr();
      return a ? { k: 'not', a } : null;
    }
    return atom();
  }
  function andExpr(): Ast | null {
    let a = notExpr();
    while (a) {
      const t = peek();
      if (t && t.t === 'op' && t.op === 'and') { pos++; const b = notExpr(); if (!b) break; a = { k: 'and', a, b }; }
      else break;
    }
    return a;
  }
  function orExpr(): Ast | null {
    let a = andExpr();
    while (a) {
      const t = peek();
      if (t && t.t === 'op' && t.op === 'or') { pos++; const b = andExpr(); if (!b) break; a = { k: 'or', a, b }; }
      else break;
    }
    return a;
  }
  function impExpr(): Ast | null {
    // implicación asocia a la DERECHA: p → q → r ≡ p → (q → r)
    const a = orExpr();
    const t = peek();
    if (a && t && t.t === 'op' && t.op === 'imp') { pos++; const b = impExpr(); return b ? { k: 'imp', a, b } : a; }
    return a;
  }
  function iff(): Ast | null {
    let a = impExpr();
    while (a) {
      const t = peek();
      if (t && t.t === 'op' && t.op === 'iff') { pos++; const b = impExpr(); if (!b) break; a = { k: 'iff', a, b }; }
      else break;
    }
    return a;
  }

  const ast = iff();
  if (pos !== toks.length) return null; // tokens sobrantes = sintaxis inválida
  return ast;
}

function collectVars(ast: Ast, into: Set<string>): void {
  if (ast.k === 'var') into.add(ast.name);
  else if (ast.k === 'not') collectVars(ast.a, into);
  else { collectVars(ast.a, into); collectVars(ast.b, into); }
}

function evalAst(ast: Ast, env: Record<string, boolean>): boolean {
  switch (ast.k) {
    case 'var': return !!env[ast.name];
    case 'not': return !evalAst(ast.a, env);
    case 'and': return evalAst(ast.a, env) && evalAst(ast.b, env);
    case 'or': return evalAst(ast.a, env) || evalAst(ast.b, env);
    case 'imp': return !evalAst(ast.a, env) || evalAst(ast.b, env);   // ¬p ∨ q
    case 'iff': return evalAst(ast.a, env) === evalAst(ast.b, env);
  }
}

// ── Tabla de verdad completa ────────────────────────────────────────────

interface TruthTable {
  ok: boolean;
  vars: string[];                 // ordenadas alfabéticamente, ≤ 4
  rows: { bits: boolean[]; out: boolean }[]; // 2^n filas
  trueCount: number;
  kind: 'tautología' | 'contradicción' | 'contingencia' | 'inválida';
}

function buildTable(src: string): TruthTable {
  const ast = parse(tokenize(src));
  if (!ast) return { ok: false, vars: [], rows: [], trueCount: 0, kind: 'inválida' };

  const set = new Set<string>();
  collectVars(ast, set);
  let vars = [...set].sort();
  if (vars.length === 0) {
    // fórmula constante (sin variables) — evaluamos una sola vez con env vacío
    const out = evalAst(ast, {});
    return { ok: true, vars: [], rows: [{ bits: [], out }], trueCount: out ? 1 : 0, kind: out ? 'tautología' : 'contradicción' };
  }
  if (vars.length > 4) vars = vars.slice(0, 4); // cota dura: el hipercubo es 4D máx

  const n = vars.length;
  const rows: { bits: boolean[]; out: boolean }[] = [];
  let trueCount = 0;
  for (let m = 0; m < (1 << n); m++) {
    const bits: boolean[] = [];
    const env: Record<string, boolean> = {};
    for (let b = 0; b < n; b++) {
      // bit más significativo = primera variable (lectura natural de la tabla)
      const v = ((m >> (n - 1 - b)) & 1) === 1;
      bits.push(v);
      env[vars[b]] = v;
    }
    const out = evalAst(ast, env);
    if (out) trueCount++;
    rows.push({ bits, out });
  }
  const total = rows.length;
  const kind: TruthTable['kind'] =
    trueCount === total ? 'tautología' :
    trueCount === 0 ? 'contradicción' : 'contingencia';
  return { ok: true, vars, rows, trueCount, kind };
}

// ── Proyección del n-cubo a R³ ──────────────────────────────────────────
// Para n bits (n ≤ 4): el vértice de índice m tiene coordenadas (b0,b1,b2,b3).
//   x = b0,  y = b1,  z = b2,  y el 4º bit b3 desplaza TODO el cubo en +x.
// Centramos y escalamos para que entre en la cámara.

const HALF = 1.4;                 // semilado del cubo en unidades de escena
const W4 = 4.2;                   // separación entre los dos sub-cubos (n=4)

function vertexPos(bits: boolean[]): [number, number, number] {
  const b0 = bits[0] ? 1 : 0;
  const b1 = bits.length > 1 ? (bits[1] ? 1 : 0) : 0;
  const b2 = bits.length > 2 ? (bits[2] ? 1 : 0) : 0;
  const b3 = bits.length > 3 ? (bits[3] ? 1 : 0) : 0;
  const x = (b0 - 0.5) * 2 * HALF + (b3 === 1 ? W4 / 2 : (bits.length > 3 ? -W4 / 2 : 0));
  const y = (b1 - 0.5) * 2 * HALF;
  const z = (b2 - 0.5) * 2 * HALF;
  return [x, y, z];
}

// Vecinos de Hamming: índices que difieren en exactamente un bit → arista del cubo.
function hammingEdges(n: number): [number, number][] {
  const edges: [number, number][] = [];
  const count = 1 << n;
  for (let m = 0; m < count; m++) {
    for (let b = 0; b < n; b++) {
      const nb = m ^ (1 << b);
      if (nb > m) edges.push([m, nb]); // cada arista una sola vez
    }
  }
  return edges;
}

// ── Presets (fórmulas REALES, se parsean en vivo) ───────────────────────

interface Preset {
  id: string;
  label: string;
  formula: string;       // notación que teclearía el usuario
  pretty: string;        // notación unicode para mostrar
  blurb: string;
}

const PRESETS: Preset[] = [
  {
    id: 'implication',
    label: 'Implicación',
    formula: 'p -> q',
    pretty: 'p → q',
    blurb: 'Solo es FALSA cuando p es verdadera y q falsa. p→q ≡ ¬p ∨ q.',
  },
  {
    id: 'demorgan',
    label: 'De Morgan',
    formula: '!(p & q) <-> (!p | !q)',
    pretty: '¬(p ∧ q) ↔ (¬p ∨ ¬q)',
    blurb: 'Ley de De Morgan: TAUTOLOGÍA. Todos los vértices verdes.',
  },
  {
    id: 'xor',
    label: 'XOR (o exclusivo)',
    formula: '(p | q) & !(p & q)',
    pretty: '(p ∨ q) ∧ ¬(p ∧ q)',
    blurb: 'Verdadera cuando p y q DIFIEREN. Es ¬(p↔q).',
  },
  {
    id: 'modus-ponens',
    label: 'Modus ponens',
    formula: '((p -> q) & p) -> q',
    pretty: '((p → q) ∧ p) → q',
    blurb: 'La regla de inferencia clásica. TAUTOLOGÍA: siempre válida.',
  },
  {
    id: 'distributive',
    label: 'Distributiva',
    formula: '(p & (q | r)) <-> ((p & q) | (p & r))',
    pretty: 'p ∧ (q ∨ r) ↔ (p ∧ q) ∨ (p ∧ r)',
    blurb: '3 variables → cubo completo de 8 vértices. TAUTOLOGÍA.',
  },
  {
    id: 'contradiction',
    label: 'Contradicción',
    formula: 'p & !p',
    pretty: 'p ∧ ¬p',
    blurb: 'NUNCA verdadera. Todos los vértices rojos.',
  },
];

const KIND_COLOR: Record<TruthTable['kind'], string> = {
  'tautología': TRUE_COLOR,
  'contradicción': FALSE_COLOR,
  'contingencia': '#FDB813',
  'inválida': '#94A3B8',
};

// ── Lección ─────────────────────────────────────────────────────────────

const LESSON: Lesson<LogicState> = {
  hook: {
    title: 'Una fórmula lógica no se "cree" — se VERIFICA en todas sus filas.',
    body: `La lógica proposicional construye enunciados con cinco conectivos: ¬ (no), ∧ (y), ∨ (o), → (implica) y ↔ (si y solo si).

El significado de una fórmula es su TABLA DE VERDAD: el valor que toma para cada combinación posible de sus variables. Con n variables hay 2ⁿ combinaciones — y o la fórmula es verdadera en todas (tautología), en ninguna (contradicción), o en algunas (contingencia).

George Boole (1854) convirtió esto en álgebra. Hoy es la base de TODO: circuitos digitales, demostraciones matemáticas, bases de datos, verificación de programas.

Aquí no hardcodeamos ninguna tabla. Tecleas una fórmula, la PARSEAMOS a un árbol de sintaxis y la EVALUAMOS sobre las 2ⁿ filas. Cada fila es un vértice de un hipercubo: verde si la fórmula es verdadera ahí, rojo si es falsa.`,
  },

  steps: [
    {
      title: 'La implicación p → q — el conectivo traicionero',
      duration: 5500,
      body: `Empezamos con p → q. Dos variables, así que el cubo lógico es un CUADRADO de 4 vértices.

Mira con cuidado: p → q solo es FALSA en UN caso — cuando p es verdadera y q es falsa (el vértice rojo). En los otros tres es verdadera.

Eso confunde a todo el mundo: "si p es falsa, la implicación es verdadera". Es la implicación material: p → q significa exactamente ¬p ∨ q.

"Si llueve, llevo paraguas." Si NO llueve, la promesa no se rompió pase lo que pase. Solo mientes si llueve y NO llevas paraguas.`,
      formula: 'p → q  ≡  ¬p ∨ q\nfalsa solo si  p=V, q=F',
      keyframes: [
        { at: 0, state: { presetId: 'implication' } },
        { at: 1, state: { presetId: 'implication' } },
      ],
    },
    {
      title: 'De Morgan — un cubo TODO verde es una tautología',
      duration: 5500,
      body: `Ahora ¬(p ∧ q) ↔ (¬p ∨ ¬q). Es la ley de De Morgan, escrita como un bicondicional.

Mira: los 4 vértices son VERDES. La fórmula es verdadera para CUALQUIER valor de p y q. Eso es una TAUTOLOGÍA — una verdad lógica, cierta por su forma, no por los datos.

De Morgan dice: negar "p y q" es lo mismo que decir "no-p o no-q". Negar una conjunción la convierte en disyunción.

Esto es lo que usas todos los días al programar: !(a && b) es lo mismo que !a || !b. El compilador lo aprovecha para optimizar condiciones.`,
      formula: '¬(p ∧ q) ↔ (¬p ∨ ¬q)\ntautología: 4/4 vértices verdes',
      keyframes: [
        { at: 0, state: { presetId: 'demorgan' } },
        { at: 1, state: { presetId: 'demorgan' } },
      ],
    },
    {
      title: 'XOR — verdadera cuando las variables DIFIEREN',
      duration: 5500,
      body: `El "o exclusivo": (p ∨ q) ∧ ¬(p ∧ q). Verdadera cuando exactamente UNA de p, q es verdadera.

Mira la diagonal: verde en (V,F) y (F,V), rojo en (V,V) y (F,F). XOR detecta DESACUERDO.

Es la negación del bicondicional: XOR(p,q) = ¬(p ↔ q). Y es el corazón de la aritmética binaria: el bit de suma de un sumador completo es un XOR.

También es la base del cifrado más simple (one-time pad) y de los códigos de paridad que detectan errores en tu disco duro.`,
      formula: 'XOR(p,q) = (p ∨ q) ∧ ¬(p ∧ q) = ¬(p ↔ q)\ncontingencia: 2/4 verdaderas',
      keyframes: [
        { at: 0, state: { presetId: 'xor' } },
        { at: 1, state: { presetId: 'xor' } },
      ],
    },
    {
      title: 'Modus ponens — por qué razonar funciona',
      duration: 6000,
      body: `La regla de oro del razonamiento: ((p → q) ∧ p) → q. "Si sabes que p implica q, y sabes p, entonces concluyes q."

Es una fórmula con 2 variables, y otra vez TODOS los vértices son verdes: TAUTOLOGÍA. Modus ponens NUNCA falla — es lógicamente válido por su forma.

Eso es lo que hace confiable a una demostración matemática: cada paso es una tautología como esta. Encadenas modus ponens y la conclusión hereda la verdad de las premisas.

Aristóteles lo formalizó hace 2300 años. Hoy un asistente de pruebas (Lean, Coq) verifica teoremas aplicando exactamente esta regla, millones de veces.`,
      formula: '((p → q) ∧ p) → q\ntautología (regla de inferencia válida)',
      keyframes: [
        { at: 0, state: { presetId: 'modus-ponens' } },
        { at: 1, state: { presetId: 'modus-ponens' } },
      ],
    },
    {
      title: 'Tres variables — el cubo completo y la distributiva',
      duration: 6000,
      body: `Subimos a 3 variables: p ∧ (q ∨ r) ↔ (p ∧ q) ∨ (p ∧ r). Ahora hay 2³ = 8 combinaciones — un CUBO de 8 vértices.

Es la ley distributiva del ∧ sobre el ∨, idéntica a la del × sobre el + en aritmética. Y es TAUTOLOGÍA: los 8 vértices verdes.

Las aristas conectan vértices que difieren en UN solo bit (vecinos de Hamming). Recorrer una arista = cambiar el valor de una variable. Así el cubo es literalmente el "espacio de estados" de tus proposiciones.

Con 4 variables tendrías un teseracto: 16 vértices, dibujado como dos cubos conectados. Prueba el sandbox y teclea tu propia fórmula.`,
      formula: 'p ∧ (q ∨ r) ↔ (p ∧ q) ∨ (p ∧ r)\n2³ = 8 vértices · tautología',
      keyframes: [
        { at: 0, state: { presetId: 'distributive' } },
        { at: 1, state: { presetId: 'distributive' } },
      ],
    },
  ],

  connect: {
    body: `Tecleaste una fórmula, la convertimos en árbol, la evaluamos en las 2ⁿ filas y el cubo te mostró la respuesta. Eso es lógica proposicional COMPLETA — todo lo decidible se reduce a recorrer la tabla.

Hacia dónde sigue:

• Mapas de Karnaugh y minimización booleana → diseño de circuitos digitales (el chip de tu compu).
• SAT solvers: ¿existe alguna fila verdadera? Es el primer problema NP-completo (Cook 1971), motor de la verificación de hardware moderna.
• Lógica de predicados: agrega ∀ y ∃ — ahí viven las matemáticas de verdad (Gödel, completitud e incompletitud).
• Asistentes de pruebas (Lean, Coq): encadenan tautologías como modus ponens para verificar teoremas.
• Álgebras de Boole: la estructura abstracta detrás de conjuntos, lógica y probabilidad a la vez.

La idea clave: una verdad lógica es verdadera por su FORMA, no por el mundo. Por eso es transportable a cualquier dominio.`,
    links: [
      { label: 'Conjuntos — unión/intersección son ∨/∧', href: '#sets' },
      { label: 'Asistente de demostración — encadenar tautologías', href: '#proof' },
      { label: 'Cadenas de Markov — estados como vértices', href: '#markov' },
    ],
  },
};

// ── Componente ──────────────────────────────────────────────────────────

export default function Logic() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState('implication');
  const [custom, setCustom] = useState('');         // fórmula tecleada por el usuario
  const [useCustom, setUseCustom] = useState(false);

  const preset = useMemo(() => PRESETS.find(p => p.id === presetId) ?? PRESETS[0], [presetId]);
  const source = useCustom ? custom : preset.formula;

  const table = useMemo(() => buildTable(source), [source]);

  const n = table.vars.length;
  const edges = useMemo(() => (table.ok && n >= 1 && n <= 4 ? hammingEdges(n) : []), [table.ok, n]);

  // posiciones de los vértices (una por fila)
  const verts = useMemo(
    () => (table.ok ? table.rows.map(r => ({ pos: vertexPos(r.bits), out: r.out, bits: r.bits })) : []),
    [table],
  );

  // distancia de cámara según dimensionalidad
  const camDist = n >= 4 ? 9 : n === 3 ? 7 : 6;

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage captureMode bgColor="#05060A" cameraDistance={camDist} autoRotate bloomIntensity={0.6} bloomThreshold={0.5}>
          <CanvasCapture />

          {/* Aristas del hipercubo (vecinos de Hamming) */}
          {edges.map(([a, b], i) => {
            const pa = verts[a]?.pos, pb = verts[b]?.pos;
            if (!pa || !pb) return null;
            return (
              <Line
                key={`e${i}`}
                points={[pa, pb]}
                color={EDGE_COLOR}
                lineWidth={1}
                transparent
                opacity={0.55}
              />
            );
          })}

          {/* Vértices = filas de la tabla. Verde = verdadero, rojo = falso. */}
          {verts.map((v, i) => {
            const col = v.out ? TRUE_COLOR : FALSE_COLOR;
            return (
              <mesh key={`v${i}`} position={v.pos}>
                <sphereGeometry args={[0.16, 24, 24]} />
                <meshStandardMaterial
                  color={col}
                  emissive={col}
                  emissiveIntensity={v.out ? 1.4 : 1.1}
                  toneMapped={false}
                />
              </mesh>
            );
          })}

          {/* Etiqueta del vértice = la asignación de bits (V/F por variable) */}
          {n <= 3 && verts.map((v, i) => (
            <Html
              key={`l${i}`}
              position={[v.pos[0], v.pos[1] + 0.32, v.pos[2]]}
              center
              distanceFactor={10}
              style={{ pointerEvents: 'none' }}
            >
              <div style={{
                fontFamily: 'monospace',
                fontSize: 11,
                whiteSpace: 'nowrap',
                color: v.out ? '#D1FAE5' : '#FECACA',
                textShadow: '0 0 6px #000',
              }}>
                {table.vars.map((name, b) => `${name}=${v.bits[b] ? 'V' : 'F'}`).join(' ')}
              </div>
            </Html>
          ))}
        </Stage>

        {/* HUD: leyenda + clasificación */}
        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div className="text-white">{useCustom ? source || '(escribe una fórmula)' : preset.pretty}</div>
          <div><span style={{ color: TRUE_COLOR }}>●</span> verdadero</div>
          <div><span style={{ color: FALSE_COLOR }}>●</span> falso</div>
          {table.ok ? (
            <div className="mt-1" style={{ color: KIND_COLOR[table.kind] }}>
              {table.kind} · {table.trueCount}/{table.rows.length} V
            </div>
          ) : (
            <div className="mt-1 text-[#EF5350]">sintaxis inválida</div>
          )}
          {table.ok && n > 0 && (
            <div className="text-[#64748B]">n = {n} → 2ⁿ = {table.rows.length} vértices</div>
          )}
        </div>
      </div>

      <LessonPanel<LogicState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) {
            setPresetId(patch.presetId);
            setUseCustom(false);
          }
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Fórmula (preset)</div>
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPresetId(p.id); setUseCustom(false); }}
                    className={`text-left text-[11px] px-2 py-1.5 rounded border transition ${
                      !useCustom && presetId === p.id
                        ? 'bg-[#94A3B8]/15 border-[#94A3B8]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8]/40'
                    }`}
                  >
                    <div className="font-semibold font-mono">{p.pretty}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{p.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Escribe tu fórmula</div>
              <input
                type="text"
                value={custom}
                placeholder="p -> q  ·  !(p & q)  ·  p <-> q"
                onChange={e => { setCustom(e.target.value); setUseCustom(true); }}
                onFocus={() => { if (!useCustom) { setCustom(preset.formula); setUseCustom(true); } }}
                className="w-full text-[12px] font-mono px-2 py-1.5 rounded border border-[#1E293B] bg-[#05060A] text-white
                           focus:border-[#94A3B8]/60 outline-none"
              />
              <div className="text-[10px] text-[#64748B] mt-1.5 leading-snug">
                Conectivos: <span className="text-[#CBD5E1]">! ~ ¬</span> (no), <span className="text-[#CBD5E1]">&amp; * ∧</span> (y),
                {' '}<span className="text-[#CBD5E1]">| + ∨</span> (o), <span className="text-[#CBD5E1]">-&gt; → </span>(implica),
                {' '}<span className="text-[#CBD5E1]">&lt;-&gt; ↔</span> (sii). Variables: una letra (máx 4).
              </div>
              {useCustom && (
                <button
                  onClick={() => setUseCustom(false)}
                  className="mt-2 w-full text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#94A3B8]/40 hover:text-white"
                >
                  ← volver a los presets
                </button>
              )}
            </div>

            {/* Tabla de verdad generada en vivo */}
            <div className="border-t border-[#1E293B] pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Tabla de verdad</div>
                {table.ok && (
                  <div className="text-[10px] font-mono font-semibold" style={{ color: KIND_COLOR[table.kind] }}>
                    {table.kind}
                  </div>
                )}
              </div>
              {!table.ok ? (
                <div className="text-[11px] text-[#EF5350]">Fórmula con sintaxis inválida.</div>
              ) : (
                <div className="text-[11px] font-mono">
                  <div className="grid border-b border-[#1E293B] pb-1 mb-1"
                       style={{ gridTemplateColumns: `repeat(${Math.max(n, 1)}, 1fr) 1.2fr` }}>
                    {table.vars.map(v => <span key={v} className="text-[#CBD5E1] text-center">{v}</span>)}
                    {n === 0 && <span className="text-[#CBD5E1] text-center">—</span>}
                    <span className="text-center" style={{ color: ACCENT }}>φ</span>
                  </div>
                  <div className="max-h-44 overflow-y-auto space-y-0.5">
                    {table.rows.map((r, i) => (
                      <div key={i} className="grid"
                           style={{ gridTemplateColumns: `repeat(${Math.max(n, 1)}, 1fr) 1.2fr` }}>
                        {r.bits.map((bit, b) => (
                          <span key={b} className="text-center text-[#94A3B8]">{bit ? '1' : '0'}</span>
                        ))}
                        {n === 0 && <span className="text-center text-[#94A3B8]">·</span>}
                        <span className="text-center font-semibold"
                              style={{ color: r.out ? TRUE_COLOR : FALSE_COLOR }}>
                          {r.out ? '1' : '0'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 text-[10px] text-[#64748B]">
                    {table.trueCount} de {table.rows.length} filas verdaderas
                  </div>
                </div>
              )}
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Parser recursive-descent con precedencia ¬ &gt; ∧ &gt; ∨ &gt; → &gt; ↔ (→ asocia a la derecha).
                Evaluación exhaustiva sobre las 2ⁿ asignaciones; p → q se reduce a ¬p ∨ q. La tabla NO está
                hardcodeada — emerge del árbol de sintaxis.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
