/**
 * LA TRANSICIÓN ENTRE PASOS — «de esta parte, ahora pasamos a esto».
 * ============================================================================
 * ian (2026-10-22), viendo el tutorial del happy path: «es un pipeline, pero nunca siento cuando pasamos al otro lado…
 * entre un paso y el otro debería haber una animación». Y: «el video de producción debe salir de La Forja». Por eso la
 * transición vive EN la app (la ve el cliente al usarla, y la película la filma tal cual), no en la edición.
 *
 * La animación (≈2.3 s): una CORTINA oscura baja con una línea de escaneo; sobre ella aparece el número del paso, su
 * nombre y su promesa en una línea; la barra de los 9 pasos se llena hasta el actual; la cortina SUBE y revela la vista
 * nueva. El pipeline se siente: sabes dónde estás y cuánto falta.
 *
 * ⚠ Se anima con requestAnimationFrame + performance.now, NUNCA con transiciones/animaciones CSS: el reloj virtual de la
 * filmadora (60 fps exactos) gobierna rAF y performance.now, y las CSS corren con el reloj real del compositor —
 * se verían a saltos o terminadas (gotcha medido el 2026-09-21).
 */
import { useEffect, useRef } from 'react';
import { PIEL } from './piel-futuro';

export interface PasoDelCamino { n: number; titulo: string; promesa: string; /** el nombre en el riel, cuando el título no cabe */ corto?: string }

/** Los 9 pasos del camino comercial (caminos/la-carcasa-de-mitsubishi.md). */
export const PASOS_DEL_CAMINO: PasoDelCamino[] = [
  { n: 1, titulo: 'ABRES LA FORJA', corto: 'LA FORJA', promesa: 'suelta tu pieza: lo demás lo hace la máquina' },
  { n: 2, titulo: 'TU PIEZA', promesa: 'la Forja la mide y la entiende' },
  { n: 3, titulo: 'EL ENFRIAMIENTO', promesa: 'dónde tarda tu pieza en ponerse firme' },
  { n: 4, titulo: 'EL DICTAMEN', promesa: 'qué reglas cumple tu pieza y qué cambiar' },
  { n: 5, titulo: 'LA PARTICIÓN', promesa: 'dónde se abre el molde en dos mitades' },
  { n: 6, titulo: 'EL MOLDE', promesa: 'la Forja diseña tu molde, estación por estación' },
  { n: 7, titulo: 'LA INSPECCIÓN', promesa: 'la máquina revisa tu molde, sección por sección' },
  { n: 8, titulo: 'LOS PLANOS', promesa: 'las láminas para el taller' },
  { n: 9, titulo: 'EL EXPEDIENTE', promesa: 'lo que te llevas: dictamen, cotización y planos' },
];

/** la piel (cyberpunk + holograma, 2026-10-22): cortina de vacío azul marino con barrido cian; el número del paso en AMARILLO
 *  del operador («tú estás aquí»); los pasos hechos en cian (medido), los que faltan en hilo tenue */
const C = { cortina: 'rgba(3,7,11,0.93)', linea: PIEL.medido, tinta: PIEL.texto.primario, tenue: PIEL.texto.secundario, acento: PIEL.operador, hecho: PIEL.medido, apagado: 'rgba(159,196,214,0.16)' };
export const DURACION_TRANSICION_S = 2.3;

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const tramo = (t: number, a: number, b: number) => ease((t - a) / (b - a));

export function TransicionPaso({ paso, t0, total = 9, onFin }: {
  paso: PasoDelCamino;
  /** performance.now() del arranque: cambiarlo REINICIA la animación */
  t0: number;
  total?: number;
  onFin?: () => void;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const cortina = useRef<HTMLDivElement>(null);
  const linea = useRef<HTMLDivElement>(null);
  const bloque = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLDivElement>(null);
  const tit = useRef<HTMLDivElement>(null);
  const pro = useRef<HTMLDivElement>(null);
  const segs = useRef<Array<HTMLDivElement | null>>([]);
  const finRef = useRef(onFin); finRef.current = onFin;

  useEffect(() => {
    let raf = 0, vivo = true;
    const D = DURACION_TRANSICION_S;
    // EL RELOJ ARRANCA EN EL PRIMER CUADRO PINTADO, no en `t0`: medido 2026-10-22, el clic que abre un paso congela el hilo
    // 0.6–0.8 s (el estudio entero se vuelve a dibujar) y la cortina «corría» a ciegas — se perdía el primer tercio.
    let inicio = -1;
    const cuadro = () => {
      if (!vivo) return;
      if (inicio < 0) inicio = performance.now();
      const t = (performance.now() - inicio) / 1000;
      // la cortina: baja en 0–0.42 s, se queda, sube en 1.75–2.3 s (fracción de la pantalla cubierta desde ARRIBA)
      const baja = tramo(t, 0, 0.42), sube = tramo(t, 1.75, D);
      const top = sube;                     // al subir, el borde SUPERIOR de la cortina baja → se revela desde arriba
      const bot = baja;
      if (cortina.current) { cortina.current.style.top = `${top * 100}%`; cortina.current.style.height = `${Math.max(0, bot - top) * 100}%`; }
      if (linea.current) {
        const y = t < 1.75 ? bot : top;     // la línea de escaneo va en el borde que se mueve
        linea.current.style.top = `calc(${y * 100}% - 1px)`;
        linea.current.style.opacity = String(t < 0.42 || t > 1.75 ? 1 : 0.35);
      }
      // el bloque de texto: entra 0.25–0.7 s (sube 24 px y aparece), se va con la cortina
      const entra = tramo(t, 0.25, 0.7), sale = tramo(t, 1.6, 1.95);
      if (bloque.current) { bloque.current.style.opacity = String(entra * (1 - sale)); bloque.current.style.transform = `translateY(${(1 - entra) * 24 - sale * 18}px)`; }
      // el título se «escribe» de izquierda a derecha (máscara), la promesa lo sigue
      if (tit.current) tit.current.style.clipPath = `inset(0 ${(1 - tramo(t, 0.35, 0.9)) * 100}% 0 0)`;
      if (pro.current) pro.current.style.opacity = String(tramo(t, 0.75, 1.1));
      if (num.current) num.current.textContent = String(paso.n).padStart(2, '0');
      // la barra de los pasos: los anteriores encendidos, el actual se llena 0.45–1.25 s
      segs.current.forEach((s, i) => {
        if (!s) return;
        const k = i + 1;
        const lleno = k < paso.n ? 1 : k === paso.n ? tramo(t, 0.45, 1.25) : 0;
        const col = k < paso.n ? C.hecho : C.acento;
        s.style.background = `linear-gradient(90deg, ${col} ${lleno * 100}%, ${C.apagado} ${lleno * 100}%)`;
        s.style.boxShadow = k === paso.n && lleno > 0 ? `0 0 12px ${C.acento}` : 'none';
      });
      if (raiz.current) raiz.current.style.display = t >= D ? 'none' : 'block';
      if (t >= D) { finRef.current?.(); return; }
      raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => { vivo = false; cancelAnimationFrame(raf); };
  }, [t0, paso.n]);

  return (
    <div ref={raiz} data-testid="transicion-paso" data-paso={paso.n} style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none', overflow: 'hidden' }}>
      <div ref={cortina} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 0, background: C.cortina,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(34,225,255,0.04) 0 1px, transparent 1px 3px)' }} />
      <div ref={linea} style={{ position: 'absolute', left: 0, right: 0, height: 2, background: C.linea, boxShadow: `0 0 18px 3px ${C.linea}`, top: 0 }} />
      <div ref={bloque} style={{ position: 'absolute', left: '9%', top: '34%', width: '62%', opacity: 0, color: C.tinta }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.4vmin' }}>
          <div ref={num} style={{ font: `700 13vmin/0.9 ${PIEL.fuente.titulo}`, letterSpacing: '-0.01em', color: C.acento, textShadow: `0 0 28px ${C.acento}55` }}>00</div>
          <div style={{ font: `600 2.6vmin ${PIEL.fuente.titulo}`, letterSpacing: '0.2em', color: C.tenue }}>// {String(total).padStart(2, '0')}</div>
        </div>
        <div ref={tit} style={{ font: `700 6.4vmin/1.05 ${PIEL.fuente.titulo}`, letterSpacing: '0.1em', marginTop: '1.2vmin' }}>{paso.titulo}</div>
        <div ref={pro} style={{ font: `500 2.7vmin/1.35 ${PIEL.fuente.cuerpo}`, color: C.tenue, marginTop: '1.4vmin', opacity: 0 }}>{paso.promesa}</div>
        <div style={{ display: 'flex', gap: '0.8vmin', marginTop: '4vmin', width: '70%' }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} ref={(e) => { segs.current[i] = e; }} style={{ flex: 1, height: '0.55vmin', minHeight: 3, background: C.apagado }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** EL RIEL DE LOS 9 PASOS — siempre visible arriba del visor (las tres investigaciones de color lo pidieron sin hablarse: es la
 *  respuesta permanente a «nunca siento cuando pasamos al otro lado»). Hechos en cian con ✓, el actual en AMARILLO del operador,
 *  los que faltan en hilo tenue. Es DOM puro, sin estado propio: lo dibuja el paso que el estudio ya deduce. */
export function RielDePasos({ actual, maximo, ancho = 'completo', arriba = false, onElegir }: {
  actual: number; maximo: number; ancho?: 'completo' | 'centro';
  /** modo camino: pegado al borde superior del visor (la banda del ribbon ya no existe) */
  arriba?: boolean;
  /** modo camino: el riel ES la navegación — se puede tocar hasta el paso siguiente al más lejano alcanzado */
  onElegir?: (n: number) => void;
}) {
  // con los paneles del CAD a la vista, el riel vive ENTRE ellos (no se les encima); en el Foco, la inspección y el modo camino
  // los paneles se apartan y el riel ocupa todo el ancho
  const lados = ancho === 'centro' ? { left: 258, right: 326 } : { left: 18, right: 18 };
  return (
    <div data-testid="riel-de-pasos" data-actual={actual} style={{ position: 'absolute', ...lados, top: arriba ? 0 : 4, zIndex: 7, pointerEvents: onElegir ? 'auto' : 'none',
      display: 'flex', gap: 3, font: `600 ${arriba ? 11.5 : 10.5}px ${PIEL.fuente.titulo}`, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
      {PASOS_DEL_CAMINO.map((p) => {
        const es = p.n === actual, hecho = p.n <= maximo && !es;
        const color = es ? PIEL.texto.sobreAcento : hecho ? PIEL.medido : PIEL.texto.tenue;
        const tocable = !!onElegir && !es && p.n >= 2 && p.n <= maximo + 1;
        return (
          <div key={p.n} data-testid={`riel-paso-${p.n}`} onClick={tocable ? () => onElegir!(p.n) : undefined}
            style={{ flex: 1, minWidth: 0, padding: arriba ? '6px 8px 6px' : '4px 8px 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: tocable ? 'pointer' : 'default',
            color, background: es ? PIEL.operador : 'rgba(3,7,11,0.72)',
            borderTop: `2px solid ${es ? PIEL.operador : hecho ? PIEL.medido : 'rgba(159,196,214,0.16)'}`,
            clipPath: es ? 'polygon(0 0,100% 0,100% 70%,94% 100%,0 100%)' : undefined }}>
            {String(p.n).padStart(2, '0')} {hecho ? '✓ ' : ''}{p.corto ?? p.titulo.replace(/^(EL|LA|LOS|TU) /, '')}
          </div>
        );
      })}
    </div>
  );
}

