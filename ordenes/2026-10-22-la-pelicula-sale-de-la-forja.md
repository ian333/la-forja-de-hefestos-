# ORDEN: LA PELÍCULA SALE DE LA FORJA — transiciones entre pasos, la inspección como paso del pipeline, y la filmadora a 60 fps

ESTADO: hoy
PRIORIDAD: 1

BASE: 1d960df

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
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldScene.tsx
- src/forja/brep/MoldPanels.tsx
- src/forja/mold/foco-molde.ts
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

## ENMIENDA 2026-10-22 · EL CICLO A 60 fps
Medido en el build de producción (dev3, 1594C Box): con el ciclo del molde corriendo la página va a **7 fps** (14 cuadros en 2 s,
huecos de 231 ms); con el molde quieto, **57.5 fps**. Causa: cada cuadro del ciclo hacía `setCicloProg` + `setTFill` y cada uno
re-dibujaba el estudio entero. La transición entre pasos se veía a 7 fps (o nada) mientras el molde trabajaba. Entra al TOCA:
useMoldStudio.ts (el ciclo escribe referencias; setState solo al cambiar de acto o al cruzar «lleno»), MoldScene.tsx (FillVivo),
MoldPanels.tsx (la barrita lee la referencia), foco-molde.ts (el par más justo para la inspección).

## AVANCE 1 (2026-10-22 · medido en el build de PRODUCCIÓN de dev3, 1594C Box)
- LA TRANSICIÓN: `TransicionPaso` (cortina + línea de escaneo + número/título/promesa + barra de 9 pasos), sola por API a **60 fps**
  (156 cuadros en 2.6 s, hueco máx 19 ms). Su reloj arranca en su PRIMER cuadro pintado (el clic congela el hilo 0.6–0.8 s en dev).
- LA INSPECCIÓN (paso 7, botón en la tira): cortina → pulso del Foco → recorrido de 4 puntos, cada uno con aislar/corte/cámara/marcas/cota.
  Carcasa: macho 50/50 · equilibrio 3.85 vs tope 10.7 · agua más justa 3.49 vs 3.17 (de panzazo) · abre 152.5 vs 112.5 y la carrera
  cabe (46 vs 41.3) — los mismos números de la revisión cruzada. Al entrar se DETIENE el ciclo del molde y se apartan cotas/rótulos/paneles.
- EL CICLO DEL MOLDE (medido): 7–8 fps corriendo vs 57 quieto. Causa 1 (arreglada): 2 setState por cuadro sobre el estudio entero →
  referencias (abrir/expulsar: 31 fps). Causa 2 (abierta, orden aparte): `FrenteSuperficie` recalcula el marching cubes de ~111 k vóxeles
  en CADA cuadro del llenado → 5.5 fps durante LLENANDO. Arreglo de raíz: superficie una vez + recorte por tiempo en la GPU.
- Color: 3 direcciones en Downloads/el-futuro/ (cyberpunk · holograma de cine · futuro real) — elige ian. Colores actuales provisionales.
- Pendiente: la filmadora (paso 3 de la orden).

- BASE movida a 1d960df: el avance 1 de esta orden quedó en 2608b5b y la piel en su propia orden (1d960df); desde aquí el juez mide la filmadora.
