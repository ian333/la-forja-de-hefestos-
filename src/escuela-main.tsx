import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import './lib/telemetry';           // el atrio también mide (ver src/main.tsx)
import EscuelaPortal from './escuela/EscuelaPortal';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EscuelaPortal />
  </StrictMode>,
);
