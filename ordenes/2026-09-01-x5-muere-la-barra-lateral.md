# ORDEN: X5 · MUERE LA BARRA LATERAL — la pieza a toda pantalla

BASE: 07ecefa
TIPO: imprevisto

OBJETIVO: ian, viendo el Foco sobre su 1594C Lid:

> «Las pantallas están pasadísimas de verga. **ESA BARRA LATERAL ROMPE CON TODO**, pero igual
> no sé si arreglarla o quitarla. Y vamos añadiendo en el camino, regresando a los WIP de
> Temis. No es que quiera que mi CAD sea un videojuego —que casi casi lo es— **quiero que los
> de mi generación vean la interfaz y recuerden los juegos, que les traiga felicidad.**»

**DECISIÓN: se quita.** Una barra lateral bonita sigue siendo una barra lateral; no se puede
maquillar un problema de estructura.

## MEDIDO EN PRODUCCIÓN (por eso no hay salida arreglándola)

    barra:      230 px  =  14.4 % del ancho, permanente
    contenido: 1282 px  en una pantalla de 1000  →  cabe el 78 %

Ocupa el 14 % de la pantalla **y aun así no le alcanza**. Arreglarla es elegir entre quitar
información o apretarla más: las dos pierden.

## EL REENCUADRE: la barra es un ASILO, no un estilo

Todo lo que sigue en la columna es **exactamente lo que no tiene coordenada**. El Foco le dio
casa a lo que sabe dónde ocurre (las cotas, la marca, la ficha) y en la barra quedó la data sin
domicilio. Quitarla no es rediseñar: es **mudar cada cosa a su casa**, y las casas ya existen.

| qué | a dónde se muda |
|---|---|
| nombre · score · arquitectura | **EL PARTE** (el borde inferior) |
| el botón EL FOCO + `Q` | no es información, es un modo — **se va**, `Q` ya lo hace |
| las 4 lentes | EL PARTE, horizontales (las pestañas de Shipbreaker) |
| la leyenda del campo | EL PARTE, junto a las lentes: es la clave del color |
| celda · vóxeles · ms | EL PARTE, chiquito: es procedencia |
| el dictamen (18 hallazgos) | **LA LÁMINA** — se llama, no vive fija |

## LA LÍNEA QUE NOS SALVA DE VOLVERLO UN JUEGO
**Solo se acepta el gesto de videojuego que ADEMÁS informa.** El barrido informa (dice que el
campo se calculó y en qué orden). Los corchetes de visor y la viñeta no informan → NEL, por
rifados que se vean. Así se siente juego sin serlo.

## EJERCICIOS
- x5-sin-barra · Con una malla cargada, la columna NO se renderiza · guarda · el ancho útil pasa de 85.6 % a 100 %; con un sólido del kernel el panel de FEA sigue igual que siempre
- x5-el-parte · Nace EL PARTE DEL FOCO en el borde inferior · dos renglones · lentes + leyenda del campo activo + nombre/score/arquitectura + procedencia + el contador del dictamen
- x5-la-lamina · El dictamen se LLAMA, no vive fijo · overlay · el contador `✗n ⚠n` es botón y la tecla `D` lo abre; se cierra con `Esc`, clic fuera o el mismo botón
- x5-reusa-el-dictamen · La lámina NO reescribe la lista · `RevisarPiezaPanel` · se reusa entero (agrupado, colapsable, los 69) — ian ya dijo «está bien hecho»; lo que cambia es DÓNDE vive, no qué dice
- x5-nada-se-pierde · Ninguna información desaparece · inventario · las 7 cosas de la tabla siguen alcanzables, y el gate lo verifica contando testids
- x5-sin-regresion · El CAD del kernel intacto · gate · `ciclo-dado-test.cjs` verde y el drive sin errores de consola

## YA-EXISTE (prueba de ausencia)
- `<footer className="fb-invariants">` YA es EL PARTE: la barra de estado del borde inferior.
  Se le suma un renglón; no nace una barra nueva.
- `RevisarPiezaPanel` completo (dictamen agrupado, colapsable, los 69, el lote). **Se reusa tal
  cual dentro de la lámina.** Cero reescritura de la lista.
- `PanelDeLentes` ya tiene las pestañas y la leyenda con sus paradas; se re-hospeda horizontal.
- `FichaEnElMundo` (X3) ya se lleva el titular y el cuerpo al punto. Ese trabajo ya está hecho.
- NO existe: ninguna capa llamable para el dictamen, ni EL PARTE con las lentes.

## LO QUE ME PREOCUPA, DICHO ANTES
Sin la columna, **el dictamen se vuelve menos descubrible**. Se aguanta porque el contador queda
siempre visible y duele en rojo — pero si al probarlo a ian se le olvida que existe, es mi culpa
y se regresa. Queda escrito para poder juzgarlo, no para taparlo.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- public/temis.json

## CREA
- ordenes/2026-09-01-x5-muere-la-barra-lateral.md
- public/evidencia/2026-09-01-x5-muere-la-barra-lateral/resultados.json
- public/evidencia/2026-09-01-x5-muere-la-barra-lateral/pieza-a-toda-pantalla.png
- public/evidencia/2026-09-01-x5-muere-la-barra-lateral/el-parte-con-la-lente.png
- public/evidencia/2026-09-01-x5-muere-la-barra-lateral/la-lamina-del-dictamen.png

## BORRA
- (nada)

## PREEXISTENTE
- scripts/iangpu.sh
- scripts/rasgos-reels.py
- scripts/analisis-rasgos.py
- scripts/curvas-dia.py
- public/comando/analisis-rasgos.json
- public/comando/curvas-dia.json
- public/comando/rasgos-reels.json
- src/cinematic/CinematicMolecule.tsx
- videos/mol-h2o-los-dos-campos.json
- public/comando/catalogo.json
- public/comando/produccion.json
- docs/forja-research/datasheets-fuente-corriente/
- docs/inyectora/
- docs/la-fuente-esquematico.pdf
- ml-resultados.json
- public/temis-deploy.json

## EVIDENCIA (declarada ANTES de trabajar)
- captura con la pieza a TODA PANTALLA y EL PARTE abajo
- captura de LA LÁMINA abierta con el dictamen
- el ancho útil medido antes/después, en producción
- gate `ciclo-dado-test.cjs` verde · orden-gate VERDE · censo Canvas 8→8
- deploy + verificación contra el bundle SERVIDO
