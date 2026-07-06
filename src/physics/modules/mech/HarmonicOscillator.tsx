/**
 * Oscilador armónico forzado y amortiguado — SHM real en 3D.
 *
 * Ecuación física:  m x¨ = -k x - b x˙ + F₀ cos(ωt)
 *
 * Solución estacionaria (estado estable, ζ < 1):
 *   A(ω) = F₀ / √[ (k − mω²)² + (bω)² ]
 *   φ(ω) = atan2(bω, k − mω²)
 *
 * Resonancia exacta en  ω₀ = √(k/m).
 * Amplitud de resonancia: A(ω₀) = F₀/(bω₀).
 *
 * Integración RK4 (dt fijo, 20 sub-pasos por frame) para la dinámica
 * transitoria real. La curva de resonancia se calcula analíticamente.
 *
 * Escena 3D:
 *   - Resorte helicoidal 3D (tubo procedural, punto a punto).
 *   - Masa esférica emisiva que oscila con bloom.
 *   - Point cloud del rastro de la masa.
 *   - Curva de resonancia como puntos en 3D (eje X = ω, eje Y = A).
 *   - Marcador en la curva que sigue al ω actual.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface HOState {
  x: number;   // posición (m)
  v: number;   // velocidad (m/s)
  t: number;   // tiempo (s)
}

interface HOParams {
  m: number;   // masa (kg)
  k: number;   // constante de resorte (N/m)
  b: number;   // amortiguamiento (N·s/m)
  F0: number;  // amplitud de fuerza externa (N)
  omega: number; // frecuencia de excitación (rad/s)
}

// ─── RK4 ───────────────────────────────────────────────────────────────────

function deriv(s: HOState, p: HOParams): { dx: number; dv: number } {
  const { x, v, t } = s;
  const { m, k, b, F0, omega } = p;
  const ax = (-k * x - b * v + F0 * Math.cos(omega * t)) / m;
  return { dx: v, dv: ax };
}

function rk4Step(s: HOState, p: HOParams, dt: number): HOState {
  const k1 = deriv(s, p);
  const s2: HOState = { x: s.x + k1.dx * dt / 2, v: s.v + k1.dv * dt / 2, t: s.t + dt / 2 };
  const k2 = deriv(s2, p);
  const s3: HOState = { x: s.x + k2.dx * dt / 2, v: s.v + k2.dv * dt / 2, t: s.t + dt / 2 };
  const k3 = deriv(s3, p);
  const s4: HOState = { x: s.x + k3.dx * dt, v: s.v + k3.dv * dt, t: s.t + dt };
  const k4 = deriv(s4, p);
  return {
    x: s.x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
    v: s.v + (dt / 6) * (k1.dv + 2 * k2.dv + 2 * k3.dv + k4.dv),
    t: s.t + dt,
  };
}

// ─── Física analítica ───────────────────────────────────────────────────────

function omega0(p: HOParams) { return Math.sqrt(p.k / p.m); }
function zeta(p: HOParams)   { return p.b / (2 * Math.sqrt(p.k * p.m)); }

/** Amplitud estacionaria analítica A(ω) */
function amplitudeAt(omega: number, p: HOParams): number {
  const w0 = omega0(p);
  const denom = Math.sqrt(
    Math.pow(p.k - p.m * omega * omega, 2) + Math.pow(p.b * omega, 2),
  );
  return denom < 1e-12 ? 1e6 : p.F0 / denom;
}

// ─── Lesson ────────────────────────────────────────────────────────────────

interface HMLessonState {
  presetId: string;
}

const LESSON: Lesson<HMLessonState> = {
  hook: {
    title: 'La frecuencia correcta rompe una copa de cristal. Esta es la física.',
    body: `En 1940 el puente Tacoma Narrows colapsó oscilando. El viento no tenía ni la mitad de la fuerza para romperlo por carga estática.

Pero tenía EXACTAMENTE la frecuencia correcta.

Eso es resonancia. Toda estructura tiene una frecuencia natural ω₀ = √(k/m). Si la empujas en esa frecuencia, la energía se acumula sin límite (en sistemas sin amortiguamiento). Con amortiguamiento pequeño, la amplitud llega a F₀/(b·ω₀) — puede ser CIENTOS de veces la fuerza que aplicas.

Esta es la ecuación que rige puentes, copas de vino, MRI, relojes atómicos y el corazón humano.`,
  },

  steps: [
    {
      title: 'Sistema libre — oscilación natural ω₀',
      duration: 5500,
      body: `Sin fuerza externa (F₀ = 0) y sin amortiguamiento (b = 0), el sistema oscila PARA SIEMPRE en su frecuencia natural.

ω₀ = √(k/m). Con k=4, m=1: ω₀ = 2 rad/s → período T = π ≈ 3.14 s.

La solución analítica es x(t) = A cos(ω₀ t + φ). La energía mecánica E = ½mv² + ½kx² se conserva exactamente. La curva de resonancia es una delta de Dirac — pico infinito en ω₀.

El RK4 conserva la energía al nivel de la precisión de máquina (ΔE/E < 10⁻¹⁰ por paso de dt=0.001 s).`,
      formula: 'ω₀ = √(k/m)\nT = 2π/ω₀\nE = ½mv² + ½kx² = constante',
      keyframes: [
        { at: 0, state: { presetId: 'libre' } },
        { at: 1, state: { presetId: 'libre' } },
      ],
    },
    {
      title: 'Amortiguamiento — energía que se disipa',
      duration: 5500,
      body: `Con b > 0, la energía se disipa como calor por fricción viscosa (−b·ẋ). La oscilación DECAE exponencialmente.

La envolvente es A·e^(−ζω₀t) donde ζ = b/(2√km). Para ζ < 1: subamortiguado (oscila y decae). ζ = 1: críticamente amortiguado (retorno más rápido sin oscilar). ζ > 1: sobreamortiguado.

La frecuencia de oscilación amortiguada es ωd = ω₀√(1−ζ²) — ligeramente menor que ω₀.

Aplicación clave: los amortiguadores de los autos ajustan ζ ≈ 0.3–0.7 para suavizar baches sin oscilar.`,
      formula: 'x(t) = A·e^(−ζω₀t)·cos(ωd t + φ)\nωd = ω₀√(1−ζ²)\nζ = b/(2√km)',
      keyframes: [
        { at: 0, state: { presetId: 'amortiguado' } },
        { at: 1, state: { presetId: 'amortiguado' } },
      ],
    },
    {
      title: 'Forzado — la curva de resonancia',
      duration: 6000,
      body: `Con F₀ cos(ωt), el sistema alcanza un ESTADO ESTABLE donde oscila a la frecuencia de excitación ω.

La amplitud estacionaria es A(ω) = F₀/√[(k−mω²)² + (bω)²].

En la escena 3D verás la CURVA DE RESONANCIA completa (eje horizontal = ω, eje vertical = amplitud). El marcador naranja se mueve con tu slider.

El PICO está en ω ≈ ω₀ (exactamente en ω₀ si b→0). A amortiguamiento bajo (ζ ≪ 1), la amplitud en resonancia es F₀/(bω₀) — factor de calidad Q = ω₀/Δω.`,
      formula: 'A(ω) = F₀/√[(k−mω²)² + (bω)²]\nA(ω₀) = F₀/(b·ω₀)  [resonancia]\nQ = ω₀·m/b  [factor de calidad]',
      keyframes: [
        { at: 0, state: { presetId: 'resonancia' } },
        { at: 1, state: { presetId: 'resonancia' } },
      ],
    },
    {
      title: 'Resonancia exacta — acumulación de energía',
      duration: 6000,
      body: `Aquí ω = ω₀ exacto. Mirá cómo la masa acumula energía: el transitorio crece ciclo a ciclo hasta que el amortiguamiento limita la amplitud.

Con ζ pequeño, la amplitud estacionaria es F₀/(bω₀) = F₀/(2ζ k/ω₀). Para ζ = 0.05, esto es 10× mayor que la deflexión estática F₀/k.

Este factor de amplificación Q = 1/(2ζ) puede ser Q ≫ 1. En resonadores de cuarzo: Q ≈ 10⁶. En cavidades ópticas: Q ≈ 10¹⁰.

El Tacoma Narrows tenía ζ ≈ 0.001 — un Q de 500. La tormenta mantuvo la frecuencia de resonancia por 45 minutos hasta el colapso.`,
      formula: 'A_max = F₀/(b·ω₀) = Q·F₀/k\nQ = 1/(2ζ) = ω₀m/b\nTacoma: Q ≈ 500, ζ ≈ 0.001',
      keyframes: [
        { at: 0, state: { presetId: 'resonancia-exacta' } },
        { at: 1, state: { presetId: 'resonancia-exacta' } },
      ],
    },
  ],

  connect: {
    body: `El oscilador armónico forzado es el problema más importante de la física aplicada. Está en TODO:

• Ingeniería civil: diseño antisísmico (ζ óptimo para puentes y edificios).
• Electrónica: circuito LC es un oscilador armónico (L↔m, 1/C↔k, R↔b).
• Óptica cuántica: láser = cavidad resonante + bomba = forzamiento.
• MRI médico: espines de H precesando a ω₀ de Larmor + pulso de RF.
• Relojes atómicos: átomo de Cs oscila en hiperfina a 9.192 GHz → Q=10¹⁰.
• Biofísica: cóclea del oído = 3000 osciladores con ω₀ escalonados (cotopoía tonotópica).

La curva de resonancia A(ω) que ves en la escena es IDÉNTICA en todos estos sistemas — solo cambia la escala de ω y la fuente de amortiguamiento.`,
    links: [
      { label: 'Péndulo doble — caos determinista', href: '#double-pendulum' },
      { label: 'Circuito LC — resonancia EM', href: '#em-fields' },
      { label: 'Schrödinger 1D — pozo cuántico', href: '#schrodinger' },
    ],
  },
};

// ─── Presets ────────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  name: string;
  params: HOParams;
  x0: number;
  v0: number;
  note: string;
}

const BASE_K = 4;
const BASE_M = 1;
const OMEGA0 = Math.sqrt(BASE_K / BASE_M); // 2 rad/s

const PRESETS: Preset[] = [
  {
    id: 'libre',
    name: 'Libre sin amortiguamiento',
    params: { m: BASE_M, k: BASE_K, b: 0, F0: 0, omega: OMEGA0 },
    x0: 1.0, v0: 0,
    note: 'F₀=0, b=0: oscilación eterna a ω₀. Energía conservada perfectamente.',
  },
  {
    id: 'amortiguado',
    name: 'Subamortiguado (ζ = 0.15)',
    params: { m: BASE_M, k: BASE_K, b: 0.6, F0: 0, omega: OMEGA0 },
    x0: 1.5, v0: 0,
    note: 'b=0.6 → ζ=0.15. El rastro en espiral muestra la disipación de energía.',
  },
  {
    id: 'resonancia',
    name: 'Forzado — barre frecuencias',
    params: { m: BASE_M, k: BASE_K, b: 0.4, F0: 0.8, omega: OMEGA0 * 0.6 },
    x0: 0, v0: 0,
    note: 'Ajusta ω con el slider y observa la curva de resonancia en 3D.',
  },
  {
    id: 'resonancia-exacta',
    name: 'Resonancia ω = ω₀',
    params: { m: BASE_M, k: BASE_K, b: 0.2, F0: 0.5, omega: OMEGA0 },
    x0: 0, v0: 0,
    note: 'ω = ω₀ exacto, ζ = 0.05 → Q = 10. La amplitud crece hasta ~10× F₀/k.',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(x: number, d = 3) { return isFinite(x) ? x.toFixed(d) : 'NaN'; }

const TRAIL_LEN = 3000;

function makeTrailGeom() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
  g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(TRAIL_LEN * 3), 3));
  g.setDrawRange(0, 0);
  return g;
}

function appendTrail(
  g: THREE.BufferGeometry,
  idx: React.MutableRefObject<number>,
  cnt: React.MutableRefObject<number>,
  x: number, y: number, z: number,
  r: number, gn: number, b: number,
) {
  const pA = g.attributes.position as THREE.BufferAttribute;
  const cA = g.attributes.color as THREE.BufferAttribute;
  const i = idx.current;
  (pA.array as Float32Array)[i * 3 + 0] = x;
  (pA.array as Float32Array)[i * 3 + 1] = y;
  (pA.array as Float32Array)[i * 3 + 2] = z;
  (cA.array as Float32Array)[i * 3 + 0] = r;
  (cA.array as Float32Array)[i * 3 + 1] = gn;
  (cA.array as Float32Array)[i * 3 + 2] = b;
  idx.current = (i + 1) % TRAIL_LEN;
  cnt.current = Math.min(cnt.current + 1, TRAIL_LEN);
  pA.needsUpdate = true;
  cA.needsUpdate = true;
  g.setDrawRange(0, cnt.current);
}

// ─── Curva de resonancia (puntos analíticos, calculada 1 vez por params) ─────

const N_RES = 200; // puntos en la curva

function buildResonanceCurve(p: HOParams): { pts: THREE.Vector3[]; maxA: number } {
  const omegaMax = omega0(p) * 3.5;
  const pts: THREE.Vector3[] = [];
  let maxA = 0;
  for (let i = 0; i <= N_RES; i++) {
    const w = (i / N_RES) * omegaMax;
    const A = amplitudeAt(w, p);
    const clamped = Math.min(A, 8); // clamp para viz
    if (clamped > maxA) maxA = clamped;
    // Curva en el plano XZ de la escena: X = ω normalizado, Y = amplitud
    pts.push(new THREE.Vector3((w / omegaMax) * 4 - 2, clamped * 0.5 - 1.5, -3.5));
  }
  return { pts, maxA };
}

// ─── Componente top-level ──────────────────────────────────────────────────

export default function HarmonicOscillator() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState('libre');
  const preset = PRESETS.find(p => p.id === presetId)!;

  const [params, setParams] = useState<HOParams>(preset.params);
  const [running, setRunning] = useState(true);
  const [, forceRender] = useState(0);

  const state = useRef<HOState>({ x: preset.x0, v: preset.v0, t: 0 });

  const reset = (newPreset = preset, newParams = params) => {
    state.current = { x: newPreset.x0, v: newPreset.v0, t: 0 };
    forceRender(n => n + 1);
  };

  useEffect(() => {
    const p = PRESETS.find(pr => pr.id === presetId)!;
    setParams(p.params);
    state.current = { x: p.x0, v: p.v0, t: 0 };
  }, [presetId]);

  // Simulación fuera del Canvas — loop rAF
  useEffect(() => {
    if (!running) return;
    const DT = 0.001;
    const SUB = 20;
    let raf = 0;
    let lastUi = 0;
    const tick = () => {
      for (let i = 0; i < SUB; i++) {
        state.current = rk4Step(state.current, params, DT);
      }
      const now = performance.now();
      if (now - lastUi > 80) { forceRender(n => n + 1); lastUi = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, params]);

  const w0 = omega0(params);
  const z  = zeta(params);
  const E  = 0.5 * params.m * state.current.v ** 2 + 0.5 * params.k * state.current.x ** 2;
  const currentA = amplitudeAt(params.omega, params);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={7} bloomIntensity={0.9} bloomThreshold={0.10} autoRotate={false}>
          <Scene stateRef={state} params={params} />
        </Stage>

        {/* HUD telemetría */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">t&nbsp;&nbsp;&nbsp;</span>= {fmt(state.current.t, 2)} s</div>
          <div><span className="text-[#64748B]">x&nbsp;&nbsp;&nbsp;</span>= {fmt(state.current.x, 4)} m</div>
          <div><span className="text-[#64748B]">v&nbsp;&nbsp;&nbsp;</span>= {fmt(state.current.v, 4)} m/s</div>
          <div><span className="text-[#64748B]">E&nbsp;&nbsp;&nbsp;</span>= {fmt(E, 4)} J</div>
          <div><span className="text-[#64748B]">ω₀&nbsp;&nbsp;</span>= {fmt(w0, 3)} rad/s</div>
          <div><span className="text-[#64748B]">ζ&nbsp;&nbsp;&nbsp;</span>= {fmt(z, 4)}</div>
          <div><span className="text-[#64748B]">A(ω)</span>= {fmt(Math.min(currentA, 99), 3)} m</div>
        </div>

        {/* Controles play/reset */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => reset(preset, params)} title="Reiniciar">↺</IconBtn>
        </div>
      </div>

      <LessonPanel<HMLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) setPresetId(patch.presetId);
        }}
        sandbox={
          <>
            <Section title="Preset">
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPresetId(p.id)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      presetId === p.id
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{preset.note}</div>
            </Section>

            {audience === 'researcher' && (
              <Section title="Parámetros físicos">
                <Slider label="m (kg)"     v={params.m}     min={0.1}  max={5}    step={0.05} on={v => setParams(p => ({ ...p, m: v }))} />
                <Slider label="k (N/m)"    v={params.k}     min={0.5}  max={20}   step={0.1}  on={v => setParams(p => ({ ...p, k: v }))} />
                <Slider label="b (N·s/m)"  v={params.b}     min={0}    max={3}    step={0.02} on={v => setParams(p => ({ ...p, b: v }))} />
                <Slider label="F₀ (N)"     v={params.F0}    min={0}    max={5}    step={0.05} on={v => setParams(p => ({ ...p, F0: v }))} />
                <Slider label="ω (rad/s)"  v={params.omega} min={0.05} max={10}   step={0.05} on={v => setParams(p => ({ ...p, omega: v }))} />
              </Section>
            )}

            {audience !== 'child' && (
              <Section title="Derivados">
                <Row label="ω₀"    value={`${fmt(w0, 3)} rad/s`} />
                <Row label="T₀"    value={`${fmt(2 * Math.PI / w0, 3)} s`} />
                <Row label="ζ"     value={fmt(z, 4)}     highlight={z > 1} />
                <Row label="Q"     value={z > 0 ? fmt(1 / (2 * z), 2) : '∞'} />
                <Row label="A(ω)"  value={`${fmt(Math.min(currentA, 99), 3)} m`} />
                <Row label="A_max" value={`${fmt(amplitudeAt(w0, params), 3)} m`} />
              </Section>
            )}

            <Section title="Ecuación">
              <pre className="text-[10px] font-mono text-[#CBD5E1] leading-snug whitespace-pre-wrap">
{`m·x¨ = −k·x − b·ẋ + F₀cos(ωt)

A(ω) = F₀ / √[(k−mω²)²+(bω)²]
ω₀ = √(k/m) = ${fmt(w0, 3)} rad/s`}
              </pre>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D (SUB-COMPONENTE dentro del Canvas) ──────────────────────────

const SPRING_SEGS = 28;     // espirales del resorte
const SPRING_RADIUS = 0.18;
const SPRING_REST_LEN = 2.5; // longitud en reposo (unidades de escena)
const MASS_SCALE = 0.22;

function Scene({
  stateRef,
  params,
}: {
  stateRef: React.MutableRefObject<HOState>;
  params: HOParams;
}) {
  const tex = useMemo(() => getParticleTexture(), []);

  // refs de malla
  const massRef   = useRef<THREE.Mesh>(null);
  const glowRef   = useRef<THREE.Mesh>(null);
  const springRef = useRef<THREE.Line>(null);
  // THREE.Line object para el resorte (evita <line_> que no está en JSX.IntrinsicElements)
  const springLine = useMemo(() => new THREE.Line(), []);

  // trail
  const trail    = useMemo(() => makeTrailGeom(), []);
  const trailIdx = useRef(0);
  const trailCnt = useRef(0);

  // curva de resonancia — recalcular cuando cambian parámetros
  const resCurve = useMemo(() => buildResonanceCurve(params), [params]);

  // Puntos del resorte helicoidal (ring buffer reutilizable)
  const springPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= SPRING_SEGS * 12; i++) pts.push(new THREE.Vector3());
    return pts;
  }, []);

  // Marcador sobre la curva de resonancia
  const markerRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const { x } = stateRef.current;
    const N = params;

    // ── Masa y halo
    const massY = x; // oscila en Y
    if (massRef.current)  massRef.current.position.set(0, massY, 0);
    if (glowRef.current)  glowRef.current.position.set(0, massY, 0);

    // ── Resorte helicoidal procedural
    // El resorte cuelga del techo (y=3) hasta la masa (y=massY)
    const topY = 3.0;
    const botY = massY + MASS_SCALE;
    const springLen = topY - botY;
    const totalPts = SPRING_SEGS * 12 + 1;
    for (let i = 0; i <= SPRING_SEGS * 12; i++) {
      const t = i / (SPRING_SEGS * 12);
      const angle = t * SPRING_SEGS * 2 * Math.PI;
      const py = topY - t * springLen;
      const px = Math.cos(angle) * SPRING_RADIUS;
      const pz = Math.sin(angle) * SPRING_RADIUS;
      springPoints[i].set(px, py, pz);
    }
    if (springRef.current) {
      const geo = springRef.current.geometry as THREE.BufferGeometry;
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < totalPts; i++) {
        posAttr.setXYZ(i, springPoints[i].x, springPoints[i].y, springPoints[i].z);
      }
      posAttr.needsUpdate = true;
      geo.computeBoundingSphere();
    }

    // ── Rastro de la masa
    // Color: cyan en equilibrio, naranja en amplitud alta
    const amp = Math.abs(x);
    const maxX = 2.5;
    const t01 = Math.min(amp / maxX, 1);
    const r = 0.3 + 0.65 * t01;
    const g = 0.76 * (1 - t01) + 0.5 * t01;
    const b = 0.97 * (1 - t01) + 0.1 * t01;
    appendTrail(trail, trailIdx, trailCnt, 0, massY, 0, r, g, b);

    // ── Marcador sobre la curva de resonancia
    if (markerRef.current) {
      const omegaMax = omega0(N) * 3.5;
      const nx = (N.omega / omegaMax) * 4 - 2;
      const A = Math.min(amplitudeAt(N.omega, N), 8);
      const ny = A * 0.5 - 1.5;
      markerRef.current.position.set(nx, ny, -3.5);
    }
  });

  // Construir geometría + material de la línea del resorte y asignar al objeto
  const springGeo = useMemo(() => {
    const totalPts = SPRING_SEGS * 12 + 1;
    const positions = new Float32Array(totalPts * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setDrawRange(0, totalPts);
    springLine.geometry = g;
    springLine.material = new THREE.LineBasicMaterial({ color: '#4FC3F7' });
    // alias ref para reusar la lógica de update en useFrame
    (springRef as React.MutableRefObject<THREE.Line | null>).current = springLine;
    return g;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [springLine]);

  const resCurvePts = resCurve.pts;

  return (
    <>
      {/* Techo / soporte del resorte */}
      <mesh position={[0, 3.15, 0]}>
        <boxGeometry args={[0.6, 0.18, 0.6]} />
        <meshStandardMaterial color="#334155" emissive="#1E293B" emissiveIntensity={0.5} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Resorte helicoidal — primitive evita <line_> que no existe en JSX.IntrinsicElements */}
      <primitive object={springLine} />

      {/* Masa esférica — objeto principal EMISIVO */}
      <mesh ref={massRef} position={[0, 0, 0]}>
        <sphereGeometry args={[MASS_SCALE, 40, 32]} />
        <meshStandardMaterial
          color="#FDB813"
          emissive="#FDB813"
          emissiveIntensity={1.6}
          metalness={0.1}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>

      {/* Halo grande aditivo para bloom extra */}
      <mesh ref={glowRef} position={[0, 0, 0]}>
        <sphereGeometry args={[MASS_SCALE * 1.55, 24, 16]} />
        <meshStandardMaterial
          color="#FDB813"
          emissive="#FDB813"
          emissiveIntensity={0.35}
          transparent
          opacity={0.22}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Rastro de la masa */}
      <points geometry={trail}>
        <pointsMaterial
          vertexColors
          map={tex}
          alphaMap={tex}
          size={0.12}
          sizeAttenuation
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Curva de resonancia analítica en 3D */}
      <Line
        points={resCurvePts}
        color="#34D399"
        lineWidth={1.8}
        transparent
        opacity={0.85}
      />

      {/* Marcador naranja en la curva (ω actual) */}
      <mesh ref={markerRef} position={[0, -1.5, -3.5]}>
        <sphereGeometry args={[0.09, 20, 16]} />
        <meshStandardMaterial
          color="#FDB813"
          emissive="#FDB813"
          emissiveIntensity={2.0}
          toneMapped={false}
        />
      </mesh>

      {/* Ejes de la curva de resonancia */}
      <ResonanceLegend omega0={omega0(params)} params={params} />

      {/* Línea de equilibrio */}
      <Line
        points={[[-0.5, 0, 0], [0.5, 0, 0]]}
        color="#475569"
        lineWidth={1}
        transparent
        opacity={0.4}
        dashed
        dashSize={0.08}
        gapSize={0.06}
      />
    </>
  );
}

/** Etiquetas de los ejes de la curva de resonancia (HTML overlay) */
function ResonanceLegend({ omega0: w0, params }: { omega0: number; params: HOParams }) {
  // Línea vertical en ω₀
  const omegaMax = w0 * 3.5;
  const xRes = (w0 / omegaMax) * 4 - 2;

  return (
    <>
      {/* Línea vertical en ω₀ sobre la curva */}
      <Line
        points={[[xRes, -1.5, -3.5], [xRes, 2.5, -3.5]]}
        color="#FDB813"
        lineWidth={1}
        transparent
        opacity={0.4}
        dashed
        dashSize={0.12}
        gapSize={0.08}
      />
      {/* Borde/marco de la curva */}
      <Line
        points={[[-2, -1.5, -3.5], [2, -1.5, -3.5]]}
        color="#1E293B"
        lineWidth={1}
        transparent
        opacity={0.7}
      />
    </>
  );
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

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
        <span className="text-white">{v.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function IconBtn({ children, onClick, active, title }: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
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
