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
import LimonesEscena08 from './masterclass/preview/LimonesEscena08';
import LimonesEscena09 from './masterclass/preview/LimonesEscena09';
import LimonesEscena10 from './masterclass/preview/LimonesEscena10';
import LimonesEscena11 from './masterclass/preview/LimonesEscena11';
import LimonesEscena12 from './masterclass/preview/LimonesEscena12';
import LimonesEscena13 from './masterclass/preview/LimonesEscena13';
import LimonesEscena14 from './masterclass/preview/LimonesEscena14';
import LimonesEscena15 from './masterclass/preview/LimonesEscena15';
import LimonesEscena16 from './masterclass/preview/LimonesEscena16';
import LimonesEscena17 from './masterclass/preview/LimonesEscena17';
import LimonesEscena18 from './masterclass/preview/LimonesEscena18';
import LimonesEscena19 from './masterclass/preview/LimonesEscena19';
import LimonesEscena20 from './masterclass/preview/LimonesEscena20';
import LimonesEscena21 from './masterclass/preview/LimonesEscena21';
import LimonesEscena22 from './masterclass/preview/LimonesEscena22';
import LimonesEscena23 from './masterclass/preview/LimonesEscena23';
import LimonesEscena24 from './masterclass/preview/LimonesEscena24';
import LimonesEscena25 from './masterclass/preview/LimonesEscena25';
import OstromTragedia from './masterclass/preview/OstromTragedia';
import AcemogluNogales from './masterclass/preview/AcemogluNogales';
import NashMedicinaOstrom from './masterclass/preview/NashMedicinaOstrom';

function readAspect(): '9:16' | '16:9' | 'auto' {
  if (typeof window === 'undefined') return 'auto';
  const params = new URLSearchParams(window.location.search);
  const a = params.get('aspect');
  if (a === '9x16' || a === '9:16') return '9:16';
  if (a === '16x9' || a === '16:9') return '16:9';
  return 'auto';
}

function readScene(): '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20' | '21' | '22' | '23' | '24' | '25' | 'ostrom' | 'acemoglu' | 'nash-m4' {
  if (typeof window === 'undefined') return '01';
  const params = new URLSearchParams(window.location.search);
  const s = params.get('scene') || '01';
  if (s === 'nash-m4' || s === 'nash-medicina-m4') return 'nash-m4';
  if (s === 'acemoglu') return 'acemoglu';
  if (s === 'ostrom') return 'ostrom';
  if (s === '25') return '25';
  if (s === '24') return '24';
  if (s === '23') return '23';
  if (s === '22') return '22';
  if (s === '21') return '21';
  if (s === '20') return '20';
  if (s === '19') return '19';
  if (s === '18') return '18';
  if (s === '17') return '17';
  if (s === '16') return '16';
  if (s === '15') return '15';
  if (s === '14') return '14';
  if (s === '13') return '13';
  if (s === '12') return '12';
  if (s === '11') return '11';
  if (s === '10') return '10';
  if (s === '09' || s === '9') return '09';
  if (s === '08' || s === '8') return '08';
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
  scene === 'nash-m4' ? NashMedicinaOstrom :
  scene === 'acemoglu' ? AcemogluNogales :
  scene === 'ostrom' ? OstromTragedia :
  scene === '25' ? LimonesEscena25 :
  scene === '24' ? LimonesEscena24 :
  scene === '23' ? LimonesEscena23 :
  scene === '22' ? LimonesEscena22 :
  scene === '21' ? LimonesEscena21 :
  scene === '20' ? LimonesEscena20 :
  scene === '19' ? LimonesEscena19 :
  scene === '18' ? LimonesEscena18 :
  scene === '17' ? LimonesEscena17 :
  scene === '16' ? LimonesEscena16 :
  scene === '15' ? LimonesEscena15 :
  scene === '14' ? LimonesEscena14 :
  scene === '13' ? LimonesEscena13 :
  scene === '12' ? LimonesEscena12 :
  scene === '11' ? LimonesEscena11 :
  scene === '10' ? LimonesEscena10 :
  scene === '09' ? LimonesEscena09 :
  scene === '08' ? LimonesEscena08 :
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
