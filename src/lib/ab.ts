/**
 * ab — pruebas A/B deterministas, resueltas ANTES del primer render.
 *
 * POR QUÉ ASÍ:
 *
 * 1. DETERMINISTA POR `sid`, NO ALEATORIO POR RENDER. Si la variante se
 *    sorteara en cada render, React (que en StrictMode monta dos veces) haría
 *    parpadear el hero y el visitante vería A y luego B. El dato quedaría
 *    inservible: no se sabría qué vio realmente. Aquí la variante es una
 *    FUNCIÓN PURA del id de sesión, así que la misma sesión ve lo mismo en
 *    cada render, en cada recarga y en cada página del sitio.
 *
 * 2. SÍNCRONO Y SIN ESTADO. `variante()` se llama en el cuerpo del componente,
 *    no en un `useEffect`. No hay primer frame con la variante equivocada ni
 *    salto de layout (que además ensuciaría el CLS que ya medimos).
 *
 * 3. COSTO DESPRECIABLE. Un FNV-1a de ~24 caracteres. Sin librería, sin red,
 *    sin cookies, sin identificadores nuevos: reusa el `sid` que la telemetría
 *    ya guarda en sessionStorage. CERO PII nueva.
 *
 * 4. SI LA TELEMETRÍA FALLA, LA PÁGINA SIGUE VIVA. Todo va en try/catch y el
 *    fallback siempre es 'a' (la variante que ya estaba en producción).
 *
 * USO:
 *
 *     import { variante } from '../lib/ab';
 *     const v = variante('lab-vs-clase');      // 'a' | 'b'
 *     return v === 'b' ? <HeroClase /> : <HeroLab />;
 *
 * AGREGAR LA SIGUIENTE PRUEBA = UN RENGLÓN en PRUEBAS (abajo).
 *
 * FORZAR PARA VERIFICAR / CAPTURAR:
 *
 *     ?ab=lab-vs-clase:b            una prueba
 *     ?ab=lab-vs-clase:b,otra:a     varias
 *
 *   La fuerza queda guardada en la sesión (para que la navegación al destino
 *   siga siendo coherente) y el evento sale marcado con `forzado: true`, para
 *   que `scripts/visitas.cjs` EXCLUYA esas sesiones del análisis. Una sonda de
 *   Playwright no debe contaminar el resultado.
 */

import { telemetry, getSid } from './telemetry';

export type Variante = 'a' | 'b';

export interface Prueba {
  /** % de sesiones que ven la variante 'a'. 50 = mitad y mitad. */
  a: number;
  /** qué se está probando y qué es cada rama (para quien lea esto en 3 meses). */
  nota: string;
}

/**
 * EL REGISTRO DE PRUEBAS. Una prueba viva = un renglón.
 * Retirar una prueba: borrar el renglón → todos vuelven a ver 'a'.
 */
export const PRUEBAS = {
  'lab-vs-clase': {
    a: 50,
    nota: 'Primer pantallazo móvil del atrio. '
      + 'a = LABORATORIO ("Toca un elemento y mira sus electrones" → /lab.html). '
      + 'b = CLASE del agujero negro ("Una hora aquí, siete años en casa" → /masterclass.html?id=blackhole). '
      + 'Hipótesis: el 65 % que rebota antes de 3 s llega de reels de química, '
      + 'y una victoria de 5 min retiene mejor que una clase de una hora.',
  },
} satisfies Record<string, Prueba>;

export type PruebaId = keyof typeof PRUEBAS;

// ─── Hash ────────────────────────────────────────────────────────────
// FNV-1a de 32 bits: 5 líneas, sin dependencias, buena dispersión para
// cadenas cortas. `Math.imul` mantiene la multiplicación en 32 bits enteros
// (con `*` normal se perdería precisión al pasar de 2^53 y el reparto se
// sesgaría). El nombre de la prueba entra en el hash A PROPÓSITO: si sólo se
// hasheara el sid, quien cayera en 'a' de una prueba caería en 'a' de TODAS y
// las pruebas simultáneas quedarían correlacionadas.
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ─── Fuerza por query string ─────────────────────────────────────────
const FORCE_KEY = '__forja_ab_force';
let forzadasCache: Record<string, Variante> | null = null;

function forzadas(): Record<string, Variante> {
  if (forzadasCache) return forzadasCache;
  const out: Record<string, Variante> = {};
  try {
    const prev = sessionStorage.getItem(FORCE_KEY);
    if (prev) Object.assign(out, JSON.parse(prev) as Record<string, Variante>);
  } catch { /* sin sessionStorage o JSON corrupto: se ignora */ }
  try {
    const q = new URLSearchParams(location.search).get('ab');
    if (q) {
      for (const par of q.split(',')) {
        const [p, v] = par.split(':');
        if (p && (v === 'a' || v === 'b')) out[p.trim()] = v;
      }
      // Se guarda para que la sesión entera (incluido el destino: /lab.html o
      // /masterclass.html) quede del mismo lado sin arrastrar el parámetro.
      try { sessionStorage.setItem(FORCE_KEY, JSON.stringify(out)); } catch { /* no-op */ }
    }
  } catch { /* URL rara: se ignora */ }
  forzadasCache = out;
  return out;
}

// ─── Resolución ──────────────────────────────────────────────────────
const resueltas = new Map<string, Variante>();
const anunciadas = new Set<string>();

/**
 * La variante de esta sesión para `prueba`. Pura, síncrona y estable.
 * Ante cualquier problema devuelve 'a' — la que ya estaba en producción.
 */
export function variante(prueba: PruebaId): Variante {
  const hit = resueltas.get(prueba);
  if (hit) return hit;
  try {
    const cfg = (PRUEBAS as Record<string, Prueba>)[prueba];
    if (!cfg) return 'a';                       // prueba retirada del registro
    const forz = forzadas()[prueba];
    const v: Variante = forz || (hash32(prueba + ':' + getSid()) % 100 < cfg.a ? 'a' : 'b');
    resueltas.set(prueba, v);
    anunciar(prueba, v, !!forz);
    return v;
  } catch {
    return 'a';
  }
}

/**
 * Emite la asignación UNA vez por sesión. Sin este evento la prueba no se
 * puede analizar: el reporte no sabría a qué rama pertenece cada sesión.
 *
 * El tipo es `ab` SIN punto a propósito: la telemetría cuenta los eventos con
 * punto (`lab.*`, `masterclass.*`) como interacciones deliberadas del usuario,
 * y la asignación no lo es — contarla inflaría el "¿hizo algo?" del embudo al
 * 100 % en las dos ramas y borraría justo la señal que buscamos.
 */
function anunciar(prueba: string, v: Variante, forzado: boolean) {
  if (anunciadas.has(prueba)) return;           // StrictMode monta dos veces
  anunciadas.add(prueba);
  const key = '__forja_ab:' + prueba;
  try {
    // Mismo patrón que el evento `origen`: una vez por SESIÓN, no por página.
    if (sessionStorage.getItem(key) === getSid()) return;
    sessionStorage.setItem(key, getSid());
  } catch { /* sin sessionStorage: mejor duplicar que perder (el reporte agrupa por sid) */ }
  try {
    telemetry.event('ab', forzado ? { prueba, variante: v, forzado: true } : { prueba, variante: v });
  } catch { /* la página sigue viva pase lo que pase */ }
}

// Sonda para las verificaciones automáticas (Playwright). No es API pública.
if (typeof window !== 'undefined') {
  (window as { __ab?: unknown }).__ab = { variante, hash32, PRUEBAS };
}
