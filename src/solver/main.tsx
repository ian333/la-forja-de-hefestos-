import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../main.css';
import 'katex/dist/katex.min.css';
import SolverPortal from './SolverPortal';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SolverPortal />
  </StrictMode>,
);
