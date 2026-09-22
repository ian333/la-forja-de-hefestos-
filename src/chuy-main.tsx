/**
 * Entrada de `chuy.html` — la página donde aterriza el embudo de Don Chuy.
 *
 * Deliberadamente flaca: NO importa `main.css` (Tailwind, 201 KB) ni nada de
 * three/r3f. Todo el estilo va en línea dentro de chuy.html y lo único que baja
 * aquí es React + este componente, porque quien abre esto viene del navegador de
 * Instagram con datos móviles y la mediana de sesión del sitio es de 0.9 s.
 *
 * Sin StrictMode: en desarrollo monta dos veces y eso dispararía DOS `chuy.abre`
 * por visita — justo el evento con el que se mide el embudo. La página no tiene
 * efectos delicados que StrictMode ayude a cazar (un rAF con su cleanup y nada más).
 */
import { createRoot } from 'react-dom/client';
import './lib/telemetry';           // se auto-instala al importar (ver src/main.tsx)
import LibretaChuy from './chuy/LibretaChuy';

createRoot(document.getElementById('root')!).render(<LibretaChuy />);
