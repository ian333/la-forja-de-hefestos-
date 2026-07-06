/**
 * MENÚ RADIAL DE FORJA — clic derecho en el viewport 3D.
 * Estética de videojuego (anillo dorado, glow, entrada animada) sobre mecánica
 * de CAD: las operaciones REALES del Part Studio en un gesto de muñeca. El
 * centro (hub) muestra la operación bajo el cursor; clic fuera o Esc cierra.
 * Cada botón lleva data-testid="radial-<id>" → los tutoriales lo pueden manejar.
 */
import { useEffect, useMemo, useState } from 'react';

const GOLD = '#FDB813';

export interface RadialItem {
  id: string;
  label: string;
  glyph: string;
  onPick: () => void;
}

export default function RadialMenu({ x, y, items, onClose }: {
  x: number; y: number; items: RadialItem[]; onClose: () => void;
}) {
  const [hover, setHover] = useState<RadialItem | null>(null);
  const R = 104;                                   // radio del anillo (px)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Mantener el anillo COMPLETO en pantalla aunque el clic sea cerca de un borde.
  const [px, py] = useMemo(() => {
    const m = R + 64;
    return [
      Math.min(Math.max(x, m), (window.innerWidth || 1600) - m),
      Math.min(Math.max(y, m), (window.innerHeight || 900) - m),
    ];
  }, [x, y]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60 }}
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      data-testid="radial-menu"
    >
      <style>{`
        @keyframes fjRadialIn { from { opacity: 0; transform: translate(-50%,-50%) scale(.55) rotate(-8deg); }
                                to   { opacity: 1; transform: translate(-50%,-50%) scale(1) rotate(0deg); } }
        @keyframes fjItemIn   { from { opacity: 0; transform: translate(-50%,-50%) scale(.3); }
                                to   { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
        .fj-radial-item:hover { border-color: ${GOLD} !important; color: #1a1205 !important;
          background: radial-gradient(circle at 32% 28%, #ffe9ad, ${GOLD} 70%) !important;
          box-shadow: 0 0 0 2px rgba(253,184,19,.55), 0 0 26px rgba(253,184,19,.55), 0 6px 18px rgba(0,0,0,.5) !important;
          transform: translate(-50%,-50%) scale(1.13) !important; }
      `}</style>
      {/* Escrim sutil: foco al anillo sin apagar la escena */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle 340px at ' + px + 'px ' + py + 'px, rgba(6,10,16,0.0) 30%, rgba(6,10,16,0.42) 100%)' }} />

      {/* Anillo decorativo */}
      <div style={{
        position: 'fixed', left: px, top: py, width: R * 2 + 54, height: R * 2 + 54,
        transform: 'translate(-50%,-50%)', borderRadius: '50%', pointerEvents: 'none',
        border: '1.5px solid rgba(253,184,19,.28)',
        boxShadow: '0 0 44px rgba(253,184,19,.14), inset 0 0 34px rgba(253,184,19,.08)',
        animation: 'fjRadialIn .16s ease-out',
      }} />

      {/* HUB central: nombre de la op bajo el cursor */}
      <div style={{
        position: 'fixed', left: px, top: py, width: 92, height: 92, transform: 'translate(-50%,-50%)',
        borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 34% 30%, #1d2634, #0c121b 74%)',
        border: `1.5px solid ${hover ? GOLD : '#33404f'}`, pointerEvents: 'none',
        boxShadow: hover ? '0 0 26px rgba(253,184,19,.35)' : '0 8px 24px rgba(0,0,0,.55)',
        transition: 'border-color .12s, box-shadow .12s',
        animation: 'fjRadialIn .16s ease-out',
      }}>
        <span style={{ fontSize: 22, lineHeight: 1, color: hover ? GOLD : '#5b6b7e' }}>{hover ? hover.glyph : '⚒'}</span>
        <span style={{ marginTop: 5, font: '700 11px/1.15 Inter, system-ui, sans-serif', letterSpacing: '.4px', color: hover ? '#ffe9ad' : '#8fa3b8', textAlign: 'center', maxWidth: 78 }}>
          {hover ? hover.label : 'Forja'}
        </span>
      </div>

      {/* Los ítems, en anillo — arrancan arriba (−90°) y giran en sentido horario */}
      {items.map((it, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / items.length;
        const ix = px + R * Math.cos(a), iy = py + R * Math.sin(a);
        return (
          <button
            key={it.id}
            className="fj-radial-item"
            data-testid={`radial-${it.id}`}
            title={it.label}
            onClick={(e) => { e.stopPropagation(); onClose(); it.onPick(); }}
            onMouseEnter={() => setHover(it)}
            onMouseLeave={() => setHover((h) => (h === it ? null : h))}
            style={{
              position: 'fixed', left: ix, top: iy, width: 58, height: 58,
              transform: 'translate(-50%,-50%)', borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'radial-gradient(circle at 34% 30%, #232e3d, #101722 74%)',
              border: '1.5px solid #3a4452', color: '#dbe3ee', fontSize: 21,
              boxShadow: '0 6px 16px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06)',
              transition: 'transform .1s, border-color .12s, background .12s, box-shadow .12s',
              animation: `fjItemIn .18s ${i * 0.022}s ease-out backwards`,
            }}
          >{it.glyph}</button>
        );
      })}
    </div>
  );
}
