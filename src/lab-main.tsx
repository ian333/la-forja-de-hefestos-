import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import GaiaLab from './labs/GaiaLab';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GaiaLab />
  </StrictMode>,
);
