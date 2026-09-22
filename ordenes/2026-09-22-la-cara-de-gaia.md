# ORDEN: La cara de GAIA — los logos, en el Comando

> ian, 2026-09-22: «necesito que en el comando estén todos los logos, no sé qué logo usar
> para gaia, además sus módulos necesitan una cara comercial: hermes, hefestos, iris, athena».
> Presente y pidiendo. La orden existe porque se crea un archivo.

BASE: 26628d1

OBJETIVO: una pestaña MARCA en el Centro de Comando con TODOS los logos dibujados en vector:
6 propuestas para GAIA (para elegir una) y una por módulo (Hermes, Hefestos, Iris, Athena),
cada una vista en negro, en blanco, en tamaño de favicon (32 px) y con su lockup horizontal.
Descargables en SVG desde la misma página, para el IMPI y para quien haga el sitio.

## YA-EXISTE (prueba de ausencia)
- `src/comando/ComandoCenter.tsx`: el Comando con 6 pestañas (publicar, cad, calidad, prod,
  tele, temis). Se le AGREGA una pestaña; no se crea otra página.
- `public/`: no hay ningún logo vectorial de GAIA ni de los módulos (solo `vite.svg`).
- La identidad de los módulos ya está escrita en `landing_gaia/src/components/Features.tsx`:
  Hermes = ventas/facturación/inventario (verde), Hephaestus = órdenes de trabajo (cian),
  Iris = comunicación (morado), Athena = analítica (ámbar). Los logos respetan esos colores.
- El oro del Comando (`GOLD = #FDB813`) es el color de GAIA y se reusa.

## TOCA
- src/comando/ComandoCenter.tsx

## CREA
- src/comando/Logos.tsx

## BORRA
- (nada)

## PREEXISTENTE
- docs/CANON-VIDEO.md
- public/comando/comentarios.json
- public/comando/respuestas-comentarios.json
- src/cinematic/CinematicMolecule.tsx
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
- ordenes/2026-09-22-la-cara-de-gaia.md
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `node scripts/orden-gate.cjs` verde.
- Capturas de la pestaña MARCA a 1440×900 y a 390×844, hechas en forja-dev2 (:5194) con
  Playwright, MIRADAS una por una antes de entregar.
- Cada marca legible a 32 px y reconocible en una sola tinta (negro sobre blanco).
- censo esperado: html igual, vite igual, canvas igual.

## CIERRE (se llena al terminar)
- orden vs entregado: idéntico. Solo se tocó `ComandoCenter.tsx` (import, tipo de la pestaña,
  botón y panel) y se creó `src/comando/Logos.tsx`.
- números: ORDEN_GATE VERDE (html 47→47, vite 42→42, canvas 8→8) · `npx vite build` en
  forja-dev2 compila en 31.5 s · consola limpia en las dos capturas · pliego en
  Downloads/gaia-logos (1440×900 y 390×844, deviceScaleFactor 2).
- tres marcas se rehicieron DESPUÉS de mirarlas: la semilla v1 se leía como el ojo tachado de
  «ocultar contraseña»; Hermes v1 parecía una pluma y v2 una lupa (quedó moneda con alas);
  Hefestos v1 parecía copa de cóctel (quedó yunque). El anillo abierto se descartó y entró
  «el enlace». Riesgo anotado: a 32 px «el enlace» puede leerse como unos lentes.
