/**
 * Ising2D — Modelo de Ising 2D con Metropolis Monte Carlo REAL.
 *
 * Física implementada:
 *   - Red cuadrada N×N con condiciones periódicas (toroidal).
 *   - Hamiltoniano: H = -J Σ_{<i,j>} s_i s_j  (s = ±1)
 *   - Algoritmo de Metropolis: ΔE = 2J s_i Σ_{nn} s_j
 *     aceptar si ΔE ≤ 0, o con prob exp(-ΔE / k_B T)
 *   - Temperatura crítica exacta 2D: Tc = 2J / (k_B ln(1+√2)) ≈ 2.269 J/k_B
 *   - Magnetización: m = |Σ s_i| / N²
 *   - Energía por espín: e = H / N²
 *
 * Visualización 3D R3F:
 *   - Cada espín = cubo extruido en ±z (flechas volumétricas).
 *   - Espín +1 = cubo alto, color rojo-naranja emisivo.
 *   - Espín -1 = cubo bajo, color azul-cian emisivo.
 *   - InstancedMesh para renderizar N² cubos sin overhead.
 *   - Dominios magnéticos emergen visualmente al cruzar Tc.
 *
 * Referencias:
 *   · L. Onsager, Phys. Rev. 65, 117 (1944) — solución exacta 2D.
 *   · N. Metropolis et al., J. Chem. Phys. 21, 1087 (1953).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ═══════════════════════════════════════════════════════════════
// Constantes del modelo
// ═══════════════════════════════════════════════════════════════

/** Temperatura crítica exacta de Onsager: Tc = 2J / ln(1+√2) ≈ 2.269 J/k_B */
const TC = 2.0 / Math.log(1 + Math.SQRT2); // ≈ 2.2692

/** Tamaño de la red por defecto */
const N_DEFAULT = 32;

/** Pasos Metropolis por frame */
const STEPS_PER_FRAME = 1024;

// ═══════════════════════════════════════════════════════════════
// Lección pedagógica
// ═══════════════════════════════════════════════════════════════

interface IsingState {
  T: number;
  phase: 'ferro' | 'critical' | 'para';
}

const LESSON: Lesson<IsingState> = {
  hook: {
    title: 'Un imán que se derrite. La transición de fase más bella de la física.',
    body: `Imagina una red de 1024 espines — pequeños imanes que solo apuntan arriba (+1) o abajo (−1). Cada uno "habla" con sus 4 vecinos: prefiere alinearse con ellos para minimizar energía.

A temperatura baja, todos los espines se alinean en dominios enormes. El sistema es un FERROMAGNETO — tiene magnetización neta.

Al calentar, la energía térmica compite con el acoplamiento. En un punto exactísimo — la temperatura crítica Tc ≈ 2.269 J/k_B — ocurre algo extraordinario: la magnetización colapsa a cero y aparecen dominios de TODAS las escalas simultáneamente. Es una transición de fase de segundo orden.

Lars Onsager (1944) resolvió este modelo EXACTAMENTE — fue uno de los cálculos más difíciles de la física del siglo XX. Aquí lo estás viendo correr en tiempo real con Metropolis Monte Carlo.`,
  },

  steps: [
    {
      title: 'Fase ferromagnética — T ≪ Tc',
      duration: 6000,
      body: `A T = 0.5 Tc (≈ 1.13), la energía de acoplamiento J domina sobre el ruido térmico k_BT.

Los espines se ordenan en GRANDES dominios monocromáticos. El sistema elige espontáneamente una dirección — magnetización |m| → 1 (rompimiento espontáneo de simetría).

La energía libre tiene DOS mínimos degenerados: todo arriba (+1) o todo abajo (−1). El sistema "cae" en uno de los dos al enfriarse. Es exactamente lo que hace un imán de hierro real.

Metropolis acepta casi solo los flips que BAJAN energía (ΔE < 0). Los que la suben, exp(−ΔE/k_BT) ≈ 0.`,
      formula: 'ΔE = 2J·sᵢ·Σnn sⱼ\nP(aceptar) = min(1, e^{−ΔE/k_BT})\nT = 0.5 Tc ≈ 1.13 J/k_B',
      keyframes: [
        { at: 0, state: { T: 0.5 * TC, phase: 'ferro' } },
        { at: 1, state: { T: 0.5 * TC, phase: 'ferro' } },
      ],
    },
    {
      title: 'Temperatura crítica — Tc de Onsager',
      duration: 7000,
      body: `T = Tc = 2J / ln(1+√2) ≈ 2.269 J/k_B. Este es el punto crítico exacto de Onsager.

Aquí ocurre algo ÚNICO: dominios de TODOS los tamaños coexisten simultáneamente — desde espines individuales hasta clusters del tamaño de la red. La distribución de tamaños sigue una ley de potencia.

La magnetización |m| → 0 con exponente crítico β = 1/8 (exacto): |m| ∝ |T−Tc|^{1/8}.

La longitud de correlación diverge: ξ → ∞. El sistema "se comunica" a distancias arbitrariamente largas. Esto es invariancia de escala — la razón por la que el modelo de Ising es tan importante en física de partículas y cosmología.`,
      formula: 'Tc = 2J / ln(1+√2) ≈ 2.2692 J/k_B\n|m| ∝ |T−Tc|^{β},  β = 1/8\nξ → ∞  (correlación divergente)',
      keyframes: [
        { at: 0, state: { T: TC, phase: 'critical' } },
        { at: 1, state: { T: TC, phase: 'critical' } },
      ],
    },
    {
      title: 'Fase paramagnética — T ≫ Tc',
      duration: 6000,
      body: `A T = 2.5 Tc (≈ 5.7), el ruido térmico destruye cualquier orden.

Los espines flipean aleatoriamente — ya no hay dominios. La magnetización |m| ≈ 0 fluctúa alrededor de cero sin preferencia. El material es PARAMAGNÉTICO: responde a campos externos pero no tiene magnetización espontánea.

Metropolis ahora acepta muchos flips incluso si suben energía: exp(−ΔE/k_BT) es apreciable porque k_BT ≫ J.

Esto es el "mar de ruido" — información térmica destruyendo información cuántica de acoplamiento. A temperaturas altas, todos los materiales magnéticos se vuelven paramagnéticos (temperatura de Curie).`,
      formula: 'χ = ∂m/∂H ∝ 1/T  (ley de Curie)\n⟨sᵢsⱼ⟩ ~ e^{−|i−j|/ξ},  ξ → 0\nT = 2.5 Tc ≈ 5.67 J/k_B',
      keyframes: [
        { at: 0, state: { T: 2.5 * TC, phase: 'para' } },
        { at: 1, state: { T: 2.5 * TC, phase: 'para' } },
      ],
    },
    {
      title: 'Barrido de temperatura — la transición en vivo',
      duration: 8000,
      body: `Observa cómo el sistema evoluciona mientras subimos T de 0 hasta 3·Tc.

A T baja, los dominios son grandes y estables — la magnetización |m| es alta.

Al acercarse a Tc ≈ 2.27, los dominios se fragmentan en una mezcla caótica de todas las escalas. La magnetización COLAPSA.

Por encima de Tc, el ruido térmico toma el control — imagen moteada sin estructura.

Esta es la firma visual de una transición de SEGUNDO ORDEN: no hay calor latente, el cambio es continuo pero la derivada (susceptibilidad χ = ∂²F/∂T²) diverge en Tc.`,
      formula: 'F = U − TS\nC_v ∝ −ln|T−Tc|  (log-divergencia)\nα = 0  (exponente Ising 2D)',
      keyframes: [
        { at: 0,   state: { T: 0.8,           phase: 'ferro'    } },
        { at: 0.4, state: { T: TC,             phase: 'critical' } },
        { at: 0.7, state: { T: TC * 1.5,       phase: 'para'     } },
        { at: 1,   state: { T: TC * 2.5,       phase: 'para'     } },
      ],
    },
  ],

  connect: {
    body: `El modelo de Ising es mucho más que física de imanes. Es el PROTOTIPO universal de las transiciones de fase de segundo orden:

• Transición líquido-gas cerca del punto crítico (mismos exponentes universales).
• Transición superconductora BCS (Cooper pairs = "espines" de quasi-momentos).
• Cosmología: el campo de Higgs en el universo temprano siguió una transición de Ising al enfriarse.
• Redes neuronales de Hopfield: la memoria asociativa es formalmente un modelo de Ising.
• Modelos de votación y opinión pública en sociofísica.

La universalidad es la idea profunda: sistemas muy distintos comparten los mismos exponentes críticos (β=1/8, γ=7/4, ν=1) porque tienen la misma SIMETRÍA ROTA y la misma DIMENSIONALIDAD. La física microscópica no importa cerca del punto crítico.`,
    links: [
      { label: 'Gas Ideal LJ — fases desde potencial molecular', href: '#ideal-gas' },
      { label: 'Mecánica Estadística — ensembles y termodinámica', href: '#stat-mech' },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// Motor Metropolis Monte Carlo (CPU, puro TS)
// ═══════════════════════════════════════════════════════════════

function createGrid(N: number, hot: boolean): Int8Array {
  const grid = new Int8Array(N * N);
  if (hot) {
    for (let i = 0; i < N * N; i++) grid[i] = Math.random() < 0.5 ? 1 : -1;
  } else {
    grid.fill(1);
  }
  return grid;
}

/**
 * Ejecuta `steps` intentos de Metropolis sobre la red.
 * Modifica `grid` in-place. Devuelve [magnetización, energía_por_espín].
 */
function metropolisSteps(
  grid: Int8Array,
  N: number,
  T: number,
  steps: number,
): [number, number] {
  const N2 = N * N;
  const beta = T > 0 ? 1.0 / T : Infinity;

  // Tabla de Boltzmann: ΔE posibles son 0, 4, 8 (con J=1, vecinos hasta 4)
  // ΔE = 2J·s·Σnn ∈ {-8,-4,0,4,8}; solo ΔE>0 necesita prob
  const expM4  = Math.exp(-4.0  * beta);
  const expM8  = Math.exp(-8.0  * beta);

  for (let step = 0; step < steps; step++) {
    const idx = (Math.random() * N2) | 0;
    const row = (idx / N) | 0;
    const col = idx % N;

    const s = grid[idx];
    // Suma de 4 vecinos (condiciones periódicas)
    const sumNN =
      grid[((row - 1 + N) % N) * N + col] +
      grid[((row + 1)     % N) * N + col] +
      grid[row * N + (col - 1 + N) % N] +
      grid[row * N + (col + 1)     % N];

    const dE = 2 * s * sumNN; // J=1

    if (dE <= 0) {
      grid[idx] = -s as -1 | 1;
    } else {
      const prob = dE === 4 ? expM4 : dE === 8 ? expM8 : Math.exp(-dE * beta);
      if (Math.random() < prob) grid[idx] = -s as -1 | 1;
    }
  }

  // Calcular magnetización y energía
  let sumS = 0;
  let sumE = 0;
  for (let i = 0; i < N2; i++) {
    sumS += grid[i];
    const row = (i / N) | 0;
    const col = i % N;
    // Solo contar vecinos derecha y abajo para evitar doble conteo
    const right = grid[row * N + (col + 1) % N];
    const down  = grid[((row + 1) % N) * N + col];
    sumE += -grid[i] * (right + down);
  }
  return [Math.abs(sumS) / N2, sumE / N2];
}

// ═══════════════════════════════════════════════════════════════
// Sub-componente 3D (DENTRO del Canvas — useFrame válido aquí)
// ═══════════════════════════════════════════════════════════════

const COLOR_UP   = new THREE.Color('#FF6B35').multiplyScalar(2.5);  // naranja brillante
const COLOR_DOWN = new THREE.Color('#4FC3F7').multiplyScalar(2.5);  // cian brillante

const DUMMY = new THREE.Object3D();

interface SpinMeshProps {
  gridRef:  React.MutableRefObject<Int8Array>;
  N:        number;
  TRef:     React.MutableRefObject<number>;
  running:  boolean;
  onStats:  (m: number, e: number) => void;
}

function SpinScene({ gridRef, N, TRef, running, onStats }: SpinMeshProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const frameCount = useRef(0);

  // Geometría: caja delgada. Altura varía con espín.
  // instancia i: position xz del espín, y = ±0.5 segun spin
  const spacing = 1.0;
  const N2 = N * N;

  // Materiales: un color por instancia via instanceColor
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Inicializar colores e instancias
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N2 * 3), 3);
    updateInstances(mesh, gridRef.current, N, spacing);
  }, [N, N2, gridRef, spacing]);

  useFrame(() => {
    if (running) {
      const [m, e] = metropolisSteps(gridRef.current, N, TRef.current, STEPS_PER_FRAME);
      frameCount.current++;
      // Reportar stats cada 4 frames
      if (frameCount.current % 4 === 0) onStats(m, e);
    }
    const mesh = meshRef.current;
    if (!mesh) return;
    updateInstances(mesh, gridRef.current, N, spacing);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, N2]} castShadow>
      <boxGeometry args={[0.88, 1.0, 0.88]} />
      <meshStandardMaterial
        vertexColors
        toneMapped={false}
        roughness={0.35}
        metalness={0.1}
        emissiveIntensity={1.2}
      />
    </instancedMesh>
  );
}

function updateInstances(
  mesh: THREE.InstancedMesh,
  grid: Int8Array,
  N: number,
  spacing: number,
) {
  const half = (N - 1) * spacing * 0.5;
  const colors = mesh.instanceColor as THREE.InstancedBufferAttribute | null;

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const idx = i * N + j;
      const spin = grid[idx];

      // Posición: cuadrícula xz centrada, y varía con espín
      DUMMY.position.set(
        j * spacing - half,
        spin * 0.3,          // +1 = sube un poco, -1 = baja
        i * spacing - half,
      );
      // Escala y: espín up = alto y brillante; down = bajo
      DUMMY.scale.set(1, spin === 1 ? 1.4 : 0.6, 1);
      DUMMY.updateMatrix();
      mesh.setMatrixAt(idx, DUMMY.matrix);

      // Color por instancia (actúa como emissive al ser toneMapped=false)
      if (colors) {
        const c = spin === 1 ? COLOR_UP : COLOR_DOWN;
        colors.setXYZ(idx, c.r, c.g, c.b);
      }
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

// ═══════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════

export default function Ising2D() {
  const { audience } = useAudience();

  const [N, setN] = useState<number>(N_DEFAULT);
  const [T, setT] = useState<number>(TC * 0.5);
  const [running, setRunning] = useState(true);
  const [hotStart, setHotStart] = useState(false);

  // Stats mostradas en HUD
  const [mag,  setMag]  = useState(0.95);
  const [ener, setEner] = useState(-1.8);

  // Grid vive en ref para que useFrame lo mutice sin re-render
  const gridRef = useRef<Int8Array>(createGrid(N, hotStart));
  const TRef    = useRef<number>(T);

  // Sincronizar T con el ref
  useEffect(() => { TRef.current = T; }, [T]);

  // LessonPanel aplica estado — sincronizar T y resetear grid
  const handleState = useCallback((patch: Partial<IsingState>) => {
    if (patch.T !== undefined) {
      setT(patch.T);
      TRef.current = patch.T;
    }
  }, []);

  // Reiniciar grid al cambiar N o hotStart
  const resetGrid = useCallback((newN?: number, hot?: boolean) => {
    const n = newN ?? N;
    const h = hot ?? hotStart;
    gridRef.current = createGrid(n, h);
    setMag(h ? 0.5 : 1.0);
    setEner(h ? 0 : -2.0);
  }, [N, hotStart]);

  const handleNChange = (newN: number) => {
    setN(newN);
    resetGrid(newN, hotStart);
  };
  const handleHotToggle = (hot: boolean) => {
    setHotStart(hot);
    resetGrid(N, hot);
  };

  // Estadísticos derivados
  const ToverTc = T / TC;
  const phase =
    ToverTc < 0.9  ? 'Ferromagnética' :
    ToverTc < 1.1  ? '⚡ CRÍTICA' :
    'Paramagnética';
  const phaseColor =
    ToverTc < 0.9  ? '#FF6B35' :
    ToverTc < 1.1  ? '#FDB813' :
    '#4FC3F7';

  // Distancia de cámara según N
  const camDist = (N / N_DEFAULT) * 28;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage
          cameraDistance={camDist}
          autoRotate
          bloomIntensity={0.9}
          bloomThreshold={0.1}
          bgColor="#05060A"
        >
          <SpinScene
            gridRef={gridRef}
            N={N}
            TRef={TRef}
            running={running}
            onStats={(m, e) => { setMag(m); setEner(e); }}
          />
        </Stage>

        {/* HUD de estado */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div>
            <span className="text-[#64748B]">Fase&nbsp;&nbsp;</span>
            <span style={{ color: phaseColor }}>{phase}</span>
          </div>
          <div>
            <span className="text-[#64748B]">T/Tc&nbsp;&nbsp;</span>
            <span className="text-white">{ToverTc.toFixed(3)}</span>
          </div>
          <div>
            <span className="text-[#64748B]">T&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span className="text-white">{T.toFixed(3)}</span>
            <span className="text-[#64748B]"> J/k_B</span>
          </div>
          <div>
            <span className="text-[#64748B]">|m|&nbsp;&nbsp;&nbsp;</span>
            <span className="text-[#FF6B35]">{mag.toFixed(4)}</span>
          </div>
          <div>
            <span className="text-[#64748B]">e/N²&nbsp;&nbsp;</span>
            <span className="text-[#4FC3F7]">{ener.toFixed(3)}</span>
            <span className="text-[#64748B]"> J</span>
          </div>
          <div>
            <span className="text-[#64748B]">Tc&nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span className="text-[#FDB813]">{TC.toFixed(4)}</span>
            <span className="text-[#64748B]"> (Onsager)</span>
          </div>
        </div>

        {/* Controles de temperatura */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-4 py-2.5">
          <span className="text-[11px] font-mono text-[#64748B]">T</span>
          <input
            type="range"
            min={0.2}
            max={6.0}
            step={0.01}
            value={T}
            onChange={e => setT(Number(e.target.value))}
            className="w-40"
          />
          <span className="text-[11px] font-mono text-white w-10">{T.toFixed(2)}</span>
          <div className="w-px h-5 bg-[#1E293B]" />
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>
            {running ? '❚❚' : '▶'}
          </IconBtn>
          <IconBtn onClick={() => resetGrid()} title="Reiniciar red">↺</IconBtn>
        </div>
      </div>

      <LessonPanel<IsingState>
        lesson={LESSON}
        onApplyState={handleState}
        sandbox={
          <>
            <Section title="Temperatura">
              <Slider
                label="T (J/k_B)"
                v={T}
                min={0.2}
                max={6.0}
                step={0.02}
                on={v => setT(v)}
              />
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                <PresetBtn label="0.5 Tc" onClick={() => setT(TC * 0.5)} />
                <PresetBtn label="Tc" highlight onClick={() => setT(TC)} />
                <PresetBtn label="2.5 Tc" onClick={() => setT(TC * 2.5)} />
              </div>
              <div className="mt-2 text-[10px] font-mono text-[#64748B]">
                Tc = {TC.toFixed(4)} J/k_B (Onsager 1944)
              </div>
            </Section>

            <Section title="Red">
              <div className="text-[11px] text-[#94A3B8] mb-2">Tamaño N×N</div>
              <div className="grid grid-cols-3 gap-1.5">
                {[16, 32, 48].map(n => (
                  <button
                    key={n}
                    onClick={() => handleNChange(n)}
                    className={`py-1.5 rounded border text-[11px] transition ${
                      N === n
                        ? 'border-[#FDB813]/50 text-[#FDB813] bg-[#FDB813]/10'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {n}×{n}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => handleHotToggle(!hotStart)}
                  className={`px-2.5 py-1 rounded border text-[11px] transition ${
                    hotStart
                      ? 'border-[#F87171]/50 text-[#F87171] bg-[#F87171]/10'
                      : 'border-[#1E293B] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {hotStart ? 'Inicio caliente (aleatorio)' : 'Inicio frío (ordenado)'}
                </button>
              </div>
            </Section>

            {audience !== 'child' && (
              <Section title="Observables">
                <Row label="|m|"   value={mag.toFixed(5)} />
                <Row label="e/N²"  value={ener.toFixed(4) + ' J'} />
                <Row label="T/Tc"  value={ToverTc.toFixed(4)} />
                <Row label="N×N"   value={`${N}×${N} = ${N*N}`} />
                <div className="mt-2 text-[10px] text-[#64748B]">
                  {STEPS_PER_FRAME} pasos Metropolis/frame.
                </div>
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Exponentes críticos (Ising 2D exactos)">
                <div className="text-[10px] font-mono text-[#CBD5E1] space-y-0.5 leading-relaxed">
                  <div><span className="text-[#64748B]">β = </span><span className="text-[#FDB813]">1/8</span><span className="text-[#64748B]">  (magnetización)</span></div>
                  <div><span className="text-[#64748B]">γ = </span><span className="text-[#FDB813]">7/4</span><span className="text-[#64748B]">  (susceptibilidad)</span></div>
                  <div><span className="text-[#64748B]">ν = </span><span className="text-[#FDB813]">1</span><span className="text-[#64748B]">    (long. correlación)</span></div>
                  <div><span className="text-[#64748B]">α = </span><span className="text-[#FDB813]">0</span><span className="text-[#64748B]">    (calor específico, log)</span></div>
                  <div><span className="text-[#64748B]">η = </span><span className="text-[#FDB813]">1/4</span><span className="text-[#64748B]">  (función de corr.)</span></div>
                </div>
              </Section>
            )}

            <Section title="Algoritmo">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">Metropolis MC:</div>
                <div className="text-[#94A3B8]">1. Elegir espín i al azar</div>
                <div className="text-[#94A3B8]">2. ΔE = 2Jsᵢ·Σ_nn sⱼ</div>
                <div className="text-[#94A3B8]">3. Si ΔE ≤ 0: aceptar</div>
                <div className="text-[#94A3B8]">   Si ΔE {'>'} 0: aceptar con e^{'{'}−ΔE/T{'}'}</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UI helpers (mismo estilo que DoublePendulum)
// ═══════════════════════════════════════════════════════════════

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white">{value}</span>
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
        <span className="text-white">{v.toFixed(3)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full mt-1" />
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
          ? 'border-[#FDB813]/60 text-[#FDB813] bg-[#FDB813]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}>
      {children}
    </button>
  );
}

function PresetBtn({ label, onClick, highlight }: {
  label: string; onClick: () => void; highlight?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`py-1.5 rounded border text-[11px] transition ${
        highlight
          ? 'border-[#FDB813]/50 text-[#FDB813] bg-[#FDB813]/10 hover:bg-[#FDB813]/20'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}>
      {label}
    </button>
  );
}
