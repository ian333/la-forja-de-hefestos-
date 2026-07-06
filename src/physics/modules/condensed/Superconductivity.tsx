/**
 * Superconductividad — Pares de Cooper, gap BCS Δ(T), efecto Meissner.
 *
 * Física real implementada:
 *   - Gap BCS: Δ(T) = Δ₀ · tanh(1.74 · √((Tc/T) − 1))   (Mühlschlegel 1959)
 *     con Δ₀ = 1.764 · kB · Tc  (acoplamiento débil BCS)
 *   - Campo de expulsión Meissner: B_inside = 0 en el SC; el campo externo
 *     se expulsa → imagen de dipolo magnético refleja el campo.
 *   - Levitación: fuerza F = −∇(m·B) = fuerza repulsiva sobre un dipolo
 *     magnético encima del SC. Equilibrio: F_lev = mg.
 *     Altura de equilibrio h* tal que |dB/dz| = mg / m_mag.
 *   - Imagen del dipolo: campo total sobre el SC = dipolo real + dipolo imagen
 *     (reflectado en z=0) — esto satisface B_n = 0 en la superficie SC.
 *   - Densidad superfluida (Gorter-Casimir dos fluidos):
 *     n_s/n = 1 − (T/Tc)⁴
 *   - Longitud de penetración: λ(T) = λ₀ / √(n_s/n)
 *     → diverge a T→Tc (transición de 2º orden).
 *
 * Visualización 3D:
 *   - Bloque SC con efecto de expulsión de líneas de campo (field lines verdes)
 *     que se curvan alrededor del SC en tiempo real.
 *   - Imán flotante con levitación física real (altura calculada, no fija).
 *   - Pares de Cooper como partículas orbitando — el gap BCS vivo en T.
 *   - Panel de estado: Δ(T), λ(T), n_s/n.
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ─── Constantes físicas ──────────────────────────────────────────────────────

const KB = 1.380649e-23;   // J/K

// Material: YBCO (YBa₂Cu₃O₇) — superconductor de alta Tc
const TC_YBCO  = 93;      // K
const LAMBDA0  = 140e-9;  // m (longitud de penetración a T=0)
// Gap BCS (acoplamiento débil, válido para s-wave): Δ₀ = 1.764 kB Tc
const DELTA0   = 1.764 * KB * TC_YBCO;  // J  ≈ 14.2 meV

/** Gap BCS Mühlschlegel: Δ(T)/Δ₀ = tanh(1.74√(Tc/T − 1)), válido T < Tc */
function bcsDelta(T: number, Tc: number, delta0: number): number {
  if (T <= 0) return delta0;
  if (T >= Tc) return 0;
  const x = Tc / T - 1;
  if (x <= 0) return 0;
  return delta0 * Math.tanh(1.74 * Math.sqrt(x));
}

/** Densidad superfluida normalizada (Gorter-Casimir): n_s/n = 1 − (T/Tc)⁴ */
function superfluidFraction(T: number, Tc: number): number {
  if (T >= Tc) return 0;
  const t = T / Tc;
  return Math.max(0, 1 - t * t * t * t);
}

/** Longitud de penetración London: λ(T) = λ₀ / √(n_s/n), en nm */
function londonLambda(T: number, Tc: number, lambda0: number): number {
  const ns = superfluidFraction(T, Tc);
  if (ns <= 0) return Infinity;
  return lambda0 / Math.sqrt(ns);
}

/**
 * Altura de levitación Meissner.
 * El campo de un dipolo m sobre un plano SC perfecto = dipolo + imagen.
 * Campo sobre la superficie (método de imágenes): B_z(h) = (μ₀/4π) · 2m/h³.
 * Fuerza de repulsión: F = m · (dB_z/dz) en z = h → F = (3μ₀m²)/(2π h⁴).
 * Equilibrio: F = Mg → h* = ((3μ₀m²)/(2π Mg))^(1/4).
 * Aquí escalamos en unidades de visualización (h en unidades de escena).
 *
 * Para la sim usamos: m_mag en unidades normalizadas, M = masa del imán.
 * El resultado h* se clampea a [0.3, 3.5] para la visualización.
 */
function levitationHeight(m_mag: number, M: number, g = 9.81): number {
  const MU0 = 4 * Math.PI * 1e-7;
  // En SI puro esto daría metros muy pequeños, escalamos:
  // Factor de escena: 1 unidad de escena = 0.1 m, masa en gramos→kg /1000
  const M_kg  = M / 1000;
  const m_SI  = m_mag * 0.1;       // m² A (normalizado)
  const num   = (3 * MU0 * m_SI * m_SI) / (2 * Math.PI);
  const den   = M_kg * g;
  const h_SI  = Math.pow(num / den, 0.25);
  // Convert to scene units (1u = 0.1m) + offset de la superficie del SC
  const h_scene = h_SI * 10 + 0.5;
  return Math.max(0.35, Math.min(3.5, h_scene));
}

// ─── Lesson state ─────────────────────────────────────────────────────────────

interface SCState {
  T: number;          // temperatura K
  showPairs: boolean;
  showField: boolean;
  m_mag: number;      // momento magnético del imán (normalizado)
  M_g: number;        // masa del imán en gramos
}

// ─── Lección pedagógica ───────────────────────────────────────────────────────

const LESSON: Lesson<SCState> = {
  hook: {
    title: 'Debajo de cierta temperatura, la resistencia cae a CERO. Y los imanes flotan.',
    body: `En 1911, Heike Kamerlingh Onnes enfría mercurio a 4.2 K. Mide la resistencia. A 4.15 K: cae a EXACTAMENTE CERO. No casi cero. Cero absoluto.

En 1933, Meissner descubre algo igual de radical: los superconductores EXPULSAN el campo magnético. No lo bloquean — lo EMPUJAN afuera. Es el efecto Meissner: un superconductor perfecto es también un diamagneto perfecto (χ = −1).

¿Consecuencia? Un imán sobre el superconductor flota — el campo expulsado genera una fuerza repulsiva exactamente calculable con el método de imágenes de Maxwell.

¿Explicación? Hasta 1957 no había teoría. Entonces Bardeen, Cooper y Schrieffer escriben BCS: los electrones se emparejan (¡a pesar de repelerse!) vía fonones, forman un condensado cuántico macroscópico, y el gap Δ(T) hace que ninguna colisión pueda romperlos si su energía < 2Δ.`,
  },

  steps: [
    {
      title: 'Gap BCS Δ(T) — la energía de los pares de Cooper',
      duration: 7000,
      body: `A temperatura cero, todos los electrones forman pares de Cooper. El gap Δ₀ = 1.764 · kB · Tc es la energía que cuesta romper un par.

A medida que T sube, los fonones térmicos rompen algunos pares — el gap se reduce. La fórmula de Mühlschlegel (1959) da la forma exacta:

  Δ(T) = Δ₀ · tanh(1.74 · √(Tc/T − 1))

Para YBCO: Tc = 93 K, Δ₀ ≈ 14.2 meV. A T = 0, Δ = 14.2 meV. En T = Tc, Δ → 0 de forma continua — transición de segundo orden.

Las esferas azules que ves en la escena son pares de Cooper. Su radio de órbita representa la longitud de coherencia ξ. A T alta, los pares se deshacen — la superconductividad muere.`,
      formula: 'Δ(T) = Δ₀ · tanh(1.74 √(Tc/T − 1))\nΔ₀ = 1.764 kB Tc  (acoplamiento débil BCS)',
      keyframes: [
        { at: 0,   state: { T: 10,  showPairs: true,  showField: false } },
        { at: 0.5, state: { T: 60,  showPairs: true,  showField: false } },
        { at: 1,   state: { T: 85,  showPairs: true,  showField: false } },
      ],
    },
    {
      title: 'Efecto Meissner — el campo magnético expulsado',
      duration: 7000,
      body: `Cuando T < Tc, el superconductor se vuelve perfecto diamagneto: χ = −1, lo que significa B = 0 dentro.

Las corrientes superficiales (corrientes de London) fluyen en una capa de grosor λ(T) — la longitud de penetración de London — y generan exactamente el campo opuesto para cancelar el B externo.

λ(T) = λ₀ / √(n_s/n),   con   n_s/n = 1 − (T/Tc)⁴

A T=0: λ = λ₀ = 140 nm (en YBCO). A T→Tc: λ → ∞ — el SC ya no puede expulsar el campo y pierde la superconductividad.

Las líneas verdes en la escena son las líneas de campo B. Observa cómo se curvan alrededor del bloque SC — NINGUNA penetra.`,
      formula: 'B_inside = 0  (Meissner)\nλ(T) = λ₀/√(1−(T/Tc)⁴)\n∇²B = B/λ²  (ecuaciones de London)',
      keyframes: [
        { at: 0,   state: { T: 10, showPairs: false, showField: true } },
        { at: 0.5, state: { T: 50, showPairs: false, showField: true } },
        { at: 1,   state: { T: 80, showPairs: false, showField: true } },
      ],
    },
    {
      title: 'Levitación Meissner — método de imágenes de Maxwell',
      duration: 7000,
      body: `El campo de un dipolo magnético sobre un SC perfecto se calcula con el método de imágenes: el SC actúa como un espejo magnético — coloca un dipolo imagen igual (no invertido) en la posición especular.

El campo total satisface B·n̂ = 0 en la superficie — condición de contorno del SC. La fuerza repulsiva entre el dipolo real y su imagen:

  F(h) = (3μ₀ m²) / (2π h⁴)

Equilibrio levitación: F = Mg → h* = ((3μ₀ m²)/(2π Mg))^(1/4)

El imán que ves flota exactamente a h* calculada. Cambia la masa o el momento magnético con los sliders — la altura cambia en tiempo real según la física.

A T > Tc el SC vuelve normal, el campo penetra, no hay imagen → el imán cae.`,
      formula: 'F_lev = 3μ₀m²/(2πh⁴)\nh* = (3μ₀m²/2πMg)^(1/4)',
      keyframes: [
        { at: 0, state: { T: 15,  showPairs: false, showField: true, m_mag: 1.0, M_g: 5 } },
        { at: 1, state: { T: 15,  showPairs: false, showField: true, m_mag: 1.0, M_g: 5 } },
      ],
    },
    {
      title: 'Transición de fase — Tc y el colapso del estado SC',
      duration: 7000,
      body: `Cuando T → Tc, tres cosas divergen o se anulan simultáneamente:
  • Δ(T) → 0  (los pares se deshacen)
  • n_s/n → 0  (no quedan electrones superfluidos)
  • λ(T) → ∞  (el SC no puede expulsar el campo)

Es una transición de segundo orden (sin calor latente). El parámetro de orden es Δ — exactamente como en la teoría de Landau de transiciones de fase.

A T > Tc: el material vuelve a ser un conductor normal. La resistencia reaparece. El imán cae. El campo penetra el material.

Observa en la escena cómo los pares de Cooper desaparecen uno a uno a medida que T sube hacia Tc = 93 K.`,
      formula: 'Δ(T→Tc) → 0  (2º orden)\nCp ~ |T−Tc|^(−α)  salto en calor específico\nξ(T) ~ (1−T/Tc)^(−1/2)',
      keyframes: [
        { at: 0,   state: { T: 50,  showPairs: true, showField: true } },
        { at: 0.5, state: { T: 88,  showPairs: true, showField: true } },
        { at: 1,   state: { T: 95,  showPairs: true, showField: true } },
      ],
    },
  ],

  connect: {
    body: `La superconductividad es uno de los fenómenos cuánticos más espectaculares a escala macroscópica. El condensado BCS — millones de pares de Cooper actuando como UN SOLO estado cuántico — es la mecánica cuántica visible a simple vista.

Aplicaciones reales:
• Resonancia magnética (MRI): bobinas SC generan B = 1.5–7 T sin consumo de potencia (solo la criogenia).
• LHC y aceleradores: 1232 imanes SC de niobio-titanio a 1.9 K, campo 8.3 T.
• Trenes maglev (SCMaglev Japón): levitación Meissner → 603 km/h récord (2015).
• Qubits superconductores: el gap Δ protege la coherencia cuántica — IBM Quantum, Google Sycamore.
• Cables de potencia SC: sin resistencia → cero pérdidas de transmisión.

El Santo Grial: un SC a temperatura ambiente. YBCO ya va a 93 K. Los cupratos, pnicturos, e hidruro de lantano bajo presión (253 K en 2019) van acercándose.`,
    links: [
      { label: 'Fonones — la red que media el apareamiento', href: '#phonons' },
      { label: 'Cristales — estructura de los SC tipo I/II', href: '#crystal-lattices' },
      { label: 'Mecánica cuántica — condensado de Bose-Einstein', href: '/math.html#quantum' },
    ],
  },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Superconductivity() {
  const { audience } = useAudience();

  const [T,         setT]         = useState(15);           // K
  const [showPairs, setShowPairs] = useState(true);
  const [showField, setShowField] = useState(true);
  const [m_mag,     setMMag]      = useState(1.0);          // momento normalizado
  const [M_g,       setMG]        = useState(5.0);          // masa gramos
  const [running,   setRunning]   = useState(true);

  const isSC = T < TC_YBCO;

  const delta   = bcsDelta(T, TC_YBCO, DELTA0);
  const ns_frac = superfluidFraction(T, TC_YBCO);
  const lambda  = londonLambda(T, TC_YBCO, LAMBDA0);
  const h_lev   = isSC ? levitationHeight(m_mag, M_g) : -0.5;

  function fmt(x: number, d = 3) { return isFinite(x) ? x.toFixed(d) : '∞'; }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      {/* ── Canvas 3D ─────────────────────────────────────────────── */}
      <div className="relative">
        <Stage cameraDistance={7} autoRotate bloomIntensity={1.1} bloomThreshold={0.1}>
          <SuperScene
            T={T}
            showPairs={showPairs}
            showField={showField}
            isSC={isSC}
            ns_frac={ns_frac}
            h_lev={h_lev}
            running={running}
          />
        </Stage>

        {/* HUD métricas */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">T&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= <span className={T >= TC_YBCO ? 'text-[#F87171]' : 'text-[#4FC3F7]'}>{T.toFixed(1)} K</span></div>
          <div><span className="text-[#64748B]">Tc&nbsp;&nbsp;&nbsp;&nbsp;</span>= 93 K (YBCO)</div>
          <div><span className="text-[#64748B]">Δ(T)&nbsp;&nbsp;</span>= {(delta / 1.602e-19 * 1000).toFixed(2)} meV</div>
          <div><span className="text-[#64748B]">n_s/n&nbsp;</span>= {ns_frac.toFixed(3)}</div>
          <div><span className="text-[#64748B]">λ(T)&nbsp;&nbsp;</span>= {isFinite(lambda) ? (lambda * 1e9).toFixed(0) + ' nm' : '∞'}</div>
          <div><span className="text-[#64748B]">Estado&nbsp;</span>= <span className={isSC ? 'text-[#34D399]' : 'text-[#F87171]'}>{isSC ? 'SC' : 'Normal'}</span></div>
        </div>

        {/* Controles play/pause */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <button
            onClick={() => setRunning(r => !r)}
            className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${
              running
                ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
                : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
            }`}
          >
            {running ? '❚❚' : '▶'}
          </button>
        </div>
      </div>

      {/* ── Lesson panel ──────────────────────────────────────────── */}
      <LessonPanel<SCState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.T         !== undefined) setT(patch.T);
          if (patch.showPairs !== undefined) setShowPairs(patch.showPairs);
          if (patch.showField !== undefined) setShowField(patch.showField);
          if (patch.m_mag     !== undefined) setMMag(patch.m_mag);
          if (patch.M_g       !== undefined) setMG(patch.M_g);
        }}
        sandbox={
          <>
            <Section title="Temperatura">
              <SliderRow
                label="T"
                value={T}
                min={4} max={110} step={0.5}
                format={v => `${v.toFixed(1)} K`}
                onChange={setT}
              />
              <div className="text-[10px] text-[#64748B] mt-1">
                Tc(YBCO) = 93 K — arrastra hacia Tc para ver la transición.
              </div>
            </Section>

            <Section title="Imán">
              <SliderRow
                label="m (momento)"
                value={m_mag}
                min={0.2} max={3} step={0.05}
                format={v => v.toFixed(2)}
                onChange={setMMag}
              />
              <SliderRow
                label="M (masa, g)"
                value={M_g}
                min={1} max={30} step={0.5}
                format={v => `${v.toFixed(1)} g`}
                onChange={setMG}
              />
              {isSC && (
                <div className="text-[10px] text-[#34D399] mt-1">
                  h* = {fmt(h_lev, 2)} u.e. — altura de equilibrio calculada
                </div>
              )}
              {!isSC && (
                <div className="text-[10px] text-[#F87171] mt-1">
                  T &gt; Tc — sin levitación (SC normal)
                </div>
              )}
            </Section>

            <Section title="Visualización">
              <ToggleRow label="Pares de Cooper"   value={showPairs} onChange={setShowPairs} />
              <ToggleRow label="Líneas de campo B" value={showField} onChange={setShowField} />
            </Section>

            {audience !== 'child' && (
              <Section title="Estado físico">
                <Row label="Δ(T)"  value={`${(delta / 1.602e-19 * 1000).toFixed(3)} meV`} />
                <Row label="Δ/Δ₀" value={(delta / DELTA0).toFixed(3)} />
                <Row label="n_s/n" value={ns_frac.toFixed(4)} />
                <Row label="λ(T)"  value={isFinite(lambda) ? `${(lambda * 1e9).toFixed(1)} nm` : '∞'} />
                <Row label="T/Tc"  value={(T / TC_YBCO).toFixed(3)} />
              </Section>
            )}

            <Section title="Fórmulas BCS">
              <pre className="text-[10px] font-mono text-[#FDB813] bg-[#05060A] border border-[#1E293B] rounded px-2 py-1.5 whitespace-pre-wrap leading-relaxed">
{`Δ(T) = Δ₀ tanh(1.74√(Tc/T−1))
Δ₀ = 1.764 kB Tc
λ(T) = λ₀/√(1−(T/Tc)⁴)
F_lev = 3μ₀m²/(2πh⁴)`}
              </pre>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D completa ──────────────────────────────────────────────────────

interface SuperSceneProps {
  T: number;
  showPairs: boolean;
  showField: boolean;
  isSC: boolean;
  ns_frac: number;
  h_lev: number;
  running: boolean;
}

function SuperScene({ T, showPairs, showField, isSC, ns_frac, h_lev, running }: SuperSceneProps) {
  return (
    <>
      {/* Bloque superconductor */}
      <SCBlock isSC={isSC} />

      {/* Líneas de campo magnético Meissner */}
      {showField && <MeissnerField isSC={isSC} ns_frac={ns_frac} />}

      {/* Pares de Cooper */}
      {showPairs && <CooperPairs T={T} isSC={isSC} ns_frac={ns_frac} running={running} />}

      {/* Imán levitando */}
      <MagnetLevitation h_lev={h_lev} isSC={isSC} />

      {/* Etiqueta del bloque SC */}
      <Html position={[0, -1.5, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-[10px] font-mono text-[#34D399] opacity-70 whitespace-nowrap">
          YBCO — Tc = 93 K
        </div>
      </Html>
    </>
  );
}

// ─── Bloque superconductor ────────────────────────────────────────────────────

function SCBlock({ isSC }: { isSC: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    // Parpadeo sutil del emisivo cuando está en SC
    const pulse = isSC ? 0.25 + 0.05 * Math.sin(clock.elapsedTime * 2.1) : 0.05;
    mat.emissiveIntensity = pulse;
  });

  return (
    <mesh ref={meshRef} position={[0, -1.0, 0]}>
      <boxGeometry args={[3.5, 0.6, 2.0]} />
      <meshStandardMaterial
        color={isSC ? '#0D2A3A' : '#1A1A1A'}
        emissive={isSC ? '#004466' : '#111111'}
        emissiveIntensity={0.25}
        metalness={0.7}
        roughness={0.3}
        toneMapped={false}
      />
    </mesh>
  );
}

// ─── Líneas de campo Meissner ─────────────────────────────────────────────────

/**
 * Simula líneas de campo B que se curvan alrededor del SC.
 * Modelo: campo uniforme B₀ en z; sobre el SC, se usa potencial de imagen
 * para calcular la desviación: la componente z se reduce cerca de la superficie.
 * Renderizamos curvas paramétricas en 3D (polylines) usando drei <Line>.
 */
function MeissnerField({ isSC, ns_frac }: { isSC: boolean; ns_frac: number }) {
  // Construye arrays de puntos para cada línea de campo
  const fieldLines = useMemo(() => {
    const result: [number, number, number][][] = [];
    const N_LINES = 12;
    const N_STEPS = 60;

    for (let li = 0; li < N_LINES; li++) {
      const x0 = -2.5 + (li / (N_LINES - 1)) * 5.0;
      const pts: [number, number, number][] = [];

      for (let s = 0; s < N_STEPS; s++) {
        const z = -3.5 + (s / (N_STEPS - 1)) * 7.0;
        let y = 0.5;  // altura constante sin SC

        if (isSC) {
          // Método de imágenes: campo del dipolo imagen desplaza las líneas.
          // SC ocupa y ∈ [-1.3, -0.7], x ∈ [-1.75, 1.75], z ∈ [-1.0, 1.0].
          const inSCx = Math.abs(x0) < 1.75;
          const inSCz = Math.abs(z) < 1.0;
          if (inSCx && inSCz) {
            // Repulsión: la línea sube para rodear el SC
            const dx = Math.max(0, 1.75 - Math.abs(x0));
            const dz = Math.max(0, 1.0  - Math.abs(z));
            const proximity = Math.min(dx, dz) / 1.75;
            // Levantamos la línea proporcionalmente a ns_frac
            y = 0.5 + ns_frac * 1.8 * Math.exp(-proximity * 2.5);
          }
        }

        pts.push([x0, y, z]);
      }
      result.push(pts);
    }
    return result;
  }, [isSC, ns_frac]);

  // Color de las líneas según T (verde SC, gris normal)
  const r = isSC ? Math.round((0.1 + ns_frac * 0.2) * 255) : 89;
  const g = isSC ? Math.round((0.7 + ns_frac * 0.3) * 255) : 89;
  const b = isSC ? Math.round((0.3 + ns_frac * 0.1) * 255) : 89;
  const lineColor = `rgb(${r},${g},${b})`;

  return (
    <group>
      {fieldLines.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={lineColor}
          lineWidth={1.5}
          transparent
          opacity={0.7}
        />
      ))}
    </group>
  );
}

// ─── Pares de Cooper ──────────────────────────────────────────────────────────

const MAX_PAIRS = 24;

interface CooperPairData {
  cx: number; cy: number; cz: number;   // centro de órbita
  radius: number;
  phase: number;
  speed: number;
  tiltX: number; tiltZ: number;
}

function CooperPairs({ T, isSC, ns_frac, running }: { T: number; isSC: boolean; ns_frac: number; running: boolean }) {
  // Número de pares activos proporcional a n_s/n
  const nActive = isSC ? Math.round(ns_frac * MAX_PAIRS) : 0;

  // Configuración fija de cada par (no varía con T — solo se activa/desactiva)
  const pairDefs = useMemo<CooperPairData[]>(() => {
    const arr: CooperPairData[] = [];
    const rng = mulberry32(42);
    for (let i = 0; i < MAX_PAIRS; i++) {
      arr.push({
        cx:     (rng() - 0.5) * 3.0,
        cy:      rng() * 1.5 + 0.5,
        cz:     (rng() - 0.5) * 1.8,
        radius:  0.18 + rng() * 0.22,
        phase:   rng() * Math.PI * 2,
        speed:   0.4 + rng() * 0.8,
        tiltX:   (rng() - 0.5) * 0.8,
        tiltZ:   (rng() - 0.5) * 0.8,
      });
    }
    return arr;
  }, []);

  // Refs de las dos esferas de cada par
  const refsA = useRef<(THREE.Mesh | null)[]>(Array(MAX_PAIRS).fill(null));
  const refsB = useRef<(THREE.Mesh | null)[]>(Array(MAX_PAIRS).fill(null));

  useFrame(({ clock }) => {
    if (!running) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < MAX_PAIRS; i++) {
      const mA = refsA.current[i];
      const mB = refsB.current[i];
      if (!mA || !mB) continue;

      const active = i < nActive;
      mA.visible = active;
      mB.visible = active;
      if (!active) continue;

      const def = pairDefs[i];
      const angle = t * def.speed + def.phase;

      // Órbita en el plano XZ rotada por tiltX, tiltZ
      const rx = Math.cos(angle) * def.radius;
      const rz = Math.sin(angle) * def.radius;

      // Rotación del plano de órbita
      const cosX = Math.cos(def.tiltX), sinX = Math.sin(def.tiltX);
      const cosZ = Math.cos(def.tiltZ), sinZ = Math.sin(def.tiltZ);

      const ax = rx * cosZ - rz * sinZ;
      const ay = rx * sinZ * sinX + rz * cosX;
      const az = rx * sinZ * cosX - rz * sinX;

      mA.position.set(def.cx + ax, def.cy + ay, def.cz + az);
      mB.position.set(def.cx - ax, def.cy - ay, def.cz - az);

      // Emissive pulsa con el gap: cuanto mayor T, menor pulso
      const mat = mA.material as THREE.MeshStandardMaterial;
      const matB = mB.material as THREE.MeshStandardMaterial;
      const glow = 0.5 + ns_frac * 0.8 * (0.8 + 0.2 * Math.sin(t * 3.0 + def.phase));
      mat.emissiveIntensity  = glow;
      matB.emissiveIntensity = glow;
    }
  });

  return (
    <group>
      {pairDefs.map((def, i) => (
        <group key={i}>
          <mesh ref={el => { refsA.current[i] = el; }}>
            <sphereGeometry args={[0.05, 12, 10]} />
            <meshStandardMaterial
              color="#4FC3F7"
              emissive="#4FC3F7"
              emissiveIntensity={0.8}
              metalness={0.1}
              roughness={0.2}
              toneMapped={false}
            />
          </mesh>
          <mesh ref={el => { refsB.current[i] = el; }}>
            <sphereGeometry args={[0.05, 12, 10]} />
            <meshStandardMaterial
              color="#93C5FD"
              emissive="#93C5FD"
              emissiveIntensity={0.8}
              metalness={0.1}
              roughness={0.2}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Imán flotante ────────────────────────────────────────────────────────────

function MagnetLevitation({ h_lev, isSC }: { h_lev: number; isSC: boolean }) {
  const groupRef  = useRef<THREE.Group>(null);
  const targetY   = useRef(h_lev);

  useEffect(() => {
    targetY.current = h_lev;
  }, [h_lev]);

  useFrame(() => {
    if (!groupRef.current) return;
    // Suavizado exponencial hacia la altura objetivo
    const cur = groupRef.current.position.y;
    const tgt = targetY.current;
    groupRef.current.position.y = cur + (tgt - cur) * 0.06;

    // Ligera oscilación vertical (realista: amortiguación del campo)
    const osc = isSC ? Math.sin(Date.now() * 0.001 * 1.2) * 0.04 : 0;
    groupRef.current.position.y += osc;
  });

  return (
    <group ref={groupRef} position={[0, h_lev, 0]}>
      {/* Cuerpo del imán — cilindro con ejes N/S */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.7, 24]} />
        <meshStandardMaterial
          color="#B91C1C"
          emissive="#7F1D1D"
          emissiveIntensity={isSC ? 0.6 : 0.15}
          metalness={0.6}
          roughness={0.35}
          toneMapped={false}
        />
      </mesh>
      {/* Polo Norte (rojo brillante) */}
      <mesh position={[0.38, 0, 0]}>
        <sphereGeometry args={[0.15, 16, 14]} />
        <meshStandardMaterial
          color="#EF4444"
          emissive="#F87171"
          emissiveIntensity={isSC ? 1.2 : 0.3}
          metalness={0.2}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>
      {/* Polo Sur (azul) */}
      <mesh position={[-0.38, 0, 0]}>
        <sphereGeometry args={[0.15, 16, 14]} />
        <meshStandardMaterial
          color="#3B82F6"
          emissive="#60A5FA"
          emissiveIntensity={isSC ? 1.0 : 0.2}
          metalness={0.2}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>
      {/* Etiqueta */}
      <Html position={[0, 0.4, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-[9px] font-mono text-[#FDB813] opacity-80 whitespace-nowrap">
          {isSC ? `h* = ${h_lev.toFixed(2)} u.e.` : 'T > Tc — no levita'}
        </div>
      </Html>
    </group>
  );
}

// ─── Helpers PRNG determinista ────────────────────────────────────────────────

/** Mulberry32 — PRNG determinista para posiciones de pares */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

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

function SliderRow({
  label, value, min, max, step, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full mt-1"
      />
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between text-[11px] font-mono py-1">
      <span className="text-[#94A3B8]">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors ${value ? 'bg-[#4FC3F7]/40' : 'bg-[#1E293B]'}`}
      >
        <span className={`block w-4 h-4 rounded-full mx-0.5 transition-transform ${value ? 'bg-[#4FC3F7] translate-x-5' : 'bg-[#64748B]'}`} />
      </button>
    </div>
  );
}
