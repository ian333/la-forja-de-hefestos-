/**
 * RomerCapsula1 — CÁPSULA #1 de Romer (mecanismo desnudo, 33 s, 9:16):
 * "LAS IDEAS GENERAN VALOR — Y ESE VALOR GENERA RIQUEZA".
 *
 * EL ELENCO SE QUEDA EN PANTALLA (nada de utilería que aparece y desaparece):
 * 7 PERSONAS DE POLVO (DustFigure, destilado del Sandman) viven en el claro de
 * NebulaWorld desde el frame 1. Lo que viaja es la LUZ:
 *
 *   0-9    LA IDEA      — todas en silueta; a la protagonista le nace una
 *                         chispa en el pecho y se enciende de adentro afuera.
 *   9-20   LA COPIA     — la luz SALTA de persona en persona (no-rival: nadie
 *                         se apaga por compartir). La cadena de estrellas de la
 *                         nube acompaña cada encendido.
 *   20-33  LA RIQUEZA   — la multitud iluminada ve crecer su barra DORADA
 *                         (exponencial vs capital gris plano) y la nube entera
 *                         hace el AMANECER.
 *
 * Determinista por __cineT → stills shot-clase.cjs, render render-clase.cjs
 * (ID=romer-capsula-1). Voz Matilda DESPUÉS (sim primero).
 */
import { CineStage, CineCamera } from '@/masterclass/cine';
import NebulaWorld from '@/masterclass/cine/NebulaWorld';
import DustFigure from '@/masterclass/cine/DustFigure';
import { PayoffBars } from './RomerClase';
import type { CineCamKey } from '@/masterclass/cine/CineCamera';

// Cortes secos por acto + deriva leve (ritmo reel).
const SHOTS: CineCamKey[] = [
  { t: 0,    pos: [0.55, 1.45, 4.4], look: [0, 1.3, 0.4],  cut: true },  // la protagonista, cerca
  { t: 8.6,  pos: [0.15, 1.55, 3.7], look: [0, 1.32, 0.4] },
  { t: 9,    pos: [3.0, 1.8, 7.0],   look: [0, 1.1, -0.8], cut: true },  // la multitud: la luz salta
  { t: 19.6, pos: [-2.6, 2.1, 7.2],  look: [0, 1.1, -0.8] },
  { t: 20,   pos: [0, 1.3, 8.0],     look: [0.4, 2.2, -5], cut: true },  // sobre la multitud → la barra
  { t: 33,   pos: [0, 6.0, 12.5],    look: [1.0, 7.5, -5] },             // la cámara SUBE con la riqueza
];

// El elenco: [x, z, rotY, igniteAt, idleOffset, seed]
const CAST: Array<[number, number, number, number, number, number]> = [
  [0.0,  0.5,  0.35, 2.2,  0.0, 11],   // la PROTAGONISTA
  [-2.1, -0.8, 0.90, 10.5, 1.3, 22],
  [2.3,  -0.5, -0.70, 12.0, 2.1, 33],
  [-1.2, -2.4, 0.30, 13.5, 0.7, 44],
  [1.5,  -2.6, -0.20, 15.0, 2.9, 55],
  [-3.2, -3.5, 1.10, 16.5, 1.7, 66],
  [3.4,  -3.2, -1.00, 18.0, 3.4, 77],
];

export default function RomerCapsula1() {
  return (
    <CineStage
      mood="starry_night"
      envIntensity={0.42}
      duration={33}
      chapter="GAIA"
      fov={52}
      cameraPos={[0.55, 1.45, 4.4]}
      postfx={{ intensity: 1.15, threshold: 0.5, vignette: 0.82, aberration: 0.0005 }}
    >
      <CineCamera keys={SHOTS} />

      {/* el mundo-nebulosa: fría → la protagonista ENCIENDE (2.2) → la cadena
          acompaña cada persona que prende → AMANECER dorado con la riqueza */}
      <NebulaWorld
        scale={32}
        holeR={13}
        energyBase={0.22}
        ghostWindow={[0.3, 2.0]}
        firstIgnite={2.2}
        chain={[22, 24, 26, 28, 30]}
        dawnAt={20.5}
        beatTimes={[9, 20]}
        sat={1.45}
        starBright={1.35}
      />
      <ambientLight intensity={0.2} color="#1E2440" />
      <directionalLight position={[4, 10, 5]} intensity={0.4} color="#FFE6C0" />

      {/* EL ELENCO — 7 personas de polvo, en pantalla TODO el video */}
      {CAST.map(([x, z, rotY, igniteAt, idleOffset, seed], i) => (
        <DustFigure key={i} position={[x, 0, z]} rotationY={rotY}
          igniteAt={igniteAt} idleOffset={idleOffset} seed={seed * 7919 + 13}
          grains={i === 0 ? 46000 : 30000} height={1.8 - (i % 3) * 0.04} />
      ))}

      {/* LA RIQUEZA: las barras crecen DETRÁS de la multitud (acto 3) */}
      <group position={[0, 0, -5]}>
        <PayoffBars start={20} end={33} />
      </group>
    </CineStage>
  );
}
