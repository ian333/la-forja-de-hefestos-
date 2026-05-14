import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import ForgePage from './ForgePage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ForgePage />
  </StrictMode>,
);
