/**
 * Tipos del NarratorOverlay — el "presenter pointing" sincronizado con audio.
 *
 * Una callout = "en t=N segundos del audio, aparece esta marca visual encima
 * del Canvas". Vive solo en CSS sobre la escena R3F, no la modifica.
 *
 * Tipos:
 *   - 'arrow'     : flecha + texto apuntando a un punto en pantalla
 *   - 'big'       : número o frase grande flotante (centro por default)
 *   - 'spotlight' : oscurece todo excepto el círculo alrededor de un punto
 *   - 'pulse'     : anillo expansivo que se desvanece en una posición
 *   - 'label'     : etiqueta pequeña con texto fijo en una posición
 */

export type Anchor = { x: string; y: string };       // CSS % o px: "30%", "240px"

export type ArrowDir =
  | 'up' | 'down' | 'left' | 'right'
  | 'up-left' | 'up-right' | 'down-left' | 'down-right';

interface CalloutBase {
  /** segundo del audio en que aparece */
  atSec: number;
  /** segundo en que desaparece (default atSec + 4) */
  untilSec?: number;
  /** ms de fade in/out (default 350) */
  fadeMs?: number;
}

export interface ArrowCallout extends CalloutBase {
  type: 'arrow';
  at: Anchor;          // punta de la flecha
  dir: ArrowDir;       // hacia dónde apunta (la cola va opuesto)
  text: string;
  color?: string;      // default #FDB813
}

export interface BigCallout extends CalloutBase {
  type: 'big';
  at?: Anchor;         // default centro
  text: string;
  color?: string;      // default #FFFFFF
  subtext?: string;
}

export interface SpotlightCallout extends CalloutBase {
  type: 'spotlight';
  center: Anchor;
  radiusPct?: number;  // % del eje menor (default 22)
  darken?: number;     // 0..1 fuerza del oscurecimiento (default 0.65)
}

export interface PulseCallout extends CalloutBase {
  type: 'pulse';
  at: Anchor;
  color?: string;      // default #22D3EE
  maxRadiusPct?: number;  // default 12
}

export interface LabelCallout extends CalloutBase {
  type: 'label';
  at: Anchor;
  text: string;
  color?: string;      // default #94A3B8
  size?: 'sm' | 'md' | 'lg';   // default 'md'
}

export type Callout = ArrowCallout | BigCallout | SpotlightCallout | PulseCallout | LabelCallout;

/** Config completo de callouts para una sola scene del manifest. */
export interface SceneNarratorConfig {
  callouts: Callout[];
}

/** Config completo para un classId — mapa sceneId → callouts. */
export type NarratorConfig = Record<string, SceneNarratorConfig>;
