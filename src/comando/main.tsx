import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../main.css';
import ComandoCenter from './ComandoCenter';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ComandoCenter />
  </StrictMode>,
);
