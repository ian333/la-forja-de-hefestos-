import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Player from './masterclass/Player';
import LimonesCinematicChain from './masterclass/preview/LimonesCinematicChain';
import './main.css';

// econ-01-limones está siendo reescrita como clase cinematográfica con 7 escenas
// R3F nuevas. Mientras tanto, ese id redirige al chain en lugar del Player viejo.
function readClassId(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('id') || '';
}

const classId = readClassId();
const RootApp = classId === 'econ-01-limones' ? LimonesCinematicChain : Player;

// Sin StrictMode para econ-01-limones — el doble-mount rompe el sync de audio
// y los timers internos de las LimonesEscena.
const tree = classId === 'econ-01-limones'
  ? <LimonesCinematicChain />
  : <StrictMode><Player /></StrictMode>;

void RootApp;
createRoot(document.getElementById('root')!).render(tree);
