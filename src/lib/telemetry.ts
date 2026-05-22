/**
 * telemetry — cliente que captura TODO lo que pasa en el browser del usuario
 * y lo manda al servidor forja-telemetry. Sirve para debug remoto cuando
 * "no se ve nada" pero no podemos reproducir localmente.
 *
 * Captura:
 *   • window.onerror             (errores JS no atrapados)
 *   • unhandledrejection         (promesas que crashean)
 *   • console.error/warn         (intercepta)
 *   • click                      (con selector + texto del target)
 *   • fetch/XHR                  (URL + status, especialmente 4xx/5xx)
 *   • pageview                   (en mount)
 *   • visibilitychange           (tab focus/blur)
 *   • custom events              via telemetry.event(type, data)
 *
 * Envía en batches cada 2s o cuando hay >50 eventos pendientes, y un flush
 * final con sendBeacon al unload.
 *
 * Endpoint configurable via window.__TELEMETRY_URL o default /api/telemetry.
 *
 * Uso:
 *   import './lib/telemetry';   // auto-arranca, no-op si está deshabilitado
 *
 *   // Eventos custom:
 *   telemetry.event('scene_change', { from: 'bh/well', to: 'bh/photon' });
 */

interface Event {
  t: number;
  type: string;
  sid: string;
  url: string;
  data: Record<string, unknown>;
}

const ENDPOINT = (typeof window !== 'undefined' && (window as { __TELEMETRY_URL?: string }).__TELEMETRY_URL)
  || '/api/telemetry/events';
const BATCH_MS = 2000;
const MAX_BATCH = 50;

// session id persistente por tab (sessionStorage)
function getSid(): string {
  if (typeof window === 'undefined') return 'srv';
  try {
    let sid = sessionStorage.getItem('__forja_sid');
    if (!sid) {
      sid = Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
      sessionStorage.setItem('__forja_sid', sid);
    }
    return sid;
  } catch {
    return 'nosid';
  }
}

class Telemetry {
  private queue: Event[] = [];
  private sid: string;
  private flushTimer: number | null = null;
  private installed = false;

  constructor() {
    this.sid = getSid();
  }

  install() {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;

    // ─── Errores JS ───────────────────────────────────────────────
    window.addEventListener('error', (e) => {
      this.event('error', {
        msg: e.message,
        src: e.filename,
        line: e.lineno,
        col: e.colno,
        stack: e.error?.stack?.slice(0, 2000),
      });
    });

    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason;
      this.event('rejection', {
        msg: reason?.message || String(reason).slice(0, 500),
        stack: reason?.stack?.slice(0, 2000),
      });
    });

    // ─── console.error / console.warn intercept ───────────────────
    const origErr = console.error;
    console.error = (...args: unknown[]) => {
      try {
        this.event('console_error', {
          args: args.map(a => safeStr(a)).slice(0, 5),
        });
      } catch { /* never break console */ }
      origErr.apply(console, args);
    };

    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      try {
        const txt = args.map(a => safeStr(a)).join(' ');
        // Filtrar warnings ruidosos de React/Three (no aportan info de debug)
        if (!/THREE.THREE.Clock|React Router/i.test(txt)) {
          this.event('console_warn', {
            args: args.map(a => safeStr(a)).slice(0, 5),
          });
        }
      } catch { /* never break */ }
      origWarn.apply(console, args);
    };

    // ─── Clicks ───────────────────────────────────────────────────
    document.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (!t) return;
      this.event('click', {
        tag: t.tagName,
        id: t.id || undefined,
        cls: (t.className && typeof t.className === 'string') ? t.className.slice(0, 100) : undefined,
        text: (t.textContent || '').trim().slice(0, 80),
        x: e.clientX,
        y: e.clientY,
      });
    }, { capture: true });

    // ─── Fetch responses ──────────────────────────────────────────
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url || '';
      // No queremos loguear nuestros propios pings al telemetry
      if (url.includes(ENDPOINT.split('?')[0])) return origFetch(input, init);
      const t0 = performance.now();
      try {
        const res = await origFetch(input, init);
        if (res.status >= 400) {
          this.event('http_error', {
            url: short(url), status: res.status, ms: Math.round(performance.now() - t0),
          });
        }
        return res;
      } catch (err) {
        this.event('fetch_fail', {
          url: short(url), err: (err as Error)?.message?.slice(0, 200),
        });
        throw err;
      }
    };

    // ─── XHR ──────────────────────────────────────────────────────
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: unknown[]) {
      (this as XMLHttpRequest & { __t_url?: string; __t_method?: string }).__t_url = url;
      (this as XMLHttpRequest & { __t_url?: string; __t_method?: string }).__t_method = method;
      return origOpen.apply(this, [method, url, ...rest] as Parameters<typeof origOpen>);
    };
    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const self = this as XMLHttpRequest & { __t_url?: string };
      const u = self.__t_url || '';
      if (!u.includes(ENDPOINT.split('?')[0])) {
        this.addEventListener('loadend', () => {
          if (this.status >= 400 || this.status === 0) {
            telemetry.event('xhr_error', {
              url: short(u), status: this.status,
            });
          }
        });
      }
      return origSend.call(this, body as Document | XMLHttpRequestBodyInit | null);
    };

    // ─── Pageview + visibility ────────────────────────────────────
    this.event('pageview', {
      ref: document.referrer,
      vw: window.innerWidth,
      vh: window.innerHeight,
      dpr: window.devicePixelRatio,
      lang: navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    document.addEventListener('visibilitychange', () => {
      this.event('visibility', { state: document.visibilityState });
    });

    // ─── WebGL probe (clave para debug "no se ve nada") ───────────
    try {
      const c = document.createElement('canvas');
      const g2 = c.getContext('webgl2');
      const g1 = !g2 ? c.getContext('webgl') : null;
      const g = g2 || g1;
      let renderer = 'none', vendor = 'none';
      if (g) {
        const ext = g.getExtension('WEBGL_debug_renderer_info');
        renderer = ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no_ext';
        vendor = ext ? g.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'no_ext';
      }
      this.event('webgl_probe', {
        version: g2 ? 'webgl2' : g1 ? 'webgl' : 'none',
        renderer, vendor,
      });
    } catch (e) {
      this.event('webgl_probe_fail', { msg: (e as Error)?.message });
    }

    // ─── Unload flush ─────────────────────────────────────────────
    window.addEventListener('pagehide', () => this.flushBeacon());
    window.addEventListener('beforeunload', () => this.flushBeacon());

    // Public for debug
    (window as { telemetry?: Telemetry }).telemetry = this;
  }

  event(type: string, data: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;
    this.queue.push({
      t: Date.now(),
      type,
      sid: this.sid,
      url: location.href,
      data,
    });
    if (this.queue.length >= MAX_BATCH) {
      this.flush();
    } else if (this.flushTimer === null) {
      this.flushTimer = window.setTimeout(() => { this.flushTimer = null; this.flush(); }, BATCH_MS);
    }
  }

  private flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        keepalive: true,
      }).catch(() => { /* no-op */ });
    } catch { /* no-op */ }
  }

  private flushBeacon() {
    if (this.queue.length === 0) return;
    try {
      const blob = new Blob([JSON.stringify(this.queue)], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
      this.queue = [];
    } catch { /* no-op */ }
  }
}

function safeStr(x: unknown): string {
  if (typeof x === 'string') return x.slice(0, 500);
  if (x instanceof Error) return `${x.name}: ${x.message}`;
  try { return JSON.stringify(x).slice(0, 500); } catch { return String(x).slice(0, 500); }
}

function short(u: string): string {
  return u.length > 256 ? u.slice(0, 256) + '…' : u;
}

export const telemetry = new Telemetry();

// Auto-install al importar
if (typeof window !== 'undefined') {
  telemetry.install();
}
