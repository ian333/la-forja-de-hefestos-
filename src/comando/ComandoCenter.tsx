/**
 * ComandoCenter — el CENTRO DE COMANDO de La Forja / GAIA.
 *
 * Panel de operador (privado) que organiza TODO el material, sin servicios nuevos:
 *   1) PRODUCCIÓN — estado de las clases Nobel (escena/voz/9:16/16:9).
 *   2) TELEMETRÍA — usuarios reales (sesiones, pageviews, clicks, top páginas).
 *   3) PUBLICAR — gestor de las 232 PIEZAS publicables (curadas de los 493 archivos):
 *      por pieza: ▶ver/⬇bajar cada formato · título/descripción/hashtags con 📋copiar ·
 *      estado de subida POR PLATAFORMA (TikTok·IG·YT·X·FB·LinkedIn) ✓+fecha.
 *      Vistas de trabajo: HOY, pendientes por plataforma, progreso. El registro
 *      (ediciones + qué se subió) PERSISTE en el servidor (/api/telemetry/registro,
 *      con fallback a localStorage).
 *
 * Datos: nobel-catalog/registry (directo) + produccion.json + catalogo.json.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { NOBEL_CATALOG, type NobelLaureate } from '@/economia/nobel-catalog';
import { CINE_CLASES } from '@/economia/labs/registry';

const GOLD = '#FDB813';
const VIDEO_BASE = '/biblioteca/';
const REG_API = '/api/telemetry/registro';      // persistencia server-side (proxy nginx → telemetry)
const REG_LS = 'comando_registro_v2';

const PLATAFORMAS = [
  { k: 'tiktok', n: 'TikTok', c: '#25F4EE' },
  { k: 'ig', n: 'Instagram', c: '#E1306C' },
  { k: 'yt', n: 'YouTube', c: '#FF0000' },
  { k: 'x', n: 'X', c: '#9AA0A6' },
  { k: 'fb', n: 'Facebook', c: '#1877F2' },
  { k: 'li', n: 'LinkedIn', c: '#0A66C2' },
];
const FAMILIAS: Record<string, string> = { tutorial: '🎬 Videotutoriales', clase: '🎓 Clases', atomo: '⚛️ Átomos', molecula: '🧪 Moléculas', adn: '🧬 ADN', astro: '🌌 Astro', otro: '📦 Otros' };

interface Piece { id: string; familia: string; tema: string; titulo: string; descripcion: string; hashtags: string[]; formatos: Record<string, string>; guion?: string; codigo?: string; ts?: number; }
interface Cat { pieces: Piece[]; generatedAt: string; }
interface Video { serie: string; name: string; fmt: string; master: boolean; mb: number; rel: string; }
interface Limpio { sesiones: number; descartadas: number; c1_segunda_pagina: number; mediana_s: number; p75_s: number; p90_s: number; rebote_3s_pct: number; movil_pct: number; inapp_pct: number; clicks_por_sesion: number; entradas: Record<string, number>; }
interface Prod { videos: Video[]; narracion: Record<string, { narration: boolean; aligned: boolean }>; telemetria: { connected: boolean; sessions?: number; pageviews?: number; clicks?: number; errors?: number; topPages?: { u: string; n: number }[]; limpio?: Limpio; origen?: Record<string, number>; ipsSospechosas?: { ip: string; sesiones: number; escritorio: number }[] }; generatedAt: string; }

// registro por pieza (editable + persistido)
interface Reg { titulo?: string; descripcion?: string; hashtags?: string; plataformas?: Record<string, { subido?: boolean; fecha?: string }>; }
type Registro = Record<string, Reg>;

// cadencia (calendario de subida sugerido)
interface Slot { dia: number; familia: string; pieceId: string; titulo: string; plataformas: string[]; gancho: boolean; }
interface SemSlot { semana: number; pieceId: string; titulo: string; plataforma: string; }
interface Cadencia { slots: Slot[]; semanal: SemSlot[]; pauta: string; generatedAt: string; }

// calidad (clasificador automático de videos — sin GPU)
interface QItem { id: string; familia: string; titulo: string; file: string; rel: string | null; score: number; grade: string; sub: { gancho: number; vida: number; expo: number; color: number }; flags: string[]; raw: Record<string, number>; frames: number; enCatalogo: boolean; variantes: number; }
interface Calidad { items: QItem[]; count: number; resumen: Record<string, number>; porFamilia: Record<string, { n: number; media: number }>; generatedAt: string; }
const GRADE_C: Record<string, string> = { S: '#FDB813', A: '#34D399', B: '#46C2FF', C: '#F59E0B', D: '#EF4444' };
const chip = (active: boolean, color = '#FDB813'): CSSProperties => ({ padding: '5px 11px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: active ? color : 'transparent', color: active ? '#06070D' : '#8893A8', border: '1px solid ' + (active ? color : 'rgba(255,255,255,0.12)'), fontWeight: 600 });

const FAM_EMOJI: Record<string, string> = { astro: '🌌', atomo: '⚛️', molecula: '🧪', adn: '🧬', economia: '🎓', clase: '🎓', tutorial: '🎬' };
const SHORT_KEYS = ['tiktok', 'ig', 'yt'];        // las 3 redes cortas del Short diario

function Stat({ n, label, color = GOLD }: { n: string | number; label: string; color?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 18px', minWidth: 120 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, fontFamily: "'Outfit',sans-serif" }}>{n}</div>
      <div style={{ fontSize: 11, color: '#8893A8', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  );
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); }); }}
      style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: ok ? '#34D399' : 'rgba(255,255,255,0.06)', color: ok ? '#06070D' : '#B8C2D6', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {ok ? '✓ copiado' : `📋 ${label}`}
    </button>
  );
}

export default function ComandoCenter() {
  const [prod, setProd] = useState<Prod | null>(null);
  const [cat, setCat] = useState<Cat | null>(null);
  const [tut, setTut] = useState<Cat | null>(null);   // videotutoriales del ERP (archivo aparte, no toca la ciencia)
  const [cad, setCad] = useState<Cadencia | null>(null);
  const [cal, setCal] = useState<Calidad | null>(null);
  const [calFam, setCalFam] = useState('todas');
  const [calGrade, setCalGrade] = useState('todos');
  const [calFlag, setCalFlag] = useState(false);
  const [registro, setRegistro] = useState<Registro>({});
  const [tab, setTab] = useState<'publicar' | 'cad' | 'calidad' | 'prod' | 'tele'>('publicar');
  const [inicio, setInicio] = useState<string>(() => { try { return localStorage.getItem('comando_cad_inicio') || new Date().toISOString().slice(0, 10); } catch { return new Date().toISOString().slice(0, 10); } });
  const [familia, setFamilia] = useState<string>('todas');
  const [pendiente, setPendiente] = useState<string>('');   // plataforma k para filtrar pendientes
  const [busca, setBusca] = useState('');
  const [reproducir, setReproducir] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  // scroll: el CSS global pone overflow hidden; lo reactivamos aquí
  useEffect(() => {
    const h = document.documentElement, b = document.body;
    const p = { ho: h.style.overflow, bo: b.style.overflow, hh: h.style.height, bh: b.style.height };
    h.style.overflow = 'auto'; b.style.overflow = 'auto'; h.style.height = 'auto'; b.style.height = 'auto';
    return () => { h.style.overflow = p.ho; b.style.overflow = p.bo; h.style.height = p.hh; b.style.height = p.bh; };
  }, []);

  useEffect(() => {
    fetch('/comando/produccion.json').then(r => r.json()).then(setProd).catch(() => setProd({ videos: [], narracion: {}, telemetria: { connected: false }, generatedAt: '' }));
    fetch('/comando/catalogo.json').then(r => r.json()).then(setCat).catch(() => setCat({ pieces: [], generatedAt: '' }));
    fetch('/comando/videotutoriales.json').then(r => r.json()).then(setTut).catch(() => setTut({ pieces: [], generatedAt: '' }));
    fetch('/comando/cadencia.json').then(r => r.json()).then(setCad).catch(() => setCad({ slots: [], semanal: [], pauta: '', generatedAt: '' }));
    fetch('/comando/calidad.json').then(r => r.json()).then(setCal).catch(() => setCal(null));
    // registro: MEZCLA server + localStorage (nunca clobberar tus marcas con un
    // server vacío). Si el server está vacío pero localStorage tiene marcas, SIEMBRA
    // el server. (Antes: server {} → setRegistro({}) borraba todo en pantalla.)
    let ls: Registro = {};
    try { ls = JSON.parse(localStorage.getItem(REG_LS) || '{}'); } catch { ls = {}; }
    fetch(REG_API).then(r => r.ok ? r.json() : Promise.reject()).then(j => {
      const server = (j && typeof j === 'object') ? j as Registro : {};
      const merged = { ...ls, ...server };   // server gana en conflicto; localStorage rellena
      setRegistro(merged);
      if (Object.keys(server).length === 0 && Object.keys(ls).length > 0) {
        fetch(REG_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(merged) }).catch(() => {});
      }
    }).catch(() => setRegistro(ls));
  }, []);

  // guardar (debounce) → server + localStorage
  const persist = (next: Registro) => {
    try { localStorage.setItem(REG_LS, JSON.stringify(next)); } catch { /* */ }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      fetch(REG_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
    }, 800);
  };
  const setReg = (id: string, patch: Reg) => {
    setRegistro(prev => {
      const cur = prev[id] || {};
      const next = { ...prev, [id]: { ...cur, ...patch, plataformas: { ...cur.plataformas, ...patch.plataformas } } };
      persist(next); return next;
    });
  };
  const togglePlat = (id: string, k: string) => {
    setRegistro(prev => {
      const cur = prev[id] || {}; const pl = { ...(cur.plataformas || {}) };
      const was = pl[k]?.subido;
      pl[k] = was ? { subido: false } : { subido: true, fecha: new Date().toISOString().slice(0, 10) };
      const next = { ...prev, [id]: { ...cur, plataformas: pl } };
      persist(next); return next;
    });
  };
  // marcar varias plataformas a la vez (el Short del día = TikTok+IG+YT)
  const marcarVarias = (id: string, keys: string[]) => {
    const f = new Date().toISOString().slice(0, 10);
    setRegistro(prev => {
      const cur = prev[id] || {}; const pl = { ...(cur.plataformas || {}) };
      const todasYa = keys.every(k => pl[k]?.subido);
      for (const k of keys) pl[k] = todasYa ? { subido: false } : { subido: true, fecha: f };
      const next = { ...prev, [id]: { ...cur, plataformas: pl } };
      persist(next); return next;
    });
  };
  const fijarInicio = (d: string) => { setInicio(d); try { localStorage.setItem('comando_cad_inicio', d); } catch { /* */ } };

  // pieza efectiva (catálogo + overrides del registro)
  const eff = (p: Piece) => {
    const r = registro[p.id] || {};
    return {
      ...p,
      titulo: r.titulo ?? p.titulo,
      descripcion: r.descripcion ?? p.descripcion,
      hashtags: r.hashtags ?? p.hashtags.join(' '),
      plat: r.plataformas || {},
    };
  };

  const pieces = useMemo(() => [...(tut?.pieces || []), ...(cat?.pieces || [])], [cat, tut]);
  const filtradas = useMemo(() => {
    return pieces.filter(p => {
      if (familia !== 'todas' && p.familia !== familia) return false;
      if (busca && !(p.titulo + ' ' + p.tema).toLowerCase().includes(busca.toLowerCase())) return false;
      if (pendiente && (registro[p.id]?.plataformas?.[pendiente]?.subido)) return false;
      return true;
    // LO MÁS RECIENTE ARRIBA. `ts` = mtime del archivo en la biblioteca, o sea cuándo se
    // publicó ESA versión — así que re-publicar una pieza la vuelve a subir al tope, que es
    // justo lo que se quiere cuando se re-renderiza algo viejo. Antes listaba en orden de
    // catálogo y una pieza recién hecha quedaba enterrada entre 118 átomos (le pasó a Ian
    // con el cromo el 2026-08-12: publicado, en vivo, e imposible de encontrar).
    }).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }, [pieces, familia, busca, pendiente, registro]);

  // progreso por plataforma
  const progreso = useMemo(() => PLATAFORMAS.map(pl => {
    const n = pieces.filter(p => registro[p.id]?.plataformas?.[pl.k]?.subido).length;
    return { ...pl, n, total: pieces.length };
  }), [pieces, registro]);

  // hoy
  const hoy = new Date().toISOString().slice(0, 10);
  const subidasHoy = useMemo(() => {
    const out: { piece: Piece; plats: string[] }[] = [];
    for (const p of pieces) {
      const pl = registro[p.id]?.plataformas || {};
      const ks = Object.keys(pl).filter(k => pl[k].subido && pl[k].fecha === hoy);
      if (ks.length) out.push({ piece: p, plats: ks });
    }
    return out;
  }, [pieces, registro, hoy]);

  // mapa id→pieza (para que la cadencia jale formatos/copy reales del catálogo)
  const pieceById = useMemo(() => { const m: Record<string, Piece> = {}; for (const p of pieces) m[p.id] = p; return m; }, [pieces]);
  // qué día de la pista vamos (relativo a la fecha de inicio fijada)
  const diaActual = Math.floor((Date.parse(hoy) - Date.parse(inicio)) / 86400000) + 1;

  if (!cat || !prod) return <div style={{ minHeight: '100vh', background: '#06070D', color: '#8893A8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>cargando comando…</div>;

  // ── producción (clases) ──
  const slugOf = (p: NobelLaureate) => { const id = (p.classId || p.id || '').toLowerCase(); return ['romer', 'coase', 'ostrom', 'acemoglu', 'krugman', 'limones'].find(k => id.includes(k)) || null; };
  const prodRows = NOBEL_CATALOG.map(p => {
    const cid = p.classId || p.id; const slug = slugOf(p);
    return { p, escena: CINE_CLASES.has(cid), narr: slug ? !!prod.narracion[slug] : false, vids: slug ? prod.videos.filter(v => v.serie === `economia/clases/${slug}`) : [] };
  });
  const liveCount = prodRows.filter(r => r.p.status === 'live').length;
  const tele = prod.telemetria;
  const totalSubidos = pieces.filter(p => Object.values(registro[p.id]?.plataformas || {}).some(x => x.subido)).length;

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 0%, #0c1020 0%, #06070D 70%)', color: '#E2E8F0', fontFamily: "'Outfit','Inter',system-ui,sans-serif", paddingBottom: 90 }}>
      {/* HEADER */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(6,7,13,0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 21, fontWeight: 800 }}>GAIA <span style={{ color: GOLD }}>· Centro de Comando</span></span>
          <span style={{ fontSize: 11, color: '#5A6678', fontFamily: 'monospace' }}>{cat.pieces.length} piezas · {cat.generatedAt || '—'}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {([['publicar', '📤 Publicar'], ['cad', '📅 Cadencia'], ['calidad', '🏆 Calidad'], ['prod', '🎬 Producción'], ['tele', '📊 Telemetría']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === k ? GOLD : 'rgba(255,255,255,0.05)', color: tab === k ? '#06070D' : '#B8C2D6', border: '1px solid ' + (tab === k ? GOLD : 'rgba(255,255,255,0.08)') }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '22px 24px' }}>
        {/* ═══ PUBLICAR ═══ */}
        {tab === 'publicar' && (
          <>
            {/* progreso por plataforma */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
              <Stat n={`${totalSubidos}/${pieces.length}`} label="piezas publicadas" color="#34D399" />
              {progreso.map(pr => (
                <div key={pr.k} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px', minWidth: 88 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: pr.c }}>{pr.n}<span style={{ color: '#5A6678', fontWeight: 400 }}>/{pr.total}</span></div>
                  <div style={{ fontSize: 10, color: '#8893A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>{pr.n}</div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}><div style={{ width: `${(pr.n / Math.max(1, pr.total)) * 100}%`, height: '100%', background: pr.c }} /></div>
                  <div style={{ fontSize: 10, color: '#6B7689', marginTop: 4 }}>{pr.n}</div>
                </div>
              ))}
            </div>

            {/* hoy */}
            {subidasHoy.length > 0 && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(253,184,19,0.08)', border: '1px solid rgba(253,184,19,0.3)', borderRadius: 10 }}>
                <b style={{ color: GOLD, fontSize: 13 }}>📅 Subido HOY ({subidasHoy.length})</b>
                {subidasHoy.map(s => <div key={s.piece.id} style={{ fontSize: 12, marginTop: 3 }}>• {eff(s.piece).titulo} → {s.plats.join(', ')}</div>)}
              </div>
            )}

            {/* filtros */}
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
              <input placeholder="🔎 buscar…" value={busca} onChange={e => setBusca(e.target.value)} style={{ background: 'rgba(0,0,0,0.3)', color: '#E2E8F0', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, fontSize: 12, padding: '5px 10px', width: 150 }} />
              <button onClick={() => setFamilia('todas')} style={{ padding: '5px 11px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: familia === 'todas' ? 'rgba(253,184,19,0.15)' : 'transparent', color: familia === 'todas' ? GOLD : '#8893A8', border: '1px solid rgba(255,255,255,0.08)' }}>Todas</button>
              {Object.entries(FAMILIAS).filter(([k]) => pieces.some(p => p.familia === k)).map(([k, l]) => (
                <button key={k} onClick={() => setFamilia(k)} style={{ padding: '5px 11px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: familia === k ? 'rgba(253,184,19,0.15)' : 'transparent', color: familia === k ? GOLD : '#8893A8', border: '1px solid rgba(255,255,255,0.08)' }}>{l} {pieces.filter(p => p.familia === k).length}</button>
              ))}
              <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
              <span style={{ fontSize: 11, color: '#6B7689' }}>falta en:</span>
              {PLATAFORMAS.map(pl => (
                <button key={pl.k} onClick={() => setPendiente(pendiente === pl.k ? '' : pl.k)} style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: pendiente === pl.k ? pl.c : 'transparent', color: pendiente === pl.k ? '#06070D' : pl.c, border: `1px solid ${pl.c}66`, fontWeight: 600 }}>{pl.n}</button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: '#6B7689', marginBottom: 12 }}>{filtradas.length} piezas</div>

            {/* piezas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtradas.slice(0, 300).map(p => {
                const e = eff(p);
                const fmts = Object.entries(p.formatos);
                return (
                  <div key={p.id} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: '12px 14px' }}>
                    {/* título + formatos */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input value={e.titulo} onChange={ev => setReg(p.id, { titulo: ev.target.value })} style={{ flex: '1 1 240px', minWidth: 0, fontSize: 14, fontWeight: 700, color: '#fff', background: 'transparent', border: 'none', borderBottom: '1px solid transparent', outline: 'none' }} onFocus={ev => ev.target.style.borderBottom = '1px solid ' + GOLD} onBlur={ev => ev.target.style.borderBottom = '1px solid transparent'} />
                      {fmts.map(([k, rel]) => (
                        <span key={k} style={{ display: 'inline-flex', gap: 4 }}>
                          <button onClick={() => setReproducir(reproducir === rel ? null : rel)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, cursor: 'pointer', background: 'rgba(253,184,19,0.15)', color: GOLD, border: '1px solid rgba(253,184,19,0.4)', fontWeight: 600 }}>▶ {k}</button>
                          <a href={VIDEO_BASE + rel} download style={{ fontSize: 11, padding: '3px 7px', borderRadius: 5, background: 'rgba(70,194,255,0.12)', color: '#46C2FF', border: '1px solid rgba(70,194,255,0.3)', textDecoration: 'none', fontWeight: 600 }}>⬇</a>
                        </span>
                      ))}
                      {/* cápsula reproducible: código+scripts+simulación .bin+guion+audio+receta
                          exacta del render — para NUNCA volver a perder un video (lección O₂) */}
                      {p.codigo && (
                        <a href={VIDEO_BASE + p.codigo} download title="Cápsula reproducible: código + simulación + guion + receta del render"
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'rgba(126,231,135,0.12)', color: '#7EE787', border: '1px solid rgba(126,231,135,0.35)', textDecoration: 'none', fontWeight: 600 }}>⚙ código</a>
                      )}
                    </div>
                    {fmts.map(([, rel]) => reproducir === rel && (
                      <video key={rel} src={VIDEO_BASE + rel} controls autoPlay style={{ width: '100%', maxWidth: /916|9.16|vertical/.test(rel) ? 300 : 560, borderRadius: 8, marginBottom: 10, background: '#000', display: 'block' }} />
                    ))}
                    {/* descripción */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 7 }}>
                      <textarea value={e.descripcion} onChange={ev => setReg(p.id, { descripcion: ev.target.value })} rows={2} style={{ flex: 1, fontSize: 12, color: '#C7D0E0', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 9px', resize: 'vertical', fontFamily: 'inherit' }} />
                      <CopyBtn text={e.descripcion} label="desc" />
                    </div>
                    {/* hashtags */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 9 }}>
                      <input value={e.hashtags} onChange={ev => setReg(p.id, { hashtags: ev.target.value })} style={{ flex: 1, fontSize: 12, color: '#7Fd0ff', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '5px 9px', fontFamily: 'monospace' }} />
                      <CopyBtn text={e.hashtags} label="tags" />
                      <CopyBtn text={`${e.titulo}\n\n${e.descripcion}\n\n${e.hashtags}`} label="TODO" />
                    </div>
                    {/* guion — solo videotutoriales */}
                    {p.guion && (
                      <div style={{ marginBottom: 9 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: GOLD, fontWeight: 600 }}>🎬 Guion <span style={{ fontSize: 10, color: '#6B7689' }}>(grábalo o pégalo a ElevenLabs)</span></span>
                          <CopyBtn text={p.guion} label="guion" />
                        </div>
                        <details>
                          <summary style={{ cursor: 'pointer', fontSize: 11, color: '#8893A8' }}>ver / ocultar</summary>
                          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11.5, color: '#C7D0E0', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '9px 11px', marginTop: 7, fontFamily: 'inherit', lineHeight: 1.5 }}>{p.guion}</pre>
                        </details>
                      </div>
                    )}
                    {/* plataformas */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {PLATAFORMAS.map(pl => {
                        const st = e.plat[pl.k];
                        return (
                          <button key={pl.k} onClick={() => togglePlat(p.id, pl.k)} title={st?.fecha || ''} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, background: st?.subido ? pl.c : 'rgba(255,255,255,0.04)', color: st?.subido ? '#06070D' : '#8893A8', border: `1px solid ${st?.subido ? pl.c : 'rgba(255,255,255,0.1)'}` }}>
                            {st?.subido ? '✓ ' : ''}{pl.n}{st?.subido && st.fecha ? ` ·${st.fecha.slice(5)}` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ═══ CALIDAD (clasificador automático) ═══ */}
        {tab === 'calidad' && (
          !cal ? (
            <div style={{ color: '#8893A8', fontSize: 13, padding: '20px 0' }}>
              Sin datos del clasificador todavía. Corre <code style={{ color: GOLD }}>node scripts/comando-calidad.cjs</code> para generar <code style={{ color: GOLD }}>calidad.json</code>.
            </div>
          ) : (() => {
            const fams = ['todas', ...Object.keys(cal.porFamilia)];
            const items = cal.items.filter(it =>
              (calFam === 'todas' || it.familia === calFam) &&
              (calGrade === 'todos' || it.grade === calGrade) &&
              (!calFlag || it.flags.length > 0));
            return (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <Stat n={cal.count} label="videos calificados" />
                  {['S', 'A', 'B', 'C', 'D'].map(g => <Stat key={g} n={cal.resumen[g] || 0} label={`grado ${g}`} color={GRADE_C[g]} />)}
                </div>
                <div style={{ fontSize: 11, color: '#6B7689', marginBottom: 12 }}>El clasificador califica sin GPU: <b style={{ color: '#B8C2D6' }}>gancho</b> (cold-open) · <b style={{ color: '#B8C2D6' }}>vida</b> (movimiento) · <b style={{ color: '#B8C2D6' }}>exposición</b> (sin quemar) · <b style={{ color: '#B8C2D6' }}>color</b> (saturación). {cal.generatedAt || ''}</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                  {fams.map(f => <button key={f} onClick={() => setCalFam(f)} style={chip(calFam === f)}>{f === 'todas' ? 'Todas' : `${FAM_EMOJI[f] || ''} ${f} ${cal.porFamilia[f].n}·~${cal.porFamilia[f].media}`}</button>)}
                  <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />
                  {['todos', 'S', 'A', 'B', 'C', 'D'].map(g => <button key={g} onClick={() => setCalGrade(g)} style={chip(calGrade === g, g === 'todos' ? GOLD : GRADE_C[g])}>{g}</button>)}
                  <button onClick={() => setCalFlag(v => !v)} style={chip(calFlag, '#EF4444')}>⚑ con defecto</button>
                </div>
                <div style={{ fontSize: 11, color: '#6B7689', marginBottom: 10 }}>{items.length} videos · ordenados por score (mejor primero)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.slice(0, 400).map((it, idx) => (
                    <div key={it.id} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: '10px 13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: '#5A6678', width: 28, textAlign: 'right', fontFamily: 'monospace' }}>#{idx + 1}</span>
                        <span style={{ width: 34, height: 34, borderRadius: 8, background: GRADE_C[it.grade] + '22', color: GRADE_C[it.grade], border: '1px solid ' + GRADE_C[it.grade], display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>{it.grade}</span>
                        <span style={{ fontSize: 22, fontWeight: 800, color: GRADE_C[it.grade], width: 36, textAlign: 'right' }}>{it.score}</span>
                        <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{FAM_EMOJI[it.familia] || '📦'} {it.titulo}</div>
                          <div style={{ fontSize: 10.5, color: '#6B7689', fontFamily: 'monospace' }}>{it.file}{it.variantes > 1 ? ` · ${it.variantes} versiones` : ''}{!it.enCatalogo ? ' · (sin catálogo)' : ''}</div>
                        </span>
                        <span style={{ display: 'flex', gap: 8 }}>
                          {([['G', 'gancho'], ['V', 'vida'], ['E', 'expo'], ['C', 'color']] as const).map(([lbl, k]) => (
                            <span key={k} title={k} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 9, color: '#6B7689' }}>{lbl}</div>
                              <div style={{ width: 30, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginTop: 2 }}><div style={{ width: `${it.sub[k]}%`, height: '100%', background: it.sub[k] >= 70 ? '#34D399' : it.sub[k] >= 50 ? '#F59E0B' : '#EF4444' }} /></div>
                              <div style={{ fontSize: 9, color: '#8893A8', marginTop: 1 }}>{it.sub[k]}</div>
                            </span>
                          ))}
                        </span>
                        {it.rel && <button onClick={() => setReproducir(reproducir === it.rel ? null : it.rel)} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 6, cursor: 'pointer', background: 'rgba(253,184,19,0.15)', color: GOLD, border: '1px solid rgba(253,184,19,0.4)', fontWeight: 600 }}>▶</button>}
                      </div>
                      {it.flags.length > 0 && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>{it.flags.map(fl => <span key={fl} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>⚑ {fl}</span>)}</div>}
                      {it.rel && reproducir === it.rel && <video src={VIDEO_BASE + it.rel} controls autoPlay style={{ width: '100%', maxWidth: 300, borderRadius: 8, marginTop: 9, background: '#000', display: 'block' }} />}
                    </div>
                  ))}
                </div>
              </>
            );
          })()
        )}

        {/* ═══ PRODUCCIÓN ═══ */}
        {tab === 'prod' && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              <Stat n={`${liveCount}/${NOBEL_CATALOG.length}`} label="clases producidas" />
              <Stat n={pieces.filter(p => p.familia === 'clase').length} label="con video" color="#34D399" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {prodRows.sort((a, b) => (b.p.status === 'live' ? 1 : 0) - (a.p.status === 'live' ? 1 : 0) || b.p.year - a.p.year).map(r => (
                <div key={r.p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 13px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#5A6678', width: 36 }}>{r.p.year}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.p.title}</div>
                    <div style={{ fontSize: 11, color: '#6B7689', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.p.laureates.join(', ')}</div>
                  </div>
                  {[['escena', r.escena], ['voz', r.narr], ['9:16', r.vids.some(v => v.fmt === '9:16')], ['16:9', r.vids.some(v => v.fmt === '16:9')]].map(([l, on]) => (
                    <span key={l as string} style={{ fontSize: 11, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 5, background: on ? 'rgba(52,211,153,0.16)' : 'rgba(255,255,255,0.05)', color: on ? '#34D399' : '#5A6678', border: `1px solid ${on ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.08)'}` }}>{on ? '✓' : '·'} {l as string}</span>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═══ CADENCIA ═══ */}
        {tab === 'cad' && cad && (() => {
          const slotForDia = (d: number) => cad.slots.length ? cad.slots[((d - 1) % cad.slots.length + cad.slots.length) % cad.slots.length] : null;
          const semanaActual = Math.max(1, Math.ceil(diaActual / 7));
          const futuros = Array.from({ length: 14 }, (_, i) => diaActual + i).filter(d => d >= 1);
          const slotHoy = diaActual >= 1 ? slotForDia(diaActual) : null;
          // fila de un slot: jala la pieza real, deja marcar las 3 redes de un jalón
          const Fila = ({ d, slot, hoy: esHoy }: { d: number; slot: Slot; hoy?: boolean }) => {
            const pz = pieceById[slot.pieceId];
            const e = pz ? eff(pz) : null;
            const pl = registro[slot.pieceId]?.plataformas || {};
            const hechas = SHORT_KEYS.filter(k => pl[k]?.subido).length;
            const fecha = new Date(Date.parse(inicio) + (d - 1) * 86400000).toISOString().slice(0, 10);
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: esHoy ? '14px 16px' : '9px 13px', background: esHoy ? 'rgba(253,184,19,0.1)' : 'rgba(255,255,255,0.025)', border: `1px solid ${esHoy ? 'rgba(253,184,19,0.45)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10 }}>
                <div style={{ textAlign: 'center', width: 46, flexShrink: 0 }}>
                  <div style={{ fontSize: esHoy ? 22 : 16, fontWeight: 800, color: esHoy ? GOLD : '#B8C2D6', lineHeight: 1 }}>{fecha.slice(8)}</div>
                  <div style={{ fontSize: 9, color: '#5A6678', textTransform: 'uppercase' }}>{['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+fecha.slice(5, 7) - 1]}</div>
                </div>
                <div style={{ fontSize: esHoy ? 26 : 19, flexShrink: 0 }}>{FAM_EMOJI[slot.familia] || '🎬'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: esHoy ? 15 : 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e?.titulo || slot.titulo}</div>
                  <div style={{ fontSize: 11, color: slot.gancho ? '#46C2FF' : GOLD }}>{slot.gancho ? '🎣 gancho · espectáculo' : '🎓 misión · economía'} · {slot.plataformas.join(' · ')}</div>
                </div>
                {pz && Object.entries(pz.formatos).filter(([k]) => k === '9:16' || k === 'video').slice(0, 1).map(([, rel]) => (
                  <a key={rel} href={VIDEO_BASE + rel} download style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'rgba(70,194,255,0.12)', color: '#46C2FF', border: '1px solid rgba(70,194,255,0.3)', textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}>⬇</a>
                ))}
                <button onClick={() => marcarVarias(slot.pieceId, SHORT_KEYS)} style={{ fontSize: 11, padding: esHoy ? '7px 13px' : '5px 11px', borderRadius: 7, cursor: 'pointer', fontWeight: 700, flexShrink: 0, background: hechas === 3 ? '#34D399' : hechas > 0 ? 'rgba(253,184,19,0.2)' : 'rgba(255,255,255,0.06)', color: hechas === 3 ? '#06070D' : hechas > 0 ? GOLD : '#B8C2D6', border: `1px solid ${hechas === 3 ? '#34D399' : 'rgba(255,255,255,0.12)'}` }}>
                  {hechas === 3 ? '✓ publicado' : hechas > 0 ? `${hechas}/3 redes` : 'marcar 3 redes'}
                </button>
              </div>
            );
          };
          return (
            <>
              {/* pauta */}
              <div style={{ background: 'rgba(70,194,255,0.06)', border: '1px solid rgba(70,194,255,0.25)', borderRadius: 11, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#C7D0E0', lineHeight: 1.5 }}>
                <b style={{ color: '#46C2FF' }}>🎯 La pauta:</b> {cad.pauta}
              </div>
              {/* control de inicio */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#8893A8' }}>Día 1 de la pista =</span>
                <input type="date" value={inicio} onChange={ev => fijarInicio(ev.target.value)} style={{ background: 'rgba(0,0,0,0.3)', color: '#E2E8F0', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, fontSize: 12, padding: '5px 9px' }} />
                <span style={{ fontSize: 12, color: '#6B7689' }}>· hoy es el día <b style={{ color: GOLD }}>{diaActual}</b> · semana <b style={{ color: GOLD }}>{semanaActual}</b></span>
              </div>
              {/* HOY TOCA */}
              {slotHoy && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>📌 Hoy toca</div>
                  <div style={{ marginBottom: 18 }}><Fila d={diaActual} slot={slotHoy} hoy /></div>
                </>
              )}
              {/* clase de la semana */}
              {cad.semanal[semanaActual - 1] && (() => {
                const s = cad.semanal[semanaActual - 1]; const pz = pieceById[s.pieceId];
                const rel169 = pz?.formatos['16:9'];
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 15px', marginBottom: 18, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 10 }}>
                    <div style={{ fontSize: 22 }}>🎓</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Clase de la semana {semanaActual} → {s.plataforma}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{(pz && eff(pz).titulo) || s.titulo}</div>
                    </div>
                    {rel169 && <a href={VIDEO_BASE + rel169} download style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, background: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.4)', textDecoration: 'none', fontWeight: 600 }}>⬇ 16:9</a>}
                    <button onClick={() => togglePlat(s.pieceId, 'yt')} style={{ fontSize: 11, padding: '5px 11px', borderRadius: 7, cursor: 'pointer', fontWeight: 700, background: registro[s.pieceId]?.plataformas?.yt?.subido ? '#34D399' : 'rgba(255,255,255,0.06)', color: registro[s.pieceId]?.plataformas?.yt?.subido ? '#06070D' : '#B8C2D6', border: '1px solid rgba(255,255,255,0.12)' }}>{registro[s.pieceId]?.plataformas?.yt?.subido ? '✓ en YT' : 'marcar YT'}</button>
                  </div>
                );
              })()}
              {/* próximos 14 días */}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#8893A8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Próximos días</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {futuros.slice(slotHoy ? 1 : 0).map(d => { const s = slotForDia(d); return s ? <Fila key={d} d={d} slot={s} /> : null; })}
              </div>
            </>
          );
        })()}

        {/* ═══ TELEMETRÍA ═══ */}
        {tab === 'tele' && (
          <div>
            {!tele.connected ? <div style={{ color: '#8893A8' }}>Telemetría sin conectar.</div> : (
              <>
                {/* EL EMBUDO LIMPIO manda. Los crudos incluyen NUESTRAS pruebas y bots: con
                    ellos el tablero decía 1731 sesiones y mediana de 1.5s, y 270 entradas al
                    CAD que éramos nosotros en escritorio. Ver scripts/telemetria-limpia.cjs. */}
                {tele.limpio && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#34D399', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Embudo REAL — sin nuestras pruebas ni bots
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                      <Stat n={tele.limpio.sesiones} label="sesiones reales" color="#34D399" />
                      <Stat n={`${tele.limpio.c1_segunda_pagina}%`} label="llegan a 2a página" color={tele.limpio.c1_segunda_pagina < 5 ? '#FF6B5A' : '#34D399'} />
                      <Stat n={`${tele.limpio.mediana_s}s`} label="mediana de sesión" color={tele.limpio.mediana_s < 3 ? '#FF6B5A' : '#FDB813'} />
                      <Stat n={`${tele.limpio.rebote_3s_pct}%`} label="se van en ≤3s" color={tele.limpio.rebote_3s_pct > 50 ? '#FF6B5A' : '#FDB813'} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                      <Stat n={`${tele.limpio.p75_s}s`} label="p75 (los que sí se quedan)" color="#46C2FF" />
                      <Stat n={`${tele.limpio.p90_s}s`} label="p90" color="#46C2FF" />
                      <Stat n={`${tele.limpio.inapp_pct}%`} label="dentro de IG/TikTok" color="#A78BFA" />
                      <Stat n={tele.limpio.descartadas} label="descartadas (nosotros/bots)" color="#5A6678" />
                    </div>
                    {!!tele.ipsSospechosas?.length && (
                      <div style={{ fontSize: 12, color: '#FDB813', marginBottom: 18 }}>
                        ⚠ {tele.ipsSospechosas.length} IP(s) huelen a máquina de pruebas ({tele.ipsSospechosas.map(x => `${x.ip} (${x.sesiones})`).join(', ')}) — si son nuestras, agrégalas a config/telemetria-ignorar.json
                      </div>
                    )}
                    <div style={{ height: 18 }} />
                  </>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#5A6678', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Crudo (incluye pruebas y bots)</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
                  <Stat n={tele.sessions!} label="sesiones" color="#A78BFA" />
                  <Stat n={tele.pageviews!} label="pageviews" color="#46C2FF" />
                  <Stat n={tele.clicks!} label="clicks" color="#F472B6" />
                  <Stat n={tele.errors!} label="errores" color={tele.errors ? '#FF6B5A' : '#34D399'} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Páginas más vistas</div>
                {tele.topPages?.map(tp => {
                  const max = tele.topPages![0].n;
                  return (
                    <div key={tp.u} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, width: 230, color: '#B8C2D6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tp.u}</span>
                      <div style={{ flex: 1, height: 18, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${(tp.n / max) * 100}%`, height: '100%', background: GOLD, opacity: 0.7 }} /></div>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: GOLD, width: 38, textAlign: 'right' }}>{tp.n}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
