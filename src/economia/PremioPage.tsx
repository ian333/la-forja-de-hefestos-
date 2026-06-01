/**
 * PremioPage — hub de UN premio Nobel de Economía.
 *
 * Ruta: /premio.html?id=<id del catálogo>
 *
 * NO es teoría. Calibrado contra el guion de las masterclass:
 *   1. Gancho de estómago (hero).
 *   2. El click: el lab interactivo — "no te lo explico, pégale tú" — y 2-4
 *      líneas que nombran el ajá que acabas de sentir.
 *   3. USOS: dónde vive esto en TU vida. Cascada concreta. Esto es la carne.
 *
 * El paper / comité Nobel va chiquito al pie. Nadie lee links pasivos.
 *
 * Funciona para los 56: si no hay contenido extendido todavía, cae con gracia
 * al hero + (masterclass si existe) + resumen oficial Nobel.
 */

import { Suspense, useEffect } from 'react';
import { BLOCKS, NOBEL_CATALOG } from './nobel-catalog';
import { getPremioContent } from './premio-content';
import { PREMIO_LABS } from './labs/registry';

function nobelUrl(year: number): string {
  return `https://www.nobelprize.org/prizes/economic-sciences/${year}/summary/`;
}

// El CSS global ata html/body a overflow:hidden. El hub necesita scroll normal.
function useScrollUnlock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      ho: html.style.overflow, hh: html.style.height,
      bo: body.style.overflow, bh: body.style.height,
    };
    html.style.overflow = 'auto'; html.style.height = 'auto';
    body.style.overflow = 'auto'; body.style.height = 'auto';
    return () => {
      html.style.overflow = prev.ho; html.style.height = prev.hh;
      body.style.overflow = prev.bo; body.style.height = prev.bh;
    };
  }, []);
}

export default function PremioPage() {
  useScrollUnlock();
  const id = new URLSearchParams(window.location.search).get('id');
  const entry = id ? NOBEL_CATALOG.find(n => n.id === id) : undefined;

  if (!entry) {
    return (
      <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-[18px] font-bold mb-2">Premio no encontrado</div>
          <p className="text-[13px] text-[#94A3B8] mb-5">
            El id <code className="font-mono text-[#FDB813]">{id ?? '(vacío)'}</code> no está en el catálogo.
          </p>
          <a href="/economia.html" className="text-[13px] font-mono text-[#34D399] hover:underline">
            ← Volver a Economía Real
          </a>
        </div>
      </div>
    );
  }

  const block = BLOCKS.find(b => b.id === entry.block)!;
  const content = getPremioContent(entry.id);
  const Lab = PREMIO_LABS[entry.id];
  const accent = block.color;

  // Locales explícitos: evitan depender del narrowing de optional-chaining.
  const click = content?.click ?? [];
  const usos = content?.usos ?? [];
  const closer = content?.closer;
  const paper = content?.paper;

  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans relative overflow-x-hidden">
      {/* Fondos ambientales */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #CBD5E1 1px, transparent 0)', backgroundSize: '32px 32px' }}
      />
      <div
        className="fixed top-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full pointer-events-none opacity-20 blur-[110px]"
        style={{ background: `radial-gradient(circle, ${block.colorEmissive} 0%, transparent 70%)` }}
      />

      {/* Nav minimal */}
      <header className="relative z-10 px-6 py-5 max-w-[1080px] mx-auto flex items-center justify-between">
        <a href="/economia.html" className="text-[12px] font-mono text-[#94A3B8] hover:text-[#34D399] transition">
          ← Economía Real
        </a>
        <a href="/escuela.html" className="text-[12px] font-mono text-[#64748B] hover:text-[#FDB813] transition">
          Γ Escuela
        </a>
      </header>

      {/* ── HERO: gancho de estómago ─────────────────────────────────────── */}
      <section className="relative z-10 px-6 max-w-[1080px] mx-auto pt-4 pb-10">
        <div className="text-[11px] font-mono tracking-[0.25em] mb-5" style={{ color: accent }}>
          NOBEL · {entry.year} · {entry.laureates.join(' & ')}
        </div>

        <h1 className="text-[34px] md:text-[52px] font-extrabold leading-[1.05] tracking-tight text-white max-w-[900px]">
          {content?.hook ?? entry.title}
        </h1>

        {content ? (
          <div className="mt-4 text-[14px] text-[#64748B] font-mono">
            {entry.title} · {entry.laureates.join(', ')}
          </div>
        ) : (
          <>
            <p className="mt-5 text-[17px] text-[#CBD5E1] leading-relaxed max-w-[760px]">
              {entry.impact}
            </p>
            <p className="mt-3 text-[13px] text-[#64748B] max-w-[760px]">
              <span className="text-[#475569]">El comité premió:</span> {entry.subtitle}
            </p>
          </>
        )}

        {entry.status === 'live' && entry.classId && (
          <div className="mt-7">
            <a
              href={`/masterclass.html?id=${entry.classId}`}
              className="inline-block px-5 py-2.5 rounded-lg text-[13px] font-mono font-medium transition"
              style={{ background: `${accent}1F`, border: `1px solid ${accent}66`, color: accent }}
            >
              ▶ Ver la masterclass narrada (22 min)
            </a>
          </div>
        )}
      </section>

      {/* ── EL CLICK: el lab ES la explicación ───────────────────────────── */}
      {Lab ? (
        <section className="relative z-10 px-6 max-w-[1080px] mx-auto py-6 border-t border-[#11161F]">
          <div className="text-[10px] uppercase tracking-[0.25em] font-mono mb-2" style={{ color: accent }}>
            🎮 El click
          </div>
          <h2 className="text-[24px] md:text-[32px] font-extrabold text-white tracking-tight mb-5">
            {content?.playPrompt ?? 'Pruébalo tú'}
          </h2>
          <Suspense fallback={<LabLoading accent={accent} />}>
            <Lab />
          </Suspense>

          {click.length ? (
            <div className="mt-6 bg-[#0B0F17] border border-[#1E293B] rounded-xl p-6 md:p-7 space-y-3 max-w-[820px]">
              {click.map((line, i) => (
                <p
                  key={i}
                  className={i === 0
                    ? 'text-[18px] md:text-[20px] font-bold text-white leading-snug'
                    : 'text-[15px] text-[#CBD5E1] leading-relaxed'}
                >
                  {line}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : click.length ? (
        <section className="relative z-10 px-6 max-w-[1080px] mx-auto py-6 border-t border-[#11161F]">
          <div className="text-[10px] uppercase tracking-[0.25em] font-mono mb-2" style={{ color: accent }}>
            ✦ El click
          </div>
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-xl p-6 md:p-7 space-y-3 max-w-[820px]">
            {click.map((line, i) => (
              <p key={i} className={i === 0
                ? 'text-[18px] md:text-[20px] font-bold text-white leading-snug'
                : 'text-[15px] text-[#CBD5E1] leading-relaxed'}>
                {line}
              </p>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-[#475569]">
            🎮 La animación interactiva de este premio viene en camino.{' '}
            <a href={nobelUrl(entry.year)} target="_blank" rel="noreferrer" className="hover:text-[#94A3B8] underline">
              resumen Nobel ↗
            </a>
          </p>
        </section>
      ) : !content ? (
        <section className="relative z-10 px-6 max-w-[1080px] mx-auto py-6 border-t border-[#11161F]">
          <div className="bg-[#0B0F17] border border-[#1E293B] rounded-xl p-8 text-center">
            <div className="text-[15px] text-white font-medium mb-2">
              La animación interactiva de este premio está en producción.
            </div>
            <p className="text-[13px] text-[#94A3B8] max-w-[520px] mx-auto leading-relaxed mb-5">
              Es la siguiente en la fila. Mientras, si ya hay masterclass arriba, esa te cuenta toda la historia.
            </p>
            <a
              href={nobelUrl(entry.year)}
              target="_blank" rel="noreferrer"
              className="inline-block px-5 py-2.5 rounded-lg text-[13px] font-mono transition"
              style={{ background: `${accent}1F`, border: `1px solid ${accent}66`, color: accent }}
            >
              Ver el premio Nobel {entry.year} ↗
            </a>
          </div>
        </section>
      ) : null}

      {/* ── USOS: dónde vive esto en TU vida ─────────────────────────────── */}
      {usos.length ? (
        <section className="relative z-10 px-6 max-w-[1080px] mx-auto py-8 border-t border-[#11161F]">
          <div className="text-[10px] uppercase tracking-[0.25em] font-mono mb-2 text-[#FDB813]">
            🌮 Dónde vive esto — en serio
          </div>
          <h2 className="text-[24px] md:text-[32px] font-extrabold text-white tracking-tight mb-6">
            No es teoría. Es tu semana.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {usos.map((u, i) => (
              <div
                key={i}
                className="bg-[#0B0F17] border border-[#1E293B] rounded-xl p-5 hover:border-[#FDB813]/30 transition"
              >
                <div className="text-[15px] font-extrabold mb-2" style={{ color: '#FDB813' }}>
                  {u.where}
                </div>
                <p className="text-[14px] text-[#CBD5E1] leading-relaxed">{u.punch}</p>
              </div>
            ))}
          </div>

          {closer && (
            <p className="mt-7 text-[19px] md:text-[22px] font-bold text-white leading-snug max-w-[820px]">
              {closer}
            </p>
          )}
        </section>
      ) : null}

      {/* ── Pie: paper + nobel, chiquito ─────────────────────────────────── */}
      <footer className="relative z-10 px-6 py-10 border-t border-[#11161F] max-w-[1080px] mx-auto mt-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono text-[#475569]">
          <a href="/economia.html" className="hover:text-[#34D399] transition">← todos los premios</a>
          {paper ? (
            <a href={paper.url ?? nobelUrl(entry.year)} target="_blank" rel="noreferrer" className="hover:text-[#94A3B8] transition">
              {paper.ref} ↗
            </a>
          ) : (
            <a href={nobelUrl(entry.year)} target="_blank" rel="noreferrer" className="hover:text-[#94A3B8] transition">
              comité Nobel {entry.year} ↗
            </a>
          )}
        </div>
        <p className="mt-4 text-[10px] text-[#334155]">
          GAIA · La Forja de Hefestos · datos verificados contra NobelPrize.org y los papers originales.
        </p>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function LabLoading({ accent }: { accent: string }) {
  return (
    <div className="bg-[#0B0F17] border border-[#1E293B] rounded-xl h-[300px] flex items-center justify-center">
      <div className="text-center">
        <div
          className="w-10 h-10 rounded-full border-2 border-[#1E293B] animate-spin mx-auto"
          style={{ borderTopColor: accent }}
        />
        <div className="mt-3 text-[12px] text-[#94A3B8]">cargando el caballito…</div>
      </div>
    </div>
  );
}
