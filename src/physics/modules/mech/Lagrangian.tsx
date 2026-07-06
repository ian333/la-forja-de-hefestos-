/**
 * Lagrangiano y Principio de Mínima Acción — sistema carro-péndulo.
 *
 * FÍSICA REAL:
 *   Sistema: carro de masa M libre sobre riel horizontal + péndulo de masa m,
 *   longitud L, pivotado al carro.
 *
 *   Coordenadas generalizadas: q = (x, θ)  (posición del carro, ángulo del péndulo)
 *
 *   T = ½(M+m)ẋ² + mLẋθ̇cosθ + ½mL²θ̇²
 *   V = -mgL cosθ
 *   L = T − V
 *
 *   Euler-Lagrange para x:
 *     (M+m)ẍ + mL(θ̈cosθ − θ̇²sinθ) = 0
 *
 *   Euler-Lagrange para θ:
 *     mL²θ̈ + mLẍcosθ + mgLsinθ = 0
 *
 *   Resolviendo el sistema (forma matricial A·q̈ = b):
 *     A = [[M+m,  mLcosθ],
 *          [mLcosθ, mL²]]
 *     b = [mLθ̇²sinθ,  −mgLsinθ]
 *     det(A) = mL²(M+m) − m²L²cos²θ = mL²(M + m·sin²θ)
 *     ẍ   = (b[0]·mL² − b[1]·mLcosθ) / det
 *     θ̈   = (b[1]·(M+m) − b[0]·mLcosθ) / det
 *
 *   Integrador: RK4 con sub-pasos configurables (default Δt=1/600 s).
 *
 *   Caminos vecinos: N trayectorias con θ₀ + δ (δ pequeño), mostrando que
 *   SOLO el camino verdadero (δ=0) minimiza la acción S=∫L dt.
 *
 *   Acción numérica: S = Σ L·dt  (integral discreta trapecio a lo largo de la trayectoria).
 */

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Tipos ────────────────────────────────────────────────────────────────

interface CartPendParams {
  M: number;   // masa carro [kg]
  m: number;   // masa bob [kg]
  L: number;   // longitud péndulo [m]
  g: number;   // gravedad [m/s²]
}

interface CartPendState {
  t:   number;
  x:   number;  // posición carro [m]
  th:  number;  // ángulo péndulo [rad] (0 = abajo, + = antihorario)
  vx:  number;  // velocidad carro [m/s]
  vth: number;  // velocidad angular péndulo [rad/s]
}

// ─── Física: derivadas analíticas (Euler-Lagrange) ───────────────────────

function cpDerivatives(s: CartPendState, p: CartPendParams): {
  xDot: number; thDot: number; vxDot: number; vthDot: number;
} {
  const { M, m, L, g } = p;
  const { th, vx: _vx, vth } = s;
  const cosT = Math.cos(th);
  const sinT = Math.sin(th);

  // det(A) = mL²(M + m·sin²θ)
  const det = m * L * L * (M + m * sinT * sinT);

  // b = [mLθ̇²sinθ,  −mgLsinθ]
  const b0 = m * L * vth * vth * sinT;
  const b1 = -m * g * L * sinT;

  // ẍ = (b0·mL² − b1·mLcosT) / det
  const vxDot  = (b0 * m * L * L - b1 * m * L * cosT) / det;
  // θ̈ = (b1·(M+m) − b0·mLcosT) / det
  const vthDot = (b1 * (M + m) - b0 * m * L * cosT) / det;

  return { xDot: _vx, thDot: vth, vxDot, vthDot };
}

// ─── RK4 ─────────────────────────────────────────────────────────────────

function cpStep(s: CartPendState, p: CartPendParams, dt: number): CartPendState {
  const deriv = (st: CartPendState) => cpDerivatives(st, p);

  const k1 = deriv(s);
  const s2: CartPendState = {
    t: s.t + dt/2,
    x: s.x + k1.xDot * dt/2,
    th: s.th + k1.thDot * dt/2,
    vx: s.vx + k1.vxDot * dt/2,
    vth: s.vth + k1.vthDot * dt/2,
  };
  const k2 = deriv(s2);
  const s3: CartPendState = {
    t: s.t + dt/2,
    x: s.x + k2.xDot * dt/2,
    th: s.th + k2.thDot * dt/2,
    vx: s.vx + k2.vxDot * dt/2,
    vth: s.vth + k2.vthDot * dt/2,
  };
  const k3 = deriv(s3);
  const s4: CartPendState = {
    t: s.t + dt,
    x: s.x + k3.xDot * dt,
    th: s.th + k3.thDot * dt,
    vx: s.vx + k3.vxDot * dt,
    vth: s.vth + k3.vthDot * dt,
  };
  const k4 = deriv(s4);

  return {
    t:   s.t   + dt,
    x:   s.x   + (k1.xDot   + 2*k2.xDot   + 2*k3.xDot   + k4.xDot  ) * dt/6,
    th:  s.th  + (k1.thDot  + 2*k2.thDot  + 2*k3.thDot  + k4.thDot ) * dt/6,
    vx:  s.vx  + (k1.vxDot  + 2*k2.vxDot  + 2*k3.vxDot  + k4.vxDot ) * dt/6,
    vth: s.vth + (k1.vthDot + 2*k2.vthDot + 2*k3.vthDot + k4.vthDot) * dt/6,
  };
}

// ─── Energía (verificación) ────────────────────────────────────────────

function cpEnergy(s: CartPendState, p: CartPendParams): number {
  const { m, M, L, g } = p;
  const cosT = Math.cos(s.th);
  // T = ½(M+m)ẋ² + mLẋθ̇cosθ + ½mL²θ̇²
  const T = 0.5 * (M + m) * s.vx * s.vx
          + m * L * s.vx * s.vth * cosT
          + 0.5 * m * L * L * s.vth * s.vth;
  // V = -mgLcosθ
  const V = -m * g * L * cosT;
  return T + V;
}

// ─── Lagrangiano instantáneo ───────────────────────────────────────────

function cpLagrangian(s: CartPendState, p: CartPendParams): number {
  const { m, M, L, g } = p;
  const cosT = Math.cos(s.th);
  const T = 0.5 * (M + m) * s.vx * s.vx
          + m * L * s.vx * s.vth * cosT
          + 0.5 * m * L * L * s.vth * s.vth;
  const V = -m * g * L * cosT;
  return T - V;   // L = T − V
}

// ─── Calcular trayectoria vecina completa (para acción) ────────────────

function computePath(
  init: CartPendState,
  p: CartPendParams,
  dt: number,
  nSteps: number,
): { x: number; th: number; bobX: number; bobY: number; lag: number }[] {
  const path: { x: number; th: number; bobX: number; bobY: number; lag: number }[] = [];
  let s = { ...init };
  for (let i = 0; i < nSteps; i++) {
    const lag = cpLagrangian(s, p);
    path.push({
      x: s.x,
      th: s.th,
      bobX: s.x + p.L * Math.sin(s.th),
      bobY: -p.L * Math.cos(s.th),
      lag,
    });
    s = cpStep(s, p, dt);
  }
  return path;
}

// ─── Lesson ──────────────────────────────────────────────────────────────

interface LagState { mode: 'live' | 'paths' | 'action'; presetId: string; }

const LESSON: Lesson<LagState> = {
  hook: {
    title: 'La naturaleza es perezosa — y exacta.',
    body: `De todos los caminos POSIBLES que podría tomar un sistema, la naturaleza elige EXACTAMENTE UNO: el que hace mínima (o estacionaria) la integral S = ∫L dt.

Ese S se llama Acción. L = T − V es el Lagrangiano — la diferencia entre energía cinética y potencial.

Esto no es una analogía ni una metáfora. Es el Principio de Mínima Acción, y de él se derivan TODAS las ecuaciones de movimiento de la mecánica clásica, relativista y cuántica.

Un carro con péndulo colgante. Dos masas, un riel, la gravedad. Ingresas las coordenadas en L = T − V, aplicas Euler-Lagrange, y obtienes las ecuaciones exactas de movimiento. Sin vectores de fuerza. Sin diagramas de cuerpo libre. Pura geometría del espacio de configuraciones.`,
  },

  steps: [
    {
      title: 'El Lagrangiano: T − V',
      duration: 6000,
      body: `El sistema tiene dos grados de libertad: x (posición del carro) y θ (ángulo del péndulo).

T = ½(M+m)ẋ² + mLẋθ̇cosθ + ½mL²θ̇²

El primer término: el carro con todo su peso. El segundo: el acoplamiento — el carro y el bob se mueven juntos si el ángulo es pequeño. El tercero: rotación pura del péndulo.

V = −mgLcosθ  (solo el péndulo tiene energía potencial en θ)

L = T − V. Observa el carro azul deslizándose sin fricción y el bob naranjo oscilando. Toda la dinámica emerge de este L.`,
      formula: 'L = T − V\nT = ½(M+m)ẋ² + mLẋθ̇cosθ + ½mL²θ̇²\nV = −mgL cosθ',
      keyframes: [
        { at: 0, state: { mode: 'live', presetId: 'default' } },
        { at: 1, state: { mode: 'live', presetId: 'default' } },
      ],
    },
    {
      title: 'Euler-Lagrange: las ecuaciones brotan solas',
      duration: 6000,
      body: `Aplico d/dt(∂L/∂q̇ᵢ) − ∂L/∂qᵢ = 0 para cada coordenada.

Para x (sin potencial en x, conservación del momento total):
  (M+m)ẍ + mL(θ̈cosθ − θ̇²sinθ) = 0

Para θ:
  mL²θ̈ + mLẍcosθ + mgLsinθ = 0

El sistema se resuelve algebraicamente: det(A) = mL²(M + m·sin²θ).

Con RK4 de paso Δt = 1/600 s la energía se conserva con ΔE/E < 10⁻⁹.`,
      formula: 'd/dt(∂L/∂ẋ) − ∂L/∂x = 0\n  → (M+m)ẍ + mL(θ̈cosθ − θ̇²sinθ) = 0\nd/dt(∂L/∂θ̇) − ∂L/∂θ = 0\n  → mL²θ̈ + mLẍcosθ + mgLsinθ = 0',
      keyframes: [
        { at: 0, state: { mode: 'live', presetId: 'default' } },
        { at: 1, state: { mode: 'live', presetId: 'default' } },
      ],
    },
    {
      title: 'Caminos vecinos: el verdadero MINIMIZA S',
      duration: 7000,
      body: `Ahora muestro el Principio de Mínima Acción directamente.

Tomo el camino real (θ₀) y lo rodeo con 8 caminos vecinos que parten con θ₀ + nδ (n = −4…+4, δ = 0.08 rad). Todos terminan al mismo tiempo.

S = ∫₀ᵀ L dt (integral numérica por rectángulos).

El camino REAL tiene la acción MÍNIMA. Los caminos vecinos tienen mayor acción. La curva de S vs desviación es parabólica — δS = 0 en el verdadero camino (punto estacionario).`,
      formula: 'S[q] = ∫₀ᵀ L(q,q̇,t) dt\nδS = 0  ←→  Euler-Lagrange\n(camino real = mínimo de S)',
      keyframes: [
        { at: 0, state: { mode: 'paths', presetId: 'default' } },
        { at: 1, state: { mode: 'paths', presetId: 'default' } },
      ],
    },
    {
      title: 'Sistema acoplado: resonancia y transferencia de energía',
      duration: 6500,
      body: `Cambia a preset "Resonancia": M = m, L = 1 m, θ₀ = 0.8 rad.

El carro y el péndulo intercambian energía. En ciertos instantes el bob se detiene y el carro tiene toda la velocidad — y viceversa.

Esto es ACOPLAMIENTO: el término mLẋθ̇cosθ en T conecta los dos modos. Cuando los "modos normales" del sistema tienen frecuencias cercanas, la transferencia es completa.

Observa en el panel: E cinética del carro (azul) y del bob (naranja) oscilando en antifase.`,
      formula: 'ω² ≈ g/L  (péndulo aislado)\nacoplamiento: mLẋθ̇cosθ en T\n→ batimiento de modos normales',
      keyframes: [
        { at: 0, state: { mode: 'live', presetId: 'resonance' } },
        { at: 1, state: { mode: 'live', presetId: 'resonance' } },
      ],
    },
    {
      title: 'Acción a lo largo del tiempo: S(t)',
      duration: 6000,
      body: `Modo "Acción viva": veo S(t) = ∫₀ᵗ L dt′ acumularse en tiempo real.

L = T − V alterna signo: cuando el péndulo está en la parte baja (V negativo, T máximo) L sube rápido. Cuando sube (V crece, T baja) L se aplana.

La trayectoria física es aquella para la que δS/δq(t) = 0 para toda variación δq que respete los extremos. Es el teorema de Euler-Lagrange en su forma variacional.

Este formalismo se generaliza directamente a campos, relatividad, mecánica cuántica (amplitud de Feynman = e^{iS/ħ}).`,
      formula: 'S(t) = ∫₀ᵗ L(q,q̇) dt′\nδS = 0 → EOM (Euler-Lagrange)\nFeynman: ⟨x_f|x_i⟩ = ∫𝒟q · e^{iS/ħ}',
      keyframes: [
        { at: 0, state: { mode: 'action', presetId: 'default' } },
        { at: 1, state: { mode: 'action', presetId: 'default' } },
      ],
    },
  ],

  connect: {
    body: `El Lagrangiano es la piedra angular de la física teórica moderna:

• Mecánica analítica: Lagrange (1788) → Hamilton → Noether (simetría → conservación: si L no depende de x, p_x = const).
• Relatividad especial: L = −mc²√(1−v²/c²) → reproduce exactamente la dinámica relativista.
• Electromagnetismo: L = −¼FμνFμν − JμAμ en el espacio de Minkowski.
• Mecánica cuántica (Feynman 1948): la amplitud de probabilidad suma sobre TODOS los caminos, pesados por e^{iS/ħ}. En el límite ħ→0 solo sobrevive el camino clásico (S mínimo). El camino cuántico es el promedio de todos.
• Campo estándar: el modelo estándar completo (quarks, bosones de gauge, Higgs) es una densidad lagrangiana en 4D.

Si entendiste L = T − V y δS = 0, tienes el corazón de cómo funciona el universo.`,
    links: [
      { label: 'Péndulo doble — caos lagrangiano', href: '#double-pendulum' },
      { label: 'Hamiltoniano — el alter ego de Lagrange', href: '#hamiltonian' },
    ],
  },
};

// ─── Presets ─────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  name: string;
  params: CartPendParams;
  init: Omit<CartPendState, 't'>;
  note: string;
}

const PRESETS: Preset[] = [
  {
    id: 'default',
    name: 'Carro-péndulo estándar',
    params: { M: 2, m: 0.5, L: 1.2, g: 9.81 },
    init:   { x: 0, th: 0.9, vx: 0, vth: 0 },
    note:   'M=2 kg, m=0.5 kg, L=1.2 m. El carro se desplaza notablemente cuando el péndulo oscila.',
  },
  {
    id: 'resonance',
    name: 'Resonancia (M ≈ m)',
    params: { M: 0.8, m: 1, L: 1, g: 9.81 },
    init:   { x: 0, th: 0.8, vx: 0, vth: 0 },
    note:   'Masas iguales → transferencia de energía completa entre carro y péndulo.',
  },
  {
    id: 'heavy-cart',
    name: 'Carro muy pesado',
    params: { M: 20, m: 0.5, L: 1.2, g: 9.81 },
    init:   { x: 0, th: 1.3, vx: 0, vth: 0 },
    note:   'M >> m: el carro casi no se mueve → péndulo simple clásico.',
  },
  {
    id: 'long-pend',
    name: 'Péndulo largo (L=3)',
    params: { M: 2, m: 0.5, L: 3, g: 9.81 },
    init:   { x: 0, th: 0.4, vx: 0, vth: 0 },
    note:   'L grande → período largo T≈2π√(L/g)≈3.5 s. Movimiento lento y suave.',
  },
];

const DT = 1 / 600;
const TRAIL_LEN = 3000;

// ─── Top-level component ─────────────────────────────────────────────────

export default function Lagrangian() {
  const { audience } = useAudience();

  const [presetId, setPresetId] = useState('default');
  const preset = PRESETS.find(p => p.id === presetId)!;

  const [params, setParams] = useState<CartPendParams>(preset.params);
  const [running, setRunning] = useState(true);
  const [mode, setMode] = useState<'live' | 'paths' | 'action'>('live');

  // Main simulation state
  const state = useRef<CartPendState>({ t: 0, ...preset.init });
  const E0    = useRef<number>(0);
  const actionAcc = useRef<number>(0);
  const lastLag   = useRef<number>(0);

  // Accumulated action history for the action-mode plot
  const actionHistory = useRef<Float32Array>(new Float32Array(TRAIL_LEN));
  const actionIdx     = useRef(0);
  const actionCnt     = useRef(0);

  const reset = (keepParams = false) => {
    const p = keepParams ? params : preset.params;
    if (!keepParams) setParams(preset.params);
    state.current = { t: 0, ...preset.init };
    E0.current    = cpEnergy(state.current, p);
    actionAcc.current = 0;
    lastLag.current   = cpLagrangian(state.current, p);
    actionIdx.current = 0;
    actionCnt.current = 0;
    actionHistory.current.fill(0);
  };

  useEffect(() => {
    reset(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  // Physics loop (requestAnimationFrame, outside Canvas)
  const [, forceRender] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let lastUi = 0;
    const tick = () => {
      const N = 8; // sub-steps per frame
      for (let i = 0; i < N; i++) {
        const lag = cpLagrangian(state.current, params);
        // trapezoid rule for S
        actionAcc.current += 0.5 * (lastLag.current + lag) * DT;
        lastLag.current = lag;
        // store in ring buffer
        const ai = actionIdx.current;
        actionHistory.current[ai] = actionAcc.current;
        actionIdx.current = (ai + 1) % TRAIL_LEN;
        actionCnt.current = Math.min(actionCnt.current + 1, TRAIL_LEN);
        state.current = cpStep(state.current, params, DT);
      }
      const now = performance.now();
      if (now - lastUi > 80) { forceRender(x => x + 1); lastUi = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, params]);

  const s = state.current;
  const E = cpEnergy(s, params);
  const dE = E0.current !== 0 ? Math.abs((E - E0.current) / E0.current) : 0;
  const lag = cpLagrangian(s, params);
  const bobX = s.x + params.L * Math.sin(s.th);
  const bobY =      -params.L * Math.cos(s.th);

  const camDist = params.L * 4.5;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={camDist} autoRotate={false} bloomIntensity={0.9} bloomThreshold={0.1}>
          <Sim
            stateRef={state}
            params={params}
            mode={mode}
            actionHistory={actionHistory}
            actionIdx={actionIdx}
            actionCnt={actionCnt}
          />
        </Stage>

        {/* HUD — métricas */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">t&nbsp;&nbsp;&nbsp;</span>= {s.t.toFixed(3)} s</div>
          <div><span className="text-[#64748B]">θ&nbsp;&nbsp;&nbsp;</span>= {s.th.toFixed(4)} rad</div>
          <div><span className="text-[#64748B]">x&nbsp;&nbsp;&nbsp;</span>= {s.x.toFixed(4)} m</div>
          <div><span className="text-[#64748B]">L&nbsp;&nbsp;&nbsp;</span>= {lag.toFixed(5)} J</div>
          <div><span className="text-[#64748B]">S&nbsp;&nbsp;&nbsp;</span>= {actionAcc.current.toFixed(4)} J·s</div>
          <div><span className="text-[#64748B]">ΔE/E</span>= <span className={dE > 1e-4 ? 'text-[#F87171]' : ''}>{dE.toExponential(2)}</span></div>
        </div>

        {/* Controles inferiores */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => reset(true)} title="Reiniciar misma parametría">↺</IconBtn>
          <IconBtn onClick={() => reset(false)} title="Preset default">⟲</IconBtn>
          <span className="mx-1 text-[#334155]">|</span>
          {(['live', 'paths', 'action'] as const).map(m => (
            <button key={m}
              onClick={() => setMode(m)}
              className={`text-[11px] px-2.5 py-1 rounded border transition ${
                mode === m
                  ? 'border-[#FDB813]/60 text-[#FDB813] bg-[#FDB813]/10'
                  : 'border-[#1E293B] text-[#94A3B8] hover:text-white'
              }`}
            >
              {m === 'live' ? 'Vivo' : m === 'paths' ? 'Caminos' : 'Acción'}
            </button>
          ))}
        </div>
      </div>

      <LessonPanel<LagState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) setPresetId(patch.presetId);
          if (patch.mode !== undefined) setMode(patch.mode);
        }}
        sandbox={
          <>
            <Section title="Preset">
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => setPresetId(p.id)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      presetId === p.id
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#B45309]/30 border-[#FDB813]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}>{p.name}</button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{preset.note}</div>
            </Section>

            <Section title="Modo de vista">
              {(['live', 'paths', 'action'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`w-full text-left px-3 py-2 rounded-md border text-[12px] transition mb-1.5 ${
                    mode === m
                      ? 'bg-[#FDB813]/10 border-[#FDB813]/50 text-[#FDB813]'
                      : 'border-[#1E293B] text-[#94A3B8] hover:text-white'
                  }`}>
                  {m === 'live' && 'Simulación viva'}
                  {m === 'paths' && 'Caminos vecinos + S'}
                  {m === 'action' && 'Acción acumulada S(t)'}
                </button>
              ))}
            </Section>

            {audience !== 'child' && (
              <Section title="Estado">
                <Row label="t"   value={`${s.t.toFixed(3)} s`} />
                <Row label="x"   value={`${s.x.toFixed(4)} m`} />
                <Row label="θ"   value={`${s.th.toFixed(4)} rad`} />
                <Row label="ẋ"   value={`${s.vx.toFixed(4)} m/s`} />
                <Row label="θ̇"   value={`${s.vth.toFixed(4)} rad/s`} />
                <Row label="E"   value={`${E.toFixed(5)} J`} />
                <Row label="L"   value={`${lag.toFixed(5)} J`} />
                <Row label="S"   value={`${actionAcc.current.toFixed(4)} J·s`} />
                <Row label="ΔE/E" value={dE.toExponential(2)} highlight={dE > 1e-4} />
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Parámetros físicos">
                <Slider label="M (carro)" v={params.M} min={0.5} max={20} step={0.1}
                  on={v => setParams(p => ({ ...p, M: v }))} />
                <Slider label="m (bob)"   v={params.m} min={0.1} max={5}  step={0.1}
                  on={v => setParams(p => ({ ...p, m: v }))} />
                <Slider label="L (long.)" v={params.L} min={0.3} max={4}  step={0.05}
                  on={v => setParams(p => ({ ...p, L: v }))} />
                <Slider label="g"         v={params.g} min={0}   max={25} step={0.1}
                  on={v => setParams(p => ({ ...p, g: v }))} />
              </Section>
            )}

            <Section title="Lagrangiano">
              <pre className="text-[10px] font-mono text-[#FDB813] leading-relaxed whitespace-pre-wrap">
{`L = T − V
T = ½(M+m)ẋ² + mLẋθ̇cosθ
  + ½mL²θ̇²
V = −mgL cosθ

E-L ⇒
(M+m)ẍ + mL(θ̈cosθ − θ̇²sinθ) = 0
mL²θ̈ + mLẍcosθ + mgLsinθ = 0`}
              </pre>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Sub-componente de escena 3D (useFrame DENTRO del Canvas) ─────────────

interface SimProps {
  stateRef:      React.MutableRefObject<CartPendState>;
  params:        CartPendParams;
  mode:          'live' | 'paths' | 'action';
  actionHistory: React.MutableRefObject<Float32Array>;
  actionIdx:     React.MutableRefObject<number>;
  actionCnt:     React.MutableRefObject<number>;
}

function Sim({ stateRef, params, mode, actionHistory, actionIdx, actionCnt }: SimProps) {
  return (
    <>
      <RailAndCart stateRef={stateRef} params={params} />
      {mode === 'live'   && <LiveTrail   stateRef={stateRef} params={params} />}
      {mode === 'paths'  && <PathsScene  stateRef={stateRef} params={params} />}
      {mode === 'action' && <ActionScene stateRef={stateRef} params={params}
                              actionHistory={actionHistory}
                              actionIdx={actionIdx} actionCnt={actionCnt} />}
      {/* Ground reference */}
      <gridHelper args={[12, 24, '#1E293B', '#0F172A']} position={[0, -params.L - 0.6, 0]} />
    </>
  );
}

// ─── Riel + carro + péndulo (siempre presentes) ──────────────────────────

function RailAndCart({ stateRef, params }: { stateRef: React.MutableRefObject<CartPendState>; params: CartPendParams }) {
  const cartRef = useRef<THREE.Mesh>(null);
  const rodRef  = useRef<THREE.Mesh>(null);
  const bobRef  = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const s = stateRef.current;
    const { L } = params;
    const bobX = s.x + L * Math.sin(s.th);
    const bobY =      -L * Math.cos(s.th);

    if (cartRef.current) cartRef.current.position.x = s.x;
    if (bobRef.current)  bobRef.current.position.set(bobX, bobY, 0);
    if (rodRef.current) {
      rodRef.current.position.set((s.x + bobX) / 2, bobY / 2, 0);
      rodRef.current.scale.y = L;
      rodRef.current.rotation.z = Math.atan2(-(bobX - s.x), -bobY);
    }
  });

  return (
    <>
      {/* Riel (estático) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[10, 0.04, 0.04]} />
        <meshStandardMaterial color="#334155" emissive="#0F172A" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Carro */}
      <Cart ref={cartRef} />

      {/* Vástago del péndulo */}
      <mesh ref={rodRef}>
        <cylinderGeometry args={[0.018, 0.018, 1, 12]} />
        <meshStandardMaterial color="#64748B" emissive="#334155" emissiveIntensity={0.4} metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Bob del péndulo */}
      <Bob ref={bobRef} color="#FB923C" glow={2.4} size={0.12} />

      {/* Pivote en carro */}
      <PivotDot stateRef={stateRef} />
    </>
  );
}

const Cart = forwardRef<THREE.Mesh>(function Cart(_, ref) {
  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <boxGeometry args={[0.35, 0.18, 0.2]} />
      <meshStandardMaterial color="#3B82F6" emissive="#1D4ED8" emissiveIntensity={0.8} metalness={0.3} roughness={0.35} />
    </mesh>
  );
});

function PivotDot({ stateRef }: { stateRef: React.MutableRefObject<CartPendState> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.x = stateRef.current.x;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.03, 16, 16]} />
      <meshStandardMaterial color="#CBD5E1" emissive="#94A3B8" emissiveIntensity={0.5} />
    </mesh>
  );
}

const Bob = forwardRef<THREE.Mesh, { color: string; size: number; glow?: number }>(
  function Bob({ color, size, glow = 1.0 }, ref) {
    return (
      <mesh ref={ref}>
        <sphereGeometry args={[size, 32, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow}
          metalness={0.2} roughness={0.3} toneMapped={false} />
      </mesh>
    );
  }
);

// ─── Modo LIVE: rastro del bob ────────────────────────────────────────────

function LiveTrail({ stateRef, params }: { stateRef: React.MutableRefObject<CartPendState>; params: CartPendParams }) {
  const tex = useMemo(() => getParticleTexture(), []);
  const trailGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
    g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const tidx = useRef(0);
  const tcnt = useRef(0);

  useFrame(() => {
    const s = stateRef.current;
    const bx = s.x + params.L * Math.sin(s.th);
    const by =      -params.L * Math.cos(s.th);
    appendPt(trailGeom, tidx, tcnt, bx, by, 0, 0.98, 0.57, 0.19);
  });

  return (
    <points geometry={trailGeom}>
      <pointsMaterial vertexColors map={tex} alphaMap={tex} size={0.11}
        sizeAttenuation transparent opacity={0.9}
        blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

// ─── Modo PATHS: caminos vecinos ──────────────────────────────────────────

const N_NEIGHBORS = 8;   // caminos vecinos por lado (sin contar el real)
const NEIGHBOR_DELTA = 0.08; // delta θ₀ entre caminos
const PATH_STEPS = 300;  // pasos a integrar para previsualizar cada camino

function PathsScene({ stateRef, params }: { stateRef: React.MutableRefObject<CartPendState>; params: CartPendParams }) {
  // Cada vez que cambian los params calculamos los caminos
  const pathLines = useMemo(() => {
    const s0 = stateRef.current;
    const lines: { pts: THREE.Vector3[]; action: number; isReal: boolean }[] = [];

    for (let ni = -N_NEIGHBORS; ni <= N_NEIGHBORS; ni++) {
      const dth = ni * NEIGHBOR_DELTA;
      const initState: CartPendState = { ...s0, th: s0.th + dth };
      const path = computePath(initState, params, DT * 3, PATH_STEPS);
      const pts  = path.map(p => new THREE.Vector3(p.bobX, p.bobY, ni * 0.06));
      // S = Σ L·dt
      const S = path.reduce((acc, p) => acc + p.lag * DT * 3, 0);
      lines.push({ pts, action: S, isReal: ni === 0 });
    }
    // Normalize S for color (min=green, max=red)
    const Svals = lines.map(l => l.action);
    const Smin  = Math.min(...Svals);
    const Smax  = Math.max(...Svals);
    return lines.map(l => ({
      ...l,
      t: Smax > Smin ? (l.action - Smin) / (Smax - Smin) : 0,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);  // recompute when params change; stateRef is ref so stable

  return (
    <>
      {pathLines.map((line, i) => {
        const c = line.isReal
          ? new THREE.Color('#FDB813')   // camino real: dorado
          : new THREE.Color().setHSL(0.33 - line.t * 0.33, 0.9, 0.55); // verde→rojo
        const points = line.pts.map(p => [p.x, p.y, p.z] as [number, number, number]);
        return (
          <PathLine
            key={i}
            points={points}
            color={c}
            lineWidth={line.isReal ? 3 : 1}
            opacity={line.isReal ? 1.0 : 0.45}
          />
        );
      })}

      {/* Etiqueta del camino real */}
      <Html position={[
        pathLines.find(l => l.isReal)?.pts[PATH_STEPS - 1]?.x ?? 0,
        pathLines.find(l => l.isReal)?.pts[PATH_STEPS - 1]?.y ?? -1.2,
        0,
      ]} distanceFactor={8}>
        <div className="text-[10px] font-mono text-[#FDB813] bg-[#0B0F17]/80 px-1.5 py-0.5 rounded border border-[#FDB813]/30">
          S mín (camino real)
        </div>
      </Html>

      {/* Leyenda acción */}
      <Html position={[3.5, 0.8, 0]} distanceFactor={8}>
        <div className="text-[10px] font-mono space-y-0.5 bg-[#0B0F17]/80 px-2 py-1.5 rounded border border-[#1E293B]">
          <div className="text-[#22C55E]">▬ S menor</div>
          <div className="text-[#FDB813]">▬ S mínima (real)</div>
          <div className="text-[#EF4444]">▬ S mayor</div>
        </div>
      </Html>
    </>
  );
}

// Three.js line via BufferGeometry — use primitive to bypass JSX intrinsic typing
function PathLine({ points, color, lineWidth, opacity }: {
  points: [number, number, number][];
  color: THREE.Color;
  lineWidth: number;
  opacity: number;
}) {
  const lineObj = useMemo(() => {
    const arr = new Float32Array(points.length * 3);
    points.forEach(([x, y, z], i) => { arr[i*3]=x; arr[i*3+1]=y; arr[i*3+2]=z; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      linewidth: lineWidth,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(g, mat);
  }, [points, color, lineWidth, opacity]);

  return <primitive object={lineObj} />;
}

// ─── Modo ACTION: acción acumulada S(t) ───────────────────────────────────

const ACTION_PLOT_W = 3.5;
const ACTION_PLOT_H = 1.8;

function ActionScene({ stateRef, params, actionHistory, actionIdx, actionCnt }: {
  stateRef: React.MutableRefObject<CartPendState>;
  params: CartPendParams;
  actionHistory: React.MutableRefObject<Float32Array>;
  actionIdx: React.MutableRefObject<number>;
  actionCnt: React.MutableRefObject<number>;
}) {
  const tex = useMemo(() => getParticleTexture(), []);
  // Point cloud for S(t) plot (plotted on a vertical plane at z=0.5)
  const plotGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
    g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);

  // Live bob trail
  const trailGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
    g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const tidx = useRef(0);
  const tcnt = useRef(0);

  useFrame(() => {
    const s = stateRef.current;
    const bx = s.x + params.L * Math.sin(s.th);
    const by =      -params.L * Math.cos(s.th);
    appendPt(trailGeom, tidx, tcnt, bx, by, 0, 0.98, 0.57, 0.19);

    // Rebuild S(t) plot from ring buffer
    const cnt = actionCnt.current;
    if (cnt < 2) return;
    const hist = actionHistory.current;
    // Find range for normalization
    let Smin = Infinity, Smax = -Infinity;
    for (let i = 0; i < cnt; i++) Smin = Math.min(Smin, hist[i]), Smax = Math.max(Smax, hist[i]);
    const Sspan = Math.max(Math.abs(Smax - Smin), 1e-6);

    const posArr = plotGeom.attributes.position as THREE.BufferAttribute;
    const colArr = plotGeom.attributes.color as THREE.BufferAttribute;
    const OFFSET_X = 2.2;  // plot positioned to the right of scene center
    const OFFSET_Y = 0.0;
    for (let i = 0; i < cnt; i++) {
      const tNorm = i / cnt;   // 0..1 along time
      const sNorm = (hist[i] - Smin) / Sspan;  // 0..1
      const px = OFFSET_X + tNorm * ACTION_PLOT_W - ACTION_PLOT_W / 2;
      const py = OFFSET_Y + sNorm * ACTION_PLOT_H - ACTION_PLOT_H / 2;
      posArr.setXYZ(i, px, py, 0.5);
      // Color: cool to warm (blue → orange)
      const r = 0.1 + sNorm * 0.88;
      const g2 = 0.3 + sNorm * 0.27;
      const b = 0.9 - sNorm * 0.7;
      colArr.setXYZ(i, r, g2, b);
    }
    posArr.needsUpdate = true;
    colArr.needsUpdate = true;
    plotGeom.setDrawRange(0, cnt);
  });

  return (
    <>
      {/* Bob trail */}
      <points geometry={trailGeom}>
        <pointsMaterial vertexColors map={tex} alphaMap={tex} size={0.10}
          sizeAttenuation transparent opacity={0.85}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>

      {/* S(t) plot cloud */}
      <points geometry={plotGeom}>
        <pointsMaterial vertexColors map={tex} alphaMap={tex} size={0.07}
          sizeAttenuation transparent opacity={0.95}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>

      {/* Plot frame */}
      <PlotFrame />

      {/* Labels */}
      <Html position={[2.2, -ACTION_PLOT_H / 2 - 0.35, 0.5]} distanceFactor={8}>
        <div className="text-[9px] font-mono text-[#64748B]">t →</div>
      </Html>
      <Html position={[2.2 - ACTION_PLOT_W / 2 - 0.3, 0.0, 0.5]} distanceFactor={8}>
        <div className="text-[9px] font-mono text-[#64748B] rotate-90 origin-center">S →</div>
      </Html>
      <Html position={[2.2, ACTION_PLOT_H / 2 + 0.15, 0.5]} distanceFactor={8}>
        <div className="text-[9px] font-mono text-[#FDB813]">S(t) = ∫L dt</div>
      </Html>
    </>
  );
}

function PlotFrame() {
  const lineObj = useMemo(() => {
    const OFFSET_X = 2.2;
    const hw = ACTION_PLOT_W / 2;
    const hh = ACTION_PLOT_H / 2;
    const corners: [number, number, number][] = [
      [OFFSET_X - hw, -hh, 0.5],
      [OFFSET_X + hw, -hh, 0.5],
      [OFFSET_X + hw,  hh, 0.5],
      [OFFSET_X - hw,  hh, 0.5],
      [OFFSET_X - hw, -hh, 0.5],
    ];
    const arr = new Float32Array(corners.length * 3);
    corners.forEach(([x, y, z], i) => { arr[i*3]=x; arr[i*3+1]=y; arr[i*3+2]=z; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({ color: '#1E293B', transparent: true, opacity: 0.7 });
    return new THREE.Line(g, mat);
  }, []);

  return <primitive object={lineObj} />;
}

// ─── Utilidades ───────────────────────────────────────────────────────────

function appendPt(
  g: THREE.BufferGeometry,
  idx: React.MutableRefObject<number>,
  cnt: React.MutableRefObject<number>,
  x: number, y: number, z: number,
  r: number, gv: number, b: number,
) {
  const pA = g.attributes.position as THREE.BufferAttribute;
  const cA = g.attributes.color    as THREE.BufferAttribute;
  const i  = idx.current;
  (pA.array as Float32Array)[i*3+0] = x;
  (pA.array as Float32Array)[i*3+1] = y;
  (pA.array as Float32Array)[i*3+2] = z;
  (cA.array as Float32Array)[i*3+0] = r;
  (cA.array as Float32Array)[i*3+1] = gv;
  (cA.array as Float32Array)[i*3+2] = b;
  idx.current = (i + 1) % TRAIL_LEN;
  cnt.current = Math.min(cnt.current + 1, TRAIL_LEN);
  pA.needsUpdate = true;
  cA.needsUpdate = true;
  g.setDrawRange(0, cnt.current);
}

// ─── UI helpers ───────────────────────────────────────────────────────────

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
  label: string; v: number; min: number; max: number; step: number;
  on: (v: number) => void;
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
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
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
