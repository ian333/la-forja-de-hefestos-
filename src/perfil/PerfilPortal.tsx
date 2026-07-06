/**
 * PerfilPortal — tu recorrido por la universidad GAIA.
 *
 *   TU PERFIL ES TU ÁTOMO. Cada lección completada = un electrón colocado en el
 *   orden de llenado real (Madelung). 27 lecciones → eres Cobalto. Terminar la
 *   universidad (102 lecciones) → NOBELIO. Nada de "XP": física real.
 *
 *   El hero es una escena VIVA del motor de CinematicAtom (ψ² muestreada real,
 *   núcleo de nucleones, campo B de Hund si eres paramagnético) con cámara
 *   contemplativa. En live NO hay EffectComposer (HDR+MSAA revienta en GPUs
 *   diversas): flat=false → tonemap ACES del renderer, negro garantizado.
 *
 * Progreso: src/lib/progress.ts (localStorage v1; el plan Estudiante lo subirá
 * a la nube vía university-api). ?demo=27 siembra un recorrido para diseño/QA.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  buildAtomBundle, ElectronCloud, Nucleus, MagneticField, CinemaVignette,
} from '@/cinematic/CinematicAtom';
import { atomExtent, nucleusInfo, subshellLabel, subshellColor } from '@/lib/chem/quantum/atom-builder';
import { elementByZ, type Element } from '@/lib/chem/quantum/periodic-table';
import {
  PILLARS, TOTAL_LESSONS, type Progress,
  effectiveProgress, lessonsDone, pillarDone, elementNow, elementNext, badges,
} from '@/lib/progress';
import { PLAN_NAMES, fetchMe, fmtDate, type Me } from '@/lib/gaia-access';

// ── Cámara contemplativa (doctrina: 1 objeto, autoRotate, con peso) ──
function OrbitRig({ extent }: { extent: number }) {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    const az = 2.9 + t * 0.085;                       // órbita LENTA (contemplación)
    const el = 0.26 + 0.05 * Math.sin(t * 0.11);      // respiración vertical sutil
    const d = extent * (1.02 + 0.04 * Math.sin(t * 0.07));
    camera.position.set(
      d * Math.cos(el) * Math.cos(az),
      d * Math.sin(el),
      d * Math.cos(el) * Math.sin(az),
    );
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ── El átomo del alumno, vivo ────────────────────────────────────────
function AtomHero({ element }: { element: Element }) {
  const bundle = useMemo(() => buildAtomBundle(element), [element]);
  const extent = useMemo(() => atomExtent(element), [element]);
  const nuc = useMemo(() => nucleusInfo(element), [element]);
  const nucR = extent * 0.0010;
  const coreR = extent * (0.03 + 0.16 * (1 - Math.exp(-element.Z / 30)));

  // Reloj vivo (mismo patrón que CinematicAtom live): la nube respira/circula.
  const [time, setTime] = useState(0);
  useEffect(() => {
    let raf = 0, start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      setTime((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Liberar el contexto WebGL al desmontar (Chrome limita ~16 contextos).
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  useEffect(() => () => {
    try { glRef.current?.forceContextLoss(); glRef.current?.dispose(); } catch { /* noop */ }
  }, []);

  return (
    <Canvas
      onCreated={({ gl }) => { glRef.current = gl; }}
      camera={{ position: [0, 0, extent], fov: 33, near: 0.01, far: 200 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 1.75]}
      frameloop="always"
      style={{ position: 'absolute', inset: 0, background: '#000' }}
    >
      <color attach="background" args={['#000']} />
      <OrbitRig extent={extent} />
      <Nucleus protons={nuc.protons} neutrons={nuc.neutrons} time={time} clusterRadius={nucR} />
      <ElectronCloud
        bundle={bundle} time={time} revealAll
        holeRadius={nucR * 0.9} coreRadius={coreR} rotRate={0.55}
        brightness={Math.min(0.82, 3.4 / Math.sqrt(element.Z))}
      />
      {/* Campo B dipolar SOLO si hay e⁻ desapareados (Hund) — física visible. */}
      <group rotation={[time * 0.22, time * 0.5, 0]}>
        <MagneticField element={element} time={time} radius={extent * 0.55} op={0.26} />
      </group>
    </Canvas>
  );
}

// ── Configuración electrónica como texto (1s² 2s² 2p⁶ …) ────────────
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: number) => String(n).split('').map((d) => SUP[+d]).join('');

function configString(el: Element): string {
  return el.config.map((s) => `${subshellLabel(s.n, s.l)}${sup(s.electrons)}`).join(' ');
}

// ── Página ───────────────────────────────────────────────────────────
export default function PerfilPortal() {
  const [progress] = useState<Progress>(() => effectiveProgress());
  const [me, setMe] = useState<Me | null>(null);

  // El portal scrollea (main.css ata body a overflow:hidden para apps full-screen).
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const prev = { ho: html.style.overflow, hh: html.style.height, bo: body.style.overflow, bh: body.style.height };
    html.style.overflow = 'auto'; html.style.height = 'auto';
    body.style.overflow = 'auto'; body.style.height = 'auto';
    return () => {
      html.style.overflow = prev.ho; html.style.height = prev.hh;
      body.style.overflow = prev.bo; body.style.height = prev.bh;
    };
  }, []);

  useEffect(() => { fetchMe().then(setMe).catch(() => {}); }, []);

  const done = lessonsDone(progress);
  const el = elementNow(progress);
  const next = elementNext(progress);
  const cfg = configString(el);
  const firstName = (me?.name || '').trim().split(/\s+/)[0] || 'Estudiante';
  const activePlan = me?.access?.active_plans?.[0] ?? null;
  const medals = badges(progress);

  // "Sigue aquí": el pilar empezado con mayor avance; si ninguno, el primero libre.
  const resume = useMemo(() => {
    const started = PILLARS
      .map((p) => ({ p, d: pillarDone(progress, p.key) }))
      .filter(({ p, d }) => d > 0 && d < p.total)
      .sort((a, b) => b.d / b.p.total - a.d / a.p.total)[0];
    if (started) return { pillar: started.p, done: started.d, verb: 'Continuar' };
    const fresh = PILLARS.find((p) => pillarDone(progress, p.key) < p.total) ?? PILLARS[0];
    return { pillar: fresh, done: pillarDone(progress, fresh.key), verb: 'Empezar' };
  }, [progress]);

  // Escalera de la materia: autocentrar tu elemento (sin secuestrar el scroll de página).
  const ladderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ladderRef.current;
    const cur = box?.querySelector<HTMLElement>('[data-current="1"]');
    if (box && cur) box.scrollLeft = cur.offsetLeft - box.clientWidth / 2 + cur.clientWidth / 2;
  }, [el.Z]);

  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans relative overflow-x-hidden">

      {/* ═══ HERO: tu átomo, vivo ═══ */}
      <section className="relative h-[100svh] min-h-[560px]">
        <AtomHero element={el} />
        <CinemaVignette />
        {/* Scrim para legibilidad del HUD (no toca el centro del átomo) */}
        <div className="absolute inset-0 pointer-events-none z-[11]"
          style={{ background: 'linear-gradient(180deg, rgba(5,6,10,0.72) 0%, transparent 22%, transparent 58%, rgba(5,6,10,0.88) 100%)' }} />

        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-20 px-6 py-6 max-w-[1400px] mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#4FC3F7] via-[#7E57C2] to-[#F472B6] flex items-center justify-center font-bold text-[#05060A] text-[20px]">Γ</div>
            <div>
              <div className="text-[16px] font-bold tracking-tight">GAIA Escuela</div>
              <div className="text-[10px] text-[#94A3B8] uppercase tracking-[0.2em] font-mono">tu recorrido</div>
            </div>
          </a>
          <nav className="flex items-center gap-5 text-[12px] text-[#CBD5E1] font-mono">
            <a href="/" className="hover:text-[#FDB813] transition">← Escuela</a>
            <a href="/cuenta.html" className="hover:text-[#FDB813] transition">Cuenta →</a>
          </nav>
        </header>

        {/* HUD inferior: identidad + elemento */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-10 max-w-[1400px] mx-auto">
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#FDB813] mb-4 font-mono">
            ▶ Tu recorrido · cada lección es un electrón
          </div>
          <h1 className="text-[52px] md:text-[80px] font-extrabold leading-[0.95] tracking-tight">
            <span className="text-white">{firstName},</span><br />
            <span className="bg-gradient-to-r from-[#4FC3F7] via-[#7E57C2] to-[#F472B6] bg-clip-text text-transparent">
              eres {el.name}.
            </span>
          </h1>
          <p className="mt-4 text-[15px] text-[#CBD5E1] max-w-[720px] leading-relaxed">
            <strong className="text-white">{done} {done === 1 ? 'lección' : 'lecciones'} = {done === 1 ? 'un electrón' : `${done} electrones`}</strong> colocados
            en el orden real de la materia. Tu configuración:{' '}
            <span className="font-mono text-[13px] text-[#E2E8F0]">{cfg}</span>
            {next && <> · a <strong className="text-white">1 lección</strong> de ser <strong style={{ color: next.color }}>{next.name}</strong></>}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5 text-[12px] font-mono">
            <span className="px-3.5 py-1.5 rounded-full border border-[#FDB813]/40 bg-[#FDB813]/10 text-[#FDB813]">
              {activePlan ? `⚡ ${PLAN_NAMES[activePlan] ?? activePlan}` : '○ Plan Libre'}
            </span>
            <Chip dot="#34D399">racha de {progress.streak.days} {progress.streak.days === 1 ? 'día' : 'días'}</Chip>
            <Chip dot="#4FC3F7">Z = {el.Z} · {el.symbol}</Chip>
            <Chip dot="#F472B6">{progress.reports} reportes PDF</Chip>
            <Chip dot="#FDB813">{medals.filter((b) => b.unlocked).length} insignias</Chip>
          </div>
        </div>
      </section>

      {/* ═══ LA ESCALERA DE LA MATERIA ═══ */}
      <section className="relative z-10 px-6 max-w-[1400px] mx-auto pt-16 pb-4">
        <div className="text-[11px] uppercase tracking-[0.3em] text-[#4FC3F7] mb-2 font-mono">La escalera de la materia</div>
        <h2 className="text-[32px] font-bold text-white">
          Naciste Hidrógeno. Te gradúas <span className="bg-gradient-to-r from-[#FDB813] to-[#F472B6] bg-clip-text text-transparent">Nobelio</span>.
        </h2>
        <p className="mt-2 text-[14px] text-[#94A3B8] max-w-[680px]">
          {TOTAL_LESSONS} lecciones = {TOTAL_LESSONS} electrones = el elemento 102. La universidad
          de los premios Nobel te gradúa, literalmente, como <strong className="text-white">Nobelio</strong>.
        </p>
        <div ref={ladderRef} className="mt-8 flex gap-2 overflow-x-auto pb-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#1E293B transparent' }}>
          {Array.from({ length: TOTAL_LESSONS }, (_, i) => {
            const z = i + 1;
            const e = elementByZ(z);
            if (!e) return null;
            const past = z < el.Z, current = z === el.Z;
            const noble = [2, 10, 18, 36, 54, 86].includes(z) || z === TOTAL_LESSONS;
            return (
              <div key={z} data-current={current ? '1' : undefined}
                className={`shrink-0 rounded-lg border text-center transition ${current ? 'w-[72px] py-3' : 'w-[52px] py-2'}`}
                style={{
                  borderColor: current ? e.color : past ? `${e.color}55` : noble ? '#33415577' : '#1E293B',
                  background: current ? `${e.color}1A` : past ? '#0B0F17' : '#07090F',
                  boxShadow: current ? `0 0 28px ${e.color}66` : 'none',
                  opacity: past || current ? 1 : noble ? 0.75 : 0.4,
                }}>
                <div className={`font-bold ${current ? 'text-[22px]' : 'text-[15px]'}`}
                  style={{ color: past || current ? e.color : '#64748B' }}>{e.symbol}</div>
                <div className="text-[9px] font-mono text-[#64748B]">{z}</div>
                {current && <div className="text-[8px] font-mono uppercase tracking-widest text-[#94A3B8] mt-0.5">estás aquí</div>}
              </div>
            );
          })}
        </div>
        {/* Configuración = espectro de subcapas reales */}
        <div className="mt-3 flex flex-wrap gap-2">
          {el.config.map((s, i) => (
            <span key={i} className="px-3 py-1.5 rounded-lg border text-[12px] font-mono"
              style={{ borderColor: `${subshellColor(s.n, s.l)}55`, color: subshellColor(s.n, s.l), background: `${subshellColor(s.n, s.l)}0D` }}>
              {subshellLabel(s.n, s.l)}{sup(s.electrons)}
            </span>
          ))}
        </div>
      </section>

      {/* ═══ SIGUE AQUÍ ═══ */}
      <section className="relative z-10 px-6 max-w-[1400px] mx-auto pt-12">
        <a href={resume.pillar.href}
          className="group block relative rounded-3xl overflow-hidden border-2 transition-all"
          style={{ borderColor: `${resume.pillar.accent}4D`, background: 'linear-gradient(135deg, #150B22 0%, #0B0F17 55%, #1A0F08 100%)' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = resume.pillar.accent; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${resume.pillar.accent}4D`; }}>
          <div className="absolute -top-32 -right-32 w-[440px] h-[440px] rounded-full opacity-25 blur-[100px] pointer-events-none"
            style={{ background: `radial-gradient(circle, ${resume.pillar.accent} 0%, transparent 70%)` }} />
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center p-10 md:p-12">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] mb-4 font-mono" style={{ color: resume.pillar.accent }}>
                ▶ {resume.verb === 'Continuar' ? 'Retoma donde quedaste' : 'Tu siguiente electrón'} · {resume.pillar.name}
              </div>
              <h2 className="text-[40px] md:text-[52px] font-extrabold leading-[0.95] tracking-tight text-white mb-4">
                {resume.verb === 'Continuar' ? 'Te falta poco,' : 'Un mundo nuevo,'}<br />
                <span className="bg-gradient-to-r from-[#FDB813] via-[#F472B6] to-[#4FC3F7] bg-clip-text text-transparent">
                  {next ? `${next.name} te espera.` : 'la cima te espera.'}
                </span>
              </h2>
              <p className="text-[15px] text-[#CBD5E1] max-w-[620px] leading-relaxed mb-3">
                {resume.verb === 'Continuar'
                  ? <>Llevas <strong className="text-white">{resume.done} de {resume.pillar.total}</strong> en {resume.pillar.name}. La próxima lección coloca tu electrón {done + 1}{next ? <> — y te transmuta en <strong className="text-white">{next.name}</strong></> : null}.</>
                  : <>{resume.pillar.tagline} Tu primera lección aquí coloca el electrón {done + 1}{next ? <> y te vuelve <strong className="text-white">{next.name}</strong></> : null}.</>}
              </p>
              <p className="text-[12px] text-[#64748B] font-mono">
                {resume.pillar.glyph} {resume.pillar.name} · {resume.done} / {resume.pillar.total} lecciones · tu racha sigue viva hoy
              </p>
            </div>
            <div className="flex flex-col items-center md:items-end gap-4">
              <div className="px-8 py-4 rounded-xl border-2 text-[18px] font-bold tracking-wide whitespace-nowrap transition"
                style={{ borderColor: resume.pillar.accent, color: resume.pillar.accent, background: `${resume.pillar.accent}26` }}>
                ▶ {resume.verb} {resume.pillar.name}
              </div>
            </div>
          </div>
        </a>
      </section>

      {/* ═══ PILARES ═══ */}
      <section className="relative z-10 px-6 max-w-[1400px] mx-auto pt-16">
        <div className="text-[11px] uppercase tracking-[0.3em] text-[#7E57C2] mb-2 font-mono">Cinco pilares · tu avance</div>
        <h2 className="text-[32px] font-bold text-white mb-8">Cada pilar es un mundo. Enciéndelos todos.</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PILLARS.map((p) => {
            const d = pillarDone(progress, p.key);
            // clamp: puede haber más lecciones cableadas que el total curado v1
            const pct = Math.min(100, Math.round((d / p.total) * 100));
            return (
              <a key={p.key} href={p.href}
                className="group block rounded-2xl border border-[#1E293B] p-6 hover:border-white/20 transition-all hover:scale-[1.02]"
                style={{ background: `linear-gradient(135deg, ${p.accent}17, ${p.accent}05)` }}>
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 rounded-xl bg-[#05060A] border flex items-center justify-center text-[28px] font-bold"
                    style={{ borderColor: `${p.accent}60`, color: p.accent }}>{p.glyph}</div>
                  <div className="text-right">
                    <div className="text-[24px] font-bold font-mono" style={{ color: p.accent }}>{pct}%</div>
                    <div className="text-[10px] font-mono text-[#64748B]">{d} / {p.total} lecciones</div>
                  </div>
                </div>
                <h3 className="text-[24px] font-bold text-white mb-1">{p.name}</h3>
                <div className="text-[13px] text-[#CBD5E1] italic mb-4">{p.tagline}</div>
                <div className="h-1.5 rounded-full bg-[#131A26] overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.accent}, ${p.accent}88)` }} />
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[12px] font-mono">
                  <span className="text-[#94A3B8]">{d === 0 ? 'Empezar' : d >= p.total ? 'Dominado' : 'Continuar'} →</span>
                  <span style={{ color: p.accent }} className="group-hover:translate-x-1 transition-transform">⇒</span>
                </div>
              </a>
            );
          })}
          {/* La Forja — el pilar PRO */}
          <a href="/precios.html"
            className="group block rounded-2xl border border-[#FDB813]/30 p-6 hover:border-[#FDB813] transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #FDB81315, #78350F08)' }}>
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 rounded-xl bg-[#05060A] border border-[#FDB813]/60 flex items-center justify-center text-[28px] font-bold text-[#FDB813]">⚒</div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FDB813]/10 text-[#FDB813] border border-[#FDB813]/40">PRO</span>
            </div>
            <h3 className="text-[24px] font-bold text-white mb-1">La Forja · CAD</h3>
            <div className="text-[13px] text-[#CBD5E1] italic mb-4">B-Rep de verdad — kernel OpenCASCADE.</div>
            <div className="h-1.5 rounded-full bg-[#131A26] overflow-hidden">
              <div className="h-full w-full rounded-full opacity-40" style={{ background: 'linear-gradient(90deg, #FDB813, #FDB81344)' }} />
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[12px] font-mono">
              <span className="text-[#94A3B8]">Desbloquear con Pro →</span>
              <span className="text-[#FDB813] group-hover:translate-x-1 transition-transform">⇒</span>
            </div>
          </a>
        </div>
      </section>

      {/* ═══ INSIGNIAS ═══ */}
      <section className="relative z-10 px-6 max-w-[1400px] mx-auto pt-16">
        <div className="text-[11px] uppercase tracking-[0.3em] text-[#F472B6] mb-2 font-mono">Insignias · se ganan, no se regalan</div>
        <h2 className="text-[32px] font-bold text-white mb-2">Tu constelación.</h2>
        <p className="text-[14px] text-[#94A3B8] mb-8 max-w-[680px]">Cada insignia es una estrella que ya fijaste. Las apagadas te están esperando.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {medals.map((b) => (
            <div key={b.id}
              className={`rounded-2xl border p-5 flex items-center gap-4 ${b.unlocked ? 'border-[#1E293B] bg-[#0B0F17]/70' : 'border-[#131A26] bg-[#07090F] opacity-45'}`}>
              <div className="w-[52px] h-[52px] rounded-xl bg-[#05060A] border flex items-center justify-center text-[24px] font-bold shrink-0"
                style={{
                  borderColor: b.unlocked ? `${b.accent}60` : '#1E293B',
                  color: b.unlocked ? b.accent : '#475569',
                  boxShadow: b.unlocked ? `0 0 24px ${b.accent}40` : 'none',
                }}>{b.glyph}</div>
              <div className="min-w-0">
                <div className={`text-[15px] font-bold ${b.unlocked ? 'text-white' : 'text-[#94A3B8]'}`}>{b.name}</div>
                <div className="text-[10.5px] font-mono uppercase tracking-wider text-[#64748B] mt-0.5">{b.status}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ TU PLAN ═══ */}
      <section className="relative z-10 px-6 max-w-[1400px] mx-auto pt-16 pb-8">
        <div className="text-[11px] uppercase tracking-[0.3em] text-[#FDB813] mb-2 font-mono">Tu plan</div>
        <h2 className="text-[32px] font-bold text-white mb-8">
          {activePlan ? 'Gracias por sostener la escuela.' : 'La escuela es gratis. Guardar tu universo, no.'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F17]/70 p-8">
            <div className="text-[11px] uppercase tracking-[0.3em] font-mono mb-2" style={{ color: activePlan ? '#34D399' : '#64748B' }}>
              {activePlan ? '● Activo' : '○ Tu cuenta'}
            </div>
            <h3 className="text-[26px] font-extrabold text-white">
              {activePlan ? (PLAN_NAMES[activePlan] ?? activePlan) : 'Plan Libre'}
            </h3>
            <div className="text-[13px] font-mono text-[#94A3B8] mt-1">
              {me?.subscription?.current_period_end
                ? <>renueva el {fmtDate(me.subscription.current_period_end)}</>
                : 'todo el contenido, gratis para siempre'}
            </div>
            <ul className="mt-5 space-y-2.5 text-[13.5px] text-[#CBD5E1]">
              <li className="flex gap-2"><span className="text-[#34D399]">✓</span> Labs, clases y los 56 Nobel — abiertos</li>
              <li className="flex gap-2"><span className={activePlan ? 'text-[#34D399]' : 'text-[#475569]'}>{activePlan ? '✓' : '✗'}</span> Tu átomo guardado en la nube</li>
              <li className="flex gap-2"><span className={activePlan ? 'text-[#34D399]' : 'text-[#475569]'}>{activePlan ? '✓' : '✗'}</span> Reportes PDF sin marca, ilimitados</li>
              <li className="flex gap-2"><span className={activePlan ? 'text-[#34D399]' : 'text-[#475569]'}>{activePlan ? '✓' : '✗'}</span> Certificados de cada pilar</li>
            </ul>
            <a href={activePlan ? '/cuenta.html' : '/precios.html'}
              className="mt-6 inline-block px-5 py-3 rounded-xl text-[13px] font-semibold border border-[#334155] text-[#E2E8F0] hover:border-[#64748B] transition">
              {activePlan ? 'Gestionar suscripción →' : 'Guardar mi recorrido · $99/año →'}
            </a>
          </div>
          <div className="relative rounded-2xl border-2 border-[#FDB813]/35 p-8 overflow-hidden hover:border-[#FDB813] transition"
            style={{ background: 'linear-gradient(135deg, #1A0F08 0%, #0B0F17 60%, #150B22 100%)' }}>
            <div className="absolute -top-28 -right-28 w-[360px] h-[360px] rounded-full opacity-25 blur-[90px] pointer-events-none"
              style={{ background: 'radial-gradient(circle, #FDB813 0%, transparent 70%)' }} />
            <div className="relative z-10">
              <div className="text-[11px] uppercase tracking-[0.3em] font-mono text-[#FDB813] mb-2">⚒ El siguiente nivel</div>
              <h3 className="text-[26px] font-extrabold text-white">Forja Pro</h3>
              <div className="text-[13px] font-mono text-[#94A3B8] mt-1">$299 MXN / mes · para los que construyen</div>
              <ul className="mt-5 space-y-2.5 text-[13.5px] text-[#CBD5E1]">
                <li className="flex gap-2"><span className="text-[#FDB813]">⚒</span> La Forja CAD completo — export STEP/STL</li>
                <li className="flex gap-2"><span className="text-[#FDB813]">⚒</span> Cómputo pesado: docking, genoma, FEA</li>
                <li className="flex gap-2"><span className="text-[#FDB813]">⚒</span> Render 4K sin marca + prioridad de cola</li>
              </ul>
              <a href="/precios.html"
                className="mt-6 inline-block px-6 py-3.5 rounded-xl text-[15px] font-bold border-2 border-[#FDB813] text-[#FDB813] bg-[#FDB813]/15 hover:bg-[#FDB813]/30 transition">
                ⚒ Desbloquear la Forja
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 py-8 text-center text-[11px] text-[#475569] font-mono">
        <a href="/terminos.html" className="hover:text-[#94A3B8] transition">Términos</a>
        <span className="mx-2 text-[#1E293B]">·</span>
        <a href="/privacidad.html" className="hover:text-[#94A3B8] transition">Privacidad</a>
        <div className="mt-2">Γ GAIA · De Chimalhuacán para el mundo · La escalera ahora es para todos</div>
      </footer>
    </div>
  );
}

function Chip({ dot, children }: { dot: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#1E293B] bg-[#0B0F17]/70 text-[#CBD5E1]">
      <span className="w-[7px] h-[7px] rounded-full" style={{ background: dot }} /> {children}
    </span>
  );
}
