import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import ForgePage from './ForgePage';
import ModuleErrorBoundary from './physics/components/ModuleErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Sin esto, un throw en el render deja pantalla gris muerta (era el síntoma). */}
    <ModuleErrorBoundary moduleName="La Forja · CAD" branchAccent="#FDB813">
      <ForgePage />
    </ModuleErrorBoundary>
  </StrictMode>,
);
