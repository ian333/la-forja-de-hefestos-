/**
 * ⚒️ La Forja — Theme Profiles (Color System)
 * ==============================================
 * Defines the complete color architecture for every surface in the app:
 * UI chrome, 3D viewport, SDF materials, STEP imports, and semantic colors.
 *
 * Each profile is a complete, self-contained design — swap one, everything changes.
 * Simple API: pick a profile → everything updates.
 *
 * LIGHTNESS GUIDE (base color luminance):
 *   Forja Oscura  ~8%   — dramatic OLED
 *   Obsidiana      ~10%  — pure dark minimal
 *   Oro Divino     ~12%  — default, navy + gold
 *   Titanio        ~12%  — industrial blue
 *   Cobre          ~11%  — warm forge
 *   Nórdico        ~18%  — lightest, airy
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** RGB triplet normalized 0–1 (for GLSL / Three.js) */
export type RGB = [number, number, number];

export interface ThemeProfile {
  id: string;
  name: string;
  description: string;
  icon: string;

  // ── UI Chrome ──
  ui: {
    base: string;
    surface: string;
    surfaceUp: string;
    surfaceTop: string;
    overlay: string;
    raised: string;
    border: string;
    borderSub: string;
    borderHi: string;
    text1: string;
    text2: string;
    text3: string;
    text4: string;
    accent: string;
    accentHi: string;
    accentDim: string;     // rgba — subtle accent background
    accentGlow: string;    // rgba — glow effect color
    accentWarm: string;    // darker accent for depth
    panelGlass: string;    // rgba — glass panel bg
    panelGlassBorder: string;
    panelShadow: string;
    selectionBg: string;   // rgba — text selection
  };

  // ── 3D Viewport ──
  viewport: {
    gridCellColor: string;
    gridSectionColor: string;
    axisOpacity: number;
    bgTop: RGB;
    bgMid: RGB;
    bgBottom: RGB;
    gizmoBg: string;
    gizmoText: string;
    gizmoHover: string;
    gizmoStroke: string;
  };

  // ── SDF Ray March Material ──
  material: {
    base: RGB;
    roughness: number;
    ambient: RGB;
    envColor: RGB;
    fresnelStrength: number;
  };

  // ── STEP/CAD Import Defaults ──
  step: {
    defaultColor: string;    // hex — fallback when STEP has no color
    metalness: number;
    roughness: number;
    envMapIntensity: number;
  };

  // ── Semantic Colors (consistent across themes unless overridden) ──
  semantic: {
    red: string;
    green: string;
    teal: string;
    amber: string;
    purple: string;
    blue: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// Helper: hex → RGB [0-1]
// ═══════════════════════════════════════════════════════════════

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ═══════════════════════════════════════════════════════════════
// Profiles
// ═══════════════════════════════════════════════════════════════

/**
 * 1. ORO DIVINO — Deep navy + divine gold
 *    The original La Forja identity, refined.
 *    Navy backgrounds (clearly not black!), warm gold accents.
 */
export const ORO_DIVINO: ThemeProfile = {
  id: 'oro-divino',
  name: 'Oro Divino',
  description: 'Navy profundo + oro divino — la identidad de La Forja',
  icon: '⚜️',

  ui: {
    base:            '#181d2e',
    surface:         '#1e2538',
    surfaceUp:       '#272f46',
    surfaceTop:      '#2f3852',
    overlay:         '#2f3852',
    raised:          '#38425e',
    border:          '#2c2818',
    borderSub:       '#201e14',
    borderHi:        '#3e3624',
    text1:           '#f0ece4',
    text2:           '#a0947e',
    text3:           '#6a5e4e',
    text4:           '#3e362c',
    accent:          '#d4b050',
    accentHi:        '#ead080',
    accentDim:       'rgba(212,176,80,0.12)',
    accentGlow:      'rgba(212,176,80,0.08)',
    accentWarm:      '#c4a040',
    panelGlass:      'rgba(24,29,46,0.72)',
    panelGlassBorder:'rgba(212,176,80,0.10)',
    panelShadow:     '0 8px 32px rgba(0,0,0,0.45), 0 0 1px rgba(212,176,80,0.06)',
    selectionBg:     'rgba(212,176,80,0.25)',
  },

  viewport: {
    gridCellColor:    '#1a2030',
    gridSectionColor: '#262e42',
    axisOpacity:      0.18,
    bgTop:    [0.16, 0.19, 0.27],
    bgMid:    [0.24, 0.27, 0.35],
    bgBottom: [0.11, 0.12, 0.17],
    gizmoBg:     '#1e2538',
    gizmoText:   '#8090a8',
    gizmoHover:  '#d4b050',
    gizmoStroke: '#2a3248',
  },

  material: {
    base:            [0.62, 0.67, 0.76],
    roughness:       0.30,
    ambient:         [0.10, 0.12, 0.18],
    envColor:        [0.30, 0.36, 0.46],
    fresnelStrength: 0.12,
  },

  step: {
    defaultColor:    '#9094aa',
    metalness:       0.2,
    roughness:       0.5,
    envMapIntensity: 1.0,
  },

  semantic: {
    red:    '#f87171',
    green:  '#4ade80',
    teal:   '#22d3ee',
    amber:  '#fbbf24',
    purple: '#c084fc',
    blue:   '#60a5fa',
  },
};

/**
 * 2. OBSIDIANA — Neutral dark + platinum/silver
 *    Minimal, elegant. Almost monochrome.
 */
export const OBSIDIANA: ThemeProfile = {
  id: 'obsidiana',
  name: 'Obsidiana',
  description: 'Gris neutro + platino — minimalismo absoluto',
  icon: '🖤',

  ui: {
    base:            '#17171c',
    surface:         '#1e1e24',
    surfaceUp:       '#26262e',
    surfaceTop:      '#2e2e38',
    overlay:         '#2e2e38',
    raised:          '#373742',
    border:          '#2a2a34',
    borderSub:       '#20202a',
    borderHi:        '#464650',
    text1:           '#ececef',
    text2:           '#9a9aa6',
    text3:           '#6a6a78',
    text4:           '#4a4a56',
    accent:          '#bbbbc8',
    accentHi:        '#dddde8',
    accentDim:       'rgba(187,187,200,0.10)',
    accentGlow:      'rgba(187,187,200,0.07)',
    accentWarm:      '#a0a0b2',
    panelGlass:      'rgba(23,23,28,0.72)',
    panelGlassBorder:'rgba(255,255,255,0.08)',
    panelShadow:     '0 8px 32px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.06)',
    selectionBg:     'rgba(187,187,200,0.22)',
  },

  viewport: {
    gridCellColor:    '#191920',
    gridSectionColor: '#22222c',
    axisOpacity:      0.14,
    bgTop:    [0.12, 0.12, 0.15],
    bgMid:    [0.20, 0.20, 0.24],
    bgBottom: [0.08, 0.08, 0.10],
    gizmoBg:     '#1e1e24',
    gizmoText:   '#787888',
    gizmoHover:  '#dddde8',
    gizmoStroke: '#2a2a34',
  },

  material: {
    base:            [0.72, 0.72, 0.76],
    roughness:       0.25,
    ambient:         [0.10, 0.10, 0.14],
    envColor:        [0.32, 0.32, 0.38],
    fresnelStrength: 0.15,
  },

  step: {
    defaultColor:    '#a8a8b4',
    metalness:       0.3,
    roughness:       0.4,
    envMapIntensity: 1.2,
  },

  semantic: {
    red:    '#ef4444',
    green:  '#22c55e',
    teal:   '#06b6d4',
    amber:  '#f59e0b',
    purple: '#a855f7',
    blue:   '#3b82f6',
  },
};

/**
 * 3. TITANIO — Industrial blue-gray + cyan
 *    Clean engineering feel.
 */
export const TITANIO: ThemeProfile = {
  id: 'titanio',
  name: 'Titanio',
  description: 'Azul-gris industrial + cian — ingeniería limpia',
  icon: '⚙️',

  ui: {
    base:            '#151b26',
    surface:         '#1c2432',
    surfaceUp:       '#242e3e',
    surfaceTop:      '#2e3a4c',
    overlay:         '#2e3a4c',
    raised:          '#384658',
    border:          '#263242',
    borderSub:       '#1c2834',
    borderHi:        '#3a4e64',
    text1:           '#e8ecf2',
    text2:           '#8c9cb4',
    text3:           '#607284',
    text4:           '#3e5060',
    accent:          '#2ce0f8',
    accentHi:        '#70ecff',
    accentDim:       'rgba(44,224,248,0.10)',
    accentGlow:      'rgba(44,224,248,0.07)',
    accentWarm:      '#18b8d4',
    panelGlass:      'rgba(21,27,38,0.72)',
    panelGlassBorder:'rgba(44,224,248,0.08)',
    panelShadow:     '0 8px 32px rgba(0,0,0,0.45), 0 0 1px rgba(44,224,248,0.06)',
    selectionBg:     'rgba(44,224,248,0.22)',
  },

  viewport: {
    gridCellColor:    '#172028',
    gridSectionColor: '#222e3c',
    axisOpacity:      0.18,
    bgTop:    [0.12, 0.16, 0.22],
    bgMid:    [0.20, 0.26, 0.34],
    bgBottom: [0.08, 0.10, 0.14],
    gizmoBg:     '#1c2432',
    gizmoText:   '#708498',
    gizmoHover:  '#2ce0f8',
    gizmoStroke: '#263242',
  },

  material: {
    base:            [0.58, 0.65, 0.74],
    roughness:       0.28,
    ambient:         [0.08, 0.11, 0.16],
    envColor:        [0.24, 0.32, 0.44],
    fresnelStrength: 0.14,
  },

  step: {
    defaultColor:    '#7898b2',
    metalness:       0.35,
    roughness:       0.4,
    envMapIntensity: 1.1,
  },

  semantic: {
    red:    '#f87171',
    green:  '#4ade80',
    teal:   '#22d3ee',
    amber:  '#fbbf24',
    purple: '#a78bfa',
    blue:   '#60a5fa',
  },
};

/**
 * 4. COBRE — Warm dark + copper/amber
 *    Earthy, warm tones. Like a real forge.
 */
export const COBRE: ThemeProfile = {
  id: 'cobre',
  name: 'Cobre',
  description: 'Oscuro cálido + cobre — como una forja real',
  icon: '🔥',

  ui: {
    base:            '#1c1814',
    surface:         '#24201a',
    surfaceUp:       '#2e2822',
    surfaceTop:      '#38302a',
    overlay:         '#38302a',
    raised:          '#443a32',
    border:          '#322a20',
    borderSub:       '#241e16',
    borderHi:        '#4c3e34',
    text1:           '#f2ebe0',
    text2:           '#aa9878',
    text3:           '#746454',
    text4:           '#4c4034',
    accent:          '#e0905e',
    accentHi:        '#f0b088',
    accentDim:       'rgba(224,144,94,0.12)',
    accentGlow:      'rgba(224,144,94,0.08)',
    accentWarm:      '#cc7848',
    panelGlass:      'rgba(28,24,20,0.72)',
    panelGlassBorder:'rgba(224,144,94,0.08)',
    panelShadow:     '0 8px 32px rgba(0,0,0,0.45), 0 0 1px rgba(224,144,94,0.06)',
    selectionBg:     'rgba(224,144,94,0.25)',
  },

  viewport: {
    gridCellColor:    '#1a1610',
    gridSectionColor: '#26201a',
    axisOpacity:      0.16,
    bgTop:    [0.14, 0.12, 0.10],
    bgMid:    [0.24, 0.20, 0.17],
    bgBottom: [0.10, 0.08, 0.07],
    gizmoBg:     '#24201a',
    gizmoText:   '#887868',
    gizmoHover:  '#e0905e',
    gizmoStroke: '#322a20',
  },

  material: {
    base:            [0.70, 0.60, 0.52],
    roughness:       0.35,
    ambient:         [0.12, 0.10, 0.08],
    envColor:        [0.36, 0.28, 0.22],
    fresnelStrength: 0.10,
  },

  step: {
    defaultColor:    '#a89080',
    metalness:       0.25,
    roughness:       0.55,
    envMapIntensity: 0.9,
  },

  semantic: {
    red:    '#f87171',
    green:  '#4ade80',
    teal:   '#22d3ee',
    amber:  '#fbbf24',
    purple: '#c084fc',
    blue:   '#60a5fa',
  },
};

/**
 * 5. NÓRDICO — Lightest dark theme + ice blue
 *    Airy, clean. Closest to medium gray.
 */
export const NORDICO: ThemeProfile = {
  id: 'nordico',
  name: 'Nórdico',
  description: 'Gris azulado claro + azul hielo — limpio y despejado',
  icon: '❄️',

  ui: {
    base:            '#232940',
    surface:         '#2a324e',
    surfaceUp:       '#343e5c',
    surfaceTop:      '#3e4a68',
    overlay:         '#3e4a68',
    raised:          '#4a5878',
    border:          '#384260',
    borderSub:       '#2c344e',
    borderHi:        '#526080',
    text1:           '#e8ecf4',
    text2:           '#9ca8c2',
    text3:           '#6e7e9a',
    text4:           '#4e5c76',
    accent:          '#88b8ff',
    accentHi:        '#b0d4ff',
    accentDim:       'rgba(136,184,255,0.10)',
    accentGlow:      'rgba(136,184,255,0.07)',
    accentWarm:      '#6898e4',
    panelGlass:      'rgba(35,41,64,0.65)',
    panelGlassBorder:'rgba(136,184,255,0.08)',
    panelShadow:     '0 8px 32px rgba(0,0,0,0.35), 0 0 1px rgba(136,184,255,0.06)',
    selectionBg:     'rgba(136,184,255,0.22)',
  },

  viewport: {
    gridCellColor:    '#202840',
    gridSectionColor: '#2c364e',
    axisOpacity:      0.22,
    bgTop:    [0.18, 0.22, 0.32],
    bgMid:    [0.28, 0.32, 0.42],
    bgBottom: [0.13, 0.15, 0.22],
    gizmoBg:     '#2a324e',
    gizmoText:   '#7888a4',
    gizmoHover:  '#88b8ff',
    gizmoStroke: '#384260',
  },

  material: {
    base:            [0.68, 0.73, 0.82],
    roughness:       0.26,
    ambient:         [0.14, 0.16, 0.22],
    envColor:        [0.38, 0.44, 0.56],
    fresnelStrength: 0.13,
  },

  step: {
    defaultColor:    '#90a0b8',
    metalness:       0.2,
    roughness:       0.45,
    envMapIntensity: 1.0,
  },

  semantic: {
    red:    '#f87171',
    green:  '#4ade80',
    teal:   '#22d3ee',
    amber:  '#fbbf24',
    purple: '#a78bfa',
    blue:   '#60a5fa',
  },
};

/**
 * 6. FORJA OSCURA — OLED-ish black + ember red
 *    Maximum contrast, dramatic. Darkest theme.
 */
export const FORJA_OSCURA: ThemeProfile = {
  id: 'forja-oscura',
  name: 'Forja Oscura',
  description: 'Negro OLED + rojo brasa — contraste máximo',
  icon: '🌑',

  ui: {
    base:            '#0e0e12',
    surface:         '#161618',
    surfaceUp:       '#1e1e24',
    surfaceTop:      '#28282e',
    overlay:         '#28282e',
    raised:          '#303038',
    border:          '#261a1e',
    borderSub:       '#1c1216',
    borderHi:        '#3e2c32',
    text1:           '#f0eae8',
    text2:           '#988e8a',
    text3:           '#686060',
    text4:           '#443e3c',
    accent:          '#f06050',
    accentHi:        '#ff8878',
    accentDim:       'rgba(240,96,80,0.10)',
    accentGlow:      'rgba(240,96,80,0.07)',
    accentWarm:      '#d44a3c',
    panelGlass:      'rgba(14,14,18,0.78)',
    panelGlassBorder:'rgba(240,96,80,0.08)',
    panelShadow:     '0 8px 32px rgba(0,0,0,0.65), 0 0 1px rgba(240,96,80,0.06)',
    selectionBg:     'rgba(240,96,80,0.25)',
  },

  viewport: {
    gridCellColor:    '#101014',
    gridSectionColor: '#1a1a1e',
    axisOpacity:      0.14,
    bgTop:    [0.07, 0.07, 0.09],
    bgMid:    [0.14, 0.13, 0.15],
    bgBottom: [0.04, 0.04, 0.05],
    gizmoBg:     '#161618',
    gizmoText:   '#6a6466',
    gizmoHover:  '#f06050',
    gizmoStroke: '#261a1e',
  },

  material: {
    base:            [0.62, 0.60, 0.58],
    roughness:       0.35,
    ambient:         [0.08, 0.07, 0.07],
    envColor:        [0.24, 0.20, 0.20],
    fresnelStrength: 0.10,
  },

  step: {
    defaultColor:    '#908c88',
    metalness:       0.2,
    roughness:       0.55,
    envMapIntensity: 0.8,
  },

  semantic: {
    red:    '#ef4444',
    green:  '#22c55e',
    teal:   '#06b6d4',
    amber:  '#f59e0b',
    purple: '#a855f7',
    blue:   '#3b82f6',
  },
};

// ═══════════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════════

export const THEME_PROFILES: ThemeProfile[] = [
  ORO_DIVINO,
  OBSIDIANA,
  TITANIO,
  COBRE,
  NORDICO,
  FORJA_OSCURA,
];

export const THEME_MAP: Record<string, ThemeProfile> = Object.fromEntries(
  THEME_PROFILES.map(p => [p.id, p]),
);

export const DEFAULT_THEME_ID = 'oro-divino';
