import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../main.css';
import ReportePortal from './ReportePortal';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReportePortal />
  </StrictMode>,
);
