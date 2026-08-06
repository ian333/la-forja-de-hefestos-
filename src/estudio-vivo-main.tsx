/**
 * Entrada de DESARROLLO/ARNÉS de EL ESTUDIO VIVO.
 * El destino de producción es un overlay dentro de `forja-brep.html`; esta página
 * monta el MISMO componente a pantalla completa para que el arnés de Playwright lo
 * pueda manejar sin depender del monolito (y para abrirlo sin cargar OCCT).
 * `onClose` aquí solo baja una bandera: en el Studio cierra el overlay.
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import EstudioVivo from './forja/mold/EstudioVivo';

function Pagina() {
  const [abierto, setAbierto] = useState(true);
  if (!abierto) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#05070B', color: '#c9a227', font: "700 14px 'JetBrains Mono', monospace" }}>
        <button
          data-testid="ev-reabrir"
          onClick={() => setAbierto(true)}
          style={{ background: 'rgba(201,162,39,0.16)', border: '1px solid #c9a227', color: '#c9a227', borderRadius: 8, padding: '10px 16px', font: "700 13px 'JetBrains Mono', monospace", cursor: 'pointer' }}
        >
          abrir EL ESTUDIO VIVO
        </button>
      </div>
    );
  }
  return <EstudioVivo onClose={() => setAbierto(false)} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
