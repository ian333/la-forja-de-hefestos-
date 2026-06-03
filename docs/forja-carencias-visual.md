## La Forja — Auditoría visual de los estudios CAD (B-Rep + Mecanismos)

Fundador: revisé el código real de los dos visores (`ForgeBRepStudio.tsx`, `ForgeMechStudio.tsx` y el solver `fea.ts`). Todo lo que reportaron está confirmado en el código, aunque algunos números de línea de la lista original no cuadraban con el archivo actual (el B-Rep tiene 2969 líneas, no ~1227); abajo te doy las líneas reales. Lo bueno: las dos dependencias que necesitamos ya están instaladas (`@react-three/drei ^10.7.7` trae los gizmos, `@react-three/postprocessing ^3.0.4` trae el `Noise`), así que ningún fix requiere instalar nada.

### Qué se ve mal hoy (lo que un usuario de Fusion/SolidWorks nota en 2 segundos)
1. **No hay ViewCube ni triada XYZ.** Ningún CAD pro existe sin esto. El usuario no sabe a qué cara está viendo ni cómo volver a una vista orto. Es lo primero que delata "esto no es CAD serio". Confirmado: cero `GizmoHelper` en ambos `<Canvas>`.
2. **El FEA se ve plano y falso.** Dos problemas juntos: (a) usa colormap **jet/arcoíris** (`jetColor` en `fea.ts:814`), que no es perceptual y aplana el campo; ANSYS/Abaqus modernos usan turbo/viridis. (b) Se pinta con `meshBasicMaterial` **SIN luz** (`ForgeBRepStudio.tsx:1013`), así que el volumen 3D desaparece. Y normaliza por el **máximo global** (`fea.ts:854`), no por percentil — un nodo singular dispara la escala y todo el filete reentrante (donde DEBERÍA picar en rojo) se queda azul-cian. El dato estrella del shot no se ve.
3. **Los metales se ven idénticos y planos.** Aluminio (`metalness 0.95 / rough 0.30`), acero (`0.96 / 0.26`), titanio (`0.90 / 0.40`) están casi pegados (`ForgeBRepStudio.tsx:115-118`). Con un solo HDRI 1k tenue y exposición baja (`0.70`), el selector de material "no se ve". Esa es la estética blanca/incompleta que odias.
4. **Doble metáfora de selección.** Al elegir una cara aparecen DOS cosas: el resalte dorado de la superficie Y una esfera verde flotando en el centroide (`ForgeBRepStudio.tsx:1095-1104`). Dos colores para una sola selección = lee como bug.
5. **HUD ilegible y encimado.** Las pills están a alturas FIJAS (top 74/112/148/184px), todas centradas, con texto 10-12px en gris STEEL de bajo contraste (`ForgeBRepStudio.tsx:2760-2791`). Cuando aparecen varias a la vez se montan entre sí.
6. **El mecanismo flota sin tierra.** Los pivotes fijos son conos pelones (`GroundPivot`, mech:152), sin símbolo de bancada/hatching. Las barras son cilindros pelados, las juntas se atraviesan sin pasador real.
7. **La curva acopladora (el dato estrella del mech) es invisible.** Es una línea dorada de `lineWidth 2.2` (mech:218) que compite en color con el efector dorado (mech:202, 213) y casi no se lee.
8. **Banding en fondo y metal.** El fondo es un `radial-gradient` de 3 paradas sin dither (brep:1170, mech:55) y el render es 8-bit sin ruido azul. Contradice el mandato 10-bit y posteriza las zonas oscuras.

### Qué cambiar y en qué orden
Empieza por lo que más eleva la percepción con menos riesgo: **ViewCube + arreglar el FEA + separar los metales**. Eso por sí solo cambia "demo de hobby" a "CAD". Después limpia la selección doble y el HUD (rápidos), luego el mecanismo (más LOC), y al final el dither anti-banding (cosmético).

Todo es R3F local — recuerda: NO builds locales, el render/QA va en iangpu.