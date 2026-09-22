/**
 * LA CARA DE GAIA — todas las marcas, dibujadas en vector, para elegir.
 *
 * ian, 2026-09-22: «no sé qué logo usar para gaia, además sus módulos necesitan una cara
 * comercial». Así que aquí NO hay una sola propuesta: hay seis para GAIA, para verlas juntas
 * y matar cinco. Y una por módulo, que ya no se elige — se ajusta.
 *
 * POR QUÉ EN CÓDIGO Y NO EN UN PNG: un logo se necesita en 32 px (favicon), en 3000 px (el
 * IMPI pide 300 DPI), en una tinta (grabado, sello, playera) y en negativo. Un vector hecho
 * de arcos y círculos da los cuatro sin pérdida, y el archivo que se manda a registrar sale
 * del mismo dibujo que se ve aquí: no hay «la versión buena» perdida en el disco de alguien.
 *
 * EL SISTEMA (lo que hace que se vean familia y no cinco logos sueltos):
 *   · Lienzo 100×100, la marca dentro de un cuadro óptico de 76.
 *   · Un solo grosor de línea (STROKE) con puntas redondas, para todas.
 *   · Cada marca tiene UN punto sólido: el acento. En GAIA es la semilla; en los módulos, la
 *     chispa. Es el gesto que las hermana de lejos.
 *   · Color: GAIA en oro (el del Comando), y cada módulo con el color que YA usa su producto
 *     en landing_gaia/src/components/Features.tsx. No se inventan colores nuevos.
 */
import { useState } from 'react';

const ORO = '#FDB813';
const TINTA = '#06070D';
const STROKE = 7;

export type Marca = {
  id: string;
  nombre: string;
  linea: string;          // qué es, en una línea, para el que nunca lo ha visto
  color: string;
  idea: string;           // de dónde sale la forma (el porqué, para defenderla o tirarla)
  dibujo: (color: string) => JSX.Element;
};

/** Trazo común: sin relleno, puntas redondas, el grosor del sistema. */
const T = (color: string, w = STROKE) => ({
  fill: 'none', stroke: color, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

// ─────────────────────────────────────────────────────────── GAIA: seis caminos

/** 1 · ALFA DE UN TRAZO. El lazo y la cola en una sola línea, sin levantar la pluma. */
const alfaTrazo = (c: string) => (
  <g>
    <path d="M70 32 C58 24 38 26 32 42 C26 58 34 72 46 72 C58 72 66 58 62 44 C58 30 64 24 72 26" {...T(c)} />
    <path d="M62 52 C66 62 70 68 76 72" {...T(c)} />
    <circle cx={76} cy={72} r={4} fill={c} />
  </g>
);

/** 2 · EL OJO. Un párpado de dos arcos y la α como pupila: «aprende a ver lo invisible». */
const alfaOjo = (c: string) => (
  <g>
    <path d="M14 50 C30 30 70 30 86 50 C70 70 30 70 14 50 Z" {...T(c)} />
    <circle cx={50} cy={50} r={11} fill={c} />
    <circle cx={54} cy={46} r={3.4} fill={TINTA} />
  </g>
);

/** 3 · EL PLANETA. Gaia es la Tierra: esfera y órbita, con la semilla en el punto de partida. */
const planeta = (c: string) => (
  <g>
    <circle cx={50} cy={50} r={26} {...T(c)} />
    <ellipse cx={50} cy={50} rx={42} ry={15} transform="rotate(-24 50 50)" {...T(c, 5)} />
    <circle cx={16} cy={62} r={6} fill={c} />
  </g>
);

/** 4 · LA SEMILLA. Lo que plantas hoy: cascara, brote y el germen adentro. */
const semilla = (c: string) => (
  <g>
    <path d="M50 16 C72 34 72 62 50 82 C28 62 28 34 50 16 Z" {...T(c)} />
    <path d="M50 82 C50 64 50 50 50 32" {...T(c, 5)} />
    <path d="M50 54 C41 50 35 42 34 34" {...T(c, 5)} />
    <path d="M50 44 C59 40 65 32 66 24" {...T(c, 5)} />
    <circle cx={50} cy={68} r={5} fill={c} />
  </g>
);

/** 5 · LA ESPIRAL. Crecimiento compuesto dibujado: cada vuelta es más grande que la anterior. */
const espiral = (c: string) => (
  <g>
    <path d="M52 50 C52 44 58 40 64 44 C72 49 70 62 58 66 C42 71 28 58 30 42 C32 24 50 12 68 16" {...T(c)} />
    <circle cx={52} cy={50} r={4.5} fill={c} />
  </g>
);

/** 6 · EL ENLACE. Dos cosas y lo que nace entre ellas: el video que mas lejos llego. */
const enlace = (c: string) => (
  <g>
    <circle cx={28} cy={58} r={15} {...T(c)} />
    <circle cx={72} cy={42} r={15} {...T(c)} />
    <path d="M40 50 C48 38 54 38 61 54" {...T(c, 5)} />
    <circle cx={50} cy={43} r={5} fill={c} />
  </g>
);

// ─────────────────────────────────────────────────────── Los cuatro módulos

/** HERMES — la moneda con alas: el dinero que va y viene. */
const hermes = (c: string) => (
  <g>
    <circle cx={50} cy={54} r={18} {...T(c)} />
    <path d="M32 46 C22 38 14 38 8 44 C16 50 24 52 32 52" {...T(c, 5)} />
    <path d="M68 46 C78 38 86 38 92 44 C84 50 76 52 68 52" {...T(c, 5)} />
    <path d="M44 50 L56 50 M44 58 L56 58 M50 44 L50 64" {...T(c, 5)} />
    <circle cx={50} cy={26} r={5} fill={c} />
  </g>
);

/** HEFESTOS — el yunque donde la pieza se hace, y la chispa del golpe. */
const hefestos = (c: string) => (
  <g>
    <path d="M18 44 L62 44 L84 51 L62 58 L58 58 C58 66 62 72 68 76 L32 76 C38 72 42 66 42 58 L18 58 Z" {...T(c, 6)} />
    <path d="M30 32 L36 24" {...T(c, 5)} />
    <path d="M50 28 L50 18" {...T(c, 5)} />
    <circle cx={68} cy={28} r={5} fill={c} />
  </g>
);

/** IRIS — la mensajera del arcoiris: tres ondas que salen de un punto y llegan. */
const iris = (c: string) => (
  <g>
    <path d="M14 74 A36 36 0 0 1 86 74" {...T(c)} />
    <path d="M26 74 A24 24 0 0 1 74 74" {...T(c)} />
    <path d="M38 74 A12 12 0 0 1 62 74" {...T(c)} />
    <circle cx={50} cy={74} r={6} fill={c} />
  </g>
);

/** ATHENA — la lechuza que ve de noche: dos ojos, y el dato que sube. */
const athena = (c: string) => (
  <g>
    <path d="M24 34 C24 20 40 14 50 24 C60 14 76 20 76 34 C76 58 64 78 50 78 C36 78 24 58 24 34 Z" {...T(c)} />
    <circle cx={39} cy={40} r={7} {...T(c, 5)} />
    <circle cx={61} cy={40} r={7} {...T(c, 5)} />
    <path d="M44 54 L50 66 L56 54 Z" {...T(c, 5)} />
    <circle cx={61} cy={40} r={3} fill={c} />
  </g>
);

export const GAIA_MARCAS: Marca[] = [
  { id: 'alfa', nombre: 'Alfa de un trazo', linea: 'La α del principio, sin levantar la pluma.', color: ORO, idea: 'Es la letra que ya usas en la app. Un solo trazo = un solo sistema del que sale todo.', dibujo: alfaTrazo },
  { id: 'ojo', nombre: 'El ojo', linea: 'Aprende a ver lo invisible.', color: ORO, idea: 'Es LA frase del canal, hecha forma. Funciona a 32 px y no se parece a ninguna otra GAIA registrada.', dibujo: alfaOjo },
  { id: 'planeta', nombre: 'El planeta', linea: 'Gaia es la Tierra: el sistema vivo.', color: ORO, idea: 'Literal del mito. Riesgo: es el logo más previsible; hay muchos planetas con órbita.', dibujo: planeta },
  { id: 'semilla', nombre: 'La semilla', linea: 'Lo que plantas hoy.', color: ORO, idea: 'La más cálida para un dueño de negocio. La primera versión se leía como el ojo tachado de «ocultar contraseña»: por eso ahora es cáscara, brote y germen.', dibujo: semilla },
  { id: 'espiral', nombre: 'La espiral', linea: 'Cada vuelta es más grande que la anterior.', color: ORO, idea: 'Crecimiento compuesto, que es el tema de toda la serie de economía.', dibujo: espiral },
  { id: 'enlace', nombre: 'El enlace', linea: 'Dos cosas y lo que nace entre ellas.', color: ORO, idea: 'El video de un enlace naciendo es el que más lejos llegó del canal. Dice conexión sin decir «red», y el punto de en medio es el acento de la familia.', dibujo: enlace },
];

export const MODULOS: Marca[] = [
  { id: 'hermes', nombre: 'Hermes', linea: 'Ventas, facturación e inventario.', color: '#34D399', idea: 'La moneda con alas del mensajero: lo que se vende va, y el dinero regresa. Es la más literal de las cuatro, a propósito: es la que ve el cliente que paga.', dibujo: hermes },
  { id: 'hefestos', nombre: 'Hefestos', linea: 'Producción y órdenes de trabajo.', color: '#46C2FF', idea: 'El yunque donde la pieza se hace, con las chispas del golpe. Se reconoce en una sola tinta y a 32 px, que es donde mueren casi todos los logos de producción.', dibujo: hefestos },
  { id: 'iris', nombre: 'Iris', linea: 'Comunicación entre tu gente.', color: '#A78BFA', idea: 'La diosa del arcoíris llevaba los mensajes: tres ondas que salen de un punto y llegan.', dibujo: iris },
  { id: 'athena', nombre: 'Athena', linea: 'Analítica: 60+ indicadores en vivo.', color: '#FDB813', idea: 'La lechuza que ve en la oscuridad, con el dato bajando al centro.', dibujo: athena },
];

/** Un dibujo en su cuadro, del tamaño que se pida. */
function Marco({ m, px, fondo, tinta }: { m: Marca; px: number; fondo: string; tinta?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={px} height={px} style={{ background: fondo, borderRadius: px * 0.18, display: 'block' }}>
      {m.dibujo(tinta ?? m.color)}
    </svg>
  );
}

/** El lockup: la marca y el nombre, como va en una factura o en una presentación. */
function Lockup({ m, sub, color, fondo }: { m: Marca; sub: string; color: string; fondo: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: fondo, padding: '14px 18px', borderRadius: 10 }}>
      <Marco m={m} px={46} fondo="transparent" tinta={color} />
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1.5, color, fontFamily: 'Manrope, system-ui, sans-serif' }}>{sub}</div>
        <div style={{ fontSize: 10.5, letterSpacing: 2.4, color: fondo === '#FFFFFF' ? '#6B7280' : '#8893A8', textTransform: 'uppercase' }}>{m.linea}</div>
      </div>
    </div>
  );
}

/** Descargar el SVG de una marca, listo para el IMPI o para la web. */
function bajarSVG(m: Marca, color: string, nombre: string) {
  const svg = document.getElementById(`svg-${nombre}`)?.outerHTML;
  if (!svg) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: 'image/svg+xml' }));
  a.download = `gaia-${nombre}.svg`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Ficha({ m, elegida, onElegir }: { m: Marca; elegida?: boolean; onElegir?: () => void }) {
  return (
    <div style={{
      border: '1px solid ' + (elegida ? m.color : 'rgba(255,255,255,0.10)'), borderRadius: 12, padding: 16,
      background: elegida ? 'rgba(253,184,19,0.06)' : 'rgba(255,255,255,0.02)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#E8EDF7' }}>{m.nombre}</div>
        {onElegir && (
          <button onClick={onElegir} style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: elegida ? m.color : 'transparent', color: elegida ? TINTA : '#8893A8',
            border: '1px solid ' + (elegida ? m.color : 'rgba(255,255,255,0.15)'),
          }}>{elegida ? '✓ esta' : 'elegir'}</button>
        )}
      </div>

      {/* Las cuatro pruebas que un logo tiene que pasar: color sobre negro, una tinta sobre
          blanco, tamaño de favicon, y el lockup con el nombre. */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <svg id={`svg-${m.id}`} viewBox="0 0 100 100" width={92} height={92} xmlns="http://www.w3.org/2000/svg"
               style={{ background: TINTA, borderRadius: 14, display: 'block' }}>{m.dibujo(m.color)}</svg>
          <div style={{ fontSize: 9.5, color: '#6B7280', textAlign: 'center', marginTop: 4 }}>color</div>
        </div>
        <div>
          <Marco m={m} px={92} fondo="#FFFFFF" tinta={TINTA} />
          <div style={{ fontSize: 9.5, color: '#6B7280', textAlign: 'center', marginTop: 4 }}>una tinta</div>
        </div>
        <div>
          <Marco m={m} px={32} fondo={TINTA} />
          <div style={{ fontSize: 9.5, color: '#6B7280', textAlign: 'center', marginTop: 4 }}>32 px</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Lockup m={m} sub={m.id === 'hermes' || m.id === 'hefestos' || m.id === 'iris' || m.id === 'athena' ? m.nombre.toUpperCase() : 'GAIA PRIME'} color={m.color} fondo="#0B0E14" />
      </div>

      <div style={{ fontSize: 11.5, color: '#8893A8', marginTop: 10, lineHeight: 1.5 }}>{m.idea}</div>
      <button onClick={() => bajarSVG(m, m.color, m.id)} style={{
        marginTop: 10, padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
        background: 'transparent', color: '#8893A8', border: '1px solid rgba(255,255,255,0.15)',
      }}>bajar SVG</button>
    </div>
  );
}

export default function Logos() {
  const [elegida, setElegida] = useState<string | null>(null);

  return (
    <div>
      <div style={{ fontSize: 12.5, color: '#8893A8', marginBottom: 16, lineHeight: 1.6, maxWidth: 760 }}>
        Seis caminos para GAIA. <strong style={{ color: '#E8EDF7' }}>Elige uno</strong> (el botón «elegir» lo marca)
        y los otros cinco se mueren: una marca es la que se repite mil veces, no la que gusta un día. Cada una se
        muestra como se va a usar de verdad: en color sobre negro, en una sola tinta sobre blanco (así se manda al
        IMPI y así se graba), a 32 px (el favicon y el icono de la app), y con el nombre al lado.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
        {GAIA_MARCAS.map((m) => (
          <Ficha key={m.id} m={m} elegida={elegida === m.id} onElegir={() => setElegida(elegida === m.id ? null : m.id)} />
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#E8EDF7', margin: '26px 0 6px' }}>La cara comercial de los módulos</div>
      <div style={{ fontSize: 12.5, color: '#8893A8', marginBottom: 14, lineHeight: 1.6, maxWidth: 760 }}>
        Cada módulo con el color que YA usa en el producto, y una forma que se explica en una frase: si hay que
        explicarla en dos, está mal. Van en la misma familia que GAIA: mismo grosor de línea, mismas puntas
        redondas y un punto sólido de acento en cada una.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
        {MODULOS.map((m) => <Ficha key={m.id} m={m} />)}
      </div>
    </div>
  );
}
