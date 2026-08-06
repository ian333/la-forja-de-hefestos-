/**
 * Entrada de DESARROLLO/ARNÉS de EL CICLO.
 * El destino de producción es un overlay dentro de `forja-brep.html` (o un botón
 * del Estudio); esta página monta el MISMO componente a pantalla completa para que
 * `scripts/ciclo-ss.cjs` lo pueda MANEJAR sin depender del monolito — y de paso
 * deja la pantalla abrible sola, sin cargar el kernel OCCT.
 * Copia el patrón de `estudio-vivo-main.tsx`: `onClose` aquí solo baja una bandera.
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import EstudioCiclo from './forja/mold/EstudioCiclo';

function Pagina() {
  const [abierto, setAbierto] = useState(true);
  if (!abierto) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#05070B', color: '#c9a227', font: "700 14px 'JetBrains Mono', monospace" }}>
        <button
          data-testid="ec-reabrir"
          onClick={() => setAbierto(true)}
          style={{ background: 'rgba(201,162,39,0.16)', border: '1px solid #c9a227', color: '#c9a227', borderRadius: 8, padding: '10px 16px', font: "700 13px 'JetBrains Mono', monospace", cursor: 'pointer' }}
        >
          abrir EL CICLO
        </button>
      </div>
    );
  }
  return <EstudioCiclo onClose={() => setAbierto(false)} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
