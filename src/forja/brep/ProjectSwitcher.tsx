/**
 * ProjectSwitcher — el LOBBY integrado de La Forja. NO es página aparte: baja del
 * título de la barra, sobre el estudio atenuado, una sola pantalla, la pieza detrás.
 * UNIVERSAL: moldes, robots y mecanismos (no solo moldes). El estudio le pasa la
 * lista (biblioteca + plantillas) ya con su tipo y acción; esto sólo la pinta.
 */
import { useState } from 'react';

export type ProjType = 'molde' | 'robot' | 'mecanismo' | 'pieza';

import { TemisBoard, useTemis, TEMIS_CSS } from './TemisBoard';
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
  const temis = useTemis(open && view === 'temis');   // TEMIS = módulo compartido con comando.html
  if (!open) return null;
  const match = (p: ProjItem) =>
    (filter === 'todos' || p.type === filter) &&
    (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const pj = projects.filter(match);
  const st = starters.filter(match);
  const pick = (p: ProjItem) => { onPick(p); onClose(); };

  return (
    <>
      <style>{CSS}{TEMIS_CSS}</style>
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
