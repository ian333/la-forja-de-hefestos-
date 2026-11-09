/**
 * Worker del motor de campos v2 (orden 2026-11-05-campos-reales-banco-v2): traza las líneas de B fuera del hilo de
 * la interfaz. Recibe los segmentos empacados y las semillas; devuelve todo concatenado (transferible, sin copias).
 */
import { trazarLineasB, type SegmentosB, type OpcionesLineaB } from './em';

type Trabajo = { id: number; S: SegmentosB; semillas: Float64Array; o: OpcionesLineaB };
const yo = self as unknown as { onmessage: ((e: MessageEvent<Trabajo>) => void) | null; postMessage: (m: unknown, t?: Transferable[]) => void };
yo.onmessage = (e) => {
  const { id, S, semillas, o } = e.data;
  try {
    const r = trazarLineasB(S, semillas, o);
    yo.postMessage({ id, ...r }, [r.pos.buffer, r.mag.buffer, r.inicio.buffer, r.cuenta.buffer]);
  } catch (err) {
    yo.postMessage({ id, error: String(err) });
  }
};
