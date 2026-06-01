import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PremioPage from './economia/PremioPage';
import './main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PremioPage />
  </StrictMode>,
);
