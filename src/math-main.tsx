import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import MathLab from './math/MathLab';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MathLab />
  </StrictMode>,
);
