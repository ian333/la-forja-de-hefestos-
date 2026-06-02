import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import ForgeMechStudio from './forja/mech/ForgeMechStudio';
import ModuleErrorBoundary from './physics/components/ModuleErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModuleErrorBoundary moduleName="La Forja · Sintetizador de Mecanismos" branchAccent="#FDB813">
      <ForgeMechStudio />
    </ModuleErrorBoundary>
  </StrictMode>,
);
