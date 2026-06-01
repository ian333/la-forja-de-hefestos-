import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../main.css';
import TutorialesPortal from './TutorialesPortal';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TutorialesPortal />
  </StrictMode>,
);
