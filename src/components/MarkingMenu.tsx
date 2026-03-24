/**
 * ⚒️ La Forja — Marking Menu v2 (Contextual Radial Command Hub)
 * ================================================================
 * Right-click anywhere → radial hub with context-sensitive sectors.
 * Click a category sector → drills into its sub-items (stays open).
 * Click a direct action → executes and closes.
 *
 * Two-level navigation: top sections → sub-items.
 * Categories show a gold dot indicator, direct actions execute instantly.
 */

import { useEffect, useRef, useState } from 'react';

export interface MarkingMenuItem {
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
}

export interface MarkingMenuSection {
  label: string;
  icon: string;
  shortcut?: string;
  /** Sub-items — clicking drills into these */
  items?: MarkingMenuItem[];
  /** Direct action — clicking executes immediately */
  action?: () => void;
  disabled?: boolean;
}

interface MarkingMenuProps {
  sections: MarkingMenuSection[];
  position: { x: number; y: number };
  onClose: () => void;
}

const RADIUS = 105;
const ITEM_SIZE = 58;
const CENTER_SIZE = 44;

type RadialItem = MarkingMenuItem | MarkingMenuSection;

function hasItems(item: RadialItem): item is MarkingMenuSection & { items: MarkingMenuItem[] } {
  return 'items' in item && Array.isArray((item as MarkingMenuSection).items)
    && (item as MarkingMenuSection).items!.length > 0;
}

export default function MarkingMenu({ sections, position, onClose }: MarkingMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drillRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [drill, setDrill] = useState<number | null>(null);
  const [drillAnim, setDrillAnim] = useState(false);

  // Keep ref in sync for the stable event handler
  drillRef.current = drill;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (drillRef.current !== null) {
          setDrill(null);
          setHoveredIdx(null);
          setDrillAnim(false);
        } else {
          onClose();
        }
      }
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onEsc);
    window.addEventListener('mousedown', onClick, true);
    return () => {
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('mousedown', onClick, true);
    };
  }, [onClose]);

  // Current items to render (top-level sections or sub-items)
  const currentItems: readonly RadialItem[] =
    drill !== null && sections[drill]?.items
      ? sections[drill].items!
      : sections;

  const isDrilled = drill !== null;
  const anim = isDrilled ? drillAnim : visible;

  // Radial positions
  const positions = currentItems.map((_, i) => {
    const angle = (i / Math.max(currentItems.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(angle) * RADIUS, y: Math.sin(angle) * RADIUS };
  });

  // Keep within viewport
  const menuX = Math.max(RADIUS + 40, Math.min(window.innerWidth - RADIUS - 40, position.x));
  const menuY = Math.max(RADIUS + 40, Math.min(window.innerHeight - RADIUS - 40, position.y));

  const handleItemClick = (item: RadialItem, idx: number) => {
    if (item.disabled) return;
    if (hasItems(item)) {
      // Category → drill into sub-items
      setDrill(idx);
      setHoveredIdx(null);
      setDrillAnim(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setDrillAnim(true)));
      return;
    }
    if (item.action) {
      item.action();
      onClose();
    }
  };

  const handleBack = () => {
    setDrill(null);
    setHoveredIdx(null);
    setDrillAnim(false);
  };

  // Dimensions for SVG / background
  const dim = RADIUS * 2 + ITEM_SIZE + 28;
  const off = -(RADIUS + ITEM_SIZE / 2 + 14);
  const cx = RADIUS + ITEM_SIZE / 2 + 14;

  return (
    <div className="fixed inset-0 z-[9999]" style={{ cursor: 'default' }}>
      <div ref={ref} className="absolute" style={{ left: menuX, top: menuY, transform: 'translate(-50%, -50%)' }}>

        {/* Glass background */}
        <div
          className={`absolute rounded-full transition-all duration-300 ${anim ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
          style={{
            width: dim, height: dim, left: off, top: off,
            background: 'radial-gradient(circle, rgba(8,9,13,0.95) 0%, rgba(8,9,13,0.88) 55%, rgba(8,9,13,0.3) 90%, transparent 100%)',
            backdropFilter: 'blur(28px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.4)',
          }}
        />

        {/* SVG: connecting lines + subtle rings */}
        <svg
          className={`absolute pointer-events-none transition-opacity duration-300 ${anim ? 'opacity-60' : 'opacity-0'}`}
          style={{ width: dim, height: dim, left: off, top: off }}
        >
          {positions.map((p, i) => (
            <line
              key={i}
              x1={cx} y1={cx}
              x2={p.x + cx} y2={p.y + cx}
              stroke={hoveredIdx === i ? '#c9a84c' : 'rgba(255,255,255,0.05)'}
              strokeWidth={hoveredIdx === i ? 1.5 : 0.5}
              strokeDasharray={hoveredIdx === i ? 'none' : '2,4'}
              className="transition-all duration-150"
            />
          ))}
          <circle cx={cx} cy={cx} r={RADIUS + 2} fill="none"
            stroke={isDrilled ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.03)'} strokeWidth="1" />
          <circle cx={cx} cy={cx} r={CENTER_SIZE / 2 + 6} fill="none"
            stroke={isDrilled ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.04)'} strokeWidth="0.5" />
        </svg>

        {/* Center button: close (top) or back (drilled) */}
        <button
          onClick={isDrilled ? handleBack : onClose}
          className={`absolute rounded-full border transition-all duration-200 flex flex-col items-center justify-center
            ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-0'} hover:scale-110`}
          style={{
            width: CENTER_SIZE, height: CENTER_SIZE,
            left: -CENTER_SIZE / 2, top: -CENTER_SIZE / 2,
            background: isDrilled ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.04)',
            borderColor: isDrilled ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.08)',
          }}
        >
          <span className={`text-[12px] ${isDrilled ? 'text-[#c9a84c]' : 'text-[#6b6050]'}`}>
            {isDrilled ? '←' : '✕'}
          </span>
          {isDrilled && (
            <span className="text-[6px] text-[#c9a84c]/50 font-medium tracking-wider">ESC</span>
          )}
        </button>

        {/* Radial items */}
        {currentItems.map((item, i) => {
          const p = positions[i];
          const hov = hoveredIdx === i;
          const isCat = hasItems(item);
          return (
            <button
              key={`${isDrilled ? 'd' : 't'}-${i}`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => handleItemClick(item, i)}
              className={`absolute rounded-xl border transition-all flex flex-col items-center justify-center gap-0.5
                ${anim ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.3]'}
                ${item.disabled ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}`}
              style={{
                width: ITEM_SIZE, height: ITEM_SIZE,
                left: p.x - ITEM_SIZE / 2, top: p.y - ITEM_SIZE / 2,
                background: hov
                  ? 'rgba(201,168,76,0.16)'
                  : isCat ? 'rgba(201,168,76,0.05)' : 'rgba(255,255,255,0.03)',
                borderColor: hov
                  ? 'rgba(201,168,76,0.4)'
                  : isCat ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.06)',
                transitionDelay: `${i * 30}ms`,
                transitionDuration: '200ms',
                boxShadow: hov
                  ? '0 0 24px rgba(201,168,76,0.15), inset 0 0 16px rgba(201,168,76,0.05)'
                  : 'none',
              }}
            >
              <span className={`text-[17px] leading-none transition-colors duration-150
                ${hov ? 'text-[#e2c97e]' : isCat ? 'text-[#a08c5a]' : 'text-[#8a7e6b]'}`}>
                {item.icon}
              </span>
              <span className={`text-[8px] leading-tight font-semibold tracking-wide transition-colors duration-150
                ${hov ? 'text-[#c9a84c]' : 'text-[#5a5040]'}`}>
                {item.label}
              </span>
              {item.shortcut && (
                <span className="text-[7px] text-[#3a3025] font-mono">{item.shortcut}</span>
              )}
              {/* Category indicator dot */}
              {isCat && !hov && (
                <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full"
                  style={{ background: 'rgba(201,168,76,0.4)', boxShadow: '0 0 4px rgba(201,168,76,0.2)' }} />
              )}
              {/* Category arrow on hover */}
              {isCat && hov && (
                <span className="absolute -right-1 top-1/2 -translate-y-1/2 text-[8px] text-[#c9a84c]/60">›</span>
              )}
            </button>
          );
        })}

        {/* Section label when drilled in */}
        {isDrilled && sections[drill!] && (
          <div
            className="absolute text-[9px] font-bold tracking-[0.2em] uppercase pointer-events-none"
            style={{
              left: 0, top: -(RADIUS + ITEM_SIZE / 2 + 24),
              transform: 'translateX(-50%)',
              color: 'rgba(201,168,76,0.4)',
            }}
          >
            {sections[drill!].icon} {sections[drill!].label}
          </div>
        )}

        {/* Tooltip for hovered item */}
        {hoveredIdx !== null && currentItems[hoveredIdx] && (
          <div
            className="absolute text-[10px] text-[#f0ece4] rounded-lg px-3 py-1.5 whitespace-nowrap pointer-events-none"
            style={{
              left: 0, top: RADIUS + ITEM_SIZE / 2 + 20,
              transform: 'translateX(-50%)',
              background: 'rgba(8,9,13,0.9)',
              border: '1px solid rgba(201,168,76,0.12)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            {currentItems[hoveredIdx].label}
            {hasItems(currentItems[hoveredIdx]) && (
              <span className="ml-1.5 text-[8px] text-[#c9a84c]/40">clic para ver</span>
            )}
            {currentItems[hoveredIdx].shortcut && (
              <span className="ml-2 text-[#4a4035] font-mono text-[9px]">{currentItems[hoveredIdx].shortcut}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
