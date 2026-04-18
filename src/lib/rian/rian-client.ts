/**
 * RIAN HTTP client — talks to rian_daemon over POST /rpc.
 *
 * The daemon hosts one brain per named dir under $RIAN_HOME/brains (default
 * ~/.rian/brains). La Forja uses a single brain ("forge_cad") that learns
 * the user's CAD habits token-by-token.
 *
 * Override URL with VITE_RIAN_URL at build time.
 */

export interface RianStatus {
  path: string;
  n_res: number;
  D: number;
  V: number;
  readout_k?: number;
  n_traces: number;
  n_pairs_seen: number;
  w_fresh: boolean;
}

export interface RianPulse {
  t: number;
  steps: number;
  R_glob: number;
  R_mod: number[];
  /** Per-reservoir-neuron phase in radians, only present when `phases: true`. */
  theta?: number[];
  /** Per-reservoir-neuron module index, only present when `modules: true`. */
  modules?: number[];
}

export interface RianBrainConfig {
  n_input?: number;
  n_res?: number;
  n_modules?: number;
  n_dim?: number;
  spc?: number;
  dt?: number;
  K_L?: number;
  K_G?: number;
  gamma?: number;
  I0?: number;
  sigma_in?: number;
  sigma_out?: number;
  l2?: number;
  seed?: number;
}

const DEFAULT_URL =
  (import.meta.env.VITE_RIAN_URL as string | undefined) ?? 'http://127.0.0.1:9876/rpc';

async function rpc<T extends { ok: boolean; error?: string }>(
  body: unknown,
  url = DEFAULT_URL,
): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`rian http ${r.status}`);
  const j = (await r.json()) as T;
  if (!j.ok) throw new Error(j.error ?? 'rian error');
  return j;
}

export const rian = {
  async ping(): Promise<boolean> {
    try {
      await rpc({ cmd: 'ping' });
      return true;
    } catch {
      return false;
    }
  },

  async list(): Promise<{ on_disk: string[]; loaded: string[] }> {
    const r = await rpc<{ ok: boolean; on_disk: string[]; loaded: string[] }>({
      cmd: 'list',
    });
    return { on_disk: r.on_disk, loaded: r.loaded };
  },

  async create(brain: string, cfg?: RianBrainConfig): Promise<RianStatus> {
    const r = await rpc<{ ok: boolean; status: RianStatus }>({ cmd: 'create', brain, cfg });
    return r.status;
  },

  async open(brain: string): Promise<RianStatus> {
    const r = await rpc<{ ok: boolean; status: RianStatus }>({ cmd: 'open', brain });
    return r.status;
  },

  async status(brain: string): Promise<RianStatus> {
    const r = await rpc<{ ok: boolean; status: RianStatus }>({ cmd: 'status', brain });
    return r.status;
  },

  async ingest(brain: string, trace: string[]): Promise<number> {
    const r = await rpc<{ ok: boolean; pairs: number }>({ cmd: 'ingest', brain, trace });
    return r.pairs;
  },

  async ask(
    brain: string,
    prefix: string[],
    max_steps = 8,
    stop?: string[],
  ): Promise<string[]> {
    const r = await rpc<{ ok: boolean; tokens: string[] }>({
      cmd: 'ask',
      brain,
      prefix,
      max_steps,
      stop,
    });
    return r.tokens;
  },

  async pulse(
    brain: string,
    steps = 10,
    opts: { phases?: boolean; modules?: boolean } = {},
  ): Promise<RianPulse> {
    const r = await rpc<{ ok: boolean } & RianPulse>({
      cmd: 'pulse',
      brain,
      steps,
      phases: opts.phases ?? false,
      modules: opts.modules ?? false,
    });
    return {
      t: r.t,
      steps: r.steps,
      R_glob: r.R_glob,
      R_mod: r.R_mod,
      theta: r.theta,
      modules: r.modules,
    };
  },

  /** Open the brain if it exists on disk; create it otherwise. */
  async ensureBrain(brain: string, cfg?: RianBrainConfig): Promise<RianStatus> {
    try {
      return await rian.open(brain);
    } catch {
      return await rian.create(brain, cfg);
    }
  },
};
