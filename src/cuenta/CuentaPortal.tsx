/**
 * CuentaPortal — cuenta GAIA con magic-link (sin contraseña).
 *
 * Flujo: metes tu correo → /auth/request-link → llega un enlace → al tocarlo,
 * el servicio te redirige aquí con #token=<jwt>, que guardamos y usamos para
 * /auth/me. Habla con el servicio AISLADO university-api (no con Orkesta).
 */
import { useEffect, useState } from 'react';
import {
  type Me,
  API_BASE,
  GAIA_GRADIENT,
  PLAN_NAMES,
  fetchMe,
  updateName,
  openBillingPortal,
  fmtDate,
  fmtMoney,
} from '../lib/gaia-access';

function SubBadge({ status, canceling }: { status: string; canceling: boolean }) {
  // color por estado, sin emoji ruidoso
  const map: Record<string, { dot: string; text: string; label: string }> = {
    active: { dot: '#34D399', text: '#A7F3D0', label: canceling ? 'Termina pronto' : 'Activa' },
    trialing: { dot: '#4FC3F7', text: '#BAE6FD', label: 'En prueba' },
    past_due: { dot: '#FDB813', text: '#FDE68A', label: 'Pago pendiente' },
    canceled: { dot: '#FB7185', text: '#FECDD3', label: 'Cancelada' },
    none: { dot: '#64748B', text: '#94A3B8', label: 'Sin plan' },
  };
  const s = map[status] ?? map.none;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono" style={{ color: s.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} /> {s.label}
    </span>
  );
}

export default function CuentaPortal() {
  const [session, setSession] = useState<string | null>(() => localStorage.getItem('gaia_session'));
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const prev = { ho: html.style.overflow, hh: html.style.height, bo: body.style.overflow, bh: body.style.height };
    html.style.overflow = 'auto'; html.style.height = 'auto'; body.style.overflow = 'auto'; body.style.height = 'auto';
    return () => { html.style.overflow = prev.ho; html.style.height = prev.hh; body.style.overflow = prev.bo; body.style.height = prev.bh; };
  }, []);

  // Captura el #token= del redirect del magic-link.
  useEffect(() => {
    const m = window.location.hash.match(/token=([^&]+)/);
    if (m) {
      const tok = decodeURIComponent(m[1]);
      localStorage.setItem('gaia_session', tok);
      setSession(tok);
      history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Con sesión → trae la cuenta. fetchMe limpia el localStorage si el token caducó.
  useEffect(() => {
    if (!session) return;
    setLoadingMe(true);
    fetchMe(session)
      .then((m) => {
        if (m) { setMe(m); setNameDraft(m.name ?? ''); }
        else setSession(null);
      })
      .catch(() => setError('No pudimos conectar con el servidor.'))
      .finally(() => setLoadingMe(false));
  }, [session]);

  async function saveName() {
    setSavingName(true);
    const ok = await updateName(nameDraft);
    setSavingName(false);
    if (ok && me) { setMe({ ...me, name: nameDraft.trim() || null }); setEditingName(false); }
    else if (!ok) setError('No pudimos guardar tu nombre. Intenta de nuevo.');
  }

  async function goToPortal() {
    setPortalLoading(true);
    const url = await openBillingPortal();
    if (url) window.location.href = url;
    else { setPortalLoading(false); setError('No encontramos una suscripción que gestionar.'); }
  }

  async function requestLink() {
    if (!email.includes('@')) { setError('Escribe un correo válido.'); return; }
    setSending(true); setError('');
    try {
      const r = await fetch(`${API_BASE}/auth/request-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || 'No se pudo enviar el enlace.');
      setSent({ devLink: data.dev_link });
    } catch (e: any) {
      setError(e.message || 'Error de conexión.');
    } finally {
      setSending(false);
    }
  }

  function logout() {
    localStorage.removeItem('gaia_session');
    setSession(null); setMe(null); setSent(null); setEmail('');
  }

  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans relative overflow-x-hidden">
      <div className="fixed top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none opacity-20 blur-[130px]"
        style={{ background: 'radial-gradient(circle, #7E57C2 0%, transparent 70%)' }} />

      <header className="relative z-10 px-6 py-6 max-w-[760px] mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md flex items-center justify-center font-bold text-[#05060A] text-[20px]" style={{ background: GAIA_GRADIENT }}>Γ</div>
          <div>
            <div className="text-[16px] font-bold tracking-tight">GAIA</div>
            <div className="text-[10px] text-[#64748B] uppercase tracking-[0.2em]">tu cuenta</div>
          </div>
        </a>
        <a href="/precios.html" className="text-[12px] text-[#94A3B8] font-mono hover:text-white transition">Planes →</a>
      </header>

      <main className={`relative z-10 mx-auto px-6 pt-10 ${me ? 'max-w-[560px]' : 'max-w-[440px]'}`}>
        {me ? (
          // ── Sesión activa ──
          <div className="space-y-4">

            {/* PERFIL */}
            <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F17] p-6">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider">Sesión iniciada</div>
                  <div className="mt-1 text-[18px] font-bold text-white break-all">{me.email}</div>
                </div>
                <button onClick={logout}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] text-[#94A3B8] border border-[#1E293B] hover:border-[#334155] transition">
                  Cerrar sesión
                </button>
              </div>

              <div className="mt-5 text-[11px] font-mono text-[#64748B] uppercase tracking-wider">Nombre</div>
              {editingName ? (
                <div className="mt-1.5 flex gap-2">
                  <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                    placeholder="Tu nombre"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#05060A] border border-[#1E293B] text-white text-[14px] outline-none focus:border-[#4FC3F7] transition" />
                  <button onClick={saveName} disabled={savingName}
                    className="px-3 py-2 rounded-lg text-[13px] font-semibold text-[#05060A] disabled:opacity-50"
                    style={{ background: GAIA_GRADIENT }}>
                    {savingName ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              ) : (
                <button onClick={() => { setNameDraft(me.name ?? ''); setEditingName(true); }}
                  className="mt-1.5 flex items-center gap-2 text-[15px] text-white hover:text-[#4FC3F7] transition group">
                  <span>{me.name || <span className="text-[#64748B] italic">Agrega tu nombre</span>}</span>
                  <span className="text-[12px] text-[#475569] group-hover:text-[#4FC3F7]">editar</span>
                </button>
              )}
            </div>

            {/* SUSCRIPCIÓN */}
            {me.subscription && me.subscription.plan ? (
              <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F17] p-6">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider">Suscripción</div>
                  <SubBadge status={me.subscription.status} canceling={me.subscription.cancel_at_period_end} />
                </div>
                <div className="mt-2 text-[18px] font-bold text-white">{PLAN_NAMES[me.subscription.plan] ?? me.subscription.plan}</div>
                <div className="mt-1 text-[14px] text-[#94A3B8]">{fmtMoney(me.subscription.amount, me.subscription.interval)}</div>
                <div className="mt-1 text-[13px] text-[#64748B]">
                  {me.subscription.cancel_at_period_end
                    ? <>Termina el <span className="text-[#FECDD3]">{fmtDate(me.subscription.current_period_end)}</span> · no se renueva</>
                    : <>Renueva el <span className="text-[#E2E8F0]">{fmtDate(me.subscription.current_period_end)}</span></>}
                </div>
                <button onClick={goToPortal} disabled={portalLoading}
                  className="mt-5 w-full py-2.5 rounded-xl text-[13px] font-semibold text-[#E2E8F0] border border-[#334155] hover:border-[#64748B] transition disabled:opacity-50">
                  {portalLoading ? 'Abriendo…' : 'Gestionar / Cancelar suscripción →'}
                </button>
                <button onClick={goToPortal} disabled={portalLoading}
                  className="mt-2 w-full py-1.5 text-[12px] text-[#64748B] hover:text-[#94A3B8] transition">
                  Ver recibos y facturas →
                </button>
              </div>
            ) : (
              // Sin plan → upsell suave
              <div className="rounded-2xl border border-[#1E293B] bg-[#0A0D14] p-6">
                <div className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider">Suscripción</div>
                <div className="mt-2 text-[15px] text-[#94A3B8]">
                  Aún no tienes un plan. El contenido es gratis; los laboratorios y el CAD se desbloquean en Planes.
                </div>
                <a href="/precios.html"
                  className="mt-4 inline-block px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#05060A] transition hover:opacity-90"
                  style={{ background: GAIA_GRADIENT }}>
                  Ver planes →
                </a>
              </div>
            )}

            {/* TUS ACCESOS */}
            <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F17] p-6">
              <div className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider">Tus accesos</div>
              {me.access.active_plans.length === 0 ? (
                <div className="mt-2 text-[14px] text-[#64748B]">Sin accesos activos todavía.</div>
              ) : (
                <ul className="mt-2 space-y-2">
                  {me.access.active_plans.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-[14px] text-[#E2E8F0]">
                      <span className="text-[#34D399]">✓</span> {PLAN_NAMES[p] ?? p}
                      <span className="text-[#64748B] text-[12px]">· activo</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <div className="text-[12px] text-[#FB7185] px-1">{error}</div>}
          </div>
        ) : loadingMe ? (
          <div className="text-center text-[#64748B] text-[14px] mt-10">Cargando tu cuenta…</div>
        ) : sent ? (
          // ── Enlace enviado ──
          <div className="rounded-2xl border border-[#34D399]/40 bg-[#34D399]/10 p-7 text-center">
            <div className="text-[40px]">📬</div>
            <div className="mt-3 text-[18px] font-bold text-white">Revisa tu correo</div>
            <div className="mt-2 text-[14px] text-[#A7F3D0]">Te enviamos un enlace para entrar. Expira en 30 min.</div>
            {sent.devLink && (
              <a href={sent.devLink} className="mt-4 inline-block text-[12px] text-[#4FC3F7] hover:underline break-all">
                [modo dev] entrar ahora →
              </a>
            )}
            <button onClick={() => setSent(null)} className="mt-5 w-full py-2 text-[12px] text-[#64748B] hover:text-[#94A3B8] transition">
              Usar otro correo
            </button>
          </div>
        ) : (
          // ── Pedir magic-link ──
          <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F17] p-7">
            <h1 className="text-[24px] font-extrabold" style={{ backgroundImage: GAIA_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              Entra a GAIA
            </h1>
            <p className="mt-2 text-[14px] text-[#94A3B8]">Sin contraseñas. Metes tu correo y te mandamos un enlace para entrar.</p>
            <input
              type="email" autoFocus value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && requestLink()}
              placeholder="tu@correo.com"
              className="mt-5 w-full px-4 py-3 rounded-xl bg-[#05060A] border border-[#1E293B] text-white text-[14px] outline-none focus:border-[#4FC3F7] transition"
            />
            {error && <div className="mt-2 text-[12px] text-[#FB7185]">{error}</div>}
            <button onClick={requestLink} disabled={sending}
              className="mt-4 w-full py-3 rounded-xl font-semibold text-[14px] text-[#05060A] transition hover:opacity-90 disabled:opacity-50"
              style={{ background: GAIA_GRADIENT }}>
              {sending ? 'Enviando…' : 'Enviarme el enlace'}
            </button>
          </div>
        )}
      </main>

      <footer className="relative z-10 mt-16 py-6 text-center text-[11px] text-[#475569] font-mono">
        Γ GAIA · tu cuenta vive aparte, segura
      </footer>
    </div>
  );
}
