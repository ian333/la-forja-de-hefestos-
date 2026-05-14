/**
 * MathPrizesPortal — portada de los premios matemáticos.
 *
 * No hay Nobel de Matemáticas. Hay tres premios comparables:
 *   - Medalla Fields (1936, cada 4 años, menores de 40)
 *   - Premio Abel (2003, anual, sin tope de edad)
 *
 * Aquí mostramos ambos catálogos en una sola portada, con un filtro
 * por tipo de premio (Fields · Abel · Todos) y agrupados por
 * bloque temático.
 *
 * Las clases producidas (status: 'live') enlazan a /masterclass.html.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  MATH_CATALOG,
  getMathCatalogByBlock,
  getMathCatalogByPrize,
  getMathPrizesStats,
  type MathLaureate,
  type MathBlockMeta,
  type MathPrizeKind,
} from './prizes-catalog';

type FilterKind = MathPrizeKind | 'todos';

export default function MathPrizesPortal() {
  // El CSS global ata html/body a overflow:hidden para apps full-screen.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
    };
    html.style.overflow = 'auto';
    html.style.height = 'auto';
    body.style.overflow = 'auto';
    body.style.height = 'auto';
    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
    };
  }, []);

  const [filter, setFilter] = useState<FilterKind>('todos');
  const stats = getMathPrizesStats();
  const grouped = useMemo(() => {
    const all = getMathCatalogByBlock();
    if (filter === 'todos') return all;
    return all
      .map(({ block, entries }) => ({
        block,
        entries: entries.filter(e => e.prize === filter),
      }))
      .filter(g => g.entries.length > 0);
  }, [filter]);

  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans relative overflow-x-hidden">
      {/* Background grid + ambient lights */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #CBD5E1 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />
      <div
        className="fixed top-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full pointer-events-none opacity-25 blur-[110px]"
        style={{ background: 'radial-gradient(circle, #4FC3F7 0%, transparent 70%)' }}
      />
      <div
        className="fixed bottom-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full pointer-events-none opacity-20 blur-[110px]"
        style={{ background: 'radial-gradient(circle, #A78BFA 0%, transparent 70%)' }}
      />
      <div
        className="fixed top-[40%] left-[20%] w-[40%] h-[40%] rounded-full pointer-events-none opacity-15 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #FDB813 0%, transparent 70%)' }}
      />

      {/* Header */}
      <header className="relative z-10 px-6 py-6 max-w-[1400px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#4FC3F7] via-[#A78BFA] to-[#FDB813] flex items-center justify-center font-bold text-[#05060A] text-[20px]">
            Σ
          </div>
          <div>
            <div className="text-[16px] font-bold tracking-tight">Premios Matemáticos</div>
            <div className="text-[10px] text-[#64748B] uppercase tracking-[0.2em]">
              GAIA · Medalla Fields + Premio Abel
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-5 text-[12px] text-[#94A3B8] font-mono">
          <a href="/escuela.html" className="hover:text-[#4FC3F7] transition">← Escuela</a>
          <a href="/math.html" className="hover:text-[#4FC3F7] transition">Math Lab</a>
          <a href="#bloques" className="hover:text-[#4FC3F7] transition">Bloques</a>
          <a href="#manifiesto" className="hover:text-[#4FC3F7] transition">Manifiesto</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 max-w-[1200px] mx-auto pt-10 pb-12 text-center">
        <div className="text-[11px] uppercase tracking-[0.3em] text-[#4FC3F7] mb-4">
          ▶ Módulo Universidad · GAIA
        </div>
        <h1 className="text-[56px] md:text-[80px] font-extrabold leading-[0.95] tracking-tight">
          <span className="text-white">No hay Nobel de Mate.</span><br />
          <span className="bg-gradient-to-r from-[#4FC3F7] via-[#A78BFA] to-[#FDB813] bg-clip-text text-transparent">
            Pero hay algo mejor.
          </span>
        </h1>
        <p className="mt-8 text-[18px] text-[#CBD5E1] max-w-[780px] mx-auto leading-relaxed">
          La Medalla Fields se entrega cada cuatro años en el Congreso Internacional
          de Matemáticos, sólo a menores de cuarenta años — el "Nobel de los jóvenes".
          El Premio Abel es la trayectoria — anual, otorgado por Noruega desde 2003.
          Aquí están todos los premiados, en español, con bloque temático y caso real.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] font-mono flex-wrap">
          <span className="px-3 py-1 rounded-full border border-[#4FC3F7]/40 bg-[#4FC3F7]/10 text-[#4FC3F7]">
            ● {stats.live} clases listas
          </span>
          <span className="px-3 py-1 rounded-full border border-[#475569] bg-[#0B0F17] text-[#94A3B8]">
            ○ {stats.pending} en producción
          </span>
          <span className="text-[#64748B]">
            · {stats.fields} Fields · {stats.abel} Abel · 10 bloques
          </span>
        </div>
      </section>

      {/* Filter */}
      <section className="relative z-10 px-6 max-w-[900px] mx-auto pb-8 flex flex-wrap items-center justify-center gap-3">
        <FilterButton active={filter === 'todos'} onClick={() => setFilter('todos')} color="#E2E8F0">
          Todos · {stats.total}
        </FilterButton>
        <FilterButton active={filter === 'fields'} onClick={() => setFilter('fields')} color="#FDB813">
          Medalla Fields · {stats.fields}
        </FilterButton>
        <FilterButton active={filter === 'abel'} onClick={() => setFilter('abel')} color="#A78BFA">
          Premio Abel · {stats.abel}
        </FilterButton>
      </section>

      {/* Manifiesto */}
      <section id="manifiesto" className="relative z-10 px-6 max-w-[1100px] mx-auto pb-16">
        <div
          className="rounded-2xl border border-[#4FC3F7]/20 p-8 md:p-10"
          style={{ background: 'linear-gradient(135deg, #0B2138 0%, #0B0F17 60%, #1E1338 100%)' }}
        >
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#4FC3F7] mb-3">
            ✦ Por qué este curso existe
          </div>
          <h2 className="text-[28px] md:text-[36px] font-bold text-white leading-tight mb-5">
            La matemática del siglo XX no se aprende en libros de texto.
          </h2>
          <div className="space-y-4 text-[15px] text-[#CBD5E1] leading-relaxed max-w-[900px]">
            <p>
              Se aprende leyendo a Grothendieck cuando reescribió la geometría algebraica
              desde los cimientos. A Perelman cuando demostró Poincaré y rechazó el millón
              del Clay. A Mirzakhani — primera mujer Fields — contando geodésicas en
              superficies hiperbólicas. A Wiles encerrado en su ático siete años hasta
              cerrar Fermat.
            </p>
            <p>
              Cada Fields y cada Abel es una idea que cambió cómo entendemos las
              matemáticas mismas. Pero están escritas en papers densos, en inglés
              académico, y traducidas malamente a divulgación que se queda en la
              anécdota biográfica sin tocar la idea matemática.
            </p>
            <p className="text-white font-medium">
              Aquí los traemos todos. En español. Con voz humana. Con simuladores 3D
              donde aplican. Con la idea matemática en su corazón, sin diluirla.
            </p>
            <p className="text-[#94A3B8] text-[13px] italic">
              "Es probablemente la actividad humana más intelectualmente satisfactoria — porque uno descubre, en lugar de inventar." — Maryam Mirzakhani
            </p>
          </div>
        </div>
      </section>

      {/* Bloques temáticos */}
      <section id="bloques" className="relative z-10 px-6 max-w-[1400px] mx-auto pb-24">
        {grouped.map(({ block, entries }) => (
          <BlockSection key={block.id} block={block} entries={entries} />
        ))}
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-[#1E293B] text-center">
        <p className="text-[12px] font-mono text-[#64748B] mb-3">
          GAIA · La Forja de Hefestos · módulo Universidad
        </p>
        <p className="text-[11px] text-[#475569] max-w-[600px] mx-auto">
          Datos verificados contra mathunion.org (Fields) y abelprize.no (Abel).
          La voz es Matilda (ElevenLabs) en español mexicano. La narración es nuestra.
        </p>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function FilterButton({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-full text-[12px] font-mono uppercase tracking-[0.2em] transition-all border"
      style={{
        background: active ? `${color}22` : '#0B0F17',
        borderColor: active ? `${color}99` : '#1E293B',
        color: active ? color : '#94A3B8',
      }}
    >
      {children}
    </button>
  );
}

function BlockSection({ block, entries }: { block: MathBlockMeta; entries: MathLaureate[] }) {
  const liveCount = entries.filter(e => e.status === 'live').length;

  return (
    <div id={block.id} className="mb-16">
      {/* Block header */}
      <div className="flex items-end justify-between mb-6 gap-6">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.3em] mb-2"
            style={{ color: block.color }}
          >
            Bloque · {entries.length} {entries.length === 1 ? 'clase' : 'clases'}
          </div>
          <h3 className="text-[26px] md:text-[34px] font-extrabold text-white tracking-tight leading-tight">
            {block.name}
          </h3>
          <p className="mt-2 text-[14px] text-[#94A3B8] max-w-[640px]">
            {block.description}
          </p>
        </div>
        <div className="shrink-0 text-right text-[11px] font-mono">
          <div style={{ color: block.color }}>● {liveCount} lista{liveCount === 1 ? '' : 's'}</div>
          <div className="text-[#64748B]">○ {entries.length - liveCount} pendiente{entries.length - liveCount === 1 ? '' : 's'}</div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map(entry => (
          <PrizeCard key={entry.id} entry={entry} block={block} />
        ))}
      </div>
    </div>
  );
}

function PrizeCard({ entry, block }: { entry: MathLaureate; block: MathBlockMeta }) {
  const isLive = entry.status === 'live';
  const href = isLive ? `/masterclass.html?id=${entry.classId}` : undefined;

  // Distintivo visual por tipo de premio (badge color)
  const prizeColor = entry.prize === 'fields' ? '#FDB813' : '#A78BFA';
  const prizeLabel = entry.prize === 'fields' ? 'FIELDS' : 'ABEL';

  const baseCardStyle: React.CSSProperties = {
    background: isLive
      ? `linear-gradient(135deg, ${block.colorBg} 0%, #0B0F17 70%)`
      : 'linear-gradient(135deg, #0B0F17 0%, #0A0E15 100%)',
    borderColor: isLive ? `${block.color}55` : '#1E293B',
  };

  const inner = (
    <>
      {isLive && (
        <div
          className="absolute -top-12 -right-12 w-[180px] h-[180px] rounded-full opacity-30 blur-[60px] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${block.colorEmissive} 0%, transparent 70%)` }}
        />
      )}

      <div className="relative z-10">
        {/* Year + prize badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-mono tracking-[0.2em] px-2 py-0.5 rounded border"
              style={{
                color: prizeColor,
                borderColor: `${prizeColor}55`,
                background: `${prizeColor}11`,
              }}
            >
              {prizeLabel}
            </span>
            <span
              className="text-[11px] font-mono tracking-[0.2em]"
              style={{ color: isLive ? block.color : '#475569' }}
            >
              · {entry.year}
            </span>
          </div>
          {isLive ? (
            <div className="text-[9px] font-mono uppercase tracking-[0.3em] px-2 py-0.5 rounded"
                 style={{ background: `${block.color}22`, color: block.color }}>
              ▶ lista
            </div>
          ) : (
            <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-[#475569]">
              · próximamente
            </div>
          )}
        </div>

        {/* Laureate(s) */}
        <div className="text-[12px] text-[#94A3B8] font-mono mb-3 leading-snug">
          {entry.laureates.join(' · ')}
        </div>

        {/* Title */}
        <h4 className={`text-[18px] font-bold leading-tight mb-3 ${isLive ? 'text-white' : 'text-[#94A3B8]'}`}>
          {entry.title}
        </h4>

        {/* Impact phrase */}
        <p className={`text-[13px] leading-relaxed ${isLive ? 'text-[#CBD5E1]' : 'text-[#64748B]'}`}>
          {entry.impact}
        </p>

        {/* CTA */}
        {isLive ? (
          <div
            className="mt-5 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] transition-all group-hover:gap-3"
            style={{ color: block.color }}
          >
            ▶ Empezar clase →
          </div>
        ) : (
          <div className="mt-5 text-[10px] font-mono text-[#475569]">
            En producción · narración + animaciones
          </div>
        )}
      </div>
    </>
  );

  const className = `group relative rounded-xl border p-6 transition-all overflow-hidden ${
    isLive ? 'hover:-translate-y-0.5 hover:shadow-lg' : 'opacity-65 hover:opacity-90'
  }`;

  return href ? (
    <a href={href} className={`${className} block cursor-pointer`} style={baseCardStyle}>
      {inner}
    </a>
  ) : (
    <div className={className} style={baseCardStyle}>
      {inner}
    </div>
  );
}
