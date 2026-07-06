/**
 * Transformación de Lorentz — diagrama de espacio-tiempo en 3D.
 *
 * Física implementada:
 *   - Boost de Lorentz exacto: t' = γ(t − βx/c), x' = γ(x − βt·c)
 *   - Factor γ = 1/√(1−β²), donde β = v/c ∈ [0, 0.995)
 *   - Contracción de longitud: L = L₀/γ (objeto en el marco S')
 *   - Dilatación del tiempo: Δt = γ·Δτ (τ = tiempo propio en S')
 *   - Cono de luz: ct = ±x (invariante de intervalo)
 *   - La rejilla espacio-tiempo del marco S' se deforma visualmente
 *     según el ángulo de Minkowski: tan α = β → las líneas de t'
 *     y x' se acercan a la diagonal del cono de luz conforme β → 1.
 *
 * Geometría Minkowski: usamos coordenadas (x, ct) en el plano XY del
 * canvas, y Z como separador visual/estético (ligeramente inclinado para
 * dar profundidad). La rejilla S (inercial en reposo) es ortogonal;
 * la rejilla S' (boost con β) se esquila según el ángulo Minkowski.
 *
 * Visualización R3F: fondo negro, materiales EMISIVOS, bloom via Stage.
 * useFrame SOLO dentro de sub-componentes dentro del <Canvas> de <Stage>.
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface LorentzState {
  beta: number;    // v/c
  showRod: boolean;
  showClock: boolean;
}

// ─── Física real ────────────────────────────────────────────────────────────

/** γ = 1 / √(1 − β²) */
function gamma(beta: number): number {
  const b2 = Math.min(beta * beta, 0.9999);
  return 1 / Math.sqrt(1 - b2);
}

/**
 * Transforma un evento (t, x) del marco S al marco S'.
 * c = 1 (unidades naturales donde c = 1).
 */
function lorentzBoost(t: number, x: number, beta: number): [number, number] {
  const g = gamma(beta);
  const tPrime = g * (t - beta * x);
  const xPrime = g * (x - beta * t);
  return [tPrime, xPrime];
}

/**
 * Genera los vértices de la rejilla del marco S' transformada al marco S
 * para su visualización.
 *
 * Las líneas de t' = cte: en S, se ven como rectas con pendiente 1/β (en ct vs x).
 * Las líneas de x' = cte: en S, se ven como rectas con pendiente β.
 *
 * Ángulo Minkowski: tan(α) = β → cuando β→1, ambas se aproximan a 45°.
 */
function buildBoostGrid(
  beta: number,
  extent: number,
  steps: number,
): {
  tLines: THREE.Vector3[][];
  xLines: THREE.Vector3[][];
} {
  const g = gamma(beta);
  const tLines: THREE.Vector3[][] = [];
  const xLines: THREE.Vector3[][] = [];

  // Para cada valor de t' = k (líneas de t' constante):
  // En el marco S: x = x'·(1/g) + β·t,  ct = t'·(1/g) + β·x
  // Parametrizamos por x' ∈ [−extent, +extent] y obtenemos (x, ct) en S.
  for (let k = -steps; k <= steps; k++) {
    const tPrimeVal = (k / steps) * extent;
    const pts: THREE.Vector3[] = [];
    for (let j = -steps * 2; j <= steps * 2; j++) {
      const xPrimeParam = (j / (steps * 2)) * extent * 2;
      // Invertir boost: t = γ(t' + β·x'), x = γ(x' + β·t')
      const xS = g * (xPrimeParam + beta * tPrimeVal);
      const ctS = g * (tPrimeVal + beta * xPrimeParam);
      if (Math.abs(xS) <= extent * 1.5 && Math.abs(ctS) <= extent * 1.5) {
        pts.push(new THREE.Vector3(xS, ctS, 0));
      }
    }
    if (pts.length >= 2) tLines.push(pts);
  }

  // Para cada valor de x' = k (líneas de x' constante):
  for (let k = -steps; k <= steps; k++) {
    const xPrimeVal = (k / steps) * extent;
    const pts: THREE.Vector3[] = [];
    for (let j = -steps * 2; j <= steps * 2; j++) {
      const tPrimeParam = (j / (steps * 2)) * extent * 2;
      const xS = g * (xPrimeVal + beta * tPrimeParam);
      const ctS = g * (tPrimeParam + beta * xPrimeVal);
      if (Math.abs(xS) <= extent * 1.5 && Math.abs(ctS) <= extent * 1.5) {
        pts.push(new THREE.Vector3(xS, ctS, 0));
      }
    }
    if (pts.length >= 2) xLines.push(pts);
  }

  return { tLines, xLines };
}

// ─── LESSON ─────────────────────────────────────────────────────────────────

const LESSON: Lesson<LorentzState> = {
  hook: {
    title: 'El tiempo de tu reloj y el mío no son el mismo. Lorentz lo demostró en 1905.',
    body: `Imagina que viajas en una nave a 0.9c — 90% de la velocidad de la luz. Para ti, tu reloj marca el tiempo normal. Pero para mí, que estoy en reposo, tu reloj va LENTO.

No es ilusión óptica. No es error de medición. Es la geometría del espacio-tiempo: la misma que hace que una regla se contraiga en la dirección del movimiento.

La Transformación de Lorentz es la maquinaria exacta que conecta las mediciones de dos observadores inerciales. Con ella Einstein construyó la relatividad especial en 1905.

Lo que ves es el diagrama de Minkowski: el eje vertical es ct (tiempo), el horizontal es x (espacio). Las líneas de la rejilla son los ejes de coordenadas del marco en movimiento. Fíjate cómo se deforman cuando mueves β.`,
  },

  steps: [
    {
      title: 'Reposo: β=0, γ=1 — rejillas idénticas',
      duration: 5000,
      body: `Con β = 0 (sin movimiento), el factor γ = 1/√(1−0²) = 1. Las transformaciones se reducen a:

x' = x,  t' = t

No hay diferencia. Los marcos S (rejilla azul, ortogonal) y S' (rejilla ámbar) son IDÉNTICOS. Es la situación galileana clásica.

Esto confirma que Lorentz generaliza a Galileo: cuando v → 0, recuperamos la física clásica.`,
      formula: "β = 0  →  γ = 1\nx' = x\nt' = t\n(límite galileano)",
      keyframes: [
        { at: 0, state: { beta: 0.0, showRod: false, showClock: false } },
        { at: 1, state: { beta: 0.0, showRod: false, showClock: false } },
      ],
    },
    {
      title: 'β = 0.6 — los ejes se inclinan hacia el cono de luz',
      duration: 6000,
      body: `Con β = 0.6 (60% de c), el factor γ = 1/√(1−0.36) = 1.25.

Fíjate en la rejilla ámbar de S': sus ejes x' y ct' ya NO son perpendiculares entre sí. Se inclinan hacia la diagonal — la línea del cono de luz a 45°.

El ángulo de inclinación es: tan α = β = 0.6, es decir α ≈ 31°.

Este es el corazón de la geometría de Minkowski: los ejes de S' se esquilan simétricamente hacia ct = x (el rayo de luz).`,
      formula: "β = 0.6  →  γ = 1.25\ntan α = β = 0.6\nα ≈ 30.96°\n(ángulo Minkowski)",
      keyframes: [
        { at: 0, state: { beta: 0.0, showRod: false, showClock: false } },
        { at: 1, state: { beta: 0.6, showRod: false, showClock: false } },
      ],
    },
    {
      title: 'Contracción de longitud: L = L₀ / γ',
      duration: 6000,
      body: `Activo la barra roja: una regla de longitud L₀ = 2 unidades en el marco S'.

En el marco S (reposo), su longitud CONTRAÍDA es L = L₀/γ. Con β=0.8 y γ=1.67:

L = 2 / 1.67 ≈ 1.20 unidades

La barra es más corta en S que en S'. Pero ojo — en S' la barra tiene su longitud propia L₀=2. No hay nada "deformado" físicamente. Es pura geometría del espacio-tiempo.

La simultaneidad importa: mides ambos extremos al MISMO tiempo t en S — que corresponde a instantes DIFERENTES de t' en S'.`,
      formula: "L = L₀ / γ = L₀ √(1 − β²)\nβ=0.8 → γ=1.667\nL₀=2 → L=1.20",
      keyframes: [
        { at: 0, state: { beta: 0.6, showRod: true, showClock: false } },
        { at: 1, state: { beta: 0.8, showRod: true, showClock: false } },
      ],
    },
    {
      title: 'Dilatación del tiempo: Δt = γ · Δτ',
      duration: 6000,
      body: `El reloj verde marca el tiempo propio Δτ en S': el tiempo que pasa entre dos eventos en el mismo punto del espacio de S'.

El observador en S mide un intervalo MAYOR: Δt = γ · Δτ.

Con β = 0.9 y γ = 2.29: si el reloj en S' marca 1 segundo, el observador en S dice que pasaron 2.29 segundos.

¿Quién tiene razón? AMBOS. Cada uno mide correctamente en su propio marco. El tiempo no es absoluto — es relativo al estado de movimiento.

Paradoja del gemelo: el gemelo que viaja envejece MENOS porque su tiempo propio es menor.`,
      formula: "Δt = γ · Δτ\nβ=0.9 → γ=2.294\nΔτ=1s → Δt=2.29s\n(dilatación temporal)",
      keyframes: [
        { at: 0, state: { beta: 0.8, showRod: false, showClock: true } },
        { at: 1, state: { beta: 0.9, showRod: false, showClock: true } },
      ],
    },
    {
      title: 'β → 0.99: el cono de luz como límite absoluto',
      duration: 6000,
      body: `Con β = 0.99, γ = 7.09. Los ejes de S' están casi sobre las diagonas del cono de luz.

Para que β = 1 (velocidad de luz), necesitarías γ → ∞, lo que requiere energía infinita. Es imposible para masas positivas.

El cono de luz (líneas naranjas) divide el espacio-tiempo en tres regiones:
• Interior futuro: eventos que puedes causar
• Interior pasado: eventos que te pudieron causar
• Exterior (tipo espacio): eventos que NUNCA puedes alcanzar

La causalidad está protegida por la geometría de Lorentz.`,
      formula: "β → 1  →  γ → ∞\nE = γmc² → ∞\n(límite c: energía infinita)\nIntervalo: s² = c²t²−x²",
      keyframes: [
        { at: 0, state: { beta: 0.9, showRod: false, showClock: false } },
        { at: 1, state: { beta: 0.99, showRod: false, showClock: false } },
      ],
    },
  ],

  connect: {
    body: `La Transformación de Lorentz es el corazón de toda la física moderna post-1905:

• La mecánica cuántica relativista (Dirac 1928) requiere que la ecuación de onda sea COVARIANTE bajo Lorentz — de ahí emerge el espín del electrón y la antimateria.

• El electromagnetismo de Maxwell YA era covariante bajo Lorentz antes de Einstein. Maxwell sin saberlo tenía la relatividad especial incorporada.

• El GPS ajusta 38 microsegundos por día: 7μs por dilatación especial (satélite viaja rápido) y 45μs por dilatación gravitacional (GR). Sin Lorentz, el GPS tendría ~10 km de error por día.

• La equivalencia masa-energía E = mc² se DERIVA directamente de las transformaciones de energía y momento bajo Lorentz.

El diagrama de Minkowski que acabas de ver es la geometría subyacente de toda la física de partículas del siglo XX.`,
    links: [
      { label: 'Schwarzschild — curvatura del espacio-tiempo', href: '#schwarzschild' },
      { label: 'Campo electromagnético — tensor covariante', href: '#em-fields' },
      { label: 'Dilatación gravitacional — GR', href: '#cosmology' },
    ],
  },
};

// ─── Componente principal ───────────────────────────────────────────────────

export default function LorentzTransform() {
  const { audience } = useAudience();

  const [beta, setBeta] = useState(0.0);
  const [showRod, setShowRod] = useState(false);
  const [showClock, setShowClock] = useState(false);

  const g = gamma(beta);
  const contraction = 2.0 / g;        // L = L₀/γ, L₀ = 2
  const dilation = g;                  // Δt = γ·Δτ, Δτ = 1
  const angle = Math.atan(beta) * (180 / Math.PI);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      {/* Canvas 3D */}
      <div className="relative">
        <Stage cameraDistance={9} autoRotate={false} bloomIntensity={0.7} bloomThreshold={0.1}>
          <SpacetimeScene beta={beta} showRod={showRod} showClock={showClock} />
        </Stage>

        {/* HUD: métricas Lorentz */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">β    </span>= <span className="text-[#FDB813]">{beta.toFixed(3)}</span></div>
          <div><span className="text-[#64748B]">γ    </span>= <span className="text-[#4FC3F7]">{g.toFixed(4)}</span></div>
          <div><span className="text-[#64748B]">α    </span>= <span className="text-[#34D399]">{angle.toFixed(2)}°</span></div>
          {showRod   && <div><span className="text-[#64748B]">L    </span>= <span className="text-[#F87171]">{contraction.toFixed(3)} <span className="text-[#64748B]">(L₀=2.000)</span></span></div>}
          {showClock && <div><span className="text-[#64748B]">Δt   </span>= <span className="text-[#A78BFA]">{dilation.toFixed(3)} <span className="text-[#64748B]">·Δτ</span></span></div>}
        </div>

        {/* Leyenda de colores */}
        <div className="absolute top-4 right-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-3 py-2 text-[10px] space-y-1.5">
          <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-[#1E40AF] inline-block rounded" />  <span className="text-[#94A3B8]">Marco S (reposo)</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-[#FDB813] inline-block rounded" />  <span className="text-[#94A3B8]">Marco S' (boost β)</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-[#F97316] inline-block rounded" />  <span className="text-[#94A3B8]">Cono de luz</span></div>
          {showRod   && <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-[#F87171] inline-block rounded" />  <span className="text-[#94A3B8]">Regla (L={contraction.toFixed(2)})</span></div>}
          {showClock && <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-[#A78BFA] inline-block rounded" />  <span className="text-[#94A3B8]">Reloj (γ={g.toFixed(2)})</span></div>}
        </div>

        {/* Slider β */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-4 py-2.5">
          <span className="text-[11px] font-mono text-[#64748B]">β</span>
          <input
            type="range"
            min={0}
            max={0.995}
            step={0.005}
            value={beta}
            onChange={e => setBeta(Number(e.target.value))}
            className="w-44"
          />
          <span className="text-[11px] font-mono text-[#FDB813] w-12">{beta.toFixed(3)}</span>
          <button
            onClick={() => setShowRod(r => !r)}
            className={`text-[10px] px-2 py-1 rounded border transition ${showRod ? 'border-[#F87171]/60 text-[#F87171] bg-[#F87171]/10' : 'border-[#1E293B] text-[#64748B] hover:border-[#334155] hover:text-white'}`}
          >
            Regla
          </button>
          <button
            onClick={() => setShowClock(c => !c)}
            className={`text-[10px] px-2 py-1 rounded border transition ${showClock ? 'border-[#A78BFA]/60 text-[#A78BFA] bg-[#A78BFA]/10' : 'border-[#1E293B] text-[#64748B] hover:border-[#334155] hover:text-white'}`}
          >
            Reloj
          </button>
        </div>
      </div>

      {/* Panel de lección */}
      <LessonPanel<LorentzState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.beta    !== undefined) setBeta(patch.beta);
          if (patch.showRod !== undefined) setShowRod(patch.showRod);
          if (patch.showClock !== undefined) setShowClock(patch.showClock);
        }}
        sandbox={
          <>
            <Section title="Velocidad β = v/c">
              <div className="mb-3">
                <div className="flex items-baseline justify-between text-[11px] font-mono mb-1">
                  <span className="text-[#64748B]">β</span>
                  <span className="text-[#FDB813]">{beta.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.995}
                  step={0.005}
                  value={beta}
                  onChange={e => setBeta(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2">
                {([0, 0.5, 0.8, 0.9, 0.95, 0.99] as const).map(b => (
                  <button
                    key={b}
                    onClick={() => setBeta(b)}
                    className={`text-[10px] px-2 py-1 rounded border transition font-mono ${
                      Math.abs(beta - b) < 0.001
                        ? 'border-[#FDB813]/60 text-[#FDB813] bg-[#FDB813]/10'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {b}c
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Efectos">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[12px] text-[#CBD5E1] cursor-pointer">
                  <input type="checkbox" checked={showRod} onChange={e => setShowRod(e.target.checked)} className="accent-[#F87171]" />
                  <span>Regla (contracción de longitud)</span>
                </label>
                <label className="flex items-center gap-2 text-[12px] text-[#CBD5E1] cursor-pointer">
                  <input type="checkbox" checked={showClock} onChange={e => setShowClock(e.target.checked)} className="accent-[#A78BFA]" />
                  <span>Reloj (dilatación del tiempo)</span>
                </label>
              </div>
            </Section>

            <Section title="Métricas Lorentz">
              <Row label="β"     value={beta.toFixed(4)} />
              <Row label="γ"     value={g.toFixed(5)} />
              <Row label="1/γ"   value={(1/g).toFixed(5)} />
              <Row label="α"     value={`${angle.toFixed(3)}°`} />
              {showRod   && <Row label="L/L₀"  value={(1/g).toFixed(5)} highlight />}
              {showClock && <Row label="Δt/Δτ" value={g.toFixed(5)} highlight />}
              <div className="mt-2 text-[10px] text-[#64748B]">
                γ → ∞ cuando β → 1 (c imposible)
              </div>
            </Section>

            {audience === 'researcher' && (
              <Section title="Invariante de intervalo">
                <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                  <div className="text-white">s² = c²t² − x²</div>
                  <div className="text-[#64748B]">= c²t'² − x'²</div>
                  <div className="text-[#64748B] mt-1">Invariante bajo Lorentz.</div>
                  <div className="text-[#64748B]">s²&gt;0: tipo tiempo (causal)</div>
                  <div className="text-[#64748B]">s²&lt;0: tipo espacio</div>
                  <div className="text-[#64748B]">s²=0: tipo luz (cono)</div>
                </div>
              </Section>
            )}

            <Section title="Transformaciones">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div>x' = γ(x − βct)</div>
                <div>ct' = γ(ct − βx)</div>
                <div className="text-[#64748B] mt-1">Inversa:</div>
                <div>x  = γ(x' + βct')</div>
                <div>ct = γ(ct' + βx')</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D ──────────────────────────────────────────────────────────────

/**
 * SpacetimeScene — sub-componente dentro del Canvas.
 * useFrame SOLO aquí, nunca en el padre.
 */
function SpacetimeScene({
  beta,
  showRod,
  showClock,
}: {
  beta: number;
  showRod: boolean;
  showClock: boolean;
}) {
  const EXTENT = 5;
  const GRID_STEPS = 6;

  // ── Rejilla S (ortogonal, reposo) — estática, no depende de β ──────────
  const gridS = useMemo(() => {
    const lines: { pts: [number, number, number][]; color: string }[] = [];
    const n = GRID_STEPS;
    for (let k = -n; k <= n; k++) {
      const v = (k / n) * EXTENT;
      // Vertical: x = v, ct varía
      lines.push({ pts: [[v, -EXTENT, 0], [v, EXTENT, 0]], color: '#1E3A5F' });
      // Horizontal: ct = v, x varía
      lines.push({ pts: [[-EXTENT, v, 0], [EXTENT, v, 0]], color: '#1E3A5F' });
    }
    return lines;
  }, []);

  // ── Rejilla S' (boost β) — recalcular cuando β cambia ─────────────────
  const { tLines, xLines } = useMemo(
    () => buildBoostGrid(beta, EXTENT, GRID_STEPS),
    [beta],
  );

  // ── Cono de luz: ct = ±x ───────────────────────────────────────────────
  const lightCone = useMemo<[number, number, number][][]>(() => [
    [[-EXTENT, -EXTENT, 0], [EXTENT, EXTENT, 0]],   // ct = +x (futuro derecha)
    [[-EXTENT,  EXTENT, 0], [EXTENT, -EXTENT, 0]],  // ct = -x (pasado derecha)
  ], []);

  // ── Ejes principales S ─────────────────────────────────────────────────
  const axisX: [number, number, number][] = [[-EXTENT, 0, 0], [EXTENT, 0, 0]];
  const axisCT: [number, number, number][] = [[0, -EXTENT, 0], [0, EXTENT, 0]];

  // ── Ejes principales S' (boost) ────────────────────────────────────────
  // Eje x': t' = 0 → ct = β·x  → pendiente β en el plano (x, ct)
  // Eje ct': x' = 0 → x = β·ct → pendiente 1/β en el plano (x, ct)
  const axisXPrime = useMemo<[number, number, number][]>(() => {
    if (Math.abs(beta) < 0.001) return [[-EXTENT, 0, 0], [EXTENT, 0, 0]];
    return [
      [-EXTENT, -EXTENT * beta, 0],
      [ EXTENT,  EXTENT * beta, 0],
    ];
  }, [beta]);

  const axisCTPrime = useMemo<[number, number, number][]>(() => {
    if (Math.abs(beta) < 0.001) return [[0, -EXTENT, 0], [0, EXTENT, 0]];
    return [
      [-EXTENT * beta, -EXTENT, 0],
      [ EXTENT * beta,  EXTENT, 0],
    ];
  }, [beta]);

  // ── Contracción de longitud: barra en S ────────────────────────────────
  // La barra está en reposo en S'. Longitud propia L₀ = 2 en S'.
  // En S, a t = 0: de x = −L/2 a x = +L/2, con L = L₀/γ.
  const g = gamma(beta);
  const rodHalfLen = 1.0 / g; // L₀/2 = 1, contraído: 1/γ

  // ── Dilatación del tiempo: reloj en S' ────────────────────────────────
  // El evento "tick 1" del reloj propio en S' es: t' = 1, x' = 0
  // En S: ct = γ·(1 + β·0) = γ, x = γ·(0 + β·1) = γβ
  const clockTickX  = g * beta;   // posición x en S del evento
  const clockTickCT = g;          // posición ct en S del evento

  // ── Animación del reloj pulsando ───────────────────────────────────────
  const clockRef = useRef<THREE.Mesh>(null);
  const clockTime = useRef(0);

  useFrame((_, dt) => {
    if (!clockRef.current) return;
    clockTime.current += dt * 2;
    const pulse = 0.05 + 0.03 * Math.sin(clockTime.current);
    clockRef.current.scale.setScalar(1 + pulse);
    const mat = clockRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1.5 + Math.sin(clockTime.current) * 0.5;
  });

  return (
    <>
      {/* Luz de ambiente extra para los emisivos */}
      <ambientLight intensity={0.1} />

      {/* ── Rejilla S: líneas azul oscuro ───────────────────────────── */}
      {gridS.map((l, i) => (
        <Line
          key={`s-${i}`}
          points={l.pts}
          color={l.color}
          lineWidth={0.5}
          transparent
          opacity={0.7}
        />
      ))}

      {/* ── Ejes S: azul brillante ──────────────────────────────────── */}
      <Line points={axisX}  color="#4FC3F7" lineWidth={1.5} />
      <Line points={axisCT} color="#4FC3F7" lineWidth={1.5} />

      {/* ── Rejilla S': ámbar (líneas de ct' = cte) ─────────────────── */}
      {tLines.map((pts, i) => (
        <Line
          key={`tl-${i}`}
          points={pts}
          color="#FDB813"
          lineWidth={0.6}
          transparent
          opacity={0.35}
        />
      ))}

      {/* ── Rejilla S': ámbar dorado (líneas de x' = cte) ─────────── */}
      {xLines.map((pts, i) => (
        <Line
          key={`xl-${i}`}
          points={pts}
          color="#D97706"
          lineWidth={0.6}
          transparent
          opacity={0.35}
        />
      ))}

      {/* ── Ejes S': ámbar brillante ─────────────────────────────────── */}
      <Line points={axisXPrime}  color="#FDB813" lineWidth={2.5} />
      <Line points={axisCTPrime} color="#FDB813" lineWidth={2.5} />

      {/* ── Cono de luz: naranja brillante ──────────────────────────── */}
      {lightCone.map((pts, i) => (
        <Line key={`lc-${i}`} points={pts} color="#F97316" lineWidth={2.0} />
      ))}

      {/* ── Etiquetas de ejes: esferas emisivas ──────────────────────── */}
      {/* Punta eje x (S) */}
      <AxisDot pos={[EXTENT - 0.1, 0, 0]} color="#4FC3F7" />
      {/* Punta eje ct (S) */}
      <AxisDot pos={[0, EXTENT - 0.1, 0]} color="#4FC3F7" />
      {/* Punta eje x' (S') */}
      <AxisDot pos={axisXPrime[1]} color="#FDB813" />
      {/* Punta eje ct' (S') */}
      <AxisDot pos={axisCTPrime[1]} color="#FDB813" />

      {/* ── Región futuro/pasado/espacio — partículas ─────────────────── */}
      <ConeRegionParticles beta={beta} extent={EXTENT} />

      {/* ── Regla (contracción de longitud) ─────────────────────────── */}
      {showRod && (
        <group position={[0, 0, 0.1]}>
          {/* Barra contraída en S (a t=0) */}
          <mesh position={[0, -1.5, 0]}>
            <boxGeometry args={[rodHalfLen * 2, 0.08, 0.08]} />
            <meshStandardMaterial
              color="#F87171"
              emissive="#F87171"
              emissiveIntensity={1.2}
              toneMapped={false}
            />
          </mesh>
          {/* Extremos marcados */}
          <mesh position={[-rodHalfLen, -1.5, 0]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color="#F87171" emissive="#F87171" emissiveIntensity={2.0} toneMapped={false} />
          </mesh>
          <mesh position={[rodHalfLen, -1.5, 0]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color="#F87171" emissive="#F87171" emissiveIntensity={2.0} toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* ── Reloj (dilatación del tiempo) ────────────────────────────── */}
      {showClock && (
        <>
          {/* Worldline del reloj: x=0 en S', que es x=βct en S */}
          <Line
            points={[
              [0, 0, 0.15] as [number, number, number],
              [clockTickX, clockTickCT, 0.15] as [number, number, number],
            ]}
            color="#A78BFA"
            lineWidth={2.0}
          />
          {/* Evento "tick 1" del reloj propio */}
          <mesh ref={clockRef} position={[clockTickX, clockTickCT, 0.15]}>
            <sphereGeometry args={[0.12, 20, 20]} />
            <meshStandardMaterial
              color="#A78BFA"
              emissive="#A78BFA"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
          {/* Evento t=1 en S (ct=1, x=0) para comparar */}
          <mesh position={[0, 1, 0.15]}>
            <sphereGeometry args={[0.10, 20, 20]} />
            <meshStandardMaterial
              color="#4FC3F7"
              emissive="#4FC3F7"
              emissiveIntensity={1.2}
              toneMapped={false}
            />
          </mesh>
          {/* Línea horizontal que conecta los dos eventos (simultaneidad) */}
          <Line
            points={[[0, clockTickCT, 0.15], [clockTickX, clockTickCT, 0.15]]}
            color="#A78BFA"
            lineWidth={1.0}
            dashed
            dashSize={0.1}
            gapSize={0.05}
          />
        </>
      )}

      {/* ── Origen ────────────────────────────────────────────────────── */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.1, 20, 20]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
    </>
  );
}

// ─── Sub-componente: puntos de colores en regiones del cono de luz ──────────

function ConeRegionParticles({ beta, extent }: { beta: number; extent: number }) {
  const COUNT = 120;

  const { futurePos, pastPos, spacePos } = useMemo(() => {
    // Distribución aleatoria pero determinista (seed fijo) de puntos
    // clasificados según s² = ct² − x² (c=1)
    const future: number[] = [];
    const past:   number[] = [];
    const space:  number[] = [];

    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };

    for (let i = 0; i < COUNT; i++) {
      const x  = (rand() * 2 - 1) * extent * 0.9;
      const ct = (rand() * 2 - 1) * extent * 0.9;
      const s2 = ct * ct - x * x;  // intervalo de Minkowski (c=1)
      if (s2 > 0.1 && ct > 0) {
        future.push(x, ct, 0);
      } else if (s2 > 0.1 && ct < 0) {
        past.push(x, ct, 0);
      } else if (s2 < -0.1) {
        space.push(x, ct, 0);
      }
    }
    return {
      futurePos: new Float32Array(future),
      pastPos:   new Float32Array(past),
      spacePos:  new Float32Array(space),
    };
  // beta no afecta las partículas (son del marco S), pero las regeneramos si cambia
  // para dar efecto visual de "el cono se transforma"
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extent]);

  const futureGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(futurePos, 3));
    return g;
  }, [futurePos]);

  const pastGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pastPos, 3));
    return g;
  }, [pastPos]);

  const spaceGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(spacePos, 3));
    return g;
  }, [spacePos]);

  const _ = beta; // suprimir warning — beta se usa para contexto visual

  return (
    <>
      {/* Futuro: verde esmeralda tenue */}
      <points geometry={futureGeo}>
        <pointsMaterial
          color="#34D399"
          size={0.07}
          sizeAttenuation
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Pasado: azul tenue */}
      <points geometry={pastGeo}>
        <pointsMaterial
          color="#60A5FA"
          size={0.07}
          sizeAttenuation
          transparent
          opacity={0.25}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Tipo espacio: rojo tenue (no causal) */}
      <points geometry={spaceGeo}>
        <pointsMaterial
          color="#F87171"
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0.20}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  );
}

// ─── Helpers UI ─────────────────────────────────────────────────────────────

function AxisDot({ pos, color }: { pos: [number, number, number]; color: string }) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.09, 14, 14]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} toneMapped={false} />
    </mesh>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className={highlight ? 'text-[#FDB813]' : 'text-white'}>{value}</span>
    </div>
  );
}
