/**
 * ⚒️ La Forja de Hefestos — Omnibar
 * ====================================
 * Universal command bar. Search/execute ANY function:
 * commands, primitives, materials, colors, properties, export, import, settings.
 * Trigger: Ctrl+K or `/` or click the search field.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// ── Types ──

export interface OmniAction {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  category: string;
  keywords?: string[];        // Extra search terms
  shortcut?: string;
  disabled?: boolean;
  action: () => void;
}

interface OmnibarProps {
  actions: OmniAction[];
  open: boolean;
  onClose: () => void;
  placeholder?: string;
}

// ── Fuzzy search ──

function searchScore(query: string, action: OmniAction): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;

  const targets = [
    action.label,
    action.description ?? '',
    action.category,
    ...(action.keywords ?? []),
  ];

  let bestScore = 0;
  for (const t of targets) {
    const tl = t.toLowerCase();
    // Exact starts-with
    if (tl.startsWith(q)) bestScore = Math.max(bestScore, 100);
    // Contains
    else if (tl.includes(q)) bestScore = Math.max(bestScore, 60);
    // Fuzzy subsequence
    else {
      let qi = 0;
      for (let ti = 0; ti < tl.length && qi < q.length; ti++) {
        if (tl[ti] === q[qi]) qi++;
      }
      if (qi === q.length) bestScore = Math.max(bestScore, 30);
    }
  }
  return bestScore;
}

function highlightText(query: string, text: string) {
  if (!query) return <>{text}</>;
  const q = query.toLowerCase();
  const tl = text.toLowerCase();
  const idx = tl.indexOf(q);
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

// Category icons (SVGs)
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Crear': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />
    </svg>
  ),
  'Sketch': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 14l3-1.5L13.5 4 12 2.5 3.5 11z" /><path d="M10 5l1.5 1.5" />
    </svg>
  ),
  'Booleana': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="8" r="4" /><circle cx="10" cy="8" r="4" />
    </svg>
  ),
  'Modificar': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M12 2l2 2-8 8-3 1 1-3z" />
    </svg>
  ),
  'Material': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" /><path d="M5 6c1-1 5-1 6 0M4.5 9c1.5 1.5 5.5 1.5 7 0" />
    </svg>
  ),
  'Color': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="6" r="3" /><circle cx="10" cy="6" r="3" /><circle cx="8" cy="10" r="3" />
    </svg>
  ),
  'Archivo': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 2h6l4 4v8H3z" /><path d="M9 2v4h4" />
    </svg>
  ),
  'Editar': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 10V13h3l7-7-3-3z" />
    </svg>
  ),
  'Importar': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 2v9m0 0l-3-3m3 3l3-3M3 13h10" />
    </svg>
  ),
  'Construir': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="2" width="12" height="12" rx="1" strokeDasharray="3 2" />
    </svg>
  ),
  'Inspeccionar': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14" y2="14" />
    </svg>
  ),
  'Superficie': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 10c3-4 5 2 6-2s3-4 6-2" />
    </svg>
  ),
  'Ensamble': (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="2" width="4" height="4" rx="0.5" /><rect x="10" y="10" width="4" height="4" rx="0.5" /><path d="M6 4h4v4h4" />
    </svg>
  ),
};

// ── Component ──

export default function Omnibar({ actions, open, onClose, placeholder }: OmnibarProps) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter & sort
  const results = useMemo(() => {
    const scored = actions
      .map(a => ({ action: a, score: searchScore(query, a) }))
      .filter(x => x.score > 0 && !x.action.disabled)
      .sort((a, b) => b.score - a.score || a.action.label.localeCompare(b.action.label));
    return scored.map(x => x.action);
  }, [query, actions]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, OmniAction[]>();
    for (const a of results) {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    }
    return map;
  }, [results]);

  // Focus on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const execute = useCallback((action: OmniAction) => {
    action.action();
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIdx]) execute(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [results, selectedIdx, execute, onClose]);

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[9999]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative flex justify-center pt-[12vh]">
        <div
          className="w-[580px] max-h-[65vh] rounded-2xl flex flex-col overflow-hidden animate-scaleIn"
          onClick={e => e.stopPropagation()}
          style={{
            background: 'rgba(8,9,13,0.82)',
            border: '1px solid rgba(201,168,76,0.08)',
            backdropFilter: 'blur(40px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 1px rgba(201,168,76,0.10), 0 0 60px rgba(201,168,76,0.04)',
          }}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(201,168,76,0.05)' }}>
            <svg viewBox="0 0 16 16" className="w-4.5 h-4.5 text-[#c9a84c] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5" />
              <line x1="11" y1="11" x2="14" y2="14" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder ?? 'Buscar cualquier función, material, color, herramienta…'}
              className="flex-1 bg-transparent text-[14px] text-[#f0ece4] placeholder-[#4a4035] outline-none font-light tracking-wide"
            />
            <kbd className="text-[10px] text-[#4a4035] bg-white/[0.03] border border-white/[0.06] rounded-md px-2 py-0.5 font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="flex-1 overflow-y-auto py-2">
            {results.length === 0 && query && (
              <div className="px-5 py-12 text-center">
                <p className="text-[13px] text-[#6b6050]">Sin resultados para "{query}"</p>
                <p className="text-[11px] text-[#4a4035] mt-2">Intenta con otra búsqueda</p>
              </div>
            )}
            {Array.from(grouped.entries()).map(([category, catActions]) => (
              <div key={category} className="mb-1">
                <div className="flex items-center gap-2 px-5 py-2 text-[10px] text-[#4a4035] uppercase tracking-[0.08em] font-semibold">
                  <span className="text-[#c9a84c]/40">
                    {CATEGORY_ICONS[category] ?? CATEGORY_ICONS['Crear']}
                  </span>
                  {category}
                </div>
                {catActions.map(action => {
                  const idx = flatIdx++;
                  const isSelected = idx === selectedIdx;
                  return (
                    <button
                      key={action.id}
                      data-idx={idx}
                      onClick={() => execute(action)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-all duration-75 ${
                        isSelected
                          ? 'bg-[#c9a84c]/8 text-[#f0ece4]'
                          : 'text-[#8a7e6b] hover:bg-white/[0.02]'
                      }`}
                    >
                      {action.icon && (
                        <span className={`w-5 h-5 flex items-center justify-center rounded-md ${
                          isSelected ? 'text-[#c9a84c]' : 'text-[#4a4035]'
                        }`}>
                          {action.icon}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] truncate leading-snug font-medium">
                          {highlightText(query, action.label)}
                        </div>
                        {action.description && (
                          <div className={`text-[11px] truncate leading-snug mt-0.5 ${isSelected ? 'text-[#c9a84c]/40' : 'text-[#2a2520]'}`}>
                            {action.description}
                          </div>
                        )}
                      </div>
                      {action.shortcut && (
                        <kbd className={`text-[10px] font-mono px-2 py-0.5 rounded-md border shrink-0 ${
                          isSelected
                            ? 'text-[#c9a84c]/70 bg-[#c9a84c]/5 border-[#c9a84c]/15'
                            : 'text-[#2a2520] bg-white/[0.02] border-white/[0.05]'
                        }`}>
                          {action.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 flex items-center gap-4 text-[10px] text-[#4a4035]" style={{ borderTop: '1px solid rgba(201,168,76,0.04)' }}>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-px rounded-md bg-white/[0.03] border border-white/[0.06] text-[9px]">↑↓</kbd>
              Navegar
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-px rounded-md bg-white/[0.03] border border-white/[0.06] text-[9px]">↵</kbd>
              Ejecutar
            </span>
            <span className="flex-1" />
            <span className="text-[#c9a84c]/30 font-medium">{results.length} acciones</span>
          </div>
        </div>
      </div>
    </div>
  );
}
