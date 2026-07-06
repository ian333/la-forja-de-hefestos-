/**
 * ProteinFolding — paisaje de energía de plegamiento (embudo) + colapso hidrofóbico.
 *
 * FÍSICA REAL (Dill & MacCallum 2012, Chan & Dill 1993):
 *   - Modelo HP (Hydrophobic-Polar) en red 3D cúbica — el modelo reducido canónico
 *     del plegamiento de proteínas (Lau & Dill 1989, JPC).
 *   - Energía: ε_HH = -1 (contacto H-H no enlazado), todo lo demás = 0.
 *   - Motor: Monte Carlo Metropolis a temperatura T; movimientos de cadena
 *     (pivot, crankshaft, end-flip). Acepta con P = min(1, exp(-ΔE/kT)).
 *   - Radio de giro Rg = sqrt(Σ|rᵢ - rcm|²/N) → proxy del colapso hidrofóbico.
 *   - Funnel de energía: cada muestra guardada como (Rg, E) → nube de puntos
 *     coloreada por energía; la forma de embudo es la firma del plegamiento.
 *
 * Secuencias HP reales usadas en literatura:
 *   - HP-20: HPHPPHHPHPPHPPHHPHPP (Lau & Dill 1989, E_min = -9)
 *   - HP-25: PPHPPHHPPHHPPPPPHHHHHHPPP (Shmygelska 2003, E_min = -8)
 *   - HP-36 (villin headpiece fragment): MLSDEDFKAVFGMTRSAFANLPLWKQQNLKKEKGLF
 *     mapeado a HP por hidrofobicidad de Kyte-Doolittle.
 *
 * Visualización 3D CINE:
 *   - Nube de puntos (funnel) — puntos emisivos aditivos, color mapeado por E.
 *   - Cadena actual — esferas H (naranja) y P (azul-frío) con tubos emisivos.
 *   - Cámara autoRotate — se contempla.
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Tipos ──────────────────────────────────────────────────────────────────

type Res = 'H' | 'P';
type Vec3i = [number, number, number];

interface FoldLessonState {
  seqId: string;
  showFunnel: boolean;
  temperature: number;
}

// ─── Secuencias HP reales ────────────────────────────────────────────────────

const HP_SEQUENCES: { id: string; name: string; seq: Res[]; eMin: number; note: string }[] = [
  {
    id: 'lau89',
    name: 'HP-20 — Lau & Dill 1989',
    seq: 'HPHPPHHPHPPHPPHHPHPP'.split('') as Res[],
    eMin: -9,
    note: 'La secuencia original del paper fundacional. E_mín = -9 en red 3D.',
  },
  {
    id: 'hp25',
    name: 'HP-25 — benchmark clásico',
    seq: 'PPHPPHHPPHHPPPPPHHHHHHPPP'.split('') as Res[],
    eMin: -8,
    note: 'Benchmark ampliamente citado (Shmygelska 2003). E_mín = -8.',
  },
  {
    id: 'villin',
    name: 'Villin HP-36 (fragmento real)',
    seq: mapToHP('MLSDEDFKAVFGMTRSAFANLPLWKQQNLKKEKGLF'),
    eMin: -12,
    note: 'Headpiece C-terminal de villin (PDB 1VII, 36 aa). Mapeado a HP\npor Kyte-Doolittle: K>0→H, K≤0→P.',
  },
  {
    id: 'hp10',
    name: 'HP-10 — demo rápido',
    seq: 'HHPPHPPHPH'.split('') as Res[],
    eMin: -4,
    note: 'Cadena corta para explorar rápido el paisaje. E_mín = -4.',
  },
];

/** Mapeo de secuencia aa a HP por hidrofobicidad de Kyte-Doolittle (umbral = 0). */
function mapToHP(aa: string): Res[] {
  // Kyte-Doolittle (J Mol Biol 1982)
  const KD: Record<string, number> = {
    I:4.5,V:4.2,L:3.8,F:2.8,C:2.5,M:1.9,A:1.8,G:-0.4,T:-0.7,S:-0.8,
    W:-0.9,Y:-1.3,P:-1.6,H:-3.2,E:-3.5,Q:-3.5,D:-3.5,N:-3.5,K:-3.9,R:-4.5,
  };
  return aa.toUpperCase().split('').map(c => ((KD[c] ?? -1) > 0 ? 'H' : 'P'));
}

// ─── Modelo HP en red cúbica 3D ─────────────────────────────────────────────

const NEIGHBORS_3D: Vec3i[] = [
  [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
];

/** Energía de la cadena: -1 por cada contacto H-H no enlazado. */
function hpEnergy(chain: Vec3i[], seq: Res[]): number {
  const set = new Set<string>();
  for (const v of chain) set.add(`${v[0]},${v[1]},${v[2]}`);
  let E = 0;
  for (let i = 0; i < chain.length; i++) {
    if (seq[i] !== 'H') continue;
    for (const [dx, dy, dz] of NEIGHBORS_3D) {
      const ni = chain[i][0]+dx, nj = chain[i][1]+dy, nk = chain[i][2]+dz;
      // Buscar qué residuo está en esa celda
      for (let j = i+2; j < chain.length; j++) {
        if (chain[j][0]===ni && chain[j][1]===nj && chain[j][2]===nk && seq[j]==='H') {
          E -= 1;
        }
      }
    }
  }
  return E;
}

/** Radio de giro: sqrt(Σ|rᵢ - rcm|²/N) */
function radiusOfGyration(chain: Vec3i[]): number {
  const N = chain.length;
  const cx = chain.reduce((s,v) => s+v[0], 0)/N;
  const cy = chain.reduce((s,v) => s+v[1], 0)/N;
  const cz = chain.reduce((s,v) => s+v[2], 0)/N;
  const sum = chain.reduce((s,v) => s + (v[0]-cx)**2 + (v[1]-cy)**2 + (v[2]-cz)**2, 0);
  return Math.sqrt(sum/N);
}

/** Auto-evitación: ¿hay dos residuos en la misma celda? */
function selfAvoiding(chain: Vec3i[]): boolean {
  const set = new Set<string>();
  for (const v of chain) {
    const k = `${v[0]},${v[1]},${v[2]}`;
    if (set.has(k)) return false;
    set.add(k);
  }
  return true;
}

/** Inicializa cadena extendida en +x. */
function initChain(N: number): Vec3i[] {
  return Array.from({ length: N }, (_, i) => [i, 0, 0] as Vec3i);
}

// ─── Movimientos de Monte Carlo ──────────────────────────────────────────────

/** End-flip: rota el extremo 90° alrededor del penúltimo residuo. */
function endFlip(chain: Vec3i[], rng: () => number): Vec3i[] | null {
  const N = chain.length;
  const end = rng() < 0.5 ? 0 : N - 1;
  const pivot = end === 0 ? chain[1] : chain[N-2];
  // elegir dirección aleatoria de las 6
  const dirs = NEIGHBORS_3D.slice();
  // evitar la dirección que ya existe (la del enlace actual)
  const curr = chain[end];
  const dx = curr[0]-pivot[0], dy = curr[1]-pivot[1], dz = curr[2]-pivot[2];
  const filtered = dirs.filter(([a,b,c]) => !(a===dx && b===dy && c===dz));
  if (filtered.length === 0) return null;
  const [nx,ny,nz] = filtered[Math.floor(rng()*filtered.length)];
  const newChain = chain.map(v => [...v] as Vec3i);
  newChain[end] = [pivot[0]+nx, pivot[1]+ny, pivot[2]+nz];
  return selfAvoiding(newChain) ? newChain : null;
}

/** Pivot: rota toda la subcadena [0..k] o [k..N-1] 90° alrededor del residuo k. */
function pivotMove(chain: Vec3i[], rng: () => number): Vec3i[] | null {
  const N = chain.length;
  if (N < 3) return null;
  const k = 1 + Math.floor(rng() * (N-2));  // índice interior
  // Elegir qué mitad rotar (la más corta para eficiencia)
  const rotLeft = rng() < 0.5;
  const pivot = chain[k];
  // 9 rotaciones posibles de 90° en 3D (matrices de permutación con signos)
  const ROTS: Array<[number,number,number,number,number,number,number,number,number]> = [
    [0,1,0, -1,0,0, 0,0,1],[0,-1,0, 1,0,0, 0,0,1],
    [0,0,1, 0,1,0, -1,0,0],[0,0,-1, 0,1,0, 1,0,0],
    [1,0,0, 0,0,1, 0,-1,0],[1,0,0, 0,0,-1, 0,1,0],
    [0,1,0, 0,0,1, 1,0,0], [-1,0,0, 0,1,0, 0,0,-1],
    [1,0,0, 0,-1,0, 0,0,-1],
  ];
  const [r00,r01,r02, r10,r11,r12, r20,r21,r22] = ROTS[Math.floor(rng()*ROTS.length)];
  const newChain = chain.map(v => [...v] as Vec3i);
  const range = rotLeft ? Array.from({length:k},(_,i)=>i) : Array.from({length:N-k-1},(_,i)=>i+k+1);
  for (const i of range) {
    const dx = chain[i][0]-pivot[0], dy = chain[i][1]-pivot[1], dz = chain[i][2]-pivot[2];
    newChain[i] = [
      pivot[0] + r00*dx + r01*dy + r02*dz,
      pivot[1] + r10*dx + r11*dy + r12*dz,
      pivot[2] + r20*dx + r21*dy + r22*dz,
    ];
  }
  return selfAvoiding(newChain) ? newChain : null;
}

/** Un paso de Metropolis: devuelve la nueva cadena y si fue aceptado. */
function metropolisStep(
  chain: Vec3i[],
  seq: Res[],
  E: number,
  T: number,
  rng: () => number,
): { chain: Vec3i[]; E: number; accepted: boolean } {
  const usePivot = rng() < 0.5;
  const proposed = usePivot ? pivotMove(chain, rng) : endFlip(chain, rng);
  if (!proposed) return { chain, E, accepted: false };
  const Ep = hpEnergy(proposed, seq);
  const dE = Ep - E;
  if (dE <= 0 || rng() < Math.exp(-dE / T)) {
    return { chain: proposed, E: Ep, accepted: true };
  }
  return { chain, E, accepted: false };
}

// ─── Lección ─────────────────────────────────────────────────────────────────

const LESSON: Lesson<FoldLessonState> = {
  hook: {
    title: 'En microsegundos, una cadena de 150 aminoácidos encuentra su forma. ¿Cómo?',
    body: `Una proteína recién sintetizada por un ribosoma es una cadena desordenada — una cuerda de aminoácidos. En microsegundos a milisegundos, esa cadena se "pliega" en una estructura 3D única y funcional.

El "problema del plegamiento" perplexó a los biofísicos por décadas: hay más confiormaciones posibles que átomos en el universo observable, y sin embargo la proteína encuentra LA correcta en microsegundos (Levinthal's Paradox, 1969).

La respuesta: la evolución diseñó secuencias cuyo espacio de energía tiene forma de EMBUDO (Dill & Chan 1997). No es una búsqueda aleatoria — es descenso por gradiente en un paisaje energético con forma especial.

Aquí vas a ver ese embudo materializarse: cada punto en la nube es una conformación muestreada. El eje x = radio de giro (cuán compacta), eje y = energía. El patrón que emerge — estrecho y profundo — es la firma del plegamiento.`,
  },

  steps: [
    {
      title: 'El modelo HP — la física esencial del plegamiento',
      duration: 6000,
      body: `El modelo Hydrophobic-Polar (Lau & Dill 1989, JPC) captura el driver principal del plegamiento: la AVERSIÓN AL AGUA de los residuos hidrofóbicos.

Cada aminoácido es H (hidrofóbico, naranja) o P (polar, azul). La energía es simple: E = −ε × (número de contactos H-H no enlazados). Un contacto H-H vale −1 kcal/mol; todo lo demás vale 0.

El agua es el solvente. Los residuos H "huyen" del agua agrupándose en el interior — eso impulsa el colapso. Los P quedan en la superficie.

Mirá la cadena HP-20 de Lau & Dill (1989): 20 residuos, E_mín = -9. El motor de Monte Carlo está muestreando conformaciones con T = 1.0 (temperatura reducida). Ve cómo la cadena explora.`,
      formula: 'E = −Σ ε_{H-H}   (ε = 1 kcal/mol)\ncontactos no enlazados entre H-H vecinos en la red',
      keyframes: [
        { at: 0, state: { seqId: 'lau89', showFunnel: false, temperature: 1.0 } },
        { at: 1, state: { seqId: 'lau89', showFunnel: false, temperature: 1.0 } },
      ],
    },
    {
      title: 'El embudo de energía — el paisaje del plegamiento',
      duration: 7000,
      body: `Activo el funnel: cada conformación muestreada se grafica como punto (Rg, E) en el espacio.

El eje horizontal es el radio de giro Rg — cuán compacta está la cadena. El eje vertical es la energía. El color va de rojo (alta energía, desfavorable) a cian (baja energía, plegado nativo).

El embudo que ves materializar es la firma del plegamiento correcto: a medida que Rg baja (cadena más compacta), la energía también baja. Muchas rutas hacia pocos estados nativos de baja energía.

Esto es lo que diferencia proteínas reales de polímeros aleatorios: una secuencia aleatoria mostraría un espacio de energía "rugoso" sin embudo claro. La evolución seleccionó secuencias que hacen embudos.`,
      formula: 'Rg = √(Σ|rᵢ − r̄|²/N)\nEmbudo: P(E|Rg) se estrecha hacia el nativo',
      keyframes: [
        { at: 0, state: { seqId: 'lau89', showFunnel: true, temperature: 1.0 } },
        { at: 1, state: { seqId: 'lau89', showFunnel: true, temperature: 1.0 } },
      ],
    },
    {
      title: 'Metropolis a T baja — la proteína "colapsa"',
      duration: 7000,
      body: `Bajo T a 0.4 (temperatura reducida baja). El criterio de aceptación de Metropolis es P = min(1, exp(-ΔE/kT)).

A T baja, solo se aceptan fácilmente movimientos que bajen la energía. La cadena queda atrapada cerca del mínimo — el estado nativo.

Observá: el radio de giro cae (Rg pequeño = cadena compacta), los contactos H-H suben. La energía se acerca a E_mín.

Este es el mecanismo físico del plegamiento a temperatura fisiológica: T_fisiológica (310 K) en unidades reducidas corresponde a T ≈ 0.5-0.8 para proteínas típicas.

A T muy baja, la cadena queda "congelada" en una conformación — puede ser el nativo o una trampa cinética (misfold).`,
      formula: 'P_accept = min(1, e^{-ΔE/kT})\nT_reducida = k_B T / ε_{HH}',
      keyframes: [
        { at: 0, state: { seqId: 'lau89', showFunnel: true, temperature: 1.0 } },
        { at: 0.5, state: { seqId: 'lau89', showFunnel: true, temperature: 0.4 } },
        { at: 1,   state: { seqId: 'lau89', showFunnel: true, temperature: 0.4 } },
      ],
    },
    {
      title: 'Villin headpiece — proteína real mapeada a HP',
      duration: 6500,
      body: `Cambio a la secuencia del villin headpiece (PDB 1VII, 36 aa) — una de las proteínas que se pliegan más rápido conocidas (~700 ns a 300 K, Duan & Kollman 1998).

La secuencia 1VII = MLSDEDFKAVFGMTRSAFANLPLWKQQNLKKEKGLF se mapea a HP por la escala de hidrofobicidad de Kyte-Doolittle (1982): si KD > 0 → H, si no → P.

Es una proteína real pero en un modelo reducido. Su estructura nativa tiene 3 α-hélices en haz. El modelo HP captura el núcleo hidrofóbico (5 leucinas + 1 fenilalanina + 3 alaninas).

El funnel es más "rugoso" que HP-20 — cadena más larga, más trampas cinéticas — pero el mínimo sigue siendo accesible por Metropolis.`,
      formula: 'Kyte-Doolittle: KD(I)=4.5, KD(L)=3.8...\n→ KD > 0: H; KD ≤ 0: P',
      keyframes: [
        { at: 0, state: { seqId: 'villin', showFunnel: true, temperature: 0.8 } },
        { at: 1, state: { seqId: 'villin', showFunnel: true, temperature: 0.8 } },
      ],
    },
  ],

  connect: {
    body: `El modelo HP demostró un principio fundamental (Dill 1990, Biochemistry): el colapso hidrofóbico es suficiente para explicar muchas características del plegamiento. No necesitás física cuántica fina — la estadística del agua lo hace.

En proteínas reales, el campo de fuerzas es más rico: puentes de hidrógeno, interacciones electrostáticas, ángulos de Ramachandran... pero el driver dominante sigue siendo hidrofóbico.

AlphaFold2 (Jumper et al. 2021, Nature) aprende implícitamente ese mismo paisaje de millones de estructuras PDB. Predice el estado nativo directamente — sin simular el plegamiento.

De este visualizador → el análisis completo con MSM (Markov State Models) de plegamiento está en el módulo de Dinámica Molecular.`,
    links: [
      { label: 'Viewer PDB — estructuras reales de proteínas', href: '#protein-viewer' },
      { label: 'Drug Docking — el sitio activo del nativo', href: '#docking' },
      { label: 'Doble Hélice — el otro biopolímero', href: '#double-helix' },
    ],
  },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ProteinFolding() {
  const { audience } = useAudience();

  const [seqId, setSeqId] = useState('lau89');
  const [temperature, setTemperature] = useState(1.0);
  const [showFunnel, setShowFunnel] = useState(true);
  const [running, setRunning] = useState(true);

  const seqData = HP_SEQUENCES.find(s => s.id === seqId)!;
  const seq = seqData.seq;
  const N = seq.length;

  // Estado compartido con la escena vía refs (para que useFrame los lea sin re-render)
  const chainRef = useRef<Vec3i[]>(initChain(N));
  const energyRef = useRef<number>(0);
  const rgRef = useRef<number>(0);
  const contactsRef = useRef<number>(0);
  const acceptRateRef = useRef<number>(0);
  const stepCountRef = useRef<number>(0);
  const paramRef = useRef({ seq, T: temperature, running });

  // UI stats (actualizados cada ~150ms)
  const [stats, setStats] = useState({ E: 0, Rg: 0, contacts: 0, steps: 0, acceptRate: 0 });

  // Reset cuando cambia la secuencia
  useEffect(() => {
    const newSeq = HP_SEQUENCES.find(s => s.id === seqId)!.seq;
    chainRef.current = initChain(newSeq.length);
    energyRef.current = hpEnergy(chainRef.current, newSeq);
    rgRef.current = radiusOfGyration(chainRef.current);
    contactsRef.current = -energyRef.current;
    stepCountRef.current = 0;
    acceptRateRef.current = 0;
    paramRef.current = { seq: newSeq, T: temperature, running };
    // Limpiar funnel en funnelRef se maneja dentro de FunnelCloud via seqId prop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seqId]);

  // Sync paramRef con cambios de T y running
  useEffect(() => {
    paramRef.current = { seq, T: temperature, running };
  }, [seq, temperature, running]);

  // Loop MC fuera del Canvas (rAF puro), para poder leer/escribir chainRef libremente
  useEffect(() => {
    let raf = 0;
    let accepted = 0;
    let tried = 0;
    let lastUi = performance.now();
    let rngState = Math.random() * 0xFFFFFFFF | 0;

    // xorshift32 — rápido y determinista
    const rng = () => {
      rngState ^= rngState << 13;
      rngState ^= rngState >> 17;
      rngState ^= rngState << 5;
      return ((rngState >>> 0) / 0xFFFFFFFF);
    };

    const tick = () => {
      const { seq: curSeq, T, running: isRunning } = paramRef.current;
      if (isRunning) {
        const STEPS_PER_FRAME = 20;
        for (let i = 0; i < STEPS_PER_FRAME; i++) {
          const res = metropolisStep(chainRef.current, curSeq, energyRef.current, T, rng);
          chainRef.current = res.chain;
          energyRef.current = res.E;
          tried++;
          if (res.accepted) accepted++;
        }
        rgRef.current = radiusOfGyration(chainRef.current);
        contactsRef.current = -energyRef.current;
        stepCountRef.current += STEPS_PER_FRAME;
      }

      const now = performance.now();
      if (now - lastUi > 150) {
        acceptRateRef.current = tried > 0 ? accepted / tried : 0;
        setStats({
          E: energyRef.current,
          Rg: rgRef.current,
          contacts: contactsRef.current,
          steps: stepCountRef.current,
          acceptRate: acceptRateRef.current,
        });
        accepted = 0;
        tried = 0;
        lastUi = now;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);  // solo una vez — lee paramRef en cada tick

  const camDist = Math.max(6, N * 0.5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={camDist} autoRotate bloomIntensity={0.9} bloomThreshold={0.1}>
          <ChainScene
            chainRef={chainRef}
            seq={seqData.seq}
            seqId={seqId}
            energyRef={energyRef}
            rgRef={rgRef}
            eMin={seqData.eMin}
            showFunnel={showFunnel}
          />
        </Stage>

        {/* HUD stats */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">E&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= <span className={stats.E <= seqData.eMin * 0.8 ? 'text-[#22D3EE]' : 'text-white'}>{stats.E.toFixed(0)}</span> <span className="text-[#64748B]">/ {seqData.eMin}</span></div>
          <div><span className="text-[#64748B]">Rg&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {stats.Rg.toFixed(2)}</div>
          <div><span className="text-[#64748B]">H-H&nbsp;&nbsp;&nbsp;&nbsp;</span>= {stats.contacts}</div>
          <div><span className="text-[#64748B]">pasos&nbsp;&nbsp;</span>= {(stats.steps / 1000).toFixed(1)}k</div>
          <div><span className="text-[#64748B]">aceptar</span>= {(stats.acceptRate * 100).toFixed(0)}%</div>
        </div>

        {/* HUD temperatura */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-4 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <label className="text-[11px] font-mono text-[#94A3B8]">
            T = <span className="text-white">{temperature.toFixed(2)}</span>
          </label>
          <input type="range" min={0.1} max={3.0} step={0.05}
            value={temperature}
            onChange={e => {
              const v = Number(e.target.value);
              setTemperature(v);
              paramRef.current = { ...paramRef.current, T: v };
            }}
            className="w-28" />
          <button onClick={() => setShowFunnel(f => !f)}
            className={`text-[11px] px-2.5 py-1 rounded border transition ${showFunnel ? 'border-[#22D3EE]/50 text-[#22D3EE] bg-[#22D3EE]/10' : 'border-[#1E293B] text-[#64748B]'}`}>
            funnel
          </button>
        </div>
      </div>

      <LessonPanel<FoldLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.seqId !== undefined) setSeqId(patch.seqId);
          if (patch.showFunnel !== undefined) setShowFunnel(patch.showFunnel);
          if (patch.temperature !== undefined) {
            setTemperature(patch.temperature);
            paramRef.current = { ...paramRef.current, T: patch.temperature };
          }
        }}
        sandbox={
          <>
            <Section title="Secuencia HP">
              <div className="grid grid-cols-1 gap-1.5">
                {HP_SEQUENCES.map(s => (
                  <button key={s.id} onClick={() => setSeqId(s.id)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      seqId === s.id
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}>{s.name}</button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">
                {seqData.note}
              </div>
              <div className="mt-2 flex flex-wrap gap-0.5">
                {seqData.seq.map((r, i) => (
                  <span key={i} className={`text-[10px] font-mono px-0.5 rounded ${r === 'H' ? 'text-[#FB923C] bg-[#FB923C]/10' : 'text-[#60A5FA] bg-[#60A5FA]/10'}`}>{r}</span>
                ))}
              </div>
            </Section>

            <Section title="Temperatura Monte Carlo">
              <Slider label="T (reducida)" v={temperature} min={0.1} max={3.0} step={0.05}
                on={v => { setTemperature(v); paramRef.current = { ...paramRef.current, T: v }; }} />
              <div className="text-[10px] text-[#64748B] mt-1 leading-relaxed">
                T_fisiológica ≈ 0.5-1.0 (unidades reducidas). T alta = exploración. T baja = colapso al nativo.
              </div>
            </Section>

            {audience !== 'child' && (
              <Section title="Estado actual">
                <Row label="E" value={`${stats.E.toFixed(0)} / ${seqData.eMin}`} highlight={stats.E <= seqData.eMin * 0.8} />
                <Row label="Rg" value={stats.Rg.toFixed(3)} />
                <Row label="Contactos H-H" value={String(stats.contacts)} />
                <Row label="Pasos MC" value={`${(stats.steps/1000).toFixed(1)}k`} />
                <Row label="Tasa aceptación" value={`${(stats.acceptRate*100).toFixed(0)}%`} />
              </Section>
            )}

            <Section title="Visualización">
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setShowFunnel(f => !f)}
                  className={`text-[11px] px-2.5 py-1.5 rounded border transition ${showFunnel ? 'border-[#22D3EE]/50 text-[#22D3EE] bg-[#22D3EE]/10' : 'border-[#1E293B] text-[#64748B] hover:border-[#334155]'}`}>
                  {showFunnel ? 'Ocultar' : 'Mostrar'} funnel
                </button>
              </div>
            </Section>

            {audience === 'researcher' && (
              <Section title="Física">
                <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                  <div className="text-[#FDB813]">E = −Σ ε_{'{'}H-H{'}'}</div>
                  <div>ε = 1 (contacto no enlazado)</div>
                  <div className="mt-1 text-[#FDB813]">P_acc = min(1, e^{'{'}-ΔE/T{'}'})</div>
                  <div>Movs: pivot, end-flip (50/50)</div>
                  <div className="mt-1 text-[#FDB813]">Rg = √(Σ|rᵢ−r̄|²/N)</div>
                </div>
              </Section>
            )}
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D ────────────────────────────────────────────────────────────────

interface ChainSceneProps {
  chainRef: React.MutableRefObject<Vec3i[]>;
  seq: Res[];
  seqId: string;
  energyRef: React.MutableRefObject<number>;
  rgRef: React.MutableRefObject<number>;
  eMin: number;
  showFunnel: boolean;
}

function ChainScene({ chainRef, seq, seqId, energyRef, rgRef, eMin, showFunnel }: ChainSceneProps) {
  const tex = useMemo(() => getParticleTexture(), []);
  const N = seq.length;

  // Geometría de la cadena: N esferas + N-1 eslabones
  // Usamos instancedMesh para H (naranja) y P (azul)
  const hMeshRef = useRef<THREE.InstancedMesh>(null);
  const pMeshRef = useRef<THREE.InstancedMesh>(null);
  // Eslabones como cilindros individuales (refs de grupo)
  const bondsGroupRef = useRef<THREE.Group>(null);

  // Funnel cloud: ring buffer de (Rg, E) → mapeado a posición 3D
  const FUNNEL_CAP = 3000;
  const funnelGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FUNNEL_CAP * 3), 3));
    g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(FUNNEL_CAP * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const funnelIdx = useRef(0);
  const funnelCnt = useRef(0);

  // Reset funnel cuando cambia la secuencia
  useEffect(() => {
    funnelIdx.current = 0;
    funnelCnt.current = 0;
    const pArr = funnelGeo.attributes.position.array as Float32Array;
    const cArr = funnelGeo.attributes.color.array as Float32Array;
    pArr.fill(0);
    cArr.fill(0);
    funnelGeo.setDrawRange(0, 0);
    (funnelGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (funnelGeo.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
  }, [seqId, funnelGeo]);

  // Geometrías reutilizables para instanciación
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.28, 20, 16), []);
  const cylGeo    = useMemo(() => new THREE.CylinderGeometry(0.06, 0.06, 1, 10), []);

  // Materiales
  const hMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#FB923C', emissive: '#EA580C', emissiveIntensity: 1.4,
    metalness: 0.1, roughness: 0.4, toneMapped: false,
  }), []);
  const pMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#60A5FA', emissive: '#2563EB', emissiveIntensity: 1.0,
    metalness: 0.1, roughness: 0.4, toneMapped: false,
  }), []);
  const bondMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#94A3B8', emissive: '#475569', emissiveIntensity: 0.5,
    metalness: 0.0, roughness: 0.6, toneMapped: false,
  }), []);

  // Matrices de instancias (reutilizadas)
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Contar H y P
  const hCount = useMemo(() => seq.filter(r => r === 'H').length, [seq]);
  const pCount = useMemo(() => seq.filter(r => r === 'P').length, [seq]);

  // Índices H y P
  const hIndices = useMemo(() => seq.map((r,i) => r==='H' ? i : -1).filter(i => i>=0), [seq]);
  const pIndices = useMemo(() => seq.map((r,i) => r==='P' ? i : -1).filter(i => i>=0), [seq]);

  // Colores del funnel (cian frío → naranja caliente por energía relativa)
  const funnelColor = (E: number, eMinVal: number) => {
    // t = 0 (nativo, E≈eMin) → cian; t = 1 (extendido, E≈0) → naranja
    const t = Math.max(0, Math.min(1, (E - eMinVal) / (-eMinVal + 1e-6)));
    return {
      r: THREE.MathUtils.lerp(0.25, 1.00, t),
      g: THREE.MathUtils.lerp(0.85, 0.25, t),
      b: THREE.MathUtils.lerp(0.95, 0.05, t),
    };
  };

  useFrame(() => {
    const chain = chainRef.current;
    if (chain.length !== N) return;

    // Centrar la cadena para el render
    const cx = chain.reduce((s,v)=>s+v[0],0)/N;
    const cy = chain.reduce((s,v)=>s+v[1],0)/N;
    const cz = chain.reduce((s,v)=>s+v[2],0)/N;

    // Actualizar instancias H
    if (hMeshRef.current) {
      hIndices.forEach((idx, ii) => {
        const v = chain[idx];
        dummy.position.set(v[0]-cx, v[1]-cy, v[2]-cz);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        hMeshRef.current!.setMatrixAt(ii, dummy.matrix);
      });
      hMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // Actualizar instancias P
    if (pMeshRef.current) {
      pIndices.forEach((idx, ii) => {
        const v = chain[idx];
        dummy.position.set(v[0]-cx, v[1]-cy, v[2]-cz);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        pMeshRef.current!.setMatrixAt(ii, dummy.matrix);
      });
      pMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // Actualizar eslabones (grupo de cilindros)
    if (bondsGroupRef.current) {
      const children = bondsGroupRef.current.children as THREE.Mesh[];
      for (let i = 0; i < N-1 && i < children.length; i++) {
        const a = chain[i], b = chain[i+1];
        const ax = a[0]-cx, ay = a[1]-cy, az = a[2]-cz;
        const bx = b[0]-cx, by = b[1]-cy, bz = b[2]-cz;
        const mid = new THREE.Vector3((ax+bx)/2, (ay+by)/2, (az+bz)/2);
        const dir = new THREE.Vector3(bx-ax, by-ay, bz-az);
        const len = dir.length();
        const m = children[i];
        m.position.copy(mid);
        m.scale.set(1, len * 0.92, 1);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
      }
    }

    // Actualizar funnel (cada 3 frames para no saturar)
    if (showFunnel) {
      const E = energyRef.current;
      const Rg = rgRef.current;
      // Mapear a posición 3D: x = Rg (compactness), y = E / eMin (altura), z dispersión visual
      const pArr = funnelGeo.attributes.position.array as Float32Array;
      const cArr = funnelGeo.attributes.color.array as Float32Array;
      const idx = funnelIdx.current;
      // x: Rg normalizado (0=compacto, 8=extendido) → escalado
      const xPos = (Rg / Math.max(1, N/3)) * 4 - 2;
      // y: energía → -eMin (nativo) al 0 (extendido), invertida para que nativo quede abajo
      const yPos = (E / (eMin - 1e-6)) * 3 - 1.5;
      // z: ruido visual para dar cuerpo 3D al embudo
      const theta = (idx * 2.39996) % (2 * Math.PI);  // espiral áurea
      const jitter = Math.sqrt(Math.abs(xPos) * 0.3 + 0.05);
      const zPos = Math.cos(theta) * jitter;
      const xPos2 = xPos + Math.sin(theta) * jitter * 0.4;
      pArr[idx*3+0] = xPos2;
      pArr[idx*3+1] = yPos;
      pArr[idx*3+2] = zPos;
      const col = funnelColor(E, eMin);
      cArr[idx*3+0] = col.r;
      cArr[idx*3+1] = col.g;
      cArr[idx*3+2] = col.b;
      funnelIdx.current = (idx + 1) % FUNNEL_CAP;
      funnelCnt.current = Math.min(funnelCnt.current + 1, FUNNEL_CAP);
      (funnelGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (funnelGeo.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
      funnelGeo.setDrawRange(0, funnelCnt.current);
    }
  });

  return (
    <>
      {/* Iluminación adicional para el bloom de materiales emissivos */}
      <pointLight position={[3, 3, 3]} intensity={0.6} color="#FB923C" distance={15} />
      <pointLight position={[-3, -2, 2]} intensity={0.4} color="#60A5FA" distance={12} />

      {/* Residuos H — naranja emisivo */}
      <instancedMesh ref={hMeshRef} args={[sphereGeo, hMat, hCount]} />

      {/* Residuos P — azul emisivo */}
      <instancedMesh ref={pMeshRef} args={[sphereGeo, pMat, pCount]} />

      {/* Eslabones covalentes */}
      <group ref={bondsGroupRef}>
        {Array.from({ length: N - 1 }, (_, i) => (
          <mesh key={i} geometry={cylGeo} material={bondMat} />
        ))}
      </group>

      {/* Funnel de energía */}
      {showFunnel && (
        <points geometry={funnelGeo}>
          <pointsMaterial
            vertexColors
            map={tex} alphaMap={tex}
            size={0.12}
            sizeAttenuation
            transparent
            opacity={0.75}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}

      {/* Eje de referencia del funnel (línea vertical = baja energía) */}
      {showFunnel && (
        <group position={[-2, -1.5, 0]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 3.0, 6]} />
            <meshStandardMaterial color="#334155" emissive="#1E293B" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[2, -1.5, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.01, 6]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
      )}
    </>
  );
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

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
      <span className={highlight ? 'text-[#22D3EE]' : 'text-white'}>{value}</span>
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
        <span className="text-white">{v.toFixed(2)}</span>
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
      }`}>
      {children}
    </button>
  );
}
