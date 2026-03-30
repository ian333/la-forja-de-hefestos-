/**
 * ⚒️ La Forja — Theme Panel
 * ===========================
 * Settings panel for choosing color profiles.
 * Simple: click a theme card → everything changes.
 * Shows a live mini-preview of each profile's palette.
 */

import { useThemeStore } from '@/lib/useThemeStore';
import { THEME_PROFILES, type ThemeProfile, type RGB } from '@/lib/theme-profiles';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// ═══════════════════════════════════════════════════════════════
// Mini Preview — shows a tiny representation of the theme
// ═══════════════════════════════════════════════════════════════

function rgbToCss([r, g, b]: RGB): string {
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}

function ThemePreview({ profile, isActive }: { profile: ThemeProfile; isActive: boolean }) {
  const u = profile.ui;
  const v = profile.viewport;
  const m = profile.material;

  return (
    <div
      className="relative rounded-lg overflow-hidden"
      style={{
        width: '100%',
        aspectRatio: '16/10',
        background: u.base,
        border: `1.5px solid ${isActive ? u.accent : u.border}`,
        boxShadow: isActive
          ? `0 0 16px ${u.accentDim}, 0 4px 16px rgba(0,0,0,0.4)`
          : '0 4px 16px rgba(0,0,0,0.3)',
        transition: 'all 200ms ease',
      }}
    >
      {/* Viewport background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${rgbToCss(v.bgTop)} 0%, ${rgbToCss(v.bgMid)} 55%, ${rgbToCss(v.bgBottom)} 100%)`,
        }}
      />

      {/* Grid lines hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '25%',
          left: '10%',
          right: '10%',
          height: 1,
          background: v.gridSectionColor,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '35%',
          left: '15%',
          right: '15%',
          height: 1,
          background: v.gridSectionColor,
          opacity: 0.3,
        }}
      />

      {/* 3D object hint (circle representing the SDF material) */}
      <div
        style={{
          position: 'absolute',
          top: '22%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '32%',
          aspectRatio: '1',
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${rgbToCss([
            Math.min(1, m.base[0] * 1.4),
            Math.min(1, m.base[1] * 1.4),
            Math.min(1, m.base[2] * 1.4),
          ])}, ${rgbToCss(m.base)} 60%, ${rgbToCss([
            m.base[0] * 0.4,
            m.base[1] * 0.4,
            m.base[2] * 0.4,
          ])} 100%)`,
          boxShadow: `0 4px 12px rgba(0,0,0,0.4)`,
        }}
      />

      {/* Header bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '12%',
          background: u.panelGlass,
          borderBottom: `1px solid ${u.panelGlassBorder}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '6%',
          gap: '4%',
        }}
      >
        {/* Tiny accent dot */}
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: u.accent }} />
        <div style={{ width: '30%', height: 2, borderRadius: 1, background: u.text3, opacity: 0.6 }} />
      </div>

      {/* Side panel hint */}
      <div
        style={{
          position: 'absolute',
          top: '12%',
          left: 0,
          width: '18%',
          bottom: '15%',
          background: u.panelGlass,
          borderRight: `1px solid ${u.panelGlassBorder}`,
        }}
      >
        {[0.3, 0.5, 0.4, 0.35].map((w, i) => (
          <div
            key={i}
            style={{
              margin: `${i === 0 ? 14 : 4}% 12%`,
              height: 2,
              width: `${w * 100}%`,
              borderRadius: 1,
              background: i === 0 ? u.accent : u.text3,
              opacity: i === 0 ? 0.6 : 0.3,
            }}
          />
        ))}
      </div>

      {/* Bottom timeline hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '13%',
          background: u.panelGlass,
          borderTop: `1px solid ${u.panelGlassBorder}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8%',
          gap: '3%',
        }}
      >
        {[u.accent, u.text3, u.text3, u.text3].map((c, i) => (
          <div key={i} style={{ width: 4, height: 4, borderRadius: 2, background: c, opacity: i === 0 ? 0.8 : 0.3 }} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Color Swatches — small palette preview
// ═══════════════════════════════════════════════════════════════

function PaletteSwatches({ profile }: { profile: ThemeProfile }) {
  const colors = [
    profile.ui.accent,
    profile.ui.accentHi,
    profile.ui.text1,
    profile.ui.text2,
    profile.ui.surface,
    profile.ui.base,
  ];

  return (
    <div className="flex gap-0.5 mt-1.5">
      {colors.map((c, i) => (
        <div
          key={i}
          style={{
            width: 12,
            height: 6,
            borderRadius: i === 0 ? '3px 0 0 3px' : i === colors.length - 1 ? '0 3px 3px 0' : 0,
            background: c,
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Theme Card
// ═══════════════════════════════════════════════════════════════

function ThemeCard({ profile, isActive, onSelect }: {
  profile: ThemeProfile;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="text-left rounded-xl p-2 transition-all duration-200 outline-none group"
      style={{
        background: isActive ? 'var(--c-accent-dim, rgba(201,168,76,0.08))' : 'transparent',
        border: `1px solid ${isActive ? 'var(--c-accent, #c9a84c)' : 'rgba(255,255,255,0.04)'}`,
        opacity: isActive ? 1 : 0.85,
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
          e.currentTarget.style.opacity = '1';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.opacity = '0.85';
        }
      }}
    >
      <ThemePreview profile={profile} isActive={isActive} />
      <div className="mt-2 flex items-center gap-1.5 px-0.5">
        <span className="text-sm">{profile.icon}</span>
        <span
          className="text-[12px] font-medium"
          style={{ color: isActive ? 'var(--c-accent-hi, #e2c97e)' : 'var(--c-text-1, #f0ece4)' }}
        >
          {profile.name}
        </span>
        {isActive && (
          <span
            className="ml-auto text-[9px] font-semibold tracking-wider uppercase"
            style={{ color: 'var(--c-accent, #c9a84c)' }}
          >
            activo
          </span>
        )}
      </div>
      <p
        className="text-[10px] mt-0.5 px-0.5 leading-tight"
        style={{ color: 'var(--c-text-3, #4a4035)' }}
      >
        {profile.description}
      </p>
      <PaletteSwatches profile={profile} />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Panel
// ═══════════════════════════════════════════════════════════════

interface ThemePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ThemePanel({ open, onOpenChange }: ThemePanelProps) {
  const themeId = useThemeStore(s => s.themeId);
  const setTheme = useThemeStore(s => s.setTheme);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[660px] p-0 overflow-hidden"
        style={{
          background: 'var(--c-surface, #0d0f14)',
          border: '1px solid var(--panel-glass-border, rgba(201,168,76,0.06))',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <DialogHeader className="px-6 pt-5 pb-2">
          <DialogTitle
            className="text-[14px] font-semibold tracking-wide"
            style={{ color: 'var(--c-text-1, #f0ece4)' }}
          >
            ⚒️ Perfiles de Color
          </DialogTitle>
          <DialogDescription
            className="text-[11px]"
            style={{ color: 'var(--c-text-3, #4a4035)' }}
          >
            Selecciona un perfil para cambiar toda la interfaz, viewport 3D y materiales de un solo clic.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 pt-2">
          <div className="grid grid-cols-3 gap-3">
            {THEME_PROFILES.map(profile => (
              <ThemeCard
                key={profile.id}
                profile={profile}
                isActive={profile.id === themeId}
                onSelect={() => setTheme(profile.id)}
              />
            ))}
          </div>

          {/* Hint */}
          <p
            className="text-[10px] mt-4 text-center"
            style={{ color: 'var(--c-text-4, #2a2520)' }}
          >
            Los perfiles controlan: UI, viewport 3D, materiales SDF, modelos STEP y sombreado.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
