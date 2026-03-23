/**
 * ⚒️ La Forja — Marking Menu (Radial Context Menu)
 * ==================================================
 * Fusion 360's signature UX: right-click anywhere in the viewport
 * to get a radial menu with the most-used commands.
 * 
 * 8 positions arranged in a circle. Context-sensitive based on
 * what's selected (primitive, operation, or nothing).
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export interface MarkingMenuItem {
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
}

interface MarkingMenuProps {
  items: MarkingMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

const RADIUS = 90;
const ITEM_SIZE = 56;
const CENTER_SIZE = 40;

export default function MarkingMenu({ items, position, onClose }: MarkingMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));

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

  // Calculate positions in circle
  const itemPositions = items.map((_, i) => {
    const angle = (i / Math.max(items.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      x: Math.cos(angle) * RADIUS,
      y: Math.sin(angle) * RADIUS,
    };
  });

  // Keep menu within viewport bounds
  const menuX = Math.max(RADIUS + 20, Math.min(window.innerWidth - RADIUS - 20, position.x));
  const menuY = Math.max(RADIUS + 20, Math.min(window.innerHeight - RADIUS - 20, position.y));

  return (
    <div className="fixed inset-0 z-[9999]" style={{ cursor: 'default' }}>
      <div
        ref={ref}
        className="absolute"
        style={{
          left: menuX,
          top: menuY,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Background ring */}
        <div
          className={`absolute rounded-full transition-all duration-200 ${
            visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}
          style={{
            width: RADIUS * 2 + ITEM_SIZE + 20,
            height: RADIUS * 2 + ITEM_SIZE + 20,
            left: -(RADIUS + ITEM_SIZE / 2 + 10),
            top: -(RADIUS + ITEM_SIZE / 2 + 10),
            background: 'radial-gradient(circle, rgba(8,9,13,0.92) 0%, rgba(8,9,13,0.85) 70%, transparent 100%)',
            backdropFilter: 'blur(20px)',
          }}
        />

        {/* Connecting lines */}
        <svg
          className={`absolute pointer-events-none transition-all duration-200 ${
            visible ? 'opacity-40' : 'opacity-0'
          }`}
          style={{
            width: RADIUS * 2 + ITEM_SIZE + 20,
            height: RADIUS * 2 + ITEM_SIZE + 20,
            left: -(RADIUS + ITEM_SIZE / 2 + 10),
            top: -(RADIUS + ITEM_SIZE / 2 + 10),
          }}
        >
          {itemPositions.map((pos, i) => (
            <line
              key={i}
              x1={RADIUS + ITEM_SIZE / 2 + 10}
              y1={RADIUS + ITEM_SIZE / 2 + 10}
              x2={pos.x + RADIUS + ITEM_SIZE / 2 + 10}
              y2={pos.y + RADIUS + ITEM_SIZE / 2 + 10}
              stroke={hoveredIdx === i ? '#c9a84c' : 'rgba(255,255,255,0.08)'}
              strokeWidth={hoveredIdx === i ? 1.5 : 0.5}
              strokeDasharray={hoveredIdx === i ? 'none' : '2,2'}
            />
          ))}
        </svg>

        {/* Center button */}
        <button
          onClick={onClose}
          className={`absolute rounded-full border transition-all duration-200 flex items-center justify-center ${
            visible ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
          }`}
          style={{
            width: CENTER_SIZE,
            height: CENTER_SIZE,
            left: -CENTER_SIZE / 2,
            top: -CENTER_SIZE / 2,
            background: 'rgba(255,255,255,0.04)',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <span className="text-[10px] text-[#6b6050]">✕</span>
        </button>

        {/* Menu items */}
        {items.map((item, i) => {
          const pos = itemPositions[i];
          const isHovered = hoveredIdx === i;
          return (
            <button
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => {
                if (!item.disabled) {
                  item.action();
                  onClose();
                }
              }}
              className={`absolute rounded-lg border transition-all flex flex-col items-center justify-center gap-0.5 ${
                visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              } ${item.disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
              style={{
                width: ITEM_SIZE,
                height: ITEM_SIZE,
                left: pos.x - ITEM_SIZE / 2,
                top: pos.y - ITEM_SIZE / 2,
                background: isHovered ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                borderColor: isHovered ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)',
                borderRadius: 10,
                transitionDelay: `${i * 30}ms`,
                transitionDuration: '150ms',
                boxShadow: isHovered ? '0 0 16px rgba(201,168,76,0.1)' : 'none',
              }}
            >
              <span className={`text-[16px] ${isHovered ? 'text-[#c9a84c]' : 'text-[#8a7e6b]'}`}>
                {item.icon}
              </span>
              <span className={`text-[8px] leading-tight font-medium ${isHovered ? 'text-[#c9a84c]' : 'text-[#6b6050]'}`}>
                {item.label}
              </span>
              {item.shortcut && (
                <span className="text-[7px] text-[#4a4035] font-mono">{item.shortcut}</span>
              )}
            </button>
          );
        })}

        {/* Tooltip for hovered item */}
        {hoveredIdx !== null && items[hoveredIdx] && (
          <div
            className="absolute text-[10px] text-[#f0ece4] rounded-lg px-2.5 py-1.5 whitespace-nowrap pointer-events-none"
            style={{
              left: 0,
              top: RADIUS + ITEM_SIZE / 2 + 16,
              transform: 'translateX(-50%)',
              background: 'rgba(8,9,13,0.85)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {items[hoveredIdx].label}
            {items[hoveredIdx].shortcut && (
              <span className="ml-2 text-[#4a4035] font-mono">{items[hoveredIdx].shortcut}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
