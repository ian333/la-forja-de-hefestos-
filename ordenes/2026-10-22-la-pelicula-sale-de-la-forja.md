# ORDEN: LA PELÍCULA SALE DE LA FORJA — transiciones entre pasos, la inspección como paso del pipeline, y la filmadora a 60 fps

ESTADO: hoy
PRIORIDAD: 1

BASE: 1fbde9d

OBJETIVO: ian (2026-10-22), sobre el tutorial del happy path: «es un pipeline, pero nunca siento cuando pasamos al otro lado… entre un paso
y el otro debería haber una animación» · «el video de producción debe salir de La Forja» · «el análisis del video del inspector no es algo
aparte: es parte del pipeline» · «no está a 60 fps». Tres piezas, en este orden:
1. **LA TRANSICIÓN** en la app: al avanzar de paso (por primera vez con esa pieza) una cortina con línea de escaneo, número/título/promesa
   del paso y la barra de 9 pasos; animada con rAF + performance.now (filmable con el reloj virtual). API `__forgeBrep.transicion(n)`.
2. **LA INSPECCIÓN** como paso 7 del pipeline (botón en la tira entre MOLDE y PLANOS): el pulso del Foco + el RECORRIDO por los puntos
   críticos con su corte (los 4 focos que eligió la revisión cruzada: el macho toca la pieza · el equilibrio de los botadores · el punto
   que manda el ciclo · abre-sale-empuja) y los hallazgos del Foco; cada punto con su cota dibujada = el número del veredicto.
3. **LA FILMADORA**: un script que recorre el camino EN la app con el reloj virtual, toma por toma a 60 fps y 4K real (captureScreenshot +
   clip.scale), con las transiciones y subtítulos de la app; las esperas de cálculo no se filman (se dicen). La voz de Matilda se mezcla al final.
Colores: provisionales (los del Foco) hasta que ian elija entre las 3 investigaciones de color en curso (Downloads/el-futuro/).

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/FocoMolde3D.tsx
- caminos/la-carcasa-de-mitsubishi.md

## CREA
- src/forja/brep/TransicionPaso.tsx
- src/forja/mold/inspeccion-recorrido.ts
- scripts/filma-camino.cjs

## BORRA
- (nada)

## PREEXISTENTE
- docs/CANON-VIDEO.md
- public/comando/analisis-ig.json
- public/comando/comentarios.json
- public/comando/metricas.json
- public/comando/respuestas-comentarios.json
- public/comando/telemetria-sitio.json
- src/cinematic/CinematicMolecule.tsx
- src/cinematic/camera-shots.ts
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
- public/precomputed/conos-caseta.json
- public/precomputed/conos-paleta-torres.json
- public/precomputed/osm-juriquilla-calles.json
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/guiones/caroteno-gemelos.txt
- scripts/playlist-tutoriales.py
- scripts/precompute-caroteno-gemelos.py
- scripts/precompute-caseta.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/conos-caseta-noche.json
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- capturas 4K de la transición a mitad de animación y del recorrido (cada punto con su corte y su cota); tsc sin nuevos; cubo verde;
  censo de Canvas igual; el video filmado a 60 fps (ffprobe) revisado por cuadros antes de entregar.
