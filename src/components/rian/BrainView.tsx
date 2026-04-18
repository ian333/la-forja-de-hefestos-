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
import { rian, type RianStatus } from '@/lib/rian/rian-client';

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
  const [injectFlash, setInjectFlash] = useState(0); // t wall-clock of last inject

  /** Rolling history of R_glob + R_mod[] for the top timeline strip. */
  const HIST_LEN = 240;
  const historyRef = useRef<{ g: number[]; m: number[][] }>({ g: [], m: [] });
  const [histTick, setHistTick] = useState(0);

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
  useEffect(() => {
    if (!pulse) return;
    const h = historyRef.current;
    h.g.push(pulse.R_glob);
    if (h.g.length > HIST_LEN) h.g.shift();
    const M = pulse.R_mod.length;
    if (h.m.length !== M) h.m = Array.from({ length: M }, () => []);
    for (let k = 0; k < M; k++) {
      h.m[k].push(pulse.R_mod[k]);
      if (h.m[k].length > HIST_LEN) h.m[k].shift();
    }
    setHistTick((t) => (t + 1) & 0xffff); // force re-render of svg strip
  }, [pulse]);

  // Refresh vocab/pairs counters after every ingest/ask and on connect.
  // Fast poll (500ms) picks up trainers mutating the brain in the background.
  useEffect(() => {
    if (conn !== 'online') return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await rian.status(brain);
        if (alive) setBrainStatus(s);
      } catch {
        /* ignore; pulse overlay already surfaces connection state */
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
    historyRef.current = { g: [], m: [] };
    setHistTick((t) => t + 1);
  }, [brain]);

  const layout = useMemo(() => {
    if (!pulse?.modules || !pulse?.R_mod) return null;
    return buildLayout(pulse.modules, pulse.R_mod.length);
  }, [pulse?.modules, pulse?.R_mod?.length]);

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
      if (mode === 'ingest') {
        const pairs = await rian.ingest(brain, tokens);
        setLastTokens([`(+${pairs} pairs learned)`]);
      } else {
        const out = await rian.ask(brain, tokens, 8);
        setLastTokens(out);
      }
    } catch (err) {
      setLastTokens([`(error) ${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      setInjectBusy(false);
    }
  }

  // Inject flash fades out over 1.2s — used to colour-pulse the canvas
  // border when the user fires ask/teach so they see cause → response.
  const flashAlpha = useMemo(() => {
    if (!injectFlash) return 0;
    const age = (Date.now() - injectFlash) / 1200;
    return Math.max(0, 1 - age);
  }, [injectFlash, histTick]); // histTick drives re-render as pulses arrive

  const strip = useMemo(() => renderRStrip(historyRef.current, HIST_LEN), [histTick]);

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
        {pulse?.R_mod && <ModuleRings R_mod={pulse.R_mod} R_glob={pulse.R_glob} />}
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

      {/* ── Top-left: status ── */}
      <div className="pointer-events-none absolute left-4 top-4 font-mono text-[11px] text-zinc-300">
        <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-emerald-400">
          RIAN · reservoir field
        </div>
        {conn === 'offline' && (
          <div className="text-amber-300">daemon offline {error ? `· ${error}` : ''}</div>
        )}
        {pulse && (
          <div className="space-y-0.5">
            <div className="text-zinc-500">daemon: <span className="text-zinc-300">{RIAN_URL}</span></div>
            <div className="pointer-events-auto flex items-center gap-2">
              <span>brain:</span>
              <select
                value={brain}
                onChange={(e) => setBrain(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 text-zinc-100 text-[11px] px-1 py-0 rounded font-mono"
              >
                {!brainList.includes(brain) && <option value={brain}>{brain}</option>}
                {brainList.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>t = {pulse.t.toFixed(2)} s · {pulse.steps} steps</div>
            <div>
              R<sub>glob</sub> ={' '}
              <span className="text-amber-300">{pulse.R_glob.toFixed(4)}</span>
            </div>
            <div>
              R<sub>mod</sub> = [
              {pulse.R_mod.map((r, i) => (
                <span key={i} className="ml-1">
                  <span className="text-emerald-300">{r.toFixed(3)}</span>
                  {i < pulse.R_mod.length - 1 ? ',' : ''}
                </span>
              ))}
              ]
            </div>
            <div className="text-zinc-500">
              N = {pulse.theta?.length ?? '?'} · M = {pulse.R_mod.length}
              {brainStatus && (
                <>
                  {' · '}V = <span className="text-zinc-300">{brainStatus.V}</span>
                  {' · '}pairs = <span className="text-zinc-300">{brainStatus.n_pairs_seen}</span>
                  {' · '}traces = <span className="text-zinc-300">{brainStatus.n_traces}</span>
                </>
              )}
            </div>
          </div>
        )}
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
        arrastra para rotar · rueda para zoom · color = fase θ · blobs = módulos
      </div>
    </div>
  );
}
