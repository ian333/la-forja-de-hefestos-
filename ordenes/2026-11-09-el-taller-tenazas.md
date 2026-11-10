# ORDEN: EL TALLER + LAS TENAZAS (y después EL YUNQUE) — herramientas de Fusion en el estudio

BASE: fd8652c

OBJETIVO: ian 11-09: «LO QUE NECESITO SON LAS MISMAS HERRAMIENTAS DE FUSION 360… aquí no tengo manera de dar clic a
ninguna cara ni poder modificar, solo tengo rayos X». Pidió, en este orden y «pura interfaz, nada de v3»:
(1) EL TALLER con LAS TENAZAS: ver el árbol de piezas/cuerpos y dar clic a caras; (2) EL YUNQUE: boceto sobre una cara
y extruir. Esta orden cubre (1) completo; (2) se enmienda aquí mismo cuando ian decida cómo extruye sobre una pieza del
laboratorio (cuerpo nuevo pegado a la cara vs unir/cortar la pieza misma, que pide que llegue como sólido).

## YA-EXISTE (prueba de ausencia)
- Clic/hover a CARAS existe SOLO para el sólido del kernel: `SolidMesh` (ForgeBRepStudio.tsx ~2757) con `mesh.faceIds`
  (triángulo → cara OCCT), `togglePickFace`, `hoverFace`, `planeFromMeshFace` (~1110), boceto-en-cara por
  `sketchFacePendingRef` + `openSketchChooser` (~7368-7395). Se REUSA tal cual.
- Árbol estilo Fusion existe para el MOLDE (`moldParts`: aislar/ocultar/opacidad/expandir, `mold-part-<role>`).
  Patrón de UI a copiar, no a duplicar.
- El laboratorio entra como PIEZAS DE REFERENCIA (`RefPart`, `RefMesh` ~2114, mallas FMSH sin faceIds, panel
  «Piezas de referencia» ~9945 que solo oculta el nivel de arriba). Medido 11-09: las FMSH salen de
  `occt.tessellate` cara por cara y cada cara trae SUS vértices → componentes conexas por índice = caras B-Rep
  (tapa-iman 7, carro-loca 13, base-fd 601). No hay que regenerar nada.
- Ese panel SE CONVIERTE en El Taller (mismo lugar en el riel, mismo `ref-legend`); `RefMesh` gana tenazas.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- scripts/taller-verify.cjs

## BORRA
- (nada)

## PREEXISTENTE
- ordenes/2026-11-05-el-reparto-semana-4.md
- public/comando/analisis-ig.json
- public/comando/comentarios-analisis.json
- public/comando/comentarios.json
- public/comando/metricas.json
- public/comando/respuestas-comentarios.json
- public/comando/telemetria-sitio.json
- public/temis-deploy.json
- public/temis.json
- videos/atomo-c.json
- videos/atomo-ne.json
- videos/atomo-si.json
- videos/tutorial-01-nota-de-venta.json
- videos/tutorial-02-alta-de-producto.json
- videos/tutorial-03-alta-de-cliente.json
- videos/tutorial-04-cotizacion.json
- videos/tutorial-05-facturacion-portal.json
- videos/tutorial-06-remision.json
- videos/tutorial-07-editar-nota.json
- videos/tutorial-08-orden-de-compra.json
- videos/tutorial-09-cancelar-nota.json
- videos/tutorial-10-registrar-pago.json
- videos/tutorial-11-factura-desde-erp.json
- videos/tutorial-12-factura-global.json
- videos/tutorial-13-rep-complemento-pago.json
- videos/tutorial-14-calculadora-precios.json
- videos/tutorial-15-nota-de-venta-pro.json
- videos/tutorial-16-detalle-de-producto.json
- videos/tutorial-18-ajuste-masivo-inventario.json
- videos/tutorial-20-pdf-imprimir.json
- videos/tutorial-21-nota-de-credito.json
- videos/tutorial-22-gasto-operativo.json
- videos/tutorial-23-alta-de-proveedor.json
- videos/tutorial-24-buscar-clave-sat.json
- videos/tutorial-25-reportes-jugosos.json
- ordenes/2026-11-09-el-taller-tenazas.md
- public/comando/growth.json
- public/precomputed/caroteno-gemelos-color.json
- public/precomputed/caroteno-gemelos-fisica.json
- public/precomputed/water-hexamer-geom.json
- public/precomputed/water-hexamer-prisma-geom.json
- scripts/canon/
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/guiones/caroteno-gemelos.txt
- scripts/operador-revision-impresora-2026-10-31.out
- scripts/operador-revision-impresora-2026-10-31.py
- scripts/playlist-tutoriales.py
- scripts/precompute-caroteno-gemelos.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- iangpu GPU real (vite DEV + Playwright, `scripts/taller-verify.cjs`): abre «LABORATORIO v2 · generado» desde el lobby y
  - el Taller lista los 3 módulos con su cuenta (80 / 106 / 40) y se despliegan a sus hojas;
  - hover con tenaza CARA sobre una pieza impresa → se ilumina UNA cara (captura); clic → `taller-agarre` dice «Cara
    plana/curva · N mm²» y el nombre del cuerpo; el árbol marca y despliega esa hoja;
  - tenaza CUERPO / PIEZA → se ilumina la hoja / el módulo entero (capturas);
  - foco de un nodo hondo lo oculta (y solo a él); aislar deja solo ese subárbol; Esc suelta;
  - rayos X prendido: el clic ATRAVIESA la cubierta fantasma y agarra lo de adentro.
- capturas a 1920×1080 revisadas a ojo (no solo «pasó»).
- censo igual: 0 `<Canvas` nuevos, 0 entradas vite, 0 html.
- `node scripts/orden-gate.cjs` VERDE.

## CIERRE (se llena al terminar)
- orden vs entregado: idéntico para la parte (1). TOCA solo ForgeBRepStudio.tsx (carasDeMalla, tenazaHover, RefMesh con
  tenazas, El Taller en el riel, `__forgeBrep.taller` para QA); CREA solo scripts/taller-verify.cjs. Sin regenerar mallas.
- números: `scripts/taller-verify.cjs` en iangpu (forja-dev8, vite DEV :5009, ANGLE D3D12 RTX 4070 Ti): PASA 16/16 — árbol
  80/106/40, cara plana 22,500 mm² «mira a +Z» agarrada y marcada en el árbol, cuerpo 150×150×6, pieza 300×367×485 (80
  cuerpos), foco 225/226, aislar 40, Esc, rayos X 0 de 25 fantasmas tocados, 0 errores de página. tsc: 0 errores nuevos
  (los de ForgeBRepStudio caen fuera de lo tocado; ya estaban).
- evidencia: forja-shots/taller/01…07 (en iangpu /home/ian/forja-dev8/forja-shots/taller), revisadas a ojo: la cara se
  tiñe sola, el cuerpo y el módulo brillan enteros, el foco deja ver lo de abajo.
- preguntas abiertas: (2) EL YUNQUE — extruir sobre una pieza del laboratorio: ¿cuerpo nuevo pegado a la cara (ya), o
  unir/cortar la pieza misma (pide que esa pieza llegue como sólido: el generador escribe su STEP)? Se le pregunta a ian.
