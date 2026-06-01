// src/lib/gaia-access.ts
// Núcleo de sesión + accesos GAIA. Sin React: solo fetch y tipos.
// Habla con el servicio AISLADO university-api (meta[name="gaia-api"]), NO con Orkesta.

export const API_BASE =
  document.querySelector('meta[name="gaia-api"]')?.getAttribute('content')?.replace(/\/$/, '') ||
  'http://localhost:8000';

export const GAIA_GRADIENT =
  'linear-gradient(90deg,#F472B6 0%,#FB7185 18%,#FDB813 38%,#34D399 58%,#4FC3F7 78%,#7E57C2 100%)';

const SESSION_KEY = 'gaia_session';

export type PlanKey = 'GAIA_LABS' | 'GAIA_FISICA_CAD';

export const PLAN_NAMES: Record<string, string> = {
  GAIA_LABS: 'GAIA Laboratorios',
  GAIA_FISICA_CAD: 'GAIA Física + CAD',
};

export type SubStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';

export type Subscription = {
  plan: PlanKey | null;
  plan_name?: string | null;
  status: SubStatus;
  cancel_at_period_end: boolean;
  current_period_end: number | null; // epoch UTC en segundos (como lo manda el backend)
  amount: number | null;             // centavos
  currency?: string | null;
  interval: 'year' | 'month' | null;
};

export type Me = {
  email: string;
  name: string | null;
  access: { active_plans: string[]; active: boolean };
  subscription: Subscription | null;
};

// ─── Sesión (localStorage) ───────────────────────────────────────────────
export const getSession = (): string | null => localStorage.getItem(SESSION_KEY);
export const setSession = (jwt: string) => localStorage.setItem(SESSION_KEY, jwt);
export const clearSession = () => localStorage.removeItem(SESSION_KEY);

const authHeaders = (s: string) => ({ Authorization: `Bearer ${s}` });

// ─── Lectura de la cuenta ────────────────────────────────────────────────
/** Trae /auth/me. Si el token caducó (401) limpia la sesión y devuelve null. */
export async function fetchMe(session = getSession()): Promise<Me | null> {
  if (!session) return null;
  const r = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders(session) });
  if (r.status === 401) {
    clearSession();
    return null;
  }
  if (!r.ok) throw new Error('No pudimos conectar con tu cuenta.');
  return (await r.json()) as Me;
}

// ─── Gating: "¿tiene plan X?" ─────────────────────────────────────────────
/**
 * Jerarquía de acceso: GAIA_FISICA_CAD ⊇ GAIA_LABS.
 * Quien paga Física+CAD también entra a los labs de Laboratorios.
 */
const PLAN_IMPLIES: Record<PlanKey, PlanKey[]> = {
  GAIA_FISICA_CAD: ['GAIA_FISICA_CAD', 'GAIA_LABS'],
  GAIA_LABS: ['GAIA_LABS'],
};

/** ¿La cuenta `me` desbloquea `required`? (considera la jerarquía). */
export function hasPlan(me: Me | null, required: PlanKey): boolean {
  if (!me?.access?.active) return false;
  const granted = new Set<string>();
  for (const p of me.access.active_plans) {
    for (const g of PLAN_IMPLIES[p as PlanKey] ?? [p]) granted.add(g);
  }
  return granted.has(required);
}

/** Atajo: trae la cuenta y resuelve el acceso en una llamada. */
export async function checkAccess(required: PlanKey): Promise<{ me: Me | null; allowed: boolean }> {
  const me = await fetchMe();
  return { me, allowed: hasPlan(me, required) };
}

// ─── Auto-login post-pago ────────────────────────────────────────────────
/** Canjea el session_id de Stripe por un JWT y lo persiste. */
export async function sessionFromCheckout(sessionId: string): Promise<Me | null> {
  // Backend: GET /auth/session-from-checkout?session_id=... → { token, email }
  const r = await fetch(`${API_BASE}/auth/session-from-checkout?session_id=${encodeURIComponent(sessionId)}`);
  if (!r.ok) return null;
  const data = await r.json();
  if (!data?.token) return null;
  setSession(data.token);
  return fetchMe(data.token);
}

// ─── Billing portal + edición de perfil ──────────────────────────────────
/** Abre el Stripe Billing Portal (gestionar/cancelar/recibos). Devuelve URL o null. */
export async function openBillingPortal(): Promise<string | null> {
  const s = getSession();
  if (!s) return null;
  // Backend: GET /billing/portal (Bearer) → { url }
  const r = await fetch(`${API_BASE}/billing/portal`, { headers: authHeaders(s) });
  if (!r.ok) return null;
  const data = await r.json();
  return data?.url ?? null;
}

/** Guarda el nombre del perfil. */
export async function updateName(name: string): Promise<boolean> {
  const s = getSession();
  if (!s) return false;
  const r = await fetch(`${API_BASE}/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(s) },
    body: JSON.stringify({ name: name.trim() }),
  });
  return r.ok;
}

// ─── Formato (es-MX) ──────────────────────────────────────────────────────
export const STATUS_LABEL: Record<SubStatus, string> = {
  active: 'Activa',
  trialing: 'En prueba',
  past_due: 'Pago pendiente',
  canceled: 'Cancelada',
  none: 'Sin suscripción',
};

export function fmtDate(epoch: number | null): string {
  if (epoch == null) return '—';
  return new Date(epoch * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtMoney(cents: number | null, interval: 'year' | 'month' | null): string {
  if (cents == null) return '—';
  const cad = interval === 'year' ? 'año' : interval === 'month' ? 'mes' : '';
  return `$${(cents / 100).toLocaleString('es-MX')} MXN${cad ? ` / ${cad}` : ''}`;
}
