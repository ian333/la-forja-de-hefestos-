/**
 * Masterclass Player — orquesta voz + escena + subtítulo + auto-advance.
 *
 * El alumno solo mira. Cada escena tiene un MP3 de Matilda (ElevenLabs) y
 * una visualización 3D asociada. Cuando el audio termina, pasa a la siguiente.
 *
 * El manifest viene de /audio/masterclass/<class-id>/manifest.json generado
 * por scripts/voice-gaia/generate.cjs.
 */

import { useEffect, useRef, useState } from 'react';
import { Suspense } from 'react';
import Void from './scenes/Void';
import ComplexPlane from './scenes/ComplexPlane';
import MobiusScene from './scenes/MobiusScene';
import NewtonScene from './scenes/NewtonScene';
import ConformalScene from './scenes/ConformalScene';
import ACMotorScene from './scenes/ACMotorScene';
import MarketGridScene from './scenes/MarketGridScene';
import QualityCollapseScene from './scenes/QualityCollapseScene';
import AsymmetricInfoScene from './scenes/AsymmetricInfoScene';
import NobelTimelineScene from './scenes/NobelTimelineScene';
import TransactionFlowScene from './scenes/TransactionFlowScene';
import MakeVsBuyScene from './scenes/MakeVsBuyScene';
import EconBoardScene from './scenes/EconBoardScene';
import EconChartScene from './scenes/EconChartScene';
import CommonsScene from './scenes/CommonsScene';
import MatchingScene from './scenes/MatchingScene';
import ExpectationsScene from './scenes/ExpectationsScene';
import VickreyScene from './scenes/VickreyScene';
import DerivativeScene from './scenes/DerivativeScene';
import IntegralScene from './scenes/IntegralScene';
import TaylorScene from './scenes/TaylorScene';
import SurfaceScene from './scenes/SurfaceScene';
import VectorFieldScene from './scenes/VectorFieldScene';
import MatrixCubeScene from './scenes/MatrixCubeScene';
import EigenvectorScene from './scenes/EigenvectorScene';
import GimbalScene from './scenes/GimbalScene';
import QuaternionScene from './scenes/QuaternionScene';
import PCAScene from './scenes/PCAScene';
import BHWell from './scenes/BHWell';
import BHLensing from './scenes/BHLensing';
import BHDisk from './scenes/BHDisk';
import BHScaleCompare from './scenes/BHScaleCompare';
import BHKerr from './scenes/BHKerr';
import BHTidal from './scenes/BHTidal';
import BHTimeDilation from './scenes/BHTimeDilation';
import BHPhotonSphere from './scenes/BHPhotonSphere';
import BHCollapse from './scenes/BHCollapse';
import BHHawking from './scenes/BHHawking';
import BHGargantua from './scenes/BHGargantua';
import BHMerger from './scenes/BHMerger';
import PhotoelectricScene from './scenes/PhotoelectricScene';
import PhotoelectricPlotScene from './scenes/PhotoelectricPlotScene';
import SensorMysteryScene from './scenes/SensorMysteryScene';
import WaveVsRealityScene from './scenes/WaveVsRealityScene';
import LenardApparatusScene from './scenes/LenardApparatusScene';
import ThresholdCliffScene from './scenes/ThresholdCliffScene';
import PhotonLedgerScene from './scenes/PhotonLedgerScene';
import MillikanDataScene from './scenes/MillikanDataScene';
import ComptonKickScene from './scenes/ComptonKickScene';
import CascadeQuanticaScene from './scenes/CascadeQuanticaScene';
import DufloScene from './scenes/DufloScene';
import { NarratorOverlay, NARRATOR_REGISTRY } from './narrator';
import Chalkboard from './Chalkboard';
import ModulePicker from './ModulePicker';
import { RenderClockContext, useRenderClockController } from './render-clock';

interface Scene {
  id: string;
  scene: string;
  audio: string;
  text: string;
  board?: string[];
  /** Estimación de duración (s) cuando no hay MP3 generado. */
  durationSec?: number;
}
interface Manifest {
  id: string;
  title: string;
  voice: string;
  scenes: Scene[];
}

function readClassId(): string {
  if (typeof window === 'undefined') return 'i';
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || 'i';
}

function readRenderMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('render') === '1';
}

function readDeterministicMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('deterministic') === '1';
}

const CLASS_ID = readClassId();
const RENDER_MODE = readRenderMode();
const DETERMINISTIC_MODE = RENDER_MODE && readDeterministicMode();
const AUDIO_BASE = `/audio/masterclass/${CLASS_ID}`;

// Maps manifest.id → picker class identifier (used for the end-screen module picker).
const PICKER_BY_MANIFEST: Record<string, string> = {
  'i-primera-clase': 'i',
  'calc-lo-infinitamente-pequeno': 'calc-lo-infinitamente-pequeno',
  'linalg-el-esqueleto-escondido': 'linalg-el-esqueleto-escondido',
  'econ-01-limones': 'econ-01-limones',
  'econ-02-coase': 'econ-02-coase',
  'econ-03-spence': 'econ-03-spence',
  'econ-04-hart-holmstrom': 'econ-04-hart-holmstrom',
  'econ-05-tirole': 'econ-05-tirole',
  'econ-06-nash': 'econ-06-nash',
  'econ-07-solow': 'econ-07-solow',
  'econ-08-kahneman': 'econ-08-kahneman',
  'econ-09-acemoglu': 'econ-09-acemoglu',
  'econ-10-friedman': 'econ-10-friedman',
  'econ-11-roth-shapley': 'econ-11-roth-shapley',
  'econ-12-sen': 'econ-12-sen',
  'econ-13-markowitz-sharpe': 'econ-13-markowitz-sharpe',
  'econ-14-thaler': 'econ-14-thaler',
  'econ-15-ostrom': 'econ-15-ostrom',
  'econ-16-lucas': 'econ-16-lucas',
  'econ-17-mirrlees-vickrey': 'econ-17-mirrlees-vickrey',
  'econ-18-duflo': 'econ-18-duflo',
  'blackhole': 'blackhole',
  'phys-einstein-pe': 'phys-einstein-pe',
};

export default function Player() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioMissing, setAudioMissing] = useState(false);
  const [endReached, setEndReached] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  // Render mode determinista: clock externo controlado por Playwright.
  // En modo normal este controlador no hace nada (enabled=false).
  const sceneDurations = (manifest?.scenes ?? []).map(
    s => s.durationSec ?? 12
  );
  const { state: clockState } = useRenderClockController({
    enabled: DETERMINISTIC_MODE,
    sceneDurations,
    onSceneChange: (newIdx) => {
      // En modo determinista, el clock determina idx, no el audio.
      // Clamp a [0, length-1] para evitar idx=-1 cuando sceneDurations=[]
      // antes de que manifest cargue (race condition).
      if (newIdx >= 0) setIdx(newIdx);
    },
  });

  // Load manifest once
  useEffect(() => {
    fetch(`${AUDIO_BASE}/manifest.json`)
      .then(r => r.json())
      .then(setManifest)
      .catch(e => console.error('manifest fail', e));
  }, []);

  // Render mode: auto-start as soon as manifest loads.
  useEffect(() => {
    if (RENDER_MODE && manifest && !started) {
      setStarted(true);
      setIdx(0);
    }
  }, [manifest, started]);

  // Render mode: expose progress to window for Playwright synchronization.
  useEffect(() => {
    if (!RENDER_MODE || typeof window === 'undefined') return;
    (window as any).__renderStatus = {
      manifestId: manifest?.id ?? null,
      total: manifest?.scenes.length ?? 0,
      idx,
      started,
      ended: endReached,
      audioDuration,
    };
  }, [manifest, idx, started, endReached, audioDuration]);

  // When idx changes, swap the audio source and play (if started)
  useEffect(() => {
    if (!manifest || !started || !audioRef.current) return;
    const scene = manifest.scenes[idx];
    if (!scene) return;
    setAudioDuration(null);
    setAudioMissing(false);
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    audioRef.current.src = `${AUDIO_BASE}/${scene.audio}`;
    audioRef.current.load();
    if (!paused) audioRef.current.play().catch(e => console.warn('autoplay blocked', e));
  }, [idx, manifest, started, paused]);

  // Fallback timer: si no hay MP3, avanza por durationSec del manifest.
  useEffect(() => {
    if (!manifest || !started || !audioMissing || paused) return;
    const scene = manifest.scenes[idx];
    if (!scene) return;
    const dur = (scene.durationSec ?? 12) * 1000;
    // Usamos la durationSec del manifest como duración mostrada en el chalkboard.
    setAudioDuration(scene.durationSec ?? 12);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = window.setTimeout(() => {
      if (idx < manifest.scenes.length - 1) setIdx(i => i + 1);
      else setEndReached(true);
    }, dur);
    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [idx, manifest, started, audioMissing, paused]);

  function start() {
    setStarted(true);
    setIdx(0);
  }

  function togglePause() {
    if (!audioRef.current) return;
    if (paused) {
      audioRef.current.play();
      setPaused(false);
    } else {
      audioRef.current.pause();
      setPaused(true);
    }
  }

  function skip(delta: number) {
    if (!manifest) return;
    const next = Math.max(0, Math.min(manifest.scenes.length - 1, idx + delta));
    setIdx(next);
  }

  function restart() {
    setIdx(0);
    setEndReached(false);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }

  if (!manifest) {
    return (
      <div className="w-screen h-screen bg-[#05060A] text-[#E2E8F0] flex items-center justify-center">
        <div className="text-[12px] font-mono text-[#64748B]">cargando manifest…</div>
      </div>
    );
  }

  const scene = manifest.scenes[idx];
  const total = manifest.scenes.length;

  return (
    <RenderClockContext.Provider value={clockState}>
    <div className="w-screen h-screen bg-black text-[#E2E8F0] overflow-hidden relative font-sans">
      {/* Audio element (hidden) */}
      <audio
        ref={audioRef}
        onLoadedMetadata={() => {
          if (audioRef.current) setAudioDuration(audioRef.current.duration);
        }}
        onError={() => {
          // MP3 ausente o corrupto → fallback por timer (`durationSec` del manifest)
          setAudioMissing(true);
        }}
        onEnded={() => {
          if (idx < total - 1) setIdx(i => i + 1);
          else setEndReached(true);
        }}
        preload="auto"
      />

      {/* Some scenes own the chalkboard themselves (econ-board) — when that
          happens the side panel must NOT render. */}
      {(() => null)()}

      {/* Full-screen scene */}
      <div className="absolute inset-0">
        <Suspense fallback={<div className="w-full h-full bg-black" />}>
          <SceneSwitch
            sceneId={scene.scene}
            phase={scene.id}
            board={scene.board}
            audioDurationSec={audioDuration ?? undefined}
          />
        </Suspense>
        {/* Narrator overlay — flechas + labels + big-numbers sync con audio */}
        <NarratorOverlay
          config={NARRATOR_REGISTRY[manifest.id]?.[scene.id]}
          audioRef={audioRef}
        />
      </div>

      {/* Chalkboard — floating panel top-right (only when scene doesn't own it). */}
      {scene.scene !== 'econ-board' && scene.board && scene.board.length > 0 && (
        <div
          className="absolute right-5 z-20 pointer-events-none"
          style={{
            top: '68px',
            width: '440px',
            maxHeight: 'calc(100vh - 180px)',
            overflow: 'hidden',
          }}
        >
          <Chalkboard
            lines={scene.board}
            scenarioKey={scene.id}
            audioDurationSec={audioDuration ?? undefined}
            sceneTitle={scene.id.replace(/^\d+-/, '').replace(/-/g, ' · ')}
          />
        </div>
      )}

      {/* Cinematic top/bottom gradient overlays */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/95 to-transparent pointer-events-none" />

      {/* Title bar */}
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between text-[12px] font-mono">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#64748B]">Masterclass · GAIA</div>
          <div className="text-white font-semibold text-[14px] mt-1">{manifest.title}</div>
        </div>
        {!RENDER_MODE && (
          <a href="/escuela.html" className="text-[#64748B] hover:text-white transition text-[11px]">
            ✕ salir
          </a>
        )}
      </div>

      {/* Subtitle */}
      <div className="absolute bottom-24 left-0 right-0 px-12 pointer-events-none">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[20px] leading-snug text-white font-medium tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            {started ? scene.text.replace(/\[[^\]]+\]/g, '').replace(/\.\.\./g, '…').replace(/\s+/g, ' ').trim() : 'Pon los audífonos. Una sola idea, llevada hasta el final.'}
          </p>
        </div>
      </div>

      {/* Module Picker (end screen) — math classes only, hidden in render mode */}
      {!RENDER_MODE && (
        <ModulePicker
          visible={endReached && PICKER_BY_MANIFEST[manifest.id] !== undefined}
          classId={PICKER_BY_MANIFEST[manifest.id] ?? 'i'}
        />
      )}

      {/* Controls + progress at the bottom — hidden in render mode */}
      {!RENDER_MODE && (
      <div className="absolute bottom-6 left-0 right-0 px-12">
        <div className="max-w-4xl mx-auto">
          {/* Scene chiclet bar */}
          <div className="flex gap-1 mb-3">
            {manifest.scenes.map((s, i) => (
              <button
                key={s.id}
                onClick={() => started && setIdx(i)}
                disabled={!started}
                title={s.id}
                className={`h-1 flex-1 rounded-full transition ${
                  i < idx ? 'bg-[#FDB813]' :
                  i === idx ? 'bg-white' :
                  'bg-white/15 hover:bg-white/30'
                } ${started ? 'cursor-pointer' : 'cursor-default'}`}
              />
            ))}
          </div>

          {/* Buttons row */}
          {!started ? (
            <div className="flex justify-center">
              <button
                onClick={start}
                className="px-8 py-3 rounded-md border-2 border-[#FDB813] bg-[#FDB813]/15 text-[#FDB813] hover:bg-[#FDB813]/30 transition text-[14px] font-semibold tracking-wide"
              >
                ▶  Empezar la clase
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4 text-[11px] font-mono">
              <button onClick={() => skip(-1)} disabled={idx === 0}
                className="px-3 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-white/40 hover:text-white disabled:opacity-30">
                ⏮  anterior
              </button>
              <button onClick={togglePause}
                className="px-4 py-1.5 rounded border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813] hover:bg-[#FDB813]/20">
                {paused ? '▶ continuar' : '❚❚ pausar'}
              </button>
              <button onClick={() => skip(1)} disabled={idx >= total - 1}
                className="px-3 py-1.5 rounded border border-[#1E293B] text-[#94A3B8] hover:border-white/40 hover:text-white disabled:opacity-30">
                siguiente  ⏭
              </button>
              <span className="text-[#475569] ml-3">{idx + 1} / {total}</span>
              <button onClick={restart}
                className="ml-3 px-2 py-1.5 rounded border border-[#1E293B] text-[#64748B] hover:border-white/40 hover:text-white">
                ↺
              </button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
    </RenderClockContext.Provider>
  );
}

function SceneSwitch({
  sceneId,
  phase,
  board,
  audioDurationSec,
}: {
  sceneId: string;
  phase: string;
  board?: string[];
  audioDurationSec?: number;
}) {
  // Key by sceneId only (NOT phase) so the canvas does not remount between
  // narrative beats that share a visual. The scene reads `phase` via prop and
  // adapts its animation/highlights accordingly.
  const key = sceneId;
  if (sceneId === 'void')             return <Void key={key} />;
  if (sceneId === 'complex-plane')    return <ComplexPlane key={key} />;
  if (sceneId === 'complex/mobius')   return <MobiusScene key={key} phase={phase} />;
  if (sceneId === 'complex/roots')    return <NewtonScene key={key} phase={phase} />;
  if (sceneId === 'complex/conformal') return <ConformalScene key={key} phase={phase} />;
  if (sceneId === 'em/ac-motor')      return <ACMotorScene key={key} phase={phase} />;
  if (sceneId === 'market-grid')      return <MarketGridScene key={key} />;
  if (sceneId === 'quality-collapse') return <QualityCollapseScene key={key} />;
  if (sceneId === 'asymmetric-info')  return <AsymmetricInfoScene key={key} />;
  if (sceneId === 'nobel-timeline')   return <NobelTimelineScene key={key} />;
  if (sceneId === 'transaction-flow') return <TransactionFlowScene key={key} phase={phase} />;
  if (sceneId === 'make-vs-buy')      return <MakeVsBuyScene key={key} phase={phase} />;
  if (sceneId === 'econ-board')       return <EconBoardScene key={key} phase={phase} lines={board ?? []} audioDurationSec={audioDurationSec} />;
  if (sceneId === 'econ-chart')       return <EconChartScene key={`${phase}`} phase={phase} classId={CLASS_ID} />;
  if (sceneId === 'commons')          return <CommonsScene key={`${key}-${phase}`} phase={phase} />;
  if (sceneId === 'matching')         return <MatchingScene key={`${key}-${phase}`} phase={phase} />;
  if (sceneId === 'expectations')     return <ExpectationsScene key={`${key}-${phase}`} phase={phase} />;
  if (sceneId === 'vickrey')          return <VickreyScene key={`${key}-${phase}`} phase={phase} />;
  if (sceneId === 'calc/derivative')  return <DerivativeScene key={key} phase={phase} />;
  if (sceneId === 'calc/integral')    return <IntegralScene key={key} phase={phase} />;
  if (sceneId === 'calc/taylor')      return <TaylorScene key={key} phase={phase} />;
  if (sceneId === 'calc/surface')     return <SurfaceScene key={key} phase={phase} />;
  if (sceneId === 'calc/field')       return <VectorFieldScene key={key} phase={phase} />;
  if (sceneId === 'linalg/matrix')    return <MatrixCubeScene key={key} phase={phase} />;
  if (sceneId === 'linalg/eigen')     return <EigenvectorScene key={key} phase={phase} />;
  if (sceneId === 'linalg/rotation')  return <GimbalScene key={key} phase={phase} />;
  if (sceneId === 'linalg/quaternion') return <QuaternionScene key={key} phase={phase} />;
  if (sceneId === 'linalg/pca')       return <PCAScene key={key} phase={phase} />;
  if (sceneId === 'bh/well')          return <BHWell key={key} />;
  if (sceneId === 'bh/lensing')       return <BHLensing key={key} />;
  if (sceneId === 'bh/disk')          return <BHDisk key={key} />;
  if (sceneId === 'bh/scale')         return <BHScaleCompare key={key} />;
  if (sceneId === 'bh/kerr')          return <BHKerr key={key} />;
  if (sceneId === 'bh/tidal')         return <BHTidal key={key} />;
  if (sceneId === 'bh/time')          return <BHTimeDilation key={key} />;
  if (sceneId === 'bh/photon')        return <BHPhotonSphere key={key} />;
  if (sceneId === 'bh/collapse')      return <BHCollapse key={key} />;
  if (sceneId === 'bh/hawking')       return <BHHawking key={key} />;
  if (sceneId === 'bh/gargantua')     return <BHGargantua key={key} />;
  if (sceneId === 'bh/merger')        return <BHMerger key={key} />;
  if (sceneId === 'pe/photoelectric') return <PhotoelectricScene key={key} phase={phase} />;
  if (sceneId === 'pe/plot')          return <PhotoelectricPlotScene key={key} phase={phase} />;
  if (sceneId === 'pe/sensor-mystery')   return <SensorMysteryScene key={key} phase={phase} />;
  if (sceneId === 'pe/wave-vs-reality')  return <WaveVsRealityScene key={key} phase={phase} />;
  if (sceneId === 'pe/lenard-apparatus') return <LenardApparatusScene key={key} phase={phase} />;
  if (sceneId === 'pe/threshold-cliff')  return <ThresholdCliffScene key={key} phase={phase} />;
  if (sceneId === 'pe/photon-ledger')    return <PhotonLedgerScene key={key} phase={phase} />;
  if (sceneId === 'pe/millikan-data')    return <MillikanDataScene key={key} phase={phase} />;
  if (sceneId === 'pe/compton-kick')     return <ComptonKickScene key={key} phase={phase} />;
  if (sceneId === 'pe/cascade-cuantica') return <CascadeQuanticaScene key={key} phase={phase} />;
  // Duflo Nobel Economía 2019 — 6 phases en una sola escena
  if (sceneId === 'duflo/pregunta')   return <DufloScene key={key} phase={0} />;
  if (sceneId === 'duflo/mito')       return <DufloScene key={key} phase={1} />;
  if (sceneId === 'duflo/rct')        return <DufloScene key={key} phase={2} />;
  if (sceneId === 'duflo/kenya')      return <DufloScene key={key} phase={3} />;
  if (sceneId === 'duflo/mexico')     return <DufloScene key={key} phase={4} />;
  if (sceneId === 'duflo/cierre')     return <DufloScene key={key} phase={5} />;
  return <Void key={key} />;
}
