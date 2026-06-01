import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../main.css';
import PrivacidadPortal from './PrivacidadPortal';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivacidadPortal />
  </StrictMode>,
);
