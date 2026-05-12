/**
 * EscuelaPortal — la portada de la escuela GAIA.
 *
 *   "Reinventar la enseñanza con tres pilares: matemáticas, física, química.
 *    3D-real. Sin pizarrón aburrido."
 *
 * Layout: hero con 3 tarjetas grandes (Σ Mate · Φ Física · ⚗ Química).
 * Cada una linkea a su SPA con su lesson layer integrado.
 */

export default function EscuelaPortal() {
  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans relative overflow-hidden">
      {/* Animated grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #CBD5E1 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Hero ambient lights */}
      <div
        className="fixed top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none opacity-30 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #7E57C2 0%, transparent 70%)' }}
      />
      <div
        className="fixed bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none opacity-25 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #4FC3F7 0%, transparent 70%)' }}
      />

      {/* Header */}
      <header className="relative z-10 px-6 py-6 max-w-[1400px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#4FC3F7] via-[#7E57C2] to-[#F472B6] flex items-center justify-center font-bold text-[#05060A] text-[20px]">
            Γ
          </div>
          <div>
            <div className="text-[16px] font-bold tracking-tight">GAIA Escuela</div>
            <div className="text-[10px] text-[#64748B] uppercase tracking-[0.2em]">3D-real · sin pizarrón</div>
          </div>
        </div>
        <nav className="flex items-center gap-4 text-[12px] text-[#94A3B8] font-mono">
          <a href="/" className="hover:text-[#FDB813] transition">← La Forja CAD</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 max-w-[1400px] mx-auto pt-12 pb-16 text-center">
        <div className="text-[11px] uppercase tracking-[0.3em] text-[#FDB813] mb-4">
          La escuela que querías cuando ibas a clase
        </div>
        <h1 className="text-[64px] md:text-[88px] font-extrabold leading-[0.95] tracking-tight">
          <span className="text-white">Tres pilares.</span><br />
          <span className="bg-gradient-to-r from-[#4FC3F7] via-[#7E57C2] to-[#F472B6] bg-clip-text text-transparent">
            Una clase de verdad.
          </span>
        </h1>
        <p className="mt-8 text-[18px] text-[#CBD5E1] max-w-[720px] mx-auto leading-relaxed">
          Cada módulo es un <strong className="text-white">simulador en 3D real</strong> con una{' '}
          <strong className="text-white">clase guiada</strong> que te lleva paso a paso. Animaciones
          sincronizadas con la narrativa. La intuición primero, las ecuaciones después.
        </p>
        <p className="mt-3 text-[13px] text-[#94A3B8] font-mono">
          Feynman · 3Blue1Brown · Needham · Strogatz — su método, ejecutable.
        </p>
      </section>

      {/* 3 pillars */}
      <section className="relative z-10 px-6 max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 pb-20">
        <PillarCard
          href="/math.html"
          glyph="Σ"
          name="Matemáticas"
          accent="#4FC3F7"
          bgFrom="from-[#4FC3F7]/20"
          bgTo="to-[#1E40AF]/10"
          quote="Spivak · Strang · Needham · Hatcher"
          tagline="Las matemáticas no se memorizan, se ven."
          modules={[
            'Plano tangente y gradiente',
            'Derivada como recta tangente',
            'Integral por sumas de Riemann',
            'Series de Taylor',
            'Campos vectoriales y divergencia',
            'Eigenvectores 3D (Strang)',
            'Möbius / esfera de Riemann (Needham)',
            'Retrato de fases 2D',
          ]}
          stats="8 live · 22 totales"
        />
        <PillarCard
          href="/physics.html"
          glyph="Φ"
          name="Física"
          accent="#7E57C2"
          bgFrom="from-[#7E57C2]/20"
          bgTo="to-[#4A148C]/10"
          quote="Feynman Lectures · Strogatz · Penrose"
          tagline="La física real, no clases — vé y toca."
          modules={[
            'Péndulo doble (caos clásico)',
            'Sistema solar (N-body Newton)',
            'Schwarzschild GR (Mercurio 43"/siglo)',
            'Campos EM (Maxwell + Lorentz)',
            'Átomo a enlace (H₂ Hartree-Fock)',
            'Doble hélice B-DNA',
            'Visor de proteínas (PDB real)',
            'Docking (proteasa VIH + saquinavir)',
            'Dogma central (DNA→RNA→proteína)',
            'Escalas biológicas (Powers of Ten)',
          ]}
          stats="10 live · todas con clase"
        />
        <PillarCard
          href="/lab.html"
          glyph="⚗"
          name="Química"
          accent="#F472B6"
          bgFrom="from-[#F472B6]/20"
          bgTo="to-[#831843]/10"
          quote="Atkins · Pauling · Clayden"
          tagline="Química desde la cuántica."
          modules={[
            'Tabla periódica 118 elementos',
            'Átomo multi-electrón (ψ² real)',
            'Configuración electrónica',
            'Orbitales y valencia',
            'Enlace químico',
            'Reacciones y cinética',
            'Sandbox experimental',
          ]}
          stats="GAIA Lab · 376 tests"
        />
      </section>

      {/* Manifesto */}
      <section className="relative z-10 px-6 max-w-[900px] mx-auto pb-16 text-[14px] leading-relaxed text-[#CBD5E1] space-y-4">
        <h2 className="text-[24px] font-semibold text-white">¿Por qué esta escuela?</h2>
        <p>
          Porque las matemáticas se enseñan como cómputo, no como arte (Lockhart 2002).
          Porque la física se enseña como ecuaciones, no como fenómenos (Feynman 1963).
          Porque las clases son pizarrones aburridos cuando deberían ser laboratorios vivos.
        </p>
        <p>
          Acá <strong className="text-white">CADA módulo es una clase y un simulador a la vez</strong>.
          Una pestaña "Clase" te lleva paso a paso por una historia con animaciones sincronizadas.
          Otra pestaña "Sandbox" te da todos los controles para jugar libremente.
        </p>
        <p>
          Si Newton, Maxwell, Einstein o Pauling pudieran enseñar hoy, lo harían así.
        </p>
        <p className="text-[#64748B] text-[12px] mt-8 font-mono">
          La Forja de Hefestos · Hecho en México 🇲🇽 · Open source
        </p>
      </section>
    </div>
  );
}

interface PillarCardProps {
  href: string;
  glyph: string;
  name: string;
  accent: string;
  bgFrom: string;
  bgTo: string;
  quote: string;
  tagline: string;
  modules: string[];
  stats: string;
}

function PillarCard({ href, glyph, name, accent, bgFrom, bgTo, quote, tagline, modules, stats }: PillarCardProps) {
  return (
    <a
      href={href}
      className={`group block rounded-2xl border border-[#1E293B] bg-gradient-to-br ${bgFrom} ${bgTo} p-6 hover:border-white/20 transition-all hover:scale-[1.02] hover:shadow-2xl`}
      style={{ '--accent': accent } as React.CSSProperties}
    >
      <div className="flex items-start justify-between mb-5">
        <div
          className="w-14 h-14 rounded-xl bg-[#05060A] border flex items-center justify-center text-[28px] font-bold"
          style={{ borderColor: accent + '60', color: accent }}
        >
          {glyph}
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-2 text-right">
          {stats}
        </div>
      </div>

      <h2 className="text-[28px] font-bold text-white mb-1">{name}</h2>
      <div className="text-[13px] text-[#CBD5E1] italic mb-1">{tagline}</div>
      <div className="text-[10px] font-mono text-[#64748B] mb-5">{quote}</div>

      <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2">Módulos</div>
      <ul className="space-y-1 text-[12px] text-[#CBD5E1]">
        {modules.slice(0, 6).map((m, i) => (
          <li key={i} className="flex items-start gap-2 leading-snug">
            <span style={{ color: accent }} className="mt-0.5">·</span>
            <span>{m}</span>
          </li>
        ))}
        {modules.length > 6 && (
          <li className="text-[#64748B] italic">+ {modules.length - 6} más…</li>
        )}
      </ul>

      <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[12px]">
        <span className="text-[#94A3B8]">Entrar →</span>
        <span style={{ color: accent }} className="font-mono group-hover:translate-x-1 transition-transform">⇒</span>
      </div>
    </a>
  );
}
