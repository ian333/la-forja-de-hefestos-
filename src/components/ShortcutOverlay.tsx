/**
 * ⚒️ La Forja — Shortcut Overlay (S Key)
 * =========================================
 * Fusion 360's "S" key shortcut box: a floating mini-toolbar
 * that appears at the cursor with customizable quick-access tools.
 */

import { useState, useEffect, useRef } from 'react';

export interface ShortcutTool {
  label: string;
  icon: string;
  shortcut: string;
  action: () => void;
}

interface ShortcutOverlayProps {
  tools: ShortcutTool[];
  position: { x: number; y: number };
  onClose: () => void;
}

export default function ShortcutOverlay({ tools, position, onClose }: ShortcutOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = tools.filter(t =>
    t.label.toLowerCase().includes(filter.toLowerCase()) ||
    t.shortcut.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('mousedown', handleClick, true);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('mousedown', handleClick, true);
    };
  }, [onClose]);

  const x = Math.max(120, Math.min(window.innerWidth - 120, position.x));
  const y = Math.max(40, Math.min(window.innerHeight - 200, position.y));

  return (
    <div className="fixed inset-0 z-[9997]">
      <div
        ref={ref}
        className="absolute rounded-xl overflow-hidden"
        style={{
          left: x,
          top: y,
          transform: 'translate(-50%, 0)',
          minWidth: 220,
          background: 'rgba(8,9,13,0.80)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(32px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(32px) saturate(1.4)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.08)',
        }}
      >
        {/* Search */}
        <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="text-[10px] text-[#4a4035]">⌨</span>
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Herramienta..."
            className="flex-1 bg-transparent text-[12px] text-[#f0ece4] placeholder-[#4a4035] outline-none"
          />
        </div>

        {/* Tools grid */}
        <div className="grid grid-cols-4 gap-px p-1">
          {filtered.map((tool, i) => (
            <button
              key={i}
              onClick={() => { tool.action(); onClose(); }}
              className="flex flex-col items-center justify-center py-2 px-1.5 rounded-lg hover:bg-[#c9a84c]/10 transition-all group"
              title={`${tool.label} (${tool.shortcut})`}
            >
              <span className="text-[16px] group-hover:text-[#c9a84c] text-[#6b6050] transition-all">
                {tool.icon}
              </span>
              <span className="text-[9px] text-[#6b6050] group-hover:text-[#c9a84c] mt-0.5 leading-tight font-medium">
                {tool.label}
              </span>
              <span className="text-[7px] text-[#4a4035] font-mono">{tool.shortcut}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
