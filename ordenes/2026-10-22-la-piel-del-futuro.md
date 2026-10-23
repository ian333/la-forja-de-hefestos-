# ORDEN: LA PIEL DEL FUTURO — cyberpunk + holograma de cine: una sola piel para toda La Forja

ESTADO: hoy
PRIORIDAD: 1

BASE: 2608b5b

OBJETIVO: ian (2026-10-22): «la idea es crear una interfaz que se sienta como el futuro en verdad» → tres agentes investigaron
(Downloads/el-futuro/) → ian: «definitivamente cyberpunk combinado con holograma de cine». La mezcla:
- del HOLOGRAMA DE CINE la estructura: vacío azul marino, vidrio, hilos finos, el acero que se vuelve holograma de hielo, «todo se apaga
  menos lo que está en duda», las reglitas número-contra-límite;
- del CYBERPUNK la energía: neón con significado (falla #FF2D55 ◆, de panzazo naranja #FF8A1F ◇, colada magenta), el AMARILLO del operador
  (#FCEE0A = «tú estás aquí», nunca un dato), la barra de los 9 pasos siempre visible, Chakra Petch, ruido de pantalla SOLO en el 3D y
  «lo único que tiembla es una falla».
La regla de ian se queda: cian = MEDIDO, violeta = SIMULADO (con trama). Una sola fuente de tokens (piel-futuro.ts) para el CSS del
estudio (variables --ds-*), el Foco, la inspección, la transición y los colores del molde.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/FocoMolde3D.tsx
- src/forja/brep/TransicionPaso.tsx

## CREA
- src/forja/brep/piel-futuro.ts
- public/fonts/chakra-petch-500.woff2
- public/fonts/chakra-petch-600.woff2
- public/fonts/chakra-petch-700.woff2
- public/fonts/barlow-400.woff2
- public/fonts/barlow-500.woff2
- public/fonts/barlow-600.woff2
- public/fonts/jetbrains-mono.woff2
- public/fonts/LICENCIAS-OFL.txt

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
- capturas 4K (1536×864 @2.5) de los 9 pasos con la piel, juzgadas; contraste del texto ≥ 4.5:1 medido; tsc sin nuevos; censo igual.

## AVANCE 1 (2026-10-22)
- piel-futuro.ts = UNA fuente de tokens: el CSS del estudio (pisa las variables --ds-*), el Foco, la inspección, la transición y
  `focoMoldeTinte` leen de ahí. Fuentes OFL self-hosted (woff2, ~270 KB) con LICENCIAS-OFL.txt.
- Nuevo: EL RIEL DE LOS 9 PASOS siempre visible (las 3 investigaciones lo pidieron); entre los paneles en la vista normal, ancho
  completo en el Foco y la inspección. La barra de vistas (ISO·SUP·FRE) baja un renglón.
- Las REGLITAS número-contra-límite en cada hallazgo; «lo único que tiembla es una falla» (salto determinista, puro en t).
- Capturas 4K del build de producción (dev3): el Foco con la piel, el enfriamiento, la inspección. Visto y corregido: el riel se
  encimaba con DOCUMENTO/PARÁMETROS (→ va entre ellos).
