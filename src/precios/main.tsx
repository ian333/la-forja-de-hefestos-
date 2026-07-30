import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../main.css';
import '../lib/telemetry';          // precios = el paso al dinero: medirlo importa
import PreciosPortal from './PreciosPortal';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreciosPortal />
  </StrictMode>,
);
