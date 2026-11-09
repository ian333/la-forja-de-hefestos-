# ORDEN B: el banco del arco como proyecto vivo en La Forja (ensamble real)

ESTADO: hoy. ian presente: «dale simón, dale recio». Quiere ver el banco como proyecto en la página, en el lobby, junto al Vaso y la Jabonera.

BASE: d675896

OBJETIVO: en `university.gaiaprime.com.mx/forja-brep.html` aparece el proyecto **BANCO DEL ARCO**, y al abrirlo muestra el ensamble real del banco del arco (la fuente LRS-1200 de fabricante y las piezas de la biblioteca de la orden A) sin que se caiga el render. Por fases, cada una medida antes de pasar a la siguiente:

- **B1 · diagnóstico y arreglo** del límite de cuerpos (limitaciones A1 y A3: el render se cae con más de ~6 cuerpos y el heap del WASM se degrada tras 6–8 rebuilds). Primero medir, luego arreglar la causa medida.
- **B2 · STEP como componente** del ensamble, con giro en 3 ejes (rx, ry además de rz) y color por componente.
- **B3 · proyecto «BANCO DEL ARCO»** en el lobby, con los STEP servidos desde `public/`.
- **B4 · desplegar** con `./deploy-atlas-build.sh --quiet` y verificar contra el bundle publicado.

## YA-EXISTE (prueba de ausencia)

- **Ensamble:** `Component` (kind box, cyl, sketch, sweeppath, pieza) con x/y/z/rz y booleanas. `buildComponent` está en `ForgeBRepStudio.tsx:1187`. El rebuild (`ForgeBRepStudio.tsx:4571`) arma un compound y en **cada** reconstrucción hace:
  - tessellate;
  - topology, volume, area y massProperties;
  - enumerateFaces, enumerateEdges y enumerateEdgesGeom;
  - **exportSTEP del ensamble completo**.

  Las formas intermedias de los componentes no se liberan (`.delete`). Es candidato a la causa de A1 y A3, sin medir todavía.
- **STEP:** `importSTEP` y `importSTEPEnsamble` (`occt.ts:2278`, `occt.ts:2412`). Hoy un STEP importado solo **reemplaza** la pieza principal (`importedStep` en `DocState`).
- **Lobby:** proyectos guardados más plantillas (`ForgeBRepStudio.tsx:4846`), donde viven EL VASO y LA JABONERA. Se agrega una entrada; no se crea una pantalla.
- **Limitaciones documentadas:** `docs/forja-research/LIMITACIONES-RECREAR-200.md` (A1, A2, A3).
- **Biblioteca de modelos:** `models/step/banco-arco/` (orden A).

## TOCA

- src/forja/brep/ForgeBRepStudio.tsx

## CREA

- scripts/forja-multicuerpo-diag.cjs
- scripts/precompute-banco-arco.cjs
- public/modelos/banco-arco/lrs-1200.bin
- public/modelos/banco-arco/disipador-125.bin
- public/modelos/banco-arco/to220.bin
- public/modelos/banco-arco/cap-35.bin
- public/modelos/banco-arco/pico2.bin
- public/modelos/banco-arco/pelicula-mks4.bin
- public/modelos/banco-arco/portafusible.bin

**Enmienda (medido en B1, antes de escribir código):** no se sirven STEP crudos. El diagnóstico mostró que A1 ya no se reproduce (40 cuerpos y 12 rebuilds sin caerse, 0.6–2.6 s), pero que un STEP de fabricante **dentro** del rebuild cuesta unos 33 s **por rebuild**. Por eso las piezas de fabricante se convierten a malla una sola vez (`scripts/precompute-banco-arco.cjs`, formato FMSH) y el estudio las dibuja como **piezas de referencia**, fuera del kernel. Así cambia B2: «STEP como componente» pasa a ser «pieza de referencia con giro XYZ, color y opacidad». `occt.ts` no se toca.

## BORRA

- (nada)

## PREEXISTENTE

- public/comando/
- public/precomputed/
- videos/
- scripts/guiones/
- scripts/canon/
- scripts/la-pluma/
- models/step/banco-arco/
- docs/PLAN-MVP-LA-PLUMA.md
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

## EVIDENCIA (se declara ANTES de trabajar)

- **B1.** `scripts/forja-multicuerpo-diag.cjs` en iangpu, con GPU real y en una copia aislada con su propio puerto (no se pisa el vite de 5178 de las otras sesiones). Sube N cuerpos de 2 a 40 y registra:
  - si construye;
  - el tiempo de rebuild;
  - los errores;
  - si la página se cae.

  Repite el rebuild varias veces para ver el heap. **Antes:** el número N en que se cae. **Después del arreglo:** 40 cuerpos y 20 rebuilds seguidos sin caerse.
- **B2.** Un STEP de fabricante como componente, girado en X/Y/Z, con color propio. Captura con GPU real.
- **B3.** El lobby muestra «BANCO DEL ARCO»; al abrirlo carga el ensamble. Captura.
- **B4.** `curl --compressed` del bundle publicado contiene la plantilla nueva.
- `node scripts/orden-gate.cjs --orden ordenes/2026-11-04-banco-arco-ensamble.md` en VERDE.
- **Censo:** canvas, vite y html sin cambio, porque no se crean pantallas.

## CIERRE (se llena al terminar)

- **orden vs entregado:** B1, B3 y B4 como se pidieron. B2 cambió por la enmienda: en vez de «STEP dentro del rebuild», piezas de referencia (`RefPart`: malla, caja o cilindro) con giro XYZ, color, opacidad y un panel que las nombra y las oculta o muestra con un clic. `occt.ts` no se tocó.
- **números:**
  - **B1, medido en iangpu con GPU real (puerto 5302 aislado):**
    - A1 ya no se reproduce: 40 cuerpos y 12 rebuilds seguidos sin caerse, de 0.6 a 2.6 s cada uno.
    - Lo que sí pesa es la LRS-1200 como STEP dentro del rebuild, unos 33 s por rebuild:
      - importSTEP: 6–9 s;
      - teselado: 4.1 s;
      - topología: 4.5 s;
      - caras y aristas: ~6.5 s;
      - exportSTEP: 2.8 s;
      - volumen, área y masa: ~4 s.
  - **Mallas FMSH:** 7 archivos, 4.9 MB y 139 k triángulos en total. Las más pesadas:
    - LRS-1200: 55 k triángulos, 1.8 MB, caja 230×41×124;
    - Pico 2: 68 k triángulos, 2.8 MB.
  - **BANCO DEL ARCO:** 28 piezas de referencia (152 k triángulos dibujados) más la placa de prueba del kernel (100×50×3 de acero, 15 000 mm³, 117.7 g). Desde el clic en la tarjeta del lobby hasta tener todo dibujado:
    - 1.7 s en la copia aislada;
    - 1.4 s en producción.
- **evidencia:**
  - **Capturas con GPU real**, en iangpu `/home/ian/forja-diag/` (banco-lobby, banco-iso, banco-torre, banco-antorcha) y `vivo/` (las mismas, en producción). Script: `scripts/banco-diag.cjs` de esa carpeta.
  - **Tipos:** `tsc --noEmit` en iangpu da 58 errores, todos anteriores a esta orden. Ninguno cae en líneas nuevas: el único que agregué, el del tipo del lobby, ya está corregido.
  - **Juez:** `node scripts/orden-gate.cjs --orden ordenes/2026-11-04-banco-arco-ensamble.md` en VERDE (91 cambios amparados; canvas 8→8, vite 42→42, html 47→47).
  - **Despliegue:** `./deploy-atlas-build.sh --quiet` dio DEPLOY OK (25/25 smoke).
  - **Bundle publicado** (`curl --compressed`): `/assets/forja-brep-rJX1oYe6.js` contiene «BANCO DEL ARCO», y las 7 mallas se sirven con su tamaño exacto en bytes.
- **preguntas abiertas:**
  - **Marcadores que esperan medida de ian:**
    - Ø del cuello de la antorcha;
    - Ø y largo de la bobina de 41 µH;
    - el sensor Hall que tiene;
    - el DC-DC;
    - el alto real de los capacitores.
  - **Las piezas impresas** (caja, falda, garra, mesa) hoy son cajas de referencia. Pasan a sólidos de la Forja en la orden D.
  - **El cableado** es la orden C.
  - **La lista de piezas cubre el lado izquierdo del visor.** Se pliega con su encabezado.
