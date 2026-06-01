/**
 * LegalShell — marco compartido para páginas legales (Términos, Privacidad).
 *
 * Misma estética GAIA: fondo #05060A, luces ambientales, gradiente en el header.
 * El contenido es prosa larga, así que el shell scrollea (las apps full-screen
 * atan body a overflow:hidden vía main.css; aquí lo liberamos).
 */
import { useEffect, type ReactNode } from 'react';
import { GAIA_GRADIENT } from '../lib/gaia-access';

export type LegalSection = {
  heading: string;
  body: ReactNode;
};

export default function LegalShell({
  kicker,
  title,
  updatedAt,
  intro,
  sections,
  footerNote,
}: {
  kicker: string;
  title: string;
  updatedAt: string;
  intro: ReactNode;
  sections: LegalSection[];
  footerNote?: ReactNode;
}) {
  // Liberar el scroll (main.css fija body en overflow:hidden para apps R3F).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = { ho: html.style.overflow, hh: html.style.height, bo: body.style.overflow, bh: body.style.height };
    html.style.overflow = 'auto'; html.style.height = 'auto';
    body.style.overflow = 'auto'; body.style.height = 'auto';
    return () => {
      html.style.overflow = prev.ho; html.style.height = prev.hh;
      body.style.overflow = prev.bo; body.style.height = prev.bh;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans relative overflow-x-hidden">
      {/* Luces ambientales */}
      <div className="fixed top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none opacity-20 blur-[130px]"
        style={{ background: 'radial-gradient(circle, #7E57C2 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-25%] left-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none opacity-15 blur-[130px]"
        style={{ background: 'radial-gradient(circle, #4FC3F7 0%, transparent 70%)' }} />

      {/* Header */}
      <header className="relative z-10 px-6 py-6 max-w-[820px] mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-md flex items-center justify-center font-bold text-[#05060A] text-[20px]"
            style={{ background: GAIA_GRADIENT }}>Γ</div>
          <div>
            <div className="text-[16px] font-bold tracking-tight">GAIA</div>
            <div className="text-[10px] text-[#64748B] uppercase tracking-[0.2em]">la universidad ejecutable</div>
          </div>
        </a>
        <a href="/precios.html" className="text-[12px] text-[#94A3B8] font-mono hover:text-white transition">Planes →</a>
      </header>

      <main className="relative z-10 max-w-[820px] mx-auto px-6 pt-8 pb-24">
        {/* Encabezado del documento */}
        <div className="text-[11px] font-mono text-[#64748B] uppercase tracking-[0.2em]">{kicker}</div>
        <h1 className="mt-2 text-[34px] md:text-[44px] font-extrabold leading-tight"
          style={{ backgroundImage: GAIA_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          {title}
        </h1>
        <div className="mt-2 text-[12px] text-[#475569] font-mono">Última actualización: {updatedAt}</div>

        <div className="mt-6 rounded-2xl border border-[#1E293B] bg-[#0B0F17] p-6 text-[14px] text-[#CBD5E1] leading-relaxed">
          {intro}
        </div>

        {/* Secciones */}
        <div className="mt-8 space-y-8">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-[18px] font-bold text-white">
                <span className="text-[#64748B] font-mono text-[14px] mr-2">{i + 1}.</span>{s.heading}
              </h2>
              <div className="mt-2 text-[14px] text-[#94A3B8] leading-relaxed space-y-3">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        {footerNote && (
          <div className="mt-10 rounded-xl border border-[#1E293B] bg-[#0A0D14] p-5 text-[13px] text-[#64748B] leading-relaxed">
            {footerNote}
          </div>
        )}

        <div className="mt-10 flex items-center gap-4 text-[12px] font-mono text-[#94A3B8]">
          <a href="/terminos.html" className="hover:text-white transition">Términos</a>
          <span className="text-[#1E293B]">·</span>
          <a href="/privacidad.html" className="hover:text-white transition">Privacidad</a>
          <span className="text-[#1E293B]">·</span>
          <a href="/" className="hover:text-white transition">Inicio</a>
        </div>
      </main>

      <footer className="relative z-10 border-t border-[#0F172A] py-6 text-center text-[11px] text-[#475569] font-mono">
        Γ GAIA · De Chimalhuacán para el mundo
      </footer>
    </div>
  );
}

/** Lista con viñetas reutilizable, en la estética del shell. */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-[#34D399] mt-[3px] text-[12px]">●</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
