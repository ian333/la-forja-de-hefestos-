/**
 * HDRI manifest — environment maps CC0 de Poly Haven.
 *
 * Un solo HDRI bien elegido cambia más la "sensación" de una escena que
 * 5 directional lights y una hora de tweaks. Funciona como reflexión,
 * ambient lighting y skybox si así se configura.
 *
 * Uso:
 *   import { Environment } from '@react-three/drei';
 *   <Environment files={HDRI.studio.src} />
 *
 * O via wrapper:
 *   <MasterclassEnv preset="studio" />
 */

export type HdriMood =
  | 'studio'           // neutro contemplativo, claridad mental
  | 'urban_night'      // noche urbana cálida, Akerlof / collapse
  | 'starry_night'     // cielo estrellado, cosmología / física cuántica
  | 'misty_morning';   // mañana neblinosa, Ostrom commons (futuro)

export interface HdriEntry {
  name: string;
  src: string;
  mood: HdriMood;
  /** Atribución (CC0 no la requiere, pero la registramos por trazabilidad). */
  source: string;
  /** Sugerencia narrativa de uso. */
  primaryUse: string;
  available: boolean;
}

export const HDRI: Record<HdriMood, HdriEntry> = {
  studio: {
    name: 'studio_small_03',
    src: '/hdri/studio_small_03_1k.hdr',
    mood: 'studio',
    source: 'Poly Haven CC0 — studio_small_03',
    primaryUse: 'Mate, demos abstractos, single-object hero shots',
    available: true,
  },
  urban_night: {
    name: 'moonless_golf',
    src: '/hdri/moonless_golf_1k.hdr',
    mood: 'urban_night',
    source: 'Poly Haven CC0 — moonless_golf',
    primaryUse: 'Akerlof (Tsuru bajo farola), collapse scenes, mood noir',
    available: true,
  },
  starry_night: {
    name: 'rogland_clear_night',
    src: '/hdri/rogland_clear_night_1k.hdr',
    mood: 'starry_night',
    source: 'Poly Haven CC0 — rogland_clear_night',
    primaryUse: 'Física / cosmología (Einstein, cuántica, planetas)',
    available: true,
  },
  misty_morning: {
    name: 'kloofendal_misty_morning',
    src: '/hdri/kloofendal_misty_morning_puresky_1k.hdr',
    mood: 'misty_morning',
    source: 'Poly Haven CC0 — kloofendal_misty_morning_puresky (NO bajado todavía)',
    primaryUse: 'Ostrom commons, Sen capacidades, escenas de esperanza',
    available: false,
  },
};

export const HDRI_LIST = Object.values(HDRI);
