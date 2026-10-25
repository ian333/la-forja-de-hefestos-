# ORDEN: EL MODO CAMINO — cada paso muestra solo lo suyo (crítica de la interfaz, 2026-10-23)

ESTADO: hoy
PRIORIDAD: 1

BASE: 6f4cf2a

OBJETIVO: ian (2026-10-23), viendo la película: «no me termina de gustar el tipo de letra ni nada de los textos… hay muchas cosas en
la pantalla de otras cosas que no se deben de ver» → tres críticos Opus + debate (Downloads/la-pelicula/CRITICA-INTERFAZ.md) → «dale,
me gusta el plan». Esta orden es la 1 de 3: TODO lo barato (S). Al final: cuando sigues el camino (la pieza entró por STEP y no abriste
DISEÑO), La Forja muestra SOLO lo del paso — igual para el cliente y para la película (no es un modo de filmación: es el producto).
1. Paso 6 sin las cotas de autoprueba ✓/✗ ni los rótulos de pin apilados (20 rótulos → 1).
2. Cada lente muere con su paso (la escala térmica, las leyendas de enfriamiento y partición, «Boceto 1», el encabezado de estación).
3. Una sola navegación: el riel. Fuera la tira de lentes, DISEÑO/MANUFACTURA/SIMULACIÓN, «EL DICTAMEN D», «S atajos», la telemetría.
4. Fuera MOLD TOOLS/DOCUMENTO/PARÁMETROS/ANÁLISIS en el camino; cubo e ISO/SUP/FRE solo al mover el ratón; tarjeta de estación de 2 líneas.
5. Un solo veredicto ◆◇✓ con su alcance (04 «tu pieza sola, antes del molde» · 07b «en el molde» · 09 sin ✓ verde ni «decisión de ian»),
   después de decidir la verdad del «✗ CLARO §9.2.7» del dictamen contra el 3.49 «de panzazo» del Foco.
6. Mapa fijo: riel en la banda muerta de arriba, ancho completo, nombres completos; subtítulo con caja fijo en y 1680–1860; tarjetas
   que terminan en y ≤ 1600; el subtítulo no repite la tarjeta (se reescriben las frases de la inspección y se regenera la voz).
7. La letra, el USO: mono solo en cifra+unidad; versales solo ≤3 palabras; tamaños del camino con mínimo 16 px CSS (40 px a 4K);
   fuera Inter/system-ui/ui-monospace de los estilos en línea del lobby, la escala térmica y el expediente (la lámina Arial queda
   para la orden 2: es otro motor).
Luego: build dev3, refilmar la película completa (3 lotes), montar, revisar por cuadros, entregar en los dos PCs, desplegar y verificar.

## YA-EXISTE (prueba de ausencia)
- FocoMolde3D.tsx:256 y :400 — el Foco y la inspección ya apagan paneles con un `<style>` inyectado por data-testid
  ('feature-tree','op-panel','analysis-panel','face-list','sim-panel','curso-report','params-panel','escala-enfriamiento',
  'ficha-en-el-mundo','mold-cotas-overlay'). EL MODO CAMINO es ESE mecanismo, extendido a todo el camino y a más elementos: no un
  componente nuevo ni otra pantalla.
- piel-futuro.ts PIEL_CSS ya pisa el CSS del estudio por orden; `.fb-ribbon-min .fb-hud-view{top:102px}` ya conoce la banda.
- TransicionPaso.tsx `RielDePasos` ya tiene modo 'completo' (ancho total): en el camino siempre 'completo'.
- ForgeBRepStudio.tsx `pasoActual` ya deduce el paso; `cotasOn`/`cotasAntesInsp` ya apagan las cotas en la inspección.
- MoldPanels.tsx ya es la casa de los paneles DOM del molde: la tarjeta de estación va ahí.
- scripts/filma-camino.cjs + monta-pelicula.py/une-tomas.py (hoy en iangpu el-plan y en el scratchpad, fuera del repo): entran al repo
  para que la película sea reproducible desde aquí.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/FocoMolde3D.tsx
- src/forja/brep/TransicionPaso.tsx
- src/forja/brep/piel-futuro.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/mold/inspeccion-recorrido.ts
- scripts/filma-camino.cjs
- caminos/la-carcasa-de-mitsubishi.md

## CREA
- scripts/monta-pelicula.py
- scripts/une-tomas.py
- scripts/guiones/pelicula-camino.json
- scripts/guiones/pelicula-camino.txt

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
- ordenes/2026-10-23-el-modo-camino.md
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

- public/comando/comentarios-analisis.json
- scripts/comentarios.py
- scripts/metricas-instagram.py
- scripts/metricas-youtube.py

## ENMIENDA 2026-10-24
- CREA + scripts/guiones/pelicula-camino.txt: narracion-gen.py lee una frase por renglón (el .json es para el montaje); mismo guion.
- PREEXISTENTE + 4 archivos de telemetría (comentarios/métricas IG/YT) que otra sesión modificó DESPUÉS de crear esta orden; no son de aquí.

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `node scripts/orden-gate.cjs` VERDE; censo igual (8 Canvas · 42 entradas · 47 html).
- La película nueva (4K60, sin cuadros negros) revisada por cuadros en las anclas de la voz: cada frase sobre lo que nombra.
- Conteo de bloques visibles por cuadro (mismo método de la crítica): paso 6 ≤ 6 bloques y 1 rótulo (hoy 25 + 20); inspección ≤ 6
  (hoy 18–19); cero restos de otros pasos (escala térmica, leyendas, encabezado de estación) en 05–09.
- El 3D ocupa ≥ 80 % del cuadro en el paso 6 (hoy 46 %); el subtítulo en y 1680–1860 en todos los cuadros; ninguna tarjeta baja de y 1600.
- En producción: temis-deploy.json con el commit + el bundle servido con los testids nuevos.

## CIERRE (se llena al terminar)
- orden vs entregado: puntos 1–7 hechos (modo camino, lentes mueren con su paso, una navegación, paneles fuera, veredicto único con
  alcance, mapa fijo, mono solo en cifras + fuentes de la piel). Hallazgo extra: el reloj virtual congelado disparaba temporizadores con
  cierres viejos (molde de OTRA pieza: agua «manda la pieza 2350 s», 0 pines); arreglado en la filmadora (arranque en real + seguro rc=3).
- números: gate VERDE; tsc sin errores nuevos (22=22, 3=3); película 119.8 s · 7,188 cuadros · 0 negros · molde correcto en 3 de 3 lotes.
- evidencia: Downloads/la-pelicula/la-forja-camino-4k60.mp4 + HOJA-de-cuadros.jpg; logs pelicula4/5 en iangpu el-plan.
- pendiente: DEPLOY a producción (no corrido por límite de uso); la prueba de letra A/B/C y el dictamen con cuerpo (orden 2).
