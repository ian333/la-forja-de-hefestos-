/**
 * ProjectSwitcher — el LOBBY integrado de La Forja. NO es página aparte: baja del
 * título de la barra, sobre el estudio atenuado, una sola pantalla, la pieza detrás.
 * UNIVERSAL: moldes, robots y mecanismos (no solo moldes). El estudio le pasa la
 * lista (biblioteca + plantillas) ya con su tipo y acción; esto sólo la pinta.
 */
import { useEffect, useState } from 'react';

export type ProjType = 'molde' | 'robot' | 'mecanismo' | 'pieza';

// ── TEMIS — el tablero de órdenes (nuestro Jira, sin el impuesto) ─────────────
// La diosa del orden, madre de las Moiras (hilan, miden, CORTAN). Lee
// `public/temis.json`, que `scripts/temis-tablero.cjs` genera de `ordenes/*.md`:
// nadie teclea un ticket — la orden ES el ticket. Tres columnas con TAPA
// (PRÓXIMO ≤7 · EN CURSO ≤1): el tablero se niega, no lista.
interface TemisCard {
  file: string; slug: string; titulo: string; fecha: string;
  estado: 'proximo' | 'en-curso' | 'cerrado'; prioridad: number;
  objetivo: string; toca: number; crea: number; evidencia: number; cierre: string; commit: string;
  // LA PANTALLA DE EVIDENCIA (ian: "sí o sí deben estar los ss de que funciona")
  evidenciaDeclarada: string[]; cierreCompleto: string; evidenciaSS: string[]; revisable: boolean;
}

/** nombre de archivo → pie de foto legible: "02-acta-rotulada-en-escena.jpg" → "acta rotulada en escena" */
const pieDeFoto = (ruta: string) => ruta.split('/').pop()!.replace(/\.(jpe?g|png|webp)$/i, '').replace(/^\d+-/, '').replace(/-/g, ' ');

function TemisDetalle({ c, onVolver }: { c: TemisCard; onVolver: () => void }) {
  const tit = c.titulo.replace(/^v1·\d+[a-z]?\s*—\s*/, '');
  return (
    <div className="tm-det" data-testid="temis-detalle">
      <button className="tm-volver" data-testid="temis-volver" onClick={onVolver}>← Tablero</button>
      <div className="tm-det-head">
        <span className={`tm-estado ${c.estado}`}>{c.estado === 'cerrado' ? 'cerrada' : c.estado === 'en-curso' ? 'en curso' : `próximo #${c.prioridad}`}</span>
        <h3>{tit}</h3>
        <p className="tm-meta">{c.fecha} · <code>{c.file}</code>{c.commit && <span className="tm-commit"> · {c.commit}</span>}</p>
      </div>
      {c.estado === 'cerrado' && !c.revisable && (
        <div className="tm-viol" data-testid="temis-sin-evidencia">✘ SIN EVIDENCIA VISUAL — cerrada sin screenshots. No se puede pedir revisión de esto.</div>
      )}
      {c.objetivo && <><h5>Objetivo</h5><p className="tm-txt">{c.objetivo}</p></>}
      {c.evidenciaDeclarada.length > 0 && <>
        <h5>Evidencia declarada (antes de trabajar)</h5>
        <ul className="tm-ul">{c.evidenciaDeclarada.map((e, i) => <li key={i}>{e}</li>)}</ul>
      </>}
      {c.cierreCompleto && <><h5>Cierre (lo que de verdad pasó)</h5><p className="tm-txt">{c.cierreCompleto}</p></>}
      {c.evidenciaSS.length > 0 && <>
        <h5>Evidencia visual <b>{c.evidenciaSS.length}</b></h5>
        <div className="tm-gal" data-testid="temis-galeria">
          {c.evidenciaSS.map((src) => (
            <figure key={src}>
              <a href={src} target="_blank" rel="noreferrer" title="abrir a tamaño real"><img src={src} alt={pieDeFoto(src)} loading="lazy" /></a>
              <figcaption>{pieDeFoto(src)}</figcaption>
            </figure>
          ))}
        </div>
      </>}
    </div>
  );
}
interface TemisJson {
  nombre: string; generado: string;
  wip: { proximo: number; enCurso: number };
  conteo: { proximo: number; enCurso: number; cerrado: number; despues: number };
  violaciones: string[];
  columnas: { proximo: TemisCard[]; enCurso: TemisCard[]; cerrado: TemisCard[] };
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
        <p className="tm-tit">{tit}</p>
      </div>
      {c.estado !== 'cerrado' && c.objetivo && <p className="tm-obj">{c.objetivo}</p>}
      {c.estado === 'cerrado' && c.cierre && <p className="tm-obj">{c.cierre}</p>}
      <p className="tm-meta">
        {c.fecha}{c.toca ? ` · toca ${c.toca}` : ''}{c.crea ? ` · crea ${c.crea}` : ''}{c.evidencia ? ` · evidencia ${c.evidencia}` : ''}
        {c.commit && <span className="tm-commit"> · {c.commit}</span>}
      </p>
      {c.estado === 'cerrado' && (
        c.revisable
          ? <span className="tm-badge ok" data-testid={`temis-ss-${c.slug}`}>📷 {c.evidenciaSS.length} — revisable</span>
          : <span className="tm-badge no">sin evidencia visual</span>
      )}
    </button>
  );
}

function TemisBoard({ data }: { data: TemisJson | null | { error: true } }) {
  const [verCerradas, setVerCerradas] = useState(false);
  const [detalle, setDetalle] = useState<TemisCard | null>(null);
  if (!data) return <div className="ps-empty">Temis está leyendo las órdenes…</div>;
  if ('error' in data) return <div className="ps-empty">No encontré <code>temis.json</code> — corre <code>node scripts/temis-tablero.cjs</code>.</div>;
  if (detalle) return <div className="tm"><TemisDetalle c={detalle} onVolver={() => setDetalle(null)} /></div>;
  const { columnas, wip, conteo, violaciones, despues } = data;
  const cerradasVis = verCerradas ? columnas.cerrado : columnas.cerrado.slice(0, 6);
  const grupos = Array.from(new Set(despues.map((d) => d.grupo)));
  return (
    <div className="tm" data-testid="temis-board">
      {violaciones.length > 0 && (
        <div className="tm-viol" data-testid="temis-violaciones">
          {violaciones.map((v, i) => <div key={i}>✘ {v}</div>)}
        </div>
      )}
      <div className="tm-cols">
        <section className="tm-col" data-testid="temis-col-proximo">
          <h4>Próximo <b className={conteo.proximo > wip.proximo ? 'bad' : ''}>{conteo.proximo}/{wip.proximo}</b></h4>
          {columnas.proximo.map((c) => <TemisCardView key={c.slug} c={c} onOpen={setDetalle} />)}
          {columnas.proximo.length === 0 && <div className="tm-vacio">nada en cola — escribe una orden con <code>ESTADO: proximo</code></div>}
        </section>
        <section className="tm-col" data-testid="temis-col-en-curso">
          <h4>En curso <b className={conteo.enCurso > wip.enCurso ? 'bad' : ''}>{conteo.enCurso}/{wip.enCurso}</b></h4>
          {columnas.enCurso.map((c) => <TemisCardView key={c.slug} c={c} onOpen={setDetalle} />)}
          {columnas.enCurso.length === 0 && <div className="tm-vacio">libre — toma la #1 de Próximo</div>}
        </section>
        <section className="tm-col" data-testid="temis-col-cerrado">
          <h4>Cerrado <b>{conteo.cerrado}</b></h4>
          {cerradasVis.map((c) => <TemisCardView key={c.slug} c={c} onOpen={setDetalle} />)}
          {columnas.cerrado.length > 6 && (
            <button className="tm-mas" onClick={() => setVerCerradas((v) => !v)}>
              {verCerradas ? 'ver menos' : `y ${columnas.cerrado.length - 6} más`}
            </button>
          )}
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

export interface ProjItem {
  key: string;
  name: string;
  type: ProjType;
  meta?: string;          // línea mono (material · cavidades · $/pza · GDL…)
  status?: string;        // 'abierto ahora' · 'guardado' · 'en diseño'
  statusColor?: string;
  current?: boolean;
  action: () => void;     // qué hace al abrirlo (loadDoc / loadFromLibrary / curso…)
  /** HIGIENE (v1·2): 'banco' = demos de validación del solver (probeta, espiral,
   *  N2, redes…) que antes vivían en el ribbon. Sección propia, abajo de "Empezar de". */
  section?: 'plantilla' | 'banco';
}

const TYPE: Record<ProjType, { label: string; color: string }> = {
  molde:     { label: 'Molde',     color: '#FDB813' },
  robot:     { label: 'Robot',     color: '#6fd8ec' },
  mecanismo: { label: 'Mecanismo', color: '#b3a4f2' },
  pieza:     { label: 'Pieza',     color: '#9fb0cc' },
};

/** Infiere el tipo por el nombre (biblioteca sin metadato de tipo aún). */
export function inferType(name: string): ProjType {
  const n = name.toLowerCase();
  if (/molde|flaner|percha|tapa|vaso|tupper|bezel|jabon|cavidad|inyecc|copa|lid/.test(n)) return 'molde';
  if (/brazo|robot|eslab|gripper|garra|actuad/.test(n)) return 'robot';
  if (/cicloid|reductor|engran|mecanism|gearbox|leva|biela|piñ|pinon|caja/.test(n)) return 'mecanismo';
  return 'pieza';
}

function Glyph({ type }: { type: ProjType }) {
  const s = { width: 46, height: 46, color: 'var(--pc)' } as const;
  if (type === 'robot') return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" style={s}>
      <circle cx="12" cy="36" r="4" /><path d="M12 36 L22 20" /><circle cx="22" cy="20" r="3.4" />
      <path d="M22 20 L36 14" /><circle cx="36" cy="14" r="3" /><path d="M36 14 l6 4" /></svg>);
  if (type === 'mecanismo') return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2} style={s}>
      <circle cx="24" cy="24" r="13" /><circle cx="24" cy="24" r="4.5" />
      <path d="M24 11v-4M24 37v4M11 24h-4M37 24h4M15 15l-3-3M33 33l3 3M33 15l3-3M15 33l-3 3" /></svg>);
  if (type === 'molde') return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" style={s}>
      <path d="M10 18 L24 11 L38 18 L38 32 L24 39 L10 32 Z" />
      <path d="M10 18 L24 25 L38 18 M24 25 L24 39" opacity=".5" /></svg>);
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" style={s}>
      <path d="M12 16 L24 10 L36 16 L36 30 L24 36 L12 30 Z" /></svg>);
}

const CSS = `
.ps-scrim{position:fixed;inset:46px 0 0 0;z-index:44;background:rgba(4,8,14,.52);backdrop-filter:blur(2px);animation:ps-fade .16s ease}
@keyframes ps-fade{from{opacity:0}to{opacity:1}}
.ps-panel{position:fixed;z-index:45;top:52px;left:12px;width:min(720px,calc(100vw - 24px));
  max-height:calc(100vh - 66px);display:flex;flex-direction:column;
  background:var(--ds-panel,#0F1725);border:1px solid var(--ds-line2,rgba(140,180,255,.22));border-radius:14px;
  box-shadow:0 30px 70px rgba(0,0,0,.6);overflow:hidden;animation:ps-drop .18s ease}
@keyframes ps-drop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.ps-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--ds-line,rgba(140,180,255,.1))}
.ps-head h2{margin:0;font-size:14px;font-weight:700;letter-spacing:.02em;color:var(--ds-text,#DCE7F5)}
.ps-head h2 span{color:var(--ds-faint,#7E90A9);font-weight:500}
.ps-sp{flex:1}
.ps-find{display:flex;align-items:center;gap:7px;background:var(--ds-panel2,#16202F);border:1px solid var(--ds-line,rgba(140,180,255,.1));
  border-radius:9px;padding:7px 11px;color:var(--ds-faint,#7E90A9);font-size:12.5px;min-width:150px}
.ps-find input{all:unset;color:var(--ds-text,#DCE7F5);width:100%;font-family:inherit}
.ps-new{border:0;cursor:pointer;background:linear-gradient(150deg,#FDB813,#d1930b);color:#1a1206;
  font-weight:700;font-size:12.5px;padding:8px 13px;border-radius:9px;white-space:nowrap}
.ps-new:hover{filter:brightness(1.06)}
.ps-types{display:flex;gap:7px;padding:11px 16px 0;flex-wrap:wrap}
.ps-types button{font-size:12px;cursor:pointer;padding:6px 12px;border-radius:20px;font-weight:600;
  border:1px solid var(--ds-line,rgba(140,180,255,.1));color:var(--ds-dim,#A6B4C8);background:transparent;
  display:inline-flex;gap:7px;align-items:center;font-family:inherit}
.ps-types button.on{background:var(--ds-raise,#1D2A3D);color:var(--ds-text,#DCE7F5);border-color:var(--ds-line2,rgba(140,180,255,.22))}
.ps-types button i{width:7px;height:7px;border-radius:2px;display:inline-block}
.ps-sec{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ds-faint,#7E90A9);
  font-weight:700;padding:14px 16px 2px;grid-column:1/-1}
.ps-list{padding:6px 16px 16px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:11px}
.ps-card{display:flex;gap:12px;padding:11px;border:1px solid var(--ds-line,rgba(140,180,255,.1));border-radius:11px;
  cursor:pointer;background:var(--ds-panel2,#16202F);text-align:left;font-family:inherit;
  transition:border-color .12s ease,transform .12s ease,background .12s}
.ps-card:hover{border-color:var(--ds-line2,rgba(140,180,255,.22));transform:translateY(-2px)}
.ps-card.cur{border-color:rgba(111,216,236,.55);background:rgba(111,216,236,.09)}
.ps-thumb{width:60px;height:60px;flex:0 0 auto;border-radius:9px;display:grid;place-items:center;
  border:1px solid var(--ds-line,rgba(140,180,255,.1));
  background:radial-gradient(58px 44px at 50% 40%,color-mix(in srgb,var(--pc) 24%,transparent),transparent 72%),#070d16}
.ps-info{min-width:0;display:flex;flex-direction:column;gap:1px}
.ps-tag{font-size:9.5px;letter-spacing:.14em;font-weight:700;text-transform:uppercase;display:inline-flex;align-items:center;gap:5px;color:var(--tc)}
.ps-tag i{width:6px;height:6px;border-radius:2px;background:var(--tc);display:inline-block}
.ps-name{font-size:14px;font-weight:700;letter-spacing:-.01em;margin:1px 0 0;color:var(--ds-text,#DCE7F5);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ps-meta{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:var(--ds-dim,#A6B4C8);
  font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ps-foot{font-size:10.5px;color:var(--ds-faint,#7E90A9);margin-top:3px;display:flex;align-items:center;gap:6px}
.ps-foot .d{width:6px;height:6px;border-radius:50%}
.ps-add{align-items:center;justify-content:center;border-style:dashed;background:transparent;gap:9px;color:var(--ds-dim,#A6B4C8)}
.ps-add:hover{border-color:#FDB813;color:var(--ds-text,#DCE7F5)}
.ps-add .p{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:color-mix(in srgb,#FDB813 15%,transparent);color:#FDB813;font-size:22px;flex:0 0 auto}
.ps-add small{display:block;color:var(--ds-faint,#7E90A9);font-size:10.5px;margin-top:1px}
.ps-empty{grid-column:1/-1;color:var(--ds-faint,#7E90A9);font-size:12.5px;padding:14px 2px;text-align:center}
.ps-panel.wide{width:min(1040px,calc(100vw - 24px))}
.ps-tabs{display:flex;gap:2px;background:var(--ds-panel2,#16202F);border:1px solid var(--ds-line,rgba(140,180,255,.1));border-radius:9px;padding:3px}
.ps-tabs button{all:unset;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;letter-spacing:.01em;padding:6px 12px;border-radius:7px;color:var(--ds-faint,#7E90A9)}
.ps-tabs button span{color:var(--ds-faint,#7E90A9);font-weight:500;margin-left:5px}
.ps-tabs button.on{background:var(--ds-raise,#1D2A3D);color:var(--ds-text,#DCE7F5)}
.ps-tabs button.on span{color:#FDB813}
/* ── TEMIS ── */
.tm{padding:10px 16px 14px;overflow:auto;display:flex;flex-direction:column;gap:10px}
.tm-viol{border:1px solid rgba(242,122,108,.55);background:rgba(242,122,108,.10);color:#f8b4aa;border-radius:9px;padding:9px 12px;font-size:12.5px;font-weight:600;display:flex;flex-direction:column;gap:3px}
.tm-cols{display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px;align-items:start}
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
.tm-gal{display:grid;grid-template-columns:1fr;gap:12px}
.tm-gal figure{margin:0;border:1px solid var(--ds-line,rgba(140,180,255,.1));border-radius:10px;overflow:hidden;background:#070d16}
.tm-gal img{display:block;width:100%;height:auto}
.tm-gal figcaption{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:var(--ds-dim,#A6B4C8);padding:7px 10px;border-top:1px solid var(--ds-line,rgba(140,180,255,.1))}
.tm code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;color:var(--ds-dim,#A6B4C8)}
`;

function Card({ p, onPick }: { p: ProjItem; onPick: (p: ProjItem) => void }) {
  const t = TYPE[p.type];
  return (
    <button className={`ps-card ${p.current ? 'cur' : ''}`} data-testid={`ps-open-${p.key}`}
      style={{ ['--pc' as any]: t.color, ['--tc' as any]: t.color }}
      onClick={() => onPick(p)} title={`Abrir "${p.name}"`}>
      <div className="ps-thumb"><Glyph type={p.type} /></div>
      <div className="ps-info">
        <span className="ps-tag"><i />{t.label}</span>
        <p className="ps-name">{p.name}</p>
        {p.meta && <p className="ps-meta">{p.meta}</p>}
        {p.status && <p className="ps-foot"><span className="d" style={{ background: p.statusColor ?? t.color }} />{p.status}</p>}
      </div>
    </button>
  );
}

export default function ProjectSwitcher({ open, onClose, projects, starters, onNew, onPick }: {
  open: boolean;
  onClose: () => void;
  projects: ProjItem[];
  starters: ProjItem[];
  onNew: () => void;
  onPick: (p: ProjItem) => void;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<ProjType | 'todos'>('todos');
  // TEMIS: la pestaña del tablero. Se lee al abrirla (JSON generado en el repo).
  const [view, setView] = useState<'proyectos' | 'temis'>('proyectos');
  const [temis, setTemis] = useState<TemisJson | null | { error: true }>(null);
  useEffect(() => {
    if (!open || view !== 'temis' || temis) return;
    fetch('temis.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: TemisJson) => setTemis(j))
      .catch(() => setTemis({ error: true }));
  }, [open, view, temis]);
  if (!open) return null;
  const match = (p: ProjItem) =>
    (filter === 'todos' || p.type === filter) &&
    (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const pj = projects.filter(match);
  const st = starters.filter(match);
  const pick = (p: ProjItem) => { onPick(p); onClose(); };

  return (
    <>
      <style>{CSS}</style>
      <div className="ps-scrim" data-testid="ps-scrim" onClick={onClose} />
      <div className={`ps-panel ${view === 'temis' ? 'wide' : ''}`} role="dialog" aria-label="Proyectos" data-testid="project-switcher">
        <div className="ps-head">
          <div className="ps-tabs" role="tablist">
            <button role="tab" className={view === 'proyectos' ? 'on' : ''} data-testid="ps-tab-proyectos" onClick={() => setView('proyectos')}>
              Proyectos<span>{projects.length}</span>
            </button>
            <button role="tab" className={view === 'temis' ? 'on' : ''} data-testid="ps-tab-temis" onClick={() => setView('temis')}
              title="TEMIS — el tablero de órdenes: próximo ≤7 · en curso ≤1 · cerrado. La orden es el ticket.">
              Temis{temis && !('error' in temis) && <span>{temis.conteo.enCurso}/{temis.wip.enCurso} · {temis.conteo.proximo}/{temis.wip.proximo}</span>}
            </button>
          </div>
          <div className="ps-sp" />
          {view === 'proyectos' && (
            <label className="ps-find">🔍<input data-testid="ps-search" value={q} autoFocus
              placeholder="Buscar…" onChange={(e) => setQ(e.target.value)} /></label>
          )}
          <button className="ps-new" data-testid="ps-new" onClick={() => { onNew(); onClose(); }}>＋ Nuevo</button>
        </div>
        {view === 'temis' && <TemisBoard data={temis} />}
        {view === 'proyectos' && (<>
        <div className="ps-types">
          {(['todos', 'molde', 'robot', 'mecanismo'] as const).map((t) => (
            <button key={t} className={filter === t ? 'on' : ''} data-testid={`ps-filter-${t}`}
              onClick={() => setFilter(t)}>
              {t !== 'todos' && <i style={{ background: TYPE[t as ProjType].color }} />}
              {t === 'todos' ? 'Todos' : TYPE[t as ProjType].label + 's'}
            </button>
          ))}
        </div>
        <div className="ps-list">
          {pj.length > 0 && <div className="ps-sec">Tus proyectos</div>}
          {pj.map((p) => <Card key={p.key} p={p} onPick={pick} />)}
          {pj.length === 0 && projects.length === 0 && (
            <div className="ps-empty">Aún no guardas proyectos — empieza de una plantilla 👇</div>
          )}
          {st.some((p) => p.section !== 'banco') && <div className="ps-sec">Empezar de</div>}
          {st.filter((p) => p.section !== 'banco').map((p) => <Card key={p.key} p={p} onPick={pick} />)}
          {st.some((p) => p.section === 'banco') && <div className="ps-sec" data-testid="ps-sec-banco">Banco de pruebas · validación del solver</div>}
          {st.filter((p) => p.section === 'banco').map((p) => <Card key={p.key} p={p} onPick={pick} />)}
          <button className="ps-card ps-add" data-testid="ps-blank" onClick={() => { onNew(); onClose(); }}>
            <div className="p">＋</div>
            <div><b>En blanco</b><small>Molde · Robot · Mecanismo</small></div>
          </button>
        </div>
        </>)}
      </div>
    </>
  );
}
