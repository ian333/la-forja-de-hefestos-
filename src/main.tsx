import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
// TELEMETRÍA EN LA PUERTA DE ENTRADA. Llevaba meses SOLO en /forja-brep y
// /masterclass: la raíz (el atrio, donde cae la gente que llega de IG) era
// CIEGA — cero pageviews de "/" en 10 semanas de datos, y sin ellos no se
// puede saber cuánta gente entra ni cuántos pasan del atrio a una clase.
import './lib/telemetry';
import EscuelaPortal from './escuela/EscuelaPortal';

// La raíz (university.gaiaprime.com.mx/) es la ESCUELA, no el CAD.
// La Forja (CAD B-Rep) vive en /forja-brep.html y se enlaza desde el atrio.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EscuelaPortal />
  </StrictMode>,
);
