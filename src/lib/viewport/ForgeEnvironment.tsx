/**
 * ⚒️ La Forja — Environment Lighting
 * ====================================
 * HDR environment map for professional reflections on imported CAD meshes.
 * Uses drei's Environment component with the "studio" preset for clean,
 * neutral PBR lighting that makes metal and plastic surfaces shine.
 *
 * Note: SDF ray-marched objects use their own lighting in the fragment
 * shader, so this mainly benefits imported STEP/IGES/BREP meshes.
 */

import { Environment } from '@react-three/drei';

export interface ForgeEnvironmentProps {
  /** Environment preset — 'studio' is ideal for CAD */
  preset?: 'studio' | 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'lobby' | 'park';
  /** Background blur (0 = sharp, 1 = fully blurred). 0 hides it behind SDF. */
  backgroundBlurriness?: number;
  /** Background intensity (0 = invisible). Keep low so SDF gradient shows through. */
  backgroundIntensity?: number;
  /** Environment map intensity for reflections */
  environmentIntensity?: number;
}

export default function ForgeEnvironment({
  preset = 'studio',
  backgroundBlurriness = 1,
  backgroundIntensity = 0,
  environmentIntensity = 0.8,
}: ForgeEnvironmentProps) {
  return (
    <Environment
      preset={preset}
      backgroundBlurriness={backgroundBlurriness}
      backgroundIntensity={backgroundIntensity}
      environmentIntensity={environmentIntensity}
    />
  );
}
