import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import BrainView from './components/rian/BrainView';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrainView />
  </StrictMode>,
);
