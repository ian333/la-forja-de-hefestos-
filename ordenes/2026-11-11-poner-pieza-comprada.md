# ORDEN: PONER UNA PIEZA COMPRADA — caja o cilindro con sus medidas, dentro del Taller

BASE: d2482db

OBJETIVO: la brecha (`docs/forja-research/TALLER-BRECHA.md`, conclusión 9 y #2 de «Las 10 siguientes»): «de las piezas
que tú quieres mover de verdad (fuente real de 245×125×65, NEMA 23, alimentador Truper, carrete de 1 kg) ninguna puede
entrar hoy al Taller: las piezas solo llegan del generador». Sin ponerlas a su tamaño real no hay nada que rediseñar
alrededor (ronda 3 de la base, memoria project-lab-base-mantenimiento: la fuente NO es la del diseño). Al final: en El
Taller, «＋ poner una pieza comprada» → caja (ancho × fondo × alto) o cilindro (Ø × alto) con nombre → aparece junto al
banco, agarrada, lista para moverla con «mover», medirla y ponerle cuerpos nuevos encima; se guarda con el documento y
se puede quitar. Solo caja y cilindro: importar un STEP como pieza del Taller queda para otra orden.

## YA-EXISTE (prueba de ausencia)
- Las piezas de referencia YA tienen los tipos `caja` y `cilindro` (`RefPart`, `primRefGeo`), con su malla, sus caras
  (`carasDeMalla` junta coplanares en primitivas) y todo lo del Taller encima (tenazas, medir, mover, cuerpo nuevo).
  Y `refParts` YA viaja en el documento (`serializeDoc`/`loadDoc`). Lo ÚNICO que falta es una mano que agregue una:
  `setRefParts` solo se llama al cargar un documento (grep: estado, `loadDoc`, limpiar al cambiar de proyecto, QA).
- «Componente» del estudio (`addComponent`: caja/cilindro del KERNEL) no sirve: crea un sólido suelto en un documento
  que no tiene sólido (la auditoría lo marca como botón «raro» en el laboratorio).

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- scripts/piezas-verify.cjs

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
- ordenes/2026-11-11-poner-pieza-comprada.md

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `scripts/piezas-verify.cjs` (iangpu, GPU real), con el mouse y el teclado, en el LABORATORIO:
  - el formulario; una caja 245 × 125 × 65 «Fuente S-1200-48» → 227 cuerpos, agarrada, en «Piezas mías», y su caja mide
    245 × 125 × 65 exactos;
  - nace a 40 mm del banco, sobre el piso; la cámara NO brinca; un foco apagado sigue apagado y el golpe de otra pieza NO
    se vuelve a forjar (misma serie);
  - «mover» ΔX = −300 la corre; su cara dice que es comprada (no se une ni se corta);
  - un cilindro Ø56.4 × 76 entra igual;
  - guardar → laboratorio limpio (226) → cargar: regresan las dos donde estaban; «quitar» saca una y se lleva su movida.
  - capturas revisadas a ojo.
- Regresión: `taller`, `navegacion`, `yunque`, `mover`, `boceto`, `uso`, `medir`. tsc: 22 viejos, 0 nuevos. Gate VERDE.

## CIERRE (se llena al terminar)
- orden vs entregado: mismos archivos. ForgeBRepStudio.tsx: `ponerPiezaMia`/`quitarPiezaMia` (grupo `mias` «Piezas mías»,
  ids `mia-N`), formulario `pieza-poner` → `pieza-form` (tipo caja/cilindro, nombre, medidas) al pie del árbol, «quitar»
  en la caja de lo agarrado, QA `__forgeBrep.piezas`. Poner/quitar una pieza cambia `refParts` pero es el MISMO
  documento: no apaga focos ni aislado, no cierra el árbol, no tira los sólidos ya leídos del yunque (`mismoDocRef`,
  `ponerAgarra`) y no dispara el encuadre de llegada (`fitDeRefsRef`). La pieza nueva queda agarrada con tenaza Cuerpo.
- números: `piezas-verify` PASA 10/10 — caja 245 × 125 × 65 exacta, a 40.00 mm del banco y sobre el piso, cámara 0.00 mm,
  visibles 120 → 121 con un foco apagado, el golpe de otra pieza sigue en su serie 1 (no se reforjó); mover ΔX −300;
  cara de 30,625 mm² no forjable; cilindro Ø56.4 × 76; guardar → limpio (226) → cargar las regresa; quitar se lleva la
  movida. Regresión: `taller` 16/16, `navegacion` 15/15, `yunque` 24/24, `mover` 13/13, `boceto` 17/17, `uso` 17/17,
  `medir` 57/57. tsc: 22 viejos, 0 nuevos.
- evidencia: forja-shots/piezas/01…03 (forja-dev8), revisadas a ojo (el cilindro junto al banco, el árbol con «Piezas
  mías», la caja de lo agarrado con quitar / bajar / mover).
- lo que NO hace: importar un STEP como pieza del Taller; cambiarle las medidas a una pieza ya puesta (se quita y se
  pone otra); girarla; copiarla; no entra a Ctrl+Z (se quita con «quitar»).
