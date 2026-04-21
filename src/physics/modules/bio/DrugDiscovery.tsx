/**
 * ══════════════════════════════════════════════════════════════════════
 *  DrugDiscovery — Búsqueda computacional de terapia regenerativa
 * ══════════════════════════════════════════════════════════════════════
 *
 * Usa el modelo Gray-Scott en régimen HUMANO (F=0.09, k=0.057) como
 * "paciente" con una herida. Cada droga de la biblioteca modula (F, k)
 * localmente y en el tiempo según su farmacocinética. El usuario diseña
 * un schedule (qué drogas, cuándo, dosis) y ve:
 *
 *   · Evolución del tejido en tiempo real.
 *   · Heal score (¿cuánto de la herida recuperó el patrón?).
 *   · Safety score (presión tumoral acumulada).
 *   · Trayectoria en el espacio de fases (F, k).
 *
 * Botón "Auto-search": random search sobre K schedules, reporta el mejor.
 * Barato y suficiente para demostrar el ciclo: *el descubrimiento no
 * requiere conocer la respuesta a priori, requiere un score y un
 * simulador de alta-fidelidad del sistema biológico*.
 *
 * Este módulo cierra el bucle: átomos (nivel 0) → moléculas (1) →
 * tejido RD (2) → farmacología (3) → descubrimiento computacional.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { stencilStepCpu, type StencilCpuOptions } from '@/lib/gpu/stencil';
import {
  DRUG_LIBRARY,
  currentModulation,
  healScore,
  safetyScore,
  overallScore,
  type Drug,
  type Schedule,
} from '@/lib/discovery/pharmacology';
import { useAudience } from '@/physics/context';

// ═══════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════

const RES = 80;
const L_DOMAIN = 1;
const D_U = 2e-5;
const D_V = 1e-5;
const F_HUMAN = 0.090;
const K_HUMAN = 0.057;
const WOUND_RADIUS = 0.18;    // normalizado
const DT = 1.0;

// ═══════════════════════════════════════════════════════════════
// Estado y helpers de simulación
// ═══════════════════════════════════════════════════════════════

interface SimState {
  /** Estado RD: (u, v, 0, 0) por celda. */
  field: Float32Array;
  next: Float32Array;
  /** Tiempo de simulación (hr ficticias). */
  t: number;
  /** Schedule activo. */
  schedule: Schedule;
  /** Máscara de herida (1 donde había herida). */
  woundMask: Uint8Array;
  /** Presión tumoral acumulada. */
  tumorCumul: number;
  /** Exposición farmacológica acumulada. */
  exposureCumul: number;
  /** Texture para renderizar. */
  tex: THREE.DataTexture | null;
  /** Historial de scores (para la curva). */
  healHistory: number[];
  safetyHistory: number[];
  fHistory: number[];
  kHistory: number[];
}

function makeField(): { field: Float32Array; next: Float32Array } {
  return {
    field: new Float32Array(RES * RES * 4),
    next: new Float32Array(RES * RES * 4),
  };
}

/** Seed: tejido humano sano (patrón casi uniforme u≈1, v≈0, con pequeña textura). */
function seedHealthy(field: Float32Array): void {
  for (let i = 0; i < RES * RES; i++) {
    field[i * 4 + 0] = 1;
    field[i * 4 + 1] = 0;
  }
}

/** Seed: tejido con patrón regenerativo pre-existente (varios spots). */
function seedPatterned(field: Float32Array): void {
  for (let i = 0; i < RES * RES; i++) {
    field[i * 4 + 0] = 1;
    field[i * 4 + 1] = 0;
  }
  const spots = 5;
  const r = 3;
  for (let sx = 0; sx < spots; sx++) {
    for (let sy = 0; sy < spots; sy++) {
      const cx = ((sx + 0.5) / spots) * RES;
      const cy = ((sy + 0.5) / spots) * RES;
      for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
          if (i * i + j * j > r * r) continue;
          const ii = Math.floor(cx + i), jj = Math.floor(cy + j);
          if (ii < 0 || ii >= RES || jj < 0 || jj >= RES) continue;
          const idx = (jj * RES + ii) * 4;
          field[idx + 0] = 0.5;
          field[idx + 1] = 0.25;
        }
      }
    }
  }
}

/** Aplica herida circular central. Registra máscara. */
function applyWound(field: Float32Array, mask: Uint8Array): void {
  const cx = RES / 2, cy = RES / 2;
  const r = RES * WOUND_RADIUS;
  const r2 = r * r;
  mask.fill(0);
  for (let j = 0; j < RES; j++) {
    for (let i = 0; i < RES; i++) {
      const dx = i - cx, dy = j - cy;
      if (dx * dx + dy * dy <= r2) {
        const idx = (j * RES + i);
        field[idx * 4 + 0] = 1;
        field[idx * 4 + 1] = 0;
        mask[idx] = 1;
      }
    }
  }
}

/**
 * Un step de Gray-Scott con modulación por schedule.
 * Se evalúa `currentModulation` en cada celda — barato porque las
 * administraciones son pocas (<10) y la grid es 80×80.
 */
function stepSim(sim: SimState): void {
  let tumorInThisStep = 0;
  let expoInThisStep = 0;

  const opts: StencilCpuOptions = {
    RES, L: L_DOMAIN,
    boundary: 'periodic',
    diffusivity: [D_U, D_V, 0, 0],
    dt: DT,
    reaction: (out, u, x, y) => {
      const mod = currentModulation(sim.schedule, sim.t, x, y);
      const F = F_HUMAN + mod.dF;
      const k = K_HUMAN + mod.dK;
      const uvv = u[0] * u[1] * u[1];
      out[0] = -uvv + F * (1 - u[0]);
      out[1] =  uvv - (F + k) * u[1];
      tumorInThisStep += mod.tumorPressure;
      expoInThisStep  += mod.totalExposure;
    },
  };
  stencilStepCpu(sim.field, sim.next, opts);
  const tmp = sim.field; sim.field = sim.next; sim.next = tmp;

  sim.t += DT;
  // Promediamos por celda para que la escala no dependa de RES
  sim.tumorCumul   += tumorInThisStep   / (RES * RES);
  sim.exposureCumul += expoInThisStep   / (RES * RES);

  // Score rolling en el centro del campo (F, k) — para graficar trayectoria
  const modCenter = currentModulation(sim.schedule, sim.t, 0, 0);
  sim.fHistory.push(F_HUMAN + modCenter.dF);
  sim.kHistory.push(K_HUMAN + modCenter.dK);
  if (sim.fHistory.length > 400) { sim.fHistory.shift(); sim.kHistory.shift(); }

  const h = healScore(sim.field, RES, sim.woundMask);
  const s = safetyScore(sim.tumorCumul, sim.t);
  sim.healHistory.push(h);
  sim.safetyHistory.push(s);
  if (sim.healHistory.length > 400) { sim.healHistory.shift(); sim.safetyHistory.shift(); }
}

// ═══════════════════════════════════════════════════════════════
// Random-search auto discovery
// ═══════════════════════════════════════════════════════════════

/**
 * Genera N schedules aleatorios, simula cada uno hasta t=T, devuelve el
 * que maximiza overallScore. Cada schedule tiene 1–3 administraciones.
 */
function autoDiscover(
  nTrials: number, tHorizon: number, library: Drug[] = DRUG_LIBRARY,
  onProgress?: (i: number, best: { score: number; schedule: Schedule } | null) => void,
): { schedule: Schedule; score: number; heal: number; safety: number } {
  let bestSched: Schedule = { administrations: [] };
  let bestScore = -Infinity;
  let bestHeal = 0, bestSafety = 0;
  const pool = library.filter(d => d.id !== 'placebo' && d.id !== 'noggin');

  for (let trial = 0; trial < nTrials; trial++) {
    const nDrugs = 1 + Math.floor(Math.random() * 3);   // 1-3
    const adms: Schedule['administrations'] = [];
    for (let i = 0; i < nDrugs; i++) {
      const drug = pool[Math.floor(Math.random() * pool.length)];
      adms.push({
        drugId: drug.id,
        t0: Math.random() * tHorizon * 0.3,
        dose: 0.5 + Math.random() * 1.5,
        xc: 0, yc: 0, radius: 0.25,
      });
    }
    const schedule: Schedule = { administrations: adms };

    // Simulación aislada
    const { field, next } = makeField();
    seedPatterned(field);
    const mask = new Uint8Array(RES * RES);
    applyWound(field, mask);
    const sim: SimState = {
      field, next, t: 0, schedule, woundMask: mask,
      tumorCumul: 0, exposureCumul: 0, tex: null,
      healHistory: [], safetyHistory: [], fHistory: [], kHistory: [],
    };
    const nSteps = Math.floor(tHorizon / DT);
    for (let k = 0; k < nSteps; k++) stepSim(sim);

    const h = healScore(sim.field, RES, sim.woundMask);
    const s = safetyScore(sim.tumorCumul, sim.t);
    const score = overallScore(h, s);
    if (score > bestScore) {
      bestScore = score; bestSched = schedule;
      bestHeal = h; bestSafety = s;
    }
    if (onProgress) onProgress(trial, { score: bestScore, schedule: bestSched });
  }
  return { schedule: bestSched, score: bestScore, heal: bestHeal, safety: bestSafety };
}

// ═══════════════════════════════════════════════════════════════
// Shaders del plano
// ═══════════════════════════════════════════════════════════════

const PLANE_VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const PLANE_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tex;
  uniform sampler2D maskTex;
  void main() {
    vec4 s = texture2D(tex, vUv);
    float m = texture2D(maskTex, vUv).x;
    float u = s.x;
    float v = s.y;
    vec3 baseDead    = vec3(0.04, 0.06, 0.10);
    vec3 baseHealthy = vec3(0.22, 0.42, 0.54);
    vec3 pattern     = vec3(0.40, 0.80, 0.96);
    float vis = clamp(v / 0.30, 0.0, 1.0);
    vec3 col = mix(baseDead, baseHealthy, 1.0 - u);
    col = mix(col, pattern, vis);
    // Marca sutil de la herida inicial
    if (m > 0.5) col = mix(col, vec3(0.60, 0.20, 0.20), 0.08 * (1.0 - vis));
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════════
// Views
// ═══════════════════════════════════════════════════════════════

function TissuePlane({
  simRef, planeSize,
}: { simRef: React.MutableRefObject<SimState>; planeSize: number }) {
  const { geometry, uniforms, tex, maskTex } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(planeSize, planeSize);
    const data = new Float32Array(RES * RES * 4);
    const t = new THREE.DataTexture(data, RES, RES, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    const mask = new Uint8Array(RES * RES * 4);
    const mt = new THREE.DataTexture(mask, RES, RES, THREE.RGBAFormat, THREE.UnsignedByteType);
    mt.needsUpdate = true;
    return {
      geometry: geom,
      uniforms: { tex: { value: t }, maskTex: { value: mt } },
      tex: t, maskTex: mt,
    };
  }, [planeSize]);

  useEffect(() => {
    simRef.current.tex = tex;
    return () => { simRef.current.tex = null; tex.dispose(); maskTex.dispose(); };
  }, [tex, maskTex, simRef]);

  useFrame(() => {
    const sim = simRef.current;
    if (!sim.tex) return;
    const data = sim.tex.image.data as Float32Array;
    data.set(sim.field);
    sim.tex.needsUpdate = true;
    // Actualizar mask texture (costoso solo al inicio / reset)
    const md = maskTex.image.data as Uint8ClampedArray;
    for (let i = 0; i < RES * RES; i++) md[i * 4] = sim.woundMask[i] * 255;
    maskTex.needsUpdate = true;
  });

  return (
    <mesh geometry={geometry} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <shaderMaterial uniforms={uniforms}
        vertexShader={PLANE_VS} fragmentShader={PLANE_FS} />
    </mesh>
  );
}

function SimLoop({ simRef, playing, stepsPerFrame }: {
  simRef: React.MutableRefObject<SimState>; playing: boolean; stepsPerFrame: number;
}) {
  useFrame(() => {
    if (!playing) return;
    for (let k = 0; k < stepsPerFrame; k++) stepSim(simRef.current);
  });
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Módulo
// ═══════════════════════════════════════════════════════════════

function fmt(x: number, d = 2) { return isFinite(x) ? x.toFixed(d) : '—'; }

export default function DrugDiscovery() {
  const { audience } = useAudience();
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(6);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<null | { score: number; heal: number; safety: number; schedule: Schedule }>(null);

  const simRef = useRef<SimState>({
    field: new Float32Array(RES * RES * 4),
    next:  new Float32Array(RES * RES * 4),
    t: 0,
    schedule: { administrations: [] },
    woundMask: new Uint8Array(RES * RES),
    tumorCumul: 0, exposureCumul: 0, tex: null,
    healHistory: [], safetyHistory: [], fHistory: [], kHistory: [],
  });

  // Init: tejido con patrón + herida
  const resetTissue = () => {
    seedPatterned(simRef.current.field);
    applyWound(simRef.current.field, simRef.current.woundMask);
    simRef.current.t = 0;
    simRef.current.tumorCumul = 0;
    simRef.current.exposureCumul = 0;
    simRef.current.healHistory = [];
    simRef.current.safetyHistory = [];
    simRef.current.fHistory = [];
    simRef.current.kHistory = [];
    setScheduleVersion(v => v + 1);
  };
  useEffect(() => { resetTissue(); /* eslint-disable-next-line */ }, []);

  // UI re-render periódico
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 150);
    return () => clearInterval(t);
  }, []);

  // Aplicar una droga al tiempo actual
  const applyDrug = (drug: Drug, dose = 1) => {
    simRef.current.schedule.administrations.push({
      drugId: drug.id, t0: simRef.current.t, dose,
      xc: 0, yc: 0, radius: 0.25,
    });
    setScheduleVersion(v => v + 1);
  };

  const clearSchedule = () => {
    simRef.current.schedule.administrations = [];
    setScheduleVersion(v => v + 1);
  };

  // Auto-search: 24 trials × 200 steps = ~1 s cómputo total
  const runAutoSearch = async () => {
    setSearching(true);
    // yield al DOM una vez (defer)
    await new Promise(r => setTimeout(r, 20));
    const result = autoDiscover(24, 200);
    // Aplicar el schedule ganador
    simRef.current.schedule = result.schedule;
    // Reset y re-run para que el usuario lo vea ejecutarse
    seedPatterned(simRef.current.field);
    applyWound(simRef.current.field, simRef.current.woundMask);
    simRef.current.t = 0;
    simRef.current.tumorCumul = 0;
    simRef.current.exposureCumul = 0;
    simRef.current.healHistory = [];
    simRef.current.safetyHistory = [];
    setSearchResult(result);
    setScheduleVersion(v => v + 1);
    setSearching(false);
  };

  const sim = simRef.current;
  const healNow = sim.healHistory[sim.healHistory.length - 1] ?? 0;
  const safetyNow = sim.safetyHistory[sim.safetyHistory.length - 1] ?? 1;
  const overall = overallScore(healNow, safetyNow);

  const planeSize = 4;
  const span = planeSize * 1.5;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full min-h-0 overflow-hidden">
      <div className="relative min-h-0"
        style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}>
        <Canvas
          camera={{ position: [0, planeSize * 0.9, planeSize * 1.0], fov: 44, near: 0.01, far: 10000 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          style={{ background: 'transparent', width: '100%', height: '100%' }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 5]} intensity={0.4} color="#CBD5E1" />
          <OrbitControls enableDamping dampingFactor={0.08}
            minDistance={planeSize * 0.3} maxDistance={span * 3}
            maxPolarAngle={Math.PI * 0.48} />
          <SimLoop simRef={simRef} playing={playing} stepsPerFrame={speed} />
          <TissuePlane simRef={simRef} planeSize={planeSize} />
          <EffectComposer multisampling={4}>
            <Bloom intensity={0.4} luminanceThreshold={0.4} luminanceSmoothing={0.5}
              mipmapBlur kernelSize={KernelSize.LARGE} />
            <Vignette offset={0.3} darkness={0.55} blendFunction={BlendFunction.NORMAL} />
          </EffectComposer>
        </Canvas>

        {/* Scorecard */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 flex gap-4 px-5 py-3 rounded-xl bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] font-mono text-[12px]">
          <ScoreBadge label="Heal"    value={healNow}    color="#4FC3F7" />
          <ScoreBadge label="Safety"  value={safetyNow}  color="#10B981" />
          <ScoreBadge label="Overall" value={overall}    color="#FBBF24" bold />
          <div className="text-[10px] text-[#64748B] self-center ml-2">
            t = {fmt(sim.t, 0)} hr · n_drugs = {sim.schedule.administrations.length}
          </div>
        </div>

        {/* Schedule applied (pills) */}
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-2 max-w-[80%]">
          {sim.schedule.administrations.map((adm, i) => {
            const drug = DRUG_LIBRARY.find(d => d.id === adm.drugId)!;
            return (
              <div key={i} className="px-2 py-1 rounded-md text-[10px] font-mono flex items-center gap-1"
                style={{ background: `${drug.accent}22`, border: `1px solid ${drug.accent}55`, color: drug.accent }}>
                <span className="font-semibold">{drug.name.split(' ')[0]}</span>
                <span className="text-[#94A3B8]">@{fmt(adm.t0, 0)}h · ×{fmt(adm.dose, 2)}</span>
              </div>
            );
          })}
          {sim.schedule.administrations.length === 0 && (
            <div className="text-[10px] text-[#64748B] italic">Sin medicación. Aplica una droga de la derecha.</div>
          )}
        </div>

        {/* Controles */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 bg-[#0B0F17]/95 backdrop-blur border border-[#1E293B] rounded-xl px-3 py-2.5 shadow-2xl flex-wrap justify-center max-w-[calc(100vw-16px)] sm:max-w-none">
          <button onClick={() => setPlaying(p => !p)}
            className={`flex items-center gap-2 px-4 h-11 rounded-lg border text-[13px] font-semibold transition ${
              playing
                ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10'
                : 'border-[#10B981]/60 text-[#10B981] bg-[#10B981]/10'
            }`}>
            <span className="text-[15px]">{playing ? '❚❚' : '▶'}</span>
            <span>{playing ? 'Pausa' : 'Play'}</span>
          </button>
          <button onClick={resetTissue}
            className="flex items-center gap-2 px-4 h-11 rounded-lg border border-[#334155] text-[#CBD5E1] hover:border-[#4FC3F7] text-[13px] font-medium transition">
            <span className="text-[15px]">↺</span>
            <span>Nuevo paciente</span>
          </button>
          <button onClick={clearSchedule}
            className="flex items-center gap-2 px-4 h-11 rounded-lg border border-[#475569] text-[#94A3B8] hover:text-white text-[13px] transition">
            <span>Limpiar schedule</span>
          </button>
          <button onClick={runAutoSearch} disabled={searching}
            className={`flex items-center gap-2 px-4 h-11 rounded-lg border text-[13px] font-bold tracking-wide transition ${
              searching
                ? 'border-[#6B7280] text-[#6B7280] bg-[#0B0F17]'
                : 'border-[#FBBF24] text-[#FBBF24] hover:bg-[#FBBF24]/10'
            }`}>
            <span className="text-[15px]">{searching ? '…' : '⚡'}</span>
            <span>{searching ? 'Buscando…' : 'Auto-search'}</span>
          </button>
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Biblioteca">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed mb-3">
            Haz click en una droga para aplicarla al tiempo actual de la simulación.
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {DRUG_LIBRARY.map(d => (
              <button key={d.id} onClick={() => applyDrug(d, 1)}
                className="text-left px-3 py-2 rounded-md border text-[11px] transition hover:bg-white/5"
                style={{ borderColor: `${d.accent}66`, color: d.accent }}>
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{d.name}</span>
                  <span className="text-[9px] text-[#64748B] font-mono">
                    ΔF={fmt(d.deltaF, 3)}
                  </span>
                </div>
                <div className="text-[#94A3B8] text-[10px] mt-0.5 leading-snug line-clamp-2">{d.blurb}</div>
                <div className="flex gap-2 text-[9px] text-[#64748B] mt-1 font-mono">
                  <span>{d.family}</span>
                  <span>·</span>
                  <span>{d.delivery}</span>
                  <span>·</span>
                  <span>risk ×{fmt(d.tumorRisk, 1)}</span>
                </div>
              </button>
            ))}
          </div>
        </Section>

        {audience === 'child' ? (
          <Section title="Cómo jugar">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>Tienes un paciente humano con una herida (círculo rojo al centro).</p>
              <p>Prueba aplicar drogas de la biblioteca. Cada una modifica el "ambiente" del tejido a su manera.</p>
              <p>El objetivo: <span className="text-[#FBBF24] font-semibold">Overall</span> alto — tejido sanado SIN quedarse en régimen peligroso.</p>
              <p>¿Puedes superar a la computadora? Pulsa <span className="text-[#FBBF24]">Auto-search</span> y ve qué encuentra.</p>
            </div>
          </Section>
        ) : (
          <Section title="Paciente virtual">
            <Row label="Régimen base"     value={`F=${F_HUMAN}, k=${K_HUMAN}`} />
            <Row label="N celdas RD"      value={(RES*RES).toLocaleString('en-US')} />
            <Row label="Herida"           value={`r ≈ ${fmt(WOUND_RADIUS*100, 0)}% dominio`} />
            <Row label="Exposición acum." value={fmt(sim.exposureCumul, 2)} />
            <Row label="Tumor cumul."     value={fmt(sim.tumorCumul, 2)} />
          </Section>
        )}

        {searchResult && (
          <Section title="Último auto-search">
            <Row label="Score"  value={fmt(searchResult.score, 3)} />
            <Row label="Heal"   value={fmt(searchResult.heal, 3)} />
            <Row label="Safety" value={fmt(searchResult.safety, 3)} />
            <div className="mt-2 text-[10px] text-[#94A3B8] leading-relaxed">
              {searchResult.schedule.administrations.length} drogas. Ganador aplicado al paciente.
              Los mejores schedules suelen combinar un factor de crecimiento local + un
              rejuvenecedor pulsátil.
            </div>
          </Section>
        )}

        {audience === 'researcher' && (
          <Section title="Integrador">
            <Slider label="steps/frame" v={speed} min={1} max={20} step={1} on={v => setSpeed(Math.round(v))} />
            <div className="mt-2 text-[10px] text-[#64748B]">
              Gray-Scott FTCS, D_u={D_U}, D_v={D_V}. PK Bateman 1-compartimento.
            </div>
          </Section>
        )}

        <Section title="Método">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
            <p>Cada droga modula (F, k) del reactor RD del tejido. Perfil temporal:</p>
            <div className="font-mono text-[10px] text-[#CBD5E1]">
              c(t) = (k_a·D) / (k_a−k_e) · (e<sup>−k_e·t</sup> − e<sup>−k_a·t</sup>)
            </div>
            <p>k_a = 1/onset, k_e = ln(2)/halfLife. Efecto sobre regulador ∝ c(t) · selectividad(x).</p>
            <p className="mt-2">Auto-search: random sampling 24 schedules × 200 pasos ≈ 1 s.</p>
          </div>
        </Section>

        <Section title="Pipeline real">
          <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
            <p>En medicina de descubrimiento real los (ΔF, Δk) <span className="text-white">vendrían</span> de:</p>
            <p className="ml-2">· Docking proteína-target (bio/docking.ts)</p>
            <p className="ml-2">· MD del complejo (chem/quantum/gpu-md)</p>
            <p className="ml-2">· Calibración contra assay in vitro</p>
            <p className="mt-2">El resto del pipeline (esta vista) ya es exactamente esto. Un paso upstream pendiente para cerrarlo end-to-end.</p>
          </div>
        </Section>
      </aside>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UI helpers
// ═══════════════════════════════════════════════════════════════

function ScoreBadge({ label, value, color, bold }: { label: string; value: number; color: string; bold?: boolean }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="flex flex-col items-center min-w-[70px]">
      <div className="text-[9px] uppercase tracking-widest" style={{ color: '#64748B' }}>{label}</div>
      <div className={`${bold ? 'text-[18px] font-bold' : 'text-[15px] font-semibold'}`} style={{ color }}>
        {value.toFixed(2)}
      </div>
      <div className="w-full h-1 mt-1 bg-[#1E293B] rounded">
        <div className="h-full rounded" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
    </div>
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
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
function Slider({ label, v, min, max, step, on }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px] font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span className="text-white">{v}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => on(Number(e.target.value))} className="w-full" />
    </div>
  );
}
