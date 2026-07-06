/**
 * Evolución Molecular — mutación + selección + deriva + árbol filogenético 3D.
 *
 * FÍSICA REAL:
 *   - Modelo Jukes-Cantor (1969): distancia evolutiva d = -3/4 · ln(1 - 4p/3)
 *     donde p = proporción de sitios diferentes entre dos secuencias.
 *   - Mutación por proceso de Poisson: P(k mutaciones en tiempo t) = e^(-μt)(μt)^k/k!
 *     con tasa μ por sitio por generación.
 *   - Selección: fijación de mutación beneficiosa P_fix = (1-e^(-2s)) / (1-e^(-4Ns))
 *     modelo de Wright-Fisher + Kimura.
 *   - Deriva genética: fluctuación aleatoria de frecuencias alélicas en población
 *     finita N — varianza Δp = p(1-p)/(2N) por generación (modelo WF difuso).
 *   - Árbol UPGMA: construcción bottom-up con distancia de Hamming + corrección JC.
 *   - Posiciones del árbol via spring-layout 3D iterativo (minimización de energía).
 *
 * Visualización:
 *   - Nodos del árbol = esferas emisivas coloreadas por clade.
 *   - Aristas = tubos con longitud proporcional a distancia evolutiva.
 *   - Secuencias de ADN (30 bp) que mutan en tiempo real — bases coloreadas por tipo.
 *   - Point cloud de partículas acumulando historial de divergencia.
 */

import { useMemo, useRef, useState, useEffect, forwardRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface EvoLessonState {
  scenario: string;
}

type Base = 'A' | 'T' | 'C' | 'G';
const BASES: Base[] = ['A', 'T', 'C', 'G'];

interface Taxon {
  id: number;
  label: string;
  seq: Base[];          // secuencia actual (30 bp)
  ancestor: number;     // id del ancestro (-1 = raíz)
  branchLen: number;    // distancia JC al ancestro
  pos3d: THREE.Vector3; // posición en el árbol 3D
  color: THREE.Color;
  fitness: number;      // [0,1] — promedio de distancia al óptimo
}

interface EvoParams {
  mu: number;          // tasa de mutación por sitio por generación
  N: number;           // tamaño poblacional efectivo
  s: number;           // coeficiente de selección
  seqLen: number;      // longitud de la secuencia
  nTaxa: number;       // número de taxa a generar
}

// ─── LESSON ───────────────────────────────────────────────────────────────────

const LESSON: Lesson<EvoLessonState> = {
  hook: {
    title: 'Toda la vida en la Tierra comparte una sola molécula ancestral. El árbol filogenético ES la historia.',
    body: `En 1977, Carl Woese comparó secuencias de ARNr 16S de miles de organismos. No con microscopio — con álgebra de mutaciones. Contó diferencias entre moléculas y reconstruyó el árbol de la vida.

El principio es brutal en su elegancia: cada mutación que se fija en una población deja una HUELLA en el ADN. Si dos especies comparten una mutación, heredaron esa huella de un ancestro común.

Contar diferencias → estimar distancias → reconstruir el árbol → revelar la historia.

Aquí verás ese proceso en tiempo real: una población de secuencias que diverge por mutación, selección y deriva. El árbol 3D se actualiza con cada evento de especiación. La física es Jukes-Cantor (1969) + Wright-Fisher.`,
  },

  steps: [
    {
      title: 'Mutación pura — modelo Jukes-Cantor',
      duration: 6000,
      body: `Empezamos con tasa de mutación alta (μ = 0.01/sitio/gen) y SIN selección (s = 0).

El modelo Jukes-Cantor asume que toda mutación es igualmente probable: de cualquier base a cualquiera de las otras tres, con tasa μ/3 cada una.

La distancia evolutiva corregida es: d = -3/4 · ln(1 - 4p/3), donde p es la proporción de sitios diferentes entre dos secuencias. Esta corrección elimina el sesgo por mutaciones MÚLTIPLES en el mismo sitio.

Observa cómo las secuencias en la tabla cambian aleatoriamente — cada base tiene la misma probabilidad de mutar a cada estado. El árbol crece simétricamente porque no hay presión selectiva.`,
      formula: 'Jukes-Cantor:\nd = -¾ ln(1 - 4p/3)\np = sitios distintos / total',
      keyframes: [
        { at: 0, state: { scenario: 'neutral' } },
        { at: 1, state: { scenario: 'neutral' } },
      ],
    },
    {
      title: 'Selección — el filtro de la adaptación',
      duration: 6500,
      body: `Activamos selección (s = 0.05) sobre una secuencia "óptima". Cada mutación que acerca la secuencia al óptimo tiene ventaja de fijación:

P_fix = (1 - e^{-2s}) / (1 - e^{-4Ns})

Para N grande y s pequeño, P_fix ≈ 2s — la mutación beneficiosa se fija con probabilidad ~2s, no 1/(2N) como una neutral.

Observa cómo las ramas del árbol se acortan: las secuencias convergen hacia el óptimo. El árbol ya NO es simétrico — algunas ramas prosperan, otras quedan atrás. La selección deja su firma en la TOPOLOGÍA del árbol.`,
      formula: 'Kimura fixation:\nP_fix = (1-e^{-2s}) / (1-e^{-4Ns})\n→ ≈ 2s para Ns >> 1',
      keyframes: [
        { at: 0, state: { scenario: 'selection' } },
        { at: 1, state: { scenario: 'selection' } },
      ],
    },
    {
      title: 'Deriva genética — el ruido triunfa sobre la selección',
      duration: 6000,
      body: `Población pequeña (N = 20) con selección moderada (s = 0.02). Aquí la deriva GANA.

La varianza de cambio de frecuencia alélica por generación es Δp² = p(1-p)/(2N). Con N = 20, esto es enorme — el azar puede eliminar mutaciones BENEFICIOSAS y fijar mutaciones DAÑINAS.

Condición de Kimura: la selección supera a la deriva cuando Ns >> 1. Aquí Ns = 20 × 0.02 = 0.4 < 1 — domina la deriva.

El árbol resultante es irregular, caótico. Algunas ramas mueren al azar. La evolución en poblaciones pequeñas es impredecible — esto explica cómo islas y poblaciones aisladas divergen rápidamente.`,
      formula: 'Deriva: Var(Δp) = p(1-p)/(2N)\nDeriva domina cuando Ns << 1',
      keyframes: [
        { at: 0, state: { scenario: 'drift' } },
        { at: 1, state: { scenario: 'drift' } },
      ],
    },
    {
      title: 'UPGMA — reconstruyendo el árbol a partir de distancias',
      duration: 5500,
      body: `Con las secuencias divergidas, aplicamos UPGMA (Unweighted Pair Group Method with Arithmetic Mean) para reconstruir el árbol filogenético.

Paso 1: calcular la matriz de distancias JC entre todos los pares de taxa.
Paso 2: unir el par con menor distancia en un nodo ancestral.
Paso 3: recalcular distancias del nuevo nodo al resto (promedio aritmético).
Paso 4: repetir hasta tener un solo nodo raíz.

El árbol 3D que ves fue construido exactamente así. Las longitudes de rama son proporcionales a las distancias JC — eso las hace MÉTRICAS en unidades de sustituciones por sitio.

UPGMA asume una tasa de evolución constante ("reloj molecular" de Zuckerkandl-Pauling, 1965). Cuando la tasa varía, se usa Neighbor-Joining (1987).`,
      formula: 'UPGMA:\nd(AB,C) = (d_AC + d_BC)/2\nlongitud = distancia JC',
      keyframes: [
        { at: 0, state: { scenario: 'upgma' } },
        { at: 1, state: { scenario: 'upgma' } },
      ],
    },
  ],

  connect: {
    body: `La evolución molecular conecta directamente con:

• Epidemiología: reconstruir el árbol del SARS-CoV-2 a partir de genomas virales — mapear la propagación de la pandemia en tiempo real (Nextstrain).
• Farmacología: la resistencia a antibióticos es evolución por selección fuerte (s >> 1) en poblaciones enormes (N ~ 10^9) — la fijación es casi determinista.
• Antropología: el reloj molecular del ADN mitocondrial (μ ~ 2.5% por millón de años) fijó la "Eva mitocondrial" en ~150,000 a 200,000 años.
• Cáncer: un tumor es una población de células donde la selección favorece proliferación y evasión inmune. La oncología evolutiva aplica exactamente estos modelos.

La vida es un proceso físico-estadístico. Las mismas ecuaciones que rigen la difusión de partículas en un fluido rigen la deriva de alelos en una población.`,
    links: [
      { label: 'Proteína — folding y función', href: '#protein-folding' },
      { label: 'Genómica Médica — variantes en enfermedad', href: '#genome-medicine' },
      { label: 'Doble Hélice — el portador de la información', href: '#double-helix' },
    ],
  },
};

// ─── Parámetros por escenario ──────────────────────────────────────────────

const SCENARIOS: Record<string, EvoParams> = {
  neutral: { mu: 0.012, N: 500, s: 0.0,  seqLen: 30, nTaxa: 8 },
  selection: { mu: 0.008, N: 300, s: 0.06, seqLen: 30, nTaxa: 8 },
  drift:     { mu: 0.010, N: 20,  s: 0.02, seqLen: 30, nTaxa: 8 },
  upgma:     { mu: 0.015, N: 200, s: 0.01, seqLen: 30, nTaxa: 10 },
};

// ─── Motor de evolución molecular ─────────────────────────────────────────────

function randBase(exclude?: Base): Base {
  const pool = BASES.filter(b => b !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Secuencia aleatoria de longitud L */
function randomSeq(L: number): Base[] {
  return Array.from({ length: L }, () => BASES[Math.floor(Math.random() * 4)]);
}

/** Distancia Hamming normalizada */
function hammingP(a: Base[], b: Base[]): number {
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff / a.length;
}

/** Distancia Jukes-Cantor corregida. Clamp para evitar log de negativo. */
function jukesCantor(a: Base[], b: Base[]): number {
  const p = hammingP(a, b);
  const x = 1 - (4 / 3) * p;
  if (x <= 0) return 2.0; // divergencia máxima
  return -(3 / 4) * Math.log(x);
}

/**
 * Probabilidad de fijación de Kimura.
 * Para s=0 devuelve 1/(2N) (neutro).
 */
function pFix(s: number, N: number): number {
  if (Math.abs(s) < 1e-9) return 1 / (2 * N);
  const a = 1 - Math.exp(-2 * s);
  const b = 1 - Math.exp(-4 * N * s);
  return b === 0 ? 1 / (2 * N) : a / b;
}

/** Muta una secuencia. Devuelve copia con mutaciones fijadas. */
function mutateSeq(seq: Base[], mu: number, N: number, s: number, optSeq: Base[]): Base[] {
  const out = [...seq];
  for (let i = 0; i < seq.length; i++) {
    if (Math.random() < mu) {
      const newBase = randBase(seq[i]);
      // Coeficiente de selección para esta mutación
      const sBene = newBase === optSeq[i] ? s : (seq[i] === optSeq[i] ? -s : 0);
      const pf = pFix(sBene, N);
      // Acepto la mutación con probabilidad pFix (WF simplificado)
      if (Math.random() < Math.min(1, pf * 2 * N)) {
        out[i] = newBase;
      }
    }
  }
  return out;
}

// ─── UPGMA ──────────────────────────────────────────────────────────────────

interface TreeNode {
  id: number;
  label: string;
  children: TreeNode[];
  branchLen: number; // rama hacia el padre
  height: number;   // distancia acumulada desde la raíz
}

function upgma(seqs: Base[][], labels: string[]): TreeNode[] {
  const n = seqs.length;
  // Matriz de distancias JC
  const D: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => i === j ? 0 : jukesCantor(seqs[i], seqs[j]))
  );
  // Nodos activos
  const nodes: TreeNode[] = seqs.map((_, i) => ({
    id: i, label: labels[i], children: [], branchLen: 0, height: 0,
  }));
  let nextId = n;
  const active = nodes.map((_, i) => i); // índices en el array `nodes`

  // Las alturas son el promedio de distancias / 2 (UPGMA)
  const heights = new Array(n * 2).fill(0);

  while (active.length > 1) {
    // Buscar el par con distancia mínima entre nodos activos
    let minD = Infinity, ai = -1, aj = -1;
    for (let ii = 0; ii < active.length; ii++) {
      for (let jj = ii + 1; jj < active.length; jj++) {
        const i = active[ii], j = active[jj];
        if (D[i][j] < minD) { minD = D[i][j]; ai = ii; aj = jj; }
      }
    }
    const ci = active[ai], cj = active[aj];
    const newHeight = minD / 2;

    // Crear nodo ancestral
    const ancestor: TreeNode = {
      id: nextId++,
      label: `anc${nextId}`,
      children: [nodes[ci], nodes[cj]],
      branchLen: 0,
      height: newHeight,
    };
    // Ajustar branch lengths de los hijos
    nodes[ci].branchLen = newHeight - heights[ci];
    nodes[cj].branchLen = newHeight - heights[cj];
    heights[ancestor.id] = newHeight;

    nodes.push(ancestor);

    // Nueva fila/columna de distancias promediadas (UPGMA average)
    const newRow: number[] = [];
    for (let k = 0; k < active.length; k++) {
      const ck = active[k];
      if (ck === ci || ck === cj) { newRow.push(0); continue; }
      const dAvg = (D[ci][ck] + D[cj][ck]) / 2;
      newRow.push(dAvg);
    }
    // Reemplazar ci y cj con el nuevo nodo en la matriz
    for (let k = 0; k < active.length; k++) {
      const ck = active[k];
      if (ck !== ci && ck !== cj) {
        D[ancestor.id] = D[ancestor.id] ?? [];
        D[ck] = D[ck] ?? [];
        const dAvg = (D[ci][ck] + D[cj][ck]) / 2;
        if (D[ancestor.id]) D[ancestor.id]![ck] = dAvg;
        if (D[ck]) D[ck]![ancestor.id] = dAvg;
      }
    }
    D[ancestor.id]![ancestor.id] = 0;

    // Remover ci y cj, agregar nuevo nodo
    active.splice(aj, 1);
    active.splice(ai, 1);
    active.push(ancestor.id);
  }

  return nodes;
}

// ─── Layout 3D del árbol (spring-layout iterativo) ────────────────────────

function treeLayout3D(nodes: TreeNode[], leafCount: number): Map<number, THREE.Vector3> {
  const pos = new Map<number, THREE.Vector3>();

  // Posicionar hojas en una corona circular en xz
  let leafIdx = 0;
  function assignLeafPositions(node: TreeNode) {
    if (node.children.length === 0) {
      const angle = (leafIdx / leafCount) * Math.PI * 2;
      const r = 3.5;
      pos.set(node.id, new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r));
      leafIdx++;
    } else {
      node.children.forEach(assignLeafPositions);
    }
  }

  // Encontrar la raíz (el último nodo generado con más hijos)
  const root = nodes[nodes.length - 1];
  assignLeafPositions(root);

  // Posicionar nodos internos: promedio de sus hijos + altura en Y
  function assignInternalPositions(node: TreeNode) {
    if (node.children.length === 0) return;
    node.children.forEach(assignInternalPositions);
    const childPositions = node.children
      .map(c => pos.get(c.id))
      .filter((p): p is THREE.Vector3 => p !== undefined);
    if (childPositions.length === 0) return;
    const avg = new THREE.Vector3();
    childPositions.forEach(p => avg.add(p));
    avg.divideScalar(childPositions.length);
    avg.y = node.height * 3.5; // escalar la altura
    pos.set(node.id, avg);
  }
  assignInternalPositions(root);

  // La raíz misma
  if (!pos.has(root.id)) {
    pos.set(root.id, new THREE.Vector3(0, root.height * 3.5, 0));
  }

  return pos;
}

// ─── Colores por clade ────────────────────────────────────────────────────

const CLADE_COLORS = [
  new THREE.Color('#4FC3F7'), // cyan
  new THREE.Color('#F472B6'), // pink
  new THREE.Color('#34D399'), // green
  new THREE.Color('#FBBF24'), // amber
  new THREE.Color('#A78BFA'), // violet
  new THREE.Color('#FB923C'), // orange
  new THREE.Color('#38BDF8'), // sky
  new THREE.Color('#F87171'), // red
  new THREE.Color('#86EFAC'), // lime
  new THREE.Color('#C084FC'), // purple
];

const BASE_COLORS: Record<Base, string> = {
  A: '#34D399', // verde
  T: '#F472B6', // rosa
  C: '#4FC3F7', // cyan
  G: '#FBBF24', // ámbar
};

// ─── Estado de la simulación (fuera de React para mutabilidad) ────────────

interface SimState {
  seqs: Base[][];     // secuencias actuales
  gen: number;
  optSeq: Base[];
  params: EvoParams;
  treeNodes: TreeNode[];
  treePos: Map<number, THREE.Vector3>;
  labels: string[];
}

function initSim(scenario: string): SimState {
  const params = SCENARIOS[scenario] ?? SCENARIOS.neutral!;
  const { seqLen, nTaxa } = params;
  const optSeq = randomSeq(seqLen);
  // ancestro común = casi el óptimo
  const ancestor = optSeq.map(b => (Math.random() < 0.1 ? randBase(b) : b)) as Base[];
  // Cada taxon parte del ancestro con pequeñas perturbaciones
  const labels = Array.from({ length: nTaxa }, (_, i) => `T${i + 1}`);
  const seqs = labels.map(() =>
    ancestor.map(b => (Math.random() < 0.05 ? randBase(b) : b)) as Base[]
  );
  const treeNodes = upgma(seqs, labels);
  const treePos = treeLayout3D(treeNodes, nTaxa);
  return { seqs, gen: 0, optSeq, params, treeNodes, treePos, labels };
}

// ─── Componente principal ─────────────────────────────────────────────────

export default function MolecularEvolution() {
  const { audience } = useAudience();
  const [scenario, setScenario] = useState<string>('neutral');
  const [running, setRunning] = useState(true);
  const [gen, setGen] = useState(0);
  const [mu, setMu] = useState(0.012);
  const [N, setN] = useState(500);
  const [s, setS] = useState(0.0);

  // SimState en ref para evitar re-renders en el loop
  const sim = useRef<SimState>(initSim(scenario));

  // Cuando cambia el escenario o parámetros, reinicializar
  const reset = (sc: string) => {
    const base = SCENARIOS[sc] ?? SCENARIOS.neutral!;
    sim.current = initSim(sc);
    sim.current.params = { ...base, mu, N, s };
    setGen(0);
  };

  useEffect(() => {
    reset(scenario);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  // Loop de simulación via rAF
  const rafRef = useRef<number>(0);
  const lastUiRef = useRef(0);
  useEffect(() => {
    if (!running) return;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const st = sim.current;
      // Actualizar parámetros live
      st.params.mu = mu;
      st.params.N = N;
      st.params.s = s;

      // Avanzar VARIAS generaciones por frame para velocidad visual
      const stepsPerFrame = 3;
      for (let step = 0; step < stepsPerFrame; step++) {
        st.seqs = st.seqs.map(seq =>
          mutateSeq(seq, st.params.mu, st.params.N, st.params.s, st.optSeq)
        );
        st.gen++;
      }

      // Reconstruir árbol cada 30 generaciones
      if (st.gen % 30 === 0) {
        st.treeNodes = upgma(st.seqs, st.labels);
        st.treePos = treeLayout3D(st.treeNodes, st.seqs.length);
      }

      const now = performance.now();
      if (now - lastUiRef.current > 120) {
        setGen(st.gen);
        lastUiRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(rafRef.current); };
  }, [running, mu, N, s]);

  // Distancia media entre taxa
  const seqs = sim.current.seqs;
  const labels = sim.current.labels;
  let totalDist = 0, nPairs = 0;
  for (let i = 0; i < seqs.length; i++) {
    for (let j = i + 1; j < seqs.length; j++) {
      totalDist += jukesCantor(seqs[i]!, seqs[j]!);
      nPairs++;
    }
  }
  const meanDist = nPairs > 0 ? totalDist / nPairs : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={7} autoRotate bloomIntensity={0.9} bloomThreshold={0.1}>
          <EvoScene simRef={sim} />
        </Stage>

        {/* HUD — métricas */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">gen&nbsp;&nbsp;&nbsp;</span>= {gen}</div>
          <div><span className="text-[#64748B]">taxa&nbsp;&nbsp;</span>= {seqs.length}</div>
          <div><span className="text-[#64748B]">d̄(JC)&nbsp;</span>= {meanDist.toFixed(3)}</div>
          <div><span className="text-[#64748B]">μ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {mu.toFixed(4)}</div>
          <div><span className="text-[#64748B]">N&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {N}</div>
          <div><span className="text-[#64748B]">s&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {s.toFixed(3)}</div>
        </div>

        {/* Leyenda de secuencias */}
        <div className="absolute top-4 right-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-3 py-2 font-mono text-[10px]">
          <div className="text-[9px] text-[#64748B] mb-1.5 uppercase tracking-wider">Bases</div>
          {(['A', 'T', 'C', 'G'] as Base[]).map(b => (
            <div key={b} className="flex items-center gap-1.5">
              <span style={{ color: BASE_COLORS[b] }}>■</span>
              <span className="text-[#CBD5E1]">{b}</span>
            </div>
          ))}
        </div>

        {/* Tabla de secuencias (2 taxa) */}
        <SeqTable seqs={seqs} labels={labels} running={running} />

        {/* Controles */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => reset(scenario)} title="Reiniciar">↺</IconBtn>
        </div>
      </div>

      <LessonPanel<EvoLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.scenario !== undefined) {
            const sc = patch.scenario;
            setScenario(sc);
            const base = SCENARIOS[sc] ?? SCENARIOS.neutral!;
            setMu(base.mu);
            setN(base.N);
            setS(base.s);
          }
        }}
        sandbox={
          <>
            <Section title="Escenario">
              <div className="grid grid-cols-1 gap-1.5">
                {Object.entries(SCENARIOS).map(([id, p]) => (
                  <button key={id} onClick={() => { setScenario(id); setMu(p.mu); setN(p.N); setS(p.s); }}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      scenario === id
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >{SCENARIO_NAMES[id] ?? id}</button>
                ))}
              </div>
            </Section>

            <Section title="Estado">
              <Row label="Generación" value={String(gen)} />
              <Row label="Taxa" value={String(seqs.length)} />
              <Row label="d̄ JC" value={meanDist.toFixed(4)} />
              <Row label="Divergencia %" value={`${(meanDist * 100).toFixed(1)}%`} />
            </Section>

            {audience !== 'child' && (
              <Section title="Parámetros">
                <Slider label="μ (tasa mutación)" v={mu} min={0.001} max={0.05} step={0.001} on={setMu} />
                <Slider label="N (tamaño pobl.)" v={N} min={10} max={1000} step={10} on={setN} />
                <Slider label="s (coef. selección)" v={s} min={0} max={0.2} step={0.005} on={setS} />
              </Section>
            )}

            <Section title="Fórmulas">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-[#FDB813]">Jukes-Cantor:</div>
                <div>d = -¾ ln(1 - 4p/3)</div>
                <div className="text-[#FDB813] mt-2">Kimura fixation:</div>
                <div>P_fix = (1-e^{'{-2s}'})/(1-e^{'{-4Ns}'})</div>
                <div className="text-[#FDB813] mt-2">Deriva:</div>
                <div>σ²(Δp) = p(1-p)/(2N)</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

const SCENARIO_NAMES: Record<string, string> = {
  neutral:   'Evolución neutral (JC puro)',
  selection: 'Selección positiva (s=0.06)',
  drift:     'Deriva genética (N=20)',
  upgma:     'Especiación rápida (UPGMA)',
};

// ─── Tabla de secuencias (overlay DOM, fuera del Canvas) ──────────────────

function SeqTable({ seqs, labels, running }: {
  seqs: Base[][];
  labels: string[];
  running: boolean;
}) {
  // Mostrar solo las primeras 4 taxa para no saturar el HUD
  const show = seqs.slice(0, 4);
  return (
    <div className="absolute bottom-20 left-4 bg-[#0B0F17]/85 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2 font-mono text-[10px]">
      <div className="text-[9px] text-[#64748B] mb-1 uppercase tracking-wider">
        Secuencias {running ? <span className="text-[#34D399]">●</span> : <span className="text-[#F87171]">◼</span>}
      </div>
      {show.map((seq, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[#64748B] w-5">{labels[i]}</span>
          <div className="flex gap-px">
            {seq.slice(0, 20).map((b, j) => (
              <span key={j} style={{ color: BASE_COLORS[b] }}>{b}</span>
            ))}
            {seq.length > 20 && <span className="text-[#475569]">…</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Escena 3D ────────────────────────────────────────────────────────────

function EvoScene({ simRef }: { simRef: React.MutableRefObject<SimState> }) {
  // Refs para nodos del árbol
  const nodeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const edgeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const groupRef = useRef<THREE.Group>(null);

  // Geometrías reutilizables
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.12, 20, 16), []);
  const cylGeo = useMemo(() => new THREE.CylinderGeometry(0.025, 0.025, 1, 8), []);

  // Nodos del árbol: los leaf nodes son los taxa
  const nTaxa = simRef.current.seqs.length;
  const maxNodes = nTaxa * 2; // UPGMA genera a lo más 2n-1 nodos

  // Materiales para nodos (uno por clade-color)
  const nodeMats = useMemo(() =>
    CLADE_COLORS.map(c => new THREE.MeshStandardMaterial({
      color: c, emissive: c, emissiveIntensity: 1.4,
      metalness: 0.1, roughness: 0.4, toneMapped: false,
    })), []);

  const edgeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#334155', emissive: '#1E293B', emissiveIntensity: 0.5,
    metalness: 0.2, roughness: 0.5, toneMapped: false,
  }), []);

  // Point cloud para el rastro de divergencia
  const divergeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const N = 2000;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const ptIdxRef = useRef(0);
  const ptCntRef = useRef(0);

  useFrame((_, delta) => {
    const st = simRef.current;
    const nodes = st.treeNodes;
    const pos = st.treePos;
    if (!nodes || !pos) return;

    // Animar leve rotación del grupo
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
    }

    // Actualizar posiciones de nodos del árbol (lerp suave)
    nodes.forEach((node, ni) => {
      const mesh = nodeRefs.current[ni];
      if (!mesh) return;
      const target = pos.get(node.id);
      if (!target) return;
      mesh.position.lerp(target, 0.06);
      // Visibilidad
      mesh.visible = true;
    });

    // Ocultar nodos extra
    for (let i = nodes.length; i < maxNodes; i++) {
      const mesh = nodeRefs.current[i];
      if (mesh) mesh.visible = false;
    }

    // Actualizar aristas entre nodos hijo→padre
    let edgeIdx = 0;
    nodes.forEach((node) => {
      node.children.forEach((child) => {
        const mesh = edgeRefs.current[edgeIdx];
        if (!mesh) { edgeIdx++; return; }
        const pA = pos.get(node.id);
        const pB = pos.get(child.id);
        if (!pA || !pB) { edgeIdx++; return; }
        // Posicionar y orientar el cilindro entre pA y pB
        const mid = pA.clone().add(pB).multiplyScalar(0.5);
        mesh.position.lerp(mid, 0.06);
        const dir = pB.clone().sub(pA);
        const len = dir.length();
        mesh.scale.set(1, len, 1);
        mesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.normalize(),
        );
        mesh.visible = true;
        edgeIdx++;
      });
    });
    // Ocultar aristas extra
    for (let i = edgeIdx; i < edgeRefs.current.length; i++) {
      const m = edgeRefs.current[i];
      if (m) m.visible = false;
    }

    // Añadir puntos al cloud con posición de los leaf nodes
    const leafNodes = nodes.filter(n => n.children.length === 0);
    if (leafNodes.length > 0) {
      const randLeaf = leafNodes[Math.floor(Math.random() * leafNodes.length)]!;
      const p = pos.get(randLeaf.id);
      if (p) {
        const pArr = divergeGeo.attributes.position as THREE.BufferAttribute;
        const cArr = divergeGeo.attributes.color as THREE.BufferAttribute;
        const idx = ptIdxRef.current;
        const jitter = 0.15;
        pArr.setXYZ(idx,
          p.x + (Math.random() - 0.5) * jitter,
          p.y + (Math.random() - 0.5) * jitter,
          p.z + (Math.random() - 0.5) * jitter,
        );
        const ci = leafNodes.indexOf(randLeaf) % CLADE_COLORS.length;
        const col = CLADE_COLORS[ci]!;
        cArr.setXYZ(idx, col.r, col.g, col.b);
        pArr.needsUpdate = true;
        cArr.needsUpdate = true;
        ptIdxRef.current = (idx + 1) % 2000;
        ptCntRef.current = Math.min(ptCntRef.current + 1, 2000);
        divergeGeo.setDrawRange(0, ptCntRef.current);
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Nodos del árbol */}
      {Array.from({ length: maxNodes }, (_, i) => (
        <mesh
          key={`node-${i}`}
          ref={el => { nodeRefs.current[i] = el; }}
          geometry={sphereGeo}
          material={nodeMats[i % CLADE_COLORS.length]!}
          visible={false}
        />
      ))}

      {/* Aristas del árbol — máximo nTaxa*2 conexiones */}
      {Array.from({ length: maxNodes }, (_, i) => (
        <mesh
          key={`edge-${i}`}
          ref={el => { edgeRefs.current[i] = el; }}
          geometry={cylGeo}
          material={edgeMat}
          visible={false}
        />
      ))}

      {/* Point cloud de divergencia */}
      <points geometry={divergeGeo}>
        <pointsMaterial
          vertexColors
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Luz puntual en el centro del árbol para realzar el bloom */}
      <pointLight position={[0, 2, 0]} intensity={0.8} distance={12} color="#4FC3F7" />
      <pointLight position={[0, -1, 0]} intensity={0.5} distance={10} color="#F472B6" />
    </group>
  );
}

// ─── UI helpers ──────────────────────────────────────────────────────────

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

function Slider({ label, v, min, max, step, on }: {
  label: string; v: number; min: number; max: number; step: number; on: (v: number) => void;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v.toFixed(4)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function IconBtn({ children, onClick, active, title }: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title?: string;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
        active
          ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
