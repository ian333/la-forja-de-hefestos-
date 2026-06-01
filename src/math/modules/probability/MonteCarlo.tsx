/**
 * Monte Carlo — estimar π por sorteo de dardos.
 *
 *   Tira dardos al azar, uniformemente, dentro del cuadrado [−1,1]×[−1,1].
 *   El cuadrado tiene área 4. El disco unitario inscrito (x² + y² ≤ 1) tiene
 *   área π. Por lo tanto, si los dardos caen de forma uniforme, la fracción que
 *   cae DENTRO del disco tiende a la razón de áreas:
 *
 *       P(dentro)  =  área del disco / área del cuadrado  =  π / 4.
 *
 *   Despejando, una estimación insesgada de π a partir de N dardos es:
 *
 *       π̂ = 4 · (dardos dentro / N).
 *
 * Aquí NO se dibuja una curva inventada. Se SORTEA de verdad: cada dardo usa el
 * generador pseudoaleatorio del navegador (Math.random) para muestrear
 *
 *       x = 2·U₁ − 1,   y = 2·U₂ − 1,    U₁,U₂ ~ Uniforme(0,1),
 *
 * y se cuenta x²+y² ≤ 1. La estimación π̂ se recalcula en vivo conforme caen
 * más dardos, y se grafica su CONVERGENCIA.
 *
 * El error obedece la ley del Monte Carlo (consecuencia del TLC): el indicador
 * "dentro/fuera" es Bernoulli con p = π/4, así que la media muestral tiene
 * desviación estándar
 *
 *       σ_π̂  =  4 · √( p(1−p) / N )  ≈  1.6422 / √N.
 *
 * Es decir: el error baja como 1/√N — para una cifra decimal más necesitas
 * ~100× más dardos. Lento, pero indiferente a la dimensión: por eso Monte Carlo
 * gana en integrales de muchas variables.
 *
 * Visual: nube de dardos emisivos (dorado = dentro del disco, gris = fuera)
 * sobre el cuadrado con el disco unitario dibujado; la estimación de π
 * convergiendo en una traza al lado; controles para soltar más dardos.
 */

import { useMemo, useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/math/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import CanvasCapture from '@/math/components/CanvasCapture';

// ── Estado de la lección ──────────────────────────────────────────────

interface MCState {
  /** Número de dardos sorteados (controla la nube y la estimación). */
  N: number;
}

// ── Sorteo REAL + estimación ──────────────────────────────────────────

interface Dart {
  x: number;
  y: number;
  inside: boolean;
}

interface MCResult {
  darts: Dart[];        // muestra de dardos (truncada para dibujar)
  inside: number;       // dardos dentro del disco (sobre el total N)
  total: number;        // N efectivo
  piHat: number;        // estimación 4·inside/N
  /** Traza de la estimación π̂ acumulada conforme caen dardos (para graficar). */
  trace: { n: number; piHat: number }[];
}

// Máximo de dardos a DIBUJAR (la estimación usa N completo; la nube se trunca
// para no reventar el número de meshes en pantalla).
const MAX_DRAW = 4000;

/**
 * Sorteo uniforme REAL en [−1,1]² con Math.random(). Acumula la fracción dentro
 * del disco unitario, construye la traza de convergencia de π̂ en escala
 * logarítmica de N, y guarda una submuestra de dardos para dibujar.
 */
function runMonteCarlo(N: number, seedBump: number): MCResult {
  // seedBump solo fuerza recomputo; Math.random no es sembrable, así que cada
  // re-sorteo es una corrida nueva e independiente (esa es la idea).
  void seedBump;

  const total = Math.max(1, Math.round(N));
  const darts: Dart[] = [];
  // Submuestreo determinista para dibujar a lo más MAX_DRAW dardos repartidos
  // por toda la corrida (no solo los primeros).
  const drawEvery = Math.max(1, Math.ceil(total / MAX_DRAW));

  // Puntos de la traza repartidos log-uniformemente en [1, total].
  const TRACE_PTS = 60;
  const traceTargets: number[] = [];
  for (let k = 0; k <= TRACE_PTS; k++) {
    const f = k / TRACE_PTS;
    const n = Math.round(Math.pow(total, f)); // 1 → total en escala log
    if (n >= 1 && (traceTargets.length === 0 || n > traceTargets[traceTargets.length - 1])) {
      traceTargets.push(n);
    }
  }
  let nextTraceIdx = 0;

  let inside = 0;
  const trace: { n: number; piHat: number }[] = [];

  for (let i = 1; i <= total; i++) {
    const x = 2 * Math.random() - 1;
    const y = 2 * Math.random() - 1;
    const isIn = x * x + y * y <= 1;
    if (isIn) inside++;

    if ((i - 1) % drawEvery === 0 && darts.length < MAX_DRAW) {
      darts.push({ x, y, inside: isIn });
    }
    while (nextTraceIdx < traceTargets.length && traceTargets[nextTraceIdx] === i) {
      trace.push({ n: i, piHat: (4 * inside) / i });
      nextTraceIdx++;
    }
  }
  // Garantiza que el último punto de la traza sea el N completo.
  if (trace.length === 0 || trace[trace.length - 1].n !== total) {
    trace.push({ n: total, piHat: (4 * inside) / total });
  }

  return { darts, inside, total, piHat: (4 * inside) / total, trace };
}

// Desviación estándar teórica de π̂ con N dardos (Bernoulli p = π/4):
//   σ = 4·√(p(1−p)/N),  p = π/4.
function theoStdErr(N: number): number {
  const p = Math.PI / 4;
  return 4 * Math.sqrt((p * (1 - p)) / Math.max(1, N));
}

// ── Geometría de la escena ────────────────────────────────────────────

// El cuadrado [−1,1]² se mapea a [−HALF, HALF]² en mundo.
const HALF = 2.4;            // semiancho del cuadrado en unidades de mundo
const world = (u: number) => u * HALF;  // u ∈ [−1,1] → mundo

// Panel de convergencia a la derecha del cuadrado.
const TRACE_X0 = HALF + 0.9;     // borde izquierdo del panel de traza
const TRACE_W = 3.0;             // ancho del panel
const TRACE_Y_C = 0;             // centro vertical (alineado a π)
const TRACE_H = 2.0;             // semialto: cubre π ± rango
const PI_LO = Math.PI - 1.0;     // valores de π̂ visibles abajo
const PI_HI = Math.PI + 1.0;     // y arriba

// mapea un valor de π̂ al eje vertical del panel de traza
const traceY = (piHat: number) => {
  const t = (piHat - PI_LO) / (PI_HI - PI_LO); // 0..1
  return (t - 0.5) * 2 * TRACE_H + TRACE_Y_C;
};
// mapea log(n)/log(total) ∈ [0,1] al eje horizontal del panel
const traceX = (logFrac: number) => TRACE_X0 + logFrac * TRACE_W;

// ── Lección ───────────────────────────────────────────────────────────

const LESSON: Lesson<MCState> = {
  hook: {
    title: 'Tira dardos al azar… y te sale π.',
    body: `Dibuja un cuadrado y, dentro, el círculo más grande que quepa. Ahora cierra los ojos y tira dardos al azar, sin apuntar, repartidos parejo por todo el cuadrado.

Cuenta cuántos cayeron dentro del círculo y divídelo entre el total. Multiplica por 4. El número que te sale se va acercando a π = 3.14159…

¿Por qué? El cuadrado [−1,1]×[−1,1] tiene área 4. El círculo de radio 1 tiene área π. Si los dardos caen uniformes, la fracción que cae dentro del círculo es la razón de áreas: π/4. Despejas π y listo.

Esto es Monte Carlo: estimar una cantidad difícil (un área, una integral) por puro SORTEO aleatorio. Lo inventaron Ulam y von Neumann en Los Álamos (1946) para simular neutrones, y hoy mueve desde finanzas hasta render de películas.`,
  },

  steps: [
    {
      title: 'Pocos dardos: la estimación brinca',
      duration: 5500,
      body: `Empezamos con apenas unos cuantos dardos cayendo en el cuadrado. Los dorados cayeron DENTRO del disco (x² + y² ≤ 1); los grises, afuera.

Mira la estimación π̂ = 4·(dentro/total) en el panel: con pocos dardos salta muchísimo de un valor a otro. A veces 2.8, a veces 3.4. Es puro ruido de muestreo.

Cada dardo es un volado sesgado: cae dentro con probabilidad p = π/4 ≈ 0.785. Con poquitos volados, la proporción observada está lejos de p.

El sorteo es REAL: cada coordenada sale de Math.random(), el generador pseudoaleatorio del navegador. No hay ninguna curva pintada a mano.`,
      formula: 'x = 2U₁ − 1,  y = 2U₂ − 1,   U ~ Unif(0,1)\ndentro ⇔ x² + y² ≤ 1\nπ̂ = 4 · (dentro / N)',
      keyframes: [
        { at: 0, state: { N: 30 } },
        { at: 1, state: { N: 200 } },
      ],
    },
    {
      title: 'Más dardos: la nube llena el disco',
      duration: 6000,
      body: `Subimos a unos miles de dardos. Ahora la nube dorada DIBUJA el disco: la densidad de puntos es pareja porque el sorteo es uniforme, así que los dorados tapizan exactamente el área π.

La estimación π̂ ya se quedó cerca de 3.14 y deja de brincar tanto. La traza en el panel se está aplanando alrededor de la línea de π.

Esto es la Ley de los Grandes Números en acción: la proporción de dardos dentro converge a la probabilidad real p = π/4, y por lo tanto π̂ converge a π.

Fíjate: la convergencia NO es perfecta ni monótona. Tiembla. La pregunta interesante es: ¿qué tan rápido se calma ese temblor?`,
      formula: 'P(dentro) = área disco / área cuadrado = π/4\nLLN:  dentro/N → π/4  ⇒  π̂ → π',
      keyframes: [
        { at: 0, state: { N: 200 } },
        { at: 1, state: { N: 3000 } },
      ],
    },
    {
      title: 'La ley del error: σ ~ 1/√N',
      duration: 6000,
      body: `Aquí está el corazón del método. El indicador "dentro/fuera" es una variable Bernoulli con p = π/4. La estimación π̂ es 4 veces su media muestral, así que su error estándar es exactamente

σ_π̂ = 4·√( p(1−p)/N ) ≈ 1.6422 / √N.

Mira las bandas punteadas π ± σ en el panel: se ESTRECHAN como 1/√N conforme caen más dardos. La traza de π̂ se mantiene casi siempre dentro de esa banda.

La consecuencia es brutal: para ganar UNA cifra decimal (error ÷ 10) necesitas 100× MÁS dardos. Monte Carlo es lento. Con 10⁴ dardos el error típico ronda 0.016; con 10⁶ apenas baja a 0.0016.`,
      formula: 'indicador ~ Bernoulli(p),  p = π/4\nσ_π̂ = 4·√(p(1−p)/N) ≈ 1.6422/√N\nerror ÷ 10  ⇒  dardos × 100',
      keyframes: [
        { at: 0, state: { N: 3000 } },
        { at: 1, state: { N: 20000 } },
      ],
    },
    {
      title: 'Muchísimos dardos: π̂ abraza a π',
      duration: 5500,
      body: `Soltamos decenas de miles de dardos. La traza de π̂ ya casi no se despega de la línea de π, y la banda ±σ se hizo finita.

En el sandbox compara π̂ contra el valor exacto π = 3.141592653…: la diferencia |π̂ − π| es del orden de σ_π̂, justo lo que predice la teoría. No coincide por suerte: coincide porque las matemáticas del muestreo lo obligan.

Súbele tú a N y aprieta "re-sortear": cada corrida es independiente (Math.random no se siembra), así que verás cómo el resultado fluctúa de corrida en corrida dentro de la banda ±σ. Esa fluctuación ES la incertidumbre del método.

Ahí ves Monte Carlo en estado puro: convergencia garantizada, pero al ritmo lento e inexorable de 1/√N.`,
      formula: 'N grande:  |π̂ − π| ~ σ_π̂ ~ 1/√N\nπ = 3.14159265358979…\ncada corrida es independiente (sin semilla)',
      keyframes: [
        { at: 0, state: { N: 20000 } },
        { at: 1, state: { N: 60000 } },
      ],
    },
  ],

  connect: {
    body: `Acabas de integrar una función (el área del disco) sin resolver ninguna integral: solo sorteando puntos. Esa es la idea entera de Monte Carlo.

A dónde te lleva:

• Integración en muchas dimensiones: las cuadraturas clásicas (Simpson, trapecio) explotan con la dimensión (la "maldición de la dimensionalidad"); Monte Carlo NO — su error sigue siendo 1/√N sin importar cuántas variables haya. Por eso domina en física de partículas, finanzas y render.

• Reducción de varianza: muestreo por importancia, variables antitéticas, control variates — trucos para bajar la constante del 1/√N sin tirar más dardos.

• Quasi-Monte Carlo: cambiar Math.random por secuencias de baja discrepancia (Sobol, Halton) para que el error baje como ~1/N en vez de 1/√N.

• Cadenas de Markov (MCMC): cuando no sabes muestrear directo de la distribución, construyes una cadena que la tiene como estacionaria — Metropolis-Hastings, Gibbs. Es la base de la estadística bayesiana moderna.

Juega en el sandbox: sube N, re-sortea y observa cómo π̂ baila dentro de la banda ±σ que se encoge como 1/√N.`,
    links: [
      { label: 'Teorema del límite central — de dónde sale la ley 1/√N', href: '#central-limit' },
      { label: 'Cadenas de Markov — muestreo cuando no sabes muestrear', href: '#markov' },
      { label: 'Integral y área — lo que Monte Carlo estima', href: '#integral-area' },
    ],
  },
};

// ── Componente ────────────────────────────────────────────────────────

export default function MonteCarlo() {
  const { audience } = useAudience();
  const [N, setN] = useState<number>(30);
  const [seed, setSeed] = useState<number>(0);

  // Sorteo REAL. Recalcula al cambiar N o al re-sortear.
  const mc = useMemo(() => runMonteCarlo(Math.max(1, Math.round(N)), seed), [N, seed]);

  // Geometría de la nube: una sola InstancedMesh-like vía meshes individuales
  // sería caro; usamos puntos como instancias de esferas pequeñas emisivas.
  // Para mantener TS estricto, separamos dentro/fuera en dos buffers de posición.
  const insidePos = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (const d of mc.darts) if (d.inside) arr.push([world(d.x), world(d.y), 0.02]);
    return arr;
  }, [mc]);
  const outsidePos = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (const d of mc.darts) if (!d.inside) arr.push([world(d.x), world(d.y), 0.02]);
    return arr;
  }, [mc]);

  // Borde del cuadrado [−1,1]².
  const squarePts = useMemo<[number, number, number][]>(() => {
    const s = HALF;
    return [
      [-s, -s, 0], [s, -s, 0], [s, s, 0], [-s, s, 0], [-s, -s, 0],
    ];
  }, []);

  // Disco unitario (círculo de radio 1 → radio HALF en mundo).
  const circlePts = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    const STEPS = 180;
    for (let i = 0; i <= STEPS; i++) {
      const th = (i / STEPS) * Math.PI * 2;
      pts.push([Math.cos(th) * HALF, Math.sin(th) * HALF, 0.01]);
    }
    return pts;
  }, []);

  // Traza de convergencia de π̂ (escala log en N).
  const total = mc.total;
  const logTot = Math.log(Math.max(2, total));
  const tracePts = useMemo<[number, number, number][]>(() => {
    return mc.trace.map(({ n, piHat }) => {
      const lf = logTot > 0 ? Math.log(Math.max(1, n)) / logTot : 1;
      const clampedPi = Math.max(PI_LO, Math.min(PI_HI, piHat));
      return [traceX(lf), traceY(clampedPi), 0];
    });
  }, [mc.trace, logTot]);

  // Bandas teóricas π ± σ(n) sobre el panel (también función de N → se encogen).
  const bandUpper = useMemo<[number, number, number][]>(() => {
    return mc.trace.map(({ n }) => {
      const lf = logTot > 0 ? Math.log(Math.max(1, n)) / logTot : 1;
      const v = Math.min(PI_HI, Math.PI + theoStdErr(n));
      return [traceX(lf), traceY(v), 0];
    });
  }, [mc.trace, logTot]);
  const bandLower = useMemo<[number, number, number][]>(() => {
    return mc.trace.map(({ n }) => {
      const lf = logTot > 0 ? Math.log(Math.max(1, n)) / logTot : 1;
      const v = Math.max(PI_LO, Math.PI - theoStdErr(n));
      return [traceX(lf), traceY(v), 0];
    });
  }, [mc.trace, logTot]);

  // Línea de π exacta a lo ancho del panel.
  const piLinePts = useMemo<[number, number, number][]>(() => {
    return [
      [traceX(0), traceY(Math.PI), 0],
      [traceX(1), traceY(Math.PI), 0],
    ];
  }, []);

  const sigma = theoStdErr(total);
  const err = Math.abs(mc.piHat - Math.PI);

  // Refs tipados (no estrictamente necesarios, pero el template los usa).
  const cloudRef = useRef<THREE.Group>(null);

  return (
    <div className="w-full h-full grid grid-cols-[1fr_360px] gap-3">
      <div className="relative rounded-lg overflow-hidden border border-[#1E293B]">
        <Stage cameraDistance={9} bloomIntensity={0.6} bloomThreshold={0.5} bgColor="#05060A" captureMode>
          <CanvasCapture />

          {/* Cuadrado [−1,1]² */}
          <Line points={squarePts} color="#475569" lineWidth={1.5} />

          {/* Disco unitario inscrito */}
          <Line points={circlePts} color="#38BDF8" lineWidth={2} transparent opacity={0.85} />

          {/* Nube de dardos */}
          <group ref={cloudRef}>
            {insidePos.map((p, i) => (
              <mesh key={`in-${i}`} position={p}>
                <sphereGeometry args={[0.026, 8, 8]} />
                <meshStandardMaterial
                  color="#FDB813"
                  emissive="#FDB813"
                  emissiveIntensity={1.1}
                  toneMapped={false}
                  roughness={0.4}
                />
              </mesh>
            ))}
            {outsidePos.map((p, i) => (
              <mesh key={`out-${i}`} position={p}>
                <sphereGeometry args={[0.022, 8, 8]} />
                <meshStandardMaterial
                  color="#64748B"
                  emissive="#334155"
                  emissiveIntensity={0.35}
                  roughness={0.6}
                />
              </mesh>
            ))}
          </group>

          {/* Panel de convergencia: marco + π exacta + bandas ±σ + traza π̂ */}
          {/* Eje vertical del panel */}
          <Line
            points={[[traceX(0), traceY(PI_LO), 0], [traceX(0), traceY(PI_HI), 0]]}
            color="#475569"
            lineWidth={1}
          />
          {/* Línea de π exacta */}
          <Line points={piLinePts} color="#38BDF8" lineWidth={1.5} transparent opacity={0.8} />
          {/* Bandas teóricas π ± σ(n) */}
          <Line points={bandUpper} color="#94A3B8" lineWidth={1} transparent opacity={0.5} dashed dashSize={0.1} gapSize={0.1} />
          <Line points={bandLower} color="#94A3B8" lineWidth={1} transparent opacity={0.5} dashed dashSize={0.1} gapSize={0.1} />
          {/* Traza de π̂ (rojo del branch → brilla con el bloom) */}
          {tracePts.length >= 2 && (
            <Line points={tracePts} color="#EF5350" lineWidth={3} />
          )}
          {/* Punto final destacado en la estimación actual */}
          {tracePts.length > 0 && (
            <mesh position={tracePts[tracePts.length - 1]}>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial color="#EF5350" emissive="#EF5350" emissiveIntensity={1.4} toneMapped={false} />
            </mesh>
          )}

          {/* Etiquetas vía Html (NO drei Text → no rompe el EffectComposer) */}
          <Html position={[traceX(0), traceY(Math.PI), 0]} center distanceFactor={12} pointerEvents="none">
            <div style={{ color: '#38BDF8', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap', transform: 'translateX(-26px)' }}>π</div>
          </Html>
          <Html position={[traceX(0.5), traceY(PI_LO) - 0.18, 0]} center distanceFactor={12} pointerEvents="none">
            <div style={{ color: '#64748B', fontSize: 10, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>N (escala log) →</div>
          </Html>
          <Html position={[0, world(1) + 0.28, 0]} center distanceFactor={12} pointerEvents="none">
            <div style={{ color: '#94A3B8', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>cuadrado [−1,1]² · disco r = 1</div>
          </Html>
        </Stage>

        <div className="absolute top-3 left-3 text-[11px] font-mono space-y-1 text-[#CBD5E1]
                        bg-[#05060A]/70 backdrop-blur px-3 py-2 rounded border border-[#1E293B]">
          <div><span className="text-[#FDB813]">●</span> dardo dentro del disco</div>
          <div><span className="text-[#64748B]">●</span> dardo fuera</div>
          <div><span className="text-[#EF5350]">━</span> π̂ = 4·(dentro/N)</div>
          <div><span className="text-[#38BDF8]">━</span> π exacta · <span className="text-[#94A3B8]">┈</span> π ± σ</div>
          <div className="text-[#94A3B8] mt-1">N = {total.toLocaleString('es-MX')} · π̂ = {mc.piHat.toFixed(4)}</div>
        </div>
      </div>

      <LessonPanel<MCState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.N !== undefined) setN(patch.N);
        }}
        sandbox={
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">Dardos sorteados (N)</div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-[#94A3B8]">N</span>
                <span className="text-white font-mono">{total.toLocaleString('es-MX')}</span>
              </div>
              <input
                type="range" min={1} max={5} step={0.01}
                value={Math.log10(Math.max(1, N))}
                onChange={e => setN(Math.round(Math.pow(10, Number(e.target.value))))}
                className="w-full accent-[#EF5350]"
              />
              <div className="flex justify-between text-[9px] text-[#475569] font-mono mt-0.5">
                <span>10</span><span>100</span><span>1k</span><span>10k</span><span>100k</span>
              </div>
              <div className="text-[10px] text-[#64748B] mt-1 leading-snug">
                Escala logarítmica: cada paso multiplica los dardos. Más dardos → banda ±σ más angosta (∝ 1/√N).
              </div>
            </div>

            <div className="border-t border-[#1E293B] pt-3">
              <div className="grid grid-cols-2 gap-1.5">
                {[100, 1000, 10000, 100000].map(n => (
                  <button
                    key={n}
                    onClick={() => setN(n)}
                    className={`text-[11px] px-2 py-1.5 rounded border font-mono transition ${
                      total === n
                        ? 'bg-[#EF5350]/12 border-[#EF5350]/45 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#EF5350]/30'
                    }`}
                  >
                    {n.toLocaleString('es-MX')}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSeed(s => s + 1)}
                className="w-full mt-2 text-[11px] px-2 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-[#EF5350]/40 hover:text-white"
              >
                ↻ re-sortear (corrida independiente)
              </button>
            </div>

            {/* Estimación vs valor exacto — la corrección numérica en vivo */}
            <div className="border-t border-[#1E293B] pt-3 space-y-1.5 text-[11px] font-mono">
              <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">Estimación vs exacto</div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">dentro / N</span>
                <span className="text-white">{mc.inside.toLocaleString('es-MX')} / {total.toLocaleString('es-MX')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">π̂ = 4·(dentro/N)</span>
                <span className="text-[#EF5350]">{mc.piHat.toFixed(5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">π exacta</span>
                <span className="text-[#38BDF8]">{Math.PI.toFixed(5)}</span>
              </div>
              <div className="flex justify-between border-t border-[#1E293B] pt-1 mt-1">
                <span className="text-[#94A3B8]">|π̂ − π|</span>
                <span className="text-white">{err.toFixed(5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">σ_π̂ ≈ 1.6422/√N</span>
                <span className="text-[#FDB813]">{sigma.toFixed(5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">|π̂ − π| / σ_π̂</span>
                <span className={err <= 2 * sigma ? 'text-[#34D399]' : 'text-[#EF5350]'}>
                  {(err / Math.max(sigma, 1e-9)).toFixed(2)}σ
                </span>
              </div>
            </div>

            {audience !== 'child' && (
              <div className="border-t border-[#1E293B] pt-3 text-[11px] text-[#64748B] leading-relaxed">
                Indicador 1[x²+y²≤1] ~ Bernoulli(p), p = π/4. π̂ = 4·X̄ es insesgado; Var(π̂) = 16·p(1−p)/N.
                El error 1/√N es independiente de la dimensión — por eso Monte Carlo gana en integrales de alta dimensión.
              </div>
            )}
          </>
        }
      />
    </div>
  );
}
