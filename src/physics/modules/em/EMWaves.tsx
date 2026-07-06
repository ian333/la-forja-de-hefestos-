/**
 * Ondas Electromagnéticas — Maxwell plano-onda en 3D REAL.
 *
 * FÍSICA EXACTA:
 *   Onda plana monocromática propagándose en +z:
 *     E(z,t) = E₀ · ê_pol · cos(kz − ωt)
 *     B(z,t) = (1/c) · (k̂ × E)  =  (E₀/c) · (k̂ × ê_pol) · cos(kz − ωt)
 *
 *   Restricciones de Maxwell:
 *     E ⊥ B ⊥ k̂  (ortogonalidad)
 *     c = ω/k = 1/√(μ₀ε₀)  (relación de dispersión)
 *
 *   Polarización:
 *     Lineal:   ê_pol = x̂ · cos(φ) + ŷ · sin(φ)  (φ = ángulo de pol.)
 *     Circular: ê_pol(t) = x̂ · cos(ωt) + ŷ · sin(ωt)  (mano derecha)
 *
 *   Vector de Poynting:
 *     S = (1/μ₀) · E × B = ε₀·c · E₀² · cos²(kz−ωt) · ẑ
 *     <S> = ½·ε₀·c·E₀²  (promedio temporal — intensidad)
 *
 * Visualización:
 *   - Flechas rojas: campo E en un plano XZ (cada z fijo, dirección x/y)
 *   - Flechas azules: campo B en el mismo plano (ortogonal a E)
 *   - Sprites dorados: vector de Poynting S en +z (densidad de flujo)
 *   - Envolvente: curvas continuas E(z) y B(z) como tube geometry
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { useAudience } from '@/physics/context';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ── Constantes físicas (documentación; la escena usa unidades normalizadas c=1) ──
// c  = 3×10⁸ m/s,  μ₀ = 4π×10⁻⁷ H/m,  ε₀ = 1/(μ₀c²)
// Relación de dispersión: ω = c·k,  E₀/B₀ = c
// En la escena: c = 1 (unidades adimensionales), E₀ = 1, λ = 2.0

// ── Estado de la lección ────────────────────────────────────────────────
interface WaveLessonState {
  polarization: 'linear' | 'circular';
  showPoynting: boolean;
  polAngleDeg: number;
}

const LESSON: Lesson<WaveLessonState> = {
  hook: {
    title: 'La luz es exactamente esto: E y B bailando perpendiculares, propagándose a 3×10⁸ m/s.',
    body: `Maxwell (1865) derivó que una oscilación eléctrica crea un campo magnético que crea de vuelta un campo eléctrico — un proceso que se autopropaga en el vacío.

El resultado fue la fórmula más sorprendente del siglo XIX:

    c = 1/√(μ₀ε₀) = 2.998×10⁸ m/s

Que coincidía EXACTAMENTE con la velocidad medida de la luz. Maxwell escribió: "La velocidad de las ondas transversales en mi medio electromagnético coincide tanto con la velocidad de la luz que parece difícil resistir la conclusión de que la luz misma es una perturbación electromagnética."

Aquí ves esa perturbación en 3D real — campos E (rojo) y B (azul) oscilando en perpendicular, energía fluyendo hacia adelante (dorado = vector de Poynting).`,
  },

  steps: [
    {
      title: 'Onda plana — E ⊥ B ⊥ k̂',
      duration: 5500,
      body: `Una onda plana se propaga en la dirección z. El campo eléctrico E oscila en x; el magnético B oscila en y.

Las ecuaciones exactas de Maxwell dan:
    E(z,t) = E₀ cos(kz − ωt) x̂
    B(z,t) = (E₀/c) cos(kz − ωt) ŷ

Observa la geometría: E (rojo), B (azul) y k̂ (la dirección de propagación, eje z) forman una base ortonormal. Es la condición E ⊥ B ⊥ k̂ que emerge directamente de ∇·E=0 y ∇·B=0.

La razón de amplitudes E₀/B₀ = c = 3×10⁸ m/s es una constante universal.`,
      formula: 'E(z,t) = E₀ cos(kz−ωt) x̂\nB(z,t) = (E₀/c) cos(kz−ωt) ŷ\nc = ω/k = 1/√(μ₀ε₀)',
      keyframes: [
        { at: 0, state: { polarization: 'linear', polAngleDeg: 0, showPoynting: false } },
        { at: 1, state: { polarization: 'linear', polAngleDeg: 0, showPoynting: false } },
      ],
    },
    {
      title: 'Vector de Poynting — flujo de energía',
      duration: 6000,
      body: `La energía electromagnética fluye con densidad:
    S = (1/μ₀) · E × B  [W/m²]

En nuestra onda plana, S = ε₀·c·E₀² cos²(kz−ωt) ẑ — siempre en la dirección de propagación.

El promedio temporal ⟨S⟩ = ½ε₀c E₀² es la intensidad (irradiancia). Para la luz solar: ~1361 W/m². Para un láser de puntero: ~1 mW en un spot de 1 mm² = 1000 W/m².

Los puntos dorados muestran el flujo de energía: avanzan en z con la velocidad de fase ω/k = c.`,
      formula: 'S = (1/μ₀) E × B  [W/m²]\n⟨S⟩ = ½ε₀c E₀²  (intensidad)',
      keyframes: [
        { at: 0, state: { polarization: 'linear', polAngleDeg: 0, showPoynting: true } },
        { at: 1, state: { polarization: 'linear', polAngleDeg: 0, showPoynting: true } },
      ],
    },
    {
      title: 'Polarización lineal — rotación del plano',
      duration: 6000,
      body: `La polarización define en qué plano oscila E. Para polarización lineal con ángulo φ:
    ê_pol = cos(φ) x̂ + sin(φ) ŷ
    E = E₀ cos(kz−ωt) · ê_pol
    B = (E₀/c) cos(kz−ωt) · (ẑ × ê_pol)

Observa cómo al rotar φ, el plano de E (y de B, siempre perpendicular) gira — pero la onda sigue propagándose idéntica.

Los filtros polarizadores (lentes de sol, LCD, microscopia) seleccionan un ángulo. La birrefringencia de algunos cristales gira este ángulo — así funcionan las celdas de cristal líquido en tu pantalla.`,
      formula: 'ê_pol = cos(φ)x̂ + sin(φ)ŷ\nB = (E₀/c)(ẑ × ê_pol)cos(kz−ωt)',
      keyframes: [
        { at: 0,   state: { polarization: 'linear', polAngleDeg: 0,   showPoynting: false } },
        { at: 0.5, state: { polarization: 'linear', polAngleDeg: 45,  showPoynting: false } },
        { at: 1,   state: { polarization: 'linear', polAngleDeg: 90,  showPoynting: false } },
      ],
    },
    {
      title: 'Polarización circular — la hélice',
      duration: 6500,
      body: `La polarización circular es la superposición de dos ondas lineales en x e y con desfase π/2:
    E = E₀ [cos(kz−ωt) x̂ + sin(kz−ωt) ŷ]

La magnitud |E| = E₀ es constante — solo gira. En cualquier punto fijo z, el vector E traza un círculo. En el espacio, la onda forma una hélice.

Hay dos chiralities: mano derecha (ω positivo en ŷ→x̂) y mano izquierda. La luz circularmente polarizada interactúa diferencialmente con moléculas quirales — base del dicroísmo circular en espectroscopía de proteínas (determinan α-hélices y β-sheets).

Los fotones de luz circularmente polarizada tienen helicidad = ±ℏ.`,
      formula: 'E = E₀[cos(kz−ωt)x̂ + sin(kz−ωt)ŷ]\n|E| = E₀ = const  (amplitud fija)\nHelicidad fotón = ±ℏ',
      keyframes: [
        { at: 0, state: { polarization: 'circular', showPoynting: false } },
        { at: 1, state: { polarization: 'circular', showPoynting: false } },
      ],
    },
  ],

  connect: {
    body: `Las ondas planas de Maxwell son la base de TODO el espectro electromagnético:
• Radio (km) → microondas (cm) → IR (μm) → visible (400-700 nm)
• UV (100 nm) → rayos X (0.1 nm) → gamma (< 0.001 nm)

Todos son E⊥B⊥k̂, propagándose a c, difiriendo solo en frecuencia ω.

Aplicaciones directas:
• Óptica de Fourier — superposición de ondas planas forma CUALQUIER campo
• Antenas — oscilador dipolar emite ondas planas esféricas lejanas
• Láser — cavidad resonante selecciona modos longitudinales (kL = nπ)
• Fibra óptica — modos guiados son combinación de ondas planas con reflexión total
• MRI — campos oscilantes RF en la frecuencia de Larmor de ¹H

El siguiente paso es la cuantización: E y B se vuelven operadores de creación/destrucción, y el fotón emerge naturalmente.`,
    links: [
      { label: 'Campos EM estáticos — Coulomb y Biot-Savart', href: '#em-fields' },
      { label: 'Ecuaciones de Maxwell — forma diferencial', href: '/math.html#vector-fields' },
      { label: 'Óptica cuántica — fotones y coherencia', href: '#quantum-optics' },
    ],
  },
};

// ── Tipos del simulador ─────────────────────────────────────────────────
type Polarization = 'linear' | 'circular';

// ── Helpers matemáticos puros ───────────────────────────────────────────

/**
 * Calcula E y B en un punto (z, t) para onda plana en +z.
 * Polarización lineal: ê_pol = cos(φ)x̂ + sin(φ)ŷ
 * Polarización circular: ê_E = cos(kz−ωt)x̂ + sin(kz−ωt)ŷ (mano derecha)
 *
 * En unidades normalizadas: E₀ = 1, c = 1 (escala visual).
 * k = 2π/λ, ω = 2π·f, ω = c·k → ω/k = 1.
 */
function waveFields(
  z: number,
  t: number,
  k: number,
  omega: number,
  polAngle: number,
  polarization: Polarization,
): { Ex: number; Ey: number; Bx: number; By: number } {
  const phase = k * z - omega * t;

  if (polarization === 'linear') {
    const cphi = Math.cos(polAngle);
    const sphi = Math.sin(polAngle);
    const amp  = Math.cos(phase);
    // E = E₀ · (cos φ·x̂ + sin φ·ŷ) · cos(kz−ωt)
    const Ex = cphi * amp;
    const Ey = sphi * amp;
    // B = (1/c)·(ẑ × E) = (1/c)·(cos φ·ŷ − sin φ·x̂) · cos(kz−ωt)
    // In normalized units c=1: Bx = −sin φ · amp, By = cos φ · amp
    const Bx = -sphi * amp;
    const By =  cphi * amp;
    return { Ex, Ey, Bx, By };
  } else {
    // Circular: E = E₀·[cos(kz−ωt)·x̂ + sin(kz−ωt)·ŷ]
    const Ex =  Math.cos(phase);
    const Ey =  Math.sin(phase);
    // B = ẑ × E = −sin(kz−ωt)·x̂ + cos(kz−ωt)·ŷ  (mano derecha, c=1)
    const Bx = -Math.sin(phase);
    const By =  Math.cos(phase);
    return { Ex, Ey, Bx, By };
  }
}

// ── Componente principal ────────────────────────────────────────────────
export default function EMWaves() {
  const { audience } = useAudience();

  const [polarization, setPolarization] = useState<Polarization>('linear');
  const [polAngleDeg, setPolAngleDeg]   = useState(0);
  const [showPoynting, setShowPoynting] = useState(false);
  const [running, setRunning]           = useState(true);
  const [freq, setFreq]                 = useState(1.0); // Hz normalizado (visual)

  // Refs para métricas en vivo (no necesitan disparar re-render cada frame)
  const intensityRef = useRef(0);
  const [, forceUi]  = useState(0);

  const polAngle = (polAngleDeg * Math.PI) / 180;

  // ── Parámetros de la onda ──────────────────────────────────────────────
  // λ = 2 (unidades de escena), c = 1, k = 2π/λ, ω = c·k = k (c=1)
  const lambda = 2.0;
  const k      = (2 * Math.PI) / lambda;
  const omega  = k * freq; // ω = c·k con c=1 normalizado

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <WaveCanvas
          polarization={polarization}
          polAngle={polAngle}
          freq={freq}
          lambda={lambda}
          k={k}
          omega={omega}
          showPoynting={showPoynting}
          running={running}
          onIntensity={(I) => { intensityRef.current = I; }}
        />

        {/* HUD — métricas en vivo */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1]">
          <div><span className="text-[#64748B]">pol&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {polarization === 'circular' ? 'circular' : `lineal ${polAngleDeg}°`}</div>
          <div><span className="text-[#64748B]">λ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {lambda.toFixed(2)} u</div>
          <div><span className="text-[#64748B]">E₀/B₀&nbsp;&nbsp;</span>= c = 3×10⁸ m/s</div>
          <div><span className="text-[#64748B]">E⊥B⊥k̂</span>= <span className="text-[#34D399]">siempre</span></div>
        </div>

        {/* Controles */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
        </div>
      </div>

      <LessonPanel<WaveLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.polarization  !== undefined) setPolarization(patch.polarization);
          if (patch.showPoynting  !== undefined) setShowPoynting(patch.showPoynting);
          if (patch.polAngleDeg   !== undefined) setPolAngleDeg(Math.round(patch.polAngleDeg as number));
        }}
        sandbox={
          <>
            <Section title="Polarización">
              <div className="grid grid-cols-2 gap-1.5">
                {(['linear', 'circular'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPolarization(p)}
                    className={`px-3 py-2 rounded-md border text-[12px] transition ${
                      polarization === p
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {p === 'linear' ? 'Lineal' : 'Circular'}
                  </button>
                ))}
              </div>
            </Section>

            {polarization === 'linear' && (
              <Section title="Ángulo de polarización">
                <Slider
                  label="φ"
                  v={polAngleDeg}
                  min={0} max={180} step={1}
                  on={v => setPolAngleDeg(v)}
                  unit="°"
                />
                <div className="text-[10px] text-[#64748B] mt-1">
                  ê_pol = cos(φ)x̂ + sin(φ)ŷ
                </div>
              </Section>
            )}

            <Section title="Visualización">
              <Toggle value={showPoynting} onChange={setShowPoynting} label="Vector de Poynting S (dorado)" />
            </Section>

            <Section title="Frecuencia">
              <Slider label="f" v={freq} min={0.3} max={2.5} step={0.05} on={setFreq} unit=" Hz" />
              <div className="text-[10px] text-[#64748B] mt-1">
                ω = 2πf, k = ω/c, λ = 2π/k
              </div>
            </Section>

            {audience === 'researcher' ? (
              <Section title="Relaciones de Maxwell">
                <Row label="k" value={`${k.toFixed(3)} rad/u`} />
                <Row label="ω" value={`${(k * freq).toFixed(3)} rad/s·norm`} />
                <Row label="E₀/B₀" value="c = 1 (norm.)" />
                <Row label="⟨S⟩/ε₀c" value="½E₀² = 0.5 (norm.)" />
                <div className="mt-2 text-[10px] text-[#64748B] leading-relaxed">
                  c = 1/√(μ₀ε₀). En SI: E₀/B₀ = 3×10⁸ m/s exactamente.
                  Intensidad ⟨S⟩ = ½ε₀c·E₀².
                </div>
              </Section>
            ) : (
              <Section title="Física">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>El campo <span className="text-[#EF4444]">rojo (E)</span> y el <span className="text-[#4FC3F7]">azul (B)</span> oscilan perpendiculares entre sí y a la dirección de avance.</p>
                  <p>La energía <span className="text-[#FDB813]">(dorado)</span> fluye en la dirección de propagación: S = E×B/μ₀.</p>
                </div>
              </Section>
            )}

            <Section title="Ecuación de onda">
              <pre className="text-[10px] font-mono text-[#FDB813] bg-[#05060A] rounded p-2 whitespace-pre-wrap">
{`∇²E = μ₀ε₀ ∂²E/∂t²
→ E = E₀cos(kz−ωt)ê
  c = ω/k = 1/√(μ₀ε₀)`}
              </pre>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ── Canvas 3D ─────────────────────────────────────────────────────────────

interface WaveCanvasProps {
  polarization: Polarization;
  polAngle: number;
  freq: number;
  lambda: number;
  k: number;
  omega: number;
  showPoynting: boolean;
  running: boolean;
  onIntensity: (I: number) => void;
}

function WaveCanvas(props: WaveCanvasProps) {
  return (
    <div
      className="relative w-full h-full"
      style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}
    >
      <Canvas
        camera={{ position: [3.5, 2.5, 0], fov: 50, near: 0.01, far: 200 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.2} />
        <directionalLight position={[3, 5, 3]}  intensity={0.5} color="#CBD5E1" />
        <directionalLight position={[-3, -2, 2]} intensity={0.2} color="#4FC3F7" />

        <OrbitControls
          enablePan
          enableDamping
          dampingFactor={0.08}
          autoRotate={false}
        />

        <WaveScene {...props} />

        <EffectComposer multisampling={4}>
          <Bloom
            intensity={1.1}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.4}
            mipmapBlur
            kernelSize={KernelSize.LARGE}
          />
          <Vignette offset={0.28} darkness={0.6} blendFunction={BlendFunction.NORMAL} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

// ── Escena 3D — useFrame vive aquí adentro del Canvas ──────────────────

const N_ARROWS = 24;     // puntos de muestreo en z
const WAVE_LEN = 4.0;   // longitud total visible (2 longitudes de onda)
const ARROW_SCALE = 0.38; // escala visual de las flechas
const N_POYNTING = 12;   // partículas de Poynting

function WaveScene({
  polarization,
  polAngle,
  freq,
  k,
  omega,
  showPoynting,
  running,
  onIntensity,
}: WaveCanvasProps) {
  const t     = useRef(0);
  const tex   = useMemo(() => getParticleTexture(), []);

  // ── Geometrías de las flechas E y B ────────────────────────────────
  // Usamos ArrowHelper por eje z (N_ARROWS puntos z fijos).
  // Los actualizamos mutando la dirección y longitud en useFrame.
  const eArrows = useRef<THREE.ArrowHelper[]>([]);
  const bArrows = useRef<THREE.ArrowHelper[]>([]);
  const groupE  = useRef<THREE.Group>(null);
  const groupB  = useRef<THREE.Group>(null);

  // ── Curva envolvente E(z) — primitive Line (evita <line> que TS confunde con SVG) ──
  const eCurveLine = useMemo(() => new THREE.Line(), []);
  const bCurveLine = useMemo(() => new THREE.Line(), []);

  // ── Partículas de Poynting ─────────────────────────────────────────
  const poyntingGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N_POYNTING * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  // ── Inicializar flechas ────────────────────────────────────────────
  useMemo(() => {
    // E arrows — rojo emisivo
    const colE = new THREE.Color('#EF4444');
    const colB = new THREE.Color('#4FC3F7');
    eArrows.current = [];
    bArrows.current = [];
    for (let i = 0; i < N_ARROWS; i++) {
      const z = -WAVE_LEN / 2 + (i / (N_ARROWS - 1)) * WAVE_LEN;
      const ae = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, z),
        0.3, colE.getHex(), 0.12, 0.08,
      );
      // Emissive-like: set material colors
      (ae.line.material as THREE.LineBasicMaterial).color = colE;
      (ae.cone.material as THREE.MeshBasicMaterial).color = colE;
      eArrows.current.push(ae);

      const ab = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, z),
        0.3, colB.getHex(), 0.12, 0.08,
      );
      (ab.line.material as THREE.LineBasicMaterial).color = colB;
      (ab.cone.material as THREE.MeshBasicMaterial).color = colB;
      bArrows.current.push(ab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Añadir/quitar del grupo cuando se inicializan
  useMemo(() => {
    const ge = groupE.current;
    const gb = groupB.current;
    if (ge && gb) {
      while (ge.children.length) ge.remove(ge.children[0]);
      while (gb.children.length) gb.remove(gb.children[0]);
      eArrows.current.forEach(a => ge.add(a));
      bArrows.current.forEach(a => gb.add(a));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eArrows.current.length]);

  // ── Geometrías de las curvas envolventes ───────────────────────────
  const eCurvePts = useMemo(() => new Float32Array((N_ARROWS * 2) * 3), []);
  const bCurvePts = useMemo(() => new Float32Array((N_ARROWS * 2) * 3), []);
  const eCurveGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(eCurvePts, 3));
    eCurveLine.geometry = g;
    eCurveLine.material = new THREE.LineBasicMaterial({ color: '#EF4444', transparent: true, opacity: 0.55, depthWrite: false });
    return g;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eCurvePts, eCurveLine]);
  const bCurveGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(bCurvePts, 3));
    bCurveLine.geometry = g;
    bCurveLine.material = new THREE.LineBasicMaterial({ color: '#4FC3F7', transparent: true, opacity: 0.55, depthWrite: false });
    return g;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bCurvePts, bCurveLine]);

  // ── Loop principal ─────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (running) t.current += delta * freq;
    const now = t.current;

    // Asegurar que el grupo tiene las flechas (se ejecuta 1 vez)
    const ge = groupE.current;
    const gb = groupB.current;
    if (ge && ge.children.length === 0 && eArrows.current.length > 0) {
      eArrows.current.forEach(a => ge.add(a));
    }
    if (gb && gb.children.length === 0 && bArrows.current.length > 0) {
      bArrows.current.forEach(a => gb.add(a));
    }

    // Actualizar flechas y curvas
    const NZ = N_ARROWS * 2; // 2× para curva suave
    for (let i = 0; i < NZ; i++) {
      const z = -WAVE_LEN / 2 + (i / (NZ - 1)) * WAVE_LEN;
      const { Ex, Ey, Bx, By } = waveFields(z, now, k, omega, polAngle, polarization);

      // Curva envolvente E
      eCurvePts[i * 3 + 0] = Ex * ARROW_SCALE;
      eCurvePts[i * 3 + 1] = Ey * ARROW_SCALE;
      eCurvePts[i * 3 + 2] = z;

      // Curva envolvente B
      bCurvePts[i * 3 + 0] = Bx * ARROW_SCALE;
      bCurvePts[i * 3 + 1] = By * ARROW_SCALE;
      bCurvePts[i * 3 + 2] = z;
    }
    (eCurveGeom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (bCurveGeom.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // Actualizar flechas discretas
    for (let i = 0; i < N_ARROWS; i++) {
      const z = -WAVE_LEN / 2 + (i / (N_ARROWS - 1)) * WAVE_LEN;
      const { Ex, Ey, Bx, By } = waveFields(z, now, k, omega, polAngle, polarization);

      const ae = eArrows.current[i];
      const ab = bArrows.current[i];
      if (!ae || !ab) continue;

      const eMag = Math.sqrt(Ex * Ex + Ey * Ey);
      const bMag = Math.sqrt(Bx * Bx + By * By);
      const eLen = eMag * ARROW_SCALE;
      const bLen = bMag * ARROW_SCALE;

      // Posición base en z (sin desplazamiento en x/y — la base es el eje z)
      ae.position.set(0, 0, z);
      ab.position.set(0, 0, z);

      if (eMag > 1e-6) {
        ae.setDirection(new THREE.Vector3(Ex / eMag, Ey / eMag, 0));
        ae.setLength(eLen, Math.min(eLen * 0.35, 0.08), Math.min(eLen * 0.25, 0.06));
      } else {
        ae.setLength(0, 0, 0);
      }
      if (bMag > 1e-6) {
        ab.setDirection(new THREE.Vector3(Bx / bMag, By / bMag, 0));
        ab.setLength(bLen, Math.min(bLen * 0.35, 0.08), Math.min(bLen * 0.25, 0.06));
      } else {
        ab.setLength(0, 0, 0);
      }
    }

    // Vector de Poynting — partículas que avanzan en z
    // S ∝ E×B en +z, las partículas viajan con velocidad de fase = 1
    if (showPoynting) {
      const posArr = (poyntingGeom.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < N_POYNTING; i++) {
        // Cada partícula empieza en z_i distribuida uniformemente, avanza con ω/k = 1
        const z0   = -WAVE_LEN / 2 + (i / N_POYNTING) * WAVE_LEN;
        const zPos = ((z0 + now * (omega / k)) % WAVE_LEN + WAVE_LEN) % WAVE_LEN - WAVE_LEN / 2;
        posArr[i * 3 + 0] = 0;
        posArr[i * 3 + 1] = 0;
        posArr[i * 3 + 2] = zPos;
      }
      (poyntingGeom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Intensidad instantánea <S> = ½ (E₀² = 1 normalizado)
    onIntensity(0.5);
  });

  return (
    <>
      {/* Eje z — dirección de propagación */}
      <arrowHelper
        args={[
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, -WAVE_LEN / 2 - 0.1),
          WAVE_LEN + 0.5,
          0x888888,
          0.15,
          0.1,
        ]}
      />

      {/* Curva envolvente E — rojo (primitive evita confusión con SVG <line>) */}
      <primitive object={eCurveLine} />

      {/* Curva envolvente B — azul */}
      <primitive object={bCurveLine} />

      {/* Flechas E */}
      <group ref={groupE} />

      {/* Flechas B */}
      <group ref={groupB} />

      {/* Vector de Poynting — partículas doradas */}
      {showPoynting && (
        <points geometry={poyntingGeom}>
          <pointsMaterial
            map={tex}
            alphaMap={tex}
            color="#FDB813"
            size={0.18}
            sizeAttenuation
            transparent
            opacity={0.92}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}

      {/* Plano de referencia translúcido (XY en z=0) */}
      <mesh rotation={[0, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[0.9, 0.9, 1, 1]} />
        <meshStandardMaterial
          color="#1E293B"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Anillo en el plano de referencia (marca la sección transversal) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <torusGeometry args={[0.42, 0.008, 8, 64]} />
        <meshStandardMaterial
          color="#334155"
          emissive="#1E293B"
          emissiveIntensity={0.5}
          roughness={0.6}
          metalness={0.2}
        />
      </mesh>

      {/* Etiqueta k̂ — pequeña esfera en el extremo del eje */}
      <mesh position={[0, 0, WAVE_LEN / 2 + 0.5]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial
          color="#888888"
          emissive="#555555"
          emissiveIntensity={0.6}
          roughness={0.4}
        />
      </mesh>
    </>
  );
}

// ── UI helpers ──────────────────────────────────────────────────────────

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

function Slider({ label, v, min, max, step, on, unit = '' }: {
  label: string; v: number; min: number; max: number; step: number;
  on: (v: number) => void; unit?: string;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v.toFixed(2)}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer text-[12px] text-[#CBD5E1]">
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="accent-[#4FC3F7]" />
      {label}
    </label>
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
