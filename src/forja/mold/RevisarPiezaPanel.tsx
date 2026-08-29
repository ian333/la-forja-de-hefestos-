/**
 * REVISAR ESTA PIEZA — la revisión de UNA pieza, DENTRO del CAD.
 * ============================================================================
 * ian (2026-08-28), con el panel de lote tapándole el visor: «ME ESTORBA Y NO ME
 * SIRVE DE NADA REVISAR EN VOLUMEN. PREFERIRÍA REVISAR DE 1 EN 1 Y ME GUSTARÍA
 * SEGUIR DENTRO DE LA FORJA, NO EN OTRA PANTALLA — pues ¿para qué hicimos un
 * sistema CAD?».
 *
 * Este panel es la respuesta: vive en el costado del CAD (como MOLDE, ANÁLISIS y
 * EL CICLO), habla de LA pieza que está en el visor, y NUNCA la tapa. El modo
 * lote no murió — se degradó a botón de regresiones (decisión de ian: «B DEGRADA»),
 * porque es lo único que corre las 20 Hammond de un jalón.
 *
 * NO CABLEA FÍSICA: llama al mismo `revisarModelo` que ya usaba el lote. Si esta
 * pantalla y la del lote dieran números distintos, tendríamos dos verdades — que
 * es el bug de contabilidad que este proyecto ya pagó una vez.
 *
 * Lo que sigue (declarado, no escondido): las capas sobre el sólido (T2), el
 * texto con hilo a la geometría (T3), la voz de Matilda (T4) y el expediente que
 * se ve (T5) aterrizan AQUÍ. Por eso el panel expone `onVerHallazgo`.
 */
import { useEffect, useRef, useState } from 'react';
import { revisarModelo, type RevisionModelo } from './revisar-modelo';
import type { MeshLike } from './flowlen-mesh';
import type { Criterio, ContratoEstado } from './mold-contratos';

const GOLD = '#c9a227';
const COLOR: Record<ContratoEstado, string> = {
  'CUMPLE': '#59d98c', 'ADVIERTE': '#ffb347', 'VIOLA': '#ff5c5c',
  'SIN-CABLEAR': '#6db3f2', 'SIN-MÓDULO': '#8a93a3',
};
const ICON: Record<ContratoEstado, string> = {
  'CUMPLE': '✓', 'ADVIERTE': '⚠', 'VIOLA': '✗', 'SIN-CABLEAR': '🔌', 'SIN-MÓDULO': '∅',
};
/** el orden en que DUELE: primero lo que viola, hasta abajo lo que cumple */
const PESO: Record<ContratoEstado, number> = {
  'VIOLA': 0, 'ADVIERTE': 1, 'SIN-CABLEAR': 2, 'SIN-MÓDULO': 3, 'CUMPLE': 4,
};

export interface PiezaEnRevision {
  mesh: MeshLike;
  nombre: string;
  /** lo que declaró el cargador (multi-sólido, triángulos, volumen del kernel) */
  notas?: string[];
  plastic?: string;
  annualVolume?: number;
}

export default function RevisarPiezaPanel({ pieza, onAbrirLote, onVerHallazgo, foco }: {
  pieza: PiezaEnRevision | null;
  /** el lote DEGRADADO: sigue existiendo para regresiones, ya no es la puerta */
  onAbrirLote?: () => void;
  /** T3: llevar la cámara al hallazgo. Todavía no hay anclas — se declara el hueco. */
  onVerHallazgo?: (c: Criterio) => void;
  /** U3 · EL FOCO: el plano encima de la pieza. Arranca apagado (regla de Detroit). */
  foco?: { on: boolean; toggle: () => void; nMedidas: number; noMedido: string[] };
}) {
  const [rev, setRev] = useState<RevisionModelo | null>(null);
  const [estado, setEstado] = useState<string>('');
  const [verTodo, setVerTodo] = useState(false);
  const corriendo = useRef(false);
  const clave = pieza ? `${pieza.nombre}·${pieza.mesh.indices.length}` : '';

  useEffect(() => {
    if (!pieza || corriendo.current) return;
    let vivo = true;
    corriendo.current = true;
    setRev(null); setEstado('midiendo la pieza…');
    // deja pintar el ⏳ antes de bloquear con el raster (revisarModelo es SÍNCRONO
    // y pesado: 1-3 s en una pieza compleja)
    const t = setTimeout(() => {
      try {
        const r = revisarModelo({
          mesh: pieza.mesh, nombre: pieza.nombre,
          plastic: pieza.plastic, annualVolume: pieza.annualVolume ?? 200_000,
          flowMaxVoxels: 40_000,
        });
        if (!vivo) return;
        setRev(r); setEstado('');
      } catch (e) {
        if (!vivo) return;
        setEstado(`no se pudo revisar: ${String(e instanceof Error ? e.message : e).slice(0, 120)}`);
      } finally { corriendo.current = false; }
    }, 40);
    return () => { vivo = false; clearTimeout(t); corriendo.current = false; clearTimeout(t); };
  }, [clave]);

  if (!pieza) {
    return (
      <div style={{ fontSize: 11, opacity: 0.6, padding: '8px 2px' }} data-testid="rp-vacio">
        Abre una pieza (<b>＋ Abrir archivo</b> en el lobby) o construye una, y aquí sale su
        dictamen: los contratos de Kazmer sobre <b>esta</b> pieza.
        {onAbrirLote && (
          <button data-testid="rp-abrir-lote" onClick={onAbrirLote}
            style={{ display: 'block', marginTop: 8, background: 'transparent', border: '1px solid #2c3a50', color: '#8a93a3', borderRadius: 7, padding: '5px 9px', fontSize: 10.5, cursor: 'pointer' }}
            title="Modo lote: corre el banco entero de una. Sirve para REGRESIONES, no para revisar tu pieza.">
            ⋯ modo lote (regresiones)
          </button>
        )}
      </div>
    );
  }

  const criterios: Criterio[] = rev ? rev.contratos.subsistemas.flatMap((s) => s.criterios) : [];
  const ordenados = [...criterios].sort((a, b) => PESO[a.estado] - PESO[b.estado] || a.cita.localeCompare(b.cita));
  const duelen = ordenados.filter((c) => c.estado === 'VIOLA' || c.estado === 'ADVIERTE');
  const mostrar = verTodo ? ordenados : duelen.slice(0, 12);
  const t = rev?.contratos.total;

  return (
    <div data-testid="revisar-pieza" style={{ fontSize: 11.5 }}>
      {/* CABEZA: la pieza y su score, sin tapar nada */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <b data-testid="rp-nombre" style={{ fontSize: 12.5 }}>{pieza.nombre}</b>
        {rev && (
          <span data-testid="rp-score" style={{ color: GOLD, fontWeight: 700 }}>{rev.fila.score}<span style={{ opacity: 0.5, fontWeight: 400 }}>/100</span></span>
        )}
        {rev && <span style={{ opacity: 0.6, fontSize: 10.5 }}>{rev.pkg.recomendacion.arch} × {rev.pkg.recomendacion.nCav} cav</span>}
      </div>

      {/* EL FOCO — el interruptor vive junto a la pieza, que es donde estás mirando.
          Encendido, la pieza se enfría a holograma y sus medidas flotan encima. */}
      {foco && (
        <div style={{ marginBottom: 8 }}>
          <button data-testid="btn-foco" onClick={foco.toggle}
            title="EL FOCO — las medidas de la pieza, encima de la pieza (como tener el plano puesto)"
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: 7, padding: '7px 10px',
              font: '700 11.5px ui-monospace,Menlo,monospace', letterSpacing: 0.4,
              background: foco.on ? 'rgba(95,212,245,0.16)' : 'transparent',
              border: `1px solid ${foco.on ? '#5fd4f5' : '#2c3a50'}`,
              color: foco.on ? '#bfeeff' : '#8fa3ba',
            }}>
            {foco.on ? '◉' : '○'} EL FOCO <span style={{ opacity: 0.65, fontWeight: 400 }}>· las medidas encima {foco.on ? `(${foco.nMedidas})` : ''}</span>
            <span style={{ float: 'right', opacity: 0.5, fontWeight: 400, fontSize: 10 }}>Q</span>
          </button>
          {foco.on && foco.noMedido.length > 0 && (
            <div data-testid="foco-no-medido" style={{ fontSize: 10, opacity: 0.55, marginTop: 4, lineHeight: 1.45 }}>
              El Foco no puede medir: {foco.noMedido.join(' · ')}
            </div>
          )}
        </div>
      )}

      {estado && <div data-testid="rp-estado" style={{ opacity: 0.7, padding: '6px 0' }}>⏳ {estado}</div>}

      {/* lo que el CARGADOR declaró (multi-sólido, triángulos): arriba, no al fondo */}
      {(pieza.notas ?? []).filter((n) => n.startsWith('⚠')).map((n, i) => (
        <div key={i} data-testid="rp-aviso" style={{ fontSize: 10.5, color: '#ffcf8a', background: 'rgba(255,179,71,0.12)', border: '1px solid #ffb34755', borderRadius: 6, padding: '5px 8px', marginBottom: 6 }}>{n}</div>
      ))}

      {t && (
        <div style={{ display: 'flex', gap: 10, fontSize: 10.5, opacity: 0.85, marginBottom: 6 }}>
          <span style={{ color: COLOR.VIOLA }}>✗ {t.viola}</span>
          <span style={{ color: COLOR.ADVIERTE }}>⚠ {t.advierte}</span>
          <span style={{ color: COLOR.CUMPLE }}>✓ {t.cumple}</span>
          <span style={{ color: COLOR['SIN-CABLEAR'] }}>🔌 {t.sinCablear}</span>
        </div>
      )}

      {/* LOS HALLAZGOS, del que más duele al que menos */}
      <div data-testid="rp-hallazgos" style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 340, overflow: 'auto' }}>
        {mostrar.map((c) => (
          <div key={c.id} data-testid={`rp-h-${c.id}`} onClick={() => onVerHallazgo?.(c)}
            style={{ borderLeft: `2px solid ${COLOR[c.estado]}`, padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '0 6px 6px 0', cursor: onVerHallazgo ? 'pointer' : 'default' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{ color: COLOR[c.estado] }}>{ICON[c.estado]}</span>
              <span style={{ fontWeight: 600 }}>{c.criterio}</span>
              <span style={{ marginLeft: 'auto', fontSize: 9.5, opacity: 0.5, whiteSpace: 'nowrap' }}>{c.cita}</span>
            </div>
            <div style={{ fontSize: 10.5, opacity: 0.72, paddingLeft: 18 }}>{c.detalle}</div>
          </div>
        ))}
        {rev && !mostrar.length && (
          <div style={{ opacity: 0.7, color: COLOR.CUMPLE }}>✓ ni una violación ni una advertencia en {t?.criterios} criterios.</div>
        )}
      </div>

      {rev && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button data-testid="rp-ver-todo" onClick={() => setVerTodo((v) => !v)}
            style={{ background: 'transparent', border: '1px solid #2c3a50', color: '#dfe7f2', borderRadius: 7, padding: '5px 9px', fontSize: 10.5, cursor: 'pointer' }}>
            {verTodo ? '▴ solo lo que duele' : `▾ los ${ordenados.length} criterios`}
          </button>
          {onAbrirLote && (
            <button data-testid="rp-abrir-lote" onClick={onAbrirLote}
              style={{ background: 'transparent', border: '1px solid #2c3a50', color: '#8a93a3', borderRadius: 7, padding: '5px 9px', fontSize: 10.5, cursor: 'pointer' }}
              title="Modo lote: corre el banco entero de una. Sirve para REGRESIONES, no para revisar tu pieza.">
              ⋯ modo lote (regresiones)
            </button>
          )}
        </div>
      )}

      {/* LO QUE FALTA, DICHO: sin esto el panel parecería completo y no lo está */}
      {rev && (
        <div style={{ fontSize: 10, opacity: 0.45, marginTop: 8, lineHeight: 1.5 }}>
          Falta aquí: las capas sobre el sólido (espesor, expulsores) · el hilo de cada § a su
          lugar en la pieza · la voz que lo dicta · el expediente con su consecuencia visible.
          Son T2-T5 y todavía no están.
        </div>
      )}
    </div>
  );
}
