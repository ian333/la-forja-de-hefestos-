import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './main.css';
import './lib/telemetry'; // auto-instala telemetría (errores + timings de proceso → DB de logs)
import ForgeBRepStudio from './forja/brep/ForgeBRepStudio';
import ModuleErrorBoundary from './physics/components/ModuleErrorBoundary';
import TutorialOverlay from './escuela/mecanica/TutorialOverlay';

// La Forja = el Part Studio B-Rep, a pantalla completa. El switcher flotante
// "Diseño / Print-in-place" se ELIMINÓ (orden del user 2026-07-01: "no me gusta
// eso de print in place, fue un experimento"): flotaba con zIndex 99999 ENCIMA
// del editor de croquis y un clic legítimo del croquis (0,220) lo activaba,
// matando el editor a mitad de un tutorial (bug cazado en c6t2). El workspace
// print-in-place sigue vivo en src/forja/pip/ por si se rescata como página propia.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModuleErrorBoundary moduleName="La Forja · Part Studio B-Rep" branchAccent="#FDB813">
      <ForgeBRepStudio />
      {/* Escuela de Mecánica: ?leccion=<id> monta el tutorial interactivo (hermano
          del Studio, cero acoplamiento — habla por window.__forgeBrep). */}
      <TutorialOverlay />
    </ModuleErrorBoundary>
  </StrictMode>,
);
