/**
 * Teorema del límite central (TLC) — el imán universal de la gaussiana.
 *
 *   Si X₁, …, X_N son i.i.d. con media μ y varianza finita σ², entonces la
 *   media muestral
 *
 *       X̄ = (1/N) Σᵢ Xᵢ
 *
 *   tiene, para N grande, distribución aproximadamente NORMAL:
 *
 *       X̄  ~  N( μ ,  σ²/N )
 *
 *   independientemente de la forma de la distribución base. Da igual si la
 *   base es uniforme, exponencial (super sesgada), Bernoulli (dos picos) o
 *   bimodal: la DISTRIBUCIÓN DE LAS MEDIAS se aplana a una campana.
 *
 * Aquí NO se dibuja una campana hardcodeada. Se MUESTREA de verdad:
 *
 *   1. Se eligen M repeticiones. En cada repetición se sacan N muestras de la
 *      distribución base (con su generador real) y se calcula su media X̄.
 *   2. Se construye el HISTOGRAMA de esas M medias (conteo por bin).
 *   3. Encima se superpone la gaussiana TEÓRICA N(μ, σ²/N) — con μ y σ² exactos
 *      de la distribución base (no estimados), evaluando la densidad
 *
 *          φ(x) = 1/√(2π σ²/N) · exp( −(x−μ)² / (2 σ²/N) )
 *
 *      escalada por el ancho de bin × M para que coincida en área con el conteo.
 *
 * Al subir N el histograma se estrecha (σ/√N) y abraza la campana. Al subir M
 * el histograma se vuelve más suave (menos ruido de muestreo). El "wow" emerge
 * de la corrección: la campana NO se impone, EMERGE.
 *
 * Visual: histograma 3D de barras emisivas (rojo del branch → amarillo según
 * altura) + la curva gaussiana teórica como una línea brillante encima.
 */

import { useMemo, useState } from 'react';
import { Line, Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

// ── Estado de la lección ──────────────────────────────────────────────

interface CLTState {
  distId: string;
  N: number;     // tamaño de cada muestra
  M: number;     // número de medias (repeticiones)
}

// ── Distribuciones base (generador REAL + μ, σ² exactos) ──────────────

interface BaseDist {
  id: string;
  label: string;
  blurb: string;
  /** Saca UNA observación de la base. */
  sample: () => number;
  /** Media teórica exacta de la base. */
  mu: number;
  /** Varianza teórica exacta de la base. */
  variance: number;
  /** Rango razonable de una sola observación, para describir la base. */
  rawRange: [number, number];
}

// Box-Muller: una normal estándar N(0,1) a partir de dos uniformes.
function randn(): number {
  let u1 = Math.random();
  const u2 = Math.random();
  if (u1 < 1e-12) u1 = 1e-12;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const DISTS: BaseDist[] = [
  {
    id: 'uniform',
    label: 'Uniforme U(0,1)',
    blurb: 'Plana entre 0 y 1. μ = 1/2, σ² = 1/12. La base más "aburrida".',
    sample: () => Math.random(),
    mu: 0.5,
    variance: 1 / 12,
    rawRange: [0, 1],
  },
  {
    id: 'exponential',
    label: 'Exponencial λ=1',
    blurb: 'Súper sesgada a la derecha (cola larga). μ = 1, σ² = 1. Tiempos de espera.',
    // Inversa de la CDF: X = −ln(U) con U ~ U(0,1).
    sample: () => {
      let u = Math.random();
      if (u < 1e-12) u = 1e-12;
      return -Math.log(u);
    },
    mu: 1,
    variance: 1,
    rawRange: [0, 6],
  },
  {
    id: 'bernoulli',
    label: 'Bernoulli p=0.5',
    blurb: 'Solo 0 o 1, mitad y mitad. μ = 0.5, σ² = 0.25. Volado de moneda.',
    sample: () => (Math.random() < 0.5 ? 1 : 0),
    mu: 0.5,
    variance: 0.25,
    rawRange: [0, 1],
  },
  {
    id: 'bimodal',
    label: 'Bimodal (dos picos)',
    blurb: 'Mezcla 50/50 de N(−2, 0.3²) y N(2, 0.3²). Dos jorobas separadas.',
    // Mezcla de dos gaussianas estrechas. μ = 0 por simetría.
    sample: () => {
      const center = Math.random() < 0.5 ? -2 : 2;
      return center + randn() * 0.3;
    },
    mu: 0,
    // Var = E[X²] − μ². E[X²] = 0.5(4 + 0.09) + 0.5(4 + 0.09) = 4.09; μ = 0.
    variance: 4.09,
    rawRange: [-3, 3],
  },
  {
    id: 'arcsine',
    label: 'Arcoseno (U en bordes)',
    blurb: 'X = sin(2πU): se amontona en los extremos ±1. μ = 0, σ² = 1/2.',
    // Distribución arcoseno en [−1,1] vía X = sin(2πU). E[X]=0, E[X²]=1/2.
    sample: () => Math.sin(2 * Math.PI * Math.random()),
    mu: 0,
    variance: 0.5,
    rawRange: [-1, 1],
  },
];

// ── Muestreo + histograma REAL ────────────────────────────────────────

interface Hist {
  binsX: number[];   // centros de bin (en unidades de X̄)
  counts: number[];  // conteo por bin
  binWidth: number;
  lo: number;
  hi: number;
  maxCount: number;
  sampleMean: number;     // media empírica de las M medias
  sampleVar: number;      // varianza empírica de las M medias
}

const N_BINS = 41;

/**
 * Genera M medias de N muestras de la base, las histograma y devuelve también
 * la media/varianza empírica del conjunto de medias. El rango del histograma se
 * centra en μ con semiancho 4·√(σ²/N) — donde la gaussiana teórica concentra
 * casi toda su masa — para que la campana siempre se vea completa.
 */
function sampleAndHistogram(dist: BaseDist, N: number, M: number): Hist {
  const sd = Math.sqrt(dist.variance / N); // desviación teórica de X̄
  const lo = dist.mu - 4 * sd;
  const hi = dist.mu + 4 * sd;
  const binWidth = (hi - lo) / N_BINS;
  const counts = new Array<number>(N_BINS).fill(0);

  let sum = 0;
  let sumSq = 0;
  for (let m = 0; m < M; m++) {
    let s = 0;
    for (let i = 0; i < N; i++) s += dist.sample();
    const mean = s / N;
    sum += mean;
    sumSq += mean * mean;
    // bin index
    let b = Math.floor((mean - lo) / binWidth);
    if (b < 0) b = 0;
    if (b >= N_BINS) b = N_BINS - 1;
    counts[b]++;
  }

  let maxCount = 0;
  const binsX: number[] = [];
  for (let b = 0; b < N_BINS; b++) {
    binsX.push(lo + (b + 0.5) * binWidth);
    if (counts[b] > maxCount) maxCount = counts[b];
  }

  const sampleMean = sum / M;
  const sampleVar = Math.max(0, sumSq / M - sampleMean * sampleMean);

  return { binsX, counts, binWidth, lo, hi, maxCount, sampleMean, sampleVar };
}

// Densidad normal teórica N(mu, var), escalada a "conteo esperado por bin".
function gaussianCount(x: number, mu: number, variance: number, binWidth: number, M: number): number {
  const phi = (1 / Math.sqrt(2 * Math.PI * variance)) * Math.exp(-((x - mu) ** 2) / (2 * variance));
  return phi * binWidth * M; // densidad → probabilidad por bin → conteo esperado
}

// ── Geometría de la escena ────────────────────────────────────────────

const PLOT_W = 5;      // ancho del eje X̄ en mundo
const PLOT_H = 2.6;    // alto máximo de barra/curva en mundo
const BAR_DEPTH = 0.18;

// Color de barra: rojo del branch (#EF5350) → amarillo (#FDB813) según altura.
function barColor(t: number): string {
  const a = [0xEF, 0x53, 0x50];
  const b = [0xFD, 0xB8, 0x13];
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

// ── Lección ───────────────────────────────────────────────────────────

const LESSON: Lesson<CLTState> = {
  hook: {
    title: 'Sumas muchas cosas raras… y siempre te sale una campana.',
    body: `Toma cualquier distribución. Una uniforme plana, una exponencial torcidísima, un volado de moneda que solo da 0 o 1, hasta una con dos jorobas separadas.

Ahora saca N valores de ella y promédialos. Repite ese promedio miles de veces y dibuja el histograma de los promedios.

Pasa algo casi mágico: el histograma de las MEDIAS siempre tiende a la misma forma — la campana de Gauss — sin importar qué tan deforme era la distribución original.

Eso es el Teorema del Límite Central. Es la razón por la que la curva normal aparece en todos lados: alturas, errores de medición, ruido, calificaciones. Casi todo lo que observas es, en el fondo, una suma de muchas cositas independientes.`,
  },

  steps: [
    {
      title: 'Una base sesgada: la exponencial',
      duration: 5500,
      body: `Empezamos con la exponencial (λ=1). Es fuertemente asimétrica: muchos valores chiquitos cerca de 0 y una cola larga a la derecha. Para nada una campana.

Aquí ponemos N = 1: cada "media" es UNA sola observación. Por eso el histograma de las medias copia EXACTAMENTE la forma sesgada de la base — sin ninguna campana a la vista.

Fíjate en la curva amarilla: es la gaussiana teórica N(μ, σ²/N) con los valores exactos μ = 1 y σ² = 1. Con N = 1 NO ajusta — la base no es normal.

El TLC no dice que la base sea normal. Dice que lo que pasa al PROMEDIAR muchas sí lo es.`,
      formula: 'Base: Exp(1)   →   μ = 1,  σ² = 1\nN = 1:  X̄ = X₁  (sin promediar)\nN(μ, σ²/N) aún NO ajusta',
      keyframes: [
        { at: 0, state: { distId: 'exponential', N: 1, M: 4000 } },
        { at: 1, state: { distId: 'exponential', N: 1, M: 4000 } },
      ],
    },
    {
      title: 'Promedia unas pocas: N = 5',
      duration: 6000,
      body: `Misma base exponencial, pero ahora cada media promedia N = 5 observaciones.

Mira: el histograma ya se enderezó muchísimo. La cola larga se acortó, el pico se centró cerca de μ = 1, y la forma empieza a parecerse a la campana amarilla.

La gaussiana teórica se estrechó: su varianza es σ²/N = 1/5 = 0.2, así que la desviación es √0.2 ≈ 0.447. Promediar reduce la dispersión por un factor √N.

Con apenas 5 sumandos el efecto ya es visible. El TLC actúa rápido cuando la base tiene varianza finita.`,
      formula: 'N = 5:  X̄ ~ N(1,  1/5)\nσ_X̄ = σ/√N = 1/√5 ≈ 0.447\nel histograma se centra y se endereza',
      keyframes: [
        { at: 0, state: { distId: 'exponential', N: 5, M: 4000 } },
        { at: 1, state: { distId: 'exponential', N: 30, M: 4000 } },
      ],
    },
    {
      title: 'N grande: el abrazo a la campana',
      duration: 6000,
      body: `Subimos hasta N = 60. El histograma de las medias ya es indistinguible de la gaussiana teórica: simétrico, acampanado, centrado en μ = 1.

Y se hizo más angosto todavía: σ/√60 ≈ 0.129. Cuanto más promedias, más se concentran las medias alrededor de μ — esa es la Ley de los Grandes Números escondida adentro del TLC.

La curva amarilla NO se impuso: cae sola encima del histograma porque las matemáticas del muestreo lo obligan.

Compara abajo, en el sandbox: la media empírica de las medias contra μ exacta, y la varianza empírica contra σ²/N. Coinciden hasta el ruido de muestreo.`,
      formula: 'N = 60:  X̄ ≈ N(1,  1/60)\nσ_X̄ ≈ 0.129\nhistograma empírico ≈ gaussiana teórica',
      keyframes: [
        { at: 0, state: { distId: 'exponential', N: 30, M: 4000 } },
        { at: 1, state: { distId: 'exponential', N: 60, M: 4000 } },
      ],
    },
    {
      title: 'No importa la base: Bernoulli y bimodal',
      duration: 6000,
      body: `Cambiamos a Bernoulli p = 0.5: la base solo produce 0 o 1, dos palitos, lo más lejos de una campana que hay.

Aun así, al promediar N = 40 volados, la media muestral (la "proporción de águilas") se vuelve gaussiana alrededor de μ = 0.5. Esto es la aproximación normal a la binomial — De Moivre la descubrió en 1733, mucho antes que Gauss.

Prueba también la base bimodal en el sandbox: dos jorobas separadas en ±2. Sus medias también convergen a una sola campana centrada en μ = 0.

La forma de la base solo cambia QUÉ TAN RÁPIDO converges, nunca el destino: la normal.`,
      formula: 'Bernoulli(0.5):  μ = 0.5,  σ² = 0.25\nN = 40:  X̄ ≈ N(0.5,  0.25/40)\n(De Moivre 1733: normal ≈ binomial)',
      keyframes: [
        { at: 0, state: { distId: 'bernoulli', N: 40, M: 4000 } },
        { at: 1, state: { distId: 'bernoulli', N: 40, M: 4000 } },
      ],
    },
    {
      title: 'El ancho se encoge como σ/√N',
      duration: 5500,
      body: `Última idea, la más útil en la práctica. Volvemos a la uniforme U(0,1): μ = 1/2, σ² = 1/12.

Fija la base y sube N en el sandbox. La campana NO cambia de centro — siempre μ = 1/2 — pero se hace más y más FLACA.

Su ancho mide exactamente σ/√N. Para reducir el error a la mitad necesitas CUATRO veces más datos (porque √4 = 2). Esa raíz de N es la que rige el tamaño de muestra de toda la estadística: encuestas, ensayos clínicos, control de calidad.

El TLC no solo te da la forma (campana): te da la VELOCIDAD exacta a la que tu promedio se vuelve confiable.`,
      formula: 'U(0,1):  μ = 1/2,  σ² = 1/12\nancho de la campana  ∝  σ/√N\nerror ÷ 2  ⇒  datos × 4',
      keyframes: [
        { at: 0, state: { distId: 'uniform', N: 2, M: 4000 } },
        { at: 1, state: { distId: 'uniform', N: 50, M: 4000 } },
      ],
    },
  ],

  connect: {
    body: `El Teorema del Límite Central es el puente entre el azar individual y la regularidad colectiva.

A dónde te lleva:

• Intervalos de confianza y pruebas de hipótesis: toda la inferencia clásica asume que el estadístico es ≈ normal por el TLC.
• Tamaño de muestra: el factor √N decide cuántos datos necesitas para una precisión dada.
• Ley de los Grandes Números: el caso límite donde la varianza σ²/N → 0 y la media muestral colapsa en μ.
• Movimiento browniano y procesos de difusión: una suma de muchos golpes independientes converge a un proceso gaussiano.
• Sus límites: si la base tiene varianza INFINITA (tipo Cauchy o colas de potencia), el TLC clásico falla y aparecen las distribuciones estables de Lévy — clave en finanzas de cola pesada.

Juega en el sandbox: cambia la base, sube N, sube M, y observa cómo la campana emerge sola del muestreo.`,
    links: [
      { label: 'Cadenas de Markov — del azar a la distribución estacionaria', href: '#markov' },
      { label: 'Monte Carlo — integrar por sorteo aleatorio', href: '#monte-carlo' },
      { label: 'PCA — covarianza y la geometría de la varianza', href: '#pca' },
    ],
  },
};

// ── Componente ────────────────────────────────────────────────────────

export default function CentralLimit() {
  const { audience } = useAudience();
  const [distId, setDistId] = useState<string>('exponential');
  const [N, setN] = useState<number>(1);
  const [M, setM] = useState<number>(4000);
  const [seed, setSeed] = useState<number>(0);

  const dist = useMemo(() => DISTS.find(d => d.id === distId)!, [distId]);

  // Muestreo + histograma REAL. Recalcula al cambiar base, N, M o semilla.
  const hist = useMemo(
    () => sampleAndHistogram(dist, Math.max(1, Math.round(N)), Math.max(1, Math.round(M))),
    [dist, N, M, seed],
  );

  // Varianza teórica de la media muestral X̄.
  const theoVar = dist.variance / Math.max(1, Math.round(N));
  const theoSd = Math.sqrt(theoVar);

  // Escala mundo: el eje X̄ ∈ [lo, hi] se mapea a [−PLOT_W/2, +PLOT_W/2].
  const span = hist.hi - hist.lo;
  const worldX = (x: number) => ((x - hist.lo) / span - 0.5) * PLOT_W;

  // Altura máxima de referencia: el mayor entre el conteo pico y la gaussiana
  // teórica pico, para que barras y curva compartan escala vertical.
  const peakGauss = gaussianCount(dist.mu, dist.mu, theoVar, hist.binWidth, Math.round(M));
  const peak = Math.max(hist.maxCount, peakGauss, 1);
  const worldY = (count: number) => (count / peak) * PLOT_H;

  // Barras del histograma (3D, emisivas).
  const barWidthWorld = (PLOT_W / N_BINS) * 0.82;
  const bars = hist.binsX.map((cx, b) => {
    const h = worldY(hist.counts[b]);
    const t = peak > 0 ? hist.counts[b] / peak : 0;
    return { x: worldX(cx), h, color: barColor(t), t };
  });

  // Curva gaussiana teórica (línea brillante encima de las barras).
  const gaussPts = useMemo(() => {
    const pts: [number, number, number][] = [];
    const STEPS = 160;
    for (let i = 0; i <= STEPS; i++) {
      const x = hist.lo + (span * i) / STEPS;
      const c = gaussianCount(x, dist.mu, theoVar, hist.binWidth, Math.round(M));
      pts.push([worldX(x), worldY(c), BAR_DEPTH / 2 + 0.02]);
    }
    return pts;
  }, [hist, dist, theoVar, span, M]);

  // Marcas del eje X̄: μ y μ ± σ_X̄.
  const tickXs = [dist.mu - theoSd, dist.mu, dist.mu + theoSd].filter(x => x >= hist.lo && x <= hist.hi);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={6.5} bloomIntensity={0.6} bloomThreshold={0.5} bgColor="#05060A" captureMode>
          <CanvasCapture />

          {/* Eje X̄ (base del histograma) */}
          <Line
            points={[[-PLOT_W / 2 - 0.2, 0, 0], [PLOT_W / 2 + 0.2, 0, 0]]}
            color="#475569"
            lineWidth={1.5}
          />

          {/* Marcas verticales en μ y μ ± σ_X̄ */}
          {tickXs.map((tx, i) => {
            const isMu = Math.abs(tx - dist.mu) < 1e-9;
            return (
              <Line
                key={i}
                points={[[worldX(tx), 0, 0], [worldX(tx), PLOT_H * 0.95, 0]]}
                color={isMu ? '#38BDF8' : '#1E293B'}
                lineWidth={isMu ? 1.5 : 1}
                transparent
                opacity={isMu ? 0.7 : 0.5}
                dashed={!isMu}
                dashSize={0.08}
                gapSize={0.08}
              />
            );
          })}

          {/* Barras del histograma (emisivas) */}
          {bars.map((bar, i) => (
            <mesh key={i} position={[bar.x, bar.h / 2, 0]}>
              <boxGeometry args={[barWidthWorld, Math.max(bar.h, 1e-4), BAR_DEPTH]} />
              <meshStandardMaterial
                color={bar.color}
                emissive={bar.color}
                emissiveIntensity={0.45 + bar.t * 0.9}
                roughness={0.4}
                metalness={0.1}
              />
            </mesh>
          ))}

          {/* Curva gaussiana teórica N(μ, σ²/N) — línea brillante */}
          <Line points={gaussPts} color="#FDB813" lineWidth={3} />

          {/* Etiqueta del eje vía Html (NO drei Text → no rompe el EffectComposer) */}
          <Html position={[PLOT_W / 2 + 0.35, 0, 0]} center distanceFactor={9} pointerEvents="none">
            <div style={{ color: '#64748B', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>X̄</div>
          </Html>
          <Html position={[worldX(dist.mu), -0.28, 0]} center distanceFactor={9} pointerEvents="none">
            <div style={{ color: '#38BDF8', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>μ = {dist.mu.toFixed(3)}</div>
          </Html>
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#EF5350]">▮</span> histograma de medias X̄</div>
          <div><span className="text-[#FDB813]">━</span> gaussiana teórica N(μ, σ²/N)</div>
          <div><span className="text-[#38BDF8]">┆</span> μ y μ ± σ_X̄</div>
          <div className="text-[#94A3B8] mt-1">N = {Math.round(N)} · {Math.round(M).toLocaleString('es-MX')} medias</div>
        </div>
      </div>

      <LessonPanel<CLTState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.distId !== undefined) setDistId(patch.distId);
          if (patch.N !== undefined) setN(patch.N);
          if (patch.M !== undefined) setM(patch.M);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Distribución base</div>
              <div className="grid grid-cols-1 gap-1.5">
                {DISTS.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setDistId(d.id)}
                    className={`text-left text-[11px] px-2 py-1.5 rounded border transition ${
                      distId === d.id
                        ? 'bg-[#EF5350]/12 border-[#EF5350]/45 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#EF5350]/30'
                    }`}
                  >
                    <div className="font-semibold">{d.label}</div>
                    <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">{d.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3 space-y-3">
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-[#94A3B8]">N — muestras por media</span>
                  <span className="text-white font-mono">{Math.round(N)}</span>
                </div>
                <input
                  type="range" min={1} max={100} step={1} value={N}
                  onChange={e => setN(Number(e.target.value))}
                  className="w-full accent-[#EF5350]"
                />
                <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">
                  N grande → campana más angosta (σ/√N).
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-[#94A3B8]"># medias (repeticiones)</span>
                  <span className="text-white font-mono">{Math.round(M).toLocaleString('es-MX')}</span>
                </div>
                <input
                  type="range" min={200} max={20000} step={200} value={M}
                  onChange={e => setM(Number(e.target.value))}
                  className="w-full accent-[#FDB813]"
                />
                <div className="text-[10px] text-[#64748B] mt-0.5 leading-snug">
                  Más medias → histograma menos ruidoso.
                </div>
              </div>

              <button
                onClick={() => setSeed(s => s + 1)}
                className="w-full text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#EF5350]/40 hover:text-white"
              >
                ↻ re-muestrear
              </button>
            </div>

            {/* Teoría vs empírico — la corrección numérica en vivo */}
            <div className="border-t border-[#1E293B] pt-3 space-y-1.5 text-[11px] font-mono">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">Teoría vs muestreo</div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">μ teórica</span>
                <span className="text-[#38BDF8]">{dist.mu.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">media de las X̄</span>
                <span className="text-white">{hist.sampleMean.toFixed(4)}</span>
              </div>
              <div className="flex justify-between border-t border-[#1E293B] pt-1 mt-1">
                <span className="text-[#94A3B8]">σ²/N teórica</span>
                <span className="text-[#FDB813]">{theoVar.toFixed(5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">var. de las X̄</span>
                <span className="text-white">{hist.sampleVar.toFixed(5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">σ_X̄ = σ/√N</span>
                <span className="text-[#FDB813]">{theoSd.toFixed(4)}</span>
              </div>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                X̄ = (1/N)Σ Xᵢ. Lindeberg-Lévy: √N(X̄−μ)/σ → N(0,1) en distribución, con σ²&lt;∞.
                El histograma es muestreo real (M medias de N muestras); la curva es la densidad exacta.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
