/**
 * FloatingPanel — panel flotante colapsable con glass morphism.
 *
 * Diseñado para overlay CAD-like sobre un viewport 3D. El panel puede
 * colapsarse a un pequeño badge, liberando área del viewport cuando
 * no se necesita. Click en la cabecera para colapsar/expandir.
 */

import { useState, type ReactNode } from 'react';

interface FloatingPanelProps {
  title: string;
  icon?: string;
  children: ReactNode;
  /** Arranca colapsado (solo badge visible) */
  defaultCollapsed?: boolean;
  /** Ancho cuando está expandido */
  width?: string;
  /** Clase de posición tailwind (ej. 'top-4 left-4') */
  position: string;
  /** Accent bar color (top indicator) */
  accent?: string;
}

export default function FloatingPanel({
  title, icon, children, defaultCollapsed = false,
  width = '280px', position, accent = '#4FC3F7',
}: FloatingPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={`absolute ${position} z-20 transition-all duration-200`}
      style={{ width: collapsed ? 'auto' : width }}
    >
      <div
        className="rounded-xl border border-white/10 bg-[#0B0F17]/80 backdrop-blur-xl overflow-hidden shadow-2xl"
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.04] transition"
        >
          {/* Accent bar */}
          <div
            className="w-0.5 h-5 rounded-full"
            style={{ background: accent }}
          />
          {icon && <span className="text-[14px]">{icon}</span>}
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8] flex-1">
            {title}
          </span>
          <span className="text-[#64748B] text-[12px] font-mono">
            {collapsed ? '▸' : '▾'}
          </span>
        </button>
        {!collapsed && (
          <div className="border-t border-white/[0.06] p-3">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
