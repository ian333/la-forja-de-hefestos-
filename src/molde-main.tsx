/**
 * Entrada de DESARROLLO/ARNÉS de EL MOLDE.
 * ============================================================================
 * El destino de producción es un overlay dentro de `forja-brep.html` (import lazy
 * + estado + botón, igual que EL ESTUDIO VIVO y EL CICLO). Esta página monta el
 * MISMO componente a pantalla completa para que `scripts/estudio-molde-ss.cjs` lo
 * pueda MANEJAR sin depender del monolito — y de paso deja la pantalla abrible
 * sola, sin cargar el kernel OCCT.
 *
 * NO se agrega a `vite.config.ts`: es una entrada de dev, se abre por su .html.
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import EstudioMolde from './forja/mold/EstudioMolde';

function Pagina() {
  const [abierto, setAbierto] = useState(true);
  if (!abierto) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#05070B', color: '#c9a227', font: "700 14px 'JetBrains Mono', monospace" }}>
        <button
          data-testid="em-reabrir"
          onClick={() => setAbierto(true)}
          style={{ background: 'rgba(201,162,39,0.16)', border: '1px solid #c9a227', color: '#c9a227', borderRadius: 8, padding: '10px 16px', font: "700 13px 'JetBrains Mono', monospace", cursor: 'pointer' }}
        >
          abrir EL MOLDE
        </button>
      </div>
    );
  }
  return <EstudioMolde onClose={() => setAbierto(false)} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
