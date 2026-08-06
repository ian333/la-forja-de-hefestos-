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
 *   • origen                     (utm/fbclid parseados UNA vez por sesión)
 *   • vitals                     (LCP / INP / CLS / FCP / TTFB / 1ª interacción)
 *   • salida                     (sección, segundos visibles, interacciones, scroll)
 *
 * Envía en batches cada 2s o cuando hay >50 eventos pendientes, y un flush
 * final con sendBeacon al unload.
 *
 * NO CAPTURA (y no debe capturar nunca — LFPDPPP + el aviso de privacidad):
 * texto tecleado, valores de inputs, teclas, movimiento de ratón, ni nada que
 * permita reconstruir la sesión. Los eventos son AGREGABLES, no reproducibles.
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

// session id persistente por tab (sessionStorage).
// EXPORTADO porque `lib/ab.ts` reparte las variantes hasheando ESTE mismo id:
// si cada módulo generara el suyo, la variante que se muestra y la que se
// reporta podrían no ser la misma y el experimento mediría ruido.
export function getSid(): string {
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

// ─── Normalización del ORIGEN ────────────────────────────────────────
// Los parámetros de campaña identifican el CLIC DEL ANUNCIO, no la página.
// Repetirlos en los ~10 eventos de cada sesión llenaba el log de ruido (una
// URL de Instagram mide 400+ caracteres y el servidor corta a 1024, así que
// el fbclid llegaba a comerse la ruta) y volvía ilegible el reporte. Se
// parsean UNA vez → evento `origen`; de ahí en adelante la url viaja limpia.
// Efecto lateral bueno: el fbclid es un identificador de clic de Meta y deja
// de guardarse 10 veces por sesión.
const TRACKING = /^(utm_[a-z_]+|fbclid|gclid|gbraid|wbraid|msclkid|ttclid|twclid|igshid|mc_eid|mc_cid|_ga|ref_src|ref_url)$/i;

function cleanUrl(href: string): string {
  try {
    const u = new URL(href);
    const keep = new URLSearchParams();
    u.searchParams.forEach((v, k) => { if (!TRACKING.test(k)) keep.append(k, v); });
    const q = keep.toString();
    return u.origin + u.pathname + (q ? '?' + q : '') + u.hash;
  } catch {
    return href.split('?')[0];
  }
}

function parseOrigen(): Record<string, unknown> {
  const p = new URLSearchParams(location.search);
  const medio = (p.get('utm_medium') || '').toLowerCase();
  const source = (p.get('utm_source') || '').toLowerCase();
  const pagado = /^(paid|cpc|ppc|paid_social|paidsocial|ads?|display)$/.test(medio)
    || p.has('fbclid') || p.has('gclid') || p.has('ttclid') || p.has('msclkid');
  let refHost = '';
  try { refHost = document.referrer ? new URL(document.referrer).hostname : ''; } catch { /* referrer raro */ }
  const externo = !!refHost && refHost !== location.hostname;
  const fuente = pagado ? 'paid' : (source || medio || externo) ? 'organico' : 'directo';
  return {
    fuente,
    campana: p.get('utm_campaign') || undefined,   // Meta manda ids numéricos
    medio: medio || undefined,
    source: source || undefined,
    contenido: p.get('utm_content') || undefined,  // = el anuncio concreto
    ref: externo ? refHost : undefined,            // SOLO el host, nunca la URL
    landing: location.pathname,
  };
}

// requestIdleCallback con fallback (Safari <16.4 no lo tiene). Nada de lo que
// hace la telemetría es urgente: se agenda en los huecos del hilo principal
// para no robarle frames a un Mali-G52.
type IdleFn = () => void;
function idle(fn: IdleFn, timeout = 2000): number {
  const ric = (window as unknown as { requestIdleCallback?: (f: IdleFn, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) return ric(fn, { timeout });
  return window.setTimeout(fn, Math.min(timeout, 200));
}

class Telemetry {
  private queue: Event[] = [];
  private sid: string;
  private flushTimer: number | null = null;
  private installed = false;

  // ── Estado de sesión (todo agregado, nada reproducible) ──
  private t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  private interacciones = 0;         // clics + eventos con nombre
  private scrollMax = 0;             // % de profundidad alcanzada
  private scrollable = false;
  private seccionActual = '';        // última sección vista / declarada
  private visibleMs = 0;             // tiempo REAL con la pestaña al frente
  private visibleDesde = typeof performance !== 'undefined' ? performance.now() : 0;
  private salidas = 0;               // nº de veces que se fue a segundo plano
  private ultimoReporte = -1;        // ms visibles ya reportados (anti-duplicado)
  private vitalsEnviados = false;
  private vitals: Record<string, number> = {};
  private tpi = 0;                   // tiempo hasta la primera interacción (ms)
  private scrollPend = false;

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
      this.interacciones++;
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

    // ORIGEN — una sola vez por sesión (ver parseOrigen).
    try {
      if (sessionStorage.getItem('__forja_origen') !== this.sid) {
        sessionStorage.setItem('__forja_origen', this.sid);
        this.event('origen', parseOrigen());
      }
    } catch {
      this.event('origen', parseOrigen());   // sin sessionStorage: mejor duplicar que perder
    }

    document.addEventListener('visibilitychange', () => {
      const oculto = document.visibilityState === 'hidden';
      if (oculto) {
        this.reportarSalida();               // enqueue ANTES del flush de abajo
      } else {
        this.visibleDesde = performance.now();
      }
      this.event('visibility', { state: document.visibilityState });
      if (oculto) this.flush();
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

    // ─── Main thread BLOQUEADO (la métrica del "se traba") ────────
    // longtask = tarea que retiene el main thread. Reportamos solo las que
    // el usuario SIENTE (≥500 ms). El freeze del 2026-07-24 (una sesión viva
    // huérfana armaba el molde completo al boot) dejó la telemetría MUDA
    // justo cuando más se necesitaba — un longtask de minutos lo habría
    // delatado en el primer vistazo al /raw.
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.duration >= 500) {
            this.event('longtask', { ms: Math.round(e.duration), start: Math.round(e.startTime) });
          }
        }
      });
      po.observe({ type: 'longtask', buffered: true });
    } catch { /* browser sin longtask API */ }

    this.installVitals();
    this.installProfundidad();

    // ─── Unload flush ─────────────────────────────────────────────
    // OJO al orden: `reportarSalida` mete el evento en la cola y DESPUÉS
    // corre el flush. Si se registraran al revés, el último evento de cada
    // sesión —justo el que dice dónde se fue la gente— se perdería siempre.
    window.addEventListener('pagehide', () => { this.reportarSalida(); this.flush(); });
    window.addEventListener('beforeunload', () => this.flush());

    // Public for debug
    (window as { telemetry?: Telemetry }).telemetry = this;
  }

  event(type: string, data: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;
    // Un evento con NOMBRE (lab.*, masterclass.*) es una interacción deliberada:
    // cuenta igual que un clic para el "¿hizo algo?" del embudo.
    if (type.includes('.')) this.interacciones++;
    this.queue.push({
      t: Date.now(),
      type,
      sid: this.sid,
      url: cleanUrl(location.href),
      data,
    });
    if (this.queue.length >= MAX_BATCH) {
      this.flush();
    } else if (this.flushTimer === null) {
      // En hueco ocioso: el envío no compite con el primer render ni con el
      // scroll. `timeout` garantiza que igual sale a los 2 s.
      this.flushTimer = idle(() => { this.flushTimer = null; this.flush(); }, BATCH_MS);
    }
  }

  /** Declara en qué parte de la página está el usuario. Alimenta `salida.seccion`
   *  (el "punto de salida"). Se detecta solo con [data-seccion]/section[id], pero
   *  una vista sin scroll —el laboratorio— tiene que decirlo a mano. */
  seccion(nombre: string) {
    if (nombre && nombre !== this.seccionActual) this.seccionActual = nombre.slice(0, 40);
  }

  /** Vacía la cola YA. Público porque quien registra un evento justo al salir
   *  (p. ej. el abandono de una clase) no puede confiar en el orden de los
   *  listeners de `pagehide`: si el de telemetry corre primero, su evento se
   *  perdería. Llamando esto explícitamente, no se pierde.
   *
   *  ANTES había DOS `flush()` en esta clase (uno privado con fetch y este
   *  público con beacon). En JS gana el último, así que el de fetch era código
   *  muerto y TODO salía por sendBeacon — incluidos los lotes grandes, que
   *  sendBeacon rechaza sobre ~64 KB devolviendo `false` en silencio. Ahora es
   *  uno solo, con fetch(keepalive) de red de seguridad. */
  flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    const body = JSON.stringify(batch);
    try {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    } catch { /* cae al fetch */ }
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => { /* la página sigue viva pase lo que pase */ });
    } catch { /* no-op */ }
  }

  // ══════════════════════════════════════════════════════════════════
  // WEB VITALS — sin librerías, solo PerformanceObserver.
  //
  // Por qué importa aquí y no en abstracto: el 65 % de las visitas se van
  // antes de 3 s, y la audiencia real corre en Mali-G52/G57 y Adreno 610/619
  // (medido en webgl_probe). Sin LCP/INP no se puede distinguir "el contenido
  // no le interesó" de "la página todavía no había pintado". Son diagnósticos
  // opuestos y llevan a decisiones opuestas.
  //
  // Se manda UN solo evento `vitals` al primer ocultamiento — no uno por
  // métrica — para no gastar peticiones en un teléfono de gama media.
  // ══════════════════════════════════════════════════════════════════
  private installVitals() {
    const nav = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
    if (nav?.responseStart) this.vitals.ttfb = Math.round(nav.responseStart);

    const obs = (type: string, cb: (e: PerformanceEntry[]) => void, extra: Record<string, unknown> = {}) => {
      try {
        const po = new PerformanceObserver((l) => cb(l.getEntries()));
        po.observe({ type, buffered: true, ...extra } as unknown as PerformanceObserverInit);
        return po;
      } catch { return null; }   // navegador sin ese tipo: la página sigue igual
    };

    // FCP — el primer pixel de contenido.
    obs('paint', (es) => {
      for (const e of es) if (e.name === 'first-contentful-paint') this.vitals.fcp = Math.round(e.startTime);
    });

    // LCP — el elemento grande. Deja de contar en la primera interacción,
    // como manda la definición (a partir de ahí el cambio ya no es "carga").
    const poLcp = obs('largest-contentful-paint', (es) => {
      const last = es[es.length - 1];
      if (last) this.vitals.lcp = Math.round(last.startTime);
    });

    // CLS — suma por ventanas de sesión (1 s de hueco, 5 s de tope), que es
    // la definición buena; sumar todo de corrido castigaba páginas largas.
    let clsSes = 0, clsPrim = 0, clsUlt = 0;
    obs('layout-shift', (es) => {
      for (const e of es as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (e.hadRecentInput) continue;
        if (clsSes && e.startTime - clsUlt < 1000 && e.startTime - clsPrim < 5000) {
          clsSes += e.value;
        } else {
          clsSes = e.value; clsPrim = e.startTime;
        }
        clsUlt = e.startTime;
        if (clsSes > (this.vitals.cls ?? 0)) this.vitals.cls = clsSes;
      }
    });

    // INP — la latencia de la interacción PEOR (percentil alto), agrupando por
    // interactionId. Es lo que la gente siente cuando "no responde". Safari no
    // expone interactionId: ahí queda sin dato (≈1/3 del tráfico) y el reporte
    // dice cuántas muestras hubo, en vez de mentir con un promedio incompleto.
    const porInteraccion = new Map<number, number>();
    obs('event', (es) => {
      for (const e of es as (PerformanceEntry & { interactionId?: number })[]) {
        const id = e.interactionId;
        if (!id) continue;
        const prev = porInteraccion.get(id) ?? 0;
        if (e.duration > prev) porInteraccion.set(id, e.duration);
      }
      if (porInteraccion.size > 60) {   // techo de memoria: nos quedan los peores
        const peores = [...porInteraccion.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
        porInteraccion.clear();
        for (const [k, v] of peores) porInteraccion.set(k, v);
      }
    }, { durationThreshold: 40 });
    this.calcInp = () => {
      const ds = [...porInteraccion.values()].sort((a, b) => b - a);
      if (!ds.length) return null;
      const i = Math.min(ds.length - 1, Math.floor(porInteraccion.size / 50));
      return { inp: Math.round(ds[i]), inpN: porInteraccion.size };
    };

    // Primera interacción: CUÁNDO tocó algo por primera vez. Es la señal de
    // "sí llegó a interactuar" y el corte natural de la carga.
    const primera = () => {
      if (this.tpi) return;
      this.tpi = Math.round(performance.now() - this.t0);
      try { poLcp?.disconnect(); } catch { /* ya desconectado */ }
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) {
      window.addEventListener(ev, primera, { once: true, capture: true, passive: true });
    }
  }

  private calcInp: () => { inp: number; inpN: number } | null = () => null;

  // ══════════════════════════════════════════════════════════════════
  // PROFUNDIDAD — hasta dónde bajó y en qué sección se quedó.
  // El listener es passive y sólo apunta una bandera; la cuenta corre en un
  // hueco ocioso. Cero trabajo por evento de scroll.
  // ══════════════════════════════════════════════════════════════════
  private installProfundidad() {
    const medir = () => {
      this.scrollPend = false;
      const doc = document.documentElement;
      const alto = Math.max(doc.scrollHeight, document.body?.scrollHeight ?? 0);
      // Una vista que NO scrollea (el laboratorio es h-screen) daría 100 %
      // siempre y ensuciaría la mediana. Se marca como no-scrollable y el
      // reporte la excluye en vez de contarla como "leyó todo".
      this.scrollable = alto > window.innerHeight + 8;
      if (!this.scrollable) return;
      const pct = Math.round(((window.scrollY + window.innerHeight) / alto) * 100);
      if (pct > this.scrollMax) this.scrollMax = Math.max(0, Math.min(100, pct));
    };
    medir();
    window.addEventListener('scroll', () => {
      if (this.scrollPend) return;
      this.scrollPend = true;
      idle(medir, 500);
    }, { passive: true });

    // Sección visible. Se apoya en marcadores que ya existen en el DOM
    // ([data-seccion] o <section id>), así que no hace falta instrumentar
    // cada bloque a mano.
    try {
      const io = new IntersectionObserver((ents) => {
        for (const e of ents) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          this.seccion(el.dataset.seccion || el.id || '');
        }
      }, { threshold: 0.35 });
      const marcar = () => document.querySelectorAll('[data-seccion], section[id]').forEach((el) => io.observe(el));
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', marcar, { once: true });
      else idle(marcar, 1000);
    } catch { /* navegador sin IntersectionObserver */ }
  }

  // ══════════════════════════════════════════════════════════════════
  // SALIDA — el evento que faltaba. Hoy la duración se deriva del ÚLTIMO
  // evento recibido, lo que la subestima siempre (quien mira 40 s sin tocar
  // nada figura como 0 s). Aquí va el tiempo REAL con la pestaña al frente,
  // la sección donde se quedó, cuántas veces interactuó y hasta dónde bajó.
  // Se emite en cada paso a segundo plano (con `n`); el reporte toma el último.
  // ══════════════════════════════════════════════════════════════════
  private reportarSalida() {
    // Cierra el tramo visible en curso. Va aquí y no en el listener porque
    // `pagehide` puede llegar SIN un visibilitychange previo (navegación
    // directa en algunos navegadores) y entonces el tiempo quedaría en 0.
    if (this.visibleDesde >= 0) {
      this.visibleMs += performance.now() - this.visibleDesde;
      this.visibleDesde = -1;
    }
    // Al cerrar una pestaña disparan visibilitychange Y pagehide, y sin este
    // corte cada sesión terminaba con DOS `salida` idénticos: el doble de
    // eventos por el mismo dato. Si no ha pasado tiempo visible nuevo, ya se
    // reportó todo lo que había.
    const ms = Math.round(this.visibleMs);
    if (ms === this.ultimoReporte) return;
    this.ultimoReporte = ms;

    const s = Math.round(this.visibleMs / 1000);
    const total = Math.round((performance.now() - this.t0) / 1000);
    this.salidas++;
    const data: Record<string, unknown> = {
      seccion: this.seccionActual || undefined,
      s,                       // segundos VISIBLES
      total,                   // segundos desde la carga (incluye segundo plano)
      inter: this.interacciones,
      n: this.salidas,
    };
    if (this.scrollable) data.scroll = this.scrollMax;
    this.event('salida', data);

    if (!this.vitalsEnviados) {
      this.vitalsEnviados = true;
      this.event('vitals', {
        ...this.vitals,
        ...(this.calcInp() ?? {}),
        tpi: this.tpi || undefined,     // tiempo hasta la primera interacción (ms)
        toco: this.interacciones > 0,
      });
    }
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
