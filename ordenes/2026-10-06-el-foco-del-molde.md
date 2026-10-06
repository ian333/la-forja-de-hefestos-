# ORDEN: EL FOCO DEL MOLDE — escanear el molde como Aloy escanea una máquina: cada pieza con su nombre y cada error con su lugar

ESTADO: hoy
PRIORIDAD: 1

BASE: abcadec

OBJETIVO: ian (2026-10-06): «el uso de la Forja debería sentirse como estar en una película futurista, como Horizon Zero Dawn /
Forbidden West. TENEMOS EL FOCO, MEJÓRALO PARA QUE TE AYUDE A IDENTIFICAR ERRORES… juzga todo visualmente». Hoy, en el molde
(captura 2026-10-06, 1536×864@2.5, 1599HBK): 8 rótulos de pines ENCIMADOS en un punto; cotas ✗ rojas sueltas que mezclan error real
con declaración dudosa; el panel de enfriamiento se cuela fantasma detrás del molde; ningún error tiene LUGAR en el 3D. Los tres defectos
reales de la revisión cruzada los encontraron agentes leyendo números, no el ojo.

## EL FOCO DEL MOLDE (diseño)
1. **Los hallazgos, una sola verdad**: un motor que recorre el molde por CUERPO (no por rol) y entrega una lista de hallazgos con
   LUGAR 3D, valor medido, límite, regla (cita o «regla de Hefestos») y severidad. Empieza por lo exacto/analítico: agua (cilindros) ↔
   barrenos móviles, piel de acero sobre puntas, colisiones del estudio de contacto por cuerpo. El inspector LEE esta lista: la cota
   dibujada y el veredicto salen del MISMO número (fin de las 5 tarjetas que se contradecían).
2. **El escaneo** (tecla Q, como el Foco): pulso radial que barre el molde, el acero se enfría a holograma, cada componente se delinea.
3. **Etiquetas de máquina**: nodo-rombo sobre la pieza, línea guía, ficha con nombre + un dato en lenguaje natural; sin encimarse
   (prioridad + separación en pantalla); cian = medido, violeta = simulado (la regla de Horizon que ya vive en foco-lentes.ts).
4. **Puntos débiles = errores**: marcador pulsante ámbar/rojo EN el lugar exacto, con «qué pasa · número de hoy · límite». Contador
   «N HALLAZGOS». Clic → la cámara vuela a la vista que lo enseña.
5. Limpieza: nada de paneles fantasma ni cotas ✗ sin clasificar en la vista por defecto.

## DECISIÓN DE IAN
- Literal arriba. Colores y regla de origen: foco-lentes.ts (2026-08-30). Explicaciones: física → número → límite (feedback del 09-22).

## EJERCICIOS
- [ ] motor de hallazgos por cuerpo; sobre la base (antes de las otras dos órdenes) DEBE encontrar solo: los 4 cruces agua↔retorno de la
      caja grande y la piel de 0.86 mm de la tapa / 0.57–0.66 del ensamble. Después de fusionarlas: 0.
- [ ] el escaneo + etiquetas + puntos débiles en el Canvas EXISTENTE de ForgeBRepStudio (cero Canvas nuevos); juzgado en capturas
      4K reales (1536×864 @2.5) en iangpu, de las 4 piezas.
- [ ] la vista por defecto del molde sin rótulos encimados ni paneles fantasma.
- [ ] tsc sin nuevos, cubo verde, orden-gate VERDE; video del inspector al cerrar.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldCotas3D.tsx
- src/forja/brep/useMoldStudio.ts
- scripts/inspecciona-molde.cjs

## CREA
- src/forja/mold/foco-molde.ts
- src/forja/brep/FocoMolde3D.tsx

- public/evidencia/2026-10-06-el-foco-del-molde/antes-molde-1599HBK.png
- public/evidencia/2026-10-06-el-foco-del-molde/foco-escaneado-1599HBK.png
- public/evidencia/2026-10-06-el-foco-del-molde/foco-interlock-1599HBK.png
- public/evidencia/2026-10-06-el-foco-del-molde/foco-escaneado-tapa.png

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
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- lista de hallazgos por pieza (JSON) antes/después de la fusión; capturas 4K del escaneo y de cada punto débil; censo de Canvas = igual.

## AVANCE 1 (2026-10-06 · medido en la app real, dev3, 1536×864 @2.5)
- Motor `escanearMolde`: 1599HBK 82 barrenos, 1005 pares eje a eje, 37 ms → el agua atraviesa 4 retornos (−3.78/−3.71) e INTERLOCK 3
  (−7.37, NUEVO), panzazo junto a EP-03 (3.49 vs 3.17). Tapa 68 barrenos, 627 pares, 20 ms → 8 pines con 0.86 mm de acero (= revisión
  cruzada), el agua atraviesa 2 interlocks (−5.20/−1.20, NUEVO), 1.03 junto al interlock 2, 2.68 junto a 2 guías, 3.30 junto a 2 retornos.
  Los dos defectos conocidos salen idénticos a lo medido por los agentes; los interlocks se pasaron a la orden del agua (enmienda).
- Visual: pulso + rombos pulsantes en cada lugar + fichas que no se enciman + holograma cian + paneles fuera + cámara que vuela al
  error con sus dos cuerpos en cian/rojo. Grupos: un problema en N lugares = 1 ficha (tapa 16 → 5).
- Pendiente: el inspector LEE focoMolde (una verdad); video 60 fps del escaneo; antes/después tras fusionar las otras dos órdenes.
