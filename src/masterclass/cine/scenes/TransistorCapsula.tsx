/**
 * TransistorCapsula — CÁPSULA #3 de "La economía son ideas" (~62 s, 9:16).
 *
 * ARQUITECTURA POST-AUTOPSIA O₂ (gate doble obligatorio antes de publicar):
 *  · promesa de FÍSICA (electrones) — la economía es la revelación final
 *  · DOS ACTOS: el interruptor (0–27) → la multiplicación exponencial (27–52)
 *    → loop al clic (52–62); la curva de interés debe SUBIR en la 2ª mitad
 *  · cálido (catedral de silicio ámbar) + frío (río de electrones cian)
 *    SIMULTÁNEOS todo el video (firma-O₂ ≥50%)
 *  · brand estilo mol: "El transistor / 1947"
 *  · audio en post: narración Matilda + música + CLICS del gate como sound
 *    design (binding bimodal: cada clic visual = golpe de audio)
 *
 * La cámara vive DENTRO de TransistorCristal (fórmulas C0 exponenciales, receta
 * O₂) — aquí NO va CineCamera. Subtítulos con placeholders; retimar con las
 * duraciones reales de la voz (assemble-offsets).
 */
import { CineStage } from '@/masterclass/cine';
import TransistorCristal, { T } from './TransistorCristal';

// GUION (12 líneas) — tiempos PROVISIONALES; clavar con duraciones Matilda
const LINES: [number, string][] = [
  [0.5, 'Dentro de este cristal hay un río de electrones, congelado, esperando permiso.'],
  [7.0, 'Esta es la idea más copiada en la historia de la humanidad.'],
  [10.9, 'Silicio con impurezas exactas: átomos con un electrón de más.'],
  [16.0, 'Y una compuerta: un empujón eléctrico diminuto...'],
  [20.2, '...abre el río. Y lo cierra. Sin una sola parte móvil.'],
  [24.9, 'Un sí o un no, millones de veces por segundo.'],
  [29.3, 'Y como era una idea, se copió sin gastarse.'],
  [33.4, 'Dos. Cuatro. Un millón. Miles de millones en tu bolsillo.'],
  [38.2, 'Cada año se fabrican más transistores que estrellas tiene la Vía Láctea.'],
  [43.5, 'Esta pantalla, esta voz que me escuchas: ríos de electrones diciendo sí y no.'],
  [49.9, 'Un clic que se copió hasta volverse el mundo entero.'],
  [54.6, 'Porque la economía, en el fondo, son ideas.'],
];
const END = T.fin;
const subtitles = LINES.map(([at, text], i) => ({
  text, at, until: i < LINES.length - 1 ? LINES[i + 1][0] - 0.25 : END - 0.5,
}));

export default function TransistorCapsula() {
  return (
    <CineStage
      mood="studio"
      envIntensity={0.0}
      duration={END}
      fov={44}
      cameraPos={[0, -4, 6]}
      background="#000"
      postfx={{ intensity: 1.15, threshold: 0.2, smoothing: 0.6, vignette: 0.68, aberration: 0.001 }}
      subtitles={subtitles}
      brand={{ name: 'El transistor', sub: '1947', at: 2.4 }}
    >
      {/* sin NebulaWorld: la catedral ES el mundo; el campo de estrellas del
          acto 2 son los propios transistores parpadeando */}
      <TransistorCristal />
    </CineStage>
  );
}
