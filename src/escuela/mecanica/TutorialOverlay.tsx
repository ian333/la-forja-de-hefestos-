/**
 * ESCUELA DE MECÁNICA — tutorial interactivo dentro del CAD.
 * Se monta como HERMANO de ForgeBRepStudio (cero cambios al monolito) cuando
 * la URL trae ?leccion=<id>. Carga la MISMA lección JSON que genera la clase
 * en video (public/escuela/lecciones/<id>.json) y guía paso a paso:
 *   - muestra la instrucción del paso (el "dice" de Matilda),
 *   - RESALTA el botón objetivo (primer tclick del paso, por data-testid),
 *   - valida el paso con el MISMO check que el video (invariantes del kernel),
 *     sondeando cada segundo — al pasar, avanza solo.
 * El alumno hace la pieza con SUS manos; el kernel califica.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

type Gesto = { type: string; testid?: string; [k: string]: unknown };
type Paso = { id: string; dice: string; gestos?: Gesto[]; check?: { js: string; desc: string } };
type Leccion = {
  id: string; unidad: number; n: number; titulo: string; subtitulo?: string;
  descripcion?: string; pasos: Paso[];
};

const GOLD = '#FDB813';

declare global {
  interface Window { __forgeBrep?: Record<string, unknown>; __sketchEditor?: Record<string, unknown>; }
}

function evalCheck(js: string): boolean {
  try {
    const inv = (window.__forgeBrep as { invariants?: unknown } | undefined)?.invariants;
    const sk = window.__sketchEditor;
    // El check viene de NUESTRAS lecciones (mismo repo), no de input del usuario.
    return !!new Function('inv', 'sk', `return (${js});`)(inv, sk);
  } catch { return false; }
}

export default function TutorialOverlay() {
  const leccionId = useMemo(() => new URLSearchParams(location.search).get('leccion'), []);
  const [lec, setLec] = useState<Leccion | null>(null);
  const [i, setI] = useState(0);
  const [hecho, setHecho] = useState<Record<string, boolean>>({});
  const [min, setMin] = useState(false);
  const hlRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!leccionId) return;
    fetch(`/escuela/lecciones/${leccionId}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setLec)
      .catch(() => setLec(null));
  }, [leccionId]);

  const paso = lec?.pasos[i];

  // Resaltar el botón objetivo del paso (primer gesto con testid visible).
  useEffect(() => {
    if (hlRef.current) { hlRef.current.style.outline = ''; hlRef.current.style.outlineOffset = ''; hlRef.current = null; }
    if (!paso) return;
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
  }, [paso]);

  // Sondear el check del paso — al pasar, marcar y avanzar solo.
  useEffect(() => {
    if (!lec || !paso?.check || hecho[paso.id]) return;
    const tick = window.setInterval(() => {
      if (evalCheck(paso.check!.js)) {
        setHecho((h) => ({ ...h, [paso.id]: true }));
        window.setTimeout(() => setI((x) => Math.min(x + 1, lec.pasos.length - 1)), 900);
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [lec, paso, hecho]);

  if (!leccionId) return null;
  if (!lec) return null;

  const done = Object.keys(hecho).length;
  const total = lec.pasos.filter((p) => p.check).length;

  return (
    <div style={{
      position: 'fixed', right: 16, bottom: 16, zIndex: 9000, width: min ? 260 : 420,
      background: 'rgba(10,14,20,.96)', border: '1px solid #2a3546', borderRadius: 14,
      color: '#e9eef5', fontFamily: 'Inter, system-ui, sans-serif',
      boxShadow: '0 12px 40px rgba(0,0,0,.6)', overflow: 'hidden',
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
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: GOLD, color: '#111', cursor: 'pointer', fontWeight: 700 }}>Siguiente →</button>
          </div>
        </div>
      )}
    </div>
  );
}
