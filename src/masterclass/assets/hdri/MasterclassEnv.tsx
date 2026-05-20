/**
 * MasterclassEnv — wrapper de drei <Environment> tipado por mood.
 *
 * Uso:
 *   <MasterclassEnv preset="studio" />          // estudio contemplativo
 *   <MasterclassEnv preset="urban_night" />     // Akerlof noche
 *   <MasterclassEnv preset="starry_night" />    // física
 *   <MasterclassEnv preset="urban_night" background />  // skybox visible
 *
 * IMPORTANTE: si activas `background`, la HDRI se renderiza como skybox y
 * tu fondo negro radial deja de verse. Por default solo se usa para
 * ambient lighting + reflections, NO como background.
 */

import { Environment } from '@react-three/drei';
import { HDRI, type HdriMood } from './manifest';

interface MasterclassEnvProps {
  preset: HdriMood;
  /** Si true, la HDRI se ve como skybox de fondo. Default false. */
  background?: boolean;
  /** Multiplica la intensidad del lighting. Default 0.7 (atom-style canon). */
  intensity?: number;
}

export default function MasterclassEnv({
  preset,
  background = false,
  intensity = 0.7,
}: MasterclassEnvProps) {
  const entry = HDRI[preset];
  if (!entry.available) {
    console.warn(`[MasterclassEnv] HDRI "${preset}" no disponible (available: false). Skip.`);
    return null;
  }
  return (
    <Environment
      files={entry.src}
      background={background}
      environmentIntensity={intensity}
    />
  );
}
