/**
 * Entry standalone para QuasarScene. Sin player, sin HUD masterclass —
 * solo el cuásar a pantalla completa para uso "demo wow" o como input
 * a render de masterclass.
 *
 *   /quasar.html
 */

import ReactDOM from 'react-dom/client';
import './main.css';
import QuasarScene from './quasar/QuasarScene';

// NO StrictMode — provocaría doble-mount del Canvas y reset del shader uniforms.
ReactDOM.createRoot(document.getElementById('root')!).render(<QuasarScene />);
