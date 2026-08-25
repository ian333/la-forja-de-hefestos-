# ORDEN: v1·2 — HIGIENE DEL RECORRIDO: lo que "juguete" significa

ESTADO: proximo
PRIORIDAD: 2

OBJETIVO: quitar del ribbon los cargadores de demo (El DADO, Probeta, Espiral,
N2, Flanera, Vaso, Core/Cav, Pieza, Escala…) — viven en el lobby, que ya existe —
y que el estado vacío reciba con un arranque guiado, no con "Error: el documento
no tiene sólido". Es la crítica de ian ("se ve de juguete") convertida en dos
cambios baratos y de alto impacto percibido. Cero pantalla nueva.

## YA-EXISTE
- `MoldPanels.tsx:MoldRibbonGroup` — los botones de demo en la cinta.
- `ProjectSwitcher.tsx` — el lobby con tarjetas `st-*` (dado, vaso, jabonera…).
- el mensaje de error del estado vacío sale del rebuild (`REBUILD_ERR`).

## TOCA
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- (nada)

## EVIDENCIA
- captura del ribbon SIN cargadores; los demos siguen en el lobby (drive: abrir
  lobby → cargar dado → ciclo intacto)
- captura del estado vacío con arranque guiado, sin "Error:" en la barra
- 192 del ciclo verdes · orden-gate VERDE
