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
 * U10 · LAS LENTES (2026-08-30) — ian: «que el Foco sea el LUGAR del análisis y
 * no tengas que pagar extra ni esperar». Aterrizó aquí: `PanelDeLentes` al final
 * de este archivo. Una pasada del campo alimenta PARED (cian, medido),
 * ENFRIAMIENTO y LLENADO (violeta, simulado) sobre la MISMA pieza.
 *
 * Lo que sigue (declarado, no escondido): el texto con hilo a la geometría (T3),
 * la voz de Matilda (T4) y el expediente que se ve (T5) aterrizan AQUÍ. Por eso
 * el panel expone `onVerHallazgo`.
 */
import { useEffect, useRef, useState } from 'react';
import { revisarModelo, type RevisionModelo } from './revisar-modelo';
import type { MeshLike } from './flowlen-mesh';
import { tituloCorto, type Criterio, type ContratoEstado } from './mold-contratos';
import type { Lente, LenteId, LentesFoco } from './foco-lentes';

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
  /** U3 · EL FOCO: el plano encima de la pieza. Arranca apagado (regla de Detroit).
   *  U10 · LAS LENTES: el análisis vive AQUÍ, no en otra pantalla ni en otro módulo. */
  foco?: {
    on: boolean; toggle: () => void; nMedidas: number; noMedido: string[];
    lente: LenteId | 'medidas';
    setLente: (id: LenteId | 'medidas') => void;
    lentes: Lente[] | null;
    campo: LentesFoco['campo'] | null;
    ms: number | null;
    /** dispara la pasada única del campo (0.5-2.4 s medidos) */
    calcular: () => void;
    busy: boolean;
    err: string;
  };
}) {
  const [rev, setRev] = useState<RevisionModelo | null>(null);
  const [estado, setEstado] = useState<string>('');
  const [verTodo, setVerTodo] = useState(false);
  /** X2 · qué hallazgo está ABIERTO. Uno a la vez, o el panel vuelve a crecer. */
  const [abierto, setAbierto] = useState<string | null>(null);
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
  /**
   * X2 · AGRUPADO POR SUBSISTEMA. Cazado A OJO leyendo la lista ya encogida: los
   * títulos cortos derivados del id (DP, LAZO, FUERZA, POSITIVA) NO se entienden
   * solos — y `DP` aparece DOS veces, en alimentación y en agua. El subsistema es
   * la mitad del significado, y ponerlo en cada fila lo repetiría 18 veces; como
   * encabezado de grupo se dice una vez y ordena la columna.
   * Los GRUPOS se ordenan por su peor severidad, así lo que más duele sigue arriba
   * (era la virtud de la lista plana y no se pierde).
   */
  const grupos = (() => {
    const m = new Map<string, Criterio[]>();
    for (const c of mostrar) { const k = c.subsistema || '—'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(c); }
    return [...m.entries()]
      .map(([nombre, cs]) => ({ nombre, cs, peor: Math.min(...cs.map((c) => PESO[c.estado])) }))
      .sort((a, b) => a.peor - b.peor || a.nombre.localeCompare(b.nombre));
  })();
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
          {/* U10 · LAS LENTES — de Hardspace: Shipbreaker: UN objeto, VARIAS lecturas,
              pestañas sobre la misma pieza en vez de tres pantallas. El punto del
              color: cian = MEDIDO (está en la pieza) · violeta = SIMULADO (es un
              cálculo). Esa es la regla que salió del Foco de Horizon. */}
          {foco.on && <PanelDeLentes foco={foco} />}
          {foco.on && foco.lente === 'medidas' && foco.noMedido.length > 0 && (
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
        {/* X2 · UN HALLAZGO = UN RENGLÓN. Antes cada fila pintaba el `criterio`
            completo (118 caracteres de mediana) como si fuera un título, y el
            `detalle` debajo: 18 hallazgos = ~218 renglones en una caja de 340 px,
            o sea el 10 % visible. Ahora la fila es ícono + TÍTULO + §, y la regla
            del libro con sus números se abre al hacer clic. Es la anatomía de la
            ficha de Horizon: el estado chiquito, el título corto, el cuerpo dentro. */}
        {grupos.map((g) => (
          <div key={g.nombre} data-testid={`rp-grupo-${g.nombre}`} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase', opacity: 0.42,
              marginTop: 4, paddingBottom: 2, borderBottom: '1px solid rgba(159,179,200,0.09)' }}>
              {g.nombre} <span style={{ opacity: 0.7 }}>· {g.cs.length}</span>
            </div>
            {g.cs.map((c) => {
          const on = abierto === c.id;
          return (
            <div key={c.id} data-testid={`rp-h-${c.id}`}
              onClick={() => { setAbierto(on ? null : c.id); if (!on) onVerHallazgo?.(c); }}
              style={{ borderLeft: `2px solid ${COLOR[c.estado]}`, padding: '3px 8px 4px',
                background: on ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.02)',
                borderRadius: '0 6px 6px 0', cursor: 'pointer' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ color: COLOR[c.estado] }}>{ICON[c.estado]}</span>
                <span data-testid={`rp-h-titulo-${c.id}`}
                  style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: 0.5, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis' }}>{tituloCorto(c.id)}</span>
                <span style={{ marginLeft: 'auto', fontSize: 9.5, opacity: 0.45, whiteSpace: 'nowrap' }}>{c.cita}</span>
                <span style={{ opacity: 0.35, fontSize: 9 }}>{on ? '▾' : '▸'}</span>
              </div>
              {on && (
                <div data-testid={`rp-h-cuerpo-${c.id}`} style={{ paddingLeft: 18, marginTop: 3 }}>
                  <div style={{ fontSize: 10.5, lineHeight: 1.5 }}>{c.criterio}</div>
                  <div style={{ fontSize: 10.5, opacity: 0.66, lineHeight: 1.5, marginTop: 3 }}>{c.detalle}</div>
                </div>
              )}
            </div>
          );
            })}
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
          Falta aquí: el hilo de cada § a su lugar en la pieza · la voz que lo dicta · el
          expediente con su consecuencia visible. Son T3-T5 y todavía no están.
        </div>
      )}
    </div>
  );
}

/**
 * LAS LENTES DEL FOCO — el análisis, encima de tu pieza.
 * ============================================================================
 * ian: «que el Foco sea el LUGAR del análisis y no tengas que pagar extra ni
 * esperar». Por eso: pestañas sobre la MISMA pieza (Shipbreaker), una sola
 * pasada del campo para las tres, y la leyenda donde EL COLOR ES LA CLAVE.
 *
 * La ficha va en LENGUAJE NATURAL (Horizon). ian sobre el panel viejo: «no
 * tengo ni idea de qué dice ahí». Aquí no se lee `t_c=382.9s`: se lee qué
 * significa y qué hacer.
 */
function PanelDeLentes({ foco }: {
  foco: NonNullable<Parameters<typeof RevisarPiezaPanel>[0]['foco']>;
}) {
  const activa = foco.lentes?.find((l) => l.id === foco.lente) ?? null;
  const PESTANAS: Array<{ id: LenteId | 'medidas'; txt: string }> = [
    { id: 'medidas', txt: 'MEDIDAS' },
    { id: 'pared', txt: 'PARED' },
    { id: 'enfriamiento', txt: 'ENFRIAMIENTO' },
    { id: 'llenado', txt: 'LLENADO' },
  ];
  // el idioma de color: cian = lo que MEDIMOS · violeta = lo que SIMULAMOS
  const tono = (id: LenteId | 'medidas') => (id === 'medidas' || id === 'pared' ? '#5fd4f5' : '#e061c8');
  const n1 = (x: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1));

  return (
    <div data-testid="foco-lentes" style={{ marginTop: 6 }}>
      {/* REJILLA 2×2 FIJA, no flex-wrap: con `flex:1 1 auto` la cuarta pestaña
          (LLENADO) se caía sola a un segundo renglón y el bloque quedaba chueco.
          Cazado a ojo en el drive; es el mismo defecto de CSS que ya pagamos con
          el panel del lobby. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 3 }}>
        {PESTANAS.map((p) => {
          const on = foco.lente === p.id;
          const c = tono(p.id);
          return (
            <button key={p.id} data-testid={`lente-${p.id}`}
              onClick={() => { foco.setLente(p.id); if (p.id !== 'medidas') foco.calcular(); }}
              title={p.id === 'medidas' ? 'las cotas de la envolvente' : 'el campo, pintado sobre tu pieza'}
              style={{
                minWidth: 0, cursor: 'pointer', borderRadius: 5, padding: '5px 6px',
                font: `${on ? 700 : 500} 9.5px ui-monospace,Menlo,monospace`, letterSpacing: 0.3,
                background: on ? `${c}22` : 'transparent',
                border: `1px solid ${on ? c : '#2c3a50'}`,
                color: on ? c : '#7f8fa6',
              }}>{p.txt}</button>
          );
        })}
      </div>

      {foco.busy && (
        <div data-testid="lentes-calculando" style={{ fontSize: 10.5, opacity: 0.8, marginTop: 6 }}>
          ⏳ midiendo el campo de tu pieza… <span style={{ opacity: 0.6 }}>(una sola pasada para las tres lentes)</span>
        </div>
      )}
      {foco.err && (
        <div data-testid="lentes-error" style={{ fontSize: 10.5, color: '#ffb3b3', marginTop: 6 }}>✗ {foco.err}</div>
      )}

      {activa && (
        <div data-testid={`ficha-${activa.id}`} style={{ marginTop: 7 }}>
          {/* X3 · LA FICHA SE MUDÓ AL ÁREA DE TRABAJO. El titular y el cuerpo hablan de
              UN PUNTO de la pieza, así que ahora viven SOBRE ese punto (ley de ian,
              2026-09-01) — no se duplican aquí. Lo que se queda es la LEYENDA, que
              describe todo el campo y no un punto: eso sí es del borde (EL PARTE). */}
          <div data-testid="ficha-mudada" style={{ fontSize: 10, opacity: 0.5, lineHeight: 1.45, marginBottom: 5 }}>
            {activa.que}. <b style={{ opacity: 0.85 }}>Apunta la marca sobre la pieza</b> para leer qué pasa ahí.
          </div>

          {/* LA LEYENDA — el color ES la clave (Shipbreaker), con valores reales */}
          <div data-testid="lente-leyenda" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {activa.paradas.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <span style={{ width: 16, height: 10, borderRadius: 2, background: p.hex, flex: '0 0 auto', border: '1px solid rgba(255,255,255,0.18)' }} />
                <b style={{ fontVariantNumeric: 'tabular-nums', minWidth: 44 }}>{n1(p.v)} {activa.unidad}</b>
                <span style={{ opacity: 0.6 }}>{p.etiqueta}</span>
              </div>
            ))}
          </div>

          {/* LO QUE NO SE ESCONDE: la resolución del campo y lo que quedó sin dato */}
          <div style={{ fontSize: 9.5, opacity: 0.42, marginTop: 6, lineHeight: 1.5 }}>
            celda {foco.campo ? n1(foco.campo.celdaMm) : '—'} mm ·{' '}
            {foco.campo ? foco.campo.huecos.toLocaleString('es-MX') : '—'} vóxeles ·{' '}
            {foco.ms != null ? `${(foco.ms / 1000).toFixed(1)} s` : '—'}
            {activa.sinDato > 0 && ` · ${activa.sinDato} vértices sin dato (fuera de la rejilla)`}
            {foco.campo?.avisos.length ? ` · ⚠ ${foco.campo.avisos[0]}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
