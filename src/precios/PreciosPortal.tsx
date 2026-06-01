/**
 * PreciosPortal — la página de cobro de la universidad GAIA.
 *
 *   Filosofía (La Escalera): el contenido es GRATIS para siempre. Esto solo
 *   desbloquea los laboratorios / simulaciones / CAD. Estudiante = $100/año.
 *
 * Llama al carril personal del backend: POST /mercuria/gaia/university/checkout
 * (NO provisiona ERP). El host de la API se lee del <meta name="gaia-api">.
 */
import { useEffect, useState } from 'react';
import { API_BASE, GAIA_GRADIENT, fetchMe, sessionFromCheckout } from '../lib/gaia-access';

type Plan = {
  key: string;
  name: string;
  price: string;
  cadence: string;
  badge: string;
  tagline: string;
  unlocks: string[];
  cta: string;
  external?: string;
  featured?: boolean;
};

// Copy espejo del backend (university_payments.py). Hardcodeado para que la
// página se vea perfecta aunque el backend aún no esté arriba.
const PLANS: Plan[] = [
  {
    key: 'GAIA_LABS',
    name: 'GAIA Laboratorios',
    price: '$100',
    cadence: 'primer año',
    badge: '🎓 Estudiantes',
    tagline: 'Tu primer año en los laboratorios. Sin fricción.',
    unlocks: [
      'Acceso a todos los laboratorios interactivos',
      'Puedes pedir herramientas y laboratorios nuevos',
      'Cómputo ligero incluido',
    ],
    cta: 'Entrar por $100',
  },
  {
    key: 'GAIA_FISICA_CAD',
    name: 'GAIA Física + CAD',
    price: '$300',
    cadence: 'mes',
    badge: '⚛️ Pro',
    tagline: 'Simulaciones físicas que manipulas + diseño CAD.',
    unlocks: [
      'Todas las simulaciones físicas interactivas',
      'CAD profesional — Fusion 360 (próximamente)',
      'Descargas 4K y certificados',
      'Cómputo para simulaciones pesadas',
    ],
    cta: 'Desbloquear · $300/mes',
    featured: true,
  },
  {
    key: 'GAIA_PRIME',
    name: 'GAIA Prime · Empresarial',
    price: '$500',
    cadence: 'usuario/mes',
    badge: '🏛️ Empresas',
    tagline: 'El sistema operativo de tu negocio (ERP completo).',
    unlocks: [
      'Ventas, inventario, compras y CFDI 4.0',
      'Athena (BI), Hermes (ERP), Iris (comunicación)',
      'IA que ejecuta tareas por ti',
    ],
    cta: 'Ir a GAIA Prime',
    external: 'https://gaiaprime.com.mx',
  },
];

export default function PreciosPortal() {
  const [openFor, setOpenFor] = useState<Plan | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'cancel'; plan?: string } | null>(null);
  const [loggedEmail, setLoggedEmail] = useState<string | null>(null); // sesión activa → 1-click
  const [acceptedTerms, setAcceptedTerms] = useState(false); // legal P0: T&C + Privacidad

  // El portal scrollea (main.css ata body a overflow:hidden para apps full-screen).
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

  // ── Resultado del redirect de Stripe (?ok=1 / ?cancel=1) + auto-login post-pago ──
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);

    if (q.get('ok')) {
      setBanner({ kind: 'ok', plan: q.get('plan') || undefined });
      const sid = q.get('session_id');
      // Limpia la URL para no re-disparar el canje al refrescar.
      history.replaceState(null, '', window.location.pathname);
      if (sid) {
        // Auto-login: canjea la sesión de Stripe y manda a la cuenta logueado.
        sessionFromCheckout(sid)
          .then((me) => {
            if (me) {
              // pequeño respiro para que se vea el "¡Listo!" y luego a su cuenta
              setTimeout(() => { window.location.href = '/cuenta.html'; }, 1200);
            }
            // si falla: el usuario se queda en el banner ok; siempre puede entrar por magic-link
          })
          .catch(() => {});
      }
    } else if (q.get('cancel')) {
      setBanner({ kind: 'cancel' });
      history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // ¿Ya hay sesión? → habilita el 1-click (no volver a pedir el correo).
  useEffect(() => {
    fetchMe()
      .then((m) => { if (m?.email) setLoggedEmail(m.email); })
      .catch(() => {});
  }, []);

  async function startCheckout(plan: Plan, payerEmail: string) {
    if (!payerEmail || !payerEmail.includes('@')) { setError('Escribe un correo válido.'); return; }
    if (!acceptedTerms) { setError('Acepta los Términos y el Aviso de Privacidad para continuar.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.key, email: payerEmail.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'No pudimos iniciar el pago. Intenta de nuevo.');
      if (!data.checkout_url) throw new Error('Respuesta inválida del servidor.');
      window.location.href = data.checkout_url;
    } catch (e: any) {
      setError(e.message || 'Error de conexión con el servidor de pagos.');
      setLoading(false);
    }
  }

  function onCta(plan: Plan) {
    if (plan.external) { window.location.href = plan.external; return; }
    // Abre el modal SIEMPRE: hay que aceptar T&C + Privacidad antes de ir a Stripe
    // (incluso en 1-click, para dejar constancia de la aceptación).
    setError(''); setLoading(false); setAcceptedTerms(false); setOpenFor(plan);
    if (!loggedEmail) setEmail('');
  }

  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans relative overflow-x-hidden">
      {/* Ambient lights */}
      <div className="fixed top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none opacity-25 blur-[130px]"
        style={{ background: 'radial-gradient(circle, #7E57C2 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-25%] left-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none opacity-20 blur-[130px]"
        style={{ background: 'radial-gradient(circle, #4FC3F7 0%, transparent 70%)' }} />

      {/* Header */}
      <header className="relative z-10 px-6 py-6 max-w-[1200px] mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-md flex items-center justify-center font-bold text-[#05060A] text-[20px]"
            style={{ background: GAIA_GRADIENT }}>Γ</div>
          <div>
            <div className="text-[16px] font-bold tracking-tight">GAIA</div>
            <div className="text-[10px] text-[#64748B] uppercase tracking-[0.2em]">la universidad ejecutable</div>
          </div>
        </a>
        <div className="flex items-center gap-4 text-[12px] font-mono">
          {loggedEmail
            ? <a href="/cuenta.html" className="text-[#34D399] hover:text-white transition">● {loggedEmail}</a>
            : <a href="/cuenta.html" className="text-[#94A3B8] hover:text-white transition">Iniciar sesión</a>}
          <a href="/" className="text-[#94A3B8] hover:text-white transition">← Volver</a>
        </div>
      </header>

      {/* Banner de resultado */}
      {banner && (
        <div className="relative z-10 max-w-[1200px] mx-auto px-6">
          <div className={`rounded-xl px-5 py-4 text-[14px] border ${banner.kind === 'ok'
            ? 'bg-[#34D399]/10 border-[#34D399]/40 text-[#A7F3D0]'
            : 'bg-[#FB7185]/10 border-[#FB7185]/40 text-[#FECDD3]'}`}>
            {banner.kind === 'ok'
              ? <>🎉 <b>¡Listo!</b> Tu acceso quedó activo. Te estamos llevando a tu cuenta…</>
              : <>El pago se canceló. Puedes intentarlo cuando quieras — el contenido sigue gratis.</>}
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative z-10 max-w-[900px] mx-auto px-6 pt-12 pb-10 text-center">
        <h1 className="text-[64px] md:text-[88px] font-extrabold leading-none tracking-tight"
          style={{ backgroundImage: GAIA_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          GAIA
        </h1>
        <p className="mt-5 text-[22px] md:text-[26px] font-semibold text-white">
          El contenido es gratis. Para siempre.
        </p>
        <p className="mt-3 text-[15px] text-[#94A3B8] max-w-[620px] mx-auto leading-relaxed">
          La saga completa — átomos, moléculas, el cosmos — vive abierta para todos.
          Aquí solo desbloqueas el <span className="text-[#E2E8F0]">laboratorio</span>: las simulaciones
          que se manipulan, el CAD, y el cómputo para crear de verdad.
        </p>
      </section>

      {/* Tiers */}
      <section className="relative z-10 max-w-[1100px] mx-auto px-6 pb-8 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.key}
            className={`relative rounded-2xl p-6 flex flex-col border transition ${p.featured
              ? 'border-transparent bg-[#0B0F17]'
              : 'border-[#1E293B] bg-[#0A0D14] hover:border-[#334155]'}`}
            style={p.featured ? { boxShadow: '0 0 0 1.5px transparent', backgroundImage: `linear-gradient(#0B0F17,#0B0F17), ${GAIA_GRADIENT}`, backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' } : undefined}>
            {p.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full text-[#05060A]"
                style={{ background: GAIA_GRADIENT }}>Vender todo el conjunto</div>
            )}
            <div className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider">{p.badge}</div>
            <div className="mt-2 text-[19px] font-bold text-white">{p.name}</div>
            <div className="mt-1 text-[13px] text-[#94A3B8] min-h-[38px]">{p.tagline}</div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-[40px] font-extrabold text-white">{p.price}</span>
              <span className="text-[13px] text-[#64748B]">MXN / {p.cadence}</span>
            </div>
            <ul className="mt-5 space-y-2.5 flex-1">
              {p.unlocks.map((u, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-[#CBD5E1]">
                  <span className="text-[#34D399] mt-[2px]">✓</span><span>{u}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => onCta(p)}
              className={`mt-6 w-full py-3 rounded-xl font-semibold text-[14px] transition ${p.featured
                ? 'text-[#05060A] hover:opacity-90'
                : p.external
                  ? 'bg-transparent border border-[#334155] text-[#E2E8F0] hover:border-[#64748B]'
                  : 'bg-white text-[#05060A] hover:opacity-90'}`}
              style={p.featured ? { background: GAIA_GRADIENT } : undefined}>
              {p.cta}
            </button>
          </div>
        ))}
      </section>

      {/* Nota estudiante gratis */}
      <section className="relative z-10 max-w-[760px] mx-auto px-6 pb-16 text-center">
        <p className="text-[13px] text-[#64748B] leading-relaxed">
          ¿Tienes correo <span className="font-mono text-[#94A3B8]">@ipn.mx · @unam.mx · @tec.mx</span> u otro institucional?
          <br />Escríbenos — <span className="text-[#94A3B8]">el conocimiento no se le niega a quien tiene hambre.</span>
          <br />Pagas solo el cómputo pesado, a costo. La escuela es gratis.
        </p>
      </section>

      {/* Modal de email */}
      {openFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !loading && setOpenFor(null)}>
          <div className="w-full max-w-[400px] rounded-2xl border border-[#1E293B] bg-[#0B0F17] p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="text-[11px] font-mono text-[#64748B] uppercase tracking-wider">{openFor.badge}</div>
            <div className="mt-1 text-[18px] font-bold text-white">{openFor.name}</div>
            <div className="mt-1 text-[13px] text-[#94A3B8]">
              {openFor.price} MXN / {openFor.cadence} · pago seguro con Stripe
            </div>
            {loggedEmail ? (
              // 1-CLICK: ya logueado → solo confirma la aceptación legal y a Stripe
              <>
                <div className="mt-5 text-[13px] text-[#94A3B8]">Pagas como <span className="text-white">{loggedEmail}</span></div>
                <TermsCheck checked={acceptedTerms} onChange={setAcceptedTerms} />
                {error && <div className="mt-2 text-[12px] text-[#FB7185]">{error}</div>}
                <button onClick={() => openFor && startCheckout(openFor, loggedEmail)} disabled={loading || !acceptedTerms}
                  className="mt-4 w-full py-3 rounded-xl font-semibold text-[14px] text-[#05060A] transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: GAIA_GRADIENT }}>
                  {loading ? 'Conectando con Stripe…' : `Continuar al pago · ${openFor.price}`}
                </button>
              </>
            ) : (
              <>
                <input
                  type="email" autoFocus value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && openFor && startCheckout(openFor, email)}
                  placeholder="tu@correo.com"
                  className="mt-5 w-full px-4 py-3 rounded-xl bg-[#05060A] border border-[#1E293B] text-white text-[14px] outline-none focus:border-[#4FC3F7] transition"
                />
                <TermsCheck checked={acceptedTerms} onChange={setAcceptedTerms} />
                {error && <div className="mt-2 text-[12px] text-[#FB7185]">{error}</div>}
                <button onClick={() => openFor && startCheckout(openFor, email)} disabled={loading || !acceptedTerms}
                  className="mt-4 w-full py-3 rounded-xl font-semibold text-[14px] text-[#05060A] transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: GAIA_GRADIENT }}>
                  {loading ? 'Conectando con Stripe…' : `Continuar al pago · ${openFor.price}`}
                </button>
              </>
            )}
            <button onClick={() => !loading && setOpenFor(null)}
              className="mt-2 w-full py-2 text-[12px] text-[#64748B] hover:text-[#94A3B8] transition">
              {loggedEmail && !error ? 'Cerrar' : 'Cancelar'}
            </button>
            <p className="mt-3 text-[10px] text-[#475569] text-center leading-relaxed">
              Te llevamos a Stripe para el pago. Tu acceso se liga a {loggedEmail ? 'tu cuenta' : 'este correo'}.
            </p>
          </div>
        </div>
      )}

      <footer className="relative z-10 border-t border-[#0F172A] py-6 text-center text-[11px] text-[#475569] font-mono">
        <div className="flex items-center justify-center gap-3 mb-2">
          <a href="/terminos.html" className="hover:text-[#94A3B8] transition">Términos</a>
          <span className="text-[#1E293B]">·</span>
          <a href="/privacidad.html" className="hover:text-[#94A3B8] transition">Privacidad</a>
        </div>
        Γ GAIA · De Chimalhuacán para el mundo · La escalera ahora es para todos
      </footer>
    </div>
  );
}

/** Checkbox de aceptación legal (T&C + Aviso de Privacidad). Requerido para pagar. */
function TermsCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-4 flex items-start gap-2.5 cursor-pointer select-none text-[12px] text-[#94A3B8] leading-snug">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[2px] h-4 w-4 shrink-0 cursor-pointer accent-[#34D399]"
      />
      <span>
        He leído y acepto los{' '}
        <a href="/terminos.html" target="_blank" rel="noopener noreferrer" className="text-[#4FC3F7] hover:underline">Términos y Condiciones</a>{' '}
        y el{' '}
        <a href="/privacidad.html" target="_blank" rel="noopener noreferrer" className="text-[#4FC3F7] hover:underline">Aviso de Privacidad</a>.
      </span>
    </label>
  );
}
