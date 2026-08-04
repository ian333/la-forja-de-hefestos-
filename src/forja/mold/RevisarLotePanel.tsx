/**
 * PANEL REVISAR LOTE — el modo "REVISAR EN VOLUMEN" del pliego (N-29).
 * ===========================================================================
 * PIEL sobre `revisarLote()` — la pantalla NO cablea física: la llamada única
 * ya compuso dfm → moldMachine → ensamble → venteos → contratos → expediente.
 * Re-cablear aquí sería reencarnar EL bug de contabilidad (el dato que no llega
 * al juez). Todo lo que se pinta viene de UNA verdad.
 *
 * Dos modos del cliente en una pantalla:
 *  · REVISAR: tabla de N modelos ordenada por severidad (críticos → violaciones
 *    → score), semáforos por conteo, drill-down por modelo.
 *  · APRENDER: el drill-down muestra CADA criterio con su § y su detalle vivo
 *    (los números intermedios — la fórmula no es caja negra).
 * Más el EXPEDIENTE §13.10: decisiones con firma (responsable + fecha) y el
 * plan de tryout. El expediente NO cierra con pendientes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { revisarModelo, laminasDeRevision, type RevisionModelo, type RevisionInput, type FilaRevision } from './revisar-modelo';
import { registrarDecision, type Expediente } from './expediente';
import { parseSTL } from './stl';
import type { MeshLike } from './flowlen-mesh';
import type { MachineSpec } from './moldmachine';
import type { ContratoEstado } from './mold-contratos';

const GOLD = '#c9a227';
const ESTADO_COLOR: Record<ContratoEstado, string> = {
  'CUMPLE': '#59d98c', 'ADVIERTE': '#ffb347', 'VIOLA': '#ff5c5c',
  'SIN-CABLEAR': '#6db3f2', 'SIN-MÓDULO': '#8a93a3',
};
const ESTADO_ICON: Record<ContratoEstado, string> = {
  'CUMPLE': '✓', 'ADVIERTE': '⚠', 'VIOLA': '✗', 'SIN-CABLEAR': '🔌', 'SIN-MÓDULO': '∅',
};

// EL LOTE DE ARRANQUE: specs numéricos de referencia + los STL REALES del banco
// (test-parts/). El STL corre el camino completo: raster → agarre → campo de
// flujo → venteos → contratos. El cliente agrega/quita con los toggles.
interface Entrada {
  label: string; nombre: string;
  spec?: MachineSpec;
  /** ruta del STL bajo la raíz del repo (se sirve vía /@fs en dev) */
  stl?: string;
  plastic?: string; annualVolume?: number; totalVolume?: number;
}
const S = (label: string, spec: MachineSpec): Entrada => ({ label, nombre: spec.name, spec });
const LOTE: Entrada[] = [
  S('vaso', { name: 'vaso Kazmer', Lmm: 100, Wmm: 100, Hmm: 60, cavityShape: 'round', surfaceMm2: 30000, volumeMm3: 60000, wallMm: 3, plastic: 'ABS', annualVolume: 200_000, totalVolume: 1_000_000 }),
  S('bezel', { name: 'bezel', Lmm: 168, Wmm: 120, Hmm: 13, surfaceMm2: 22000, volumeMm3: 40000, wallMm: 1.5, plastic: 'ABS', annualVolume: 500_000, totalVolume: 2_000_000 }),
  S('LEGO', { name: 'Ladrillo LEGO 2×4', Lmm: 32, Wmm: 16, Hmm: 11, surfaceMm2: 3300, volumeMm3: 2500, wallMm: 1.5, annualVolume: 20_000_000, plastic: 'ABS', finish: 'SPI A-3', feedPref: 'hot-runner' }),
  S('Sony', { name: 'Carcasa de control Sony', Lmm: 150, Wmm: 45, Hmm: 22, surfaceMm2: 43000, volumeMm3: 43000, wallMm: 2, annualVolume: 2_000_000, plastic: 'ABS', finish: 'SPI B-3', feedPref: 'hot-runner' }),
  S('charola', { name: 'Charola contenedora', Lmm: 90, Wmm: 90, Hmm: 35, surfaceMm2: 49000, volumeMm3: 49000, wallMm: 2, annualVolume: 200_000, plastic: 'PP', finish: 'SPI B-3' }),
  S('tapa', { name: 'Tapa rosca', Lmm: 40, Wmm: 40, Hmm: 15, surfaceMm2: 6500, volumeMm3: 2800, wallMm: 1.2, annualVolume: 8_000_000, plastic: 'PP', finish: 'SPI A-3' }),
  // ── los STL del banco (piezas REALES) ──
  { label: 'RPi4', nombre: 'carcasa RPi4', stl: 'test-parts/rpi4-bottom.stl', annualVolume: 500_000, totalVolume: 2_000_000 },
  { label: 'phone', nombre: 'phone holder', stl: 'test-parts/phone-holder.stl', annualVolume: 200_000 },
  { label: 'tapaMed', nombre: 'tapa médica', stl: 'test-parts/screw-cap-medical.stl', annualVolume: 2_000_000, plastic: 'PP' },
  { label: 'cajaTTC', nombre: 'caja TTC', stl: 'test-parts/ttc-box-a.stl', annualVolume: 300_000 },
  { label: 'embudo', nombre: 'embudo 130', stl: 'test-parts/funnel-130.stl', annualVolume: 200_000, plastic: 'PP' },
  { label: 'benchy', nombre: 'benchy', stl: 'test-parts/3dbenchy.stl', annualVolume: 100_000 },
];
const ordenar = (filas: FilaRevision[]) => [...filas]
  .sort((a, b) => b.criticos - a.criticos || b.viola - a.viola || a.score - b.score);

const box: React.CSSProperties = { background: 'rgba(14,20,30,0.8)', border: '1px solid #223046', borderRadius: 10, padding: '12px 15px' };

export default function RevisarLotePanel({ onClose }: { onClose: () => void }) {
  const [activos, setActivos] = useState<Record<string, boolean>>(Object.fromEntries(LOTE.map((p) => [p.label, true])));
  const [sel, setSel] = useState<string | null>(null);
  // firmas del expediente por modelo (la revisión es pura; la firma vive en la sesión)
  const [firmas, setFirmas] = useState<Record<string, Expediente>>({});
  // ── MOTOR INCREMENTAL: una revisión a la vez (los STL tardan ~1-3 s cada uno);
  //    la tabla pinta lo que ya está y marca ⏳ lo que falta. Resultados cacheados
  //    por label (la revisión es PURA: mismo modelo ⇒ mismo expediente). ──
  const [revs, setRevs] = useState<Record<string, RevisionModelo>>({});
  const [estado, setEstado] = useState<Record<string, string>>({});   // 'cargando STL' | 'calculando' | 'error: …'
  const meshCache = useRef<Record<string, MeshLike>>({});
  const corriendo = useRef(false);
  // refs FRESCOS para el loop async: un cleanup-con-deps-de-estado mataba al
  // corredor en el primer setEstado (calculaba, no guardaba, y el guard
  // bloqueaba el reintento → deadlock en "calculando"). El loop lee refs, no
  // closures; los errores viven en ref para no re-disparar el efecto.
  const activosRef = useRef(activos); activosRef.current = activos;
  const revsRef = useRef(revs);
  const errores = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (corriendo.current) return;
    corriendo.current = true;
    (async () => {
      try {
        let hubo = true;
        while (hubo) {                                    // barre hasta que no quede nada activable
          hubo = false;
          for (const e of LOTE) {
            if (!activosRef.current[e.label] || revsRef.current[e.label] || errores.current[e.label]) continue;
            hubo = true;
            try {
              let mesh: MeshLike | undefined;
              if (e.stl) {
                if (!meshCache.current[e.label]) {
                  setEstado((s) => ({ ...s, [e.label]: 'cargando STL' }));
                  // dev sirve la raíz del repo (y /@fs como respaldo; mismo path en laptop e iangpu)
                  let r = await fetch('/' + e.stl);
                  if (!r.ok) r = await fetch('/@fs/home/ian/Orkesta/la-forja/' + e.stl);
                  if (!r.ok) throw new Error(`STL no servido (${r.status})`);
                  meshCache.current[e.label] = parseSTL(await r.arrayBuffer());
                }
                mesh = meshCache.current[e.label];
              }
              setEstado((s) => ({ ...s, [e.label]: 'calculando' }));
              await new Promise((res) => setTimeout(res, 30));      // deja pintar el ⏳
              const input: RevisionInput = e.spec
                ? { spec: e.spec }
                : { mesh, nombre: e.nombre, plastic: e.plastic, annualVolume: e.annualVolume, totalVolume: e.totalVolume, flowMaxVoxels: 80_000 };
              const r = revisarModelo(input);
              revsRef.current = { ...revsRef.current, [e.label]: r };
              setRevs(revsRef.current);
              setEstado((s) => { const { [e.label]: _x, ...resto } = s; return resto; });
            } catch (err) {
              console.error('revisar', e.label, err);
              errores.current[e.label] = true;
              setEstado((s) => ({ ...s, [e.label]: `error: ${String(err).slice(0, 60)}` }));
            }
          }
        }
      } finally { corriendo.current = false; }
    })();
  }, [activos]);

  const revisiones = LOTE.filter((e) => activos[e.label] && revs[e.label]).map((e) => revs[e.label]);
  const filas = ordenar(revisiones.map((r) => r.fila));
  const pendCalc = LOTE.filter((e) => activos[e.label] && !revs[e.label]);
  const rev = revisiones.find((r) => r.nombre === sel) ?? revisiones[0];
  const exp = rev ? (firmas[rev.nombre] ?? rev.expediente) : null;

  const firmar = (id: string, eleccion: string, responsable: string) => {
    if (!rev || !exp) return;
    const fecha = new Date().toISOString().slice(0, 10);
    try { setFirmas((f) => ({ ...f, [rev.nombre]: registrarDecision(exp, id, eleccion, responsable, fecha) })); }
    catch (e) { console.error('firmar', e); }
  };

  return (
    <div data-testid="revisar-lote-view" style={{ position: 'fixed', inset: 0, zIndex: 92, background: 'rgba(5,7,11,0.97)', fontFamily: "'JetBrains Mono', monospace", color: '#e9eef5', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* barra superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid #1c2634' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>📋 REVISAR EN VOLUMEN <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 12 }}>— los contratos de Kazmer sobre un lote (N-29)</span></div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>tabla por severidad → drill-down: cada criterio con su § y sus números vivos · expediente §13.10 con firmas</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {LOTE.map((p) => (
            <label key={p.label} data-testid={`rl-toggle-${p.label}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, cursor: 'pointer', opacity: activos[p.label] ? 1 : 0.45 }}>
              <input type="checkbox" checked={!!activos[p.label]} onChange={(e) => setActivos((a) => ({ ...a, [p.label]: e.target.checked }))} />{p.label}
            </label>
          ))}
          <button data-testid="rl-close" onClick={onClose} style={{ background: 'rgba(20,28,40,0.9)', border: '1px solid #2c3a50', color: '#dfe7f2', cursor: 'pointer', borderRadius: 7, padding: '7px 14px', fontSize: 12 }}>✕ Cerrar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '460px 1fr', gap: 0, flex: 1, minHeight: 0 }}>
        {/* ── LA TABLA (ya viene ordenada por severidad de revisarLote) ── */}
        <div style={{ borderRight: '1px solid #1c2634', overflow: 'auto', padding: '12px 14px' }}>
          <div style={{ fontSize: 10, opacity: 0.55, display: 'grid', gridTemplateColumns: '1fr 44px 90px 34px', gap: 6, padding: '4px 8px', letterSpacing: 0.5 }}>
            <span>MODELO</span><span>SCORE</span><span>✗ 🔌 ∅ CRIT</span><span>❄</span>
          </div>
          {filas.map((f) => {
            const r = revisiones.find((x) => x.nombre === f.nombre)!;
            const e = firmas[f.nombre] ?? r.expediente;
            const on = rev?.nombre === f.nombre;
            const scoreColor = f.criticos > 0 || f.viola > 2 ? '#ff5c5c' : f.viola > 0 ? '#ffb347' : '#59d98c';
            return (
              <div key={f.nombre} data-testid={`rl-row-${f.nombre}`} data-crit={f.criticos} data-viola={f.viola} data-score={f.score} onClick={() => setSel(f.nombre)}
                style={{ display: 'grid', gridTemplateColumns: '1fr 44px 90px 34px', gap: 6, alignItems: 'center', padding: '9px 8px', borderRadius: 8, cursor: 'pointer', background: on ? 'rgba(201,162,39,0.12)' : 'transparent', border: on ? `1px solid ${GOLD}55` : '1px solid transparent', marginBottom: 2 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{f.nombre}</div>
                  <div style={{ fontSize: 9.5, opacity: 0.55 }}>{r.pkg.recomendacion.arch} × {r.pkg.recomendacion.nCav} cav · {e.pendientes} firma(s) pendiente(s)</div>
                </div>
                <div data-testid={`rl-score-${f.nombre}`} style={{ fontSize: 17, fontWeight: 800, color: scoreColor }}>{f.score}</div>
                <div style={{ fontSize: 11, display: 'flex', gap: 7 }}>
                  <span style={{ color: ESTADO_COLOR['VIOLA'] }}>{f.viola}</span>
                  <span style={{ color: ESTADO_COLOR['SIN-CABLEAR'] }}>{f.sinCablear}</span>
                  <span style={{ color: ESTADO_COLOR['SIN-MÓDULO'] }}>{f.sinModulo}</span>
                  <span style={{ color: f.criticos ? '#ff5c5c' : '#59d98c', fontWeight: 700 }}>{f.criticos}</span>
                </div>
                <div style={{ fontSize: 10.5, opacity: 0.8 }}>{f.congelables}/10</div>
              </div>
            );
          })}
          {pendCalc.map((e) => (
            <div key={e.label} data-testid={`rl-pend-${e.label}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '9px 8px', opacity: 0.55, fontSize: 11.5 }}>
              <span>⏳</span>
              <div>
                <div style={{ fontWeight: 700 }}>{e.nombre}</div>
                <div style={{ fontSize: 9.5, color: estado[e.label]?.startsWith('error') ? '#ff5c5c' : undefined }}>
                  {estado[e.label] ?? 'en cola'}{e.stl ? ' · STL real del banco' : ''}
                </div>
              </div>
            </div>
          ))}
          {!filas.length && !pendCalc.length && <div style={{ fontSize: 12, opacity: 0.5, padding: 20 }}>lote vacío — activa modelos arriba</div>}
          <div style={{ fontSize: 9.5, opacity: 0.45, padding: '10px 8px', lineHeight: 1.5 }}>
            orden: CRÍTICOS del ensamble → violaciones → score. ✗ viola · 🔌 sin-cablear (módulo existe, falta el dato) · ∅ sin-módulo · ❄ subsistemas congelables de 10.
          </div>
        </div>

        {/* ── EL DRILL-DOWN (modo APRENDER: § + números vivos) ── */}
        {rev && exp ? (
          <div data-testid="rl-detail" style={{ overflow: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{rev.nombre}</div>
              <div style={{ fontSize: 11, opacity: 0.65 }}>{rev.pkg.recomendacion.arch} × {rev.pkg.recomendacion.nCav} cav · acero {rev.pkg.metal.metal.key} · score <b style={{ color: GOLD }}>{rev.fila.score}</b>/100</div>
            </div>

            {/* críticos del ensamble */}
            {rev.criticos.length > 0 && (
              <div style={{ ...box, border: '1px solid #7a1e1e', background: 'rgba(40,10,10,0.6)' }}>
                <div style={{ fontSize: 11, color: '#ff5c5c', marginBottom: 5 }}>🔴 CRÍTICOS DEL ENSAMBLE (coordenadas reales)</div>
                {rev.criticos.map((c, i) => <div key={i} style={{ fontSize: 11, padding: '2px 0', opacity: 0.9 }}>[{c.check}] {c.detail}</div>)}
              </div>
            )}

            {/* EL OJO: las figuras del libro con los datos de ESTE modelo (§ propia
                cada una). Es el modo APRENDER: no un número, la vista que Kazmer
                juzga. Se generan bajo demanda — solo del modelo abierto. */}
            <LaminasDelModelo rev={rev} mesh={meshCache.current[LOTE.find((e) => e.nombre === rev.nombre)?.label ?? '']} />

            {/* contratos por subsistema — cada criterio con su § y su detalle vivo */}
            <div style={{ ...box }}>
              <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8 }}>CONTRATOS DE SUBSISTEMA — los criterios de aceptación del cliente</div>
              {rev.contratos.subsistemas.map((s) => (
                <details key={s.subsistema} data-testid={`rl-sub-${s.subsistema}`} open={!s.congelable} style={{ marginBottom: 6 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 700, padding: '4px 0', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: s.congelable ? '#59d98c' : '#ffb347' }}>{s.congelable ? '❄' : '▸'}</span>
                    {s.subsistema.toUpperCase()}
                    <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>
                      {s.cumple}✓ {s.advierte}⚠ {s.viola}✗ {s.sinCablear}🔌 {s.sinModulo}∅ · {s.congelable ? 'CONGELABLE' : 'no congelable'}
                    </span>
                  </summary>
                  <div style={{ paddingLeft: 20 }}>
                    {s.criterios.map((c) => (
                      <div key={c.id} style={{ padding: '5px 0', borderBottom: '1px solid #16202e' }}>
                        <div style={{ fontSize: 11.5, display: 'flex', gap: 7, alignItems: 'baseline' }}>
                          <span style={{ color: ESTADO_COLOR[c.estado], fontWeight: 800, minWidth: 14 }}>{ESTADO_ICON[c.estado]}</span>
                          <span style={{ color: GOLD, fontSize: 10.5, minWidth: 92 }}>[{c.cita}]</span>
                          <span style={{ opacity: 0.92 }}>{c.criterio}</span>
                        </div>
                        {/* EL MODO APRENDER: el detalle son los números vivos de la fórmula */}
                        <div style={{ fontSize: 10.5, opacity: 0.62, paddingLeft: 21, marginTop: 2, lineHeight: 1.45 }}>{c.detalle}</div>
                        {c.deuda && <div style={{ fontSize: 10, color: ESTADO_COLOR['SIN-CABLEAR'], paddingLeft: 21, marginTop: 1 }}>↳ deuda: {c.deuda}</div>}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>

            {/* expediente §13.10: decisiones con firma */}
            <div style={{ ...box, border: `1px solid ${exp.cerrable ? '#2c5a3f' : '#4a3a1e'}` }}>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>EXPEDIENTE §13.10 — decisiones del humano ({exp.pendientes} pendiente(s))</span>
                <span data-testid="rl-cerrable" style={{ color: exp.cerrable ? '#59d98c' : '#ffb347', fontWeight: 700 }}>{exp.cerrable ? 'CERRABLE ✓' : 'NO CIERRA sin firmas'}</span>
              </div>
              {exp.decisiones.map((d) => <DecisionRow key={d.id} d={d} onFirmar={firmar} />)}
              <div style={{ marginTop: 10, borderTop: '1px solid #223046', paddingTop: 8 }}>
                <div style={{ fontSize: 10.5, opacity: 0.6, marginBottom: 4 }}>PLAN DE TRYOUT — lo deliberadamente chico y hacia dónde crece</div>
                {exp.tryout.map((t, i) => <div key={i} style={{ fontSize: 10.5, opacity: 0.85, padding: '2px 0' }}>· {t}</div>)}
              </div>
            </div>

            {/* notas de la revisión (supuestos declarados) */}
            {rev.notas.length > 0 && (
              <div style={{ ...box }}>
                <div style={{ fontSize: 10.5, opacity: 0.6, marginBottom: 4 }}>SUPUESTOS Y DERIVACIONES DECLARADOS</div>
                {rev.notas.map((n, i) => <div key={i} style={{ fontSize: 10.5, opacity: 0.75, padding: '2px 0' }}>· {n}</div>)}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, fontSize: 13 }}>activa un modelo del lote</div>
        )}
      </div>
    </div>
  );
}

/**
 * EL OJO en la pantalla — las figuras del libro dibujadas con los datos de este
 * modelo. Colapsable y perezoso: los SVG son grandes y solo se generan al abrir.
 */
function LaminasDelModelo({ rev, mesh }: { rev: RevisionModelo; mesh?: MeshLike }) {
  const [abierto, setAbierto] = useState(true);
  const laminas = useMemo(() => {
    if (!abierto) return [];
    try { return laminasDeRevision(rev, mesh); } catch (e) { console.error('laminas', e); return []; }
  }, [rev, mesh, abierto]);
  return (
    <div style={{ ...box }} data-testid="rl-laminas">
      <div onClick={() => setAbierto((v) => !v)} style={{ fontSize: 11, opacity: 0.7, marginBottom: abierto ? 10 : 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
        <span>👁 EL OJO — las figuras del libro con los datos de esta pieza</span>
        <span style={{ color: GOLD }}>{abierto ? '▾ ocultar' : `▸ ver ${laminas.length || ''} láminas`}</span>
      </div>
      {abierto && laminas.map((l) => (
        <div key={l.id} data-testid={`rl-lamina-${l.id}`} style={{ marginBottom: 14 }}>
          <div style={{ width: '100%', overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: l.svg }} />
          <div style={{ fontSize: 10.5, opacity: 0.62, lineHeight: 1.45, marginTop: 4 }}>
            <b style={{ color: GOLD }}>QUÉ MIRAR [{l.cita}]:</b> {l.queMirar}
          </div>
        </div>
      ))}
      {abierto && !laminas.length && <div style={{ fontSize: 11, opacity: 0.5 }}>sin láminas para este modelo (¿falta la malla?)</div>}
    </div>
  );
}

function DecisionRow({ d, onFirmar }: {
  d: Expediente['decisiones'][number];
  onFirmar: (id: string, eleccion: string, responsable: string) => void;
}) {
  const [opcion, setOpcion] = useState('');
  const [resp, setResp] = useState('');
  const firmada = d.eleccion != null && (d.id !== 'responsable-contraccion' || !!d.responsable);
  return (
    <div data-testid={`rl-decision-${d.id}`} style={{ padding: '7px 0', borderBottom: '1px solid #16202e' }}>
      <div style={{ fontSize: 11.5, display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ color: firmada ? '#59d98c' : '#ffb347', fontWeight: 800 }}>{firmada ? '●' : '○'}</span>
        <span style={{ color: GOLD, fontSize: 10.5, minWidth: 92 }}>[{d.cita}]</span>
        <span style={{ fontWeight: 700 }}>{d.tema}</span>
      </div>
      {d.notas && <div style={{ fontSize: 10, opacity: 0.55, paddingLeft: 21, marginTop: 2 }}>{d.notas}</div>}
      {firmada ? (
        <div style={{ fontSize: 10.5, paddingLeft: 21, marginTop: 3, opacity: 0.85 }}>
          → {d.eleccion}{d.responsable ? <span style={{ color: '#59d98c' }}> · firma: {d.responsable}{d.fecha ? ` (${d.fecha})` : ''}</span> : null}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, paddingLeft: 21, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          <select data-testid={`rl-opcion-${d.id}`} value={opcion} onChange={(e) => setOpcion(e.target.value)}
            style={{ maxWidth: 430, background: '#0f1620', border: '1px solid #2c3a50', color: '#e9eef5', borderRadius: 6, padding: '4px 6px', fontFamily: 'inherit', fontSize: 10.5 }}>
            <option value="">— elegir opción —</option>
            {d.opciones.map((o) => <option key={o} value={o}>{o.length > 88 ? o.slice(0, 86) + '…' : o}</option>)}
          </select>
          <input data-testid={`rl-resp-${d.id}`} placeholder="responsable" value={resp} onChange={(e) => setResp(e.target.value)}
            style={{ width: 110, background: '#0f1620', border: '1px solid #2c3a50', color: '#e9eef5', borderRadius: 6, padding: '4px 6px', fontFamily: 'inherit', fontSize: 10.5 }} />
          <button data-testid={`rl-firmar-${d.id}`} disabled={!opcion || !resp} onClick={() => onFirmar(d.id, opcion, resp)}
            style={{ background: opcion && resp ? GOLD : 'rgba(40,48,60,0.9)', color: opcion && resp ? '#1a1206' : '#9fb0c4', border: 'none', borderRadius: 6, padding: '4px 11px', fontSize: 10.5, fontWeight: 700, cursor: opcion && resp ? 'pointer' : 'default' }}>
            FIRMAR
          </button>
        </div>
      )}
    </div>
  );
}
