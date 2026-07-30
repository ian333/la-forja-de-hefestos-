/**
 * EscuelaPortal — la portada de la escuela GAIA.
 *
 *   "Reinventar la enseñanza con tres pilares: matemáticas, física, química.
 *    3D-real. Sin pizarrón aburrido."
 *
 * Layout: hero con 3 tarjetas grandes (Σ Mate · Φ Física · ⚗ Química).
 * Cada una linkea a su SPA con su lesson layer integrado.
 *
 * NOTA: main.css define `html, body { overflow: hidden }` globalmente (lo que
 * conviene para las apps full-screen tipo CAD/Math Lab/Masterclass que tienen
 * scroll interno). El portal SÍ debe scrollearse, así que liberamos el body
 * mientras esté montado y lo restauramos al desmontar.
 */

import { useEffect } from 'react';

export default function EscuelaPortal() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
    };
    // Liberar tanto overflow como height — el CSS global ata html/body a 100%
    // height + overflow:hidden (para apps full-screen). El portal necesita que
    // la página crezca y se scrollee normalmente.
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

  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans relative overflow-x-hidden">
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
        {/* NAV: nueve enlaces NO caben en 360 px — se desbordaban por el borde
            derecho (medido con visitantes reales de la campaña de IG). En móvil
            solo va "Clases", que es lo único que le sirve a quien acaba de
            llegar; el resto aparece desde `sm`. */}
        <nav className="hidden sm:flex items-center gap-5 text-[12px] text-[#94A3B8] font-mono">
          <a href="/perfil.html" className="hover:text-[#FDB813] transition">Tu recorrido</a>
          <a href="#carreras" className="hover:text-[#FDB813] transition">Carreras</a>
          <a href="#misiones" className="hover:text-[#FDB813] transition">Misiones</a>
          <a href="#software" className="hover:text-[#FDB813] transition">Software</a>
          <a href="/forja-brep.html" className="hover:text-[#FDB813] transition">Forja →</a>
          <a href="/solver.html" className="hover:text-[#FDB813] transition">Resolver →</a>
          <a href="/reporte.html" className="hover:text-[#FDB813] transition">Reporte →</a>
          <a href="/tutoriales.html" className="hover:text-[#FDB813] transition">Tutoriales →</a>
          <a href="/precios.html" className="hover:text-[#FDB813] transition">Planes →</a>
        </nav>
        <a href="#clases" className="sm:hidden text-[12px] font-mono text-[#FDB813] border border-[#FDB813]/40 rounded-lg px-3 py-1.5">
          Clases
        </a>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          PRIMER PANTALLAZO EN MÓVIL — la clase ES el hero.
          Antes: "Cinco pilares. Una clase de verdad." en 64 px empujaba TODA
          la oferta fuera de pantalla; los dos visitantes de pago medidos el
          2026-07-30 (iPhone de Argentina y Android de México) se fueron en
          ≤1.9 s sin tocar nada. Un anuncio promete algo concreto y la página
          contestaba con un eslogan.
          Ahora lo primero es un FRAME REAL del render de la clase (no un
          gradiente: el pixel que produce el simulador), el dato que marea, y
          UN botón que dice qué pasa al tocarlo. En `md` vuelve el hero de
          escritorio, que ahí sí funcionaba.
          ═══════════════════════════════════════════════════════════════════ */}
      <a href="/masterclass.html?id=blackhole" className="md:hidden relative z-10 block px-4 pt-1 pb-8 group">
        {/* El objeto SOLO, sin texto encima: es la doctrina visual del proyecto
            (un objeto, fondo negro, sin competencia) y además el título en
            ámbar sobre el disco ámbar perdía contraste. El texto vive debajo,
            en negro puro. */}
        <div className="relative rounded-2xl overflow-hidden border border-[#FDB813]/25">
          <img
            src="/img/bh-hero.webp" alt="Agujero negro con su disco de acreción curvado por la gravedad"
            width={1400} height={787} fetchPriority="high" decoding="async"
            className="w-full h-[31vh] min-h-[190px] object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#05060A] to-transparent" />
        </div>
        <div className="mt-4 text-[10px] font-mono uppercase tracking-[0.28em] text-[#FDB813]">
          Física · Clase 1
        </div>
        {/* UN acento, no tres. El color ya lo pone la imagen. */}
        <h1 className="mt-2 text-[31px] font-extrabold leading-[1.04] tracking-tight text-white">
          Una hora aquí,<br />
          <span className="text-[#FDB813]">siete años en casa.</span>
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[#CBD5E1]">
          El planeta de Miller, Gargantua y TON&nbsp;618: por qué el tiempo se dobla
          cerca de un agujero negro.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border-2 border-[#FDB813] bg-[#FDB813]/15 px-6 py-4 text-[17px] font-bold text-[#FDB813]">
          <span aria-hidden>▶</span> Ver la clase
        </div>
        <p className="mt-3 text-center text-[10.5px] font-mono text-[#64748B]">
          30 escenas · narrada · simulador en vivo
        </p>
      </a>

      {/* Hero de ESCRITORIO (en móvil manda el bloque de la clase, arriba) */}
      <section className="hidden md:block relative z-10 px-6 max-w-[1400px] mx-auto pt-12 pb-16 text-center">
        <div className="text-[11px] uppercase tracking-[0.3em] text-[#FDB813] mb-4">
          La escuela que querías cuando ibas a clase
        </div>
        <h1 className="text-[64px] md:text-[88px] font-extrabold leading-[0.95] tracking-tight">
          <span className="text-white">Cinco pilares.</span><br />
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

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MASTERCLASS — clases narradas por Matilda                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section id="clases" className="relative z-10 px-6 max-w-[1400px] mx-auto pb-12">
        {/* Física · Clase 1 — Agujeros negros.
            En móvil se OCULTA: es exactamente la clase que ya ocupa el primer
            pantallazo, y repetirla empujaba las demás aún más abajo. */}
        <a
          href="/masterclass.html?id=blackhole"
          className="hidden md:block group relative rounded-3xl overflow-hidden border-2 border-[#FDB813]/30 hover:border-[#FDB813] transition-all mb-6"
          style={{
            background: 'linear-gradient(135deg, #1A0F08 0%, #05060A 55%, #150B22 100%)',
          }}
        >
          <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-30 blur-[100px] pointer-events-none"
               style={{ background: 'radial-gradient(circle, #FDB813 0%, transparent 70%)' }} />
          <div className="absolute -bottom-32 -left-32 w-[480px] h-[480px] rounded-full opacity-25 blur-[100px] pointer-events-none"
               style={{ background: 'radial-gradient(circle, #F472B6 0%, transparent 70%)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full pointer-events-none opacity-20"
               style={{ background: 'radial-gradient(circle, #FDB813 0%, #F472B6 30%, transparent 60%)' }} />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center p-10 md:p-12">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#FDB813] mb-4">
                ▶ Física · Clase 1 / 12 · ESTRENO
              </div>
              <h2 className="text-[44px] md:text-[56px] font-extrabold leading-[0.95] tracking-tight text-white mb-4">
                Gargantua,<br />
                <span className="bg-gradient-to-r from-[#FDB813] via-[#F472B6] to-[#4FC3F7] bg-clip-text text-transparent">
                  TON 618 y los monstruos.
                </span>
              </h2>
              <p className="text-[16px] text-[#CBD5E1] max-w-[680px] leading-relaxed mb-3">
                Schwarzschild 1916 a EHT 2019, pasando por LIGO, Kip Thorne y el planeta de Miller — 1 h = 7 años.
                La geometría del infinito, contada en treinta escenas de tres dimensiones reales, con un simulador
                interactivo que cambia masa, espín, Doppler beaming y dilatación temporal en vivo.
              </p>
              <p className="text-[12px] text-[#64748B] font-mono">
                Narrada por Matilda · 30 escenas · Schwarzschild → LIGO 2015
              </p>
            </div>

            <div className="flex flex-col items-center md:items-end gap-4">
              <div className="px-8 py-4 rounded-xl border-2 border-[#FDB813] bg-[#FDB813]/15 text-[#FDB813] group-hover:bg-[#FDB813]/30 transition text-[18px] font-bold tracking-wide whitespace-nowrap">
                ▶  Empezar la clase
              </div>
              <div className="text-[10px] text-[#64748B] font-mono uppercase tracking-[0.2em]">
                Schwarzschild · Kerr · Thorne · EHT · LIGO
              </div>
            </div>
          </div>
        </a>

        <a
          href="/masterclass.html?id=i"
          className="group block relative rounded-3xl overflow-hidden border-2 border-[#FDB813]/30 hover:border-[#FDB813] transition-all"
          style={{
            background: 'linear-gradient(135deg, #1B0F20 0%, #0B0F17 60%, #1A1308 100%)',
          }}
        >
          {/* Ambient glow */}
          <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-30 blur-[100px] pointer-events-none"
               style={{ background: 'radial-gradient(circle, #FDB813 0%, transparent 70%)' }} />
          <div className="absolute -bottom-32 -left-32 w-[480px] h-[480px] rounded-full opacity-20 blur-[100px] pointer-events-none"
               style={{ background: 'radial-gradient(circle, #F472B6 0%, transparent 70%)' }} />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center p-10 md:p-12">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#FDB813] mb-4">
                ▶ Masterclass GAIA · estreno
              </div>
              <h2 className="text-[44px] md:text-[56px] font-extrabold leading-[0.95] tracking-tight text-white mb-4">
                El número<br />
                <span className="bg-gradient-to-r from-[#FDB813] via-[#F472B6] to-[#4FC3F7] bg-clip-text text-transparent">
                  que no debería existir.
                </span>
              </h2>
              <p className="text-[16px] text-[#CBD5E1] max-w-[640px] leading-relaxed mb-3">
                Una sola idea — la unidad imaginaria <strong className="text-white">i</strong> — atraviesa el plano
                complejo, los fractales de Newton, el ala del avión y termina haciendo girar
                un motor eléctrico real. Cuatro siglos en menos de cinco minutos.
              </p>
              <p className="text-[12px] text-[#64748B] font-mono">
                Narrada por Matilda · 18 escenas · 3D-real continuo
              </p>
            </div>

            <div className="flex flex-col items-center md:items-end gap-4">
              <div className="px-8 py-4 rounded-xl border-2 border-[#FDB813] bg-[#FDB813]/15 text-[#FDB813] group-hover:bg-[#FDB813]/30 transition text-[18px] font-bold tracking-wide whitespace-nowrap">
                ▶  Empezar la clase
              </div>
              <div className="text-[10px] text-[#64748B] font-mono uppercase tracking-[0.2em]">
                pantalla completa · audio · ~5 min
              </div>
            </div>
          </div>
        </a>

        {/* Cálculo · Clase 1 — Lo infinitamente pequeño */}
        <a
          href="/masterclass.html?id=calc-infinitesimal"
          className="group block relative rounded-3xl overflow-hidden border-2 border-[#4FC3F7]/30 hover:border-[#4FC3F7] transition-all mt-6"
          style={{
            background: 'linear-gradient(135deg, #061829 0%, #0B0F17 55%, #1A0820 100%)',
          }}
        >
          <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full opacity-25 blur-[100px] pointer-events-none"
               style={{ background: 'radial-gradient(circle, #4FC3F7 0%, transparent 70%)' }} />
          <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full opacity-20 blur-[100px] pointer-events-none"
               style={{ background: 'radial-gradient(circle, #F472B6 0%, transparent 70%)' }} />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center p-10 md:p-12">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#4FC3F7] mb-4">
                ▶ Cálculo · Clase 1 / 7
              </div>
              <h2 className="text-[40px] md:text-[52px] font-extrabold leading-[0.95] tracking-tight text-white mb-4">
                Lo infinitamente<br />
                <span className="bg-gradient-to-r from-[#4FC3F7] via-[#FDB813] to-[#F472B6] bg-clip-text text-transparent">
                  pequeño.
                </span>
              </h2>
              <p className="text-[16px] text-[#CBD5E1] max-w-[640px] leading-relaxed mb-3">
                Zenón dijo que el movimiento no existe. Newton y Leibniz le respondieron capturando el instante.
                Una pregunta — qué pasa <em>ahora mismo</em> — atraviesa la derivada, la integral, las series de
                Taylor, los campos vectoriales y termina en las ecuaciones de Maxwell.
              </p>
              <p className="text-[12px] text-[#64748B] font-mono">
                Narrada por Matilda · 18 escenas · Zenón → Maxwell
              </p>
            </div>

            <div className="flex flex-col items-center md:items-end gap-4">
              <div className="px-8 py-4 rounded-xl border-2 border-[#4FC3F7] bg-[#4FC3F7]/15 text-[#4FC3F7] group-hover:bg-[#4FC3F7]/30 transition text-[18px] font-bold tracking-wide whitespace-nowrap">
                ▶  Empezar la clase
              </div>
              <div className="text-[10px] text-[#64748B] font-mono uppercase tracking-[0.2em]">
                Newton · Leibniz · Taylor · Maxwell
              </div>
            </div>
          </div>
        </a>

        {/* Álgebra Lineal · Clase 2 — El esqueleto escondido */}
        <a
          href="/masterclass.html?id=linalg-esqueleto"
          className="group block relative rounded-3xl overflow-hidden border-2 border-[#7E57C2]/30 hover:border-[#7E57C2] transition-all mt-6"
          style={{
            background: 'linear-gradient(135deg, #150B22 0%, #0B0F17 55%, #1A0F08 100%)',
          }}
        >
          <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full opacity-25 blur-[100px] pointer-events-none"
               style={{ background: 'radial-gradient(circle, #7E57C2 0%, transparent 70%)' }} />
          <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full opacity-20 blur-[100px] pointer-events-none"
               style={{ background: 'radial-gradient(circle, #FDB813 0%, transparent 70%)' }} />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center p-10 md:p-12">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#7E57C2] mb-4">
                ▶ Álgebra lineal · Clase 2 / 7
              </div>
              <h2 className="text-[40px] md:text-[52px] font-extrabold leading-[0.95] tracking-tight text-white mb-4">
                El esqueleto<br />
                <span className="bg-gradient-to-r from-[#7E57C2] via-[#FDB813] to-[#34D399] bg-clip-text text-transparent">
                  escondido.
                </span>
              </h2>
              <p className="text-[16px] text-[#CBD5E1] max-w-[640px] leading-relaxed mb-3">
                Todas las matrices tienen <em>direcciones</em> que no rotan, solo estiran. Los eigenvectores.
                La misma idea conecta el cubo unitario, las rotaciones 3D, los cuaterniones de Hamilton y el PCA
                de una galaxia de datos. Strang, en cinco minutos.
              </p>
              <p className="text-[12px] text-[#64748B] font-mono">
                Narrada por Matilda · 18 escenas · Cayley → Eigenfaces
              </p>
            </div>

            <div className="flex flex-col items-center md:items-end gap-4">
              <div className="px-8 py-4 rounded-xl border-2 border-[#7E57C2] bg-[#7E57C2]/15 text-[#7E57C2] group-hover:bg-[#7E57C2]/30 transition text-[18px] font-bold tracking-wide whitespace-nowrap">
                ▶  Empezar la clase
              </div>
              <div className="text-[10px] text-[#64748B] font-mono uppercase tracking-[0.2em]">
                Euler · Hamilton · Cayley · Pentland
              </div>
            </div>
          </div>
        </a>

        {/* Economía Real · Clase 1 — Los Limones */}
        <a
          href="/masterclass.html?id=econ-01-limones"
          className="group block relative rounded-3xl overflow-hidden border-2 border-[#34D399]/30 hover:border-[#34D399] transition-all mt-6"
          style={{
            background: 'linear-gradient(135deg, #08201A 0%, #0B0F17 55%, #1A1408 100%)',
          }}
        >
          <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full opacity-25 blur-[100px] pointer-events-none"
               style={{ background: 'radial-gradient(circle, #34D399 0%, transparent 70%)' }} />
          <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full opacity-20 blur-[100px] pointer-events-none"
               style={{ background: 'radial-gradient(circle, #FDB813 0%, transparent 70%)' }} />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center p-10 md:p-12">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#34D399] mb-4">
                ▶ Economía Real · Clase 1 / 56
              </div>
              <h2 className="text-[40px] md:text-[52px] font-extrabold leading-[0.95] tracking-tight text-white mb-4">
                Los limones,<br />
                <span className="bg-gradient-to-r from-[#34D399] via-[#FDB813] to-[#F472B6] bg-clip-text text-transparent">
                  o cómo se mueren los mercados solos.
                </span>
              </h2>
              <p className="text-[16px] text-[#CBD5E1] max-w-[640px] leading-relaxed mb-3">
                Akerlof, mil novecientos setenta. Catorce páginas que tres journals rechazaron, y treinta y un años
                después se volvieron Nobel. Una idea simple — información asimétrica — explica por qué tu carro nuevo
                pierde 20% al salir del lote, por qué Obamacare es obligatorio y por qué Toyota existe.
              </p>
              <p className="text-[12px] text-[#64748B] font-mono">
                Narrada por Matilda · 18 escenas · sin gurús · pura ciencia
              </p>
            </div>

            <div className="flex flex-col items-center md:items-end gap-4">
              <div className="px-8 py-4 rounded-xl border-2 border-[#34D399] bg-[#34D399]/15 text-[#34D399] group-hover:bg-[#34D399]/30 transition text-[18px] font-bold tracking-wide whitespace-nowrap">
                ▶  Empezar la clase
              </div>
              <div className="text-[10px] text-[#64748B] font-mono uppercase tracking-[0.2em]">
                Akerlof · Spence · Stiglitz · Nobel 2001
              </div>
            </div>
          </div>
        </a>

        {/* Pasarelas a los catálogos de premios — Mate · Física · Economía */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <a
            href="/math-prizes.html"
            className="block px-5 py-4 rounded-xl border border-[#4FC3F7]/30 hover:border-[#4FC3F7]/70 bg-[#0B0F17]/60 hover:bg-[#4FC3F7]/5 transition-all text-center group"
          >
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#4FC3F7] mb-1">
              ✦ Universidad · Módulo Mate
            </div>
            <div className="text-[14px] text-[#CBD5E1] font-medium">
              Medallas Fields + Premio Abel →
            </div>
            <div className="text-[10px] text-[#64748B] mt-1 font-mono">
              1936-2024 · ~95 laureados · 10 bloques
            </div>
          </a>
          <a
            href="/physics-nobel.html"
            className="block px-5 py-4 rounded-xl border border-[#A78BFA]/30 hover:border-[#A78BFA]/70 bg-[#0B0F17]/60 hover:bg-[#A78BFA]/5 transition-all text-center group"
          >
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#A78BFA] mb-1">
              ✦ Universidad · Módulo Física
            </div>
            <div className="text-[14px] text-[#CBD5E1] font-medium">
              Premios Nobel de Física →
            </div>
            <div className="text-[10px] text-[#64748B] mt-1 font-mono">
              1901-2024 · cuántica · gravedad · partículas
            </div>
          </a>
          <a
            href="/economia.html"
            className="block px-5 py-4 rounded-xl border border-[#34D399]/30 hover:border-[#34D399]/70 bg-[#0B0F17]/60 hover:bg-[#34D399]/5 transition-all text-center group"
          >
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#34D399] mb-1">
              ✦ Universidad · Módulo Economía
            </div>
            <div className="text-[14px] text-[#CBD5E1] font-medium">
              56 Premios Nobel de Economía →
            </div>
            <div className="text-[10px] text-[#64748B] mt-1 font-mono">
              1969-2024 · 12 bloques temáticos
            </div>
          </a>
        </div>
      </section>

      {/* 3 pillars */}
      <section className="relative z-10 px-6 max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-20">
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
        <PillarCard
          href="/economia.html"
          glyph="₿"
          name="Economía"
          accent="#34D399"
          bgFrom="from-[#34D399]/20"
          bgTo="to-[#0F766E]/10"
          quote="Akerlof · Coase · Sen · Roth · Acemoglu · Thaler"
          tagline="La ciencia, sin gurús — puros Nobel."
          modules={[
            'Los limones (Akerlof) ▶ live',
            'Make-vs-Buy (Coase) ▶ live',
            'Señalización (Spence) ▶ live',
            'Contratos (Hart-Holmström) ▶ live',
            'Plataformas (Tirole) ▶ live',
            'Equilibrio Nash ▶ live',
            'Crecimiento (Solow) ▶ live',
            'Prospect theory (Kahneman) ▶ live',
            'Instituciones (Acemoglu) ▶ live',
            'Monetarismo (Friedman) ▶ live',
            'Matching (Roth-Shapley) ▶ live',
            'Capabilities (Sen) ▶ live',
            'Portafolios (Markowitz-Sharpe) ▶ live',
            'Nudges (Thaler) ▶ live',
            'Comunes (Ostrom) ▶ live · ABM',
            'Expectativas racionales (Lucas) ▶ live · sim',
            'Subastas Vickrey ▶ live · sim',
          ]}
          stats="56 Nobel · 17 live · 41 sims"
        />
        <PillarCard
          href="/forja-brep.html?leccion=mec-u1-l1"
          glyph="⚙"
          name="Mecánica"
          accent="#FDB813"
          bgFrom="from-[#FDB813]/20"
          bgTo="to-[#92400E]/10"
          quote="Bethune · diseño y gráficos de ingeniería"
          tagline="Diseña piezas reales en un CAD real — el kernel califica."
          modules={[
            'Tu primera pieza ▶ live',
            'El croquis es el idioma',
            'Del croquis al sólido (features)',
            'Vistas ortográficas (planos de taller)',
            'Ensambles',
            'Roscas y tornillería (DIN real)',
            'Acotación ANSI',
            'Tolerancias y ajustes (GD&T)',
            'Baleros y ajustes',
            'Engranes (involuta real)',
            'Certificación Forjador',
          ]}
          stats="11 unidades · 59 lecciones · CAD propio"
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CARRERAS — playlist curada sobre el grafo de módulos         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section id="carreras" className="relative z-10 px-6 max-w-[1400px] mx-auto pt-8 pb-16">
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#4FC3F7] mb-2">Carreras mapeadas</div>
            <h2 className="text-[32px] font-bold text-white">Tu carrera, ejecutable.</h2>
          </div>
          <a href="/carreras.html" className="text-[12px] font-mono text-[#94A3B8] hover:text-[#FDB813] transition">
            Ver las 16 →
          </a>
        </div>
        <p className="text-[14px] text-[#94A3B8] max-w-[680px] mb-8">
          Mapeo materia-por-materia entre planes oficiales del IPN/UNAM y los módulos Forja.
          Cada carrera es solo una <strong className="text-white">playlist sugerida</strong>: tú decides la ruta.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOP_CARRERAS.map((c) => <CarreraCard key={c.label} {...c} />)}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MISIONES — misiones, no materias                              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section id="misiones" className="relative z-10 px-6 max-w-[1400px] mx-auto pb-16">
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#F472B6] mb-2">Misiones, no materias</div>
            <h2 className="text-[32px] font-bold text-white">Descubre tú mismo.</h2>
          </div>
          <a href="/misiones.html" className="text-[12px] font-mono text-[#94A3B8] hover:text-[#FDB813] transition">
            Ver todas →
          </a>
        </div>
        <p className="text-[14px] text-[#94A3B8] max-w-[680px] mb-8">
          Cada misión te lleva a manipular el simulador hasta que descubres el concepto tú solo.
          Sin exámenes — tu evidencia es la simulación que dejaste corriendo.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <MisionCard
            href="/misiones.html#h2o-bent"
            accent="#4FC3F7"
            chapter="01"
            title="¿Por qué el agua se dobla?"
            blurb="Manipula H₂O, mide el ángulo, compara con NIST (104.52°). Sin que te lo digamos, vas a descubrir VSEPR."
            tools={['PeriodicTable', 'VSEPR', 'MO viewer', 'NIST CCCBDB']}
            time="20 min"
            level="Bachillerato → Universidad"
          />
          <MisionCard
            href="/misiones.html#coming"
            accent="#7E57C2"
            chapter="02"
            title="Construye un cohete químico"
            blurb="Balancea CH₄ + 2O₂, calcula ΔH NIST, optimiza T para máxima velocidad de escape."
            tools={['Reacciones', 'Arrhenius', 'Termoquímica']}
            time="30 min"
            level="Universidad"
            comingSoon
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SOFTWARE — los simuladores como producto, con tier PRO        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section id="software" className="relative z-10 px-6 max-w-[1400px] mx-auto pb-16">
        <div className="mb-2">
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#FDB813] mb-2">El software es la clase</div>
          <h2 className="text-[32px] font-bold text-white">Herramientas pro, gratis para estudiantes.</h2>
        </div>
        <p className="text-[14px] text-[#94A3B8] max-w-[720px] mb-8">
          Todo simulador básico es libre y siempre lo será.{' '}
          <span className="text-[#FDB813]">PRO</span> desbloquea PDBs grandes, MD en GPU,
          export STEP/IGES, tutor LLM con tu trazo, y notebooks colaborativos.
          Estudiantes verificados pagan 0; profesionales pagan.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SoftwareCard
            href="/lab.html"
            glyph="⚗"
            name="GAIA Lab"
            tagline="Química 3D-real"
            highlights={['Tabla periódica viva', 'VSEPR + MOs', '9 reacciones NIST']}
            accent="#F472B6"
          />
          <SoftwareCard
            href="/physics.html"
            glyph="Φ"
            name="Physics Lab"
            tagline="Mecánica · EM · GR · Bio"
            highlights={['Sistema solar N-body', 'Maxwell-Lorentz', 'Schwarzschild GR', 'Docking Vinardo']}
            accent="#7E57C2"
          />
          <SoftwareCard
            href="/math.html"
            glyph="Σ"
            name="Math Lab"
            tagline="Cálculo · Compleja · Lineal"
            highlights={['Möbius/Riemann', 'PCA 3D', 'Phase portraits']}
            accent="#4FC3F7"
          />
          <SoftwareCard
            href="/forja-brep.html"
            glyph="⚒"
            name="La Forja · CAD"
            tagline="B-Rep · kernel OpenCASCADE"
            highlights={['Sketch → Extrude exacto', 'FEA von Mises', 'Engranes que embonan', 'Export STEP']}
            accent="#FDB813"
            pro
          />
        </div>
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

// ═══════════════════════════════════════════════════════════════
//  CARRERAS — top 6 con mayor cobertura (de CARRERAS.md)
// ═══════════════════════════════════════════════════════════════

interface Carrera {
  label: string;
  univ: string;
  href: string;
  cover: number;
  accent: string;
}

const TOP_CARRERAS: Carrera[] = [
  { label: 'Lic. Física',                 univ: 'UNAM · Ciencias',     href: '/carreras.html#fisica-unam',         cover: 65, accent: '#7E57C2' },
  { label: 'Lic. Física y Matemáticas',   univ: 'IPN ESFM',            href: '/carreras.html#fismat-ipn',          cover: 62, accent: '#4FC3F7' },
  { label: 'Lic. Ciencias Genómicas',     univ: 'UNAM LCG Juriquilla', href: '/carreras.html#genomicas-unam',      cover: 60, accent: '#10B981' },
  { label: 'Lic. Química',                univ: 'UNAM · Química',      href: '/carreras.html#quimica-unam',        cover: 55, accent: '#F472B6' },
  { label: 'Ing. Mecatrónica',            univ: 'UNAM · Ingeniería',   href: '/carreras.html#mecatronica-unam',    cover: 55, accent: '#FDB813' },
  { label: 'Ing. Química Industrial',     univ: 'IPN ESIQIE',          href: '/carreras.html#esiqie-ipn',          cover: 50, accent: '#F472B6' },
];

function CarreraCard({ label, univ, href, cover, accent }: Carrera) {
  return (
    <a
      href={href}
      className="group block rounded-xl border border-[#1E293B] bg-[#0B0F17]/60 backdrop-blur p-5 hover:border-white/20 transition-all hover:bg-[#0B0F17]/90"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#64748B]">{univ}</div>
        <div
          className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
          style={{ color: accent, borderColor: accent + '60' }}
        >
          {cover}% Forja
        </div>
      </div>
      <h3 className="text-[17px] font-semibold text-white leading-snug mb-3">{label}</h3>
      {/* progress bar */}
      <div className="h-1 rounded-full bg-[#1E293B] overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${cover}%`, background: `linear-gradient(90deg, ${accent}, ${accent}88)` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-[#64748B] font-mono">
        <span>Ver plan</span>
        <span className="group-hover:translate-x-1 transition-transform" style={{ color: accent }}>→</span>
      </div>
    </a>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MISIONES — descubrimiento guiado
// ═══════════════════════════════════════════════════════════════

interface MisionCardProps {
  href: string;
  accent: string;
  chapter: string;
  title: string;
  blurb: string;
  tools: string[];
  time: string;
  level: string;
  comingSoon?: boolean;
}

function MisionCard({ href, accent, chapter, title, blurb, tools, time, level, comingSoon }: MisionCardProps) {
  const Tag = comingSoon ? 'div' : 'a';
  return (
    <Tag
      {...(comingSoon ? {} : { href })}
      className={`group block rounded-2xl border p-6 transition-all ${
        comingSoon
          ? 'border-[#1E293B] bg-[#0B0F17]/40 opacity-60 cursor-not-allowed'
          : 'border-[#1E293B] bg-[#0B0F17]/60 hover:border-white/20 hover:bg-[#0B0F17]/90 hover:scale-[1.01]'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="text-[10px] font-mono px-2 py-1 rounded border"
          style={{ color: accent, borderColor: accent + '60' }}
        >
          MISIÓN {chapter}
        </div>
        {comingSoon && (
          <div className="text-[10px] font-mono text-[#64748B] uppercase tracking-[0.2em]">próximamente</div>
        )}
      </div>
      <h3 className="text-[22px] font-bold text-white leading-snug mb-2">{title}</h3>
      <p className="text-[13px] text-[#CBD5E1] leading-relaxed mb-4">{blurb}</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tools.map((t) => (
          <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1E293B] text-[#94A3B8]">
            {t}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[11px] font-mono text-[#64748B]">
        <span>{level}</span>
        <span style={{ color: accent }}>{time}</span>
      </div>
    </Tag>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SOFTWARE — tier free / PRO
// ═══════════════════════════════════════════════════════════════

interface SoftwareCardProps {
  href: string;
  glyph: string;
  name: string;
  tagline: string;
  highlights: string[];
  accent: string;
  pro?: boolean;
}

function SoftwareCard({ href, glyph, name, tagline, highlights, accent, pro }: SoftwareCardProps) {
  return (
    <a
      href={href}
      className="group block rounded-xl border border-[#1E293B] bg-[#0B0F17]/60 p-5 hover:border-white/20 transition-all hover:bg-[#0B0F17]/90"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-12 h-12 rounded-lg border flex items-center justify-center text-[24px] font-bold"
          style={{ borderColor: accent + '60', color: accent }}
        >
          {glyph}
        </div>
        {pro && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FDB813]/10 text-[#FDB813] border border-[#FDB813]/40">
            PRO
          </span>
        )}
      </div>
      <h3 className="text-[18px] font-bold text-white mb-1">{name}</h3>
      <div className="text-[12px] font-mono text-[#64748B] mb-3">{tagline}</div>
      <ul className="space-y-1 text-[12px] text-[#CBD5E1]">
        {highlights.map((h, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span style={{ color: accent }}>·</span>
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-[#64748B]">
        <span>Abrir</span>
        <span style={{ color: accent }} className="group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </a>
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
