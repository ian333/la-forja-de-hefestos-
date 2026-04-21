import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import PhysicsLab from './physics/PhysicsLab';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PhysicsLab />
  </StrictMode>,
);
