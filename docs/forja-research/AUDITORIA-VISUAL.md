# AUDITORIA-VISUAL.md — La Forja (CAD / Molde / Producción)

**91 fallas crudas de 6 auditores → 33 defectos reales dedup.** Muchas fallas son la MISMA cosa vista en 6 capturas distintas (el árbol vacío, el overlay que crece, las pastillas de debug). Aquí cada defecto aparece UNA vez con sus imágenes-ejemplo, su categoría y su fix concreto. Ordenado: TOP-10 accionable arriba, luego por categoría y severidad.

---

## TOP-10 ACCIONABLE (impacto alto / costo bajo primero)

| # | Fix | Costo | Por qué duele | Imágenes |
|---|-----|-------|---------------|----------|
| 1 | **Borrar las pastillas de debug** `viewport-canvas`, `sketch-editor`, `input-comp-depth` del render de producción (pasar a `data-*` o quitar). | Trivial | Un `test-id` en pantalla mata la credibilidad de todo el CAD de un vistazo. | fase2-initial, prod-init, step_50_clickmm, step_53_fill |
| 2 | **Overlay MOLD TOOLS: mostrar SOLO el paso actual**, contenedor `max-height` fijo + `overflow-y:auto`, pasos previos a `opacity:.4`, anclado arriba-izq para no pisar el sólido. | Bajo | Hoy ACUMULA hasta 15 líneas y tapa el modelo (pasos 5-6). | cl1_f115/175/245/305, step_06_tclick |
| 3 | **Poblar el árbol de componentes/features** en el panel izquierdo, o **colapsarlo a rail delgado** si va vacío. La barra de estado promete "árbol a la izquierda" y no hay nada → contradicción + ~15-20% de ancho muerto. | Medio | Aparece en CADA captura de estudio. | cl1_f115/305/70, step_01_tclick, paso_p04 |
| 4 | **Padding derecho fijo + overflow "Más ▾"** en los ribbons; cluster sticky de ancho fijo para Cancelar/Terminar. Hoy se cortan "Gui…", "Cance…", "Termi…". | Bajo | Acciones primarias inalcanzables = bloqueo. | cl1_f305, step_50_clickmm |
| 5 | **Micro-fixes de texto**: pluralización condicional (`n===1?'placa':'placas'`, `'cara'/'caras'`), sincronizar "CARAS DEL SÓLIDO 0" con la geometría real, y traducir el error a los nombres de botón ("Extruir o Revolución", no "Extrude o Revolve"). | Trivial | Bugs de string que gritan "prototipo". | step_01_tclick, step_43_fill, fase2-initial |
| 6 | **Tokens de contraste AA**: subir subtítulos/barra de estado a ~`#B8C2D0`, íconos de acción de tarjeta a `#C9CCD6` con hover-fill, trazo de croquis a cian claro. | Bajo | Info clave ilegible sobre negro en media docena de vistas. | 02-inyeccion, step_06/10/50, step_21_click, step_43_fill |
| 7 | **Diferenciar componentes duplicados**: `Corte 1/2/3` + sublínea con dato real (operación / bbox / profundidad), nunca tres `0x0x0 · @(0,0,0)` idénticos. | Bajo | El ensamble se vuelve un muro indistinguible que escala con cada corte. | step_53/62/63 |
| 8 | **UN solo canal inferior de mensajes**: narración (voz/subtítulo) separada del estado técnico; el banner de cota como línea única bajo el ribbon, NO flotando sobre el sólido. Eliminar el mensaje duplicado tarjeta↔toast. | Medio | 3 capas apiladas tapan la base del modelo en casi todo el flujo. | cl1_f115/305/70, paso_p02, step_02/04_tclick |
| 9 | **Icono propio por herramienta MOLDE** (partición, split, bushing, escala…) + tooltips en las barras de solo-icono. Hoy 6 botones usan el MISMO círculo ○. | Medio | Sin el texto las herramientas son indistinguibles. | cl1_f115, step_03_tclick, prod-init, paso_p02, step_50 |
| 10 | **Modal CAM al tema oscuro** (grafito + toolpath ámbar/cian) y **fit-to-view del toolpath a ~80%** del canvas; hoy es blanco brillante con el dibujo diminuto perdido en vacío. | Medio | Rompe el paradigma visual y deslumbra sobre el viewport negro. | step_23_click |

---

## CONTRASTE / LEGIBILIDAD

1. **[media] Texto secundario ilegible sobre negro** — subtítulos, barra de estado y placeholders en gris demasiado oscuro (02-inyeccion, step_06_tclick, step_50_clickmm, paso_p02). *Fix:* elevar a token AA (~`#9AA3B2`–`#B8C2D0`), peso 500 en subtítulos; resaltar campo activo.
2. **[media] Íconos de acción de tarjeta casi invisibles** — subir/bajar/ojo/✕ negros sobre tarjeta oscura, sólo visibles al hover (step_10_hook, step_21_click, step_43_fill). *Fix:* `#C9CCD6` con hover-fill y hit-area, o chip de fondo; garantizar AA sobre la tarjeta seleccionada.
3. **[media] Trazo de croquis tenue** — punto/círculo/geometría gris casi imperceptible sobre fondo casi negro (step_50_clickmm). *Fix:* subir luminancia del trazo a blanco/cian claro.
4. **[baja] Estado disabled indistinguible** — herramientas MOLDE deshabilitadas tan tenues que parecen inexistentes o iguales a un botón habilitado tenue (cl1_f25, fase2-initial, prod-init). *Fix:* disabled explícito `opacity:.35` + `cursor:not-allowed` + tooltip "requiere un sólido"; habilitado claramente contrastado.
5. **[baja] Etiquetas de grupo del ribbon micro-caps** — CREAR/MODIFICAR/DOCUMENTAR/INSPECCIONAR/BOCETO en gris ilegible; la agrupación no se lee (cl1_f115, paso_p04). *Fix:* +1-2px y más contraste, o separadores verticales marcados entre grupos.
6. **[baja] ViewCube y mini-barra ISO/SUP/FRE ilegibles** — labels diminutos rotados, abreviaturas crípticas, sin fondo (cl1_f115, step_01_tclick). *Fix:* agrandar ViewCube con texto horizontal en cara frontal; agrupar ISO/SUP/FRE en píldora con fondo y tooltips.

## AFORDANCIA / SELECCIÓN

7. **[alta] Barras de solo-icono monocromas sin tooltip** — ~30 iconos de croquis / ~8 de molde pegados, mismo peso, sin etiqueta ni separadores (prod-init, paso_p02, step_50_clickmm). *Fix:* divisores hairline entre grupos, tooltips al hover, hover-state claro, más padding, etiqueta en las 4-5 más usadas (Línea/Rect/Círculo/Cota).
8. **[media] Botones MOLDE con glifo idéntico ○** — 6 herramientas indistinguibles por icono (cl1_f115, step_03_tclick). *Fix:* glifo distinto por rol (ver TOP-10 #9).
9. **[media] Toggle "Espejar (mirror)" con opción `—` naranja sin etiqueta** — no comunica "Ninguno/OFF" y usa acento distinto (naranja) al resto de toggles (cian) (paso_p05, step_21_click, step_53_fill). *Fix:* rotular "Ninguno" con el mismo estilo de texto que YZ/ZX/XY y unificar el color de estado-activo.
10. **[media] Segmentado Bloque|Cilindro sin relleno de activo** — a veces se rellena naranja, a veces no, aunque el header diga cuál está activo (step_21_click vs step_23_main). *Fix:* aplicar SIEMPRE el mismo relleno al segmento activo.
11. **[baja] Handles/carets huérfanos flotando** — círculo a medio recortar en panel izq, triángulo suelto arriba-der (manija de colapsar sin ancla) (paso_p04, step_43_fill). *Fix:* integrar la manija al borde del panel con chevron + tooltip "Ocultar panel", o eliminar.

## AMONTONAMIENTO

12. **[alta] Overlay MOLD TOOLS acumula y tapa el sólido** — ver TOP-10 #2 (cl1_f115/175/245/305, step_06_tclick).
13. **[alta] Ribbon de features apretadísimo sin agrupar** — ~17 botones fila única + segunda barra, todo pesa igual (step_10_hook). *Fix:* adoptar el ribbon ya agrupado de step_43/44 (CREAR/MODIFICAR/DOCUMENTAR con separadores), reducir a ~6 grupos, colapsar el resto en "Más ▾".
14. **[alta] Headers HISTORIA/CARAS solapados + chips del historial amontonados en el borde inferior** — colisión de z-index/layout (paso_p08). *Fix:* headers en filas propias con altura fija; mover los chips a su propio riel con gap; nada pintado encima de otro elemento.
15. **[media] Apilamiento inferior de 3 capas** — narración + chip "atajos del taller" + banner/toast, sobre la base del modelo (ver TOP-10 #8) (cl1_f115/305/70, paso_p02, step_04_tclick).
16. **[media] Racimo centro-superior** — chip "CARA #N", controles ISO/SUP/FRE y banner "Clic en una CARA…" compiten en la misma franja sobre el modelo (step_53/62/63_fill). *Fix:* chip de cara a la izquierda, view-cube a la esquina, banner de instrucción sin solape (y ocultarlo cuando ya hay cara seleccionada — ver #29).
17. **[media] Cards flotantes recortadas por el toolbar** — "SIMULACIÓN · VON MISES", "ANÁLISIS · PROPIEDADES", píldora "NINGUNA ARISTA" huérfanas contra el borde superior (step_10_hook, prod-init). *Fix:* anclar SIMULACIÓN/ANÁLISIS como filas colapsables dentro del panel (como step_43), no cards flotantes que se clippean.
18. **[media] Dos toolbars de ancho completo apiladas** — ribbon + barra de croquis idénticas, sin marcar que la segunda es sub-modo (paso_p02). *Fix:* diferenciar la barra contextual (fondo/acento) y compactarla.

## TRUNCADO

19. **[alta] Botones/acciones cortados por el borde derecho** — "Gui…", "Cance…", "Termi…" (ver TOP-10 #4) (cl1_f305, step_50_clickmm).
20. **[alta] Nombres de placa truncados justo en lo que los identifica** — "Placa de suj…" ×2, "Placa A (ca…", "Placa reten…" (prod-init). *Fix:* nombre a ancho completo/2 líneas; truncar el material (`1.1730 C45`), no el nombre; tooltip con nombre completo.
21. **[media] Panel derecho más alto que el viewport, sin scroll** — controles Y/Z de "Posición del centro" quedan bajo el fold, inalcanzables (step_23_main). *Fix:* cuerpo scrollable con scrollbar visible o barra de acciones fija al fondo; compactar X/Y/Z en fila de 3 columnas.
22. **[media] Captions cortados por el borde inferior** — última línea del subtítulo cortada a media letra (p05-crop, p06-crop). *Fix:* safe-margin inferior, subir baseline, limitar altura.
23. **[media] Leyenda del modal CAM truncada** — "…· fresa ø40 · a" se corta (step_23_click). *Fix:* padding horizontal + wrap o menor tamaño de fuente.
24. **[media] Tope del árbol izquierdo cortado** — medio anillo recortado sobre "Sketch 1", sin padding de scroll (step_53_fill). *Fix:* padding-top en el contenedor scrollable + fade en el borde.
25. **[baja] Barra de estado recortada por el viewport** — "CARAS DEL SÓLIDO 6" y la línea de atajos cortadas, tapadas por el tooltip central (step_10_hook). *Fix:* altura fija reservada para la barra; el tooltip flota por encima con margen.

## JERARQUÍA

26. **[alta] Tarjetas de placa enormes que aplanan la jerarquía** — ~110px c/u, slider azul saturado idéntico en las 23, sólo se ven 7, nada resalta la seleccionada (prod-init). *Fix:* filas densas ~32-40px (dot + nombre + eye toggle); slider sólo al hover/seleccionada; resaltar fila activa.
27. **[alta] Panel derecho apila dos editores sin separación + dos botones destructivos rojos contiguos** — "COMPONENTE·BLOQUE" y "EXTRUIR" se leen como un bloque; "Eliminar componente" y "Eliminar feature" pegados (paso_p07). *Fix:* cada feature en su tarjeta con borde/encabezado colapsable + divisor; alejar/agrupar las acciones destructivas con confirmación.
28. **[alta] Componentes duplicados indistinguibles `0x0x0 @(0,0,0)`** — ver TOP-10 #7 (step_53/62/63).
29. **[media] Error bloqueante con baja prominencia** — "no tiene sólido: agrega Extrude o Revolve" perdido en el pie de estado, sin icono ni color (cl1_f25, fase2-initial). *Fix:* toast/callout inline junto al viewport (fondo rojo tenue + icono) con botón de acción "Extruir".
30. **[media] Banner de alerta crítica demasiado débil** — "el plástico ABRE el molde" en rojo delgado sobre relleno casi negro, desprendido arriba (07-fuga-flash). *Fix:* relleno rojo sólido, texto con peso, icono grande, ligado por color a la fila "Deflexión placas 25.4 µm" (causa↔efecto).
31. **[media] Info valiosa flota sobre el viewport en lugar de en panel** — readouts MOLD TOOLS/SIMULACIÓN de okupa sobre la escena mientras hay paneles vacíos (cl1_f115, step_10_hook). *Fix:* acoplar dentro del panel (izq o "ANÁLISIS·PROPIEDADES") con scroll propio.
32. **[media] Toast amarillo saturado con demasiado peso visual** — banda ancha que compite con el modelo (step_04_tclick). *Fix:* chip discreto, bajar saturación/tamaño.
33. **[media] Toolpath diminuto en modal blanco gigante** — ~70% del card vacío (step_23_click). *Fix:* fit-to-view a ~80% del alto (ver TOP-10 #10).
34. **[baja] Panel derecho de parámetros plano y largo** — todos los grupos con el mismo peso; sin destacar el parámetro primario (Radio/Altura) (step_23_main, step_62_fill). *Fix:* dar peso/separador a los headers de sección; agrupar secundarios en sección colapsable "Transformación"; migrar sliders a campos numéricos con unidad (como step_43).

## CONSISTENCIA

35. **[media] Vocabulario booleano triplicado** — ribbon dice "Base/Unir/Cortar", panel dice "Junto/Unir/Restar/Cavidad"; Cortar≡Restar≡Cavidad (step_44_tclick). *Fix:* un único set en toda la app (p.ej. Nuevo/Unir/Cortar/Cavidad) usado idéntico en ribbon y panel.
36. **[media] Mensaje duplicado tarjeta↔toast** — misma frase "Scale: about Origin ×1.015" arriba y abajo (step_02_tclick). *Fix:* toast efímero = confirmación, tarjeta = detalle persistente; nunca repetir.
37. **[media] Modal CAM rompe el tema oscuro** — ver TOP-10 #10 (step_23_click).
38. **[media] Casing de labels inconsistente** — MAYÚSCULAS micro ("PROFUNDIDAD") mezcladas con Title case ("Espejar (mirror)") en el mismo panel (paso_p05). *Fix:* un solo estilo (Sentence case 12-13px) en todo el inspector.
39. **[media] Tooltip lejos del control que lo dispara** — "Encuadrar la pieza completa" flota abajo-centro con estilo de pastilla de debug (step_63_tclick). *Fix:* anclar el tooltip junto a su control y diferenciarlo del estilo de metadato de dev.
40. **[baja] Banner de instrucción contradictorio** — "Clic en una CARA…" sigue visible con una cara YA resaltada (step_43/53/62_fill). *Fix:* ocultarlo al haber selección o cambiarlo a "Cara #N seleccionada".
41. **[baja] Error en inglés vs botones en español** — "Extrude o Revolve" vs botones "Extruir/Revolución" (fase2-initial). *Fix:* usar los nombres exactos de los botones (ver TOP-10 #5).
42. **[baja] Bugs de string** — "1 placas", "1 caras", "CARAS DEL SÓLIDO 0" con sólido visible (step_01_tclick, step_43_fill). *Fix:* pluralización condicional y sincronizar el contador con la geometría real (ver TOP-10 #5).

## ESPACIADO / LAYOUT

43. **[alta] Paneles laterales vacíos = ancho muerto** — árbol izq y "ANÁLISIS·PROPIEDADES" der vacíos/colapsados a los dos flancos (ver TOP-10 #3) (cl1_f115/305/70, step_01/02_tclick, paso_p04). *Fix:* poblar o colapsar a rail.
44. **[media] Card vacía clippeada arriba-derecha** — contorno sin título ni contenido, cortado por el ribbon, recurrente en 6 capturas (cl1_f70, step_01_tclick, prod-init). *Fix:* empujar bajo el ribbon con padding-top y darle contenido, o eliminar si es residual.
45. **[media] Sin zoom-to-fit al entrar al estudio** — croquis diminuto perdido en el centro del void (cl1_f25). *Fix:* auto fit-to-view al croquis/plano activo.
46. **[media] Composición desbalanceada con void muerto** — objeto pegado centro-derecha, telemetría aislada, tercio izquierdo negro sin ancla (02-inyeccion). *Fix:* zoom-to-fill del molde o recostar a la izquierda y anclar la telemetría con guía al punto que mide.
47. **[media] Campos label↔valor con hueco muerto central** — "PROFUNDIDAD ……… 12 mm", unidad diminuta pegada al número (paso_p05, step_23_main). *Fix:* input inmediatamente tras la etiqueta (o label arriba / input full-width), unidad como sufijo dentro del campo.
48. **[baja] Ritmo de espaciado inconsistente en el panel derecho** — bloque superior denso vs X/Y/Z/GIRO con huecos grandes (step_62_fill). *Fix:* interlineado unificado; X/Y/Z en fila de 3 columnas.

## PALETA / COLOR

49. **[baja] Ámbar en contador = falsa alarma** — "piezas producidas 0" en ámbar (color de advertencia) cuando sólo es un contador (02-inyeccion). *Fix:* reservar ámbar para advertencia real (deflexión/venteo al límite); el contador en gris/blanco o azul de acento.
50. **[baja] Dots de color de placa sin rol + "· visible" redundante** — grises idénticos sin leyenda; el estado ya lo dan ojo/slider (prod-init). *Fix:* mapear color a un rol real con leyenda o quitarlo; no duplicar "· visible".

---

### Nota de arquitectura
Tres defectos son de **raíz de layout**, no cosméticos, y arreglarlos disuelve ~15 de las fallas crudas: **(a)** el patrón "info flota sobre el viewport" (overlays MOLD TOOLS/SIMULACIÓN/banners) → mover TODO a paneles acoplados con `max-height`+scroll; **(b)** los **paneles laterales vacíos** contra una barra de estado que promete árbol → poblar o colapsar; **(c)** la **ausencia de overflow responsivo** en los ribbons → padding + "Más ▾" + cluster sticky de acciones. Atacar esos tres primero rinde más que 50 tweaks de CSS sueltos.