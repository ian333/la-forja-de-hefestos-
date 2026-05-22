import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import Player from './masterclass/Player';
import './main.css';

// econ-01-limones está siendo reescrita como clase cinematográfica con 7 escenas
// R3F nuevas. Mientras tanto, ese id redirige al chain en lugar del Player viejo.
function readClassId(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('id') || '';
}

const classId = readClassId();

// Lazy-load LimonesCinematicChain — solo cuando el classId lo necesita. El
// chain importa transitivamente 25 LimonesEscena con AtomModel.preload(...)
// a nivel de módulo, lo que dispara fetches GLTF de la librería en cuanto el
// bundle se evalúa. Cargarlo eager rompe WebGL en TODAS las demás masterclasses
// porque la cascada de 404 textura/glb bloquea la creación del contexto.
const LimonesCinematicChain = lazy(() => import('./masterclass/preview/LimonesCinematicChain'));

// Sin StrictMode para econ-01-limones — el doble-mount rompe el sync de audio
// y los timers internos de las LimonesEscena.
const tree = classId === 'econ-01-limones'
  ? <Suspense fallback={<div className="w-screen h-screen bg-black" />}>
      <LimonesCinematicChain />
    </Suspense>
  : <StrictMode><Player /></StrictMode>;

createRoot(document.getElementById('root')!).render(tree);
