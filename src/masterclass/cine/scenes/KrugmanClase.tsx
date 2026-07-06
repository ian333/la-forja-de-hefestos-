/**
 * KrugmanClase — masterclass de referencia del estándar `cine/`.
 *
 * Premio 2008 (Paul Krugman): nueva geografía económica. Por qué las industrias
 * se amontonan (Silicon Valley, Detroit, Guadalajara) — el que llega primero
 * jala al siguiente. Raíz animal: agregación, como un hormiguero o una colmena
 * que crece alrededor del primer grano.
 *
 * UNA escena de ~42s, corre sola (clock), que demuestra TODO el estándar:
 * HDRI + ACES + PostFX + cámara coreografiada + GLBs con entrada + texto 3D.
 * El audio narrado (Matilda) se enchufa después por el pipeline; por ahora,
 * la narración va en pantalla (SkyText).
 */

import AtomModel from '@/masterclass/assets/gltf/AtomModel';
import { CineStage, CineCamera, CineText, CineModel } from '@/masterclass/cine';
import NebulaWorld from '@/masterclass/cine/NebulaWorld';

const B = '/models/library/buildings/';

// Precarga de los GLBs usados (evita el "pop-in").
AtomModel.preload(`${B}factory.glb`);
AtomModel.preload(`${B}house.glb`);
AtomModel.preload(`${B}house_b.glb`);
AtomModel.preload(`${B}commercial_a.glb`);
AtomModel.preload(`${B}commercial_b.glb`);
AtomModel.preload(`${B}skyscraper_b.glb`);
AtomModel.preload(`${B}skyscraper_d.glb`);
AtomModel.preload(`${B}office.glb`);

// La ciudad que se ensambla: cada edificio entra en su segundo, en un cúmulo.
const CITY: { src: string; pos: [number, number, number]; at: number; color: string; fit: number }[] = [
  { src: `${B}factory.glb`,      pos: [0, 0, 0],     at: 1,   color: '#FDB813', fit: 4.0 },   // el primero: la fábrica
  { src: `${B}house.glb`,        pos: [-3.4, 0, 2],  at: 6,   color: '#34D399', fit: 2.6 },
  { src: `${B}house_b.glb`,      pos: [3.2, 0, 2.6], at: 7.5, color: '#34D399', fit: 2.6 },
  { src: `${B}commercial_a.glb`, pos: [-4.8, 0, -2], at: 13,  color: '#4FC3F7', fit: 3.2 },
  { src: `${B}commercial_b.glb`, pos: [4.6, 0, -2.4],at: 14.5,color: '#4FC3F7', fit: 3.2 },
  { src: `${B}office.glb`,       pos: [-1.8, 0, -4.5],at: 16, color: '#A78BFA', fit: 3.6 },
  { src: `${B}skyscraper_b.glb`, pos: [1.6, 0, -5.5],at: 21,  color: '#F472B6', fit: 6.0 },
  { src: `${B}skyscraper_d.glb`, pos: [-2.4, 0, -7], at: 23,  color: '#F472B6', fit: 6.8 },
];

export default function KrugmanClase() {
  return (
    <CineStage
      mood="urban_night"
      envIntensity={0.6}
      duration={44}
      chapter="Krugman · 2008 · geografía económica"
      fov={48}
      cameraPos={[0, 9, 38]}
      postfx={{ intensity: 1.5, threshold: 0.3, vignette: 0.8, aberration: 0.0006 }}
    >
      <CineCamera
        keys={[
          { t: 0,  pos: [0, 9, 38],   look: [0, 1.5, 0] },   // lejos, tierra vacía
          { t: 6,  pos: [-7, 5, 22],  look: [0, 2, 0] },     // baja hacia la fábrica
          { t: 16, pos: [9, 6, 18],   look: [0, 3, -3] },    // rodea el cúmulo naciente
          { t: 26, pos: [-4, 12, 24], look: [0, 5, -4] },    // sube: ya es ciudad
          { t: 38, pos: [0, 16, 34],  look: [0, 5, -3] },    // se aleja: el mapa
          { t: 44, pos: [0, 16, 34],  look: [0, 5, -3] },
        ]}
      />

      {/* EL MUNDO-NEBULOSA: el cúmulo que enciende EN CADENA = la aglomeración
          económica (la fábrica primera, los edificios contagian, nace la ciudad). */}
      <NebulaWorld
        scale={32}
        holeR={14}
        ghostWindow={[5, 11]}
        firstIgnite={13}
        chain={[16, 18.5, 21, 23.5, 26, 28.5, 31, 33.5, 36, 38.5]}
        dawnAt={34}
      />

      {/* La ciudad que se arma sola */}
      {CITY.map((b, i) => (
        <CineModel key={i} src={b.src} position={b.pos} at={b.at} color={b.color} fitTo={b.fit} glow={1.1} floatAmp={0} rise={1.6} />
      ))}

      <ambientLight intensity={0.2} color="#26203A" />
      <directionalLight position={[6, 12, 4]} intensity={0.5} color="#FFE0B0" />

      {/* Narración en pantalla (SkyText) — los actos */}
      <CineText text="¿Por qué Silicon Valley está donde está?" position={[0, 12, -8]} at={1.5} hold={4} width={13} height={1.2} color="#FFE5A0" />
      <CineText text="Empieza con una sola fábrica." position={[0, 11, -8]} at={6} hold={3.5} width={9} height={1.0} color="#FDB813" />
      <CineText text="Llega una casa. Luego otra. Luego el comercio." position={[0, 11.5, -8]} at={11} hold={4} width={13} height={1.1} color="#34D399" />
      <CineText text="El que llega primero jala al siguiente." position={[0, 13, -8]} at={20} hold={4.5} width={12} height={1.15} color="#F472B6" />
      <CineText text="Y nació una ciudad donde no había nada." position={[0, 12, -8]} at={27} hold={4.5} width={13} height={1.15} color="#A78BFA" />
      <CineText text="El mapa del dinero no lo dibujó la naturaleza — lo dibujó quién llegó primero." position={[0, 11, -8]} at={34} hold={7} width={15} height={1.0} color="#FFE5A0" fontWeight={500} />
    </CineStage>
  );
}
