# ORDEN E: el banco del arco EN VIVO (campos E y B, la gota, la corriente) y con calidad de molde

ESTADO: hoy. ian presente. Pidió:

> «podemos ver el campo magnético y eléctrico en vivo y la simulación, ya viste el carrete, mandé varias fotos, puedes aproximarlo? le falta calidad… ve los videos y ve los moldes»

BASE: d675896

OBJETIVO: al abrir **BANCO DEL ARCO** en `university.gaiaprime.com.mx/forja-brep.html` pasan dos cosas.

1. **El banco se ve con la calidad de los moldes.** Material PBR, aristas CAD y cajas redondeadas. La SOMI-130X y su alimentador se aproximan desde las fotos de ian:
   - el carrete MICRO-1 de 1 kg, tipo D100;
   - la guía de aluminio, el rodillo moleteado, el brazo de presión cromado con su balero y su gancho;
   - la perilla de tensión con su varilla;
   - las terminales de polaridad con collar rojo y la zapata amarilla.

   La antorcha lleva cuello de ganso, mango, boquilla y punta. La pinza de tierra va sobre la placa, y los cables se dibujan como tubos con su trayectoria.
2. **La simulación corre en vivo, en cámara lenta, con los mismos números del canon** (`scripts/canon/canon_gota.py`):
   - la corriente recorre el lazo (torre → pinza → placa → arco → alambre → antorcha → SOMI → torre);
   - anillos de **B** alrededor de los cables, que respiran con I(t);
   - un **DETALLE A ×20** de la punta con la gota que crece, oscila (modo l=2) y se suelta;
   - el plasma, las líneas de **E** y las equipotenciales (método de cargas simuladas con imágenes), los anillos de B del arco y las flechas del pellizco;
   - un tablero con un osciloscopio (I, V, q) y los modos **arco CC** y **campanazo a f₂**.

## YA-EXISTE (prueba de ausencia)

- **Piezas de referencia** (orden B, `RefPart` en `ForgeBRepStudio.tsx`): solo malla, caja y cilindro, sin grupos, sin aristas y con `meshStandardMaterial`. Se extienden aquí; no se crea otra capa.
- **El kernel sólido** (`SolidMesh`) ya usa `MATERIAL_PBR` + `EdgesGeometry(25°)` en `CAD_EDGE`. Se copia esa receta y no se inventa otra.
- **CAD sin `EffectComposer`** (comentario en FBS cerca de `dotSprite`): el brillo se hace con mezcla aditiva y `toneMapped={false}`.
- **Campos ya existentes en otros módulos:** `src/physics/modules/electronica/MicroscopioCorriente.tsx` (Biot-Savart, líneas de campo) y `src/physics/modules/manufactura/CircuitField.tsx` (gota con pellizco). Están en otro Canvas y con otra geometría. Se reutiliza la idea, no el componente, porque esta escena vive dentro del Canvas del CAD.
- **El modelo de la gota** está en Python (`scripts/canon/`) y no existe en TS. Aquí se porta, con los mismos números.

## TOCA

- src/forja/brep/ForgeBRepStudio.tsx

## CREA

- src/forja/brep/arcoFisica.ts
- src/forja/brep/ArcoVivo.tsx
- scripts/arco-fisica-prueba.cjs

## BORRA

- (nada)

## PREEXISTENTE

- public/comando/
- public/precomputed/
- public/modelos/banco-arco/
- videos/
- scripts/guiones/
- scripts/canon/
- scripts/la-pluma/
- models/step/banco-arco/
- docs/PLAN-MVP-LA-PLUMA.md
- scripts/forja-multicuerpo-diag.cjs
- scripts/precompute-banco-arco.cjs
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/operador-revision-impresora-2026-10-31.out
- scripts/operador-revision-impresora-2026-10-31.py
- scripts/playlist-tutoriales.py
- scripts/precompute-caroteno-gemelos.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- public/temis-deploy.json
- public/temis.json

Los dos `temis*.json` los reescribe el propio `deploy-atlas-build.sh` (`scripts/temis-deploy-stamp.cjs`). Cambiaron a las 22:05, en el despliegue de la orden B, antes de que empezara esta orden.

## EVIDENCIA (se declara ANTES de trabajar)

- **Física.** `scripts/arco-fisica-prueba.cjs` corre `arcoFisica.ts` sin navegador y compara con el canon:
  - f₂ = 668 Hz a 0.46 mm;
  - I_crit = 194 A;
  - el campanazo (40 A + 30 A, Q = 30) suelta gotas de 0.46 mm ± 3 %, en ≤ 12 ciclos;
  - el arco CC a 60 A hace gotas grandes, globulares o en corto;
  - las líneas de E nacen en el electrodo y mueren en la placa, y |E| en la punta queda cerca de V/L.
- **Capturas con GPU real en iangpu** (copia aislada, puerto 5302) y luego del sitio publicado:
  - la vista completa;
  - la SOMI abierta con el carrete y el alimentador;
  - la antorcha con la pinza;
  - el DETALLE A con E, B, plasma y la gota;
  - dos instantes del campanazo (gota creciendo y gota soltándose).
- **Rendimiento:** FPS medido con la simulación prendida.
- `tsc --noEmit` en iangpu sin errores nuevos.
- `node scripts/orden-gate.cjs --orden ordenes/2026-11-04-banco-arco-vivo.md` en VERDE.
- **Censo:** canvas, vite y html sin cambio. No se crea ningún `<Canvas>`: todo vive en el del CAD.
- **Despliegue:** `./deploy-atlas-build.sh --quiet`, y el bundle publicado (`curl --compressed`) contiene «DETALLE A».

## CIERRE (se llena al terminar)

- **orden vs entregado:** lo declarado, más tres cosas que hicieron falta en el camino.
  - **`RefPart` ahora tiene grupos** (`hijos` en su propio marco, `orden` de Euler) y los tipos torno, tubo y placa, cajas redondeadas (`RoundedBoxGeometry` de three-stdlib), material PBR por `mat` y aristas CAD.
  - **El bandera `encima`:** a 2 m de la cámara el buffer de profundidad no separa ~5 mm, y la pared negra de la SOMI salía a rayas contra el gabinete. Además se apagaron las sombras direccionales de las piezas de referencia, que daban «acné» en caras grandes.
  - **La bobina se dibuja de verdad:** 40 vueltas de cal 10 en Ø60 × 112 mm dan ≈ 41 µH (Nagaoka). Es diseño, no medida.
  - `occt.ts` no se tocó y no hay lienzo nuevo.
- **números:**
  - **Prueba de física** (`node --import tsx scripts/arco-fisica-prueba.cjs` en iangpu), todo PASA:
    - f₂(0.46 mm) = 667.9 Hz;
    - I_crit = 194.2 A;
    - campanazo 40 + 30 A con Q = 30: 75 gotas/s de 0.4526 mm (± 0.0000, el modelo no lleva ruido), 6 ciclos por gota, 0 cortos. Antes de adelantar el disparo salían de 0.53 mm: la gota crece mientras suena;
    - CC a 60 A: gotas de 1.63 mm de radio (3.5× más grandes), 4 de 4 en corto en 3 s;
    - campo E: 33 cargas, 4.7 % de error en el electrodo, |E| en la punta 72 V/mm (V/L = 10, V/a = 87), y 8 de 10 líneas llegan a la placa.
  - **Banco:** 118 piezas, 290 431 triángulos.
    - Abre en 3.6 s en producción.
    - Medido en Chrome headless con GPU en iangpu: 59 fps la primera corrida; 33–45 fps en el acercamiento del detalle, que es la vista más pesada por las capas aditivas.
    - En el navegador la simulación da las mismas gotas de 0.4526 mm que la prueba.
- **evidencia:**
  - **Capturas con GPU real** (script `scripts/vivo-diag.cjs` de esa carpeta):
    - copia aislada: `/home/ian/forja-diag/vivo-cap/`;
    - producción: `/home/ian/forja-diag/vivo-prod/`;
    - vistas: iso, SOMI abierta, alimentador, antorcha, DETALLE A, torre, gota creciendo, gota sonando (q = 0.81) y CC a 60 A.
  - **Tipos:** `tsc --noEmit` da 58 errores, todos anteriores a esta orden; ninguno nuevo.
  - **Juez:** `node scripts/orden-gate.cjs --orden ordenes/2026-11-04-banco-arco-vivo.md` en VERDE (97 cambios amparados; canvas 8→8).
  - **Despliegue:** `./deploy-atlas-build.sh --quiet` dio DEPLOY OK (25/25).
  - **Bundle publicado:** `/assets/forja-brep-DAuxAz43.js` contiene «DETALLE A», «SIMULACIÓN EN VIVO», «CAMPANAZO a f», «Carrete MICRO-1», «Soldadora SOMI-130X» y «Bobina 41 µH».
  - **Consola de producción** sin errores.
- **preguntas abiertas:**
  - **Medidas de ian:**
    - Ø del cuello de la antorcha;
    - la bobina real;
    - el Hall;
    - el DC-DC;
    - el alto de los capacitores;
    - la posición real del alimentador y del carrete dentro de la SOMI (hoy aproximados de las fotos).
  - **El oído no se simula:** el campanazo usa la f₂ verdadera. Falta meter el error de medir la frecuencia, igual que en el canon §3.
  - **El campo E es electrostático:** el plasma conductor del arco prendido no está modelado y el tablero lo dice.
  - **Lo que queda en la punta al soltarse** (0.6·r_w) es más angosto que el alambre: se ve como una gotita pequeña.
  - **Falta el «baile»** (modo l=1, apuntar) en la escena en vivo.
  - **El tablero tapa parte del panel derecho** en pantallas de 1000 px de alto; se pliega con su encabezado.
