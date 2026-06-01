import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../main.css';
import TerminosPortal from './TerminosPortal';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TerminosPortal />
  </StrictMode>,
);
