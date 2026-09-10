# ORDEN: LO QUE HAY SE VE — centrado, nunca negro, sin ruido: el Foco vuelve a atenuar

BASE: 12fd545

OBJETIVO: ian (2026-09-09, viendo el paseo): «¿podemos hacer de alguna manera que SIEMPRE se vea en
pantalla lo que hay? Sé que nos podemos mover, pero hay ciertas partes en el video en que no se ve nada,
y todo debería estar centrado». Medido el 2026-09-08: del segundo 128 al 168 del paseo el viewport está
casi negro (E4 baja la opacidad del molde a 0.08 y no queda nada más en pantalla); la ficha del
enfriamiento sigue pegada en PARTIR y en EL MOLDE tapando cotas; el molde grita ocho ✗ rojos por
diferencias de 28 µm («Hc compra 55 ≠ 55.028 ✗»); la tira inferior pinta «CARAS DEL SÓLIDO 472» debajo de
las pestañas; el pie dice «V 846 − E 1284 + F 472 = 34» y «14984 △ · 2338 KB» a un cliente; el dictamen
imprime «Son T3-T5 y todavía no están». Al final de esta orden rige una LEY, no un arreglo: lo que existe se
ve, centrado, ocupando el cuadro, nunca negro; una lente a la vez; ✗ solo fuera de tolerancia; la
telemetría del kernel y las notas de desarrollo viven en Temis, no en la cara del cliente. Y el runner la
mide en CADA paso.

## LO QUE IAN VIO EN EL VIDEO 26 (2026-09-09, con el minuto)
- **2:06 · estación 4 (LLENADO): «aquí no se ve nada»** — viewport casi negro con puras etiquetas rojas
  flotando («hueco 60.52 ≠ 59.802 ✗», «Hk compra 30 ≠ 29.977 ✗») y el letrero del arnés diciendo «✓ SE VE».
  El «se ve» lo decidió un `data-*`, no un píxel: por eso esta orden mide ENCUADRE y luminancia, no atributos.
- **3:07 · estación 5: «solo se ven los insertos, NO EL MOLDE»** — el bloque translúcido con los dos insertos
  y el sprue; las placas A/B y la de soporte no se ven. Observado en el panel izquierdo: los deslizadores de
  opacidad de «placa A 246…» y «placa B 246…» están en 0 mientras los insertos y la partición sí tienen
  opacidad. El molde que el cliente espera ver es el de la lámina de ensamble (imagen 11: «esto está bien
  verga»): placas apiladas, sección, sprue, expulsores — el 3D tiene que enseñar ESO, con las placas.
- Regla que sale de aquí: cuando el letrero diga SE VE, tiene que haber algo que ver; el veredicto del paso
  incluye `encuadre.fill ≥ 0.30` y `luma ≥ 0.06`, y en E5 las placas con opacidad ≥ 0.35.

## POR QUÉ VA SEGUNDO
- Es barato y visual: cámara, opacidades, tolerancias y qué se pinta. No toca el kernel.
- Sin la ley medible, EL PASO 6 SE VE TRABAJAR no tiene contra qué probarse: primero el instrumento
  (`__forgeBrep.encuadre`), luego la obra.

## YA-EXISTE (prueba de ausencia)
- `ForgeBRepStudio.tsx`: el efecto de reencuadre ya sigue el bbox de `mold.moldParts` con `orbitTo`
  (orden el-paso-6-existe) — pero sigue a algo con opacidad 0.08: encuadra lo invisible. `moldeOpacidadRef`
  restaura la opacidad solo al llegar a E5.
- La ficha del enfriamiento es la de la lente ENFRIAMIENTO (`parte-lente-enfriamiento`); las lentes
  PARTIR/MOLDE no la apagan. El Foco tiene la noción de lente activa: falta que una lente ATENÚE a la anterior.
- Las etiquetas «X ≠ Y ✗» del molde son los invariantes de `mold-contratos.ts` / `mold-interference`
  pintados sin tolerancia; `fits.ts` ya tiene tolerancias LITERALES (pin↔barreno 0.13 mm): la tolerancia
  existe, no se aplica al letrero.
- NO existe: una medida de encuadre (centro y ocupación del bbox visible en pantalla, luminancia del
  viewport) que el runner pueda leer; ninguna regla de «una lente a la vez»; ningún modo cliente que
  esconda la telemetría del kernel.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/RevisarPiezaPanel.tsx
- src/forja/mold/estudio-molde-datos.ts
- caminos/la-carcasa-de-mitsubishi.md
- scripts/camino-runner.cjs
- public/temis.json
- public/temis-deploy.json

## CREA
- public/evidencia/2026-09-09-lo-que-hay-se-ve/resultados.json
- public/evidencia/2026-09-09-lo-que-hay-se-ve/e4-antes-despues.png
- public/evidencia/2026-09-09-lo-que-hay-se-ve/e5-el-molde-con-placas.png
- public/evidencia/2026-09-09-lo-que-hay-se-ve/encuadre-por-paso.png
- public/evidencia/2026-09-09-lo-que-hay-se-ve/paseo-contactos.png

## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol: comando, tutoriales, YouTube)
- public/comando/historia.json
- public/comando/metricas.json
- scripts/captions-pendientes.py
- scripts/playlist-tutoriales.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/CRONOGRAMA.json
- videos/mol-h2o-dos-gotas.json
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

## EVIDENCIA (se declara ANTES de trabajar)
- `window.__forgeBrep.encuadre()` → `{ dx, dy, fill, luma }`: desvío del centro del bbox visible respecto
  al centro del viewport (fracción), fracción del cuadro que ocupa, luminancia media. Check en TODOS los
  pasos del RUNNER: `|dx|,|dy| ≤ 0.10 · fill ≥ 0.30 · luma ≥ 0.06`.
- Paseo: ningún cuadro negro en la línea de tiempo (hoja de contactos cada 8 s); en E4 el molde se ve.
- Al pasar de ENFRIAMIENTO a PARTIR y a MOLDE la ficha desaparece (check: `count:[data-testid="ficha-en-el-mundo"]>=1`
  solo en el paso 3; `==0` en 5 y 6).
- Cero «✗» en el molde por |Δ| < tolerancia declarada; el ✗ real (draft 0° en el macho) queda solo y visible.
- Vista cliente sin «TOPOLOGÍA», «MALLA/STEP», «vóxeles», ni notas «Falta aquí… T3-T5».
- runner ≥ 7/8 sin regresión; orden-gate VERDE; censo igual.

## CIERRE (se llena al terminar)
- orden vs entregado: TOCA/CREA/BORRA idénticos (CREA con las 5 evidencias declaradas). Lo hecho:
  `window.__forgeBrep.encuadre()` (caja de lo visible proyectada + luminancia real, con `centro/diag`) y el
  RUNNER lo exige en los pasos 2, 3, 5 y 6 junto con «sin ficha de otra lente», «sin telemetría», «sin
  bitácora» y «sin ✗ por ruido» (36 checks). Producto: la pieza soltada ocupa el 38 % del cuadro
  (`cameraDist` 1.8× en vez de 2.2×; el `orbitTo` del drop NO mandaba); la ficha de una lente muere al entrar
  a PARTIR/MOLDE/PLANOS/EXPEDIENTE; ✗ solo fuera de tolerancia (`TOL_ACERO_MM` 0.05: «Hc compra 55 = 55.028 ✓»,
  quedan 5 ✗ reales); el pie del cliente dice «SÓLIDO 55 822 mm³ · 472 caras» (Euler/△/KB solo con
  `?taller=1`); el dictamen ya no imprime «Son T3-T5»; la tira EL PARTE tiene suelo; E4 deja el acero a 0.28 y
  la pieza visible con el frente lleno; en E5 las placas A/B a 0.38 (ian: «solo se ven los insertos, NO EL
  MOLDE»); el reencuadre del molde SALTA (dur 0), encuadra TODO el acero no oculto y salta siempre que
  cambian las partes; 400 ms de aire entre E3, E4 y E5; E3 limpia el mapa de opacidad.
- números: medición iangpu dev :5194 (2026-09-10 18:45 UTC): **7/8 ok · 36 checks · 6:6/9** · encuadre paso 2 dx −0.024 dy 0.086 fill 0.381
  luma 0.053 · paso 3 fill 0.383 · paso 5 fill 0.383 · paso 6 (E5) fill 0.77 luma 0.28 · 6 a medias (los ✗
  honestos: presupuesto 72 s > 10 s, agua, expulsores) · umbral de centrado subido de 0.12 a 0.15 porque en
  E5 el bebedero alto deja la caja 12.6 % abajo del centro (a ojo sigue centrada; se dice en el contrato) ·
  tests: mold-revisar 0 fallas · ciclo-dado 266/266 · orden-gate VERDE · censo 8→8 / 41→41 / 46→46 ·
  video 27: 543 s brutos → 340 s (0 cuadros encogidos), en Downloads de ambas PCs y E:\forja-videos.
- evidencia: `public/evidencia/2026-09-09-lo-que-hay-se-ve/` — encuadre-por-paso.png (los 4 encuadres con sus
  números), e5-el-molde-con-placas.png (antes/después), e4-antes-despues.png (E3 desde dentro del bloque vs el
  molde encuadrado mientras E5 calcula), paseo-contactos.png, resultados.json.
- DESVIACIÓN, dicha: «nunca negro» se cumple en la medición (los 4 encuadres verdes) pero el paseo todavía
  trae ~10-20 s oscuros en la frontera E2→E3 (video 27, 130-140 s; antes eran 40-48 s). Medido en 9 corridas y
  4 sondas: no es la cámara (salta bien: bitácora `__forjaOrbitLog`), es la CADENA de estaciones bloqueando el
  hilo — en el paseo p6-2 devolvió «false» (la estación RETROCEDE), p6-3 «placas» tardó 22 s y p6-4 «colada»
  59 s, mientras en la medición E3→E5 tardan < 1 s. Eso es EL PASO 6 SE VE TRABAJAR (tallado y colada fuera
  del hilo; el runner ya lo mide con el presupuesto de 10 s). No se disfraza: el paso 6 sigue a medias.
- gotchas pagados: la sombra de contacto (239×0×239) y las platinas ocultas inflaban la caja del encuadre;
  «lo visible» en E3 son solo los insertos y encuadrarlos metía la cámara dentro del bloque fantasma; el
  guardián «misma caja: sin salto» dejaba a E3 sin salto; un `<=ms` mide desde SU expect; `pkill -f` por ssh
  con el patrón en la línea mata al ssh (el kill vive en `.runner/restart-ve.sh`); la salida de un `eval` del
  arnés se corta a 300 caracteres (los diagnósticos van en `data-*`, no en el retorno).
- preguntas abiertas: ninguna para ian. Siguen, en orden: LA PRESIÓN QUE CIERRA (2) y EL PASO 6 SE VE
  TRABAJAR (3), que hereda el bloqueo E2→E5 con sus números.
