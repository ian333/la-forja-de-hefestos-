// src/lib/GaiaGate.tsx
// Candado reusable: envuelve una página protegida. Si el usuario no tiene el plan
// requerido, muestra una pantalla de upsell en vez del contenido.
import { useEffect, useState, type ReactNode } from 'react';
import { type Me, type PlanKey, fetchMe, hasPlan, PLAN_NAMES, GAIA_GRADIENT } from './gaia-access';

type Props = {
  /** Plan mínimo requerido para ver el contenido. */
  requires: PlanKey;
  /** Nombre del lab/página, para el copy del candado. */
  feature?: string;
  children: ReactNode;
  /** Override opcional de la pantalla de candado. */
  fallback?: (me: Me | null) => ReactNode;
};

export default function GaiaGate({ requires, feature = 'este laboratorio', children, fallback }: Props) {
  const [state, setState] = useState<'loading' | 'allowed' | 'locked'>('loading');
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetchMe()
      .then((m) => {
        setMe(m);
        setState(hasPlan(m, requires) ? 'allowed' : 'locked');
      })
      .catch(() => setState('locked'));
  }, [requires]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#05060A] flex items-center justify-center text-[#64748B] text-[14px] font-mono">
        Verificando tu acceso…
      </div>
    );
  }
  if (state === 'allowed') return <>{children}</>;
  if (fallback) return <>{fallback(me)}</>;

  // ── Pantalla de candado + upsell ──
  const planName = PLAN_NAMES[requires] ?? requires;
  return (
    <div className="min-h-screen bg-[#05060A] text-[#E2E8F0] font-sans relative overflow-hidden flex items-center justify-center px-6">
      <div className="fixed top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none opacity-20 blur-[130px]"
        style={{ background: 'radial-gradient(circle, #7E57C2 0%, transparent 70%)' }} />
      <div className="relative z-10 w-full max-w-[440px] rounded-2xl border border-[#1E293B] bg-[#0B0F17] p-8 text-center">
        <div className="text-[40px]">🔒</div>
        <h1 className="mt-3 text-[24px] font-extrabold"
          style={{ backgroundImage: GAIA_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          Desbloquea {feature}
        </h1>
        <p className="mt-2 text-[14px] text-[#94A3B8] leading-relaxed">
          {me
            ? <>Tu cuenta <span className="text-white break-all">{me.email}</span> aún no incluye <b className="text-[#E2E8F0]">{planName}</b>. El contenido es gratis; esto desbloquea el laboratorio.</>
            : <>Inicia sesión y activa <b className="text-[#E2E8F0]">{planName}</b> para entrar. El contenido es gratis; esto desbloquea el laboratorio.</>}
        </p>

        <a href="/precios.html"
          className="mt-6 inline-block w-full py-3 rounded-xl font-semibold text-[14px] text-[#05060A] transition hover:opacity-90"
          style={{ background: GAIA_GRADIENT }}>
          {me ? `Activar ${planName} →` : 'Ver planes →'}
        </a>
        <a href="/cuenta.html"
          className="mt-2 inline-block w-full py-2.5 rounded-xl text-[13px] text-[#94A3B8] border border-[#1E293B] hover:border-[#334155] transition">
          {me ? 'Ir a mi cuenta' : 'Ya tengo cuenta — iniciar sesión'}
        </a>

        <a href="/" className="mt-4 inline-block text-[12px] text-[#475569] font-mono hover:text-[#94A3B8] transition">← Volver al inicio</a>
      </div>
    </div>
  );
}
