# ORDEN: LA PELÍCULA SALE DE LA FORJA — transiciones entre pasos, la inspección como paso del pipeline, y la filmadora a 60 fps

ESTADO: hoy
PRIORIDAD: 1

BASE: e14ec2a

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
- scripts/filma-camino.cjs
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

## ENMIENDA 2026-10-23 · LA VOZ SE QUEDABA ATRÁS, y las estaciones que no salieron
Revisada por cuadros la primera película montada (94.8 s, 4K60, 0 cuadros negros): **la voz se iba quedando atrás de la pantalla en la
inspección** — a los 65 s decía «el tope es 10.65» con el punto 3 (agua) ya en pantalla; a los 79 s «Abre 152.5» caía sobre los planos;
«Los planos: 17 láminas» sobre el expediente. Causa medida: la app avanzaba cada punto a los **7.5 s** y cada punto narra dos frases
(≈10 s). Un humano tampoco lee la tarjeta (pregunta, número, tope, explicación, regla) en 7.5 s. Arreglo DE PRODUCTO, no de edición:
**11 s por punto, 12.5 el que anima, el Foco 5.5 s** (ForgeBRepStudio.tsx) — la toma 7 pasa de 38.2 a 54.0 s.
Y en la toma 6 solo salió la estación 8: el armado corría en tiempo real y las estaciones 4–7 pasaron mientras se filmaba la 3.
Arreglo en la filmadora: el armado corre con el reloj virtual encendido y sus temporizadores **congelados** mientras se filma
(`__vt.congela`); entre plano y plano se sueltan 0.5 s virtuales y la siguiente estación se calcula fuera de cámara. Cada estación
nueva = 1.8 s limpios; el ciclo entero (14.5 s). `HASTA=6/7` para refilmar por lotes (<5,100 capturas por navegador).
TOCA sin cambios (ForgeBRepStudio.tsx ya estaba; filma-camino.cjs es CREA de esta orden).

## AVANCE 2 (2026-10-23 · LA PELÍCULA, segunda pasada · entregada)
- `Downloads/la-pelicula/la-forja-camino-4k60.mp4` (3840×2160, 60/1, 119.8 s, H.264 + voz + subtítulos) y `-master-10bit.mp4` (HEVC
  10-bit, sin subtítulos) en los DOS PCs, md5 iguales; `la-forja-camino-HOJA-de-cuadros.jpg` = los 32 cuadros revisados.
- Tomas: 1–5 de la primera filmación · 6 refilmada con temporizadores congelados (nace 3.2 s + estaciones 4·5·6·7·8 a 1.8 s + el ciclo
  entero 14.5 s) · 7 refilmada a 54.0 s (3,240 cuadros) · 8–9 de la refilmación limpia del 22. 7,188 cuadros, 0 negros (el único tramo
  que marca blackdetect, 114.15–114.30, es la cortina del paso 9 sobre el expediente).
- Revisado por cuadros en el punto medio de las 20 frases: cada frase cae sobre lo que nombra (el tope 10.65 con el punto 2, el agua
  3.49 con el punto 3, «Abre 152.5» con el punto 4, los planos con los planos).
- Medido: el armado con el reloj virtual congelado tardó 249 s reales (vs 150 en real) — el precio de soltar el reloj de 0.5 en 0.5 s.
- Pendiente (se ve en la película, no la detiene): el paso 6 sucio (rótulos de pines apilados, cotas ✗ de auditoría, panel MOLD TOOLS,
  la escala de enfriamiento que no se va); el dictamen deja ver borroso el mapa térmico; la cortina del paso 9 queda DEBAJO del modal del
  expediente; los dos veredictos (Foco 0 débiles vs dictamen 70/100) siguen siendo el P0 del QA comercial.
- BASE movida 1d960df → e14ec2a (2026-10-23): en medio entró la cabecera de la piel (e14ec2a, orden de la piel); desde aquí el juez mide
  la enmienda de hoy. filma-camino.cjs pasa a TOCA (ya existe en la BASE movida).
