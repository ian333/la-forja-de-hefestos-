/**
 * TemisBoard — el tablero de órdenes TEMIS, como MÓDULO reutilizable.
 * Vivía embebido en ProjectSwitcher (el lobby de La Forja); se extrajo (2026-08-25,
 * orden temis-modulo-comando) para montarlo TAMBIÉN en comando.html sin duplicar código.
 * Exporta: <TemisBoard data=…/>, el hook useTemis(activo) que lee public/temis.json, el
 * tipo TemisJson y TEMIS_CSS (el estilo .tm-*, para las páginas que no traen el CSS del lobby).
 *
 * ESTADO DE DESPLIEGUE (coordinar deploys — nunca dos a la vez): cada tarjeta cerrada trae
 * `despliegue` ('en-vivo' | 'sin-desplegar' | 'n-a'), derivado por scripts/temis-tablero.cjs
 * comparando su commit contra public/temis-deploy.json. El tablero avisa arriba cuántas hay
 * sin desplegar.
 */
import { useEffect, useRef, useState } from 'react';

// ── TEMIS — el tablero de órdenes (nuestro Jira, sin el impuesto) ─────────────
// La diosa del orden, madre de las Moiras (hilan, miden, CORTAN). Lee
// `public/temis.json`, que `scripts/temis-tablero.cjs` genera de `ordenes/*.md`:
// nadie teclea un ticket — la orden ES el ticket. Tres columnas con TAPA
// (PRÓXIMO ≤7 · EN CURSO ≤1): el tablero se niega, no lista.
export interface TemisCard {
  file: string; slug: string; titulo: string; fecha: string;
  estado: 'proximo' | 'en-curso' | 'cerrado' | 'probado'; prioridad: number;
  objetivo: string; toca: number; crea: number; evidencia: number; cierre: string; commit: string;
  // LA PANTALLA DE EVIDENCIA (ian: "sí o sí deben estar los ss de que funciona")
  evidenciaDeclarada: string[]; cierreCompleto: string; evidenciaSS: string[]; revisable: boolean;
  // PROBADO (ian): `PROBADO: fecha · nota` en la orden → 4ª columna; `FALLA: nota` → insignia roja
  probado: string; falla: string;
  /** estado de DESPLIEGUE (coordinar deploys) — lo deriva temis-tablero.cjs contra public/temis-deploy.json */
  despliegue: 'en-vivo' | 'sin-desplegar' | 'n-a' | '';
  /** SUPERTICKET: la orden trae `## EJERCICIOS` (matriz herramienta × lección). El estado de cada
   *  ejercicio lo escribe la PRODUCCIÓN en public/evidencia/<slug>/resultados.json — nadie lo teclea. */
  superticket: boolean; ejercicios: TemisEjercicio[]; progreso: { verdes: number; rojos?: number; total: number } | null;
}
export interface TemisEjercicio {
  id: string; titulo: string; herramientas: string; oraculo: string;
  estado: 'verde' | 'rojo' | 'pendiente'; checks: string; video: string; still: string; nota: string;
}

/** nombre de archivo → pie de foto legible: "02-acta-rotulada-en-escena.jpg" → "acta rotulada en escena" */
const pieDeFoto = (ruta: string) => ruta.split('/').pop()!.replace(/\.(jpe?g|png|webp)$/i, '').replace(/^\d+-/, '').replace(/-/g, ' ');

function TemisDetalle({ c, onVolver }: { c: TemisCard; onVolver: () => void }) {
  const tit = c.titulo.replace(/^v1·\d+[a-z]?\s*—\s*/, '');
  return (
    <div className="tm-det" data-testid="temis-detalle">
      <button className="tm-volver" data-testid="temis-volver" onClick={onVolver}>← Tablero</button>
      <div className="tm-det-head">
        <span className={`tm-estado ${c.estado}`}>{c.estado === 'cerrado' ? 'cerrada' : c.estado === 'probado' ? `probada · ${c.probado}` : c.estado === 'en-curso' ? 'en curso' : `próximo #${c.prioridad}`}</span>
        <h3>{tit}</h3>
        <p className="tm-meta">{c.fecha} · <code>{c.file}</code>{c.commit && <span className="tm-commit"> · {c.commit}</span>}</p>
      </div>
      {(c.estado === 'cerrado' || c.estado === 'probado') && !c.revisable && (
        <div className="tm-viol" data-testid="temis-sin-evidencia">✘ SIN EVIDENCIA VISUAL — cerrada sin screenshots. No se puede pedir revisión de esto.</div>
      )}
      {c.falla && <div className="tm-viol" data-testid="temis-falla-detalle">✘ FALLÓ LA PRUEBA DE IAN — {c.falla}</div>}
      {/* LA EVIDENCIA VA ARRIBA: se abre la tarjeta y SE VE. Antes vivía al final,
          debajo de un CIERRE de 30 líneas — para revisar había que scrollear hasta
          el fondo y las flechas quedaban fuera del panel (cazado con los ojos). */}
      {/* SUPERTICKET: los ejercicios van ANTES de la galería — el veredicto de cada uno
          (verde/rojo/gris) es lo que se revisa; la foto es su prueba. */}
      {c.superticket && c.progreso && <>
        <h5>Ejercicios <b>{c.progreso.verdes}/{c.progreso.total}</b><span className="tm-ej-leyenda">verde = kernel Y juez con ojos pasaron · rojo = falló uno (el gate del kernel no basta) · gris = sin producir</span></h5>
        <ol className="tm-ej" data-testid="temis-ejercicios">
          {c.ejercicios.map((e) => (
            <li key={e.id} className={`tm-ej-fila ${e.estado}`} data-testid={`temis-ej-${e.id}`} title={`${e.id} · oráculo: ${e.oraculo}`}>
              <span className={`tm-ej-punto ${e.estado}`} aria-label={e.estado} />
              <span className="tm-ej-id">{e.id}</span>
              <span className="tm-ej-tit">{e.titulo}</span>
              <code className="tm-ej-tools">{e.herramientas}</code>
              <span className="tm-ej-checks">{e.checks || (e.estado === 'pendiente' ? '—' : '')}</span>
              <span className="tm-ej-nota">{e.nota || e.oraculo}</span>
            </li>
          ))}
        </ol>
      </>}
      {c.evidenciaSS.length > 0 && <>
        <h5>Evidencia visual <b>{c.evidenciaSS.length}</b></h5>
        <Galeria fotos={c.evidenciaSS} />
      </>}
      {c.objetivo && <><h5>Objetivo</h5><p className="tm-txt">{c.objetivo}</p></>}
      {c.evidenciaDeclarada.length > 0 && <>
        <h5>Evidencia declarada (antes de trabajar)</h5>
        <ul className="tm-ul">{c.evidenciaDeclarada.map((e, i) => <li key={i}>{e}</li>)}</ul>
      </>}
      {c.cierreCompleto && <><h5>Cierre (lo que de verdad pasó)</h5><p className="tm-txt">{c.cierreCompleto}</p></>}
    </div>
  );
}
/** LA EVIDENCIA SE RECORRE A LO ANCHO (caza de ian 2026-08-26: «que las imágenes
 *  las pueda recorrer hacia la derecha y no hacia abajo»). Carrusel con
 *  scroll-snap: el scroll horizontal nativo (trackpad / shift+rueda) sigue vivo;
 *  las flechas son para el mouse. El contador dice DÓNDE vas — con 6 capturas
 *  uno se pierde. */
function Galeria({ fotos }: { fotos: string[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [i, setI] = useState(0);
  const irA = (n: number) => {
    const el = ref.current; if (!el) return;
    const k = Math.max(0, Math.min(fotos.length - 1, n));
    const hijo = el.children[k] as HTMLElement | undefined;
    if (hijo) el.scrollTo({ left: hijo.offsetLeft - el.offsetLeft, behavior: 'smooth' });
    setI(k);
  };
  // el índice sale del SCROLL REAL (si arrastras con el trackpad, el contador sigue)
  const alScroll = () => {
    const el = ref.current; if (!el) return;
    let mejor = 0, dmin = Infinity;
    for (let k = 0; k < el.children.length; k++) {
      const h = el.children[k] as HTMLElement;
      const d = Math.abs((h.offsetLeft - el.offsetLeft) - el.scrollLeft);
      if (d < dmin) { dmin = d; mejor = k; }
    }
    setI(mejor);
  };
  return (
    <div className="tm-galwrap">
      {fotos.length > 1 && (
        <div className="tm-galnav">
          <button data-testid="temis-gal-prev" onClick={() => irA(i - 1)} disabled={i === 0} title="anterior (o arrastra a los lados)">‹</button>
          <span data-testid="temis-gal-pos">{i + 1}/{fotos.length}</span>
          <button data-testid="temis-gal-next" onClick={() => irA(i + 1)} disabled={i >= fotos.length - 1} title="siguiente">›</button>
          <span className="tm-galhint">— arrastra a los lados o usa las flechas</span>
        </div>
      )}
      <div className="tm-gal" data-testid="temis-galeria" ref={ref} onScroll={alScroll}>
        {fotos.map((src) => (
          <figure key={src}>
            <a href={src} target="_blank" rel="noreferrer" title="abrir a tamaño real"><img src={src} alt={pieDeFoto(src)} loading="lazy" /></a>
            <figcaption>{pieDeFoto(src)}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export interface TemisJson {
  nombre: string; generado: string;
  wip: { proximo: number; enCurso: number };
  /** enCurso = lo que cuenta para la TAPA (espera a ian); supertickets = los que corren solos y se listan aparte del conteo */
  conteo: { proximo: number; enCurso: number; supertickets?: number; cerrado: number; probado: number; porProbar: number; sinDesplegar: number; despues: number };
  deploy: { commit: string; fecha: string } | null;
  /** CINE — 1 video por día (videos/CRONOGRAMA.json); `publicado` derivado del catálogo de Comando */
  cine: { nota: string; dias: Array<{ fecha: string; id: string; titulo: string; base: string; tipo: string; estado: 'hecho' | 'hoy' | 'proximo'; manifiesto: boolean; publicado: boolean }> } | null;
  violaciones: string[];
  columnas: { proximo: TemisCard[]; enCurso: TemisCard[]; cerrado: TemisCard[]; probado: TemisCard[] };
  despues: Array<{ grupo: string; texto: string }>;
}

function TemisCardView({ c, onOpen }: { c: TemisCard; onOpen: (c: TemisCard) => void }) {
  const tit = c.titulo.replace(/^v1·\d+[a-z]?\s*—\s*/, '');
  return (
    <button className={`tm-card ${c.estado}`} data-testid={`temis-card-${c.slug}`} title={`${c.file} — abrir evidencia`} onClick={() => onOpen(c)}>
      <div className="tm-top">
        {c.estado === 'proximo' && <span className="tm-n">{c.prioridad}</span>}
        {c.estado === 'en-curso' && <span className="tm-n live">▶</span>}
        {c.estado === 'cerrado' && <span className="tm-n done">✓</span>}
        {c.estado === 'probado' && <span className="tm-n done">✓✓</span>}
        <p className="tm-tit">{tit}</p>
      </div>
      {(c.estado === 'proximo' || c.estado === 'en-curso') && c.objetivo && <p className="tm-obj">{c.objetivo}</p>}
      {(c.estado === 'cerrado' || c.estado === 'probado') && c.cierre && <p className="tm-obj">{c.cierre}</p>}
      {c.superticket && c.progreso && (
        <div className="tm-barra" data-testid={`temis-progreso-${c.slug}`} title="ejercicios con oráculo del kernel en verde">
          <div className="tm-barra-pista">
            <div className="tm-barra-llena" style={{ width: `${c.progreso.total ? Math.round(100 * c.progreso.verdes / c.progreso.total) : 0}%` }} />
            {/* rojo = producido y reprobado (kernel o juez): trabajo hecho que falló, no se esconde */}
            {(c.progreso.rojos ?? 0) > 0 && <div className="tm-barra-roja" style={{ width: `${c.progreso.total ? Math.round(100 * (c.progreso.rojos ?? 0) / c.progreso.total) : 0}%` }} />}
          </div>
          <span className="tm-barra-n">{c.progreso.verdes}/{c.progreso.total} ejercicios{(c.progreso.rojos ?? 0) > 0 ? ` · ${c.progreso.rojos} rojo` : ''}</span>
        </div>
      )}
      <p className="tm-meta">
        {c.fecha}{c.toca ? ` · toca ${c.toca}` : ''}{c.crea ? ` · crea ${c.crea}` : ''}{c.evidencia ? ` · evidencia ${c.evidencia}` : ''}
        {c.commit && <span className="tm-commit"> · {c.commit}</span>}
      </p>
      {c.estado === 'cerrado' && (
        c.falla
          ? <span className="tm-badge falla" data-testid={`temis-falla-${c.slug}`}>✘ falló la prueba — {c.falla}</span>
          : c.revisable
            ? <span className="tm-badge ok" data-testid={`temis-ss-${c.slug}`}>📷 {c.evidenciaSS.length} — por probar</span>
            : <span className="tm-badge no">sin evidencia visual</span>
      )}
      {c.estado === 'probado' && <span className="tm-badge ok" data-testid={`temis-probado-${c.slug}`}>✓✓ probado · {c.probado}</span>}
      {c.despliegue === 'sin-desplegar' && <span className="tm-badge dep-no" data-testid={`temis-sindesplegar-${c.slug}`}>⬆ sin desplegar</span>}
      {c.despliegue === 'en-vivo' && <span className="tm-badge dep-si" data-testid={`temis-envivo-${c.slug}`}>● en vivo</span>}
    </button>
  );
}

export function TemisBoard({ data }: { data: TemisJson | null | { error: true } }) {
  const [verCerradas, setVerCerradas] = useState(false);
  const [detalle, setDetalle] = useState<TemisCard | null>(null);
  if (!data) return <div className="ps-empty">Temis está leyendo las órdenes…</div>;
  if ('error' in data) return <div className="ps-empty">No encontré <code>temis.json</code> — corre <code>node scripts/temis-tablero.cjs</code>.</div>;
  if (detalle) return <div className="tm"><TemisDetalle c={detalle} onVolver={() => setDetalle(null)} /></div>;
  const { columnas, wip, conteo, violaciones, despues, deploy, cine } = data;
  const cerradasVis = verCerradas ? columnas.cerrado : columnas.cerrado.slice(0, 6);
  const grupos = Array.from(new Set(despues.map((d) => d.grupo)));
  return (
    <div className="tm" data-testid="temis-board">
      {conteo.sinDesplegar > 0 && (
        <div className="tm-dep-aviso" data-testid="temis-sin-desplegar">
          ⬆ <b>{conteo.sinDesplegar}</b> {conteo.sinDesplegar === 1 ? 'tarjeta cerrada' : 'tarjetas cerradas'} sin desplegar — coordina el deploy (nunca dos a la vez)
          {deploy && <span className="tm-dep-last"> · en vivo: {deploy.commit} · {deploy.fecha}</span>}
        </div>
      )}
      {conteo.sinDesplegar === 0 && deploy && (
        <div className="tm-dep-ok" data-testid="temis-deploy-ok">✓ todo desplegado · {deploy.commit} · {deploy.fecha}</div>
      )}
      {violaciones.length > 0 && (
        <div className="tm-viol" data-testid="temis-violaciones">
          {violaciones.map((v, i) => <div key={i}>✘ {v}</div>)}
        </div>
      )}
      {cine && cine.dias.length > 0 && (
        <section className="tm-cine" data-testid="temis-cine">
          <h4>Cine · 1 por día <span>{cine.dias.filter((d) => d.publicado).length} publicados · {cine.dias.filter((d) => d.estado === 'proximo').length} en cola</span></h4>
          <div className="tm-cine-tira">
            {cine.dias.map((d) => (
              <div key={d.id} className={`tm-dia ${d.estado} ${d.publicado ? 'pub' : ''}`} data-testid={`temis-cine-${d.id}`} title={`${d.id} · ${d.base} · ${d.tipo}`}>
                <div className="tm-dia-f">{d.fecha.slice(5)}{d.estado === 'hoy' && <b> HOY</b>}</div>
                <div className="tm-dia-t">{d.titulo}</div>
                <div className="tm-dia-m">{d.publicado ? '● publicado' : d.estado === 'hecho' ? '✓ hecho · sin publicar' : d.manifiesto ? '▶ manifiesto listo' : d.tipo}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="tm-cols">
        <section className="tm-col" data-testid="temis-col-proximo">
          <h4>Próximo <b className={conteo.proximo > wip.proximo ? 'bad' : ''}>{conteo.proximo}/{wip.proximo}</b></h4>
          {columnas.proximo.map((c) => <TemisCardView key={c.slug} c={c} onOpen={setDetalle} />)}
          {columnas.proximo.length === 0 && <div className="tm-vacio">nada en cola — escribe una orden con <code>ESTADO: proximo</code></div>}
        </section>
        <section className="tm-col" data-testid="temis-col-en-curso">
          <h4>En curso <b className={conteo.enCurso > wip.enCurso ? 'bad' : ''}>{conteo.enCurso}/{wip.enCurso}</b>{(conteo.supertickets ?? 0) > 0 && <span className="tm-sub" title="los supertickets corren solos en iangpu; no cuentan para la tapa">+{conteo.supertickets} superticket</span>}</h4>
          {columnas.enCurso.map((c) => <TemisCardView key={c.slug} c={c} onOpen={setDetalle} />)}
          {columnas.enCurso.length === 0 && <div className="tm-vacio">libre — toma la #1 de Próximo</div>}
        </section>
        <section className="tm-col" data-testid="temis-col-cerrado">
          <h4>Cerrado <b>{conteo.cerrado}</b>{conteo.porProbar > 0 && <span className="tm-sub">{conteo.porProbar} por probar</span>}</h4>
          {cerradasVis.map((c) => <TemisCardView key={c.slug} c={c} onOpen={setDetalle} />)}
          {columnas.cerrado.length > 6 && (
            <button className="tm-mas" onClick={() => setVerCerradas((v) => !v)}>
              {verCerradas ? 'ver menos' : `y ${columnas.cerrado.length - 6} más`}
            </button>
          )}
        </section>
        {/* PROBADO (ian): lo que ya probó y acepta. Se marca con `PROBADO:` en la orden. */}
        <section className="tm-col" data-testid="temis-col-probado">
          <h4>Probado <b>{conteo.probado ?? 0}</b></h4>
          {(columnas.probado ?? []).map((c) => <TemisCardView key={c.slug} c={c} onOpen={setDetalle} />)}
          {(columnas.probado ?? []).length === 0 && <div className="tm-vacio">nada probado aún — di "probado &lt;ticket&gt;" y la orden recibe <code>PROBADO:</code></div>}
        </section>
      </div>
      <details className="tm-despues" data-testid="temis-despues">
        <summary>Después de v1 <b>{conteo.despues}</b> <span>— congelado, no muerto. No recibe orden.</span></summary>
        {grupos.map((g) => (
          <div key={g} className="tm-grupo">
            <h5>{g}</h5>
            {despues.filter((d) => d.grupo === g).map((d, i) => <p key={i}>{d.texto}</p>)}
          </div>
        ))}
      </details>
      <p className="tm-pie">La orden es el ticket. Nadie teclea nada: <code>ordenes/*.md</code> → <code>temis-tablero.cjs</code> → aquí. Generado {data.generado}.</p>
    </div>
  );
}

/** Lee public/temis.json cuando `activo` se vuelve true (una vez). Mismo fetch que usaba el
 *  lobby; centralizado aquí para que comando.html y el lobby compartan una sola fuente. */
export function useTemis(activo: boolean): TemisJson | null | { error: true } {
  const [temis, setTemis] = useState<TemisJson | null | { error: true }>(null);
  useEffect(() => {
    if (!activo || temis) return;
    fetch('temis.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: TemisJson) => setTemis(j))
      .catch(() => setTemis({ error: true }));
  }, [activo, temis]);
  return temis;
}

export const TEMIS_CSS = `
.tm{padding:10px 16px 14px;overflow:auto;display:flex;flex-direction:column;gap:10px}
.tm-viol{border:1px solid rgba(242,122,108,.55);background:rgba(242,122,108,.10);color:#f8b4aa;border-radius:9px;padding:9px 12px;font-size:12.5px;font-weight:600;display:flex;flex-direction:column;gap:3px}
.tm-cols{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;align-items:start}
.tm-col h4 .tm-sub{margin-left:auto;font-size:10px;letter-spacing:0;text-transform:none;color:#FDB813;font-weight:600}
.tm-badge.falla{color:#f8b4aa;background:rgba(242,122,108,.10);border-color:rgba(242,122,108,.45)}
.tm-card.probado{border-color:rgba(126,224,160,.35)}
.tm-estado.probado{color:#7ee0a0;border-color:rgba(126,224,160,.5)}
.tm-col{display:flex;flex-direction:column;gap:8px;min-width:0}
.tm-col h4{margin:0 0 2px;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ds-faint,#7E90A9);font-weight:700;display:flex;align-items:center;gap:8px}
.tm-col h4 b{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0;color:var(--ds-dim,#A6B4C8);background:var(--ds-panel2,#16202F);border:1px solid var(--ds-line,rgba(140,180,255,.1));border-radius:6px;padding:1px 7px}
.tm-col h4 b.bad{color:#f8b4aa;border-color:rgba(242,122,108,.55)}
.tm-card{border:1px solid var(--ds-line,rgba(140,180,255,.1));border-radius:10px;background:var(--ds-panel2,#16202F);padding:9px 10px;display:flex;flex-direction:column;gap:4px;min-width:0}
.tm-card.en-curso{border-color:rgba(253,184,19,.55);background:rgba(253,184,19,.07)}
.tm-card.cerrado{opacity:.78}
.tm-top{display:flex;gap:8px;align-items:flex-start}
.tm-n{flex:0 0 auto;width:20px;height:20px;border-radius:6px;display:grid;place-items:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:700;color:#1a1206;background:#FDB813}
.tm-n.live{background:#FDB813;color:#1a1206}
.tm-n.done{background:rgba(126,224,160,.18);color:#7ee0a0;border:1px solid rgba(126,224,160,.4)}
.tm-tit{margin:1px 0 0;font-size:12.5px;font-weight:700;line-height:1.25;color:var(--ds-text,#DCE7F5);min-width:0}
.tm-obj{margin:0;font-size:11.5px;line-height:1.4;color:var(--ds-dim,#A6B4C8);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.tm-meta{margin:0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:var(--ds-faint,#7E90A9);font-variant-numeric:tabular-nums}
.tm-commit{color:#7ee0a0}
.tm-vacio{font-size:11.5px;color:var(--ds-faint,#7E90A9);border:1px dashed var(--ds-line,rgba(140,180,255,.1));border-radius:10px;padding:12px;text-align:center}
.tm-mas{all:unset;cursor:pointer;font-family:inherit;font-size:11.5px;color:#FDB813;padding:4px 2px}
.tm-despues{border:1px solid var(--ds-line,rgba(140,180,255,.1));border-radius:10px;padding:8px 12px;background:transparent}
.tm-despues summary{cursor:pointer;font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--ds-faint,#7E90A9);display:flex;gap:8px;align-items:center}
.tm-despues summary b{font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:0;color:var(--ds-dim,#A6B4C8)}
.tm-despues summary span{text-transform:none;letter-spacing:0;font-weight:500}
.tm-grupo{padding:8px 0 2px}
.tm-grupo h5{margin:0 0 4px;font-size:11.5px;color:var(--ds-text,#DCE7F5)}
.tm-grupo p{margin:0 0 3px 10px;font-size:11.5px;line-height:1.4;color:var(--ds-dim,#A6B4C8)}
.tm-pie{margin:0;font-size:10.5px;color:var(--ds-faint,#7E90A9)}
.tm-card{appearance:none;box-sizing:border-box;cursor:pointer;font:inherit;color:inherit;text-align:left;width:100%;transition:border-color .12s,transform .12s}
.tm-card:hover{border-color:var(--ds-line2,rgba(140,180,255,.22));transform:translateY(-1px)}
.tm-card:focus-visible{outline:2px solid #FDB813;outline-offset:2px}
.tm-badge{align-self:flex-start;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;padding:2px 7px;border-radius:6px;border:1px solid transparent;margin-top:2px}
.tm-badge.ok{color:#7ee0a0;background:rgba(126,224,160,.10);border-color:rgba(126,224,160,.35)}
.tm-badge.no{color:var(--ds-faint,#7E90A9);background:transparent;border-color:var(--ds-line,rgba(140,180,255,.1))}
/* la pantalla de evidencia */
.tm-det{display:flex;flex-direction:column;gap:8px}
.tm-volver{all:unset;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;color:#FDB813;align-self:flex-start;padding:2px 0}
.tm-det-head{display:flex;flex-direction:column;gap:3px;padding-bottom:8px;border-bottom:1px solid var(--ds-line,rgba(140,180,255,.1))}
.tm-det-head h3{margin:0;font-size:16px;font-weight:700;letter-spacing:-.01em;color:var(--ds-text,#DCE7F5);line-height:1.25}
.tm-estado{align-self:flex-start;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;padding:2px 7px;border-radius:6px;background:var(--ds-panel2,#16202F);color:var(--ds-dim,#A6B4C8);border:1px solid var(--ds-line,rgba(140,180,255,.1))}
.tm-estado.cerrado{color:#7ee0a0;border-color:rgba(126,224,160,.35)}
.tm-estado.en-curso{color:#FDB813;border-color:rgba(253,184,19,.45)}
.tm-det h5{margin:6px 0 0;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ds-faint,#7E90A9);font-weight:700;display:flex;gap:8px;align-items:center}
.tm-det h5 b{font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:0;color:var(--ds-dim,#A6B4C8)}
.tm-txt{margin:0;font-size:12.5px;line-height:1.5;color:var(--ds-dim,#A6B4C8);max-width:78ch}
.tm-ul{margin:0;padding-left:18px;font-size:12px;line-height:1.5;color:var(--ds-dim,#A6B4C8);max-width:78ch}
.tm-galwrap{display:flex;flex-direction:column;gap:6px;min-width:0}
.tm-gal{display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;padding-bottom:4px;scrollbar-width:thin}
.tm-gal figure{margin:0;flex:0 0 min(720px,92%);scroll-snap-align:start;border:1px solid var(--ds-line,rgba(140,180,255,.1));border-radius:10px;overflow:hidden;background:#070d16}
/* la foto CABE ENTERA con su pie y sus flechas: sin tope se cortaba abajo y el
   nav quedaba fuera del panel (cazado con los ojos, no por el arnés) */
.tm-gal img{display:block;width:100%;height:auto;max-height:42vh;object-fit:contain;background:#070d16}
.tm-galnav{display:flex;align-items:center;gap:8px}
.tm-galnav button{appearance:none;cursor:pointer;font:inherit;font-size:16px;line-height:1;width:30px;height:26px;border-radius:7px;border:1px solid var(--ds-line,rgba(140,180,255,.1));background:var(--ds-panel2,#16202F);color:var(--ds-text,#DCE7F5)}
.tm-galnav button:disabled{opacity:.35;cursor:default}
.tm-galnav span{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:var(--ds-dim,#A6B4C8)}
.tm-galhint{font-family:inherit !important;color:var(--ds-faint,#7E90A9) !important}
.tm-gal figcaption{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:var(--ds-dim,#A6B4C8);padding:7px 10px;border-top:1px solid var(--ds-line,rgba(140,180,255,.1))}
.tm-dep-aviso{border:1px solid rgba(253,184,19,.5);background:rgba(253,184,19,.10);color:#f4cf7a;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:600}
.tm-dep-aviso b{font-family:'JetBrains Mono',ui-monospace,monospace}
.tm-dep-last{color:#7ee0a0;font-weight:500}
.tm-dep-ok{font-size:11px;color:#7ee0a0;font-weight:600}
.tm-badge.dep-no{color:#f4cf7a;background:rgba(253,184,19,.10);border-color:rgba(253,184,19,.45)}
.tm-badge.dep-si{color:#7ee0a0;background:transparent;border-color:rgba(126,224,160,.30)}
.tm-cine{border:1px solid var(--ds-line,rgba(140,180,255,.1));border-radius:10px;padding:8px 12px 10px;background:transparent}
.tm-cine h4{margin:0 0 8px;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ds-faint,#7E90A9);font-weight:700;display:flex;gap:8px;align-items:center}
.tm-cine h4 span{text-transform:none;letter-spacing:0;font-weight:500;color:var(--ds-dim,#A6B4C8);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px}
.tm-cine-tira{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.tm-dia{border:1px solid var(--ds-line,rgba(140,180,255,.1));border-radius:9px;padding:7px 9px;background:var(--ds-panel2,#16202F);min-width:0}
.tm-dia.hoy{border-color:rgba(253,184,19,.6);background:rgba(253,184,19,.08)}
.tm-dia.hecho{opacity:.8}
.tm-dia.pub{border-color:rgba(126,224,160,.4)}
.tm-dia-f{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:var(--ds-faint,#7E90A9)}
.tm-dia-f b{color:#FDB813}
.tm-dia-t{font-size:11.5px;font-weight:700;line-height:1.25;color:var(--ds-text,#DCE7F5);margin:3px 0}
.tm-dia-m{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:var(--ds-dim,#A6B4C8)}
.tm-dia.pub .tm-dia-m{color:#7ee0a0}
.tm code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;color:var(--ds-dim,#A6B4C8)}
/* SUPERTICKET: barra n/N en la tarjeta + lista de ejercicios en el detalle */
.tm-barra{display:flex;align-items:center;gap:8px;margin-top:2px;min-width:0}
.tm-barra-pista{flex:1 1 auto;height:5px;border-radius:3px;background:var(--ds-line,rgba(140,180,255,.1));overflow:hidden;display:flex}
.tm-barra-llena{height:100%;background:#7ee0a0;border-radius:3px;transition:width .2s;flex:0 0 auto}
.tm-barra-roja{height:100%;background:#f27a6c;border-radius:3px;transition:width .2s;flex:0 0 auto}
.tm-barra-n{flex:0 0 auto;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:var(--ds-dim,#A6B4C8);font-variant-numeric:tabular-nums}
.tm-ej-leyenda{margin-left:auto;text-transform:none;letter-spacing:0;font-weight:500;font-size:10px;color:var(--ds-faint,#7E90A9)}
.tm-ej{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;border:1px solid var(--ds-line,rgba(140,180,255,.1));border-radius:10px;overflow:hidden;background:var(--ds-panel2,#16202F)}
.tm-ej-fila{display:grid;grid-template-columns:12px 86px minmax(160px,1.4fr) minmax(120px,.8fr) 52px minmax(140px,1fr);gap:10px;align-items:center;padding:7px 10px;border-top:1px solid var(--ds-line,rgba(140,180,255,.1));font-size:12px;color:var(--ds-dim,#A6B4C8);min-width:0}
.tm-ej-fila:first-child{border-top:0}
.tm-ej-fila.verde{background:rgba(126,224,160,.05)}
.tm-ej-fila.rojo{background:rgba(242,122,108,.06)}
.tm-ej-punto{width:9px;height:9px;border-radius:50%;background:var(--ds-faint,#7E90A9);opacity:.55;flex:0 0 auto}
.tm-ej-punto.verde{background:#7ee0a0;opacity:1;box-shadow:0 0 6px rgba(126,224,160,.6)}
.tm-ej-punto.rojo{background:#f27a6c;opacity:1;box-shadow:0 0 6px rgba(242,122,108,.6)}
.tm-ej-id{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;color:var(--ds-faint,#7E90A9)}
.tm-ej-tit{font-weight:600;color:var(--ds-text,#DCE7F5);line-height:1.3;min-width:0}
.tm-ej-fila.pendiente .tm-ej-tit{color:var(--ds-dim,#A6B4C8);font-weight:500}
.tm-ej-tools{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;color:#FDB813;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-ej-checks{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-variant-numeric:tabular-nums;text-align:right;color:var(--ds-dim,#A6B4C8)}
.tm-ej-fila.verde .tm-ej-checks{color:#7ee0a0}
.tm-ej-fila.rojo .tm-ej-checks{color:#f8b4aa}
.tm-ej-nota{font-size:11px;color:var(--ds-faint,#7E90A9);line-height:1.3;min-width:0;overflow-wrap:anywhere}
@media (max-width:980px){.tm-ej-fila{grid-template-columns:12px 1fr;grid-auto-flow:row}.tm-ej-id,.tm-ej-tools,.tm-ej-checks,.tm-ej-nota{grid-column:2}.tm-ej-checks{text-align:left}}
`;
