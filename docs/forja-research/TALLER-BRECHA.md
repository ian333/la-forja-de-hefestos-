# EL TALLER — la brecha contra Fusion 360 y FreeCAD

> **Nota del coordinador (cierre de la noche del 2026-11-11).** Este documento se escribió contra `a313251`. Desde
> entonces quedó hecho y probado en `main` (10 commits locales, sin desplegar):
> - lo que aquí dice «EN CURSO»: exportar STL/STEP del cuerpo forjado, corte pasante, deshacer y rehacer golpes, golpear
>   cuerpos nuevos (`4ab5b62`), mover piezas (`065e2b5`) y Medir (`2a44f77`); el barrido dio 30 de 30 piezas impresas;
> - de «Las 10 siguientes»: la **#1** (Sección, vistas y Encuadrar en el laboratorio; `9de7a86`), la **#3** en su primera
>   versión (el contorno de la cara entra al boceto como referencia y se acota contra sus vértices; `d2482db`) y la mitad
>   de la **#2** (poner una caja o un cilindro con sus medidas; `c40232e` — falta importar un STEP como pieza del Taller);
> - además: el boceto acota con un clic (`0229b0a`), el radial ofrece lo del Taller (`8e76c45`) y las teclas del kernel
>   ya no ensucian el laboratorio.
> Siguen pendientes de la lista: golpes de catálogo (barreno, cajera de tuerca), patrón y espejo de golpes, reabrir el
> boceto de un golpe, planos de construcción, partir un cuerpo, interferencia y revisión de impresión. Y el aviso de
> licencias de terceros (sección 4): el sitio sirve el kernel LGPL sin aviso visible; falta que ian lo decida.

Fecha: 2026-11-11 · Código revisado: `main` en el commit `a313251` (lo que hoy está en producción) · Solo lectura: no se corrió nada ni se abrió el navegador.

## 1. La conclusión, en diez renglones

1. La Forja tiene dos mundos. El **sólido del kernel** (el motor de sólidos exactos, OpenCascade) ya hace casi todo lo que hace Fusion al modelar una pieza. Las **piezas del laboratorio** (El Taller) son otra cosa: 226 cuerpos que solo se dibujan, y de ellos solo 30 —los impresos— traen además su sólido exacto.
2. El «espinazo» de Fusion son siete pasos (elegir plano → entrar al boceto → dibujar → acotar → salir → extruir → repetir sobre una cara). **Los siete existen sobre el sólido del kernel y los siete ya corren sobre una pieza del laboratorio**, con tres candados: solo en caras planas, unir y cortar solo en las 30 impresas, y el boceto no ve los bordes de la pieza.
3. En total conté 65 funciones (la tabla de abajo, con las del espinazo adentro). Sobre el sólido del kernel **existen 44 y 11 están a medias**. Sobre una pieza del Taller **sirven hoy 18, 5 a medias, 4 las está construyendo alguien esta noche, y faltan 38**.
4. **El hueco principal no es de motor, es de cableado.** El Taller solo conoce UN tipo de golpe: un perfil extruido. Agujero, patrón, redondeo, vaciado, partir, planos y revisión de impresión ya existen en el kernel, pero no llegan al Taller por tres razones concretas:
5. (a) la cinta de arriba le habla al sólido del kernel, no a lo que tienes agarrado (en el laboratorio «Extruir» crea un sólido aparte);
6. (b) el boceto se abre sobre la cara pero no recibe su contorno: no puedes acotar «a 12 mm del borde», que es justo lo que pide una ventana para cables o una cajera de tuerca;
7. (c) la pieza forjada se convierte en dibujo y su sólido se tira; cada golpe nuevo la rehace desde cero, y solo sabe rehacer extrusiones.
8. Lo más barato de todo: **Sección, las vistas ISO/SUP/FRE y Encuadrar ya funcionan con piezas del laboratorio, pero sus botones están apagados** porque exigen un sólido del kernel.
9. De las piezas que tú quieres mover de verdad (fuente real de 245×125×65, NEMA 23, alimentador Truper, carrete de 1 kg) ninguna puede entrar hoy al Taller: no hay botón para insertar una pieza de fábrica nueva (las piezas solo llegan del generador del laboratorio).
10. El corpus de investigación (junio–julio) quedó viejo en varios puntos; donde contradice al código, aquí manda el código y se dice (sección 2.13).

## 2. La tabla de la brecha

**Cómo leerla.** «Kernel» = ¿existe sobre el sólido exacto? «Taller» = ¿sirve hoy sobre una pieza del laboratorio? Estados: **SÍ**, **PARCIAL**, **NO**, **EN CURSO** (alguien lo construye esta noche; no está en `a313251`). Tamaño de lo que falta: **chico** (una sesión, reusando lo que hay), **mediano** (una o dos sesiones con su prueba en navegador), **grande** (varias sesiones o un modelo de datos nuevo). Entre paréntesis, cómo lo llama FreeCAD.

**Los tres tipos de pieza del Taller** (contados en `public/modelos/laboratorio/laboratorio.json`): **impresa** = 30 cuerpos con su sólido STEP (archivo de sólido exacto) junto a su malla (cáscara de triángulos): se unen y se cortan; **de fábrica** = 196 cuerpos (87 cajas, 50 cables, 48 cilindros, 2 torneados, 1 placa y 8 mallas sin sólido): se ven, se agarran y solo aceptan un cuerpo nuevo encima; **cuerpo nuevo** = lo que tú agregas con el yunque.

**Abreviaturas de archivo** (la prueba de cada «ya existe» va como `archivo:símbolo`): `FBS` = `src/forja/brep/ForgeBRepStudio.tsx` · `occt` = `src/forja/brep/occt.ts` · `SkEd` = `src/forja/brep/SketchEditor.tsx` · `solver` = `src/forja/brep/sketch-solver.ts`.

### 2.1 Navegar y ver
| Función | Kernel | Taller | Qué falta para el Taller | Tamaño | Depende de |
|---|---|---|---|---|---|
| Girar, mover y acercar con el mouse | SÍ `FBS:CadViewport` | SÍ | — | — | — |
| Touchpad (dos dedos, Shift, pellizco) | SÍ `FBS:NavegacionTouchpad` | SÍ | probar el sentido del giro en tu touchpad real | chico | — |
| Cubo de vistas | SÍ `FBS:CadViewport` (GizmoViewcube) | SÍ | — | — | — |
| Vistas ISO / superior / frontal y Encuadrar | SÍ `FBS:setView`, `FBS:ViewController` | NO | los botones se apagan sin sólido del kernel (`!result && !moldParts.length`), aunque el encuadre ya cuenta las piezas (`FBS:meshBBox` usa `refBoxes`) | chico | — |
| Doble clic = ver la cara de frente | PARCIAL (solo al abrir un boceto, `FBS:ViewController`) | SÍ `FBS:onFrente`, `FBS:verDeFrente` | — | — | — |
| Sección en vivo con flecha (FreeCAD: Clipping plane) | SÍ `FBS:SectionGizmo` | PARCIAL | el corte ya llega a las piezas (`FBS:RefMesh` recibe `clip`), pero los tres botones de Sección están apagados en el laboratorio | chico | — |
| Estilos de vista (alambre, aristas ocultas, perspectiva/ortogonal) | NO | PARCIAL (solo rayos X, `FBS:RefMesh` prop `rayos`) | interruptores de estilo | chico | — |
| Vista explosionada | PARCIAL (solo la caja cicloidal) | NO | separar módulos con un deslizador | mediano | mover piezas |
| Menú radial (dos clics derechos) | SÍ `RadialMenu.tsx:RadialMenu` | PARCIAL | abre, pero ofrece operaciones del kernel; debe ofrecer las del yunque cuando hay algo agarrado | chico | — |

### 2.2 El Taller (navegador / árbol)
| Función | Kernel | Taller | Qué falta para el Taller | Tamaño | Depende de |
|---|---|---|---|---|---|
| Árbol pieza → cuerpo | SÍ (árbol de operaciones `feature-tree` en `FBS`) | SÍ `FBS:tallerArbol` | — | — | — |
| Foco (mostrar/ocultar) y Aislar | SÍ (en el molde) | SÍ `FBS:toggleRef`, `FBS:FocoIcono` | — | — | — |
| Lo agarrado en el visor se marca en el árbol | — | SÍ `FBS:onAgarre`, `FBS:abrirHasta` | — | — | — |
| Renombrar, agrupar, reordenar, borrar, crear pieza vacía | PARCIAL (`FBS:renameOp`, `FBS:moveOp`, solo operaciones) | NO | el árbol sale tal cual del generador; un cuerpo nuevo solo se borra borrando su golpe | mediano | — |

### 2.3 Seleccionar (las tenazas)
| Función | Kernel | Taller | Qué falta para el Taller | Tamaño | Depende de |
|---|---|---|---|---|---|
| Filtro de selección (FreeCAD: selección de sub-elemento) | SÍ cara y arista (`pickMode` en `FBS`) | SÍ cara, cuerpo y pieza (`FBS:Tenaza`, `FBS:carasDeMalla`) | tenaza ARISTA y VÉRTICE | mediano | sólido de la pieza o bordes de sus caras |
| Se ilumina al pasar el mouse | SÍ `FBS:SolidMesh` | SÍ `FBS:tenazaHover` | — | — | — |
| Selección múltiple (Ctrl/Shift) y por ventana | PARCIAL (varias aristas por clics sucesivos dentro de un redondeo o chaflán, `FBS:togglePickEdge`; sin ventana) | NO | hoy se agarra una sola cosa (`tallerSel`); Medir trae «el segundo agarrado» | mediano | Medir (en curso) |

### 2.4 Boceto y restricciones (FreeCAD: Sketcher) — es el MISMO editor en los dos mundos
| Función | Kernel | Taller | Qué falta | Tamaño | Depende de |
|---|---|---|---|---|---|
| Boceto sobre una cara plana | SÍ `FBS:planeFromMeshFace` | SÍ `FBS:planoDeCaraRef`, `FBS:bocetoEnCara` | caras curvas no (igual que Fusion) | — | — |
| Boceto sobre plano base o desfasado | SÍ `FBS:openSketchChooser`, `occt:offsetPlane` | NO | ver 2.9 Construcción | chico | planos de construcción |
| Dibujar: línea, rectángulo, círculo, arco por centro y por 3 puntos, polígono, elipse, punto | SÍ `SkEd:Tool` | SÍ | curva libre (spline), ranura, texto | mediano | — |
| Editar: recortar, desfasar, espejo, copiar, patrón, redondeo y chaflán de esquina, escalar | SÍ `SkEd:Tool` | SÍ | extender | chico | — |
| Restricciones (10 botones: horizontal, vertical, perpendicular, paralela, igual, tangente, coincidente, simétrica, anclar, construcción) | SÍ `SkEd` botones `sk-con-*` sobre `solver:Constraint` | SÍ | botón de concéntrica y de punto-sobre-línea (el resolvedor ya las resuelve: `solver` tipos `concentric`, `pointOnLine`; cero usos en `SkEd`); colineal y punto medio | chico | — |
| Cotas (distancia, horizontal/vertical, radio, diámetro, ángulo) y azul → negro al quedar definido | SÍ `SkEd` (`sk-tool-dim`), `solver:solveSketch` | SÍ | — | — | — |
| Imanes al dibujar (punto, medio, cuadrante, intersección, origen, ejes) | SÍ `SkEd:computeSnap` | SÍ | solo se pegan a lo dibujado, no a la pieza | — | fila siguiente |
| **Proyectar el contorno y las aristas de la pieza al boceto** (FreeCAD: External geometry) | NO | NO | `SkEd` solo recibe `onFinish`, `onCancel` y `projScale`: el borde de la cara nunca entra. Sin esto no hay cota «desde el borde» | mediano | — |
| Reabrir un boceto ya hecho para cambiarle una cota | NO | NO | solo se guarda el polígono final (`FBS:SketchFeature.customProfile`, `FBS:Golpe.profile`); el editor siempre arranca vacío | mediano | — |
| Deshacer dentro del boceto | NO | NO | el editor no tiene historial (Esc solo suelta lo que estás trazando) | chico | — |
| Varios perfiles e islas en un boceto | SÍ `SkEd:extractProfileAndHoles` | SÍ `FBS:onSketchFinish` (cada círculo suelto sale como golpe aparte) | — | — | — |

### 2.5 Crear (FreeCAD: Part Design)
| Función | Kernel | Taller | Qué falta para el Taller | Tamaño | Depende de |
|---|---|---|---|---|---|
| Extruir: cuerpo nuevo / unir / cortar (Pad / Pocket) | SÍ `FBS:addOp`, `FBS:buildComponent` | SÍ con candados (`FBS:Golpe`, `FBS:compDeGolpe`) | unir/cortar solo en las 30 impresas; pasante EN CURSO; simétrico y «hasta la cara» no | chico | — |
| Agujero (Hole) | SÍ `FBS:startHoleOnFace`, `occt:drillHole` | PARCIAL (un círculo bocetado + Cortar) | agujero de catálogo: pasante, caja para la cabeza, hexágono para tuerca atrapada M3/M5/M6 con holgura de impresión | mediano | contorno en el boceto; pasante (en curso) |
| Revolución (Revolution / Groove) | SÍ `occt:revolvePolygon` | NO | un golpe de tipo revolución y un eje | mediano | ejes de construcción |
| Barrido y transición (Pipe / Loft) | SÍ `occt:sweepProfileAlong`, `occt:loftSections` | NO | no urge para la base | grande | — |
| Patrón rectangular/circular y espejo (Linear / Polar Pattern, Mirrored) | SÍ `FBS:applyPattern`, `occt:mirrorShape` | NO | repetir o espejar un golpe (4 tornillos, fila de ventanas) | mediano | — |
| Caja y cilindro directos (Part: Box, Cylinder) | SÍ `FBS:addComponent` | NO | cuerpo nuevo con medidas tecleadas, sin boceto | chico | mover piezas (en curso) |
| Rosca modelada y tornillo DIN | SÍ `thread.ts:makeThreadedRod`, `din-bolt.ts:makeDinBolt` | NO | insertarlos como pieza de fábrica | chico | insertar piezas (2.11) |
| Nervio y texto en relieve | NO | NO | — | mediano | — |

### 2.6 Modificar
| Función | Kernel | Taller | Qué falta para el Taller | Tamaño | Depende de |
|---|---|---|---|---|---|
| Redondeo y chaflán de aristas (Fillet / Chamfer) | SÍ `occt:filletEdges`, `occt:chamferEdges` | NO | agarrar aristas, y un golpe de tipo redondeo/chaflán | grande | tenaza ARISTA |
| Vaciado a pared delgada (Thickness) | SÍ `occt:shellSolid` | NO | golpe de tipo vaciado (cajas del tablero) | mediano | golpear cuerpos nuevos (en curso) |
| Combinar cuerpo con cuerpo: unir, restar, intersecar (Boolean) | SÍ `occt:fuse`, `occt:cut`, `occt:common` | NO | hoy solo se combina con el perfil de un golpe; falta «réstale la fuente a la base con 0.4 mm de holgura» | mediano | golpear cuerpos nuevos (en curso) |
| Partir un cuerpo con un plano | PARCIAL (solo el molde: `src/forja/mold/mold.ts:splitMoldByPlane`) | NO | partir una pieza impresa en dos cuerpos del Taller | mediano | planos de construcción |
| Mover, girar, copiar | PARCIAL (un componente se mueve por números X/Y/Z y gira solo en Z: `FBS:Component`, `occt:transformShape`; no hay copiar) | EN CURSO (mover) | copiar no está en ninguna orden | chico | mover piezas (en curso) |
| Escalar y espejo de un cuerpo | PARCIAL (espejo sí, dentro de Patrón: `FBS:applyPattern`; escalar solo existe como contracción del molde: `occt:scaleShape`) | NO | — | chico | — |
| Empujar/jalar una cara, desfasar una cara | NO | NO | es un golpe cuyo perfil es el contorno de la cara | mediano | contorno en el boceto |
| Material y apariencia | SÍ `FBS:cyclePartColor` | NO | color y material vienen fijos del generador | chico | — |
| Ángulo de salida (Draft) | SÍ `occt:draftFaces` | NO | no hace falta para imprimir | — | — |

### 2.7 Ensamblar (amarres) (FreeCAD: Assembly)
| Función | Kernel | Taller | Qué falta para el Taller | Tamaño | Depende de |
|---|---|---|---|---|---|
| Insertar una pieza guardada como componente | SÍ `FBS:insertPieza` | NO | ver 2.11 | mediano | — |
| Amarres (rígido, giro, corredera…) | PARCIAL (solo el par de engranes `FBS:buildAssembly`; el brazo trae su propia cinemática en `brazoVivo.ts`) | NO | primera versión sin resolvedor: «pega esta cara con aquella» y «alinea este eje con aquel» | mediano (completo: grande) | Medir y mover (en curso) |
| Mover el ensamble por sus amarres | PARCIAL (brazo en vivo) | NO | — | grande | amarres |

### 2.8 Inspeccionar
La Sección, que Fusion lista aquí, está en 2.1 (primera de «Las 10»).
| Función | Kernel | Taller | Qué falta para el Taller | Tamaño | Depende de |
|---|---|---|---|---|---|
| Medir distancia, ángulo, diámetro | PARCIAL (medidas automáticas `src/forja/mold/foco-medidas.ts:medidasDeLaPieza`; no hay «dos clics») | EN CURSO | hoy al agarrar solo dice área de la cara y caja del cuerpo (`FBS:agarreInfo`) | — | orden Medir |
| Interferencia y holgura entre cuerpos | PARCIAL (engranes `FBS:sweepMeshingInterference`; molde `src/forja/mold/collision.ts:meshesInterfere`) | NO | los «jueces» del laboratorio vienen calculados de fábrica y no revisan lo que tú cambias | mediano | — |
| Volumen, masa y centro de masa | SÍ `occt:massProperties` | NO en pantalla (`FBS:volumenDeMalla` solo responde a los scripts de prueba) | mostrarlo al agarrar un cuerpo, con gramos de filamento | chico | — |
| Revisión de impresión: cabe en la cama, voladizos | SÍ `src/forja/mech/dfm.ts:printabilityReport` | NO | la función recibe una malla: basta pasarle la de la pieza agarrada | chico | — |
| Esfuerzos (FEA) | SÍ `fea.ts` | NO | después | grande | — |

### 2.9 Construcción (planos y ejes de referencia) (FreeCAD: Datum plane / Datum line)
| Función | Kernel | Taller | Qué falta para el Taller | Tamaño | Depende de |
|---|---|---|---|---|---|
| Plano desfasado; plano en ángulo | SÍ `occt:offsetPlane` (en ángulo solo desde los scripts de prueba: `sketchOnPlane3d` en `FBS`) | NO | «plano a X mm de esta cara», visible y agarrable | mediano | — |
| Plano medio entre dos caras, plano por tres puntos, ejes y puntos | NO | NO | el eje de un cilindro sale del ajuste que trae Medir | mediano | Medir (en curso) |

### 2.10 Los golpes, la historia y deshacer
| Función | Kernel | Taller | Qué falta para el Taller | Tamaño | Depende de |
|---|---|---|---|---|---|
| Deshacer / rehacer (Ctrl+Z, Ctrl+Y) | SÍ `FBS:undo`, `FBS:redo` (pila `histRef`) | EN CURSO | en `a313251` la foto de deshacer (`DocSnap`) no incluye los golpes | — | orden yunque-barrido |
| Lista de operaciones editable | SÍ `FBS:renameOp`, `FBS:toggleSuppressOp`, `FBS:moveOp`, `FBS:rollTo` | PARCIAL (LOS GOLPES: cambiar profundidad y borrar) | renombrar, suspender, reordenar y regresar en el tiempo | chico | — |
| Parámetros con nombre y fórmulas | SÍ `expr.ts:resolveParams` | NO | «pared = 3» y que los golpes lo usen | mediano | reabrir boceto |
| Versiones (Ctrl+S y lista de versiones) | SÍ `disenosNube.ts:guardarVersion` | SÍ (los golpes viajan en el documento: `FBS:DocState.golpes`) | — | — | — |
| Aviso de «esta cara ya no existe» al regenerar | NO | NO | los golpes se reaplican por coordenadas, sin avisar | mediano | — |

### 2.11 Insertar y exportar
| Función | Kernel | Taller | Qué falta para el Taller | Tamaño | Depende de |
|---|---|---|---|---|---|
| Importar un STEP | SÍ `FBS:importStepFile`, `occt:importSTEP` (reemplaza la pieza principal) | NO | que entre como PIEZA DE FÁBRICA del Taller, con su sólido | mediano | mover piezas (en curso) |
| Exportar STEP y STL de una pieza | SÍ `occt:exportSTEP`, `FBS:exportSTL` | EN CURSO | — | — | orden yunque-barrido |
| Exportar el ensamble completo con nombres | SÍ `occt:exportSTEPEnsamble` (hoy solo lo usa el molde) | NO | bajar un módulo entero para la rebanadora | mediano | exportar (en curso) |
| 3MF, DXF/SVG de un boceto, imagen de calco | NO | NO | — | chico c/u | — |

### 2.12 Planos 2D (FreeCAD: TechDraw)
| Función | Kernel | Taller | Qué falta para el Taller | Tamaño | Depende de |
|---|---|---|---|---|---|
| Plano de tres vistas acotado | SÍ `drawing.ts:generateDrawing`, `FBS:genPlano` | NO | el botón pide sólido del kernel; la función recibe malla + aristas | mediano | conservar el sólido forjado |
| Vista de detalle, tolerancias de muestra, lámina isométrica | SÍ `drawing.ts:DrawingMeta`, `isoview.ts:isoView` | NO | igual que arriba | mediano | fila anterior |

### 2.13 Donde el corpus ya no dice la verdad (manda el código)
- `PLAN-MAESTRO-FORJA.md` (30 de junio) dice que al editor de boceto le faltan recortar, desfasar, espejo y varios perfiles: **ya existen** (`SkEd:Tool`). De sus «4 restricciones sin botón» quedan 2 (concéntrica y punto-sobre-línea).
- El mismo plan dice «sin árbol editable, sin cubo de vistas, sin menú radial»: **los tres existen** (`FBS:moveOp`/`FBS:rollTo`, GizmoViewcube en `FBS:CadViewport`, `RadialMenu.tsx`). Y «maquinado 0.5/10, botones apagados»: hoy hay 9 botones de manufactura vivos sobre `src/forja/cam/`.
- El plan marca como «ADOPTAR» manifold, Clipper2, three-mesh-bvh y Kiri:Moto: **ninguna está en `package.json`**. Y lista `occt-import-js` como MIT: **es LGPL-2.1** (`node_modules/occt-import-js/package.json` y su repositorio).
- `README.md` del corpus da por faltantes «boceto sobre cara, menú radial, cubo de vistas»: ya están. **Sigue faltando «proyectar aristas»**, que es el hueco de esta tabla.
- `MOLDE-COMANDOS.md` habla de 184 comandos; el bus (`src/forja/commands/registry.ts`) registra 63: fórmulas del molde, los pasos del curso y utilerías de forma. Ninguna función de CAD general ni del Taller pasa por el bus.
- `ensambles-opensource.md` pone FreeCAD-library como LGPL: sus piezas son **CC-BY 3.0**. Y step.parts es MIT solo para su material propio (sección 4).

## 3. Las 10 siguientes (para rediseñar la base y poder imprimirla)

No repito lo que ya está en construcción esta noche: **Medir, exportar STL/STEP de la pieza forjada, corte pasante, deshacer golpes, golpear cuerpos nuevos y mover piezas**. Todo lo de abajo vive dentro del mismo estudio (`ForgeBRepStudio.tsx`); ninguna pide una pantalla nueva.

1. **Prender Sección, vistas y Encuadrar en el laboratorio** (chico). Para decidir por dónde pasa un cable hay que ver la base cortada. Reúsa todo: el corte ya llega a `FBS:RefMesh`; solo se quita el candado de los botones. Puede venir en la propuesta de barra del agente de uso.
2. **Piezas de fábrica nuevas: caja o cilindro con medidas, y STEP importado** (mediano). Tu fuente, tu motor y tu alimentador no son los del diseño; sin ponerlos a su tamaño real no hay nada que rediseñar alrededor. Reúsa `FBS:RefPart` (la caja y el cilindro ya son tipos de pieza), `occt:importSTEP`, `occt:tessellate` y mover piezas.
3. **El contorno de la cara dentro del boceto, con imanes y cotas desde el borde** (mediano). Es lo que vuelve útiles las ventanas para cables y los soportes: «a 12 mm de la orilla, centrada». Reúsa `FBS:carasDeMalla` (ya sabe qué triángulos son de cada cara: sus orillas son el contorno), las líneas de construcción y `SkEd:computeSnap`.
4. **Golpes de catálogo: barreno pasante, caja para cabeza y cajera hexagonal de tuerca atrapada M3/M5/M6** (mediano). Es tu decisión del 11-09 (M5/M6 con tuerca atrapada, a presión o con calor). Reúsa el polígono de 6 lados del boceto, `din-bolt.ts:dinBoltInfo` (medida entre caras de la tuerca), `thread.ts:METRIC_COARSE`, las holguras de `src/forja/mold/fits.ts` y el corte pasante.
5. **Patrón y espejo de golpes** (mediano). Cuatro tornillos, una fila de ventanas, lo mismo del otro lado: sin esto cada uno se boceta a mano. Reúsa `occt:transformShape` y `occt:mirrorShape` sobre la herramienta del golpe antes de unir o cortar.
6. **Reabrir el boceto de un golpe** (mediano). Pediste que sea «fácil de modificar»; hoy cambiar una ventana de 30 a 35 mm es borrarla y volverla a dibujar. Pide que el golpe guarde el boceto completo (hoy guarda solo el polígono) y que el editor acepte un boceto inicial.
7. **Planos de construcción: desfasado de una cara y plano medio entre dos** (mediano). Hacen falta para partir módulos y para bocetar donde no hay cara. Reúsa `occt:offsetPlane`, `FBS:planoDeCaraRef` y el visor del plano de boceto (`FBS:SketchPlane`).
8. **Partir un cuerpo en dos con un plano** (mediano). Es «armar por partes» y también «no cabe en la cama: pártela». Reúsa `occt:cut`/`occt:common` con medio espacio (el patrón de `splitMoldByPlane`), `occt:solidsOf` y el paso 7.
9. **Interferencia y holgura entre lo que agarres** (mediano). Antes de imprimir 3 kg hay que saber si el soporte nuevo choca con la fuente y si la tuerca entra. Reúsa `src/forja/mold/collision.ts:meshesInterfere` y `meshPenetration` (trabajan sobre mallas, sirven a los tres tipos de pieza) o `occt:common` entre impresas.
10. **Revisión de impresión de la pieza forjada** (chico). Cabe en la cama, cuánto voladizo, gramos. Reúsa `src/forja/mech/dfm.ts:printabilityReport` y `overhangVertexColors` tal cual, más `FBS:volumenDeMalla`.

Después de estas diez: amarres «cara con cara / eje con eje», tenaza ARISTA con redondeo y chaflán, vaciado, combinar cuerpo con cuerpo, planos 2D de una pieza del Taller y parámetros con nombre.

## 4. Código abierto y la ley

Esto no es asesoría legal: digo lo que cada licencia dice y dónde confirmarlo. La regla que el proyecto ya se puso (`PLAN-MAESTRO-FORJA.md` §1 y §3) sigue siendo buena: **nada GPL ni AGPL metido en el sitio; LGPL solo como archivo aparte y reemplazable; lo demás, licencias permisivas.**

**Lo que La Forja ya usa** (de `package.json`; licencia leída en `node_modules/<paquete>/package.json`):
- `opencascade.js` 1.1.1 — **LGPL-2.1**. Es el kernel. OpenCascade mismo se publica como «LGPL 2.1 with an additional exception» (https://occt3d.com/open-cascade-technology/index.html; texto de la excepción: https://github.com/Open-Cascade-SAS/OCCT/blob/master/OCCT_LGPL_EXCEPTION.txt).
- `occt-import-js` 0.0.23 — **LGPL-2.1** (https://github.com/kovacsv/occt-import-js). No lo usa El Taller; lo usa `src/lib/step-import.ts`.
- `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `react`, `zustand`, `cmdk`, `radix-ui`, `jspdf`, `jspdf-autotable`, `katex` — **MIT**. `lucide-react` (iconos) — **ISC**. `postprocessing` (llega con otra) — **Zlib**. `@resvg/resvg-js` — **MPL-2.0**, solo en scripts, no en el sitio.
- Hecho en casa, sin licencia de terceros: el resolvedor de restricciones del boceto (`sketch-solver.ts`), los planos (`drawing.ts`), el rebanador y el análisis de esfuerzos.

**Lo que valdría la pena sumar** (licencia verificada hoy en su fuente):
| Librería | Para qué en El Taller | Licencia | Fuente |
|---|---|---|---|
| `three-mesh-bvh` | agarrar, medir y pegar imanes a aristas rápido en 226 piezas; interferencia entre mallas | MIT | https://github.com/gkjohnson/three-mesh-bvh/blob/master/LICENSE |
| `manifold-3d` | unir y cortar piezas de fábrica que solo tienen malla; respaldo cuando el kernel falla (regresa malla, no sólido) | Apache-2.0 | https://github.com/elalish/manifold/blob/master/LICENSE |
| `three-bvh-csg` | ver el corte en vivo antes de forjar | MIT | https://github.com/gkjohnson/three-bvh-csg/blob/main/LICENSE |
| `clipper2-wasm` (Clipper2) | holgura alrededor de un contorno proyectado, desfases 2D robustos | BSL-1.0 | https://github.com/ErikSom/Clipper2-WASM · https://github.com/AngusJohnson/Clipper2/blob/main/LICENSE |
| `@salusoft89/planegcs` | el resolvedor de boceto de FreeCAD en WASM; solo si el nuestro topa pared (hoy no) | LGPL (el repo dice 2.1; su `package.json`, «LGPL-2.0-or-later») | https://github.com/Salusoft89/planegcs |
| step.parts (modelos STEP) | tuercas, baleros 608, motores como piezas de fábrica | MIT solo para su material propio; cada STEP de terceros conserva la suya (ver su `THIRD_PARTY_NOTICES.md`) | https://github.com/earthtojake/step.parts |
| FreeCAD-library (modelos) | tornillería y perfiles | CC-BY 3.0: atribuir a cada autor | https://github.com/FreeCAD/FreeCAD-library |

**Lo que NO se mete al sitio:** el resolvedor de SolveSpace es **GPL-3.0** (https://github.com/solvespace/solvespace/blob/master/COPYING.txt): obligaría a publicar el código que lo incluya bajo GPL. El resolvedor de ensambles de FreeCAD (OndselSolver, **LGPL-2.1**, https://github.com/Ondsel-Development/OndselSolver) está archivado desde marzo de 2025 y su página no menciona versión para navegador: por eso los amarres se proponen primero sin resolvedor. FreeCAD entero es LGPL (su repositorio declara LGPL-2.1: https://github.com/FreeCAD/FreeCAD): se puede estudiar; reusar su código arrastra las obligaciones de abajo.

**Qué obliga cada licencia en un sitio web comercial**
- **MIT, ISC, Zlib, BSL-1.0, Apache-2.0:** permiten uso comercial y código cerrado. Piden conservar el aviso de derechos y el texto de la licencia en las copias (Apache-2.0 además el archivo NOTICE si lo trae y señalar los archivos que modifiques). Como el empaquetador borra los comentarios, lo prudente es servir una página «Licencias de terceros».
- **LGPL-2.1 (el kernel):** tu código puede seguir cerrado, pero quien entrega la biblioteca debe avisar de forma visible que la usa y que va bajo LGPL, dar el texto de la licencia, ofrecer el código fuente de esa versión (con tus cambios, si los hay) y dejar que el usuario la sustituya por una versión modificada. La Forja ya la sirve como archivo aparte (`occt:initOCCT` con `locateFile`), que es lo que la hace sustituible. **No encontré en el repo el aviso visible ni el texto de la licencia** (solo un comentario en `occt.ts`): es lo primero que yo confirmaría.
- **CC-BY 3.0 (modelos):** dar crédito al autor y decir si lo modificaste.

**Fusion y SolidWorks: qué no copiar y qué sí es libre**
- **No copiar:** sus iconos y arte; sus nombres y logotipos (Fusion 360, Autodesk, SolidWorks) como nombre de producto, de modo o de botón; los textos de su ayuda, tutoriales y mensajes; capturas de pantalla; sus archivos de ejemplo; la apariencia calcada (misma disposición, mismos colores, mismo cubo). `referencias-cad.md` es un resumen propio con enlaces: sirve para trabajar, no para publicarlo tal cual.
- **Sí es libre:** las funciones, el orden de los pasos, los nombres del oficio (extruir, redondeo, chaflán, boceto), la idea de un atajo, y los formatos abiertos (STEP, STL). La regla general es que se protege la forma en que algo está expresado, no la idea ni el método.
- La Forja ya va por el lado seguro: nombres propios (El Taller, las tenazas, el yunque, los golpes, los amarres), iconos propios (`src/forja/brep/icons.tsx`) más `lucide-react`. Decir «como el navegador de Fusion» en documentos internos es comparación; en publicidad o en la interfaz conviene que lo vea un abogado de marcas (IMPI).

## 5. Lo que NO sé o no pude verificar

- **No vi nada funcionando.** Todo «sirve hoy» sale de leer el código de `a313251` y de los cierres de las órdenes del 11-09 y 11-10 (que sí corrieron sus pruebas en navegador). No abrí el laboratorio.
- **Que «Extruir» de la cinta crea un sólido aparte en el laboratorio lo leí, no lo vi:** el documento del laboratorio llega con cero operaciones (`FBS:laboratorioDoc`) y el botón agrega una extrusión del boceto por omisión (`FBS:addOp`), sin mirar qué está agarrado.
- **Lo que está «EN CURSO» lo tomé de las órdenes de hoy**, no de código terminado. El archivo del estudio en el repo ya trae cambios sin guardar del coordinador; no los conté como hechos.
- **La lista de funciones de Fusion fuera del espinazo la armé de memoria** (sus menús Crear, Modificar, Ensamblar, Inspeccionar, Construir, Insertar). El corpus solo documenta el espinazo y el lenguaje visual, y el encargo prohibía volver a investigar. Puede faltar alguna función que tú uses.
- **Cuáles de las 30 impresas se dejan unir y cortar de verdad** lo dirá el barrido de esta noche. Hay un candado en el código («pieza girada en el doc: todavía no se forja»); según el JSON del laboratorio ninguna de las 30 está girada, pero no lo probé.
- **Los tamaños (chico / mediano / grande) son mi juicio**, no una medición.
- **Licencias:** leí el aviso de cada repositorio, no cada archivo. No revisé la licencia de cada STEP dentro de step.parts. De la excepción de OpenCascade leí un resumen, no el texto completo. No comprobé si el sitio en producción ya muestra un aviso de licencias (tenía prohibido abrir producción); en el repo no lo encontré.
- **Lo legal sobre marcas y apariencia** es la regla general que conozco, no una consulta: no cité artículos de ley porque no los verifiqué.
- **No sé si `ForgePage` (la que usa `occt-import-js`) sigue publicada.**
