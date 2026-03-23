/**
 * ⚒️ La Forja — Command Palette
 * ===============================
 * Ctrl+Shift+P opens a searchable command palette (like VS Code / Fusion 360 search).
 * Lists all available commands with keyboard shortcuts. Fuzzy-searches.
 */

import { useState, useEffect, useRef, useMemo, type ReactElement } from 'react';

export interface Command {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  category?: string;
  action: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function highlightMatch(query: string, text: string): ReactElement {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx >= 0) {
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-[#c9a84c] font-medium">{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </>
    );
  }
  return <>{text}</>;
}

export default function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query) return commands;
    return commands.filter(c =>
      fuzzyMatch(query, c.label) ||
      fuzzyMatch(query, c.category ?? '') ||
      fuzzyMatch(query, c.id)
    );
  }, [query, commands]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const cmd of filtered) {
      const cat = cmd.category ?? 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(cmd);
    }
    return map;
  }, [filtered]);

  useEffect(() => {
    inputRef.current?.focus();
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIdx]) {
        filtered[selectedIdx].action();
        onClose();
      }
    }
  };

  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[9998] flex justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="w-[540px] max-h-[60vh] rounded-2xl flex flex-col overflow-hidden animate-in"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(8,9,13,0.82)',
          border: '1px solid rgba(201,168,76,0.08)',
          backdropFilter: 'blur(40px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 1px rgba(201,168,76,0.10)',
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid rgba(201,168,76,0.05)' }}>
          <svg viewBox="0 0 16 16" className="w-4 h-4 text-[#c9a84c] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="5" />
            <line x1="11" y1="11" x2="14" y2="14" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar comando..."
            className="flex-1 bg-transparent text-[14px] text-[#f0ece4] placeholder-[#4a4035] outline-none"
          />
          <kbd className="text-[10px] text-[#4a4035] bg-white/[0.03] border border-white/[0.06] rounded-md px-2 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-[13px] text-[#4a4035]">
              No se encontraron comandos
            </div>
          )}
          {Array.from(grouped.entries()).map(([category, cmds]) => (
            <div key={category}>
              <div className="px-4 py-1.5 text-[10px] text-[#4a4035] uppercase tracking-wider font-semibold">
                {category}
              </div>
              {cmds.map(cmd => {
                const idx = flatIdx++;
                const isSelected = idx === selectedIdx;
                return (
                  <button
                    key={cmd.id}
                    data-idx={idx}
                    onClick={() => { cmd.action(); onClose(); }}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-all ${
                      isSelected
                        ? 'bg-[#c9a84c]/8 text-[#f0ece4]'
                        : 'text-[#8a7e6b] hover:bg-white/[0.02]'
                    }`}
                  >
                    {cmd.icon && (
                      <span className={`text-[14px] w-5 text-center ${isSelected ? 'text-[#c9a84c]' : 'text-[#4a4035]'}`}>
                        {cmd.icon}
                      </span>
                    )}
                    <span className="flex-1 text-[12px] truncate">
                      {highlightMatch(query, cmd.label)}
                    </span>
                    {cmd.shortcut && (
                      <kbd className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                        isSelected
                          ? 'text-[#c9a84c] bg-[#c9a84c]/5 border-[#c9a84c]/15'
                          : 'text-[#2a2520] bg-white/[0.02] border-white/[0.05]'
                      }`}>
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 flex items-center gap-4 text-[10px] text-[#4a4035]" style={{ borderTop: '1px solid rgba(201,168,76,0.04)' }}>
          <span>↑↓ Navegar</span>
          <span>↵ Ejecutar</span>
          <span>Esc Cerrar</span>
          <span className="flex-1" />
          <span>{filtered.length} comandos</span>
        </div>
      </div>
    </div>
  );
}
