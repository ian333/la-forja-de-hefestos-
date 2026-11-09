# ORDEN K0·2: el contrato v2 y la ronda 2 del laboratorio

ESTADO: hoy. ian, sobre los 11 cambios de contrato que pidieron los tres agentes en la ronda 1: «me mama, dale los cambios».

BASE: 32f3e93

OBJETIVO:
- El contrato v2 (`laboratorio-contrato.ts`): entran los 11 pedidos (P1–P8 de B, A.POT de A, K07 de C, el termostato de la mesa), más lo que sale de juntarlos:
  - la base crece con la columna (y1 230) y el IEC se va a la pared nueva;
  - el MARCO queda en x = −40, el mismo plano que C.OUTP y A.POT;
  - una bahía CAMPANA (boca de humo a 84 mm del arco) y otra DIFUSOR;
  - las decisiones de lo que ian no ha contestado (`DECISIONES` D1–D6), para que los agentes no se detengan.
- El contrato se revisa a sí mismo con pruebas (`contrato.test.ts`).
- Ronda 2 de los tres agentes: órdenes K·2 (alambre), L·2 (cuerpo) y M·2 (placa).
- Integración: el precálculo de nuevo, el doc «LABORATORIO v2 · generado» y ≥ 50 fps con rayos X (en la v1 eran 35).

## YA-EXISTE (prueba de ausencia)

- El contrato v1 y la integración v1 (orden K0, `2026-11-05-laboratorio-contrato.md`): `laboratorioDoc`, `LabJuecesPanel`, `LAB_URL`, `scripts/laboratorio/laboratorio-precalculo.cjs`. Se reúsan; no se hace otro panel ni otro doc.
- Los pedidos con números están en los CIERRE de las órdenes K, L y M y en `PEDIDOS` de `cuerpo.ts`.

## TOCA

- src/forja/brep/ForgeBRepStudio.tsx

## CREA

- src/forja/lab/laboratorio-contrato.ts
- src/forja/lab/__tests__/contrato.test.ts

El contrato lo creó la orden K0 y todavía no está en el commit base; esta orden lo pasa a v2.

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

- `vitest` de `contrato.test.ts` en iangpu, verde:
  - cada puerto en una cara de su bahía y mirando hacia afuera (o adentro de una bahía de B);
  - las bahías no se enciman;
  - las conexiones van a puertos que existen;
  - el lazo del arco en un plano;
  - los cambios de la ronda 2 aplicados;
  - un contrato sembrado con errores que el chequeo caza.
- Al cerrar, `vitest` de todo `src/forja/lab/` verde con los generadores de la ronda 2, y los tres jueces en 0 errores.
- `tsc --noEmit`: sin errores nuevos (la base son 58).
- Producción, en iangpu con d3d12:
  - el lobby abre «LABORATORIO v2»;
  - ≥ 50 fps con rayos X;
  - la consola no da errores;
  - capturas.

## CIERRE (2026-11-06)

- **orden vs entregado:**
  - contrato v2: entraron los 11 pedidos de la ronda 1, más lo que salió de juntarlos y de la ronda misma;
    - de juntarlos: BASE y1 230, el IEC a la pared nueva, el MARCO en x = −40, las bahías CAMPANA y DIFUSOR, y `DECISIONES` D1–D6;
    - de la ronda: K14 (termostato del cuello, pedido de A), P9 (MESA.TERM plano, de B) y P10 (collar a z ≈ 10, de B);
    - `CAMBIOS_R2` registra 16 cambios, cada uno con quién lo pidió y por qué;
  - `contrato.test.ts`: 11 pruebas;
  - tres arbitrajes míos durante la ronda:
    - el zócalo del cuello se diseña sin contar con la campana, porque A suponía 80 % de captura y B calculó ≈ 0 %;
    - el ventilador de la placa sube a 0.25 A, porque con los 26 m³/h reales de B el disipador quedaba a 3.4 K del termostato;
    - K14 se queda en 70 °C ±3 (A primero pidió 55; con el inserto de silicato volvió a 70);
  - integración:
    - el precálculo ahora escribe `ronda`, `cambios` y `decisiones`;
    - el doc toma su nombre de la ronda («LABORATORIO v2 · generado»);
    - el panel de los jueces tiene una fila «contrato» que despliega D1–D6 y los 16 cambios;
    - vista de apertura nueva.
- **números:**
  - 226 piezas (cuerpo 80 · placa 106 · alambre 40), ~271 mil triángulos; abre en 1.4 s en producción;
  - jueces: cuerpo 0 errores / 2 avisos, placa 0 / 4, alambre 0 / 2 (la v1 tenía 10, 4 y 3 avisos);
  - **fps en producción, con rayos X: 60** desde el segundo 1 (48 en el primero, mientras compila los shaders);
  - cuerpo: 13 tejas + 65 piezas sueltas, 3.0 kg de PETG, ~82 h de impresión, 0 tornillos;
  - campana: 0.525 m/s en el arco; lazo K05/K06: 252 cm² con la ruta real.
- **evidencia:**
  - `vitest` de `src/forja/lab/`: 170/170 (contrato 11 · placa 53 · alambre 55 · cuerpo 51);
  - `tsc`: 58, igual que la base; 0 errores en lab;
  - gates K0·2, K·2, L·2 y M·2: VERDE;
  - desplegado: `forja-brep-CSNjveal.js` contiene «LABORATORIO v2 · generado» y `lab-juez-contrato`; `laboratorio.json` es la ronda 2;
  - capturas con GPU real (renderer «ANGLE D3D12 NVIDIA RTX 4070 Ti», con `renderBufferDirect` en el perfil).
- **preguntas abiertas:**
  - la medición de 35 fps de la v1 no la puedo reproducir ni explicar. Al principio de esta orden medí «60 fps» con flags que no creaban el contexto WebGL: la escena estaba vacía y esa medición no vale;
  - las preguntas para ian están juntas en el CIERRE de K·2, L·2 y M·2 (extractor, portapuntas, plata 45 %, KSD9700, embocadura, verificar pinouts).
