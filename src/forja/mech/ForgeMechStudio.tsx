/**
 * ⚒️ La Forja — SINTETIZADOR DE MECANISMOS · Cuatro-Barras (Fase 0-2)
 * =============================================================================
 * El diseñador NO programa: elige un preset, mueve el SLIDER DE ÁNGULO DE ENTRADA
 * (θ2) y ve el cuatro-barras MOVERSE en 3D, con la CURVA DEL ACOPLADOR trazada.
 *
 * Reusa el viewport CAD LIMPIO (metal PBR, HDRI de estudio, ACES, sin bloom) del
 * Part Studio. El mecanismo se dibuja como 4 barras (cápsulas metálicas) + pines
 * en las 4 juntas. La curva del acoplador es una séxtica trazada en vivo.
 *
 * La MATEMÁTICA vive en ./fourbar.ts (operador FORWARD por Freudenstein, puro).
 * Aquí solo se ORQUESTA por UI. data-testid: input-theta, btn-animar,
 * fourbar-canvas, hud-theta4, preset-*, branch-toggle.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { ACESFilmicToneMapping } from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, ContactShadows, Line, GizmoHelper, GizmoViewcube } from '@react-three/drei';
import {
  fourBarPose,
  fourBarSweep,
  grashof,
  synthesizeFreudenstein,
  freudensteinSynthesisError,
  FOURBAR_PRESETS,
  type FourBarParams,
  type FourBarBranch,
  type FourBarPose,
  type PrecisionPoint,
  type FreudensteinSynthesis,
} from './fourbar';
import { solveLinearSystem } from '../../lib/formulas';

const GOLD = '#FDB813';
const STEEL = '#9fb3c8';
const CAD_BG = '#10151c';

// PBR de acero satinado para las barras (igual receta que el Part Studio).
const BAR_PBR = { color: '#aeb8c6', metalness: 0.96, roughness: 0.30 };
const CRANK_PBR = { color: '#caa23a', metalness: 0.92, roughness: 0.36 };   // manivela = latón (resalta la entrada)

// ──────────────────────────────────────────────────────────────────
// Viewport CAD limpio (copia de la receta de ForgeBRepStudio.CadViewport).
// ──────────────────────────────────────────────────────────────────
function CadViewport({
  cameraDistance, autoRotate, children,
}: {
  cameraDistance: number; autoRotate: boolean; children: ReactNode;
}) {
  return (
    <div
      className="relative w-full h-full"
      style={{ background: `radial-gradient(ellipse at 50% 42%, #18202a 0%, ${CAD_BG} 70%, #0b0f14 100%)` }}
    >
      <Canvas
        shadows
        camera={{
          position: [cameraDistance * 0.18, cameraDistance * 0.42, cameraDistance * 0.95],
          fov: 35, near: 0.01, far: 20000,
        }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.90;
        }}
      >
        <Environment files="/hdri/studio_small_03_1k.hdr" background={false} environmentIntensity={1.0} />
        <ambientLight intensity={0.2} />
        <directionalLight
          position={[cameraDistance, cameraDistance * 1.4, cameraDistance * 0.8]}
          intensity={0.6} color="#ffffff" castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0004}
        />
        <directionalLight position={[-cameraDistance, cameraDistance * 0.3, -cameraDistance * 0.6]} intensity={0.22} color="#cfe0f0" />
        <directionalLight position={[0, -cameraDistance * 0.6, cameraDistance]} intensity={0.15} color="#ffffff" />
        <OrbitControls
          makeDefault enablePan enableDamping dampingFactor={0.08}
          autoRotate={autoRotate} autoRotateSpeed={0.4}
          minDistance={cameraDistance * 0.2} maxDistance={cameraDistance * 5}
        />

        {/* VIEWCUBE — orienta el plano del mecanismo (como TODO CAD). El Canvas vive
            en la celda 1fr del grid (a la izquierda del panel de 360px), así que
            top-right cae dentro del viewport. UN solo GizmoHelper: dos se pisan. */}
        <GizmoHelper alignment="top-right" margin={[72, 80]}>
          <GizmoViewcube
            color="#aab4c2" textColor="#10151c" strokeColor="#5a6675" hoverColor={GOLD}
            faces={['DER', 'IZQ', 'ARRIBA', 'ABAJO', 'FRENTE', 'ATRAS']}
          />
        </GizmoHelper>

        {children}
        <CadGround size={Math.max(40, cameraDistance * 1.2)} />
      </Canvas>
    </div>
  );
}

function CadGround({ size }: { size: number }) {
  return (
    <group position={[0, -0.02, 0]}>
      <Grid
        args={[size, size]} cellSize={size / 60} cellThickness={0.6} cellColor="#28333f"
        sectionSize={size / 12} sectionThickness={1.0} sectionColor="#3a4a5a"
        fadeDistance={size * 1.1} fadeStrength={2.2} infiniteGrid followCamera={false}
      />
      <ContactShadows position={[0, 0.005, 0]} scale={size * 0.85} far={size * 0.55} blur={2.4} opacity={0.6} color="#04060a" resolution={1024} />
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────
// Una BARRA = cápsula metálica entre dos puntos 2D (plano XY del mecanismo,
// que el group rota a horizontal). z = altura de apilado para que las 4 barras
// no se traslapen (cada eslabón en su propio plano paralelo, estilo modelo real).
// ──────────────────────────────────────────────────────────────────
function Bar({ a, b, z, radius, pbr }: {
  a: [number, number]; b: [number, number]; z: number; radius: number;
  pbr: { color: string; metalness: number; roughness: number };
}) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const angle = Math.atan2(dy, dx);
  if (len < 1e-6) return null;
  return (
    <group position={[mx, my, z]} rotation={[0, 0, angle]}>
      {/* cuerpo: cilindro a lo largo de +X (rotado desde +Y default de three) */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, len, 24]} />
        <meshStandardMaterial color={pbr.color} metalness={pbr.metalness} roughness={pbr.roughness} />
      </mesh>
      {/* tapas redondeadas (esferas en los pivotes) */}
      <mesh position={[-len / 2, 0, 0]} castShadow>
        <sphereGeometry args={[radius * 1.05, 20, 20]} />
        <meshStandardMaterial color={pbr.color} metalness={pbr.metalness} roughness={pbr.roughness} />
      </mesh>
      <mesh position={[len / 2, 0, 0]} castShadow>
        <sphereGeometry args={[radius * 1.05, 20, 20]} />
        <meshStandardMaterial color={pbr.color} metalness={pbr.metalness} roughness={pbr.roughness} />
      </mesh>
    </group>
  );
}

// Un PIN (eje de la junta) — cilindro vertical (Z) que atraviesa los planos.
function Pin({ at, radius, height, color = '#1a2029' }: {
  at: [number, number]; radius: number; height: number; color?: string;
}) {
  return (
    <mesh position={[at[0], at[1], 0]} castShadow>
      <cylinderGeometry args={[radius, radius, height, 20]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.5} />
    </mesh>
  );
}

// Pivote de TIERRA (base fija): un soporte triangular bajo el pin.
function GroundPivot({ at, scale }: { at: [number, number]; scale: number }) {
  return (
    <group position={[at[0], at[1], -scale * 0.9]}>
      <mesh castShadow>
        <coneGeometry args={[scale * 0.7, scale * 1.3, 4]} />
        <meshStandardMaterial color="#3a4654" metalness={0.5} roughness={0.6} />
      </mesh>
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────
// El MECANISMO completo en 3D, dado un pose y los parámetros.
// El group padre rota XY→horizontal. Cada barra en su z-plano.
// ──────────────────────────────────────────────────────────────────
function FourBarMesh({ pose, params, scale, couplerCurve }: {
  pose: FourBarPose; params: FourBarParams; scale: number;
  couplerCurve: [number, number][];
}) {
  const pinR = scale * 0.5;
  const barR = scale * 0.42;
  const pinH = scale * 6;

  // Curva del acoplador como polilínea cerrada (drei <Line>). z = plano del
  // acoplador, un poco arriba.
  const curvePts = useMemo<[number, number, number][]>(() => {
    if (couplerCurve.length < 2) return [];
    const z = scale * 2.2;
    const pts = couplerCurve.map((p) => [p[0], p[1], z] as [number, number, number]);
    pts.push([couplerCurve[0][0], couplerCurve[0][1], z]); // cerrar
    return pts;
  }, [couplerCurve, scale]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* ── Eslabón de TIERRA a1 (O2→O4): fijo, plano z=0 ── */}
      <Bar a={pose.O2} b={pose.O4} z={0} radius={barR * 0.85} pbr={{ color: '#5a6675', metalness: 0.6, roughness: 0.5 }} />
      <GroundPivot at={pose.O2} scale={scale} />
      <GroundPivot at={pose.O4} scale={scale} />

      {/* ── Manivela a2 (O2→A): entrada, latón, plano z=+1 ── */}
      <Bar a={pose.O2} b={pose.A} z={scale * 1.0} radius={barR} pbr={CRANK_PBR} />

      {/* ── Acoplador a3 (A→B): plano z=+2 ── */}
      <Bar a={pose.A} b={pose.B} z={scale * 2.0} radius={barR} pbr={BAR_PBR} />

      {/* ── Balancín a4 (O4→B): salida, plano z=+1 ── */}
      <Bar a={pose.O4} b={pose.B} z={scale * 1.0} radius={barR} pbr={BAR_PBR} />

      {/* ── Punto acoplador P (efector): brazo del acoplador A→P en z=+2 ── */}
      <Bar a={pose.A} b={pose.P} z={scale * 2.0} radius={barR * 0.7} pbr={{ color: '#caa23a', metalness: 0.9, roughness: 0.35 }} />

      {/* ── PINES en las 4 juntas (atraviesan los planos en Z) ── */}
      <Pin at={pose.O2} radius={pinR} height={pinH} />
      <Pin at={pose.O4} radius={pinR} height={pinH} />
      <Pin at={pose.A} radius={pinR} height={pinH * 0.7} />
      <Pin at={pose.B} radius={pinR} height={pinH * 0.7} />

      {/* ── marcador del efector P (esfera dorada brillante) ── */}
      <mesh position={[pose.P[0], pose.P[1], scale * 2.2]} castShadow>
        <sphereGeometry args={[pinR * 1.3, 24, 24]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.35} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* ── CURVA DEL ACOPLADOR (séxtica) trazada en dorado ── */}
      {curvePts.length > 2 && (
        <Line points={curvePts} color={GOLD} lineWidth={2.2} transparent opacity={0.92} />
      )}
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────
// Animador: avanza θ2 en useFrame cuando `playing`. Escribe el θ2 vivo en un
// ref que el padre lee para el HUD (sin re-render por frame del DOM pesado).
// ──────────────────────────────────────────────────────────────────
function Animator({ playing, speed, onTheta }: {
  playing: boolean; speed: number; onTheta: (t: number) => void;
}) {
  useFrame((_, dt) => {
    if (!playing) return;
    onTheta(Math.min(dt, 0.05) * speed);
  });
  return null;
}

// ──────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;

// Puntos de precisión por defecto (en GRADOS para la UI). Provienen de un
// crank-rocker real {a1=4,a2=1,a3=3.5,a4=3} muestreado en θ2 = 40°,90°,150°,
// con su θ4 de la rama abierta — así la síntesis recupera un four-bar válido
// y Grashof, y clava los 3 puntos a ~1e-15.
const DEFAULT_PP: { in: number; out: number }[] = [
  { in: 40, out: 236.099 },
  { in: 90, out: 222.197 },
  { in: 150, out: 219.341 },
];

export default function ForgeMechStudio() {
  const [presetKey, setPresetKey] = useState<keyof typeof FOURBAR_PRESETS>('crank-rocker');

  // Four-bar SINTETIZADO (si existe) toma prioridad sobre el preset en el viewport.
  const [synth, setSynth] = useState<FreudensteinSynthesis | null>(null);
  const [synthError, setSynthError] = useState<{ maxError: number; errors: number[] } | null>(null);

  // El four-bar ACTIVO: el sintetizado si está OK, si no el preset.
  const params: FourBarParams = synth?.ok && synth.params ? synth.params : FOURBAR_PRESETS[presetKey];

  // Puntos de precisión en la UI (grados, editables).
  const [pp, setPp] = useState(DEFAULT_PP);

  const [theta2, setTheta2] = useState(0);          // ángulo de entrada (rad)
  const [branch, setBranch] = useState<FourBarBranch>('open');
  const [playing, setPlaying] = useState(false);
  const speed = 1.1;                                // rad/s de animación

  // ── SÍNTESIS DE FREUDENSTEIN (vía botón) ──
  const doSynthesize = () => {
    const pts: PrecisionPoint[] = pp.map((q) => ({
      theta2: (q.in * Math.PI) / 180,
      theta4: (q.out * Math.PI) / 180,
    }));
    const s = synthesizeFreudenstein(pts, 4.0, solveLinearSystem);
    setSynth(s);
    if (s.ok && s.params) {
      // Verificación de exactitud: re-correr el forward en los 3 θ2_i.
      setSynthError(freudensteinSynthesisError(s.params, pts));
    } else {
      setSynthError(null);
    }
    setTheta2(0);
    setPlaying(false);
  };

  // Volver al preset (descartar la síntesis).
  const clearSynth = () => { setSynth(null); setSynthError(null); setTheta2(0); };

  // θ2 vivo en ref para que el animador escriba sin race con el slider.
  const thetaRef = useRef(theta2);
  thetaRef.current = theta2;

  // Escala visual: las longitudes del preset son ~1-4 → escalamos a ~unidades
  // grandes para que el viewport CAD (cm) las muestre con peso.
  const VISUAL = 4.0;
  const scaledParams = useMemo<FourBarParams>(() => ({
    ground: params.ground * VISUAL,
    crank: params.crank * VISUAL,
    coupler: params.coupler * VISUAL,
    rocker: params.rocker * VISUAL,
    groundPos: [(params.groundPos?.[0] ?? 0) * VISUAL, (params.groundPos?.[1] ?? 0) * VISUAL],
    groundAngle: params.groundAngle ?? 0,
    couplerRp: params.couplerRp,
    couplerSp: params.couplerSp,
  }), [params]);

  // Pose actual (FORWARD) + barrido (curva del acoplador). El barrido solo
  // depende de geometría/rama, no de θ2 → memo separado.
  const pose = useMemo(() => fourBarPose(scaledParams, theta2, branch), [scaledParams, theta2, branch]);
  const sweep = useMemo(() => fourBarSweep(scaledParams, 240, branch), [scaledParams, branch]);
  const grash = useMemo(() => grashof(params), [params]);

  const scale = VISUAL * 0.13;
  // Encuadre robusto: usa la barra más larga (la síntesis puede dar acopladores
  // grandes). Magnitudes (las longitudes pueden venir signadas).
  const maxLink = Math.max(
    Math.abs(scaledParams.ground), Math.abs(scaledParams.crank),
    Math.abs(scaledParams.coupler), Math.abs(scaledParams.rocker),
  );
  const cameraDist = maxLink * 2.4 + 20;

  // Animación: el Animator llama onTheta con Δθ; lo acumulamos en estado.
  const advance = (d: number) => {
    setTheta2((t) => {
      let nt = (t + d) % TAU;
      if (nt < 0) nt += TAU;
      return nt;
    });
  };

  // viewport testid en el <canvas>
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const cv = viewportRef.current?.querySelector('canvas');
    if (cv) cv.setAttribute('data-testid', 'fourbar-canvas');
  }, []);

  // Exponer el pose vivo para verificación independiente por Playwright (lee
  // posiciones de junta y recomputa el cierre de lazo desde ellas, sin confiar
  // en los ángulos reportados). NO es la fuente de la UI — es un espejo de test.
  useEffect(() => {
    (window as unknown as { __fourbar?: unknown }).__fourbar = {
      pose, params: scaledParams, maxLoopResidual: sweep.maxLoopResidual,
      synth: synth ? {
        ok: synth.ok, K: [synth.K1, synth.K2, synth.K3],
        lengths: { ground: synth.ground, crank: synth.crank, coupler: synth.coupler, rocker: synth.rocker },
        reason: synth.reason ?? null,
      } : null,
      synthError: synthError ? { maxError: synthError.maxError, errors: synthError.errors } : null,
      grashof: { klass: grash.klass, grashof: grash.grashof, crankRotatesFully: grash.crankRotatesFully },
      muMinDeg: (sweep.muMin * 180) / Math.PI, muMaxDeg: (sweep.muMax * 180) / Math.PI,
      branchValid: sweep.fullCircleAssembles, assembledFraction: sweep.assembledFraction,
    };
  }, [pose, scaledParams, sweep.maxLoopResidual, synth, synthError, grash, sweep.muMin, sweep.muMax, sweep.fullCircleAssembles, sweep.assembledFraction]);

  const deg = (r: number) => ((r * 180) / Math.PI);
  const wrapDeg = (r: number) => { let d = deg(r) % 360; if (d < 0) d += 360; return d; };

  // Gate de transmisión: μ(θ) ∈ [40°,140°] ∀θ. fourBarPose pliega μ a ≤90°, así
  // que el criterio efectivo es μ_min ≥ 40°. Solo significativo si ensambla todo.
  const muMinDeg = deg(sweep.muMin);
  const transmissionOK = sweep.fullCircleAssembles && muMinDeg >= 40 && muMinDeg <= 140;
  // Gate de rama: cos φ(θ) ∈ [−1,1] ∀θ ⇔ ensambla el ciclo completo.
  const ramaOK = sweep.fullCircleAssembles;

  // Editar un punto de precisión (descarta la síntesis previa hasta re-sintetizar).
  const updatePP = (i: number, field: 'in' | 'out', raw: string) => {
    const v = parseFloat(raw);
    setPp((prev) => prev.map((q, j) => (j === i ? { ...q, [field]: Number.isFinite(v) ? v : 0 } : q)));
  };

  return (
    <div className="mech-root">
      <style>{CSS}</style>

      {/* ── VIEWPORT ── */}
      <div className="mech-viewport" data-testid="viewport" ref={viewportRef}>
        <CadViewport cameraDistance={cameraDist} autoRotate={false}>
          <Animator playing={playing} speed={speed} onTheta={advance} />
          <FourBarMesh pose={pose} params={scaledParams} scale={scale} couplerCurve={sweep.couplerCurve} />
        </CadViewport>

        {/* HUD invariantes (esquina) */}
        <div className="mech-hud" data-testid="hud">
          <div className="mech-hud-row">
            <span className="k">θ₂ entrada</span>
            <span className="v" data-testid="hud-theta2">{wrapDeg(theta2).toFixed(1)}°</span>
          </div>
          <div className="mech-hud-row">
            <span className="k">θ₄ salida</span>
            <span className="v gold" data-testid="hud-theta4">
              {pose.assembled ? `${wrapDeg(pose.theta4).toFixed(1)}°` : '—'}
            </span>
          </div>
          <div className="mech-hud-row">
            <span className="k">μ transmisión</span>
            <span className="v" data-testid="hud-mu">
              {pose.assembled ? `${deg(pose.mu).toFixed(1)}°` : '—'}
            </span>
          </div>
          <div className="mech-hud-row">
            <span className="k">cierre de lazo</span>
            <span className="v mono" data-testid="hud-loop">
              {pose.assembled ? pose.loopResidual.toExponential(1) : 'no ensambla'}
            </span>
          </div>
          <div className="mech-hud-row">
            <span className="k">cierre máx (ciclo)</span>
            <span className="v mono" data-testid="hud-loop-max">
              {sweep.maxLoopResidual.toExponential(1)}
            </span>
          </div>
        </div>
      </div>

      {/* ── PANEL DE CONTROL ── */}
      <aside className="mech-panel">
        <header className="mech-head">
          <h1>⚒ Sintetizador de Mecanismos</h1>
          <p>Cuatro-barras · operador <em>forward</em> (Freudenstein)</p>
        </header>

        <section className="mech-sec">
          <h2>Preset</h2>
          <div className="mech-presets">
            {(Object.keys(FOURBAR_PRESETS) as (keyof typeof FOURBAR_PRESETS)[]).map((k) => (
              <button
                key={k}
                data-testid={`preset-${k}`}
                className={presetKey === k && !synth?.ok ? 'on' : ''}
                onClick={() => { setPresetKey(k); clearSynth(); }}
              >
                {k}
              </button>
            ))}
          </div>
        </section>

        <section className="mech-sec">
          <h2>Ángulo de entrada θ₂</h2>
          <input
            type="range" min={0} max={360} step={0.5}
            data-testid="input-theta"
            value={wrapDeg(theta2).toFixed(1)}
            onChange={(e) => { setPlaying(false); setTheta2((parseFloat(e.target.value) * Math.PI) / 180); }}
          />
          <div className="mech-theta-val" data-testid="theta-val">{wrapDeg(theta2).toFixed(1)}°</div>
          <div className="mech-btns">
            <button data-testid="btn-animar" className={playing ? 'on' : ''} onClick={() => setPlaying((p) => !p)}>
              {playing ? '⏸ Pausar' : '▶ Animar'}
            </button>
            <button
              data-testid="branch-toggle"
              onClick={() => setBranch((b) => (b === 'open' ? 'crossed' : 'open'))}
            >
              Rama: {branch === 'open' ? 'abierta' : 'cruzada'}
            </button>
          </div>
        </section>

        <section className="mech-sec">
          <h2>Eslabones (geometría) {synth?.ok && <em className="synth-tag">sintetizado</em>}</h2>
          <ul className="mech-links">
            <li><span>a₁ tierra</span><b>{Math.abs(params.ground).toFixed(3)}</b></li>
            <li className="crank"><span>a₂ manivela</span><b>{Math.abs(params.crank).toFixed(3)}{params.crank < 0 ? ' ⟲' : ''}</b></li>
            <li><span>a₃ acoplador</span><b>{Math.abs(params.coupler).toFixed(3)}</b></li>
            <li><span>a₄ balancín</span><b>{Math.abs(params.rocker).toFixed(3)}{params.rocker < 0 ? ' ⟲' : ''}</b></li>
          </ul>
        </section>

        {/* ─────────── GATE DE VALIDEZ (Fase 1) ─────────── */}
        <section className="mech-sec">
          <h2>Gate de validez cinemática</h2>
          <div className="mech-gate">
            {/* GRASHOF — s+l ≤ p+q + clasificación */}
            <div className="g-row big">
              <div className="g-label">
                <span>Grashof <small>s+l ≤ p+q</small></span>
                <div className="g-sub">
                  {grash.sPlusL.toFixed(2)} {grash.grashof ? '≤' : '>'} {grash.pPlusQ.toFixed(2)} ·{' '}
                  <strong data-testid="gate-class">{grash.klass}</strong>
                  {grash.crankRotatesFully && <span className="motor-tag"> · 1 motor</span>}
                </div>
              </div>
              <b className={grash.grashof ? 'pill good' : 'pill bad'} data-testid="gate-grashof">
                {grash.grashof ? '● Grashof' : '○ no-Grashof'}
              </b>
            </div>

            {/* TRANSMISIÓN — 40° ≤ μ(θ) ≤ 140° ∀θ */}
            <div className="g-row big">
              <div className="g-label">
                <span>Áng. transmisión <small>40°–140° ∀θ</small></span>
                <div className="g-sub">
                  μ ∈ [{deg(sweep.muMin).toFixed(1)}°, {deg(sweep.muMax).toFixed(1)}°]
                </div>
              </div>
              <b
                className={transmissionOK ? 'pill good' : 'pill bad'}
                data-testid="gate-transmision"
              >
                {transmissionOK ? '● OK' : '○ se traba'}
              </b>
            </div>

            {/* RAMA — cos φ(θ) ∈ [−1,1] ∀θ (ensambla todo el ciclo) */}
            <div className="g-row big">
              <div className="g-label">
                <span>Rama válida <small>cos φ ∈ [−1,1] ∀θ</small></span>
                <div className="g-sub">
                  ensambla {(sweep.assembledFraction * 100).toFixed(0)}% del ciclo
                </div>
              </div>
              <b
                className={ramaOK ? 'pill good' : 'pill bad'}
                data-testid="gate-rama"
              >
                {ramaOK ? '● válida' : '○ se desarma'}
              </b>
            </div>
          </div>
        </section>

        {/* ─────────── SÍNTESIS DE FREUDENSTEIN (Fase 2) ─────────── */}
        <section className="mech-sec">
          <h2>Síntesis exacta · Freudenstein</h2>
          <p className="mech-note">
            3 puntos de precisión θ₂→θ₄ (grados). El sistema 3×3 en (K₁,K₂,K₃) se
            resuelve y se recuperan las longitudes. <strong>Exacto</strong>: el four-bar clava los 3 puntos.
          </p>
          <div className="pp-grid">
            <div className="pp-head"><span></span><span>θ₂ in</span><span>θ₄ out</span></div>
            {pp.map((q, i) => (
              <div className="pp-row" key={i}>
                <span className="pp-tag">P{i + 1}</span>
                <input
                  type="number" step="0.1"
                  data-testid={`input-p${i + 1}-in`}
                  value={q.in}
                  onChange={(e) => updatePP(i, 'in', e.target.value)}
                />
                <input
                  type="number" step="0.1"
                  data-testid={`input-p${i + 1}-out`}
                  value={q.out}
                  onChange={(e) => updatePP(i, 'out', e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="mech-btns" style={{ marginTop: 10 }}>
            <button data-testid="btn-sintetizar" className="synth-btn" onClick={doSynthesize}>
              ⚙ Sintetizar
            </button>
            {synth && (
              <button data-testid="btn-clear-synth" onClick={clearSynth}>
                ↺ Preset
              </button>
            )}
          </div>

          {/* Resultado de la síntesis */}
          {synth && (
            <div className="synth-result" data-testid="synth-result">
              {synth.ok ? (
                <>
                  <div className="sr-row">
                    <span>K₁, K₂, K₃</span>
                    <b className="mono">
                      {synth.K1.toFixed(3)}, {synth.K2.toFixed(3)}, {synth.K3.toFixed(3)}
                    </b>
                  </div>
                  <div className="sr-row">
                    <span>Longitudes a₁,a₂,a₃,a₄</span>
                    <b className="mono" data-testid="synth-lengths">
                      {Math.abs(synth.ground).toFixed(3)}, {Math.abs(synth.crank).toFixed(3)},{' '}
                      {Math.abs(synth.coupler).toFixed(3)}, {Math.abs(synth.rocker).toFixed(3)}
                    </b>
                  </div>
                  {synthError && (
                    <div className="sr-row">
                      <span>Error vs 3 objetivos</span>
                      <b
                        className={synthError.maxError < 1e-9 ? 'mono good' : 'mono bad'}
                        data-testid="synth-error"
                      >
                        {synthError.maxError.toExponential(2)} {synthError.maxError < 1e-9 ? '✓ EXACTO' : '✗'}
                      </b>
                    </div>
                  )}
                </>
              ) : (
                <div className="sr-fail" data-testid="synth-fail">
                  ✗ {synth.reason}
                </div>
              )}
            </div>
          )}
        </section>

        <footer className="mech-foot">
          INVARIANTE: cierre de lazo &lt; 1e-9 ∀θ — clavado a {sweep.maxLoopResidual.toExponential(1)}
        </footer>
      </aside>
    </div>
  );
}

const CSS = `
.mech-root{position:fixed;inset:0;display:grid;grid-template-columns:1fr 360px;font-family:Inter,system-ui,sans-serif;color:#e6ecf3;background:${CAD_BG};}
.mech-viewport{position:relative;overflow:hidden;}
.mech-hud{position:absolute;top:16px;left:16px;background:rgba(8,12,18,0.72);backdrop-filter:blur(8px);border:1px solid rgba(159,179,200,0.16);border-radius:12px;padding:12px 14px;min-width:210px;font-size:12px;}
.mech-hud-row{display:flex;justify-content:space-between;gap:14px;padding:3px 0;}
.mech-hud-row .k{color:${STEEL};opacity:.8;}
.mech-hud-row .v{font-weight:600;}
.mech-hud-row .v.gold{color:${GOLD};}
.mech-hud-row .v.mono{font-family:'JetBrains Mono',monospace;font-size:11px;}
.mech-panel{background:rgba(10,14,20,0.96);border-left:1px solid rgba(159,179,200,0.14);overflow-y:auto;padding:0 0 24px;}
.mech-head{padding:18px 18px 10px;border-bottom:1px solid rgba(159,179,200,0.1);}
.mech-head h1{font-size:16px;margin:0 0 4px;letter-spacing:.2px;}
.mech-head p{font-size:12px;color:${STEEL};margin:0;opacity:.8;}
.mech-head em{color:${GOLD};font-style:normal;}
.mech-sec{padding:14px 18px;border-bottom:1px solid rgba(159,179,200,0.08);}
.mech-sec h2{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${STEEL};margin:0 0 10px;opacity:.75;}
.mech-presets{display:flex;flex-wrap:wrap;gap:6px;}
.mech-presets button,.mech-btns button,.mech-gate{font-family:inherit;}
.mech-presets button{border:1px solid rgba(159,179,200,0.18);background:rgba(255,255,255,0.04);color:#e6ecf3;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;}
.mech-presets button.on{border-color:${GOLD};background:${GOLD}1a;color:${GOLD};}
.mech-sec input[type=range]{width:100%;accent-color:${GOLD};}
.mech-theta-val{text-align:center;font-size:22px;font-weight:700;color:${GOLD};margin:6px 0 10px;font-variant-numeric:tabular-nums;}
.mech-btns{display:flex;gap:8px;}
.mech-btns button{flex:1;border:1px solid rgba(159,179,200,0.18);background:rgba(255,255,255,0.04);color:#e6ecf3;border-radius:8px;padding:8px;font-size:12px;cursor:pointer;}
.mech-btns button.on{border-color:${GOLD};background:${GOLD}1a;color:${GOLD};}
.mech-btns button:hover{border-color:${GOLD}66;}
.mech-links{list-style:none;margin:0;padding:0;font-size:13px;}
.mech-links li{display:flex;justify-content:space-between;padding:4px 0;color:${STEEL};}
.mech-links li b{color:#e6ecf3;font-variant-numeric:tabular-nums;}
.mech-links li.crank b,.mech-links li.crank span{color:${GOLD};}
.mech-gate{font-size:12px;}
.mech-gate .g-row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;color:${STEEL};}
.mech-gate .g-row b{color:#e6ecf3;font-variant-numeric:tabular-nums;text-align:right;}
.mech-gate .g-row b.good{color:#5fd38a;}
.mech-gate .g-row b.bad{color:#ff6b6b;}
.mech-gate .g-row b.warn{color:#f3b13a;}
.mech-gate .g-row.big{align-items:center;padding:8px 0;border-bottom:1px solid rgba(159,179,200,0.06);}
.mech-gate .g-row.big:last-child{border-bottom:none;}
.mech-gate .g-label{display:flex;flex-direction:column;gap:2px;}
.mech-gate .g-label > span{color:#e6ecf3;font-weight:600;}
.mech-gate .g-label small{color:${STEEL};opacity:.7;font-weight:400;font-size:10px;margin-left:4px;}
.mech-gate .g-sub{font-size:11px;color:${STEEL};opacity:.85;font-variant-numeric:tabular-nums;}
.mech-gate .g-sub strong{color:#cdd8e4;}
.mech-gate .motor-tag{color:${GOLD};}
.mech-gate b.pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;white-space:nowrap;}
.mech-gate b.pill.good{background:rgba(95,211,138,0.16);color:#5fd38a;border:1px solid rgba(95,211,138,0.4);}
.mech-gate b.pill.bad{background:rgba(255,107,107,0.14);color:#ff6b6b;border:1px solid rgba(255,107,107,0.4);}
.synth-tag{color:${GOLD};font-style:normal;font-size:9px;border:1px solid ${GOLD}66;border-radius:6px;padding:1px 6px;margin-left:6px;letter-spacing:0;text-transform:none;}
.mech-note{font-size:11px;color:${STEEL};opacity:.8;line-height:1.45;margin:0 0 10px;}
.mech-note strong{color:${GOLD};}
.pp-grid{display:flex;flex-direction:column;gap:6px;}
.pp-head{display:grid;grid-template-columns:36px 1fr 1fr;gap:8px;font-size:10px;color:${STEEL};opacity:.7;text-transform:uppercase;letter-spacing:.5px;}
.pp-row{display:grid;grid-template-columns:36px 1fr 1fr;gap:8px;align-items:center;}
.pp-tag{font-size:12px;font-weight:700;color:${GOLD};}
.pp-row input{width:100%;border:1px solid rgba(159,179,200,0.2);background:rgba(255,255,255,0.04);color:#e6ecf3;border-radius:7px;padding:6px 8px;font-size:13px;font-variant-numeric:tabular-nums;font-family:'JetBrains Mono',monospace;}
.pp-row input:focus{outline:none;border-color:${GOLD}99;}
.synth-btn{background:${GOLD}22 !important;border-color:${GOLD}88 !important;color:${GOLD} !important;font-weight:700 !important;}
.synth-btn:hover{background:${GOLD}33 !important;}
.synth-result{margin-top:12px;border-top:1px dashed rgba(159,179,200,0.18);padding-top:10px;font-size:12px;}
.synth-result .sr-row{display:flex;justify-content:space-between;gap:10px;padding:3px 0;color:${STEEL};}
.synth-result .sr-row b{color:#e6ecf3;text-align:right;}
.synth-result .mono{font-family:'JetBrains Mono',monospace;font-size:11px;}
.synth-result .mono.good{color:#5fd38a;}
.synth-result .mono.bad{color:#ff6b6b;}
.synth-result .sr-fail{color:#ff6b6b;font-size:11px;line-height:1.4;}
.mech-foot{padding:14px 18px;font-size:11px;color:${STEEL};opacity:.7;font-family:'JetBrains Mono',monospace;}
`;
