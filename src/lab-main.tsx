import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
// EL LABORATORIO ERA CIEGO. En 3 días de tráfico pagado hay 1110 pageviews de
// "/" y CERO de "/lab.html": no porque nadie entre —hay clics en "▶ Abrir el
// laboratorio" en el atrio— sino porque este archivo era el único main.tsx sin
// la línea de abajo. Toda la actividad dentro del lab (qué elemento se toca,
// qué pestaña, si giran la escena) se perdía sin dejar rastro.
import './lib/telemetry';
import GaiaLab from './labs/GaiaLab';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GaiaLab />
  </StrictMode>,
);
