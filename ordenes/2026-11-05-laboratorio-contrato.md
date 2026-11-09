# ORDEN K0: el contrato del laboratorio (divide y vencerás)

ESTADO: hoy. ian presente:

> «el camino es divide y vencerás, les encargo esa tarea a 3 agentes, pasos mínimos… quiero todo a medida para no atornillar si es posible… que la misma figura impresa me sirva para llevar el cableado… un espacio para el módulo del carrete impreso en 3D, que controle la distancia… una base para poner la placa… todo tiene que ir soldado, porque quiero el mínimo de componentes, y la conexión porque los protos siempre meten falsos contactos»

BASE: d675896

OBJETIVO: UN archivo que fija las fronteras entre los tres agentes antes de que empiecen. Contiene:
- las bahías (el volumen de cada quien);
- los puertos (por dónde sale cada cable);
- las conexiones entre módulos, con la corriente y el calibre que vienen de La Pluma;
- el riel de la columna (la interfaz mecánica entre A y B);
- las reglas comunes: soldado, sin tornillos, separación potencia/señal, llenado, doblez y la única entrada de corriente en la punta;
- la K1 y el material.

Después de los agentes, esta misma orden integra: el doc «LABORATORIO v1 · generado» en el lobby.

## YA-EXISTE (prueba de ausencia)

- No hay contrato entre módulos. El banco v3 tenía sus piezas tecleadas a mano en `ForgeBRepStudio.tsx` y su arnés en `plumaSistema.ts`, ligado a esa geometría.

## TOCA

- src/forja/brep/ForgeBRepStudio.tsx

La integración: el doc «LABORATORIO v1 · generado», su entrada en el lobby, la vista de apertura y el panel de los jueces.

## CREA

- src/forja/lab/laboratorio-contrato.ts

## BORRA

- (nada)

## PREEXISTENTE

- public/
- videos/
- scripts/
- models/
- docs/
- ordenes/
- src/lib/physics/
- src/forja/brep/CampoReal.tsx
- src/forja/brep/ArcoVivo.tsx
- src/forja/brep/arcoFisica.ts
- src/forja/brep/plumaSistema.ts
- src/forja/brep/PlumaCircuito.tsx
- src/forja/brep/__tests__/plumaSistema.test.ts
- src/forja/brep/brazoVivo.ts
- src/forja/brep/BrazoVivo.tsx
- src/forja/brep/__tests__/brazoVivo.test.ts
- src/forja/lab/alambre.ts
- src/forja/lab/__tests__/alambre.test.ts
- src/forja/lab/cuerpo.ts
- src/forja/lab/__tests__/cuerpo.test.ts
- src/forja/lab/placa.ts
- src/forja/lab/__tests__/placa.test.ts

## EVIDENCIA (se declara ANTES de trabajar)

- Un chequeo del contrato:
  - cada puerto está en una cara de su bahía;
  - las bahías interiores no se enciman;
  - las de adentro caben en la base;
  - cada conexión va a puertos que existen.

## CIERRE (2026-11-06)

- **orden vs entregado:**
  - el contrato (`src/forja/lab/laboratorio-contrato.ts`) congeló bahías, puertos, conexiones, riel y reglas antes de lanzar a los tres agentes; su chequeo pasa (puertos en caras, bahías sin encimarse, conexiones a puertos que existen);
  - los tres entregaron bajo su orden (K alambre, L cuerpo, M placa), las tres en VERDE;
  - la integración:
    - `scripts/laboratorio/laboratorio-precalculo.cjs` corre los tres generadores y sus jueces UNA vez, porque el ruteo A* del cuerpo tarda 14.6 s y no cabe en el navegador;
    - deja `public/modelos/laboratorio/laboratorio.json` (76 KB);
    - el estudio lo lee: doc «LABORATORIO v1 · generado» en el lobby, `DocState.vista` genérica, panel «LABORATORIO · SUS JUECES» con los hallazgos de cada juez, y el estado del laboratorio se limpia al abrir otro inicio.
- **números:**
  - 183 piezas (cuerpo 58 · placa 93 · alambre 32), 221 722 triángulos, abre en 1.6 s en producción;
  - **35 fps** con rayos X: muchas piezas transparentes; queda pendiente;
  - jueces: cuerpo 0 errores / 10 avisos, placa 0 / 4, alambre 0 / 3;
  - tiempos: disenarCuerpo 14.6 s, el resto < 25 ms.
- **evidencia:**
  - `vitest`: 127/127 en 6 archivos (lab ×3, plumaSistema, brazoVivo, em);
  - `tsc` 58, igual que la base;
  - gates K0/K/L/M VERDE;
  - desplegado (`forja-brep-DWA-Fo3X.js` contiene «LABORATORIO v1» y «SUS JUECES»); `laboratorio.json` y las mallas responden 200;
  - capturas con GPU (d3d12) de la copia aislada y de producción.
- **preguntas abiertas** (ronda 2), los CAMBIOS DE CONTRATO PEDIDOS por los agentes:
  - C.OUTP junto a C.OUTN y el MARCO atrás (P1);
  - K09 como puente directo (P2);
  - columna de 80 mm de fondo (P3);
  - C.PARO a (85, −85, −50) (P4);
  - campana de humo cerca del arco (P5);
  - C.MESA/K11/K12 (P6);
  - nada de C arriba de z −26 bajo la mesa (P7);
  - PLACA_PCB x0 −96 en la zona del ventilador (P8);
  - A.POT a z ≈ 210 (A);
  - K07 a 12 V (C);
  - termostato de 70 °C en el ducto de la mesa, en serie con SD (B → C).
