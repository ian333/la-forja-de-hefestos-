import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import ForgeBRepStudio from './forja/brep/ForgeBRepStudio';
import ModuleErrorBoundary from './physics/components/ModuleErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModuleErrorBoundary moduleName="La Forja · Part Studio B-Rep" branchAccent="#FDB813">
      <ForgeBRepStudio />
    </ModuleErrorBoundary>
  </StrictMode>,
);
