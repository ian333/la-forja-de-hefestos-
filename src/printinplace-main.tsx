import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import './lib/telemetry';
import PrintInPlaceLab from './forja/lab/PrintInPlaceLab';
import ModuleErrorBoundary from './physics/components/ModuleErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModuleErrorBoundary moduleName="La Forja · Print-in-place Lab" branchAccent="#FDB813">
      <PrintInPlaceLab />
    </ModuleErrorBoundary>
  </StrictMode>,
);
