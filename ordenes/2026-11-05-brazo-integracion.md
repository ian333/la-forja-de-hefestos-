# ORDEN J: el brazo vivo entra al estudio (integración de la orden H)

ESTADO: hoy. La orden H (agente de fondo B) entregó `brazoVivo.ts`, `BrazoVivo.tsx` y sus 12 pruebas. Esos archivos no tocan el estudio a propósito: la integración la hace la sesión principal. Esta orden es esa integración.

BASE: d675896

OBJETIVO:
- una entrada en el lobby, «BRAZO VIVO · 3 ejes cicloidales»;
- un `DocState.brazo` que monta `<BrazoVivoEscena>` dentro del grupo Z-arriba y `<BrazoVivoHUD>` encima del visor (el mismo patrón que el arco);
- la mesa y el pedestal entran como piezas de referencia (`piezasBancoBrazo`);
- el encuadre abarca el alcance del brazo, no solo la mesa;
- un botón en la leyenda para prenderlo y apagarlo;
- telemetría en `__forgeBrep.brazo`.

## YA-EXISTE (prueba de ausencia)

- `BrazoVivo.tsx` exporta `crearBrazoSim`, `BrazoVivoEscena`, `BrazoVivoHUD`, `piezasBancoBrazo` y `BRAZO_CFG`. Hoy nadie los monta.
- El arco ya tiene ese patrón en `ForgeBRepStudio.tsx` (`arcoDoc`, `arcoSim`, `ArcoVivoEscena`, `ArcoVivoHUD`): se copia, no se inventa otro.

## TOCA

- src/forja/brep/ForgeBRepStudio.tsx

## CREA

- src/forja/brep/BrazoVivo.tsx

Lo creó la orden H y todavía no está en el commit base. J le cambia una línea: `RoundedBoxGeometry` viene de three-stdlib, como en el estudio.

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
- src/forja/brep/__tests__/brazoVivo.test.ts

## EVIDENCIA (se declara ANTES de trabajar)

- En iangpu con la GPU real (d3d12):
  - el lobby abre el brazo;
  - las piezas se dibujan y la consola no da errores;
  - ≥ 50 fps con el brazo moviéndose y el campo B prendido;
  - el gaussímetro lee un valor ≠ 0;
  - capturas del brazo.
- `tsc --noEmit`: sin errores nuevos (la base son 58).
- `vitest` de `brazoVivo` y `plumaSistema`, todo verde.

## CIERRE (2026-11-05)

- **orden vs entregado:**
  - entrada en el lobby: «BRAZO VIVO · 3 ejes cicloidales»;
  - `DocState.brazo`, que monta `<BrazoVivoEscena>` y `<BrazoVivoHUD>` como el arco;
  - mesa, pedestal, electrónica y cojines como piezas de referencia;
  - el encuadre incluye el alcance (caja de ±600 × 900 mm) y abre con una vista del brazo;
  - un botón en la leyenda;
  - `__forgeBrep.brazo` (q, i, V, |B| de la sonda, fps);
  - sin sólido del kernel, así que «SUELTA TU PIEZA AQUÍ» ya no sale cuando hay piezas de referencia, y el pie de la leyenda ya no habla de «la placa de prueba» si no la hay;
  - BrazoVivo.tsx toma `RoundedBoxGeometry` de three-stdlib.
- **números** (producción, RTX 4070 Ti):
  - abre en 1.5 s con 28/28 piezas, 60.3 fps;
  - 255 líneas de B (79 cerradas), 76,250 vértices, 3.6–7.5 s en el worker;
  - el gaussímetro lee 6–8 µT junto al hombro, con el motor del hombro dominando al 99 %;
  - la consola no da errores.
- **evidencia:** `vitest` 36/36 (plumaSistema 17 + brazoVivo 12 + em 7); `tsc` 58, igual que la base; el gate da VERDE; desplegado (`forja-brep-CODUKV9k.js` contiene «BRAZO VIVO»).
- **preguntas abiertas:** la barra de estado sigue diciendo «Lienzo vacío» porque no hay sólido del kernel. Es el texto de siempre del lienzo vacío y no se tocó.
