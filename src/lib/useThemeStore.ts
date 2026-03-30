/**
 * ⚒️ La Forja — Theme Store
 * ===========================
 * Zustand store that manages the active color profile.
 * On change, applies CSS custom properties to :root AND exposes
 * viewport/material/STEP values for Three.js components to subscribe.
 *
 * Persists to localStorage so theme survives reload.
 */

import { create } from 'zustand';
import {
  type ThemeProfile,
  THEME_MAP,
  DEFAULT_THEME_ID,
  ORO_DIVINO,
} from './theme-profiles';

// ═══════════════════════════════════════════════════════════════
// Store types
// ═══════════════════════════════════════════════════════════════

interface ThemeState {
  /** Currently active profile */
  profile: ThemeProfile;
  /** Set a theme by ID */
  setTheme: (id: string) => void;
  /** Quick access to profile ID */
  themeId: string;
}

const LS_KEY = 'laforja-theme';

// ═══════════════════════════════════════════════════════════════
// CSS Application
// ═══════════════════════════════════════════════════════════════

/**
 * Applies all CSS custom properties from a ThemeProfile to :root
 * so every element using var(--c-*) updates instantly.
 */
function applyCssVars(p: ThemeProfile) {
  const r = document.documentElement.style;
  const u = p.ui;
  const s = p.semantic;

  // ── Core surfaces ──
  r.setProperty('--c-base',        u.base);
  r.setProperty('--c-surface',     u.surface);
  r.setProperty('--c-surface-up',  u.surfaceUp);
  r.setProperty('--c-surface-top', u.surfaceTop);
  r.setProperty('--c-overlay',     u.overlay);
  r.setProperty('--c-raised',      u.raised);

  // ── Borders ──
  r.setProperty('--c-border',      u.border);
  r.setProperty('--c-border-sub',  u.borderSub);
  r.setProperty('--c-border-hi',   u.borderHi);

  // ── Text hierarchy ──
  r.setProperty('--c-text-1',      u.text1);
  r.setProperty('--c-text-2',      u.text2);
  r.setProperty('--c-text-3',      u.text3);
  r.setProperty('--c-text-4',      u.text4);

  // ── Accent ──
  r.setProperty('--c-accent',      u.accent);
  r.setProperty('--c-accent-hi',   u.accentHi);
  r.setProperty('--c-gold',        u.accent);      // alias for backward compat
  r.setProperty('--c-gold-hi',     u.accentHi);
  r.setProperty('--c-gold-dim',    u.accentDim);
  r.setProperty('--c-gold-glow',   u.accentGlow);
  r.setProperty('--c-gold-warm',   u.accentWarm);

  // ── Semantic colors ──
  r.setProperty('--c-red',         s.red);
  r.setProperty('--c-green',       s.green);
  r.setProperty('--c-teal',        s.teal);
  r.setProperty('--c-amber',       s.amber);
  r.setProperty('--c-purple',      s.purple);
  r.setProperty('--c-blue',        s.blue);

  // ── Panel glass ──
  r.setProperty('--panel-glass',          u.panelGlass);
  r.setProperty('--panel-glass-border',   u.panelGlassBorder);
  r.setProperty('--panel-shadow',         u.panelShadow);

  // ── Tailwind / shadcn semantic tokens ──
  r.setProperty('--color-base',                u.base);
  r.setProperty('--color-surface',             u.surface);
  r.setProperty('--color-surface-up',          u.surfaceUp);
  r.setProperty('--color-overlay',             u.overlay);
  r.setProperty('--color-raised',              u.raised);
  r.setProperty('--color-background',          u.base);
  r.setProperty('--color-foreground',          u.text1);
  r.setProperty('--color-popover',             u.surface);
  r.setProperty('--color-popover-foreground',  u.text1);
  r.setProperty('--color-primary',             u.accent);
  r.setProperty('--color-primary-foreground',  u.base);
  r.setProperty('--color-secondary',           u.surfaceUp);
  r.setProperty('--color-secondary-foreground',u.text1);
  r.setProperty('--color-accent',              u.accentDim);
  r.setProperty('--color-accent-foreground',   u.accentHi);
  r.setProperty('--color-muted',               u.surfaceUp);
  r.setProperty('--color-muted-foreground',    u.text2);
  r.setProperty('--color-destructive',         s.red);
  r.setProperty('--color-border',              u.panelGlassBorder);
  r.setProperty('--color-input',               u.accentDim);
  r.setProperty('--color-ring',                `${u.accent}40`);
  r.setProperty('--color-text-1',              u.text1);
  r.setProperty('--color-text-2',              u.text2);
  r.setProperty('--color-text-3',              u.text3);
  r.setProperty('--color-text-4',              u.text4);
  r.setProperty('--color-gold',                u.accent);
  r.setProperty('--color-gold-hi',             u.accentHi);
  r.setProperty('--color-red',                 s.red);
  r.setProperty('--color-green',               s.green);
  r.setProperty('--color-teal',                s.teal);
  r.setProperty('--color-amber',               s.amber);
  r.setProperty('--color-purple',              s.purple);
  r.setProperty('--color-blue',                s.blue);

  // ── Selection ──
  r.setProperty('--selection-bg', u.selectionBg);
}

// ═══════════════════════════════════════════════════════════════
// Load persisted theme
// ═══════════════════════════════════════════════════════════════

function loadPersistedTheme(): ThemeProfile {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && THEME_MAP[saved]) return THEME_MAP[saved];
  } catch { /* ignore */ }
  return ORO_DIVINO;
}

// ═══════════════════════════════════════════════════════════════
// Store
// ═══════════════════════════════════════════════════════════════

export const useThemeStore = create<ThemeState>((set) => {
  const initial = loadPersistedTheme();
  // Apply on load
  if (typeof document !== 'undefined') {
    applyCssVars(initial);
  }

  return {
    profile: initial,
    themeId: initial.id,

    setTheme: (id: string) => {
      const profile = THEME_MAP[id];
      if (!profile) return;
      applyCssVars(profile);
      try { localStorage.setItem(LS_KEY, id); } catch { /* ignore */ }
      set({ profile, themeId: id });
    },
  };
});

// ═══════════════════════════════════════════════════════════════
// Selectors (for Three.js components to subscribe efficiently)
// ═══════════════════════════════════════════════════════════════

export const selectViewport = (s: ThemeState) => s.profile.viewport;
export const selectMaterial = (s: ThemeState) => s.profile.material;
export const selectStep     = (s: ThemeState) => s.profile.step;
export const selectUi       = (s: ThemeState) => s.profile.ui;
export const selectSemantic = (s: ThemeState) => s.profile.semantic;
