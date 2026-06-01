import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../main.css';
import CuentaPortal from './CuentaPortal';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CuentaPortal />
  </StrictMode>,
);
