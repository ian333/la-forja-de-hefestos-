import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PhysicsNobelPortal from './physics/PhysicsNobelPortal';
import './main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PhysicsNobelPortal />
  </StrictMode>,
);
