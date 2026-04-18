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

function ReservoirPoints({
  positions,
  phases,
}: {
  positions: Float32Array;
  phases: Float32Array;
}) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const colorAttr = useRef<THREE.BufferAttribute | null>(null);

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
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const th = phases[i];
      const hue = ((th / (Math.PI * 2)) % 1 + 1) % 1;
      col.setHSL(hue, 0.8, 0.55);
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
        size={0.055}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
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

  const [injectText, setInjectText] = useState('box w80 h40 d20');
  const [injectBusy, setInjectBusy] = useState(false);
  const [mode, setMode] = useState<'ask' | 'ingest'>('ask');
  const [lastPrefix, setLastPrefix] = useState<string[]>([]);
  const [lastTokens, setLastTokens] = useState<string[]>([]);
  const [brainStatus, setBrainStatus] = useState<RianStatus | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (conn !== 'online') return;
    // Full snapshot polling — both module labels and phases.
    startPulse(80, 3, { phases: true, modules: true });
    return () => stopPulse();
  }, [conn, startPulse, stopPulse]);

  // Refresh vocab/pairs counters after every ingest/ask and on connect.
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
    const h = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(h);
    };
  }, [conn, brain, lastTokens]);

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
            <div>brain: <span className="text-zinc-100">{brain}</span></div>
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
