# ORDEN: biblioteca de componentes reales del banco del arco

ESTADO: hoy (ian presente, pidió «descarga los elementos que puedas descargar»)

BASE: d675896

OBJETIVO: los modelos 3D reales de los componentes del banco del arco viven en La Forja, con su licencia, su fuente y su medida exacta medida con el propio kernel (OpenCASCADE). Es el primer ladrillo para que todo el diseño, cableado incluido, se haga en La Forja (plan `docs/PLAN-MVP-LA-PLUMA.md` §12–14). Solo datos: no se toca código.

## YA-EXISTE (prueba de ausencia)

- `models/step/` ya guarda STEP de prueba (NIST, OCCT-test-data). No hay ningún componente electrónico ni fuente de poder.
- `scripts/componentes-reales.cjs` trae medidas de norma (TO-220, capacitores radiales, bornera) para dibujarlos a mano, pero no los modelos de fabricante.
- `src/forja/brep/occt.ts: importSTEP` lee un STEP como cuerpo principal. Usarlo como componente de ensamble es la orden siguiente (B), no esta.

## TOCA

- (nada)

## CREA

- models/step/banco-arco/LRS-1200-3D.stp
- models/step/banco-arco/rpi_pico2.step
- models/step/banco-arco/TO-220-3_Vertical.step
- models/step/banco-arco/DIP-14_W7.62mm.step
- models/step/banco-arco/CP_Radial_D35.0mm_P10.00mm_SnapIn.step
- models/step/banco-arco/CP_Radial_D30.0mm_P10.00mm_SnapIn.step
- models/step/banco-arco/C_Rect_L31.5mm_W13.0mm_P27.50mm_MKS4.step
- models/step/banco-arco/Heatsink_125x35x50mm_3xFixationM3.step
- models/step/banco-arco/Fuseholder_Cylinder-6.3x32mm_Schurter_0031-8002_Horizontal_Open.step
- models/step/banco-arco/LICENSE-pico2.txt
- models/step/banco-arco/LEEME.md

## BORRA

- (nada)

## PREEXISTENTE

Esto ya estaba cambiado antes de la orden: trabajo de video de otras sesiones, más los archivos de esta sesión creados con ian presente.

- public/comando/
- public/precomputed/
- videos/
- scripts/guiones/
- scripts/canon/
- scripts/la-pluma/
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

- `node scripts/orden-gate.cjs --orden ordenes/2026-11-04-banco-arco-biblioteca.md` en VERDE.
- Cada STEP abre con `importSTEP` del kernel, y su caja exacta queda escrita en `LEEME.md`. Esperado:
  - LRS de 230×41×124 mm, que cuadra con el datasheet (225×124×41 más terminales);
  - Pico 2 de 21×52 mm.
- Censo: canvas, vite y html sin cambio.

## CIERRE (se llena al terminar)

- **orden vs entregado:** idéntico. Se crearon los 11 archivos declarados y no se tocó código.
- **números:** cajas medidas con el kernel (`importSTEP` + `Bnd_Box AddOptimal`) en iangpu:
  - LRS: 230.0 × 41.0 × 124.0, que cuadra con el datasheet;
  - Pico 2: 21.0 × 52.3 × 3.8;
  - TO-220: 10.3 × 4.5 × 28.5;
  - disipador: 124.7 × 35.0 × 35.0.
- **evidencia:** `node scripts/orden-gate.cjs --orden ordenes/2026-11-04-banco-arco-biblioteca.md` da VERDE (80 cambios amparados; censo canvas 8→8, vite 42→42, html 47→47).
- **preguntas abiertas** (medidas que debe tomar ian):
  - alto real de los CE-2200 µF;
  - Ø y largo de la bobina de 41 µH;
  - Ø del cuello de la antorcha de la SOMI.
- **Gotcha:** el `occt.ts` de iangpu no trae `importSTEPEnsamble` (está más atrasado que el de la laptop). Hay que sincronizarlo antes de la orden B.
