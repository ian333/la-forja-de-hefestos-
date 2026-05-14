import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import EconomiaPortal from './economia/EconomiaPortal';
import './main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EconomiaPortal />
  </StrictMode>,
);
