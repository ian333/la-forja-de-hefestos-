## La Forja vs Fusion / SOLIDWORKS / Onshape — veredicto honesto

### Dónde estamos parados (lo que sí tenemos, y es fuerte)
El fundador tiene razón en el diagnóstico: **"bonito color, poca funcionalidad de UI"**. Y tiene razón en algo más importante — *lo difícil ya está hecho*:
- **Motor real**: OCCT-WASM con Sketch, Extrude (simétrico), Hole por clic en cara, Fillet, Chamfer, Shell, Revolve, Engrane de involuta — geometría EXACTA, no estilizada.
- **Análisis exacto**: masa/volumen/CdG/inercia por GProp (integración geométrica, no malla), FEA von Mises real (K·u=f sobre tets), diseño generativo (topopt), ensamble de engranes validado por invariantes (C, i, faseo, interferencia≈0).
- **Estética y picking**: paneles de vidrio (blur+saturate) con paleta GAIA, PBR por material, HDRI, ContactShadows; picking doble determinista (lista por testid + raycast a tubos de arista) → testeable en Playwright.

Esa base es **mejor que la de muchos clones de CAD web**. El problema no es el kernel: es la **capa de interacción CAD**, justo donde Fusion/SW/Onshape llevan 20+ años.

### Dónde estamos VS ellos (la brecha real)
| Capacidad | Fusion | SOLIDWORKS | Onshape | **La Forja hoy** |
|---|---|---|---|---|
| Paneles colapsables/redimensionables | sí | sí (Manager Pane plegable, Task Pane auto-hide) | sí (Feature list colapsable, dialog movible) | **no — todo `position:absolute`, ancho fijo** |
| Árbol de features editable (reorder/rename/suppress) | sí (Timeline) | sí (FeatureManager) | sí (Feature list) | **no — solo lectura + clic para activar** |
| Rollback / editar en medio del historial | sí (marker) | sí (Rollback bar) | sí (Rollback bar) | **no existe** |
| Menú de opciones / clic derecho contextual | sí (marking menu) | sí (Mouse Gestures + Context Toolbar) | sí (Shortcut toolbar + clic derecho) | **cero** |
| Panel de comando con OK/Cancelar | sí (Command Dialog) | sí (PropertyManager con ✓/✗) | sí (dialog flotante ✓/✗) | **no — muta en vivo, sin cancelar** |
| Undo/Redo (Ctrl+Z) | sí | sí | sí | **no** |
| Export multi-formato en menú Archivo | STL/3MF/OBJ/STEP… | STEP/IGES/STL/3MF… | menú Export | **solo STEP, botón suelto al pie** |

**Verificado en código** (`/home/ian/Orkesta/la-forja/src/forja/brep/ForgeBRepStudio.tsx`): `grep` da 0 ocurrencias de reorder/moveOp/suppress/rollback/onContextMenu/draggable/collaps/details/summary/onDoubleClick/undo. CSS 3183 mete los 6 paneles en `position:absolute`; `removeOp` (1686-1690) no purga dependientes (borrar el extrude base deja huérfanos hole/fillet → documento roto).

### El plan (orden = lo que pidió el fundador primero)
1. **P0 — Hacer TODOS los paneles colapsables** (lo que dijo textual). Envolver cada `.fb-*` en `<details><summary>` o un `<CollapsiblePanel>` con flecha; persistir abierto/cerrado en estado. Mata el enimamiento en pantallas chicas.
2. **P0 — Menú de opciones (⋮ / Archivo)** que absorba "Ocultar boceto" y "Exportar" (hoy sueltos en `.fb-actions`), con submenú de formatos (STEP/STL/3MF/PNG). Es exactamente "deberían estar en opciones, no sueltos".
3. **P0 — Completar el árbol de operaciones**: borrar EN el nodo (con purga de dependientes en `removeOp`), renombrar (doble-clic), suprimir (toggle tachado), reordenar (drag o ↑/↓), clic derecho contextual.
4. **P1 — Undo/Redo + panel de comando con OK/Cancelar + rollback bar.**
5. **P2 — Toolbar agrupada con overflow, hover-highlight en viewport, vistas estándar/seccion, panel de errores de regeneración, accesibilidad (nodos `<button>`, foco por teclado).**

La buena noticia: nada de esto toca el kernel. Es UI sobre un motor que ya es correcto — el camino más barato a "se siente como CAD de verdad".