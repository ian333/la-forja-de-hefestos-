/**
 * Oscilador Armónico Cuántico — ψₙ(x) de Hermite, E_n = ℏω(n+½), estados coherentes 3D.
 *
 * FÍSICA REAL:
 *   ψₙ(x) = Nₙ · Hₙ(ξ) · exp(−ξ²/2)   donde ξ = x/x₀, x₀ = √(ℏ/mω)
 *   Hₙ: polinomios de Hermite por recurrencia (no lookup)
 *   Nₙ = 1/√(2ⁿ n! √π x₀)
 *   Eₙ = ℏω(n + ½)
 *
 * ESTADO COHERENTE de Glauber |α⟩:
 *   ψ_coh(x,t) = Σₙ cₙ(α) · ψₙ(x) · exp(−iEₙt/ℏ)
 *   cₙ(α) = exp(−|α|²/2) · αⁿ / √n!    (distribución de Poisson)
 *   El centroide oscila: ⟨x⟩(t) = 2x₀|α| cos(ωt + φ)
 *   La forma NUNCA cambia — es el más clásico de todos los estados cuánticos.
 *
 * VISUALIZACIÓN 3D CINE:
 *   - Nube de probabilidad 3D: puntos muestreados de |ψ|² rotados en XZ, altura en Y.
 *     Cada nivel tiene su propia nube emisiva con color tipo espectral.
 *   - Isosuperficie aproximada: anillos circulares a z=const (densidad de probabilidad radial).
 *   - Panel de niveles: esferas apiladas que muestran Eₙ = ℏω(n+½).
 *   - Estado coherente: centroide animado que oscila como un péndulo clásico.
 *
 * REGLA useFrame: SOLO dentro de sub-componentes hijos de <Stage>.
 */

import { useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Constantes físicas (unidades reducidas: ℏ=1, m=1, ω=1) ──────────────
// x₀ = √(ℏ/mω) = 1  (unidad de longitud de punto cero)
const HBAR = 1.0;
const MASS = 1.0;
const OMEGA = 1.0;
const X0 = Math.sqrt(HBAR / (MASS * OMEGA));  // = 1.0

// Grilla 1D para evaluar ψₙ(x)
const NGRID = 512;
const X_MAX = 7.0;   // en unidades de x₀
const DX = (2 * X_MAX) / NGRID;

const XS = new Float64Array(NGRID);
for (let i = 0; i < NGRID; i++) XS[i] = -X_MAX + i * DX;

// ─── Polinomios de Hermite por recurrencia ──────────────────────────────
// H₀ = 1, H₁ = 2ξ, Hₙ = 2ξ·Hₙ₋₁ − 2(n-1)·Hₙ₋₂
function hermiteAt(n: number, xi: number): number {
  if (n === 0) return 1;
  if (n === 1) return 2 * xi;
  let hm2 = 1, hm1 = 2 * xi, h = 0;
  for (let k = 2; k <= n; k++) {
    h = 2 * xi * hm1 - 2 * (k - 1) * hm2;
    hm2 = hm1;
    hm1 = h;
  }
  return h;
}

// log(n!) — para evitar overflow en n! cuando n es grande
function logFactorial(n: number): number {
  let s = 0;
  for (let k = 2; k <= n; k++) s += Math.log(k);
  return s;
}

// Calcular ψₙ(x) en toda la grilla; normaliza sobre la misma grilla.
// Devuelve Float64Array de longitud NGRID con los valores de |ψₙ(x)|.
function computePsi(n: number): Float64Array {
  const psi = new Float64Array(NGRID);
  // log del factor de normalización: Nₙ = 1/√(2ⁿ n! √π x₀)
  const logNorm = -0.5 * (n * Math.log(2) + logFactorial(n) + 0.5 * Math.log(Math.PI));
  for (let i = 0; i < NGRID; i++) {
    const xi = XS[i] / X0;
    const hn = hermiteAt(n, xi);
    // ψₙ(x) = exp(logNorm) · Hₙ(ξ) · exp(−ξ²/2)
    psi[i] = Math.exp(logNorm) * hn * Math.exp(-0.5 * xi * xi);
  }
  return psi;
}

// ─── Estado coherente ────────────────────────────────────────────────────
// |α⟩ = Σₙ cₙ ψₙ(x)  truncado a N_TRUNC términos
// cₙ = exp(−|α|²/2) · αⁿ/√n!
// Devuelve Re(ψ), Im(ψ) separados para calcular |ψ|²(x,t)
const N_TRUNC = 24;  // suficiente para |α|≤3 con error < 10⁻⁸

function computeCoherent(
  alpha: number,   // amplitud real (el centro oscila con esta amplitud × √2)
  t: number,       // tiempo
  psiBasis: Float64Array[],  // psiBasis[n] = ψₙ evaluado en la grilla
): { rho: Float64Array; xMean: number } {
  const psiRe = new Float64Array(NGRID);
  const psiIm = new Float64Array(NGRID);

  // Coeficientes c_n: |c_n|² = Poisson(|α|², n)
  // Fase de c_n = exp(-i·n·ωt) (en unidades ℏω=1 → Eₙ=n+0.5, fase extra de 0.5t común)
  const alpha2 = alpha * alpha;
  let logcn_abs = -0.5 * alpha2;  // log|c₀| = -|α|²/2
  for (let n = 0; n <= N_TRUNC; n++) {
    const phase = -(n + 0.5) * OMEGA * t;  // fase Eₙ·t/ℏ
    const cn_re = Math.exp(logcn_abs) * Math.cos(phase);
    const cn_im = Math.exp(logcn_abs) * Math.sin(phase);
    const basis = psiBasis[n];
    for (let i = 0; i < NGRID; i++) {
      psiRe[i] += cn_re * basis[i];
      psiIm[i] += cn_im * basis[i];
    }
    if (n < N_TRUNC) {
      logcn_abs += Math.log(alpha > 1e-9 ? alpha : 1e-9) - 0.5 * Math.log(n + 1);
    }
  }

  // |ψ(x,t)|²
  const rho = new Float64Array(NGRID);
  let xMean = 0, norm = 0;
  for (let i = 0; i < NGRID; i++) {
    rho[i] = psiRe[i] * psiRe[i] + psiIm[i] * psiIm[i];
    xMean += XS[i] * rho[i] * DX;
    norm   += rho[i] * DX;
  }
  xMean /= Math.max(norm, 1e-12);
  return { rho, xMean };
}

// ─── Colores por nivel (espectral) ──────────────────────────────────────
const LEVEL_COLORS: string[] = [
  '#60A5FA',  // n=0 azul suave
  '#34D399',  // n=1 verde esmeralda
  '#FDE68A',  // n=2 ámbar
  '#F97316',  // n=3 naranja
  '#F472B6',  // n=4 rosa
  '#A78BFA',  // n=5 violeta
  '#38BDF8',  // n=6 cyan
  '#4ADE80',  // n=7 verde claro
];
function levelColor(n: number): string { return LEVEL_COLORS[n % LEVEL_COLORS.length]; }
function levelColorRGB(n: number): [number, number, number] {
  const c = new THREE.Color(levelColor(n));
  return [c.r, c.g, c.b];
}

// ─── Lección pedagógica ─────────────────────────────────────────────────
interface HarmonicState {
  mode: 'levels' | 'coherent';
  levelN: number;
  alpha: number;
}

const LESSON: Lesson<HarmonicState> = {
  hook: {
    title: 'El vacío tiene energía. La naturaleza cuántica NO puede quedarse quieta.',
    body: `Tomá un resorte clásico: sin fuerza, sin movimiento. Energía = 0.

En mecánica cuántica, eso es IMPOSIBLE. Si la partícula estuviera completamente quieta, conoceríamos su posición Y su momento con precisión perfecta — lo que viola el principio de Heisenberg ΔxΔp ≥ ℏ/2.

El resultado: el oscilador armónico cuántico NUNCA puede tener E=0. Su nivel más bajo de energía es E₀ = ℏω/2 — la "energía de punto cero". El vacío vibra.

Los niveles están igualmente espaciados: Eₙ = ℏω(n + ½). Cada fotón de un campo electromagnético es un cuanto de excitación de este oscilador. El oscilador armónico cuántico ES el campo cuántico en su forma más simple.

Y hay un estado especial — el estado coherente de Glauber — que se comporta EXACTAMENTE como un oscilador clásico: oscila sin dispersarse, manteniendo su forma gaussiana. Es por eso que los láseres son coherentes.`,
  },

  steps: [
    {
      title: 'Autofunciones ψₙ — la estructura de nodos',
      duration: 6000,
      body: `Cada nivel n tiene una autofunción ψₙ(x) = Nₙ · Hₙ(ξ) · exp(−ξ²/2) donde ξ = x/x₀.

Los polinomios de Hermite Hₙ tienen EXACTAMENTE n raíces. Eso significa que |ψₙ|² tiene n nodos — n puntos donde la probabilidad es CERO.

La nube 3D que ves es la densidad de probabilidad |ψₙ|² rotada alrededor del eje Y — como si el oscilador viviera en un anillo y vieras su "corona" de probabilidad.

Navega entre niveles con los botones. Observa cómo crecen los lóbulos y los nodos conforme sube n.`,
      formula: 'ψₙ(x) = Nₙ · Hₙ(x/x₀) · exp(−x²/2x₀²)\nEₙ = ℏω(n + ½)\nNₙ = 1/√(2ⁿ n! √π x₀)',
      keyframes: [
        { at: 0, state: { mode: 'levels', levelN: 0 } },
        { at: 0.5, state: { mode: 'levels', levelN: 3 } },
        { at: 1, state: { mode: 'levels', levelN: 5 } },
      ],
    },
    {
      title: 'Espectro discreto — energías igualmente espaciadas',
      duration: 5500,
      body: `A diferencia del átomo de hidrógeno (niveles que se comprimen), el oscilador armónico tiene niveles EQUIDISTANTES: Eₙ₊₁ − Eₙ = ℏω, siempre.

Esto no es coincidencia. Es consecuencia del álgebra de los operadores de creación â† y aniquilación â:

  â|n⟩ = √n |n−1⟩    (baja un escalón de energía)
  â†|n⟩ = √(n+1)|n+1⟩ (sube un escalón)
  [â, â†] = 1         (conmutador canónico)

El Hamiltoniano se factoriza: H = ℏω(â†â + ½). El operador â†â es el de número N̂ con autovalores n=0,1,2,…

Cada fotón de un campo electromagnético ES una excitación â† del vacío. El vacío es |0⟩ — con energía E₀ = ℏω/2 ≠ 0.`,
      formula: 'Eₙ = ℏω(n + ½)\nH = ℏω(â†â + ½)\n[â, â†] = 1',
      keyframes: [
        { at: 0, state: { mode: 'levels', levelN: 0 } },
        { at: 0.5, state: { mode: 'levels', levelN: 4 } },
        { at: 1, state: { mode: 'levels', levelN: 7 } },
      ],
    },
    {
      title: 'Estado coherente — el puente entre lo cuántico y lo clásico',
      duration: 7000,
      body: `El estado coherente |α⟩ es la superposición de todos los niveles con coeficientes de Poisson:
  |α⟩ = Σₙ cₙ |n⟩  con  |cₙ|² = e^{−|α|²} |α|²ⁿ/n!

Su propiedad fundamental: es autoestado del operador de BAJADA â|α⟩ = α|α⟩. Eso lo hace único.

La densidad de probabilidad |ψ(x,t)|² NUNCA cambia de forma — es siempre una gaussiana. Solo su posición oscila:

  ⟨x⟩(t) = 2x₀|α| cos(ωt)    (oscilación clásica exacta)
  ⟨p⟩(t) = −2mωx₀|α| sin(ωt)

Es la solución más clásica posible de la mecánica cuántica. Los láseres, los estados del campo de microondas en cavidades, y los interferómetros de alta precisión usan estados coherentes. Glauber ganó el Nobel 2005 por la teoría de coherencia cuántica.`,
      formula: 'â|α⟩ = α|α⟩\n|cₙ|² = e^{−|α|²} |α|²ⁿ/n!  (Poisson)\n⟨x⟩(t) = 2x₀ Re(α e^{−iωt})',
      keyframes: [
        { at: 0, state: { mode: 'coherent', alpha: 2.5 } },
        { at: 1, state: { mode: 'coherent', alpha: 2.5 } },
      ],
    },
    {
      title: 'Incertidumbre mínima — el estado más "quieto" posible',
      duration: 6000,
      body: `El estado coherente satisface el principio de Heisenberg con IGUALDAD:
  Δx · Δp = ℏ/2  (mínimo posible)

Y tanto Δx como Δp son constantes en el tiempo — no crecen ni decaen. El paquete de onda no se dispersa NUNCA.

Compará con un estado n puro (por ejemplo n=5): sus fluctuaciones Δx = x₀√(n + ½) son mucho mayores. El nivel n=5 tiene Δx = x₀√5.5 ≈ 2.35x₀ — versus el estado coherente con Δx = x₀/√2 ≈ 0.71x₀.

Cuando α → 0, el estado coherente converge al vacío |0⟩. Cuando |α| → ∞, la distribución de Poisson se estrecha y converge al comportamiento clásico.

Este es el corazón del puente entre mecánica cuántica y clásica: el límite semiclásico es un estado coherente.`,
      formula: 'Δx = x₀/√2  (coherente, siempre)\nΔp = ℏ/(√2 x₀)\nΔx·Δp = ℏ/2  (Heisenberg mínimo)',
      keyframes: [
        { at: 0, state: { mode: 'coherent', alpha: 1.5 } },
        { at: 0.5, state: { mode: 'coherent', alpha: 2.5 } },
        { at: 1, state: { mode: 'coherent', alpha: 3.2 } },
      ],
    },
  ],

  connect: {
    body: `El oscilador armónico cuántico es el modelo más importante de la física teórica:

• Óptica cuántica: cada modo del campo EM es un OAQ. La luz láser = estado coherente.
• Fonones: las vibraciones de la red cristalina son cuantos de OAQ → superconductividad, calor específico.
• Brecha de masa del bosón de Higgs: el potencial mexicano es un OAQ con simetría espontáneamente rota.
• Cosmología: los modos de inflación cuántica son OAQs — las fluctuaciones del CMB nacen en el vacío cuántico.
• Trampa de iones: los estados de movimiento del ion atrapado son OAQ — la base del primer computador cuántico.
• Resonadores nanomecánicos: enfriados a su estado base en 2010 (O'Connell et al., Nature) — el "Schrödinger" macroscópico más grande.`,
    links: [
      { label: 'Schrödinger 1D — paquetes en potenciales', href: '#schrodinger-1d' },
      { label: 'Átomo de hidrógeno — espectro real', href: '#hydrogen-atom' },
      { label: 'Campos EM — cuantización del fotón', href: '#em-fields' },
    ],
  },
};

// ─── Nube de puntos por nivel ───────────────────────────────────────────
const CLOUD_N = 2200;  // puntos por nube de probabilidad
const VIS_RADIUS = 3.5; // radio máximo de la nube en el plano XZ
const VIS_Y = 2.5;     // altura visual máxima (eje de probabilidad)

// Escala x físico → coordenada de mundo (eje X de visualización)
function xToWorld(x: number): number { return (x / X_MAX) * VIS_RADIUS; }

// ─── Componente principal ───────────────────────────────────────────────
export default function QuantumHarmonic() {
  const { audience } = useAudience();

  // Precomputar bases ψₙ una sola vez (costoso fuera del render)
  const psiBasis = useMemo(() => {
    const basis: Float64Array[] = [];
    for (let n = 0; n <= N_TRUNC; n++) basis.push(computePsi(n));
    return basis;
  }, []);

  const [mode, setMode] = useState<'levels' | 'coherent'>('levels');
  const [levelN, setLevelN] = useState(0);
  const [alpha, setAlpha] = useState(2.5);
  const [running, setRunning] = useState(true);
  const timeRef = useRef(0.0);
  const [displayT, setDisplayT] = useState(0.0);

  // Energía del nivel actual
  const En = (n: number) => HBAR * OMEGA * (n + 0.5);
  const maxLevels = 8;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={8} autoRotate bloomIntensity={0.9} bloomThreshold={0.08}>
          <QHScene
            psiBasis={psiBasis}
            mode={mode}
            levelN={levelN}
            alpha={alpha}
            running={running}
            timeRef={timeRef}
            onTick={(t) => setDisplayT(t)}
          />
        </Stage>

        {/* HUD — métricas */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          {mode === 'levels' ? (
            <>
              <div><span className="text-[#64748B]">n&nbsp;&nbsp;&nbsp;</span>= {levelN}</div>
              <div><span className="text-[#64748B]">Eₙ&nbsp;&nbsp;</span>= <span className="text-[#FDE68A]">{En(levelN).toFixed(2)} ℏω</span></div>
              <div><span className="text-[#64748B]">nodos</span>= {levelN}</div>
              <div><span className="text-[#64748B]">Δx&nbsp;&nbsp;</span>= {(Math.sqrt(levelN + 0.5) * X0).toFixed(3)} x₀</div>
            </>
          ) : (
            <>
              <div><span className="text-[#64748B]">t&nbsp;&nbsp;&nbsp;&nbsp;</span>= {displayT.toFixed(2)} /ω</div>
              <div><span className="text-[#64748B]">|α|&nbsp;&nbsp;</span>= {alpha.toFixed(2)}</div>
              <div><span className="text-[#64748B]">⟨x⟩&nbsp;&nbsp;</span>= {(2 * alpha * Math.cos(OMEGA * displayT)).toFixed(3)} x₀</div>
              <div><span className="text-[#64748B]">Δx&nbsp;&nbsp;</span>= {(X0 / Math.sqrt(2)).toFixed(3)} x₀</div>
            </>
          )}
        </div>

        {/* Selector de modo */}
        <div className="absolute top-4 right-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] overflow-hidden flex">
          <ModeBtn active={mode === 'levels'} onClick={() => setMode('levels')}>Niveles ψₙ</ModeBtn>
          <ModeBtn active={mode === 'coherent'} onClick={() => setMode('coherent')}>Coherente |α⟩</ModeBtn>
        </div>

        {/* Controles de nivel (solo en modo niveles) */}
        {mode === 'levels' && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
            {Array.from({ length: maxLevels }, (_, n) => (
              <button key={n} onClick={() => setLevelN(n)}
                style={{ color: levelColor(n), borderColor: levelN === n ? levelColor(n) : '#1E293B' }}
                className={`w-7 h-7 rounded border text-[11px] font-mono transition ${levelN === n ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}>
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Controles de alpha (solo en modo coherente) */}
        {mode === 'coherent' && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-4 py-2">
            <span className="text-[11px] text-[#64748B] font-mono">|α|</span>
            <input type="range" min={0.5} max={3.5} step={0.1} value={alpha}
              onChange={e => setAlpha(Number(e.target.value))}
              className="w-28" />
            <span className="text-[11px] text-white font-mono w-8">{alpha.toFixed(1)}</span>
          </div>
        )}

        {/* Play/Pause */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => { timeRef.current = 0; setDisplayT(0); }} title="Reiniciar tiempo">↺</IconBtn>
        </div>
      </div>

      <LessonPanel<HarmonicState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.mode !== undefined) setMode(patch.mode);
          if (patch.levelN !== undefined) setLevelN(patch.levelN);
          if (patch.alpha  !== undefined) setAlpha(patch.alpha);
        }}
        sandbox={
          <>
            <Section title="Modo de visualización">
              <div className="grid grid-cols-1 gap-1.5">
                <button onClick={() => setMode('levels')}
                  className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                    mode === 'levels'
                      ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#60A5FA]/40 text-white'
                      : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                  }`}>Autofunciones ψₙ(x)</button>
                <button onClick={() => setMode('coherent')}
                  className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                    mode === 'coherent'
                      ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#34D399]/40 text-white'
                      : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                  }`}>Estado coherente |α⟩</button>
              </div>
            </Section>

            {mode === 'levels' && (
              <Section title="Nivel cuántico n">
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {Array.from({ length: maxLevels }, (_, n) => (
                    <button key={n} onClick={() => setLevelN(n)}
                      style={{
                        borderColor: levelN === n ? levelColor(n) : '#1E293B',
                        color: levelN === n ? levelColor(n) : '#94A3B8',
                        backgroundColor: levelN === n ? levelColor(n) + '22' : 'transparent',
                      }}
                      className="px-0 py-2 rounded-md border text-[12px] font-mono transition text-center">
                      n={n}
                    </button>
                  ))}
                </div>
                <div className="space-y-0.5">
                  <Row label="Eₙ" value={`${En(levelN).toFixed(2)} ℏω`} />
                  <Row label="Nodos" value={`${levelN}`} />
                  <Row label="Δx" value={`${(Math.sqrt(levelN + 0.5) * X0).toFixed(3)} x₀`} />
                  <Row label="Δp" value={`${(HBAR * Math.sqrt(levelN + 0.5) / X0).toFixed(3)} ℏ/x₀`} />
                  <Row label="Δx·Δp" value={`${((levelN + 0.5) * HBAR).toFixed(2)} ℏ`} />
                </div>
              </Section>
            )}

            {mode === 'coherent' && (
              <Section title="Amplitud coherente |α|">
                <Slider label="|α|" v={alpha} min={0.5} max={3.5} step={0.1} on={setAlpha} />
                <div className="space-y-0.5 mt-2">
                  <Row label="t" value={`${displayT.toFixed(2)} /ω`} />
                  <Row label="⟨x⟩" value={`${(2 * alpha * Math.cos(OMEGA * displayT)).toFixed(3)} x₀`} />
                  <Row label="Δx" value={`${(X0 / Math.sqrt(2)).toFixed(3)} x₀ (cte)`} />
                  <Row label="⟨n⟩" value={`${(alpha * alpha).toFixed(2)}`} />
                  <Row label="Δn" value={`${alpha.toFixed(2)} (Poisson)`} />
                </div>
              </Section>
            )}

            {audience === 'researcher' && (
              <Section title="Espectro de energía">
                <div className="space-y-1">
                  {Array.from({ length: maxLevels }, (_, n) => (
                    <div key={n} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: levelColor(n) }} />
                      <div className="text-[10px] font-mono text-[#94A3B8] shrink-0 w-6">n={n}</div>
                      <div className="flex-1 h-1 rounded" style={{
                        background: `linear-gradient(90deg, ${levelColor(n)}88, transparent)`,
                        width: `${((n + 0.5) / 7.5) * 100}%`,
                      }} />
                      <div className="text-[10px] font-mono text-[#CBD5E1]">{En(n).toFixed(1)}ℏω</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {audience === 'child' && (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>La nube de puntos muestra <span className="text-[#FDE68A]">dónde puede estar</span> la partícula.</p>
                  <p>Cada anillo de luz corresponde a un <span className="text-[#60A5FA]">nivel de energía</span> diferente.</p>
                  <p>El estado coherente es la partícula que <span className="text-[#34D399]">oscila como una pelota</span> pero con reglas cuánticas.</p>
                </div>
              </Section>
            )}

            <Section title="Ecuación">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">H = −ℏ²/2m ∂²/∂x² + ½mω²x²</div>
                <div className="text-[#94A3B8]">ψₙ = Nₙ Hₙ(ξ) e^(−ξ²/2)</div>
                <div className="text-[#94A3B8]">Eₙ = ℏω(n + ½)</div>
                <div className="mt-1 text-[#64748B] text-[10px]">Hermite: Hₙ = 2ξHₙ₋₁ − 2(n-1)Hₙ₋₂</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D (DENTRO del Canvas — useFrame permitido) ─────────────────

interface QHSceneProps {
  psiBasis: Float64Array[];
  mode: 'levels' | 'coherent';
  levelN: number;
  alpha: number;
  running: boolean;
  timeRef: React.MutableRefObject<number>;
  onTick: (t: number) => void;
}

function QHScene({ psiBasis, mode, levelN, alpha, running, timeRef, onTick }: QHSceneProps) {
  const tex = useMemo(() => getParticleTexture(), []);

  // Geometría de nube — ring buffer circular para evitar GC
  const cloudGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CLOUD_N * 3), 3));
    g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(CLOUD_N * 3), 3));
    return g;
  }, []);

  // Geometría de la curva de energía (barras de nivel)
  const axisGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // Eje X como referencia
    const pts = new Float32Array(2 * 3);
    pts[0] = -VIS_RADIUS; pts[1] = 0; pts[2] = 0;
    pts[3] =  VIS_RADIUS; pts[4] = 0; pts[5] = 0;
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return g;
  }, []);

  // Refs de malla para los indicadores de nivel (esferas en Y=Eₙ)
  const levelSpheres = useMemo(() =>
    Array.from({ length: 8 }, () => new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 12),
      new THREE.MeshStandardMaterial({ toneMapped: false }),
    )),
  []);

  // Ref del centroide del estado coherente
  const centroidRef = useRef<THREE.Mesh>(null);

  // Throttle para stats
  const lastTickRef = useRef(0);

  useFrame((_s, delta) => {
    if (running) {
      timeRef.current += delta;
    }
    const t = timeRef.current;

    // Throttle UI callback a ~15fps
    const now = performance.now();
    if (now - lastTickRef.current > 66) {
      lastTickRef.current = now;
      onTick(t);
    }

    const pos = cloudGeo.attributes.position as THREE.BufferAttribute;
    const col = cloudGeo.attributes.color    as THREE.BufferAttribute;
    const posArr = pos.array as Float32Array;
    const colArr = col.array as Float32Array;

    if (mode === 'levels') {
      // Samplear |ψₙ|² por rechazo en 3D (rotación azimutal)
      const psi = psiBasis[levelN];
      const [cr, cg, cb] = levelColorRGB(levelN);

      // Calcular max para normalizar
      let psiMax2 = 0;
      for (let i = 0; i < NGRID; i++) {
        const v = psi[i] * psi[i];
        if (v > psiMax2) psiMax2 = v;
      }
      const psiNorm = psiMax2 > 1e-15 ? 1 / psiMax2 : 1;

      let ci = 0, tries = 0;
      while (ci < CLOUD_N && tries < CLOUD_N * 12) {
        tries++;
        const idx = Math.floor(Math.random() * NGRID);
        const rho = psi[idx] * psi[idx] * psiNorm;
        if (Math.random() < rho) {
          // Rotar el punto x en torno al eje Y con ángulo azimutal aleatorio
          const phi = Math.random() * 2 * Math.PI;
          const xw  = xToWorld(XS[idx]);
          const rad = Math.abs(xw) + (Math.random() - 0.5) * 0.06;
          const wx  = rad * Math.cos(phi);
          const wz  = rad * Math.sin(phi);
          // Altura en Y proporcional a |ψ|²
          const wy  = rho * VIS_Y * (0.8 + Math.random() * 0.2) - VIS_Y * 0.1;
          posArr[ci*3+0] = wx;
          posArr[ci*3+1] = wy;
          posArr[ci*3+2] = wz;
          // Color con brillo proporcional a probabilidad
          const bright = 0.5 + rho * 0.5;
          colArr[ci*3+0] = cr * bright;
          colArr[ci*3+1] = cg * bright;
          colArr[ci*3+2] = cb * bright;
          ci++;
        }
      }
      // Llenar el resto fuera de la vista
      for (let j = ci; j < CLOUD_N; j++) {
        posArr[j*3+0] = 0; posArr[j*3+1] = -99; posArr[j*3+2] = 0;
      }

      // Actualizar esferas de nivel (visibles)
      for (let n = 0; n < 8; n++) {
        const sphere = levelSpheres[n];
        const en = (n + 0.5);  // Eₙ/ℏω
        sphere.position.set(VIS_RADIUS + 0.6, (en / 8.5) * VIS_Y * 2 - VIS_Y * 0.7, 0);
        const mat = sphere.material as THREE.MeshStandardMaterial;
        const [sr, sg, sb] = levelColorRGB(n);
        mat.color.setRGB(sr, sg, sb);
        mat.emissive.setRGB(sr * (n === levelN ? 1.2 : 0.2), sg * (n === levelN ? 1.2 : 0.2), sb * (n === levelN ? 1.2 : 0.2));
        mat.emissiveIntensity = n === levelN ? 2.5 : 0.4;
        sphere.scale.setScalar(n === levelN ? 1.4 : 0.8);
      }

      // Ocultar centroide en modo niveles
      if (centroidRef.current) centroidRef.current.visible = false;

    } else {
      // Modo coherente: calcular |ψ_coh(x,t)|² con los primeros N_TRUNC niveles
      const { rho: rhoCoh, xMean } = computeCoherent(alpha, t, psiBasis);

      let rhoMax = 0;
      for (let i = 0; i < NGRID; i++) if (rhoCoh[i] > rhoMax) rhoMax = rhoCoh[i];
      const rhoNorm = rhoMax > 1e-15 ? 1 / rhoMax : 1;

      let ci = 0, tries = 0;
      while (ci < CLOUD_N && tries < CLOUD_N * 12) {
        tries++;
        const idx = Math.floor(Math.random() * NGRID);
        const rho = rhoCoh[idx] * rhoNorm;
        if (Math.random() < rho) {
          const phi = Math.random() * 2 * Math.PI;
          const xw  = xToWorld(XS[idx]);
          const rad = Math.abs(xw) + (Math.random() - 0.5) * 0.04;
          const wx  = rad * Math.cos(phi);
          const wz  = rad * Math.sin(phi);
          const wy  = rho * VIS_Y * (0.8 + Math.random() * 0.15) - VIS_Y * 0.08;
          posArr[ci*3+0] = wx;
          posArr[ci*3+1] = wy;
          posArr[ci*3+2] = wz;
          // Color verde esmeralda con brillo por densidad
          const bright = 0.5 + rho * 0.5;
          colArr[ci*3+0] = 0.2 * bright;
          colArr[ci*3+1] = 0.85 * bright;
          colArr[ci*3+2] = 0.6 * bright;
          ci++;
        }
      }
      for (let j = ci; j < CLOUD_N; j++) {
        posArr[j*3+0] = 0; posArr[j*3+1] = -99; posArr[j*3+2] = 0;
      }

      // Centroide brillante que oscila
      if (centroidRef.current) {
        centroidRef.current.visible = true;
        const xw = xToWorld(xMean);
        centroidRef.current.position.set(xw, 0.12, 0);
      }

      // Opacar esferas de nivel en modo coherente
      for (let n = 0; n < 8; n++) {
        const sphere = levelSpheres[n];
        sphere.position.set(VIS_RADIUS + 0.6, ((n + 0.5) / 8.5) * VIS_Y * 2 - VIS_Y * 0.7, 0);
        const mat = sphere.material as THREE.MeshStandardMaterial;
        // Mostrar peso Poisson del nivel n: P(n) = e^{-|α|²} |α|^{2n}/n!
        const logPn = -alpha*alpha + 2*n*Math.log(alpha > 1e-9 ? alpha : 1e-9) - logFactorial(n);
        const pn = Math.exp(Math.max(logPn, -20));
        const [sr, sg, sb] = levelColorRGB(n);
        mat.color.setRGB(sr, sg, sb);
        mat.emissive.setRGB(sr, sg, sb);
        mat.emissiveIntensity = pn * 5.0;
        sphere.scale.setScalar(0.6 + pn * 1.5);
      }
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  return (
    <>
      {/* Luces ambientales de cine */}
      <pointLight position={[0, 3, 4]} intensity={1.5} color="#FDE68A" distance={20} />
      <pointLight position={[2, 1, -3]} intensity={0.8} color="#60A5FA" distance={15} />
      <pointLight position={[-2, 1, -3]} intensity={0.6} color="#34D399" distance={12} />

      {/* Nube principal de probabilidad |ψ|² */}
      <points geometry={cloudGeo}>
        <pointsMaterial
          vertexColors
          map={tex}
          alphaMap={tex}
          size={0.14}
          sizeAttenuation
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      {/* Esferas de indicador de nivel energético */}
      {levelSpheres.map((sphere, n) => (
        <primitive key={n} object={sphere} />
      ))}

      {/* Eje de energía vertical — escala de referencia */}
      <mesh position={[VIS_RADIUS + 0.6, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, VIS_Y * 2.2, 8]} />
        <meshStandardMaterial color="#334155" emissive="#1E293B" emissiveIntensity={0.4} />
      </mesh>

      {/* Líneas de energía (barras horizontales en cada Eₙ) */}
      {Array.from({ length: 8 }, (_, n) => {
        const yEn = ((n + 0.5) / 8.5) * VIS_Y * 2 - VIS_Y * 0.7;
        return (
          <mesh key={n} position={[VIS_RADIUS * 0.15, yEn, 0]}>
            <boxGeometry args={[VIS_RADIUS * 1.2, 0.012, 0.012]} />
            <meshStandardMaterial
              color={levelColor(n)}
              emissive={levelColor(n)}
              emissiveIntensity={0.15}
              toneMapped={false}
              transparent
              opacity={0.35}
            />
          </mesh>
        );
      })}

      {/* Potencial parabólico V(x) = ½ω²x² — arco emisivo */}
      <PotentialParabola />

      {/* Centroide del estado coherente (esfera brillante que oscila) */}
      <mesh ref={centroidRef} visible={false}>
        <sphereGeometry args={[0.16, 24, 18]} />
        <meshStandardMaterial
          color="#34D399"
          emissive="#34D399"
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>

      {/* Plano de suelo con grid de referencia */}
      <group position={[0, -0.9, 0]}>
        <gridHelper args={[VIS_RADIUS * 3, 28, '#1E293B', '#0F172A']} />
      </group>

      {/* Eje X de referencia */}
      <line>
        <primitive object={axisGeo} attach="geometry" />
        <lineBasicMaterial color="#334155" toneMapped={false} transparent opacity={0.6} />
      </line>
    </>
  );
}

// Curva parabólica del potencial V(x) = ½ω²x² como LineSegments emisivo
function PotentialParabola() {
  const geo = useMemo(() => {
    const n = 80;
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = -X_MAX + (2 * X_MAX * i) / (n - 1);
      const v = 0.5 * OMEGA * OMEGA * x * x;  // V en unidades reducidas
      const xw = xToWorld(x);
      const yw = (v / (0.5 * X_MAX * X_MAX)) * VIS_Y * 1.1 - 0.85; // normalizado visual
      pts[i*3+0] = xw;
      pts[i*3+1] = yw;
      pts[i*3+2] = 0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return g;
  }, []);

  return (
    <line>
      <primitive object={geo} attach="geometry" />
      <lineBasicMaterial color="#F97316" toneMapped={false} transparent opacity={0.5} />
    </line>
  );
}

// ─── Línea dummy (para axis) ─────────────────────────────────────────────
// Nota: el axisGeo se usa en <line> arriba en QHScene — aquí solo PotentialParabola.

// ─── UI helpers ─────────────────────────────────────────────────────────

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
  label: string; v: number; min: number; max: number; step: number; on: (v: number) => void
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full mt-1" />
    </div>
  );
}

function IconBtn({ children, onClick, active, title }: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title?: string
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

function ModeBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-[11px] transition ${
        active
          ? 'bg-[#1E293B] text-white'
          : 'text-[#64748B] hover:text-[#94A3B8]'
      }`}>
      {children}
    </button>
  );
}
