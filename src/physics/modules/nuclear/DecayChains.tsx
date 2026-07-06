/**
 * Cadenas de Decaimiento Nuclear — Física real de Bateman.
 *
 * Motor: ecuaciones de Bateman para la cadena U-238 → Th-234 → Pa-234 → U-234 → … → Pb-206
 * (cadena 4n+2, decaimiento secular). Integración exacta vía exponencial analítica.
 *
 * Visualización: esfera central (núcleo padre) emisiva que "pulsa" con la actividad.
 * Partículas hija emitidas como sprites que orbitan con colores por tipo (α=naranja, β=cian).
 * Point cloud de rastros radiales mostrando la actividad A(t) = λ·N(t).
 * Panel derecho: curva de actividad acumulada, tabla de núcleos.
 *
 * FÍSICA REAL: N(t) = N₀·e^(-λt), λ = ln(2)/t½.
 * Cadena completa de Bateman: dN_i/dt = λ_{i-1}·N_{i-1} - λ_i·N_i
 * (branching ratio = 1 para simplificar la cadena principal α/β).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Tipos y constantes físicas ──────────────────────────────────────────────

interface Nuclide {
  symbol: string;   // e.g. "U-238"
  Z: number;        // número atómico
  A: number;        // número másico
  halfLifeS: number; // vida media en segundos
  decayType: 'alpha' | 'beta' | 'stable';
  color: string;    // color HSL para la escena
}

// Cadena de decaimiento U-238 → Pb-206 (cadena 4n+2)
// Vidas medias en segundos reales (NNDC).
// Para la visualización usamos un tiempo "acelerado" configurable.
const CHAIN_U238: Nuclide[] = [
  { symbol: 'U-238',  Z: 92, A: 238, halfLifeS: 1.41e17,  decayType: 'alpha',  color: '#22C55E' },  // verde
  { symbol: 'Th-234', Z: 90, A: 234, halfLifeS: 2.08e6,   decayType: 'beta',   color: '#38BDF8' },  // cian
  { symbol: 'Pa-234', Z: 91, A: 234, halfLifeS: 6.89e4,   decayType: 'beta',   color: '#818CF8' },  // violeta
  { symbol: 'U-234',  Z: 92, A: 234, halfLifeS: 7.74e12,  decayType: 'alpha',  color: '#34D399' },  // esmeralda
  { symbol: 'Th-230', Z: 90, A: 230, halfLifeS: 2.37e12,  decayType: 'alpha',  color: '#60A5FA' },  // azul
  { symbol: 'Ra-226', Z: 88, A: 226, halfLifeS: 5.05e10,  decayType: 'alpha',  color: '#FCD34D' },  // amarillo
  { symbol: 'Rn-222', Z: 86, A: 222, halfLifeS: 3.30e5,   decayType: 'alpha',  color: '#FB923C' },  // naranja
  { symbol: 'Po-218', Z: 84, A: 218, halfLifeS: 185.0,    decayType: 'alpha',  color: '#F87171' },  // rojo claro
  { symbol: 'Pb-214', Z: 82, A: 214, halfLifeS: 1613.4,   decayType: 'beta',   color: '#A78BFA' },  // lavanda
  { symbol: 'Bi-214', Z: 83, A: 214, halfLifeS: 1194.0,   decayType: 'beta',   color: '#C084FC' },  // morado
  { symbol: 'Po-214', Z: 84, A: 214, halfLifeS: 1.64e-4,  decayType: 'alpha',  color: '#FF6B6B' },  // rojo
  { symbol: 'Pb-210', Z: 82, A: 210, halfLifeS: 7.08e8,   decayType: 'beta',   color: '#94A3B8' },  // gris
  { symbol: 'Bi-210', Z: 83, A: 210, halfLifeS: 4.33e5,   decayType: 'beta',   color: '#CBD5E1' },  // blanco
  { symbol: 'Po-210', Z: 84, A: 210, halfLifeS: 1.19e7,   decayType: 'alpha',  color: '#FCA5A5' },  // rosa
  { symbol: 'Pb-206', Z: 82, A: 206, halfLifeS: Infinity, decayType: 'stable', color: '#64748B' },  // gris oscuro
];

// Cadena Ra-226 (extracto relevante, más rápida para demo)
const CHAIN_RA226: Nuclide[] = CHAIN_U238.slice(5); // Ra-226 → Pb-206

// Decaimiento simple (un solo núclido)
const CHAIN_C14: Nuclide[] = [
  { symbol: 'C-14',  Z: 6,  A: 14, halfLifeS: 1.803e11, decayType: 'beta',   color: '#34D399' },
  { symbol: 'N-14',  Z: 7,  A: 14, halfLifeS: Infinity, decayType: 'stable', color: '#64748B' },
];

interface ChainPreset {
  id: string;
  name: string;
  chain: Nuclide[];
  note: string;
  timeScale: number; // factor de aceleración del tiempo
  N0: number;        // átomos iniciales (normalizados)
}

const PRESETS: ChainPreset[] = [
  {
    id: 'u238',
    name: 'U-238 → Pb-206 (cadena completa)',
    chain: CHAIN_U238,
    note: '15 isótopos. Equilibrio secular: t_corto → t½ inversamente proporcional a actividad.',
    timeScale: 1e14,
    N0: 1e6,
  },
  {
    id: 'ra226',
    name: 'Ra-226 → Pb-206 (rama rápida)',
    chain: CHAIN_RA226,
    note: 'Empieza desde Ra-226 (t½=1600 años). En días llega a equilibrio con sus hijas.',
    timeScale: 1e8,
    N0: 1e6,
  },
  {
    id: 'c14',
    name: 'C-14 → N-14 (datación)',
    chain: CHAIN_C14,
    note: 'Decaimiento simple. t½=5730 años. En 10 t½ queda 1/1024 ≈ 0.1% del original.',
    timeScale: 3e8,
    N0: 1e6,
  },
];

// ─── Lesson ───────────────────────────────────────────────────────────────────

interface DecayState {
  presetId: string;
}

const LESSON: Lesson<DecayState> = {
  hook: {
    title: 'Un átomo de uranio comenzó a desintegrarse hace 4 500 millones de años. Todavía no termina.',
    body: `Cuando se formó la Tierra, cada átomo de U-238 ya estaba "muriendo". Su núcleo, inestable, lanza partículas alfa. Se convierte en Th-234, que emite un electrón (beta) y pasa a Pa-234... y así siguen 14 transformaciones hasta llegar a Pb-206, el plomo estable.

El reloj no es lineal: no todos los isótopos duran igual. El Pa-234 se va en 6.7 horas. El Ra-226 aguanta 1600 años. El U-234 permanece 245 000 años.

La fórmula es elegante: N(t) = N₀·e^(−λt), donde λ = ln(2)/t½. Pero la cadena completa — las ecuaciones de Bateman — es un sistema de ODEs acopladas. Cada isóton alimenta al siguiente.

Esto no es metáfora. Es la base de la datación radiométrica, la medicina nuclear, los reactores y los detectores de humo.`,
  },

  steps: [
    {
      title: 'Decaimiento simple — N(t) = N₀ e^(−λt)',
      duration: 6000,
      body: `El caso más simple: un solo núclido inestable. C-14 → N-14.

La ley de decaimiento N(t) = N₀·e^(−λt) viene de la probabilidad de decaer por átomo por segundo — λ = ln(2)/t½ — que es constante para cada isótopo.

La actividad A(t) = λ·N(t) = (λN₀)·e^(−λt). También decae exponencialmente con la misma constante λ.

Ves la curva verde caer: cada t½ (5730 años para C-14), queda la mitad. En 10 vidas medias → solo 0.1%. Es la base de la datación radiométrica: midiendo A(t)/A₀ calculas t.`,
      formula: 'N(t) = N₀ · e^(-λt)\nλ = ln(2) / t½\nA(t) = λ · N(t)   [decays/s = Becquerel]',
      keyframes: [
        { at: 0, state: { presetId: 'c14' } },
        { at: 1, state: { presetId: 'c14' } },
      ],
    },
    {
      title: 'Ecuaciones de Bateman — cadena acoplada',
      duration: 6500,
      body: `Cuando hay una cadena (A → B → C → …), el sistema se acopla:

dN₁/dt = −λ₁·N₁
dN₂/dt = +λ₁·N₁ − λ₂·N₂
dN₃/dt = +λ₂·N₂ − λ₃·N₃  …

Las soluciones de Bateman (1910) son sumas de exponenciales. El comportamiento emergente es riquísimo: los isótopos de vida corta se acumulan y luego "bajan" cuando el padre se agota.

Cambiamos a Ra-226 → Pb-206. Observa cómo Rn-222, Po-218 y los de plomo/bismuto se acumulan rápido al principio y luego entran en equilibrio secular con el padre.`,
      formula: 'dNᵢ/dt = λᵢ₋₁·Nᵢ₋₁ − λᵢ·Nᵢ\n(Bateman, 1910)\nSol. exacta: suma de exp. decrecientes',
      keyframes: [
        { at: 0, state: { presetId: 'ra226' } },
        { at: 1, state: { presetId: 'ra226' } },
      ],
    },
    {
      title: 'Equilibrio secular — la cadena U-238 completa',
      duration: 7000,
      body: `Con U-238 (t½ = 4.47×10⁹ años) como padre lento, a tiempos largos se alcanza el EQUILIBRIO SECULAR:

λ₁·N₁ = λ₂·N₂ = λ₃·N₃ = … = constante

Todos los isótopos hijos tienen la misma ACTIVIDAD que el padre. La actividad total es N_eslabones × A_padre.

Eso significa que en una muestra de uranio viejo, los 14 isótopos de la cadena contribuyen IGUAL a la radiación total — aunque sus concentraciones sean muy distintas (inversamente proporcionales a sus λ).

La geometría 3D muestra los núclidos como esferas con radio ∝ N(t). Ves cómo el Pb-206 (estable) acumula masa monotónicamente mientras el U-238 decrece.`,
      formula: 'Equilibrio secular: λᵢ·Nᵢ = λ_padre·N_padre\n→ Nᵢ ∝ t½ᵢ\nActividad total ≈ Nₑₛₗₐᵦₒₙₑₛ · A_padre',
      keyframes: [
        { at: 0, state: { presetId: 'u238' } },
        { at: 1, state: { presetId: 'u238' } },
      ],
    },
    {
      title: 'Actividad y detección — el Becquerel',
      duration: 5500,
      body: `La actividad A = λ·N se mide en Becquerel (Bq): un decaimiento por segundo.

Un gramo de U-238 natural tiene A ≈ 12 400 Bq (muy baja, por t½ enorme). Pero el mismo gramo en equilibrio con sus hijas → ~14× eso.

Un gramo de Ra-226 tiene A ≈ 3.7×10¹⁰ Bq = 1 Curie (la unidad histórica, definida con Radio).

Aplicaciones directas:
• Datación C-14: mides A/A₀ → t = ln(A₀/A)/λ
• Medicina nuclear: Tc-99m (t½=6h) → se va en horas del cuerpo
• Detectores de humo: Am-241 (t½=432 años) ioniza el aire; el humo interrumpe la corriente`,
      formula: 'A(t) = λ·N(t)   [Bq = decaimientos/s]\n1 Curie = 3.7×10¹⁰ Bq (1g Ra-226)\nt_datacion = ln(A₀/A) / λ',
      keyframes: [
        { at: 0, state: { presetId: 'ra226' } },
        { at: 1, state: { presetId: 'ra226' } },
      ],
    },
  ],

  connect: {
    body: `Las cadenas de decaimiento son el reloj de la geología y la cosmoquímica. La relación U-238/Pb-206 datómina la edad de los meteoritos: 4.567×10⁹ años — la edad del Sistema Solar.

El C-14 le da fecha a todo lo orgánico hasta ~50 000 años. El K-40/Ar-40 cubre millones de años. El Rb-87/Sr-87 cubre miles de millones.

En medicina nuclear, cada isótopo de la cadena es un candidato terapéutico o diagnóstico. El Ra-223 (hermano del Ra-226) se usa contra metástasis óseas — porque el hueso acumula radio como si fuera calcio.

La física nuclear no es solo bombas y reactores. Es el mecanismo que calienta el interior de la Tierra, que formó los elementos pesados en supernovas, y que nos permite leer el tiempo en las rocas.`,
    links: [
      { label: 'Astrofísica — Nucleosíntesis estelar', href: '#stellar-structure' },
      { label: 'Mecánica cuántica — Túnel cuántico (origen del alfa)', href: '#schrodinger-1d' },
      { label: 'Termodinámica — Calor interno de la Tierra', href: '#heat-1d' },
    ],
  },
};

// ─── Matemáticas de Bateman (analítica numérica) ─────────────────────────────

/**
 * Integra la cadena de Bateman por un paso dt con RK4.
 * dN[i]/dt = lambda[i-1]*N[i-1] - lambda[i]*N[i]
 * El último isótopo (estable) solo acumula: dN[n]/dt = lambda[n-1]*N[n-1].
 */
function batemanRK4(N: Float64Array, lambdas: number[], dt: number): Float64Array {
  const n = N.length;
  const deriv = (y: Float64Array): Float64Array => {
    const d = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const inFlow  = i > 0 ? lambdas[i - 1] * y[i - 1] : 0;
      const outFlow = lambdas[i] * y[i]; // 0 si stable (lambda=0)
      d[i] = inFlow - outFlow;
    }
    return d;
  };

  const add = (a: Float64Array, b: Float64Array, s: number): Float64Array => {
    const r = new Float64Array(n);
    for (let i = 0; i < n; i++) r[i] = a[i] + b[i] * s;
    return r;
  };

  const k1 = deriv(N);
  const k2 = deriv(add(N, k1, dt / 2));
  const k3 = deriv(add(N, k2, dt / 2));
  const k4 = deriv(add(N, k3, dt));

  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.max(0, N[i] + (dt / 6) * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]));
  }
  return out;
}

function makeLambdas(chain: Nuclide[]): number[] {
  return chain.map(n => n.halfLifeS === Infinity ? 0 : Math.LN2 / n.halfLifeS);
}

// ─── Componente top-level ─────────────────────────────────────────────────────

export default function DecayChains() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<string>('u238');
  const preset = PRESETS.find(p => p.id === presetId)!;

  // Estado de la simulación (Float64Array para precisión de 64 bits)
  const chain = preset.chain;
  const lambdas = useMemo(() => makeLambdas(chain), [chain]);

  const Nref = useRef<Float64Array>(new Float64Array(chain.length));
  const simTimeRef = useRef<number>(0);
  const [, forceUpdate] = useState(0);

  // Slider: qué fracción de la "ventana de tiempo" vemos
  const [timeWindow, setTimeWindow] = useState(0.3); // 0..1 (exponencial)
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1.0);

  // Reiniciar cuando cambia el preset
  useEffect(() => {
    const N = new Float64Array(chain.length);
    N[0] = preset.N0;
    Nref.current = N;
    simTimeRef.current = 0;
  }, [presetId, chain, preset.N0]);

  // Loop de simulación fuera del Canvas (no necesita useFrame aquí)
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let lastTs = performance.now();
    let lastUi = 0;

    const tick = () => {
      const now = performance.now();
      const wallDt = Math.min((now - lastTs) / 1000, 0.05); // segundos reales, cap 50 ms
      lastTs = now;

      // Tiempo físico acelerado
      const physDt = wallDt * preset.timeScale * speed;

      // Sub-pasos para estabilidad con t½ muy cortos
      const minHalf = Math.min(...lambdas.filter(l => l > 0).map(l => Math.LN2 / l));
      const safeStep = minHalf / 4;
      const nSteps = Math.max(1, Math.ceil(physDt / safeStep));
      const subDt = physDt / nSteps;

      let N = Nref.current;
      for (let s = 0; s < nSteps; s++) {
        N = batemanRK4(N, lambdas, subDt);
      }
      Nref.current = N;
      simTimeRef.current += physDt;

      if (now - lastUi > 80) {
        forceUpdate(x => x + 1);
        lastUi = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, preset.timeScale, speed, lambdas]);

  // Calcular actividades para mostrar
  const activities = chain.map((n, i) => lambdas[i] * Nref.current[i]);
  const totalActivity = activities.reduce((s, a) => s + a, 0);
  const N0 = Nref.current[0]; // núclido padre actual

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      {/* Canvas 3D */}
      <div className="relative">
        <Stage cameraDistance={8} autoRotate bloomIntensity={0.9} bloomThreshold={0.10}>
          <DecayScene
            chain={chain}
            Nref={Nref}
            lambdas={lambdas}
            N0init={preset.N0}
          />
        </Stage>

        {/* HUD — métricas */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div>
            <span className="text-[#64748B]">t físico&nbsp;&nbsp; </span>
            <span>{fmtTime(simTimeRef.current)}</span>
          </div>
          <div>
            <span className="text-[#64748B]">A total&nbsp;&nbsp;&nbsp; </span>
            <span>{fmtActivity(totalActivity)}</span>
          </div>
          <div>
            <span className="text-[#64748B]">N padre&nbsp;&nbsp;&nbsp; </span>
            <span>{fmtN(N0, preset.N0)}</span>
          </div>
          <div>
            <span className="text-[#64748B]">isótopos&nbsp; </span>
            <span>{chain.length}</span>
          </div>
        </div>

        {/* Controles de tiempo */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>
            {running ? '❚❚' : '▶'}
          </IconBtn>
          <IconBtn
            onClick={() => {
              const N = new Float64Array(chain.length);
              N[0] = preset.N0;
              Nref.current = N;
              simTimeRef.current = 0;
              forceUpdate(x => x + 1);
            }}
            title="Reiniciar"
          >
            ↺
          </IconBtn>
          <div className="flex items-center gap-1 ml-2">
            <span className="text-[10px] text-[#64748B]">velocidad</span>
            <input
              type="range" min={0.1} max={5} step={0.1} value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-[10px] text-white font-mono">{speed.toFixed(1)}×</span>
          </div>
        </div>
      </div>

      {/* Panel de lección */}
      <LessonPanel<DecayState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) setPresetId(patch.presetId);
        }}
        sandbox={
          <>
            <Section title="Cadena de decaimiento">
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPresetId(p.id)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      presetId === p.id
                        ? 'bg-gradient-to-br from-[#064E3B]/40 to-[#1E40AF]/30 border-[#34D399]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-[#94A3B8] italic leading-relaxed">{preset.note}</div>
            </Section>

            <Section title="Isótopos en cadena">
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {chain.map((nuc, i) => {
                  const N = Nref.current[i];
                  const frac = preset.N0 > 0 ? N / preset.N0 : 0;
                  const A = activities[i];
                  return (
                    <div key={nuc.symbol} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: nuc.color, boxShadow: `0 0 4px ${nuc.color}` }}
                      />
                      <span className="font-mono text-[10px] text-white w-16 shrink-0">{nuc.symbol}</span>
                      <div className="flex-1 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width]"
                          style={{ width: `${Math.min(100, frac * 100)}%`, background: nuc.color, opacity: 0.85 }}
                        />
                      </div>
                      {audience === 'researcher' && (
                        <span className="font-mono text-[9px] text-[#64748B] w-16 text-right shrink-0">
                          {fmtActivityShort(A)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>

            {audience !== 'child' && (
              <Section title="Tipo de decaimiento">
                <div className="flex gap-3 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#FB923C', boxShadow: '0 0 4px #FB923C' }} />
                    <span className="text-[#94A3B8]">α (He-4)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#38BDF8', boxShadow: '0 0 4px #38BDF8' }} />
                    <span className="text-[#94A3B8]">β⁻ (e⁻ + ν̄)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#64748B' }} />
                    <span className="text-[#94A3B8]">estable</span>
                  </div>
                </div>
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Parámetros">
                <Slider
                  label="Velocidad"
                  v={speed}
                  min={0.1}
                  max={5}
                  step={0.1}
                  on={setSpeed}
                  fmt={v => `${v.toFixed(1)}×`}
                />
              </Section>
            )}

            <Section title="Ecuación">
              <pre className="text-[10px] font-mono text-[#FDB813] leading-snug bg-[#05060A] border border-[#1E293B] rounded p-2 whitespace-pre-wrap">
                {`N(t) = N₀·e^(-λt)\nλ = ln(2) / t½\ndNᵢ/dt = λᵢ₋₁Nᵢ₋₁ − λᵢNᵢ\n(Bateman, 1910)`}
              </pre>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D ────────────────────────────────────────────────────────────────

const PARTICLE_COUNT = 600;
const ORBIT_RADIUS_BASE = 3.0;

interface DecaySceneProps {
  chain: Nuclide[];
  Nref: React.MutableRefObject<Float64Array>;
  lambdas: number[];
  N0init: number;
}

function DecayScene({ chain, Nref, lambdas, N0init }: DecaySceneProps) {
  const tex = useMemo(() => getParticleTexture(), []);

  // Mallas de núclidos: una esfera por isótopo, dispuestas en espiral
  const nucleiRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Point cloud para partículas emitidas (alpha naranja, beta cian)
  const particleGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);

  const pIdx = useRef(0);
  const pCount = useRef(0);

  // Tiempo de animación local para efectos visuales
  const animT = useRef(0);

  // Posiciones en espiral de los núclidos (fijas)
  const nucPositions = useMemo<THREE.Vector3[]>(() => {
    return chain.map((_, i) => {
      const angle = (i / chain.length) * Math.PI * 4; // 2 vueltas
      const r = ORBIT_RADIUS_BASE + i * 0.15;
      const y = (i / chain.length - 0.5) * 4;
      return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
    });
  }, [chain]);

  // Colores parseados
  const nucColors = useMemo(() => chain.map(n => new THREE.Color(n.color)), [chain]);

  // Líneas de conexión (flechas entre núclidos)
  const linePoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < chain.length - 1; i++) {
      pts.push(nucPositions[i].clone());
      pts.push(nucPositions[i + 1].clone());
    }
    return pts;
  }, [nucPositions, chain]);

  const lineColors = useMemo(() => {
    const cols: THREE.Color[] = [];
    for (let i = 0; i < chain.length - 1; i++) {
      cols.push(nucColors[i]);
      cols.push(nucColors[i + 1]);
    }
    return cols;
  }, [nucColors, chain]);

  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(linePoints.length * 3);
    const col = new Float32Array(linePoints.length * 3);
    linePoints.forEach((p, i) => { pos[i*3]=p.x; pos[i*3+1]=p.y; pos[i*3+2]=p.z; });
    lineColors.forEach((c, i) => { col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b; });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [linePoints, lineColors]);

  useFrame((_, delta) => {
    animT.current += delta;
    const N = Nref.current;
    const totalN = N[0] > 0 ? N[0] : N0init;

    // Actualizar tamaño de esferas por número de átomos
    chain.forEach((nuc, i) => {
      const mesh = nucleiRefs.current[i];
      if (!mesh) return;
      const frac = N0init > 0 ? Math.max(0, N[i]) / N0init : 0;
      const r = 0.08 + 0.55 * Math.cbrt(Math.max(0, frac)); // radio proporcional a ∛N
      mesh.scale.setScalar(r);

      // Pulso de emisividad con la actividad
      const A = lambdas[i] * N[i];
      const maxA = lambdas[i] * N0init;
      const intensity = maxA > 0 ? Math.min(1, A / maxA) : 0;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + intensity * 1.5 + 0.3 * Math.sin(animT.current * 3 + i);
    });

    // Emitir partículas proporcionales a la actividad de los núclidos
    const posArr = particleGeo.attributes.position as THREE.BufferAttribute;
    const colArr = particleGeo.attributes.color as THREE.BufferAttribute;

    // Cada frame: emitir ~2-4 partículas desde núclidos activos
    const emitCount = 3;
    for (let e = 0; e < emitCount; e++) {
      // Elegir núclido emisor por actividad relativa
      let totalA = 0;
      const As: number[] = chain.map((_, i) => {
        const a = lambdas[i] * Math.max(0, N[i]);
        totalA += a;
        return a;
      });
      if (totalA <= 0) break;

      let r = Math.random() * totalA;
      let srcIdx = 0;
      for (let i = 0; i < chain.length - 1; i++) {
        r -= As[i];
        if (r <= 0) { srcIdx = i; break; }
      }

      const src = nucPositions[srcIdx];
      const dst = nucPositions[Math.min(srcIdx + 1, chain.length - 1)];
      const t = Math.random(); // posición aleatoria a lo largo de la trayectoria
      const spread = 0.4;

      const px = src.x + (dst.x - src.x) * t + (Math.random() - 0.5) * spread;
      const py = src.y + (dst.y - src.y) * t + (Math.random() - 0.5) * spread;
      const pz = src.z + (dst.z - src.z) * t + (Math.random() - 0.5) * spread;

      const isAlpha = chain[srcIdx].decayType === 'alpha';
      // alpha = naranja, beta = cian
      const cr = isAlpha ? 0.98 : 0.22;
      const cg = isAlpha ? 0.42 : 0.75;
      const cb = isAlpha ? 0.19 : 0.97;

      const idx = pIdx.current;
      (posArr.array as Float32Array)[idx*3]   = px;
      (posArr.array as Float32Array)[idx*3+1] = py;
      (posArr.array as Float32Array)[idx*3+2] = pz;
      (colArr.array as Float32Array)[idx*3]   = cr;
      (colArr.array as Float32Array)[idx*3+1] = cg;
      (colArr.array as Float32Array)[idx*3+2] = cb;

      pIdx.current = (idx + 1) % PARTICLE_COUNT;
      pCount.current = Math.min(pCount.current + 1, PARTICLE_COUNT);
    }
    posArr.needsUpdate = true;
    colArr.needsUpdate = true;
    particleGeo.setDrawRange(0, pCount.current);
  });

  return (
    <>
      {/* Luz ambiental central (el "núcleo original") */}
      <pointLight position={[0, 0, 0]} intensity={1.2} distance={15} color="#22C55E" />

      {/* Líneas de conexión entre isótopos */}
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial vertexColors transparent opacity={0.35} />
      </lineSegments>

      {/* Esferas de núclidos */}
      {chain.map((nuc, i) => (
        <mesh
          key={nuc.symbol}
          ref={el => { nucleiRefs.current[i] = el; }}
          position={nucPositions[i]}
        >
          <sphereGeometry args={[1, 28, 20]} />
          <meshStandardMaterial
            color={nuc.color}
            emissive={nuc.color}
            emissiveIntensity={0.8}
            metalness={0.2}
            roughness={0.35}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Point cloud de partículas emitidas */}
      <points geometry={particleGeo}>
        <pointsMaterial
          vertexColors
          map={tex}
          alphaMap={tex}
          size={0.18}
          sizeAttenuation
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  );
}

// ─── Helpers de formato ────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  if (!isFinite(s) || s === 0) return '0 s';
  if (s < 60) return `${s.toFixed(1)} s`;
  if (s < 3600) return `${(s/60).toFixed(2)} min`;
  if (s < 86400) return `${(s/3600).toFixed(2)} h`;
  if (s < 3.156e7) return `${(s/86400).toFixed(1)} días`;
  if (s < 3.156e9) return `${(s/3.156e7).toFixed(2)} años`;
  if (s < 3.156e12) return `${(s/3.156e9).toFixed(2)} Ka`;
  if (s < 3.156e15) return `${(s/3.156e12).toFixed(2)} Ma`;
  return `${(s/3.156e15).toFixed(2)} Ga`;
}

function fmtActivity(A: number): string {
  if (!isFinite(A) || A <= 0) return '0 Bq';
  if (A < 1e3) return `${A.toFixed(0)} Bq`;
  if (A < 1e6) return `${(A/1e3).toFixed(1)} kBq`;
  if (A < 1e9) return `${(A/1e6).toFixed(1)} MBq`;
  if (A < 1e12) return `${(A/1e9).toFixed(1)} GBq`;
  return `${A.toExponential(2)} Bq`;
}

function fmtActivityShort(A: number): string {
  if (!isFinite(A) || A <= 0) return '0';
  if (A < 1e3) return `${A.toFixed(0)}`;
  if (A < 1e6) return `${(A/1e3).toFixed(0)}k`;
  if (A < 1e9) return `${(A/1e6).toFixed(0)}M`;
  return `${A.toExponential(1)}`;
}

function fmtN(N: number, N0: number): string {
  if (N0 <= 0) return '?';
  const pct = (N / N0) * 100;
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  return `${(pct * 1e4).toFixed(1)} ppm`;
}

// ─── UI helpers ────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function Slider({
  label, v, min, max, step, on, fmt,
}: {
  label: string; v: number; min: number; max: number; step: number;
  on: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{fmt ? fmt(v) : v.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full mt-1" />
    </div>
  );
}

function IconBtn({
  children, onClick, active, title,
}: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title?: string;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
        active
          ? 'border-[#34D399]/60 text-[#34D399] bg-[#34D399]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}>
      {children}
    </button>
  );
}
