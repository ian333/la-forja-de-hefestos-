/**
 * SilicioNubeCapsula — el silicio dopado con el motor del O₂ (CineStage + PostFX).
 * PostFX = los valores del O₂ (bloom 1.15 / threshold 0.20 / smoothing 0.6).
 */
import { CineStage } from '@/masterclass/cine';
import SilicioNube, { T } from './SilicioNube';

const LINES: [number, string][] = [
  [0.5,  'Esto de oro no es un dibujo: es carga real, moviéndose.'],
  [4.5,  'Es la carga que se movió cuando dos átomos se unieron. Un enlace.'],
  [9.0,  'Y no está quieta: eso que parpadea es UN electrón, no muchos.'],
  [14.5, 'El azul es de donde salió. Nada se crea.'],
  [21.5, 'Ahora cambiamos UN átomo por uno de fósforo.'],
  [25.5, 'Le sobra un electrón. Ese violeta es él. Uno solo, en todas partes.'],
  [28.5, 'Y esa carga suelta genera un campo eléctrico. Ahí está.'],
  [35.5, 'Pero hay más: ese electrón gira. Y girar, con carga, es ser un imán.'],
  [42.5, 'Un átomo de fósforo en silicio es un imán. Por eso sirve de qubit.'],
  [48.0, 'Eso es dopar: meter un átomo, y que el cristal entero cambie.'],
];
const END = T.fin;
const subtitles = LINES.map(([at, text], i) => ({
  text, at, until: i < LINES.length - 1 ? LINES[i + 1][0] - 0.25 : END - 0.5,
}));

export default function SilicioNubeCapsula() {
  return (
    <CineStage
      mood="studio"
      envIntensity={0.0}
      duration={END}
      fov={44}
      cameraPos={[0, 2, 9.5]}
      background="#000"
      postfx={{ intensity: 1.15, threshold: 0.20, smoothing: 0.6, vignette: 0.68, aberration: 0 }}
      brand={{ name: 'El silicio', sub: 'dopado', at: 2.4 }}
      subtitles={subtitles}
    >
      <SilicioNube />
    </CineStage>
  );
}
