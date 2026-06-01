/**
 * KuznetsPIB — laboratorio del premio 1971 (Simon Kuznets).
 *
 * Kuznets inventó las cuentas nacionales (el PIB) en los años 30. Y pasó el
 * resto de su vida advirtiendo que NO debía usarse como medida de bienestar.
 *
 * El click: prendes y apagas eventos de tu vida y ves dos medidores moverse:
 *   - PIB        = suma del dinero que cambia de manos (definición REAL: solo
 *                  transacciones de mercado).
 *   - Tu vida    = juicio cualitativo, ILUSTRATIVO (a propósito: nadie sabe
 *                  medir bien el bienestar — ese es justo el punto de Kuznets).
 *
 * Lo que se ve: ambos divergen. El PIB sube con desgracias (limpiar un derrame)
 * y no cuenta el bien que haces gratis (cuidar a tu mamá). Sin física: es pura
 * contabilidad nacional, fiel a cómo se mide de verdad.
 */

import { useMemo, useState } from 'react';

interface LifeEvent {
  id: string;
  emoji: string;
  label: string;
  gdp: number;       // delta al PIB (miles, ilustrativo)
  welfare: number;   // delta al bienestar (−2..+2, cualitativo)
  note: string;
}

const EVENTS: LifeEvent[] = [
  { id: 'cocinar', emoji: '🍳', label: 'Cocinas en casa para tu familia', gdp: 0, welfare: 2,
    note: 'Trabajo real, valioso… que el PIB cuenta como CERO porque no se factura.' },
  { id: 'comer-fuera', emoji: '🍔', label: 'Te divorcias y ahora comes fuera', gdp: 35, welfare: -1,
    note: 'El PIB sube (pagas restaurantes), tu vida no necesariamente mejora.' },
  { id: 'derrame', emoji: '🛢️', label: 'Hay un derrame y lo limpian', gdp: 80, welfare: -2,
    note: 'Una tragedia ambiental SUBE el PIB: alguien cobra por limpiarla.' },
  { id: 'cuidar', emoji: '🤱', label: 'Cuidas gratis a tu mamá enferma', gdp: 0, welfare: 2,
    note: 'Lo más humano que existe. Para el PIB: cero.' },
  { id: 'choques', emoji: '🚗', label: 'Más choques = más reparaciones', gdp: 45, welfare: -2,
    note: 'Más accidentes, más PIB. Si una cifra sube con tragedias, no mide tu felicidad.' },
  { id: 'talar', emoji: '🪓', label: 'Talas el bosque y vendes la madera', gdp: 60, welfare: -1,
    note: 'Hoy suma al PIB. El costo (el bosque perdido) no se resta en ningún lado.' },
  { id: 'wiki', emoji: '📚', label: 'Wikipedia gratis para todos', gdp: 2, welfare: 2,
    note: 'Valor enorme para tu vida. PIB casi cero, porque no se cobra.' },
  { id: 'ascenso', emoji: '📈', label: 'Te ascienden en un trabajo que amas', gdp: 40, welfare: 2,
    note: 'Aquí sí coinciden: ganas más Y vives mejor. A veces pasa.' },
];

const GDP_BASE = 100;

export default function KuznetsPIB() {
  const [active, setActive] = useState<Set<string>>(new Set());

  const { gdp, welfare, lastNote } = useMemo(() => {
    let gdp = GDP_BASE, welfare = 0, lastNote = '';
    for (const e of EVENTS) {
      if (active.has(e.id)) { gdp += e.gdp; welfare += e.welfare; lastNote = e.note; }
    }
    return { gdp, welfare, lastNote };
  }, [active]);

  const toggle = (id: string) =>
    setActive(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Escalas para las barras.
  const gdpPct = Math.min(100, ((gdp - GDP_BASE) / 260) * 100 + 12);
  const welfarePct = Math.max(4, Math.min(100, 50 + welfare * 11));

  const diverging = gdp - GDP_BASE > 60 && welfare <= 0;

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
      {/* Medidores */}
      <div className="space-y-5">
        <Meter
          title="PIB del país"
          subtitle="dinero que cambia de manos"
          value={`$${gdp.toFixed(0)} mil`}
          pct={gdpPct}
          color="#34D399"
        />
        <Meter
          title="Tu vida (bienestar real)"
          subtitle="lo que de verdad importa · juicio ilustrativo"
          value={welfare > 0 ? `+${welfare} 🙂` : welfare < 0 ? `${welfare} 🙁` : '0 😐'}
          pct={welfarePct}
          color={welfare >= 0 ? '#4FC3F7' : '#EF4444'}
        />

        <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4 min-h-[88px]">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#34D399] font-mono mb-2">✦ Lo que acabas de ver</div>
          <p className="text-[13px] text-[#CBD5E1] leading-relaxed">
            {diverging
              ? '📈 El país "crece"… pero la gente NO vive mejor. Eso es exactamente lo que Kuznets temía: confundir el PIB con el bienestar.'
              : lastNote || 'Prende y apaga eventos de tu vida. Mira cómo el PIB y tu bienestar real casi nunca se mueven juntos.'}
          </p>
        </div>

        <div className="text-[10px] font-mono text-[#475569] leading-relaxed">
          PIB = Σ transacciones de mercado (definición real, Kuznets 1934).<br />
          Bienestar = juicio cualitativo, a propósito: nadie sabe medirlo bien. Ese es el punto.
        </div>
      </div>

      {/* Eventos */}
      <div className="space-y-2 bg-[#0B0F17] border border-[#1E293B] rounded-lg p-4 h-fit">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-mono mb-2">Préndele a tu vida</div>
        {EVENTS.map(e => {
          const on = active.has(e.id);
          return (
            <button
              key={e.id}
              onClick={() => toggle(e.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition flex items-center gap-3 ${
                on ? 'border-[#34D399]/50 bg-[#34D399]/10' : 'border-[#1E293B] hover:border-[#475569]'}`}
            >
              <span className="text-[20px]">{e.emoji}</span>
              <span className="flex-1">
                <span className={`block text-[13px] ${on ? 'text-white font-medium' : 'text-[#CBD5E1]'}`}>{e.label}</span>
                <span className="block text-[10px] font-mono mt-0.5">
                  <span className={e.gdp > 0 ? 'text-[#34D399]' : 'text-[#64748B]'}>PIB {e.gdp > 0 ? `+${e.gdp}` : '0'}</span>
                  <span className="text-[#475569]"> · </span>
                  <span className={e.welfare > 0 ? 'text-[#4FC3F7]' : e.welfare < 0 ? 'text-[#EF4444]' : 'text-[#64748B]'}>
                    vida {e.welfare > 0 ? `+${e.welfare}` : e.welfare}
                  </span>
                </span>
              </span>
              <span className={`text-[11px] font-mono ${on ? 'text-[#34D399]' : 'text-[#475569]'}`}>{on ? 'ON' : '○'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Meter({ title, subtitle, value, pct, color }: {
  title: string; subtitle: string; value: string; pct: number; color: string;
}) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div>
          <div className="text-[15px] font-bold text-white">{title}</div>
          <div className="text-[11px] text-[#64748B]">{subtitle}</div>
        </div>
        <div className="text-[22px] font-extrabold font-mono" style={{ color }}>{value}</div>
      </div>
      <div className="mt-3 h-4 rounded-full bg-[#11161F] overflow-hidden border border-[#1E293B]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 16px ${color}66` }}
        />
      </div>
    </div>
  );
}
