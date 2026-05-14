import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Player from './masterclass/Player';
import './main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Player />
  </StrictMode>,
);
