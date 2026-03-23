/**
 * ⚒️ La Forja — Toolbar Dropdown
 * =================================
 * Dropdown menus for the toolbar — click a group header to expand.
 * Used for "Crear", "Modificar", "CSG", etc.
 */

import { useState, useRef, useEffect } from 'react';

export interface ToolbarDropdownItem {
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  divider?: boolean;
}

interface ToolbarDropdownProps {
  label: string;
  icon?: string;
  items: ToolbarDropdownItem[];
  compact?: boolean;
}

export default function ToolbarDropdown({ label, icon, items, compact }: ToolbarDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handle);
    return () => window.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-all duration-200 ${
          open
            ? 'text-[#e2c97e]'
            : 'text-[#6b6050] hover:text-[#c9a84c]'
        } ${compact ? 'px-2' : ''}`}
        style={open ? { background: 'rgba(201,168,76,0.08)', boxShadow: '0 0 12px rgba(201,168,76,0.06)' } : {}}
      >
        {icon && <span className="text-[12px]">{icon}</span>}
        <span className="font-medium tracking-wide" style={{ letterSpacing: '0.06em' }}>{label}</span>
        <svg viewBox="0 0 8 5" className={`w-2 h-1.5 ml-0.5 transition-transform duration-200 ${open ? 'rotate-180 opacity-60' : 'opacity-30'}`} fill="currentColor">
          <path d="M0 0l4 5 4-5z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 rounded-xl py-1.5 min-w-[220px] z-50 animate-borderGlow"
          style={{ background: 'rgba(10,12,18,0.85)', border: '1px solid rgba(201,168,76,0.10)', backdropFilter: 'blur(28px) saturate(1.4)', boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 1px rgba(201,168,76,0.12), 0 0 30px rgba(201,168,76,0.03)', animation: 'fadeIn 150ms ease-out, borderGlow 4s ease-in-out infinite' }}
        >
          {items.map((item, i) => (
            item.divider ? (
              <div key={i} className="h-px my-1 mx-3" style={{ background: 'rgba(201,168,76,0.06)' }} />
            ) : (
              <button
                key={i}
                onClick={() => { item.action(); setOpen(false); }}
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 px-3.5 py-2 text-left text-[12px] rounded-md mx-1 transition-all duration-150 ${
                  item.disabled
                    ? 'text-[#2a2520] cursor-not-allowed'
                    : 'text-[#8a7e6b] hover:bg-[#c9a84c]/[0.06] hover:text-[#e2c97e]'
                }`}
                style={{ maxWidth: 'calc(100% - 8px)' }}
              >
                <span className="text-[13px] w-5 text-center opacity-50">{item.icon}</span>
                <span className="flex-1 font-medium">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[9px] text-[#4a4035] font-mono ml-2">{item.shortcut}</span>
                )}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}
