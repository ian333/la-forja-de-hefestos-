/**
 * Telemetría de La Forja — mide MILISEGUNDOS de cada proceso (build de shape,
 * FEA, generativo, plano, export…) y los manda a `telemetry.event` → batch →
 * POST /api/telemetry/events → tabla de logs de university (frontend_event_log).
 * Así sabemos cuánto tarda CADA cosa, en producción, por usuario/sesión.
 */
import { telemetry } from '../lib/telemetry';

const ms = (t0: number) => +(performance.now() - t0).toFixed(1);

/** El nombre de la pieza o del archivo NO viaja en ningún evento (orden 2026-10-29-g · juez B D7: el STEP de una planta es
 *  secreto de su cliente). Los archivos que se sueltan o suben se registran solos (lib/telemetry.ts, en el `drop`/`change`);
 *  esto agrega el nombre con el que la app llama a la pieza (el del árbol, el del STEP). Ningún `mark` de La Forja manda
 *  `name`/`pieza`: dicen QUÉ pasó y cuánto tardó, nunca DE QUÉ pieza. */
export function ocultarEnTelemetria(nombre: string | null | undefined): void {
  telemetry.ocultar(nombre);
}

/** Cronometra `fn` y loguea `forja.<name>` con {ms, ...meta}. Re-lanza si falla
 *  (logueando ok:false + el error). Para procesos SÍNCRONOS. */
export function timed<T>(name: string, fn: () => T, meta: Record<string, unknown> = {}): T {
  const t0 = performance.now();
  try {
    const r = fn();
    telemetry.event(`forja.${name}`, { ms: ms(t0), ok: true, ...meta });
    return r;
  } catch (e) {
    telemetry.event(`forja.${name}`, { ms: ms(t0), ok: false, err: String((e as Error)?.message ?? e), ...meta });
    throw e;
  }
}

/** Como `timed` pero las métricas se calculan DEL RESULTADO (nº de celdas, etc.). */
export function timedWith<T>(name: string, fn: () => T, metaOf: (r: T) => Record<string, unknown>): T {
  const t0 = performance.now();
  const r = fn();
  telemetry.event(`forja.${name}`, { ms: ms(t0), ok: true, ...metaOf(r) });
  return r;
}

/** Marca un instante con métricas ya conocidas (cuando ya mediste el ms tú). */
export function mark(name: string, durationMs: number, meta: Record<string, unknown> = {}): void {
  telemetry.event(`forja.${name}`, { ms: +durationMs.toFixed(1), ...meta });
}
