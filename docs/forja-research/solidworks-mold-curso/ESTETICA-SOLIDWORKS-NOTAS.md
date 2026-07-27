# La estética de SolidWorks en tutoriales de moldes — análisis y plan para La Forja

Basado en los 24 frames (hanger 2022, hair clip 2023, peine/housing + Plastics 2018) y las notas por segmento.

---

## 1. QUÉ hace que SolidWorks se vea "chingón" (técnica concreta)

**a) Fondo degradado claro, no negro.** El viewport vive sobre un gradiente vertical blanco→gris-azulado muy suave (`#f4f6f9` arriba → `#c9ced6` abajo, aprox.). Eso hace tres cosas: la silueta de CUALQUIER cuerpo gris/acero recorta perfecto, los colores de estado (naranja/cyan/verde/magenta) saturan sin competir, y la escena se siente "estudio de ingeniería", no "espacio exterior". Nuestro `#0b0f16` es cine; el look SolidWorks es **luz**.

**b) Iluminación de estudio uniforme (tipo HDRI soft-box).** No hay sol duro ni speculares quemados: es un ambiente envolvente con 2-3 luces suaves grandes que dan un gradiente tonal continuo sobre cada cara. El metal se lee por ese gradiente, no por reflejos espejo. Cero bloom, cero glow: la "riqueza" viene del sombreado suave por curvatura.

**c) Material acero mate-satinado, no cromo.** El gris-azulado default (`#a8b0c0` aprox.) con roughness media: apenas un highlight ancho y difuso. Los renders de intro sí usan materiales más ricos (plásticos glossy rojos, placas pastel), pero el modelado diario es metal MATE — por eso nunca hay ruido especular que ensucie la geometría.

**d) Sombra de contacto suave.** Una sombra difusa elíptica bajo el modelo (piso invisible) que lo "aterriza". Sin ella los cuerpos flotan; con ella se lee masa y escala al instante. Es sutil: ~15-25% de opacidad, muy desenfocada.

**e) Silueta y aristas jerárquicas (Shaded With Edges).** El arma secreta de legibilidad: aristas de contorno/pliegue en negro fino (~1 px constante en pantalla, sin engrosar con el zoom) y aristas TANGENTES aún más finas/tenues. La geometría se dibuja a sí misma como plano técnico encima del sombreado. En los zooms al peine, los dientes se leen SOLO por esas líneas.

**f) Color por ROL, no por estética.** El código que carga toda la narrativa:
- Pieza de plástico = color saturado (rojo, verde oliva) — SIEMPRE distinta del acero.
- Cavidad vs núcleo = pasteles complementarios (verde menta vs rosa salmón).
- Colada/runner = naranja contra pieza verde (complementarios).
- Pila de placas estilo NX: cada placa de un pastel distinto, tornillería verde, guías bronce.
- Superficies de partición = azul-lavanda translúcido; el reverso en azul marino delata normales.

**g) Colores de ESTADO del sistema.** Hover = naranja; selección = cyan/azul; cuerpo seleccionado = verde brillante; preview de operación = amarillo translúcido o magenta ("propuesto, no confirmado"); cara destino = magenta. Cada clic se LEE en pantalla sin narración.

**h) Transparencia selectiva por cuerpo.** El truco estrella: `Change Transparency` (~40%) sobre UNA placa deja ver counterbores y huellas POR DENTRO sin seccionar, mientras el resto queda opaco. Más el resaltado x-ray rojo de preselección a través del vidrio (NX).

**i) Secciones e Isolate como beats visuales.** Isolate limpia la escena a UN cuerpo (y el Exit Isolate revela el molde completo de golpe). Las secciones llevan tapa sólida. Wireframe momentáneo = beat de "verificar el interior".

**j) CAE con lienzo neutro.** En Plastics, lo no-llenado se pinta gris/caqui MATE y solo el frente de flujo lleva la rampa arcoíris — el resultado brinca porque el resto calla. Leyenda vertical con números que re-escala en vivo, sprue azul como ancla focal, aristas visibles DEBAJO del mapa de color.

**k) Anclas de orientación.** Tríada abajo-izquierda, etiqueta de vista (`*Isometric`, `*Top`), vistas ortogonales secas para acotar e isométrica para operar. Callouts en el margen vacío, nunca sobre la geometría.

---

## 2. Las 10 mejoras concretas (ordenadas por impacto/costo)

| # | Mejora | R3F (viewer vivo) | SVG-splat (renders) |
|---|--------|-------------------|---------------------|
| 1 | **Modo "Estudio claro"**: fondo degradado blanco→gris-azulado como alternativa al `#0b0f16`. Costo: trivial. Impacto: es EL 60% del look. | `scene.background` con gradiente (plano fullscreen o CSS detrás de canvas alpha). Toggle oscuro/claro. | `<linearGradient>` de fondo — gratis. |
| 2 | **Paleta por ROL** (cavidad verde menta, núcleo rosa salmón, pieza saturada, colada naranja, tornillería verde, guías bronce, sufridera lila). Un solo módulo `mold-palette.ts` compartido. | Asignar material por cuerpo desde el rol semántico del ensamble. | Mismos hex en los `fill` por grupo (ya sabemos: opacity de GRUPO, no fill-opacity). |
| 3 | **Sombra de contacto** bajo el molde. | `<ContactShadows>` de drei (o AccumulativeShadows para stills): blur alto, opacity ~0.2. | Elipse con `feGaussianBlur`, gris 15-20%. |
| 4 | **Aristas jerárquicas de ancho constante en pantalla**: silueta/pliegues ~1.2 px oscuro, tangentes ~0.6 px al 40%. Hoy tenemos aristas de bloque; falta la jerarquía y el ancho fijo. | `EdgesGeometry` con umbral de ángulo ×2 pasadas (crease vs tangente) usando `Line2`/`LineMaterial` con `worldUnits:false`. | Dos grupos de stroke con `stroke-width` y opacidad distintos — ya casi lo tenemos en planos. |
| 5 | **Iluminación de estudio + acero mate**: environment PMREM tipo softbox (RoomEnvironment o Lightformers), `MeshStandardMaterial` metalness ~0.6-0.8, roughness ~0.45, SIN highlights quemados. | Directo en R3F; matar luces puntuales duras. | Aproximar con sombreado 2-3 tonos por cara (lambert precalculado por normal) — el gradiente suave no sale en SVG, pero el flat-shading por cara con la paleta correcta se ve a plano técnico. |
| 6 | **Bloom dosificado por modo**: en modo CAD/molde el bloom baja a ~0 (SolidWorks no tiene NINGUNO); se queda solo para modo cine. El bloom sobre acero gris lee "sci-fi", no "taller". | Flag de EffectComposer por modo. | N/A (no hay bloom en SVG — ventaja). |
| 7 | **Transparencia selectiva por placa** al estilo Change Transparency 40: hoy tenemos acero translúcido global; falta que sea POR CUERPO con el resto opaco, `depthWrite:false` en el translúcido y orden de render correcto, + resaltado x-ray del cuerpo interior al hacer hover. | Toggle por placa en el árbol; material clonado con opacity 0.4. | Ya lo hacemos en planos con color — portar la misma receta al iso 3D del splat. |
| 8 | **AO de esquinas** (las cavidades talladas en el bloque se oscurecen solas): N8AO/SSAO suave en el viewer. Es lo que hace que las improntas del gancho "se hundan" en el acero. | Pase N8AO con intensidad baja (0.5-1.0). | No viable en SVG; compensar oscureciendo 8-12% las caras interiores de bolsillos (sabemos cuáles son por normal + profundidad). |
| 9 | **CAE sobre lienzo neutro + leyenda viva**: en el llenado por splats, pintar lo NO llenado caqui/gris mate (no invisible, no oscuro) y solo el frente/llenado con la rampa; leyenda vertical con valores numéricos que re-escala conforme avanza t; sprue en azul saturado como ancla. | Uniform de color "unfilled" en el shader de splats + overlay DOM de leyenda. | Rampa + leyenda como grupo SVG fijo; splats no llenados en caqui. |
| 10 | **Anclas de orientación y estado**: tríada abajo-izquierda, etiqueta de vista (`*Isometric`), callouts anclados a geometría (Radius: 20mm) en el margen vacío, y colores de estado consistentes (hover naranja, selección cyan, preview amarillo translúcido) en TODO el CAD. | Ya hay drive/pick — unificar los colores de estado en un solo theme. | Tríada y etiqueta como grupo SVG estándar en cada render. |

**Regla de oro que emerge de los 24 frames:** el color decorativo casi no existe; el 95% del color es INFORMACIÓN (rol del cuerpo, estado de selección, resultado CAE). Cuando todo color significa algo, la escena se ve profesional sola.

---

## 3. Qué NO copiar (ruido de UI, no estética)

- **El chrome de la interfaz**: CommandManager de 3 filas, PropertyManager denso, árbol de features gigante, panel de "Welcome to SOLIDWORKS", barra de tareas de Windows, reloj, marca de agua del tutorial. Nada de eso es el look — es lastre. Nuestros renders van a pantalla LIMPIA.
- **Diálogos flotantes tapando el modelo** (Analysis Manager, Save As encima de la pieza). En los frames de Plastics el instructor los reacomoda a mano; nosotros no tenemos por qué tenerlos.
- **Los callouts serif itálica quemados** ("Hole for Guide Bush", "Right Click on the Mouse") — son subtítulos de tutorial, no lenguaje del viewport. Si anotamos, que sea con nuestro sistema de captions (overlay DOM / ffmpeg), tipografía propia.
- **El aliasing y la resolución del capture**: las líneas dentadas y el texto borroso de los frames son artefacto de grabación 2013-2018, no meta estética. Nosotros rendereamos con MSAA/supersampling — las aristas finas de ancho constante deben salir NÍTIDAS.
- **El blanco puro quemado como fondo de render** (intros): quema la silueta de placas claras. Mejor el degradado gris-azulado del viewport, que siempre da contraste.
- **La rampa arcoíris como default universal**: la conservamos como "idioma moldista" en fill-time (es lo que el gremio lee), pero para campos escalares nuestros (temperatura, presión) tenemos rampas perceptuales mejores — arcoíris solo donde imita al estándar de la industria.
- **El pan/orbit nervioso del instructor**: nuestros videos ya tienen doctrina de cámara con peso; el movimiento de mouse crudo no se imita.
- **Wireframe permanente**: en SolidWorks el wireframe es un beat momentáneo de verificación; como estado por default ensucia. Usarlo igual: 1-2 segundos y de regreso.

**Síntesis en una línea:** SolidWorks se ve chingón porque es un estudio fotográfico GRIS CLARO con sombra de contacto, acero mate delineado con tinta fina, y un idioma de color donde cada tono es información — nada brilla, todo se lee. Nuestro camino: modo estudio claro + paleta por rol + sombra + aristas jerárquicas (mejoras 1-4 son un día de trabajo y dan el 80% del salto), y dejar el look nocturno con bloom exclusivamente para el cine.