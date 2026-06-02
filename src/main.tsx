import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import EscuelaPortal from './escuela/EscuelaPortal';

// La raíz (university.gaiaprime.com.mx/) es la ESCUELA, no el CAD.
// La Forja (CAD B-Rep) vive en /forja-brep.html y se enlaza desde el atrio.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EscuelaPortal />
  </StrictMode>,
);
