# ORDEN: MALLAS VIEJAS EN PRODUCCIÓN — lo que se ve en el laboratorio tiene que ser lo que se forja

BASE: 09283c7

OBJETIVO: ian desplegó 09283c7 (11-12 21:33). Al correr las suites CONTRA PRODUCCIÓN salió que 16 de las 30 mallas del
laboratorio (`/modelos/laboratorio/**.bin`) son las del 6 de noviembre: nginx manda `Cache-Control: public, max-age=2592000,
immutable` a todo `.bin` (regla pensada para archivos con hash en el nombre) y Cloudflare las guarda 30 días
(`cf-cache-status: HIT`, `age` de 6.4 días); las mallas de `/modelos/` NO llevan hash. Los `.step` y el `.json` no se
guardan, así que en esas 16 piezas se ve una geometría vieja y se forja la nueva (columna 2: 633,670 mm³ a la vista,
1,814,635 en el STEP; el barrido de forja da 29/30 en producción y 30/30 en desarrollo). El origen sí tiene los archivos
buenos (pedidos con `?v=` salen idénticos al repo). Al final: las mallas se piden con el sello del despliegue en la
dirección (ningún caché viejo las alcanza), y queda un verificador que compara lo publicado contra el repo.

## YA-EXISTE (prueba de ausencia)
- `loadRefMesh(url)` en `ForgeBRepStudio.tsx`: el ÚNICO lugar que pide mallas de referencia (laboratorio y banco-arco).
  Pide la URL pelona. Se le agrega el sello ahí; no se toca el documento (los guardados en rhea traen URLs sin sello).
- `/temis-deploy.json`: lo estampa cada despliegue (commit + fecha) y nginx lo sirve sin caché (`no-store`, comprobado).
  Es el sello; no se inventa otro ni se toca la configuración de vite.
- No hay ninguna comprobación de que lo PUBLICADO sea lo del repo: es lo que se crea.
- `taller-verify` cambia de tenaza y da clic en el visor sin esperar: contra producción el clic llega en < 50 ms y el
  visor todavía trae la tenaza anterior (carrera a velocidad de máquina, igual en desarrollo: medida, a 30 ms ya no pasa).
  `yunque-verify`: su repuesto «reabrir el laboratorio» no regresa la cámara (ni en desarrollo): se cambia por recargar.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/taller-verify.cjs
- scripts/yunque-verify.cjs
- scripts/yunque-barrido.cjs

## CREA
- scripts/produccion-modelos-verify.cjs

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


## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `scripts/produccion-modelos-verify.cjs` (sin navegador): por cada archivo rastreado en `public/modelos/`, lo que sirve
  producción POR LA DIRECCIÓN QUE USA EL ESTUDIO (con el sello de `/temis-deploy.json` en los `.bin`) es byte a byte lo
  de HEAD. Hoy, antes del arreglo desplegado, debe decir cuántas salen viejas SIN sello (16) y que CON sello salen 0.
- En iangpu (GPU real, forja-dev8): las mallas se piden con `?v=<sello>` (se ve en la red) y las nueve suites siguen
  pasando; `yunque-barrido` 30/30; tsc sin errores nuevos. Gate VERDE.
- DESPUÉS del despliegue de ian (no lo hago yo): contra producción `yunque-barrido` 30/30, `taller` 16/16, `yunque`
  24/24, `medir` 57/57. Si alguna no pasa, se dice cuál y por qué.

## CIERRE (se llena al terminar)
- HECHO: `loadRefMesh` pide las mallas de `/modelos/` con el sello del despliegue (`?v=<commit>-<fecha>` de
  `/temis-deploy.json`, leído una vez y sin caché). Va al pedir, no en el documento. Sin sello (el archivo no está o
  falla la red) pide la dirección pelona, como antes.
- Comprobado en forja-dev8 (GPU real), las dos ramas: con `temis-deploy.json` las 34 mallas salen con sello
  (`/modelos/laboratorio/cuerpo/base-fi.bin?v=36e8e93-2026-09-042217`) y el laboratorio carga sus 226 cuerpos; sin el
  archivo (404) salen sin sello y también carga.
- `scripts/produccion-modelos-verify.cjs` contra producción (09283c7, ANTES de desplegar este arreglo):
  `PRODUCCION_MODELOS: PASA (68/68)` pidiendo con sello, y «sin el sello, 16 mallas salen VIEJAS del caché (la más vieja
  lleva 6.5 días)»: las mismas 16 que difieren en el barrido. O sea: el origen está bien y el sello las alcanza.
- Regresión en forja-dev8 con el arreglo: taller 16/16 · yunque 24/24 · uso 23/23 · navegacion 15/15 · mover 13/13 ·
  boceto 17/17 · piezas 10/10 · medir 57/57 · fuera-del-taller 13/13 · `yunque-barrido` 30/30 · tsc 22 viejos, 0 nuevos.
- También entra aquí un arreglo que quedó SIN commitear de la revisión anterior (se hizo y se probó después del commit
  09283c7, y el despliegue de ian salió sin él): `aLaVista` regresa el riel a donde estaba al cerrar el formulario de
  «poner una pieza» (antes el riel se quedaba recorrido y las tenazas escondidas). Pasó la misma regresión de arriba.
- Suites: `taller-verify` espera 150 ms tras cambiar de tenaza; `yunque-verify` recarga la página en vez de reabrir el
  documento cuando la primera cara no sirve; `yunque-barrido` acepta `FILTRO=` por variable de entorno.
- Auditoría de una vez (no queda script): de los otros 197 archivos de `public/` bajo la regla «inmutable 30 días»
  (md5) y 304 de muestra de `viz-data` (tamaño), NINGUNO sale distinto en producción. El problema eran solo las mallas.
- Lo que arrojó producción con 09283c7 (antes de este arreglo), para que conste: fuera-del-taller 13/13 · piezas 10/10 ·
  mover 13/13 · uso 23/23 · boceto 17/17 · navegacion 15/15 · taller 14/16 (la carrera de la tenaza) · medir 55/57
  (caras curvas «no-la-vi») · yunque se detiene en B · barrido 29/30 (columna 2: «el saliente no agregó material»).
- FALTA (depende de que ian despliegue): correr contra producción `produccion-modelos-verify`, `yunque-barrido`,
  `taller`, `yunque` y `medir`. Las dos fallas de `medir` las ATRIBUYO a las mallas viejas pero NO está comprobado.
- NO se tocó: la regla de nginx (`deploy/nginx-forja.conf`, `.bin` «inmutable»): con el sello ya es correcta para las
  mallas; cualquier otro archivo sin hash que se regenere bajo esa regla caería en lo mismo. Las 16 copias viejas siguen
  en Cloudflare hasta el 6 de diciembre para quien pida la dirección pelona (nadie, tras el despliegue).
- HUECO que queda (no muerde en este despliegue, que no cambia mallas): si un despliegue publica `temis-deploy.json`
  ANTES que un `.bin` que cambió, quien abra el laboratorio en esos segundos deja la malla vieja guardada 30 días bajo la
  dirección nueva. Antes de la siguiente regeneración del laboratorio: publicar `temis-deploy.json` al final (junto con
  los `.html`) en el paso de publicación. No se tocaron los scripts de despliegue.
- `produccion-modelos-verify` YA pasa hoy (el origen está bien): que pase después del despliegue no prueba el bundle. Lo
  que sí lo prueba: en producción, las 34 mallas pedidas con `?v=<sello nuevo>` (registro de red) y el barrido 30/30.
- La revisión anterior sí corrió su regresión final con el arreglo del riel (9 suites, barrido 30/30, tres clases
  `CLASE_OK`, build rc 0). Con el sello NO se volvieron a correr las tres clases ni el build de producción. La rama
  `recargar` de `yunque-verify` no se ha ejecutado nunca (en desarrollo la primera cara sirve).
- Carrera conocida y NO arreglada en el producto: un clic en el visor a menos de ~50 ms de cambiar de tenaza o de
  prender Medir usa lo anterior (igual en desarrollo). A mano no se alcanza.
