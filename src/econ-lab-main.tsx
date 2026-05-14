import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import EconLab from './econ-lab/EconLab';
import './main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EconLab />
  </StrictMode>,
);
