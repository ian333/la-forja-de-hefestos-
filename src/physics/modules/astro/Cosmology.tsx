/**
 * Cosmología ΛCDM — Ecuaciones de Friedmann en 3D.
 *
 * FÍSICA REAL:
 *   (ȧ/a)² = H² = 8πGρ/3 − k/a² + Λ/3
 *
 * Se normaliza con H₀ = 67.4 km/s/Mpc (Planck 2018).
 * Parámetros de densidad: Ω_m = 0.315, Ω_r = 9.24×10⁻⁵, Ω_Λ = 0.685, k=0.
 *
 * La ecuación de Friedmann en forma reducida (curvatura k=0, unidades H₀):
 *   (ȧ/a)² / H₀² = Ω_r / a⁴ + Ω_m / a³ + Ω_Λ
 *
 * Se integra con RK4. El corrimiento al rojo: z = 1/a − 1.
 *
 * Visualización: un universo de partículas que se expande (o contrae) en 3D.
 * Las partículas están fijas en coordenadas comóviles; el factor a(t) escala
 * su posición física. El color codifica la época dominante:
 *   - Amarillo/naranja: dominado por radiación (a pequeño)
 *   - Cian: dominado por materia (a intermedio)
 *   - Violeta: dominado por energía oscura (a grande, ahora)
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Cosmological constants (Planck 2018) ───────────────────────────────────

const H0 = 67.4;          // km/s/Mpc  (valor numérico, unidades cosmológicas)
const OM = 0.315;          // Ω_m
const OR = 9.24e-5;        // Ω_r
const OL = 0.685;          // Ω_Λ = 1 − Ω_m − Ω_r (universo plano)
const H0_SI = 2.184e-18;   // H₀ en s⁻¹ (para tiempo en años: H₀⁻¹ ≈ 14.4 Gyr)
const GYR_TO_S = 3.1536e16; // 1 Gyr en segundos

// ─── Friedmann integrator (RK4) ─────────────────────────────────────────────

/** dȧ/dt = a · H(a) con H² = H₀² (Ω_r/a⁴ + Ω_m/a³ + Ω_Λ) para k=0. */
function friedmannDerivative(a: number): number {
  if (a <= 0) return 0;
  const H2 = OR / (a * a * a * a) + OM / (a * a * a) + OL;
  // H en unidades de H₀. ȧ = a * H.
  return a * Math.sqrt(Math.max(H2, 0));
}

/** Redshift z = 1/a − 1. */
function redshift(a: number): number { return 1 / a - 1; }

/** Convierte tH0 a Gyr. H₀⁻¹ ≈ 14.44 Gyr. */
function tH0ToGyr(tH0: number): number {
  return tH0 / (H0_SI * GYR_TO_S);
}

// ─── Lesson state ────────────────────────────────────────────────────────────

interface CosmoState {
  model: 'lcdm' | 'matter-only' | 'lambda-only' | 'radiation-only';
  aTarget: number;   // factor de escala objetivo (0.1 ... 3)
}

const LESSON: Lesson<CosmoState> = {
  hook: {
    title: 'El universo NO explota — se ESTIRA. Y Einstein casi se lo pierde.',
    body: `En 1917 Einstein aplicó su relatividad general al cosmos entero. Obtuvo una ecuación que decía que el universo debía EXPANDIRSE o contraerse. Eso le pareció absurdo — el cosmos debía ser eterno e inmóvil.

Entonces introdujo la "constante cosmológica" Λ para frenarlo artificialmente. Llamó a eso "el mayor error de mi vida".

Doce años después, Edwin Hubble midió galaxias lejanas. Su velocidad de recesión era PROPORCIONAL a su distancia: v = H₀·d. El universo se expandía.

Las ecuaciones de Friedmann (1922) — derivadas de la GR sin constante cosmológica — ya lo decían. Pero nadie las tomó en serio... hasta que Hubble las confirmó.

Hoy sabemos: el universo tiene ~13.8 mil millones de años, empezó en un Big Bang, y su expansión se ACELERA por una energía oscura que se comporta exactamente como esa constante Λ que Einstein añadió por error.`,
  },

  steps: [
    {
      title: 'Factor de escala a(t) — ¿qué significa que el universo se expande?',
      duration: 6000,
      body: `El universo no tiene borde ni centro. La expansión es del espacio mismo.

Se describe con el factor de escala a(t): si hoy a=1, ayer a era más pequeño. Las distancias físicas entre galaxias son: d_fís = a(t) · d_comóvil.

La ecuación de Friedmann dice cuánto cambia a: (ȧ/a)² = H²(t). H₀ ≈ 67.4 km/s/Mpc es la tasa de expansión HOY.

Mira las partículas (galaxias en coordenadas comóviles): mientras a crece, se separan físicamente. El espacio entre ellas se estira.`,
      formula: `(ȧ/a)² = H₀² · [Ω_r/a⁴ + Ω_m/a³ + Ω_Λ]
H₀ = 67.4 km/s/Mpc  (Planck 2018)`,
      keyframes: [
        { at: 0, state: { model: 'lcdm', aTarget: 0.15 } },
        { at: 1, state: { model: 'lcdm', aTarget: 1.0 } },
      ],
    },
    {
      title: 'Tres eras — radiación, materia, energía oscura',
      duration: 7000,
      body: `Cada componente domina a la expansión en una época distinta. La densidad de cada una cae diferente con a:

• Radiación: ρ_r ∝ a⁻⁴ (se diluye + se corre al rojo). Domina a < 3300 años.
• Materia: ρ_m ∝ a⁻³ (solo se diluye). Domina hasta hace ~5 Gyr.
• Energía oscura (Λ): ρ_Λ = cte. Domina hoy — y se acelera.

El "parámetro de desaceleración" q = −äa/ȧ² cambia de signo hace ~5 Gyr: ANTES el universo frenaba, AHORA acelera.

Mira cómo el color de las partículas cambia: amarillo=radiación, cian=materia, violeta=Λ.`,
      formula: `q(a) = −(äa/ȧ²) = (Ω_r/a⁴ + ½Ω_m/a³ − Ω_Λ) / (Ω_r/a⁴ + Ω_m/a³ + Ω_Λ)
q < 0 hoy → expansión ACELERADA`,
      keyframes: [
        { at: 0, state: { model: 'lcdm', aTarget: 0.1 } },
        { at: 0.4, state: { model: 'lcdm', aTarget: 0.5 } },
        { at: 1, state: { model: 'lcdm', aTarget: 2.0 } },
      ],
    },
    {
      title: 'Corrimiento al rojo z — la regla cosmológica de distancias',
      duration: 5500,
      body: `La luz emitida cuando el universo tenía factor de escala a llega HOY estirada: la longitud de onda se expandió junto con el espacio.

El corrimiento al rojo: z = λ_obs/λ_emit − 1 = 1/a − 1.

CMB (fondo de microondas): emitido en a ≈ 0.001, z ≈ 1100. El universo era 1100 veces más pequeño.

Las galaxias más lejanas observadas: z ≈ 13 → a ≈ 0.07, edad ~0.35 Gyr.

El horizonte cosmológico hoy (partícula): d_H = c ∫₀¹ da/(a²·H(a)) ≈ 46.5 Gly.`,
      formula: `z = 1/a − 1
a_CMB ≈ 1/1100  (z = 1089)
a_hoy = 1       (z = 0)`,
      keyframes: [
        { at: 0, state: { model: 'lcdm', aTarget: 0.001 } },
        { at: 0.5, state: { model: 'lcdm', aTarget: 0.1 } },
        { at: 1, state: { model: 'lcdm', aTarget: 1.0 } },
      ],
    },
    {
      title: 'Universo sin Λ vs ΛCDM — el destino cambia',
      duration: 6500,
      body: `Compara dos modelos: solo materia (Ω_m=1, Λ=0) vs ΛCDM (Ω_m=0.315, Ω_Λ=0.685).

Sin Λ: la gravedad frena siempre la expansión. Si Ω_m > 1 (cerrado), colapsa en Big Crunch. Si Ω_m < 1 (abierto), se expande para siempre pero frenando. Si Ω_m = 1 (plano), se expande pero a→∞ solo en tiempo infinito.

CON Λ: la energía oscura supera a la gravedad cuando a es grande. El universo se expande EXPONENCIALMENTE — era de Sitter. Las galaxias lejanas eventualmente superan c (no viola SR: es el espacio que se estira).

Ese escenario, respaldado por supernovas Tipo Ia en 1998 (Nobel 2011), define el modelo estándar de cosmología: ΛCDM.`,
      formula: `ΛCDM: ä/a = −4πG(ρ+3p)/3 + Λ/3
Para Λ > 0: ä > 0 cuando Ω_Λ > Ω_m/2a³`,
      keyframes: [
        { at: 0, state: { model: 'matter-only', aTarget: 1.5 } },
        { at: 0.5, state: { model: 'lcdm', aTarget: 1.5 } },
        { at: 1, state: { model: 'lcdm', aTarget: 2.5 } },
      ],
    },
  ],

  connect: {
    body: `Las ecuaciones de Friedmann son la GR aplicada al universo homogéneo e isótropo (principio cosmológico). Son exactas dentro de ese supuesto.

El ΛCDM encaja con:
• Fondo de microondas (CMB) — Planck 2018
• Distribución de grandes estructuras (BAO)
• Supernovas Tipo Ia (aceleración)
• Abundancias de elementos (nucleosíntesis Big Bang)

Tensiones abiertas (2024):
• Tensión de Hubble: H₀ local (73) vs CMB (67.4) — ¿nueva física?
• σ₈ — amplitud de fluctuaciones vs surveys de lensing
• El origen de Λ — la constante cosmológica es ~120 órdenes de magnitud más pequeña de lo que predice QFT.

Si se resuelven, el modelo que emerge será la cosmología del siglo XXI.`,
    links: [
      { label: 'Agujero Negro — curvatura extrema', href: '#black-hole' },
      { label: 'Schwarzschild — embedding de Flamm', href: '#schwarzschild' },
      { label: 'Estructura Estelar — termodinámica', href: '#stellar-structure' },
    ],
  },
};

// ─── Particle layout (comoving coords) ──────────────────────────────────────

const N_PARTICLES = 1800;

function buildComovingPositions(n: number): Float32Array {
  const pos = new Float32Array(n * 3);
  // Poisson-like distribution in a cube [-1,1]³ using a simple LCG
  let s = 12345;
  function lcg() { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; }
  for (let i = 0; i < n; i++) {
    pos[i * 3 + 0] = (lcg() * 2 - 1);
    pos[i * 3 + 1] = (lcg() * 2 - 1);
    pos[i * 3 + 2] = (lcg() * 2 - 1);
  }
  return pos;
}

// ─── Precompute Friedmann tracks ─────────────────────────────────────────────

const TRACK_STEPS = 2000;

function buildTrack(omr: number, omm: number, oml: number) {
  const aArr: number[] = [];
  const tArr: number[] = [];
  let a = 0.001;
  let t = 0;
  const aEnd = 3.5;
  const da = (aEnd - a) / TRACK_STEPS;
  for (let i = 0; i <= TRACK_STEPS; i++) {
    aArr.push(a);
    tArr.push(t);
    const H2 = omr / (a ** 4) + omm / (a ** 3) + oml;
    const adot = a * Math.sqrt(Math.max(H2, 0));
    if (adot < 1e-12) break;
    const dt = da / adot;
    const k1 = adot;
    const k2 = (a + 0.5 * dt * k1) * Math.sqrt(Math.max(omr / ((a + 0.5 * dt * k1) ** 4) + omm / ((a + 0.5 * dt * k1) ** 3) + oml, 0));
    const k3 = (a + 0.5 * dt * k2) * Math.sqrt(Math.max(omr / ((a + 0.5 * dt * k2) ** 4) + omm / ((a + 0.5 * dt * k2) ** 3) + oml, 0));
    const k4 = (a + dt * k3) * Math.sqrt(Math.max(omr / ((a + dt * k3) ** 4) + omm / ((a + dt * k3) ** 3) + oml, 0));
    a = Math.min(a + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4), aEnd);
    t += dt;
  }
  return { a: aArr, tH0: tArr };
}

const MODELS = {
  lcdm:           buildTrack(OR, OM,  OL),
  'matter-only':  buildTrack(0,  1.0, 0),
  'lambda-only':  buildTrack(0,  0,   1.0),
  'radiation-only': buildTrack(1.0, 0, 0),
} as const;

type ModelKey = keyof typeof MODELS;

/** tH0 (en unidades H₀⁻¹) para un dado a en el modelo. Interpolación lineal. */
function tFromA(model: ModelKey, targetA: number): number {
  const track = MODELS[model];
  const n = track.a.length;
  for (let i = 1; i < n; i++) {
    if (track.a[i] >= targetA) {
      const frac = (targetA - track.a[i - 1]) / (track.a[i] - track.a[i - 1]);
      return track.tH0[i - 1] + frac * (track.tH0[i] - track.tH0[i - 1]);
    }
  }
  return track.tH0[n - 1];
}

// ─── Era color (radiation=yellow, matter=cyan, lambda=violet) ───────────────

function eraColor(a: number, r: THREE.Color): void {
  // Fraction of each component in total density
  const rho_r = OR / (a ** 4);
  const rho_m = OM / (a ** 3);
  const rho_l = OL;
  const total = rho_r + rho_m + rho_l + 1e-30;
  const fr = rho_r / total;
  const fm = rho_m / total;
  const fl = rho_l / total;
  // Radiation: warm orange #FDB813, Matter: cyan #4FC3F7, Lambda: violet #9D4EDD
  r.setRGB(
    fr * 0.99 + fm * 0.31 + fl * 0.62,
    fr * 0.72 + fm * 0.76 + fl * 0.31,
    fr * 0.07 + fm * 0.97 + fl * 0.87,
  );
}

// ─── Component: the expanding universe scene ─────────────────────────────────

interface UniverseSceneProps {
  modelRef: React.MutableRefObject<ModelKey>;
  aTargetRef: React.MutableRefObject<number>;
}

function UniverseScene({ modelRef, aTargetRef }: UniverseSceneProps) {
  const tex = useMemo(() => getParticleTexture(), []);
  const comovingPos = useMemo(() => buildComovingPositions(N_PARTICLES), []);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_PARTICLES * 3), 3));
    g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(N_PARTICLES * 3), 3));
    return g;
  }, []);

  // Smooth animation: interpolate a(t) toward target
  const aCurrentRef = useRef(0.5);
  const colorBuf = useMemo(() => new THREE.Color(), []);

  // Horizon sphere (visual)
  const horizonRef = useRef<THREE.Mesh>(null);

  // Label position refs
  const nowMarkerRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const aTarget = aTargetRef.current;
    // Lerp a toward target (cosmetic animation speed)
    const speed = 0.8;
    aCurrentRef.current += (aTarget - aCurrentRef.current) * Math.min(speed * delta, 0.95);
    const a = Math.max(0.001, aCurrentRef.current);

    const pos = geom.attributes.position as THREE.BufferAttribute;
    const col = geom.attributes.color as THREE.BufferAttribute;
    const pArr = pos.array as Float32Array;
    const cArr = col.array as Float32Array;

    eraColor(a, colorBuf);
    const cr = colorBuf.r;
    const cg = colorBuf.g;
    const cb = colorBuf.b;

    for (let i = 0; i < N_PARTICLES; i++) {
      const cx = comovingPos[i * 3 + 0];
      const cy = comovingPos[i * 3 + 1];
      const cz = comovingPos[i * 3 + 2];
      // Physical position = a * comoving, scaled to fit scene
      const scale = 2.5;
      pArr[i * 3 + 0] = cx * a * scale;
      pArr[i * 3 + 1] = cy * a * scale;
      pArr[i * 3 + 2] = cz * a * scale;
      // Brighter for particles near center (depth cue)
      const dist = Math.sqrt(cx * cx + cy * cy + cz * cz);
      const bright = Math.max(0.4, 1.0 - dist * 0.3);
      cArr[i * 3 + 0] = cr * bright;
      cArr[i * 3 + 1] = cg * bright;
      cArr[i * 3 + 2] = cb * bright;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;

    // Horizon visual ring
    if (horizonRef.current) {
      const r = a * 2.5;
      horizonRef.current.scale.setScalar(r);
    }
  });

  return (
    <>
      {/* Galaxias (partículas) */}
      <points geometry={geom}>
        <pointsMaterial
          vertexColors
          map={tex}
          alphaMap={tex}
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Esfera de horizonte comóvil — borde del universo observable */}
      <mesh ref={horizonRef}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial
          color="#4FC3F7"
          emissive="#4FC3F7"
          emissiveIntensity={0.08}
          transparent
          opacity={0.04}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={[1.002, 1.002, 1.002]} ref={undefined}>
        {/* Ring wireframe on horizon */}
      </mesh>

      {/* Punto de origen (Singularidad / Big Bang) */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.04, 24, 16]} />
        <meshStandardMaterial
          color="#FDB813"
          emissive="#FDB813"
          emissiveIntensity={3.0}
          toneMapped={false}
        />
      </mesh>

      {/* Ejes de referencia (muy tenues) */}
      <GridDots />
    </>
  );
}

/** Puntos de referencia en los ejes */
function GridDots() {
  const positions = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      pts.push([i * 0.8, 0, 0]);
      pts.push([0, i * 0.8, 0]);
      pts.push([0, 0, i * 0.8]);
    }
    return pts;
  }, []);

  return (
    <>
      {positions.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial color="#1E293B" emissive="#334155" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </>
  );
}

// AofTCurve is reserved for a future overlay; not rendered in the current scene.

// ─── Top-level component ──────────────────────────────────────────────────────

export default function Cosmology() {
  const { audience } = useAudience();

  const [model, setModel] = useState<ModelKey>('lcdm');
  const [aTarget, setATarget] = useState(1.0);
  const [running, setRunning] = useState(true);

  const modelRef = useRef<ModelKey>('lcdm');
  const aTargetRef = useRef(1.0);

  // Keep refs in sync
  useEffect(() => { modelRef.current = model; }, [model]);
  useEffect(() => { aTargetRef.current = aTarget; }, [aTarget]);

  // Auto-play: slowly evolve a through cosmic time
  const aAutoRef = useRef(0.15);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      // Advance a at a cosmetically pleasing rate
      aAutoRef.current = Math.min(aAutoRef.current + dt * 0.12, 2.8);
      if (aAutoRef.current >= 2.79) aAutoRef.current = 0.1;
      aTargetRef.current = aAutoRef.current;
      setATarget(parseFloat(aAutoRef.current.toFixed(3)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  // Computed observables
  const a = aTarget;
  const z = redshift(a);
  const tH0 = tFromA(model, a);
  const tGyr = tH0ToGyr(tH0);
  const H2 = OR / (a ** 4) + OM / (a ** 3) + OL;
  const H = Math.sqrt(Math.max(H2, 0)) * H0;  // km/s/Mpc
  // Deceleration: q = -(äa/ȧ²) = (Ω_r/a⁴ + ½Ω_m/a³ - Ω_Λ) / H²_norm
  const qNum = OR / (a ** 4) + 0.5 * OM / (a ** 3) - OL;
  const q = qNum / Math.max(H2, 1e-30);
  // Dominant era
  const rho_r = OR / (a ** 4);
  const rho_m = OM / (a ** 3);
  const rho_l = OL;
  const era =
    rho_r > rho_m && rho_r > rho_l ? 'Radiación' :
    rho_m > rho_l ? 'Materia' : 'Λ (energía oscura)';

  function fmt(x: number, d = 3) { return isFinite(x) && !isNaN(x) ? x.toFixed(d) : '—'; }
  function fmtSci(x: number, d = 2) { return isFinite(x) && !isNaN(x) ? x.toExponential(d) : '—'; }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage
          cameraDistance={5}
          autoRotate
          bloomIntensity={1.1}
          bloomThreshold={0.08}
          bgColor="#030507"
        >
          <UniverseScene modelRef={modelRef} aTargetRef={aTargetRef} />
        </Stage>

        {/* HUD métricas */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">a(t)&nbsp;&nbsp;&nbsp;</span>= <span className="text-white">{fmt(a, 3)}</span></div>
          <div><span className="text-[#64748B]">z&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= <span className="text-[#FDB813]">{z > 1000 ? fmtSci(z, 1) : fmt(z, 2)}</span></div>
          <div><span className="text-[#64748B]">t&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= <span className="text-[#4FC3F7]">{fmt(tGyr, 2)} Gyr</span></div>
          <div><span className="text-[#64748B]">H(t)&nbsp;&nbsp;</span>= {fmt(H, 1)} km/s/Mpc</div>
          <div><span className="text-[#64748B]">q&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= <span className={q < 0 ? 'text-[#9D4EDD]' : 'text-[#F472B6]'}>{fmt(q, 3)}</span></div>
          <div><span className="text-[#64748B]">era&nbsp;&nbsp;&nbsp;</span>= <span className="text-[#34D399] text-[10px]">{era}</span></div>
        </div>

        {/* Controles de reproducción */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <CosmBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</CosmBtn>
          <CosmBtn onClick={() => { aAutoRef.current = 0.1; setATarget(0.1); }} title="Big Bang">«</CosmBtn>
          <CosmBtn onClick={() => { aAutoRef.current = 1.0; setATarget(1.0); }} title="Hoy (a=1)">⊙</CosmBtn>
          <CosmBtn onClick={() => { aAutoRef.current = 2.5; setATarget(2.5); }} title="Futuro">»</CosmBtn>
        </div>
      </div>

      <LessonPanel<CosmoState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.model !== undefined) {
            setModel(patch.model);
            modelRef.current = patch.model;
          }
          if (patch.aTarget !== undefined) {
            aAutoRef.current = patch.aTarget;
            aTargetRef.current = patch.aTarget;
            setATarget(patch.aTarget);
          }
        }}
        sandbox={
          <>
            <Section title="Modelo cosmológico">
              <div className="grid grid-cols-1 gap-1.5">
                {(Object.keys(MODELS) as ModelKey[]).map(m => (
                  <button key={m} onClick={() => setModel(m)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      model === m
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}>
                    {m === 'lcdm' ? 'ΛCDM (estándar)' :
                     m === 'matter-only' ? 'Solo materia (Ω_m=1)' :
                     m === 'lambda-only' ? 'Solo Λ (de Sitter)' :
                     'Solo radiación'}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Factor de escala a(t)">
              <Slider
                label="a"
                v={aTarget}
                min={0.001}
                max={3.0}
                step={0.001}
                on={(v) => { setATarget(v); aAutoRef.current = v; aTargetRef.current = v; }}
              />
              <div className="mt-1 text-[10px] text-[#64748B]">
                a = 1 → hoy. a &lt; 1 → pasado. a &gt; 1 → futuro.
              </div>
            </Section>

            {audience !== 'child' && (
              <Section title="Parámetros Planck 2018">
                <Row label="H₀"   value={`${H0} km/s/Mpc`} />
                <Row label="Ω_m"  value={OM.toString()} />
                <Row label="Ω_r"  value={fmtSci(OR, 2)} />
                <Row label="Ω_Λ"  value={OL.toString()} />
                <Row label="k"    value="0 (plano)" />
              </Section>
            )}

            <Section title="Observables ahora">
              <Row label="a(t)"   value={fmt(a, 4)} />
              <Row label="z"      value={z > 1000 ? fmtSci(z, 2) : fmt(z, 3)} />
              <Row label="t"      value={`${fmt(tGyr, 2)} Gyr`} />
              <Row label="H(t)"   value={`${fmt(H, 1)} km/s/Mpc`} />
              <Row label="q"      value={fmt(q, 4)} highlight={q < 0} />
              <Row label="Era"    value={era} />
            </Section>

            <Section title="Ecuación">
              <div className="text-[10px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">(ȧ/a)² = H₀²·[Ω_r/a⁴ + Ω_m/a³ + Ω_Λ]</div>
                <div className="text-[#64748B]">integrado con RK4, dt = Δa/ȧ</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
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
function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className={highlight ? 'text-[#9D4EDD]' : 'text-white'}>{value}</span>
    </div>
  );
}
function Slider({ label, v, min, max, step, on }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v.toFixed(3)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v} onChange={e => on(Number(e.target.value))} className="w-full" />
    </div>
  );
}
function CosmBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className={`w-9 h-9 rounded-md border text-[13px] transition flex items-center justify-center ${
        active
          ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
          : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
      }`}>
      {children}
    </button>
  );
}
