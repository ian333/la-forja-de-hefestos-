/**
 * LA LIBRETA DE DON CHUY — donde aterriza el embudo.
 * ============================================================================
 * Quién llega: un dueño de puesto, tiendita o taquería, en el teléfono, DENTRO
 * del navegador de Instagram, después de ver 40 s de Don Chuy y de escribir
 * «LIBRETA» en comentarios o DM. Muchos ya cerraron un negocio. No viene a
 * conocer una marca: viene a ver si la cuenta que acaba de entender le aplica.
 *
 * Por eso el orden de la página es el orden de esa cabeza, y no el de un sitio:
 *   1. EL PUESTO, dibujado igual que en el video → «sí, es esto» sin leer nada.
 *   2. LA CUENTA con sus números → «entonces a mí me pasa lo mismo».
 *   3. LA LIBRETA que ya puede usar hoy → algo que se lleva, sin registrarse.
 *   4. WHATSAPP → el re-contacto, que atiende una persona.
 *   5. HERMES → el escalón, sin precio y sin pitch: «cuando la libreta se queda chica».
 *
 * Reglas duras que se respetan aquí:
 *   · Cero peticiones extra para pintar: el CSS va en chuy.html, el dibujo es SVG
 *     inline y no hay imágenes. Lo único que baja es React + este archivo.
 *   · Todo se guarda en localStorage. Sin login, sin banner, sin cuenta: pedirle
 *     datos a alguien que llegó hace 8 segundos es perderlo.
 *   · La telemetría es la del repo (`src/lib/telemetry.ts`) y mide el EMBUDO por
 *     capítulo y por sesión del DM, nunca lo que la persona teclea.
 *
 * El dibujo es el de `dibujos/naranjas.tsx`, copia literal del que usa el video,
 * y las posiciones son las de `lia-video-engine/render/src/scenes/ElPuesto.tsx`:
 * si el puesto se viera distinto, esto no sería el aterrizaje del video.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { telemetry } from '../lib/telemetry';
import { capituloDe, money, valoresIniciales, type Capitulo, type Color, type Resultado } from './capitulos';
import {
  Basura, Calle, Camioneta, Casita, DonChuy, Lata, Letrero, Luces, Mesa, Naranja,
  Pastilla, SombraPiso, Vecino,
} from './dibujos/naranjas';

// ═════════════════════════════════════════════════════════════════════════════
// EL PUESTO
// ═════════════════════════════════════════════════════════════════════════════

// Las 15 naranjas dibujadas son las 100 de la historia. Copiado de ElPuesto.tsx
// tal cual: es la misma pila que la gente acaba de ver.
const PILA = [5, 4, 3, 2, 1].flatMap((m, fila) =>
  Array.from({ length: m }, (_, j) => ({ x: 420 + (j - (m - 1) / 2) * 44, y: 610 - fila * 38 })));

const LATA = { x: 690, y: 632 };
const VECINOS = [850, 945];
const BASURA = { x: 770, y: 822 };
// La casita: y=900 en el video, 880 aquí para que su rótulo CASA entre en el
// recorte. Va DELANTE de la banqueta, como allá.
const CASA = { x: 150, y: 880 };
// La camioneta ESTACIONADA: en el video interpola de -900 a 20 al llegar; 20 es
// su lugar, pegada a la izquierda de la mesa.
const CAMION_X = 20;

/**
 * El recorte. El lienzo del video es 1000×1000, pero la mitad de arriba es cielo
 * y fachadas: recortando a 150 el puesto llena el ancho del teléfono y la cuenta
 * editable sigue asomando arriba del pliegue en un 390×844.
 *
 * El fondo baja hasta 860 (40 unidades de banqueta bajo las sombras, para que el
 * puesto esté PARADO en algo y no flotando) y hasta 940 en el capítulo de la casa,
 * que es lo que mide esa pieza con su rótulo.
 */
const vista = (casa: boolean) => (casa ? '0 150 1000 790' : '0 150 1000 710');

const HEX: Record<Color, string> = { rojo: '#FF5C6C', verde: '#3DDC97', ambar: '#F7B32B' };

/** Lo que nunca cambia: calle, farol y la camioneta del proveedor. Memo para que
 *  el parpadeo de los ojos no vuelva a diferenciar estos cientos de nodos. */
const Atras = React.memo(function Atras({ camion }: { camion: boolean }) {
  return (
    <>
      <Calle />
      <rect x={-2000} y={-1500} width={5000} height={4000} fill="url(#farol)" />
      {camion ? (
        <>
          <SombraPiso x={CAMION_X + 152} rx={175} ry={16} />
          <g filter="url(#sombra)"><Camioneta x={CAMION_X} /></g>
        </>
      ) : null}
    </>
  );
});

/** La mesa (Don Chuy se dibuja DETRÁS de ella, como en el video). */
const MesaYSombra = React.memo(function MesaYSombra() {
  return (
    <>
      <SombraPiso x={510} y={828} rx={215} ry={13} />
      <Mesa />
    </>
  );
});

const Clientes = React.memo(function Clientes() {
  return (
    <>
      {VECINOS.map((x) => <SombraPiso key={x} x={x} rx={58} ry={10} />)}
      <g filter="url(#sombra)">
        <Vecino x={VECINOS[0]} color="#7E6AA8" pelo="#2B211C" />
        <Vecino x={VECINOS[1]} color="#3DA58A" pelo="#5A3A22" />
      </g>
    </>
  );
});

function Puesto({ cap, res, parpadeo }: { cap: Capitulo; res: Resultado; parpadeo: number }) {
  // La cara de Don Chuy REACCIONA a los números de quien está leyendo: si su
  // cuenta sale en rojo, Chuy la sufre con él. Es la misma carita del video.
  const sonrisa = res.color === 'rojo' ? -0.7 : res.color === 'ambar' ? 0.15 : 1;

  const texto = money(res.lata);
  // `Pastilla` calcula su ancho con la misma fórmula; se replica aquí para poder
  // encogerla y recentrarla cuando alguien teclea un número de siete cifras —
  // si no, la cifra se saldría del recorte justo cuando más importa leerla.
  const anchoBase = Math.max(150, texto.length * 28 + 50);
  const s = Math.min(1.45, 940 / anchoBase);
  const ancho = anchoBase * s;
  const cx = Math.min(Math.max(LATA.x, ancho / 2 + 16), 1000 - ancho / 2 - 16);

  const podridas = res.podridas ?? 0;
  // La casa y la camioneta NO coinciden en el video: el camión «se va» antes de
  // que aparezca la casa («esa noche saca $300 para el gas») y vuelve en la
  // mañana. Dibujar las dos encimaba el techo sobre el rótulo PROVEEDOR y
  // contaba una escena que nunca existió.
  const casa = cap.escena === 'casa';

  return (
    <svg viewBox={vista(casa)} role="img" aria-label={`El puesto de Don Chuy: ${texto}`}>
      <Luces />
      <Atras camion={!casa} />
      <g filter="url(#sombra)"><DonChuy x={540} y={560} sonrisa={sonrisa} parpadeo={parpadeo} /></g>
      <MesaYSombra />
      {PILA.map((p, i) => <Naranja key={i} x={p.x} y={p.y} podrida={i >= PILA.length - podridas} />)}
      <g filter="url(#sombra)"><Lata x={LATA.x} y={LATA.y} /></g>
      <Clientes />
      {casa ? (
        <>
          <SombraPiso x={CASA.x} y={CASA.y + 12} rx={90} ry={10} op={0.4} />
          <Casita x={CASA.x} y={CASA.y} />
        </>
      ) : null}
      {cap.escena === 'basura' ? (
        <>
          <SombraPiso x={BASURA.x} rx={42} ry={8} op={0.4} />
          <Basura x={BASURA.x} y={BASURA.y} />
        </>
      ) : null}
      {res.letrero ? <Letrero texto={res.letrero.texto} antes={res.letrero.antes} /> : null}
      <rect x={-2000} y={-1500} width={5000} height={4000} fill="url(#vineta)" />
      <Pastilla x={cx} y={300} texto={texto} color={HEX[res.color]} s={s} />
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LA LIBRETA (localStorage, sin login)
// ═════════════════════════════════════════════════════════════════════════════

type Pestana = 'fiado' | 'gastos' | 'merma';
type Anotado = { id: string; que: string; monto: number; fecha: string; cobrado?: boolean };
type Libreta = Record<Pestana, Anotado[]>;

const PESTANAS: { id: Pestana; titulo: string; que: string; total: string }[] = [
  { id: 'fiado', titulo: 'Fiado', que: '¿Quién?', total: 'Te deben' },
  { id: 'gastos', titulo: 'Gastos', que: '¿En qué?', total: 'Gastaste' },
  { id: 'merma', titulo: 'Merma', que: '¿Qué tiraste?', total: 'Tiraste' },
];

const LLAVE = 'chuy.libreta.v1';
const VACIA = (): Libreta => ({ fiado: [], gastos: [], merma: [] });

/**
 * Leer del teléfono. Todo va en try/catch y todo se valida campo por campo:
 * en modo privado el acceso TRUENA, y lo guardado puede venir de una versión
 * vieja o a medio escribir. La libreta de alguien no se pierde por un JSON raro,
 * y la página nunca se queda en blanco por eso.
 */
function leer(): Libreta {
  const libreta = VACIA();
  try {
    const crudo = localStorage.getItem(LLAVE);
    if (!crudo) return libreta;
    const j = JSON.parse(crudo) as Partial<Record<Pestana, unknown>>;
    for (const { id } of PESTANAS) {
      const filas = j?.[id];
      if (!Array.isArray(filas)) continue;
      libreta[id] = filas
        .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
        .map((f) => ({
          id: String(f.id ?? Math.random().toString(36).slice(2)),
          que: String(f.que ?? '').slice(0, 60),
          monto: Number.isFinite(Number(f.monto)) ? Number(f.monto) : 0,
          fecha: String(f.fecha ?? '').slice(0, 10),
          cobrado: !!f.cobrado,
        }))
        .slice(0, 500);   // techo: nadie anota más y así no crece sin control
    }
  } catch { /* sin localStorage o con basura dentro: libreta nueva */ }
  return libreta;
}

/**
 * El día de HOY, en la hora de quien anota.
 *
 * NO se usa `toISOString()`: eso da UTC, y de las 18:00 en adelante en México ya
 * es mañana allá. O sea que el fiado de la tarde —la hora en que de verdad se
 * anota, cuando el puesto cierra— saldría fechado al día siguiente. Cazado en
 * las capturas: un renglón hecho el 21 decía 22/09.
 */
const hoyISO = () => {
  const d = new Date();
  const dd = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
};

/** `2026-09-21` → `21/09`. La libreta se lee de reojo: el año estorba. */
function diaMes(iso: string): string {
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}` : '';
}

// ═════════════════════════════════════════════════════════════════════════════
// LA PÁGINA
// ═════════════════════════════════════════════════════════════════════════════

export default function LibretaChuy() {
  // `?c=` es el capítulo del video del que viene; `?s=` la sesión del DM, para
  // poder cerrar el embudo «escribió LIBRETA → abrió → anotó» sin cookies.
  const { cap, sid } = useMemo(() => {
    const p = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    return { cap: capituloDe(p.get('c')), sid: p.get('s') || undefined };
  }, []);

  const [valores, setValores] = useState<Record<string, number>>(() => valoresIniciales(cap));
  const res = useMemo(() => cap.calcular(valores), [cap, valores]);

  const [libreta, setLibreta] = useState<Libreta>(leer);
  const [pestana, setPestana] = useState<Pestana>('fiado');
  const [que, setQue] = useState('');
  const [monto, setMonto] = useState('');

  // ── Telemetría de entrada ────────────────────────────────────────────────
  useEffect(() => {
    telemetry.seccion('puesto');
    telemetry.event('chuy.abre', { c: cap.id, s: sid });
  }, [cap.id, sid]);

  // ── El parpadeo ──────────────────────────────────────────────────────────
  // Copiado del video (`(T % 3.7) < 0.14`) para que el personaje esté VIVO en el
  // primer segundo sin que nada más se mueva. El valor se cuantiza a quintos, así
  // que son ~5 renders cada 3.7 s en vez de 60 por segundo; el rAF se detiene
  // solo cuando la pestaña se va al fondo, y ni arranca si pidieron menos
  // movimiento (accesibilidad y batería en un teléfono de gama media).
  const [parpadeo, setParpadeo] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let ultimo = -1;
    const t0 = performance.now();
    const tic = () => {
      const f = ((performance.now() - t0) / 1000) % 3.7;
      const v = f < 0.14 ? 1 - Math.abs(f - 0.07) / 0.07 : 0;
      const q = Math.round(v * 5) / 5;
      if (q !== ultimo) { ultimo = q; setParpadeo(q); }
      raf = requestAnimationFrame(tic);
    };
    raf = requestAnimationFrame(tic);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Guardar la libreta ───────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(LLAVE, JSON.stringify(libreta)); }
    catch { /* modo privado o disco lleno: la sesión sigue usable */ }
  }, [libreta]);

  // ── La cuenta ────────────────────────────────────────────────────────────
  const tocados = useRef(new Set<string>());
  const cambiaNumero = useCallback((id: string, texto: string) => {
    // Un campo vacío es NaN y no 0: `Number('')` da 0 y pintaría un cero que la
    // persona no escribió. Las fórmulas ya tratan NaN como 0 al calcular.
    setValores((prev) => ({ ...prev, [id]: texto === '' ? NaN : Number(texto) }));
    if (!tocados.current.has(id)) {
      tocados.current.add(id);
      telemetry.event('chuy.numero', { c: cap.id, campo: id });
    }
  }, [cap.id]);

  // ── Anotar / cobrar ──────────────────────────────────────────────────────
  const activa = PESTANAS.find((p) => p.id === pestana)!;
  const filas = libreta[pestana];
  const total = filas.reduce((s, f) => s + (f.cobrado ? 0 : f.monto), 0);
  const puedeAnotar = que.trim() !== '' && Number(monto) > 0;

  const anotar = useCallback(() => {
    if (!puedeAnotar) return;
    const fila: Anotado = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      que: que.trim().slice(0, 60),
      monto: Math.round(Number(monto)),
      fecha: hoyISO(),
    };
    setLibreta((prev) => {
      const siguiente = { ...prev, [pestana]: [fila, ...prev[pestana]] };
      telemetry.event('chuy.fiado', { c: cap.id, n: siguiente[pestana].length, tipo: pestana });
      return siguiente;
    });
    setQue('');
    setMonto('');
  }, [cap.id, monto, pestana, puedeAnotar, que]);

  const cobrar = useCallback((id: string) => {
    setLibreta((prev) => ({
      ...prev,
      [pestana]: prev[pestana].map((f) => (f.id === id ? { ...f, cobrado: !f.cobrado } : f)),
    }));
    telemetry.event('chuy.cobrado', { c: cap.id });
  }, [cap.id, pestana]);

  // ── Los dos enlaces de salida ────────────────────────────────────────────
  const wa = 'https://wa.me/525573633622?text='
    + encodeURIComponent(`Quiero la libreta de Don Chuy cada noche (capítulo ${cap.id})`);
  const hermes = `https://gaiaprime.com.mx/?utm_source=libreta&utm_medium=ig&utm_campaign=${cap.id}`;

  return (
    <div className="app">
      {/* ── 1. EL PUESTO ───────────────────────────────────────────────── */}
      <section className="hero" data-seccion="puesto" id="puesto">
        <div className="titular">
          <span className="rotulo">{cap.hook}</span>
        </div>
        <Puesto cap={cap} res={res} parpadeo={parpadeo} />
        <div className="titular">
          <h1>{cap.frase}</h1>
        </div>
      </section>

      {/* ── 2. LA CUENTA ───────────────────────────────────────────────── */}
      <section data-seccion="cuenta" id="cuenta">
        <h2>{cap.pregunta}</h2>
        <p className="pie-seccion">
          Están los números de Don Chuy. Cámbialos por los tuyos y mira la lata.
        </p>

        <div className="campos">
          {cap.campos.map((campo) => (
            <div className={campo.ancho ? 'campo ancho' : 'campo'} key={campo.id}>
              <label htmlFor={`f-${campo.id}`}>{campo.etiqueta}</label>
              <div className="caja">
                {campo.prefijo ? <span className="signo">{campo.prefijo}</span> : null}
                <input
                  id={`f-${campo.id}`}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={Number.isFinite(valores[campo.id]) ? String(valores[campo.id]) : ''}
                  onChange={(e) => cambiaNumero(campo.id, e.target.value)}
                />
                {campo.unidad ? <span className="unidad">{campo.unidad}</span> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="lineas" aria-live="polite">
          {res.lineas.map((linea, i) => (
            <p key={i} className={i === 0 ? res.color : undefined}>{linea}</p>
          ))}
        </div>

        {cap.nota ? <p className="nota">{cap.nota}</p> : null}
      </section>

      {/* ── 3. LA LIBRETA ──────────────────────────────────────────────── */}
      <section data-seccion="libreta" id="libreta">
        <h2>Tu libreta</h2>
        <p className="pie-seccion">Se guarda en tu teléfono. Sin cuenta y sin contraseña.</p>

        <div className="pestanas" role="tablist" aria-label="Tu libreta">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={pestana === p.id}
              aria-controls="papel"
              onClick={() => { setPestana(p.id); setQue(''); setMonto(''); }}
            >
              {p.titulo}
            </button>
          ))}
        </div>

        <div className="papel" id="papel" role="tabpanel" data-primera={pestana === PESTANAS[0].id ? 'si' : 'no'}>
          <div className="deben">
            <span>{activa.total}</span>
            <strong>{money(total)}</strong>
          </div>

          <div className="alta">
            <input
              className="que"
              type="text"
              placeholder={activa.que}
              maxLength={60}
              value={que}
              onChange={(e) => setQue(e.target.value)}
              aria-label={activa.que}
            />
            <input
              className="cuanto"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              placeholder="$"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') anotar(); }}
              aria-label="Cuánto"
            />
            <button type="button" onClick={anotar} disabled={!puedeAnotar}>Anotar</button>
          </div>

          {filas.length === 0 ? (
            <p className="vacio">
              {pestana === 'fiado' ? 'Apunta al primero que te deba…'
                : pestana === 'gastos' ? 'Apunta lo que salió de la caja…'
                  : 'Apunta lo que se echó a perder…'}
            </p>
          ) : (
            <ul className="renglones">
              {filas.map((f) => (
                <li key={f.id} className={f.cobrado ? 'pagado' : undefined}>
                  <span className="renglon-que">{f.que}</span>
                  <span className="renglon-fecha">{diaMes(f.fecha)}</span>
                  <span className="renglon-monto">{money(f.monto)}</span>
                  {pestana === 'fiado' ? (
                    <button
                      type="button"
                      className="cobrar"
                      data-hecho={f.cobrado ? 'si' : 'no'}
                      onClick={() => cobrar(f.id)}
                    >
                      {f.cobrado ? 'Cobrado' : 'Cobrar'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="guardado">Cierra la página y tus apuntes siguen aquí.</p>
      </section>

      {/* ── 4. EL RE-CONTACTO ──────────────────────────────────────────── */}
      <section data-seccion="whatsapp" id="whatsapp">
        <h2>¿Te la mando cada noche?</h2>
        <p className="pie-seccion">
          Un mensaje al cierre para que anotes el fiado del día antes de que se te olvide.
        </p>
        <a
          className="wa"
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => telemetry.event('chuy.whatsapp', { c: cap.id })}
        >
          Mándamela por WhatsApp
        </a>
      </section>

      {/* ── 5. EL ESCALÓN ──────────────────────────────────────────────── */}
      {/* Sin precio y sin pitch a propósito: quien llegó hasta aquí ya entendió
          el problema solo. Esto nomás nombra la siguiente herramienta. */}
      <section data-seccion="hermes" id="hermes">
        <div className="hermes">
          <h2>Cuando la libreta se queda chica</h2>
          <p>
            Hermes te dice quién te debe, cuánto y desde cuándo, y te avisa solo.
          </p>
          <a
            href={hermes}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => telemetry.event('chuy.hermes', { c: cap.id })}
          >
            Probar Hermes gratis
          </a>
        </div>
      </section>

      <footer>GAIA Prime · Aprende a ver lo invisible</footer>
    </div>
  );
}
