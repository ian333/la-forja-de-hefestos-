/**
 * Cuerpo Rígido en rotación libre — Ecuaciones de Euler + Teorema de la Raqueta.
 *
 * Física real implementada:
 *   - Ecuaciones de Euler del cuerpo rígido (marco del cuerpo):
 *       I₁ dΩ₁/dt = (I₂ − I₃) Ω₂ Ω₃
 *       I₂ dΩ₂/dt = (I₃ − I₁) Ω₃ Ω₁
 *       I₃ dΩ₃/dt = (I₁ − I₂) Ω₁ Ω₂
 *   - Orientación actualizada con cuaternión: q̇ = ½ q ⊗ [0, Ω]
 *   - Teorema del eje intermedio (Dzhanibekov / "raqueta de tenis"):
 *       I₁ < I₂ < I₃ → eje 2 (I₂) es INESTABLE. Pequeña perturbación → volteo.
 *   - Integrador: RK4 en el estado (Ω₁, Ω₂, Ω₃, q₀, q₁, q₂, q₃).
 *   - Conservación verificada: |L|² y T (energía cinética) constantes.
 *
 * Mensaje pedagógico: en el espacio, un cuerpo que gira libremente
 * alrededor del eje INTERMEDIO se voltea de forma periódica y dramática —
 * no por fuerza externa, sino por pura geometría del tensor de inercia.
 */

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';

// ── Estado de la lección ─────────────────────────────────────────────────────

interface RBLessonState {
  presetId: string;
}

// ── Lesson ────────────────────────────────────────────────────────────────────

const LESSON: Lesson<RBLessonState> = {
  hook: {
    title: 'Un eje de rotación que se voltea solo. Sin fuerzas externas.',
    body: `En 1985 el cosmonauta Vladimir Dzhanibekov observó algo perturbador en la Estación Mir: una tuerca que giraba libremente en ingravidez se VOLTEABA cada pocos segundos, restablecía el giro, y se volvía a voltear. Sin nadie que la tocara.

Lo reportó como un fenómeno "misterioso". No era misterio — era las Ecuaciones de Euler de 1758.

Todo cuerpo rígido tiene tres momentos de inercia principales (I₁ < I₂ < I₃). Los ejes de mínimo (I₁) y máximo (I₃) son ESTABLES. El eje INTERMEDIO (I₂) es completamente inestable: la más pequeña perturbación lo hace voltearse de forma periódica.

Así rotan las galaxias irregulares, los asteroides caóticos, y tus llaves cuando las lanzas al aire.`,
  },

  steps: [
    {
      title: 'Eje mínimo (I₁) — estable, giro suave',
      duration: 6000,
      body: `La raqueta gira alrededor del eje de MÍNIMO momento de inercia (I₁ — el eje largo).

Esta rotación es ESTABLE. Podés darle una pequeña perturbación — el objeto sigue girando alrededor del mismo eje. Los giroscopios de precisión operan en este régimen.

El vector de momento angular L = I·Ω es CONSTANTE (sin torque externo). La energía cinética T = ½ Ω·I·Ω también es constante. Dos integrales de movimiento → trayectoria restringida a la intersección de un elipsoide y una esfera en el espacio (Ω₁, Ω₂, Ω₃).

Para I₁ < I₂ < I₃, el polo norte del elipsoide (eje 1) y el polo sur (eje 3) son atractores del flujo.`,
      formula: 'I₁ dΩ₁/dt = (I₂−I₃)Ω₂Ω₃\nI₂ dΩ₂/dt = (I₃−I₁)Ω₃Ω₁\nI₃ dΩ₃/dt = (I₁−I₂)Ω₁Ω₂',
      keyframes: [
        { at: 0, state: { presetId: 'stable-min' } },
        { at: 1, state: { presetId: 'stable-min' } },
      ],
    },
    {
      title: 'Eje máximo (I₃) — también estable',
      duration: 5500,
      body: `Ahora giramos alrededor del eje de MÁXIMO momento de inercia (I₃ — el eje corto, el "gordo").

También estable. Es el modo de las perinolas y los trompos: I₃ es el mayor, las correcciones de primer orden se cancelan simétricamente.

La raqueta gira suave y uniforme. El vector Ω se queda cerca del eje 3 aunque haya perturbaciones pequeñas.

En física del plasma y astronomía, los objetos que "frenan" por emisión de ondas gravitacionales terminan girando en este modo (el de mínima energía para L dado).`,
      formula: 'T = ½(I₁Ω₁² + I₂Ω₂² + I₃Ω₃²) = cte\n|L|² = (I₁Ω₁)²+(I₂Ω₂)²+(I₃Ω₃)² = cte',
      keyframes: [
        { at: 0, state: { presetId: 'stable-max' } },
        { at: 1, state: { presetId: 'stable-max' } },
      ],
    },
    {
      title: 'Eje intermedio (I₂) — INESTABLE: el volteo de Dzhanibekov',
      duration: 8000,
      body: `Aquí ocurre el fenómeno: giramos alrededor del eje INTERMEDIO (I₂).

Mirá cómo la raqueta se va inclinando lentamente... y luego SE VOLTEA 180°. Luego vuelve a girar "normal", y se vuelve a voltear. Periódicamente. Para siempre.

¿Por qué? Linealiza las ecuaciones de Euler alrededor de Ω = (0, Ω₂, 0). Obtenés:
  δΩ̈₁ = −[(I₂−I₁)(I₂−I₃) / (I₁I₃)] Ω₂² δΩ₁

El factor es (I₂−I₁)(I₂−I₃). Para el eje intermedio, I₁ < I₂ < I₃, entonces ese factor es POSITIVO · NEGATIVO = NEGATIVO. La ecuación es δΩ̈₁ = +k²δΩ₁ — ¡crecimiento exponencial! Perturbaciones que CRECEN → inestabilidad.

Para los ejes extremos (min y max), el factor es positivo → oscilaciones estables.`,
      formula: 'δΩ̈₁ = [(I₂−I₁)(I₂−I₃)/(I₁I₃)] Ω₂² δΩ₁\nI₁<I₂<I₃ → coef. < 0 → INESTABLE\n→ volteo periódico (solución: funciones Jacobianas dn, cn, sn)',
      keyframes: [
        { at: 0, state: { presetId: 'unstable-mid' } },
        { at: 1, state: { presetId: 'unstable-mid' } },
      ],
    },
    {
      title: 'Asimetría extrema — volteo ultra-rápido',
      duration: 6000,
      body: `Aumentamos la asimetría: I₁ ≪ I₂ ≪ I₃. El eje intermedio se vuelve aún más inestable.

El período del volteo T ∝ 1/(Ω₂ √[(I₂−I₁)(I₂−I₃)/(I₁I₃)]). Con mayor contraste entre momentos de inercia, el período es más corto.

En asteroides con forma muy irregular (como Oumuamua, el primer interestelar), se observa este comportamiento: rotación compleja no-principal que mezcla los tres ejes. Se llama "rotación tumbling".

La solución analítica exacta involucra funciones elípticas de Jacobi (dn, cn, sn) — análogos de sen/cos pero en geometría elíptica.`,
      formula: 'T_volteo ∝ 1 / (Ω₂ √|λ|)\nλ = (I₂−I₁)(I₂−I₃)/(I₁I₃)',
      keyframes: [
        { at: 0, state: { presetId: 'extreme-asymm' } },
        { at: 1, state: { presetId: 'extreme-asymm' } },
      ],
    },
  ],

  connect: {
    body: `Las ecuaciones de Euler del cuerpo rígido son la base de:

• Giroscopios y sistemas de navegación inercial (IMU) en aviones y satélites.
• Actitud de satélites: el CONTRL de orientación usa precisamente la inestabilidad del eje intermedio para evitarla — siempre se busca hacer girar en el eje mayor o menor.
• Física de asteroides y cuerpos celestes irregulares: muchos asteroides en el cinturón principal exhiben "rotación tumbling" (eje intermedio) y se usan las ecuaciones de Euler + Jacobi para modelar su evolución.
• Mecánica cuántica: el trompo cuántico (top simétrico cuántico) usa los mismos ángulos de Euler para describir estados de spin. La inestabilidad clásica tiene análogos cuánticos en el "quantum chaos".
• Biomecánica: el movimiento de articulaciones como el hombro se modela como cuerpo rígido con restricciones — las ecuaciones de Euler dan la dinámica base.`,
    links: [
      { label: 'Péndulo doble — caos determinista', href: '#double-pendulum' },
      { label: 'Schwarzschild — precesión relativista', href: '#schwarzschild' },
    ],
  },
};

// ── Tipos y Presets ───────────────────────────────────────────────────────────

interface RBParams {
  I1: number;  // momento de inercia principal mín
  I2: number;  // intermedio
  I3: number;  // máx
}

interface RBState {
  // velocidades angulares en marco del cuerpo
  omega: THREE.Vector3;
  // cuaternión de orientación (body→world)
  q: THREE.Quaternion;
}

interface Preset {
  id: string;
  name: string;
  params: RBParams;
  initOmega: THREE.Vector3;  // pequeña perturbación incluida
  note: string;
}

const PRESETS: Preset[] = [
  {
    id: 'stable-min',
    name: 'Eje mínimo (I₁) — estable',
    params: { I1: 1.0, I2: 2.5, I3: 4.0 },
    initOmega: new THREE.Vector3(3.0, 0.05, 0.05),
    note: 'Rotación estable: Ω apunta al eje de mínimo I. Pequeñas perturbaciones se quedan pequeñas.',
  },
  {
    id: 'stable-max',
    name: 'Eje máximo (I₃) — estable',
    params: { I1: 1.0, I2: 2.5, I3: 4.0 },
    initOmega: new THREE.Vector3(0.05, 0.05, 3.0),
    note: 'Rotación estable: Ω apunta al eje de máximo I. Análogo al trompo.',
  },
  {
    id: 'unstable-mid',
    name: 'Eje intermedio (I₂) — volteo Dzhanibekov',
    params: { I1: 1.0, I2: 2.5, I3: 4.0 },
    initOmega: new THREE.Vector3(0.05, 3.0, 0.05),
    note: 'Inestabilidad del eje intermedio. El cuerpo se voltea periódicamente sin fuerzas externas.',
  },
  {
    id: 'extreme-asymm',
    name: 'Asimetría extrema — volteo rápido',
    params: { I1: 0.5, I2: 2.0, I3: 6.0 },
    initOmega: new THREE.Vector3(0.08, 3.0, 0.08),
    note: 'Mayor contraste entre I → volteo más frecuente. Modelo de asteroides irregulares.',
  },
];

// ── Integrador RK4 para cuerpo rígido ────────────────────────────────────────

// Derivada del estado: devuelve [dOmega, dq] dado omega y q
function rbDerivative(
  omega: THREE.Vector3,
  q: THREE.Quaternion,
  p: RBParams,
): [THREE.Vector3, THREE.Quaternion] {
  // Ecuaciones de Euler en marco del cuerpo
  const dO1 = ((p.I2 - p.I3) / p.I1) * omega.y * omega.z;
  const dO2 = ((p.I3 - p.I1) / p.I2) * omega.z * omega.x;
  const dO3 = ((p.I1 - p.I2) / p.I3) * omega.x * omega.y;
  const dOmega = new THREE.Vector3(dO1, dO2, dO3);

  // q̇ = ½ q ⊗ [0, ω]  (cuaternión puro de omega en body frame)
  // qPure = (0, Ω₁, Ω₂, Ω₃)
  const qw = q.w, qx = q.x, qy = q.y, qz = q.z;
  const ox = omega.x, oy = omega.y, oz = omega.z;
  const dqw = 0.5 * (-qx * ox - qy * oy - qz * oz);
  const dqx = 0.5 * ( qw * ox + qy * oz - qz * oy);
  const dqy = 0.5 * ( qw * oy + qz * ox - qx * oz);
  const dqz = 0.5 * ( qw * oz + qx * oy - qy * ox);
  const dq = new THREE.Quaternion(dqx, dqy, dqz, dqw);

  return [dOmega, dq];
}

function rbStep(state: RBState, p: RBParams, dt: number): RBState {
  const { omega, q } = state;

  // RK4
  const [k1o, k1q] = rbDerivative(omega, q, p);

  const o2 = new THREE.Vector3().addVectors(omega, k1o.clone().multiplyScalar(dt * 0.5));
  const q2 = new THREE.Quaternion(
    q.x + k1q.x * dt * 0.5,
    q.y + k1q.y * dt * 0.5,
    q.z + k1q.z * dt * 0.5,
    q.w + k1q.w * dt * 0.5,
  ).normalize();
  const [k2o, k2q] = rbDerivative(o2, q2, p);

  const o3 = new THREE.Vector3().addVectors(omega, k2o.clone().multiplyScalar(dt * 0.5));
  const q3 = new THREE.Quaternion(
    q.x + k2q.x * dt * 0.5,
    q.y + k2q.y * dt * 0.5,
    q.z + k2q.z * dt * 0.5,
    q.w + k2q.w * dt * 0.5,
  ).normalize();
  const [k3o, k3q] = rbDerivative(o3, q3, p);

  const o4 = new THREE.Vector3().addVectors(omega, k3o.clone().multiplyScalar(dt));
  const q4 = new THREE.Quaternion(
    q.x + k3q.x * dt,
    q.y + k3q.y * dt,
    q.z + k3q.z * dt,
    q.w + k3q.w * dt,
  ).normalize();
  const [k4o, k4q] = rbDerivative(o4, q4, p);

  const newOmega = new THREE.Vector3(
    omega.x + (dt / 6) * (k1o.x + 2*k2o.x + 2*k3o.x + k4o.x),
    omega.y + (dt / 6) * (k1o.y + 2*k2o.y + 2*k3o.y + k4o.y),
    omega.z + (dt / 6) * (k1o.z + 2*k2o.z + 2*k3o.z + k4o.z),
  );

  const newQ = new THREE.Quaternion(
    q.x + (dt / 6) * (k1q.x + 2*k2q.x + 2*k3q.x + k4q.x),
    q.y + (dt / 6) * (k1q.y + 2*k2q.y + 2*k3q.y + k4q.y),
    q.z + (dt / 6) * (k1q.z + 2*k2q.z + 2*k3q.z + k4q.z),
    q.w + (dt / 6) * (k1q.w + 2*k2q.w + 2*k3q.w + k4q.w),
  ).normalize();

  return { omega: newOmega, q: newQ };
}

function rbKineticEnergy(omega: THREE.Vector3, p: RBParams): number {
  return 0.5 * (p.I1 * omega.x ** 2 + p.I2 * omega.y ** 2 + p.I3 * omega.z ** 2);
}

function rbAngularMomentumSq(omega: THREE.Vector3, p: RBParams): number {
  const Lx = p.I1 * omega.x;
  const Ly = p.I2 * omega.y;
  const Lz = p.I3 * omega.z;
  return Lx * Lx + Ly * Ly + Lz * Lz;
}

// ── Utilidades de formato ─────────────────────────────────────────────────────

function fmt(x: number, d = 3): string { return isFinite(x) ? x.toFixed(d) : 'NaN'; }
function fmtSci(x: number, d = 2): string { return isFinite(x) ? x.toExponential(d) : 'NaN'; }

// ── Componente principal ──────────────────────────────────────────────────────

export default function RigidBody() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState('unstable-mid');
  const preset = PRESETS.find(p => p.id === presetId)!;

  const [params, setParams] = useState<RBParams>(preset.params);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [, forceRender] = useState(0);

  // Estado de simulación en refs (sin re-render por frame)
  const stateRef = useRef<RBState>({
    omega: preset.initOmega.clone(),
    q: new THREE.Quaternion(),
  });
  const E0 = useRef<number>(0);
  const L0sq = useRef<number>(0);

  const reset = (useCurrentParams = false) => {
    const p = useCurrentParams ? params : preset.params;
    if (!useCurrentParams) setParams(preset.params);
    stateRef.current = {
      omega: preset.initOmega.clone(),
      q: new THREE.Quaternion(),
    };
    E0.current = rbKineticEnergy(preset.initOmega, p);
    L0sq.current = rbAngularMomentumSq(preset.initOmega, p);
  };

  useEffect(() => {
    reset(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  // Loop de simulación (fuera del Canvas, como DoublePendulum)
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let lastUi = 0;
    const DT_BASE = 1 / 600;
    const tick = () => {
      const dt = DT_BASE * speed;
      const N = 8;
      for (let i = 0; i < N; i++) {
        stateRef.current = rbStep(stateRef.current, params, dt);
      }
      const now = performance.now();
      if (now - lastUi > 80) {
        forceRender(x => x + 1);
        lastUi = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, params, speed]);

  const omega = stateRef.current.omega;
  const T = rbKineticEnergy(omega, params);
  const Lsq = rbAngularMomentumSq(omega, params);
  const dT = E0.current > 0 ? Math.abs((T - E0.current) / E0.current) : 0;
  const dL = L0sq.current > 0 ? Math.abs((Lsq - L0sq.current) / L0sq.current) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={5} autoRotate bloomIntensity={1.0} bloomThreshold={0.1}>
          <RBScene stateRef={stateRef} params={params} />
        </Stage>

        {/* HUD — telemetría */}
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">Ω₁&nbsp;&nbsp;</span>= <span className="text-[#4FC3F7]">{fmt(omega.x, 3)}</span></div>
          <div><span className="text-[#64748B]">Ω₂&nbsp;&nbsp;</span>= <span className="text-[#FDB813]">{fmt(omega.y, 3)}</span></div>
          <div><span className="text-[#64748B]">Ω₃&nbsp;&nbsp;</span>= <span className="text-[#F472B6]">{fmt(omega.z, 3)}</span></div>
          <div className="pt-0.5 border-t border-[#1E293B]">
            <span className="text-[#64748B]">T&nbsp;&nbsp;&nbsp;</span>= {fmt(T, 4)} J
          </div>
          <div><span className="text-[#64748B]">ΔT/T&nbsp;</span>= <span className={dT > 1e-4 ? 'text-[#F87171]' : ''}>{fmtSci(dT)}</span></div>
          <div><span className="text-[#64748B]">ΔL/L&nbsp;</span>= <span className={dL > 1e-4 ? 'text-[#F87171]' : ''}>{fmtSci(dL)}</span></div>
        </div>

        {/* Controles de playback */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={() => reset(true)}  title="Reiniciar, misma parametría">↺</IconBtn>
          <IconBtn onClick={() => reset(false)} title="Preset default">⟲</IconBtn>
        </div>
      </div>

      <LessonPanel<RBLessonState>
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
                    data-testid={`preset-${p.id}`}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                      presetId === p.id
                        ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                        : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                    }`}
                  >{p.name}</button>
                ))}
              </div>
              <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{preset.note}</div>
            </Section>

            {audience !== 'child' && (
              <Section title="Estado">
                <Row label="Ω₁" value={`${fmt(omega.x, 4)} rad/s`} />
                <Row label="Ω₂" value={`${fmt(omega.y, 4)} rad/s`} />
                <Row label="Ω₃" value={`${fmt(omega.z, 4)} rad/s`} />
                <Row label="T"  value={`${fmt(T, 5)} J`} />
                <Row label="ΔT/T" value={fmtSci(dT, 3)} highlight={dT > 1e-4} />
                <Row label="ΔL²/L²" value={fmtSci(dL, 3)} highlight={dL > 1e-4} />
              </Section>
            )}

            {audience === 'child' && (
              <Section title="Lo que ves">
                <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
                  <p>La raqueta gira en el espacio, sin que nadie la toque.</p>
                  <p>Si gira por el <span className="text-[#FDB813]">eje del medio</span>, ¡se voltea sola! Es el efecto Dzhanibekov.</p>
                </div>
              </Section>
            )}

            <Section title="Momentos de inercia">
              <Slider label="I₁ (mín)" v={params.I1} min={0.1} max={3.0} step={0.05} on={v => setParams(p => ({ ...p, I1: v }))} />
              <Slider label="I₂ (med)" v={params.I2} min={0.1} max={5.0} step={0.05} on={v => setParams(p => ({ ...p, I2: v }))} />
              <Slider label="I₃ (máx)" v={params.I3} min={0.1} max={8.0} step={0.05} on={v => setParams(p => ({ ...p, I3: v }))} />
              <div className="mt-1 text-[10px] text-[#64748B]">
                Condición inestabilidad: I₁ &lt; I₂ &lt; I₃
              </div>
            </Section>

            <Section title="Velocidad inicial Ω">
              <Slider label="|Ω|" v={speed} min={0.1} max={4.0} step={0.05} on={v => setSpeed(v)} />
              <div className="text-[10px] text-[#64748B] mt-1">Factor de escala de tiempo de simulación.</div>
            </Section>

            <Section title="Ecuaciones de Euler">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-[#4FC3F7]">I₁Ω̇₁ = (I₂−I₃) Ω₂Ω₃</div>
                <div className="text-[#FDB813]">I₂Ω̇₂ = (I₃−I₁) Ω₃Ω₁</div>
                <div className="text-[#F472B6]">I₃Ω̇₃ = (I₁−I₂) Ω₁Ω₂</div>
                <div className="mt-2 text-[10px] text-[#64748B]">Integrador: RK4, 8 sub-pasos/frame.</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

// ── Escena 3D ─────────────────────────────────────────────────────────────────

function RBScene({
  stateRef,
  params,
}: {
  stateRef: React.MutableRefObject<RBState>;
  params: RBParams;
}) {
  return (
    <>
      <ambientLight intensity={0.1} />
      <pointLight position={[4, 6, 4]} intensity={1.2} color="#FDB813" distance={30} />
      <pointLight position={[-4, -3, 3]} intensity={0.6} color="#4FC3F7" distance={20} />
      <Racket stateRef={stateRef} params={params} />
      <OmegaArrow stateRef={stateRef} params={params} />
      <AxisIndicators params={params} />
    </>
  );
}

// Cuerpo principal: una "raqueta de tenis" formada por un mango (cilindro)
// y una cabeza (toro aplanado). Refleja los tres momentos de inercia distintos.
const Racket = forwardRef<THREE.Group, {
  stateRef: React.MutableRefObject<RBState>;
  params: RBParams;
}>(function Racket({ stateRef, params }, _ref) {
  const groupRef = useRef<THREE.Group>(null);

  // Geometría de la raqueta: eje 1 = eje largo (mango), eje 3 = eje gordo (normal al plano)
  // Materiales emisivos
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1E3A5F',
    emissive: '#1E3A5F',
    emissiveIntensity: 0.4,
    metalness: 0.6,
    roughness: 0.35,
    toneMapped: false,
  }), []);

  const headMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#FDB813',
    emissive: '#FDB813',
    emissiveIntensity: 0.9,
    metalness: 0.3,
    roughness: 0.4,
    toneMapped: false,
  }), []);

  const handleMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#4FC3F7',
    emissive: '#4FC3F7',
    emissiveIntensity: 0.6,
    metalness: 0.4,
    roughness: 0.4,
    toneMapped: false,
  }), []);

  // Trail del eje 1 (eje largo en world frame)
  const TRAIL = 600;
  const trailGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const trailIdx = useRef(0);
  const trailCnt = useRef(0);

  const _tmpAxis = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!groupRef.current) return;

    // Aplicar orientación desde cuaternión de la simulación
    groupRef.current.setRotationFromQuaternion(stateRef.current.q);

    // Trail: posición del extremo del eje-1 en world space
    _tmpAxis.set(1.6, 0, 0).applyQuaternion(stateRef.current.q);
    const pArr = trailGeo.attributes.position as THREE.BufferAttribute;
    const cArr = trailGeo.attributes.color as THREE.BufferAttribute;
    const idx = trailIdx.current;
    (pArr.array as Float32Array)[idx * 3 + 0] = _tmpAxis.x;
    (pArr.array as Float32Array)[idx * 3 + 1] = _tmpAxis.y;
    (pArr.array as Float32Array)[idx * 3 + 2] = _tmpAxis.z;
    (cArr.array as Float32Array)[idx * 3 + 0] = 0.31;
    (cArr.array as Float32Array)[idx * 3 + 1] = 0.76;
    (cArr.array as Float32Array)[idx * 3 + 2] = 0.97;
    trailIdx.current = (idx + 1) % TRAIL;
    trailCnt.current = Math.min(trailCnt.current + 1, TRAIL);
    pArr.needsUpdate = true;
    cArr.needsUpdate = true;
    trailGeo.setDrawRange(0, trailCnt.current);

    // Actualizar escala visual de la cabeza del toro según params (muestra asimetría I)
    // I3 es el eje perpendicular al plano de la cabeza → más gordo = radio de tubo mayor
    // I1 es el eje largo → escala la longitud del mango
  });

  // Dimensiones físicamente motivadas por los momentos de inercia
  // Raqueta orientada con eje largo en X (I₁-axis), plano de la cabeza en XY (I₃-axis = Z)
  const scaleX = Math.sqrt(params.I1 / 1.0);  // I₁ ~ longitud²
  const scaleY = Math.sqrt(params.I2 / 2.5);  // I₂ ~ ancho²
  const scaleZ = Math.sqrt(params.I3 / 4.0);  // I₃ ~ espesor (cuerda)

  return (
    <>
      {/* Trail de la cabeza de la raqueta */}
      <points geometry={trailGeo}>
        <pointsMaterial
          vertexColors
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Cuerpo de la raqueta */}
      <group ref={groupRef}>
        {/* Mango — cilindro en eje X (eje de I₁) */}
        <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.85 * scaleX, 0, 0]} material={handleMat}>
          <cylinderGeometry args={[0.07, 0.07, 1.0 * scaleX, 16]} />
        </mesh>

        {/* Cuello de transición */}
        <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.25 * scaleX, 0, 0]} material={bodyMat}>
          <cylinderGeometry args={[0.09, 0.12, 0.3 * scaleX, 16]} />
        </mesh>

        {/* Cabeza — toro en el plano XY (I₃ perpendicular) */}
        <mesh position={[0.5 * scaleX, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={headMat}>
          <torusGeometry args={[0.55 * scaleY, 0.06 * scaleZ, 20, 64]} />
        </mesh>

        {/* Cuerda de la raqueta — cuadrícula interna */}
        <RacketStrings scaleX={scaleX} scaleY={scaleY} />

        {/* Indicadores de ejes del cuerpo */}
        <BodyAxisPin axis="x" color="#4FC3F7" length={1.8 * scaleX} />
        <BodyAxisPin axis="y" color="#FDB813" length={0.9 * scaleY} />
        <BodyAxisPin axis="z" color="#F472B6" length={0.5 * scaleZ} />
      </group>
    </>
  );
});

// Cuerdas de la raqueta — líneas en el plano XY offset en X
function RacketStrings({ scaleX, scaleY }: { scaleX: number; scaleY: number }) {
  const geo = useMemo(() => {
    const pts: number[] = [];
    const cx = 0.5 * scaleX;
    const r = 0.5 * scaleY;
    const n = 5;
    // horizontales
    for (let i = -n; i <= n; i++) {
      const y = (i / n) * r * 0.85;
      const hw = Math.sqrt(Math.max(0, r * r - y * y)) * 0.95;
      pts.push(cx - hw, y, 0, cx + hw, y, 0);
    }
    // verticales (en el plano, eje Y del body es "ancho")
    for (let i = -n; i <= n; i++) {
      const x = cx + (i / n) * r * 0.85;
      const hy = Math.sqrt(Math.max(0, r * r - (x - cx) * (x - cx))) * 0.95;
      pts.push(x, -hy, 0, x, hy, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    return g;
  }, [scaleX, scaleY]);

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#FDB813" transparent opacity={0.25} />
    </lineSegments>
  );
}

// Pequeño pin que muestra el eje del cuerpo (I₁=X, I₂=Y, I₃=Z) con esfera emisiva
function BodyAxisPin({ axis, color, length }: { axis: 'x' | 'y' | 'z'; color: string; length: number }) {
  const dir = axis === 'x' ? [1,0,0] : axis === 'y' ? [0,1,0] : [0,0,1];
  const pos = dir.map(d => d * length * 0.5) as [number, number, number];
  const rot: [number, number, number] = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'y' ? [0, 0, 0] : [Math.PI / 2, 0, 0];

  return (
    <group>
      <mesh position={pos} rotation={rot}>
        <cylinderGeometry args={[0.015, 0.015, length, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <mesh position={dir.map(d => d * length) as [number, number, number]}>
        <sphereGeometry args={[0.06, 16, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Flecha del vector momento angular (L) en world frame — siempre constante
function OmegaArrow({ stateRef, params }: {
  stateRef: React.MutableRefObject<RBState>;
  params: RBParams;
}) {
  const shaftRef = useRef<THREE.Mesh>(null);
  const headRef  = useRef<THREE.Mesh>(null);
  const _L = useMemo(() => new THREE.Vector3(), []);
  const _q = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const { omega } = stateRef.current;
    // L = I · Ω en marco world (Ω ya está en marco body, L en body también)
    // Luego rotamos L al frame world con la misma q del body
    const Lx = params.I1 * omega.x;
    const Ly = params.I2 * omega.y;
    const Lz = params.I3 * omega.z;
    _L.set(Lx, Ly, Lz);
    const Llen = _L.length();
    if (Llen < 1e-6) return;
    // Rotar L al frame world
    _L.applyQuaternion(stateRef.current.q);

    const scale = 2.0 / Llen;
    const dir = _L.clone().normalize();

    // Orientar el cilindro (shaft) y el cono (head) a lo largo de dir
    // Cilindro: eje +Y por default
    const yAxis = new THREE.Vector3(0, 1, 0);
    _q.setFromUnitVectors(yAxis, dir);

    if (shaftRef.current) {
      shaftRef.current.position.copy(dir.clone().multiplyScalar(Llen * scale * 0.5));
      shaftRef.current.setRotationFromQuaternion(_q);
      shaftRef.current.scale.set(1, Llen * scale, 1);
    }
    if (headRef.current) {
      headRef.current.position.copy(dir.clone().multiplyScalar(Llen * scale + 0.25));
      headRef.current.setRotationFromQuaternion(_q);
    }
  });

  return (
    <group>
      {/* Shaft */}
      <mesh ref={shaftRef}>
        <cylinderGeometry args={[0.03, 0.03, 1, 12]} />
        <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      {/* Head */}
      <mesh ref={headRef} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.09, 0.3, 16]} />
        <meshStandardMaterial color="#34D399" emissive="#34D399" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      {/* Label aproximado via Html eliminado (usamos HUD DOM) */}
    </group>
  );
}

// Indicadores fijos de los ejes principales del mundo (para referencia)
function AxisIndicators({ params }: { params: RBParams }) {
  const r = 3.0;
  const axes: Array<{ axis: [number,number,number]; color: string; label: string }> = [
    { axis: [r,0,0], color: '#4FC3F7', label: 'I₁' },
    { axis: [0,r,0], color: '#FDB813', label: 'I₂' },
    { axis: [0,0,r], color: '#F472B6', label: 'I₃' },
  ];
  void params; // params usados para dimensionar la raqueta arriba

  return (
    <group>
      {axes.map(({ axis, color }) => (
        <group key={color}>
          <mesh
            position={[axis[0]/2, axis[1]/2, axis[2]/2]}
            quaternion={new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0,1,0),
              new THREE.Vector3(...axis).normalize()
            )}
          >
            <cylinderGeometry args={[0.008, 0.008, r, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.4} toneMapped={false} />
          </mesh>
          <mesh position={axis as [number,number,number]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} transparent opacity={0.6} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── UI helpers (mismos patrones que DoublePendulum) ───────────────────────────

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
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full mt-1" />
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
