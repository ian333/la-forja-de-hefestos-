/**
 * BrainView — full-screen visualization of the RIAN reservoir.
 *
 * What you see:
 *   - M module "blobs" arranged on a regular polyhedron (tetrahedron for M=4)
 *   - ~N dots inside each blob, one per reservoir oscillator
 *   - Dot color = phase θ (HSL hue → full cyclic spectrum)
 *   - When the reservoir synchronizes, a blob goes monochromatic; when
 *     incoherent it looks like static. Global sync = all four blobs agree.
 *
 * The raw reservoir lives in n_dim ≥ 2 space but those coordinates only
 * control how input is injected spatially, not which oscillator couples to
 * which. What actually determines the dynamics is the module assignment, so
 * the layout here reflects *that* structure rather than the raw positions.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useRianStore } from '@/lib/rian/rian-store';
import { rian, type RianStatus, type RianGeometry } from '@/lib/rian/rian-client';
import { pca3d, type Pca3dResult } from '@/lib/rian/pca3d';

const RIAN_URL =
  (import.meta.env.VITE_RIAN_URL as string | undefined) ?? 'http://127.0.0.1:9876/rpc';

// ----- layout helpers ---------------------------------------------------------

function moduleCenters(M: number): [number, number, number][] {
  if (M <= 1) return [[0, 0, 0]];
  if (M === 2) return [[-1.5, 0, 0], [1.5, 0, 0]];
  if (M === 3)
    return [0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      return [Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0] as [number, number, number];
    });
  if (M === 4)
    return [
      [ 1,  1,  1],
      [ 1, -1, -1],
      [-1,  1, -1],
      [-1, -1,  1],
    ].map(([x, y, z]) => [x * 1.4, y * 1.4, z * 1.4]) as [number, number, number][];
  // Fallback: points on a sphere via Fibonacci spiral.
  const out: [number, number, number][] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < M; i++) {
    const y = 1 - (i / (M - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = phi * i;
    out.push([Math.cos(t) * r * 1.8, y * 1.8, Math.sin(t) * r * 1.8]);
  }
  return out;
}

/** Mulberry32 — deterministic per-seed pseudo-random so the layout is stable. */
function rand32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build stable per-neuron base positions (3D) given the module assignment. */
function buildLayout(modules: number[], M: number): Float32Array {
  const N = modules.length;
  const centers = moduleCenters(M);
  const rnd = rand32(0xbeef);
  const out = new Float32Array(N * 3);
  const R = 0.55; // blob radius
  for (let i = 0; i < N; i++) {
    const c = centers[modules[i] % centers.length];
    // Uniform sample inside a unit ball, scaled
    let x: number, y: number, z: number, d: number;
    do {
      x = rnd() * 2 - 1;
      y = rnd() * 2 - 1;
      z = rnd() * 2 - 1;
      d = x * x + y * y + z * z;
    } while (d > 1);
    out[i * 3    ] = c[0] + x * R;
    out[i * 3 + 1] = c[1] + y * R;
    out[i * 3 + 2] = c[2] + z * R;
  }
  return out;
}

// ----- point cloud component -------------------------------------------------

/** Wrap angular delta into (-π, π] so dθ captures the true phase velocity
 *  even when θ wraps around the 2π boundary between pulses. */
function wrapDelta(d: number): number {
  let x = d;
  while (x >  Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}

function ReservoirPoints({
  positions,
  phases,
}: {
  positions: Float32Array;
  phases: Float32Array;
}) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const colorAttr = useRef<THREE.BufferAttribute | null>(null);
  const prevPhases = useRef<Float32Array | null>(null);
  /** Per-neuron low-pass filtered |dθ|, scaled to roughly [0,1]. */
  const velocity = useRef<Float32Array | null>(null);

  const colors = useMemo(() => new Float32Array(positions.length), [positions.length]);

  useEffect(() => {
    if (!geomRef.current) return;
    geomRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const cAttr = new THREE.BufferAttribute(colors, 3);
    geomRef.current.setAttribute('color', cAttr);
    colorAttr.current = cAttr;
  }, [positions, colors]);

  useFrame(() => {
    if (!colorAttr.current) return;
    const N = phases.length;
    if (!prevPhases.current || prevPhases.current.length !== N) {
      prevPhases.current = new Float32Array(phases);
      velocity.current = new Float32Array(N);
    }
    const prev = prevPhases.current!;
    const vel = velocity.current!;
    const alpha = 0.25; // EMA smoothing
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const th = phases[i];
      const d = Math.abs(wrapDelta(th - prev[i]));
      // Typical per-pulse phase step is ~dt*spc*ω ~ O(0.5 rad); clamp to 1.
      const dn = Math.min(1, d / 0.8);
      vel[i] = vel[i] * (1 - alpha) + dn * alpha;
      prev[i] = th;
      // Hue = phase → color-cycles with rotation.
      // Lightness tracks velocity: fast rotators light up, idle ones fade.
      const hue = ((th / (Math.PI * 2)) % 1 + 1) % 1;
      const light = 0.18 + vel[i] * 0.55;
      col.setHSL(hue, 0.85, light);
      colors[i * 3    ] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    colorAttr.current.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry ref={geomRef} />
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.95}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ----- R history strip -------------------------------------------------------

/** Render a polyline plot of R_glob (amber) and R_mod[k] (green tints)
 *  over the rolling history buffer. Pure function of the buffer snapshot so
 *  it memoizes cleanly in the parent. */
function renderRStrip(
  hist: { g: number[]; m: number[][] },
  len: number,
): React.ReactElement[] {
  const W = 480;
  const H = 56;
  const out: React.ReactElement[] = [];

  // Horizontal grid at R=0, 0.5, 1.
  for (let k = 0; k <= 2; k++) {
    const y = H - (k * 0.5) * H;
    out.push(
      <line
        key={`grid-${k}`}
        x1={0}
        y1={y}
        x2={W}
        y2={y}
        stroke="rgb(39 39 42)"
        strokeWidth={0.5}
      />,
    );
  }

  const toPath = (arr: number[]): string => {
    if (arr.length < 2) return '';
    const step = W / Math.max(1, len - 1);
    let d = '';
    for (let i = 0; i < arr.length; i++) {
      const x = i * step;
      const y = H - Math.max(0, Math.min(1, arr[i])) * H;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
    }
    return d;
  };

  // Per-module curves, faded.
  hist.m.forEach((arr, k) => {
    const d = toPath(arr);
    if (!d) return;
    out.push(
      <path
        key={`m-${k}`}
        d={d}
        fill="none"
        stroke={`hsl(${140 + k * 35}, 65%, 55%)`}
        strokeWidth={1}
        opacity={0.6}
      />,
    );
  });

  // Global curve on top.
  const gd = toPath(hist.g);
  if (gd) {
    out.push(
      <path
        key="g"
        d={gd}
        fill="none"
        stroke="rgb(250 204 21)"
        strokeWidth={1.5}
      />,
    );
  }

  return out;
}

// ----- Small HUD helpers -----------------------------------------------------

function LabSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 border-t border-zinc-800 pt-1.5 first:mt-0 first:border-0 first:pt-0">
      <div className="mb-1 text-[9px] uppercase tracking-[0.2em] text-zinc-500">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  k,
  v,
  color,
  mono,
}: {
  k: string;
  v: string;
  color?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-zinc-500">{k}</span>
      <span
        className={`${color ?? 'text-zinc-100'} ${
          mono ? 'truncate text-[10px]' : ''
        }`}
        title={v}
      >
        {v}
      </span>
    </div>
  );
}

// ----- HUD + scene orchestrator ----------------------------------------------

function ModuleRings({ R_mod, R_glob }: { R_mod: number[]; R_glob: number }) {
  const centers = moduleCenters(R_mod.length);
  return (
    <group>
      {R_mod.map((r, i) => {
        const c = centers[i];
        const rad = 0.7 + r * 0.6;
        return (
          <mesh key={i} position={c}>
            <sphereGeometry args={[rad, 24, 24]} />
            <meshBasicMaterial
              color={new THREE.Color().setHSL(0.34, 0.6, 0.45 + r * 0.4)}
              transparent
              opacity={0.06 + r * 0.18}
              wireframe
            />
          </mesh>
        );
      })}
      <mesh>
        <sphereGeometry args={[0.25 + R_glob * 0.9, 24, 24]} />
        <meshBasicMaterial
          color={new THREE.Color().setHSL(0.12, 0.9, 0.55)}
          transparent
          opacity={0.15 + R_glob * 0.5}
        />
      </mesh>
    </group>
  );
}

export default function BrainView() {
  const conn = useRianStore((s) => s.conn);
  const pulse = useRianStore((s) => s.pulse);
  const error = useRianStore((s) => s.error);
  const init = useRianStore((s) => s.init);
  const startPulse = useRianStore((s) => s.startPulse);
  const stopPulse = useRianStore((s) => s.stopPulse);
  const brain = useRianStore((s) => s.brain);
  const setBrain = useRianStore((s) => s.setBrain);

  const [brainList, setBrainList] = useState<string[]>([]);

  const [injectText, setInjectText] = useState('box w80 h40 d20');
  const [injectBusy, setInjectBusy] = useState(false);
  const [mode, setMode] = useState<'ask' | 'ingest'>('ask');
  const [lastPrefix, setLastPrefix] = useState<string[]>([]);
  const [lastTokens, setLastTokens] = useState<string[]>([]);
  const [brainStatus, setBrainStatus] = useState<RianStatus | null>(null);
  /** Frozen reservoir geometry (positions, omega, modules). Fetched once per
   *  brain open — never changes unless the brain is re-created. */
  const [geom, setGeom] = useState<RianGeometry | null>(null);
  const [geomPca, setGeomPca] = useState<Pca3dResult | null>(null);
  /** 'module' = tetraedral fake layout (each module is a blob); 'real' = the
   *  actual reservoir positions projected to 3D via PCA of n_dim space. */
  const [layoutMode, setLayoutMode] = useState<'module' | 'real'>('module');
  const [injectFlash, setInjectFlash] = useState(0); // t wall-clock of last inject

  /** Rolling history of R_glob + R_mod[] for the top timeline strip. */
  const HIST_LEN = 240;
  const historyRef = useRef<{ g: number[]; m: number[][]; wall: number[] }>({
    g: [],
    m: [],
    wall: [],
  });
  const [histTick, setHistTick] = useState(0);

  /** Rolling pair-count for training rate (pairs / s). */
  const pairsHistRef = useRef<{ t: number; pairs: number }[]>([]);
  const [pairsPerSec, setPairsPerSec] = useState(0);

  /** ── Recording state ──
   *  startedAt = wall-ms at press; null when idle. fullFidelity dumps theta
   *  + modules per frame (big); otherwise only R signals. events[] holds
   *  inject actions interleaved in the same JSONL so replay can see cause
   *  and response. */
  type RecEvent = {
    t: number;
    kind: 'ask' | 'ingest';
    prefix: string[];
    out?: string[];
    pairs?: number;
  };
  type RecFrame = {
    t: number;
    dt: number;
    R_glob: number;
    R_mod: number[];
    status?: { V: number; pairs: number; traces: number };
    theta?: number[];
    modules?: number[];
  };
  const [recording, setRecording] = useState(false);
  const [recFullFidelity, setRecFullFidelity] = useState(false);
  const recFramesRef = useRef<RecFrame[]>([]);
  const recEventsRef = useRef<RecEvent[]>([]);
  const recStartedAtRef = useRef<number | null>(null);
  const [recCount, setRecCount] = useState(0);

  useEffect(() => {
    init();
  }, [init]);

  // Start the pulse loop once on mount — the loop itself now probes for
  // reconnection when offline, so we never need to tear it down on daemon
  // restarts (kernel rebuilds, trainer swaps, etc).
  useEffect(() => {
    startPulse(80, 3, { phases: true, modules: true });
    return () => stopPulse();
  }, [startPulse, stopPulse]);

  // Append R_glob / R_mod to the rolling history on every new pulse.
  // Also appends a frame to the active recording, if any.
  useEffect(() => {
    if (!pulse) return;
    const now = performance.now();
    const h = historyRef.current;
    h.g.push(pulse.R_glob);
    h.wall.push(now);
    if (h.g.length > HIST_LEN) {
      h.g.shift();
      h.wall.shift();
    }
    const M = pulse.R_mod.length;
    if (h.m.length !== M) h.m = Array.from({ length: M }, () => []);
    for (let k = 0; k < M; k++) {
      h.m[k].push(pulse.R_mod[k]);
      if (h.m[k].length > HIST_LEN) h.m[k].shift();
    }
    setHistTick((t) => (t + 1) & 0xffff);

    if (recording && recStartedAtRef.current != null) {
      const frame: RecFrame = {
        t: now - recStartedAtRef.current,
        dt: pulse.t,
        R_glob: pulse.R_glob,
        R_mod: pulse.R_mod.slice(),
      };
      if (recFullFidelity && pulse.theta) frame.theta = Array.from(pulse.theta);
      if (recFullFidelity && pulse.modules) frame.modules = Array.from(pulse.modules);
      if (brainStatus) {
        frame.status = {
          V: brainStatus.V,
          pairs: brainStatus.n_pairs_seen,
          traces: brainStatus.n_traces,
        };
      }
      recFramesRef.current.push(frame);
      setRecCount(recFramesRef.current.length);
    }
  }, [pulse]);

  // Refresh vocab/pairs counters after every ingest/ask and on connect.
  // Fast poll (500ms) picks up trainers mutating the brain in the background.
  // Also computes pairs/s (training rate) from a 5-sample rolling window.
  useEffect(() => {
    if (conn !== 'online') return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await rian.status(brain);
        if (!alive) return;
        setBrainStatus(s);
        const now = performance.now();
        const hist = pairsHistRef.current;
        hist.push({ t: now, pairs: s.n_pairs_seen });
        while (hist.length > 10) hist.shift();
        if (hist.length >= 2) {
          const first = hist[0];
          const last = hist[hist.length - 1];
          const dt = (last.t - first.t) / 1000;
          const dp = last.pairs - first.pairs;
          setPairsPerSec(dt > 0 ? dp / dt : 0);
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    const h = setInterval(tick, 500);
    return () => {
      alive = false;
      clearInterval(h);
    };
  }, [conn, brain, lastTokens]);

  // Poll the list of brains on disk so the selector picks up trainer brains
  // spawned/wiped while this tab is open.
  useEffect(() => {
    if (conn !== 'online') return;
    let alive = true;
    const tick = async () => {
      try {
        const { on_disk } = await rian.list();
        if (alive) setBrainList(on_disk);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const h = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(h);
    };
  }, [conn]);

  // Reset history when switching brains — stale R curves are misleading.
  useEffect(() => {
    historyRef.current = { g: [], m: [], wall: [] };
    pairsHistRef.current = [];
    setHistTick((t) => t + 1);
    setGeom(null);
    setGeomPca(null);
  }, [brain]);

  // Fetch real geometry once the brain is online. Positions are frozen so one
  // call per brain open is enough; PCA happens here (not in a worker) because
  // n_dim is tiny (≤64) and N≤few thousand → < 20ms on a cold run.
  useEffect(() => {
    if (conn !== 'online') return;
    let alive = true;
    rian.geometry(brain)
      .then((g) => {
        if (!alive) return;
        setGeom(g);
        setGeomPca(pca3d(g.positions, g.n_res, g.n_dim));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [brain, conn]);

  const layout = useMemo(() => {
    if (layoutMode === 'real' && geomPca && geom) {
      // Rescale PCA output so the cloud fills roughly the same volume as the
      // tetraedral layout (diag ≈ 5), otherwise the camera framing is off.
      const src = geomPca.xyz;
      const target = 3.6;
      const scale = geomPca.diag > 1e-6 ? target / geomPca.diag : 1;
      const out = new Float32Array(src.length);
      for (let i = 0; i < src.length; i++) out[i] = src[i] * scale;
      return out;
    }
    if (!pulse?.modules || !pulse?.R_mod) return null;
    return buildLayout(pulse.modules, pulse.R_mod.length);
  }, [layoutMode, geomPca, geom, pulse?.modules, pulse?.R_mod?.length]);

  const phases = useMemo(() => {
    if (!pulse?.theta) return null;
    return pulse.theta instanceof Float32Array
      ? pulse.theta
      : Float32Array.from(pulse.theta);
  }, [pulse?.theta]);

  async function onInject(e: React.FormEvent) {
    e.preventDefault();
    const tokens = injectText.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return;
    setInjectBusy(true);
    setLastPrefix(tokens);
    setInjectFlash(Date.now());
    try {
      let result: { out?: string[]; pairs?: number } = {};
      if (mode === 'ingest') {
        const pairs = await rian.ingest(brain, tokens);
        setLastTokens([`(+${pairs} pairs learned)`]);
        result.pairs = pairs;
      } else {
        const out = await rian.ask(brain, tokens, 8);
        setLastTokens(out);
        result.out = out;
      }
      if (recording && recStartedAtRef.current != null) {
        recEventsRef.current.push({
          t: performance.now() - recStartedAtRef.current,
          kind: mode,
          prefix: tokens,
          ...result,
        });
      }
    } catch (err) {
      setLastTokens([`(error) ${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      setInjectBusy(false);
    }
  }

  function startRecording() {
    recFramesRef.current = [];
    recEventsRef.current = [];
    recStartedAtRef.current = performance.now();
    setRecCount(0);
    setRecording(true);
  }

  function stopAndDownload() {
    setRecording(false);
    const frames = recFramesRef.current;
    const events = recEventsRef.current;
    if (frames.length === 0 && events.length === 0) {
      recStartedAtRef.current = null;
      return;
    }
    // JSONL: header + one row per frame/event, time-sorted.
    const header = {
      kind: 'rian.recording.v1',
      brain,
      daemon_url: RIAN_URL,
      started_at_iso: new Date(
        Date.now() - (performance.now() - (recStartedAtRef.current ?? 0)),
      ).toISOString(),
      full_fidelity: recFullFidelity,
      n_frames: frames.length,
      n_events: events.length,
    };
    const rows: string[] = [JSON.stringify(header)];
    const merged: Array<{ t: number; row: string }> = [
      ...frames.map((f) => ({ t: f.t, row: JSON.stringify({ type: 'frame', ...f }) })),
      ...events.map((e) => ({ t: e.t, row: JSON.stringify({ type: 'event', ...e }) })),
    ].sort((a, b) => a.t - b.t);
    for (const r of merged) rows.push(r.row);
    const blob = new Blob([rows.join('\n') + '\n'], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `rian-${brain}-${stamp}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    recStartedAtRef.current = null;
  }

  // Inject flash fades out over 1.2s — used to colour-pulse the canvas
  // border when the user fires ask/teach so they see cause → response.
  const flashAlpha = useMemo(() => {
    if (!injectFlash) return 0;
    const age = (Date.now() - injectFlash) / 1200;
    return Math.max(0, 1 - age);
  }, [injectFlash, histTick]); // histTick drives re-render as pulses arrive

  const strip = useMemo(() => renderRStrip(historyRef.current, HIST_LEN), [histTick]);

  /** Per-frame derived metrics over the R history buffer. */
  const metrics = useMemo(() => {
    const h = historyRef.current;
    const M = h.m.length;
    const out = {
      meanMod: 0,
      stdMod: 0,
      entropyMod: 0,
      dRdt: 0, // last-frame delta / dt in s
      fps: 0,
    };
    if (pulse && M > 0) {
      let sum = 0;
      for (let k = 0; k < M; k++) sum += pulse.R_mod[k];
      const mean = sum / M;
      let v = 0;
      for (let k = 0; k < M; k++) {
        const d = pulse.R_mod[k] - mean;
        v += d * d;
      }
      out.meanMod = mean;
      out.stdMod = Math.sqrt(v / M);
      // Normalised module coherence → module-distribution entropy.
      // Near log(M) = uniform activity; near 0 = one module dominates.
      const eps = 1e-9;
      let s = 0;
      for (let k = 0; k < M; k++) s += pulse.R_mod[k] + eps;
      let ent = 0;
      for (let k = 0; k < M; k++) {
        const p = (pulse.R_mod[k] + eps) / s;
        ent -= p * Math.log(p);
      }
      out.entropyMod = ent;
    }
    const g = h.g;
    const w = h.wall;
    if (g.length >= 2 && w.length >= 2) {
      const dR = g[g.length - 1] - g[g.length - 2];
      const dt = (w[w.length - 1] - w[w.length - 2]) / 1000;
      out.dRdt = dt > 0 ? dR / dt : 0;
    }
    if (w.length >= 2) {
      const span = (w[w.length - 1] - w[0]) / 1000;
      out.fps = span > 0 ? (w.length - 1) / span : 0;
    }
    return out;
  }, [histTick, pulse]);

  /** Approximate in-memory size of the recording buffer in KB. */
  const recSizeKB = useMemo(() => {
    if (!recording) return 0;
    const perFrame = recFullFidelity ? 9 * 1024 : 64; // rough bytes per frame
    return (recCount * perFrame) / 1024;
  }, [recording, recFullFidelity, recCount]);

  return (
    <div className="fixed inset-0 bg-black text-zinc-100">
      <Canvas
        camera={{ position: [4.5, 3.5, 5.5], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={0.6} />
        <OrbitControls enableDamping dampingFactor={0.1} />
        <axesHelper args={[3]} />
        {pulse?.R_mod && layoutMode === 'module' && (
          <ModuleRings R_mod={pulse.R_mod} R_glob={pulse.R_glob} />
        )}
        {layout && phases && phases.length === layout.length / 3 && (
          <ReservoirPoints positions={layout} phases={phases} />
        )}
      </Canvas>

      {/* Inject flash — thin animated border glow over the canvas. */}
      {flashAlpha > 0 && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            boxShadow: `inset 0 0 120px 16px rgba(${
              mode === 'ask' ? '110,231,183' : '250,204,21'
            }, ${flashAlpha * 0.45})`,
          }}
        />
      )}

      {/* ── Top-center: R history strip ── */}
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-md bg-black/60 px-3 py-1.5 backdrop-blur">
        <div className="mb-0.5 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-zinc-500">
          <span>R history · {HIST_LEN} frames</span>
          <span className="font-mono text-zinc-600">
            {historyRef.current.g.length}/{HIST_LEN}
          </span>
        </div>
        <svg width={480} height={56} className="block">
          <rect x={0} y={0} width={480} height={56} fill="rgba(24,24,27,0.5)" />
          {strip}
        </svg>
      </div>

      {/* ── Left: lab panel ── */}
      <div className="absolute left-4 top-4 w-[260px] rounded-lg border border-zinc-800 bg-black/70 p-3 font-mono text-[11px] text-zinc-300 backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em]">
          <span className="text-emerald-400">RIAN · lab</span>
          <span className={`font-mono ${conn === 'online' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {conn === 'online' ? '● live' : conn === 'offline' ? '○ offline' : '· wait'}
          </span>
        </div>
        {conn === 'offline' && error && (
          <div className="mb-2 rounded bg-amber-900/30 px-2 py-1 text-[10px] text-amber-200">
            {error}
          </div>
        )}

        {/* Daemon + brain */}
        <LabSection title="target">
          <Row k="daemon" v={RIAN_URL.replace(/^https?:\/\//, '')} mono />
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">brain</span>
            <select
              value={brain}
              onChange={(e) => setBrain(e.target.value)}
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-1 py-0 font-mono text-[11px] text-zinc-100"
            >
              {!brainList.includes(brain) && <option value={brain}>{brain}</option>}
              {brainList.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-zinc-500">layout</span>
            <div className="flex overflow-hidden rounded border border-zinc-700 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setLayoutMode('module')}
                className={`px-2 py-0.5 ${layoutMode === 'module' ? 'bg-amber-500/20 text-amber-200' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
                title="Tetraedral blobs, one per module (original)"
              >
                module
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('real')}
                disabled={!geomPca}
                className={`px-2 py-0.5 ${layoutMode === 'real' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed'}`}
                title={geomPca
                  ? `Real n_dim=${geom?.n_dim} positions projected via PCA (${(geomPca.variance_explained * 100).toFixed(0)}% variance)`
                  : 'waiting for geometry…'}
              >
                real · PCA
              </button>
            </div>
          </div>
          {layoutMode === 'real' && geomPca && (
            <Row
              k="var. expl."
              v={`${(geomPca.variance_explained * 100).toFixed(1)}%`}
              color="text-emerald-200"
            />
          )}
        </LabSection>

        {/* Live dynamics */}
        <LabSection title="dynamics">
          {pulse ? (
            <>
              <Row k="t" v={`${pulse.t.toFixed(2)} s`} />
              <Row k="steps" v={pulse.steps.toString()} />
              <Row k="N · M" v={`${pulse.theta?.length ?? '?'} · ${pulse.R_mod.length}`} />
              <Row k="fps" v={metrics.fps.toFixed(1)} />
            </>
          ) : (
            <Row k="" v="waiting for pulse…" />
          )}
        </LabSection>

        {/* R metrics */}
        {pulse && (
          <LabSection title="coherence (R)">
            <Row
              k="R_glob"
              v={pulse.R_glob.toFixed(4)}
              color="text-amber-300"
            />
            <Row
              k="dR/dt"
              v={`${metrics.dRdt >= 0 ? '+' : ''}${metrics.dRdt.toFixed(4)}/s`}
              color={metrics.dRdt >= 0 ? 'text-emerald-300' : 'text-rose-300'}
            />
            <Row
              k="R_mod μ · σ"
              v={`${metrics.meanMod.toFixed(3)} · ${metrics.stdMod.toFixed(3)}`}
            />
            <Row
              k="H(R_mod)"
              v={`${metrics.entropyMod.toFixed(3)} / ${Math.log(pulse.R_mod.length).toFixed(3)}`}
            />
            <div className="mt-1 flex gap-0.5">
              {pulse.R_mod.map((r, i) => (
                <div
                  key={i}
                  title={`module ${i}: R=${r.toFixed(3)}`}
                  className="h-4 flex-1 rounded-sm"
                  style={{
                    background: `rgba(110,231,183,${0.12 + r * 0.75})`,
                    border: '1px solid rgba(110,231,183,0.2)',
                  }}
                />
              ))}
            </div>
          </LabSection>
        )}

        {/* Training */}
        {brainStatus && (
          <LabSection title="training">
            <Row k="V" v={brainStatus.V.toString()} />
            <Row k="pairs" v={brainStatus.n_pairs_seen.toLocaleString()} />
            <Row k="traces" v={brainStatus.n_traces.toString()} />
            <Row
              k="pairs/s"
              v={pairsPerSec >= 1 ? pairsPerSec.toFixed(1) : pairsPerSec.toFixed(2)}
              color={pairsPerSec > 0.5 ? 'text-emerald-300' : 'text-zinc-400'}
            />
            <Row
              k="W"
              v={brainStatus.w_fresh ? 'fresh' : 'stale'}
              color={brainStatus.w_fresh ? 'text-emerald-300' : 'text-amber-300'}
            />
          </LabSection>
        )}

        {/* Recording */}
        <LabSection title="recording">
          <div className="flex items-center gap-2">
            {!recording ? (
              <button
                onClick={startRecording}
                disabled={conn !== 'online'}
                className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-black hover:bg-rose-500 disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                ● REC
              </button>
            ) : (
              <button
                onClick={stopAndDownload}
                className="animate-pulse rounded bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-black hover:bg-rose-400"
              >
                ■ STOP + save
              </button>
            )}
            <label
              className="flex cursor-pointer select-none items-center gap-1 text-[10px] text-zinc-400"
              title="incluye theta[] y modules[] por frame — pesado, ~10KB/frame"
            >
              <input
                type="checkbox"
                checked={recFullFidelity}
                disabled={recording}
                onChange={(e) => setRecFullFidelity(e.target.checked)}
                className="h-3 w-3 accent-rose-500"
              />
              full fidelity
            </label>
          </div>
          {recording && (
            <div className="mt-1 text-[10px] text-zinc-400">
              frames <span className="text-zinc-200">{recCount}</span> · events{' '}
              <span className="text-zinc-200">{recEventsRef.current.length}</span> ·{' '}
              <span className="text-zinc-500">~{recSizeKB.toFixed(0)} KB</span>
            </div>
          )}
        </LabSection>
      </div>

      {/* ── Bottom-left: inject prefix ── */}
      <form
        onSubmit={onInject}
        className="absolute bottom-4 left-4 flex flex-col gap-1 rounded-md border border-zinc-800 bg-black/70 px-3 py-2 font-mono text-[12px] backdrop-blur"
      >
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-zinc-700 overflow-hidden text-[10px]">
            <button
              type="button"
              onClick={() => setMode('ask')}
              className={`px-2 py-0.5 ${
                mode === 'ask' ? 'bg-emerald-600 text-black' : 'bg-transparent text-zinc-400'
              }`}
            >
              ask
            </button>
            <button
              type="button"
              onClick={() => setMode('ingest')}
              className={`px-2 py-0.5 ${
                mode === 'ingest' ? 'bg-amber-500 text-black' : 'bg-transparent text-zinc-400'
              }`}
            >
              teach
            </button>
          </div>
          <input
            value={injectText}
            onChange={(e) => setInjectText(e.target.value)}
            disabled={injectBusy || conn !== 'online'}
            className="w-80 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-600"
            placeholder={
              mode === 'ask'
                ? 'prefix tokens → continúa'
                : 'traza de tokens → aprende secuencia'
            }
          />
          <button
            type="submit"
            disabled={injectBusy || conn !== 'online'}
            className={`rounded px-2 py-0.5 text-black disabled:bg-zinc-700 disabled:text-zinc-500 ${
              mode === 'ask' ? 'bg-emerald-600' : 'bg-amber-500'
            }`}
          >
            {injectBusy ? '…' : 'go'}
          </button>
        </div>
        {(lastPrefix.length > 0 || lastTokens.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-1 text-[11px]">
            {lastPrefix.length > 0 && (
              <span className="text-zinc-500">
                in:{' '}
                {lastPrefix.map((t, i) => (
                  <span key={i} className="ml-1 text-amber-300">
                    {t}
                  </span>
                ))}
              </span>
            )}
            {lastTokens.length > 0 && (
              <span className="text-zinc-500">
                out:{' '}
                {lastTokens.map((t, i) => (
                  <span key={i} className="ml-1 text-emerald-300">
                    {t}
                  </span>
                ))}
              </span>
            )}
          </div>
        )}
      </form>

      {/* ── Bottom-right: helptext ── */}
      <div className="pointer-events-none absolute bottom-4 right-4 max-w-xs font-mono text-[10px] leading-relaxed text-zinc-500">
        arrastra para rotar · rueda para zoom · color = fase θ · brillo = |dθ/dt|
      </div>
    </div>
  );
}
