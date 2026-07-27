/**
 * BrujulaCapsula — CÁPSULA #2 de la serie "La economía son ideas" (31 s, 9:16).
 *
 * LA IDEA CONCRETA: la brújula (s. XI). La FÍSICA de la idea ES el espectáculo:
 * una aguja perdida deriva sin rumbo; su campo dipolar despierta (r=L·sin²θ real,
 * partículas fluyendo con estela) y el TORQUE la clava al norte — la letra N de
 * la rosa flamea. Al amanecer, las líneas exteriores del campo se vuelven ORO:
 * las rutas que conectaron el mundo. Romer cae solo al final, sin nombrarlo.
 *
 * Rosa de los vientos = grabado REAL (TikZ+EB Garamond → textura máscara), igual
 * que la imprenta llevó su incunable. Cámara: UN empuje continuo (smooth PCHIP).
 * Guion → voz Matilda → beats retimados con duraciones reales (assemble-offsets).
 */
import { CineStage, CineCamera } from '@/masterclass/cine';
import NebulaWorld from '@/masterclass/cine/NebulaWorld';
import BrujulaCompas from './BrujulaCompas';
import type { CineCamKey } from '@/masterclass/cine/CineCamera';

// cámara: CLAVADO de apertura (nace DENTRO de la tormenta saturada — el cuadro 1
// es color + la brújula pequeña como objetivo = "estás perdido" hecho cámara,
// looming/aproximación) → llega al diagonal cerrado en t≈4 → SERPENTEA de lado
// a lado mientras la aguja busca, ATRAVIESA el campo cuando enciende (los arcos
// pasan rozando = parallax = velocidad sentida) y orbita al final. PCHIP C1.
const SHOTS: CineCamKey[] = [
  // el clavado es un ARCO: cruza LATERAL mientras cae (parallax = la tormenta
  // barre el cuadro; la aproximación radial pura casi no genera movimiento visto)
  { t: 0,   pos: [3.0, 2.2, 9.0],     look: [0, 0.05, 0] },
  { t: 1.4, pos: [0.2, 1.1, 6.2],     look: [0, 0.05, 0] },
  { t: 4.2, pos: [0.85, -0.45, 2.05], look: [0.05, 0.05, 0] },
  { t: 6.8, pos: [-0.70, 0.30, 2.45], look: [0, 0.02, 0] },
  { t: 9,   pos: [0.45, -0.15, 3.05], look: [0, 0.02, 0] },
  { t: 13,  pos: [-0.60, 0.50, 4.20], look: [0, 0.08, -0.3] },
  { t: 18,  pos: [0.40, 0.75, 5.60],  look: [0, 0.18, -0.8] },
  { t: 25,  pos: [-0.40, 1.05, 7.00], look: [0, 0.30, -1.4] },
  { t: 34,  pos: [0, 1.35, 8.60],     look: [0, 0.45, -1.9] },
];

// GUION (gancho → explicación → tesis). Tiempos = duraciones REALES de la voz
// Matilda (aire ~0.55 s); la tesis acaba en 33.8 → el video dura 34 s.
const LINES: [number, string][] = [
  [0.5,   'En medio del océano, sin costa ni estrellas, estás perdido.'],
  [5.6,   'Salvo que tengas esta piedra que apunta.'],
  [9.3,   'Una aguja imantada se alinea sola con la Tierra.'],
  [13.85, 'Siempre marca el norte. Sin sol, sin mapa, sin nada.'],
  [18.85, 'Con eso, los barcos cruzaron océanos que nadie cruzaba.'],
  [23.5,  'Y el comercio dejó de tener orillas.'],
  [26.45, 'Una piedra que apunta conectó al mundo entero.'],
  [30.45, 'Porque la economía, en el fondo, son ideas.'],
];
const END = 34;
const subtitles = LINES.map(([at, text], i) => ({
  text, at, until: i < LINES.length - 1 ? LINES[i + 1][0] - 0.25 : END,
}));

export default function BrujulaCapsula() {
  return (
    <CineStage
      mood="starry_night"
      envIntensity={0.42}
      duration={END}
      chapter="GAIA · las ideas"
      fov={42}
      cameraPos={[0.42, -0.18, 1.55]}
      postfx={{ intensity: 1.25, threshold: 0.5, vignette: 0.82, aberration: 0.0005 }}
      subtitles={subtitles}
      brand={{ name: 'La brújula', sub: 's. XI', at: 2.4 }}
    >
      <CineCamera keys={SHOTS} live={0.7} smooth />

      {/* mundo-nebulosa: TORMENTA violenta y saturada desde el cuadro 1 (el
          gancho mide sat≥0.6 vs los virales — detector-gancho --perfil empirico);
          la ignición ES el campo (9 s); amanecer 17 */}
      <NebulaWorld
        scale={32}
        holeR={15}
        energyBase={0.65}
        exposure={0.66}
        ghostWindow={[0.3, 2.2]}
        firstIgnite={9.0}
        chain={[]}
        igniteStars={false}
        dawnAt={17}
        sat={2.0}
        starBright={1.3}
      />
      <ambientLight intensity={0.2} color="#1E2440" />
      <directionalLight position={[4, 10, 5]} intensity={0.4} color="#FFE6C0" />

      {/* LA BRÚJULA — pura en t, cero keyframes */}
      <BrujulaCompas />
    </CineStage>
  );
}
