/**
 * EconomiaPortal — portada del módulo de Economía Real.
 *
 * Muestra los 56 Premios Nobel de Economía (1969-2024) como cards,
 * agrupados en 12 bloques temáticos. Las clases ya producidas
 * (status: 'live') enlazan a /masterclass.html?id=<classId>. Las
 * pendientes muestran un estado "próximamente" pero siguen mostrando
 * la metadata para que se pueda navegar el contenido completo.
 *
 * Estructura visual:
 *   - Hero con titular del módulo + stats (live / total)
 *   - Manifiesto corto (sin gurús, puros Nobel)
 *   - 12 secciones por bloque temático, cada una con su tinte de color
 *   - Cards: año + premiados + título + impacto + estado
 *   - Footer con enlace a Escuela y al README de Forja
 */

import { useEffect } from 'react';
import {
  BLOCKS,
  NOBEL_CATALOG,
  getCatalogByBlock,
  getCatalogStats,
  type NobelLaureate,
  type BlockMeta,
} from './nobel-catalog';

export default function EconomiaPortal() {
  // El CSS global ata html/body a overflow:hidden para apps full-screen.
  // El portal necesita scroll vertical normal.
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

  const stats = getCatalogStats();
  const grouped = getCatalogByBlock();

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
        style={{ background: 'radial-gradient(circle, #34D399 0%, transparent 70%)' }}
      />
      <div
        className="fixed bottom-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full pointer-events-none opacity-20 blur-[110px]"
        style={{ background: 'radial-gradient(circle, #FDB813 0%, transparent 70%)' }}
      />

      {/* Header */}
      <header className="relative z-10 px-6 py-6 max-w-[1400px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#34D399] via-[#FDB813] to-[#F472B6] flex items-center justify-center font-bold text-[#05060A] text-[20px]">
            ₿
          </div>
          <div>
            <div className="text-[16px] font-bold tracking-tight">Economía Real</div>
            <div className="text-[10px] text-[#64748B] uppercase tracking-[0.2em]">
              GAIA · sin gurús · pura ciencia
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-5 text-[12px] text-[#94A3B8] font-mono">
          <a href="/escuela.html" className="hover:text-[#34D399] transition">← Escuela</a>
          <a href="#bloques" className="hover:text-[#34D399] transition">Bloques</a>
          <a href="#manifiesto" className="hover:text-[#34D399] transition">Manifiesto</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 max-w-[1200px] mx-auto pt-10 pb-12 text-center">
        <div className="text-[11px] uppercase tracking-[0.3em] text-[#34D399] mb-4">
          ▶ Módulo Universidad · GAIA
        </div>
        <h1 className="text-[56px] md:text-[80px] font-extrabold leading-[0.95] tracking-tight">
          <span className="text-white">56 ideas</span><br />
          <span className="bg-gradient-to-r from-[#34D399] via-[#FDB813] to-[#F472B6] bg-clip-text text-transparent">
            que premiaron al mundo.
          </span>
        </h1>
        <p className="mt-8 text-[18px] text-[#CBD5E1] max-w-[720px] mx-auto leading-relaxed">
          Todos los Premios Nobel de Economía desde mil novecientos sesenta y nueve, narrados,
          animados, traídos al español. Cero gurús. Cero Tony Robbins. Cero Simon Sinek.
          Puros papers, puros datos, puras ideas que aguantan la prueba del tiempo.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] font-mono">
          <span className="px-3 py-1 rounded-full border border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]">
            ● {stats.live} clases listas
          </span>
          <span className="px-3 py-1 rounded-full border border-[#475569] bg-[#0B0F17] text-[#94A3B8]">
            ○ {stats.pending} en producción
          </span>
          <span className="text-[#64748B]">· 12 bloques temáticos</span>
        </div>
      </section>

      {/* Manifiesto */}
      <section id="manifiesto" className="relative z-10 px-6 max-w-[1100px] mx-auto pb-16">
        <div
          className="rounded-2xl border border-[#34D399]/20 p-8 md:p-10"
          style={{ background: 'linear-gradient(135deg, #07201A 0%, #0B0F17 60%, #1A1408 100%)' }}
        >
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#34D399] mb-3">
            ✦ Por qué este curso existe
          </div>
          <h2 className="text-[28px] md:text-[36px] font-bold text-white leading-tight mb-5">
            La economía no se aprende con TED talks ni con libros de auto-ayuda.
          </h2>
          <div className="space-y-4 text-[15px] text-[#CBD5E1] leading-relaxed max-w-[900px]">
            <p>
              Se aprende leyendo a Akerlof cuando demostró que la información asimétrica
              mata mercados. Leyendo a Coase cuando explicó por qué existen las empresas.
              Leyendo a Ostrom — primera mujer Nobel — cuando mostró que los pueblos sí
              saben cuidar sus pesquerías sin que el Estado los obligue.
            </p>
            <p>
              Cada premio Nobel de Economía es un teorema que cambia cómo entiendes el
              mundo. Pero están escritos en inglés académico denso, encerrados en
              papers de pago, y traducidos malamente a libros best-seller que se quedan
              en lo anecdótico.
            </p>
            <p className="text-white font-medium">
              Aquí los traemos todos. En español. Con voz humana. Con animaciones que
              SÍ ayudan. Con casos reales de México y Latinoamérica. Sin diluir las
              matemáticas y sin tampoco ahogarte en ellas.
            </p>
            <p className="text-[#94A3B8] text-[13px] italic">
              "Una sola idea, llevada hasta el final. Veintidós minutos cada una.
              Cincuenta y seis veces."
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
          Cada clase usa datos y citas verificadas contra el comité Nobel
          (NobelPrize.org) y los papers originales. La voz es Matilda (ElevenLabs)
          en español. La narración es nuestra.
        </p>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function BlockSection({ block, entries }: { block: BlockMeta; entries: NobelLaureate[] }) {
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
          <NobelCard key={entry.id} entry={entry} block={block} />
        ))}
      </div>
    </div>
  );
}

function NobelCard({ entry, block }: { entry: NobelLaureate; block: BlockMeta }) {
  const isLive = entry.status === 'live';
  const href = isLive ? `/masterclass.html?id=${entry.classId}` : undefined;

  const baseCardStyle: React.CSSProperties = {
    background: isLive
      ? `linear-gradient(135deg, ${block.colorBg} 0%, #0B0F17 70%)`
      : 'linear-gradient(135deg, #0B0F17 0%, #0A0E15 100%)',
    borderColor: isLive ? `${block.color}55` : '#1E293B',
  };

  const inner = (
    <>
      {/* Glow accent for live cards */}
      {isLive && (
        <div
          className="absolute -top-12 -right-12 w-[180px] h-[180px] rounded-full opacity-30 blur-[60px] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${block.colorEmissive} 0%, transparent 70%)` }}
        />
      )}

      <div className="relative z-10">
        {/* Year + status */}
        <div className="flex items-center justify-between mb-3">
          <div
            className="text-[11px] font-mono tracking-[0.2em]"
            style={{ color: isLive ? block.color : '#475569' }}
          >
            NOBEL · {entry.year}
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
