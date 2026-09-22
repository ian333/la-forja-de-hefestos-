import React from "react";

/**
 * COPIA LITERAL de `lia-video-engine/render/src/dibujos/naranjas.tsx`.
 *
 * Es el MISMO dibujo que la gente acaba de ver en el video de 40 s: si aquí el
 * puesto se viera distinto, la página no sería el aterrizaje del video, sería
 * otra cosa. Por eso se copia en vez de reinventarse, y por eso el ÚNICO cambio
 * respecto al original es de dónde salen las fuentes:
 *
 *   - Allá:  `import { CAVEAT, MANROPE } from "../lib/fuentes"` → @remotion/google-fonts,
 *            que resuelve el nombre de la familia al empaquetar el video.
 *   - Acá:   constantes CSS. Las familias las carga `chuy.html` con un <link> de
 *            Google Fonts (`display=swap`) y el fallback pinta ANTES de que baje
 *            la fuente — que es lo que importa dentro del navegador de Instagram.
 *
 * Nada de Remotion entra a esta página: estos componentes son SVG puro, sin
 * hooks ni reloj. Quien los usa (LibretaChuy) les pasa el estado ya calculado.
 */
const MANROPE = "Manrope, system-ui, sans-serif";
const CAVEAT = "Caveat, cursive";

const PIEL = "#B97A4F";
const MADERA = "#8A5A3C";
const MADERA_OSCURA = "#5E3C28";

export const NARANJA = "#F28C28";

/**
 * La calle: fachadas de colonia, la banqueta y la luz de las ventanas.
 *
 * Se sale del lienzo de 1000 a proposito, hacia los lados y hacia abajo: el dibujo
 * llena la pantalla en vertical y en horizontal en vez de quedar como una tarjeta
 * cuadrada sobre fondo oscuro. Lo que importa -cifras, globos, personajes- sigue
 * dentro del cuadrado, que es lo que cae en la caja segura.
 */
const FACHADAS: Array<[number, number, number, string]> = [
  [-1400, 190, 460, "#24313D"], [-940, 130, 470, "#3A2F2B"], [-470, 230, 470, "#2F3847"],
  [0, 150, 470, "#2B2438"], [470, 210, 530, "#24313D"], [1000, 170, 480, "#3A2F2B"],
  [1480, 240, 460, "#2B2438"], [1940, 150, 500, "#2F3847"],
];

export const Calle: React.FC = () => (
  <g>
    <rect x={-2000} y={-1500} width={5000} height={4000} fill="#141926" />
    {FACHADAS.map(([x, y, w, c]) => (
      <g key={x}>
        <rect x={x} y={y} width={w} height={820 - y} fill={c} />
        {[x + 70, x + w - 190].map((vx) => (
          <g key={vx}>
            <rect x={vx} y={y + 100} width={120} height={110} rx={6} fill="#FFD58A" opacity={0.22} />
            <line x1={vx + 60} y1={y + 100} x2={vx + 60} y2={y + 210} stroke="#141926" strokeWidth={6} />
          </g>
        ))}
      </g>
    ))}
    <rect x={-2000} y={820} width={5000} height={2700} fill="#2A2F3A" />
    <rect x={-2000} y={820} width={5000} height={10} fill="#3A4152" />
  </g>
);

/** Una naranja con su hojita. */
export const Naranja: React.FC<{ x: number; y: number; r?: number; op?: number; podrida?: boolean }> = ({
  x, y, r = 22, op = 1, podrida = false,
}) => (
  <g opacity={op}>
    <circle cx={x} cy={y} r={r} fill={podrida ? "#7A5A2E" : NARANJA} />
    {podrida ? (
      <>
        <circle cx={x - r * 0.3} cy={y + r * 0.1} r={r * 0.22} fill="#4A3519" />
        <circle cx={x + r * 0.35} cy={y - r * 0.25} r={r * 0.16} fill="#4A3519" />
        <circle cx={x + r * 0.1} cy={y + r * 0.45} r={r * 0.12} fill="#8FA36B" opacity={0.8} />
      </>
    ) : (
      <>
        <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.28} fill="#FFFFFF" opacity={0.25} />
        <circle cx={x + r * 0.2} cy={y + r * 0.2} r={r * 0.9} fill="#B8561A" opacity={0.18} />
      </>
    )}
    <ellipse cx={x + r * 0.3} cy={y - r * 0.95} rx={r * 0.35} ry={r * 0.16} fill={podrida ? "#6B6B3A" : "#3DDC97"} transform={`rotate(-25 ${x + r * 0.3} ${y - r * 0.95})`} />
  </g>
);

/** La mesa del puesto, con su mantel de rayas. */
export const Mesa: React.FC = () => (
  <g>
    <rect x={335} y={660} width={16} height={165} fill={MADERA_OSCURA} />
    <rect x={669} y={660} width={16} height={165} fill={MADERA_OSCURA} />
    <rect x={310} y={632} width={400} height={26} rx={6} fill={MADERA} />
    {Array.from({ length: 10 }, (_, i) => (
      <rect key={i} x={310 + i * 40} y={658} width={40} height={96} fill={i % 2 ? "#F2F5FA" : "#E4572E"} />
    ))}
  </g>
);

/** Don Chuy: gorra, bigote y mandil. `sonrisa` de -1 (triste) a 1 (contento). */
export const DonChuy: React.FC<{ x: number; y: number; sonrisa?: number; parpadeo?: number }> = ({
  x, y, sonrisa = 1, parpadeo = 0,
}) => {
  const ojo = Math.max(0.08, 1 - parpadeo);
  const curva = 12 * sonrisa;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-112} y={-20} width={38} height={140} rx={19} fill="#3E7CB1" />
      <rect x={74} y={-20} width={38} height={140} rx={19} fill="#3E7CB1" />
      <path d="M -90 150 L -90 10 Q -90 -38 -38 -40 L 38 -40 Q 90 -38 90 10 L 90 150 Z" fill="#3E7CB1" />
      <path d="M -90 150 L -90 10 Q -90 -38 -38 -40 L 38 -40 Q 90 -38 90 10 L 90 150 Z" fill="url(#volumen)" />
      <rect x={74} y={-20} width={38} height={140} rx={19} fill="#000" opacity={0.16} />
      <rect x={-16} y={-58} width={32} height={24} fill={PIEL} />
      <path d="M -54 -2 L 54 -2 L 62 150 L -62 150 Z" fill="#E9EEF5" />
      <rect x={-20} y={40} width={40} height={30} rx={4} fill="#D0D7E2" />
      <circle cx={0} cy={-108} r={60} fill={PIEL} />
      <path d="M 20 -164 A 60 60 0 0 1 20 -52 A 70 70 0 0 0 20 -164 Z" fill="#000" opacity={0.12} />
      <rect x={-16} y={-58} width={32} height={10} fill="#000" opacity={0.18} />
      {/* Gorra */}
      <path d="M -62 -118 Q -60 -176 0 -176 Q 60 -176 62 -118 Z" fill="#D8576B" />
      <path d="M 30 -122 Q 70 -128 96 -112 L 60 -112 Z" fill="#B8475A" />
      {/* Cara */}
      <ellipse cx={-20} cy={-106} rx={6} ry={6 * ojo} fill="#1A1F2B" />
      <ellipse cx={20} cy={-106} rx={6} ry={6 * ojo} fill="#1A1F2B" />
      <path d="M -26 -80 Q -12 -90 0 -84 Q 12 -90 26 -80 Q 12 -76 0 -80 Q -12 -76 -26 -80 Z" fill="#2B211C" />
      <path d={`M -14 -66 Q 0 ${-66 + curva} 14 -66`} stroke="#1A1F2B" strokeWidth={5} fill="none" strokeLinecap="round" />
    </g>
  );
};

/** La lata donde guarda lo que cobra. `golpe` la hace saltar. */
export const Lata: React.FC<{ x: number; y: number; golpe?: number }> = ({ x, y, golpe = 0 }) => (
  <g transform={`translate(${x} ${y - 10 * golpe})`}>
    <rect x={-38} y={-92} width={76} height={92} rx={8} fill="#9AA6BF" />
    <ellipse cx={0} cy={-92} rx={38} ry={10} fill="#C9D1DF" />
    <rect x={-38} y={-66} width={76} height={40} fill="#F7B32B" />
    <text x={0} y={-36} textAnchor="middle" fontFamily={MANROPE} fontWeight={800} fontSize={30} fill="#1A1F2B">$</text>
  </g>
);

/** La camioneta del proveedor, de lado, viendo a la derecha. `x` es su defensa trasera. */
export const Camioneta: React.FC<{ x: number }> = ({ x }) => (
  <g transform={`translate(${x} 0)`}>
    <rect x={0} y={640} width={190} height={130} rx={10} fill="#4C6A8A" />
    {[30, 70, 110, 150].map((cx) => <Naranja key={cx} x={cx} y={628} r={20} />)}
    <path d="M 190 770 L 190 600 Q 190 580 210 580 L 250 580 Q 270 580 280 610 L 300 680 L 300 770 Z" fill="#5B7FA6" />
    <path d="M 205 596 L 250 596 Q 262 596 268 614 L 280 660 L 205 660 Z" fill="#AFD3F0" opacity={0.85} />
    <rect x={0} y={760} width={305} height={22} rx={6} fill="#3A4152" />
    {[65, 240].map((cx) => (
      <g key={cx}>
        <circle cx={cx} cy={790} r={34} fill="#1A1F2B" />
        <circle cx={cx} cy={790} r={14} fill="#9AA6BF" />
      </g>
    ))}
    <text x={95} y={722} textAnchor="middle" fontFamily={MANROPE} fontWeight={800} fontSize={26} fill="#E9EEF5" letterSpacing={1}>
      PROVEEDOR
    </text>
  </g>
);

/** Un vecino que compra: cabeza, cuerpo y bolsa. */
export const Vecino: React.FC<{ x: number; color: string; pelo: string }> = ({ x, color, pelo }) => (
  <g transform={`translate(${x} 0)`}>
    <path d="M -46 822 L -46 660 Q -46 626 -14 624 L 14 624 Q 46 626 46 660 L 46 822 Z" fill={color} />
    <path d="M -46 822 L -46 660 Q -46 626 -14 624 L 14 624 Q 46 626 46 660 L 46 822 Z" fill="url(#volumen)" />
    <circle cx={0} cy={580} r={40} fill="#C98C5E" />
    <path d="M -41 578 Q -40 532 0 532 Q 40 532 41 578 Q 22 556 0 556 Q -22 556 -41 578 Z" fill={pelo} />
    <circle cx={-13} cy={584} r={4.5} fill="#1A1F2B" />
    <circle cx={13} cy={584} r={4.5} fill="#1A1F2B" />
    <path d="M -9 600 Q 0 607 9 600" stroke="#1A1F2B" strokeWidth={3.5} fill="none" strokeLinecap="round" />
  </g>
);

/** Un billete de cien, rojo como el de verdad. */
export const BilleteCien: React.FC<{ x: number; y: number; s?: number; rot?: number; op?: number }> = ({
  x, y, s = 1, rot = 0, op = 1,
}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={op}>
    <rect x={-55} y={-27} width={110} height={54} rx={7} fill="#E06B6B" stroke="#A94444" strokeWidth={3} />
    <circle cx={-26} cy={0} r={13} fill="#C85656" />
    <text x={16} y={9} textAnchor="middle" fontFamily={MANROPE} fontWeight={800} fontSize={24} fill="#5A1F1F">$100</text>
  </g>
);

/** Un globito de lo que dice un vecino. */
export const Globo: React.FC<{ x: number; y: number; texto: string; op?: number; s?: number }> = ({ x, y, texto, op = 1, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={op}>
    <rect x={-150} y={-44} width={300} height={80} rx={26} fill="#F2F5FA" />
    <path d="M -10 34 L 10 34 L -2 62 Z" fill="#F2F5FA" />
    <text x={0} y={12} textAnchor="middle" fontFamily={CAVEAT} fontWeight={700} fontSize={40} fill="#2B3A67">{texto}</text>
  </g>
);

/** Una pastilla con una cifra encima de algo. */
export const Pastilla: React.FC<{ x: number; y: number; texto: string; color: string; s?: number; op?: number }> = ({
  x, y, texto, color, s = 1, op = 1,
}) => {
  const ancho = Math.max(150, texto.length * 28 + 50);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={op}>
      <rect x={-ancho / 2} y={-40} width={ancho} height={78} rx={39} fill="#0B0E14" opacity={0.9} />
      <text x={0} y={14} textAnchor="middle" fontFamily={MANROPE} fontWeight={800} fontSize={46} fill={color}>{texto}</text>
    </g>
  );
};

/**
 * Las sombras y la luz: lo que le da peso al dibujo plano sin volverlo otra cosa.
 * Una sola vez por cuadro, dentro del <svg>, antes de todo lo que las usa.
 */
export const Luces: React.FC = () => (
  <defs>
    <filter id="sombra" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx={0} dy={8} stdDeviation={7} floodColor="#000" floodOpacity={0.45} />
    </filter>
    <filter id="sombra-alta" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx={0} dy={22} stdDeviation={12} floodColor="#000" floodOpacity={0.35} />
    </filter>
    <filter id="difuso" x="-50%" y="-200%" width="200%" height="500%">
      <feGaussianBlur stdDeviation={9} />
    </filter>
    <linearGradient id="volumen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0.5" stopColor="#000" stopOpacity={0} />
      <stop offset="1" stopColor="#000" stopOpacity={0.24} />
    </linearGradient>
    <radialGradient id="farol" gradientUnits="userSpaceOnUse" cx={520} cy={520} r={460}>
      <stop offset="0" stopColor="#FFD58A" stopOpacity={0.2} />
      <stop offset="1" stopColor="#FFD58A" stopOpacity={0} />
    </radialGradient>
    <radialGradient id="vineta" gradientUnits="userSpaceOnUse" cx={500} cy={540} r={1000}>
      <stop offset="0.45" stopColor="#000" stopOpacity={0} />
      <stop offset="1" stopColor="#000" stopOpacity={0.6} />
    </radialGradient>
  </defs>
);

/** La sombra en el piso de algo que esta parado en la banqueta. */
export const SombraPiso: React.FC<{ x: number; y?: number; rx: number; ry?: number; op?: number }> = ({
  x, y = 826, rx, ry = 12, op = 0.45,
}) => <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#000" opacity={op} filter="url(#difuso)" />;

/** La casa de Don Chuy: a donde se va el dinero que no es del negocio. */
export const Casita: React.FC<{ x: number; y: number; op?: number }> = ({ x, y, op = 1 }) => (
  <g transform={`translate(${x} ${y})`} opacity={op} filter="url(#sombra)">
    <rect x={-70} y={-80} width={140} height={90} rx={6} fill="#C9A27A" />
    <path d="M -86 -76 L 0 -142 L 86 -76 Z" fill="#B8475A" />
    <rect x={-22} y={-40} width={44} height={50} rx={4} fill="#5E3C28" />
    <rect x={30} y={-62} width={30} height={26} rx={3} fill="#FFD58A" />
    <text x={0} y={46} textAnchor="middle" fontFamily={MANROPE} fontWeight={800} fontSize={26} fill="#E9EEF5" letterSpacing={2}>
      CASA
    </text>
  </g>
);

/** El bote de basura, a la derecha de la mesa. */
export const Basura: React.FC<{ x: number; y: number; op?: number }> = ({ x, y, op = 1 }) => (
  <g transform={`translate(${x} ${y})`} opacity={op} filter="url(#sombra)">
    <path d="M -34 -86 L 34 -86 L 28 0 L -28 0 Z" fill="#6D7E94" />
    <rect x={-40} y={-98} width={80} height={14} rx={5} fill="#9AA6BF" />
    {[-14, 0, 14].map((dx) => <line key={dx} x1={dx} y1={-72} x2={dx * 0.85} y2={-12} stroke="#56657A" strokeWidth={4} />)}
  </g>
);

/** El letrerito del precio en el mantel. `antes` sale tachado a la izquierda. */
export const Letrero: React.FC<{ texto: string; antes?: string; op?: number }> = ({ texto, antes, op = 1 }) => {
  const ancho = antes ? 250 : 150;
  const x0 = 523 - ancho / 2;
  return (
    <g opacity={op} filter="url(#sombra)">
      <rect x={x0} y={672} width={ancho} height={66} rx={10} fill="#1C2333" stroke="#A8714C" strokeWidth={5} />
      {antes ? (
        <>
          <text x={x0 + 52} y={718} textAnchor="middle" fontFamily={CAVEAT} fontWeight={700} fontSize={40} fill="#9AA6BF">{antes}</text>
          <line x1={x0 + 18} y1={706} x2={x0 + 88} y2={700} stroke="#FF5C6C" strokeWidth={6} strokeLinecap="round" />
          <text x={x0 + 170} y={718} textAnchor="middle" fontFamily={CAVEAT} fontWeight={700} fontSize={44} fill="#F2F5FA">{texto}</text>
        </>
      ) : (
        <text x={523} y={718} textAnchor="middle" fontFamily={CAVEAT} fontWeight={700} fontSize={44} fill="#F2F5FA">{texto}</text>
      )}
    </g>
  );
};

/** Lluvia: rayitas que caen, puras en el segundo `T`. */
export const Lluvia: React.FC<{ T: number; op?: number }> = ({ T, op = 1 }) => (
  <g opacity={op}>
    <rect x={-2000} y={-1500} width={5000} height={4000} fill="#0B1220" opacity={0.28} />
    {Array.from({ length: 140 }, (_, i) => {
      const x0 = ((i * 137.5) % 2600) - 800;
      const vel = 900 + (i % 7) * 60;
      const y = ((((i * 311) % 1400) + T * vel) % 1600) - 300;
      const x = x0 - (y + 300) * 0.18;
      return <line key={i} x1={x} y1={y} x2={x - 9} y2={y + 46} stroke="#AFC6E0" strokeWidth={3} opacity={0.5} strokeLinecap="round" />;
    })}
  </g>
);
