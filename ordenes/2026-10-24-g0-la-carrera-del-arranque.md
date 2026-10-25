# ORDEN G0: LA CARRERA DEL ARRANQUE — el molde nunca sale de la pieza maciza

ESTADO: hoy
PRIORIDAD: 1

BASE: 2de9301

OBJETIVO: medida TRES veces con tres caminos distintos: (1) la filmadora con el reloj congelado (2026-10-23: agua «manda la pieza
2350 s», 0 pines), (2) orden A: picar el dictamen y el molde en 0.8 s → molde de la pieza maciza, sin botadores, 958 h de costo,
(3) orden B: entrar y salir del campo «pared» del intake → la E2 con la pieza maciza (IM-250, 0 pines). Causa: el efecto del paso 6
pone el intake y EL PUENTE re-siembra la E1 en el commit SIGUIENTE; si en medio dispara la E2, corre con la E1 vieja (pared = espesor
total). Y el campo «pared» usa `defaultValue` (React solo lo lee al montar): sigue mostrando 33.3 tras la re-siembra y al salir de él
manda la pared maciza de vuelta. Tercer defecto, del revisor (orden E): la inspección lee la apertura a los 450 ms; en una máquina
lenta cae a medio abrir y el punto 4 dice «abre 0.0 mm · NO CUMPLE» con el molde abierto en pantalla.

## LO QUE SE CAMBIA
- `useMoldStudio.ts`: la E1 lleva `intakeRev` (la revisión del intake que la sembró); las estaciones copian el ciclo, el sello viaja;
  la bolsa expone `intakeRev`.
- `ForgeBRepStudio.tsx`: el efecto del paso 6 no avanza una estación si `ciclo.intakeRev !== intakeRev`; la apertura de la inspección
  se lee cuando dos lecturas seguidas coinciden (cada 150 ms, hasta 3 s), no a los 450 ms.
- `MoldPanels.tsx`: el campo «pared» se re-monta (key) cuando la pared del ciclo cambia: muestra la pared vigente y no la manda de vuelta.

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldPanels.tsx

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- public/comando/analisis-ig.json
- public/comando/comentarios-analisis.json
- public/comando/comentarios.json
- public/comando/growth.json
- public/comando/metricas.json
- public/comando/respuestas-comentarios.json
- public/comando/telemetria-sitio.json
- public/precomputed/caroteno-gemelos-color.json
- public/precomputed/caroteno-gemelos-fisica.json
- public/precomputed/water-hexamer-geom.json
- public/precomputed/water-hexamer-prisma-geom.json
- scripts/blender-a-cuadros.sh
- scripts/captions-pendientes.py
- scripts/comentarios.py
- scripts/estado-yt.py
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/guiones/caroteno-gemelos.txt
- scripts/guiones/hielof.txt
- scripts/metricas-instagram.py
- scripts/metricas-youtube.py
- scripts/playlist-tutoriales.py
- scripts/precompute-caroteno-gemelos.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/video.sh
- scripts/voz-check.py
- scripts/yt-pendientes.sh
- src/cinematic/CinematicMolecule.tsx
- videos/atomo-c.json
- videos/atomo-ne.json
- videos/atomo-si.json
- videos/mol-h2o-el-hielo-flota.json
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
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA
- Gate VERDE; tsc sin errores nuevos; el cubo igual que antes de esta orden.
- La carrera reproducida en la app (iangpu): entrar y salir del campo «pared» antes del molde y picar dictamen→molde rápido → la E7
  trae 8 pines y el agua «manda el bebedero (75.7 s)» en las dos.

## CIERRE (se llena al terminar)
- orden vs entregado: idéntico. Sello `intakeRev` en la E1 + guarda en el efecto del paso 6 + apertura leída estable + campo «pared» con key.
- números (main fusionado A+C+B+E + esta orden, build de producción en iangpu, GPU real, 1594C Box):
  - MODO rápido (dictamen y molde en 0.8 s): E1→E8 con pared 3.2 en todas, E7 con **8 pines**, molde completo en 103 s.
  - MODO intake (entrar y salir del campo «pared» antes del molde): E1→E8 con pared 3.2, E7 con **8 pines**.
  - tsc 67 = 67 (sin nuevos); cubo **270/270**; gate VERDE.
- no verificado en la app: que el campo «pared» muestre 3.2 tras la re-siembra (el panel del intake no estaba montado cuando el arnés
  lo buscó). Se sostiene por la regla de React (un `key` nuevo re-monta el input con su `defaultValue`); se mide en la próxima pasada.
- evidencia: `scratchpad/pelicula/carrera.cjs` (arnés de los dos caminos) y su salida en esta sesión.
