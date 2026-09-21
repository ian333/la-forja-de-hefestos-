# ORDEN: EL PLAN DE INSPECCIÓN — lo que una IA revisa para saber que un molde está bien: 8 preguntas, sus distancias, y la cámara para MIRAR cada punto

ESTADO: cerrado
PRIORIDAD: 1

BASE: 9be0f7a

OBJETIVO: ian (2026-09-21, tras el video 35): «¿QUÉ COSAS VERIFICARÍAS TÚ COMO IA PARA SABER QUE ESTÉ BIEN? ¿hay puntos
críticos… distancias?… hagamos una lista, y necesitas poder controlar la cámara para revisar los puntos… pon varias
piezas y ve sus planos» y luego «date, y déjame imágenes o un video de ti inspeccionando todo eso… tenemos que arreglar
todo esto antes de cumplir ambos happy paths». Al final de esta orden existe un PLAN DE INSPECCIÓN (como el de una CMM):
cada punto = qué se mide · la regla con su cita · la medición · el umbral · LA VISTA — corrido sobre 4 piezas distintas,
con una TARJETA por punto (número + captura) y un video del recorrido. Lo que falle NO se arregla aquí: se ordena.

## LAS 8 PREGUNTAS (la lista acordada)
1. ¿CIERRA? el macho DENTRO de la pieza · cavidad ∩ núcleo = ∅ · la partición cierra.
2. ¿HAY ACERO ENTRE LAS COSAS? agua↔moldeante 2D..5D · agua↔barrenos ≥ ½ D · agua↔caras de placa · pin↔borde · retornos↔inserto.
3. ¿ABRE Y EXPULSA? apertura ≥ pieza + bebedero · expulsión ≤ libre de la caja y ≥ lo que agarra · colisión en TODO el ciclo.
4. ¿CABE EN LA INYECTORA? luz, barras, tonelaje, carrera del expulsor, anillo, boquilla.
5. ¿LLENA Y ENFRÍA? flujo/espesor · presión · venteo donde muere el aire · pared máx/mín · punto caliente↔agua.
6. ¿EXPULSA SIN DAÑAR? F_eject con pared y draft REAL · pandeo con el largo verdadero · pin ≤ pared · donde agarra.
7. ¿SE PUEDE FABRICAR? agua taladrable desde un canto · cruces que se encuentran · asientos de cabezas · catálogo.
8. ¿EL PLANO = EL 3D? cada cota medida en el sólido · tablas de barrenos · BOM vs piezas.

## LO QUE SE MIDIÓ AL ABRIR (qué cámara hay y cuál falta)
- HAY: `orbitTo(az, el, r, tx, ty, tz)` (el negativo = desde abajo) · `setView` · `moldIsolate/moldShowAll` · `moldVista(opac,
  xray)` · `__moldOpen(t, e)` · `moldGeom` (cajas por rol) · `moldSolidCollisions` · `encuadre` · `btn-ciclo-play`.
- FALTA (entra aquí, chico): (1) **corte por coordenada ABSOLUTA del marco del molde** — `setSection` se mueve sobre la
  caja de la PIEZA en el marco del STEP y no alcanza el centro del molde (x = 123); (2) **estado fijo del ciclo** — el
  lazo de `cicloPlayToggle` pisa `__moldOpen` manual en cada cuadro.
- FALTA (NO entra: se registra): tapa sólida del corte (hoy se ven cascarones) · ortográfica con escala · «distancia
  mínima entre dos roles» con sus dos puntos y su cota dibujada.

## EJERCICIOS
- [x] `__forgeBrep.inspeccion`: `corte(eje, mm, voltea)` y `estado(apertura, expulsión)`.
- [x] el recorrido de inspección (script del arnés, fuera del repo) sobre la carcasa: tarjetas + números.
- [x] las otras 3 piezas: 1594C Lid (plana) · 1599HBK (alta) · 1557BGY (de ensamble).
- [x] la tabla: qué puntos fallan más · cuáles NO se pudieron mirar por falta de cámara · el orden de arreglo propuesto.
- [ ] video del recorrido en las dos PCs — APLAZADO por ian (2026-09-21: «no es necesario que me entregues grabaciones aún… las inspecciones es lo crucial»); los 4 webm quedaron en iangpu:/home/ian/el-plan/*/video.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- public/temis.json
- public/temis-deploy.json

## CREA
- public/evidencia/2026-09-21-el-plan-de-inspeccion/resultados.json
- public/evidencia/2026-09-21-el-plan-de-inspeccion/tarjetas-carcasa.png
- public/evidencia/2026-09-21-el-plan-de-inspeccion/tarjetas-4-piezas.png

## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol; foto al abrir, 2026-09-21)
- public/comando/comentarios.json
- public/comando/respuestas-comentarios.json
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
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
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- Una tarjeta por punto de inspección (captura desde SU vista + el número + veredicto) para 4 piezas.
- La tabla de fallas por pregunta y la lista de lo que no se pudo mirar.
- Video del recorrido en ambas PCs; tsc sin errores nuevos; orden-gate VERDE.

## CIERRE (2026-09-21 · pasada 1 · MEDIDO, no contado)

**Existe el plan: 8 preguntas → 17 puntos con número, umbral y vista; corrido sobre 4 piezas (carcasa honda, tapa plana,
caja grande 396×296, caja que llegó como ensamble) y juzgado por 4 revisores Opus, uno por pieza.** ian pidió dejar el
video para después («el mp4 no es tan crucial, son las inspecciones»): no se entrega video en esta pasada.

**Manijas nuevas** (`__forgeBrep.inspeccion`): `corte(eje, mm, voltea)` por coordenada ABSOLUTA del molde y
`estado(apertura, expulsión)` que detiene el ciclo y fija la pose. tsc 66 = 66.

**LA TABLA (✗ = falla) — `resultados.json`**
- 4/4 piezas: el agua B rompe la cara inferior de su placa (−1.14 mm, CONSTANTE) · el agua entra al soporte · la apertura
  2.5·H no saca pieza + bebedero (faltan 25–47 mm) · los insertos no traen sus barrenos (pines, bebedero, agua A).
- 3/4: la carrera no cabe (8–12 mm dentro del soporte) · las puntas de los pines NO están en la cara del macho (±1.0–1.6 mm).
- 2/4: retornos a través del inserto de núcleo · un pin (o un retorno) cruzando una línea de agua B · macizos que mandan
  el ciclo (6.2× y 4×).
- 4/4 ✓: agua A bajo su cara · las guías enganchan antes que el macho · cabe en la inyectora del taller.

**Lo que los revisores cazaron y YO VERIFIQUÉ** (detalle y estado de cada uno en `resultados.json → cruceConRevisores`)
- El punto 6.1 era TAUTOLÓGICO: el código coloca la punta en `zBaseCerrada − pared mediana` y yo medía contra lo mismo.
  El piso real no es la pared mediana → puntas 1.06 / 1.56 mm hundidas (botón de plástico) o 1.04 mm metidas en la pieza.
- **Expulsión DESBALANCEADA**: el agarre coloca por puntaje sin equilibrio — centroide a 15.6 mm (carcasa), 32.5 mm
  (caja grande: 4 pines en fila sobre UNA orilla), 11.5 mm (ensamble).
- El agua dice DOS cosas (3D ⌀4.76 vs lámina ⌀6.35/9.53/15.9): dos fuentes en el código, no «radio por diámetro».
- 2.2 dio ✓ mirando la cara equivocada (el agua A entra 1.6–2.2 mm al inserto de cavidad); 2.3 callaba cruces.
- FALSOS, y por qué: «la pieza está al revés» (la vista engañó al revisor: la pieza pintada tapa al macho) · «no hay
  lámina de ensamble» (mi captura se saltó la página 0).

**El veredicto más importante es sobre MI CÁMARA:** de 64 tarjetas, más de la mitad «no se ve». Los números valen; las
vistas todavía no prueban nada → ordenes/despues/2026-09-21-la-camara-del-inspector.md.

**ORDEN DE ARREGLO PROPUESTO (por causa raíz, no por síntoma)**
1. LA PILA SE DIMENSIONA POR LA PIEZA — la caja expulsora (66), las sujeciones (36) y el soporte (22) son literales;
   la apertura es 2.5·H sin bebedero. Un solo lugar (`packageToAssemblySpec` + la regla de apertura) arregla 3.1, 3.2 y la
   flecha del soporte. (Ya existe LA CARRERA CABE: se ensancha a esto.)
2. EL AGUA — una sola fuente de ⌀ (EL AGUA DICE DOS COSAS) y un juez que mida contra las CARAS de la placa, el inserto,
   los retornos y el KO. Arregla 2.1, 2.2, 2.3, 2.5, 7.1.
3. LOS PINES — punta contra la cara REAL del macho (rayo), equilibrio del centroide, cabeza capturada, y el mismo ⌀ de
   cuerpo en láminas. Arregla 1.1, 6.1 y el desbalance.
4. LOS INSERTOS SE BARRENAN — pines, bebedero y agua cortados en el acero del inserto (hoy macizo); retornos FUERA del inserto.
5. LA CÁMARA DEL INSPECTOR — para poder VER que 1–4 quedaron.

**Entrega** · `public/evidencia/2026-09-21-el-plan-de-inspeccion/`: `tarjetas-carcasa.png` (las 16), `tarjetas-4-piezas.png`
(corte por el eje · expulsado · paquete desde abajo, × 4 piezas), `resultados.json` (puntos × piezas + cruce con revisores).
