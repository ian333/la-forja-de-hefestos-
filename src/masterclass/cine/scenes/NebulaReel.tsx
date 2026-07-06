/**
 * NebulaReel — REEL VERTICAL 9:16 de 30s (TikTok/IG/Shorts) hecho con las MEJORES
 * animaciones YA TRABAJADAS de RomerClase (reutilizadas, no duplicadas), montadas
 * en un timeline comprimido con CORTES rápidos y la voz nueva (gancho México-Corea).
 *
 * NO es la clase de 4 min (esa va a YouTube). Es el anzuelo viral: el rombo que
 * enciende → las IDEAS → la pirámide que se multiplica → el enjambre + amanecer.
 * Determinista por __cineT → render con scripts/render-clase.cjs (ID=reel-nebula).
 *
 * Audio: scripts/voice-gaia/script-reel-nebula.json (5 frases Matilda), muxeado
 * aparte por ffmpeg con los offsets del vuelo (no va en este componente).
 *
 * SELECCIÓN (cortes secos, ritmo reel):
 *   0-9s   OpeningCrystal  — el rombo apagado que ENCIENDE  ("México era más rico…")
 *   9-15s  SingleIdea      — la idea brillando               ("…fue una idea")
 *   15-23s IdeaTree        — la pirámide / bola de nieve      ("se multiplica")
 *   23-30s IdeaMultiply    — el enjambre que se copia + amanecer ("del trompo al transistor")
 */
import { CineStage, CineCamera } from '@/masterclass/cine';
import NebulaWorld from '@/masterclass/cine/NebulaWorld';
import { OpeningCrystal, SingleIdea, IdeaTree, IdeaMultiply } from './RomerClase';
import type { CineCamKey } from '@/masterclass/cine/CineCamera';

// Cámara: CORTES secos a cada escena (cut:true) con leve deriva — ritmo TikTok.
const SHOTS: CineCamKey[] = [
  { t: 0,    pos: [-1.5, 3.2, 11], look: [0, 2.7, 0], cut: true },  // rombo (apagado→enciende)
  { t: 8.6,  pos: [1.5, 2.9, 8.5], look: [0, 2.7, 0] },
  { t: 9,    pos: [2, 2.4, 7.5],   look: [0, 2.2, 0], cut: true },  // la IDEA
  { t: 14.8, pos: [-1.5, 2.6, 6.5],look: [0, 2.2, 0] },
  { t: 15,   pos: [3, 8, 14],      look: [0, 5, 0],   cut: true },  // la PIRÁMIDE (alto)
  { t: 22.8, pos: [-2, 6, 12],     look: [0, 5.5, 0] },
  { t: 23,   pos: [0, 3.5, 13],    look: [0, 2.8, 0], cut: true },  // el ENJAMBRE + amanecer
  { t: 30,   pos: [0, 5, 11],      look: [0, 3, 0] },
];

export default function NebulaReel() {
  return (
    <CineStage
      mood="starry_night"
      envIntensity={0.42}
      duration={30}
      chapter="GAIA"
      fov={52}
      cameraPos={[-1.5, 3.2, 11]}
      postfx={{ intensity: 1.15, threshold: 0.5, vignette: 0.82, aberration: 0.0005 }}
    >
      <CineCamera keys={SHOTS} />

      {/* el mundo-nebulosa de fondo, arco comprimido a 30s + estrellas brillosas */}
      <NebulaWorld
        scale={32}
        holeR={13}
        energyBase={0.18}
        ghostWindow={[0.5, 4]}
        firstIgnite={4}
        chain={[10, 15, 16, 17.5, 19, 20.5, 22, 23.5, 25, 26.5]}
        dawnAt={23}
        sat={1.45}
        starBright={1.35}
      />
      <ambientLight intensity={0.2} color="#1E2440" />
      <directionalLight position={[4, 10, 5]} intensity={0.4} color="#FFE6C0" />

      {/* LAS ANIMACIONES de Romer (reutilizadas), en cortes de 30s */}
      <OpeningCrystal start={0} end={9} igniteAt={3.6} />
      <SingleIdea start={9} end={15} />
      <IdeaTree start={15} end={23} />
      <IdeaMultiply start={23} end={30} />
    </CineStage>
  );
}
