import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MathPrizesPortal from './math/MathPrizesPortal';
import './main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MathPrizesPortal />
  </StrictMode>,
);
