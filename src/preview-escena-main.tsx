/**
 * Entry para previsualizar escenas de masterclass aisladas, sin player ni HUD.
 *
 * Uso:
 *   /preview-escena.html              → Escena 01 (default, auto-aspect)
 *   /preview-escena.html?scene=02     → Escena 02 (misconception)
 *   /preview-escena.html?aspect=9x16  → fuerza vertical mobile
 *   /preview-escena.html?aspect=16x9  → fuerza horizontal desktop
 *   /preview-escena.html?t=4          → arranca en t=4s (modo screenshot)
 */

import ReactDOM from 'react-dom/client';
import './main.css';
import LimonesEscena01 from './masterclass/preview/LimonesEscena01';
import LimonesEscena02 from './masterclass/preview/LimonesEscena02';
import LimonesEscena03 from './masterclass/preview/LimonesEscena03';
import LimonesEscena04 from './masterclass/preview/LimonesEscena04';
import LimonesEscena05 from './masterclass/preview/LimonesEscena05';
import LimonesEscena06 from './masterclass/preview/LimonesEscena06';
import LimonesEscena07 from './masterclass/preview/LimonesEscena07';
import OstromTragedia from './masterclass/preview/OstromTragedia';

function readAspect(): '9:16' | '16:9' | 'auto' {
  if (typeof window === 'undefined') return 'auto';
  const params = new URLSearchParams(window.location.search);
  const a = params.get('aspect');
  if (a === '9x16' || a === '9:16') return '9:16';
  if (a === '16x9' || a === '16:9') return '16:9';
  return 'auto';
}

function readScene(): '01' | '02' | '03' | '04' | '05' | '06' | '07' | 'ostrom' {
  if (typeof window === 'undefined') return '01';
  const params = new URLSearchParams(window.location.search);
  const s = params.get('scene') || '01';
  if (s === 'ostrom') return 'ostrom';
  if (s === '07' || s === '7') return '07';
  if (s === '06' || s === '6') return '06';
  if (s === '05' || s === '5') return '05';
  if (s === '04' || s === '4') return '04';
  if (s === '03' || s === '3') return '03';
  if (s === '02' || s === '2') return '02';
  return '01';
}

const aspect = readAspect();
const scene = readScene();

const SceneComponent =
  scene === 'ostrom' ? OstromTragedia :
  scene === '07' ? LimonesEscena07 :
  scene === '06' ? LimonesEscena06 :
  scene === '05' ? LimonesEscena05 :
  scene === '04' ? LimonesEscena04 :
  scene === '03' ? LimonesEscena03 :
  scene === '02' ? LimonesEscena02 :
                   LimonesEscena01;

// NO StrictMode aquí — provocaría doble-mount del Canvas y reset del timer.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <SceneComponent forceAspect={aspect} />,
);
