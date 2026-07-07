/**
 * ESCUELA DE MECÁNICA — tutorial interactivo dentro del CAD.
 * Se monta como HERMANO de ForgeBRepStudio (cero cambios al monolito) cuando
 * la URL trae ?leccion=<id>. Carga la MISMA lección JSON que genera la clase
 * en video (public/escuela/lecciones/<id>.json).
 *
 * DOS MODOS:
 *  - GUÍA (manos): muestra la instrucción, resalta el botón objetivo y el kernel
 *    valida el paso (invariantes), avanzando solo. El alumno hace la pieza.
 *  - REPRODUCIR (▶): la clase se VE dentro de La Forja — la vista hace ZOOM tipo
 *    trackpad hacia la pieza y los SUBTÍTULOS aparecen frase por frase abajo, sin
 *    estorbar. Es la clase, en vivo, dentro del CAD.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

type Gesto = { type: string; testid?: string; [k: string]: unknown };
type Paso = { id: string; dice: string; gestos?: Gesto[]; check?: { js: string; desc: string } };
type Leccion = {
  id: string; unidad: number; n: number; titulo: string; subtitulo?: string;
  descripcion?: string; pasos: Paso[];
};

const GOLD = '#FDB813';

declare global {
  interface Window {
    __forgeBrep?: Record<string, unknown> & { setView?: (n: string) => void; encuadrar?: () => void };
    __sketchEditor?: Record<string, unknown>;
  }
}

function evalCheck(js: string): boolean {
  try {
    const inv = (window.__forgeBrep as { invariants?: unknown } | undefined)?.invariants;
    const sk = window.__sketchEditor;
    // El check viene de NUESTRAS lecciones (mismo repo), no de input del usuario.
    return !!new Function('inv', 'sk', `return (${js});`)(inv, sk);
  } catch { return false; }
}

// Parte el "dice" (párrafo hablado) en FRASES cortas (≤ ~11 palabras) para que el
// subtítulo NO estorbe: aparece una frase a la vez, como subtítulo de cine.
function splitPhrases(text: string, max = 11): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  const out: string[] = [];
  for (const s of clean.split(/(?<=[.!?…])\s+/)) {
    if (!s) continue;
    if (s.split(' ').length <= max) { out.push(s); continue; }
    let buf = '';
    for (const p of s.split(/(?<=[,;:—–])\s+/)) {
      const cand = buf ? `${buf} ${p}` : p;
      if (cand.split(' ').length <= max) buf = cand;
      else { if (buf) out.push(buf); buf = p; }
    }
    if (buf) out.push(buf);
  }
  // fusiona fragmentos diminutos (<3 palabras) con el anterior
  const merged: string[] = [];
  for (const p of out) {
    if (merged.length && p.split(' ').length < 3) merged[merged.length - 1] += ` ${p}`;
    else merged.push(p);
  }
  return merged.length ? merged : [clean];
}

// ── Zoom "trackpad" sobre el viewport 3D (el .fb-viewport del Studio). Puro DOM:
//    no toca el monolito, solo lee su elemento por data-testid y le anima el scale.
const FOCI: [number, number][] = [[50, 50], [44, 44], [57, 47], [50, 58], [46, 52], [55, 45]];
function getVp(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="viewport"]');
}
function zoomVp(scale: number, ox: number, oy: number, ms = 1600) {
  const vp = getVp(); if (!vp) return;
  vp.style.willChange = 'transform';
  vp.style.transformOrigin = `${ox}% ${oy}%`;
  vp.style.transition = `transform ${ms}ms cubic-bezier(.22,.61,.36,1)`;
  vp.style.transform = `scale(${scale})`;
}
function resetVp() {
  const vp = getVp(); if (!vp) return;
  vp.style.transition = 'transform 800ms ease';
  vp.style.transform = '';
  vp.style.transformOrigin = '';
  vp.style.willChange = '';
}

export default function TutorialOverlay() {
  const leccionId = useMemo(() => new URLSearchParams(location.search).get('leccion'), []);
  const [lec, setLec] = useState<Leccion | null>(null);
  const [i, setI] = useState(0);
  const [hecho, setHecho] = useState<Record<string, boolean>>({});
  const [min, setMin] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ph, setPh] = useState(0);            // índice de frase dentro del paso (modo reproducir)
  const hlRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!leccionId) return;
    fetch(`/escuela/lecciones/${leccionId}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setLec)
      .catch(() => setLec(null));
  }, [leccionId]);

  const paso = lec?.pasos[i];
  const phrases = useMemo(() => (paso ? splitPhrases(paso.dice) : []), [paso]);

  // Resaltar el botón objetivo del paso (solo en modo GUÍA — en reproducir estorba).
  useEffect(() => {
    if (hlRef.current) { hlRef.current.style.outline = ''; hlRef.current.style.outlineOffset = ''; hlRef.current = null; }
    if (!paso || playing) return;
    const target = (paso.gestos ?? []).find((g) => (g.type === 'tclick' || g.type === 'fill') && g.testid);
    if (!target) return;
    const tick = window.setInterval(() => {
      const el = document.querySelector<HTMLElement>(`[data-testid="${target.testid}"]`);
      if (el && el !== hlRef.current) {
        if (hlRef.current) hlRef.current.style.outline = '';
        el.style.outline = `2px solid ${GOLD}`;
        el.style.outlineOffset = '2px';
        hlRef.current = el;
      }
    }, 700);
    return () => window.clearInterval(tick);
  }, [paso, playing]);

  // GUÍA: sondear el check del paso — al pasar, marcar y avanzar solo (NO en reproducir).
  useEffect(() => {
    if (playing || !lec || !paso?.check || hecho[paso.id]) return;
    const tick = window.setInterval(() => {
      if (evalCheck(paso.check!.js)) {
        setHecho((h) => ({ ...h, [paso.id]: true }));
        window.setTimeout(() => setI((x) => Math.min(x + 1, lec.pasos.length - 1)), 900);
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [lec, paso, hecho, playing]);

  // REPRODUCIR: avanza frase por frase; al agotar el paso, pasa al siguiente.
  useEffect(() => {
    if (!playing || !paso || !lec) return;
    const words = (phrases[ph] || '').split(' ').length;
    const ms = Math.max(1500, words * 420);   // ~ritmo de narración (0.42s/palabra)
    const to = window.setTimeout(() => {
      if (ph + 1 < phrases.length) setPh(ph + 1);
      else if (i + 1 < lec.pasos.length) { setI(i + 1); setPh(0); }
      else setPlaying(false);                  // fin de la clase
    }, ms);
    return () => window.clearTimeout(to);
  }, [playing, i, ph, phrases, paso, lec]);

  // REPRODUCIR: zoom "trackpad" hacia la pieza al entrar a cada paso.
  useEffect(() => {
    if (!playing) return;
    const [ox, oy] = FOCI[i % FOCI.length];
    zoomVp(1.26 + (i % 3) * 0.1, ox, oy);      // 1.26 .. 1.46
  }, [i, playing]);

  // Arranque/paro de reproducción: encuadra al iniciar, restaura al parar.
  useEffect(() => {
    if (playing) { try { window.__forgeBrep?.setView?.('iso'); } catch { /* noop */ } }
    else resetVp();
  }, [playing]);
  // Limpieza dura: si el overlay se desmonta, no dejar el viewport escalado.
  useEffect(() => () => resetVp(), []);

  function play() { setPh(0); setMin(true); setPlaying(true); }
  function stop() { setPlaying(false); resetVp(); }

  if (!leccionId || !lec) return null;

  const done = Object.keys(hecho).length;
  const total = lec.pasos.filter((p) => p.check).length;
  const progHint = `${i + 1}/${lec.pasos.length}`;

  return (
    <>
      {/* ── SUBTÍTULO (modo reproducir): abajo, centrado, sin estorbar la pieza ── */}
      {playing && paso && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 92, transform: 'translateX(-50%)',
          zIndex: 9500, pointerEvents: 'none', maxWidth: 'min(70vw, 760px)', textAlign: 'center',
        }}>
          <div key={`${i}-${ph}`} style={{
            display: 'inline-block', padding: '13px 22px', borderRadius: 14,
            background: 'linear-gradient(180deg, rgba(9,13,20,.72), rgba(7,10,16,.62))',
            border: '1px solid rgba(255,255,255,.10)', backdropFilter: 'blur(10px)',
            color: '#f2efe6', font: '600 clamp(18px,2.3vw,27px)/1.32 Inter, system-ui, sans-serif',
            letterSpacing: '.005em', textShadow: '0 2px 14px rgba(0,0,0,.8)',
            boxShadow: '0 18px 44px -22px #000', animation: 'subin .34s ease',
          }}>{phrases[ph] || paso.dice}</div>
        </div>
      )}

      {/* ── Transporte de reproducción ── */}
      {playing && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', zIndex: 9600,
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 999,
          background: 'rgba(10,14,20,.9)', border: '1px solid #2a3546', boxShadow: '0 10px 30px -12px #000',
          font: '600 13px Inter, system-ui, sans-serif', color: '#e9eef5',
        }}>
          <button onClick={() => { setI(Math.max(0, i - 1)); setPh(0); }} title="Paso anterior"
            style={btn}>⏮</button>
          <button onClick={stop} title="Salir de reproducción" style={{ ...btn, color: GOLD }}>■ Salir</button>
          <button onClick={() => { if (i + 1 < lec.pasos.length) { setI(i + 1); setPh(0); } }} title="Siguiente paso"
            style={btn}>⏭</button>
          <span style={{ color: '#5b6b7e', paddingLeft: 4 }}>Paso {progHint}</span>
        </div>
      )}

      {/* ── Tarjeta de guía (modo manos) ── */}
      <div style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 9000, width: min ? 260 : 420,
        background: 'rgba(10,14,20,.96)', border: '1px solid #2a3546', borderRadius: 14,
        color: '#e9eef5', fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: '0 12px 40px rgba(0,0,0,.6)', overflow: 'hidden',
        display: playing ? 'none' : 'block',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: min ? 'none' : '1px solid #1b2430' }}>
          <span style={{ color: GOLD, fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>ESCUELA · U{lec.unidad} L{lec.n}</span>
          <span style={{ fontSize: 13, color: '#8fa3b8', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lec.titulo}</span>
          <button onClick={() => setMin((m) => !m)} style={{ background: 'none', border: 'none', color: '#8fa3b8', cursor: 'pointer', fontSize: 15 }}>{min ? '▲' : '▼'}</button>
        </div>
        {!min && paso && (
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: '#5b6b7e', marginBottom: 6 }}>
              Paso {i + 1} / {lec.pasos.length} · verificados {done}/{total}
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.45, fontWeight: 500 }}>{paso.dice}</div>
            {paso.check && (
              <div style={{ marginTop: 10, fontSize: 13, color: hecho[paso.id] ? '#3ddc84' : '#8fa3b8' }}>
                {hecho[paso.id] ? '✓ ' : '◌ '} {paso.check.desc}
                {!hecho[paso.id] && <span style={{ color: '#5b6b7e' }}> — el kernel lo verifica solo</span>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #2a3546', background: 'none', color: i === 0 ? '#3d4c5e' : '#e9eef5', cursor: i === 0 ? 'default' : 'pointer', fontWeight: 600 }}>← Anterior</button>
              <button onClick={() => setI((x) => Math.min(lec.pasos.length - 1, x + 1))} disabled={i >= lec.pasos.length - 1}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#1b2430', color: '#e9eef5', cursor: 'pointer', fontWeight: 600 }}>Siguiente →</button>
            </div>
            <button onClick={play} style={{
              width: '100%', marginTop: 8, padding: '10px 0', borderRadius: 8, border: 'none',
              background: GOLD, color: '#111', cursor: 'pointer', fontWeight: 800, fontSize: 14, letterSpacing: '.02em',
            }}>▶ Reproducir clase</button>
          </div>
        )}
        {min && !playing && (
          <div style={{ padding: '10px 14px' }}>
            <button onClick={play} style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: GOLD, color: '#111', cursor: 'pointer', fontWeight: 800 }}>▶ Reproducir clase</button>
          </div>
        )}
      </div>

      <style>{`@keyframes subin{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    </>
  );
}

const btn: CSSProperties = {
  background: 'none', border: 'none', color: '#e9eef5', cursor: 'pointer',
  font: '600 14px Inter, system-ui, sans-serif', padding: '4px 8px', borderRadius: 8,
};
