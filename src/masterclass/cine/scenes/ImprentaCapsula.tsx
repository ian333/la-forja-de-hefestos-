/**
 * ImprentaCapsula — CÁPSULA #1 de la serie "La economía son ideas" (30 s, 9:16).
 *
 * LA IDEA CONCRETA: la imprenta (1440). La FÍSICA de la idea ES el espectáculo:
 * una página se imprime (barra de luz que barre) y se COPIA en cascada exponencial
 * hasta inundar el cielo de la nebulosa. Costo de copia → 0. El público llega solo
 * a la conclusión de Romer — sin que nadie diga "Romer" ni "Nobel".
 *
 * Doctrina de animación (Ian, batuta total): NADA se anima a mano. La LEY mueve la
 * imagen (PagePrint es puro en t); la CÁMARA pone el cine (un empuje continuo con
 * peso); el GRADE/NebulaWorld ponen la firma. Guion: gancho → explicación → tesis.
 *
 * Determinista por __cineT → stills shot-clase.cjs, render render-clase.cjs
 * (ID=imprenta-capsula, END=30, FMT=916). Voz Matilda se clava después.
 */
import { CineStage, CineCamera } from '@/masterclass/cine';
import NebulaWorld from '@/masterclass/cine/NebulaWorld';
import PagePrint from './PagePrint';
import type { CineCamKey } from '@/masterclass/cine/CineCamera';

// UN empuje continuo con peso (no cortes): close en la página → pull-back que
// revela la multiplicación → subida final al cielo de páginas (peak-end).
const SHOTS: CineCamKey[] = [
  { t: 0,  pos: [0, 0.0, 3.8], look: [0, 0, 0] },       // close: la página que se imprime
  { t: 9,  pos: [0, 0.25, 3.35], look: [0, 0, 0] },     // push suave al terminar de imprimir
  { t: 16, pos: [0, 1.0, 8.6], look: [0, -0.1, -3] },   // pull-back: la cascada LLENA el cuadro
  { t: 24, pos: [0, 1.9, 10.8], look: [0, 0.4, -5] },   // sube y deriva; la retícula sigue llena
  { t: 31, pos: [0, 2.5, 11.8], look: [0, 0.9, -6] },   // subida final: el cielo de páginas, lleno
];

// GUION (gancho → explicación → tesis). Sin mencionar Romer/Nobel.
// Los tiempos vienen de las DURACIONES REALES de la voz Matilda (aire ~0.6 s
// entre líneas; la tesis final acaba en 30.8 → el video dura 31 s).
const LINES: [number, string][] = [
  [0.5,   'Esta hoja está por hacer algo imposible.'],
  [4.2,   'Copiarse a sí misma. Sin gastarse nunca.'],
  [9.0,   'Antes, copiar un libro tomaba meses.'],
  [12.85, 'La imprenta tiró ese costo casi a cero.'],
  [16.5,  'Una idea que copiar cuesta cero…'],
  [19.45, '…se derrama sobre todo el mundo.'],
  [22.3,  'Cambió cómo hablamos. Y con eso, la economía entera.'],
  [27.25, 'Porque la economía, en el fondo, son ideas.'],
];
const END = 31;
const subtitles = LINES.map(([at, text], i) => ({
  text, at, until: i < LINES.length - 1 ? LINES[i + 1][0] - 0.25 : END,
}));

export default function ImprentaCapsula() {
  return (
    <CineStage
      mood="starry_night"
      envIntensity={0.42}
      duration={END}
      chapter="GAIA · las ideas"
      fov={42}
      cameraPos={[0, 0, 3.8]}
      postfx={{ intensity: 1.2, threshold: 0.5, vignette: 0.82, aberration: 0.0005 }}
      subtitles={subtitles}
      title={{ text: 'LA IMPRENTA · 1440', at: 9.5, until: 15 }}
    >
      <CineCamera keys={SHOTS} live={0.5} smooth />

      {/* el mundo-nebulosa: frío → la impresión ENCIENDE el mundo (2.6) → cascada
          de estrellas acompaña la copia → AMANECER dorado cuando inunda el cielo */}
      <NebulaWorld
        scale={32}
        holeR={15}
        energyBase={0.20}
        ghostWindow={[0.3, 2.2]}
        firstIgnite={2.6}
        chain={[9.5, 11, 12.5, 14, 15.5, 17]}
        igniteStars={false}
        dawnAt={17}
        sat={1.45}
        starBright={1.3}
      />
      <ambientLight intensity={0.2} color="#1E2440" />
      <directionalLight position={[4, 10, 5]} intensity={0.4} color="#FFE6C0" />

      {/* LA IMPRENTA — puro en t, cero keyframes */}
      <PagePrint />
    </CineStage>
  );
}
