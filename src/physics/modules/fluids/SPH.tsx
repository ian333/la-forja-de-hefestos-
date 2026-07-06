/**
 * SPH — Smoothed Particle Hydrodynamics en 3D.
 *
 * Física real: densidad ρᵢ = Σⱼ mⱼ W(|rᵢ−rⱼ|, h) con kernel poly6;
 * presión P = k(ρ − ρ₀) (ley de gas); fuerzas: ∇P con spiky kernel,
 * viscosidad μ∇²v con laplaciano kernel, gravedad g ẑ.
 * Integrador: Verlet de velocidad semi-implícito (1 paso = 2 ms sim).
 * Visualización: point cloud additive con color por velocidad |v|,
 * gota de ~N=800 partículas, caja AABB con rebote suave.
 *
 * Referencia: Müller et al. 2003 "Particle-based fluid simulation".
 */

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { getParticleTexture } from '@/labs/components/sprite-texture';

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface SPHLessonState {
  presetId: string;
}

// ─── Lesson ────────────────────────────────────────────────────────────────

const LESSON: Lesson<SPHLessonState> = {
  hook: {
    title: 'Un fluido es una nube de partículas que se "sienten" entre sí.',
    body: `La mecánica de fluidos clásica (Navier-Stokes) trata al fluido como un campo continuo. Pero computacionalmente, es más natural hablar de partículas: cada molécula de agua interactúa con sus vecinas.

SPH (Smoothed Particle Hydrodynamics) hace exactamente eso. Cada partícula "ve" a las demás dentro de un radio h y promedia sus propiedades con un kernel suavizante W(r,h).

El resultado: densidad real, presión real, viscosidad real — y un fluido que chorrea, salpica y responde a la gravedad con física correcta. El modelo lo inventaron Gingold & Monaghan (1977) para astrofísica; hoy se usa en efectos de agua en cine y juegos AAA.`,
  },

  steps: [
    {
      title: 'Kernel SPH — la distancia importa de forma suave',
      duration: 6000,
      body: `El núcleo del método es la función W(r,h). Cada partícula i calcula la densidad en su posición sumando la contribución de todas las vecinas j, pesada por W:

ρᵢ = Σⱼ mⱼ W(|rᵢ − rⱼ|, h)

El kernel poly6 de Müller et al. es:
W(r,h) = (315/64πh⁹)(h²−r²)³  para r≤h, 0 si no.

h es el "radio de influencia". Más grande = el fluido se ve más comprimible pero es más caro de calcular.`,
      formula: 'ρᵢ = Σⱼ mⱼ W(|rᵢ−rⱼ|, h)\nW_poly6 = (315/64πh⁹)(h²−r²)³',
      keyframes: [
        { at: 0, state: { presetId: 'drop' } },
        { at: 1, state: { presetId: 'drop' } },
      ],
    },
    {
      title: 'Presión — las partículas se repelen cuando están muy juntas',
      duration: 6000,
      body: `Con la densidad calculada, la presión viene de la ley de gas:
P = k(ρ − ρ₀)

k es la "rigidez" del fluido; ρ₀ es la densidad de reposo. Si ρ > ρ₀ (el fluido está comprimido), la presión empuja hacia afuera.

La fuerza de presión usa el gradiente del kernel spiky (que tiene derivada no nula en r=0 a diferencia de poly6):
fᵢ_pres = −Σⱼ mⱼ (Pᵢ+Pⱼ)/(2ρⱼ) ∇W_spiky

Mirá la gota: las partículas del centro tienen densidad alta, por eso rebotan hacia afuera cuando cae. La superficie se mantiene cohesiva porque la capa exterior tiene densidad baja — poca presión, poca repulsión.`,
      formula: 'P = k(ρ−ρ₀)\nfᵢ = −Σⱼ mⱼ (Pᵢ+Pⱼ)/(2ρⱼ) ∇W_spiky',
      keyframes: [
        { at: 0, state: { presetId: 'drop' } },
        { at: 1, state: { presetId: 'drop' } },
      ],
    },
    {
      title: 'Viscosidad — el fluido frena las diferencias de velocidad',
      duration: 5500,
      body: `Sin viscosidad, el fluido explota — las partículas se comprimen, se repelen, nunca se amortiguan.

La viscosidad difunde el momento entre vecinos: si una partícula va más rápido que sus vecinas, el término viscoso la frena y acelera a las lentas:
fᵢ_visc = μ Σⱼ mⱼ (vⱼ−vᵢ)/ρⱼ ∇²W_visc

∇²W_visc = (45/πh⁶)(h−r)

μ es la viscosidad dinámica. Agua: μ≈1e-3 Pa·s. Miel: μ~10 Pa·s. Aquí usamos μ=0.3 para un fluido viscoso visible en las partículas.

Activá el preset "alta viscosidad" y verás la gota bajar más lenta, como glicerina.`,
      formula: 'fᵢ_visc = μ Σⱼ mⱼ (vⱼ−vᵢ)/ρⱼ ∇²W_visc\n∇²W_visc = (45/πh⁶)(h−r)',
      keyframes: [
        { at: 0, state: { presetId: 'drop' } },
        { at: 1, state: { presetId: 'drop' } },
      ],
    },
    {
      title: 'Gravedad + caja AABB — el chapoteo emerge',
      duration: 6000,
      body: `La fuerza total sobre cada partícula:
fᵢ = fᵢ_pres + fᵢ_visc + ρᵢ g ẑ

La integración es Verlet de velocidad semi-implícita (symplectica):
vᵢ(t+dt) = vᵢ(t) + (fᵢ/ρᵢ) dt
rᵢ(t+dt) = rᵢ(t) + vᵢ(t+dt) dt

Las paredes de la caja rebotan con restitución 0.3 (inelástico — el fluido no es una pelota).

El color de cada partícula va de azul cian (reposo) a blanco (|v| alto). Las partículas más brillantes son las que acaban de botar o están cayendo. El patrón de salpicadura es emergente — no está programado, surge de las interacciones entre pares.`,
      formula: 'aᵢ = fᵢ_total/ρᵢ + g\nvᵢ += aᵢ dt ; rᵢ += vᵢ dt',
      keyframes: [
        { at: 0, state: { presetId: 'drop' } },
        { at: 1, state: { presetId: 'drop' } },
      ],
    },
  ],

  connect: {
    body: `SPH es uno de los métodos sin-malla más versátiles en simulación:

• Astrofísica: Gingold & Monaghan (1977) lo usaron para simular estrellas que explotan (supernovas). La partícula es literalmente una "masa de gas".
• Efectos visuales: Houdini (usado en Avengers, Frozen) tiene un solver SPH híbrido para agua. El splash en este módulo usa la misma física real.
• Medicina: simular sangre en aneurismas (fluido no-newtoniano, viscosidad variable).
• Diferencias vs. Navier-Stokes en malla: SPH captura superficies libres sin nivel-set extra; NS en malla es más exacto en régimen laminar. Los mejores solvers actuales combinan ambos (FLIP/APIC).`,
    links: [
      { label: 'Navier-Stokes completo → Waves 2D', href: '#waves' },
      { label: 'Gases ideales → Thermo', href: '#thermo' },
    ],
  },
};

// ─── Constantes de simulación ───────────────────────────────────────────────

const N_PARTICLES = 600;
const H = 0.35;         // radio de influencia
const H2 = H * H;
const H6 = H2 * H2 * H2;
const H9 = H6 * H2 * H;
const MASS = 0.02;      // masa por partícula
const REST_DENSITY = 1.0;
const GRAVITY = -9.8;

// Kernels (Müller 2003)
const W_POLY6_COEFF    = 315 / (64 * Math.PI * H9);
const GRAD_SPIKY_COEFF = -45 / (Math.PI * H6);
const LAP_VISC_COEFF   =  45 / (Math.PI * H6);

function wPoly6(r2: number): number {
  if (r2 >= H2) return 0;
  const d = H2 - r2;
  return W_POLY6_COEFF * d * d * d;
}

function gradWSpiky(dx: number, dy: number, dz: number, r: number): [number, number, number] {
  if (r >= H || r < 1e-6) return [0, 0, 0];
  const c = GRAD_SPIKY_COEFF * (H - r) * (H - r) / r;
  return [c * dx, c * dy, c * dz];
}

function lapWVisc(r: number): number {
  if (r >= H) return 0;
  return LAP_VISC_COEFF * (H - r);
}

// ─── Presets ────────────────────────────────────────────────────────────────

interface SPHPreset {
  id: string;
  name: string;
  k: number;      // stiffness
  mu: number;     // viscosity
  note: string;
  initMode: 'drop' | 'column' | 'splash';
}

const PRESETS: SPHPreset[] = [
  {
    id: 'drop',
    name: 'Gota de agua (μ=0.3)',
    k: 200,
    mu: 0.3,
    note: 'Fluido poco viscoso. La gota cae y salpica. Color: velocidad.',
    initMode: 'drop',
  },
  {
    id: 'viscous',
    name: 'Glicerina (μ=2.0)',
    k: 200,
    mu: 2.0,
    note: 'Alta viscosidad — el fluido baja lento y no salpica mucho.',
    initMode: 'drop',
  },
  {
    id: 'column',
    name: 'Columna de agua — colapso',
    k: 250,
    mu: 0.4,
    note: 'Un pilar de partículas colapsa por gravedad y se expande.',
    initMode: 'column',
  },
  {
    id: 'splash',
    name: 'Lluvia — partículas caen en espiral',
    k: 200,
    mu: 0.25,
    note: 'N partículas distribuidas arriba caen sobre una capa inicial.',
    initMode: 'splash',
  },
];

// ─── Inicialización ─────────────────────────────────────────────────────────

const BOX = { xMin: -1.2, xMax: 1.2, yMin: -1.5, yMax: 3.0, zMin: -1.2, zMax: 1.2 };

function initParticles(mode: SPHPreset['initMode'], N: number) {
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const pz = new Float32Array(N);
  const vx = new Float32Array(N);
  const vy = new Float32Array(N);
  const vz = new Float32Array(N);

  if (mode === 'drop') {
    // Esfera compacta en la parte alta
    let placed = 0;
    const cx = 0, cy = 1.8, cz = 0;
    const r = 0.6;
    while (placed < N) {
      const x = (Math.random() * 2 - 1) * r;
      const y = (Math.random() * 2 - 1) * r;
      const z = (Math.random() * 2 - 1) * r;
      if (x * x + y * y + z * z <= r * r) {
        px[placed] = cx + x;
        py[placed] = cy + y;
        pz[placed] = cz + z;
        placed++;
      }
    }
  } else if (mode === 'column') {
    // Pilar vertical centrado
    let placed = 0;
    while (placed < N) {
      const x = (Math.random() * 2 - 1) * 0.35;
      const y = Math.random() * 2.5 - 1.0;
      const z = (Math.random() * 2 - 1) * 0.35;
      px[placed] = x; py[placed] = y; pz[placed] = z;
      placed++;
    }
  } else {
    // Splash: capa base + partículas que caen
    const base = Math.floor(N * 0.4);
    for (let i = 0; i < base; i++) {
      px[i] = (Math.random() * 2 - 1) * 1.0;
      py[i] = -1.2 + Math.random() * 0.4;
      pz[i] = (Math.random() * 2 - 1) * 1.0;
    }
    for (let i = base; i < N; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rad = Math.random() * 0.8;
      px[i] = Math.cos(angle) * rad;
      py[i] = 0.5 + Math.random() * 1.5;
      pz[i] = Math.sin(angle) * rad;
      vy[i] = -2.0;
    }
  }

  return { px, py, pz, vx, vy, vz };
}

// ─── Paso de simulación SPH (CPU) ──────────────────────────────────────────

function sphStep(
  N: number,
  px: Float32Array, py: Float32Array, pz: Float32Array,
  vx: Float32Array, vy: Float32Array, vz: Float32Array,
  rho: Float32Array, pres: Float32Array,
  fx: Float32Array, fy: Float32Array, fz: Float32Array,
  k: number, mu: number, dt: number,
) {
  // 1. Densidad
  for (let i = 0; i < N; i++) {
    let r = 0;
    for (let j = 0; j < N; j++) {
      const dx = px[i] - px[j];
      const dy = py[i] - py[j];
      const dz = pz[i] - pz[j];
      const r2 = dx * dx + dy * dy + dz * dz;
      r += MASS * wPoly6(r2);
    }
    rho[i] = r;
    pres[i] = k * (rho[i] - REST_DENSITY);
  }

  // 2. Fuerzas (presión + viscosidad)
  for (let i = 0; i < N; i++) {
    let Fx = 0, Fy = 0, Fz = 0;
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const dx = px[i] - px[j];
      const dy = py[i] - py[j];
      const dz = pz[i] - pz[j];
      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 >= H2 || r2 < 1e-10) continue;
      const r = Math.sqrt(r2);

      // Presión
      const [gx, gy, gz] = gradWSpiky(dx, dy, dz, r);
      const pc = -MASS * (pres[i] + pres[j]) / (2 * rho[j]);
      Fx += pc * gx;
      Fy += pc * gy;
      Fz += pc * gz;

      // Viscosidad
      const lv = lapWVisc(r);
      const vc = mu * MASS / rho[j] * lv;
      Fx += vc * (vx[j] - vx[i]);
      Fy += vc * (vy[j] - vy[i]);
      Fz += vc * (vz[j] - vz[i]);
    }
    // Gravedad
    Fy += rho[i] * GRAVITY;
    fx[i] = Fx; fy[i] = Fy; fz[i] = Fz;
  }

  // 3. Integración Verlet semi-implícita + rebote AABB
  const damping = 0.3;
  for (let i = 0; i < N; i++) {
    const ri = Math.max(rho[i], 0.001);
    vx[i] += fx[i] / ri * dt;
    vy[i] += fy[i] / ri * dt;
    vz[i] += fz[i] / ri * dt;
    px[i] += vx[i] * dt;
    py[i] += vy[i] * dt;
    pz[i] += vz[i] * dt;

    // Pared X
    if (px[i] < BOX.xMin) { px[i] = BOX.xMin; vx[i] *= -damping; }
    if (px[i] > BOX.xMax) { px[i] = BOX.xMax; vx[i] *= -damping; }
    // Pared Y
    if (py[i] < BOX.yMin) { py[i] = BOX.yMin; vy[i] *= -damping; }
    if (py[i] > BOX.yMax) { py[i] = BOX.yMax; vy[i] *= -damping; }
    // Pared Z
    if (pz[i] < BOX.zMin) { pz[i] = BOX.zMin; vz[i] *= -damping; }
    if (pz[i] > BOX.zMax) { pz[i] = BOX.zMax; vz[i] *= -damping; }
  }
}

// ─── Componente top-level ──────────────────────────────────────────────────

export default function SPH() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState('drop');
  const preset = PRESETS.find(p => p.id === presetId)!;

  const [stiffness, setStiffness] = useState(preset.k);
  const [viscosity,  setViscosity]  = useState(preset.mu);
  const [running,    setRunning]    = useState(true);
  const [simTime,    setSimTime]    = useState(0);

  // Arreglos de simulación en refs para mutación sin re-render
  const N = N_PARTICLES;
  const sim = useRef(initAndBuild(preset.initMode, N, preset.k, preset.mu));

  function initAndBuild(mode: SPHPreset['initMode'], n: number, k: number, mu: number) {
    const { px, py, pz, vx, vy, vz } = initParticles(mode, n);
    return {
      px, py, pz, vx, vy, vz,
      rho:  new Float32Array(n),
      pres: new Float32Array(n),
      fx:   new Float32Array(n),
      fy:   new Float32Array(n),
      fz:   new Float32Array(n),
      t:    0,
      k, mu,
    };
  }

  const resetSim = (p: SPHPreset) => {
    sim.current = initAndBuild(p.initMode, N, p.k, p.mu);
    setStiffness(p.k);
    setViscosity(p.mu);
    setSimTime(0);
  };

  const applyPreset = (id: string) => {
    const p = PRESETS.find(x => x.id === id)!;
    setPresetId(id);
    resetSim(p);
  };

  // Propagar controles al sim ref sin reiniciar partículas
  const simRef = sim.current;
  simRef.k  = stiffness;
  simRef.mu = viscosity;

  const [, forceRender] = useState(0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={4.5} autoRotate bloomIntensity={0.9} bloomThreshold={0.1}>
          <SPHScene
            simRef={sim}
            N={N}
            running={running}
            onTick={(t) => {
              sim.current.t = t;
            }}
            onUIUpdate={() => {
              setSimTime(sim.current.t);
              forceRender(x => x + 1);
            }}
          />
          <BoxWireframe />
        </Stage>

        {/* HUD métricas */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/75 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] pointer-events-none">
          <div><span className="text-[#64748B]">t      </span>= {simTime.toFixed(2)} s</div>
          <div><span className="text-[#64748B]">N      </span>= {N} partículas</div>
          <div><span className="text-[#64748B]">h      </span>= {H.toFixed(2)} m</div>
          <div><span className="text-[#64748B]">k      </span>= {stiffness}</div>
          <div><span className="text-[#64748B]">μ      </span>= {viscosity.toFixed(2)}</div>
        </div>

        {/* Controles de playback */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>
            {running ? '❚❚' : '▶'}
          </IconBtn>
          <IconBtn onClick={() => resetSim(preset)} title="Reiniciar">↺</IconBtn>
        </div>
      </div>

      <LessonPanel<SPHLessonState>
        lesson={LESSON}
        onApplyState={(patch) => {
          if (patch.presetId !== undefined) applyPreset(patch.presetId);
        }}
        sandbox={
          <>
            <Section title="Preset">
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      presetId === p.id
                        ? 'bg-gradient-to-br from-[#0E3A5C]/40 to-[#1E293B]/60 border-[#4FC3F7]/50 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{preset.note}</div>
            </Section>

            {audience !== 'child' && (
              <Section title="Parámetros SPH">
                <Slider
                  label="k — rigidez"
                  v={stiffness}
                  min={50} max={600} step={10}
                  on={v => setStiffness(v)}
                />
                <Slider
                  label="μ — viscosidad"
                  v={viscosity}
                  min={0.05} max={5} step={0.05}
                  on={v => setViscosity(v)}
                />
              </Section>
            )}

            {audience === 'child' && (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>Cada punto es una "gota pequeñita" de agua. Se atraen cuando están lejos y se empujan cuando están muy juntas.</p>
                  <p>El color <span className="text-[#4FC3F7]">azul</span> = quietas. <span className="text-white">Blanco/brillante</span> = moviéndose rápido.</p>
                </div>
              </Section>
            )}

            <Section title="Fórmulas clave">
              <div className="text-[10px] font-mono text-[#CBD5E1] space-y-1 leading-snug">
                <div className="text-[#4FC3F7]">ρᵢ = Σⱼ mⱼ W(|rᵢ−rⱼ|, h)</div>
                <div>P = k(ρ − ρ₀)</div>
                <div>fᵢ = f_pres + f_visc + ρg</div>
                <div className="text-[#64748B] mt-1">h = {H}, N = {N}, Δt = 2 ms</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ─── Escena 3D (DENTRO del Canvas) ────────────────────────────────────────

interface SPHSceneProps {
  simRef: React.MutableRefObject<{
    px: Float32Array; py: Float32Array; pz: Float32Array;
    vx: Float32Array; vy: Float32Array; vz: Float32Array;
    rho: Float32Array; pres: Float32Array;
    fx: Float32Array; fy: Float32Array; fz: Float32Array;
    t: number; k: number; mu: number;
  }>;
  N: number;
  running: boolean;
  onTick: (t: number) => void;
  onUIUpdate: () => void;
}

// Colores: azul-cian en reposo → blanco en alta velocidad
function velToColor(speed: number, maxSpeed: number): [number, number, number] {
  const t = Math.min(speed / (maxSpeed + 0.001), 1);
  // Cian (0.18, 0.76, 0.94) → blanco (1,1,1)
  return [
    0.18 + 0.82 * t,
    0.76 + 0.24 * t,
    0.94 + 0.06 * t,
  ];
}

function SPHScene({ simRef, N, running, onUIUpdate }: SPHSceneProps) {
  const tex = useMemo(() => getParticleTexture(), []);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    return g;
  }, [N]);

  const lastUIRef = useRef(0);
  const DT = 0.002;   // 2 ms sim step
  const SUBSTEPS = 3; // 3 sub-pasos por frame = ~6 ms de física por frame

  useFrame(({ clock }) => {
    const s = simRef.current;
    if (!running) return;

    // N sub-pasos
    for (let sub = 0; sub < SUBSTEPS; sub++) {
      sphStep(
        N,
        s.px, s.py, s.pz,
        s.vx, s.vy, s.vz,
        s.rho, s.pres,
        s.fx, s.fy, s.fz,
        s.k, s.mu, DT,
      );
      s.t += DT;
    }

    // Actualizar geometría
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const col = geom.attributes.color    as THREE.BufferAttribute;
    const posArr = pos.array as Float32Array;
    const colArr = col.array as Float32Array;

    // Velocidad máxima para normalizar colores
    let maxV = 0.1;
    for (let i = 0; i < N; i++) {
      const sp = Math.sqrt(s.vx[i] ** 2 + s.vy[i] ** 2 + s.vz[i] ** 2);
      if (sp > maxV) maxV = sp;
    }

    for (let i = 0; i < N; i++) {
      posArr[i * 3 + 0] = s.px[i];
      posArr[i * 3 + 1] = s.py[i];
      posArr[i * 3 + 2] = s.pz[i];
      const sp = Math.sqrt(s.vx[i] ** 2 + s.vy[i] ** 2 + s.vz[i] ** 2);
      const [r, g, b] = velToColor(sp, maxV);
      colArr[i * 3 + 0] = r;
      colArr[i * 3 + 1] = g;
      colArr[i * 3 + 2] = b;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;

    // UI cada 120 ms
    const now = clock.elapsedTime;
    if (now - lastUIRef.current > 0.12) {
      lastUIRef.current = now;
      onUIUpdate();
    }
  });

  return (
    <points geometry={geom}>
      <pointsMaterial
        vertexColors
        map={tex}
        alphaMap={tex}
        size={0.12}
        sizeAttenuation
        transparent
        opacity={0.92}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

// ─── Wireframe de la caja AABB ─────────────────────────────────────────────

function BoxWireframe() {
  const w = BOX.xMax - BOX.xMin;
  const h = BOX.yMax - BOX.yMin;
  const d = BOX.zMax - BOX.zMin;
  const cx = (BOX.xMin + BOX.xMax) / 2;
  const cy = (BOX.yMin + BOX.yMax) / 2;
  const cz = (BOX.zMin + BOX.zMax) / 2;
  return (
    <lineSegments position={[cx, cy, cz]}>
      <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
      <lineBasicMaterial color="#1E3A5F" transparent opacity={0.35} />
    </lineSegments>
  );
}

// ─── UI helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
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
