/**
 * RIAN zustand slice — keeps connection state + the latest Kuramoto order
 * parameters (R_glob + R_mod[M]). Kept separate from useForgeStore so a
 * daemon outage never blocks CAD work.
 *
 * Pull model: `startPulse()` spins a setInterval that calls `pulse` every
 * `intervalMs`. Each call advances the reservoir `stepsPerTick` integration
 * steps. The brain is completely passive otherwise — no idle CPU when no
 * subscriber is polling.
 */

import { create } from 'zustand';
import { rian, type RianStatus, type RianPulse } from './rian-client';

export type RianConn = 'unknown' | 'offline' | 'online';

export const FORGE_BRAIN = 'forge_cad';

const DEFAULT_BRAIN_CFG = {
  n_input: 16,
  n_res: 1024,
  n_modules: 4,
  n_dim: 32,
  spc: 4,
  seed: 42,
};

interface RianState {
  conn: RianConn;
  brain: string;
  status: RianStatus | null;
  pulse: RianPulse | null;
  error: string | null;
  polling: boolean;

  init: () => Promise<void>;
  startPulse: (
    intervalMs?: number,
    stepsPerTick?: number,
    opts?: { phases?: boolean; modules?: boolean },
  ) => void;
  stopPulse: () => void;
}

let pulseTimer: ReturnType<typeof setInterval> | null = null;

export const useRianStore = create<RianState>((set, get) => ({
  conn: 'unknown',
  brain: FORGE_BRAIN,
  status: null,
  pulse: null,
  error: null,
  polling: false,

  init: async () => {
    const alive = await rian.ping();
    if (!alive) {
      set({ conn: 'offline', error: 'daemon unreachable' });
      return;
    }
    try {
      const s = await rian.ensureBrain(get().brain, DEFAULT_BRAIN_CFG);
      set({ conn: 'online', status: s, error: null });
    } catch (e) {
      set({ conn: 'offline', error: e instanceof Error ? e.message : String(e) });
    }
  },

  startPulse: (intervalMs = 100, stepsPerTick = 4, opts = {}) => {
    if (pulseTimer) return;
    set({ polling: true });
    const tick = async () => {
      if (get().conn !== 'online') return;
      try {
        const p = await rian.pulse(get().brain, stepsPerTick, opts);
        set({ pulse: p, error: null });
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
      }
    };
    void tick();
    pulseTimer = setInterval(tick, intervalMs);
  },

  stopPulse: () => {
    if (pulseTimer) {
      clearInterval(pulseTimer);
      pulseTimer = null;
    }
    set({ polling: false });
  },
}));
